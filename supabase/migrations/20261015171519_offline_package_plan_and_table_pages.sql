-- Book packages are now built outside the database, a page at a time, by
-- scripts/publish-content-packages.mjs: building them in one transaction
-- (begin_offline_package_snapshot) outran every request time limit. These two
-- read-only functions give that script what to package and the rows, and are
-- open to anyone because everything they return is published in the packages
-- anyway.

-- The tables a resource packages: the same rule the snapshot used.
create or replace function offline_content.package_tables(p_resource text)
returns text[]
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce(array_agg(t.tablename::text order by t.tablename), '{}')
  from offline_content.resources r
  join pg_catalog.pg_tables t on t.schemaname = r.schema_name
  where r.resource_key = p_resource
    and (r.include_tables is null or t.tablename = any(r.include_tables))
    and t.tablename !~* '(backup|archive|history|working|staging|admin|draft|audit)';
$function$;

create or replace function public.get_offline_package_plan()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select jsonb_build_object(
    'books', coalesce((
      select jsonb_agg(jsonb_build_object('key', book_key, 'title', title_english, 'titleArabic', title_arabic, 'roots', root_resources) order by book_key)
      from offline_content.books where enabled
    ), '[]'::jsonb),
    'dependencies', coalesce((
      select jsonb_agg(jsonb_build_object('resource', resource_key, 'dependency', dependency_key) order by resource_key, dependency_key)
      from offline_content.resource_dependencies
    ), '[]'::jsonb),
    'resources', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.resource_key, 'schema', r.schema_name, 'tables', offline_content.package_tables(r.resource_key)) order by r.resource_key)
      from offline_content.resources r
    ), '[]'::jsonb)
  );
$function$;

-- One page of one packaged table, in a stable order: the Bible's reading
-- order, otherwise the primary key (or, without one, the row itself).
create or replace function public.get_offline_table_page(p_resource text, p_table text, p_offset integer, p_limit integer)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_schema text;
  v_order text;
  v_rows jsonb;
begin
  if p_limit < 1 or p_limit > 2000 or p_offset < 0 then raise exception 'invalid page'; end if;
  select r.schema_name into v_schema from offline_content.resources r where r.resource_key = p_resource;
  if v_schema is null or not (p_table = any(offline_content.package_tables(p_resource))) then
    raise exception 'not a packaged table';
  end if;
  v_order := case
    when p_resource = 'bible' and p_table = 'books' then 'source_number nulls last, book_key'
    when p_resource = 'bible' and p_table = 'verses' then 'book_key, chapter_number, verse_number'
    when p_resource = 'bible' and p_table = 'verse_parts' then 'book_key, chapter_number, verse_number, part_label'
    else (
      select string_agg(format('%I', a.attname), ', ' order by array_position(i.indkey, a.attnum))
      from pg_catalog.pg_index i
      join pg_catalog.pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
      where i.indrelid = format('%I.%I', v_schema, p_table)::regclass and i.indisprimary
    )
  end;
  execute format(
    'select coalesce(jsonb_agg(to_jsonb(page_row)), ''[]''::jsonb) from (select * from %I.%I source_row order by %s offset %s limit %s) page_row',
    v_schema, p_table, coalesce(v_order, 'to_jsonb(source_row)::text'), p_offset, p_limit
  ) into v_rows;
  return v_rows;
end;
$function$;

revoke all on function offline_content.package_tables(text) from public;
revoke all on function public.get_offline_package_plan() from public;
revoke all on function public.get_offline_table_page(text, text, integer, integer) from public;
grant execute on function public.get_offline_package_plan() to anon, authenticated, service_role;
grant execute on function public.get_offline_table_page(text, text, integer, integer) to anon, authenticated, service_role;
