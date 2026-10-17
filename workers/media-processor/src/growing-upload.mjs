import { createHash } from 'node:crypto';
import { open, stat } from 'node:fs/promises';
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { punchHole as defaultPunchHole } from './runtime.mjs';

// R2 requires every part but the last to be the same size.
export const DELIVERY_PART_BYTES = 32 * 1024 * 1024;
const CACHE_CONTROL = 'public, max-age=31536000, immutable';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** One R2 request, retried with backoff: a dropped connection must not cost an hour of encoding. */
export async function sendWithRetry(client, makeCommand, label, { attempts = 5, signal } = {}) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new Error(String(signal.reason || 'Aborted'));
    try {
      return await client.send(makeCommand());
    } catch (error) {
      lastError = error;
      if (attempt === attempts - 1) break;
      await sleep(Math.min(30_000, 1_000 * 2 ** attempt));
    }
  }
  throw new Error(`${label} failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function readExactly(handle, offset, length) {
  const buffer = Buffer.allocUnsafe(length);
  let filled = 0;
  while (filled < length) {
    const { bytesRead } = await handle.read(buffer, filled, length - filled, offset + filled);
    if (!bytesRead) throw new Error(`Output ended at ${offset + filled} bytes while ${offset + length} were expected`);
    filled += bytesRead;
  }
  return buffer;
}

/**
 * Uploads a file to R2 while FFmpeg is still writing it.
 *
 * FFmpeg writes an MP4 front to back and, when it finishes, goes back only to
 * the first few dozen bytes to record the media data's size (then appends the
 * index at the end). So every part after the first is final the moment it has
 * been written: those parts upload during the encode, and the first part is
 * uploaded last. With `freeUploadedBytes`, each uploaded part's disk blocks
 * are given back, so a multi-GB rendition needs only a few parts of disk.
 */
export class GrowingFileUploader {
  constructor({
    client,
    bucket,
    key,
    filePath,
    contentType,
    partBytes = DELIVERY_PART_BYTES,
    freeUploadedBytes = false,
    punchHole = defaultPunchHole,
    concurrency = 2,
    signal,
  }) {
    Object.assign(this, { client, bucket, key, filePath, contentType, partBytes, freeUploadedBytes, punchHole, concurrency, signal });
    this.uploadId = null;
    this.nextPart = 2;
    this.parts = new Map();
    this.inFlight = new Set();
    this.failure = null;
    this.handle = null;
    this.uploadedBytes = 0;
  }

  async start() {
    const created = await sendWithRetry(this.client, () => new CreateMultipartUploadCommand({
      Bucket: this.bucket,
      Key: this.key,
      ContentType: this.contentType,
      CacheControl: CACHE_CONTROL,
    }), 'Starting the delivery upload', { signal: this.signal });
    if (!created.UploadId) throw new Error('R2 did not return a delivery multipart upload ID');
    this.uploadId = created.UploadId;
  }

  async currentSize() {
    try {
      return (await stat(this.filePath)).size;
    } catch {
      return 0;
    }
  }

  async fileHandle() {
    this.handle ??= await open(this.filePath, 'r');
    return this.handle;
  }

  uploadPart(partNumber, length) {
    const offset = (partNumber - 1) * this.partBytes;
    const task = (async () => {
      const handle = await this.fileHandle();
      const body = await readExactly(handle, offset, length);
      const response = await sendWithRetry(this.client, () => new UploadPartCommand({
        Bucket: this.bucket,
        Key: this.key,
        UploadId: this.uploadId,
        PartNumber: partNumber,
        Body: body,
        ContentLength: body.length,
      }), `Uploading delivery part ${partNumber}`, { signal: this.signal });
      if (!response.ETag) throw new Error(`R2 did not return an ETag for delivery part ${partNumber}`);
      this.parts.set(partNumber, response.ETag);
      this.uploadedBytes += body.length;
      if (this.freeUploadedBytes && partNumber > 1) await this.punchHole(this.filePath, offset, length);
    })().catch((error) => {
      this.failure ??= error;
    }).finally(() => {
      this.inFlight.delete(task);
    });
    this.inFlight.add(task);
    return task;
  }

  /** Starts uploads for the parts FFmpeg has finished; call it as the file grows. */
  async pump() {
    if (this.failure) throw this.failure;
    const size = await this.currentSize();
    while (this.inFlight.size < this.concurrency && this.nextPart * this.partBytes <= size) {
      this.uploadPart(this.nextPart, this.partBytes);
      this.nextPart += 1;
    }
  }

  async drain() {
    while (this.inFlight.size) await Promise.race(this.inFlight);
    if (this.failure) throw this.failure;
  }

  /** After FFmpeg exits: upload the rest, then the first part, and complete. */
  async finish() {
    await this.drain();
    const size = await this.currentSize();
    if (!size) throw new Error('FFmpeg produced an empty media file');
    const lastPart = Math.max(1, Math.ceil(size / this.partBytes));
    for (let partNumber = this.nextPart; partNumber <= lastPart; partNumber += 1) {
      while (this.inFlight.size >= this.concurrency) await Promise.race(this.inFlight);
      if (this.failure) throw this.failure;
      const length = Math.min(this.partBytes, size - (partNumber - 1) * this.partBytes);
      this.uploadPart(partNumber, length);
    }
    this.nextPart = lastPart + 1;
    this.uploadPart(1, Math.min(this.partBytes, size));
    await this.drain();

    const parts = [...this.parts.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([PartNumber, ETag]) => ({ PartNumber, ETag }));
    if (parts.length !== lastPart) throw new Error(`Only ${parts.length} of ${lastPart} delivery parts were uploaded`);
    await sendWithRetry(this.client, () => new CompleteMultipartUploadCommand({
      Bucket: this.bucket,
      Key: this.key,
      UploadId: this.uploadId,
      MultipartUpload: { Parts: parts },
    }), 'Completing the delivery upload', { signal: this.signal });
    await this.close();
    return { sizeBytes: size, partsCount: parts.length };
  }

  async close() {
    const handle = this.handle;
    this.handle = null;
    await handle?.close().catch(() => undefined);
  }

  async abort() {
    await Promise.allSettled([...this.inFlight]);
    await this.close();
    if (!this.uploadId) return;
    await this.client.send(new AbortMultipartUploadCommand({
      Bucket: this.bucket,
      Key: this.key,
      UploadId: this.uploadId,
    })).catch(() => undefined);
  }
}

/**
 * Last resort when the disk can hold neither the rendition nor give back
 * uploaded blocks: a stream (FFmpeg's stdout) to R2 in equal parts, uploaded
 * in the background while the stream keeps flowing.
 */
export async function streamToMultipart(readable, {
  client, bucket, key, contentType, partBytes = DELIVERY_PART_BYTES, concurrency = 2, signal,
}) {
  const created = await sendWithRetry(client, () => new CreateMultipartUploadCommand({
    Bucket: bucket, Key: key, ContentType: contentType, CacheControl: CACHE_CONTROL,
  }), 'Starting the streamed delivery upload', { signal });
  if (!created.UploadId) throw new Error('R2 did not return a streaming upload ID');

  const parts = new Map();
  const inFlight = new Set();
  let failure = null;
  let partNumber = 0;
  const checksum = createHash('sha256');
  let totalBytes = 0;
  let pending = [];
  let pendingBytes = 0;

  const upload = (bytes) => {
    partNumber += 1;
    const number = partNumber;
    const task = sendWithRetry(client, () => new UploadPartCommand({
      Bucket: bucket, Key: key, UploadId: created.UploadId, PartNumber: number, Body: bytes, ContentLength: bytes.length,
    }), `Uploading streamed part ${number}`, { signal })
      .then((response) => {
        if (!response.ETag) throw new Error(`R2 did not return ETag for output part ${number}`);
        parts.set(number, response.ETag);
      })
      .catch((error) => { failure ??= error; })
      .finally(() => inFlight.delete(task));
    inFlight.add(task);
  };

  try {
    for await (const chunk of readable) {
      if (failure) throw failure;
      checksum.update(chunk);
      totalBytes += chunk.length;
      pending.push(chunk);
      pendingBytes += chunk.length;
      while (pendingBytes >= partBytes) {
        const joined = Buffer.concat(pending, pendingBytes);
        upload(joined.subarray(0, partBytes));
        const tail = joined.subarray(partBytes);
        pending = tail.length ? [Buffer.from(tail)] : [];
        pendingBytes = tail.length;
        while (inFlight.size >= concurrency) await Promise.race(inFlight);
      }
    }
    if (!totalBytes) throw new Error('FFmpeg produced an empty media file');
    if (pendingBytes) upload(Buffer.concat(pending, pendingBytes));
    while (inFlight.size) await Promise.race(inFlight);
    if (failure) throw failure;
    await sendWithRetry(client, () => new CompleteMultipartUploadCommand({
      Bucket: bucket, Key: key, UploadId: created.UploadId,
      MultipartUpload: { Parts: [...parts.entries()].sort((a, b) => a[0] - b[0]).map(([PartNumber, ETag]) => ({ PartNumber, ETag })) },
    }), 'Completing the streamed delivery upload', { signal });
    return { sizeBytes: totalBytes, sha256: checksum.digest('hex'), partsCount: parts.size };
  } catch (error) {
    await Promise.allSettled([...inFlight]);
    await client.send(new AbortMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId: created.UploadId })).catch(() => undefined);
    throw error;
  }
}
