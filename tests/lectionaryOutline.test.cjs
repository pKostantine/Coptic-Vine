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
  return load('src/utils/lectionaryOutline.ts', { './appText': appText, './localeFormat': localeFormat });
}

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
  assert.equal(loadOutline('ar').citationText(citation, true), 'لوقا ٤:١-١٣');
  const { numberedLabel, READING_LABELS } = loadOutline();
  assert.deepEqual(numberedLabel(READING_LABELS.Prophecy, 2), { english: 'Prophecy 2', arabic: 'النبوة ٢', french: 'Prophétie 2' });
  assert.equal(numberedLabel(READING_LABELS.Prophecy, null), READING_LABELS.Prophecy);
});

test('Home shows the Liturgy’s readings for the rite’s day and opens the Lectionary’s Liturgy', () => {
  const home = fs.readFileSync('src/components/vine/screens/HomeScreen.tsx', 'utf8');
  // From the evening the readings shown are the next morning's, as the Lectionary itself does.
  assert.match(home, /const readingsDate = livePeriod === 'evening' \? tomorrow : liveDate;/);
  assert.match(home, /EXPECTED_READINGS\.Liturgy\.map/);
  assert.match(home, /router\.push\('\/lectionary\/liturgy' as never\)/);
  // A day whose readings could not be loaded keeps the outline, with a dash where a citation would be.
  assert.match(home, /liturgyReadings \? null : '…'/);
  // The menu and Home read the same outline, so they can never disagree on it.
  const menu = fs.readFileSync('src/components/vine/screens/LectionaryMenu.tsx', 'utf8');
  assert.match(menu, /from '\.\.\/\.\.\/\.\.\/utils\/lectionaryOutline'/);
  assert.doesNotMatch(menu, /const READING_LABELS/);
});
