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

const loadFile = (path, moduleRequire = require) => evaluateModule(fs.readFileSync(path, 'utf8'), path, moduleRequire);

const theme = loadFile('src/constants/theme.ts');
const themes = loadFile('src/constants/documentThemes.ts', (name) => (name === './theme' ? theme : require(name)));
const { COLORS } = theme;
const { DOCUMENT_THEMES, DOCUMENT_THEME_IDS, NIGHT_DOCUMENT_THEME, getDocumentTheme, isDocumentThemeId, slideshowThemeFor, withAlpha } = themes;

/** WCAG relative luminance and contrast ratio, from the sRGB hex the themes are written in. */
const channel = (value) => { const c = value / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const luminance = (hex) => { const v = parseInt(hex.slice(1), 16); return 0.2126 * channel((v >> 16) & 255) + 0.7152 * channel((v >> 8) & 255) + 0.0722 * channel(v & 255); };
const contrast = (a, b) => { const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (high + 0.05) / (low + 0.05); };
const HEX = /^#[0-9A-Fa-f]{6}$/;
const hsl = (hex) => {
  const v = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((c) => c / 255);
  const max = Math.max(r, g, b); const min = Math.min(r, g, b); const d = max - min;
  const l = (max + min) / 2;
  if (!d) return { h: 0, s: 0, l };
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: d / (1 - Math.abs(2 * l - 1)), l };
};
const hue = (hex) => hsl(hex).h;
/** How far from grey a colour is, as its channels' spread: HSL saturation misleads near white and black. */
const chroma = (hex) => { const v = parseInt(hex.slice(1), 16); const c = [(v >> 16) & 255, (v >> 8) & 255, v & 255]; return (Math.max(...c) - Math.min(...c)) / 255; };
const RGBA = /^rgba\(\d+, \d+, \d+, (0(\.\d+)?|1)\)$/;

const TEXT_COLORS = ['text', 'alternate', 'accent', 'priest', 'deacon', 'people', 'peopleText', 'refrain', 'metropolitan', 'subdoc', 'link'];
const QUIET_COLORS = ['comment', 'silent'];
const SOLID_COLORS = ['page', 'surface', 'border', 'strip', 'stripActive', 'onAccent', ...TEXT_COLORS, ...QUIET_COLORS];
const WASHES = ['accentSoft', 'accentLine', 'subdocSoft', 'subdocLine', 'linkSoft', 'linkLine'];

test('there are five pages, Night first and the default, each with a name in every App Language', () => {
  assert.deepEqual(DOCUMENT_THEME_IDS, ['night', 'slate', 'vine', 'sepia', 'paper']);
  assert.equal(getDocumentTheme(undefined), NIGHT_DOCUMENT_THEME);
  assert.equal(getDocumentTheme('sepia').id, 'sepia');
  // A page this version doesn't know (a newer app synced it, a hand-edited file) reads as Night rather than breaking.
  assert.equal(getDocumentTheme('amber'), NIGHT_DOCUMENT_THEME);
  assert.equal(isDocumentThemeId('vine'), true);
  assert.equal(isDocumentThemeId('Vine'), false);
  for (const id of DOCUMENT_THEME_IDS) {
    const page = DOCUMENT_THEMES[id];
    assert.equal(page.id, id);
    for (const language of ['english', 'french', 'arabic']) assert.ok(page.name[language], `${id} is named in ${language}`);
    assert.equal(typeof page.dark, 'boolean');
    assert.equal(page.dark, luminance(page.colors.page) < 0.5, `${id}'s dark flag matches its page`);
  }
});

test('every page carries every colour, in the forms CSS and React Native both read', () => {
  for (const id of DOCUMENT_THEME_IDS) {
    const { colors } = DOCUMENT_THEMES[id];
    for (const key of SOLID_COLORS) assert.match(colors[key], HEX, `${id}.${key}`);
    for (const key of WASHES) assert.match(colors[key], RGBA, `${id}.${key}`);
    assert.equal(Object.keys(colors).length, SOLID_COLORS.length + WASHES.length, `${id} has no stray colour`);
  }
  assert.equal(withAlpha('#E3B53B', 0.72), 'rgba(227, 181, 59, 0.72)');
});

