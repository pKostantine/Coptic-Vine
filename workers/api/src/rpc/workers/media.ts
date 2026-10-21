/**
 * The media processor's queue: ports of public.claim_media_processing_job,
 * claim_companion_media_processing_job, heartbeat_media_processing_jobs,
 * complete_media_processing_job, fail_media_processing_job,
 * skip_media_processing_job, release_media_processing_jobs,
 * claim_media_original_deletion and media_processing_queue_has_work, with
 * private.settle_submission_processing (schema/pg-user-schema.sql). The
 * processor proves itself with its worker token, checked against the hashes
 * in "private.media_worker_tokens" (private.verify_media_worker_token).
 * Checked by tests/media.parity.test.ts.
 */
import { col, t } from '../../../../content-api/src/db/names.ts';
import { transaction, type Tx } from '../../db/transaction.ts';
import { jsonbText, raise } from '../../pg.ts';
import type { ApiContext } from '../../rest/context.ts';
import {
  addEvent, addHours, arrow, arrowText, attachCompletedJobs, cleanText, musicSubmissionHasPendingEdits, outputPath, requiredReady, SKIPPED, STALE, staleSince, trimSpaces,
} from '../creator/core.ts';
import { applyLearningEdits, publishMusicSubmission } from '../creator/publish.ts';
import type { Row } from '../creator/shared.ts';

const JOBS = t('media', 'media_processing_jobs');
const INTENTS = t('media', 'upload_intents');
const ITEMS = t('media', 'submission_items');
const ASSETS = t('media', 'media_assets');
const VERSIONS = t('media', 'media_asset_versions');
const SUBMISSIONS = t('media', 'submissions');

/** left(text, n): the first n characters, not UTF-16 units. */
const left = (text: string, n: number) => [...text].slice(0, n).join('');
const IDS = `(SELECT value FROM json_each(?))`;

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** private.verify_media_worker_token, refusing as each function does. */
async function verifyWorker(tx: Tx, token: string | null): Promise<void> {
  const hash = await sha256Hex(token ?? '');
  const known = await tx.first(`SELECT 1 AS yes FROM ${t('private', 'media_worker_tokens')} WHERE ${col('revoked_at')} IS NULL AND ${col('token_hash')} = ?`, hash);
  if (!known) raise('Invalid media worker token', '28000');
}

/** A processing_failed event on each submission waiting on the upload. */
async function noteFailure(tx: Tx, job: Row, error: string): Promise<void> {
  const submissions = await tx.all(`SELECT DISTINCT ${col('submission_id')} AS id FROM ${ITEMS} WHERE ${col('upload_intent_id')} = ?`, job.upload_intent_id);
  for (const submission of submissions) {
    await addEvent(tx, submission.id, null, 'processing_failed', null, null, error, {
      processingJobId: job.id, jobType: job.job_type, uploadIntentId: job.upload_intent_id, attemptCount: job.attempt_count, maxAttempts: job.max_attempts,
    });
  }
}

