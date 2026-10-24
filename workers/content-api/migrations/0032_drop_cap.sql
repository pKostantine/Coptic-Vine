-- Each hymn line says whether it opens with the drop cap and decorated first
-- words (the Coptic initial, the English and French Old English capital, the
-- Arabic stretched word). 0 by default; set it to 1 on the lines that should.
-- The readers no longer decide this themselves (src/components/vine/documentHtml.ts,
-- SlideshowContainer.js). Listed in schema/content-tables.json through
-- D1_COLUMNS in scripts/gen-schema.ts, since 0001 is generated from the
-- Postgres catalog and predates it.

ALTER TABLE "agpeya.hymn_texts" ADD COLUMN "drop_cap" INTEGER NOT NULL DEFAULT 0 CHECK ("drop_cap" IN (0, 1));
ALTER TABLE "aspasmos.hymn_texts" ADD COLUMN "drop_cap" INTEGER NOT NULL DEFAULT 0 CHECK ("drop_cap" IN (0, 1));
ALTER TABLE "canons.hymn_texts" ADD COLUMN "drop_cap" INTEGER NOT NULL DEFAULT 0 CHECK ("drop_cap" IN (0, 1));
ALTER TABLE "doxologies.hymn_texts" ADD COLUMN "drop_cap" INTEGER NOT NULL DEFAULT 0 CHECK ("drop_cap" IN (0, 1));
ALTER TABLE "fractions.hymn_texts" ADD COLUMN "drop_cap" INTEGER NOT NULL DEFAULT 0 CHECK ("drop_cap" IN (0, 1));
ALTER TABLE "gospel_responses.hymn_texts" ADD COLUMN "drop_cap" INTEGER NOT NULL DEFAULT 0 CHECK ("drop_cap" IN (0, 1));
ALTER TABLE "gospel_rite.hymn_texts" ADD COLUMN "drop_cap" INTEGER NOT NULL DEFAULT 0 CHECK ("drop_cap" IN (0, 1));
ALTER TABLE "holy_week.hymn_texts" ADD COLUMN "drop_cap" INTEGER NOT NULL DEFAULT 0 CHECK ("drop_cap" IN (0, 1));
ALTER TABLE "hymn_of_the_intercessions.hymn_texts" ADD COLUMN "drop_cap" INTEGER NOT NULL DEFAULT 0 CHECK ("drop_cap" IN (0, 1));
ALTER TABLE "litanies.hymn_texts" ADD COLUMN "drop_cap" INTEGER NOT NULL DEFAULT 0 CHECK ("drop_cap" IN (0, 1));
ALTER TABLE "liturgy.hymn_texts" ADD COLUMN "drop_cap" INTEGER NOT NULL DEFAULT 0 CHECK ("drop_cap" IN (0, 1));
ALTER TABLE "praxis_response.hymn_texts" ADD COLUMN "drop_cap" INTEGER NOT NULL DEFAULT 0 CHECK ("drop_cap" IN (0, 1));
ALTER TABLE "procession_of_the_cross.hymn_texts" ADD COLUMN "drop_cap" INTEGER NOT NULL DEFAULT 0 CHECK ("drop_cap" IN (0, 1));
ALTER TABLE "psalmody.hymn_texts" ADD COLUMN "drop_cap" INTEGER NOT NULL DEFAULT 0 CHECK ("drop_cap" IN (0, 1));
ALTER TABLE "public.hymn_texts" ADD COLUMN "drop_cap" INTEGER NOT NULL DEFAULT 0 CHECK ("drop_cap" IN (0, 1));
ALTER TABLE "readings.hymn_texts" ADD COLUMN "drop_cap" INTEGER NOT NULL DEFAULT 0 CHECK ("drop_cap" IN (0, 1));
ALTER TABLE "seasonal_liturgy_hymns.hymn_texts" ADD COLUMN "drop_cap" INTEGER NOT NULL DEFAULT 0 CHECK ("drop_cap" IN (0, 1));
ALTER TABLE "veneration.hymn_texts" ADD COLUMN "drop_cap" INTEGER NOT NULL DEFAULT 0 CHECK ("drop_cap" IN (0, 1));
ALTER TABLE "verses_of_the_cymbals.hymn_texts" ADD COLUMN "drop_cap" INTEGER NOT NULL DEFAULT 0 CHECK ("drop_cap" IN (0, 1));