test('every text colour reads on its page: 4.5:1 for the words, 3:1 for what is meant to be quiet', () => {
  for (const id of DOCUMENT_THEME_IDS) {
    const { colors } = DOCUMENT_THEMES[id];
    for (const key of TEXT_COLORS) {
      const ratio = contrast(colors[key], colors.page);
      assert.ok(ratio >= 4.5, `${id}.${key} on its page is ${ratio.toFixed(2)}:1`);
    }
    for (const key of QUIET_COLORS) {
      const ratio = contrast(colors[key], colors.page);
      assert.ok(ratio >= 3, `${id}.${key} on its page is ${ratio.toFixed(2)}:1`);
    }
    // The lit rite toggle, the pill bar and its lit pill: their text reads on them too.
    assert.ok(contrast(colors.onAccent, colors.accent) >= 4.5, `${id}'s text on its accent`);
    assert.ok(contrast(colors.text, colors.surface) >= 4.5, `${id}'s text on its surface`);
    assert.ok(contrast(colors.text, colors.strip) >= 4.5, `${id}'s text on its strip`);
    assert.ok(contrast(colors.text, colors.stripActive) >= 4.5, `${id}'s text on its lit pill`);
    // The two voices of an alternating hymn are told apart by hue: the one
    // verse is plain ink, the other unmistakably blue.
    assert.ok(chroma(colors.text) <= 0.08, `${id}'s "white" verse is plain ink`);
    assert.ok(hsl(colors.alternate).s >= 0.4 && hue(colors.alternate) >= 195 && hue(colors.alternate) <= 235, `${id}'s "blue" verse is blue`);
  }
});

test('Night is exactly the page the services have always been read on', () => {
  const { colors } = NIGHT_DOCUMENT_THEME;
  assert.deepEqual(
    [colors.page, colors.text, colors.alternate, colors.accent, colors.priest, colors.deacon, colors.people, colors.peopleText, colors.comment, colors.silent, colors.refrain, colors.metropolitan, colors.subdoc, colors.link, colors.surface, colors.border],
    [COLORS.black, COLORS.white, COLORS.rowBlue, COLORS.gold, COLORS.priest, COLORS.deacon, COLORS.people, COLORS.peopleLight, COLORS.comment, COLORS.silent, COLORS.refrain, COLORS.metropolitanBrackets, COLORS.subdoc, COLORS.link, COLORS.surface, COLORS.border],
  );
  assert.equal(colors.strip, '#111111');
  assert.equal(colors.stripActive, '#171513');
  // The slideshow reads the same page under its own names.
  const slideshow = slideshowThemeFor(NIGHT_DOCUMENT_THEME);
  assert.equal(slideshow.colors.gold, COLORS.gold);
  assert.equal(slideshow.colors.rowBlue, COLORS.rowBlue);
  assert.equal(slideshow.colors.text, COLORS.white);
  assert.equal(slideshow.colors.peopleText, COLORS.peopleLight);
});

test('the light pages keep every rubric its hue, deepened to carry on paper', () => {
  for (const id of ['sepia', 'paper']) {
    const { colors } = DOCUMENT_THEMES[id];
    const near = (a, b, within) => Math.min(Math.abs(hue(a) - hue(b)), 360 - Math.abs(hue(a) - hue(b))) <= within;
    assert.ok(near(colors.priest, COLORS.priest, 12), `${id}'s priest stays red`);
    assert.ok(near(colors.deacon, COLORS.deacon, 12), `${id}'s deacon stays yellow`);
    assert.ok(near(colors.people, COLORS.people, 12), `${id}'s people stay orange`);
    assert.ok(near(colors.alternate, COLORS.rowBlue, 15), `${id}'s blue verse stays blue`);
    assert.ok(near(colors.refrain, COLORS.refrain, 15), `${id}'s refrain stays green`);
    assert.ok(luminance(colors.text) < 0.05 && luminance(colors.page) > 0.8, `${id} is ink on paper`);
  }
});

