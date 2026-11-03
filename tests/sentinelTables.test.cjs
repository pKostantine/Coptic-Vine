const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');

/**
 * An ALL_CAPS Subdocument or Inline row calls the whole order table of its
 * name, wherever that table is (utils/sentinelTables.js), with nothing listed
 * for it in the app: FRACTIONS is fractions.fractions.
 */

function loadFile(path, resolve = require) {
  const js = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('exports', 'require', 'module', js)(module.exports, resolve, module);
  return module.exports;
}
const orderTables = loadFile('src/constants/contentOrderTables.ts');
const { sentinelTable, isSentinelKey, SENTINEL_TABLE_ALIASES } = loadFile('src/utils/sentinelTables.js', (name) => (name === '../constants/contentOrderTables' ? orderTables : require(name)));
const library = fs.readFileSync('src/utils/hymnLibrary.js', 'utf8');

test("the app knows every order table the content API serves, as the Worker's own list has them", async () => {
  const { renderContentOrderTables, contentOrderTables } = await import('../scripts/build-content-order-tables.mjs');
  const contentTables = JSON.parse(fs.readFileSync('workers/content-api/schema/content-tables.json', 'utf8'));
  assert.equal(
    fs.readFileSync('src/constants/contentOrderTables.ts', 'utf8'),
    renderContentOrderTables(contentTables),
    'out of date: run node scripts/build-content-order-tables.mjs',
  );
  const tables = Object.fromEntries(contentOrderTables(contentTables));
  // Placements only, never a schema's hymn_titles or hymn_texts.
  assert.equal(tables.fractions, 'fractions');
  assert.equal(tables.liturgy_of_st_basil, 'liturgy');
  assert.equal(tables.hymn_texts, undefined);
  assert.equal(tables.hymn_titles, undefined);
});

test('a key calls the table of its name wherever it is, with nothing listed for it', () => {
  assert.deepEqual(sentinelTable('FRACTIONS'), { schema: 'fractions', table: 'fractions' });
  assert.deepEqual(sentinelTable('ADAM_ASPASMOS'), { schema: 'aspasmos', table: 'adam_aspasmos' });
  assert.deepEqual(sentinelTable('SEASONAL_DISTRIBUTION_HYMNS'), { schema: 'seasonal_liturgy_hymns', table: 'seasonal_distribution_hymns' });
  assert.deepEqual(sentinelTable('PROCESSION_OF_THE_CROSS'), { schema: 'procession_of_the_cross', table: 'procession_of_the_cross' });
  // Every table the reader used to list by hand is still where it was.
  const formerlyListed = {
    ANTIPHONARY: 'psalmody.antiphonary', CANONS: 'canons.canons', DOXOLOGIES: 'doxologies.doxologies',
    GOSPEL_RITE: 'gospel_rite.gospel_rite', MOURNFUL_GOSPEL_RITE: 'gospel_rite.mournful_gospel_rite',
    MOURNFUL_4_GOSPELS_RITE: 'gospel_rite.mournful_4_gospels_rite',
    PALM_SUNDAY_LITURGY_GOSPEL_RITE: 'gospel_rite.palm_sunday_liturgy_gospel_rite',
    GOSPEL_RESPONSES: 'gospel_responses.gospel_responses', THE_FIVE_SHORT_LITANIES: 'litanies.the_five_short_litanies',
    THREE_GREAT_LITANIES: 'litanies.the_three_great_litanies', THE_THREE_GREAT_LITANIES: 'litanies.the_three_great_litanies',
    PRAXIS_RESPONSE: 'praxis_response.praxis_response', HYMN_OF_THE_INTERCESSIONS: 'hymn_of_the_intercessions.hymn_of_the_intercessions',
    VERSES_OF_THE_CYMBALS: 'verses_of_the_cymbals.verses_of_the_cymbals', LITURGY_AGPEYA: 'liturgy.liturgy_agpeya',
    COMMEMORATION_OF_THE_SAINTS_HYMNS: 'liturgy.commemoration_of_the_saints_hymns', PSALIES_SAINTS: 'psalmody.psalies_saints',
    PSALIES_SEASONAL: 'psalmody.psalies_seasonal', PSALIES_DAILY: 'psalmody.psalies_daily',
    PAULINE_EPISTLE: 'readings.pauline_epistle', CATHOLIC_EPISTLE: 'readings.catholic_epistle', PRAXIS: 'readings.praxis',
    COPTIC_PAULINE_EPISTLE: 'readings.coptic_pauline_epistle', COPTIC_CATHOLIC_EPISTLE: 'readings.coptic_catholic_epistle',
    COPTIC_PRAXIS: 'readings.coptic_praxis', THIRD_HOUR: 'agpeya.third_hour', SIXTH_HOUR: 'agpeya.sixth_hour',
    NINTH_HOUR: 'agpeya.ninth_hour', ELEVENTH_HOUR: 'agpeya.eleventh_hour', TWELFTH_HOUR: 'agpeya.twelfth_hour',
    PRAYER_OF_THE_VEIL: 'agpeya.prayer_of_the_veil', INTRODUCTION_TO_EVERY_HOUR: 'agpeya.introduction_to_every_hour',
    FIRST_HOUR: 'agpeya.first_hour', MIDNIGHT_HOUR: 'agpeya.midnight_hour', OTHER_PRAYERS: 'agpeya.other_prayers',
    VENERATION: 'veneration.veneration',
  };
  for (const [key, target] of Object.entries(formerlyListed)) {
    const found = sentinelTable(key);
    assert.equal(found && `${found.schema}.${found.table}`, target, key);
  }
  // Only a key that isn't its table's name is listed.
  assert.deepEqual(Object.keys(SENTINEL_TABLE_ALIASES), ['THREE_GREAT_LITANIES']);
});

