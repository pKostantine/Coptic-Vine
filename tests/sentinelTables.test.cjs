const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');

/**
 * A Subdocument, Inline or Hyperlink row calls a whole order table by its
 * full name, schema and table (utils/sentinelTables.js), with nothing listed
 * for it in the app: fractions.fractions, procession_of_the_cross.vespers_procession.
 * Before 4 Nov 2026 a call named its table in capitals (FRACTIONS), found
 * wherever that table was; offline books packed then still do, so that is
 * understood too.
 */

function loadFile(path, resolve = require) {
  const js = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('exports', 'require', 'module', js)(module.exports, resolve, module);
  return module.exports;
}
const orderTables = loadFile('src/constants/contentOrderTables.ts');
const { sentinelTable, isSentinelKey, SENTINEL_TABLE_ALIASES, tableCall, callName } = loadFile('src/utils/sentinelTables.js', (name) => (name === '../constants/contentOrderTables' ? orderTables : require(name)));
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

test('a call by full name goes straight to that table, listed or not, made today or long ago', () => {
  assert.deepEqual(sentinelTable('procession_of_the_cross.vespers_procession'), { schema: 'procession_of_the_cross', table: 'vespers_procession' });
  assert.deepEqual(sentinelTable('fractions.fractions'), { schema: 'fractions', table: 'fractions' });
  assert.deepEqual(sentinelTable('liturgy.some_table_made_tomorrow'), { schema: 'liturgy', table: 'some_table_made_tomorrow' });
  assert.deepEqual(tableCall('gospel_rite.mournful_4_gospels_rite'), { schema: 'gospel_rite', table: 'mournful_4_gospels_rite' });
  // A hymn's key, a name in capitals, or anything else that isn't schema.table names no table by itself.
  for (const key of ['introductionToTheFraction', 'FRACTIONS', 'Fractions.fractions', 'fractions.', '.fractions', 'a.b.c', 'fractions fractions', '', null]) {
    assert.equal(tableCall(key), null, String(key));
  }
});

test("a call goes by its table's name in capitals, so sections, bookmarks and the reader's own tables are as they were", () => {
  assert.equal(callName('fractions.fractions'), 'FRACTIONS');
  assert.equal(callName('procession_of_the_cross.vespers_procession'), 'VESPERS_PROCESSION');
  assert.equal(callName('gospel_rite.gospel_rite'), 'GOSPEL_RITE');
  assert.equal(callName('FRACTIONS'), 'FRACTIONS');
  assert.equal(callName('introductionToTheFraction'), 'introductionToTheFraction');
  assert.equal(callName(null), '');
  // The prophecies are read their own way however they are called.
  const otherwise = (key) => key === 'PROPHECY' || key === 'COPTIC_PROPHECY';
  assert.equal(sentinelTable('readings.prophecy', otherwise), null);
  assert.equal(sentinelTable('readings.coptic_prophecy', otherwise), null);
  assert.deepEqual(sentinelTable('readings.pauline_epistle', otherwise), { schema: 'readings', table: 'pauline_epistle' });
  // A section is named after the call's name, and keeps the key it was called by to find the table and its title.
  assert.match(library, /const name = callName\(row\.hymn_key\);/);
  assert.match(library, /id: `\$\{name\}-\$\{row\.item_order\}`,\n\s+hymn_key: name,\n\s+callKey: row\.hymn_key,/);
  assert.match(library, /inlineHymnKey: callName\(row\.inline_hymn_key\),\n\s+inlineCallKey: row\.inline_hymn_key,/);
});