export async function claimMediaProcessingJob(ctx: ApiContext, token: string | null, workerId: string | null): Promise<unknown> {
  return transaction(ctx, async (tx) => {
    await verifyWorker(tx, token);
    const stale = staleSince(tx.at);
    // A worker that stopped mid-job (crash, out of memory, redeploy) leaves its job processing: requeued while it has attempts left...
    await tx.run(`UPDATE ${JOBS} SET ${col('status')} = 'queued', ${col('worker_id')} = NULL, ${col('claimed_at')} = NULL, ${col('heartbeat_at')} = NULL, ${col('progress')} = NULL,
        ${col('available_at')} = ?, ${col('error_message')} = 'Recovered after media worker stopped before completing the job', ${col('updated_at')} = ?
      WHERE ${col('status')} = 'processing' AND ${col('attempt_count')} < ${col('max_attempts')} AND ${STALE(JOBS)}`, tx.at, tx.at, ...stale);
    // ...and failed, visibly, when that was its last attempt.
    const dead = (await tx.run(`UPDATE ${JOBS} SET ${col('status')} = 'failed', ${col('worker_id')} = NULL, ${col('heartbeat_at')} = NULL, ${col('finished_at')} = ?,
        ${col('error_message')} = 'The media worker stopped during the final processing attempt', ${col('updated_at')} = ?
      WHERE ${col('status')} = 'processing' AND ${col('attempt_count')} >= ${col('max_attempts')} AND ${STALE(JOBS)}
      RETURNING ${col('id')}, ${col('upload_intent_id')}, ${col('job_type')}, ${col('attempt_count')}, ${col('max_attempts')}, ${col('error_message')}`, tx.at, tx.at, ...stale)).results as Row[];
    for (const job of dead) await noteFailure(tx, job, job.error_message as string);
    // A video's audio-only copy is made in the same pass as the video: claimed on its own only once the video job has finished one way or another.
    const next = await tx.first(`SELECT j.${col('id')} AS id FROM ${JOBS} j WHERE j.${col('status')} = 'queued' AND j.${col('available_at')} <= ? AND j.${col('attempt_count')} < j.${col('max_attempts')}
        AND NOT (j.${col('job_type')} = 'audio_delivery' AND EXISTS (SELECT 1 FROM ${JOBS} video WHERE video.${col('upload_intent_id')} = j.${col('upload_intent_id')}
          AND video.${col('job_type')} = 'video_delivery' AND video.${col('status')} IN ('queued', 'processing')))
      ORDER BY j.${col('available_at')}, j.${col('created_at')}, j.rowid LIMIT 1`, tx.at);
    if (!next) return [];
    const job = (await tx.writeFirst(`UPDATE ${JOBS} SET ${col('status')} = 'processing', ${col('attempt_count')} = ${col('attempt_count')} + 1, ${col('worker_id')} = ?,
        ${col('claimed_at')} = ?, ${col('heartbeat_at')} = NULL, ${col('progress')} = 0, ${col('started_at')} = coalesce(${col('started_at')}, ?), ${col('error_message')} = NULL
      WHERE ${col('id')} = ? RETURNING *`, cleanText(workerId), tx.at, tx.at, next.id))!;
    const intent = await tx.first(`SELECT ${col('media_type')}, ${col('content_type')} FROM ${INTENTS} WHERE ${col('id')} = ?`, job.upload_intent_id);
    return [{
      job_id: job.id, upload_intent_id: job.upload_intent_id, job_type: job.job_type, media_type: intent?.media_type ?? null, source_content_type: intent?.content_type ?? null,
      attempt_count: job.attempt_count, max_attempts: job.max_attempts, input_bucket: job.input_bucket, input_path: job.input_path, output_bucket: job.output_bucket, output_path: job.output_path,
    }];
  });
}

/** The audio-only copy of a video being processed, claimed by the worker making the video (created first if it's missing). */
export async function claimCompanionMediaProcessingJob(ctx: ApiContext, token: string | null, jobId: string, workerId: string | null): Promise<unknown> {
  return transaction(ctx, async (tx) => {
    await verifyWorker(tx, token);
    const video = await tx.first(`SELECT * FROM ${JOBS} WHERE ${col('id')} = ? AND ${col('job_type')} = 'video_delivery' AND ${col('status')} = 'processing'`, jobId);
    if (!video) return [];
    const intent = await tx.first(`SELECT * FROM ${INTENTS} WHERE ${col('id')} = ?`, video.upload_intent_id);
    if (!intent || intent.media_type !== 'video') return [];
    await tx.run(`INSERT INTO ${JOBS} (${['id', 'upload_intent_id', 'job_type', 'status', 'input_bucket', 'input_path', 'output_bucket', 'output_path'].map(col).join(', ')})
      VALUES (?, ?, 'audio_delivery', 'queued', ?, ?, ?, ?) ON CONFLICT (${col('upload_intent_id')}, ${col('job_type')}) DO NOTHING`,
    crypto.randomUUID(), intent.id, video.input_bucket, video.input_path, video.output_bucket, outputPath(intent.creator_account_id, intent.id, 'audio_delivery'));
    const companion = await tx.first(`SELECT j.${col('id')} AS id FROM ${JOBS} j WHERE j.${col('upload_intent_id')} = ? AND j.${col('job_type')} = 'audio_delivery'
      AND (j.${col('status')} IN ('queued', 'failed') OR (j.${col('status')} = 'processing' AND ${STALE('j')}))`, intent.id, ...staleSince(tx.at));
    if (!companion) return [];
    const job = (await tx.writeFirst(`UPDATE ${JOBS} SET ${col('status')} = 'processing',
        ${col('attempt_count')} = CASE WHEN ${col('attempt_count')} >= ${col('max_attempts')} THEN 1 ELSE ${col('attempt_count')} + 1 END,
        ${col('worker_id')} = ?, ${col('claimed_at')} = ?, ${col('heartbeat_at')} = ?, ${col('progress')} = 0, ${col('started_at')} = coalesce(${col('started_at')}, ?),
        ${col('finished_at')} = NULL, ${col('error_message')} = NULL, ${col('updated_at')} = ?
      WHERE ${col('id')} = ? RETURNING *`, cleanText(workerId), tx.at, tx.at, tx.at, tx.at, companion.id))!;
    return [{ job_id: job.id, job_type: job.job_type, attempt_count: job.attempt_count, max_attempts: job.max_attempts, output_bucket: job.output_bucket, output_path: job.output_path }];
  });
}

