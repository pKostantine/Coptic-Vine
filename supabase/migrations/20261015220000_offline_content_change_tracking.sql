-- Book packages are rebuilt when their content changes. Each table a package
-- is built from notes when it was last written to, and the publishing script
-- (scripts/publish-content-packages.mjs --changed) asks which tables changed
-- since its last run, rebuilding only the books those tables belong to. The
-- app then finds the new versions when it checks for updates.

create table if not exists offline_content.content_changes (
  schema_name text not null,
  table_name text not null,
  changed_at timestamptz not null default now(),
  primary key (schema_name, table_name)
);

alter table offline_content.content_changes enable row level security;

-- Once per statement, not per row: an import of thousands of rows is one note.
create or replace function offline_content.note_content_change()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  insert into offline_content.content_changes (schema_name, table_name, changed_at)
  values (tg_table_schema, tg_table_name, now())
  on conflict (schema_name, table_name) do update set changed_at = excluded.changed_at;
  return null;
end;
$function$;

-- Puts the note on every table the packages are built from. Run again when
-- the package plan gains a resource or a table.
create or replace function offline_content.install_change_triggers()
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_table record;
  v_count integer := 0;
begin
  for v_table in
    select distinct r.schema_name, t.table_name
    from offline_content.resources r
    cross join lateral unnest(offline_content.package_tables(r.resource_key)) as t(table_name)
  loop
    execute format('drop trigger if exists offline_content_change on %I.%I', v_table.schema_name, v_table.table_name);
    execute format(
      'create trigger offline_content_change after insert or update or delete or truncate on %I.%I for each statement execute function offline_content.note_content_change()',
      v_table.schema_name, v_table.table_name
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$function$;

select offline_content.install_change_triggers();

-- When each packaged table last changed, with the database's own clock, for
-- the publishing script. Open to anyone: it says only when, never what.
create or replace function public.get_offline_content_changes()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select jsonb_build_object(
    'now', now(),
    'changes', coalesce((
      select jsonb_agg(jsonb_build_object('schema', schema_name, 'table', table_name, 'changedAt', changed_at) order by schema_name, table_name)
      from offline_content.content_changes
    ), '[]'::jsonb)
  );
$function$;

revoke all on function public.get_offline_content_changes() from public;
grant execute on function public.get_offline_content_changes() to anon, authenticated, service_role;
revoke all on function offline_content.install_change_triggers() from public;

notify pgrst, 'reload schema';
