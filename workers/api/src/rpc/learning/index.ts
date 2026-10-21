/** The learning functions the app calls, by "schema.name" (src/rpc/index.ts). */
import type { Args, Rpc } from '../index.ts';
import {
  getLearningHome, getPublishedLearningAlbum, getPublishedLearningCantor, getPublishedLearningHymn, getPublishedLearningItemLyrics,
  getPublishedLearningLessonSet, getPublishedLearningSeason,
} from './catalog.ts';
import { getMyLearningItems, getMyLearningPlaylists, getMyLearningProgress, setLearningItemLiked, setLearningItemProgress, setLearningProgress } from './me.ts';
import { addLearningPlaylistItem, createLearningPlaylist, deleteLearningPlaylist, getLearningPlaylist, removeLearningPlaylistItem, updateLearningPlaylist } from './playlists.ts';

const s = (a: Args, name: string) => a[name] as string;
const n = (a: Args, name: string) => a[name] as string | null;

export const learningRpcs: Record<string, Rpc> = {
  'public.get_learning_home': (c, a) => getLearningHome(c, n(a, 'p_locale')),
  'public.get_published_learning_cantor': (c, a) => getPublishedLearningCantor(c, s(a, 'p_cantor_id'), n(a, 'p_locale')),
  'public.get_published_learning_season': (c, a) => getPublishedLearningSeason(c, s(a, 'p_season_id'), n(a, 'p_locale')),
  'public.get_published_learning_hymn': (c, a) => getPublishedLearningHymn(c, s(a, 'p_hymn_id'), n(a, 'p_locale')),
  'public.get_published_learning_album': (c, a) => getPublishedLearningAlbum(c, s(a, 'p_album_id'), n(a, 'p_locale')),
  'public.get_published_learning_lesson_set': (c, a) => getPublishedLearningLessonSet(c, s(a, 'p_lesson_set_id'), n(a, 'p_locale')),
  'public.get_published_learning_item_lyrics': (c, a) => getPublishedLearningItemLyrics(c, s(a, 'p_item_kind'), s(a, 'p_item_id'), n(a, 'p_locale')),
  'public.get_my_learning_progress': (c, a) => getMyLearningProgress(c, n(a, 'p_locale')),
  'public.get_my_learning_items': (c, a) => getMyLearningItems(c, n(a, 'p_locale')),
  'public.get_my_learning_playlists': (c) => getMyLearningPlaylists(c),
  'public.set_learning_progress': (c, a) => setLearningProgress(c, s(a, 'p_hymn_id'), s(a, 'p_state')),
  'public.set_learning_item_progress': (c, a) => setLearningItemProgress(c, s(a, 'p_item_kind'), s(a, 'p_item_id'), s(a, 'p_state')),
  'public.set_learning_item_liked': (c, a) => setLearningItemLiked(c, s(a, 'p_item_kind'), s(a, 'p_item_id'), a.p_liked as boolean | null),
  'public.get_learning_playlist': (c, a) => getLearningPlaylist(c, s(a, 'p_playlist_id'), n(a, 'p_locale')),
  'public.create_learning_playlist': (c, a) => createLearningPlaylist(c, n(a, 'p_name'), n(a, 'p_description'), n(a, 'p_visibility')),
  'public.update_learning_playlist': (c, a) => updateLearningPlaylist(c, s(a, 'p_playlist_id'), n(a, 'p_name'), n(a, 'p_description'), n(a, 'p_visibility')),
  'public.delete_learning_playlist': (c, a) => deleteLearningPlaylist(c, s(a, 'p_playlist_id')),
  'public.add_learning_playlist_item': (c, a) => addLearningPlaylistItem(c, s(a, 'p_playlist_id'), s(a, 'p_item_kind'), n(a, 'p_album_recording_id'), n(a, 'p_lesson_id')),
  'public.remove_learning_playlist_item': (c, a) => removeLearningPlaylistItem(c, s(a, 'p_playlist_id'), s(a, 'p_item_id')),
};
