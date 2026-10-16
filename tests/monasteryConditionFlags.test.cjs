const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');

function loadUserFlags() {
  const source = fs.readFileSync('src/utils/userConditionFlags.ts', 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const moduleObject = { exports: {} };
  new Function('exports', 'module', 'require', transpiled)(
    moduleObject.exports, moduleObject, require,
  );
  return moduleObject.exports.getUserConditionFlags;
}

function loadEvaluator() {
  const source = fs.readFileSync('src/utils/conditionEngine.js', 'utf8')
    .replace(/^import .*;\r?\n/gm, '')
    .replace(/^export /gm, '');
  return new Function(source + '\nreturn { evaluateCondition };')().evaluateCondition;
}

test('In Monastery OFF keeps the Monastery flag false', () => {
  const getUserConditionFlags = loadUserFlags();
  const evaluateCondition = loadEvaluator();
  const flags = getUserConditionFlags({ selectedSaintHymns: [], inMonastery: false });
  assert.equal(flags.Monastery, false);
  assert.equal(evaluateCondition('Monastery', flags), false);
  assert.equal(evaluateCondition('!Monastery', flags), true);
  assert.equal(evaluateCondition('!GreatFeasts && Monastery', flags), false);
});

test('In Monastery ON activates Monastery-conditioned prayer in both service contexts', () => {
  const getUserConditionFlags = loadUserFlags();
  const evaluateCondition = loadEvaluator();
  const flags = getUserConditionFlags({ selectedSaintHymns: [], inMonastery: true });
  assert.equal(flags.Monastery, true);
  // The Vespers Praises Prayer of the Veil also checks the feast calendar.
  assert.equal(evaluateCondition('!GreatFeasts && Monastery', flags), true);
  // The Liturgy Agpeya Prayer of the Veil also checks seasonal eligibility.
  assert.equal(evaluateCondition(
    'Monastery && (LentWeekdays || JonahsFast || ((NativityParamoun || TheophanyParamoun) && !Weekends))',
    { ...flags, LentWeekdays: true },
  ), true);
  assert.equal(evaluateCondition('Monastery && LentWeekdays', flags), false);
});

test('Monastery flag remains controlled by its toggle independently of saint hymns', () => {
  const getUserConditionFlags = loadUserFlags();
  const selectedSaintHymns = ['StMark:VOC', 'StStephen:Doxology1'];
  const enabled = getUserConditionFlags({ selectedSaintHymns, inMonastery: true });
  const disabled = getUserConditionFlags({ selectedSaintHymns, inMonastery: false });
  assert.equal(enabled.Monastery, true);
  assert.equal(disabled.Monastery, false);
  for (const saint of selectedSaintHymns) {
    assert.equal(enabled[saint], true);
    assert.equal(disabled[saint], true);
  }
});

test('the document uses the toggle flags after route-specific context', () => {
  const source = fs.readFileSync('src/components/vine/screens/ServiceDocument.tsx', 'utf8');
  assert.match(source, /getUserConditionFlags\(preferences\)/);
  assert.match(
    source,
    /\.\.\.epistleFlags,\s*\.\.\.extraContext,\s*\.\.\.userConditionFlags/,
  );
});

test('Saint Psalies on the Saint Hymns page raises SaintPsalies, and only when on', () => {
  const getUserConditionFlags = loadUserFlags();
  const evaluateCondition = loadEvaluator();
  const on = getUserConditionFlags({ selectedSaintHymns: [], inMonastery: false, saintPsalies: true });
  const off = getUserConditionFlags({ selectedSaintHymns: [], inMonastery: false, saintPsalies: false });
  assert.equal(evaluateCondition('SaintPsalies', on), true);
  assert.equal(evaluateCondition('SaintPsalies', off), false);
  // An installation from before the switch has no value: off.
  assert.equal(evaluateCondition('SaintPsalies', getUserConditionFlags({ selectedSaintHymns: [], inMonastery: false })), false);
  const screen = fs.readFileSync('src/components/vine/screens/ServiceDocument.tsx', 'utf8');
  assert.match(screen, /\[preferences\.selectedSaintHymns, preferences\.inMonastery, preferences\.saintPsalies\]/);
  const storage = fs.readFileSync('src/utils/preferencesStorage.ts', 'utf8');
  assert.match(storage, /\| 'saintPsalies'/);
  assert.match(storage, /saintPsalies: booleanValue\(cloud\.saintPsalies, local\.saintPsalies\),/);
  const picker = fs.readFileSync('src/components/vine/ui/SaintHymnPicker.tsx', 'utf8');
  assert.match(picker, /active=\{preferences\.saintPsalies === true\}\n\s+onPress=\{toggleSaintPsalies\}/);
});
