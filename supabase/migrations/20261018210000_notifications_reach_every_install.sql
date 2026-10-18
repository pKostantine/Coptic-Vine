-- Manual notifications from CV Admin reach every Coptic Vine install that
-- allows notifications, signed in or not.
--
-- Until now a device could register only under an account, and a broadcast
-- went only to accounts: a feast greeting reached nobody who uses the app
-- without signing in, which is most people. Now:
--
-- * public.notification_devices may hold an install with no account
--   (user_id null). register_notification_device accepts one from the
--   Coptic Vine app ('chc') signed out; signing in moves the install to the
--   account, signing out moves it back.
-- * A delivery carries the broadcast it is for, and an inbox notification
--   only when the install belongs to an account (private.notification_deliveries
--   .broadcast_id; notification_id may be null). The dispatcher's claims read
--   the message from either.
-- * admin_send_notification_broadcast sends to every eligible install (an
--   account's opt-out of the category still holds); admin_send_notification_test
--   sends to the admin's own devices only; the overview says how many installs,
--   on what, and how each recent broadcast's deliveries stand — and whether the
--   dispatcher is sending at all.

-- —— Installs without an account —————————————————————————————————————————

alter table public.notification_devices alter column user_id drop not null;

create index if not exists notification_devices_app_enabled_idx
  on public.notification_devices(app_key, enabled, provider);

-- —— Deliveries for a broadcast ——————————————————————————————————————————

alter table private.notification_deliveries alter column notification_id drop not null;
alter table private.notification_deliveries
  add column if not exists broadcast_id uuid references public.notification_broadcasts(id) on delete cascade;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'notification_deliveries_has_message'
      and conrelid = 'private.notification_deliveries'::regclass
  ) then
    alter table private.notification_deliveries
      add constraint notification_deliveries_has_message
      check (notification_id is not null or broadcast_id is not null);
  end if;
end;
$$;

create unique index if not exists notification_deliveries_broadcast_device_uidx
  on private.notification_deliveries(broadcast_id, device_id)
  where broadcast_id is not null;
create index if not exists notification_deliveries_broadcast_status_idx
  on private.notification_deliveries(broadcast_id, status)
  where broadcast_id is not null;

-- —— Registering an install ——————————————————————————————————————————————

create or replace function public.register_notification_device(
  p_app_key text,
  p_platform text,
  p_provider text,
  p_push_token text,
  p_provider_data jsonb default '{}'::jsonb,
  p_device_name text default null,
  p_app_version text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
  v_web_host text;
begin
  -- Coptic Vine's own installs may register signed out; the Artists and
  -- Admin apps are for accounts only.
  if v_user_id is null and p_app_key <> 'chc' then
    raise exception 'authentication_required';
  end if;

  if p_app_key not in ('chc','chc_artists','chc_admin')
     or p_platform not in ('ios','android','web','windows')
     or p_provider not in ('expo','web_push','wns')
     or nullif(btrim(p_push_token), '') is null
     or length(p_push_token) > 4096
     or pg_column_size(coalesce(p_provider_data, '{}'::jsonb)) > 16384 then
    raise exception 'invalid_notification_device';
  end if;

  if p_provider = 'web_push' then
    if p_app_key <> 'chc' or p_platform not in ('web','windows') then
      raise exception 'invalid_web_push_app';
    end if;

    v_web_host := lower(substring(p_push_token from '^https://([^/:?#]+)'));
    if v_web_host is null
       or not (
         v_web_host = 'fcm.googleapis.com'
         or v_web_host = 'push.services.mozilla.com'
         or v_web_host like '%.push.services.mozilla.com'
         or v_web_host = 'push.apple.com'
         or v_web_host like '%.push.apple.com'
       ) then
      raise exception 'unsupported_web_push_endpoint';
    end if;
  end if;

  if p_provider = 'expo' then
    if p_platform not in ('ios','android') then
      raise exception 'invalid_expo_push_platform';
    end if;
    -- Only an Expo push token, now that anyone with the app's key can register one.
    if p_push_token !~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]{8,}\]$' then
      raise exception 'invalid_expo_push_token';
    end if;
  end if;

  -- An install that changes hands (an account, another account, or none)
  -- leaves its old queued deliveries behind with its old row.
  delete from public.notification_devices
  where app_key = p_app_key
    and provider = p_provider
    and push_token = p_push_token
    and user_id is distinct from v_user_id;

  insert into public.notification_devices (
    user_id, app_key, platform, provider, push_token, provider_data,
    device_name, app_version, enabled, last_seen_at, updated_at
  ) values (
    v_user_id, p_app_key, p_platform, p_provider, p_push_token,
    coalesce(p_provider_data, '{}'::jsonb), p_device_name, p_app_version,
    true, now(), now()
  )
  on conflict (app_key, provider, push_token)
  do update set
    user_id = excluded.user_id,
    platform = excluded.platform,
    provider_data = excluded.provider_data,
    device_name = excluded.device_name,
    app_version = excluded.app_version,
    enabled = true,
    last_seen_at = now(),
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.register_notification_device(text,text,text,text,jsonb,text,text) from public;
grant execute on function public.register_notification_device(text,text,text,text,jsonb,text,text) to anon, authenticated, service_role;

