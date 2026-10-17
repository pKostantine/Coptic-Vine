import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, rm, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import ffmpegPath from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';

// Sources at least this big are read straight from R2 instead of being
// downloaded first: the Railway processor's scratch disk is small.
export const STREAMING_THRESHOLD_BYTES = 256 * 1024 * 1024;

// Each R2 read covers at most this much of the original. A single read of a
// multi-GB file held one connection open for the whole encode; when R2 or the
// network dropped it, FFmpeg lost its input and the job failed. Short reads
// are retried on their own, invisibly to FFmpeg.
export const RANGE_WINDOW_BYTES = 16 * 1024 * 1024;
const RANGE_READ_ATTEMPTS = 6;

export class NoAudioTrackError extends Error {
  constructor(message = 'The source has no audio track') {
    super(message);
    this.name = 'NoAudioTrackError';
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function imageExtension(key) {
  const extension = String(key || '').match(/\.[a-z0-9]{1,8}$/i)?.[0];
  return extension || '.mp4';
}

function waitForDrainOrClose(res) {
  return new Promise((resolve) => {
    const done = () => {
      res.off('drain', done);
      res.off('close', done);
      resolve();
    };
    res.on('drain', done);
    res.on('close', done);
  });
}

/** Writes bytes first..last of an R2 object to `res`, in short, retried reads. */
async function pipeObjectRange(client, bucket, key, res, first, last, windowBytes) {
  let offset = first;
  while (offset <= last) {
    const end = Math.min(last, offset + windowBytes - 1);
    let attempt = 0;
    while (offset <= end) {
      if (res.destroyed) return;
      let body = null;
      try {
        const object = await client.send(new GetObjectCommand({
          Bucket: bucket,
          Key: key,
          Range: `bytes=${offset}-${end}`,
        }));
        body = object.Body;
        if (!body) throw new Error('R2 returned an empty media object body');
        for await (const chunk of body) {
          if (res.destroyed) return;
          const room = end - offset + 1;
          const usable = chunk.length > room ? chunk.subarray(0, room) : chunk;
          offset += usable.length;
          if (!res.write(usable)) await waitForDrainOrClose(res);
          if (offset > end) break;
        }
        if (offset <= end) throw new Error(`R2 range read ended at byte ${offset} of ${end}`);
      } catch (error) {
        body?.destroy?.();
        if (res.destroyed) return;
        attempt += 1;
        if (attempt >= RANGE_READ_ATTEMPTS) throw error;
        await sleep(Math.min(15_000, 500 * 2 ** attempt));
      }
    }
  }
}

/**
 * FFmpeg and ffprobe need random access to MP4/MOV metadata, sometimes at the
 * very end of the original. An R2-backed localhost HTTP Range server allows
 * arbitrary seeks without staging the original on the Railway filesystem or
 * exposing a private object publicly.
 */
export async function openR2RangeServer(client, bucket, key, info, { windowBytes = RANGE_WINDOW_BYTES } = {}) {
  const objectSize = Number(info.ContentLength);
  if (!Number.isSafeInteger(objectSize) || objectSize <= 0) {
    throw new Error('R2 did not provide a valid original file size');
  }

  const server = createServer((req, res) => {
    void (async () => {
      if (!req.url?.startsWith('/media') || !['GET', 'HEAD'].includes(req.method)) {
        res.writeHead(404).end();
        return;
      }

      const requestedRange = req.headers.range;
      const match = requestedRange ? requestedRange.match(/^bytes=(\d+)-(\d*)$/) : null;
      if (requestedRange && !match) {
        res.writeHead(416, { 'Content-Range': `bytes */${objectSize}` }).end();
        return;
      }
      const first = match ? Number(match[1]) : 0;
      const last = match && match[2] ? Math.min(Number(match[2]), objectSize - 1) : objectSize - 1;
      if (first >= objectSize || last < first) {
        res.writeHead(416, { 'Content-Range': `bytes */${objectSize}` }).end();
        return;
      }

      res.writeHead(match ? 206 : 200, {
        'Accept-Ranges': 'bytes',
        'Content-Type': info.ContentType || 'application/octet-stream',
        'Content-Length': last - first + 1,
        ...(match ? { 'Content-Range': `bytes ${first}-${last}/${objectSize}` } : {}),
      });
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      await pipeObjectRange(client, bucket, key, res, first, last, windowBytes);
      if (!res.destroyed) res.end();
    })().catch(() => {
      if (!res.headersSent) res.writeHead(502).end('R2 media range request failed');
      else res.destroy();
    });
  });
  // A response may stream for as long as the encode runs.
  server.requestTimeout = 0;
  server.keepAliveTimeout = 60_000;

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}/media${imageExtension(key)}`;
  return {
    url,
    close: async () => {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

export async function probeUrl(url) {
  const args = ['-v', 'error', '-show_format', '-show_streams', '-print_format', 'json', url];
  const child = spawn(ffprobeStatic.path, args, { shell: false, windowsHide: true });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
    if (stdout.length > 8 * 1024 * 1024) child.kill();
  });
  child.stderr.on('data', (chunk) => { stderr = (stderr + chunk.toString()).slice(-16384); });
  const outcome = await new Promise((resolve) => {
    child.once('error', (error) => resolve({ error }));
    child.once('close', (code) => resolve({ code }));
  });
  if (outcome.error || outcome.code !== 0) {
    throw new Error(`FFprobe could not read streamed media: ${outcome.error?.message || stderr || outcome.code}`);
  }
  return JSON.parse(stdout);
}

export function runFfmpeg(args, { signal } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { shell: false, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr = (stderr + chunk.toString()).slice(-32768); });
    const onAbort = () => child.kill('SIGKILL');
    signal?.addEventListener('abort', onAbort, { once: true });
    child.once('error', (error) => {
      signal?.removeEventListener('abort', onAbort);
      reject(error);
    });
    child.once('close', (code, exitSignal) => {
      signal?.removeEventListener('abort', onAbort);
      if (signal?.aborted) reject(signal.reason instanceof Error ? signal.reason : new Error('Aborted'));
      else if (code === 0) resolve();
      else reject(new Error(`FFmpeg failed (${exitSignal || code}): ${stderr.trim() || 'no error output'}`));
    });
  });
}

export async function sha256OfFile(filePath) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

/**
 * Audio delivery from a large source (a lesson video's audio-only copy made on
 * its own, or a long lossless recording): the source is read straight from
 * R2, and the small M4A is written to disk as a normal MP4 with its index at
 * the front, so every player can seek in it. Smaller sources use the ordinary
 * download pipeline (`null`).
 */
export async function maybeRunStreamedMediaJob(config, job, operations, thresholdBytes = STREAMING_THRESHOLD_BYTES) {
  if (config.r2Driver !== 's3' || job.job_type !== 'audio_delivery') {
    return null;
  }

  const client = operations.getS3Client();
  const head = await client.send(new HeadObjectCommand({
    Bucket: job.input_bucket,
    Key: job.input_path,
  }));
  if (Number(head.ContentLength || 0) < thresholdBytes) return null;

  const jobDir = path.join(config.workDir || '/tmp', `coptic-vine-audio-job-${job.job_id}`);
  const outputPath = path.join(jobDir, 'audio.m4a');
  const source = await openR2RangeServer(client, job.input_bucket, job.input_path, head);
  let uploaded = false;
  try {
    await mkdir(jobDir, { recursive: true });
    const inputProbe = await probeUrl(source.url);
    const audio = inputProbe.streams?.find((stream) => stream.codec_type === 'audio');
    if (!audio) throw new NoAudioTrackError('Cannot extract audio: the source has no audio stream');
    const copy = audio.codec_name === 'aac';

    await runFfmpeg([
      '-nostdin', '-hide_banner', '-loglevel', 'error',
      '-reconnect', '1', '-reconnect_on_network_error', '1', '-reconnect_delay_max', '30',
      '-rw_timeout', '120000000',
      '-i', source.url,
      '-map', '0:a:0', '-vn', '-sn', '-dn', '-map_metadata', '-1', '-map_chapters', '-1',
      ...(copy ? ['-c:a', 'copy'] : ['-c:a', 'aac', '-b:a', '256k']),
      '-movflags', '+faststart',
      '-max_muxing_queue_size', '4096',
      '-y', outputPath,
    ], { signal: operations.signal });

    const outputProbe = await probeUrl(outputPath);
    const outputAudio = outputProbe.streams?.find((stream) => stream.codec_type === 'audio');
    if (outputAudio?.codec_name !== 'aac') throw new Error('Streamed delivery validation failed: missing aac output');
    const outputSizeBytes = (await stat(outputPath)).size;
    const outputChecksumSha256 = await sha256OfFile(outputPath);
    await operations.uploadFile(job.output_bucket, job.output_path, outputPath, 'audio/mp4');
    uploaded = true;

    const completedRows = await operations.callRpc(config, 'complete_media_processing_job', {
      p_worker_token: config.mediaWorkerToken,
      p_job_id: job.job_id,
      p_output_mime_type: 'audio/mp4',
      p_output_size_bytes: outputSizeBytes,
      p_output_checksum_sha256: outputChecksumSha256,
      p_probe: {
        input: inputProbe,
        output: outputProbe,
        transcode: {
          audioCodec: 'aac',
          container: 'm4a',
          mode: 'streamed',
          sourceCodec: audio.codec_name,
          targetBitrate: copy ? null : '256k',
        },
      },
    });
    return {
      status: 'completed',
      jobId: job.job_id,
      jobType: job.job_type,
      uploadIntentId: job.upload_intent_id,
      outputBucket: job.output_bucket,
      outputPath: job.output_path,
      outputMimeType: 'audio/mp4',
      outputSizeBytes,
      outputChecksumSha256,
      completion: completedRows[0] ?? null,
      streamed: true,
    };
  } catch (error) {
    if (uploaded) {
      await operations.deleteObject(config, job.output_bucket, job.output_path).catch(() => undefined);
    }
    throw error;
  } finally {
    await source.close();
    if (process.env.MEDIA_KEEP_WORK_DIR !== '1') await rm(jobDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
