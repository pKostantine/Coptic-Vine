-- An inline_hymn_key names the hymn whose lines the reader splices in where
-- the line stands (src/utils/hymnLibrary.js). A key that was no hymn's key
-- spliced in nothing, and said nothing: liturgy's throughTheIntercessions
-- called "tenousht" for tenouosht, and showed no Tenouosht. The reader now
-- finds a hymn in any hymn_texts table (findInlineHymn), and a line can be
-- saved only with a key that is a hymn_key in one of them, so a misspelt
-- key is refused where it is typed. ALL-CAPS keys, the readings and whole
-- tables the reader resolves itself, pass as before. Add a hymn before the
-- lines that call it.

UPDATE "liturgy.hymn_texts" SET "inline_hymn_key" = 'tenouosht'
WHERE "hymn_key" = 'throughTheIntercessions' AND "inline_hymn_key" = 'tenousht';

-- Each hymn once, with the schema it is in.
CREATE VIEW "public.hymn_keys" AS
SELECT DISTINCT 'agpeya' AS "schema_name", "hymn_key" FROM "agpeya.hymn_texts"
UNION SELECT DISTINCT 'aspasmos' AS "schema_name", "hymn_key" FROM "aspasmos.hymn_texts"
UNION SELECT DISTINCT 'canons' AS "schema_name", "hymn_key" FROM "canons.hymn_texts"
UNION SELECT DISTINCT 'doxologies' AS "schema_name", "hymn_key" FROM "doxologies.hymn_texts"
UNION SELECT DISTINCT 'fractions' AS "schema_name", "hymn_key" FROM "fractions.hymn_texts"
UNION SELECT DISTINCT 'gospel_responses' AS "schema_name", "hymn_key" FROM "gospel_responses.hymn_texts"
UNION SELECT DISTINCT 'gospel_rite' AS "schema_name", "hymn_key" FROM "gospel_rite.hymn_texts"
UNION SELECT DISTINCT 'holy_week' AS "schema_name", "hymn_key" FROM "holy_week.hymn_texts"
UNION SELECT DISTINCT 'hymn_of_the_intercessions' AS "schema_name", "hymn_key" FROM "hymn_of_the_intercessions.hymn_texts"
UNION SELECT DISTINCT 'litanies' AS "schema_name", "hymn_key" FROM "litanies.hymn_texts"
UNION SELECT DISTINCT 'liturgy' AS "schema_name", "hymn_key" FROM "liturgy.hymn_texts"
UNION SELECT DISTINCT 'praxis_response' AS "schema_name", "hymn_key" FROM "praxis_response.hymn_texts"
UNION SELECT DISTINCT 'procession_of_the_cross' AS "schema_name", "hymn_key" FROM "procession_of_the_cross.hymn_texts"
UNION SELECT DISTINCT 'psalmody' AS "schema_name", "hymn_key" FROM "psalmody.hymn_texts"
UNION SELECT DISTINCT 'public' AS "schema_name", "hymn_key" FROM "public.hymn_texts"
UNION SELECT DISTINCT 'readings' AS "schema_name", "hymn_key" FROM "readings.hymn_texts"
UNION SELECT DISTINCT 'seasonal_liturgy_hymns' AS "schema_name", "hymn_key" FROM "seasonal_liturgy_hymns.hymn_texts"
UNION SELECT DISTINCT 'veneration' AS "schema_name", "hymn_key" FROM "veneration.hymn_texts"
UNION SELECT DISTINCT 'verses_of_the_cymbals' AS "schema_name", "hymn_key" FROM "verses_of_the_cymbals.hymn_texts";

