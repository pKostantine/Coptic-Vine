-- The content revision the offline books were last asked to be rebuilt for.
-- The Worker's minute cron (src/publish.ts) compares it with
-- "offline_content.revision" and starts the GitHub publish Action when the
-- content has moved on and has been quiet for two minutes. Revision 0, so the
-- first check after this migration asks for a build.
CREATE TABLE "offline_content.publish_requests" (
  "id" INTEGER PRIMARY KEY CHECK ("id" = 1),
  "revision" INTEGER NOT NULL,
  "requested_at" TEXT,
  "failed_at" TEXT,
  "last_error" TEXT
) STRICT;
INSERT INTO "offline_content.publish_requests" ("id", "revision", "requested_at", "failed_at", "last_error") VALUES (1, 0, NULL, NULL, NULL);
