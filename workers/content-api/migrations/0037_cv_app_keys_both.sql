-- The notification tables take Coptic Vine's app keys (cv, cv_artists,
-- cv_admin) beside the old ones (chc, chc_artists, chc_admin, for Coptic Hymns
-- Centre), so cv-api can start writing the new ones while what is stored still
-- has the old. 0038 then moves what is stored to the new keys and takes the old
-- ones out. SQLite can't change a CHECK in place: each table is made again
-- (created beside, filled, swapped), with its indexes, and the triggers on it or
-- writing to it are taken down first and put back unchanged after.
-- Generated from the schema migrations 0006-0011 build.

PRAGMA defer_foreign_keys = true;

DROP TRIGGER "media.media_processing_jobs_notify_processing_failure_insert";
DROP TRIGGER "media.media_processing_jobs_notify_processing_failure_update";
DROP TRIGGER "media.submissions_notify_submission_status_insert";
DROP TRIGGER "media.submissions_notify_submission_status_update";
DROP TRIGGER "music.releases_notify_release_published_insert";
DROP TRIGGER "music.releases_notify_release_published_update";
DROP TRIGGER "public.notification_broadcasts_transaction_time_insert";
DROP TRIGGER "public.notification_broadcasts_undo_delete";
DROP TRIGGER "public.notification_broadcasts_undo_insert";
DROP TRIGGER "public.notification_broadcasts_undo_update";
DROP TRIGGER "public.notification_devices_transaction_time_insert";
DROP TRIGGER "public.notification_devices_undo_delete";
DROP TRIGGER "public.notification_devices_undo_insert";
DROP TRIGGER "public.notification_devices_undo_update";
DROP TRIGGER "public.notification_preferences_transaction_time_insert";
DROP TRIGGER "public.notification_preferences_undo_delete";
DROP TRIGGER "public.notification_preferences_undo_insert";
DROP TRIGGER "public.notification_preferences_undo_update";
DROP TRIGGER "public.notifications_transaction_time_insert";
DROP TRIGGER "public.notifications_undo_delete";
DROP TRIGGER "public.notifications_undo_insert";
DROP TRIGGER "public.notifications_undo_update";

-- public.notification_preferences
CREATE TABLE "public.notification_preferences__cv" (
  "user_id" TEXT NOT NULL,
  "app_key" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "enabled" INTEGER NOT NULL DEFAULT 1 CHECK ("enabled" IN (0, 1)),
  "created_at" TEXT NOT NULL DEFAULT (rtrim(rtrim(strftime('%Y-%m-%dT%H:%M:%f', 'now'), '0'), '.') || '+00:00') CHECK ("created_at" IS NULL OR ("created_at" GLOB '????-??-??T??:??:??*+00:00' AND datetime(substr("created_at", 1, 19)) IS NOT NULL AND (length("created_at") = 25 OR (substr("created_at", 20, 1) = '.' AND length("created_at") BETWEEN 27 AND 32 AND substr("created_at", 21, length("created_at") - 26) NOT GLOB '*[^0-9]*')))),
  "updated_at" TEXT NOT NULL DEFAULT (rtrim(rtrim(strftime('%Y-%m-%dT%H:%M:%f', 'now'), '0'), '.') || '+00:00') CHECK ("updated_at" IS NULL OR ("updated_at" GLOB '????-??-??T??:??:??*+00:00' AND datetime(substr("updated_at", 1, 19)) IS NOT NULL AND (length("updated_at") = 25 OR (substr("updated_at", 20, 1) = '.' AND length("updated_at") BETWEEN 27 AND 32 AND substr("updated_at", 21, length("updated_at") - 26) NOT GLOB '*[^0-9]*')))),
  PRIMARY KEY ("user_id", "app_key", "category"),
  CHECK (("app_key" IN ('cv', 'cv_artists', 'cv_admin', 'chc', 'chc_artists', 'chc_admin'))),
  CHECK ((length(trim("category")) > 0)),
  FOREIGN KEY ("user_id") REFERENCES "auth.users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
) STRICT;
INSERT INTO "public.notification_preferences__cv" ("user_id", "app_key", "category", "enabled", "created_at", "updated_at")
  SELECT "user_id", "app_key", "category", "enabled", "created_at", "updated_at" FROM "public.notification_preferences";
DROP TABLE "public.notification_preferences";
ALTER TABLE "public.notification_preferences__cv" RENAME TO "public.notification_preferences";

-- public.notification_devices
CREATE TABLE "public.notification_devices__cv" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  "user_id" TEXT,
  "app_key" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "push_token" TEXT NOT NULL,
  "provider_data" TEXT NOT NULL DEFAULT '{}' CHECK (json_valid("provider_data")),
  "device_name" TEXT,
  "app_version" TEXT,
  "enabled" INTEGER NOT NULL DEFAULT 1 CHECK ("enabled" IN (0, 1)),
  "last_seen_at" TEXT NOT NULL DEFAULT (rtrim(rtrim(strftime('%Y-%m-%dT%H:%M:%f', 'now'), '0'), '.') || '+00:00') CHECK ("last_seen_at" IS NULL OR ("last_seen_at" GLOB '????-??-??T??:??:??*+00:00' AND datetime(substr("last_seen_at", 1, 19)) IS NOT NULL AND (length("last_seen_at") = 25 OR (substr("last_seen_at", 20, 1) = '.' AND length("last_seen_at") BETWEEN 27 AND 32 AND substr("last_seen_at", 21, length("last_seen_at") - 26) NOT GLOB '*[^0-9]*')))),
  "created_at" TEXT NOT NULL DEFAULT (rtrim(rtrim(strftime('%Y-%m-%dT%H:%M:%f', 'now'), '0'), '.') || '+00:00') CHECK ("created_at" IS NULL OR ("created_at" GLOB '????-??-??T??:??:??*+00:00' AND datetime(substr("created_at", 1, 19)) IS NOT NULL AND (length("created_at") = 25 OR (substr("created_at", 20, 1) = '.' AND length("created_at") BETWEEN 27 AND 32 AND substr("created_at", 21, length("created_at") - 26) NOT GLOB '*[^0-9]*')))),
  "updated_at" TEXT NOT NULL DEFAULT (rtrim(rtrim(strftime('%Y-%m-%dT%H:%M:%f', 'now'), '0'), '.') || '+00:00') CHECK ("updated_at" IS NULL OR ("updated_at" GLOB '????-??-??T??:??:??*+00:00' AND datetime(substr("updated_at", 1, 19)) IS NOT NULL AND (length("updated_at") = 25 OR (substr("updated_at", 20, 1) = '.' AND length("updated_at") BETWEEN 27 AND 32 AND substr("updated_at", 21, length("updated_at") - 26) NOT GLOB '*[^0-9]*')))),
  PRIMARY KEY ("id"),
  CHECK (("app_key" IN ('cv', 'cv_artists', 'cv_admin', 'chc', 'chc_artists', 'chc_admin'))),
  CHECK (("platform" IN ('ios', 'android', 'web', 'windows'))),
  CHECK (("provider" IN ('expo', 'web_push', 'wns'))),
  CHECK ((json_type("provider_data") = 'object')),
  CHECK ((length(trim("push_token")) > 0)),
  FOREIGN KEY ("user_id") REFERENCES "auth.users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
) STRICT;
INSERT INTO "public.notification_devices__cv" ("id", "user_id", "app_key", "platform", "provider", "push_token", "provider_data", "device_name", "app_version", "enabled", "last_seen_at", "created_at", "updated_at")
  SELECT "id", "user_id", "app_key", "platform", "provider", "push_token", "provider_data", "device_name", "app_version", "enabled", "last_seen_at", "created_at", "updated_at" FROM "public.notification_devices";
