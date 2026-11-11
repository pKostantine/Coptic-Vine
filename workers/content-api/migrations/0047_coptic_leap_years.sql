-- The Coptic leap year is the one BEFORE a Gregorian leap year: its Nesi has
-- six days (Nesi 6 on 11 September 2023, 2027…), Thoout 1 falls on 12
-- September, and every day after it is a day later than usual until the
-- Gregorian 29 February brings the two calendars back in step. The table had
-- the year after it as the leap year instead (1740 rather than 1739), so from
-- each 11 September before a Gregorian leap year to the next 10 September
-- every date was a day off (Thoout 1 on 11 September 2023, Kiahk 29 on 7
-- January 2024, Meshir 22 on 29 February 2024), and Nesi 6 came a year late.
--
-- Every date is worked out again from its Julian day number: the Coptic
-- year begins on Julian day 1825030 (Thoout 1, year 1), each year has 365
-- days and a 366th every fourth (year mod 4 = 3), twelve months of 30 days
-- and Nesi of five or six. Only the rows that change are written.
WITH days AS (
  SELECT "gregorian_date", CAST(julianday("gregorian_date") + 0.5 AS INTEGER) AS jd
  FROM "calendar.coptic_date_conversions"
),
years AS (
  SELECT "gregorian_date", jd, (4 * (jd - 1825030) + 1463) / 1461 AS y FROM days
),
offsets AS (
  SELECT "gregorian_date", y, jd - (1825030 + 365 * (y - 1) + y / 4) AS since_new_year FROM years
),
coptic AS (
  SELECT "gregorian_date", y,
    since_new_year / 30 + 1 AS m,
    since_new_year % 30 + 1 AS d
  FROM offsets
),
correct AS (
  SELECT c."gregorian_date", c.y, c.m, c.d,
    CASE c.m WHEN 1 THEN 'Thoout' WHEN 2 THEN 'Paope' WHEN 3 THEN 'Hathor' WHEN 4 THEN 'Kiahk'
      WHEN 5 THEN 'Tobe' WHEN 6 THEN 'Meshir' WHEN 7 THEN 'Paremhotep' WHEN 8 THEN 'Parmoute'
      WHEN 9 THEN 'Pashons' WHEN 10 THEN 'Paone' WHEN 11 THEN 'Epep' WHEN 12 THEN 'Mesore'
      ELSE 'Nesi' END AS month_name,
    CASE WHEN c.y % 4 = 3 THEN 1 ELSE 0 END AS leap_year,
    CASE WHEN c.m = 13 AND c.d = 6 THEN 1 ELSE 0 END AS leap_day,
    CASE WHEN r."weekday_number" = 0 THEN (c.d + 6) / 7 ELSE NULL END AS sunday_ordinal
  FROM coptic c JOIN "calendar.coptic_date_conversions" r ON r."gregorian_date" = c."gregorian_date"
)
UPDATE "calendar.coptic_date_conversions" AS t SET
  "coptic_year" = correct.y,
  "coptic_month" = correct.m,
  "coptic_month_name" = correct.month_name,
  "coptic_day" = correct.d,
  "coptic_date_label" = correct.month_name || ' ' || correct.d || ', ' || correct.y,
  "coptic_date_key" = printf('%02d-%02d', correct.m, correct.d),
  "is_coptic_leap_year" = correct.leap_year,
  "is_coptic_leap_day" = correct.leap_day,
  "sunday_ordinal_in_coptic_month" = correct.sunday_ordinal
FROM correct
WHERE t."gregorian_date" = correct."gregorian_date"
  AND (t."coptic_year" IS NOT correct.y OR t."coptic_month" IS NOT correct.m OR t."coptic_day" IS NOT correct.d
    OR t."coptic_month_name" IS NOT correct.month_name
    OR t."coptic_date_label" IS NOT correct.month_name || ' ' || correct.d || ', ' || correct.y
    OR t."coptic_date_key" IS NOT printf('%02d-%02d', correct.m, correct.d)
    OR t."is_coptic_leap_year" IS NOT correct.leap_year OR t."is_coptic_leap_day" IS NOT correct.leap_day
    OR t."sunday_ordinal_in_coptic_month" IS NOT correct.sunday_ordinal);

