-- St Basil's hymns after the commemoration of the departed (Evshes, the
-- Departed Patriarchs, the minor Pinishti, Ke Pandon Ton and the major
-- Pinishti) move into a table of their own, which St Basil opens as a
-- subdocument where they stood: COMMEMORATION_OF_THE_SAINTS_HYMNS
-- (SUBDOCUMENT_MAP, src/utils/hymnLibrary.js). Each keeps its condition and
-- minimization, in the same order. The table is listed for the Worker and the
-- offline books through D1_TABLES in scripts/gen-schema.ts; its revision
-- triggers are here, as 0003 has them for the catalog's tables.

CREATE TABLE "liturgy.commemoration_of_the_saints_hymns" (
  "item_order" REAL NOT NULL,
  "hymn_key" TEXT,
  "condition" TEXT,
  "minimization" TEXT CHECK ("minimization" IN ('Minimizable', 'Minimized')),
  "item_type" TEXT CHECK ("item_type" IN ('Subdocument', 'Hyperlink', 'Inline')),
  PRIMARY KEY ("item_order")
) STRICT;

CREATE TRIGGER "liturgy.commemoration_of_the_saints_hymns_after_insert" AFTER INSERT ON "liturgy.commemoration_of_the_saints_hymns"
BEGIN
  UPDATE "offline_content.revision" SET "revision" = "revision" + 1, "changed_at" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE "id" = 1;
  INSERT INTO "offline_content.content_changes" ("schema_name", "table_name", "changed_at") VALUES ('liturgy', 'commemoration_of_the_saints_hymns', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT ("schema_name", "table_name") DO UPDATE SET "changed_at" = excluded."changed_at";
END;
CREATE TRIGGER "liturgy.commemoration_of_the_saints_hymns_after_update" AFTER UPDATE ON "liturgy.commemoration_of_the_saints_hymns"
BEGIN
  UPDATE "offline_content.revision" SET "revision" = "revision" + 1, "changed_at" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE "id" = 1;
  INSERT INTO "offline_content.content_changes" ("schema_name", "table_name", "changed_at") VALUES ('liturgy', 'commemoration_of_the_saints_hymns', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT ("schema_name", "table_name") DO UPDATE SET "changed_at" = excluded."changed_at";
END;
CREATE TRIGGER "liturgy.commemoration_of_the_saints_hymns_after_delete" AFTER DELETE ON "liturgy.commemoration_of_the_saints_hymns"
BEGIN
  UPDATE "offline_content.revision" SET "revision" = "revision" + 1, "changed_at" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE "id" = 1;
  INSERT INTO "offline_content.content_changes" ("schema_name", "table_name", "changed_at") VALUES ('liturgy', 'commemoration_of_the_saints_hymns', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT ("schema_name", "table_name") DO UPDATE SET "changed_at" = excluded."changed_at";
END;

-- Nothing moves unless St Basil still has exactly these five rows: otherwise
-- this row breaks the minimization CHECK, and D1 rolls the whole file back.
INSERT INTO "liturgy.commemoration_of_the_saints_hymns" ("item_order", "minimization")
SELECT 0, 'St Basil no longer has the five rows this moves'
WHERE (SELECT count(*) FROM "liturgy.liturgy_of_st_basil" WHERE
  ("item_order" = 79 AND "hymn_key" = 'evshes') OR
  ("item_order" = 80 AND "hymn_key" = 'departedPatriarchs') OR
  ("item_order" = 81 AND "hymn_key" = 'pinishtiMinor') OR
  ("item_order" = 81.1 AND "hymn_key" = 'kePandonTon') OR
  ("item_order" = 82 AND "hymn_key" = 'pinishtiMajor')
) <> 5;

INSERT INTO "liturgy.commemoration_of_the_saints_hymns" ("item_order", "hymn_key", "condition", "minimization", "item_type")
SELECT
  CASE "hymn_key" WHEN 'evshes' THEN 1 WHEN 'departedPatriarchs' THEN 2 WHEN 'pinishtiMinor' THEN 3 WHEN 'kePandonTon' THEN 4 WHEN 'pinishtiMajor' THEN 5 END,
  "hymn_key", "condition", "minimization", "item_type"
FROM "liturgy.liturgy_of_st_basil"
WHERE
  ("item_order" = 79 AND "hymn_key" = 'evshes') OR
  ("item_order" = 80 AND "hymn_key" = 'departedPatriarchs') OR
  ("item_order" = 81 AND "hymn_key" = 'pinishtiMinor') OR
  ("item_order" = 81.1 AND "hymn_key" = 'kePandonTon') OR
  ("item_order" = 82 AND "hymn_key" = 'pinishtiMajor');

-- The button's name. No Arabic title yet.
INSERT INTO "liturgy.hymn_titles" ("hymn_key", "title_english", "category", "toggled")
VALUES ('COMMEMORATION_OF_THE_SAINTS_HYMNS', 'Commemoration of the Saints Hymns', 'liturgy_of_st_basil', 1);

UPDATE "liturgy.liturgy_of_st_basil"
SET "hymn_key" = 'COMMEMORATION_OF_THE_SAINTS_HYMNS', "item_type" = 'Subdocument', "condition" = NULL, "minimization" = NULL
WHERE "item_order" = 79 AND "hymn_key" = 'evshes';

DELETE FROM "liturgy.liturgy_of_st_basil"
WHERE
  ("item_order" = 80 AND "hymn_key" = 'departedPatriarchs') OR
  ("item_order" = 81 AND "hymn_key" = 'pinishtiMinor') OR
  ("item_order" = 81.1 AND "hymn_key" = 'kePandonTon') OR
  ("item_order" = 82 AND "hymn_key" = 'pinishtiMajor');
