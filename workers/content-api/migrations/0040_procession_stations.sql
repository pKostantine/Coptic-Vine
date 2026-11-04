-- The Procession of the Cross, station by station, as two sections each:
--
--   1st Gospel (Before the Main Sanctuary)   the station's Psalm and Gospel
--   1st Gospel Response                      its hymn, and Through His Cross
--                                            or Hosanna in the Highest
--
-- (asked for on 4 Nov 2026, in place of a station heading, a separate
-- "Psalm and Gospel", the station's hymn and the two refrains each a title
-- of its own).
--
--   - Each station's own row (FIRST_GOSPEL ...) reads its readings: it turns
--     Inline, and reading_rules files them under it (inline_hymn_key =
--     station_key). The FIRST_GOSPEL_READINGS ... rows and their "Psalm and
--     Gospel" titles go.
--   - The station titles read "1st Gospel (...)" ... "12th Gospel (...)".
--   - Each station's hymn and refrains become one hymn, firstGospelResponse
--     ... twelfthGospelResponse, "1st Gospel Response" ..., which calls them
--     Inline with their titles hidden: the hymn, then Through His Cross on
--     the Feast of the Cross and Hosanna in the Highest on Palm Sunday. The
--     hymns themselves are left as they are (two are sung elsewhere too).
--     The 7th station's two hymns are sung one or the other, so each is
--     named by a line of rubric, in its own title's words.
--
-- Nothing moves unless the Procession's station rows are exactly as they were
-- read on 4 Nov 2026: otherwise one of the rows below breaks the table's
-- constraints (it has no hymn_key, and no minimization of the allowed two)
-- and D1 rolls the whole file back. So a second run fails too. One check a
-- row, each small: D1 refuses an expression tree deeper than 100.

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 9 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 9 AND "hymn_key" = 'FIRST_GOSPEL' AND "item_type" IS NULL AND "condition" IS NULL);

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 10 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 10 AND "hymn_key" = 'FIRST_GOSPEL_READINGS' AND "item_type" IS 'Inline' AND "condition" IS NULL);

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 11 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 11 AND "hymn_key" = 'theFourIncorporealCreatures' AND "item_type" IS NULL AND "condition" IS NULL);

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 12 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 12 AND "hymn_key" = 'throughHisCross' AND "item_type" IS NULL AND "condition" IS 'FeastOfTheCross');

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 13 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 13 AND "hymn_key" = 'hosannaInTheHighest' AND "item_type" IS NULL AND "condition" IS 'PalmSunday');

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 14 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 14 AND "hymn_key" = 'SECOND_GOSPEL' AND "item_type" IS NULL AND "condition" IS NULL);

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 15 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 15 AND "hymn_key" = 'SECOND_GOSPEL_READINGS' AND "item_type" IS 'Inline' AND "condition" IS NULL);

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 16 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 16 AND "hymn_key" = 'weExaltYouWorthily' AND "item_type" IS NULL AND "condition" IS NULL);

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 17 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 17 AND "hymn_key" = 'throughHisCross' AND "item_type" IS NULL AND "condition" IS 'FeastOfTheCross');

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 18 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 18 AND "hymn_key" = 'hosannaInTheHighest' AND "item_type" IS NULL AND "condition" IS 'PalmSunday');

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 19 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 19 AND "hymn_key" = 'THIRD_GOSPEL' AND "item_type" IS NULL AND "condition" IS NULL);

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 20 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 20 AND "hymn_key" = 'THIRD_GOSPEL_READINGS' AND "item_type" IS 'Inline' AND "condition" IS NULL);

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 21 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 21 AND "hymn_key" = 'gabrielTheAngel' AND "item_type" IS NULL AND "condition" IS NULL);

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 22 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 22 AND "hymn_key" = 'throughHisCross' AND "item_type" IS NULL AND "condition" IS 'FeastOfTheCross');

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 23 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 23 AND "hymn_key" = 'hosannaInTheHighest' AND "item_type" IS NULL AND "condition" IS 'PalmSunday');

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 24 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 24 AND "hymn_key" = 'FOURTH_GOSPEL' AND "item_type" IS NULL AND "condition" IS NULL);

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 25 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 25 AND "hymn_key" = 'FOURTH_GOSPEL_READINGS' AND "item_type" IS 'Inline' AND "condition" IS NULL);

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 26 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 26 AND "hymn_key" = 'michaelTheHeadOfTheHeavenly' AND "item_type" IS NULL AND "condition" IS NULL);

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 27 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 27 AND "hymn_key" = 'throughHisCross' AND "item_type" IS NULL AND "condition" IS 'FeastOfTheCross');

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 28 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 28 AND "hymn_key" = 'hosannaInTheHighest' AND "item_type" IS NULL AND "condition" IS 'PalmSunday');

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 29 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 29 AND "hymn_key" = 'FIFTH_GOSPEL' AND "item_type" IS NULL AND "condition" IS NULL);

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 30 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 30 AND "hymn_key" = 'FIFTH_GOSPEL_READINGS' AND "item_type" IS 'Inline' AND "condition" IS NULL);

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 31 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 31 AND "hymn_key" = 'oMarkTheApostleAndEvangelist' AND "item_type" IS NULL AND "condition" IS NULL);

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 32 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 32 AND "hymn_key" = 'throughHisCross' AND "item_type" IS NULL AND "condition" IS 'FeastOfTheCross');

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 33 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 33 AND "hymn_key" = 'hosannaInTheHighest' AND "item_type" IS NULL AND "condition" IS 'PalmSunday');

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 34 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 34 AND "hymn_key" = 'SIXTH_GOSPEL' AND "item_type" IS NULL AND "condition" IS NULL);

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 35 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 35 AND "hymn_key" = 'SIXTH_GOSPEL_READINGS' AND "item_type" IS 'Inline' AND "condition" IS NULL);

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 36 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 36 AND "hymn_key" = 'jesusChristSentYouOTwelveApostles' AND "item_type" IS NULL AND "condition" IS NULL);

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 37 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 37 AND "hymn_key" = 'throughHisCross' AND "item_type" IS NULL AND "condition" IS 'FeastOfTheCross');

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 38 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 38 AND "hymn_key" = 'hosannaInTheHighest' AND "item_type" IS NULL AND "condition" IS 'PalmSunday');

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 39 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 39 AND "hymn_key" = 'SEVENTH_GOSPEL' AND "item_type" IS NULL AND "condition" IS NULL);

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 40 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 40 AND "hymn_key" = 'SEVENTH_GOSPEL_READINGS' AND "item_type" IS 'Inline' AND "condition" IS NULL);

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 41 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 41 AND "hymn_key" = 'saintGeorgeCompletedSevenYears' AND "item_type" IS NULL AND "condition" IS NULL);

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 42 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 42 AND "hymn_key" = 'hailToYouOMartyr' AND "item_type" IS NULL AND "condition" IS NULL);

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 43 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 43 AND "hymn_key" = 'throughHisCross' AND "item_type" IS NULL AND "condition" IS 'FeastOfTheCross');

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 44 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 44 AND "hymn_key" = 'hosannaInTheHighest' AND "item_type" IS NULL AND "condition" IS 'PalmSunday');

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 45 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 45 AND "hymn_key" = 'EIGHTH_GOSPEL' AND "item_type" IS NULL AND "condition" IS NULL);

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 46 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 46 AND "hymn_key" = 'EIGHTH_GOSPEL_READINGS' AND "item_type" IS 'Inline' AND "condition" IS NULL);

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 47 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 47 AND "hymn_key" = 'purgeFromYourHearts' AND "item_type" IS NULL AND "condition" IS NULL);

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 48 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 48 AND "hymn_key" = 'throughHisCross' AND "item_type" IS NULL AND "condition" IS 'FeastOfTheCross');

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 49 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 49 AND "hymn_key" = 'hosannaInTheHighest' AND "item_type" IS NULL AND "condition" IS 'PalmSunday');

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 50 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 50 AND "hymn_key" = 'NINTH_GOSPEL' AND "item_type" IS NULL AND "condition" IS NULL);

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 51 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 51 AND "hymn_key" = 'NINTH_GOSPEL_READINGS' AND "item_type" IS 'Inline' AND "condition" IS NULL);

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 52 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 52 AND "hymn_key" = 'whenYouComeInYourSecondAppearance' AND "item_type" IS NULL AND "condition" IS NULL);

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 53 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 53 AND "hymn_key" = 'throughHisCross' AND "item_type" IS NULL AND "condition" IS 'FeastOfTheCross');

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 54 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 54 AND "hymn_key" = 'hosannaInTheHighest' AND "item_type" IS NULL AND "condition" IS 'PalmSunday');

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 55 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 55 AND "hymn_key" = 'TENTH_GOSPEL' AND "item_type" IS NULL AND "condition" IS NULL);

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 56 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 56 AND "hymn_key" = 'TENTH_GOSPEL_READINGS' AND "item_type" IS 'Inline' AND "condition" IS NULL);

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 57 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 57 AND "hymn_key" = 'johnHasBorneWitness' AND "item_type" IS NULL AND "condition" IS NULL);

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 58 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 58 AND "hymn_key" = 'throughHisCross' AND "item_type" IS NULL AND "condition" IS 'FeastOfTheCross');

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 59 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 59 AND "hymn_key" = 'hosannaInTheHighest' AND "item_type" IS NULL AND "condition" IS 'PalmSunday');

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 60 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 60 AND "hymn_key" = 'ELEVENTH_GOSPEL' AND "item_type" IS NULL AND "condition" IS NULL);

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 61 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 61 AND "hymn_key" = 'ELEVENTH_GOSPEL_READINGS' AND "item_type" IS 'Inline' AND "condition" IS NULL);

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 62 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 62 AND "hymn_key" = 'heWhoSitsUponTheCherubim' AND "item_type" IS NULL AND "condition" IS NULL);

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 63 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 63 AND "hymn_key" = 'throughHisCross' AND "item_type" IS NULL AND "condition" IS 'FeastOfTheCross');

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 64 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 64 AND "hymn_key" = 'hosannaInTheHighest' AND "item_type" IS NULL AND "condition" IS 'PalmSunday');

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 65 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 65 AND "hymn_key" = 'TWELFTH_GOSPEL' AND "item_type" IS NULL AND "condition" IS NULL);

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 66 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 66 AND "hymn_key" = 'TWELFTH_GOSPEL_READINGS' AND "item_type" IS 'Inline' AND "condition" IS NULL);

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 67 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 67 AND "hymn_key" = 'amongThoseBornOfWomen' AND "item_type" IS NULL AND "condition" IS NULL);

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 68 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 68 AND "hymn_key" = 'throughHisCross' AND "item_type" IS NULL AND "condition" IS 'FeastOfTheCross');

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession no longer has row 69 as it was' WHERE NOT EXISTS (SELECT 1 FROM "procession_of_the_cross.procession_of_the_cross"
  WHERE "item_order" = 69 AND "hymn_key" = 'hosannaInTheHighest' AND "item_type" IS NULL AND "condition" IS 'PalmSunday');

