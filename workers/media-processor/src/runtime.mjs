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

export async function cpuBudget() {
  const cgroupV2 = await readNumberFile('/sys/fs/cgroup/cpu.max');
  if (cgroupV2) {
    const [quota, period] = cgroupV2.split(/\s+/);
    if (quota !== 'max' && Number(quota) > 0 && Number(period) > 0) return Number(quota) / Number(period);
  }
  const quotaV1 = Number(await readNumberFile('/sys/fs/cgroup/cpu/cpu.cfs_quota_us'));
  const periodV1 = Number(await readNumberFile('/sys/fs/cgroup/cpu/cpu.cfs_period_us'));
  if (quotaV1 > 0 && periodV1 > 0) return quotaV1 / periodV1;
  return typeof os.availableParallelism === 'function' ? os.availableParallelism() : os.cpus().length;
}

export async function memoryBudgetBytes() {
  const cgroupV2 = await readNumberFile('/sys/fs/cgroup/memory.max');
  if (cgroupV2 && cgroupV2 !== 'max' && Number(cgroupV2) > 0) return Number(cgroupV2);
  const v1 = Number(await readNumberFile('/sys/fs/cgroup/memory/memory.limit_in_bytes'));
  // cgroup v1 reports a huge sentinel when unlimited.
  if (v1 > 0 && v1 < 2 ** 60) return v1;
  return os.totalmem();
}

/** Threads for one FFmpeg run: every core we are given, held back on small memory. */
export function ffmpegThreadsFor(cpus, memoryBytes, override = process.env.MEDIA_FFMPEG_THREADS) {
  if (override && Number(override) > 0) return Math.floor(Number(override));
  let threads = Math.max(1, Math.round(cpus));
  const gib = memoryBytes / 1024 ** 3;
  if (gib < 1.5) threads = Math.min(threads, 3);
  else if (gib < 3) threads = Math.min(threads, 6);
  return Math.min(threads, 16);
}

let resourcesPromise = null;
export function containerResources() {
  resourcesPromise ??= (async () => {
    const [cpus, memoryBytes] = await Promise.all([cpuBudget(), memoryBudgetBytes()]);
    return { cpus, memoryBytes, ffmpegThreads: ffmpegThreadsFor(cpus, memoryBytes) };
  })();
  return resourcesPromise;
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
