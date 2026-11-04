const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

/**
 * The Procession of the Cross reads a Psalm and a Gospel at each of its
 * twelve stations: FIRST_GOSPEL_READINGS … TWELFTH_GOSPEL_READINGS, Inline,
 * read from procession_of_the_cross.reading_rules (hymnLibrary.js,
 * resolveInlineReadingRuleSection).
 */

const library = fs.readFileSync('src/utils/hymnLibrary.js', 'utf8');
const slice = (start, end) => {
  const from = library.indexOf(start);
  const to = library.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `${start} not found`);
  return library.slice(from, to);
};

/** The station builder as the reader has it, over stand-ins for the content and the Bible. */
function stationReader({ rules, hymns = {}, titles = {}, introductions = {} }) {
  const queries = [];
  const supabase = {
    schema: (schema) => ({
      from: (table) => {
        const query = { schema, table, filters: [], order: null };
        queries.push(query);
        const chain = {
          select: () => chain,
          eq: (column, value) => { query.filters.push([column, value]); return chain; },
          order: (column, options) => {
            query.order = [column, options.ascending];
            const key = query.filters.find(([column]) => column === 'inline_hymn_key')?.[1];
            return Promise.resolve({ data: rules[key] || [], error: null });
          },
        };
        return chain;
      },
    }),
  };
  const bible = [];
  const definitions = [
    slice('const inlineReadingRulesCache = new Map();', '/**\n * An Inline key'),
    slice('async function resolveInlineReadingRuleSection(', '\n// ─── Prophecies'),
    slice('function readingReferenceVerse(', '\n/** A sentinel'),
    slice('function gospelAuthorFlagsOf(', '\n/**\n * Homilies'),
  ].join('\n');
  const make = new Function(
    'supabase', 'resolveBibleReadingReference', 'buildReadingCitation', 'buildReadingVerses', 'fetchInlineHymnVerses', 'fetchInlineHymnTitle',
    'evaluateBishopAwareVisibility', 'buildVerseFromTextRow', 'applyCopticCaseToSection', 'createReadableSupabaseError', 'fetchSchemaTextRowsByKeys',
    `${definitions}\nreturn resolveInlineReadingRuleSection;`,
  );
  const resolve = make(
    supabase,
    async (reference) => ({ resolvedSegments: [{ reference }] }),
    async (reading) => ({ english: `cites ${reading.reading_reference}`, arabic: '', french: '' }),
    (reading, withCoptic, isPsalm) => { bible.push({ reference: reading.reading_reference, withCoptic, isPsalm }); return [{ english: `Bible ${reading.reading_reference}` }]; },
    async (schema, key) => (hymns[`${schema}.${key}`] || []),
    async (schema, key) => titles[`${schema}.${key}`] || null,
    // A condition is a flag's name here, or Hidden.
    (condition, flags) => ({ visible: condition !== 'Hidden' && (!condition || flags[condition] === true), bishopOnly: false, priestOnly: false }),
    (row) => ({ english: row.english, personType: row.person_type }),
    (section) => section,
    (error) => error,
    async (schema, keys) => keys.flatMap((key) => introductions[`${schema}.${key}`] || []),
  );
  return { resolve, queries, bible };
}

const station = {
  id: 'FIRST_GOSPEL_READINGS-10',
  hymn_key: 'FIRST_GOSPEL_READINGS',
  title: { english: 'Psalm and Gospel', arabic: 'المزمور والإنجيل', french: '' },
  bishopOnly: false,
  priestOnly: false,
};
const firstStation = {
  FIRST_GOSPEL_READINGS: [
    { reading_rule_id: 'station_01_psalm', reading_type: 'Psalm', book_key: 'psalms', reading_reference: '19.103:4@19.137:1-2', psalm_hymn_key: 'psalm103_4_137_1_2', sort_order: 1 },
    { reading_rule_id: 'station_01_gospel', reading_type: 'Gospel', book_key: 'john', reading_reference: '43.1:43-51', psalm_hymn_key: null, sort_order: 2 },
  ],
};
// migrations/0039: the deacon's line before a Gospel, one per evangelist.
const gospelIntroduction = ['Matthew', 'Mark', 'Luke', 'John'].map((name) => ({
  english: `A reading from the Gospel according to our teacher Saint ${name} the Evangelist, and the pure disciple.`,
  person_type: 'Deacon',
  condition: `Gospel${name}`,
}));

