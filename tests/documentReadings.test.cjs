const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');

function compile(path) {
  return ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}

function load(path) {
  const moduleObject = { exports: {} };
  new Function('exports', 'require', 'module', compile(path))(moduleObject.exports, require, moduleObject);
  return moduleObject.exports;
}

const { findReadingSectionId, parseReadingParam, readingParam, READING_TYPE_BY_KIND } = load('src/utils/documentReadings.ts');

const everything = { displaySilentPrayers: true, bishopPresent: true, copticGospelRite: true };
const plain = { displaySilentPrayers: false, bishopPresent: false, copticGospelRite: false };

/** A citation line as hymnLibrary's readingReferenceVerse builds it. */
const cites = (service, readingType, text, extra = {}) =>
  ({ type: 'readingReference', english: text, arabic: text, french: text, coptic: '', reading: { service, readingType }, ...extra });
const line = (english) => ({ type: 'text', english, arabic: english, coptic: '' });
const section = (id, verses, extra = {}) => ({ id, title: { english: id, arabic: '' }, verses, ...extra });

test('the reading URL parameter names a kind, and which one when several are read', () => {
  assert.deepEqual(parseReadingParam('Psalm'), { kind: 'Psalm', number: 1 });
  assert.deepEqual(parseReadingParam('Prophecy-2'), { kind: 'Prophecy', number: 2 });
  assert.deepEqual(parseReadingParam('catholic'), { kind: 'Catholic', number: 1 });
  for (const bad of [undefined, null, '', 'Sermon', 'Prophecy-0', 'Prophecy-x', ['Psalm'], 7]) {
    assert.equal(parseReadingParam(bad), null, String(bad));
  }
  assert.equal(readingParam({ kind: 'Psalm', number: 1 }), 'Psalm');
  assert.equal(readingParam({ kind: 'Prophecy', number: 2 }), 'Prophecy-2');
  for (const kind of Object.keys(READING_TYPE_BY_KIND)) {
    assert.deepEqual(parseReadingParam(readingParam({ kind, number: 3 })), { kind, number: 3 });
  }
  // What the citation lines are tagged with: reading_rules' own reading_type.
  assert.equal(READING_TYPE_BY_KIND.Pauline, 'Pauline Epistle');
  assert.equal(READING_TYPE_BY_KIND.Praxis, 'Praxis');
});

test('a reading opens at the shown section whose own lines cite it', () => {
  // A Vespers as the Gospel rite shapes it: the Coptic Psalm only with the
  // toggle on, the English Psalm only with it off, the Gospel either way.
  const vespers = [
    section('intro', [line('Stand up for the reading')]),
    section('copticPsalm', [cites('Vespers', 'Psalm', 'Psalm 23:1-4'), line('…')], { copticGospelRiteOnly: true }),
    section('introductionAndPsalm', [line('From the Psalms of David'), cites('Vespers', 'Psalm', 'Psalm 23:1-4'), line('…')], { nonCopticGospelRiteOnly: true }),
    section('gospelIntro', [line('Blessed is He who comes')]),
    section('gospel', [cites('Vespers', 'Gospel', 'Luke 4:1-13'), line('…')]),
    section('response', [line('Glory be to God forever')]),
  ];
  assert.equal(findReadingSectionId(vespers, { kind: 'Psalm', number: 1 }, plain), 'introductionAndPsalm');
  assert.equal(findReadingSectionId(vespers, { kind: 'Psalm', number: 1 }, { ...plain, copticGospelRite: true }), 'copticPsalm');
  assert.equal(findReadingSectionId(vespers, { kind: 'Gospel', number: 1 }, plain), 'gospel');
  // A reading the document doesn't have, or a second of a kind it reads once.
  assert.equal(findReadingSectionId(vespers, { kind: 'Pauline', number: 1 }, plain), null);
  assert.equal(findReadingSectionId(vespers, { kind: 'Gospel', number: 2 }, plain), null);
  // A line of a section shown either way can itself belong to one state.
  const splitHymn = [
    section('psalmAndGospel', [cites('Matins', 'Psalm', 'Psalm 1:1', { copticGospelRiteOnly: true }), line('…')]),
    section('psalmLater', [cites('Matins', 'Psalm', 'Psalm 1:1', { nonCopticGospelRiteOnly: true })]),
  ];
  assert.equal(findReadingSectionId(splitHymn, { kind: 'Psalm', number: 1 }, plain), 'psalmLater');
  assert.equal(findReadingSectionId(splitHymn, { kind: 'Psalm', number: 1 }, { ...plain, copticGospelRite: true }), 'psalmAndGospel');
});