INSERT INTO "procession_of_the_cross.procession_of_the_cross" ("item_order", "minimization")
SELECT 0, 'the Procession has rows this does not know' WHERE (SELECT count(*) FROM "procession_of_the_cross.procession_of_the_cross" WHERE "item_order" > 8.5) <> 61;

-- The station titles, 1st to 12th.

UPDATE "procession_of_the_cross.hymn_titles" SET "title_english" = '1st Gospel (Before the Main Sanctuary)' WHERE "hymn_key" = 'FIRST_GOSPEL' AND "title_english" = 'First Gospel (Before the Main Sanctuary)';

UPDATE "procession_of_the_cross.hymn_titles" SET "title_english" = '2nd Gospel (Before the Icon of St. Mary)' WHERE "hymn_key" = 'SECOND_GOSPEL' AND "title_english" = 'Second Gospel (Before the Icon of St. Mary)';

UPDATE "procession_of_the_cross.hymn_titles" SET "title_english" = '3rd Gospel (Before the Icon of Archangel Gabriel)' WHERE "hymn_key" = 'THIRD_GOSPEL' AND "title_english" = 'Third Gospel (Before the Icon of Archangel Gabriel)';

UPDATE "procession_of_the_cross.hymn_titles" SET "title_english" = '4th Gospel (Before the Icon of Archangel Michael)' WHERE "hymn_key" = 'FOURTH_GOSPEL' AND "title_english" = 'Fourth Gospel (Before the Icon of Archangel Michael)';