-- The feasts kept on a Coptic day had their dates right but for the Coptic
-- year 1800 (September 2083 to August 2084), where they came a day early,
-- the dates near the end of the table that 2100's missing 29 February
-- moves, and 2069's three days of the Cross, counted from Thoout 19 rather
-- than 17. Each moves to its own day (its id keeps the date it was made with).
UPDATE "calendar.calendar_event_instances" SET "gregorian_date" = CASE "event_instance_id"
    WHEN 'TheFeastOfTheCrossThreeDays_20690929_1447' THEN '2069-09-27'
    WHEN 'TheNayrouzFeastCopticNewYear_20830911_1852' THEN '2083-09-12'
    WHEN 'TheFeastOfTheCrossThreeDays_20830927_1853' THEN '2083-09-28'
    WHEN 'TheHolyNativityFastBegins_20831125_1854' THEN '2083-11-26'
    WHEN 'TheCircumcisionFeast_20840114_1856' THEN '2084-01-15'
    WHEN 'TheHolyEpiphany_20840119_1857' THEN '2084-01-20'
    WHEN 'FeastOfTheWeddingOfCanaOfGalilee_20840121_1858' THEN '2084-01-22'
    WHEN 'EntryIntoTheTemple_20840215_1859' THEN '2084-02-16'
    WHEN 'AnnunciationFeast_20840406_1864' THEN '2084-04-07'
    WHEN 'EntryIntoEgypt_20840531_1873' THEN '2084-06-01'
    WHEN 'TheApostlesFeastMartyrdomOfStPeterAndStPaul_20840711_1877' THEN '2084-07-12'
    WHEN 'StMarysFastBegins_20840806_1878' THEN '2084-08-07'
    WHEN 'TransfigurationFeast_20840818_1879' THEN '2084-08-19'
    WHEN 'AssumptionOfStMarysBody_20840821_1880' THEN '2084-08-22'
    WHEN 'TheFeastOfTheCross_21000319_2327' THEN '2100-03-20'
    WHEN 'MartyrdomOfStMarkTheEvangelist_21000508_2336' THEN '2100-05-09'
    WHEN 'TheNayrouzFeastCopticNewYear_21000911_2345' THEN '2100-09-12'
    WHEN 'TheFeastOfTheCrossThreeDays_21000927_2346' THEN '2100-09-28'
    WHEN 'TheHolyNativityFastBegins_21001125_2347' THEN '2100-11-26'
  END
WHERE "event_instance_id" IN (
  'TheFeastOfTheCrossThreeDays_20690929_1447',
  'TheNayrouzFeastCopticNewYear_20830911_1852',
  'TheFeastOfTheCrossThreeDays_20830927_1853',
  'TheHolyNativityFastBegins_20831125_1854',
  'TheCircumcisionFeast_20840114_1856',
  'TheHolyEpiphany_20840119_1857',
  'FeastOfTheWeddingOfCanaOfGalilee_20840121_1858',
  'EntryIntoTheTemple_20840215_1859',
  'AnnunciationFeast_20840406_1864',
  'EntryIntoEgypt_20840531_1873',
  'TheApostlesFeastMartyrdomOfStPeterAndStPaul_20840711_1877',
  'StMarysFastBegins_20840806_1878',
  'TransfigurationFeast_20840818_1879',
  'AssumptionOfStMarysBody_20840821_1880',
  'TheFeastOfTheCross_21000319_2327',
  'MartyrdomOfStMarkTheEvangelist_21000508_2336',
  'TheNayrouzFeastCopticNewYear_21000911_2345',
  'TheFeastOfTheCrossThreeDays_21000927_2346',
  'TheHolyNativityFastBegins_21001125_2347')
  AND "gregorian_date" = CASE "event_instance_id"
    WHEN 'TheFeastOfTheCrossThreeDays_20690929_1447' THEN '2069-09-29'
    WHEN 'TheNayrouzFeastCopticNewYear_20830911_1852' THEN '2083-09-11'
    WHEN 'TheFeastOfTheCrossThreeDays_20830927_1853' THEN '2083-09-27'
    WHEN 'TheHolyNativityFastBegins_20831125_1854' THEN '2083-11-25'
    WHEN 'TheCircumcisionFeast_20840114_1856' THEN '2084-01-14'
    WHEN 'TheHolyEpiphany_20840119_1857' THEN '2084-01-19'
    WHEN 'FeastOfTheWeddingOfCanaOfGalilee_20840121_1858' THEN '2084-01-21'
    WHEN 'EntryIntoTheTemple_20840215_1859' THEN '2084-02-15'
    WHEN 'AnnunciationFeast_20840406_1864' THEN '2084-04-06'
    WHEN 'EntryIntoEgypt_20840531_1873' THEN '2084-05-31'
    WHEN 'TheApostlesFeastMartyrdomOfStPeterAndStPaul_20840711_1877' THEN '2084-07-11'
    WHEN 'StMarysFastBegins_20840806_1878' THEN '2084-08-06'
    WHEN 'TransfigurationFeast_20840818_1879' THEN '2084-08-18'
    WHEN 'AssumptionOfStMarysBody_20840821_1880' THEN '2084-08-21'
    WHEN 'TheFeastOfTheCross_21000319_2327' THEN '2100-03-19'
    WHEN 'MartyrdomOfStMarkTheEvangelist_21000508_2336' THEN '2100-05-08'
    WHEN 'TheNayrouzFeastCopticNewYear_21000911_2345' THEN '2100-09-11'
    WHEN 'TheFeastOfTheCrossThreeDays_21000927_2346' THEN '2100-09-27'
    WHEN 'TheHolyNativityFastBegins_21001125_2347' THEN '2100-11-25'
  END;

