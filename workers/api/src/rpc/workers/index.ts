/** The functions the other Workers call (the media processor), by "schema.name" (src/rpc/index.ts). */
import type { Args, Rpc } from '../index.ts';
import {
  claimCompanionMediaProcessingJob, claimMediaOriginalDeletion, claimMediaProcessingJob, completeMediaProcessingJob, failMediaProcessingJob, heartbeatMediaProcessingJobs,
  mediaProcessingQueueHasWork, releaseMediaProcessingJobs, skipMediaProcessingJob,
} from './media.ts';

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
};
