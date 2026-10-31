const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');

const read = (file) => fs.readFileSync(file, 'utf8');

function load(path, stubs = {}) {
  const moduleObject = { exports: {} };
  const output = ts.transpileModule(read(path), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('exports', 'require', 'module', output)(
    moduleObject.exports,
    (id) => (id in stubs ? stubs[id] : require(id)),
    moduleObject,
  );
  return moduleObject.exports;
}

function fakeStorage() {
  const map = new Map();
  return {
    map,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); },
  };
}

test('on the web the players outlive a rebuilt provider, and the session with them', () => {
  const made = { audio: 0, video: 0, setups: 0 };
  const live = load('src/utils/livePlayback.web.ts', {
    react: { useState: (init) => [typeof init === 'function' ? init() : init] },
    'expo-audio': { createAudioPlayer: () => ({ id: `audio-${++made.audio}` }) },
    'expo-video': { createVideoPlayer: () => ({ id: `video-${++made.video}` }) },
  });
  const setup = () => { made.setups += 1; };
  const first = live.usePlaybackPlayers(setup);
  // Chrome's Forward rebuilds the app's root: the provider mounts again.
  const second = live.usePlaybackPlayers(setup);
  assert.equal(first.player, second.player);
  assert.equal(first.videoPlayer, second.videoPlayer);
  assert.deepEqual(made, { audio: 1, video: 1, setups: 1 });

  assert.equal(live.readLiveSession(), null);
  const session = { queue: [{ key: 'a' }], originalQueue: [{ key: 'a' }], currentIndex: 0, repeatMode: 'off', shuffleEnabled: false, learningRate: 1, videoRendition: null, videoDurationMs: 0 };
  live.writeLiveSession(session);
  assert.equal(live.readLiveSession(), session);
  live.writeLiveSession({ ...session, queue: [] });
  assert.equal(live.readLiveSession(), null, 'a cleared queue leaves nothing to carry over');
});

