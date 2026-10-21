/**
 * /rest/v1/<table>: the user tables the apps read and write directly, the way
 * PostgREST serves them from Supabase, with Supabase's row-level security
 * written out here (docs/d1/phase2-inventory.md):
 *
 *   GET     select=a,b  eq, neq, gt, gte, lt, lte, in, is (and not.<op>)  order  limit  offset
 *   POST    insert, or upsert with Prefer: resolution=merge-duplicates|ignore-duplicates and on_conflict
 *   PATCH   update the rows the filters match
 *   DELETE  delete the rows the filters match
 *   Prefer: return=representation   the written rows back (otherwise nothing)
 *
 * Every one of these tables belongs to its user: only the signed-in user's
 * rows are read, written or deleted, a row written for anyone else is
 * refused, and signed-out requests are refused, as the policies "<table>_*_own"
 * (auth.uid() = user_id) and the grants (to authenticated only) do. The user
 * comes from the session, never from the request.
 */
import { col, t } from '../../../content-api/src/db/names.ts';
import { parseList } from '../../../content-api/src/rest/rows.ts';
import schema from '../../schema/user-tables.json' with { type: 'json' };
import type { UserTable } from '../../scripts/gen-schema.ts';
import { jsonbText, PgError, timestampInput } from '../pg.ts';
import type { ApiContext } from './context.ts';

type Column = UserTable['columns'][number];
type Row = Record<string, unknown>;

/** The tables served, with what Supabase grants on each (a column list where the grant is per column). */
const SERVED: Record<string, { select: boolean; insert: boolean; update: boolean | string[]; delete: boolean }> = {
  'public/notification_preferences': { select: true, insert: true, update: true, delete: true },
  'public/notifications': { select: true, insert: false, update: ['read_at'], delete: false },
  'public/spiritual_canons': { select: true, insert: true, update: true, delete: true },
  'public/spiritual_canon_days': { select: true, insert: true, update: true, delete: true },
  'public/bible_highlights': { select: true, insert: true, update: true, delete: true },
  'public/sermon_plans': { select: true, insert: true, update: true, delete: true },
};
const OWNER = 'user_id';

const tables = new Map((schema as { tables: UserTable[] }).tables.map((table) => [`${table.schema}/${table.table}`, table]));

function denied(table: UserTable, ctx: ApiContext, what = 'table'): PgError {
  return new PgError('42501', `permission denied for ${what} ${table.table}`, ctx.userId ? 403 : 401);
}

function findColumn(table: UserTable, name: string): Column {
  const column = table.columns.find((candidate) => candidate.name === name);
  if (!column) throw new PgError('42703', `column ${table.table}.${name} does not exist`);
  return column;
}

/** A value from the client as D1 stores the column. */
export function input(column: Column, value: unknown): unknown {
  if (value === null || value === undefined) return null;
  switch (column.kind) {
    case 'timestamptz': return timestampInput(value, column.name);
    case 'jsonb': return jsonbText(value);
    case 'array':
      if (!Array.isArray(value)) throw new PgError('22P02', `malformed array literal: "${String(value)}"`);
      return JSON.stringify(value);
    case 'boolean':
      if (typeof value === 'boolean') return value ? 1 : 0;
      if (value === 'true' || value === 'false') return value === 'true' ? 1 : 0;
      throw new PgError('22P02', `invalid input syntax for type boolean: "${String(value)}"`);
    case 'integer': {
      const number = typeof value === 'number' ? value : Number(value);
      if (!Number.isInteger(number)) throw new PgError('22P02', `invalid input syntax for type integer: "${String(value)}"`);
      return number;
    }
    case 'date':
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new PgError('22007', `invalid input syntax for type date: "${String(value)}"`);
      return value;
    default: return typeof value === 'string' ? value : String(value);
  }
}

/** A stored value as PostgREST's JSON gives it. */
export function output(column: Column, value: unknown): unknown {
  if (value === null || value === undefined) return null;
  switch (column.kind) {
    case 'jsonb': case 'array': return JSON.parse(value as string);
    case 'boolean': return value === 1 || value === true;
    default: return value;
  }
}

/** A filter value from the query string, as D1 stores the column. */
function filterValue(column: Column, raw: string): unknown {
  if (column.kind === 'boolean') return raw === 'true' ? 1 : raw === 'false' ? 0 : input(column, raw);
  if (column.kind === 'integer' || column.kind === 'float4') return Number(raw);
  if (column.kind === 'timestamptz') return timestampInput(raw, column.name);
  return raw;
}

const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'columns', 'on_conflict']);
const COMPARE: Record<string, string> = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=' };

