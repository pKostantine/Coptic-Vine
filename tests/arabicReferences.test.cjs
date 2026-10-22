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
const RLM = '‏';

const localeFormat = loadFile('src/utils/localeFormat.ts', (name) => (name === './preferencesStorage' ? { getCurrentAppLanguage: () => 'ar' } : require(name)));

/** The document builder, its leaf imports stubbed as tests/documentThemes.test.cjs stubs them. */
function loadDocumentBuilder() {
  const theme = loadFile('src/constants/theme.ts');
  const documentThemes = loadFile('src/constants/documentThemes.ts', (name) => (name === './theme' ? theme : require(name)));
  const local = {
    '../../constants/theme': theme,
    '../../constants/documentThemes': documentThemes,
    '../../constants/documentOrnaments': loadFile('src/constants/documentOrnaments.ts', (name) => (name === './ornamentArt' ? loadFile('src/constants/ornamentArt.ts') : require(name))),
    './documentPresentationMetrics': loadFile('src/components/vine/documentPresentationMetrics.js'),
    './textHighlights': loadFile('src/components/vine/textHighlights.ts'),
    './readerChromeFade': loadFile('src/components/vine/readerChromeFade.ts', (name) => (name === '../../constants/documentThemes' ? documentThemes : require(name))),
    '../../utils/versePresentation': loadFile('src/utils/versePresentation.js'),
    '../../utils/verseRubric': loadFile('src/utils/verseRubric.js'),
  };
  return loadFile('src/components/vine/documentHtml.ts', (name) => local[name] || require(name)).buildDocumentHtml;
}

test('an Arabic reference keeps its numbers in reading order, right to left', () => {
  const { toArabicReferenceDigits, toEasternArabicDigits } = localeFormat;
  // Unicode joins Eastern digits across a colon or comma into one
  // left-to-right number, but parts them at a dash: read right to left,
  // "لوقا ١١:٥٣-٥٤" came out "٥٣ : ١١ - ٥٤". A mark after each separator
  // gives each number its own place in the line.
  assert.equal(toArabicReferenceDigits('لوقا 11:53-54, 12:1-12'), `لوقا ١١:${RLM}٥٣-${RLM}٥٤, ١٢:${RLM}١-${RLM}١٢`);
  assert.equal(toArabicReferenceDigits('مزمور 65:1-2,4'), `مزمور ٦٥:${RLM}١-${RLM}٢,${RLM}٤`);
  assert.equal(toArabicReferenceDigits('أعمال الرسل 14:24-28, 15:1-3'), `أعمال الرسل ١٤:${RLM}٢٤-${RLM}٢٨, ١٥:${RLM}١-${RLM}٣`);
  // Digits already Eastern, an Arabic comma and an en dash are kept in order the same way.
  assert.equal(toArabicReferenceDigits('يوحنا ٣:١٦–١٨، ٢٠'), `يوحنا ٣:${RLM}١٦–${RLM}١٨، ٢٠`);
  // A number with nothing to part is left alone, and a time keeps reading left to right as a whole.
  assert.equal(toArabicReferenceDigits('مزمور 50'), 'مزمور ٥٠');
  assert.equal(toEasternArabicDigits('4:01'), '٤:٠١');
});

test('the reader, the Bible and the Lectionary all keep a reference in order', () => {
  const build = loadDocumentBuilder();
  const html = build([{
    id: 'gospel',
    title: { english: 'The Gospel', arabic: 'الإنجيل (لوقا 11:53-54)' },
    verses: [{ english: 'Luke 11:53-54, 12:1-12', coptic: '', arabic: 'لوقا 11:53-54, 12:1-12', type: 'readingReference' }],
  }], { copticFontDataUri: 'data:font/ttf;base64,AA==', fontSize: 18, appLanguage: 'ar' });
  assert.ok(html.includes(`لوقا ١١:${RLM}٥٣-${RLM}٥٤, ١٢:${RLM}١-${RLM}١٢`), 'the reference row');
  assert.ok(html.includes(`الإنجيل (لوقا ١١:${RLM}٥٣-${RLM}٥٤)`), 'a title holding a reference');
  assert.ok(!html.includes('١١:٥٣'), 'no reference is left joined');

  // The Bible's builder converts its Arabic the same way.
  const bible = read('src/components/vine/bibleDocumentHtml.ts');
  assert.match(bible, /\.replace\(\/\\d\/g, \(digit\) => EASTERN_ARABIC_DIGITS\[digit\] \|\| digit\)\n\s+\.replace\(\/\(\[٠-٩\]\[:,،\\-–\]\)\(\?=\[٠-٩\]\)\/g, '\$1\\u200F'\);/);
  // And the Lectionary's citations, on Home and in the Lectionary menu.
  assert.match(read('src/utils/lectionaryOutline.ts'), /return arabic \? toArabicReferenceDigits\(citation\.arabic\)/);
});