test("a station reads each reading's introduction, then its citation, then the reading, under the row's own title", async () => {
  const { resolve, queries, bible } = stationReader({
    rules: firstStation,
    introductions: { 'procession_of_the_cross.gospelIntroduction': gospelIntroduction },
    hymns: {
      'procession_of_the_cross.psalm103_4_137_1_2': [
        { english: 'From the Psalms of our teacher David the prophet.', person_type: 'Deacon', condition: null },
        { english: 'Who makes His angels spirits…', person_type: 'Deacon', condition: null },
        { english: 'A line for another day', person_type: 'Deacon', condition: 'Hidden' },
      ],
    },
  });
  const section = await resolve('procession_of_the_cross', station, {});
  // Read from the schema's own reading_rules, filed under the Inline key, in reading order.
  assert.deepEqual(queries[0], { schema: 'procession_of_the_cross', table: 'reading_rules', filters: [['inline_hymn_key', 'FIRST_GOSPEL_READINGS']], order: ['sort_order', true] });
  assert.deepEqual(section.title, station.title);
  const shown = (verses) => verses.map((verse) => verse.type === 'readingReference' ? `[${verse.english}]` : `${verse.personType ? `${verse.personType}: ` : ''}${verse.english}`);
  assert.deepEqual(shown(section.verses), [
    // The Psalm: the deacon's introduction, its citation, and its verses without a second "Deacon:".
    'Deacon: From the Psalms of our teacher David the prophet.',
    '[cites 19.103:4@19.137:1-2]',
    'Who makes His angels spirits…',
    // The Gospel: the deacon's line for its evangelist, its citation, and the Bible's text.
    'Deacon: A reading from the Gospel according to our teacher Saint John the Evangelist, and the pure disciple.',
    '[cites 43.1:43-51]',
    'Bible 43.1:43-51',
  ]);
  // Another station's Gospel takes its own evangelist's line.
  const luke = stationReader({
    rules: { SECOND_GOSPEL_READINGS: [{ reading_rule_id: 'station_02_gospel', reading_type: 'Gospel', book_key: 'luke', reading_reference: '42.1:39-56', psalm_hymn_key: null, sort_order: 2 }] },
    introductions: { 'procession_of_the_cross.gospelIntroduction': gospelIntroduction },
  });
  const second = await luke.resolve('procession_of_the_cross', { ...station, hymn_key: 'SECOND_GOSPEL_READINGS' }, {});
  assert.deepEqual(shown(second.verses).slice(0, 2), ['Deacon: A reading from the Gospel according to our teacher Saint Luke the Evangelist, and the pure disciple.', '[cites 42.1:39-56]']);
  // The Gospel in every language, Coptic too; the Psalm wasn't read from the Bible.
  assert.deepEqual(bible, [{ reference: '43.1:43-51', withCoptic: true, isPsalm: false }]);
  // Never taken for one of the day's readings.
  assert.ok(section.verses.filter((verse) => verse.type === 'readingReference').every((verse) => !verse.reading));
});

test('a Psalm with no hymn of its own is read from the Bible, a Gospel with no introduction is read without one, and a key with nothing filed under it reads nothing', async () => {
  const { resolve, bible } = stationReader({ rules: firstStation });
  const section = await resolve('procession_of_the_cross', station, {});
  assert.deepEqual(bible.map((reading) => [reading.reference, reading.isPsalm]), [['19.103:4@19.137:1-2', true], ['43.1:43-51', false]]);
  assert.deepEqual(section.verses.map((verse) => verse.type || 'text'), ['readingReference', 'text', 'readingReference', 'text']);
  assert.equal(await resolve('procession_of_the_cross', { ...station, hymn_key: 'THIRTEENTH_GOSPEL_READINGS' }, {}), null);
});

test("the reader reads an Inline key from its schema's reading_rules before looking for a table of its name", () => {
  const orderTables = fs.readFileSync('src/constants/contentOrderTables.ts', 'utf8');
  assert.match(orderTables, /export const INLINE_READING_RULE_SCHEMAS: readonly string\[\] = Object\.freeze\(\['procession_of_the_cross'\]\);/);
  assert.match(library, /if \(INLINE_READING_RULE_SCHEMAS\.includes\(schema\) && isAllCapsKey\(section\.hymn_key\)\) \{\n\s+const readingSection = await resolveInlineReadingRuleSection\(schema, section, flags\);\n\s+if \(readingSection\) \{\n\s+hydrated\.push\(readingSection\);\n\s+continue;\n\s+\}\n\s+\}\n\n\s+const target = resolveWholeTableInlineTarget\(section\.hymn_key\);/);
});

test("the Gospel's introduction is the Procession's own hymn, one line per evangelist, in the words given", () => {
  const migration = fs.readFileSync('workers/content-api/migrations/0039_procession_gospel_introduction.sql', 'utf8');
  for (const [name, arabic] of [['Matthew', 'مارمتى'], ['Mark', 'مارمرقس'], ['Luke', 'مارلوقا'], ['John', 'ماريوحنا']]) {
    assert.ok(migration.includes(`'A reading from the Gospel according to our teacher Saint ${name} the Evangelist, and the pure disciple. May his blessings be with us all.'`), name);
    assert.ok(migration.includes(`'فصلٌ من بشارة الإنجيل لمعلمنا ${arabic} البشير، التلميذُ الطاهر، بركاتهُ على جميعنا.', 'Deacon', NULL, 'Gospel${name}'`), name);
  }
  assert.match(library, /cached = fetchSchemaTextRowsByKeys\(schema, \["gospelIntroduction"\]\);/);
});