UPDATE "procession_of_the_cross.hymn_titles" SET "title_english" = '5th Gospel (Before the Icon of St. Mark)' WHERE "hymn_key" = 'FIFTH_GOSPEL' AND "title_english" = 'Fifth Gospel (Before the Icon of St. Mark)';

UPDATE "procession_of_the_cross.hymn_titles" SET "title_english" = '6th Gospel (Before the Icon of the Apostles)' WHERE "hymn_key" = 'SIXTH_GOSPEL' AND "title_english" = 'Sixth Gospel (Before the Icon of the Apostles)';

UPDATE "procession_of_the_cross.hymn_titles" SET "title_english" = '7th Gospel (Before the Icon of Any Martyr)' WHERE "hymn_key" = 'SEVENTH_GOSPEL' AND "title_english" = 'Seventh Gospel (Before the Icon of Any Martyr)';

UPDATE "procession_of_the_cross.hymn_titles" SET "title_english" = '8th Gospel (Before the Icon of Any Saint)' WHERE "hymn_key" = 'EIGHTH_GOSPEL' AND "title_english" = 'Eighth Gospel (Before the Icon of Any Saint)';

UPDATE "procession_of_the_cross.hymn_titles" SET "title_english" = '9th Gospel (Before the Northern Door)' WHERE "hymn_key" = 'NINTH_GOSPEL' AND "title_english" = 'Ninth Gospel (Before the Northern Door)';

