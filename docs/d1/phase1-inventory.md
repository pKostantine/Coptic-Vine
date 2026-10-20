# Phase 1 inventory: every content call the app makes

Step 1 of [the D1 plan](../coptic-vine-d1-plan.md), section 4. Taken from the
app source on 19 Oct 2026 (`master` at 14ef37f) and the live catalog of
`wtuujmeinzqfikvuofmh`.

## How the app reads content today

Almost all liturgical content goes through one wrapper,
`src/services/contentDataClient.ts`. It looks like the Supabase client
(`.schema(s).from(t)…` and `.schema(s).rpc(f, args)`), reads the installed
offline book first, and falls back to Supabase. Every module below imports it as
`supabase`:

`hymnLibrary.js`, `saintHymns.ts`, `calendarService.ts`, `conditionEngine.js`,
`readingsService.ts`, `readingCalendarRules.ts`, `readingReferenceResolver.js`,
`bibleService.ts`, `bibleSearch.ts`.

Only `src/services/homeService.ts` calls content RPCs on the real Supabase client.

**Services are assembled in the app, not in the database.** `hymnLibrary.js`
reads a service's order table, then `hymn_titles` and `hymn_texts` for its hymn
keys (chunks of 100, across fallback schemas), and splices inline hymns itself.
The server-side assembly functions in Appendix B (`get_service` and the rest)
are never called.

## A. Content RPCs the app calls (become Worker endpoints)

| # | Function | Called from | Calls inside it (ported, not exposed) |
|---|---|---|---|
| 1 | `public.get_readings_for_date(p_date)` | `readingCalendarRules.ts:81`, `conditionEngine.js:299` | `public.get_calendar_readings`, `public.get_reading_text`, `bible.get_verses_by_range`, 4 and 5 below |
| 2 | `calendar.get_context_flags(p_date, p_extra_context)` | `calendarService.ts:277`, `conditionEngine.js:191` | 3 |
| 3 | `calendar.get_active_flags_for_date(p_gregorian_date)` | `readingsService.ts:59` | `calendar.get_kiahk_season_bounds`, `calendar.get_paramoun_dates` (30 KB of PL/pgSQL, the largest port) |
| 4 | `bible.get_book_key_by_calendar_number(p_calendar_number)` | `conditionEngine.js:284`, `readingReferenceResolver.js:111`, `readingsService.ts:426` | |
| 5 | `bible.get_verse_part_by_calendar(…)` | `readingReferenceResolver.js:147`, `readingsService.ts:460` | 4 |
| 6 | `public.get_bible_books()` | `bibleService.ts:281` | |
| 7 | `public.get_bible_chapter_list(p_book_key)` | `bibleService.ts:431` | |
| 8 | `bible.search_verses(…)` (9 arguments) | `bibleSearch.ts:112` | `build_search_query`, `search_literal_contains`, `search_literal_normalize`, `immutable_unaccent` (step 6, FTS5) |
| 9 | `synaxarium.get_day_json(p_date)` | `hymnLibrary.js:617` | `synaxarium.get_intro` |
| 10 | `public.get_sunday_message(p_sunday)` | `homeService.ts:30` (direct client) | `public.get_calendar_readings` |
| 11 | `public.get_home_synaxarium_events(p_date)` | `homeService.ts:36` (direct client) | |
| 12 | `public.get_synaxarium_year(p_reference_date)` | `homeService.ts:41` (direct client) | |

## B. Direct table reads (not in the plan)

All through `contentDataClient`. Operators used: `select` with column lists and
`alias:column`, `eq`, `in`, `gt`, `gte`, `lt`, `lte`, `ilike`, `order`,
`limit`, `maybeSingle`, `single`.

| Table | Read from |
|---|---|
| `calendar.coptic_date_conversions` | `calendarService.ts` (8 places), `readingCalendarRules.ts:23,53`, `readingsService.ts:75` |
| `calendar.reading_rules` | `readingCalendarRules.ts:74`, `readingsService.ts:164` |
| `calendar.season_ranges` | `calendarService.ts:230`, `conditionEngine.js:129`, `readingsService.ts:94,126` |
| `calendar.condition_flags` | `saintHymns.ts:178` |
| `bible.books` | `bibleService.ts:272`, `hymnLibrary.js:371`, `readingsService.ts:683` |
| `bible.verses` | `bibleService.ts:328`, `readingReferenceResolver.js:162,190`, `readingsService.ts:476,529` |
| `bible.verse_parts` | `readingReferenceResolver.js:135`, `readingsService.ts:448` |
| `holy_week.reading_rules` | `hymnLibrary.js:866` |
| `veneration.hymn_texts`, `doxologies.doxologies`, `public.saint_order` | `saintHymns.ts:157,166,185` |
| any book's order table, `hymn_titles`, `hymn_texts` (schema chosen at run time) | `hymnLibrary.js:1212,1237,1253,2558,2707`, `saintHymns.ts:119,445,476,501,522` |

