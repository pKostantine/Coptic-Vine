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

test('the lock screen shows next and previous track buttons, not 10-second skips, where the build has them', () => {
  const calls = [];
  const listeners = {};
  const native = {
    setTrackControls: (next, previous) => calls.push([next, previous]),
    addListener: (event, listener) => {
      listeners[event] = listener;
      return { remove: () => { delete listeners[event]; } };
    },
  };
  const required = [];
  const withModule = load('src/utils/trackControls.ts', {
    expo: { requireOptionalNativeModule: (name) => { required.push(name); return native; } },
  });
  assert.deepEqual(required, ['TrackControls']);
  assert.equal(withModule.hasTrackControls, true);
  withModule.setTrackControls(true, false);
  assert.deepEqual(calls, [[true, false]]);
  let pressed = 0;
  const subscription = withModule.addTrackControlListener('onNextTrack', () => { pressed += 1; });
  listeners.onNextTrack();
  assert.equal(pressed, 1);
  subscription.remove();
  assert.equal(listeners.onNextTrack, undefined);

  // A build made before the module (or Android, or the web) keeps expo-audio's skips, and nothing throws.
  const without = load('src/utils/trackControls.ts', { expo: { requireOptionalNativeModule: () => null } });
  assert.equal(without.hasTrackControls, false);
  without.setTrackControls(true, true);
  assert.equal(without.addTrackControlListener('onPreviousTrack', () => undefined), null);
});

test('the native module is the one the app asks for, and sends the events it listens to', () => {
  const config = JSON.parse(read('modules/track-controls/expo-module.config.json'));
  assert.deepEqual(config.platforms, ['apple']);
  assert.deepEqual(config.apple.modules, ['TrackControlsModule']);
  assert.match(read('modules/track-controls/ios/TrackControls.podspec'), /s\.name\s+= 'TrackControls'[\s\S]*s\.dependency 'ExpoModulesCore'/);

  const swift = read('modules/track-controls/ios/TrackControlsModule.swift');
  assert.match(swift, /public class TrackControlsModule: Module \{/);
  assert.match(swift, /Name\("TrackControls"\)/);
  assert.match(swift, /Events\("onNextTrack", "onPreviousTrack"\)/);
  assert.match(swift, /Function\("setTrackControls"\) \{ \(canGoNext: Bool, canGoPrevious: Bool\) in/);
  assert.match(swift, /commands\.nextTrackCommand\.addTarget \{ \[weak self\] _ in\n\s+self\?\.sendEvent\("onNextTrack"\)\n\s+return \.success/);
  assert.match(swift, /commands\.previousTrackCommand\.addTarget \{ \[weak self\] _ in\n\s+self\?\.sendEvent\("onPreviousTrack"\)\n\s+return \.success/);
  assert.match(swift, /commands\.nextTrackCommand\.isEnabled = canGoNext\n\s+commands\.previousTrackCommand\.isEnabled = canGoPrevious/);
  // expo-video turns its 10-second skips back on whenever a lesson loads or plays: while anything
  // plays they go off again as soon as they come on, and once more after its queued block has run.
  assert.match(swift, /holdingSkipsOff = canGoPrevious/);
  assert.match(swift, /command\.observe\(\\\.isEnabled, options: \[\.new\]\)[\s\S]*self\?\.turnSkipsOff\(\)/);
  assert.match(swift, /DispatchQueue\.main\.asyncAfter\(deadline: \.now\(\) \+ 0\.5\) \{ \[weak self\] in\n\s+self\?\.turnSkipsOff\(\)/);
  assert.match(swift, /private func turnSkipsOff\(\) \{\n\s+guard holdingSkipsOff else \{[\s\S]*commands\.skipForwardCommand\.isEnabled = false[\s\S]*commands\.skipBackwardCommand\.isEnabled = false/);
  // Every target is removed when the module goes (a reload), so a press never reaches a dead bridge.
  assert.match(swift, /OnDestroy \{[\s\S]*self\.removeTargets\(\)/);
  assert.match(swift, /commands\.nextTrackCommand\.removeTarget\(target\)[\s\S]*commands\.previousTrackCommand\.removeTarget\(target\)/);
});

test('the queue drives the lock screen buttons and answers their presses', () => {
  const context = read('src/context/PlaybackContext.tsx');
  // expo-audio's skips stand down where the track buttons can show.
  assert.match(context, /showSeekBackward: !hasTrackControls,\n\s+showSeekForward: !hasTrackControls,/);
  // Next greys out exactly when next() would do nothing; previous works whenever something plays.
  assert.match(context, /const canGoNext = hasCurrentItem && getManualNextIndex\(queue\.length, currentIndex, repeatMode\) !== currentIndex;/);
  assert.match(context, /const nextIndex = getManualNextIndex\(queue\.length, currentIndex, repeatMode\);\n\s+if \(nextIndex === currentIndex\) return;/);
  assert.match(context, /setTrackControls\(canGoNext, hasCurrentItem\);\n\s+\}, \[activeEngine, canGoNext, currentKey, hasCurrentItem, playing\]\);/);
  // Lessons play on expo-video, which turns its skips back on once a source is ready.
  assert.match(context, /if \(payload\.status === 'readyToPlay'\) \{\n\s+videoReady\(\);\n\s+setTrackControls\(trackControlsRef\.current\.canGoNext, trackControlsRef\.current\.canGoPrevious\);/);
  // A press goes to the same next() and previous() as the player's own buttons, read through refs.
  assert.match(context, /addTrackControlListener\('onNextTrack', \(\) => nextRef\.current\(\)\)/);
  assert.match(context, /addTrackControlListener\('onPreviousTrack', \(\) => previousRef\.current\(\)\)/);
  assert.match(context, /return \(\) => subscriptions\.forEach\(\(subscription\) => subscription\?\.remove\(\)\);/);
});
