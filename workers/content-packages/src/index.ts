interface R2ObjectBody {
  body: ReadableStream;
  httpEtag: string;
  writeHttpMetadata(headers: Headers): void;
}
interface R2Object {
  httpEtag: string;
  writeHttpMetadata(headers: Headers): void;
}
interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
  head(key: string): Promise<R2Object | null>;
  put(key: string, value: ReadableStream | ArrayBuffer | string, options?: { httpMetadata?: Record<string, string> }): Promise<unknown>;
}

interface Env {
  CONTENT_BUCKET: R2Bucket;
  PUBLISH_TOKEN: string;
}

/**
 * Serves the book packages the app downloads -- the root manifest and the
 * immutable, gzip-encoded chunks -- from the private chc-content bucket, and
 * takes uploads of them from scripts/publish-content-packages.mjs.
 *
 * The packages used to be built here, on a schedule, from the database. On
 * the Workers free plan a run has milliseconds of CPU, far short of hashing
 * and gzipping the books, so building moved to the script and this Worker
 * only stores and serves.
 */

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
}

// A chunk is named by its content: packages/<resource>/<sha256>.json.
const PACKAGE_KEY = /^packages\/[a-z0-9_]+\/[a-f0-9]{64}\.json$/;

async function serveObject(env: Env, key: string, headOnly: boolean): Promise<Response> {
  const object = headOnly ? await env.CONTENT_BUCKET.head(key) : await env.CONTENT_BUCKET.get(key);
  if (!object) return json({ error: 'not_found' }, 404);
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('x-content-type-options', 'nosniff');
  // A chunk is stored gzipped; 'manual' sends those bytes as they are,
  // where the runtime would otherwise gzip them a second time.
  const encodeBody = headers.has('content-encoding') ? 'manual' : 'automatic';
  return new Response(headOnly ? null : (object as R2ObjectBody).body, { headers, encodeBody } as ResponseInit);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const key = url.pathname.slice(1);
    const read = request.method === 'GET' || request.method === 'HEAD';

    if (read && key === 'manifest.json') return serveObject(env, key, request.method === 'HEAD');
    if (read && PACKAGE_KEY.test(key)) return serveObject(env, key, request.method === 'HEAD');

    if (request.method === 'PUT' && (key === 'manifest.json' || PACKAGE_KEY.test(key))) {
      if (!env.PUBLISH_TOKEN || request.headers.get('authorization') !== `Bearer ${env.PUBLISH_TOKEN}`) {
        return json({ error: 'unauthorized' }, 401);
      }
      if (!request.body) return json({ error: 'empty' }, 400);
      // The manifest is the publication point: always revalidated. A chunk
      // never changes under its name, so it is cached for good, and arrives
      // already gzipped.
      const httpMetadata: Record<string, string> = key === 'manifest.json'
        ? { contentType: 'application/json', cacheControl: 'no-cache' }
        : { contentType: 'application/json', contentEncoding: 'gzip', cacheControl: 'public, max-age=31536000, immutable' };
      await env.CONTENT_BUCKET.put(key, request.body, { httpMetadata });
      return json({ stored: key });
    }

    return json({ error: 'not_found' }, 404);
  },
};
