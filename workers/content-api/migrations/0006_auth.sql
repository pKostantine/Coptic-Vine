-- The sign-in tables (Phase 2 of docs/coptic-vine-d1-plan.md): Better Auth's
-- user, session, account and verification models, written through the
-- adapter in workers/api/src/auth/adapter.ts with snake_case columns.
--
-- "auth.users" keeps Supabase's user ids, so the 72 foreign keys from the user
-- data (0007) and everything keyed by the id (storage paths, device caches)
-- carry over. raw_user_meta_data and raw_app_meta_data keep what Supabase
-- held there (full_name, chc_avatar_url, the sign-up provider), which the
-- app and the ported functions still read.
--
-- Timestamps are written as Supabase's REST API prints them, always UTC
-- (2026-10-20T19:52:43.123+00:00), like every timestamp in 0007.
CREATE TABLE "auth.users" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "email_verified" INTEGER NOT NULL DEFAULT 0 CHECK ("email_verified" IN (0, 1)),
  "image" TEXT,
  "raw_user_meta_data" TEXT NOT NULL DEFAULT '{}' CHECK (json_valid("raw_user_meta_data") AND json_type("raw_user_meta_data") = 'object'),
  "raw_app_meta_data" TEXT NOT NULL DEFAULT '{}' CHECK (json_valid("raw_app_meta_data") AND json_type("raw_app_meta_data") = 'object'),
  "created_at" TEXT NOT NULL CHECK ("created_at" GLOB '????-??-??T??:??:??*+00:00' AND datetime(substr("created_at", 1, 19)) IS NOT NULL AND (length("created_at") = 25 OR (substr("created_at", 20, 1) = '.' AND length("created_at") BETWEEN 27 AND 32 AND substr("created_at", 21, length("created_at") - 26) NOT GLOB '*[^0-9]*'))),
  "updated_at" TEXT NOT NULL CHECK ("updated_at" GLOB '????-??-??T??:??:??*+00:00' AND datetime(substr("updated_at", 1, 19)) IS NOT NULL AND (length("updated_at") = 25 OR (substr("updated_at", 20, 1) = '.' AND length("updated_at") BETWEEN 27 AND 32 AND substr("updated_at", 21, length("updated_at") - 26) NOT GLOB '*[^0-9]*'))),
  PRIMARY KEY ("id"),
  CHECK ("email" = lower("email"))
) STRICT;
CREATE UNIQUE INDEX "auth.users_email_key" ON "auth.users" ("email");

CREATE TABLE "auth.sessions" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "expires_at" TEXT NOT NULL CHECK ("expires_at" GLOB '????-??-??T??:??:??*+00:00' AND datetime(substr("expires_at", 1, 19)) IS NOT NULL AND (length("expires_at") = 25 OR (substr("expires_at", 20, 1) = '.' AND length("expires_at") BETWEEN 27 AND 32 AND substr("expires_at", 21, length("expires_at") - 26) NOT GLOB '*[^0-9]*'))),
  "ip_address" TEXT,
  "user_agent" TEXT,
  "created_at" TEXT NOT NULL CHECK ("created_at" GLOB '????-??-??T??:??:??*+00:00' AND datetime(substr("created_at", 1, 19)) IS NOT NULL AND (length("created_at") = 25 OR (substr("created_at", 20, 1) = '.' AND length("created_at") BETWEEN 27 AND 32 AND substr("created_at", 21, length("created_at") - 26) NOT GLOB '*[^0-9]*'))),
  "updated_at" TEXT NOT NULL CHECK ("updated_at" GLOB '????-??-??T??:??:??*+00:00' AND datetime(substr("updated_at", 1, 19)) IS NOT NULL AND (length("updated_at") = 25 OR (substr("updated_at", 20, 1) = '.' AND length("updated_at") BETWEEN 27 AND 32 AND substr("updated_at", 21, length("updated_at") - 26) NOT GLOB '*[^0-9]*'))),
  PRIMARY KEY ("id"),
  FOREIGN KEY ("user_id") REFERENCES "auth.users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
) STRICT;
CREATE UNIQUE INDEX "auth.sessions_token_key" ON "auth.sessions" ("token");
CREATE INDEX "auth.sessions_user_id_idx" ON "auth.sessions" ("user_id");

