-- Coptic Vine Admin edits any artist's public profile: picture, name,
-- biography and links. This matters most for credit-only artists, people
-- credited on tracks who will never make an account (Fr. Gawargious Michael,
-- say): until now nobody could give them a picture or links. Name and picture
-- changes reach the artist's Learn cantor through the existing music.artists
-- triggers, as they do when an artist edits their own profile.
--
-- The link rules and the picture queueing move into private helpers, which
-- the artist's own update_creator_artist_profile now shares, unchanged.

-- ---------------------------------------------------------------------------
-- Shared by both profile editors
-- ---------------------------------------------------------------------------

-- Replaces an artist's links with p_social_links (a list of
-- { platform, label, url }), checking each link as the profile page does.
create or replace function private.replace_artist_social_links(p_artist_id uuid, p_social_links jsonb)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  link jsonb;
  v_platform text;
  v_label text;
  v_url text;
  v_position integer := 0;
begin
  if jsonb_typeof(p_social_links) <> 'array' then
    raise exception 'Social links must be a list' using errcode = '22023';
  end if;

  delete from music.artist_social_links link_row where link_row.artist_id = p_artist_id;

  for link in select value from jsonb_array_elements(p_social_links)
  loop
    v_platform := lower(trim(coalesce(link ->> 'platform', '')));
    v_label := nullif(trim(coalesce(link ->> 'label', '')), '');
    v_url := nullif(trim(coalesce(link ->> 'url', '')), '');

    if v_url is null then
      continue;
    end if;

    if v_url !~* '^https?://' then
      v_url := 'https://' || v_url;
    end if;

    if v_url !~* '^https?://[^[:space:]]+$' then
      raise exception 'Enter a valid web link for %', coalesce(v_label, v_platform)
        using errcode = '22023';
    end if;

    if v_platform not in (
      'website', 'linktree', 'youtube', 'soundcloud', 'spotify',
      'apple_music', 'facebook', 'instagram', 'tiktok', 'x', 'bandcamp'
    ) and v_platform not like 'custom:%' then
      raise exception 'Unknown artist link type: %', v_platform using errcode = '22023';
    end if;

    if v_platform like 'custom:%' and v_label is null then
      raise exception 'Extra links need a name' using errcode = '22023';
    end if;

    if v_platform = 'linktree'
       and v_url !~* '^https?://(www\.)?linktr\.ee(/|$)' then
      raise exception 'The Linktree field must contain a linktr.ee URL' using errcode = '22023';
    elsif v_platform = 'youtube'
       and v_url !~* '^https?://(([^/]+\.)?youtube\.com|youtu\.be)(/|$)' then
      raise exception 'The YouTube field must contain a YouTube URL' using errcode = '22023';
    elsif v_platform = 'soundcloud'
       and v_url !~* '^https?://([^/]+\.)?soundcloud\.com(/|$)' then
      raise exception 'The SoundCloud field must contain a SoundCloud URL' using errcode = '22023';
    elsif v_platform = 'spotify'
       and v_url !~* '^https?://(([^/]+\.)?spotify\.com|spotify\.link)(/|$)' then
      raise exception 'The Spotify field must contain a Spotify URL' using errcode = '22023';
    elsif v_platform = 'apple_music'
       and v_url !~* '^https?://music\.apple\.com(/|$)' then
      raise exception 'The Apple Music field must contain a music.apple.com URL' using errcode = '22023';
    elsif v_platform = 'facebook'
       and v_url !~* '^https?://(([^/]+\.)?facebook\.com|fb\.com|fb\.me)(/|$)' then
      raise exception 'The Facebook field must contain a Facebook URL' using errcode = '22023';
    elsif v_platform = 'instagram'
       and v_url !~* '^https?://([^/]+\.)?instagram\.com(/|$)' then
      raise exception 'The Instagram field must contain an Instagram URL' using errcode = '22023';
    end if;

    insert into music.artist_social_links (artist_id, platform, label, url, sort_order)
    values (
      p_artist_id,
      v_platform,
      case when v_platform like 'custom:%' then v_label else null end,
      v_url,
      v_position
    )
    on conflict (artist_id, platform) do update
    set label = excluded.label,
        url = excluded.url,
        sort_order = excluded.sort_order,
        updated_at = now();

    v_position := v_position + 1;
  end loop;
end;
$$;

