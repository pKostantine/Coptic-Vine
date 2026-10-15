-- Sorting rows by position built JSON for every row before the limit, so
-- even the first page of the Bible timed out. Take the page's positions
-- first, which is cheap, and build JSON for those rows alone.
create or replace function public.get_offline_table_rows(p_resource text, p_table text, p_after text default null, p_limit integer default 500)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_schema text;
  v_positions tid[];
  v_rows jsonb;
begin
  if p_limit < 1 or p_limit > 2000 then raise exception 'invalid page'; end if;
  select r.schema_name into v_schema from offline_content.resources r where r.resource_key = p_resource;
  if v_schema is null or not (p_table = any(offline_content.package_tables(p_resource))) then
    raise exception 'not a packaged table';
  end if;
  execute format(
    'select array_agg(page.position order by page.position)
       from (select source_row.ctid as position
               from %I.%I source_row
              where source_row.ctid > coalesce($1, ''(0,0)'')::tid
              order by source_row.ctid
              limit %s) page',
    v_schema, p_table, p_limit
  ) using p_after into v_positions;
  if v_positions is null then
    return jsonb_build_object('rows', '[]'::jsonb, 'after', null);
  end if;
  execute format(
    'select coalesce(jsonb_agg(to_jsonb(source_row) order by source_row.ctid), ''[]''::jsonb)
       from %I.%I source_row
      where source_row.ctid = any($1)',
    v_schema, p_table
  ) using v_positions into v_rows;
  return jsonb_build_object('rows', v_rows, 'after', v_positions[array_length(v_positions, 1)]::text);
end;
$function$;