CREATE TRIGGER "agpeya.hymn_texts_inline_hymn_key_insert" BEFORE INSERT ON "agpeya.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*'
  AND NOT EXISTS (SELECT 1 FROM "public.hymn_keys" WHERE "hymn_key" = NEW."inline_hymn_key")
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table (public.hymn_keys lists them): check its spelling, or add that hymn first');
END;
CREATE TRIGGER "agpeya.hymn_texts_inline_hymn_key_update" BEFORE UPDATE OF "inline_hymn_key" ON "agpeya.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*'
  AND NOT EXISTS (SELECT 1 FROM "public.hymn_keys" WHERE "hymn_key" = NEW."inline_hymn_key")
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table (public.hymn_keys lists them): check its spelling, or add that hymn first');
END;
CREATE TRIGGER "aspasmos.hymn_texts_inline_hymn_key_insert" BEFORE INSERT ON "aspasmos.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*'
  AND NOT EXISTS (SELECT 1 FROM "public.hymn_keys" WHERE "hymn_key" = NEW."inline_hymn_key")
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table (public.hymn_keys lists them): check its spelling, or add that hymn first');
END;
CREATE TRIGGER "aspasmos.hymn_texts_inline_hymn_key_update" BEFORE UPDATE OF "inline_hymn_key" ON "aspasmos.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*'
  AND NOT EXISTS (SELECT 1 FROM "public.hymn_keys" WHERE "hymn_key" = NEW."inline_hymn_key")
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table (public.hymn_keys lists them): check its spelling, or add that hymn first');
END;
CREATE TRIGGER "canons.hymn_texts_inline_hymn_key_insert" BEFORE INSERT ON "canons.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*'
  AND NOT EXISTS (SELECT 1 FROM "public.hymn_keys" WHERE "hymn_key" = NEW."inline_hymn_key")
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table (public.hymn_keys lists them): check its spelling, or add that hymn first');
END;
CREATE TRIGGER "canons.hymn_texts_inline_hymn_key_update" BEFORE UPDATE OF "inline_hymn_key" ON "canons.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*'
  AND NOT EXISTS (SELECT 1 FROM "public.hymn_keys" WHERE "hymn_key" = NEW."inline_hymn_key")
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table (public.hymn_keys lists them): check its spelling, or add that hymn first');
END;
CREATE TRIGGER "doxologies.hymn_texts_inline_hymn_key_insert" BEFORE INSERT ON "doxologies.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*'
  AND NOT EXISTS (SELECT 1 FROM "public.hymn_keys" WHERE "hymn_key" = NEW."inline_hymn_key")
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table (public.hymn_keys lists them): check its spelling, or add that hymn first');
END;
CREATE TRIGGER "doxologies.hymn_texts_inline_hymn_key_update" BEFORE UPDATE OF "inline_hymn_key" ON "doxologies.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*'
  AND NOT EXISTS (SELECT 1 FROM "public.hymn_keys" WHERE "hymn_key" = NEW."inline_hymn_key")
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table (public.hymn_keys lists them): check its spelling, or add that hymn first');
END;
CREATE TRIGGER "fractions.hymn_texts_inline_hymn_key_insert" BEFORE INSERT ON "fractions.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*'
  AND NOT EXISTS (SELECT 1 FROM "public.hymn_keys" WHERE "hymn_key" = NEW."inline_hymn_key")
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table (public.hymn_keys lists them): check its spelling, or add that hymn first');
END;
CREATE TRIGGER "fractions.hymn_texts_inline_hymn_key_update" BEFORE UPDATE OF "inline_hymn_key" ON "fractions.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*'
  AND NOT EXISTS (SELECT 1 FROM "public.hymn_keys" WHERE "hymn_key" = NEW."inline_hymn_key")
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table (public.hymn_keys lists them): check its spelling, or add that hymn first');
END;
CREATE TRIGGER "gospel_responses.hymn_texts_inline_hymn_key_insert" BEFORE INSERT ON "gospel_responses.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*'
  AND NOT EXISTS (SELECT 1 FROM "public.hymn_keys" WHERE "hymn_key" = NEW."inline_hymn_key")
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table (public.hymn_keys lists them): check its spelling, or add that hymn first');
END;
CREATE TRIGGER "gospel_responses.hymn_texts_inline_hymn_key_update" BEFORE UPDATE OF "inline_hymn_key" ON "gospel_responses.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*'
  AND NOT EXISTS (SELECT 1 FROM "public.hymn_keys" WHERE "hymn_key" = NEW."inline_hymn_key")
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table (public.hymn_keys lists them): check its spelling, or add that hymn first');
END;
CREATE TRIGGER "gospel_rite.hymn_texts_inline_hymn_key_insert" BEFORE INSERT ON "gospel_rite.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*'
  AND NOT EXISTS (SELECT 1 FROM "public.hymn_keys" WHERE "hymn_key" = NEW."inline_hymn_key")
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table (public.hymn_keys lists them): check its spelling, or add that hymn first');
END;
CREATE TRIGGER "gospel_rite.hymn_texts_inline_hymn_key_update" BEFORE UPDATE OF "inline_hymn_key" ON "gospel_rite.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*'
  AND NOT EXISTS (SELECT 1 FROM "public.hymn_keys" WHERE "hymn_key" = NEW."inline_hymn_key")
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table (public.hymn_keys lists them): check its spelling, or add that hymn first');
END;
CREATE TRIGGER "holy_week.hymn_texts_inline_hymn_key_insert" BEFORE INSERT ON "holy_week.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*'
  AND NOT EXISTS (SELECT 1 FROM "public.hymn_keys" WHERE "hymn_key" = NEW."inline_hymn_key")
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table (public.hymn_keys lists them): check its spelling, or add that hymn first');
END;
CREATE TRIGGER "holy_week.hymn_texts_inline_hymn_key_update" BEFORE UPDATE OF "inline_hymn_key" ON "holy_week.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*'
  AND NOT EXISTS (SELECT 1 FROM "public.hymn_keys" WHERE "hymn_key" = NEW."inline_hymn_key")
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table (public.hymn_keys lists them): check its spelling, or add that hymn first');
END;
CREATE TRIGGER "hymn_of_the_intercessions.hymn_texts_inline_hymn_key_insert" BEFORE INSERT ON "hymn_of_the_intercessions.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*'
  AND NOT EXISTS (SELECT 1 FROM "public.hymn_keys" WHERE "hymn_key" = NEW."inline_hymn_key")
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table (public.hymn_keys lists them): check its spelling, or add that hymn first');
END;
CREATE TRIGGER "hymn_of_the_intercessions.hymn_texts_inline_hymn_key_update" BEFORE UPDATE OF "inline_hymn_key" ON "hymn_of_the_intercessions.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*'
  AND NOT EXISTS (SELECT 1 FROM "public.hymn_keys" WHERE "hymn_key" = NEW."inline_hymn_key")
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table (public.hymn_keys lists them): check its spelling, or add that hymn first');
END;
CREATE TRIGGER "litanies.hymn_texts_inline_hymn_key_insert" BEFORE INSERT ON "litanies.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*'
  AND NOT EXISTS (SELECT 1 FROM "public.hymn_keys" WHERE "hymn_key" = NEW."inline_hymn_key")
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table (public.hymn_keys lists them): check its spelling, or add that hymn first');
END;
CREATE TRIGGER "litanies.hymn_texts_inline_hymn_key_update" BEFORE UPDATE OF "inline_hymn_key" ON "litanies.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*'
  AND NOT EXISTS (SELECT 1 FROM "public.hymn_keys" WHERE "hymn_key" = NEW."inline_hymn_key")
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table (public.hymn_keys lists them): check its spelling, or add that hymn first');
END;
CREATE TRIGGER "liturgy.hymn_texts_inline_hymn_key_insert" BEFORE INSERT ON "liturgy.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*'
  AND NOT EXISTS (SELECT 1 FROM "public.hymn_keys" WHERE "hymn_key" = NEW."inline_hymn_key")
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table (public.hymn_keys lists them): check its spelling, or add that hymn first');
END;
CREATE TRIGGER "liturgy.hymn_texts_inline_hymn_key_update" BEFORE UPDATE OF "inline_hymn_key" ON "liturgy.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*'
  AND NOT EXISTS (SELECT 1 FROM "public.hymn_keys" WHERE "hymn_key" = NEW."inline_hymn_key")
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table (public.hymn_keys lists them): check its spelling, or add that hymn first');
END;
CREATE TRIGGER "praxis_response.hymn_texts_inline_hymn_key_insert" BEFORE INSERT ON "praxis_response.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*'
  AND NOT EXISTS (SELECT 1 FROM "public.hymn_keys" WHERE "hymn_key" = NEW."inline_hymn_key")
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table (public.hymn_keys lists them): check its spelling, or add that hymn first');
END;
CREATE TRIGGER "praxis_response.hymn_texts_inline_hymn_key_update" BEFORE UPDATE OF "inline_hymn_key" ON "praxis_response.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*'
  AND NOT EXISTS (SELECT 1 FROM "public.hymn_keys" WHERE "hymn_key" = NEW."inline_hymn_key")
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table (public.hymn_keys lists them): check its spelling, or add that hymn first');
END;
CREATE TRIGGER "procession_of_the_cross.hymn_texts_inline_hymn_key_insert" BEFORE INSERT ON "procession_of_the_cross.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*'
  AND NOT EXISTS (SELECT 1 FROM "public.hymn_keys" WHERE "hymn_key" = NEW."inline_hymn_key")
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table (public.hymn_keys lists them): check its spelling, or add that hymn first');
END;
CREATE TRIGGER "procession_of_the_cross.hymn_texts_inline_hymn_key_update" BEFORE UPDATE OF "inline_hymn_key" ON "procession_of_the_cross.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*'
  AND NOT EXISTS (SELECT 1 FROM "public.hymn_keys" WHERE "hymn_key" = NEW."inline_hymn_key")
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table (public.hymn_keys lists them): check its spelling, or add that hymn first');
END;
CREATE TRIGGER "psalmody.hymn_texts_inline_hymn_key_insert" BEFORE INSERT ON "psalmody.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*'
  AND NOT EXISTS (SELECT 1 FROM "public.hymn_keys" WHERE "hymn_key" = NEW."inline_hymn_key")
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table (public.hymn_keys lists them): check its spelling, or add that hymn first');
END;
CREATE TRIGGER "psalmody.hymn_texts_inline_hymn_key_update" BEFORE UPDATE OF "inline_hymn_key" ON "psalmody.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*'
  AND NOT EXISTS (SELECT 1 FROM "public.hymn_keys" WHERE "hymn_key" = NEW."inline_hymn_key")
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table (public.hymn_keys lists them): check its spelling, or add that hymn first');
END;
CREATE TRIGGER "public.hymn_texts_inline_hymn_key_insert" BEFORE INSERT ON "public.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*'
  AND NOT EXISTS (SELECT 1 FROM "public.hymn_keys" WHERE "hymn_key" = NEW."inline_hymn_key")
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table (public.hymn_keys lists them): check its spelling, or add that hymn first');
END;
CREATE TRIGGER "public.hymn_texts_inline_hymn_key_update" BEFORE UPDATE OF "inline_hymn_key" ON "public.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*'
  AND NOT EXISTS (SELECT 1 FROM "public.hymn_keys" WHERE "hymn_key" = NEW."inline_hymn_key")
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table (public.hymn_keys lists them): check its spelling, or add that hymn first');
END;
CREATE TRIGGER "readings.hymn_texts_inline_hymn_key_insert" BEFORE INSERT ON "readings.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*'
  AND NOT EXISTS (SELECT 1 FROM "public.hymn_keys" WHERE "hymn_key" = NEW."inline_hymn_key")
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table (public.hymn_keys lists them): check its spelling, or add that hymn first');
END;
CREATE TRIGGER "readings.hymn_texts_inline_hymn_key_update" BEFORE UPDATE OF "inline_hymn_key" ON "readings.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*'
  AND NOT EXISTS (SELECT 1 FROM "public.hymn_keys" WHERE "hymn_key" = NEW."inline_hymn_key")
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table (public.hymn_keys lists them): check its spelling, or add that hymn first');
END;
CREATE TRIGGER "seasonal_liturgy_hymns.hymn_texts_inline_hymn_key_insert" BEFORE INSERT ON "seasonal_liturgy_hymns.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*'
  AND NOT EXISTS (SELECT 1 FROM "public.hymn_keys" WHERE "hymn_key" = NEW."inline_hymn_key")
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table (public.hymn_keys lists them): check its spelling, or add that hymn first');
END;
CREATE TRIGGER "seasonal_liturgy_hymns.hymn_texts_inline_hymn_key_update" BEFORE UPDATE OF "inline_hymn_key" ON "seasonal_liturgy_hymns.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*'
  AND NOT EXISTS (SELECT 1 FROM "public.hymn_keys" WHERE "hymn_key" = NEW."inline_hymn_key")
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table (public.hymn_keys lists them): check its spelling, or add that hymn first');
END;
CREATE TRIGGER "veneration.hymn_texts_inline_hymn_key_insert" BEFORE INSERT ON "veneration.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*'
  AND NOT EXISTS (SELECT 1 FROM "public.hymn_keys" WHERE "hymn_key" = NEW."inline_hymn_key")
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table (public.hymn_keys lists them): check its spelling, or add that hymn first');
END;
CREATE TRIGGER "veneration.hymn_texts_inline_hymn_key_update" BEFORE UPDATE OF "inline_hymn_key" ON "veneration.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*'
  AND NOT EXISTS (SELECT 1 FROM "public.hymn_keys" WHERE "hymn_key" = NEW."inline_hymn_key")
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table (public.hymn_keys lists them): check its spelling, or add that hymn first');
END;
CREATE TRIGGER "verses_of_the_cymbals.hymn_texts_inline_hymn_key_insert" BEFORE INSERT ON "verses_of_the_cymbals.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*'
  AND NOT EXISTS (SELECT 1 FROM "public.hymn_keys" WHERE "hymn_key" = NEW."inline_hymn_key")
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table (public.hymn_keys lists them): check its spelling, or add that hymn first');
END;
CREATE TRIGGER "verses_of_the_cymbals.hymn_texts_inline_hymn_key_update" BEFORE UPDATE OF "inline_hymn_key" ON "verses_of_the_cymbals.hymn_texts"
WHEN NEW."inline_hymn_key" GLOB '*[a-z]*'
  AND NOT EXISTS (SELECT 1 FROM "public.hymn_keys" WHERE "hymn_key" = NEW."inline_hymn_key")
BEGIN
  SELECT RAISE(ABORT, 'inline_hymn_key is no hymn_key in any hymn_texts table (public.hymn_keys lists them): check its spelling, or add that hymn first');
END;
