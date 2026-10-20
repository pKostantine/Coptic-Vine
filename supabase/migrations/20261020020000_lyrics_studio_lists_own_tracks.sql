-- Lyrics Studio (in Coptic Vine Artists, the only caller of these two lists)
-- lists what is linked to the signed-in account: the tracks of a workspace it
-- belongs to, and the Learn content of that workspace or of an artist profile
-- the workspace owns or was given. Before, an admin's Lyrics Studio listed
-- every track on Coptic Vine, because the lists reused the editing check,
-- which lets admins edit anything. Opening and saving lyrics keep that check.

-- A workspace the signed-in user belongs to, with a role that may edit it.
-- Unlike private.can_edit_creator_account, being an admin is not enough.
create or replace function private.creator_account_is_mine(p_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select p_account_id is not null and exists (
    select 1
    from creator.creator_account_members member
    where member.creator_account_id = p_account_id
      and member.user_id = (select auth.uid())
      and member.role in (
        'owner'::creator.creator_account_role,
        'manager'::creator.creator_account_role,
        'editor'::creator.creator_account_role,
        'uploader'::creator.creator_account_role
      )
  );
$$;

-- An artist profile (cantor) that one of the user's workspaces owns or was given.
create or replace function private.learning_cantor_is_mine(p_cantor_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
      select 1 from learning.cantors cantor
      where cantor.id = p_cantor_id and private.creator_account_is_mine(cantor.owner_creator_account_id))
    or exists (
      select 1 from learning.cantor_permissions permission
      where permission.cantor_id = p_cantor_id and private.creator_account_is_mine(permission.creator_account_id));
$$;

revoke all on function private.creator_account_is_mine(uuid) from public;
revoke all on function private.learning_cantor_is_mine(uuid) from public;

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
        ) end
      ) as payload
    from music.tracks track
    left join media.media_assets asset on asset.id = track.media_asset_id
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
        'publicationStatus',asset.publication_status)) payload
    from learning.album_recordings r join learning.albums a on a.id=r.album_id
    join media.media_assets asset on asset.id=r.media_asset_id
    where private.creator_account_is_mine(a.owner_creator_account_id) or private.learning_cantor_is_mine(a.cantor_id)
    union all
    select numbered.updated_at, public.learning_lesson_title('en', numbered.lesson_number), jsonb_build_object(
      'id',numbered.id,'targetType','learning_lesson',
      'title',public.learning_lesson_title('en', numbered.lesson_number),'subtitle',numbered.set_title,
      'lessonSetId',numbered.lesson_set_id,'lessonNumber',numbered.lesson_number,'mediaType',numbered.media_type,
      'durationMs',numbered.duration_ms,'publicationStatus',numbered.publication_status,
      'maxSyncPrecision','unsynced','mediaAsset',numbered.media_asset) payload
    from (
      -- A whole set is linked or not, so every lesson of a listed set is
      -- here and the row number is its place in the set.
      -- The lesson auditions by its sound alone (the smaller file) when it has one.
      select l.id, l.updated_at, l.lesson_set_id, l.media_type, l.publication_status, s.title as set_title,
        row_number() over (partition by l.lesson_set_id order by l.sort_order, l.id) as lesson_number,
        coalesce(l.duration_ms,audio.duration_ms,asset.duration_ms) as duration_ms,
        jsonb_build_object('id',coalesce(audio.id,asset.id),
          'provider',coalesce(audio.provider,asset.provider),'bucket',coalesce(audio.bucket,asset.bucket),
          'path',coalesce(audio.path,asset.path),'mimeType',coalesce(audio.mime_type,asset.mime_type),
          'durationMs',coalesce(audio.duration_ms,asset.duration_ms),'publicationStatus',coalesce(audio.publication_status,asset.publication_status)) as media_asset
      from learning.lessons l join learning.lesson_sets s on s.id=l.lesson_set_id
      join media.media_assets asset on asset.id=l.media_asset_id
      left join media.media_assets audio on audio.id=l.audio_asset_id
      where private.creator_account_is_mine(s.owner_creator_account_id) or private.learning_cantor_is_mine(s.cantor_id)
    ) numbered
  ) items;
  return payload;
end;
$function$;
