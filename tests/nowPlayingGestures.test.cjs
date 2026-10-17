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
  assert.match(modal, /<GlobalNowPlayingOverlay\n\s+documentTheme=\{documentTheme\}\n\s+onButtonTouchStart=\{\(\) => \{\n\s+touchOnPillBarRef\.current = true;/);
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
