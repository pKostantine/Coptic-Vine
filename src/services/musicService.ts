import { mediaService } from '@/services/mediaService';
import { getOfflineSnapshot } from '@/services/offlineSnapshotStore';
import type {
  MusicConsumerArtist,
  MusicConsumerAsset,
  MusicConsumerRelease,
  MusicConsumerTrackDetail,
  MusicHomePayload,
  MusicLibraryPayload,
  MusicPlaylistPayload,
  MusicSearchPayload,
  PublishedTrackLyricsPayload,
} from '@/types/musicConsumer';
import type { MusicLyricKind, MusicPlaylistVisibility } from '@/types/mediaPlatform';
import { unifiedSearchService } from '@/services/unifiedSearchService';
import { api } from '@/utils/api';
import { createSessionCache } from '@/utils/sessionCache';

// Kept for the session, so a page opened again draws at once while it is
// read afresh (utils/sessionCache.ts). The library is the listener's own:
// anything that changes it here forgets it, as does signing in or out.
const homeCache = createSessionCache<MusicHomePayload>();
const releaseCache = createSessionCache<MusicConsumerRelease>();
const artistCache = createSessionCache<MusicConsumerArtist>();
const libraryCache = createSessionCache<MusicLibraryPayload>();

/** A change to the listener's library: the kept copy is forgotten once it is made (or fails). */
function changesLibrary<Args extends unknown[], Result>(change: (...args: Args) => Promise<Result>) {
  return async (...args: Args): Promise<Result> => {
    try {
      return await change(...args);
    } finally {
      libraryCache.clear();
    }
  };
}

function assertRpcData<T>(data: T | null, error: { message: string } | null, operation: string): T {
  if (error) {
    throw new Error(`${operation}: ${error.message}`);
  }
  if (data == null) {
    throw new Error(`${operation}: no data returned.`);
  }
  return data;
}

async function offlineFallback<T>(
  operation: () => Promise<T>,
  entityType: 'music_release' | 'music_playlist' | 'music_library' | 'music_lyrics',
  entityId: string,
  locale: string,
): Promise<T> {
  try {
    return await operation();
  } catch (cause) {
    const offline = await getOfflineSnapshot<T>(entityType, entityId, locale);
    if (offline) return offline;
    throw cause;
  }
}

export function resolveMusicAsset(asset: MusicConsumerAsset | null | undefined): string | null {
  if (!asset || !mediaService.canResolve(asset)) return null;
  return mediaService.resolve(asset);
}

export async function getMusicHome(locale = 'en'): Promise<MusicHomePayload> {
  return homeCache.load(locale, async () => {
    const { data, error } = await api.rpc('get_music_home', { p_locale: locale });
    return assertRpcData(data as MusicHomePayload | null, error, 'Load music home');
  });
}

export async function getMusicRelease(releaseId: string, locale = 'en'): Promise<MusicConsumerRelease> {
  return releaseCache.load(`${releaseId}:${locale}`, () => offlineFallback(async () => {
    const { data, error } = await api.rpc('get_published_music_release_for_locale', {
      p_release_id: releaseId,
      p_locale: locale,
    });
    return assertRpcData(data as MusicConsumerRelease | null, error, 'Load release');
  }, 'music_release', releaseId, locale));
}

export async function getMusicArtist(artistId: string, locale = 'en'): Promise<MusicConsumerArtist> {
  return artistCache.load(`${artistId}:${locale}`, async () => {
    const { data, error } = await api.rpc('get_published_music_artist', {
      p_artist_id: artistId,
      p_locale: locale,
    });
    return assertRpcData(data as MusicConsumerArtist | null, error, 'Load artist');
  });
}

export async function getMusicTrack(trackId: string, locale = 'en'): Promise<MusicConsumerTrackDetail> {
  const { data, error } = await api.rpc('get_published_music_track_for_locale', {
    p_track_id: trackId,
    p_locale: locale,
  });
  return assertRpcData(data as MusicConsumerTrackDetail | null, error, 'Load track');
}

export async function getMusicArtistSearchArt(artistId: string): Promise<MusicConsumerAsset | null> {
  const { data, error } = await api.rpc('get_music_artist_search_art', {
    p_artist_id: artistId,
  });
  if (error) throw new Error('Load artist search artwork: ' + error.message);
  return data as MusicConsumerAsset | null;
}

