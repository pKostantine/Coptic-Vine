const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

/**
 * Signing in and the user's data go to cv-api, and only there
 * (src/services/userApi.ts): signing in (src/services/accountAuth.ts) and the
 * supabase-js client (src/utils/api.ts). Each module is loaded for real, with
 * its imports replaced by stubs. The cv-api client itself is tested against
 * the Worker, in workers/api/tests/appAuth.test.ts. And nothing in the app
 * points at Supabase any more.
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
  Object.assign(process.env, env);
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

test('a phone signs in to cv-api with a bearer token and its own scheme, and checks the session on return, whatever the old switch says', () => {
  for (const old of [undefined, 'supabase']) {
    const { module, created, appState } = loadUserApi(old ? { EXPO_PUBLIC_USER_DATA_SOURCE: old } : {});
    assert.equal(module.USER_DATA_SOURCE, undefined, 'there is no switch');
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
  }
});

test('on the web the cookie is the session, and another address can be given', () => {
  const { module, created, appState } = loadUserApi({ EXPO_PUBLIC_USER_API_URL: 'http://localhost:8790/' }, 'web');
  assert.equal(module.USER_API_URL, 'http://localhost:8790');
  assert.equal(created[0].options.baseUrl, 'http://localhost:8790');
  assert.equal(created[0].options.native, false);
  assert.equal(typeof created[0].options.replaceUrl, 'function');
  assert.equal(appState.length, 0);
});

/** utils/api with a recording createClient. */
function loadClient(cvApiAuth) {
  const created = [];
  const module = withEnv({}, () => loadModule(source('utils/api.ts'), {
    'expo-sqlite/localStorage/install': {},
    'react-native-url-polyfill/auto': {},
    '@supabase/supabase-js': { createClient: (url, key, options) => { const client = { url, key, options }; created.push(client); return client; } },
    '@/services/userApi': { cvApiAuth, USER_API_URL: 'https://api.copticvine.ca' },
  }));
  return { module, created };
}

test('the data client goes to cv-api with cv-api\'s session, and never signs in itself', () => {
  const cvApiAuth = { accessToken: async () => 'token', fetch: async () => new Response('null') };
  const { module, created } = loadClient(cvApiAuth);
  assert.equal(created.length, 1);
  assert.equal(module.api, created[0]);
  assert.equal(created[0].url, 'https://api.copticvine.ca');
  assert.equal(created[0].key, 'cv-api', 'a placeholder: cv-api has no key');
  assert.equal(created[0].options.accessToken, cvApiAuth.accessToken);
  assert.equal(created[0].options.global.fetch, cvApiAuth.fetch);
  assert.equal(created[0].options.auth, undefined);
});

test('signing in is cv-api\'s client', () => {
  const cvApiAuth = { name: 'cv-api' };
  assert.equal(loadModule(source('services/accountAuth.ts'), { '@/services/userApi': { cvApiAuth } }).accountAuth, cvApiAuth);
});

test('nothing in the app points at Supabase: no address, key or variable of its own', () => {
  const root = path.join(__dirname, '..');
  const files = ['.env', 'app.json', 'eas.json', 'wrangler.jsonc', 'workers/web-app/src/index.js', 'scripts/publish-content-packages.mjs'];
  const walk = (dir) => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]));
  for (const file of [...files, ...walk('src')]) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    assert.doesNotMatch(text, /supabase\.co|sb_publishable_|EXPO_PUBLIC_SUPABASE_|EXPO_PUBLIC_USER_DATA_SOURCE|EXPO_PUBLIC_CONTENT_SOURCE/, file);
  }
});