DROP TABLE "public.notification_devices";
ALTER TABLE "public.notification_devices__cv" RENAME TO "public.notification_devices";
CREATE INDEX "public.notification_devices_app_enabled_idx" ON "public.notification_devices" ("app_key", "enabled", "provider");
CREATE UNIQUE INDEX "public.notification_devices_app_provider_token_uidx" ON "public.notification_devices" ("app_key", "provider", "push_token");
CREATE INDEX "public.notification_devices_user_enabled_idx" ON "public.notification_devices" ("user_id", "app_key", "enabled");

-- public.notification_broadcasts
CREATE TABLE "public.notification_broadcasts__cv" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  "app_key" TEXT NOT NULL DEFAULT 'cv',
  "category" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "deep_link" TEXT,
  "payload" TEXT NOT NULL DEFAULT '{}' CHECK (json_valid("payload")),
  "created_by" TEXT NOT NULL,
  "recipient_count" INTEGER NOT NULL DEFAULT 0,
  "delivery_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TEXT NOT NULL DEFAULT (rtrim(rtrim(strftime('%Y-%m-%dT%H:%M:%f', 'now'), '0'), '.') || '+00:00') CHECK ("created_at" IS NULL OR ("created_at" GLOB '????-??-??T??:??:??*+00:00' AND datetime(substr("created_at", 1, 19)) IS NOT NULL AND (length("created_at") = 25 OR (substr("created_at", 20, 1) = '.' AND length("created_at") BETWEEN 27 AND 32 AND substr("created_at", 21, length("created_at") - 26) NOT GLOB '*[^0-9]*')))),
  PRIMARY KEY ("id"),
  CHECK (("app_key" IN ('cv', 'cv_artists', 'cv_admin', 'chc', 'chc_artists', 'chc_admin'))),
  CHECK (((length(trim("body")) >= 1) AND (length(trim("body")) <= 600))),
  CHECK (("category" IN ('feast_celebrations', 'announcements'))),
  CHECK (("delivery_count" >= 0)),
  CHECK ((json_type("payload") = 'object')),
  CHECK (("recipient_count" >= 0)),
  CHECK (((length(trim("title")) >= 1) AND (length(trim("title")) <= 120))),
  FOREIGN KEY ("created_by") REFERENCES "auth.users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT
) STRICT;
INSERT INTO "public.notification_broadcasts__cv" ("id", "app_key", "category", "title", "body", "deep_link", "payload", "created_by", "recipient_count", "delivery_count", "created_at")
  SELECT "id", "app_key", "category", "title", "body", "deep_link", "payload", "created_by", "recipient_count", "delivery_count", "created_at" FROM "public.notification_broadcasts";
DROP TABLE "public.notification_broadcasts";
ALTER TABLE "public.notification_broadcasts__cv" RENAME TO "public.notification_broadcasts";
CREATE INDEX "public.notification_broadcasts_created_at_idx" ON "public.notification_broadcasts" ("created_at" DESC);

-- public.notifications
CREATE TABLE "public.notifications__cv" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  "user_id" TEXT NOT NULL,
  "app_key" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "image_url" TEXT,
  "deep_link" TEXT,
  "payload" TEXT NOT NULL DEFAULT '{}' CHECK (json_valid("payload")),
  "created_at" TEXT NOT NULL DEFAULT (rtrim(rtrim(strftime('%Y-%m-%dT%H:%M:%f', 'now'), '0'), '.') || '+00:00') CHECK ("created_at" IS NULL OR ("created_at" GLOB '????-??-??T??:??:??*+00:00' AND datetime(substr("created_at", 1, 19)) IS NOT NULL AND (length("created_at") = 25 OR (substr("created_at", 20, 1) = '.' AND length("created_at") BETWEEN 27 AND 32 AND substr("created_at", 21, length("created_at") - 26) NOT GLOB '*[^0-9]*')))),
  "read_at" TEXT CHECK ("read_at" IS NULL OR ("read_at" GLOB '????-??-??T??:??:??*+00:00' AND datetime(substr("read_at", 1, 19)) IS NOT NULL AND (length("read_at") = 25 OR (substr("read_at", 20, 1) = '.' AND length("read_at") BETWEEN 27 AND 32 AND substr("read_at", 21, length("read_at") - 26) NOT GLOB '*[^0-9]*')))),
  PRIMARY KEY ("id"),
  CHECK (("app_key" IN ('cv', 'cv_artists', 'cv_admin', 'chc', 'chc_artists', 'chc_admin'))),
  CHECK ((length(trim("body")) > 0)),
  CHECK ((length(trim("category")) > 0)),
  CHECK ((length(trim("event_type")) > 0)),
  CHECK ((json_type("payload") = 'object')),
  CHECK ((length(trim("title")) > 0)),
  FOREIGN KEY ("user_id") REFERENCES "auth.users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
) STRICT;
INSERT INTO "public.notifications__cv" ("id", "user_id", "app_key", "category", "event_type", "title", "body", "image_url", "deep_link", "payload", "created_at", "read_at")
  SELECT "id", "user_id", "app_key", "category", "event_type", "title", "body", "image_url", "deep_link", "payload", "created_at", "read_at" FROM "public.notifications";