UPDATE "procession_of_the_cross.hymn_titles" SET "title_english" = '10th Gospel (Before the Immersion Font)' WHERE "hymn_key" = 'TENTH_GOSPEL' AND "title_english" = 'Tenth Gospel (Before the Immersion Font)';

UPDATE "procession_of_the_cross.hymn_titles" SET "title_english" = '11th Gospel (Before the Southern Door)' WHERE "hymn_key" = 'ELEVENTH_GOSPEL' AND "title_english" = 'Eleventh Gospel (Before the Southern Door)';

UPDATE "procession_of_the_cross.hymn_titles" SET "title_english" = '12th Gospel (Before the Icon of St. John the Baptist)' WHERE "hymn_key" = 'TWELFTH_GOSPEL' AND "title_english" = 'Twelfth Gospel (Before the Icon of St. John the Baptist)';

-- Each station's readings, filed under the station itself.

UPDATE "procession_of_the_cross.reading_rules" SET "inline_hymn_key" = "station_key" WHERE "inline_hymn_key" = "station_key" || '_READINGS';

-- Each station's row reads them; the rows that did, and the refrains' own rows, go.

UPDATE "procession_of_the_cross.procession_of_the_cross" SET "item_type" = 'Inline' WHERE "item_order" IN (9, 14, 19, 24, 29, 34, 39, 45, 50, 55, 60, 65);

DELETE FROM "procession_of_the_cross.procession_of_the_cross" WHERE "item_order" IN (10, 12, 13, 15, 17, 18, 20, 22, 23, 25, 27, 28, 30, 32, 33, 35, 37, 38, 40, 42, 43, 44, 46, 48, 49, 51, 53, 54, 56, 58, 59, 61, 63, 64, 66, 68, 69);

-- The responses: one hymn each, called where the station's hymn was.

INSERT INTO "procession_of_the_cross.hymn_titles" ("hymn_key", "title_english", "title_arabic", "category", "toggled", "prayer_type", "title_french") VALUES ('firstGospelResponse', '1st Gospel Response', NULL, 'procession_of_the_cross', 1, NULL, NULL);

INSERT INTO "procession_of_the_cross.hymn_titles" ("hymn_key", "title_english", "title_arabic", "category", "toggled", "prayer_type", "title_french") VALUES ('secondGospelResponse', '2nd Gospel Response', NULL, 'procession_of_the_cross', 1, NULL, NULL);

INSERT INTO "procession_of_the_cross.hymn_titles" ("hymn_key", "title_english", "title_arabic", "category", "toggled", "prayer_type", "title_french") VALUES ('thirdGospelResponse', '3rd Gospel Response', NULL, 'procession_of_the_cross', 1, NULL, NULL);

INSERT INTO "procession_of_the_cross.hymn_titles" ("hymn_key", "title_english", "title_arabic", "category", "toggled", "prayer_type", "title_french") VALUES ('fourthGospelResponse', '4th Gospel Response', NULL, 'procession_of_the_cross', 1, NULL, NULL);

