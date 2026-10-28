const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

// The reader's two side panels — the service's Contents and the Bible's
// Verses — keep their logic in readerPanelParts.ts. It is loaded here with its
// own imports; the content client behind bibleService is the one module left out.
const STUBS = { 'src/services/contentDataClient': { contentDataClient: {} } };
const loaded = new Map();

function resolve(from, specifier) {
  const base = specifier.startsWith('@/') ? path.join('src', specifier.slice(2)) : path.join(path.dirname(from), specifier);
  for (const extension of ['', '.ts', '.tsx', '.js']) {
    if (fs.existsSync(base + extension) && fs.statSync(base + extension).isFile()) return base + extension;
  }
  return base;
}

function load(file) {
  const stub = STUBS[file.replace(/\.(ts|tsx|js)$/, '')];
  if (stub) return stub;
  if (loaded.has(file)) return loaded.get(file).exports;
  const moduleObject = { exports: {} };
  loaded.set(file, moduleObject);
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const localRequire = (specifier) => (specifier.startsWith('.') || specifier.startsWith('@/') ? load(resolve(file, specifier)) : require(specifier));
  new Function('exports', 'require', 'module', output)(moduleObject.exports, localRequire, moduleObject);
  return moduleObject.exports;
}

const {
  chapterPosition,
  foldForSearch,
  highlightColorsByVerse,
  mixHex,
  pickRowText,
  readerPanelColors,
  readerPanelLayout,
  readerPanelText,
  rowMatchesSearch,
  rowPlaces,
  sectionRowParts,
  trailingHyperlinkIds,
} = load('src/components/vine/ui/readerPanelParts.ts');
const { DOCUMENT_THEMES, DOCUMENT_THEME_IDS } = load('src/constants/documentThemes.ts');

/** A citation line as hymnLibrary's readingReferenceVerse builds it. */
const cites = (readingType, english, arabic, french) =>
  ({ type: 'readingReference', english, arabic, french, coptic: '', reading: { service: 'Matins', readingType } });
const line = (english) => ({ type: 'text', english, arabic: english, coptic: '' });
const section = (id, title, verses = [line('…')], extra = {}) => ({ id, title, verses, ...extra });

test("a reading's row is its name, with the citation after it", () => {
  // Read by its citation alone: named by its kind, the citation set apart, a range with an en dash.
  const psalm = section('psalm', { english: '', arabic: '' }, [cites('Psalm', 'Psalm 39:9-10', 'مزمور 39: 9-10', '')]);
  assert.deepEqual(sectionRowParts(psalm), {
    title: { english: 'Psalm', arabic: 'المزمور', french: 'Psaume' },
    citation: { english: '39:9–10', arabic: '٣٩: ٩-١٠', french: '39:9–10' },
  });
  const gospel = section('gospel', { english: '', arabic: '' }, [cites('Gospel', 'Mark 2:13-17', 'مرقس 2: 13-17', 'Marc 2:13-17')]);
  assert.deepEqual(sectionRowParts(gospel), {
    title: { english: 'Gospel', arabic: 'الإنجيل', french: 'Évangile' },
    citation: { english: 'Mark 2:13–17', arabic: 'مرقس ٢: ١٣-١٧', french: 'Marc 2:13–17' },
  });
  // Named, with its citation in brackets: the two taken apart.
  const pauline = section('pauline', { english: 'Pauline Epistle', arabic: 'البولس', french: 'Épître de saint Paul' }, [
    cites('Pauline Epistle', 'Romans 1:1-12', 'رومية 1: 1-12', 'Romains 1:1-12'),
  ]);
  assert.deepEqual(sectionRowParts(pauline), {
    title: { english: 'Pauline Epistle', arabic: 'البولس', french: 'Épître de saint Paul' },
    citation: { english: 'Romans 1:1–12', arabic: 'رومية ١: ١-١٢', french: 'Romains 1:1–12' },
  });
  // Anything else keeps its title, and has no citation.
  assert.deepEqual(sectionRowParts(section('gloria', { english: 'The Gloria', arabic: 'المجد' })), {
    title: { english: 'The Gloria', arabic: 'المجد', french: '' },
    citation: null,
  });
  // Not a reading kind the list knows: left as the selector title gives it.
  const other = section('other', { english: '', arabic: '' }, [cites('Sermon', 'Matthew 5:1', '', '')]);
  assert.deepEqual(sectionRowParts(other), { title: { english: 'Matthew 5:1', arabic: '', french: '' }, citation: null });
});

