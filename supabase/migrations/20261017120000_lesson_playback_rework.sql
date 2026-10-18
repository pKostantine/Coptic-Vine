-- Lesson playback rework: what the catalogue must say for a lesson to play
-- as video or as sound alone from anywhere in the app, and for the artist
-- and listener to see the right lesson.
--
-- * Lessons are numbered by their place in the set (row_number), not by
--   `sort_order + 1`: submission items start at 1 after the artwork at 0, so
--   the only live lesson was "Lesson 2".
-- * Every audio and video asset gets its duration, size and codec from the
--   probe the processor stored (all were NULL), now and going forward; lessons
--   and recordings get their durations too.
-- * The audio-only rendition (`audioAsset`) is sent with lessons everywhere a
--   lesson can be played from: playlists, My Learning, search.
-- * The lyrics RPC answers an item it cannot show with an empty list rather
--   than NULL (the app treated NULL as an error), and anonymous readers may
--   evaluate the lyric-set policy's editability branch, as they can music's.
-- * My Learning's Arabic lesson title had been stored double-encoded.

-- ---------------------------------------------------------------------------
-- Durations and picture sizes from the stored probes
-- ---------------------------------------------------------------------------
create or replace function private.media_probe_duration_ms(p_probe jsonb)
returns bigint
language sql
immutable
set search_path = ''
as $function$
  select case
    when (p_probe->'output'->'format'->>'duration') ~ '^[0-9]+(\.[0-9]+)?$'
      then nullif(round((p_probe->'output'->'format'->>'duration')::numeric * 1000), 0)::bigint
    else null
  end;
$function$;

create or replace function private.media_probe_bitrate(p_probe jsonb)
returns integer
language sql
immutable
set search_path = ''
as $function$
  select case
    when (p_probe->'output'->'format'->>'bit_rate') ~ '^[0-9]+$'
      then nullif((p_probe->'output'->'format'->>'bit_rate')::bigint, 0)::integer
    else null
  end;
$function$;

-- The first video stream's codec and size; the picture's size is swapped
-- when the stream carries a quarter turn (a phone held upright, stream-copied).
create or replace function private.media_probe_video(p_probe jsonb)
returns table(codec text, width integer, height integer)
language sql
immutable
set search_path = ''
as $function$
  with stream as (
    select s
    from jsonb_array_elements(coalesce(p_probe->'output'->'streams', '[]'::jsonb)) s
    where s->>'codec_type' = 'video'
    limit 1
  ),
  size as (
    select
      s->>'codec_name' as codec,
      case when (s->>'width') ~ '^[0-9]+$' then (s->>'width')::integer end as w,
      case when (s->>'height') ~ '^[0-9]+$' then (s->>'height')::integer end as h,
      exists (
        select 1 from jsonb_array_elements(coalesce(s->'side_data_list', '[]'::jsonb)) d
        where (d->>'rotation') ~ '^-?[0-9]+(\.[0-9]+)?$' and abs(round((d->>'rotation')::numeric)::integer) % 180 = 90
      ) or (s->'tags'->>'rotate') in ('90', '270', '-90') as turned
    from stream
  )
  select codec, case when turned then h else w end, case when turned then w else h end from size;
$function$;

create or replace function private.media_probe_audio_codec(p_probe jsonb)
returns text
language sql
immutable
set search_path = ''
as $function$
  select s->>'codec_name'
  from jsonb_array_elements(coalesce(p_probe->'output'->'streams', '[]'::jsonb)) s
  where s->>'codec_type' = 'audio'
  limit 1;
$function$;

revoke all on function private.media_probe_duration_ms(jsonb) from public;
revoke all on function private.media_probe_bitrate(jsonb) from public;
revoke all on function private.media_probe_video(jsonb) from public;
revoke all on function private.media_probe_audio_codec(jsonb) from public;

