/** The creator editor's functions (CV-Artists, and CV-Admin's editor), by "schema.name" (src/rpc/index.ts). */
import type { Args, Rpc } from '../index.ts';
import {
  findReusableUploadedMediaIntent, getCreatorArtistProfile, getCreatorCatalogOptions, getCreatorCreditOptions, getCreatorDashboard, getCreatorRelease,
  getCreatorReleases, getCreatorSubmissionItems, getCreatorWorkspaces, getSubmissionEditor, searchCreatorContributors,
} from './reads.ts';
import {
  getLearningLyricEditorItems, getLearningLyricLanguageDraft, getLyricEditorTracks, getTrackLyricLanguageDraft, publishLearningLyricLanguages, publishTrackLyricLanguagesV2,
  saveLearningLyricStudioDraft, saveTrackLyricLanguageDraft, saveTrackLyricStudioDraftV2,
} from './lyrics.ts';

const s = (a: Args, name: string) => a[name] as string;
const n = (a: Args, name: string) => a[name] as string | null;
const num = (a: Args, name: string) => a[name] as number | null;
const list = (a: Args, name: string) => a[name] as (string | null)[] | null;

export const creatorRpcs: Record<string, Rpc> = {
  'public.get_creator_workspaces': (c) => getCreatorWorkspaces(c),
  'public.get_creator_dashboard': (c, a) => getCreatorDashboard(c, s(a, 'p_creator_account_id')),
  'public.get_creator_catalog_options': (c) => getCreatorCatalogOptions(c),
  'public.get_creator_credit_options': (c, a) => getCreatorCreditOptions(c, s(a, 'p_creator_account_id')),
  'public.get_creator_artist_profile': (c, a) => getCreatorArtistProfile(c, s(a, 'p_creator_account_id')),
  'public.get_creator_releases': (c, a) => getCreatorReleases(c, s(a, 'p_creator_account_id')),
  'public.get_creator_release': (c, a) => getCreatorRelease(c, s(a, 'p_release_id')),
  'public.get_creator_submission_items': (c, a) => getCreatorSubmissionItems(c, s(a, 'p_submission_id')),
  'public.get_submission_editor': (c, a) => getSubmissionEditor(c, s(a, 'p_submission_id')),
  'public.search_creator_contributors': (c, a) => searchCreatorContributors(c, s(a, 'p_creator_account_id'), n(a, 'p_query'), n(a, 'p_kind'), num(a, 'p_limit')),
  'public.find_reusable_uploaded_media_intent': (c, a) => findReusableUploadedMediaIntent(c, s(a, 'p_creator_account_id'), n(a, 'p_original_filename'), num(a, 'p_content_length'), n(a, 'p_media_type')),
  'public.get_lyric_editor_tracks': (c) => getLyricEditorTracks(c),
  'public.get_track_lyric_language_draft': (c, a) => getTrackLyricLanguageDraft(c, s(a, 'p_track_id'), n(a, 'p_locale')),
  'public.save_track_lyric_language_draft': (c, a) => saveTrackLyricLanguageDraft(c, s(a, 'p_track_id'), n(a, 'p_locale'), n(a, 'p_description'), a.p_lines),
  'public.save_track_lyric_studio_draft_v2': (c, a) => saveTrackLyricStudioDraftV2(c, s(a, 'p_track_id'), n(a, 'p_sync_precision'), a.p_languages),
  'public.publish_track_lyric_languages_v2': (c, a) => publishTrackLyricLanguagesV2(c, s(a, 'p_track_id'), list(a, 'p_locales'), n(a, 'p_sync_precision')),
  'public.get_learning_lyric_editor_items': (c) => getLearningLyricEditorItems(c),
  'public.get_learning_lyric_language_draft': (c, a) => getLearningLyricLanguageDraft(c, s(a, 'p_item_kind'), s(a, 'p_item_id'), n(a, 'p_locale')),
  'public.save_learning_lyric_studio_draft': (c, a) => saveLearningLyricStudioDraft(c, s(a, 'p_item_kind'), s(a, 'p_item_id'), n(a, 'p_sync_precision'), a.p_languages),
  'public.publish_learning_lyric_languages': (c, a) => publishLearningLyricLanguages(c, s(a, 'p_item_kind'), s(a, 'p_item_id'), n(a, 'p_sync_precision'), list(a, 'p_locales')),
};