export async function searchMusic(query: string, locale = 'en'): Promise<MusicSearchPayload> {
  const normalized = query.trim();
  if (!normalized) return { artists: [], releases: [], tracks: [] };

  const { results } = await unifiedSearchService.search(normalized, locale, 'music');
  return {
    artists: results.flatMap((result) => result.kind === 'music_artist' ? [{
      id: result.entityId,
      displayName: result.title,
      biography: result.body,
      profileImageAsset: result.metadata.profileImageAsset,
    }] : []),
    releases: results.flatMap((result) => result.kind === 'music_release' ? [{
      id: result.entityId,
      title: result.title,
      subtitle: result.subtitle,
      releaseType: result.metadata.releaseType,
      releaseDate: result.metadata.releaseDate,
      primaryArtist: result.metadata.primaryArtist,
      coverAsset: result.metadata.coverAsset,
    }] : []),
    tracks: results.flatMap((result) => result.kind === 'music_track' ? [{
      id: result.entityId,
      title: result.title,
      subtitle: result.subtitle,
      durationMs: result.metadata.durationMs,
      releaseId: result.metadata.releaseId,
      mediaAsset: result.metadata.mediaAsset,
      artists: result.metadata.artists,
    }] : []),
  };
}

export async function getMusicLibrary(locale = 'en'): Promise<MusicLibraryPayload> {
  return libraryCache.load(locale, () => offlineFallback(async () => {
    const { data, error } = await api.rpc('get_my_music_library', { p_locale: locale });
    const library = assertRpcData(data as MusicLibraryPayload | null, error, 'Load music library');
    return {
      ...library,
      followedArtists: library.followedArtists ?? [],
      likedReleases: library.likedReleases ?? [],
      likedTracks: library.likedTracks ?? [],
      playlists: library.playlists ?? [],
      recentTracks: library.recentTracks ?? [],
      recentReleases: library.recentReleases ?? [],
    };
  }, 'music_library', 'library', locale));
}

export async function getMusicPlaylist(playlistId: string, locale = 'en'): Promise<MusicPlaylistPayload> {
  return offlineFallback(async () => {
    const { data, error } = await api.rpc('get_music_playlist', {
      p_playlist_id: playlistId,
      p_locale: locale,
    });
    return assertRpcData(data as MusicPlaylistPayload | null, error, 'Load playlist');
  }, 'music_playlist', playlistId, locale);
}

export async function setTrackLiked(trackId: string, liked: boolean): Promise<boolean> {
  const { data, error } = await api.rpc('set_track_liked', { p_track_id: trackId, p_liked: liked });
  return assertRpcData(data as boolean | null, error, liked ? 'Like track' : 'Unlike track');
}

export async function getReleaseLiked(releaseId: string): Promise<boolean> {
  const { data, error } = await api.rpc('get_release_liked', { p_release_id: releaseId });
  return assertRpcData(data as boolean | null, error, 'Load release like');
}

export async function getArtistFollowed(artistId: string): Promise<boolean> {
  const { data, error } = await api.rpc('get_artist_followed', { p_artist_id: artistId });
  return assertRpcData(data as boolean | null, error, 'Load artist follow');
}

export async function setArtistFollowed(artistId: string, followed: boolean): Promise<boolean> {
  const { data, error } = await api.rpc('set_artist_followed', {
    p_artist_id: artistId,
    p_followed: followed,
  });
  return assertRpcData(data as boolean | null, error, followed ? 'Follow artist' : 'Unfollow artist');
}

export async function setReleaseLiked(releaseId: string, liked: boolean): Promise<boolean> {
  const { data, error } = await api.rpc('set_release_liked', { p_release_id: releaseId, p_liked: liked });
  return assertRpcData(data as boolean | null, error, liked ? 'Like release' : 'Unlike release');
}

export async function createMusicPlaylist(
  name: string,
  description?: string | null,
  visibility: MusicPlaylistVisibility = 'private',
): Promise<string> {
  const { data, error } = await api.rpc('create_music_playlist', {
    p_name: name,
    p_description: description ?? null,
    p_visibility: visibility,
  });
  return assertRpcData(data as string | null, error, 'Create playlist');
}