-- Fills an asset's duration, bitrate, codec and size from its probe where the
-- columns are still empty.
create or replace function private.fill_media_asset_from_probe(p_asset_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  asset_record media.media_assets%rowtype;
  probe jsonb;
  video record;
begin
  select * into asset_record from media.media_assets where id = p_asset_id;
  if not found then return; end if;
  probe := asset_record.metadata->'probe';
  if probe is null then return; end if;
  select * into video from private.media_probe_video(probe);
  update media.media_assets asset
  set duration_ms = coalesce(asset.duration_ms, private.media_probe_duration_ms(probe)),
      bitrate = coalesce(asset.bitrate, private.media_probe_bitrate(probe)),
      codec = coalesce(asset.codec, case when asset.media_type = 'video'::media.media_type then video.codec else private.media_probe_audio_codec(probe) end),
      width = coalesce(asset.width, case when asset.media_type = 'video'::media.media_type then video.width end),
      height = coalesce(asset.height, case when asset.media_type = 'video'::media.media_type then video.height end)
  where asset.id = p_asset_id
    and (asset.duration_ms is null or asset.bitrate is null or asset.codec is null
      or (asset.media_type = 'video'::media.media_type and (asset.width is null or asset.height is null)));
end;
$function$;

revoke all on function private.fill_media_asset_from_probe(uuid) from public;

-- Going forward: a finished delivery job fills its asset's measurements.
create or replace function public.complete_media_processing_job(p_worker_token text, p_job_id uuid, p_output_mime_type text, p_output_size_bytes bigint, p_output_checksum_sha256 text, p_probe jsonb DEFAULT '{}'::jsonb)
returns table(job_id uuid, status media.processing_job_status, media_asset_id uuid, media_asset_version_id uuid, output_bucket text, output_path text)
language plpgsql
security definer
set search_path = ''
as $function$
#variable_conflict use_column
declare
  job_record media.media_processing_jobs%rowtype;
  source_intent media.upload_intents%rowtype;
  new_media_asset_id uuid;
  new_media_asset_version_id uuid;
  normalized_mime_type text;
  expected_media_type media.media_type;
  allowed_mime_types text[];
  probe_video record;
begin
  if not private.verify_media_worker_token(p_worker_token) then
    raise exception 'Invalid media worker token' using errcode = '28000';
  end if;

  select *
  into job_record
  from media.media_processing_jobs job
  where job.id = p_job_id
  for update;

  if not found then
    raise exception 'Processing job not found' using errcode = 'P0002';
  end if;

  if job_record.status <> 'processing'::media.processing_job_status then
    raise exception 'Processing job is not claimed' using errcode = '22023';
  end if;

  if job_record.output_path is null then
    raise exception 'Processing job has no output path' using errcode = '22023';
  end if;

  -- The delivery media type and the MIME types accepted for it are both a
  -- function of the job type, so an image job can no longer be rejected by the
  -- audio-only rules this function used to apply to every job.
  case job_record.job_type
    when 'audio_delivery'::media.processing_job_type then
      expected_media_type := 'audio'::media.media_type;
      allowed_mime_types := array['audio/mp4', 'audio/x-m4a'];
    when 'video_delivery'::media.processing_job_type then
      expected_media_type := 'video'::media.media_type;
      allowed_mime_types := array['video/mp4'];
    when 'image_delivery'::media.processing_job_type then
      expected_media_type := 'image'::media.media_type;
      allowed_mime_types := array['image/jpeg', 'image/png', 'image/webp'];
    else
      raise exception 'Processing job type % cannot produce a delivery asset', job_record.job_type
        using errcode = '22023';
  end case;

  normalized_mime_type := lower(trim(coalesce(p_output_mime_type, '')));

  if normalized_mime_type <> all (allowed_mime_types) then
    raise exception 'Invalid output MIME type % for job type %', p_output_mime_type, job_record.job_type
      using errcode = '22023';
  end if;

  if p_output_size_bytes is null or p_output_size_bytes <= 0 then
    raise exception 'Invalid output size' using errcode = '22023';
  end if;

  if p_output_checksum_sha256 is null or lower(trim(p_output_checksum_sha256)) !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid output checksum' using errcode = '22023';
  end if;

  select *
  into source_intent
  from media.upload_intents intent
  where intent.id = job_record.upload_intent_id;

  if not found then
    raise exception 'Source upload intent not found' using errcode = 'P0002';
  end if;

  select * into probe_video from private.media_probe_video(coalesce(p_probe, '{}'::jsonb));

  insert into media.media_assets (
    owner_creator_account_id,
    provider,
    bucket,
    path,
    media_type,
    mime_type,
    file_size_bytes,
    checksum,
    duration_ms,
    bitrate,
    codec,
    width,
    height,
    processing_status,
    publication_status,
    metadata,
    created_by,
    updated_by
  )
  values (
    source_intent.creator_account_id,
    'cloudflare_r2'::media.media_provider,
    job_record.output_bucket,
    job_record.output_path,
    expected_media_type,
    normalized_mime_type,
    p_output_size_bytes,
    lower(trim(p_output_checksum_sha256)),
    private.media_probe_duration_ms(coalesce(p_probe, '{}'::jsonb)),
    private.media_probe_bitrate(coalesce(p_probe, '{}'::jsonb)),
    case when expected_media_type = 'video'::media.media_type then probe_video.codec else private.media_probe_audio_codec(coalesce(p_probe, '{}'::jsonb)) end,
    case when expected_media_type = 'video'::media.media_type then probe_video.width end,
    case when expected_media_type = 'video'::media.media_type then probe_video.height end,
    'completed'::media.processing_status,
    'draft'::media.publication_status,
    jsonb_build_object(
      'sourceUploadIntentId', source_intent.id,
      'sourceBucket', job_record.input_bucket,
      'sourcePath', job_record.input_path,
      'probe', coalesce(p_probe, '{}'::jsonb)
    ),
    source_intent.requested_by,
    source_intent.requested_by
  )
  on conflict (provider, bucket, path) do update
  set media_type = excluded.media_type,
      mime_type = excluded.mime_type,
      file_size_bytes = excluded.file_size_bytes,
      checksum = excluded.checksum,
      duration_ms = excluded.duration_ms,
      bitrate = excluded.bitrate,
      codec = excluded.codec,
      width = excluded.width,
      height = excluded.height,
      processing_status = 'completed'::media.processing_status,
      metadata = excluded.metadata,
      updated_by = excluded.updated_by,
      updated_at = now()
  returning id into new_media_asset_id;

  insert into media.media_asset_versions (
    media_asset_id,
    version,
    provider,
    bucket,
    path,
    mime_type,
    file_size_bytes,
    checksum,
    duration_ms,
    bitrate,
    codec,
    width,
    height,
    processing_status,
    created_by
  )
  values (
    new_media_asset_id,
    1,
    'cloudflare_r2'::media.media_provider,
    job_record.output_bucket,
    job_record.output_path,
    normalized_mime_type,
    p_output_size_bytes,
    lower(trim(p_output_checksum_sha256)),
    private.media_probe_duration_ms(coalesce(p_probe, '{}'::jsonb)),
    private.media_probe_bitrate(coalesce(p_probe, '{}'::jsonb)),
    case when expected_media_type = 'video'::media.media_type then probe_video.codec else private.media_probe_audio_codec(coalesce(p_probe, '{}'::jsonb)) end,
    case when expected_media_type = 'video'::media.media_type then probe_video.width end,
    case when expected_media_type = 'video'::media.media_type then probe_video.height end,
    'completed'::media.processing_status,
    source_intent.requested_by
  )
  on conflict on constraint media_asset_versions_media_asset_id_version_key do update
  set mime_type = excluded.mime_type,
      file_size_bytes = excluded.file_size_bytes,
      checksum = excluded.checksum,
      duration_ms = excluded.duration_ms,
      bitrate = excluded.bitrate,
      codec = excluded.codec,
      width = excluded.width,
      height = excluded.height,
      processing_status = 'completed'::media.processing_status
  returning id into new_media_asset_version_id;

  update media.media_processing_jobs job
  set status = 'completed'::media.processing_job_status,
      media_asset_id = new_media_asset_id,
      media_asset_version_id = new_media_asset_version_id,
      output_mime_type = normalized_mime_type,
      output_size_bytes = p_output_size_bytes,
      output_checksum_sha256 = lower(trim(p_output_checksum_sha256)),
      probe = coalesce(p_probe, '{}'::jsonb),
      finished_at = now(),
      error_message = null
  where job.id = job_record.id
  returning
    job.id,
    job.status,
    job.media_asset_id,
    job.media_asset_version_id,
    job.output_bucket,
    job.output_path
  into
    job_id,
    status,
    media_asset_id,
    media_asset_version_id,
    output_bucket,
    output_path;

  -- Link the finished asset to its submission item and, when this was the last
  -- outstanding item, take the submission out of `processing` so it is ready to
  -- publish without a manual status change.
  perform private.settle_submission_processing(job_record.upload_intent_id);

  return next;
end;
$function$;

-- Every existing audio and video asset, and the lessons and recordings made
-- from them.
do $$
declare
  asset_id uuid;
begin
  for asset_id in
    select id from media.media_assets
    where media_type in ('audio'::media.media_type, 'video'::media.media_type)
      and metadata ? 'probe'
      and (duration_ms is null or bitrate is null or codec is null
        or (media_type = 'video'::media.media_type and (width is null or height is null)))
  loop
    perform private.fill_media_asset_from_probe(asset_id);
  end loop;
end $$;

update learning.lessons lesson
set duration_ms = coalesce(audio.duration_ms, asset.duration_ms),
    updated_at = now()
from media.media_assets asset
left join media.media_assets audio on audio.id = lesson.audio_asset_id
where asset.id = lesson.media_asset_id
  and lesson.duration_ms is null
  and coalesce(audio.duration_ms, asset.duration_ms) is not null;

update learning.album_recordings recording
set duration_ms = asset.duration_ms,
    updated_at = now()
from media.media_assets asset
where asset.id = recording.media_asset_id
  and recording.duration_ms is null
  and asset.duration_ms is not null;

-- A lesson's duration follows its asset once the asset is measured (a
-- lesson is inserted before, or as, its audio rendition finishes).
create or replace function private.attach_completed_submission_jobs(p_submission_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  affected_count integer := 0;
  changed_count integer := 0;
begin
  -- Only the delivery matching the source media type becomes the item's
  -- primary asset. This prevents a video's extracted M4A replacing its MP4.
  with primary_jobs as (
    select distinct on (item.id) item.id item_id, job.id processing_job_id, job.media_asset_id
    from media.submission_items item
    join media.upload_intents intent on intent.id = item.upload_intent_id
    join media.media_processing_jobs job on job.upload_intent_id = intent.id
      and job.job_type = case intent.media_type
        when 'audio'::media.media_type then 'audio_delivery'::media.processing_job_type
        when 'video'::media.media_type then 'video_delivery'::media.processing_job_type
        when 'image'::media.media_type then 'image_delivery'::media.processing_job_type end
      and job.status = 'completed'::media.processing_job_status
      and job.media_asset_id is not null
    where item.submission_id = p_submission_id
    order by item.id, job.finished_at desc nulls last, job.created_at desc
  )
  update media.submission_items item set
    media_asset_id = coalesce(item.media_asset_id, primary_jobs.media_asset_id),
    media_processing_job_id = primary_jobs.processing_job_id
  from primary_jobs where item.id = primary_jobs.item_id
    and (item.media_asset_id is distinct from coalesce(item.media_asset_id, primary_jobs.media_asset_id)
      or item.media_processing_job_id is distinct from primary_jobs.processing_job_id);
  get diagnostics affected_count = row_count;

  with audio_jobs as (
    select distinct on (item.id) item.id item_id, job.media_asset_id
    from media.submission_items item
    join media.upload_intents intent on intent.id=item.upload_intent_id and intent.media_type='video'::media.media_type
    join media.media_processing_jobs job on job.upload_intent_id=intent.id
      and job.job_type='audio_delivery'::media.processing_job_type
      and job.status='completed'::media.processing_job_status and job.media_asset_id is not null
    where item.submission_id=p_submission_id
    order by item.id,job.finished_at desc nulls last,job.created_at desc
  )
  update media.submission_items item set audio_only_asset_id=audio_jobs.media_asset_id,updated_at=now()
  from audio_jobs where item.id=audio_jobs.item_id and item.audio_only_asset_id is distinct from audio_jobs.media_asset_id;
  get diagnostics changed_count = row_count;
  affected_count := affected_count + changed_count;

  update music.tracks track set
    media_asset_id=item.media_asset_id,
    duration_ms=coalesce(track.duration_ms,nullif(round((job.probe->'output'->'format'->>'duration')::numeric*1000),0)::bigint),
    updated_at=now()
  from media.submission_items item
  left join media.media_processing_jobs job on job.id=item.media_processing_job_id
  where item.submission_id=p_submission_id and item.music_track_id=track.id
    and item.media_asset_id is not null and track.media_asset_id is distinct from item.media_asset_id;

  -- This also fills existing published video lessons when their backfilled
  -- audio job completes.
  update learning.lessons lesson set audio_asset_id=item.audio_only_asset_id,updated_at=now()
  from media.submission_items item
  where item.submission_id=p_submission_id and item.audio_only_asset_id is not null
    and lesson.metadata->>'submissionItemId'=item.id::text
    and lesson.audio_asset_id is distinct from item.audio_only_asset_id;

  update learning.lessons lesson
  set duration_ms = coalesce(audio.duration_ms, asset.duration_ms), updated_at = now()
  from media.submission_items item
  join media.media_assets asset on asset.id = item.media_asset_id
  left join media.media_assets audio on audio.id = item.audio_only_asset_id
  where item.submission_id = p_submission_id
    and lesson.metadata->>'submissionItemId' = item.id::text
    and lesson.duration_ms is null
    and coalesce(audio.duration_ms, asset.duration_ms) is not null;

  update learning.album_recordings recording
  set duration_ms = asset.duration_ms, updated_at = now()
  from media.submission_items item
  join media.media_assets asset on asset.id = item.media_asset_id
  where item.submission_id = p_submission_id
    and recording.media_asset_id = item.media_asset_id
    and recording.duration_ms is null
    and asset.duration_ms is not null;

  update media.media_assets asset set publication_status='published'::media.publication_status,updated_at=now()
  where asset.id in (
    select lesson.audio_asset_id from learning.lessons lesson
    where lesson.publication_status='published'::media.publication_status and lesson.audio_asset_id is not null
  ) and asset.publication_status is distinct from 'published'::media.publication_status;

  return affected_count;
end;
$function$;

-- ---------------------------------------------------------------------------
-- The lesson's name: its place in the set
-- ---------------------------------------------------------------------------
-- In `public`, not `private`: the catalogue RPCs run with the reader's own
-- rights, and anonymous readers have no USAGE on the private schema.
create or replace function public.learning_lesson_title(p_locale text, p_number bigint)
returns text
language sql
immutable
set search_path = ''
as $function$
  select case
    when p_locale = 'ar' then 'الدرس ' || p_number::text
    when p_locale = 'fr' then 'Leçon ' || p_number::text
    else 'Lesson ' || p_number::text
  end;
$function$;

revoke all on function public.learning_lesson_title(text, bigint) from public;
grant execute on function public.learning_lesson_title(text, bigint) to anon, authenticated;

-- An asset as the app reads it, with its measurements.
create or replace function public.learning_asset_json(a media.media_assets)
returns jsonb
language sql
immutable
set search_path = ''
as $function$
  select case when a.id is null then null else jsonb_strip_nulls(jsonb_build_object(
    'id', a.id, 'provider', a.provider, 'bucket', a.bucket, 'path', a.path, 'mimeType', a.mime_type,
    'durationMs', a.duration_ms, 'fileSizeBytes', a.file_size_bytes, 'checksum', a.checksum,
    'width', a.width, 'height', a.height
  )) end;
$function$;

revoke all on function public.learning_asset_json(media.media_assets) from public;
grant execute on function public.learning_asset_json(media.media_assets) to anon, authenticated;

create or replace function public.get_published_learning_lesson_set(p_lesson_set_id uuid, p_locale text DEFAULT 'en'::text)
returns jsonb
language sql
stable
set search_path to 'pg_catalog', 'public'
as $function$
  select jsonb_build_object(
    'id',ls.id,'title',coalesce(lsl.title,ls.title),'description',coalesce(lsl.description,ls.description),
    'releaseTimingMode',ls.release_timing_mode,'scheduledReleaseAt',ls.scheduled_release_at,
    'originalReleaseDate',ls.original_release_date,
    'displayDate',coalesce(ls.original_release_date::timestamptz,ls.scheduled_release_at,ls.created_at),
    'cantor',jsonb_build_object('id',c.id,'displayName',coalesce(cl.display_name,c.display_name)),
    'season',case when s.id is null then null else jsonb_build_object('id',s.id,'slug',s.slug,'title',coalesce(sl.title,s.title)) end,
    'hymn',jsonb_build_object('id',h.id,'sourceHymnKey',h.source_hymn_key,'title',coalesce(hl.title,h.title),'subtitle',coalesce(hl.subtitle,h.subtitle)),
    'coverAsset',case when cover.id is null then null else jsonb_build_object('id',cover.id,'provider',cover.provider,'bucket',cover.bucket,'path',cover.path,'mimeType',cover.mime_type,'fileSizeBytes',cover.file_size_bytes,'checksum',cover.checksum) end,
    'lessons',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',numbered.id,'mediaType',numbered.media_type,
        'title',coalesce(numbered.localized_title, public.learning_lesson_title(p_locale, numbered.lesson_number)),
        'description',numbered.description,
        'durationMs',numbered.duration_ms,
        'sortOrder',numbered.sort_order,
        'mediaAsset',numbered.media_asset,
        'audioAsset',numbered.audio_asset
      ) order by numbered.sort_order, numbered.id)
      from (
        select l.id, l.media_type, l.sort_order,
          row_number() over (order by l.sort_order, l.id) as lesson_number,
          ll.title as localized_title,
          coalesce(ll.description,l.description) as description,
          coalesce(l.duration_ms,audio.duration_ms,asset.duration_ms) as duration_ms,
          public.learning_asset_json(asset) as media_asset,
          public.learning_asset_json(audio) as audio_asset
        from learning.lessons l
        join media.media_assets asset on asset.id=l.media_asset_id and asset.publication_status='published'
        left join media.media_assets audio on audio.id=l.audio_asset_id and audio.publication_status='published'
        left join learning.lesson_localizations ll on ll.lesson_id=l.id and ll.locale=p_locale
        where l.lesson_set_id=ls.id and l.publication_status='published'
      ) numbered
    ),'[]'::jsonb)
  )
  from learning.lesson_sets ls
  join learning.cantors c on c.id=ls.cantor_id and c.publication_status='published'
  join learning.hymns h on h.id=ls.hymn_id and h.publication_status='published'
  left join learning.cantor_localizations cl on cl.cantor_id=c.id and cl.locale=p_locale
  left join learning.lesson_set_localizations lsl on lsl.lesson_set_id=ls.id and lsl.locale=p_locale
  left join learning.hymn_localizations hl on hl.hymn_id=h.id and hl.locale=p_locale
  left join learning.seasons s on s.id=ls.season_id and s.publication_status='published'
  left join learning.season_localizations sl on sl.season_id=s.id and sl.locale=p_locale
  left join media.media_assets cover on cover.id=ls.cover_asset_id and cover.publication_status='published'
  where ls.id=p_lesson_set_id and ls.publication_status='published';
