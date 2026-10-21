/** The music functions the app calls, by "schema.name" (src/rpc/index.ts). */
import type { Args, Rpc } from '../index.ts';
import {
  getMusicArtistSearchArt, getMusicHome, getPublishedMusicArtist, getPublishedMusicReleaseForLocale, getPublishedMusicTrackForLocale, getPublishedTrackLyrics,
} from './catalog.ts';
import { getArtistFollowed, getMyMusicLibrary, getReleaseLiked, recordMusicPlay, setArtistFollowed, setReleaseLiked, setTrackLiked } from './library.ts';
import {
  addTrackToMusicPlaylist, clearMusicPlaylistCover, createMusicPlaylist, setMusicPlaylistCover, deleteMusicPlaylist, getMusicPlaylist, removeTrackFromMusicPlaylist,
  setMusicPlaylistTrackOrder, updateMusicPlaylist,
} from './playlists.ts';

const s = (a: Args, name: string) => a[name] as string;
const n = (a: Args, name: string) => a[name] as string | null;

export const musicRpcs: Record<string, Rpc> = {
  'public.get_music_home': (c, a) => getMusicHome(c, n(a, 'p_locale')),
  'public.get_published_music_artist': (c, a) => getPublishedMusicArtist(c, s(a, 'p_artist_id'), n(a, 'p_locale')),
  'public.get_published_music_release_for_locale': (c, a) => getPublishedMusicReleaseForLocale(c, s(a, 'p_release_id'), n(a, 'p_locale')),
  'public.get_published_music_track_for_locale': (c, a) => getPublishedMusicTrackForLocale(c, s(a, 'p_track_id'), n(a, 'p_locale')),
  'public.get_music_artist_search_art': (c, a) => getMusicArtistSearchArt(c, s(a, 'p_artist_id')),
  'public.get_published_track_lyrics': (c, a) => getPublishedTrackLyrics(c, s(a, 'p_track_id'), n(a, 'p_locale'), n(a, 'p_kind')),
  'public.get_my_music_library': (c, a) => getMyMusicLibrary(c, n(a, 'p_locale')),
  'public.get_release_liked': (c, a) => getReleaseLiked(c, s(a, 'p_release_id')),
  'public.get_artist_followed': (c, a) => getArtistFollowed(c, s(a, 'p_artist_id')),
  'public.set_track_liked': (c, a) => setTrackLiked(c, s(a, 'p_track_id'), a.p_liked as boolean | null),
  'public.set_artist_followed': (c, a) => setArtistFollowed(c, s(a, 'p_artist_id'), a.p_followed as boolean | null),
  'public.set_release_liked': (c, a) => setReleaseLiked(c, s(a, 'p_release_id'), a.p_liked as boolean | null),
  'public.record_music_play': (c, a) => recordMusicPlay(c, s(a, 'p_track_id'), n(a, 'p_release_id')),
  'public.get_music_playlist': (c, a) => getMusicPlaylist(c, s(a, 'p_playlist_id'), n(a, 'p_locale')),
  'public.create_music_playlist': (c, a) => createMusicPlaylist(c, n(a, 'p_name'), n(a, 'p_description'), n(a, 'p_visibility')),
  'public.update_music_playlist': (c, a) => updateMusicPlaylist(c, s(a, 'p_playlist_id'), n(a, 'p_name'), n(a, 'p_description'), n(a, 'p_visibility')),
  'public.delete_music_playlist': (c, a) => deleteMusicPlaylist(c, s(a, 'p_playlist_id')),
  'public.add_track_to_music_playlist': (c, a) => addTrackToMusicPlaylist(c, s(a, 'p_playlist_id'), s(a, 'p_track_id')),
  'public.remove_track_from_music_playlist': (c, a) => removeTrackFromMusicPlaylist(c, s(a, 'p_playlist_id'), s(a, 'p_track_id')),
  'public.set_music_playlist_track_order': (c, a) => setMusicPlaylistTrackOrder(c, s(a, 'p_playlist_id'), a.p_track_ids as (string | null)[] | null),
  'public.clear_music_playlist_cover': (c, a) => clearMusicPlaylistCover(c, s(a, 'p_playlist_id')),
  'public.set_music_playlist_cover': (c, a) => setMusicPlaylistCover(c, s(a, 'p_playlist_id')),
};
