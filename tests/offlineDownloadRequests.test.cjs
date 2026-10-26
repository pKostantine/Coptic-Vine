const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');

function loadTypeScriptModule(path, dependencies = {}) {
  const source = fs.readFileSync(path, 'utf8');
  const javascript = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const moduleObject = { exports: {} };
  const localRequire = (specifier) => {
    if (Object.hasOwn(dependencies, specifier)) return dependencies[specifier];
    return require(specifier);
  };

  new Function('exports', 'require', 'module', '__filename', '__dirname', javascript)(
    moduleObject.exports,
    localRequire,
    moduleObject,
    path,
    process.cwd(),
  );
  return moduleObject.exports;
}

function loadOfflineDownloadRequests() {
  const musicCredits = loadTypeScriptModule('src/utils/musicCredits.ts');
  return loadTypeScriptModule('src/services/offlineDownloadRequests.ts', {
    '@/services/mediaService': {
      mediaService: {
        canResolve: () => false,
        resolve: () => null,
      },
    },
    '@/utils/musicCredits': musicCredits,
  });
}

test('playlist track download requests render with performer credits', () => {
  const { musicTrackDownloadRequest } = loadOfflineDownloadRequests();
  const track = {
    id: 'track-1',
    title: 'Track One',
    subtitle: null,
    durationMs: 120000,
    mediaAsset: {
      id: 'asset-1',
      provider: 'cloudflare_r2',
      bucket: 'music',
      path: 'tracks/track-1.m4a',
    },
    artists: [
      { id: 'artist-1', displayName: 'Cantor One', role: 'primary', sortOrder: 0 },
      { id: 'artist-2', displayName: 'Cantor Two', role: 'featured', sortOrder: 1 },
    ],
  };

  const request = musicTrackDownloadRequest({ track, locale: 'en' });

  assert.equal(request.packageKey, 'music_track:track-1:en');
  assert.equal(request.subtitle, 'Cantor One, Cantor Two');
  assert.deepEqual(request.resources, []);
});

