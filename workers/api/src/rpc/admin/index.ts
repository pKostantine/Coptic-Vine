/** CV-Admin's functions, by "schema.name" (src/rpc/index.ts). */
import type { Args, Rpc } from '../index.ts';
import {
  getAdminArtistProfile, getAdminArtists, getAdminCreatorArtistClaims, getAdminNotificationBroadcastOverview, getAdminProcessingJobs, getAdminPublicationOverview,
  getAdminReviewQueue, getAdminSubmissionDetail, isChcAdmin,
} from './reads.ts';
import {
  adminDeleteCatalogItem, adminSendNotificationBroadcast, adminSendNotificationTest, adminUpdateMusicReleaseDates, confirmAdminCreatorArtistClaim, deleteAdminMusicRelease,
  deleteAdminMusicReleaseTrack, forceMediaProcessingJob, forcePendingMediaProcessingJobs, forceSubmissionMediaProcessing, publishLearningAlbum, publishLearningLessonSet,
  publishMediaSubmission, publishMusicRelease, retryMediaProcessingJob, reviewMediaSubmission, updateAdminArtistProfile,
} from './writes.ts';

const s = (a: Args, name: string) => a[name] as string;
const n = (a: Args, name: string) => a[name] as string | null;
const num = (a: Args, name: string) => a[name] as number | null;
const list = (a: Args, name: string) => a[name] as (string | null)[] | null;
const bool = (a: Args, name: string) => a[name] as boolean | null;

export const adminRpcs: Record<string, Rpc> = {
  'public.is_chc_admin': (c) => isChcAdmin(c),
  'public.get_admin_review_queue': (c, a) => getAdminReviewQueue(c, list(a, 'p_statuses')),
  'public.get_admin_submission_detail': (c, a) => getAdminSubmissionDetail(c, s(a, 'p_submission_id')),
  'public.get_admin_publication_overview': (c) => getAdminPublicationOverview(c),
  'public.get_admin_processing_jobs': (c) => getAdminProcessingJobs(c),
  'public.get_admin_artists': (c, a) => getAdminArtists(c, n(a, 'p_search')),
  'public.get_admin_artist_profile': (c, a) => getAdminArtistProfile(c, s(a, 'p_artist_id')),
  'public.get_admin_creator_artist_claims': (c, a) => getAdminCreatorArtistClaims(c, s(a, 'p_submission_id')),
  'public.get_admin_notification_broadcast_overview': (c, a) => getAdminNotificationBroadcastOverview(c, n(a, 'p_category'), num(a, 'p_history_limit')),
  'public.review_media_submission': (c, a) => reviewMediaSubmission(c, s(a, 'p_submission_id'), n(a, 'p_action'), n(a, 'p_notes')),
  'public.publish_media_submission': (c, a) => publishMediaSubmission(c, s(a, 'p_submission_id')),
  'public.publish_music_release': (c, a) => publishMusicRelease(c, s(a, 'p_release_id')),
  'public.publish_learning_album': (c, a) => publishLearningAlbum(c, s(a, 'p_album_id')),
  'public.publish_learning_lesson_set': (c, a) => publishLearningLessonSet(c, s(a, 'p_lesson_set_id')),
  'public.admin_update_music_release_dates': (c, a) => adminUpdateMusicReleaseDates(c, {
    releaseId: s(a, 'p_release_id'), scheduledReleaseAt: n(a, 'p_scheduled_release_at'), originalReleaseDate: n(a, 'p_original_release_date'),
    clearScheduled: bool(a, 'p_clear_scheduled_release_at'), clearOriginal: bool(a, 'p_clear_original_release_date'),
  }),
  'public.admin_delete_catalog_item': (c, a) => adminDeleteCatalogItem(c, n(a, 'p_kind'), s(a, 'p_id')),
  'public.delete_admin_music_release': (c, a) => deleteAdminMusicRelease(c, s(a, 'p_release_id')),
  'public.delete_admin_music_release_track': (c, a) => deleteAdminMusicReleaseTrack(c, s(a, 'p_release_id'), s(a, 'p_track_id')),
  'public.confirm_admin_creator_artist_claim': (c, a) => confirmAdminCreatorArtistClaim(c, s(a, 'p_submission_id'), s(a, 'p_existing_artist_id')),
  'public.update_admin_artist_profile': (c, a) => updateAdminArtistProfile(c, {
    artistId: s(a, 'p_artist_id'), displayName: n(a, 'p_display_name'), biography: n(a, 'p_biography'), socialLinks: a.p_social_links, profileIntent: n(a, 'p_profile_image_upload_intent_id'),
  }),
  'public.force_media_processing_job': (c, a) => forceMediaProcessingJob(c, s(a, 'p_job_id')),
  'public.force_pending_media_processing_jobs': (c) => forcePendingMediaProcessingJobs(c),
  'public.force_submission_media_processing': (c, a) => forceSubmissionMediaProcessing(c, s(a, 'p_submission_id')),
  'public.retry_media_processing_job': (c, a) => retryMediaProcessingJob(c, s(a, 'p_job_id')),
  'public.admin_send_notification_test': (c, a) => adminSendNotificationTest(c, n(a, 'p_title'), n(a, 'p_body'), n(a, 'p_deep_link')),
  'public.admin_send_notification_broadcast': (c, a) => adminSendNotificationBroadcast(c, {
    category: n(a, 'p_category'), title: n(a, 'p_title'), body: n(a, 'p_body'), deepLink: n(a, 'p_deep_link'), payload: a.p_payload,
  }),
};
