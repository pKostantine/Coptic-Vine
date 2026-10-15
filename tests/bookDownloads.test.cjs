const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');

function loadRegistry() {
  const source = fs.readFileSync('src/constants/bookDependencyRegistry.ts', 'utf8');
  const javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const moduleObject = { exports: {} };
  new Function('exports', 'require', 'module', javascript)(moduleObject.exports, require, moduleObject);
  return moduleObject.exports;
}

test('all initial books include public through the recursive registry', () => {
  const registry = loadRegistry();
  for (const bookKey of registry.DOWNLOADABLE_BOOK_KEYS) {
    const resources = registry.resourcesForBook(bookKey);
    assert.ok(resources.includes(bookKey), `${bookKey} must include its primary resource`);
    assert.equal(resources.filter((resource) => resource === 'public').length, 1);
  }
});

test('a Public revision impacts every installed book graph', () => {
  const registry = loadRegistry();
  const impacted = registry.DOWNLOADABLE_BOOK_KEYS.filter((bookKey) => registry.resourcesForBook(bookKey).includes('public'));
  assert.deepEqual(new Set(impacted), new Set(['psalmody', 'liturgy', 'veneration', 'agpeya', 'bible', 'holy_week']));
});

test('Psalmody and Liturgy share one dependency identity', () => {
  const registry = loadRegistry();
  const psalmody = new Set(registry.resourcesForBook('psalmody'));
  const liturgy = new Set(registry.resourcesForBook('liturgy'));
  for (const shared of ['public', 'agpeya', 'doxologies', 'bible', 'calendar']) {
    assert.ok(psalmody.has(shared));
    assert.ok(liturgy.has(shared));
  }
});

test('Liturgy resolves inline, reading, seasonal, and Synaxarium dependencies', () => {
  const { resourcesForBook } = loadRegistry();
  const liturgy = new Set(resourcesForBook('liturgy'));
  for (const dependency of ['praxis_response', 'gospel_rite', 'gospel_responses', 'readings', 'synaxarium', 'calendar']) {
    assert.ok(liturgy.has(dependency), `missing ${dependency}`);
  }
});