test('on iOS and Android the players stay with the provider, as before', () => {
  const source = read('src/utils/livePlayback.ts');
  assert.match(source, /const player = useAudioPlayer\(null, AUDIO_PLAYER_OPTIONS\);/);
  assert.match(source, /const videoPlayer = useVideoPlayer\(null, setupVideo\);/);
  assert.match(source, /export function readLiveSession\(\): LivePlaybackSession \| null \{\n  return null;/);
});

function storageWith(navigationType) {
  const session = fakeStorage();
  globalThis.window = {
    sessionStorage: session,
    localStorage: fakeStorage(),
    performance: { getEntriesByType: (kind) => (kind === 'navigation' ? [{ type: navigationType }] : []) },
  };
  const storage = load('src/utils/playbackStateStorage.ts', {
    'react-native': { Platform: { OS: 'web' } },
    '@/utils/playbackEngine': { sanitizePlaybackSnapshot: (value) => value },
    '@/utils/legacyNames': load('src/utils/legacyNames.ts'),
  });
  return { storage, session };
}

test('a reload carries on from the moment the page was left, still playing if it was', () => {
  const now = 1_800_000_000_000;
  const { storage, session } = storageWith('reload');
  storage.saveReloadPoint({ key: 'music:t1:0', positionMs: 4687, playing: true, savedAt: now - 1000 });
  assert.ok(session.map.has('cv-playback-reload-v1'), 'kept for the tab only (sessionStorage)');
  assert.deepEqual(storage.reloadPointFor('music:t1:0', now), { key: 'music:t1:0', positionMs: 4687, playing: true, savedAt: now - 1000 });
  // Another entry, or a point from a listening session hours ago, does not apply.
  assert.equal(storage.reloadPointFor('music:t2:1', now), null);
  assert.equal(storage.reloadPointFor('music:t1:0', now + 7 * 60 * 60 * 1000), null);
  storage.saveReloadPoint(null);
  assert.equal(storage.reloadPointFor('music:t1:0', now), null);
});

test('Back or Forward into the site carries on too; opening it afresh comes back paused', () => {
  const now = 1_800_000_000_000;
  for (const [type, playing] of [['back_forward', true], ['navigate', false]]) {
    const { storage } = storageWith(type);
    storage.saveReloadPoint({ key: 'k', positionMs: 1200, playing: true, savedAt: now });
    const point = storage.reloadPointFor('k', now);
    assert.equal(point.playing, playing, type);
    assert.equal(point.positionMs, 1200, `${type}: at the same place either way`);
  }
});

test('on the web each section opened gets its own history entry, so Back stays within the page', () => {
  const pushed = [];
  const dispatched = [];
  const appStack = { key: 'stack-1', routeNames: ['index', 'books/index', 'music', 'learn', 'account'], routes: [] };
  const navigation = load('src/utils/navigation.ts', {
    react: { useCallback: (fn) => fn },
    'react-native': { Platform: { OS: 'web' } },
    'expo-router': {
      useRouter: () => ({ replace: () => assert.fail('the stack is ready') }),
      useNavigationContainerRef: () => ({
        isReady: () => true,
        getRootState: () => ({ key: 'root', routes: [{ state: appStack }] }),
        dispatch: (action) => dispatched.push(action),
      }),
    },
  });
  globalThis.window = {
    location: { pathname: '/music/release/x', href: 'https://copticvine.app/music/release/x' },
    history: { state: { id: 'entry-7' }, pushState: (state, title, url) => pushed.push({ state, url }) },
  };
  const openSection = navigation.useOpenSection();
  openSection('/learn');
  // The page being left is copied first; the router then writes Learn over the copy.
  assert.deepEqual(pushed, [{ state: { id: 'entry-7' }, url: 'https://copticvine.app/music/release/x' }]);
  assert.deepEqual(dispatched, [{ type: 'RESET', payload: { index: 0, routes: [{ name: 'learn' }] }, target: 'stack-1' }]);

  // Opening the section already showing adds nothing to go back to.
  globalThis.window.location = { pathname: '/learn', href: 'https://copticvine.app/learn' };
  openSection('/learn');
  assert.equal(pushed.length, 1);
  assert.equal(dispatched.length, 2);
});

test('the keyboard\'s and Chrome\'s next/previous change tracks, taken back from expo-audio each time it sets them', () => {
  const provider = read('src/context/PlaybackContext.tsx');
  assert.match(provider, /session\?\.setActionHandler\?\.\('nexttrack', next\);/);
  assert.match(provider, /session\?\.setActionHandler\?\.\('previoustrack', previous\);/);
  // After every new source (expo-audio's replace() takes the session again)…
  assert.match(provider, /name: entry\.playable\.title,\n      \}\);\n(?: {6}\/\/[^\n]*\n)* {6}if \(PLAYER_VOLUME_ADJUSTABLE\) audioPlayerRef\.current\.volume = volumeRef\.current;\n {6}claimTrackButtons\(\);/);
  // …and after every activation, including the one 600 ms later.
  assert.match(provider, /player\.updateLockScreenMetadata\(metadata\);\n        claimTrackButtons\(\);\n      \};\n      activate\(\);\n[\s\S]*?timer = setTimeout\(activate, 600\);/);
});

test('the provider uses the lasting players, and the web starts a restored track where it was', () => {
  const provider = read('src/context/PlaybackContext.tsx');
  assert.match(provider, /const \{ player, videoPlayer \} = usePlaybackPlayers\(setupVideoPlayer\);/);
  assert.doesNotMatch(provider, /useAudioPlayer\(|useVideoPlayer\(/);
  assert.match(provider, /const \[live\] = useState\(readLiveSession\);/);
  assert.match(provider, /if \(!active \|\| carriedOver\.current \|\| !snapshot \|\| !snapshot\.queue\.length\) return;/);
  assert.match(provider, /if \(startMs > 0\) void player\.seekTo\(startMs \/ 1000\);/);
  assert.match(provider, /window\.addEventListener\('pagehide', save\);/);
  // Refused sound after a reload carries on at the first click or key, after that press is handled.
  assert.match(provider, /window\.addEventListener\('pointerup', resume, true\);/);
  assert.match(provider, /if \(\(event\.reason as \{ name\?: string \} \| null\)\?\.name === 'NotAllowedError'\) event\.preventDefault\(\);/);
});
