const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');

function load(path) {
  const js = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('exports', 'require', 'module', js)(module.exports, require, module);
  return module.exports;
}

const {
  DEFAULT_SELECTED_INTERPRETATIONS,
  INTERPRETATION_CHOOSER_SECTION_ID,
  KIAHK_INTERPRETATIONS,
  interpretationIdForHymnKey,
  normalizeSelectedInterpretations,
  toggleSelectedInterpretation,
  withInterpretationChoices,
} = load('src/utils/kiahkInterpretations.ts');

test('the twelve interpretations, named in every App Language, the Greek, Mo3akab and first of Gabriel chosen by default', () => {
  assert.equal(KIAHK_INTERPRETATIONS.length, 12);
  for (const interpretation of KIAHK_INTERPRETATIONS) {
    assert.ok(interpretation.name.english && interpretation.name.french && interpretation.name.arabic, interpretation.id);
  }
  assert.deepEqual([...DEFAULT_SELECTED_INTERPRETATIONS], ['greekRoumy', 'mo3akab', 'firstGabriel']);
});

test('a hymn key is an interpretation only as its prefix and a Theotokia number', () => {
  assert.equal(interpretationIdForHymnKey('greekRoumyInterpretation1'), 'greekRoumy');
  assert.equal(interpretationIdForHymnKey('firstInterpretationOfCantorGabrielOfQay9'), 'firstGabriel');
  assert.equal(interpretationIdForHymnKey('secondInterpretationOfCantorGabrielOfQay4'), 'secondGabriel');
  assert.equal(interpretationIdForHymnKey('interpretationOfElBardanohee7'), 'elBardanohee');
  assert.equal(interpretationIdForHymnKey('theSaturdayTheotokia1'), null);
  assert.equal(interpretationIdForHymnKey('greekRoumyInterpretation'), null);
  assert.equal(interpretationIdForHymnKey(undefined), null);
});

test('a stored or synced choice keeps known ids, in order, once; anything not a list is the default; none is a choice', () => {
  assert.deepEqual(normalizeSelectedInterpretations(['firstGabriel', 'greekRoumy', 'nope', 'greekRoumy']), ['greekRoumy', 'firstGabriel']);
  assert.deepEqual(normalizeSelectedInterpretations([]), []);
  assert.deepEqual(normalizeSelectedInterpretations(undefined), ['greekRoumy', 'mo3akab', 'firstGabriel']);
  assert.deepEqual(toggleSelectedInterpretation(['greekRoumy'], 'egyptian'), ['greekRoumy', 'egyptian']);
  assert.deepEqual(toggleSelectedInterpretation(['greekRoumy', 'egyptian'], 'greekRoumy'), ['egyptian']);
});

test('the document keeps the chosen interpretations, with the button just before the Conclusion of the Vatos Psali', () => {
  const section = (hymnKey) => ({ id: hymnKey, hymnKey });
  const sections = [
    section('psalm116'), section('conclusionOfTheVatosPsali'),
    section('theSaturdayTheotokia1'), section('greekRoumyInterpretation1'), section('mo3akabInterpretation1'), section('egyptianInterpretation1'),
    section('theSaturdayTheotokia2'), section('greekRoumyInterpretation2'), section('egyptianInterpretation2'),
  ];
  const chooser = () => ({ id: INTERPRETATION_CHOOSER_SECTION_ID, hymnKey: 'selectInterpretations' });
  const ids = (list) => list.map((entry) => entry.id);
  assert.deepEqual(ids(withInterpretationChoices(sections, ['egyptian'], chooser)), [
    'psalm116', INTERPRETATION_CHOOSER_SECTION_ID, 'conclusionOfTheVatosPsali',
    'theSaturdayTheotokia1', 'egyptianInterpretation1', 'theSaturdayTheotokia2', 'egyptianInterpretation2',
  ]);
  // Without the conclusion, the button stands before the first interpretation.
  assert.deepEqual(ids(withInterpretationChoices(sections.slice(2), [], chooser)), [
    'theSaturdayTheotokia1', INTERPRETATION_CHOOSER_SECTION_ID, 'theSaturdayTheotokia2',
  ]);
  // A document without interpretations is left as it was, with no button.
  assert.deepEqual(ids(withInterpretationChoices([section('psalm116'), section('conclusionOfTheVatosPsali')], [], chooser)), ['psalm116', 'conclusionOfTheVatosPsali']);
});

test('the choice is synced with the account and changes the document in place, keeping the reader\'s place', () => {
  const storage = fs.readFileSync('src/utils/preferencesStorage.ts', 'utf8');
  assert.match(storage, /\| 'selectedInterpretations'/);
  assert.match(storage, /selectedInterpretations: preferences\.selectedInterpretations,/);
  assert.match(storage, /selectedInterpretations: Array\.isArray\(cloud\.selectedInterpretations\)/);
  const screen = fs.readFileSync('src/components/vine/screens/ServiceDocument.tsx', 'utf8');
  assert.match(screen, /withInterpretationChoices<DocumentSection>\(/);
  assert.match(screen, /preferences\.selectedSaintHymns, preferences\.selectedInterpretations,/);
  assert.match(screen, /const before = previousSectionsRef\.current \?\? sections;/);
  assert.match(screen, /if \(action\.type === 'openInterpretations'\)/);
  assert.match(screen, /onOpenInterpretations=\{\(\) => setInterpretationsOpen\(true\)\}/);
});
