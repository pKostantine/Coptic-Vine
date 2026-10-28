-- An inline_hymn_key names the hymn whose lines the reader splices in where
-- the line stands (src/utils/hymnLibrary.js). A key that was no hymn's key
-- spliced in nothing, and said nothing: liturgy's throughTheIntercessions
-- called "tenousht" for tenouosht, and showed no Tenouosht. The reader now
-- finds a hymn in any hymn_texts table (findInlineHymn), and a line can be
-- saved only with a key that is a hymn_key in one of them, so a misspelt
-- key is refused where it is typed. ALL-CAPS keys, the readings and whole
-- tables the reader resolves itself, pass as before. Add a hymn before the
-- lines that call it. (Each table is asked in turn, not through one UNION:
-- D1 caps the terms of a compound SELECT well below 19.)

UPDATE "liturgy.hymn_texts" SET "inline_hymn_key" = 'tenouosht'
WHERE "hymn_key" = 'throughTheIntercessions' AND "inline_hymn_key" = 'tenousht';

CREATE TRIGGER "agpeya.hymn_texts_inline_hymn_key_insert" BEFORE INSERT ON "agpeya.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NOT (
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
CREATE TRIGGER "agpeya.hymn_texts_inline_hymn_key_update" BEFORE UPDATE OF "inline_hymn_key" ON "agpeya.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NOT (
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
CREATE TRIGGER "aspasmos.hymn_texts_inline_hymn_key_insert" BEFORE INSERT ON "aspasmos.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NOT (
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
CREATE TRIGGER "aspasmos.hymn_texts_inline_hymn_key_update" BEFORE UPDATE OF "inline_hymn_key" ON "aspasmos.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NOT (
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
CREATE TRIGGER "canons.hymn_texts_inline_hymn_key_insert" BEFORE INSERT ON "canons.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NOT (
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
CREATE TRIGGER "canons.hymn_texts_inline_hymn_key_update" BEFORE UPDATE OF "inline_hymn_key" ON "canons.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NOT (
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
CREATE TRIGGER "doxologies.hymn_texts_inline_hymn_key_insert" BEFORE INSERT ON "doxologies.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NOT (
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
CREATE TRIGGER "doxologies.hymn_texts_inline_hymn_key_update" BEFORE UPDATE OF "inline_hymn_key" ON "doxologies.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NOT (
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
CREATE TRIGGER "fractions.hymn_texts_inline_hymn_key_insert" BEFORE INSERT ON "fractions.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NOT (
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
CREATE TRIGGER "fractions.hymn_texts_inline_hymn_key_update" BEFORE UPDATE OF "inline_hymn_key" ON "fractions.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NOT (
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
CREATE TRIGGER "gospel_responses.hymn_texts_inline_hymn_key_insert" BEFORE INSERT ON "gospel_responses.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NOT (
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
CREATE TRIGGER "gospel_responses.hymn_texts_inline_hymn_key_update" BEFORE UPDATE OF "inline_hymn_key" ON "gospel_responses.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NOT (
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
CREATE TRIGGER "gospel_rite.hymn_texts_inline_hymn_key_insert" BEFORE INSERT ON "gospel_rite.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NOT (
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
CREATE TRIGGER "gospel_rite.hymn_texts_inline_hymn_key_update" BEFORE UPDATE OF "inline_hymn_key" ON "gospel_rite.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NOT (
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
CREATE TRIGGER "holy_week.hymn_texts_inline_hymn_key_insert" BEFORE INSERT ON "holy_week.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NOT (
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
CREATE TRIGGER "holy_week.hymn_texts_inline_hymn_key_update" BEFORE UPDATE OF "inline_hymn_key" ON "holy_week.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NOT (
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
CREATE TRIGGER "hymn_of_the_intercessions.hymn_texts_inline_hymn_key_insert" BEFORE INSERT ON "hymn_of_the_intercessions.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NOT (
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
CREATE TRIGGER "hymn_of_the_intercessions.hymn_texts_inline_hymn_key_update" BEFORE UPDATE OF "inline_hymn_key" ON "hymn_of_the_intercessions.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NOT (
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
CREATE TRIGGER "litanies.hymn_texts_inline_hymn_key_insert" BEFORE INSERT ON "litanies.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NOT (
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
CREATE TRIGGER "litanies.hymn_texts_inline_hymn_key_update" BEFORE UPDATE OF "inline_hymn_key" ON "litanies.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NOT (
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
CREATE TRIGGER "liturgy.hymn_texts_inline_hymn_key_insert" BEFORE INSERT ON "liturgy.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NOT (
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
CREATE TRIGGER "liturgy.hymn_texts_inline_hymn_key_update" BEFORE UPDATE OF "inline_hymn_key" ON "liturgy.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NOT (
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
CREATE TRIGGER "praxis_response.hymn_texts_inline_hymn_key_insert" BEFORE INSERT ON "praxis_response.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NOT (
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
CREATE TRIGGER "praxis_response.hymn_texts_inline_hymn_key_update" BEFORE UPDATE OF "inline_hymn_key" ON "praxis_response.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NOT (
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
CREATE TRIGGER "procession_of_the_cross.hymn_texts_inline_hymn_key_insert" BEFORE INSERT ON "procession_of_the_cross.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NOT (
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
CREATE TRIGGER "procession_of_the_cross.hymn_texts_inline_hymn_key_update" BEFORE UPDATE OF "inline_hymn_key" ON "procession_of_the_cross.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NOT (
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
CREATE TRIGGER "psalmody.hymn_texts_inline_hymn_key_insert" BEFORE INSERT ON "psalmody.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NOT (
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
CREATE TRIGGER "psalmody.hymn_texts_inline_hymn_key_update" BEFORE UPDATE OF "inline_hymn_key" ON "psalmody.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NOT (
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
CREATE TRIGGER "public.hymn_texts_inline_hymn_key_insert" BEFORE INSERT ON "public.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NOT (
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
CREATE TRIGGER "public.hymn_texts_inline_hymn_key_update" BEFORE UPDATE OF "inline_hymn_key" ON "public.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NOT (
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
CREATE TRIGGER "readings.hymn_texts_inline_hymn_key_insert" BEFORE INSERT ON "readings.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NOT (
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
CREATE TRIGGER "readings.hymn_texts_inline_hymn_key_update" BEFORE UPDATE OF "inline_hymn_key" ON "readings.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NOT (
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
CREATE TRIGGER "seasonal_liturgy_hymns.hymn_texts_inline_hymn_key_insert" BEFORE INSERT ON "seasonal_liturgy_hymns.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NOT (
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
CREATE TRIGGER "seasonal_liturgy_hymns.hymn_texts_inline_hymn_key_update" BEFORE UPDATE OF "inline_hymn_key" ON "seasonal_liturgy_hymns.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NOT (
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
CREATE TRIGGER "veneration.hymn_texts_inline_hymn_key_insert" BEFORE INSERT ON "veneration.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NOT (
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
CREATE TRIGGER "veneration.hymn_texts_inline_hymn_key_update" BEFORE UPDATE OF "inline_hymn_key" ON "veneration.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NOT (
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
CREATE TRIGGER "verses_of_the_cymbals.hymn_texts_inline_hymn_key_insert" BEFORE INSERT ON "verses_of_the_cymbals.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NOT (
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
CREATE TRIGGER "verses_of_the_cymbals.hymn_texts_inline_hymn_key_update" BEFORE UPDATE OF "inline_hymn_key" ON "verses_of_the_cymbals.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*' AND NOT (
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