test("a hymn's own key, a table the content doesn't have, or a key resolved its own way calls no table", () => {
  assert.equal(isSentinelKey('introductionToTheFractionStBasil'), false);
  assert.equal(sentinelTable('introductionToTheFractionStBasil'), null);
  assert.equal(sentinelTable('fractions'), null, 'a table is called in capitals');
  assert.equal(sentinelTable('VENERATION_MELODIES'), null);
  assert.equal(sentinelTable('FIRST_GOSPEL_READINGS'), null);
  assert.equal(sentinelTable('CONSTRUCTOR'), null, "nothing an object inherits is a table");
  assert.equal(sentinelTable(''), null);
  assert.equal(sentinelTable(null), null);
  assert.equal(sentinelTable('PROPHECY', (key) => key === 'PROPHECY'), null);

  // The reader's own: the prophecies, each read on its own, the Synaxarium, and the day's readings.
  assert.match(library, /const SENTINELS_RESOLVED_OTHERWISE = new Set\(\["PROPHECY", "COPTIC_PROPHECY", "SYNAXARIUM"\]\);/);
  assert.match(library, /return SENTINELS_RESOLVED_OTHERWISE\.has\(hymnKey\) \|\| isReadingSentinel\(hymnKey\) \|\| PASCHA_READING_SENTINELS\.has\(hymnKey\);/);
  // Left to themselves, readings.prophecy and readings.coptic_prophecy would be found by name.
  assert.deepEqual(sentinelTable('COPTIC_PROPHECY'), { schema: 'readings', table: 'coptic_prophecy' });
});

test('a Subdocument and an Inline both find their table the same way', () => {
  assert.match(library, /function resolveWholeTableInlineTarget\(hymnKey\) \{\n\s+return sentinelTable\(hymnKey, isResolvedOtherwise\);/);
  assert.match(library, /if \(section\.isSubdocumentPlaceholder\) \{\n\s+const target = resolveWholeTableInlineTarget\(section\.hymn_key\);/);
  assert.match(library, /const target = resolveWholeTableInlineTarget\(section\.hymn_key\);\n\s+if \(target\) \{\n\s+if \(depth >= 3\) continue;\n\s+const nestedSections = await hydrateWholeTableInlineNested/);
  assert.match(library, /const wholeTableTarget = resolveWholeTableInlineTarget\(verse\.inlineHymnKey\);/);
  assert.doesNotMatch(library, /SUBDOCUMENT_MAP/, 'no hand-kept list of tables');
});

test("offline, the Liturgy book carries the Fractions and the seasonal hymns, as the server's plan packs them", () => {
  const registry = loadFile('src/constants/bookDependencyRegistry.ts');
  const liturgy = registry.resourcesForBook('liturgy');
  assert.ok(liturgy.includes('fractions'));
  assert.ok(liturgy.includes('seasonal_liturgy_hymns'));
});
