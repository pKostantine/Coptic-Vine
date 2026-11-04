-- Every call to a whole table -- a Subdocument, Inline or Hyperlink row --
-- names the table in full, schema and table, as asked on 4 Nov 2026:
-- FRACTIONS becomes fractions.fractions, PROCESSION_OF_THE_CROSS
-- procession_of_the_cross.procession_of_the_cross, VESPERS_PROCESSION
-- procession_of_the_cross.vespers_procession. The key says where the table
-- is, so the app goes straight there (src/utils/sentinelTables.js), and the
-- content Worker serves an order table made in the D1 console without being
-- told of it (src/content.ts): a new call needs nothing but its row.
--
-- Only keys that name a table change. The day's readings
-- (LITURGY_GOSPEL_WITH_COPTIC ...), the Synaxarium, Holy Week's readings
-- (PASCHA_PROPHECIES ...), the Procession's twelve stations (FIRST_GOSPEL ...,
-- read from its reading_rules), VENERATION_MELODIES, and the Hyperlinks
-- MATINS and VESPERS (both open liturgy.raising_of_incense, so a table can't
-- say which) keep their names. So does a row in capitals that calls nothing
-- (no item_type): a heading, such as Holy Thursday's RAISING_OF_INCENSE.
--
-- The calling schema's title for a call is keyed by the call, so each
-- hymn_titles row keyed by a renamed call is renamed with it. Holy Week's
-- MIDNIGHT_PRAISES, PAULINE_EPISTLE, PRAXIS and THE_THREE_GREAT_LITANIES only
-- head sections there, so they stay as they are.
--
-- The app reads names in capitals as before (offline books packed before
-- this have them), and goes by them inside: sections keep their ids, so
-- bookmarks and places are unchanged.

