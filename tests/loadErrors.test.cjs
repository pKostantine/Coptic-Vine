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

test('a failed download says what to do, and the cause in a few words, never the exception it came wrapped in', () => {
  const { describeDownloadError } = loadErrors();
  const locked = "FunctionCallException: Calling the 'finalizeAsync' function has failed (at ExpoModulesCore/AsyncFunctionDefinition.swift:123) → Caused by: SQLiteErrorException: Error code 5: database is locked (at ExpoSQLite/SQLiteModule.swift:471)";
  assert.deepEqual(describeDownloadError(locked), { title: 'The download didn’t finish', hint: 'Please try again.', detail: 'database is locked' });
  assert.equal(describeDownloadError("Couldn't save liturgy: Package row count is 3; expected 4.").detail, "Couldn't save liturgy: Package row count is 3; expected 4.");
  assert.equal(describeDownloadError('Network request failed').title, 'You’re offline');
  assert.equal(describeDownloadError('Connect to the internet to start or update this download.').title, 'You’re offline');
  assert.equal(loadErrors('fr').describeDownloadError(locked).title, 'Le téléchargement n’a pas abouti');
  // The app's own reasons say what to do about them.
  const wifi = describeDownloadError('Downloads are set to Wi-Fi only.');
  assert.equal(wifi.title, 'Waiting for Wi‑Fi');
  assert.match(wifi.hint, /turn on Download over cellular on this page/);
  assert.equal(wifi.detail, null);
  assert.equal(describeDownloadError('Video downloads over cellular are turned off in Settings.').title, 'Waiting for Wi‑Fi');
  assert.equal(describeDownloadError('Error code 13: database or disk is full').title, 'Not enough space');
  // The Downloads page shows that, the cause after it, and keeps the message for the log.
  const page = fs.readFileSync('src/app/downloads.tsx', 'utf8');
  assert.match(page, /console\.warn\('Download failed:', error\.message\);\n\s+const \{ title, hint, detail \} = describeDownloadError\(error\.message\);\n\s+Alert\.alert\(title, detail \? `\$\{hint\}/);
  assert.doesNotMatch(page, /Alert\.alert\(tr\('Download', 'Téléchargement', 'التنزيل'\), error\.message\)/);
  // A book whose last try stopped says why on its row.
  assert.match(page, /detail = book\.error \? describeDownloadError\(book\.error\)\.title : tr\('Couldn’t finish downloading'/);
  assert.match(page, /const after = book\.error \? describeDownloadError\(book\.error\)\.title : size;/);
});
