import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  UploadPartCommand,
} from '@aws-sdk/client-s3';

async function bodyBytes(body) {
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  const chunks = [];
  for await (const chunk of body) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

/**
 * An in-memory R2 that behaves like the real one where it matters: ranged
 * reads, and multipart uploads whose parts (all but the last) must be the same
 * size. `faults` makes some reads fail outright or end early.
 */
export function fakeR2(initial = {}, { faults = null } = {}) {
  const objects = new Map(Object.entries(initial));
  const pending = new Map();
  const log = [];
  let nextId = 0;
  let getCount = 0;

  return {
    objects,
    log,
    pending,
    async send(command) {
      const p = command.input;
      const objectKey = `${p.Bucket}/${p.Key}`;
      log.push({ command: command.constructor.name, key: objectKey, partNumber: p.PartNumber, range: p.Range });

      if (command instanceof HeadObjectCommand) {
        const bytes = objects.get(objectKey);
        if (!bytes) throw Object.assign(new Error(`NotFound: ${objectKey}`), { name: 'NotFound' });
        return { ContentLength: bytes.length, ContentType: 'application/octet-stream' };
      }
      if (command instanceof GetObjectCommand) {
        const bytes = objects.get(objectKey);
        if (!bytes) throw new Error(`Missing R2 object: ${objectKey}`);
        getCount += 1;
        if (faults?.failEvery && getCount % faults.failEvery === 0) throw new Error('Simulated R2 connection reset');
        const match = p.Range?.match(/^bytes=(\d+)-(\d*)$/);
        const start = match ? Number(match[1]) : 0;
        const end = match && match[2] ? Math.min(Number(match[2]), bytes.length - 1) : bytes.length - 1;
        if (start >= bytes.length || start > end) throw new Error('Unsatisfiable range');
        let selected = bytes.subarray(start, end + 1);
        if (faults?.truncateEvery && getCount % faults.truncateEvery === 0 && selected.length > 1) {
          // The connection drops part-way through the body.
          selected = selected.subarray(0, Math.floor(selected.length / 2));
        }
        return {
          Body: Readable.from([selected]),
          ContentLength: end - start + 1,
          ...(match ? { ContentRange: `bytes ${start}-${end}/${bytes.length}` } : {}),
        };
      }
      if (command instanceof PutObjectCommand) {
        objects.set(objectKey, await bodyBytes(p.Body));
        return {};
      }
      if (command instanceof DeleteObjectCommand) {
        objects.delete(objectKey);
        return {};
      }
      if (command instanceof CreateMultipartUploadCommand) {
        nextId += 1;
        const id = `fake-${nextId}`;
        pending.set(id, { key: objectKey, parts: new Map() });
        return { UploadId: id };
      }
      if (command instanceof UploadPartCommand) {
        const upload = pending.get(p.UploadId);
        assert.ok(upload, 'multipart upload must exist');
        const bytes = await bodyBytes(p.Body);
        assert.equal(p.ContentLength, bytes.length, 'ContentLength must match the part body');
        upload.parts.set(p.PartNumber, bytes);
        return { ETag: `"part-${p.PartNumber}-${bytes.length}"` };
      }
      if (command instanceof CompleteMultipartUploadCommand) {
        const upload = pending.get(p.UploadId);
        assert.ok(upload, 'multipart upload must exist to complete');
        const numbers = p.MultipartUpload.Parts.map((part) => part.PartNumber);
        assert.deepEqual(numbers, numbers.map((_, index) => index + 1), 'parts must be complete and in order');
        const parts = numbers.map((number) => upload.parts.get(number));
        const sizes = parts.map((part) => part.length);
        // R2: "All non-trailing parts must have the same size."
        assert.ok(sizes.slice(0, -1).every((size) => size === sizes[0]), `non-trailing parts differ in size: ${sizes.join(',')}`);
        objects.set(objectKey, Buffer.concat(parts));
        pending.delete(p.UploadId);
        return {};
      }
      if (command instanceof AbortMultipartUploadCommand) {
        pending.delete(p.UploadId);
        return {};
      }
      throw new Error(`Unexpected fake S3 command ${command.constructor.name}`);
    },
  };
}