-- A hymn line calls a whole table by its full name too, so the guards of
-- migrations/0034 let a key of that shape through, as they let the capitals
-- through before (the reader shows nothing for a table that isn't there, as
-- it did for a name in capitals no table had). Any other key must still be a
-- hymn's.
DROP TRIGGER "agpeya.hymn_texts_inline_hymn_key_insert";
CREATE TRIGGER "agpeya.hymn_texts_inline_hymn_key_insert" BEFORE INSERT ON "agpeya.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NEW."inline_hymn_key" NOT GLOB '[a-z]*.[a-z]*' AND NOT (
  EXISTS (SELECT 1 FROM "agpeya.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "aspasmos.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "canons.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "doxologies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "fractions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_responses.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_rite.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "holy_week.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "hymn_of_the_intercessions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "litanies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "liturgy.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "praxis_response.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "procession_of_the_cross.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "psalmody.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "public.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "readings.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "seasonal_liturgy_hymns.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "veneration.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "verses_of_the_cymbals.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key")
)
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table: check its spelling, or add that hymn first');
END;
DROP TRIGGER "agpeya.hymn_texts_inline_hymn_key_update";
CREATE TRIGGER "agpeya.hymn_texts_inline_hymn_key_update" BEFORE UPDATE OF "inline_hymn_key" ON "agpeya.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NEW."inline_hymn_key" NOT GLOB '[a-z]*.[a-z]*' AND NOT (
  EXISTS (SELECT 1 FROM "agpeya.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "aspasmos.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "canons.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "doxologies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "fractions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_responses.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_rite.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "holy_week.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "hymn_of_the_intercessions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "litanies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "liturgy.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "praxis_response.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "procession_of_the_cross.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "psalmody.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "public.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "readings.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "seasonal_liturgy_hymns.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "veneration.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "verses_of_the_cymbals.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key")
)
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table: check its spelling, or add that hymn first');
END;
DROP TRIGGER "aspasmos.hymn_texts_inline_hymn_key_insert";
CREATE TRIGGER "aspasmos.hymn_texts_inline_hymn_key_insert" BEFORE INSERT ON "aspasmos.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NEW."inline_hymn_key" NOT GLOB '[a-z]*.[a-z]*' AND NOT (
  EXISTS (SELECT 1 FROM "agpeya.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "aspasmos.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "canons.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "doxologies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "fractions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_responses.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_rite.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "holy_week.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "hymn_of_the_intercessions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "litanies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "liturgy.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "praxis_response.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "procession_of_the_cross.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "psalmody.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "public.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "readings.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "seasonal_liturgy_hymns.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "veneration.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "verses_of_the_cymbals.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key")
)
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table: check its spelling, or add that hymn first');
END;
DROP TRIGGER "aspasmos.hymn_texts_inline_hymn_key_update";
CREATE TRIGGER "aspasmos.hymn_texts_inline_hymn_key_update" BEFORE UPDATE OF "inline_hymn_key" ON "aspasmos.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NEW."inline_hymn_key" NOT GLOB '[a-z]*.[a-z]*' AND NOT (
  EXISTS (SELECT 1 FROM "agpeya.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "aspasmos.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "canons.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "doxologies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "fractions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_responses.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_rite.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "holy_week.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "hymn_of_the_intercessions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "litanies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "liturgy.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "praxis_response.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "procession_of_the_cross.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "psalmody.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "public.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "readings.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "seasonal_liturgy_hymns.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "veneration.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "verses_of_the_cymbals.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key")
)
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table: check its spelling, or add that hymn first');
END;
DROP TRIGGER "canons.hymn_texts_inline_hymn_key_insert";
CREATE TRIGGER "canons.hymn_texts_inline_hymn_key_insert" BEFORE INSERT ON "canons.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NEW."inline_hymn_key" NOT GLOB '[a-z]*.[a-z]*' AND NOT (
  EXISTS (SELECT 1 FROM "agpeya.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "aspasmos.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "canons.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "doxologies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "fractions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_responses.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_rite.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "holy_week.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "hymn_of_the_intercessions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "litanies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "liturgy.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "praxis_response.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "procession_of_the_cross.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "psalmody.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "public.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "readings.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "seasonal_liturgy_hymns.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "veneration.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "verses_of_the_cymbals.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key")
)
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table: check its spelling, or add that hymn first');
END;
DROP TRIGGER "canons.hymn_texts_inline_hymn_key_update";
CREATE TRIGGER "canons.hymn_texts_inline_hymn_key_update" BEFORE UPDATE OF "inline_hymn_key" ON "canons.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NEW."inline_hymn_key" NOT GLOB '[a-z]*.[a-z]*' AND NOT (
  EXISTS (SELECT 1 FROM "agpeya.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "aspasmos.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "canons.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "doxologies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "fractions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_responses.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_rite.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "holy_week.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "hymn_of_the_intercessions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "litanies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "liturgy.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "praxis_response.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "procession_of_the_cross.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "psalmody.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "public.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "readings.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "seasonal_liturgy_hymns.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "veneration.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "verses_of_the_cymbals.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key")
)
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table: check its spelling, or add that hymn first');
END;
DROP TRIGGER "doxologies.hymn_texts_inline_hymn_key_insert";
CREATE TRIGGER "doxologies.hymn_texts_inline_hymn_key_insert" BEFORE INSERT ON "doxologies.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NEW."inline_hymn_key" NOT GLOB '[a-z]*.[a-z]*' AND NOT (
  EXISTS (SELECT 1 FROM "agpeya.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "aspasmos.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "canons.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "doxologies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "fractions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_responses.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_rite.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "holy_week.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "hymn_of_the_intercessions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "litanies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "liturgy.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "praxis_response.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "procession_of_the_cross.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "psalmody.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "public.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "readings.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "seasonal_liturgy_hymns.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "veneration.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "verses_of_the_cymbals.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key")
)
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table: check its spelling, or add that hymn first');
END;
DROP TRIGGER "doxologies.hymn_texts_inline_hymn_key_update";
CREATE TRIGGER "doxologies.hymn_texts_inline_hymn_key_update" BEFORE UPDATE OF "inline_hymn_key" ON "doxologies.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NEW."inline_hymn_key" NOT GLOB '[a-z]*.[a-z]*' AND NOT (
  EXISTS (SELECT 1 FROM "agpeya.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "aspasmos.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "canons.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "doxologies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "fractions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_responses.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_rite.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "holy_week.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "hymn_of_the_intercessions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "litanies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "liturgy.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "praxis_response.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "procession_of_the_cross.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "psalmody.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "public.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "readings.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "seasonal_liturgy_hymns.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "veneration.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "verses_of_the_cymbals.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key")
)
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table: check its spelling, or add that hymn first');
END;
DROP TRIGGER "fractions.hymn_texts_inline_hymn_key_insert";
CREATE TRIGGER "fractions.hymn_texts_inline_hymn_key_insert" BEFORE INSERT ON "fractions.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NEW."inline_hymn_key" NOT GLOB '[a-z]*.[a-z]*' AND NOT (
  EXISTS (SELECT 1 FROM "agpeya.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "aspasmos.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "canons.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "doxologies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "fractions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_responses.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_rite.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "holy_week.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "hymn_of_the_intercessions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "litanies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "liturgy.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "praxis_response.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "procession_of_the_cross.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "psalmody.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "public.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "readings.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "seasonal_liturgy_hymns.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "veneration.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "verses_of_the_cymbals.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key")
)
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table: check its spelling, or add that hymn first');
END;
DROP TRIGGER "fractions.hymn_texts_inline_hymn_key_update";
CREATE TRIGGER "fractions.hymn_texts_inline_hymn_key_update" BEFORE UPDATE OF "inline_hymn_key" ON "fractions.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NEW."inline_hymn_key" NOT GLOB '[a-z]*.[a-z]*' AND NOT (
  EXISTS (SELECT 1 FROM "agpeya.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "aspasmos.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "canons.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "doxologies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "fractions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_responses.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_rite.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "holy_week.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "hymn_of_the_intercessions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "litanies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "liturgy.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "praxis_response.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "procession_of_the_cross.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "psalmody.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "public.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "readings.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "seasonal_liturgy_hymns.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "veneration.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "verses_of_the_cymbals.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key")
)
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table: check its spelling, or add that hymn first');
END;
DROP TRIGGER "gospel_responses.hymn_texts_inline_hymn_key_insert";
CREATE TRIGGER "gospel_responses.hymn_texts_inline_hymn_key_insert" BEFORE INSERT ON "gospel_responses.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NEW."inline_hymn_key" NOT GLOB '[a-z]*.[a-z]*' AND NOT (
  EXISTS (SELECT 1 FROM "agpeya.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "aspasmos.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "canons.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "doxologies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "fractions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_responses.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_rite.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "holy_week.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "hymn_of_the_intercessions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "litanies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "liturgy.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "praxis_response.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "procession_of_the_cross.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "psalmody.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "public.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "readings.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "seasonal_liturgy_hymns.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "veneration.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "verses_of_the_cymbals.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key")
)
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table: check its spelling, or add that hymn first');
END;
DROP TRIGGER "gospel_responses.hymn_texts_inline_hymn_key_update";
CREATE TRIGGER "gospel_responses.hymn_texts_inline_hymn_key_update" BEFORE UPDATE OF "inline_hymn_key" ON "gospel_responses.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NEW."inline_hymn_key" NOT GLOB '[a-z]*.[a-z]*' AND NOT (
  EXISTS (SELECT 1 FROM "agpeya.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "aspasmos.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "canons.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "doxologies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "fractions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_responses.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_rite.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "holy_week.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "hymn_of_the_intercessions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "litanies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "liturgy.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "praxis_response.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "procession_of_the_cross.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "psalmody.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "public.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "readings.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "seasonal_liturgy_hymns.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "veneration.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "verses_of_the_cymbals.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key")
)
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table: check its spelling, or add that hymn first');
END;
DROP TRIGGER "gospel_rite.hymn_texts_inline_hymn_key_insert";
CREATE TRIGGER "gospel_rite.hymn_texts_inline_hymn_key_insert" BEFORE INSERT ON "gospel_rite.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NEW."inline_hymn_key" NOT GLOB '[a-z]*.[a-z]*' AND NOT (
  EXISTS (SELECT 1 FROM "agpeya.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "aspasmos.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "canons.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "doxologies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "fractions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_responses.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_rite.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "holy_week.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "hymn_of_the_intercessions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "litanies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "liturgy.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "praxis_response.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "procession_of_the_cross.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "psalmody.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "public.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "readings.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "seasonal_liturgy_hymns.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "veneration.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "verses_of_the_cymbals.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key")
)
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table: check its spelling, or add that hymn first');
END;
DROP TRIGGER "gospel_rite.hymn_texts_inline_hymn_key_update";
CREATE TRIGGER "gospel_rite.hymn_texts_inline_hymn_key_update" BEFORE UPDATE OF "inline_hymn_key" ON "gospel_rite.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NEW."inline_hymn_key" NOT GLOB '[a-z]*.[a-z]*' AND NOT (
  EXISTS (SELECT 1 FROM "agpeya.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "aspasmos.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "canons.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "doxologies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "fractions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_responses.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_rite.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "holy_week.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "hymn_of_the_intercessions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "litanies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "liturgy.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "praxis_response.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "procession_of_the_cross.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "psalmody.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "public.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "readings.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "seasonal_liturgy_hymns.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "veneration.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "verses_of_the_cymbals.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key")
)
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table: check its spelling, or add that hymn first');
END;
DROP TRIGGER "holy_week.hymn_texts_inline_hymn_key_insert";
CREATE TRIGGER "holy_week.hymn_texts_inline_hymn_key_insert" BEFORE INSERT ON "holy_week.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NEW."inline_hymn_key" NOT GLOB '[a-z]*.[a-z]*' AND NOT (
  EXISTS (SELECT 1 FROM "agpeya.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "aspasmos.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "canons.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "doxologies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "fractions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_responses.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_rite.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "holy_week.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "hymn_of_the_intercessions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "litanies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "liturgy.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "praxis_response.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "procession_of_the_cross.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "psalmody.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "public.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "readings.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "seasonal_liturgy_hymns.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "veneration.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "verses_of_the_cymbals.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key")
)
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table: check its spelling, or add that hymn first');
END;
DROP TRIGGER "holy_week.hymn_texts_inline_hymn_key_update";
CREATE TRIGGER "holy_week.hymn_texts_inline_hymn_key_update" BEFORE UPDATE OF "inline_hymn_key" ON "holy_week.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NEW."inline_hymn_key" NOT GLOB '[a-z]*.[a-z]*' AND NOT (
  EXISTS (SELECT 1 FROM "agpeya.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "aspasmos.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "canons.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "doxologies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "fractions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_responses.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_rite.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "holy_week.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "hymn_of_the_intercessions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "litanies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "liturgy.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "praxis_response.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "procession_of_the_cross.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "psalmody.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "public.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "readings.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "seasonal_liturgy_hymns.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "veneration.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "verses_of_the_cymbals.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key")
)
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table: check its spelling, or add that hymn first');
END;
DROP TRIGGER "hymn_of_the_intercessions.hymn_texts_inline_hymn_key_insert";
CREATE TRIGGER "hymn_of_the_intercessions.hymn_texts_inline_hymn_key_insert" BEFORE INSERT ON "hymn_of_the_intercessions.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NEW."inline_hymn_key" NOT GLOB '[a-z]*.[a-z]*' AND NOT (
  EXISTS (SELECT 1 FROM "agpeya.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "aspasmos.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "canons.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "doxologies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "fractions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_responses.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_rite.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "holy_week.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "hymn_of_the_intercessions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "litanies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "liturgy.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "praxis_response.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "procession_of_the_cross.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "psalmody.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "public.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "readings.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "seasonal_liturgy_hymns.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "veneration.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "verses_of_the_cymbals.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key")
)
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table: check its spelling, or add that hymn first');
END;
DROP TRIGGER "hymn_of_the_intercessions.hymn_texts_inline_hymn_key_update";
CREATE TRIGGER "hymn_of_the_intercessions.hymn_texts_inline_hymn_key_update" BEFORE UPDATE OF "inline_hymn_key" ON "hymn_of_the_intercessions.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NEW."inline_hymn_key" NOT GLOB '[a-z]*.[a-z]*' AND NOT (
  EXISTS (SELECT 1 FROM "agpeya.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "aspasmos.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "canons.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "doxologies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "fractions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_responses.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_rite.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "holy_week.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "hymn_of_the_intercessions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "litanies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "liturgy.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "praxis_response.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "procession_of_the_cross.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "psalmody.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "public.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "readings.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "seasonal_liturgy_hymns.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "veneration.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "verses_of_the_cymbals.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key")
)
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table: check its spelling, or add that hymn first');
END;
DROP TRIGGER "litanies.hymn_texts_inline_hymn_key_insert";
CREATE TRIGGER "litanies.hymn_texts_inline_hymn_key_insert" BEFORE INSERT ON "litanies.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NEW."inline_hymn_key" NOT GLOB '[a-z]*.[a-z]*' AND NOT (
  EXISTS (SELECT 1 FROM "agpeya.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "aspasmos.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "canons.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "doxologies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "fractions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_responses.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_rite.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "holy_week.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "hymn_of_the_intercessions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "litanies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "liturgy.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "praxis_response.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "procession_of_the_cross.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "psalmody.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "public.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "readings.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "seasonal_liturgy_hymns.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "veneration.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "verses_of_the_cymbals.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key")
)
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table: check its spelling, or add that hymn first');
END;
DROP TRIGGER "litanies.hymn_texts_inline_hymn_key_update";
CREATE TRIGGER "litanies.hymn_texts_inline_hymn_key_update" BEFORE UPDATE OF "inline_hymn_key" ON "litanies.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NEW."inline_hymn_key" NOT GLOB '[a-z]*.[a-z]*' AND NOT (
  EXISTS (SELECT 1 FROM "agpeya.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "aspasmos.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "canons.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "doxologies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "fractions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_responses.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_rite.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "holy_week.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "hymn_of_the_intercessions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "litanies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "liturgy.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "praxis_response.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "procession_of_the_cross.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "psalmody.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "public.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "readings.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "seasonal_liturgy_hymns.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "veneration.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "verses_of_the_cymbals.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key")
)
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table: check its spelling, or add that hymn first');
END;
DROP TRIGGER "liturgy.hymn_texts_inline_hymn_key_insert";
CREATE TRIGGER "liturgy.hymn_texts_inline_hymn_key_insert" BEFORE INSERT ON "liturgy.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NEW."inline_hymn_key" NOT GLOB '[a-z]*.[a-z]*' AND NOT (
  EXISTS (SELECT 1 FROM "agpeya.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "aspasmos.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "canons.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "doxologies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "fractions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_responses.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_rite.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "holy_week.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "hymn_of_the_intercessions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "litanies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "liturgy.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "praxis_response.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "procession_of_the_cross.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "psalmody.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "public.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "readings.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "seasonal_liturgy_hymns.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "veneration.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "verses_of_the_cymbals.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key")
)
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table: check its spelling, or add that hymn first');
END;
DROP TRIGGER "liturgy.hymn_texts_inline_hymn_key_update";
CREATE TRIGGER "liturgy.hymn_texts_inline_hymn_key_update" BEFORE UPDATE OF "inline_hymn_key" ON "liturgy.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NEW."inline_hymn_key" NOT GLOB '[a-z]*.[a-z]*' AND NOT (
  EXISTS (SELECT 1 FROM "agpeya.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "aspasmos.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "canons.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "doxologies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "fractions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_responses.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_rite.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "holy_week.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "hymn_of_the_intercessions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "litanies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "liturgy.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "praxis_response.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "procession_of_the_cross.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "psalmody.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "public.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "readings.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "seasonal_liturgy_hymns.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "veneration.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "verses_of_the_cymbals.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key")
)
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table: check its spelling, or add that hymn first');
END;
DROP TRIGGER "praxis_response.hymn_texts_inline_hymn_key_insert";
CREATE TRIGGER "praxis_response.hymn_texts_inline_hymn_key_insert" BEFORE INSERT ON "praxis_response.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NEW."inline_hymn_key" NOT GLOB '[a-z]*.[a-z]*' AND NOT (
  EXISTS (SELECT 1 FROM "agpeya.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "aspasmos.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "canons.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "doxologies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "fractions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_responses.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_rite.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "holy_week.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "hymn_of_the_intercessions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "litanies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "liturgy.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "praxis_response.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "procession_of_the_cross.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "psalmody.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "public.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "readings.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "seasonal_liturgy_hymns.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "veneration.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "verses_of_the_cymbals.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key")
)
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table: check its spelling, or add that hymn first');
END;
DROP TRIGGER "praxis_response.hymn_texts_inline_hymn_key_update";
CREATE TRIGGER "praxis_response.hymn_texts_inline_hymn_key_update" BEFORE UPDATE OF "inline_hymn_key" ON "praxis_response.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NEW."inline_hymn_key" NOT GLOB '[a-z]*.[a-z]*' AND NOT (
  EXISTS (SELECT 1 FROM "agpeya.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "aspasmos.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "canons.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "doxologies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "fractions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_responses.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_rite.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "holy_week.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "hymn_of_the_intercessions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "litanies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "liturgy.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "praxis_response.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "procession_of_the_cross.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "psalmody.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "public.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "readings.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "seasonal_liturgy_hymns.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "veneration.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "verses_of_the_cymbals.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key")
)
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table: check its spelling, or add that hymn first');
END;
DROP TRIGGER "procession_of_the_cross.hymn_texts_inline_hymn_key_insert";
CREATE TRIGGER "procession_of_the_cross.hymn_texts_inline_hymn_key_insert" BEFORE INSERT ON "procession_of_the_cross.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NEW."inline_hymn_key" NOT GLOB '[a-z]*.[a-z]*' AND NOT (
  EXISTS (SELECT 1 FROM "agpeya.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "aspasmos.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "canons.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "doxologies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "fractions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_responses.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_rite.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "holy_week.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "hymn_of_the_intercessions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "litanies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "liturgy.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "praxis_response.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "procession_of_the_cross.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "psalmody.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "public.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "readings.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "seasonal_liturgy_hymns.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "veneration.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "verses_of_the_cymbals.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key")
)
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table: check its spelling, or add that hymn first');
END;
DROP TRIGGER "procession_of_the_cross.hymn_texts_inline_hymn_key_update";
CREATE TRIGGER "procession_of_the_cross.hymn_texts_inline_hymn_key_update" BEFORE UPDATE OF "inline_hymn_key" ON "procession_of_the_cross.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NEW."inline_hymn_key" NOT GLOB '[a-z]*.[a-z]*' AND NOT (
  EXISTS (SELECT 1 FROM "agpeya.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "aspasmos.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "canons.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "doxologies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "fractions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_responses.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_rite.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "holy_week.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "hymn_of_the_intercessions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "litanies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "liturgy.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "praxis_response.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "procession_of_the_cross.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "psalmody.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "public.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "readings.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "seasonal_liturgy_hymns.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "veneration.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "verses_of_the_cymbals.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key")
)
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table: check its spelling, or add that hymn first');
END;
DROP TRIGGER "psalmody.hymn_texts_inline_hymn_key_insert";
CREATE TRIGGER "psalmody.hymn_texts_inline_hymn_key_insert" BEFORE INSERT ON "psalmody.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NEW."inline_hymn_key" NOT GLOB '[a-z]*.[a-z]*' AND NOT (
  EXISTS (SELECT 1 FROM "agpeya.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "aspasmos.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "canons.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "doxologies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "fractions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_responses.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_rite.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "holy_week.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "hymn_of_the_intercessions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "litanies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "liturgy.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "praxis_response.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "procession_of_the_cross.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "psalmody.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "public.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "readings.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "seasonal_liturgy_hymns.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "veneration.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "verses_of_the_cymbals.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key")
)
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table: check its spelling, or add that hymn first');
END;
DROP TRIGGER "psalmody.hymn_texts_inline_hymn_key_update";
CREATE TRIGGER "psalmody.hymn_texts_inline_hymn_key_update" BEFORE UPDATE OF "inline_hymn_key" ON "psalmody.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NEW."inline_hymn_key" NOT GLOB '[a-z]*.[a-z]*' AND NOT (
  EXISTS (SELECT 1 FROM "agpeya.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "aspasmos.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "canons.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "doxologies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "fractions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_responses.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_rite.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "holy_week.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "hymn_of_the_intercessions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "litanies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "liturgy.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "praxis_response.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "procession_of_the_cross.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "psalmody.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "public.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "readings.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "seasonal_liturgy_hymns.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "veneration.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "verses_of_the_cymbals.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key")
)
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table: check its spelling, or add that hymn first');
END;
DROP TRIGGER "public.hymn_texts_inline_hymn_key_insert";
CREATE TRIGGER "public.hymn_texts_inline_hymn_key_insert" BEFORE INSERT ON "public.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NEW."inline_hymn_key" NOT GLOB '[a-z]*.[a-z]*' AND NOT (
  EXISTS (SELECT 1 FROM "agpeya.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "aspasmos.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "canons.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "doxologies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "fractions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_responses.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_rite.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "holy_week.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "hymn_of_the_intercessions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "litanies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "liturgy.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "praxis_response.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "procession_of_the_cross.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "psalmody.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "public.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "readings.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "seasonal_liturgy_hymns.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "veneration.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "verses_of_the_cymbals.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key")
)
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table: check its spelling, or add that hymn first');
END;
DROP TRIGGER "public.hymn_texts_inline_hymn_key_update";
CREATE TRIGGER "public.hymn_texts_inline_hymn_key_update" BEFORE UPDATE OF "inline_hymn_key" ON "public.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NEW."inline_hymn_key" NOT GLOB '[a-z]*.[a-z]*' AND NOT (
  EXISTS (SELECT 1 FROM "agpeya.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "aspasmos.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "canons.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "doxologies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "fractions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_responses.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_rite.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "holy_week.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "hymn_of_the_intercessions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "litanies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "liturgy.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "praxis_response.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "procession_of_the_cross.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "psalmody.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "public.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "readings.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "seasonal_liturgy_hymns.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "veneration.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "verses_of_the_cymbals.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key")
)
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table: check its spelling, or add that hymn first');
END;
DROP TRIGGER "readings.hymn_texts_inline_hymn_key_insert";
CREATE TRIGGER "readings.hymn_texts_inline_hymn_key_insert" BEFORE INSERT ON "readings.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NEW."inline_hymn_key" NOT GLOB '[a-z]*.[a-z]*' AND NOT (
  EXISTS (SELECT 1 FROM "agpeya.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "aspasmos.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "canons.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "doxologies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "fractions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_responses.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_rite.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "holy_week.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "hymn_of_the_intercessions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "litanies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "liturgy.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "praxis_response.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "procession_of_the_cross.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "psalmody.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "public.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "readings.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "seasonal_liturgy_hymns.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "veneration.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "verses_of_the_cymbals.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key")
)
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table: check its spelling, or add that hymn first');
END;
DROP TRIGGER "readings.hymn_texts_inline_hymn_key_update";
CREATE TRIGGER "readings.hymn_texts_inline_hymn_key_update" BEFORE UPDATE OF "inline_hymn_key" ON "readings.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NEW."inline_hymn_key" NOT GLOB '[a-z]*.[a-z]*' AND NOT (
  EXISTS (SELECT 1 FROM "agpeya.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "aspasmos.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "canons.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "doxologies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "fractions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_responses.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_rite.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "holy_week.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "hymn_of_the_intercessions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "litanies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "liturgy.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "praxis_response.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "procession_of_the_cross.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "psalmody.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "public.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "readings.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "seasonal_liturgy_hymns.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "veneration.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "verses_of_the_cymbals.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key")
)
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table: check its spelling, or add that hymn first');
END;
DROP TRIGGER "seasonal_liturgy_hymns.hymn_texts_inline_hymn_key_insert";
CREATE TRIGGER "seasonal_liturgy_hymns.hymn_texts_inline_hymn_key_insert" BEFORE INSERT ON "seasonal_liturgy_hymns.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NEW."inline_hymn_key" NOT GLOB '[a-z]*.[a-z]*' AND NOT (
  EXISTS (SELECT 1 FROM "agpeya.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "aspasmos.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "canons.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "doxologies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "fractions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_responses.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_rite.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "holy_week.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "hymn_of_the_intercessions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "litanies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "liturgy.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "praxis_response.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "procession_of_the_cross.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "psalmody.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "public.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "readings.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "seasonal_liturgy_hymns.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "veneration.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "verses_of_the_cymbals.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key")
)
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table: check its spelling, or add that hymn first');
END;
DROP TRIGGER "seasonal_liturgy_hymns.hymn_texts_inline_hymn_key_update";
CREATE TRIGGER "seasonal_liturgy_hymns.hymn_texts_inline_hymn_key_update" BEFORE UPDATE OF "inline_hymn_key" ON "seasonal_liturgy_hymns.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NEW."inline_hymn_key" NOT GLOB '[a-z]*.[a-z]*' AND NOT (
  EXISTS (SELECT 1 FROM "agpeya.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "aspasmos.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "canons.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "doxologies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "fractions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_responses.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_rite.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "holy_week.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "hymn_of_the_intercessions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "litanies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "liturgy.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "praxis_response.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "procession_of_the_cross.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "psalmody.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "public.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "readings.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "seasonal_liturgy_hymns.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "veneration.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "verses_of_the_cymbals.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key")
)
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table: check its spelling, or add that hymn first');
END;
DROP TRIGGER "veneration.hymn_texts_inline_hymn_key_insert";
CREATE TRIGGER "veneration.hymn_texts_inline_hymn_key_insert" BEFORE INSERT ON "veneration.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NEW."inline_hymn_key" NOT GLOB '[a-z]*.[a-z]*' AND NOT (
  EXISTS (SELECT 1 FROM "agpeya.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "aspasmos.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "canons.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "doxologies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "fractions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_responses.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_rite.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "holy_week.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "hymn_of_the_intercessions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "litanies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "liturgy.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "praxis_response.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "procession_of_the_cross.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "psalmody.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "public.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "readings.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "seasonal_liturgy_hymns.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "veneration.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "verses_of_the_cymbals.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key")
)
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table: check its spelling, or add that hymn first');
END;
DROP TRIGGER "veneration.hymn_texts_inline_hymn_key_update";
CREATE TRIGGER "veneration.hymn_texts_inline_hymn_key_update" BEFORE UPDATE OF "inline_hymn_key" ON "veneration.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NEW."inline_hymn_key" NOT GLOB '[a-z]*.[a-z]*' AND NOT (
  EXISTS (SELECT 1 FROM "agpeya.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "aspasmos.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "canons.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "doxologies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "fractions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_responses.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_rite.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "holy_week.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "hymn_of_the_intercessions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "litanies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "liturgy.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "praxis_response.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "procession_of_the_cross.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "psalmody.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "public.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "readings.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "seasonal_liturgy_hymns.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "veneration.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "verses_of_the_cymbals.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key")
)
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table: check its spelling, or add that hymn first');
END;
DROP TRIGGER "verses_of_the_cymbals.hymn_texts_inline_hymn_key_insert";
CREATE TRIGGER "verses_of_the_cymbals.hymn_texts_inline_hymn_key_insert" BEFORE INSERT ON "verses_of_the_cymbals.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NEW."inline_hymn_key" NOT GLOB '[a-z]*.[a-z]*' AND NOT (
  EXISTS (SELECT 1 FROM "agpeya.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "aspasmos.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "canons.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "doxologies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "fractions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_responses.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_rite.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "holy_week.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "hymn_of_the_intercessions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "litanies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "liturgy.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "praxis_response.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "procession_of_the_cross.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "psalmody.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "public.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "readings.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "seasonal_liturgy_hymns.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "veneration.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "verses_of_the_cymbals.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key")
)
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table: check its spelling, or add that hymn first');
END;
DROP TRIGGER "verses_of_the_cymbals.hymn_texts_inline_hymn_key_update";
CREATE TRIGGER "verses_of_the_cymbals.hymn_texts_inline_hymn_key_update" BEFORE UPDATE OF "inline_hymn_key" ON "verses_of_the_cymbals.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NEW."inline_hymn_key" NOT GLOB '[a-z]*.[a-z]*' AND NOT (
  EXISTS (SELECT 1 FROM "agpeya.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "aspasmos.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "canons.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "doxologies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "fractions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_responses.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "gospel_rite.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "holy_week.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "hymn_of_the_intercessions.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "litanies.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "liturgy.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "praxis_response.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "procession_of_the_cross.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "psalmody.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "public.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "readings.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "seasonal_liturgy_hymns.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "veneration.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key") OR
  EXISTS (SELECT 1 FROM "verses_of_the_cymbals.hymn_texts" WHERE "hymn_key" = NEW."inline_hymn_key")
)
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table: check its spelling, or add that hymn first');
END;

