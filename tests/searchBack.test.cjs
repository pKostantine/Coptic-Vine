const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

/** Every route file under src/app called search.tsx. */
function searchRoutes(dir = 'src/app') {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...searchRoutes(full));
    else if (entry.name === 'search.tsx') found.push(full);
  }
  return found.sort();
}

// A search page is somewhere you go to and come back from: each one shows a
// Back, whatever the layout, that takes the reader back where they were.
test('every search route is one of the pages checked here', () => {
  assert.deepEqual(searchRoutes(), [
    'src/app/bible/search.tsx',
    'src/app/learn/search.tsx',
    'src/app/music/search.tsx',
    'src/app/search.tsx',
  ]);
  // The old unified search only sends you on to Music's or Learn's.
  assert.match(read('src/app/search.tsx'), /<Redirect href=\{scope === 'learning' \? '\/learn\/search' : '\/music\/search'\}/);
  assert.match(read('src/app/music/search.tsx'), /<SectionSearchScreen section="music" \/>/);
  assert.match(read('src/app/learn/search.tsx'), /<SectionSearchScreen section="learning" \/>/);
});

test('the Bible search and the Synaxarium search head their pages with a Back', () => {
  for (const [file, fallback] of [['src/app/bible/search.tsx', '/bible'], ['src/app/synaxarium/index.tsx', '/']]) {
    const source = read(file);
    assert.match(source, /<AppHeader[\s\S]*?\bcanGoBack\b/, file);
    assert.match(source, new RegExp(`onBack=\\{\\(\\) => goBack\\(router, '${fallback.replace('/', '\\/')}'\\)\\}`), file);
  }
  // The header draws that Back on a phone, an iPad and the web alike, named in the App Language.
  for (const file of ['src/components/vine/ui/AppHeader.tsx', 'src/components/vine/ui/AppHeader.web.tsx']) {
    const source = read(file);
    assert.match(source, /\{canGoBack \? \(\s*<Pressable accessibilityRole="button" accessibilityLabel=\{(?:backLabel|tr\('Go back', 'Retour', 'رجوع'\))\}[^>]*onPress=\{onBack\}>\s*<Icon name="chevron-back"/, file);
  }
});

test('Music and Learn search show Back on the phone, the iPad and the desktop', () => {
  const source = read('src/components/search/SectionSearchScreen.tsx');
  const back = source.match(/const backButton = \(([\s\S]*?)\n {2}\);/);
  assert.ok(back, 'SectionSearchScreen defines its Back once');
  assert.match(back[1], /accessibilityLabel=\{tr\('Back', 'Retour', 'رجوع'\)\}/);
  assert.match(back[1], /onPress=\{goBackFromSearch\}/);
  assert.match(back[1], /<Icon name="chevron-back"/);

  // Both tops carry it, beside the field.
  const top = source.match(/\{wide \? \(([\s\S]*?)\) : \(([\s\S]*?)\)\}\n\n {6}<NowPlayingAwareScrollView/);
  assert.ok(top, 'the wide and phone tops are found');
  const [, wideTop, phoneTop] = top;
  assert.match(wideTop, /\{backButton\}\s*\{field\}/);
  assert.match(phoneTop, /\{backButton\}\s*\{field\}/);
});

test('Back from Music or Learn search returns to the section that opened it', () => {
  const source = read('src/components/search/SectionSearchScreen.tsx');
  assert.match(source, /useLocalSearchParams<\{ from\?: string \}>\(\)/);
  assert.match(source, /if \(from === 'library'\) router\.replace\(music \? '\/music\/library' : '\/learn\/library'\);/);
  assert.match(source, /else if \(from === 'home'\) router\.replace\(fallback\);/);
  assert.match(source, /else goBack\(router, fallback\);/);
  assert.match(source, /const fallback: '\/music' \| '\/learn' = music \? '\/music' : '\/learn';/);

  // The pills say where Search was opened from.
  for (const file of ['src/components/music/MusicSectionNav.tsx', 'src/components/learning/LearningSectionNav.tsx']) {
    assert.match(
      read(file),
      /router\.replace\(key === 'search' \? \{ pathname: ROUTES\.search, params: \{ from: active \} \} : ROUTES\[key\]\);/,
      file,
    );
  }
});
