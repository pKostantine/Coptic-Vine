const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

/**
 * The Synaxarium from a downloaded Liturgy (utils/synaxariumLocal.ts, read by
 * services/contentDataClient.ts): the Synaxarium page's year, Home's saints
 * and a day's entries are worked out on the device from the package's own
 * tables, in the content Worker's shapes, and the server is asked only when
 * nothing is downloaded. Checked against the live Worker over the real rows
 * when written: 40 answers, the same.
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

const local = loadModule('src/utils/synaxariumLocal.ts', {});

const day = (gregorian_date, coptic_month, coptic_day, extra = {}) => ({
  gregorian_date, coptic_year: 1743, coptic_month, coptic_month_name: coptic_month === 2 ? 'Paope' : 'Thoout', coptic_day, weekday_number: 6, coptic_date_label: `Day ${coptic_day}`, ...extra,
});
const DAYS = [day('2026-10-31', 2, 21), day('2026-10-30', 2, 20), day('2026-11-01', 2, 22)];
const ENTRIES = [
  { entry_key: 'joel', coptic_month: 2, coptic_day: 21, entry_order: 2, title_english: 'The Departure of Joel the Prophet', title_arabic: 'يوئيل' },
  { entry_key: 'roweis', coptic_month: 2, coptic_day: 21, entry_order: null, title_english: 'Anba Roweis', title_arabic: null },
  { entry_key: 'theotokos', coptic_month: 2, coptic_day: 21, entry_order: 1, title_english: 'The Commemoration of the Theotokos', title_arabic: 'العذراء' },
  { entry_key: 'lazarus', coptic_month: 2, coptic_day: 21, entry_order: null, title_english: 'Lazarus', title_arabic: null },
  { entry_key: 'luke', coptic_month: 2, coptic_day: 22, entry_order: 1, title_english: 'St Luke', title_arabic: 'لوقا' },
];
const NAMES = { coptic_month: 2, coptic_day: 1, coptic_month_name_english: 'Paope', coptic_month_name_arabic: 'بابه' };

test("the year's days in date order, each with its saints in order, unordered ones last as they come; a day without any still listed", () => {
  const rows = local.synaxariumYearRows(DAYS, ENTRIES);
  assert.deepEqual(rows.map((row) => [row.gregorianDate, row.entryKey]), [
    ['2026-10-30', null],
    ['2026-10-31', 'theotokos'], ['2026-10-31', 'joel'], ['2026-10-31', 'roweis'], ['2026-10-31', 'lazarus'],
    ['2026-11-01', 'luke'],
  ]);
  assert.deepEqual(rows[0], {
    gregorianDate: '2026-10-30', copticYear: 1743, copticMonth: 2, copticMonthName: 'Paope', copticDay: 20, weekdayNumber: 6,
    entryKey: null, entryOrder: null, titleEnglish: null, titleArabic: null,
  });
  assert.equal(rows[3].titleArabic, null);
});

test("Home's saints of a day, in order; none for a day the calendar doesn't have", () => {
  assert.deepEqual(local.homeSynaxariumEvents(DAYS[2], ENTRIES), [{ entryKey: 'luke', titleEnglish: 'St Luke', titleArabic: 'لوقا', entryOrder: 1 }]);
  assert.deepEqual(local.homeSynaxariumEvents(null, ENTRIES), []);
});

test("a day's entries with their text, paragraph by paragraph, trimmed of spaces as Postgres trims, and the day's blessing", () => {
  const saints = local.saintsOfDay(ENTRIES, 2, 21);
  const texts = [
    { entry_key: 'joel', line_order: 2, english: 'Second.  ', arabic: null },
    { entry_key: 'joel', line_order: 1, english: '  First.', arabic: ' الأولى ' },
    { entry_key: 'theotokos', line_order: 1, english: '   ', arabic: 'نص' },
  ];
  const json = local.synaxariumDayJson(DAYS[0], saints, texts, NAMES);
  assert.equal(json.coptic_date, 'Day 21');
  assert.deepEqual(json.entries.map((entry) => entry.entry_key), ['theotokos', 'joel', 'roweis', 'lazarus']);
  const joel = json.entries[1];
  assert.equal(joel.english, 'First.\n\nSecond.');
  assert.equal(joel.arabic, 'الأولى');
  assert.deepEqual(joel.paragraphs, [{ line_order: 1, english: 'First.', arabic: 'الأولى' }, { line_order: 2, english: 'Second.', arabic: null }]);
  assert.equal(json.entries[0].english, null, 'only spaces is nothing');
  assert.deepEqual(json.entries[2].paragraphs, []);
  assert.match(json.intro.english, /^Today is the twenty first day of the blessed month of Paope\. May God end it in goodness/);
  assert.equal(local.synaxariumDayJson(null, [], [], NAMES), null);
});

test("the blessing begins the month until the 15th (Nesi's 3rd), ends it after, and isn't given past the month's days", () => {
  assert.match(local.synaxariumIntro(2, 15, NAMES).english, /fifteenth day .* May God begin it in goodness/);
  assert.match(local.synaxariumIntro(2, 16, NAMES).english, /sixteenth day .* May God end it in goodness/);
  assert.match(local.synaxariumIntro(13, 3, NAMES).english, /begin it/);
  assert.match(local.synaxariumIntro(13, 4, NAMES).english, /end it/);
  assert.equal(local.synaxariumIntro(13, 7, NAMES), null);
  assert.equal(local.synaxariumIntro(2, 31, NAMES), null);
  assert.equal(local.synaxariumIntro(2, 1, null), null, 'no Arabic month name, no blessing');
  assert.equal(local.synaxariumIntro(2, 1, { ...NAMES, coptic_month_name_english: null }).english, null);
});

/** contentDataClient over downloaded rows and a stub server, as tests/contentReadCache.test.cjs has it. */
function loadClient({ installed = ['synaxarium', 'calendar'], rpcResults = {}, server = {} } = {}) {
  const tables = {
    'calendar.coptic_date_conversions': DAYS,
    'synaxarium.entries': ENTRIES,
    'synaxarium.entry_texts': [{ entry_key: 'luke', line_order: 1, english: 'Luke wrote.', arabic: 'كتب لوقا.' }],
    'synaxarium.coptic_days': [NAMES],
  };
  const kept = new Map();
  const calls = { online: [] };
  const bookContentDatabase = {
    readLocalTable: async (schema, table) => {
      if (!installed.includes(schema)) return null;
      const key = `${schema}.${table}`;
      if (!kept.has(key)) kept.set(key, JSON.parse(JSON.stringify(tables[key] || [])));
      return kept.get(key);
    },
    readLocalRpc: async (schema, name, args) => {
      const key = `${schema}.${name}:${JSON.stringify(args)}`;
      return key in rpcResults ? { found: true, data: rpcResults[key] } : { found: false, data: null };
    },
    hasLocalSchema: async (schema) => installed.includes(schema),
    isLocalTableKept: (schema, table) => kept.has(`${schema}.${table}`),
    isLocalTableOversized: () => false,
    readLocalRowsWhere: async (schema, table, equalities) => {
      if (!installed.includes(schema)) return null;
      return (tables[`${schema}.${table}`] || [])
        .filter((row) => equalities.every(({ column, value }) => row[column] != null && String(row[column]) === String(value)))
        .map((row) => JSON.parse(JSON.stringify(row)));
    },
    countLocalRows: async () => [],
  };
  const contentApi = {
    schema: (schema) => ({
      rpc: (name) => {
        calls.online.push(`${schema}.${name}`);
        const answer = server[`${schema}.${name}`] || { data: null, error: { message: 'TypeError: Network request failed' } };
        const thenable = { abortSignal() { return thenable; }, then: (resolve, reject) => Promise.resolve(answer).then(resolve, reject) };
        return thenable;
      },
    }),
  };
  const client = loadModule('src/services/contentDataClient.ts', {
    '@/services/bookContentDatabase': bookContentDatabase,
    '@/services/contentSource': { contentApi },
    '@/utils/api': { api: contentApi },
  }).contentDataClient;
  return { client, calls };
}