$function$;

create or replace function public.get_learning_lyric_editor_items()
returns jsonb
language plpgsql
stable
security definer
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
    select numbered.updated_at, numbered.title, jsonb_build_object(
      'id',numbered.id,'targetType','learning_lesson','title',numbered.title,'subtitle',numbered.set_title,
      'lessonSetId',numbered.lesson_set_id,'lessonNumber',numbered.lesson_number,'mediaType',numbered.media_type,
      'durationMs',numbered.duration_ms,'publicationStatus',numbered.publication_status,
      'maxSyncPrecision','unsynced','mediaAsset',numbered.media_asset) payload
    from (
      -- The lesson auditions by its sound alone (the smaller file) when it has one.
      select l.id, l.updated_at, l.lesson_set_id, l.media_type, l.publication_status, s.title as set_title,
        public.learning_lesson_title('en', row_number() over (partition by l.lesson_set_id order by l.sort_order, l.id)) as title,
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

create or replace function public.get_my_learning_items(p_locale text DEFAULT 'en'::text)
returns jsonb
language sql
stable
set search_path to 'pg_catalog', 'public'
as $function$
  select jsonb_build_object(
    'authenticated', auth.uid() is not null,
    'likedItemIds', coalesce((select jsonb_agg(coalesce(l.album_recording_id,l.lesson_id)) from learning.item_likes l where l.user_id=auth.uid()), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(payload order by updated_at desc)
      from (
        select ip.updated_at, jsonb_build_object(
          'progressId', ip.id, 'itemKind', ip.item_kind, 'itemId', r.id, 'state', ip.state,
          'title', coalesce(rl.title,r.title), 'subtitle', coalesce(rl.subtitle,r.subtitle), 'mediaType', 'audio',
          'durationMs', coalesce(r.duration_ms,ma.duration_ms), 'containerId', a.id, 'containerTitle', coalesce(al.title,a.title),
          'cantorId', c.id, 'cantorName', coalesce(cl.display_name,c.display_name), 'hymnId', r.hymn_id,
          'mediaAsset', public.learning_asset_json(ma),
          'coverAsset', case when cover.id is null then null else jsonb_build_object('id',cover.id,'provider',cover.provider,'bucket',cover.bucket,'path',cover.path,'mimeType',cover.mime_type,'fileSizeBytes',cover.file_size_bytes,'checksum',cover.checksum) end
        ) payload
        from learning.item_progress ip
        join learning.album_recordings r on r.id=ip.album_recording_id and r.publication_status='published'
        join learning.albums a on a.id=r.album_id and a.publication_status='published'
        join learning.cantors c on c.id=a.cantor_id and c.publication_status='published'
        join media.media_assets ma on ma.id=r.media_asset_id and ma.publication_status='published'
        left join learning.recording_localizations rl on rl.recording_id=r.id and rl.locale=p_locale
        left join learning.album_localizations al on al.album_id=a.id and al.locale=p_locale
        left join learning.cantor_localizations cl on cl.cantor_id=c.id and cl.locale=p_locale
        left join media.media_assets cover on cover.id=a.cover_asset_id and cover.publication_status='published'
        where ip.user_id=auth.uid() and ip.item_kind='album_recording'
        union all
        select ip.updated_at, jsonb_build_object(
          'progressId', ip.id, 'itemKind', ip.item_kind, 'itemId', l.id, 'state', ip.state,
          'title', coalesce(ll.title, public.learning_lesson_title(p_locale, numbering.lesson_number)),
          'subtitle', coalesce(ll.description,l.description), 'mediaType', l.media_type,
          'durationMs', coalesce(l.duration_ms,audio.duration_ms,ma.duration_ms), 'containerId', s.id, 'containerTitle', coalesce(sl.title,s.title),
          'cantorId', c.id, 'cantorName', coalesce(cl.display_name,c.display_name), 'hymnId', s.hymn_id,
          'mediaAsset', public.learning_asset_json(ma),
          'audioAsset', public.learning_asset_json(audio),
          'coverAsset', case when cover.id is null then null else jsonb_build_object('id',cover.id,'provider',cover.provider,'bucket',cover.bucket,'path',cover.path,'mimeType',cover.mime_type,'fileSizeBytes',cover.file_size_bytes,'checksum',cover.checksum) end
        ) payload
        from learning.item_progress ip
        join learning.lessons l on l.id=ip.lesson_id and l.publication_status='published'
        join learning.lesson_sets s on s.id=l.lesson_set_id and s.publication_status='published'
        join learning.cantors c on c.id=s.cantor_id and c.publication_status='published'
        join media.media_assets ma on ma.id=l.media_asset_id and ma.publication_status='published'
        left join media.media_assets audio on audio.id=l.audio_asset_id and audio.publication_status='published'
        left join learning.lesson_localizations ll on ll.lesson_id=l.id and ll.locale=p_locale
        left join learning.lesson_set_localizations sl on sl.lesson_set_id=s.id and sl.locale=p_locale
        left join learning.cantor_localizations cl on cl.cantor_id=c.id and cl.locale=p_locale
        left join media.media_assets cover on cover.id=s.cover_asset_id and cover.publication_status='published'
        join lateral (
          select count(*) + 1 as lesson_number
          from learning.lessons before
          where before.lesson_set_id = l.lesson_set_id and before.publication_status='published'
            and (before.sort_order, before.id) < (l.sort_order, l.id)
        ) numbering on true
        where ip.user_id=auth.uid() and ip.item_kind='lesson'
      ) library_items
    ), '[]'::jsonb)
  );
