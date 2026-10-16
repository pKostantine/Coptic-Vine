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
/** A colour in OKLab, the perceptual space in which equal distances look equally different. */
const oklab = (hex) => {
  const v = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((c) => { const x = c / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    L: 0.2104542553 * l + 0.793617963 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
};
/**
 * How different two colours look (OKLab ΔE), lightness included: a page set in
 * one family of colours -- Walnut's cream and honey, Vine's cream and celadon --
 * tells its lines apart by shade as much as by hue. Night's white and blue are
 * 0.22 apart; Vine's cream and celadon 0.10; a caramel beside Walnut's cream,
 * too close to read as a second voice, would be 0.04.
 */
const apart = (x, y) => { const p = oklab(x); const q = oklab(y); return Math.hypot(p.L - q.L, p.a - q.a, p.b - q.b); };
const RGBA = /^rgba\(\d+, \d+, \d+, (0(\.\d+)?|1)\)$/;

const TEXT_COLORS = ['text', 'alternate', 'accent', 'priest', 'deacon', 'people', 'peopleText', 'refrain', 'metropolitan', 'subdoc', 'link', 'choice'];
const QUIET_COLORS = ['comment', 'silent'];
const SOLID_COLORS = ['page', 'surface', 'border', 'strip', 'stripActive', 'onAccent', ...TEXT_COLORS, ...QUIET_COLORS];
const WASHES = ['accentSoft', 'accentLine', 'subdocSoft', 'subdocLine', 'linkSoft', 'linkLine', 'choiceSoft', 'choiceLine'];

test('there are five pages, darkest to lightest, Night first and the default, each with a name in every App Language', () => {
  assert.deepEqual(DOCUMENT_THEME_IDS, ['night', 'walnut', 'vine', 'sepia', 'paper']);
  assert.equal(getDocumentTheme(undefined), NIGHT_DOCUMENT_THEME);
  assert.equal(getDocumentTheme('sepia').id, 'sepia');
  // A page this version doesn't know (a newer app synced it, a hand-edited file) reads as Night rather than breaking.
  assert.equal(getDocumentTheme('amber'), NIGHT_DOCUMENT_THEME);
  // So does a page an earlier version offered and this one has dropped.
  for (const dropped of ['slate', 'ink']) assert.equal(getDocumentTheme(dropped), NIGHT_DOCUMENT_THEME, dropped);
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
    // The quiet lines are quieter than either voice of the text.
    for (const key of QUIET_COLORS) {
      assert.ok(contrast(colors[key], colors.page) < Math.min(contrast(colors.text, colors.page), contrast(colors.alternate, colors.page)), `${id}.${key} steps back from the text`);
    }
  }
});

test('every page tells its lines apart by colour, whatever colours it chooses', () => {
  for (const id of DOCUMENT_THEME_IDS) {
    const { colors } = DOCUMENT_THEMES[id];
    const distinct = (a, b, within) => {
      const gap = apart(colors[a], colors[b]);
      assert.ok(gap >= within, `${id}: ${a} ${colors[a]} and ${b} ${colors[b]} are only ${gap.toFixed(3)} apart`);
    };
    // The two voices of an alternating hymn, at a glance.
    distinct('text', 'alternate', 0.09);
    // A refrain is neither voice.
    distinct('refrain', 'text', 0.08);
    distinct('refrain', 'alternate', 0.08);
    // The priest, the deacon and the people each have a colour of their own,
    // and none of them is mistaken for a verse — nor is a People line's own text.
    distinct('priest', 'deacon', 0.06);
    distinct('priest', 'people', 0.06);
    distinct('deacon', 'people', 0.06);
    for (const speaker of ['priest', 'deacon', 'people', 'peopleText']) {
      distinct(speaker, 'text', 0.07);
      distinct(speaker, 'alternate', 0.07);
    }
    // The titles stand apart from the verses under them.
    distinct('accent', 'text', 0.06);
    distinct('accent', 'alternate', 0.06);
    // Opening a nested document and leaving for another service are different buttons.
    distinct('subdoc', 'link', 0.08);
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
  assert.equal(colors.onAccent, COLORS.black);
  assert.deepEqual(
    [colors.accentSoft, colors.accentLine, colors.subdocSoft, colors.subdocLine, colors.linkSoft, colors.linkLine],
    [COLORS.goldSoft, COLORS.goldLine, COLORS.subdocSoft, COLORS.subdocLine, COLORS.linkSoft, COLORS.linkLine],
  );
  // The slideshow reads the same page under its own names.
  const slideshow = slideshowThemeFor(NIGHT_DOCUMENT_THEME);
  assert.equal(slideshow.colors.gold, COLORS.gold);
  assert.equal(slideshow.colors.rowBlue, COLORS.rowBlue);
  assert.equal(slideshow.colors.text, COLORS.white);
  assert.equal(slideshow.colors.peopleText, COLORS.peopleLight);
});

test('Paper keeps its pinned colours: the rubrics deepened for white, and a Prussian blue', () => {
  const { colors } = DOCUMENT_THEMES.paper;
  assert.deepEqual(colors, {
    page: '#FFFFFF',
    surface: '#F3F3F1',
    border: '#E3E3E3',
    strip: '#F4F4F2',
    stripActive: '#ECECE9',
    text: '#1C1C1C',
    alternate: '#1B4E7E',
    accent: '#8A5A12',
    onAccent: '#FFFFFF',
    accentSoft: withAlpha('#8A5A12', 0.1),
    accentLine: withAlpha('#8A5A12', 0.45),
    priest: '#B4292B',
    deacon: '#7A6A00',
    people: '#A34A14',
    peopleText: '#8A4A1E',
    comment: '#6B7A8C',
    silent: '#767676',
    refrain: '#2A6F43',
    metropolitan: '#0B6A75',
    subdoc: '#1B4E7E',
    subdocSoft: withAlpha('#1B4E7E', 0.1),
    subdocLine: withAlpha('#1B4E7E', 0.4),
    link: '#24735A',
    linkSoft: withAlpha('#24735A', 0.1),
    linkLine: withAlpha('#24735A', 0.4),
    choice: '#5B3A9E',
    choiceSoft: withAlpha('#5B3A9E', 0.1),
    choiceLine: withAlpha('#5B3A9E', 0.4),
  });
});

test('the light pages are dark ink on a light page, Sepia a warm parchment rather than near-white', () => {
  for (const id of DOCUMENT_THEME_IDS.filter((page) => !DOCUMENT_THEMES[page].dark)) {
    const { colors } = DOCUMENT_THEMES[id];
    assert.ok(luminance(colors.text) < 0.05 && luminance(colors.page) > 0.6, `${id} is ink on paper`);
  }
  const parchment = DOCUMENT_THEMES.sepia.colors.page;
  const { a, b } = oklab(parchment);
  // Warm: a clear yellow cast, not the greyed beige of an off-white (the old #E6D9BC fell short).
  assert.ok(b > 0.05 && b > Math.abs(a) * 2, `${parchment} reads warm`);
  assert.ok(luminance(parchment) < 0.8, `${parchment} doesn't glare like white`);
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
    '../../constants/documentOrnaments': loadFile('src/constants/documentOrnaments.ts', (name) => (name === './ornamentArt' ? loadFile('src/constants/ornamentArt.ts') : require(name))),
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

test('Book Settings offers the page picker first under Display: one radio per page, the chosen one checked', () => {
  const settings = fs.readFileSync('src/components/vine/screens/SettingsScreen.tsx', 'utf8');
  const picker = '<DocumentThemePicker selected={preferences.documentTheme} onSelect={setDocumentTheme} isArabic={arabic} />';
  assert.ok(settings.includes(picker));
  const display = settings.indexOf('kicker(SETTINGS_LABELS.display, wide)');
  assert.ok(display > 0 && display < settings.indexOf(picker), 'The page picker sits under the Display heading');
  assert.ok(settings.indexOf(picker) < settings.indexOf('<FontScaleControl'), 'It comes before the text size and the rest of Display');
  const source = fs.readFileSync('src/components/vine/ui/DocumentThemePicker.tsx', 'utf8');
  assert.match(source, /accessibilityRole="radiogroup"/);
  assert.match(source, /accessibilityRole="radio"/);
  assert.match(source, /accessibilityState=\{\{ checked: active, selected: active \}\}/);
  assert.match(source, /DOCUMENT_THEME_IDS\.map/);
  // The swatch shows the page with its two inks.
  assert.match(source, /<Text style=\{\{ color: theme\.colors\.text \}\}>A<\/Text>\s+<Text style=\{\{ color: theme\.colors\.alternate \}\}>a<\/Text>/);
  // Every dark page's swatch carries the hairline that keeps it from sinking into the green sheet.
  assert.match(source, /theme\.dark && styles\.swatchEdge/);
});
