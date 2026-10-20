# Coptic Vine: Move to Cloudflare D1, and the Roadmap After It

**Status:** Plan agreed with Pierre on 19 Oct 2026.
**Source database:** Supabase project `wtuujmeinzqfikvuofmh` (Postgres 17).
**Target:** Cloudflare Workers Paid, with D1 for data, Workers for the API, and R2 for files and offline packages.

This document is the reference for the whole move. Phase 1 is the part to build now. Phases 2 and 3 are described so that Phase 1 does not paint them into a corner.

---

## 1. Why we are moving

- The Supabase Free plan is over quota for the 22 Sep to 22 Oct 2026 cycle:
  - Database size: 0.616 of 0.5 GB.
  - Egress: 5.4 of 5 GB.
  - Log ingestion: 6.5 of 1 GB. This is marked "upcoming" and isn't billed yet.
- When the grace period ends (in 2027), Supabase can answer every request for the organization with HTTP 402. That would stop the app.
- Pierre already pays for Cloudflare Workers Paid and wants **one home for everything**.

## 2. Decisions already made

1. **D1 is the single database.** No long-term split between providers.
2. **Table names keep the Postgres schema as a prefix, joined with a dot:** `"liturgy.hymn_texts"`, `"public.hymn_texts"`, `"bible.verses"`.
   - These names must **always be in double quotes**. Unquoted, SQLite reads `liturgy.hymn_texts` as "table `hymn_texts` in an attached database called `liturgy`" and fails with `no such table`.
   - All SQL builds table names through one helper, for example `t('liturgy', 'hymn_texts')` returning `"liturgy.hymn_texts"`. Nobody types a table name by hand.
   - Index and trigger names follow the same pattern and are also quoted.
3. **Church customization uses layers, not copies.** A church's changes are stored as rows on top of the master text. Where a change exists, the church sees its version; everywhere else it sees the master. Master corrections reach every church immediately. See Phase 3.
4. **Condition flags are never renamed** once churches can reference them.
5. **Order values are spaced out** (10, 20, 30…) for new rows, so inserted lines don't collide.
6. **Churches hide; they never delete.**
7. **Bible text and licensed texts are never editable by churches.** The list of licensed sources is in the project doc `content-sources-inventory.md` and its spreadsheet.
8. **Auth moves to Better Auth on Workers and D1, together with the user data (Phase 2), keeping the same user IDs.** Sign in with Apple is added at the same time.
9. **Supabase stays the editing master for each area until that area's cutover.** Until then the D1 copy is read-only and is rebuilt from Supabase whenever needed.

---

## 3. Phase 0: relieve Supabase now (Pierre and chat Claude, not Claude Code)

| Item | Detail | Effect |
|---|---|---|
| `backup` schema | 295 MB in 291 tables of snapshots and staging copies. Export to a file kept in R2, then drop it (Pierre confirms first). | The database drops to roughly 0.3 GB. |
| `cron.job_run_details` | 14 MB and growing. Trim it, and run `chc-publish-due-music-releases` and `chc-publish-due-learning-releases` less often than every minute. | Smaller database and fewer log lines. |

---

## 4. Phase 1: copy all liturgical content to D1 (Claude Code, now)

### 4.1 Scope

**Copy these schemas, every table except the excluded list below:**
`agpeya`, `aspasmos`, `bible`, `calendar`, `canons`, `doxologies`, `fractions`, `gospel_responses`, `gospel_rite`, `holy_week`, `hymn_of_the_intercessions`, `litanies`, `liturgy`, `praxis_response`, `procession_of_the_cross`, `psalmody`, `readings`, `seasonal_liturgy_hymns`, `synaxarium`, `veneration`, `verses_of_the_cymbals`.

**From `public`, copy only the content tables:** `public.hymn_texts`, `public.hymn_titles`, `public.saint_order`.

**Rebuild, don't copy:** `offline_content` describes how offline packages are built. It gets a D1 equivalent (see 4.4, item 9).

**Do not copy in Phase 1.** These stay in Supabase. Pierre decides their fate separately.
- Legacy and staging tables:
  - `synaxarium.entries_old`, `synaxarium.entry_texts_old`, `synaxarium.entry_texts_split`, `synaxarium.entry_texts_align_map`, `synaxarium.entry_texts_deferred_review`, `synaxarium.entry_texts_rubric_strip`, `synaxarium.entries_rematch_proposal`, `synaxarium.arabic_orphans`
  - `gospel_responses.gospel_responses_old`, `gospel_responses.hymn_texts_old`
  - `calendar.psalms_reading_ref_map_20260827`, `calendar.psalms_ref_classification_20260827`
