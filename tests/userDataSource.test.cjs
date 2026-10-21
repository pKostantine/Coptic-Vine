const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

/**
 * The switch for signing in and the user's data (src/services/userApi.ts):
 * Supabase unless EXPO_PUBLIC_USER_DATA_SOURCE is 'cloudflare', and then
 * cv-api, for signing in (src/services/accountAuth.ts) and for the supabase-js
 * client (src/utils/supabase.ts). Each module is loaded for real, with its
 * imports replaced by stubs. The cv-api client itself is tested against the
 * Worker, in workers/api/tests/appAuth.test.ts.
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

const source = (file) => path.join(__dirname, '..', 'src', file);

function withEnv(env, load) {
  const saved = { ...process.env };
  delete process.env.EXPO_PUBLIC_USER_DATA_SOURCE;
  delete process.env.EXPO_PUBLIC_USER_API_URL;
  Object.assign(process.env, { EXPO_PUBLIC_SUPABASE_URL: 'https://project.supabase.co', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon-key' }, env);
  try {
    return load();
  } finally {
    process.env = saved;
  }
}

/** userApi on a phone (or the web), with the options it gives the cv-api client and the app-state listeners it adds. */
function loadUserApi(env, os = 'ios') {
  const created = [];
  const appState = [];
  const module = withEnv(env, () => loadModule(source('services/userApi.ts'), {
    'expo-linking': { createURL: (path) => `copticvine://${path}` },
    'expo-web-browser': { openAuthSessionAsync: async () => ({ type: 'cancel' }), dismissAuthSession() {} },
    'react-native': { Platform: { OS: os }, AppState: { addEventListener: (event, listener) => appState.push({ event, listener }) } },
    '@/services/cvApiAuth': { createCvApiAuth: (options) => { const client = { options, refreshed: 0, refresh() { this.refreshed += 1; } }; created.push(client); return client; } },
    '@/utils/authMessages': { authMessage: (key) => `message:${key}` },
  }));
  return { module, created, appState };
}

test('signing in and the user\'s data stay on Supabase unless the source is cloudflare', () => {
  for (const source of [undefined, 'supabase', 'something-else']) {
    const { module, created, appState } = loadUserApi(source ? { EXPO_PUBLIC_USER_DATA_SOURCE: source } : {});
    assert.equal(module.USER_DATA_SOURCE, 'supabase', String(source));
    assert.equal(module.cvApiAuth, null);
    assert.equal(created.length, 0);
    assert.equal(appState.length, 0);
  }
});

test('with cloudflare, a phone signs in to cv-api with a bearer token and its own scheme, and checks the session on return', () => {
  const { module, created, appState } = loadUserApi({ EXPO_PUBLIC_USER_DATA_SOURCE: 'cloudflare' });
  assert.equal(module.USER_DATA_SOURCE, 'cloudflare');
  assert.equal(module.USER_API_URL, 'https://api.copticvine.ca');
  assert.equal(module.cvApiAuth, created[0]);
  const { options } = created[0];
  assert.equal(options.baseUrl, 'https://api.copticvine.ca');
  assert.equal(options.native, true);
  assert.equal(options.appOrigin, 'copticvine://');
  assert.equal(options.callbackPath, 'account');
  assert.equal(options.replaceUrl, undefined);
  assert.equal(options.message('signIn'), 'message:signIn');

  assert.deepEqual(appState.map((entry) => entry.event), ['change']);
  appState[0].listener('background');
  appState[0].listener('active');
  assert.equal(created[0].refreshed, 1);
});

test('with cloudflare on the web, the cookie is the session, and another address can be given', () => {
  const { module, created, appState } = loadUserApi({ EXPO_PUBLIC_USER_DATA_SOURCE: 'cloudflare', EXPO_PUBLIC_USER_API_URL: 'http://localhost:8790/' }, 'web');
  assert.equal(module.USER_API_URL, 'http://localhost:8790');
  assert.equal(created[0].options.baseUrl, 'http://localhost:8790');
  assert.equal(created[0].options.native, false);
  assert.equal(typeof created[0].options.replaceUrl, 'function');
  assert.equal(appState.length, 0);
});

/** utils/supabase with a recording createClient. */
function loadClient(cvApiAuth, os = 'ios') {
  const created = [];
  const appState = [];
  const module = withEnv({}, () => loadModule(source('utils/supabase.ts'), {
    'expo-sqlite/localStorage/install': {},
    'react-native-url-polyfill/auto': {},
    'react-native': { Platform: { OS: os }, AppState: { addEventListener: (event, listener) => appState.push({ event, listener }) } },
    '@supabase/supabase-js': { createClient: (url, key, options) => { const client = { url, key, options }; created.push(client); return client; } },
    '@/services/userApi': { cvApiAuth, USER_API_URL: 'https://api.copticvine.ca' },
  }));
  return { module, created, appState };
}

test('the data client goes to cv-api with cv-api\'s session, and never signs in itself', () => {
  const cvApiAuth = { accessToken: async () => 'token', fetch: async () => new Response('null') };
  const { module, created, appState } = loadClient(cvApiAuth);
  assert.equal(created.length, 1);
  assert.equal(module.supabase, created[0]);
  assert.equal(created[0].url, 'https://api.copticvine.ca');
  assert.equal(created[0].options.accessToken, cvApiAuth.accessToken);
  assert.equal(created[0].options.global.fetch, cvApiAuth.fetch);
  assert.equal(created[0].options.auth, undefined);
  assert.equal(appState.length, 0, 'no Supabase token to refresh');
});

test('with Supabase, the data client is Supabase\'s, as before', () => {
  const { created, appState } = loadClient(null);
  assert.equal(created[0].url, 'https://project.supabase.co');
  assert.equal(created[0].options.auth.persistSession, true);
  assert.equal(created[0].options.accessToken, undefined);
  assert.deepEqual(appState.map((entry) => entry.event), ['change']);
});

test('signing in goes to cv-api\'s client when there is one, and to Supabase Auth otherwise', () => {
  const stubs = (cvApiAuth, supabase = { auth: {} }) => ({
    'expo-web-browser': {},
    'react-native': { Platform: { OS: 'ios' } },
    '@/services/userApi': { cvApiAuth },
    '@/utils/authMessages': { authMessage: (key) => key },
    '@/utils/supabase': { supabase },
  });
  const cvApiAuth = { name: 'cv-api' };
  assert.equal(loadModule(source('services/accountAuth.ts'), stubs(cvApiAuth)).accountAuth, cvApiAuth);

  const { accountAuth } = loadModule(source('services/accountAuth.ts'), stubs(null, {
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }) },
  }));
  assert.equal(accountAuth.needsCurrentPassword, false);
  assert.equal(accountAuth.readsWebCallbacks, false);
  return accountAuth.getUser().then((user) => assert.equal(user.id, 'user-1'));
});