## C. Plan functions the app never calls

Not needed as endpoints. The ones marked *internal* are ported only as code
inside an endpoint above.

- `public`: `get_service`, `get_service_rows`, `get_inline_hymn`,
  `resolve_subdocument_target`, `evaluate_condition`, `get_calendar_context`,
  `get_bible_chapter`, `to_coptic_numeral`, `coptic_replace_digits`;
  `get_calendar_readings` and `get_reading_text` (*internal*).
- `calendar`: `get_active_seasons_for_date`, `get_fixed_flags_for_date`,
  `calendar.get_calendar_readings` (a copy of the public one without
  `sunday_message`); `get_kiahk_season_bounds`, `get_paramoun_dates` (*internal*).
- `bible`: `get_verse_part`, `get_verses_by_calendar_range`,
  `map_hebrew_psalm_to_septuagint`, `norm_en`; `get_verses_by_range` and the
  search helpers (*internal*).
- `synaxarium`: `get_by_coptic_day`, `get_by_gregorian_date`; `get_intro`
  (*internal*).
- The four offline functions (`get_offline_package_plan`,
  `get_offline_table_page`, `get_offline_table_rows`,
  `get_offline_content_changes`) are called only by
  `scripts/publish-content-packages.mjs`, which GitHub Actions runs every half
  hour (`.github/workflows/publish-content.yml`). The app never calls them.

## D. What the plan missed

1. **Direct table reads (B) are the main content path**, not RPCs. Matching
   them needs a read endpoint that answers the same PostgREST-style queries
   from D1.
2. **Offline packages are already on R2.** The app downloads books from the
   `cv-content-packages` Worker (bucket `chc-content`, URL in
   `EXPO_PUBLIC_CONTENT_PACKAGES_URL`). Step 8 changes where the builder reads
   from (Supabase to D1) and keeps the package format, so the app needs no
   change for offline books.
3. **Packages carry precomputed RPC answers** for a rolling window of dates:
   `get_context_flags`, `get_active_flags_for_date`, `get_readings_for_date`
   and `get_day_json`. A D1 builder has to produce the same answers, so it
   should reuse the Worker's ports.
4. **`homeService.ts` bypasses `contentDataClient`.** Its three RPCs need the
   data-source switch too.
5. **`hymn_of_the_intercessions.hymn_titles` (3 rows) isn't public today.**
   `anon` has no SELECT grant and RLS has no policy, so the app can't see it.
6. **Another validator trigger:** `public.veneration_validate_hymn_key`, as well
   as `veneration.validate_veneration_hymn_key` and
   `liturgy.validate_order_hymn_key`.
7. **Three tables have no primary key:** `liturgy.lectionary_liturgy`,
   `liturgy.lectionary_matins` and `liturgy.lectionary_vespers`. Checksums order
   them by the whole row. Phase 3 will need IDs for them.
8. **More float columns than the plan lists.**
   - `double precision`: every `hymn_texts.line_id`, several `item_order`
     columns, and `psalmody.hymn_texts.line_order`.
   - `real` (float4): `praxis_response.hymn_texts.line_id` and
     `verses_of_the_cymbals.hymn_texts.line_id`.
   - `hymn_of_the_intercessions.hymn_texts.line_id` is `bigint`.
9. **Simpler types than the plan expects.** No `timestamptz` or array columns
   are in scope, and the only `jsonb` column is `bible.books.aliases_json`.
10. **Phase 2 RPCs the app calls**, all reading only music, learning and media
    tables: `search_media_catalog`, `search_section_catalog`, and
    `get_share_preview` (the web-app Worker).
11. **A D1 database already exists:** `copticvine`
    (`73a769f9-62fe-486d-a3c2-171b9aec274a`), empty. Phase 1 uses it.
12. **Size of the scope:** 121 tables and 2 views
    (`bible.calendar_book_lookup`, `synaxarium.day_entries`), 115,363 rows.
