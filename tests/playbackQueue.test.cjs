const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');

function compile(path) {
  return ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
  }).outputText;
}

function load(path, stubs = {}) {
  const moduleObject = { exports: {} };
  new Function('exports', 'require', 'module', compile(path))(
    moduleObject.exports,
    (id) => (id in stubs ? stubs[id] : require(id)),
    moduleObject,
  );
  return moduleObject.exports;
}

const queueEntries = load('src/context/queueEntries.ts');

const track = (id, title) => ({ track: { id, title, releaseId: 'r1', durationMs: 1000, mediaAsset: null }, releaseTitle: 'Praises', releaseType: 'album' });
const lesson = (id, title, kind = 'lesson') => ({
  kind, id, title, subtitle: null, durationMs: 2000, mediaAsset: { id: `m-${id}` }, containerId: 'set1', containerTitle: 'Hymns of Kiahk', cantorName: 'Cantor Ibrahim', coverAsset: null, hymnId: null,
});
const musicEntry = (id, title) => ({ key: `music:${id}:0`, payload: track(id, title), playable: { id, kind: 'music_track', title, source: {} } });
const learningEntry = (id, title) => ({ key: `learning:lesson:${id}:0`, payload: lesson(id, title), playable: { id, kind: 'learning_audio', title, artist: 'Cantor Ibrahim', source: {} } });

test('the queue is shown as the engine holds it: both kinds, in order, under the same indices', () => {
  const { describeQueue } = queueEntries;
  const strange = { key: 'x', payload: { something: true }, playable: { id: 'x', kind: 'music_track', title: 'Unknown', artist: 'Someone', source: {} } };
  const views = describeQueue([musicEntry('t1', 'Song'), learningEntry('l1', 'Lesson one'), strange, musicEntry('t2', 'Another song')]);
  assert.deepEqual(views.map((view) => [view.kind, view.key]), [
    ['music', 'music:t1:0'],
    ['learning', 'learning:lesson:l1:0'],
    ['other', 'x'],
    ['music', 'music:t2:0'],
  ]);
  assert.equal(views[0].item.track.title, 'Song');
  assert.equal(views[1].item.title, 'Lesson one');
  // An entry this version cannot read keeps its place, named by what the engine knows of it.
  assert.deepEqual(views[2], { key: 'x', kind: 'other', title: 'Unknown', subtitle: 'Someone' });
  assert.equal(views.length, 4, 'nothing is dropped, so the indices stay the engine’s');
});

test('each kind is told by the shape of its payload', () => {
  const { isMusicQueueItem, isLearningQueueItem } = queueEntries;
  assert.equal(isMusicQueueItem(track('t', 'x')), true);
  assert.equal(isMusicQueueItem(lesson('l', 'x')), false);
  assert.equal(isLearningQueueItem(lesson('l', 'x')), true);
  assert.equal(isLearningQueueItem(lesson('l', 'x', 'recording')), true);
  assert.equal(isLearningQueueItem({ ...lesson('l', 'x'), mediaAsset: null }), false);
  assert.equal(isLearningQueueItem(track('t', 'x')), false);
  for (const bad of [null, undefined, 'music', 7, {}]) {
    assert.equal(isMusicQueueItem(bad), false);
    assert.equal(isLearningQueueItem(bad), false);
  }
});

/** Each adapter rendered over a fake engine, so its hook can be called. */
function renderAdapter(path, hookName, engine, stubs) {
  const React = require('react');
  const { renderToString } = require('react-dom/server');
  const adapter = load(path, {
    '@/context/PlaybackContext': { usePlayback: () => engine, PlaybackProvider: ({ children }) => children },
    '@/context/queueEntries': queueEntries,
    ...stubs,
  });
  let value = null;
  function Probe() {
    value = adapter[hookName]();
    return null;
  }
  renderToString(React.createElement(Probe));
  return value;
}

const engineWith = (queue, currentIndex, calls) => ({
  queue,
  currentIndex,
  currentItem: queue[currentIndex] ?? null,
  playing: true,
  buffering: false,
  loadingSource: false,
  currentTimeMs: 1500,
  durationMs: 9000,
  repeatMode: 'off',
  shuffleEnabled: false,
  playbackError: null,
  playQueue: () => undefined,
  playItem: () => undefined,
  addNext: (entry) => calls.push(['next', entry]),
  addToEnd: (entry) => calls.push(['end', entry]),
  togglePlayback: () => undefined,
  next: () => undefined,
  previous: () => undefined,
  seekToMs: async () => undefined,
  selectQueueIndex: () => undefined,
  moveQueueItem: () => undefined,
  clearUpcoming: () => undefined,
  clearQueue: () => undefined,
  updateQueueEntries: () => undefined,
  hydrated: true,
  cycleRepeatMode: () => undefined,
  toggleShuffle: () => undefined,
});

