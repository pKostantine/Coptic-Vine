const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');

/**
 * The reader's two swipes on a phone or tablet (utils/readerSwipe.ts,
 * hooks/useReaderSwipes.ts): from anywhere on the screen, to the right it
 * leaves and to the left the contents come in, each following the finger.
 */

/** Loads a TypeScript module as CommonJS, with its imports resolved by `resolve` where given. */
function loadFile(path, resolve = require) {
  const js = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('exports', 'require', 'module', js)(module.exports, resolve, module);
  return module.exports;
}
const read = (file) => fs.readFileSync(file, 'utf8');

const swipes = loadFile('src/utils/readerSwipe.ts');

function loadDocumentBuilder() {
  const theme = loadFile('src/constants/theme.ts');
  const themes = loadFile('src/constants/documentThemes.ts', (name) => (name === './theme' ? theme : require(name)));
  const local = {
    '../../constants/theme': theme,
    '../../constants/documentThemes': themes,
    '../../constants/copticInitialArt': loadFile('src/constants/copticInitialArt.ts'),
    '../../constants/englishInitialArt': loadFile('src/constants/englishInitialArt.ts'),
    '../../constants/documentOrnaments': loadFile('src/constants/documentOrnaments.ts', (name) => (name === './ornamentArt' ? loadFile('src/constants/ornamentArt.ts') : require(name))),
    './documentPresentationMetrics': loadFile('src/components/vine/documentPresentationMetrics.js'),
    './textHighlights': loadFile('src/components/vine/textHighlights.ts'),
    './readerChromeFade': loadFile('src/components/vine/readerChromeFade.ts', (name) => (name === '../../constants/documentThemes' ? themes : require(name))),
    '../../utils/versePresentation': loadFile('src/utils/versePresentation.js'),
    '../../utils/verseRubric': loadFile('src/utils/verseRubric.js'),
    '../../utils/readerSwipe': swipes,
  };
  local['./copticInitial'] = loadFile('src/components/vine/copticInitial.ts', (name) => local[name] || require(name));
  local['./openingInitials'] = loadFile('src/components/vine/openingInitials.ts', (name) => local[name] || require(name));
  local['./openingHtml'] = loadFile('src/components/vine/openingHtml.ts', (name) => local[name] || require(name));
  return loadFile('src/components/vine/documentHtml.ts', (name) => local[name] || require(name)).buildDocumentHtml;
}

/**
 * The page's swipe script, run against a page of its own: touches go in,
 * the messages it posts to the app come out. Frames and the clock are the
 * test's to move.
 */
function swipeScript(options) {
  const html = loadDocumentBuilder()(
    [{ id: 'hymn-1', title: { english: 'Prayer', arabic: '' }, verses: [{ english: 'Amen', coptic: 'Ⲁⲙⲏⲛ', arabic: 'آمين', type: 'verse' }] }],
    { copticFontDataUri: 'data:font/ttf;base64,AA==', fontSize: 20, ...options },
  );
  const begin = html.indexOf("      (function () {\n        if (!true) return;\n        // The reader's two swipes");
  assert.ok(begin > 0, 'the swipe script is on the page');
  const end = html.indexOf('      })();', begin) + '      })();'.length;
  const listeners = {};
  const posted = [];
  let frames = [];
  let now = 0;
  const page = {
    document: { addEventListener: (type, listener) => { listeners[type] = listener; } },
    window: {},
    postAction: (type, payload) => posted.push({ type, ...payload }),
    requestAnimationFrame: (callback) => { frames.push(callback); return frames.length; },
    cancelAnimationFrame: () => { frames = []; },
    Date: { now: () => now },
  };
  new Function(...Object.keys(page), html.slice(begin, end))(...Object.values(page));
  const touch = (type, x, y, extra = {}) => {
    const point = { clientX: x, clientY: y };
    const event = { touches: type === 'touchend' ? [] : [point], changedTouches: [point], cancelable: true, prevented: false, ...extra };
    event.preventDefault = () => { event.prevented = true; };
    listeners[type](event);
    return event;
  };
  return {
    posted,
    touch,
    frame: () => { const queued = frames; frames = []; queued.forEach((callback) => callback()); },
    at: (ms) => { now = ms; },
  };
}

test('a move is a swipe once it is plainly sideways and past a tap, to the right to leave and to the left for the contents', () => {
  assert.equal(swipes.READER_SWIPE_SLOP, 10);
  assert.equal(swipes.readerSwipeFor(12, 2), 'exit');
  assert.equal(swipes.readerSwipeFor(-12, 2), 'contents');
  // Wherever it began: the screen's middle, its left half, its right half -- only how it moves counts.
  assert.equal(swipes.readerSwipeFor.length, 2);
  // Still a tap, a scroll, or a stroke down the page.
  assert.equal(swipes.readerSwipeFor(9, 0), null);
  assert.equal(swipes.readerSwipeFor(20, 18), null);
  assert.equal(swipes.readerSwipeFor(0, 40), null);
  assert.equal(swipes.readerSwipeFor(Number.NaN, 0), null);
});