test('the stored choice is a page, and Night when it is not', () => {
  const source = fs.readFileSync('src/utils/preferencesStorage.ts', 'utf8');
  assert.match(source, /documentTheme: DocumentThemeId;/);
  assert.match(source, /documentTheme: DEFAULT_DOCUMENT_THEME_ID,/);
  assert.match(source, /merged\.documentTheme = isDocumentThemeId\(stored\?\.documentTheme\) \? stored\.documentTheme : DEFAULT_DOCUMENT_THEME_ID;/);
  // A device choice, like the text size: not among what syncs between devices.
  const synced = source.slice(source.indexOf('export type SyncedReadingPreferences'), source.indexOf('export const DEFAULT_READING_PREFERENCES'));
  assert.doesNotMatch(synced, /documentTheme/);
  assert.match(fs.readFileSync('src/context/ReadingPreferencesContext.tsx', 'utf8'), /setDocumentTheme: \(theme: DocumentThemeId\) => void;/);
});

/** The document builder, with its leaf imports stubbed as tests/selectionMenus.test.cjs stubs the Bible's. */
function loadDocumentBuilder() {
  const local = {
    '../../constants/theme': theme,
    '../../constants/documentThemes': themes,
    './documentPresentationMetrics': loadFile('src/components/vine/documentPresentationMetrics.js'),
    './textHighlights': loadFile('src/components/vine/textHighlights.ts'),
    '../../utils/versePresentation': loadFile('src/utils/versePresentation.js'),
    '../../utils/verseRubric': loadFile('src/utils/verseRubric.js'),
  };
  return loadFile('src/components/vine/documentHtml.ts', (name) => local[name] || require(name)).buildDocumentHtml;
}

function loadBibleBuilder() {
  const local = {
    '../../constants/documentThemes': themes,
    './textHighlights': loadFile('src/components/vine/textHighlights.ts'),
    './documentPresentationMetrics': loadFile('src/components/vine/documentPresentationMetrics.js'),
    '../../utils/bibleNumerals': loadFile('src/utils/bibleNumerals.ts'),
    '../../utils/displayText': { formatEnglishDisplayText: (value) => String(value || '') },
  };
  return loadFile('src/components/vine/bibleDocumentHtml.ts', (name) => local[name] || require(name)).buildBibleChapterHtml;
}

const verse = (english, extra = {}) => ({ english, coptic: '', arabic: '', type: 'text', ...extra });
const SECTIONS = [
  {
    id: 'hymn',
    title: { english: 'A Hymn', arabic: '' },
    alternateEvery: 1,
    collapsible: true,
    verses: [
      verse('Priest line', { type: 'priest' }),
      verse('Deacon line', { type: 'deacon' }),
      verse('People line', { type: 'people' }),
      verse('A comment', { type: 'comment' }),
      verse('A silent prayer', { type: 'silentPrayer' }),
      verse('Refrain', { type: 'refrain' }),
      verse('Matthew 1:1', { type: 'readingReference' }),
      verse('The (Metropolitan) bows'),
    ],
  },
  { id: 'open', title: { english: 'Open', arabic: '' }, verses: [], isSubdocumentButton: true, subdocumentKey: 'X' },
  { id: 'go', title: { english: 'Go', arabic: '' }, verses: [], isHyperlinkButton: true, hyperlinkKey: 'Y' },
];