-- The seasons kept on those days in 1800 move with them: the Nativity Fast
-- from Hathor 16, the Apostles' Fast to Epep 4, St. Mary's from Mesore 1
-- to Mesore 15.
UPDATE "calendar.season_ranges" SET "start_date" = '2083-11-26' WHERE "active_season" = 'Nativity Fast' AND "start_date" = '2083-11-25';
UPDATE "calendar.season_ranges" SET "end_date" = '2084-07-11' WHERE "active_season" = 'Apostles'' Fast' AND "end_date" = '2084-07-10';
UPDATE "calendar.season_ranges" SET "start_date" = '2084-08-07', "end_date" = '2084-08-21' WHERE "active_season" = 'St. Mary''s Fast' AND "start_date" = '2084-08-06' AND "end_date" = '2084-08-20';

-- Each feast's Coptic date, as the calendar now has its day. The Nativity is
-- the exception: the Synod keeps it on 7 January, which in the year after a
-- leap year is Kiahk 28, and it is still the feast of Kiahk 29.
UPDATE "calendar.calendar_event_instances" AS i SET
  "coptic_year" = c."coptic_year",
  "coptic_month" = CASE WHEN i."event_key" = 'TheHolyNativityFeast' THEN 4 ELSE c."coptic_month" END,
  "coptic_month_name" = CASE WHEN i."event_key" = 'TheHolyNativityFeast' THEN 'Kiahk' ELSE c."coptic_month_name" END,
  "coptic_day" = CASE WHEN i."event_key" = 'TheHolyNativityFeast' THEN 29 ELSE c."coptic_day" END,
  "coptic_date_key" = CASE WHEN i."event_key" = 'TheHolyNativityFeast' THEN '04-29' ELSE c."coptic_date_key" END
FROM "calendar.coptic_date_conversions" AS c
WHERE c."gregorian_date" = i."gregorian_date"
  AND (i."coptic_year" IS NOT c."coptic_year"
    OR i."coptic_month" IS NOT CASE WHEN i."event_key" = 'TheHolyNativityFeast' THEN 4 ELSE c."coptic_month" END
    OR i."coptic_day" IS NOT CASE WHEN i."event_key" = 'TheHolyNativityFeast' THEN 29 ELSE c."coptic_day" END
    OR i."coptic_month_name" IS NOT CASE WHEN i."event_key" = 'TheHolyNativityFeast' THEN 'Kiahk' ELSE c."coptic_month_name" END
    OR i."coptic_date_key" IS NOT CASE WHEN i."event_key" = 'TheHolyNativityFeast' THEN '04-29' ELSE c."coptic_date_key" END);
