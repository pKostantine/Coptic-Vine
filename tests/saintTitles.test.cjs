const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');

const javascript = ts.transpileModule(fs.readFileSync('src/utils/saintTitles.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleObject = { exports: {} };
new Function('exports', 'require', 'module', javascript)(moduleObject.exports, require, moduleObject);
const { splitSaintTitle } = moduleObject.exports;

test('a saint is set over who they were', () => {
  assert.deepEqual(splitSaintTitle('The Departure of St. Agathon, 39th Pope of Alexandria'), { main: 'The Departure of St. Agathon', detail: '39th Pope of Alexandria' });
  assert.deepEqual(splitSaintTitle('The Martyrdom of St. Dionysius, Bishop of Corinth'), { main: 'The Martyrdom of St. Dionysius', detail: 'Bishop of Corinth' });
  assert.deepEqual(splitSaintTitle('The Martyrdom of St. Maurice, the Leader of the Theban Legion'), { main: 'The Martyrdom of St. Maurice', detail: 'The Leader of the Theban Legion' });
  assert.deepEqual(splitSaintTitle('The Martyrdom of St. Mina, in the City of Quos'), { main: 'The Martyrdom of St. Mina', detail: 'In the City of Quos' });
});

test('an epithet stays with the name, and a list of names is never split', () => {
  for (const title of [
    'The Departure of St. Bessarion, the Great',
    'The Nativity of St. John, the Baptist',
    'The Commemoration of Sts. Carpus, Apollo and Peter',
    'The Martyrdom of Sts. Valerian and Tiburtius, His Brother',
    'The Departure of St. Agathon',
  ]) {
    assert.deepEqual(splitSaintTitle(title), { main: title, detail: null }, title);
  }
});