DROP TABLE "public.notifications";
ALTER TABLE "public.notifications__cv" RENAME TO "public.notifications";
CREATE INDEX "public.notifications_user_created_idx" ON "public.notifications" ("user_id", "app_key", "created_at" DESC);

CREATE TRIGGER "media.media_processing_jobs_notify_processing_failure_insert" AFTER INSERT ON "media.media_processing_jobs"
FOR EACH ROW WHEN ((SELECT "depth" FROM "private.replica_mode") = 0) AND (NEW."status" = 'failed')
BEGIN
  UPDATE "private.trigger_marks" SET "value" = (SELECT coalesce(max(rowid), 0) FROM "public.notifications") WHERE "name" = 'notifications';
  INSERT INTO "public.notifications" ("user_id", "app_key", "category", "event_type", "title", "body", "deep_link", "image_url", "payload")
    SELECT audience."user_id", 'chc_admin', 'processing_failures', 'media_processing_failed', 'Media processing failed', 'A media processing job requires attention.', '/processing', NULL, '{' || '"job_id": ' || json_quote(NEW."id") || '}'
    FROM (SELECT DISTINCT ur."user_id" FROM "creator.user_roles" ur WHERE ur."role" = 'admin' AND ur."revoked_at" IS NULL) audience
    WHERE audience."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "public.notification_preferences" pref
      WHERE pref."user_id" = audience."user_id" AND pref."app_key" = 'chc_admin' AND pref."category" = 'processing_failures' AND pref."enabled" = 0);
  INSERT INTO "private.notification_deliveries" ("notification_id", "device_id", "provider")
    SELECT n."id", d."id", d."provider" FROM "public.notifications" n
    JOIN "public.notification_devices" d ON d."user_id" = n."user_id" AND d."app_key" = n."app_key" AND d."enabled" = 1 AND d."provider" IN ('expo', 'web_push')
    WHERE n.rowid > (SELECT "value" FROM "private.trigger_marks" WHERE "name" = 'notifications')
    ON CONFLICT ("notification_id", "device_id") DO NOTHING;
  UPDATE "private.trigger_marks" SET "value" = (SELECT coalesce(max(rowid), 0) FROM "public.notifications") WHERE "name" = 'notifications';
  INSERT INTO "public.notifications" ("user_id", "app_key", "category", "event_type", "title", "body", "deep_link", "image_url", "payload")
    SELECT audience."user_id", 'chc_artists', 'processing_errors', 'media_processing_failed', 'Media processing needs attention', 'Coptic Vine could not finish processing one of your uploaded files.', '/', NULL, '{' || '"job_id": ' || json_quote(NEW."id") || '}'
    FROM (SELECT DISTINCT m."user_id" FROM "media.submission_items" si JOIN "media.submissions" s ON s."id" = si."submission_id"
      JOIN "creator.creator_account_members" m ON m."creator_account_id" = s."creator_account_id" WHERE si."media_processing_job_id" = NEW."id") audience
    WHERE audience."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "public.notification_preferences" pref
      WHERE pref."user_id" = audience."user_id" AND pref."app_key" = 'chc_artists' AND pref."category" = 'processing_errors' AND pref."enabled" = 0);
  INSERT INTO "private.notification_deliveries" ("notification_id", "device_id", "provider")
    SELECT n."id", d."id", d."provider" FROM "public.notifications" n
    JOIN "public.notification_devices" d ON d."user_id" = n."user_id" AND d."app_key" = n."app_key" AND d."enabled" = 1 AND d."provider" IN ('expo', 'web_push')
    WHERE n.rowid > (SELECT "value" FROM "private.trigger_marks" WHERE "name" = 'notifications')
    ON CONFLICT ("notification_id", "device_id") DO NOTHING;
END;

CREATE TRIGGER "media.media_processing_jobs_notify_processing_failure_update" AFTER UPDATE OF "status" ON "media.media_processing_jobs"
FOR EACH ROW WHEN ((SELECT "depth" FROM "private.replica_mode") = 0) AND (NEW."status" = 'failed' AND OLD."status" <> 'failed')
BEGIN
  UPDATE "private.trigger_marks" SET "value" = (SELECT coalesce(max(rowid), 0) FROM "public.notifications") WHERE "name" = 'notifications';
  INSERT INTO "public.notifications" ("user_id", "app_key", "category", "event_type", "title", "body", "deep_link", "image_url", "payload")
    SELECT audience."user_id", 'chc_admin', 'processing_failures', 'media_processing_failed', 'Media processing failed', 'A media processing job requires attention.', '/processing', NULL, '{' || '"job_id": ' || json_quote(NEW."id") || '}'
    FROM (SELECT DISTINCT ur."user_id" FROM "creator.user_roles" ur WHERE ur."role" = 'admin' AND ur."revoked_at" IS NULL) audience
    WHERE audience."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "public.notification_preferences" pref
      WHERE pref."user_id" = audience."user_id" AND pref."app_key" = 'chc_admin' AND pref."category" = 'processing_failures' AND pref."enabled" = 0);
  INSERT INTO "private.notification_deliveries" ("notification_id", "device_id", "provider")
    SELECT n."id", d."id", d."provider" FROM "public.notifications" n
    JOIN "public.notification_devices" d ON d."user_id" = n."user_id" AND d."app_key" = n."app_key" AND d."enabled" = 1 AND d."provider" IN ('expo', 'web_push')
    WHERE n.rowid > (SELECT "value" FROM "private.trigger_marks" WHERE "name" = 'notifications')
    ON CONFLICT ("notification_id", "device_id") DO NOTHING;
  UPDATE "private.trigger_marks" SET "value" = (SELECT coalesce(max(rowid), 0) FROM "public.notifications") WHERE "name" = 'notifications';
  INSERT INTO "public.notifications" ("user_id", "app_key", "category", "event_type", "title", "body", "deep_link", "image_url", "payload")
    SELECT audience."user_id", 'chc_artists', 'processing_errors', 'media_processing_failed', 'Media processing needs attention', 'Coptic Vine could not finish processing one of your uploaded files.', '/', NULL, '{' || '"job_id": ' || json_quote(NEW."id") || '}'
    FROM (SELECT DISTINCT m."user_id" FROM "media.submission_items" si JOIN "media.submissions" s ON s."id" = si."submission_id"
      JOIN "creator.creator_account_members" m ON m."creator_account_id" = s."creator_account_id" WHERE si."media_processing_job_id" = NEW."id") audience
    WHERE audience."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "public.notification_preferences" pref
      WHERE pref."user_id" = audience."user_id" AND pref."app_key" = 'chc_artists' AND pref."category" = 'processing_errors' AND pref."enabled" = 0);
  INSERT INTO "private.notification_deliveries" ("notification_id", "device_id", "provider")
    SELECT n."id", d."id", d."provider" FROM "public.notifications" n
    JOIN "public.notification_devices" d ON d."user_id" = n."user_id" AND d."app_key" = n."app_key" AND d."enabled" = 1 AND d."provider" IN ('expo', 'web_push')
    WHERE n.rowid > (SELECT "value" FROM "private.trigger_marks" WHERE "name" = 'notifications')
    ON CONFLICT ("notification_id", "device_id") DO NOTHING;
