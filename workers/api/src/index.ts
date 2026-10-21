/**
 * cv-api: sign-in and the user data for Coptic Vine, CV-Admin and CV-Artists
 * (Phase 2 of docs/coptic-vine-d1-plan.md), at https://api.copticvine.ca.
 *
 *   /auth/*                       Better Auth (src/auth)
 *   POST /rest/v1/rpc/<function>  the database functions the apps call (src/rpc)
 *   /rest/v1/<table>              the tables they read and write directly (src/rest/tables.ts)
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
import { createAuth, list, type Auth } from './auth/index.ts';
import { httpStatus, PgError } from './pg.ts';
import type { ApiContext } from './rest/context.ts';
import { tableRequest } from './rest/tables.ts';
import { callRpc } from './rpc/index.ts';
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
    'access-control-allow-headers': 'accept, authorization, content-type, x-client-info, apikey, accept-profile, content-profile, prefer, range',
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

export async function handle(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const corsHeaders = cors(request, env);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  if (url.pathname === '/auth' || url.pathname.startsWith('/auth/')) {
    return withHeaders(await auth(env).handler(request), corsHeaders);
  }
  if (url.pathname.startsWith('/rest/v1/')) {
    return withHeaders(await rest(request, url, env), corsHeaders);
  }
  if (url.pathname === '/health') {
    const db = await env.DB.prepare('SELECT 1 AS ok').first<{ ok: number }>();
    return withHeaders(Response.json({ ok: db?.ok === 1 }, { headers: { 'cache-control': 'no-store' } }), corsHeaders);
  }
  return withHeaders(Response.json({ code: 'PGRST125', message: 'Not found', details: null, hint: null }, { status: 404 }), corsHeaders);
}

async function rest(request: Request, url: URL, env: Env): Promise<Response> {
  let ctx: ApiContext | null = null;
  try {
    const session = await auth(env).api.getSession({ headers: request.headers });
    ctx = { db: env.DB, env, userId: session?.user.id ?? null };
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
    const message = (error as Error).message ?? String(error);
    // D1's constraint failures, as Postgres would report them.
    if (/UNIQUE constraint failed/.test(message)) return Response.json({ code: '23505', details: null, hint: null, message: 'duplicate key value violates unique constraint' }, { status: 409 });
    if (/FOREIGN KEY constraint failed/.test(message)) return Response.json({ code: '23503', details: null, hint: null, message: 'insert or update on table violates foreign key constraint' }, { status: 409 });
    if (/CHECK constraint failed/.test(message)) return Response.json({ code: '23514', details: null, hint: null, message: 'new row violates check constraint' }, { status: 400 });
    if (/NOT NULL constraint failed/.test(message)) return Response.json({ code: '23502', details: null, hint: null, message: 'null value violates not-null constraint' }, { status: 400 });
    if (error instanceof SyntaxError) return Response.json({ code: 'PGRST102', details: null, hint: null, message: 'Empty or invalid json' }, { status: 400 });
    console.error(error);
    return Response.json({ code: 'XX000', details: null, hint: null, message: 'Internal error' }, { status: 500 });
  }
}

export default { fetch: handle };