test('a row is drawn in the App Language, falling back to whichever it has', () => {
  const both = { english: 'Gospel', arabic: 'الإنجيل', french: 'Évangile' };
  assert.deepEqual(pickRowText(both, 'en'), { text: 'Gospel', arabic: false });
  assert.deepEqual(pickRowText(both, 'fr'), { text: 'Évangile', arabic: false });
  assert.deepEqual(pickRowText(both, 'ar'), { text: 'الإنجيل', arabic: true });
  assert.deepEqual(pickRowText({ english: 'Trisagion', arabic: '' }, 'ar'), { text: 'Trisagion', arabic: false });
  assert.deepEqual(pickRowText({ english: 'Trisagion', arabic: '', french: '' }, 'fr'), { text: 'Trisagion', arabic: false });
  assert.deepEqual(pickRowText({ english: '', arabic: 'المجد' }, 'en'), { text: 'المجد', arabic: true });
  assert.deepEqual(pickRowText(null, 'en'), { text: '', arabic: false });
});

test('Find a section matches a name or a citation in any language, ignoring case, accents and vowel marks', () => {
  const gospel = sectionRowParts(section('gospel', { english: '', arabic: '' }, [cites('Gospel', 'Mark 2:13-17', 'مرقس 2: 13-17', 'Marc 2:13-17')]));
  const gloria = sectionRowParts(section('gloria', { english: 'The Gloria', arabic: 'تَمْجِيد', french: 'Gloire' }));
  assert.ok(rowMatchesSearch(gloria, 'gloria'));
  assert.ok(rowMatchesSearch(gloria, '  GLORIA '));
  assert.ok(rowMatchesSearch(gloria, 'gloire'));
  assert.ok(rowMatchesSearch(gloria, 'Glóire'), 'an accent typed or not');
  assert.ok(rowMatchesSearch(gloria, 'تمجيد'), 'Arabic without its vowel marks');
  assert.ok(rowMatchesSearch(gospel, 'mark 2'), 'by its citation');
  assert.ok(rowMatchesSearch(gospel, 'evangile'));
  assert.ok(rowMatchesSearch(gospel, 'الانجيل'), 'any alef');
  assert.ok(!rowMatchesSearch(gloria, 'gospel'));
  assert.ok(!rowMatchesSearch(gospel, 'luke'));
  // Nothing typed lists every row.
  assert.ok(rowMatchesSearch(gloria, ''));
  assert.ok(rowMatchesSearch(gloria, '   '));
  assert.equal(foldForSearch('  The  Ẽvening\tPRAYER '), 'the evening prayer');
  assert.equal(foldForSearch('أَبَانَا إِنَّ آمِين'), 'ابانا ان امين');
});

test('rows before where the reader is are past, the one they are in is current, the rest are ahead', () => {
  assert.deepEqual(rowPlaces(['a', 'b', 'c', 'd'], 'c'), { a: 'past', b: 'past', c: 'current', d: 'ahead' });
  assert.deepEqual(rowPlaces(['a', 'b'], 'a'), { a: 'current', b: 'ahead' });
  assert.deepEqual(rowPlaces(['a', 'b'], 'b'), { a: 'past', b: 'current' });
  // Not yet anywhere, or somewhere the list doesn't show: nothing is past.
  assert.deepEqual(rowPlaces(['a', 'b'], null), { a: 'ahead', b: 'ahead' });
  assert.deepEqual(rowPlaces(['a', 'b'], 'z'), { a: 'ahead', b: 'ahead' });
});

test('a passed row is dimmed, but never the choice of interpretations, a button that works from the list', () => {
  const contents = fs.readFileSync('src/components/vine/ui/ContentSelectorDrawer.tsx', 'utf8');
  assert.match(contents, /const isChoice = Boolean\(section\.isInterpretationChooserButton\);/);
  assert.match(contents, /const isPast = places\[section\.id\] === 'past' && !isHere && !isChoice;/);
  assert.ok(contents.indexOf('const isChoice =') < contents.indexOf('const isPast ='));
});

