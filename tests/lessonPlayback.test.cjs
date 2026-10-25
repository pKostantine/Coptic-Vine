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

test('the picture streams only in video mode, only where it can be seen, and never on blocked cellular', () => {
  const { lessonRendition, pictureVisible } = rules;
  const base = { hasVideo: true, mode: 'video', pictureVisible: true, cellularBlocked: false };
  assert.equal(lessonRendition(base), 'video');
  // Nowhere to be seen (the bar put away, a page without it, the app left): the sound alone.
  assert.equal(lessonRendition({ ...base, pictureVisible: false }), 'audio');
  // The listener's choice, and cellular data, both mean the sound alone.
  assert.equal(lessonRendition({ ...base, mode: 'audio' }), 'audio');
  assert.equal(lessonRendition({ ...base, cellularBlocked: true }), 'audio');
  // An item with no picture has nothing else to stream.
  assert.equal(lessonRendition({ ...base, hasVideo: false }), 'audio');
  // Seen on a surface while the app is on screen, or in the system's own window wherever the app is.
  assert.equal(pictureVisible({ surfaceShowing: true, appActive: true, pictureInPicture: false }), true);
  assert.equal(pictureVisible({ surfaceShowing: true, appActive: false, pictureInPicture: false }), false);
  assert.equal(pictureVisible({ surfaceShowing: false, appActive: false, pictureInPicture: true }), true);
  assert.equal(pictureVisible({ surfaceShowing: false, appActive: true, pictureInPicture: false }), false);
});

test('a new lesson is fetched in the rendition for where its picture will be', () => {
  const { startingPictureVisible } = rules;
  const base = { surfaceShowing: false, barShowsPicture: false, surfaceExpected: false, appActive: true, pictureInPicture: false };
  // Started from a list with the bar out: its thumbnail will draw the picture, so the picture is fetched the first time.
  assert.equal(startingPictureVisible({ ...base, barShowsPicture: true }), true);
  // Started to be watched: the full player is opening for it.
  assert.equal(startingPictureVisible({ ...base, surfaceExpected: true }), true);
  assert.equal(startingPictureVisible({ ...base, surfaceShowing: true }), true);
  // The bar put away and nothing opening: the sound alone.
  assert.equal(startingPictureVisible(base), false);
  // In the background only the system's window shows anything.
  assert.equal(startingPictureVisible({ ...base, barShowsPicture: true, appActive: false }), false);
  assert.equal(startingPictureVisible({ ...base, appActive: false, pictureInPicture: true }), true);
});

test('one surface shows the picture: the full player over any bar, the newer of two bars', () => {
  const { activeVideoSurface } = rules;
  assert.equal(activeVideoSurface([]), null);
  assert.equal(activeVideoSurface([{ id: 'bar', kind: 'mini', order: 1 }]), 'bar');
  assert.equal(activeVideoSurface([{ id: 'bar', kind: 'mini', order: 1 }, { id: 'player', kind: 'full', order: 2 }]), 'player');
  assert.equal(activeVideoSurface([{ id: 'player', kind: 'full', order: 1 }, { id: 'bar', kind: 'mini', order: 2 }]), 'player', 'a bar mounted later never takes it from the full player');
  // A subdocument's bar, drawn over the app's, is the newer.
  assert.equal(activeVideoSurface([{ id: 'app', kind: 'mini', order: 1 }, { id: 'subdocument', kind: 'mini', order: 5 }]), 'subdocument');
});

test("hiding the picture waits; showing it, the listener's choice and cellular data are immediate", () => {
  const { renditionSwitchDelayMs, IN_APP_HIDE_MS, BACKGROUND_HIDE_MS } = rules;
  assert.equal(renditionSwitchDelayMs('video', 'video', 'visibility'), 0);
  assert.equal(renditionSwitchDelayMs('audio', 'video', 'visibility'), 0);
  assert.equal(renditionSwitchDelayMs('audio', 'video', 'mode'), 0);
  assert.equal(renditionSwitchDelayMs('video', 'audio', 'mode'), 0);
  assert.equal(renditionSwitchDelayMs('video', 'audio', 'network'), 0);
  assert.equal(renditionSwitchDelayMs('video', 'audio', 'pip'), 0);
  // A moment on a page without the bar never interrupts the sound; the app left soon gives up the picture.
  assert.equal(renditionSwitchDelayMs('video', 'audio', 'visibility'), IN_APP_HIDE_MS);
  assert.equal(renditionSwitchDelayMs('video', 'audio', 'background'), BACKGROUND_HIDE_MS);
  assert.ok(IN_APP_HIDE_MS >= 5000 && BACKGROUND_HIDE_MS < IN_APP_HIDE_MS);
});

