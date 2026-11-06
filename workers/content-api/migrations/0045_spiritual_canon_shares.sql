-- Parts of a spiritual canon shared with friends (workers/api/src/rpc/canonShares.ts):
-- a copy of the items a believer chose, kept under a link only they hand out,
-- so a friend, a support group, can read it and take any of it into their own
-- canon. Only with the blessing of their father of confession, as the app
-- asks before it makes the link. A copy, not the canon itself: what is
-- changed after isn't shared. The one who shared it sees their links and can
-- stop any of them; whoever has a link reads only what it holds, never who
-- made it beyond the name they chose to show. cv-api's own table, as Supabase
-- never had it.

CREATE TABLE IF NOT EXISTS "public.spiritual_canon_shares" (
  "id" TEXT PRIMARY KEY CHECK (length("id") BETWEEN 16 AND 64),
  "user_id" TEXT NOT NULL REFERENCES "auth.users" ("id") ON DELETE CASCADE,
  "sharer_name" TEXT CHECK ("sharer_name" IS NULL OR length("sharer_name") <= 80),
  "message" TEXT CHECK ("message" IS NULL OR length("message") <= 1000),
  "items" TEXT NOT NULL CHECK (json_valid("items") AND json_type("items") = 'array' AND json_array_length("items") BETWEEN 1 AND 40 AND length("items") <= 200000),
  "instructions" TEXT CHECK ("instructions" IS NULL OR length("instructions") <= 20000),
  "created_at" TEXT NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS "public.spiritual_canon_shares_user_idx" ON "public.spiritual_canon_shares" ("user_id", "created_at");
