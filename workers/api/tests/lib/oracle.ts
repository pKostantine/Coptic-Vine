/**
 * The parity oracle: Supabase's own user schemas and functions, running in
 * PGlite (Postgres compiled to WebAssembly), so the Worker's ports can be
 * compared with the originals, writes included, without touching Supabase.
 *
 * schema/pg-user-schema.sql is the DDL of creator, learning, media, music,
 * private and public (schema/pg-schema-dump.sql, structure only). What
 * Supabase provides around it is stood in for here: the anon and
 * authenticated roles; auth.users and auth.uid()/role()/jwt(), read from the
 * same request settings PostgREST sets; the extensions schema (pg_trgm,
 * unaccent, pgcrypto, uuid-ossp); and net.http_post, which records the call
 * instead of making it.
 *
 * call() runs a function the way PostgREST does: as anon or authenticated,
 * with the user's id in request.jwt.claim.sub, named arguments, and the
 * answer shaped as PostgREST shapes it (a scalar, a row array, or null).
 */
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { unaccent } from '@electric-sql/pglite/contrib/unaccent';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';

type CatalogColumn = { name: string; type: string; notNull: boolean; default: string | null; generated: boolean };
type CatalogRelation = { schema: string; table: string; columns: CatalogColumn[] };

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

function authUsersTable(): string {
  const catalog = JSON.parse(read('../../schema/pg-catalog-users.json')) as { relations: CatalogRelation[] };
  const users = catalog.relations.find((relation) => relation.schema === 'auth' && relation.table === 'users')!;
  const columns = users.columns.map((column) => {
    if (column.generated) return `${JSON.stringify(column.name)} ${column.type} generated always as (${column.default}) stored`;
    let line = `${JSON.stringify(column.name)} ${column.type}`;
    if (column.name === 'id') line += ' primary key';
    if (column.default && !/nextval|auth\./.test(column.default)) line += ` default ${column.default}`;
    return line;
  });
  return `create table auth.users (${columns.join(', ')});`;
}

const SETUP = () => `
create schema extensions;
create extension pg_trgm schema extensions;
create extension unaccent schema extensions;
create extension pgcrypto schema extensions;
create extension "uuid-ossp" schema extensions;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant usage on schema extensions to anon, authenticated, service_role;
create schema auth;
${authUsersTable()}
create table auth.identities (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, provider text not null, provider_id text not null, identity_data jsonb not null default '{}', created_at timestamptz default now(), updated_at timestamptz default now());
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
create schema net;
create table net.http_requests (id bigserial primary key, url text, body jsonb, headers jsonb, requested_at timestamptz default now());
create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds integer default 5000)
  returns bigint language sql as $$ insert into net.http_requests (url, body, headers) values (url, body, headers) returning id $$;
`;

const ISSUER = 'https://wtuujmeinzqfikvuofmh.supabase.co/auth/v1';

export type PgAnswer = { data: unknown; error: { code: string; message: string; details: string | null; hint: string | null } | null };

export type Oracle = {
  pg: PGlite;
  /** Statements of the dump that didn't load, with why. */
  failures: { statement: string; error: string }[];
  /** A function called as PostgREST calls it, as the user (or anon with null). */
  call(user: string | null, fn: string, args?: Record<string, unknown>, schema?: string): Promise<PgAnswer>;
  /** SQL as the user would run it through PostgREST: as anon or authenticated, so row-level security and grants apply. */
  asUser<T = Record<string, unknown>>(user: string | null, query: string, params?: unknown[]): Promise<{ rows: T[]; error: PgAnswer['error'] }>;
  /** SQL as the database owner (seeding, inspecting). */
  sql<T = Record<string, unknown>>(query: string, params?: unknown[]): Promise<T[]>;
  /** Creates a signed-up user in auth.users. */
  addUser(id: string, email: string, meta?: Record<string, unknown>): Promise<void>;
  close(): Promise<void>;
};

let cachedSchema: string[] | null = null;

export type OracleOptions = {
  /**
   * Give authenticated USAGE on schema private, as Supabase had it until
   * 21 Sept 2026. Migration 20260921221500 revoked it, and since then the
   * SECURITY INVOKER functions that call private.* by name (adding, removing,
   * reordering and deleting playlist tracks and playlists among them) fail
   * in production with "permission denied for schema private". The Worker
   * implements the working behaviour, so its parity tests compare with this.
   */
  privateUsage?: boolean;
};