const learningStubs = { '@/services/learningService': { learningService: { resolveAsset: (asset) => (asset ? `https://cdn/${asset.id}` : null) } } };
const musicStubs = {
  '@/context/AuthContext': { useAuth: () => ({ user: null }) },
  '@/services/musicService': { musicService: { resolveAsset: () => null, getRelease: async () => null, recordPlay: async () => undefined } },
  '@/utils/musicCredits': { formatMusicTrackPerformers: () => 'Performers' },
};

test('the Learn & Study player queues a lesson after whatever is playing, under a key of its own', () => {
  const calls = [];
  const engine = engineWith([musicEntry('t1', 'Song'), learningEntry('l1', 'Lesson one')], 0, calls);
  const player = renderAdapter('src/context/LearningPlayerContext.tsx', 'useLearningPlayer', engine, learningStubs);
  assert.deepEqual(player.entries.map((view) => view.kind), ['music', 'learning'], 'it reports the whole queue, the song included');
  assert.equal(player.currentIndex, 0, 'the engine’s index, even while a song plays');
  assert.equal(player.currentItem, null, 'but no item of its own while a song plays');
  player.addNext(lesson('l2', 'Lesson two'));
  player.addToEnd(lesson('l2', 'Lesson two'));
  assert.deepEqual(calls.map(([where, entry]) => [where, entry.playable.kind, entry.payload.id]), [['next', 'learning_audio', 'l2'], ['end', 'learning_audio', 'l2']]);
  assert.notEqual(calls[0][1].key, calls[1][1].key, 'the same lesson queued twice is two entries');
  assert.match(calls[0][1].key, /^learning:lesson:l2:\d+$/);
});

test('the Music player reports the same whole queue, with the lesson where it will play', () => {
  const calls = [];
  const engine = engineWith([musicEntry('t1', 'Song'), learningEntry('l1', 'Lesson one'), musicEntry('t2', 'Another')], 1, calls);
  const player = renderAdapter('src/context/MusicPlayerContext.tsx', 'useMusicPlayer', engine, musicStubs);
  assert.deepEqual(player.entries.map((view) => view.kind), ['music', 'learning', 'music']);
  assert.equal(player.currentIndex, 1);
  assert.equal(player.currentItem, null, 'a lesson is playing, not a track');
  assert.equal(player.playing, false, 'so the Music player is not the one playing');
  player.addNext(track('t3', 'Third'));
  assert.deepEqual(calls.map(([where, entry]) => [where, entry.playable.kind, entry.payload.track.id]), [['next', 'music_track', 't3']]);
});

test('one list shows the mixed queue in both players, each row by its kind, and Learn rows can be queued', () => {
  const read = (path) => fs.readFileSync(path, 'utf8');
  assert.equal(fs.existsSync('src/components/music/MusicQueueList.tsx'), false);
  assert.equal(fs.existsSync('src/components/learning/LearningQueueList.tsx'), false);
  const list = read('src/components/playback/PlaybackQueueList.tsx');
  assert.match(list, /case 'music':[\s\S]*<MusicArtwork[\s\S]*<MusicTrackActionsMenu/);
  assert.match(list, /case 'learning':[\s\S]*<LearningArtwork[\s\S]*<LearningItemActionsMenu/);
  assert.match(list, /onSelect\(index\)/, 'a row selects its engine index');
  assert.match(list, /key=\{entry\.key\}/);
  for (const screen of ['src/components/music/MusicNowPlayingScreen.tsx', 'src/components/learning/LearningNowPlayingScreen.tsx']) {
    const source = read(screen);
    assert.match(source, /<PlaybackQueueList \{\.\.\.queueProps\} scrollable/, screen);
    assert.match(source, /entries,\s+currentIndex,/, screen);
    assert.doesNotMatch(source, /queueKeys|MusicQueueList|LearningQueueList/, screen);
  }
  assert.match(read('src/components/music/MusicNowPlayingScreen.tsx'), /tone: 'music' as const/);
  assert.match(read('src/components/learning/LearningNowPlayingScreen.tsx'), /tone: 'learning' as const/);
  // Every place a Learn & Study item is listed offers to queue it.
  for (const screen of ['src/app/learn/album/[id].tsx', 'src/app/learn/lesson-set/[id].tsx', 'src/app/learn/playlist/[id].tsx', 'src/app/learn/library.tsx', 'src/app/learn/lesson/[id].tsx']) {
    assert.match(read(screen), /<LearningItemActionsMenu\s+item=\{/, screen);
  }
  const menu = read('src/components/learning/LearningItemActionsMenu.tsx');
  assert.match(menu, /addNext\(item\)/);
  assert.match(menu, /addToEnd\(item\)/);
  // Both menus rise from the one sheet.
  assert.match(menu, /from '@\/components\/playback\/ActionsSheet'/);
  assert.match(read('src/components/music/MusicTrackActionsMenu.tsx'), /from '@\/components\/playback\/ActionsSheet'/);
});
