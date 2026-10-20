/**
 * GET /rest/v1/<table> with Accept-Profile: <schema>, answered from D1 the way
 * PostgREST answers it from Postgres, for the queries the app's supabase-js
 * client sends (src/services/contentDataClient.ts):
 *
 *   select=a,b,alias:c | *        eq, neq, gt, gte, lt, lte, in, is, like, ilike (and not.<op>)
 *   order=a.asc,b.desc[.nullsfirst|.nullslast]   limit, offset
 *   Accept: application/vnd.pgrst.object+json   (supabase-js .single())
 *
 * Only tables the anon role can read in Supabase are served. Rows come back
 * in Postgres's order: text sorts by ICU en-US as the database collates it,
 * enums by their declared order, nulls last ascending and first descending.
 * like and ilike are matched here rather than in SQLite, whose LIKE folds
 * case for ASCII only.
 */
import { contentTable, enumOrder, hasSchema, type Column, type Table } from '../content.ts';
import { col, t } from '../db/names.ts';
import { compareText, PgError } from '../pg.ts';
import type { ContentContext, Row } from '../types.ts';

type Op = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'is' | 'like' | 'ilike';
type Filter = { column: Column; op: Op; negate: boolean; value: string };
type Ordering = { column: Column; ascending: boolean; nullsFirst: boolean };
type Selected = { output: string; column: Column };

const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'columns', 'on_conflict']);
const OPS = new Set<Op>(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'is', 'like', 'ilike']);

function findColumn(table: Table, name: string): Column {
  const column = table.columns.find((candidate) => candidate.name === name);
  if (!column) throw new PgError('42703', `column ${table.table}.${name} does not exist`);
  return column;
}

function parseSelect(table: Table, select: string | null): Selected[] {
  if (!select || select.trim() === '*') return table.columns.map((column) => ({ output: column.name, column }));
  return select.split(',').map((part) => part.trim()).filter(Boolean).flatMap((part) => {
    if (part === '*') return table.columns.map((column) => ({ output: column.name, column }));
    const match = part.match(/^(?:([A-Za-z_][\w]*):)?([A-Za-z_][\w]*)$/);
    if (!match) throw new PgError('PGRST100', `"failed to parse select parameter (${select})"`, 400);
    return [{ output: match[1] ?? match[2], column: findColumn(table, match[2]) }];
  });
}

/** PostgREST's in.(a,b,"c,d") list: comma-separated, items optionally double-quoted with backslash escapes. */
export function parseList(raw: string): string[] {
  const inner = raw.match(/^\((.*)\)$/s)?.[1];
  if (inner === undefined) throw new PgError('PGRST100', `"failed to parse filter (in.${raw})"`, 400);
  if (inner === '') return [];
  const items: string[] = [];
  let i = 0;
  while (i <= inner.length) {
    if (inner[i] === '"') {
      let value = '';
      i += 1;
      while (i < inner.length && inner[i] !== '"') {
        if (inner[i] === '\\' && i + 1 < inner.length) i += 1;
        value += inner[i];
        i += 1;
      }
      items.push(value);
      i += 2; // closing quote and comma
    } else {
      const end = inner.indexOf(',', i);
      items.push(inner.slice(i, end < 0 ? inner.length : end).trim());
      i = end < 0 ? inner.length + 1 : end + 1;
    }
  }
  return items;
}

function parseFilters(table: Table, params: URLSearchParams): Filter[] {
  const filters: Filter[] = [];
  for (const [name, raw] of params) {
    if (RESERVED.has(name)) continue;
    if (name === 'or' || name === 'and' || name.includes('.')) throw new PgError('PGRST100', `unsupported filter ${name}`, 400);
    const column = findColumn(table, name);
    const match = raw.match(/^(not\.)?([a-z]+)\.([\s\S]*)$/);
    if (!match || !OPS.has(match[2] as Op)) throw new PgError('PGRST100', `"failed to parse filter (${raw})"`, 400);
    filters.push({ column, op: match[2] as Op, negate: Boolean(match[1]), value: match[3] });
  }
  return filters;
}