-- One row per way a user signs in: provider_id 'credential' (email and
-- password; account_id is the user id, password the hash, bcrypt for the
-- passwords carried over from Supabase) or 'google' (account_id is Google's
-- subject id).
CREATE TABLE "auth.accounts" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "account_id" TEXT NOT NULL,
  "provider_id" TEXT NOT NULL,
  "access_token" TEXT,
  "refresh_token" TEXT,
  "id_token" TEXT,
  "access_token_expires_at" TEXT,
  "refresh_token_expires_at" TEXT,
  "scope" TEXT,
  "password" TEXT,
  "created_at" TEXT NOT NULL CHECK ("created_at" GLOB '????-??-??T??:??:??*+00:00' AND datetime(substr("created_at", 1, 19)) IS NOT NULL AND (length("created_at") = 25 OR (substr("created_at", 20, 1) = '.' AND length("created_at") BETWEEN 27 AND 32 AND substr("created_at", 21, length("created_at") - 26) NOT GLOB '*[^0-9]*'))),
  "updated_at" TEXT NOT NULL CHECK ("updated_at" GLOB '????-??-??T??:??:??*+00:00' AND datetime(substr("updated_at", 1, 19)) IS NOT NULL AND (length("updated_at") = 25 OR (substr("updated_at", 20, 1) = '.' AND length("updated_at") BETWEEN 27 AND 32 AND substr("updated_at", 21, length("updated_at") - 26) NOT GLOB '*[^0-9]*'))),
  PRIMARY KEY ("id"),
  FOREIGN KEY ("user_id") REFERENCES "auth.users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
) STRICT;
CREATE UNIQUE INDEX "auth.accounts_provider_account_key" ON "auth.accounts" ("provider_id", "account_id");
CREATE INDEX "auth.accounts_user_id_idx" ON "auth.accounts" ("user_id");

-- Email confirmation, password reset and email change tokens.
CREATE TABLE "auth.verifications" (
  "id" TEXT NOT NULL,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expires_at" TEXT NOT NULL CHECK ("expires_at" GLOB '????-??-??T??:??:??*+00:00' AND datetime(substr("expires_at", 1, 19)) IS NOT NULL AND (length("expires_at") = 25 OR (substr("expires_at", 20, 1) = '.' AND length("expires_at") BETWEEN 27 AND 32 AND substr("expires_at", 21, length("expires_at") - 26) NOT GLOB '*[^0-9]*'))),
  "created_at" TEXT NOT NULL CHECK ("created_at" GLOB '????-??-??T??:??:??*+00:00' AND datetime(substr("created_at", 1, 19)) IS NOT NULL AND (length("created_at") = 25 OR (substr("created_at", 20, 1) = '.' AND length("created_at") BETWEEN 27 AND 32 AND substr("created_at", 21, length("created_at") - 26) NOT GLOB '*[^0-9]*'))),
  "updated_at" TEXT NOT NULL CHECK ("updated_at" GLOB '????-??-??T??:??:??*+00:00' AND datetime(substr("updated_at", 1, 19)) IS NOT NULL AND (length("updated_at") = 25 OR (substr("updated_at", 20, 1) = '.' AND length("updated_at") BETWEEN 27 AND 32 AND substr("updated_at", 21, length("updated_at") - 26) NOT GLOB '*[^0-9]*'))),
  PRIMARY KEY ("id")
) STRICT;
CREATE INDEX "auth.verifications_identifier_idx" ON "auth.verifications" ("identifier");
