-- The lease a run of cv-api's release jobs takes (workers/api/src/jobs/releases.ts), so
-- no two runs publish at once, as pg_cron never ran a job beside its own last run.
CREATE TABLE "private.job_lease" ("name" TEXT PRIMARY KEY, "holder" TEXT, "until" TEXT) STRICT;
INSERT INTO "private.job_lease" VALUES ('releases', NULL, NULL);
