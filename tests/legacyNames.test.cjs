const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

/**
 * What the app keeps on a device is named for Coptic Vine (cv-), and what
 * earlier builds kept under the old name (chc-) moves to the new one the
 * first time it is read or written (utils/legacyNames.ts): settings,
 * bookmarks, highlights, playback, download settings, the notification
 * marks, the downloads' database and folder. Nothing saved is lost.
 */
function loadModule(file, stubs) {
  const javascript = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const moduleObject = { exports: {} };
  const localRequire = (specifier) => {
    if (specifier in stubs) return stubs[specifier];
    if (specifier.startsWith('@/')) return loadModule(['.ts', '.tsx', '.js'].map((extension) => `src/${specifier.slice(2)}${extension}`).find((candidate) => fs.existsSync(candidate)), stubs);
    if (specifier.startsWith('.')) {
      const base = path.join(path.dirname(file), specifier);
      const source = ['.ts', '.tsx', '.js'].map((extension) => base + extension).find((candidate) => fs.existsSync(candidate));
      if (source) return loadModule(source, stubs);
    }
    return require(specifier);
  };
  new Function('exports', 'require', 'module', javascript)(moduleObject.exports, localRequire, moduleObject);
  return moduleObject.exports;
}
const read = (file) => fs.readFileSync(file, 'utf8');

function memoryStorage(entries = {}) {
  const values = new Map(Object.entries(entries));
  return {
    values,
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

/** expo-file-system/legacy over files held in memory. */
function memoryFiles(files = {}) {
  const contents = new Map(Object.entries(files));
  const calls = [];
  return {
    contents,
    calls,
    documentDirectory: 'file:///docs/',
    getInfoAsync: async (uri) => ({ exists: contents.has(uri) }),
    readAsStringAsync: async (uri) => {
      if (!contents.has(uri)) throw new Error(`no ${uri}`);
      return contents.get(uri);
    },
    writeAsStringAsync: async (uri, text) => { contents.set(uri, text); },
    deleteAsync: async (uri) => { calls.push(['delete', uri]); contents.delete(uri); },
    moveAsync: async ({ from, to }) => { calls.push(['move', from, to]); contents.set(to, contents.get(from)); contents.delete(from); },
  };
}

test('an old key moves to its new name once; kept under both, what was saved since stays', () => {
  const { moveLegacyStorageKey } = loadModule('src/utils/legacyNames.ts', {});
  const storage = memoryStorage({ 'chc-a': 'old a', 'chc-b': 'old b', 'cv-b': 'new b' });
  moveLegacyStorageKey('chc-a', 'cv-a', storage);
  moveLegacyStorageKey('chc-b', 'cv-b', storage);
  moveLegacyStorageKey('chc-c', 'cv-c', storage);
  assert.deepEqual(Object.fromEntries(storage.values), { 'cv-a': 'old a', 'cv-b': 'new b' });
  // Once a run: an old key showing up later is not moved over what the app now keeps.
  storage.setItem('chc-a', 'stale');
  moveLegacyStorageKey('chc-a', 'cv-a', storage);
  assert.equal(storage.getItem('cv-a'), 'old a');
  // Storage that throws has nothing to move.
  assert.doesNotThrow(() => moveLegacyStorageKey('x', 'y', { getItem() { throw new Error('denied'); }, setItem() {}, removeItem() {} }));
});

test('an old file moves to its new name; kept at both, the old one goes; callers share the one move', async () => {
  const files = memoryFiles({ 'file:///docs/chc-a.json': 'old a', 'file:///docs/chc-b.json': 'old b', 'file:///docs/cv-b.json': 'new b' });
  const { moveLegacyFile } = loadModule('src/utils/legacyNames.ts', { 'expo-file-system/legacy': files });
  await Promise.all([
    moveLegacyFile('file:///docs/chc-a.json', 'file:///docs/cv-a.json'),
    moveLegacyFile('file:///docs/chc-a.json', 'file:///docs/cv-a.json'),
    moveLegacyFile('file:///docs/chc-b.json', 'file:///docs/cv-b.json'),
    moveLegacyFile('file:///docs/chc-c.json', 'file:///docs/cv-c.json'),
  ]);
  assert.deepEqual(Object.fromEntries(files.contents), { 'file:///docs/cv-a.json': 'old a', 'file:///docs/cv-b.json': 'new b' });
  assert.deepEqual(files.calls, [['move', 'file:///docs/chc-a.json', 'file:///docs/cv-a.json'], ['delete', 'file:///docs/chc-b.json']]);
});

test('bookmarks an earlier build kept come back under the new name, on the web and in the app', async () => {
  const storage = memoryStorage({ 'chc-bookmarks': JSON.stringify(['liturgy:1']) });
  // In a browser, window and globalThis are one: the stores read window.localStorage, the moves globalThis.localStorage.
  global.window = { localStorage: storage };
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true, writable: true });
  try {
    const web = loadModule('src/utils/bookmarksStorage.ts', { 'react-native': { Platform: { OS: 'web' } } });
    assert.deepEqual(await web.loadBookmarks(), ['liturgy:1']);
    assert.deepEqual([...storage.values.keys()], ['cv-bookmarks']);
  } finally {
    delete global.window;
    delete globalThis.localStorage;
  }
  const files = memoryFiles({ 'file:///docs/chc-bookmarks.json': JSON.stringify(['agpeya:2']) });
  const app = loadModule('src/utils/bookmarksStorage.ts', { 'react-native': { Platform: { OS: 'ios' } }, 'expo-file-system/legacy': files });
  assert.deepEqual(await app.loadBookmarks(), ['agpeya:2']);
  assert.deepEqual([...files.contents.keys()], ['file:///docs/cv-bookmarks.json']);
});

