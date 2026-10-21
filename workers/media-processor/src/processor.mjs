import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rm, stat } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { maybeRunStreamedMediaJob, NoAudioTrackError } from './streamed-media.mjs';
import { convertVideo, JobAbortError, videoTranscodeSummary } from './video-delivery.mjs';
import { containerResources } from './runtime.mjs';
import ffmpegPath from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import { AbortMultipartUploadCommand, CompleteMultipartUploadCommand, CreateMultipartUploadCommand, DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client, UploadPartCommand } from '@aws-sdk/client-s3';

const AUDIO_OUTPUT_MIME_TYPE = 'audio/mp4';
const AUDIO_BITRATE = '256k';
const VIDEO_OUTPUT_MIME_TYPE = 'video/mp4';
const VIDEO_AUDIO_BITRATE = '160k';
const VIDEO_CRF = '23';
const VIDEO_MAX_HEIGHT = 1080;
const IMAGE_OUTPUT_MIME_TYPE = 'image/jpeg';
const IMAGE_MAX_EDGE = 3000;
const IMAGE_QUALITY = '3';

const IMAGE_SCALE_FILTER =
  `scale=w='if(gt(iw,ih),min(${IMAGE_MAX_EDGE},iw),-2)':`
  + `h='if(gt(iw,ih),-2,min(${IMAGE_MAX_EDGE},ih))':flags=lanczos,setsar=1`;

// The old image pipeline created a full-resolution white frame *before*
// downscaling. Large PNG cover art could therefore hold two enormous decoded
// frames at once and get the Railway process SIGKILLed. Scale the source first,
// and only allocate a white background at the already-capped delivery size.
const IMAGE_ALPHA_FILTER_COMPLEX = [
  // Scale once, then split the *same-sized* frame. One copy becomes a solid
  // white canvas and the other keeps the original alpha. This avoids the old
  // scale2ref bug that shrank RGBA artwork/profile photos to the 16x16 seed
  // background and produced an effectively white thumbnail.
  `[0:v]${IMAGE_SCALE_FILTER},format=rgba,split=2[bg][fg]`,
  '[bg]drawbox=color=white@1:t=fill[white]',
  '[white][fg]overlay=format=auto:shortest=1,format=yuvj420p',
].join(';');

function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }

  return value;
}

export function getConfig() {
  const r2Driver = process.env.R2_DRIVER || 'wrangler';

  // Validate storage access before the worker ever claims a job. A missing R2
  // credential is an infrastructure problem, not a media-file failure; letting
  // the worker claim jobs first would burn their retry attempts one by one.
  if (r2Driver === 's3') {
    requireEnv('R2_ACCOUNT_ID');
    requireEnv('R2_ACCESS_KEY_ID');
    requireEnv('R2_SECRET_ACCESS_KEY');
  }

  return {
    apiUrl: requireEnv('API_URL').replace(/\/+$/, ''),
    mediaWorkerToken: requireEnv('MEDIA_WORKER_TOKEN'),
    mediaWorkerId: process.env.MEDIA_WORKER_ID || `media-processor-${process.pid}`,
    r2Driver,
    workDir: process.env.MEDIA_WORK_DIR || tmpdir(),
  };
}

