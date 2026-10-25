-- Every video lesson plays its sound alone from an audio-only copy: an M4A of
-- the video's own sound, a few percent of the video's size, so "Audio only"
-- saves the listener's data. The processor makes it in the same pass as the
-- video since 2026-10-17; a video converted before then has none, and its
-- lesson streamed the whole MP4 for its sound. This queues the copy for each
-- such video whose original is still kept. The processor's minute cron picks
-- it up; once it is made the lesson takes it (attachCompletedJobs) and the
-- original is removed, as for a new upload.
--
-- 0009's triggers stamp a queued job's times from "private.transaction"."at",
-- which cv-api sets around each write; it is set here the same way. With no
-- "current" name, 0010's undo log records nothing.
UPDATE "private.transaction" SET "at" = rtrim(rtrim(strftime('%Y-%m-%dT%H:%M:%f', 'now'), '0'), '.') || '+00:00' WHERE "id" = 1;

INSERT INTO "media.media_processing_jobs" ("upload_intent_id", "job_type", "status", "input_bucket", "input_path", "output_bucket", "output_path")
SELECT intent."id", 'audio_delivery', 'queued', intent."bucket", intent."path", video."output_bucket",
  'processed/' || intent."creator_account_id" || '/' || intent."id" || '/v1/audio.m4a'
FROM "media.upload_intents" intent
JOIN "media.media_processing_jobs" video ON video."upload_intent_id" = intent."id"
  AND video."job_type" = 'video_delivery' AND video."status" = 'completed' AND video."media_asset_id" IS NOT NULL
WHERE intent."media_type" = 'video' AND intent."status" = 'uploaded' AND intent."original_deleted_at" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "media.media_processing_jobs" audio
    WHERE audio."upload_intent_id" = intent."id" AND audio."job_type" = 'audio_delivery');

UPDATE "private.transaction" SET "at" = NULL WHERE "id" = 1;
