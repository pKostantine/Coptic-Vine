# Phase 1 parity: Supabase vs the content Worker

Step 7 of [the D1 plan](../coptic-vine-d1-plan.md). Run on 20 Oct 2026 at 03:25
UTC against the deployed Worker (`https://cv-content-api.hrmpdd8d6c.workers.dev`)
and the remote D1 database. Before that, it was run against `wrangler dev` with
the local D1.

## Result

**No differences.** 5,752 cases compared, all equal.

In 26 more cases Supabase gave up with a statement timeout (8 s) while the
Worker answered. They are counted separately below:

| Group | Cases | Equal | Supabase timed out |
|---|---:|---:|---:|
| `rpc`: calendar and Synaxarium RPCs, day by day | 3,563 | 3,563 | 0 |
| `bible`: Bible lookups | 308 | 308 | 0 |
| `documents`: every service document, read as the app reads it | 1,289 | 1,289 | 0 |
| `queries`: the app's other table reads | 30 | 30 | 0 |
| `search`: `bible.search_verses` | 351 | 351 | 18 |
| `tables`: every public table in full, by REST page | 211 | 211 | 8 |

The 8 table pages that timed out are `bible.verses` read with `select=*`.
Supabase includes its seven generated tsvector columns in that query, and the
Worker doesn't copy them. The step 4 checksums cover those rows anyway
([phase1-verification.md](phase1-verification.md)).

## How the comparison works

`workers/content-api/scripts/parity.ts` sends the same supabase-js calls the
app makes to two clients. One points at Supabase and one at the Worker, so
the requests are identical: same URL, headers and body. The answers are
compared as JSON values:

- **Numbers by value.** Postgres prints `numeric 21.50`, where D1 holds
  21.5.
- **Object keys in any order.** In practice the Worker also reproduces
  jsonb's key order. Spot checks were byte-identical: a Synaxarium day is
  22,827 bytes on both sides.
- **Arrays in order.** The exceptions are where Postgres defines no order:
  - a query without `ORDER BY`;
  - the saints in `get_active_flags_for_date`;
  - rows that tie on every `ORDER BY` column.
  - On the tie case: some hymns have several lines with the same `hymn_key`
    and `line_order`, such as the four Evangelist variants of `gospel_rite`'s
    `introductionAndPsalm` line 1. Supabase returns those in heap order. D1
    returns them in `line_id` order, which is stable.
- **Errors by code and message.** Errors are part of the answer:
  `get_context_flags` for a date the calendar doesn't have raises `P0001`
  with the same text.

## What is covered

- **Every day of Coptic year 1743** (11 Sep 2026 to 11 Sep 2027) gets six
  calls:
  - `calendar.get_active_flags_for_date`
  - `calendar.get_context_flags`
  - `public.get_readings_for_date`
  - `synaxarium.get_day_json` (with `get_intro`)
  - `public.get_home_synaxarium_events`
  - `public.get_sunday_message`
- **The special cases of plan section 4.4, item 7:**
  - **A Coptic leap year.** 1743 is one, so Nesi has 6 days. Nesi of 1739, the
    previous leap year, and of 1740, 1742 and 1744 too.
  - **Koiahk 28 and 29.** The whole month of Koiahk in 1739, 1740, 1742 and
    1744 as well as 1743, so the Nativity on either day.
  - **Holy Week and Bright Saturday.** In 2027 (24 Apr to 1 May) and in 2026:
    every day from 8 Feb to 1 Jun 2026, covering Lent, Holy Week, Bright
    Saturday, Easter, the Fifty Days and Pentecost.
  - **Kiahk.** Dec 2026 to Jan 2027, and the other years above.
  - **Lent.** 2026 and 2027.
  - **The Feast of the Cross.** Thout 17 to 19 in 2025 and 2026, and
    Paremhotep 10 (19 Mar 2027).
  - **Palm Sunday.** 5 Apr 2026 and 25 Apr 2027.
  - **The processions.** The `procession_of_the_cross` order tables and
    their `reading_rules` are in the documents and tables groups.
- **`get_synaxarium_year`** for Coptic years 1742, 1743 and 1744.
  **`get_context_flags`** with caller context, and without the argument.
  **A date before the calendar starts.**
- **The Bible:**
  - `get_bible_books`;
  - every book's chapter list;
  - every calendar book number from 0 to 90;
  - every verse part, plus one that doesn't exist.
- **Every service document.** All 69 public order tables are read as
  `hymnLibrary.js` reads them: the order rows, then titles and texts by hymn
  key in batches of 100. That covers the document's own schema and every
  fallback schema (`public`, `liturgy`, `psalmody`, `agpeya`, `veneration`,
  `doxologies`, `litanies`, and `gospel_rite` for the sermon planner).
- **The other table reads:**
  - calendar lookups with `eq`, `gte`/`lte`, `order`, `limit`, `single` and
    `maybeSingle`;
  - Bible chapters and ranges, verse parts, and Holy Week reading rules;
  - the saints' `ilike` condition searches;
  - text, enum and descending sorts;
  - a missing table and a missing column.
- **Search:** 60 queries in six variants: all, any, phrase, websearch, prefix,
  and both sorts.
  - The queries cover all eight renderings, Arabic with tashkeel, Greek with
    accents, Coptic with combining marks, and French with accents.
  - They also cover hyphenated words, numbers, stopwords alone, empty input,
    and the websearch syntax (`"quoted"`, `-not`, `or`).
  - On top of those come 9 filtered or paged searches: testament, book list,
    limits and offsets out of range.

## Findings along the way

1. **`get_readings_for_date` doesn't resolve verses in Supabase today.**
   - `bible.verses.verse_number` became `text`, but `get_reading_text` and
     `bible.get_verses_by_range` still compare it with integers.
   - As a result, most references come back as
     `{"segment": …, "error": "operator does not exist: text >= integer"}`.
     Only references made entirely of verse parts (`19.72:23b`) resolve.
   - The app re-resolves every reading itself, so nobody sees this.
   - The Worker reproduces it behind `REPRODUCE_TEXT_VERSE_NUMBER_BUG` in
     `src/rpc/bible.ts`. Setting that to `false` resolves the verses as
     intended, once parity with Supabase no longer matters (or once Supabase
     is fixed the same way).
2. **Supabase times out on broad Bible searches** such as `God` in `any`
   mode, or the whole Bible in Arabic. The Worker answers those in 0.1 to
   0.5 s without caching.

## Running it

```sh
cd workers/content-api
npx wrangler dev --port 8790 --local          # or use --worker <url> below
npm run parity                                 # rpc, bible, documents, queries, search
npm run parity -- --only tables                # adds every table in full (an import's worth of egress)
npm run parity -- --worker https://cv-content-api.hrmpdd8d6c.workers.dev --report report.md
```