- `bible.new_coptic_psalter_translation`: a private working table that contains SAAS and NKJV comparison text. It must never become public.
- `bible.verse_search_normalized`: it is regenerated as FTS5 tables instead (see 4.3).
- The whole `backup` schema.

**Out of scope until Phase 2:**
- Schemas: `creator`, `learning`, `media`, `music`, `private`.
- The user tables in `public`: `bible_highlights`, `notification_broadcasts`, `notification_devices`, `notification_preferences`, `notifications`, `sermon_plans`, `spiritual_canons`, `spiritual_canon_days`, `user_content_preferences`.
- Supabase Auth.

**Size:** the content is roughly 280 MB in Postgres including indexes, and smaller in SQLite without the `tsvector` columns. The D1 limit is 10 GB per database, with 5 GB included in the plan.

### 4.2 Column type mapping

| Postgres | SQLite (D1) | Notes |
|---|---|---|
| `text` | `TEXT` | Copy byte-exact. Arabic, Coptic and French must round-trip unchanged. |
| `integer`, `bigint` | `INTEGER` | |
| `numeric`, `double precision` (`line_order`, `item_order`, `line_id`, `verse_id`) | `REAL` | These hold decimals (for example 21.5). `liturgy.hymn_texts.line_order` has at most one decimal place; 177 `bible.verses.verse_id` values are non-integers. Check the rest at import, and fail the import if any value would change. |
| `boolean` | `INTEGER` (0 or 1) | |
| `jsonb`, `json` | `TEXT` holding JSON | Use SQLite JSON functions. |
| `text[]`, `int[]` | `TEXT` holding a JSON array | |
| `date`, `timestamptz` | `TEXT` (ISO 8601) | |
| Content enums: `"Item Type"`, `"Minimization"`, `"Person Type"`, `"Prayer Type"` | `TEXT` plus a `CHECK (col IN (...))` | Values are listed in the appendix. |
| `tsvector` (7 generated columns on `bible.verses`) | dropped | Replaced by FTS5 tables (4.3). |

### 4.3 What Postgres does that D1 doesn't, and the replacement for each

| Postgres feature | Replacement |
|---|---|
| Schemas | Quoted dot names through the `t()` helper. |
| Database functions the app calls (RPC) | Worker endpoints in TypeScript that return the **same JSON** as today. The candidate list is in the appendix; confirm it against the app code. |
| Database functions used only as editing tools | Not ported (listed in the appendix). |
| Row Level Security | Phase 1 content is public and read-only. Clients get no write path to D1 at all. |
| `pg_trgm`, `unaccent`, `bible.verse_search_normalized`, `search_verses` | FTS5 virtual tables per searchable column. Normalize text in TypeScript before indexing and before querying: strip Arabic diacritics (tashkeel), fold French accents, and match whatever `norm_en` and `search_literal_normalize` do today. |
| Triggers `mark_resource_dirty` and `note_content_change` (on every content table) | Offline packages carry a content revision. Either SQLite triggers in D1 or the publish script bumps it. Pick one and document it. |
| Triggers `validate_order_hymn_key` and the veneration validators | A validation step in the import script, plus SQLite triggers if needed later. |
| Views `bible.calendar_book_lookup`, `synaxarium.day_entries` | Recreate as SQLite views with quoted names. |
| `pg_cron` | Not needed in Phase 1. |

**D1 limits to design around:**
- **100 bound parameters per query.** Pass lists as one JSON parameter: `WHERE hymn_key IN (SELECT value FROM json_each(?))`.
- **1,000 queries per Worker invocation.** Assemble services with batched prefetches, not one query per inline hymn. Use `db.batch()`.
- **100 KB per SQL statement.** The import must chunk its inserts.
- **One query at a time per database.** Keep queries short, and put the edge cache in front.

### 4.4 Infrastructure to build

1. **D1 database and binding** in the Workers project that is replacing Railway.
2. **Schema migrations** generated from the Postgres catalog, with tables, primary keys, uniques, foreign keys between content tables, checks and indexes. Apply them with `wrangler d1 migrations apply`. Keep every migration file in the repo.
3. **Export and import script.** It reads Supabase **read-only**, writes D1, can be re-run, and does a full reload of each table. Run it whenever Supabase content changes until cutover.
4. **Verification.** Row counts alone prove nothing; past imports looked right by count and were misaligned.
   - For every table, compute a checksum of all rows on both sides the same way: canonical JSON of each row, ordered by primary key, then SHA-256.
   - Report any table that differs, then compare row by row.
   - Spot-check Arabic and Coptic rows byte for byte.