INSERT INTO "procession_of_the_cross.hymn_titles" ("hymn_key", "title_english", "title_arabic", "category", "toggled", "prayer_type", "title_french") VALUES ('fifthGospelResponse', '5th Gospel Response', NULL, 'procession_of_the_cross', 1, NULL, NULL);

INSERT INTO "procession_of_the_cross.hymn_titles" ("hymn_key", "title_english", "title_arabic", "category", "toggled", "prayer_type", "title_french") VALUES ('sixthGospelResponse', '6th Gospel Response', NULL, 'procession_of_the_cross', 1, NULL, NULL);

INSERT INTO "procession_of_the_cross.hymn_titles" ("hymn_key", "title_english", "title_arabic", "category", "toggled", "prayer_type", "title_french") VALUES ('seventhGospelResponse', '7th Gospel Response', NULL, 'procession_of_the_cross', 1, NULL, NULL);

INSERT INTO "procession_of_the_cross.hymn_titles" ("hymn_key", "title_english", "title_arabic", "category", "toggled", "prayer_type", "title_french") VALUES ('eighthGospelResponse', '8th Gospel Response', NULL, 'procession_of_the_cross', 1, NULL, NULL);

INSERT INTO "procession_of_the_cross.hymn_titles" ("hymn_key", "title_english", "title_arabic", "category", "toggled", "prayer_type", "title_french") VALUES ('ninthGospelResponse', '9th Gospel Response', NULL, 'procession_of_the_cross', 1, NULL, NULL);

INSERT INTO "procession_of_the_cross.hymn_titles" ("hymn_key", "title_english", "title_arabic", "category", "toggled", "prayer_type", "title_french") VALUES ('tenthGospelResponse', '10th Gospel Response', NULL, 'procession_of_the_cross', 1, NULL, NULL);

INSERT INTO "procession_of_the_cross.hymn_titles" ("hymn_key", "title_english", "title_arabic", "category", "toggled", "prayer_type", "title_french") VALUES ('eleventhGospelResponse', '11th Gospel Response', NULL, 'procession_of_the_cross', 1, NULL, NULL);

INSERT INTO "procession_of_the_cross.hymn_titles" ("hymn_key", "title_english", "title_arabic", "category", "toggled", "prayer_type", "title_french") VALUES ('twelfthGospelResponse', '12th Gospel Response', NULL, 'procession_of_the_cross', 1, NULL, NULL);

INSERT INTO "procession_of_the_cross.hymn_texts" ("line_id", "hymn_key", "line_order", "english", "coptic", "arabic", "person_type", "prayer_type", "condition", "item_type", "inline_hymn_key", "inline_hymn_minimization", "inline_hymn_title_shown", "french") VALUES
  (92, 'firstGospelResponse', 1, NULL, NULL, NULL, NULL, NULL, NULL, 'Inline', 'theFourIncorporealCreatures', NULL, 0, NULL),
  (93, 'firstGospelResponse', 2, NULL, NULL, NULL, NULL, NULL, 'FeastOfTheCross', 'Inline', 'throughHisCross', NULL, 0, NULL),
  (94, 'firstGospelResponse', 3, NULL, NULL, NULL, NULL, NULL, 'PalmSunday', 'Inline', 'hosannaInTheHighest', NULL, 0, NULL);

UPDATE "procession_of_the_cross.procession_of_the_cross" SET "hymn_key" = 'firstGospelResponse' WHERE "item_order" = 11 AND "hymn_key" = 'theFourIncorporealCreatures';

INSERT INTO "procession_of_the_cross.hymn_texts" ("line_id", "hymn_key", "line_order", "english", "coptic", "arabic", "person_type", "prayer_type", "condition", "item_type", "inline_hymn_key", "inline_hymn_minimization", "inline_hymn_title_shown", "french") VALUES
  (95, 'secondGospelResponse', 1, NULL, NULL, NULL, NULL, NULL, NULL, 'Inline', 'weExaltYouWorthily', NULL, 0, NULL),
  (96, 'secondGospelResponse', 2, NULL, NULL, NULL, NULL, NULL, 'FeastOfTheCross', 'Inline', 'throughHisCross', NULL, 0, NULL),
  (97, 'secondGospelResponse', 3, NULL, NULL, NULL, NULL, NULL, 'PalmSunday', 'Inline', 'hosannaInTheHighest', NULL, 0, NULL);

