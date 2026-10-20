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
 */
import { readRows } from './rest/rows.ts';
import { callRpc } from './rpc/index.ts';
import { PgError } from './pg.ts';
import type { ContentContext, Env } from './types.ts';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, HEAD, POST, OPTIONS',
  'access-control-allow-headers': 'accept, accept-profile, apikey, authorization, content-profile, content-type, prefer, range, x-client-info, x-church-id, x-supabase-api-version',
  'access-control-expose-headers': 'content-range',
  'access-control-max-age': '86400',
};

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...CORS, ...headers } });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function churchOf(request: Request, url: URL): string | null {
  const value = request.headers.get('x-church-id') ?? url.searchParams.get('church_id');
  if (value === null || value === '') return null;
  if (!UUID.test(value)) throw new PgError('PGRST100', 'church_id must be a UUID', 400);
  return value.toLowerCase();
}

export async function handle(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (url.pathname === '/health') return json({ ok: true });
  try {
    const churchId = churchOf(request, url);
    url.searchParams.delete('church_id');
    const context: ContentContext = { db: env.CONTENT_DB, churchId };

    const rpc = url.pathname.match(/^\/rest\/v1\/rpc\/([a-z_][a-z0-9_]*)$/);
    if (rpc) {
      if (request.method !== 'POST') throw new PgError('PGRST117', `Unsupported HTTP method: ${request.method}`, 405);
      const schema = request.headers.get('content-profile') || 'public';
      const text = await request.text();
      let body: unknown = {};
      if (text.trim()) {
        try { body = JSON.parse(text); } catch { throw new PgError('PGRST102', 'Empty or invalid json', 400); }
      }
      return json(await callRpc(context, schema, rpc[1], body));
    }

    const table = url.pathname.match(/^\/rest\/v1\/([a-z_][a-z0-9_]*)$/);
    if (table) {
      if (request.method !== 'GET' && request.method !== 'HEAD') throw new PgError('PGRST117', 'Content is read-only', 405);
      const schema = request.headers.get('accept-profile') || 'public';
      const { body, range } = await readRows(context, schema, table[1], url, request.headers.get('accept') ?? '');
      const response = json(body, 200, { 'content-range': range });
      return request.method === 'HEAD' ? new Response(null, response) : response;
    }

    return json({ code: 'PGRST125', details: null, hint: null, message: `Invalid path specified in request URL` }, 404);
  } catch (error) {
    if (error instanceof PgError) return json(error.body(), error.status);
    console.error(error);
    return json({ code: 'XX000', details: null, hint: null, message: 'Internal error' }, 500);
  }
}

export default { fetch: handle };