5. **The `t(schema, table)` helper,** plus a check (lint rule or test) that fails the build if SQL contains an unquoted `schema.table` name.
6. **A content API in the Worker:** one endpoint for each content RPC the app uses, with the same inputs and the same JSON output.
7. **A parity test suite.**
   - Call the Supabase RPC and the Worker endpoint with the same inputs and compare the JSON.
   - Cover every day of a full Coptic year, plus:
     - a Coptic leap year (Nesi with 6 days; Koiahk 28 and 29)
     - Holy Week and Bright Saturday
     - Kiahk
     - Lent
     - the Feast of the Cross and Palm Sunday processions
   - Also cover every book and service document.
8. **Edge caching** of content responses, keyed by content revision so a publish invalidates them.
9. **Offline packages on R2.**
   - Build each book's package from D1.
   - Store it in R2 behind a custom domain, so the app downloads from Cloudflare with no egress fees.
   - This replaces `get_offline_package_plan`, `get_offline_table_page`, `get_offline_table_rows` and `get_offline_content_changes`.
10. **A data-source switch in the Expo app** (config or environment variable), so content comes from either Supabase or the Worker. It stays on Supabase until parity passes.

### 4.5 Phase 1 cutover

1. Pierre freezes content edits in Supabase.
2. Final reload and full verification.
3. Flip the app's default to the Worker.
4. D1 becomes the content master. From then on, content edits are made in D1:
   - small edits by hand in the D1 dashboard studio
   - bulk edits through Claude with migration files
5. The Supabase content schemas stay read-only for 30 days as a fallback. Then they are dropped, after Pierre confirms.

---

## 5. Phase 2: users and auth (after Phase 1)

- **Better Auth on Workers and D1.**
  - Import the 4 existing users **with the same user IDs**.
  - Keep email and Google sign-in, and add **Sign in with Apple** (Apple requires an equivalent privacy-focused option when Google sign-in is offered).
  - Add an email service for verification and password resets.
- **Port the user schemas:** `creator`, `learning`, `media`, `music`, `private`, plus the user tables in `public`.
  - Today they hang off Supabase Auth through 72 foreign keys to `auth.users`.
  - 77 RLS policies and 120 functions use `auth.uid()`. All of them become checks in Worker code.
- **Cron jobs** become Workers Cron Triggers.
- **The notification pipeline** (currently `pg_net`/`http` triggers) moves to Workers, with Queues if needed.
- **Media processing** moves as part of the Railway-to-Cloudflare work.
- **Security habits that replace RLS:**
  - The user and church identity always come from the session, never from the request body.
  - All data access goes through one helper that applies the ownership filter.
  - Tests try to read and write other users' data and expect refusal.
- **Retire Supabase** when nothing reads from it.

## 6. Phase 3: church customization (future)

### 6.1 The model
- `"church.churches"`, holding the churches.
- `"church.church_members"`, holding `user_id`, `church_id`, `role` (admin or editor) and `status` (pending, approved or revoked).
  - Pierre approves every membership.
  - Revoking takes effect on the member's next request.
- Change tables, for example `"church.hymn_text_changes"`:
  - Keys: `church_id` and the master row's permanent ID (`line_id`).
  - Values: only the fields the church changed (text per language, `condition`, `line_order`), plus `hidden`, `updated_by` and `updated_at`.
  - Changes are tracked **per field**, so a master typo fix still applies to a line whose condition the church changed.
- Equivalent change tables for titles and service order rows.
- Optional church-specific condition flags.
- **An "Updates from Coptic Vine" inbox.**
  - Each change stores a hash of the master value it was based on.
  - When the master later changes that same field, the church is asked whether to keep its version or take the new one.
- **A change history:** who changed what, and when, with one-tap revert.

### 6.2 Prerequisites to keep in mind during Phase 1
- Every row a church can change needs a **permanent ID**.
  - `hymn_texts` already has `line_id`.
  - `hymn_titles` (keyed by `hymn_key`, which has been renamed in the past) and the service order tables (keyed by `item_order` and `hymn_key`) do not. Plan to add one.
- Service assembly in the Worker should accept an optional `church_id` from the start, even if it is unused in Phase 1, so layering slots in later.

### 6.3 Security (D1 has no RLS, so the Worker is the only gate)
- The church editor website talks only to Worker endpoints, for example `hide-hymn`, `set-condition`, `edit-line`, `reorder`, `revert`.
- Every endpoint:
  1. Checks the session.
  2. Looks up an **approved** membership with an editing role.
  3. Takes `church_id` from that membership, **never from the request**.
  4. Writes only that church's change rows.