export async function addTrackToMusicPlaylist(playlistId: string, trackId: string): Promise<boolean> {
  const { data, error } = await api.rpc('add_track_to_music_playlist', {
    p_playlist_id: playlistId,
    p_track_id: trackId,
  });
  return assertRpcData(data as boolean | null, error, 'Add track to playlist');
}

export async function removeTrackFromMusicPlaylist(playlistId: string, trackId: string): Promise<boolean> {
  const { data, error } = await api.rpc('remove_track_from_music_playlist', {
    p_playlist_id: playlistId,
    p_track_id: trackId,
  });
  return assertRpcData(data as boolean | null, error, 'Remove track from playlist');
}

export async function updateMusicPlaylist(
  playlistId: string,
  name: string,
  description: string | null,
  visibility: MusicPlaylistVisibility,
): Promise<boolean> {
  const { data, error } = await api.rpc('update_music_playlist', {
    p_playlist_id: playlistId,
    p_name: name,
    p_description: description,
    p_visibility: visibility,
  });
  return assertRpcData(data as boolean | null, error, 'Update playlist');
}

export async function deleteMusicPlaylist(playlistId: string): Promise<boolean> {
  const { data, error } = await api.rpc('delete_music_playlist', { p_playlist_id: playlistId });
  return assertRpcData(data as boolean | null, error, 'Delete playlist');
}

export async function setMusicPlaylistTrackOrder(playlistId: string, trackIds: string[]): Promise<boolean> {
  const { data, error } = await api.rpc('set_music_playlist_track_order', {
    p_playlist_id: playlistId,
    p_track_ids: trackIds,
  });
  return assertRpcData(data as boolean | null, error, 'Reorder playlist');
}

export async function recordMusicPlay(trackId: string, releaseId?: string | null): Promise<boolean> {
  const { data, error } = await api.rpc('record_music_play', {
    p_track_id: trackId,
    p_release_id: releaseId ?? null,
  });
  return assertRpcData(data as boolean | null, error, 'Record music play');
}

export async function getTrackLyrics(
  trackId: string,
  locale?: string | null,
  kind?: MusicLyricKind | null,
): Promise<PublishedTrackLyricsPayload> {
  const requestedLocale = locale ?? 'en';
  return offlineFallback(async () => {
    const { data, error } = await api.rpc('get_published_track_lyrics', {
      p_track_id: trackId,
      p_locale: locale ?? null,
      p_kind: kind ?? null,
    });
    return assertRpcData(data as PublishedTrackLyricsPayload | null, error, 'Load synchronized lyrics');
  }, 'music_lyrics', trackId, requestedLocale);
}

export const musicService = {
  getHome: getMusicHome,
  /** What getHome last answered this session, to draw at once: null before it has. */
  peekHome: (locale = 'en') => homeCache.peek(locale),
  getRelease: getMusicRelease,
  peekRelease: (releaseId: string, locale = 'en') => releaseCache.peek(`${releaseId}:${locale}`),
  getArtist: getMusicArtist,
  peekArtist: (artistId: string, locale = 'en') => artistCache.peek(`${artistId}:${locale}`),
  getTrack: getMusicTrack,
  getArtistSearchArt: getMusicArtistSearchArt,
  search: searchMusic,
  getLibrary: getMusicLibrary,
  peekLibrary: (locale = 'en') => libraryCache.peek(locale),
  getPlaylist: getMusicPlaylist,
  setLiked: changesLibrary(setTrackLiked),
  getReleaseLiked,
  setReleaseLiked: changesLibrary(setReleaseLiked),
  getArtistFollowed,
  setArtistFollowed: changesLibrary(setArtistFollowed),
  createPlaylist: changesLibrary(createMusicPlaylist),
  updatePlaylist: changesLibrary(updateMusicPlaylist),
  deletePlaylist: changesLibrary(deleteMusicPlaylist),
  setPlaylistTrackOrder: changesLibrary(setMusicPlaylistTrackOrder),
  recordPlay: recordMusicPlay,
  addToPlaylist: changesLibrary(addTrackToMusicPlaylist),
  removeFromPlaylist: changesLibrary(removeTrackFromMusicPlaylist),
  getLyrics: getTrackLyrics,
  resolveAsset: resolveMusicAsset,
} as const;
