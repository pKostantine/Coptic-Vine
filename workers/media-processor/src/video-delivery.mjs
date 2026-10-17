import { createHash } from 'node:crypto';
import { mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import ffmpegPath from 'ffmpeg-static';
import { DELIVERY_PART_BYTES, GrowingFileUploader, sendWithRetry, streamToMultipart } from './growing-upload.mjs';
import { canPunchHoles, containerResources, describeFfmpegExit, ffmpegFilters, freeDiskBytes, threadsForAttempt } from './runtime.mjs';
import { openR2RangeServer, probeUrl, sha256OfFile } from './streamed-media.mjs';

/*
 * Lesson video delivery: one FFmpeg pass reads the private original straight
 * from R2 and writes both the delivery MP4 and (when the job has an audio-only
 * companion) the audio-only M4A. The MP4 uploads while it is being encoded.
 *
 * Quality: H.264 at CRF 23 with the `veryfast` preset, capped at 1080p (the
 * short edge, so portrait phone videos keep their resolution), 30 fps and
 * 6 Mbit/s peaks. For lessons (people, a whiteboard, an altar) that is clear
 * and typically a fifth to a tenth of a phone original's size, and encodes
 * about twice as fast as the `fast` preset it replaces. Sources that are
 * already compact H.264 are copied rather than re-encoded.
 */
export const VIDEO_MAX_SHORT_EDGE = 1080;
export const VIDEO_MAX_FPS = 30;
export const VIDEO_PRESET = 'veryfast';
export const VIDEO_CRF = 23;
export const VIDEO_MAXRATE = '6M';
export const VIDEO_BUFSIZE = '12M';
const VIDEO_MAXRATE_BPS = 6_000_000;
export const VIDEO_AUDIO_BITRATE = '160k';
export const AUDIO_ONLY_BITRATE = '192k';
// Compact H.264 up to this bitrate is already a good delivery file.
const COPY_MAX_VIDEO_BPS = 8_000_000;
const MIB = 1024 * 1024;

export class JobAbortError extends Error {
  constructor(kind, message) {
    super(message);
    this.name = 'JobAbortError';
    this.kind = kind;
  }
}

function abortError(signal) {
  return signal?.reason instanceof Error ? signal.reason : new JobAbortError('cancelled', 'Processing was stopped');
}

function parseRate(value) {
  const [numerator, denominator] = String(value || '').split('/').map(Number);
  if (numerator > 0 && denominator > 0) return numerator / denominator;
  const plain = Number(value);
  return plain > 0 ? plain : 0;
}

function toneMapChain() {
  return [
    'zscale=t=linear:npl=100',
    'format=gbrpf32le',
    'zscale=p=bt709',
    'tonemap=tonemap=hable:desat=0',
    'zscale=t=bt709:m=bt709:r=tv',
    'format=yuv420p',
  ];
}

/** What to do with a source, from its probe alone. Pure, so it is easy to test. */
export function planVideoDelivery(probe, { filters = new Set() } = {}) {
  const video = probe.streams?.find((stream) => stream.codec_type === 'video' && !stream.disposition?.attached_pic);
  if (!video) throw new Error('Source has no video stream');
  const audio = probe.streams?.find((stream) => stream.codec_type === 'audio');

  const width = Number(video.width) || 0;
  const height = Number(video.height) || 0;
  const shortEdge = Math.min(width, height);
  const sourceFps = parseRate(video.avg_frame_rate) || parseRate(video.r_frame_rate) || 30;
  const durationSeconds = Number(probe.format?.duration) || Number(video.duration) || 0;
  const transfer = String(video.color_transfer || '');
  const hdr = transfer === 'smpte2084' || transfer === 'arib-std-b67';
  const audioBps = Number(audio?.bit_rate) || 0;
  const videoBps = Number(video.bit_rate) || Math.max(0, (Number(probe.format?.bit_rate) || 0) - audioBps);
  const interlaced = ['tt', 'bb', 'tb', 'bt'].includes(String(video.field_order || ''));

  const copyVideo = video.codec_name === 'h264'
    && ['yuv420p', 'yuvj420p'].includes(String(video.pix_fmt))
    && shortEdge > 0 && shortEdge <= VIDEO_MAX_SHORT_EDGE
    && sourceFps > 0 && sourceFps <= VIDEO_MAX_FPS + 1
    && videoBps > 0 && videoBps <= COPY_MAX_VIDEO_BPS
    && !hdr
    && !interlaced;

  const outputFps = Math.min(sourceFps, VIDEO_MAX_FPS);
  const videoFilters = [];
  let toneMapped = false;
  if (!copyVideo) {
    // Drop frames before scaling so the scaler does half the work on 60 fps.
    if (sourceFps > VIDEO_MAX_FPS + 1) videoFilters.push(`fps=${VIDEO_MAX_FPS}`);
    if (shortEdge > VIDEO_MAX_SHORT_EDGE) {
      const edge = VIDEO_MAX_SHORT_EDGE;
      videoFilters.push(
        `scale=w='if(gte(iw,ih),-2,min(${edge},iw))':h='if(gte(iw,ih),min(${edge},ih),-2)':flags=bicubic`,
        'setsar=1',
      );
    }
    if (hdr && filters.has('zscale') && filters.has('tonemap')) {
      videoFilters.push(...toneMapChain());
      toneMapped = true;
    } else {
      videoFilters.push('format=yuv420p');
    }
  }

  const audioMode = !audio ? 'none' : audio.codec_name === 'aac' ? 'copy' : 'encode';
  const estimatedVideoBytes = Math.ceil(
    (copyVideo ? videoBps : Math.min(videoBps || VIDEO_MAXRATE_BPS, VIDEO_MAXRATE_BPS)) * durationSeconds / 8
      + (audioMode === 'none' ? 0 : (audioMode === 'copy' ? audioBps || 192_000 : 160_000) * durationSeconds / 8),
  );
  const estimatedAudioBytes = audioMode === 'none'
    ? 0
    : Math.ceil((audioMode === 'copy' ? audioBps || 256_000 : 192_000) * durationSeconds / 8 * 1.1 + MIB);

  return {
    copyVideo,
    videoFilters,
    toneMapped,
    audioMode,
    companionAudioMode: audioMode,
    durationSeconds,
    sourceFps,
    outputFps,
    gop: Math.max(24, Math.round(outputFps * 4)),
    width,
    height,
    hdr,
    estimatedVideoBytes,
    estimatedAudioBytes,
  };
}

/** The FFmpeg command line for one pass. Pure. */
export function buildVideoFfmpegArgs({ inputUrl, plan, threads, videoOutput, audioOnlyPath = null }) {
  const args = [
    '-nostdin', '-hide_banner', '-loglevel', 'error', '-nostats',
    '-progress', 'pipe:3', '-stats_period', '5',
    // Decoder threads must be set before the input, or FFmpeg starts one per
    // host core (dozens) and a 4K HEVC decode alone exhausts a small service.
    '-threads', String(threads),
    '-reconnect', '1', '-reconnect_on_network_error', '1', '-reconnect_delay_max', '30',
    '-rw_timeout', '120000000',
    '-i', inputUrl,
    '-filter_threads', String(Math.max(1, Math.min(threads, 4))),
  ];

  args.push('-map', '0:v:0');
  if (plan.audioMode !== 'none') args.push('-map', '0:a:0');
  // Phone originals carry GPS location and device details; delivery files don't.
  args.push('-map_metadata', '-1', '-map_chapters', '-1', '-sn', '-dn');
  if (plan.copyVideo) {
    args.push('-c:v', 'copy');
  } else {
    args.push(
      '-c:v', 'libx264', '-preset', VIDEO_PRESET, '-crf', String(VIDEO_CRF),
      '-maxrate', VIDEO_MAXRATE, '-bufsize', VIDEO_BUFSIZE,
      '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-g', String(plan.gop),
      '-threads', String(threads),
    );
    if (plan.videoFilters.length) args.push('-vf', plan.videoFilters.join(','));
    if (plan.toneMapped) args.push('-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709');
  }
  if (plan.audioMode === 'copy') args.push('-c:a', 'copy');
  if (plan.audioMode === 'encode') args.push('-c:a', 'aac', '-b:a', VIDEO_AUDIO_BITRATE, '-ac', '2');
  args.push('-max_muxing_queue_size', '4096');
  if (videoOutput.kind === 'pipe') {
    // Last resort only (no disk): a fragmented MP4 needs no seeking back.
    args.push('-movflags', '+frag_keyframe+empty_moov+default_base_moof', '-frag_duration', '4000000', '-f', 'mp4', 'pipe:1');
  } else {
    // An ordinary MP4 with its index at the end: every player seeks in it.
    args.push('-f', 'mp4', '-y', videoOutput.path);
  }

  if (audioOnlyPath && plan.companionAudioMode !== 'none') {
    args.push('-map', '0:a:0', '-vn', '-sn', '-dn', '-map_metadata', '-1', '-map_chapters', '-1');
    if (plan.companionAudioMode === 'copy') args.push('-c:a', 'copy');
    else args.push('-c:a', 'aac', '-b:a', AUDIO_ONLY_BITRATE);
    args.push('-movflags', '+faststart', '-max_muxing_queue_size', '4096', '-y', audioOnlyPath);
  }
  return args;
}

/** Reads FFmpeg's `-progress` key=value stream and reports the encoded time in seconds. */
export function trackProgress(readable, onSeconds) {
  let buffer = '';
  readable.setEncoding('utf8');
  readable.on('data', (chunk) => {
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const match = line.match(/^out_time_(?:us|ms)=(\d+)/);
      if (match) onSeconds(Number(match[1]) / 1_000_000);
    }
  });
}