END;

CREATE TRIGGER "media.submissions_notify_submission_status_insert" AFTER INSERT ON "media.submissions"
FOR EACH ROW WHEN ((SELECT "depth" FROM "private.replica_mode") = 0)
BEGIN
  UPDATE "private.trigger_marks" SET "value" = (SELECT coalesce(max(rowid), 0) FROM "public.notifications") WHERE "name" = 'notifications';
  INSERT INTO "public.notifications" ("user_id", "app_key", "category", "event_type", "title", "body", "deep_link", "image_url", "payload")
    SELECT audience."user_id", 'chc_admin', 'new_submissions', 'submission_pending_review', 'New submission', NEW."title" || ' is ready for review.', '/submission/' || NEW."id", NULL, '{' || '"submission_id": ' || json_quote(NEW."id") || ', "submission_type": ' || json_quote(NEW."submission_type") || '}'
    FROM (SELECT DISTINCT ur."user_id" FROM "creator.user_roles" ur WHERE ur."role" = 'admin' AND ur."revoked_at" IS NULL AND NEW."status" = 'pending_review') audience
    WHERE audience."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "public.notification_preferences" pref
      WHERE pref."user_id" = audience."user_id" AND pref."app_key" = 'chc_admin' AND pref."category" = 'new_submissions' AND pref."enabled" = 0);
  INSERT INTO "private.notification_deliveries" ("notification_id", "device_id", "provider")
    SELECT n."id", d."id", d."provider" FROM "public.notifications" n
    JOIN "public.notification_devices" d ON d."user_id" = n."user_id" AND d."app_key" = n."app_key" AND d."enabled" = 1 AND d."provider" IN ('expo', 'web_push')
    WHERE n.rowid > (SELECT "value" FROM "private.trigger_marks" WHERE "name" = 'notifications')
    ON CONFLICT ("notification_id", "device_id") DO NOTHING;
  UPDATE "private.trigger_marks" SET "value" = (SELECT coalesce(max(rowid), 0) FROM "public.notifications") WHERE "name" = 'notifications';
  INSERT INTO "public.notifications" ("user_id", "app_key", "category", "event_type", "title", "body", "deep_link", "image_url", "payload")
    SELECT audience."user_id", 'chc_artists', 'submission_updates', 'submission_' || NEW."status", CASE NEW."status" WHEN 'approved' THEN 'Submission approved' WHEN 'changes_requested' THEN 'Changes requested' WHEN 'rejected' THEN 'Submission not approved' WHEN 'published' THEN 'Submission is live' END, CASE NEW."status" WHEN 'approved' THEN NEW."title" || ' has been approved.' WHEN 'changes_requested' THEN 'Coptic Vine requested changes to ' || NEW."title" || '.'
            WHEN 'rejected' THEN NEW."title" || ' was not approved.' WHEN 'published' THEN NEW."title" || ' is now available on Coptic Vine.' END, '/submission/' || NEW."id", NULL, '{' || '"status": ' || json_quote(NEW."status") || ', "submission_id": ' || json_quote(NEW."id") || ', "submission_type": ' || json_quote(NEW."submission_type") || '}'
    FROM (SELECT DISTINCT m."user_id" FROM "creator.creator_account_members" m WHERE m."creator_account_id" = NEW."creator_account_id" AND NEW."status" IN ('approved', 'changes_requested', 'rejected', 'published') AND NOT (NEW."status" = 'published' AND NEW."submission_type" = 'music_release')) audience
    WHERE audience."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "public.notification_preferences" pref
      WHERE pref."user_id" = audience."user_id" AND pref."app_key" = 'chc_artists' AND pref."category" = 'submission_updates' AND pref."enabled" = 0);
  INSERT INTO "private.notification_deliveries" ("notification_id", "device_id", "provider")
    SELECT n."id", d."id", d."provider" FROM "public.notifications" n
    JOIN "public.notification_devices" d ON d."user_id" = n."user_id" AND d."app_key" = n."app_key" AND d."enabled" = 1 AND d."provider" IN ('expo', 'web_push')
    WHERE n.rowid > (SELECT "value" FROM "private.trigger_marks" WHERE "name" = 'notifications')
    ON CONFLICT ("notification_id", "device_id") DO NOTHING;
END;

