const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

/**
 * The content client (src/services/contentSource.ts): content reads go to the
 * D1 content Worker through a supabase-js client of their own that keeps no
 * session. Each module is loaded for real, with its imports replaced by stubs.
 */
function loadModule(file, stubs) {
  const javascript = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const moduleObject = { exports: {} };
  const localRequire = (specifier) => {
    if (specifier in stubs) return stubs[specifier];
    return require(specifier);
  };
  new Function('exports', 'require', 'module', javascript)(moduleObject.exports, localRequire, moduleObject);
  return moduleObject.exports;
}

const root = path.join(__dirname, '..');
const source = (file) => path.join(root, 'src', file);

/** A supabase-js stand-in that records what was asked of it. */
function fakeClient(name, answer = { data: [], error: null }) {
  const calls = [];
  const builder = (call) => {
    const chain = {
      select: (s) => { call.select = s; return chain; },
      eq: (c, v) => { (call.filters ||= []).push(['eq', c, v]); return chain; },
      then: (resolve, reject) => Promise.resolve(answer).then(resolve, reject),
    };
    return chain;
  };
  const client = {
    name,
    calls,
    schema: (schema) => ({
      from: (table) => { const call = { kind: 'from', schema, table }; calls.push(call); return builder(call); },
      rpc: (fn, args) => { calls.push({ kind: 'rpc', schema, fn, args }); return { abortSignal: () => this, then: (resolve, reject) => Promise.resolve(answer).then(resolve, reject) }; },
    }),
    rpc: (fn, args) => { calls.push({ kind: 'rpc', schema: 'public', fn, args }); return Promise.resolve(answer); },
  };
  return client;
}

function loadContentSource(env) {
  const saved = { ...process.env };
  delete process.env.EXPO_PUBLIC_CONTENT_API_URL;
  Object.assign(process.env, env);
  const created = [];
  try {
    const module = loadModule(source('services/contentSource.ts'), {
      '@supabase/supabase-js': { createClient: (url, key, options) => { const client = fakeClient('worker'); created.push({ url, key, options, client }); return client; } },
    });
    return { module, created };
  } finally {
    process.env = saved;
  }
}

test('content is read from the content Worker, on a client with no session and no real key', () => {
  const { module, created } = loadContentSource({});
  assert.equal(created.length, 1);
  assert.equal(created[0].url, 'https://content.copticvine.ca');
  assert.equal(created[0].key, 'public');
  assert.deepEqual(created[0].options.auth, { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'cv-content-api' });
  assert.equal(module.contentApi, created[0].client);
  assert.equal(module.CONTENT_SOURCE, undefined, 'there is no switch back to another source');

  const custom = loadContentSource({ EXPO_PUBLIC_CONTENT_API_URL: 'https://example.workers.dev/' });
  assert.equal(custom.created[0].url, 'https://example.workers.dev');
});

test('contentDataClient sends table reads and RPCs it cannot answer offline to the content source', async () => {
  const contentApi = fakeClient('content', { data: [{ hymn_key: 'x' }], error: null });
  const { contentDataClient } = loadModule(source('services/contentDataClient.ts'), {
    '@/services/bookContentDatabase': { hasLocalSchema: async () => false, readLocalRpc: async () => ({ found: false }), readLocalTable: async () => null },
    '@/services/contentSource': { contentApi },
  });
  const rows = await contentDataClient.schema('liturgy').from('hymn_titles').select('hymn_key').eq('hymn_key', 'x');
  assert.deepEqual(rows.data, [{ hymn_key: 'x' }]);
  await contentDataClient.schema('calendar').rpc('get_context_flags', { p_date: '2026-10-20', p_extra_context: {} });
  assert.deepEqual(contentApi.calls.map((call) => [call.kind, call.schema, call.table || call.fn]), [['from', 'liturgy', 'hymn_titles'], ['rpc', 'calendar', 'get_context_flags']]);
});

test('on web, contentDataClient is the content source itself', () => {
  const contentApi = fakeClient('content');
  const web = loadModule(source('services/contentDataClient.web.ts'), { '@/services/contentSource': { contentApi } });
  assert.equal(web.contentDataClient, contentApi);
  assert.doesNotMatch(fs.readFileSync(source('services/contentDataClient.web.ts'), 'utf8'), /@\/utils\/api/);
});

test('the home screen reads its calendar and Synaxarium from the content source', async () => {
  const contentApi = fakeClient('content', { data: 'A Sunday message', error: null });
  const home = loadModule(source('services/homeService.ts'), { '@/services/contentSource': { contentApi } });
  assert.equal(await home.getSundayMessage('2026-10-25'), 'A Sunday message');
  assert.deepEqual(contentApi.calls.map((call) => call.fn), ['get_sunday_message']);
  const text = fs.readFileSync(source('services/homeService.ts'), 'utf8');
  for (const fn of ['get_sunday_message', 'get_home_synaxarium_events', 'get_synaxarium_year']) {
    assert.match(text, new RegExp(`contentApi\\.rpc\\('${fn}'`));
  }
});

test('every content module reads through contentDataClient, not the user-data client', () => {
  const contentModules = ['utils/hymnLibrary.js', 'utils/saintHymns.ts', 'utils/calendarService.ts', 'utils/conditionEngine.js', 'utils/readingsService.ts', 'utils/readingCalendarRules.ts', 'utils/readingReferenceResolver.js', 'utils/bibleService.ts', 'utils/bibleSearch.ts'];
  for (const file of contentModules) {
    const text = fs.readFileSync(source(file), 'utf8');
    assert.doesNotMatch(text, /from ['"]@\/utils\/api['"]|from ['"]\.\/api['"]/, `${file} must not import the user-data client`);
    assert.match(text, /contentDataClient as supabase/, `${file} reads through contentDataClient`);
  }
});
