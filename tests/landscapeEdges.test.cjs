const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const read = (file) => fs.readFileSync(file, 'utf8');

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.tsx$/.test(entry.name) ? [full] : [];
  });
}

test('each tab page builds its layout afresh when the device turns, rather than restyling it', () => {
  // Restyled in place, iOS kept the old column's flex sizing on the reused
  // views: the Books day block collapsed to a sliver and its tiles ran off the screen.
  const pages = ['src/app/books/index.tsx', 'src/app/music/index.tsx', 'src/app/learn/index.tsx', 'src/app/account.tsx', 'src/app/learn/library.tsx', 'src/app/music/library.tsx'];
  for (const page of pages) assert.match(read(page), /<NowPlayingAwareScrollView\n(\s+\/\/.*\n)*\s+key=\{layout\}/, page);
  for (const page of ['src/app/music/artist/[id].tsx', 'src/app/learn/cantor/[id].tsx']) assert.match(read(page), /<NowPlayingAwareScrollView key=\{layout\}/, page);
  // Home's one column, two over two (an upright iPad) and three (an iPad on its side) are keyed apart too;
  // a phone on its side has a page of its own, its seal and Pray now beside the scrolling cards.
  const home = read('src/components/vine/screens/HomeScreen.tsx');
  assert.match(home, /<NowPlayingAwareScrollView\n(\s+\/\/.*\n)*\s+key=\{layout\}/);
  assert.match(home, /if \(layout === 'landscape'\) \{/);
  assert.match(read('src/components/vine/ui/BottomTabBar.tsx'), /key=\{tablet \? 'tablet' : isCompactLandscape \? 'sideways' : 'phone'\}/);
  // The seasons' frame and year bar, centred and narrowed on an iPad, are keyed apart too.
  const seasons = read('src/components/vine/screens/SeasonSelectorScreen.tsx');
  assert.match(seasons, /<View key=\{wide \? 'wide' : 'phone'\} style=\{\[styles\.frame, wide && styles\.frameWide\]\}>/);
  assert.match(seasons, /<View key=\{wide \? 'wide' : 'phone'\} style=\{\[\n\s+styles\.yearBar,/);
  // A phone on its side keeps the wide layouts designed for it.
  assert.doesNotMatch(read('src/utils/useLayoutMode.ts'), /useIsCompactLandscape/);
});

test('no page wraps its glow, green header or tab bar in a side-padded safe area', () => {
  // A SafeAreaView with left and right edges pads the whole page, glow and
  // all: on a phone on its side that left a black band beside the notch.
  const offenders = [...sourceFiles('src/app'), ...sourceFiles('src/components')].filter((file) => {
    const source = read(file);
    const sidePadded = /<SafeAreaView edges=\{\['left', 'right'/.test(source);
    const chrome = /<PageGlow|<HeroGlow|<AppHeader|<BottomTabBar|<PersonHero|<FloatingReaderControls/.test(source);
    return sidePadded && chrome && !/BleedPage/.test(source);
  });
  assert.deepEqual(offenders, []);
});

test('the chrome that spans the screen keeps its own contents clear of the notch', () => {
  assert.match(read('src/components/vine/ui/AppHeader.tsx'), /paddingLeft: SPACING\.md \+ insets\.left, paddingRight: SPACING\.md \+ insets\.right/);
  assert.match(read('src/components/vine/ui/BottomTabBar.tsx'), /paddingLeft: insets\.left, paddingRight: insets\.right/);
  const overlay = read('src/components/playback/GlobalNowPlayingOverlay.tsx');
  assert.match(overlay, /left: 12 \+ insets\.left,\n\s+right: 12 \+ insets\.right,/);
  assert.match(overlay, /right: 18 \+ insets\.right,/);
  // The artist's and cantor's glow reaches back out past the page's notch padding.
  assert.match(read('src/components/vine/ui/PersonHero.tsx'), /\{ left: -insets\.left, right: -insets\.right \}/);
  // The controls floating over a document keep clear of the notch: in by the
  // safe area on every side, beside the notch on a phone on its side.
  const floating = read('src/components/vine/ui/floatingControls.ts');
  assert.match(floating, /left: 14 \+ insets\.left, right: 14 \+ insets\.right/);
  assert.match(floating, /left: Math\.max\(insets\.left, 14\), right: Math\.max\(insets\.right, 14\)/);
  assert.match(floating, /left: 24 \+ insets\.left, right: 24 \+ insets\.right/);
  // The Bible chapter's float over its page from the top of the screen, outside the notch padding.
  const chapter = read('src/app/bible/[bookKey]/[chapter].tsx');
  assert.match(chapter, /<BleedPage\n\s+edges=\{\['bottom'\]\}[\s\S]*header=\{\([\s\S]*<FloatingReaderControls/);
  assert.doesNotMatch(chapter, /<SafeAreaView/);
});

test('the book pages run edge to edge with their content padded clear of the notch', () => {
  const page = read('src/components/vine/screens/BookPage.tsx');
  assert.match(page, /<SafeAreaView edges=\{\[\]\} style=\{styles\.safeArea\}>/);
  assert.match(page, /const sidePadding = useSidePadding\(wideLayout \? 36 : 0\);/);
  assert.match(page, /\n\s+sidePadding,\n\s+\]\}/);
  const bleed = read('src/components/vine/ui/BleedPage.tsx');
  assert.match(bleed, /\{background\}\n\s+\{header\}\n\s+<SafeAreaView edges=\{\['left', 'right', \.\.\.edges\]\}/);
});

test('the sheets are centred between the notch and the far edge, never by their own auto margins', () => {
  // React Native's layout gives an absolutely placed view's auto margins
  // nothing: the calendar and the Book Settings sat against the left edge, under
  // a phone's notch on its side, and off centre on the iPad.
  for (const file of ['src/components/vine/ui/SheetFrame.tsx', 'src/components/vine/ui/CalendarSheet.tsx']) {
    const source = read(file);
    assert.doesNotMatch(source, /marginHorizontal: 'auto'/, file);
    assert.match(source, /<View pointerEvents="box-none" style=\{\[styles\.sheetRow, \{ paddingLeft: insets\.left, paddingRight: insets\.right \}\]\}>/, file);
    assert.match(source, /sheetRow: \{ alignItems: 'center', bottom: 0, left: 0, position: 'absolute', right: 0 \}/, file);
    assert.match(source, /maxHeight: height - Math\.max\(insets\.top, 12\)/, file);
  }
  // The month and year picker keeps clear of every edge and shortens to fit a phone on its side.
  const panel = read('src/components/vine/ui/CalendarPanel.tsx');
  assert.match(panel, /paddingLeft: SPACING\.lg \+ insets\.left,\n\s+paddingRight: SPACING\.lg \+ insets\.right,/);
  assert.match(panel, /maxHeight: pickerListsHeight/);
});

test('the drawers run to the edge with their rows and buttons clear of the notch and the home indicator', () => {
  // The content list's Calendar and Settings buttons sat in the home indicator's strip, its rows under the notch.
  // Both lists now sit on the one sheet, which keeps its rows clear of the notch
  // (and of a phone's rounded corner when it lies on its side) and its footer
  // above the home indicator.
  const sheet = read('src/components/vine/ui/ReaderPanel.tsx');
  assert.match(sheet, /rightInset: insets\.right,/);
  assert.match(sheet, /const edge = layout\.compact \? Math\.max\(insets\.right, 24\) : insets\.right;/);
  assert.match(sheet, /paddingRight: edge,/);
  assert.match(sheet, /paddingBottom: \(layout\.compact \? 12 : 20\) \+ insets\.bottom/);
  assert.match(sheet, /<View style=\{\{ height: insets\.bottom \}\} \/>/);
  for (const file of ['src/components/vine/ui/ContentSelectorDrawer.tsx', 'src/components/vine/ui/BibleVersePanel.tsx']) {
    assert.match(read(file), /<ReaderPanel\b/, file);
  }
  const sermon = read('src/components/vine/ui/SermonPlannerDrawer.tsx');
  assert.match(sermon, /<View style=\{\[styles\.header, \{ paddingRight: SPACING\.md \+ insets\.right \}\]\}>/);
  assert.match(sermon, /paddingRight: SPACING\.xl \+ insets\.right, paddingBottom: Math\.max\(insets\.bottom, SPACING\.sm\)/);
  // The document's date bar bleeds its strip as the pill bar does.
  const dateBar = read('src/components/vine/ui/DocumentDateBar.tsx');
  assert.match(dateBar, /marginLeft: -insets\.left,\n\s+marginRight: -insets\.right,\n\s+paddingLeft: SPACING\.md \+ insets\.left,\n\s+paddingRight: SPACING\.md \+ insets\.right,/);
  // The tab bar's colour runs under the home indicator; its tabs stop at its
  // edge, on the iPad as on a phone, with no padding of their own stacked on it.
  const tabBar = read('src/components/vine/ui/BottomTabBar.tsx');
  assert.match(tabBar, /const aboveHomeIndicator = insets\.bottom > 0;/);
  assert.match(tabBar, /paddingBottom: tablet && !aboveHomeIndicator \? 6 : insets\.bottom,/);
  assert.doesNotMatch(tabBar, /insets\.bottom \+ 14/);
});

test('every full-screen modal draws to the edges on Android as on iOS, and pads itself', () => {
  // An Android Modal is otherwise a dialog that keeps clear of the bars and
  // the notch: the subdocument's page stopped short of the notch's strip.
  const files = [
    'src/components/vine/screens/DocumentModal.tsx',
    'src/components/vine/ui/ReaderPanel.tsx',
    'src/components/vine/ui/SermonPlannerDrawer.tsx',
    'src/components/vine/ui/SaintHymnPicker.tsx',
    'src/components/vine/ui/SheetFrame.tsx',
    'src/components/vine/ui/CalendarSheet.tsx',
    'src/components/vine/ui/CalendarPanel.tsx',
    'src/components/playback/ActionSheetFrame.tsx',
  ];
  for (const file of files) {
    const source = read(file);
    // The opening tag, reading past any arrow function among its props.
    const modals = source.match(/<Modal\b(?:=>|[^>])*>/g) || [];
    assert.ok(modals.length > 0, file);
    for (const modal of modals) assert.match(modal, /statusBarTranslucent[\s\S]*navigationBarTranslucent/, `${file}: ${modal.slice(0, 60)}`);
  }
});

test('headers and buttons keep below the status bar; tiles share the width inside the notch', () => {
  const pages = ['learn/album/[id]', 'learn/hymn/[id]', 'learn/lesson/[id]', 'learn/lesson-set/[id]', 'learn/playlist/[id]', 'learn/season/[id]', 'music/playlist/[id]', 'music/release/[id]'];
  for (const page of pages) assert.match(read(`src/app/${page}.tsx`), /<SafeAreaView edges=\{\['top', 'left', 'right'\]\} style=\{styles\.safeArea\}>/, page);
  // The design's sub-pages run their glow and tab bar to the edges; their round Back keeps below the status bar.
  for (const page of ['learn/cantors', 'learn/seasons', 'bookmarks', 'synaxarium/index', 'canon/index']) {
    const source = read(`src/app/${page}.tsx`);
    assert.match(source, /<BleedPage background=\{<PageGlow kind="green"[^>]*\/>\} footer=\{<BottomTabBar active="\w+" \/>\}>/, page);
    assert.match(source, /<SubPageHeader\b/, page);
  }
  assert.match(read('src/components/vine/ui/SubPageHeader.tsx'), /\{ paddingTop: insets\.top \+ 6 \}/);
  for (const page of ['music/artist/[id]', 'learn/cantor/[id]']) {
    assert.match(read(`src/app/${page}.tsx`), /styles\.pending, \{ paddingTop: 12 \+ insets\.top,/, page);
  }
  for (const page of ['music/index', 'music/artist/[id]', 'learn/cantor/[id]', 'learn/index']) {
    assert.match(read(`src/app/${page}.tsx`), /const available = width - [^;]+ - insets\.left - insets\.right;/, page);
  }
  // The notice (a page not found, a crash) scrolls rather than push its buttons under the home indicator.
  const notice = read('src/components/vine/ui/NoticeScreen.tsx');
  assert.match(notice, /<ScrollView/);
  assert.match(notice, /paddingLeft: 24 \+ insets\.left,\n\s+paddingRight: 24 \+ insets\.right,/);
  // The Bible chapter's loading splash starts at the top of its page, its
  // floating controls over it, so Back can still be reached.
  assert.match(read('src/app/bible/[bookKey]/[chapter].tsx'), /<LoadingScreen belowHeader \/>/);
  // A light page runs up under the status bar, whose clock and battery turn
  // dark over it -- a status bar of the document's own, mounted only while it
  // shows. A phone on its side hides it, the Bible's controls beside the notch.
  const statusBar = read('src/components/vine/ui/DocumentStatusBar.tsx');
  assert.match(statusBar, /if \(!focused\) return null;\n\s+if \(hidden\) return <StatusBar hidden \/>;\n\s+return !theme\.dark \? <StatusBar style="dark" \/> : null;/);
  assert.match(read('src/components/vine/screens/ServiceDocument.tsx'), /<DocumentStatusBar theme=\{documentTheme\} \/>/);
  assert.match(read('src/app/bible/[bookKey]/[chapter].tsx'), /<DocumentStatusBar theme=\{theme\} hidden=\{floatingLayout\.hideStatusBar\} \/>/);
  // The seasons' year bar, across a phone, keeps clear of its notch.
  assert.match(read('src/components/vine/screens/SeasonSelectorScreen.tsx'), /wide \? styles\.yearBarWide : \{ left: 16 \+ insets\.left, right: 16 \+ insets\.right \}/);
});
