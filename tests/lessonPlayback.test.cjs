const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');

// Some files keep CRLF endings; the patterns below are written with \n.
const read = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

function load(path, stubs = {}) {
  const moduleObject = { exports: {} };
  const output = ts.transpileModule(read(path), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
  }).outputText;
  new Function('exports', 'require', 'module', output)(
    moduleObject.exports,
    (id) => (id in stubs ? stubs[id] : require(id)),
    moduleObject,
  );
  return moduleObject.exports;
}

const rules = load('src/utils/lessonPlayback.ts');

test('the picture streams only in video mode and only where it can be seen', () => {
  const { lessonRendition } = rules;
  const base = { hasVideo: true, mode: 'video', placement: 'floating', pictureInPicture: false, cellularBlocked: false };
  assert.equal(lessonRendition(base), 'video');
  assert.equal(lessonRendition({ ...base, placement: 'hero' }), 'video');
  // Hidden (the bar collapsed, a page it does not show on): the sound alone, so no data goes on frames nobody sees.
  assert.equal(lessonRendition({ ...base, placement: 'hidden' }), 'audio');
  // The system's own window shows it wherever the app's surface went.
  assert.equal(lessonRendition({ ...base, placement: 'hidden', pictureInPicture: true }), 'video');
  // The listener's choice, and cellular data, both mean the sound alone.
  assert.equal(lessonRendition({ ...base, mode: 'audio' }), 'audio');
  assert.equal(lessonRendition({ ...base, cellularBlocked: true }), 'audio');
  // An item with no picture has nothing else to stream.
  assert.equal(lessonRendition({ ...base, hasVideo: false }), 'audio');
});

test('a new entry is fetched in the rendition for where its picture will be', () => {
  const { startingPlacement, lessonRendition } = rules;
  const base = { itemId: 'l2', claimedItemIds: [], appActive: true, covered: false, pictureInPicture: false, current: 'hidden' };
  // Started from a list: the bar is about to offer its floating window, so the picture is fetched the first time.
  assert.equal(startingPlacement(base), 'floating');
  // Started from its own page: the page shows it.
  assert.equal(startingPlacement({ ...base, claimedItemIds: ['l1', 'l2'] }), 'hero');
  // Another lesson's page claims nothing for this one.
  assert.equal(startingPlacement({ ...base, claimedItemIds: ['l1'] }), 'floating');
  // In the background, or under a subdocument, there is nowhere: the sound alone.
  assert.equal(startingPlacement({ ...base, appActive: false }), 'hidden');
  assert.equal(startingPlacement({ ...base, covered: true }), 'hidden');
  // The system's window keeps its place, wherever the surface was.
  assert.equal(startingPlacement({ ...base, pictureInPicture: true, current: 'hero' }), 'hero');
  assert.equal(startingPlacement({ ...base, pictureInPicture: true, appActive: false }), 'floating');
  // So the engine never starts the sound alone only to swap in the picture a moment later.
  assert.equal(lessonRendition({ hasVideo: true, mode: 'video', placement: startingPlacement(base), pictureInPicture: false, cellularBlocked: false }), 'video');
  assert.equal(lessonRendition({ hasVideo: true, mode: 'video', placement: startingPlacement({ ...base, appActive: false }), pictureInPicture: false, cellularBlocked: false }), 'audio');
});

