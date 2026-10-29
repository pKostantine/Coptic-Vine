-- The beta's feedback (workers/api/src/rpc/feedback.ts): what the app's
-- testers report as they test it -- a bug, an idea, or a fault in a text --
-- numbered as issues are, and public: anyone may read it, and file one,
-- signed in or not. An admin sets each one's status. cv-api's own table, as
-- Supabase never had it; temporary, for the beta.

CREATE TABLE IF NOT EXISTS "public.beta_feedback" (
  "id" TEXT PRIMARY KEY,
  "number" INTEGER NOT NULL UNIQUE,
  "kind" TEXT NOT NULL CHECK ("kind" IN ('bug', 'idea', 'text')),
  "title" TEXT NOT NULL CHECK (length("title") BETWEEN 1 AND 120),
  "details" TEXT NOT NULL DEFAULT '' CHECK (length("details") <= 4000),
  "area" TEXT CHECK ("area" IS NULL OR length("area") <= 120),
  "device" TEXT CHECK ("device" IS NULL OR length("device") <= 200),
  "reporter_name" TEXT CHECK ("reporter_name" IS NULL OR length("reporter_name") <= 80),
  "user_id" TEXT REFERENCES "auth.users" ("id") ON DELETE SET NULL,
  "status" TEXT NOT NULL DEFAULT 'open' CHECK ("status" IN ('open', 'planned', 'fixed', 'not_planned', 'duplicate')),
  "status_note" TEXT CHECK ("status_note" IS NULL OR length("status_note") <= 500),
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS "public.beta_feedback_created_idx" ON "public.beta_feedback" ("created_at");
CREATE INDEX IF NOT EXISTS "public.beta_feedback_user_idx" ON "public.beta_feedback" ("user_id", "created_at");
