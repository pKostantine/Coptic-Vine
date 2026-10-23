const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

/**
 * Three reader fixes: the Bible title pill opens the book's chapters (the
 * verses stay with the list button); every browser sizes text with − and +
 * (only the apps get a slider); and a slide on the app's slider never drags
 * the sheet it sits in down the page.
 */
const root = path.join(__dirname, '..');
const source = (file) => fs.readFileSync(path.join(root, 'src', file), 'utf8');

function loadModule(file, stubs) {
  const javascript = ts.transpileModule(source(file), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const moduleObject = { exports: {} };
  new Function('exports', 'require', 'module', javascript)(moduleObject.exports, (id) => (id in stubs ? stubs[id] : require(id)), moduleObject);
  return moduleObject.exports;
}

/**
 * useSheetDragToClose with React's hooks run once, PanResponder recording what
 * each responder was made with, and what the hook last set its hold state to
 * (the sheet's scroll view reads it), where the sheet was dragged, and whether
 * it closed.
 */
function sheetDrag() {
  const created = [];
  const seen = { held: false, drag: 0, closed: false, sprung: false };
  const react = {
    createContext: (value) => ({ value }),
    useEffect: () => {},
    useRef: (current) => ({ current }),
    useState: (init) => {
      const value = typeof init === 'function' ? init() : init;
      return [value, typeof value === 'boolean' ? (next) => { seen.held = next; } : () => {}];
    },
  };
  const reactNative = {
    Animated: { spring: () => ({ start() { seen.sprung = true; } }) },
    PanResponder: { create: (config) => { created.push(config); return { panHandlers: config }; } },
  };
  const { useSheetDragToClose } = loadModule('components/vine/ui/useSheetDragToClose.ts', { react, 'react-native': reactNative });
  const drag = { setValue(value) { seen.drag = value; } };
  const result = useSheetDragToClose(true, drag, () => { seen.closed = true; });
  const sheet = created.find((config) => config.onMoveShouldSetPanResponderCapture);
  return { result, sheet, seen };
}

const pullDown = { dx: 2, dy: 20 };

test('a pull-down on the sheet closes it, unless a control under the finger holds it (the text size slider)', () => {
  const { result, sheet } = sheetDrag();
  sheet.onStartShouldSetPanResponderCapture();
  assert.equal(sheet.onMoveShouldSetPanResponderCapture({}, pullDown), true, 'a plain pull-down');
  // A finger lands on the slider: the sheet settles the responder first, then the slider holds.
  sheet.onStartShouldSetPanResponderCapture();
  result.hold.hold();
  assert.equal(sheet.onMoveShouldSetPanResponderCapture({}, pullDown), false, 'a slide that dips stays the slider\'s');
  result.hold.release();
  assert.equal(sheet.onMoveShouldSetPanResponderCapture({}, pullDown), true, 'released, the sheet pulls again');
  // A hold whose end went unseen is cleared by the next finger.
  result.hold.hold();
  sheet.onStartShouldSetPanResponderCapture();
  assert.equal(sheet.onMoveShouldSetPanResponderCapture({}, pullDown), true);
});

test('a hold also stops the sheet scrolling, and keeps it still if it lands once a pull has begun', () => {
  const { result, sheet, seen } = sheetDrag();
  sheet.onStartShouldSetPanResponderCapture();
  result.hold.hold();
  assert.equal(seen.held, true, 'the scroll view stops while the slider is held');
  // A pull the sheet took before the hold arrived (iOS saying the slide has started).
  sheet.onPanResponderMove({}, { dx: 2, dy: 40 });
  assert.equal(seen.drag, 0, 'held, the sheet stays where it is');
  sheet.onPanResponderRelease({}, { dx: 2, dy: 120, vy: 2 });
  assert.equal(seen.closed, false, 'and a held pull never closes it');
  assert.equal(seen.sprung, true);
  result.hold.release();
  assert.equal(seen.held, false, 'released, it scrolls again');
  // A hold whose end went unseen is cleared, scrolling and all, by the next finger.
  result.hold.hold();
  sheet.onStartShouldSetPanResponderCapture();
  assert.equal(seen.held, false);
  // Unheld, a pull drags the sheet and a long one closes it.
  sheet.onPanResponderMove({}, { dx: 2, dy: 40 });
  assert.equal(seen.drag, 40);
  sheet.onPanResponderRelease({}, { dx: 2, dy: 120, vy: 2 });
  assert.equal(seen.closed, true);
});

test('the app\'s slider holds the sheet from the finger landing until both it lifts and the slide ends', () => {
  const slider = source('components/vine/ui/FontScaleControl.tsx');
  assert.match(slider, /useContext\(SheetDragHoldContext\)/);
  assert.match(slider, /if \(holding\.current\.touch \|\| holding\.current\.slide\) sheet\?\.hold\(\);\s+else sheet\?\.release\(\);/);
  assert.match(slider, /onTouchStart=\{\(\) => holdSheet\('touch', true\)\}/);
  assert.match(slider, /onTouchEnd=\{\(\) => holdSheet\('touch', false\)\}/);
  assert.match(slider, /onTouchCancel=\{\(\) => holdSheet\('touch', false\)\}/);
  assert.match(slider, /onSlidingChange=\{\(sliding\) => holdSheet\('slide', sliding\)\}/);
  // iOS's own slider says when a slide starts and ends; the universal one doesn't pass it on.
  assert.match(source('components/vine/ui/FontScaleSlider.ios.tsx'), /from '@expo\/ui\/swift-ui'[\s\S]+onEditingChanged=\{onSlidingChange\}/);
  const frame = source('components/vine/ui/SheetFrame.tsx');
  assert.match(frame, /<SheetDragHoldContext\.Provider value=\{sheetDrag\.hold\}>/);
  assert.match(frame, /<ScrollView scrollEnabled=\{!sheetDrag\.held\}/);
});

test('the app\'s slider sits where it belongs from the first frame, out of the safe area\'s reach', () => {
  // Its sheet is laid out below the screen before sliding up: SwiftUI kept the
  // slider clear of the safe area there, too high, until a slide laid it out again.
  assert.match(source('components/vine/ui/FontScaleControl.tsx'), /<Host\s+matchContents=\{\{ vertical: true \}\}[^>]*\s+ignoreSafeArea="all"/);
});

test('every browser sizes text with − and + buttons; only the apps get a slider', () => {
  const web = source('components/vine/ui/FontScaleControl.web.tsx');
  assert.doesNotMatch(web, /accessibilityRole="adjustable"/, 'no track on the web');
  assert.doesNotMatch(web, /if \(stepper\)/, 'the buttons are not only a desktop\'s');
  assert.match(web, /'Decrease font size'/);
  assert.match(web, /'Increase font size'/);
  assert.match(source('components/vine/ui/FontScaleControl.tsx'), /<FontScaleSlider/);
});

test('the Bible title pill opens the book\'s chapters; the list button opens the verses', () => {
  const screen = source('app/bible/[bookKey]/[chapter].tsx');
  assert.match(screen, /onTitlePress=\{chapterCount > 1 \? \(\) => setChapterPickerOpen\(true\) : undefined\}/);
  assert.doesNotMatch(screen, /onTitlePress=\{openVerseSelector\}/);
  assert.match(screen, /icon: 'list-outline' as const, accessibilityLabel: selectorText\.openSelector, onPress: openVerseSelector/);
  assert.match(screen, /<BibleChapterPicker\s+visible=\{chapterPickerOpen\}/);
});

test('the chapter picker: a centred card at most 380pt wide, the open chapter\'s row in view, its words per language', () => {
  const { chapterPickerGrid, chapterPickerText } = loadModule('components/vine/ui/bibleChapterPickerParts.ts', {});
  const chapters = Array.from({ length: 50 }, (_, index) => index + 1);
  const phone = chapterPickerGrid({ width: 390, height: 844, top: 110, bottomInset: 34, chapters, current: 1 });
  assert.deepEqual([phone.cardWidth, phone.left, phone.perRow, phone.initialScrollY], [358, 16, 5, 0]);
  // Five tiles share the row: (358 − 2·16 − 4·8) / 5.
  assert.equal(phone.tile, 58);
  assert.equal(phone.maxHeight, 844 - 110 - 34 - 8);
  // Five to a row, chapter 30 is on the sixth: the view starts at the fifth, the row before it.
  assert.equal(chapterPickerGrid({ width: 390, height: 844, top: 110, bottomInset: 34, chapters, current: 30 }).initialScrollY, 4 * 52);
  const desktop = chapterPickerGrid({ width: 1440, height: 900, top: 70, bottomInset: 0, chapters, current: 1 });
  assert.deepEqual([desktop.cardWidth, desktop.left, desktop.perRow, desktop.tile], [380, 530, 6, 51]);
  assert.equal(chapterPickerText('en', false).eyebrow, 'Chapters');
  assert.equal(chapterPickerText('en', true).chapterLabel('23'), 'Psalm 23');
  assert.equal(chapterPickerText('ar', false).eyebrow, 'الإصحاحات');
  assert.equal(chapterPickerText('fr', false).chapterLabel('3'), 'Chapitre 3');
});

test('the versions are named: English is the SAAS in the Old Testament and the NKJV in the New; Arabic is the SVD', () => {
  const { englishVersionLabel, ARABIC_VERSION_LABEL } = loadModule('utils/bibleVersionLabels.ts', {});
  assert.equal(englishVersionLabel('OT').english, 'English (SAAS)');
  assert.equal(englishVersionLabel('NT').english, 'English (NKJV)');
  assert.equal(englishVersionLabel('NT').arabic, 'الإنجليزية (NKJV)');
  assert.equal(englishVersionLabel(null).english, 'English (SAAS, NKJV)');
  assert.equal(ARABIC_VERSION_LABEL.english, 'Arabic (SVD)');
  assert.equal(ARABIC_VERSION_LABEL.french, 'Arabe (SVD)');

  const search = loadModule('utils/bibleSearch.ts', {
    './bibleService': { getBibleBooks: async () => [] },
    '../services/contentDataClient': { contentDataClient: {} },
    './bibleVersionLabels': loadModule('utils/bibleVersionLabels.ts', {}),
  });
  assert.equal(search.bibleSearchLanguageLabel('english', 'OT').english, 'English (SAAS)');
  assert.equal(search.bibleSearchLanguageLabel('english', 'NT').english, 'English (NKJV)');
  assert.equal(search.bibleSearchLanguageLabel('english', null).english, 'English (SAAS, NKJV)');
  assert.equal(search.bibleSearchLanguageLabel('arabic', 'NT').english, 'Arabic (SVD)');
  assert.equal(search.bibleSearchLanguageLabel('english_nkjv', 'OT').english, 'English (NKJV)', 'the Old Testament\'s own NKJV keeps its name');

  const panel = source('components/vine/ui/BibleVersePanel.tsx');
  assert.match(panel, /if \(language === 'english'\) return appText\(englishVersionLabel\(testament\), appLanguage\);/);
  assert.match(panel, /getBibleLanguageLabel\(option\.key, appLanguage, testament\)/);
  assert.match(source('app/bible/[bookKey]/[chapter].tsx'), /testament=\{book\?\.testament \?\? null\}/);
  const searchScreen = source('app/bible/search.tsx');
  assert.match(searchScreen, /bibleSearchLanguageLabel\(language, testament\)/, 'the filter chips by the search\'s scope');
  assert.match(searchScreen, /bibleSearchLanguageLabel\(language, result\.testament\)/, 'each result by its own testament');
});