-- The calls.
UPDATE "agpeya.eleventh_hour" SET "hymn_key" = 'agpeya.introduction_to_every_hour' WHERE "hymn_key" = 'INTRODUCTION_TO_EVERY_HOUR' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "agpeya.eleventh_hour" SET "hymn_key" = 'agpeya.twelfth_hour' WHERE "hymn_key" = 'TWELFTH_HOUR' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "agpeya.first_hour" SET "hymn_key" = 'agpeya.introduction_to_every_hour' WHERE "hymn_key" = 'INTRODUCTION_TO_EVERY_HOUR' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "agpeya.first_hour" SET "hymn_key" = 'agpeya.third_hour' WHERE "hymn_key" = 'THIRD_HOUR' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "agpeya.midnight_hour" SET "hymn_key" = 'agpeya.first_hour' WHERE "hymn_key" = 'FIRST_HOUR' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "agpeya.midnight_hour" SET "hymn_key" = 'agpeya.introduction_to_every_hour' WHERE "hymn_key" = 'INTRODUCTION_TO_EVERY_HOUR' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "agpeya.ninth_hour" SET "hymn_key" = 'agpeya.eleventh_hour' WHERE "hymn_key" = 'ELEVENTH_HOUR' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "agpeya.ninth_hour" SET "hymn_key" = 'agpeya.introduction_to_every_hour' WHERE "hymn_key" = 'INTRODUCTION_TO_EVERY_HOUR' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "agpeya.prayer_of_the_veil" SET "hymn_key" = 'agpeya.introduction_to_every_hour' WHERE "hymn_key" = 'INTRODUCTION_TO_EVERY_HOUR' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "agpeya.prayer_of_the_veil" SET "hymn_key" = 'agpeya.midnight_hour' WHERE "hymn_key" = 'MIDNIGHT_HOUR' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "agpeya.sixth_hour" SET "hymn_key" = 'agpeya.introduction_to_every_hour' WHERE "hymn_key" = 'INTRODUCTION_TO_EVERY_HOUR' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "agpeya.sixth_hour" SET "hymn_key" = 'agpeya.ninth_hour' WHERE "hymn_key" = 'NINTH_HOUR' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "agpeya.third_hour" SET "hymn_key" = 'agpeya.introduction_to_every_hour' WHERE "hymn_key" = 'INTRODUCTION_TO_EVERY_HOUR' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "agpeya.third_hour" SET "hymn_key" = 'agpeya.sixth_hour' WHERE "hymn_key" = 'SIXTH_HOUR' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "agpeya.twelfth_hour" SET "hymn_key" = 'agpeya.introduction_to_every_hour' WHERE "hymn_key" = 'INTRODUCTION_TO_EVERY_HOUR' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "agpeya.twelfth_hour" SET "hymn_key" = 'agpeya.midnight_hour' WHERE "hymn_key" = 'MIDNIGHT_HOUR' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "agpeya.twelfth_hour" SET "hymn_key" = 'agpeya.prayer_of_the_veil' WHERE "hymn_key" = 'PRAYER_OF_THE_VEIL' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "holy_week.good_friday_ninth_hour" SET "hymn_key" = 'readings.coptic_prophecy' WHERE "hymn_key" = 'COPTIC_PROPHECY' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "holy_week.good_friday_ninth_hour" SET "hymn_key" = 'gospel_rite.mournful_4_gospels_rite' WHERE "hymn_key" = 'MOURNFUL_4_GOSPELS_RITE' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "holy_week.good_friday_sixth_hour" SET "hymn_key" = 'readings.coptic_prophecy' WHERE "hymn_key" = 'COPTIC_PROPHECY' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "holy_week.good_friday_sixth_hour" SET "hymn_key" = 'gospel_rite.mournful_4_gospels_rite' WHERE "hymn_key" = 'MOURNFUL_4_GOSPELS_RITE' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "holy_week.good_friday_twelfth_hour" SET "hymn_key" = 'readings.coptic_prophecy' WHERE "hymn_key" = 'COPTIC_PROPHECY' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "holy_week.good_friday_twelfth_hour" SET "hymn_key" = 'gospel_rite.mournful_4_gospels_rite' WHERE "hymn_key" = 'MOURNFUL_4_GOSPELS_RITE' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "holy_week.holy_thursday" SET "hymn_key" = 'verses_of_the_cymbals.verses_of_the_cymbals' WHERE "hymn_key" = 'VERSES_OF_THE_CYMBALS' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "holy_week.pascha_common_hymns" SET "hymn_key" = 'canons.canons' WHERE "hymn_key" = 'CANONS' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "holy_week.pascha_hour" SET "hymn_key" = 'canons.canons' WHERE "hymn_key" = 'CANONS' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "holy_week.pascha_hour" SET "hymn_key" = 'readings.coptic_prophecy' WHERE "hymn_key" = 'COPTIC_PROPHECY' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "holy_week.pascha_hour" SET "hymn_key" = 'gospel_rite.mournful_4_gospels_rite' WHERE "hymn_key" = 'MOURNFUL_4_GOSPELS_RITE' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "holy_week.pascha_hour" SET "hymn_key" = 'gospel_rite.mournful_gospel_rite' WHERE "hymn_key" = 'MOURNFUL_GOSPEL_RITE' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "holy_week.thursday_first_hour" SET "hymn_key" = 'canons.canons' WHERE "hymn_key" = 'CANONS' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "holy_week.thursday_first_hour" SET "hymn_key" = 'readings.coptic_prophecy' WHERE "hymn_key" = 'COPTIC_PROPHECY' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "holy_week.thursday_first_hour" SET "hymn_key" = 'doxologies.doxologies' WHERE "hymn_key" = 'DOXOLOGIES' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "holy_week.thursday_first_hour" SET "hymn_key" = 'gospel_rite.mournful_gospel_rite' WHERE "hymn_key" = 'MOURNFUL_GOSPEL_RITE' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "holy_week.thursday_first_hour" SET "hymn_key" = 'verses_of_the_cymbals.verses_of_the_cymbals' WHERE "hymn_key" = 'VERSES_OF_THE_CYMBALS' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.distribution" SET "hymn_key" = 'canons.canons' WHERE "hymn_key" = 'CANONS' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.distribution" SET "hymn_key" = 'seasonal_liturgy_hymns.seasonal_distribution_hymns' WHERE "hymn_key" = 'SEASONAL_DISTRIBUTION_HYMNS' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.lectionary_liturgy" SET "hymn_key" = 'readings.catholic_epistle' WHERE "hymn_key" = 'CATHOLIC_EPISTLE' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.lectionary_liturgy" SET "hymn_key" = 'readings.coptic_catholic_epistle' WHERE "hymn_key" = 'COPTIC_CATHOLIC_EPISTLE' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.lectionary_liturgy" SET "hymn_key" = 'readings.coptic_pauline_epistle' WHERE "hymn_key" = 'COPTIC_PAULINE_EPISTLE' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.lectionary_liturgy" SET "hymn_key" = 'readings.coptic_praxis' WHERE "hymn_key" = 'COPTIC_PRAXIS' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.lectionary_liturgy" SET "hymn_key" = 'gospel_rite.gospel_rite' WHERE "hymn_key" = 'GOSPEL_RITE' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.lectionary_liturgy" SET "hymn_key" = 'gospel_rite.palm_sunday_liturgy_gospel_rite' WHERE "hymn_key" = 'PALM_SUNDAY_LITURGY_GOSPEL_RITE' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.lectionary_liturgy" SET "hymn_key" = 'readings.pauline_epistle' WHERE "hymn_key" = 'PAULINE_EPISTLE' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.lectionary_liturgy" SET "hymn_key" = 'readings.praxis' WHERE "hymn_key" = 'PRAXIS' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.lectionary_matins" SET "hymn_key" = 'readings.coptic_prophecy' WHERE "hymn_key" = 'COPTIC_PROPHECY' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.lectionary_matins" SET "hymn_key" = 'gospel_rite.gospel_rite' WHERE "hymn_key" = 'GOSPEL_RITE' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.lectionary_matins" SET "hymn_key" = 'liturgy.lectionary_liturgy' WHERE "hymn_key" = 'LECTIONARY_LITURGY' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.lectionary_matins" SET "hymn_key" = 'readings.prophecy' WHERE "hymn_key" = 'PROPHECY' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.lectionary_vespers" SET "hymn_key" = 'gospel_rite.gospel_rite' WHERE "hymn_key" = 'GOSPEL_RITE' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.lectionary_vespers" SET "hymn_key" = 'liturgy.lectionary_matins' WHERE "hymn_key" = 'LECTIONARY_MATINS' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.liturgy_agpeya" SET "hymn_key" = 'agpeya.eleventh_hour' WHERE "hymn_key" = 'ELEVENTH_HOUR' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.liturgy_agpeya" SET "hymn_key" = 'agpeya.ninth_hour' WHERE "hymn_key" = 'NINTH_HOUR' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.liturgy_agpeya" SET "hymn_key" = 'agpeya.prayer_of_the_veil' WHERE "hymn_key" = 'PRAYER_OF_THE_VEIL' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.liturgy_agpeya" SET "hymn_key" = 'agpeya.sixth_hour' WHERE "hymn_key" = 'SIXTH_HOUR' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.liturgy_agpeya" SET "hymn_key" = 'agpeya.third_hour' WHERE "hymn_key" = 'THIRD_HOUR' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.liturgy_agpeya" SET "hymn_key" = 'agpeya.twelfth_hour' WHERE "hymn_key" = 'TWELFTH_HOUR' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.liturgy_of_st_basil" SET "hymn_key" = 'aspasmos.adam_aspasmos' WHERE "hymn_key" = 'ADAM_ASPASMOS' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.liturgy_of_st_basil" SET "hymn_key" = 'liturgy.commemoration_of_the_saints_hymns' WHERE "hymn_key" = 'COMMEMORATION_OF_THE_SAINTS_HYMNS' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.liturgy_of_st_basil" SET "hymn_key" = 'liturgy.distribution' WHERE "hymn_key" = 'DISTRIBUTION' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.liturgy_of_st_basil" SET "hymn_key" = 'fractions.fractions' WHERE "hymn_key" = 'FRACTIONS' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.liturgy_of_st_basil" SET "hymn_key" = 'gospel_responses.gospel_responses' WHERE "hymn_key" = 'GOSPEL_RESPONSES' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.liturgy_of_st_basil" SET "hymn_key" = 'litanies.the_three_great_litanies' WHERE "hymn_key" = 'THE_THREE_GREAT_LITANIES' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.liturgy_of_st_basil" SET "hymn_key" = 'aspasmos.vatos_aspasmos' WHERE "hymn_key" = 'VATOS_ASPASMOS' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.liturgy_of_st_cyril" SET "hymn_key" = 'fractions.fractions' WHERE "hymn_key" = 'FRACTIONS' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.liturgy_of_st_cyril" SET "hymn_key" = 'gospel_responses.gospel_responses' WHERE "hymn_key" = 'GOSPEL_RESPONSES' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.liturgy_of_st_gregory" SET "hymn_key" = 'aspasmos.adam_aspasmos' WHERE "hymn_key" = 'ADAM_ASPASMOS' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.liturgy_of_st_gregory" SET "hymn_key" = 'liturgy.commemoration_of_the_saints_hymns' WHERE "hymn_key" = 'COMMEMORATION_OF_THE_SAINTS_HYMNS' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.liturgy_of_st_gregory" SET "hymn_key" = 'liturgy.distribution' WHERE "hymn_key" = 'DISTRIBUTION' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.liturgy_of_st_gregory" SET "hymn_key" = 'fractions.fractions' WHERE "hymn_key" = 'FRACTIONS' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.liturgy_of_st_gregory" SET "hymn_key" = 'gospel_responses.gospel_responses' WHERE "hymn_key" = 'GOSPEL_RESPONSES' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.liturgy_of_st_gregory" SET "hymn_key" = 'litanies.the_three_great_litanies' WHERE "hymn_key" = 'THE_THREE_GREAT_LITANIES' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.liturgy_of_st_gregory" SET "hymn_key" = 'aspasmos.vatos_aspasmos' WHERE "hymn_key" = 'VATOS_ASPASMOS' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.liturgy_of_the_word" SET "hymn_key" = 'readings.catholic_epistle' WHERE "hymn_key" = 'CATHOLIC_EPISTLE' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.liturgy_of_the_word" SET "hymn_key" = 'readings.coptic_catholic_epistle' WHERE "hymn_key" = 'COPTIC_CATHOLIC_EPISTLE' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.liturgy_of_the_word" SET "hymn_key" = 'readings.coptic_pauline_epistle' WHERE "hymn_key" = 'COPTIC_PAULINE_EPISTLE' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.liturgy_of_the_word" SET "hymn_key" = 'readings.coptic_praxis' WHERE "hymn_key" = 'COPTIC_PRAXIS' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.liturgy_of_the_word" SET "hymn_key" = 'gospel_rite.gospel_rite' WHERE "hymn_key" = 'GOSPEL_RITE' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.liturgy_of_the_word" SET "hymn_key" = 'hymn_of_the_intercessions.hymn_of_the_intercessions' WHERE "hymn_key" = 'HYMN_OF_THE_INTERCESSIONS' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.liturgy_of_the_word" SET "hymn_key" = 'liturgy.liturgy_of_st_basil' WHERE "hymn_key" = 'LITURGY_OF_ST_BASIL' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.liturgy_of_the_word" SET "hymn_key" = 'liturgy.liturgy_of_st_cyril' WHERE "hymn_key" = 'LITURGY_OF_ST_CYRIL' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.liturgy_of_the_word" SET "hymn_key" = 'liturgy.liturgy_of_st_gregory' WHERE "hymn_key" = 'LITURGY_OF_ST_GREGORY' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.liturgy_of_the_word" SET "hymn_key" = 'gospel_rite.palm_sunday_liturgy_gospel_rite' WHERE "hymn_key" = 'PALM_SUNDAY_LITURGY_GOSPEL_RITE' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.liturgy_of_the_word" SET "hymn_key" = 'readings.pauline_epistle' WHERE "hymn_key" = 'PAULINE_EPISTLE' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.liturgy_of_the_word" SET "hymn_key" = 'readings.praxis' WHERE "hymn_key" = 'PRAXIS' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.liturgy_of_the_word" SET "hymn_key" = 'praxis_response.praxis_response' WHERE "hymn_key" = 'PRAXIS_RESPONSE' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.liturgy_of_the_word" SET "hymn_key" = 'seasonal_liturgy_hymns.seasonal_liturgy_of_the_word_hymns' WHERE "hymn_key" = 'SEASONAL_LITURGY_OF_THE_WORD_HYMNS' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.liturgy_of_the_word" SET "hymn_key" = 'veneration.veneration' WHERE "hymn_key" = 'VENERATION' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.offering_of_the_lamb" SET "hymn_key" = 'liturgy.liturgy_agpeya' WHERE "hymn_key" = 'LITURGY_AGPEYA' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.offering_of_the_lamb" SET "hymn_key" = 'liturgy.liturgy_of_the_word' WHERE "hymn_key" = 'LITURGY_OF_THE_WORD' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.raising_of_incense" SET "hymn_key" = 'canons.canons' WHERE "hymn_key" = 'CANONS' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.raising_of_incense" SET "hymn_key" = 'readings.coptic_prophecy' WHERE "hymn_key" = 'COPTIC_PROPHECY' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.raising_of_incense" SET "hymn_key" = 'doxologies.doxologies' WHERE "hymn_key" = 'DOXOLOGIES' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.raising_of_incense" SET "hymn_key" = 'gospel_responses.gospel_responses' WHERE "hymn_key" = 'GOSPEL_RESPONSES' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.raising_of_incense" SET "hymn_key" = 'gospel_rite.gospel_rite' WHERE "hymn_key" = 'GOSPEL_RITE' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.raising_of_incense" SET "hymn_key" = 'psalmody.midnight_praises' WHERE "hymn_key" = 'MIDNIGHT_PRAISES' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.raising_of_incense" SET "hymn_key" = 'liturgy.offering_of_the_lamb' WHERE "hymn_key" = 'OFFERING_OF_THE_LAMB' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.raising_of_incense" SET "hymn_key" = 'procession_of_the_cross.procession_of_the_cross' WHERE "hymn_key" = 'PROCESSION_OF_THE_CROSS' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.raising_of_incense" SET "hymn_key" = 'readings.prophecy' WHERE "hymn_key" = 'PROPHECY' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.raising_of_incense" SET "hymn_key" = 'litanies.the_five_short_litanies' WHERE "hymn_key" = 'THE_FIVE_SHORT_LITANIES' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.raising_of_incense" SET "hymn_key" = 'veneration.veneration' WHERE "hymn_key" = 'VENERATION' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.raising_of_incense" SET "hymn_key" = 'verses_of_the_cymbals.verses_of_the_cymbals' WHERE "hymn_key" = 'VERSES_OF_THE_CYMBALS' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "liturgy.raising_of_incense" SET "hymn_key" = 'procession_of_the_cross.vespers_procession' WHERE "hymn_key" = 'VESPERS_PROCESSION' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "psalmody.midnight_praises" SET "hymn_key" = 'psalmody.antiphonary' WHERE "hymn_key" = 'ANTIPHONARY' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "psalmody.midnight_praises" SET "hymn_key" = 'canons.canons' WHERE "hymn_key" = 'CANONS' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "psalmody.midnight_praises" SET "hymn_key" = 'doxologies.doxologies' WHERE "hymn_key" = 'DOXOLOGIES' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "psalmody.midnight_praises" SET "hymn_key" = 'agpeya.midnight_hour' WHERE "hymn_key" = 'MIDNIGHT_HOUR' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "psalmody.midnight_praises" SET "hymn_key" = 'psalmody.morning_doxology' WHERE "hymn_key" = 'MORNING_DOXOLOGY' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "psalmody.midnight_praises" SET "hymn_key" = 'psalmody.psalies_daily' WHERE "hymn_key" = 'PSALIES_DAILY' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "psalmody.midnight_praises" SET "hymn_key" = 'psalmody.psalies_saints' WHERE "hymn_key" = 'PSALIES_SAINTS' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "psalmody.midnight_praises" SET "hymn_key" = 'psalmody.psalies_seasonal' WHERE "hymn_key" = 'PSALIES_SEASONAL' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "psalmody.morning_doxology" SET "hymn_key" = 'agpeya.first_hour' WHERE "hymn_key" = 'FIRST_HOUR' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "psalmody.vespers_praises" SET "hymn_key" = 'agpeya.eleventh_hour' WHERE "hymn_key" = 'ELEVENTH_HOUR' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "psalmody.vespers_praises" SET "hymn_key" = 'agpeya.ninth_hour' WHERE "hymn_key" = 'NINTH_HOUR' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "psalmody.vespers_praises" SET "hymn_key" = 'agpeya.prayer_of_the_veil' WHERE "hymn_key" = 'PRAYER_OF_THE_VEIL' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "psalmody.vespers_praises" SET "hymn_key" = 'psalmody.psalies_daily' WHERE "hymn_key" = 'PSALIES_DAILY' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "psalmody.vespers_praises" SET "hymn_key" = 'psalmody.psalies_saints' WHERE "hymn_key" = 'PSALIES_SAINTS' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "psalmody.vespers_praises" SET "hymn_key" = 'psalmody.psalies_seasonal' WHERE "hymn_key" = 'PSALIES_SEASONAL' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "psalmody.vespers_praises" SET "hymn_key" = 'agpeya.twelfth_hour' WHERE "hymn_key" = 'TWELFTH_HOUR' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');
UPDATE "veneration.veneration" SET "hymn_key" = 'psalmody.antiphonary' WHERE "hymn_key" = 'ANTIPHONARY' AND "item_type" IN ('Inline', 'Subdocument', 'Hyperlink');

