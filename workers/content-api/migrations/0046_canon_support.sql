-- Support people for a spiritual canon (workers/api/src/rpc/canonSupport.ts):
-- a believer sends an invite link to the friends, the support group, who keep
-- them in prayer; whoever accepts it while signed in becomes one of their
-- support people and sees their canon, as it is now and as they keep it day
-- by day, in their own app. Only with the blessing of their father of
-- confession, as the app says before the link is made. cv-api's own tables,
-- as Supabase never had them. They replace the one-time copies of 0045, which
-- nothing reads any more.

-- An invite link: anyone who opens it may accept it, until the believer
-- turns it off (deletes it). The name and message are what the link shows;
-- with_instructions says whether those who accept it read the father of
-- confession's instructions too.
CREATE TABLE IF NOT EXISTS "public.canon_support_invites" (
  "id" TEXT PRIMARY KEY CHECK (length("id") BETWEEN 16 AND 64),
  "user_id" TEXT NOT NULL REFERENCES "auth.users" ("id") ON DELETE CASCADE,
  "sharer_name" TEXT CHECK ("sharer_name" IS NULL OR length("sharer_name") <= 80),
  "message" TEXT CHECK ("message" IS NULL OR length("message") <= 1000),
  "with_instructions" INTEGER NOT NULL DEFAULT 0 CHECK ("with_instructions" IN (0, 1)),
  "created_at" TEXT NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS "public.canon_support_invites_user_idx" ON "public.canon_support_invites" ("user_id", "created_at");

-- A support person: user_id is the believer, supporter_id the one who
-- accepted. Turning the invite off leaves them; the believer removes them, or
-- they stop, one at a time. The id is what the supporter's app opens the
-- canon by, so neither account's id is handed to the other.
CREATE TABLE IF NOT EXISTS "public.canon_supporters" (
  "id" TEXT PRIMARY KEY CHECK (length("id") BETWEEN 16 AND 64),
  "user_id" TEXT NOT NULL REFERENCES "auth.users" ("id") ON DELETE CASCADE,
  "supporter_id" TEXT NOT NULL REFERENCES "auth.users" ("id") ON DELETE CASCADE,
  "sharer_name" TEXT CHECK ("sharer_name" IS NULL OR length("sharer_name") <= 80),
  "with_instructions" INTEGER NOT NULL DEFAULT 0 CHECK ("with_instructions" IN (0, 1)),
  "created_at" TEXT NOT NULL,
  UNIQUE ("user_id", "supporter_id"),
  CHECK ("user_id" <> "supporter_id")
) STRICT;

CREATE INDEX IF NOT EXISTS "public.canon_supporters_supporter_idx" ON "public.canon_supporters" ("supporter_id", "created_at");