test('the surface goes to the lesson page showing the lesson, else the floating window, else nowhere', () => {
  const { resolveVideoPlacement } = rules;
  const base = {
    hasVideo: true, mode: 'video', currentItemId: 'l1', claims: [], collapsed: false, overlayAllowed: true, covered: false, pictureInPicture: false,
  };
  assert.equal(resolveVideoPlacement(base), 'floating');
  assert.equal(resolveVideoPlacement({ ...base, claims: [{ id: 'page', kind: 'hero', itemId: 'l1' }] }), 'hero');
  // Another lesson's page does not take the surface: the window floats over it.
  assert.equal(resolveVideoPlacement({ ...base, claims: [{ id: 'page', kind: 'hero', itemId: 'l2' }] }), 'floating');
  assert.equal(resolveVideoPlacement({ ...base, collapsed: true }), 'hidden');
  assert.equal(resolveVideoPlacement({ ...base, overlayAllowed: false }), 'hidden');
  assert.equal(resolveVideoPlacement({ ...base, covered: true }), 'hidden');
  assert.equal(resolveVideoPlacement({ ...base, mode: 'audio' }), 'hidden');
  assert.equal(resolveVideoPlacement({ ...base, hasVideo: false, claims: [{ id: 'page', kind: 'hero', itemId: 'l1' }] }), 'hidden');
  // In the system's window the place is frozen, so the surface is never pulled from under it.
  assert.equal(resolveVideoPlacement({ ...base, collapsed: true, pictureInPicture: true }, 'hero'), 'hero');
  assert.equal(resolveVideoPlacement({ ...base, collapsed: true, pictureInPicture: true }, 'hidden'), 'floating');
});

test('hiding the picture waits for navigation to settle; showing it, and the listener\'s own choice, are immediate', () => {
  const { renditionSwitchDelayMs } = rules;
  assert.equal(renditionSwitchDelayMs('video', 'video', 'placement'), 0);
  assert.equal(renditionSwitchDelayMs('audio', 'video', 'placement'), 0);
  assert.equal(renditionSwitchDelayMs('video', 'audio', 'placement'), 1500);
  assert.equal(renditionSwitchDelayMs('video', 'audio', 'mode'), 0);
  assert.equal(renditionSwitchDelayMs('video', 'audio', 'network'), 0);
  assert.equal(renditionSwitchDelayMs('video', 'audio', 'pip'), 0);
});

test('the floating window sits in the bar\'s corner, above the tab bar, shaped like the video, clear of the sidebar', () => {
  const { floatingWindowLayout } = rules;
  const phone = floatingWindowLayout({ windowWidth: 390, windowHeight: 844, insets: { left: 0, right: 0, bottom: 34 }, side: 'right', tabBarInset: 84, aspectRatio: null });
  assert.equal(phone.width, Math.round(390 * 0.46));
  assert.equal(phone.height, Math.round(phone.width / (16 / 9)));
  assert.equal(phone.left, 390 - 12 - phone.width);
  assert.equal(phone.bottom, 34 + 10 + (84 - 34));
  const left = floatingWindowLayout({ windowWidth: 390, windowHeight: 844, insets: { left: 0, right: 0, bottom: 34 }, side: 'left', tabBarInset: 0, aspectRatio: null });
  assert.equal(left.left, 12);
  assert.equal(left.bottom, 44);
  // A tall (portrait) video is capped by height; a desktop window keeps clear of the sidebar on the left.
  const tall = floatingWindowLayout({ windowWidth: 390, windowHeight: 844, insets: { left: 0, right: 0, bottom: 0 }, side: 'right', tabBarInset: 0, aspectRatio: 9 / 16 });
  assert.ok(tall.height <= Math.round(844 * 0.34));
  assert.equal(tall.width, Math.round(tall.height * (9 / 16)));
  const desktop = floatingWindowLayout({ windowWidth: 1400, windowHeight: 900, insets: { left: 0, right: 0, bottom: 0 }, side: 'left', tabBarInset: 0, aspectRatio: null, sidebarWidth: 248 });
  assert.equal(desktop.left, 248 + 12);
  assert.equal(desktop.width, 320);
});

