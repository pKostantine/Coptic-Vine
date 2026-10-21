/**
 * cv-api: sign-in and the user data for Coptic Vine, CV-Admin and CV-Artists
 * (Phase 2 of docs/coptic-vine-d1-plan.md), at https://api.copticvine.ca.
 *
 *   /auth/*                       Better Auth (src/auth)
 *   POST /rest/v1/rpc/<function>  the database functions the apps call (src/rpc)
 *   /rest/v1/<table>              the tables they read and write directly (src/rest/tables.ts)
 *   /storage/v1/…                 the two buckets the apps upload to, on R2 (src/storage.ts)
 *   /health                       whether the Worker and D1 answer
 *
 * The /rest/v1 paths answer as Supabase's REST API (PostgREST) does, so the
 * apps keep their supabase-js calls; the schema comes from Accept-Profile or
 * Content-Profile, public by default. The user is the session's (cookie or
 * bearer token), never anything in the request.
 *
 * Browsers: the web apps on copticvine.ca call here with their cookie
 * (same-site), so CORS answers trusted http(s) origins by name, with
 * credentials, and exposes set-auth-token for clients that keep a bearer
 * token instead.
 */
import { createAuth, list, sessionHeaders, type Auth } from './auth/index.ts';
import { afterWrites, trackWrites } from './db/afterWrites.ts';
import { recoverTransactions } from './db/transaction.ts';
import { publishDueLearningReleases, publishDueMusicReleases } from './jobs/releases.ts';
import { httpStatus, PgError, triggerError, uniqueViolation } from './pg.ts';
import type { ApiContext } from './rest/context.ts';
import { tableRequest } from './rest/tables.ts';
import { callRpc } from './rpc/index.ts';
import { storageRequest } from './storage.ts';
import type { Env } from './types.ts';

const auths = new WeakMap<Env, Auth>();
function auth(env: Env): Auth {
  let instance = auths.get(env);
  if (!instance) auths.set(env, (instance = createAuth(env)));
  return instance;
}

