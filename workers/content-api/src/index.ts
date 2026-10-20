/**
 * cv-content-api: the liturgical content from D1, answered the way Supabase's
 * REST API answers the app today, so the app can be pointed here with its
 * own supabase-js queries unchanged (Phase 1 of docs/coptic-vine-d1-plan.md).
 *
 *   GET  /rest/v1/<table>        Accept-Profile: <schema>   rows (src/rest/rows.ts)
 *   POST /rest/v1/rpc/<function> Content-Profile: <schema>  the content RPCs (src/rpc)
 *   GET  /health
 *
 * Everything is public and read-only: there is no write path to D1. An
 * optional church (x-church-id header or church_id parameter) is accepted
 * for Phase 3's church layers and ignored for now.
 *
 * Caching. The default entrypoint (not cached) reads the content revision
 * from D1 and turns the request into a GET for the Content entrypoint whose
 * URL carries that revision, the RPC arguments and everything else the
 * answer depends on. Workers Caching sits in front of Content, so an answer
 * is computed once per revision and served from Cloudflare's cache after
 * that; any change to the content moves the revision (the triggers in
 * migrations/0003) and with it every key. A new deployment starts a new
 * cache too, since the Worker version is part of the key.
 */
import { WorkerEntrypoint } from 'cloudflare:workers';
import { col, t } from './db/names.ts';
import { PgError } from './pg.ts';
import { readRows } from './rest/rows.ts';
import { callRpc } from './rpc/index.ts';
import type { Context, ContentContext, Env } from './types.ts';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, HEAD, POST, OPTIONS',
  'access-control-allow-headers': 'accept, accept-profile, apikey, authorization, content-profile, content-type, prefer, range, x-client-info, x-church-id, x-supabase-api-version',
  'access-control-expose-headers': 'content-range, x-content-revision',
  'access-control-max-age': '86400',
};

/** Requests whose cache URL would be longer than this are answered directly. */
const MAX_CACHE_URL = 16_000;
const REVISION_TTL_MS = 5_000;

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function churchOf(request: Request, url: URL): string | null {
  const value = request.headers.get('x-church-id') ?? url.searchParams.get('church_id');
  if (value === null || value === '') return null;
  if (!UUID.test(value)) throw new PgError('PGRST100', 'church_id must be a UUID', 400);
  return value.toLowerCase();
}

/** JSON with sorted keys, so the same arguments always make the same cache key. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

let revisionCache: { value: number; at: number } | null = null;

/** The content revision, read from D1 at most every few seconds per isolate. */
async function currentRevision(env: Env): Promise<number> {
  if (revisionCache && Date.now() - revisionCache.at < REVISION_TTL_MS) return revisionCache.value;
  const row = await env.CONTENT_DB.prepare(`SELECT ${col('revision')} FROM ${t('offline_content', 'revision')} WHERE ${col('id')} = 1`).first<{ revision: number }>();
  revisionCache = { value: row?.revision ?? 0, at: Date.now() };
  return revisionCache.value;
}

/**
 * The request as an internal GET path: /rows/<schema>/<table>?<query> or
 * /rpc/<schema>/<function>?args=<json>, plus __accept and __church.
 */