test('dependency registry covers every explicit cross-schema reader target', () => {
  const registry = loadRegistry();
  const declared = new Set(Object.keys(registry.CONTENT_RESOURCE_DEPENDENCIES));
  for (const path of ['src/utils/hymnLibrary.js', 'src/utils/saintHymns.ts']) {
    const source = fs.readFileSync(path, 'utf8');
    const targets = [...source.matchAll(/schema\s*:\s*["']([a-z0-9_]+)["']/g)].map((match) => match[1]);
    for (const target of targets) assert.ok(declared.has(target), `${path} references unregistered ${target}`);
  }
});

test('installed books search only installed schemas for hymn keys', () => {
  const reader = fs.readFileSync('src/utils/hymnLibrary.js', 'utf8');
  assert.match(reader, /async function getHymnKeyLookupSchemas[\s\S]*?isContentSchemaInstalled\(schema\)[\s\S]*?filter/);
  assert.doesNotMatch(reader, /(?<!await |function )getHymnKeyLookupSchemas\(/, 'every lookup must await the installed-schema filter');
  const web = fs.readFileSync('src/services/contentDataClient.web.ts', 'utf8');
  assert.match(web, /isContentSchemaInstalled[\s\S]*return false/);
});

test('Agpeya needs only Public; Holy Week adds the Bible, the prophecy frames, and the mournful Gospel rites for its hour readings', () => {
  const { CONTENT_RESOURCE_DEPENDENCIES } = loadRegistry();
  assert.deepEqual([...CONTENT_RESOURCE_DEPENDENCIES.agpeya], ['public']);
  assert.deepEqual([...CONTENT_RESOURCE_DEPENDENCIES.holy_week], ['public', 'bible', 'calendar', 'readings', 'gospel_rite', 'litanies']);
});

test('offline book registry migrations mirror the client book keys', () => {
  const { DOWNLOADABLE_BOOK_KEYS } = loadRegistry();
  const migrations = fs.readdirSync('supabase/migrations').map((name) => fs.readFileSync(`supabase/migrations/${name}`, 'utf8')).join('\n');
  for (const bookKey of DOWNLOADABLE_BOOK_KEYS) {
    assert.match(migrations, new RegExp(`insert into offline_content\\.books[^;]*\\('${bookKey}'`), `no offline_content.books row for ${bookKey}`);
  }
});

test('recursive dependency resolution tolerates cycles and deduplicates nodes', () => {
  const { resolveResourceDependencies } = loadRegistry();
  const result = resolveResourceDependencies(['a'], { public: [], a: ['b', 'public'], b: ['c'], c: ['a', 'public'] });
  assert.equal(new Set(result).size, result.length);
  assert.deepEqual(new Set(result), new Set(['public', 'a', 'b', 'c']));
});

test('Calendar is system-owned and book removal retains referenced resources', () => {
  const database = fs.readFileSync('src/services/bookContentDatabase.ts', 'utf8');
  assert.match(database, /VALUES \('calendar', NULL, 'not_downloaded', 1/);
  assert.match(database, /content_book_pending_resources/);
  assert.match(database, /!resource\?\.system_owned.*refs\?\.count/s);
});

test('partial book downloads are reference-tracked and removable before activation', () => {
  const manager = fs.readFileSync('src/services/bookDownloadManager.ts', 'utf8');
  const database = fs.readFileSync('src/services/bookContentDatabase.ts', 'utf8');
  assert.match(manager, /setPendingBookResources\(bookKey, resourceIds\)/);
  assert.match(database, /UNION SELECT resource_id FROM content_book_pending_resources/);
});

test('restart recovery pauses interrupted content work without replacing active resources', () => {
  const database = fs.readFileSync('src/services/offlineDatabase.ts', 'utf8');
  assert.match(database, /UPDATE content_books[\s\S]*status = 'paused'[\s\S]*queued', 'downloading'/);
  assert.match(database, /UPDATE content_resources[\s\S]*active_version IS NULL[\s\S]*queued', 'downloading'/);
});

test('Wi-Fi reconnection retries failed chunks but respects explicit pauses', () => {
  const bootstrap = fs.readFileSync('src/components/BookSyncBootstrap.tsx', 'utf8');
  assert.match(bootstrap, /book\.status === 'failed'[\s\S]*bookDownloadManager\.retry/);
  assert.doesNotMatch(bootstrap, /filter\(\(book\) => book\.status === 'paused'/);
});

test('legacy remove-all excludes reference-counted book packages', () => {
  const storage = fs.readFileSync('src/services/downloadStorageManager.ts', 'utf8');
  assert.match(storage, /filter\(\(pkg\) => pkg\.domain !== 'books'\)/);
});

test('native packages stage content before one transactional activation', () => {
  const manager = fs.readFileSync('src/services/bookDownloadManager.ts', 'utf8');
  const database = fs.readFileSync('src/services/bookContentDatabase.ts', 'utf8');
  // A book's resources are staged a few at a time, then activated together.
  assert.match(manager, /forEachLimited\(resources, RESOURCE_CONCURRENCY,[\s\S]*?stageResource[\s\S]*?activateBookResources/);
  assert.match(database, /activateBookResources[\s\S]*withExclusiveTransactionAsync/);
  assert.match(manager, /chunk\.sha256/);
});

test('Bible updates use deterministic content-addressed chunks', () => {
  // Packages are built by the publishing script; the Worker only stores and serves them.
  const publisher = fs.readFileSync('scripts/publish-content-packages.mjs', 'utf8');
  const worker = fs.readFileSync('workers/content-packages/src/index.ts', 'utf8');
  const manager = fs.readFileSync('src/services/bookDownloadManager.ts', 'utf8');
  // One bucket per book of the Bible (split only at the 2 MB target), not per
  // chapter: 87 chunks rather than 1,409 for a device to fetch.
  assert.match(publisher, /`\$\{table\}:\$\{row\.book_key \?\? 'unknown'\}`/);
  assert.doesNotMatch(publisher, /chapter_number \?\? 'metadata'/);
  assert.match(publisher, /TARGET_CHUNK_BYTES = 2 \* 1024 \* 1024/);
  assert.match(publisher, /sha256\(encoder\.encode\(bucket\)\)\.slice\(0, 20\)/);
  assert.match(publisher, /bucketPart = bucketChanged \? 0 : bucketPart \+ 1/);
  // A dry run builds without uploading anything.
  assert.match(publisher, /if \(!DRY_RUN\) await pool\(built\.chunks/);
  assert.match(publisher, /url: `\/packages\/\$\{resource\.id\}\/\$\{digest\}\.json`/);
  assert.match(publisher, /if \(await exists\(key\)\) \{ reused \+= 1; return; \}/);
  assert.match(worker, /const PACKAGE_KEY = \/\^packages/);
  assert.match(manager, /fileKey: `content:\$\{resource\.id\}:\$\{chunk\.sha256\}`/);
  assert.doesNotMatch(manager, /fileKey: `content:\$\{resource\.id\}:\$\{resource\.version\}/);
});

test('RPC rows participate in package row-count integrity checks', () => {
  const database = fs.readFileSync('src/services/bookContentDatabase.ts', 'utf8');
  assert.match(database, /for \(const rpc of payload\.rpcResults \|\| \[\]\)[\s\S]*rowCount \+= 1/);
});

test('Bible and Calendar package every field used by offline rendering', () => {
  const migration = fs.readFileSync('supabase/migrations/20260924120000_native_offline_content_packages.sql', 'utf8');
  const provider = fs.readFileSync('src/services/contentDataClient.ts', 'utf8');
  assert.match(migration, /\('bible', 'bible', array\['books','verses','verse_parts'\]\)/);
  assert.match(provider, /english_nkjv[\s\S]*english_from_coptic[\s\S]*coptic[\s\S]*greek[\s\S]*arabic_from_coptic[\s\S]*french/);
  for (const table of ['coptic_date_conversions', 'season_ranges', 'reading_rules', 'condition_flags']) assert.match(migration, new RegExp(table));
  for (const rpc of ['get_context_flags', 'get_active_flags_for_date', 'get_readings_for_date']) assert.match(migration, new RegExp(rpc));
});

test('web variants do not initialize SQLite or expose download UI', () => {
  const provider = fs.readFileSync('src/services/contentDataClient.web.ts', 'utf8');
  const bootstrap = fs.readFileSync('src/components/BookSyncBootstrap.web.tsx', 'utf8');
  const route = fs.readFileSync('src/app/downloads.web.tsx', 'utf8');
  const nativeRoute = fs.readFileSync('src/app/downloads.tsx', 'utf8');
  // The Books screen draws no download control on any platform: downloads are
  // managed on the Downloads & Storage page alone.
  const books = fs.readFileSync('src/app/books/index.tsx', 'utf8');
  const shelf = fs.readFileSync('src/components/vine/ui/LibraryBook.tsx', 'utf8');
  const webManager = fs.readFileSync('src/services/bookDownloadManager.web.ts', 'utf8');
  assert.doesNotMatch(provider, /sqlite|bookDownloadManager/i);
  assert.match(bootstrap, /return null/);
  assert.match(route, /Redirect href=.*\/account/);
  assert.match(nativeRoute, /Platform\.OS === 'web'.*Redirect/s);
  assert.match(webManager, /listBooks\(\): Promise<BookDownloadProgress\[\]> \{ return Promise\.resolve\(\[\]\); \}/);
  assert.doesNotMatch(books, /bookDownloadManager|downloadStatus|downloadProgress|onDownloadPress/);
  assert.doesNotMatch(shelf, /downloadStatus|downloadProgress|onDownloadPress/);
});

// ---------------------------------------------------------------------------
// Download speed: a package's files and a book's resources a few at a time,
// foreground sessions for book content, batched imports, and the Downloads
// page's cancel, bin and Download All.

function loadTypeScriptModule(path, dependencies = {}) {
  const source = fs.readFileSync(path, 'utf8');
  const javascript = ts.transpileModule(source, {
    compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const moduleObject = { exports: {} };
  const localRequire = (specifier) => (Object.hasOwn(dependencies, specifier) ? dependencies[specifier] : require(specifier));
  new Function('exports', 'require', 'module', javascript)(moduleObject.exports, localRequire, moduleObject);
  return moduleObject.exports;
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const settle = async () => { for (let index = 0; index < 30; index += 1) await new Promise((resolve) => setImmediate(resolve)); };

test('the concurrency pool keeps a few going, in order, and stops starting at the first failure', async () => {
  const { forEachLimited } = loadTypeScriptModule('src/utils/concurrency.ts');

  let inFlight = 0;
  let most = 0;
  const started = [];
  await forEachLimited([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 3, async (item) => {
    started.push(item);
    inFlight += 1; most = Math.max(most, inFlight);
    await delay(3);
    inFlight -= 1;
  });
  assert.equal(most, 3);
  assert.deepEqual(started, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

  // Item 2 fails while item 1 is still running: nothing new starts, item 1
  // is let finish, and only then is the failure thrown.
  const begun = [];
  const finished = [];
  await assert.rejects(forEachLimited([1, 2, 3, 4, 5, 6], 2, async (item) => {
    begun.push(item);
    await delay(item === 2 ? 1 : 15);
    if (item === 2) throw new Error('two failed');
    finished.push(item);
  }), /two failed/);
  assert.deepEqual(begun, [1, 2]);
  assert.deepEqual(finished, [1]);

  // A pause (the `stopped` check) stops new items starting.
  let stop = false;
  const paused = [];
  await forEachLimited([1, 2, 3, 4, 5, 6], 2, async (item) => {
    paused.push(item);
    if (item === 3) stop = true;
    await delay(1);
  }, () => stop);
  assert.deepEqual(paused, [1, 2, 3]);
});

test('progress is reported at most every interval, the last ask always answered, and stop waits for a report under way', async () => {
  const { throttled } = loadTypeScriptModule('src/utils/concurrency.ts');
  let calls = 0;
  const report = throttled(async () => { calls += 1; }, 200);
  for (let index = 0; index < 10; index += 1) report.request();
  await delay(30);
  assert.equal(calls, 1);
  report.request(); report.request();
  await delay(30);
  assert.equal(calls, 1, 'a second report waits for the interval');
  await delay(300);
  assert.equal(calls, 2, 'the last ask is answered once the interval is up');
  await report.stop();

  let release = () => undefined;
  let slowCalls = 0;
  const slow = throttled(() => { slowCalls += 1; return new Promise((resolve) => { release = resolve; }); }, 10);
  slow.request();
  await delay(20);
  let stopped = false;
  const stopping = slow.stop().then(() => { stopped = true; });
  await delay(10);
  assert.equal(stopped, false, 'stop waits for the report under way');
  release();
  await stopping;
  slow.request();
  await delay(30);
  assert.equal(slowCalls, 1, 'nothing reports after stop');
});

test('a chunk imports a hundred rows to a statement, in the same order, still checked by count', async () => {
  const prepared = [];
  const executed = [];
  let finalized = 0;
  const txn = {
    getFirstAsync: async () => null,
    prepareAsync: async (sql) => {
      prepared.push(sql);
      return { executeAsync: async (params) => { executed.push(params); }, finalizeAsync: async () => { finalized += 1; } };
    },
    runAsync: async () => undefined,
  };
  const db = { withExclusiveTransactionAsync: async (task) => task(txn) };
  const { importContentChunk } = loadTypeScriptModule('src/services/bookContentDatabase.ts', {
    '@/services/offlineDatabase': { getOfflineDatabase: async () => db },
  });
  const rows = (count) => Array.from({ length: count }, (_, index) => ({ id: index }));
  const payload = {
    formatVersion: 1, snapshotId: '', resourceId: 'bible', version: 'v1', chunkId: 'c1',
    tables: [{ schema: 'bible', table: 'verses', rows: rows(250) }, { schema: 'bible', table: 'books', rows: rows(30) }],
    rpcResults: [{ schema: 'calendar', function: 'f', args: {}, data: 1 }],
  };
  assert.equal(await importContentChunk(payload, 'pkg', 281), 281);
  const tuples = (sql) => (sql.match(/\(\?, \?, \?, \?, \?, \?, \?\)/g) || []).length;
  // Every full batch shares one statement; each shorter tail gets its own.
  assert.deepEqual(prepared.map(tuples), [100, 50, 30]);
  assert.equal(finalized, 3);
  assert.deepEqual(executed.map((params) => params.length / 7), [100, 100, 50, 30]);
  assert.ok(executed.every((params) => params.length <= 999), 'under SQLite\'s oldest variable limit');
  // row_order runs on through a table's batches and starts again for the next table.
  const order = executed.flatMap((params) => params.filter((_, index) => index % 7 === 5));
  assert.deepEqual(order, [...Array(250).keys(), ...Array(30).keys()]);
  assert.equal(executed[0][6], JSON.stringify({ id: 0 }));
  await assert.rejects(importContentChunk(payload, 'pkg', 280), /expected 280/);
});

test('transactions take turns, with foreign keys on and the write lock taken before anything is read', async () => {
  const mainExec = [];
  const mainRuns = [];
  const mainReads = [];
  const transactions = [];
  let failNextImmediate = false;
  const fakeDb = {
    execAsync: async (sql) => { mainExec.push(sql); },
    getFirstAsync: async (sql) => { mainReads.push(sql); return /user_version/.test(sql) ? { user_version: 2 } : null; },
    runAsync: async (...args) => { mainRuns.push(args); },
    // As expo-sqlite does it: a connection of its own, begun deferred.
    withExclusiveTransactionAsync: async (task) => {
      const log = [];
      transactions.push(log);
      const txn = {
        execAsync: async (sql) => {
          log.push(sql);
          if (sql === 'BEGIN IMMEDIATE' && failNextImmediate) { failNextImmediate = false; throw new Error('database is locked'); }
        },
        runAsync: async (sql) => { log.push(sql); },
      };
      await txn.execAsync('BEGIN');
      try { await task(txn); await txn.execAsync('COMMIT'); } catch (error) { await txn.execAsync('ROLLBACK'); throw error; }
    },
  };
  const { getOfflineDatabase, updateOfflineFile } = loadTypeScriptModule('src/services/offlineDatabase.ts', {
    'expo-sqlite': { openDatabaseAsync: async () => fakeDb },
  });
  const db = await getOfflineDatabase();
  assert.match(mainExec[0], /PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;/);

  let releaseFirst = () => undefined;
  const order = [];
  const first = db.withExclusiveTransactionAsync(async (txn) => { order.push('first begins'); await new Promise((resolve) => { releaseFirst = resolve; }); await txn.runAsync('first write'); order.push('first ends'); });
  const second = db.withExclusiveTransactionAsync(async (txn) => { order.push('second begins'); await txn.runAsync('second write'); });
  await settle();
  assert.deepEqual(order, ['first begins'], 'the second waits its turn');
  releaseFirst();
  await Promise.all([first, second]);
  assert.deepEqual(order, ['first begins', 'first ends', 'second begins']);
  assert.deepEqual(transactions[0], ['BEGIN', 'COMMIT; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;', 'BEGIN IMMEDIATE', 'first write', 'COMMIT']);

  // A write lock not had within the timeout fails cleanly, and the next transaction still runs.
  failNextImmediate = true;
  await assert.rejects(db.withExclusiveTransactionAsync(async () => assert.fail('must not run')), /database is locked/);
  assert.deepEqual(transactions[2].slice(-3), ['BEGIN IMMEDIATE', 'BEGIN', 'ROLLBACK']);
  await db.withExclusiveTransactionAsync(async (txn) => { await txn.runAsync('after'); });
  assert.equal(transactions[3].at(-2), 'after');

  // A file's update writes what it names, with nothing read first.
  const readsBefore = mainReads.length;
  await updateOfflineFile('content:bible:abc', { status: 'complete', bytesWritten: 12, resumeJson: null });
  assert.equal(mainReads.length, readsBefore);
  const [sql, params] = mainRuns.at(-1);
  assert.equal(sql, 'UPDATE offline_files SET status = ?, bytes_written = ?, resume_json = ?, updated_at = ? WHERE file_key = ?');
  assert.deepEqual([params[0], params[1], params[2], params[4]], ['complete', 12, null, 'content:bible:abc']);
});

/** The download manager over fakes: transfers that finish, pause and cancel when told. */
function loadDownloadManager() {
  const existing = new Map();
  const tasks = [];
  class FakeTask {
    constructor(url, destination, options) { this.url = url; this.destination = destination; this.options = options; this.status = 'idle'; tasks.push(this); }
    get state() { return this.status; }
    transfer() {
      this.status = 'active';
      return new Promise((resolve, reject) => {
        this.finish = (size) => { this.status = 'completed'; existing.set(this.destination.uri, size); resolve({ uri: this.destination.uri, size }); };
        this.pauseNow = () => { this.status = 'paused'; resolve(null); };
        this.cancelNow = () => { this.status = 'cancelled'; reject(new Error('cancelled')); };
      });
    }
    downloadAsync() { return this.transfer(); }
    resumeAsync() { return this.transfer(); }
    async pauseAsync() { if (this.status !== 'active') throw new Error('not active'); this.pauseNow(); }
    cancel() { if (this.status === 'active') this.cancelNow(); }
    savable() { if (this.status !== 'paused') throw new Error('not paused'); return { url: this.url, fileUri: this.destination.uri, isDirectory: false, resumeData: `resume:${this.url}` }; }
    release() {}
    static fromSavable(state, options) { const task = new FakeTask(state.url, new FakeFile(state.fileUri), options); task.status = 'paused'; task.restored = state; return task; }
  }
  class FakeFile {
    constructor(...parts) { this.uri = parts.map((part) => part.uri ?? part).join('/'); }
    get exists() { return existing.has(this.uri); }
    get size() { return existing.get(this.uri) ?? 0; }
    delete() { existing.delete(this.uri); }
    async digest() { return ''; }
    static createDownloadTask(url, destination, options) { return new FakeTask(url, destination, options); }
  }
  class FakeDirectory { constructor(...parts) { this.uri = parts.join('/'); } create() {} }

  const packages = new Map();
  const files = new Map();
  const packageFiles = new Map();
  const requests = new Map();
  const toRow = (patch) => Object.fromEntries(Object.entries({ localUri: 'local_uri', status: 'status', bytesWritten: 'bytes_written', totalBytes: 'total_bytes', resumeJson: 'resume_json', error: 'error' })
    .filter(([key]) => patch[key] !== undefined).map(([key, column]) => [column, patch[key]]));
  const database = {
    getStoredDownloadRequest: async (key) => requests.get(key) ?? null,
    getPackageFiles: async (key) => (packageFiles.get(key) || []).map((fileKey) => ({ ...files.get(fileKey) })),
    getDownloadProgress: async (key) => (packages.has(key) ? { packageKey: key, status: packages.get(key).status, progress: 0, bytesWritten: 0, totalBytes: null, error: null } : null),
    setPackageState: async (key, status) => { if (packages.has(key)) packages.get(key).status = status; },
    setPackageProgress: async () => undefined,
    refreshPackageProgress: async () => null,
    updateOfflineFile: async (fileKey, patch) => { if (files.has(fileKey)) Object.assign(files.get(fileKey), toRow(patch)); },
    saveDownloadRequest: async (request) => {
      requests.set(request.packageKey, request);
      packages.set(request.packageKey, { status: packages.get(request.packageKey)?.status === 'complete' ? 'complete' : 'queued' });
      for (const resource of request.resources) {
        const row = files.get(resource.fileKey);
        files.set(resource.fileKey, row ? { ...row, status: row.status === 'complete' ? 'complete' : 'queued' } : {
          file_key: resource.fileKey, remote_uri: resource.remoteUri, local_uri: null, role: resource.role,
          file_size_bytes: resource.fileSizeBytes, total_bytes: resource.fileSizeBytes, status: 'queued', bytes_written: 0, resume_json: null, error: null,
        });
      }
      packageFiles.set(request.packageKey, request.resources.map((resource) => resource.fileKey));
    },
    removeOfflinePackage: async (key) => { packages.delete(key); return []; },
    findPlayableLocalUri: async () => null,
    isEntityDownloaded: async () => false,
  };
  const { downloadManager } = loadTypeScriptModule('src/services/downloadManager.ts', {
    'expo-file-system': { Directory: FakeDirectory, DownloadTask: FakeTask, File: FakeFile, Paths: { document: 'documents' } },
    '@/services/offlineDatabase': database,
    '@/services/downloadPreferences': { assertDownloadNetworkAllowed: async () => undefined },
    '@/services/downloadStorageManager': { isDownloadRequestStale: async () => false },
    '@/utils/concurrency': loadTypeScriptModule('src/utils/concurrency.ts'),
  });
  return { downloadManager, tasks, files, packages };
}

function contentRequest(packageKey, count, domain = 'books') {
  return {
    packageKey, domain, entityType: domain === 'books' ? 'book_resource' : 'music_release', entityId: packageKey, locale: 'all', title: packageKey, snapshots: [],
    resources: Array.from({ length: count }, (_, index) => ({
      fileKey: `${packageKey}:${index}`, remoteUri: `https://example.test/${packageKey}/${index}.json`,
      role: domain === 'books' ? 'content' : 'media', fileSizeBytes: 100, checksum: null, extension: 'json',
    })),
  };
}

test('a package downloads six files at once, book content on foreground sessions, music in the background', async () => {
  const { downloadManager, tasks, packages } = loadDownloadManager();
  await downloadManager.enqueue(contentRequest('book-resource:bible:v1', 10));
  await settle();
  assert.equal(tasks.length, 6, 'six transfers in flight');
  assert.ok(tasks.every((task) => task.options.sessionType === 'foreground'));
  tasks[0].finish(100); tasks[1].finish(100);
  await settle();
  assert.equal(tasks.length, 8, 'each finished transfer makes room for the next');
  for (let guard = 0; guard < 20 && tasks.some((task) => task.state === 'active'); guard += 1) {
    for (const task of tasks.filter((item) => item.state === 'active')) task.finish(100);
    await settle();
  }
  assert.equal(tasks.length, 10);
  assert.equal(packages.get('book-resource:bible:v1').status, 'complete');

  const music = loadDownloadManager();
  await music.downloadManager.enqueue(contentRequest('music_release:r1:en', 2, 'music'));
  await settle();
  assert.ok(music.tasks.length === 2 && music.tasks.every((task) => task.options.sessionType === 'background'));
});

test('pausing pauses every transfer in flight and keeps each one\'s own resume point; resuming carries each on', async () => {
  const { downloadManager, tasks, files, packages } = loadDownloadManager();
  const key = 'book-resource:bible:v1';
  await downloadManager.enqueue(contentRequest(key, 10));
  await settle();
  tasks[0].finish(100); tasks[1].finish(100);
  await settle();
  const inFlight = tasks.filter((task) => task.state === 'active');
  assert.equal(inFlight.length, 6);

  await downloadManager.pause(key);
  assert.equal(packages.get(key).status, 'paused');
  assert.ok(inFlight.every((task) => task.state === 'paused'), 'every transfer was paused');
  assert.equal(tasks.length, 8, 'nothing new started once paused');
  const pausedRows = [...files.values()].filter((row) => row.status === 'paused');
  assert.equal(pausedRows.length, 6);
  for (const row of pausedRows) assert.equal(JSON.parse(row.resume_json).resumeData, `resume:${row.remote_uri}`);

  await downloadManager.resume(key);
  await settle();
  const restored = tasks.slice(8);
  assert.equal(restored.length, 6);
  assert.ok(restored.every((task) => task.restored && task.restored.resumeData === `resume:${task.url}`), 'each resumes from its own point');
  assert.ok(restored.every((task) => task.options.sessionType === 'foreground'));
  for (let guard = 0; guard < 20 && tasks.some((task) => task.state === 'active'); guard += 1) {
    for (const task of tasks.filter((item) => item.state === 'active')) task.finish(100);
    await settle();
  }
  assert.equal(packages.get(key).status, 'complete');
  assert.ok([...files.values()].every((row) => row.status === 'complete'));
});

test('cancelling cancels every transfer in flight', async () => {
  const { downloadManager, tasks, files, packages } = loadDownloadManager();
  const key = 'book-resource:psalmody:v1';
  await downloadManager.enqueue(contentRequest(key, 9));
  await settle();
  await downloadManager.cancel(key);
  assert.equal(packages.get(key).status, 'cancelled');
  assert.equal(tasks.length, 6);
  assert.ok(tasks.every((task) => task.state === 'cancelled'));
  assert.equal([...files.values()].filter((row) => row.status === 'cancelled').length, 6);
});

test('a book stages its resources a few at a time, and Download All starts every book not yet in with one failure reported', () => {
  const manager = fs.readFileSync('src/services/bookDownloadManager.ts', 'utf8');
  const types = fs.readFileSync('src/types/bookDownloads.ts', 'utf8');
  const webManager = fs.readFileSync('src/services/bookDownloadManager.web.ts', 'utf8');
  assert.match(manager, /const RESOURCE_CONCURRENCY = 3;/);
  // Shared resources stay deduplicated by id and version.
  assert.match(manager, /const key = `\$\{resource\.id\}@\$\{resource\.version\}`;[\s\S]*?if \(running && !running\.stopped\) return running\.promise;/);
  // A pause still ends the install with PausedDownloadError, at once.
  assert.match(manager, /Promise\.race\(\[\s*forEachLimited\([\s\S]*?run\.interrupted,\s*\]\)/);
  assert.match(manager, /reject\(new PausedDownloadError\('Download paused\.'\)\)/);
  assert.match(manager, /async installAll\(\): Promise<void> \{[\s\S]*?\['not_downloaded', 'paused', 'failed'\]\.includes\(book\.status\)[\s\S]*?Promise\.allSettled[\s\S]*?!\(result\.reason instanceof PausedDownloadError\)[\s\S]*?if \(failure\) throw failure\.reason;/);
  assert.match(types, /installAll\(\): Promise<void>;/);
  assert.match(webManager, /installAll\(\) \{ return Promise\.reject\(unavailable\(\)\); \}/);
});

test('Downloads & Storage: an X cancels a paused or failed book, a bin removes what is in, and Download All starts the rest', () => {
  const page = fs.readFileSync('src/app/downloads.tsx', 'utf8');
  // Paused and failed books offer Resume or Retry beside a cancel X, which removes without asking.
  // The pair runs the same way round in every App Language.
  const paused = page.match(/case 'paused':[\s\S]*?break;/)[0];
  const failed = page.match(/case 'failed':[\s\S]*?break;/)[0];
  for (const block of [paused, failed]) {
    assert.match(block, /<View style=\{styles\.trailingPair\}>\s*<ActionButton[^\n]*\n\s*\{cancel\}/);
    assert.doesNotMatch(block, /rowReverse/);
  }
  assert.match(page, /<CancelButton label=\{tr\(`Cancel download of \$\{book\.title\}`, `Annuler le téléchargement de \$\{book\.title\}`, `إلغاء تنزيل \$\{book\.title\}`\)\} onPress=\{onCancel\} \/>/);
  assert.match(page, /const cancelBook = \(book: BookDownloadProgress\) => void run\(\(\) => bookDownloadManager\.remove\(book\.bookKey\)\);/);
  assert.match(page, /function CancelButton[\s\S]*?<Icon name="close"/);
  // A bin, not a "more" menu, on downloaded books and on music and lessons; removal still asks first.
  assert.doesNotMatch(page, /MenuButton|ellipsis-horizontal|More for/);
  assert.match(page, /case 'installed':[\s\S]*?<TrashButton label=\{tr\(`Remove \$\{book\.title\}`, `Supprimer \$\{book\.title\}`, `إزالة \$\{book\.title\}`\)\} onPress=\{onRemove\} \/>/);
  assert.match(page, /trailing=\{<TrashButton label=\{tr\(`Remove \$\{item\.title\}`/);
  assert.match(page, /function TrashButton[\s\S]*?<Icon name="trash-outline"/);
  assert.match(page, /onRemove=\{\(\) => confirmBookRemoval\(book\)\}/);
  // Download All shows while any book is not downloaded, paused or failed, and starts them together.
  assert.match(page, /const waitingBooks = books\.filter\(\(book\) => book\.status === 'not_downloaded' \|\| book\.status === 'paused' \|\| book\.status === 'failed'\);/);
  assert.match(page, /\{waitingBooks\.length \? <DownloadAllButton arabic=\{arabic\} onPress=\{downloadAll\} \/> : null\}/);
  assert.match(page, /run\(\(\) => bookDownloadManager\.installAll\(\)\)/);
  assert.match(page, /function DownloadAllButton[\s\S]*?style=\{\(\{ pressed \}\) => \[styles\.downloadAll, pressed && styles\.pressed\]\}[\s\S]*?tr\('Download All', 'Tout télécharger', 'تنزيل الكل'\)/);
  // Nothing on the page turns round for Arabic: rows, the storage bar and chevrons keep the English layout.
  assert.doesNotMatch(page, /rowReverse|row-reverse|chevron-back|textAlign: 'right'/);
});

test('a change in the database reaches the books: rebuilt when their tables change, found when the app checks', () => {
  const publisher = fs.readFileSync('scripts/publish-content-packages.mjs', 'utf8');
  // Only the resources whose tables changed since the last publish are rebuilt,
  // measured by the database's clock, with the rest carried over as published.
  assert.match(publisher, /const CHANGED_ONLY = process\.argv\.includes\('--changed'\);/);
  assert.match(publisher, /rpc\('public', 'get_offline_content_changes'\)/);
  assert.match(publisher, /const since = Date\.parse\(previous\.changesThrough \|\| previous\.publishedAt\);/);
  assert.match(publisher, /resource\.schema === change\.schema && resource\.tables\.includes\(change\.table\)/);
  assert.match(publisher, /resources\[resource\.id\] = \{ \.\.\.previous\.resources\[resource\.id\], dependencies:/);
  // A moved calendar window, a changed plan, or a week since the last full build rebuild more.
  assert.match(publisher, /if \(previous\.calendarWindow\?\.start !== dates\[0\]\) \{ ids\.add\('calendar'\); ids\.add\('synaxarium'\); \}/);
  assert.match(publisher, /const FULL_REBUILD_MS = 7 \* 24 \* 60 \* 60 \* 1000;/);
  assert.match(publisher, /changesThrough: changes\?\.now \?\? publishedAt,/);
  assert.match(publisher, /console\.log\(`Up to date: \$\{build\.reason\}\.`\);\n  process\.exit\(0\);/);

  // It runs every half hour on GitHub, and by hand.
  const workflow = fs.readFileSync('.github/workflows/publish-content.yml', 'utf8');
  assert.match(workflow, /cron: "\*\/30 \* \* \* \*"/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /PUBLISH_TOKEN: \$\{\{ secrets\.PUBLISH_TOKEN \}\}/);
  assert.match(workflow, /node scripts\/publish-content-packages\.mjs \$\{\{ inputs\.everything && ' ' \|\| '--changed' \}\}/);
  // Unconfigured, it does nothing: no secret, no run; no record of changes, no rebuild.
  assert.match(workflow, /if \[ -z "\$PUBLISH_TOKEN" \]; then/);
  assert.match(publisher, /if \(!changes\) return \{ ids: new Set\(\), full: false,/);

  // A check says what it found and starts the downloads without waiting for them.
  const manager = fs.readFileSync('src/services/bookDownloadManager.ts', 'utf8');
  assert.match(manager, /async checkForUpdates\(manual = false\): Promise<BookUpdateCheck>/);
  assert.match(manager, /for \(const bookKey of updates\) void this\.install\(bookKey\)\.catch\(\(\) => undefined\);/);
  assert.match(manager, /return \{ updates, calendar, downloading, publishedAt: manifest\.publishedAt \};/);
  const page = fs.readFileSync('src/app/downloads.tsx', 'utf8');
  assert.match(page, /tr\('Updates found', 'Mises à jour trouvées', 'توجد تحديثات'\)/);
  assert.match(page, /tr\('Everything is up to date', 'Tout est à jour', 'كل شيء محدّث'\)/);
  // Coming back to the app looks for new editions on any connection, every ten minutes at most.
  const bootstrap = fs.readFileSync('src/components/BookSyncBootstrap.tsx', 'utf8');
  assert.match(bootstrap, /const UPDATE_CHECK_INTERVAL_MS = 10 \* 60 \* 1000;/);
  assert.ok(bootstrap.indexOf('checkForUpdates(false)') < bootstrap.indexOf("if (!isWifi(network.type)) return;"), 'the check comes before the Wi-Fi gate');
});
