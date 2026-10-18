const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');

function compile(path) {
  return ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}

function load(path, stubs = {}) {
  const moduleObject = { exports: {} };
  new Function('exports', 'require', 'module', compile(path))(
    moduleObject.exports,
    (id) => (id in stubs ? stubs[id] : require(id)),
    moduleObject,
  );
  return moduleObject.exports;
}

function loadOutline(language = 'en') {
  const preferences = { getCurrentAppLanguage: () => language };
  const appText = load('src/utils/appText.ts', { './preferencesStorage': preferences });
  const localeFormat = load('src/utils/localeFormat.ts', { './preferencesStorage': preferences });
  const documentReadings = load('src/utils/documentReadings.ts');
  return load('src/utils/lectionaryOutline.ts', { './appText': appText, './documentReadings': documentReadings, './localeFormat': localeFormat });
}

const gospel = { kind: 'Gospel', english: 'Luke 4:1-13', arabic: 'لوقا 4:1-13', french: 'Luc 4,1-13' };
const psalm = { kind: 'Psalm', english: '23:1-4', arabic: '23:1-4' };
const isaiah = { kind: 'Prophecy', english: 'Isaiah 1:2-18', arabic: 'إشعياء 1:2-18' };
const job = { kind: 'Prophecy', english: 'Job 1:1-22', arabic: 'أيوب 1:1-22' };

test('the Liturgy reads its epistles, Acts, Psalm and Gospel in that order; the offices a Psalm and Gospel', () => {
  const { EXPECTED_READINGS, READING_LABELS } = loadOutline();
  assert.deepEqual(EXPECTED_READINGS.Liturgy, ['Pauline', 'Catholic', 'Praxis', 'Psalm', 'Gospel']);
  assert.deepEqual(EXPECTED_READINGS.Vespers, ['Psalm', 'Gospel']);
  assert.deepEqual(EXPECTED_READINGS.Matins, ['Psalm', 'Gospel']);
  for (const kind of Object.keys(EXPECTED_READINGS).flatMap((service) => EXPECTED_READINGS[service])) {
    assert.ok(READING_LABELS[kind], `${kind} has a label`);
  }
  assert.equal(READING_LABELS.Praxis.english, 'Acts');
});

test('a citation reads in the App Language, with Eastern digits in Arabic', () => {
  const citation = { kind: 'Gospel', english: 'Luke 4:1-13', arabic: 'لوقا 4:1-13', french: 'Luc 4,1-13' };
  assert.equal(loadOutline('en').citationText(citation, false), 'Luke 4:1-13');
  assert.equal(loadOutline('fr').citationText(citation, false), 'Luc 4,1-13');
  assert.equal(loadOutline('fr').citationText({ ...citation, french: undefined }, false), 'Luke 4:1-13');
  // With a right-to-left mark after each separator, so the numbers read in order (localeFormat.ts).
  assert.equal(loadOutline('ar').citationText(citation, true), 'لوقا ٤:\u200F١-\u200F١٣');
  const { numberedLabel, READING_LABELS } = loadOutline();
  assert.deepEqual(numberedLabel(READING_LABELS.Prophecy, 2), { english: 'Prophecy 2', arabic: 'النبوة ٢', french: 'Prophétie 2' });
  assert.equal(numberedLabel(READING_LABELS.Prophecy, null), READING_LABELS.Prophecy);
});

test('a service’s lines are its readings in order: the prophecies first and numbered, then the outline, known or not', () => {
  const { readingLinesFor } = loadOutline();
  const matins = readingLinesFor('Matins', [isaiah, job, psalm, gospel], false);
  assert.deepEqual(matins.map((line) => [line.key, line.kind, line.number, line.label.english, line.value]), [
    ['Prophecy-1', 'Prophecy', 1, 'Prophecy 1', 'Isaiah 1:2-18'],
    ['Prophecy-2', 'Prophecy', 2, 'Prophecy 2', 'Job 1:1-22'],
    ['Psalm', 'Psalm', 1, 'Psalm', '23:1-4'],
    ['Gospel', 'Gospel', 1, 'Gospel', 'Luke 4:1-13'],
  ]);
  // One prophecy is just "Prophecy"; none (outside Lent) is no line at all.
  assert.equal(readingLinesFor('Matins', [isaiah, psalm, gospel], false)[0].label.english, 'Prophecy');
  assert.deepEqual(readingLinesFor('Matins', [psalm, gospel], false).map((line) => line.key), ['Psalm', 'Gospel']);
  // Before the citations arrive (or when they can't), the outline stands with nothing beside it.
  assert.deepEqual(readingLinesFor('Liturgy', null, false).map((line) => [line.key, line.value]), [
    ['Pauline', null], ['Catholic', null], ['Praxis', null], ['Psalm', null], ['Gospel', null],
  ]);
  assert.deepEqual(readingLinesFor('Vespers', undefined, false).map((line) => line.key), ['Psalm', 'Gospel']);
  // In Arabic the citations carry Eastern digits.
  assert.equal(loadOutline('ar').readingLinesFor('Vespers', [psalm, gospel], true)[1].value, 'لوقا ٤:\u200F١-\u200F١٣');
});