$function$;

create or replace function public.get_learning_playlist(p_playlist_id uuid, p_locale text DEFAULT 'en'::text)
returns jsonb
language sql
stable
set search_path to 'pg_catalog', 'public'
as $function$
  select jsonb_build_object(
    'id', p.id, 'name', p.name, 'description', p.description, 'visibility', p.visibility,
    'items', coalesce((
      select jsonb_agg(
        case pi.item_kind
          when 'album_recording' then jsonb_build_object(
            'id', pi.id, 'kind', pi.item_kind, 'sortOrder', pi.sort_order,
            'recording', jsonb_build_object(
              'id', r.id, 'title', coalesce(rl.title, r.title), 'subtitle', coalesce(rl.subtitle, r.subtitle),
              'durationMs', coalesce(r.duration_ms, rma.duration_ms),
              'albumId', a.id, 'albumTitle', coalesce(al.title, a.title),
              'mediaAsset', public.learning_asset_json(rma)
            )
          )
          else jsonb_build_object(
            'id', pi.id, 'kind', pi.item_kind, 'sortOrder', pi.sort_order,
            'lesson', jsonb_build_object(
              'id', l.id, 'mediaType', l.media_type,
              'title', coalesce(ll.title, public.learning_lesson_title(p_locale, numbering.lesson_number)),
              'description', coalesce(ll.description, l.description),
              'durationMs', coalesce(l.duration_ms, laudio.duration_ms, lma.duration_ms),
              'lessonSetId', ls.id, 'lessonSetTitle', coalesce(lsl.title, ls.title),
              'cantorName', coalesce(lcl.display_name, lc.display_name),
              'coverAsset', case when lcover.id is null then null else jsonb_build_object('id',lcover.id,'provider',lcover.provider,'bucket',lcover.bucket,'path',lcover.path,'mimeType',lcover.mime_type) end,
              'mediaAsset', public.learning_asset_json(lma),
              'audioAsset', public.learning_asset_json(laudio)
            )
          )
        end order by pi.sort_order, pi.id
      )
      from learning.playlist_items pi
      left join learning.album_recordings r on r.id = pi.album_recording_id and r.publication_status = 'published'
      left join learning.recording_localizations rl on rl.recording_id = r.id and rl.locale = p_locale
      left join learning.albums a on a.id = r.album_id and a.publication_status = 'published'
      left join learning.album_localizations al on al.album_id = a.id and al.locale = p_locale
      left join media.media_assets rma on rma.id = r.media_asset_id and rma.publication_status = 'published'
      left join learning.lessons l on l.id = pi.lesson_id and l.publication_status = 'published'
      left join learning.lesson_localizations ll on ll.lesson_id = l.id and ll.locale = p_locale
      left join learning.lesson_sets ls on ls.id = l.lesson_set_id and ls.publication_status = 'published'
      left join learning.lesson_set_localizations lsl on lsl.lesson_set_id = ls.id and lsl.locale = p_locale
      left join learning.cantors lc on lc.id = ls.cantor_id
      left join learning.cantor_localizations lcl on lcl.cantor_id = lc.id and lcl.locale = p_locale
      left join media.media_assets lcover on lcover.id = ls.cover_asset_id and lcover.publication_status = 'published'
      left join media.media_assets lma on lma.id = l.media_asset_id and lma.publication_status = 'published'
      left join media.media_assets laudio on laudio.id = l.audio_asset_id and laudio.publication_status = 'published'
      left join lateral (
        select count(*) + 1 as lesson_number
        from learning.lessons before
        where l.id is not null and before.lesson_set_id = l.lesson_set_id and before.publication_status='published'
          and (before.sort_order, before.id) < (l.sort_order, l.id)
      ) numbering on true
      where pi.playlist_id = p.id
        and ((pi.item_kind = 'album_recording' and r.id is not null and a.id is not null and rma.id is not null)
          or (pi.item_kind = 'lesson' and l.id is not null and ls.id is not null and lma.id is not null))
    ), '[]'::jsonb)
  )
  from learning.playlists p
  where p.id = p_playlist_id;