CREATE TRIGGER "media.submissions_notify_submission_status_update" AFTER UPDATE OF "status" ON "media.submissions"
FOR EACH ROW WHEN ((SELECT "depth" FROM "private.replica_mode") = 0) AND (OLD."status" <> NEW."status")
BEGIN
  UPDATE "private.trigger_marks" SET "value" = (SELECT coalesce(max(rowid), 0) FROM "public.notifications") WHERE "name" = 'notifications';
  INSERT INTO "public.notifications" ("user_id", "app_key", "category", "event_type", "title", "body", "deep_link", "image_url", "payload")
    SELECT audience."user_id", 'chc_admin', 'new_submissions', 'submission_pending_review', 'New submission', NEW."title" || ' is ready for review.', '/submission/' || NEW."id", NULL, '{' || '"submission_id": ' || json_quote(NEW."id") || ', "submission_type": ' || json_quote(NEW."submission_type") || '}'
    FROM (SELECT DISTINCT ur."user_id" FROM "creator.user_roles" ur WHERE ur."role" = 'admin' AND ur."revoked_at" IS NULL AND NEW."status" = 'pending_review') audience
    WHERE audience."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "public.notification_preferences" pref
      WHERE pref."user_id" = audience."user_id" AND pref."app_key" = 'chc_admin' AND pref."category" = 'new_submissions' AND pref."enabled" = 0);
  INSERT INTO "private.notification_deliveries" ("notification_id", "device_id", "provider")
    SELECT n."id", d."id", d."provider" FROM "public.notifications" n
    JOIN "public.notification_devices" d ON d."user_id" = n."user_id" AND d."app_key" = n."app_key" AND d."enabled" = 1 AND d."provider" IN ('expo', 'web_push')
    WHERE n.rowid > (SELECT "value" FROM "private.trigger_marks" WHERE "name" = 'notifications')
    ON CONFLICT ("notification_id", "device_id") DO NOTHING;
  UPDATE "private.trigger_marks" SET "value" = (SELECT coalesce(max(rowid), 0) FROM "public.notifications") WHERE "name" = 'notifications';
  INSERT INTO "public.notifications" ("user_id", "app_key", "category", "event_type", "title", "body", "deep_link", "image_url", "payload")
    SELECT audience."user_id", 'chc_artists', 'submission_updates', 'submission_' || NEW."status", CASE NEW."status" WHEN 'approved' THEN 'Submission approved' WHEN 'changes_requested' THEN 'Changes requested' WHEN 'rejected' THEN 'Submission not approved' WHEN 'published' THEN 'Submission is live' END, CASE NEW."status" WHEN 'approved' THEN NEW."title" || ' has been approved.' WHEN 'changes_requested' THEN 'Coptic Vine requested changes to ' || NEW."title" || '.'
            WHEN 'rejected' THEN NEW."title" || ' was not approved.' WHEN 'published' THEN NEW."title" || ' is now available on Coptic Vine.' END, '/submission/' || NEW."id", NULL, '{' || '"status": ' || json_quote(NEW."status") || ', "submission_id": ' || json_quote(NEW."id") || ', "submission_type": ' || json_quote(NEW."submission_type") || '}'
    FROM (SELECT DISTINCT m."user_id" FROM "creator.creator_account_members" m WHERE m."creator_account_id" = NEW."creator_account_id" AND NEW."status" IN ('approved', 'changes_requested', 'rejected', 'published') AND NOT (NEW."status" = 'published' AND NEW."submission_type" = 'music_release')) audience
    WHERE audience."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "public.notification_preferences" pref
      WHERE pref."user_id" = audience."user_id" AND pref."app_key" = 'chc_artists' AND pref."category" = 'submission_updates' AND pref."enabled" = 0);
  INSERT INTO "private.notification_deliveries" ("notification_id", "device_id", "provider")
    SELECT n."id", d."id", d."provider" FROM "public.notifications" n
    JOIN "public.notification_devices" d ON d."user_id" = n."user_id" AND d."app_key" = n."app_key" AND d."enabled" = 1 AND d."provider" IN ('expo', 'web_push')
    WHERE n.rowid > (SELECT "value" FROM "private.trigger_marks" WHERE "name" = 'notifications')
    ON CONFLICT ("notification_id", "device_id") DO NOTHING;
END;

CREATE TRIGGER "music.releases_notify_release_published_insert" AFTER INSERT ON "music.releases"
FOR EACH ROW WHEN ((SELECT "depth" FROM "private.replica_mode") = 0) AND (NEW."publication_status" = 'published')
BEGIN
  UPDATE "private.trigger_marks" SET "value" = (SELECT coalesce(max(rowid), 0) FROM "public.notifications") WHERE "name" = 'notifications';
  INSERT INTO "public.notifications" ("user_id", "app_key", "category", "event_type", "title", "body", "deep_link", "image_url", "payload")
    SELECT audience."user_id", 'chc', 'followed_artists', 'release_published', 'New from ' || coalesce((SELECT a."display_name" FROM "music.artists" a WHERE a."id" = NEW."primary_artist_id"), 'Coptic Vine'), NEW."title" || ' is now available on Coptic Vine.', '/music/release/' || NEW."id", NULL, '{' || '"artist_id": ' || json_quote(NEW."primary_artist_id") || ', "release_id": ' || json_quote(NEW."id") || '}'
    FROM (SELECT f."user_id" FROM "music.artist_follows" f WHERE f."artist_id" = NEW."primary_artist_id") audience
    WHERE audience."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "public.notification_preferences" pref
      WHERE pref."user_id" = audience."user_id" AND pref."app_key" = 'chc' AND pref."category" = 'followed_artists' AND pref."enabled" = 0);
  INSERT INTO "private.notification_deliveries" ("notification_id", "device_id", "provider")
    SELECT n."id", d."id", d."provider" FROM "public.notifications" n
    JOIN "public.notification_devices" d ON d."user_id" = n."user_id" AND d."app_key" = n."app_key" AND d."enabled" = 1 AND d."provider" IN ('expo', 'web_push')
    WHERE n.rowid > (SELECT "value" FROM "private.trigger_marks" WHERE "name" = 'notifications')
    ON CONFLICT ("notification_id", "device_id") DO NOTHING;
  UPDATE "private.trigger_marks" SET "value" = (SELECT coalesce(max(rowid), 0) FROM "public.notifications") WHERE "name" = 'notifications';
  INSERT INTO "public.notifications" ("user_id", "app_key", "category", "event_type", "title", "body", "deep_link", "image_url", "payload")
    SELECT audience."user_id", 'chc_artists', 'release_updates', 'release_published', 'Release is live', NEW."title" || ' is now available on Coptic Vine.', '/release/' || NEW."id", NULL, '{' || '"release_id": ' || json_quote(NEW."id") || '}'
    FROM (SELECT DISTINCT m."user_id" FROM "creator.creator_account_members" m WHERE m."creator_account_id" = NEW."owner_creator_account_id") audience
    WHERE audience."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "public.notification_preferences" pref
      WHERE pref."user_id" = audience."user_id" AND pref."app_key" = 'chc_artists' AND pref."category" = 'release_updates' AND pref."enabled" = 0);
  INSERT INTO "private.notification_deliveries" ("notification_id", "device_id", "provider")
    SELECT n."id", d."id", d."provider" FROM "public.notifications" n
    JOIN "public.notification_devices" d ON d."user_id" = n."user_id" AND d."app_key" = n."app_key" AND d."enabled" = 1 AND d."provider" IN ('expo', 'web_push')
    WHERE n.rowid > (SELECT "value" FROM "private.trigger_marks" WHERE "name" = 'notifications')
    ON CONFLICT ("notification_id", "device_id") DO NOTHING;