test('let go, a swipe goes through past a third of its way or flicked, and goes back when turned back', () => {
  assert.equal(swipes.readerSwipeGoesThrough(140, 400, 0), true);
  assert.equal(swipes.readerSwipeGoesThrough(139, 400, 0.1), false);
  // A flick goes through however short; a finger turning back takes it back however far.
  assert.equal(swipes.readerSwipeGoesThrough(30, 400, 0.5), true);
  assert.equal(swipes.readerSwipeGoesThrough(300, 400, -0.5), false);
  assert.equal(swipes.readerSwipeGoesThrough(0, 400, 1), false);
  assert.equal(swipes.readerSwipeGoesThrough(100, 0, 0), false);
  // The rest of the way at the finger's speed, never slower than a quarter second for the whole, never a jump.
  assert.equal(swipes.readerSwipeFinishMs(400, 400, 0), 250);
  assert.equal(swipes.readerSwipeFinishMs(200, 400, 0), 125);
  assert.equal(swipes.readerSwipeFinishMs(300, 400, 2), 150);
  assert.equal(swipes.readerSwipeFinishMs(10, 400, 2), 90);
  assert.equal(swipes.readerSwipeFinishMs(0, 400, 2), 0);
  assert.equal(swipes.contentsSwipeProgress(170, 340), 0.5);
  assert.equal(swipes.contentsSwipeProgress(500, 340), 1);
  assert.equal(swipes.contentsSwipeProgress(-20, 340), 0);
});

test('the scrolling page reports a swipe from anywhere as it goes, a frame at a time, and its speed as it ends', () => {
  const page = swipeScript({ nativeSwipeNavigation: true });
  // From the left half, to the left: the contents.
  page.touch('touchstart', 100, 300);
  page.at(16);
  assert.equal(page.touch('touchmove', 94, 301).prevented, false, 'still a tap');
  page.at(32);
  const taken = page.touch('touchmove', 80, 302);
  assert.equal(taken.prevented, true, 'the page keeps a swipe from scrolling');
  page.at(48);
  page.touch('touchmove', 60, 303);
  page.frame();
  assert.deepEqual(page.posted, [{ type: 'swipeDrag', swipe: 'contents', distance: 20 }], 'measured from where it was taken, once a frame');
  page.at(64);
  page.touch('touchend', 40, 303);
  const end = page.posted.at(-1);
  assert.equal(end.type, 'swipeEnd');
  assert.equal(end.swipe, 'contents');
  assert.equal(end.distance, 40);
  assert.equal(end.velocity, 60 / 64, 'px per ms over the last tenth of a second, the swipe\'s way');
});

test('a swipe to the right from the right side leaves, unless the platform leaves by its own', () => {
  const page = swipeScript({ nativeSwipeNavigation: true });
  page.touch('touchstart', 380, 300);
  page.touch('touchmove', 400, 300);
  page.touch('touchmove', 450, 300);
  page.touch('touchend', 450, 300);
  assert.deepEqual(page.posted.map((message) => [message.type, message.swipe, message.distance]), [['swipeEnd', 'exit', 50]]);

  // iOS's own back swipe takes it there: the page leaves it be, unprevented.
  const ios = swipeScript({ nativeSwipeNavigation: true, swipeExitsInPage: false });
  ios.touch('touchstart', 380, 300);
  assert.equal(ios.touch('touchmove', 420, 300).prevented, false);
  ios.touch('touchend', 450, 300);
  assert.deepEqual(ios.posted, []);
  // A swipe to the left is still the page's.
  ios.touch('touchstart', 300, 300);
  ios.touch('touchmove', 250, 300);
  ios.touch('touchend', 200, 300);
  assert.equal(ios.posted.at(-1).swipe, 'contents');
});