function parseOrder(table: Table, order: string | null): Ordering[] {
  if (!order) return [];
  return order.split(',').map((part) => {
    const [name, ...modifiers] = part.trim().split('.');
    const ascending = !modifiers.includes('desc');
    const nullsFirst = modifiers.includes('nullsfirst') ? true : modifiers.includes('nullslast') ? false : !ascending;
    return { column: findColumn(table, name), ascending, nullsFirst };
  });
}

/** A filter value as the column's type, as Postgres would cast the text PostgREST passes it. */
function typed(column: Column, text: string): string | number {
  switch (column.kind) {
    case 'integer': {
      if (!/^\s*[+-]?\d+\s*$/.test(text)) throw new PgError('22P02', `invalid input syntax for type ${column.pgType === 'bigint' ? 'bigint' : 'integer'}: "${text}"`);
      return Number(text);
    }
    case 'numeric': case 'float8': case 'float4': {
      const number = Number(text);
      if (text.trim() === '' || !Number.isFinite(number)) throw new PgError('22P02', `invalid input syntax for type ${column.pgType}: "${text}"`);
      return number;
    }
    case 'boolean': {
      const value = text.trim().toLowerCase();
      if (['t', 'true', 'y', 'yes', 'on', '1'].includes(value)) return 1;
      if (['f', 'false', 'n', 'no', 'off', '0'].includes(value)) return 0;
      throw new PgError('22P02', `invalid input syntax for type boolean: "${text}"`);
    }
    default: {
      const values = enumOrder(column);
      if (values && !values.includes(text)) throw new PgError('22P02', `invalid input value for enum ${column.pgType}: "${text}"`);
      return text;
    }
  }
}

/** A LIKE pattern (PostgREST also takes * for %) as a whole-string regular expression. */
function likeRegExp(pattern: string, caseInsensitive: boolean): RegExp {
  let source = '';
  for (let i = 0; i < pattern.length; i += 1) {
    const c = pattern[i];
    if (c === '\\' && i + 1 < pattern.length) { source += escapeRegExp(pattern[++i]); continue; }
    if (c === '%' || c === '*') source += '[\\s\\S]*';
    else if (c === '_') source += '[\\s\\S]';
    else source += escapeRegExp(c);
  }
  return new RegExp(`^${source}$`, caseInsensitive ? 'iu' : 'u');
}

const escapeRegExp = (c: string) => c.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

/** The SQL condition for a filter SQLite can apply exactly; like and ilike are left to matchesInJs. */
function sqlCondition(filter: Filter, params: unknown[]): string | null {
  const name = col(filter.column.name);
  let condition: string;
  switch (filter.op) {
    case 'like': case 'ilike': return null;
    case 'is': {
      const value = filter.value.toLowerCase();
      if (value === 'null') condition = `${name} IS NULL`;
      else if (value === 'true') condition = `${name} IS 1`;
      else if (value === 'false') condition = `${name} IS 0`;
      else if (value === 'unknown') condition = `${name} IS NULL`;
      else throw new PgError('PGRST100', `"failed to parse filter (is.${filter.value})"`, 400);
      break;
    }
    case 'in': {
      params.push(JSON.stringify(parseList(filter.value).map((item) => typed(filter.column, item))));
      condition = `${name} IN (SELECT value FROM json_each(?))`;
      break;
    }
    default: {
      params.push(typed(filter.column, filter.value));
      const sqlOp = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=' }[filter.op];
      // Text comparisons other than equality follow the database collation,
      // which SQLite doesn't have: those are checked in matchesInJs.
      if (filter.column.kind === 'text' && filter.op !== 'eq' && filter.op !== 'neq') { params.pop(); return null; }
      condition = `${name} ${sqlOp} ?`;
    }
  }
  return filter.negate ? `NOT (${condition})` : condition;
}

function matchesInJs(row: Row, filter: Filter): boolean {
  const value = row[filter.column.name];
  let result: boolean | null;
  if (value === null || value === undefined) result = null;
  else if (filter.op === 'like' || filter.op === 'ilike') result = likeRegExp(filter.value, filter.op === 'ilike').test(String(value));
  else {
    const order = compareValues(filter.column, value, filter.value);
    result = { gt: order > 0, gte: order >= 0, lt: order < 0, lte: order <= 0 }[filter.op as 'gt'] ?? null;
  }
  // As in SQL, a comparison with null is neither true nor false: never matched.
  if (result === null) return false;
  return filter.negate ? !result : result;
}