test('the buttons to the next service that close the list become its Up next', () => {
  const rows = (...kinds) => kinds.map((kind, index) => ({ id: `${kind}${index}`, isHyperlinkButton: kind === 'link' }));
  assert.deepEqual([...trailingHyperlinkIds(rows('row', 'link', 'row', 'link', 'link'))], ['link4', 'link3']);
  assert.deepEqual([...trailingHyperlinkIds(rows('row', 'link', 'row'))], [], 'a link in the middle stays a row');
  assert.deepEqual([...trailingHyperlinkIds(rows('link', 'link'))], ['link1', 'link0']);
  assert.deepEqual([...trailingHyperlinkIds([])], []);
});

test('the panel is 420 wide on a desktop or tablet, most of a phone held upright, and narrow on a phone on its side', () => {
  const web = { native: false, mobileWebBreakpoint: 700 };
  const native = { native: true, mobileWebBreakpoint: 700 };
  assert.deepEqual(readerPanelLayout({ ...web, width: 1440, height: 900 }), { width: 420, compact: false, belowStatusBar: false });
  assert.deepEqual(readerPanelLayout({ ...web, width: 390, height: 844 }), { width: 335, compact: false, belowStatusBar: false });
  // A phone browser on its side is wider than the breakpoint; its short side gives it away.
  assert.deepEqual(readerPanelLayout({ ...web, width: 844, height: 390 }), { width: 364, compact: true, belowStatusBar: false });
  assert.deepEqual(readerPanelLayout({ ...web, width: 1112, height: 834 }), { width: 420, compact: false, belowStatusBar: false });
  // A phone on its side keeps the notch's strip as well as its own 340.
  assert.deepEqual(readerPanelLayout({ ...native, width: 844, height: 390, rightInset: 59 }), { width: 399, compact: true, belowStatusBar: false });
  assert.deepEqual(readerPanelLayout({ ...native, width: 568, height: 320, rightInset: 0 }), { width: 341, compact: true, belowStatusBar: false });
  assert.deepEqual(readerPanelLayout({ ...native, width: 390, height: 844 }), { width: 335, compact: false, belowStatusBar: false });
  // An iPad: 400 held upright, 420 on its side, and below the status bar either way.
  assert.deepEqual(readerPanelLayout({ ...native, width: 834, height: 1112 }), { width: 400, compact: false, belowStatusBar: true });
  assert.deepEqual(readerPanelLayout({ ...native, width: 1112, height: 834 }), { width: 420, compact: false, belowStatusBar: true });
  // The smallest a window gets before it counts as a phone still leaves the page in view.
  assert.deepEqual(readerPanelLayout({ ...web, width: 700, height: 500 }), { width: 420, compact: false, belowStatusBar: false });
  assert.equal(readerPanelLayout({ ...native, width: 600, height: 960 }).width, 400);
  assert.equal(readerPanelLayout({ ...web, width: 460, height: 400 }).width, 276, 'a small phone on its side keeps 40% for the page');
});

