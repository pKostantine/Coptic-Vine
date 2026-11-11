const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');

function load(path) {
  const source = fs.readFileSync(path, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const module = { exports: {} };
  new Function('exports', 'module', 'require', outputText)(module.exports, module, require);
  return module.exports;
}

const read = (path) => fs.readFileSync(path, 'utf8');

const left = (overrides = {}) => ({
  key: 'liturgy:basil:2026-11-11',
  href: '/liturgy/basil?at=2026-11-11',
  title: { english: 'Liturgy of St Basil', arabic: 'قداس القديس باسيليوس' },
  sectionId: 'gospel',
  verseIndex: 7,
  sections: [{ id: 'opening', hymnKey: 'opening' }, { id: 'gospel', hymnKey: 'gospel' }],
  signature: 'sig-1',
  ...overrides,
});

test('a document left going back can be returned to from the page it was left for', () => {
  const store = load('src/utils/returnToDocument.ts');
  store.rememberLeftDocument(left());
  // Until the app arrives somewhere else, nothing is offered.
  store.settleLeftDocument('/liturgy/basil');
  assert.equal(store.returnableDocument('/liturgy'), null);
  store.settleLeftDocument('/liturgy');
  assert.equal(store.returnableDocument('/liturgy').sectionId, 'gospel');
  assert.equal(store.returnableDocument('/'), null, 'only from the page it was left for');
  const taken = store.takeLeftDocument('/liturgy');
  assert.equal(taken.verseIndex, 7);
  assert.equal(store.returnableDocument('/liturgy'), null, 'taken once');
});

test('told twice as it goes, the document keeps the page it landed on', () => {
  const store = load('src/utils/returnToDocument.ts');
  store.rememberLeftDocument(left());
  store.settleLeftDocument('/liturgy');
  store.rememberLeftDocument(left({ verseIndex: 9 }));
  assert.equal(store.returnableDocument('/liturgy').verseIndex, 9);
  store.rememberLeftDocument(left({ key: 'other', href: '/agpeya/prime' }));
  assert.equal(store.returnableDocument('/liturgy'), null, 'another document starts afresh');
});

test('going on to any other page lets the document go', () => {
  const store = load('src/utils/returnToDocument.ts');
  store.rememberLeftDocument(left());
  store.settleLeftDocument('/liturgy');
  store.settleLeftDocument('/liturgy');
  assert.ok(store.returnableDocument('/liturgy'), 'the same page again keeps it');
  store.settleLeftDocument('/settings');
  assert.equal(store.returnableDocument('/settings'), null);
  store.settleLeftDocument('/liturgy');
  assert.equal(store.returnableDocument('/liturgy'), null, 'and it does not come back');
});

test('the document opened again some other way lets it go', () => {
  const store = load('src/utils/returnToDocument.ts');
  store.rememberLeftDocument(left());
  store.settleLeftDocument('/liturgy');
  store.settleLeftDocument('/liturgy/basil');
  assert.equal(store.returnableDocument('/liturgy'), null);
  assert.equal(store.hrefPath('/a/b?x=1#y'), '/a/b');
});

test('reopening a document sends it back to the hymn and verse it was left at', () => {
  const positions = load('src/utils/lastDocumentPosition.ts');
  const key = 'doc';
  positions.openDocumentPosition(key);
  positions.forgetDocumentPosition(key);
  // Forgotten: a stray report must not bring it back.
  positions.setLastDocumentPosition(key, 'psalm');
  assert.equal(positions.getLastDocumentPosition(key), undefined);
  positions.reopenDocumentAt(key, 'gospel', ['opening', 'gospel'], 'sig-1', 4);
  const pending = positions.getPendingDocumentRestore(key);
  assert.equal(pending.sectionId, 'gospel');
  assert.equal(pending.verseIndex, 4);
  assert.equal(pending.signature, 'sig-1');
  assert.equal(pending.dirty, true, 'the new reader is sent there, not taken to be there');
  assert.equal(positions.getLastDocumentPosition(key), 'gospel');
});

test('the document screen remembers itself when backed out of, not when replaced', () => {
  const screen = read('src/components/vine/screens/ServiceDocument.tsx');
  assert.match(screen, /rememberLeftDocument\(/);
  assert.match(screen, /leavingBackRef\.current = true;\s*\n?\s*goBack\(/);
  assert.match(screen, /replacedRef\.current = true;[\s\S]{0,200}router\.replace\(/);
  assert.match(screen, /GO_BACK|POP/);
});

test('the swipe wraps the app, and goes back in through reopenDocumentAt', () => {
  const layout = read('src/app/_layout.tsx');
  assert.match(layout, /<ReturnToDocumentSwipe>\s*<AppStack \/>\s*<\/ReturnToDocumentSwipe>/);
  const swipe = read('src/components/vine/ui/ReturnToDocumentSwipe.tsx');
  assert.match(swipe, /settleLeftDocument\(pathname\)/);
  assert.match(swipe, /takeLeftDocument\(pathname\)[\s\S]*reopenDocumentAt\([\s\S]*router\.push\(/);
  assert.match(swipe, /gesture\.dx < -14/, 'only a swipe to the left claims the gesture');
  assert.match(swipe, /touchAction: 'pan-y'/, 'the web browser leaves the sideways touch to it');
  assert.match(swipe, /onPanResponderTerminationRequest: \(\) => false/);
});
