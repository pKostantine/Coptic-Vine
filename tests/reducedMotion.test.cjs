const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');

function compile(path) {
  return ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}

/** A fresh copy of the module each time, so its one app-wide answer starts over. */
function load(platform, { matchMedia, accessibility } = {}) {
  if (matchMedia) {
    Object.defineProperty(globalThis, 'window', { value: { matchMedia }, configurable: true, writable: true });
  }
  const moduleObject = { exports: {} };
  new Function('exports', 'require', 'module', compile('src/utils/useReducedMotion.ts'))(
    moduleObject.exports,
    (id) => (id === 'react-native' ? { Platform: { OS: platform }, AccessibilityInfo: accessibility } : require(id)),
    moduleObject,
  );
  return moduleObject.exports;
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

test('on the web the answer is the prefers-reduced-motion query, and follows it', () => {
  let onChange = null;
  const query = { matches: true, addEventListener: (_event, listener) => { onChange = listener; } };
  const { subscribeReducedMotion, getReducedMotion } = load('web', { matchMedia: () => query });
  assert.equal(getReducedMotion(), false, 'nothing is read until something asks');
  let notified = 0;
  subscribeReducedMotion(() => { notified += 1; });
  assert.equal(getReducedMotion(), true);
  onChange({ matches: false });
  assert.equal(getReducedMotion(), false);
  assert.equal(notified, 2);
});

test('on a device the answer is the system’s Reduce Motion setting, and follows it', async () => {
  let onChange = null;
  const accessibility = {
    isReduceMotionEnabled: async () => true,
    addEventListener: (event, listener) => { assert.equal(event, 'reduceMotionChanged'); onChange = listener; },
  };
  const { subscribeReducedMotion, getReducedMotion } = load('ios', { accessibility });
  subscribeReducedMotion(() => {});
  await tick();
  assert.equal(getReducedMotion(), true);
  onChange(false);
  assert.equal(getReducedMotion(), false);
});

test('a browser without matchMedia, or a failing query, leaves motion on', async () => {
  const { subscribeReducedMotion, getReducedMotion } = load('web', { matchMedia: undefined });
  Object.defineProperty(globalThis, 'window', { value: {}, configurable: true, writable: true });
  subscribeReducedMotion(() => {});
  assert.equal(getReducedMotion(), false);
  const failing = load('android', { accessibility: { isReduceMotionEnabled: async () => { throw new Error('no'); }, addEventListener: () => {} } });
  failing.subscribeReducedMotion(() => {});
  await tick();
  assert.equal(failing.getReducedMotion(), false);
});

test('motionDuration keeps the duration unless less motion was asked for', () => {
  const { motionDuration } = load('ios', { accessibility: { isReduceMotionEnabled: async () => false, addEventListener: () => {} } });
  assert.equal(motionDuration(260, false), 260);
  assert.equal(motionDuration(260, true), 0);
});

test('every sheet, drawer and overlay transition asks before animating', () => {
  for (const file of [
    'src/components/playback/useOverlayTransition.ts',
    'src/components/playback/PlayerSheet.tsx',
    'src/components/playback/GlobalNowPlayingOverlay.tsx',
    'src/components/vine/ui/CalendarSheet.tsx',
    'src/components/vine/ui/ReaderPanel.tsx',
    'src/components/vine/ui/SermonPlannerDrawer.tsx',
    'src/components/vine/ui/TodayCard.tsx',
  ]) {
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, /useReducedMotion\(\)/, file);
  }
});