async function sha256OfObject(client, bucket, key, signal) {
  const object = await sendWithRetry(client, () => new GetObjectCommand({ Bucket: bucket, Key: key }), 'Reading back the delivery file', { signal });
  const hash = createHash('sha256');
  for await (const chunk of object.Body) {
    if (signal?.aborted) throw abortError(signal);
    hash.update(chunk);
  }
  return hash.digest('hex');
}

function durationOf(probe) {
  return Number(probe.format?.duration) || 0;
}

function assertDuration(label, sourceSeconds, outputSeconds) {
  if (!sourceSeconds) return;
  const tolerance = Math.max(2, sourceSeconds * 0.01);
  if (outputSeconds + tolerance < sourceSeconds) {
    throw new Error(`${label} is ${outputSeconds.toFixed(1)}s long but the source is ${sourceSeconds.toFixed(1)}s; the conversion stopped early`);
  }
}

/**
 * Where the MP4 is written: whole on disk when it fits; on disk with each
 * uploaded part's blocks given back when the filesystem allows it; otherwise
 * streamed as a fragmented MP4.
 */
export async function chooseOutputMode(directory, plan, { wantsAudio }) {
  const free = await freeDiskBytes(directory);
  const reserve = 256 * MIB + (wantsAudio ? plan.estimatedAudioBytes : 0);
  if (free >= plan.estimatedVideoBytes * 1.25 + reserve) return 'file';
  if (free >= DELIVERY_PART_BYTES * 6 + reserve && await canPunchHoles(directory)) return 'file-freeing';
  return 'pipe';
}