test('track downloads live in the native-only overflow menu', () => {
  const playlistSource = fs.readFileSync('src/app/music/playlist/[id].tsx', 'utf8');
  const menuSource = fs.readFileSync('src/components/music/MusicTrackActionsMenu.tsx', 'utf8');
  const downloadSource = fs.readFileSync('src/components/offline/OfflineDownloadButton.tsx', 'utf8');

  assert.match(playlistSource, /Platform\.OS !== 'web'/);
  assert.match(playlistSource, /packageKey={`music_playlist:\$\{playlist\.id\}:\$\{locale\}`}/);
  assert.doesNotMatch(playlistSource, /packageKey={`music_track:/);
  assert.match(menuSource, /Platform\.OS !== 'web'/);
  assert.match(menuSource, /musicTrackDownloadRequest/);
  assert.match(menuSource, /menuRow/);
  assert.match(downloadSource, /Remove download/);
  // Removing takes every download holding the item, or it would still be saved.
  assert.match(downloadSource, /for \(const key of packageKeys\) await downloadManager\.remove\(key\);/);
});

const holders = loadTypeScriptModule('src/utils/downloadHolders.ts');
const holder = (packageKey, status, extra = {}) => ({ packageKey, entityType: packageKey.split(':')[0], entityId: packageKey.split(':')[1], title: packageKey, status, mediaCount: 1, ...extra });

test("a track's download is the one that has it saved, then one fetching it, then paused, then stopped", () => {
  const ordered = holders.orderHolders([
    holder('music_playlist:mix:en', 'failed'),
    holder('music_release:album:en', 'paused'),
    holder('music_liked_songs:liked-songs:en', 'downloading'),
    holder('music_track:t1:en', 'complete'),
    holder('music_track:t1:en', 'complete'),
  ]);
  assert.deepEqual(ordered.map((item) => item.packageKey), ['music_track:t1:en', 'music_liked_songs:liked-songs:en', 'music_release:album:en', 'music_playlist:mix:en'], 'each once, in that order');
  assert.deepEqual(holders.orderHolders([]), []);
});

test('a single of one track is that track\'s own download; an album, a playlist or Liked Songs holding it is not', () => {
  assert.equal(holders.isOwnTrackHolder(holder('music_track:t1:en', 'complete'), 't1'), true);
  assert.equal(holders.isOwnTrackHolder(holder('music_track:t2:en', 'complete'), 't1'), false);
  assert.equal(holders.isOwnTrackHolder(holder('music_release:single:en', 'complete', { mediaCount: 1 }), 't1'), true);
  assert.equal(holders.isOwnTrackHolder(holder('music_release:album:en', 'complete', { mediaCount: 12 }), 't1'), false);
  assert.equal(holders.isOwnTrackHolder(holder('music_playlist:mix:en', 'complete', { mediaCount: 1 }), 't1'), false);
  // Removing a track takes every download holding it, naming those not its own.
  const removal = holders.removalOf([
    holder('music_release:single:en', 'complete', { title: 'The Single' }),
    holder('music_playlist:mix:en', 'complete', { title: 'Vespers Mix', mediaCount: 20 }),
  ], (item) => holders.isOwnTrackHolder(item, 't1'));
  assert.deepEqual(removal, { packageKeys: ['music_release:single:en', 'music_playlist:mix:en'], others: ['Vespers Mix'] });
});

test('the downloads named are quoted and joined in the App Language, a long list counted after the third', () => {
  assert.equal(holders.quotedList(['Album'], 'en'), '“Album”');
  assert.equal(holders.quotedList(['A', 'B'], 'en'), '“A” and “B”');
  assert.equal(holders.quotedList(['A', 'B', 'C', 'D'], 'en'), '“A”, “B”, “C” and “D”');
  assert.equal(holders.quotedList(['A', 'B', 'C', 'D', 'E'], 'en'), '“A”, “B”, “C” and 2 more');
  assert.equal(holders.quotedList(['A', 'B'], 'fr'), '« A » et « B »');
  assert.equal(holders.quotedList(['A', 'B'], 'ar'), '«A» و«B»');
  assert.equal(holders.quotedList([], 'en'), '');
  // The item a download is of, whatever language it was made in.
  assert.deepEqual(holders.downloadEntityOf('music_release:album-1:ar'), { entityType: 'music_release', entityId: 'album-1' });
  assert.equal(holders.downloadEntityOf('nonsense'), null);
});

test('a single and its only track are one download, saved from either and shown on both', () => {
  const trackDownload = fs.readFileSync('src/components/music/trackDownload.ts', 'utf8');
  // A track not yet saved is downloaded as its release when the release is that one track.
  assert.match(trackDownload, /if \(release && isOneTrackRelease\(release, trackId\)\) return musicReleaseDownloadRequest\(release, locale, \{ \[trackId\]: lyrics \}\);/);
  assert.match(trackDownload, /return Array\.isArray\(release\?\.tracks\) && release\.tracks\.length === 1 && release\.tracks\[0\]\?\.id === trackId;/);
  assert.match(trackDownload, /\(\) => downloadManager\.holdersOf\('music_track', trackId\)/);
  const menu = fs.readFileSync('src/components/music/MusicTrackActionsMenu.tsx', 'utf8');
  assert.match(menu, /const prepareDownload = useCallback\(\(\) => trackDownloadRequest\(item, locale\), \[item, locale\]\);/);
  assert.match(menu, /holders=\{holders\}\s+isOwnHolder=\{isOwnHolder\}/);
  const release = fs.readFileSync('src/app/music/release/[id].tsx', 'utf8');
  assert.match(release, /holders=\{singleTrackId \? singleHolders : undefined\}/);
  // The button shows, and acts on, whichever download holds the item; every
  // other item checks for its own download made in another App Language.
  const button = fs.readFileSync('src/components/offline/OfflineDownloadButton.tsx', 'utf8');
  assert.match(button, /const shown = holding\[0\]\?\.packageKey \?\? packageKey;/);
  assert.match(button, /const holders = givenHolders \?\? sameItem\.holders;/);
  for (const action of ['pause', 'resume', 'retry']) assert.match(button, new RegExp(`await downloadManager\\.${action}\\(target\\);`), action);
  // The holders are found by the file, whatever state each download is in, so one on its way counts too.
  const database = fs.readFileSync('src/services/offlineDatabase.ts', 'utf8');
  assert.match(database, /WHERE f\.playable_kind = \?\s+AND f\.playable_id = \?\s+AND f\.role = 'media'\s+ORDER BY p\.updated_at DESC/);
  // Storage counts each file once.
  const storage = fs.readFileSync('src/services/downloadStorageManager.ts', 'utf8');
  assert.match(storage, /SELECT DISTINCT f\.file_key, p\.domain, f\.bytes_written FROM offline_files f/);
});

test('download routes are absent from the website', () => {
  const downloadsScreen = fs.readFileSync('src/app/downloads.web.tsx', 'utf8');
  const libraryScreen = fs.readFileSync('src/app/music/library.tsx', 'utf8');
  const librarySectionScreen = fs.readFileSync('src/app/music/library/[section].tsx', 'utf8');

  assert.match(downloadsScreen, /<Redirect href=.*\/account/);
  assert.match(libraryScreen, /Platform\.OS !== 'web' \|\| folder\.id !== 'downloads'/);
  assert.match(librarySectionScreen, /isWebDownloadsRoute.*<Redirect href="\/music\/library"/s);
});