UPDATE "procession_of_the_cross.procession_of_the_cross" SET "hymn_key" = 'secondGospelResponse' WHERE "item_order" = 16 AND "hymn_key" = 'weExaltYouWorthily';

INSERT INTO "procession_of_the_cross.hymn_texts" ("line_id", "hymn_key", "line_order", "english", "coptic", "arabic", "person_type", "prayer_type", "condition", "item_type", "inline_hymn_key", "inline_hymn_minimization", "inline_hymn_title_shown", "french") VALUES
  (98, 'thirdGospelResponse', 1, NULL, NULL, NULL, NULL, NULL, NULL, 'Inline', 'gabrielTheAngel', NULL, 0, NULL),
  (99, 'thirdGospelResponse', 2, NULL, NULL, NULL, NULL, NULL, 'FeastOfTheCross', 'Inline', 'throughHisCross', NULL, 0, NULL),
  (100, 'thirdGospelResponse', 3, NULL, NULL, NULL, NULL, NULL, 'PalmSunday', 'Inline', 'hosannaInTheHighest', NULL, 0, NULL);

UPDATE "procession_of_the_cross.procession_of_the_cross" SET "hymn_key" = 'thirdGospelResponse' WHERE "item_order" = 21 AND "hymn_key" = 'gabrielTheAngel';

INSERT INTO "procession_of_the_cross.hymn_texts" ("line_id", "hymn_key", "line_order", "english", "coptic", "arabic", "person_type", "prayer_type", "condition", "item_type", "inline_hymn_key", "inline_hymn_minimization", "inline_hymn_title_shown", "french") VALUES
  (101, 'fourthGospelResponse', 1, NULL, NULL, NULL, NULL, NULL, NULL, 'Inline', 'michaelTheHeadOfTheHeavenly', NULL, 0, NULL),
  (102, 'fourthGospelResponse', 2, NULL, NULL, NULL, NULL, NULL, 'FeastOfTheCross', 'Inline', 'throughHisCross', NULL, 0, NULL),
  (103, 'fourthGospelResponse', 3, NULL, NULL, NULL, NULL, NULL, 'PalmSunday', 'Inline', 'hosannaInTheHighest', NULL, 0, NULL);

UPDATE "procession_of_the_cross.procession_of_the_cross" SET "hymn_key" = 'fourthGospelResponse' WHERE "item_order" = 26 AND "hymn_key" = 'michaelTheHeadOfTheHeavenly';

INSERT INTO "procession_of_the_cross.hymn_texts" ("line_id", "hymn_key", "line_order", "english", "coptic", "arabic", "person_type", "prayer_type", "condition", "item_type", "inline_hymn_key", "inline_hymn_minimization", "inline_hymn_title_shown", "french") VALUES
  (104, 'fifthGospelResponse', 1, NULL, NULL, NULL, NULL, NULL, NULL, 'Inline', 'oMarkTheApostleAndEvangelist', NULL, 0, NULL),
  (105, 'fifthGospelResponse', 2, NULL, NULL, NULL, NULL, NULL, 'FeastOfTheCross', 'Inline', 'throughHisCross', NULL, 0, NULL),
  (106, 'fifthGospelResponse', 3, NULL, NULL, NULL, NULL, NULL, 'PalmSunday', 'Inline', 'hosannaInTheHighest', NULL, 0, NULL);

UPDATE "procession_of_the_cross.procession_of_the_cross" SET "hymn_key" = 'fifthGospelResponse' WHERE "item_order" = 31 AND "hymn_key" = 'oMarkTheApostleAndEvangelist';

INSERT INTO "procession_of_the_cross.hymn_texts" ("line_id", "hymn_key", "line_order", "english", "coptic", "arabic", "person_type", "prayer_type", "condition", "item_type", "inline_hymn_key", "inline_hymn_minimization", "inline_hymn_title_shown", "french") VALUES
  (107, 'sixthGospelResponse', 1, NULL, NULL, NULL, NULL, NULL, NULL, 'Inline', 'jesusChristSentYouOTwelveApostles', NULL, 0, NULL),
  (108, 'sixthGospelResponse', 2, NULL, NULL, NULL, NULL, NULL, 'FeastOfTheCross', 'Inline', 'throughHisCross', NULL, 0, NULL),
  (109, 'sixthGospelResponse', 3, NULL, NULL, NULL, NULL, NULL, 'PalmSunday', 'Inline', 'hosannaInTheHighest', NULL, 0, NULL);

