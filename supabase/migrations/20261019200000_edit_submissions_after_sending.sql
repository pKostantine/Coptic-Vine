-- Editing a submission after it is sent, and published music and Learn content.
--
-- Artists (Coptic Vine Artists) and admins (Coptic Vine Admin) open the same
-- editor for a music release, a Learn album or a lesson set, in any status but
-- rejected: titles in every language, description, types, artist, season,
-- hymn, timing, credits, order, artwork, adding and deleting items, and
-- replacing an item's audio or video. Two RPCs carry it:
--   get_submission_editor(submission)        the editor's state
--   save_submission_edit(submission, edit)   one save, all of it
-- The same rules decide who may call them as for the rest of the creator
-- tools (private.can_edit_creator_account: the workspace's editors, and
-- admins).
--
-- What a save does to live content follows the review rules already in place:
--   - Titles, credits, order, details and deletions apply at once.
--   - New and replaced files are processed first. An artist's new or replaced
--     file on live content waits for Coptic Vine's approval; the old file stays
--     live meanwhile, so nothing goes off air. An admin's goes live as soon as
--     it is processed.
--   - An artist's save sends the submission back to review when the content is
--     not yet live, or when it brings new files to live content. Edits to a
--     submission already waiting for review keep it waiting.
--   - A release or Learn album with one item is a single: the item takes the
--     release's title in every language.
--
-- A replacement for a live item is a submission item of its own, beside the
-- one it replaces (replaces_item_id), and is never linked to the track or
-- lesson until it is applied: private.attach_completed_submission_jobs only
-- swaps the media of linked items, so processing alone cannot take a live
-- track off air. Applying happens when the content is (re)published:
--   - music: publish_music_submission_internal, on approval or, for an
--     admin's edit, once the files are processed;
--   - Learn: publish_learning_submission_internal and
--     apply_learning_submission_edits, the same way.

-- ---------------------------------------------------------------------------
-- A replacement file waits beside the item it replaces.

alter table media.submission_items
  add column if not exists replaces_item_id uuid
    references media.submission_items(id) on delete cascade;

comment on column media.submission_items.replaces_item_id is
  'A new file for this item''s track, recording or lesson, waiting to replace the live one until the content is republished.';

create unique index if not exists submission_items_one_replacement_per_item
  on media.submission_items(replaces_item_id)
  where replaces_item_id is not null;

-- ---------------------------------------------------------------------------
-- Small helpers.

-- {en, ar, fr}, each trimmed, missing ones empty.
create or replace function private.edit_localized_titles(p_value jsonb)
returns jsonb
language sql
immutable
set search_path to ''
as $$
  select jsonb_build_object(
    'en', coalesce(btrim(case when jsonb_typeof(p_value) = 'object' then p_value ->> 'en' end), ''),
    'ar', coalesce(btrim(case when jsonb_typeof(p_value) = 'object' then p_value ->> 'ar' end), ''),
    'fr', coalesce(btrim(case when jsonb_typeof(p_value) = 'object' then p_value ->> 'fr' end), '')
  );
$$;

