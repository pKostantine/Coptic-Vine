# Phase 1 verification: Supabase vs D1

Step 4 of [the D1 plan](../coptic-vine-d1-plan.md). Run on 20 Oct 2026 at
02:25 UTC against the remote D1 database `copticvine`, straight after the
import of 02:20 UTC.

## Result

- **109 of 121 tables match exactly**: the same rows, with every value
  byte-identical (114,326 rows).
- **The 12 that differ were not imported** and are empty in D1:
  - `aspasmos` (4 tables), `fractions` (3) and `procession_of_the_cross` (4).
    The Supabase REST API doesn't expose these schemas, so a read-only import
    with the public key can't read them.
  - `hymn_of_the_intercessions.hymn_titles` (3 rows): `anon` has no SELECT
    grant on it.
  - The app reads none of the 12. Fixing this needs a decision; see the
    summary in chat.
- **Byte-for-byte sample:** 100 rows, all identical. The rows come from 10
  tables (`hymn_texts` of liturgy, psalmody, holy_week, doxologies,
  veneration, agpeya and public; `bible.verses`; `bible.verse_parts`;
  `synaxarium.entry_texts`). Each sample takes the first 3 rows, the last 2
  and 5 hash-picked rows that have both Arabic and Coptic. Every text column
  (63,669 bytes) was compared as UTF-8 hex, computed by each database itself:
  Postgres's `encode(convert_to(col, 'UTF8'), 'hex')` against SQLite's
  `hex(col)`.
- **Negative control:** in a local copy, one ي in `liturgy.hymn_texts`
  line_id 1 was changed to the similar-looking ى. Verification failed for that
  table and the row diff named line_id 1, showing both versions.

## Method

- **Canonical row.** Each row becomes a JSON array of its values in column
  order (`scripts/lib/canonical.ts`):
  - text, enums, dates and jsonb: a JSON string of the text;
  - integers, doubles and reals: printed as they are;
  - numeric: printed as its double;
  - booleans: `true` or `false`.
- **Table checksum.** SHA-256 of the rows' lines, sorted by UTF-8 bytes and
  joined with a newline. Sorting by the line, not the primary key, means the
  three key-less lectionary tables need no special case.
- **Postgres side.** Postgres computes its checksums itself, in one read-only
  query (`npm run verify -- --print-pg-sql`).
- **D1 side.** `verify.ts` reads every D1 row back with `wrangler d1 execute`
  and hashes the rows in Node.
- **When a table differs**, it is compared row by row with what Supabase's
  REST API returns. The report then lists missing, extra and changed rows by
  key.

## Also found by the import

The validation triggers' hymn-key rules are broken by 16 order rows that are
already in Supabase. The rows were copied as they are; the import reports them
and stops only with `--strict`.

- 14 rows in `liturgy.liturgy_of_st_basil`, `liturgy_of_st_cyril` and
  `liturgy_of_st_gregory`: the litanies and `distributionOfTheHolyMysteries`.
  Their keys moved to `litanies` (and other schemas), but
  `liturgy.validate_order_hymn_key` still checks only `liturgy` and `public`.
- 2 rows in `veneration.veneration`: `ekesmaroout` and `epouro` aren't in
  `veneration.hymn_titles`.

The app finds all of these through its fallback schemas, so nothing is broken
for readers. The triggers are out of date.

## Re-running

```sh
cd workers/content-api
npm run import                          # full reload from Supabase (read-only)
npm run verify -- --print-pg-sql        # run in the SQL editor, save as pg.json
npm run verify -- --print-pg-spot-sql   # optional: save as spot.json
npm run verify -- --pg pg.json --spot spot.json --report report.md
```

## Every table