function compareValues(column: Column, a: unknown, b: unknown): number {
  const values = enumOrder(column);
  if (values) return values.indexOf(String(a)) - values.indexOf(String(b));
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return compareText(String(a), String(b));
}

function sortRows(rows: Row[], orderings: Ordering[]): void {
  rows.sort((left, right) => {
    for (const { column, ascending, nullsFirst } of orderings) {
      const a = left[column.name];
      const b = right[column.name];
      if (a == null || b == null) {
        if (a == null && b == null) continue;
        return (a == null) === nullsFirst ? -1 : 1;
      }
      const order = compareValues(column, a, b);
      if (order) return ascending ? order : -order;
    }
    return 0;
  });
}

/** A D1 value as PostgREST writes it in JSON. */
function outputValue(column: Column, value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (column.kind === 'boolean') return value === 1;
  if (column.kind === 'jsonb') return JSON.parse(String(value));
  return value;
}

export async function readRows(context: ContentContext, schemaName: string, tableName: string, url: URL, accept: string): Promise<{ body: unknown; range: string }> {
  if (!hasSchema(schemaName)) throw new PgError('PGRST106', 'Invalid schema: ' + schemaName, 406, null, 'Only the content schemas are exposed');
  const table = contentTable(schemaName, tableName);
  if (!table || !table.public) {
    throw new PgError('PGRST205', `Could not find the table '${schemaName}.${tableName}' in the schema cache`, 404);
  }
  const params = url.searchParams;
  const selected = parseSelect(table, params.get('select'));
  const filters = parseFilters(table, params);
  const orderings = parseOrder(table, params.get('order'));
  const limit = params.has('limit') ? Number(params.get('limit')) : null;
  const offset = params.has('offset') ? Number(params.get('offset')) : 0;
  if ((limit !== null && !(Number.isInteger(limit) && limit >= 0)) || !(Number.isInteger(offset) && offset >= 0)) {
    throw new PgError('PGRST100', '"failed to parse limit or offset"', 400);
  }

  const bindings: unknown[] = [];
  const conditions: string[] = [];
  const inJs: Filter[] = [];
  for (const filter of filters) {
    const condition = sqlCondition(filter, bindings);
    if (condition) conditions.push(condition);
    else inJs.push(filter);
  }
  // Sorting and paging can stay in SQLite when no text or enum column is
  // ordered on and every filter ran there; otherwise they happen here, on
  // the rows the filters let through.
  const sqlSortable = !inJs.length && orderings.every(({ column }) => column.kind !== 'text');
  let sql = `SELECT * FROM ${t(table.schema, table.table)}`;
  if (conditions.length) sql += ` WHERE ${conditions.join(' AND ')}`;
  if (sqlSortable) {
    const terms = orderings.map(({ column, ascending, nullsFirst }) => `${col(column.name)} ${ascending ? 'ASC' : 'DESC'} NULLS ${nullsFirst ? 'FIRST' : 'LAST'}`);
    terms.push('rowid');
    sql += ` ORDER BY ${terms.join(', ')}`;
    if (limit !== null) sql += ` LIMIT ${limit}`;
    if (offset) sql += `${limit === null ? ' LIMIT -1' : ''} OFFSET ${offset}`;
  } else {
    sql += ' ORDER BY rowid';
  }
  let rows = (await context.db.prepare(sql).bind(...bindings).all<Row>()).results;
  if (!sqlSortable) {
    rows = rows.filter((row) => inJs.every((filter) => matchesInJs(row, filter)));
    if (orderings.length) sortRows(rows, orderings);
    rows = rows.slice(offset, limit === null ? undefined : offset + limit);
  }

  const body = rows.map((row) => {
    const out: Row = {};
    for (const { output, column } of selected) out[output] = outputValue(column, row[column.name]);
    return out;
  });
  const range = body.length ? `${offset}-${offset + body.length - 1}/*` : '*/*';
  if (accept.includes('application/vnd.pgrst.object+json')) {
    if (body.length !== 1) {
      throw new PgError('PGRST116', 'Cannot coerce the result to a single JSON object', 406, `The result contains ${body.length} rows`);
    }
    return { body: body[0], range };
  }
  return { body, range };
}