END;

CREATE TRIGGER "music.releases_notify_release_published_update" AFTER UPDATE OF "publication_status" ON "music.releases"
FOR EACH ROW WHEN ((SELECT "depth" FROM "private.replica_mode") = 0) AND (NEW."publication_status" = 'published' AND OLD."publication_status" <> 'published')
BEGIN
  UPDATE "private.trigger_marks" SET "value" = (SELECT coalesce(max(rowid), 0) FROM "public.notifications") WHERE "name" = 'notifications';
  INSERT INTO "public.notifications" ("user_id", "app_key", "category", "event_type", "title", "body", "deep_link", "image_url", "payload")
    SELECT audience."user_id", 'chc', 'followed_artists', 'release_published', 'New from ' || coalesce((SELECT a."display_name" FROM "music.artists" a WHERE a."id" = NEW."primary_artist_id"), 'Coptic Vine'), NEW."title" || ' is now available on Coptic Vine.', '/music/release/' || NEW."id", NULL, '{' || '"artist_id": ' || json_quote(NEW."primary_artist_id") || ', "release_id": ' || json_quote(NEW."id") || '}'
    FROM (SELECT f."user_id" FROM "music.artist_follows" f WHERE f."artist_id" = NEW."primary_artist_id") audience
    WHERE audience."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "public.notification_preferences" pref
      WHERE pref."user_id" = audience."user_id" AND pref."app_key" = 'chc' AND pref."category" = 'followed_artists' AND pref."enabled" = 0);
  INSERT INTO "private.notification_deliveries" ("notification_id", "device_id", "provider")
    SELECT n."id", d."id", d."provider" FROM "public.notifications" n
    JOIN "public.notification_devices" d ON d."user_id" = n."user_id" AND d."app_key" = n."app_key" AND d."enabled" = 1 AND d."provider" IN ('expo', 'web_push')
    WHERE n.rowid > (SELECT "value" FROM "private.trigger_marks" WHERE "name" = 'notifications')
    ON CONFLICT ("notification_id", "device_id") DO NOTHING;
  UPDATE "private.trigger_marks" SET "value" = (SELECT coalesce(max(rowid), 0) FROM "public.notifications") WHERE "name" = 'notifications';
  INSERT INTO "public.notifications" ("user_id", "app_key", "category", "event_type", "title", "body", "deep_link", "image_url", "payload")
    SELECT audience."user_id", 'chc_artists', 'release_updates', 'release_published', 'Release is live', NEW."title" || ' is now available on Coptic Vine.', '/release/' || NEW."id", NULL, '{' || '"release_id": ' || json_quote(NEW."id") || '}'
    FROM (SELECT DISTINCT m."user_id" FROM "creator.creator_account_members" m WHERE m."creator_account_id" = NEW."owner_creator_account_id") audience
    WHERE audience."user_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "public.notification_preferences" pref
      WHERE pref."user_id" = audience."user_id" AND pref."app_key" = 'chc_artists' AND pref."category" = 'release_updates' AND pref."enabled" = 0);
  INSERT INTO "private.notification_deliveries" ("notification_id", "device_id", "provider")
    SELECT n."id", d."id", d."provider" FROM "public.notifications" n
    JOIN "public.notification_devices" d ON d."user_id" = n."user_id" AND d."app_key" = n."app_key" AND d."enabled" = 1 AND d."provider" IN ('expo', 'web_push')
    WHERE n.rowid > (SELECT "value" FROM "private.trigger_marks" WHERE "name" = 'notifications')
    ON CONFLICT ("notification_id", "device_id") DO NOTHING;
END;

CREATE TRIGGER "public.notification_broadcasts_transaction_time_insert" AFTER INSERT ON "public.notification_broadcasts"
FOR EACH ROW WHEN (SELECT "at" FROM "private.transaction" WHERE "id" = 1) IS NOT NULL AND (SELECT "depth" FROM "private.replica_mode") = 0 AND (NEW."created_at" IS (rtrim(rtrim(strftime('%Y-%m-%dT%H:%M:%f', 'now'), '0'), '.') || '+00:00'))
BEGIN
  UPDATE "private.replica_mode" SET "depth" = "depth" + 1;
  UPDATE "public.notification_broadcasts" SET "created_at" = CASE WHEN "created_at" IS (rtrim(rtrim(strftime('%Y-%m-%dT%H:%M:%f', 'now'), '0'), '.') || '+00:00') THEN (SELECT "at" FROM "private.transaction" WHERE "id" = 1) ELSE "created_at" END WHERE rowid = NEW.rowid;
  UPDATE "private.replica_mode" SET "depth" = "depth" - 1;
END;

CREATE TRIGGER "public.notification_broadcasts_undo_delete" AFTER DELETE ON "public.notification_broadcasts"
FOR EACH ROW WHEN (SELECT "current" FROM "private.transaction" WHERE "id" = 1) IS NOT NULL
BEGIN
  INSERT INTO "private.undo_log" ("txn", "table_name", "op", "row", "old") VALUES ((SELECT "current" FROM "private.transaction" WHERE "id" = 1), 'public.notification_broadcasts', 'delete', OLD.rowid, json_object('id', OLD."id", 'app_key', OLD."app_key", 'category', OLD."category", 'title', OLD."title", 'body', OLD."body", 'deep_link', OLD."deep_link", 'payload', OLD."payload", 'created_by', OLD."created_by", 'recipient_count', OLD."recipient_count", 'delivery_count', OLD."delivery_count", 'created_at', OLD."created_at"));