-- Queues an uploaded image as the artist's new picture: it is processed like
-- any image and attached by private.attach_pending_artist_profile_image once
-- ready. The caller has already checked whose upload it is.
create or replace function private.queue_artist_profile_image(p_artist_id uuid, p_upload_intent_id uuid, p_actor uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  intent_record media.upload_intents%rowtype;
begin
  select * into intent_record from media.upload_intents intent where intent.id = p_upload_intent_id;
  if not found then
    raise exception 'Profile picture upload not found' using errcode = 'P0002';
  end if;
  if intent_record.media_type <> 'image'::media.media_type then
    raise exception 'A profile picture must be an image' using errcode = '22023';
  end if;

  perform public.enqueue_media_processing_job(
    p_upload_intent_id,
    'image_delivery'::media.processing_job_type,
    'chc-images'
  );

  update music.artists artist
  set metadata = coalesce(artist.metadata, '{}'::jsonb)
                 || jsonb_build_object('pendingProfileImageUploadIntentId', p_upload_intent_id),
      updated_by = p_actor,
      updated_at = now()
  where artist.id = p_artist_id;
end;
$$;

revoke all on function private.replace_artist_social_links(uuid, jsonb) from public;
revoke all on function private.queue_artist_profile_image(uuid, uuid, uuid) from public;

-- ---------------------------------------------------------------------------
-- The artist's own profile (Coptic Vine Artists): same behaviour, shared rules
-- ---------------------------------------------------------------------------

create or replace function public.update_creator_artist_profile(
  p_creator_account_id uuid,
  p_display_name text default null::text,
  p_sort_name text default null::text,
  p_biography text default null::text,
  p_social_links jsonb default null::jsonb,
  p_pinned_release_ids uuid[] default null::uuid[],
  p_profile_image_upload_intent_id uuid default null::uuid
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  request_user_id uuid := auth.uid();
  v_artist_id uuid;
  clean_name text := nullif(trim(coalesce(p_display_name, '')), '');
  v_position integer := 0;
  v_release_id uuid;
  intent_record media.upload_intents%rowtype;
begin
  if request_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not (select private.can_edit_creator_account(p_creator_account_id)) then
    raise exception 'Not authorized for creator account' using errcode = '42501';
  end if;

  select account.identity_artist_id into v_artist_id
  from creator.creator_accounts account
  where account.id = p_creator_account_id;

  if v_artist_id is null then
    raise exception 'This account has no artist identity yet' using errcode = 'P0002';
  end if;

  update music.artists artist
  set display_name = coalesce(clean_name, artist.display_name),
      sort_name = coalesce(nullif(trim(coalesce(p_sort_name, '')), ''), artist.sort_name),
      biography = case when p_biography is null then artist.biography else nullif(trim(p_biography), '') end,
      updated_by = request_user_id,
      updated_at = now()
  where artist.id = v_artist_id;

  -- The account is the artist, so renaming one renames the other.
  if clean_name is not null then
    update creator.creator_accounts account
    set display_name = clean_name,
        updated_by = request_user_id,
        updated_at = now()
    where account.id = p_creator_account_id;
  end if;

  if p_social_links is not null then
    perform private.replace_artist_social_links(v_artist_id, p_social_links);
  end if;

  if p_pinned_release_ids is not null then
    delete from music.artist_pinned_releases pin_row where pin_row.artist_id = v_artist_id;

    v_position := 0;
    foreach v_release_id in array p_pinned_release_ids
    loop
      -- You can only pin your own work.
      if exists (
        select 1 from music.releases release
        where release.id = v_release_id
          and release.owner_creator_account_id = p_creator_account_id
      ) then
        insert into music.artist_pinned_releases (artist_id, release_id, sort_order)
        values (v_artist_id, v_release_id, v_position)
        on conflict (artist_id, release_id) do update set sort_order = excluded.sort_order;
        v_position := v_position + 1;
      end if;
    end loop;
  end if;

  if p_profile_image_upload_intent_id is not null then
    select * into intent_record
    from media.upload_intents intent
    where intent.id = p_profile_image_upload_intent_id;

    if not found or intent_record.creator_account_id <> p_creator_account_id then
      raise exception 'Profile picture upload not found for this account' using errcode = 'P0002';
    end if;

    perform private.queue_artist_profile_image(v_artist_id, p_profile_image_upload_intent_id, request_user_id);
  end if;

  return public.get_creator_artist_profile(p_creator_account_id);
end;
$function$;

-- ---------------------------------------------------------------------------
-- Coptic Vine Admin
-- ---------------------------------------------------------------------------

-- The workspace an admin's picture upload is filed under: the artist's own,
-- else the admin's own (a credit-only artist has none).
create or replace function private.admin_artist_upload_account(p_artist_id uuid)
returns uuid
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce(
    (select artist.owner_creator_account_id from music.artists artist where artist.id = p_artist_id),
    (select account.id from creator.creator_accounts account where account.identity_artist_id = p_artist_id limit 1),
    (select member.creator_account_id
     from creator.creator_account_members member
     where member.user_id = (select auth.uid())
       and member.role in (
         'owner'::creator.creator_account_role,
         'manager'::creator.creator_account_role,
         'editor'::creator.creator_account_role,
         'uploader'::creator.creator_account_role)
     order by member.created_at
     limit 1)
  );
$$;

revoke all on function private.admin_artist_upload_account(uuid) from public;

create or replace function private.admin_artist_json(p_artist_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  select jsonb_build_object(
    'id', artist.id,
    'displayName', artist.display_name,
    'biography', artist.biography,
    'isCreditOnly', artist.is_credit_only,
    'publicationStatus', artist.publication_status,
    'workspace', (
      select jsonb_build_object('id', account.id, 'displayName', account.display_name)
      from creator.creator_accounts account
      where account.identity_artist_id = artist.id
      limit 1
    ),
    'profileImage', (
      select jsonb_build_object(
        'assetId', asset.id,
        'bucket', asset.bucket,
        'path', asset.path,
        'version', extract(epoch from asset.updated_at)::bigint
      )
      from media.media_assets asset
      where asset.id = artist.profile_image_asset_id
    ),
    'profileImagePending', artist.metadata ->> 'pendingProfileImageUploadIntentId',
    'socialLinks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', link.id,
        'platform', link.platform,
        'label', link.label,
        'url', link.url
      ) order by link.sort_order, link.platform)
      from music.artist_social_links link
      where link.artist_id = artist.id
    ), '[]'::jsonb),
    'creditCount', (
      select count(distinct credit.track_id) from music.track_artists credit where credit.artist_id = artist.id
    ),
    'releaseCount', (
      select count(*) from music.releases release where release.primary_artist_id = artist.id
    ),
    'uploadAccountId', private.admin_artist_upload_account(artist.id)
  )
  from music.artists artist
  where artist.id = p_artist_id;