test('a lesson picks up where it was left, unless it had barely begun or was all but finished', () => {
  const resume = load('src/utils/learningResume.ts', { 'react-native': { Platform: { OS: 'web' } } });
  const { resumePositionFor, withResumePosition, shouldWriteResume, sanitizeLearningResumeMap } = resume;
  const now = new Date('2026-10-17T12:00:00Z');
  let map = withResumePosition({}, 'l1', 8_000, 600_000, now);
  assert.deepEqual(map, {}, 'eight seconds in is a fresh start');
  map = withResumePosition({}, 'l1', 120_000, 600_000, now);
  assert.equal(map.l1.positionMs, 120_000);
  assert.equal(resumePositionFor(map.l1, 600_000), 120_000);
  assert.equal(resumePositionFor(map.l1, null), 120_000, 'with the length unknown the lower bound alone applies');
  assert.equal(resumePositionFor(map.l1, 125_000), 0, 'within ten seconds of the end it starts over');
  map = withResumePosition(map, 'l1', 595_000, 600_000, now);
  assert.deepEqual(map, {}, 'finishing forgets the place');
  assert.equal(shouldWriteResume(undefined, 4_000), false);
  assert.equal(shouldWriteResume(undefined, 5_000), true);
  assert.equal(shouldWriteResume({ positionMs: 10_000, durationMs: null, updatedAt: now.toISOString() }, 14_000), false);
  assert.equal(shouldWriteResume({ positionMs: 10_000, durationMs: null, updatedAt: now.toISOString() }, 15_000), true);
  // Anything stored that is not a position is dropped; only the newest 300 are kept.
  const many = Object.fromEntries(Array.from({ length: 320 }, (_, index) => [`i${index}`, { positionMs: 60_000, durationMs: null, updatedAt: new Date(now.getTime() + index * 1000).toISOString() }]));
  const kept = sanitizeLearningResumeMap({ ...many, bad: { positionMs: 'x' }, worse: null });
  assert.equal(Object.keys(kept).length, 300);
  assert.ok(kept.i319 && !kept.i0);
});

test('a video lesson plays on the one queue as its sound with its picture beside it', () => {
  const learningStubs = {
    '@/context/PlaybackContext': { usePlayback: () => null },
    '@/context/queueEntries': load('src/context/queueEntries.ts'),
    '@/services/learningService': { learningService: { resolveAsset: (asset) => (asset ? `https://cdn/${asset.id}` : null) } },
  };
  const { learningLessonSetQueue, lessonHasVideo, lessonHasAudioRendition } = load('src/context/LearningPlayerContext.tsx', learningStubs);
  const lessonSet = {
    id: 'set', title: 'Teen Anastaseen', description: null, cantor: { id: 'c', displayName: 'Cantor Ibrahim' }, season: null,
    hymn: { id: 'h', sourceHymnKey: null, title: 'Hymn', subtitle: null }, coverAsset: { id: 'cover' },
    lessons: [
      { id: 'l1', mediaType: 'video', title: 'Lesson 1', description: null, durationMs: 100, sortOrder: 1, mediaAsset: { id: 'v1', width: 1920, height: 1080 }, audioAsset: { id: 'a1' } },
      { id: 'l2', mediaType: 'video', title: 'Lesson 2', description: null, durationMs: 100, sortOrder: 2, mediaAsset: { id: 'v2' }, audioAsset: null },
      { id: 'l3', mediaType: 'audio', title: 'Lesson 3', description: null, durationMs: 100, sortOrder: 3, mediaAsset: { id: 'a3' } },
    ],
  };
  const queue = learningLessonSetQueue(lessonSet);
  assert.deepEqual(queue.map((item) => item.id), ['l1', 'l2', 'l3'], 'every lesson, video or not, in order');
  assert.equal(lessonHasVideo(queue[0]), true);
  assert.equal(lessonHasAudioRendition(queue[0]), true);
  assert.equal(lessonHasAudioRendition(queue[1]), false, 'a video lesson whose audio rendition is not made yet');
  assert.equal(lessonHasVideo(queue[2]), false);
  // The entry the engine gets: the sound from the audio rendition, the picture beside it.
  const source = read('src/context/LearningPlayerContext.tsx');
  assert.match(source, /const audioAsset = video \? item\.audioAsset \?\? item\.mediaAsset : item\.mediaAsset;/);
  assert.match(source, /video: video \? \{ remoteUri: learningService\.resolveAsset\(item\.mediaAsset\) \} : null,/);
  assert.match(source, /videoAspectRatio: video \? aspectRatioOf\(item\.mediaAsset\) : null,/);
  assert.doesNotMatch(source, /learningLessonSetAudioQueue/);
});

