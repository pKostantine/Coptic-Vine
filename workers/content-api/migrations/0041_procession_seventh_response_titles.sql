-- The 7th Gospel Response sings one of two hymns, For St. George or For Any
-- Other Martyr. 0040 named each by a line of rubric, but rubric is hidden
-- unless Display Comments is on, so the choice didn't show: each hymn is
-- called with its own title shown instead, under the response's.
--
-- Nothing moves unless those four lines are as 0040 left them: otherwise a
-- row below breaks the order table's constraints (it has no hymn_key) and D1
-- rolls the whole file back.

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the 7th Gospel Response is no longer as 0040 left it' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.hymn_texts"
  WHERE "line_id" = 110 AND "hymn_key" = 'seventhGospelResponse' AND "person_type" = 'Comment' AND "english" = 'For St. George');

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the 7th Gospel Response is no longer as 0040 left it' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.hymn_texts"
  WHERE "line_id" = 112 AND "hymn_key" = 'seventhGospelResponse' AND "person_type" = 'Comment' AND "english" = 'For Any Other Martyr');

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the 7th Gospel Response is no longer as 0040 left it' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.hymn_texts"
  WHERE "line_id" = 111 AND "hymn_key" = 'seventhGospelResponse' AND "inline_hymn_key" = 'saintGeorgeCompletedSevenYears' AND "inline_hymn_title_shown" = 0);

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the 7th Gospel Response is no longer as 0040 left it' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.hymn_texts"
  WHERE "line_id" = 113 AND "hymn_key" = 'seventhGospelResponse' AND "inline_hymn_key" = 'hailToYouOMartyr' AND "inline_hymn_title_shown" = 0);

DELETE FROM "procession_of_the_cross.hymn_texts" WHERE "line_id" IN (110, 112) AND "hymn_key" = 'seventhGospelResponse';

UPDATE "procession_of_the_cross.hymn_texts" SET "inline_hymn_title_shown" = 1
WHERE "line_id" IN (111, 113) AND "hymn_key" = 'seventhGospelResponse';
