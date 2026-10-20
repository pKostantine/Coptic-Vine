# Phase 1 runbook: liturgical content on Cloudflare D1

How the D1 copy of the content works, how to keep it in step with Supabase
until cutover, and how to cut over. The plan is
[coptic-vine-d1-plan.md](../coptic-vine-d1-plan.md), section 4.

## What is where

| Piece | Where |
|---|---|
| D1 database | `copticvine` (`73a769f9-62fe-486d-a3c2-171b9aec274a`): 121 content tables named `"schema.table"`, the Bible search index, the content revision and the offline package plan |
| Content API | Worker `cv-content-api` (`workers/content-api`), at `https://content.copticvine.ca`. Also at `https://cv-content-api.hrmpdd8d6c.workers.dev` |
| Offline books | Worker `cv-content-packages` serving R2 bucket `chc-content`, at `https://packages.copticvine.ca`. Also at `https://cv-content-packages.hrmpdd8d6c.workers.dev`, which installed apps still use |
| App switch | `EXPO_PUBLIC_CONTENT_SOURCE` in `.env`: `supabase` (the current setting) or `cloudflare`. See `src/services/contentSource.ts` |

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

## Keeping D1 in step with Supabase (until cutover)

Supabase stays the master. Whenever its content changes:

```sh
cd workers/content-api
npm run import                      # reads Supabase read-only, reloads every table in D1 (about 1 min + 30 s)
npm run import -- --tables liturgy  # or one schema / schema.table (and the tables that reference it)
```

- **Atomic.** D1's import API applies the whole file or nothing.
- **Search follows.** Reloading `bible.verses` rebuilds the search index.
- **Egress.** A full import reads about 60 MB from Supabase.

Then verify:

```sh
npm run verify -- --print-pg-sql       # run in the Supabase SQL editor (read-only), save the JSON
npm run verify -- --pg pg.json         # every table's SHA-256 against Postgres's
npm run search-verify -- --print-pg-sql / --pg …   # every verse's search vectors
npm run parity -- --worker https://content.copticvine.ca   # the app's requests, both sides
```

The latest reports are [phase1-verification.md](phase1-verification.md) and
[phase1-parity.md](phase1-parity.md).

## Building the offline books from D1

```sh
CONTENT_SOURCE_URL=https://content.copticvine.ca node scripts/publish-content-packages.mjs --dry-run
```

The GitHub Action (`.github/workflows/publish-content.yml`) still builds from
Supabase every half hour. Change it at cutover; see below.

## Cutover (plan section 4.5)

1. Freeze content edits in Supabase.
2. Run `npm run import`, then `verify`, `search-verify` and `parity` (with
   `--only tables` too). All must be clean.
3. Set `EXPO_PUBLIC_CONTENT_SOURCE=cloudflare` in `.env`. Release the app and
   deploy the web app.
4. Point the publish Action at D1: add
   `CONTENT_SOURCE_URL: https://content.copticvine.ca` to its `env`.
5. **D1 is now the master.**
   - Small edits go in the D1 console.
   - Bulk edits go in migration files.
   - After any change to `bible.verses`, run `npm run build-search`.
   - The revision moves on its own.
6. Keep the Supabase content schemas read-only for 30 days, then drop them
   (after Pierre confirms).

## Known differences from Supabase, all deliberate

- **`get_readings_for_date`.** It reproduces Supabase's current output, where
  most `resolved_verses` are an error entry
  (`bible.verses.verse_number` is text). Set `REPRODUCE_TEXT_VERSE_NUMBER_BUG`
  to `false` in `src/rpc/bible.ts` to resolve them properly, once parity no
  longer matters. The app doesn't read that field.
- **Ties.** Rows that tie on every `ORDER BY` column come back in rowid order
  (stable). Supabase returns them in heap order.
- **Searches that time out on Supabase** (8 s statement limit) are answered.