-- Their titles, in each schema that has one.
UPDATE "agpeya.hymn_titles" SET "hymn_key" = 'agpeya.eleventh_hour' WHERE "hymn_key" = 'ELEVENTH_HOUR';
UPDATE "agpeya.hymn_titles" SET "hymn_key" = 'agpeya.first_hour' WHERE "hymn_key" = 'FIRST_HOUR';
UPDATE "agpeya.hymn_titles" SET "hymn_key" = 'agpeya.introduction_to_every_hour' WHERE "hymn_key" = 'INTRODUCTION_TO_EVERY_HOUR';
UPDATE "agpeya.hymn_titles" SET "hymn_key" = 'agpeya.midnight_hour' WHERE "hymn_key" = 'MIDNIGHT_HOUR';
UPDATE "agpeya.hymn_titles" SET "hymn_key" = 'agpeya.ninth_hour' WHERE "hymn_key" = 'NINTH_HOUR';
UPDATE "agpeya.hymn_titles" SET "hymn_key" = 'agpeya.prayer_of_the_veil' WHERE "hymn_key" = 'PRAYER_OF_THE_VEIL';
UPDATE "agpeya.hymn_titles" SET "hymn_key" = 'agpeya.sixth_hour' WHERE "hymn_key" = 'SIXTH_HOUR';
UPDATE "agpeya.hymn_titles" SET "hymn_key" = 'agpeya.third_hour' WHERE "hymn_key" = 'THIRD_HOUR';
UPDATE "agpeya.hymn_titles" SET "hymn_key" = 'agpeya.twelfth_hour' WHERE "hymn_key" = 'TWELFTH_HOUR';
UPDATE "holy_week.hymn_titles" SET "hymn_key" = 'readings.coptic_prophecy' WHERE "hymn_key" = 'COPTIC_PROPHECY';
UPDATE "holy_week.hymn_titles" SET "hymn_key" = 'doxologies.doxologies' WHERE "hymn_key" = 'DOXOLOGIES';
UPDATE "holy_week.hymn_titles" SET "hymn_key" = 'gospel_rite.mournful_4_gospels_rite' WHERE "hymn_key" = 'MOURNFUL_4_GOSPELS_RITE';
UPDATE "holy_week.hymn_titles" SET "hymn_key" = 'gospel_rite.mournful_gospel_rite' WHERE "hymn_key" = 'MOURNFUL_GOSPEL_RITE';
UPDATE "holy_week.hymn_titles" SET "hymn_key" = 'verses_of_the_cymbals.verses_of_the_cymbals' WHERE "hymn_key" = 'VERSES_OF_THE_CYMBALS';
UPDATE "liturgy.hymn_titles" SET "hymn_key" = 'readings.catholic_epistle' WHERE "hymn_key" = 'CATHOLIC_EPISTLE';
UPDATE "liturgy.hymn_titles" SET "hymn_key" = 'liturgy.commemoration_of_the_saints_hymns' WHERE "hymn_key" = 'COMMEMORATION_OF_THE_SAINTS_HYMNS';
UPDATE "liturgy.hymn_titles" SET "hymn_key" = 'readings.coptic_prophecy' WHERE "hymn_key" = 'COPTIC_PROPHECY';
UPDATE "liturgy.hymn_titles" SET "hymn_key" = 'doxologies.doxologies' WHERE "hymn_key" = 'DOXOLOGIES';
UPDATE "liturgy.hymn_titles" SET "hymn_key" = 'agpeya.eleventh_hour' WHERE "hymn_key" = 'ELEVENTH_HOUR';
UPDATE "liturgy.hymn_titles" SET "hymn_key" = 'fractions.fractions' WHERE "hymn_key" = 'FRACTIONS';
UPDATE "liturgy.hymn_titles" SET "hymn_key" = 'gospel_responses.gospel_responses' WHERE "hymn_key" = 'GOSPEL_RESPONSES';
UPDATE "liturgy.hymn_titles" SET "hymn_key" = 'gospel_rite.gospel_rite' WHERE "hymn_key" = 'GOSPEL_RITE';
UPDATE "liturgy.hymn_titles" SET "hymn_key" = 'hymn_of_the_intercessions.hymn_of_the_intercessions' WHERE "hymn_key" = 'HYMN_OF_THE_INTERCESSIONS';
UPDATE "liturgy.hymn_titles" SET "hymn_key" = 'agpeya.ninth_hour' WHERE "hymn_key" = 'NINTH_HOUR';
UPDATE "liturgy.hymn_titles" SET "hymn_key" = 'gospel_rite.palm_sunday_liturgy_gospel_rite' WHERE "hymn_key" = 'PALM_SUNDAY_LITURGY_GOSPEL_RITE';
UPDATE "liturgy.hymn_titles" SET "hymn_key" = 'readings.pauline_epistle' WHERE "hymn_key" = 'PAULINE_EPISTLE';
UPDATE "liturgy.hymn_titles" SET "hymn_key" = 'readings.praxis' WHERE "hymn_key" = 'PRAXIS';
UPDATE "liturgy.hymn_titles" SET "hymn_key" = 'praxis_response.praxis_response' WHERE "hymn_key" = 'PRAXIS_RESPONSE';
UPDATE "liturgy.hymn_titles" SET "hymn_key" = 'agpeya.prayer_of_the_veil' WHERE "hymn_key" = 'PRAYER_OF_THE_VEIL';
UPDATE "liturgy.hymn_titles" SET "hymn_key" = 'procession_of_the_cross.procession_of_the_cross' WHERE "hymn_key" = 'PROCESSION_OF_THE_CROSS';
UPDATE "liturgy.hymn_titles" SET "hymn_key" = 'seasonal_liturgy_hymns.seasonal_distribution_hymns' WHERE "hymn_key" = 'SEASONAL_DISTRIBUTION_HYMNS';
UPDATE "liturgy.hymn_titles" SET "hymn_key" = 'seasonal_liturgy_hymns.seasonal_liturgy_of_the_word_hymns' WHERE "hymn_key" = 'SEASONAL_LITURGY_OF_THE_WORD_HYMNS';
UPDATE "liturgy.hymn_titles" SET "hymn_key" = 'agpeya.sixth_hour' WHERE "hymn_key" = 'SIXTH_HOUR';
UPDATE "liturgy.hymn_titles" SET "hymn_key" = 'litanies.the_five_short_litanies' WHERE "hymn_key" = 'THE_FIVE_SHORT_LITANIES';
UPDATE "liturgy.hymn_titles" SET "hymn_key" = 'litanies.the_three_great_litanies' WHERE "hymn_key" = 'THE_THREE_GREAT_LITANIES';
UPDATE "liturgy.hymn_titles" SET "hymn_key" = 'agpeya.third_hour' WHERE "hymn_key" = 'THIRD_HOUR';
UPDATE "liturgy.hymn_titles" SET "hymn_key" = 'agpeya.twelfth_hour' WHERE "hymn_key" = 'TWELFTH_HOUR';
UPDATE "liturgy.hymn_titles" SET "hymn_key" = 'veneration.veneration' WHERE "hymn_key" = 'VENERATION';
UPDATE "liturgy.hymn_titles" SET "hymn_key" = 'verses_of_the_cymbals.verses_of_the_cymbals' WHERE "hymn_key" = 'VERSES_OF_THE_CYMBALS';
UPDATE "psalmody.hymn_titles" SET "hymn_key" = 'psalmody.antiphonary' WHERE "hymn_key" = 'ANTIPHONARY';
UPDATE "psalmody.hymn_titles" SET "hymn_key" = 'doxologies.doxologies' WHERE "hymn_key" = 'DOXOLOGIES';
UPDATE "public.hymn_titles" SET "hymn_key" = 'liturgy.distribution' WHERE "hymn_key" = 'DISTRIBUTION';
UPDATE "public.hymn_titles" SET "hymn_key" = 'liturgy.liturgy_of_st_basil' WHERE "hymn_key" = 'LITURGY_OF_ST_BASIL';
UPDATE "public.hymn_titles" SET "hymn_key" = 'liturgy.liturgy_of_st_cyril' WHERE "hymn_key" = 'LITURGY_OF_ST_CYRIL';
UPDATE "public.hymn_titles" SET "hymn_key" = 'liturgy.liturgy_of_st_gregory' WHERE "hymn_key" = 'LITURGY_OF_ST_GREGORY';
UPDATE "public.hymn_titles" SET "hymn_key" = 'liturgy.liturgy_of_the_word' WHERE "hymn_key" = 'LITURGY_OF_THE_WORD';
UPDATE "public.hymn_titles" SET "hymn_key" = 'psalmody.midnight_praises' WHERE "hymn_key" = 'MIDNIGHT_PRAISES';
UPDATE "public.hymn_titles" SET "hymn_key" = 'psalmody.morning_doxology' WHERE "hymn_key" = 'MORNING_DOXOLOGY';
UPDATE "public.hymn_titles" SET "hymn_key" = 'liturgy.offering_of_the_lamb' WHERE "hymn_key" = 'OFFERING_OF_THE_LAMB';
UPDATE "veneration.hymn_titles" SET "hymn_key" = 'psalmody.antiphonary' WHERE "hymn_key" = 'ANTIPHONARY';

-- The Procession at Vespers is titled as at Matins.
INSERT INTO "liturgy.hymn_titles" ("hymn_key", "title_english", "title_arabic", "category", "toggled", "prayer_type", "title_french")
  SELECT 'procession_of_the_cross.vespers_procession', "title_english", "title_arabic", "category", "toggled", "prayer_type", "title_french"
  FROM "liturgy.hymn_titles" WHERE "hymn_key" = 'procession_of_the_cross.procession_of_the_cross'
  AND NOT EXISTS (SELECT 1 FROM "liturgy.hymn_titles" WHERE "hymn_key" = 'procession_of_the_cross.vespers_procession');
