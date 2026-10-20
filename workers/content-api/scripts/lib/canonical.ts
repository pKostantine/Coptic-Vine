/**
 * The canonical form of a row, the same on both sides, so a table's checksum
 * proves its content arrived intact (counts alone have looked right before
 * while rows were misaligned).
 *
 * A row is a JSON array of its values in column order (the copied columns,
 * as in schema/content-tables.json):
 *   text, enum, date, jsonb   a JSON string of the text (jsonb as Postgres prints it)
 *   integer                   its digits
 *   numeric, double, real     the shortest decimal that reads back as the same double
 *   boolean                   true or false
 *   null                      null
 * A table's checksum is the SHA-256 of its rows' lines, sorted by their UTF-8
 * bytes and joined with "\n". Sorting by the line rather than the key works
 * the same for the three tables that have no primary key.
 *
 * pgChecksumSql() writes the same thing for Postgres; d1 rows go through
 * canonicalLine() here.
 */
import { createHash } from 'node:crypto';
import type { ColumnKind, TableInfo } from './schema.ts';

export function canonicalValue(value: unknown, kind: ColumnKind): string {
  if (value === null || value === undefined) return 'null';
  switch (kind) {
    case 'text': case 'date': case 'jsonb':
      if (typeof value !== 'string') throw new Error(`Expected text, got ${typeof value}`);
      return JSON.stringify(value);
    case 'integer': case 'numeric': case 'float8': case 'float4':
      if (typeof value !== 'number') throw new Error(`Expected a number, got ${typeof value}`);
      return String(value);
    case 'boolean':
      if (value === 1 || value === true) return 'true';
      if (value === 0 || value === false) return 'false';
      throw new Error(`Expected 0 or 1, got ${String(value)}`);
  }
}

export function canonicalLine(row: Record<string, unknown>, table: TableInfo): string {
  return `[${table.columns.map((column) => canonicalValue(row[column.name], column.kind)).join(',')}]`;
}

export function tableChecksum(lines: string[]): string {
  const sorted = lines.map((line) => Buffer.from(line, 'utf8')).sort(Buffer.compare);
  const hash = createHash('sha256');
  sorted.forEach((line, index) => {
    if (index) hash.update('\n');
    hash.update(line);
  });
  return hash.digest('hex');
}

/**
 * One read-only query that returns {"schema/table": {rows, sha256}} for the
 * given tables, computed by Postgres itself: run it in the SQL editor or the
 * Supabase MCP and save the JSON value it returns for `verify --pg <file>`.
 *
 * Each column's canonical form is chosen from its Postgres type, as
 * canonicalValue chooses from the D1 kind: integers, doubles, reals and
 * booleans print as they are; numeric prints as its double; everything else
 * (text, enums, dates, jsonb) as a JSON string of its text. The generated
 * tsvector columns aren't copied, so they're left out. extra_float_digits = 1
 * makes Postgres print the shortest exact decimal of a double, as JavaScript
 * does.
 */
export function pgChecksumSql(tables: TableInfo[]): string {
  const names = tables.map((table) => `('${table.schema}', '${table.table}')`).join(',\n    ');
  return `set extra_float_digits = 1;
with copied(s, t) as (
  values
    ${names}
), lines as (
  select copied.s, copied.t, string_agg(
    case
      when ty.typname in ('int2', 'int4', 'int8', 'float4', 'float8', 'bool') then format('coalesce(%I::text, ''null'')', a.attname)
      when ty.typname = 'numeric' then format('coalesce(%I::float8::text, ''null'')', a.attname)
      else format('coalesce(to_json(%I::text)::text, ''null'')', a.attname)
    end, $sep$ || ',' || $sep$ order by a.attnum) as expression
  from copied
  join pg_class c on c.relname = copied.t and c.relnamespace = copied.s::regnamespace
  join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
  join pg_type ty on ty.oid = a.atttypid
  where not (a.attgenerated = 's' and ty.typname = 'tsvector')
  group by copied.s, copied.t
), results as (
  select s, t, query_to_xml(format(
    $q$select count(*) as n, encode(sha256(convert_to(coalesce(string_agg(line, E'\\n' order by line collate "C"), ''), 'UTF8')), 'hex') as h from (select '[' || %s || ']' as line from %I.%I) x$q$,
    expression, s, t), false, true, '') as x
  from lines
)
select json_object_agg(s || '/' || t, json_build_object('rows', (xpath('/row/n/text()', x))[1]::text::bigint, 'sha256', (xpath('/row/h/text()', x))[1]::text) order by s, t) as checksums
from results;
`;
}