- Endpoints refuse edits to the Bible and to licensed sources.
- Attack tests prove that church A cannot touch church B's rows or the master tables.
- **Login:** Cloudflare Access (approved emails, free up to 50 users) is fine at the start; Better Auth roles take over as churches grow.

### 6.4 Editor website features
- A live preview: pick a date and service, and see it exactly as the church will.
- Master text beside the church's version, with changed lines highlighted and one-tap revert.
- A condition builder: pick flags from `calendar.condition_flags` with checkboxes and and/or choices; no typing `&&` or `||`.
- A "hidden items" list with restore.
- The updates inbox and the change history.
- Per-church offline packages, rebuilt when the church edits.

---

## 7. Editing workflow once D1 is the master

- **Small fixes:** the D1 studio in the Cloudflare dashboard.
- **Bulk edits:** Claude through Cloudflare's current MCP server (`mcp.cloudflare.com`), with every change saved as a numbered migration file.
- **Safety:**
  - D1 Time Travel restores the **whole** database to any minute in the last 30 days, and a restore can be undone.
  - Before a risky bulk edit, copy the affected table first, and drop the copy once Pierre is happy.
- **Existing rules still apply:**
  - Verify content, not counts.
  - French copies the source book exactly.
  - Coptic in `bible.verses` is split at the English verse boundaries.

---

## Appendix A: content schemas on 19 Oct 2026

Row counts are Postgres estimates.

| Schema | Tables | ~Rows | Size | Tables |
|---|---|---|---|---|
| agpeya | 12 | 966 | 2.1 MB | eleventh_hour, first_hour, hymn_texts, hymn_titles, introduction_to_every_hour, midnight_hour, ninth_hour, other_prayers, prayer_of_the_veil, sixth_hour, third_hour, twelfth_hour |
| aspasmos | 4 | 316 | 0.5 MB | adam_aspasmos, hymn_texts, hymn_titles, vatos_aspasmos |
| bible | 6 | 76,596 | 147 MB | book_number_aliases, books, new_coptic_psalter_translation*, verse_parts, verse_search_normalized*, verses |
| calendar | 8 | 38,473 | 9.9 MB | calendar_event_instances, condition_flags, coptic_date_conversions, fixed_coptic_day_flags, psalms_reading_ref_map_20260827*, psalms_ref_classification_20260827*, reading_rules, season_ranges |
| canons | 3 | 148 | 0.3 MB | canons, hymn_texts, hymn_titles |
| doxologies | 3 | 1,537 | 2.0 MB | doxologies, hymn_texts, hymn_titles |
| fractions | 3 | 355 | 0.4 MB | fractions, hymn_texts, hymn_titles |
| gospel_responses | 6 | 608 | 0.7 MB | alternate_gospel_responses, gospel_responses, gospel_responses_old*, hymn_texts, hymn_texts_old*, hymn_titles |
| gospel_rite | 6 | 266 | 0.4 MB | gospel_rite, hymn_texts, hymn_titles, mournful_4_gospels_rite, mournful_gospel_rite, palm_sunday_liturgy_gospel_rite |
| holy_week | 15 | 2,425 | 2.2 MB | bright_saturday, general_funeral_prayer, good_friday, good_friday_ninth_hour, good_friday_sixth_hour, good_friday_twelfth_hour, holy_thursday, holy_thursday_liturgy, hymn_texts, hymn_titles, liturgy_of_the_waters, pascha_common_hymns, pascha_hour, reading_rules, thursday_first_hour |
| hymn_of_the_intercessions | 3 | 151 | 0.3 MB | hymn_of_the_intercessions, hymn_texts, hymn_titles |
| litanies | 4 | 255 | 0.5 MB | hymn_texts, hymn_titles, the_five_short_litanies, the_three_great_litanies |
| liturgy | 14 | 3,196 | 2.9 MB | distribution, hymn_texts, hymn_titles, lectionary_liturgy, lectionary_matins, lectionary_vespers, liturgy_agpeya, liturgy_of_st_basil, liturgy_of_st_cyril, liturgy_of_st_gregory, liturgy_of_the_word, offering_of_the_lamb, raising_of_incense, sermon_planner |
| praxis_response | 2 | 175 | 0.3 MB | hymn_texts, praxis_response |
| procession_of_the_cross | 4 | 214 | 0.2 MB | hymn_texts, hymn_titles, procession_of_the_cross, reading_rules |
| psalmody | 9 | 21,569 | 36 MB | antiphonary, hymn_texts, hymn_titles, midnight_praises, morning_doxology, psalies_daily, psalies_saints, psalies_seasonal, vespers_praises |
| public (content only) | 3 | n/a | small | hymn_texts, hymn_titles, saint_order |
| readings | 10 | 95 | 0.4 MB | catholic_epistle, coptic_catholic_epistle, coptic_pauline_epistle, coptic_praxis, coptic_prophecy, hymn_texts, hymn_titles, pauline_epistle, praxis, prophecy |
| seasonal_liturgy_hymns | 4 | 305 | 0.4 MB | hymn_texts, hymn_titles, seasonal_distribution_hymns, seasonal_liturgy_of_the_word_hymns |
| synaxarium | 11 | 10,642 | 10 MB | coptic_days, entries, entry_texts (the other tables are legacy or staging*) |
| veneration | 3 | 803 | 0.9 MB | hymn_texts, hymn_titles, veneration |
| verses_of_the_cymbals | 2 | 214 | 0.3 MB | hymn_texts, verses_of_the_cymbals |