test('Home folds several prophecies into one line that opens at the first', () => {
  const { readingLinesFor, withPropheciesAsOneLine } = loadOutline();
  const folded = withPropheciesAsOneLine(readingLinesFor('Matins', [isaiah, job, psalm, gospel], false));
  assert.deepEqual(folded.map((line) => [line.key, line.kind, line.number, line.label.english, line.value]), [
    ['Prophecies', 'Prophecy', 1, 'Prophecies', 'Isaiah 1:2-18 · Job 1:1-22'],
    ['Psalm', 'Psalm', 1, 'Psalm', '23:1-4'],
    ['Gospel', 'Gospel', 1, 'Gospel', 'Luke 4:1-13'],
  ]);
  // One prophecy, or none, is left as it is.
  const one = readingLinesFor('Matins', [isaiah, psalm, gospel], false);
  assert.deepEqual(withPropheciesAsOneLine(one), one);
  const none = readingLinesFor('Liturgy', null, false);
  assert.deepEqual(withPropheciesAsOneLine(none), none);
});

test('each reading opens its service at that reading', () => {
  const { lectionaryHref, LECTIONARY_ROUTE_IDS, LECTIONARY_SERVICES } = loadOutline();
  assert.deepEqual(LECTIONARY_SERVICES, ['Vespers', 'Matins', 'Liturgy']);
  assert.equal(lectionaryHref('Vespers'), '/lectionary/vespers');
  assert.equal(lectionaryHref('Vespers', { kind: 'Psalm', number: 1 }), '/lectionary/vespers?reading=Psalm');
  assert.equal(lectionaryHref('Matins', { kind: 'Prophecy', number: 2 }), '/lectionary/matins?reading=Prophecy-2');
  assert.equal(lectionaryHref('Liturgy', { kind: 'Catholic', number: 1 }), '/lectionary/liturgy?reading=Catholic');
  // The routes are the manifest's lectionary entries.
  const manifest = fs.readFileSync('src/constants/manifest.ts', 'utf8');
  for (const id of Object.values(LECTIONARY_ROUTE_IDS)) assert.match(manifest, new RegExp(`\\{ id: '${id}', schema: 'liturgy', table: 'lectionary_${id}'`));
  // The menu's rows open at their reading; so do Home's.
  const menu = fs.readFileSync('src/components/vine/screens/LectionaryMenu.tsx', 'utf8');
  assert.match(menu, /onPress=\{\(\) => openReading\(service, line\)\}/);
  assert.match(menu, /router\.push\(lectionaryHref\(service, line\) as never\)/);
  assert.match(menu, /readingLinesFor\(service, today\?\.citations\[service\], arabic\)/);
  assert.doesNotMatch(menu, /const READING_LABELS|const linesFor/);
  const home = fs.readFileSync('src/components/vine/screens/HomeScreen.tsx', 'utf8');
  assert.match(home, /router\.push\(lectionaryHref\(shownReadings\.service, line\) as never\)/);
});

test('Home shows every service’s readings for the rite’s day, each opening its service', () => {
  const home = fs.readFileSync('src/components/vine/screens/HomeScreen.tsx', 'utf8');
  // From the evening the readings shown are the next morning's, as the Lectionary itself does.
  assert.match(home, /const readingsDate = livePeriod === 'evening' \? tomorrow : liveDate;/);
  assert.match(home, /LECTIONARY_SERVICES\.map\(\(service\) =>/);
  assert.match(home, /withPropheciesAsOneLine\(readingLinesFor\(service, dayReadings\?\.citations\?\.\[service\], arabic\)\)/);
  // One service shows at a time, chosen on the card's pill; the card's head opens the Lectionary.
  assert.match(home, /segment\(serviceReadings\.map\(\(\{ service, title \}\) => \(\{ key: service, label: title \}\)\), shownReadings\.service, setReadingsService\)/);
  assert.match(home, /router\.push\('\/lectionary' as never\)/);
  assert.doesNotMatch(home, /'\/lectionary\/liturgy'/);
  // A day whose readings could not be loaded keeps the outline, with a dash where a citation would be.
  assert.match(home, /line\.value \?\? \(dayReadings \? null : '…'\)/);
  // The menu and Home read the same outline, so they can never disagree on it.
  const menu = fs.readFileSync('src/components/vine/screens/LectionaryMenu.tsx', 'utf8');
  assert.match(menu, /from '\.\.\/\.\.\/\.\.\/utils\/lectionaryOutline'/);
  assert.doesNotMatch(menu, /const READING_LABELS/);
});
