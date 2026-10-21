/**
 * Reads Supabase through its REST API, read-only: GET requests with the
 * app's public anon key, so nothing here can write, whatever it asks for. A
 * table anon can't read needs SUPABASE_SERVICE_ROLE_KEY (still only GETs).
 * Phase 1's copy only: D1 is the content master, and the repository's .env no
 * longer holds Supabase's address or key, so they are given in the environment
 * when this is run, and read only then (the tests load these scripts).
 */
import { loadEnv } from './env.ts';
import type { TableInfo } from './schema.ts';

/** Supabase's address and keys, from the environment, when a read needs them. */
function source(): { url: string; anonKey: string; serviceKey: string } {
  const env = loadEnv();
  const url = env('EXPO_PUBLIC_SUPABASE_URL').replace(/\/+$/, '');
  const anonKey = env('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  if (!url || !anonKey) throw new Error('EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are needed in the environment.');
  return { url, anonKey, serviceKey: env('SUPABASE_SERVICE_ROLE_KEY') };
}

const PAGE = 1000; // PostgREST's max-rows on this project
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A table this key can't read over REST; import leaves it as it is and says why. */
export class NotReadable extends Error {}

async function get(path: string, schema: string, key: string, headers: Record<string, string> = {}): Promise<Response> {
  for (let attempt = 0; ; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(`${source().url}/rest/v1/${path}`, {
        // Accept-Profile picks the schema; without it PostgREST looks in
        // graphql_public first on this project and finds nothing.
        headers: { apikey: key, authorization: `Bearer ${key}`, 'accept-profile': schema, ...headers },
      });
    } catch (error) {
      if (attempt >= 5) throw error;
      await sleep(500 * 2 ** attempt);
      continue;
    }
    if (response.ok) return response;
    const text = await response.text();
    // 42501: no grant to this role. PGRST106: the schema isn't exposed by the
    // REST API at all (aspasmos, fractions and procession_of_the_cross).
    if (text.includes('"42501"')) throw new NotReadable(`${schema}.${path.split('?')[0]}: no SELECT grant for this key`);
    if (text.includes('"PGRST106"')) throw new NotReadable(`${schema}.${path.split('?')[0]}: schema not exposed by the REST API`);
    if (attempt >= 5 || (response.status < 500 && response.status !== 429)) throw new Error(`GET ${schema}/${path} failed (${response.status}): ${text.slice(0, 300)}`);
    await sleep(500 * 2 ** attempt);
  }
}

/** The PostgREST select list: jsonb as Postgres prints it, and every number also as text, so import can prove it survives the move to REAL unchanged. */
function selectList(table: TableInfo): string {
  return table.columns.map((column) => {
    if (column.kind === 'jsonb') return `${column.name}:${column.name}::text`;
    if (column.kind === 'numeric' || column.kind === 'float8' || column.kind === 'float4') return `${column.name},${column.name}__raw:${column.name}::text`;
    return column.name;
  }).join(',');
}

export type SourceRow = Record<string, unknown>;

/** Every row of a table, in row-key order, a page at a time; the page count is checked against Postgres's own count. */
export async function readTable(table: TableInfo): Promise<SourceRow[]> {
  const { anonKey, serviceKey } = source();
  const key = table.public || !serviceKey ? anonKey : serviceKey;
  const order = table.rowKey.map((name) => `${name}.asc`).join(',');
  const rows: SourceRow[] = [];
  let total: number | null = null;
  for (let offset = 0; ; offset += PAGE) {
    const response = await get(`${table.table}?select=${selectList(table)}&order=${order}&limit=${PAGE}&offset=${offset}`, table.schema, key, offset === 0 ? { prefer: 'count=exact' } : {});
    if (offset === 0) total = Number(response.headers.get('content-range')?.split('/')[1]);
    const page = (await response.json()) as SourceRow[];
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  if (total !== rows.length) throw new Error(`${table.schema}.${table.table}: Postgres counts ${total} rows, ${rows.length} were read`);
  return rows;
}
