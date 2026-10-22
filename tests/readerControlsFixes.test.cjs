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

/** useSheetDragToClose with React's hooks run once and PanResponder recording what each responder was made with. */
function sheetDrag() {
  const created = [];
  const react = {
    createContext: (value) => ({ value }),
    useEffect: () => {},
    useRef: (current) => ({ current }),
    useState: (init) => [typeof init === 'function' ? init() : init, () => {}],
  };
  const reactNative = {
    Animated: { spring: () => ({ start() {} }) },
    PanResponder: { create: (config) => { created.push(config); return { panHandlers: config }; } },
  };
  const { useSheetDragToClose } = loadModule('components/vine/ui/useSheetDragToClose.ts', { react, 'react-native': reactNative });
  const drag = { setValue() {} };
  const result = useSheetDragToClose(true, drag, () => {});
  const sheet = created.find((config) => config.onMoveShouldSetPanResponderCapture);
  return { result, sheet };
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

test('the app\'s slider holds the sheet while touched, and the sheet hands its contents the hold', () => {
  const slider = source('components/vine/ui/FontScaleControl.tsx');
  assert.match(slider, /useContext\(SheetDragHoldContext\)/);
  assert.match(slider, /onTouchStart=\{sheet\?\.hold\}/);
  assert.match(slider, /onTouchEnd=\{sheet\?\.release\}/);
  assert.match(slider, /onTouchCancel=\{sheet\?\.release\}/);
  assert.match(source('components/vine/ui/SheetFrame.tsx'), /<SheetDragHoldContext\.Provider value=\{sheetDrag\.hold\}>/);
});

test('every browser sizes text with − and + buttons; only the apps get a slider', () => {
  const web = source('components/vine/ui/FontScaleControl.web.tsx');
  assert.doesNotMatch(web, /accessibilityRole="adjustable"/, 'no track on the web');
  assert.doesNotMatch(web, /if \(stepper\)/, 'the buttons are not only a desktop\'s');
  assert.match(web, /'Decrease font size'/);
  assert.match(web, /'Increase font size'/);
  assert.match(source('components/vine/ui/FontScaleControl.tsx'), /<Slider/);
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
