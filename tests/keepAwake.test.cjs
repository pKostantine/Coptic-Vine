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
  const reactNative = { Dimensions: { get: () => ({ width: 390, height: 844 }) }, Platform: { OS: 'web' } };
  return load('src/utils/preferencesStorage.ts', {
    '../constants/documentThemes': load('src/constants/documentThemes.ts', { './theme': theme }),
    'expo-device': { deviceType: 1, osName: 'iOS' },
    'react-native': reactNative,
    './kiahkInterpretations': load('src/utils/kiahkInterpretations.ts'),
    './playerVolume': load('src/utils/playerVolume.ts', { 'react-native': reactNative }),
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

test('the player keeps its volume on the device, and anything unreadable plays at full', async () => {
  const { DEFAULT_READING_PREFERENCES, loadReadingPreferences, syncedReadingPreferences } = loadPreferences();
  assert.equal(DEFAULT_READING_PREFERENCES.playerVolume, 1);
  assert.equal('playerVolume' in syncedReadingPreferences(DEFAULT_READING_PREFERENCES), false);
  const stored = {};
  Object.defineProperty(globalThis, 'window', {
    value: { localStorage: { getItem: (key) => stored[key] ?? null, setItem: (key, value) => { stored[key] = value; } } },
    configurable: true,
    writable: true,
  });
  const volumeFrom = async (value) => {
    stored['chc-reading-preferences'] = JSON.stringify({ playerVolume: value });
    return (await loadReadingPreferences()).playerVolume;
  };
  assert.equal(await volumeFrom(0.29), 0.29);
  assert.equal(await volumeFrom(0), 0);
  assert.equal(await volumeFrom(3), 1);
  assert.equal(await volumeFrom(-1), 0);
  assert.equal(await volumeFrom('loud'), 1);
  assert.equal(await volumeFrom(null), 1);
});

test('the volume goes on every new source, and the bar is offered only where it can be set', () => {
  const engine = fs.readFileSync('src/context/PlaybackContext.tsx', 'utf8');
  // The web player builds a new element for each source, at full volume.
  assert.match(engine, /player\.replace\(\{[\s\S]*?\}\);\s+\/\/[^\n]*\n[^\n]*\n\s+if \(PLAYER_VOLUME_ADJUSTABLE\) audioPlayerRef\.current\.volume = volumeRef\.current;/);
  // The video player's new sources, both renditions, go through one helper that sets the level on each.
  assert.match(engine, /if \(Platform\.OS === 'ios'\) await video\.replaceAsync\(source\);\n\s+else video\.replace\(source\);\n[^\n]*\n\s+if \(PLAYER_VOLUME_ADJUSTABLE\) video\.volume = options\.volume;/);
  assert.equal((engine.match(/await replaceVideoSource\(video, videoSourceFor\([^\n]*\{\n\s+positionMs[,:][^\n]*volume: volumeRef\.current/g) || []).length, 2);
  for (const screen of ['src/components/music/MusicNowPlayingScreen.tsx', 'src/components/learning/LearningNowPlayingScreen.tsx']) {
    assert.match(fs.readFileSync(screen, 'utf8'), /volume: PLAYER_VOLUME_ADJUSTABLE \? \(\) => <PlayerVolume \/> : undefined,/, screen);
  }
  // Safari on the iPhone and the iPad ignores a page's volume.
  const agentOf = (userAgent, maxTouchPoints = 0) => {
    const saved = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', { value: { userAgent, maxTouchPoints }, configurable: true });
    try {
      return load('src/utils/playerVolume.ts', { 'react-native': { Platform: { OS: 'web' } } }).PLAYER_VOLUME_ADJUSTABLE;
    } finally {
      if (saved) Object.defineProperty(globalThis, 'navigator', saved);
    }
  };
  assert.equal(agentOf('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15'), false);
  assert.equal(agentOf('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15', 5), false);
  assert.equal(agentOf('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130.0 Safari/537.36'), true);
  assert.equal(agentOf('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36', 5), true);
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