| Table | Rows in Postgres | Rows in D1 | Checksum | SHA-256 (D1) |
|---|---:|---:|---|---|
| `agpeya.eleventh_hour` | 23 | 23 | match | `22b7d042383a` |
| `agpeya.first_hour` | 40 | 40 | match | `db1d13231342` |
| `agpeya.hymn_titles` | 166 | 166 | match | `00431874b9e8` |
| `agpeya.hymn_texts` | 519 | 519 | match | `f5d4fcd57cae` |
| `agpeya.introduction_to_every_hour` | 3 | 3 | match | `061394912a54` |
| `agpeya.midnight_hour` | 80 | 80 | match | `cb3015a32c6b` |
| `agpeya.ninth_hour` | 23 | 23 | match | `8d8ea9d98819` |
| `agpeya.other_prayers` | 14 | 14 | match | `3c19377cc59f` |
| `agpeya.prayer_of_the_veil` | 47 | 47 | match | `67d2b4f4fb7f` |
| `agpeya.sixth_hour` | 23 | 23 | match | `24fe20af7a34` |
| `agpeya.third_hour` | 23 | 23 | match | `29122aa1f150` |
| `agpeya.twelfth_hour` | 30 | 30 | match | `293233b89875` |
| `aspasmos.adam_aspasmos` | 31 | 0 | **differs** | `e3b0c44298fc` |
| `aspasmos.hymn_titles` | 23 | 0 | **differs** | `e3b0c44298fc` |
| `aspasmos.hymn_texts` | 316 | 0 | **differs** | `e3b0c44298fc` |
| `aspasmos.vatos_aspasmos` | 21 | 0 | **differs** | `e3b0c44298fc` |
| `bible.books` | 76 | 76 | match | `2842993e6267` |
| `bible.book_number_aliases` | 221 | 221 | match | `a7ebdb3284c5` |
| `bible.verse_parts` | 139 | 139 | match | `9d5c09f0c527` |
| `bible.verses` | 36774 | 36774 | match | `fbb38e1417b7` |
| `calendar.coptic_date_conversions` | 29585 | 29585 | match | `e335293ad448` |
| `calendar.calendar_event_instances` | 2347 | 2347 | match | `e6a5ad711e46` |
| `calendar.condition_flags` | 162 | 162 | match | `d3fefc3aa2bb` |
| `calendar.fixed_coptic_day_flags` | 129 | 129 | match | `7c0efb128d89` |
| `calendar.reading_rules` | 4782 | 4782 | match | `784b0aee1862` |
| `calendar.season_ranges` | 565 | 565 | match | `4d0d1ba4b01a` |
| `canons.hymn_titles` | 32 | 32 | match | `9972d75f8a06` |
| `canons.canons` | 33 | 33 | match | `4589f987ef21` |
| `canons.hymn_texts` | 88 | 88 | match | `46ef15456627` |
| `doxologies.doxologies` | 143 | 143 | match | `f5bf98f67dc0` |
| `doxologies.hymn_titles` | 142 | 142 | match | `a060d910f73b` |
| `doxologies.hymn_texts` | 1252 | 1252 | match | `9271f79926e9` |
| `fractions.fractions` | 25 | 0 | **differs** | `e3b0c44298fc` |
| `fractions.hymn_titles` | 25 | 0 | **differs** | `e3b0c44298fc` |
| `fractions.hymn_texts` | 355 | 0 | **differs** | `e3b0c44298fc` |
| `gospel_responses.alternate_gospel_responses` | 1 | 1 | match | `f57ab7bbecc8` |
| `gospel_responses.gospel_responses` | 93 | 93 | match | `c1c77ba8ccb7` |
| `gospel_responses.hymn_titles` | 96 | 96 | match | `6c68558e3724` |
| `gospel_responses.hymn_texts` | 185 | 185 | match | `c059e1633bb0` |
| `gospel_rite.gospel_rite` | 35 | 35 | match | `45bf2ac68a0b` |
| `gospel_rite.hymn_titles` | 43 | 43 | match | `f721cf0b1166` |
| `gospel_rite.hymn_texts` | 222 | 222 | match | `0aeedc0e1ab9` |
| `gospel_rite.mournful_4_gospels_rite` | 3 | 3 | match | `80776011235e` |
| `gospel_rite.mournful_gospel_rite` | 3 | 3 | match | `a8f398e152a1` |
| `gospel_rite.palm_sunday_liturgy_gospel_rite` | 21 | 21 | match | `3efaad2fddda` |
| `holy_week.bright_saturday` | 18 | 18 | match | `7801d8e88882` |
| `holy_week.general_funeral_prayer` | 5 | 5 | match | `0f0ad65ef86b` |
| `holy_week.good_friday` | 13 | 13 | match | `f65f85551ae7` |
| `holy_week.good_friday_ninth_hour` | 22 | 22 | match | `fabf4857e07e` |
| `holy_week.good_friday_sixth_hour` | 24 | 24 | match | `7ec3bd651a5a` |
| `holy_week.good_friday_twelfth_hour` | 20 | 20 | match | `deeb64704497` |
| `holy_week.holy_thursday` | 15 | 15 | match | `758add66332c` |
| `holy_week.holy_thursday_liturgy` | 4 | 4 | match | `205539f557e5` |
| `holy_week.hymn_titles` | 220 | 220 | match | `d65b58a0a22b` |
| `holy_week.hymn_texts` | 1697 | 1697 | match | `c2317a196a9c` |
| `holy_week.liturgy_of_the_waters` | 66 | 66 | match | `36604898b8bd` |
| `holy_week.pascha_common_hymns` | 23 | 23 | match | `36b05a146188` |
| `holy_week.pascha_hour` | 71 | 71 | match | `6ee14ec02ded` |
| `holy_week.reading_rules` | 318 | 318 | match | `8aa89bcfee00` |
| `holy_week.thursday_first_hour` | 48 | 48 | match | `3df59c62f46e` |
| `hymn_of_the_intercessions.hymn_of_the_intercessions` | 75 | 75 | match | `f631b0c54a41` |
| `hymn_of_the_intercessions.hymn_texts` | 76 | 76 | match | `e5f52b94318e` |
| `hymn_of_the_intercessions.hymn_titles` | 3 | 0 | **differs** | `e3b0c44298fc` |
| `litanies.hymn_titles` | 17 | 17 | match | `a0f08031fccb` |
| `litanies.hymn_texts` | 245 | 245 | match | `4b9a480522b5` |
| `litanies.the_five_short_litanies` | 10 | 10 | match | `9ff9e4486484` |
| `litanies.the_three_great_litanies` | 5 | 5 | match | `ebb8fe564408` |
| `liturgy.distribution` | 6 | 6 | match | `548aa66e88be` |
| `liturgy.hymn_titles` | 248 | 248 | match | `ec2d2e258e5d` |
| `liturgy.hymn_texts` | 2614 | 2614 | match | `0af40d87b127` |
| `liturgy.lectionary_liturgy` | 11 | 11 | match | `cb2a4b8d9ad8` |
| `liturgy.lectionary_matins` | 4 | 4 | match | `d1539f4a91db` |
| `liturgy.lectionary_vespers` | 2 | 2 | match | `df11c7a773f1` |
| `liturgy.liturgy_agpeya` | 60 | 60 | match | `e0c1b9caf78b` |
| `liturgy.liturgy_of_st_basil` | 49 | 49 | match | `eb9a3f14d59c` |
| `liturgy.liturgy_of_st_cyril` | 76 | 76 | match | `5295a5fb7708` |
| `liturgy.liturgy_of_st_gregory` | 75 | 75 | match | `aa2bba1421c8` |
| `liturgy.liturgy_of_the_word` | 41 | 41 | match | `68e855cf30b3` |
| `liturgy.offering_of_the_lamb` | 35 | 35 | match | `4cbdb90f9ffa` |
| `liturgy.raising_of_incense` | 52 | 52 | match | `107df6091212` |
| `liturgy.sermon_planner` | 10 | 10 | match | `096e4d43d36b` |
| `praxis_response.hymn_texts` | 88 | 88 | match | `c0856ee7abc9` |
| `praxis_response.praxis_response` | 87 | 87 | match | `bbfdf16e7668` |
| `procession_of_the_cross.hymn_titles` | 58 | 0 | **differs** | `e3b0c44298fc` |
| `procession_of_the_cross.hymn_texts` | 87 | 0 | **differs** | `e3b0c44298fc` |
| `procession_of_the_cross.procession_of_the_cross` | 69 | 0 | **differs** | `e3b0c44298fc` |
| `procession_of_the_cross.reading_rules` | 24 | 0 | **differs** | `e3b0c44298fc` |
| `psalmody.antiphonary` | 811 | 811 | match | `e78c9ff7b4cd` |
| `psalmody.hymn_titles` | 1364 | 1364 | match | `1ce053d493d9` |
| `psalmody.hymn_texts` | 18708 | 18708 | match | `718a51132cac` |
| `psalmody.midnight_praises` | 252 | 252 | match | `b30b03fc0451` |
| `psalmody.morning_doxology` | 5 | 5 | match | `fe47e4a358db` |
| `psalmody.psalies_daily` | 9 | 9 | match | `fbff5587b4f6` |
| `psalmody.psalies_saints` | 155 | 155 | match | `539c0d7160dd` |
| `psalmody.psalies_seasonal` | 81 | 81 | match | `98cbbec11274` |
| `psalmody.vespers_praises` | 195 | 195 | match | `1cd55d3b8cd2` |
| `public.hymn_titles` | 45 | 45 | match | `971e34f17d34` |
| `public.hymn_texts` | 213 | 213 | match | `f853bc65f140` |
| `public.saint_order` | 519 | 519 | match | `e32dd8f95c9e` |
| `readings.catholic_epistle` | 3 | 3 | match | `e245204b7479` |
| `readings.coptic_catholic_epistle` | 3 | 3 | match | `3baf9709df93` |
| `readings.coptic_pauline_epistle` | 3 | 3 | match | `351ea2b90825` |
| `readings.coptic_praxis` | 3 | 3 | match | `296781f7ad6a` |
| `readings.coptic_prophecy` | 3 | 3 | match | `6e766bc4e13d` |
| `readings.hymn_titles` | 16 | 16 | match | `2d61ad1f87e6` |
| `readings.hymn_texts` | 83 | 83 | match | `1c9d0380e33f` |
| `readings.pauline_epistle` | 3 | 3 | match | `2fcebe493e94` |
| `readings.praxis` | 3 | 3 | match | `503c67952502` |
| `readings.prophecy` | 3 | 3 | match | `9191a5d55c0d` |
| `seasonal_liturgy_hymns.hymn_titles` | 43 | 43 | match | `44a639f3500c` |
| `seasonal_liturgy_hymns.hymn_texts` | 305 | 305 | match | `ff8c7922c8b3` |
| `seasonal_liturgy_hymns.seasonal_distribution_hymns` | 15 | 15 | match | `3fcd91e90169` |
| `seasonal_liturgy_hymns.seasonal_liturgy_of_the_word_hymns` | 33 | 33 | match | `ec4e9b105aea` |
| `synaxarium.coptic_days` | 366 | 366 | match | `8a1880c81902` |
| `synaxarium.entries` | 866 | 866 | match | `c128894afaa8` |
| `synaxarium.entry_texts` | 4590 | 4590 | match | `8d8d941cfbf9` |
| `veneration.hymn_titles` | 29 | 29 | match | `ff85592cb3bf` |
| `veneration.hymn_texts` | 734 | 734 | match | `43f8d8058285` |
| `veneration.veneration` | 38 | 38 | match | `4b46135f40f1` |
| `verses_of_the_cymbals.hymn_texts` | 123 | 123 | match | `8c1d2c1a8652` |
| `verses_of_the_cymbals.verses_of_the_cymbals` | 91 | 91 | match | `c60efbb9d3e6` |
