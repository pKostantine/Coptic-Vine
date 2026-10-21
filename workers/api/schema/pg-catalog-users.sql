-- The Postgres catalog of the user data Phase 2 moves to D1 (section 5 of
-- docs/coptic-vine-d1-plan.md), as one JSON document. Read-only. Run it in the
-- Supabase SQL editor (or through the Supabase MCP's execute_sql), save the
-- single value it returns as schema/pg-catalog-users.json, then run
-- `npm run gen:schema`.
--
-- The scope: every table and view in creator, learning, media, music and
-- private, and the user tables in public (everything there but the three
-- content tables Phase 1 copied), plus auth.users for reference.
with scope as (
  select c.oid, n.nspname as s, c.relname as t, c.relkind as k
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where c.relkind in ('r', 'p', 'v')
    and (n.nspname in ('creator', 'learning', 'media', 'music', 'private')
      or (n.nspname = 'public' and c.relname not in ('hymn_texts', 'hymn_titles', 'saint_order'))
      or (n.nspname = 'auth' and c.relname = 'users'))
)
select json_build_object(
  'enums', (
    select json_object_agg(t.typname, (select json_agg(e.enumlabel order by e.enumsortorder) from pg_enum e where e.enumtypid = t.oid))
    from pg_type t
    where t.typtype = 'e'
      and t.oid in (select a.atttypid from pg_attribute a join scope on scope.oid = a.attrelid)
  ),
  'relations', (
    select json_agg(json_build_object(
      'schema', s,
      'table', t,
      'kind', k,
      'anonReadable', has_table_privilege('anon', scope.oid, 'SELECT'),
      'view', case when k = 'v' then pg_get_viewdef(scope.oid) end,
      'columns', (
        select json_agg(json_build_object(
          'name', a.attname,
          'type', format_type(a.atttypid, a.atttypmod),
          'enum', case when ty.typtype = 'e' then ty.typname end,
          'notNull', a.attnotnull,
          'default', pg_get_expr(d.adbin, d.adrelid),
          'generated', a.attgenerated <> '',
          'identity', a.attidentity <> ''
        ) order by a.attnum)
        from pg_attribute a
        join pg_type ty on ty.oid = a.atttypid
        left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
        where a.attrelid = scope.oid and a.attnum > 0 and not a.attisdropped
      ),
      'constraints', coalesce((
        select json_agg(json_build_object(
          'name', co.conname,
          'type', co.contype,
          'definition', pg_get_constraintdef(co.oid),
          'columns', (select json_agg(a.attname order by x.ord) from unnest(co.conkey) with ordinality x(num, ord) join pg_attribute a on a.attrelid = co.conrelid and a.attnum = x.num),
          'references', case when co.contype = 'f' then (select n2.nspname || '.' || c2.relname from pg_class c2 join pg_namespace n2 on n2.oid = c2.relnamespace where c2.oid = co.confrelid) end,
          'referencedColumns', case when co.contype = 'f' then (select json_agg(a.attname order by x.ord) from unnest(co.confkey) with ordinality x(num, ord) join pg_attribute a on a.attrelid = co.confrelid and a.attnum = x.num) end,
          'onUpdate', case when co.contype = 'f' then co.confupdtype end,
          'onDelete', case when co.contype = 'f' then co.confdeltype end
        ) order by co.conname)
        from pg_constraint co
        where co.conrelid = scope.oid
      ), '[]'::json),
      'indexes', coalesce((
        select json_agg(json_build_object(
          'name', ic.relname,
          'definition', pg_get_indexdef(i.indexrelid),
          'unique', i.indisunique,
          'backsConstraint', exists (select 1 from pg_constraint co where co.conindid = i.indexrelid)
        ) order by ic.relname)
        from pg_index i
        join pg_class ic on ic.oid = i.indexrelid
        where i.indrelid = scope.oid
      ), '[]'::json),
      'triggers', coalesce((
        select json_agg(tg.tgname || ' -> ' || p.pronamespace::regnamespace || '.' || p.proname order by tg.tgname)
        from pg_trigger tg
        join pg_proc p on p.oid = tg.tgfoid
        where tg.tgrelid = scope.oid and not tg.tgisinternal
      ), '[]'::json)
    ) order by s, t)
    from scope
  )
) as catalog;
