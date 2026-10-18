const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('the mini player shows on Home and Account whenever something plays', () => {
  const overlay = fs.readFileSync('src/components/playback/GlobalNowPlayingOverlay.tsx', 'utf8');
  const excluded = overlay.slice(overlay.indexOf('const EXCLUDED_PATHS'), overlay.indexOf(']);', overlay.indexOf('const EXCLUDED_PATHS')));
  assert.doesNotMatch(excluded, /'\/account'/);
  // Home is not a book page, where Book Settings' "Display Now Playing Bar" decides.
  const books = overlay.slice(overlay.indexOf('const BOOK_PATH_PREFIXES'), overlay.indexOf('];', overlay.indexOf('const BOOK_PATH_PREFIXES')));
  assert.doesNotMatch(books, /^\s*'\/',$/m);
  assert.match(books, /'\/bible',/);
});

test('swiped sideways, the mini player skips: left to the next track, right to the one before', () => {
  const card = fs.readFileSync('src/components/playback/MiniPlayerCard.tsx', 'utf8');
  assert.match(card, /const across = \(gesture: \{ dx: number; dy: number \}\) => Math\.abs\(gesture\.dx\) > 12 && Math\.abs\(gesture\.dx\) > Math\.abs\(gesture\.dy\) \* 1\.5;/);
  assert.match(card, /if \(across\(gesture\)\) \{ axis\.current = 'across'; return true; \}/);
  assert.match(card, /const forward = gesture\.dx < -SKIP_DISTANCE \|\| gesture\.vx < -0\.6;/);
  assert.match(card, /if \(forward\) next\(\);\n\s+else previous\?\.\(\);/);
  assert.match(card, /<Animated\.View style=\{\[styles\.card, swipeStyle\]\} \{\.\.\.swipe\.panHandlers\}>/);
  const overlay = fs.readFileSync('src/components/playback/GlobalNowPlayingOverlay.tsx', 'utf8');
  assert.match(overlay, /const onPrevious = isMusic \? music\.previous : learning\.previous;/);
  assert.match(overlay, /onPrevious=\{onPrevious\}/);
});

test('pulled down, the mini player hides as its Hide button does; a short pull springs back', () => {
  const card = fs.readFileSync('src/components/playback/MiniPlayerCard.tsx', 'utf8');
  assert.match(card, /const HIDE_DISTANCE = 36;/);
  assert.match(card, /const down = \(gesture: \{ dx: number; dy: number \}\) => Boolean\(skip\.current\.hide\) && gesture\.dy > 10 && gesture\.dy > Math\.abs\(gesture\.dx\) \* 1\.2;/);
  assert.match(card, /if \(!hide \|\| \(gesture\.dy < HIDE_DISTANCE && gesture\.vy < 0\.5\)\) \{ settle\(\); return; \}/);
  assert.match(card, /hide\(\);\n\s+drop\.setValue\(0\);/);
  assert.match(card, /transform: \[\{ translateX: offset \}, \{ translateY: drop \}\]/);
  const overlay = fs.readFileSync('src/components/playback/GlobalNowPlayingOverlay.tsx', 'utf8');
  assert.match(overlay, /onHide=\{\(\) => setIsCollapsed\(true\)\}/);
});