test("the picture's frame, full screen's turn, and what Audio only saves", () => {
  const { fitVideo, videoAspect, fullscreenOrientation, formatDataSize, audioSavings } = rules;
  assert.equal(videoAspect(1920 / 1080), 1920 / 1080);
  assert.equal(videoAspect(null), 16 / 9);
  assert.equal(videoAspect(40), 16 / 9, 'an implausible shape is taken as 16:9');
  // The widest box of the video's shape that fits.
  assert.deepEqual(fitVideo(342, 400, 16 / 9), { width: 342, height: 192 });
  assert.deepEqual(fitVideo(800, 225, 16 / 9), { width: 400, height: 225 });
  assert.deepEqual(fitVideo(342, 400, 9 / 16), { width: 225, height: 400 });
  assert.equal(fullscreenOrientation(16 / 9), 'landscape');
  assert.equal(fullscreenOrientation(9 / 16), 'default');
  // Teen Anastaseen's first lesson, as processed: a 1.34 GB video, a 61 MB audio copy.
  assert.equal(formatDataSize(1_337_872_575), '1.3 GB');
  assert.equal(formatDataSize(60_626_199), '61 MB');
  assert.deepEqual(audioSavings(1_337_872_575, 60_626_199), { video: '1.3 GB', audio: '61 MB' });
  assert.equal(audioSavings(1_337_872_575, null), null);
  assert.equal(audioSavings(100, 200), null);
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
  assert.match(context, /if \(entryHasVideo\(entry\)\) \{[\s\S]*stopAudioEngine\(\);[\s\S]*video\.showNowPlayingNotification = true;\n\s+await replaceVideoSource\(video, videoSourceFor\(entry, uri, rendition\), \{/);
  assert.match(context, /stopVideoEngine\(\);\n\s+setCurrentIndex\(boundedIndex\);\n\s+player\.replace\(\{/);
  assert.match(context, /if \(video\.showNowPlayingNotification\) video\.showNowPlayingNotification = false;\n\s+video\.replace\(null\);/);
  // Only the audio player claims expo-audio's lock screen; the video player carries its own metadata.
  assert.match(context, /if \(activeEngine === 'audio'\) \{[\s\S]*player\.setActiveForLockScreen\(true, metadata, \{\n\s+showSeekBackward: !hasTrackControls,\n\s+showSeekForward: !hasTrackControls,/);
  assert.match(context, /\} else \{\n\s+\/\/ The video player carries its own metadata \(VideoSource\.metadata\)\.\n\s+player\.setActiveForLockScreen\(false\);/);
  // A new lesson's rendition is decided once both are resolved, so a page opening the full player has had its say.
  assert.match(context, /const \[pictureUri, soundUri\] = await Promise\.all\(\[resolveVideoUri\(entry\), resolveAudioUri\(entry\)\]\);\n[\s\S]*?const wanted = startingRenditionFor\(\);/);
  assert.match(context, /surfaceExpected: Date\.now\(\) < surfaceExpectedUntil\.current,/);
  // A rendition swap keeps the place and the play state on the same player.
  assert.match(context, /const positionMs = Math\.max\(0, Math\.round\(video\.currentTime \* 1000\)\);\n[^\n]*\n\s+const wasPlaying = video\.playing \|\| pendingPlay\.current;\n\s+swapRef\.current = \{ positionMs, wasPlaying \};\n\s+setVideoSwitch\(\{ positionMs, wasPlaying \}\);/);
  assert.match(context, /await replaceVideoSource\(video, videoSourceFor\(entry, uri, to\), \{\n\s+positionMs, play: wasPlaying, rendition: to, volume: volumeRef\.current, rate: playbackRate,/);
  // iOS loads off the main thread; the web player starts a new source by itself, so it is paused again when it should not play.
  assert.match(context, /if \(Platform\.OS === 'ios'\) await video\.replaceAsync\(source\);\n\s+else video\.replace\(source\);/);
  assert.match(context, /if \(Platform\.OS === 'web'\) \{\n\s+if \(!options\.play\) video\.pause\(\);\n\s+\} else if \(options\.play\) \{\n\s+video\.play\(\);/);
  // The screen stays on only for the picture, and the picture is fetched only half a minute ahead.
  assert.match(context, /video\.keepScreenOnWhilePlaying = options\.rendition === 'video';/);
  assert.match(context, /instance\.keepScreenOnWhilePlaying = false;/);
  assert.match(context, /instance\.bufferOptions = \{ preferredForwardBufferDuration: 30, waitsToMinimizeStalling: true \};/);
  // The web player waits for its own element (the lesson's one <video>).
  assert.match(context, /const element = lessonVideoElement\(\);/);
  assert.doesNotMatch(context, /document\.querySelector\('video'\)/);
  // The rendition follows the rules, how soon decided by why they differ (utils/lessonPlayback.ts).
  assert.match(context, /const cause: RenditionCause = lessonVideoMode !== 'video'\n\s+\? 'mode'\n\s+: cellularBlocked \? 'network' : !appActive \? 'background' : 'visibility';/);
  assert.match(context, /const delay = renditionSwitchDelayMs\(videoRendition, desiredRendition, cause\);/);
  // A play() the browser gives up on is expected, and quiet.
  assert.match(context, /window\.addEventListener\('unhandledrejection', quietInterruptedPlay\);/);
  // The lesson's place is remembered and picked up again.
  assert.match(context, /resumePositionFor\(peekLearningResume\(\)\[entry\.playable\.id\], entry\.playable\.durationMs\)/);
  assert.match(context, /void saveLearningResume\(currentItem\.playable\.id, persistenceBucket \* 5000, resumeDurationMs\);/);
});

test('songs reach Now Playing: their audio session never mixes, and expo-video is not left to change it', () => {
  const context = read('src/context/PlaybackContext.tsx');
  // iOS gives Now Playing (lock screen, Control Center, CarPlay) only to an app whose sound does not mix.
  assert.match(context, /const PLAYBACK_AUDIO_MODE: Partial<AudioMode> = \{\n\s+playsInSilentMode: true,\n\s+shouldPlayInBackground: true,\n\s+interruptionMode: 'doNotMix',\n\};/);
  assert.match(context, /useEffect\(\(\) => \{\n\s+void setAudioModeAsync\(PLAYBACK_AUDIO_MODE\);\n\s+\}, \[\]\);/);
  // Each write of showNowPlayingNotification makes expo-video set the session again, mixing while no lesson
  // plays, so a song never writes it unless a lesson had it on.
  assert.equal((context.match(/video\.showNowPlayingNotification = false;/g) || []).length, 1);
  assert.match(context, /if \(video\.showNowPlayingNotification\) video\.showNowPlayingNotification = false;/);
  // The session comes back whenever the audio player takes the lock screen, and with the second try 600 ms on.
  assert.match(context, /const activate = \(\) => \{[\s\S]*?if \(Platform\.OS === 'ios'\) void setAudioModeAsync\(PLAYBACK_AUDIO_MODE\);\n\s+player\.setActiveForLockScreen\(true, metadata, \{/);
  assert.match(context, /activate\(\);\n[\s\S]*?timer = setTimeout\(activate, 600\);/);
});

test('the web lends its one <video> to the surface showing it, and takes it back before the surface goes', () => {
  const element = load('src/utils/lessonVideoElement.web.ts');
  const node = (name) => ({
    name,
    children: [],
    parentElement: null,
    appendChild(child) {
      if (child.parentElement) child.parentElement.children = child.parentElement.children.filter((c) => c !== child);
      child.parentElement = this;
      this.children.push(child);
    },
  });
  const home = node('home');
  const video = node('video');
  home.appendChild(video);
  element.setLessonVideoHome(home, video);
  assert.equal(element.lessonVideoElement(), video);
  const bar = node('bar');
  const giveBackFromBar = element.borrowLessonVideo(bar);
  assert.equal(video.parentElement, bar);
  // The full player opens: the bar gives it back, the player borrows it; one element throughout.
  giveBackFromBar();
  assert.equal(video.parentElement, home);
  const player = node('player');
  const giveBackFromPlayer = element.borrowLessonVideo(player);
  assert.equal(video.parentElement, player);
  // A surface that no longer holds it gives nothing back.
  giveBackFromBar();
  assert.equal(video.parentElement, player);
  giveBackFromPlayer();
  assert.equal(video.parentElement, home);
  assert.equal(home.children.length, 1);
  // Nothing to lend without a home, and natively nothing at all.
  element.setLessonVideoHome(null, null);
  assert.equal(element.lessonVideoElement(), null);
  element.borrowLessonVideo(bar)();
  const native = load('src/utils/lessonVideoElement.ts');
  assert.equal(native.lessonVideoElement(), null);
});

test('surfaces draw the picture in their own layout: a view of its own natively, the lent element on the web', () => {
  const surface = read('src/components/playback/LessonVideoSurface.tsx');
  const webSurface = read('src/components/playback/LessonVideoSurface.web.tsx');
  const stage = read('src/context/VideoStageContext.tsx');
  // Registered while mounted, before paint; the stage picks the one that shows.
  assert.match(stage, /useLayoutEffect\(\(\) => \{\n\s+registerSurface\(id, kind\);\n\s+return \(\) => unregisterSurface\(id\);/);
  assert.match(stage, /const activeSurfaceId = activeVideoSurface\(surfaceList\);/);
  assert.match(stage, /setVideoPresentation\(\{ surfaceShowing: activeSurfaceId != null, barShowsPicture, pictureInPicture \}\);/);
  // Natively only the surface that shows mounts a view, after the home view (Android draws a player in one view).
  assert.match(surface, /\{active \? \(\n[^\n]*\n\s+<View pointerEvents="none" style=\{StyleSheet\.absoluteFill\}>\n\s+<VideoView\n[^\n]*\n\s+key=\{homeGeneration\}/);
  assert.match(surface, /startsPictureInPictureAutomatically=\{pictureShown\}/);
  assert.match(surface, /fullscreenOptions=\{\{ enable: true, orientation: fullscreenOrientation\(aspect\) \}\}/);
  assert.match(surface, /surfaceType="textureView"/);
  assert.match(surface, /nativeControls=\{false\}/);
  // The web borrows the element in a layout effect, so it leaves before React takes the frame away.
  assert.match(webSurface, /useLayoutEffect\(\(\) => \{\n\s+if \(!active\) return undefined;[\s\S]*return borrowLessonVideo\(slotRef\.current as unknown as HTMLElement \| null\);\n\s+\}, \[active, contentFit, homeGeneration\]\);/);
  assert.match(webSurface, /<View ref=\{slotRef\} pointerEvents="none" style=\{StyleSheet\.absoluteFill\} \/>/);
  assert.match(webSurface, /await video\.requestFullscreen\(\);/);
  // The home: Android's view out of sight (its background playback needs one), the web's one element.
  const home = read('src/components/playback/LessonVideoHome.tsx');
  const webHome = read('src/components/playback/LessonVideoHome.web.tsx');
  assert.match(home, /if \(Platform\.OS !== 'android' \|\| !currentHasVideo\) return null;/);
  assert.match(webHome, /setLessonVideoHome\(container, video\);\n\s+markHomeMounted\(\);/);
  assert.match(webHome, /if \(container && video\.parentElement !== container\) container\.appendChild\(video\);/);
  assert.match(webHome, /video\.controls = full;/);
  const layout = read('src/app/_layout.tsx');
  assert.match(layout, /<VideoStageProvider>[\s\S]*<BottomChromeProvider>[\s\S]*<AppFrame \/>/);
  assert.match(layout, /<LessonVideoHome \/>/);
  for (const gone of ['src/components/playback/LessonVideoStage.tsx', 'src/components/learning/LessonVideoSlot.tsx']) {
    assert.equal(fs.existsSync(gone), false, gone);
  }
});

test('the bar shows a video lesson as its picture, switches it to its sound alone and back, and opens the full player', () => {
  const overlay = read('src/components/playback/GlobalNowPlayingOverlay.tsx');
  const card = read('src/components/playback/MiniPlayerCard.tsx');
  assert.match(overlay, /const accentColor = COLORS\.gold;/);
  assert.doesNotMatch(overlay, /COLORS\.learning\b/);
  // Watched as video, the thumbnail is the picture; as sound, the cover.
  assert.match(overlay, /artwork = learning\.currentHasVideo && learning\.lessonVideoMode === 'video' \? \(\n\s+<LessonVideoSurface\n\s+kind="mini"/);
  assert.match(overlay, /icon: 'headset-outline' as const, label: tr\('Listen to the audio only'[^\n]*onPress: \(\) => learning\.setLessonVideoMode\('audio'\)/);
  assert.match(overlay, /icon: 'videocam-outline' as const, label: tr\('Watch the video'[^\n]*onPress: \(\) => learning\.setLessonVideoMode\('video'\)/);
  assert.match(overlay, /extraButton=\{modeButton\}/);
  assert.match(card, /onPress=\{unlessSwiped\(extraButton\.onPress\)\}/);
  // Everything opens the full player; the bar never steps aside or floats.
  assert.match(overlay, /const onOpen = \(\) => setIsPopupOpen\(true\);/);
  assert.doesNotMatch(overlay, /floatingVideo|currentItemOnPage|floatingWindowLayout/);
  // Out, the bar says so; a page asks the app's bar for the full player.
  assert.match(overlay, /const barOut = allowDisplay && !isCollapsed && !isPopupOpen;/);
  assert.match(overlay, /if \(covering \|\| nowPlayingOpenRequests === answeredOpenRequests\.current\) return;\n\s+answeredOpenRequests\.current = nowPlayingOpenRequests;\n\s+setIsPopupOpen\(true\);/);
  assert.match(read('src/components/vine/screens/DocumentModal.tsx'), /<GlobalNowPlayingOverlay\n\s+documentTheme=\{documentTheme\}\n\s+covering/);
  // The empty mini players are gone from every learn page.
  assert.equal(fs.existsSync('src/components/learning/LearningMiniPlayer.tsx'), false);
  assert.equal(fs.existsSync('src/components/learning/LearningVideoPlayer.tsx'), false);
  for (const screen of fs.readdirSync('src/app/learn', { recursive: true }).filter((name) => String(name).endsWith('.tsx'))) {
    assert.doesNotMatch(read(`src/app/learn/${screen}`), /LearningMiniPlayer/, String(screen));
  }
});

test('the full player shows the picture in place of the cover, with Video | Audio only above it and full screen in its corner', () => {
  const screen = read('src/components/learning/LearningNowPlayingScreen.tsx');
  const panel = read('src/components/learning/LessonVideoPanel.tsx');
  const layouts = read('src/components/playback/PlayerLayouts.tsx');
  assert.match(screen, /media: videoLesson \? \{\n\s+aspect,\n\s+render: \(width, height\) => <LessonVideoPanel item=\{currentItem\}/);
  assert.match(screen, /above: <LessonModeSwitch mode=\{player\.lessonVideoMode\} onChange=\{player\.setLessonVideoMode\}/);
  assert.match(screen, /playerColumns\(layout, \{ lyrics: lyricsPanelShown, queue: queuePanelShown \}, videoLesson\)/);
  assert.doesNotMatch(screen, /watchVideo|Watch the video/);
  // Every composition sizes the frame to the video's shape.
  assert.equal((layouts.match(/fitVideo\(/g) || []).length, 3);
  // Video: the surface, full screen, and the cellular notice; Audio only: the cover in the same frame, and what it saves.
  assert.match(panel, /<LessonVideoSurface\n\s+ref=\{surfaceRef\}\n\s+kind="full"/);
  assert.match(panel, /onPress=\{\(\) => void surfaceRef\.current\?\.enterFullscreen\(\)\}/);
  assert.match(panel, /onPress=\{player\.allowVideoOverCellularNow\}/);
  assert.match(panel, /if \(player\.lessonVideoMode === 'audio'\) \{\n\s+return <AudioOnlyFrame/);
  assert.match(panel, /audioSavings\(item\.mediaAsset\.fileSizeBytes, item\.audioAsset\?\.fileSizeBytes\)/);
});

test('every list starts lessons one way: watched as video, the full player opens on the picture', () => {
  const hook = read('src/hooks/usePlayLessons.ts');
  assert.match(hook, /if \(lessonHasVideo\(item\) && lessonVideoMode === 'video'\) \{\n\s+expectVideoSurface\(\);\n\s+requestNowPlayingOpen\(\);\n\s+\}\n\s+playQueue\(items, startIndex\);/);
  for (const file of ['src/app/learn/lesson-set/[id].tsx', 'src/app/learn/lesson/[id].tsx', 'src/app/learn/playlist/[id].tsx', 'src/app/learn/library.tsx', 'src/components/search/SectionSearchScreen.tsx']) {
    const source = read(file);
    assert.match(source, /usePlayLessons\(\)/, file);
    // None sends a video lesson to its page to be watched any more.
    assert.doesNotMatch(source, /lessonVideoMode === 'video'\) \{?\s*(router\.push|openLessonPage)/, file);
  }
  // A set with video lessons offers the choice beside Play, before anything is fetched.
  assert.match(read('src/app/learn/lesson-set/[id].tsx'), /\{videoCount \? \(\n\s+<View style=\{styles\.mode\}>\n\s+<LessonModeSwitch/);
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
