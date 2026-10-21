const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

/**
 * The content data-source switch (src/services/contentSource.ts): content reads
 * stay on Supabase unless EXPO_PUBLIC_CONTENT_SOURCE is 'cloudflare', and then
 * go to the D1 content Worker through a supabase-js client that keeps no
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

function loadContentSource(env, userDataSource = 'supabase') {
  const saved = { ...process.env };
  delete process.env.EXPO_PUBLIC_CONTENT_SOURCE;
  delete process.env.EXPO_PUBLIC_CONTENT_API_URL;
  Object.assign(process.env, { EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon-key', EXPO_PUBLIC_SUPABASE_URL: 'https://project.supabase.co' }, env);
  const created = [];
  const supabase = fakeClient('supabase');
  try {
    const module = loadModule(source('services/contentSource.ts'), {
      '@/services/userApi': { USER_DATA_SOURCE: userDataSource },
      '@/utils/supabase': { supabase },
      '@supabase/supabase-js': { createClient: (url, key, options) => { const client = fakeClient('worker'); created.push({ url, key, options, client }); return client; } },
    });
    return { module, created, supabase };
  } finally {
    process.env = saved;
  }
}

test('content is read from Supabase only when the source is set to supabase', () => {
  const { module, created, supabase } = loadContentSource({ EXPO_PUBLIC_CONTENT_SOURCE: 'supabase' });
  assert.equal(module.CONTENT_SOURCE, 'supabase');
  assert.equal(module.contentApi, supabase);
  assert.equal(created.length, 0);

  const other = loadContentSource({ EXPO_PUBLIC_CONTENT_SOURCE: 'something-else' });
  assert.equal(other.module.CONTENT_SOURCE, 'cloudflare');
  assert.notEqual(other.module.contentApi, other.supabase);
});

test('back on Supabase once user data is on cv-api, content gets a Supabase client of its own', () => {
  // The signed-in client then sends everything to cv-api, which keeps no content.
  const { module, created, supabase } = loadContentSource({ EXPO_PUBLIC_CONTENT_SOURCE: 'supabase' }, 'cloudflare');
  assert.equal(created.length, 1);
  assert.equal(created[0].url, 'https://project.supabase.co');
  assert.equal(created[0].key, 'anon-key');
  assert.deepEqual(created[0].options.auth, { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'cv-content-supabase' });
  assert.equal(module.contentApi, created[0].client);
  assert.notEqual(module.contentApi, supabase);

  const worker = loadContentSource({}, 'cloudflare');
  assert.equal(worker.created[0].url, 'https://content.copticvine.ca');
});

test('by default content goes to the Worker, on a client with no session', () => {
  const { module, created } = loadContentSource({});
  assert.equal(module.CONTENT_SOURCE, 'cloudflare');
  assert.equal(created.length, 1);
  assert.equal(created[0].url, 'https://content.copticvine.ca');
  assert.equal(created[0].key, 'anon-key');
  assert.deepEqual(created[0].options.auth, { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'cv-content-api' });
  assert.equal(module.contentApi, created[0].client);

  const custom = loadContentSource({ EXPO_PUBLIC_CONTENT_SOURCE: 'cloudflare', EXPO_PUBLIC_CONTENT_API_URL: 'https://example.workers.dev/' });
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
  assert.doesNotMatch(fs.readFileSync(source('services/contentDataClient.web.ts'), 'utf8'), /@\/utils\/supabase/);
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

test('every content module reads through contentDataClient, not the Supabase client directly', () => {
  const contentModules = ['utils/hymnLibrary.js', 'utils/saintHymns.ts', 'utils/calendarService.ts', 'utils/conditionEngine.js', 'utils/readingsService.ts', 'utils/readingCalendarRules.ts', 'utils/readingReferenceResolver.js', 'utils/bibleService.ts', 'utils/bibleSearch.ts'];
  for (const file of contentModules) {
    const text = fs.readFileSync(source(file), 'utf8');
    assert.doesNotMatch(text, /from ['"]@\/utils\/supabase['"]|from ['"]\.\/supabase['"]/, `${file} must not import the Supabase client`);
    assert.match(text, /contentDataClient as supabase/, `${file} reads through contentDataClient`);
  }
});
