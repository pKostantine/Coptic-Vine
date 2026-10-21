-- Generated from Supabase by schema/pg-schema-dump.sql (read-only, structure only) on 2026-10-21.
-- Loaded into PGlite as the parity oracle by tests/lib/oracle.ts. Do not edit by hand.
create schema if not exists creator;
--;;
create schema if not exists learning;
--;;
create schema if not exists media;
--;;
create schema if not exists music;
--;;
create schema if not exists private;
--;;
create schema if not exists public;
--;;
create type public."Item Type" as enum ('Subdocument', 'Hyperlink', 'Inline');
--;;
create type public."Minimization" as enum ('Minimizable', 'Minimized');
--;;
create type public."Person Type" as enum ('Bishop/Priest', 'Priest', 'Deacon', 'Reader', 'People', 'Comment');
--;;
create type public."Prayer Type" as enum ('Single Alternating', 'Double Alternating', 'Recited Prayer', 'Silent Prayer', 'Chanted Prayer', 'Refrain', 'Pre-Refrain', 'Reverse Alternating', 'Quadruple Alternating', 'Invincible Coptic', 'White', 'Blue');
--;;
create type creator.app_role as enum ('user', 'creator', 'admin');
--;;
create type creator.creator_account_role as enum ('owner', 'manager', 'editor', 'uploader', 'viewer');
--;;
create type creator.creator_account_status as enum ('active', 'suspended', 'archived');
--;;
create type learning.lesson_media_type as enum ('audio', 'video');
--;;
create type music.lyric_kind as enum ('original', 'translation', 'transliteration');
--;;
create type music.lyric_sync_precision as enum ('unsynced', 'line', 'word');
--;;
create type media.media_provider as enum ('cloudflare_r2', 'external');
--;;
create type media.media_type as enum ('audio', 'video', 'image', 'document', 'other');
--;;
create type learning.playlist_item_kind as enum ('album_recording', 'lesson');
--;;
create type learning.playlist_visibility as enum ('private', 'unlisted', 'public');
--;;
create type music.playlist_visibility as enum ('private', 'unlisted', 'public');
--;;
create type media.processing_job_status as enum ('queued', 'processing', 'completed', 'failed', 'cancelled');
--;;
create type media.processing_job_type as enum ('audio_delivery', 'video_delivery', 'metadata_probe', 'image_delivery');
--;;
create type media.processing_status as enum ('pending', 'uploaded', 'queued', 'processing', 'completed', 'failed');
--;;
create type learning.progress_state as enum ('will_learn', 'learning', 'finished');
--;;
create type media.publication_status as enum ('draft', 'uploading', 'ready_to_submit', 'pending_review', 'changes_requested', 'approved', 'processing', 'published', 'rejected', 'archived');
--;;
create type music.release_type as enum ('single', 'ep', 'album');
--;;
create type media.submission_item_role as enum ('artwork', 'track', 'lesson', 'other');
--;;
create type media.submission_type as enum ('music_release', 'learning_album', 'learning_lesson_set', 'artist_update', 'cantor_update');
--;;
create type music.track_artist_role as enum ('primary', 'featured', 'composer', 'lyricist', 'arranger', 'producer', 'artwork');
--;;
create type media.upload_intent_status as enum ('authorized', 'uploaded', 'failed', 'expired', 'cancelled');
--;;
create table creator.creator_account_members (creator_account_id uuid not null, user_id uuid not null, role creator.creator_account_role not null, invited_by uuid, created_at timestamp with time zone not null, updated_at timestamp with time zone not null);
--;;
create table creator.creator_accounts (id uuid not null, display_name text not null, status creator.creator_account_status not null, created_by uuid, updated_by uuid, created_at timestamp with time zone not null, updated_at timestamp with time zone not null, identity_artist_id uuid);
--;;
create table creator.profiles (id uuid not null, display_name text, preferred_locale text not null, created_at timestamp with time zone not null, updated_at timestamp with time zone not null);
--;;
create table creator.user_roles (user_id uuid not null, role creator.app_role not null, granted_by uuid, granted_at timestamp with time zone not null, revoked_at timestamp with time zone, notes text);
--;;
create table learning.album_localizations (album_id uuid not null, locale text not null, title text not null, description text, created_at timestamp with time zone not null, updated_at timestamp with time zone not null);
--;;
create table learning.album_recordings (id uuid not null, album_id uuid not null, hymn_id uuid, media_asset_id uuid not null, title text not null, subtitle text, duration_ms bigint, sort_order integer not null, publication_status media.publication_status not null, metadata jsonb not null, created_by uuid, updated_by uuid, created_at timestamp with time zone not null, updated_at timestamp with time zone not null);
--;;
create table learning.albums (id uuid not null, owner_creator_account_id uuid, cantor_id uuid not null, season_id uuid, cover_asset_id uuid, submission_id uuid, title text not null, description text, publication_status media.publication_status not null, metadata jsonb not null, created_by uuid, updated_by uuid, created_at timestamp with time zone not null, updated_at timestamp with time zone not null, release_timing_mode text not null, scheduled_release_at timestamp with time zone, original_release_date date);
--;;
create table learning.cantor_localizations (cantor_id uuid not null, locale text not null, display_name text not null, biography text, created_at timestamp with time zone not null, updated_at timestamp with time zone not null);
--;;
create table learning.cantor_permissions (id uuid not null, cantor_id uuid not null, creator_account_id uuid not null, role text not null, created_at timestamp with time zone not null, updated_at timestamp with time zone not null);
--;;
create table learning.cantors (id uuid not null, owner_creator_account_id uuid, profile_image_asset_id uuid, display_name text not null, sort_name text, biography text, publication_status media.publication_status not null, metadata jsonb not null, created_by uuid, updated_by uuid, created_at timestamp with time zone not null, updated_at timestamp with time zone not null, artist_id uuid);
--;;
create table learning.hymn_localizations (hymn_id uuid not null, locale text not null, title text not null, subtitle text, description text, created_at timestamp with time zone not null, updated_at timestamp with time zone not null);
--;;
create table learning.hymn_progress (user_id uuid not null, hymn_id uuid not null, state learning.progress_state not null, started_at timestamp with time zone, finished_at timestamp with time zone, created_at timestamp with time zone not null, updated_at timestamp with time zone not null);
--;;
create table learning.hymn_relationships (id uuid not null, hymn_id uuid not null, related_hymn_id uuid not null, relationship_type text not null, sort_order integer not null, metadata jsonb not null, created_at timestamp with time zone not null, updated_at timestamp with time zone not null);
--;;
create table learning.hymn_seasons (hymn_id uuid not null, season_id uuid not null, sort_order integer not null, created_at timestamp with time zone not null);
--;;
create table learning.hymns (id uuid not null, source_hymn_key text, title text not null, subtitle text, description text, publication_status media.publication_status not null, metadata jsonb not null, created_by uuid, updated_by uuid, created_at timestamp with time zone not null, updated_at timestamp with time zone not null);
--;;
create table learning.item_likes (id uuid not null, user_id uuid not null, item_kind learning.playlist_item_kind not null, album_recording_id uuid, lesson_id uuid, created_at timestamp with time zone not null);
--;;
create table learning.item_progress (id uuid not null, user_id uuid not null, item_kind learning.playlist_item_kind not null, album_recording_id uuid, lesson_id uuid, state learning.progress_state not null, started_at timestamp with time zone, finished_at timestamp with time zone, created_at timestamp with time zone not null, updated_at timestamp with time zone not null);
--;;
create table learning.lesson_localizations (lesson_id uuid not null, locale text not null, title text not null, description text, created_at timestamp with time zone not null, updated_at timestamp with time zone not null);
--;;
create table learning.lesson_set_localizations (lesson_set_id uuid not null, locale text not null, title text not null, description text, created_at timestamp with time zone not null, updated_at timestamp with time zone not null);
--;;
create table learning.lesson_sets (id uuid not null, owner_creator_account_id uuid, cantor_id uuid not null, season_id uuid, hymn_id uuid not null, cover_asset_id uuid, submission_id uuid, title text not null, description text, publication_status media.publication_status not null, metadata jsonb not null, created_by uuid, updated_by uuid, created_at timestamp with time zone not null, updated_at timestamp with time zone not null, release_timing_mode text not null, scheduled_release_at timestamp with time zone, original_release_date date);
--;;
create table learning.lessons (id uuid not null, lesson_set_id uuid not null, media_asset_id uuid not null, media_type learning.lesson_media_type not null, title text not null, description text, duration_ms bigint, sort_order integer not null, publication_status media.publication_status not null, metadata jsonb not null, created_by uuid, updated_by uuid, created_at timestamp with time zone not null, updated_at timestamp with time zone not null, audio_asset_id uuid);
--;;
create table learning.lyric_edit_drafts (item_kind learning.playlist_item_kind not null, album_recording_id uuid, lesson_id uuid, locale text not null, sync_precision music.lyric_sync_precision not null, description text, lines jsonb not null, created_by uuid, updated_by uuid, created_at timestamp with time zone not null, updated_at timestamp with time zone not null, id uuid not null);
--;;
create table learning.lyric_lines (id uuid not null, lyric_set_id uuid not null, sequence integer not null, start_ms bigint, end_ms bigint, text text not null, created_at timestamp with time zone not null, updated_at timestamp with time zone not null);
--;;
create table learning.lyric_sets (id uuid not null, item_kind learning.playlist_item_kind not null, album_recording_id uuid, lesson_id uuid, locale text not null, sync_precision music.lyric_sync_precision not null, description text, publication_status media.publication_status not null, created_by uuid, updated_by uuid, created_at timestamp with time zone not null, updated_at timestamp with time zone not null);
--;;
create table learning.playlist_items (id uuid not null, playlist_id uuid not null, item_kind learning.playlist_item_kind not null, album_recording_id uuid, lesson_id uuid, sort_order integer not null, created_at timestamp with time zone not null);
--;;
create table learning.playlists (id uuid not null, owner_user_id uuid not null, name text not null, description text, visibility learning.playlist_visibility not null, cover_asset_id uuid, created_at timestamp with time zone not null, updated_at timestamp with time zone not null);
--;;
create table learning.recording_localizations (recording_id uuid not null, locale text not null, title text not null, subtitle text, created_at timestamp with time zone not null, updated_at timestamp with time zone not null);
--;;
create table learning.season_localizations (season_id uuid not null, locale text not null, title text not null, description text, created_at timestamp with time zone not null, updated_at timestamp with time zone not null);
--;;
create table learning.seasons (id uuid not null, slug text not null, title text not null, description text, sort_order integer not null, publication_status media.publication_status not null, metadata jsonb not null, created_by uuid, updated_by uuid, created_at timestamp with time zone not null, updated_at timestamp with time zone not null);
--;;
create table media.locales (code text not null, english_name text not null, native_name text not null, text_direction text not null, enabled boolean not null, sort_order integer not null, created_at timestamp with time zone not null, updated_at timestamp with time zone not null);
--;;
create table media.localized_texts (id uuid not null, owner_creator_account_id uuid, entity_type text not null, entity_id uuid not null, field_name text not null, locale text not null, text_value text not null, is_primary boolean not null, publication_status media.publication_status not null, created_by uuid, updated_by uuid, created_at timestamp with time zone not null, updated_at timestamp with time zone not null);
--;;
create table media.media_asset_versions (id uuid not null, media_asset_id uuid not null, version integer not null, provider media.media_provider not null, bucket text not null, path text not null, mime_type text, codec text, duration_ms bigint, file_size_bytes bigint, bitrate integer, sample_rate integer, width integer, height integer, checksum text, processing_status media.processing_status not null, created_by uuid, created_at timestamp with time zone not null);
--;;
create table media.media_assets (id uuid not null, owner_creator_account_id uuid, provider media.media_provider not null, bucket text not null, path text not null, media_type media.media_type not null, mime_type text, codec text, duration_ms bigint, file_size_bytes bigint, bitrate integer, sample_rate integer, width integer, height integer, version integer not null, checksum text, processing_status media.processing_status not null, publication_status media.publication_status not null, metadata jsonb not null, created_by uuid, updated_by uuid, created_at timestamp with time zone not null, updated_at timestamp with time zone not null);
--;;
create table media.media_processing_jobs (id uuid not null, upload_intent_id uuid, media_asset_id uuid, media_asset_version_id uuid, job_type media.processing_job_type not null, status media.processing_job_status not null, attempt_count integer not null, max_attempts integer not null, worker_id text, input_bucket text not null, input_path text not null, output_bucket text not null, output_path text, output_mime_type text, output_size_bytes bigint, output_checksum_sha256 text, probe jsonb not null, error_message text, queued_at timestamp with time zone not null, available_at timestamp with time zone not null, claimed_at timestamp with time zone, started_at timestamp with time zone, finished_at timestamp with time zone, created_at timestamp with time zone not null, updated_at timestamp with time zone not null, heartbeat_at timestamp with time zone, progress real);
--;;
create table media.search_aliases (id uuid not null, owner_creator_account_id uuid, entity_type text not null, entity_id uuid not null, locale text, alias text not null, normalized_alias text, publication_status media.publication_status not null, created_by uuid, updated_by uuid, created_at timestamp with time zone not null, updated_at timestamp with time zone not null);
--;;
create table media.search_documents (id uuid not null, owner_creator_account_id uuid, entity_type text not null, entity_id uuid not null, locale text, kind text not null, title text, subtitle text, body text, alias_text text, normalized_text text, search_vector tsvector, publication_status media.publication_status not null, created_at timestamp with time zone not null, updated_at timestamp with time zone not null, metadata jsonb not null);
--;;
create table media.storage_gc_candidates (bucket text not null, path text not null, first_unused_at timestamp with time zone not null, last_seen_at timestamp with time zone not null, file_size_bytes bigint, last_modified_at timestamp with time zone, reason text not null);
--;;
create table media.submission_events (id uuid not null, submission_id uuid not null, actor_id uuid, action text not null, from_status media.publication_status, to_status media.publication_status, notes text, metadata jsonb not null, created_at timestamp with time zone not null);
--;;
create table media.submission_items (id uuid not null, submission_id uuid not null, upload_intent_id uuid, media_asset_id uuid, media_processing_job_id uuid, title text, sort_order integer not null, required boolean not null, created_at timestamp with time zone not null, updated_at timestamp with time zone not null, role media.submission_item_role not null, music_track_id uuid, localized_titles jsonb not null, audio_only_asset_id uuid, replaces_item_id uuid);
--;;
create table media.submissions (id uuid not null, creator_account_id uuid not null, submission_type media.submission_type not null, title text not null, description text, status media.publication_status not null, submitted_at timestamp with time zone, review_due_at timestamp with time zone, reviewer_id uuid, reviewed_at timestamp with time zone, review_notes text, approved_at timestamp with time zone, published_at timestamp with time zone, rejected_at timestamp with time zone, created_by uuid not null, updated_by uuid, created_at timestamp with time zone not null, updated_at timestamp with time zone not null);
--;;
create table media.upload_intents (id uuid not null, creator_account_id uuid not null, requested_by uuid not null, bucket text not null, path text not null, media_type media.media_type not null, original_filename text not null, content_type text not null, content_length bigint not null, checksum_sha256 text, status media.upload_intent_status not null, upload_expires_at timestamp with time zone not null, uploaded_size bigint, r2_http_etag text, uploaded_at timestamp with time zone, completed_at timestamp with time zone, failed_at timestamp with time zone, error_message text, created_at timestamp with time zone not null, updated_at timestamp with time zone not null, original_deleted_at timestamp with time zone);
--;;
create table music.artist_follows (user_id uuid not null, artist_id uuid not null, created_at timestamp with time zone not null);
--;;
create table music.artist_localizations (id uuid not null, artist_id uuid not null, locale text not null, display_name text not null, sort_name text, biography text, is_primary boolean not null, publication_status media.publication_status not null, created_by uuid, updated_by uuid, created_at timestamp with time zone not null, updated_at timestamp with time zone not null);
--;;
create table music.artist_memberships (id uuid not null, artist_id uuid not null, creator_account_id uuid not null, role text not null, created_at timestamp with time zone not null, updated_at timestamp with time zone not null);
--;;
create table music.artist_pinned_releases (artist_id uuid not null, release_id uuid not null, sort_order integer not null, created_at timestamp with time zone not null);
--;;
create table music.artist_social_links (id uuid not null, artist_id uuid not null, platform text not null, url text not null, sort_order integer not null, created_at timestamp with time zone not null, updated_at timestamp with time zone not null, label text);
--;;
create table music.artists (id uuid not null, owner_creator_account_id uuid, profile_image_asset_id uuid, display_name text not null, sort_name text, biography text, publication_status media.publication_status not null, metadata jsonb not null, created_by uuid, updated_by uuid, created_at timestamp with time zone not null, updated_at timestamp with time zone not null, is_credit_only boolean generated always as ((owner_creator_account_id IS NULL)) stored);
--;;
create table music.lyric_edit_drafts (track_id uuid not null, locale text not null, description text, lines jsonb not null, created_by uuid, updated_by uuid, created_at timestamp with time zone not null, updated_at timestamp with time zone not null, sync_precision music.lyric_sync_precision not null);
--;;
create table music.lyric_lines (id uuid not null, lyric_set_id uuid not null, sequence integer not null, start_ms bigint, end_ms bigint, text text not null, created_at timestamp with time zone not null, updated_at timestamp with time zone not null);
--;;
create table music.lyric_sets (id uuid not null, track_id uuid not null, locale text not null, kind music.lyric_kind not null, sync_precision music.lyric_sync_precision not null, title text, source text, publication_status media.publication_status not null, metadata jsonb not null, created_by uuid, updated_by uuid, created_at timestamp with time zone not null, updated_at timestamp with time zone not null, description text);
--;;
create table music.lyric_words (id uuid not null, lyric_line_id uuid not null, sequence integer not null, start_ms bigint, end_ms bigint, text text not null, created_at timestamp with time zone not null, updated_at timestamp with time zone not null);
--;;
create table music.play_history (id uuid not null, user_id uuid not null, track_id uuid not null, media_asset_id uuid, played_at timestamp with time zone not null, progress_ms bigint, completed boolean not null, release_id uuid);
--;;
create table music.playlist_tracks (playlist_id uuid not null, track_id uuid not null, sort_order integer not null, added_by uuid, created_at timestamp with time zone not null);
--;;
create table music.playlists (id uuid not null, owner_user_id uuid not null, name text not null, description text, visibility music.playlist_visibility not null, cover_asset_id uuid, created_at timestamp with time zone not null, updated_at timestamp with time zone not null);
--;;
create table music.release_likes (user_id uuid not null, release_id uuid not null, created_at timestamp with time zone not null);
--;;
create table music.release_localizations (id uuid not null, release_id uuid not null, locale text not null, title text not null, subtitle text, description text, is_primary boolean not null, publication_status media.publication_status not null, created_by uuid, updated_by uuid, created_at timestamp with time zone not null, updated_at timestamp with time zone not null);
--;;
create table music.release_tracks (id uuid not null, release_id uuid not null, track_id uuid not null, disc_number integer not null, track_number integer not null, created_at timestamp with time zone not null);
--;;
create table music.releases (id uuid not null, owner_creator_account_id uuid, primary_artist_id uuid, cover_asset_id uuid, release_type music.release_type not null, title text not null, subtitle text, description text, release_date date, publication_status media.publication_status not null, metadata jsonb not null, created_by uuid, updated_by uuid, created_at timestamp with time zone not null, updated_at timestamp with time zone not null, scheduled_release_at timestamp with time zone, original_release_date date, release_timing_mode text not null);
--;;
create table music.track_artists (track_id uuid not null, artist_id uuid not null, role music.track_artist_role not null, sort_order integer not null, created_at timestamp with time zone not null);
--;;
create table music.track_likes (user_id uuid not null, track_id uuid not null, created_at timestamp with time zone not null);
--;;
create table music.track_localizations (id uuid not null, track_id uuid not null, locale text not null, title text not null, subtitle text, is_primary boolean not null, publication_status media.publication_status not null, created_by uuid, updated_by uuid, created_at timestamp with time zone not null, updated_at timestamp with time zone not null);
--;;
create table music.tracks (id uuid not null, owner_creator_account_id uuid, media_asset_id uuid, title text not null, subtitle text, duration_ms bigint, publication_status media.publication_status not null, metadata jsonb not null, created_by uuid, updated_by uuid, created_at timestamp with time zone not null, updated_at timestamp with time zone not null);
--;;
create table private.media_worker_tokens (id uuid not null, name text not null, token_hash text not null, revoked_at timestamp with time zone, created_at timestamp with time zone not null);
--;;
create table private.notification_deliveries (id uuid not null, notification_id uuid, device_id uuid not null, provider text not null, status text not null, attempt_count integer not null, max_attempts integer not null, available_at timestamp with time zone not null, claimed_at timestamp with time zone, provider_ticket_id text, accepted_at timestamp with time zone, receipt_checked_at timestamp with time zone, delivered_at timestamp with time zone, last_error text, created_at timestamp with time zone not null, updated_at timestamp with time zone not null, broadcast_id uuid);
--;;
create table public.bible_highlights (id uuid not null, user_id uuid not null, book_key text not null, highlights jsonb not null, highlight_deletions jsonb not null, created_at timestamp with time zone not null, updated_at timestamp with time zone not null);
--;;
create table public.hymn_texts (line_id double precision not null, hymn_key text not null, line_order numeric, english text, coptic text, arabic text, person_type "Person Type", prayer_type "Prayer Type", condition text, item_type "Item Type", inline_hymn_key text, inline_hymn_title_shown boolean, inline_hymn_minimization "Minimization", french text);
--;;
create table public.hymn_titles (hymn_key text not null, title_english text, title_arabic text, category text, toggled boolean, prayer_type "Prayer Type", title_french text);
--;;
create table public.notification_broadcasts (id uuid not null, app_key text not null, category text not null, title text not null, body text not null, deep_link text, payload jsonb not null, created_by uuid not null, recipient_count integer not null, delivery_count integer not null, created_at timestamp with time zone not null);
--;;
create table public.notification_devices (id uuid not null, user_id uuid, app_key text not null, platform text not null, provider text not null, push_token text not null, provider_data jsonb not null, device_name text, app_version text, enabled boolean not null, last_seen_at timestamp with time zone not null, created_at timestamp with time zone not null, updated_at timestamp with time zone not null);
--;;
create table public.notification_preferences (user_id uuid not null, app_key text not null, category text not null, enabled boolean not null, created_at timestamp with time zone not null, updated_at timestamp with time zone not null);
--;;
create table public.notifications (id uuid not null, user_id uuid not null, app_key text not null, category text not null, event_type text not null, title text not null, body text not null, image_url text, deep_link text, payload jsonb not null, created_at timestamp with time zone not null, read_at timestamp with time zone);
--;;
create table public.saint_order (flag_key text not null, sort_order numeric not null, title_english text, notes text);
--;;
create table public.sermon_plans (id uuid not null, user_id uuid not null, document_key text not null, service_date date not null, general_notes text not null, highlights jsonb not null, created_at timestamp with time zone not null, updated_at timestamp with time zone not null, highlight_deletions jsonb not null);
--;;
create table public.spiritual_canon_days (user_id uuid not null, day date not null, marks jsonb not null, created_at timestamp with time zone not null, updated_at timestamp with time zone not null);
--;;
create table public.spiritual_canons (user_id uuid not null, items jsonb not null, item_deletions jsonb not null, created_at timestamp with time zone not null, updated_at timestamp with time zone not null);
--;;
create table public.user_content_preferences (user_id uuid not null, preferences jsonb not null, bookmarks text[] not null, created_at timestamp with time zone not null, updated_at timestamp with time zone not null);
--;;
CREATE OR REPLACE FUNCTION media.normalize_search_text(p_value text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE
 SET search_path TO ''
AS $function$
  select trim(
    regexp_replace(
      regexp_replace(
        translate(
          lower(extensions.unaccent(coalesce(p_value, ''))),
          U&'\0623\0625\0622\0671\0649\0624\0626\0640',
          U&'\0627\0627\0627\0627\064A\0648\064A'
        ),
        U&'[\064B-\065F\0670\06D6-\06ED]',
        '',
        'g'
      ),
      '[^[:alnum:]]+',
      ' ',
      'g'
    )
  );
$function$
;
--;;
CREATE OR REPLACE FUNCTION music.published_artist_social_links(p_artist_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(
    jsonb_agg(
      jsonb_build_object('id', link.id, 'platform', link.platform, 'label', link.label, 'url', link.url)
      order by link.sort_order, link.created_at
    ),
    '[]'::jsonb
  )
  from music.artist_social_links link
  join music.artists artist
    on artist.id = link.artist_id
   and artist.publication_status = 'published'::media.publication_status
  where link.artist_id = p_artist_id;
$function$
;
--;;
CREATE OR REPLACE FUNCTION music.release_display_date(p_original_release_date date, p_scheduled_release_at timestamp with time zone, p_release_date date)
 RETURNS date
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select coalesce(
    p_original_release_date,
    (p_scheduled_release_at at time zone 'UTC')::date,
    p_release_date
  );
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.add_edit_submission_item(p_submission_id uuid, p_upload_intent_id uuid, p_role media.submission_item_role, p_title text, p_sort_order integer, p_localized_titles jsonb DEFAULT '{}'::jsonb, p_music_track_id uuid DEFAULT NULL::uuid, p_replaces_item_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.add_media_submission_event(p_submission_id uuid, p_actor_id uuid, p_action text, p_from_status media.publication_status, p_to_status media.publication_status, p_notes text DEFAULT NULL::text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  insert into media.submission_events (
    submission_id,
    actor_id,
    action,
    from_status,
    to_status,
    notes,
    metadata
  )
  values (
    p_submission_id,
    p_actor_id,
    trim(p_action),
    p_from_status,
    p_to_status,
    nullif(trim(coalesce(p_notes, '')), ''),
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.admin_artist_json(p_artist_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.admin_artist_upload_account(p_artist_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.apply_learning_submission_edits(p_submission_id uuid, p_actor uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.apply_music_submission_replacements(p_submission_id uuid, p_actor uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.attach_completed_submission_jobs(p_submission_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.attach_lesson_audio_asset()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_asset_id uuid;
begin
  if new.media_type='video'::learning.lesson_media_type and new.metadata ? 'submissionItemId' then
    select audio_only_asset_id into v_asset_id from media.submission_items
      where id=(new.metadata->>'submissionItemId')::uuid;
    new.audio_asset_id := v_asset_id;
    if new.publication_status='published'::media.publication_status and v_asset_id is not null then
      update media.media_assets set publication_status='published'::media.publication_status,
        updated_by=coalesce(new.updated_by,new.created_by),updated_at=now() where id=v_asset_id;
    end if;
  end if;
  return new;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.attach_pending_artist_profile_image(p_upload_intent_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  attached_count integer := 0;
  delivery_asset_id uuid;
begin
  if p_upload_intent_id is null then
    return 0;
  end if;

  select job.media_asset_id
  into delivery_asset_id
  from media.media_processing_jobs job
  where job.upload_intent_id = p_upload_intent_id
    and job.job_type = 'image_delivery'::media.processing_job_type
    and job.status = 'completed'::media.processing_job_status
    and job.media_asset_id is not null
  order by job.finished_at desc nulls last
  limit 1;

  if delivery_asset_id is null then
    return 0;
  end if;

  update music.artists artist
  set profile_image_asset_id = delivery_asset_id,
      metadata = artist.metadata - 'pendingProfileImageUploadIntentId',
      updated_at = now()
  where artist.metadata ->> 'pendingProfileImageUploadIntentId' = p_upload_intent_id::text;

  get diagnostics attached_count = row_count;
  return attached_count;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.broadcast_audience(p_category text)
 RETURNS TABLE(device_id uuid, user_id uuid, provider text, platform text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.can_edit_creator_account(account_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select (select private.is_admin()) or exists (
    select 1
    from creator.creator_account_members member
    where member.creator_account_id = account_id
      and member.user_id = (select auth.uid())
      and member.role in (
        'owner'::creator.creator_account_role,
        'manager'::creator.creator_account_role,
        'editor'::creator.creator_account_role,
        'uploader'::creator.creator_account_role
      )
  );
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.can_manage_creator_account(account_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select (select private.is_admin()) or exists (
    select 1
    from creator.creator_account_members member
    where member.creator_account_id = account_id
      and member.user_id = (select auth.uid())
      and member.role in ('owner'::creator.creator_account_role, 'manager'::creator.creator_account_role)
  );
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.can_read_media_owner(account_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select account_id is not null and (
    (select private.is_admin()) or (select private.is_creator_account_member(account_id))
  );
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.cleanup_orphan_music_track(p_track_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if exists (
    select 1 from music.release_tracks release_track
    where release_track.track_id = p_track_id
  ) then
    return false;
  end if;

  delete from music.tracks track
  where track.id = p_track_id;

  return found;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.created_creator_account(account_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from creator.creator_accounts account
    where account.id = account_id
      and account.created_by = (select auth.uid())
  );
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.creator_account_is_mine(p_account_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.creator_release_preview_cover(p_release_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  payload jsonb;
begin
  select jsonb_build_object(
    'assetId', asset.id,
    'bucket', asset.bucket,
    'path', asset.path,
    'version', extract(epoch from asset.updated_at)::bigint
  )
  into payload
  from music.releases release
  join media.submission_items item
    on item.submission_id = nullif(release.metadata ->> 'submissionId', '')::uuid
   and item.role = 'artwork'::media.submission_item_role
  join media.media_assets asset
    on asset.id = item.media_asset_id
   and asset.processing_status = 'completed'::media.processing_status
  where release.id = p_release_id
  order by item.created_at desc, item.id desc
  limit 1;

  if payload is not null then
    return payload;
  end if;

  select jsonb_build_object(
    'assetId', asset.id,
    'bucket', asset.bucket,
    'path', asset.path,
    'version', extract(epoch from asset.updated_at)::bigint
  )
  into payload
  from music.releases release
  join media.media_assets asset on asset.id = release.cover_asset_id
  where release.id = p_release_id;

  return payload;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.delete_music_release_core(p_release_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  track_ids uuid[] := array[]::uuid[];
  current_track_id uuid;
  deleted_tracks integer := 0;
begin
  if not exists (
    select 1 from music.releases release where release.id = p_release_id
  ) then
    raise exception 'Release not found' using errcode = 'P0002';
  end if;

  select coalesce(array_agg(release_track.track_id), array[]::uuid[])
  into track_ids
  from music.release_tracks release_track
  where release_track.release_id = p_release_id;

  delete from music.releases release
  where release.id = p_release_id;

  foreach current_track_id in array track_ids
  loop
    if private.cleanup_orphan_music_track(current_track_id) then
      deleted_tracks := deleted_tracks + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'releaseId', p_release_id,
    'deleted', true,
    'deletedTrackCount', deleted_tracks
  );
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.delete_music_release_track_core(p_release_id uuid, p_track_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  release_record music.releases%rowtype;
  total_tracks integer;
  remaining_tracks integer;
  track_deleted boolean := false;
begin
  select *
  into release_record
  from music.releases release
  where release.id = p_release_id
  for update;

  if not found then
    raise exception 'Release not found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from music.release_tracks release_track
    where release_track.release_id = p_release_id
      and release_track.track_id = p_track_id
  ) then
    raise exception 'Track does not belong to this release' using errcode = 'P0002';
  end if;

  select count(*)::integer
  into total_tracks
  from music.release_tracks release_track
  where release_track.release_id = p_release_id;

  if total_tracks <= 1 then
    raise exception 'A release needs at least one track. Delete the release instead.'
      using errcode = '22023';
  end if;

  delete from music.release_tracks release_track
  where release_track.release_id = p_release_id
    and release_track.track_id = p_track_id;

  track_deleted := private.cleanup_orphan_music_track(p_track_id);
  perform private.renumber_music_release_tracks(p_release_id);

  select count(*)::integer
  into remaining_tracks
  from music.release_tracks release_track
  where release_track.release_id = p_release_id;

  return jsonb_build_object(
    'releaseId', p_release_id,
    'trackId', p_track_id,
    'trackDeleted', track_deleted,
    'remainingTrackCount', remaining_tracks,
    'releaseType', (
      select release.release_type
      from music.releases release
      where release.id = p_release_id
    )
  );
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.drop_superseded_artwork(p_submission_id uuid, p_cover_asset_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.edit_compact_titles(p_titles jsonb)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select coalesce(jsonb_object_agg(entry.key, entry.value), '{}'::jsonb)
  from jsonb_each_text(coalesce(p_titles, '{}'::jsonb)) entry
  where entry.key in ('en', 'ar', 'fr') and nullif(btrim(entry.value), '') is not null;
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.edit_localized_titles(p_value jsonb)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'en', coalesce(btrim(case when jsonb_typeof(p_value) = 'object' then p_value ->> 'en' end), ''),
    'ar', coalesce(btrim(case when jsonb_typeof(p_value) = 'object' then p_value ->> 'ar' end), ''),
    'fr', coalesce(btrim(case when jsonb_typeof(p_value) = 'object' then p_value ->> 'fr' end), '')
  );
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.edit_preferred_title(p_titles jsonb, p_fallback text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select coalesce(
    nullif(btrim(p_titles ->> 'en'), ''),
    nullif(btrim(p_titles ->> 'ar'), ''),
    nullif(btrim(p_titles ->> 'fr'), ''),
    nullif(btrim(p_fallback), '')
  );
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.enforce_release_identity_artist()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  identity_id uuid;
  account_name text;
begin
  if new.owner_creator_account_id is null or new.primary_artist_id is null then
    return new;
  end if;

  select account.identity_artist_id, account.display_name
  into identity_id, account_name
  from creator.creator_accounts account
  where account.id = new.owner_creator_account_id;

  if identity_id is null then
    raise exception 'Creator account % has no artist identity yet', coalesce(account_name, new.owner_creator_account_id::text)
      using errcode = '22023';
  end if;

  if new.primary_artist_id <> identity_id then
    raise exception 'A release can only be published under its own account''s artist identity'
      using errcode = '42501';
  end if;

  return new;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.enforce_release_scheduling_window()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  floor_at timestamptz;
begin
  if new.scheduled_release_at is null then
    return new;
  end if;

  if tg_op = 'UPDATE'
    and old.scheduled_release_at is not distinct from new.scheduled_release_at then
    return new;
  end if;

  floor_at := date_trunc('hour', now()) + interval '48 hours';

  if new.scheduled_release_at < floor_at then
    raise exception 'A release must be scheduled at least 48 hours out (earliest %)',
      to_char(floor_at, 'YYYY-MM-DD HH24:MI') || ' UTC'
      using errcode = '22023';
  end if;

  return new;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.enqueue_notification(p_user_id uuid, p_app_key text, p_category text, p_event_type text, p_title text, p_body text, p_deep_link text DEFAULT NULL::text, p_image_url text DEFAULT NULL::text, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_notification_id uuid;
begin
  if p_user_id is null then return null; end if;

  if exists (
    select 1 from public.notification_preferences pref
    where pref.user_id = p_user_id
      and pref.app_key = p_app_key
      and pref.category = p_category
      and pref.enabled = false
  ) then
    return null;
  end if;

  insert into public.notifications (
    user_id, app_key, category, event_type, title, body,
    deep_link, image_url, payload
  ) values (
    p_user_id, p_app_key, p_category, p_event_type, p_title, p_body,
    p_deep_link, p_image_url, coalesce(p_payload, '{}'::jsonb)
  )
  returning id into v_notification_id;

  insert into private.notification_deliveries (notification_id, device_id, provider)
  select v_notification_id, d.id, d.provider
  from public.notification_devices d
  where d.user_id = p_user_id
    and d.app_key = p_app_key
    and d.enabled = true
    and d.provider in ('expo', 'web_push')
  on conflict (notification_id, device_id) do nothing;

  return v_notification_id;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.fill_media_asset_from_probe(p_asset_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.has_app_role(required_role creator.app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from creator.user_roles user_role
    where user_role.user_id = (select auth.uid())
      and user_role.role = required_role
      and user_role.revoked_at is null
  );
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from creator.user_roles user_role
    where user_role.user_id = (select auth.uid())
      and user_role.role = 'admin'::creator.app_role
      and user_role.revoked_at is null
  );
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.is_creator_account_member(account_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from creator.creator_account_members member
    where member.creator_account_id = account_id
      and member.user_id = (select auth.uid())
  );
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.learning_album_child_is_visible(p_album_id uuid, p_status media.publication_status)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select p_status = 'published' or private.learning_album_is_editable(p_album_id);
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.learning_album_is_editable(p_album_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select private.is_admin()
    or exists (
      select 1
      from learning.albums a
      where a.id = p_album_id
        and (
          (a.owner_creator_account_id is not null and private.can_edit_creator_account(a.owner_creator_account_id))
          or private.learning_cantor_is_editable(a.cantor_id)
        )
    );
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.learning_album_is_visible(p_album_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select exists (
    select 1
    from learning.albums a
    where a.id = p_album_id
      and (a.publication_status = 'published' or private.learning_album_is_editable(a.id))
  );
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.learning_cantor_is_editable(p_cantor_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select private.is_admin()
    or exists (
      select 1
      from learning.cantors c
      where c.id = p_cantor_id
        and c.owner_creator_account_id is not null
        and private.can_edit_creator_account(c.owner_creator_account_id)
    )
    or exists (
      select 1
      from learning.cantor_permissions cp
      where cp.cantor_id = p_cantor_id
        and private.can_edit_creator_account(cp.creator_account_id)
    );
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.learning_cantor_is_mine(p_cantor_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
      select 1 from learning.cantors cantor
      where cantor.id = p_cantor_id and private.creator_account_is_mine(cantor.owner_creator_account_id))
    or exists (
      select 1 from learning.cantor_permissions permission
      where permission.cantor_id = p_cantor_id and private.creator_account_is_mine(permission.creator_account_id));
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.learning_cantor_is_visible(p_cantor_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select exists (
    select 1
    from learning.cantors c
    where c.id = p_cantor_id
      and (c.publication_status = 'published' or private.learning_cantor_is_editable(c.id))
  );
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.learning_collection_is_mine(p_owner_creator_account_id uuid, p_cantor_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select case
    when p_owner_creator_account_id is not null then private.creator_account_is_mine(p_owner_creator_account_id)
    else private.learning_cantor_is_mine(p_cantor_id)
  end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.learning_lesson_child_is_visible(p_lesson_set_id uuid, p_status media.publication_status)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select p_status = 'published' or private.learning_lesson_set_is_editable(p_lesson_set_id);
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.learning_lesson_set_is_editable(p_lesson_set_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select private.is_admin()
    or exists (
      select 1
      from learning.lesson_sets ls
      where ls.id = p_lesson_set_id
        and (
          (ls.owner_creator_account_id is not null and private.can_edit_creator_account(ls.owner_creator_account_id))
          or private.learning_cantor_is_editable(ls.cantor_id)
        )
    );
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.learning_lesson_set_is_visible(p_lesson_set_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select exists (
    select 1
    from learning.lesson_sets ls
    where ls.id = p_lesson_set_id
      and (ls.publication_status = 'published' or private.learning_lesson_set_is_editable(ls.id))
  );
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.learning_lyric_item_is_editable(p_item_kind learning.playlist_item_kind, p_item_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select case p_item_kind
    when 'album_recording' then exists (
      select 1 from learning.album_recordings r
      where r.id = p_item_id and private.learning_album_is_editable(r.album_id)
    )
    else exists (
      select 1 from learning.lessons l
      where l.id = p_item_id and private.learning_lesson_set_is_editable(l.lesson_set_id)
    )
  end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.learning_publication_is_creator_mutable(status media.publication_status)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select status in ('draft', 'uploading', 'ready_to_submit', 'changes_requested', 'rejected');
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.learning_published_or_admin(status media.publication_status)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select status = 'published' or private.is_admin();
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.link_submission_item_music_track(p_item_id uuid, p_track_id uuid, p_creator_account_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not (select private.can_edit_creator_account(p_creator_account_id)) then
    raise exception 'Not authorized for creator account' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from media.submission_items item
    join media.submissions submission on submission.id = item.submission_id
    join music.tracks track on track.id = p_track_id
    where item.id = p_item_id
      and item.role = 'track'::media.submission_item_role
      and submission.creator_account_id = p_creator_account_id
      and track.owner_creator_account_id = p_creator_account_id
  ) then
    raise exception 'Submission item and track must belong to the same editable creator account'
      using errcode = '42501';
  end if;

  update media.submission_items item
  set music_track_id = p_track_id
  where item.id = p_item_id;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.lyric_artwork_json(p_asset_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select jsonb_build_object('bucket', asset.bucket, 'path', asset.path, 'version', extract(epoch from asset.updated_at)::bigint)
  from media.media_assets asset
  where asset.id = p_asset_id;
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.media_asset_is_editable(asset_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from media.media_assets asset
    where asset.id = asset_id
      and (select private.can_edit_creator_account(asset.owner_creator_account_id))
  );
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.media_asset_is_visible(asset_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from media.media_assets asset
    where asset.id = asset_id
      and (
        asset.publication_status = 'published'::media.publication_status
        or (select private.can_read_media_owner(asset.owner_creator_account_id))
      )
  );
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.media_job_skipped_for_silence(p_status media.processing_job_status, p_error text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select p_status = 'cancelled'::media.processing_job_status and coalesce(p_error, '') like 'No audio track%';
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.media_probe_audio_codec(p_probe jsonb)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select s->>'codec_name'
  from jsonb_array_elements(coalesce(p_probe->'output'->'streams', '[]'::jsonb)) s
  where s->>'codec_type' = 'audio'
  limit 1;
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.media_probe_bitrate(p_probe jsonb)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case
    when (p_probe->'output'->'format'->>'bit_rate') ~ '^[0-9]+$'
      then nullif((p_probe->'output'->'format'->>'bit_rate')::bigint, 0)::integer
    else null
  end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.media_probe_duration_ms(p_probe jsonb)
 RETURNS bigint
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case
    when (p_probe->'output'->'format'->>'duration') ~ '^[0-9]+(\.[0-9]+)?$'
      then nullif(round((p_probe->'output'->'format'->>'duration')::numeric * 1000), 0)::bigint
    else null
  end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.media_probe_video(p_probe jsonb)
 RETURNS TABLE(codec text, width integer, height integer)
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
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
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.media_processing_job_is_stale(p_job_type media.processing_job_type, p_claimed_at timestamp with time zone, p_heartbeat_at timestamp with time zone)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select p_claimed_at is not null and case
    when p_heartbeat_at is not null then p_heartbeat_at < now() - interval '5 minutes'
    when p_job_type = 'video_delivery'::media.processing_job_type then p_claimed_at < now() - interval '2 hours'
    else p_claimed_at < now() - interval '15 minutes'
  end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.media_processing_output_path(creator_account_id uuid, upload_intent_id uuid, job_type media.processing_job_type)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case
    when job_type = 'audio_delivery'::media.processing_job_type then
      'processed/' || creator_account_id::text || '/' || upload_intent_id::text || '/v1/audio.m4a'
    when job_type = 'video_delivery'::media.processing_job_type then
      'processed/' || creator_account_id::text || '/' || upload_intent_id::text || '/v1/video.mp4'
    when job_type = 'image_delivery'::media.processing_job_type then
      'processed/' || creator_account_id::text || '/' || upload_intent_id::text || '/v1/cover.jpg'
    else
      'processed/' || creator_account_id::text || '/' || upload_intent_id::text || '/v1/metadata.json'
  end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.music_artist_is_editable(p_artist_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from music.artists artist
    where artist.id = p_artist_id
      and (select private.can_edit_creator_account(artist.owner_creator_account_id))
  );
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.music_artist_is_visible(p_artist_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from music.artists artist
    where artist.id = p_artist_id
      and (
        artist.publication_status = 'published'::media.publication_status
        or (select private.can_read_media_owner(artist.owner_creator_account_id))
      )
  );
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.music_lyric_line_is_mutable(p_lyric_line_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from music.lyric_lines lyric_line
    where lyric_line.id = p_lyric_line_id
      and (select private.music_lyric_set_is_mutable(lyric_line.lyric_set_id))
  );
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.music_lyric_line_is_visible(p_lyric_line_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from music.lyric_lines lyric_line
    where lyric_line.id = p_lyric_line_id
      and (select private.music_lyric_set_is_visible(lyric_line.lyric_set_id))
  );
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.music_lyric_set_is_editable(p_lyric_set_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from music.lyric_sets lyric_set
    join music.tracks track on track.id = lyric_set.track_id
    where lyric_set.id = p_lyric_set_id
      and (select private.can_edit_creator_account(track.owner_creator_account_id))
  );
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.music_lyric_set_is_mutable(p_lyric_set_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from music.lyric_sets lyric_set
    join music.tracks track on track.id = lyric_set.track_id
    where lyric_set.id = p_lyric_set_id
      and (select private.can_edit_creator_account(track.owner_creator_account_id))
      and (select private.music_publication_is_creator_mutable(lyric_set.publication_status))
  );
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.music_lyric_set_is_visible(p_lyric_set_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from music.lyric_sets lyric_set
    join music.tracks track on track.id = lyric_set.track_id
    where lyric_set.id = p_lyric_set_id
      and (
        (
          lyric_set.publication_status = 'published'::media.publication_status
          and track.publication_status = 'published'::media.publication_status
        )
        or (select private.can_read_media_owner(track.owner_creator_account_id))
      )
  );
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.music_playlist_is_editable(p_playlist_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from music.playlists playlist
    where playlist.id = p_playlist_id
      and playlist.owner_user_id = (select auth.uid())
  );
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.music_playlist_is_visible(p_playlist_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from music.playlists playlist
    where playlist.id = p_playlist_id
      and (
        playlist.visibility = 'public'::music.playlist_visibility
        or playlist.owner_user_id = (select auth.uid())
      )
  );
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.music_publication_is_creator_mutable(status media.publication_status)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select status <> 'published'::media.publication_status or (select private.is_admin());
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.music_release_is_editable(p_release_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from music.releases release
    where release.id = p_release_id
      and (select private.can_edit_creator_account(release.owner_creator_account_id))
  );
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.music_release_is_visible(p_release_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from music.releases release
    where release.id = p_release_id
      and (
        release.publication_status = 'published'::media.publication_status
        or (select private.can_read_media_owner(release.owner_creator_account_id))
      )
  );
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.music_submission_has_pending_edits(p_submission_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.music_track_is_editable(p_track_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from music.tracks track
    where track.id = p_track_id
      and (select private.can_edit_creator_account(track.owner_creator_account_id))
  );
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.music_track_is_visible(p_track_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from music.tracks track
    where track.id = p_track_id
      and (
        track.publication_status = 'published'::media.publication_status
        or (select private.can_read_media_owner(track.owner_creator_account_id))
      )
  );
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.normalize_creator_name(p_name text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select regexp_replace(
    regexp_replace(lower(btrim(coalesce(p_name,''))),
      '^(cantor|moallem|mouallem|muallem|mo.allim|المعلم|المرتل)[[:space:]]+', '', 'i'),
    '[[:space:][:punct:]ًٌٍَُِّْـ]+', '', 'g');
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.normalize_search_alias_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.normalized_alias := media.normalize_search_text(new.alias);
  return new;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.notify_processing_failure()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid;
begin
  if new.status::text <> 'failed'
     or (tg_op = 'UPDATE' and old.status::text = 'failed') then
    return new;
  end if;

  for v_user_id in
    select distinct ur.user_id
    from creator.user_roles ur
    where ur.role::text = 'admin' and ur.revoked_at is null
  loop
    perform private.enqueue_notification(
      v_user_id, 'chc_admin', 'processing_failures', 'media_processing_failed',
      'Media processing failed',
      'A media processing job requires attention.',
      '/processing',
      null,
      jsonb_build_object('job_id', new.id)
    );
  end loop;

  for v_user_id in
    select distinct m.user_id
    from media.submission_items si
    join media.submissions s on s.id = si.submission_id
    join creator.creator_account_members m on m.creator_account_id = s.creator_account_id
    where si.media_processing_job_id = new.id
  loop
    perform private.enqueue_notification(
      v_user_id, 'chc_artists', 'processing_errors', 'media_processing_failed',
      'Media processing needs attention',
      'Coptic Vine could not finish processing one of your uploaded files.',
      '/',
      null,
      jsonb_build_object('job_id', new.id)
    );
  end loop;

  return new;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.notify_release_published()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_artist_name text;
  v_user_id uuid;
begin
  if new.publication_status::text <> 'published'
     or (tg_op = 'UPDATE' and old.publication_status::text = 'published') then
    return new;
  end if;

  select a.display_name into v_artist_name
  from music.artists a
  where a.id = new.primary_artist_id;

  v_artist_name := coalesce(v_artist_name, 'Coptic Vine');

  for v_user_id in
    select f.user_id from music.artist_follows f where f.artist_id = new.primary_artist_id
  loop
    perform private.enqueue_notification(
      v_user_id, 'chc', 'followed_artists', 'release_published',
      'New from ' || v_artist_name,
      new.title || ' is now available on Coptic Vine.',
      '/music/release/' || new.id::text,
      null,
      jsonb_build_object('release_id', new.id, 'artist_id', new.primary_artist_id)
    );
  end loop;

  if new.owner_creator_account_id is not null then
    for v_user_id in
      select distinct m.user_id
      from creator.creator_account_members m
      where m.creator_account_id = new.owner_creator_account_id
    loop
      perform private.enqueue_notification(
        v_user_id, 'chc_artists', 'release_updates', 'release_published',
        'Release is live',
        new.title || ' is now available on Coptic Vine.',
        '/release/' || new.id::text,
        null,
        jsonb_build_object('release_id', new.id)
      );
    end loop;
  end if;

  return new;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.notify_submission_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid;
  v_title text;
  v_body text;
begin
  if tg_op = 'UPDATE' and old.status::text = new.status::text then
    return new;
  end if;

  if new.status::text = 'pending_review' then
    for v_user_id in
      select distinct ur.user_id
      from creator.user_roles ur
      where ur.role::text = 'admin'
        and ur.revoked_at is null
    loop
      perform private.enqueue_notification(
        v_user_id, 'chc_admin', 'new_submissions', 'submission_pending_review',
        'New submission',
        new.title || ' is ready for review.',
        '/submission/' || new.id::text,
        null,
        jsonb_build_object('submission_id', new.id, 'submission_type', new.submission_type::text)
      );
    end loop;
  end if;

  -- A published music release is notified by music.releases so creators get
  -- one release-is-live push rather than a duplicate submission + release pair.
  if new.status::text in ('approved','changes_requested','rejected','published')
     and not (
       new.status::text = 'published'
       and new.submission_type::text = 'music_release'
     ) then
    v_title := case new.status::text
      when 'approved' then 'Submission approved'
      when 'changes_requested' then 'Changes requested'
      when 'rejected' then 'Submission not approved'
      when 'published' then 'Submission is live'
    end;

    v_body := case new.status::text
      when 'approved' then new.title || ' has been approved.'
      when 'changes_requested' then 'Coptic Vine requested changes to ' || new.title || '.'
      when 'rejected' then new.title || ' was not approved.'
      when 'published' then new.title || ' is now available on Coptic Vine.'
    end;

    for v_user_id in
      select distinct m.user_id
      from creator.creator_account_members m
      where m.creator_account_id = new.creator_account_id
    loop
      perform private.enqueue_notification(
        v_user_id, 'chc_artists', 'submission_updates',
        'submission_' || new.status::text,
        v_title, v_body,
        '/submission/' || new.id::text,
        null,
        jsonb_build_object(
          'submission_id', new.id,
          'submission_type', new.submission_type::text,
          'status', new.status::text
        )
      );
    end loop;
  end if;

  return new;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.on_music_release_publish_consumer_dependencies()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.publication_status = 'published'::media.publication_status then
    perform private.publish_music_release_consumer_dependencies(
      new.id,
      coalesce(new.updated_by, new.created_by)
    );
  end if;
  return new;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.prepare_music_release_artwork_for_publication()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_submission_id uuid;
  newest_artwork_id uuid;
  old_artwork_id uuid;
begin
  if new.publication_status <> 'published'::media.publication_status then
    return new;
  end if;

  v_submission_id := nullif(new.metadata ->> 'submissionId', '')::uuid;
  old_artwork_id := new.cover_asset_id;

  if v_submission_id is not null then
    select item.media_asset_id
    into newest_artwork_id
    from media.submission_items item
    join media.media_assets asset
      on asset.id = item.media_asset_id
     and asset.processing_status = 'completed'::media.processing_status
    where item.submission_id = v_submission_id
      and item.role = 'artwork'::media.submission_item_role
      and item.media_asset_id is not null
    order by item.created_at desc, item.id desc
    limit 1;

    if newest_artwork_id is not null then
      new.cover_asset_id := newest_artwork_id;
    end if;
  end if;

  if new.cover_asset_id is not null then
    update media.media_assets asset
    set publication_status = 'published'::media.publication_status,
        updated_at = now()
    where asset.id = new.cover_asset_id
      and asset.processing_status = 'completed'::media.processing_status;
  end if;

  if old_artwork_id is not null
     and new.cover_asset_id is distinct from old_artwork_id
     and not exists (
       select 1
       from music.releases other_release
       where other_release.id <> new.id
         and other_release.cover_asset_id = old_artwork_id
     )
     and not exists (
       select 1 from music.artists artist where artist.profile_image_asset_id = old_artwork_id
     )
     and not exists (
       select 1 from learning.cantors cantor where cantor.profile_image_asset_id = old_artwork_id
     ) then
    update media.media_assets asset
    set publication_status = 'archived'::media.publication_status,
        updated_at = now()
    where asset.id = old_artwork_id;
  end if;

  update media.media_assets asset
  set publication_status = 'published'::media.publication_status,
      updated_at = now()
  where asset.id in (
    select artist.profile_image_asset_id
    from music.artists artist
    where artist.profile_image_asset_id is not null
      and (
        artist.id = new.primary_artist_id
        or artist.id in (
          select track_artist.artist_id
          from music.release_tracks release_track
          join music.track_artists track_artist on track_artist.track_id = release_track.track_id
          where release_track.release_id = new.id
        )
      )
  )
    and asset.processing_status = 'completed'::media.processing_status;

  return new;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.publish_due_learning_releases()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare entry record; published_count integer:=0;
begin
  for entry in
    select sub.id,sub.reviewer_id
    from media.submissions sub
    where sub.status='approved'::media.publication_status
      and sub.approved_at is not null
      and private.submission_required_items_ready(sub.id)
      and (
        exists(select 1 from learning.albums a where a.submission_id=sub.id
          and a.release_timing_mode='scheduled' and a.scheduled_release_at <= now())
        or exists(select 1 from learning.lesson_sets ls where ls.submission_id=sub.id
          and ls.release_timing_mode='scheduled' and ls.scheduled_release_at <= now())
      )
    order by sub.approved_at
  loop
    begin
      perform private.publish_learning_submission_internal(entry.id,entry.reviewer_id,'scheduled');
      published_count:=published_count+1;
    exception when others then
      perform private.add_media_submission_event(
        entry.id,entry.reviewer_id,'scheduled_publish_failed',null,null,sqlerrm,'{}'::jsonb);
    end;
  end loop;
  return published_count;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.publish_due_music_releases()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  target record;
  published_count integer := 0;
begin
  for target in
    select
      submission.id as submission_id,
      submission.reviewer_id
    from media.submissions submission
    join music.releases release
      on nullif(release.metadata ->> 'submissionId', '')::uuid = submission.id
    where submission.submission_type = 'music_release'::media.submission_type
      and submission.status in (
        'approved'::media.publication_status,
        'processing'::media.publication_status
      )
      and release.release_timing_mode = 'scheduled'
      and release.scheduled_release_at is not null
      and release.scheduled_release_at <= now()
      and private.submission_required_items_ready(submission.id)
    order by release.scheduled_release_at
  loop
    begin
      perform private.publish_music_submission_internal(
        target.submission_id,
        target.reviewer_id,
        'scheduled'
      );
      published_count := published_count + 1;
    exception when others then
      perform private.add_media_submission_event(
        target.submission_id,
        target.reviewer_id,
        'scheduled_publish_failed',
        null,
        null,
        sqlerrm,
        '{}'::jsonb
      );
    end;
  end loop;

  return published_count;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.publish_learning_submission_internal(p_submission_id uuid, p_actor_id uuid DEFAULT NULL::uuid, p_reason text DEFAULT 'automatic'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.publish_music_release_consumer_dependencies(p_release_id uuid, p_actor_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor_id uuid := p_actor_id;
begin
  update music.artists artist
  set publication_status = 'published'::media.publication_status,
      updated_by = coalesce(actor_id, artist.updated_by),
      updated_at = now()
  where artist.id in (
    select release.primary_artist_id
    from music.releases release
    where release.id = p_release_id
      and release.primary_artist_id is not null
    union
    select track_artist.artist_id
    from music.release_tracks release_track
    join music.track_artists track_artist on track_artist.track_id = release_track.track_id
    where release_track.release_id = p_release_id
  )
    and artist.publication_status <> 'published'::media.publication_status;

  update music.artist_localizations localization
  set publication_status = 'published'::media.publication_status,
      updated_by = coalesce(actor_id, localization.updated_by),
      updated_at = now()
  where localization.artist_id in (
    select release.primary_artist_id
    from music.releases release
    where release.id = p_release_id
      and release.primary_artist_id is not null
    union
    select track_artist.artist_id
    from music.release_tracks release_track
    join music.track_artists track_artist on track_artist.track_id = release_track.track_id
    where release_track.release_id = p_release_id
  )
    and localization.publication_status <> 'published'::media.publication_status;

  update music.tracks track
  set publication_status = 'published'::media.publication_status,
      updated_by = coalesce(actor_id, track.updated_by),
      updated_at = now()
  where track.id in (
    select release_track.track_id
    from music.release_tracks release_track
    where release_track.release_id = p_release_id
  )
    and track.publication_status <> 'published'::media.publication_status;

  update music.track_localizations localization
  set publication_status = 'published'::media.publication_status,
      updated_by = coalesce(actor_id, localization.updated_by),
      updated_at = now()
  where localization.track_id in (
    select release_track.track_id
    from music.release_tracks release_track
    where release_track.release_id = p_release_id
  )
    and localization.publication_status <> 'published'::media.publication_status;

  update music.lyric_sets lyric_set
  set publication_status = 'published'::media.publication_status,
      updated_by = coalesce(actor_id, lyric_set.updated_by),
      updated_at = now()
  where lyric_set.track_id in (
    select release_track.track_id
    from music.release_tracks release_track
    where release_track.release_id = p_release_id
  )
    and lyric_set.publication_status <> 'published'::media.publication_status
    and lyric_set.sync_precision in (
      'line'::music.lyric_sync_precision,
      'word'::music.lyric_sync_precision
    )
    and exists (
      select 1 from music.lyric_lines lyric_line
      where lyric_line.lyric_set_id = lyric_set.id
    )
    and not exists (
      select 1 from music.lyric_lines lyric_line
      where lyric_line.lyric_set_id = lyric_set.id
        and lyric_line.start_ms is null
    )
    and not exists (
      select 1
      from (
        select lyric_line.start_ms,
               lag(lyric_line.start_ms) over (order by lyric_line.sequence) as previous_start_ms
        from music.lyric_lines lyric_line
        where lyric_line.lyric_set_id = lyric_set.id
      ) ordered_line
      where ordered_line.previous_start_ms is not null
        and ordered_line.start_ms < ordered_line.previous_start_ms
    )
    and not exists (
      select 1
      from (
        select lyric_line.end_ms,
               lead(lyric_line.start_ms) over (order by lyric_line.sequence) as next_start_ms
        from music.lyric_lines lyric_line
        where lyric_line.lyric_set_id = lyric_set.id
      ) ordered_line
      where ordered_line.end_ms is not null
        and ordered_line.next_start_ms is not null
        and ordered_line.end_ms > ordered_line.next_start_ms
    );
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.publish_music_submission_internal(p_submission_id uuid, p_actor_id uuid DEFAULT NULL::uuid, p_reason text DEFAULT 'automatic'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.publish_public_profile_image()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.publication_status = 'published'::media.publication_status
     and new.profile_image_asset_id is not null then
    update media.media_assets asset
    set publication_status = 'published'::media.publication_status,
        updated_at = now()
    where asset.id = new.profile_image_asset_id
      and asset.processing_status = 'completed'::media.processing_status;
  end if;
  return new;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.published_media_search_source()
 RETURNS TABLE(owner_creator_account_id uuid, entity_type text, entity_id uuid, locale text, title text, subtitle text, body text, metadata jsonb)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
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
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.queue_artist_profile_image(p_artist_id uuid, p_upload_intent_id uuid, p_actor uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.refresh_unified_search_index()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  -- Catalog writes can arrive concurrently. Serialize whole-index refreshes so
  -- two publishing transactions cannot race while replacing the same rows.
  perform pg_catalog.pg_advisory_xact_lock(1128813384, 12);

  delete from media.search_documents
  where kind = 'unified_catalog';

  insert into media.search_documents (
    owner_creator_account_id,
    entity_type,
    entity_id,
    locale,
    kind,
    title,
    subtitle,
    body,
    alias_text,
    normalized_text,
    search_vector,
    publication_status,
    metadata
  )
  select
    source.owner_creator_account_id,
    source.entity_type,
    source.entity_id,
    source.locale,
    'unified_catalog',
    source.title,
    source.subtitle,
    source.body,
    null,
    media.normalize_search_text(concat_ws(' ', source.title, source.subtitle, source.body)),
    setweight(to_tsvector('simple', media.normalize_search_text(source.title)), 'A')
      || setweight(to_tsvector('simple', media.normalize_search_text(source.subtitle)), 'B')
      || setweight(to_tsvector('simple', media.normalize_search_text(source.body)), 'C'),
    'published'::media.publication_status,
    source.metadata
  from private.published_media_search_source() source;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.refresh_unified_search_index_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform private.refresh_unified_search_index();
  return null;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.renumber_music_release_tracks(p_release_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  -- Move the current numbers out of the way so the unique
  -- (release_id, disc_number, track_number) constraint cannot collide while
  -- compacting the list.
  update music.release_tracks release_track
  set track_number = release_track.track_number + 100000
  where release_track.release_id = p_release_id;

  with ordered as (
    select
      release_track.id,
      row_number() over (
        order by release_track.disc_number, release_track.track_number, release_track.created_at, release_track.id
      )::integer as next_number
    from music.release_tracks release_track
    where release_track.release_id = p_release_id
  )
  update music.release_tracks release_track
  set disc_number = 1,
      track_number = ordered.next_number
  from ordered
  where release_track.id = ordered.id;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.replace_artist_social_links(p_artist_id uuid, p_social_links jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.replace_submission_artwork(p_submission_id uuid, p_upload_intent_id uuid, p_current_cover_asset_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.resolve_creator_selected_artist(p_owner_account_id uuid, p_display_name text, p_artist_id uuid, p_default_identity boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  owned_identity uuid;
  artist_row music.artists%rowtype;
begin
  if auth.uid() is null or not private.can_edit_creator_account(p_owner_account_id) then
    raise exception 'Not authorized for creator account' using errcode='42501';
  end if;
  select ca.identity_artist_id into owned_identity
    from creator.creator_accounts ca where ca.id=p_owner_account_id;
  if p_artist_id is not null then
    select * into artist_row from music.artists where id=p_artist_id
      and (publication_status='published'::media.publication_status
           or is_credit_only or owner_creator_account_id=p_owner_account_id);
    if not found then raise exception 'Selected artist is unavailable' using errcode='22023'; end if;
    return artist_row.id;
  end if;
  if nullif(trim(coalesce(p_display_name,'')),'') is null then
    return case when p_default_identity then owned_identity else null end;
  end if;
  return private.resolve_track_credit_artist(p_owner_account_id,p_display_name,false);
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.resolve_learning_submission_artist(p_creator_account_id uuid, p_artist_id uuid, p_display_name text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  requested_user uuid := auth.uid();
  actual_artist_id uuid;
  legacy_cantor_id uuid;
  chosen_artist music.artists%rowtype;
  clean_name text := nullif(btrim(coalesce(p_display_name,'')),'');
begin
  if requested_user is null
      or not private.can_edit_creator_account(p_creator_account_id) then
    raise exception 'Not authorized to select an artist for this workspace'
      using errcode='42501';
  end if;

  if p_artist_id is not null then
    -- Backwards compatibility with cached older Coptic Vine Artists forms.
    select c.artist_id into actual_artist_id from learning.cantors c
    where c.id=p_artist_id;
    actual_artist_id := coalesce(actual_artist_id,p_artist_id);
    select * into chosen_artist from music.artists a
    where a.id=actual_artist_id
      and (a.publication_status='published'::media.publication_status
           or a.is_credit_only
           or a.owner_creator_account_id=p_creator_account_id);
    if not found then
      raise exception 'The selected artist is unavailable' using errcode='22023';
    end if;
  else
    if clean_name is null then
      raise exception 'Enter an artist name or choose an existing profile'
        using errcode='22023';
    end if;
    select * into chosen_artist from music.artists a
    where private.normalize_creator_name(a.display_name)
      =private.normalize_creator_name(clean_name)
    order by
      (a.publication_status='published'::media.publication_status) desc,
      (a.owner_creator_account_id is not null) desc,
      (a.profile_image_asset_id is not null) desc,a.created_at
    limit 1 for update;
    if not found then
      insert into music.artists(display_name,created_by,updated_by)
      values(clean_name,requested_user,requested_user)
      returning * into chosen_artist;
    end if;
    actual_artist_id := chosen_artist.id;
  end if;

  -- Existing learning content and older app builds retain their legacy IDs.
  select c.id into legacy_cantor_id from learning.cantors c
  where c.artist_id=actual_artist_id limit 1 for update;
  if legacy_cantor_id is null then
    insert into learning.cantors
      (artist_id,owner_creator_account_id,display_name,
       profile_image_asset_id,publication_status,metadata,created_by,updated_by)
    values
      (actual_artist_id,p_creator_account_id,chosen_artist.display_name,
       chosen_artist.profile_image_asset_id,
       case when chosen_artist.publication_status='published'::media.publication_status
                     or chosen_artist.is_credit_only
            then 'published'::media.publication_status
            else 'draft'::media.publication_status end,
       jsonb_build_object('canonicalArtistId',actual_artist_id,'artistBridge',true),
       requested_user,requested_user)
    returning id into legacy_cantor_id;
  else
    update learning.cantors c
      set publication_status=case
            when chosen_artist.publication_status='published'::media.publication_status
                  or chosen_artist.is_credit_only
            then 'published'::media.publication_status
            else c.publication_status end,
          profile_image_asset_id=coalesce(chosen_artist.profile_image_asset_id,c.profile_image_asset_id),
          updated_at=now()
    where c.id=legacy_cantor_id;
  end if;
  return legacy_cantor_id;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.resolve_track_credit_artist(p_owner_account_id uuid, p_name text, p_default_to_identity boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  request_user_id uuid := auth.uid();
  clean_name text := nullif(trim(coalesce(p_name, '')), '');
  identity_id uuid;
  resolved_id uuid;
begin
  if request_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not (select private.can_edit_creator_account(p_owner_account_id)) then
    raise exception 'Not authorized for creator account' using errcode = '42501';
  end if;

  select account.identity_artist_id
  into identity_id
  from creator.creator_accounts account
  where account.id = p_owner_account_id;

  if clean_name is null then
    if p_default_to_identity and identity_id is not null then
      return identity_id;
    end if;
    return null;
  end if;

  select artist.id
  into resolved_id
  from music.artists artist
  where private.normalize_creator_name(artist.display_name) = private.normalize_creator_name(clean_name)
  order by
    (artist.id = identity_id) desc,
    (artist.owner_creator_account_id is not null) desc,
    artist.created_at
  limit 1;

  if resolved_id is not null then
    return resolved_id;
  end if;

  insert into music.artists (
    owner_creator_account_id,
    display_name,
    created_by,
    updated_by
  )
  values (
    null,
    clean_name,
    request_user_id,
    request_user_id
  )
  returning id into resolved_id;

  return resolved_id;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.retire_submission_when_music_release_deleted()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  submission_id uuid;
begin
  submission_id := nullif(old.metadata ->> 'submissionId', '')::uuid;

  if submission_id is not null then
    update media.submissions submission
    set status = 'rejected'::media.publication_status,
        rejected_at = coalesce(submission.rejected_at, now()),
        review_notes = coalesce(
          nullif(submission.review_notes, ''),
          'The linked music release was deleted from the catalog.'
        ),
        updated_at = now()
    where submission.id = submission_id
      and submission.status not in (
        'published'::media.publication_status,
        'rejected'::media.publication_status
      );
  end if;

  return old;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.save_learning_submission_edit(p_submission_id uuid, p_edit jsonb, p_actor uuid, p_is_admin boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.save_music_submission_edit(p_submission_id uuid, p_edit jsonb, p_actor uuid, p_is_admin boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.set_track_credit_names(p_track_id uuid, p_owner_account_id uuid, p_main_artist_name text DEFAULT NULL::text, p_contributors jsonb DEFAULT '[]'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  request_user_id uuid := auth.uid();
  main_id uuid;
  contributor jsonb;
  contributor_name text;
  contributor_role text;
  contributor_id uuid;
  contributor_position integer := 1;
begin
  if request_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not (select private.can_edit_creator_account(p_owner_account_id)) then
    raise exception 'Not authorized for creator account' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from music.tracks track
    where track.id = p_track_id
      and track.owner_creator_account_id = p_owner_account_id
  ) then
    raise exception 'Track not found or not owned by this creator account' using errcode = '42501';
  end if;

  if p_contributors is null or jsonb_typeof(p_contributors) <> 'array' then
    raise exception 'Contributors must be a list' using errcode = '22023';
  end if;

  main_id := private.resolve_track_credit_artist(
    p_owner_account_id,
    p_main_artist_name,
    true
  );

  if main_id is null then
    raise exception 'Main artist is required' using errcode = '22023';
  end if;

  delete from music.track_artists
  where track_id = p_track_id;

  insert into music.track_artists (track_id, artist_id, role, sort_order)
  values (p_track_id, main_id, 'primary'::music.track_artist_role, 0);

  for contributor in
    select value
    from jsonb_array_elements(p_contributors)
  loop
    contributor_name := nullif(trim(coalesce(contributor ->> 'name', '')), '');
    contributor_role := lower(nullif(trim(coalesce(contributor ->> 'role', '')), ''));

    if contributor_name is null then
      raise exception 'Every contributor needs a name' using errcode = '22023';
    end if;

    if contributor_role is null or contributor_role not in (
      'featured', 'composer', 'lyricist', 'arranger', 'producer', 'artwork'
    ) then
      raise exception 'Unsupported contributor role: %', coalesce(contributor_role, '')
        using errcode = '22023';
    end if;

    contributor_id := private.resolve_track_credit_artist(
      p_owner_account_id,
      contributor_name,
      false
    );

    if contributor_id is not null
       and not (contributor_role = 'featured' and contributor_id = main_id) then
      insert into music.track_artists (track_id, artist_id, role, sort_order)
      values (
        p_track_id,
        contributor_id,
        contributor_role::music.track_artist_role,
        contributor_position
      )
      on conflict (track_id, artist_id, role) do update
      set sort_order = least(music.track_artists.sort_order, excluded.sort_order);

      contributor_position := contributor_position + 1;
    end if;
  end loop;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.set_track_credit_refs(p_track_id uuid, p_owner_account_id uuid, p_main_artist_name text, p_main_artist_id uuid, p_contributors jsonb DEFAULT '[]'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  main_id uuid; item jsonb; contributor_id uuid;
  role_name text; name_text text; n integer:=0;
begin
  if auth.uid() is null or not private.can_edit_creator_account(p_owner_account_id) then
    raise exception 'Not authorized for creator account' using errcode='42501';
  end if;
  if not exists(select 1 from music.tracks t where t.id=p_track_id
      and t.owner_creator_account_id=p_owner_account_id) then
    raise exception 'Track not owned by creator' using errcode='42501';
  end if;
  if jsonb_typeof(coalesce(p_contributors,'[]'::jsonb))<>'array' then
    raise exception 'Contributors must be a list' using errcode='22023';
  end if;
  main_id:=private.resolve_creator_selected_artist(
     p_owner_account_id,p_main_artist_name,p_main_artist_id,true);
  if main_id is null then raise exception 'Main artist is required' using errcode='22023'; end if;
  delete from music.track_artists where track_id=p_track_id;
  insert into music.track_artists(track_id,artist_id,role,sort_order)
    values(p_track_id,main_id,'primary'::music.track_artist_role,0);
  for item in select value from jsonb_array_elements(coalesce(p_contributors,'[]'::jsonb))
  loop
    n:=n+1;
    role_name:=lower(nullif(trim(item->>'role'),''));
    name_text:=nullif(trim(item->>'name'),'');
    if role_name not in ('featured','composer','lyricist','arranger','producer','artwork') then
      raise exception 'Unsupported contributor role' using errcode='22023';
    end if;
    if name_text is null and nullif(item->>'artistId','') is null then
      raise exception 'Contributor name required' using errcode='22023';
    end if;
    contributor_id:=private.resolve_creator_selected_artist(
       p_owner_account_id,name_text,nullif(item->>'artistId','')::uuid,false);
    if contributor_id is not null and
       not(role_name='featured' and contributor_id=main_id) then
      insert into music.track_artists(track_id,artist_id,role,sort_order)
        values(p_track_id,contributor_id,role_name::music.track_artist_role,n)
        on conflict(track_id,artist_id,role) do update
           set sort_order=least(music.track_artists.sort_order,excluded.sort_order);
    end if;
  end loop;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.set_track_credits(p_track_id uuid, p_owner_account_id uuid, p_main_artist_id uuid DEFAULT NULL::uuid, p_featured_artist_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  resolved_main uuid;
  featured_id uuid;
  position integer := 1;
begin
  select coalesce(p_main_artist_id, account.identity_artist_id)
  into resolved_main
  from creator.creator_accounts account
  where account.id = p_owner_account_id;

  if resolved_main is null then
    raise exception 'No main artist for this track and the account has no artist identity'
      using errcode = '22023';
  end if;

  if not exists (select 1 from music.artists artist where artist.id = resolved_main) then
    raise exception 'Main artist not found' using errcode = 'P0002';
  end if;

  delete from music.track_artists
  where track_id = p_track_id
    and role in ('primary'::music.track_artist_role, 'featured'::music.track_artist_role);

  insert into music.track_artists (track_id, artist_id, role, sort_order)
  values (p_track_id, resolved_main, 'primary'::music.track_artist_role, 0);

  foreach featured_id in array coalesce(p_featured_artist_ids, array[]::uuid[])
  loop
    -- A featured credit that repeats the main artist is noise, and the same
    -- guest listed twice would violate the primary key.
    if featured_id is not null and featured_id <> resolved_main then
      insert into music.track_artists (track_id, artist_id, role, sort_order)
      values (p_track_id, featured_id, 'featured'::music.track_artist_role, position)
      on conflict (track_id, artist_id, role) do nothing;
      position := position + 1;
    end if;
  end loop;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.settle_submission_processing(p_upload_intent_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.storage_asset_is_referenced(p_asset_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    exists (select 1 from media.submission_items item where item.media_asset_id = p_asset_id)
    or exists (select 1 from music.tracks track where track.media_asset_id = p_asset_id)
    or exists (select 1 from music.releases release where release.cover_asset_id = p_asset_id)
    or exists (select 1 from music.artists artist where artist.profile_image_asset_id = p_asset_id)
    or exists (select 1 from music.playlists playlist where playlist.cover_asset_id = p_asset_id)
    or exists (select 1 from learning.album_recordings recording where recording.media_asset_id = p_asset_id)
    or exists (select 1 from learning.lessons lesson where lesson.media_asset_id = p_asset_id)
    or exists (select 1 from learning.albums album where album.cover_asset_id = p_asset_id)
    or exists (select 1 from learning.lesson_sets lesson_set where lesson_set.cover_asset_id = p_asset_id)
    or exists (select 1 from learning.cantors cantor where cantor.profile_image_asset_id = p_asset_id)
    or exists (select 1 from learning.playlists playlist where playlist.cover_asset_id = p_asset_id)
    or exists (
      select 1
      from media.media_processing_jobs job
      where job.status in (
        'queued'::media.processing_job_status,
        'processing'::media.processing_job_status,
        'failed'::media.processing_job_status
      )
        and (
          job.media_asset_id = p_asset_id
          or exists (
            select 1
            from media.media_asset_versions version
            where version.id = job.media_asset_version_id
              and version.media_asset_id = p_asset_id
          )
        )
    );
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.storage_asset_version_is_referenced(p_version_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from media.media_asset_versions version
    join media.media_assets asset on asset.id = version.media_asset_id
    where version.id = p_version_id
      and (
        (
          version.version = asset.version
          and private.storage_asset_is_referenced(asset.id)
        )
        or exists (
          select 1
          from media.media_processing_jobs job
          where job.media_asset_version_id = version.id
            and job.status in (
              'queued'::media.processing_job_status,
              'processing'::media.processing_job_status,
              'failed'::media.processing_job_status
            )
        )
      )
  );
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.storage_object_is_referenced(p_bucket text, p_path text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    exists (
      select 1
      from media.media_processing_jobs job
      where job.status in (
        'queued'::media.processing_job_status,
        'processing'::media.processing_job_status,
        'failed'::media.processing_job_status
      )
        and (
          (job.input_bucket = p_bucket and job.input_path = p_path)
          or (job.output_bucket = p_bucket and job.output_path = p_path)
        )
    )
    or exists (
      select 1
      from media.upload_intents upload
      where upload.bucket = p_bucket
        and upload.path = p_path
        and upload.original_deleted_at is null
        and private.storage_upload_intent_is_referenced(upload.id)
    )
    or exists (
      select 1
      from media.media_assets asset
      where asset.bucket = p_bucket
        and asset.path = p_path
        and private.storage_asset_is_referenced(asset.id)
    )
    or exists (
      select 1
      from media.media_asset_versions version
      where version.bucket = p_bucket
        and version.path = p_path
        and private.storage_asset_version_is_referenced(version.id)
    );
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.storage_upload_intent_is_referenced(p_upload_intent_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    exists (select 1 from media.submission_items item where item.upload_intent_id = p_upload_intent_id)
    or exists (
      select 1
      from media.media_processing_jobs job
      where job.upload_intent_id = p_upload_intent_id
        and job.status in (
          'queued'::media.processing_job_status,
          'processing'::media.processing_job_status,
          'failed'::media.processing_job_status
        )
    );
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.submission_item_media_ready(p_item_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.submission_item_processing_state(p_item_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select case
    when private.submission_item_media_ready(item.id) then 'completed'
    else coalesce(job.status::text, intent.status::text, 'queued')
  end
  from media.submission_items item
  left join media.media_processing_jobs job on job.id = item.media_processing_job_id
  left join media.upload_intents intent on intent.id = item.upload_intent_id
  where item.id = p_item_id;
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.submission_required_items_ready(p_submission_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists(select 1 from media.submission_items where submission_id=p_submission_id and required)
    and not exists(
      select 1 from media.submission_items item
      left join media.media_assets asset on asset.id=item.media_asset_id and asset.processing_status='completed'::media.processing_status
      left join media.upload_intents intent on intent.id=item.upload_intent_id
      left join media.media_assets audio_asset on audio_asset.id=item.audio_only_asset_id and audio_asset.processing_status='completed'::media.processing_status
      where item.submission_id=p_submission_id and item.required
        and (
          asset.id is null
          or (
            intent.media_type='video'::media.media_type
            and audio_asset.id is null
            and not exists (
              select 1 from media.media_processing_jobs silent
              where silent.upload_intent_id = intent.id
                and silent.job_type = 'audio_delivery'::media.processing_job_type
                and private.media_job_skipped_for_silence(silent.status, silent.error_message)
            )
          )
        )
        and intent.media_type in ('audio'::media.media_type,'image'::media.media_type,'video'::media.media_type)
    );
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.sync_learning_artist_identity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  update learning.cantors c set
    display_name=new.display_name,
    profile_image_asset_id=new.profile_image_asset_id,
    publication_status=case
      when new.publication_status='published'::media.publication_status
           or new.is_credit_only then 'published'::media.publication_status
      else c.publication_status end,
    updated_at=now()
  where c.artist_id=new.id
    and (c.display_name is distinct from new.display_name
      or c.profile_image_asset_id is distinct from new.profile_image_asset_id
      or (new.publication_status='published'::media.publication_status
          and c.publication_status<>'published'::media.publication_status));
  return new;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.sync_music_artist_image_to_learning_cantor()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.profile_image_asset_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    update learning.cantors cantor
    set profile_image_asset_id = new.profile_image_asset_id,
        updated_at = now()
    where lower(trim(cantor.display_name)) = lower(trim(new.display_name))
      and (
        cantor.profile_image_asset_id is null
        or cantor.profile_image_asset_id = old.profile_image_asset_id
      );
  else
    update learning.cantors cantor
    set profile_image_asset_id = new.profile_image_asset_id,
        updated_at = now()
    where lower(trim(cantor.display_name)) = lower(trim(new.display_name))
      and cantor.profile_image_asset_id is null;
  end if;

  return new;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.sync_music_release_type(p_release_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  track_count integer;
  inferred music.release_type;
begin
  if p_release_id is null then
    return;
  end if;

  select count(*)
  into track_count
  from music.release_tracks release_track
  where release_track.release_id = p_release_id;

  -- A release should never finish with zero tracks. Do not rewrite the type
  -- during temporary delete/reinsert phases used by editors.
  if track_count = 0 then
    return;
  end if;

  inferred := case
    when track_count = 1 then 'single'::music.release_type
    when track_count between 2 and 6 then 'ep'::music.release_type
    else 'album'::music.release_type
  end;

  update music.releases
  set release_type = inferred,
      updated_at = case when release_type is distinct from inferred then now() else updated_at end
  where id = p_release_id
    and release_type is distinct from inferred;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.sync_music_release_type_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if tg_op = 'DELETE' then
    perform private.sync_music_release_type(old.release_id);
    return old;
  end if;

  perform private.sync_music_release_type(new.release_id);

  if tg_op = 'UPDATE' and old.release_id is distinct from new.release_id then
    perform private.sync_music_release_type(old.release_id);
  end if;

  return new;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.upload_file_extension(filename text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare
  matches text[];
begin
  matches := regexp_match(filename, '\.([A-Za-z0-9]{1,12})$');

  if matches is null then
    return '';
  end if;

  return '.' || lower(matches[1]);
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.verify_media_worker_token(worker_token text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from private.media_worker_tokens token
    where token.revoked_at is null
      and token.token_hash = encode(extensions.digest(coalesce(worker_token, ''), 'sha256'), 'hex')
  );
$function$
;
--;;
CREATE OR REPLACE FUNCTION private.wake_media_processor()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if exists (select 1 from changed_jobs job where job.status = 'queued'::media.processing_job_status) then
    -- pg_net sends this after the transaction commits, so the Worker sees the job.
    perform net.http_post(
      url := 'https://cv-media-processor.hrmpdd8d6c.workers.dev/wake',
      body := '{}'::jsonb,
      timeout_milliseconds := 5000
    );
  end if;
  return null;
exception when others then
  -- A lost wake-up costs at most a minute; a failed upload would cost more.
  raise warning 'Could not wake the media processor: %', sqlerrm;
  return null;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.add_learning_playlist_item(p_playlist_id uuid, p_item_kind learning.playlist_item_kind, p_album_recording_id uuid DEFAULT NULL::uuid, p_lesson_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_sort integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from learning.playlists p where p.id = p_playlist_id and p.owner_user_id = auth.uid()) then raise exception 'Playlist not found'; end if;

  if p_item_kind = 'album_recording' then
    if p_album_recording_id is null or p_lesson_id is not null then raise exception 'album_recording_id is required for album recordings'; end if;
    if not exists (select 1 from learning.album_recordings r join learning.albums a on a.id = r.album_id where r.id = p_album_recording_id and r.publication_status = 'published' and a.publication_status = 'published') then raise exception 'Published recording not found'; end if;
  else
    if p_lesson_id is null or p_album_recording_id is not null then raise exception 'lesson_id is required for lessons'; end if;
    if not exists (select 1 from learning.lessons l join learning.lesson_sets ls on ls.id = l.lesson_set_id where l.id = p_lesson_id and l.publication_status = 'published' and ls.publication_status = 'published') then raise exception 'Published lesson not found'; end if;
  end if;

  select coalesce(max(pi.sort_order), -1) + 1 into v_sort from learning.playlist_items pi where pi.playlist_id = p_playlist_id;
  insert into learning.playlist_items (playlist_id, item_kind, album_recording_id, lesson_id, sort_order)
  values (p_playlist_id, p_item_kind, p_album_recording_id, p_lesson_id, v_sort);

  return public.get_learning_playlist(p_playlist_id, 'en');
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.add_media_submission_item(p_submission_id uuid, p_upload_intent_id uuid DEFAULT NULL::uuid, p_media_asset_id uuid DEFAULT NULL::uuid, p_title text DEFAULT NULL::text, p_sort_order integer DEFAULT 0, p_required boolean DEFAULT true, p_role media.submission_item_role DEFAULT NULL::media.submission_item_role)
 RETURNS TABLE(item_id uuid, submission_id uuid, upload_intent_id uuid, media_asset_id uuid, media_processing_job_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  request_user_id uuid := auth.uid();
  current_submission media.submissions%rowtype;
  source_intent media.upload_intents%rowtype;
  source_asset media.media_assets%rowtype;
  inserted_item media.submission_items%rowtype;
  previous_status media.publication_status;
  next_status media.publication_status;
  normalized_title text := nullif(trim(coalesce(p_title, '')), '');
  resolved_role media.submission_item_role;
  target_job_type media.processing_job_type;
  target_bucket text;
  queued_job_id uuid;
begin
  if request_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if (p_upload_intent_id is null and p_media_asset_id is null)
    or (p_upload_intent_id is not null and p_media_asset_id is not null) then
    raise exception 'Provide exactly one upload intent or media asset' using errcode = '22023';
  end if;

  select *
  into current_submission
  from media.submissions submission
  where submission.id = p_submission_id
  for update;

  if not found then
    raise exception 'Submission not found' using errcode = 'P0002';
  end if;

  if not (select private.can_edit_creator_account(current_submission.creator_account_id)) then
    raise exception 'Not authorized for submission' using errcode = '42501';
  end if;

  if current_submission.status not in (
    'draft'::media.publication_status,
    'uploading'::media.publication_status,
    'ready_to_submit'::media.publication_status,
    'changes_requested'::media.publication_status
  ) then
    raise exception 'Submission is not editable' using errcode = '22023';
  end if;

  if p_upload_intent_id is not null then
    select *
    into source_intent
    from media.upload_intents intent
    where intent.id = p_upload_intent_id;

    if not found then
      raise exception 'Upload intent not found' using errcode = 'P0002';
    end if;

    if source_intent.creator_account_id <> current_submission.creator_account_id then
      raise exception 'Upload intent belongs to a different creator account' using errcode = '42501';
    end if;

    if source_intent.status <> 'uploaded'::media.upload_intent_status then
      raise exception 'Upload intent must be uploaded before submission' using errcode = '22023';
    end if;

    normalized_title := coalesce(normalized_title, source_intent.original_filename);
  end if;

  if p_media_asset_id is not null then
    select *
    into source_asset
    from media.media_assets asset
    where asset.id = p_media_asset_id;

    if not found then
      raise exception 'Media asset not found' using errcode = 'P0002';
    end if;

    if source_asset.owner_creator_account_id <> current_submission.creator_account_id then
      raise exception 'Media asset belongs to a different creator account' using errcode = '42501';
    end if;

    if source_asset.processing_status <> 'completed'::media.processing_status then
      raise exception 'Media asset is not processing-complete' using errcode = '22023';
    end if;

    normalized_title := coalesce(normalized_title, source_asset.path);
  end if;

  resolved_role := coalesce(
    p_role,
    (case
      when source_intent.id is not null and source_intent.media_type = 'image'::media.media_type then 'artwork'
      when source_asset.id is not null and source_asset.media_type = 'image'::media.media_type then 'artwork'
      when current_submission.submission_type = 'music_release'::media.submission_type then 'track'
      when current_submission.submission_type in (
        'learning_album'::media.submission_type,
        'learning_lesson_set'::media.submission_type
      ) then 'lesson'
      else 'other'
    end)::media.submission_item_role
  );

  insert into media.submission_items (
    submission_id,
    upload_intent_id,
    media_asset_id,
    title,
    sort_order,
    required,
    role
  )
  values (
    current_submission.id,
    p_upload_intent_id,
    p_media_asset_id,
    normalized_title,
    coalesce(p_sort_order, 0),
    coalesce(p_required, true),
    resolved_role
  )
  returning * into inserted_item;

  -- Processing starts as soon as an uploaded file is attached to a creator
  -- submission. This happens before admin review, so admins normally only see
  -- completed media and only need Processing when something goes wrong.
  if source_intent.id is not null
     and source_intent.media_type in (
       'audio'::media.media_type,
       'image'::media.media_type,
       'video'::media.media_type
     ) then
    target_job_type := case source_intent.media_type
      when 'audio'::media.media_type then 'audio_delivery'::media.processing_job_type
      when 'image'::media.media_type then 'image_delivery'::media.processing_job_type
      when 'video'::media.media_type then 'video_delivery'::media.processing_job_type
      else null
    end;

    target_bucket := case
      when target_job_type = 'image_delivery'::media.processing_job_type then 'chc-images'
      when target_job_type = 'video_delivery'::media.processing_job_type then 'chc-learning'
      when current_submission.submission_type = 'music_release'::media.submission_type then 'chc-music'
      else 'chc-learning'
    end;

    select result.job_id
    into queued_job_id
    from public.enqueue_media_processing_job(
      source_intent.id,
      target_job_type,
      target_bucket
    ) result;

    update media.submission_items item
    set media_processing_job_id = queued_job_id
    where item.id = inserted_item.id;

    -- If this upload had already been processed (for example after a retry),
    -- attach the completed asset immediately.
    perform private.attach_completed_submission_jobs(current_submission.id);

    select *
    into inserted_item
    from media.submission_items item
    where item.id = inserted_item.id;
  end if;

  previous_status := current_submission.status;
  next_status := case
    when current_submission.status = 'ready_to_submit'::media.publication_status then current_submission.status
    else 'ready_to_submit'::media.publication_status
  end;

  update media.submissions submission
  set status = next_status,
      updated_by = request_user_id
  where submission.id = current_submission.id;

  perform private.add_media_submission_event(
    current_submission.id,
    request_user_id,
    'item_added',
    previous_status,
    next_status,
    null,
    jsonb_build_object(
      'submissionItemId', inserted_item.id,
      'uploadIntentId', inserted_item.upload_intent_id,
      'mediaAssetId', inserted_item.media_asset_id,
      'processingJobId', inserted_item.media_processing_job_id,
      'role', inserted_item.role
    )
  );

  return query
  select
    inserted_item.id,
    inserted_item.submission_id,
    inserted_item.upload_intent_id,
    inserted_item.media_asset_id,
    inserted_item.media_processing_job_id;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.add_track_to_music_playlist(p_playlist_id uuid, p_track_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  request_user_id uuid := auth.uid();
  next_sort_order integer;
begin
  if request_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not (select private.music_playlist_is_editable(p_playlist_id)) then
    raise exception 'Playlist not found or not editable' using errcode = '42501';
  end if;

  select coalesce(max(sort_order), -1) + 1 into next_sort_order
  from music.playlist_tracks where playlist_id = p_playlist_id;

  insert into music.playlist_tracks (playlist_id, track_id, sort_order, added_by)
  values (p_playlist_id, p_track_id, next_sort_order, request_user_id)
  on conflict (playlist_id, track_id) do nothing;

  update music.playlists set updated_at = now() where id = p_playlist_id;
  return true;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.admin_delete_catalog_item(p_kind text, p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  request_user_id uuid := auth.uid();
  normalized_kind text := lower(trim(coalesce(p_kind, '')));
  submission_id uuid;
  title text;
  result jsonb;
begin
  if request_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not (select private.is_admin()) then
    raise exception 'Admin role required' using errcode = '42501';
  end if;

  if normalized_kind = 'music_release' then
    select nullif(release.metadata ->> 'submissionId', '')::uuid, release.title
    into submission_id, title
    from music.releases release
    where release.id = p_id;

    if not found then raise exception 'Music release not found' using errcode = 'P0002'; end if;
    result := private.delete_music_release_core(p_id);

  elsif normalized_kind = 'learning_album' then
    select album.submission_id, album.title
    into submission_id, title
    from learning.albums album
    where album.id = p_id;

    if not found then raise exception 'Learning album not found' using errcode = 'P0002'; end if;

    delete from learning.albums album where album.id = p_id;
    result := jsonb_build_object('id', p_id, 'kind', normalized_kind, 'deleted', true);

  elsif normalized_kind = 'learning_lesson_set' then
    select lesson_set.submission_id, lesson_set.title
    into submission_id, title
    from learning.lesson_sets lesson_set
    where lesson_set.id = p_id;

    if not found then raise exception 'Lesson set not found' using errcode = 'P0002'; end if;

    delete from learning.lesson_sets lesson_set where lesson_set.id = p_id;
    result := jsonb_build_object('id', p_id, 'kind', normalized_kind, 'deleted', true);

  else
    raise exception 'Unsupported catalog item type' using errcode = '22023';
  end if;

  if submission_id is not null and exists (
    select 1 from media.submissions submission where submission.id = submission_id
  ) then
    perform private.add_media_submission_event(
      submission_id,
      request_user_id,
      'catalog_item_deleted_by_admin',
      (select submission.status from media.submissions submission where submission.id = submission_id),
      (select submission.status from media.submissions submission where submission.id = submission_id),
      'An admin permanently deleted the linked catalog item.',
      jsonb_build_object('kind', normalized_kind, 'catalogId', p_id, 'title', title)
    );
  end if;

  return result;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.admin_send_notification_broadcast(p_category text, p_title text, p_body text, p_deep_link text DEFAULT NULL::text, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.admin_send_notification_test(p_title text, p_body text, p_deep_link text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.admin_update_music_release_dates(p_release_id uuid, p_scheduled_release_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_original_release_date date DEFAULT NULL::date, p_clear_scheduled_release_at boolean DEFAULT false, p_clear_original_release_date boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  request_user_id uuid := auth.uid();
  release_record music.releases%rowtype;
  submission_id uuid;
  submission_status media.publication_status;
begin
  if request_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not (select private.is_admin()) then
    raise exception 'Admin role required' using errcode = '42501';
  end if;

  select *
  into release_record
  from music.releases release
  where release.id = p_release_id
  for update;

  if not found then
    raise exception 'Release not found' using errcode = 'P0002';
  end if;

  update music.releases release
  set scheduled_release_at = case
        when p_clear_scheduled_release_at then null
        else coalesce(p_scheduled_release_at, release.scheduled_release_at)
      end,
      release_timing_mode = case
        when p_clear_scheduled_release_at then 'asap'
        when p_scheduled_release_at is not null then 'scheduled'
        else release.release_timing_mode
      end,
      original_release_date = case
        when p_clear_original_release_date then null
        else coalesce(p_original_release_date, release.original_release_date)
      end,
      updated_by = request_user_id,
      updated_at = now()
  where release.id = p_release_id
  returning * into release_record;

  submission_id := nullif(release_record.metadata ->> 'submissionId', '')::uuid;

  if submission_id is not null then
    select submission.status
    into submission_status
    from media.submissions submission
    where submission.id = submission_id;

    if submission_status is not null then
      perform private.add_media_submission_event(
        submission_id,
        request_user_id,
        'release_dates_updated_by_admin',
        submission_status,
        submission_status,
        'An admin changed the release date settings.',
        jsonb_build_object(
          'releaseId', p_release_id,
          'releaseTimingMode', release_record.release_timing_mode,
          'scheduledReleaseAt', release_record.scheduled_release_at,
          'originalReleaseDate', release_record.original_release_date
        )
      );
    end if;
  end if;

  return jsonb_build_object(
    'releaseId', release_record.id,
    'releaseTimingMode', release_record.release_timing_mode,
    'scheduledReleaseAt', release_record.scheduled_release_at,
    'originalReleaseDate', release_record.original_release_date,
    'displayDate', music.release_display_date(
      release_record.original_release_date,
      release_record.scheduled_release_at,
      release_record.release_date
    )
  );
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.apply_french_alignment_updates(p_book text, p_updates jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'bible'
AS $function$
declare n integer;
begin
  with u as (
    select (x->>'verse_id')::numeric verse_id, x->>'french' french
    from jsonb_array_elements(p_updates) x
    where coalesce(x->>'french','')<>''
  )
  update bible.verses v set french=u.french
  from u where v.verse_id=u.verse_id and v.book_key=p_book and v.french is null;
  get diagnostics n = row_count;
  return n;
end $function$
;
--;;
CREATE OR REPLACE FUNCTION public.authorize_admin_storage_gc()
 RETURNS TABLE(authorized boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not (select private.is_admin()) then
    raise exception 'Admin role required' using errcode = '42501';
  end if;
  return query select true;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.begin_offline_package_snapshot()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_snapshot uuid := gen_random_uuid();
  v_request bigint;
  r record;
  t record;
  d record;
  v_sql text;
  v_order_clause text;
begin
  if auth.role() <> 'service_role' then raise exception 'service_role required'; end if;
  perform pg_advisory_xact_lock(hashtext('chc-offline-package-publication'));
  update offline_content.publication_requests
     set status='failed', completed_at=now(), error='Publisher did not finish within one hour.'
   where status='processing' and started_at < now() - interval '1 hour';
  perform offline_content.refresh_change_triggers();

  select request_id into v_request from offline_content.publication_requests
   where status = 'queued' order by requested_at for update skip locked limit 1;
  if v_request is null and not exists(select 1 from offline_content.resources where dirty) then
    return jsonb_build_object('snapshotId', null, 'resources', '[]'::jsonb);
  end if;
  if v_request is not null then
    update offline_content.publication_requests set status='processing', started_at=now(), snapshot_id=v_snapshot where request_id=v_request;
  end if;
  insert into offline_content.snapshots(snapshot_id, status) values (v_snapshot, 'staging');

  for r in select * from offline_content.resources where dirty order by resource_key loop
    insert into offline_content.snapshot_resources(snapshot_id, resource_key, version)
      values (v_snapshot, r.resource_key, r.revision::text);
    for t in
      select tablename from pg_catalog.pg_tables
       where schemaname=r.schema_name
         and (r.include_tables is null or tablename=any(r.include_tables))
         and tablename !~* '(backup|archive|history|working|staging|admin|draft|audit)'
       order by tablename
    loop
      v_order_clause := case
        when r.resource_key = 'bible' and t.tablename = 'books'
          then 'source_number nulls last, book_key'
        when r.resource_key = 'bible' and t.tablename = 'verses'
          then 'book_key, chapter_number, verse_number'
        when r.resource_key = 'bible' and t.tablename = 'verse_parts'
          then 'book_key, chapter_number, verse_number, part_label'
        else 'to_jsonb(source_row)::text'
      end;
      v_sql := format(
        'insert into offline_content.snapshot_rows(snapshot_id,resource_key,row_kind,schema_name,object_name,payload)
         select $1,$2,''table'',$3,$4,to_jsonb(source_row) from %I.%I source_row order by %s',
        r.schema_name, t.tablename, v_order_clause
      );
      execute v_sql using v_snapshot, r.resource_key, r.schema_name, t.tablename;
    end loop;

    -- RPCs whose server logic cannot be reduced to a table lookup are
    -- materialized for every packaged calendar date in the same transaction.
    if r.resource_key = 'calendar' then
      for d in select gregorian_date from calendar.coptic_date_conversions order by gregorian_date loop
        insert into offline_content.snapshot_rows(snapshot_id,resource_key,row_kind,schema_name,object_name,args_json,payload)
        values
          (v_snapshot,'calendar','rpc','calendar','get_context_flags',jsonb_build_object('p_date',d.gregorian_date,'p_extra_context','{}'::jsonb),to_jsonb(calendar.get_context_flags(d.gregorian_date,'{}'::jsonb))),
          (v_snapshot,'calendar','rpc','calendar','get_active_flags_for_date',jsonb_build_object('p_gregorian_date',d.gregorian_date),(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from calendar.get_active_flags_for_date(d.gregorian_date) x)),
          (v_snapshot,'calendar','rpc','public','get_readings_for_date',jsonb_build_object('p_date',d.gregorian_date),(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from public.get_readings_for_date(d.gregorian_date) x));
      end loop;
    elsif r.resource_key = 'synaxarium' then
      for d in select gregorian_date from calendar.coptic_date_conversions order by gregorian_date loop
        insert into offline_content.snapshot_rows(snapshot_id,resource_key,row_kind,schema_name,object_name,args_json,payload)
        values (v_snapshot,'synaxarium','rpc','synaxarium','get_day_json',jsonb_build_object('p_date',d.gregorian_date),to_jsonb(synaxarium.get_day_json(d.gregorian_date)));
      end loop;
    end if;
  end loop;
  update offline_content.snapshots set status='ready' where snapshot_id=v_snapshot;
  return jsonb_build_object(
    'snapshotId', v_snapshot,
    'resources', coalesce((select jsonb_agg(jsonb_build_object('id',resource_key,'version',version) order by resource_key)
      from offline_content.snapshot_resources where snapshot_id=v_snapshot),'[]'::jsonb)
  );
exception when others then
  if v_request is not null then update offline_content.publication_requests set status='failed', completed_at=now(), error=sqlerrm where request_id=v_request; end if;
  raise;
end $function$
;
--;;
CREATE OR REPLACE FUNCTION public.claim_companion_media_processing_job(p_worker_token text, p_job_id uuid, p_worker_id text DEFAULT NULL::text)
 RETURNS TABLE(job_id uuid, job_type media.processing_job_type, attempt_count integer, max_attempts integer, output_bucket text, output_path text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
declare
  video_job media.media_processing_jobs%rowtype;
  source_intent media.upload_intents%rowtype;
  companion_id uuid;
begin
  if not private.verify_media_worker_token(p_worker_token) then
    raise exception 'Invalid media worker token' using errcode = '28000';
  end if;

  select * into video_job
  from media.media_processing_jobs job
  where job.id = p_job_id
    and job.job_type = 'video_delivery'::media.processing_job_type
    and job.status = 'processing'::media.processing_job_status;
  if not found then
    return;
  end if;

  select * into source_intent from media.upload_intents intent where intent.id = video_job.upload_intent_id;
  if not found or source_intent.media_type <> 'video'::media.media_type then
    return;
  end if;

  insert into media.media_processing_jobs(
    upload_intent_id, job_type, status, input_bucket, input_path, output_bucket, output_path
  ) values (
    source_intent.id,
    'audio_delivery'::media.processing_job_type,
    'queued'::media.processing_job_status,
    video_job.input_bucket,
    video_job.input_path,
    video_job.output_bucket,
    private.media_processing_output_path(source_intent.creator_account_id, source_intent.id, 'audio_delivery'::media.processing_job_type)
  )
  on conflict (upload_intent_id, job_type) do nothing;

  select job.id
  into companion_id
  from media.media_processing_jobs job
  where job.upload_intent_id = source_intent.id
    and job.job_type = 'audio_delivery'::media.processing_job_type
    and (
      job.status in ('queued'::media.processing_job_status, 'failed'::media.processing_job_status)
      or (
        job.status = 'processing'::media.processing_job_status
        and private.media_processing_job_is_stale(job.job_type, job.claimed_at, job.heartbeat_at)
      )
    )
  for update skip locked;

  if companion_id is null then
    return;
  end if;

  update media.media_processing_jobs job
  set status = 'processing'::media.processing_job_status,
      attempt_count = case when job.attempt_count >= job.max_attempts then 1 else job.attempt_count + 1 end,
      worker_id = nullif(trim(coalesce(p_worker_id, '')), ''),
      claimed_at = now(),
      heartbeat_at = now(),
      progress = 0,
      started_at = coalesce(job.started_at, now()),
      finished_at = null,
      error_message = null,
      updated_at = now()
  where job.id = companion_id
  returning job.id, job.job_type, job.attempt_count, job.max_attempts, job.output_bucket, job.output_path
  into job_id, job_type, attempt_count, max_attempts, output_bucket, output_path;

  return next;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.claim_media_original_deletion(p_worker_token text, p_upload_intent_id uuid)
 RETURNS TABLE(bucket text, path text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
declare
  intent_record media.upload_intents%rowtype;
begin
  if not private.verify_media_worker_token(p_worker_token) then
    raise exception 'Invalid media worker token' using errcode = '28000';
  end if;

  select * into intent_record
  from media.upload_intents intent
  where intent.id = p_upload_intent_id
  for update;

  if not found
    or intent_record.media_type <> 'video'::media.media_type
    or intent_record.status <> 'uploaded'::media.upload_intent_status
    or intent_record.original_deleted_at is not null then
    return;
  end if;

  if not exists (
    select 1 from media.media_processing_jobs job
    where job.upload_intent_id = intent_record.id
      and job.job_type = 'video_delivery'::media.processing_job_type
      and job.status = 'completed'::media.processing_job_status
      and job.media_asset_id is not null
  ) then
    return;
  end if;

  if not exists (
    select 1 from media.media_processing_jobs job
    where job.upload_intent_id = intent_record.id
      and job.job_type = 'audio_delivery'::media.processing_job_type
      and (
        (job.status = 'completed'::media.processing_job_status and job.media_asset_id is not null)
        or private.media_job_skipped_for_silence(job.status, job.error_message)
      )
  ) then
    return;
  end if;

  if exists (
    select 1 from media.media_processing_jobs job
    where job.upload_intent_id = intent_record.id
      and job.status in (
        'queued'::media.processing_job_status,
        'processing'::media.processing_job_status,
        'failed'::media.processing_job_status
      )
  ) then
    return;
  end if;

  update media.upload_intents intent
  set original_deleted_at = now(),
      updated_at = now()
  where intent.id = intent_record.id;

  return query select intent_record.bucket, intent_record.path;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.claim_media_processing_job(p_worker_token text, p_worker_id text DEFAULT NULL::text)
 RETURNS TABLE(job_id uuid, upload_intent_id uuid, job_type media.processing_job_type, media_type media.media_type, source_content_type text, attempt_count integer, max_attempts integer, input_bucket text, input_path text, output_bucket text, output_path text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  selected_job_id uuid;
  dead_job record;
  affected_submission_id uuid;
begin
  if not private.verify_media_worker_token(p_worker_token) then
    raise exception 'Invalid media worker token' using errcode = '28000';
  end if;

  -- A worker that stopped mid-job (crash, out of memory, redeploy) leaves its
  -- job `processing`. Requeue it while it has attempts left...
  update media.media_processing_jobs job
  set status = 'queued'::media.processing_job_status,
      worker_id = null,
      claimed_at = null,
      heartbeat_at = null,
      progress = null,
      available_at = now(),
      error_message = 'Recovered after media worker stopped before completing the job',
      updated_at = now()
  where job.status = 'processing'::media.processing_job_status
    and job.attempt_count < job.max_attempts
    and private.media_processing_job_is_stale(job.job_type, job.claimed_at, job.heartbeat_at);

  -- ...and fail it, visibly, when that was its last attempt.
  for dead_job in
    update media.media_processing_jobs job
    set status = 'failed'::media.processing_job_status,
        worker_id = null,
        heartbeat_at = null,
        finished_at = now(),
        error_message = 'The media worker stopped during the final processing attempt',
        updated_at = now()
    where job.status = 'processing'::media.processing_job_status
      and job.attempt_count >= job.max_attempts
      and private.media_processing_job_is_stale(job.job_type, job.claimed_at, job.heartbeat_at)
    returning job.id, job.upload_intent_id, job.job_type, job.attempt_count, job.max_attempts, job.error_message
  loop
    for affected_submission_id in
      select distinct item.submission_id
      from media.submission_items item
      where item.upload_intent_id = dead_job.upload_intent_id
    loop
      perform private.add_media_submission_event(
        affected_submission_id,
        null,
        'processing_failed',
        null,
        null,
        dead_job.error_message,
        jsonb_build_object(
          'processingJobId', dead_job.id,
          'jobType', dead_job.job_type,
          'uploadIntentId', dead_job.upload_intent_id,
          'attemptCount', dead_job.attempt_count,
          'maxAttempts', dead_job.max_attempts
        )
      );
    end loop;
  end loop;

  select job.id
  into selected_job_id
  from media.media_processing_jobs job
  where job.status = 'queued'::media.processing_job_status
    and job.available_at <= now()
    and job.attempt_count < job.max_attempts
    -- A video's audio-only copy is made in the same pass as the video. Claim
    -- it on its own only once its video job has finished one way or another.
    and not (
      job.job_type = 'audio_delivery'::media.processing_job_type
      and exists (
        select 1
        from media.media_processing_jobs video
        where video.upload_intent_id = job.upload_intent_id
          and video.job_type = 'video_delivery'::media.processing_job_type
          and video.status in ('queued'::media.processing_job_status, 'processing'::media.processing_job_status)
      )
    )
  order by job.available_at, job.created_at
  for update skip locked
  limit 1;

  if selected_job_id is null then
    return;
  end if;

  update media.media_processing_jobs job
  set status = 'processing'::media.processing_job_status,
      attempt_count = job.attempt_count + 1,
      worker_id = nullif(trim(coalesce(p_worker_id, '')), ''),
      claimed_at = now(),
      heartbeat_at = null,
      progress = 0,
      started_at = coalesce(job.started_at, now()),
      error_message = null
  where job.id = selected_job_id
  returning
    job.id,
    job.upload_intent_id,
    job.job_type,
    job.attempt_count,
    job.max_attempts,
    job.input_bucket,
    job.input_path,
    job.output_bucket,
    job.output_path
  into
    job_id,
    upload_intent_id,
    job_type,
    attempt_count,
    max_attempts,
    input_bucket,
    input_path,
    output_bucket,
    output_path;

  select intent.media_type, intent.content_type
  into media_type, source_content_type
  from media.upload_intents intent
  where intent.id = upload_intent_id;

  return next;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.claim_notification_deliveries(p_limit integer DEFAULT 100)
 RETURNS TABLE(delivery_id uuid, notification_id uuid, device_id uuid, push_token text, title text, body text, image_url text, deep_link text, payload jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.claim_notification_receipts(p_limit integer DEFAULT 1000)
 RETURNS TABLE(delivery_id uuid, provider_ticket_id text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  return query
  with picked as (
    select d.id
    from private.notification_deliveries d
    where d.provider = 'expo'
      and d.status = 'accepted'
      and d.provider_ticket_id is not null
      and d.accepted_at <= now() - interval '15 minutes'
      and (d.receipt_checked_at is null or d.receipt_checked_at <= now() - interval '5 minutes')
    order by d.accepted_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 1000), 1000))
  )
  update private.notification_deliveries d
  set receipt_checked_at = now(),
      updated_at = now()
  from picked p
  where d.id = p.id
  returning d.id, d.provider_ticket_id;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.claim_web_push_deliveries(p_limit integer DEFAULT 100)
 RETURNS TABLE(delivery_id uuid, notification_id uuid, device_id uuid, subscription jsonb, title text, body text, image_url text, deep_link text, payload jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.clear_music_playlist_cover(p_playlist_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  request_user_id uuid := auth.uid();
  previous_cover_asset_id uuid;
begin
  if request_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select playlist.cover_asset_id
  into previous_cover_asset_id
  from music.playlists playlist
  where playlist.id = p_playlist_id
    and playlist.owner_user_id = request_user_id;

  if not found then
    raise exception 'Playlist not found or not editable' using errcode = '42501';
  end if;

  update music.playlists
  set cover_asset_id = null,
      updated_at = now()
  where id = p_playlist_id
    and owner_user_id = request_user_id;

  if previous_cover_asset_id is not null then
    update media.media_assets
    set publication_status = 'archived'::media.publication_status,
        updated_by = request_user_id,
        updated_at = now()
    where id = previous_cover_asset_id
      and provider = 'external'::media.media_provider
      and bucket = 'playlist-covers'
      and created_by = request_user_id;
  end if;

  return true;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.complete_media_processing_job(p_worker_token text, p_job_id uuid, p_output_mime_type text, p_output_size_bytes bigint, p_output_checksum_sha256 text, p_probe jsonb DEFAULT '{}'::jsonb)
 RETURNS TABLE(job_id uuid, status media.processing_job_status, media_asset_id uuid, media_asset_version_id uuid, output_bucket text, output_path text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.complete_media_upload_intent(p_upload_intent_id uuid, p_uploaded_size bigint, p_r2_http_etag text)
 RETURNS TABLE(upload_intent_id uuid, status media.upload_intent_status, bucket text, object_path text, uploaded_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  existing_intent media.upload_intents%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select *
  into existing_intent
  from media.upload_intents intent
  where intent.id = p_upload_intent_id
  for update;

  if not found then
    raise exception 'Upload intent not found' using errcode = 'P0002';
  end if;

  if existing_intent.requested_by <> (select auth.uid())
    or not (select private.can_edit_creator_account(existing_intent.creator_account_id)) then
    raise exception 'Not authorized for upload intent' using errcode = '42501';
  end if;

  if existing_intent.status <> 'authorized'::media.upload_intent_status then
    raise exception 'Upload intent is not authorized' using errcode = '22023';
  end if;

  if existing_intent.upload_expires_at <= now() then
    update media.upload_intents
    set status = 'expired'::media.upload_intent_status,
        failed_at = now(),
        error_message = 'Upload intent expired'
    where id = existing_intent.id;

    raise exception 'Upload intent expired' using errcode = '22023';
  end if;

  if p_uploaded_size <> existing_intent.content_length then
    update media.upload_intents
    set status = 'failed'::media.upload_intent_status,
        uploaded_size = p_uploaded_size,
        failed_at = now(),
        error_message = 'Uploaded size did not match authorized content length'
    where id = existing_intent.id;

    raise exception 'Uploaded size mismatch' using errcode = '22023';
  end if;

  update media.upload_intents
  set status = 'uploaded'::media.upload_intent_status,
      uploaded_size = p_uploaded_size,
      r2_http_etag = p_r2_http_etag,
      uploaded_at = now(),
      completed_at = now(),
      error_message = null
  where id = existing_intent.id;

  return query
  select
    intent.id,
    intent.status,
    intent.bucket,
    intent.path,
    intent.uploaded_at
  from media.upload_intents intent
  where intent.id = existing_intent.id;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.complete_notification_deliveries(p_results jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_item jsonb;
  v_count integer := 0;
begin
  if jsonb_typeof(coalesce(p_results, '[]'::jsonb)) <> 'array' then
    raise exception 'results_must_be_array';
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_results, '[]'::jsonb))
  loop
    perform public.complete_notification_delivery(
      (v_item->>'delivery_id')::uuid,
      v_item->>'result',
      nullif(v_item->>'ticket_id', ''),
      nullif(v_item->>'error', ''),
      coalesce((v_item->>'retry_after_seconds')::integer, 60)
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.complete_notification_delivery(p_delivery_id uuid, p_result text, p_ticket_id text DEFAULT NULL::text, p_error text DEFAULT NULL::text, p_retry_after_seconds integer DEFAULT 60)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_device_id uuid;
begin
  select device_id into v_device_id
  from private.notification_deliveries
  where id = p_delivery_id;

  if v_device_id is null then return; end if;

  if p_result = 'accepted' then
    update private.notification_deliveries
    set status = 'accepted',
        provider_ticket_id = p_ticket_id,
        accepted_at = now(),
        last_error = null,
        updated_at = now()
    where id = p_delivery_id;
  elsif p_result = 'delivered' then
    update private.notification_deliveries
    set status = 'delivered',
        delivered_at = now(),
        last_error = null,
        updated_at = now()
    where id = p_delivery_id;
  elsif p_result = 'retry' then
    update private.notification_deliveries
    set status = case when attempt_count >= max_attempts then 'failed' else 'queued' end,
        available_at = now() + make_interval(secs => greatest(10, least(coalesce(p_retry_after_seconds, 60), 3600))),
        claimed_at = null,
        last_error = p_error,
        updated_at = now()
    where id = p_delivery_id;
  elsif p_result = 'disabled' then
    update private.notification_deliveries
    set status = 'disabled',
        last_error = p_error,
        updated_at = now()
    where id = p_delivery_id;
    update public.notification_devices
    set enabled = false, updated_at = now()
    where id = v_device_id;
  else
    update private.notification_deliveries
    set status = 'failed',
        last_error = p_error,
        updated_at = now()
    where id = p_delivery_id;
  end if;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.complete_notification_receipt(p_delivery_id uuid, p_result text, p_error text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_device_id uuid;
begin
  select device_id into v_device_id
  from private.notification_deliveries
  where id = p_delivery_id;

  if v_device_id is null then
    return;
  end if;

  if p_result = 'delivered' then
    update private.notification_deliveries
    set status = 'delivered',
        delivered_at = now(),
        last_error = null,
        updated_at = now()
    where id = p_delivery_id;
  elsif p_result = 'disabled' then
    update private.notification_deliveries
    set status = 'disabled',
        last_error = p_error,
        updated_at = now()
    where id = p_delivery_id;

    update public.notification_devices
    set enabled = false, updated_at = now()
    where id = v_device_id;
  else
    update private.notification_deliveries
    set status = 'failed',
        last_error = p_error,
        updated_at = now()
    where id = p_delivery_id;
  end if;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.complete_notification_receipts(p_results jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_item jsonb;
  v_count integer := 0;
begin
  if jsonb_typeof(coalesce(p_results, '[]'::jsonb)) <> 'array' then
    raise exception 'results_must_be_array';
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_results, '[]'::jsonb))
  loop
    perform public.complete_notification_receipt(
      (v_item->>'delivery_id')::uuid,
      v_item->>'result',
      nullif(v_item->>'error', '')
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.complete_storage_gc_candidate(p_worker_token text, p_bucket text, p_path text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.verify_media_worker_token(p_worker_token) then
    raise exception 'Invalid media worker token' using errcode = '28000';
  end if;

  delete from media.storage_gc_candidates candidate
  where candidate.bucket = p_bucket and candidate.path = p_path;

  return true;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.confirm_admin_creator_artist_claim(p_submission_id uuid, p_existing_artist_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  account_record creator.creator_accounts%rowtype;
  old_artist music.artists%rowtype;
  target_artist music.artists%rowtype;
  sub media.submissions%rowtype;
  actor uuid:=auth.uid();
begin
  if actor is null or not private.is_admin() then
    raise exception 'Admin verification required' using errcode='42501';
  end if;
  select * into sub from media.submissions where id=p_submission_id for update;
  if not found then raise exception 'Submission not found' using errcode='P0002'; end if;
  select * into account_record from creator.creator_accounts
    where id=sub.creator_account_id for update;
  if not found then raise exception 'Creator account not found' using errcode='P0002'; end if;
  select * into old_artist from music.artists
    where id=account_record.identity_artist_id for update;
  select * into target_artist from music.artists
    where id=p_existing_artist_id for update;
  if target_artist.id is null or target_artist.owner_creator_account_id is not null
    or exists(select 1 from creator.creator_accounts ca where ca.identity_artist_id=target_artist.id)
    or private.normalize_creator_name(target_artist.display_name) <>
       private.normalize_creator_name(account_record.display_name)
    or target_artist.id=old_artist.id then
    raise exception 'The existing credit is no longer available for this creator' using errcode='22023';
  end if;
  if old_artist.owner_creator_account_id<>account_record.id
    or old_artist.publication_status='published'::media.publication_status
    or exists(select 1 from music.releases r where
      r.owner_creator_account_id=account_record.id and
      r.publication_status='published'::media.publication_status) then
    raise exception 'Cannot automatically merge a live artist profile; contact Coptic Vine support' using errcode='22023';
  end if;

  update music.artists target set
    owner_creator_account_id=account_record.id,
    is_credit_only=false,
    profile_image_asset_id=coalesce(target.profile_image_asset_id,old_artist.profile_image_asset_id),
    biography=coalesce(nullif(target.biography,''),old_artist.biography),
    updated_at=now(),updated_by=actor
  where target.id=target_artist.id;

  update creator.creator_accounts ca set identity_artist_id=target_artist.id,
    updated_by=actor,updated_at=now() where ca.id=account_record.id;

  update music.releases rel set primary_artist_id=target_artist.id,updated_by=actor
    where rel.owner_creator_account_id=account_record.id and rel.primary_artist_id=old_artist.id;

  insert into music.track_artists(track_id,artist_id,role,sort_order)
  select ta.track_id,target_artist.id,ta.role,ta.sort_order
    from music.track_artists ta where ta.artist_id=old_artist.id
  on conflict(track_id,artist_id,role) do nothing;
  delete from music.track_artists where artist_id=old_artist.id;

  insert into music.artist_localizations
    (artist_id,locale,display_name,sort_name,biography,is_primary,publication_status,created_by,updated_by)
  select target_artist.id,l.locale,l.display_name,l.sort_name,l.biography,l.is_primary,
         l.publication_status,l.created_by,actor
    from music.artist_localizations l where l.artist_id=old_artist.id
  on conflict(artist_id,locale) do nothing;

  insert into music.artist_memberships(artist_id,creator_account_id,role)
  select target_artist.id,m.creator_account_id,m.role
    from music.artist_memberships m where m.artist_id=old_artist.id
  on conflict(artist_id,creator_account_id) do nothing;

  insert into music.artist_follows(user_id,artist_id,created_at)
  select f.user_id,target_artist.id,f.created_at
    from music.artist_follows f where f.artist_id=old_artist.id
  on conflict(user_id,artist_id) do nothing;
  delete from music.artist_follows where artist_id=old_artist.id;

  insert into music.artist_social_links(artist_id,platform,url,sort_order,label)
  select target_artist.id,l.platform,l.url,l.sort_order,l.label
    from music.artist_social_links l where l.artist_id=old_artist.id
  on conflict(artist_id,platform) do nothing;

  insert into music.artist_pinned_releases(artist_id,release_id,sort_order)
  select target_artist.id,p.release_id,p.sort_order
    from music.artist_pinned_releases p where p.artist_id=old_artist.id
  on conflict(artist_id,release_id) do nothing;

  update music.artists a set publication_status='archived'::media.publication_status,
      metadata=coalesce(a.metadata,'{}'::jsonb)||
        jsonb_build_object('mergedInto',target_artist.id,'mergedAt',now(),
          'verifiedByAdmin',true), updated_by=actor
    where a.id=old_artist.id;

  perform private.add_media_submission_event(
    sub.id,actor,'artist_identity_linked',sub.status,sub.status,null,
    jsonb_build_object('oldArtistId',old_artist.id,
      'existingArtistId',target_artist.id,'creatorAccountId',account_record.id));
  return jsonb_build_object('linked',true,'artistId',target_artist.id,
    'previousArtistId',old_artist.id);
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.coptic_replace_digits(txt text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  out text;
  remaining text;
  m text[];
  digit_text text;
  start_pos int;
  prefix text;
BEGIN
  IF txt IS NULL THEN
    RETURN NULL;
  END IF;

  remaining := txt;
  out := '';

  LOOP
    m := regexp_match(remaining, '([0-9]+)');
    EXIT WHEN m IS NULL;

    digit_text := m[1];
    start_pos := regexp_instr(remaining, '[0-9]+');

    IF start_pos IS NULL OR start_pos < 1 THEN
      out := out || remaining;
      EXIT;
    END IF;

    prefix := substring(remaining FROM 1 FOR start_pos - 1);
    out := out || prefix || public.to_coptic_numeral(digit_text::int);

    remaining := substring(remaining FROM start_pos + length(digit_text));
  END LOOP;

  out := out || remaining;
  RETURN out;
END;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.create_creator_artist(p_creator_account_id uuid, p_display_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  request_user_id uuid := auth.uid();
  new_id uuid := gen_random_uuid();
  clean_name text := nullif(trim(coalesce(p_display_name, '')), '');
  existing_id uuid;
begin
  if request_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if clean_name is null then
    raise exception 'Artist name is required' using errcode = '22023';
  end if;

  if not (select private.can_edit_creator_account(p_creator_account_id)) then
    raise exception 'Not authorized for creator account' using errcode = '42501';
  end if;

  -- Reuse an existing artist of the same name rather than creating a duplicate
  -- credit: two "Cantor Tharwat" rows would split his catalogue in half.
  select artist.id into existing_id
  from music.artists artist
  where private.normalize_creator_name(artist.display_name) = private.normalize_creator_name(clean_name)
  order by artist.owner_creator_account_id nulls last, artist.created_at
  limit 1;

  if existing_id is not null then
    return (
      select jsonb_build_object(
        'id', artist.id,
        'title', artist.display_name,
        'subtitle', case when artist.is_credit_only then 'credit only' else 'artist' end
      )
      from music.artists artist
      where artist.id = existing_id
    );
  end if;

  insert into music.artists (id, owner_creator_account_id, display_name, created_by, updated_by)
  values (new_id, null, clean_name, request_user_id, request_user_id);

  return jsonb_build_object('id', new_id, 'title', clean_name, 'subtitle', 'credit only');
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.create_creator_cantor(p_creator_account_id uuid, p_display_name text, p_contributor_type text DEFAULT 'cantor'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  legacy_id uuid;
  linked_artist music.artists%rowtype;
  legacy learning.cantors%rowtype;
begin
  legacy_id := private.resolve_learning_submission_artist(
    p_creator_account_id,null,p_display_name
  );
  select * into legacy from learning.cantors where id=legacy_id;
  select * into linked_artist from music.artists where id=legacy.artist_id;
  return jsonb_build_object(
    'id',legacy.id,'artistId',linked_artist.id,
    'title',linked_artist.display_name,
    'subtitle',legacy.publication_status,
    'kind',case when lower(coalesce(p_contributor_type,''))='chorus'
      then 'chorus' else 'cantor' end
  );
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.create_creator_hymn(p_creator_account_id uuid, p_title text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare clean_title text:=nullif(trim(coalesce(p_title,'')),'');
  found_hymn learning.hymns%rowtype;
begin
  if auth.uid() is null or not private.can_edit_creator_account(p_creator_account_id) then
    raise exception 'Not authorized for creator account' using errcode='42501';
  end if;
  if clean_title is null or char_length(clean_title)>180 then
    raise exception 'Enter a hymn title of at most 180 characters' using errcode='22023';
  end if;
  select * into found_hymn from learning.hymns h
    where lower(trim(h.title))=lower(clean_title)
      and (h.publication_status='published'::media.publication_status
        or h.created_by=auth.uid())
    order by h.publication_status='published'::media.publication_status desc
    limit 1;
  if not found then
    insert into learning.hymns(title,publication_status,metadata,created_by,updated_by)
    values(clean_title,'draft'::media.publication_status,
      jsonb_build_object('creatorAccountId',p_creator_account_id),auth.uid(),auth.uid())
    returning * into found_hymn;
  end if;
  return jsonb_build_object('id',found_hymn.id,'title',found_hymn.title,
    'subtitle',case when found_hymn.publication_status='published'::media.publication_status
      then 'Existing hymn' else 'New hymn awaiting Coptic Vine review' end);
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.create_creator_submission(p_creator_account_id uuid, p_mode text, p_title text, p_description text DEFAULT NULL::text, p_release_type music.release_type DEFAULT NULL::music.release_type, p_artist_id uuid DEFAULT NULL::uuid, p_cantor_id uuid DEFAULT NULL::uuid, p_season_id uuid DEFAULT NULL::uuid, p_hymn_id uuid DEFAULT NULL::uuid, p_localized_titles jsonb DEFAULT '{}'::jsonb, p_items jsonb DEFAULT '[]'::jsonb, p_scheduled_release_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_original_release_date date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  request_user_id uuid := auth.uid();
  clean_title text := nullif(trim(coalesce(p_title, '')), '');
  clean_description text := nullif(trim(coalesce(p_description, '')), '');
  new_submission_id uuid;
  catalog_id uuid := gen_random_uuid();
  submission_kind media.submission_type;
  identity_artist_id uuid;
  artwork_intent_id uuid;
  item jsonb;
  item_index integer := 0;
  track_number integer := 0;
  media_count integer := 0;
  locale_entry record;
  final_status media.publication_status;
  new_item_id uuid;
  new_track_id uuid;
  resolved_schedule timestamptz;
  earliest timestamptz;
  learning_contributor_kind text;
begin
  if request_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not (select private.can_edit_creator_account(p_creator_account_id)) then
    raise exception 'Not authorized for creator account' using errcode = '42501';
  end if;
  if clean_title is null then
    raise exception 'Add a title' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' then
    raise exception 'Items must be a list' using errcode = '22023';
  end if;

  submission_kind := case p_mode
    when 'music' then 'music_release'::media.submission_type
    when 'learning_album' then 'learning_album'::media.submission_type
    when 'learning_lesson_set' then 'learning_lesson_set'::media.submission_type
    else null
  end;
  if submission_kind is null then
    raise exception 'Unknown submission mode: %', p_mode using errcode = '22023';
  end if;

  select count(*) filter (where coalesce(value ->> 'role', 'media') = 'media')
  into media_count
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb));
  if media_count = 0 then
    raise exception 'Add at least one media file' using errcode = '22023';
  end if;
  if (select count(*) from jsonb_array_elements(p_items) where value ->> 'role' = 'artwork') > 1 then
    raise exception 'Only one artwork file can be attached' using errcode = '22023';
  end if;

  select account.identity_artist_id
  into identity_artist_id
  from creator.creator_accounts account
  where account.id = p_creator_account_id;

  if submission_kind = 'music_release' then
    if p_release_type is null then
      raise exception 'Choose a release type' using errcode = '22023';
    end if;

    if identity_artist_id is null then
      raise exception 'This account has no artist identity yet' using errcode = '22023';
    end if;

    -- A release goes out under the account's own identity. An explicit artist
    -- is accepted only when it names that same identity.
    if p_artist_id is not null and p_artist_id <> identity_artist_id then
      raise exception 'A release can only be published under its own account''s artist identity'
        using errcode = '42501';
    end if;

    earliest := public.earliest_release_at();
    resolved_schedule := coalesce(p_scheduled_release_at, earliest);

    if resolved_schedule < earliest then
      raise exception 'Choose a release date at least 48 hours from now (earliest % UTC)',
        to_char(earliest, 'YYYY-MM-DD HH24:MI')
        using errcode = '22023';
    end if;
  else
    select case
      when lower(coalesce(cantor.metadata ->> 'contributorType', 'cantor')) = 'chorus' then 'chorus'
      else 'cantor'
    end
    into learning_contributor_kind
    from learning.cantors cantor
    where cantor.id = p_cantor_id
      and (
        cantor.publication_status = 'published'::media.publication_status
        or private.learning_cantor_is_editable(cantor.id)
      );

    if p_cantor_id is null or learning_contributor_kind is null then
      if submission_kind = 'learning_album' then
        raise exception 'Choose a cantor or chorus from Coptic Vine' using errcode = '22023';
      else
        raise exception 'Choose a cantor from Coptic Vine' using errcode = '22023';
      end if;
    end if;

    if submission_kind = 'learning_lesson_set' and learning_contributor_kind = 'chorus' then
      raise exception 'Lesson sets must be taught by a cantor, not a chorus' using errcode = '22023';
    end if;

    if p_season_id is not null and not exists (
      select 1 from learning.seasons season where season.id = p_season_id
    ) then
      raise exception 'Season not found' using errcode = '22023';
    end if;
    if submission_kind = 'learning_lesson_set' and (p_hymn_id is null or not exists (
      select 1 from learning.hymns hymn where hymn.id = p_hymn_id
    )) then
      raise exception 'Choose a hymn' using errcode = '22023';
    end if;
  end if;

  select (value ->> 'uploadIntentId')::uuid
  into artwork_intent_id
  from jsonb_array_elements(p_items)
  where value ->> 'role' = 'artwork';

  select created.submission_id
  into new_submission_id
  from public.create_media_submission(p_creator_account_id, submission_kind, clean_title, clean_description) created;

  if submission_kind = 'music_release' then
    insert into music.releases (
      id, owner_creator_account_id, primary_artist_id, release_type, title, description,
      scheduled_release_at, original_release_date, metadata, created_by, updated_by
    )
    values (
      catalog_id, p_creator_account_id, identity_artist_id, p_release_type, clean_title, clean_description,
      resolved_schedule, p_original_release_date,
      jsonb_strip_nulls(jsonb_build_object('submissionId', new_submission_id, 'artworkUploadIntentId', artwork_intent_id)),
      request_user_id, request_user_id
    );

    for locale_entry in
      select key as locale, trim(value) as title
      from jsonb_each_text(coalesce(p_localized_titles, '{}'::jsonb))
      where nullif(trim(value), '') is not null
    loop
      insert into music.release_localizations (release_id, locale, title, is_primary, created_by, updated_by)
      values (catalog_id, locale_entry.locale, locale_entry.title, locale_entry.locale = 'en', request_user_id, request_user_id);
    end loop;
  elsif submission_kind = 'learning_album' then
    insert into learning.albums (
      id, owner_creator_account_id, cantor_id, season_id, submission_id, title, description, metadata, updated_by
    )
    values (
      catalog_id, p_creator_account_id, p_cantor_id, p_season_id, new_submission_id, clean_title, clean_description,
      jsonb_strip_nulls(jsonb_build_object('artworkUploadIntentId', artwork_intent_id)),
      request_user_id
    );

    for locale_entry in
      select key as locale, trim(value) as title
      from jsonb_each_text(coalesce(p_localized_titles, '{}'::jsonb))
      where nullif(trim(value), '') is not null
    loop
      insert into learning.album_localizations (album_id, locale, title)
      values (catalog_id, locale_entry.locale, locale_entry.title);
    end loop;
  else
    insert into learning.lesson_sets (
      id, owner_creator_account_id, cantor_id, season_id, hymn_id, submission_id, title, description, metadata, updated_by
    )
    values (
      catalog_id, p_creator_account_id, p_cantor_id, p_season_id, p_hymn_id, new_submission_id, clean_title, clean_description,
      jsonb_strip_nulls(jsonb_build_object('artworkUploadIntentId', artwork_intent_id)),
      request_user_id
    );

    for locale_entry in
      select key as locale, trim(value) as title
      from jsonb_each_text(coalesce(p_localized_titles, '{}'::jsonb))
      where nullif(trim(value), '') is not null
    loop
      insert into learning.lesson_set_localizations (lesson_set_id, locale, title)
      values (catalog_id, locale_entry.locale, locale_entry.title);
    end loop;
  end if;

  for item in
    select value
    from jsonb_array_elements(p_items) with ordinality as entry(value, position)
    order by (value ->> 'role' = 'artwork') desc, position
  loop
    select result.item_id
    into new_item_id
    from public.add_media_submission_item(
      new_submission_id,
      (item ->> 'uploadIntentId')::uuid,
      null,
      nullif(trim(item ->> 'title'), ''),
      item_index,
      true,
      case when item ->> 'role' = 'artwork'
        then 'artwork'::media.submission_item_role
        else null
      end
    ) result;

    -- Every audio item in a music release becomes a track, in submitted order,
    -- carrying its own credits.
    if submission_kind = 'music_release' and coalesce(item ->> 'role', 'media') <> 'artwork' then
      track_number := track_number + 1;

      insert into music.tracks (
        owner_creator_account_id, title, publication_status, created_by, updated_by
      )
      values (
        p_creator_account_id,
        coalesce(nullif(trim(item ->> 'title'), ''), clean_title),
        'draft'::media.publication_status,
        request_user_id,
        request_user_id
      )
      returning id into new_track_id;

      insert into music.release_tracks (release_id, track_id, disc_number, track_number)
      values (catalog_id, new_track_id, 1, track_number);

      perform private.set_track_credits(
        new_track_id,
        p_creator_account_id,
        nullif(item ->> 'mainArtistId', '')::uuid,
        (
          select array_agg(value::uuid)
          from jsonb_array_elements_text(coalesce(item -> 'featuredArtistIds', '[]'::jsonb))
          where nullif(value, '') is not null
        )
      );

      perform private.link_submission_item_music_track(
        new_item_id,
        new_track_id,
        p_creator_account_id
      );
    end if;

    item_index := item_index + 1;
  end loop;

  select submitted.status
  into final_status
  from public.submit_media_submission(new_submission_id) submitted;

  return jsonb_build_object(
    'submissionId', new_submission_id,
    'catalogId', catalog_id,
    'status', final_status,
    'itemCount', item_index,
    'trackCount', track_number,
    'scheduledReleaseAt', resolved_schedule,
    'originalReleaseDate', p_original_release_date
  );
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.create_creator_submission_v2(p_creator_account_id uuid, p_mode text, p_title text, p_description text DEFAULT NULL::text, p_release_type music.release_type DEFAULT NULL::music.release_type, p_music_type text DEFAULT NULL::text, p_recording_type text DEFAULT NULL::text, p_artist_id uuid DEFAULT NULL::uuid, p_cantor_id uuid DEFAULT NULL::uuid, p_season_id uuid DEFAULT NULL::uuid, p_hymn_id uuid DEFAULT NULL::uuid, p_localized_titles jsonb DEFAULT '{}'::jsonb, p_items jsonb DEFAULT '[]'::jsonb, p_scheduled_release_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_original_release_date date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  result_payload jsonb;
  catalog_id uuid;
  item jsonb;
  track_position integer := 0;
  v_track_id uuid;
  locale_entry record;
  music_track_count integer := 0;
  inferred_release_type music.release_type;
  clean_music_type text := nullif(trim(coalesce(p_music_type, '')), '');
  clean_recording_type text := nullif(trim(coalesce(p_recording_type, '')), '');
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not exists (
    select 1
    from jsonb_each_text(coalesce(p_localized_titles, '{}'::jsonb)) localized(locale, title)
    where localized.locale in ('en', 'ar', 'fr')
      and nullif(trim(localized.title), '') is not null
  ) then
    raise exception 'Add a title in English, Arabic, or French' using errcode = '22023';
  end if;

  if p_mode = 'music' then
    select count(*)
    into music_track_count
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) entry(value)
    where coalesce(entry.value ->> 'role', 'media') <> 'artwork';

    if music_track_count = 0 then
      raise exception 'A music release needs at least one track' using errcode = '22023';
    end if;

    inferred_release_type := case
      when music_track_count = 1 then 'single'::music.release_type
      when music_track_count between 2 and 6 then 'ep'::music.release_type
      else 'album'::music.release_type
    end;

    if clean_music_type is null then
      raise exception 'Music type is required' using errcode = '22023';
    end if;

    if clean_recording_type is null then
      raise exception 'Recording type is required' using errcode = '22023';
    end if;
  else
    inferred_release_type := p_release_type;
  end if;

  if p_mode = 'music' and exists (
    select 1
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) entry(value)
    where coalesce(entry.value ->> 'role', 'media') <> 'artwork'
      and nullif(trim(coalesce(entry.value ->> 'title', '')), '') is null
  ) then
    raise exception 'Every track needs a title' using errcode = '22023';
  end if;

  result_payload := public.create_creator_submission(
    p_creator_account_id,
    p_mode,
    p_title,
    p_description,
    inferred_release_type,
    p_artist_id,
    p_cantor_id,
    p_season_id,
    p_hymn_id,
    p_localized_titles,
    p_items,
    p_scheduled_release_at,
    p_original_release_date
  );

  if p_mode <> 'music' then
    return result_payload;
  end if;

  catalog_id := (result_payload ->> 'catalogId')::uuid;

  update music.releases
  set metadata = coalesce(metadata, '{}'::jsonb)
    || jsonb_build_object(
      'musicType', clean_music_type,
      'recordingType', clean_recording_type
    ),
      updated_at = now()
  where id = catalog_id;

  for item in
    select entry.value
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
      with ordinality as entry(value, position)
    where coalesce(entry.value ->> 'role', 'media') <> 'artwork'
    order by entry.position
  loop
    track_position := track_position + 1;

    select release_track.track_id
    into v_track_id
    from music.release_tracks release_track
    where release_track.release_id = catalog_id
      and release_track.disc_number = 1
      and release_track.track_number = track_position;

    if v_track_id is null then
      raise exception 'Could not resolve track % for the new release', track_position;
    end if;

    perform private.set_track_credit_refs(
      v_track_id,
      p_creator_account_id,
      item ->> 'mainArtistName',
      nullif(item ->> 'mainArtistId','')::uuid,
      coalesce(item -> 'contributors', '[]'::jsonb)
    );

    for locale_entry in
      select key as locale, trim(value) as title
      from jsonb_each_text(coalesce(item -> 'localizedTitles', '{}'::jsonb))
      where nullif(trim(value), '') is not null
    loop
      insert into music.track_localizations (
        track_id,
        locale,
        title,
        is_primary,
        publication_status,
        created_by,
        updated_by
      )
      values (
        v_track_id,
        locale_entry.locale,
        locale_entry.title,
        locale_entry.locale = 'en',
        'draft'::media.publication_status,
        auth.uid(),
        auth.uid()
      )
      on conflict (track_id, locale) do update
      set title = excluded.title,
          is_primary = excluded.is_primary,
          updated_by = excluded.updated_by,
          updated_at = now();
    end loop;
  end loop;

  return result_payload;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.create_creator_submission_v3(p_creator_account_id uuid, p_mode text, p_title text, p_description text DEFAULT NULL::text, p_release_type music.release_type DEFAULT NULL::music.release_type, p_music_type text DEFAULT NULL::text, p_recording_type text DEFAULT NULL::text, p_artist_id uuid DEFAULT NULL::uuid, p_cantor_id uuid DEFAULT NULL::uuid, p_season_id uuid DEFAULT NULL::uuid, p_hymn_id uuid DEFAULT NULL::uuid, p_localized_titles jsonb DEFAULT '{}'::jsonb, p_items jsonb DEFAULT '[]'::jsonb, p_release_timing_mode text DEFAULT 'asap'::text, p_scheduled_release_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_original_release_date date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  result_payload jsonb;
  catalog_id uuid;
  resolved_learning_cantor uuid;
  supplied_learning_name text;
  normalized_timing text := lower(trim(coalesce(p_release_timing_mode, 'asap')));
begin
  if p_mode in ('music', 'learning_album', 'learning_lesson_set') then
    if normalized_timing not in ('asap', 'scheduled') then
      raise exception 'Release timing must be asap or scheduled' using errcode = '22023';
    end if;

    if normalized_timing = 'scheduled' and p_scheduled_release_at is null then
      raise exception 'Choose a scheduled release date and time' using errcode = '22023';
    end if;
  else
    normalized_timing := 'asap';
  end if;

  if p_mode <> 'music' and normalized_timing = 'scheduled'
     and p_scheduled_release_at < public.earliest_release_at() then
    raise exception 'Choose a release date at least 48 hours from now' using errcode = '22023';
  end if;

  -- The client always supplies a canonical music.artists ID, not a second
  -- "cantor" identity. Accept old learning.cantors IDs for older app builds.
  -- When no profile is chosen, only then create a reusable new artist credit.
  if p_mode in ('learning_album', 'learning_lesson_set') then
    select nullif(btrim(entry.value ->> 'learningArtistName'), '')
      into supplied_learning_name
    from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) entry(value)
    where coalesce(entry.value->>'role','media') <> 'artwork'
    order by entry.value->>'uploadIntentId'
    limit 1;

    resolved_learning_cantor := private.resolve_learning_submission_artist(
      p_creator_account_id, p_cantor_id, supplied_learning_name
    );
  end if;

  result_payload := public.create_creator_submission_v2(
    p_creator_account_id,
    p_mode,
    p_title,
    p_description,
    p_release_type,
    p_music_type,
    p_recording_type,
    p_artist_id,
    case when p_mode in ('learning_album','learning_lesson_set')
         then resolved_learning_cantor else p_cantor_id end,
    p_season_id,
    p_hymn_id,
    p_localized_titles,
    p_items,
    case when normalized_timing = 'scheduled' then p_scheduled_release_at else null end,
    p_original_release_date
  );

  -- Save localized titles on individual learning submission items so that
  -- processing and scheduled publishing cannot lose the submitted languages.
  -- Match by unique upload intent rather than the display title.
  if p_mode in ('learning_album', 'learning_lesson_set') then
    update media.submission_items submission_item
       set localized_titles = case
             when jsonb_typeof(entry.value -> 'localizedTitles') = 'object'
               then entry.value -> 'localizedTitles'
             else '{}'::jsonb end,
           updated_at = now()
      from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) entry(value)
     where submission_item.submission_id=(result_payload ->> 'submissionId')::uuid
       and submission_item.upload_intent_id=(entry.value ->> 'uploadIntentId')::uuid
       and coalesce(entry.value ->> 'role', 'media') <> 'artwork';
  end if;

  catalog_id := nullif(result_payload ->> 'catalogId', '')::uuid;

  if p_mode = 'music' then
    update music.releases release
    set release_timing_mode = normalized_timing,
        scheduled_release_at = case
          when normalized_timing = 'asap' then null
          else release.scheduled_release_at
        end,
        updated_at = now()
    where release.id = catalog_id;
  elsif p_mode = 'learning_album' then
    update learning.albums album
       set release_timing_mode = normalized_timing,
           scheduled_release_at = case when normalized_timing = 'scheduled' then p_scheduled_release_at else null end,
           original_release_date = p_original_release_date, updated_at = now()
     where album.id = catalog_id;
  elsif p_mode = 'learning_lesson_set' then
    update learning.lesson_sets lesson_set
       set release_timing_mode = normalized_timing,
           scheduled_release_at = case when normalized_timing = 'scheduled' then p_scheduled_release_at else null end,
           original_release_date = p_original_release_date, updated_at = now()
     where lesson_set.id = catalog_id;
  end if;

  return result_payload;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.create_learning_playlist(p_name text, p_description text DEFAULT NULL::text, p_visibility learning.playlist_visibility DEFAULT 'private'::learning.playlist_visibility)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_id uuid := gen_random_uuid();
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if length(trim(coalesce(p_name, ''))) = 0 then raise exception 'Playlist name is required'; end if;
  insert into learning.playlists (id, owner_user_id, name, description, visibility)
  values (v_id, auth.uid(), trim(p_name), nullif(trim(coalesce(p_description, '')), ''), p_visibility);
  return (select jsonb_build_object('id', p.id, 'name', p.name, 'description', p.description, 'visibility', p.visibility) from learning.playlists p where p.id = v_id);
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.create_media_submission(p_creator_account_id uuid, p_submission_type media.submission_type, p_title text, p_description text DEFAULT NULL::text)
 RETURNS TABLE(submission_id uuid, status media.publication_status, review_due_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  request_user_id uuid := auth.uid();
  current_submission media.submissions%rowtype;
begin
  if request_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_creator_account_id is null then
    raise exception 'creator_account_id is required' using errcode = '22023';
  end if;

  if not (select private.can_edit_creator_account(p_creator_account_id)) then
    raise exception 'Not authorized for creator account' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from creator.creator_accounts account
    where account.id = p_creator_account_id
      and account.status = 'active'::creator.creator_account_status
  ) then
    raise exception 'Creator account is not active' using errcode = '22023';
  end if;

  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'title is required' using errcode = '22023';
  end if;

  insert into media.submissions (
    creator_account_id,
    submission_type,
    title,
    description,
    status,
    created_by,
    updated_by
  )
  values (
    p_creator_account_id,
    p_submission_type,
    trim(p_title),
    nullif(trim(coalesce(p_description, '')), ''),
    'draft'::media.publication_status,
    request_user_id,
    request_user_id
  )
  returning * into current_submission;

  perform private.add_media_submission_event(
    current_submission.id,
    request_user_id,
    'created',
    null,
    current_submission.status,
    null,
    jsonb_build_object('submissionType', current_submission.submission_type)
  );

  return query
  select
    current_submission.id,
    current_submission.status,
    current_submission.review_due_at;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.create_media_upload_intent(p_creator_account_id uuid, p_original_filename text, p_content_type text, p_content_length bigint, p_media_type media.media_type DEFAULT 'audio'::media.media_type, p_checksum_sha256 text DEFAULT NULL::text)
 RETURNS TABLE(upload_intent_id uuid, bucket text, object_path text, expires_at timestamp with time zone, content_type text, content_length bigint, media_type media.media_type)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  request_user_id uuid := auth.uid();
  generated_upload_intent_id uuid := gen_random_uuid();
  generated_bucket text := 'chc-submissions';
  generated_path text;
  normalized_content_type text := lower(trim(p_content_type));
  normalized_checksum text := lower(trim(coalesce(p_checksum_sha256, '')));
begin
  if request_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_creator_account_id is null then
    raise exception 'creator_account_id is required' using errcode = '22023';
  end if;

  if not (select private.can_edit_creator_account(p_creator_account_id)) then
    raise exception 'Not authorized for creator account' using errcode = '42501';
  end if;

  if p_original_filename is null or length(trim(p_original_filename)) = 0 then
    raise exception 'original_filename is required' using errcode = '22023';
  end if;

  if normalized_content_type !~ '^(audio|video|image)/[a-z0-9.+-]+$' then
    raise exception 'Unsupported content type' using errcode = '22023';
  end if;

  if p_content_length is null or p_content_length <= 0 or p_content_length > 21474836480 then
    raise exception 'Invalid content length' using errcode = '22023';
  end if;

  if normalized_checksum <> '' and normalized_checksum !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid sha256 checksum' using errcode = '22023';
  end if;

  generated_path :=
    'submissions/' ||
    p_creator_account_id::text ||
    '/' ||
    generated_upload_intent_id::text ||
    '/original' ||
    private.upload_file_extension(p_original_filename);

  insert into media.upload_intents (
    id,
    creator_account_id,
    requested_by,
    bucket,
    path,
    media_type,
    original_filename,
    content_type,
    content_length,
    checksum_sha256,
    status,
    upload_expires_at
  )
  values (
    generated_upload_intent_id,
    p_creator_account_id,
    request_user_id,
    generated_bucket,
    generated_path,
    p_media_type,
    trim(p_original_filename),
    normalized_content_type,
    p_content_length,
    nullif(normalized_checksum, ''),
    'authorized'::media.upload_intent_status,
    now() + interval '24 hours'
  );

  return query
  select
    intent.id,
    intent.bucket,
    intent.path,
    intent.upload_expires_at,
    intent.content_type,
    intent.content_length,
    intent.media_type
  from media.upload_intents intent
  where intent.id = generated_upload_intent_id;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.create_music_playlist(p_name text, p_description text DEFAULT NULL::text, p_visibility music.playlist_visibility DEFAULT 'private'::music.playlist_visibility)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  request_user_id uuid := auth.uid();
  playlist_id uuid := gen_random_uuid();
begin
  if request_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if length(trim(coalesce(p_name, ''))) = 0 then
    raise exception 'Playlist name is required' using errcode = '22023';
  end if;

  insert into music.playlists (id, owner_user_id, name, description, visibility)
  values (playlist_id, request_user_id, trim(p_name), nullif(trim(coalesce(p_description, '')), ''), p_visibility);

  return playlist_id;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.delete_admin_music_release(p_release_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  request_user_id uuid := auth.uid();
  submission_id uuid;
  submission_status media.publication_status;
  result jsonb;
begin
  if request_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not (select private.is_admin()) then
    raise exception 'Admin role required' using errcode = '42501';
  end if;

  select nullif(release.metadata ->> 'submissionId', '')::uuid
  into submission_id
  from music.releases release
  where release.id = p_release_id;

  if not found then
    raise exception 'Release not found' using errcode = 'P0002';
  end if;

  if submission_id is not null then
    select submission.status
    into submission_status
    from media.submissions submission
    where submission.id = submission_id;

    if submission_status is not null then
      perform private.add_media_submission_event(
        submission_id,
        request_user_id,
        'release_deleted_by_admin',
        submission_status,
        submission_status,
        'An admin permanently deleted the release from the Coptic Vine music catalog.',
        jsonb_build_object('releaseId', p_release_id)
      );
    end if;
  end if;

  result := private.delete_music_release_core(p_release_id);
  return result;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.delete_admin_music_release_track(p_release_id uuid, p_track_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  request_user_id uuid := auth.uid();
  submission_id uuid;
  submission_status media.publication_status;
  result jsonb;
begin
  if request_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not (select private.is_admin()) then
    raise exception 'Admin role required' using errcode = '42501';
  end if;

  select nullif(release.metadata ->> 'submissionId', '')::uuid
  into submission_id
  from music.releases release
  where release.id = p_release_id;

  if not found then
    raise exception 'Release not found' using errcode = 'P0002';
  end if;

  result := private.delete_music_release_track_core(p_release_id, p_track_id);

  if submission_id is not null then
    select submission.status
    into submission_status
    from media.submissions submission
    where submission.id = submission_id;

    if submission_status is not null then
      perform private.add_media_submission_event(
        submission_id,
        request_user_id,
        'track_deleted_by_admin',
        submission_status,
        submission_status,
        'An admin permanently deleted a track from the release.',
        jsonb_build_object('releaseId', p_release_id, 'trackId', p_track_id)
      );
    end if;
  end if;

  return result;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.delete_creator_music_release(p_release_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  request_user_id uuid := auth.uid();
  account_id uuid;
  submission_id uuid;
  submission_status media.publication_status;
  result jsonb;
begin
  if request_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select release.owner_creator_account_id,
         nullif(release.metadata ->> 'submissionId', '')::uuid
  into account_id, submission_id
  from music.releases release
  where release.id = p_release_id;

  if account_id is null then
    raise exception 'Release not found' using errcode = 'P0002';
  end if;

  if not (select private.can_edit_creator_account(account_id)) then
    raise exception 'Not authorized for this release' using errcode = '42501';
  end if;

  if submission_id is not null then
    select submission.status
    into submission_status
    from media.submissions submission
    where submission.id = submission_id;

    if submission_status is not null then
      perform private.add_media_submission_event(
        submission_id,
        request_user_id,
        'release_deleted_by_creator',
        submission_status,
        submission_status,
        'The creator permanently deleted the release from the Coptic Vine music catalog.',
        jsonb_build_object('releaseId', p_release_id)
      );
    end if;
  end if;

  result := private.delete_music_release_core(p_release_id);
  return result;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.delete_creator_music_release_track(p_release_id uuid, p_track_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  request_user_id uuid := auth.uid();
  account_id uuid;
  submission_id uuid;
  submission_status media.publication_status;
  result jsonb;
begin
  if request_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select release.owner_creator_account_id,
         nullif(release.metadata ->> 'submissionId', '')::uuid
  into account_id, submission_id
  from music.releases release
  where release.id = p_release_id;

  if account_id is null then
    raise exception 'Release not found' using errcode = 'P0002';
  end if;

  if not (select private.can_edit_creator_account(account_id)) then
    raise exception 'Not authorized for this release' using errcode = '42501';
  end if;

  result := private.delete_music_release_track_core(p_release_id, p_track_id);

  if submission_id is not null then
    select submission.status
    into submission_status
    from media.submissions submission
    where submission.id = submission_id;

    if submission_status is not null then
      perform private.add_media_submission_event(
        submission_id,
        request_user_id,
        'track_deleted_by_creator',
        submission_status,
        submission_status,
        'The creator permanently deleted a track from the release.',
        jsonb_build_object('releaseId', p_release_id, 'trackId', p_track_id)
      );
    end if;
  end if;

  return result;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.delete_learning_playlist(p_playlist_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
  delete from learning.playlists where id=p_playlist_id and owner_user_id=auth.uid();
  return found;
end; $function$
;
--;;
CREATE OR REPLACE FUNCTION public.delete_music_playlist(p_playlist_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not (select private.music_playlist_is_editable(p_playlist_id)) then
    raise exception 'Playlist not found or not editable' using errcode = '42501';
  end if;

  delete from music.playlists where id = p_playlist_id;
  return found;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.delete_submission(p_submission_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := auth.uid();
  sub media.submissions%rowtype;
  release_id uuid;
  deleted_tracks integer := 0;
  deleted_items integer := 0;
begin
  if actor is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select * into sub from media.submissions where id = p_submission_id for update;
  if not found then
    raise exception 'Submission not found' using errcode = 'P0002';
  end if;
  if not private.can_edit_creator_account(sub.creator_account_id) then
    raise exception 'Not authorized for this submission' using errcode = '42501';
  end if;

  if sub.submission_type = 'music_release'::media.submission_type then
    select release.id into release_id from music.releases release
    where nullif(release.metadata ->> 'submissionId', '')::uuid = sub.id
    for update;
    if release_id is not null then
      deleted_tracks := coalesce((private.delete_music_release_core(release_id) ->> 'deletedTrackCount')::integer, 0);
    end if;
  elsif sub.submission_type = 'learning_album'::media.submission_type then
    select count(*)::integer into deleted_items
    from learning.album_recordings recording
    join learning.albums album on album.id = recording.album_id
    where album.submission_id = sub.id;
    delete from learning.albums where submission_id = sub.id;
  elsif sub.submission_type = 'learning_lesson_set'::media.submission_type then
    select count(*)::integer into deleted_items
    from learning.lessons lesson
    join learning.lesson_sets lesson_set on lesson_set.id = lesson.lesson_set_id
    where lesson_set.submission_id = sub.id;
    delete from learning.lesson_sets where submission_id = sub.id;
  end if;

  delete from media.submissions where id = sub.id;

  return jsonb_build_object(
    'submissionId', sub.id, 'kind', sub.submission_type, 'deleted', true,
    'deletedTrackCount', deleted_tracks, 'deletedItemCount', deleted_items
  );
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.disable_notification_device(p_app_key text, p_provider text, p_push_token text)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_count integer;
begin
  update public.notification_devices
  set enabled = false, updated_at = now()
  where user_id = (select auth.uid())
    and app_key = p_app_key
    and provider = p_provider
    and push_token = p_push_token;

  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.earliest_release_at(p_submitted_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS timestamp with time zone
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select date_trunc('hour', coalesce(p_submitted_at, now())) + interval '48 hours';
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.enqueue_media_processing_job(p_upload_intent_id uuid, p_job_type media.processing_job_type DEFAULT 'audio_delivery'::media.processing_job_type, p_output_bucket text DEFAULT NULL::text)
 RETURNS TABLE(job_id uuid, status media.processing_job_status, input_bucket text, input_path text, output_bucket text, output_path text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  request_user_id uuid := auth.uid();
  source_intent media.upload_intents%rowtype;
  generated_output_path text;
  resolved_bucket text;
  allowed_buckets text[];
begin
  if request_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_job_type = 'metadata_probe'::media.processing_job_type then
    raise exception 'metadata_probe jobs are not implemented by any worker' using errcode = '22023';
  end if;

  allowed_buckets := case p_job_type
    when 'audio_delivery'::media.processing_job_type then array['chc-music', 'chc-learning']
    when 'video_delivery'::media.processing_job_type then array['chc-learning']
    when 'image_delivery'::media.processing_job_type then array['chc-images']
  end;
  if allowed_buckets is null then
    raise exception 'Unsupported processing job type: %', p_job_type using errcode = '22023';
  end if;
  resolved_bucket := coalesce(p_output_bucket, allowed_buckets[1]);
  if not (resolved_bucket = any(allowed_buckets)) then
    raise exception '% jobs cannot write to %', p_job_type, resolved_bucket using errcode = '22023';
  end if;

  select * into source_intent from media.upload_intents where id = p_upload_intent_id;
  if not found then raise exception 'Upload intent not found' using errcode = 'P0002'; end if;
  if source_intent.status <> 'uploaded'::media.upload_intent_status then
    raise exception 'Upload intent is not uploaded' using errcode = '22023';
  end if;

  -- Video uploads intentionally create both video_delivery and audio_delivery.
  if not (
    (p_job_type = 'audio_delivery' and source_intent.media_type in ('audio'::media.media_type, 'video'::media.media_type))
    or (p_job_type = 'video_delivery' and source_intent.media_type = 'video'::media.media_type)
    or (p_job_type = 'image_delivery' and source_intent.media_type = 'image'::media.media_type)
  ) then
    raise exception 'A % upload cannot be enqueued for %', source_intent.media_type, p_job_type using errcode = '22023';
  end if;
  if source_intent.requested_by <> request_user_id
    and not (select private.can_edit_creator_account(source_intent.creator_account_id)) then
    raise exception 'Not authorized for upload intent' using errcode = '42501';
  end if;

  if source_intent.original_deleted_at is not null and not exists (
    select 1 from media.media_processing_jobs done
    where done.upload_intent_id = source_intent.id
      and done.job_type = p_job_type
      and (
        done.status = 'completed'::media.processing_job_status
        or private.media_job_skipped_for_silence(done.status, done.error_message)
      )
  ) then
    raise exception 'The original upload was removed after processing; upload the file again' using errcode = '22023';
  end if;

  generated_output_path := private.media_processing_output_path(
    source_intent.creator_account_id, source_intent.id, p_job_type
  );
  insert into media.media_processing_jobs(
    upload_intent_id, job_type, status, input_bucket, input_path, output_bucket, output_path
  ) values (
    source_intent.id, p_job_type, 'queued'::media.processing_job_status,
    source_intent.bucket, source_intent.path, resolved_bucket, generated_output_path
  )
  on conflict (upload_intent_id, job_type) do update set
    available_at = case when media.media_processing_jobs.status in ('failed','cancelled') then now() else media.media_processing_jobs.available_at end,
    status = case when media.media_processing_jobs.status in ('failed','cancelled') then 'queued'::media.processing_job_status else media.media_processing_jobs.status end,
    attempt_count = case when media.media_processing_jobs.status in ('failed','cancelled') then 0 else media.media_processing_jobs.attempt_count end,
    finished_at = case when media.media_processing_jobs.status in ('failed','cancelled') then null else media.media_processing_jobs.finished_at end,
    output_bucket = case when media.media_processing_jobs.status in ('failed','cancelled') then excluded.output_bucket else media.media_processing_jobs.output_bucket end,
    output_path = case when media.media_processing_jobs.status in ('failed','cancelled') then excluded.output_path else media.media_processing_jobs.output_path end,
    error_message = case when media.media_processing_jobs.status in ('failed','cancelled') then null else media.media_processing_jobs.error_message end
  where not private.media_job_skipped_for_silence(media.media_processing_jobs.status, media.media_processing_jobs.error_message)
  returning id, media.media_processing_jobs.status, media.media_processing_jobs.input_bucket,
    media.media_processing_jobs.input_path, media.media_processing_jobs.output_bucket,
    media.media_processing_jobs.output_path
  into job_id, status, input_bucket, input_path, output_bucket, output_path;

  if job_id is null then
    -- A silent video's skipped audio-only job stays skipped.
    select job.id, job.status, job.input_bucket, job.input_path, job.output_bucket, job.output_path
    into job_id, status, input_bucket, input_path, output_bucket, output_path
    from media.media_processing_jobs job
    where job.upload_intent_id = source_intent.id and job.job_type = p_job_type;
  end if;

  -- The audio-only copy is made in the same pass as the video.
  if p_job_type = 'video_delivery'::media.processing_job_type then
    insert into media.media_processing_jobs(
      upload_intent_id, job_type, status, input_bucket, input_path, output_bucket, output_path
    ) values (
      source_intent.id, 'audio_delivery'::media.processing_job_type, 'queued'::media.processing_job_status,
      source_intent.bucket, source_intent.path, 'chc-learning',
      private.media_processing_output_path(source_intent.creator_account_id, source_intent.id, 'audio_delivery'::media.processing_job_type)
    )
    on conflict (upload_intent_id, job_type) do update set
      status = 'queued'::media.processing_job_status,
      available_at = now(),
      attempt_count = 0,
      finished_at = null,
      error_message = null
    where media.media_processing_jobs.status = 'failed'::media.processing_job_status;
  end if;

  update media.upload_intents set error_message = null where id = source_intent.id;
  return next;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.enqueue_user_notification(p_user_id uuid, p_app_key text, p_category text, p_event_type text, p_title text, p_body text, p_deep_link text DEFAULT NULL::text, p_image_url text DEFAULT NULL::text, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select private.enqueue_notification(
    p_user_id, p_app_key, p_category, p_event_type, p_title, p_body,
    p_deep_link, p_image_url, p_payload
  );
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.ensure_creator_workspace(p_display_name text DEFAULT NULL::text)
 RETURNS TABLE(creator_account_id uuid, display_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  request_user_id uuid := auth.uid();
  account_id uuid;
  account_name text;
  resolved_name text;
  identity_id uuid;
begin
  if request_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select coalesce(
    nullif(trim(p_display_name), ''),
    nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(u.raw_user_meta_data ->> 'name'), ''),
    nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
    'Coptic Vine Creator'
  )
  into resolved_name
  from auth.users u
  where u.id = request_user_id;

  if resolved_name is null then
    resolved_name := 'Coptic Vine Creator';
  end if;

  insert into creator.profiles (id, display_name)
  values (request_user_id, resolved_name)
  on conflict (id) do update
  set display_name = coalesce(creator.profiles.display_name, excluded.display_name),
      updated_at = now();

  insert into creator.user_roles (user_id, role, granted_by, granted_at, revoked_at, notes)
  values (
    request_user_id,
    'creator'::creator.app_role,
    request_user_id,
    now(),
    null,
    'Self-service Coptic Vine Artists onboarding'
  )
  on conflict (user_id, role) do update
  set granted_by = request_user_id,
      granted_at = now(),
      revoked_at = null,
      notes = 'Self-service Coptic Vine Artists onboarding';

  select member.creator_account_id, account.display_name
  into account_id, account_name
  from creator.creator_account_members member
  join creator.creator_accounts account on account.id = member.creator_account_id
  where member.user_id = request_user_id
    and account.status = 'active'::creator.creator_account_status
  order by member.created_at
  limit 1;

  if account_id is null then
    insert into creator.creator_accounts (
      display_name,
      status,
      created_by,
      updated_by
    )
    values (
      resolved_name,
      'active'::creator.creator_account_status,
      request_user_id,
      request_user_id
    )
    returning id, creator.creator_accounts.display_name
    into account_id, account_name;

    insert into creator.creator_account_members (
      creator_account_id,
      user_id,
      role,
      invited_by
    )
    values (
      account_id,
      request_user_id,
      'owner'::creator.creator_account_role,
      request_user_id
    );
  end if;

  select account.identity_artist_id into identity_id
  from creator.creator_accounts account
  where account.id = account_id;

  if identity_id is null then
    -- A creator may have been credited by this same authenticated user before
    -- creating their own Coptic Vine Artists workspace. Reclaim that exact unowned
    -- credit so historic music.track_artists links remain intact. A matching
    -- name created by another user is NEVER sufficient to transfer ownership.
    select artist.id into identity_id
    from music.artists artist
    where artist.owner_creator_account_id is null
      and artist.created_by=request_user_id
      and private.normalize_creator_name(artist.display_name)=
        private.normalize_creator_name(coalesce(account_name,resolved_name))
    order by artist.publication_status='published'::media.publication_status desc,
      artist.created_at
    limit 1 for update;

    if identity_id is not null then
      update music.artists artist
      set owner_creator_account_id=account_id,
          is_credit_only=false,
          updated_by=request_user_id,
          updated_at=now()
      where artist.id=identity_id;
    else
      insert into music.artists (owner_creator_account_id, display_name, created_by, updated_by)
      values (account_id, coalesce(account_name, resolved_name), request_user_id, request_user_id)
      returning id into identity_id;
    end if;

    update creator.creator_accounts account
    set identity_artist_id = identity_id,
        updated_by = request_user_id,
        updated_at = now()
    where account.id = account_id;
  end if;

  return query select account_id, account_name;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.evaluate_condition(p_condition text, p_flags jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  expr text;
  tokens text[];
  tok text;
  val boolean;
  result boolean;
BEGIN
  IF p_condition IS NULL OR btrim(p_condition) = '' THEN
    RETURN true;
  END IF;

  expr := p_condition;

  SELECT array_agg(DISTINCT m[1]) INTO tokens
  FROM regexp_matches(p_condition, '[A-Za-z][A-Za-z0-9_.:]*', 'g') AS m;

  IF tokens IS NOT NULL THEN
    SELECT array_agg(t ORDER BY length(t) DESC) INTO tokens FROM unnest(tokens) AS t;
    FOREACH tok IN ARRAY tokens LOOP
      val := COALESCE((p_flags ->> tok)::boolean, false);
      expr := replace(expr, tok, val::text);
    END LOOP;
  END IF;

  expr := replace(expr, '&&', ' AND ');
  expr := replace(expr, '||', ' OR ');
  expr := replace(expr, '!', ' NOT ');

  EXECUTE format('SELECT %s', expr) INTO result;
  RETURN COALESCE(result, false);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'evaluate_condition failed for condition=% : %', p_condition, SQLERRM;
  RETURN false;
END;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.fail_media_processing_job(p_worker_token text, p_job_id uuid, p_error_message text)
 RETURNS TABLE(job_id uuid, status media.processing_job_status, attempt_count integer, max_attempts integer, available_at timestamp with time zone, error_message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
declare
  job_record media.media_processing_jobs%rowtype;
  normalized_error text;
  will_retry boolean;
  retry_delay interval;
  affected_submission_id uuid;
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

  normalized_error := left(coalesce(nullif(trim(p_error_message), ''), 'Unknown processing error'), 4000);
  will_retry := job_record.attempt_count < job_record.max_attempts;

  -- Exponential backoff, capped at an hour: a transient R2 or ffmpeg failure
  -- retries soon, a persistently broken input stops hammering the queue.
  retry_delay := least(
    interval '1 minute' * power(4, greatest(job_record.attempt_count, 1)),
    interval '1 hour'
  );

  update media.media_processing_jobs job
  set status = case
        when will_retry then 'queued'::media.processing_job_status
        else 'failed'::media.processing_job_status
      end,
      available_at = case
        when will_retry then now() + retry_delay
        else job.available_at
      end,
      finished_at = case
        when will_retry then null
        else now()
      end,
      error_message = normalized_error
  where job.id = job_record.id
  returning
    job.id,
    job.status,
    job.attempt_count,
    job.max_attempts,
    job.available_at,
    job.error_message
  into
    job_id,
    status,
    attempt_count,
    max_attempts,
    available_at,
    error_message;

  -- A job that has run out of attempts is a dead end for whatever submission
  -- was waiting on it. Record that on the submission instead of leaving it
  -- sitting in `processing` with no visible reason.
  if not will_retry then
    for affected_submission_id in
      select distinct item.submission_id
      from media.submission_items item
      where item.upload_intent_id = job_record.upload_intent_id
    loop
      perform private.add_media_submission_event(
        affected_submission_id,
        null,
        'processing_failed',
        null,
        null,
        normalized_error,
        jsonb_build_object(
          'processingJobId', job_record.id,
          'jobType', job_record.job_type,
          'uploadIntentId', job_record.upload_intent_id,
          'attemptCount', job_record.attempt_count,
          'maxAttempts', job_record.max_attempts
        )
      );
    end loop;
  end if;

  return next;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.finalize_admin_processing_file_deletion(p_job_id uuid)
 RETURNS TABLE(job_id uuid, deleted boolean, deleted_job_count integer, deleted_submission_item_count integer, deleted_media_asset_id uuid, deleted_upload_intent_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  request_user_id uuid := auth.uid();
  root_job media.media_processing_jobs%rowtype;
  affected_jobs integer := 0;
  affected_items integer := 0;
  asset_id uuid;
  upload_id uuid;
begin
  if request_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not (select private.is_admin()) then
    raise exception 'Admin role required' using errcode = '42501';
  end if;

  select *
  into root_job
  from media.media_processing_jobs job
  where job.id = p_job_id
  for update;

  if not found then
    return query select p_job_id, false, 0, 0, null::uuid, null::uuid;
    return;
  end if;

  asset_id := root_job.media_asset_id;
  upload_id := root_job.upload_intent_id;

  -- Non-nullable Learn media relations represent the file itself; removing the
  -- bytes therefore removes those recording/lesson rows too.
  if asset_id is not null then
    delete from learning.album_recordings recording where recording.media_asset_id = asset_id;
    delete from learning.lessons lesson where lesson.media_asset_id = asset_id;

    update music.tracks track set media_asset_id = null, updated_at = now()
    where track.media_asset_id = asset_id;

    update music.releases release set cover_asset_id = null, updated_at = now()
    where release.cover_asset_id = asset_id;
    update music.artists artist set profile_image_asset_id = null, updated_at = now()
    where artist.profile_image_asset_id = asset_id;
    update music.playlists playlist set cover_asset_id = null, updated_at = now()
    where playlist.cover_asset_id = asset_id;

    update learning.albums album set cover_asset_id = null, updated_at = now()
    where album.cover_asset_id = asset_id;
    update learning.lesson_sets lesson_set set cover_asset_id = null, updated_at = now()
    where lesson_set.cover_asset_id = asset_id;
    update learning.cantors cantor set profile_image_asset_id = null, updated_at = now()
    where cantor.profile_image_asset_id = asset_id;
    update learning.playlists playlist set cover_asset_id = null, updated_at = now()
    where playlist.cover_asset_id = asset_id;
  end if;

  delete from media.submission_items item
  where item.media_processing_job_id = root_job.id
     or (upload_id is not null and item.upload_intent_id = upload_id)
     or (asset_id is not null and item.media_asset_id = asset_id);
  get diagnostics affected_items = row_count;

  delete from media.media_processing_jobs job
  where job.id = root_job.id
     or (upload_id is not null and job.upload_intent_id = upload_id)
     or (asset_id is not null and job.media_asset_id = asset_id);
  get diagnostics affected_jobs = row_count;

  if asset_id is not null then
    delete from media.media_assets asset where asset.id = asset_id;
  end if;

  if upload_id is not null then
    delete from media.upload_intents upload where upload.id = upload_id;
  end if;

  return query
  select p_job_id, true, affected_jobs, affected_items, asset_id, upload_id;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.find_reusable_uploaded_media_intent(p_creator_account_id uuid, p_original_filename text, p_content_length bigint, p_media_type media.media_type)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select intent.id
  from media.upload_intents intent
  where intent.creator_account_id = p_creator_account_id
    and intent.requested_by = (select auth.uid())
    and (select private.can_edit_creator_account(p_creator_account_id))
    and intent.original_filename = p_original_filename
    and intent.content_length = p_content_length
    and intent.uploaded_size = p_content_length
    and intent.media_type = p_media_type
    and intent.status = 'uploaded'::media.upload_intent_status
    and intent.uploaded_at > now() - interval '7 days'
    and not exists (
      select 1 from media.submission_items item
      where item.upload_intent_id = intent.id
    )
    and (
      intent.original_deleted_at is null
      or exists (
        select 1
        from media.media_processing_jobs job
        join media.media_assets asset on asset.id = job.media_asset_id
        where job.upload_intent_id = intent.id
          and job.job_type = 'video_delivery'::media.processing_job_type
          and job.status = 'completed'::media.processing_job_status
      )
    )
  order by intent.uploaded_at desc
  limit 1;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.finish_offline_package_snapshot(p_snapshot_id uuid, p_success boolean, p_error text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.role() <> 'service_role' then raise exception 'service_role required'; end if;
  if p_success then
    update offline_content.resources r set dirty=false
      where exists(select 1 from offline_content.snapshot_resources sr where sr.snapshot_id=p_snapshot_id and sr.resource_key=r.resource_key and sr.version=r.revision::text);
    update offline_content.snapshots set status='published', published_at=now(), error=null where snapshot_id=p_snapshot_id;
    update offline_content.publication_requests set status='complete', completed_at=now(), error=null where snapshot_id=p_snapshot_id;
  else
    update offline_content.snapshots set status='failed', error=p_error where snapshot_id=p_snapshot_id;
    update offline_content.publication_requests set status='failed', completed_at=now(), error=p_error where snapshot_id=p_snapshot_id;
  end if;
end $function$
;
--;;
CREATE OR REPLACE FUNCTION public.force_media_processing_job(p_job_id uuid)
 RETURNS TABLE(job_id uuid, status media.processing_job_status, available_at timestamp with time zone, attempt_count integer, max_attempts integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  request_user_id uuid := auth.uid();
  job_record media.media_processing_jobs%rowtype;
  intent_record media.upload_intents%rowtype;
begin
  if request_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not (select private.is_admin()) then
    raise exception 'Admin role required' using errcode = '42501';
  end if;

  select *
  into job_record
  from media.media_processing_jobs job
  where job.id = p_job_id
  for update;

  if not found then
    raise exception 'Processing job not found' using errcode = 'P0002';
  end if;

  if job_record.status = 'completed'::media.processing_job_status then
    raise exception 'Completed jobs do not need to be forced' using errcode = '22023';
  end if;

  if job_record.status = 'processing'::media.processing_job_status
     and not private.media_processing_job_is_stale(job_record.job_type, job_record.claimed_at, job_record.heartbeat_at) then
    raise exception 'This job is already actively processing' using errcode = '22023';
  end if;

  select * into intent_record from media.upload_intents intent where intent.id = job_record.upload_intent_id;
  if found and intent_record.original_deleted_at is not null then
    raise exception 'The original upload was removed after processing; upload the file again' using errcode = '22023';
  end if;

  update media.media_processing_jobs job
  set status = 'queued'::media.processing_job_status,
      -- claim_media_processing_job sorts by available_at first. Epoch places
      -- an explicitly forced job ahead of ordinary queued work.
      available_at = '1970-01-01 00:00:00+00'::timestamptz,
      attempt_count = case
        when job.attempt_count >= job.max_attempts then 0
        else job.attempt_count
      end,
      worker_id = null,
      claimed_at = null,
      heartbeat_at = null,
      progress = null,
      started_at = null,
      finished_at = null,
      error_message = null,
      updated_at = now()
  where job.id = p_job_id;

  return query
  select job.id, job.status, job.available_at, job.attempt_count, job.max_attempts
  from media.media_processing_jobs job
  where job.id = p_job_id;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.force_pending_media_processing_jobs()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  request_user_id uuid := auth.uid();
  affected integer := 0;
begin
  if request_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not (select private.is_admin()) then
    raise exception 'Admin role required' using errcode = '42501';
  end if;

  update media.media_processing_jobs job
  set status = 'queued'::media.processing_job_status,
      available_at = now(),
      attempt_count = case
        when job.attempt_count >= job.max_attempts then 0
        else job.attempt_count
      end,
      worker_id = null,
      claimed_at = null,
      heartbeat_at = null,
      progress = null,
      started_at = null,
      finished_at = null,
      error_message = null,
      updated_at = now()
  where (
      job.status in (
        'queued'::media.processing_job_status,
        'failed'::media.processing_job_status,
        'cancelled'::media.processing_job_status
      )
      or (
        job.status = 'processing'::media.processing_job_status
        and private.media_processing_job_is_stale(job.job_type, job.claimed_at, job.heartbeat_at)
      )
    )
    and not private.media_job_skipped_for_silence(job.status, job.error_message)
    and not exists (
      select 1 from media.upload_intents intent
      where intent.id = job.upload_intent_id
        and intent.original_deleted_at is not null
    );

  get diagnostics affected = row_count;
  return affected;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.force_submission_media_processing(p_submission_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  request_user_id uuid := auth.uid();
  affected integer := 0;
begin
  if request_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not (select private.is_admin()) then
    raise exception 'Admin role required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from media.submissions submission where submission.id = p_submission_id
  ) then
    raise exception 'Submission not found' using errcode = 'P0002';
  end if;

  update media.media_processing_jobs job
  set status = 'queued'::media.processing_job_status,
      available_at = '1970-01-01 00:00:00+00'::timestamptz,
      attempt_count = case
        when job.attempt_count >= job.max_attempts then 0
        else job.attempt_count
      end,
      worker_id = null,
      claimed_at = null,
      heartbeat_at = null,
      progress = null,
      started_at = null,
      finished_at = null,
      error_message = null,
      updated_at = now()
  where job.id in (
    select item.media_processing_job_id
    from media.submission_items item
    where item.submission_id = p_submission_id
      and item.media_processing_job_id is not null
  )
    and (
      job.status in (
        'queued'::media.processing_job_status,
        'failed'::media.processing_job_status,
        'cancelled'::media.processing_job_status
      )
      or (
        job.status = 'processing'::media.processing_job_status
        and private.media_processing_job_is_stale(job.job_type, job.claimed_at, job.heartbeat_at)
      )
    )
    and not exists (
      select 1 from media.upload_intents intent
      where intent.id = job.upload_intent_id
        and intent.original_deleted_at is not null
    );

  get diagnostics affected = row_count;
  return affected;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.french_alignment_chapter_payload(p_book text, p_target_ch integer, p_source_ch1 integer, p_source_ch2 integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'bible', 'extensions'
AS $function$
with bm as (select source_slug from bible.french_theotex_book_map_20260909 where book_key=p_book),
tgt as (
 select jsonb_agg(jsonb_build_object('verse_id',v.verse_id,'chapter',v.chapter_number,'verse',v.verse_number,
 'greek_norm',regexp_replace(lower(unaccent(v.greek)),'[^[:alnum:]]','','g'),'missing',v.french is null)
 order by case when v.verse_number='i' then -1 else coalesce(substring(v.verse_number from '^[0-9]+')::int,9999) end,
 case when v.verse_number='i' then '' else regexp_replace(v.verse_number,'^[0-9]+','','') end,v.verse_id) j
 from bible.verses v where v.book_key=p_book and v.chapter_number=p_target_ch and v.greek is not null and btrim(v.greek)<>''
), src as (
 select jsonb_agg(jsonb_build_object('chapter',s.source_chapter,'verse',s.source_verse,'greek_norm',s.greek_norm,'french',s.french)
 order by s.source_chapter,s.source_verse) j
 from bible.french_theotex_norm_20260909 s join bm on bm.source_slug=s.source_slug
 where s.source_chapter=p_source_ch1 or (p_source_ch2 is not null and s.source_chapter=p_source_ch2)
)
select jsonb_build_object('book_key',p_book,'target_chapter',p_target_ch,'target',coalesce(tgt.j,'[]'::jsonb),'source',coalesce(src.j,'[]'::jsonb)) from tgt,src;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.french_alignment_payload(p_book text)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'bible', 'extensions'
AS $function$
with bm as (
  select source_slug from bible.french_theotex_book_map_20260909 where book_key=p_book
), tgt as (
  select jsonb_agg(jsonb_build_object(
    'verse_id',v.verse_id,'chapter',v.chapter_number,'verse',v.verse_number,
    'greek_norm',regexp_replace(lower(unaccent(v.greek)),'[^[:alnum:]]','','g'),
    'missing',v.french is null
  ) order by v.chapter_number,
    case when v.verse_number='i' then -1 else coalesce(substring(v.verse_number from '^[0-9]+')::int,9999) end,
    case when v.verse_number='i' then '' else regexp_replace(v.verse_number,'^[0-9]+','','') end,
    v.verse_id) j
  from bible.verses v where v.book_key=p_book and v.greek is not null and btrim(v.greek)<>''
), src as (
  select jsonb_agg(jsonb_build_object(
    'chapter',s.source_chapter,'verse',s.source_verse,'greek_norm',s.greek_norm,'french',s.french
  ) order by s.source_chapter,s.source_verse) j
  from bible.french_theotex_norm_20260909 s join bm on bm.source_slug=s.source_slug
)
select jsonb_build_object('book_key',p_book,'target',coalesce(tgt.j,'[]'::jsonb),'source',coalesce(src.j,'[]'::jsonb)) from tgt,src;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_admin_artist_profile(p_artist_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_admin_artists(p_search text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_admin_creator_artist_claims(p_submission_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare account_id uuid; existing_id uuid; account_name text; result jsonb;
begin
  if auth.uid() is null or not private.is_admin() then
    raise exception 'Admin role required' using errcode='42501';
  end if;
  select ca.id,ca.identity_artist_id,ca.display_name
    into account_id,existing_id,account_name
  from media.submissions sub
  join creator.creator_accounts ca on ca.id=sub.creator_account_id
  where sub.id=p_submission_id;
  if account_id is null or existing_id is null then return '[]'::jsonb; end if;
  if exists(select 1 from music.artists own where own.id=existing_id
    and own.publication_status='published'::media.publication_status) then
    return '[]'::jsonb;
  end if;
  if exists(select 1 from music.releases rel
    where rel.owner_creator_account_id=account_id
    and rel.publication_status='published'::media.publication_status) then
    return '[]'::jsonb;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'artistId',artist.id,'title',artist.display_name,
    'profileImage',case when photo.id is not null then
      jsonb_build_object('bucket',photo.bucket,'path',photo.path,'version',photo.version)
      else null end,
    'existingCredits',(select count(*) from music.track_artists ta where ta.artist_id=artist.id),
    'creditOnly',artist.is_credit_only
  ) order by (
    select count(*) from music.track_artists ta where ta.artist_id=artist.id
  ) desc, artist.created_at), '[]'::jsonb)
  into result
  from music.artists artist
  left join media.media_assets photo on photo.id=artist.profile_image_asset_id
      and photo.publication_status='published'::media.publication_status
  where artist.id<>existing_id
    and artist.owner_creator_account_id is null
    and not exists(select 1 from creator.creator_accounts other_ca
      where other_ca.identity_artist_id=artist.id)
    and private.normalize_creator_name(artist.display_name)=
      private.normalize_creator_name(account_name);
  return result;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_admin_notification_broadcast_overview(p_category text DEFAULT 'feast_celebrations'::text, p_history_limit integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_admin_processing_jobs()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not (select private.is_admin()) then
    raise exception 'Admin role required' using errcode = '42501';
  end if;

  return (
    with visible_jobs as (
      select job.*
      from media.media_processing_jobs job
      left join media.upload_intents upload on upload.id = job.upload_intent_id
      where not (
        job.job_type = 'audio_delivery'::media.processing_job_type
        and coalesce(upload.media_type = 'video'::media.media_type, false)
        and exists (
          select 1 from media.media_processing_jobs video
          where video.upload_intent_id = job.upload_intent_id
            and video.job_type = 'video_delivery'::media.processing_job_type
        )
      )
    )
    select jsonb_build_object(
      'summary', jsonb_build_object(
        'queued', (select count(*) from visible_jobs where status = 'queued'::media.processing_job_status),
        'processing', (select count(*) from visible_jobs where status = 'processing'::media.processing_job_status),
        'completed', (select count(*) from visible_jobs where status = 'completed'::media.processing_job_status),
        'failed', (select count(*) from visible_jobs where status = 'failed'::media.processing_job_status),
        'cancelled', (select count(*) from visible_jobs where status = 'cancelled'::media.processing_job_status)
      ),
      'jobs', coalesce((
        select jsonb_agg(
          jsonb_strip_nulls(jsonb_build_object(
            'id', job.id,
            'jobType', job.job_type,
            'status', job.status,
            'attemptCount', job.attempt_count,
            'maxAttempts', job.max_attempts,
            'workerId', job.worker_id,
            'inputBucket', job.input_bucket,
            'inputPath', job.input_path,
            'outputBucket', job.output_bucket,
            'outputPath', job.output_path,
            'outputMimeType', job.output_mime_type,
            'outputSizeBytes', job.output_size_bytes,
            'errorMessage', job.error_message,
            'queuedAt', job.queued_at,
            'availableAt', job.available_at,
            'claimedAt', job.claimed_at,
            'startedAt', job.started_at,
            'finishedAt', job.finished_at,
            'createdAt', job.created_at,
            'updatedAt', job.updated_at,
            'heartbeatAt', job.heartbeat_at,
            'progress', job.progress,
            'audioOnly', (
              select jsonb_strip_nulls(jsonb_build_object(
                'id', audio.id,
                'status', audio.status,
                'attemptCount', audio.attempt_count,
                'maxAttempts', audio.max_attempts,
                'outputSizeBytes', audio.output_size_bytes,
                'errorMessage', audio.error_message
              ))
              from media.media_processing_jobs audio
              where job.job_type = 'video_delivery'::media.processing_job_type
                and audio.upload_intent_id = job.upload_intent_id
                and audio.job_type = 'audio_delivery'::media.processing_job_type
              limit 1
            ),
            'item', case when item.id is null then null else jsonb_build_object(
              'id', item.id,
              'title', item.title,
              'role', item.role,
              'sortOrder', item.sort_order,
              'required', item.required
            ) end,
            'upload', case when upload.id is null then null else jsonb_build_object(
              'id', upload.id,
              'originalFilename', upload.original_filename,
              'mediaType', upload.media_type,
              'contentType', upload.content_type,
              'contentLength', upload.content_length,
              'originalDeletedAt', upload.original_deleted_at
            ) end,
            'submission', case when submission.id is null then null else jsonb_build_object(
              'id', submission.id,
              'title', submission.title,
              'submissionType', submission.submission_type,
              'status', submission.status,
              'creatorName', account.display_name,
              'artworkItemId', (
                select artwork.id
                from media.submission_items artwork
                where artwork.submission_id = submission.id
                  and artwork.role = 'artwork'::media.submission_item_role
                order by artwork.sort_order, artwork.created_at
                limit 1
              )
            ) end
          ))
          order by
            case job.status
              when 'processing'::media.processing_job_status then 0
              when 'queued'::media.processing_job_status then 1
              when 'failed'::media.processing_job_status then 2
              when 'completed'::media.processing_job_status then 3
              else 4
            end,
            job.queued_at desc
        )
        from visible_jobs job
        left join media.submission_items item on item.media_processing_job_id = job.id
        left join media.upload_intents upload on upload.id = job.upload_intent_id
        left join media.submissions submission on submission.id = item.submission_id
        left join creator.creator_accounts account on account.id = submission.creator_account_id
      ), '[]'::jsonb)
    )
  );
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_admin_publication_overview()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not (select private.is_admin()) then
    raise exception 'Admin role required' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'ready', coalesce((
      select jsonb_agg(entry order by sort_at desc)
      from (
        select
          coalesce(submission.approved_at, submission.updated_at, submission.created_at) as sort_at,
          jsonb_strip_nulls(jsonb_build_object(
            'id', submission.id,
            'title', submission.title,
            'description', submission.description,
            'submissionType', submission.submission_type,
            'status', submission.status,
            'creatorName', account.display_name,
            'approvedAt', submission.approved_at,
            'publishedAt', submission.published_at,
            'itemsReady', private.submission_required_items_ready(submission.id),
            'itemCount', (
              select count(*) from media.submission_items item
              where item.submission_id = submission.id
            ),
            'assetCount', (
              select count(*) from media.submission_items item
              where item.submission_id = submission.id
                and item.media_asset_id is not null
            ),
            'artworkItemId', (
              select item.id
              from media.submission_items item
              where item.submission_id = submission.id
                and item.role = 'artwork'::media.submission_item_role
              order by item.sort_order, item.created_at
              limit 1
            ),
            'catalog', case
              when submission.submission_type = 'music_release'::media.submission_type then (
                select jsonb_strip_nulls(jsonb_build_object(
                  'kind', 'music_release',
                  'id', release.id,
                  'title', release.title,
                  'publicationStatus', release.publication_status,
                  'itemCount', (
                    select count(*) from music.release_tracks rt where rt.release_id = release.id
                  ),
                  'itemsWithMedia', (
                    select count(*)
                    from music.release_tracks rt
                    join music.tracks track on track.id = rt.track_id
                    where rt.release_id = release.id and track.media_asset_id is not null
                  ),
                  'coverAssetId', release.cover_asset_id
                ))
                from music.releases release
                where release.metadata ->> 'submissionId' = submission.id::text
                order by release.created_at desc
                limit 1
              )
              when submission.submission_type = 'learning_album'::media.submission_type then (
                select jsonb_strip_nulls(jsonb_build_object(
                  'kind', 'learning_album',
                  'id', album.id,
                  'title', album.title,
                  'publicationStatus', album.publication_status,
                  'itemCount', (
                    select count(*) from learning.album_recordings recording where recording.album_id = album.id
                  ),
                  'itemsWithMedia', (
                    select count(*) from learning.album_recordings recording
                    where recording.album_id = album.id and recording.media_asset_id is not null
                  ),
                  'coverAssetId', album.cover_asset_id
                ))
                from learning.albums album
                where album.submission_id = submission.id
                limit 1
              )
              when submission.submission_type = 'learning_lesson_set'::media.submission_type then (
                select jsonb_strip_nulls(jsonb_build_object(
                  'kind', 'learning_lesson_set',
                  'id', lesson_set.id,
                  'title', lesson_set.title,
                  'publicationStatus', lesson_set.publication_status,
                  'itemCount', (
                    select count(*) from learning.lessons lesson where lesson.lesson_set_id = lesson_set.id
                  ),
                  'itemsWithMedia', (
                    select count(*) from learning.lessons lesson
                    where lesson.lesson_set_id = lesson_set.id and lesson.media_asset_id is not null
                  ),
                  'coverAssetId', lesson_set.cover_asset_id
                ))
                from learning.lesson_sets lesson_set
                where lesson_set.submission_id = submission.id
                limit 1
              )
              else null
            end
          )) as entry
        from media.submissions submission
        join creator.creator_accounts account on account.id = submission.creator_account_id
        where submission.status in (
          'approved'::media.publication_status,
          'processing'::media.publication_status
        )
          and private.submission_required_items_ready(submission.id)
      ) ready_entries
    ), '[]'::jsonb),
    'waiting', coalesce((
      select jsonb_agg(entry order by sort_at desc)
      from (
        select
          coalesce(submission.approved_at, submission.updated_at, submission.created_at) as sort_at,
          jsonb_strip_nulls(jsonb_build_object(
            'id', submission.id,
            'title', submission.title,
            'description', submission.description,
            'submissionType', submission.submission_type,
            'status', submission.status,
            'creatorName', account.display_name,
            'approvedAt', submission.approved_at,
            'publishedAt', submission.published_at,
            'itemsReady', false,
            'itemCount', (
              select count(*) from media.submission_items item
              where item.submission_id = submission.id
            ),
            'assetCount', (
              select count(*) from media.submission_items item
              where item.submission_id = submission.id
                and item.media_asset_id is not null
            ),
            'artworkItemId', (
              select item.id
              from media.submission_items item
              where item.submission_id = submission.id
                and item.role = 'artwork'::media.submission_item_role
              order by item.sort_order, item.created_at
              limit 1
            )
          )) as entry
        from media.submissions submission
        join creator.creator_accounts account on account.id = submission.creator_account_id
        where submission.status in (
          'approved'::media.publication_status,
          'processing'::media.publication_status
        )
          and not private.submission_required_items_ready(submission.id)
      ) waiting_entries
    ), '[]'::jsonb),
    'published', coalesce((
      select jsonb_agg(entry order by sort_at desc)
      from (
        select
          coalesce(submission.published_at, submission.updated_at, submission.created_at) as sort_at,
          jsonb_strip_nulls(jsonb_build_object(
            'id', submission.id,
            'title', submission.title,
            'description', submission.description,
            'submissionType', submission.submission_type,
            'status', submission.status,
            'creatorName', account.display_name,
            'approvedAt', submission.approved_at,
            'publishedAt', submission.published_at,
            'itemsReady', private.submission_required_items_ready(submission.id),
            'itemCount', (
              select count(*) from media.submission_items item
              where item.submission_id = submission.id
            ),
            'assetCount', (
              select count(*) from media.submission_items item
              where item.submission_id = submission.id
                and item.media_asset_id is not null
            ),
            'artworkItemId', (
              select item.id
              from media.submission_items item
              where item.submission_id = submission.id
                and item.role = 'artwork'::media.submission_item_role
              order by item.sort_order, item.created_at
              limit 1
            ),
            'catalog', case
              when submission.submission_type = 'music_release'::media.submission_type then (
                select jsonb_strip_nulls(jsonb_build_object(
                  'kind', 'music_release',
                  'id', release.id,
                  'title', release.title,
                  'publicationStatus', release.publication_status,
                  'itemCount', (
                    select count(*) from music.release_tracks rt where rt.release_id = release.id
                  ),
                  'itemsWithMedia', (
                    select count(*)
                    from music.release_tracks rt
                    join music.tracks track on track.id = rt.track_id
                    where rt.release_id = release.id and track.media_asset_id is not null
                  ),
                  'coverAssetId', release.cover_asset_id
                ))
                from music.releases release
                where release.metadata ->> 'submissionId' = submission.id::text
                order by release.created_at desc
                limit 1
              )
              when submission.submission_type = 'learning_album'::media.submission_type then (
                select jsonb_strip_nulls(jsonb_build_object(
                  'kind', 'learning_album',
                  'id', album.id,
                  'title', album.title,
                  'publicationStatus', album.publication_status,
                  'itemCount', (
                    select count(*) from learning.album_recordings recording where recording.album_id = album.id
                  ),
                  'itemsWithMedia', (
                    select count(*) from learning.album_recordings recording
                    where recording.album_id = album.id and recording.media_asset_id is not null
                  ),
                  'coverAssetId', album.cover_asset_id
                ))
                from learning.albums album
                where album.submission_id = submission.id
                limit 1
              )
              when submission.submission_type = 'learning_lesson_set'::media.submission_type then (
                select jsonb_strip_nulls(jsonb_build_object(
                  'kind', 'learning_lesson_set',
                  'id', lesson_set.id,
                  'title', lesson_set.title,
                  'publicationStatus', lesson_set.publication_status,
                  'itemCount', (
                    select count(*) from learning.lessons lesson where lesson.lesson_set_id = lesson_set.id
                  ),
                  'itemsWithMedia', (
                    select count(*) from learning.lessons lesson
                    where lesson.lesson_set_id = lesson_set.id and lesson.media_asset_id is not null
                  ),
                  'coverAssetId', lesson_set.cover_asset_id
                ))
                from learning.lesson_sets lesson_set
                where lesson_set.submission_id = submission.id
                limit 1
              )
              else null
            end
          )) as entry
        from media.submissions submission
        join creator.creator_accounts account on account.id = submission.creator_account_id
        where submission.status = 'published'::media.publication_status
          and (
            (
              submission.submission_type = 'music_release'::media.submission_type
              and exists (
                select 1 from music.releases release
                where release.metadata ->> 'submissionId' = submission.id::text
              )
            )
            or (
              submission.submission_type = 'learning_album'::media.submission_type
              and exists (
                select 1 from learning.albums album
                where album.submission_id = submission.id
              )
            )
            or (
              submission.submission_type = 'learning_lesson_set'::media.submission_type
              and exists (
                select 1 from learning.lesson_sets lesson_set
                where lesson_set.submission_id = submission.id
              )
            )
          )
      ) published_entries
    ), '[]'::jsonb)
  );
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_admin_review_queue(p_statuses text[] DEFAULT NULL::text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  wanted media.publication_status[];
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not (select private.is_admin()) then
    raise exception 'Admin role required' using errcode = '42501';
  end if;

  -- No filter means everything an admin still has work to do on. Published,
  -- rejected and archived submissions are asked for by name.
  if p_statuses is null or cardinality(p_statuses) = 0 then
    wanted := array[
      'pending_review'::media.publication_status,
      'changes_requested'::media.publication_status,
      'approved'::media.publication_status,
      'processing'::media.publication_status
    ];
  else
    begin
      select array_agg(status::media.publication_status)
      into wanted
      from unnest(p_statuses) as status;
    exception when others then
      raise exception 'Unknown submission status in filter' using errcode = '22023';
    end;
  end if;

  return jsonb_build_object(
    'counts', coalesce((
      select jsonb_object_agg(grouped.status, grouped.total)
      from (
        select submission.status::text as status, count(*) as total
        from media.submissions submission
        group by submission.status
      ) grouped
    ), '{}'::jsonb),
    'submissions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', submission.id,
          'title', submission.title,
          'description', submission.description,
          'submissionType', submission.submission_type,
          'status', submission.status,
          'submittedAt', submission.submitted_at,
          'reviewDueAt', submission.review_due_at,
          'reviewedAt', submission.reviewed_at,
          'publishedAt', submission.published_at,
          'updatedAt', submission.updated_at,
          'creatorAccountId', submission.creator_account_id,
          'creatorName', account.display_name,
          'submitterEmail', submitter.email,
          -- Only a submission still awaiting a decision can be late.
          'dueState', case
            when submission.status <> 'pending_review'::media.publication_status then null
            when submission.review_due_at is null then null
            when submission.review_due_at < now() then 'overdue'
            when submission.review_due_at < now() + interval '12 hours' then 'due_soon'
            else 'on_track'
          end,
          'itemCount', counts.item_count,
          'audioCount', counts.audio_count,
          'imageCount', counts.image_count,
          'videoCount', counts.video_count,
          'readyCount', counts.ready_count,
          'failedCount', counts.failed_count,
          'artworkItemId', (
            select item.id
            from media.submission_items item
            where item.submission_id = submission.id
              and item.role = 'artwork'::media.submission_item_role
            order by item.sort_order, item.created_at
            limit 1
          )
        )
        order by
          -- Overdue work first, then the oldest submission waiting.
          case when submission.status = 'pending_review'::media.publication_status then 0 else 1 end,
          submission.review_due_at asc nulls last,
          submission.submitted_at asc nulls last,
          submission.created_at asc
      )
      from media.submissions submission
      join creator.creator_accounts account on account.id = submission.creator_account_id
      left join auth.users submitter on submitter.id = submission.created_by
      cross join lateral (
        select
          count(*) as item_count,
          count(*) filter (where intent.media_type = 'audio'::media.media_type) as audio_count,
          count(*) filter (where intent.media_type = 'image'::media.media_type) as image_count,
          count(*) filter (where intent.media_type = 'video'::media.media_type) as video_count,
          count(*) filter (where asset.processing_status = 'completed'::media.processing_status) as ready_count,
          count(*) filter (where job.status = 'failed'::media.processing_job_status) as failed_count
        from media.submission_items item
        left join media.upload_intents intent on intent.id = item.upload_intent_id
        left join media.media_assets asset on asset.id = item.media_asset_id
        left join media.media_processing_jobs job on job.id = item.media_processing_job_id
        where item.submission_id = submission.id
      ) counts
      where submission.status = any (wanted)
    ), '[]'::jsonb)
  );
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_admin_submission_detail(p_submission_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  submission media.submissions%rowtype;
  creator_name text;
  submitter_email text;
  catalog jsonb := '{}'::jsonb;
  items jsonb := '[]'::jsonb;
  events jsonb := '[]'::jsonb;
  lyric_sets jsonb := '[]'::jsonb;
  issues jsonb := '[]'::jsonb;
  artwork jsonb;
  localization_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not (select private.is_admin()) then
    raise exception 'Admin role required' using errcode = '42501';
  end if;

  select *
  into submission
  from media.submissions s
  where s.id = p_submission_id;

  if not found then
    raise exception 'Submission not found' using errcode = 'P0002';
  end if;

  select account.display_name
  into creator_name
  from creator.creator_accounts account
  where account.id = submission.creator_account_id;

  select u.email
  into submitter_email
  from auth.users u
  where u.id = submission.created_by;

  if submission.submission_type = 'music_release'::media.submission_type then
    select jsonb_strip_nulls(jsonb_build_object(
      'kind', 'music_release',
      'id', release.id,
      'title', release.title,
      'subtitle', release.subtitle,
      'description', release.description,
      'releaseType', release.release_type,
      'releaseTimingMode', release.release_timing_mode,
      'releaseDate', release.release_date,
      'scheduledReleaseAt', release.scheduled_release_at,
      'originalReleaseDate', release.original_release_date,
      'displayDate', music.release_display_date(
        release.original_release_date, release.scheduled_release_at, release.release_date
      ),
      'tracks', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', track.id,
          'trackNumber', release_track.track_number,
          'discNumber', release_track.disc_number,
          'title', track.title,
          'durationMs', track.duration_ms,
          'publicationStatus', track.publication_status,
          'hasMedia', track.media_asset_id is not null,
          'mainArtist', (
            select credited.display_name
            from music.track_artists track_artist
            join music.artists credited on credited.id = track_artist.artist_id
            where track_artist.track_id = track.id
              and track_artist.role = 'primary'::music.track_artist_role
            limit 1
          ),
          'featuredArtists', coalesce((
            select jsonb_agg(credited.display_name order by track_artist.sort_order)
            from music.track_artists track_artist
            join music.artists credited on credited.id = track_artist.artist_id
            where track_artist.track_id = track.id
              and track_artist.role = 'featured'::music.track_artist_role
          ), '[]'::jsonb)
        ) order by release_track.disc_number, release_track.track_number)
        from music.release_tracks release_track
        join music.tracks track on track.id = release_track.track_id
        where release_track.release_id = release.id
      ), '[]'::jsonb),
      'publicationStatus', release.publication_status,
      'coverAssetId', release.cover_asset_id,
      'artist', jsonb_build_object(
        'id', artist.id,
        'displayName', artist.display_name,
        'publicationStatus', artist.publication_status
      ),
      'localizations', coalesce((
        select jsonb_agg(jsonb_build_object(
          'locale', localization.locale,
          'title', localization.title,
          'subtitle', localization.subtitle,
          'description', localization.description,
          'isPrimary', localization.is_primary,
          'publicationStatus', localization.publication_status
        ) order by localization.is_primary desc, localization.locale)
        from music.release_localizations localization
        where localization.release_id = release.id
      ), '[]'::jsonb),
      'metadata', release.metadata
    ))
    into catalog
    from music.releases release
    left join music.artists artist on artist.id = release.primary_artist_id
    where release.metadata ->> 'submissionId' = submission.id::text
    order by release.created_at desc
    limit 1;
  elsif submission.submission_type = 'learning_album'::media.submission_type then
    select jsonb_strip_nulls(jsonb_build_object(
      'kind', 'learning_album',
      'id', album.id,
      'title', album.title,
      'description', album.description,
      'releaseTimingMode', album.release_timing_mode,
      'scheduledReleaseAt', album.scheduled_release_at,
      'originalReleaseDate', album.original_release_date,
      'displayDate', coalesce(album.original_release_date::timestamptz,
        album.scheduled_release_at,
        (select sub.published_at from media.submissions sub where sub.id=album.submission_id),
        album.created_at),
      'publicationStatus', album.publication_status,
      'coverAssetId', album.cover_asset_id,
      'cantor', jsonb_build_object(
        'id', cantor.id,
        'displayName', cantor.display_name,
        'publicationStatus', cantor.publication_status
      ),
      'season', case when season.id is null then null else jsonb_build_object(
        'id', season.id,
        'title', season.title,
        'slug', season.slug
      ) end,
      'localizations', coalesce((
        select jsonb_agg(jsonb_build_object(
          'locale', localization.locale,
          'title', localization.title,
          'description', localization.description
        ) order by localization.locale)
        from learning.album_localizations localization
        where localization.album_id = album.id
      ), '[]'::jsonb),
      'metadata', album.metadata
    ))
    into catalog
    from learning.albums album
    left join learning.cantors cantor on cantor.id = album.cantor_id
    left join learning.seasons season on season.id = album.season_id
    where album.submission_id = submission.id
    limit 1;
  elsif submission.submission_type = 'learning_lesson_set'::media.submission_type then
    select jsonb_strip_nulls(jsonb_build_object(
      'kind', 'learning_lesson_set',
      'id', lesson_set.id,
      'title', lesson_set.title,
      'description', lesson_set.description,
      'releaseTimingMode', lesson_set.release_timing_mode,
      'scheduledReleaseAt', lesson_set.scheduled_release_at,
      'originalReleaseDate', lesson_set.original_release_date,
      'displayDate', coalesce(lesson_set.original_release_date::timestamptz,
        lesson_set.scheduled_release_at,
        (select sub.published_at from media.submissions sub where sub.id=lesson_set.submission_id),
        lesson_set.created_at),
      'publicationStatus', lesson_set.publication_status,
      'coverAssetId', lesson_set.cover_asset_id,
      'cantor', jsonb_build_object(
        'id', cantor.id,
        'displayName', cantor.display_name,
        'publicationStatus', cantor.publication_status
      ),
      'season', case when season.id is null then null else jsonb_build_object(
        'id', season.id,
        'title', season.title,
        'slug', season.slug
      ) end,
      'hymn', case when hymn.id is null then null else jsonb_build_object(
        'id', hymn.id,
        'title', hymn.title,
        'subtitle', hymn.subtitle,
        'sourceHymnKey', hymn.source_hymn_key
      ) end,
      'localizations', coalesce((
        select jsonb_agg(jsonb_build_object(
          'locale', localization.locale,
          'title', localization.title,
          'description', localization.description
        ) order by localization.locale)
        from learning.lesson_set_localizations localization
        where localization.lesson_set_id = lesson_set.id
      ), '[]'::jsonb),
      'metadata', lesson_set.metadata
    ))
    into catalog
    from learning.lesson_sets lesson_set
    left join learning.cantors cantor on cantor.id = lesson_set.cantor_id
    left join learning.seasons season on season.id = lesson_set.season_id
    left join learning.hymns hymn on hymn.id = lesson_set.hymn_id
    where lesson_set.submission_id = submission.id
    limit 1;
  end if;

  select coalesce(jsonb_agg(
    jsonb_strip_nulls(jsonb_build_object(
      'id', item.id,
      'musicTrackId', item.music_track_id,
      'title', item.title,
      'role', item.role,
      'sortOrder', item.sort_order,
      'required', item.required,
      'uploadIntentId', intent.id,
      'originalFilename', intent.original_filename,
      'mediaType', intent.media_type,
      'contentType', intent.content_type,
      'contentLength', intent.content_length,
      'uploadStatus', intent.status,
      'uploadedAt', intent.uploaded_at,
      'previewPath', case
        when intent.id is not null and intent.status = 'uploaded'::media.upload_intent_status
          then '/admin/submission-items/' || item.id::text || '/preview'
        else null
      end,
      'processingJob', case when job.id is null then null else jsonb_build_object(
        'id', job.id,
        'type', job.job_type,
        'status', job.status,
        'attemptCount', job.attempt_count,
        'maxAttempts', job.max_attempts,
        'errorMessage', job.error_message,
        'availableAt', job.available_at,
        'queuedAt', job.queued_at,
        'startedAt', job.started_at,
        'finishedAt', job.finished_at
      ) end,
      'mediaAsset', case when asset.id is null then null else jsonb_build_object(
        'id', asset.id,
        'bucket', asset.bucket,
        'path', asset.path,
        'mediaType', asset.media_type,
        'mimeType', asset.mime_type,
        'durationMs', asset.duration_ms,
        'fileSizeBytes', asset.file_size_bytes,
        'processingStatus', asset.processing_status,
        'publicationStatus', asset.publication_status
      ) end
    ))
    order by item.sort_order, item.created_at
  ), '[]'::jsonb)
  into items
  from media.submission_items item
  left join media.upload_intents intent on intent.id = item.upload_intent_id
  left join media.media_processing_jobs job on job.id = item.media_processing_job_id
  left join media.media_assets asset on asset.id = item.media_asset_id
  where item.submission_id = submission.id;

  -- The artwork the reviewer should actually look at: the delivery cover once
  -- it exists, and the original upload until then.
  select jsonb_strip_nulls(jsonb_build_object(
    'itemId', item.id,
    'title', item.title,
    'originalFilename', intent.original_filename,
    'previewPath', case
      when intent.status = 'uploaded'::media.upload_intent_status
        then '/admin/submission-items/' || item.id::text || '/preview'
      else null
    end,
    'deliveryBucket', asset.bucket,
    'deliveryPath', asset.path,
    'processingStatus', coalesce(asset.processing_status::text, job.status::text)
  ))
  into artwork
  from media.submission_items item
  left join media.upload_intents intent on intent.id = item.upload_intent_id
  left join media.media_assets asset on asset.id = item.media_asset_id
  left join media.media_processing_jobs job on job.id = item.media_processing_job_id
  where item.submission_id = submission.id
    and item.role = 'artwork'::media.submission_item_role
  order by item.created_at desc, item.id desc
  limit 1;

  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'id', event.id,
    'action', event.action,
    'fromStatus', event.from_status,
    'toStatus', event.to_status,
    'notes', event.notes,
    'metadata', nullif(event.metadata, '{}'::jsonb),
    'actorId', event.actor_id,
    'actorEmail', actor.email,
    'createdAt', event.created_at
  )) order by event.created_at desc, event.id desc), '[]'::jsonb)
  into events
  from media.submission_events event
  left join auth.users actor on actor.id = event.actor_id
  where event.submission_id = submission.id;

  -- Lyrics reach a submission through the tracks its delivered audio produced,
  -- so this stays empty until publication creates them.
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', lyric_set.id,
    'trackId', track.id,
    'trackTitle', track.title,
    'locale', lyric_set.locale,
    'kind', lyric_set.kind,
    'syncPrecision', lyric_set.sync_precision,
    'title', lyric_set.title,
    'publicationStatus', lyric_set.publication_status,
    'lineCount', (
      select count(*) from music.lyric_lines line where line.lyric_set_id = lyric_set.id
    ),
    'firstLines', coalesce((
      select jsonb_agg(preview.text order by preview.sequence)
      from (
        select line.sequence, line.text
        from music.lyric_lines line
        where line.lyric_set_id = lyric_set.id
        order by line.sequence
        limit 4
      ) preview
    ), '[]'::jsonb)
  ) order by track.title, lyric_set.locale, lyric_set.kind), '[]'::jsonb)
  into lyric_sets
  from media.submission_items item
  join music.tracks track on track.media_asset_id = item.media_asset_id
  join music.lyric_sets lyric_set on lyric_set.track_id = track.id
  where item.submission_id = submission.id
    and item.media_asset_id is not null;

  select count(*)
  into localization_count
  from jsonb_array_elements(coalesce(catalog -> 'localizations', '[]'::jsonb));

  -- Blocking issues stop a decision; warnings are worth a reviewer's attention
  -- but do not prevent one.
  select coalesce(jsonb_agg(computed.issue order by computed.sort), '[]'::jsonb)
  into issues
  from (
    select 1 as sort, jsonb_build_object(
      'severity', 'blocking',
      'code', 'no_items',
      'message', 'This submission has no files attached.'
    ) as issue
    where not exists (
      select 1 from media.submission_items item where item.submission_id = submission.id
    )

    union all
    select 2, jsonb_build_object(
      'severity', 'blocking',
      'code', 'upload_incomplete',
      'message', count(*) || ' required ' ||
        case when count(*) = 1 then 'file has' else 'files have' end ||
        ' not finished uploading.'
    )
    from media.submission_items item
    left join media.upload_intents intent on intent.id = item.upload_intent_id
    where item.submission_id = submission.id
      and item.required
      and (intent.id is null or intent.status <> 'uploaded'::media.upload_intent_status)
    having count(*) > 0

    union all
    select 3, jsonb_build_object(
      'severity', 'blocking',
      'code', 'processing_failed',
      'message', count(*) || ' ' ||
        case when count(*) = 1 then 'file' else 'files' end ||
        ' failed processing and will not be retried.'
    )
    from media.submission_items item
    join media.media_processing_jobs job on job.id = item.media_processing_job_id
    where item.submission_id = submission.id
      and job.status = 'failed'::media.processing_job_status
    having count(*) > 0

    union all
    select 4, jsonb_build_object(
      'severity', 'blocking',
      'code', 'processing_incomplete',
      'message', count(*) || ' required ' ||
        case when count(*) = 1 then 'file is' else 'files are' end ||
        ' still waiting on processing.'
    )
    from media.submission_items item
    left join media.media_assets asset
      on asset.id = item.media_asset_id
     and asset.processing_status = 'completed'::media.processing_status
    left join media.upload_intents intent on intent.id = item.upload_intent_id
    where item.submission_id = submission.id
      and item.required
      and asset.id is null
      and intent.media_type in (
        'audio'::media.media_type,
        'image'::media.media_type,
        'video'::media.media_type
      )
      and submission.status in (
        'pending_review'::media.publication_status,
        'approved'::media.publication_status,
        'processing'::media.publication_status
      )
    having count(*) > 0

    union all
    select 5, jsonb_build_object(
      'severity', 'warning',
      'code', 'no_artwork',
      'message', 'No artwork was submitted, so this will publish without a cover.'
    )
    where not exists (
      select 1 from media.submission_items item
      where item.submission_id = submission.id
        and item.role = 'artwork'::media.submission_item_role
    )

    union all
    select 6, jsonb_build_object(
      'severity', 'warning',
      'code', 'no_catalog_record',
      'message', 'No catalog record is linked to this submission.'
    )
    where catalog = '{}'::jsonb or catalog is null

    union all
    select 7, jsonb_build_object(
      'severity', 'warning',
      'code', 'no_localizations',
      'message', 'No localized titles were provided.'
    )
    where localization_count = 0
      and catalog <> '{}'::jsonb
      and catalog is not null
  ) computed;

  return jsonb_strip_nulls(jsonb_build_object(
    'id', submission.id,
    'creatorAccountId', submission.creator_account_id,
    'creatorName', creator_name,
    'submitterEmail', submitter_email,
    'submissionType', submission.submission_type,
    'title', submission.title,
    'description', submission.description,
    'status', submission.status,
    'submittedAt', submission.submitted_at,
    'reviewDueAt', submission.review_due_at,
    'dueState', case
      when submission.status <> 'pending_review'::media.publication_status then null
      when submission.review_due_at is null then null
      when submission.review_due_at < now() then 'overdue'
      when submission.review_due_at < now() + interval '12 hours' then 'due_soon'
      else 'on_track'
    end,
    'reviewerId', submission.reviewer_id,
    'reviewedAt', submission.reviewed_at,
    'reviewNotes', submission.review_notes,
    'approvedAt', submission.approved_at,
    'publishedAt', submission.published_at,
    'rejectedAt', submission.rejected_at,
    'createdAt', submission.created_at,
    'updatedAt', submission.updated_at,
    'catalog', coalesce(catalog, '{}'::jsonb),
    'artwork', artwork,
    'items', items,
    'lyricSets', lyric_sets,
    'events', events,
    'validationIssues', issues
  ));
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_admin_submission_preview_item(p_item_id uuid)
 RETURNS TABLE(item_id uuid, submission_id uuid, bucket text, object_path text, content_type text, content_length bigint, original_filename text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not (select private.is_admin()) then
    raise exception 'Admin role required' using errcode = '42501';
  end if;

  return query
  select
    item.id,
    item.submission_id,
    case when intent.original_deleted_at is null then intent.bucket else asset.bucket end,
    case when intent.original_deleted_at is null then intent.path else asset.path end,
    case when intent.original_deleted_at is null then intent.content_type else asset.mime_type end,
    case when intent.original_deleted_at is null then intent.content_length else asset.file_size_bytes end,
    intent.original_filename
  from media.submission_items item
  join media.upload_intents intent on intent.id = item.upload_intent_id
  left join media.media_assets asset on asset.id = item.media_asset_id
  where item.id = p_item_id
    and intent.status = 'uploaded'::media.upload_intent_status
    and (intent.original_deleted_at is null or asset.id is not null);
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_admin_unused_storage_summary()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not (select private.is_admin()) then
    raise exception 'Admin role required' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'count', (select count(*) from media.storage_gc_candidates),
    'bytes', (select coalesce(sum(file_size_bytes), 0) from media.storage_gc_candidates),
    'dueCount', (
      select count(*)
      from media.storage_gc_candidates
      where first_unused_at <= now() - interval '3 days'
    ),
    'oldestUnusedAt', (select min(first_unused_at) from media.storage_gc_candidates)
  );
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_artist_followed(p_artist_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select case
    when auth.uid() is null then false
    else exists (
      select 1
      from music.artist_follows follow
      where follow.user_id = auth.uid()
        and follow.artist_id = p_artist_id
    )
  end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_bible_books()
 RETURNS TABLE(book_key text, book_order integer, testament text, title_english text, title_arabic text, title_coptic text, title_greek text, title_french text, aliases_json jsonb)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select book_key, book_order, testament, title_english, title_arabic, title_coptic, title_greek, title_french, aliases_json
  from bible.books order by book_order;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_bible_chapter(p_book_key text, p_chapter_number integer)
 RETURNS TABLE(verse_number integer, english text, coptic text, arabic text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT verse_number, english, coptic, arabic
  FROM bible.verses
  WHERE book_key = p_book_key AND chapter_number = p_chapter_number
  ORDER BY verse_number;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_bible_chapter_list(p_book_key text)
 RETURNS TABLE(chapter_number integer, verse_count integer)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT chapter_number, COUNT(*)::integer AS verse_count
  FROM bible.verses WHERE book_key = p_book_key
  GROUP BY chapter_number ORDER BY chapter_number;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_calendar_context(p_date date)
 RETURNS json
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT json_build_object(
    'date', p_date::text,
    'coptic', (
      SELECT row_to_json(c) FROM (
        SELECT coptic_year, coptic_month, coptic_month_name, coptic_day,
               weekday_number, coptic_date_key
        FROM calendar.coptic_date_conversions WHERE gregorian_date = p_date
      ) c
    ),
    'active_ranges', (
      SELECT COALESCE(json_agg(range_key ORDER BY range_key), '[]'::json)
      FROM calendar.season_ranges
      WHERE start_date <= p_date AND end_date >= p_date
    ),
    'active_season_dates', (
      SELECT COALESCE(
        json_object_agg(range_key, json_build_object('start', start_date::text, 'end', end_date::text)),
        '{}'::json
      )
      FROM calendar.season_ranges
      WHERE start_date <= p_date AND end_date >= p_date
    ),
    'events_today', (
      SELECT COALESCE(json_agg(event_key ORDER BY event_key), '[]'::json)
      FROM calendar.calendar_event_instances
      WHERE gregorian_date = p_date
    ),
    'saint_flags', (
      SELECT COALESCE(json_agg(DISTINCT f.condition_key ORDER BY f.condition_key), '[]'::json)
      FROM calendar.fixed_coptic_day_flags f
      JOIN calendar.coptic_date_conversions c
        ON c.gregorian_date = p_date
        AND f.coptic_month = c.coptic_month
        AND f.coptic_day = c.coptic_day
    ),
    'key_dates', (
      SELECT COALESCE(json_object_agg(event_key, gregorian_date::text), '{}'::json)
      FROM (
        SELECT DISTINCT ON (event_key) event_key, gregorian_date
        FROM calendar.calendar_event_instances
        WHERE event_key IN (
          'GloriousFeastOfTheResurrection','TheHolyNativityFeast','TheHolyEpiphany',
          'TheHolyPentecostFeast','TheHolyFeastOfAscension','TheNayrouzFeastCopticNewYear',
          'TheFeastOfTheCross','TheFeastOfTheCrossThreeDays',
          'EntryOfOurLordIntoJerusalemHosannaSunday','LazarusSaturday','ThomasSunday',
          'HolyPaschaBegins','JonahsNinevehFastBegins','JonahsNinevehFeast',
          'AssumptionOfStMarysBody','TheApostlesFeastMartyrdomOfStPeterAndStPaul'
        )
        AND gregorian_date BETWEEN p_date - 400 AND p_date + 400
        ORDER BY event_key, ABS(gregorian_date - p_date)
      ) nearest
    )
  )
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_calendar_readings(p_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
AS $function$
declare
  v_coptic_month int;
  v_coptic_day int;
  v_weekday int;
  v_sunday_ord int;
  v_lent_week int := null;
  v_pent_week int := null;
  v_lent_start date;
  v_pent_start date;
  v_result jsonb;
begin
  select coptic_month, coptic_day, weekday_number, sunday_ordinal_in_coptic_month
    into v_coptic_month, v_coptic_day, v_weekday, v_sunday_ord
    from calendar.coptic_date_conversions
   where gregorian_date = p_date;

  if not found then return '[]'::jsonb; end if;

  -- Great Lent: weeks 1..7 span start .. start+48 (Lazarus Saturday and Palm Sunday inclusive).
  select start_date into v_lent_start
    from calendar.season_ranges
   where active_season in ('Lent', 'Great Fast')
     and p_date >= start_date
     and p_date <= start_date + 48
   order by start_date desc
   limit 1;

  if v_lent_start is not null then
    v_lent_week := ceil((p_date - v_lent_start + 1)::numeric / 7);
  end if;

  select start_date into v_pent_start
    from calendar.season_ranges
   where active_season = 'Holy 50 Days'
     and p_date between start_date and coalesce(end_date, p_date)
   limit 1;

  if v_pent_start is not null then
    v_pent_week := case
      when p_date = v_pent_start then 0
      else ceil((p_date - v_pent_start)::numeric / 7)
    end;
  end if;

  with candidates as (
    select rr.*
      from calendar.reading_rules rr
     where (
       (rr.cycle_type = 'AnnualDaily'
          and rr.coptic_month = v_coptic_month
          and rr.coptic_day = v_coptic_day)
       or
       (rr.cycle_type = 'AnnualSunday'
          and v_weekday = 0
          and rr.coptic_month = v_coptic_month
          and rr.sunday_ordinal = v_sunday_ord
          and (rr.day_of_week is null or rr.day_of_week = v_weekday))
       or
       (rr.cycle_type = 'GreatLent'
          and v_lent_week is not null
          and rr.lent_week = v_lent_week
          and (rr.day_of_week is null or rr.day_of_week = v_weekday))
       or
       (rr.cycle_type = 'Pentecost'
          and v_pent_week is not null
          and rr.pentecost_week = v_pent_week
          and (rr.day_of_week is null or rr.day_of_week = v_weekday))
     )
  ),
  winners as (
    select distinct on (c.service, c.reading_type) c.service, c.reading_type, c.cycle_type, c.priority
      from candidates c
     order by c.service, c.reading_type, c.priority desc
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'service', c.service,
      'reading_type', c.reading_type,
      'reading_code', c.reading_code,
      'reading_reference', c.reading_reference,
      'cycle_type', c.cycle_type,
      'priority', c.priority,
      'sunday_message', c.sunday_message
    ) order by c.service, c.reading_type,
               coalesce(substring(c.reading_code from '(\d+)$')::int, 0), c.reading_code
  ), '[]'::jsonb)
  into v_result
  from candidates c
  join winners w
    on w.service = c.service
   and w.reading_type = c.reading_type
   and w.cycle_type is not distinct from c.cycle_type
   and w.priority is not distinct from c.priority;

  return v_result;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_creator_artist_profile(p_creator_account_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  artist_record music.artists%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not (select private.can_edit_creator_account(p_creator_account_id)) then
    raise exception 'Not authorized for creator account' using errcode = '42501';
  end if;

  select artist.*
  into artist_record
  from creator.creator_accounts account
  join music.artists artist on artist.id = account.identity_artist_id
  where account.id = p_creator_account_id;

  if not found then
    raise exception 'This account has no artist identity yet' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'id', artist_record.id,
    'displayName', artist_record.display_name,
    'sortName', artist_record.sort_name,
    'biography', artist_record.biography,
    'publicationStatus', artist_record.publication_status,
    'profileImage', (
      select jsonb_build_object(
        'assetId', asset.id,
        'bucket', asset.bucket,
        'path', asset.path,
        'version', extract(epoch from asset.updated_at)::bigint
      )
      from media.media_assets asset
      where asset.id = artist_record.profile_image_asset_id
    ),
    'profileImagePending', artist_record.metadata ->> 'pendingProfileImageUploadIntentId',
    'socialLinks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', link.id,
        'platform', link.platform,
        'label', link.label,
        'url', link.url
      ) order by link.sort_order, link.platform)
      from music.artist_social_links link
      where link.artist_id = artist_record.id
    ), '[]'::jsonb),
    'pinnedReleases', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', release.id,
        'title', release.title,
        'releaseType', release.release_type,
        'publicationStatus', release.publication_status,
        'displayDate', music.release_display_date(
          release.original_release_date, release.scheduled_release_at, release.release_date
        )
      ) order by pinned.sort_order)
      from music.artist_pinned_releases pinned
      join music.releases release on release.id = pinned.release_id
      where pinned.artist_id = artist_record.id
    ), '[]'::jsonb),
    'releases', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', release.id,
        'title', release.title,
        'releaseType', release.release_type,
        'publicationStatus', release.publication_status,
        'displayDate', music.release_display_date(
          release.original_release_date, release.scheduled_release_at, release.release_date
        )
      ) order by release.created_at desc)
      from music.releases release
      where release.owner_creator_account_id = p_creator_account_id
    ), '[]'::jsonb)
  );
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_creator_catalog_options()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  return jsonb_build_object(
    'seasons', coalesce((
      select jsonb_agg(jsonb_build_object('id', season.id, 'title', season.title, 'titleArabic', (select sl.title from learning.season_localizations sl where sl.season_id=season.id and sl.locale='ar'), 'subtitle', season.slug)
        order by season.sort_order, season.title)
      from learning.seasons season
      where season.publication_status = 'published'::media.publication_status
    ), '[]'::jsonb),
    'hymns', coalesce((
      select jsonb_agg(jsonb_build_object('id', hymn.id, 'title', hymn.title, 'subtitle', hymn.subtitle)
        order by hymn.title)
      from learning.hymns hymn
      where (hymn.publication_status = 'published'::media.publication_status
           or hymn.created_by=auth.uid())
    ), '[]'::jsonb)
  );
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_creator_credit_options(p_creator_account_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_identity_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not (select private.can_edit_creator_account(p_creator_account_id)) then
    raise exception 'Not authorized for creator account' using errcode = '42501';
  end if;

  select account.identity_artist_id into v_identity_id
  from creator.creator_accounts account
  where account.id = p_creator_account_id;

  return jsonb_build_object(
    'identityArtist', (
      select jsonb_build_object('id', artist.id, 'displayName', artist.display_name)
      from music.artists artist where artist.id = v_identity_id
    ),
    'creditableArtists', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', artist.id,
        'displayName', artist.display_name,
        'isCreditOnly', artist.is_credit_only
      ) order by artist.is_credit_only, artist.display_name)
      from music.artists artist
      where artist.id = v_identity_id
         or artist.is_credit_only
    ), '[]'::jsonb)
  );
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_creator_dashboard(p_creator_account_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not (select private.can_read_media_owner(p_creator_account_id)) then
    raise exception 'Not authorized for creator account' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'submissions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', submission.id,
        'submissionType', submission.submission_type,
        'title', submission.title,
        'description', submission.description,
        'status', submission.status,
        'submittedAt', submission.submitted_at,
        'reviewDueAt', submission.review_due_at,
        'reviewNotes', submission.review_notes,
        'publishedAt', submission.published_at,
        'createdAt', submission.created_at,
        'updatedAt', submission.updated_at,
        'itemCount', (
          select count(*) from media.submission_items item where item.submission_id = submission.id
        )
      ) order by submission.updated_at desc)
      from media.submissions submission
      where submission.creator_account_id = p_creator_account_id
    ), '[]'::jsonb),
    'artists', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', artist.id,
        'title', artist.display_name,
        'subtitle', artist.publication_status
      ) order by lower(artist.display_name))
      from music.artists artist
      where artist.owner_creator_account_id = p_creator_account_id
    ), '[]'::jsonb),
    'cantors', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', cantor.id,
        'title', cantor.display_name,
        'subtitle', cantor.publication_status,
        'kind', case
          when lower(coalesce(cantor.metadata ->> 'contributorType', 'cantor')) = 'chorus' then 'chorus'
          else 'cantor'
        end
      ) order by lower(cantor.display_name))
      from learning.cantors cantor
      where cantor.publication_status = 'published'::media.publication_status
         or private.learning_cantor_is_editable(cantor.id)
    ), '[]'::jsonb)
  );
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_creator_release(p_release_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  release_record music.releases%rowtype;
  identity_artist_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select *
  into release_record
  from music.releases release
  where release.id = p_release_id;

  if not found then
    raise exception 'Release not found' using errcode = 'P0002';
  end if;

  if not (select private.can_edit_creator_account(release_record.owner_creator_account_id)) then
    raise exception 'Not authorized for this release' using errcode = '42501';
  end if;

  select account.identity_artist_id
  into identity_artist_id
  from creator.creator_accounts account
  where account.id = release_record.owner_creator_account_id;

  return jsonb_build_object(
    'id', release_record.id,
    'title', release_record.title,
    'subtitle', release_record.subtitle,
    'description', release_record.description,
    'releaseType', release_record.release_type,
    'publicationStatus', release_record.publication_status,
    'musicType', release_record.metadata ->> 'musicType',
    'recordingType', release_record.metadata ->> 'recordingType',
    'releaseTimingMode', release_record.release_timing_mode,
    'scheduledReleaseAt', release_record.scheduled_release_at,
    'originalReleaseDate', release_record.original_release_date,
    'displayDate', music.release_display_date(
      release_record.original_release_date,
      release_record.scheduled_release_at,
      release_record.release_date
    ),
    'earliestReleaseAt', public.earliest_release_at(),
    'primaryArtist', (
      select jsonb_build_object('id', artist.id, 'displayName', artist.display_name)
      from music.artists artist
      where artist.id = release_record.primary_artist_id
    ),
    'cover', private.creator_release_preview_cover(release_record.id),
    'localizations', coalesce((
      select jsonb_agg(
        jsonb_build_object('locale', localization.locale, 'title', localization.title)
        order by localization.is_primary desc, localization.locale
      )
      from music.release_localizations localization
      where localization.release_id = release_record.id
    ), '[]'::jsonb),
    'tracks', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', track.id,
          'trackNumber', release_track.track_number,
          'discNumber', release_track.disc_number,
          'title', track.title,
          'durationMs', track.duration_ms,
          'publicationStatus', track.publication_status,
          'hasMedia', track.media_asset_id is not null,
          'localizedTitle', jsonb_build_object(
            'en', coalesce((select localization.title from music.track_localizations localization where localization.track_id = track.id and localization.locale = 'en' limit 1), ''),
            'ar', coalesce((select localization.title from music.track_localizations localization where localization.track_id = track.id and localization.locale = 'ar' limit 1), ''),
            'cop', coalesce((select localization.title from music.track_localizations localization where localization.track_id = track.id and localization.locale = 'cop' limit 1), ''),
            'fr', coalesce((select localization.title from music.track_localizations localization where localization.track_id = track.id and localization.locale = 'fr' limit 1), '')
          ),
          'mainArtistName', coalesce((
            select case when artist.id = identity_artist_id then '' else artist.display_name end
            from music.track_artists track_artist
            join music.artists artist on artist.id = track_artist.artist_id
            where track_artist.track_id = track.id
              and track_artist.role = 'primary'::music.track_artist_role
            order by track_artist.sort_order
            limit 1
          ), ''),
          'contributors', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', track_artist.artist_id::text || ':' || track_artist.role::text,
                'name', artist.display_name,
                'role', track_artist.role::text
              )
              order by track_artist.sort_order, artist.display_name
            )
            from music.track_artists track_artist
            join music.artists artist on artist.id = track_artist.artist_id
            where track_artist.track_id = track.id
              and track_artist.role <> 'primary'::music.track_artist_role
          ), '[]'::jsonb),
          'mainArtist', (
            select jsonb_build_object('id', artist.id, 'displayName', artist.display_name)
            from music.track_artists track_artist
            join music.artists artist on artist.id = track_artist.artist_id
            where track_artist.track_id = track.id
              and track_artist.role = 'primary'::music.track_artist_role
            order by track_artist.sort_order
            limit 1
          ),
          'featuredArtists', coalesce((
            select jsonb_agg(
              jsonb_build_object('id', artist.id, 'displayName', artist.display_name)
              order by track_artist.sort_order
            )
            from music.track_artists track_artist
            join music.artists artist on artist.id = track_artist.artist_id
            where track_artist.track_id = track.id
              and track_artist.role = 'featured'::music.track_artist_role
          ), '[]'::jsonb)
        )
        order by release_track.disc_number, release_track.track_number
      )
      from music.release_tracks release_track
      join music.tracks track on track.id = release_track.track_id
      where release_track.release_id = release_record.id
    ), '[]'::jsonb)
  );
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_creator_releases(p_creator_account_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not (select private.can_edit_creator_account(p_creator_account_id)) then
    raise exception 'Not authorized for creator account' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', release.id,
        'title', release.title,
        'releaseType', release.release_type,
        'publicationStatus', release.publication_status,
        'musicType', release.metadata ->> 'musicType',
        'recordingType', release.metadata ->> 'recordingType',
        'releaseTimingMode', release.release_timing_mode,
        'scheduledReleaseAt', release.scheduled_release_at,
        'originalReleaseDate', release.original_release_date,
        'displayDate', music.release_display_date(
          release.original_release_date,
          release.scheduled_release_at,
          release.release_date
        ),
        'submissionId', submission.id,
        'submissionStatus', submission.status,
        'mediaReady', case
          when submission.id is null then release.publication_status = 'published'::media.publication_status
          else private.submission_required_items_ready(submission.id)
        end,
        'trackCount', (
          select count(*)::integer
          from music.release_tracks release_track
          where release_track.release_id = release.id
        ),
        'cover', private.creator_release_preview_cover(release.id),
        'releaseState', case
          when release.publication_status = 'published'::media.publication_status then 'released'
          else 'ready'
        end
      )
      order by
        case when release.publication_status = 'published'::media.publication_status then 1 else 0 end,
        coalesce(release.scheduled_release_at, release.created_at) asc,
        release.created_at desc
    )
    from music.releases release
    left join media.submissions submission
      on submission.id = nullif(release.metadata ->> 'submissionId', '')::uuid
    where release.owner_creator_account_id = p_creator_account_id
      and (
        release.publication_status = 'published'::media.publication_status
        or (
          submission.status = 'approved'::media.publication_status
          and private.submission_required_items_ready(submission.id)
        )
      )
  ), '[]'::jsonb);
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_creator_submission_items(p_submission_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not exists (select 1 from media.submissions submission where submission.id = p_submission_id) then
    raise exception 'Submission not found' using errcode = 'P0002';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', item.id,
      'title', item.title,
      'role', item.role,
      'sortOrder', item.sort_order,
      'required', item.required,
      'mediaAssetId', item.media_asset_id,
      'uploadIntentId', item.upload_intent_id,
      'mediaType', intent.media_type,
      'contentLength', intent.content_length,
      'uploadStatus', intent.status,
      'processingStatus', job.status,
      'processingJobType', job.job_type,
      'processingAttemptCount', job.attempt_count,
      'processingMaxAttempts', job.max_attempts,
      'processingError', job.error_message,
      'processingAvailableAt', job.available_at,
      'processingProgress', job.progress
    ) order by item.sort_order, item.created_at)
    from media.submission_items item
    left join media.upload_intents intent on intent.id = item.upload_intent_id
    -- Read the live job for this upload rather than the one stamped on the
    -- item, so a queued/processing/failed job is visible before it completes.
    left join lateral (
      select
        pending_job.status,
        pending_job.job_type,
        pending_job.attempt_count,
        pending_job.max_attempts,
        pending_job.error_message,
        pending_job.available_at,
        pending_job.progress
      from media.media_processing_jobs pending_job
      where pending_job.upload_intent_id = item.upload_intent_id
      order by
        case
          when pending_job.job_type = case intent.media_type
            when 'video'::media.media_type then 'video_delivery'::media.processing_job_type
            when 'image'::media.media_type then 'image_delivery'::media.processing_job_type
            else 'audio_delivery'::media.processing_job_type
          end then 0
          else 1
        end,
        case pending_job.status
          when 'completed'::media.processing_job_status then 0
          when 'processing'::media.processing_job_status then 1
          when 'queued'::media.processing_job_status then 2
          else 3
        end,
        pending_job.created_at desc
      limit 1
    ) job on true
    where item.submission_id = p_submission_id
  ), '[]'::jsonb);
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_creator_workspaces()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  request_user_id uuid := auth.uid();
begin
  if request_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', account.id,
      'displayName', account.display_name,
      'status', account.status,
      'role', member.role
    ) order by member.created_at)
    from creator.creator_account_members member
    join creator.creator_accounts account on account.id = member.creator_account_id
    where member.user_id = request_user_id
  ), '[]'::jsonb);
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_home_synaxarium_events(p_date date)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'entryKey', e.entry_key,
      'titleEnglish', e.title_english,
      'titleArabic', e.title_arabic,
      'entryOrder', e.entry_order
    )
    order by e.entry_order
  ), '[]'::jsonb)
  from calendar.coptic_date_conversions d
  join synaxarium.entries e
    on e.coptic_month = d.coptic_month
   and e.coptic_day = d.coptic_day
  where d.gregorian_date = p_date;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_inline_hymn(p_schema text, p_hymn_key text)
 RETURNS TABLE(line_order double precision, english text, coptic text, arabic text, person_type text, prayer_type text, line_condition text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_schema NOT IN (
    'psalmody','liturgy','agpeya','doxologies','veneration',
    'canons','holy_week','litanies','gospel_responses','gospel_rite',
    'praxis_response','verses_of_the_cymbals','hymn_of_the_intercessions',
    'seasonal_liturgy_hymns'
  ) THEN
    RAISE EXCEPTION 'Schema not allowed: %', p_schema;
  END IF;
  RETURN QUERY EXECUTE format(
    'SELECT line_order::float8, english, coptic, arabic,
            person_type::text, prayer_type::text, condition
     FROM %I.hymn_texts WHERE hymn_key = %L
     UNION ALL
     SELECT line_order::float8, english, coptic, arabic,
            person_type::text, prayer_type::text, condition
     FROM public.hymn_texts WHERE hymn_key = %L
       AND NOT EXISTS (SELECT 1 FROM %I.hymn_texts WHERE hymn_key = %L)
     ORDER BY 1',
    p_schema, p_hymn_key,
    p_hymn_key, p_schema, p_hymn_key
  );
END;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_learning_home(p_locale text DEFAULT 'en'::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select jsonb_build_object(
    'cantors', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'displayName', coalesce(cl.display_name, c.display_name),
        'biography', coalesce(cl.biography, c.biography),
        'profileImageAsset', case when ma.id is null then null else jsonb_build_object(
          'id', ma.id, 'provider', ma.provider, 'bucket', ma.bucket, 'path', ma.path,
          'mimeType', ma.mime_type, 'fileSizeBytes', ma.file_size_bytes, 'checksum', ma.checksum
        ) end
      ) order by coalesce(c.sort_name, cl.display_name, c.display_name))
      from learning.cantors c
      left join learning.cantor_localizations cl on cl.cantor_id = c.id and cl.locale = p_locale
      left join media.media_assets ma on ma.id = c.profile_image_asset_id and ma.publication_status = 'published'
      where c.publication_status = 'published'
    ), '[]'::jsonb),
    'seasons', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'slug', s.slug, 'title', coalesce(sl.title, s.title),
        'description', coalesce(sl.description, s.description), 'sortOrder', s.sort_order
      ) order by s.sort_order, coalesce(sl.title, s.title))
      from learning.seasons s
      left join learning.season_localizations sl on sl.season_id = s.id and sl.locale = p_locale
      where s.publication_status = 'published'
    ), '[]'::jsonb)
  );
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_learning_lyric_editor_items()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_learning_lyric_language_draft(p_item_kind learning.playlist_item_kind, p_item_id uuid, p_locale text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare draft learning.lyric_edit_drafts%rowtype; lyric_set learning.lyric_sets%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if not private.learning_lyric_item_is_editable(p_item_kind,p_item_id) then raise exception 'Learning item not editable' using errcode='42501'; end if;
  select * into draft from learning.lyric_edit_drafts d where d.item_kind=p_item_kind
    and coalesce(d.album_recording_id,d.lesson_id)=p_item_id and d.locale=p_locale;
  select * into lyric_set from learning.lyric_sets s where s.item_kind=p_item_kind
    and coalesce(s.album_recording_id,s.lesson_id)=p_item_id and s.locale=p_locale;
  if draft.locale is not null then
    return jsonb_build_object('id',lyric_set.id,'trackId',p_item_id,'locale',p_locale,
      'description',draft.description,'publicationStatus',coalesce(lyric_set.publication_status,'draft'::media.publication_status),
      'hasDraft',true,'syncPrecision',draft.sync_precision,'lines',draft.lines);
  end if;
  if lyric_set.id is null then return null; end if;
  return jsonb_build_object('id',lyric_set.id,'trackId',p_item_id,'locale',p_locale,
    'description',lyric_set.description,'publicationStatus',lyric_set.publication_status,'hasDraft',false,
    'syncPrecision',lyric_set.sync_precision,'lines',coalesce((select jsonb_agg(jsonb_build_object(
      'id',line.id,'sequence',line.sequence,'startMs',line.start_ms,'endMs',line.end_ms,'text',line.text
    ) order by line.sequence) from learning.lyric_lines line where line.lyric_set_id=lyric_set.id),'[]'::jsonb));
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_learning_playlist(p_playlist_id uuid, p_locale text DEFAULT 'en'::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_lyric_editor_tracks()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_media_upload_intent_for_upload(p_upload_intent_id uuid)
 RETURNS TABLE(upload_intent_id uuid, creator_account_id uuid, bucket text, object_path text, content_type text, content_length bigint, media_type media.media_type, checksum_sha256 text, expires_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    intent.id,
    intent.creator_account_id,
    intent.bucket,
    intent.path,
    intent.content_type,
    intent.content_length,
    intent.media_type,
    intent.checksum_sha256,
    intent.upload_expires_at
  from media.upload_intents intent
  where intent.id = p_upload_intent_id
    and intent.requested_by = (select auth.uid())
    and intent.status = 'authorized'::media.upload_intent_status
    and intent.upload_expires_at > now()
    and (select private.can_edit_creator_account(intent.creator_account_id));
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_media_worker_image_context(p_worker_token text, p_upload_intent_id uuid)
 RETURNS TABLE(is_profile_image boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.verify_media_worker_token(p_worker_token) then
    raise exception 'Invalid media worker token' using errcode = '28000';
  end if;

  return query
  select exists (
    select 1
    from music.artists artist
    left join media.media_assets asset on asset.id = artist.profile_image_asset_id
    where artist.metadata ->> 'pendingProfileImageUploadIntentId' = p_upload_intent_id::text
       or asset.metadata ->> 'sourceUploadIntentId' = p_upload_intent_id::text
  );
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_music_artist_search_art(p_artist_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select case when cover.id is null then null else jsonb_build_object(
    'id', cover.id,
    'provider', cover.provider,
    'bucket', cover.bucket,
    'path', cover.path,
    'mimeType', cover.mime_type,
    'fileSizeBytes', cover.file_size_bytes,
    'checksum', cover.checksum
  ) end
  from music.track_artists track_artist
  join music.release_tracks release_track
    on release_track.track_id = track_artist.track_id
  join music.releases release
    on release.id = release_track.release_id
   and release.publication_status = 'published'::media.publication_status
  join media.media_assets cover
    on cover.id = release.cover_asset_id
   and cover.publication_status = 'published'::media.publication_status
  where track_artist.artist_id = p_artist_id
  order by release.scheduled_release_at desc nulls last,
    release.release_date desc nulls last,
    release_track.disc_number,
    release_track.track_number
  limit 1;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_music_home(p_locale text DEFAULT 'en'::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'latestReleases', coalesce((
      select jsonb_agg(release_row.payload order by release_row.release_date desc nulls last, release_row.title)
      from (
        select
          release.release_date,
          coalesce(release_localization.title, release.title) as title,
          jsonb_build_object(
            'id', release.id,
            'title', coalesce(release_localization.title, release.title),
            'subtitle', coalesce(release_localization.subtitle, release.subtitle),
            'releaseType', release.release_type,
            'releaseDate', music.release_display_date(release.original_release_date, release.scheduled_release_at, release.release_date),
            'primaryArtist', case
              when artist.id is null then null
              else jsonb_build_object(
                'id', artist.id,
                'displayName', coalesce(artist_localization.display_name, artist.display_name)
              )
            end,
            'coverAsset', case
              when cover.id is null then null
              else jsonb_build_object(
                'id', cover.id,
                'provider', cover.provider,
                'bucket', cover.bucket,
                'path', cover.path,
                'mimeType', cover.mime_type
              )
            end
          ) as payload
        from music.releases release
        left join music.release_localizations release_localization
          on release_localization.release_id = release.id
         and release_localization.locale = p_locale
         and release_localization.publication_status = 'published'::media.publication_status
        left join music.artists artist
          on artist.id = release.primary_artist_id
         and artist.publication_status = 'published'::media.publication_status
        left join music.artist_localizations artist_localization
          on artist_localization.artist_id = artist.id
         and artist_localization.locale = p_locale
         and artist_localization.publication_status = 'published'::media.publication_status
        left join media.media_assets cover
          on cover.id = release.cover_asset_id
         and cover.publication_status = 'published'::media.publication_status
        where release.publication_status = 'published'::media.publication_status
        order by release.release_date desc nulls last, release.created_at desc
        limit 24
      ) release_row
    ), '[]'::jsonb),
    'artists', coalesce((
      select jsonb_agg(artist_row.payload order by artist_row.display_name)
      from (
        select
          coalesce(artist_localization.display_name, artist.display_name) as display_name,
          jsonb_build_object(
            'id', artist.id,
            'displayName', coalesce(artist_localization.display_name, artist.display_name),
            'biography', coalesce(artist_localization.biography, artist.biography),
            'profileImageAsset', case
              when image.id is null then null
              else jsonb_build_object(
                'id', image.id,
                'provider', image.provider,
                'bucket', image.bucket,
                'path', image.path,
                'mimeType', image.mime_type
              )
            end
          ) as payload
        from music.artists artist
        left join music.artist_localizations artist_localization
          on artist_localization.artist_id = artist.id
         and artist_localization.locale = p_locale
         and artist_localization.publication_status = 'published'::media.publication_status
        left join media.media_assets image
          on image.id = artist.profile_image_asset_id
         and image.publication_status = 'published'::media.publication_status
        where artist.publication_status = 'published'::media.publication_status
        order by coalesce(artist_localization.display_name, artist.display_name)
        limit 24
      ) artist_row
    ), '[]'::jsonb)
  );
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_music_playlist(p_playlist_id uuid, p_locale text DEFAULT 'en'::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'id', playlist.id,
    'name', playlist.name,
    'description', playlist.description,
    'visibility', playlist.visibility,
    'isOwner', playlist.owner_user_id = auth.uid(),
    'ownerUserId', case when playlist.owner_user_id = auth.uid() then playlist.owner_user_id else null end,
    'hasCustomCover', playlist.cover_asset_id is not null,
    'coverAsset', case when cover.id is null then null else jsonb_build_object(
      'id', cover.id,
      'provider', cover.provider,
      'bucket', cover.bucket,
      'path', case
        when cover.provider = 'external'::media.media_provider and cover.bucket = 'playlist-covers'
          then cover.path || case when position('?' in cover.path) > 0 then '&v=' else '?v=' end || cover.version::text
        else cover.path
      end,
      'mimeType', cover.mime_type,
      'fileSizeBytes', cover.file_size_bytes,
      'version', cover.version
    ) end,
    'tracks', coalesce((
      select jsonb_agg(track_row.payload order by track_row.sort_order, track_row.created_at)
      from (
        select
          playlist_track.sort_order,
          playlist_track.created_at,
          jsonb_build_object(
            'id', track.id,
            'title', coalesce(track_localization.title, track.title),
            'subtitle', coalesce(track_localization.subtitle, track.subtitle),
            'durationMs', track.duration_ms,
            'releaseId', release_track.release_id,
            'mediaAsset', jsonb_build_object(
              'id', asset.id,
              'provider', asset.provider,
              'bucket', asset.bucket,
              'path', asset.path,
              'mimeType', asset.mime_type,
              'fileSizeBytes', asset.file_size_bytes,
              'version', asset.version
            ),
            'artists', coalesce((
              select jsonb_agg(jsonb_build_object(
                'id', artist.id,
                'displayName', coalesce(artist_localization.display_name, artist.display_name),
                'role', track_artist.role,
                'sortOrder', track_artist.sort_order
              ) order by track_artist.sort_order, artist.display_name)
              from music.track_artists track_artist
              join music.artists artist
                on artist.id = track_artist.artist_id
               and artist.publication_status = 'published'::media.publication_status
              left join music.artist_localizations artist_localization
                on artist_localization.artist_id = artist.id
               and artist_localization.locale = p_locale
               and artist_localization.publication_status = 'published'::media.publication_status
              where track_artist.track_id = track.id
            ), '[]'::jsonb)
          ) as payload
        from music.playlist_tracks playlist_track
        join music.tracks track
          on track.id = playlist_track.track_id
         and track.publication_status = 'published'::media.publication_status
        join media.media_assets asset
          on asset.id = track.media_asset_id
         and asset.publication_status = 'published'::media.publication_status
        left join music.track_localizations track_localization
          on track_localization.track_id = track.id
         and track_localization.locale = p_locale
         and track_localization.publication_status = 'published'::media.publication_status
        left join lateral (
          select release_track.release_id
          from music.release_tracks release_track
          join music.releases release
            on release.id = release_track.release_id
           and release.publication_status = 'published'::media.publication_status
          where release_track.track_id = track.id
          order by release_track.created_at
          limit 1
        ) release_track on true
        where playlist_track.playlist_id = playlist.id
      ) track_row
    ), '[]'::jsonb)
  )
  from music.playlists playlist
  left join lateral (
    select asset.*
    from (
      select
        playlist.cover_asset_id as asset_id,
        0 as priority,
        0 as sort_order,
        playlist.created_at as ordered_at
      union all
      select
        release.cover_asset_id as asset_id,
        1 as priority,
        playlist_track.sort_order,
        playlist_track.created_at as ordered_at
      from music.playlist_tracks playlist_track
      join music.release_tracks release_track
        on release_track.track_id = playlist_track.track_id
      join music.releases release
        on release.id = release_track.release_id
       and release.publication_status = 'published'::media.publication_status
      where playlist_track.playlist_id = playlist.id
    ) candidate
    join media.media_assets asset
      on asset.id = candidate.asset_id
     and asset.publication_status = 'published'::media.publication_status
    order by candidate.priority, candidate.sort_order, candidate.ordered_at
    limit 1
  ) cover on true
  where playlist.id = p_playlist_id;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_music_playlist_share_preview(p_playlist_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'title', playlist.name,
    'description', coalesce(
      nullif(trim(playlist.description), ''),
      'Listen to ' || playlist.name || ' on Coptic Vine.'
    ),
    'imageAsset', case when cover.id is null then null else jsonb_build_object(
      'id', cover.id,
      'provider', cover.provider,
      'bucket', cover.bucket,
      'path', case
        when cover.provider = 'external'::media.media_provider and cover.bucket = 'playlist-covers'
          then cover.path || case when position('?' in cover.path) > 0 then '&v=' else '?v=' end || cover.version::text
        else cover.path
      end,
      'mimeType', cover.mime_type,
      'version', cover.version
    ) end
  )
  from music.playlists playlist
  left join lateral (
    select asset.*
    from (
      select
        playlist.cover_asset_id as asset_id,
        0 as priority,
        0 as sort_order,
        playlist.created_at as ordered_at
      union all
      select
        release.cover_asset_id as asset_id,
        1 as priority,
        playlist_track.sort_order,
        playlist_track.created_at as ordered_at
      from music.playlist_tracks playlist_track
      join music.release_tracks release_track
        on release_track.track_id = playlist_track.track_id
      join music.releases release
        on release.id = release_track.release_id
       and release.publication_status = 'published'::media.publication_status
      where playlist_track.playlist_id = playlist.id
    ) candidate
    join media.media_assets asset
      on asset.id = candidate.asset_id
     and asset.publication_status = 'published'::media.publication_status
    order by candidate.priority, candidate.sort_order, candidate.ordered_at
    limit 1
  ) cover on true
  where playlist.id = p_playlist_id
    and playlist.visibility = 'public'::music.playlist_visibility;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_my_content_preferences()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  request_user_id uuid := auth.uid();
  payload jsonb;
begin
  if request_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select jsonb_build_object(
    'exists', true,
    'preferences', account_preferences.preferences,
    'bookmarks', to_jsonb(account_preferences.bookmarks),
    'updatedAt', account_preferences.updated_at
  )
  into payload
  from public.user_content_preferences account_preferences
  where account_preferences.user_id = request_user_id;

  return coalesce(payload, jsonb_build_object(
    'exists', false,
    'preferences', '{}'::jsonb,
    'bookmarks', '[]'::jsonb,
    'updatedAt', null
  ));
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_my_learning_items(p_locale text DEFAULT 'en'::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_my_learning_playlists(p_locale text DEFAULT 'en'::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select jsonb_build_object(
    'authenticated', auth.uid() is not null,
    'playlists', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'description', p.description, 'visibility', p.visibility,
        'itemCount', (select count(*) from learning.playlist_items pi where pi.playlist_id = p.id)
      ) order by p.updated_at desc)
      from learning.playlists p
      where p.owner_user_id = auth.uid()
    ), '[]'::jsonb)
  );
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_my_learning_progress(p_locale text DEFAULT 'en'::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select jsonb_build_object(
    'authenticated', auth.uid() is not null,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'hymnId', hp.hymn_id,
        'state', hp.state,
        'title', coalesce(hl.title, h.title),
        'subtitle', coalesce(hl.subtitle, h.subtitle),
        'startedAt', hp.started_at,
        'finishedAt', hp.finished_at,
        'updatedAt', hp.updated_at
      ) order by hp.updated_at desc)
      from learning.hymn_progress hp
      join learning.hymns h on h.id = hp.hymn_id and h.publication_status = 'published'
      left join learning.hymn_localizations hl on hl.hymn_id = h.id and hl.locale = p_locale
      where hp.user_id = auth.uid()
    ), '[]'::jsonb)
  );
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_my_music_library(p_locale text DEFAULT 'en'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  request_user_id uuid := auth.uid();
  payload jsonb;
  recent_tracks jsonb := '[]'::jsonb;
  recent_releases jsonb := '[]'::jsonb;
begin
  if request_user_id is null then
    return jsonb_build_object(
      'authenticated', false,
      'followedArtists', '[]'::jsonb,
      'likedReleases', '[]'::jsonb,
      'likedTracks', '[]'::jsonb,
      'playlists', '[]'::jsonb,
      'recentTracks', '[]'::jsonb,
      'recentReleases', '[]'::jsonb
    );
  end if;

  select jsonb_build_object(
    'authenticated', true,
    'followedArtists', coalesce((
      select jsonb_agg(followed.payload order by followed.created_at desc)
      from (
        select
          artist_follow.created_at,
          jsonb_build_object(
            'id', artist.id,
            'displayName', coalesce(artist_localization.display_name, artist.display_name),
            'biography', coalesce(artist_localization.biography, artist.biography),
            'profileImageAsset', case when profile_image.id is null then null else jsonb_build_object(
              'id', profile_image.id,
              'provider', profile_image.provider,
              'bucket', profile_image.bucket,
              'path', profile_image.path,
              'mimeType', profile_image.mime_type,
              'version', profile_image.version
            ) end
          ) as payload
        from music.artist_follows artist_follow
        join music.artists artist
          on artist.id = artist_follow.artist_id
         and artist.publication_status = 'published'::media.publication_status
        left join music.artist_localizations artist_localization
          on artist_localization.artist_id = artist.id
         and artist_localization.locale = p_locale
         and artist_localization.publication_status = 'published'::media.publication_status
        left join media.media_assets profile_image
          on profile_image.id = artist.profile_image_asset_id
         and profile_image.publication_status = 'published'::media.publication_status
        where artist_follow.user_id = request_user_id
      ) followed
    ), '[]'::jsonb),
    'likedReleases', coalesce((
      select jsonb_agg(liked.payload order by liked.created_at desc)
      from (
        select
          release_like.created_at,
          jsonb_build_object(
            'id', release.id,
            'title', coalesce(release_localization.title, release.title),
            'subtitle', coalesce(release_localization.subtitle, release.subtitle),
            'releaseType', release.release_type,
            'releaseDate', music.release_display_date(
              release.original_release_date,
              release.scheduled_release_at,
              release.release_date
            ),
            'musicType', release.metadata ->> 'musicType',
            'recordingType', release.metadata ->> 'recordingType',
            'primaryArtist', case when primary_artist.id is null then null else jsonb_build_object(
              'id', primary_artist.id,
              'displayName', coalesce(primary_artist_localization.display_name, primary_artist.display_name)
            ) end,
            'coverAsset', case when cover.id is null then null else jsonb_build_object(
              'id', cover.id,
              'provider', cover.provider,
              'bucket', cover.bucket,
              'path', cover.path,
              'mimeType', cover.mime_type,
              'version', cover.version
            ) end
          ) as payload
        from music.release_likes release_like
        join music.releases release
          on release.id = release_like.release_id
         and release.publication_status = 'published'::media.publication_status
        left join music.release_localizations release_localization
          on release_localization.release_id = release.id
         and release_localization.locale = p_locale
         and release_localization.publication_status = 'published'::media.publication_status
        left join music.artists primary_artist
          on primary_artist.id = release.primary_artist_id
         and primary_artist.publication_status = 'published'::media.publication_status
        left join music.artist_localizations primary_artist_localization
          on primary_artist_localization.artist_id = primary_artist.id
         and primary_artist_localization.locale = p_locale
         and primary_artist_localization.publication_status = 'published'::media.publication_status
        left join media.media_assets cover
          on cover.id = release.cover_asset_id
         and cover.publication_status = 'published'::media.publication_status
        where release_like.user_id = request_user_id
      ) liked
    ), '[]'::jsonb),
    'likedTracks', coalesce((
      select jsonb_agg(liked.payload order by liked.created_at desc)
      from (
        select
          track_like.created_at,
          jsonb_build_object(
            'id', track.id,
            'title', coalesce(track_localization.title, track.title),
            'subtitle', coalesce(track_localization.subtitle, track.subtitle),
            'durationMs', track.duration_ms,
            'releaseId', release_track.release_id,
            'releaseCoverAsset', case when release_cover.id is null then null else jsonb_build_object(
              'id', release_cover.id,
              'provider', release_cover.provider,
              'bucket', release_cover.bucket,
              'path', release_cover.path,
              'mimeType', release_cover.mime_type,
              'fileSizeBytes', release_cover.file_size_bytes,
              'version', release_cover.version
            ) end,
            'mediaAsset', jsonb_build_object(
              'id', asset.id,
              'provider', asset.provider,
              'bucket', asset.bucket,
              'path', asset.path,
              'mimeType', asset.mime_type,
              'fileSizeBytes', asset.file_size_bytes,
              'version', asset.version
            ),
            'artists', coalesce((
              select jsonb_agg(jsonb_build_object(
                'id', artist.id,
                'displayName', coalesce(artist_localization.display_name, artist.display_name),
                'role', track_artist.role,
                'sortOrder', track_artist.sort_order
              ) order by track_artist.sort_order, artist.display_name)
              from music.track_artists track_artist
              join music.artists artist
                on artist.id = track_artist.artist_id
               and artist.publication_status = 'published'::media.publication_status
              left join music.artist_localizations artist_localization
                on artist_localization.artist_id = artist.id
               and artist_localization.locale = p_locale
               and artist_localization.publication_status = 'published'::media.publication_status
              where track_artist.track_id = track.id
            ), '[]'::jsonb)
          ) as payload
        from music.track_likes track_like
        join music.tracks track
          on track.id = track_like.track_id
         and track.publication_status = 'published'::media.publication_status
        join media.media_assets asset
          on asset.id = track.media_asset_id
         and asset.publication_status = 'published'::media.publication_status
        left join music.track_localizations track_localization
          on track_localization.track_id = track.id
         and track_localization.locale = p_locale
         and track_localization.publication_status = 'published'::media.publication_status
        left join lateral (
          select release_track.release_id, release.cover_asset_id
          from music.release_tracks release_track
          join music.releases release
            on release.id = release_track.release_id
           and release.publication_status = 'published'::media.publication_status
          where release_track.track_id = track.id
          order by release_track.created_at
          limit 1
        ) release_track on true
        left join media.media_assets release_cover
          on release_cover.id = release_track.cover_asset_id
         and release_cover.publication_status = 'published'::media.publication_status
        where track_like.user_id = request_user_id
      ) liked
    ), '[]'::jsonb),
    'playlists', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', playlist.id,
          'name', playlist.name,
          'description', playlist.description,
          'visibility', playlist.visibility,
          'trackCount', (
            select count(*)
            from music.playlist_tracks playlist_track
            where playlist_track.playlist_id = playlist.id
          ),
          'coverAsset', case when cover.id is null then null else jsonb_build_object(
            'id', cover.id,
            'provider', cover.provider,
            'bucket', cover.bucket,
            'path', case
              when cover.provider = 'external'::media.media_provider and cover.bucket = 'playlist-covers'
                then cover.path || case when position('?' in cover.path) > 0 then '&v=' else '?v=' end || cover.version::text
              else cover.path
            end,
            'mimeType', cover.mime_type,
            'fileSizeBytes', cover.file_size_bytes,
            'version', cover.version
          ) end
        ) order by playlist.updated_at desc
      )
      from music.playlists playlist
      left join lateral (
        select asset.*
        from (
          select
            playlist.cover_asset_id as asset_id,
            0 as priority,
            0 as sort_order,
            playlist.created_at as ordered_at
          union all
          select
            release.cover_asset_id as asset_id,
            1 as priority,
            playlist_track.sort_order,
            playlist_track.created_at as ordered_at
          from music.playlist_tracks playlist_track
          join music.release_tracks release_track
            on release_track.track_id = playlist_track.track_id
          join music.releases release
            on release.id = release_track.release_id
           and release.publication_status = 'published'::media.publication_status
          where playlist_track.playlist_id = playlist.id
        ) candidate
        join media.media_assets asset
          on asset.id = candidate.asset_id
         and asset.publication_status = 'published'::media.publication_status
        order by candidate.priority, candidate.sort_order, candidate.ordered_at
        limit 1
      ) cover on true
      where playlist.owner_user_id = request_user_id
    ), '[]'::jsonb)
  ) into payload;

  select coalesce(jsonb_agg(recent.payload order by recent.played_at desc), '[]'::jsonb)
  into recent_tracks
  from (
    select
      latest.played_at,
      jsonb_build_object(
        'playedAt', latest.played_at,
        'track', jsonb_build_object(
          'id', track.id,
          'title', coalesce(track_localization.title, track.title),
          'subtitle', coalesce(track_localization.subtitle, track.subtitle),
          'durationMs', track.duration_ms,
          'releaseId', release.id,
          'mediaAsset', jsonb_build_object(
            'id', asset.id,
            'provider', asset.provider,
            'bucket', asset.bucket,
            'path', asset.path,
            'mimeType', asset.mime_type,
            'fileSizeBytes', asset.file_size_bytes,
            'version', asset.version
          ),
          'artists', coalesce((
            select jsonb_agg(jsonb_build_object(
              'id', artist.id,
              'displayName', coalesce(artist_localization.display_name, artist.display_name),
              'role', track_artist.role,
              'sortOrder', track_artist.sort_order
            ) order by track_artist.sort_order, artist.display_name)
            from music.track_artists track_artist
            join music.artists artist
              on artist.id = track_artist.artist_id
             and artist.publication_status = 'published'::media.publication_status
            left join music.artist_localizations artist_localization
              on artist_localization.artist_id = artist.id
             and artist_localization.locale = p_locale
             and artist_localization.publication_status = 'published'::media.publication_status
            where track_artist.track_id = track.id
          ), '[]'::jsonb)
        ),
        'release', case when release.id is null then null else jsonb_build_object(
          'id', release.id,
          'title', coalesce(release_localization.title, release.title),
          'subtitle', coalesce(release_localization.subtitle, release.subtitle),
          'releaseType', release.release_type,
          'releaseDate', music.release_display_date(
            release.original_release_date,
            release.scheduled_release_at,
            release.release_date
          ),
          'musicType', release.metadata ->> 'musicType',
          'recordingType', release.metadata ->> 'recordingType',
          'primaryArtist', case when primary_artist.id is null then null else jsonb_build_object(
            'id', primary_artist.id,
            'displayName', coalesce(primary_artist_localization.display_name, primary_artist.display_name)
          ) end,
          'coverAsset', case when release_cover.id is null then null else jsonb_build_object(
            'id', release_cover.id,
            'provider', release_cover.provider,
            'bucket', release_cover.bucket,
            'path', release_cover.path,
            'mimeType', release_cover.mime_type,
            'version', release_cover.version
          ) end
        ) end
      ) as payload
    from (
      select distinct on (history.track_id)
        history.track_id,
        history.release_id,
        history.played_at
      from music.play_history history
      where history.user_id = request_user_id
      order by history.track_id, history.played_at desc, history.id desc
    ) latest
    join music.tracks track
      on track.id = latest.track_id
     and track.publication_status = 'published'::media.publication_status
    join media.media_assets asset
      on asset.id = track.media_asset_id
     and asset.publication_status = 'published'::media.publication_status
    left join music.track_localizations track_localization
      on track_localization.track_id = track.id
     and track_localization.locale = p_locale
     and track_localization.publication_status = 'published'::media.publication_status
    left join lateral (
      select published_release.*
      from music.release_tracks release_track
      join music.releases published_release
        on published_release.id = release_track.release_id
       and published_release.publication_status = 'published'::media.publication_status
      where release_track.track_id = track.id
      order by
        case when published_release.id = latest.release_id then 0 else 1 end,
        release_track.created_at
      limit 1
    ) release on true
    left join music.release_localizations release_localization
      on release_localization.release_id = release.id
     and release_localization.locale = p_locale
     and release_localization.publication_status = 'published'::media.publication_status
    left join music.artists primary_artist
      on primary_artist.id = release.primary_artist_id
     and primary_artist.publication_status = 'published'::media.publication_status
    left join music.artist_localizations primary_artist_localization
      on primary_artist_localization.artist_id = primary_artist.id
     and primary_artist_localization.locale = p_locale
     and primary_artist_localization.publication_status = 'published'::media.publication_status
    left join media.media_assets release_cover
      on release_cover.id = release.cover_asset_id
     and release_cover.publication_status = 'published'::media.publication_status
    order by latest.played_at desc
    limit 20
  ) recent;

  select coalesce(
    jsonb_agg(
      (recent_release.entry -> 'release')
        || jsonb_build_object('playedAt', recent_release.entry -> 'playedAt')
      order by (recent_release.entry ->> 'playedAt')::timestamptz desc
    ),
    '[]'::jsonb
  )
  into recent_releases
  from (
    select distinct on (entry -> 'release' ->> 'id') entry
    from jsonb_array_elements(recent_tracks) entry
    where entry -> 'release' <> 'null'::jsonb
    order by
      entry -> 'release' ->> 'id',
      (entry ->> 'playedAt')::timestamptz desc
  ) recent_release;

  return payload || jsonb_build_object(
    'recentTracks', recent_tracks,
    'recentReleases', recent_releases
  );
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_offline_content_changes()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'now', now(),
    'changes', coalesce((
      select jsonb_agg(jsonb_build_object('schema', schema_name, 'table', table_name, 'changedAt', changed_at) order by schema_name, table_name)
      from offline_content.content_changes
    ), '[]'::jsonb)
  );
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_offline_package_plan()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'books', coalesce((
      select jsonb_agg(jsonb_build_object('key', book_key, 'title', title_english, 'titleArabic', title_arabic, 'roots', root_resources) order by book_key)
      from offline_content.books where enabled
    ), '[]'::jsonb),
    'dependencies', coalesce((
      select jsonb_agg(jsonb_build_object('resource', resource_key, 'dependency', dependency_key) order by resource_key, dependency_key)
      from offline_content.resource_dependencies
    ), '[]'::jsonb),
    'resources', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.resource_key, 'schema', r.schema_name, 'tables', offline_content.package_tables(r.resource_key)) order by r.resource_key)
      from offline_content.resources r
    ), '[]'::jsonb)
  );
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_offline_package_registry(p_snapshot_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.role() <> 'service_role' then raise exception 'service_role required'; end if;
  return jsonb_build_object(
    'books', coalesce((select jsonb_agg(jsonb_build_object('key',book_key,'title',title_english,'titleArabic',title_arabic,'roots',root_resources) order by book_key) from offline_content.books where enabled),'[]'::jsonb),
    'dependencies', coalesce((select jsonb_agg(jsonb_build_object('resource',resource_key,'dependency',dependency_key) order by resource_key,dependency_key) from offline_content.resource_dependencies),'[]'::jsonb),
    'resources', coalesce((select jsonb_agg(jsonb_build_object('id',r.resource_key,'version',coalesce(sr.version,r.revision::text)) order by r.resource_key)
       from offline_content.resources r left join offline_content.snapshot_resources sr on sr.snapshot_id=p_snapshot_id and sr.resource_key=r.resource_key),'[]'::jsonb)
  );
end $function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_offline_snapshot_rows(p_snapshot_id uuid, p_resource_key text, p_after_row_id bigint DEFAULT 0, p_limit integer DEFAULT 1000)
 RETURNS TABLE(row_id bigint, row_kind text, schema_name text, object_name text, args_json jsonb, payload jsonb)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select r.row_id,r.row_kind,r.schema_name,r.object_name,r.args_json,r.payload
    from offline_content.snapshot_rows r
   where r.snapshot_id=p_snapshot_id and r.resource_key=p_resource_key and r.row_id>p_after_row_id
   order by r.row_id
   limit least(greatest(p_limit,1),2000)
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_offline_table_page(p_resource text, p_table text, p_offset integer, p_limit integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_schema text;
  v_order text;
  v_rows jsonb;
begin
  if p_limit < 1 or p_limit > 2000 or p_offset < 0 then raise exception 'invalid page'; end if;
  select r.schema_name into v_schema from offline_content.resources r where r.resource_key = p_resource;
  if v_schema is null or not (p_table = any(offline_content.package_tables(p_resource))) then
    raise exception 'not a packaged table';
  end if;
  v_order := case
    when p_resource = 'bible' and p_table = 'books' then 'source_number nulls last, book_key'
    when p_resource = 'bible' and p_table = 'verses' then 'book_key, chapter_number, verse_number'
    when p_resource = 'bible' and p_table = 'verse_parts' then 'book_key, chapter_number, verse_number, part_label'
    else (
      select string_agg(format('%I', a.attname), ', ' order by array_position(i.indkey, a.attnum))
      from pg_catalog.pg_index i
      join pg_catalog.pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
      where i.indrelid = format('%I.%I', v_schema, p_table)::regclass and i.indisprimary
    )
  end;
  execute format(
    'select coalesce(jsonb_agg(to_jsonb(page_row)), ''[]''::jsonb) from (select * from %I.%I source_row order by %s offset %s limit %s) page_row',
    v_schema, p_table, coalesce(v_order, 'to_jsonb(source_row)::text'), p_offset, p_limit
  ) into v_rows;
  return v_rows;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_offline_table_rows(p_resource text, p_table text, p_after text DEFAULT NULL::text, p_limit integer DEFAULT 500)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_published_learning_album(p_album_id uuid, p_locale text DEFAULT 'en'::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select jsonb_build_object(
    'id', a.id,
    'title', coalesce(al.title, a.title),
    'description', coalesce(al.description, a.description),
    'releaseTimingMode', a.release_timing_mode,
    'scheduledReleaseAt', a.scheduled_release_at,
    'originalReleaseDate', a.original_release_date,
    'displayDate', coalesce(a.original_release_date::timestamptz, a.scheduled_release_at, a.created_at),
    'cantor', jsonb_build_object('id', c.id, 'displayName', coalesce(cl.display_name, c.display_name)),
    'season', case when s.id is null then null else jsonb_build_object('id', s.id, 'slug', s.slug, 'title', coalesce(sl.title, s.title)) end,
    'coverAsset', case when cover.id is null then null else jsonb_build_object('id', cover.id, 'provider', cover.provider, 'bucket', cover.bucket, 'path', cover.path, 'mimeType', cover.mime_type, 'fileSizeBytes', cover.file_size_bytes, 'checksum', cover.checksum) end,
    'recordings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'title', coalesce(rl.title, r.title), 'subtitle', coalesce(rl.subtitle, r.subtitle),
        'durationMs', coalesce(r.duration_ms, asset.duration_ms), 'sortOrder', r.sort_order, 'hymnId', r.hymn_id,
        'mediaAsset', jsonb_build_object('id', asset.id, 'provider', asset.provider, 'bucket', asset.bucket, 'path', asset.path, 'mimeType', asset.mime_type, 'durationMs', asset.duration_ms, 'fileSizeBytes', asset.file_size_bytes, 'checksum', asset.checksum)
      ) order by r.sort_order, r.id)
      from learning.album_recordings r
      join media.media_assets asset on asset.id = r.media_asset_id and asset.publication_status = 'published'
      left join learning.recording_localizations rl on rl.recording_id = r.id and rl.locale = p_locale
      where r.album_id = a.id and r.publication_status = 'published'
    ), '[]'::jsonb)
  )
  from learning.albums a
  join learning.cantors c on c.id = a.cantor_id and c.publication_status = 'published'
  left join learning.cantor_localizations cl on cl.cantor_id = c.id and cl.locale = p_locale
  left join learning.album_localizations al on al.album_id = a.id and al.locale = p_locale
  left join learning.seasons s on s.id = a.season_id and s.publication_status = 'published'
  left join learning.season_localizations sl on sl.season_id = s.id and sl.locale = p_locale
  left join media.media_assets cover on cover.id = a.cover_asset_id and cover.publication_status = 'published'
  where a.id = p_album_id and a.publication_status = 'published';
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_published_learning_cantor(p_cantor_id uuid, p_locale text DEFAULT 'en'::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select jsonb_build_object(
    'id', c.id,
    'displayName', coalesce(cl.display_name, c.display_name),
    'biography', coalesce(cl.biography, c.biography),
    'profileImageAsset', case when image.id is null then null else jsonb_build_object('id', image.id, 'provider', image.provider, 'bucket', image.bucket, 'path', image.path, 'mimeType', image.mime_type, 'fileSizeBytes', image.file_size_bytes, 'checksum', image.checksum) end,
    'albums', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id,
        'title', coalesce(al.title, a.title),
        'description', coalesce(al.description, a.description),
        'seasonId', a.season_id,
        'coverAsset', case when cover.id is null then null else jsonb_build_object('id', cover.id, 'provider', cover.provider, 'bucket', cover.bucket, 'path', cover.path, 'mimeType', cover.mime_type, 'fileSizeBytes', cover.file_size_bytes, 'checksum', cover.checksum) end
      ) order by a.created_at desc)
      from learning.albums a
      left join learning.album_localizations al on al.album_id = a.id and al.locale = p_locale
      left join media.media_assets cover on cover.id = a.cover_asset_id and cover.publication_status = 'published'
      where a.cantor_id = c.id and a.publication_status = 'published'
    ), '[]'::jsonb),
    'lessonSets', coalesce((
      select jsonb_agg(jsonb_build_object('id', ls.id, 'title', coalesce(lsl.title, ls.title), 'description', coalesce(lsl.description, ls.description), 'seasonId', ls.season_id, 'hymnId', ls.hymn_id) order by ls.created_at desc)
      from learning.lesson_sets ls
      left join learning.lesson_set_localizations lsl on lsl.lesson_set_id = ls.id and lsl.locale = p_locale
      where ls.cantor_id = c.id and ls.publication_status = 'published'
    ), '[]'::jsonb)
  )
  from learning.cantors c
  left join learning.cantor_localizations cl on cl.cantor_id = c.id and cl.locale = p_locale
  left join media.media_assets image on image.id = c.profile_image_asset_id and image.publication_status = 'published'
  where c.id = p_cantor_id and c.publication_status = 'published';
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_published_learning_hymn(p_hymn_id uuid, p_locale text DEFAULT 'en'::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select jsonb_build_object(
    'id', h.id,
    'sourceHymnKey', h.source_hymn_key,
    'title', coalesce(hl.title, h.title),
    'subtitle', coalesce(hl.subtitle, h.subtitle),
    'description', coalesce(hl.description, h.description),
    'seasons', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'slug', s.slug, 'title', coalesce(sl.title, s.title), 'sortOrder', hs.sort_order) order by hs.sort_order)
      from learning.hymn_seasons hs
      join learning.seasons s on s.id = hs.season_id and s.publication_status = 'published'
      left join learning.season_localizations sl on sl.season_id = s.id and sl.locale = p_locale
      where hs.hymn_id = h.id
    ), '[]'::jsonb),
    'relatedHymns', coalesce((
      select jsonb_agg(jsonb_build_object('id', rh.id, 'sourceHymnKey', rh.source_hymn_key, 'title', coalesce(rhl.title, rh.title), 'relationshipType', rel.relationship_type) order by rel.sort_order)
      from learning.hymn_relationships rel
      join learning.hymns rh on rh.id = rel.related_hymn_id and rh.publication_status = 'published'
      left join learning.hymn_localizations rhl on rhl.hymn_id = rh.id and rhl.locale = p_locale
      where rel.hymn_id = h.id
    ), '[]'::jsonb),
    'lessonSets', coalesce((
      select jsonb_agg(jsonb_build_object('id', ls.id, 'title', coalesce(lsl.title, ls.title), 'cantorId', ls.cantor_id, 'seasonId', ls.season_id) order by ls.created_at desc)
      from learning.lesson_sets ls
      left join learning.lesson_set_localizations lsl on lsl.lesson_set_id = ls.id and lsl.locale = p_locale
      where ls.hymn_id = h.id and ls.publication_status = 'published'
    ), '[]'::jsonb)
  )
  from learning.hymns h
  left join learning.hymn_localizations hl on hl.hymn_id = h.id and hl.locale = p_locale
  where h.id = p_hymn_id and h.publication_status = 'published';
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_published_learning_item_lyrics(p_item_kind learning.playlist_item_kind, p_item_id uuid, p_locale text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_published_learning_lesson_set(p_lesson_set_id uuid, p_locale text DEFAULT 'en'::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_published_learning_season(p_season_id uuid, p_locale text DEFAULT 'en'::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select jsonb_build_object(
    'id', s.id, 'slug', s.slug, 'title', coalesce(sl.title, s.title), 'description', coalesce(sl.description, s.description),
    'hymns', coalesce((
      select jsonb_agg(jsonb_build_object('id', h.id, 'sourceHymnKey', h.source_hymn_key, 'title', coalesce(hl.title, h.title), 'subtitle', coalesce(hl.subtitle, h.subtitle), 'sortOrder', hs.sort_order) order by hs.sort_order, coalesce(hl.title, h.title))
      from learning.hymn_seasons hs
      join learning.hymns h on h.id = hs.hymn_id and h.publication_status = 'published'
      left join learning.hymn_localizations hl on hl.hymn_id = h.id and hl.locale = p_locale
      where hs.season_id = s.id
    ), '[]'::jsonb),
    'albums', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'title', coalesce(al.title, a.title), 'description', coalesce(al.description, a.description),
        'cantorId', c.id, 'cantorName', coalesce(cl.display_name, c.display_name),
        'coverAsset', case when cover.id is null then null else jsonb_build_object('id', cover.id, 'provider', cover.provider, 'bucket', cover.bucket, 'path', cover.path, 'mimeType', cover.mime_type, 'fileSizeBytes', cover.file_size_bytes, 'checksum', cover.checksum) end
      ) order by a.created_at desc)
      from learning.albums a
      join learning.cantors c on c.id = a.cantor_id and c.publication_status = 'published'
      left join learning.cantor_localizations cl on cl.cantor_id = c.id and cl.locale = p_locale
      left join learning.album_localizations al on al.album_id = a.id and al.locale = p_locale
      left join media.media_assets cover on cover.id = a.cover_asset_id and cover.publication_status = 'published'
      where a.season_id = s.id and a.publication_status = 'published'
    ), '[]'::jsonb),
    'lessonSets', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ls.id, 'title', coalesce(lsl.title, ls.title), 'description', coalesce(lsl.description, ls.description),
        'cantorId', c.id, 'cantorName', coalesce(cl.display_name, c.display_name), 'hymnId', ls.hymn_id,
        'coverAsset', case when cover.id is null then null else jsonb_build_object('id', cover.id, 'provider', cover.provider, 'bucket', cover.bucket, 'path', cover.path, 'mimeType', cover.mime_type, 'fileSizeBytes', cover.file_size_bytes, 'checksum', cover.checksum) end
      ) order by ls.created_at desc)
      from learning.lesson_sets ls
      join learning.cantors c on c.id = ls.cantor_id and c.publication_status = 'published'
      left join learning.cantor_localizations cl on cl.cantor_id = c.id and cl.locale = p_locale
      left join learning.lesson_set_localizations lsl on lsl.lesson_set_id = ls.id and lsl.locale = p_locale
      left join media.media_assets cover on cover.id = ls.cover_asset_id and cover.publication_status = 'published'
      where ls.season_id = s.id and ls.publication_status = 'published'
    ), '[]'::jsonb)
  )
  from learning.seasons s
  left join learning.season_localizations sl on sl.season_id = s.id and sl.locale = p_locale
  where s.id = p_season_id and s.publication_status = 'published';
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_published_music_artist(p_artist_id uuid, p_locale text DEFAULT 'en'::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'id', artist.id,
    'displayName', coalesce(artist_localization.display_name, artist.display_name),
    'biography', coalesce(artist_localization.biography, artist.biography),
    'profileImageAsset', case
      when image.id is null then null
      else jsonb_build_object(
        'id', image.id,
        'provider', image.provider,
        'bucket', image.bucket,
        'path', image.path,
        'mimeType', image.mime_type
      )
    end,
    'socialLinks', music.published_artist_social_links(artist.id),
    'releases', coalesce((
      select jsonb_agg(release_row.payload order by release_row.release_date desc nulls last, release_row.title)
      from (
        select
          release.release_date,
          coalesce(release_localization.title, release.title) as title,
          jsonb_build_object(
            'id', release.id,
            'title', coalesce(release_localization.title, release.title),
            'subtitle', coalesce(release_localization.subtitle, release.subtitle),
            'releaseType', release.release_type,
            'releaseDate', music.release_display_date(release.original_release_date, release.scheduled_release_at, release.release_date),
            'coverAsset', case
              when cover.id is null then null
              else jsonb_build_object(
                'id', cover.id,
                'provider', cover.provider,
                'bucket', cover.bucket,
                'path', cover.path,
                'mimeType', cover.mime_type
              )
            end
          ) as payload
        from music.releases release
        left join music.release_localizations release_localization
          on release_localization.release_id = release.id
         and release_localization.locale = p_locale
         and release_localization.publication_status = 'published'::media.publication_status
        left join media.media_assets cover
          on cover.id = release.cover_asset_id
         and cover.publication_status = 'published'::media.publication_status
        where release.primary_artist_id = artist.id
          and release.publication_status = 'published'::media.publication_status
      ) release_row
    ), '[]'::jsonb)
  )
  from music.artists artist
  left join music.artist_localizations artist_localization
    on artist_localization.artist_id = artist.id
   and artist_localization.locale = p_locale
   and artist_localization.publication_status = 'published'::media.publication_status
  left join media.media_assets image
    on image.id = artist.profile_image_asset_id
   and image.publication_status = 'published'::media.publication_status
  where artist.id = p_artist_id
    and artist.publication_status = 'published'::media.publication_status;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_published_music_release(p_release_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'id', release.id,
    'title', release.title,
    'subtitle', release.subtitle,
    'description', release.description,
    'releaseType', release.release_type,
    'releaseDate', music.release_display_date(release.original_release_date, release.scheduled_release_at, release.release_date),
    'publicationStatus', release.publication_status,
    'primaryArtist', case
      when primary_artist.id is null then null
      else jsonb_build_object(
        'id', primary_artist.id,
        'displayName', primary_artist.display_name,
        'profileImageAssetId', primary_artist.profile_image_asset_id
      )
    end,
    'tracks', coalesce((
      select jsonb_agg(track_row.payload order by track_row.disc_number, track_row.track_number, track_row.track_id)
      from (
        select
          release_track.disc_number,
          release_track.track_number,
          track.id as track_id,
          jsonb_build_object(
            'id', track.id,
            'title', track.title,
            'subtitle', track.subtitle,
            'discNumber', release_track.disc_number,
            'trackNumber', release_track.track_number,
            'durationMs', track.duration_ms,
            'mediaAsset', jsonb_build_object(
              'id', asset.id,
              'provider', asset.provider,
              'bucket', asset.bucket,
              'path', asset.path,
              'mimeType', asset.mime_type,
              'fileSizeBytes', asset.file_size_bytes,
              'checksum', asset.checksum
            ),
            'artists', coalesce((
              select jsonb_agg(
                jsonb_build_object(
                  'id', artist.id,
                  'displayName', artist.display_name,
                  'role', track_artist.role,
                  'sortOrder', track_artist.sort_order
                )
                order by track_artist.sort_order, artist.display_name
              )
              from music.track_artists track_artist
              join music.artists artist on artist.id = track_artist.artist_id
              where track_artist.track_id = track.id
                and artist.publication_status = 'published'::media.publication_status
            ), '[]'::jsonb)
          ) as payload
        from music.release_tracks release_track
        join music.tracks track on track.id = release_track.track_id
        join media.media_assets asset on asset.id = track.media_asset_id
        where release_track.release_id = release.id
          and track.publication_status = 'published'::media.publication_status
          and asset.publication_status = 'published'::media.publication_status
      ) track_row
    ), '[]'::jsonb)
  )
  from music.releases release
  left join music.artists primary_artist on primary_artist.id = release.primary_artist_id
  where release.id = p_release_id
    and release.publication_status = 'published'::media.publication_status;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_published_music_release_for_locale(p_release_id uuid, p_locale text DEFAULT 'en'::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'id', release.id,
    'title', coalesce(release_localization.title, release.title),
    'subtitle', coalesce(release_localization.subtitle, release.subtitle),
    'description', coalesce(release_localization.description, release.description),
    'releaseType', release.release_type,
    'releaseDate', music.release_display_date(release.original_release_date, release.scheduled_release_at, release.release_date),
    'publicationStatus', release.publication_status,
    'musicType', release.metadata ->> 'musicType',
    'recordingType', release.metadata ->> 'recordingType',
    'coverAsset', case
      when cover.id is null then null
      else jsonb_build_object(
        'id', cover.id,
        'provider', cover.provider,
        'bucket', cover.bucket,
        'path', cover.path,
        'mimeType', cover.mime_type,
        'fileSizeBytes', cover.file_size_bytes,
        'checksum', cover.checksum
      )
    end,
    'primaryArtist', case
      when primary_artist.id is null then null
      else jsonb_build_object(
        'id', primary_artist.id,
        'displayName', coalesce(primary_artist_localization.display_name, primary_artist.display_name),
        'profileImageAsset', case
          when artist_image.id is null then null
          else jsonb_build_object(
            'id', artist_image.id,
            'provider', artist_image.provider,
            'bucket', artist_image.bucket,
            'path', artist_image.path,
            'mimeType', artist_image.mime_type
          )
        end
      )
    end,
    'tracks', coalesce((
      select jsonb_agg(track_row.payload order by track_row.disc_number, track_row.track_number, track_row.track_id)
      from (
        select
          release_track.disc_number,
          release_track.track_number,
          track.id as track_id,
          jsonb_build_object(
            'id', track.id,
            'title', coalesce(track_localization.title, track.title),
            'subtitle', coalesce(track_localization.subtitle, track.subtitle),
            'discNumber', release_track.disc_number,
            'trackNumber', release_track.track_number,
            'durationMs', track.duration_ms,
            'releaseId', release.id,
            'mediaAsset', jsonb_build_object(
              'id', asset.id,
              'provider', asset.provider,
              'bucket', asset.bucket,
              'path', asset.path,
              'mimeType', asset.mime_type,
              'fileSizeBytes', asset.file_size_bytes,
              'checksum', asset.checksum
            ),
            'artists', coalesce((
              select jsonb_agg(
                jsonb_build_object(
                  'id', artist.id,
                  'displayName', coalesce(artist_localization.display_name, artist.display_name),
                  'role', track_artist.role,
                  'sortOrder', track_artist.sort_order
                )
                order by track_artist.sort_order, coalesce(artist_localization.display_name, artist.display_name)
              )
              from music.track_artists track_artist
              join music.artists artist
                on artist.id = track_artist.artist_id
               and artist.publication_status = 'published'::media.publication_status
              left join music.artist_localizations artist_localization
                on artist_localization.artist_id = artist.id
               and artist_localization.locale = p_locale
               and artist_localization.publication_status = 'published'::media.publication_status
              where track_artist.track_id = track.id
            ), '[]'::jsonb)
          ) as payload
        from music.release_tracks release_track
        join music.tracks track
          on track.id = release_track.track_id
         and track.publication_status = 'published'::media.publication_status
        join media.media_assets asset
          on asset.id = track.media_asset_id
         and asset.publication_status = 'published'::media.publication_status
        left join music.track_localizations track_localization
          on track_localization.track_id = track.id
         and track_localization.locale = p_locale
         and track_localization.publication_status = 'published'::media.publication_status
        where release_track.release_id = release.id
      ) track_row
    ), '[]'::jsonb)
  )
  from music.releases release
  left join music.release_localizations release_localization
    on release_localization.release_id = release.id
   and release_localization.locale = p_locale
   and release_localization.publication_status = 'published'::media.publication_status
  left join music.artists primary_artist
    on primary_artist.id = release.primary_artist_id
   and primary_artist.publication_status = 'published'::media.publication_status
  left join music.artist_localizations primary_artist_localization
    on primary_artist_localization.artist_id = primary_artist.id
   and primary_artist_localization.locale = p_locale
   and primary_artist_localization.publication_status = 'published'::media.publication_status
  left join media.media_assets cover
    on cover.id = release.cover_asset_id
   and cover.publication_status = 'published'::media.publication_status
  left join media.media_assets artist_image
    on artist_image.id = primary_artist.profile_image_asset_id
   and artist_image.publication_status = 'published'::media.publication_status
  where release.id = p_release_id
    and release.publication_status = 'published'::media.publication_status;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_published_music_track_for_locale(p_track_id uuid, p_locale text DEFAULT 'en'::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'id', track.id,
    'title', coalesce(track_localization.title, track.title),
    'subtitle', coalesce(track_localization.subtitle, track.subtitle),
    'durationMs', track.duration_ms,
    'discNumber', release_context.disc_number,
    'trackNumber', release_context.track_number,
    'mediaAsset', jsonb_build_object(
      'id', media_asset.id,
      'provider', media_asset.provider,
      'bucket', media_asset.bucket,
      'path', media_asset.path,
      'mimeType', media_asset.mime_type,
      'fileSizeBytes', media_asset.file_size_bytes,
      'checksum', media_asset.checksum
    ),
    'artists', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', artist.id,
          'displayName', coalesce(artist_localization.display_name, artist.display_name),
          'role', track_artist.role,
          'sortOrder', track_artist.sort_order
        )
        order by track_artist.sort_order, artist.display_name
      )
      from music.track_artists track_artist
      join music.artists artist
        on artist.id = track_artist.artist_id
       and artist.publication_status = 'published'::media.publication_status
      left join music.artist_localizations artist_localization
        on artist_localization.artist_id = artist.id
       and artist_localization.locale = p_locale
       and artist_localization.publication_status = 'published'::media.publication_status
      where track_artist.track_id = track.id
    ), '[]'::jsonb),
    'release', case when release_context.id is null then null else jsonb_build_object(
      'id', release_context.id,
      'title', release_context.title,
      'subtitle', release_context.subtitle,
      'releaseType', release_context.release_type,
      'releaseDate', release_context.release_date,
      'musicType', release_context.music_type,
      'recordingType', release_context.recording_type,
      'coverAsset', release_context.cover_asset,
      'primaryArtist', release_context.primary_artist
    ) end
  )
  from music.tracks track
  join media.media_assets media_asset
    on media_asset.id = track.media_asset_id
   and media_asset.publication_status = 'published'::media.publication_status
  left join music.track_localizations track_localization
    on track_localization.track_id = track.id
   and track_localization.locale = p_locale
   and track_localization.publication_status = 'published'::media.publication_status
  left join lateral (
    select
      release.id,
      coalesce(release_localization.title, release.title) as title,
      coalesce(release_localization.subtitle, release.subtitle) as subtitle,
      release.release_type,
      music.release_display_date(
        release.original_release_date,
        release.scheduled_release_at,
        release.release_date
      ) as release_date,
      release.metadata ->> 'musicType' as music_type,
      release.metadata ->> 'recordingType' as recording_type,
      release_track.disc_number,
      release_track.track_number,
      case when cover.id is null then null else jsonb_build_object(
        'id', cover.id,
        'provider', cover.provider,
        'bucket', cover.bucket,
        'path', cover.path,
        'mimeType', cover.mime_type,
        'fileSizeBytes', cover.file_size_bytes,
        'checksum', cover.checksum
      ) end as cover_asset,
      case when primary_artist.id is null then null else jsonb_build_object(
        'id', primary_artist.id,
        'displayName', coalesce(primary_artist_localization.display_name, primary_artist.display_name)
      ) end as primary_artist
    from music.release_tracks release_track
    join music.releases release
      on release.id = release_track.release_id
     and release.publication_status = 'published'::media.publication_status
    left join music.release_localizations release_localization
      on release_localization.release_id = release.id
     and release_localization.locale = p_locale
     and release_localization.publication_status = 'published'::media.publication_status
    left join media.media_assets cover
      on cover.id = release.cover_asset_id
     and cover.publication_status = 'published'::media.publication_status
    left join music.artists primary_artist
      on primary_artist.id = release.primary_artist_id
     and primary_artist.publication_status = 'published'::media.publication_status
    left join music.artist_localizations primary_artist_localization
      on primary_artist_localization.artist_id = primary_artist.id
     and primary_artist_localization.locale = p_locale
     and primary_artist_localization.publication_status = 'published'::media.publication_status
    where release_track.track_id = track.id
    order by release.scheduled_release_at desc nulls last,
      release.release_date desc nulls last,
      release_track.disc_number,
      release_track.track_number
    limit 1
  ) release_context on true
  where track.id = p_track_id
    and track.publication_status = 'published'::media.publication_status;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_published_track_lyrics(p_track_id uuid, p_locale text DEFAULT NULL::text, p_kind music.lyric_kind DEFAULT NULL::music.lyric_kind)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'trackId', track.id,
    'lyricSets', coalesce((
      select jsonb_agg(lyric_set_row.payload order by lyric_set_row.locale, lyric_set_row.kind)
      from (
        select
          lyric_set.locale,
          lyric_set.kind,
          jsonb_build_object(
            'id', lyric_set.id,
            'trackId', lyric_set.track_id,
            'locale', lyric_set.locale,
            'kind', lyric_set.kind,
            'syncPrecision', lyric_set.sync_precision,
            'title', lyric_set.title,
            'source', lyric_set.source,
            'publicationStatus', lyric_set.publication_status,
            'lines', coalesce((
              select jsonb_agg(
                jsonb_build_object(
                  'id', lyric_line.id,
                  'sequence', lyric_line.sequence,
                  'startMs', lyric_line.start_ms,
                  'endMs', lyric_line.end_ms,
                  'text', lyric_line.text,
                  'words', coalesce((
                    select jsonb_agg(
                      jsonb_build_object(
                        'id', lyric_word.id,
                        'sequence', lyric_word.sequence,
                        'startMs', lyric_word.start_ms,
                        'endMs', lyric_word.end_ms,
                        'text', lyric_word.text
                      )
                      order by lyric_word.sequence
                    )
                    from music.lyric_words lyric_word
                    where lyric_word.lyric_line_id = lyric_line.id
                  ), '[]'::jsonb)
                )
                order by lyric_line.sequence
              )
              from music.lyric_lines lyric_line
              where lyric_line.lyric_set_id = lyric_set.id
            ), '[]'::jsonb)
          ) as payload
        from music.lyric_sets lyric_set
        where lyric_set.track_id = track.id
          and lyric_set.publication_status = 'published'::media.publication_status
          and (p_locale is null or lyric_set.locale = p_locale)
          and (p_kind is null or lyric_set.kind = p_kind)
      ) lyric_set_row
    ), '[]'::jsonb)
  )
  from music.tracks track
  where track.id = p_track_id
    and track.publication_status = 'published'::media.publication_status;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_reading_text(p_reading_reference text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  v_segments text[];
  v_seg text;
  v_book_num int;
  v_book_key text;
  v_rest text;
  v_start_chapter int;
  v_verse_part text;
  v_end_chapter int;
  v_start_verse int;
  v_end_verse int;
  v_result jsonb := '[]'::jsonb;
  v_verses jsonb;
BEGIN
  IF p_reading_reference IS NULL OR btrim(p_reading_reference) = '' THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT array_agg(btrim(s)) INTO v_segments
  FROM regexp_split_to_table(p_reading_reference, '\*@\+|@') AS s
  WHERE btrim(s) <> '';

  FOREACH v_seg IN ARRAY v_segments LOOP
    v_book_num     := substring(v_seg FROM '^(\d+)\.')::int;
    v_rest         := substring(v_seg FROM '^\d+\.(.*)$');
    v_start_chapter := substring(v_rest FROM '^(\d+):')::int;
    v_verse_part   := substring(v_rest FROM '^\d+:(.*)$');
    v_book_key     := bible.get_book_key_by_calendar_number(v_book_num);

    v_end_chapter := NULL; v_start_verse := NULL; v_end_verse := NULL;

    IF v_verse_part ~ ',' THEN
      SELECT COALESCE(
        jsonb_agg(sub.result ORDER BY sub.ordinality),
        '[]'::jsonb
      )
      INTO v_verses
      FROM (
        SELECT
          jsonb_build_object(
            'chapter_number', v.chapter_number,
            'verse_number',   v.verse_number,
            'english', v.english, 'coptic', v.coptic, 'arabic', v.arabic, 'french', v.french
          ) AS result,
          tok.ordinality
        FROM unnest(regexp_split_to_array(v_verse_part, ','))
             WITH ORDINALITY AS tok(token, ordinality)
        JOIN bible.verses v
          ON v.book_key       = v_book_key
         AND v.chapter_number = v_start_chapter
         AND v.verse_number   = tok.token::int
        WHERE tok.token ~ '^\d+$'

        UNION ALL

        SELECT
          jsonb_build_object(
            'chapter_number', vp.chapter_number,
            'verse_number',   vp.verse_number,
            'part_label',     vp.part_label,
            'english', vp.english, 'coptic', vp.coptic, 'arabic', vp.arabic, 'french', null
          ) AS result,
          tok.ordinality
        FROM (
          SELECT token, ordinality
          FROM unnest(regexp_split_to_array(v_verse_part, ','))
               WITH ORDINALITY AS t(token, ordinality)
          WHERE t.token ~ '^\d+[a-z]$'
        ) tok
        JOIN LATERAL bible.get_verse_part_by_calendar(
          v_book_num,
          v_start_chapter,
          substring(tok.token FROM '^(\d+)[a-z]$')::int,
          substring(tok.token FROM '^\d+([a-z])$')
        ) vp ON true
      ) sub;

    ELSIF v_verse_part ~ '^\d+-\d+:\d+$' THEN
      v_start_verse := substring(v_verse_part FROM '^(\d+)-')::int;
      v_end_chapter := substring(v_verse_part FROM '-(\d+):')::int;
      v_end_verse   := substring(v_verse_part FROM ':(\d+)$')::int;
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'chapter_number', r.chapter_number, 'verse_number', r.verse_number,
        'english', r.english, 'coptic', r.coptic, 'arabic', r.arabic, 'french', bv.french
      ) ORDER BY r.chapter_number, r.verse_number), '[]'::jsonb)
      INTO v_verses
      FROM bible.get_verses_by_range(v_book_key, v_start_chapter, v_start_verse, v_end_chapter, v_end_verse) r
      LEFT JOIN bible.verses bv ON bv.verse_id = r.verse_id;

    ELSIF v_verse_part ~ '^\d+-\d+$' THEN
      v_start_verse := substring(v_verse_part FROM '^(\d+)-')::int;
      v_end_verse   := substring(v_verse_part FROM '-(\d+)$')::int;
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'chapter_number', r.chapter_number, 'verse_number', r.verse_number,
        'english', r.english, 'coptic', r.coptic, 'arabic', r.arabic, 'french', bv.french
      ) ORDER BY r.chapter_number, r.verse_number), '[]'::jsonb)
      INTO v_verses
      FROM bible.get_verses_by_range(v_book_key, v_start_chapter, v_start_verse, v_start_chapter, v_end_verse) r
      LEFT JOIN bible.verses bv ON bv.verse_id = r.verse_id;

    ELSIF v_verse_part ~ '^\d+[a-z]$' THEN
      v_start_verse := substring(v_verse_part FROM '^(\d+)')::int;
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'chapter_number', vp.chapter_number, 'verse_number', vp.verse_number,
        'part_label', vp.part_label,
        'english', vp.english, 'coptic', vp.coptic, 'arabic', vp.arabic, 'french', null
      )), '[]'::jsonb)
      INTO v_verses
      FROM bible.get_verse_part_by_calendar(
             v_book_num, v_start_chapter, v_start_verse,
             substring(v_verse_part FROM '([a-z])$')
           ) vp;

    ELSE
      v_start_verse := v_verse_part::int;
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'chapter_number', chapter_number, 'verse_number', verse_number,
        'english', english, 'coptic', coptic, 'arabic', arabic, 'french', french
      ) ORDER BY verse_number), '[]'::jsonb)
      INTO v_verses
      FROM bible.verses
      WHERE book_key = v_book_key
        AND chapter_number = v_start_chapter
        AND verse_number = v_start_verse;
    END IF;

    v_result := v_result || jsonb_build_array(jsonb_build_object(
      'segment',        v_seg,
      'book_key',       v_book_key,
      'start_chapter',  v_start_chapter,
      'verses',         v_verses
    ));
  END LOOP;

  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'get_reading_text failed for reference=% : %', p_reading_reference, SQLERRM;
  RETURN jsonb_build_array(jsonb_build_object('segment', p_reading_reference, 'error', SQLERRM));
END;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_readings_for_date(p_date date)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
AS $function$
  SELECT COALESCE(jsonb_agg(
    rule || jsonb_build_object('resolved_verses', public.get_reading_text(rule->>'reading_reference'))
  ), '[]'::jsonb)
  FROM jsonb_array_elements(public.get_calendar_readings(p_date)) AS rule;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_release_liked(p_release_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'music', 'auth'
AS $function$
  select case
    when auth.uid() is null then false
    else exists (
      select 1
      from music.release_likes liked
      where liked.user_id = auth.uid()
        and liked.release_id = p_release_id
    )
  end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_service(p_schema text, p_table text, p_date date, p_context jsonb DEFAULT '{}'::jsonb, p_depth integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  v_flags jsonb;
  v_items jsonb := '[]'::jsonb;
  v_row RECORD;
  v_current_item_order double precision;
  v_current_hymn text;
  v_current_title_en text;
  v_current_title_ar text;
  v_current_minimization text;
  v_current_item_type text;
  v_current_lines jsonb;
  v_target_schema text;
  v_target_table text;
  v_sub jsonb;
  v_inline jsonb;
  v_inline_row RECORD;
BEGIN
  v_flags := calendar.get_context_flags(p_date, p_context);
  v_current_item_order := NULL;

  FOR v_row IN SELECT * FROM public.get_service_rows(p_schema, p_table) LOOP
    IF NOT public.evaluate_condition(v_row.placement_condition, v_flags) THEN
      CONTINUE;
    END IF;

    IF v_current_item_order IS DISTINCT FROM v_row.item_order THEN
      IF v_current_item_order IS NOT NULL THEN
        v_items := v_items || jsonb_build_array(jsonb_build_object(
          'item_order', v_current_item_order,
          'hymn_key', v_current_hymn,
          'title_english', v_current_title_en,
          'title_arabic', v_current_title_ar,
          'minimization', v_current_minimization,
          'item_type', v_current_item_type,
          'lines', v_current_lines
        ));
      END IF;
      v_current_item_order := v_row.item_order;
      v_current_hymn := v_row.hymn_key;
      v_current_title_en := v_row.title_english;
      v_current_title_ar := v_row.title_arabic;
      v_current_minimization := v_row.minimization;
      v_current_item_type := v_row.placement_item_type;
      v_current_lines := '[]'::jsonb;

      IF v_row.placement_item_type = 'Subdocument' THEN
        IF p_depth < 3 THEN
          SELECT schema_name, table_name INTO v_target_schema, v_target_table
          FROM public.resolve_subdocument_target(v_row.hymn_key);
          IF v_target_schema IS NOT NULL THEN
            v_sub := public.get_service(v_target_schema, v_target_table, p_date, p_context, p_depth + 1);
            v_current_lines := jsonb_build_array(jsonb_build_object('subdocument', v_sub));
          ELSE
            v_current_lines := jsonb_build_array(jsonb_build_object('unresolved_subdocument', v_row.hymn_key));
          END IF;
        ELSE
          v_current_lines := jsonb_build_array(jsonb_build_object('max_depth_reached', v_row.hymn_key));
        END IF;
      END IF;
    END IF;

    IF v_row.placement_item_type IS DISTINCT FROM 'Subdocument' AND v_row.line_order IS NOT NULL THEN
      IF public.evaluate_condition(v_row.line_condition, v_flags) THEN
        v_inline := NULL;
        IF v_row.line_item_type = 'Inline' AND v_row.inline_hymn_key IS NOT NULL AND p_depth < 3 THEN
          v_inline := '[]'::jsonb;
          FOR v_inline_row IN SELECT * FROM public.get_inline_hymn(p_schema, v_row.inline_hymn_key) LOOP
            IF public.evaluate_condition(v_inline_row.line_condition, v_flags) THEN
              v_inline := v_inline || jsonb_build_array(jsonb_build_object(
                'line_order', v_inline_row.line_order,
                'english', v_inline_row.english,
                'coptic', v_inline_row.coptic,
                'arabic', v_inline_row.arabic,
                'person_type', v_inline_row.person_type,
                'prayer_type', v_inline_row.prayer_type
              ));
            END IF;
          END LOOP;
        END IF;

        v_current_lines := v_current_lines || jsonb_build_array(jsonb_build_object(
          'line_order', v_row.line_order,
          'english', v_row.english,
          'coptic', v_row.coptic,
          'arabic', v_row.arabic,
          'person_type', v_row.person_type,
          'prayer_type', v_row.prayer_type,
          'item_type', v_row.line_item_type,
          'inline', v_inline
        ));
      END IF;
    END IF;
  END LOOP;

  IF v_current_item_order IS NOT NULL THEN
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'item_order', v_current_item_order,
      'hymn_key', v_current_hymn,
      'title_english', v_current_title_en,
      'title_arabic', v_current_title_ar,
      'minimization', v_current_minimization,
      'item_type', v_current_item_type,
      'lines', v_current_lines
    ));
  END IF;

  RETURN jsonb_build_object('date', p_date::text, 'schema', p_schema, 'table', p_table, 'items', v_items);
END;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_service_rows(p_schema text, p_table text)
 RETURNS TABLE(item_order double precision, hymn_key text, placement_condition text, placement_item_type text, minimization text, title_english text, title_arabic text, line_order double precision, english text, coptic text, arabic text, person_type text, prayer_type text, line_condition text, line_item_type text, inline_hymn_key text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_schema NOT IN (
    'psalmody','liturgy','agpeya','doxologies','veneration',
    'canons','holy_week','litanies','gospel_responses','gospel_rite',
    'praxis_response','verses_of_the_cymbals','hymn_of_the_intercessions',
    'seasonal_liturgy_hymns'
  ) THEN
    RAISE EXCEPTION 'Schema not allowed: %', p_schema;
  END IF;
  RETURN QUERY EXECUTE format(
    'SELECT
       m.item_order::float8,
       m.hymn_key,
       m.condition          AS placement_condition,
       m.item_type::text    AS placement_item_type,
       m.minimization::text,
       h.title_english,
       h.title_arabic,
       t.line_order::float8,
       t.english,
       t.coptic,
       t.arabic,
       t.person_type::text,
       t.prayer_type::text,
       t.condition          AS line_condition,
       t.item_type::text    AS line_item_type,
       t.inline_hymn_key
     FROM %I.%I m
     LEFT JOIN %I.hymn_titles  h ON h.hymn_key = m.hymn_key
     LEFT JOIN %I.hymn_texts t ON t.hymn_key = m.hymn_key
     ORDER BY m.item_order, t.line_order',
    p_schema, p_table, p_schema, p_schema
  );
END;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_share_preview(p_path text, p_locale text DEFAULT 'en'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  clean_path text := split_part(coalesce(p_path, '/'), '?', 1);
  match_parts text[];
  entity_id uuid;
  preview jsonb;
begin
  -- Music artist.
  match_parts := regexp_match(clean_path, '^/music/artist/([0-9a-fA-F-]{36})/?$');
  if match_parts is not null then
    entity_id := match_parts[1]::uuid;
    select jsonb_build_object(
      'title', coalesce(localization.display_name, artist.display_name),
      'description', coalesce(localization.biography, artist.biography, 'Listen on Coptic Vine'),
      'imageAsset', coalesce(
        case when profile.id is null then null else jsonb_build_object(
          'id', profile.id, 'provider', profile.provider, 'bucket', profile.bucket,
          'path', profile.path, 'mimeType', profile.mime_type
        ) end,
        (
          select jsonb_build_object(
            'id', cover.id, 'provider', cover.provider, 'bucket', cover.bucket,
            'path', cover.path, 'mimeType', cover.mime_type
          )
          from music.track_artists ta
          join music.release_tracks rt on rt.track_id = ta.track_id
          join music.releases r
            on r.id = rt.release_id
           and r.publication_status = 'published'::media.publication_status
          join media.media_assets cover
            on cover.id = r.cover_asset_id
           and cover.publication_status = 'published'::media.publication_status
          where ta.artist_id = artist.id
          order by r.scheduled_release_at desc nulls last,
                   r.release_date desc nulls last,
                   rt.disc_number,
                   rt.track_number
          limit 1
        )
      )
    )
    into preview
    from music.artists artist
    left join music.artist_localizations localization
      on localization.artist_id = artist.id
     and localization.locale = p_locale
     and localization.publication_status = 'published'::media.publication_status
    left join media.media_assets profile
      on profile.id = artist.profile_image_asset_id
     and profile.publication_status = 'published'::media.publication_status
    where artist.id = entity_id
      and artist.publication_status = 'published'::media.publication_status;

    if preview is not null then return preview; end if;
  end if;

  -- Music release / album / EP / single.
  match_parts := regexp_match(clean_path, '^/music/release/([0-9a-fA-F-]{36})/?$');
  if match_parts is not null then
    entity_id := match_parts[1]::uuid;
    select jsonb_build_object(
      'title', coalesce(localization.title, release.title),
      'description', concat_ws(' — ',
        coalesce(localization.description, release.description),
        coalesce(artist_localization.display_name, artist.display_name)
      ),
      'imageAsset', case when cover.id is null then null else jsonb_build_object(
        'id', cover.id, 'provider', cover.provider, 'bucket', cover.bucket,
        'path', cover.path, 'mimeType', cover.mime_type
      ) end
    )
    into preview
    from music.releases release
    left join music.release_localizations localization
      on localization.release_id = release.id
     and localization.locale = p_locale
     and localization.publication_status = 'published'::media.publication_status
    left join music.artists artist
      on artist.id = release.primary_artist_id
     and artist.publication_status = 'published'::media.publication_status
    left join music.artist_localizations artist_localization
      on artist_localization.artist_id = artist.id
     and artist_localization.locale = p_locale
     and artist_localization.publication_status = 'published'::media.publication_status
    left join media.media_assets cover
      on cover.id = release.cover_asset_id
     and cover.publication_status = 'published'::media.publication_status
    where release.id = entity_id
      and release.publication_status = 'published'::media.publication_status;

    if preview is not null then return preview; end if;
  end if;

  -- Music track: use its release artwork.
  match_parts := regexp_match(clean_path, '^/music/track/([0-9a-fA-F-]{36})/?$');
  if match_parts is not null then
    entity_id := match_parts[1]::uuid;
    select jsonb_build_object(
      'title', coalesce(track_localization.title, track.title),
      'description', case
        when release_context.title is not null
          then coalesce(track_localization.title, track.title) || ' — ' || release_context.title
        else coalesce(track_localization.title, track.title)
      end,
      'imageAsset', release_context.cover_asset
    )
    into preview
    from music.tracks track
    left join music.track_localizations track_localization
      on track_localization.track_id = track.id
     and track_localization.locale = p_locale
     and track_localization.publication_status = 'published'::media.publication_status
    left join lateral (
      select
        coalesce(release_localization.title, release.title) as title,
        case when cover.id is null then null else jsonb_build_object(
          'id', cover.id, 'provider', cover.provider, 'bucket', cover.bucket,
          'path', cover.path, 'mimeType', cover.mime_type
        ) end as cover_asset
      from music.release_tracks rt
      join music.releases release
        on release.id = rt.release_id
       and release.publication_status = 'published'::media.publication_status
      left join music.release_localizations release_localization
        on release_localization.release_id = release.id
       and release_localization.locale = p_locale
       and release_localization.publication_status = 'published'::media.publication_status
      left join media.media_assets cover
        on cover.id = release.cover_asset_id
       and cover.publication_status = 'published'::media.publication_status
      where rt.track_id = track.id
      order by release.scheduled_release_at desc nulls last,
               release.release_date desc nulls last,
               rt.disc_number,
               rt.track_number
      limit 1
    ) release_context on true
    where track.id = entity_id
      and track.publication_status = 'published'::media.publication_status;

    if preview is not null then return preview; end if;
  end if;

  -- Learn cantor.
  match_parts := regexp_match(clean_path, '^/learn/cantor/([0-9a-fA-F-]{36})/?$');
  if match_parts is not null then
    entity_id := match_parts[1]::uuid;
    select jsonb_build_object(
      'title', coalesce(localization.display_name, cantor.display_name),
      'description', coalesce(localization.biography, cantor.biography, 'Learn on Coptic Vine'),
      'imageAsset', case when profile.id is null then null else jsonb_build_object(
        'id', profile.id, 'provider', profile.provider, 'bucket', profile.bucket,
        'path', profile.path, 'mimeType', profile.mime_type
      ) end
    )
    into preview
    from learning.cantors cantor
    left join learning.cantor_localizations localization
      on localization.cantor_id = cantor.id
     and localization.locale = p_locale
    left join media.media_assets profile
      on profile.id = cantor.profile_image_asset_id
     and profile.publication_status = 'published'::media.publication_status
    where cantor.id = entity_id
      and cantor.publication_status = 'published'::media.publication_status;

    if preview is not null then return preview; end if;
  end if;

  -- Learn album.
  match_parts := regexp_match(clean_path, '^/learn/album/([0-9a-fA-F-]{36})/?$');
  if match_parts is not null then
    entity_id := match_parts[1]::uuid;
    select jsonb_build_object(
      'title', coalesce(localization.title, album.title),
      'description', concat_ws(' — ',
        coalesce(localization.description, album.description),
        coalesce(cantor_localization.display_name, cantor.display_name)
      ),
      'imageAsset', case when cover.id is null then null else jsonb_build_object(
        'id', cover.id, 'provider', cover.provider, 'bucket', cover.bucket,
        'path', cover.path, 'mimeType', cover.mime_type
      ) end
    )
    into preview
    from learning.albums album
    join learning.cantors cantor
      on cantor.id = album.cantor_id
     and cantor.publication_status = 'published'::media.publication_status
    left join learning.album_localizations localization
      on localization.album_id = album.id
     and localization.locale = p_locale
    left join learning.cantor_localizations cantor_localization
      on cantor_localization.cantor_id = cantor.id
     and cantor_localization.locale = p_locale
    left join media.media_assets cover
      on cover.id = album.cover_asset_id
     and cover.publication_status = 'published'::media.publication_status
    where album.id = entity_id
      and album.publication_status = 'published'::media.publication_status;

    if preview is not null then return preview; end if;
  end if;

  -- Learn lesson: use the lesson-set artwork.
  match_parts := regexp_match(clean_path, '^/learn/lesson/([0-9a-fA-F-]{36})/?$');
  if match_parts is not null then
    entity_id := match_parts[1]::uuid;
    select jsonb_build_object(
      'title', coalesce(lesson_localization.title, lesson.title),
      'description', concat_ws(' — ',
        coalesce(lesson_set_localization.title, lesson_set.title),
        coalesce(cantor_localization.display_name, cantor.display_name)
      ),
      'imageAsset', case when cover.id is null then null else jsonb_build_object(
        'id', cover.id, 'provider', cover.provider, 'bucket', cover.bucket,
        'path', cover.path, 'mimeType', cover.mime_type
      ) end
    )
    into preview
    from learning.lessons lesson
    join learning.lesson_sets lesson_set
      on lesson_set.id = lesson.lesson_set_id
     and lesson_set.publication_status = 'published'::media.publication_status
    join learning.cantors cantor
      on cantor.id = lesson_set.cantor_id
     and cantor.publication_status = 'published'::media.publication_status
    left join learning.lesson_localizations lesson_localization
      on lesson_localization.lesson_id = lesson.id
     and lesson_localization.locale = p_locale
    left join learning.lesson_set_localizations lesson_set_localization
      on lesson_set_localization.lesson_set_id = lesson_set.id
     and lesson_set_localization.locale = p_locale
    left join learning.cantor_localizations cantor_localization
      on cantor_localization.cantor_id = cantor.id
     and cantor_localization.locale = p_locale
    left join media.media_assets cover
      on cover.id = lesson_set.cover_asset_id
     and cover.publication_status = 'published'::media.publication_status
    where lesson.id = entity_id
      and lesson.publication_status = 'published'::media.publication_status;

    if preview is not null then return preview; end if;
  end if;

  return jsonb_build_object(
    'title', 'Coptic Vine',
    'description', 'Cross-platform Coptic Orthodox worship app for multilingual liturgical books, Scripture, and hymns.',
    'imageAsset', null
  );
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_storage_gc_candidates(p_worker_token text, p_due_only boolean DEFAULT true, p_limit integer DEFAULT 250)
 RETURNS TABLE(bucket text, path text, file_size_bytes bigint, first_unused_at timestamp with time zone, last_seen_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.verify_media_worker_token(p_worker_token) then
    raise exception 'Invalid media worker token' using errcode = '28000';
  end if;

  delete from media.storage_gc_candidates candidate
  where private.storage_object_is_referenced(candidate.bucket, candidate.path);

  return query
  select
    candidate.bucket,
    candidate.path,
    candidate.file_size_bytes,
    candidate.first_unused_at,
    candidate.last_seen_at
  from media.storage_gc_candidates candidate
  where not p_due_only
     or candidate.first_unused_at <= now() - interval '3 days'
  order by candidate.first_unused_at, candidate.bucket, candidate.path
  limit greatest(1, least(coalesce(p_limit, 250), 1000));
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_submission_editor(p_submission_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_sunday_message(p_sunday date)
 RETURNS text
 LANGUAGE sql
 STABLE
AS $function$
  select nullif(btrim(elem->>'sunday_message'), '')
  from jsonb_array_elements(public.get_calendar_readings(p_sunday)) elem
  where elem->>'service' = 'Liturgy'
    and elem->>'reading_type' = 'Gospel'
  limit 1;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_synaxarium_year(p_reference_date date)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with reference_day as (
    select coptic_year
    from calendar.coptic_date_conversions
    where gregorian_date = p_reference_date
    limit 1
  ),
  days as (
    select
      d.gregorian_date,
      d.coptic_year,
      d.coptic_month,
      d.coptic_month_name,
      d.coptic_day,
      d.weekday_number
    from calendar.coptic_date_conversions d
    join reference_day r on r.coptic_year = d.coptic_year
  ),
  entries as (
    select
      days.gregorian_date,
      days.coptic_year,
      days.coptic_month,
      days.coptic_month_name,
      days.coptic_day,
      days.weekday_number,
      e.entry_key,
      e.entry_order,
      e.title_english,
      e.title_arabic
    from days
    left join synaxarium.entries e
      on e.coptic_month = days.coptic_month
     and e.coptic_day = days.coptic_day
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'gregorianDate', gregorian_date,
        'copticYear', coptic_year,
        'copticMonth', coptic_month,
        'copticMonthName', coptic_month_name,
        'copticDay', coptic_day,
        'weekdayNumber', weekday_number,
        'entryKey', entry_key,
        'entryOrder', entry_order,
        'titleEnglish', title_english,
        'titleArabic', title_arabic
      )
      order by gregorian_date, entry_order nulls last
    ),
    '[]'::jsonb
  )
  from entries;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_track_lyric_draft(p_track_id uuid, p_locale text, p_kind music.lyric_kind)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  request_user_id uuid := auth.uid();
  payload jsonb;
begin
  if request_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not (select private.music_track_is_editable(p_track_id)) then
    raise exception 'Track not found or not editable' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'id', lyric_set.id,
    'trackId', lyric_set.track_id,
    'locale', lyric_set.locale,
    'kind', lyric_set.kind,
    'syncPrecision', lyric_set.sync_precision,
    'title', lyric_set.title,
    'source', lyric_set.source,
    'publicationStatus', lyric_set.publication_status,
    'lines', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', lyric_line.id,
        'sequence', lyric_line.sequence,
        'startMs', lyric_line.start_ms,
        'endMs', lyric_line.end_ms,
        'text', lyric_line.text
      ) order by lyric_line.sequence)
      from music.lyric_lines lyric_line
      where lyric_line.lyric_set_id = lyric_set.id
    ), '[]'::jsonb)
  )
  into payload
  from music.lyric_sets lyric_set
  where lyric_set.track_id = p_track_id
    and lyric_set.locale = p_locale
    and lyric_set.kind = p_kind;

  return payload;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.get_track_lyric_language_draft(p_track_id uuid, p_locale text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  draft music.lyric_edit_drafts%rowtype;
  lyric_set music.lyric_sets%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not private.music_track_is_editable(p_track_id) then
    raise exception 'Track not found or not editable' using errcode = '42501';
  end if;

  select * into draft
  from music.lyric_edit_drafts
  where track_id = p_track_id and locale = p_locale;

  select * into lyric_set
  from music.lyric_sets
  where track_id = p_track_id
    and locale = p_locale
    and kind = 'original'::music.lyric_kind;

  if draft.track_id is not null then
    return jsonb_build_object(
      'id', lyric_set.id,
      'trackId', p_track_id,
      'locale', p_locale,
      'description', draft.description,
      'publicationStatus', coalesce(lyric_set.publication_status, 'draft'::media.publication_status),
      'hasDraft', true,
      'syncPrecision', draft.sync_precision,
      'lines', draft.lines
    );
  end if;

  if lyric_set.id is null then
    return null;
  end if;

  return jsonb_build_object(
    'id', lyric_set.id,
    'trackId', p_track_id,
    'locale', p_locale,
    'description', lyric_set.description,
    'publicationStatus', lyric_set.publication_status,
    'hasDraft', false,
    'syncPrecision', lyric_set.sync_precision,
    'lines', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', line.id,
        'sequence', line.sequence,
        'startMs', line.start_ms,
        'endMs', line.end_ms,
        'text', line.text
      ) order by line.sequence)
      from music.lyric_lines line
      where line.lyric_set_id = lyric_set.id
    ), '[]'::jsonb)
  );
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.heartbeat_media_processing_jobs(p_worker_token text, p_job_ids uuid[], p_progress real DEFAULT NULL::real)
 RETURNS TABLE(job_id uuid, status media.processing_job_status)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
begin
  if not private.verify_media_worker_token(p_worker_token) then
    raise exception 'Invalid media worker token' using errcode = '28000';
  end if;

  update media.media_processing_jobs job
  set heartbeat_at = now(),
      progress = case when p_progress is null then job.progress else least(greatest(p_progress, 0::real), 1::real) end
  where job.id = any(p_job_ids)
    and job.status = 'processing'::media.processing_job_status;

  return query
  select job.id, job.status
  from media.media_processing_jobs job
  where job.id = any(p_job_ids);
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.is_chc_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select private.is_admin();
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.learning_asset_json(a media.media_assets)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case when a.id is null then null else jsonb_strip_nulls(jsonb_build_object(
    'id', a.id, 'provider', a.provider, 'bucket', a.bucket, 'path', a.path, 'mimeType', a.mime_type,
    'durationMs', a.duration_ms, 'fileSizeBytes', a.file_size_bytes, 'checksum', a.checksum,
    'width', a.width, 'height', a.height
  )) end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.learning_lesson_title(p_locale text, p_number bigint)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case
    when p_locale = 'ar' then 'الدرس ' || p_number::text
    when p_locale = 'fr' then 'Leçon ' || p_number::text
    else 'Lesson ' || p_number::text
  end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.media_processing_queue_has_work(p_worker_token text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.verify_media_worker_token(p_worker_token) then
    raise exception 'Invalid media worker token' using errcode = '28000';
  end if;

  -- What claim_media_processing_job would pick up: a due job with attempts
  -- left, or one whose worker stopped (claiming requeues or fails it).
  return exists (
    select 1
    from media.media_processing_jobs job
    where (job.status = 'queued'::media.processing_job_status
           and job.available_at <= now()
           and job.attempt_count < job.max_attempts)
       or (job.status = 'processing'::media.processing_job_status
           and private.media_processing_job_is_stale(job.job_type, job.claimed_at, job.heartbeat_at))
  );
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.prepare_admin_processing_file_deletion(p_job_id uuid)
 RETURNS TABLE(job_id uuid, upload_intent_id uuid, media_asset_id uuid, related_job_count integer, objects jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  request_user_id uuid := auth.uid();
  root_job media.media_processing_jobs%rowtype;
begin
  if request_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not (select private.is_admin()) then
    raise exception 'Admin role required' using errcode = '42501';
  end if;

  select *
  into root_job
  from media.media_processing_jobs job
  where job.id = p_job_id
  for update;

  if not found then
    raise exception 'Processing job not found' using errcode = 'P0002';
  end if;

  -- Cancel every job that belongs to the same underlying upload/asset before
  -- object deletion. A worker trying to complete afterwards will be rejected
  -- because complete_media_processing_job requires status = processing.
  update media.media_processing_jobs job
  set status = 'cancelled'::media.processing_job_status,
      worker_id = null,
      finished_at = coalesce(job.finished_at, now()),
      error_message = 'Permanently deleted by Coptic Vine Admin',
      updated_at = now()
  where job.id = root_job.id
     or (root_job.upload_intent_id is not null and job.upload_intent_id = root_job.upload_intent_id)
     or (root_job.media_asset_id is not null and job.media_asset_id = root_job.media_asset_id);

  return query
  with related_jobs as (
    select job.*
    from media.media_processing_jobs job
    where job.id = root_job.id
       or (root_job.upload_intent_id is not null and job.upload_intent_id = root_job.upload_intent_id)
       or (root_job.media_asset_id is not null and job.media_asset_id = root_job.media_asset_id)
  ),
  object_rows as (
    select related.input_bucket as bucket, related.input_path as path
    from related_jobs related
    where related.input_bucket is not null and related.input_path is not null

    union
    select related.output_bucket, related.output_path
    from related_jobs related
    where related.output_bucket is not null and related.output_path is not null

    union
    select upload.bucket, upload.path
    from media.upload_intents upload
    where upload.id = root_job.upload_intent_id

    union
    select asset.bucket, asset.path
    from media.media_assets asset
    where asset.id = root_job.media_asset_id

    union
    select version.bucket, version.path
    from media.media_asset_versions version
    where version.media_asset_id = root_job.media_asset_id
  )
  select
    root_job.id,
    root_job.upload_intent_id,
    root_job.media_asset_id,
    (select count(*)::integer from related_jobs),
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object('bucket', object_rows.bucket, 'path', object_rows.path)
          order by object_rows.bucket, object_rows.path
        )
        from object_rows
      ),
      '[]'::jsonb
    );
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.prepare_storage_gc_candidate(p_worker_token text, p_bucket text, p_path text)
 RETURNS TABLE(authorized boolean, database_rows_removed integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  removed integer := 0;
  affected integer := 0;
  asset_ids uuid[];
  version_ids uuid[];
  upload_ids uuid[];
begin
  if not private.verify_media_worker_token(p_worker_token) then
    raise exception 'Invalid media worker token' using errcode = '28000';
  end if;

  if private.storage_object_is_referenced(p_bucket, p_path) then
    delete from media.storage_gc_candidates candidate
    where candidate.bucket = p_bucket and candidate.path = p_path;
    return query select false, 0;
    return;
  end if;

  select coalesce(array_agg(distinct asset.id), '{}'::uuid[])
  into asset_ids
  from media.media_assets asset
  where asset.bucket = p_bucket
    and asset.path = p_path
    and not private.storage_asset_is_referenced(asset.id);

  select coalesce(array_agg(distinct version.id), '{}'::uuid[])
  into version_ids
  from media.media_asset_versions version
  where version.bucket = p_bucket
    and version.path = p_path
    and not private.storage_asset_version_is_referenced(version.id);

  select coalesce(array_agg(distinct upload.id), '{}'::uuid[])
  into upload_ids
  from media.upload_intents upload
  where upload.bucket = p_bucket
    and upload.path = p_path
    and not private.storage_upload_intent_is_referenced(upload.id);

  delete from media.media_processing_jobs job
  where job.status in (
      'completed'::media.processing_job_status,
      'cancelled'::media.processing_job_status
    )
    and (
      job.media_asset_id = any(asset_ids)
      or job.upload_intent_id = any(upload_ids)
      or job.media_asset_version_id = any(version_ids)
      or (job.input_bucket = p_bucket and job.input_path = p_path)
      or (job.output_bucket = p_bucket and job.output_path = p_path)
    );
  get diagnostics affected = row_count;
  removed := removed + affected;

  update music.play_history history
  set media_asset_id = null
  where history.media_asset_id = any(asset_ids);
  get diagnostics affected = row_count;
  removed := removed + affected;

  delete from media.media_asset_versions version
  where version.id = any(version_ids)
     or version.media_asset_id = any(asset_ids);
  get diagnostics affected = row_count;
  removed := removed + affected;

  delete from media.media_assets asset
  where asset.id = any(asset_ids);
  get diagnostics affected = row_count;
  removed := removed + affected;

  delete from media.upload_intents upload
  where upload.id = any(upload_ids);
  get diagnostics affected = row_count;
  removed := removed + affected;

  return query select true, removed;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.publish_learning_album(p_album_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare v_album learning.albums%rowtype;
begin
  if auth.uid() is null or not private.is_admin() then raise exception 'Admin access required'; end if;
  select * into v_album from learning.albums where id = p_album_id;
  if not found then raise exception 'Learning album not found'; end if;
  if not exists (select 1 from learning.cantors c where c.id = v_album.cantor_id and c.publication_status = 'published') then raise exception 'Cantor must be published first'; end if;
  if v_album.season_id is not null and not exists (select 1 from learning.seasons s where s.id = v_album.season_id and s.publication_status = 'published') then raise exception 'Season must be published first'; end if;
  if v_album.submission_id is not null and not exists (select 1 from media.submissions s where s.id = v_album.submission_id and s.submission_type = 'learning_album' and s.creator_account_id = v_album.owner_creator_account_id and s.status in ('approved', 'published')) then raise exception 'Learning album submission must be approved'; end if;
  if not exists (select 1 from learning.album_recordings r where r.album_id = p_album_id) then raise exception 'Learning album must contain at least one recording'; end if;
  if exists (
    select 1 from learning.album_recordings r
    left join media.media_assets ma on ma.id = r.media_asset_id
    where r.album_id = p_album_id and (ma.id is null or ma.media_type <> 'audio' or ma.processing_status <> 'completed' or ma.publication_status <> 'published')
  ) then raise exception 'Every album recording must reference a published processed audio asset'; end if;
  if v_album.cover_asset_id is not null and not exists (select 1 from media.media_assets ma where ma.id = v_album.cover_asset_id and ma.media_type = 'image' and ma.processing_status = 'completed' and ma.publication_status = 'published') then raise exception 'Album cover must be a published processed image asset'; end if;
  update learning.album_recordings set publication_status = 'published', updated_by = auth.uid() where album_id = p_album_id;
  update learning.albums set publication_status = 'published', updated_by = auth.uid() where id = p_album_id;
  return jsonb_build_object('id', p_album_id, 'publicationStatus', 'published');
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.publish_learning_cantor(p_cantor_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  if auth.uid() is null or not private.is_admin() then raise exception 'Admin access required'; end if;
  if not exists (select 1 from learning.cantors where id = p_cantor_id) then raise exception 'Cantor not found'; end if;
  if exists (
    select 1 from learning.cantors c
    left join media.media_assets ma on ma.id = c.profile_image_asset_id
    where c.id = p_cantor_id and c.profile_image_asset_id is not null
      and (ma.id is null or ma.publication_status <> 'published' or ma.processing_status <> 'completed')
  ) then raise exception 'Cantor profile image must be a published processed asset'; end if;
  update learning.cantors set publication_status = 'published', updated_by = auth.uid() where id = p_cantor_id;
  return jsonb_build_object('id', p_cantor_id, 'publicationStatus', 'published');
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.publish_learning_lesson_set(p_lesson_set_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare v_set learning.lesson_sets%rowtype;
begin
  if auth.uid() is null or not private.is_admin() then raise exception 'Admin access required'; end if;
  select * into v_set from learning.lesson_sets where id = p_lesson_set_id;
  if not found then raise exception 'Learning lesson set not found'; end if;
  if not exists (select 1 from learning.cantors c where c.id = v_set.cantor_id and c.publication_status = 'published') then raise exception 'Cantor must be published first'; end if;
  if not exists (select 1 from learning.hymns h where h.id = v_set.hymn_id and h.publication_status = 'published') then raise exception 'Hymn must be published first'; end if;
  if v_set.season_id is not null and not exists (select 1 from learning.seasons s where s.id = v_set.season_id and s.publication_status = 'published') then raise exception 'Season must be published first'; end if;
  if v_set.submission_id is not null and not exists (select 1 from media.submissions s where s.id = v_set.submission_id and s.submission_type = 'learning_lesson_set' and s.creator_account_id = v_set.owner_creator_account_id and s.status in ('approved', 'published')) then raise exception 'Learning lesson-set submission must be approved'; end if;
  if not exists (select 1 from learning.lessons l where l.lesson_set_id = p_lesson_set_id) then raise exception 'Lesson set must contain at least one lesson'; end if;
  if exists (
    select 1 from learning.lessons l
    left join media.media_assets ma on ma.id = l.media_asset_id
    where l.lesson_set_id = p_lesson_set_id
      and (ma.id is null or ma.media_type::text <> l.media_type::text or ma.processing_status <> 'completed' or ma.publication_status <> 'published')
  ) then raise exception 'Every lesson must reference a published processed asset of the matching media type'; end if;
  if v_set.cover_asset_id is not null and not exists (select 1 from media.media_assets ma where ma.id = v_set.cover_asset_id and ma.media_type = 'image' and ma.processing_status = 'completed' and ma.publication_status = 'published') then raise exception 'Lesson-set cover must be a published processed image asset'; end if;
  update learning.lessons set publication_status = 'published', updated_by = auth.uid() where lesson_set_id = p_lesson_set_id;
  update learning.lesson_sets set publication_status = 'published', updated_by = auth.uid() where id = p_lesson_set_id;
  return jsonb_build_object('id', p_lesson_set_id, 'publicationStatus', 'published');
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.publish_learning_lyric_languages(p_item_kind learning.playlist_item_kind, p_item_id uuid, p_sync_precision music.lyric_sync_precision, p_locales text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare request_user_id uuid:=auth.uid(); requested_locale text; draft learning.lyric_edit_drafts%rowtype; v_lyric_set_id uuid; invalid_count integer;
begin
  if request_user_id is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if not private.learning_lyric_item_is_editable(p_item_kind,p_item_id) then raise exception 'Learning item not editable' using errcode='42501'; end if;
  if p_item_kind='lesson' and p_sync_precision<>'unsynced' then raise exception 'Lesson sets support unsynced lyrics only' using errcode='22023'; end if;
  if p_sync_precision not in ('unsynced','line') then raise exception 'Unsupported lyric sync precision' using errcode='22023'; end if;
  foreach requested_locale in array p_locales loop
    select * into draft from learning.lyric_edit_drafts d where d.item_kind=p_item_kind
      and coalesce(d.album_recording_id,d.lesson_id)=p_item_id and d.locale=requested_locale;
    if draft.lines is null or jsonb_array_length(draft.lines)=0 then raise exception 'Add lyric lines before publishing' using errcode='22023'; end if;
    if p_sync_precision='line' then
      select count(*) into invalid_count from jsonb_array_elements(draft.lines) line
        where nullif(trim(coalesce(line->>'startMs','')),'') is null;
      if invalid_count>0 then raise exception 'Every lyric row needs a start time' using errcode='22023'; end if;
    end if;
    select id into v_lyric_set_id from learning.lyric_sets s where s.item_kind=p_item_kind
      and coalesce(s.album_recording_id,s.lesson_id)=p_item_id and s.locale=requested_locale for update;
    if v_lyric_set_id is null then
      insert into learning.lyric_sets(item_kind,album_recording_id,lesson_id,locale,sync_precision,description,publication_status,created_by,updated_by)
      values(p_item_kind,case when p_item_kind='album_recording' then p_item_id end,case when p_item_kind='lesson' then p_item_id end,
        requested_locale,p_sync_precision,draft.description,'published'::media.publication_status,request_user_id,request_user_id)
      returning id into v_lyric_set_id;
    else
      update learning.lyric_sets set sync_precision=p_sync_precision,description=draft.description,
        publication_status='published'::media.publication_status,updated_by=request_user_id,updated_at=now() where id=v_lyric_set_id;
      delete from learning.lyric_lines ll where ll.lyric_set_id=v_lyric_set_id;
    end if;
    insert into learning.lyric_lines(lyric_set_id,sequence,start_ms,end_ms,text)
    select v_lyric_set_id,line.ordinality::integer,
      case when p_sync_precision='line' then (line.value->>'startMs')::bigint end,
      case when p_sync_precision='line' and nullif(trim(coalesce(line.value->>'endMs','')),'') is not null then (line.value->>'endMs')::bigint end,
      coalesce(line.value->>'text','') from jsonb_array_elements(draft.lines) with ordinality line(value,ordinality);
    delete from learning.lyric_edit_drafts d where d.item_kind=p_item_kind
      and coalesce(d.album_recording_id,d.lesson_id)=p_item_id and d.locale=requested_locale;
  end loop;
  return jsonb_build_object('trackId',p_item_id,'locales',to_jsonb(p_locales),'publishedAt',now());
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.publish_media_submission(p_submission_id uuid)
 RETURNS TABLE(submission_id uuid, status media.publication_status, published_at timestamp with time zone, published_asset_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  request_user_id uuid := auth.uid();
  current_submission media.submissions%rowtype;
  previous_status media.publication_status;
begin
  published_asset_count := 0;

  if request_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not (select private.is_admin()) then
    raise exception 'Admin role required' using errcode = '42501';
  end if;

  select *
  into current_submission
  from media.submissions submission
  where submission.id = p_submission_id
  for update;

  if not found then
    raise exception 'Submission not found' using errcode = 'P0002';
  end if;

  if current_submission.status not in (
    'approved'::media.publication_status,
    'processing'::media.publication_status
  ) then
    raise exception 'Submission is not approved or processing' using errcode = '22023';
  end if;

  perform private.attach_completed_submission_jobs(current_submission.id);

  if not (select private.submission_required_items_ready(current_submission.id)) then
    raise exception 'Submission still has required items waiting for processing' using errcode = '22023';
  end if;

  previous_status := current_submission.status;

  with published_assets as (
    update media.media_assets asset
    set publication_status = 'published'::media.publication_status,
        updated_by = request_user_id,
        updated_at = now()
    from (
      select distinct item.media_asset_id
      from media.submission_items item
      where item.submission_id = current_submission.id
        and item.media_asset_id is not null
    ) asset_to_publish
    where asset.id = asset_to_publish.media_asset_id
    returning asset.id
  )
  select count(*)::integer
  into published_asset_count
  from published_assets;

  update media.submissions submission
  set status = 'published'::media.publication_status,
      published_at = now(),
      updated_by = request_user_id
  where submission.id = current_submission.id
  returning * into current_submission;

  perform private.add_media_submission_event(
    current_submission.id,
    request_user_id,
    'published',
    previous_status,
    current_submission.status,
    null,
    jsonb_build_object('publishedAssetCount', published_asset_count)
  );

  return query
  select
    current_submission.id,
    current_submission.status,
    current_submission.published_at,
    published_asset_count;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.publish_music_release(p_release_id uuid)
 RETURNS TABLE(release_id uuid, status media.publication_status, published_track_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  request_user_id uuid := auth.uid();
  release_record music.releases%rowtype;
  invalid_required_count integer := 0;
begin
  if request_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not (select private.is_admin()) then
    raise exception 'Admin role required' using errcode = '42501';
  end if;

  select *
  into release_record
  from music.releases release
  where release.id = p_release_id
  for update;

  if not found then
    raise exception 'Release not found' using errcode = 'P0002';
  end if;

  select count(*)::integer
  into published_track_count
  from music.release_tracks release_track
  where release_track.release_id = release_record.id;

  if published_track_count = 0 then
    raise exception 'Release must have at least one track' using errcode = '22023';
  end if;

  select count(*)::integer
  into invalid_required_count
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

  if invalid_required_count > 0 then
    raise exception 'Release has tracks without completed published media assets' using errcode = '22023';
  end if;

  update music.artists artist
  set publication_status = 'published'::media.publication_status,
      updated_by = request_user_id,
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
      updated_by = request_user_id,
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
      updated_by = request_user_id,
      updated_at = now()
  where track.id in (
    select release_track.track_id
    from music.release_tracks release_track
    where release_track.release_id = release_record.id
  );

  update music.track_localizations localization
  set publication_status = 'published'::media.publication_status,
      updated_by = request_user_id,
      updated_at = now()
  where localization.track_id in (
    select release_track.track_id
    from music.release_tracks release_track
    where release_track.release_id = release_record.id
  );

  update music.release_localizations localization
  set publication_status = 'published'::media.publication_status,
      updated_by = request_user_id,
      updated_at = now()
  where localization.release_id = release_record.id;

  update music.releases release
  set publication_status = 'published'::media.publication_status,
      updated_by = request_user_id,
      updated_at = now()
  where release.id = release_record.id
  returning * into release_record;

  return query
  select release_record.id, release_record.publication_status, published_track_count;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.publish_track_lyric_languages(p_track_id uuid, p_locales text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  request_user_id uuid := auth.uid();
  requested_locale text;
  source_description text;
  source_lines jsonb;
  v_lyric_set_id uuid;
  invalid_count integer;
  published_locales text[] := '{}'::text[];
begin
  if request_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not (select private.music_track_is_editable(p_track_id)) then
    raise exception 'Track not found or not editable' using errcode = '42501';
  end if;

  if p_locales is null or cardinality(p_locales) = 0 then
    raise exception 'Choose at least one lyric language to publish' using errcode = '22023';
  end if;

  foreach requested_locale in array p_locales loop
    if not exists (
      select 1
      from media.locales locale
      where locale.code = requested_locale
        and locale.enabled
    ) then
      raise exception 'Unsupported or disabled lyric locale: %', requested_locale using errcode = '22023';
    end if;

    select draft.description, draft.lines
    into source_description, source_lines
    from music.lyric_edit_drafts draft
    where draft.track_id = p_track_id
      and draft.locale = requested_locale;

    if source_lines is null then
      select
        lyric_set.description,
        coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', lyric_line.id,
            'sequence', lyric_line.sequence,
            'startMs', lyric_line.start_ms,
            'endMs', lyric_line.end_ms,
            'text', lyric_line.text
          ) order by lyric_line.sequence)
          from music.lyric_lines lyric_line
          where lyric_line.lyric_set_id = lyric_set.id
        ), '[]'::jsonb)
      into source_description, source_lines
      from music.lyric_sets lyric_set
      where lyric_set.track_id = p_track_id
        and lyric_set.locale = requested_locale
        and lyric_set.kind = 'original'::music.lyric_kind;
    end if;

    if source_lines is null or jsonb_array_length(source_lines) = 0 then
      raise exception 'Add at least one % lyric line before publishing', requested_locale using errcode = '22023';
    end if;

    -- Text may intentionally be blank in one language for a shared row.
    -- Timing belongs to the shared row and is still required for publication.
    select count(*)::integer
    into invalid_count
    from jsonb_array_elements(source_lines) line
    where nullif(trim(coalesce(line->>'startMs', '')), '') is null;

    if invalid_count > 0 then
      raise exception 'Every lyric row needs a synchronized start time before publishing' using errcode = '22023';
    end if;

    select count(*)::integer
    into invalid_count
    from (
      select
        (line.value->>'startMs')::bigint as start_ms,
        lag((line.value->>'startMs')::bigint) over (order by line.ordinality) as previous_start_ms
      from jsonb_array_elements(source_lines) with ordinality line(value, ordinality)
    ) ordered_line
    where ordered_line.previous_start_ms is not null
      and ordered_line.start_ms < ordered_line.previous_start_ms;

    if invalid_count > 0 then
      raise exception 'Lyric timestamps must be ordered by line' using errcode = '22023';
    end if;

    select count(*)::integer
    into invalid_count
    from (
      select
        case
          when nullif(trim(coalesce(line.value->>'endMs', '')), '') is null then null
          else (line.value->>'endMs')::bigint
        end as end_ms,
        lead((line.value->>'startMs')::bigint) over (order by line.ordinality) as next_start_ms
      from jsonb_array_elements(source_lines) with ordinality line(value, ordinality)
    ) ordered_line
    where ordered_line.end_ms is not null
      and ordered_line.next_start_ms is not null
      and ordered_line.end_ms > ordered_line.next_start_ms;

    if invalid_count > 0 then
      raise exception 'Lyric line end times must not overlap the next line' using errcode = '22023';
    end if;

    select lyric_set.id
    into v_lyric_set_id
    from music.lyric_sets lyric_set
    where lyric_set.track_id = p_track_id
      and lyric_set.locale = requested_locale
      and lyric_set.kind = 'original'::music.lyric_kind
    for update;

    if v_lyric_set_id is null then
      insert into music.lyric_sets (
        track_id,
        locale,
        kind,
        sync_precision,
        description,
        publication_status,
        created_by,
        updated_by
      ) values (
        p_track_id,
        requested_locale,
        'original'::music.lyric_kind,
        'line'::music.lyric_sync_precision,
        nullif(trim(source_description), ''),
        'published'::media.publication_status,
        request_user_id,
        request_user_id
      )
      returning id into v_lyric_set_id;
    else
      update music.lyric_sets lyric_set
      set sync_precision = 'line'::music.lyric_sync_precision,
          description = nullif(trim(source_description), ''),
          publication_status = 'published'::media.publication_status,
          updated_by = request_user_id,
          updated_at = now()
      where lyric_set.id = v_lyric_set_id;
    end if;

    delete from music.lyric_lines lyric_line
    where lyric_line.lyric_set_id = v_lyric_set_id;

    insert into music.lyric_lines (
      lyric_set_id,
      sequence,
      start_ms,
      end_ms,
      text
    )
    select
      v_lyric_set_id,
      line.ordinality::integer,
      (line.value->>'startMs')::bigint,
      case
        when nullif(trim(coalesce(line.value->>'endMs', '')), '') is null then null
        else (line.value->>'endMs')::bigint
      end,
      coalesce(line.value->>'text', '')
    from jsonb_array_elements(source_lines) with ordinality line(value, ordinality);

    delete from music.lyric_edit_drafts draft
    where draft.track_id = p_track_id
      and draft.locale = requested_locale;

    published_locales := array_append(published_locales, requested_locale);
  end loop;

  return jsonb_build_object(
    'trackId', p_track_id,
    'locales', to_jsonb(published_locales),
    'publishedAt', now()
  );
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.publish_track_lyric_languages_v2(p_track_id uuid, p_locales text[], p_sync_precision music.lyric_sync_precision DEFAULT 'line'::music.lyric_sync_precision)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare request_user_id uuid:=auth.uid(); requested_locale text; draft music.lyric_edit_drafts%rowtype; v_lyric_set_id uuid; invalid_count integer;
begin
  if request_user_id is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if not private.music_track_is_editable(p_track_id) then raise exception 'Track not editable' using errcode='42501'; end if;
  if p_sync_precision not in ('unsynced','line') then raise exception 'Unsupported lyric sync precision' using errcode='22023'; end if;
  foreach requested_locale in array p_locales loop
    select * into draft from music.lyric_edit_drafts d where d.track_id=p_track_id and d.locale=requested_locale;
    if draft.lines is null or jsonb_array_length(draft.lines)=0 then raise exception 'Add lyric lines before publishing' using errcode='22023'; end if;
    if p_sync_precision='line' then
      select count(*) into invalid_count from jsonb_array_elements(draft.lines) line where nullif(trim(coalesce(line->>'startMs','')),'') is null;
      if invalid_count>0 then raise exception 'Every lyric row needs a start time' using errcode='22023'; end if;
    end if;
    select id into v_lyric_set_id from music.lyric_sets where track_id=p_track_id and locale=requested_locale and kind='original'::music.lyric_kind for update;
    if v_lyric_set_id is null then
      insert into music.lyric_sets(track_id,locale,kind,sync_precision,description,publication_status,created_by,updated_by)
      values(p_track_id,requested_locale,'original'::music.lyric_kind,p_sync_precision,draft.description,'published'::media.publication_status,request_user_id,request_user_id)
      returning id into v_lyric_set_id;
    else
      update music.lyric_sets set sync_precision=p_sync_precision,description=draft.description,
        publication_status='published'::media.publication_status,updated_by=request_user_id,updated_at=now() where id=v_lyric_set_id;
      delete from music.lyric_lines ll where ll.lyric_set_id=v_lyric_set_id;
    end if;
    insert into music.lyric_lines(lyric_set_id,sequence,start_ms,end_ms,text)
    select v_lyric_set_id,line.ordinality::integer,
      case when p_sync_precision='line' then (line.value->>'startMs')::bigint end,
      case when p_sync_precision='line' and nullif(trim(coalesce(line.value->>'endMs','')),'') is not null then (line.value->>'endMs')::bigint end,
      coalesce(line.value->>'text','') from jsonb_array_elements(draft.lines) with ordinality line(value,ordinality);
    delete from music.lyric_edit_drafts where track_id=p_track_id and locale=requested_locale;
  end loop;
  return jsonb_build_object('trackId',p_track_id,'locales',to_jsonb(p_locales),'publishedAt',now());
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.publish_track_lyric_set(p_lyric_set_id uuid)
 RETURNS TABLE(lyric_set_id uuid, status media.publication_status, line_count integer, sync_precision music.lyric_sync_precision)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  request_user_id uuid := auth.uid();
  lyric_set_record music.lyric_sets%rowtype;
  track_status media.publication_status;
  invalid_line_count integer := 0;
begin
  if request_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not (select private.is_admin()) then
    raise exception 'Admin role required' using errcode = '42501';
  end if;

  select *
  into lyric_set_record
  from music.lyric_sets lyric_set
  where lyric_set.id = p_lyric_set_id
  for update;

  if not found then
    raise exception 'Lyric set not found' using errcode = 'P0002';
  end if;

  select track.publication_status
  into track_status
  from music.tracks track
  where track.id = lyric_set_record.track_id;

  if track_status <> 'published'::media.publication_status then
    raise exception 'Lyric set track must be published first' using errcode = '22023';
  end if;

  select count(*)::integer
  into line_count
  from music.lyric_lines lyric_line
  where lyric_line.lyric_set_id = lyric_set_record.id;

  if line_count = 0 then
    raise exception 'Lyric set must contain at least one line' using errcode = '22023';
  end if;

  if lyric_set_record.sync_precision in (
    'line'::music.lyric_sync_precision,
    'word'::music.lyric_sync_precision
  ) then
    select count(*)::integer
    into invalid_line_count
    from music.lyric_lines lyric_line
    where lyric_line.lyric_set_id = lyric_set_record.id
      and lyric_line.start_ms is null;

    if invalid_line_count > 0 then
      raise exception 'Line-synchronized lyric sets require every line to have start_ms' using errcode = '22023';
    end if;

    select count(*)::integer
    into invalid_line_count
    from (
      select
        lyric_line.start_ms,
        lag(lyric_line.start_ms) over (order by lyric_line.sequence) as previous_start_ms
      from music.lyric_lines lyric_line
      where lyric_line.lyric_set_id = lyric_set_record.id
    ) ordered_line
    where ordered_line.previous_start_ms is not null
      and ordered_line.start_ms < ordered_line.previous_start_ms;

    if invalid_line_count > 0 then
      raise exception 'Lyric line start_ms values must be ordered by sequence' using errcode = '22023';
    end if;

    select count(*)::integer
    into invalid_line_count
    from (
      select
        lyric_line.end_ms,
        lead(lyric_line.start_ms) over (order by lyric_line.sequence) as next_start_ms
      from music.lyric_lines lyric_line
      where lyric_line.lyric_set_id = lyric_set_record.id
    ) ordered_line
    where ordered_line.end_ms is not null
      and ordered_line.next_start_ms is not null
      and ordered_line.end_ms > ordered_line.next_start_ms;

    if invalid_line_count > 0 then
      raise exception 'Lyric line end_ms values must not overlap the next line start_ms' using errcode = '22023';
    end if;
  end if;

  update music.lyric_sets lyric_set
  set publication_status = 'published'::media.publication_status,
      updated_by = request_user_id,
      updated_at = now()
  where lyric_set.id = lyric_set_record.id
  returning * into lyric_set_record;

  return query
  select
    lyric_set_record.id,
    lyric_set_record.publication_status,
    line_count,
    lyric_set_record.sync_precision;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.record_music_play(p_track_id uuid, p_release_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  request_user_id uuid := auth.uid();
  track_asset_id uuid;
begin
  if request_user_id is null then
    return false;
  end if;

  select track.media_asset_id
  into track_asset_id
  from music.tracks track
  where track.id = p_track_id
    and track.publication_status = 'published'::media.publication_status;

  if track_asset_id is null then
    raise exception 'Track not found or unavailable' using errcode = '22023';
  end if;

  if p_release_id is not null and not exists (
    select 1
    from music.release_tracks release_track
    join music.releases release
      on release.id = release_track.release_id
     and release.publication_status = 'published'::media.publication_status
    where release_track.track_id = p_track_id
      and release_track.release_id = p_release_id
  ) then
    raise exception 'Release does not contain this track' using errcode = '22023';
  end if;

  insert into music.play_history (
    user_id,
    track_id,
    release_id,
    media_asset_id,
    progress_ms,
    completed
  ) values (
    request_user_id,
    p_track_id,
    p_release_id,
    track_asset_id,
    0,
    false
  );

  -- Keep this interaction log bounded per listener. Recent Library results
  -- need only the newest entries, and analytics should not grow forever here.
  delete from music.play_history history
  where history.id in (
    select old_history.id
    from music.play_history old_history
    where old_history.user_id = request_user_id
    order by old_history.played_at desc, old_history.id desc
    offset 500
  );

  return true;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.register_notification_device(p_app_key text, p_platform text, p_provider text, p_push_token text, p_provider_data jsonb DEFAULT '{}'::jsonb, p_device_name text DEFAULT NULL::text, p_app_version text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.release_media_processing_jobs(p_worker_token text, p_job_ids uuid[], p_reason text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  affected integer := 0;
begin
  if not private.verify_media_worker_token(p_worker_token) then
    raise exception 'Invalid media worker token' using errcode = '28000';
  end if;

  update media.media_processing_jobs job
  set status = 'queued'::media.processing_job_status,
      attempt_count = greatest(job.attempt_count - 1, 0),
      worker_id = null,
      claimed_at = null,
      heartbeat_at = null,
      progress = null,
      available_at = now(),
      error_message = left(coalesce(nullif(trim(p_reason), ''), 'Released by a media worker that was shutting down'), 4000),
      updated_at = now()
  where job.id = any(p_job_ids)
    and job.status = 'processing'::media.processing_job_status;

  get diagnostics affected = row_count;
  return affected;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.remove_learning_playlist_item(p_playlist_id uuid, p_item_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  delete from learning.playlist_items pi
  where pi.id = p_item_id and pi.playlist_id = p_playlist_id
    and exists (select 1 from learning.playlists p where p.id = p_playlist_id and p.owner_user_id = auth.uid());
  return public.get_learning_playlist(p_playlist_id, 'en');
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.remove_track_from_music_playlist(p_playlist_id uuid, p_track_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not (select private.music_playlist_is_editable(p_playlist_id)) then
    raise exception 'Playlist not found or not editable' using errcode = '42501';
  end if;

  delete from music.playlist_tracks
  where playlist_id = p_playlist_id and track_id = p_track_id;
  update music.playlists set updated_at = now() where id = p_playlist_id;
  return true;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.renumber_item_order(schema_name text, table_name text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Step 1: move all item_order values far away temporarily
    EXECUTE format('
        UPDATE %I.%I
        SET item_order = item_order + 1000000
    ', schema_name, table_name);

    -- Step 2: renumber cleanly back to 1, 2, 3...
    EXECUTE format('
        WITH numbered AS (
            SELECT
                ctid,
                ROW_NUMBER() OVER (ORDER BY item_order) AS new_order
            FROM %I.%I
        )
        UPDATE %I.%I t
        SET item_order = n.new_order
        FROM numbered n
        WHERE t.ctid = n.ctid
    ',
    schema_name, table_name,
    schema_name, table_name);
END;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.renumber_line_id(schema_name text, table_name text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Move IDs far away first to avoid primary key collisions
    EXECUTE format('
        UPDATE %I.%I
        SET line_id = line_id + 1000000
    ', schema_name, table_name);

    -- Renumber back to 1, 2, 3...
    EXECUTE format('
        WITH numbered AS (
            SELECT
                ctid,
                ROW_NUMBER() OVER (ORDER BY line_id) AS new_line_id
            FROM %I.%I
        )
        UPDATE %I.%I t
        SET line_id = n.new_line_id
        FROM numbered n
        WHERE t.ctid = n.ctid
    ',
    schema_name, table_name,
    schema_name, table_name);
END;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.renumber_line_order(schema_name text, table_name text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
    EXECUTE format('
        WITH numbered AS (
            SELECT
                ctid,
                ROW_NUMBER() OVER (
                    PARTITION BY hymn_key
                    ORDER BY line_order, line_id
                ) AS new_line_order
            FROM %I.%I
        )
        UPDATE %I.%I t
        SET line_order = n.new_line_order
        FROM numbered n
        WHERE t.ctid = n.ctid
    ',
    schema_name, table_name,
    schema_name, table_name);
END;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.resolve_subdocument_target(p_hymn_key text)
 RETURNS TABLE(schema_name text, table_name text)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT t.schema_name, t.table_name FROM (VALUES
    ('ANTIPHONARY', 'psalmody', 'antiphonary'),
    ('DOXOLOGIES', 'doxologies', 'doxologies'),
    ('CANONS', 'canons', 'canons'),
    ('GOSPEL_RESPONSES', 'gospel_responses', 'gospel_responses'),
    ('GOSPEL_RITE', 'gospel_rite', 'gospel_rite'),
    ('HYMN_OF_THE_INTERCESSIONS', 'hymn_of_the_intercessions', 'hymn_of_the_intercessions'),
    ('PRAXIS_RESPONSE', 'praxis_response', 'praxis_response'),
    ('VERSES_OF_THE_CYMBALS', 'verses_of_the_cymbals', 'verses_of_the_cymbals'),
    ('SEASONAL_LITURGY_HYMNS', 'seasonal_liturgy_hymns', 'seasonal_liturgy_hymns'),
    ('THE_FIVE_SHORT_LITANIES', 'litanies', 'the_five_short_litanies'),
    ('THIRD_HOUR', 'agpeya', 'third_hour'),
    ('SIXTH_HOUR', 'agpeya', 'sixth_hour'),
    ('NINTH_HOUR', 'agpeya', 'ninth_hour'),
    ('ELEVENTH_HOUR', 'agpeya', 'eleventh_hour'),
    ('TWELFTH_HOUR', 'agpeya', 'twelfth_hour'),
    ('PRAYER_OF_THE_VEIL', 'agpeya', 'prayer_of_the_veil'),
    ('INTRODUCTION_TO_EVERY_HOUR', 'agpeya', 'introduction_to_every_hour')
  ) AS t(sentinel, schema_name, table_name)
  WHERE t.sentinel = p_hymn_key;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.retry_media_processing_job(p_job_id uuid)
 RETURNS TABLE(job_id uuid, status media.processing_job_status, available_at timestamp with time zone, attempt_count integer, max_attempts integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  request_user_id uuid := auth.uid();
  job_record media.media_processing_jobs%rowtype;
  requeued_id uuid;
begin
  if request_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not (select private.is_admin()) then
    raise exception 'Admin role required' using errcode = '42501';
  end if;

  select *
  into job_record
  from media.media_processing_jobs job
  where job.id = p_job_id
  for update;

  if not found then
    raise exception 'Processing job not found' using errcode = 'P0002';
  end if;

  if job_record.status not in (
    'failed'::media.processing_job_status,
    'cancelled'::media.processing_job_status
  ) then
    raise exception 'Only failed or cancelled processing jobs can be retried manually' using errcode = '22023';
  end if;

  select result.job_id
  into requeued_id
  from public.enqueue_media_processing_job(
    job_record.upload_intent_id,
    job_record.job_type,
    job_record.output_bucket
  ) result;

  update media.submission_items item
  set media_processing_job_id = requeued_id
  where item.upload_intent_id = job_record.upload_intent_id;

  return query
  select
    job.id,
    job.status,
    job.available_at,
    job.attempt_count,
    job.max_attempts
  from media.media_processing_jobs job
  where job.id = requeued_id;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.review_media_submission(p_submission_id uuid, p_action text, p_notes text DEFAULT NULL::text)
 RETURNS TABLE(submission_id uuid, status media.publication_status, review_due_at timestamp with time zone, processing_jobs_queued integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  request_user_id uuid := auth.uid();
  current_submission media.submissions%rowtype;
  previous_status media.publication_status;
  normalized_action text := lower(trim(coalesce(p_action, '')));
  normalized_notes text := nullif(trim(coalesce(p_notes, '')), '');
  release_record music.releases%rowtype;
begin
  processing_jobs_queued := 0;

  if request_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not (select private.is_admin()) then
    raise exception 'Admin role required' using errcode = '42501';
  end if;

  if normalized_action not in ('approve', 'request_changes', 'reject') then
    raise exception 'Unsupported review action' using errcode = '22023';
  end if;

  if normalized_action = 'request_changes' and normalized_notes is null then
    raise exception 'Review notes are required when requesting changes' using errcode = '22023';
  end if;

  select *
  into current_submission
  from media.submissions submission
  where submission.id = p_submission_id
  for update;

  if not found then
    raise exception 'Submission not found' using errcode = 'P0002';
  end if;

  if current_submission.status <> 'pending_review'::media.publication_status then
    raise exception 'Submission is not pending review' using errcode = '22023';
  end if;

  previous_status := current_submission.status;

  if normalized_action = 'request_changes' then
    update media.submissions submission
    set status = 'changes_requested'::media.publication_status,
        reviewer_id = request_user_id,
        reviewed_at = now(),
        review_notes = normalized_notes,
        approved_at = null,
        rejected_at = null,
        updated_by = request_user_id
    where submission.id = current_submission.id
    returning * into current_submission;

    perform private.add_media_submission_event(
      current_submission.id,
      request_user_id,
      'changes_requested',
      previous_status,
      current_submission.status,
      normalized_notes,
      '{}'::jsonb
    );

  elsif normalized_action = 'reject' then
    update media.submissions submission
    set status = 'rejected'::media.publication_status,
        reviewer_id = request_user_id,
        reviewed_at = now(),
        review_notes = normalized_notes,
        rejected_at = now(),
        approved_at = null,
        updated_by = request_user_id
    where submission.id = current_submission.id
    returning * into current_submission;

    perform private.add_media_submission_event(
      current_submission.id,
      request_user_id,
      'rejected',
      previous_status,
      current_submission.status,
      normalized_notes,
      '{}'::jsonb
    );

  else
    if not exists (
      select 1
      from media.submission_items item
      where item.submission_id = current_submission.id
    ) then
      raise exception 'Submission must have at least one item' using errcode = '22023';
    end if;

    perform private.attach_completed_submission_jobs(current_submission.id);

    if not (select private.submission_required_items_ready(current_submission.id)) then
      raise exception 'Submission media is still processing. Approve once processing completes.' using errcode = '22023';
    end if;

    update media.submissions submission
    set status = 'approved'::media.publication_status,
        reviewer_id = request_user_id,
        reviewed_at = now(),
        review_notes = normalized_notes,
        approved_at = now(),
        rejected_at = null,
        updated_by = request_user_id
    where submission.id = current_submission.id
    returning * into current_submission;

    perform private.add_media_submission_event(
      current_submission.id,
      request_user_id,
      'approved',
      previous_status,
      current_submission.status,
      normalized_notes,
      jsonb_build_object('processingJobsQueued', 0)
    );

    if current_submission.submission_type = 'music_release'::media.submission_type then
      select *
      into release_record
      from music.releases release
      where nullif(release.metadata ->> 'submissionId', '')::uuid = current_submission.id
      for update;

      if found then
        if release_record.release_timing_mode = 'asap'
           or (
             release_record.release_timing_mode = 'scheduled'
             and release_record.scheduled_release_at is not null
             and release_record.scheduled_release_at <= now()
           ) then
          perform private.publish_music_submission_internal(
            current_submission.id,
            request_user_id,
            case when release_record.release_timing_mode = 'asap' then 'approval_asap' else 'scheduled_due_at_approval' end
          );

          select *
          into current_submission
          from media.submissions submission
          where submission.id = p_submission_id;
        end if;
      end if;
    elsif current_submission.submission_type in (
      'learning_album'::media.submission_type,
      'learning_lesson_set'::media.submission_type
    ) then
      if exists (
        select 1 from learning.albums album
        where album.submission_id=current_submission.id
          and (album.release_timing_mode='asap'
            or (album.release_timing_mode='scheduled' and album.scheduled_release_at<=now()))
      ) or exists (
        select 1 from learning.lesson_sets lesson_set
        where lesson_set.submission_id=current_submission.id
          and (lesson_set.release_timing_mode='asap'
            or (lesson_set.release_timing_mode='scheduled' and lesson_set.scheduled_release_at<=now()))
      ) then
        perform private.publish_learning_submission_internal(
          current_submission.id,request_user_id,'approval');
        select * into current_submission
          from media.submissions submission where submission.id=p_submission_id;
      end if;
    end if;
  end if;

  return query
  select
    current_submission.id,
    current_submission.status,
    current_submission.review_due_at,
    processing_jobs_queued;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.save_learning_lyric_studio_draft(p_item_kind learning.playlist_item_kind, p_item_id uuid, p_sync_precision music.lyric_sync_precision, p_languages jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare request_user_id uuid:=auth.uid(); language_row record; normalized_lines jsonb; saved jsonb:='[]'::jsonb;
begin
  if request_user_id is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if not private.learning_lyric_item_is_editable(p_item_kind,p_item_id) then raise exception 'Learning item not editable' using errcode='42501'; end if;
  if p_item_kind='lesson' and p_sync_precision<>'unsynced' then raise exception 'Lesson sets support unsynced lyrics only' using errcode='22023'; end if;
  if p_sync_precision not in ('unsynced','line') then raise exception 'Unsupported lyric sync precision' using errcode='22023'; end if;
  if jsonb_typeof(p_languages)<>'array' then raise exception 'p_languages must be a JSON array' using errcode='22023'; end if;
  for language_row in select value from jsonb_array_elements(p_languages) loop
    if not exists(select 1 from media.locales where code=language_row.value->>'locale' and enabled) then raise exception 'Unsupported lyric locale' using errcode='22023'; end if;
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',nullif(line.value->>'id',''),'sequence',line.ordinality::integer,
      'startMs',case when p_sync_precision='unsynced' or nullif(trim(coalesce(line.value->>'startMs','')),'') is null then null else (line.value->>'startMs')::bigint end,
      'endMs',case when p_sync_precision='unsynced' or nullif(trim(coalesce(line.value->>'endMs','')),'') is null then null else (line.value->>'endMs')::bigint end,
      'text',coalesce(line.value->>'text','')) order by line.ordinality),'[]'::jsonb)
      into normalized_lines from jsonb_array_elements(coalesce(language_row.value->'lines','[]'::jsonb)) with ordinality line(value,ordinality);
    insert into learning.lyric_edit_drafts(item_kind,album_recording_id,lesson_id,locale,sync_precision,description,lines,created_by,updated_by)
    values(p_item_kind,case when p_item_kind='album_recording' then p_item_id end,case when p_item_kind='lesson' then p_item_id end,
      language_row.value->>'locale',p_sync_precision,nullif(trim(language_row.value->>'description'),''),normalized_lines,request_user_id,request_user_id)
    on conflict do nothing;
    update learning.lyric_edit_drafts d set sync_precision=p_sync_precision,
      description=nullif(trim(language_row.value->>'description'),''),lines=normalized_lines,updated_by=request_user_id,updated_at=now()
    where d.item_kind=p_item_kind and coalesce(d.album_recording_id,d.lesson_id)=p_item_id and d.locale=language_row.value->>'locale';
    saved:=saved||jsonb_build_array(jsonb_build_object('trackId',p_item_id,'locale',language_row.value->>'locale',
      'description',nullif(trim(language_row.value->>'description'),''),'publicationStatus','draft','hasDraft',true,
      'syncPrecision',p_sync_precision,'lines',normalized_lines));
  end loop;
  return jsonb_build_object('trackId',p_item_id,'languages',saved,'savedAt',now());
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.save_my_content_preferences(p_preferences jsonb, p_bookmarks text[] DEFAULT '{}'::text[])
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  request_user_id uuid := auth.uid();
  clean_bookmarks text[];
begin
  if request_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if jsonb_typeof(coalesce(p_preferences, '{}'::jsonb)) <> 'object'
     or octet_length(coalesce(p_preferences, '{}'::jsonb)::text) > 131072 then
    raise exception 'Invalid content preferences' using errcode = '22023';
  end if;
  if cardinality(coalesce(p_bookmarks, '{}'::text[])) > 500 then
    raise exception 'Too many bookmarks' using errcode = '22023';
  end if;

  select coalesce(array_agg(bookmark order by first_position), '{}'::text[])
  into clean_bookmarks
  from (
    select trim(candidate.bookmark) as bookmark, min(candidate.position) as first_position
    from unnest(coalesce(p_bookmarks, '{}'::text[])) with ordinality candidate(bookmark, position)
    where length(trim(candidate.bookmark)) between 1 and 512
    group by trim(candidate.bookmark)
  ) normalized;

  insert into public.user_content_preferences (user_id, preferences, bookmarks)
  values (request_user_id, coalesce(p_preferences, '{}'::jsonb), clean_bookmarks)
  on conflict (user_id) do update
  set preferences = excluded.preferences,
      bookmarks = excluded.bookmarks,
      updated_at = now();

  return true;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.save_submission_edit(p_submission_id uuid, p_edit jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := auth.uid();
  sub media.submissions%rowtype;
  -- An admin can give up admin rules for a save; nobody can take them on.
  is_admin boolean := private.is_admin() and (p_edit -> 'asCreator') is distinct from 'true'::jsonb;
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

  -- Back in review, it reads as a fresh submission: the reviewer's note and
  -- decision are cleared and the review clock restarts.
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
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.save_track_lyric_draft(p_track_id uuid, p_locale text, p_kind music.lyric_kind, p_sync_precision music.lyric_sync_precision, p_title text DEFAULT NULL::text, p_source text DEFAULT NULL::text, p_lines jsonb DEFAULT '[]'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  request_user_id uuid := auth.uid();
  lyric_set_record music.lyric_sets%rowtype;
  payload jsonb;
begin
  if request_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not (select private.music_track_is_editable(p_track_id)) then
    raise exception 'Track not found or not editable' using errcode = '42501';
  end if;

  if not exists (select 1 from media.locales locale where locale.code = p_locale and locale.enabled) then
    raise exception 'Unsupported or disabled lyric locale' using errcode = '22023';
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'p_lines must be a JSON array' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_lines) line
    where length(trim(coalesce(line->>'text', ''))) = 0
  ) then
    raise exception 'Every lyric line must contain nonblank text' using errcode = '22023';
  end if;

  select *
  into lyric_set_record
  from music.lyric_sets lyric_set
  where lyric_set.track_id = p_track_id
    and lyric_set.locale = p_locale
    and lyric_set.kind = p_kind
  for update;

  if found and lyric_set_record.publication_status = 'published'::media.publication_status then
    raise exception 'Published lyric sets cannot be replaced by draft save; create a revision workflow first' using errcode = '22023';
  end if;

  if not found then
    insert into music.lyric_sets (
      track_id,
      locale,
      kind,
      sync_precision,
      title,
      source,
      publication_status,
      created_by,
      updated_by
    ) values (
      p_track_id,
      p_locale,
      p_kind,
      p_sync_precision,
      nullif(trim(p_title), ''),
      nullif(trim(p_source), ''),
      'draft'::media.publication_status,
      request_user_id,
      request_user_id
    );
  else
    update music.lyric_sets lyric_set
    set sync_precision = p_sync_precision,
        title = nullif(trim(p_title), ''),
        source = nullif(trim(p_source), ''),
        publication_status = 'draft'::media.publication_status,
        updated_by = request_user_id,
        updated_at = now()
    where lyric_set.id = lyric_set_record.id;
  end if;

  select *
  into strict lyric_set_record
  from music.lyric_sets lyric_set
  where lyric_set.track_id = p_track_id
    and lyric_set.locale = p_locale
    and lyric_set.kind = p_kind;

  delete from music.lyric_lines lyric_line
  where lyric_line.lyric_set_id = lyric_set_record.id;

  insert into music.lyric_lines (
    lyric_set_id,
    sequence,
    start_ms,
    end_ms,
    text
  )
  select
    lyric_set_record.id,
    line.ordinality::integer,
    case
      when line.value->>'startMs' is null or trim(line.value->>'startMs') = '' then null
      else (line.value->>'startMs')::bigint
    end,
    case
      when line.value->>'endMs' is null or trim(line.value->>'endMs') = '' then null
      else (line.value->>'endMs')::bigint
    end,
    trim(line.value->>'text')
  from jsonb_array_elements(p_lines) with ordinality as line(value, ordinality);

  select jsonb_build_object(
    'id', lyric_set_record.id,
    'trackId', lyric_set_record.track_id,
    'locale', lyric_set_record.locale,
    'kind', lyric_set_record.kind,
    'syncPrecision', lyric_set_record.sync_precision,
    'title', lyric_set_record.title,
    'source', lyric_set_record.source,
    'publicationStatus', lyric_set_record.publication_status,
    'lines', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', lyric_line.id,
        'sequence', lyric_line.sequence,
        'startMs', lyric_line.start_ms,
        'endMs', lyric_line.end_ms,
        'text', lyric_line.text
      ) order by lyric_line.sequence)
      from music.lyric_lines lyric_line
      where lyric_line.lyric_set_id = lyric_set_record.id
    ), '[]'::jsonb)
  ) into payload;

  return payload;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.save_track_lyric_language_draft(p_track_id uuid, p_locale text, p_description text DEFAULT NULL::text, p_lines jsonb DEFAULT '[]'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  request_user_id uuid := auth.uid();
  lyric_set_record music.lyric_sets%rowtype;
  normalized_lines jsonb;
  draft_id uuid;
begin
  if request_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not (select private.music_track_is_editable(p_track_id)) then
    raise exception 'Track not found or not editable' using errcode = '42501';
  end if;

  if not exists (
    select 1 from media.locales locale
    where locale.code = p_locale and locale.enabled
  ) then
    raise exception 'Unsupported or disabled lyric locale' using errcode = '22023';
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'p_lines must be a JSON array' using errcode = '22023';
  end if;

  -- Drafts deliberately allow blank/untimed rows: the studio continuously
  -- saves while the artist is still typing/synchronizing. Publish validates.
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', nullif(line.value->>'id', ''),
    'sequence', line.ordinality::integer,
    'startMs', case
      when nullif(trim(coalesce(line.value->>'startMs', '')), '') is null then null
      else (line.value->>'startMs')::bigint
    end,
    'endMs', case
      when nullif(trim(coalesce(line.value->>'endMs', '')), '') is null then null
      else (line.value->>'endMs')::bigint
    end,
    'text', coalesce(line.value->>'text', '')
  ) order by line.ordinality), '[]'::jsonb)
  into normalized_lines
  from jsonb_array_elements(p_lines) with ordinality line(value, ordinality);

  insert into music.lyric_edit_drafts (
    track_id,
    locale,
    description,
    lines,
    created_by,
    updated_by
  ) values (
    p_track_id,
    p_locale,
    nullif(trim(p_description), ''),
    normalized_lines,
    request_user_id,
    request_user_id
  )
  on conflict (track_id, locale) do update
  set description = excluded.description,
      lines = excluded.lines,
      updated_by = request_user_id,
      updated_at = now();

  select *
  into lyric_set_record
  from music.lyric_sets lyric_set
  where lyric_set.track_id = p_track_id
    and lyric_set.locale = p_locale
    and lyric_set.kind = 'original'::music.lyric_kind;

  return jsonb_build_object(
    'id', lyric_set_record.id,
    'trackId', p_track_id,
    'locale', p_locale,
    'description', nullif(trim(p_description), ''),
    'publicationStatus', coalesce(lyric_set_record.publication_status, 'draft'::media.publication_status),
    'hasDraft', true,
    'lines', normalized_lines
  );
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.save_track_lyric_studio_draft(p_track_id uuid, p_languages jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  request_user_id uuid := auth.uid();
  language_row record;
  saved_language jsonb;
  saved_languages jsonb := '[]'::jsonb;
begin
  if request_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not (select private.music_track_is_editable(p_track_id)) then
    raise exception 'Track not found or not editable' using errcode = '42501';
  end if;

  if p_languages is null or jsonb_typeof(p_languages) <> 'array' then
    raise exception 'p_languages must be a JSON array' using errcode = '22023';
  end if;

  for language_row in
    select
      language.value->>'locale' as locale,
      language.value->>'description' as description,
      coalesce(language.value->'lines', '[]'::jsonb) as lines
    from jsonb_array_elements(p_languages) with ordinality language(value, ordinality)
    order by language.ordinality
  loop
    if nullif(trim(coalesce(language_row.locale, '')), '') is null then
      raise exception 'Every studio draft language needs a locale' using errcode = '22023';
    end if;

    saved_language := public.save_track_lyric_language_draft(
      p_track_id,
      language_row.locale,
      language_row.description,
      language_row.lines
    );

    saved_languages := saved_languages || jsonb_build_array(saved_language);
  end loop;

  return jsonb_build_object(
    'trackId', p_track_id,
    'languages', saved_languages,
    'savedAt', now()
  );
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.save_track_lyric_studio_draft_v2(p_track_id uuid, p_sync_precision music.lyric_sync_precision, p_languages jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  request_user_id uuid := auth.uid();
  language_row record;
  normalized_lines jsonb;
  saved_languages jsonb := '[]'::jsonb;
begin
  if request_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not private.music_track_is_editable(p_track_id) then
    raise exception 'Track not found or not editable' using errcode = '42501';
  end if;

  if p_sync_precision not in ('unsynced', 'line') then
    raise exception 'Unsupported lyric sync precision' using errcode = '22023';
  end if;

  if p_languages is null or jsonb_typeof(p_languages) <> 'array' then
    raise exception 'p_languages must be a JSON array' using errcode = '22023';
  end if;

  for language_row in
    select language.value
    from jsonb_array_elements(p_languages) with ordinality language(value, ordinality)
    order by language.ordinality
  loop
    if not exists (
      select 1
      from media.locales locale
      where locale.code = language_row.value->>'locale'
        and locale.enabled
    ) then
      raise exception 'Unsupported or disabled lyric locale' using errcode = '22023';
    end if;

    select coalesce(jsonb_agg(jsonb_build_object(
      'id', nullif(line.value->>'id', ''),
      'sequence', line.ordinality::integer,
      'startMs', case
        when p_sync_precision = 'unsynced'
          or nullif(trim(coalesce(line.value->>'startMs', '')), '') is null then null
        else (line.value->>'startMs')::bigint
      end,
      'endMs', case
        when p_sync_precision = 'unsynced'
          or nullif(trim(coalesce(line.value->>'endMs', '')), '') is null then null
        else (line.value->>'endMs')::bigint
      end,
      'text', coalesce(line.value->>'text', '')
    ) order by line.ordinality), '[]'::jsonb)
    into normalized_lines
    from jsonb_array_elements(coalesce(language_row.value->'lines', '[]'::jsonb))
      with ordinality line(value, ordinality);

    insert into music.lyric_edit_drafts (
      track_id,
      locale,
      sync_precision,
      description,
      lines,
      created_by,
      updated_by
    ) values (
      p_track_id,
      language_row.value->>'locale',
      p_sync_precision,
      nullif(trim(language_row.value->>'description'), ''),
      normalized_lines,
      request_user_id,
      request_user_id
    )
    on conflict (track_id, locale) do update
    set sync_precision = excluded.sync_precision,
        description = excluded.description,
        lines = excluded.lines,
        updated_by = request_user_id,
        updated_at = now();

    saved_languages := saved_languages || jsonb_build_array(jsonb_build_object(
      'trackId', p_track_id,
      'locale', language_row.value->>'locale',
      'description', nullif(trim(language_row.value->>'description'), ''),
      'publicationStatus', 'draft',
      'hasDraft', true,
      'syncPrecision', p_sync_precision,
      'lines', normalized_lines
    ));
  end loop;

  return jsonb_build_object(
    'trackId', p_track_id,
    'languages', saved_languages,
    'savedAt', now()
  );
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.search_creator_contributors(p_creator_account_id uuid, p_query text, p_kind text DEFAULT 'artist'::text, p_limit integer DEFAULT 12)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  normalized_query text := private.normalize_creator_name(left(coalesce(p_query,''),120));
  max_results integer := greatest(1,least(coalesce(p_limit,12),25));
  mode text := lower(btrim(coalesce(p_kind,'artist')));
  result jsonb;
begin
  if auth.uid() is null or not private.can_edit_creator_account(p_creator_account_id) then
    raise exception 'Not authorized for creator account' using errcode='42501';
  end if;
  if mode not in ('artist','cantor','all') then
    raise exception 'Invalid artist search kind' using errcode='22023';
  end if;
  if length(normalized_query)<2 then return '[]'::jsonb; end if;
  with candidates as (
    select a.id,a.display_name,a.is_credit_only,
      a.publication_status::text as status,
      a.owner_creator_account_id,
      private.normalize_creator_name(a.display_name) as normalized_name,
      case when asset.id is not null then jsonb_build_object(
        'bucket',asset.bucket,'path',asset.path,'version',asset.version
      ) else null end as photo
    from music.artists a
    left join media.media_assets asset
      on asset.id=a.profile_image_asset_id
      and asset.publication_status='published'::media.publication_status
      and asset.media_type='image'::media.media_type
    where a.publication_status='published'::media.publication_status
       or a.is_credit_only
       or a.owner_creator_account_id=p_creator_account_id
  ), scored as (
    select *,
      (case
        when normalized_name=normalized_query then 1000
        when normalized_name like normalized_query||'%' then 700
        when normalized_name like '%'||normalized_query||'%' then 470
        else 0 end)
      + round(extensions.similarity(normalized_name,normalized_query)*300)::integer
      + case when status='published' then 350 else 0 end
      + case when owner_creator_account_id is not null then 150 else 0 end
      + case when photo is not null then 130 else 0 end as score
    from candidates
    where normalized_name=normalized_query
       or normalized_name like '%'||normalized_query||'%'
       or extensions.similarity(normalized_name,normalized_query)>=0.21
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'title',display_name,
    'kind',case when mode='cantor' then 'cantor' else 'artist' end,
    'isCreditOnly',is_credit_only,'status',status,'profileImage',photo,
    'matchScore',score
  ) order by score desc,(photo is not null) desc,display_name),'[]'::jsonb)
  into result from (
    select * from scored
    order by score desc,(photo is not null) desc,display_name
    limit max_results
  ) ranked;
  return result;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.search_media_catalog(p_query text, p_locale text DEFAULT 'en'::text, p_scope text DEFAULT 'all'::text, p_limit integer DEFAULT 60)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with input as (
    select
      media.normalize_search_text(p_query) as normalized_query,
      case lower(coalesce(p_scope, 'all'))
        when 'music' then 'music'
        when 'learning' then 'learning'
        else 'all'
      end as scope,
      greatest(1, least(coalesce(p_limit, 60), 100)) as result_limit
  ),
  prepared as (
    select
      input.*,
      websearch_to_tsquery('simple', input.normalized_query) as search_query
    from input
  ),
  alias_matches as (
    select
      alias.entity_type,
      alias.entity_id,
      max(case
        when alias.normalized_alias = prepared.normalized_query then 116.0
        when alias.normalized_alias like prepared.normalized_query || '%' then 92.0
        when alias.normalized_alias like '%' || prepared.normalized_query || '%' then 72.0
        else 35.0 + (extensions.similarity(alias.normalized_alias, prepared.normalized_query) * 30.0)
      end) as alias_score,
      bool_or(alias.normalized_alias = prepared.normalized_query) as exact_alias
    from media.search_aliases alias
    cross join prepared
    where prepared.normalized_query <> ''
      and alias.publication_status = 'published'::media.publication_status
      and (
        alias.normalized_alias like '%' || prepared.normalized_query || '%'
        or extensions.similarity(alias.normalized_alias, prepared.normalized_query) >= 0.2
      )
    group by alias.entity_type, alias.entity_id
  ),
  candidates as (
    select
      document.*,
      prepared.normalized_query,
      prepared.scope,
      greatest(
        case
          when media.normalize_search_text(document.title) = prepared.normalized_query then 120.0
          when media.normalize_search_text(document.title) like prepared.normalized_query || '%' then 96.0
          when media.normalize_search_text(document.title) like '%' || prepared.normalized_query || '%' then 78.0
          else 0.0
        end,
        case
          when document.search_vector @@ prepared.search_query
            then 62.0 + (ts_rank_cd(document.search_vector, prepared.search_query) * 28.0)
          else 0.0
        end,
        case
          when document.normalized_text like '%' || prepared.normalized_query || '%' then 58.0
          else 20.0 + (extensions.similarity(document.normalized_text, prepared.normalized_query) * 35.0)
        end,
        coalesce(alias_matches.alias_score, 0.0)
      )
      + case when document.locale = p_locale then 4.0 when document.locale = 'en' then 1.0 else 0.0 end
      as rank_score,
      case
        when media.normalize_search_text(document.title) = prepared.normalized_query then 'title_exact'
        when alias_matches.exact_alias then 'alias_exact'
        when media.normalize_search_text(document.title) like prepared.normalized_query || '%' then 'title_prefix'
        when alias_matches.alias_score is not null then 'alias'
        when document.search_vector @@ prepared.search_query then 'full_text'
        when document.normalized_text like '%' || prepared.normalized_query || '%' then 'substring'
        else 'similarity'
      end as matched_by
    from media.search_documents document
    cross join prepared
    left join alias_matches
      on alias_matches.entity_type = document.entity_type
     and alias_matches.entity_id = document.entity_id
    where prepared.normalized_query <> ''
      and document.kind = 'unified_catalog'
      and document.publication_status = 'published'::media.publication_status
      and (
        prepared.scope = 'all'
        or (prepared.scope = 'music' and document.entity_type like 'music_%')
        or (prepared.scope = 'learning' and document.entity_type like 'learning_%')
      )
      and (
        document.normalized_text like '%' || prepared.normalized_query || '%'
        or document.search_vector @@ prepared.search_query
        or extensions.similarity(document.normalized_text, prepared.normalized_query) >= 0.2
        or alias_matches.alias_score is not null
      )
  ),
  best_match as (
    select ranked.*
    from (
      select
        candidates.*,
        row_number() over (
          partition by candidates.entity_type, candidates.entity_id
          order by candidates.rank_score desc, (candidates.locale = p_locale) desc,
            (candidates.locale = 'en') desc, candidates.locale
        ) as entity_rank
      from candidates
    ) ranked
    where ranked.entity_rank = 1
  ),
  displayed as (
    select
      best_match.*,
      display.locale as display_locale,
      display.title as display_title,
      display.subtitle as display_subtitle,
      display.body as display_body,
      display.metadata as display_metadata
    from best_match
    cross join lateral (
      select candidate_display.locale, candidate_display.title, candidate_display.subtitle,
        candidate_display.body, candidate_display.metadata
      from media.search_documents candidate_display
      where candidate_display.kind = 'unified_catalog'
        and candidate_display.publication_status = 'published'::media.publication_status
        and candidate_display.entity_type = best_match.entity_type
        and candidate_display.entity_id = best_match.entity_id
      order by
        (candidate_display.locale = p_locale) desc,
        (candidate_display.locale = 'en') desc,
        (candidate_display.locale = best_match.locale) desc,
        candidate_display.locale
      limit 1
    ) display
  ),
  limited as (
    select displayed.*
    from displayed
    order by displayed.rank_score desc, displayed.display_title
    limit (select result_limit from prepared)
  )
  select jsonb_build_object(
    'query', coalesce(p_query, ''),
    'normalizedQuery', prepared.normalized_query,
    'scope', prepared.scope,
    'results', coalesce((
      select jsonb_agg(jsonb_build_object(
        'domain', case when limited.entity_type like 'music_%' then 'music' else 'learning' end,
        'kind', limited.entity_type,
        'entityId', limited.entity_id,
        'title', limited.display_title,
        'subtitle', limited.display_subtitle,
        'body', limited.display_body,
        'metadata', limited.display_metadata,
        'matchedBy', limited.matched_by,
        'matchedLocale', limited.locale,
        'displayLocale', limited.display_locale,
        'rank', round(limited.rank_score::numeric, 3)
      ) order by limited.rank_score desc, limited.display_title)
      from limited
    ), '[]'::jsonb)
  )
  from prepared;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.search_published_music(p_query text, p_locale text DEFAULT 'en'::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with search_term as (
    select '%' || lower(trim(coalesce(p_query, ''))) || '%' as pattern
  )
  select jsonb_build_object(
    'artists', coalesce((
      select jsonb_agg(result.payload order by result.display_name)
      from (
        select distinct on (artist.id)
          artist.id,
          coalesce(localization.display_name, artist.display_name) as display_name,
          jsonb_build_object(
            'id', artist.id,
            'displayName', coalesce(localization.display_name, artist.display_name),
            'biography', coalesce(localization.biography, artist.biography),
            'profileImageAsset', case when image.id is null then null else jsonb_build_object(
              'id', image.id,
              'provider', image.provider,
              'bucket', image.bucket,
              'path', image.path,
              'mimeType', image.mime_type
            ) end
          ) as payload
        from music.artists artist
        cross join search_term
        left join music.artist_localizations localization
          on localization.artist_id = artist.id
         and localization.locale = p_locale
         and localization.publication_status = 'published'::media.publication_status
        left join media.media_assets image
          on image.id = artist.profile_image_asset_id
         and image.publication_status = 'published'::media.publication_status
        where artist.publication_status = 'published'::media.publication_status
          and search_term.pattern <> '%%'
          and (
            lower(artist.display_name) like search_term.pattern
            or lower(coalesce(localization.display_name, '')) like search_term.pattern
          )
        limit 20
      ) result
    ), '[]'::jsonb),
    'releases', coalesce((
      select jsonb_agg(result.payload order by result.title)
      from (
        select distinct on (release.id)
          release.id,
          coalesce(localization.title, release.title) as title,
          jsonb_build_object(
            'id', release.id,
            'title', coalesce(localization.title, release.title),
            'subtitle', coalesce(localization.subtitle, release.subtitle),
            'releaseType', release.release_type,
            'releaseDate', music.release_display_date(release.original_release_date, release.scheduled_release_at, release.release_date),
            'primaryArtist', case when artist.id is null then null else jsonb_build_object(
              'id', artist.id,
              'displayName', artist.display_name
            ) end,
            'coverAsset', case when cover.id is null then null else jsonb_build_object(
              'id', cover.id,
              'provider', cover.provider,
              'bucket', cover.bucket,
              'path', cover.path,
              'mimeType', cover.mime_type
            ) end
          ) as payload
        from music.releases release
        cross join search_term
        left join music.release_localizations localization
          on localization.release_id = release.id
         and localization.locale = p_locale
         and localization.publication_status = 'published'::media.publication_status
        left join music.artists artist
          on artist.id = release.primary_artist_id
         and artist.publication_status = 'published'::media.publication_status
        left join media.media_assets cover
          on cover.id = release.cover_asset_id
         and cover.publication_status = 'published'::media.publication_status
        where release.publication_status = 'published'::media.publication_status
          and search_term.pattern <> '%%'
          and (
            lower(release.title) like search_term.pattern
            or lower(coalesce(localization.title, '')) like search_term.pattern
          )
        limit 20
      ) result
    ), '[]'::jsonb),
    'tracks', coalesce((
      select jsonb_agg(result.payload order by result.title)
      from (
        select distinct on (track.id)
          track.id,
          coalesce(localization.title, track.title) as title,
          jsonb_build_object(
            'id', track.id,
            'title', coalesce(localization.title, track.title),
            'subtitle', coalesce(localization.subtitle, track.subtitle),
            'durationMs', track.duration_ms,
            'releaseId', release_track.release_id,
            'mediaAsset', jsonb_build_object(
              'id', asset.id,
              'provider', asset.provider,
              'bucket', asset.bucket,
              'path', asset.path,
              'mimeType', asset.mime_type
            ),
            'artists', coalesce((
              select jsonb_agg(jsonb_build_object(
                'id', artist.id,
                'displayName', artist.display_name,
                'role', track_artist.role,
                'sortOrder', track_artist.sort_order
              ) order by track_artist.sort_order, artist.display_name)
              from music.track_artists track_artist
              join music.artists artist on artist.id = track_artist.artist_id
              where track_artist.track_id = track.id
                and artist.publication_status = 'published'::media.publication_status
            ), '[]'::jsonb)
          ) as payload
        from music.tracks track
        cross join search_term
        join media.media_assets asset
          on asset.id = track.media_asset_id
         and asset.publication_status = 'published'::media.publication_status
        left join music.track_localizations localization
          on localization.track_id = track.id
         and localization.locale = p_locale
         and localization.publication_status = 'published'::media.publication_status
        left join music.release_tracks release_track on release_track.track_id = track.id
        where track.publication_status = 'published'::media.publication_status
          and search_term.pattern <> '%%'
          and (
            lower(track.title) like search_term.pattern
            or lower(coalesce(localization.title, '')) like search_term.pattern
          )
        limit 30
      ) result
    ), '[]'::jsonb)
  );
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.search_section_catalog(p_query text, p_locale text DEFAULT 'en'::text, p_section text DEFAULT 'music'::text, p_limit integer DEFAULT 48)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with input as (
    select
      media.normalize_search_text(p_query) as normalized_query,
      case lower(coalesce(p_section, 'music'))
        when 'learning' then 'learning'
        else 'music'
      end as section,
      greatest(1, least(coalesce(p_limit, 48), 80)) as result_limit
  ),
  prepared as (
    select
      input.*,
      websearch_to_tsquery('simple', input.normalized_query) as search_query
    from input
  ),
  alias_matches as (
    select
      alias.entity_type,
      alias.entity_id,
      max(case
        when alias.normalized_alias = prepared.normalized_query then 210.0
        when alias.normalized_alias like prepared.normalized_query || '%' then 178.0
        when alias.normalized_alias like '%' || prepared.normalized_query || '%' then 145.0
        else 62.0 + (extensions.similarity(alias.normalized_alias, prepared.normalized_query) * 58.0)
      end) as alias_score,
      bool_or(alias.normalized_alias = prepared.normalized_query) as exact_alias
    from media.search_aliases alias
    cross join prepared
    where prepared.normalized_query <> ''
      and alias.publication_status = 'published'::media.publication_status
      and (
        alias.normalized_alias like '%' || prepared.normalized_query || '%'
        or extensions.similarity(alias.normalized_alias, prepared.normalized_query) >= 0.25
      )
    group by alias.entity_type, alias.entity_id
  ),
  candidates as (
    select
      document.*,
      prepared.normalized_query,
      prepared.section,
      greatest(
        case
          when media.normalize_search_text(document.title) = prepared.normalized_query then 220.0
          when media.normalize_search_text(document.title) like prepared.normalized_query || '%' then 188.0
          when media.normalize_search_text(document.title) like '%' || prepared.normalized_query || '%' then 154.0
          else 0.0
        end,
        coalesce(alias_matches.alias_score, 0.0),
        case
          when document.search_vector @@ prepared.search_query
            then 82.0 + (ts_rank_cd(document.search_vector, prepared.search_query) * 38.0)
          else 0.0
        end,
        case
          when document.normalized_text like '%' || prepared.normalized_query || '%' then 68.0
          else 34.0 + (extensions.similarity(document.normalized_text, prepared.normalized_query) * 54.0)
        end
      )
      + case when document.locale = p_locale then 5.0 when document.locale = 'en' then 2.0 else 0.0 end
      as rank_score,
      case
        when media.normalize_search_text(document.title) = prepared.normalized_query then 'title_exact'
        when alias_matches.exact_alias then 'alias_exact'
        when media.normalize_search_text(document.title) like prepared.normalized_query || '%' then 'title_prefix'
        when media.normalize_search_text(document.title) like '%' || prepared.normalized_query || '%' then 'substring'
        when alias_matches.alias_score is not null then 'alias'
        when document.search_vector @@ prepared.search_query then 'full_text'
        when document.normalized_text like '%' || prepared.normalized_query || '%' then 'substring'
        else 'similarity'
      end as matched_by
    from media.search_documents document
    cross join prepared
    left join alias_matches
      on alias_matches.entity_type = document.entity_type
     and alias_matches.entity_id = document.entity_id
    where prepared.normalized_query <> ''
      and document.kind = 'unified_catalog'
      and document.publication_status = 'published'::media.publication_status
      and (
        (prepared.section = 'music' and document.entity_type like 'music_%')
        or (prepared.section = 'learning' and document.entity_type like 'learning_%')
      )
      and (
        media.normalize_search_text(document.title) like '%' || prepared.normalized_query || '%'
        or document.normalized_text like '%' || prepared.normalized_query || '%'
        or document.search_vector @@ prepared.search_query
        or extensions.similarity(document.normalized_text, prepared.normalized_query) >= 0.25
        or alias_matches.alias_score is not null
      )
  ),
  best_match as (
    select ranked.*
    from (
      select
        candidates.*,
        row_number() over (
          partition by candidates.entity_type, candidates.entity_id
          order by candidates.rank_score desc,
            (candidates.locale = p_locale) desc,
            (candidates.locale = 'en') desc,
            candidates.locale
        ) as entity_rank
      from candidates
    ) ranked
    where ranked.entity_rank = 1
  ),
  displayed as (
    select
      best_match.*,
      display.locale as display_locale,
      display.title as display_title,
      display.subtitle as display_subtitle,
      display.body as display_body,
      display.metadata as display_metadata
    from best_match
    cross join lateral (
      select
        candidate_display.locale,
        candidate_display.title,
        candidate_display.subtitle,
        candidate_display.body,
        candidate_display.metadata
      from media.search_documents candidate_display
      where candidate_display.kind = 'unified_catalog'
        and candidate_display.publication_status = 'published'::media.publication_status
        and candidate_display.entity_type = best_match.entity_type
        and candidate_display.entity_id = best_match.entity_id
      order by
        (candidate_display.locale = p_locale) desc,
        (candidate_display.locale = 'en') desc,
        (candidate_display.locale = best_match.locale) desc,
        candidate_display.locale
      limit 1
    ) display
  ),
  diverse as (
    select ranked.*
    from (
      select
        displayed.*,
        row_number() over (
          partition by displayed.entity_type
          order by displayed.rank_score desc, displayed.display_title
        ) as kind_rank
      from displayed
    ) ranked
    where ranked.kind_rank <= case ranked.entity_type
      when 'music_artist' then 8
      when 'music_release' then 12
      when 'music_track' then 28
      when 'learning_cantor' then 8
      when 'learning_season' then 8
      when 'learning_hymn' then 16
      when 'learning_album' then 12
      when 'learning_lesson' then 24
      else 12
    end
  ),
  limited as (
    select diverse.*
    from diverse
    order by diverse.rank_score desc, diverse.display_title
    limit (select result_limit from prepared)
  )
  select jsonb_build_object(
    'query', coalesce(p_query, ''),
    'normalizedQuery', prepared.normalized_query,
    'scope', prepared.section,
    'results', coalesce((
      select jsonb_agg(jsonb_build_object(
        'domain', case when limited.entity_type like 'music_%' then 'music' else 'learning' end,
        'kind', limited.entity_type,
        'entityId', limited.entity_id,
        'title', limited.display_title,
        'subtitle', limited.display_subtitle,
        'body', limited.display_body,
        'metadata', limited.display_metadata,
        'matchedBy', limited.matched_by,
        'matchedLocale', limited.locale,
        'displayLocale', limited.display_locale,
        'rank', round(limited.rank_score::numeric, 3)
      ) order by limited.rank_score desc, limited.display_title)
      from limited
    ), '[]'::jsonb)
  )
  from prepared;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.set_artist_followed(p_artist_id uuid, p_followed boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  request_user_id uuid := auth.uid();
begin
  if request_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_followed then
    insert into music.artist_follows (user_id, artist_id)
    values (request_user_id, p_artist_id)
    on conflict (user_id, artist_id) do nothing;
  else
    delete from music.artist_follows
    where user_id = request_user_id
      and artist_id = p_artist_id;
  end if;

  return p_followed;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.set_learning_item_liked(p_item_kind learning.playlist_item_kind, p_item_id uuid, p_liked boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_liked then
    if p_item_kind='album_recording' then
      insert into learning.item_likes(user_id,item_kind,album_recording_id) values(auth.uid(),p_item_kind,p_item_id) on conflict do nothing;
    else
      insert into learning.item_likes(user_id,item_kind,lesson_id) values(auth.uid(),p_item_kind,p_item_id) on conflict do nothing;
    end if;
  else
    delete from learning.item_likes where user_id=auth.uid() and item_kind=p_item_kind and coalesce(album_recording_id,lesson_id)=p_item_id;
  end if;
  return p_liked;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.set_learning_item_progress(p_item_kind learning.playlist_item_kind, p_item_id uuid, p_state learning.progress_state)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_row learning.item_progress%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_item_kind = 'album_recording' then
    if not exists (select 1 from learning.album_recordings r join learning.albums a on a.id = r.album_id where r.id = p_item_id and r.publication_status = 'published' and a.publication_status = 'published') then raise exception 'Published recording not found'; end if;
    select * into v_row from learning.item_progress where user_id = auth.uid() and album_recording_id = p_item_id for update;
  else
    if not exists (select 1 from learning.lessons l join learning.lesson_sets s on s.id = l.lesson_set_id where l.id = p_item_id and l.publication_status = 'published' and s.publication_status = 'published') then raise exception 'Published lesson not found'; end if;
    select * into v_row from learning.item_progress where user_id = auth.uid() and lesson_id = p_item_id for update;
  end if;

  if v_row.id is null then
    insert into learning.item_progress(user_id, item_kind, album_recording_id, lesson_id, state, started_at, finished_at)
    values (auth.uid(), p_item_kind, case when p_item_kind='album_recording' then p_item_id end, case when p_item_kind='lesson' then p_item_id end, p_state,
      case when p_state in ('learning','finished') then now() end, case when p_state='finished' then now() end)
    returning * into v_row;
  else
    update learning.item_progress set state = p_state,
      started_at = case when p_state='will_learn' then null else coalesce(started_at, now()) end,
      finished_at = case when p_state='finished' then now() else null end
    where id = v_row.id returning * into v_row;
  end if;
  return jsonb_build_object('id', v_row.id, 'itemKind', v_row.item_kind, 'itemId', coalesce(v_row.album_recording_id, v_row.lesson_id), 'state', v_row.state, 'updatedAt', v_row.updated_at);
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.set_learning_progress(p_hymn_id uuid, p_state learning.progress_state)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not exists (select 1 from learning.hymns h where h.id = p_hymn_id and h.publication_status = 'published') then
    raise exception 'Published hymn not found';
  end if;

  insert into learning.hymn_progress (user_id, hymn_id, state, started_at, finished_at)
  values (
    auth.uid(), p_hymn_id, p_state,
    case when p_state in ('learning', 'finished') then now() else null end,
    case when p_state = 'finished' then now() else null end
  )
  on conflict (user_id, hymn_id) do update
  set state = excluded.state,
      started_at = case
        when excluded.state = 'will_learn' then null
        when learning.hymn_progress.started_at is null then now()
        else learning.hymn_progress.started_at
      end,
      finished_at = case when excluded.state = 'finished' then now() else null end;

  return (
    select jsonb_build_object('hymnId', hp.hymn_id, 'state', hp.state, 'startedAt', hp.started_at, 'finishedAt', hp.finished_at, 'updatedAt', hp.updated_at)
    from learning.hymn_progress hp
    where hp.user_id = auth.uid() and hp.hymn_id = p_hymn_id
  );
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.set_music_playlist_cover(p_playlist_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  request_user_id uuid := auth.uid();
  object_path text;
  issuer text;
  public_asset_url text;
  object_mime_type text;
  object_size bigint;
  new_cover_asset_id uuid;
  cover_version integer;
begin
  if request_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not exists (
    select 1
    from music.playlists playlist
    where playlist.id = p_playlist_id
      and playlist.owner_user_id = request_user_id
  ) then
    raise exception 'Playlist not found or not editable' using errcode = '42501';
  end if;

  object_path := request_user_id::text || '/' || p_playlist_id::text || '/cover';

  select
    lower(storage_object.metadata ->> 'mimetype'),
    (storage_object.metadata ->> 'size')::bigint
  into object_mime_type, object_size
  from storage.objects storage_object
  where storage_object.bucket_id = 'playlist-covers'
    and storage_object.name = object_path
    and (
      storage_object.owner = request_user_id
      or storage_object.owner_id = request_user_id::text
    );

  if object_mime_type is null or object_size is null then
    raise exception 'Upload the playlist cover before attaching it' using errcode = '22023';
  end if;
  if object_mime_type not in ('image/jpeg', 'image/png', 'image/webp') then
    raise exception 'Playlist covers must be JPEG, PNG, or WebP' using errcode = '22023';
  end if;
  if object_size <= 0 or object_size > 5242880 then
    raise exception 'Playlist covers must be 5 MB or smaller' using errcode = '22023';
  end if;

  issuer := auth.jwt() ->> 'iss';
  if issuer is null or issuer !~ '^https?://' then
    raise exception 'Unable to resolve the playlist cover URL' using errcode = '22023';
  end if;

  public_asset_url := regexp_replace(issuer, '/auth/v1/?$', '')
    || '/storage/v1/object/public/playlist-covers/' || object_path;

  insert into media.media_assets (
    owner_creator_account_id,
    provider,
    bucket,
    path,
    media_type,
    mime_type,
    file_size_bytes,
    version,
    processing_status,
    publication_status,
    metadata,
    created_by,
    updated_by
  ) values (
    null,
    'external'::media.media_provider,
    'playlist-covers',
    public_asset_url,
    'image'::media.media_type,
    object_mime_type,
    object_size,
    1,
    'completed'::media.processing_status,
    'published'::media.publication_status,
    jsonb_build_object('playlistId', p_playlist_id::text, 'storagePath', object_path),
    request_user_id,
    request_user_id
  )
  on conflict (provider, bucket, path) do update
  set mime_type = excluded.mime_type,
      file_size_bytes = excluded.file_size_bytes,
      version = media_assets.version + 1,
      processing_status = 'completed'::media.processing_status,
      publication_status = 'published'::media.publication_status,
      metadata = excluded.metadata,
      updated_by = request_user_id,
      updated_at = now()
  returning id, version into new_cover_asset_id, cover_version;

  update music.playlists
  set cover_asset_id = new_cover_asset_id,
      updated_at = now()
  where id = p_playlist_id
    and owner_user_id = request_user_id;

  return jsonb_build_object(
    'id', new_cover_asset_id,
    'provider', 'external',
    'bucket', 'playlist-covers',
    'path', public_asset_url || '?v=' || cover_version::text,
    'mimeType', object_mime_type,
    'fileSizeBytes', object_size,
    'version', cover_version
  );
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.set_music_playlist_track_order(p_playlist_id uuid, p_track_ids uuid[])
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  existing_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not (select private.music_playlist_is_editable(p_playlist_id)) then
    raise exception 'Playlist not found or not editable' using errcode = '42501';
  end if;

  select count(*) into existing_count
  from music.playlist_tracks
  where playlist_id = p_playlist_id;

  if coalesce(array_length(p_track_ids, 1), 0) <> existing_count
     or (select count(distinct supplied.track_id) from unnest(p_track_ids) as supplied(track_id)) <> existing_count
     or exists (
       select 1 from unnest(p_track_ids) as supplied(track_id)
       where not exists (
         select 1 from music.playlist_tracks playlist_track
         where playlist_track.playlist_id = p_playlist_id
           and playlist_track.track_id = supplied.track_id
       )
     ) then
    raise exception 'Track order must contain every playlist track exactly once' using errcode = '22023';
  end if;

  update music.playlist_tracks playlist_track
  set sort_order = ordered.ordinality::integer - 1
  from unnest(p_track_ids) with ordinality ordered(track_id, ordinality)
  where playlist_track.playlist_id = p_playlist_id
    and playlist_track.track_id = ordered.track_id;

  update music.playlists set updated_at = now() where id = p_playlist_id;
  return true;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.set_release_liked(p_release_id uuid, p_liked boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'music', 'media', 'auth'
AS $function$
declare
  request_user_id uuid := auth.uid();
begin
  if request_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from music.releases release
    where release.id = p_release_id
      and release.publication_status::text = 'published'
  ) then
    raise exception 'Published release not found' using errcode = '22023';
  end if;

  if coalesce(p_liked, false) then
    insert into music.release_likes (user_id, release_id)
    values (request_user_id, p_release_id)
    on conflict (user_id, release_id) do nothing;
    return true;
  end if;

  delete from music.release_likes
  where user_id = request_user_id
    and release_id = p_release_id;

  return false;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.set_track_liked(p_track_id uuid, p_liked boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  request_user_id uuid := auth.uid();
begin
  if request_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_liked then
    insert into music.track_likes (user_id, track_id)
    values (request_user_id, p_track_id)
    on conflict (user_id, track_id) do nothing;
  else
    delete from music.track_likes
    where user_id = request_user_id and track_id = p_track_id;
  end if;

  return p_liked;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.skip_media_processing_job(p_worker_token text, p_job_id uuid, p_reason text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  affected integer := 0;
  skipped_intent_id uuid;
begin
  if not private.verify_media_worker_token(p_worker_token) then
    raise exception 'Invalid media worker token' using errcode = '28000';
  end if;

  update media.media_processing_jobs job
  set status = 'cancelled'::media.processing_job_status,
      worker_id = null,
      heartbeat_at = null,
      progress = null,
      finished_at = now(),
      error_message = left('No audio track: ' || coalesce(nullif(trim(p_reason), ''), 'the video has no sound'), 4000),
      updated_at = now()
  where job.id = p_job_id
    and job.job_type = 'audio_delivery'::media.processing_job_type
    and job.status = 'processing'::media.processing_job_status
  returning job.upload_intent_id into skipped_intent_id;

  get diagnostics affected = row_count;
  if skipped_intent_id is not null then
    perform private.settle_submission_processing(skipped_intent_id);
  end if;
  return affected;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.submit_media_submission(p_submission_id uuid)
 RETURNS TABLE(submission_id uuid, status media.publication_status, submitted_at timestamp with time zone, review_due_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  request_user_id uuid := auth.uid();
  current_submission media.submissions%rowtype;
  previous_status media.publication_status;
  submission_time timestamptz := now();
begin
  if request_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select *
  into current_submission
  from media.submissions submission
  where submission.id = p_submission_id
  for update;

  if not found then
    raise exception 'Submission not found' using errcode = 'P0002';
  end if;

  if not (select private.can_edit_creator_account(current_submission.creator_account_id)) then
    raise exception 'Not authorized for submission' using errcode = '42501';
  end if;

  if current_submission.status not in (
    'draft'::media.publication_status,
    'ready_to_submit'::media.publication_status,
    'changes_requested'::media.publication_status
  ) then
    raise exception 'Submission cannot be submitted from its current status' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from media.submission_items item
    where item.submission_id = current_submission.id
  ) then
    raise exception 'Submission must have at least one item' using errcode = '22023';
  end if;

  if exists (
    select 1
    from media.submission_items item
    join media.upload_intents intent
      on intent.id = item.upload_intent_id
    where item.submission_id = current_submission.id
      and intent.status <> 'uploaded'::media.upload_intent_status
  ) then
    raise exception 'All upload items must be uploaded before submission' using errcode = '22023';
  end if;

  previous_status := current_submission.status;

  update media.submissions submission
  set status = 'pending_review'::media.publication_status,
      submitted_at = submission_time,
      review_due_at = submission_time + interval '48 hours',
      reviewer_id = null,
      reviewed_at = null,
      review_notes = null,
      rejected_at = null,
      updated_by = request_user_id
  where submission.id = current_submission.id
  returning * into current_submission;

  perform private.add_media_submission_event(
    current_submission.id,
    request_user_id,
    'submitted',
    previous_status,
    current_submission.status,
    null,
    jsonb_build_object('reviewDueAt', current_submission.review_due_at)
  );

  return query
  select
    current_submission.id,
    current_submission.status,
    current_submission.submitted_at,
    current_submission.review_due_at;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.sync_storage_gc_candidates(p_worker_token text, p_objects jsonb)
 RETURNS TABLE(scanned_count integer, candidate_count integer, due_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.verify_media_worker_token(p_worker_token) then
    raise exception 'Invalid media worker token' using errcode = '28000';
  end if;

  if p_objects is null or jsonb_typeof(p_objects) <> 'array' then
    raise exception 'p_objects must be a JSON array' using errcode = '22023';
  end if;

  -- If something became referenced again during its grace period, its unused
  -- clock is discarded. A future transition back to unused starts a fresh
  -- three-day window.
  delete from media.storage_gc_candidates candidate
  where private.storage_object_is_referenced(candidate.bucket, candidate.path);

  insert into media.storage_gc_candidates (
    bucket,
    path,
    first_unused_at,
    last_seen_at,
    file_size_bytes,
    last_modified_at,
    reason
  )
  select
    trim(object_row.value->>'bucket'),
    trim(object_row.value->>'path'),
    now(),
    now(),
    case
      when nullif(object_row.value->>'file_size_bytes', '') is null then null
      else greatest(0, (object_row.value->>'file_size_bytes')::bigint)
    end,
    case
      when nullif(object_row.value->>'last_modified_at', '') is null then null
      else (object_row.value->>'last_modified_at')::timestamptz
    end,
    'unreferenced'
  from jsonb_array_elements(p_objects) object_row(value)
  where trim(coalesce(object_row.value->>'bucket', '')) in (
      'chc-submissions',
      'chc-music',
      'chc-learning',
      'chc-images'
    )
    and length(trim(coalesce(object_row.value->>'path', ''))) > 0
    and not private.storage_object_is_referenced(
      trim(object_row.value->>'bucket'),
      trim(object_row.value->>'path')
    )
  on conflict (bucket, path) do update
  set last_seen_at = excluded.last_seen_at,
      file_size_bytes = excluded.file_size_bytes,
      last_modified_at = excluded.last_modified_at,
      reason = excluded.reason;

  -- A candidate that is no longer present in the storage scan has already
  -- disappeared from R2, so do not keep a stale GC row around.
  delete from media.storage_gc_candidates candidate
  where not exists (
    select 1
    from jsonb_array_elements(p_objects) object_row(value)
    where trim(coalesce(object_row.value->>'bucket', '')) = candidate.bucket
      and trim(coalesce(object_row.value->>'path', '')) = candidate.path
  );

  return query
  select
    jsonb_array_length(p_objects)::integer,
    (select count(*)::integer from media.storage_gc_candidates),
    (
      select count(*)::integer
      from media.storage_gc_candidates candidate
      where candidate.first_unused_at <= now() - interval '3 days'
    );
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.to_coptic_numeral(n integer)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
DECLARE
  rem int := n;
  res text := '';
BEGIN
  IF n IS NULL THEN RETURN NULL; END IF;
  IF n <= 0 OR n > 999 THEN RETURN n::text; END IF;

  WHILE rem > 0 LOOP
    IF rem >= 900 THEN res := res || 'ϣ̅'; rem := rem - 900;
    ELSIF rem >= 800 THEN res := res || 'ⲱ̅'; rem := rem - 800;
    ELSIF rem >= 700 THEN res := res || 'ⲯ̅'; rem := rem - 700;
    ELSIF rem >= 600 THEN res := res || 'ⲭ̅'; rem := rem - 600;
    ELSIF rem >= 500 THEN res := res || 'ⲫ̅'; rem := rem - 500;
    ELSIF rem >= 400 THEN res := res || 'ⲩ̅'; rem := rem - 400;
    ELSIF rem >= 300 THEN res := res || 'ⲧ̅'; rem := rem - 300;
    ELSIF rem >= 200 THEN res := res || 'ⲥ̅'; rem := rem - 200;
    ELSIF rem >= 100 THEN res := res || 'ⲣ̅'; rem := rem - 100;
    ELSIF rem >= 90 THEN res := res || 'ϥ̅'; rem := rem - 90;
    ELSIF rem >= 80 THEN res := res || 'ⲡ̅'; rem := rem - 80;
    ELSIF rem >= 70 THEN res := res || 'ⲟ̅'; rem := rem - 70;
    ELSIF rem >= 60 THEN res := res || 'ⲝ̅'; rem := rem - 60;
    ELSIF rem >= 50 THEN res := res || 'ⲛ̅'; rem := rem - 50;
    ELSIF rem >= 40 THEN res := res || 'ⲙ̅'; rem := rem - 40;
    ELSIF rem >= 30 THEN res := res || 'ⲗ̅'; rem := rem - 30;
    ELSIF rem >= 20 THEN res := res || 'ⲕ̅'; rem := rem - 20;
    ELSIF rem >= 10 THEN res := res || 'ⲓ̅'; rem := rem - 10;
    ELSIF rem >= 9 THEN res := res || 'ⲑ̅'; rem := rem - 9;
    ELSIF rem >= 8 THEN res := res || 'ⲏ̅'; rem := rem - 8;
    ELSIF rem >= 7 THEN res := res || 'ⲍ̅'; rem := rem - 7;
    ELSIF rem >= 6 THEN res := res || 'Ⲋ̅'; rem := rem - 6;
    ELSIF rem >= 5 THEN res := res || 'ⲉ̅'; rem := rem - 5;
    ELSIF rem >= 4 THEN res := res || 'ⲇ̅'; rem := rem - 4;
    ELSIF rem >= 3 THEN res := res || 'ⲅ̅'; rem := rem - 3;
    ELSIF rem >= 2 THEN res := res || 'ⲃ̅'; rem := rem - 2;
    ELSE
      res := res || 'ⲁ̅';
      rem := rem - 1;
    END IF;
  END LOOP;

  RETURN res;
END;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.update_admin_artist_profile(p_artist_id uuid, p_display_name text DEFAULT NULL::text, p_biography text DEFAULT NULL::text, p_social_links jsonb DEFAULT NULL::jsonb, p_profile_image_upload_intent_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.update_creator_artist_profile(p_creator_account_id uuid, p_display_name text DEFAULT NULL::text, p_sort_name text DEFAULT NULL::text, p_biography text DEFAULT NULL::text, p_social_links jsonb DEFAULT NULL::jsonb, p_pinned_release_ids uuid[] DEFAULT NULL::uuid[], p_profile_image_upload_intent_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.update_creator_release(p_release_id uuid, p_title text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_scheduled_release_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_original_release_date date DEFAULT NULL::date, p_clear_original_release_date boolean DEFAULT false, p_localized_titles jsonb DEFAULT NULL::jsonb, p_tracks jsonb DEFAULT NULL::jsonb, p_cover_upload_intent_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  request_user_id uuid := auth.uid();
  release_record music.releases%rowtype;
  account_id uuid;
  submission_id uuid;
  original_status media.publication_status;
  adds_items boolean;
  entry jsonb;
  v_track_id uuid;
  v_item_id uuid;
  position integer := 0;
  keep_ids uuid[] := array[]::uuid[];
  v_is_new boolean;
  locale_entry record;
  earliest timestamptz;
begin
  if request_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select * into release_record
  from music.releases release
  where release.id = p_release_id
  for update;

  if not found then
    raise exception 'Release not found' using errcode = 'P0002';
  end if;

  account_id := release_record.owner_creator_account_id;

  if not (select private.can_edit_creator_account(account_id)) then
    raise exception 'Not authorized for this release' using errcode = '42501';
  end if;

  submission_id := (release_record.metadata ->> 'submissionId')::uuid;

  if p_scheduled_release_at is not null then
    earliest := public.earliest_release_at();
    if p_scheduled_release_at < earliest then
      raise exception 'Choose a release date at least 48 hours from now (earliest % UTC)',
        to_char(earliest, 'YYYY-MM-DD HH24:MI') using errcode = '22023';
    end if;
  end if;

  adds_items := p_cover_upload_intent_id is not null
    or exists (
      select 1
      from jsonb_array_elements(coalesce(p_tracks, '[]'::jsonb)) as t(value)
      where nullif(t.value ->> 'id', '') is null
    );

  if submission_id is not null then
    select submission.status into original_status
    from media.submissions submission
    where submission.id = submission_id
    for update;

    -- Reopen so items can be attached. The status is restored by re-submitting
    -- at the end, which is also what refreshes the review deadline.
    if adds_items and original_status is not null and original_status not in (
      'draft'::media.publication_status,
      'uploading'::media.publication_status,
      'ready_to_submit'::media.publication_status,
      'changes_requested'::media.publication_status
    ) then
      update media.submissions submission
      set status = 'ready_to_submit'::media.publication_status,
          updated_by = request_user_id
      where submission.id = submission_id;
    end if;
  end if;

  update music.releases release
  set title = coalesce(nullif(trim(coalesce(p_title, '')), ''), release.title),
      description = case when p_description is null then release.description else nullif(trim(p_description), '') end,
      scheduled_release_at = coalesce(p_scheduled_release_at, release.scheduled_release_at),
      original_release_date = case
        when p_clear_original_release_date then null
        else coalesce(p_original_release_date, release.original_release_date)
      end,
      updated_by = request_user_id,
      updated_at = now()
  where release.id = p_release_id
  returning * into release_record;

  if p_localized_titles is not null then
    for locale_entry in
      select key as locale, trim(value) as title
      from jsonb_each_text(p_localized_titles)
      where nullif(trim(value), '') is not null
    loop
      insert into music.release_localizations (release_id, locale, title, is_primary, created_by, updated_by)
      values (p_release_id, locale_entry.locale, locale_entry.title, locale_entry.locale = 'en', request_user_id, request_user_id)
      on conflict (release_id, locale) do update
      set title = excluded.title, updated_by = excluded.updated_by, updated_at = now();
    end loop;
  end if;

  if p_cover_upload_intent_id is not null then
    if submission_id is null then
      raise exception 'This release has no submission to attach artwork to' using errcode = '22023';
    end if;

    perform public.add_media_submission_item(
      submission_id, p_cover_upload_intent_id, null, 'Artwork', -1, true,
      'artwork'::media.submission_item_role
    );
  end if;

  if p_tracks is not null then
    if jsonb_typeof(p_tracks) <> 'array' then
      raise exception 'Tracks must be a list' using errcode = '22023';
    end if;

    for entry in select value from jsonb_array_elements(p_tracks)
    loop
      position := position + 1;
      v_track_id := nullif(entry ->> 'id', '')::uuid;
      v_is_new := v_track_id is null;

      if v_track_id is null then
        if nullif(entry ->> 'uploadIntentId', '') is null then
          raise exception 'A new track needs an uploaded file' using errcode = '22023';
        end if;
        if submission_id is null then
          raise exception 'This release has no submission to add tracks to' using errcode = '22023';
        end if;

        insert into music.tracks (owner_creator_account_id, title, publication_status, created_by, updated_by)
        values (
          account_id,
          coalesce(nullif(trim(entry ->> 'title'), ''), release_record.title),
          'draft'::media.publication_status,
          request_user_id, request_user_id
        )
        returning id into v_track_id;

        select result.item_id into v_item_id
        from public.add_media_submission_item(
          submission_id,
          (entry ->> 'uploadIntentId')::uuid,
          null,
          nullif(trim(entry ->> 'title'), ''),
          position,
          true,
          'track'::media.submission_item_role
        ) result;

        update media.submission_items set music_track_id = v_track_id where id = v_item_id;
      else
        if not exists (
          select 1 from music.release_tracks rt
          where rt.release_id = p_release_id and rt.track_id = v_track_id
        ) then
          raise exception 'Track does not belong to this release' using errcode = '42501';
        end if;

        update music.tracks track
        set title = coalesce(nullif(trim(entry ->> 'title'), ''), track.title),
            updated_by = request_user_id,
            updated_at = now()
        where track.id = v_track_id;
      end if;

      -- Renumber into a range no existing row occupies, so the
      -- (release, disc, track number) unique index cannot collide midway.
      update music.release_tracks rt
      set track_number = position + 1000
      where rt.release_id = p_release_id and rt.track_id = v_track_id;

      if not found then
        insert into music.release_tracks (release_id, track_id, disc_number, track_number)
        values (p_release_id, v_track_id, 1, position + 1000);
      end if;

      -- A track just created has no credits yet, so it always takes the
      -- default even when the caller named no artist.
      if v_is_new or entry ? 'mainArtistId' or entry ? 'featuredArtistIds' then
        perform private.set_track_credits(
          v_track_id,
          account_id,
          nullif(entry ->> 'mainArtistId', '')::uuid,
          (
            select array_agg(value::uuid)
            from jsonb_array_elements_text(coalesce(entry -> 'featuredArtistIds', '[]'::jsonb))
            where nullif(value, '') is not null
          )
        );
      end if;

      keep_ids := keep_ids || v_track_id;
    end loop;

    delete from music.release_tracks rt
    where rt.release_id = p_release_id
      and not (rt.track_id = any (keep_ids));

    update music.release_tracks rt
    set track_number = rt.track_number - 1000
    where rt.release_id = p_release_id and rt.track_number > 1000;
  end if;

  -- Send the edit back for review through the normal path, which sets the
  -- submitted time and the 48-hour deadline.
  if submission_id is not null and original_status is not null and original_status <> 'rejected'::media.publication_status then
    perform public.submit_media_submission(submission_id);

    perform private.add_media_submission_event(
      submission_id, request_user_id, 'edited_by_creator', original_status,
      'pending_review'::media.publication_status,
      'The artist edited this release, so it is back in the review queue.',
      jsonb_build_object('releaseId', p_release_id)
    );
  end if;

  return public.get_creator_release(p_release_id);
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.update_creator_release_metadata(p_release_id uuid, p_music_type text DEFAULT NULL::text, p_recording_type text DEFAULT NULL::text, p_localized_titles jsonb DEFAULT NULL::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  request_user_id uuid := auth.uid();
  account_id uuid;
  locale_entry record;
begin
  if request_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select release.owner_creator_account_id
  into account_id
  from music.releases release
  where release.id = p_release_id;

  if account_id is null then
    raise exception 'Release not found' using errcode = 'P0002';
  end if;

  if not (select private.can_edit_creator_account(account_id)) then
    raise exception 'Not authorized for this release' using errcode = '42501';
  end if;

  update music.releases release
  set metadata =
        (coalesce(release.metadata, '{}'::jsonb) - 'musicType' - 'recordingType')
        || case
             when nullif(trim(coalesce(p_music_type, '')), '') is null then '{}'::jsonb
             else jsonb_build_object('musicType', trim(p_music_type))
           end
        || case
             when nullif(trim(coalesce(p_recording_type, '')), '') is null then '{}'::jsonb
             else jsonb_build_object('recordingType', trim(p_recording_type))
           end,
      updated_by = request_user_id,
      updated_at = now()
  where release.id = p_release_id;

  if p_localized_titles is not null then
    delete from music.release_localizations localization
    where localization.release_id = p_release_id
      and localization.locale in ('en', 'ar', 'fr');

    for locale_entry in
      select key as locale, trim(value) as title
      from jsonb_each_text(p_localized_titles)
      where key in ('en', 'ar', 'fr')
        and nullif(trim(value), '') is not null
    loop
      insert into music.release_localizations (
        release_id, locale, title, is_primary, created_by, updated_by
      )
      values (
        p_release_id,
        locale_entry.locale,
        locale_entry.title,
        locale_entry.locale = 'en',
        request_user_id,
        request_user_id
      );
    end loop;
  end if;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.update_creator_release_v2(p_release_id uuid, p_title text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_scheduled_release_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_original_release_date date DEFAULT NULL::date, p_clear_original_release_date boolean DEFAULT false, p_localized_titles jsonb DEFAULT NULL::jsonb, p_music_type text DEFAULT NULL::text, p_recording_type text DEFAULT NULL::text, p_tracks jsonb DEFAULT NULL::jsonb, p_cover_upload_intent_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  base_payload jsonb;
  account_id uuid;
  submission_id uuid;
  submission_status media.publication_status;
  entry jsonb;
  v_track_id uuid;
  position integer := 0;
  locale_entry record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select release.owner_creator_account_id
  into account_id
  from music.releases release
  where release.id = p_release_id;

  if account_id is null then
    raise exception 'Release not found' using errcode = 'P0002';
  end if;

  if not (select private.can_edit_creator_account(account_id)) then
    raise exception 'Not authorized for this release' using errcode = '42501';
  end if;

  select nullif(release.metadata ->> 'submissionId', '')::uuid
  into submission_id
  from music.releases release
  where release.id = p_release_id;

  if submission_id is not null then
    select submission.status
    into submission_status
    from media.submissions submission
    where submission.id = submission_id
    for update;

    if submission_status is not null
       and submission_status not in (
         'draft'::media.publication_status,
         'uploading'::media.publication_status,
         'ready_to_submit'::media.publication_status,
         'changes_requested'::media.publication_status
       ) then
      update media.submissions submission
      set status = 'ready_to_submit'::media.publication_status,
          updated_by = auth.uid(),
          updated_at = now()
      where submission.id = submission_id;
    end if;
  end if;

  base_payload := public.update_creator_release(
    p_release_id,
    p_title,
    p_description,
    p_scheduled_release_at,
    p_original_release_date,
    p_clear_original_release_date,
    null,
    p_tracks,
    p_cover_upload_intent_id
  );

  perform public.update_creator_release_metadata(
    p_release_id,
    p_music_type,
    p_recording_type,
    p_localized_titles
  );

  if p_tracks is not null then
    for entry in
      select item.value
      from jsonb_array_elements(p_tracks)
      with ordinality as item(value, ordinality)
      order by item.ordinality
    loop
      position := position + 1;

      select rt.track_id
      into v_track_id
      from music.release_tracks rt
      where rt.release_id = p_release_id
        and rt.disc_number = 1
        and rt.track_number = position;

      if v_track_id is null then
        raise exception 'Could not resolve track % after release update', position;
      end if;

      perform private.set_track_credit_refs(
        v_track_id,
        account_id,
        entry ->> 'mainArtistName',
        nullif(entry ->> 'mainArtistId','')::uuid,
        coalesce(entry -> 'contributors', '[]'::jsonb)
      );

      if entry ? 'localizedTitles' then
        delete from music.track_localizations tl
        where tl.track_id = v_track_id
          and tl.locale in ('en', 'ar', 'fr');

        for locale_entry in
          select loc.key as locale, trim(loc.value) as title
          from jsonb_each_text(coalesce(entry -> 'localizedTitles', '{}'::jsonb)) as loc(key, value)
          where loc.key in ('en', 'ar', 'fr')
            and nullif(trim(loc.value), '') is not null
        loop
          insert into music.track_localizations (
            track_id,
            locale,
            title,
            is_primary,
            publication_status,
            created_by,
            updated_by
          )
          values (
            v_track_id,
            locale_entry.locale,
            locale_entry.title,
            locale_entry.locale = 'en',
            'draft'::media.publication_status,
            auth.uid(),
            auth.uid()
          )
          on conflict on constraint track_localizations_track_id_locale_key do update
          set title = excluded.title,
              is_primary = excluded.is_primary,
              updated_by = excluded.updated_by,
              updated_at = now();
        end loop;
      end if;
    end loop;
  end if;

  return public.get_creator_release(p_release_id);
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.update_creator_release_v3(p_release_id uuid, p_title text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_release_timing_mode text DEFAULT NULL::text, p_scheduled_release_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_original_release_date date DEFAULT NULL::date, p_clear_original_release_date boolean DEFAULT false, p_localized_titles jsonb DEFAULT NULL::jsonb, p_music_type text DEFAULT NULL::text, p_recording_type text DEFAULT NULL::text, p_tracks jsonb DEFAULT NULL::jsonb, p_cover_upload_intent_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  release_record music.releases%rowtype;
  normalized_timing text;
  result_payload jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select *
  into release_record
  from music.releases release
  where release.id = p_release_id
  for update;

  if not found then
    raise exception 'Release not found' using errcode = 'P0002';
  end if;

  if not (select private.can_edit_creator_account(release_record.owner_creator_account_id)) then
    raise exception 'Not authorized for this release' using errcode = '42501';
  end if;

  normalized_timing := lower(trim(coalesce(p_release_timing_mode, release_record.release_timing_mode, 'asap')));

  if normalized_timing not in ('asap', 'scheduled') then
    raise exception 'Release timing must be asap or scheduled' using errcode = '22023';
  end if;

  if normalized_timing = 'scheduled'
     and p_scheduled_release_at is null
     and release_record.scheduled_release_at is null then
    raise exception 'Choose a scheduled release date and time' using errcode = '22023';
  end if;

  if normalized_timing = 'asap' then
    update music.releases release
    set release_timing_mode = 'asap',
        scheduled_release_at = null,
        updated_at = now()
    where release.id = p_release_id;
  else
    update music.releases release
    set release_timing_mode = 'scheduled',
        updated_at = now()
    where release.id = p_release_id;
  end if;

  result_payload := public.update_creator_release_v2(
    p_release_id,
    p_title,
    p_description,
    case when normalized_timing = 'scheduled' then p_scheduled_release_at else null end,
    p_original_release_date,
    p_clear_original_release_date,
    p_localized_titles,
    p_music_type,
    p_recording_type,
    p_tracks,
    p_cover_upload_intent_id
  );

  update music.releases release
  set release_timing_mode = normalized_timing,
      scheduled_release_at = case
        when normalized_timing = 'asap' then null
        else release.scheduled_release_at
      end,
      updated_at = now()
  where release.id = p_release_id;

  return public.get_creator_release(p_release_id);
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.update_learning_playlist(p_playlist_id uuid, p_name text, p_description text DEFAULT NULL::text, p_visibility learning.playlist_visibility DEFAULT 'private'::learning.playlist_visibility)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if length(trim(coalesce(p_name,'')))=0 then raise exception 'Playlist name is required'; end if;
  update learning.playlists set name=trim(p_name), description=nullif(trim(coalesce(p_description,'')),''), visibility=p_visibility
  where id=p_playlist_id and owner_user_id=auth.uid();
  if not found then raise exception 'Playlist not found' using errcode='42501'; end if;
  return public.get_learning_playlist(p_playlist_id,'en');
end; $function$
;
--;;
CREATE OR REPLACE FUNCTION public.update_music_playlist(p_playlist_id uuid, p_name text, p_description text DEFAULT NULL::text, p_visibility music.playlist_visibility DEFAULT 'private'::music.playlist_visibility)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if length(trim(coalesce(p_name, ''))) = 0 then
    raise exception 'Playlist name is required' using errcode = '22023';
  end if;
  if not (select private.music_playlist_is_editable(p_playlist_id)) then
    raise exception 'Playlist not found or not editable' using errcode = '42501';
  end if;

  update music.playlists
  set name = trim(p_name),
      description = nullif(trim(coalesce(p_description, '')), ''),
      visibility = p_visibility,
      updated_at = now()
  where id = p_playlist_id;

  return found;
end;
$function$
;
--;;
CREATE OR REPLACE FUNCTION public.veneration_validate_hymn_key()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF NEW.item_type IS NULL THEN
        IF NOT EXISTS (
            SELECT 1
            FROM veneration.hymn_titles
            WHERE hymn_key = NEW.hymn_key
        ) THEN
            RAISE EXCEPTION 'Invalid hymn_key: %', NEW.hymn_key;
        END IF;
    END IF;

    RETURN NEW;
END;
$function$
;
--;;
alter table creator.creator_account_members alter column created_at set default now();
--;;
alter table creator.creator_account_members alter column updated_at set default now();
--;;
alter table creator.creator_accounts alter column created_at set default now();
--;;
alter table creator.creator_accounts alter column id set default gen_random_uuid();
--;;
alter table creator.creator_accounts alter column status set default 'active'::creator.creator_account_status;
--;;
alter table creator.creator_accounts alter column updated_at set default now();
--;;
alter table creator.profiles alter column created_at set default now();
--;;
alter table creator.profiles alter column preferred_locale set default 'en'::text;
--;;
alter table creator.profiles alter column updated_at set default now();
--;;
alter table creator.user_roles alter column granted_at set default now();
--;;
alter table learning.album_localizations alter column created_at set default now();
--;;
alter table learning.album_localizations alter column updated_at set default now();
--;;
alter table learning.album_recordings alter column created_at set default now();
--;;
alter table learning.album_recordings alter column created_by set default auth.uid();
--;;
alter table learning.album_recordings alter column id set default gen_random_uuid();
--;;
alter table learning.album_recordings alter column metadata set default '{}'::jsonb;
--;;
alter table learning.album_recordings alter column publication_status set default 'draft'::media.publication_status;
--;;
alter table learning.album_recordings alter column sort_order set default 0;
--;;
alter table learning.album_recordings alter column updated_at set default now();
--;;
alter table learning.albums alter column created_at set default now();
--;;
alter table learning.albums alter column created_by set default auth.uid();
--;;
alter table learning.albums alter column id set default gen_random_uuid();
--;;
alter table learning.albums alter column metadata set default '{}'::jsonb;
--;;
alter table learning.albums alter column publication_status set default 'draft'::media.publication_status;
--;;
alter table learning.albums alter column release_timing_mode set default 'asap'::text;
--;;
alter table learning.albums alter column updated_at set default now();
--;;
alter table learning.cantor_localizations alter column created_at set default now();
--;;
alter table learning.cantor_localizations alter column updated_at set default now();
--;;
alter table learning.cantor_permissions alter column created_at set default now();
--;;
alter table learning.cantor_permissions alter column id set default gen_random_uuid();
--;;
alter table learning.cantor_permissions alter column role set default 'editor'::text;
--;;
alter table learning.cantor_permissions alter column updated_at set default now();
--;;
alter table learning.cantors alter column created_at set default now();
--;;
alter table learning.cantors alter column created_by set default auth.uid();
--;;
alter table learning.cantors alter column id set default gen_random_uuid();
--;;
alter table learning.cantors alter column metadata set default '{}'::jsonb;
--;;
alter table learning.cantors alter column publication_status set default 'draft'::media.publication_status;
--;;
alter table learning.cantors alter column updated_at set default now();
--;;
alter table learning.hymn_localizations alter column created_at set default now();
--;;
alter table learning.hymn_localizations alter column updated_at set default now();
--;;
alter table learning.hymn_progress alter column created_at set default now();
--;;
alter table learning.hymn_progress alter column updated_at set default now();
--;;
alter table learning.hymn_relationships alter column created_at set default now();
--;;
alter table learning.hymn_relationships alter column id set default gen_random_uuid();
--;;
alter table learning.hymn_relationships alter column metadata set default '{}'::jsonb;
--;;
alter table learning.hymn_relationships alter column sort_order set default 0;
--;;
alter table learning.hymn_relationships alter column updated_at set default now();
--;;
alter table learning.hymn_seasons alter column created_at set default now();
--;;
alter table learning.hymn_seasons alter column sort_order set default 0;
--;;
alter table learning.hymns alter column created_at set default now();
--;;
alter table learning.hymns alter column created_by set default auth.uid();
--;;
alter table learning.hymns alter column id set default gen_random_uuid();
--;;
alter table learning.hymns alter column metadata set default '{}'::jsonb;
--;;
alter table learning.hymns alter column publication_status set default 'draft'::media.publication_status;
--;;
alter table learning.hymns alter column updated_at set default now();
--;;
alter table learning.item_likes alter column created_at set default now();
--;;
alter table learning.item_likes alter column id set default gen_random_uuid();
--;;
alter table learning.item_likes alter column user_id set default auth.uid();
--;;
alter table learning.item_progress alter column created_at set default now();
--;;
alter table learning.item_progress alter column id set default gen_random_uuid();
--;;
alter table learning.item_progress alter column state set default 'will_learn'::learning.progress_state;
--;;
alter table learning.item_progress alter column updated_at set default now();
--;;
alter table learning.item_progress alter column user_id set default auth.uid();
--;;
alter table learning.lesson_localizations alter column created_at set default now();
--;;
alter table learning.lesson_localizations alter column updated_at set default now();
--;;
alter table learning.lesson_set_localizations alter column created_at set default now();
--;;
alter table learning.lesson_set_localizations alter column updated_at set default now();
--;;
alter table learning.lesson_sets alter column created_at set default now();
--;;
alter table learning.lesson_sets alter column created_by set default auth.uid();
--;;
alter table learning.lesson_sets alter column id set default gen_random_uuid();
--;;
alter table learning.lesson_sets alter column metadata set default '{}'::jsonb;
--;;
alter table learning.lesson_sets alter column publication_status set default 'draft'::media.publication_status;
--;;
alter table learning.lesson_sets alter column release_timing_mode set default 'asap'::text;
--;;
alter table learning.lesson_sets alter column updated_at set default now();
--;;
alter table learning.lessons alter column created_at set default now();
--;;
alter table learning.lessons alter column created_by set default auth.uid();
--;;
alter table learning.lessons alter column id set default gen_random_uuid();
--;;
alter table learning.lessons alter column metadata set default '{}'::jsonb;
--;;
alter table learning.lessons alter column publication_status set default 'draft'::media.publication_status;
--;;
alter table learning.lessons alter column sort_order set default 0;
--;;
alter table learning.lessons alter column updated_at set default now();
--;;
alter table learning.lyric_edit_drafts alter column created_at set default now();
--;;
alter table learning.lyric_edit_drafts alter column id set default gen_random_uuid();
--;;
alter table learning.lyric_edit_drafts alter column lines set default '[]'::jsonb;
--;;
alter table learning.lyric_edit_drafts alter column sync_precision set default 'unsynced'::music.lyric_sync_precision;
--;;
alter table learning.lyric_edit_drafts alter column updated_at set default now();
--;;
alter table learning.lyric_lines alter column created_at set default now();
--;;
alter table learning.lyric_lines alter column id set default gen_random_uuid();
--;;
alter table learning.lyric_lines alter column updated_at set default now();
--;;
alter table learning.lyric_sets alter column created_at set default now();
--;;
alter table learning.lyric_sets alter column id set default gen_random_uuid();
--;;
alter table learning.lyric_sets alter column publication_status set default 'draft'::media.publication_status;
--;;
alter table learning.lyric_sets alter column sync_precision set default 'unsynced'::music.lyric_sync_precision;
--;;
alter table learning.lyric_sets alter column updated_at set default now();
--;;
alter table learning.playlist_items alter column created_at set default now();
--;;
alter table learning.playlist_items alter column id set default gen_random_uuid();
--;;
alter table learning.playlist_items alter column sort_order set default 0;
--;;
alter table learning.playlists alter column created_at set default now();
--;;
alter table learning.playlists alter column id set default gen_random_uuid();
--;;
alter table learning.playlists alter column owner_user_id set default auth.uid();
--;;
alter table learning.playlists alter column updated_at set default now();
--;;
alter table learning.playlists alter column visibility set default 'private'::learning.playlist_visibility;
--;;
alter table learning.recording_localizations alter column created_at set default now();
--;;
alter table learning.recording_localizations alter column updated_at set default now();
--;;
alter table learning.season_localizations alter column created_at set default now();
--;;
alter table learning.season_localizations alter column updated_at set default now();
--;;
alter table learning.seasons alter column created_at set default now();
--;;
alter table learning.seasons alter column created_by set default auth.uid();
--;;
alter table learning.seasons alter column id set default gen_random_uuid();
--;;
alter table learning.seasons alter column metadata set default '{}'::jsonb;
--;;
alter table learning.seasons alter column publication_status set default 'draft'::media.publication_status;
--;;
alter table learning.seasons alter column sort_order set default 0;
--;;
alter table learning.seasons alter column updated_at set default now();
--;;
alter table media.locales alter column created_at set default now();
--;;
alter table media.locales alter column enabled set default true;
--;;
alter table media.locales alter column sort_order set default 0;
--;;
alter table media.locales alter column text_direction set default 'ltr'::text;
--;;
alter table media.locales alter column updated_at set default now();
--;;
alter table media.localized_texts alter column created_at set default now();
--;;
alter table media.localized_texts alter column id set default gen_random_uuid();
--;;
alter table media.localized_texts alter column is_primary set default false;
--;;
alter table media.localized_texts alter column publication_status set default 'draft'::media.publication_status;
--;;
alter table media.localized_texts alter column updated_at set default now();
--;;
alter table media.media_asset_versions alter column created_at set default now();
--;;
alter table media.media_asset_versions alter column id set default gen_random_uuid();
--;;
alter table media.media_asset_versions alter column processing_status set default 'pending'::media.processing_status;
--;;
alter table media.media_asset_versions alter column provider set default 'cloudflare_r2'::media.media_provider;
--;;
alter table media.media_assets alter column created_at set default now();
--;;
alter table media.media_assets alter column id set default gen_random_uuid();
--;;
alter table media.media_assets alter column metadata set default '{}'::jsonb;
--;;
alter table media.media_assets alter column processing_status set default 'pending'::media.processing_status;
--;;
alter table media.media_assets alter column provider set default 'cloudflare_r2'::media.media_provider;
--;;
alter table media.media_assets alter column publication_status set default 'draft'::media.publication_status;
--;;
alter table media.media_assets alter column updated_at set default now();
--;;
alter table media.media_assets alter column version set default 1;
--;;
alter table media.media_processing_jobs alter column attempt_count set default 0;
--;;
alter table media.media_processing_jobs alter column available_at set default now();
--;;
alter table media.media_processing_jobs alter column created_at set default now();
--;;
alter table media.media_processing_jobs alter column id set default gen_random_uuid();
--;;
alter table media.media_processing_jobs alter column job_type set default 'audio_delivery'::media.processing_job_type;
--;;
alter table media.media_processing_jobs alter column max_attempts set default 3;
--;;
alter table media.media_processing_jobs alter column probe set default '{}'::jsonb;
--;;
alter table media.media_processing_jobs alter column queued_at set default now();
--;;
alter table media.media_processing_jobs alter column status set default 'queued'::media.processing_job_status;
--;;
alter table media.media_processing_jobs alter column updated_at set default now();
--;;
alter table media.search_aliases alter column created_at set default now();
--;;
alter table media.search_aliases alter column id set default gen_random_uuid();
--;;
alter table media.search_aliases alter column publication_status set default 'draft'::media.publication_status;
--;;
alter table media.search_aliases alter column updated_at set default now();
--;;
alter table media.search_documents alter column created_at set default now();
--;;
alter table media.search_documents alter column id set default gen_random_uuid();
--;;
alter table media.search_documents alter column metadata set default '{}'::jsonb;
--;;
alter table media.search_documents alter column publication_status set default 'draft'::media.publication_status;
--;;
alter table media.search_documents alter column updated_at set default now();
--;;
alter table media.storage_gc_candidates alter column first_unused_at set default now();
--;;
alter table media.storage_gc_candidates alter column last_seen_at set default now();
--;;
alter table media.storage_gc_candidates alter column reason set default 'unreferenced'::text;
--;;
alter table media.submission_events alter column created_at set default now();
--;;
alter table media.submission_events alter column id set default gen_random_uuid();
--;;
alter table media.submission_events alter column metadata set default '{}'::jsonb;
--;;
alter table media.submission_items alter column created_at set default now();
--;;
alter table media.submission_items alter column id set default gen_random_uuid();
--;;
alter table media.submission_items alter column localized_titles set default '{}'::jsonb;
--;;
alter table media.submission_items alter column required set default true;
--;;
alter table media.submission_items alter column role set default 'other'::media.submission_item_role;
--;;
alter table media.submission_items alter column sort_order set default 0;
--;;
alter table media.submission_items alter column updated_at set default now();
--;;
alter table media.submissions alter column created_at set default now();
--;;
alter table media.submissions alter column id set default gen_random_uuid();
--;;
alter table media.submissions alter column status set default 'draft'::media.publication_status;
--;;
alter table media.submissions alter column updated_at set default now();
--;;
alter table media.upload_intents alter column bucket set default 'chc-submissions'::text;
--;;
alter table media.upload_intents alter column created_at set default now();
--;;
alter table media.upload_intents alter column id set default gen_random_uuid();
--;;
alter table media.upload_intents alter column status set default 'authorized'::media.upload_intent_status;
--;;
alter table media.upload_intents alter column updated_at set default now();
--;;
alter table music.artist_follows alter column created_at set default now();
--;;
alter table music.artist_localizations alter column created_at set default now();
--;;
alter table music.artist_localizations alter column id set default gen_random_uuid();
--;;
alter table music.artist_localizations alter column is_primary set default false;
--;;
alter table music.artist_localizations alter column publication_status set default 'draft'::media.publication_status;
--;;
alter table music.artist_localizations alter column updated_at set default now();
--;;
alter table music.artist_memberships alter column created_at set default now();
--;;
alter table music.artist_memberships alter column id set default gen_random_uuid();
--;;
alter table music.artist_memberships alter column role set default 'manager'::text;
--;;
alter table music.artist_memberships alter column updated_at set default now();
--;;
alter table music.artist_pinned_releases alter column created_at set default now();
--;;
alter table music.artist_pinned_releases alter column sort_order set default 0;
--;;
alter table music.artist_social_links alter column created_at set default now();
--;;
alter table music.artist_social_links alter column id set default gen_random_uuid();
--;;
alter table music.artist_social_links alter column sort_order set default 0;
--;;
alter table music.artist_social_links alter column updated_at set default now();
--;;
alter table music.artists alter column created_at set default now();
--;;
alter table music.artists alter column id set default gen_random_uuid();
--;;
alter table music.artists alter column metadata set default '{}'::jsonb;
--;;
alter table music.artists alter column publication_status set default 'draft'::media.publication_status;
--;;
alter table music.artists alter column updated_at set default now();
--;;
alter table music.lyric_edit_drafts alter column created_at set default now();
--;;
alter table music.lyric_edit_drafts alter column lines set default '[]'::jsonb;
--;;
alter table music.lyric_edit_drafts alter column sync_precision set default 'line'::music.lyric_sync_precision;
--;;
alter table music.lyric_edit_drafts alter column updated_at set default now();
--;;
alter table music.lyric_lines alter column created_at set default now();
--;;
alter table music.lyric_lines alter column id set default gen_random_uuid();
--;;
alter table music.lyric_lines alter column updated_at set default now();
--;;
alter table music.lyric_sets alter column created_at set default now();
--;;
alter table music.lyric_sets alter column id set default gen_random_uuid();
--;;
alter table music.lyric_sets alter column metadata set default '{}'::jsonb;
--;;
alter table music.lyric_sets alter column publication_status set default 'draft'::media.publication_status;
--;;
alter table music.lyric_sets alter column sync_precision set default 'line'::music.lyric_sync_precision;
--;;
alter table music.lyric_sets alter column updated_at set default now();
--;;
alter table music.lyric_words alter column created_at set default now();
--;;
alter table music.lyric_words alter column id set default gen_random_uuid();
--;;
alter table music.lyric_words alter column updated_at set default now();
--;;
alter table music.play_history alter column completed set default false;
--;;
alter table music.play_history alter column id set default gen_random_uuid();
--;;
alter table music.play_history alter column played_at set default now();
--;;
alter table music.playlist_tracks alter column created_at set default now();
--;;
alter table music.playlist_tracks alter column sort_order set default 0;
--;;
alter table music.playlists alter column created_at set default now();
--;;
alter table music.playlists alter column id set default gen_random_uuid();
--;;
alter table music.playlists alter column updated_at set default now();
--;;
alter table music.playlists alter column visibility set default 'private'::music.playlist_visibility;
--;;
alter table music.release_likes alter column created_at set default now();
--;;
alter table music.release_localizations alter column created_at set default now();
--;;
alter table music.release_localizations alter column id set default gen_random_uuid();
--;;
alter table music.release_localizations alter column is_primary set default false;
--;;
alter table music.release_localizations alter column publication_status set default 'draft'::media.publication_status;
--;;
alter table music.release_localizations alter column updated_at set default now();
--;;
alter table music.release_tracks alter column created_at set default now();
--;;
alter table music.release_tracks alter column disc_number set default 1;
--;;
alter table music.release_tracks alter column id set default gen_random_uuid();
--;;
alter table music.releases alter column created_at set default now();
--;;
alter table music.releases alter column id set default gen_random_uuid();
--;;
alter table music.releases alter column metadata set default '{}'::jsonb;
--;;
alter table music.releases alter column publication_status set default 'draft'::media.publication_status;
--;;
alter table music.releases alter column release_timing_mode set default 'asap'::text;
--;;
alter table music.releases alter column updated_at set default now();
--;;
alter table music.track_artists alter column created_at set default now();
--;;
alter table music.track_artists alter column role set default 'primary'::music.track_artist_role;
--;;
alter table music.track_artists alter column sort_order set default 0;
--;;
alter table music.track_likes alter column created_at set default now();
--;;
alter table music.track_localizations alter column created_at set default now();
--;;
alter table music.track_localizations alter column id set default gen_random_uuid();
--;;
alter table music.track_localizations alter column is_primary set default false;
--;;
alter table music.track_localizations alter column publication_status set default 'draft'::media.publication_status;
--;;
alter table music.track_localizations alter column updated_at set default now();
--;;
alter table music.tracks alter column created_at set default now();
--;;
alter table music.tracks alter column id set default gen_random_uuid();
--;;
alter table music.tracks alter column metadata set default '{}'::jsonb;
--;;
alter table music.tracks alter column publication_status set default 'draft'::media.publication_status;
--;;
alter table music.tracks alter column updated_at set default now();
--;;
alter table private.media_worker_tokens alter column created_at set default now();
--;;
alter table private.media_worker_tokens alter column id set default gen_random_uuid();
--;;
alter table private.notification_deliveries alter column attempt_count set default 0;
--;;
alter table private.notification_deliveries alter column available_at set default now();
--;;
alter table private.notification_deliveries alter column created_at set default now();
--;;
alter table private.notification_deliveries alter column id set default gen_random_uuid();
--;;
alter table private.notification_deliveries alter column max_attempts set default 5;
--;;
alter table private.notification_deliveries alter column status set default 'queued'::text;
--;;
alter table private.notification_deliveries alter column updated_at set default now();
--;;
alter table public.bible_highlights alter column created_at set default now();
--;;
alter table public.bible_highlights alter column highlight_deletions set default '{}'::jsonb;
--;;
alter table public.bible_highlights alter column highlights set default '[]'::jsonb;
--;;
alter table public.bible_highlights alter column id set default gen_random_uuid();
--;;
alter table public.bible_highlights alter column updated_at set default now();
--;;
alter table public.hymn_titles alter column toggled set default true;
--;;
alter table public.notification_broadcasts alter column app_key set default 'chc'::text;
--;;
alter table public.notification_broadcasts alter column created_at set default now();
--;;
alter table public.notification_broadcasts alter column delivery_count set default 0;
--;;
alter table public.notification_broadcasts alter column id set default gen_random_uuid();
--;;
alter table public.notification_broadcasts alter column payload set default '{}'::jsonb;
--;;
alter table public.notification_broadcasts alter column recipient_count set default 0;
--;;
alter table public.notification_devices alter column created_at set default now();
--;;
alter table public.notification_devices alter column enabled set default true;
--;;
alter table public.notification_devices alter column id set default gen_random_uuid();
--;;
alter table public.notification_devices alter column last_seen_at set default now();
--;;
alter table public.notification_devices alter column provider_data set default '{}'::jsonb;
--;;
alter table public.notification_devices alter column updated_at set default now();
--;;
alter table public.notification_preferences alter column created_at set default now();
--;;
alter table public.notification_preferences alter column enabled set default true;
--;;
alter table public.notification_preferences alter column updated_at set default now();
--;;
alter table public.notifications alter column created_at set default now();
--;;
alter table public.notifications alter column id set default gen_random_uuid();
--;;
alter table public.notifications alter column payload set default '{}'::jsonb;
--;;
alter table public.sermon_plans alter column created_at set default now();
--;;
alter table public.sermon_plans alter column general_notes set default ''::text;
--;;
alter table public.sermon_plans alter column highlight_deletions set default '{}'::jsonb;
--;;
alter table public.sermon_plans alter column highlights set default '[]'::jsonb;
--;;
alter table public.sermon_plans alter column id set default gen_random_uuid();
--;;
alter table public.sermon_plans alter column updated_at set default now();
--;;
alter table public.spiritual_canon_days alter column created_at set default now();
--;;
alter table public.spiritual_canon_days alter column marks set default '{}'::jsonb;
--;;
alter table public.spiritual_canon_days alter column updated_at set default now();
--;;
alter table public.spiritual_canons alter column created_at set default now();
--;;
alter table public.spiritual_canons alter column item_deletions set default '{}'::jsonb;
--;;
alter table public.spiritual_canons alter column items set default '[]'::jsonb;
--;;
alter table public.spiritual_canons alter column updated_at set default now();
--;;
alter table public.user_content_preferences alter column bookmarks set default '{}'::text[];
--;;
alter table public.user_content_preferences alter column created_at set default now();
--;;
alter table public.user_content_preferences alter column preferences set default '{}'::jsonb;
--;;
alter table public.user_content_preferences alter column updated_at set default now();
--;;
alter table creator.creator_account_members add constraint creator_account_members_pkey PRIMARY KEY (creator_account_id, user_id);
--;;
alter table creator.creator_accounts add constraint creator_accounts_display_name_not_blank CHECK ((length(TRIM(BOTH FROM display_name)) > 0));
--;;
alter table creator.creator_accounts add constraint creator_accounts_pkey PRIMARY KEY (id);
--;;
alter table creator.profiles add constraint profiles_pkey PRIMARY KEY (id);
--;;
alter table creator.profiles add constraint profiles_preferred_locale_not_blank CHECK ((length(TRIM(BOTH FROM preferred_locale)) > 0));
--;;
alter table creator.user_roles add constraint user_roles_pkey PRIMARY KEY (user_id, role);
--;;
alter table creator.user_roles add constraint user_roles_revoked_after_granted CHECK (((revoked_at IS NULL) OR (revoked_at >= granted_at)));
--;;
alter table learning.album_localizations add constraint album_localizations_pkey PRIMARY KEY (album_id, locale);
--;;
alter table learning.album_localizations add constraint album_localizations_title_check CHECK ((length(TRIM(BOTH FROM title)) > 0));
--;;
alter table learning.album_recordings add constraint album_recordings_album_id_sort_order_key UNIQUE (album_id, sort_order);
--;;
alter table learning.album_recordings add constraint album_recordings_duration_ms_check CHECK (((duration_ms IS NULL) OR (duration_ms >= 0)));
--;;
alter table learning.album_recordings add constraint album_recordings_pkey PRIMARY KEY (id);
--;;
alter table learning.album_recordings add constraint album_recordings_title_check CHECK ((length(TRIM(BOTH FROM title)) > 0));
--;;
alter table learning.albums add constraint albums_pkey PRIMARY KEY (id);
--;;
alter table learning.albums add constraint albums_title_check CHECK ((length(TRIM(BOTH FROM title)) > 0));
--;;
alter table learning.albums add constraint learning_album_release_timing_valid CHECK (((release_timing_mode = ANY (ARRAY['asap'::text, 'scheduled'::text])) AND ((release_timing_mode <> 'scheduled'::text) OR (scheduled_release_at IS NOT NULL))));
--;;
alter table learning.cantor_localizations add constraint cantor_localizations_display_name_check CHECK ((length(TRIM(BOTH FROM display_name)) > 0));
--;;
alter table learning.cantor_localizations add constraint cantor_localizations_pkey PRIMARY KEY (cantor_id, locale);
--;;
alter table learning.cantor_permissions add constraint cantor_permissions_cantor_id_creator_account_id_key UNIQUE (cantor_id, creator_account_id);
--;;
alter table learning.cantor_permissions add constraint cantor_permissions_pkey PRIMARY KEY (id);
--;;
alter table learning.cantor_permissions add constraint cantor_permissions_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'editor'::text, 'uploader'::text])));
--;;
alter table learning.cantors add constraint cantors_display_name_check CHECK ((length(TRIM(BOTH FROM display_name)) > 0));
--;;
alter table learning.cantors add constraint cantors_pkey PRIMARY KEY (id);
--;;
alter table learning.hymn_localizations add constraint hymn_localizations_pkey PRIMARY KEY (hymn_id, locale);
--;;
alter table learning.hymn_localizations add constraint hymn_localizations_title_check CHECK ((length(TRIM(BOTH FROM title)) > 0));
--;;
alter table learning.hymn_progress add constraint hymn_progress_pkey PRIMARY KEY (user_id, hymn_id);
--;;
alter table learning.hymn_relationships add constraint hymn_relationships_check CHECK ((hymn_id <> related_hymn_id));
--;;
alter table learning.hymn_relationships add constraint hymn_relationships_hymn_id_related_hymn_id_relationship_typ_key UNIQUE (hymn_id, related_hymn_id, relationship_type);
--;;
alter table learning.hymn_relationships add constraint hymn_relationships_pkey PRIMARY KEY (id);
--;;
alter table learning.hymn_relationships add constraint hymn_relationships_relationship_type_check CHECK ((length(TRIM(BOTH FROM relationship_type)) > 0));
--;;
alter table learning.hymn_seasons add constraint hymn_seasons_pkey PRIMARY KEY (hymn_id, season_id);
--;;
alter table learning.hymns add constraint hymns_pkey PRIMARY KEY (id);
--;;
alter table learning.hymns add constraint hymns_source_hymn_key_key UNIQUE (source_hymn_key);
--;;
alter table learning.hymns add constraint hymns_title_check CHECK ((length(TRIM(BOTH FROM title)) > 0));
--;;
alter table learning.item_likes add constraint item_likes_check CHECK ((((item_kind = 'album_recording'::learning.playlist_item_kind) AND (album_recording_id IS NOT NULL) AND (lesson_id IS NULL)) OR ((item_kind = 'lesson'::learning.playlist_item_kind) AND (lesson_id IS NOT NULL) AND (album_recording_id IS NULL))));
--;;
alter table learning.item_likes add constraint item_likes_pkey PRIMARY KEY (id);
--;;
alter table learning.item_progress add constraint item_progress_check CHECK ((((item_kind = 'album_recording'::learning.playlist_item_kind) AND (album_recording_id IS NOT NULL) AND (lesson_id IS NULL)) OR ((item_kind = 'lesson'::learning.playlist_item_kind) AND (lesson_id IS NOT NULL) AND (album_recording_id IS NULL))));
--;;
alter table learning.item_progress add constraint item_progress_pkey PRIMARY KEY (id);
--;;
alter table learning.lesson_localizations add constraint lesson_localizations_pkey PRIMARY KEY (lesson_id, locale);
--;;
alter table learning.lesson_localizations add constraint lesson_localizations_title_check CHECK ((length(TRIM(BOTH FROM title)) > 0));
--;;
alter table learning.lesson_set_localizations add constraint lesson_set_localizations_pkey PRIMARY KEY (lesson_set_id, locale);
--;;
alter table learning.lesson_set_localizations add constraint lesson_set_localizations_title_check CHECK ((length(TRIM(BOTH FROM title)) > 0));
--;;
alter table learning.lesson_sets add constraint learning_lesson_release_timing_valid CHECK (((release_timing_mode = ANY (ARRAY['asap'::text, 'scheduled'::text])) AND ((release_timing_mode <> 'scheduled'::text) OR (scheduled_release_at IS NOT NULL))));
--;;
alter table learning.lesson_sets add constraint lesson_sets_pkey PRIMARY KEY (id);
--;;
alter table learning.lesson_sets add constraint lesson_sets_title_check CHECK ((length(TRIM(BOTH FROM title)) > 0));
--;;
alter table learning.lessons add constraint lessons_duration_ms_check CHECK (((duration_ms IS NULL) OR (duration_ms >= 0)));
--;;
alter table learning.lessons add constraint lessons_lesson_set_id_sort_order_key UNIQUE (lesson_set_id, sort_order);
--;;
alter table learning.lessons add constraint lessons_pkey PRIMARY KEY (id);
--;;
alter table learning.lessons add constraint lessons_title_check CHECK ((length(TRIM(BOTH FROM title)) > 0));
--;;
alter table learning.lyric_edit_drafts add constraint lyric_edit_drafts_check CHECK ((((item_kind = 'album_recording'::learning.playlist_item_kind) AND (album_recording_id IS NOT NULL) AND (lesson_id IS NULL)) OR ((item_kind = 'lesson'::learning.playlist_item_kind) AND (lesson_id IS NOT NULL) AND (album_recording_id IS NULL))));
--;;
alter table learning.lyric_edit_drafts add constraint lyric_edit_drafts_check1 CHECK (((item_kind <> 'lesson'::learning.playlist_item_kind) OR (sync_precision = 'unsynced'::music.lyric_sync_precision)));
--;;
alter table learning.lyric_edit_drafts add constraint lyric_edit_drafts_lines_check CHECK ((jsonb_typeof(lines) = 'array'::text));
--;;
alter table learning.lyric_edit_drafts add constraint lyric_edit_drafts_pkey PRIMARY KEY (id);
--;;
alter table learning.lyric_lines add constraint lyric_lines_check CHECK (((end_ms IS NULL) OR (end_ms >= start_ms)));
--;;
alter table learning.lyric_lines add constraint lyric_lines_lyric_set_id_sequence_key UNIQUE (lyric_set_id, sequence);
--;;
alter table learning.lyric_lines add constraint lyric_lines_pkey PRIMARY KEY (id);
--;;
alter table learning.lyric_lines add constraint lyric_lines_sequence_check CHECK ((sequence > 0));
--;;
alter table learning.lyric_lines add constraint lyric_lines_start_ms_check CHECK (((start_ms IS NULL) OR (start_ms >= 0)));
--;;
alter table learning.lyric_sets add constraint lyric_sets_check CHECK ((((item_kind = 'album_recording'::learning.playlist_item_kind) AND (album_recording_id IS NOT NULL) AND (lesson_id IS NULL)) OR ((item_kind = 'lesson'::learning.playlist_item_kind) AND (lesson_id IS NOT NULL) AND (album_recording_id IS NULL))));
--;;
alter table learning.lyric_sets add constraint lyric_sets_check1 CHECK (((item_kind <> 'lesson'::learning.playlist_item_kind) OR (sync_precision = 'unsynced'::music.lyric_sync_precision)));
--;;
alter table learning.lyric_sets add constraint lyric_sets_pkey PRIMARY KEY (id);
--;;
alter table learning.playlist_items add constraint playlist_items_check CHECK ((((item_kind = 'album_recording'::learning.playlist_item_kind) AND (album_recording_id IS NOT NULL) AND (lesson_id IS NULL)) OR ((item_kind = 'lesson'::learning.playlist_item_kind) AND (lesson_id IS NOT NULL) AND (album_recording_id IS NULL))));
--;;
alter table learning.playlist_items add constraint playlist_items_pkey PRIMARY KEY (id);
--;;
alter table learning.playlist_items add constraint playlist_items_playlist_id_sort_order_key UNIQUE (playlist_id, sort_order);
--;;
alter table learning.playlists add constraint playlists_name_check CHECK ((length(TRIM(BOTH FROM name)) > 0));
--;;
alter table learning.playlists add constraint playlists_pkey PRIMARY KEY (id);
--;;
alter table learning.recording_localizations add constraint recording_localizations_pkey PRIMARY KEY (recording_id, locale);
--;;
alter table learning.recording_localizations add constraint recording_localizations_title_check CHECK ((length(TRIM(BOTH FROM title)) > 0));
--;;
alter table learning.season_localizations add constraint season_localizations_pkey PRIMARY KEY (season_id, locale);
--;;
alter table learning.season_localizations add constraint season_localizations_title_check CHECK ((length(TRIM(BOTH FROM title)) > 0));
--;;
alter table learning.seasons add constraint seasons_pkey PRIMARY KEY (id);
--;;
alter table learning.seasons add constraint seasons_slug_check CHECK ((slug ~ '^[a-z0-9][a-z0-9_-]*$'::text));
--;;
alter table learning.seasons add constraint seasons_slug_key UNIQUE (slug);
--;;
alter table learning.seasons add constraint seasons_title_check CHECK ((length(TRIM(BOTH FROM title)) > 0));
--;;
alter table media.locales add constraint locales_code_not_blank CHECK ((length(TRIM(BOTH FROM code)) > 0));
--;;
alter table media.locales add constraint locales_pkey PRIMARY KEY (code);
--;;
alter table media.locales add constraint locales_text_direction_valid CHECK ((text_direction = ANY (ARRAY['ltr'::text, 'rtl'::text])));
--;;
alter table media.localized_texts add constraint localized_texts_entity_type_entity_id_field_name_locale_key UNIQUE (entity_type, entity_id, field_name, locale);
--;;
alter table media.localized_texts add constraint localized_texts_entity_type_not_blank CHECK ((length(TRIM(BOTH FROM entity_type)) > 0));
--;;
alter table media.localized_texts add constraint localized_texts_field_name_not_blank CHECK ((length(TRIM(BOTH FROM field_name)) > 0));
--;;
alter table media.localized_texts add constraint localized_texts_pkey PRIMARY KEY (id);
--;;
alter table media.media_asset_versions add constraint media_asset_versions_bucket_not_blank CHECK ((length(TRIM(BOTH FROM bucket)) > 0));
--;;
alter table media.media_asset_versions add constraint media_asset_versions_media_asset_id_version_key UNIQUE (media_asset_id, version);
--;;
alter table media.media_asset_versions add constraint media_asset_versions_path_not_blank CHECK ((length(TRIM(BOTH FROM path)) > 0));
--;;
alter table media.media_asset_versions add constraint media_asset_versions_pkey PRIMARY KEY (id);
--;;
alter table media.media_asset_versions add constraint media_asset_versions_provider_bucket_path_key UNIQUE (provider, bucket, path);
--;;
alter table media.media_asset_versions add constraint media_asset_versions_version_positive CHECK ((version > 0));
--;;
alter table media.media_assets add constraint media_assets_bitrate_nonnegative CHECK (((bitrate IS NULL) OR (bitrate >= 0)));
--;;
alter table media.media_assets add constraint media_assets_bucket_not_blank CHECK ((length(TRIM(BOTH FROM bucket)) > 0));
--;;
alter table media.media_assets add constraint media_assets_duration_nonnegative CHECK (((duration_ms IS NULL) OR (duration_ms >= 0)));
--;;
alter table media.media_assets add constraint media_assets_file_size_nonnegative CHECK (((file_size_bytes IS NULL) OR (file_size_bytes >= 0)));
--;;
alter table media.media_assets add constraint media_assets_height_nonnegative CHECK (((height IS NULL) OR (height >= 0)));
--;;
alter table media.media_assets add constraint media_assets_path_not_blank CHECK ((length(TRIM(BOTH FROM path)) > 0));
--;;
alter table media.media_assets add constraint media_assets_pkey PRIMARY KEY (id);
--;;
alter table media.media_assets add constraint media_assets_provider_bucket_path_key UNIQUE (provider, bucket, path);
--;;
alter table media.media_assets add constraint media_assets_sample_rate_nonnegative CHECK (((sample_rate IS NULL) OR (sample_rate >= 0)));
--;;
alter table media.media_assets add constraint media_assets_version_positive CHECK ((version > 0));
--;;
alter table media.media_assets add constraint media_assets_width_nonnegative CHECK (((width IS NULL) OR (width >= 0)));
--;;
alter table media.media_processing_jobs add constraint media_processing_jobs_attempt_count_nonnegative CHECK ((attempt_count >= 0));
--;;
alter table media.media_processing_jobs add constraint media_processing_jobs_input_bucket_valid CHECK ((input_bucket = ANY (ARRAY['chc-submissions'::text, 'chc-masters'::text])));
--;;
alter table media.media_processing_jobs add constraint media_processing_jobs_input_path_not_blank CHECK ((length(TRIM(BOTH FROM input_path)) > 0));
--;;
alter table media.media_processing_jobs add constraint media_processing_jobs_max_attempts_positive CHECK ((max_attempts > 0));
--;;
alter table media.media_processing_jobs add constraint media_processing_jobs_output_bucket_valid CHECK ((output_bucket = ANY (ARRAY['chc-masters'::text, 'chc-music'::text, 'chc-learning'::text, 'chc-images'::text])));
--;;
alter table media.media_processing_jobs add constraint media_processing_jobs_output_checksum_sha256_format CHECK (((output_checksum_sha256 IS NULL) OR (output_checksum_sha256 ~ '^[a-f0-9]{64}$'::text)));
--;;
alter table media.media_processing_jobs add constraint media_processing_jobs_output_path_not_blank CHECK (((output_path IS NULL) OR (length(TRIM(BOTH FROM output_path)) > 0)));
--;;
alter table media.media_processing_jobs add constraint media_processing_jobs_output_size_nonnegative CHECK (((output_size_bytes IS NULL) OR (output_size_bytes >= 0)));
--;;
alter table media.media_processing_jobs add constraint media_processing_jobs_pkey PRIMARY KEY (id);
--;;
alter table media.media_processing_jobs add constraint media_processing_jobs_upload_intent_id_job_type_key UNIQUE (upload_intent_id, job_type);
--;;
alter table media.search_aliases add constraint search_aliases_alias_not_blank CHECK ((length(TRIM(BOTH FROM alias)) > 0));
--;;
alter table media.search_aliases add constraint search_aliases_entity_type_entity_id_locale_alias_key UNIQUE (entity_type, entity_id, locale, alias);
--;;
alter table media.search_aliases add constraint search_aliases_entity_type_not_blank CHECK ((length(TRIM(BOTH FROM entity_type)) > 0));
--;;
alter table media.search_aliases add constraint search_aliases_pkey PRIMARY KEY (id);
--;;
alter table media.search_documents add constraint search_documents_entity_type_entity_id_locale_kind_key UNIQUE (entity_type, entity_id, locale, kind);
--;;
alter table media.search_documents add constraint search_documents_entity_type_not_blank CHECK ((length(TRIM(BOTH FROM entity_type)) > 0));
--;;
alter table media.search_documents add constraint search_documents_kind_not_blank CHECK ((length(TRIM(BOTH FROM kind)) > 0));
--;;
alter table media.search_documents add constraint search_documents_pkey PRIMARY KEY (id);
--;;
alter table media.storage_gc_candidates add constraint storage_gc_candidate_bucket_not_blank CHECK ((length(TRIM(BOTH FROM bucket)) > 0));
--;;
alter table media.storage_gc_candidates add constraint storage_gc_candidate_path_not_blank CHECK ((length(TRIM(BOTH FROM path)) > 0));
--;;
alter table media.storage_gc_candidates add constraint storage_gc_candidate_size_nonnegative CHECK (((file_size_bytes IS NULL) OR (file_size_bytes >= 0)));
--;;
alter table media.storage_gc_candidates add constraint storage_gc_candidates_pkey PRIMARY KEY (bucket, path);
--;;
alter table media.submission_events add constraint submission_events_action_not_blank CHECK ((length(TRIM(BOTH FROM action)) > 0));
--;;
alter table media.submission_events add constraint submission_events_pkey PRIMARY KEY (id);
--;;
alter table media.submission_items add constraint submission_item_localized_titles_object CHECK ((jsonb_typeof(localized_titles) = 'object'::text));
--;;
alter table media.submission_items add constraint submission_items_has_source CHECK (((upload_intent_id IS NOT NULL) OR (media_asset_id IS NOT NULL)));
--;;
alter table media.submission_items add constraint submission_items_pkey PRIMARY KEY (id);
--;;
alter table media.submission_items add constraint submission_items_title_not_blank CHECK (((title IS NULL) OR (length(TRIM(BOTH FROM title)) > 0)));
--;;
alter table media.submissions add constraint submissions_pkey PRIMARY KEY (id);
--;;
alter table media.submissions add constraint submissions_review_due_requires_submit CHECK (((review_due_at IS NULL) OR (submitted_at IS NOT NULL)));
--;;
alter table media.submissions add constraint submissions_reviewed_requires_reviewer CHECK (((reviewed_at IS NULL) OR (reviewer_id IS NOT NULL)));
--;;
alter table media.submissions add constraint submissions_status_valid CHECK ((status = ANY (ARRAY['draft'::media.publication_status, 'uploading'::media.publication_status, 'ready_to_submit'::media.publication_status, 'pending_review'::media.publication_status, 'changes_requested'::media.publication_status, 'approved'::media.publication_status, 'processing'::media.publication_status, 'published'::media.publication_status, 'rejected'::media.publication_status])));
--;;
alter table media.submissions add constraint submissions_title_not_blank CHECK ((length(TRIM(BOTH FROM title)) > 0));
--;;
alter table media.upload_intents add constraint upload_intents_bucket_path_key UNIQUE (bucket, path);
--;;
alter table media.upload_intents add constraint upload_intents_bucket_private_submission CHECK ((bucket = 'chc-submissions'::text));
--;;
alter table media.upload_intents add constraint upload_intents_checksum_sha256_format CHECK (((checksum_sha256 IS NULL) OR (checksum_sha256 ~ '^[a-f0-9]{64}$'::text)));
--;;
alter table media.upload_intents add constraint upload_intents_content_length_max CHECK ((content_length <= '21474836480'::bigint));
--;;
alter table media.upload_intents add constraint upload_intents_content_length_positive CHECK ((content_length > 0));
--;;
alter table media.upload_intents add constraint upload_intents_content_type_not_blank CHECK ((length(TRIM(BOTH FROM content_type)) > 0));
--;;
alter table media.upload_intents add constraint upload_intents_original_filename_not_blank CHECK ((length(TRIM(BOTH FROM original_filename)) > 0));
--;;
alter table media.upload_intents add constraint upload_intents_path_private_submission CHECK ((path ~ '^submissions/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/original(\.[a-z0-9]{1,12})?$'::text));
--;;
alter table media.upload_intents add constraint upload_intents_pkey PRIMARY KEY (id);
--;;
alter table media.upload_intents add constraint upload_intents_uploaded_size_nonnegative CHECK (((uploaded_size IS NULL) OR (uploaded_size >= 0)));
--;;
alter table music.artist_follows add constraint artist_follows_pkey PRIMARY KEY (user_id, artist_id);
--;;
alter table music.artist_localizations add constraint artist_localizations_artist_id_locale_key UNIQUE (artist_id, locale);
--;;
alter table music.artist_localizations add constraint artist_localizations_display_name_not_blank CHECK ((length(TRIM(BOTH FROM display_name)) > 0));
--;;
alter table music.artist_localizations add constraint artist_localizations_pkey PRIMARY KEY (id);
--;;
alter table music.artist_memberships add constraint artist_memberships_artist_id_creator_account_id_key UNIQUE (artist_id, creator_account_id);
--;;
alter table music.artist_memberships add constraint artist_memberships_pkey PRIMARY KEY (id);
--;;
alter table music.artist_memberships add constraint artist_memberships_role_not_blank CHECK ((length(TRIM(BOTH FROM role)) > 0));
--;;
alter table music.artist_pinned_releases add constraint artist_pinned_releases_pkey PRIMARY KEY (artist_id, release_id);
--;;
alter table music.artist_social_links add constraint artist_social_links_custom_label_required CHECK (((platform !~~ 'custom:%'::text) OR (NULLIF(TRIM(BOTH FROM label), ''::text) IS NOT NULL)));
--;;
alter table music.artist_social_links add constraint artist_social_links_one_per_platform UNIQUE (artist_id, platform);
--;;
alter table music.artist_social_links add constraint artist_social_links_pkey PRIMARY KEY (id);
--;;
alter table music.artist_social_links add constraint artist_social_links_platform_known CHECK (((platform = ANY (ARRAY['website'::text, 'linktree'::text, 'youtube'::text, 'soundcloud'::text, 'spotify'::text, 'apple_music'::text, 'facebook'::text, 'instagram'::text, 'tiktok'::text, 'x'::text, 'bandcamp'::text])) OR (platform ~~ 'custom:%'::text)));
--;;
alter table music.artist_social_links add constraint artist_social_links_url_is_http CHECK ((url ~* '^https?://[^\s]+$'::text));
--;;
alter table music.artists add constraint artists_display_name_not_blank CHECK ((length(TRIM(BOTH FROM display_name)) > 0));
--;;
alter table music.artists add constraint artists_pkey PRIMARY KEY (id);
--;;
alter table music.lyric_edit_drafts add constraint lyric_edit_drafts_description_not_blank CHECK (((description IS NULL) OR (length(TRIM(BOTH FROM description)) > 0)));
--;;
alter table music.lyric_edit_drafts add constraint lyric_edit_drafts_lines_array CHECK ((jsonb_typeof(lines) = 'array'::text));
--;;
alter table music.lyric_edit_drafts add constraint lyric_edit_drafts_pkey PRIMARY KEY (track_id, locale);
--;;
alter table music.lyric_lines add constraint lyric_lines_end_after_start CHECK (((end_ms IS NULL) OR (end_ms >= start_ms)));
--;;
alter table music.lyric_lines add constraint lyric_lines_end_nonnegative CHECK (((end_ms IS NULL) OR (end_ms >= 0)));
--;;
alter table music.lyric_lines add constraint lyric_lines_end_requires_start CHECK (((end_ms IS NULL) OR (start_ms IS NOT NULL)));
--;;
alter table music.lyric_lines add constraint lyric_lines_lyric_set_id_sequence_key UNIQUE (lyric_set_id, sequence);
--;;
alter table music.lyric_lines add constraint lyric_lines_pkey PRIMARY KEY (id);
--;;
alter table music.lyric_lines add constraint lyric_lines_sequence_positive CHECK ((sequence > 0));
--;;
alter table music.lyric_lines add constraint lyric_lines_start_nonnegative CHECK (((start_ms IS NULL) OR (start_ms >= 0)));
--;;
alter table music.lyric_sets add constraint lyric_sets_description_not_blank CHECK (((description IS NULL) OR (length(TRIM(BOTH FROM description)) > 0)));
--;;
alter table music.lyric_sets add constraint lyric_sets_pkey PRIMARY KEY (id);
--;;
alter table music.lyric_sets add constraint lyric_sets_source_not_blank CHECK (((source IS NULL) OR (length(TRIM(BOTH FROM source)) > 0)));
--;;
alter table music.lyric_sets add constraint lyric_sets_title_not_blank CHECK (((title IS NULL) OR (length(TRIM(BOTH FROM title)) > 0)));
--;;
alter table music.lyric_sets add constraint lyric_sets_track_id_locale_kind_key UNIQUE (track_id, locale, kind);
--;;
alter table music.lyric_words add constraint lyric_words_end_after_start CHECK (((end_ms IS NULL) OR (end_ms >= start_ms)));
--;;
alter table music.lyric_words add constraint lyric_words_end_nonnegative CHECK (((end_ms IS NULL) OR (end_ms >= 0)));
--;;
alter table music.lyric_words add constraint lyric_words_end_requires_start CHECK (((end_ms IS NULL) OR (start_ms IS NOT NULL)));
--;;
alter table music.lyric_words add constraint lyric_words_lyric_line_id_sequence_key UNIQUE (lyric_line_id, sequence);
--;;
alter table music.lyric_words add constraint lyric_words_pkey PRIMARY KEY (id);
--;;
alter table music.lyric_words add constraint lyric_words_sequence_positive CHECK ((sequence > 0));
--;;
alter table music.lyric_words add constraint lyric_words_start_nonnegative CHECK (((start_ms IS NULL) OR (start_ms >= 0)));
--;;
alter table music.lyric_words add constraint lyric_words_text_not_blank CHECK ((length(TRIM(BOTH FROM text)) > 0));
--;;
alter table music.play_history add constraint play_history_pkey PRIMARY KEY (id);
--;;
alter table music.play_history add constraint play_history_progress_nonnegative CHECK (((progress_ms IS NULL) OR (progress_ms >= 0)));
--;;
alter table music.playlist_tracks add constraint playlist_tracks_pkey PRIMARY KEY (playlist_id, track_id);
--;;
alter table music.playlists add constraint playlists_name_not_blank CHECK ((length(TRIM(BOTH FROM name)) > 0));
--;;
alter table music.playlists add constraint playlists_pkey PRIMARY KEY (id);
--;;
alter table music.release_likes add constraint release_likes_pkey PRIMARY KEY (user_id, release_id);
--;;
alter table music.release_localizations add constraint release_localizations_pkey PRIMARY KEY (id);
--;;
alter table music.release_localizations add constraint release_localizations_release_id_locale_key UNIQUE (release_id, locale);
--;;
alter table music.release_localizations add constraint release_localizations_title_not_blank CHECK ((length(TRIM(BOTH FROM title)) > 0));
--;;
alter table music.release_tracks add constraint release_tracks_disc_positive CHECK ((disc_number > 0));
--;;
alter table music.release_tracks add constraint release_tracks_pkey PRIMARY KEY (id);
--;;
alter table music.release_tracks add constraint release_tracks_release_id_disc_number_track_number_key UNIQUE (release_id, disc_number, track_number);
--;;
alter table music.release_tracks add constraint release_tracks_release_id_track_id_key UNIQUE (release_id, track_id);
--;;
alter table music.release_tracks add constraint release_tracks_track_number_positive CHECK ((track_number > 0));
--;;
alter table music.releases add constraint releases_original_release_date_sane CHECK (((original_release_date IS NULL) OR ((original_release_date >= '1900-01-01'::date) AND (original_release_date <= (CURRENT_DATE + 365)))));
--;;
alter table music.releases add constraint releases_pkey PRIMARY KEY (id);
--;;
alter table music.releases add constraint releases_release_timing_mode_known CHECK ((release_timing_mode = ANY (ARRAY['asap'::text, 'scheduled'::text])));
--;;
alter table music.releases add constraint releases_title_not_blank CHECK ((length(TRIM(BOTH FROM title)) > 0));
--;;
alter table music.track_artists add constraint track_artists_pkey PRIMARY KEY (track_id, artist_id, role);
--;;
alter table music.track_likes add constraint track_likes_pkey PRIMARY KEY (user_id, track_id);
--;;
alter table music.track_localizations add constraint track_localizations_pkey PRIMARY KEY (id);
--;;
alter table music.track_localizations add constraint track_localizations_title_not_blank CHECK ((length(TRIM(BOTH FROM title)) > 0));
--;;
alter table music.track_localizations add constraint track_localizations_track_id_locale_key UNIQUE (track_id, locale);
--;;
alter table music.tracks add constraint tracks_duration_nonnegative CHECK (((duration_ms IS NULL) OR (duration_ms >= 0)));
--;;
alter table music.tracks add constraint tracks_pkey PRIMARY KEY (id);
--;;
alter table music.tracks add constraint tracks_published_requires_media CHECK (((publication_status <> 'published'::media.publication_status) OR (media_asset_id IS NOT NULL)));
--;;
alter table music.tracks add constraint tracks_title_not_blank CHECK ((length(TRIM(BOTH FROM title)) > 0));
--;;
alter table private.media_worker_tokens add constraint media_worker_tokens_hash_format CHECK ((token_hash ~ '^[a-f0-9]{64}$'::text));
--;;
alter table private.media_worker_tokens add constraint media_worker_tokens_name_key UNIQUE (name);
--;;
alter table private.media_worker_tokens add constraint media_worker_tokens_name_not_blank CHECK ((length(TRIM(BOTH FROM name)) > 0));
--;;
alter table private.media_worker_tokens add constraint media_worker_tokens_pkey PRIMARY KEY (id);
--;;
alter table private.media_worker_tokens add constraint media_worker_tokens_token_hash_key UNIQUE (token_hash);
--;;
alter table private.notification_deliveries add constraint notification_deliveries_attempt_count_check CHECK ((attempt_count >= 0));
--;;
alter table private.notification_deliveries add constraint notification_deliveries_has_message CHECK (((notification_id IS NOT NULL) OR (broadcast_id IS NOT NULL)));
--;;
alter table private.notification_deliveries add constraint notification_deliveries_max_attempts_check CHECK ((max_attempts > 0));
--;;
alter table private.notification_deliveries add constraint notification_deliveries_notification_id_device_id_key UNIQUE (notification_id, device_id);
--;;
alter table private.notification_deliveries add constraint notification_deliveries_pkey PRIMARY KEY (id);
--;;
alter table private.notification_deliveries add constraint notification_deliveries_provider_check CHECK ((provider = ANY (ARRAY['expo'::text, 'web_push'::text, 'wns'::text])));
--;;
alter table private.notification_deliveries add constraint notification_deliveries_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'processing'::text, 'accepted'::text, 'delivered'::text, 'failed'::text, 'disabled'::text])));
--;;
alter table public.bible_highlights add constraint bible_highlights_book_key_check CHECK (((char_length(book_key) >= 1) AND (char_length(book_key) <= 64)));
--;;
alter table public.bible_highlights add constraint bible_highlights_highlight_deletions_check CHECK (((jsonb_typeof(highlight_deletions) = 'object'::text) AND (octet_length((highlight_deletions)::text) <= 500000)));
--;;
alter table public.bible_highlights add constraint bible_highlights_highlights_check CHECK (((jsonb_typeof(highlights) = 'array'::text) AND (jsonb_array_length(highlights) <= 2000)));
--;;
alter table public.bible_highlights add constraint bible_highlights_pkey PRIMARY KEY (id);
--;;
alter table public.bible_highlights add constraint bible_highlights_user_id_book_key_key UNIQUE (user_id, book_key);
--;;
alter table public.hymn_texts add constraint hymn_texts_pkey PRIMARY KEY (line_id);
--;;
alter table public.hymn_titles add constraint hymn_titles_pkey PRIMARY KEY (hymn_key);
--;;
alter table public.notification_broadcasts add constraint notification_broadcasts_app_key_check CHECK ((app_key = ANY (ARRAY['chc'::text, 'chc_artists'::text, 'chc_admin'::text])));
--;;
alter table public.notification_broadcasts add constraint notification_broadcasts_body_check CHECK (((length(btrim(body)) >= 1) AND (length(btrim(body)) <= 600)));
--;;
alter table public.notification_broadcasts add constraint notification_broadcasts_category_check CHECK ((category = ANY (ARRAY['feast_celebrations'::text, 'announcements'::text])));
--;;
alter table public.notification_broadcasts add constraint notification_broadcasts_delivery_count_check CHECK ((delivery_count >= 0));
--;;
alter table public.notification_broadcasts add constraint notification_broadcasts_payload_check CHECK ((jsonb_typeof(payload) = 'object'::text));
--;;
alter table public.notification_broadcasts add constraint notification_broadcasts_pkey PRIMARY KEY (id);
--;;
alter table public.notification_broadcasts add constraint notification_broadcasts_recipient_count_check CHECK ((recipient_count >= 0));
--;;
alter table public.notification_broadcasts add constraint notification_broadcasts_title_check CHECK (((length(btrim(title)) >= 1) AND (length(btrim(title)) <= 120)));
--;;
alter table public.notification_devices add constraint notification_devices_app_key_check CHECK ((app_key = ANY (ARRAY['chc'::text, 'chc_artists'::text, 'chc_admin'::text])));
--;;
alter table public.notification_devices add constraint notification_devices_pkey PRIMARY KEY (id);
--;;
alter table public.notification_devices add constraint notification_devices_platform_check CHECK ((platform = ANY (ARRAY['ios'::text, 'android'::text, 'web'::text, 'windows'::text])));
--;;
alter table public.notification_devices add constraint notification_devices_provider_check CHECK ((provider = ANY (ARRAY['expo'::text, 'web_push'::text, 'wns'::text])));
--;;
alter table public.notification_devices add constraint notification_devices_provider_data_check CHECK ((jsonb_typeof(provider_data) = 'object'::text));
--;;
alter table public.notification_devices add constraint notification_devices_push_token_check CHECK ((length(btrim(push_token)) > 0));
--;;
alter table public.notification_preferences add constraint notification_preferences_app_key_check CHECK ((app_key = ANY (ARRAY['chc'::text, 'chc_artists'::text, 'chc_admin'::text])));
--;;
alter table public.notification_preferences add constraint notification_preferences_category_check CHECK ((length(btrim(category)) > 0));
--;;
alter table public.notification_preferences add constraint notification_preferences_pkey PRIMARY KEY (user_id, app_key, category);
--;;
alter table public.notifications add constraint notifications_app_key_check CHECK ((app_key = ANY (ARRAY['chc'::text, 'chc_artists'::text, 'chc_admin'::text])));
--;;
alter table public.notifications add constraint notifications_body_check CHECK ((length(btrim(body)) > 0));
--;;
alter table public.notifications add constraint notifications_category_check CHECK ((length(btrim(category)) > 0));
--;;
alter table public.notifications add constraint notifications_event_type_check CHECK ((length(btrim(event_type)) > 0));
--;;
alter table public.notifications add constraint notifications_payload_check CHECK ((jsonb_typeof(payload) = 'object'::text));
--;;
alter table public.notifications add constraint notifications_pkey PRIMARY KEY (id);
--;;
alter table public.notifications add constraint notifications_title_check CHECK ((length(btrim(title)) > 0));
--;;
alter table public.saint_order add constraint saint_order_pkey PRIMARY KEY (flag_key);
--;;
alter table public.sermon_plans add constraint sermon_plans_document_key_check CHECK (((char_length(document_key) >= 1) AND (char_length(document_key) <= 160)));
--;;
alter table public.sermon_plans add constraint sermon_plans_general_notes_check CHECK ((char_length(general_notes) <= 100000));
--;;
alter table public.sermon_plans add constraint sermon_plans_highlight_deletions_check CHECK (((jsonb_typeof(highlight_deletions) = 'object'::text) AND (octet_length((highlight_deletions)::text) <= 500000)));
--;;
alter table public.sermon_plans add constraint sermon_plans_highlights_check CHECK (((jsonb_typeof(highlights) = 'array'::text) AND (jsonb_array_length(highlights) <= 1000)));
--;;
alter table public.sermon_plans add constraint sermon_plans_pkey PRIMARY KEY (id);
--;;
alter table public.sermon_plans add constraint sermon_plans_user_id_document_key_service_date_key UNIQUE (user_id, document_key, service_date);
--;;
alter table public.spiritual_canon_days add constraint spiritual_canon_days_marks_check CHECK (((jsonb_typeof(marks) = 'object'::text) AND (octet_length((marks)::text) <= 50000)));
--;;
alter table public.spiritual_canon_days add constraint spiritual_canon_days_pkey PRIMARY KEY (user_id, day);
--;;
alter table public.spiritual_canons add constraint spiritual_canons_item_deletions_check CHECK (((jsonb_typeof(item_deletions) = 'object'::text) AND (octet_length((item_deletions)::text) <= 100000)));
--;;
alter table public.spiritual_canons add constraint spiritual_canons_items_check CHECK (((jsonb_typeof(items) = 'array'::text) AND (jsonb_array_length(items) <= 40) AND (octet_length((items)::text) <= 200000)));
--;;
alter table public.spiritual_canons add constraint spiritual_canons_pkey PRIMARY KEY (user_id);
--;;
alter table public.user_content_preferences add constraint user_content_preferences_bookmark_count_check CHECK ((cardinality(bookmarks) <= 500));
--;;
alter table public.user_content_preferences add constraint user_content_preferences_object_check CHECK ((jsonb_typeof(preferences) = 'object'::text));
--;;
alter table public.user_content_preferences add constraint user_content_preferences_pkey PRIMARY KEY (user_id);
--;;
alter table public.user_content_preferences add constraint user_content_preferences_size_check CHECK ((octet_length((preferences)::text) <= 131072));
--;;
alter table creator.creator_account_members add constraint creator_account_members_creator_account_id_fkey FOREIGN KEY (creator_account_id) REFERENCES creator.creator_accounts(id) ON DELETE CASCADE;
--;;
alter table creator.creator_account_members add constraint creator_account_members_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE SET NULL;
--;;
alter table creator.creator_account_members add constraint creator_account_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
--;;
alter table creator.creator_accounts add constraint creator_accounts_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
--;;
alter table creator.creator_accounts add constraint creator_accounts_identity_artist_id_fkey FOREIGN KEY (identity_artist_id) REFERENCES music.artists(id) ON DELETE SET NULL;
--;;
alter table creator.creator_accounts add constraint creator_accounts_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
--;;
alter table creator.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
--;;
alter table creator.user_roles add constraint user_roles_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES auth.users(id) ON DELETE SET NULL;
--;;
alter table creator.user_roles add constraint user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
--;;
alter table learning.album_localizations add constraint album_localizations_album_id_fkey FOREIGN KEY (album_id) REFERENCES learning.albums(id) ON DELETE CASCADE;
--;;
alter table learning.album_localizations add constraint album_localizations_locale_fkey FOREIGN KEY (locale) REFERENCES media.locales(code) ON UPDATE CASCADE;
--;;
alter table learning.album_recordings add constraint album_recordings_album_id_fkey FOREIGN KEY (album_id) REFERENCES learning.albums(id) ON DELETE CASCADE;
--;;
alter table learning.album_recordings add constraint album_recordings_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
--;;
alter table learning.album_recordings add constraint album_recordings_hymn_id_fkey FOREIGN KEY (hymn_id) REFERENCES learning.hymns(id) ON DELETE SET NULL;
--;;
alter table learning.album_recordings add constraint album_recordings_media_asset_id_fkey FOREIGN KEY (media_asset_id) REFERENCES media.media_assets(id) ON DELETE RESTRICT;
--;;
alter table learning.album_recordings add constraint album_recordings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
--;;
alter table learning.albums add constraint albums_cantor_id_fkey FOREIGN KEY (cantor_id) REFERENCES learning.cantors(id) ON DELETE RESTRICT;
--;;
alter table learning.albums add constraint albums_cover_asset_id_fkey FOREIGN KEY (cover_asset_id) REFERENCES media.media_assets(id) ON DELETE SET NULL;
--;;
alter table learning.albums add constraint albums_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
--;;
alter table learning.albums add constraint albums_owner_creator_account_id_fkey FOREIGN KEY (owner_creator_account_id) REFERENCES creator.creator_accounts(id) ON DELETE SET NULL;
--;;
alter table learning.albums add constraint albums_season_id_fkey FOREIGN KEY (season_id) REFERENCES learning.seasons(id) ON DELETE SET NULL;
--;;
alter table learning.albums add constraint albums_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES media.submissions(id) ON DELETE SET NULL;
--;;
alter table learning.albums add constraint albums_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
--;;
alter table learning.cantor_localizations add constraint cantor_localizations_cantor_id_fkey FOREIGN KEY (cantor_id) REFERENCES learning.cantors(id) ON DELETE CASCADE;
--;;
alter table learning.cantor_localizations add constraint cantor_localizations_locale_fkey FOREIGN KEY (locale) REFERENCES media.locales(code) ON UPDATE CASCADE;
--;;
alter table learning.cantor_permissions add constraint cantor_permissions_cantor_id_fkey FOREIGN KEY (cantor_id) REFERENCES learning.cantors(id) ON DELETE CASCADE;
--;;
alter table learning.cantor_permissions add constraint cantor_permissions_creator_account_id_fkey FOREIGN KEY (creator_account_id) REFERENCES creator.creator_accounts(id) ON DELETE CASCADE;
--;;
alter table learning.cantors add constraint cantors_artist_id_fkey FOREIGN KEY (artist_id) REFERENCES music.artists(id) ON DELETE SET NULL;
--;;
alter table learning.cantors add constraint cantors_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
--;;
alter table learning.cantors add constraint cantors_owner_creator_account_id_fkey FOREIGN KEY (owner_creator_account_id) REFERENCES creator.creator_accounts(id) ON DELETE SET NULL;
--;;
alter table learning.cantors add constraint cantors_profile_image_asset_id_fkey FOREIGN KEY (profile_image_asset_id) REFERENCES media.media_assets(id) ON DELETE SET NULL;
--;;
alter table learning.cantors add constraint cantors_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
--;;
alter table learning.hymn_localizations add constraint hymn_localizations_hymn_id_fkey FOREIGN KEY (hymn_id) REFERENCES learning.hymns(id) ON DELETE CASCADE;
--;;
alter table learning.hymn_localizations add constraint hymn_localizations_locale_fkey FOREIGN KEY (locale) REFERENCES media.locales(code) ON UPDATE CASCADE;
--;;
alter table learning.hymn_progress add constraint hymn_progress_hymn_id_fkey FOREIGN KEY (hymn_id) REFERENCES learning.hymns(id) ON DELETE CASCADE;
--;;
alter table learning.hymn_progress add constraint hymn_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
--;;
alter table learning.hymn_relationships add constraint hymn_relationships_hymn_id_fkey FOREIGN KEY (hymn_id) REFERENCES learning.hymns(id) ON DELETE CASCADE;
--;;
alter table learning.hymn_relationships add constraint hymn_relationships_related_hymn_id_fkey FOREIGN KEY (related_hymn_id) REFERENCES learning.hymns(id) ON DELETE CASCADE;
--;;
alter table learning.hymn_seasons add constraint hymn_seasons_hymn_id_fkey FOREIGN KEY (hymn_id) REFERENCES learning.hymns(id) ON DELETE CASCADE;
--;;
alter table learning.hymn_seasons add constraint hymn_seasons_season_id_fkey FOREIGN KEY (season_id) REFERENCES learning.seasons(id) ON DELETE CASCADE;
--;;
alter table learning.hymns add constraint hymns_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
--;;
alter table learning.hymns add constraint hymns_source_hymn_key_fkey FOREIGN KEY (source_hymn_key) REFERENCES hymn_titles(hymn_key) ON UPDATE CASCADE ON DELETE SET NULL;
--;;
alter table learning.hymns add constraint hymns_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
--;;
alter table learning.item_likes add constraint item_likes_album_recording_id_fkey FOREIGN KEY (album_recording_id) REFERENCES learning.album_recordings(id) ON DELETE CASCADE;
--;;
alter table learning.item_likes add constraint item_likes_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES learning.lessons(id) ON DELETE CASCADE;
--;;
alter table learning.item_likes add constraint item_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
--;;
alter table learning.item_progress add constraint item_progress_album_recording_id_fkey FOREIGN KEY (album_recording_id) REFERENCES learning.album_recordings(id) ON DELETE CASCADE;
--;;
alter table learning.item_progress add constraint item_progress_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES learning.lessons(id) ON DELETE CASCADE;
--;;
alter table learning.item_progress add constraint item_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
--;;
alter table learning.lesson_localizations add constraint lesson_localizations_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES learning.lessons(id) ON DELETE CASCADE;
--;;
alter table learning.lesson_localizations add constraint lesson_localizations_locale_fkey FOREIGN KEY (locale) REFERENCES media.locales(code) ON UPDATE CASCADE;
--;;
alter table learning.lesson_set_localizations add constraint lesson_set_localizations_lesson_set_id_fkey FOREIGN KEY (lesson_set_id) REFERENCES learning.lesson_sets(id) ON DELETE CASCADE;
--;;
alter table learning.lesson_set_localizations add constraint lesson_set_localizations_locale_fkey FOREIGN KEY (locale) REFERENCES media.locales(code) ON UPDATE CASCADE;
--;;
alter table learning.lesson_sets add constraint lesson_sets_cantor_id_fkey FOREIGN KEY (cantor_id) REFERENCES learning.cantors(id) ON DELETE RESTRICT;
--;;
alter table learning.lesson_sets add constraint lesson_sets_cover_asset_id_fkey FOREIGN KEY (cover_asset_id) REFERENCES media.media_assets(id) ON DELETE SET NULL;
--;;
alter table learning.lesson_sets add constraint lesson_sets_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
--;;
alter table learning.lesson_sets add constraint lesson_sets_hymn_id_fkey FOREIGN KEY (hymn_id) REFERENCES learning.hymns(id) ON DELETE RESTRICT;
--;;
alter table learning.lesson_sets add constraint lesson_sets_owner_creator_account_id_fkey FOREIGN KEY (owner_creator_account_id) REFERENCES creator.creator_accounts(id) ON DELETE SET NULL;
--;;
alter table learning.lesson_sets add constraint lesson_sets_season_id_fkey FOREIGN KEY (season_id) REFERENCES learning.seasons(id) ON DELETE SET NULL;
--;;
alter table learning.lesson_sets add constraint lesson_sets_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES media.submissions(id) ON DELETE SET NULL;
--;;
alter table learning.lesson_sets add constraint lesson_sets_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
--;;
alter table learning.lessons add constraint lessons_audio_asset_id_fkey FOREIGN KEY (audio_asset_id) REFERENCES media.media_assets(id) ON DELETE SET NULL;
--;;
alter table learning.lessons add constraint lessons_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
--;;
alter table learning.lessons add constraint lessons_lesson_set_id_fkey FOREIGN KEY (lesson_set_id) REFERENCES learning.lesson_sets(id) ON DELETE CASCADE;
--;;
alter table learning.lessons add constraint lessons_media_asset_id_fkey FOREIGN KEY (media_asset_id) REFERENCES media.media_assets(id) ON DELETE RESTRICT;
--;;
alter table learning.lessons add constraint lessons_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
--;;
alter table learning.lyric_edit_drafts add constraint lyric_edit_drafts_album_recording_id_fkey FOREIGN KEY (album_recording_id) REFERENCES learning.album_recordings(id) ON DELETE CASCADE;
--;;
alter table learning.lyric_edit_drafts add constraint lyric_edit_drafts_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
--;;
alter table learning.lyric_edit_drafts add constraint lyric_edit_drafts_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES learning.lessons(id) ON DELETE CASCADE;
--;;
alter table learning.lyric_edit_drafts add constraint lyric_edit_drafts_locale_fkey FOREIGN KEY (locale) REFERENCES media.locales(code);
--;;
alter table learning.lyric_edit_drafts add constraint lyric_edit_drafts_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
--;;
alter table learning.lyric_lines add constraint lyric_lines_lyric_set_id_fkey FOREIGN KEY (lyric_set_id) REFERENCES learning.lyric_sets(id) ON DELETE CASCADE;
--;;
alter table learning.lyric_sets add constraint lyric_sets_album_recording_id_fkey FOREIGN KEY (album_recording_id) REFERENCES learning.album_recordings(id) ON DELETE CASCADE;
--;;
alter table learning.lyric_sets add constraint lyric_sets_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
--;;
alter table learning.lyric_sets add constraint lyric_sets_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES learning.lessons(id) ON DELETE CASCADE;
--;;
alter table learning.lyric_sets add constraint lyric_sets_locale_fkey FOREIGN KEY (locale) REFERENCES media.locales(code);
--;;
alter table learning.lyric_sets add constraint lyric_sets_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
--;;
alter table learning.playlist_items add constraint playlist_items_album_recording_id_fkey FOREIGN KEY (album_recording_id) REFERENCES learning.album_recordings(id) ON DELETE CASCADE;
--;;
alter table learning.playlist_items add constraint playlist_items_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES learning.lessons(id) ON DELETE CASCADE;
--;;
alter table learning.playlist_items add constraint playlist_items_playlist_id_fkey FOREIGN KEY (playlist_id) REFERENCES learning.playlists(id) ON DELETE CASCADE;
--;;
alter table learning.playlists add constraint playlists_cover_asset_id_fkey FOREIGN KEY (cover_asset_id) REFERENCES media.media_assets(id) ON DELETE SET NULL;
--;;
alter table learning.playlists add constraint playlists_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
--;;
alter table learning.recording_localizations add constraint recording_localizations_locale_fkey FOREIGN KEY (locale) REFERENCES media.locales(code) ON UPDATE CASCADE;
--;;
alter table learning.recording_localizations add constraint recording_localizations_recording_id_fkey FOREIGN KEY (recording_id) REFERENCES learning.album_recordings(id) ON DELETE CASCADE;
--;;
alter table learning.season_localizations add constraint season_localizations_locale_fkey FOREIGN KEY (locale) REFERENCES media.locales(code) ON UPDATE CASCADE;
--;;
alter table learning.season_localizations add constraint season_localizations_season_id_fkey FOREIGN KEY (season_id) REFERENCES learning.seasons(id) ON DELETE CASCADE;
--;;
alter table learning.seasons add constraint seasons_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
--;;
alter table learning.seasons add constraint seasons_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
--;;
alter table media.localized_texts add constraint localized_texts_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
--;;
alter table media.localized_texts add constraint localized_texts_locale_fkey FOREIGN KEY (locale) REFERENCES media.locales(code);
--;;
alter table media.localized_texts add constraint localized_texts_owner_creator_account_id_fkey FOREIGN KEY (owner_creator_account_id) REFERENCES creator.creator_accounts(id) ON DELETE SET NULL;
--;;
alter table media.localized_texts add constraint localized_texts_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
--;;
alter table media.media_asset_versions add constraint media_asset_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
--;;
alter table media.media_asset_versions add constraint media_asset_versions_media_asset_id_fkey FOREIGN KEY (media_asset_id) REFERENCES media.media_assets(id) ON DELETE CASCADE;
--;;
alter table media.media_assets add constraint media_assets_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
--;;
alter table media.media_assets add constraint media_assets_owner_creator_account_id_fkey FOREIGN KEY (owner_creator_account_id) REFERENCES creator.creator_accounts(id) ON DELETE SET NULL;
--;;
alter table media.media_assets add constraint media_assets_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
--;;
alter table media.media_processing_jobs add constraint media_processing_jobs_media_asset_id_fkey FOREIGN KEY (media_asset_id) REFERENCES media.media_assets(id) ON DELETE SET NULL;
--;;
alter table media.media_processing_jobs add constraint media_processing_jobs_media_asset_version_id_fkey FOREIGN KEY (media_asset_version_id) REFERENCES media.media_asset_versions(id) ON DELETE SET NULL;
--;;
alter table media.media_processing_jobs add constraint media_processing_jobs_upload_intent_id_fkey FOREIGN KEY (upload_intent_id) REFERENCES media.upload_intents(id) ON DELETE SET NULL;
--;;
alter table media.search_aliases add constraint search_aliases_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
--;;
alter table media.search_aliases add constraint search_aliases_locale_fkey FOREIGN KEY (locale) REFERENCES media.locales(code);
--;;
alter table media.search_aliases add constraint search_aliases_owner_creator_account_id_fkey FOREIGN KEY (owner_creator_account_id) REFERENCES creator.creator_accounts(id) ON DELETE SET NULL;
--;;
alter table media.search_aliases add constraint search_aliases_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
--;;
alter table media.search_documents add constraint search_documents_locale_fkey FOREIGN KEY (locale) REFERENCES media.locales(code);
--;;
alter table media.search_documents add constraint search_documents_owner_creator_account_id_fkey FOREIGN KEY (owner_creator_account_id) REFERENCES creator.creator_accounts(id) ON DELETE SET NULL;
--;;
alter table media.submission_events add constraint submission_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;
--;;
alter table media.submission_events add constraint submission_events_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES media.submissions(id) ON DELETE CASCADE;
--;;
alter table media.submission_items add constraint submission_items_audio_only_asset_id_fkey FOREIGN KEY (audio_only_asset_id) REFERENCES media.media_assets(id) ON DELETE SET NULL;
--;;
alter table media.submission_items add constraint submission_items_media_asset_id_fkey FOREIGN KEY (media_asset_id) REFERENCES media.media_assets(id) ON DELETE RESTRICT;
--;;
alter table media.submission_items add constraint submission_items_media_processing_job_id_fkey FOREIGN KEY (media_processing_job_id) REFERENCES media.media_processing_jobs(id) ON DELETE SET NULL;
--;;
alter table media.submission_items add constraint submission_items_music_track_id_fkey FOREIGN KEY (music_track_id) REFERENCES music.tracks(id) ON DELETE SET NULL;
--;;
alter table media.submission_items add constraint submission_items_replaces_item_id_fkey FOREIGN KEY (replaces_item_id) REFERENCES media.submission_items(id) ON DELETE CASCADE;
--;;
alter table media.submission_items add constraint submission_items_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES media.submissions(id) ON DELETE CASCADE;
--;;
alter table media.submission_items add constraint submission_items_upload_intent_id_fkey FOREIGN KEY (upload_intent_id) REFERENCES media.upload_intents(id) ON DELETE RESTRICT;
--;;
alter table media.submissions add constraint submissions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;
--;;
alter table media.submissions add constraint submissions_creator_account_id_fkey FOREIGN KEY (creator_account_id) REFERENCES creator.creator_accounts(id) ON DELETE CASCADE;
--;;
alter table media.submissions add constraint submissions_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES auth.users(id) ON DELETE SET NULL;
--;;
alter table media.submissions add constraint submissions_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
--;;
alter table media.upload_intents add constraint upload_intents_creator_account_id_fkey FOREIGN KEY (creator_account_id) REFERENCES creator.creator_accounts(id) ON DELETE CASCADE;
--;;
alter table media.upload_intents add constraint upload_intents_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES auth.users(id) ON DELETE CASCADE;
--;;
alter table music.artist_follows add constraint artist_follows_artist_id_fkey FOREIGN KEY (artist_id) REFERENCES music.artists(id) ON DELETE CASCADE;
--;;
alter table music.artist_follows add constraint artist_follows_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
--;;
alter table music.artist_localizations add constraint artist_localizations_artist_id_fkey FOREIGN KEY (artist_id) REFERENCES music.artists(id) ON DELETE CASCADE;
--;;
alter table music.artist_localizations add constraint artist_localizations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
--;;
alter table music.artist_localizations add constraint artist_localizations_locale_fkey FOREIGN KEY (locale) REFERENCES media.locales(code);
--;;
alter table music.artist_localizations add constraint artist_localizations_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
--;;
alter table music.artist_memberships add constraint artist_memberships_artist_id_fkey FOREIGN KEY (artist_id) REFERENCES music.artists(id) ON DELETE CASCADE;
--;;
alter table music.artist_memberships add constraint artist_memberships_creator_account_id_fkey FOREIGN KEY (creator_account_id) REFERENCES creator.creator_accounts(id) ON DELETE CASCADE;
--;;
alter table music.artist_pinned_releases add constraint artist_pinned_releases_artist_id_fkey FOREIGN KEY (artist_id) REFERENCES music.artists(id) ON DELETE CASCADE;
--;;
alter table music.artist_pinned_releases add constraint artist_pinned_releases_release_id_fkey FOREIGN KEY (release_id) REFERENCES music.releases(id) ON DELETE CASCADE;
--;;
alter table music.artist_social_links add constraint artist_social_links_artist_id_fkey FOREIGN KEY (artist_id) REFERENCES music.artists(id) ON DELETE CASCADE;
--;;
alter table music.artists add constraint artists_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
--;;
alter table music.artists add constraint artists_owner_creator_account_id_fkey FOREIGN KEY (owner_creator_account_id) REFERENCES creator.creator_accounts(id) ON DELETE SET NULL;
--;;
alter table music.artists add constraint artists_profile_image_asset_id_fkey FOREIGN KEY (profile_image_asset_id) REFERENCES media.media_assets(id) ON DELETE SET NULL;
--;;
alter table music.artists add constraint artists_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
--;;
alter table music.lyric_edit_drafts add constraint lyric_edit_drafts_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
--;;
alter table music.lyric_edit_drafts add constraint lyric_edit_drafts_locale_fkey FOREIGN KEY (locale) REFERENCES media.locales(code);
--;;
alter table music.lyric_edit_drafts add constraint lyric_edit_drafts_track_id_fkey FOREIGN KEY (track_id) REFERENCES music.tracks(id) ON DELETE CASCADE;
--;;
alter table music.lyric_edit_drafts add constraint lyric_edit_drafts_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
--;;
alter table music.lyric_lines add constraint lyric_lines_lyric_set_id_fkey FOREIGN KEY (lyric_set_id) REFERENCES music.lyric_sets(id) ON DELETE CASCADE;
--;;
alter table music.lyric_sets add constraint lyric_sets_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
--;;
alter table music.lyric_sets add constraint lyric_sets_locale_fkey FOREIGN KEY (locale) REFERENCES media.locales(code);
--;;
alter table music.lyric_sets add constraint lyric_sets_track_id_fkey FOREIGN KEY (track_id) REFERENCES music.tracks(id) ON DELETE CASCADE;
--;;
alter table music.lyric_sets add constraint lyric_sets_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
--;;
alter table music.lyric_words add constraint lyric_words_lyric_line_id_fkey FOREIGN KEY (lyric_line_id) REFERENCES music.lyric_lines(id) ON DELETE CASCADE;
--;;
alter table music.play_history add constraint play_history_media_asset_id_fkey FOREIGN KEY (media_asset_id) REFERENCES media.media_assets(id) ON DELETE SET NULL;
--;;
alter table music.play_history add constraint play_history_release_id_fkey FOREIGN KEY (release_id) REFERENCES music.releases(id) ON DELETE SET NULL;
--;;
alter table music.play_history add constraint play_history_track_id_fkey FOREIGN KEY (track_id) REFERENCES music.tracks(id) ON DELETE CASCADE;
--;;
alter table music.play_history add constraint play_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
--;;
alter table music.playlist_tracks add constraint playlist_tracks_added_by_fkey FOREIGN KEY (added_by) REFERENCES auth.users(id) ON DELETE SET NULL;
--;;
alter table music.playlist_tracks add constraint playlist_tracks_playlist_id_fkey FOREIGN KEY (playlist_id) REFERENCES music.playlists(id) ON DELETE CASCADE;
--;;
alter table music.playlist_tracks add constraint playlist_tracks_track_id_fkey FOREIGN KEY (track_id) REFERENCES music.tracks(id) ON DELETE CASCADE;
--;;
alter table music.playlists add constraint playlists_cover_asset_id_fkey FOREIGN KEY (cover_asset_id) REFERENCES media.media_assets(id) ON DELETE SET NULL;
--;;
alter table music.playlists add constraint playlists_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
--;;
alter table music.release_likes add constraint release_likes_release_id_fkey FOREIGN KEY (release_id) REFERENCES music.releases(id) ON DELETE CASCADE;
--;;
alter table music.release_likes add constraint release_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
--;;
alter table music.release_localizations add constraint release_localizations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
--;;
alter table music.release_localizations add constraint release_localizations_locale_fkey FOREIGN KEY (locale) REFERENCES media.locales(code);
--;;
alter table music.release_localizations add constraint release_localizations_release_id_fkey FOREIGN KEY (release_id) REFERENCES music.releases(id) ON DELETE CASCADE;
--;;
alter table music.release_localizations add constraint release_localizations_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
--;;
alter table music.release_tracks add constraint release_tracks_release_id_fkey FOREIGN KEY (release_id) REFERENCES music.releases(id) ON DELETE CASCADE;
--;;
alter table music.release_tracks add constraint release_tracks_track_id_fkey FOREIGN KEY (track_id) REFERENCES music.tracks(id) ON DELETE RESTRICT;
--;;
alter table music.releases add constraint releases_cover_asset_id_fkey FOREIGN KEY (cover_asset_id) REFERENCES media.media_assets(id) ON DELETE SET NULL;
--;;
alter table music.releases add constraint releases_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
--;;
alter table music.releases add constraint releases_owner_creator_account_id_fkey FOREIGN KEY (owner_creator_account_id) REFERENCES creator.creator_accounts(id) ON DELETE SET NULL;
--;;
alter table music.releases add constraint releases_primary_artist_id_fkey FOREIGN KEY (primary_artist_id) REFERENCES music.artists(id) ON DELETE RESTRICT;
--;;
alter table music.releases add constraint releases_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
--;;
alter table music.track_artists add constraint track_artists_artist_id_fkey FOREIGN KEY (artist_id) REFERENCES music.artists(id) ON DELETE RESTRICT;
--;;
alter table music.track_artists add constraint track_artists_track_id_fkey FOREIGN KEY (track_id) REFERENCES music.tracks(id) ON DELETE CASCADE;
--;;
alter table music.track_likes add constraint track_likes_track_id_fkey FOREIGN KEY (track_id) REFERENCES music.tracks(id) ON DELETE CASCADE;
--;;
alter table music.track_likes add constraint track_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
--;;
alter table music.track_localizations add constraint track_localizations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
--;;
alter table music.track_localizations add constraint track_localizations_locale_fkey FOREIGN KEY (locale) REFERENCES media.locales(code);
--;;
alter table music.track_localizations add constraint track_localizations_track_id_fkey FOREIGN KEY (track_id) REFERENCES music.tracks(id) ON DELETE CASCADE;
--;;
alter table music.track_localizations add constraint track_localizations_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
--;;
alter table music.tracks add constraint tracks_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
--;;
alter table music.tracks add constraint tracks_media_asset_id_fkey FOREIGN KEY (media_asset_id) REFERENCES media.media_assets(id) ON DELETE RESTRICT;
--;;
alter table music.tracks add constraint tracks_owner_creator_account_id_fkey FOREIGN KEY (owner_creator_account_id) REFERENCES creator.creator_accounts(id) ON DELETE SET NULL;
--;;
alter table music.tracks add constraint tracks_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
--;;
alter table private.notification_deliveries add constraint notification_deliveries_broadcast_id_fkey FOREIGN KEY (broadcast_id) REFERENCES notification_broadcasts(id) ON DELETE CASCADE;
--;;
alter table private.notification_deliveries add constraint notification_deliveries_device_id_fkey FOREIGN KEY (device_id) REFERENCES notification_devices(id) ON DELETE CASCADE;
--;;
alter table private.notification_deliveries add constraint notification_deliveries_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE;
--;;
alter table public.bible_highlights add constraint bible_highlights_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
--;;
alter table public.hymn_texts add constraint hymn_texts_hymn_key_fkey FOREIGN KEY (hymn_key) REFERENCES hymn_titles(hymn_key) ON UPDATE CASCADE ON DELETE CASCADE;
--;;
alter table public.notification_broadcasts add constraint notification_broadcasts_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE RESTRICT;
--;;
alter table public.notification_devices add constraint notification_devices_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
--;;
alter table public.notification_preferences add constraint notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
--;;
alter table public.notifications add constraint notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
--;;
alter table public.sermon_plans add constraint sermon_plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
--;;
alter table public.spiritual_canon_days add constraint spiritual_canon_days_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
--;;
alter table public.spiritual_canons add constraint spiritual_canons_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
--;;
alter table public.user_content_preferences add constraint user_content_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
--;;
CREATE INDEX artist_follows_artist_idx ON music.artist_follows USING btree (artist_id);
--;;
CREATE INDEX artist_localizations_created_by_idx ON music.artist_localizations USING btree (created_by) WHERE (created_by IS NOT NULL);
--;;
CREATE INDEX artist_localizations_locale_idx ON music.artist_localizations USING btree (locale);
--;;
CREATE INDEX artist_localizations_updated_by_idx ON music.artist_localizations USING btree (updated_by) WHERE (updated_by IS NOT NULL);
--;;
CREATE INDEX artist_memberships_creator_account_idx ON music.artist_memberships USING btree (creator_account_id);
--;;
CREATE INDEX artist_pinned_releases_order_idx ON music.artist_pinned_releases USING btree (artist_id, sort_order);
--;;
CREATE INDEX artist_social_links_artist_idx ON music.artist_social_links USING btree (artist_id, sort_order);
--;;
CREATE INDEX artists_created_by_idx ON music.artists USING btree (created_by) WHERE (created_by IS NOT NULL);
--;;
CREATE INDEX artists_owner_idx ON music.artists USING btree (owner_creator_account_id);
--;;
CREATE INDEX artists_profile_image_idx ON music.artists USING btree (profile_image_asset_id) WHERE (profile_image_asset_id IS NOT NULL);
--;;
CREATE INDEX artists_publication_status_idx ON music.artists USING btree (publication_status);
--;;
CREATE INDEX artists_updated_by_idx ON music.artists USING btree (updated_by) WHERE (updated_by IS NOT NULL);
--;;
CREATE INDEX creator_account_members_invited_by_idx ON creator.creator_account_members USING btree (invited_by) WHERE (invited_by IS NOT NULL);
--;;
CREATE INDEX creator_account_members_role_idx ON creator.creator_account_members USING btree (creator_account_id, role);
--;;
CREATE INDEX creator_account_members_user_idx ON creator.creator_account_members USING btree (user_id, creator_account_id);
--;;
CREATE INDEX creator_accounts_created_by_idx ON creator.creator_accounts USING btree (created_by) WHERE (created_by IS NOT NULL);
--;;
CREATE UNIQUE INDEX creator_accounts_identity_artist_key ON creator.creator_accounts USING btree (identity_artist_id) WHERE (identity_artist_id IS NOT NULL);
--;;
CREATE INDEX creator_accounts_updated_by_idx ON creator.creator_accounts USING btree (updated_by) WHERE (updated_by IS NOT NULL);
--;;
CREATE INDEX learning_albums_discovery_idx ON learning.albums USING btree (publication_status, cantor_id, season_id, created_at DESC);
--;;
CREATE UNIQUE INDEX learning_cantors_artist_id_unique ON learning.cantors USING btree (artist_id) WHERE (artist_id IS NOT NULL);
--;;
CREATE INDEX learning_cantors_publication_idx ON learning.cantors USING btree (publication_status, display_name);
--;;
CREATE INDEX learning_hymn_seasons_season_idx ON learning.hymn_seasons USING btree (season_id, sort_order, hymn_id);
--;;
CREATE INDEX learning_hymns_publication_title_idx ON learning.hymns USING btree (publication_status, title);
--;;
CREATE INDEX learning_item_likes_lesson_idx ON learning.item_likes USING btree (lesson_id) WHERE (lesson_id IS NOT NULL);
--;;
CREATE UNIQUE INDEX learning_item_likes_lesson_unique ON learning.item_likes USING btree (user_id, lesson_id) WHERE (item_kind = 'lesson'::learning.playlist_item_kind);
--;;
CREATE INDEX learning_item_likes_recording_idx ON learning.item_likes USING btree (album_recording_id) WHERE (album_recording_id IS NOT NULL);
--;;
CREATE UNIQUE INDEX learning_item_likes_recording_unique ON learning.item_likes USING btree (user_id, album_recording_id) WHERE (item_kind = 'album_recording'::learning.playlist_item_kind);
--;;
CREATE INDEX learning_item_progress_lesson_idx ON learning.item_progress USING btree (lesson_id) WHERE (lesson_id IS NOT NULL);
--;;
CREATE UNIQUE INDEX learning_item_progress_lesson_unique ON learning.item_progress USING btree (user_id, lesson_id) WHERE (item_kind = 'lesson'::learning.playlist_item_kind);
--;;
CREATE INDEX learning_item_progress_library_idx ON learning.item_progress USING btree (user_id, state, updated_at DESC);
--;;
CREATE INDEX learning_item_progress_recording_idx ON learning.item_progress USING btree (album_recording_id) WHERE (album_recording_id IS NOT NULL);
--;;
CREATE UNIQUE INDEX learning_item_progress_recording_unique ON learning.item_progress USING btree (user_id, album_recording_id) WHERE (item_kind = 'album_recording'::learning.playlist_item_kind);
--;;
CREATE INDEX learning_lesson_sets_discovery_idx ON learning.lesson_sets USING btree (publication_status, cantor_id, season_id, hymn_id, created_at DESC);
--;;
CREATE INDEX learning_lessons_audio_asset_idx ON learning.lessons USING btree (audio_asset_id) WHERE (audio_asset_id IS NOT NULL);
--;;
CREATE INDEX learning_lessons_set_idx ON learning.lessons USING btree (lesson_set_id, sort_order);
--;;
CREATE INDEX learning_lyric_drafts_created_by_idx ON learning.lyric_edit_drafts USING btree (created_by) WHERE (created_by IS NOT NULL);
--;;
CREATE UNIQUE INDEX learning_lyric_drafts_lesson_locale_unique ON learning.lyric_edit_drafts USING btree (lesson_id, locale) WHERE (item_kind = 'lesson'::learning.playlist_item_kind);
--;;
CREATE INDEX learning_lyric_drafts_locale_idx ON learning.lyric_edit_drafts USING btree (locale);
--;;
CREATE UNIQUE INDEX learning_lyric_drafts_recording_locale_unique ON learning.lyric_edit_drafts USING btree (album_recording_id, locale) WHERE (item_kind = 'album_recording'::learning.playlist_item_kind);
--;;
CREATE INDEX learning_lyric_drafts_updated_by_idx ON learning.lyric_edit_drafts USING btree (updated_by) WHERE (updated_by IS NOT NULL);
--;;
CREATE INDEX learning_lyric_sets_created_by_idx ON learning.lyric_sets USING btree (created_by) WHERE (created_by IS NOT NULL);
--;;
CREATE UNIQUE INDEX learning_lyric_sets_lesson_locale_unique ON learning.lyric_sets USING btree (lesson_id, locale) WHERE (item_kind = 'lesson'::learning.playlist_item_kind);
--;;
CREATE INDEX learning_lyric_sets_locale_idx ON learning.lyric_sets USING btree (locale);
--;;
CREATE UNIQUE INDEX learning_lyric_sets_recording_locale_unique ON learning.lyric_sets USING btree (album_recording_id, locale) WHERE (item_kind = 'album_recording'::learning.playlist_item_kind);
--;;
CREATE INDEX learning_lyric_sets_updated_by_idx ON learning.lyric_sets USING btree (updated_by) WHERE (updated_by IS NOT NULL);
--;;
CREATE INDEX learning_playlist_items_lesson_idx ON learning.playlist_items USING btree (lesson_id) WHERE (lesson_id IS NOT NULL);
--;;
CREATE INDEX learning_playlist_items_recording_idx ON learning.playlist_items USING btree (album_recording_id) WHERE (album_recording_id IS NOT NULL);
--;;
CREATE INDEX learning_playlists_owner_idx ON learning.playlists USING btree (owner_user_id, updated_at DESC);
--;;
CREATE INDEX learning_progress_user_state_idx ON learning.hymn_progress USING btree (user_id, state, updated_at DESC);
--;;
CREATE INDEX learning_recordings_album_idx ON learning.album_recordings USING btree (album_id, sort_order);
--;;
CREATE INDEX learning_seasons_publication_sort_idx ON learning.seasons USING btree (publication_status, sort_order, title);
--;;
CREATE INDEX localized_texts_created_by_idx ON media.localized_texts USING btree (created_by) WHERE (created_by IS NOT NULL);
--;;
CREATE INDEX localized_texts_entity_idx ON media.localized_texts USING btree (entity_type, entity_id);
--;;
CREATE INDEX localized_texts_locale_idx ON media.localized_texts USING btree (locale);
--;;
CREATE INDEX localized_texts_owner_idx ON media.localized_texts USING btree (owner_creator_account_id);
--;;
CREATE INDEX localized_texts_updated_by_idx ON media.localized_texts USING btree (updated_by) WHERE (updated_by IS NOT NULL);
--;;
CREATE INDEX lyric_lines_set_sequence_idx ON music.lyric_lines USING btree (lyric_set_id, sequence);
--;;
CREATE INDEX lyric_lines_set_time_idx ON music.lyric_lines USING btree (lyric_set_id, start_ms, end_ms) WHERE (start_ms IS NOT NULL);
--;;
CREATE INDEX lyric_sets_created_by_idx ON music.lyric_sets USING btree (created_by) WHERE (created_by IS NOT NULL);
--;;
CREATE INDEX lyric_sets_locale_idx ON music.lyric_sets USING btree (locale);
--;;
CREATE INDEX lyric_sets_track_idx ON music.lyric_sets USING btree (track_id, publication_status);
--;;
CREATE INDEX lyric_sets_updated_by_idx ON music.lyric_sets USING btree (updated_by) WHERE (updated_by IS NOT NULL);
--;;
CREATE INDEX lyric_words_line_sequence_idx ON music.lyric_words USING btree (lyric_line_id, sequence);
--;;
CREATE INDEX lyric_words_line_time_idx ON music.lyric_words USING btree (lyric_line_id, start_ms, end_ms) WHERE (start_ms IS NOT NULL);
--;;
CREATE INDEX media_asset_versions_asset_idx ON media.media_asset_versions USING btree (media_asset_id);
--;;
CREATE INDEX media_asset_versions_created_by_idx ON media.media_asset_versions USING btree (created_by) WHERE (created_by IS NOT NULL);
--;;
CREATE INDEX media_assets_created_by_idx ON media.media_assets USING btree (created_by) WHERE (created_by IS NOT NULL);
--;;
CREATE INDEX media_assets_owner_idx ON media.media_assets USING btree (owner_creator_account_id);
--;;
CREATE INDEX media_assets_publication_status_idx ON media.media_assets USING btree (publication_status);
--;;
CREATE INDEX media_assets_type_status_idx ON media.media_assets USING btree (media_type, publication_status);
--;;
CREATE INDEX media_assets_updated_by_idx ON media.media_assets USING btree (updated_by) WHERE (updated_by IS NOT NULL);
--;;
CREATE INDEX media_processing_jobs_claim_idx ON media.media_processing_jobs USING btree (status, available_at, created_at) WHERE (status = 'queued'::media.processing_job_status);
--;;
CREATE INDEX media_processing_jobs_media_asset_idx ON media.media_processing_jobs USING btree (media_asset_id) WHERE (media_asset_id IS NOT NULL);
--;;
CREATE INDEX media_processing_jobs_media_asset_version_idx ON media.media_processing_jobs USING btree (media_asset_version_id) WHERE (media_asset_version_id IS NOT NULL);
--;;
CREATE UNIQUE INDEX media_processing_jobs_output_ref_idx ON media.media_processing_jobs USING btree (output_bucket, output_path) WHERE (output_path IS NOT NULL);
--;;
CREATE INDEX media_processing_jobs_upload_intent_idx ON media.media_processing_jobs USING btree (upload_intent_id) WHERE (upload_intent_id IS NOT NULL);
--;;
CREATE INDEX media_submission_items_audio_only_asset_idx ON media.submission_items USING btree (audio_only_asset_id) WHERE (audio_only_asset_id IS NOT NULL);
--;;
CREATE INDEX music_lyric_drafts_created_by_idx ON music.lyric_edit_drafts USING btree (created_by) WHERE (created_by IS NOT NULL);
--;;
CREATE INDEX music_lyric_drafts_locale_idx ON music.lyric_edit_drafts USING btree (locale);
--;;
CREATE INDEX music_lyric_drafts_updated_by_idx ON music.lyric_edit_drafts USING btree (updated_by) WHERE (updated_by IS NOT NULL);
--;;
CREATE INDEX notification_broadcasts_created_at_idx ON public.notification_broadcasts USING btree (created_at DESC);
--;;
CREATE UNIQUE INDEX notification_deliveries_broadcast_device_uidx ON private.notification_deliveries USING btree (broadcast_id, device_id) WHERE (broadcast_id IS NOT NULL);
--;;
CREATE INDEX notification_deliveries_broadcast_status_idx ON private.notification_deliveries USING btree (broadcast_id, status) WHERE (broadcast_id IS NOT NULL);
--;;
CREATE INDEX notification_deliveries_dispatch_idx ON private.notification_deliveries USING btree (provider, status, available_at);
--;;
CREATE INDEX notification_deliveries_receipt_idx ON private.notification_deliveries USING btree (provider, status, accepted_at, receipt_checked_at);
--;;
CREATE INDEX notification_devices_app_enabled_idx ON public.notification_devices USING btree (app_key, enabled, provider);
--;;
CREATE UNIQUE INDEX notification_devices_app_provider_token_uidx ON public.notification_devices USING btree (app_key, provider, push_token);
--;;
CREATE INDEX notification_devices_user_enabled_idx ON public.notification_devices USING btree (user_id, app_key, enabled);
--;;
CREATE INDEX notifications_user_created_idx ON public.notifications USING btree (user_id, app_key, created_at DESC);
--;;
CREATE INDEX play_history_media_asset_idx ON music.play_history USING btree (media_asset_id) WHERE (media_asset_id IS NOT NULL);
--;;
CREATE INDEX play_history_release_idx ON music.play_history USING btree (release_id) WHERE (release_id IS NOT NULL);
--;;
CREATE INDEX play_history_track_idx ON music.play_history USING btree (track_id);
--;;
CREATE INDEX play_history_user_played_idx ON music.play_history USING btree (user_id, played_at DESC);
--;;
CREATE INDEX playlist_tracks_added_by_idx ON music.playlist_tracks USING btree (added_by) WHERE (added_by IS NOT NULL);
--;;
CREATE INDEX playlist_tracks_order_idx ON music.playlist_tracks USING btree (playlist_id, sort_order, created_at);
--;;
CREATE INDEX playlist_tracks_track_idx ON music.playlist_tracks USING btree (track_id);
--;;
CREATE INDEX playlists_cover_asset_idx ON music.playlists USING btree (cover_asset_id) WHERE (cover_asset_id IS NOT NULL);
--;;
CREATE INDEX playlists_owner_idx ON music.playlists USING btree (owner_user_id, updated_at DESC);
--;;
CREATE INDEX release_likes_release_idx ON music.release_likes USING btree (release_id);
--;;
CREATE INDEX release_localizations_created_by_idx ON music.release_localizations USING btree (created_by) WHERE (created_by IS NOT NULL);
--;;
CREATE INDEX release_localizations_locale_idx ON music.release_localizations USING btree (locale);
--;;
CREATE INDEX release_localizations_updated_by_idx ON music.release_localizations USING btree (updated_by) WHERE (updated_by IS NOT NULL);
--;;
CREATE INDEX release_tracks_track_idx ON music.release_tracks USING btree (track_id);
--;;
CREATE INDEX releases_cover_asset_idx ON music.releases USING btree (cover_asset_id) WHERE (cover_asset_id IS NOT NULL);
--;;
CREATE INDEX releases_created_by_idx ON music.releases USING btree (created_by) WHERE (created_by IS NOT NULL);
--;;
CREATE INDEX releases_owner_idx ON music.releases USING btree (owner_creator_account_id);
--;;
CREATE INDEX releases_primary_artist_idx ON music.releases USING btree (primary_artist_id) WHERE (primary_artist_id IS NOT NULL);
--;;
CREATE INDEX releases_publication_status_idx ON music.releases USING btree (publication_status, release_date DESC);
--;;
CREATE INDEX releases_updated_by_idx ON music.releases USING btree (updated_by) WHERE (updated_by IS NOT NULL);
--;;
CREATE INDEX saint_order_sort_order_idx ON public.saint_order USING btree (sort_order);
--;;
CREATE INDEX search_aliases_created_by_idx ON media.search_aliases USING btree (created_by) WHERE (created_by IS NOT NULL);
--;;
CREATE INDEX search_aliases_entity_idx ON media.search_aliases USING btree (entity_type, entity_id);
--;;
CREATE INDEX search_aliases_locale_idx ON media.search_aliases USING btree (locale) WHERE (locale IS NOT NULL);
--;;
CREATE INDEX search_aliases_normalized_idx ON media.search_aliases USING btree (normalized_alias);
--;;
CREATE INDEX search_aliases_normalized_trgm_idx ON media.search_aliases USING gin (normalized_alias gin_trgm_ops) WHERE (publication_status = 'published'::media.publication_status);
--;;
CREATE INDEX search_aliases_owner_idx ON media.search_aliases USING btree (owner_creator_account_id) WHERE (owner_creator_account_id IS NOT NULL);
--;;
CREATE INDEX search_aliases_updated_by_idx ON media.search_aliases USING btree (updated_by) WHERE (updated_by IS NOT NULL);
--;;
CREATE INDEX search_documents_entity_idx ON media.search_documents USING btree (entity_type, entity_id);
--;;
CREATE INDEX search_documents_locale_idx ON media.search_documents USING btree (locale) WHERE (locale IS NOT NULL);
--;;
CREATE INDEX search_documents_normalized_trgm_idx ON media.search_documents USING gin (normalized_text gin_trgm_ops) WHERE ((publication_status = 'published'::media.publication_status) AND (kind = 'unified_catalog'::text));
--;;
CREATE INDEX search_documents_owner_idx ON media.search_documents USING btree (owner_creator_account_id);
--;;
CREATE INDEX search_documents_vector_idx ON media.search_documents USING gin (search_vector);
--;;
CREATE INDEX sermon_plans_user_date_idx ON public.sermon_plans USING btree (user_id, service_date DESC);
--;;
CREATE INDEX storage_gc_candidates_due_idx ON media.storage_gc_candidates USING btree (first_unused_at);
--;;
CREATE INDEX submission_events_actor_fk_idx ON media.submission_events USING btree (actor_id) WHERE (actor_id IS NOT NULL);
--;;
CREATE INDEX submission_events_submission_created_idx ON media.submission_events USING btree (submission_id, created_at);
--;;
CREATE INDEX submission_items_media_asset_fk_idx ON media.submission_items USING btree (media_asset_id) WHERE (media_asset_id IS NOT NULL);
--;;
CREATE INDEX submission_items_music_track_id_idx ON media.submission_items USING btree (music_track_id) WHERE (music_track_id IS NOT NULL);
--;;
CREATE UNIQUE INDEX submission_items_one_replacement_per_item ON media.submission_items USING btree (replaces_item_id) WHERE (replaces_item_id IS NOT NULL);
--;;
CREATE INDEX submission_items_processing_job_idx ON media.submission_items USING btree (media_processing_job_id) WHERE (media_processing_job_id IS NOT NULL);
--;;
CREATE UNIQUE INDEX submission_items_submission_media_asset_idx ON media.submission_items USING btree (submission_id, media_asset_id) WHERE (media_asset_id IS NOT NULL);
--;;
CREATE INDEX submission_items_submission_order_idx ON media.submission_items USING btree (submission_id, sort_order, created_at);
--;;
CREATE UNIQUE INDEX submission_items_submission_upload_intent_idx ON media.submission_items USING btree (submission_id, upload_intent_id) WHERE (upload_intent_id IS NOT NULL);
--;;
CREATE INDEX submission_items_upload_intent_fk_idx ON media.submission_items USING btree (upload_intent_id) WHERE (upload_intent_id IS NOT NULL);
--;;
CREATE UNIQUE INDEX submission_items_upload_intent_id_unique ON media.submission_items USING btree (upload_intent_id) WHERE (upload_intent_id IS NOT NULL);
--;;
CREATE INDEX submissions_created_by_fk_idx ON media.submissions USING btree (created_by);
--;;
CREATE INDEX submissions_creator_status_idx ON media.submissions USING btree (creator_account_id, status, created_at DESC);
--;;
CREATE INDEX submissions_review_queue_idx ON media.submissions USING btree (status, review_due_at, submitted_at) WHERE (status = 'pending_review'::media.publication_status);
--;;
CREATE INDEX submissions_reviewer_idx ON media.submissions USING btree (reviewer_id, reviewed_at DESC) WHERE (reviewer_id IS NOT NULL);
--;;
CREATE INDEX submissions_updated_by_fk_idx ON media.submissions USING btree (updated_by) WHERE (updated_by IS NOT NULL);
--;;
CREATE INDEX track_artists_artist_idx ON music.track_artists USING btree (artist_id);
--;;
CREATE INDEX track_likes_track_idx ON music.track_likes USING btree (track_id);
--;;
CREATE INDEX track_localizations_created_by_idx ON music.track_localizations USING btree (created_by) WHERE (created_by IS NOT NULL);
--;;
CREATE INDEX track_localizations_locale_idx ON music.track_localizations USING btree (locale);
--;;
CREATE INDEX track_localizations_updated_by_idx ON music.track_localizations USING btree (updated_by) WHERE (updated_by IS NOT NULL);
--;;
CREATE INDEX tracks_created_by_idx ON music.tracks USING btree (created_by) WHERE (created_by IS NOT NULL);
--;;
CREATE INDEX tracks_media_asset_idx ON music.tracks USING btree (media_asset_id) WHERE (media_asset_id IS NOT NULL);
--;;
CREATE INDEX tracks_owner_idx ON music.tracks USING btree (owner_creator_account_id);
--;;
CREATE INDEX tracks_publication_status_idx ON music.tracks USING btree (publication_status);
--;;
CREATE INDEX tracks_updated_by_idx ON music.tracks USING btree (updated_by) WHERE (updated_by IS NOT NULL);
--;;
CREATE INDEX upload_intents_creator_status_idx ON media.upload_intents USING btree (creator_account_id, status, created_at DESC);
--;;
CREATE INDEX upload_intents_expires_idx ON media.upload_intents USING btree (upload_expires_at) WHERE (status = 'authorized'::media.upload_intent_status);
--;;
CREATE INDEX upload_intents_requested_by_idx ON media.upload_intents USING btree (requested_by, created_at DESC);
--;;
CREATE INDEX user_roles_granted_by_idx ON creator.user_roles USING btree (granted_by) WHERE (granted_by IS NOT NULL);
--;;
CREATE INDEX user_roles_role_active_idx ON creator.user_roles USING btree (role, user_id) WHERE (revoked_at IS NULL);
--;;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON creator.creator_account_members FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
--;;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON creator.creator_accounts FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
--;;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON creator.profiles FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
--;;
CREATE TRIGGER learning_album_localizations_refresh_unified_search AFTER INSERT OR DELETE OR UPDATE ON learning.album_localizations FOR EACH STATEMENT EXECUTE FUNCTION private.refresh_unified_search_index_trigger();
--;;
CREATE TRIGGER learning_album_localizations_set_updated_at BEFORE UPDATE ON learning.album_localizations FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
--;;
CREATE TRIGGER learning_recordings_set_updated_at BEFORE UPDATE ON learning.album_recordings FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
--;;
CREATE TRIGGER learning_albums_refresh_unified_search AFTER INSERT OR DELETE OR UPDATE ON learning.albums FOR EACH STATEMENT EXECUTE FUNCTION private.refresh_unified_search_index_trigger();
--;;
CREATE TRIGGER learning_albums_set_updated_at BEFORE UPDATE ON learning.albums FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
--;;
CREATE TRIGGER learning_cantor_localizations_refresh_unified_search AFTER INSERT OR DELETE OR UPDATE ON learning.cantor_localizations FOR EACH STATEMENT EXECUTE FUNCTION private.refresh_unified_search_index_trigger();
--;;
CREATE TRIGGER learning_cantor_localizations_set_updated_at BEFORE UPDATE ON learning.cantor_localizations FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
--;;
CREATE TRIGGER learning_cantor_permissions_set_updated_at BEFORE UPDATE ON learning.cantor_permissions FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
--;;
CREATE TRIGGER learning_cantor_publish_profile_image AFTER INSERT OR UPDATE OF profile_image_asset_id, publication_status ON learning.cantors FOR EACH ROW EXECUTE FUNCTION private.publish_public_profile_image();
--;;
CREATE TRIGGER learning_cantors_refresh_unified_search AFTER INSERT OR DELETE OR UPDATE ON learning.cantors FOR EACH STATEMENT EXECUTE FUNCTION private.refresh_unified_search_index_trigger();
--;;
CREATE TRIGGER learning_cantors_set_updated_at BEFORE UPDATE ON learning.cantors FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
--;;
CREATE TRIGGER learning_hymn_localizations_refresh_unified_search AFTER INSERT OR DELETE OR UPDATE ON learning.hymn_localizations FOR EACH STATEMENT EXECUTE FUNCTION private.refresh_unified_search_index_trigger();
--;;
CREATE TRIGGER learning_hymn_localizations_set_updated_at BEFORE UPDATE ON learning.hymn_localizations FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
--;;
CREATE TRIGGER learning_hymn_progress_set_updated_at BEFORE UPDATE ON learning.hymn_progress FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
--;;
CREATE TRIGGER learning_hymn_relationships_set_updated_at BEFORE UPDATE ON learning.hymn_relationships FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
--;;
CREATE TRIGGER learning_hymns_refresh_unified_search AFTER INSERT OR DELETE OR UPDATE ON learning.hymns FOR EACH STATEMENT EXECUTE FUNCTION private.refresh_unified_search_index_trigger();
--;;
CREATE TRIGGER learning_hymns_set_updated_at BEFORE UPDATE ON learning.hymns FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
--;;
CREATE TRIGGER learning_item_progress_set_updated_at BEFORE UPDATE ON learning.item_progress FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
--;;
CREATE TRIGGER learning_lesson_localizations_refresh_unified_search AFTER INSERT OR DELETE OR UPDATE ON learning.lesson_localizations FOR EACH STATEMENT EXECUTE FUNCTION private.refresh_unified_search_index_trigger();
--;;
CREATE TRIGGER learning_lesson_localizations_set_updated_at BEFORE UPDATE ON learning.lesson_localizations FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
--;;
CREATE TRIGGER learning_lesson_set_localizations_set_updated_at BEFORE UPDATE ON learning.lesson_set_localizations FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
--;;
CREATE TRIGGER learning_lesson_set_localizations_refresh_unified_search AFTER INSERT OR DELETE OR UPDATE ON learning.lesson_set_localizations FOR EACH STATEMENT EXECUTE FUNCTION private.refresh_unified_search_index_trigger();
--;;
CREATE TRIGGER learning_lesson_sets_refresh_unified_search AFTER INSERT OR DELETE OR UPDATE ON learning.lesson_sets FOR EACH STATEMENT EXECUTE FUNCTION private.refresh_unified_search_index_trigger();
--;;
CREATE TRIGGER learning_lesson_sets_set_updated_at BEFORE UPDATE ON learning.lesson_sets FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
--;;
CREATE TRIGGER learning_lesson_attach_audio_asset BEFORE INSERT OR UPDATE OF publication_status ON learning.lessons FOR EACH ROW EXECUTE FUNCTION private.attach_lesson_audio_asset();
--;;
CREATE TRIGGER learning_lessons_refresh_unified_search AFTER INSERT OR DELETE OR UPDATE ON learning.lessons FOR EACH STATEMENT EXECUTE FUNCTION private.refresh_unified_search_index_trigger();
--;;
CREATE TRIGGER learning_lessons_set_updated_at BEFORE UPDATE ON learning.lessons FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
--;;
CREATE TRIGGER learning_lyric_drafts_set_updated_at BEFORE UPDATE ON learning.lyric_edit_drafts FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
--;;
CREATE TRIGGER learning_lyric_lines_set_updated_at BEFORE UPDATE ON learning.lyric_lines FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
--;;
CREATE TRIGGER learning_lyric_sets_set_updated_at BEFORE UPDATE ON learning.lyric_sets FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
--;;
CREATE TRIGGER learning_playlists_set_updated_at BEFORE UPDATE ON learning.playlists FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
--;;
CREATE TRIGGER learning_recording_localizations_set_updated_at BEFORE UPDATE ON learning.recording_localizations FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
--;;
CREATE TRIGGER learning_season_localizations_refresh_unified_search AFTER INSERT OR DELETE OR UPDATE ON learning.season_localizations FOR EACH STATEMENT EXECUTE FUNCTION private.refresh_unified_search_index_trigger();
--;;
CREATE TRIGGER learning_season_localizations_set_updated_at BEFORE UPDATE ON learning.season_localizations FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
--;;
CREATE TRIGGER learning_seasons_refresh_unified_search AFTER INSERT OR DELETE OR UPDATE ON learning.seasons FOR EACH STATEMENT EXECUTE FUNCTION private.refresh_unified_search_index_trigger();
--;;
CREATE TRIGGER learning_seasons_set_updated_at BEFORE UPDATE ON learning.seasons FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
--;;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON media.locales FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
--;;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON media.localized_texts FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
--;;
CREATE TRIGGER media_media_assets_refresh_unified_search AFTER INSERT OR DELETE OR UPDATE ON media.media_assets FOR EACH STATEMENT EXECUTE FUNCTION private.refresh_unified_search_index_trigger();
--;;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON media.media_assets FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
--;;
CREATE TRIGGER media_processing_jobs_set_updated_at BEFORE UPDATE ON media.media_processing_jobs FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
--;;
CREATE TRIGGER media_processing_jobs_wake_on_insert AFTER INSERT ON media.media_processing_jobs REFERENCING NEW TABLE AS changed_jobs FOR EACH STATEMENT EXECUTE FUNCTION private.wake_media_processor();
--;;
CREATE TRIGGER media_processing_jobs_wake_on_update AFTER UPDATE ON media.media_processing_jobs REFERENCING NEW TABLE AS changed_jobs FOR EACH STATEMENT EXECUTE FUNCTION private.wake_media_processor();
--;;
CREATE TRIGGER notify_processing_failure AFTER INSERT OR UPDATE OF status ON media.media_processing_jobs FOR EACH ROW EXECUTE FUNCTION private.notify_processing_failure();
--;;
CREATE TRIGGER search_aliases_normalize BEFORE INSERT OR UPDATE OF alias ON media.search_aliases FOR EACH ROW EXECUTE FUNCTION private.normalize_search_alias_trigger();
--;;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON media.search_aliases FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
--;;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON media.search_documents FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
--;;
CREATE TRIGGER submission_items_set_updated_at BEFORE UPDATE ON media.submission_items FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
--;;
CREATE TRIGGER notify_submission_status AFTER INSERT OR UPDATE OF status ON media.submissions FOR EACH ROW EXECUTE FUNCTION private.notify_submission_status();
--;;
CREATE TRIGGER submissions_set_updated_at BEFORE UPDATE ON media.submissions FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
--;;
CREATE TRIGGER upload_intents_set_updated_at BEFORE UPDATE ON media.upload_intents FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
--;;
CREATE TRIGGER artist_localizations_set_updated_at BEFORE UPDATE ON music.artist_localizations FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
--;;
CREATE TRIGGER music_artist_localizations_refresh_unified_search AFTER INSERT OR DELETE OR UPDATE ON music.artist_localizations FOR EACH STATEMENT EXECUTE FUNCTION private.refresh_unified_search_index_trigger();
--;;
CREATE TRIGGER artist_memberships_set_updated_at BEFORE UPDATE ON music.artist_memberships FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
--;;
CREATE TRIGGER artists_set_updated_at BEFORE UPDATE ON music.artists FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
--;;
CREATE TRIGGER music_artist_publish_profile_image AFTER INSERT OR UPDATE OF profile_image_asset_id, publication_status ON music.artists FOR EACH ROW EXECUTE FUNCTION private.publish_public_profile_image();
--;;
CREATE TRIGGER music_artist_sync_learning_cantor_image AFTER INSERT OR UPDATE OF profile_image_asset_id, display_name ON music.artists FOR EACH ROW EXECUTE FUNCTION private.sync_music_artist_image_to_learning_cantor();
--;;
CREATE TRIGGER music_artists_refresh_unified_search AFTER INSERT OR DELETE OR UPDATE ON music.artists FOR EACH STATEMENT EXECUTE FUNCTION private.refresh_unified_search_index_trigger();
--;;
CREATE TRIGGER sync_canonical_artist_to_learning AFTER UPDATE OF display_name, profile_image_asset_id, publication_status, owner_creator_account_id ON music.artists FOR EACH ROW WHEN (((old.display_name IS DISTINCT FROM new.display_name) OR (old.profile_image_asset_id IS DISTINCT FROM new.profile_image_asset_id) OR (old.publication_status IS DISTINCT FROM new.publication_status) OR (old.owner_creator_account_id IS DISTINCT FROM new.owner_creator_account_id))) EXECUTE FUNCTION private.sync_learning_artist_identity();
--;;
CREATE TRIGGER lyric_edit_drafts_set_updated_at BEFORE UPDATE ON music.lyric_edit_drafts FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
--;;
CREATE TRIGGER lyric_lines_set_updated_at BEFORE UPDATE ON music.lyric_lines FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
--;;
CREATE TRIGGER lyric_sets_set_updated_at BEFORE UPDATE ON music.lyric_sets FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
--;;
CREATE TRIGGER lyric_words_set_updated_at BEFORE UPDATE ON music.lyric_words FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
--;;
CREATE TRIGGER playlists_set_updated_at BEFORE UPDATE ON music.playlists FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
--;;
CREATE TRIGGER music_release_localizations_refresh_unified_search AFTER INSERT OR DELETE OR UPDATE ON music.release_localizations FOR EACH STATEMENT EXECUTE FUNCTION private.refresh_unified_search_index_trigger();
--;;
CREATE TRIGGER release_localizations_set_updated_at BEFORE UPDATE ON music.release_localizations FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
--;;
CREATE TRIGGER music_release_tracks_refresh_unified_search AFTER INSERT OR DELETE OR UPDATE ON music.release_tracks FOR EACH STATEMENT EXECUTE FUNCTION private.refresh_unified_search_index_trigger();
--;;
CREATE TRIGGER release_tracks_sync_release_type AFTER INSERT OR DELETE OR UPDATE OF release_id ON music.release_tracks FOR EACH ROW EXECUTE FUNCTION private.sync_music_release_type_trigger();
--;;
CREATE TRIGGER music_release_prepare_artwork_for_publication BEFORE INSERT OR UPDATE OF publication_status ON music.releases FOR EACH ROW EXECUTE FUNCTION private.prepare_music_release_artwork_for_publication();
--;;
CREATE TRIGGER music_release_publish_consumer_dependencies AFTER INSERT OR UPDATE OF publication_status ON music.releases FOR EACH ROW EXECUTE FUNCTION private.on_music_release_publish_consumer_dependencies();
--;;
CREATE TRIGGER music_release_retire_submission_on_delete BEFORE DELETE ON music.releases FOR EACH ROW EXECUTE FUNCTION private.retire_submission_when_music_release_deleted();
--;;
CREATE TRIGGER music_releases_refresh_unified_search AFTER INSERT OR DELETE OR UPDATE ON music.releases FOR EACH STATEMENT EXECUTE FUNCTION private.refresh_unified_search_index_trigger();
--;;
CREATE TRIGGER notify_release_published AFTER INSERT OR UPDATE OF publication_status ON music.releases FOR EACH ROW EXECUTE FUNCTION private.notify_release_published();
--;;
CREATE TRIGGER releases_enforce_identity_artist BEFORE INSERT OR UPDATE OF owner_creator_account_id, primary_artist_id ON music.releases FOR EACH ROW EXECUTE FUNCTION private.enforce_release_identity_artist();
--;;
CREATE TRIGGER releases_enforce_scheduling_window BEFORE INSERT OR UPDATE OF scheduled_release_at ON music.releases FOR EACH ROW EXECUTE FUNCTION private.enforce_release_scheduling_window();
--;;
CREATE TRIGGER releases_set_updated_at BEFORE UPDATE ON music.releases FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
--;;
CREATE TRIGGER music_track_artists_refresh_unified_search AFTER INSERT OR DELETE OR UPDATE ON music.track_artists FOR EACH STATEMENT EXECUTE FUNCTION private.refresh_unified_search_index_trigger();
--;;
CREATE TRIGGER music_track_localizations_refresh_unified_search AFTER INSERT OR DELETE OR UPDATE ON music.track_localizations FOR EACH STATEMENT EXECUTE FUNCTION private.refresh_unified_search_index_trigger();
--;;
CREATE TRIGGER track_localizations_set_updated_at BEFORE UPDATE ON music.track_localizations FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
--;;
CREATE TRIGGER music_tracks_refresh_unified_search AFTER INSERT OR DELETE OR UPDATE ON music.tracks FOR EACH STATEMENT EXECUTE FUNCTION private.refresh_unified_search_index_trigger();
--;;
CREATE TRIGGER tracks_set_updated_at BEFORE UPDATE ON music.tracks FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
--;;
CREATE TRIGGER bible_highlights_set_updated_at BEFORE UPDATE ON public.bible_highlights FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
--;;
CREATE TRIGGER chc_offline_dirty_d90404d8494cc509 AFTER INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.hymn_texts FOR EACH STATEMENT EXECUTE FUNCTION offline_content.mark_resource_dirty();
--;;
CREATE TRIGGER offline_content_change AFTER INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.hymn_texts FOR EACH STATEMENT EXECUTE FUNCTION offline_content.note_content_change();
--;;
CREATE TRIGGER chc_offline_dirty_9e681d176a32b6b4 AFTER INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.hymn_titles FOR EACH STATEMENT EXECUTE FUNCTION offline_content.mark_resource_dirty();
--;;
CREATE TRIGGER offline_content_change AFTER INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.hymn_titles FOR EACH STATEMENT EXECUTE FUNCTION offline_content.note_content_change();
--;;
CREATE TRIGGER chc_offline_dirty_bebc7d7aab73f8ba AFTER INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.saint_order FOR EACH STATEMENT EXECUTE FUNCTION offline_content.mark_resource_dirty();
--;;
CREATE TRIGGER offline_content_change AFTER INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.saint_order FOR EACH STATEMENT EXECUTE FUNCTION offline_content.note_content_change();
--;;
CREATE TRIGGER sermon_plans_set_updated_at BEFORE UPDATE ON public.sermon_plans FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
--;;
CREATE TRIGGER spiritual_canon_days_set_updated_at BEFORE UPDATE ON public.spiritual_canon_days FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
--;;
CREATE TRIGGER spiritual_canons_set_updated_at BEFORE UPDATE ON public.spiritual_canons FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
--;;
alter table creator.creator_account_members enable row level security;
--;;
alter table creator.creator_accounts enable row level security;
--;;
alter table creator.profiles enable row level security;
--;;
alter table creator.user_roles enable row level security;
--;;
alter table learning.album_localizations enable row level security;
--;;
alter table learning.album_recordings enable row level security;
--;;
alter table learning.albums enable row level security;
--;;
alter table learning.cantor_localizations enable row level security;
--;;
alter table learning.cantor_permissions enable row level security;
--;;
alter table learning.cantors enable row level security;
--;;
alter table learning.hymn_localizations enable row level security;
--;;
alter table learning.hymn_progress enable row level security;
--;;
alter table learning.hymn_relationships enable row level security;
--;;
alter table learning.hymn_seasons enable row level security;
--;;
alter table learning.hymns enable row level security;
--;;
alter table learning.item_likes enable row level security;
--;;
alter table learning.item_progress enable row level security;
--;;
alter table learning.lesson_localizations enable row level security;
--;;
alter table learning.lesson_set_localizations enable row level security;
--;;
alter table learning.lesson_sets enable row level security;
--;;
alter table learning.lessons enable row level security;
--;;
alter table learning.lyric_edit_drafts enable row level security;
--;;
alter table learning.lyric_lines enable row level security;
--;;
alter table learning.lyric_sets enable row level security;
--;;
alter table learning.playlist_items enable row level security;
--;;
alter table learning.playlists enable row level security;
--;;
alter table learning.recording_localizations enable row level security;
--;;
alter table learning.season_localizations enable row level security;
--;;
alter table learning.seasons enable row level security;
--;;
alter table media.locales enable row level security;
--;;
alter table media.localized_texts enable row level security;
--;;
alter table media.media_asset_versions enable row level security;
--;;
alter table media.media_assets enable row level security;
--;;
alter table media.media_processing_jobs enable row level security;
--;;
alter table media.search_aliases enable row level security;
--;;
alter table media.search_documents enable row level security;
--;;
alter table media.submission_events enable row level security;
--;;
alter table media.submission_items enable row level security;
--;;
alter table media.submissions enable row level security;
--;;
alter table media.upload_intents enable row level security;
--;;
alter table music.artist_follows enable row level security;
--;;
alter table music.artist_localizations enable row level security;
--;;
alter table music.artist_memberships enable row level security;
--;;
alter table music.artist_pinned_releases enable row level security;
--;;
alter table music.artist_social_links enable row level security;
--;;
alter table music.artists enable row level security;
--;;
alter table music.lyric_edit_drafts enable row level security;
--;;
alter table music.lyric_lines enable row level security;
--;;
alter table music.lyric_sets enable row level security;
--;;
alter table music.lyric_words enable row level security;
--;;
alter table music.play_history enable row level security;
--;;
alter table music.playlist_tracks enable row level security;
--;;
alter table music.playlists enable row level security;
--;;
alter table music.release_likes enable row level security;
--;;
alter table music.release_localizations enable row level security;
--;;
alter table music.release_tracks enable row level security;
--;;
alter table music.releases enable row level security;
--;;
alter table music.track_artists enable row level security;
--;;
alter table music.track_likes enable row level security;
--;;
alter table music.track_localizations enable row level security;
--;;
alter table music.tracks enable row level security;
--;;
alter table public.bible_highlights enable row level security;
--;;
alter table public.hymn_texts enable row level security;
--;;
alter table public.hymn_titles enable row level security;
--;;
alter table public.notification_broadcasts enable row level security;
--;;
alter table public.notification_devices enable row level security;
--;;
alter table public.notification_preferences enable row level security;
--;;
alter table public.notifications enable row level security;
--;;
alter table public.saint_order enable row level security;
--;;
alter table public.sermon_plans enable row level security;
--;;
alter table public.spiritual_canon_days enable row level security;
--;;
alter table public.spiritual_canons enable row level security;
--;;
alter table public.user_content_preferences enable row level security;
--;;
create policy creator_account_members_delete_manager_or_admin on creator.creator_account_members as PERMISSIVE for DELETE to authenticated using (( SELECT private.can_manage_creator_account(creator_account_members.creator_account_id) AS can_manage_creator_account));
--;;
create policy creator_account_members_insert_manager_or_bootstrap_owner on creator.creator_account_members as PERMISSIVE for INSERT to authenticated with check ((( SELECT private.can_manage_creator_account(creator_account_members.creator_account_id) AS can_manage_creator_account) OR ((role = 'owner'::creator.creator_account_role) AND (user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT private.created_creator_account(creator_account_members.creator_account_id) AS created_creator_account))));
--;;
create policy creator_account_members_select_member_or_admin on creator.creator_account_members as PERMISSIVE for SELECT to authenticated using ((( SELECT private.is_admin() AS is_admin) OR ( SELECT private.is_creator_account_member(creator_account_members.creator_account_id) AS is_creator_account_member)));
--;;
create policy creator_account_members_update_manager_or_admin on creator.creator_account_members as PERMISSIVE for UPDATE to authenticated using (( SELECT private.can_manage_creator_account(creator_account_members.creator_account_id) AS can_manage_creator_account)) with check (( SELECT private.can_manage_creator_account(creator_account_members.creator_account_id) AS can_manage_creator_account));
--;;
create policy creator_accounts_insert_creator_or_admin on creator.creator_accounts as PERMISSIVE for INSERT to authenticated with check (((created_by = ( SELECT auth.uid() AS uid)) AND (( SELECT private.has_app_role('creator'::creator.app_role) AS has_app_role) OR ( SELECT private.is_admin() AS is_admin))));
--;;
create policy creator_accounts_select_member_or_admin on creator.creator_accounts as PERMISSIVE for SELECT to authenticated using ((( SELECT private.is_admin() AS is_admin) OR ( SELECT private.is_creator_account_member(creator_accounts.id) AS is_creator_account_member)));
--;;
create policy creator_accounts_update_manager_or_admin on creator.creator_accounts as PERMISSIVE for UPDATE to authenticated using (( SELECT private.can_manage_creator_account(creator_accounts.id) AS can_manage_creator_account)) with check (( SELECT private.can_manage_creator_account(creator_accounts.id) AS can_manage_creator_account));
--;;
create policy profiles_insert_self on creator.profiles as PERMISSIVE for INSERT to authenticated with check ((id = ( SELECT auth.uid() AS uid)));
--;;
create policy profiles_select_own_or_admin on creator.profiles as PERMISSIVE for SELECT to authenticated using (((id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.is_admin() AS is_admin)));
--;;
create policy profiles_update_own_or_admin on creator.profiles as PERMISSIVE for UPDATE to authenticated using (((id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.is_admin() AS is_admin))) with check (((id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.is_admin() AS is_admin)));
--;;
create policy user_roles_delete_admin on creator.user_roles as PERMISSIVE for DELETE to authenticated using (( SELECT private.is_admin() AS is_admin));
--;;
create policy user_roles_insert_admin on creator.user_roles as PERMISSIVE for INSERT to authenticated with check (( SELECT private.is_admin() AS is_admin));
--;;
create policy user_roles_select_own_or_admin on creator.user_roles as PERMISSIVE for SELECT to authenticated using (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.is_admin() AS is_admin)));
--;;
create policy user_roles_update_admin on creator.user_roles as PERMISSIVE for UPDATE to authenticated using (( SELECT private.is_admin() AS is_admin)) with check (( SELECT private.is_admin() AS is_admin));
--;;
create policy learning_album_localizations_select on learning.album_localizations as PERMISSIVE for SELECT to public using (private.learning_album_is_visible(album_id));
--;;
create policy learning_album_localizations_write on learning.album_localizations as PERMISSIVE for ALL to authenticated using (private.learning_album_is_editable(album_id)) with check (private.learning_album_is_editable(album_id));
--;;
create policy learning_recordings_select on learning.album_recordings as PERMISSIVE for SELECT to public using ((private.learning_album_is_visible(album_id) AND private.learning_album_child_is_visible(album_id, publication_status)));
--;;
create policy learning_recordings_write on learning.album_recordings as PERMISSIVE for ALL to authenticated using (private.learning_album_is_editable(album_id)) with check (private.learning_album_is_editable(album_id));
--;;
create policy learning_albums_delete on learning.albums as PERMISSIVE for DELETE to authenticated using ((private.is_admin() OR (private.learning_album_is_editable(id) AND (publication_status = 'draft'::media.publication_status))));
--;;
create policy learning_albums_insert on learning.albums as PERMISSIVE for INSERT to authenticated with check ((private.is_admin() OR ((owner_creator_account_id IS NOT NULL) AND private.can_edit_creator_account(owner_creator_account_id)) OR private.learning_cantor_is_editable(cantor_id)));
--;;
create policy learning_albums_select on learning.albums as PERMISSIVE for SELECT to public using (private.learning_album_is_visible(id));
--;;
create policy learning_albums_update on learning.albums as PERMISSIVE for UPDATE to authenticated using (private.learning_album_is_editable(id)) with check ((private.is_admin() OR private.learning_publication_is_creator_mutable(publication_status)));
--;;
create policy learning_cantor_localizations_select on learning.cantor_localizations as PERMISSIVE for SELECT to public using (private.learning_cantor_is_visible(cantor_id));
--;;
create policy learning_cantor_localizations_write on learning.cantor_localizations as PERMISSIVE for ALL to authenticated using (private.learning_cantor_is_editable(cantor_id)) with check (private.learning_cantor_is_editable(cantor_id));
--;;
create policy learning_cantor_permissions_select on learning.cantor_permissions as PERMISSIVE for SELECT to authenticated using (private.learning_cantor_is_editable(cantor_id));
--;;
create policy learning_cantor_permissions_write on learning.cantor_permissions as PERMISSIVE for ALL to authenticated using (private.learning_cantor_is_editable(cantor_id)) with check (private.learning_cantor_is_editable(cantor_id));
--;;
create policy learning_cantors_delete on learning.cantors as PERMISSIVE for DELETE to authenticated using ((private.is_admin() OR (private.learning_cantor_is_editable(id) AND (publication_status = 'draft'::media.publication_status))));
--;;
create policy learning_cantors_insert on learning.cantors as PERMISSIVE for INSERT to authenticated with check ((private.is_admin() OR ((owner_creator_account_id IS NOT NULL) AND private.can_edit_creator_account(owner_creator_account_id))));
--;;
create policy learning_cantors_select on learning.cantors as PERMISSIVE for SELECT to public using (private.learning_cantor_is_visible(id));
--;;
create policy learning_cantors_update on learning.cantors as PERMISSIVE for UPDATE to authenticated using (private.learning_cantor_is_editable(id)) with check ((private.is_admin() OR private.learning_publication_is_creator_mutable(publication_status)));
--;;
create policy learning_hymn_localizations_admin_write on learning.hymn_localizations as PERMISSIVE for ALL to authenticated using (private.is_admin()) with check (private.is_admin());
--;;
create policy learning_hymn_localizations_select on learning.hymn_localizations as PERMISSIVE for SELECT to public using ((EXISTS ( SELECT 1
   FROM learning.hymns h
  WHERE ((h.id = hymn_localizations.hymn_id) AND private.learning_published_or_admin(h.publication_status)))));
--;;
create policy learning_progress_delete on learning.hymn_progress as PERMISSIVE for DELETE to authenticated using ((user_id = auth.uid()));
--;;
create policy learning_progress_insert on learning.hymn_progress as PERMISSIVE for INSERT to authenticated with check ((user_id = auth.uid()));
--;;
create policy learning_progress_select on learning.hymn_progress as PERMISSIVE for SELECT to authenticated using ((user_id = auth.uid()));
--;;
create policy learning_progress_update on learning.hymn_progress as PERMISSIVE for UPDATE to authenticated using ((user_id = auth.uid())) with check ((user_id = auth.uid()));
--;;
create policy learning_hymn_relationships_admin_write on learning.hymn_relationships as PERMISSIVE for ALL to authenticated using (private.is_admin()) with check (private.is_admin());
--;;
create policy learning_hymn_relationships_select on learning.hymn_relationships as PERMISSIVE for SELECT to public using ((((EXISTS ( SELECT 1
   FROM learning.hymns h
  WHERE ((h.id = hymn_relationships.hymn_id) AND (h.publication_status = 'published'::media.publication_status)))) AND (EXISTS ( SELECT 1
   FROM learning.hymns h
  WHERE ((h.id = hymn_relationships.related_hymn_id) AND (h.publication_status = 'published'::media.publication_status))))) OR private.learning_published_or_admin('draft'::media.publication_status)));
--;;
create policy learning_hymn_seasons_admin_write on learning.hymn_seasons as PERMISSIVE for ALL to authenticated using (private.is_admin()) with check (private.is_admin());
--;;
create policy learning_hymn_seasons_select on learning.hymn_seasons as PERMISSIVE for SELECT to public using ((((EXISTS ( SELECT 1
   FROM learning.hymns h
  WHERE ((h.id = hymn_seasons.hymn_id) AND (h.publication_status = 'published'::media.publication_status)))) AND (EXISTS ( SELECT 1
   FROM learning.seasons s
  WHERE ((s.id = hymn_seasons.season_id) AND (s.publication_status = 'published'::media.publication_status))))) OR private.learning_published_or_admin('draft'::media.publication_status)));
--;;
create policy learning_hymns_admin_write on learning.hymns as PERMISSIVE for ALL to authenticated using (private.is_admin()) with check (private.is_admin());
--;;
create policy learning_hymns_select on learning.hymns as PERMISSIVE for SELECT to public using (private.learning_published_or_admin(publication_status));
--;;
create policy learning_item_likes_own on learning.item_likes as PERMISSIVE for ALL to authenticated using ((user_id = ( SELECT auth.uid() AS uid))) with check ((user_id = ( SELECT auth.uid() AS uid)));
--;;
create policy learning_item_progress_own on learning.item_progress as PERMISSIVE for ALL to authenticated using ((user_id = ( SELECT auth.uid() AS uid))) with check ((user_id = ( SELECT auth.uid() AS uid)));
--;;
create policy learning_lesson_localizations_select on learning.lesson_localizations as PERMISSIVE for SELECT to public using ((EXISTS ( SELECT 1
   FROM learning.lessons l
  WHERE ((l.id = lesson_localizations.lesson_id) AND private.learning_lesson_set_is_visible(l.lesson_set_id)))));
--;;
create policy learning_lesson_localizations_write on learning.lesson_localizations as PERMISSIVE for ALL to authenticated using ((EXISTS ( SELECT 1
   FROM learning.lessons l
  WHERE ((l.id = lesson_localizations.lesson_id) AND private.learning_lesson_set_is_editable(l.lesson_set_id))))) with check ((EXISTS ( SELECT 1
   FROM learning.lessons l
  WHERE ((l.id = lesson_localizations.lesson_id) AND private.learning_lesson_set_is_editable(l.lesson_set_id)))));
--;;
create policy learning_lesson_set_localizations_select on learning.lesson_set_localizations as PERMISSIVE for SELECT to public using (private.learning_lesson_set_is_visible(lesson_set_id));
--;;
create policy learning_lesson_set_localizations_write on learning.lesson_set_localizations as PERMISSIVE for ALL to authenticated using (private.learning_lesson_set_is_editable(lesson_set_id)) with check (private.learning_lesson_set_is_editable(lesson_set_id));
--;;
create policy learning_lesson_sets_delete on learning.lesson_sets as PERMISSIVE for DELETE to authenticated using ((private.is_admin() OR (private.learning_lesson_set_is_editable(id) AND (publication_status = 'draft'::media.publication_status))));
--;;
create policy learning_lesson_sets_insert on learning.lesson_sets as PERMISSIVE for INSERT to authenticated with check ((private.is_admin() OR ((owner_creator_account_id IS NOT NULL) AND private.can_edit_creator_account(owner_creator_account_id)) OR private.learning_cantor_is_editable(cantor_id)));
--;;
create policy learning_lesson_sets_select on learning.lesson_sets as PERMISSIVE for SELECT to public using (private.learning_lesson_set_is_visible(id));
--;;
create policy learning_lesson_sets_update on learning.lesson_sets as PERMISSIVE for UPDATE to authenticated using (private.learning_lesson_set_is_editable(id)) with check ((private.is_admin() OR private.learning_publication_is_creator_mutable(publication_status)));
--;;
create policy learning_lessons_select on learning.lessons as PERMISSIVE for SELECT to public using ((private.learning_lesson_set_is_visible(lesson_set_id) AND private.learning_lesson_child_is_visible(lesson_set_id, publication_status)));
--;;
create policy learning_lessons_write on learning.lessons as PERMISSIVE for ALL to authenticated using (private.learning_lesson_set_is_editable(lesson_set_id)) with check (private.learning_lesson_set_is_editable(lesson_set_id));
--;;
create policy learning_lyric_drafts_write on learning.lyric_edit_drafts as PERMISSIVE for ALL to authenticated using (private.learning_lyric_item_is_editable(item_kind, COALESCE(album_recording_id, lesson_id))) with check (private.learning_lyric_item_is_editable(item_kind, COALESCE(album_recording_id, lesson_id)));
--;;
create policy learning_lyric_lines_select on learning.lyric_lines as PERMISSIVE for SELECT to public using ((EXISTS ( SELECT 1
   FROM learning.lyric_sets s
  WHERE (s.id = lyric_lines.lyric_set_id))));
--;;
create policy learning_lyric_lines_write on learning.lyric_lines as PERMISSIVE for ALL to authenticated using ((EXISTS ( SELECT 1
   FROM learning.lyric_sets s
  WHERE ((s.id = lyric_lines.lyric_set_id) AND private.learning_lyric_item_is_editable(s.item_kind, COALESCE(s.album_recording_id, s.lesson_id)))))) with check ((EXISTS ( SELECT 1
   FROM learning.lyric_sets s
  WHERE ((s.id = lyric_lines.lyric_set_id) AND private.learning_lyric_item_is_editable(s.item_kind, COALESCE(s.album_recording_id, s.lesson_id))))));
--;;
create policy learning_lyric_sets_delete on learning.lyric_sets as PERMISSIVE for DELETE to authenticated using (private.learning_lyric_item_is_editable(item_kind, COALESCE(album_recording_id, lesson_id)));
--;;
create policy learning_lyric_sets_insert on learning.lyric_sets as PERMISSIVE for INSERT to authenticated with check (private.learning_lyric_item_is_editable(item_kind, COALESCE(album_recording_id, lesson_id)));
--;;
create policy learning_lyric_sets_select on learning.lyric_sets as PERMISSIVE for SELECT to public using (((publication_status = 'published'::media.publication_status) OR private.learning_lyric_item_is_editable(item_kind, COALESCE(album_recording_id, lesson_id))));
--;;
create policy learning_lyric_sets_update on learning.lyric_sets as PERMISSIVE for UPDATE to authenticated using (private.learning_lyric_item_is_editable(item_kind, COALESCE(album_recording_id, lesson_id))) with check (private.learning_lyric_item_is_editable(item_kind, COALESCE(album_recording_id, lesson_id)));
--;;
create policy learning_playlist_items_delete on learning.playlist_items as PERMISSIVE for DELETE to authenticated using ((EXISTS ( SELECT 1
   FROM learning.playlists playlist
  WHERE ((playlist.id = playlist_items.playlist_id) AND (playlist.owner_user_id = ( SELECT auth.uid() AS uid))))));
--;;
create policy learning_playlist_items_insert on learning.playlist_items as PERMISSIVE for INSERT to authenticated with check ((EXISTS ( SELECT 1
   FROM learning.playlists playlist
  WHERE ((playlist.id = playlist_items.playlist_id) AND (playlist.owner_user_id = ( SELECT auth.uid() AS uid))))));
--;;
create policy learning_playlist_items_select on learning.playlist_items as PERMISSIVE for SELECT to public using ((EXISTS ( SELECT 1
   FROM learning.playlists playlist
  WHERE ((playlist.id = playlist_items.playlist_id) AND ((playlist.owner_user_id = ( SELECT auth.uid() AS uid)) OR (playlist.visibility = ANY (ARRAY['unlisted'::learning.playlist_visibility, 'public'::learning.playlist_visibility])))))));
--;;
create policy learning_playlist_items_update on learning.playlist_items as PERMISSIVE for UPDATE to authenticated using ((EXISTS ( SELECT 1
   FROM learning.playlists playlist
  WHERE ((playlist.id = playlist_items.playlist_id) AND (playlist.owner_user_id = ( SELECT auth.uid() AS uid)))))) with check ((EXISTS ( SELECT 1
   FROM learning.playlists playlist
  WHERE ((playlist.id = playlist_items.playlist_id) AND (playlist.owner_user_id = ( SELECT auth.uid() AS uid))))));
--;;
create policy learning_playlists_delete on learning.playlists as PERMISSIVE for DELETE to authenticated using ((owner_user_id = ( SELECT auth.uid() AS uid)));
--;;
create policy learning_playlists_insert on learning.playlists as PERMISSIVE for INSERT to authenticated with check ((owner_user_id = ( SELECT auth.uid() AS uid)));
--;;
create policy learning_playlists_select on learning.playlists as PERMISSIVE for SELECT to public using (((owner_user_id = ( SELECT auth.uid() AS uid)) OR (visibility = ANY (ARRAY['unlisted'::learning.playlist_visibility, 'public'::learning.playlist_visibility]))));
--;;
create policy learning_playlists_update on learning.playlists as PERMISSIVE for UPDATE to authenticated using ((owner_user_id = ( SELECT auth.uid() AS uid))) with check ((owner_user_id = ( SELECT auth.uid() AS uid)));
--;;
create policy learning_recording_localizations_write on learning.recording_localizations as PERMISSIVE for ALL to authenticated using ((EXISTS ( SELECT 1
   FROM learning.album_recordings r
  WHERE ((r.id = recording_localizations.recording_id) AND private.learning_album_is_editable(r.album_id))))) with check ((EXISTS ( SELECT 1
   FROM learning.album_recordings r
  WHERE ((r.id = recording_localizations.recording_id) AND private.learning_album_is_editable(r.album_id)))));
--;;
create policy learning_recording_localizations_select on learning.recording_localizations as PERMISSIVE for SELECT to public using ((EXISTS ( SELECT 1
   FROM learning.album_recordings r
  WHERE ((r.id = recording_localizations.recording_id) AND private.learning_album_is_visible(r.album_id)))));
--;;
create policy learning_season_localizations_admin_write on learning.season_localizations as PERMISSIVE for ALL to authenticated using (private.is_admin()) with check (private.is_admin());
--;;
create policy learning_season_localizations_select on learning.season_localizations as PERMISSIVE for SELECT to public using ((EXISTS ( SELECT 1
   FROM learning.seasons s
  WHERE ((s.id = season_localizations.season_id) AND private.learning_published_or_admin(s.publication_status)))));
--;;
create policy learning_seasons_admin_write on learning.seasons as PERMISSIVE for ALL to authenticated using (private.is_admin()) with check (private.is_admin());
--;;
create policy learning_seasons_select on learning.seasons as PERMISSIVE for SELECT to public using (private.learning_published_or_admin(publication_status));
--;;
create policy locales_select_enabled on media.locales as PERMISSIVE for SELECT to anon, authenticated using ((enabled = true));
--;;
create policy localized_texts_insert_owner_or_admin on media.localized_texts as PERMISSIVE for INSERT to authenticated with check (( SELECT private.can_edit_creator_account(localized_texts.owner_creator_account_id) AS can_edit_creator_account));
--;;
create policy localized_texts_select_published_or_owner on media.localized_texts as PERMISSIVE for SELECT to anon, authenticated using (((publication_status = 'published'::media.publication_status) OR ( SELECT private.can_read_media_owner(localized_texts.owner_creator_account_id) AS can_read_media_owner)));
--;;
create policy localized_texts_update_owner_or_admin on media.localized_texts as PERMISSIVE for UPDATE to authenticated using (( SELECT private.can_edit_creator_account(localized_texts.owner_creator_account_id) AS can_edit_creator_account)) with check (( SELECT private.can_edit_creator_account(localized_texts.owner_creator_account_id) AS can_edit_creator_account));
--;;
create policy media_asset_versions_insert_editable_asset on media.media_asset_versions as PERMISSIVE for INSERT to authenticated with check (( SELECT private.media_asset_is_editable(media_asset_versions.media_asset_id) AS media_asset_is_editable));
--;;
create policy media_asset_versions_select_visible_asset on media.media_asset_versions as PERMISSIVE for SELECT to anon, authenticated using (( SELECT private.media_asset_is_visible(media_asset_versions.media_asset_id) AS media_asset_is_visible));
--;;
create policy media_asset_versions_update_editable_asset on media.media_asset_versions as PERMISSIVE for UPDATE to authenticated using (( SELECT private.media_asset_is_editable(media_asset_versions.media_asset_id) AS media_asset_is_editable)) with check (( SELECT private.media_asset_is_editable(media_asset_versions.media_asset_id) AS media_asset_is_editable));
--;;
create policy media_assets_insert_owner_or_admin on media.media_assets as PERMISSIVE for INSERT to authenticated with check ((( SELECT private.can_edit_creator_account(media_assets.owner_creator_account_id) AS can_edit_creator_account) OR ((provider = 'external'::media.media_provider) AND (bucket = 'playlist-covers'::text) AND (media_type = 'image'::media.media_type) AND (owner_creator_account_id IS NULL) AND (created_by = ( SELECT auth.uid() AS uid)) AND (updated_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM music.playlists playlist
  WHERE (((playlist.id)::text = (media_assets.metadata ->> 'playlistId'::text)) AND (playlist.owner_user_id = ( SELECT auth.uid() AS uid))))) AND (path = (((((regexp_replace(( SELECT (auth.jwt() ->> 'iss'::text)), '/auth/v1/?$'::text, ''::text) || '/storage/v1/object/public/playlist-covers/'::text) || (( SELECT auth.uid() AS uid))::text) || '/'::text) || (metadata ->> 'playlistId'::text)) || '/cover'::text)))));
--;;
create policy media_assets_select_published_or_owner on media.media_assets as PERMISSIVE for SELECT to anon, authenticated using (((publication_status = 'published'::media.publication_status) OR ( SELECT private.can_read_media_owner(media_assets.owner_creator_account_id) AS can_read_media_owner) OR ((provider = 'external'::media.media_provider) AND (bucket = 'playlist-covers'::text) AND (owner_creator_account_id IS NULL) AND (created_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM music.playlists playlist
  WHERE (((playlist.id)::text = (media_assets.metadata ->> 'playlistId'::text)) AND (playlist.owner_user_id = ( SELECT auth.uid() AS uid))))))));
--;;
create policy media_assets_update_owner_or_admin on media.media_assets as PERMISSIVE for UPDATE to authenticated using ((( SELECT private.can_edit_creator_account(media_assets.owner_creator_account_id) AS can_edit_creator_account) OR ((provider = 'external'::media.media_provider) AND (bucket = 'playlist-covers'::text) AND (owner_creator_account_id IS NULL) AND (created_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM music.playlists playlist
  WHERE (((playlist.id)::text = (media_assets.metadata ->> 'playlistId'::text)) AND (playlist.owner_user_id = ( SELECT auth.uid() AS uid)))))))) with check ((( SELECT private.can_edit_creator_account(media_assets.owner_creator_account_id) AS can_edit_creator_account) OR ((provider = 'external'::media.media_provider) AND (bucket = 'playlist-covers'::text) AND (media_type = 'image'::media.media_type) AND (owner_creator_account_id IS NULL) AND (created_by = ( SELECT auth.uid() AS uid)) AND (updated_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM music.playlists playlist
  WHERE (((playlist.id)::text = (media_assets.metadata ->> 'playlistId'::text)) AND (playlist.owner_user_id = ( SELECT auth.uid() AS uid))))) AND (path = (((((regexp_replace(( SELECT (auth.jwt() ->> 'iss'::text)), '/auth/v1/?$'::text, ''::text) || '/storage/v1/object/public/playlist-covers/'::text) || (( SELECT auth.uid() AS uid))::text) || '/'::text) || (metadata ->> 'playlistId'::text)) || '/cover'::text)))));
--;;
create policy media_processing_jobs_select_creator on media.media_processing_jobs as PERMISSIVE for SELECT to authenticated using (((EXISTS ( SELECT 1
   FROM media.upload_intents intent
  WHERE ((intent.id = media_processing_jobs.upload_intent_id) AND ((intent.requested_by = ( SELECT auth.uid() AS uid)) OR ( SELECT private.can_read_media_owner(intent.creator_account_id) AS can_read_media_owner))))) OR (EXISTS ( SELECT 1
   FROM media.media_assets asset
  WHERE ((asset.id = media_processing_jobs.media_asset_id) AND ( SELECT private.can_read_media_owner(asset.owner_creator_account_id) AS can_read_media_owner))))));
--;;
create policy search_aliases_insert_owner_or_admin on media.search_aliases as PERMISSIVE for INSERT to authenticated with check (( SELECT private.can_edit_creator_account(search_aliases.owner_creator_account_id) AS can_edit_creator_account));
--;;
create policy search_aliases_select_published_or_owner on media.search_aliases as PERMISSIVE for SELECT to anon, authenticated using (((publication_status = 'published'::media.publication_status) OR ( SELECT private.can_read_media_owner(search_aliases.owner_creator_account_id) AS can_read_media_owner)));
--;;
create policy search_aliases_update_owner_or_admin on media.search_aliases as PERMISSIVE for UPDATE to authenticated using (( SELECT private.can_edit_creator_account(search_aliases.owner_creator_account_id) AS can_edit_creator_account)) with check (( SELECT private.can_edit_creator_account(search_aliases.owner_creator_account_id) AS can_edit_creator_account));
--;;
create policy search_documents_insert_owner_or_admin on media.search_documents as PERMISSIVE for INSERT to authenticated with check (( SELECT private.can_edit_creator_account(search_documents.owner_creator_account_id) AS can_edit_creator_account));
--;;
create policy search_documents_select_published_or_owner on media.search_documents as PERMISSIVE for SELECT to anon, authenticated using (((publication_status = 'published'::media.publication_status) OR ( SELECT private.can_read_media_owner(search_documents.owner_creator_account_id) AS can_read_media_owner)));
--;;
create policy search_documents_update_owner_or_admin on media.search_documents as PERMISSIVE for UPDATE to authenticated using (( SELECT private.can_edit_creator_account(search_documents.owner_creator_account_id) AS can_edit_creator_account)) with check (( SELECT private.can_edit_creator_account(search_documents.owner_creator_account_id) AS can_edit_creator_account));
--;;
create policy submission_events_select_submission_reader on media.submission_events as PERMISSIVE for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM media.submissions submission
  WHERE ((submission.id = submission_events.submission_id) AND ( SELECT private.can_read_media_owner(submission.creator_account_id) AS can_read_media_owner)))));
--;;
create policy submission_items_select_submission_reader on media.submission_items as PERMISSIVE for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM media.submissions submission
  WHERE ((submission.id = submission_items.submission_id) AND ( SELECT private.can_read_media_owner(submission.creator_account_id) AS can_read_media_owner)))));
--;;
create policy submissions_select_creator_or_admin on media.submissions as PERMISSIVE for SELECT to authenticated using (( SELECT private.can_read_media_owner(submissions.creator_account_id) AS can_read_media_owner));
--;;
create policy upload_intents_select_requester_or_creator on media.upload_intents as PERMISSIVE for SELECT to authenticated using (((requested_by = ( SELECT auth.uid() AS uid)) OR ( SELECT private.can_read_media_owner(upload_intents.creator_account_id) AS can_read_media_owner)));
--;;
create policy artist_follows_delete_own on music.artist_follows as PERMISSIVE for DELETE to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
--;;
create policy artist_follows_insert_own_published_artist on music.artist_follows as PERMISSIVE for INSERT to authenticated with check (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT private.music_artist_is_visible(artist_follows.artist_id) AS music_artist_is_visible)));
--;;
create policy artist_follows_select_own on music.artist_follows as PERMISSIVE for SELECT to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
--;;
create policy artist_localizations_insert_editable_artist on music.artist_localizations as PERMISSIVE for INSERT to authenticated with check ((( SELECT private.music_artist_is_editable(artist_localizations.artist_id) AS music_artist_is_editable) AND ( SELECT private.music_publication_is_creator_mutable(artist_localizations.publication_status) AS music_publication_is_creator_mutable)));
--;;
create policy artist_localizations_select_visible_artist on music.artist_localizations as PERMISSIVE for SELECT to anon, authenticated using (( SELECT private.music_artist_is_visible(artist_localizations.artist_id) AS music_artist_is_visible));
--;;
create policy artist_localizations_update_editable_artist on music.artist_localizations as PERMISSIVE for UPDATE to authenticated using (( SELECT private.music_artist_is_editable(artist_localizations.artist_id) AS music_artist_is_editable)) with check ((( SELECT private.music_artist_is_editable(artist_localizations.artist_id) AS music_artist_is_editable) AND ( SELECT private.music_publication_is_creator_mutable(artist_localizations.publication_status) AS music_publication_is_creator_mutable)));
--;;
create policy artist_memberships_insert_editable_artist on music.artist_memberships as PERMISSIVE for INSERT to authenticated with check (( SELECT private.music_artist_is_editable(artist_memberships.artist_id) AS music_artist_is_editable));
--;;
create policy artist_memberships_select_visible_artist on music.artist_memberships as PERMISSIVE for SELECT to authenticated using (( SELECT private.music_artist_is_visible(artist_memberships.artist_id) AS music_artist_is_visible));
--;;
create policy artist_memberships_update_editable_artist on music.artist_memberships as PERMISSIVE for UPDATE to authenticated using (( SELECT private.music_artist_is_editable(artist_memberships.artist_id) AS music_artist_is_editable)) with check (( SELECT private.music_artist_is_editable(artist_memberships.artist_id) AS music_artist_is_editable));
--;;
create policy artist_pinned_releases_public_read on music.artist_pinned_releases as PERMISSIVE for SELECT to public using (((EXISTS ( SELECT 1
   FROM music.artists artist
  WHERE ((artist.id = artist_pinned_releases.artist_id) AND (artist.publication_status = 'published'::media.publication_status)))) OR ( SELECT private.is_admin() AS is_admin) OR (EXISTS ( SELECT 1
   FROM music.artists artist
  WHERE ((artist.id = artist_pinned_releases.artist_id) AND (artist.owner_creator_account_id IS NOT NULL) AND ( SELECT private.can_edit_creator_account(artist.owner_creator_account_id) AS can_edit_creator_account))))));
--;;
create policy artist_social_links_public_read on music.artist_social_links as PERMISSIVE for SELECT to public using (((EXISTS ( SELECT 1
   FROM music.artists artist
  WHERE ((artist.id = artist_social_links.artist_id) AND (artist.publication_status = 'published'::media.publication_status)))) OR ( SELECT private.is_admin() AS is_admin) OR (EXISTS ( SELECT 1
   FROM music.artists artist
  WHERE ((artist.id = artist_social_links.artist_id) AND (artist.owner_creator_account_id IS NOT NULL) AND ( SELECT private.can_edit_creator_account(artist.owner_creator_account_id) AS can_edit_creator_account))))));
--;;
create policy artists_insert_creator on music.artists as PERMISSIVE for INSERT to authenticated with check ((( SELECT private.can_edit_creator_account(artists.owner_creator_account_id) AS can_edit_creator_account) AND ( SELECT private.music_publication_is_creator_mutable(artists.publication_status) AS music_publication_is_creator_mutable)));
--;;
create policy artists_select_published_or_owner on music.artists as PERMISSIVE for SELECT to anon, authenticated using (((publication_status = 'published'::media.publication_status) OR ( SELECT private.can_read_media_owner(artists.owner_creator_account_id) AS can_read_media_owner)));
--;;
create policy artists_update_creator on music.artists as PERMISSIVE for UPDATE to authenticated using (( SELECT private.can_edit_creator_account(artists.owner_creator_account_id) AS can_edit_creator_account)) with check ((( SELECT private.can_edit_creator_account(artists.owner_creator_account_id) AS can_edit_creator_account) AND ( SELECT private.music_publication_is_creator_mutable(artists.publication_status) AS music_publication_is_creator_mutable)));
--;;
create policy lyric_edit_drafts_delete_owner on music.lyric_edit_drafts as PERMISSIVE for DELETE to authenticated using (( SELECT private.music_track_is_editable(lyric_edit_drafts.track_id) AS music_track_is_editable));
--;;
create policy lyric_edit_drafts_insert_owner on music.lyric_edit_drafts as PERMISSIVE for INSERT to authenticated with check (( SELECT private.music_track_is_editable(lyric_edit_drafts.track_id) AS music_track_is_editable));
--;;
create policy lyric_edit_drafts_select_owner on music.lyric_edit_drafts as PERMISSIVE for SELECT to authenticated using (( SELECT private.music_track_is_editable(lyric_edit_drafts.track_id) AS music_track_is_editable));
--;;
create policy lyric_edit_drafts_update_owner on music.lyric_edit_drafts as PERMISSIVE for UPDATE to authenticated using (( SELECT private.music_track_is_editable(lyric_edit_drafts.track_id) AS music_track_is_editable)) with check (( SELECT private.music_track_is_editable(lyric_edit_drafts.track_id) AS music_track_is_editable));
--;;
create policy lyric_lines_delete_mutable_set on music.lyric_lines as PERMISSIVE for DELETE to authenticated using (( SELECT private.music_lyric_set_is_mutable(lyric_lines.lyric_set_id) AS music_lyric_set_is_mutable));
--;;
create policy lyric_lines_insert_mutable_set on music.lyric_lines as PERMISSIVE for INSERT to authenticated with check (( SELECT private.music_lyric_set_is_mutable(lyric_lines.lyric_set_id) AS music_lyric_set_is_mutable));
--;;
create policy lyric_lines_select_visible_set on music.lyric_lines as PERMISSIVE for SELECT to anon, authenticated using (( SELECT private.music_lyric_set_is_visible(lyric_lines.lyric_set_id) AS music_lyric_set_is_visible));
--;;
create policy lyric_lines_update_mutable_set on music.lyric_lines as PERMISSIVE for UPDATE to authenticated using (( SELECT private.music_lyric_set_is_mutable(lyric_lines.lyric_set_id) AS music_lyric_set_is_mutable)) with check (( SELECT private.music_lyric_set_is_mutable(lyric_lines.lyric_set_id) AS music_lyric_set_is_mutable));
--;;
create policy lyric_sets_delete_mutable on music.lyric_sets as PERMISSIVE for DELETE to authenticated using (( SELECT private.music_lyric_set_is_mutable(lyric_sets.id) AS music_lyric_set_is_mutable));
--;;
create policy lyric_sets_insert_editable_track on music.lyric_sets as PERMISSIVE for INSERT to authenticated with check ((( SELECT private.music_track_is_editable(lyric_sets.track_id) AS music_track_is_editable) AND ( SELECT private.music_publication_is_creator_mutable(lyric_sets.publication_status) AS music_publication_is_creator_mutable)));
--;;
create policy lyric_sets_select_visible on music.lyric_sets as PERMISSIVE for SELECT to anon, authenticated using (( SELECT private.music_lyric_set_is_visible(lyric_sets.id) AS music_lyric_set_is_visible));
--;;
create policy lyric_sets_update_editable_track on music.lyric_sets as PERMISSIVE for UPDATE to authenticated using (( SELECT private.music_lyric_set_is_editable(lyric_sets.id) AS music_lyric_set_is_editable)) with check ((( SELECT private.music_track_is_editable(lyric_sets.track_id) AS music_track_is_editable) AND ( SELECT private.music_publication_is_creator_mutable(lyric_sets.publication_status) AS music_publication_is_creator_mutable)));
--;;
create policy lyric_words_delete_mutable_line on music.lyric_words as PERMISSIVE for DELETE to authenticated using (( SELECT private.music_lyric_line_is_mutable(lyric_words.lyric_line_id) AS music_lyric_line_is_mutable));
--;;
create policy lyric_words_insert_mutable_line on music.lyric_words as PERMISSIVE for INSERT to authenticated with check (( SELECT private.music_lyric_line_is_mutable(lyric_words.lyric_line_id) AS music_lyric_line_is_mutable));
--;;
create policy lyric_words_select_visible_line on music.lyric_words as PERMISSIVE for SELECT to anon, authenticated using (( SELECT private.music_lyric_line_is_visible(lyric_words.lyric_line_id) AS music_lyric_line_is_visible));
--;;
create policy lyric_words_update_mutable_line on music.lyric_words as PERMISSIVE for UPDATE to authenticated using (( SELECT private.music_lyric_line_is_mutable(lyric_words.lyric_line_id) AS music_lyric_line_is_mutable)) with check (( SELECT private.music_lyric_line_is_mutable(lyric_words.lyric_line_id) AS music_lyric_line_is_mutable));
--;;
create policy play_history_delete_own on music.play_history as PERMISSIVE for DELETE to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
--;;
create policy play_history_insert_own on music.play_history as PERMISSIVE for INSERT to authenticated with check (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT private.music_track_is_visible(play_history.track_id) AS music_track_is_visible)));
--;;
create policy play_history_select_own on music.play_history as PERMISSIVE for SELECT to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
--;;
create policy play_history_update_own on music.play_history as PERMISSIVE for UPDATE to authenticated using ((user_id = ( SELECT auth.uid() AS uid))) with check ((user_id = ( SELECT auth.uid() AS uid)));
--;;
create policy playlist_tracks_delete_editable_playlist on music.playlist_tracks as PERMISSIVE for DELETE to authenticated using (( SELECT private.music_playlist_is_editable(playlist_tracks.playlist_id) AS music_playlist_is_editable));
--;;
create policy playlist_tracks_insert_editable_playlist on music.playlist_tracks as PERMISSIVE for INSERT to authenticated with check ((( SELECT private.music_playlist_is_editable(playlist_tracks.playlist_id) AS music_playlist_is_editable) AND (added_by = ( SELECT auth.uid() AS uid)) AND ( SELECT private.music_track_is_visible(playlist_tracks.track_id) AS music_track_is_visible)));
--;;
create policy playlist_tracks_select_visible_playlist on music.playlist_tracks as PERMISSIVE for SELECT to anon, authenticated using (( SELECT private.music_playlist_is_visible(playlist_tracks.playlist_id) AS music_playlist_is_visible));
--;;
create policy playlist_tracks_update_editable_playlist on music.playlist_tracks as PERMISSIVE for UPDATE to authenticated using (( SELECT private.music_playlist_is_editable(playlist_tracks.playlist_id) AS music_playlist_is_editable)) with check ((( SELECT private.music_playlist_is_editable(playlist_tracks.playlist_id) AS music_playlist_is_editable) AND ( SELECT private.music_track_is_visible(playlist_tracks.track_id) AS music_track_is_visible)));
--;;
create policy playlists_delete_own on music.playlists as PERMISSIVE for DELETE to authenticated using ((owner_user_id = ( SELECT auth.uid() AS uid)));
--;;
create policy playlists_insert_own on music.playlists as PERMISSIVE for INSERT to authenticated with check ((owner_user_id = ( SELECT auth.uid() AS uid)));
--;;
create policy playlists_select_public_or_owner on music.playlists as PERMISSIVE for SELECT to anon, authenticated using (( SELECT private.music_playlist_is_visible(playlists.id) AS music_playlist_is_visible));
--;;
create policy playlists_update_own on music.playlists as PERMISSIVE for UPDATE to authenticated using ((owner_user_id = ( SELECT auth.uid() AS uid))) with check ((owner_user_id = ( SELECT auth.uid() AS uid)));
--;;
create policy release_likes_delete_own on music.release_likes as PERMISSIVE for DELETE to authenticated using ((( SELECT auth.uid() AS uid) = user_id));
--;;
create policy release_likes_insert_own on music.release_likes as PERMISSIVE for INSERT to authenticated with check ((( SELECT auth.uid() AS uid) = user_id));
--;;
create policy release_likes_select_own on music.release_likes as PERMISSIVE for SELECT to authenticated using ((( SELECT auth.uid() AS uid) = user_id));
--;;
create policy release_localizations_insert_editable_release on music.release_localizations as PERMISSIVE for INSERT to authenticated with check ((( SELECT private.music_release_is_editable(release_localizations.release_id) AS music_release_is_editable) AND ( SELECT private.music_publication_is_creator_mutable(release_localizations.publication_status) AS music_publication_is_creator_mutable)));
--;;
create policy release_localizations_select_visible_release on music.release_localizations as PERMISSIVE for SELECT to anon, authenticated using (( SELECT private.music_release_is_visible(release_localizations.release_id) AS music_release_is_visible));
--;;
create policy release_localizations_update_editable_release on music.release_localizations as PERMISSIVE for UPDATE to authenticated using (( SELECT private.music_release_is_editable(release_localizations.release_id) AS music_release_is_editable)) with check ((( SELECT private.music_release_is_editable(release_localizations.release_id) AS music_release_is_editable) AND ( SELECT private.music_publication_is_creator_mutable(release_localizations.publication_status) AS music_publication_is_creator_mutable)));
--;;
create policy release_tracks_insert_editable_release_and_track on music.release_tracks as PERMISSIVE for INSERT to authenticated with check ((( SELECT private.music_release_is_editable(release_tracks.release_id) AS music_release_is_editable) AND ( SELECT private.music_track_is_editable(release_tracks.track_id) AS music_track_is_editable)));
--;;
create policy release_tracks_select_visible_release_and_track on music.release_tracks as PERMISSIVE for SELECT to anon, authenticated using ((( SELECT private.music_release_is_visible(release_tracks.release_id) AS music_release_is_visible) AND ( SELECT private.music_track_is_visible(release_tracks.track_id) AS music_track_is_visible)));
--;;
create policy release_tracks_update_editable_release_and_track on music.release_tracks as PERMISSIVE for UPDATE to authenticated using (( SELECT private.music_release_is_editable(release_tracks.release_id) AS music_release_is_editable)) with check ((( SELECT private.music_release_is_editable(release_tracks.release_id) AS music_release_is_editable) AND ( SELECT private.music_track_is_editable(release_tracks.track_id) AS music_track_is_editable)));
--;;
create policy releases_insert_creator on music.releases as PERMISSIVE for INSERT to authenticated with check ((( SELECT private.can_edit_creator_account(releases.owner_creator_account_id) AS can_edit_creator_account) AND ( SELECT private.music_publication_is_creator_mutable(releases.publication_status) AS music_publication_is_creator_mutable)));
--;;
create policy releases_select_published_or_owner on music.releases as PERMISSIVE for SELECT to anon, authenticated using (((publication_status = 'published'::media.publication_status) OR ( SELECT private.can_read_media_owner(releases.owner_creator_account_id) AS can_read_media_owner)));
--;;
create policy releases_update_creator on music.releases as PERMISSIVE for UPDATE to authenticated using (( SELECT private.can_edit_creator_account(releases.owner_creator_account_id) AS can_edit_creator_account)) with check ((( SELECT private.can_edit_creator_account(releases.owner_creator_account_id) AS can_edit_creator_account) AND ( SELECT private.music_publication_is_creator_mutable(releases.publication_status) AS music_publication_is_creator_mutable)));
--;;
create policy track_artists_insert_editable_track on music.track_artists as PERMISSIVE for INSERT to authenticated with check ((( SELECT private.music_track_is_editable(track_artists.track_id) AS music_track_is_editable) AND ( SELECT private.music_artist_is_visible(track_artists.artist_id) AS music_artist_is_visible)));
--;;
create policy track_artists_select_visible_track_and_artist on music.track_artists as PERMISSIVE for SELECT to anon, authenticated using ((( SELECT private.music_track_is_visible(track_artists.track_id) AS music_track_is_visible) AND ( SELECT private.music_artist_is_visible(track_artists.artist_id) AS music_artist_is_visible)));
--;;
create policy track_artists_update_editable_track on music.track_artists as PERMISSIVE for UPDATE to authenticated using (( SELECT private.music_track_is_editable(track_artists.track_id) AS music_track_is_editable)) with check ((( SELECT private.music_track_is_editable(track_artists.track_id) AS music_track_is_editable) AND ( SELECT private.music_artist_is_visible(track_artists.artist_id) AS music_artist_is_visible)));
--;;
create policy track_likes_delete_own on music.track_likes as PERMISSIVE for DELETE to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
--;;
create policy track_likes_insert_own_published_track on music.track_likes as PERMISSIVE for INSERT to authenticated with check (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT private.music_track_is_visible(track_likes.track_id) AS music_track_is_visible)));
--;;
create policy track_likes_select_own on music.track_likes as PERMISSIVE for SELECT to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
--;;
create policy track_localizations_insert_editable_track on music.track_localizations as PERMISSIVE for INSERT to authenticated with check ((( SELECT private.music_track_is_editable(track_localizations.track_id) AS music_track_is_editable) AND ( SELECT private.music_publication_is_creator_mutable(track_localizations.publication_status) AS music_publication_is_creator_mutable)));
--;;
create policy track_localizations_select_visible_track on music.track_localizations as PERMISSIVE for SELECT to anon, authenticated using (( SELECT private.music_track_is_visible(track_localizations.track_id) AS music_track_is_visible));
--;;
create policy track_localizations_update_editable_track on music.track_localizations as PERMISSIVE for UPDATE to authenticated using (( SELECT private.music_track_is_editable(track_localizations.track_id) AS music_track_is_editable)) with check ((( SELECT private.music_track_is_editable(track_localizations.track_id) AS music_track_is_editable) AND ( SELECT private.music_publication_is_creator_mutable(track_localizations.publication_status) AS music_publication_is_creator_mutable)));
--;;
create policy tracks_insert_creator on music.tracks as PERMISSIVE for INSERT to authenticated with check ((( SELECT private.can_edit_creator_account(tracks.owner_creator_account_id) AS can_edit_creator_account) AND ( SELECT private.music_publication_is_creator_mutable(tracks.publication_status) AS music_publication_is_creator_mutable)));
--;;
create policy tracks_select_published_or_owner on music.tracks as PERMISSIVE for SELECT to anon, authenticated using (((publication_status = 'published'::media.publication_status) OR ( SELECT private.can_read_media_owner(tracks.owner_creator_account_id) AS can_read_media_owner)));
--;;
create policy tracks_update_creator on music.tracks as PERMISSIVE for UPDATE to authenticated using (( SELECT private.can_edit_creator_account(tracks.owner_creator_account_id) AS can_edit_creator_account)) with check ((( SELECT private.can_edit_creator_account(tracks.owner_creator_account_id) AS can_edit_creator_account) AND ( SELECT private.music_publication_is_creator_mutable(tracks.publication_status) AS music_publication_is_creator_mutable)));
--;;
create policy bible_highlights_delete_own on public.bible_highlights as PERMISSIVE for DELETE to authenticated using ((( SELECT auth.uid() AS uid) = user_id));
--;;
create policy bible_highlights_insert_own on public.bible_highlights as PERMISSIVE for INSERT to authenticated with check ((( SELECT auth.uid() AS uid) = user_id));
--;;
create policy bible_highlights_select_own on public.bible_highlights as PERMISSIVE for SELECT to authenticated using ((( SELECT auth.uid() AS uid) = user_id));
--;;
create policy bible_highlights_update_own on public.bible_highlights as PERMISSIVE for UPDATE to authenticated using ((( SELECT auth.uid() AS uid) = user_id)) with check ((( SELECT auth.uid() AS uid) = user_id));
--;;
create policy "Allow public read access" on public.hymn_texts as PERMISSIVE for SELECT to anon, authenticated using (true);
--;;
create policy "Allow public read access" on public.hymn_titles as PERMISSIVE for SELECT to anon, authenticated using (true);
--;;
create policy notification_broadcasts_admin_select on public.notification_broadcasts as PERMISSIVE for SELECT to authenticated using (( SELECT private.is_admin() AS is_admin));
--;;
create policy notification_devices_delete_own on public.notification_devices as PERMISSIVE for DELETE to authenticated using ((( SELECT auth.uid() AS uid) = user_id));
--;;
create policy notification_devices_insert_own on public.notification_devices as PERMISSIVE for INSERT to authenticated with check ((( SELECT auth.uid() AS uid) = user_id));
--;;
create policy notification_devices_select_own on public.notification_devices as PERMISSIVE for SELECT to authenticated using ((( SELECT auth.uid() AS uid) = user_id));
--;;
create policy notification_devices_update_own on public.notification_devices as PERMISSIVE for UPDATE to authenticated using ((( SELECT auth.uid() AS uid) = user_id)) with check ((( SELECT auth.uid() AS uid) = user_id));
--;;
create policy notification_preferences_delete_own on public.notification_preferences as PERMISSIVE for DELETE to authenticated using ((( SELECT auth.uid() AS uid) = user_id));
--;;
create policy notification_preferences_insert_own on public.notification_preferences as PERMISSIVE for INSERT to authenticated with check ((( SELECT auth.uid() AS uid) = user_id));
--;;
create policy notification_preferences_select_own on public.notification_preferences as PERMISSIVE for SELECT to authenticated using ((( SELECT auth.uid() AS uid) = user_id));
--;;
create policy notification_preferences_update_own on public.notification_preferences as PERMISSIVE for UPDATE to authenticated using ((( SELECT auth.uid() AS uid) = user_id)) with check ((( SELECT auth.uid() AS uid) = user_id));
--;;
create policy notifications_select_own on public.notifications as PERMISSIVE for SELECT to authenticated using ((( SELECT auth.uid() AS uid) = user_id));
--;;
create policy notifications_update_read_own on public.notifications as PERMISSIVE for UPDATE to authenticated using ((( SELECT auth.uid() AS uid) = user_id)) with check ((( SELECT auth.uid() AS uid) = user_id));
--;;
create policy saint_order_select_anon on public.saint_order as PERMISSIVE for SELECT to anon using (true);
--;;
create policy saint_order_select_authenticated on public.saint_order as PERMISSIVE for SELECT to authenticated using (true);
--;;
create policy sermon_plans_delete_own on public.sermon_plans as PERMISSIVE for DELETE to authenticated using ((( SELECT auth.uid() AS uid) = user_id));
--;;
create policy sermon_plans_insert_own on public.sermon_plans as PERMISSIVE for INSERT to authenticated with check ((( SELECT auth.uid() AS uid) = user_id));
--;;
create policy sermon_plans_select_own on public.sermon_plans as PERMISSIVE for SELECT to authenticated using ((( SELECT auth.uid() AS uid) = user_id));
--;;
create policy sermon_plans_update_own on public.sermon_plans as PERMISSIVE for UPDATE to authenticated using ((( SELECT auth.uid() AS uid) = user_id)) with check ((( SELECT auth.uid() AS uid) = user_id));
--;;
create policy spiritual_canon_days_delete_own on public.spiritual_canon_days as PERMISSIVE for DELETE to authenticated using ((( SELECT auth.uid() AS uid) = user_id));
--;;
create policy spiritual_canon_days_insert_own on public.spiritual_canon_days as PERMISSIVE for INSERT to authenticated with check ((( SELECT auth.uid() AS uid) = user_id));
--;;
create policy spiritual_canon_days_select_own on public.spiritual_canon_days as PERMISSIVE for SELECT to authenticated using ((( SELECT auth.uid() AS uid) = user_id));
--;;
create policy spiritual_canon_days_update_own on public.spiritual_canon_days as PERMISSIVE for UPDATE to authenticated using ((( SELECT auth.uid() AS uid) = user_id)) with check ((( SELECT auth.uid() AS uid) = user_id));
--;;
create policy spiritual_canons_delete_own on public.spiritual_canons as PERMISSIVE for DELETE to authenticated using ((( SELECT auth.uid() AS uid) = user_id));
--;;
create policy spiritual_canons_insert_own on public.spiritual_canons as PERMISSIVE for INSERT to authenticated with check ((( SELECT auth.uid() AS uid) = user_id));
--;;
create policy spiritual_canons_select_own on public.spiritual_canons as PERMISSIVE for SELECT to authenticated using ((( SELECT auth.uid() AS uid) = user_id));
--;;
create policy spiritual_canons_update_own on public.spiritual_canons as PERMISSIVE for UPDATE to authenticated using ((( SELECT auth.uid() AS uid) = user_id)) with check ((( SELECT auth.uid() AS uid) = user_id));
--;;
create policy user_content_preferences_insert_own on public.user_content_preferences as PERMISSIVE for INSERT to authenticated with check ((( SELECT auth.uid() AS uid) = user_id));
--;;
create policy user_content_preferences_select_own on public.user_content_preferences as PERMISSIVE for SELECT to authenticated using ((( SELECT auth.uid() AS uid) = user_id));
--;;
create policy user_content_preferences_update_own on public.user_content_preferences as PERMISSIVE for UPDATE to authenticated using ((( SELECT auth.uid() AS uid) = user_id)) with check ((( SELECT auth.uid() AS uid) = user_id));
--;;
grant DELETE, INSERT, SELECT, UPDATE on creator.creator_account_members to authenticated;
--;;
grant INSERT, SELECT, UPDATE on creator.creator_accounts to authenticated;
--;;
grant INSERT, SELECT, UPDATE on creator.profiles to authenticated;
--;;
grant DELETE, INSERT, SELECT, UPDATE on creator.user_roles to authenticated;
--;;
grant SELECT on learning.album_localizations to anon;
--;;
grant DELETE, INSERT, SELECT, UPDATE on learning.album_localizations to authenticated;
--;;
grant SELECT on learning.album_recordings to anon;
--;;
grant DELETE, INSERT, SELECT, UPDATE on learning.album_recordings to authenticated;
--;;
grant SELECT on learning.albums to anon;
--;;
grant DELETE, INSERT, SELECT, UPDATE on learning.albums to authenticated;
--;;
grant SELECT on learning.cantor_localizations to anon;
--;;
grant DELETE, INSERT, SELECT, UPDATE on learning.cantor_localizations to authenticated;
--;;
grant SELECT on learning.cantor_permissions to anon;
--;;
grant DELETE, INSERT, SELECT, UPDATE on learning.cantor_permissions to authenticated;
--;;
grant SELECT on learning.cantors to anon;
--;;
grant DELETE, INSERT, SELECT, UPDATE on learning.cantors to authenticated;
--;;
grant SELECT on learning.hymn_localizations to anon;
--;;
grant DELETE, INSERT, SELECT, UPDATE on learning.hymn_localizations to authenticated;
--;;
grant SELECT on learning.hymn_progress to anon;
--;;
grant DELETE, INSERT, SELECT, UPDATE on learning.hymn_progress to authenticated;
--;;
grant SELECT on learning.hymn_relationships to anon;
--;;
grant DELETE, INSERT, SELECT, UPDATE on learning.hymn_relationships to authenticated;
--;;
grant SELECT on learning.hymn_seasons to anon;
--;;
grant DELETE, INSERT, SELECT, UPDATE on learning.hymn_seasons to authenticated;
--;;
grant SELECT on learning.hymns to anon;
--;;
grant DELETE, INSERT, SELECT, UPDATE on learning.hymns to authenticated;
--;;
grant DELETE, INSERT, SELECT, UPDATE on learning.item_likes to authenticated;
--;;
grant DELETE, INSERT, SELECT, UPDATE on learning.item_progress to authenticated;
--;;
grant SELECT on learning.lesson_localizations to anon;
--;;
grant DELETE, INSERT, SELECT, UPDATE on learning.lesson_localizations to authenticated;
--;;
grant SELECT on learning.lesson_set_localizations to anon;
--;;
grant DELETE, INSERT, SELECT, UPDATE on learning.lesson_set_localizations to authenticated;
--;;
grant SELECT on learning.lesson_sets to anon;
--;;
grant DELETE, INSERT, SELECT, UPDATE on learning.lesson_sets to authenticated;
--;;
grant SELECT on learning.lessons to anon;
--;;
grant DELETE, INSERT, SELECT, UPDATE on learning.lessons to authenticated;
--;;
grant DELETE, INSERT, SELECT, UPDATE on learning.lyric_edit_drafts to authenticated;
--;;
grant SELECT on learning.lyric_lines to anon;
--;;
grant DELETE, INSERT, SELECT, UPDATE on learning.lyric_lines to authenticated;
--;;
grant SELECT on learning.lyric_sets to anon;
--;;
grant DELETE, INSERT, SELECT, UPDATE on learning.lyric_sets to authenticated;
--;;
grant SELECT on learning.playlist_items to anon;
--;;
grant DELETE, INSERT, SELECT, UPDATE on learning.playlist_items to authenticated;
--;;
grant SELECT on learning.playlists to anon;
--;;
grant DELETE, INSERT, SELECT, UPDATE on learning.playlists to authenticated;
--;;
grant SELECT on learning.recording_localizations to anon;
--;;
grant DELETE, INSERT, SELECT, UPDATE on learning.recording_localizations to authenticated;
--;;
grant SELECT on learning.season_localizations to anon;
--;;
grant DELETE, INSERT, SELECT, UPDATE on learning.season_localizations to authenticated;
--;;
grant SELECT on learning.seasons to anon;
--;;
grant DELETE, INSERT, SELECT, UPDATE on learning.seasons to authenticated;
--;;
grant SELECT on media.locales to anon;
--;;
grant SELECT on media.locales to authenticated;
--;;
grant SELECT on media.localized_texts to anon;
--;;
grant INSERT, SELECT, UPDATE on media.localized_texts to authenticated;
--;;
grant SELECT on media.media_asset_versions to anon;
--;;
grant INSERT, SELECT, UPDATE on media.media_asset_versions to authenticated;
--;;
grant SELECT on media.media_assets to anon;
--;;
grant INSERT, SELECT, UPDATE on media.media_assets to authenticated;
--;;
grant SELECT on media.media_processing_jobs to authenticated;
--;;
grant SELECT on media.search_aliases to anon;
--;;
grant INSERT, SELECT, UPDATE on media.search_aliases to authenticated;
--;;
grant SELECT on media.search_documents to anon;
--;;
grant INSERT, SELECT, UPDATE on media.search_documents to authenticated;
--;;
grant SELECT on media.submission_events to authenticated;
--;;
grant SELECT on media.submission_items to authenticated;
--;;
grant SELECT on media.submissions to authenticated;
--;;
grant SELECT on media.upload_intents to authenticated;
--;;
grant DELETE, INSERT, SELECT, UPDATE on music.artist_follows to authenticated;
--;;
grant SELECT on music.artist_localizations to anon;
--;;
grant INSERT, SELECT, UPDATE on music.artist_localizations to authenticated;
--;;
grant SELECT on music.artist_memberships to anon;
--;;
grant INSERT, SELECT, UPDATE on music.artist_memberships to authenticated;
--;;
grant SELECT on music.artist_pinned_releases to anon;
--;;
grant SELECT on music.artist_pinned_releases to authenticated;
--;;
grant SELECT on music.artist_social_links to anon;
--;;
grant SELECT on music.artist_social_links to authenticated;
--;;
grant SELECT on music.artists to anon;
--;;
grant INSERT, SELECT, UPDATE on music.artists to authenticated;
--;;
grant DELETE, INSERT, SELECT, UPDATE on music.lyric_edit_drafts to authenticated;
--;;
grant SELECT on music.lyric_lines to anon;
--;;
grant DELETE, INSERT, SELECT, UPDATE on music.lyric_lines to authenticated;
--;;
grant SELECT on music.lyric_sets to anon;
--;;
grant DELETE, INSERT, SELECT, UPDATE on music.lyric_sets to authenticated;
--;;
grant SELECT on music.lyric_words to anon;
--;;
grant DELETE, INSERT, SELECT, UPDATE on music.lyric_words to authenticated;
--;;
grant DELETE, INSERT, SELECT, UPDATE on music.play_history to authenticated;
--;;
grant SELECT on music.playlist_tracks to anon;
--;;
grant DELETE, INSERT, SELECT, UPDATE on music.playlist_tracks to authenticated;
--;;
grant SELECT on music.playlists to anon;
--;;
grant DELETE, INSERT, SELECT, UPDATE on music.playlists to authenticated;
--;;
grant SELECT on music.release_likes to authenticated;
--;;
grant SELECT on music.release_localizations to anon;
--;;
grant INSERT, SELECT, UPDATE on music.release_localizations to authenticated;
--;;
grant SELECT on music.release_tracks to anon;
--;;
grant INSERT, SELECT, UPDATE on music.release_tracks to authenticated;
--;;
grant SELECT on music.releases to anon;
--;;
grant INSERT, SELECT, UPDATE on music.releases to authenticated;
--;;
grant SELECT on music.track_artists to anon;
--;;
grant INSERT, SELECT, UPDATE on music.track_artists to authenticated;
--;;
grant DELETE, INSERT, SELECT, UPDATE on music.track_likes to authenticated;
--;;
grant SELECT on music.track_localizations to anon;
--;;
grant INSERT, SELECT, UPDATE on music.track_localizations to authenticated;
--;;
grant SELECT on music.tracks to anon;
--;;
grant INSERT, SELECT, UPDATE on music.tracks to authenticated;
--;;
grant DELETE, INSERT, SELECT, UPDATE on public.bible_highlights to authenticated;
--;;
grant REFERENCES, SELECT, TRIGGER, TRUNCATE on public.hymn_texts to anon;
--;;
grant REFERENCES, SELECT, TRIGGER, TRUNCATE on public.hymn_texts to authenticated;
--;;
grant REFERENCES, SELECT, TRIGGER, TRUNCATE on public.hymn_titles to anon;
--;;
grant REFERENCES, SELECT, TRIGGER, TRUNCATE on public.hymn_titles to authenticated;
--;;
grant SELECT on public.notification_broadcasts to authenticated;
--;;
grant DELETE, INSERT, SELECT, UPDATE on public.notification_devices to authenticated;
--;;
grant DELETE, INSERT, SELECT, UPDATE on public.notification_preferences to authenticated;
--;;
grant SELECT on public.notifications to authenticated;
--;;
grant UPDATE (read_at) on public.notifications to authenticated;
--;;
grant REFERENCES, SELECT, TRIGGER, TRUNCATE on public.saint_order to anon;
--;;
grant REFERENCES, SELECT, TRIGGER, TRUNCATE on public.saint_order to authenticated;
--;;
grant DELETE, INSERT, SELECT, UPDATE on public.sermon_plans to authenticated;
--;;
grant DELETE, INSERT, SELECT, UPDATE on public.spiritual_canon_days to authenticated;
--;;
grant DELETE, INSERT, SELECT, UPDATE on public.spiritual_canons to authenticated;
--;;
grant INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.user_content_preferences to authenticated;
--;;
grant execute on function media.normalize_search_text(p_value text) to anon;
--;;
grant execute on function media.normalize_search_text(p_value text) to authenticated;
--;;
grant execute on function music.published_artist_social_links(p_artist_id uuid) to anon;
--;;
grant execute on function music.published_artist_social_links(p_artist_id uuid) to authenticated;
--;;
grant execute on function music.release_display_date(p_original_release_date date, p_scheduled_release_at timestamp with time zone, p_release_date date) to authenticated;
--;;
grant execute on function music.release_display_date(p_original_release_date date, p_scheduled_release_at timestamp with time zone, p_release_date date) to anon;
--;;
grant execute on function private.attach_lesson_audio_asset() to anon;
--;;
grant execute on function private.attach_lesson_audio_asset() to authenticated;
--;;
grant execute on function private.attach_pending_artist_profile_image(p_upload_intent_id uuid) to anon;
--;;
grant execute on function private.attach_pending_artist_profile_image(p_upload_intent_id uuid) to authenticated;
--;;
grant execute on function private.can_edit_creator_account(account_id uuid) to authenticated;
--;;
grant execute on function private.can_manage_creator_account(account_id uuid) to authenticated;
--;;
grant execute on function private.can_read_media_owner(account_id uuid) to anon;
--;;
grant execute on function private.can_read_media_owner(account_id uuid) to authenticated;
--;;
grant execute on function private.created_creator_account(account_id uuid) to authenticated;
--;;
grant execute on function private.enforce_release_identity_artist() to anon;
--;;
grant execute on function private.enforce_release_identity_artist() to authenticated;
--;;
grant execute on function private.enforce_release_scheduling_window() to anon;
--;;
grant execute on function private.enforce_release_scheduling_window() to authenticated;
--;;
grant execute on function private.has_app_role(required_role creator.app_role) to authenticated;
--;;
grant execute on function private.is_admin() to authenticated;
--;;
grant execute on function private.is_creator_account_member(account_id uuid) to authenticated;
--;;
grant execute on function private.learning_album_child_is_visible(p_album_id uuid, p_status media.publication_status) to anon;
--;;
grant execute on function private.learning_album_child_is_visible(p_album_id uuid, p_status media.publication_status) to authenticated;
--;;
grant execute on function private.learning_album_is_editable(p_album_id uuid) to authenticated;
--;;
grant execute on function private.learning_album_is_visible(p_album_id uuid) to anon;
--;;
grant execute on function private.learning_album_is_visible(p_album_id uuid) to authenticated;
--;;
grant execute on function private.learning_cantor_is_editable(p_cantor_id uuid) to authenticated;
--;;
grant execute on function private.learning_cantor_is_visible(p_cantor_id uuid) to anon;
--;;
grant execute on function private.learning_cantor_is_visible(p_cantor_id uuid) to authenticated;
--;;
grant execute on function private.learning_lesson_child_is_visible(p_lesson_set_id uuid, p_status media.publication_status) to authenticated;
--;;
grant execute on function private.learning_lesson_child_is_visible(p_lesson_set_id uuid, p_status media.publication_status) to anon;
--;;
grant execute on function private.learning_lesson_set_is_editable(p_lesson_set_id uuid) to authenticated;
--;;
grant execute on function private.learning_lesson_set_is_visible(p_lesson_set_id uuid) to anon;
--;;
grant execute on function private.learning_lesson_set_is_visible(p_lesson_set_id uuid) to authenticated;
--;;
grant execute on function private.learning_lyric_item_is_editable(p_item_kind learning.playlist_item_kind, p_item_id uuid) to anon;
--;;
grant execute on function private.learning_lyric_item_is_editable(p_item_kind learning.playlist_item_kind, p_item_id uuid) to authenticated;
--;;
grant execute on function private.learning_publication_is_creator_mutable(status media.publication_status) to anon;
--;;
grant execute on function private.learning_publication_is_creator_mutable(status media.publication_status) to authenticated;
--;;
grant execute on function private.learning_published_or_admin(status media.publication_status) to authenticated;
--;;
grant execute on function private.learning_published_or_admin(status media.publication_status) to anon;
--;;
grant execute on function private.link_submission_item_music_track(p_item_id uuid, p_track_id uuid, p_creator_account_id uuid) to authenticated;
--;;
grant execute on function private.media_asset_is_editable(asset_id uuid) to authenticated;
--;;
grant execute on function private.media_asset_is_visible(asset_id uuid) to anon;
--;;
grant execute on function private.media_asset_is_visible(asset_id uuid) to authenticated;
--;;
grant execute on function private.music_artist_is_editable(p_artist_id uuid) to anon;
--;;
grant execute on function private.music_artist_is_editable(p_artist_id uuid) to authenticated;
--;;
grant execute on function private.music_artist_is_visible(p_artist_id uuid) to anon;
--;;
grant execute on function private.music_artist_is_visible(p_artist_id uuid) to authenticated;
--;;
grant execute on function private.music_lyric_line_is_mutable(p_lyric_line_id uuid) to authenticated;
--;;
grant execute on function private.music_lyric_line_is_visible(p_lyric_line_id uuid) to anon;
--;;
grant execute on function private.music_lyric_line_is_visible(p_lyric_line_id uuid) to authenticated;
--;;
grant execute on function private.music_lyric_set_is_editable(p_lyric_set_id uuid) to authenticated;
--;;
grant execute on function private.music_lyric_set_is_mutable(p_lyric_set_id uuid) to authenticated;
--;;
grant execute on function private.music_lyric_set_is_visible(p_lyric_set_id uuid) to anon;
--;;
grant execute on function private.music_lyric_set_is_visible(p_lyric_set_id uuid) to authenticated;
--;;
grant execute on function private.music_playlist_is_editable(p_playlist_id uuid) to anon;
--;;
grant execute on function private.music_playlist_is_editable(p_playlist_id uuid) to authenticated;
--;;
grant execute on function private.music_playlist_is_visible(p_playlist_id uuid) to anon;
--;;
grant execute on function private.music_playlist_is_visible(p_playlist_id uuid) to authenticated;
--;;
grant execute on function private.music_publication_is_creator_mutable(status media.publication_status) to authenticated;
--;;
grant execute on function private.music_publication_is_creator_mutable(status media.publication_status) to anon;
--;;
grant execute on function private.music_release_is_editable(p_release_id uuid) to anon;
--;;
grant execute on function private.music_release_is_editable(p_release_id uuid) to authenticated;
--;;
grant execute on function private.music_release_is_visible(p_release_id uuid) to anon;
--;;
grant execute on function private.music_release_is_visible(p_release_id uuid) to authenticated;
--;;
grant execute on function private.music_track_is_editable(p_track_id uuid) to anon;
--;;
grant execute on function private.music_track_is_editable(p_track_id uuid) to authenticated;
--;;
grant execute on function private.music_track_is_visible(p_track_id uuid) to anon;
--;;
grant execute on function private.music_track_is_visible(p_track_id uuid) to authenticated;
--;;
grant execute on function private.normalize_creator_name(p_name text) to anon;
--;;
grant execute on function private.normalize_creator_name(p_name text) to authenticated;
--;;
grant execute on function private.prepare_music_release_artwork_for_publication() to anon;
--;;
grant execute on function private.prepare_music_release_artwork_for_publication() to authenticated;
--;;
grant execute on function private.publish_public_profile_image() to anon;
--;;
grant execute on function private.publish_public_profile_image() to authenticated;
--;;
grant execute on function private.resolve_creator_selected_artist(p_owner_account_id uuid, p_display_name text, p_artist_id uuid, p_default_identity boolean) to anon;
--;;
grant execute on function private.resolve_creator_selected_artist(p_owner_account_id uuid, p_display_name text, p_artist_id uuid, p_default_identity boolean) to authenticated;
--;;
grant execute on function private.resolve_track_credit_artist(p_owner_account_id uuid, p_name text, p_default_to_identity boolean) to authenticated;
--;;
grant execute on function private.set_track_credit_names(p_track_id uuid, p_owner_account_id uuid, p_main_artist_name text, p_contributors jsonb) to authenticated;
--;;
grant execute on function private.set_track_credit_refs(p_track_id uuid, p_owner_account_id uuid, p_main_artist_name text, p_main_artist_id uuid, p_contributors jsonb) to authenticated;
--;;
grant execute on function private.set_track_credit_refs(p_track_id uuid, p_owner_account_id uuid, p_main_artist_name text, p_main_artist_id uuid, p_contributors jsonb) to anon;
--;;
grant execute on function private.set_track_credits(p_track_id uuid, p_owner_account_id uuid, p_main_artist_id uuid, p_featured_artist_ids uuid[]) to anon;
--;;
grant execute on function private.set_track_credits(p_track_id uuid, p_owner_account_id uuid, p_main_artist_id uuid, p_featured_artist_ids uuid[]) to authenticated;
--;;
grant execute on function private.settle_submission_processing(p_upload_intent_id uuid) to anon;
--;;
grant execute on function private.settle_submission_processing(p_upload_intent_id uuid) to authenticated;
--;;
grant execute on function private.sync_learning_artist_identity() to anon;
--;;
grant execute on function private.sync_learning_artist_identity() to authenticated;
--;;
grant execute on function private.sync_music_artist_image_to_learning_cantor() to anon;
--;;
grant execute on function private.sync_music_artist_image_to_learning_cantor() to authenticated;
--;;
grant execute on function private.sync_music_release_type(p_release_id uuid) to anon;
--;;
grant execute on function private.sync_music_release_type(p_release_id uuid) to authenticated;
--;;
grant execute on function private.sync_music_release_type_trigger() to anon;
--;;
grant execute on function private.sync_music_release_type_trigger() to authenticated;
--;;
grant execute on function public.add_learning_playlist_item(p_playlist_id uuid, p_item_kind learning.playlist_item_kind, p_album_recording_id uuid, p_lesson_id uuid) to authenticated;
--;;
grant execute on function public.add_media_submission_item(p_submission_id uuid, p_upload_intent_id uuid, p_media_asset_id uuid, p_title text, p_sort_order integer, p_required boolean, p_role media.submission_item_role) to authenticated;
--;;
grant execute on function public.add_media_submission_item(p_submission_id uuid, p_upload_intent_id uuid, p_media_asset_id uuid, p_title text, p_sort_order integer, p_required boolean, p_role media.submission_item_role) to anon;
--;;
grant execute on function public.add_track_to_music_playlist(p_playlist_id uuid, p_track_id uuid) to authenticated;
--;;
grant execute on function public.admin_delete_catalog_item(p_kind text, p_id uuid) to authenticated;
--;;
grant execute on function public.admin_send_notification_broadcast(p_category text, p_title text, p_body text, p_deep_link text, p_payload jsonb) to authenticated;
--;;
grant execute on function public.admin_send_notification_test(p_title text, p_body text, p_deep_link text) to authenticated;
--;;
grant execute on function public.admin_update_music_release_dates(p_release_id uuid, p_scheduled_release_at timestamp with time zone, p_original_release_date date, p_clear_scheduled_release_at boolean, p_clear_original_release_date boolean) to authenticated;
--;;
grant execute on function public.authorize_admin_storage_gc() to authenticated;
--;;
grant execute on function public.claim_companion_media_processing_job(p_worker_token text, p_job_id uuid, p_worker_id text) to authenticated;
--;;
grant execute on function public.claim_companion_media_processing_job(p_worker_token text, p_job_id uuid, p_worker_id text) to anon;
--;;
grant execute on function public.claim_media_original_deletion(p_worker_token text, p_upload_intent_id uuid) to authenticated;
--;;
grant execute on function public.claim_media_original_deletion(p_worker_token text, p_upload_intent_id uuid) to anon;
--;;
grant execute on function public.claim_media_processing_job(p_worker_token text, p_worker_id text) to authenticated;
--;;
grant execute on function public.claim_media_processing_job(p_worker_token text, p_worker_id text) to anon;
--;;
grant execute on function public.clear_music_playlist_cover(p_playlist_id uuid) to authenticated;
--;;
grant execute on function public.complete_media_processing_job(p_worker_token text, p_job_id uuid, p_output_mime_type text, p_output_size_bytes bigint, p_output_checksum_sha256 text, p_probe jsonb) to authenticated;
--;;
grant execute on function public.complete_media_processing_job(p_worker_token text, p_job_id uuid, p_output_mime_type text, p_output_size_bytes bigint, p_output_checksum_sha256 text, p_probe jsonb) to anon;
--;;
grant execute on function public.complete_media_upload_intent(p_upload_intent_id uuid, p_uploaded_size bigint, p_r2_http_etag text) to authenticated;
--;;
grant execute on function public.complete_storage_gc_candidate(p_worker_token text, p_bucket text, p_path text) to authenticated;
--;;
grant execute on function public.complete_storage_gc_candidate(p_worker_token text, p_bucket text, p_path text) to anon;
--;;
grant execute on function public.confirm_admin_creator_artist_claim(p_submission_id uuid, p_existing_artist_id uuid) to authenticated;
--;;
grant execute on function public.coptic_replace_digits(txt text) to anon;
--;;
grant execute on function public.coptic_replace_digits(txt text) to authenticated;
--;;
grant execute on function public.create_creator_artist(p_creator_account_id uuid, p_display_name text) to authenticated;
--;;
grant execute on function public.create_creator_cantor(p_creator_account_id uuid, p_display_name text, p_contributor_type text) to authenticated;
--;;
grant execute on function public.create_creator_hymn(p_creator_account_id uuid, p_title text) to authenticated;
--;;
grant execute on function public.create_creator_submission(p_creator_account_id uuid, p_mode text, p_title text, p_description text, p_release_type music.release_type, p_artist_id uuid, p_cantor_id uuid, p_season_id uuid, p_hymn_id uuid, p_localized_titles jsonb, p_items jsonb, p_scheduled_release_at timestamp with time zone, p_original_release_date date) to anon;
--;;
grant execute on function public.create_creator_submission(p_creator_account_id uuid, p_mode text, p_title text, p_description text, p_release_type music.release_type, p_artist_id uuid, p_cantor_id uuid, p_season_id uuid, p_hymn_id uuid, p_localized_titles jsonb, p_items jsonb, p_scheduled_release_at timestamp with time zone, p_original_release_date date) to authenticated;
--;;
grant execute on function public.create_creator_submission_v2(p_creator_account_id uuid, p_mode text, p_title text, p_description text, p_release_type music.release_type, p_music_type text, p_recording_type text, p_artist_id uuid, p_cantor_id uuid, p_season_id uuid, p_hymn_id uuid, p_localized_titles jsonb, p_items jsonb, p_scheduled_release_at timestamp with time zone, p_original_release_date date) to authenticated;
--;;
grant execute on function public.create_creator_submission_v3(p_creator_account_id uuid, p_mode text, p_title text, p_description text, p_release_type music.release_type, p_music_type text, p_recording_type text, p_artist_id uuid, p_cantor_id uuid, p_season_id uuid, p_hymn_id uuid, p_localized_titles jsonb, p_items jsonb, p_release_timing_mode text, p_scheduled_release_at timestamp with time zone, p_original_release_date date) to authenticated;
--;;
grant execute on function public.create_learning_playlist(p_name text, p_description text, p_visibility learning.playlist_visibility) to authenticated;
--;;
grant execute on function public.create_media_submission(p_creator_account_id uuid, p_submission_type media.submission_type, p_title text, p_description text) to authenticated;
--;;
grant execute on function public.create_media_upload_intent(p_creator_account_id uuid, p_original_filename text, p_content_type text, p_content_length bigint, p_media_type media.media_type, p_checksum_sha256 text) to authenticated;
--;;
grant execute on function public.create_music_playlist(p_name text, p_description text, p_visibility music.playlist_visibility) to authenticated;
--;;
grant execute on function public.delete_admin_music_release(p_release_id uuid) to authenticated;
--;;
grant execute on function public.delete_admin_music_release_track(p_release_id uuid, p_track_id uuid) to authenticated;
--;;
grant execute on function public.delete_creator_music_release(p_release_id uuid) to authenticated;
--;;
grant execute on function public.delete_creator_music_release_track(p_release_id uuid, p_track_id uuid) to authenticated;
--;;
grant execute on function public.delete_learning_playlist(p_playlist_id uuid) to authenticated;
--;;
grant execute on function public.delete_music_playlist(p_playlist_id uuid) to authenticated;
--;;
grant execute on function public.delete_submission(p_submission_id uuid) to authenticated;
--;;
grant execute on function public.disable_notification_device(p_app_key text, p_provider text, p_push_token text) to authenticated;
--;;
grant execute on function public.earliest_release_at(p_submitted_at timestamp with time zone) to authenticated;
--;;
grant execute on function public.earliest_release_at(p_submitted_at timestamp with time zone) to anon;
--;;
grant execute on function public.enqueue_media_processing_job(p_upload_intent_id uuid, p_job_type media.processing_job_type, p_output_bucket text) to authenticated;
--;;
grant execute on function public.ensure_creator_workspace(p_display_name text) to authenticated;
--;;
grant execute on function public.evaluate_condition(p_condition text, p_flags jsonb) to anon;
--;;
grant execute on function public.evaluate_condition(p_condition text, p_flags jsonb) to authenticated;
--;;
grant execute on function public.fail_media_processing_job(p_worker_token text, p_job_id uuid, p_error_message text) to anon;
--;;
grant execute on function public.fail_media_processing_job(p_worker_token text, p_job_id uuid, p_error_message text) to authenticated;
--;;
grant execute on function public.finalize_admin_processing_file_deletion(p_job_id uuid) to authenticated;
--;;
grant execute on function public.find_reusable_uploaded_media_intent(p_creator_account_id uuid, p_original_filename text, p_content_length bigint, p_media_type media.media_type) to authenticated;
--;;
grant execute on function public.force_media_processing_job(p_job_id uuid) to authenticated;
--;;
grant execute on function public.force_pending_media_processing_jobs() to authenticated;
--;;
grant execute on function public.force_submission_media_processing(p_submission_id uuid) to authenticated;
--;;
grant execute on function public.get_admin_artist_profile(p_artist_id uuid) to authenticated;
--;;
grant execute on function public.get_admin_artists(p_search text) to authenticated;
--;;
grant execute on function public.get_admin_creator_artist_claims(p_submission_id uuid) to authenticated;
--;;
grant execute on function public.get_admin_notification_broadcast_overview(p_category text, p_history_limit integer) to authenticated;
--;;
grant execute on function public.get_admin_processing_jobs() to authenticated;
--;;
grant execute on function public.get_admin_publication_overview() to authenticated;
--;;
grant execute on function public.get_admin_review_queue(p_statuses text[]) to anon;
--;;
grant execute on function public.get_admin_review_queue(p_statuses text[]) to authenticated;
--;;
grant execute on function public.get_admin_submission_detail(p_submission_id uuid) to authenticated;
--;;
grant execute on function public.get_admin_submission_preview_item(p_item_id uuid) to authenticated;
--;;
grant execute on function public.get_admin_unused_storage_summary() to authenticated;
--;;
grant execute on function public.get_artist_followed(p_artist_id uuid) to anon;
--;;
grant execute on function public.get_artist_followed(p_artist_id uuid) to authenticated;
--;;
grant execute on function public.get_bible_books() to anon;
--;;
grant execute on function public.get_bible_books() to authenticated;
--;;
grant execute on function public.get_bible_chapter(p_book_key text, p_chapter_number integer) to anon;
--;;
grant execute on function public.get_bible_chapter(p_book_key text, p_chapter_number integer) to authenticated;
--;;
grant execute on function public.get_bible_chapter_list(p_book_key text) to anon;
--;;
grant execute on function public.get_bible_chapter_list(p_book_key text) to authenticated;
--;;
grant execute on function public.get_calendar_context(p_date date) to anon;
--;;
grant execute on function public.get_calendar_context(p_date date) to authenticated;
--;;
grant execute on function public.get_calendar_readings(p_date date) to anon;
--;;
grant execute on function public.get_calendar_readings(p_date date) to authenticated;
--;;
grant execute on function public.get_creator_artist_profile(p_creator_account_id uuid) to authenticated;
--;;
grant execute on function public.get_creator_catalog_options() to authenticated;
--;;
grant execute on function public.get_creator_credit_options(p_creator_account_id uuid) to anon;
--;;
grant execute on function public.get_creator_credit_options(p_creator_account_id uuid) to authenticated;
--;;
grant execute on function public.get_creator_dashboard(p_creator_account_id uuid) to authenticated;
--;;
grant execute on function public.get_creator_release(p_release_id uuid) to authenticated;
--;;
grant execute on function public.get_creator_releases(p_creator_account_id uuid) to authenticated;
--;;
grant execute on function public.get_creator_submission_items(p_submission_id uuid) to authenticated;
--;;
grant execute on function public.get_creator_workspaces() to authenticated;
--;;
grant execute on function public.get_home_synaxarium_events(p_date date) to anon;
--;;
grant execute on function public.get_home_synaxarium_events(p_date date) to authenticated;
--;;
grant execute on function public.get_inline_hymn(p_schema text, p_hymn_key text) to anon;
--;;
grant execute on function public.get_inline_hymn(p_schema text, p_hymn_key text) to authenticated;
--;;
grant execute on function public.get_learning_home(p_locale text) to anon;
--;;
grant execute on function public.get_learning_home(p_locale text) to authenticated;
--;;
grant execute on function public.get_learning_lyric_editor_items() to authenticated;
--;;
grant execute on function public.get_learning_lyric_language_draft(p_item_kind learning.playlist_item_kind, p_item_id uuid, p_locale text) to authenticated;
--;;
grant execute on function public.get_learning_playlist(p_playlist_id uuid, p_locale text) to anon;
--;;
grant execute on function public.get_learning_playlist(p_playlist_id uuid, p_locale text) to authenticated;
--;;
grant execute on function public.get_lyric_editor_tracks() to authenticated;
--;;
grant execute on function public.get_media_upload_intent_for_upload(p_upload_intent_id uuid) to authenticated;
--;;
grant execute on function public.get_media_worker_image_context(p_worker_token text, p_upload_intent_id uuid) to anon;
--;;
grant execute on function public.get_music_artist_search_art(p_artist_id uuid) to anon;
--;;
grant execute on function public.get_music_artist_search_art(p_artist_id uuid) to authenticated;
--;;
grant execute on function public.get_music_home(p_locale text) to anon;
--;;
grant execute on function public.get_music_home(p_locale text) to authenticated;
--;;
grant execute on function public.get_music_playlist(p_playlist_id uuid, p_locale text) to anon;
--;;
grant execute on function public.get_music_playlist(p_playlist_id uuid, p_locale text) to authenticated;
--;;
grant execute on function public.get_music_playlist_share_preview(p_playlist_id uuid) to anon;
--;;
grant execute on function public.get_music_playlist_share_preview(p_playlist_id uuid) to authenticated;
--;;
grant execute on function public.get_my_content_preferences() to authenticated;
--;;
grant execute on function public.get_my_learning_items(p_locale text) to authenticated;
--;;
grant execute on function public.get_my_learning_playlists(p_locale text) to authenticated;
--;;
grant execute on function public.get_my_learning_progress(p_locale text) to authenticated;
--;;
grant execute on function public.get_my_music_library(p_locale text) to anon;
--;;
grant execute on function public.get_my_music_library(p_locale text) to authenticated;
--;;
grant execute on function public.get_offline_content_changes() to anon;
--;;
grant execute on function public.get_offline_content_changes() to authenticated;
--;;
grant execute on function public.get_offline_package_plan() to anon;
--;;
grant execute on function public.get_offline_package_plan() to authenticated;
--;;
grant execute on function public.get_offline_table_page(p_resource text, p_table text, p_offset integer, p_limit integer) to anon;
--;;
grant execute on function public.get_offline_table_page(p_resource text, p_table text, p_offset integer, p_limit integer) to authenticated;
--;;
grant execute on function public.get_offline_table_rows(p_resource text, p_table text, p_after text, p_limit integer) to authenticated;
--;;
grant execute on function public.get_offline_table_rows(p_resource text, p_table text, p_after text, p_limit integer) to anon;
--;;
grant execute on function public.get_published_learning_album(p_album_id uuid, p_locale text) to anon;
--;;
grant execute on function public.get_published_learning_album(p_album_id uuid, p_locale text) to authenticated;
--;;
grant execute on function public.get_published_learning_cantor(p_cantor_id uuid, p_locale text) to authenticated;
--;;
grant execute on function public.get_published_learning_cantor(p_cantor_id uuid, p_locale text) to anon;
--;;
grant execute on function public.get_published_learning_hymn(p_hymn_id uuid, p_locale text) to authenticated;
--;;
grant execute on function public.get_published_learning_hymn(p_hymn_id uuid, p_locale text) to anon;
--;;
grant execute on function public.get_published_learning_item_lyrics(p_item_kind learning.playlist_item_kind, p_item_id uuid, p_locale text) to anon;
--;;
grant execute on function public.get_published_learning_item_lyrics(p_item_kind learning.playlist_item_kind, p_item_id uuid, p_locale text) to authenticated;
--;;
grant execute on function public.get_published_learning_lesson_set(p_lesson_set_id uuid, p_locale text) to authenticated;
--;;
grant execute on function public.get_published_learning_lesson_set(p_lesson_set_id uuid, p_locale text) to anon;
--;;
grant execute on function public.get_published_learning_season(p_season_id uuid, p_locale text) to authenticated;
--;;
grant execute on function public.get_published_learning_season(p_season_id uuid, p_locale text) to anon;
--;;
grant execute on function public.get_published_music_artist(p_artist_id uuid, p_locale text) to anon;
--;;
grant execute on function public.get_published_music_artist(p_artist_id uuid, p_locale text) to authenticated;
--;;
grant execute on function public.get_published_music_release(p_release_id uuid) to anon;
--;;
grant execute on function public.get_published_music_release(p_release_id uuid) to authenticated;
--;;
grant execute on function public.get_published_music_release_for_locale(p_release_id uuid, p_locale text) to anon;
--;;
grant execute on function public.get_published_music_release_for_locale(p_release_id uuid, p_locale text) to authenticated;
--;;
grant execute on function public.get_published_music_track_for_locale(p_track_id uuid, p_locale text) to anon;
--;;
grant execute on function public.get_published_music_track_for_locale(p_track_id uuid, p_locale text) to authenticated;
--;;
grant execute on function public.get_published_track_lyrics(p_track_id uuid, p_locale text, p_kind music.lyric_kind) to anon;
--;;
grant execute on function public.get_published_track_lyrics(p_track_id uuid, p_locale text, p_kind music.lyric_kind) to authenticated;
--;;
grant execute on function public.get_reading_text(p_reading_reference text) to anon;
--;;
grant execute on function public.get_reading_text(p_reading_reference text) to authenticated;
--;;
grant execute on function public.get_readings_for_date(p_date date) to anon;
--;;
grant execute on function public.get_readings_for_date(p_date date) to authenticated;
--;;
grant execute on function public.get_release_liked(p_release_id uuid) to anon;
--;;
grant execute on function public.get_release_liked(p_release_id uuid) to authenticated;
--;;
grant execute on function public.get_service(p_schema text, p_table text, p_date date, p_context jsonb, p_depth integer) to authenticated;
--;;
grant execute on function public.get_service(p_schema text, p_table text, p_date date, p_context jsonb, p_depth integer) to anon;
--;;
grant execute on function public.get_service_rows(p_schema text, p_table text) to anon;
--;;
grant execute on function public.get_service_rows(p_schema text, p_table text) to authenticated;
--;;
grant execute on function public.get_share_preview(p_path text, p_locale text) to anon;
--;;
grant execute on function public.get_share_preview(p_path text, p_locale text) to authenticated;
--;;
grant execute on function public.get_storage_gc_candidates(p_worker_token text, p_due_only boolean, p_limit integer) to anon;
--;;
grant execute on function public.get_storage_gc_candidates(p_worker_token text, p_due_only boolean, p_limit integer) to authenticated;
--;;
grant execute on function public.get_submission_editor(p_submission_id uuid) to authenticated;
--;;
grant execute on function public.get_sunday_message(p_sunday date) to anon;
--;;
grant execute on function public.get_sunday_message(p_sunday date) to authenticated;
--;;
grant execute on function public.get_synaxarium_year(p_reference_date date) to anon;
--;;
grant execute on function public.get_synaxarium_year(p_reference_date date) to authenticated;
--;;
grant execute on function public.get_track_lyric_draft(p_track_id uuid, p_locale text, p_kind music.lyric_kind) to authenticated;
--;;
grant execute on function public.get_track_lyric_language_draft(p_track_id uuid, p_locale text) to authenticated;
--;;
grant execute on function public.heartbeat_media_processing_jobs(p_worker_token text, p_job_ids uuid[], p_progress real) to authenticated;
--;;
grant execute on function public.heartbeat_media_processing_jobs(p_worker_token text, p_job_ids uuid[], p_progress real) to anon;
--;;
grant execute on function public.is_chc_admin() to authenticated;
--;;
grant execute on function public.learning_asset_json(a media.media_assets) to anon;
--;;
grant execute on function public.learning_asset_json(a media.media_assets) to authenticated;
--;;
grant execute on function public.learning_lesson_title(p_locale text, p_number bigint) to anon;
--;;
grant execute on function public.learning_lesson_title(p_locale text, p_number bigint) to authenticated;
--;;
grant execute on function public.media_processing_queue_has_work(p_worker_token text) to anon;
--;;
grant execute on function public.media_processing_queue_has_work(p_worker_token text) to authenticated;
--;;
grant execute on function public.prepare_admin_processing_file_deletion(p_job_id uuid) to authenticated;
--;;
grant execute on function public.prepare_storage_gc_candidate(p_worker_token text, p_bucket text, p_path text) to anon;
--;;
grant execute on function public.prepare_storage_gc_candidate(p_worker_token text, p_bucket text, p_path text) to authenticated;
--;;
grant execute on function public.publish_learning_album(p_album_id uuid) to authenticated;
--;;
grant execute on function public.publish_learning_cantor(p_cantor_id uuid) to authenticated;
--;;
grant execute on function public.publish_learning_lesson_set(p_lesson_set_id uuid) to authenticated;
--;;
grant execute on function public.publish_learning_lyric_languages(p_item_kind learning.playlist_item_kind, p_item_id uuid, p_sync_precision music.lyric_sync_precision, p_locales text[]) to authenticated;
--;;
grant execute on function public.publish_media_submission(p_submission_id uuid) to authenticated;
--;;
grant execute on function public.publish_music_release(p_release_id uuid) to authenticated;
--;;
grant execute on function public.publish_track_lyric_languages(p_track_id uuid, p_locales text[]) to authenticated;
--;;
grant execute on function public.publish_track_lyric_languages_v2(p_track_id uuid, p_locales text[], p_sync_precision music.lyric_sync_precision) to authenticated;
--;;
grant execute on function public.publish_track_lyric_set(p_lyric_set_id uuid) to authenticated;
--;;
grant execute on function public.record_music_play(p_track_id uuid, p_release_id uuid) to authenticated;
--;;
grant execute on function public.register_notification_device(p_app_key text, p_platform text, p_provider text, p_push_token text, p_provider_data jsonb, p_device_name text, p_app_version text) to anon;
--;;
grant execute on function public.register_notification_device(p_app_key text, p_platform text, p_provider text, p_push_token text, p_provider_data jsonb, p_device_name text, p_app_version text) to authenticated;
--;;
grant execute on function public.release_media_processing_jobs(p_worker_token text, p_job_ids uuid[], p_reason text) to authenticated;
--;;
grant execute on function public.release_media_processing_jobs(p_worker_token text, p_job_ids uuid[], p_reason text) to anon;
--;;
grant execute on function public.remove_learning_playlist_item(p_playlist_id uuid, p_item_id uuid) to authenticated;
--;;
grant execute on function public.remove_track_from_music_playlist(p_playlist_id uuid, p_track_id uuid) to authenticated;
--;;
grant execute on function public.renumber_item_order(schema_name text, table_name text) to anon;
--;;
grant execute on function public.renumber_item_order(schema_name text, table_name text) to authenticated;
--;;
grant execute on function public.renumber_line_id(schema_name text, table_name text) to anon;
--;;
grant execute on function public.renumber_line_id(schema_name text, table_name text) to authenticated;
--;;
grant execute on function public.renumber_line_order(schema_name text, table_name text) to anon;
--;;
grant execute on function public.renumber_line_order(schema_name text, table_name text) to authenticated;
--;;
grant execute on function public.resolve_subdocument_target(p_hymn_key text) to anon;
--;;
grant execute on function public.resolve_subdocument_target(p_hymn_key text) to authenticated;
--;;
grant execute on function public.retry_media_processing_job(p_job_id uuid) to authenticated;
--;;
grant execute on function public.review_media_submission(p_submission_id uuid, p_action text, p_notes text) to authenticated;
--;;
grant execute on function public.rls_auto_enable() to anon;
--;;
grant execute on function public.rls_auto_enable() to authenticated;
--;;
grant execute on function public.save_learning_lyric_studio_draft(p_item_kind learning.playlist_item_kind, p_item_id uuid, p_sync_precision music.lyric_sync_precision, p_languages jsonb) to authenticated;
--;;
grant execute on function public.save_my_content_preferences(p_preferences jsonb, p_bookmarks text[]) to authenticated;
--;;
grant execute on function public.save_submission_edit(p_submission_id uuid, p_edit jsonb) to authenticated;
--;;
grant execute on function public.save_track_lyric_draft(p_track_id uuid, p_locale text, p_kind music.lyric_kind, p_sync_precision music.lyric_sync_precision, p_title text, p_source text, p_lines jsonb) to authenticated;
--;;
grant execute on function public.save_track_lyric_language_draft(p_track_id uuid, p_locale text, p_description text, p_lines jsonb) to authenticated;
--;;
grant execute on function public.save_track_lyric_studio_draft(p_track_id uuid, p_languages jsonb) to authenticated;
--;;
grant execute on function public.save_track_lyric_studio_draft_v2(p_track_id uuid, p_sync_precision music.lyric_sync_precision, p_languages jsonb) to authenticated;
--;;
grant execute on function public.search_creator_contributors(p_creator_account_id uuid, p_query text, p_kind text, p_limit integer) to authenticated;
--;;
grant execute on function public.search_media_catalog(p_query text, p_locale text, p_scope text, p_limit integer) to authenticated;
--;;
grant execute on function public.search_media_catalog(p_query text, p_locale text, p_scope text, p_limit integer) to anon;
--;;
grant execute on function public.search_published_music(p_query text, p_locale text) to anon;
--;;
grant execute on function public.search_published_music(p_query text, p_locale text) to authenticated;
--;;
grant execute on function public.search_section_catalog(p_query text, p_locale text, p_section text, p_limit integer) to authenticated;
--;;
grant execute on function public.search_section_catalog(p_query text, p_locale text, p_section text, p_limit integer) to anon;
--;;
grant execute on function public.set_artist_followed(p_artist_id uuid, p_followed boolean) to authenticated;
--;;
grant execute on function public.set_learning_item_liked(p_item_kind learning.playlist_item_kind, p_item_id uuid, p_liked boolean) to authenticated;
--;;
grant execute on function public.set_learning_item_progress(p_item_kind learning.playlist_item_kind, p_item_id uuid, p_state learning.progress_state) to authenticated;
--;;
grant execute on function public.set_learning_progress(p_hymn_id uuid, p_state learning.progress_state) to authenticated;
--;;
grant execute on function public.set_music_playlist_cover(p_playlist_id uuid) to authenticated;
--;;
grant execute on function public.set_music_playlist_track_order(p_playlist_id uuid, p_track_ids uuid[]) to authenticated;
--;;
grant execute on function public.set_release_liked(p_release_id uuid, p_liked boolean) to authenticated;
--;;
grant execute on function public.set_track_liked(p_track_id uuid, p_liked boolean) to authenticated;
--;;
grant execute on function public.skip_media_processing_job(p_worker_token text, p_job_id uuid, p_reason text) to anon;
--;;
grant execute on function public.skip_media_processing_job(p_worker_token text, p_job_id uuid, p_reason text) to authenticated;
--;;
grant execute on function public.submit_media_submission(p_submission_id uuid) to authenticated;
--;;
grant execute on function public.sync_storage_gc_candidates(p_worker_token text, p_objects jsonb) to anon;
--;;
grant execute on function public.sync_storage_gc_candidates(p_worker_token text, p_objects jsonb) to authenticated;
--;;
grant execute on function public.to_coptic_numeral(n integer) to anon;
--;;
grant execute on function public.to_coptic_numeral(n integer) to authenticated;
--;;
grant execute on function public.update_admin_artist_profile(p_artist_id uuid, p_display_name text, p_biography text, p_social_links jsonb, p_profile_image_upload_intent_id uuid) to authenticated;
--;;
grant execute on function public.update_creator_artist_profile(p_creator_account_id uuid, p_display_name text, p_sort_name text, p_biography text, p_social_links jsonb, p_pinned_release_ids uuid[], p_profile_image_upload_intent_id uuid) to authenticated;
--;;
grant execute on function public.update_creator_release(p_release_id uuid, p_title text, p_description text, p_scheduled_release_at timestamp with time zone, p_original_release_date date, p_clear_original_release_date boolean, p_localized_titles jsonb, p_tracks jsonb, p_cover_upload_intent_id uuid) to authenticated;
--;;
grant execute on function public.update_creator_release(p_release_id uuid, p_title text, p_description text, p_scheduled_release_at timestamp with time zone, p_original_release_date date, p_clear_original_release_date boolean, p_localized_titles jsonb, p_tracks jsonb, p_cover_upload_intent_id uuid) to anon;
--;;
grant execute on function public.update_creator_release_metadata(p_release_id uuid, p_music_type text, p_recording_type text, p_localized_titles jsonb) to authenticated;
--;;
grant execute on function public.update_creator_release_v2(p_release_id uuid, p_title text, p_description text, p_scheduled_release_at timestamp with time zone, p_original_release_date date, p_clear_original_release_date boolean, p_localized_titles jsonb, p_music_type text, p_recording_type text, p_tracks jsonb, p_cover_upload_intent_id uuid) to authenticated;
--;;
grant execute on function public.update_creator_release_v3(p_release_id uuid, p_title text, p_description text, p_release_timing_mode text, p_scheduled_release_at timestamp with time zone, p_original_release_date date, p_clear_original_release_date boolean, p_localized_titles jsonb, p_music_type text, p_recording_type text, p_tracks jsonb, p_cover_upload_intent_id uuid) to authenticated;
--;;
grant execute on function public.update_learning_playlist(p_playlist_id uuid, p_name text, p_description text, p_visibility learning.playlist_visibility) to authenticated;
--;;
grant execute on function public.update_music_playlist(p_playlist_id uuid, p_name text, p_description text, p_visibility music.playlist_visibility) to authenticated;
--;;
grant execute on function public.veneration_validate_hymn_key() to anon;
--;;
grant execute on function public.veneration_validate_hymn_key() to authenticated;
--;;
grant usage on schema creator to authenticated;
--;;
grant usage on schema learning to anon;
--;;
grant usage on schema learning to authenticated;
--;;
grant usage on schema media to anon;
--;;
grant usage on schema media to authenticated;
--;;
grant usage on schema music to anon;
--;;
grant usage on schema music to authenticated;
--;;
grant usage on schema public to anon;
--;;
grant usage on schema public to authenticated;