test('a key in capitals, as offline books packed before full names have it, calls the table of its name wherever it is', () => {
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

test('a Subdocument and an Inline both find their table the same way, by the key they were called by', () => {
  assert.match(library, /function resolveWholeTableInlineTarget\(hymnKey\) \{\n\s+return sentinelTable\(hymnKey, isResolvedOtherwise\);/);
  assert.match(library, /if \(section\.isSubdocumentPlaceholder\) \{\n\s+const target = resolveWholeTableInlineTarget\(section\.callKey\);/);
  assert.match(library, /const target = resolveWholeTableInlineTarget\(section\.callKey\);\n\s+if \(target\) \{\n\s+if \(depth >= 3\) continue;\n\s+const nestedSections = await hydrateWholeTableInlineNested/);
  assert.match(library, /const wholeTableTarget = resolveWholeTableInlineTarget\(verse\.inlineCallKey\);/);
  // Its title is the one the calling schema gives that key.
  assert.match(library, /const inlineSentinelTitle = await fetchInlineHymnTitle\(schema, verse\.inlineCallKey\);/);
  assert.doesNotMatch(library, /SUBDOCUMENT_MAP/, 'no hand-kept list of tables');
});

test("offline, the Liturgy book carries the Fractions and the seasonal hymns, as the server's plan packs them", () => {
  const registry = loadFile('src/constants/bookDependencyRegistry.ts');
  const liturgy = registry.resourcesForBook('liturgy');
  assert.ok(liturgy.includes('fractions'));
  assert.ok(liturgy.includes('seasonal_liturgy_hymns'));
});

test('the offline books look for what a document calls where the reader looks for it', () => {
  // workers/content-api/src/offlineCalls.ts packs a book with whatever its
  // documents call, by the reader's own lookup: these lists must stay the reader's.
  const worker = fs.readFileSync('workers/content-api/src/offlineCalls.ts', 'utf8');
  const list = (source, name) => {
    const body = new RegExp(`const ${name}(?:: [^=]+)? = \\[([^\\]]*)\\]`).exec(source);
    assert.ok(body, `${name} not found`);
    return [...body[1].matchAll(/["']([a-z_]+)["']/g)].map((match) => match[1]);
  };
  for (const name of ['HYMN_KEY_FALLBACK_SCHEMAS', 'HYMN_TEXT_SCHEMAS']) {
    assert.deepEqual(list(worker, name), list(library, name), name);
  }
  // The Sermon Planner's extra lookup, and the aliases.
  assert.match(library, /const extraSchemas = schema === "liturgy" && table === "sermon_planner" \? \["gospel_rite"\] : \[\];/);
  assert.match(worker, /schemaName === 'liturgy' && table === 'sermon_planner' \? \['gospel_rite'\] : \[\]/);
  const aliases = Object.fromEntries(Object.entries(SENTINEL_TABLE_ALIASES).map(([key, target]) => [key, target.schema]));
  assert.deepEqual(aliases, { THREE_GREAT_LITANIES: 'litanies' });
  assert.match(worker, /export const SENTINEL_TABLE_ALIASES: Readonly<Record<string, string>> = \{ THREE_GREAT_LITANIES: 'litanies' \};/);
});

test('a Hyperlink by full name leaves for the one service that opens that table, with nothing listed for it', () => {
  const manifest = fs.readFileSync('src/constants/manifest.ts', 'utf8');
  assert.match(manifest, /export function findHyperlinkTarget\(hyperlinkKey\?: string \| null\): HyperlinkTarget \| undefined \{/);
  const document = fs.readFileSync('src/components/vine/screens/ServiceDocument.tsx', 'utf8');
  assert.doesNotMatch(document, /HYPERLINK_TARGETS\[/, 'every hyperlink is looked up through findHyperlinkTarget');
  assert.equal((document.match(/findHyperlinkTarget\(hyperlinkKey\)/g) || []).length, 2);

  const { findHyperlinkTarget, HYPERLINK_TARGETS } = loadFile('src/constants/manifest.ts');
  // Every name the content links by today is still where it was.
  for (const [name, target] of Object.entries(HYPERLINK_TARGETS)) assert.equal(findHyperlinkTarget(name), target, name);
  // A table one service opens is found by its name with nothing listed for it.
  assert.equal(findHyperlinkTarget('VENERATION').href, '/veneration');
  assert.equal(findHyperlinkTarget('SERMON_PLANNER').href, '/lectionary/sermon_planner');
  assert.equal(findHyperlinkTarget('THURSDAY_FIRST_HOUR').href, findHyperlinkTarget('HW_THURSDAY_1ST').href);
  // A table several entries open can't say which: Vespers and Matins, the Holy Week hours.
  assert.equal(findHyperlinkTarget('RAISING_OF_INCENSE'), undefined);
  assert.equal(findHyperlinkTarget('PASCHA_HOUR'), undefined);
  assert.equal(findHyperlinkTarget('TO_STRING'), undefined);
  assert.equal(findHyperlinkTarget('constructor'), undefined);
  assert.equal(findHyperlinkTarget(null), undefined);
});
