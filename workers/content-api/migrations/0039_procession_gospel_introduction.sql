-- The deacon's introduction to each Gospel of the Procession of the Cross,
-- read before the Gospel's citation at each of its twelve stations
-- (src/utils/hymnLibrary.js, resolveInlineReadingRuleSection). One line per
-- evangelist, picked by the Gospel being read (GospelMatthew, GospelMark,
-- GospelLuke, GospelJohn), as gospel_rite's introductionAndPsalm picks its
-- own. English and Arabic as given on 4 Nov 2026, the evangelists' Arabic
-- names as gospel_rite writes them; Coptic and French are left to be added.
--
-- Plain INSERTs: a hymn or line already there under these keys fails the
-- file, and D1 rolls it back, rather than overwriting an edit.

INSERT INTO "procession_of_the_cross.hymn_titles" ("hymn_key", "title_english", "title_arabic", "category", "toggled", "prayer_type", "title_french")
VALUES ('gospelIntroduction', 'Gospel Introduction', NULL, 'procession_of_the_cross', 1, NULL, NULL);

INSERT INTO "procession_of_the_cross.hymn_texts" ("line_id", "hymn_key", "line_order", "english", "coptic", "arabic", "person_type", "prayer_type", "condition", "item_type", "inline_hymn_key", "inline_hymn_minimization", "inline_hymn_title_shown", "french")
VALUES
  (88, 'gospelIntroduction', 1, 'A reading from the Gospel according to our teacher Saint Matthew the Evangelist, and the pure disciple. May his blessings be with us all.', NULL, 'فصلٌ من بشارة الإنجيل لمعلمنا مارمتى البشير، التلميذُ الطاهر، بركاتهُ على جميعنا.', 'Deacon', NULL, 'GospelMatthew', NULL, NULL, NULL, NULL, NULL),
  (89, 'gospelIntroduction', 2, 'A reading from the Gospel according to our teacher Saint Mark the Evangelist, and the pure disciple. May his blessings be with us all.', NULL, 'فصلٌ من بشارة الإنجيل لمعلمنا مارمرقس البشير، التلميذُ الطاهر، بركاتهُ على جميعنا.', 'Deacon', NULL, 'GospelMark', NULL, NULL, NULL, NULL, NULL),
  (90, 'gospelIntroduction', 3, 'A reading from the Gospel according to our teacher Saint Luke the Evangelist, and the pure disciple. May his blessings be with us all.', NULL, 'فصلٌ من بشارة الإنجيل لمعلمنا مارلوقا البشير، التلميذُ الطاهر، بركاتهُ على جميعنا.', 'Deacon', NULL, 'GospelLuke', NULL, NULL, NULL, NULL, NULL),
  (91, 'gospelIntroduction', 4, 'A reading from the Gospel according to our teacher Saint John the Evangelist, and the pure disciple. May his blessings be with us all.', NULL, 'فصلٌ من بشارة الإنجيل لمعلمنا ماريوحنا البشير، التلميذُ الطاهر، بركاتهُ على جميعنا.', 'Deacon', NULL, 'GospelJohn', NULL, NULL, NULL, NULL, NULL);