/** The query string's filters as SQL, ANDed. */
function whereClause(table: UserTable, params: URLSearchParams): { sql: string[]; values: unknown[] } {
  const sql: string[] = [];
  const values: unknown[] = [];
  for (const [name, raw] of params) {
    if (RESERVED.has(name)) continue;
    if (name === 'or' || name === 'and' || name.includes('.')) throw new PgError('PGRST100', `unsupported filter ${name}`, 400);
    const column = findColumn(table, name);
    const match = raw.match(/^(not\.)?([a-z]+)\.([\s\S]*)$/);
    if (!match) throw new PgError('PGRST100', `"failed to parse filter (${raw})"`, 400);
    const [, not, op, value] = match;
    let condition: string;
    if (op in COMPARE) {
      condition = `${col(column.name)} ${COMPARE[op]} ?`;
      values.push(filterValue(column, value));
    } else if (op === 'in') {
      condition = `${col(column.name)} IN (SELECT value FROM json_each(?))`;
      values.push(JSON.stringify(parseList(value).map((item) => filterValue(column, item))));
    } else if (op === 'is') {
      const known: Record<string, string> = { null: 'IS NULL', true: '= 1', false: '= 0', unknown: 'IS NULL' };
      if (!(value in known)) throw new PgError('PGRST100', `"failed to parse filter (${raw})"`, 400);
      condition = `${col(column.name)} ${known[value]}`;
    } else {
      throw new PgError('PGRST100', `"failed to parse filter (${raw})"`, 400);
    }
    sql.push(not ? `NOT (${condition})` : condition);
  }
  return { sql, values };
}

function selectList(table: UserTable, select: string | null): { output: string; column: Column }[] {
  if (!select || select.trim() === '*') return table.columns.map((column) => ({ output: column.name, column }));
  return select.split(',').map((part) => part.trim()).filter(Boolean).flatMap((part) => {
    if (part === '*') return table.columns.map((column) => ({ output: column.name, column }));
    const match = part.match(/^(?:([A-Za-z_]\w*):)?([A-Za-z_]\w*)$/);
    if (!match) throw new PgError('PGRST100', `"failed to parse select parameter (${select})"`, 400);
    return [{ output: match[1] ?? match[2], column: findColumn(table, match[2]) }];
  });
}

function orderBy(table: UserTable, order: string | null): string {
  if (!order) return '';
  const parts = order.split(',').map((part) => {
    const [name, ...modifiers] = part.trim().split('.');
    const column = findColumn(table, name);
    const descending = modifiers.includes('desc');
    // Postgres puts nulls last ascending and first descending, unless told otherwise.
    const nullsFirst = modifiers.includes('nullsfirst') || (descending && !modifiers.includes('nullslast'));
    return `${col(column.name)} IS NULL ${nullsFirst ? 'DESC' : 'ASC'}, ${col(column.name)} ${descending ? 'DESC' : 'ASC'}`;
  });
  return ` ORDER BY ${parts.join(', ')}`;
}

function shape(rows: Row[], selected: { output: string; column: Column }[]): Row[] {
  return rows.map((row) => Object.fromEntries(selected.map(({ output: name, column }) => [name, output(column, row[column.name])])));
}

function preferences(request: Request): Set<string> {
  return new Set((request.headers.get('prefer') ?? '').split(',').map((part) => part.trim()).filter(Boolean));
}

