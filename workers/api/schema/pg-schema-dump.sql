-- The DDL of the user data's schemas, as one script, for the parity oracle:
-- PGlite runs Supabase's own functions on it (tests/lib/oracle.ts), and the
-- Worker's ports are compared with them. Read-only, and structure only: no
-- rows. Run it in the Supabase SQL editor or the Supabase MCP's execute_sql,
-- save the single value it returns as schema/pg-user-schema.sql (scripts
-- save-schema-dump.ts does that from a saved MCP result).
--
-- Scope: creator, learning, media, music, private and public (public's
-- content tables too, for the foreign keys into them). Order: schemas, enums,
-- tables, functions, column defaults, keys and checks, foreign keys, indexes,
-- triggers, row-level security and its policies, grants to anon and
-- authenticated (table, column and function grants).
with s(nspname) as (values ('creator'), ('learning'), ('media'), ('music'), ('private'), ('public')),
ns as (select n.oid, n.nspname from pg_namespace n join s using (nspname)),
rels as (
  select c.oid, ns.nspname, c.relname, c.relrowsecurity, c.relforcerowsecurity
  from pg_class c join ns on ns.oid = c.relnamespace
  where c.relkind in ('r', 'p')
),
ext_objects as (select objid from pg_depend where deptype = 'e'),
parts(ord, sub, sql) as (
  select 1, n.nspname, format('create schema if not exists %I;', n.nspname) from ns n
  union all
  select 2, t.typname, format('create type %I.%I as enum (%s);', n.nspname, t.typname,
    (select string_agg(quote_literal(e.enumlabel), ', ' order by e.enumsortorder) from pg_enum e where e.enumtypid = t.oid))
  from pg_type t join ns n on n.oid = t.typnamespace where t.typtype = 'e' and t.oid not in (select objid from ext_objects)
  union all
  select 3, r.nspname || '.' || r.relname, format('create table %I.%I (%s);', r.nspname, r.relname,
    (select string_agg(format('%I %s%s%s', a.attname, format_type(a.atttypid, a.atttypmod),
        case when a.attgenerated = 's' then format(' generated always as (%s) stored', pg_get_expr(d.adbin, d.adrelid)) else '' end,
        case when a.attnotnull then ' not null' else '' end), ', ' order by a.attnum)
     from pg_attribute a left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
     where a.attrelid = r.oid and a.attnum > 0 and not a.attisdropped))
  from rels r
  union all
  select 4, n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', pg_get_functiondef(p.oid) || ';'
  from pg_proc p join ns n on n.oid = p.pronamespace
  where p.prokind in ('f', 'p') and p.oid not in (select objid from ext_objects)
  union all
  select 5, r.nspname || '.' || r.relname || '.' || a.attname, format('alter table %I.%I alter column %I set default %s;', r.nspname, r.relname, a.attname, pg_get_expr(d.adbin, d.adrelid))
  from rels r join pg_attribute a on a.attrelid = r.oid join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
  where a.attgenerated = '' and a.attidentity = ''
  union all
  select case when co.contype = 'f' then 7 else 6 end, r.nspname || '.' || r.relname || '.' || co.conname,
    format('alter table %I.%I add constraint %I %s;', r.nspname, r.relname, co.conname, pg_get_constraintdef(co.oid))
  from rels r join pg_constraint co on co.conrelid = r.oid where co.contype in ('p', 'u', 'c', 'f', 'x')
  union all
  select 8, ic.relname, pg_get_indexdef(i.indexrelid) || ';'
  from rels r join pg_index i on i.indrelid = r.oid join pg_class ic on ic.oid = i.indexrelid
  where not exists (select 1 from pg_constraint co where co.conindid = i.indexrelid)
  union all
  select 9, r.nspname || '.' || r.relname || '.' || tg.tgname, pg_get_triggerdef(tg.oid) || ';'
  from rels r join pg_trigger tg on tg.tgrelid = r.oid where not tg.tgisinternal
  union all
  select 10, r.nspname || '.' || r.relname, format('alter table %I.%I enable row level security;', r.nspname, r.relname) from rels r where r.relrowsecurity
  union all
  select 11, p.schemaname || '.' || p.tablename || '.' || p.policyname,
    format('create policy %I on %I.%I as %s for %s to %s%s%s;', p.policyname, p.schemaname, p.tablename, p.permissive, p.cmd,
      (select string_agg(quote_ident(role), ', ') from unnest(p.roles) role),
      case when p.qual is not null then format(' using (%s)', p.qual) else '' end,
      case when p.with_check is not null then format(' with check (%s)', p.with_check) else '' end)
  from pg_policies p join s on s.nspname = p.schemaname
  union all
  select 12, g.table_schema || '.' || g.table_name || '.' || g.grantee,
    format('grant %s on %I.%I to %I;', string_agg(g.privilege_type, ', ' order by g.privilege_type), g.table_schema, g.table_name, g.grantee)
  from information_schema.role_table_grants g join s on s.nspname = g.table_schema
  where g.grantee in ('anon', 'authenticated')
  group by g.table_schema, g.table_name, g.grantee
  union all
  select 13, n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' || role,
    format('grant execute on function %I.%I(%s) to %I;', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid), role)
  from pg_proc p join ns n on n.oid = p.pronamespace cross join (values ('anon'), ('authenticated')) roles(role)
  where p.prokind = 'f' and p.oid not in (select objid from ext_objects) and has_function_privilege(role, p.oid, 'execute')
  union all
  select 12, c.table_schema || '.' || c.table_name || '.' || c.grantee || '.' || c.privilege_type,
    format('grant %s (%s) on %I.%I to %I;', c.privilege_type, string_agg(quote_ident(c.column_name), ', ' order by c.column_name), c.table_schema, c.table_name, c.grantee)
  from information_schema.column_privileges c join s on s.nspname = c.table_schema
  where c.grantee in ('anon', 'authenticated')
    and not exists (select 1 from information_schema.role_table_grants g where g.table_schema = c.table_schema and g.table_name = c.table_name and g.grantee = c.grantee and g.privilege_type = c.privilege_type)
  group by c.table_schema, c.table_name, c.grantee, c.privilege_type
  union all
  select 14, n.nspname || role, format('grant usage on schema %I to %I;', n.nspname, role)
  from ns n cross join (values ('anon'), ('authenticated')) roles(role) where has_schema_privilege(role, n.oid, 'usage')
)
-- Statements are separated by a line holding only "--;;", since function
-- bodies have semicolons and line breaks of their own.
select string_agg(sql, E'\n--;;\n' order by ord, sub) as ddl, count(*) as statements
from parts;
