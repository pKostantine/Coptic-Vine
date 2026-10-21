/** The functions the other Workers call (the media processor, the upload authorizer, the web app's link previews), by "schema.name" (src/rpc/index.ts). */
import type { Args, Rpc } from '../index.ts';
import {
  claimCompanionMediaProcessingJob, claimMediaOriginalDeletion, claimMediaProcessingJob, completeMediaProcessingJob, failMediaProcessingJob, heartbeatMediaProcessingJobs,
  mediaProcessingQueueHasWork, releaseMediaProcessingJobs, skipMediaProcessingJob,
} from './media.ts';
import { getMusicPlaylistSharePreview, getSharePreview } from './share.ts';
import { completeMediaUploadIntent, createMediaUploadIntent, getAdminSubmissionPreviewItem, getMediaUploadIntentForUpload } from './uploads.ts';

const s = (a: Args, name: string) => a[name] as string;
const n = (a: Args, name: string) => a[name] as string | null;
const num = (a: Args, name: string) => a[name] as number | null;
const list = (a: Args, name: string) => a[name] as (string | null)[] | null;
const token = (a: Args) => n(a, 'p_worker_token');

export const workerRpcs: Record<string, Rpc> = {
  'public.claim_media_processing_job': (c, a) => claimMediaProcessingJob(c, token(a), n(a, 'p_worker_id')),
  'public.claim_companion_media_processing_job': (c, a) => claimCompanionMediaProcessingJob(c, token(a), s(a, 'p_job_id'), n(a, 'p_worker_id')),
  'public.heartbeat_media_processing_jobs': (c, a) => heartbeatMediaProcessingJobs(c, token(a), list(a, 'p_job_ids'), num(a, 'p_progress')),
  'public.complete_media_processing_job': (c, a) => completeMediaProcessingJob(c, {
    token: token(a), jobId: s(a, 'p_job_id'), mimeType: n(a, 'p_output_mime_type'), sizeBytes: num(a, 'p_output_size_bytes'), checksum: n(a, 'p_output_checksum_sha256'), probe: a.p_probe,
  }),
  'public.fail_media_processing_job': (c, a) => failMediaProcessingJob(c, token(a), s(a, 'p_job_id'), n(a, 'p_error_message')),
  'public.skip_media_processing_job': (c, a) => skipMediaProcessingJob(c, token(a), s(a, 'p_job_id'), n(a, 'p_reason')),
  'public.release_media_processing_jobs': (c, a) => releaseMediaProcessingJobs(c, token(a), list(a, 'p_job_ids'), n(a, 'p_reason')),
  'public.claim_media_original_deletion': (c, a) => claimMediaOriginalDeletion(c, token(a), s(a, 'p_upload_intent_id')),
  'public.media_processing_queue_has_work': (c, a) => mediaProcessingQueueHasWork(c, token(a)),
  'public.create_media_upload_intent': (c, a) => createMediaUploadIntent(c, {
    accountId: n(a, 'p_creator_account_id'), filename: n(a, 'p_original_filename'), contentType: n(a, 'p_content_type'), contentLength: num(a, 'p_content_length'),
    mediaType: n(a, 'p_media_type'), checksum: n(a, 'p_checksum_sha256'),
  }),
  'public.get_media_upload_intent_for_upload': (c, a) => getMediaUploadIntentForUpload(c, s(a, 'p_upload_intent_id')),
  'public.complete_media_upload_intent': (c, a) => completeMediaUploadIntent(c, s(a, 'p_upload_intent_id'), num(a, 'p_uploaded_size'), n(a, 'p_r2_http_etag')),
  'public.get_admin_submission_preview_item': (c, a) => getAdminSubmissionPreviewItem(c, s(a, 'p_item_id')),
  'public.get_share_preview': (c, a) => getSharePreview(c, n(a, 'p_path'), n(a, 'p_locale')),
  'public.get_music_playlist_share_preview': (c, a) => getMusicPlaylistSharePreview(c, s(a, 'p_playlist_id')),
};