END;

CREATE TRIGGER "public.notification_broadcasts_undo_insert" AFTER INSERT ON "public.notification_broadcasts"
FOR EACH ROW WHEN (SELECT "current" FROM "private.transaction" WHERE "id" = 1) IS NOT NULL
BEGIN
  INSERT INTO "private.undo_log" ("txn", "table_name", "op", "row", "old") VALUES ((SELECT "current" FROM "private.transaction" WHERE "id" = 1), 'public.notification_broadcasts', 'insert', NEW.rowid, NULL);
END;

CREATE TRIGGER "public.notification_broadcasts_undo_update" AFTER UPDATE ON "public.notification_broadcasts"
FOR EACH ROW WHEN (SELECT "current" FROM "private.transaction" WHERE "id" = 1) IS NOT NULL
BEGIN
  INSERT INTO "private.undo_log" ("txn", "table_name", "op", "row", "old") VALUES ((SELECT "current" FROM "private.transaction" WHERE "id" = 1), 'public.notification_broadcasts', 'update', OLD.rowid, json_object('id', OLD."id", 'app_key', OLD."app_key", 'category', OLD."category", 'title', OLD."title", 'body', OLD."body", 'deep_link', OLD."deep_link", 'payload', OLD."payload", 'created_by', OLD."created_by", 'recipient_count', OLD."recipient_count", 'delivery_count', OLD."delivery_count", 'created_at', OLD."created_at"));
END;

CREATE TRIGGER "public.notification_devices_transaction_time_insert" AFTER INSERT ON "public.notification_devices"
FOR EACH ROW WHEN (SELECT "at" FROM "private.transaction" WHERE "id" = 1) IS NOT NULL AND (SELECT "depth" FROM "private.replica_mode") = 0 AND (NEW."last_seen_at" IS (rtrim(rtrim(strftime('%Y-%m-%dT%H:%M:%f', 'now'), '0'), '.') || '+00:00') OR NEW."created_at" IS (rtrim(rtrim(strftime('%Y-%m-%dT%H:%M:%f', 'now'), '0'), '.') || '+00:00') OR NEW."updated_at" IS (rtrim(rtrim(strftime('%Y-%m-%dT%H:%M:%f', 'now'), '0'), '.') || '+00:00'))
BEGIN
  UPDATE "private.replica_mode" SET "depth" = "depth" + 1;
  UPDATE "public.notification_devices" SET "last_seen_at" = CASE WHEN "last_seen_at" IS (rtrim(rtrim(strftime('%Y-%m-%dT%H:%M:%f', 'now'), '0'), '.') || '+00:00') THEN (SELECT "at" FROM "private.transaction" WHERE "id" = 1) ELSE "last_seen_at" END, "created_at" = CASE WHEN "created_at" IS (rtrim(rtrim(strftime('%Y-%m-%dT%H:%M:%f', 'now'), '0'), '.') || '+00:00') THEN (SELECT "at" FROM "private.transaction" WHERE "id" = 1) ELSE "created_at" END, "updated_at" = CASE WHEN "updated_at" IS (rtrim(rtrim(strftime('%Y-%m-%dT%H:%M:%f', 'now'), '0'), '.') || '+00:00') THEN (SELECT "at" FROM "private.transaction" WHERE "id" = 1) ELSE "updated_at" END WHERE rowid = NEW.rowid;
  UPDATE "private.replica_mode" SET "depth" = "depth" - 1;
END;

CREATE TRIGGER "public.notification_devices_undo_delete" AFTER DELETE ON "public.notification_devices"
FOR EACH ROW WHEN (SELECT "current" FROM "private.transaction" WHERE "id" = 1) IS NOT NULL
BEGIN
  INSERT INTO "private.undo_log" ("txn", "table_name", "op", "row", "old") VALUES ((SELECT "current" FROM "private.transaction" WHERE "id" = 1), 'public.notification_devices', 'delete', OLD.rowid, json_object('id', OLD."id", 'user_id', OLD."user_id", 'app_key', OLD."app_key", 'platform', OLD."platform", 'provider', OLD."provider", 'push_token', OLD."push_token", 'provider_data', OLD."provider_data", 'device_name', OLD."device_name", 'app_version', OLD."app_version", 'enabled', OLD."enabled", 'last_seen_at', OLD."last_seen_at", 'created_at', OLD."created_at", 'updated_at', OLD."updated_at"));
END;

CREATE TRIGGER "public.notification_devices_undo_insert" AFTER INSERT ON "public.notification_devices"
FOR EACH ROW WHEN (SELECT "current" FROM "private.transaction" WHERE "id" = 1) IS NOT NULL
BEGIN
  INSERT INTO "private.undo_log" ("txn", "table_name", "op", "row", "old") VALUES ((SELECT "current" FROM "private.transaction" WHERE "id" = 1), 'public.notification_devices', 'insert', NEW.rowid, NULL);
END;

CREATE TRIGGER "public.notification_devices_undo_update" AFTER UPDATE ON "public.notification_devices"
FOR EACH ROW WHEN (SELECT "current" FROM "private.transaction" WHERE "id" = 1) IS NOT NULL
BEGIN
  INSERT INTO "private.undo_log" ("txn", "table_name", "op", "row", "old") VALUES ((SELECT "current" FROM "private.transaction" WHERE "id" = 1), 'public.notification_devices', 'update', OLD.rowid, json_object('id', OLD."id", 'user_id', OLD."user_id", 'app_key', OLD."app_key", 'platform', OLD."platform", 'provider', OLD."provider", 'push_token', OLD."push_token", 'provider_data', OLD."provider_data", 'device_name', OLD."device_name", 'app_version', OLD."app_version", 'enabled', OLD."enabled", 'last_seen_at', OLD."last_seen_at", 'created_at', OLD."created_at", 'updated_at', OLD."updated_at"));
END;