test('the engine plays an entry with a picture on the video player, for either rendition, and never two players at once', () => {
  const context = read('src/context/PlaybackContext.tsx');
  assert.match(context, /const activeEngine: PlaybackEngine = currentHasVideo \? 'video' : 'audio';/);
  // Loading a video entry stops the audio player; loading an audio entry stops the video player.
  assert.match(context, /if \(entryHasVideo\(entry\)\) \{[\s\S]*stopAudioEngine\(\);[\s\S]*video\.showNowPlayingNotification = true;[\s\S]*video\.replace\(videoSourceFor\(entry, uri, rendition\)\);/);
  assert.match(context, /stopVideoEngine\(\);\n\s+setCurrentIndex\(boundedIndex\);\n\s+player\.replace\(\{/);
  assert.match(context, /video\.showNowPlayingNotification = false;\n\s+video\.replace\(null\);/);
  // Only the audio player claims expo-audio's lock screen; the video player carries its own metadata.
  assert.match(context, /if \(activeEngine === 'audio'\) \{[\s\S]*player\.setActiveForLockScreen\(true, metadata, \{\n\s+showSeekBackward: !hasTrackControls,\n\s+showSeekForward: !hasTrackControls,/);
  assert.match(context, /\} else \{\n\s+\/\/ The video player carries its own metadata \(VideoSource\.metadata\)\.\n\s+player\.setActiveForLockScreen\(false\);/);
  // A rendition swap keeps the place and the play state on the same player.
  assert.match(context, /const positionMs = Math\.max\(0, Math\.round\(video\.currentTime \* 1000\)\);\n\s+const wasPlaying = video\.playing;\n\s+swapRef\.current = \{ positionMs, wasPlaying \};\n\s+setVideoSwitch\(\{ positionMs, wasPlaying \}\);/);
  // The web player resumes from its ready event: a play() beside a source replacement is thrown away there.
  assert.match(context, /if \(wasPlaying && Platform\.OS !== 'web'\) video\.play\(\);/);
  assert.match(context, /if \(pendingPlay\.current\) \{\n\s+pendingPlay\.current = false;\n\s+video\.play\(\);/);
  assert.match(context, /video\.replace\(videoSourceFor\(entry, uri, to\)\);\n\s+setVideoRendition\(to\);\n\s+video\.currentTime = positionMs \/ 1000;/);
  // The rendition follows the rules, with the navigation grace (utils/lessonPlayback.ts).
  assert.match(context, /const delay = renditionSwitchDelayMs\(videoRendition, desiredRendition, cause\);/);
  // Backgrounded without the system's window, the picture counts as hidden.
  assert.match(context, /const effectivePlacement: VideoPlacementKind = appActive \|\| videoPresentation\.pictureInPicture\n\s+\? videoPresentation\.placement\n\s+: 'hidden';/);
  // The lesson's place is remembered and picked up again.
  assert.match(context, /resumePositionFor\(peekLearningResume\(\)\[entry\.playable\.id\], entry\.playable\.durationMs\)/);
  assert.match(context, /void saveLearningResume\(currentItem\.playable\.id, persistenceBucket \* 5000, resumeDurationMs\);/);
});

test('one surface for the whole app: over the lesson page, in a floating window, or a hidden anchor', () => {
  const stage = read('src/components/playback/LessonVideoStage.tsx');
  const stageContext = read('src/context/VideoStageContext.tsx');
  assert.match(stageContext, /setVideoPresentation\(\{ placement, pictureInPicture, claimedItemIds, covered: isCovered \}\)/);
  // The web renders a button role as <button>, which may not hold buttons: the
  // tap layer is self-closing and the controls are laid over it.
  assert.match(stage, /accessibilityLabel=\{tr\('Lesson video\. Tap for controls'[^\n]*\n\s+onPress=\{\(\) => guard\(showControls\)\}\n\s+style=\{styles\.touch\}\n\s+\/>/);
  assert.match(stage, /<Pressable accessible=\{false\} focusable=\{false\} onPress=\{\(\) => guard\(showControls\)\} style=\{styles\.controls\}>/);
  assert.match(stage, /const HIDDEN_FRAME: Frame = \{ left: -4, top: -4, width: 1, height: 1 \};/);
  assert.match(stage, /nativeControls=\{placement === 'hero'\}/);
  assert.match(stage, /allowsPictureInPicture=\{pipAllowed\}/);
  assert.match(stage, /startsPictureInPictureAutomatically=\{pipAllowed && Platform\.OS !== 'web'\}/);
  assert.match(stage, /onPictureInPictureStart=\{\(\) => setPictureInPicture\(true, placement\)\}/);
  assert.match(stage, /surfaceType="textureView"/);
  assert.match(stage, /playsInline/);
  // Safari's own way into picture in picture, when the standard call is not there.
  assert.match(stage, /webkitSetPresentationMode\?\.\('picture-in-picture'\)/);
  // The floating window's controls: sound alone, picture in picture, open, hide, and the transport.
  for (const marker of ["playback.setLessonVideoMode('audio')", 'enterPictureInPicture()', 'openLesson', 'setNowPlayingCollapsed(true)', 'playback.togglePlayback', 'playback.next', 'playback.previous']) {
    assert.ok(stage.includes(marker), marker);
  }
  const layout = read('src/app/_layout.tsx');
  assert.match(layout, /<VideoStageProvider>[\s\S]*<BottomChromeProvider>[\s\S]*<AppFrame \/>/);
  assert.match(layout, /<GlobalNowPlayingOverlay \/>\n\s+<\/View>\n[\s\S]*<LessonVideoStage \/>/);
  // The lesson page claims the surface for its lesson while it shows, once its arrival has settled.
  const slot = read('src/components/learning/LessonVideoSlot.tsx');
  assert.match(slot, /useFocusEffect\(useCallback\(\(\) => \{[\s\S]*claimHero\(id, itemId, null\);[\s\S]*InteractionManager\.runAfterInteractions\(\(\) => measure\(\)\);[\s\S]*releaseHero\(id\);/);
  assert.match(slot, /view\.measureInWindow\(\(x, y, width, height\) => \{/);
  assert.match(read('src/app/learn/lesson/[id].tsx'), /<LessonVideoSlot itemId=\{lesson\.id\}/);
});

test('the bar is gold for everything, gives way to the floating window, and steps aside on the lesson\'s own page', () => {
  const overlay = read('src/components/playback/GlobalNowPlayingOverlay.tsx');
  assert.match(overlay, /const accentColor = COLORS\.gold;/);
  assert.doesNotMatch(overlay, /COLORS\.learning\b/);
  assert.match(overlay, /const floatingVideo = !covering && stage\.placement === 'floating';/);
  assert.match(overlay, /if \(floatingVideo\) return null;/);
  assert.match(overlay, /const onCurrentLessonPage = !covering && stage\.currentItemOnPage;/);
  assert.match(overlay, /const floatingSlotAvailable = !covering && allowDisplay && !isCollapsed && !isPopupOpen;/);
  // Opening a lesson watched as video goes to its page; the sound alone opens the full player.
  assert.match(overlay, /if \(lesson && learning\.currentHasVideo && learning\.lessonVideoMode === 'video' && lesson\.kind === 'lesson'\) \{\n\s+router\.push\(\{ pathname: '\/learn\/lesson\/\[id\]'/);
  // A subdocument's bar says it covers the stage.
  assert.match(read('src/components/vine/screens/DocumentModal.tsx'), /<GlobalNowPlayingOverlay\n\s+documentTheme=\{documentTheme\}\n\s+covering/);
  // The empty mini players are gone from every learn page.
  assert.equal(fs.existsSync('src/components/learning/LearningMiniPlayer.tsx'), false);
  assert.equal(fs.existsSync('src/components/learning/LearningVideoPlayer.tsx'), false);
  for (const screen of fs.readdirSync('src/app/learn', { recursive: true }).filter((name) => String(name).endsWith('.tsx'))) {
    assert.doesNotMatch(read(`src/app/learn/${screen}`), /LearningMiniPlayer/, String(screen));
  }
});

test('the lesson video mode and the cellular choice are device preferences', () => {
  const storage = read('src/utils/preferencesStorage.ts');
  assert.match(storage, /lessonVideoMode: 'video',\n\s+lessonVideoOnCellular: false,/);
  assert.match(storage, /merged\.lessonVideoMode = stored\?\.lessonVideoMode === 'audio' \? 'audio' : 'video';/);
  assert.match(storage, /merged\.lessonVideoOnCellular = booleanValue\(stored\?\.lessonVideoOnCellular, DEFAULT_READING_PREFERENCES\.lessonVideoOnCellular\);/);
  // Neither is synced: a phone on cellular and an iPad at home differ.
  const synced = storage.slice(storage.indexOf('export type SyncedReadingPreferences'), storage.indexOf('>;', storage.indexOf('export type SyncedReadingPreferences')));
  assert.doesNotMatch(synced, /lessonVideo/);
  assert.match(read('src/app/downloads.tsx'), /on=\{reading\.lessonVideoOnCellular\}\n\s+onPress=\{toggleLessonVideoOnCellular\}/);
});

test('a video lesson downloads its sound alone beside its picture, and one lesson keeps the whole set offline', () => {
  const musicCredits = load('src/utils/musicCredits.ts');
  const { learningLessonDownloadRequest, learningLessonSetDownloadRequest } = load('src/services/offlineDownloadRequests.ts', {
    '@/services/mediaService': { mediaService: { canResolve: () => true, resolve: (asset) => `https://cdn/${asset.id}` } },
    '@/utils/musicCredits': musicCredits,
  });
  const lessonSet = {
    id: 'set', title: 'Teen Anastaseen', cantor: { id: 'c', displayName: 'Cantor' }, coverAsset: { id: 'cover', path: 'cover.jpg' },
    lessons: [
      { id: 'l1', mediaType: 'video', mediaAsset: { id: 'v1', path: 'video.mp4', fileSizeBytes: 100 }, audioAsset: { id: 'a1', path: 'audio.m4a', fileSizeBytes: 10 } },
      { id: 'l2', mediaType: 'audio', mediaAsset: { id: 'a2', path: 'lesson.m4a', fileSizeBytes: 20 } },
    ],
  };
  const one = learningLessonDownloadRequest(lessonSet, lessonSet.lessons[0], 'en');
  assert.deepEqual(one.resources.filter((r) => r.role === 'media').map((r) => [r.playableKind, r.playableId, r.fileKey]), [
    ['learning_video_audio', 'l1', 'media:learning_video_audio:l1:v1'],
    ['learning_audio', 'l1', 'media:learning_audio:l1:a1'],
  ]);
  const setSnapshot = one.snapshots.find((snapshot) => snapshot.entityType === 'learning_lesson_set');
  assert.equal(setSnapshot.data.lessons.length, 2, 'the set page offline still lists every lesson');
  const whole = learningLessonSetDownloadRequest(lessonSet, 'en');
  assert.deepEqual(whole.resources.filter((r) => r.role === 'media').map((r) => r.fileKey), [
    'media:learning_video_audio:l1:v1',
    'media:learning_audio:l1:a1',
    'media:learning_audio:l2:a2',
  ]);
});
