const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const source = (file) => fs.readFileSync(`src/${file}`, 'utf8');

test('the playback clock is kept out of the player context, so pages that read the player are not drawn at each tick', () => {
  const playback = source('context/PlaybackContext.tsx');
  const valueStart = playback.indexOf('const value = useMemo<PlaybackContextValue>(() => ({');
  const value = playback.slice(valueStart, playback.indexOf('}), [', valueStart));
  assert.doesNotMatch(value, /currentTimeMs/);
  assert.match(playback, /clock\.publish\(\{ currentTimeMs, durationMs \}\);/);
  assert.match(playback, /useSyncExternalStore\(store\.subscribe, \(\) => select\(store\.get\(\)\)/);
  for (const file of ['context/MusicPlayerContext.tsx', 'context/LearningPlayerContext.tsx']) {
    assert.doesNotMatch(source(file), /currentTimeMs: currentItem \? playback\.currentTimeMs/, file);
  }
  // What shows the clock reads it itself: the seek bar, the bar's line, the lyric being sung.
  assert.match(source('components/music/SeekBar.tsx'), /const positionMs = usePlaybackClock\(\(clock\) => clock\.currentTimeMs\);/);
  assert.match(source('components/playback/MiniPlayerCard.tsx'), /function ProgressFill\(\{ color \}: \{ color: string \}\) \{\n\s+const progress = usePlaybackClock\(/);
  assert.match(source('components/music/MusicNowPlayingScreen.tsx'), /const activeLineId = usePlaybackClock\(\(\{ currentTimeMs \}\) => \{/);
});

test('the full player rises from the bar and goes back down into it', () => {
  const overlay = source('components/playback/GlobalNowPlayingOverlay.tsx');
  assert.match(overlay, /const fullPlayer = useOverlayTransition\(isPopupOpen && allowDisplay, \{ duration: 320 \}\);/);
  assert.match(overlay, /outputRange: \[windowHeight, 0\]/);
  // Drawn through its way down, over the bar it uncovers, and touched by nothing then.
  assert.match(overlay, /pointerEvents=\{isPopupOpen \? 'box-none' : 'none'\}/);
  assert.match(overlay, /\{playerScreen\}\n\s+<\/>/);
  // Opened again on its way down after a pull, a fresh player rises, not the one still pulled out of sight.
  assert.match(overlay, /<MusicNowPlayingScreen key=\{playerKey\}/);
  // A pulled player goes on down at the finger's speed and is never put back for a frame.
  const music = source('components/music/MusicNowPlayingScreen.tsx');
  assert.match(music, /\.start\(\(\) => dismiss\.current\.close\(\)\);/);
  assert.doesNotMatch(music, /dismissDrag\.setValue\(0\);\n\s+dismiss\.current\.close\(\);/);
  const pull = source('components/playback/usePullDownToClose.ts');
  assert.match(pull, /\.start\(\(\) => close\(\)\);/);
});

test('hidden or shown, the bar\'s card and round button cross-fade', () => {
  const overlay = source('components/playback/GlobalNowPlayingOverlay.tsx');
  assert.match(overlay, /if \(isCollapsed && !buttonMounted\) setButtonMounted\(true\);/);
  assert.match(overlay, /if \(!isCollapsed && !cardMounted\) setCardMounted\(true\);/);
  assert.match(overlay, /if \(isCollapsed\) setCardMounted\(false\);\n\s+else setButtonMounted\(false\);/);
  assert.match(overlay, /buttonOpacity: collapseAnimation\.interpolate\(\{ inputRange: \[0, 1\], outputRange: \[0, 0\.92\] \}\)/);
  assert.match(overlay, /\{cardMounted \? \(/);
});

test('a sheet closed after a pull goes down from where it was let go, not from fully open', () => {
  const sheet = source('components/playback/PlayerSheet.tsx');
  assert.match(sheet, /if \(visible\) drag\.setValue\(0\);/);
  for (const file of ['components/vine/ui/SheetFrame.tsx', 'components/vine/ui/CalendarSheet.tsx']) {
    const frame = source(file);
    assert.match(frame, /toValue: 1, duration: motionDuration\(260, reduced\), easing: Easing\.out\(Easing\.cubic\)/, file);
    assert.match(frame, /toValue: 0, duration: motionDuration\(200, reduced\), easing: Easing\.in\(Easing\.cubic\)/, file);
  }
});

test('the week strip carries on at the pace it was thrown', () => {
  const day = source('components/vine/ui/DayBlock.tsx');
  assert.match(day, /duration: releaseDuration\(remaining, gesture\.vx\),\n\s+easing: Easing\.out\(Easing\.quad\),/);
  const motion = source('utils/useReducedMotion.ts');
  assert.match(motion, /export function releaseDuration\(remaining: number, velocity: number\): number/);
});

test('a day picked in the month on screen leaves the calendar grid as it is', () => {
  const panel = source('components/vine/ui/CalendarPanel.tsx');
  assert.match(panel, /setShownMonth\(\(current\) => \(current && current\.mode === next\.mode && current\.year === next\.year\n\s+&& current\.month === next\.month && current\.copticName === next\.copticName \? current : next\)\);/);
});

test('a removed bookmark\'s place closes up before the row is let go', () => {
  const row = source('components/vine/ui/SwipeToRemove.tsx');
  assert.match(row, /Animated\.timing\(height, \{ toValue: 0, duration: 180, easing: Easing\.out\(Easing\.cubic\), useNativeDriver: false \}\)\.start\(\(\) => removeRow\(\)\);/);
  assert.match(row, /style=\{\[styles\.frame, style, closing && \{ height: closing \}\]\}/);
});

test('the contents panel stays where the reader scrolled it when a heading folds', () => {
  const drawer = source('components/vine/ui/ContentSelectorDrawer.tsx');
  assert.match(drawer, /if \(done && done\.id === highlightedSectionId && Date\.now\(\) - done\.at > SCROLL_SETTLE_MS\) return;/);
  assert.match(drawer, /if \(!visible \|\| searching\) scrolledFor\.current = null;/);
});

test('a reader drawn again with the same colours never rebuilds its document', () => {
  for (const file of ['components/vine/DocumentWebView.tsx', 'components/vine/DocumentWebView.web.tsx']) {
    const view = source(file);
    const memo = view.slice(view.indexOf('const html = useMemo('));
    const deps = memo.slice(memo.indexOf('\n      [\n'), memo.indexOf('\n      ],\n    );'));
    assert.ok(deps.includes('sections,'), file);
    assert.doesNotMatch(deps, /\binitialColors\b/, file);
    assert.match(deps, /initialVine,\s+initialLetter,/, file);
  }
  assert.match(source('components/vine/screens/ServiceDocument.tsx'), /const initialColors = useMemo\(\(\) => documentInitialColors\(documentTheme, ornamentSeason\), \[documentTheme, ornamentSeason\]\);/);
});

test('a rebuilt page opens where the reader was, before it is first drawn', () => {
  const html = source('components/vine/documentHtml.ts');
  assert.match(html, /if \(restore\.length && window\.scrollToSection\(restore\)\) enforceHeldJump\(\);/);
  for (const file of ['components/vine/DocumentWebView.tsx', 'components/vine/DocumentWebView.web.tsx']) {
    assert.match(source(file), /initialRestore: restoreCandidates\(\),/, file);
  }
});

test('the Now Playing bar\'s height is set on a Bible chapter without reloading it', () => {
  const chapter = source('app/bible/[bookKey]/[chapter].tsx');
  const deps = chapter.slice(chapter.indexOf('const chapterHtml = useMemo('), chapter.indexOf('const bookmarkId'));
  assert.doesNotMatch(deps.slice(deps.lastIndexOf('}, [')), /nowPlayingInset/);
  assert.match(chapter, /bottomInset=\{preferences\.slideshowMode \? 0 : nowPlayingInset\}/);
  assert.match(source('components/vine/bibleDocumentHtml.ts'), /var\(--now-playing-inset, /);
  assert.match(source('components/vine/BibleWebView.tsx'), /setProperty\('--now-playing-inset'/);
  assert.match(source('components/vine/BibleWebView.web.tsx'), /setProperty\('--now-playing-inset'/);
});

test('the video player\'s clock ticks only while a lesson with a picture plays', () => {
  const playback = source('context/PlaybackContext.tsx');
  assert.match(playback, /instance\.timeUpdateEventInterval = 0;/);
  assert.match(playback, /videoPlayerRef\.current\.timeUpdateEventInterval = activeEngine === 'video' \? 0\.25 : 0;/);
});

test('a page read this session draws at once when it opens again, and a change to the library forgets it', async () => {
  const ts = require('typescript');
  const js = ts.transpileModule(fs.readFileSync('src/utils/sessionCache.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  new Function('exports', 'require', 'module', js)(mod.exports, require, mod);
  const { createSessionCache, clearSessionCaches } = mod.exports;
  const cache = createSessionCache();
  let reads = 0;
  let release;
  const read = () => { reads += 1; return new Promise((resolve) => { release = resolve; }); };
  assert.equal(cache.peek('en'), null);
  // Two asking at once share one request.
  const first = cache.load('en', read);
  const second = cache.load('en', read);
  assert.equal(reads, 1);
  release('home');
  assert.equal(await first, 'home');
  assert.equal(await second, 'home');
  assert.equal(cache.peek('en'), 'home');
  // Read afresh behind the kept copy.
  const again = cache.load('en', read);
  assert.equal(reads, 2);
  assert.equal(cache.peek('en'), 'home');
  // A read that set out before a clear never brings back what was forgotten.
  clearSessionCaches();
  release('stale');
  await again;
  assert.equal(cache.peek('en'), null);

  const music = source('services/musicService.ts');
  for (const change of ['setLiked: changesLibrary(setTrackLiked)', 'setReleaseLiked: changesLibrary(setReleaseLiked)', 'setArtistFollowed: changesLibrary(setArtistFollowed)', 'addToPlaylist: changesLibrary(addTrackToMusicPlaylist)']) {
    assert.ok(music.includes(change), change);
  }
  assert.match(source('context/AuthContext.tsx'), /if \(cachedFor !== userId\) \{\n\s+clearSessionCaches\(\);/);
  assert.match(source('app/music/index.tsx'), /useState<MusicHomePayload \| null>\(\(\) => musicService\.peekHome\(locale\)\)/);
  assert.match(source('app/learn/index.tsx'), /useState<LearningHomePayload \| null>\(\(\) => learningService\.peekHome\(locale\)\)/);
});

test('a downloaded album checks for an update once, not at every render of its page', () => {
  const button = source('components/offline/OfflineDownloadButton.tsx');
  assert.match(button, /if \(updateCheckedFor\.current === packageKey\) return;/);
  assert.match(button, /\}, \[packageKey, prepare\]\);/);
  assert.match(button, /const holding = await holdersRef\.current\(\);/);
});

test('a rail that scrolls sideways takes no Now Playing clearance', () => {
  const scroll = source('components/playback/NowPlayingAwareScroll.tsx');
  assert.equal((scroll.match(/props\.horizontal \? 0 : nowPlayingInset/g) || []).length, 2);
});
