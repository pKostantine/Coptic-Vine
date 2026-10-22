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
const read = (path) => fs.readFileSync(path, 'utf8');

const theme = loadFile('src/constants/theme.ts');
const themes = loadFile('src/constants/documentThemes.ts', (name) => (name === './theme' ? theme : require(name)));
const { documentSelectorColors } = loadFile('src/constants/documentSelectorColors.ts', (name) => (name === './documentThemes' ? themes : require(name)));
const { COLORS } = theme;
const { DOCUMENT_THEMES, DOCUMENT_THEME_IDS, NIGHT_DOCUMENT_THEME, withAlpha } = themes;

const rgbOf = (color) => (color.startsWith('#')
  ? [1, 3, 5].map((at) => parseInt(color.slice(at, at + 2), 16))
  : color.match(/[\d.]+/g).slice(0, 3).map(Number));
const channel = (value) => { const c = value / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const luminance = (color) => { const [r, g, b] = rgbOf(color); return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b); };
const contrast = (a, b) => { const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (high + 0.05) / (low + 0.05); };
/** A wash (rgba) laid over a solid hex, as the eye sees the two together. */
const over = (wash, base) => {
  const alpha = Number(wash.match(/[\d.]+/g)[3]);
  const top = rgbOf(wash);
  return `#${rgbOf(base).map((value, index) => Math.round(value + (top[index] - value) * alpha).toString(16).padStart(2, '0')).join('')}`;
};

test('on Night the drawers keep exactly the black and gold they have always had', () => {
  assert.deepEqual(documentSelectorColors(NIGHT_DOCUMENT_THEME), {
    panel: '#050505',
    quiet: COLORS.silentTitle,
    switchTrack: '#2A2A2A',
    disabled: '#6E6E6E',
    scrim: 'rgba(0, 0, 0, 0.48)',
  });
  // What the drawers take straight from Night is the old drawer's own too.
  const { colors } = NIGHT_DOCUMENT_THEME;
  assert.equal(colors.strip, '#111111', 'the header and the rows');
  assert.equal(colors.stripActive, '#171513', 'the lit row');
  assert.equal(withAlpha(colors.accent, 0.72), 'rgba(227, 181, 59, 0.72)', "the lit row's edge");
  assert.equal(withAlpha(colors.accent, 0.35), 'rgba(227, 181, 59, 0.35)', "the drawer's edge");
  assert.equal(withAlpha(colors.text, 0.28), 'rgba(255, 255, 255, 0.28)', "a switch's edge at rest");
  assert.deepEqual(
    [colors.text, colors.accent, colors.accentLine, colors.border, colors.surface, colors.onAccent, colors.priest, colors.refrain],
    [COLORS.white, COLORS.gold, COLORS.goldLine, COLORS.border, COLORS.surface, COLORS.black, COLORS.priest, COLORS.refrain],
  );
});

test('every label in a drawer reads at 4.5:1 on every page', () => {
  for (const id of DOCUMENT_THEME_IDS) {
    const page = DOCUMENT_THEMES[id];
    const { colors } = page;
    const drawer = documentSelectorColors(page);
    const reads = (color, grounds, what) => {
      for (const ground of grounds) {
        const ratio = contrast(color, ground);
        assert.ok(ratio >= 4.5, `${id}: ${what} (${color} on ${ground}) is ${ratio.toFixed(2)}:1`);
      }
    };
    const rows = [drawer.panel, colors.strip, colors.stripActive];
    reads(colors.text, rows, 'a row title');
    reads(drawer.quiet, rows, "a silent prayer's title");
    reads(colors.accent, [drawer.panel, colors.strip], 'the gold of the header, the hour headings and the verse numbers');
    reads(colors.refrain, [colors.strip], "a psalm introduction's preview");
    reads(colors.subdoc, [over(colors.subdocSoft, drawer.panel), colors.stripActive], 'a subdocument row');
    reads(colors.link, [over(colors.linkSoft, drawer.panel)], 'a hyperlink row');
    reads(colors.text, [colors.surface], 'a language button at rest');
    reads(colors.onAccent, [colors.accent], 'a language button lit');
    // (The Septuagint's verse numbers are left to the page: Night's red has
    // always sat at 4.3:1 on its row, and Night keeps its look.)
  }
});

test('a quiet title steps back from the text, and is the page\'s own silent colour wherever that already reads', () => {
  for (const id of DOCUMENT_THEME_IDS) {
    const page = DOCUMENT_THEMES[id];
    const { colors } = page;
    const { quiet } = documentSelectorColors(page);
    assert.ok(contrast(quiet, colors.strip) < contrast(colors.text, colors.strip), `${id}'s quiet title is quieter than its text`);
    if (page.dark) assert.equal(quiet, colors.silent, `${id} keeps its silent colour`);
  }
  // Sepia's and Paper's silent greys fade too far on a row to read as a
  // title, so they are carried a little toward the ink.
  for (const id of ['sepia', 'paper']) {
    const { colors } = DOCUMENT_THEMES[id];
    const { quiet } = documentSelectorColors(DOCUMENT_THEMES[id]);
    assert.ok(contrast(colors.silent, colors.strip) < 4.5, `${id}'s silent colour alone would not read on a row`);
    assert.ok(luminance(quiet) < luminance(colors.silent) && luminance(quiet) > luminance(colors.text), `${id}'s quiet sits between its silent colour and its ink`);
  }
});