test('the Lenten prophecies are numbered as read, with the Coptic ones behind their button not counted', () => {
  const copticProphecies = section('COPTIC_PROPHECY', [], {
    isSubdocumentButton: true,
    subdocumentSections: [1, 2, 3].map((n) => section(`coptic-${n}`, [cites('Matins', 'Prophecy', `Reading ${n}`)])),
  });
  const matins = [
    copticProphecies,
    section('prophecies-prophecy-1', [line('From Isaiah the prophet'), cites('Matins', 'Prophecy', 'Isaiah 1:2-18')]),
    section('prophecies-prophecy-2', [line('From Job'), cites('Matins', 'Prophecy', 'Job 1:1-22')]),
    section('prophecies-prophecy-3', [line('From Proverbs'), cites('Matins', 'Prophecy', 'Proverbs 1:1-9')]),
    section('psalm', [cites('Matins', 'Psalm', 'Psalm 50:1-3')]),
    section('gospel', [cites('Matins', 'Gospel', 'Matthew 6:1-18')]),
  ];
  assert.equal(findReadingSectionId(matins, { kind: 'Prophecy', number: 1 }, everything), 'prophecies-prophecy-1');
  assert.equal(findReadingSectionId(matins, { kind: 'Prophecy', number: 3 }, everything), 'prophecies-prophecy-3');
  assert.equal(findReadingSectionId(matins, { kind: 'Prophecy', number: 4 }, everything), null);
  assert.equal(findReadingSectionId(matins, { kind: 'Gospel', number: 1 }, everything), 'gospel');
  // A reading kept only behind a button opens at the button, whichever of them is asked for.
  const copticOnly = [section('hymn', [line('…')]), copticProphecies, section('psalm', [cites('Matins', 'Psalm', 'Psalm 50:1-3')])];
  assert.equal(findReadingSectionId(copticOnly, { kind: 'Prophecy', number: 1 }, everything), 'COPTIC_PROPHECY');
  assert.equal(findReadingSectionId(copticOnly, { kind: 'Prophecy', number: 2 }, everything), 'COPTIC_PROPHECY');
});

test('a reading the settings hide is not where the document opens', () => {
  const liturgy = [
    section('bishopPauline', [cites('Pauline', 'Pauline Epistle', 'Romans 1:1-7')], { bishopOnly: true }),
    section('pauline', [cites('Pauline', 'Pauline Epistle', 'Romans 1:1-7')], { priestOnly: true }),
    section('silentCatholic', [cites('Catholic', 'Catholic Epistle', '1 Peter 1:1-9')], { titlePrayerType: 'Silent Prayer' }),
    section('catholic', [cites('Catholic', 'Catholic Epistle', '1 Peter 1:1-9')]),
    section('praxis', [cites('Praxis', 'Praxis', 'Acts 2:1-13')]),
  ];
  assert.equal(findReadingSectionId(liturgy, { kind: 'Pauline', number: 1 }, plain), 'pauline');
  assert.equal(findReadingSectionId(liturgy, { kind: 'Pauline', number: 1 }, { ...plain, bishopPresent: true }), 'bishopPauline');
  assert.equal(findReadingSectionId(liturgy, { kind: 'Catholic', number: 1 }, plain), 'catholic');
  assert.equal(findReadingSectionId(liturgy, { kind: 'Catholic', number: 1 }, everything), 'silentCatholic');
  assert.equal(findReadingSectionId(liturgy, { kind: 'Praxis', number: 1 }, plain), 'praxis');
  // A citation line nobody tagged (a document hydrated before this) is not a reading to open at.
  const untagged = [section('old', [{ type: 'readingReference', english: 'Acts 2:1-13', arabic: '', coptic: '' }])];
  assert.equal(findReadingSectionId(untagged, { kind: 'Praxis', number: 1 }, plain), null);
});

