-- The 7th Gospel Response sings St George's hymn, then Through His Cross or
-- Hosanna in the Highest. The hymn's line (70) came into it from
-- saintGeorgeCompletedSevenYears still numbered 2, as the line Through His
-- Cross is called on (114), so the two were read in whichever order the
-- table happened to keep them. The hymn is the response's first line.
UPDATE "procession_of_the_cross.hymn_texts" SET "line_order" = 1
WHERE "line_id" = 70 AND "hymn_key" = 'seventhGospelResponse' AND "line_order" = 2;