test('the scrolling reader is set on its page, and no other', () => {
  const build = loadDocumentBuilder();
  const options = { copticFontDataUri: 'data:font/ttf;base64,AA==', fontSize: 18, displayComments: true, displaySilentPrayers: true };
  const night = build(SECTIONS, options);
  assert.equal(night, build(SECTIONS, { ...options, theme: NIGHT_DOCUMENT_THEME }), 'Night is what an unthemed build has always been');
  for (const id of DOCUMENT_THEME_IDS) {
    const page = DOCUMENT_THEMES[id];
    const html = build(SECTIONS, { ...options, theme: page });
    const { colors } = page;
    assert.match(html, new RegExp(`<meta name="color-scheme" content="${page.dark ? 'dark' : 'light'}" />`), id);
    assert.match(html, new RegExp(`html, body \\{\\s+background: ${colors.page};\\s+color: ${colors.text};`), `${id}'s page`);
    assert.match(html, new RegExp(`\\.speaker-label\\.priest \\{ color: ${colors.priest}; \\}`), `${id}'s priest label`);
    assert.match(html, new RegExp(`\\.speaker-label\\.deacon, \\.speaker-label\\.reader \\{ color: ${colors.deacon}; \\}`), `${id}'s deacon label`);
    assert.match(html, new RegExp(`\\.speaker-label\\.people \\{ color: ${colors.people}; \\}`), `${id}'s people label`);
    assert.match(html, new RegExp(`\\.section-title \\{\\s+color: ${colors.accent};`), `${id}'s titles`);
    assert.match(html, new RegExp(`\\.section-title\\.silent-prayer \\{\\s+color: ${colors.silent};`), `${id}'s silent titles`);
    assert.match(html, new RegExp(`\\.metropolitan \\{ color: ${colors.metropolitan}; \\}`), `${id}'s metropolitan`);
    assert.match(html, new RegExp(`stroke="${colors.accent}"`), `${id}'s collapse button`);
    assert.match(html, new RegExp(`\\.gospel-rite-toggle\\.is-on \\{\\s+background: ${colors.accent};\\s+color: ${colors.onAccent};`), `${id}'s lit toggle`);
    // Each kind of line is inked in the page's colour for it.
    for (const [text, key] of [['A comment', 'comment'], ['A silent prayer', 'silent'], ['Refrain', 'refrain'], ['Matthew 1:1', 'comment'], ['Priest line', 'text'], ['Deacon line', 'alternate']]) {
      const at = html.indexOf(`>${text}<`);
      assert.ok(at > 0, `${id} shows "${text}"`);
      const paragraph = html.slice(html.lastIndexOf('<p ', at), at);
      assert.match(paragraph, new RegExp(`color:\\s*${colors[key]}`), `${id}: "${text}" in ${key}`);
    }
    for (const other of DOCUMENT_THEME_IDS) {
      if (other !== id) assert.doesNotMatch(html, new RegExp(`background: ${DOCUMENT_THEMES[other].colors.page};`), `${id} shows no ${other} page`);
    }
  }
});