-- —— The dispatcher's claims: the message from the inbox notification or the broadcast ——

create or replace function public.claim_notification_deliveries(
  p_limit integer default 100
) returns table (
  delivery_id uuid,
  notification_id uuid,
  device_id uuid,
  push_token text,
  title text,
  body text,
  image_url text,
  deep_link text,
  payload jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with picked as (
    select d.id
    from private.notification_deliveries d
    where d.provider = 'expo'
      and d.attempt_count < d.max_attempts
      and (
        (d.status = 'queued' and d.available_at <= now())
        or (d.status = 'processing' and d.claimed_at < now() - interval '10 minutes')
      )
    order by d.available_at, d.created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 100), 100))
  ),
  claimed as (
    update private.notification_deliveries d
    set status = 'processing',
        claimed_at = now(),
        attempt_count = d.attempt_count + 1,
        updated_at = now()
    from picked p
    where d.id = p.id
    returning d.id, d.notification_id, d.broadcast_id, d.device_id
  )
  select
    c.id,
    c.notification_id,
    c.device_id,
    dev.push_token,
    coalesce(n.title, b.title),
    coalesce(n.body, b.body),
    n.image_url,
    coalesce(n.deep_link, b.deep_link),
    coalesce(n.payload, b.payload, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
      'notification_id', n.id::text,
      'broadcast_id', b.id::text,
      'deep_link', coalesce(n.deep_link, b.deep_link)
    ))
  from claimed c
  join public.notification_devices dev on dev.id = c.device_id
  left join public.notifications n on n.id = c.notification_id
  left join public.notification_broadcasts b on b.id = c.broadcast_id
  where dev.enabled = true
    and (n.id is not null or b.id is not null);
end;
$$;

revoke all on function public.claim_notification_deliveries(integer) from public, anon, authenticated;
grant execute on function public.claim_notification_deliveries(integer) to service_role;

create or replace function public.claim_web_push_deliveries(
  p_limit integer default 100
) returns table (
  delivery_id uuid,
  notification_id uuid,
  device_id uuid,
  subscription jsonb,
  title text,
  body text,
  image_url text,
  deep_link text,
  payload jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with picked as (
    select d.id
    from private.notification_deliveries d
    where d.provider = 'web_push'
      and d.attempt_count < d.max_attempts
      and (
        (d.status = 'queued' and d.available_at <= now())
        or (d.status = 'processing' and d.claimed_at < now() - interval '10 minutes')
      )
    order by d.available_at, d.created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 100), 100))
  ),
  claimed as (
    update private.notification_deliveries d
    set status = 'processing',
        claimed_at = now(),
        attempt_count = d.attempt_count + 1,
        updated_at = now()
    from picked p
    where d.id = p.id
    returning d.id, d.notification_id, d.broadcast_id, d.device_id
  )
  select
    c.id,
    c.notification_id,
    c.device_id,
    dev.provider_data || jsonb_build_object('endpoint', dev.push_token),
    coalesce(n.title, b.title),
    coalesce(n.body, b.body),
    n.image_url,
    coalesce(n.deep_link, b.deep_link),
    coalesce(n.payload, b.payload, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
      'notification_id', n.id::text,
      'broadcast_id', b.id::text,
      'deep_link', coalesce(n.deep_link, b.deep_link)
    ))
  from claimed c
  join public.notification_devices dev on dev.id = c.device_id
  left join public.notifications n on n.id = c.notification_id
  left join public.notification_broadcasts b on b.id = c.broadcast_id
  where dev.enabled = true
    and (n.id is not null or b.id is not null);
end;
$$;

revoke all on function public.claim_web_push_deliveries(integer) from public, anon, authenticated;
grant execute on function public.claim_web_push_deliveries(integer) to service_role;

-- —— Who a broadcast reaches ——————————————————————————————————————————————

-- Every enabled Coptic Vine install, unless its account has turned the category off.
create or replace function private.broadcast_audience(p_category text)
returns table (device_id uuid, user_id uuid, provider text, platform text)
language sql
stable
security definer
set search_path = ''
as $$
  select d.id, d.user_id, d.provider, d.platform
  from public.notification_devices d
  where d.app_key = 'chc'
    and d.enabled = true
    and d.provider in ('expo','web_push')
    and (
      d.user_id is null
      or not exists (
        select 1
        from public.notification_preferences p
        where p.user_id = d.user_id
          and p.app_key = 'chc'
          and p.category = p_category
          and p.enabled = false
      )
    );
