-- Paging by offset (get_offline_table_page) re-sorts the whole table for
-- every page and times out deep into the Bible. This pages by physical row
-- position instead, which costs the same however far in; the publishing
-- script sorts the rows itself, so packages come out in the same order every
-- time.
create or replace function public.get_offline_table_rows(p_resource text, p_table text, p_after text default null, p_limit integer default 500)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_schema text;
  v_result jsonb;
begin
  if p_limit < 1 or p_limit > 2000 then raise exception 'invalid page'; end if;
  select r.schema_name into v_schema from offline_content.resources r where r.resource_key = p_resource;
  if v_schema is null or not (p_table = any(offline_content.package_tables(p_resource))) then
    raise exception 'not a packaged table';
  end if;
  execute format(
    'select jsonb_build_object(''rows'', coalesce(jsonb_agg(page.payload order by page.position), ''[]''::jsonb), ''after'', max(page.position)::text)
       from (select source_row.ctid as position, to_jsonb(source_row) as payload
               from %I.%I source_row
              where source_row.ctid > coalesce($1, ''(0,0)'')::tid
              order by source_row.ctid
              limit %s) page',
    v_schema, p_table, p_limit
  ) using p_after into v_result;
  return v_result;
end;
$function$;

revoke all on function public.get_offline_table_rows(text, text, text, integer) from public;
grant execute on function public.get_offline_table_rows(text, text, text, integer) to anon, authenticated, service_role;
