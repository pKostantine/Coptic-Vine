-- A believer's spiritual canon, the account's copy of what
-- src/context/SpiritualCanonContext.tsx keeps on the device
-- (src/utils/spiritualCanon.ts has its rules):
--
-- * public.spiritual_canons: one row per account, the canon's items and the
--   items removed (kept so an older copy on another device can't bring one
--   back).
-- * public.spiritual_canon_days: one row per account per day, the tasks
--   ticked off (and unticked) that day.
--
-- Each device merges its copy with these item by item and mark by mark, the
-- newest change winning, as public.bible_highlights and public.sermon_plans
-- are merged; the same own-rows-only access.

create table if not exists public.spiritual_canons (
  user_id uuid primary key references auth.users(id) on delete cascade,
  items jsonb not null default '[]'::jsonb check (
    jsonb_typeof(items) = 'array'
    and jsonb_array_length(items) <= 40
    and octet_length(items::text) <= 200000
  ),
  item_deletions jsonb not null default '{}'::jsonb check (
    jsonb_typeof(item_deletions) = 'object'
    and octet_length(item_deletions::text) <= 100000
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.spiritual_canon_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  marks jsonb not null default '{}'::jsonb check (
    jsonb_typeof(marks) = 'object'
    and octet_length(marks::text) <= 50000
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.spiritual_canons enable row level security;
alter table public.spiritual_canon_days enable row level security;

revoke all on table public.spiritual_canons from anon, authenticated;
revoke all on table public.spiritual_canon_days from anon, authenticated;
grant select, insert, update, delete on table public.spiritual_canons to authenticated;
grant select, insert, update, delete on table public.spiritual_canon_days to authenticated;

drop policy if exists spiritual_canons_select_own on public.spiritual_canons;
create policy spiritual_canons_select_own
on public.spiritual_canons for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists spiritual_canons_insert_own on public.spiritual_canons;
create policy spiritual_canons_insert_own
on public.spiritual_canons for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists spiritual_canons_update_own on public.spiritual_canons;
create policy spiritual_canons_update_own
on public.spiritual_canons for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists spiritual_canons_delete_own on public.spiritual_canons;
create policy spiritual_canons_delete_own
on public.spiritual_canons for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists spiritual_canon_days_select_own on public.spiritual_canon_days;
create policy spiritual_canon_days_select_own
on public.spiritual_canon_days for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists spiritual_canon_days_insert_own on public.spiritual_canon_days;
create policy spiritual_canon_days_insert_own
on public.spiritual_canon_days for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists spiritual_canon_days_update_own on public.spiritual_canon_days;
create policy spiritual_canon_days_update_own
on public.spiritual_canon_days for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists spiritual_canon_days_delete_own on public.spiritual_canon_days;
create policy spiritual_canon_days_delete_own
on public.spiritual_canon_days for delete
to authenticated
using ((select auth.uid()) = user_id);

drop trigger if exists spiritual_canons_set_updated_at on public.spiritual_canons;
create trigger spiritual_canons_set_updated_at
before update on public.spiritual_canons
for each row execute function private.set_updated_at();

drop trigger if exists spiritual_canon_days_set_updated_at on public.spiritual_canon_days;
create trigger spiritual_canon_days_set_updated_at
before update on public.spiritual_canon_days
for each row execute function private.set_updated_at();