/** A real (float4) as Postgres keeps and prints it: the shortest decimal that is the same single-precision number. */
function float4(value: number): number {
  const single = Math.fround(value);
  for (let digits = 1; digits <= 9; digits += 1) {
    const candidate = Number(single.toPrecision(digits));
    if (Math.fround(candidate) === single) return candidate;
  }
  return single;
}

export async function heartbeatMediaProcessingJobs(ctx: ApiContext, token: string | null, jobIds: (string | null)[] | null, progress: number | null): Promise<unknown> {
  return transaction(ctx, async (tx) => {
    await verifyWorker(tx, token);
    const ids = JSON.stringify(jobIds ?? []);
    await tx.run(`UPDATE ${JOBS} SET ${col('heartbeat_at')} = ?, ${col('progress')} = coalesce(?, ${col('progress')})
      WHERE ${col('id')} IN ${IDS} AND ${col('status')} = 'processing'`, tx.at, progress == null ? null : float4(Math.min(Math.max(float4(progress), 0), 1)), ids);
    // Postgres returns these in the order of its heap, which the update just reshuffled; the processor doesn't depend on it.
    return tx.all(`SELECT ${col('id')} AS job_id, ${col('status')} AS status FROM ${JOBS} WHERE ${col('id')} IN ${IDS} ORDER BY ${col('id')}`, ids);
  });
}

/** private.media_probe_duration_ms: format.duration in milliseconds, rounded half away from zero; null when it isn't a plain decimal, or is 0. */
function probeDurationMs(probe: unknown): number | null {
  const text = arrowText(arrow(arrow(probe, 'output'), 'format'), 'duration');
  const match = text == null ? null : /^(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) return null;
  const fraction = `${match[2] ?? ''}0000`;
  const ms = Number(match[1]) * 1000 + Number(fraction.slice(0, 3)) + (fraction[3] >= '5' ? 1 : 0);
  return ms === 0 ? null : ms;
}

/** private.media_probe_bitrate. */
function probeBitrate(probe: unknown): number | null {
  const text = arrowText(arrow(arrow(probe, 'output'), 'format'), 'bit_rate');
  if (text == null || !/^[0-9]+$/.test(text)) return null;
  const value = Number(text);
  if (value === 0) return null;
  if (value > 2147483647) raise('integer out of range', '22003');
  return value;
}

const streams = (probe: unknown): unknown[] => {
  const list = arrow(arrow(probe, 'output'), 'streams');
  if (list === undefined || list === null) return [];
  if (!Array.isArray(list)) raise(`cannot extract elements from ${typeof list === 'object' ? 'an object' : 'a scalar'}`, '22023');
  return list as unknown[];
};

/** private.media_probe_audio_codec: the first audio stream's codec. */
const probeAudioCodec = (probe: unknown) => {
  const stream = streams(probe).find((s) => arrowText(s, 'codec_type') === 'audio');
  return stream === undefined ? null : arrowText(stream, 'codec_name');
};

