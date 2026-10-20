const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

/**
 * Reads of installed (downloaded) content: a table is read from SQLite once
 * and kept until the active content changes, queries find their rows through
 * an index over it, callers get copies, and the calendar's answers about a
 * date or a year are kept for the session. Each module is loaded for real,
 * with its imports replaced by the stubs given.
 */
function loadModule(file, stubs) {
  const javascript = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const moduleObject = { exports: {} };
  const localRequire = (specifier) => {
    if (specifier in stubs) return stubs[specifier];
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

/** A stand-in for the offline database: tables are chunks of row JSON strings. */
function fakeDatabase(tables) {
  const calls = { tableLoads: 0, rowByRowLoads: 0, schemaLookups: 0 };
  let failNextLoad = false;
  const db = {
    async getAllAsync(sql, schema, table) {
      const chunks = tables[`${schema}.${table}`] || [];
      if (/group_concat/.test(sql)) {
        calls.tableLoads += 1;
        if (failNextLoad) {
          failNextLoad = false;
          throw new Error('database is locked');
        }
        return chunks.map((rows) => ({ rows_json: `[${rows.join(',')}]` }));
      }
      if (/SELECT cr\.row_json/.test(sql)) {
        calls.rowByRowLoads += 1;
        return chunks.flat().map((row_json) => ({ row_json }));
      }
      return [];
    },
    async getFirstAsync(sql, schema) {
      if (/SELECT 1 AS found/.test(sql)) {
        calls.schemaLookups += 1;
        return Object.keys(tables).some((key) => key.startsWith(`${schema}.`)) ? { found: 1 } : null;
      }
      if (/SELECT active_version/.test(sql)) return { active_version: 'v1' };
      return null;
    },
    async runAsync() { return { changes: 1 }; },
    async withExclusiveTransactionAsync(task) { await task(db); },
  };
  return { db, calls, failNextLoad: () => { failNextLoad = true; } };
}

function loadDatabase(tables) {
  const fake = fakeDatabase(tables);
  const database = loadModule('src/services/bookContentDatabase.ts', {
    '@/services/offlineDatabase': { getOfflineDatabase: async () => fake.db },
  });
  return { database, calls: fake.calls, failNextLoad: fake.failNextLoad };
}

const row = (value) => JSON.stringify(value);

test('an installed table is read once, shared while it loads, and kept in package order', async () => {
  const { database, calls } = loadDatabase({
    'calendar.season_ranges': [[row({ id: 1 }), row({ id: 2 })], [row({ id: 3 })]],
  });
  const [first, second] = await Promise.all([
    database.readLocalTable('calendar', 'season_ranges'),
    database.readLocalTable('calendar', 'season_ranges'),
  ]);
  assert.deepEqual(first.map((entry) => entry.id), [1, 2, 3], 'chunks are joined in order');
  assert.equal(first, second, 'callers asking together share one load');
  assert.equal(await database.readLocalTable('calendar', 'season_ranges'), first);
  assert.equal(calls.tableLoads, 1);
});

test('a table without its schema installed reads as null, and is not asked about again', async () => {
  const { database, calls } = loadDatabase({ 'calendar.season_ranges': [[row({ id: 1 })]] });
  assert.equal(await database.readLocalTable('bible', 'verses'), null);
  assert.equal(await database.readLocalTable('bible', 'verses'), null);
  assert.deepEqual(await database.readLocalTable('calendar', 'reading_rules'), [], 'an installed schema without the table is empty, not online');
  assert.equal(calls.tableLoads, 2);
});

test('activating, removing or changing the state of content forgets what was kept', async () => {
  const { database, calls } = loadDatabase({ 'calendar.season_ranges': [[row({ id: 1 })]] });
  await database.readLocalTable('calendar', 'season_ranges');
  assert.equal(await database.hasLocalSchema('calendar'), true);
  assert.equal(await database.hasLocalSchema('calendar'), true);
  assert.equal(calls.schemaLookups, 1, 'the schema answer is kept too');

  await database.activateSystemResource('calendar', 'v2', 10);
  await database.readLocalTable('calendar', 'season_ranges');
  assert.equal(calls.tableLoads, 2);
  await database.hasLocalSchema('calendar');
  assert.equal(calls.schemaLookups, 2);

  for (const change of [
    () => database.setResourceState('calendar', 'downloading'),
    () => database.activateBookResources('psalmody', []),
    () => database.removeBookReferences('psalmody'),
    () => database.prepareResourceVersion('calendar', 'v3'),
    () => database.cleanupObsoleteResourceVersions('calendar'),
  ]) {
    const before = calls.tableLoads;
    await change();
    await database.readLocalTable('calendar', 'season_ranges');
    assert.equal(calls.tableLoads, before + 1, String(change));
  }
});

test('a load that failed is not kept, and a row that does not parse is left out alone', async () => {
  const { database, calls, failNextLoad } = loadDatabase({
    'calendar.season_ranges': [[row({ id: 1 }), '{not json', row({ id: 3 })]],
  });
  failNextLoad();
  await assert.rejects(database.readLocalTable('calendar', 'season_ranges'), /database is locked/);
  const rows = await database.readLocalTable('calendar', 'season_ranges');
  assert.deepEqual(rows.map((entry) => entry.id), [1, 3]);
  assert.equal(calls.tableLoads, 2, 'the failed load was tried again');
  assert.equal(calls.rowByRowLoads, 1, 'the unparseable chunk was read row by row');
});

/** contentDataClient over a fixed set of local rows and a stub server. */
function loadClient({ tables = {}, installed = [], rpcResults = {}, server = {} }) {
  const kept = new Map();
  const calls = { online: [] };
  const bookContentDatabase = {
    readLocalTable: async (schema, table) => {
      const key = `${schema}.${table}`;
      if (!installed.includes(schema)) return null;
      if (!kept.has(key)) kept.set(key, (tables[key] || []).map((entry) => JSON.parse(JSON.stringify(entry))));
      return kept.get(key);
    },
    readLocalRpc: async (schema, name, args) => {
      const key = `${schema}.${name}:${JSON.stringify(args)}`;
      return key in rpcResults ? { found: true, data: rpcResults[key] } : { found: false, data: null };
    },
    hasLocalSchema: async (schema) => installed.includes(schema),
  };
  const supabase = {
    schema: (schema) => ({
      rpc: (name, args) => {
        calls.online.push(`${schema}.${name}`);
        const answer = server[`${schema}.${name}`];
        const thenable = {
          abortSignal() { return thenable; },
          then: (resolve, reject) => Promise.resolve(answer || { data: null, error: { message: 'TypeError: Network request failed' } }).then(resolve, reject),
        };
        return thenable;
      },
    }),
  };
  const client = loadModule('src/services/contentDataClient.ts', {
    '@/services/bookContentDatabase': bookContentDatabase,
    '@/utils/supabase': { supabase },
    // Content reads go through the content source (Supabase unless switched).
    '@/services/contentSource': { contentApi: supabase },
  }).contentDataClient;
  return { client, calls };
}

const DAYS = Array.from({ length: 400 }, (_, index) => {
  const date = new Date(Date.UTC(2026, 0, 1 + index));
  return {
    gregorian_date: date.toISOString().slice(0, 10),
    coptic_year: index < 254 ? 1742 : 1743,
    coptic_month: (Math.floor(index / 30) % 13) + 1,
    coptic_day: (index % 30) + 1,
    weekday: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getUTCDay()],
    tags: [index % 3],
  };
});

test('indexed queries find exactly the rows a full scan would, in the same order', async () => {
  const { client } = loadClient({ tables: { 'calendar.coptic_date_conversions': DAYS }, installed: ['calendar'] });
  const table = () => client.schema('calendar').from('coptic_date_conversions');

  const day = await table().select('coptic_year, coptic_day').eq('gregorian_date', '2026-10-15').maybeSingle();
  assert.deepEqual(day.data, { coptic_year: 1743, coptic_day: DAYS[287].coptic_day });

  // Numbers and their strings match each other, as applyFilter has them.
  const thoout = await table().select('gregorian_date').eq('coptic_year', '1743').eq('coptic_month', 1).eq('coptic_day', 1);
  assert.deepEqual(thoout.data, DAYS.filter((d) => d.coptic_year === 1743 && d.coptic_month === 1 && d.coptic_day === 1).map((d) => ({ gregorian_date: d.gregorian_date })));

  const sundays = await table().select('gregorian_date').in('weekday', ['Sunday', 'Saturday', 'Sunday']).lte('gregorian_date', '2026-02-01');
  assert.deepEqual(sundays.data.map((d) => d.gregorian_date), DAYS.filter((d) => ['Sunday', 'Saturday'].includes(d.weekday) && d.gregorian_date <= '2026-02-01').map((d) => d.gregorian_date));

  const next = await table().select('gregorian_date').gt('gregorian_date', '2026-12-30').order('gregorian_date').limit(1).maybeSingle();
  assert.deepEqual(next.data, { gregorian_date: '2026-12-31' });
  const previous = await table().select('gregorian_date').lt('gregorian_date', '2026-03-01').order('gregorian_date', { ascending: false }).limit(1).maybeSingle();
  assert.deepEqual(previous.data, { gregorian_date: '2026-02-28' });

  const missing = await table().select('*').eq('gregorian_date', '1999-01-01').maybeSingle();
  assert.equal(missing.data, null);
});

test('what a query returns is the caller’s own copy', async () => {
  const { client } = loadClient({ tables: { 'calendar.coptic_date_conversions': DAYS }, installed: ['calendar'] });
  const read = () => client.schema('calendar').from('coptic_date_conversions').select('*').eq('gregorian_date', '2026-01-01').maybeSingle();
  const first = await read();
  first.data.coptic_day = 99;
  first.data.tags.push('changed');
  const second = await read();
  assert.equal(second.data.coptic_day, 1);
  assert.deepEqual(second.data.tags, [0]);
});

test('an RPC the installed package lacks is asked of the server, and is a gap in the package only offline', async () => {
  const flags = { Nayrouz: true };
  const online = loadClient({ installed: ['calendar'], server: { 'calendar.get_context_flags': { data: flags, error: null } } });
  const answer = await online.client.schema('calendar').rpc('get_context_flags', { p_date: '2030-01-01', p_extra_context: {} });
  assert.deepEqual(answer, { data: flags, error: null });
  assert.deepEqual(online.calls.online, ['calendar.get_context_flags']);

  const offline = loadClient({ installed: ['calendar'] });
  const gap = await offline.client.schema('calendar').rpc('get_context_flags', { p_date: '2030-01-01', p_extra_context: {} });
  assert.equal(gap.error.code, 'OFFLINE_RPC_MISSING');

  const packaged = loadClient({ installed: ['calendar'], rpcResults: { 'calendar.get_context_flags:{"p_date":"2026-10-15","p_extra_context":{}}': flags } });
  const local = await packaged.client.schema('calendar').rpc('get_context_flags', { p_date: '2026-10-15', p_extra_context: {} });
  assert.deepEqual(local.data, flags);
  assert.deepEqual(packaged.calls.online, [], 'a packaged answer never goes online');

  const notInstalled = loadClient({});
  const serverError = await notInstalled.client.schema('calendar').rpc('get_context_flags', { p_date: '2030-01-01' });
  assert.match(serverError.error.message, /Network request failed/, 'without the package the server’s own error is returned');
});

test('the calendar keeps a date’s answer for the session, but never a failed one', async () => {
  let failing = true;
  let queries = 0;
  const query = {
    select() { return query; },
    eq() { return query; },
    maybeSingle() { return query; },
    then(resolve, reject) {
      queries += 1;
      const result = failing
        ? { data: null, error: { message: 'TypeError: Network request failed' } }
        : { data: { coptic_year: 1743, coptic_month: 2, coptic_month_name: 'Paopi', coptic_day: 5 }, error: null };
      return Promise.resolve(result).then(resolve, reject);
    },
  };
  const calendar = loadModule('src/utils/calendarService.ts', {
    '../services/contentDataClient': {
      contentDataClient: { schema: () => ({ from: () => query }) },
      isContentSchemaInstalled: async () => false,
    },
    '../constants/seasonNames': { getSeasonIndicatorKey: () => null },
  });
  const day = new Date(Date.UTC(2026, 9, 15));

  assert.equal(await calendar.getCopticDate(day), null);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calendar.peekCopticYearForDate(day), null);

  failing = false;
  assert.deepEqual(await calendar.getCopticDate(day), { monthName: 'Paopi', day: 5, year: 1743 });
  assert.equal(queries, 2, 'the failure was asked again');
  assert.equal(await calendar.getCopticYearForDate(day), 1743);
  assert.deepEqual(await calendar.getCopticMonthForDate(day), { coptic_year: 1743, coptic_month: 2, coptic_month_name: 'Paopi' });
  assert.equal(queries, 2, 'the answer was kept');
  assert.equal(calendar.peekCopticYearForDate(day), 1743, 'and can be read on a first frame');

  // Without the calendar on the device, warming it up fetches nothing.
  await calendar.warmCalendar();
  assert.equal(queries, 2);
});