test('the hidden bar\'s button drags to either bottom corner and stays there', () => {
  const overlay = fs.readFileSync('src/components/playback/GlobalNowPlayingOverlay.tsx', 'utf8');
  // A tap still shows the bar; only a sideways drag is taken from the button.
  assert.match(overlay, /onMoveShouldSetPanResponderCapture: \(_, gesture\) => Math\.abs\(gesture\.dx\) > DRAG_SLOP && Math\.abs\(gesture\.dx\) > Math\.abs\(gesture\.dy\)/);
  assert.match(overlay, /: \(at < travel \/ 2 \? 'left' : 'right'\);/);
  assert.match(overlay, /else setNowPlayingButtonSide\(next\);/);
  assert.match(overlay, /translateX: Animated\.add\(sideOffset, dragOffset\)/);
  // A screen reader moves it with an action instead.
  assert.match(overlay, /if \(event\.nativeEvent\.actionName === 'move'\) setNowPlayingButtonSide\(otherSide\);/);
  // A device choice, kept with the other preferences; anything unknown is the right corner.
  const storage = fs.readFileSync('src/utils/preferencesStorage.ts', 'utf8');
  assert.match(storage, /nowPlayingButtonSide: 'right',/);
  assert.match(storage, /merged\.nowPlayingButtonSide = stored\?\.nowPlayingButtonSide === 'left' \? 'left' : 'right';/);
  // In a subdocument the button is a dead zone for the edge swipes, as the pill bar is.
  const modal = fs.readFileSync('src/components/vine/screens/DocumentModal.tsx', 'utf8');
  // (It covers the subdocument, so it takes `covering` as well.)
  assert.match(modal, /<GlobalNowPlayingOverlay\n\s+documentTheme=\{documentTheme\}\n\s+covering\n\s+onButtonTouchStart=\{\(\) => \{\n\s+touchOnPillBarRef\.current = true;/);
});

test('over Walnut, Vine and Sepia the button wears the page\'s own button colour; Night and Paper keep the gold', () => {
  const overlay = fs.readFileSync('src/components/playback/GlobalNowPlayingOverlay.tsx', 'utf8');
  assert.match(overlay, /const documentTheme = ownDocumentTheme \?\? focusedDocumentTheme;/);
  assert.match(overlay, /const colouredPage = documentTheme && documentTheme\.id !== 'night' && documentTheme\.id !== 'paper' \? documentTheme : null;/);
  assert.match(overlay, /const buttonColor = colouredPage \? colouredPage\.colors\.subdoc : COLORS\.gold;/);
  assert.match(overlay, /const buttonIconColor = colouredPage \? colouredPage\.colors\.onAccent : COLORS\.white;/);
  // The services and the Bible's chapters say which page they are read on while they show.
  assert.match(fs.readFileSync('src/components/vine/screens/ServiceDocument.tsx', 'utf8'), /useReportDocumentTheme\(documentTheme\);/);
  assert.match(fs.readFileSync('src/app/bible/[bookKey]/[chapter].tsx', 'utf8'), /useReportDocumentTheme\(theme\);/);
  const chrome = fs.readFileSync('src/context/BottomChromeContext.tsx', 'utf8');
  assert.match(chrome, /useFocusEffect\(useCallback\(\(\) => \{\n\s+reportDocumentTheme\(id, theme\);\n\s+return \(\) => reportDocumentTheme\(id, null\);/);
});

test('a tab\'s own page is never swiped or backed away to the tab visited before it', () => {
  // A book page shows the tab bar and sits over Books: a tab chosen there
  // replaced the book page, and iOS's edge swipe uncovered Books beneath it.
  const layout = fs.readFileSync('src/app/_layout.tsx', 'utf8');
  assert.match(layout, /const TAB_PAGE = \{ animation: 'none', gestureEnabled: false \} as const;/);
  for (const name of ['index', 'books', 'music', 'learn', 'account']) {
    assert.match(layout, new RegExp(`<Stack\\.Screen name="${name}" options=\\{TAB_PAGE\\} />`), name);
  }
  // Android's back on one leaves the app, after anything open over the page has had it.
  assert.match(layout, /const TAB_PATHS = new Set\(\['\/', '\/books', '\/music', '\/learn', '\/account'\]\);/);
  assert.match(layout, /if \(!TAB_PATHS\.has\(pathnameRef\.current\)\) return false;\n\s+BackHandler\.exitApp\(\);/);
  const overlay = fs.readFileSync('src/components/playback/GlobalNowPlayingOverlay.tsx', 'utf8');
  assert.match(overlay, /if \(!isPopupOpen \|\| !allowDisplay\) return undefined;\n\s+const subscription = BackHandler\.addEventListener\('hardwareBackPress', \(\) => \{\n\s+setIsPopupOpen\(false\);/);
});

test('the Books day block turns its week like a page, the card standing still', () => {
  const block = fs.readFileSync('src/components/vine/ui/DayBlock.tsx', 'utf8');
  // Nothing moves the card; the weeks lie side by side in a lane of their own.
  assert.doesNotMatch(block, /gesture\.dx \/ 4/);
  assert.match(block, /<View \{\.\.\.weekSwipe\.panHandlers\}>/);
  assert.match(block, /const weekStarts = \[shiftIso\(weekStart, -7\), weekStart, shiftIso\(weekStart, 7\)\];/);
  assert.match(block, /lane: \{ overflow: 'hidden' \},/);
  assert.match(block, /place = Animated\.multiply\(Animated\.add\(motion\.position, offset\), motion\.width\);/);
  // They follow the finger; far or quick enough, the next comes the rest of the way in, else they spring back.
  assert.match(block, /motion\.position\.setValue\(swipe\.dragFrom \+ gesture\.dx \/ \(swipe\.width \|\| 320\)\);/);
  assert.match(block, /if \(!flicked && Math\.abs\(gesture\.dx\) < width \/ 4\) \{\n\s+settle\(\);/);
  assert.match(block, /const target = swipe\.dragFrom \+ \(towardsLater \? -1 : 1\);/);
  // The neighbouring week is already drawn, pill and all, so the date changes as it moves, not after.
  assert.match(block, /const selectedIso = shiftIso\(day\.isoDate, 7 \* weeksBetween\(weekStart, start\)\);/);
  assert.match(block, /\/\/ The week is already drawn, so the date changes as it moves rather than after\.\n\s+swipe\.selectDate\(date\);/);
});

test('pulled down, the full-screen player goes away -- taken before its buttons can take the touch', () => {
  const hook = fs.readFileSync('src/components/playback/usePullDownToClose.ts', 'utf8');
  assert.match(hook, /onMoveShouldSetPanResponderCapture: \(_, gesture\) => gesture\.dy > 8 && Math\.abs\(gesture\.dy\) > Math\.abs\(gesture\.dx\) \* 1\.5/);
  const learning = fs.readFileSync('src/components/learning/LearningNowPlayingScreen.tsx', 'utf8');
  assert.match(learning, /const pullDown = usePullDownToClose\(closePlayer\);/);
  assert.match(learning, /translateY: pullDown\.drag/);
  const music = fs.readFileSync('src/components/music/MusicNowPlayingScreen.tsx', 'utf8');
  assert.match(music, /onMoveShouldSetPanResponderCapture: \(_event, gesture: PanResponderGestureState\) => \(\n\s+gesture\.dy > 8/);
  // On the iPad the pull is taken on the header and the player, not the scrolling lyrics and queue.
  assert.match(music, /\{wide \? <View \{\.\.\.dismissResponder\.panHandlers\}>\{header\}<\/View> : header\}/);
  assert.match(learning, /<View style=\{styles\.playerColumn\} \{\.\.\.pullDown\.panHandlers\}>/);
});