test('every store keeps its things under the new name and moves the old one first', () => {
  const stores = {
    'src/utils/preferencesStorage.ts': ['cv-reading-preferences', 'chc-reading-preferences'],
    'src/utils/playbackStateStorage.ts': ['cv-playback-state-v1', 'chc-playback-state-v1'],
    'src/utils/bookmarksStorage.ts': ['cv-bookmarks', 'chc-bookmarks'],
    'src/utils/collapseStateStorage.ts': ['cv-collapsed-sections', 'chc-collapsed-sections'],
  };
  for (const [file, [key, legacy]] of Object.entries(stores)) {
    const source = read(file);
    assert.match(source, new RegExp(`const STORAGE_KEY = '${key}';`), file);
    assert.match(source, new RegExp(`const LEGACY_STORAGE_KEY = '${legacy}';`), file);
    // Every read and write of the web's key, and of the app's file, moves the old one first.
    assert.equal((source.match(/window\.localStorage\.(getItem|setItem)\(STORAGE_KEY/g) || []).length, (source.match(/moveLegacyStorageKey\(LEGACY_STORAGE_KEY, STORAGE_KEY\);\n\s+(?:const raw = |raw = |if \(snapshot\) )?window\.localStorage\.(getItem|setItem)\(STORAGE_KEY/g) || []).length, file);
    assert.equal((source.match(/const fileUri = `\$\{FileSystem\.documentDirectory\}\$\{STORAGE_KEY\}\.json`;/g) || []).length, (source.match(/await moveLegacyFile\(`\$\{FileSystem\.documentDirectory\}\$\{LEGACY_STORAGE_KEY\}\.json`, fileUri\);/g) || []).length, file);
  }
  const highlights = read('src/services/bibleHighlightsService.ts');
  assert.match(highlights, /const STORAGE_PREFIX = 'cv-bible-highlights';\n[^\n]*\nconst LEGACY_STORAGE_PREFIX = 'chc-bible-highlights';/);
  assert.equal((highlights.match(/moveLegacy(StorageKey|File)\(/g) || []).length, 4, "each book's key and file, read and written");
  const downloads = read('src/services/downloadPreferences.ts');
  assert.match(downloads, /const WEB_KEY = 'cv-download-preferences-v1'; const NATIVE_URI = `\$\{FileSystem\.documentDirectory\}cv-download-preferences\.json`;/);
  assert.match(downloads, /try \{ await moveLegacy\(\); const raw/);
});

test('notifications: the marks kept under the new names, and the Android channel and web worker renamed', () => {
  const notifications = read('src/services/notificationService.ts');
  assert.match(notifications, /const CHANNEL_ID = 'cv-default';/);
  assert.match(notifications, /await Notifications\.deleteNotificationChannelAsync\(LEGACY_CHANNEL_ID\)\.catch\(\(\) => undefined\);\n\s+await Notifications\.setNotificationChannelAsync\(CHANNEL_ID, \{/);
  assert.match(notifications, /moveLegacyStorageKey\(LEGACY_LAST_TOKEN_KEY, LAST_TOKEN_KEY, store\);\n\s+moveLegacyStorageKey\(LEGACY_FIRST_LAUNCH_ASKED_KEY, FIRST_LAUNCH_ASKED_KEY, store\);/);
  assert.match(read('workers/notification-dispatcher/src/index.js'), /channelId: 'cv-default',/);
  const push = read('src/services/webPushService.ts');
  assert.match(push, /await navigator\.serviceWorker\.register\('\/cv-notification-sw\.js'\);/);
  assert.equal((push.match(/endpointStore\(\)\?\./g) || []).length, 3);
  assert.ok(fs.existsSync('public/cv-notification-sw.js') && !fs.existsSync('public/chc-notification-sw.js'));
});

test("the downloads' database and folder take the new name as the database first opens, and the records follow the files", () => {
  const database = read('src/services/offlineDatabase.ts');
  assert.match(database, /const DATABASE_NAME = 'cv-offline\.db';/);
  assert.match(database, /export const DOWNLOADS_FOLDER = 'cv-offline';/);
  assert.match(database, /databasePromise = moveLegacyDatabase\(\)\n\s+\.then\(\(\) => SQLite\.openDatabaseAsync\(DATABASE_NAME, \{ useNewConnection: true \}\)\)\n\s+\.then\(async \(db\) => \{\n\s+await migrate\(db\);\n\s+await moveLegacyDownloads\(db\);/);
  assert.match(database, /for \(const suffix of \['-wal', '-shm', ''\]\)/, 'the log moves with the database');
  assert.match(read('src/services/downloadManager.ts'), /new Directory\(Paths\.document, DOWNLOADS_FOLDER, 'files'\)/);

  // The update the move runs, on a real SQLite.
  const update = database.match(/`(UPDATE offline_files[\s\S]*?)`,\n\s+from, to, from, to, from, from,/)[1];
  const { DatabaseSync } = require('node:sqlite');
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('CREATE TABLE offline_files (file_key TEXT, local_uri TEXT, resume_json TEXT)');
  const insert = sqlite.prepare('INSERT INTO offline_files VALUES (?, ?, ?)');
  insert.run('done', 'file:///docs/chc-offline/files/track.m4a', null);
  insert.run('paused', null, '{"fileUri":"file:///docs/chc-offline/files/part.m4a"}');
  insert.run('elsewhere', 'file:///docs/other/chc-offline-notes.txt', null);
  insert.run('fresh', 'file:///docs/cv-offline/files/new.m4a', null);
  sqlite.prepare(update).run('/chc-offline/', '/cv-offline/', '/chc-offline/', '/cv-offline/', '/chc-offline/', '/chc-offline/');
  assert.deepEqual(sqlite.prepare('SELECT file_key, local_uri, resume_json FROM offline_files ORDER BY rowid').all().map((row) => ({ ...row })), [
    { file_key: 'done', local_uri: 'file:///docs/cv-offline/files/track.m4a', resume_json: null },
    { file_key: 'paused', local_uri: null, resume_json: '{"fileUri":"file:///docs/cv-offline/files/part.m4a"}' },
    { file_key: 'elsewhere', local_uri: 'file:///docs/other/chc-offline-notes.txt', resume_json: null },
    { file_key: 'fresh', local_uri: 'file:///docs/cv-offline/files/new.m4a', resume_json: null },
  ]);
});

test('the photo a user uploaded is cv_avatar_url, and the old link scheme is gone', () => {
  assert.match(read('src/services/cvApiAuth.ts'), /cv_avatar_url: own \? image : null/);
  assert.match(read('src/app/account.tsx'), /user\.user_metadata\.cv_avatar_url/);
  const app = JSON.parse(read('app.json'));
  assert.deepEqual(app.expo.scheme, ['copticvine']);
  for (const file of ['src/services/cvApiAuth.ts', 'src/app/account.tsx', 'src/types/account.ts']) assert.doesNotMatch(read(file), /chc_avatar_url/, file);
});