$$;

revoke all on function private.broadcast_audience(text) from public, anon, authenticated;

create or replace function public.admin_send_notification_broadcast(
  p_category text,
  p_title text,
  p_body text,
  p_deep_link text default null,
  p_payload jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_category text := btrim(coalesce(p_category, ''));
  v_title text := btrim(coalesce(p_title, ''));
  v_body text := btrim(coalesce(p_body, ''));
  v_deep_link text := nullif(btrim(coalesce(p_deep_link, '')), '');
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_broadcast_id uuid;
  v_recipient_count integer := 0;
  v_delivery_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not (select private.is_admin()) then
    raise exception 'Admin role required' using errcode = '42501';
  end if;
  if v_category not in ('feast_celebrations','announcements') then
    raise exception 'Unsupported notification category' using errcode = '22023';
  end if;
  if length(v_title) < 1 or length(v_title) > 120 then
    raise exception 'Title must be between 1 and 120 characters' using errcode = '22023';
  end if;
  if length(v_body) < 1 or length(v_body) > 600 then
    raise exception 'Message must be between 1 and 600 characters' using errcode = '22023';
  end if;
  if jsonb_typeof(v_payload) <> 'object' then
    raise exception 'Notification payload must be a JSON object' using errcode = '22023';
  end if;
  if v_deep_link is not null
     and (left(v_deep_link, 1) <> '/' or left(v_deep_link, 2) = '//') then
    raise exception 'Deep link must be an internal Coptic Vine path beginning with /' using errcode = '22023';
  end if;

  insert into public.notification_broadcasts (app_key, category, title, body, deep_link, payload, created_by)
  values ('chc', v_category, v_title, v_body, v_deep_link, v_payload, v_user_id)
  returning id into v_broadcast_id;

  with audience as (
    select * from private.broadcast_audience(v_category)
  ),
  -- An account's devices share one inbox notification; an install with no account has none.
  inserted_notifications as (
    insert into public.notifications (user_id, app_key, category, event_type, title, body, deep_link, payload)
    select distinct
      a.user_id, 'chc', v_category, 'admin_broadcast', v_title, v_body, v_deep_link,
      v_payload || jsonb_build_object('broadcast_id', v_broadcast_id::text, 'source', 'chc_admin')
    from audience a
    where a.user_id is not null
    returning id, user_id
  ),
  inserted_deliveries as (
    insert into private.notification_deliveries (notification_id, broadcast_id, device_id, provider)
    select n.id, v_broadcast_id, a.device_id, a.provider
    from audience a
    left join inserted_notifications n on n.user_id = a.user_id
    on conflict do nothing
    returning id, device_id
  )
  select
    (select count(distinct coalesce(a.user_id::text, a.device_id::text))::integer
       from audience a
       where a.device_id in (select device_id from inserted_deliveries)),
    (select count(*)::integer from inserted_deliveries)
  into v_recipient_count, v_delivery_count;

  update public.notification_broadcasts
  set recipient_count = coalesce(v_recipient_count, 0),
      delivery_count = coalesce(v_delivery_count, 0)
  where id = v_broadcast_id;

  return jsonb_build_object(
    'broadcastId', v_broadcast_id,
    'recipientCount', coalesce(v_recipient_count, 0),
    'deliveryCount', coalesce(v_delivery_count, 0),
    'queuedAt', now()
  );
end;
$$;

revoke all on function public.admin_send_notification_broadcast(text,text,text,text,jsonb) from public, anon;
grant execute on function public.admin_send_notification_broadcast(text,text,text,text,jsonb) to authenticated, service_role;

-- —— A test, to the admin's own devices ——————————————————————————————————

create or replace function public.admin_send_notification_test(
  p_title text,
  p_body text,
  p_deep_link text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_title text := btrim(coalesce(p_title, ''));
  v_body text := btrim(coalesce(p_body, ''));
  v_deep_link text := nullif(btrim(coalesce(p_deep_link, '')), '');
  v_notification_id uuid;
  v_delivery_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not (select private.is_admin()) then
    raise exception 'Admin role required' using errcode = '42501';
  end if;
  if length(v_title) < 1 or length(v_title) > 120 or length(v_body) < 1 or length(v_body) > 600 then
    raise exception 'A test needs a title (up to 120 characters) and a message (up to 600)' using errcode = '22023';
  end if;
  if v_deep_link is not null
     and (left(v_deep_link, 1) <> '/' or left(v_deep_link, 2) = '//') then
    raise exception 'Deep link must be an internal Coptic Vine path beginning with /' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.notification_devices d
    where d.user_id = v_user_id and d.app_key = 'chc' and d.enabled = true and d.provider in ('expo','web_push')
  ) then
    raise exception 'No Coptic Vine device is signed in to your account with notifications allowed' using errcode = '22023';
  end if;

  insert into public.notifications (user_id, app_key, category, event_type, title, body, deep_link, payload)
  values (v_user_id, 'chc', 'announcements', 'admin_test', v_title, v_body, v_deep_link, jsonb_build_object('source', 'chc_admin', 'test', true))
  returning id into v_notification_id;

  insert into private.notification_deliveries (notification_id, device_id, provider)
  select v_notification_id, d.id, d.provider
  from public.notification_devices d
  where d.user_id = v_user_id and d.app_key = 'chc' and d.enabled = true and d.provider in ('expo','web_push')
  on conflict do nothing;
  get diagnostics v_delivery_count = row_count;

  return jsonb_build_object('notificationId', v_notification_id, 'deliveryCount', v_delivery_count, 'queuedAt', now());
end;
$$;

revoke all on function public.admin_send_notification_test(text,text,text) from public, anon;
grant execute on function public.admin_send_notification_test(text,text,text) to authenticated, service_role;

-- —— What the admin sees ——————————————————————————————————————————————

create or replace function public.get_admin_notification_broadcast_overview(
  p_category text default 'feast_celebrations',
  p_history_limit integer default 20
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_category text := btrim(coalesce(p_category, ''));
  v_limit integer := greatest(1, least(coalesce(p_history_limit, 20), 50));
  v_user_id uuid := auth.uid();
  v_audience jsonb;
  v_my_devices integer := 0;
  v_dispatcher jsonb;
  v_history jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not (select private.is_admin()) then
    raise exception 'Admin role required' using errcode = '42501';
  end if;
  if v_category not in ('feast_celebrations','announcements') then
    raise exception 'Unsupported notification category' using errcode = '22023';
  end if;

  select jsonb_build_object(
    'devices', count(*),
    'signedInUsers', count(distinct a.user_id),
    'devicesWithoutAccount', count(*) filter (where a.user_id is null),
    'ios', count(*) filter (where a.platform = 'ios'),
    'android', count(*) filter (where a.platform = 'android'),
    'web', count(*) filter (where a.platform in ('web','windows'))
  )
  into v_audience
  from private.broadcast_audience(v_category) a;

  select count(*)::integer into v_my_devices
  from public.notification_devices d
  where d.user_id = v_user_id and d.app_key = 'chc' and d.enabled = true and d.provider in ('expo','web_push');

  -- Whether anything is being sent: the oldest delivery due and still waiting,
  -- and the last one handed to Apple, Google or a browser.
  select jsonb_build_object(
    'oldestWaitingAt', min(d.available_at) filter (where d.status = 'queued' and d.available_at <= now()),
    'waiting', count(*) filter (where d.status in ('queued','processing')),
    'lastSentAt', max(greatest(d.accepted_at, d.delivered_at))
  )
  into v_dispatcher
  from private.notification_deliveries d
  join public.notification_devices dev on dev.id = d.device_id
  where dev.app_key = 'chc';

  select coalesce(jsonb_agg(to_jsonb(h) order by h.created_at desc), '[]'::jsonb)
  into v_history
  from (
    select
      b.id,
      b.category,
      b.title,
      b.body,
      b.deep_link,
      b.recipient_count,
      b.delivery_count,
      b.created_at,
      (
        select jsonb_build_object(
          'waiting', count(*) filter (where d.status in ('queued','processing')),
          'sent', count(*) filter (where d.status = 'accepted'),
          'delivered', count(*) filter (where d.status = 'delivered'),
          'failed', count(*) filter (where d.status = 'failed'),
          'unreachable', count(*) filter (where d.status = 'disabled')
        )
        from private.notification_deliveries d
        where d.broadcast_id = b.id
      ) as delivery_status
    from public.notification_broadcasts b
    where b.app_key = 'chc'
    order by b.created_at desc
    limit v_limit
  ) h;

  return jsonb_build_object(
    'eligibleUserCount', coalesce((v_audience ->> 'signedInUsers')::integer, 0),
    'eligibleDeviceCount', coalesce((v_audience ->> 'devices')::integer, 0),
    'audience', v_audience,
    'myDeviceCount', v_my_devices,
    'dispatcher', v_dispatcher,
    'recentBroadcasts', v_history
  );
end;
$$;

revoke all on function public.get_admin_notification_broadcast_overview(text,integer) from public, anon;
grant execute on function public.get_admin_notification_broadcast_overview(text,integer) to authenticated, service_role;