export async function callRpc(config, name, payload) {
  const headers = {
    'accept-profile': 'public',
    'content-profile': 'public',
    'content-type': 'application/json',
  };

  const response = await fetch(`${config.apiUrl}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const bodyText = await response.text();
  const body = bodyText ? JSON.parse(bodyText) : null;

  if (!response.ok) {
    const message = body?.message || bodyText || `${name} failed`;
    throw new Error(`cv-api RPC ${name} failed with ${response.status}: ${message}`);
  }

  return Array.isArray(body) ? body : [];
}

function spawnChecked(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      shell: false,
      windowsHide: true,
      ...options,
    });
    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`${command} exited ${code}: ${stderr || stdout}`));
      }
    });
  });
}

function getWranglerCommand() {
  if (process.env.WRANGLER_COMMAND) {
    return {
      command: process.env.WRANGLER_COMMAND,
      prefix: [],
    };
  }

  return process.platform === 'win32'
    ? { command: 'cmd.exe', prefix: ['/d', '/s', '/c', 'npx.cmd', 'wrangler'] }
    : { command: 'npx', prefix: ['wrangler'] };
}

let s3ClientFactory = null;
/** Tests stand a fake R2 in for the real one. */
export function setS3ClientFactoryForTests(factory) {
  s3ClientFactory = factory;
}

export function getS3Client() {
  if (s3ClientFactory) return s3ClientFactory();
  const accountId = requireEnv('R2_ACCOUNT_ID');

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
    },
  });
}

export async function downloadObject(config, bucket, key, destinationPath, s3Client = null) {
  if (config.r2Driver === 's3') {
    const client = s3Client || getS3Client();
    const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!response.Body) throw new Error(`R2 returned no body for ${bucket}/${key}`);
    // Stream the download onto scratch disk. Buffering a multi-GB original in
    // Node's heap killed the 1 GB Railway worker at the start of every job.
    await pipeline(response.Body, createWriteStream(destinationPath));
    return;
  }

  const wrangler = getWranglerCommand();
  await spawnChecked(wrangler.command, [
    ...wrangler.prefix,
    'r2',
    'object',
    'get',
    `${bucket}/${key}`,
    '--remote',
    '--file',
    destinationPath,
  ]);
}

// AWS S3-compatible single PUT is capped at 5 GB and large Node streams
// cannot fit into the worker heap. Use bounded R2 multipart transfers.
const DELIVERY_MULTIPART_THRESHOLD = 100 * 1024 * 1024;
const DELIVERY_PART_BYTES = 64 * 1024 * 1024;

export async function multipartUploadObject(client, bucket, key, sourcePath, sourceSize, contentType) {
  const created = await client.send(new CreateMultipartUploadCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  }));
  if (!created.UploadId) throw new Error('R2 did not return a delivery multipart upload ID');

  try {
    const partSize = Math.max(DELIVERY_PART_BYTES, Math.ceil(sourceSize / 9500));
    const count = Math.ceil(sourceSize / partSize);
    const parts = [];
    // A single bounded 64 MB part in flight keeps peak memory low on a
    // 1 GB processor even when a several-hour lesson is more than 5 GB.
    for (let partNumber = 1; partNumber <= count; partNumber += 1) {
      const start = (partNumber - 1) * partSize;
      const end = Math.min(start + partSize, sourceSize) - 1;
      const response = await client.send(new UploadPartCommand({
        Bucket: bucket,
        Key: key,
        UploadId: created.UploadId,
        PartNumber: partNumber,
        Body: createReadStream(sourcePath, { start, end }),
        ContentLength: end - start + 1,
      }));
      if (!response.ETag) throw new Error(`R2 did not return an ETag for delivery part ${partNumber}`);
      parts.push({ PartNumber: partNumber, ETag: response.ETag });
    }
    await client.send(new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: created.UploadId,
      MultipartUpload: { Parts: parts },
    }));
  } catch (error) {
    await client.send(new AbortMultipartUploadCommand({
      Bucket: bucket, Key: key, UploadId: created.UploadId,
    })).catch(() => undefined);
    throw error;
  }
}

async function uploadObject(config, bucket, key, sourcePath, contentType) {
  if (config.r2Driver === 's3') {
    const client = getS3Client();
    const file = await stat(sourcePath);
    if (file.size >= DELIVERY_MULTIPART_THRESHOLD) {
      await multipartUploadObject(client, bucket, key, sourcePath, file.size, contentType);
    } else {
      await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: createReadStream(sourcePath),
        ContentLength: file.size,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }));
    }
    return;
  }

  const wrangler = getWranglerCommand();
  await spawnChecked(wrangler.command, [
    ...wrangler.prefix,
    'r2',
    'object',
    'put',
    `${bucket}/${key}`,
    '--remote',
    '--file',
    sourcePath,
    '--content-type',
    contentType,
    '--cache-control',
    'public, max-age=31536000, immutable',
  ]);
}

export async function deleteObject(config, bucket, key) {
  if (config.r2Driver === 's3') {
    const client = getS3Client();
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    return;
  }

  const wrangler = getWranglerCommand();
  await spawnChecked(wrangler.command, [
    ...wrangler.prefix,
    'r2',
    'object',
    'delete',
    `${bucket}/${key}`,
    '--remote',
  ]);
}

export async function listStorageObjects(config, bucket) {
  if (config.r2Driver !== 's3') {
    // The production Railway worker uses the S3-compatible R2 API. Local
    // Wrangler mode intentionally skips full-bucket inventory rather than
    // making a destructive GC pass with an incomplete view of storage.
    return [];
  }

  const client = getS3Client();
  const objects = [];
  let continuationToken;

  do {
    const page = await client.send(new ListObjectsV2Command({
      Bucket: bucket,
      ContinuationToken: continuationToken,
      MaxKeys: 1000,
    }));

    for (const object of page.Contents || []) {
      if (!object.Key) continue;
      objects.push({
        bucket,
        path: object.Key,
        file_size_bytes: Number(object.Size || 0),
        last_modified_at: object.LastModified?.toISOString?.() ?? null,
      });
    }

    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuationToken);

  return objects;
}

export async function sha256File(filePath) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

async function probeMedia(filePath) {
  const { stdout } = await spawnChecked(ffprobeStatic.path, [
    '-v',
    'error',
    '-show_format',
    '-show_streams',
    '-print_format',
    'json',
    filePath,
  ]);

  return JSON.parse(stdout);
}

function assertAudioInput(probe) {
  const audioStream = probe.streams?.find((stream) => stream.codec_type === 'audio');

  if (!audioStream) {
    throw new Error('Input media has no audio stream');
  }
}

function assertM4aOutput(probe) {
  const audioStream = probe.streams?.find((stream) => stream.codec_type === 'audio');
  const formatName = String(probe.format?.format_name || '');

  if (!audioStream) {
    throw new Error('Output media has no audio stream');
  }

  if (audioStream.codec_name !== 'aac') {
    throw new Error(`Output audio codec is ${audioStream.codec_name}, expected aac`);
  }

  if (!formatName.includes('mp4') && !formatName.includes('m4a')) {
    throw new Error(`Output format is ${formatName}, expected mp4/m4a`);
  }
}

function assertVideoInput(probe) {
  const videoStream = probe.streams?.find((stream) => stream.codec_type === 'video');

  if (!videoStream) {
    throw new Error('Input media has no video stream');
  }
}

function assertMp4Output(probe) {
  const videoStream = probe.streams?.find((stream) => stream.codec_type === 'video');
  const formatName = String(probe.format?.format_name || '');

  if (!videoStream) {
    throw new Error('Output media has no video stream');
  }

  if (videoStream.codec_name !== 'h264') {
    throw new Error(`Output video codec is ${videoStream.codec_name}, expected h264`);
  }

  if (!formatName.includes('mp4')) {
    throw new Error(`Output format is ${formatName}, expected mp4`);
  }
}

function assertImageInput(probe) {
  const videoStream = probe.streams?.find((stream) => stream.codec_type === 'video');

  if (!videoStream) {
    throw new Error('Input media has no image stream');
  }

  if (!videoStream.width || !videoStream.height) {
    throw new Error('Input image has no readable dimensions');
  }
}

function assertJpegOutput(probe) {
  const videoStream = probe.streams?.find((stream) => stream.codec_type === 'video');

  if (!videoStream) {
    throw new Error('Output image has no image stream');
  }

  if (videoStream.codec_name !== 'mjpeg') {
    throw new Error(`Output image codec is ${videoStream.codec_name}, expected mjpeg`);
  }

  if (Math.max(videoStream.width || 0, videoStream.height || 0) > IMAGE_MAX_EDGE) {
    throw new Error(`Output image is larger than ${IMAGE_MAX_EDGE}px on its longest edge`);
  }
}

async function transcodeToM4a(inputPath, outputPath) {
  await spawnChecked(ffmpegPath, [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-i',
    inputPath,
    '-vn',
    '-c:a',
    'aac',
    '-b:a',
    AUDIO_BITRATE,
    '-movflags',
    '+faststart',
    outputPath,
  ]);
}

async function remuxAacToM4a(inputPath, outputPath) {
  await spawnChecked(ffmpegPath, [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-i',
    inputPath,
    '-vn',
    '-c:a',
    'copy',
    '-movflags',
    '+faststart',
    outputPath,
  ]);
}

async function transcodeToMp4(inputPath, outputPath) {
  const { ffmpegThreads: threads } = await containerResources();
  await spawnChecked(ffmpegPath, [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-threads',
    String(threads),
    '-i',
    inputPath,
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-threads',
    String(threads),
    '-crf',
    VIDEO_CRF,
    '-maxrate',
    '6M',
    '-bufsize',
    '12M',
    '-profile:v',
    'high',
    '-pix_fmt',
    'yuv420p',
    // Cap the short edge at 1080 without ever upscaling a smaller source.
    '-vf',
    `scale=w='if(gte(iw,ih),-2,min(${VIDEO_MAX_HEIGHT},iw))':h='if(gte(iw,ih),min(${VIDEO_MAX_HEIGHT},ih),-2)':flags=bicubic,setsar=1`,
    '-c:a',
    'aac',
    '-b:a',
    VIDEO_AUDIO_BITRATE,
    '-movflags',
    '+faststart',
    outputPath,
  ]);
}

async function renderDeliveryJpeg(inputPath, outputPath, hasAlpha) {
  const filterArgs = hasAlpha
    ? ['-filter_complex', IMAGE_ALPHA_FILTER_COMPLEX]
    : ['-vf', `${IMAGE_SCALE_FILTER},format=yuvj420p`];

  await spawnChecked(ffmpegPath, [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    // Keep still-image decoding/filtering memory predictable on the 1 GB
    // Railway worker. Audio/video encodes retain their normal threading.
    '-threads',
    '1',
    '-i',
    inputPath,
    ...filterArgs,
    '-frames:v',
    '1',
    '-q:v',
    IMAGE_QUALITY,
    outputPath,
  ]);
}

function sourceExtension(inputPath) {
  const extension = path.extname(inputPath || '');
  return extension && /^[.a-z0-9]+$/i.test(extension) ? extension : '.source';
}

export async function handleAudioDelivery(inputPath, jobDir) {
  const outputPath = path.join(jobDir, 'audio.m4a');
  const inputProbe = await probeMedia(inputPath);

  assertAudioInput(inputProbe);
  const inputAudio = inputProbe.streams?.find((stream) => stream.codec_type === 'audio');
  const canStreamCopy = inputAudio?.codec_name === 'aac';

  // Coptic Vine Artists commonly uploads M4A/AAC. Re-encoding that audio wastes time
  // and quality for no benefit, so compatible AAC is only remuxed with
  // +faststart. This is normally several times faster than real-time.
  if (canStreamCopy) {
    await remuxAacToM4a(inputPath, outputPath);
  } else {
    await transcodeToM4a(inputPath, outputPath);
  }

  const outputProbe = await probeMedia(outputPath);
  assertM4aOutput(outputProbe);

  return {
    outputPath,
    mimeType: AUDIO_OUTPUT_MIME_TYPE,
    probe: {
      input: inputProbe,
      output: outputProbe,
      transcode: canStreamCopy
        ? {
            audioCodec: 'aac',
            mode: 'stream_copy',
            container: 'm4a',
          }
        : {
            audioCodec: 'aac',
            mode: 'encode',
            targetBitrate: AUDIO_BITRATE,
            container: 'm4a',
          },
    },
  };
}

export async function handleVideoDelivery(inputPath, jobDir) {
  const outputPath = path.join(jobDir, 'video.mp4');
  const inputProbe = await probeMedia(inputPath);

  assertVideoInput(inputProbe);
  await transcodeToMp4(inputPath, outputPath);

  const outputProbe = await probeMedia(outputPath);
  assertMp4Output(outputProbe);

  return {
    outputPath,
    mimeType: VIDEO_OUTPUT_MIME_TYPE,
    probe: {
      input: inputProbe,
      output: outputProbe,
      transcode: {
        videoCodec: 'h264',
        audioCodec: 'aac',
        crf: Number(VIDEO_CRF),
        maxHeight: VIDEO_MAX_HEIGHT,
        container: 'mp4',
      },
    },
  };
}

export async function handleImageDelivery(inputPath, jobDir) {
  const outputPath = path.join(jobDir, 'cover.jpg');
  const inputProbe = await probeMedia(inputPath);

  assertImageInput(inputProbe);
  const inputImage = inputProbe.streams?.find((stream) => stream.codec_type === 'video');
  const pixelFormat = String(inputImage?.pix_fmt || '').toLowerCase();
  const hasAlpha = pixelFormat.includes('a') || pixelFormat === 'pal8';
  await renderDeliveryJpeg(inputPath, outputPath, hasAlpha);

  const outputProbe = await probeMedia(outputPath);
  assertJpegOutput(outputProbe);

  const outputStream = outputProbe.streams?.find((stream) => stream.codec_type === 'video');

  return {
    outputPath,
    mimeType: IMAGE_OUTPUT_MIME_TYPE,
    probe: {
      input: inputProbe,
      output: outputProbe,
      transcode: {
        imageCodec: 'mjpeg',
        maxEdge: IMAGE_MAX_EDGE,
        quality: Number(IMAGE_QUALITY),
        container: 'jpeg',
        width: outputStream?.width ?? null,
        height: outputStream?.height ?? null,
      },
    },
  };
}

const JOB_HANDLERS = {
  audio_delivery: handleAudioDelivery,
  video_delivery: handleVideoDelivery,
  image_delivery: handleImageDelivery,
};

export function isSupportedJobType(jobType) {
  return Object.hasOwn(JOB_HANDLERS, jobType);
}

// ---------------------------------------------------------------------------
// Job lifecycle helpers. The RPCs below arrived with the heartbeat migration;
// a worker deployed before that migration simply runs without them.
// ---------------------------------------------------------------------------

function isMissingRpc(error) {
  const message = error instanceof Error ? error.message : String(error);
  return /failed with 404|PGRST202|Could not find the function/i.test(message);
}

async function rpcIfAvailable(config, name, payload) {
  try {
    return await callRpc(config, name, payload);
  } catch (error) {
    if (isMissingRpc(error)) return null;
    throw error;
  }
}

const activeControls = new Set();

/** How many jobs this worker is processing right now. */
export function activeJobCount() {
  return activeControls.size;
}

/** Stops the job in flight: `shutdown` hands it back to the queue, `cancelled` just stops. */
export function abortActiveJobs(kind = 'shutdown') {
  for (const control of activeControls) {
    if (!control.signal.aborted) {
      control.abort(new JobAbortError(kind, kind === 'shutdown' ? 'The media worker is shutting down' : 'Processing was stopped'));
    }
  }
}

const HEARTBEAT_MS = Number(process.env.MEDIA_HEARTBEAT_MS || 20_000);

/**
 * Proves to cv-api, every 20 seconds, that this worker is still working on
 * its jobs (so a dead worker's job is retried within minutes), reports
 * progress, and stops the work if an admin cancelled or deleted it.
 */
function startLease(config, control, jobIds) {
  const ids = new Set(jobIds);
  let progress = 0;
  let supported = true;
  let stopped = false;

  const beat = async () => {
    if (stopped || !supported || !ids.size) return;
    const watched = [...ids];
    try {
      const rows = await rpcIfAvailable(config, 'heartbeat_media_processing_jobs', {
        p_worker_token: config.mediaWorkerToken,
        p_job_ids: watched,
        p_progress: Math.round(progress * 1000) / 1000,
      });
      if (rows === null) {
        supported = false;
        return;
      }
      if (stopped) return;
      const live = new Set(rows.filter((row) => row.status === 'processing').map((row) => row.job_id));
      const lost = watched.filter((id) => ids.has(id) && !live.has(id));
      if (lost.length && !control.signal.aborted) {
        control.abort(new JobAbortError('cancelled', 'The job was cancelled or deleted while it was processing'));
      }
    } catch {
      // A missed heartbeat is harmless; five minutes of them would be noticed.
    }
  };

  void beat();
  const timer = setInterval(() => void beat(), HEARTBEAT_MS);
  return {
    setProgress(value) {
      progress = value;
    },
    drop(id) {
      ids.delete(id);
    },
    stop() {
      stopped = true;
      clearInterval(timer);
    },
  };
}

/**
 * Removes a video's original once its MP4 and audio-only copy both exist.
 * Never fails the job: storage GC removes an original whose deletion failed.
 */
async function deleteOriginalIfDone(config, uploadIntentId) {
  if (config.r2Driver !== 's3' || !uploadIntentId) return null;
  try {
    const rows = await rpcIfAvailable(config, 'claim_media_original_deletion', {
      p_worker_token: config.mediaWorkerToken,
      p_upload_intent_id: uploadIntentId,
    });
    const target = rows?.[0];
    if (!target?.bucket || !target?.path) return null;
    const client = getS3Client();
    let lastError = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await client.send(new DeleteObjectCommand({ Bucket: target.bucket, Key: target.path }));
        return { deleted: true, bucket: target.bucket, path: target.path };
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
      }
    }
    return { deleted: false, error: lastError instanceof Error ? lastError.message : String(lastError) };
  } catch (error) {
    return { deleted: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function completeJob(config, jobId, output) {
  const rows = await callRpc(config, 'complete_media_processing_job', {
    p_worker_token: config.mediaWorkerToken,
    p_job_id: jobId,
    p_output_mime_type: output.mimeType,
    p_output_size_bytes: output.sizeBytes,
    p_output_checksum_sha256: output.sha256,
    p_probe: output.probe,
  });
  return rows[0] ?? null;
}

async function skipSilentAudioJob(config, jobId, reason) {
  const rows = await rpcIfAvailable(config, 'skip_media_processing_job', {
    p_worker_token: config.mediaWorkerToken,
    p_job_id: jobId,
    p_reason: reason,
  });
  return rows !== null;
}

async function claimCompanion(config, job) {
  try {
    const rows = await rpcIfAvailable(config, 'claim_companion_media_processing_job', {
      p_worker_token: config.mediaWorkerToken,
      p_job_id: job.job_id,
      p_worker_id: config.mediaWorkerId,
    });
    return rows?.[0] ?? null;
  } catch {
    // Without its companion the video still converts; the audio-only job then
    // runs on its own afterwards, as it did before.
    return null;
  }
}

/**
 * A video job, and its audio-only companion, in one FFmpeg pass. The MP4 is
 * uploaded while it is encoded; the original is removed once both exist.
 */
async function runVideoJob(config, job, control) {
  const client = getS3Client();
  const companion = await claimCompanion(config, job);
  if (companion) control.jobIds.push(companion.job_id);
  const lease = startLease(config, control, control.jobIds);
  let companionSettled = !companion;
  let conversion = null;

  try {
    conversion = await convertVideo({
      client,
      job,
      wantsAudio: Boolean(companion),
      workDir: config.workDir,
      signal: control.signal,
      onProgress: (value) => lease.setProgress(value),
      log: (entry) => console.log(JSON.stringify({ at: new Date().toISOString(), ...entry })),
    });
    lease.stop();

    let audioOnly = null;
    if (companion) {
      const audio = conversion.audio;
      if (audio?.silent) {
        const skipped = await skipSilentAudioJob(config, companion.job_id, 'the video has no sound, so there is no audio-only version');
        if (!skipped) await reportFailure(config, { ...companion, upload_intent_id: job.upload_intent_id }, new NoAudioTrackError('Cannot extract audio: the source has no audio stream'));
        audioOnly = { status: skipped ? 'skipped_silent' : 'failed' };
      } else if (audio?.error || !audio?.path) {
        await reportFailure(config, { ...companion, upload_intent_id: job.upload_intent_id }, audio?.error || new Error('The audio-only copy was not produced'));
        audioOnly = { status: 'failed', error: audio?.error?.message };
      } else {
        try {
          await uploadObject(config, companion.output_bucket, companion.output_path, audio.path, AUDIO_OUTPUT_MIME_TYPE);
          try {
            await completeJob(config, companion.job_id, {
              mimeType: AUDIO_OUTPUT_MIME_TYPE,
              sizeBytes: audio.sizeBytes,
              sha256: audio.sha256,
              probe: {
                input: conversion.inputProbe,
                output: audio.probe,
                transcode: {
                  audioCodec: 'aac',
                  container: 'm4a',
                  mode: audio.mode === 'copy' ? 'stream_copy' : 'encode',
                  madeWith: 'video_pass',
                },
              },
            });
          } catch (error) {
            await deleteObject(config, companion.output_bucket, companion.output_path).catch(() => undefined);
            throw error;
          }
          audioOnly = { status: 'completed', outputSizeBytes: audio.sizeBytes };
        } catch (error) {
          await reportFailure(config, { ...companion, upload_intent_id: job.upload_intent_id }, error);
          audioOnly = { status: 'failed', error: error instanceof Error ? error.message : String(error) };
        }
      }
      companionSettled = true;
    }

    let completion;
    try {
      completion = await completeJob(config, job.job_id, {
        mimeType: VIDEO_OUTPUT_MIME_TYPE,
        sizeBytes: conversion.video.sizeBytes,
        sha256: conversion.video.sha256,
        probe: {
          input: conversion.inputProbe,
          output: conversion.video.probe,
          transcode: videoTranscodeSummary(conversion.plan, conversion.mode),
        },
      });
    } catch (error) {
      // An admin deleted the file while it was finishing: leave nothing behind.
      await deleteObject(config, job.output_bucket, job.output_path).catch(() => undefined);
      throw error;
    }

    const original = await deleteOriginalIfDone(config, job.upload_intent_id);
    return {
      status: 'completed',
      jobId: job.job_id,
      jobType: job.job_type,
      uploadIntentId: job.upload_intent_id,
      outputBucket: job.output_bucket,
      outputPath: job.output_path,
      outputMimeType: VIDEO_OUTPUT_MIME_TYPE,
      outputSizeBytes: conversion.video.sizeBytes,
      outputChecksumSha256: conversion.video.sha256,
      outputMode: conversion.mode,
      copiedVideo: conversion.plan.copyVideo,
      audioOnly,
      originalDeleted: original?.deleted ?? false,
      completion,
    };
  } catch (error) {
    if (companion && !companionSettled && !(error instanceof JobAbortError)) {
      await reportFailure(config, { ...companion, upload_intent_id: job.upload_intent_id }, error);
      control.jobIds = control.jobIds.filter((id) => id !== companion.job_id);
    }
    throw error;
  } finally {
    lease.stop();
    await conversion?.cleanup();
  }
}

async function runJob(config, job, control) {
  const handler = JOB_HANDLERS[job.job_type];

  if (!handler) {
    throw new Error(`No handler for job type ${job.job_type}`);
  }

  if (job.job_type === 'video_delivery' && config.r2Driver === 's3') {
    return runVideoJob(config, job, control);
  }

  const lease = startLease(config, control, control.jobIds);
  try {
    let result;
    try {
      // R2 HTTP Range input bypasses the Railway scratch-disk limit for long
      // recordings and for a video's audio-only copy made on its own.
      result = await maybeRunStreamedMediaJob(config, job, {
        getS3Client,
        callRpc,
        deleteObject,
        uploadFile: (bucket, key, filePath, contentType) => uploadObject(config, bucket, key, filePath, contentType),
        signal: control.signal,
      });
    } catch (error) {
      if (error instanceof NoAudioTrackError && job.job_type === 'audio_delivery' && job.media_type === 'video') {
        if (await skipSilentAudioJob(config, job.job_id, 'the video has no sound, so there is no audio-only version')) {
          await deleteOriginalIfDone(config, job.upload_intent_id);
          return { status: 'skipped_silent', jobId: job.job_id, jobType: job.job_type, uploadIntentId: job.upload_intent_id };
        }
      }
      throw error;
    }
    result ??= await runDownloadedJob(config, job, handler);
    if (job.media_type === 'video') {
      result.originalDeleted = (await deleteOriginalIfDone(config, job.upload_intent_id))?.deleted ?? false;
    }
    return result;
  } finally {
    lease.stop();
  }
}

async function runDownloadedJob(config, job, handler) {
  const jobDir = path.join(config.workDir, `coptic-vine-media-job-${job.job_id}`);
  const inputPath = path.join(jobDir, `input${sourceExtension(job.input_path)}`);

  try {
    await mkdir(jobDir, { recursive: true });
    await downloadObject(config, job.input_bucket, job.input_path, inputPath);

    const result = await handler(inputPath, jobDir);
    const outputStat = await stat(result.outputPath);
    const outputChecksum = await sha256File(result.outputPath);

    await uploadObject(
      config,
      job.output_bucket,
      job.output_path,
      result.outputPath,
      result.mimeType,
    );

    let completedRows;
    try {
      completedRows = await callRpc(config, 'complete_media_processing_job', {
        p_worker_token: config.mediaWorkerToken,
        p_job_id: job.job_id,
        p_output_mime_type: result.mimeType,
        p_output_size_bytes: outputStat.size,
        p_output_checksum_sha256: outputChecksum,
        p_probe: result.probe,
      });
    } catch (error) {
      // If an admin permanently deletes a file while a worker is finishing it,
      // completion is rejected because the job has been cancelled/deleted.
      // Remove the just-uploaded delivery object so the race cannot leave an
      // orphaned R2 file behind.
      await deleteObject(config, job.output_bucket, job.output_path).catch(() => undefined);
      throw error;
    }

    return {
      status: 'completed',
      jobId: job.job_id,
      jobType: job.job_type,
      uploadIntentId: job.upload_intent_id,
      outputBucket: job.output_bucket,
      outputPath: job.output_path,
      outputMimeType: result.mimeType,
      outputSizeBytes: outputStat.size,
      outputChecksumSha256: outputChecksum,
      completion: completedRows[0] ?? null,
    };
  } finally {
    if (process.env.MEDIA_KEEP_WORK_DIR !== '1') {
      await rm(jobDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}

async function reportFailure(config, job, error) {
  const message = error instanceof Error ? error.message : String(error);

  try {
    const failedRows = await callRpc(config, 'fail_media_processing_job', {
      p_worker_token: config.mediaWorkerToken,
      p_job_id: job.job_id,
      p_error_message: message,
    });
    const failure = failedRows[0] ?? null;

    return {
      status: 'failed',
      jobId: job.job_id,
      jobType: job.job_type,
      uploadIntentId: job.upload_intent_id,
      error: message,
      // `queued` here means the job will be retried after its backoff window;
      // `failed` means it ran out of attempts and nothing will pick it up again.
      jobStatus: failure?.status ?? null,
      attemptCount: failure?.attempt_count ?? job.attempt_count ?? null,
      maxAttempts: failure?.max_attempts ?? job.max_attempts ?? null,
      retryAt: failure?.available_at ?? null,
      willRetry: failure ? failure.status === 'queued' : null,
    };
  } catch (failError) {
    return {
      status: 'fail_report_error',
      jobId: job.job_id,
      jobType: job.job_type,
      error: message,
      reportError: failError instanceof Error ? failError.message : String(failError),
    };
  }
}

/** Hands jobs a stopping worker was holding straight back to the queue. */
async function releaseJobs(config, jobIds, reason) {
  try {
    const released = await rpcIfAvailable(config, 'release_media_processing_jobs', {
      p_worker_token: config.mediaWorkerToken,
      p_job_ids: jobIds,
      p_reason: reason,
    });
    return released !== null;
  } catch {
    return false;
  }
}

/**
 * Claims one queued job and processes it.
 *
 * Returns `{ status: 'no_job' }` when the queue is empty, and never throws for a
 * job-level failure: the failure is reported back to cv-api (which decides
 * whether to retry with backoff or mark the job failed) and returned to the
 * caller so a long-running worker keeps going.
 */
export async function claimAndProcessOne(config) {
  const claimedRows = await callRpc(config, 'claim_media_processing_job', {
    p_worker_token: config.mediaWorkerToken,
    p_worker_id: config.mediaWorkerId,
  });
  const job = claimedRows[0];

  if (!job) {
    return { status: 'no_job' };
  }

  if (!isSupportedJobType(job.job_type)) {
    return reportFailure(config, job, new Error(`Unsupported job type ${job.job_type}`));
  }

  const control = new AbortController();
  control.jobIds = [job.job_id];
  activeControls.add(control);
  try {
    return await runJob(config, job, control);
  } catch (error) {
    const reason = control.signal.aborted ? control.signal.reason : error;
    if (reason instanceof JobAbortError && reason.kind === 'shutdown') {
      const released = await releaseJobs(config, control.jobIds, 'Released by a media worker that was shutting down');
      if (released) return { status: 'released', jobId: job.job_id, jobType: job.job_type, jobIds: control.jobIds };
      return reportFailure(config, job, reason);
    }
    if (reason instanceof JobAbortError && reason.kind === 'cancelled') {
      return { status: 'cancelled', jobId: job.job_id, jobType: job.job_type };
    }
    return reportFailure(config, job, error);
  } finally {
    activeControls.delete(control);
  }
}