$function$;

-- The lyrics RPC: an item that cannot be shown has no lyrics rather than no answer.
create or replace function public.get_published_learning_item_lyrics(p_item_kind learning.playlist_item_kind, p_item_id uuid, p_locale text DEFAULT NULL::text)
returns jsonb
language sql
stable
set search_path to 'pg_catalog', 'public'
as $function$
  select jsonb_build_object(
    'itemKind',p_item_kind,'itemId',p_item_id,
    'lyricSets',case when visible.ok then coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',s.id,'itemKind',s.item_kind,'itemId',coalesce(s.album_recording_id,s.lesson_id),
        'locale',s.locale,'kind','original','syncPrecision',s.sync_precision,'description',s.description,
        'publicationStatus',s.publication_status,
        'lines',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'sequence',l.sequence,'startMs',l.start_ms,'endMs',l.end_ms,'text',l.text,'words','[]'::jsonb) order by l.sequence) from learning.lyric_lines l where l.lyric_set_id=s.id),'[]'::jsonb)
      ) order by s.locale)
      from learning.lyric_sets s
      where s.item_kind=p_item_kind and coalesce(s.album_recording_id,s.lesson_id)=p_item_id
        and s.publication_status='published' and (p_locale is null or s.locale=p_locale)
    ),'[]'::jsonb) else '[]'::jsonb end
  )
  from (
    select (p_item_kind='album_recording' and exists(select 1 from learning.album_recordings r join learning.albums a on a.id=r.album_id where r.id=p_item_id and r.publication_status='published' and a.publication_status='published'))
      or (p_item_kind='lesson' and exists(select 1 from learning.lessons l join learning.lesson_sets s on s.id=l.lesson_set_id where l.id=p_item_id and l.publication_status='published' and s.publication_status='published')) as ok
  ) visible;
