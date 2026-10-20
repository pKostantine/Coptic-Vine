# Phase 2 inventory: users, auth and user data

This is step 1 of [Phase 2 of the D1 plan](../coptic-vine-d1-plan.md#5-phase-2-users-and-auth-after-phase-1),
taken on 20 Oct 2026. It lists everything outside liturgical content that
still talks to Supabase:

- the Coptic-Vine app and its Workers;
- CV-Admin;
- CV-Artists;
- the database itself.

The database figures come from Supabase's catalog, read-only. No user rows
were read.

## The database

| Schema | Tables | Rows | Policies | Foreign keys to `auth.users` | Triggers |
|---|---:|---:|---:|---:|---:|
| `creator` | 4 | 14 | 14 | 7 | 3 |
| `learning` | 25 | 124 | 61 | 22 | 36 |
| `media` | 12 | 419 | 21 | 12 | 15 |
| `music` | 21 | 347 | 66 | 22 | 30 |
| `private` | 2 | 2 | 0 | 0 | 0 |
| `public` (user tables) | 9 | 75 | 30 | 9 | 0 |
| **Total** | **73** | **981** | **192** | **72** | **84** |

- **Accounts.** There are 4 users in `auth.users`.
  - Sign-in providers in use: email and Google.
  - 3 accounts have a password.
  - No MFA is set up.
- **Functions.** There are 283 outside the content schemas:
  - 203 can be called by `anon` or `authenticated`;
  - 63 are internal helpers;
  - 17 are trigger functions;
  - 124 use `auth.uid()`;
  - together they hold about 608,000 characters of SQL.
- **Permissions in the policies.** The policies use about 35 helpers in
  `private`. The most used are:
  - `is_admin` (35 uses)
  - `can_edit_creator_account` (24)
  - `music_track_is_editable` (15)
  - `music_publication_is_creator_mutable` (14)
  - `can_read_media_owner` (12)
  - the `*_is_editable` / `*_is_visible` family for music and learning

  These helpers are the permission model to port. About 65 policies are
  plain `user_id = auth.uid()` (or `owner_user_id`).
- **Triggers.**
  - About 50 keep `updated_at` current.
  - About 20 refresh the unified search index (`media.search_documents`).
  - The rest publish artwork, sync artist and cantor identities, enforce
    release rules, and queue notifications.
- **Scheduled jobs (pg_cron).**
  - `chc-publish-due-music-releases`, every minute.
  - `chc-publish-due-learning-releases`, every minute.
- **Outbound HTTP.** `private.wake_media_processor` calls the media
  processor's `/wake` through `pg_net`.
- **Storage.** Two public buckets:
  - `profile-avatars` (1 object);
  - `playlist-covers` (empty).

  All other media is already in R2.
- **Not used.** Realtime has no published tables. The 15 Edge Functions are
  one-off content tools from August and September 2026, and nothing calls
  them.

## The API surface to re-implement

These are the unique names called from code; there are more call sites.

| Caller | RPCs | Tables read or written directly | Other |
|---|---:|---|---|
| App: music | 22 | | |
| App: learning | 19 | | |
| App: search | 2 | | |
| App: user data | 4 | `notification_preferences`, `notifications`, `spiritual_canons`, `spiritual_canon_days`, `bible_highlights`, `sermon_plans` (select, upsert, update) | Storage: `profile-avatars`, `playlist-covers` |
| CV-Admin: admin | 26 | `notification_preferences`, `notifications` | |
| Creator editor (CV-Artists; 9 also in CV-Admin) | 25 (2 unused) | | |
| CV-Artists: lyrics studio | 9 | | |
| Media processor | 16 | | Called by `pg_net`; forwards the admin's token |
| Upload authorizer | 4 more | | Forwards the user's token |
| Notification dispatcher | 5 | | Service-role key; Expo Push and Web Push |
| Share previews (web-app Worker) | 2 | | Anon |

That comes to about **134 RPCs**, plus 6 tables, 2 buckets, 2 cron jobs, 3
notification triggers and the wake call.

**Auth flows in use**

- **Coptic-Vine:**
  - Email and password: sign-up with a confirmation email, resend, recovery
    (`PASSWORD_RECOVERY`), changing email and changing password.
  - Google through the web OAuth flow in an in-app browser. The flow is
    implicit, and the callback goes to `copticvine://account` or
    `https://copticvine.ca/account`.
  - Native Google sign-in is installed (`@react-native-google-signin`) but
    never called.
- **CV-Admin:** email and password only. `is_chc_admin` gates the site.
- **CV-Artists:** email and password, and Google OAuth with PKCE
  (`copticvineartists://auth/callback`).
- **Profile data:** kept in auth `user_metadata` (`full_name`,
  `chc_avatar_url`). There is no profiles table.

## What the port has to get right

1. **Ownership comes from the session.** Several reads filter by nothing but
   a key and rely on RLS to add `user_id = auth.uid()`:
   - the notifications list, and marking a notification read;
   - the spiritual canon (`.maybeSingle()`);
   - Bible highlights;
   - sermon plans.

   Upserts send `user_id` in the body. The Worker must ignore it and use
   the session's user.
2. **Same user IDs.** Several things are keyed by the Supabase UUID:
   - storage paths (`<uid>/avatar`);
   - device caches (spiritual canon, music player, reading preferences);
   - the 72 foreign keys.
3. **Supabase URLs stored as data.** `user_metadata.chc_avatar_url` and
   playlist-cover media assets hold Supabase Storage URLs. They move to R2
   and need rewriting.
4. **Workers trust Supabase's JWT.**
   - The upload authorizer and the media processor's admin routes pass the
     user's token on to PostgREST.
   - The notification dispatcher uses the service-role key.

   All of them must check the new session themselves, or call the new API
   with a token of their own.
5. **Database functions read `auth.users`.**
   `ensure_creator_workspace` reads `raw_user_meta_data`, and the admin RPCs
   read emails.
6. **Push devices.** A device can register while signed out, and moves to
   the account on sign-in. Sign-out disables it first, with a 4-second
   limit.
7. **Tests that stub Supabase.**
   - 13 in Coptic-Vine.
   - 4 in the media processor.
   - 2 in CV-Artists.

## Proposed order (to confirm)

1. **Schema and copy.**
   - The 73 tables go to D1 with quoted `"schema.table"` names.
   - Auth tables come first: `"auth.users"`, sessions, accounts and
     verifications. They are written through a small Better Auth adapter
     that builds every name with `t()`, because Better Auth's Kysely path
     would read `auth.users` as an attached database.
   - A re-runnable import, verified by checksums like Phase 1's.
2. **Auth Worker** (`cv-api`, for example `api.copticvine.ca`):
   - Better Auth: email and password with the existing bcrypt hashes, and
     Google;
   - Sign in with Apple;
   - emails for confirmation and recovery.
3. **API.** The ~134 RPCs and 6 tables, in the same request shape as
   Supabase's REST API, so the three apps keep their supabase-js data calls
   with a new client.
   - The policies become checks in Worker code, through one helper that
     applies ownership.
   - Attack tests try to read and write other users' rows.
4. **Parity.** Each RPC runs against the real Postgres functions in PGlite
   (seeded from the catalog) and against the Worker on a local D1. This
   covers writes too, without writing to Supabase.
5. **Jobs.**
   - The two cron jobs and the notification triggers become Workers Cron
     Triggers and Worker code.
   - The media processor, upload authorizer and dispatcher move to the new
     API.
   - The buckets move to R2.
6. **One cutover for all user data.** Every policy depends on the signed-in
   user, so auth and data have to move together. With 4 users, this is a
   short freeze, after which everyone signs in again once.