function cors(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('origin');
  if (!origin || !/^https?:\/\//.test(origin) || !list(env.TRUSTED_ORIGINS).includes(origin)) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-credentials': 'true',
    'access-control-allow-methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    'access-control-allow-headers': 'accept, authorization, content-type, x-client-info, apikey, accept-profile, content-profile, prefer, range, x-upsert, cache-control',
    'access-control-expose-headers': 'set-auth-token, content-range',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
}

function withHeaders(response: Response, headers: Record<string, string>): Response {
  if (!Object.keys(headers).length) return response;
  const out = new Response(response.body, response);
  for (const [name, value] of Object.entries(headers)) out.headers.set(name, value);
  return out;
}

/** The Workers runtime's ExecutionContext, the part used here. */
type Execution = { waitUntil(promise: Promise<unknown>): void };

export async function handle(request: Request, env: Env, execution?: Execution): Promise<Response> {
  const url = new URL(request.url);
  const corsHeaders = cors(request, env);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  if (url.pathname === '/auth' || url.pathname.startsWith('/auth/')) {
    const headers = sessionHeaders(request.headers);
    return withHeaders(await auth(env).handler(headers === request.headers ? request : new Request(request, { headers })), corsHeaders);
  }
  if (url.pathname.startsWith('/rest/v1/')) {
    return withHeaders(await rest(request, url, env, execution), corsHeaders);
  }
  if (url.pathname.startsWith('/storage/v1/')) {
    const isRead = request.method === 'GET' || request.method === 'HEAD';
    const session = isRead ? null : await auth(env).api.getSession({ headers: sessionHeaders(request.headers) });
    return withHeaders(await storageRequest(request, url, env, session?.user.id ?? null), corsHeaders);
  }
  if (url.pathname === '/health') {
    const db = await env.DB.prepare('SELECT 1 AS ok').first<{ ok: number }>();
    return withHeaders(Response.json({ ok: db?.ok === 1 }, { headers: { 'cache-control': 'no-store' } }), corsHeaders);
  }
  return withHeaders(Response.json({ code: 'PGRST125', message: 'Not found', details: null, hint: null }, { status: 404 }), corsHeaders);
}

async function rest(request: Request, url: URL, env: Env, execution?: Execution): Promise<Response> {
  let wrote = false;
  const response = await restResponse(request, url, env, () => { wrote = true; });
  // What Supabase did after a write (the search index, the media processor); the write itself has committed.
  if (wrote) await afterWrites(env, execution?.waitUntil.bind(execution)).catch((error) => console.error('After the write:', error));
  return response;
}

/** Whether the request carries SERVICE_TOKEN as its bearer token, compared in constant time (as digests, so their lengths match). */
async function isServiceToken(request: Request, env: Env): Promise<boolean> {
  const bearer = /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization') ?? '')?.[1]?.trim();
  if (!env.SERVICE_TOKEN || !bearer) return false;
  const digest = async (text: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  const [given, expected] = await Promise.all([digest(bearer), digest(env.SERVICE_TOKEN)]);
  let difference = 0;
  for (let i = 0; i < expected.length; i += 1) difference |= given[i] ^ expected[i];
  return difference === 0;
}

async function restResponse(request: Request, url: URL, env: Env, onWrite: () => void): Promise<Response> {
  let ctx: ApiContext | null = null;
  try {
    if (await isServiceToken(request, env)) {
      ctx = { db: trackWrites(env.DB, onWrite), env, userId: null, service: true };
    } else {
      const session = await auth(env).api.getSession({ headers: sessionHeaders(request.headers) });
      ctx = { db: trackWrites(env.DB, onWrite), env, userId: session?.user.id ?? null };
    }
    const path = url.pathname.slice('/rest/v1/'.length);
    const profile = request.headers.get(request.method === 'GET' || request.method === 'HEAD' ? 'accept-profile' : 'content-profile') ?? 'public';
    const rpc = path.match(/^rpc\/([A-Za-z_]\w*)$/);
    if (rpc) {
      if (request.method !== 'POST' && request.method !== 'GET') throw new PgError('PGRST117', `Unsupported HTTP method: ${request.method}`, 405);
      const args = request.method === 'GET'
        ? Object.fromEntries(url.searchParams)
        : ((await request.text()) || '{}');
      const parsed = typeof args === 'string' ? JSON.parse(args) as Record<string, unknown> : args;
      const { result, returnsVoid } = await callRpc(ctx, profile, rpc[1], parsed);
      if (returnsVoid) return new Response(null, { status: 204 });
      return new Response(JSON.stringify(result ?? null), { headers: { 'content-type': 'application/json; charset=utf-8' } });
    }
    const table = path.match(/^([A-Za-z_]\w*)$/);
    const response = table ? await tableRequest(request, url, profile, table[1], ctx) : null;
    if (response) return response;
    throw new PgError('PGRST205', `Could not find the table '${profile}.${path}' in the schema cache`, 404);
  } catch (error) {
    if (error instanceof PgError) {
      const status = error.code === '42501' ? httpStatus(error.code, Boolean(ctx?.userId)) : error.status;
      return Response.json(error.body(), { status });
    }
    const raised = triggerError(error);
    if (raised) return Response.json(raised.body(), { status: raised.code === '42501' ? httpStatus(raised.code, Boolean(ctx?.userId)) : raised.status });
    const message = (error as Error).message ?? String(error);
    // D1's constraint failures, as Postgres would report them.
    const duplicate = uniqueViolation(error);
    if (duplicate) return Response.json(duplicate.body(), { status: duplicate.status });
    if (/FOREIGN KEY constraint failed/.test(message)) return Response.json({ code: '23503', details: null, hint: null, message: 'insert or update on table violates foreign key constraint' }, { status: 409 });
    if (/CHECK constraint failed/.test(message)) return Response.json({ code: '23514', details: null, hint: null, message: 'new row violates check constraint' }, { status: 400 });
    if (/NOT NULL constraint failed/.test(message)) return Response.json({ code: '23502', details: null, hint: null, message: 'null value violates not-null constraint' }, { status: 400 });
    if (error instanceof SyntaxError) return Response.json({ code: 'PGRST102', details: null, hint: null, message: 'Empty or invalid json' }, { status: 400 });
    console.error(error);
    return Response.json({ code: 'XX000', details: null, hint: null, message: 'Internal error' }, { status: 500 });
  }
}

export default {
  fetch: handle,
  /**
   * Every minute: transactions a Worker never finished, the releases due by
   * their schedule (pg_cron's two jobs), then whatever a request's after-write
   * step missed.
   */
  async scheduled(_controller: unknown, env: Env): Promise<void> {
    await recoverTransactions(env.DB);
    await publishDueMusicReleases(env).catch((error) => console.error('Publishing due music releases:', error));
    await publishDueLearningReleases(env).catch((error) => console.error('Publishing due learning releases:', error));
    await afterWrites(env);
  },
};