-- The title shown where one is needed: English, else Arabic, else French
-- (as Coptic Vine Artists' preferredLocalizedTitle), else the fallback.
create or replace function private.edit_preferred_title(p_titles jsonb, p_fallback text default null)
returns text
language sql
immutable
set search_path to ''
as $$
  select coalesce(
    nullif(btrim(p_titles ->> 'en'), ''),
    nullif(btrim(p_titles ->> 'ar'), ''),
    nullif(btrim(p_titles ->> 'fr'), ''),
    nullif(btrim(p_fallback), '')
  );
$$;

-- The localized titles stored per item (the recording's and lesson's own).
create or replace function private.edit_compact_titles(p_titles jsonb)
returns jsonb
language sql
immutable
set search_path to ''
as $$
  select coalesce(jsonb_object_agg(entry.key, entry.value), '{}'::jsonb)
  from jsonb_each_text(coalesce(p_titles, '{}'::jsonb)) entry
  where entry.key in ('en', 'ar', 'fr') and nullif(btrim(entry.value), '') is not null;
$$;

-- An item's file is processed and ready to go live: its delivery is complete,
-- and a video also has its audio-only copy (or was found to be silent). The
-- same test as private.submission_required_items_ready, for one item.
create or replace function private.submission_item_media_ready(p_item_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
    from media.submission_items item
    join media.media_assets asset
      on asset.id = item.media_asset_id
     and asset.processing_status = 'completed'::media.processing_status
    left join media.upload_intents intent on intent.id = item.upload_intent_id
    where item.id = p_item_id
      and (
        intent.media_type is distinct from 'video'::media.media_type
        or exists (
          select 1 from media.media_assets audio
          where audio.id = item.audio_only_asset_id
            and audio.processing_status = 'completed'::media.processing_status
        )
        or exists (
          select 1 from media.media_processing_jobs silent
          where silent.upload_intent_id = intent.id
            and silent.job_type = 'audio_delivery'::media.processing_job_type
            and private.media_job_skipped_for_silence(silent.status, silent.error_message)
        )
      )
  );
$$;

-- Where an item stands, for the editor: completed, or the processing job's status.
create or replace function private.submission_item_processing_state(p_item_id uuid)
returns text
language sql
stable
security definer
set search_path to ''
as $$
  select case
    when private.submission_item_media_ready(item.id) then 'completed'
    else coalesce(job.status::text, intent.status::text, 'queued')
  end
  from media.submission_items item
  left join media.media_processing_jobs job on job.id = item.media_processing_job_id
  left join media.upload_intents intent on intent.id = item.upload_intent_id
  where item.id = p_item_id;
$$;

-- Adds an uploaded file to a submission whatever its status (the editor
-- decides whether it goes to review), and starts processing it, as
-- add_media_submission_item does for a submission being prepared.
create or replace function private.add_edit_submission_item(
  p_submission_id uuid,
  p_upload_intent_id uuid,
  p_role media.submission_item_role,
  p_title text,
  p_sort_order integer,
  p_localized_titles jsonb default '{}'::jsonb,
  p_music_track_id uuid default null,
  p_replaces_item_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  submission_record media.submissions%rowtype;
  intent media.upload_intents%rowtype;
  new_item_id uuid;
  job_type media.processing_job_type;
  output_bucket text;
  queued_job_id uuid;
begin
  select * into submission_record from media.submissions where id = p_submission_id;
  if not found then
    raise exception 'Submission not found' using errcode = 'P0002';
  end if;

  select * into intent from media.upload_intents where id = p_upload_intent_id for update;
  if not found then
    raise exception 'That upload could not be found. Choose the file again.' using errcode = 'P0002';
  end if;
  if intent.creator_account_id <> submission_record.creator_account_id then
    raise exception 'That upload belongs to a different workspace' using errcode = '42501';
  end if;
  if intent.status <> 'uploaded'::media.upload_intent_status then
    raise exception 'Wait for every file to finish uploading before saving' using errcode = '22023';
  end if;
  if exists (select 1 from media.submission_items item where item.upload_intent_id = intent.id) then
    raise exception 'That upload is already part of a submission. Choose the file again.' using errcode = '22023';
  end if;

  if p_role = 'artwork'::media.submission_item_role then
    if intent.media_type <> 'image'::media.media_type then
      raise exception 'Artwork must be an image' using errcode = '22023';
    end if;
  elsif submission_record.submission_type = 'music_release'::media.submission_type then
    if intent.media_type <> 'audio'::media.media_type then
      raise exception 'Tracks must be audio files' using errcode = '22023';
    end if;
  elsif submission_record.submission_type = 'learning_album'::media.submission_type then
    if intent.media_type <> 'audio'::media.media_type then
      raise exception 'Learning album recordings must be audio files' using errcode = '22023';
    end if;
  elsif intent.media_type not in ('audio'::media.media_type, 'video'::media.media_type) then
    raise exception 'Lessons must be audio or video files' using errcode = '22023';
  end if;

  insert into media.submission_items (
    submission_id, upload_intent_id, title, sort_order, required, role,
    music_track_id, localized_titles, replaces_item_id
  )
  values (
    submission_record.id, intent.id,
    coalesce(nullif(btrim(p_title), ''), intent.original_filename),
    coalesce(p_sort_order, 0), true, p_role,
    p_music_track_id, coalesce(p_localized_titles, '{}'::jsonb), p_replaces_item_id
  )
  returning id into new_item_id;

  job_type := case intent.media_type
    when 'audio'::media.media_type then 'audio_delivery'::media.processing_job_type
    when 'image'::media.media_type then 'image_delivery'::media.processing_job_type
    when 'video'::media.media_type then 'video_delivery'::media.processing_job_type
  end;
  output_bucket := case
    when job_type = 'image_delivery'::media.processing_job_type then 'chc-images'
    when job_type = 'video_delivery'::media.processing_job_type then 'chc-learning'
    when submission_record.submission_type = 'music_release'::media.submission_type then 'chc-music'
    else 'chc-learning'
  end;

  select result.job_id into queued_job_id
  from public.enqueue_media_processing_job(intent.id, job_type, output_bucket) result;

  update media.submission_items item
  set media_processing_job_id = queued_job_id
  where item.id = new_item_id;

  return new_item_id;
end;
$$;

-- A music release's or Learn collection's artwork: the newest image item is
-- the one to show; older ones are removed once a newer one is in place, so
-- their files can be cleaned up.
create or replace function private.replace_submission_artwork(
  p_submission_id uuid,
  p_upload_intent_id uuid,
  p_current_cover_asset_id uuid
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
begin
  -- Any artwork still waiting is superseded; the live cover's item stays until
  -- the new one takes its place.
  delete from media.submission_items item
  where item.submission_id = p_submission_id
    and item.role = 'artwork'::media.submission_item_role
    and item.media_asset_id is distinct from p_current_cover_asset_id;

  return private.add_edit_submission_item(
    p_submission_id, p_upload_intent_id, 'artwork'::media.submission_item_role, 'Artwork', -1
  );
end;
$$;

-- After a cover is in place, its older artwork items go.
create or replace function private.drop_superseded_artwork(p_submission_id uuid, p_cover_asset_id uuid)
returns void
language sql
security definer
set search_path to ''
as $$
  delete from media.submission_items item
  where item.submission_id = p_submission_id
    and item.role = 'artwork'::media.submission_item_role
    and p_cover_asset_id is not null
    and item.media_asset_id is distinct from p_cover_asset_id
    and item.created_at < (
      select max(cover_item.created_at) from media.submission_items cover_item
      where cover_item.submission_id = p_submission_id
        and cover_item.role = 'artwork'::media.submission_item_role
        and cover_item.media_asset_id = p_cover_asset_id
    );
$$;

-- ---------------------------------------------------------------------------
-- The editor's state.

create or replace function public.get_submission_editor(p_submission_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  sub media.submissions%rowtype;
  rel music.releases%rowtype;
  album learning.albums%rowtype;
  lesson_set learning.lesson_sets%rowtype;
  identity_artist uuid;
  is_admin boolean := private.is_admin();
  result jsonb;
  cover jsonb;
  pending_cover jsonb;
  collection_cover uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select * into sub from media.submissions where id = p_submission_id;
  if not found then
    raise exception 'Submission not found' using errcode = 'P0002';
  end if;
  if not private.can_edit_creator_account(sub.creator_account_id) then
    raise exception 'Not authorized for this submission' using errcode = '42501';
  end if;

  select account.identity_artist_id into identity_artist
  from creator.creator_accounts account where account.id = sub.creator_account_id;

  result := jsonb_build_object(
    'submissionId', sub.id,
    'kind', sub.submission_type,
    'status', sub.status,
    'reviewNotes', sub.review_notes,
    'creatorAccountId', sub.creator_account_id,
    'isAdmin', is_admin,
    'canEdit', sub.status not in ('rejected'::media.publication_status, 'archived'::media.publication_status),
    'earliestReleaseAt', public.earliest_release_at()
  );

  if sub.submission_type = 'music_release'::media.submission_type then
    select * into rel from music.releases release
    where nullif(release.metadata ->> 'submissionId', '')::uuid = sub.id;
    if not found then
      raise exception 'This submission has no release to edit' using errcode = 'P0002';
    end if;
    collection_cover := rel.cover_asset_id;

    result := result || jsonb_build_object(
      'catalogId', rel.id,
      'isLive', rel.publication_status = 'published'::media.publication_status,
      'publicationStatus', rel.publication_status,
      'title', rel.title,
      'localizedTitles', jsonb_build_object(
        'en', coalesce((select l.title from music.release_localizations l where l.release_id = rel.id and l.locale = 'en'), ''),
        'ar', coalesce((select l.title from music.release_localizations l where l.release_id = rel.id and l.locale = 'ar'), ''),
        'fr', coalesce((select l.title from music.release_localizations l where l.release_id = rel.id and l.locale = 'fr'), '')
      ),
      'description', rel.description,
      'releaseType', rel.release_type,
      'musicType', rel.metadata ->> 'musicType',
      'recordingType', rel.metadata ->> 'recordingType',
      'releaseTimingMode', rel.release_timing_mode,
      'scheduledReleaseAt', rel.scheduled_release_at,
      'originalReleaseDate', rel.original_release_date,
      'artist', (select jsonb_build_object('id', artist.id, 'displayName', artist.display_name)
                 from music.artists artist where artist.id = rel.primary_artist_id),
      'items', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', track.id,
            'itemId', item.id,
            'title', track.title,
            'localizedTitles', jsonb_build_object(
              'en', coalesce((select l.title from music.track_localizations l where l.track_id = track.id and l.locale = 'en'), ''),
              'ar', coalesce((select l.title from music.track_localizations l where l.track_id = track.id and l.locale = 'ar'), ''),
              'fr', coalesce((select l.title from music.track_localizations l where l.track_id = track.id and l.locale = 'fr'), '')
            ),
            'durationMs', track.duration_ms,
            'publicationStatus', track.publication_status,
            'mediaType', coalesce(intent.media_type::text, 'audio'),
            'fileName', intent.original_filename,
            'processingStatus', case
              when item.id is null then case when track.media_asset_id is null then 'missing' else 'completed' end
              else private.submission_item_processing_state(item.id) end,
            'mainArtist', (
              select jsonb_build_object('id', artist.id, 'displayName', artist.display_name, 'isIdentity', artist.id = identity_artist)
              from music.track_artists credit join music.artists artist on artist.id = credit.artist_id
              where credit.track_id = track.id and credit.role = 'primary'::music.track_artist_role
              order by credit.sort_order limit 1
            ),
            'contributors', coalesce((
              select jsonb_agg(jsonb_build_object(
                'id', credit.artist_id::text || ':' || credit.role::text,
                'artistId', credit.artist_id,
                'name', artist.display_name,
                'role', credit.role
              ) order by credit.sort_order, artist.display_name)
              from music.track_artists credit join music.artists artist on artist.id = credit.artist_id
              where credit.track_id = track.id and credit.role <> 'primary'::music.track_artist_role
            ), '[]'::jsonb),
            'replacement', (
              select jsonb_build_object(
                'itemId', waiting.id,
                'fileName', waiting_intent.original_filename,
                'mediaType', waiting_intent.media_type,
                'processingStatus', private.submission_item_processing_state(waiting.id)
              )
              from media.submission_items waiting
              left join media.upload_intents waiting_intent on waiting_intent.id = waiting.upload_intent_id
              where waiting.replaces_item_id = item.id
              limit 1
            )
          )
          order by release_track.disc_number, release_track.track_number
        )
        from music.release_tracks release_track
        join music.tracks track on track.id = release_track.track_id
        left join lateral (
          select candidate.* from media.submission_items candidate
          where candidate.submission_id = sub.id
            and candidate.music_track_id = track.id
            and candidate.replaces_item_id is null
          order by candidate.created_at desc
          limit 1
        ) item on true
        left join media.upload_intents intent on intent.id = item.upload_intent_id
        where release_track.release_id = rel.id
      ), '[]'::jsonb)
    );
  else
    if sub.submission_type = 'learning_album'::media.submission_type then
      select * into album from learning.albums where submission_id = sub.id;
      if not found then
        raise exception 'This submission has no album to edit' using errcode = 'P0002';
      end if;
      collection_cover := album.cover_asset_id;
      result := result || jsonb_build_object(
        'catalogId', album.id,
        'isLive', album.publication_status = 'published'::media.publication_status,
        'publicationStatus', album.publication_status,
        'title', album.title,
        'localizedTitles', jsonb_build_object(
          'en', coalesce((select l.title from learning.album_localizations l where l.album_id = album.id and l.locale = 'en'), ''),
          'ar', coalesce((select l.title from learning.album_localizations l where l.album_id = album.id and l.locale = 'ar'), ''),
          'fr', coalesce((select l.title from learning.album_localizations l where l.album_id = album.id and l.locale = 'fr'), '')
        ),
        'description', album.description,
        'seasonId', album.season_id,
        'releaseTimingMode', album.release_timing_mode,
        'scheduledReleaseAt', album.scheduled_release_at,
        'originalReleaseDate', album.original_release_date,
        'artist', (select jsonb_build_object('id', coalesce(cantor.artist_id, cantor.id), 'displayName', cantor.display_name)
                   from learning.cantors cantor where cantor.id = album.cantor_id)
      );
    else
      select * into lesson_set from learning.lesson_sets where submission_id = sub.id;
      if not found then
        raise exception 'This submission has no lesson set to edit' using errcode = 'P0002';
      end if;
      collection_cover := lesson_set.cover_asset_id;
      result := result || jsonb_build_object(
        'catalogId', lesson_set.id,
        'isLive', lesson_set.publication_status = 'published'::media.publication_status,
        'publicationStatus', lesson_set.publication_status,
        'title', lesson_set.title,
        'localizedTitles', jsonb_build_object(
          'en', coalesce((select l.title from learning.lesson_set_localizations l where l.lesson_set_id = lesson_set.id and l.locale = 'en'), ''),
          'ar', coalesce((select l.title from learning.lesson_set_localizations l where l.lesson_set_id = lesson_set.id and l.locale = 'ar'), ''),
          'fr', coalesce((select l.title from learning.lesson_set_localizations l where l.lesson_set_id = lesson_set.id and l.locale = 'fr'), '')
        ),
        'description', lesson_set.description,
        'seasonId', lesson_set.season_id,
        'hymn', (select jsonb_build_object('id', hymn.id, 'title', hymn.title) from learning.hymns hymn where hymn.id = lesson_set.hymn_id),
        'releaseTimingMode', lesson_set.release_timing_mode,
        'scheduledReleaseAt', lesson_set.scheduled_release_at,
        'originalReleaseDate', lesson_set.original_release_date,
        'artist', (select jsonb_build_object('id', coalesce(cantor.artist_id, cantor.id), 'displayName', cantor.display_name)
                   from learning.cantors cantor where cantor.id = lesson_set.cantor_id)
      );
    end if;

    result := result || jsonb_build_object(
      'items', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', item.id,
            'itemId', item.id,
            'title', coalesce(recording.title, lesson.title, item.title),
            'localizedTitles', private.edit_localized_titles(item.localized_titles),
            'durationMs', coalesce(recording.duration_ms, lesson.duration_ms, asset.duration_ms),
            'publicationStatus', coalesce(recording.publication_status, lesson.publication_status, 'draft'::media.publication_status),
            'mediaType', coalesce(intent.media_type::text, asset.media_type::text),
            'fileName', intent.original_filename,
            'processingStatus', private.submission_item_processing_state(item.id),
            'replacement', (
              select jsonb_build_object(
                'itemId', waiting.id,
                'fileName', waiting_intent.original_filename,
                'mediaType', waiting_intent.media_type,
                'processingStatus', private.submission_item_processing_state(waiting.id)
              )
              from media.submission_items waiting
              left join media.upload_intents waiting_intent on waiting_intent.id = waiting.upload_intent_id
              where waiting.replaces_item_id = item.id
              limit 1
            )
          )
          order by item.sort_order, item.created_at, item.id
        )
        from media.submission_items item
        left join media.upload_intents intent on intent.id = item.upload_intent_id
        left join media.media_assets asset on asset.id = item.media_asset_id
        left join learning.album_recordings recording
          on album.id is not null and recording.album_id = album.id
         and recording.metadata ->> 'submissionItemId' = item.id::text
        left join learning.lessons lesson
          on lesson_set.id is not null and lesson.lesson_set_id = lesson_set.id
         and lesson.metadata ->> 'submissionItemId' = item.id::text
        where item.submission_id = sub.id
          and item.role <> 'artwork'::media.submission_item_role
          and item.replaces_item_id is null
      ), '[]'::jsonb)
    );
  end if;

  -- The cover: the newest processed artwork, or the live one.
  select jsonb_build_object(
    'assetId', asset.id, 'bucket', asset.bucket, 'path', asset.path,
    'version', extract(epoch from asset.updated_at)::bigint,
    'isLive', asset.id is not distinct from collection_cover
  )
  into cover
  from media.submission_items item
  join media.media_assets asset on asset.id = item.media_asset_id
   and asset.processing_status = 'completed'::media.processing_status
  where item.submission_id = sub.id and item.role = 'artwork'::media.submission_item_role
  order by item.created_at desc, item.id desc
  limit 1;

  if cover is null and collection_cover is not null then
    select jsonb_build_object(
      'assetId', asset.id, 'bucket', asset.bucket, 'path', asset.path,
      'version', extract(epoch from asset.updated_at)::bigint, 'isLive', true
    )
    into cover
    from media.media_assets asset where asset.id = collection_cover;
  end if;

  -- Artwork still being processed.
  select jsonb_build_object(
    'itemId', item.id, 'fileName', intent.original_filename,
    'processingStatus', private.submission_item_processing_state(item.id)
  )
  into pending_cover
  from media.submission_items item
  left join media.upload_intents intent on intent.id = item.upload_intent_id
  where item.submission_id = sub.id and item.role = 'artwork'::media.submission_item_role
    and not private.submission_item_media_ready(item.id)
  order by item.created_at desc
  limit 1;

  return result || jsonb_build_object('cover', cover, 'pendingCover', pending_cover);
