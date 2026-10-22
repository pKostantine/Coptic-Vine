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

/** Mirrors tests/bibleSlideshowHtml.test.cjs: the real builder, with its leaf imports stubbed. */
function loadBibleBuilder() {
  const source = fs.readFileSync('src/components/vine/bibleDocumentHtml.ts', 'utf8')
    .replace(
      "import { formatEnglishDisplayText } from '../../utils/displayText';",
      "const formatEnglishDisplayText = (value) => String(value || '');",
    );
  // The pages a chapter can be read on, with the real design tokens behind them.
  const documentThemes = evaluateModule(
    fs.readFileSync('src/constants/documentThemes.ts', 'utf8'),
    'documentThemes.ts',
    (name) => (name === './theme' ? evaluateModule(fs.readFileSync('src/constants/theme.ts', 'utf8'), 'theme.ts', require) : require(name)),
  );
  const localModules = {
    './textHighlights': evaluateModule(fs.readFileSync('src/components/vine/textHighlights.ts', 'utf8'), 'textHighlights.ts', require),
    './documentPresentationMetrics': evaluateModule(fs.readFileSync('src/components/vine/documentPresentationMetrics.js', 'utf8'), 'documentPresentationMetrics.js', require),
    './readerChromeFade': evaluateModule(
      fs.readFileSync('src/components/vine/readerChromeFade.ts', 'utf8'),
      'readerChromeFade.ts',
      (name) => (name === '../../constants/documentThemes' ? documentThemes : require(name)),
    ),
    '../../utils/bibleNumerals': evaluateModule(fs.readFileSync('src/utils/bibleNumerals.ts', 'utf8'), 'bibleNumerals.ts', require),
    '../../constants/documentThemes': documentThemes,
  };
  return evaluateModule(source, 'bibleDocumentHtml.ts', (name) => localModules[name] || require(name)).buildBibleChapterHtml;
}

const VERSE = {
  verseNumber: 1,
  english: 'In the beginning',
  englishNkjv: '', englishFromCoptic: '', coptic: 'ⲁ̅', greek: '',
  arabic: 'فِي الْبَدْءِ', arabicFromCoptic: '', french: '',
};

function bibleHtml(overrides) {
  return loadBibleBuilder()({
    verses: [VERSE],
    languageKeys: ['english'],
    fontSize: 18,
    copticFontDataUri: 'data:font/ttf;base64,AA==',
    bottomContentInset: 0,
    ...overrides,
  });
}

/** The page suppresses the platform menu only where it draws its own. */
function suppressesPlatformMenu(html) {
  return /\.sermon-annotatable-text[^}]*-webkit-touch-callout:\s*none/s.test(html)
    && /addEventListener\('contextmenu'[\s\S]{0,120}preventDefault/.test(html);
}

test('the shared highlight layer hides the platform selection menu', () => {
  const { textHighlightStyles, textHighlightScript } = evaluateModule(
    fs.readFileSync('src/components/vine/textHighlights.ts', 'utf8'), 'textHighlights.ts', require,
  );
  assert.match(textHighlightStyles(), /-webkit-touch-callout:\s*none/);
  const script = textHighlightScript({
    emit: 'function (type, payload) {}',
    actions: { create: 'create', pencil: 'pencil' },
  });
  assert.match(script, /addEventListener\('contextmenu'[\s\S]{0,120}preventDefault/);
  // The script is injected into a page, so it has to parse on its own.
  assert.doesNotThrow(() => new Function(script));
});

test('the Bible reader hides the platform menu and keeps text selectable', () => {
  const html = bibleHtml({ selectText: true, highlighting: true });
  assert.ok(suppressesPlatformMenu(html), 'the reading view should suppress the platform menu');
  assert.match(html, /user-select:\s*text/, 'text must still be selectable for the toolbar to have a selection');
});

test('a Bible slideshow leaves the platform menu alone', () => {
  // Nothing is selectable there, so there is no toolbar and nothing to replace.
  const html = bibleHtml({ selectText: true, highlighting: true, isSlideshow: true });
  assert.equal(suppressesPlatformMenu(html), false);
});

test('the native readers suppress the platform menu only where the page has its own', () => {
  // menuItems=[] is react-native-webview's documented way to hide it, on both
  // platforms. These are RN props, so the source is what can be checked here.
  const bible = fs.readFileSync('src/components/vine/BibleWebView.tsx', 'utf8');
  assert.match(bible, /selectText \? \{ menuItems: NO_NATIVE_SELECTION_MENU \} : null/);

  const document = fs.readFileSync('src/components/vine/DocumentWebView.tsx', 'utf8');
  assert.match(document, /sermonPlannerMode \? \{ menuItems: NO_NATIVE_SELECTION_MENU \} : null/);
  // A plain document with Select text on keeps the platform menu: it is the
  // only way to copy from one.
  assert.doesNotMatch(document, /selectText \|\| sermonPlannerMode \? \{ menuItems/);
});

test('the saint hymn preview is selectable', () => {
  const picker = fs.readFileSync('src/components/vine/ui/SaintHymnPicker.tsx', 'utf8');
  assert.doesNotMatch(picker, /selectText=\{false\}/);
  assert.match(picker, /\n\s+selectText\n/, 'the preview should pass selectText');
});
