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

/** A browser's localStorage, remembering what was written. */
function fakeWebStorage(initial = {}) {
  const data = { ...initial };
  const storage = {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => { data[key] = String(value); },
    removeItem: (key) => { delete data[key]; },
  };
  Object.defineProperty(globalThis, 'window', { value: { localStorage: storage }, configurable: true, writable: true });
  return data;
}

/** recentDocuments.ts on the web, with the manifest's categories reduced to what the tests name. */
function loadRecents() {
  return load('src/utils/recentDocuments.ts', {
    'react-native': { Platform: { OS: 'web' } },
    '../constants/manifest': {
      CATEGORIES: [
        { id: 'psalmody', title: 'Psalmody', arabic: 'الإبصلمودية', french: 'Psalmodie' },
        { id: 'bible', title: 'Bible', arabic: 'الكتاب المقدس', french: 'Bible' },
      ],
    },
  });
}

const vespers = { key: 'psalmody:vespers_praises', href: '/psalmody/vespers_praises', title: { english: 'Vespers Praises', arabic: 'تسبحة عشية', french: 'Louanges du soir' }, book: { english: 'Psalmody', arabic: 'الإبصلمودية', french: 'Psalmodie' } };
const genesis = { key: 'bible:genesis:1', href: '/bible/genesis/1', title: { english: 'Genesis 1', arabic: 'التكوين ١' }, book: { english: 'Bible', arabic: 'الكتاب المقدس', french: 'Bible' } };

test('a document opened again moves to the head rather than appearing twice, and the list is capped', () => {
  const { withRecentDocument, MAX_RECENT_DOCUMENTS } = loadRecents();
  let list = withRecentDocument([], { ...vespers, openedAt: 1 });
  list = withRecentDocument(list, { ...genesis, openedAt: 2 });
  list = withRecentDocument(list, { ...vespers, openedAt: 3 });
  assert.deepEqual(list.map((entry) => entry.key), ['psalmody:vespers_praises', 'bible:genesis:1']);
  assert.equal(list[0].openedAt, 3);

  for (let index = 0; index < MAX_RECENT_DOCUMENTS + 3; index += 1) {
    list = withRecentDocument(list, { ...genesis, key: `k${index}`, openedAt: 10 + index });
  }
  assert.equal(list.length, MAX_RECENT_DOCUMENTS);
  assert.equal(list[0].key, `k${MAX_RECENT_DOCUMENTS + 2}`, 'the newest is first');
});

test('whatever is in storage is read defensively: bad entries dropped, duplicates collapsed, newest first', () => {
  const { normalizeRecentDocuments } = loadRecents();
  const list = normalizeRecentDocuments([
    { ...genesis, openedAt: 5 },
    'garbage',
    { key: '', href: '/x', title: genesis.title, book: genesis.book, openedAt: 1 },
    { key: 'no-slash', href: 'bible/genesis/1', title: genesis.title, book: genesis.book, openedAt: 1 },
    { key: 'bad-title', href: '/x', title: { english: 1 }, book: genesis.book, openedAt: 1 },
    { ...vespers, openedAt: 9 },
    { ...vespers, openedAt: 2 },
    { ...genesis, key: 'no-date', openedAt: 'yesterday' },
  ]);
  assert.deepEqual(list.map((entry) => [entry.key, entry.openedAt]), [['psalmody:vespers_praises', 9], ['bible:genesis:1', 5]]);
  assert.deepEqual(normalizeRecentDocuments(null), []);
  assert.deepEqual(normalizeRecentDocuments({ key: 'object-not-array' }), []);
});

test('a route is filed under the book the shelf names it by', () => {
  const { bookForPath } = loadRecents();
  assert.equal(bookForPath('/psalmody/vespers_praises').french, 'Psalmodie');
  assert.equal(bookForPath('/bible/genesis/1').english, 'Bible');
  assert.deepEqual(bookForPath('/somewhere/else'), { english: 'Books', arabic: 'الكتب', french: 'Livres' });
});

test('recording a visit persists it, and what was stored comes back beneath it', async () => {
  const data = fakeWebStorage({ 'chc-recent-documents': JSON.stringify([{ ...genesis, openedAt: 100 }]) });
  const recents = loadRecents();
  const seen = [];
  const unsubscribe = (() => {
    // useSyncExternalStore is not run here; subscribe through the same path it
    // would use, by recording and reading the snapshot after the load settles.
    return () => {};
  })();
  recents.recordRecentDocument({ ...vespers, openedAt: 200 });
  // Recorded before the stored list had loaded: it stays at the head once it has.
  await new Promise((resolve) => setTimeout(resolve, 20));
  seen.push(recents.getRecentDocumentsSnapshot().map((entry) => entry.key));
  assert.deepEqual(seen[0], ['psalmody:vespers_praises', 'bible:genesis:1']);
  assert.deepEqual(JSON.parse(data['chc-recent-documents']).map((entry) => entry.key), ['psalmody:vespers_praises', 'bible:genesis:1'], 'persisted newest first');

  recents.clearRecentDocuments();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.deepEqual(recents.getRecentDocumentsSnapshot(), []);
  assert.equal(data['chc-recent-documents'], '[]');
  unsubscribe();
});

test('a corrupted store yields an empty list rather than a crash', async () => {
  fakeWebStorage({ 'chc-recent-documents': '{not json' });
  const { loadRecentDocuments } = loadRecents();
  assert.deepEqual(await loadRecentDocuments(), []);
});