end;
$$;

-- ---------------------------------------------------------------------------
-- Saving a music release.

create or replace function private.save_music_submission_edit(
  p_submission_id uuid,
  p_edit jsonb,
  p_actor uuid,
  p_is_admin boolean
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  sub media.submissions%rowtype;
  rel music.releases%rowtype;
  live boolean;
  release_titles jsonb := private.edit_localized_titles(p_edit -> 'localizedTitles');
  release_title text;
  music_type text := nullif(btrim(p_edit ->> 'musicType'), '');
  recording_type text := nullif(btrim(p_edit ->> 'recordingType'), '');
  timing text := lower(coalesce(nullif(btrim(p_edit ->> 'releaseTimingMode'), ''), ''));
  scheduled_at timestamptz;
  entries jsonb := coalesce(p_edit -> 'items', '[]'::jsonb);
  entry jsonb;
  place integer;
  entry_count integer;
  kept uuid[] := '{}';
  existing uuid[];
  target_track uuid;
  intent_id uuid;
  track_titles jsonb;
  track_title text;
  original_item media.submission_items%rowtype;
  removed uuid;
  cover_intent uuid := nullif(btrim(p_edit ->> 'coverUploadIntentId'), '')::uuid;
  locale_name text;
  media_changed boolean := false;
  added integer := 0;
  replaced integer := 0;
  deleted integer := 0;
begin
  select * into sub from media.submissions where id = p_submission_id;
  select * into rel from music.releases release
  where nullif(release.metadata ->> 'submissionId', '')::uuid = sub.id
  for update;
  if not found then
    raise exception 'This submission has no release to edit' using errcode = 'P0002';
  end if;
  live := rel.publication_status = 'published'::media.publication_status;

  release_title := private.edit_preferred_title(release_titles, p_edit ->> 'title');
  if release_title is null then
    raise exception 'Add a release title in English, Arabic, or French.' using errcode = '22023';
  end if;
  if music_type is null then
    raise exception 'Choose a music type.' using errcode = '22023';
  end if;
  if recording_type is null then
    raise exception 'Choose a recording type.' using errcode = '22023';
  end if;
  if jsonb_typeof(entries) <> 'array' or jsonb_array_length(entries) = 0 then
    raise exception 'A release needs at least one track.' using errcode = '22023';
  end if;
  entry_count := jsonb_array_length(entries);

  -- The release itself. Timing only matters before it goes live.
  if not live and timing <> '' then
    if timing not in ('asap', 'scheduled') then
      raise exception 'Unsupported release timing' using errcode = '22023';
    end if;
    scheduled_at := nullif(btrim(p_edit ->> 'scheduledReleaseAt'), '')::timestamptz;
    if timing = 'scheduled' and coalesce(scheduled_at, rel.scheduled_release_at) is null then
      raise exception 'Choose a scheduled release date and time.' using errcode = '22023';
    end if;
  end if;

  update music.releases release
  set title = release_title,
      description = nullif(btrim(p_edit ->> 'description'), ''),
      metadata = (coalesce(release.metadata, '{}'::jsonb) - 'musicType' - 'recordingType')
        || jsonb_build_object('musicType', music_type, 'recordingType', recording_type),
      release_timing_mode = case when live or timing = '' then release.release_timing_mode else timing end,
      scheduled_release_at = case
        when live or timing = '' then release.scheduled_release_at
        when timing = 'asap' then null
        else coalesce(scheduled_at, release.scheduled_release_at)
      end,
      original_release_date = case
        when p_edit ? 'originalReleaseDate' then nullif(btrim(p_edit ->> 'originalReleaseDate'), '')::date
        else release.original_release_date
      end,
      updated_by = p_actor,
      updated_at = now()
  where release.id = rel.id;

  -- Its titles in each language, keeping their publication with the release's.
  foreach locale_name in array array['en', 'ar', 'fr'] loop
    if nullif(release_titles ->> locale_name, '') is null then
      delete from music.release_localizations l where l.release_id = rel.id and l.locale = locale_name;
    else
      insert into music.release_localizations (release_id, locale, title, is_primary, publication_status, created_by, updated_by)
      values (rel.id, locale_name, release_titles ->> locale_name, locale_name = 'en',
        case when live then 'published'::media.publication_status else 'draft'::media.publication_status end,
        p_actor, p_actor)
      on conflict (release_id, locale) do update
        set title = excluded.title,
            publication_status = case when live then 'published'::media.publication_status
                                      else music.release_localizations.publication_status end,
            updated_by = p_actor,
            updated_at = now();
    end if;
  end loop;

  select coalesce(array_agg(release_track.track_id), '{}') into existing
  from music.release_tracks release_track where release_track.release_id = rel.id;

  -- Each track in its new place: kept, given a new file, or added.
  for entry, place in
    select value, ordinality::integer from jsonb_array_elements(entries) with ordinality
  loop
    target_track := nullif(btrim(entry ->> 'id'), '')::uuid;
    intent_id := nullif(btrim(entry ->> 'uploadIntentId'), '')::uuid;
    -- A single is titled as its release.
    track_titles := case when entry_count = 1 then release_titles
                         else private.edit_localized_titles(entry -> 'localizedTitles') end;
    track_title := case when entry_count = 1 then release_title
                        else private.edit_preferred_title(track_titles, entry ->> 'title') end;
    if track_title is null then
      raise exception 'Add a title in at least one language for track %.', place using errcode = '22023';
    end if;

    if target_track is not null then
      if not target_track = any(existing) then
        raise exception 'Track % is not on this release', place using errcode = '22023';
      end if;
      update music.tracks set title = track_title, updated_by = p_actor, updated_at = now()
      where id = target_track;

      if intent_id is not null then
        select * into original_item from media.submission_items item
        where item.submission_id = sub.id and item.music_track_id = target_track and item.replaces_item_id is null
        order by item.created_at desc limit 1;

        if live then
          if not found then
            raise exception 'Track % cannot be given a new file. Delete it and add the new file as a track instead.', place
              using errcode = '22023';
          end if;
          -- The live file plays on until this one is approved and processed.
          delete from media.submission_items item where item.replaces_item_id = original_item.id;
          perform private.add_edit_submission_item(
            sub.id, intent_id, 'track'::media.submission_item_role, track_title, place,
            '{}'::jsonb, null, original_item.id);
        else
          -- Not live yet: the new file simply takes the old one's place.
          delete from media.submission_items item
          where item.submission_id = sub.id and item.music_track_id = target_track;
          update music.tracks set media_asset_id = null, duration_ms = null where id = target_track;
          perform private.add_edit_submission_item(
            sub.id, intent_id, 'track'::media.submission_item_role, track_title, place,
            '{}'::jsonb, target_track, null);
        end if;
        media_changed := true;
        replaced := replaced + 1;
      end if;
    else
      if intent_id is null then
        raise exception 'Track % needs an audio file.', place using errcode = '22023';
      end if;
      insert into music.tracks (owner_creator_account_id, title, publication_status, created_by, updated_by)
      values (rel.owner_creator_account_id, track_title, 'draft'::media.publication_status, p_actor, p_actor)
      returning id into target_track;
      insert into music.release_tracks (release_id, track_id, disc_number, track_number)
      values (rel.id, target_track, 1, 300000 + place);
      perform private.add_edit_submission_item(
        sub.id, intent_id, 'track'::media.submission_item_role, track_title, place,
        '{}'::jsonb, target_track, null);
      media_changed := true;
      added := added + 1;
    end if;

    if target_track = any(kept) then
      raise exception 'Track % is listed twice', place using errcode = '22023';
    end if;
    kept := kept || target_track;

    -- Its titles in each language, published with the track.
    foreach locale_name in array array['en', 'ar', 'fr'] loop
      if nullif(track_titles ->> locale_name, '') is null then
        delete from music.track_localizations l where l.track_id = target_track and l.locale = locale_name;
      else
        insert into music.track_localizations (track_id, locale, title, is_primary, publication_status, created_by, updated_by)
        select target_track, locale_name, track_titles ->> locale_name, locale_name = 'en',
          track.publication_status, p_actor, p_actor
        from music.tracks track where track.id = target_track
        on conflict (track_id, locale) do update
          set title = excluded.title,
              publication_status = excluded.publication_status,
              updated_by = p_actor,
              updated_at = now();
      end if;
    end loop;

    perform private.set_track_credit_refs(
      target_track,
      rel.owner_creator_account_id,
      nullif(btrim(entry ->> 'mainArtistName'), ''),
      nullif(btrim(entry ->> 'mainArtistId'), '')::uuid,
      coalesce(entry -> 'contributors', '[]'::jsonb)
    );

    update media.submission_items item
    set sort_order = place, title = track_title, updated_at = now()
    where item.submission_id = sub.id
      and (item.music_track_id = target_track
        or item.replaces_item_id in (
          select original.id from media.submission_items original
          where original.submission_id = sub.id and original.music_track_id = target_track));
  end loop;

  -- Tracks left out are deleted, with their files.
  foreach removed in array existing loop
    if not removed = any(kept) then
      delete from media.submission_items item
      where item.submission_id = sub.id and item.music_track_id = removed;
      delete from music.release_tracks release_track
      where release_track.release_id = rel.id and release_track.track_id = removed;
      perform private.cleanup_orphan_music_track(removed);
      deleted := deleted + 1;
    end if;
  end loop;

  -- The new order. Numbers move out of the way first: (release, disc, number) is unique.
  update music.release_tracks release_track
  set track_number = release_track.track_number + 100000
  where release_track.release_id = rel.id;
  update music.release_tracks release_track
  set disc_number = 1, track_number = ordered.place
  from unnest(kept) with ordinality as ordered(track_id, place)
  where release_track.release_id = rel.id and release_track.track_id = ordered.track_id;

  -- Credits on a live release show at once, so the credited artists must be visible.
  if live then
    update music.artists artist
    set publication_status = 'published'::media.publication_status, updated_at = now()
    where artist.id in (
        select credit.artist_id from music.release_tracks release_track
        join music.track_artists credit on credit.track_id = release_track.track_id
        where release_track.release_id = rel.id)
      and artist.publication_status <> 'published'::media.publication_status
      and (artist.is_credit_only or p_is_admin);
  end if;

  if cover_intent is not null then
    perform private.replace_submission_artwork(sub.id, cover_intent, rel.cover_asset_id);
    media_changed := true;
  end if;

  update media.submissions
  set title = release_title,
      description = nullif(btrim(p_edit ->> 'description'), ''),
      updated_by = p_actor,
      updated_at = now()
  where id = sub.id;

  return jsonb_build_object(
    'mediaChanged', media_changed, 'live', live,
    'added', added, 'replaced', replaced, 'deleted', deleted, 'trackCount', entry_count
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Saving a Learn album or lesson set.

create or replace function private.save_learning_submission_edit(
  p_submission_id uuid,
  p_edit jsonb,
  p_actor uuid,
  p_is_admin boolean
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  sub media.submissions%rowtype;
  is_album boolean;
  collection_id uuid;
  live boolean;
  current_cantor uuid;
  current_cover uuid;
  current_timing text;
  current_scheduled timestamptz;
  next_cantor uuid;
  next_season uuid;
  next_hymn uuid;
  titles jsonb := private.edit_localized_titles(p_edit -> 'localizedTitles');
  collection_title text;
  timing text := lower(coalesce(nullif(btrim(p_edit ->> 'releaseTimingMode'), ''), ''));
  scheduled_at timestamptz;
  entries jsonb := coalesce(p_edit -> 'items', '[]'::jsonb);
  entry jsonb;
  place integer;
  entry_count integer;
  kept uuid[] := '{}';
  original_item media.submission_items%rowtype;
  item_titles jsonb;
  item_title text;
  intent_id uuid;
  new_item uuid;
  removed record;
  locale_name text;
  cover_intent uuid := nullif(btrim(p_edit ->> 'coverUploadIntentId'), '')::uuid;
  media_changed boolean := false;
  added integer := 0;
  replaced integer := 0;
  deleted integer := 0;
begin
  select * into sub from media.submissions where id = p_submission_id;
  is_album := sub.submission_type = 'learning_album'::media.submission_type;

  if is_album then
    select album.id, album.publication_status = 'published'::media.publication_status, album.cantor_id,
           album.cover_asset_id, album.release_timing_mode, album.scheduled_release_at, album.season_id
    into collection_id, live, current_cantor, current_cover, current_timing, current_scheduled, next_season
    from learning.albums album where album.submission_id = sub.id for update;
  else
    select lesson_set.id, lesson_set.publication_status = 'published'::media.publication_status, lesson_set.cantor_id,
           lesson_set.cover_asset_id, lesson_set.release_timing_mode, lesson_set.scheduled_release_at,
           lesson_set.season_id, lesson_set.hymn_id
    into collection_id, live, current_cantor, current_cover, current_timing, current_scheduled, next_season, next_hymn
    from learning.lesson_sets lesson_set where lesson_set.submission_id = sub.id for update;
  end if;
  if collection_id is null then
    raise exception 'This submission has nothing to edit' using errcode = 'P0002';
  end if;

  collection_title := private.edit_preferred_title(titles, p_edit ->> 'title');
  if collection_title is null then
    raise exception 'Add a title in English, Arabic, or French.' using errcode = '22023';
  end if;
  if jsonb_typeof(entries) <> 'array' or jsonb_array_length(entries) = 0 then
    raise exception 'Keep at least one %.', case when is_album then 'recording' else 'lesson' end using errcode = '22023';
  end if;
  entry_count := jsonb_array_length(entries);

  -- The artist, chosen or named as when submitting.
  next_cantor := current_cantor;
  if (nullif(btrim(p_edit ->> 'artistId'), '') is not null
        and (p_edit ->> 'artistId')::uuid is distinct from (
          select coalesce(cantor.artist_id, cantor.id) from learning.cantors cantor where cantor.id = current_cantor))
     or (nullif(btrim(p_edit ->> 'artistId'), '') is null and nullif(btrim(p_edit ->> 'artistName'), '') is not null) then
    next_cantor := private.resolve_learning_submission_artist(
      sub.creator_account_id,
      nullif(btrim(p_edit ->> 'artistId'), '')::uuid,
      nullif(btrim(p_edit ->> 'artistName'), ''));
  end if;
  if live and next_cantor is distinct from current_cantor
     and not exists (select 1 from learning.cantors cantor where cantor.id = next_cantor
       and cantor.publication_status = 'published'::media.publication_status) then
    if not p_is_admin then
      raise exception 'Choose an artist who is already on Coptic Vine for live content, or ask Coptic Vine to add them.'
        using errcode = '22023';
    end if;
    update learning.cantors set publication_status = 'published'::media.publication_status, updated_at = now()
    where id = next_cantor;
  end if;

  if p_edit ? 'seasonId' then
    next_season := nullif(btrim(p_edit ->> 'seasonId'), '')::uuid;
    if next_season is not null and not exists (
      select 1 from learning.seasons season where season.id = next_season
        and season.publication_status = 'published'::media.publication_status) then
      raise exception 'That season is not available' using errcode = '22023';
    end if;
  end if;

  if not is_album and p_edit ? 'hymnId' then
    next_hymn := nullif(btrim(p_edit ->> 'hymnId'), '')::uuid;
    if next_hymn is null then
      raise exception 'Choose the hymn this lesson set teaches.' using errcode = '22023';
    end if;
    if not exists (
      select 1 from learning.hymns hymn where hymn.id = next_hymn
        and (hymn.publication_status = 'published'::media.publication_status
          or (not live and hymn.created_by = sub.created_by
              and hymn.metadata ->> 'creatorAccountId' = sub.creator_account_id::text)
          or p_is_admin)) then
      raise exception 'That hymn is not available%', case when live then ' for live content' else '' end using errcode = '22023';
    end if;
    if live and p_is_admin then
      update learning.hymns set publication_status = 'published'::media.publication_status, updated_at = now()
      where id = next_hymn and publication_status <> 'published'::media.publication_status;
    end if;
  end if;

  -- Timing only matters before it goes live; a new date keeps the 48-hour notice.
  if not live and timing <> '' then
    if timing not in ('asap', 'scheduled') then
      raise exception 'Unsupported release timing' using errcode = '22023';
    end if;
    scheduled_at := nullif(btrim(p_edit ->> 'scheduledReleaseAt'), '')::timestamptz;
    if timing = 'scheduled' then
      if coalesce(scheduled_at, current_scheduled) is null then
        raise exception 'Choose a scheduled release date and time.' using errcode = '22023';
      end if;
      if scheduled_at is not null and scheduled_at is distinct from current_scheduled
         and scheduled_at < public.earliest_release_at() and not p_is_admin then
        raise exception 'A release must be scheduled at least 48 hours out (earliest %)',
          to_char(public.earliest_release_at(), 'YYYY-MM-DD HH24:MI') || ' UTC' using errcode = '22023';
      end if;
    end if;
  else
    timing := '';
  end if;

  if is_album then
    update learning.albums album
    set title = collection_title,
        description = nullif(btrim(p_edit ->> 'description'), ''),
        cantor_id = next_cantor,
        season_id = next_season,
        release_timing_mode = case when timing = '' then album.release_timing_mode else timing end,
        scheduled_release_at = case when timing = '' then album.scheduled_release_at
                                    when timing = 'asap' then null
                                    else coalesce(scheduled_at, album.scheduled_release_at) end,
        original_release_date = case when p_edit ? 'originalReleaseDate'
                                     then nullif(btrim(p_edit ->> 'originalReleaseDate'), '')::date
                                     else album.original_release_date end,
        updated_by = p_actor, updated_at = now()
    where album.id = collection_id;
    foreach locale_name in array array['en', 'ar', 'fr'] loop
      if nullif(titles ->> locale_name, '') is null then
        delete from learning.album_localizations l where l.album_id = collection_id and l.locale = locale_name;
      else
        insert into learning.album_localizations (album_id, locale, title)
        values (collection_id, locale_name, titles ->> locale_name)
        on conflict (album_id, locale) do update set title = excluded.title, updated_at = now();
      end if;
    end loop;
  else
    update learning.lesson_sets lesson_set
    set title = collection_title,
        description = nullif(btrim(p_edit ->> 'description'), ''),
        cantor_id = next_cantor,
        season_id = next_season,
        hymn_id = next_hymn,
        release_timing_mode = case when timing = '' then lesson_set.release_timing_mode else timing end,
        scheduled_release_at = case when timing = '' then lesson_set.scheduled_release_at
                                    when timing = 'asap' then null
                                    else coalesce(scheduled_at, lesson_set.scheduled_release_at) end,
        original_release_date = case when p_edit ? 'originalReleaseDate'
                                     then nullif(btrim(p_edit ->> 'originalReleaseDate'), '')::date
                                     else lesson_set.original_release_date end,
        updated_by = p_actor, updated_at = now()
    where lesson_set.id = collection_id;
    foreach locale_name in array array['en', 'ar', 'fr'] loop
      if nullif(titles ->> locale_name, '') is null then
        delete from learning.lesson_set_localizations l where l.lesson_set_id = collection_id and l.locale = locale_name;
      else
        insert into learning.lesson_set_localizations (lesson_set_id, locale, title)
        values (collection_id, locale_name, titles ->> locale_name)
        on conflict (lesson_set_id, locale) do update set title = excluded.title, updated_at = now();
      end if;
    end loop;
  end if;

  -- Live recordings and lessons move out of the way of the new order: their
  -- (collection, sort_order) is unique.
  if live then
    if is_album then
      update learning.album_recordings set sort_order = sort_order + 100000 where album_id = collection_id;
    else
      update learning.lessons set sort_order = sort_order + 100000 where lesson_set_id = collection_id;
    end if;
  end if;

  for entry, place in
    select value, ordinality::integer from jsonb_array_elements(entries) with ordinality
  loop
    intent_id := nullif(btrim(entry ->> 'uploadIntentId'), '')::uuid;
    if is_album then
      -- A single recording is titled as its album.
      item_titles := case when entry_count = 1 then titles
                          else private.edit_localized_titles(entry -> 'localizedTitles') end;
      item_title := case when entry_count = 1 then collection_title
                         else private.edit_preferred_title(item_titles, entry ->> 'title') end;
      if item_title is null then
        raise exception 'Add a title in at least one language for recording %.', place using errcode = '22023';
      end if;
    else
      -- Lessons are numbered in order, as when submitting.
      item_titles := '{}'::jsonb;
      item_title := 'Lesson ' || place;
    end if;

    if nullif(btrim(entry ->> 'id'), '') is not null then
      select * into original_item from media.submission_items item
      where item.id = (entry ->> 'id')::uuid and item.submission_id = sub.id
        and item.role <> 'artwork'::media.submission_item_role and item.replaces_item_id is null;
      if not found then
        raise exception 'Item % is not part of this submission', place using errcode = '22023';
      end if;
      if original_item.id = any(kept) then
        raise exception 'Item % is listed twice', place using errcode = '22023';
      end if;

      update media.submission_items item
      set title = item_title, localized_titles = private.edit_compact_titles(item_titles),
          sort_order = place, updated_at = now()
      where item.id = original_item.id or item.replaces_item_id = original_item.id;

      if live then
        if is_album then
          update learning.album_recordings recording
          set title = item_title, sort_order = place, updated_by = p_actor, updated_at = now()
          where recording.album_id = collection_id
            and recording.metadata ->> 'submissionItemId' = original_item.id::text;
        else
          update learning.lessons lesson
          set title = item_title, sort_order = place, updated_by = p_actor, updated_at = now()
          where lesson.lesson_set_id = collection_id
            and lesson.metadata ->> 'submissionItemId' = original_item.id::text;
        end if;
      end if;

      if intent_id is not null then
        if live then
          -- The live file plays on until this one is approved and processed.
          delete from media.submission_items item where item.replaces_item_id = original_item.id;
          perform private.add_edit_submission_item(
            sub.id, intent_id, original_item.role, item_title, place,
            private.edit_compact_titles(item_titles), null, original_item.id);
          kept := kept || original_item.id;
        else
          new_item := private.add_edit_submission_item(
            sub.id, intent_id, original_item.role, item_title, place,
            private.edit_compact_titles(item_titles), null, null);
          delete from media.submission_items item where item.id = original_item.id;
          kept := kept || new_item;
        end if;
        media_changed := true;
        replaced := replaced + 1;
      else
        kept := kept || original_item.id;
      end if;
    else
      if intent_id is null then
        raise exception '% % needs a file.', case when is_album then 'Recording' else 'Lesson' end, place
          using errcode = '22023';
      end if;
      new_item := private.add_edit_submission_item(
        sub.id, intent_id, 'lesson'::media.submission_item_role, item_title, place,
        private.edit_compact_titles(item_titles), null, null);
      kept := kept || new_item;
      media_changed := true;
      added := added + 1;
    end if;
  end loop;

  -- Items left out are deleted: their live recording or lesson, and their files.
  for removed in
    select item.id from media.submission_items item
    where item.submission_id = sub.id
      and item.role <> 'artwork'::media.submission_item_role
      and item.replaces_item_id is null
      and not item.id = any(kept)
  loop
    if is_album then
      delete from learning.album_recordings recording
      where recording.album_id = collection_id and recording.metadata ->> 'submissionItemId' = removed.id::text;
    else
      delete from learning.lessons lesson
      where lesson.lesson_set_id = collection_id and lesson.metadata ->> 'submissionItemId' = removed.id::text;
    end if;
    delete from media.submission_items item where item.id = removed.id;
    deleted := deleted + 1;
  end loop;

  -- The localized titles of live recordings and lessons follow their items.
  if live then
    if is_album then
      delete from learning.recording_localizations l
      using learning.album_recordings recording
      where recording.id = l.recording_id and recording.album_id = collection_id;
      insert into learning.recording_localizations (recording_id, locale, title)
      select recording.id, entry_title.key, entry_title.value
      from learning.album_recordings recording
      join media.submission_items item on item.id::text = recording.metadata ->> 'submissionItemId'
      cross join lateral jsonb_each_text(item.localized_titles) entry_title
      where recording.album_id = collection_id
        and entry_title.key in ('en', 'ar', 'fr') and nullif(btrim(entry_title.value), '') is not null;
    end if;
  end if;

  if cover_intent is not null then
    perform private.replace_submission_artwork(sub.id, cover_intent, current_cover);
    media_changed := true;
  end if;

  update media.submissions
  set title = collection_title,
      description = nullif(btrim(p_edit ->> 'description'), ''),
      updated_by = p_actor,
      updated_at = now()
  where id = sub.id;

  return jsonb_build_object(
    'mediaChanged', media_changed, 'live', live,
    'added', added, 'replaced', replaced, 'deleted', deleted, 'itemCount', entry_count
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Applying new and replaced files to live content.

-- Music: each waiting file takes its track's place; superseded artwork goes.
-- Runs at the end of publish_music_submission_internal, when every file is ready.
create or replace function private.apply_music_submission_replacements(p_submission_id uuid, p_actor uuid default null)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  rel music.releases%rowtype;
  waiting record;
  applied integer := 0;
begin
  select * into rel from music.releases release
  where nullif(release.metadata ->> 'submissionId', '')::uuid = p_submission_id;
  if not found or rel.publication_status <> 'published'::media.publication_status then
    return 0;
  end if;

  for waiting in
    select replacement.id, replacement.media_asset_id, original.id original_id,
           original.music_track_id, original.sort_order, original.title,
           coalesce(asset.duration_ms, nullif(round((job.probe -> 'output' -> 'format' ->> 'duration')::numeric * 1000), 0)::bigint) duration_ms
    from media.submission_items replacement
    join media.submission_items original on original.id = replacement.replaces_item_id
    join media.media_assets asset on asset.id = replacement.media_asset_id
    left join media.media_processing_jobs job on job.id = replacement.media_processing_job_id
    where replacement.submission_id = p_submission_id
      and private.submission_item_media_ready(replacement.id)
  loop
    update media.media_assets
    set publication_status = 'published'::media.publication_status, updated_by = p_actor, updated_at = now()
    where id = waiting.media_asset_id;

    if waiting.music_track_id is not null then
      update music.tracks
      set media_asset_id = waiting.media_asset_id,
          duration_ms = waiting.duration_ms,
          updated_by = coalesce(p_actor, updated_by),
          updated_at = now()
      where id = waiting.music_track_id;
    end if;

    update media.submission_items
    set replaces_item_id = null,
        music_track_id = waiting.music_track_id,
        sort_order = waiting.sort_order,
        title = waiting.title,
        updated_at = now()
    where id = waiting.id;
    update media.submission_items set music_track_id = null where id = waiting.original_id;
    delete from media.submission_items where id = waiting.original_id;
    applied := applied + 1;
  end loop;

  perform private.drop_superseded_artwork(
    p_submission_id,
    (select release.cover_asset_id from music.releases release where release.id = rel.id));
  return applied;
end;
$$;

-- Something new waits to go live on this published release: a replacement
-- file, a track not yet published, or artwork newer than the cover.
create or replace function private.music_submission_has_pending_edits(p_submission_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
      select 1 from media.submission_items item
      where item.submission_id = p_submission_id and item.replaces_item_id is not null)
    or exists (
      select 1 from music.releases release
      join music.release_tracks release_track on release_track.release_id = release.id
      join music.tracks track on track.id = release_track.track_id
      where nullif(release.metadata ->> 'submissionId', '')::uuid = p_submission_id
        and track.publication_status <> 'published'::media.publication_status)
    or exists (
      select 1 from music.releases release
      join media.submission_items item on item.submission_id = p_submission_id
        and item.role = 'artwork'::media.submission_item_role
        and item.media_asset_id is not null
        and item.media_asset_id is distinct from release.cover_asset_id
      where nullif(release.metadata ->> 'submissionId', '')::uuid = p_submission_id
        and item.created_at > coalesce((
          select max(cover_item.created_at) from media.submission_items cover_item
          where cover_item.submission_id = p_submission_id
            and cover_item.media_asset_id = release.cover_asset_id), '-infinity'::timestamptz));
$$;

-- Learn: on a published album or lesson set, each ready replacement takes its
-- recording's or lesson's place, each ready new item becomes a published
-- recording or lesson, and the newest ready artwork becomes the cover.
create or replace function private.apply_learning_submission_edits(p_submission_id uuid, p_actor uuid default null)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  sub media.submissions%rowtype;
  is_album boolean;
  collection_id uuid;
  collection_title text;
  cover_asset uuid;
  newest_cover uuid;
  ready record;
  applied integer := 0;
begin
  select * into sub from media.submissions where id = p_submission_id;
  if not found then return 0; end if;
  is_album := sub.submission_type = 'learning_album'::media.submission_type;

  if is_album then
    select album.id, album.title, album.cover_asset_id into collection_id, collection_title, cover_asset
    from learning.albums album
    where album.submission_id = sub.id and album.publication_status = 'published'::media.publication_status
    for update;
  elsif sub.submission_type = 'learning_lesson_set'::media.submission_type then
    select lesson_set.id, lesson_set.title, lesson_set.cover_asset_id into collection_id, collection_title, cover_asset
    from learning.lesson_sets lesson_set
    where lesson_set.submission_id = sub.id and lesson_set.publication_status = 'published'::media.publication_status
    for update;
  end if;
  if collection_id is null then return 0; end if;

  -- Replacements.
  for ready in
    select replacement.id, replacement.media_asset_id, replacement.audio_only_asset_id,
           asset.media_type, coalesce(audio.duration_ms, asset.duration_ms) duration_ms,
           original.id original_id, original.sort_order, original.title, original.localized_titles
    from media.submission_items replacement
    join media.submission_items original on original.id = replacement.replaces_item_id
    join media.media_assets asset on asset.id = replacement.media_asset_id
    left join media.media_assets audio on audio.id = replacement.audio_only_asset_id
    where replacement.submission_id = sub.id
      and private.submission_item_media_ready(replacement.id)
  loop
    update media.media_assets
    set publication_status = 'published'::media.publication_status, updated_by = p_actor, updated_at = now()
    where id in (ready.media_asset_id, ready.audio_only_asset_id);

    if is_album then
      update learning.album_recordings recording
      set media_asset_id = ready.media_asset_id,
          duration_ms = ready.duration_ms,
          metadata = recording.metadata || jsonb_build_object('submissionItemId', ready.id),
          updated_at = now()
      where recording.album_id = collection_id
        and recording.metadata ->> 'submissionItemId' = ready.original_id::text;
    else
      update learning.lessons lesson
      set media_asset_id = ready.media_asset_id,
          media_type = ready.media_type::text::learning.lesson_media_type,
          audio_asset_id = ready.audio_only_asset_id,
          duration_ms = ready.duration_ms,
          metadata = lesson.metadata || jsonb_build_object('submissionItemId', ready.id),
          updated_at = now()
      where lesson.lesson_set_id = collection_id
        and lesson.metadata ->> 'submissionItemId' = ready.original_id::text;
    end if;

    update media.submission_items
    set replaces_item_id = null, sort_order = ready.sort_order, title = ready.title,
        localized_titles = ready.localized_titles, updated_at = now()
    where id = ready.id;
    delete from media.submission_items where id = ready.original_id;
    applied := applied + 1;
  end loop;

  -- New recordings and lessons.
  for ready in
    select candidate.id, candidate.media_asset_id, candidate.audio_only_asset_id, candidate.title,
           candidate.sort_order, candidate.localized_titles,
           asset.media_type, coalesce(audio.duration_ms, asset.duration_ms) duration_ms
    from media.submission_items candidate
    join media.media_assets asset on asset.id = candidate.media_asset_id
    left join media.media_assets audio on audio.id = candidate.audio_only_asset_id
    where candidate.submission_id = sub.id
      and candidate.role <> 'artwork'::media.submission_item_role
      and candidate.replaces_item_id is null
      and private.submission_item_media_ready(candidate.id)
      and not exists (
        select 1 from learning.album_recordings recording
        where is_album and recording.album_id = collection_id
          and recording.metadata ->> 'submissionItemId' = candidate.id::text)
      and not exists (
        select 1 from learning.lessons lesson
        where not is_album and lesson.lesson_set_id = collection_id
          and lesson.metadata ->> 'submissionItemId' = candidate.id::text)
  loop
    update media.media_assets
    set publication_status = 'published'::media.publication_status, updated_by = p_actor, updated_at = now()
    where id in (ready.media_asset_id, ready.audio_only_asset_id);

    if is_album then
      insert into learning.album_recordings
        (album_id, media_asset_id, title, duration_ms, sort_order, publication_status, metadata, created_by, updated_by)
      values
        (collection_id, ready.media_asset_id, coalesce(ready.title, collection_title), ready.duration_ms, ready.sort_order,
         'published'::media.publication_status, jsonb_build_object('submissionItemId', ready.id), p_actor, p_actor);
      insert into learning.recording_localizations (recording_id, locale, title)
      select recording.id, entry_title.key, entry_title.value
      from learning.album_recordings recording
      cross join lateral jsonb_each_text(ready.localized_titles) entry_title
      where recording.album_id = collection_id
        and recording.metadata ->> 'submissionItemId' = ready.id::text
        and entry_title.key in ('en', 'ar', 'fr') and nullif(btrim(entry_title.value), '') is not null
      on conflict (recording_id, locale) do update set title = excluded.title, updated_at = now();
    else
      insert into learning.lessons
        (lesson_set_id, media_asset_id, media_type, audio_asset_id, title, duration_ms, sort_order,
         publication_status, metadata, created_by, updated_by)
      values
        (collection_id, ready.media_asset_id, ready.media_type::text::learning.lesson_media_type,
         ready.audio_only_asset_id, coalesce(ready.title, collection_title), ready.duration_ms, ready.sort_order,
         'published'::media.publication_status, jsonb_build_object('submissionItemId', ready.id), p_actor, p_actor);
    end if;
    applied := applied + 1;
  end loop;

  -- The newest ready artwork is the cover.
  select item.media_asset_id into newest_cover
  from media.submission_items item
  where item.submission_id = sub.id and item.role = 'artwork'::media.submission_item_role
    and private.submission_item_media_ready(item.id)
  order by item.created_at desc, item.id desc
  limit 1;

  if newest_cover is not null and newest_cover is distinct from cover_asset then
    update media.media_assets
    set publication_status = 'published'::media.publication_status, updated_by = p_actor, updated_at = now()
    where id = newest_cover;
    if is_album then
      update learning.albums set cover_asset_id = newest_cover, updated_at = now() where id = collection_id;
    else
      update learning.lesson_sets set cover_asset_id = newest_cover, updated_at = now() where id = collection_id;
    end if;
    cover_asset := newest_cover;
    applied := applied + 1;
  end if;
  perform private.drop_superseded_artwork(sub.id, cover_asset);

  return applied;
end;
$$;

-- ---------------------------------------------------------------------------
-- One save.

create or replace function public.save_submission_edit(p_submission_id uuid, p_edit jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  actor uuid := auth.uid();
  sub media.submissions%rowtype;
  is_admin boolean := private.is_admin();
  outcome jsonb;
  previous_status media.publication_status;
  next_status media.publication_status;
begin
  if actor is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_edit is null or jsonb_typeof(p_edit) <> 'object' then
    raise exception 'Nothing to save' using errcode = '22023';
  end if;

  select * into sub from media.submissions where id = p_submission_id for update;
  if not found then
    raise exception 'Submission not found' using errcode = 'P0002';
  end if;
  if not private.can_edit_creator_account(sub.creator_account_id) then
    raise exception 'Not authorized for this submission' using errcode = '42501';
  end if;
  if sub.status in ('rejected'::media.publication_status, 'archived'::media.publication_status) then
    raise exception 'This submission was not approved, so it can no longer be edited. Send a new submission instead.'
      using errcode = '22023';
  end if;

  if sub.submission_type = 'music_release'::media.submission_type then
    outcome := private.save_music_submission_edit(sub.id, p_edit, actor, is_admin);
  elsif sub.submission_type in ('learning_album'::media.submission_type, 'learning_lesson_set'::media.submission_type) then
    outcome := private.save_learning_submission_edit(sub.id, p_edit, actor, is_admin);
  else
    raise exception 'This kind of submission cannot be edited here' using errcode = '22023';
  end if;

  perform private.attach_completed_submission_jobs(sub.id);

  -- An artist's edit goes to review when it is not live yet, or brings new
  -- files to live content. An admin's keeps the status it found.
  previous_status := sub.status;
  next_status := case
    when is_admin then previous_status
    when previous_status = 'published'::media.publication_status
      then case when (outcome ->> 'mediaChanged')::boolean then 'pending_review'::media.publication_status
                else previous_status end
    else 'pending_review'::media.publication_status
  end;

  if next_status = 'pending_review'::media.publication_status and previous_status <> next_status then
    update media.submissions
    set status = next_status,
        submitted_at = now(),
        review_due_at = now() + interval '48 hours',
        reviewer_id = null,
        reviewed_at = null,
        review_notes = null,
        approved_at = null,
        rejected_at = null,
        updated_by = actor,
        updated_at = now()
    where id = sub.id;
  end if;

  perform private.add_media_submission_event(
    sub.id, actor,
    case when is_admin then 'edited_by_admin' else 'edited_by_creator' end,
    previous_status, next_status, null, outcome);

  -- An admin's new files on live content go live once processed: now, if
  -- they already are, otherwise when processing settles.
  if is_admin and next_status = 'published'::media.publication_status then
    if sub.submission_type = 'music_release'::media.submission_type then
      if private.submission_required_items_ready(sub.id) and private.music_submission_has_pending_edits(sub.id) then
        perform private.publish_music_submission_internal(sub.id, actor, 'admin_edit');
      end if;
    else
      perform private.apply_learning_submission_edits(sub.id, actor);
    end if;
  end if;

  return public.get_submission_editor(sub.id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Publishing applies waiting files. These are the live definitions with that
-- added (and published_at kept from the first publication, since a
-- republished edit is not a new release).

create or replace function private.publish_music_submission_internal(p_submission_id uuid, p_actor_id uuid default null::uuid, p_reason text default 'automatic'::text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  submission_record media.submissions%rowtype;
  release_record music.releases%rowtype;
  previous_status media.publication_status;
  actor_id uuid;
  published_asset_count integer := 0;
  invalid_track_count integer := 0;
begin
  select *
  into submission_record
  from media.submissions submission
  where submission.id = p_submission_id
  for update;

  if not found then
    raise exception 'Submission not found' using errcode = 'P0002';
  end if;

  if submission_record.submission_type <> 'music_release'::media.submission_type then
    raise exception 'Automatic release publishing only supports music releases' using errcode = '22023';
  end if;

  if submission_record.status not in (
    'approved'::media.publication_status,
    'processing'::media.publication_status,
    'published'::media.publication_status
  ) then
    raise exception 'Submission is not approved for publication' using errcode = '22023';
  end if;

  perform private.attach_completed_submission_jobs(submission_record.id);

  if not (select private.submission_required_items_ready(submission_record.id)) then
    raise exception 'Submission still has required items waiting for processing' using errcode = '22023';
  end if;

  select *
  into release_record
  from music.releases release
  where nullif(release.metadata ->> 'submissionId', '')::uuid = submission_record.id
  for update;

  if not found then
    raise exception 'Music release not found for submission' using errcode = 'P0002';
  end if;

  actor_id := coalesce(p_actor_id, submission_record.reviewer_id, submission_record.created_by);

  with published_assets as (
    update media.media_assets asset
    set publication_status = 'published'::media.publication_status,
        updated_by = actor_id,
        updated_at = now()
    from (
      select distinct item.media_asset_id
      from media.submission_items item
      where item.submission_id = submission_record.id
        and item.media_asset_id is not null
    ) asset_to_publish
    where asset.id = asset_to_publish.media_asset_id
    returning asset.id
  )
  select count(*)::integer
  into published_asset_count
  from published_assets;

  select count(*)::integer
  into invalid_track_count
  from music.release_tracks release_track
  join music.tracks track on track.id = release_track.track_id
  left join media.media_assets asset on asset.id = track.media_asset_id
  where release_track.release_id = release_record.id
    and (
      track.media_asset_id is null
      or asset.id is null
      or asset.processing_status <> 'completed'::media.processing_status
      or asset.publication_status <> 'published'::media.publication_status
    );

  if invalid_track_count > 0 then
    raise exception 'Release has tracks without completed published media assets' using errcode = '22023';
  end if;

  update music.artists artist
  set publication_status = 'published'::media.publication_status,
      updated_by = actor_id,
      updated_at = now()
  where artist.id = release_record.primary_artist_id
     or artist.id in (
       select track_artist.artist_id
       from music.release_tracks release_track
       join music.track_artists track_artist on track_artist.track_id = release_track.track_id
       where release_track.release_id = release_record.id
     );

  update music.artist_localizations localization
  set publication_status = 'published'::media.publication_status,
      updated_by = actor_id,
      updated_at = now()
  where localization.artist_id = release_record.primary_artist_id
     or localization.artist_id in (
       select track_artist.artist_id
       from music.release_tracks release_track
       join music.track_artists track_artist on track_artist.track_id = release_track.track_id
       where release_track.release_id = release_record.id
     );

  update music.tracks track
  set publication_status = 'published'::media.publication_status,
      updated_by = actor_id,
      updated_at = now()
  where track.id in (
    select release_track.track_id
    from music.release_tracks release_track
    where release_track.release_id = release_record.id
  );

  update music.track_localizations localization
  set publication_status = 'published'::media.publication_status,
      updated_by = actor_id,
      updated_at = now()
  where localization.track_id in (
    select release_track.track_id
    from music.release_tracks release_track
    where release_track.release_id = release_record.id
  );

  update music.release_localizations localization
  set publication_status = 'published'::media.publication_status,
      updated_by = actor_id,
      updated_at = now()
  where localization.release_id = release_record.id;

  update music.releases release
  set publication_status = 'published'::media.publication_status,
      release_date = coalesce(
        release.release_date,
        release.scheduled_release_at::date,
        current_date
      ),
      updated_by = actor_id,
      updated_at = now()
  where release.id = release_record.id
  returning * into release_record;

  previous_status := submission_record.status;

  update media.submissions submission
  set status = 'published'::media.publication_status,
      published_at = coalesce(submission.published_at, now()),
      updated_by = actor_id,
      updated_at = now()
  where submission.id = submission_record.id
  returning * into submission_record;

  -- Waiting files take their tracks' places, and older artwork goes.
  perform private.apply_music_submission_replacements(submission_record.id, actor_id);

  if previous_status <> 'published'::media.publication_status then
    perform private.add_media_submission_event(
      submission_record.id,
      actor_id,
      case when p_reason = 'scheduled' then 'published_automatically_on_schedule' else 'published_automatically' end,
      previous_status,
      submission_record.status,
      null,
      jsonb_build_object(
        'reason', p_reason,
        'releaseId', release_record.id,
        'publishedAssetCount', published_asset_count
      )
    );
  end if;

  return jsonb_build_object(
    'submissionId', submission_record.id,
    'submissionStatus', submission_record.status,
    'releaseId', release_record.id,
    'releaseStatus', release_record.publication_status,
    'publishedAt', submission_record.published_at,
    'publishedAssetCount', published_asset_count
  );
end;
$function$;

create or replace function private.publish_learning_submission_internal(p_submission_id uuid, p_actor_id uuid default null::uuid, p_reason text default 'automatic'::text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  sub media.submissions%rowtype;
  album learning.albums%rowtype;
  lesson_set learning.lesson_sets%rowtype;
  item record;
  locale_entry record;
  actor uuid;
  prior media.publication_status;
  media_count integer := 0;
  is_album boolean;
begin
  select * into sub from media.submissions where id=p_submission_id for update;
  if not found then raise exception 'Learning submission not found' using errcode='P0002'; end if;
  is_album := sub.submission_type = 'learning_album'::media.submission_type;
  if not is_album and sub.submission_type <> 'learning_lesson_set'::media.submission_type then
    raise exception 'Not a learning submission' using errcode='22023';
  end if;
  if sub.status = 'published'::media.publication_status then
    -- Already live: what an edit added or replaced goes live once ready.
    perform private.apply_learning_submission_edits(sub.id, p_actor_id);
    return jsonb_build_object('submissionId',sub.id,'status','published');
  end if;
  if sub.status <> 'approved'::media.publication_status or sub.approved_at is null then
    raise exception 'Coptic Vine approval is required before publishing' using errcode='42501';
  end if;

  if is_album then
    select * into album from learning.albums where submission_id=sub.id for update;
    if not found then raise exception 'Learning album not found' using errcode='P0002'; end if;
    if album.release_timing_mode='scheduled' and
      (album.scheduled_release_at is null or album.scheduled_release_at>now()) then
      return jsonb_build_object('submissionId',sub.id,'status','scheduled');
    end if;
  else
    select * into lesson_set from learning.lesson_sets where submission_id=sub.id for update;
    if not found then raise exception 'Learning lesson set not found' using errcode='P0002'; end if;
    if lesson_set.release_timing_mode='scheduled' and
      (lesson_set.scheduled_release_at is null or lesson_set.scheduled_release_at>now()) then
      return jsonb_build_object('submissionId',sub.id,'status','scheduled');
    end if;
  end if;

  perform private.attach_completed_submission_jobs(sub.id);
  if not private.submission_required_items_ready(sub.id) then
    raise exception 'Learning submission media is not ready' using errcode='22023';
  end if;
  actor := coalesce(p_actor_id,sub.reviewer_id,sub.created_by);
  select count(*) into media_count
    from media.submission_items i
    where i.submission_id=sub.id and i.role<>'artwork'::media.submission_item_role
      and i.replaces_item_id is null;
  if media_count=0 then raise exception 'Learning submission has no media' using errcode='22023'; end if;

  if is_album then
    if not exists(select 1 from learning.cantors c where c.id=album.cantor_id and
      (c.publication_status='published'::media.publication_status or c.owner_creator_account_id=sub.creator_account_id)) then
      raise exception 'Cantor must be published before learning album' using errcode='22023';
    end if;
    if album.season_id is not null and not exists(select 1 from learning.seasons s where s.id=album.season_id
      and s.publication_status='published'::media.publication_status) then
      raise exception 'Learning season must be published' using errcode='22023';
    end if;
    update learning.cantors set publication_status='published'::media.publication_status, updated_by=actor
      where id=album.cantor_id and owner_creator_account_id=sub.creator_account_id;
  else
    if not exists(select 1 from learning.cantors c where c.id=lesson_set.cantor_id and
      (c.publication_status='published'::media.publication_status or c.owner_creator_account_id=sub.creator_account_id)) then
      raise exception 'Cantor must be published before lesson set' using errcode='22023';
    end if;
    if not exists(select 1 from learning.hymns h where h.id=lesson_set.hymn_id
      and (h.publication_status='published'::media.publication_status
        or (h.created_by=sub.created_by
          and h.metadata->>'creatorAccountId'=sub.creator_account_id::text))) then
      raise exception 'Hymn must be published or created by this submitter' using errcode='22023';
    end if;
    update learning.hymns
       set publication_status='published'::media.publication_status,
           updated_by=actor
     where id=lesson_set.hymn_id
       and created_by=sub.created_by
       and metadata->>'creatorAccountId'=sub.creator_account_id::text;
    if lesson_set.season_id is not null and not exists(select 1 from learning.seasons s where s.id=lesson_set.season_id
      and s.publication_status='published'::media.publication_status) then
      raise exception 'Learning season must be published' using errcode='22023';
    end if;
    update learning.cantors set publication_status='published'::media.publication_status, updated_by=actor
      where id=lesson_set.cantor_id and owner_creator_account_id=sub.creator_account_id;
  end if;

  -- Make all processed assets visible before linking them to published content.
  update media.media_assets asset set publication_status='published'::media.publication_status,
      updated_by=actor, updated_at=now()
    where asset.id in (
      select distinct i.media_asset_id from media.submission_items i
      where i.submission_id=sub.id and i.media_asset_id is not null
    ) and asset.processing_status='completed'::media.processing_status;

  -- A replacement waiting for its item is applied below, not added as an item of its own.
  for item in
    select i.id,i.title,i.sort_order,i.role,i.media_asset_id,i.localized_titles,
      asset.media_type,asset.duration_ms,asset.processing_status
    from media.submission_items i
    left join media.media_assets asset on asset.id=i.media_asset_id
    where i.submission_id=sub.id and i.replaces_item_id is null
    order by i.sort_order,i.id
  loop
    if item.media_asset_id is null or item.processing_status <> 'completed'::media.processing_status then
      raise exception 'Incomplete learning submission item' using errcode='22023';
    end if;
    if item.role='artwork'::media.submission_item_role then
      if item.media_type <> 'image'::media.media_type then
        raise exception 'Learning artwork must be an image' using errcode='22023';
      end if;
      if is_album then
        update learning.albums set cover_asset_id=item.media_asset_id where id=album.id;
      else
        update learning.lesson_sets set cover_asset_id=item.media_asset_id where id=lesson_set.id;
      end if;
    elsif is_album then
      if item.media_type <> 'audio'::media.media_type then
        raise exception 'Learning album recordings must be audio' using errcode='22023';
      end if;
      if not exists(select 1 from learning.album_recordings r
        where r.album_id=album.id and r.metadata->>'submissionItemId'=item.id::text) then
        insert into learning.album_recordings
          (album_id,media_asset_id,title,duration_ms,sort_order,publication_status,metadata,created_by,updated_by)
        values
          (album.id,item.media_asset_id,coalesce(item.title,album.title),item.duration_ms,item.sort_order,
            'published'::media.publication_status,
            jsonb_build_object('submissionItemId',item.id),actor,actor);
      end if;
    else
      if item.media_type not in ('audio'::media.media_type,'video'::media.media_type) then
        raise exception 'Lesson media must be audio or video' using errcode='22023';
      end if;
      if not exists(select 1 from learning.lessons l
        where l.lesson_set_id=lesson_set.id and l.metadata->>'submissionItemId'=item.id::text) then
        insert into learning.lessons
          (lesson_set_id,media_asset_id,media_type,title,duration_ms,sort_order,publication_status,metadata,created_by,updated_by)
        values
          (lesson_set.id,item.media_asset_id,item.media_type::text::learning.lesson_media_type,
            coalesce(item.title,lesson_set.title),item.duration_ms,item.sort_order,
            'published'::media.publication_status,
            jsonb_build_object('submissionItemId',item.id),actor,actor);
      end if;
    end if;

    -- Titles for each recording or lesson follow the same per-language logic
    -- as music tracks, independent of the parent album or lesson-set title.
    if item.role <> 'artwork'::media.submission_item_role then
      for locale_entry in
        select key as locale, btrim(value) as title
        from jsonb_each_text(coalesce(item.localized_titles, '{}'::jsonb))
        where key in ('en','ar','fr') and nullif(btrim(value),'') is not null
      loop
        if is_album then
          insert into learning.recording_localizations(recording_id,locale,title)
          select rec.id,locale_entry.locale,locale_entry.title
          from learning.album_recordings rec
          where rec.album_id=album.id and rec.metadata->>'submissionItemId'=item.id::text
          on conflict(recording_id,locale) do update
            set title=excluded.title,updated_at=now();
        else
          insert into learning.lesson_localizations(lesson_id,locale,title)
          select lesson.id,locale_entry.locale,locale_entry.title
          from learning.lessons lesson
          where lesson.lesson_set_id=lesson_set.id
            and lesson.metadata->>'submissionItemId'=item.id::text
          on conflict(lesson_id,locale) do update
            set title=excluded.title,updated_at=now();
        end if;
      end loop;
    end if;
  end loop;

  if is_album then
    update learning.albums set publication_status='published'::media.publication_status,
      updated_by=actor where id=album.id;
  else
    update learning.lesson_sets set publication_status='published'::media.publication_status,
      updated_by=actor where id=lesson_set.id;
  end if;
  prior:=sub.status;
  update media.submissions set status='published'::media.publication_status,
    published_at=coalesce(published_at,now()),updated_by=actor where id=sub.id;

  -- Replacements an edit brought, and the newest artwork as the cover.
  perform private.apply_learning_submission_edits(sub.id, actor);

  perform private.add_media_submission_event(
    sub.id,actor,case when p_reason='scheduled' then 'published_automatically_on_schedule'
      else 'published_automatically' end,
    prior,'published'::media.publication_status,null,
    jsonb_build_object('learningType',sub.submission_type,'mediaItemCount',media_count)
  );
  return jsonb_build_object('submissionId',sub.id,'status','published','mediaItemCount',media_count);
end;
$function$;

-- When a file finishes processing: a published submission whose edit was
-- waiting for it goes live with it. The rest is the live definition.
create or replace function private.settle_submission_processing(p_upload_intent_id uuid)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  settled_count integer := 0;
  submission_record media.submissions%rowtype;
  target_submission_id uuid;
begin
  if p_upload_intent_id is null then
    return 0;
  end if;

  perform private.attach_pending_artist_profile_image(p_upload_intent_id);

  for target_submission_id in
    select distinct item.submission_id
    from media.submission_items item
    where item.upload_intent_id = p_upload_intent_id
  loop
    perform private.attach_completed_submission_jobs(target_submission_id);

    select *
    into submission_record
    from media.submissions submission
    where submission.id = target_submission_id
      and submission.status = 'published'::media.publication_status
    for update;

    if found then
      if submission_record.submission_type = 'music_release'::media.submission_type then
        if private.submission_required_items_ready(target_submission_id)
           and private.music_submission_has_pending_edits(target_submission_id) then
          perform private.publish_music_submission_internal(target_submission_id, null, 'edit_ready');
          settled_count := settled_count + 1;
        end if;
      else
        if private.apply_learning_submission_edits(target_submission_id, null) > 0 then
          settled_count := settled_count + 1;
        end if;
      end if;
      continue;
    end if;

    select *
    into submission_record
    from media.submissions submission
    where submission.id = target_submission_id
      and submission.status = 'processing'::media.publication_status
    for update;

    if not found then
      continue;
    end if;

    if not (select private.submission_required_items_ready(target_submission_id)) then
      continue;
    end if;

    update media.submissions submission
    set status = 'approved'::media.publication_status,
        updated_at = now()
    where submission.id = target_submission_id;

    perform private.add_media_submission_event(
      target_submission_id,
      submission_record.reviewer_id,
      'processing_completed',
      'processing'::media.publication_status,
      'approved'::media.publication_status,
      null,
      jsonb_build_object('uploadIntentId', p_upload_intent_id)
    );

    settled_count := settled_count + 1;
  end loop;

  return settled_count;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Who may call what.

revoke all on function private.edit_localized_titles(jsonb) from public;
revoke all on function private.edit_preferred_title(jsonb, text) from public;
revoke all on function private.edit_compact_titles(jsonb) from public;
revoke all on function private.submission_item_media_ready(uuid) from public;
revoke all on function private.submission_item_processing_state(uuid) from public;
revoke all on function private.add_edit_submission_item(uuid, uuid, media.submission_item_role, text, integer, jsonb, uuid, uuid) from public;
revoke all on function private.replace_submission_artwork(uuid, uuid, uuid) from public;
revoke all on function private.drop_superseded_artwork(uuid, uuid) from public;
revoke all on function private.save_music_submission_edit(uuid, jsonb, uuid, boolean) from public;
revoke all on function private.save_learning_submission_edit(uuid, jsonb, uuid, boolean) from public;
revoke all on function private.apply_music_submission_replacements(uuid, uuid) from public;
revoke all on function private.music_submission_has_pending_edits(uuid) from public;
revoke all on function private.apply_learning_submission_edits(uuid, uuid) from public;

revoke all on function public.get_submission_editor(uuid) from public, anon;
revoke all on function public.save_submission_edit(uuid, jsonb) from public, anon;
grant execute on function public.get_submission_editor(uuid) to authenticated;
grant execute on function public.save_submission_edit(uuid, jsonb) to authenticated;
