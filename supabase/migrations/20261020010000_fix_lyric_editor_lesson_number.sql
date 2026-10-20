-- Lyrics Studio failed to load with "column numbered.lesson_number does not
-- exist". 20261017120000 numbered each lesson to title it, but did not select
-- the number it also sends as lessonNumber. The number is now selected and
-- the title is made from it: a lesson's place in its set, as everywhere else.

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
    where private.learning_lyric_item_is_editable('album_recording'::learning.playlist_item_kind,r.id)
    union all
    select numbered.updated_at, public.learning_lesson_title('en', numbered.lesson_number), jsonb_build_object(
      'id',numbered.id,'targetType','learning_lesson',
      'title',public.learning_lesson_title('en', numbered.lesson_number),'subtitle',numbered.set_title,
      'lessonSetId',numbered.lesson_set_id,'lessonNumber',numbered.lesson_number,'mediaType',numbered.media_type,
      'durationMs',numbered.duration_ms,'publicationStatus',numbered.publication_status,
      'maxSyncPrecision','unsynced','mediaAsset',numbered.media_asset) payload
    from (
      -- Editability is per lesson set, so every lesson of an editable set is
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
      where private.learning_lyric_item_is_editable('lesson'::learning.playlist_item_kind,l.id)
    ) numbered
  ) items;
  return payload;
end;
$function$;