/** round(numeric): half away from zero, from its decimal text. */
const roundNumeric = (text: string) => {
  const negative = text.startsWith('-');
  const [whole, fraction = ''] = text.replace('-', '').split('.');
  const rounded = Number(whole) + (fraction[0] >= '5' ? 1 : 0);
  return negative ? -rounded : rounded;
};

/** private.media_probe_video: the first video stream's codec and size, width and height swapped when it is turned a quarter. */
function probeVideo(probe: unknown): { codec: string | null; width: number | null; height: number | null } {
  const stream = streams(probe).find((s) => arrowText(s, 'codec_type') === 'video');
  if (stream === undefined) return { codec: null, width: null, height: null };
  const size = (key: string) => {
    const text = arrowText(stream, key);
    return text != null && /^[0-9]+$/.test(text) ? Number(text) : null;
  };
  const sideData = arrow(stream, 'side_data_list');
  const sides = sideData === undefined || sideData === null ? [] : Array.isArray(sideData) ? sideData : raise('cannot extract elements from an object', '22023');
  const turned = (sides as unknown[]).some((d) => {
    const rotation = arrowText(d, 'rotation');
    return rotation != null && /^-?[0-9]+(\.[0-9]+)?$/.test(rotation) && Math.abs(roundNumeric(rotation)) % 180 === 90;
  }) || ['90', '270', '-90'].includes(arrowText(arrow(stream, 'tags'), 'rotate') ?? '');
  const width = size('width');
  const height = size('height');
  return { codec: arrowText(stream, 'codec_name'), width: turned ? height : width, height: turned ? width : height };
}

const DELIVERIES: Record<string, { mediaType: string; mimeTypes: string[] }> = {
  audio_delivery: { mediaType: 'audio', mimeTypes: ['audio/mp4', 'audio/x-m4a'] },
  video_delivery: { mediaType: 'video', mimeTypes: ['video/mp4'] },
  image_delivery: { mediaType: 'image', mimeTypes: ['image/jpeg', 'image/png', 'image/webp'] },
};

