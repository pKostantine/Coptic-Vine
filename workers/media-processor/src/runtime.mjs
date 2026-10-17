import { spawn } from 'node:child_process';
import { readFile, rm, statfs, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import ffmpegPath from 'ffmpeg-static';

/**
 * What the container really has. Node reports the host's CPUs and memory, not
 * the cgroup limits a Railway service runs under, and FFmpeg's automatic
 * threading follows the host: on a many-core host a single HEVC decode would
 * start dozens of frame threads and run a 1 GB service out of memory.
 */
async function readNumberFile(file) {
  try {
    return (await readFile(file, 'utf8')).trim();
  } catch {
    return null;
  }
}

/** CPUs this container may use, and whether that is a real limit or just the host's core count. */
export async function cpuBudget() {
  const cgroupV2 = await readNumberFile('/sys/fs/cgroup/cpu.max');
  if (cgroupV2) {
    const [quota, period] = cgroupV2.split(/\s+/);
    if (quota !== 'max' && Number(quota) > 0 && Number(period) > 0) return { cpus: Number(quota) / Number(period), known: true };
  }
  const quotaV1 = Number(await readNumberFile('/sys/fs/cgroup/cpu/cpu.cfs_quota_us'));
  const periodV1 = Number(await readNumberFile('/sys/fs/cgroup/cpu/cpu.cfs_period_us'));
  if (quotaV1 > 0 && periodV1 > 0) return { cpus: quotaV1 / periodV1, known: true };
  return { cpus: typeof os.availableParallelism === 'function' ? os.availableParallelism() : os.cpus().length, known: false };
}

/** Memory this container may use, and whether that is a real limit or just the host's RAM. */
export async function memoryBudgetBytes() {
  const cgroupV2 = await readNumberFile('/sys/fs/cgroup/memory.max');
  if (cgroupV2 && cgroupV2 !== 'max' && Number(cgroupV2) > 0) return { bytes: Number(cgroupV2), known: true };
  const v1 = Number(await readNumberFile('/sys/fs/cgroup/memory/memory.limit_in_bytes'));
  // cgroup v1 reports a huge sentinel when unlimited.
  if (v1 > 0 && v1 < 2 ** 60) return { bytes: v1, known: true };
  return { bytes: os.totalmem(), known: false };
}

// With no visible memory limit, the host's RAM says nothing about what the
// platform will let this service use before it kills FFmpeg.
const UNKNOWN_LIMIT_MAX_THREADS = 4;

/** Threads for one FFmpeg run: every core we are given, held back on small or unknown memory. */
export function ffmpegThreadsFor(cpus, memoryBytes, { memoryKnown = true, override = process.env.MEDIA_FFMPEG_THREADS } = {}) {
  if (override && Number(override) > 0) return Math.floor(Number(override));
  let threads = Math.max(1, Math.round(cpus));
  const gib = memoryBytes / 1024 ** 3;
  if (!memoryKnown) threads = Math.min(threads, UNKNOWN_LIMIT_MAX_THREADS);
  else if (gib < 1.5) threads = Math.min(threads, 3);
  else if (gib < 3) threads = Math.min(threads, 6);
  return Math.min(threads, 16);
}

/**
 * Each retry of a job uses fewer threads (half, then at most two): if the
 * last attempt was killed for using too much memory, the next one fits.
 */
export function threadsForAttempt(threads, attempt) {
  const tries = Math.max(1, Number(attempt) || 1);
  if (tries === 1) return threads;
  if (tries === 2) return Math.max(1, Math.ceil(threads / 2));
  return Math.max(1, Math.min(2, Math.ceil(threads / 2)));
}

let resourcesPromise = null;
export function containerResources() {
  resourcesPromise ??= (async () => {
    const [cpu, memory] = await Promise.all([cpuBudget(), memoryBudgetBytes()]);
    return {
      cpus: cpu.cpus,
      cpuLimitKnown: cpu.known,
      memoryBytes: memory.bytes,
      memoryLimitKnown: memory.known,
      ffmpegThreads: ffmpegThreadsFor(cpu.cpus, memory.bytes, { memoryKnown: memory.known }),
    };
  })();
  return resourcesPromise;
}

/** What a run that ended on a signal most likely means, for the error shown to admins. */
export function describeFfmpegExit(code, signal) {
  if (signal === 'SIGKILL' || (code === null && !signal)) {
    return 'FFmpeg was stopped by the server, almost always for using too much memory; the next attempt uses fewer threads';
  }
  if (signal) return `FFmpeg was stopped by ${signal}`;
  return `FFmpeg exited with code ${code}`;
}

export async function freeDiskBytes(directory) {
  try {
    const info = await statfs(directory);
    return Number(info.bavail) * Number(info.bsize);
  } catch {
    return 0;
  }
}

function run(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { shell: false, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', (error) => resolve({ ok: false, stderr: error.message }));
    child.once('close', (code) => resolve({ ok: code === 0, stderr }));
  });
}

/** Frees the disk blocks of an already-uploaded byte range of a file. */
export async function punchHole(file, offset, length) {
  const result = await run('fallocate', ['--punch-hole', '--keep-size', '--offset', String(offset), '--length', String(length), file]);
  if (!result.ok) throw new Error(`Could not free uploaded disk space: ${result.stderr.trim() || 'fallocate failed'}`);
}

const holePunchSupport = new Map();
/** Whether this filesystem can give back the blocks of a file that is still being written. */
export function canPunchHoles(directory) {
  if (!holePunchSupport.has(directory)) {
    holePunchSupport.set(directory, (async () => {
      if (process.platform !== 'linux') return false;
      const probe = path.join(directory, `.coptic-vine-hole-probe-${process.pid}`);
      try {
        await writeFile(probe, Buffer.alloc(2 * 1024 * 1024, 1));
        await punchHole(probe, 0, 1024 * 1024);
        return true;
      } catch {
        return false;
      } finally {
        await rm(probe, { force: true }).catch(() => undefined);
      }
    })());
  }
  return holePunchSupport.get(directory);
}

let filtersPromise = null;
/** The FFmpeg filters this build has (HDR tone mapping needs zscale and tonemap). */
export function ffmpegFilters() {
  filtersPromise ??= new Promise((resolve) => {
    const child = spawn(ffmpegPath, ['-hide_banner', '-filters'], { shell: false, windowsHide: true });
    let stdout = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.once('error', () => resolve(new Set()));
    child.once('close', () => {
      const names = new Set();
      for (const line of stdout.split('\n')) {
        const match = line.match(/^\s*[.A-Z|]{3}\s+(\S+)\s/);
        if (match) names.add(match[1]);
      }
      resolve(names);
    });
  });
  return filtersPromise;
}