test("the panels take the page's colours, and the Up next card's title reads on its fill", () => {
  assert.equal(mixHex('#000000', '#ffffff', 0.05), '#f2f2f2');
  assert.equal(mixHex('#ffffff', '#000000', 0), '#000000');
  const luminance = (hex) => {
    const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
  for (const id of DOCUMENT_THEME_IDS) {
    const theme = DOCUMENT_THEMES[id];
    const colors = readerPanelColors(theme);
    assert.equal(colors.panel, mixHex(theme.colors.text, theme.colors.page, 0.05), id);
    assert.equal(colors.voice, theme.colors.subdoc, `${id}: the sub-document colour is the panel's voice`);
    assert.equal(colors.here, theme.colors.accent, `${id}: gold is where you are`);
    assert.equal(colors.next, theme.colors.link, id);
    assert.ok(contrast(colors.onNext, colors.next) >= 3, `${id}: Up next's title on its card`);
    assert.ok(contrast(colors.ink, colors.panel) >= 7, `${id}: a row on the panel`);
    assert.ok(contrast(colors.voice, colors.panel) >= 3, `${id}: a sub-document row on the panel`);
  }
});

test("the panels' words are in the App Language", () => {
  assert.equal(readerPanelText('en').contents, 'Contents');
  assert.equal(readerPanelText('fr').verses, 'Versets');
  assert.equal(readerPanelText('ar').upNext, 'التالي');
  assert.equal(readerPanelText('xx').findSection, 'Find a section');
  for (const language of ['en', 'fr', 'ar']) {
    for (const [key, value] of Object.entries(readerPanelText(language))) assert.ok(value, `${language}.${key}`);
  }
});

test('the Verses panel names the chapter and the count, and colours each highlighted verse once', () => {
  assert.deepEqual(chapterPosition(1, 50, false, 'en'), { name: 'Chapter 1', count: 'of 50' });
  assert.deepEqual(chapterPosition(23, 151, true, 'en'), { name: 'Psalm 23', count: 'of 151' });
  assert.deepEqual(chapterPosition(3, 50, false, 'fr'), { name: 'Chapitre 3', count: 'sur 50' });
  assert.deepEqual(chapterPosition(23, 151, true, 'fr'), { name: 'Psaume 23', count: 'sur 151' });
  assert.deepEqual(chapterPosition(12, 50, false, 'ar'), { name: 'الإصحاح ١٢', count: 'من ٥٠' });
  assert.deepEqual(chapterPosition(23, 151, true, 'ar'), { name: 'المزمور ٢٣', count: 'من ١٥١' });
  assert.deepEqual(chapterPosition(1, 0, false, 'en'), { name: 'Chapter 1', count: '' }, 'a count not yet known');

  const colors = highlightColorsByVerse([
    { verseId: '1:1', color: 'gold' },
    { verseId: '1:3', color: 'green' },
    { verseId: '1:1', color: 'blue' },
  ]);
  assert.deepEqual([...colors], [['1:1', 'gold'], ['1:3', 'green']]);
  assert.equal(highlightColorsByVerse([]).size, 0);
});

test('the two lists open on the shared sheet, and keep their search, Up next and highlight wiring', () => {
  const read = (file) => fs.readFileSync(file, 'utf8');
  const contents = read('src/components/vine/ui/ContentSelectorDrawer.tsx');
  assert.match(contents, /const upNextIds = useMemo\(\(\) => trailingHyperlinkIds\(listable\), \[listable\]\);/);
  assert.match(contents, /rowMatchesSearch\(sectionRowParts\(section\), query\)/);
  assert.match(contents, /accessibilityLabel=\{text\.findSection\}/);
  assert.match(contents, /accessibilityRole="switch"/);
  const verses = read('src/components/vine/ui/BibleVersePanel.tsx');
  assert.match(verses, /backgroundColor: highlightWash\(highlight\)/, "a highlighted verse's number sits on its highlight");
  const chapter = read('src/app/bible/[bookKey]/[chapter].tsx');
  assert.match(chapter, /highlights=\{bibleHighlights\.highlights\}/);
  assert.doesNotMatch(chapter, /<Modal\b/, 'the chapter screen keeps no panel of its own');
});

test('the sheet opens from off the right edge every time, whatever size its first frame is laid out at', () => {
  const sheet = fs.readFileSync('src/components/vine/ui/ReaderPanel.tsx', 'utf8');
  // It stays up until it has slid away, so the next opening starts from closed.
  assert.match(sheet, /visible=\{mounted\}/);
  assert.match(sheet, /if \(finished && !visible\) setMounted\(false\);/);
  // Its row is never narrower than the window, so the panel is never drawn
  // against the right edge of a first frame laid out portrait-wide.
  assert.match(sheet, /<View style=\{\[styles\.overlay, \{ minWidth: width \}\]\}>/);
});

test('the sermon notes drawer opens from off the right edge every time, as the sheet does', () => {
  const drawer = fs.readFileSync('src/components/vine/ui/SermonPlannerDrawer.tsx', 'utf8');
  assert.match(drawer, /useState\(\(\) => new Animated\.Value\(1\)\)/);
  assert.match(drawer, /visible=\{mounted\}/);
  assert.match(drawer, /if \(finished && !visible\) setMounted\(false\);/);
  assert.match(drawer, /style=\{\[styles\.overlay, \{ minWidth: screenWidth \}\]\}/);
});

test('the Contents fold St Basil\'s seven short litanies under their heading, through the Litany of the Oblations', () => {
  const { gatherUnderDividers, isDividerSection } = load('src/utils/sectionDividers.ts');
  const section = (id, hymnKey, titled = true) => ({ id, hymnKey, titled });
  const speaks = (entry) => entry.titled;
  const basil = [
    section('epiclesisStBasil-61', 'epiclesisStBasil'),
    section('sevenShortLitanies-62', 'sevenShortLitanies'),
    section('litanyOfPeaceStBasil-63', 'litanyOfPeaceStBasil'),
    section('litanyOfTheFathersStBasil-64', 'litanyOfTheFathersStBasil'),
    section('litanyOfTheSeasonOfAir-71', 'litanyOfTheSeasonOfAir'),
    section('combinedLitanyForTheThreeSeasons-72', 'combinedLitanyForTheThreeSeasons'),
    section('litanyOfTheOblationsStBasil-73', 'litanyOfTheOblationsStBasil'),
    // What the last litany splices in, and where it resumes, are still part of it.
    section('litanyOfTheOblationsStBasil-73-inline-x', 'x'),
    section('litanyOfTheOblationsStBasil-73-cont1', 'litanyOfTheOblationsStBasil', false),
    section('commemorationOfTheSaintsStBasil-74', 'commemorationOfTheSaintsStBasil'),
  ];
  assert.ok(isDividerSection(basil[1]));
  const owners = gatherUnderDividers(basil, speaks);
  assert.deepEqual([...owners.keys()], basil.slice(2, 9).map((entry) => entry.id));
  assert.ok([...owners.values()].every((owner) => owner === 'sevenShortLitanies-62'));

  // Without its last litany it holds nothing, rather than the rest of the service.
  assert.equal(gatherUnderDividers(basil.filter((entry) => !entry.hymnKey.startsWith('litanyOfTheOblations')), speaks).size, 0);
});

test('the Contents still fold the Agpeya hours by their openings', () => {
  const { gatherUnderDividers, isDividerSection } = load('src/utils/sectionDividers.ts');
  const section = (id, titled = true) => ({ id, hymnKey: id, titled });
  const lamb = [
    section('introductionThirdHour'),
    section('agpeyaPsalm19'),
    section('introductionSixthHour'),
    section('agpeyaPsalm53'),
    section('introductionToTheCreed', false),
    section('theOrthodoxCreed'),
  ];
  const owners = gatherUnderDividers(lamb, (entry) => entry.titled);
  assert.deepEqual(Object.fromEntries(owners), { agpeyaPsalm19: 'introductionThirdHour', agpeyaPsalm53: 'introductionSixthHour' });
  // Untitled, as in the Agpeya's own book, an opening gathers nothing.
  assert.equal(gatherUnderDividers(lamb, () => false).size, 0);
  assert.ok(!isDividerSection({ id: 'x', hymnKey: 'introductionOfEveryHour' }));
  assert.ok(!isDividerSection({ id: 'x', hymnKey: 'introductionToTheCreed' }));
});

test('a Contents heading is set as the book pages set a section, its hymns on one card under it', () => {
  const drawer = fs.readFileSync('src/components/vine/ui/ContentSelectorDrawer.tsx', 'utf8');
  // The title face beside the vine, then how many it hides once folded and the fold's chevron.
  assert.match(drawer, /styles\.headingTitle,[\s\S]*?<VineRule height=\{layout\.compact \? 13 : 15\} \/>[\s\S]*?isFolded \? <Text style=\{styles\.headingCount\}>\{gatheredCounts\.get\(section\.id\)\}<\/Text>/);
  // One card for each run under a heading, flat while searching; no rail beside each row.
  assert.match(drawer, /groupUnderHeadings\(visibleListable, \(section\) => \(searching \|\| upNextIds\.has\(section\.id\) \? undefined : dividerOwners\.get\(section\.id\)\)\)/);
  assert.match(drawer, /<View key=\{`group-\$\{entry\.headingId\}`\} style=\{styles\.group\} onLayout=\{recordGroupLayout\(entry\.headingId\)\}>/);
  assert.doesNotMatch(drawer, /nestedSegment|borderLeftWidth/);
  // A row on a card is placed by the card's y plus its own.
  assert.match(drawer, /scrollTo\(\{ y: Math\.max\(groupY \+ y - 12, 0\), animated: false \}\)/);
});
