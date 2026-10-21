/**
 * cv-api: sign-in and the user data for Coptic Vine, CV-Admin and CV-Artists
 * (Phase 2 of docs/coptic-vine-d1-plan.md), at https://api.copticvine.ca.
 *
 *   /auth/*     Better Auth (src/auth)
 *   /health     whether the Worker and D1 answer
 *
 * The user-data API (the RPCs and tables the apps call on Supabase today)
 * comes next, under /rest/v1 like the content Worker's.
 *
 * Browsers: the web apps on copticvine.ca call here with their cookie
 * (same-site), so CORS answers trusted http(s) origins by name, with
 * credentials, and exposes set-auth-token for clients that keep a bearer
 * token instead.
 */
import { createAuth, list, type Auth } from './auth/index.ts';
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
  if (url.pathname === '/health') {
    const db = await env.DB.prepare('SELECT 1 AS ok').first<{ ok: number }>();
    return withHeaders(Response.json({ ok: db?.ok === 1 }, { headers: { 'cache-control': 'no-store' } }), corsHeaders);
  }
  return withHeaders(Response.json({ code: 'PGRST125', message: 'Not found', details: null, hint: null }, { status: 404 }), corsHeaders);
}

export default { fetch: handle };
