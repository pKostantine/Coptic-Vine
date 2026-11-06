-- The spiritual canon's instructions (workers/api/src/rpc/canonNotes.ts): what
-- a believer's father of confession told them of their rule, written down to
-- keep beside it. One per account, and only its own: read and saved through
-- get_my_canon_instructions and save_my_canon_instructions, the later copy
-- winning. cv-api's own table, as Supabase never had it.

CREATE TABLE IF NOT EXISTS "public.spiritual_canon_notes" (
  "user_id" TEXT PRIMARY KEY REFERENCES "auth.users" ("id") ON DELETE CASCADE,
  "instructions" TEXT NOT NULL DEFAULT '' CHECK (length("instructions") <= 20000),
  "updated_at" TEXT NOT NULL
) STRICT;
