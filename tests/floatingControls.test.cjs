const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');

function evaluateModule(source, filename, moduleRequire) {
  const javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const moduleObject = { exports: {} };
  new Function('exports', 'require', 'module', '__filename', '__dirname', javascript)(
    moduleObject.exports, moduleRequire, moduleObject, filename, process.cwd(),
  );
  return moduleObject.exports;
}

const read = (path) => fs.readFileSync(path, 'utf8');
const loadFile = (path, moduleRequire = require) => evaluateModule(read(path), path, moduleRequire);

const theme = loadFile('src/constants/theme.ts');
const themes = loadFile('src/constants/documentThemes.ts', (name) => (name === './theme' ? theme : require(name)));
const withThemes = (name) => (name === '../../../constants/documentThemes' || name === '../../constants/documentThemes' ? themes : require(name));
const { floatingControlsLayout, floatingControlsColors, TABLET_MIN_SIDE } = loadFile('src/components/vine/ui/floatingControls.ts', withThemes);
const fade = loadFile('src/components/vine/readerChromeFade.ts', withThemes);

const NO_INSETS = { top: 0, left: 0, right: 0 };

test('a desktop browser: 42px capsules 14px down and 24px in, the text from 68px', () => {
  assert.deepEqual(
    floatingControlsLayout({ width: 1440, height: 900, insets: NO_INSETS, wideWeb: true, native: false }),
    { top: 14, left: 24, right: 24, size: 42, contentTop: 68, hideStatusBar: false },
  );
});

test('a phone held upright sits the capsules just under its status bar, 14px in', () => {
  // An iPhone with a 47px status bar, natively and as an installed web app alike.
  const expected = { top: 53, left: 14, right: 14, size: 42, contentTop: 105, hideStatusBar: false };
  assert.deepEqual(floatingControlsLayout({ width: 390, height: 844, insets: { top: 47, left: 0, right: 0 }, wideWeb: false, native: true }), expected);
  assert.deepEqual(floatingControlsLayout({ width: 390, height: 844, insets: { top: 47, left: 0, right: 0 }, wideWeb: false, native: false }), expected);
  // A phone browser, whose own bar is above the page: 10px down.
  assert.deepEqual(
    floatingControlsLayout({ width: 390, height: 844, insets: NO_INSETS, wideWeb: false, native: false }),
    { top: 10, left: 14, right: 14, size: 42, contentTop: 62, hideStatusBar: false },
  );
});

test('a phone on its side hides its status bar and sits the capsules in the safe area beside the notch', () => {
  assert.deepEqual(
    floatingControlsLayout({ width: 844, height: 390, insets: { top: 0, left: 47, right: 47 }, wideWeb: false, native: true }),
    { top: 12, left: 47, right: 47, size: 42, contentTop: 64, hideStatusBar: true },
  );
  // With nothing to clear on a side, still 14px in from its edge.
  const flat = floatingControlsLayout({ width: 844, height: 390, insets: { top: 0, left: 0, right: 47 }, wideWeb: false, native: true });
  assert.equal(flat.left, 14);
  assert.equal(flat.right, 47);
  // A short, wide browser window is not a phone on its side: the page has no status bar to hide.
  assert.equal(floatingControlsLayout({ width: 844, height: 390, insets: NO_INSETS, wideWeb: false, native: false }).hideStatusBar, false);
});

test('an iPad, either way up: 44px capsules 10px under the status bar, 24px in', () => {
  const portrait = floatingControlsLayout({ width: 834, height: 1194, insets: { top: 24, left: 0, right: 0 }, wideWeb: true, native: true });
  assert.deepEqual(portrait, { top: 34, left: 24, right: 24, size: 44, contentTop: 94, hideStatusBar: false });
  const landscape = floatingControlsLayout({ width: 1194, height: 834, insets: { top: 24, left: 0, right: 0 }, wideWeb: true, native: true });
  assert.deepEqual(landscape, portrait, 'a tablet on its side keeps its status bar');
  // The smallest tablet side counts; one point narrower is a phone.
  assert.equal(floatingControlsLayout({ width: TABLET_MIN_SIDE, height: 960, insets: NO_INSETS, wideWeb: true, native: true }).size, 44);
  assert.equal(floatingControlsLayout({ width: TABLET_MIN_SIDE - 1, height: 960, insets: NO_INSETS, wideWeb: true, native: true }).size, 42);
});