/** A table request; null if the path isn't a served table. */
export async function tableRequest(request: Request, url: URL, profile: string, name: string, ctx: ApiContext): Promise<Response | null> {
  const key = `${profile}/${name}`;
  const table = tables.get(key);
  const grants = SERVED[key];
  if (!table || !grants) return null;
  if (!ctx.userId) throw denied(table, ctx);
  const params = url.searchParams;
  const prefer = preferences(request);
  const representation = prefer.has('return=representation');
  const selected = selectList(table, params.get('select'));
  const owner = `${col(OWNER)} = ?`;

  switch (request.method) {
    case 'GET': case 'HEAD': {
      if (!grants.select) throw denied(table, ctx);
      const where = whereClause(table, params);
      let sql = `SELECT ${selected.map(({ column }) => col(column.name)).join(', ')} FROM ${t(table.schema, table.table)} WHERE ${[owner, ...where.sql].join(' AND ')}${orderBy(table, params.get('order'))}`;
      const limit = params.get('limit');
      const offset = params.get('offset');
      if (limit != null) sql += ` LIMIT ${Math.max(0, Number.parseInt(limit, 10) || 0)}`;
      if (offset != null) sql += `${limit == null ? ' LIMIT -1' : ''} OFFSET ${Math.max(0, Number.parseInt(offset, 10) || 0)}`;
      const rows = (await ctx.db.prepare(sql).bind(ctx.userId, ...where.values).all<Row>()).results;
      return single(request, shape(rows, selected));
    }
    case 'POST': {
      if (!grants.insert) throw denied(table, ctx);
      const body = await request.json() as Row | Row[];
      const rows = Array.isArray(body) ? body : [body];
      if (!rows.length) return new Response(representation ? '[]' : null, { status: 201, headers: representation ? { 'content-type': 'application/json' } : {} });
      const names = params.get('columns')?.split(',').map((name) => name.replace(/"/g, '').trim()) ?? [...new Set(rows.flatMap((row) => Object.keys(row)))];
      const columns = names.map((name) => findColumn(table, name));
      const conflict = params.get('on_conflict')?.split(',').map((name) => findColumn(table, name.trim())) ?? null;
      const merge = prefer.has('resolution=merge-duplicates');
      const ignore = prefer.has('resolution=ignore-duplicates');
      const written: Row[] = [];
      for (const row of rows) {
        // WITH CHECK (auth.uid() = user_id): the row has to be the user's own.
        if (row[OWNER] !== undefined && row[OWNER] !== ctx.userId) throw new PgError('42501', `new row violates row-level security policy for table "${table.table}"`, 403);
        const values = columns.map((column) => (column.name === OWNER ? ctx.userId : input(column, row[column.name])));
        const insertColumns = columns.some((column) => column.name === OWNER) ? columns : [...columns, findColumn(table, OWNER)];
        if (insertColumns.length !== columns.length) values.push(ctx.userId);
        let sql = `INSERT INTO ${t(table.schema, table.table)} (${insertColumns.map((column) => col(column.name)).join(', ')}) VALUES (${insertColumns.map(() => '?').join(', ')})`;
        if (merge || ignore) {
          const target = conflict ?? table.primaryKey.map((name) => findColumn(table, name));
          const updates = columns.filter((column) => !target.some((key) => key.name === column.name));
          sql += ` ON CONFLICT (${target.map((column) => col(column.name)).join(', ')}) DO ${ignore || !updates.length ? 'NOTHING' : `UPDATE SET ${updates.map((column) => `${col(column.name)} = excluded.${col(column.name)}`).join(', ')} WHERE ${t(table.schema, table.table)}.${col(OWNER)} = excluded.${col(OWNER)}`}`;
        }
        const result = await ctx.db.prepare(`${sql} RETURNING *`).bind(...values).first<Row>();
        if (result) written.push(result);
      }
      if (!representation) return new Response(null, { status: 201 });
      return single(request, shape(written, selected), 201);
    }
    case 'PATCH': {
      const body = await request.json() as Row;
      const columns = Object.keys(body).map((name) => findColumn(table, name));
      const allowed = grants.update;
      if (!allowed || (Array.isArray(allowed) && columns.some((column) => !allowed.includes(column.name)))) throw denied(table, ctx);
      if (body[OWNER] !== undefined && body[OWNER] !== ctx.userId) throw new PgError('42501', `new row violates row-level security policy for table "${table.table}"`, 403);
      const where = whereClause(table, params);
      if (!columns.length) return new Response(null, { status: 204 });
      const sql = `UPDATE ${t(table.schema, table.table)} SET ${columns.map((column) => `${col(column.name)} = ?`).join(', ')} WHERE ${[owner, ...where.sql].join(' AND ')} RETURNING *`;
      const rows = (await ctx.db.prepare(sql).bind(...columns.map((column) => input(column, body[column.name])), ctx.userId, ...where.values).all<Row>()).results;
      if (!representation) return new Response(null, { status: 204 });
      return single(request, shape(rows, selected));
    }
    case 'DELETE': {
      if (!grants.delete) throw denied(table, ctx);
      const where = whereClause(table, params);
      const rows = (await ctx.db.prepare(`DELETE FROM ${t(table.schema, table.table)} WHERE ${[owner, ...where.sql].join(' AND ')} RETURNING *`).bind(ctx.userId, ...where.values).all<Row>()).results;
      if (!representation) return new Response(null, { status: 204 });
      return single(request, shape(rows, selected));
    }
    default:
      throw new PgError('PGRST117', `Unsupported HTTP method: ${request.method}`, 405);
  }
}

/** Rows as JSON, or one object when supabase-js asks for it (.single()), as PostgREST does. */
function single(request: Request, rows: Row[], status = 200): Response {
  if ((request.headers.get('accept') ?? '').includes('application/vnd.pgrst.object+json')) {
    if (rows.length !== 1) throw new PgError('PGRST116', 'Cannot coerce the result to a single JSON object', 406, `The result contains ${rows.length} rows`);
    return Response.json(rows[0], { status });
  }
  return Response.json(rows, { status });
}
