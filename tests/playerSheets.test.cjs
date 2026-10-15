const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function loadTypeScriptModule(path) {
  const javascript = ts.transpileModule(read(path), {
    compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const moduleObject = { exports: {} };
  new Function('exports', 'require', 'module', javascript)(moduleObject.exports, require, moduleObject);
  return moduleObject.exports;
}

const MENU = 'src/components/music/MusicTrackActionsMenu.tsx';

test('the More menu offers the design\'s rows in its order, queueing only what is not playing', () => {
  const menu = read(MENU);
  // Add to playlist, Download, Share, Go to album, Go to artists.
  const order = [
    "icon=\"add-circle-outline\"",
    "Platform.OS !== 'web'",
    "icon=\"share-outline\"",
    "icon=\"disc-outline\"",
    "icon=\"people-outline\"",
  ].map((marker) => {
    const at = menu.indexOf(marker);
    assert.notEqual(at, -1, marker);
    return at;
  });
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.match(menu, /tr\('Go to album', /);
  assert.match(menu, /tr\('Go to artists', /);
  assert.match(menu, /tr\('Go to artist', /);
  // Add next and Add to end of queue stay, except for the track already playing.
  assert.match(menu, /const playingNow = currentItem\?\.track\.id === item\.track\.id;/);
  assert.match(menu, /\{!playingNow \? \([\s\S]*addTrackNext[\s\S]*addTrackToEnd[\s\S]*\) : null\}/);
  assert.match(menu, /addNext\(item\)/);
  assert.match(menu, /addToEnd\(item\)/);
});

test('Go to album and Go to artists open the release and artist pages, putting the player away first', () => {
  const menu = read(MENU);
  assert.match(menu, /const releaseId = item\.releaseId \?\? item\.track\.releaseId \?\? null;/);
  assert.match(menu, /const releasePath = releaseId \? `\/music\/release\/\$\{releaseId\}` : null;/);
  assert.match(menu, /onPress=\{\(\) => leaveFor\(releasePath as Href\)\}/);
  // One artist opens straight away; several are offered in the same sheet.
  assert.match(menu, /if \(artists\.length === 1\) leaveFor\(`\/music\/artist\/\$\{artists\[0\]\.id\}`\);\s*else setPage\('artists'\);/);
  assert.match(menu, /onPress=\{\(\) => leaveFor\(`\/music\/artist\/\$\{artist\.id\}`\)\}/);
  // The sheet closes and the player is told before the page changes under it.
  assert.match(menu, /const leaveFor = \(href: Href\) => \{\s*close\(\);\s*onNavigate\?\.\(\);\s*if \(href !== pathname\) router\.push\(href\);/);
  assert.match(menu, /onNavigate\?: \(\) => void;/);
  // Not on a row of the album's own page, where it would lead nowhere.
  assert.match(menu, /releasePath && \(pathname !== releasePath \|\| onNavigate\)/);
});

test('a track\'s artists are its performers, each once, in credit order', () => {
  const { musicTrackArtists } = loadTypeScriptModule('src/utils/musicCredits.ts');
  const artist = (id, role, sortOrder) => ({ id, displayName: `Artist ${id}`, role, sortOrder });
  assert.deepEqual(
    musicTrackArtists({ artists: [artist('c', 'featured', 2), artist('x', 'composer', 0), artist('a', 'primary', 0), artist('c', 'featured', 3), artist('b', 'featured', 1)] }).map((entry) => entry.id),
    ['a', 'b', 'c'],
  );
  // With no performer credited, whoever is credited — and only those with a page.
  assert.deepEqual(
    musicTrackArtists({ artists: [artist('y', 'lyricist', 1), artist('', 'composer', 0), artist('x', 'composer', 2), artist('y', 'arranger', 3)] }).map((entry) => entry.id),
    ['y', 'x'],
  );
  assert.deepEqual(musicTrackArtists({ artists: [] }), []);
});

test('Add to playlist opens in the sheet it was chosen from, for Music and Learn alike', () => {
  const music = read(MENU);
  assert.match(music, /<MusicPlaylistPanel\s+trackId=\{item\.track\.id\}/);
  assert.match(music, /rows=\{page !== 'playlists'\}/);
  assert.match(music, /onPress=\{\(\) => setPage\('playlists'\)\}/);
  const learning = read('src/components/learning/LearningItemActionsMenu.tsx');
  assert.match(learning, /<LearningPlaylistPanel/);
  assert.match(learning, /onPress=\{\(\) => setChoosingPlaylist\(true\)\}/);
  // Tapping a ticked playlist takes the item back out of it.
  const musicPicker = read('src/components/music/MusicPlaylistPicker.tsx');
  assert.match(musicPicker, /if \(holds\) await musicService\.removeFromPlaylist\(playlist\.id, trackId\);\s*else await musicService\.addToPlaylist\(playlist\.id, trackId\);/);
  const learningPicker = read('src/components/learning/LearningPlaylistPicker.tsx');
  assert.match(learningPicker, /learningService\.removePlaylistItem\(playlist\.id, entry\)/);
  assert.match(learningPicker, /learningService\.setItemProgress\(itemKind, itemId, state\)/);
});

test('the sheets over the player: a sheet, a side panel or a dialog, closed by drag, dimming, back and Escape', () => {
  const frame = read('src/components/playback/ActionSheetFrame.tsx');
  assert.match(frame, /const mode: ActionSheetMode = landscapePhone \? 'side' : layout === 'phone' \? 'sheet' : 'dialog';/);
  assert.match(frame, /useSheetDragToClose\(visible, drag, onClose\)/);
  assert.match(frame, /\{\.\.\.sheetDrag\.grabHandlers\}/);
  assert.match(frame, /\{\.\.\.swipeResponder\.panHandlers\}/);
  assert.match(frame, /onRequestClose=\{onClose\}/);
  assert.match(frame, /accessibilityLabel=\{closeLabel\} onPress=\{onClose\}/);
  assert.match(frame, /useReducedMotion\(\)/);
  assert.match(frame, /motionDuration\(visible \? 260 : 200, reduced\)/);
  // The side panel keeps clear of the notch.
  assert.match(frame, /const trailing = Math\.max\(insets\.right, SIDE_LEADING\);/);
  for (const file of [
    'src/components/playback/ActionsSheet.tsx',
    'src/components/music/MusicPlaylistPicker.tsx',
    'src/components/learning/LearningPlaylistPicker.tsx',
  ]) {
    assert.match(read(file), /ActionSheetFrame/, file);
  }
});
