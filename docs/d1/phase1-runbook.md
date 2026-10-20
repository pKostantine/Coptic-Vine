# Phase 1 runbook: liturgical content on Cloudflare D1

How the liturgical content works on Cloudflare D1, and how to edit it. The
plan is [coptic-vine-d1-plan.md](../coptic-vine-d1-plan.md), section 4.

**Status: cut over on 20 Oct 2026.** D1 is the content master. The app and
the offline books read from it. Supabase's content schemas are a frozen copy,
kept read-only as a fallback until about 19 Nov 2026 (see
[Cutover](#cutover-plan-section-45)).

## What is where

| Piece | Where |
|---|---|
| D1 database | `copticvine` (`73a769f9-62fe-486d-a3c2-171b9aec274a`): 121 content tables named `"schema.table"`, the Bible search index, the content revision and the offline package plan |
| Content API | Worker `cv-content-api` (`workers/content-api`), at `https://content.copticvine.ca`. Also at `https://cv-content-api.hrmpdd8d6c.workers.dev` |
| Offline books | Worker `cv-content-packages` serving R2 bucket `chc-content`, at `https://packages.copticvine.ca`. Also at `https://cv-content-packages.hrmpdd8d6c.workers.dev`, which installed apps still use |
| App switch | `EXPO_PUBLIC_CONTENT_SOURCE` in `.env`: `cloudflare` (the default since the cutover) or `supabase` (the frozen copy). See `src/services/contentSource.ts`. The offline-book publisher follows the same switch |

**The content API.** It answers the same requests as Supabase's REST API:

- `GET /rest/v1/<table>` with `Accept-Profile`;
- `POST /rest/v1/rpc/<function>` with `Content-Profile`.

The app's own supabase-js queries work against it unchanged. Clients have no
way to write to it. It also accepts a church id (`x-church-id` or
`church_id`) for Phase 3 and ignores it for now.

**Migrations** are in `workers/content-api/migrations`:

| Migration | Contents |
|---|---|
| `0001_content_schema.sql` | Tables, keys, checks, indexes and views. Generated from the Postgres catalog snapshot in `schema/pg-catalog.json`. |
| `0002_bible_search.sql` | The Bible search index (`"bible.verse_search"` and its FTS5 table). |
| `0003_content_revision.sql` | The content revision, the record of changed tables, and the triggers that keep both. Generated. |
| `0004_offline_plan.sql` | The offline books' plan (books, resources, dependencies). |

## Decisions made in Phase 1

- **Revision: triggers, not the publish script.**
  - Every copied table, and the search index, has `AFTER INSERT/UPDATE/DELETE`
    triggers.
  - These move `"offline_content.revision"` and stamp the table in
    `"offline_content.content_changes"`.
  - Once D1 is the master, edits are also made by hand in the D1 console, and
    a script would miss those.
  - The cost: a full reload writes about three times the rows. That is
    roughly 700,000 row writes, well inside the plan's included 50 million a
    month.
- **Edge cache keyed by the revision.**
  - Workers Caching sits in front of the Worker's `Content` entrypoint.
  - The default entrypoint reads the revision (at most every 5 seconds per
    isolate) and asks `Content` for a URL that includes it. RPC POSTs become
    GETs, with the arguments in the URL.
  - Any content change moves every key. A new deployment starts a fresh
    cache.
  - Clients are told `no-cache`. They revalidate each time, and the edge
    answers.
- **The content API mirrors Supabase's REST API rather than adding new
  endpoints.** Most content is read as table queries (see
  [phase1-inventory.md](phase1-inventory.md)). Mirroring makes the app switch
  a one-line client change and lets parity send identical requests to both.
  The server-side assembly functions (`get_service` and the others) aren't
  ported, because nothing calls them.
- **Bible search runs Postgres's own text search, ported, on top of FTS5.**
  That covers the parser, Snowball 2.2.0 stemmers and stopwords,
  `unaccent`, tsquery, phrase matching, `ts_rank_cd` and `ts_headline`. FTS5
  narrows the candidates, and every candidate is then checked exactly.
- **Offline packages are built by the same script.**
  - `scripts/publish-content-packages.mjs` builds from D1 when
    `CONTENT_SOURCE_URL` points at the content API. The Worker answers the
    four `get_offline_*` functions from D1.
  - D1-built packages leave out what D1 doesn't copy. The Bible goes from
    76.6 to 44.0 MB (no tsvector columns) and the Synaxarium from 17.7 to
    11.5 MB (no legacy staging tables). The app reads neither.

## Editing content (D1 is the master)

- **Small fixes:** the D1 console in the Cloudflare dashboard (database
  `copticvine`). Table names need their quotes: `"liturgy.hymn_texts"`.
- **Bulk edits:** a numbered migration file in `workers/content-api/migrations`,
  applied with `npx wrangler d1 migrations apply copticvine --remote`.
- **Safety:** D1 Time Travel restores the whole database to any minute in the
  last 30 days (`npx wrangler d1 time-travel restore copticvine --timestamp …`).
  Before a risky bulk edit, copy the affected table first.
- **After a change to `bible.verses`:** run `npm run build-search` to rebuild
  the search index.
- **What happens on its own:**
  - The triggers move the content revision, so the edge cache starts afresh.
  - The publish Action (every half hour) rebuilds the offline books whose
    tables changed.
- **Don't edit Supabase's content any more.** The app no longer reads it, and
  `npm run import` refuses to copy it over D1 (it would undo D1's edits)
  unless given `--overwrite-d1-edits`.

## Before the cutover: reloading D1 from Supabase

This is how D1 was kept in step while Supabase was the master. It is kept for
the record and for local testing.

```sh
cd workers/content-api
npm run import -- --local           # into the local D1; a remote import now needs --overwrite-d1-edits
npm run import -- --tables liturgy  # or one schema / schema.table (and the tables that reference it)
```

- **Atomic.** D1's import API applies the whole file or nothing.
- **Search follows.** Reloading `bible.verses` rebuilds the search index.
- **Egress.** A full import reads about 60 MB from Supabase.

The checks compare D1 with Supabase, so they only mean something until D1 is
edited:

```sh
npm run verify -- --print-pg-sql       # run in the Supabase SQL editor (read-only), save the JSON
npm run verify -- --pg pg.json         # every table's SHA-256 against Postgres's
npm run search-verify -- --print-pg-sql / --pg …   # every verse's search vectors
npm run parity -- --worker https://content.copticvine.ca   # the app's requests, both sides
```

The reports are [phase1-verification.md](phase1-verification.md) and
[phase1-parity.md](phase1-parity.md).

## Building the offline books

`scripts/publish-content-packages.mjs` reads from wherever
`EXPO_PUBLIC_CONTENT_SOURCE` in `.env` points. Since the cutover that's D1,
through `https://content.copticvine.ca`. The GitHub Action
(`.github/workflows/publish-content.yml`) runs it every half hour.
`CONTENT_SOURCE_URL` or `--source <url>` points it elsewhere for a one-off:

```sh
node scripts/publish-content-packages.mjs --dry-run
```

## Cutover (plan section 4.5)

Done on 20 Oct 2026, between about 17:45 and 18:05 UTC:

1. **Content edits in Supabase frozen.** Nothing in Supabase writes content
   by itself: no cron job, trigger or user-data function does. So the freeze
   just means no more manual edits there.
2. **Final reload, then full verification:**
   - every table reloaded at 17:45;
   - 121 of 121 tables match Postgres by SHA-256;
   - 608 of 608 search-vector groups match;
   - parity: 5,841 cases equal and none different, plus 47 cases where
     Supabase timed out and the Worker answered.
3. **The app's default flipped to the Worker** (`EXPO_PUBLIC_CONTENT_SOURCE=cloudflare`).
   - The web app has been deployed with it.
   - Native apps pick it up with their next build or update. Until then they
     read Supabase's frozen copy, which is identical.
   - A live check found that the web build's `contentDataClient.web.ts` still
     used the Supabase client. It now reads through the switch. After the fix,
     every content request from the home screen, an Agpeya hour, the Liturgy,
     the Synaxarium and the Bible went to `content.copticvine.ca`.
4. **The offline books are built from D1.** The publisher follows the switch,
   so the Action reads D1. Its first run rebuilt every book.
5. **D1 is the master** (see [Editing content](#editing-content-d1-is-the-master)).
6. **Still to do:**
   - Keep the Supabase content schemas read-only until about 19 Nov 2026.
   - Then drop them, after Pierre confirms.
   - Phase 2 also removes the content functions in `public` (`get_service`,
     the French alignment helpers and the rest), once nothing calls Supabase.

## Known differences from Supabase, all deliberate

- **`get_readings_for_date`.** It reproduces Supabase's current output, where
  most `resolved_verses` are an error entry
  (`bible.verses.verse_number` is text). Set `REPRODUCE_TEXT_VERSE_NUMBER_BUG`
  to `false` in `src/rpc/bible.ts` to resolve them properly, once parity no
  longer matters. The app doesn't read that field.
- **Ties.** Rows that tie on every `ORDER BY` column come back in rowid order
  (stable). Supabase returns them in heap order.
- **Searches that time out on Supabase** (8 s statement limit) are answered.