test('the drawer is a breath lighter than its page, and a light page is dimmed with its own ink', () => {
  for (const id of DOCUMENT_THEME_IDS) {
    const page = DOCUMENT_THEMES[id];
    const drawer = documentSelectorColors(page);
    assert.ok(luminance(drawer.panel) >= luminance(page.colors.page), `${id}'s drawer is no darker than its page`);
    assert.ok(contrast(drawer.panel, page.colors.page) < 1.1, `${id}'s drawer is of its page`);
    assert.equal(drawer.scrim, page.dark ? 'rgba(0, 0, 0, 0.48)' : withAlpha(page.colors.text, 0.3), `${id}'s scrim`);
    // A switch at rest and a control that cannot be used still show on the drawer.
    assert.ok(contrast(drawer.switchTrack, drawer.panel) > 1.3, `${id}'s switch track shows`);
    assert.ok(contrast(drawer.disabled, drawer.panel) > 2, `${id}'s disabled control shows`);
  }
});

test('the content list, the verse selector and the Sermon Planner are drawn in the page they open over', () => {
  const literal = /'#[0-9A-Fa-f]{3,8}'|"#[0-9A-Fa-f]{3,8}"|'rgba\(/;

  const contents = read('src/components/vine/ui/ContentSelectorDrawer.tsx');
  assert.match(contents, /theme = NIGHT_DOCUMENT_THEME,/);
  assert.match(contents, /const styles = useMemo\(\(\) => createStyles\(theme\), \[theme\]\);/);
  assert.doesNotMatch(contents, literal, 'the content list holds no fixed colour');
  // Only the switch's white thumb is fixed: white reads on every page's gold and track.
  assert.deepEqual([...new Set(contents.match(/COLORS\.\w+/g))], ['COLORS.white']);

  const chapter = read('src/app/bible/[bookKey]/[chapter].tsx');
  const verseSelector = read('src/components/vine/ui/BibleVersePanel.tsx');
  assert.doesNotMatch(verseSelector, literal, 'the verse selector holds no fixed colour');
  assert.doesNotMatch(verseSelector, /COLORS\./, 'nor any of the app chrome');
  assert.match(verseSelector, /const styles = useMemo\(\(\) => createStyles\(theme\), \[theme\]\);/);
  assert.doesNotMatch(chapter, /COLORS\.(gold|white|surface|border)\b/, 'its buttons and icons take the page too');
  assert.match(chapter, /const styles = useMemo\(\(\) => createStyles\(theme\), \[theme\]\);/);

  // Both lists sit on the one sheet, which takes its scrim and panel from the page.
  const sheet = read('src/components/vine/ui/ReaderPanel.tsx');
  assert.deepEqual(sheet.match(/'#[0-9A-Fa-f]{3,8}'|'rgba\([^']*'/g), ["'#000000'"], 'the sheet fixes only its shadow');
  assert.match(sheet, /backgroundColor: colors\.scrim/);
  assert.match(sheet, /backgroundColor: colors\.panel/);

  const planner = read('src/components/vine/ui/SermonPlannerDrawer.tsx');
  assert.match(planner, /theme = NIGHT_DOCUMENT_THEME,/);
  assert.match(planner, /if \(theme\.id === 'night'\) return NIGHT_PLANNER_COLORS;/, 'Night keeps the planner its own slate');
  assert.match(planner, /panel: '#080A0C',/);
  const plannerBody = planner.slice(planner.indexOf('export default function SermonPlannerDrawer'));
  assert.doesNotMatch(plannerBody, literal, 'the planner draws only from its palette');
  // The highlight swatches keep their own colours: they are the reader's highlights.
  assert.doesNotMatch(plannerBody, /(?<!HIGHLIGHT_)COLORS\./, 'and none of the app chrome');

  // Each drawer is handed the page its reader is on.
  const element = (source, name) => source.match(new RegExp(`<${name}\\b[^]*?/>`))[0];
  const service = read('src/components/vine/screens/ServiceDocument.tsx');
  assert.match(element(service, 'ContentSelectorDrawer'), /theme=\{documentTheme\}/);
  assert.match(element(service, 'SermonPlannerDrawer'), /theme=\{documentTheme\}/);
  assert.match(element(read('src/components/vine/screens/DocumentModal.tsx'), 'ContentSelectorDrawer'), /theme=\{documentTheme\}/);
  assert.match(element(chapter, 'BibleVersePanel'), /theme=\{theme\}/);
  assert.match(contents, /<ReaderPanel\b[^]*?\n\s*theme=\{theme\}\n/);
  assert.match(verseSelector, /<ReaderPanel\b[^]*?\n\s*theme=\{theme\}\n/);

  // The drawers run up under the status bar, so its clock turns dark over a light page.
  for (const source of [sheet, planner]) {
    assert.match(source, /<StatusBar style=\{theme\.dark \? 'light' : 'dark'\} \/>/);
  }
});