\* Not copied in Phase 1 (see 4.1).

**The standard book shape:**
- `hymn_titles`: `hymn_key, title_english, title_arabic, title_french, category, toggled, prayer_type`.
- `hymn_texts`: `line_id, hymn_key, line_order, english, coptic, arabic, french, person_type, prayer_type, condition, item_type, inline_hymn_key, inline_hymn_minimization, inline_hymn_title_shown`.
- Order tables, for example `liturgy.raising_of_incense`: `item_order, hymn_key, condition, minimization, item_type`.

## Appendix B: functions callable by the app's anon role

Confirm which of these the app actually calls by searching it for `.rpc(`, `.from(` and `.schema(`.

**Content functions (become Worker endpoints in Phase 1):**
- `public`:
  - `get_service`, `get_service_rows`, `get_inline_hymn`, `resolve_subdocument_target`, `evaluate_condition`
  - `get_calendar_context`, `get_calendar_readings`, `get_readings_for_date`, `get_reading_text`, `get_sunday_message`
  - `get_bible_books`, `get_bible_chapter`, `get_bible_chapter_list`
  - `get_home_synaxarium_events`, `get_synaxarium_year`
  - `to_coptic_numeral`, `coptic_replace_digits`
  - `get_offline_package_plan`, `get_offline_table_page`, `get_offline_table_rows`, `get_offline_content_changes`
- `calendar`: `get_active_flags_for_date`, `get_active_seasons_for_date`, `get_calendar_readings`, `get_context_flags`, `get_fixed_flags_for_date`, `get_kiahk_season_bounds`, `get_paramoun_dates`
- `bible`:
  - `get_book_key_by_calendar_number`, `get_verse_part`, `get_verse_part_by_calendar`, `get_verses_by_calendar_range`, `get_verses_by_range`, `map_hebrew_psalm_to_septuagint`
  - search: `search_verses`, `build_search_query`, `search_literal_contains`, `search_literal_normalize`, `norm_en`
- `synaxarium`: `get_day_json`, `get_by_coptic_day`, `get_by_gregorian_date`, `get_intro` (the daily opening blessing is generated, never stored)

**Editing tools (not ported):**
- `bible`: `check_verse_part_drift`, `french_ratio_*`, `psalms_*`, `stage_coptic_alignment_source_20260910`
- `synaxarium`: `apply_align_map`, `norm_para`
- `public`: `renumber_item_order`, `renumber_line_id`, `renumber_line_order`
- Trigger functions: `offline_content.*`, `liturgy.validate_order_hymn_key`, the veneration validators, `bible.sync_verse_search_normalized`

**User-side functions (Phase 2):** everything for music, learning, media, creator, notifications and sharing, in `public`, `music` and `private`.

## Appendix C: content enum values

- `"Item Type"`: Subdocument, Hyperlink, Inline
- `"Minimization"`: Minimizable, Minimized
- `"Person Type"`: Bishop/Priest, Priest, Deacon, Reader, People, Comment
- `"Prayer Type"`: Single Alternating, Double Alternating, Recited Prayer, Silent Prayer, Chanted Prayer, Refrain, Pre-Refrain, Reverse Alternating, Quadruple Alternating, Invincible Coptic, White, Blue

Postgres extensions in use: `pg_trgm`, `unaccent`, `pg_cron`, `pg_net`, `http`, `pgcrypto`, `uuid-ossp`.