export async function completeMediaProcessingJob(ctx: ApiContext, a: {
  token: string | null; jobId: string; mimeType: string | null; sizeBytes: number | null; checksum: string | null; probe: unknown;
}): Promise<unknown> {
  return transaction(ctx, async (tx) => {
    await verifyWorker(tx, a.token);
    const job = await tx.first(`SELECT * FROM ${JOBS} WHERE ${col('id')} = ?`, a.jobId);
    if (!job) raise('Processing job not found', 'P0002');
    if (job!.status !== 'processing') raise('Processing job is not claimed', '22023');
    if (job!.output_path == null) raise('Processing job has no output path', '22023');
    const delivery = DELIVERIES[job!.job_type as string];
    if (!delivery) raise(`Processing job type ${job!.job_type} cannot produce a delivery asset`, '22023');
    const mime = trimSpaces(a.mimeType ?? '').toLowerCase();
    if (!delivery.mimeTypes.includes(mime)) raise(`Invalid output MIME type ${a.mimeType ?? '<NULL>'} for job type ${job!.job_type}`, '22023');
    if (a.sizeBytes == null || a.sizeBytes <= 0) raise('Invalid output size', '22023');
    const checksum = a.checksum == null ? null : trimSpaces(a.checksum).toLowerCase();
    if (checksum == null || !/^[a-f0-9]{64}$/.test(checksum)) raise('Invalid output checksum', '22023');
    const intent = await tx.first(`SELECT * FROM ${INTENTS} WHERE ${col('id')} = ?`, job!.upload_intent_id);
    if (!intent) raise('Source upload intent not found', 'P0002');
    const probe = a.probe ?? {};
    const video = delivery.mediaType === 'video' ? probeVideo(probe) : null;
    const facts = [mime, a.sizeBytes, checksum, probeDurationMs(probe), probeBitrate(probe), video ? video.codec : probeAudioCodec(probe), video?.width ?? null, video?.height ?? null];
    const metadata = jsonbText({ sourceUploadIntentId: intent!.id, sourceBucket: job!.input_bucket, sourcePath: job!.input_path, probe });
    const asset = (await tx.writeFirst(`INSERT INTO ${ASSETS} (${['id', 'owner_creator_account_id', 'provider', 'bucket', 'path', 'media_type', 'mime_type', 'file_size_bytes', 'checksum',
      'duration_ms', 'bitrate', 'codec', 'width', 'height', 'processing_status', 'publication_status', 'metadata', 'created_by', 'updated_by'].map(col).join(', ')})
      VALUES (?, ?, 'cloudflare_r2', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', 'draft', ?, ?, ?)
      ON CONFLICT (${col('provider')}, ${col('bucket')}, ${col('path')}) DO UPDATE SET ${['media_type', 'mime_type', 'file_size_bytes', 'checksum', 'duration_ms', 'bitrate', 'codec', 'width', 'height', 'metadata', 'updated_by']
    .map((name) => `${col(name)} = excluded.${col(name)}`).join(', ')}, ${col('processing_status')} = 'completed', ${col('updated_at')} = ?
      RETURNING ${col('id')}`, crypto.randomUUID(), intent!.creator_account_id, job!.output_bucket, job!.output_path, delivery.mediaType, ...facts, metadata,
    intent!.requested_by, intent!.requested_by, tx.at))!.id;
    const version = (await tx.writeFirst(`INSERT INTO ${VERSIONS} (${['id', 'media_asset_id', 'version', 'provider', 'bucket', 'path', 'mime_type', 'file_size_bytes', 'checksum',
      'duration_ms', 'bitrate', 'codec', 'width', 'height', 'processing_status', 'created_by'].map(col).join(', ')})
      VALUES (?, ?, 1, 'cloudflare_r2', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?)
      ON CONFLICT (${col('media_asset_id')}, ${col('version')}) DO UPDATE SET ${['mime_type', 'file_size_bytes', 'checksum', 'duration_ms', 'bitrate', 'codec', 'width', 'height']
    .map((name) => `${col(name)} = excluded.${col(name)}`).join(', ')}, ${col('processing_status')} = 'completed'
      RETURNING ${col('id')}`, crypto.randomUUID(), asset, job!.output_bucket, job!.output_path, ...facts, intent!.requested_by))!.id;
    const done = (await tx.writeFirst(`UPDATE ${JOBS} SET ${col('status')} = 'completed', ${col('media_asset_id')} = ?, ${col('media_asset_version_id')} = ?, ${col('output_mime_type')} = ?,
        ${col('output_size_bytes')} = ?, ${col('output_checksum_sha256')} = ?, ${col('probe')} = ?, ${col('finished_at')} = ?, ${col('error_message')} = NULL
      WHERE ${col('id')} = ? RETURNING *`, asset, version, mime, a.sizeBytes, checksum, jsonbText(probe), tx.at, job!.id))!;
    // The finished file joins its submission item; the last one outstanding takes the submission out of processing.
    await settleSubmissionProcessing(tx, job!.upload_intent_id);
    return [{ job_id: done.id, status: done.status, media_asset_id: done.media_asset_id, media_asset_version_id: done.media_asset_version_id, output_bucket: done.output_bucket, output_path: done.output_path }];
  });
}

export async function failMediaProcessingJob(ctx: ApiContext, token: string | null, jobId: string, errorMessage: string | null): Promise<unknown> {
  return transaction(ctx, async (tx) => {
    await verifyWorker(tx, token);
    const job = await tx.first(`SELECT * FROM ${JOBS} WHERE ${col('id')} = ?`, jobId);
    if (!job) raise('Processing job not found', 'P0002');
    const error = left(cleanText(errorMessage) ?? 'Unknown processing error', 4000);
    const retry = (job!.attempt_count as number) < (job!.max_attempts as number);
    // Exponential backoff, capped at an hour: a transient failure retries soon, a broken input stops hammering the queue.
    const delayMinutes = Math.min(4 ** Math.max(job!.attempt_count as number, 1), 60);
    const failed = (await tx.writeFirst(`UPDATE ${JOBS} SET ${col('status')} = ?, ${col('available_at')} = coalesce(?, ${col('available_at')}), ${col('finished_at')} = ?, ${col('error_message')} = ?
      WHERE ${col('id')} = ? RETURNING *`, retry ? 'queued' : 'failed', retry ? addHours(tx.at, delayMinutes / 60) : null, retry ? null : tx.at, error, job!.id))!;
    // Out of attempts: a dead end for whatever submission was waiting on it, recorded there.
    if (!retry) await noteFailure(tx, job!, error);
    return [{ job_id: failed.id, status: failed.status, attempt_count: failed.attempt_count, max_attempts: failed.max_attempts, available_at: failed.available_at, error_message: failed.error_message }];
  });
}

