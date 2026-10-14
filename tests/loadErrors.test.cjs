const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');

function compile(path) {
  return ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}

/** loadErrors.ts with its two imports served from source, the stored App Language fixed. */
function loadErrors(language = 'en') {
  const modules = {};
  const load = (path, stubs) => {
    const moduleObject = { exports: {} };
    new Function('exports', 'require', 'module', compile(path))(
      moduleObject.exports,
      (id) => (id in stubs ? stubs[id] : require(id)),
      moduleObject,
    );
    return moduleObject.exports;
  };
  modules.preferences = { getCurrentAppLanguage: () => language };
  modules.appText = load('src/utils/appText.ts', { './preferencesStorage': modules.preferences });
  return load('src/utils/loadErrors.ts', { './appText': modules.appText, './preferencesStorage': modules.preferences });
}

test('each platform’s lost-connection message reads as being offline, with no raw detail', () => {
  const { describeLoadError, isLostConnectionMessage } = loadErrors();
  for (const message of [
    'TypeError: Network request failed',
    'TypeError: Failed to fetch',
    'TypeError: Load failed',
    'NetworkError when attempting to fetch resource.',
    'fetch failed',
    'net::ERR_INTERNET_DISCONNECTED',
    'The Internet connection appears to be offline.',
    'Unable to resolve host "wtuujmeinzqfikvuofmh.supabase.co"',
  ]) {
    assert.ok(isLostConnectionMessage(message), message);
    const described = describeLoadError(message);
    assert.equal(described.title, 'You’re offline', message);
    assert.equal(described.detail, null, message);
  }
});

test('any other failure keeps its own words under a generic title', () => {
  const { describeLoadError, isLostConnectionMessage } = loadErrors();
  const described = describeLoadError('Load Synaxarium year: permission denied for schema synaxarium');
  assert.equal(described.title, 'Couldn’t load this');
  assert.equal(described.detail, 'Load Synaxarium year: permission denied for schema synaxarium');
  // The app's own offline-book message is not a lost connection.
  assert.equal(isLostConnectionMessage('Offline package does not contain psalmody.get_hymns.'), false);
  assert.equal(describeLoadError(null).detail, null);
  assert.equal(describeLoadError('   ').detail, null);
});

test('the description follows the App Language', () => {
  assert.equal(loadErrors('fr').describeLoadError('Failed to fetch').title, 'Vous êtes hors ligne');
  assert.equal(loadErrors('ar').describeLoadError('boom').title, 'تعذّر التحميل');
  // …and an explicit language wins over the stored one.
  assert.equal(loadErrors('en').describeLoadError('Failed to fetch', 'ar').title, 'أنت غير متصل بالإنترنت');
});
