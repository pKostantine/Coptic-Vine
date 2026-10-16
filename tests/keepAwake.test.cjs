const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');

function compile(path) {
  return ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}

function load(path, stubs = {}) {
  const moduleObject = { exports: {} };
  new Function('exports', 'require', 'module', compile(path))(
    moduleObject.exports,
    (id) => (id in stubs ? stubs[id] : require(id)),
    moduleObject,
  );
  return moduleObject.exports;
}

/** preferencesStorage.ts on the web, with the device-class and font modules it reads at import stubbed. */
function loadPreferences() {
  const theme = load('src/constants/theme.ts');
  return load('src/utils/preferencesStorage.ts', {
    '../constants/documentThemes': load('src/constants/documentThemes.ts', { './theme': theme }),
    'expo-device': { deviceType: 1, osName: 'iOS' },
    'react-native': { Dimensions: { get: () => ({ width: 390, height: 844 }) }, Platform: { OS: 'web' } },
    './kiahkInterpretations': load('src/utils/kiahkInterpretations.ts'),
    './readingFontSize': {
      classifyReadingDevice: () => 'phone',
      DEFAULT_FONT_SCALE: 1.571,
      FONT_SCALE_STEP: 2 / 14,
      FONT_SCALE_VERSION: 2,
      fontLevelCount: () => 13,
      fontScaleToLevel: (scale) => Math.round((scale - 1) * 7) + 1,
      fontScaleToPx: (scale) => Math.round(14 * scale),
      maxFontScaleForScreen: () => 2.714,
      MIN_FONT_SCALE: 1,
      readStoredFontScale: (stored) => (Number.isFinite(Number(stored?.fontScale)) ? Number(stored.fontScale) : 1.5),
      snapFontScale: (value) => value,
      stepFontScale: (value, delta) => value + delta,
    },
  });
}

test('keeping the screen on while reading is on by default and remembered per device', () => {
  const { DEFAULT_READING_PREFERENCES, applySyncedReadingPreferences, syncedReadingPreferences } = loadPreferences();
  assert.equal(DEFAULT_READING_PREFERENCES.keepScreenAwake, true);
  // A device choice: never sent to the account, and never overwritten by it.
  assert.equal('keepScreenAwake' in syncedReadingPreferences(DEFAULT_READING_PREFERENCES), false);
  const local = { ...DEFAULT_READING_PREFERENCES, keepScreenAwake: false };
  assert.equal(applySyncedReadingPreferences(local, { keepScreenAwake: true, appLanguage: 'fr' }).keepScreenAwake, false);
});

test('a stored choice is honoured and anything else falls back to on', async () => {
  const { loadReadingPreferences } = loadPreferences();
  const stored = {};
  Object.defineProperty(globalThis, 'window', {
    value: { localStorage: { getItem: (key) => stored[key] ?? null, setItem: (key, value) => { stored[key] = value; } } },
    configurable: true,
    writable: true,
  });
  stored['chc-reading-preferences'] = JSON.stringify({ keepScreenAwake: false });
  assert.equal((await loadReadingPreferences()).keepScreenAwake, false);
  stored['chc-reading-preferences'] = JSON.stringify({ keepScreenAwake: 'yes' });
  assert.equal((await loadReadingPreferences()).keepScreenAwake, true);
  stored['chc-reading-preferences'] = JSON.stringify({});
  assert.equal((await loadReadingPreferences()).keepScreenAwake, true);
});

test('the hook takes the lock again when the page comes back, and both readers use it while focused', () => {
  const hook = fs.readFileSync('src/utils/useReadingKeepAwake.ts', 'utf8');
  // The browser releases a wake lock whenever the page is hidden; without
  // this, one glance at another tab would leave the screen free to sleep.
  assert.match(hook, /addEventListener\('visibilitychange'/);
  assert.match(hook, /document\.visibilityState === 'visible'\) acquire\(\)/);
  // A failed request (no API, no permission) must never surface as an error in the reader.
  assert.match(hook, /activateKeepAwakeAsync\(TAG\)\.catch\(\(\) => \{\}\)/);
  assert.match(hook, /deactivateKeepAwake\(TAG\)\.catch\(\(\) => \{\}\)/);

  for (const reader of ['src/components/vine/screens/ServiceDocument.tsx', 'src/app/bible/[bookKey]/[chapter].tsx']) {
    assert.match(fs.readFileSync(reader, 'utf8'), /useReadingKeepAwake\(preferences\.keepScreenAwake && readerFocused\)/, reader);
  }
  // The toggle lives in Book Settings.
  assert.match(fs.readFileSync('src/components/vine/screens/SettingsScreen.tsx', 'utf8'), /active=\{preferences\.keepScreenAwake\} onPress=\{toggleKeepScreenAwake\}/);
});