test('downloaded, the Synaxarium page and Home read the saints on the device, and never ask the server', async () => {
  const { client, calls } = loadClient();
  const year = await client.rpc('get_synaxarium_year', { p_reference_date: '2026-10-31' });
  assert.equal(year.error, null);
  assert.deepEqual(year.data, local.synaxariumYearRows(DAYS, ENTRIES));
  const home = await client.rpc('get_home_synaxarium_events', { p_date: '2026-11-01' });
  assert.deepEqual(home.data, [{ entryKey: 'luke', titleEnglish: 'St Luke', titleArabic: 'لوقا', entryOrder: 1 }]);
  assert.deepEqual(calls.online, []);
});

test("a saint's entry: the package's own answer inside its window, worked out on the device past it", async () => {
  const packaged = { gregorian_date: '2026-11-01', entries: [{ entry_key: 'luke', from: 'package' }] };
  const { client, calls } = loadClient({ rpcResults: { 'synaxarium.get_day_json:{"p_date":"2026-11-01"}': packaged } });
  assert.deepEqual((await client.schema('synaxarium').rpc('get_day_json', { p_date: '2026-11-01' })).data, packaged);
  const worked = await client.schema('synaxarium').rpc('get_day_json', { p_date: '2026-10-31' });
  assert.deepEqual(worked.data.entries.map((entry) => entry.entry_key), ['theotokos', 'joel', 'roweis', 'lazarus']);
  assert.match(worked.data.intro.english, /twenty first day of the blessed month of Paope/);
  assert.deepEqual(calls.online, []);
});

test("not downloaded, or a date the downloaded calendar doesn't have, the server answers", async () => {
  const server = { 'public.get_synaxarium_year': { data: [{ from: 'server' }], error: null } };
  const none = loadClient({ installed: [], server });
  assert.deepEqual((await none.client.rpc('get_synaxarium_year', { p_reference_date: '2026-10-31' })).data, [{ from: 'server' }]);
  assert.deepEqual(none.calls.online, ['public.get_synaxarium_year']);
  const outside = loadClient({ server });
  assert.deepEqual((await outside.client.rpc('get_synaxarium_year', { p_reference_date: '1999-01-01' })).data, [{ from: 'server' }]);
  assert.deepEqual(outside.calls.online, ['public.get_synaxarium_year']);
});

test('Home and the Synaxarium page ask through the client that reads downloads first', () => {
  const home = fs.readFileSync('src/services/homeService.ts', 'utf8');
  assert.match(home, /contentDataClient\.rpc\('get_home_synaxarium_events', \{ p_date: date \}\)/);
  assert.match(home, /contentDataClient\.rpc\('get_synaxarium_year', \{ p_reference_date: referenceDate \}\)/);
  assert.doesNotMatch(home, /contentApi\.rpc\('get_(home_synaxarium_events|synaxarium_year)'/);
});
