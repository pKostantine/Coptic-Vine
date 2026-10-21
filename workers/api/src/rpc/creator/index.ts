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
import { saveSubmissionEdit } from './edits.ts';
import { createCreatorSubmissionV3, updateCreatorReleaseV3 } from './submissions.ts';
import {
  addMediaSubmissionItem, createCreatorArtist, createCreatorCantor, createCreatorHymn, deleteCreatorMusicRelease, deleteCreatorMusicReleaseTrack, deleteSubmission,
  enqueueMediaProcessingJob, ensureCreatorWorkspace, submitMediaSubmission, updateCreatorArtistProfile,
} from './writes.ts';

const s = (a: Args, name: string) => a[name] as string;
const n = (a: Args, name: string) => a[name] as string | null;
const num = (a: Args, name: string) => a[name] as number | null;
const list = (a: Args, name: string) => a[name] as (string | null)[] | null;
const bool = (a: Args, name: string) => a[name] as boolean | null;

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
  'public.ensure_creator_workspace': (c, a) => ensureCreatorWorkspace(c, n(a, 'p_display_name')),
  'public.create_creator_artist': (c, a) => createCreatorArtist(c, s(a, 'p_creator_account_id'), n(a, 'p_display_name')),
  'public.create_creator_cantor': (c, a) => createCreatorCantor(c, s(a, 'p_creator_account_id'), n(a, 'p_display_name'), n(a, 'p_contributor_type')),
  'public.create_creator_hymn': (c, a) => createCreatorHymn(c, s(a, 'p_creator_account_id'), n(a, 'p_title')),
  'public.update_creator_artist_profile': (c, a) => updateCreatorArtistProfile(c, {
    accountId: s(a, 'p_creator_account_id'), displayName: n(a, 'p_display_name'), sortName: n(a, 'p_sort_name'), biography: n(a, 'p_biography'),
    socialLinks: a.p_social_links, pinned: list(a, 'p_pinned_release_ids'), profileIntent: n(a, 'p_profile_image_upload_intent_id'),
  }),
  'public.enqueue_media_processing_job': (c, a) => enqueueMediaProcessingJob(c, n(a, 'p_upload_intent_id'), n(a, 'p_job_type'), n(a, 'p_output_bucket')),
  'public.add_media_submission_item': (c, a) => addMediaSubmissionItem(c, {
    submissionId: s(a, 'p_submission_id'), intentId: n(a, 'p_upload_intent_id'), assetId: n(a, 'p_media_asset_id'), title: n(a, 'p_title'), sortOrder: num(a, 'p_sort_order'),
    required: bool(a, 'p_required'), role: n(a, 'p_role'),
  }),
  'public.submit_media_submission': (c, a) => submitMediaSubmission(c, s(a, 'p_submission_id')),
  'public.delete_submission': (c, a) => deleteSubmission(c, s(a, 'p_submission_id')),
  'public.delete_creator_music_release': (c, a) => deleteCreatorMusicRelease(c, s(a, 'p_release_id')),
  'public.delete_creator_music_release_track': (c, a) => deleteCreatorMusicReleaseTrack(c, s(a, 'p_release_id'), s(a, 'p_track_id')),
  'public.create_creator_submission_v3': (c, a) => createCreatorSubmissionV3(c, {
    accountId: s(a, 'p_creator_account_id'), mode: n(a, 'p_mode'), title: n(a, 'p_title'), description: n(a, 'p_description'), releaseType: n(a, 'p_release_type'),
    musicType: n(a, 'p_music_type'), recordingType: n(a, 'p_recording_type'), artistId: n(a, 'p_artist_id'), cantorId: n(a, 'p_cantor_id'), seasonId: n(a, 'p_season_id'),
    hymnId: n(a, 'p_hymn_id'), localizedTitles: a.p_localized_titles, items: a.p_items, timing: n(a, 'p_release_timing_mode'), scheduledAt: n(a, 'p_scheduled_release_at'),
    originalDate: n(a, 'p_original_release_date'),
  }),
  'public.update_creator_release_v3': (c, a) => updateCreatorReleaseV3(c, {
    releaseId: s(a, 'p_release_id'), title: n(a, 'p_title'), description: n(a, 'p_description'), timing: n(a, 'p_release_timing_mode'), scheduledAt: n(a, 'p_scheduled_release_at'),
    originalDate: n(a, 'p_original_release_date'), clearOriginalDate: bool(a, 'p_clear_original_release_date'), localizedTitles: a.p_localized_titles, musicType: n(a, 'p_music_type'),
    recordingType: n(a, 'p_recording_type'), tracks: a.p_tracks, coverIntent: n(a, 'p_cover_upload_intent_id'),
  }),
  'public.save_submission_edit': (c, a) => saveSubmissionEdit(c, s(a, 'p_submission_id'), a.p_edit),
};