/** A video's audio job, cancelled because the video has no sound. */
export async function skipMediaProcessingJob(ctx: ApiContext, token: string | null, jobId: string, reason: string | null): Promise<unknown> {
  return transaction(ctx, async (tx) => {
    await verifyWorker(tx, token);
    const skipped = (await tx.run(`UPDATE ${JOBS} SET ${col('status')} = 'cancelled', ${col('worker_id')} = NULL, ${col('heartbeat_at')} = NULL, ${col('progress')} = NULL,
        ${col('finished_at')} = ?, ${col('error_message')} = ?, ${col('updated_at')} = ?
      WHERE ${col('id')} = ? AND ${col('job_type')} = 'audio_delivery' AND ${col('status')} = 'processing' RETURNING ${col('upload_intent_id')}`,
    tx.at, left(`No audio track: ${cleanText(reason) ?? 'the video has no sound'}`, 4000), tx.at, jobId));
    const intentId = (skipped.results as Row[])[0]?.upload_intent_id;
    if (intentId != null) await settleSubmissionProcessing(tx, intentId);
    return skipped.meta.changes;
  });
}

/** Jobs a worker that is shutting down hands back, the attempt not counted. */
export async function releaseMediaProcessingJobs(ctx: ApiContext, token: string | null, jobIds: (string | null)[] | null, reason: string | null): Promise<unknown> {
  return transaction(ctx, async (tx) => {
    await verifyWorker(tx, token);
    return (await tx.run(`UPDATE ${JOBS} SET ${col('status')} = 'queued', ${col('attempt_count')} = max(${col('attempt_count')} - 1, 0), ${col('worker_id')} = NULL,
        ${col('claimed_at')} = NULL, ${col('heartbeat_at')} = NULL, ${col('progress')} = NULL, ${col('available_at')} = ?, ${col('error_message')} = ?, ${col('updated_at')} = ?
      WHERE ${col('id')} IN ${IDS} AND ${col('status')} = 'processing'`,
    tx.at, left(cleanText(reason) ?? 'Released by a media worker that was shutting down', 4000), tx.at, JSON.stringify(jobIds ?? []))).meta.changes;
  });
}

/** A video's original, once its video and audio deliveries exist and nothing else will read it: claimed for deletion. */
export async function claimMediaOriginalDeletion(ctx: ApiContext, token: string | null, intentId: string): Promise<unknown> {
  return transaction(ctx, async (tx) => {
    await verifyWorker(tx, token);
    const intent = await tx.first(`SELECT * FROM ${INTENTS} WHERE ${col('id')} = ?`, intentId);
    if (!intent || intent.media_type !== 'video' || intent.status !== 'uploaded' || intent.original_deleted_at != null) return [];
    const jobs = `SELECT 1 FROM ${JOBS} j WHERE j.${col('upload_intent_id')} = ?`;
    const ready = await tx.first(`SELECT EXISTS (${jobs} AND j.${col('job_type')} = 'video_delivery' AND j.${col('status')} = 'completed' AND j.${col('media_asset_id')} IS NOT NULL)
        AND EXISTS (${jobs} AND j.${col('job_type')} = 'audio_delivery' AND ((j.${col('status')} = 'completed' AND j.${col('media_asset_id')} IS NOT NULL) OR ${SKIPPED('j')}))
        AND NOT EXISTS (${jobs} AND j.${col('status')} IN ('queued', 'processing', 'failed')) AS yes`, intent.id, intent.id, intent.id);
    if (!ready!.yes) return [];
    await tx.run(`UPDATE ${INTENTS} SET ${col('original_deleted_at')} = ?, ${col('updated_at')} = ? WHERE ${col('id')} = ?`, tx.at, tx.at, intent.id);
    return [{ bucket: intent.bucket, path: intent.path }];
  });
}