export async function createOracle(options: OracleOptions = {}): Promise<Oracle> {
  const pg = await PGlite.create({ extensions: { pg_trgm, unaccent, pgcrypto, uuid_ossp } });
  await pg.exec(SETUP());
  // Supabase's database and PostgREST work in UTC.
  await pg.exec("set check_function_bodies = off; set search_path = public, extensions; set timezone = 'UTC';");
  cachedSchema ??= read('../../schema/pg-user-schema.sql').split('\n--;;\n');
  const failures: Oracle['failures'] = [];
  for (const statement of cachedSchema) {
    let body = statement.replace(/^--[^\n]*\n/gm, '').trim();
    // Supabase's database collates text with ICU en-US; PGlite's default is C. ICU's root
    // collation (und-x-icu) orders as en-US does, so every text column gets it.
    if (body.startsWith('create table ')) body = body.replace(/ (text|character varying(?:\(\d+\))?)(?=( not null)?(, |\);$))/g, ' $1 collate "und-x-icu"');
    if (!body) continue;
    try {
      await pg.exec(body);
    } catch (error) {
      failures.push({ statement: body.slice(0, 160), error: (error as Error).message });
    }
  }
  // Postgres grants EXECUTE to everyone by default; Supabase's grants are in the dump.
  for (const schema of ['creator', 'learning', 'media', 'music', 'private', 'public']) {
    await pg.exec(`revoke execute on all functions in schema ${schema} from public`);
  }
  const grants = cachedSchema.filter((statement) => /^grant execute on function/.test(statement.trim()));
  for (const grant of grants) await pg.exec(grant).catch(() => undefined);
  if (options.privateUsage) await pg.exec('grant usage on schema private to authenticated');

  const shapes = new Map<string, { retset: boolean; scalar: boolean; isVoid: boolean; arrays: Set<string>; json: Set<string> }>();
  const shape = async (schema: string, fn: string) => {
    const key = `${schema}.${fn}`;
    if (!shapes.has(key)) {
      const rows = (await pg.query<{ retset: boolean; typtype: string; typname: string; arrays: string[] | null; json: string[] | null }>(
        `select p.proretset as retset, t.typtype, t.typname,
           (select array_agg(name) from unnest(p.proargnames, p.proargtypes::oid[]) a(name, type) join pg_type at on at.oid = a.type where at.typcategory = 'A') as arrays,
           (select array_agg(name) from unnest(p.proargnames, p.proargtypes::oid[]) a(name, type) join pg_type at on at.oid = a.type where at.typname in ('json', 'jsonb')) as json
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_type t on t.oid = p.prorettype where n.nspname = $1 and p.proname = $2 limit 1`, [schema, fn])).rows;
      if (!rows.length) throw new Error(`No function ${key}`);
      const { retset, typtype, typname, arrays, json } = rows[0];
      shapes.set(key, { retset, scalar: typtype !== 'c' && typname !== 'record', isVoid: typname === 'void', arrays: new Set(arrays ?? []), json: new Set(json ?? []) });
    }
    return shapes.get(key)!;
  };

  return {
    pg,
    failures,
    async call(user, fn, args = {}, schema = 'public') {
      const { retset, scalar, isVoid, arrays, json } = await shape(schema, fn);
      const names = Object.keys(args);
      const call = `${JSON.stringify(schema)}.${JSON.stringify(fn)}(${names.map((name, i) => `${JSON.stringify(name)} := $${i + 1}`).join(', ')})`;
      // As PostgREST: the whole answer is built as JSON by Postgres.
      const query = retset || !scalar
        ? `select coalesce(json_agg(r), '[]'::json) as result from ${call} r`
        : `select to_json(${call}) as result`;
      const role = user ? 'authenticated' : 'anon';
      // As Supabase's tokens: the issuer is the project's auth URL (playlist covers read it).
      const claims = JSON.stringify(user ? { sub: user, role, iss: ISSUER } : { role });
      try {
        const result = await pg.transaction(async (tx) => {
          await tx.query(`select set_config('role', $1, true), set_config('request.jwt.claim.sub', $2, true), set_config('request.jwt.claim.role', $1, true), set_config('request.jwt.claims', $3, true)`, [role, user ?? '', claims]);
          // As PostgREST: a JSON list for an array parameter becomes a Postgres array; a json or jsonb
          // parameter takes the JSON value itself (a string stays a JSON string); other objects are json.
          const values = names.map((name) => (args[name] !== null && (json.has(name) || (typeof args[name] === 'object' && !(arrays.has(name) && Array.isArray(args[name])))) ? JSON.stringify(args[name]) : args[name]));
          return (await tx.query<{ result: unknown }>(query, values)).rows[0].result;
        });
        let data = result;
        if (!retset && !scalar && Array.isArray(data)) data = data[0] ?? null;
        return { data: isVoid ? null : data, error: null };
      } catch (error) {
        const e = error as { code?: string; message: string; detail?: string; hint?: string };
        return { data: null, error: { code: e.code ?? 'XX000', message: e.message, details: e.detail ?? null, hint: e.hint ?? null } };
      }
    },
    async asUser(user, query, params = []) {
      const role = user ? 'authenticated' : 'anon';
      const claims = JSON.stringify(user ? { sub: user, role, iss: ISSUER } : { role });
      try {
        const rows = await pg.transaction(async (tx) => {
          await tx.query(`select set_config('role', $1, true), set_config('request.jwt.claim.sub', $2, true), set_config('request.jwt.claim.role', $1, true), set_config('request.jwt.claims', $3, true)`, [role, user ?? '', claims]);
          return (await tx.query(query, params)).rows;
        });
        return { rows: rows as never, error: null };
      } catch (error) {
        const e = error as { code?: string; message: string; detail?: string; hint?: string };
        return { rows: [], error: { code: e.code ?? 'XX000', message: e.message, details: e.detail ?? null, hint: e.hint ?? null } };
      }
    },
    async sql(query, params = []) {
      return (await pg.query(query, params)).rows as never;
    },
    async addUser(id, email, meta = {}) {
      await pg.query(`insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at, email_confirmed_at, aud, role) values ($1, $2, $3, '{"provider":"email"}', now(), now(), now(), 'authenticated', 'authenticated')`, [id, email, JSON.stringify(meta)]);
    },
    close: () => pg.close(),
  };
}