test('a scroll, two fingers, a pencil, or a website is never a swipe', () => {
  const page = swipeScript({ nativeSwipeNavigation: true });
  page.touch('touchstart', 200, 300);
  page.touch('touchmove', 202, 280);
  page.touch('touchmove', 260, 200);
  page.touch('touchend', 300, 150);
  assert.deepEqual(page.posted, [], 'up the page first: a scroll, whatever it does after');
  page.touch('touchstart', 200, 300, { touches: [{ clientX: 200, clientY: 300 }, { clientX: 260, clientY: 300 }] });
  page.touch('touchmove', 150, 300);
  page.touch('touchend', 100, 300);
  assert.deepEqual(page.posted, [], 'a pinch');
  page.touch('touchstart', 200, 300, { touches: [{ clientX: 200, clientY: 300, touchType: 'stylus' }] });
  page.touch('touchmove', 150, 300);
  page.touch('touchend', 100, 300);
  assert.deepEqual(page.posted, [], "a pencil's stroke highlights");
  const html = loadDocumentBuilder()([], { copticFontDataUri: 'data:font/ttf;base64,AA==', fontSize: 20 });
  assert.match(html, /if \(!false\) return;\n\s+\/\/ The reader's two swipes/);
});

test('the documents and subdocuments take both swipes from anywhere, following the finger', () => {
  const hook = read('src/hooks/useReaderSwipes.ts');
  assert.match(hook, /onMoveShouldSetPanResponderCapture/);
  assert.match(hook, /const swipe = readerSwipeFor\(gestureState\.dx, gestureState\.dy\);/);
  assert.match(hook, /if \(!swipe \|\| \(swipe === 'exit' && !current\.exitsByDrag\)\) return false;/);
  assert.match(hook, /pageOffset\.setValue\(Math\.max\(distance, 0\)\);/);
  assert.match(hook, /onPanResponderTerminationRequest: \(\) => false,/);
  assert.doesNotMatch(hook, /swipeEdge|EDGE_SWIPE_ZONE|rightEdgeSwipeZone/, 'no edge or half decides it');

  const service = read('src/components/vine/screens/ServiceDocument.tsx');
  // iOS leaves by its own back swipe, from anywhere, while nothing covers the document; never in the Sermon Planner.
  assert.match(service, /const nativeBackSwipe = Platform\.OS === 'ios' && !isSermonPlanner;/);
  assert.match(service, /gestureEnabled: nativeBackSwipe && !isCoveredByModal,\s+fullScreenGestureEnabled: true,/);
  assert.match(service, /exitsByDrag: !nativeBackSwipe,/);
  assert.match(service, /swipeExitsInPage=\{!nativeBackSwipe\}/);
  // Slid away by a finger, it goes without a slide of its own.
  assert.match(service, /\.\.\.\(leavingBySwipe \? \{ animation: 'none' as const \} : null\),/);
  assert.match(service, /<Animated\.View style=\{\[styles\.swipedPage, readerSwipes\.pageStyle\]\}>/);
  assert.match(service, /enabled: isMobileDocument && !isCoveredByModal,/);

  const modal = read('src/components/vine/screens/DocumentModal.tsx');
  assert.match(modal, /exitsByDrag: true,/);
  assert.match(modal, /onExit: onClose,/);
  // Over the document it was opened from, which shows beneath as it is swiped away.
  assert.match(modal, /animationType="slide"\n\s+\/\/ [^\n]*\n\s+\/\/ [^\n]*\n\s+transparent/);
  assert.match(modal, /if \(visible\) resetPage\(\);/);

  for (const [name, screen] of [['document', service], ['subdocument', modal]]) {
    assert.match(screen, /if \(action\.type === 'swipeDrag' && action\.swipe\)/, name);
    assert.match(screen, /if \(action\.type === 'swipeEnd' && action\.swipe\)/, name);
    assert.match(screen, /<ReaderPanelSheet progress=\{readerSwipes\.contentsIn\}/, name);
    assert.match(screen, /openFrom=\{selectorOpenFrom\}\s+onShown=\{\(\) => \{\s+readerSwipes\.contentsShown\(\);/, name);
    assert.doesNotMatch(screen, /'swipeBack'|'openSelector'/, name);
  }

  // On a phone or a tablet a swipe never turns a slide; a tap on either half does.
  const surface = read('src/components/vine/DocumentSurface.tsx');
  assert.match(surface, /swipesTurnSlides=\{Platform\.OS === 'web'\}/);
  const slideshow = read('src/components/vine/SlideshowContainer.js');
  assert.match(slideshow, /if \(!swipesTurnSlides \|\| isStylusGestureEvent\(event\)/);
});

test('the contents come in under the finger on a sheet of the panel, and the panel carries on from it', () => {
  const panel = read('src/components/vine/ui/ReaderPanel.tsx');
  assert.match(panel, /export function ReaderPanelSheet\(/);
  // The sheet is the panel's size and colour, as far in as the finger has brought it.
  assert.match(panel, /transform: \[\{ translateX: progress\.interpolate\(\{ inputRange: \[0, 1\], outputRange: \[layout\.width \+ 24, 0\] \}\) \}\]/);
  assert.match(panel, /transform: \[\{ translateX: slide\.interpolate\(\{ inputRange: \[0, 1\], outputRange: \[0, layout\.width \+ 24\] \}\) \}\]/);
  // The panel opens from there, before its first frame is drawn, and says when it is up.
  assert.match(panel, /useLayoutEffect\(\(\) => \{\s+if \(!mounted\) return;\s+const from = visible \? Math\.min\(Math\.max\(openFromRef\.current \|\| 0, 0\), 1\) : 0;\s+if \(from > 0\) slide\.setValue\(1 - from\);/);
  assert.match(panel, /onShow=\{onShown\}/);
  const contents = read('src/components/vine/ui/ContentSelectorDrawer.tsx');
  assert.match(contents, /openFrom=\{openFrom\}\s+onShown=\{onShown\}/);
});