/** What claim_media_processing_job would pick up: a due job with attempts left, or one whose worker stopped. */
export async function mediaProcessingQueueHasWork(ctx: ApiContext, token: string | null): Promise<unknown> {
  return transaction(ctx, async (tx) => {
    await verifyWorker(tx, token);
    const work = await tx.first(`SELECT EXISTS (SELECT 1 FROM ${JOBS} j WHERE (j.${col('status')} = 'queued' AND j.${col('available_at')} <= ? AND j.${col('attempt_count')} < j.${col('max_attempts')})
      OR (j.${col('status')} = 'processing' AND ${STALE('j')})) AS yes`, tx.at, ...staleSince(tx.at));
    return work!.yes === 1;
  });
}

/** private.attach_pending_artist_profile_image: a processed profile picture becomes the photo of the artists waiting for it. */
async function attachPendingProfileImage(tx: Tx, intentId: unknown): Promise<void> {
  const delivered = await tx.first(`SELECT ${col('media_asset_id')} AS asset FROM ${JOBS} WHERE ${col('upload_intent_id')} = ? AND ${col('job_type')} = 'image_delivery'
    AND ${col('status')} = 'completed' AND ${col('media_asset_id')} IS NOT NULL ORDER BY ${col('finished_at')} IS NULL, ${col('finished_at')} DESC LIMIT 1`, intentId);
  if (!delivered) return;
  const ARTISTS = t('music', 'artists');
  const waiting = await tx.all(`SELECT ${col('id')}, ${col('metadata')} FROM ${ARTISTS} WHERE json_extract(${col('metadata')}, '$.pendingProfileImageUploadIntentId') = ?`, intentId);
  for (const artist of waiting) {
    const { pendingProfileImageUploadIntentId: _done, ...metadata } = JSON.parse(artist.metadata as string) as Row;
    await tx.run(`UPDATE ${ARTISTS} SET ${col('profile_image_asset_id')} = ?, ${col('metadata')} = ?, ${col('updated_at')} = ? WHERE ${col('id')} = ?`, delivered.asset, jsonbText(metadata), tx.at, artist.id);
  }
}

/**
 * private.settle_submission_processing: once an upload's file is ready, its
 * items take it; a live submission publishes what its edit brought, and one
 * in processing whose files are all ready is approved again.
 */
export async function settleSubmissionProcessing(tx: Tx, intentId: unknown): Promise<number> {
  if (intentId == null) return 0;
  await attachPendingProfileImage(tx, intentId);
  let settled = 0;
  const submissions = await tx.all(`SELECT DISTINCT ${col('submission_id')} AS id FROM ${ITEMS} WHERE ${col('upload_intent_id')} = ?`, intentId);
  for (const { id } of submissions) {
    await attachCompletedJobs(tx, id);
    const sub = await tx.first(`SELECT * FROM ${SUBMISSIONS} WHERE ${col('id')} = ? AND ${col('status')} IN ('published', 'processing')`, id);
    if (!sub) continue;
    if (sub.status === 'published') {
      if (sub.submission_type === 'music_release') {
        if (await requiredReady(tx, id) && await musicSubmissionHasPendingEdits(tx, id)) {
          await publishMusicSubmission(tx, id, null, 'edit_ready');
          settled += 1;
        }
      } else if (await applyLearningEdits(tx, id, null) > 0) {
        settled += 1;
      }
      continue;
    }
    if (!(await requiredReady(tx, id))) continue;
    await tx.run(`UPDATE ${SUBMISSIONS} SET ${col('status')} = 'approved', ${col('updated_at')} = ? WHERE ${col('id')} = ?`, tx.at, id);
    await addEvent(tx, id, sub.reviewer_id, 'processing_completed', 'processing', 'approved', null, { uploadIntentId: intentId });
    settled += 1;
  }
  return settled;
}
