-- Lyrics Studio, again:
--
-- 1. Learn content is the account's when its workspace uploaded it. An artist
--    profile the workspace owns or was given counts only for content no
--    workspace owns. Before, a workspace that owned another artist's profile
--    (Pierre Kostantine owns the Cantor Tharwat Nady cantor, from before
--    Tharwat had an account) listed that artist's albums too.
-- 2. Each item says which release, Learn album or lesson set it belongs to,
--    and where in it, so the studio can be browsed release by release.

create or replace function private.learning_collection_is_mine(p_owner_creator_account_id uuid, p_cantor_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select case
    when p_owner_creator_account_id is not null then private.creator_account_is_mine(p_owner_creator_account_id)
    else private.learning_cantor_is_mine(p_cantor_id)
  end;
$$;

revoke all on function private.learning_collection_is_mine(uuid, uuid) from public;

create or replace function private.lyric_artwork_json(p_asset_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  select jsonb_build_object('bucket', asset.bucket, 'path', asset.path, 'version', extract(epoch from asset.updated_at)::bigint)
  from media.media_assets asset
  where asset.id = p_asset_id;
$$;

revoke all on function private.lyric_artwork_json(uuid) from public;

create or replace function public.get_lyric_editor_tracks()
returns jsonb
language plpgsql
stable security definer
set search_path to ''
as $function$
declare
  request_user_id uuid := auth.uid();
  payload jsonb;
begin
  if request_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select coalesce(jsonb_agg(track_row.payload order by track_row.updated_at desc, track_row.title), '[]'::jsonb)
  into payload
  from (
    select
      track.updated_at,
      track.title,
      jsonb_build_object(
        'id', track.id,
        'title', track.title,
        'subtitle', track.subtitle,
        'durationMs', track.duration_ms,
        'publicationStatus', track.publication_status,
        'mediaAsset', case when asset.id is null then null else jsonb_build_object(
          'id', asset.id,
          'provider', asset.provider,
          'bucket', asset.bucket,
          'path', asset.path,
          'mimeType', asset.mime_type,
          'durationMs', asset.duration_ms,
          'publicationStatus', asset.publication_status
        ) end,
        'collection', case when placed.release_id is null then null else jsonb_build_object(
          'id', placed.release_id,
          'kind', 'release',
          'title', placed.release_title,
          'releaseType', placed.release_type,
          'artwork', private.lyric_artwork_json(placed.cover_asset_id)
        ) end,
        'disc', placed.disc_number,
        'position', placed.track_number
      ) as payload
    from music.tracks track
    left join media.media_assets asset on asset.id = track.media_asset_id
    -- The release it first appeared on.
    left join lateral (
      select release.id as release_id, release.title as release_title, release.release_type,
             release.cover_asset_id, release_track.disc_number, release_track.track_number
      from music.release_tracks release_track
      join music.releases release on release.id = release_track.release_id
      where release_track.track_id = track.id
      order by release.created_at, release.id
      limit 1
    ) placed on true
    where private.creator_account_is_mine(track.owner_creator_account_id)
  ) track_row;

  return payload;
end;
$function$;

create or replace function public.get_learning_lyric_editor_items()
returns jsonb
language plpgsql
stable security definer
set search_path to ''
as $function$
declare request_user_id uuid:=auth.uid(); payload jsonb;
begin
  if request_user_id is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select coalesce(jsonb_agg(items.payload order by items.updated_at desc,items.title),'[]'::jsonb) into payload
  from (
    select r.updated_at,r.title,jsonb_build_object(
      'id',r.id,'targetType','learning_album_recording','title',r.title,'subtitle',a.title,
      'durationMs',coalesce(r.duration_ms,asset.duration_ms),'publicationStatus',r.publication_status,
      'maxSyncPrecision','line','mediaAsset',jsonb_build_object('id',asset.id,'provider',asset.provider,
        'bucket',asset.bucket,'path',asset.path,'mimeType',asset.mime_type,'durationMs',asset.duration_ms,
        'publicationStatus',asset.publication_status),
      'collection',jsonb_build_object('id',a.id,'kind','learning_album','title',a.title,
        'artwork',private.lyric_artwork_json(a.cover_asset_id)),
      'position',row_number() over (partition by a.id order by r.sort_order, r.id)) payload
    from learning.album_recordings r join learning.albums a on a.id=r.album_id
    join media.media_assets asset on asset.id=r.media_asset_id
    where private.learning_collection_is_mine(a.owner_creator_account_id, a.cantor_id)
    union all
    select numbered.updated_at, public.learning_lesson_title('en', numbered.lesson_number), jsonb_build_object(
      'id',numbered.id,'targetType','learning_lesson',
      'title',public.learning_lesson_title('en', numbered.lesson_number),'subtitle',numbered.set_title,
      'lessonSetId',numbered.lesson_set_id,'lessonNumber',numbered.lesson_number,'mediaType',numbered.media_type,
      'durationMs',numbered.duration_ms,'publicationStatus',numbered.publication_status,
      'maxSyncPrecision','unsynced','mediaAsset',numbered.media_asset,
      'collection',jsonb_build_object('id',numbered.lesson_set_id,'kind','lesson_set','title',numbered.set_title,
        'artwork',private.lyric_artwork_json(numbered.cover_asset_id)),
      'position',numbered.lesson_number) payload
    from (
      -- A whole set is listed or not, so every lesson of a listed set is
      -- here and the row number is its place in the set.
      -- The lesson auditions by its sound alone (the smaller file) when it has one.
      select l.id, l.updated_at, l.lesson_set_id, l.media_type, l.publication_status, s.title as set_title, s.cover_asset_id,
        row_number() over (partition by l.lesson_set_id order by l.sort_order, l.id) as lesson_number,
        coalesce(l.duration_ms,audio.duration_ms,asset.duration_ms) as duration_ms,
        jsonb_build_object('id',coalesce(audio.id,asset.id),
          'provider',coalesce(audio.provider,asset.provider),'bucket',coalesce(audio.bucket,asset.bucket),
          'path',coalesce(audio.path,asset.path),'mimeType',coalesce(audio.mime_type,asset.mime_type),
          'durationMs',coalesce(audio.duration_ms,asset.duration_ms),'publicationStatus',coalesce(audio.publication_status,asset.publication_status)) as media_asset
      from learning.lessons l join learning.lesson_sets s on s.id=l.lesson_set_id
      join media.media_assets asset on asset.id=l.media_asset_id
      left join media.media_assets audio on audio.id=l.audio_asset_id
      where private.learning_collection_is_mine(s.owner_creator_account_id, s.cantor_id)
    ) numbered
  ) items;
  return payload;
end;
$function$;
