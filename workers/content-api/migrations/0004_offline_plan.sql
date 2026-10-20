-- The offline packages' plan: which books the app can download, which
-- resource (one per schema) each book is built from, which resources each
-- needs, and which tables go into each. The D1 equivalent of Supabase's
-- offline_content.books, .resources and .resource_dependencies, with the
-- rows they held on 20 Oct 2026.
--
-- A resource's tables are its schema's tables in D1 (include_tables limits
-- them), less any whose name says backup, archive, history, working,
-- staging, admin, draft or audit, as offline_content.package_tables did.
-- The Worker answers get_offline_package_plan from these tables.

CREATE TABLE "offline_content.books" (
  "book_key" TEXT PRIMARY KEY,
  "title_english" TEXT NOT NULL,
  "title_arabic" TEXT NOT NULL,
  "root_resources" TEXT NOT NULL CHECK (json_valid("root_resources")),
  "enabled" INTEGER NOT NULL DEFAULT 1 CHECK ("enabled" IN (0, 1))
) STRICT;

CREATE TABLE "offline_content.resources" (
  "resource_key" TEXT PRIMARY KEY,
  "schema_name" TEXT NOT NULL,
  "include_tables" TEXT CHECK ("include_tables" IS NULL OR json_valid("include_tables"))
) STRICT;

CREATE TABLE "offline_content.resource_dependencies" (
  "resource_key" TEXT NOT NULL REFERENCES "offline_content.resources" ("resource_key") ON DELETE CASCADE,
  "dependency_key" TEXT NOT NULL REFERENCES "offline_content.resources" ("resource_key") ON DELETE CASCADE,
  PRIMARY KEY ("resource_key", "dependency_key")
) STRICT;

INSERT INTO "offline_content.books" ("book_key", "title_english", "title_arabic", "root_resources", "enabled") VALUES
  ('agpeya', 'Agpeya', 'الأجبية', '["agpeya"]', 1),
  ('bible', 'Bible', 'الكتاب المقدس', '["bible"]', 1),
  ('holy_week', 'Holy Week', 'أسبوع الآلام', '["holy_week"]', 1),
  ('liturgy', 'Liturgy', 'القداس', '["liturgy"]', 1),
  ('psalmody', 'Psalmody', 'الإبصلمودية', '["psalmody"]', 1),
  ('veneration', 'Veneration', 'تمجيد', '["veneration"]', 1);

INSERT INTO "offline_content.resources" ("resource_key", "schema_name", "include_tables") VALUES
  ('agpeya', 'agpeya', NULL),
  ('bible', 'bible', '["books", "verses", "verse_parts"]'),
  ('calendar', 'calendar', '["coptic_date_conversions", "season_ranges", "reading_rules", "condition_flags"]'),
  ('canons', 'canons', NULL),
  ('doxologies', 'doxologies', NULL),
  ('fractions', 'fractions', NULL),
  ('gospel_responses', 'gospel_responses', NULL),
  ('gospel_rite', 'gospel_rite', NULL),
  ('holy_week', 'holy_week', NULL),
  ('hymn_of_the_intercessions', 'hymn_of_the_intercessions', NULL),
  ('litanies', 'litanies', NULL),
  ('liturgy', 'liturgy', NULL),
  ('praxis_response', 'praxis_response', NULL),
  ('psalmody', 'psalmody', NULL),
  ('public', 'public', '["hymn_titles", "hymn_texts", "saint_order"]'),
  ('readings', 'readings', NULL),
  ('seasonal_liturgy_hymns', 'seasonal_liturgy_hymns', NULL),
  ('synaxarium', 'synaxarium', NULL),
  ('veneration', 'veneration', NULL),
  ('verses_of_the_cymbals', 'verses_of_the_cymbals', NULL);

INSERT INTO "offline_content.resource_dependencies" ("resource_key", "dependency_key") VALUES
  ('agpeya', 'public'),
  ('bible', 'public'),
  ('canons', 'public'),
  ('doxologies', 'public'),
  ('fractions', 'public'),
  ('gospel_responses', 'public'),
  ('gospel_rite', 'bible'),
  ('gospel_rite', 'calendar'),
  ('gospel_rite', 'public'),
  ('holy_week', 'bible'),
  ('holy_week', 'calendar'),
  ('holy_week', 'gospel_rite'),
  ('holy_week', 'litanies'),
  ('holy_week', 'liturgy'),
  ('holy_week', 'public'),
  ('holy_week', 'readings'),
  ('hymn_of_the_intercessions', 'public'),
  ('litanies', 'public'),
  ('liturgy', 'agpeya'),
  ('liturgy', 'bible'),
  ('liturgy', 'calendar'),
  ('liturgy', 'doxologies'),
  ('liturgy', 'fractions'),
  ('liturgy', 'gospel_responses'),
  ('liturgy', 'gospel_rite'),
  ('liturgy', 'hymn_of_the_intercessions'),
  ('liturgy', 'litanies'),
  ('liturgy', 'praxis_response'),
  ('liturgy', 'psalmody'),
  ('liturgy', 'public'),
  ('liturgy', 'readings'),
  ('liturgy', 'seasonal_liturgy_hymns'),
  ('liturgy', 'synaxarium'),
  ('liturgy', 'veneration'),
  ('liturgy', 'verses_of_the_cymbals'),
  ('praxis_response', 'public'),
  ('psalmody', 'agpeya'),
  ('psalmody', 'bible'),
  ('psalmody', 'calendar'),
  ('psalmody', 'canons'),
  ('psalmody', 'doxologies'),
  ('psalmody', 'public'),
  ('readings', 'bible'),
  ('readings', 'calendar'),
  ('readings', 'public'),
  ('seasonal_liturgy_hymns', 'public'),
  ('synaxarium', 'calendar'),
  ('veneration', 'calendar'),
  ('veneration', 'doxologies'),
  ('veneration', 'hymn_of_the_intercessions'),
  ('veneration', 'praxis_response'),
  ('veneration', 'psalmody'),
  ('veneration', 'public'),
  ('veneration', 'verses_of_the_cymbals'),
  ('verses_of_the_cymbals', 'public');
