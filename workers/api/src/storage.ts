/**
 * /storage/v1: the two Supabase Storage buckets the apps write, profile-avatars
 * and playlist-covers, on R2 (USER_MEDIA, keyed "<bucket>/<path>"), answering
 * supabase-js's storage calls as Supabase Storage does:
 *
 *   GET|HEAD /storage/v1/object/public/<bucket>/<path>   anyone (both buckets are public)
 *   POST|PUT /storage/v1/object/<bucket>/<path>           upload (x-upsert: true to replace)
 *   DELETE   /storage/v1/object/<bucket>                  remove { prefixes: [paths] }
 *
 * Who may write is Supabase's storage.objects policies: a profile photo under
 * the user's own folder ("<uid>/…"), a playlist cover at "<uid>/<playlist>/cover"
 * of a playlist the user owns. Both buckets take JPEG, PNG or WebP up to 5 MB.
 * The uploader is kept as the object's owner, which set_music_playlist_cover
 * checks. Checked by tests/storage.objects.test.ts.
 */
import { col, t } from '../../content-api/src/db/names.ts';
import type { Env, R2Bucket } from './types.ts';

const BUCKETS: Record<string, { maxBytes: number; types: string[] }> = {
  'profile-avatars': { maxBytes: 5 * 1024 * 1024, types: ['image/jpeg', 'image/png', 'image/webp'] },
  'playlist-covers': { maxBytes: 5 * 1024 * 1024, types: ['image/jpeg', 'image/png', 'image/webp'] },
};

/** Supabase Storage's error shape. */
const failure = (status: number, error: string, message: string) => Response.json({ statusCode: String(status), error, message }, { status });
const denied = () => failure(403, 'Unauthorized', 'new row violates row-level security policy');

/** The key an object is kept under, or null for a path that leaves its folder. */
export function objectKey(bucket: string, path: string): string | null {
  const clean = path.replace(/^\/+/, '');
  if (!clean || clean.split('/').some((part) => part === '' || part === '.' || part === '..')) return null;
  return `${bucket}/${clean}`;
}

/** The storage.objects policies: may this user write (or delete) this object? */
async function mayWrite(env: Env, userId: string, bucket: string, path: string): Promise<boolean> {
  if (bucket === 'profile-avatars') return path.split('/')[0] === userId;
  const match = /^([^/]+)\/([^/]+)\/cover$/.exec(path);
  if (!match || match[1] !== userId) return false;
  const playlist = await env.DB.prepare(`SELECT 1 AS yes FROM ${t('music', 'playlists')} WHERE ${col('id')} = ? AND ${col('owner_user_id')} = ?`).bind(match[2], userId).first();
  return Boolean(playlist);
}

/** The uploaded file and its type, from a raw body or supabase-js's multipart form. */
async function uploaded(request: Request): Promise<{ bytes: ArrayBuffer; type: string; cacheControl: string | null }> {
  const contentType = (request.headers.get('content-type') ?? '').toLowerCase();
  if (contentType.startsWith('multipart/form-data')) {
    const form = await request.formData();
    const file = [...form.values()].find((value) => typeof value !== 'string') as Blob | undefined;
    const cache = form.get('cacheControl');
    return { bytes: file ? await file.arrayBuffer() : new ArrayBuffer(0), type: (file?.type ?? '').toLowerCase(), cacheControl: typeof cache === 'string' ? `max-age=${cache}` : null };
  }
  return { bytes: await request.arrayBuffer(), type: contentType.split(';')[0].trim(), cacheControl: request.headers.get('cache-control') };
}

export async function storageRequest(request: Request, url: URL, env: Env, userId: string | null): Promise<Response> {
  const bucketStore: R2Bucket | undefined = env.USER_MEDIA;
  if (!bucketStore) return failure(503, 'unavailable', 'Storage is not configured');
  const route = url.pathname.slice('/storage/v1/'.length);

  const reading = /^object\/public\/([^/]+)\/(.+)$/.exec(route);
  if (reading && (request.method === 'GET' || request.method === 'HEAD')) {
    const [, bucket, path] = reading;
    const key = BUCKETS[bucket] ? objectKey(bucket, decodeURIComponent(path)) : null;
    const object = key ? await bucketStore.get(key) : null;
    if (!object) return failure(404, 'not_found', 'Object not found');
    const headers = {
      'content-type': object.httpMetadata?.contentType ?? 'application/octet-stream',
      'cache-control': object.httpMetadata?.cacheControl ?? 'max-age=3600',
      etag: object.httpEtag,
      'content-length': String(object.size),
    };
    return new Response(request.method === 'HEAD' ? null : object.body, { headers });
  }

  const writing = /^object\/([^/]+)\/(.+)$/.exec(route);
  if (writing && (request.method === 'POST' || request.method === 'PUT')) {
    const [, bucket, rawPath] = writing;
    const rules = BUCKETS[bucket];
    if (!rules) return failure(404, 'Bucket not found', 'Bucket not found');
    const path = decodeURIComponent(rawPath);
    const key = objectKey(bucket, path);
    if (!userId || !key || !(await mayWrite(env, userId, bucket, path))) return denied();
    const file = await uploaded(request);
    if (!rules.types.includes(file.type)) return failure(415, 'invalid_mime_type', `mime type ${file.type || 'unknown'} is not supported`);
    if (file.bytes.byteLength > rules.maxBytes) return failure(413, 'Payload too large', 'The object exceeded the maximum allowed size');
    // POST makes a new object unless x-upsert says to replace it; PUT replaces one.
    const upsert = request.method === 'PUT' || request.headers.get('x-upsert') === 'true';
    if (!upsert && await bucketStore.head(key)) return failure(409, 'Duplicate', 'The resource already exists');
    await bucketStore.put(key, file.bytes, { httpMetadata: { contentType: file.type, cacheControl: file.cacheControl ?? 'max-age=3600' }, customMetadata: { owner: userId } });
    return Response.json({ Key: key, Id: crypto.randomUUID() });
  }

  const removing = /^object\/([^/]+)\/?$/.exec(route);
  if (removing && request.method === 'DELETE') {
    const bucket = removing[1];
    if (!BUCKETS[bucket]) return failure(404, 'Bucket not found', 'Bucket not found');
    if (!userId) return denied();
    const body = await request.json().catch(() => null) as { prefixes?: unknown } | null;
    const paths = Array.isArray(body?.prefixes) ? body!.prefixes.filter((path): path is string => typeof path === 'string') : [];
    const removed = [];
    for (const path of paths) {
      const key = objectKey(bucket, path);
      // As Supabase: what the user may not delete, or that isn't there, is left out of the answer.
      if (!key || !(await mayWrite(env, userId, bucket, path))) continue;
      const object = await bucketStore.head(key);
      if (!object) continue;
      await bucketStore.delete(key);
      removed.push({ name: path, bucket_id: bucket, id: null, updated_at: object.uploaded.toISOString(), metadata: { size: object.size, mimetype: object.httpMetadata?.contentType ?? null } });
    }
    return Response.json(removed);
  }
  return failure(400, 'invalid_request', 'Unsupported storage request');
}
