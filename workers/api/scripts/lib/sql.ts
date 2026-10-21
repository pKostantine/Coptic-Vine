/**
 * The read-only Postgres queries for the user data: the export import.ts
 * loads, and the checksums verify.ts compares. Both are printed for the
 * Supabase SQL editor or the Supabase MCP's execute_sql, which can read past
 * RLS; Supabase is never written to.
 *
 * The export is one JSON value: per table, every row as an object of its
 * stored columns, each in the form D1 keeps it (gen-schema.ts): timestamptz
 * as Supabase's REST API prints it, jsonb as Postgres's text of it, text[] as
 * a JSON array, booleans and numbers as JSON. The sign-in data comes with it: auth.users (with the password
 * hashes) and auth.identities, for "auth.users" and "auth.accounts".
 */
import type { UserSchema } from '../gen-schema.ts';

const ident = (name: string) => `"${name.replaceAll('"', '""')}"`;
const relation = (table: { schema: string; table: string }) => `${ident(table.schema)}.${ident(table.table)}`;

export function exportSql(schema: UserSchema): string {
  // to_jsonb(row) already prints timestamptz, numbers, booleans and text[] the
  // way D1 stores them; jsonb columns are swapped for Postgres's text of them,
  // and the columns D1 doesn't store (tsvector, generated) are taken out.
  const parts = schema.tables.map((table) => {
    const remove = [...table.dropped, ...table.columns.filter((column) => column.generated).map((column) => column.name)].map((name) => ` - '${name}'`).join('');
    const jsonb = table.columns.filter((column) => column.kind === 'jsonb' && !column.generated);
    const swap = jsonb.length ? ` || jsonb_build_object(${jsonb.map((column) => `'${column.name}', x.${ident(column.name)}::text`).join(', ')})` : '';
    return `    select '${table.schema}/${table.table}', (select coalesce(json_agg((to_jsonb(x)${remove}${swap}) order by ${table.primaryKey.map((name) => `x.${ident(name)}`).join(', ')}), '[]') from ${relation(table)} x)`;
  });
  return `-- Read-only export of the user data for workers/api/scripts/import.ts.
set time zone 'UTC';
set extra_float_digits = 1;
select json_build_object(
  'exportedAt', to_json(now()) #>> '{}',
  'tables', (select json_object_agg(k, v order by k) from (
${parts.join('\n    union all\n')}
  ) tables(k, v)),
  'authUsers', (select coalesce(json_agg(json_build_object(
    'id', u.id::text, 'email', u.email, 'emailConfirmedAt', to_json(u.email_confirmed_at) #>> '{}',
    'encryptedPassword', nullif(u.encrypted_password, ''),
    'rawUserMetaData', coalesce(u.raw_user_meta_data, '{}'::jsonb)::text, 'rawAppMetaData', coalesce(u.raw_app_meta_data, '{}'::jsonb)::text,
    'createdAt', to_json(u.created_at) #>> '{}', 'updatedAt', to_json(coalesce(u.updated_at, u.created_at)) #>> '{}',
    'deletedAt', to_json(u.deleted_at) #>> '{}', 'bannedUntil', to_json(u.banned_until) #>> '{}'
  ) order by u.id), '[]'::json) from "auth"."users" u),
  'authIdentities', (select coalesce(json_agg(json_build_object(
    'id', i.id::text, 'userId', i.user_id::text, 'provider', i.provider, 'providerId', i.provider_id,
    'createdAt', to_json(i.created_at) #>> '{}', 'updatedAt', to_json(coalesce(i.updated_at, i.created_at)) #>> '{}'
  ) order by i.id), '[]'::json) from "auth"."identities" i)
) as export, repeat('.', 120000) as pad;
`;
}

/**
 * {"schema/table": {rows, sha256}} for every user table, computed by Postgres,
 * plus "auth/users": the users' ids and emails. Each column's canonical
 * expression is built from its Postgres type inside the query, as in Phase
 * 1, so the query stays short: integers, reals and booleans print as they
 * are; timestamptz as a JSON string of Supabase's REST form; text[] as a
 * JSON string of its JSON array; everything else as a JSON string of its
 * text. tsvector columns aren't copied, so they're left out.
 */
export function pgChecksumSql(schema: UserSchema): string {
  const names = schema.tables.map((table) => `('${table.schema}', '${table.table}')`).join(',\n    ');
  return `-- Read-only checksums of the user data for workers/api/scripts/verify.ts.
set time zone 'UTC';
set extra_float_digits = 1;
with copied(s, t) as (
  values
    ${names}
), lines as (
  select copied.s, copied.t, string_agg(
    case
      when ty.typname in ('int2', 'int4', 'int8', 'float4', 'bool') then format('coalesce(%I::text, ''null'')', a.attname)
      when ty.typname = 'timestamptz' then format('coalesce(to_json(to_json(%I) #>> ''{}'')::text, ''null'')', a.attname)
      when ty.typname = '_text' then format('coalesce(to_json(to_json(%I)::text)::text, ''null'')', a.attname)
      else format('coalesce(to_json(%I::text)::text, ''null'')', a.attname)
    end, $sep$ || ',' || $sep$ order by a.attnum) as expression
  from copied
  join pg_class c on c.relname = copied.t and c.relnamespace = copied.s::regnamespace
  join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
  join pg_type ty on ty.oid = a.atttypid
  where ty.typname <> 'tsvector'
  group by copied.s, copied.t
), results as (
  select s || '/' || t as k, query_to_xml(format(
    $q$select count(*) as n, encode(sha256(convert_to(coalesce(string_agg(line, E'\\n' order by line collate "C"), ''), 'UTF8')), 'hex') as h from (select '[' || %s || ']' as line from %I.%I) x$q$,
    expression, s, t), false, true, '') as x
  from lines
  union all
  select 'auth/users', query_to_xml($q$select count(*) as n, encode(sha256(convert_to(coalesce(string_agg(line, E'\\n' order by line collate "C"), ''), 'UTF8')), 'hex') as h from (select '[' || to_json(id::text)::text || ',' || to_json(lower(email))::text || ']' as line from "auth"."users" where deleted_at is null) x$q$, false, true, '')
)
select json_object_agg(k, json_build_object('rows', (xpath('/row/n/text()', x))[1]::text::bigint, 'sha256', (xpath('/row/h/text()', x))[1]::text) order by k) as checksums, repeat('.', 120000) as pad
from results;
`;
}