test('the capsules wear the page, a hairline of its ink, and its second voice', () => {
  const night = themes.getDocumentTheme('night');
  const sepia = themes.getDocumentTheme('sepia');
  assert.deepEqual(floatingControlsColors(night, 'service'), {
    capsule: 'rgba(0, 0, 0, 0.72)',
    hairline: 'rgba(255, 255, 255, 0.1)',
    icon: night.colors.alternate,
    text: night.colors.text,
  });
  // Over a Bible chapter on Night they stay gold, the colour of its verse numbers.
  assert.equal(floatingControlsColors(night, 'bible').icon, '#E3B53B');
  assert.equal(floatingControlsColors(night, 'service').icon, '#8EC5FF');
  // Every other page has one voice for both readers.
  assert.equal(floatingControlsColors(sepia, 'bible').icon, sepia.colors.alternate);
  assert.equal(floatingControlsColors(sepia, 'service').icon, sepia.colors.alternate);
  assert.equal(floatingControlsColors(sepia, 'bible').capsule, themes.withAlpha(sepia.colors.page, 0.72));
});

test('the text fades out under the controls, clear by just above where it starts', () => {
  assert.deepEqual(fade.readerChromeFade(68), { start: 6, end: 56 });
  assert.deepEqual(fade.readerChromeFade(105), { start: 43, end: 93 });
  assert.deepEqual(fade.readerChromeFade(30), { start: 0, end: 18 });
  const css = fade.readerChromeFadeCss('#EBD3A7', 68);
  assert.match(css, /linear-gradient\(to bottom, #EBD3A7 6px, rgba\(235, 211, 167, 0\) 56px\)/);
  assert.match(css, /height: 56px;/);
  assert.match(css, /pointer-events: none;/);
  assert.match(css, /position: fixed;/);
  assert.equal(fade.readerChromeFadeHtml(68), '<div class="reader-fade" aria-hidden="true"></div>');
  // Under a bar, or in a slideshow, there is nothing to fade under.
  assert.equal(fade.readerChromeFadeCss('#000000', 0), '');
  assert.equal(fade.readerChromeFadeHtml(0), '');
});

function loadDocumentBuilder() {
  const local = {
    '../../constants/theme': theme,
    '../../constants/documentThemes': themes,
    '../../constants/documentOrnaments': loadFile('src/constants/documentOrnaments.ts', (name) => (name === './ornamentArt' ? loadFile('src/constants/ornamentArt.ts') : require(name))),
    './documentPresentationMetrics': loadFile('src/components/vine/documentPresentationMetrics.js'),
    './textHighlights': loadFile('src/components/vine/textHighlights.ts'),
    './readerChromeFade': fade,
    '../../utils/versePresentation': loadFile('src/utils/versePresentation.js'),
    '../../utils/verseRubric': loadFile('src/utils/verseRubric.js'),
  };
  return loadFile('src/components/vine/documentHtml.ts', (name) => local[name] || require(name)).buildDocumentHtml;
}

function loadBibleBuilder() {
  const source = read('src/components/vine/bibleDocumentHtml.ts').replace(
    "import { formatEnglishDisplayText } from '../../utils/displayText';",
    "const formatEnglishDisplayText = (value) => String(value || '');",
  );
  const local = {
    './textHighlights': loadFile('src/components/vine/textHighlights.ts'),
    './documentPresentationMetrics': loadFile('src/components/vine/documentPresentationMetrics.js'),
    './readerChromeFade': fade,
    '../../utils/bibleNumerals': loadFile('src/utils/bibleNumerals.ts'),
    '../../constants/documentThemes': themes,
  };
  return evaluateModule(source, 'bibleDocumentHtml.ts', (name) => local[name] || require(name)).buildBibleChapterHtml;
}

const SECTIONS = [{
  id: 'opening',
  title: { english: 'Matins' },
  verses: [{ english: 'Arise, O children of the light', coptic: '', arabic: '' }],
}];

test('a service page under the controls starts its text below them and fades under them', () => {
  const build = loadDocumentBuilder();
  const html = build(SECTIONS, { copticFontDataUri: 'data:font/ttf;base64,AA==', fontSize: 18, topContentInset: 68 });
  assert.match(html, /<div class="reader-fade" aria-hidden="true"><\/div><div class="page-scroller"><main class="document" data-chrome-top="68">/);
  assert.match(html, /\.document \{[^}]*padding: 68px 10px /);
  assert.match(html, /\.page-scroller \{ scroll-padding-top: 68px; \}/);
  // Under a bar, the page is as it was.
  const plain = build(SECTIONS, { copticFontDataUri: 'data:font/ttf;base64,AA==', fontSize: 18 });
  assert.match(plain, /<div class="page-scroller"><main class="document" data-chrome-top="0">/);
  assert.doesNotMatch(plain, /reader-fade/);
});

test('a Bible chapter under the controls does too, but a slideshow slide never runs under them', () => {
  const build = loadBibleBuilder();
  const verses = [{ number: 1, text: { english: 'In the beginning God created the heavens and the earth.' } }];
  const base = { verses, languageKeys: ['english'], fontSize: 18, copticFontDataUri: 'data:font/ttf;base64,AA==' };
  const html = build({ ...base, topContentInset: 105 });
  assert.match(html, /class="reader-fade"/);
  assert.match(html, /\.chapter \{[^}]*padding: 105px 20px /);
  assert.match(html, /html \{ scroll-padding-top: 105px; \}/);
  const slides = build({ ...base, topContentInset: 105, isSlideshow: true });
  assert.doesNotMatch(slides, /class="reader-fade"/);
  assert.match(slides, /html \{ scroll-padding-top: 0px; \}/);
});

// The service page's own scripts (documentHtml.ts), run against a minimal
// window: a jump lands below the controls, and the headpiece reports whether
// it still shows its title below them.
function loadPageScript(chromeTop, { headpieceTop = 70, headpieceHeight = 120 } = {}) {
  const source = read('src/components/vine/documentHtml.ts');
  const start = source.indexOf("      var pageScroller = document.querySelector('.page-scroller');");
  const jumpEnd = source.indexOf('      window.scrollToTune = function');
  const headStart = source.indexOf('      // Under floating controls: whether the headpiece');
  const headEnd = source.indexOf('      (function () {\n        if (!${JSON.stringify(nativeSwipeNavigation)}) return;');
  assert.ok(start > 0 && jumpEnd > start && headStart > jumpEnd && headEnd > headStart, 'page script not found');
  const script = source.slice(start, jumpEnd) + source.slice(headStart, headEnd);
  assert.doesNotMatch(script, /\$\{/, 'the extracted script must not depend on template values');

  const listeners = {};
  const on = (type, handler) => (listeners[type] ||= []).push(handler);
  const sectionTops = { a: 0, b: 2000 };
  const scroller = {
    scrollTop: 0,
    scrollHeight: 6000,
    clientHeight: 800,
    getBoundingClientRect: () => ({ top: 0 }),
    addEventListener: on,
  };
  const title = {
    isConnected: true,
    getClientRects: () => [{}],
    getBoundingClientRect: () => ({ top: headpieceTop + 40 - scroller.scrollTop, bottom: headpieceTop + 40 + 30 - scroller.scrollTop }),
  };
  const headpiece = {
    getBoundingClientRect: () => ({ top: headpieceTop - scroller.scrollTop, bottom: headpieceTop + headpieceHeight - scroller.scrollTop }),
    querySelector: (selector) => (selector === '.headpiece-title' ? title : null),
  };
  const host = { getAttribute: (name) => (name === 'data-chrome-top' ? String(chromeTop) : null) };
  const win = { addEventListener: on };
  const doc = {
    querySelector(selector) {
      if (selector === '.page-scroller') return scroller;
      if (selector === '.document') return host;
      if (selector === '.document .headpiece') return headpiece;
      return null;
    },
    getElementById(id) {
      if (!(id in sectionTops)) return null;
      return {
        isConnected: true,
        getBoundingClientRect: () => ({ top: sectionTops[id] - scroller.scrollTop, bottom: sectionTops[id] + 1500 - scroller.scrollTop }),
      };
    },
  };
  const posted = [];
  const frames = [];
  new Function('window', 'document', 'postAction', 'requestAnimationFrame', script)(
    win, doc, (type, payload) => posted.push([type, payload]), (callback) => frames.push(callback),
  );
  const scrollTo = (top) => {
    scroller.scrollTop = top;
    (listeners.scroll || []).forEach((handler) => handler({ type: 'scroll' }));
    frames.splice(0).forEach((callback) => callback());
  };
  return { win, scroller, posted, scrollTo };
}

test('a jump lands a hymn just below the floating controls, not behind them', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const { win, scroller } = loadPageScript(68);
  win.scrollToSection('b');
  t.mock.timers.tick(0);
  assert.equal(scroller.scrollTop, 2000 - 1 - 68);
  // Under a bar the jump lands at the top, as before.
  const plain = loadPageScript(0);
  plain.win.scrollToSection('b');
  t.mock.timers.tick(0);
  assert.equal(plain.scroller.scrollTop, 1999);
});

test('the title pill waits until the headpiece\'s title has scrolled away under the controls', () => {
  const { posted, scrollTo } = loadPageScript(68);
  // At the top, the headpiece carries the title.
  assert.deepEqual(posted, [['headpieceInView', { inView: true }]]);
  // Its title (110-140px down the page) still shows below the controls' fade.
  scrollTo(80);
  assert.equal(posted.length, 1, 'nothing new to report');
  // Gone under the controls: the pill fades in, once.
  scrollTo(120);
  scrollTo(400);
  assert.deepEqual(posted.slice(1), [['headpieceInView', { inView: false }]]);
  // Back to the top: the pill gives way to the headpiece again.
  scrollTo(0);
  assert.deepEqual(posted.slice(2), [['headpieceInView', { inView: true }]]);
});

test('a document that opens without a headpiece shows the title pill at once; under a bar nothing is reported', () => {
  // A headpiece far down the page is not the one the document opens with.
  const deep = loadPageScript(68, { headpieceTop: 900 });
  assert.deepEqual(deep.posted, [['headpieceInView', { inView: false }]]);
  const barred = loadPageScript(0);
  barred.scrollTo(400);
  assert.deepEqual(barred.posted, []);
});

test('the screens float the controls over the page in place of a bar', () => {
  const service = read('src/components/vine/screens/ServiceDocument.tsx');
  // Over the text only with nothing else at the top of the page; otherwise the controls take the bar's room.
  assert.match(service, /const controlsOverText = !isMobileDocument && !preferences\.slideshowMode && !showDateBar && !isAntiphonary;/);
  assert.match(service, /topContentInset=\{controlsOverText \? floatingLayout\.contentTop : 0\}/);
  assert.match(service, /titleVisible=\{!controlsOverText \|\| !headpieceInView\}/);
  const modal = read('src/components/vine/screens/DocumentModal.tsx');
  assert.match(modal, /topContentInset=\{controlsOverText \? floatingLayout\.contentTop : 0\}/);
  assert.match(modal, /titleVisible=\{!controlsOverText \|\| !headpieceInView\}/);
  for (const path of ['src/components/vine/DocumentWebView.tsx', 'src/components/vine/DocumentWebView.web.tsx']) {
    const view = read(path);
    assert.match(view, /if \(action\?\.type === 'headpieceInView'\) \{\s*onHeadpieceInViewChange\?\.\(Boolean\(action\.inView\)\);/, path);
  }
  const chapter = read('src/app/bible/[bookKey]/[chapter].tsx');
  assert.match(chapter, /topContentInset: preferences\.slideshowMode \? 0 : floatingLayout\.contentTop/);
  assert.match(chapter, /onTitlePress=\{openVerseSelector\}/);
  assert.ok(!fs.existsSync('src/components/vine/ui/DocumentTopBar.tsx'), 'the green bar is gone');
});