/**
 * Converts one video. Returns the uploaded MP4 and, when asked for, the local
 * audio-only M4A (`audio.path`), which the caller uploads and completes.
 */
export async function convertVideo({
  client, job, wantsAudio, workDir, signal, onProgress = () => undefined, log = () => undefined,
  partBytes = DELIVERY_PART_BYTES, forceMode = process.env.MEDIA_VIDEO_OUTPUT_MODE || null,
}) {
  const head = await sendWithRetry(client, () => new HeadObjectCommand({ Bucket: job.input_bucket, Key: job.input_path }), 'Reading the original', { signal });
  const source = await openR2RangeServer(client, job.input_bucket, job.input_path, head);
  const jobDir = path.join(workDir, `coptic-vine-video-job-${job.job_id}`);
  const videoPath = path.join(jobDir, 'video.mp4');
  const audioPath = path.join(jobDir, 'audio.m4a');
  let uploader = null;
  let child = null;
  let videoStored = false;
  let pumpTimer = null;

  try {
    await mkdir(jobDir, { recursive: true });
    const inputProbe = await probeUrl(source.url);
    const plan = planVideoDelivery(inputProbe, { filters: await ffmpegFilters() });
    const resources = await containerResources();
    const { cpus, memoryBytes } = resources;
    const ffmpegThreads = threadsForAttempt(resources.ffmpegThreads, job.attempt_count);
    const makeAudio = wantsAudio && plan.companionAudioMode !== 'none';
    const mode = ['file', 'file-freeing', 'pipe'].includes(forceMode)
      ? forceMode
      : await chooseOutputMode(jobDir, plan, { wantsAudio: makeAudio });
    log({
      status: 'video_plan',
      jobId: job.job_id,
      mode,
      copyVideo: plan.copyVideo,
      filters: plan.videoFilters,
      audioMode: plan.audioMode,
      makeAudio,
      durationSeconds: plan.durationSeconds,
      sourceBytes: Number(head.ContentLength),
      threads: ffmpegThreads,
      attempt: job.attempt_count,
      cpus,
      cpuLimitKnown: resources.cpuLimitKnown,
      memoryMiB: Math.round(memoryBytes / MIB),
      memoryLimitKnown: resources.memoryLimitKnown,
    });

    const args = buildVideoFfmpegArgs({
      inputUrl: source.url,
      plan,
      threads: ffmpegThreads,
      videoOutput: mode === 'pipe' ? { kind: 'pipe' } : { kind: 'file', path: videoPath },
      audioOnlyPath: makeAudio ? audioPath : null,
    });

    if (mode !== 'pipe') {
      uploader = new GrowingFileUploader({
        client,
        bucket: job.output_bucket,
        key: job.output_path,
        filePath: videoPath,
        contentType: 'video/mp4',
        partBytes,
        freeUploadedBytes: mode === 'file-freeing',
        signal,
      });
      await uploader.start();
    }

    child = spawn(ffmpegPath, args, {
      shell: false,
      windowsHide: true,
      stdio: ['ignore', mode === 'pipe' ? 'pipe' : 'ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr = (stderr + chunk.toString()).slice(-32768); });
    trackProgress(child.stdio[3], (seconds) => {
      if (plan.durationSeconds > 0) onProgress(Math.min(0.95, seconds / plan.durationSeconds));
    });
    const closed = new Promise((resolve) => {
      child.once('error', (error) => resolve({ error }));
      child.once('close', (code, exitSignal) => resolve({ code, exitSignal }));
    });
    const kill = () => { if (child.exitCode === null) child.kill('SIGKILL'); };
    signal?.addEventListener('abort', kill, { once: true });

    // Settled into a value at once, so a failed upload can never surface as an
    // unhandled rejection while FFmpeg is still running.
    let streamed = null;
    if (mode === 'pipe') {
      streamed = streamToMultipart(child.stdout, {
        client, bucket: job.output_bucket, key: job.output_path, contentType: 'video/mp4', partBytes, signal,
      }).then(
        (uploaded) => ({ uploaded }),
        (error) => {
          kill();
          return { error };
        },
      );
    } else {
      pumpTimer = setInterval(() => {
        uploader.pump().catch(() => kill());
      }, 1000);
    }

    const result = await closed;
    clearInterval(pumpTimer);
    pumpTimer = null;
    signal?.removeEventListener('abort', kill);
    const streamOutcome = streamed ? await streamed : null;
    // A stream that ended because FFmpeg died may still have been stored.
    if (streamOutcome?.uploaded) videoStored = true;
    if (signal?.aborted) throw abortError(signal);
    if (result.error || result.code !== 0) {
      if (uploader?.failure) throw uploader.failure;
      if (streamOutcome?.error && !/empty media/.test(streamOutcome.error.message)) throw streamOutcome.error;
      if (result.error) throw new Error(`FFmpeg could not start: ${result.error.message}`);
      const detail = stderr.trim();
      throw new Error(`Video conversion failed: ${describeFfmpegExit(result.code, result.exitSignal)}${detail ? ` (${detail.slice(-1500)})` : ''}`);
    }

    let video;
    if (mode === 'pipe') {
      if (streamOutcome.error) throw streamOutcome.error;
      video = { sizeBytes: streamOutcome.uploaded.sizeBytes, sha256: streamOutcome.uploaded.sha256 };
    } else {
      const uploaded = await uploader.finish();
      videoStored = true;
      video = { sizeBytes: uploaded.sizeBytes, sha256: null };
    }
    onProgress(0.97);

    // Check what was actually stored, not what FFmpeg meant to write.
    const outputHead = await sendWithRetry(client, () => new HeadObjectCommand({ Bucket: job.output_bucket, Key: job.output_path }), 'Checking the delivery file', { signal });
    if (Number(outputHead.ContentLength) !== video.sizeBytes) {
      throw new Error('The stored delivery file size does not match what FFmpeg wrote');
    }
    const outputServer = await openR2RangeServer(client, job.output_bucket, job.output_path, outputHead);
    let outputProbe;
    try {
      outputProbe = await probeUrl(outputServer.url);
    } finally {
      await outputServer.close();
    }
    const outputVideo = outputProbe.streams?.find((stream) => stream.codec_type === 'video');
    if (outputVideo?.codec_name !== 'h264') throw new Error(`Delivery video codec is ${outputVideo?.codec_name || 'missing'}, expected h264`);
    if (!String(outputProbe.format?.format_name || '').includes('mp4')) throw new Error('Delivery file is not an MP4');
    assertDuration('The converted video', durationOf(inputProbe), durationOf(outputProbe));
    video.sha256 ??= await sha256OfObject(client, job.output_bucket, job.output_path, signal);

    let audio = null;
    if (wantsAudio && !makeAudio) {
      audio = { silent: true };
    } else if (makeAudio) {
      try {
        const audioProbe = await probeUrl(audioPath);
        const stream = audioProbe.streams?.find((entry) => entry.codec_type === 'audio');
        if (stream?.codec_name !== 'aac') throw new Error(`Audio-only codec is ${stream?.codec_name || 'missing'}, expected aac`);
        assertDuration('The audio-only copy', durationOf(inputProbe), durationOf(audioProbe));
        audio = {
          path: audioPath,
          probe: audioProbe,
          sizeBytes: (await stat(audioPath)).size,
          sha256: await sha256OfFile(audioPath),
          mode: plan.companionAudioMode,
        };
      } catch (error) {
        audio = { error };
      }
    }

    return {
      mode,
      plan,
      inputProbe,
      video: { ...video, probe: outputProbe },
      audio,
      jobDir,
      cleanup: async () => {
        if (process.env.MEDIA_KEEP_WORK_DIR !== '1') await rm(jobDir, { recursive: true, force: true }).catch(() => undefined);
      },
    };
  } catch (error) {
    if (pumpTimer) clearInterval(pumpTimer);
    if (child && child.exitCode === null) child.kill('SIGKILL');
    await uploader?.abort();
    if (videoStored) {
      await client.send(new DeleteObjectCommand({ Bucket: job.output_bucket, Key: job.output_path })).catch(() => undefined);
    }
    if (process.env.MEDIA_KEEP_WORK_DIR !== '1') await rm(jobDir, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  } finally {
    await source.close();
  }
}

export function videoTranscodeSummary(plan, mode) {
  return plan.copyVideo
    ? { videoCodec: 'h264', mode: 'stream_copy', audio: plan.audioMode, container: 'mp4', output: mode }
    : {
        videoCodec: 'h264',
        audioCodec: plan.audioMode === 'none' ? null : 'aac',
        preset: VIDEO_PRESET,
        crf: VIDEO_CRF,
        maxrate: VIDEO_MAXRATE,
        maxShortEdge: VIDEO_MAX_SHORT_EDGE,
        maxFps: VIDEO_MAX_FPS,
        toneMapped: plan.toneMapped,
        container: mode === 'pipe' ? 'fragmented_mp4' : 'mp4',
        output: mode,
      };
}