test('the Bible reader is set on its page too, down to what a copy carries', () => {
  const build = loadBibleBuilder();
  const verses = [{ verseNumber: 1, english: 'In the beginning', englishNkjv: '', englishFromCoptic: '', coptic: '', greek: '', arabic: '', arabicFromCoptic: '', french: '' }];
  const options = { verses, languageKeys: ['english'], fontSize: 18, copticFontDataUri: 'data:font/ttf;base64,AA==', bottomContentInset: 0 };
  assert.equal(build(options), build({ ...options, theme: NIGHT_DOCUMENT_THEME }));
  for (const id of DOCUMENT_THEME_IDS) {
    const page = DOCUMENT_THEMES[id];
    const html = build({ ...options, theme: page, isSlideshow: id === 'paper' });
    const { colors } = page;
    assert.match(html, new RegExp(`color-scheme: ${page.dark ? 'dark' : 'light'};`), id);
    assert.match(html, new RegExp(`--text-color: ${colors.text};`), id);
    assert.match(html, new RegExp(`--gold: ${colors.accent};`), id);
    assert.match(html, new RegExp(`--lxx-addition: ${colors.priest};`), id);
    assert.match(html, new RegExp(`--psalm-introduction: ${colors.refrain};`), id);
    assert.equal((html.match(new RegExp(`background: ${colors.page};`, 'g')) || []).length, 2, `${id}'s page, and its slideshow pager`);
    assert.match(html, new RegExp(`background: ${JSON.stringify(colors.page)},\\s+text: ${JSON.stringify(colors.text)},\\s+gold: ${JSON.stringify(colors.accent)}`), `${id}'s copy colours`);
    assert.doesNotMatch(html, /background: #000;/, `${id} has no hard-coded black`);
  }
});

test('the slideshow and the screens around every reader take the page too', () => {
  const read = (path) => fs.readFileSync(path, 'utf8');
  for (const path of ['src/components/vine/SlideshowContainer.js', 'src/components/vine/VerseBlock.js', 'src/components/vine/DocumentSurface.tsx', 'src/components/vine/DocumentWebView.web.tsx', 'src/components/vine/ui/DocumentPillBar.tsx', 'src/components/vine/bibleDocumentHtml.ts']) {
    assert.doesNotMatch(read(path), /COLORS\./, `${path} reads no fixed colour`);
  }
  assert.match(read('src/components/vine/DocumentSurface.tsx'), /const theme = getDocumentTheme\(preferences\.documentTheme\);/);
  assert.match(read('src/components/vine/DocumentSurface.tsx'), /theme=\{slideshowTheme\}/);
  assert.match(read('src/components/vine/VerseBlock.js'), /getSpeakerColor\(rubricType, bishopPresent, theme\)/);
  assert.match(read('src/components/vine/screens/ServiceDocument.tsx'), /backgroundColor: documentTheme\.colors\.page/);
  assert.match(read('src/components/vine/screens/ServiceDocument.tsx'), /preferences\.appLanguage, preferences\.documentTheme, effectiveDate/, 'a change of page restores the reader to its place like any other setting');
  assert.match(read('src/components/vine/screens/DocumentModal.tsx'), /backgroundColor: documentTheme\.colors\.page/);
  assert.match(read('src/app/bible/[bookKey]/[chapter].tsx'), /backgroundColor={theme\.colors\.page}/);
  assert.match(read('src/app/bible/[bookKey]/[chapter].tsx'), /restoreVerse, targetVerse, theme\.id\]/, 'a change of page is a new reader');
});

test('Book Settings opens with the page picker: one radio per page, the chosen one checked', () => {
  const settings = fs.readFileSync('src/components/vine/screens/SettingsScreen.tsx', 'utf8');
  assert.match(settings, /appearance: \{ english: 'Appearance', arabic: 'المظهر', french: 'Apparence' \}/);
  assert.match(settings, /<DocumentThemePicker selected=\{preferences\.documentTheme\} onSelect=\{setDocumentTheme\} isArabic=\{isArabicChrome\} \/>/);
  assert.ok(settings.indexOf('SETTINGS_LABELS.appearance)') < settings.indexOf('SETTINGS_LABELS.languages)'), 'Appearance comes first');
  const picker = fs.readFileSync('src/components/vine/ui/DocumentThemePicker.tsx', 'utf8');
  assert.match(picker, /accessibilityRole="radiogroup"/);
  assert.match(picker, /accessibilityRole="radio"/);
  assert.match(picker, /accessibilityState=\{\{ checked: active, selected: active \}\}/);
  assert.match(picker, /DOCUMENT_THEME_IDS\.map/);
  // The swatch shows the page with its two inks.
  assert.match(picker, /<Text style=\{\{ color: theme\.colors\.text \}\}>A<\/Text>\s+<Text style=\{\{ color: theme\.colors\.alternate \}\}>a<\/Text>/);
});