$function$;

-- The lyric-set policy's editability branch can be evaluated by anonymous
-- readers (as the music side's can): the function answers false for them.
grant execute on function private.learning_lyric_item_is_editable(learning.playlist_item_kind, uuid) to anon;

-- Search: a lesson result carries its audio rendition and a duration.
create or replace function private.published_media_search_source()
returns table(owner_creator_account_id uuid, entity_type text, entity_id uuid, locale text, title text, subtitle text, body text, metadata jsonb)
language sql
stable
set search_path to ''
as $function$
  -- Music artists
  select
    artist.owner_creator_account_id,
    'music_artist'::text,
    artist.id,
    localized.locale,
    localized.title,
    null::text,
    localized.body,
    jsonb_build_object(
      'profileImageAsset', case when image.id is null then null else jsonb_build_object(
        'id', image.id,
        'provider', image.provider,
        'bucket', image.bucket,
        'path', image.path,
        'mimeType', image.mime_type
      ) end
    )
  from music.artists artist
  cross join lateral (
    select distinct on (candidate.locale)
      candidate.locale,
      candidate.title,
      candidate.body
    from (
      select 'en'::text as locale, artist.display_name as title, artist.biography as body, 0 as priority
      union all
      select localization.locale, localization.display_name, localization.biography, 1
      from music.artist_localizations localization
      where localization.artist_id = artist.id
        and localization.publication_status = 'published'::media.publication_status
    ) candidate
    join media.locales enabled_locale
      on enabled_locale.code = candidate.locale
     and enabled_locale.enabled
    order by candidate.locale, candidate.priority desc
  ) localized
  left join media.media_assets image
    on image.id = artist.profile_image_asset_id
   and image.publication_status = 'published'::media.publication_status
  where artist.publication_status = 'published'::media.publication_status

  union all

  -- Music releases
  select
    release.owner_creator_account_id,
    'music_release'::text,
    release.id,
    localized.locale,
    localized.title,
    localized.subtitle,
    concat_ws(' ', localized.body, coalesce(artist_localization.display_name, artist.display_name)),
    jsonb_build_object(
      'releaseType', release.release_type,
      'releaseDate', release.release_date,
      'primaryArtist', case when artist.id is null then null else jsonb_build_object(
        'id', artist.id,
        'displayName', coalesce(artist_localization.display_name, artist.display_name)
      ) end,
      'coverAsset', case when cover.id is null then null else jsonb_build_object(
        'id', cover.id,
        'provider', cover.provider,
        'bucket', cover.bucket,
        'path', cover.path,
        'mimeType', cover.mime_type
      ) end
    )
  from music.releases release
  cross join lateral (
    select distinct on (candidate.locale)
      candidate.locale,
      candidate.title,
      candidate.subtitle,
      candidate.body
    from (
      select 'en'::text as locale, release.title as title, release.subtitle as subtitle,
        release.description as body, 0 as priority
      union all
      select localization.locale, localization.title, localization.subtitle, localization.description, 1
      from music.release_localizations localization
      where localization.release_id = release.id
        and localization.publication_status = 'published'::media.publication_status
    ) candidate
    join media.locales enabled_locale
      on enabled_locale.code = candidate.locale
     and enabled_locale.enabled
    order by candidate.locale, candidate.priority desc
  ) localized
  left join music.artists artist
    on artist.id = release.primary_artist_id
   and artist.publication_status = 'published'::media.publication_status
  left join music.artist_localizations artist_localization
    on artist_localization.artist_id = artist.id
   and artist_localization.locale = localized.locale
   and artist_localization.publication_status = 'published'::media.publication_status
  left join media.media_assets cover
    on cover.id = release.cover_asset_id
   and cover.publication_status = 'published'::media.publication_status
  where release.publication_status = 'published'::media.publication_status

  union all

  -- Music tracks
  select
    track.owner_creator_account_id,
    'music_track'::text,
    track.id,
    localized.locale,
    localized.title,
    localized.subtitle,
    concat_ws(' ', artist_names.names, release_context.title),
    jsonb_build_object(
      'durationMs', track.duration_ms,
      'releaseId', release_context.id,
      'releaseTitle', release_context.title,
      'coverAsset', release_context.cover_asset,
      'mediaAsset', jsonb_build_object(
        'id', asset.id,
        'provider', asset.provider,
        'bucket', asset.bucket,
        'path', asset.path,
        'mimeType', asset.mime_type
      ),
      'artists', artist_names.artists
    )
  from music.tracks track
  join media.media_assets asset
    on asset.id = track.media_asset_id
   and asset.publication_status = 'published'::media.publication_status
  cross join lateral (
    select distinct on (candidate.locale)
      candidate.locale,
      candidate.title,
      candidate.subtitle
    from (
      select 'en'::text as locale, track.title as title, track.subtitle as subtitle, 0 as priority
      union all
      select localization.locale, localization.title, localization.subtitle, 1
      from music.track_localizations localization
      where localization.track_id = track.id
        and localization.publication_status = 'published'::media.publication_status
    ) candidate
    join media.locales enabled_locale
      on enabled_locale.code = candidate.locale
     and enabled_locale.enabled
    order by candidate.locale, candidate.priority desc
  ) localized
  left join lateral (
    select
      string_agg(coalesce(artist_localization.display_name, artist.display_name), ' ' order by track_artist.sort_order) as names,
      coalesce(jsonb_agg(jsonb_build_object(
        'id', artist.id,
        'displayName', coalesce(artist_localization.display_name, artist.display_name),
        'role', track_artist.role,
        'sortOrder', track_artist.sort_order
      ) order by track_artist.sort_order, artist.display_name), '[]'::jsonb) as artists
    from music.track_artists track_artist
    join music.artists artist
      on artist.id = track_artist.artist_id
     and artist.publication_status = 'published'::media.publication_status
    left join music.artist_localizations artist_localization
      on artist_localization.artist_id = artist.id
     and artist_localization.locale = localized.locale
     and artist_localization.publication_status = 'published'::media.publication_status
    where track_artist.track_id = track.id
  ) artist_names on true
  left join lateral (
    select
      release.id,
      coalesce(release_localization.title, release.title) as title,
      case when cover.id is null then null else jsonb_build_object(
        'id', cover.id,
        'provider', cover.provider,
        'bucket', cover.bucket,
        'path', cover.path,
        'mimeType', cover.mime_type
      ) end as cover_asset
    from music.release_tracks release_track
    join music.releases release
      on release.id = release_track.release_id
     and release.publication_status = 'published'::media.publication_status
    left join music.release_localizations release_localization
      on release_localization.release_id = release.id
     and release_localization.locale = localized.locale
     and release_localization.publication_status = 'published'::media.publication_status
    left join media.media_assets cover
      on cover.id = release.cover_asset_id
     and cover.publication_status = 'published'::media.publication_status
    where release_track.track_id = track.id
    order by release.release_date desc nulls last, release_track.disc_number, release_track.track_number
    limit 1
  ) release_context on true
  where track.publication_status = 'published'::media.publication_status

  union all

  -- Learning cantors
  select
    cantor.owner_creator_account_id,
    'learning_cantor'::text,
    cantor.id,
    localized.locale,
    localized.title,
    null::text,
    localized.body,
    jsonb_build_object(
      'profileImageAsset', case when image.id is null then null else jsonb_build_object(
        'id', image.id,
        'provider', image.provider,
        'bucket', image.bucket,
        'path', image.path,
        'mimeType', image.mime_type
      ) end
    )
  from learning.cantors cantor
  cross join lateral (
    select distinct on (candidate.locale)
      candidate.locale,
      candidate.title,
      candidate.body
    from (
      select 'en'::text as locale, cantor.display_name as title, cantor.biography as body, 0 as priority
      union all
      select localization.locale, localization.display_name, localization.biography, 1
      from learning.cantor_localizations localization
      where localization.cantor_id = cantor.id
    ) candidate
    join media.locales enabled_locale
      on enabled_locale.code = candidate.locale
     and enabled_locale.enabled
    order by candidate.locale, candidate.priority desc
  ) localized
  left join media.media_assets image
    on image.id = cantor.profile_image_asset_id
   and image.publication_status = 'published'::media.publication_status
  where cantor.publication_status = 'published'::media.publication_status

  union all

  -- Learning seasons
  select
    null::uuid,
    'learning_season'::text,
    season.id,
    localized.locale,
    localized.title,
    season.slug,
    localized.body,
    jsonb_build_object('slug', season.slug, 'sortOrder', season.sort_order)
  from learning.seasons season
  cross join lateral (
    select distinct on (candidate.locale)
      candidate.locale,
      candidate.title,
      candidate.body
    from (
      select 'en'::text as locale, season.title as title, season.description as body, 0 as priority
      union all
      select localization.locale, localization.title, localization.description, 1
      from learning.season_localizations localization
      where localization.season_id = season.id
    ) candidate
    join media.locales enabled_locale
      on enabled_locale.code = candidate.locale
     and enabled_locale.enabled
    order by candidate.locale, candidate.priority desc
  ) localized
  where season.publication_status = 'published'::media.publication_status

  union all

  -- Learning hymns
  select
    null::uuid,
    'learning_hymn'::text,
    hymn.id,
    localized.locale,
    localized.title,
    localized.subtitle,
    concat_ws(' ', localized.body, hymn.source_hymn_key),
    jsonb_build_object('sourceHymnKey', hymn.source_hymn_key)
  from learning.hymns hymn
  cross join lateral (
    select distinct on (candidate.locale)
      candidate.locale,
      candidate.title,
      candidate.subtitle,
      candidate.body
    from (
      select 'en'::text as locale, hymn.title as title, hymn.subtitle as subtitle,
        hymn.description as body, 0 as priority
      union all
      select localization.locale, localization.title, localization.subtitle, localization.description, 1
      from learning.hymn_localizations localization
      where localization.hymn_id = hymn.id
    ) candidate
    join media.locales enabled_locale
      on enabled_locale.code = candidate.locale
     and enabled_locale.enabled
    order by candidate.locale, candidate.priority desc
  ) localized
  where hymn.publication_status = 'published'::media.publication_status

  union all

  -- Learning albums
  select
    album.owner_creator_account_id,
    'learning_album'::text,
    album.id,
    localized.locale,
    localized.title,
    coalesce(cantor_localization.display_name, cantor.display_name),
    concat_ws(' ', localized.body, coalesce(cantor_localization.display_name, cantor.display_name),
      coalesce(season_localization.title, season.title)),
    jsonb_build_object(
      'cantorId', cantor.id,
      'cantorName', coalesce(cantor_localization.display_name, cantor.display_name),
      'seasonId', season.id,
      'coverAsset', case when cover.id is null then null else jsonb_build_object(
        'id', cover.id,
        'provider', cover.provider,
        'bucket', cover.bucket,
        'path', cover.path,
        'mimeType', cover.mime_type
      ) end
    )
  from learning.albums album
  join learning.cantors cantor
    on cantor.id = album.cantor_id
   and cantor.publication_status = 'published'::media.publication_status
  cross join lateral (
    select distinct on (candidate.locale)
      candidate.locale,
      candidate.title,
      candidate.body
    from (
      select 'en'::text as locale, album.title as title, album.description as body, 0 as priority
      union all
      select localization.locale, localization.title, localization.description, 1
      from learning.album_localizations localization
      where localization.album_id = album.id
    ) candidate
    join media.locales enabled_locale
      on enabled_locale.code = candidate.locale
     and enabled_locale.enabled
    order by candidate.locale, candidate.priority desc
  ) localized
  left join learning.cantor_localizations cantor_localization
    on cantor_localization.cantor_id = cantor.id
   and cantor_localization.locale = localized.locale
  left join learning.seasons season
    on season.id = album.season_id
   and season.publication_status = 'published'::media.publication_status
  left join learning.season_localizations season_localization
    on season_localization.season_id = season.id
   and season_localization.locale = localized.locale
  left join media.media_assets cover
    on cover.id = album.cover_asset_id
   and cover.publication_status = 'published'::media.publication_status
  where album.publication_status = 'published'::media.publication_status

  union all

  -- Learning lessons (lesson sets provide the navigational/search context but are not standalone results).
  select
    lesson_set.owner_creator_account_id,
    'learning_lesson'::text,
    lesson.id,
    localized.locale,
    coalesce(localized.localized_title, public.learning_lesson_title(localized.locale, numbering.lesson_number)),
    coalesce(lesson_set_localization.title, lesson_set.title),
    concat_ws(' ', localized.body,
      coalesce(lesson_set_localization.title, lesson_set.title),
      coalesce(lesson_set_localization.description, lesson_set.description),
      coalesce(cantor_localization.display_name, cantor.display_name),
      coalesce(hymn_localization.title, hymn.title),
      coalesce(season_localization.title, season.title)),
    jsonb_build_object(
      'mediaType', lesson.media_type,
      'durationMs', coalesce(lesson.duration_ms, audio.duration_ms, asset.duration_ms),
      'mediaAsset', jsonb_build_object(
        'id', asset.id,
        'provider', asset.provider,
        'bucket', asset.bucket,
        'path', asset.path,
        'mimeType', asset.mime_type,
        'width', asset.width,
        'height', asset.height
      ),
      'audioAsset', case when audio.id is null then null else jsonb_build_object(
        'id', audio.id,
        'provider', audio.provider,
        'bucket', audio.bucket,
        'path', audio.path,
        'mimeType', audio.mime_type
      ) end,
      'lessonSetId', lesson_set.id,
      'lessonSetTitle', coalesce(lesson_set_localization.title, lesson_set.title),
      'cantorId', cantor.id,
      'cantorName', coalesce(cantor_localization.display_name, cantor.display_name),
      'hymnId', hymn.id,
      'coverAsset', case when cover.id is null then null else jsonb_build_object(
        'id', cover.id,
        'provider', cover.provider,
        'bucket', cover.bucket,
        'path', cover.path,
        'mimeType', cover.mime_type
      ) end
    )
  from learning.lessons lesson
  join learning.lesson_sets lesson_set
    on lesson_set.id = lesson.lesson_set_id
   and lesson_set.publication_status = 'published'::media.publication_status
  join learning.cantors cantor
    on cantor.id = lesson_set.cantor_id
   and cantor.publication_status = 'published'::media.publication_status
  join learning.hymns hymn
    on hymn.id = lesson_set.hymn_id
   and hymn.publication_status = 'published'::media.publication_status
  join media.media_assets asset
    on asset.id = lesson.media_asset_id
   and asset.publication_status = 'published'::media.publication_status
  left join media.media_assets audio
    on audio.id = lesson.audio_asset_id
   and audio.publication_status = 'published'::media.publication_status
  join lateral (
    select count(*) + 1 as lesson_number
    from learning.lessons before
    where before.lesson_set_id = lesson.lesson_set_id
      and before.publication_status = 'published'::media.publication_status
      and (before.sort_order, before.id) < (lesson.sort_order, lesson.id)
  ) numbering on true
  cross join lateral (
    select distinct on (candidate.locale)
      candidate.locale,
      candidate.localized_title,
      candidate.body
    from (
      -- The lesson is named by its place in the set unless a localization names it.
      select 'en'::text as locale, null::text as localized_title, lesson.description as body, 0 as priority
      union all
      select localization.locale, localization.title, localization.description, 1
      from learning.lesson_localizations localization
      where localization.lesson_id = lesson.id
    ) candidate
    join media.locales enabled_locale
      on enabled_locale.code = candidate.locale
     and enabled_locale.enabled
    order by candidate.locale, candidate.priority desc
  ) localized
  left join learning.lesson_set_localizations lesson_set_localization
    on lesson_set_localization.lesson_set_id = lesson_set.id
   and lesson_set_localization.locale = localized.locale
  left join learning.cantor_localizations cantor_localization
    on cantor_localization.cantor_id = cantor.id
   and cantor_localization.locale = localized.locale
  left join learning.hymn_localizations hymn_localization
    on hymn_localization.hymn_id = hymn.id
   and hymn_localization.locale = localized.locale
  left join learning.seasons season
    on season.id = lesson_set.season_id
   and season.publication_status = 'published'::media.publication_status
  left join learning.season_localizations season_localization
    on season_localization.season_id = season.id
   and season_localization.locale = localized.locale
  left join media.media_assets cover
    on cover.id = lesson_set.cover_asset_id
   and cover.publication_status = 'published'::media.publication_status
  where lesson.publication_status = 'published'::media.publication_status;
$function$;

-- The search index is built from the source above: rebuilt now so lesson
-- results carry their audio rendition and their proper names.
do $$
begin
  perform private.refresh_unified_search_index();
end $$;
