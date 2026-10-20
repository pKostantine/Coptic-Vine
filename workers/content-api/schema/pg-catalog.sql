-- The Postgres catalog of everything Phase 1 copies to D1, as one JSON
-- document. Read-only. Run it in the Supabase SQL editor (or through the
-- Supabase MCP's execute_sql), save the single value it returns as
-- schema/pg-catalog.json, then run `npm run gen:schema`.
--
-- The scope is section 4.1 of docs/coptic-vine-d1-plan.md: every table and view
-- in the content schemas except the legacy, staging and private ones, plus the
-- three content tables in public.
with scope as (
  select c.oid, n.nspname as s, c.relname as t, c.relkind as k
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where c.relkind in ('r', 'p', 'v')
    and (
      (n.nspname in (
         'agpeya', 'aspasmos', 'bible', 'calendar', 'canons', 'doxologies', 'fractions',
         'gospel_responses', 'gospel_rite', 'holy_week', 'hymn_of_the_intercessions', 'litanies',
         'liturgy', 'praxis_response', 'procession_of_the_cross', 'psalmody', 'readings',
         'seasonal_liturgy_hymns', 'synaxarium', 'veneration', 'verses_of_the_cymbals')
       and n.nspname || '.' || c.relname not in (
         'synaxarium.entries_old', 'synaxarium.entry_texts_old', 'synaxarium.entry_texts_split',
         'synaxarium.entry_texts_align_map', 'synaxarium.entry_texts_deferred_review',
         'synaxarium.entry_texts_rubric_strip', 'synaxarium.entries_rematch_proposal',
         'synaxarium.arabic_orphans', 'gospel_responses.gospel_responses_old',
         'gospel_responses.hymn_texts_old', 'calendar.psalms_reading_ref_map_20260827',
         'calendar.psalms_ref_classification_20260827', 'bible.new_coptic_psalter_translation',
         'bible.verse_search_normalized'))
      or (n.nspname = 'public' and c.relname in ('hymn_texts', 'hymn_titles', 'saint_order'))
    )
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