CREATE TRIGGER "public.notification_preferences_transaction_time_insert" AFTER INSERT ON "public.notification_preferences"
FOR EACH ROW WHEN (SELECT "at" FROM "private.transaction" WHERE "id" = 1) IS NOT NULL AND (SELECT "depth" FROM "private.replica_mode") = 0 AND (NEW."created_at" IS (rtrim(rtrim(strftime('%Y-%m-%dT%H:%M:%f', 'now'), '0'), '.') || '+00:00') OR NEW."updated_at" IS (rtrim(rtrim(strftime('%Y-%m-%dT%H:%M:%f', 'now'), '0'), '.') || '+00:00'))
BEGIN
  UPDATE "private.replica_mode" SET "depth" = "depth" + 1;
  UPDATE "public.notification_preferences" SET "created_at" = CASE WHEN "created_at" IS (rtrim(rtrim(strftime('%Y-%m-%dT%H:%M:%f', 'now'), '0'), '.') || '+00:00') THEN (SELECT "at" FROM "private.transaction" WHERE "id" = 1) ELSE "created_at" END, "updated_at" = CASE WHEN "updated_at" IS (rtrim(rtrim(strftime('%Y-%m-%dT%H:%M:%f', 'now'), '0'), '.') || '+00:00') THEN (SELECT "at" FROM "private.transaction" WHERE "id" = 1) ELSE "updated_at" END WHERE rowid = NEW.rowid;
  UPDATE "private.replica_mode" SET "depth" = "depth" - 1;
END;

CREATE TRIGGER "public.notification_preferences_undo_delete" AFTER DELETE ON "public.notification_preferences"
FOR EACH ROW WHEN (SELECT "current" FROM "private.transaction" WHERE "id" = 1) IS NOT NULL
BEGIN
  INSERT INTO "private.undo_log" ("txn", "table_name", "op", "row", "old") VALUES ((SELECT "current" FROM "private.transaction" WHERE "id" = 1), 'public.notification_preferences', 'delete', OLD.rowid, json_object('user_id', OLD."user_id", 'app_key', OLD."app_key", 'category', OLD."category", 'enabled', OLD."enabled", 'created_at', OLD."created_at", 'updated_at', OLD."updated_at"));
END;

CREATE TRIGGER "public.notification_preferences_undo_insert" AFTER INSERT ON "public.notification_preferences"
FOR EACH ROW WHEN (SELECT "current" FROM "private.transaction" WHERE "id" = 1) IS NOT NULL
BEGIN
  INSERT INTO "private.undo_log" ("txn", "table_name", "op", "row", "old") VALUES ((SELECT "current" FROM "private.transaction" WHERE "id" = 1), 'public.notification_preferences', 'insert', NEW.rowid, NULL);
END;

CREATE TRIGGER "public.notification_preferences_undo_update" AFTER UPDATE ON "public.notification_preferences"
FOR EACH ROW WHEN (SELECT "current" FROM "private.transaction" WHERE "id" = 1) IS NOT NULL
BEGIN
  INSERT INTO "private.undo_log" ("txn", "table_name", "op", "row", "old") VALUES ((SELECT "current" FROM "private.transaction" WHERE "id" = 1), 'public.notification_preferences', 'update', OLD.rowid, json_object('user_id', OLD."user_id", 'app_key', OLD."app_key", 'category', OLD."category", 'enabled', OLD."enabled", 'created_at', OLD."created_at", 'updated_at', OLD."updated_at"));
END;

CREATE TRIGGER "public.notifications_transaction_time_insert" AFTER INSERT ON "public.notifications"
FOR EACH ROW WHEN (SELECT "at" FROM "private.transaction" WHERE "id" = 1) IS NOT NULL AND (SELECT "depth" FROM "private.replica_mode") = 0 AND (NEW."created_at" IS (rtrim(rtrim(strftime('%Y-%m-%dT%H:%M:%f', 'now'), '0'), '.') || '+00:00'))
BEGIN
  UPDATE "private.replica_mode" SET "depth" = "depth" + 1;
  UPDATE "public.notifications" SET "created_at" = CASE WHEN "created_at" IS (rtrim(rtrim(strftime('%Y-%m-%dT%H:%M:%f', 'now'), '0'), '.') || '+00:00') THEN (SELECT "at" FROM "private.transaction" WHERE "id" = 1) ELSE "created_at" END WHERE rowid = NEW.rowid;
  UPDATE "private.replica_mode" SET "depth" = "depth" - 1;
END;

CREATE TRIGGER "public.notifications_undo_delete" AFTER DELETE ON "public.notifications"
FOR EACH ROW WHEN (SELECT "current" FROM "private.transaction" WHERE "id" = 1) IS NOT NULL
BEGIN
  INSERT INTO "private.undo_log" ("txn", "table_name", "op", "row", "old") VALUES ((SELECT "current" FROM "private.transaction" WHERE "id" = 1), 'public.notifications', 'delete', OLD.rowid, json_object('id', OLD."id", 'user_id', OLD."user_id", 'app_key', OLD."app_key", 'category', OLD."category", 'event_type', OLD."event_type", 'title', OLD."title", 'body', OLD."body", 'image_url', OLD."image_url", 'deep_link', OLD."deep_link", 'payload', OLD."payload", 'created_at', OLD."created_at", 'read_at', OLD."read_at"));
END;

CREATE TRIGGER "public.notifications_undo_insert" AFTER INSERT ON "public.notifications"
FOR EACH ROW WHEN (SELECT "current" FROM "private.transaction" WHERE "id" = 1) IS NOT NULL
BEGIN
  INSERT INTO "private.undo_log" ("txn", "table_name", "op", "row", "old") VALUES ((SELECT "current" FROM "private.transaction" WHERE "id" = 1), 'public.notifications', 'insert', NEW.rowid, NULL);
END;

CREATE TRIGGER "public.notifications_undo_update" AFTER UPDATE ON "public.notifications"
FOR EACH ROW WHEN (SELECT "current" FROM "private.transaction" WHERE "id" = 1) IS NOT NULL
BEGIN
  INSERT INTO "private.undo_log" ("txn", "table_name", "op", "row", "old") VALUES ((SELECT "current" FROM "private.transaction" WHERE "id" = 1), 'public.notifications', 'update', OLD.rowid, json_object('id', OLD."id", 'user_id', OLD."user_id", 'app_key', OLD."app_key", 'category', OLD."category", 'event_type', OLD."event_type", 'title', OLD."title", 'body', OLD."body", 'image_url', OLD."image_url", 'deep_link', OLD."deep_link", 'payload', OLD."payload", 'created_at', OLD."created_at", 'read_at', OLD."read_at"));
END;
