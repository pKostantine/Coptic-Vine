/** An R2 bucket binding in memory, for running the Worker in tests: the head, get, put, delete and list it uses. */
import type { R2Bucket, R2Object, R2ObjectBody } from '../../src/types.ts';

type Stored = { bytes: Uint8Array<ArrayBuffer>; meta: R2Object };

export function r2(): R2Bucket & { objects: Map<string, Stored> } {
  const objects = new Map<string, Stored>();
  const body = (entry: Stored): R2ObjectBody => ({
    ...entry.meta,
    body: new Blob([entry.bytes]).stream(),
    arrayBuffer: async () => entry.bytes.slice().buffer,
  });
  return {
    objects,
    head: async (key) => objects.get(key)?.meta ?? null,
    get: async (key) => (objects.has(key) ? body(objects.get(key)!) : null),
    put: async (key, value, options = {}) => {
      const bytes = new Uint8Array(typeof value === 'string' ? new TextEncoder().encode(value) : value instanceof ArrayBuffer ? value : await new Response(value).arrayBuffer());
      const etag = `${bytes.length}-${objects.size}`;
      const meta: R2Object = { key, size: bytes.length, etag, httpEtag: `"${etag}"`, uploaded: new Date(), httpMetadata: options.httpMetadata, customMetadata: options.customMetadata };
      objects.set(key, { bytes, meta });
      return meta;
    },
    delete: async (keys) => {
      for (const key of Array.isArray(keys) ? keys : [keys]) objects.delete(key);
    },
    // As R2's: keys in order, a page at a time, the cursor where the next starts.
    list: async ({ prefix = '', cursor, limit = 1000 } = {}) => {
      const keys = [...objects.keys()].filter((key) => key.startsWith(prefix)).sort();
      const start = cursor ? Number(cursor) : 0;
      const page = keys.slice(start, start + limit);
      const truncated = start + limit < keys.length;
      return { objects: page.map((key) => ({ key })), truncated, cursor: truncated ? String(start + limit) : undefined };
    },
  };
}