UPDATE "procession_of_the_cross.procession_of_the_cross" SET "hymn_key" = 'sixthGospelResponse' WHERE "item_order" = 36 AND "hymn_key" = 'jesusChristSentYouOTwelveApostles';

INSERT INTO "procession_of_the_cross.hymn_texts" ("line_id", "hymn_key", "line_order", "english", "coptic", "arabic", "person_type", "prayer_type", "condition", "item_type", "inline_hymn_key", "inline_hymn_minimization", "inline_hymn_title_shown", "french") VALUES
  (110, 'seventhGospelResponse', 1, 'For St. George', NULL, NULL, 'Comment', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (111, 'seventhGospelResponse', 2, NULL, NULL, NULL, NULL, NULL, NULL, 'Inline', 'saintGeorgeCompletedSevenYears', NULL, 0, NULL),
  (112, 'seventhGospelResponse', 3, 'For Any Other Martyr', NULL, NULL, 'Comment', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (113, 'seventhGospelResponse', 4, NULL, NULL, NULL, NULL, NULL, NULL, 'Inline', 'hailToYouOMartyr', NULL, 0, NULL),
  (114, 'seventhGospelResponse', 5, NULL, NULL, NULL, NULL, NULL, 'FeastOfTheCross', 'Inline', 'throughHisCross', NULL, 0, NULL),
  (115, 'seventhGospelResponse', 6, NULL, NULL, NULL, NULL, NULL, 'PalmSunday', 'Inline', 'hosannaInTheHighest', NULL, 0, NULL);

UPDATE "procession_of_the_cross.procession_of_the_cross" SET "hymn_key" = 'seventhGospelResponse' WHERE "item_order" = 41 AND "hymn_key" = 'saintGeorgeCompletedSevenYears';

INSERT INTO "procession_of_the_cross.hymn_texts" ("line_id", "hymn_key", "line_order", "english", "coptic", "arabic", "person_type", "prayer_type", "condition", "item_type", "inline_hymn_key", "inline_hymn_minimization", "inline_hymn_title_shown", "french") VALUES
  (116, 'eighthGospelResponse', 1, NULL, NULL, NULL, NULL, NULL, NULL, 'Inline', 'purgeFromYourHearts', NULL, 0, NULL),
  (117, 'eighthGospelResponse', 2, NULL, NULL, NULL, NULL, NULL, 'FeastOfTheCross', 'Inline', 'throughHisCross', NULL, 0, NULL),
  (118, 'eighthGospelResponse', 3, NULL, NULL, NULL, NULL, NULL, 'PalmSunday', 'Inline', 'hosannaInTheHighest', NULL, 0, NULL);

UPDATE "procession_of_the_cross.procession_of_the_cross" SET "hymn_key" = 'eighthGospelResponse' WHERE "item_order" = 47 AND "hymn_key" = 'purgeFromYourHearts';

INSERT INTO "procession_of_the_cross.hymn_texts" ("line_id", "hymn_key", "line_order", "english", "coptic", "arabic", "person_type", "prayer_type", "condition", "item_type", "inline_hymn_key", "inline_hymn_minimization", "inline_hymn_title_shown", "french") VALUES
  (119, 'ninthGospelResponse', 1, NULL, NULL, NULL, NULL, NULL, NULL, 'Inline', 'whenYouComeInYourSecondAppearance', NULL, 0, NULL),
  (120, 'ninthGospelResponse', 2, NULL, NULL, NULL, NULL, NULL, 'FeastOfTheCross', 'Inline', 'throughHisCross', NULL, 0, NULL),
  (121, 'ninthGospelResponse', 3, NULL, NULL, NULL, NULL, NULL, 'PalmSunday', 'Inline', 'hosannaInTheHighest', NULL, 0, NULL);

UPDATE "procession_of_the_cross.procession_of_the_cross" SET "hymn_key" = 'ninthGospelResponse' WHERE "item_order" = 52 AND "hymn_key" = 'whenYouComeInYourSecondAppearance';

INSERT INTO "procession_of_the_cross.hymn_texts" ("line_id", "hymn_key", "line_order", "english", "coptic", "arabic", "person_type", "prayer_type", "condition", "item_type", "inline_hymn_key", "inline_hymn_minimization", "inline_hymn_title_shown", "french") VALUES
  (122, 'tenthGospelResponse', 1, NULL, NULL, NULL, NULL, NULL, NULL, 'Inline', 'johnHasBorneWitness', NULL, 0, NULL),
  (123, 'tenthGospelResponse', 2, NULL, NULL, NULL, NULL, NULL, 'FeastOfTheCross', 'Inline', 'throughHisCross', NULL, 0, NULL),
  (124, 'tenthGospelResponse', 3, NULL, NULL, NULL, NULL, NULL, 'PalmSunday', 'Inline', 'hosannaInTheHighest', NULL, 0, NULL);

UPDATE "procession_of_the_cross.procession_of_the_cross" SET "hymn_key" = 'tenthGospelResponse' WHERE "item_order" = 57 AND "hymn_key" = 'johnHasBorneWitness';

INSERT INTO "procession_of_the_cross.hymn_texts" ("line_id", "hymn_key", "line_order", "english", "coptic", "arabic", "person_type", "prayer_type", "condition", "item_type", "inline_hymn_key", "inline_hymn_minimization", "inline_hymn_title_shown", "french") VALUES
  (125, 'eleventhGospelResponse', 1, NULL, NULL, NULL, NULL, NULL, NULL, 'Inline', 'heWhoSitsUponTheCherubim', NULL, 0, NULL),
  (126, 'eleventhGospelResponse', 2, NULL, NULL, NULL, NULL, NULL, 'FeastOfTheCross', 'Inline', 'throughHisCross', NULL, 0, NULL),
  (127, 'eleventhGospelResponse', 3, NULL, NULL, NULL, NULL, NULL, 'PalmSunday', 'Inline', 'hosannaInTheHighest', NULL, 0, NULL);

UPDATE "procession_of_the_cross.procession_of_the_cross" SET "hymn_key" = 'eleventhGospelResponse' WHERE "item_order" = 62 AND "hymn_key" = 'heWhoSitsUponTheCherubim';

INSERT INTO "procession_of_the_cross.hymn_texts" ("line_id", "hymn_key", "line_order", "english", "coptic", "arabic", "person_type", "prayer_type", "condition", "item_type", "inline_hymn_key", "inline_hymn_minimization", "inline_hymn_title_shown", "french") VALUES
  (128, 'twelfthGospelResponse', 1, NULL, NULL, NULL, NULL, NULL, NULL, 'Inline', 'amongThoseBornOfWomen', NULL, 0, NULL),
  (129, 'twelfthGospelResponse', 2, NULL, NULL, NULL, NULL, NULL, 'FeastOfTheCross', 'Inline', 'throughHisCross', NULL, 0, NULL),
  (130, 'twelfthGospelResponse', 3, NULL, NULL, NULL, NULL, NULL, 'PalmSunday', 'Inline', 'hosannaInTheHighest', NULL, 0, NULL);

UPDATE "procession_of_the_cross.procession_of_the_cross" SET "hymn_key" = 'twelfthGospelResponse' WHERE "item_order" = 67 AND "hymn_key" = 'amongThoseBornOfWomen';

-- The "Psalm and Gospel" titles, nothing calls them now.

DELETE FROM "procession_of_the_cross.hymn_titles" WHERE "hymn_key" IN ('FIRST_GOSPEL_READINGS', 'SECOND_GOSPEL_READINGS', 'THIRD_GOSPEL_READINGS', 'FOURTH_GOSPEL_READINGS', 'FIFTH_GOSPEL_READINGS', 'SIXTH_GOSPEL_READINGS', 'SEVENTH_GOSPEL_READINGS', 'EIGHTH_GOSPEL_READINGS', 'NINTH_GOSPEL_READINGS', 'TENTH_GOSPEL_READINGS', 'ELEVENTH_GOSPEL_READINGS', 'TWELFTH_GOSPEL_READINGS');