test('every citation line hymnLibrary builds says which reading it is', () => {
  const source = fs.readFileSync('src/utils/hymnLibrary.js', 'utf8');
  // The one place a citation line is made…
  assert.equal((source.match(/type: "readingReference"/g) || []).length, 1, 'citation lines are built by readingReferenceVerse alone');
  // …used for a sentinel spliced into a hymn, one that is its own section, and a Pascha hour's epistle.
  assert.equal((source.match(/(?<!function )readingReferenceVerse\(citation, /g) || []).length, 3);
  // And it is run here as written: a citation with its reading, and a reading with no citation to show.
  const start = source.indexOf('function readingIdentity(');
  const end = source.indexOf('/** A sentinel\'s verses and citation', start);
  assert.ok(start > 0 && end > start);
  const { readingIdentity, readingReferenceVerse } = new Function(`${source.slice(start, end)}\nreturn { readingIdentity, readingReferenceVerse };`)();
  assert.deepEqual(readingIdentity({ service: 'Vespers', reading_type: 'Psalm', reading_reference: '19.23.1-4' }), { service: 'Vespers', readingType: 'Psalm' });
  assert.deepEqual(readingIdentity({ reading_type: 'Prophecy' }), { service: null, readingType: 'Prophecy' });
  assert.equal(readingIdentity(null), null);
  const [verse] = readingReferenceVerse({ english: 'Luke 4:1-13', arabic: 'لوقا 4:1-13' }, { service: 'Vespers', readingType: 'Gospel' });
  assert.deepEqual(verse, { type: 'readingReference', english: 'Luke 4:1-13', arabic: 'لوقا 4:1-13', french: 'Luke 4:1-13', coptic: '', reading: { service: 'Vespers', readingType: 'Gospel' } });
  assert.deepEqual(readingReferenceVerse(null, { service: 'Vespers', readingType: 'Gospel' }), []);
  assert.equal('reading' in readingReferenceVerse({ english: 'Luke 4:1-13', arabic: '' }, null)[0], false);
  // Every way a sentinel resolves says which reading it was.
  const resolver = source.slice(source.indexOf('async function resolveReadingSentinelVerses('), source.indexOf('// A nested reading sentinel that becomes its own section'));
  assert.equal((resolver.match(/reading: /g) || []).length, 5, 'each return names its reading (or none)');
  assert.match(fs.readFileSync('src/components/vine/documentHtml.ts', 'utf8'), /reading\?: \{ service: string \| null; readingType: string \| null \};/);
});

test('the service document opens at the reading its URL names, once, and not when coming back from Settings', () => {
  const source = fs.readFileSync('src/components/vine/screens/ServiceDocument.tsx', 'utf8');
  assert.match(source, /useLocalSearchParams<\{ sub\?: string; reading\?: string \}>\(\)/);
  // Decided as the sections arrive, so the reader mounts knowing where to land.
  const start = source.indexOf('setLoadedConditionsKey(conditionsKey);');
  const end = source.indexOf('setSubdocumentModal((current) =>', start);
  assert.ok(start > 0 && end > start);
  const arrival = source.slice(start, end);
  assert.match(arrival, /const readingTarget = openedAtReadingRef\.current \? null : parseReadingParam\(openAtReading\);/);
  assert.match(arrival, /openedAtReadingRef\.current = true;\s+const sectionId = getPendingDocumentRestore\(documentPositionKey\)\s+\? null\s+: findReadingSectionId\(newSections, readingTarget, readingVisibilityRef\.current\);/);
  // Both readers: the slideshow's selected slide, the scrolling reader's first-load section, the remembered place.
  assert.match(arrival, /setCurrentSectionId\(sectionId\);\s+setSelectedSlideSectionId\(sectionId\);\s+setLastDocumentPosition\(documentPositionKey, sectionId\);/);
  assert.match(arrival, /pendingScrollRestoreSectionIdRef\.current = sectionId;/);
  // The scrolling reader seeds its first load from the current section.
  assert.match(source, /initialScrollSectionId=\{restoreRequest\?\.target\.sectionId \?\? currentSectionId \?\? getLastDocumentPosition\(documentPositionKey\)\}/);
  // What the settings show is kept current for that decision without re-hydrating on it.
  assert.match(source, /readingVisibilityRef\.current = \{ displaySilentPrayers: preferences\.displaySilentPrayers, bishopPresent: preferences\.bishopPresent, copticGospelRite \};/);
});