$$;

revoke all on function private.admin_artist_json(uuid) from public;

-- Every artist on Coptic Vine, credit-only ones included, by name.
create or replace function public.get_admin_artists(p_search text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  search text := nullif(trim(coalesce(p_search, '')), '');
begin
  if auth.uid() is null or not private.is_admin() then
    raise exception 'Admin role required' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(private.admin_artist_json(artist.id) order by lower(artist.display_name), artist.id)
    from music.artists artist
    where search is null or artist.display_name ilike '%' || search || '%'
  ), '[]'::jsonb);
end;
$$;

create or replace function public.get_admin_artist_profile(p_artist_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  result jsonb;
begin
  if auth.uid() is null or not private.is_admin() then
    raise exception 'Admin role required' using errcode = '42501';
  end if;

  result := private.admin_artist_json(p_artist_id);
  if result is null then
    raise exception 'Artist not found' using errcode = 'P0002';
  end if;
  return result;
end;
$$;

-- Saves what Admin changed: a null argument leaves that part as it is, and an
-- empty biography clears it. A rename of an artist who is an account's
-- identity renames the account too, as on the artist's own profile.
create or replace function public.update_admin_artist_profile(
  p_artist_id uuid,
  p_display_name text default null,
  p_biography text default null,
  p_social_links jsonb default null,
  p_profile_image_upload_intent_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  actor uuid := auth.uid();
  clean_name text := nullif(trim(coalesce(p_display_name, '')), '');
  intent_record media.upload_intents%rowtype;
begin
  if actor is null or not private.is_admin() then
    raise exception 'Admin role required' using errcode = '42501';
  end if;

  perform 1 from music.artists artist where artist.id = p_artist_id for update;
  if not found then
    raise exception 'Artist not found' using errcode = 'P0002';
  end if;

  update music.artists artist
  set display_name = coalesce(clean_name, artist.display_name),
      biography = case when p_biography is null then artist.biography else nullif(trim(p_biography), '') end,
      updated_by = actor,
      updated_at = now()
  where artist.id = p_artist_id;

  if clean_name is not null then
    update creator.creator_accounts account
    set display_name = clean_name,
        updated_by = actor,
        updated_at = now()
    where account.identity_artist_id = p_artist_id
      and account.display_name is distinct from clean_name;
  end if;

  if p_social_links is not null then
    perform private.replace_artist_social_links(p_artist_id, p_social_links);
  end if;

  if p_profile_image_upload_intent_id is not null then
    select * into intent_record from media.upload_intents intent where intent.id = p_profile_image_upload_intent_id;
    -- Any upload this admin made, whichever workspace it was filed under.
    if not found or intent_record.requested_by is distinct from actor then
      raise exception 'Profile picture upload not found' using errcode = 'P0002';
    end if;
    perform private.queue_artist_profile_image(p_artist_id, p_profile_image_upload_intent_id, actor);
  end if;

  return private.admin_artist_json(p_artist_id);
end;
$$;

revoke all on function public.get_admin_artists(text) from public, anon;
revoke all on function public.get_admin_artist_profile(uuid) from public, anon;
revoke all on function public.update_admin_artist_profile(uuid, text, text, jsonb, uuid) from public, anon;
grant execute on function public.get_admin_artists(text) to authenticated;
grant execute on function public.get_admin_artist_profile(uuid) to authenticated;
grant execute on function public.update_admin_artist_profile(uuid, text, text, jsonb, uuid) to authenticated;

notify pgrst, 'reload schema';