async function internalPath(request: Request, url: URL, churchId: string | null): Promise<string> {
  const extras = new URLSearchParams();
  if (churchId) extras.set('__church', churchId);

  const rpc = url.pathname.match(/^\/rest\/v1\/rpc\/([a-z_][a-z0-9_]*)$/);
  if (rpc) {
    if (request.method !== 'POST') throw new PgError('PGRST117', `Unsupported HTTP method: ${request.method}`, 405);
    const schema = request.headers.get('content-profile') || 'public';
    const text = await request.text();
    let body: unknown = {};
    if (text.trim()) {
      try { body = JSON.parse(text); } catch { throw new PgError('PGRST102', 'Empty or invalid json', 400); }
    }
    extras.set('args', canonical(body));
    return `/rpc/${encodeURIComponent(schema)}/${rpc[1]}?${extras}`;
  }

  const table = url.pathname.match(/^\/rest\/v1\/([a-z_][a-z0-9_]*)$/);
  if (table) {
    if (request.method !== 'GET' && request.method !== 'HEAD') throw new PgError('PGRST117', 'Content is read-only', 405);
    const schema = request.headers.get('accept-profile') || 'public';
    const params = new URLSearchParams(url.search);
    params.delete('church_id');
    if ((request.headers.get('accept') ?? '').includes('application/vnd.pgrst.object+json')) extras.set('__accept', 'object');
    const query = [params.toString(), extras.toString()].filter(Boolean).join('&');
    return `/rows/${encodeURIComponent(schema)}/${table[1]}${query ? `?${query}` : ''}`;
  }

  throw new PgError('PGRST125', 'Invalid path specified in request URL', 404);
}

/** Answers an internal path (without the revision prefix). */
async function answer(env: Env, path: string): Promise<Response> {
  const url = new URL(path, 'https://content.internal');
  const churchId = url.searchParams.get('__church');
  const context: ContentContext = { db: env.CONTENT_DB, churchId };
  const cached = { 'cache-control': 'public, max-age=31536000, immutable' };
  try {
    const rpc = url.pathname.match(/^\/rpc\/([^/]+)\/([a-z_][a-z0-9_]*)$/);
    if (rpc) {
      const body = await callRpc(context, decodeURIComponent(rpc[1]), rpc[2], JSON.parse(url.searchParams.get('args') ?? '{}'));
      return json(body, 200, cached);
    }
    const rows = url.pathname.match(/^\/rows\/([^/]+)\/([a-z_][a-z0-9_]*)$/);
    if (rows) {
      const accept = url.searchParams.get('__accept') === 'object' ? 'application/vnd.pgrst.object+json' : '';
      for (const name of ['__accept', '__church']) url.searchParams.delete(name);
      const { body, range } = await readRows(context, decodeURIComponent(rows[1]), rows[2], url, accept);
      return json(body, 200, { ...cached, 'content-range': range });
    }
    throw new PgError('PGRST125', 'Invalid path specified in request URL', 404);
  } catch (error) {
    if (error instanceof PgError) return json(error.body(), error.status, { 'cache-control': 'no-store' });
    console.error(error);
    return json({ code: 'XX000', details: null, hint: null, message: 'Internal error' }, 500, { 'cache-control': 'no-store' });
  }
}

/** The cached entrypoint: its URL is /r/<revision><internal path>. */
export class Content extends WorkerEntrypoint<Env> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/r\/\d+/, '') + url.search;
    return answer(this.env, path);
  }
}

export async function handle(request: Request, env: Env, ctx: Context): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  try {
    if (url.pathname === '/health') return json({ ok: true, revision: await currentRevision(env) }, 200, { ...CORS, 'cache-control': 'no-store' });
    const churchId = churchOf(request, url);
    const path = await internalPath(request, url, churchId);
    const revision = await currentRevision(env);
    const cacheUrl = `https://content.internal/r/${revision}${path}`;
    const response = cacheUrl.length <= MAX_CACHE_URL ? await ctx.exports.Content.fetch(new Request(cacheUrl)) : await answer(env, path);
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(CORS)) headers.set(name, value);
    // Clients revalidate every time: the edge cache makes that cheap, and a
    // change shows up at once.
    headers.set('cache-control', 'no-cache');
    headers.set('x-content-revision', String(revision));
    return new Response(request.method === 'HEAD' ? null : response.body, { status: response.status, headers });
  } catch (error) {
    const body = error instanceof PgError ? error.body() : { code: 'XX000', details: null, hint: null, message: 'Internal error' };
    if (!(error instanceof PgError)) console.error(error);
    return json(body, error instanceof PgError ? error.status : 500, { ...CORS, 'cache-control': 'no-store' });
  }
}

export default { fetch: handle };
