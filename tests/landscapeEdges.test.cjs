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
  // Home's two columns (a phone on its side) and three (an iPad) are keyed apart too.
  assert.match(read('src/components/vine/screens/HomeScreen.tsx'), /\s+key=\{`\$\{layout\}-\$\{twoColumns\}`\}/);
  assert.match(read('src/components/vine/ui/BottomTabBar.tsx'), /key=\{tablet \? 'tablet' : isCompactLandscape \? 'sideways' : 'phone'\}/);
  // A phone on its side keeps the wide layouts designed for it.
  assert.doesNotMatch(read('src/utils/useLayoutMode.ts'), /useIsCompactLandscape/);
});

test('no page wraps its glow, green header or tab bar in a side-padded safe area', () => {
  // A SafeAreaView with left and right edges pads the whole page, glow and
  // all: on a phone on its side that left a black band beside the notch.
  const offenders = [...sourceFiles('src/app'), ...sourceFiles('src/components')].filter((file) => {
    const source = read(file);
    const sidePadded = /<SafeAreaView edges=\{\['left', 'right'/.test(source);
    const chrome = /<PageGlow|<HeroGlow|<AppHeader|<BottomTabBar|<PersonHero/.test(source);
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
});

test('the book pages run edge to edge with their content padded clear of the notch', () => {
  const page = read('src/components/vine/screens/BookPage.tsx');
  assert.match(page, /<SafeAreaView edges=\{\[\]\} style=\{styles\.safeArea\}>/);
  assert.match(page, /const sidePadding = useSidePadding\(wideLayout \? 36 : 0\);/);
  assert.match(page, /\n\s+sidePadding,\n\s+\]\}/);
  const bleed = read('src/components/vine/ui/BleedPage.tsx');
  assert.match(bleed, /\{background\}\n\s+\{header\}\n\s+<SafeAreaView edges=\{\['left', 'right', \.\.\.edges\]\}/);
});
