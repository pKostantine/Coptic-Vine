/**
 * The private functions the creator editor's writes are built from, ported
 * from schema/pg-user-schema.sql to run in a transaction (src/db/transaction.ts):
 * submission events, processing jobs (public.enqueue_media_processing_job),
 * attaching processed media (private.attach_completed_submission_jobs),
 * submitting (public.submit_media_submission), adding items
 * (public.add_media_submission_item, private.add_edit_submission_item),
 * track credits and the artists they name, and deleting releases and tracks.
 * Each follows its Postgres function statement by statement, raising the same
 * errors in the same order.
 */
import { col, t } from '../../../../content-api/src/db/names.ts';
import type { Tx } from '../../db/transaction.ts';
import { jsonbText, raise } from '../../pg.ts';
import type { ApiContext } from '../../rest/context.ts';
import { pgTimestamp } from '../../time.ts';
import { convert } from '../args.ts';
import { normalizeCreatorName } from './reads.ts';
import { canEdit, itemMediaReady, order, requiredItemsReady, type Row } from './shared.ts';

const ITEMS = t('media', 'submission_items');
const INTENTS = t('media', 'upload_intents');
const JOBS = t('media', 'media_processing_jobs');
const ASSETS = t('media', 'media_assets');
const SUBMISSIONS = t('media', 'submissions');
const ARTISTS = t('music', 'artists');
const ACCOUNTS = t('creator', 'creator_accounts');

// ── jsonb and text, as the functions read their arguments ────────────────

/** btrim/trim: spaces only. */
export const trimSpaces = (text: string) => text.replace(/^ +| +$/g, '');
/** nullif(trim(coalesce(x, '')), ''). */
export const cleanText = (text: unknown): string | null => (text == null ? null : trimSpaces(String(text)) || null);
const isObject = (value: unknown): value is Row => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
/** value -> key: undefined when value isn't an object or has no such key. */
export const arrow = (value: unknown, key: string): unknown => (isObject(value) ? value[key] : undefined);
/** value ->> key: a string as it is, a JSON null or a missing key as null, anything else as jsonb prints it. */
export function arrowText(value: unknown, key: string): string | null {
  const entry = arrow(value, key);
  if (entry === undefined || entry === null) return null;
  return typeof entry === 'string' ? entry : jsonbText(entry);
}
/** value ? key. */
export const hasKey = (value: unknown, key: string) => isObject(value) && Object.prototype.hasOwnProperty.call(value, key);
/** jsonb_typeof, for a JSON value (SQL null: null). */
export function jsonbType(value: unknown): string | null {
  if (value === undefined) return null;
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value === 'object' ? 'object' : typeof value === 'string' ? 'string' : typeof value === 'number' ? 'number' : 'boolean';
}
/** text::uuid, with Postgres's error. */
export const toUuid = (text: string | null): string | null => (text == null ? null : convert('uuid', text) as string);
/** jsonb_array_elements: the elements, or Postgres's error for anything but an array. */
export function arrayElements(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  raise(`cannot extract elements from ${isObject(value) ? 'an object' : 'a scalar'}`, '22023');
}
/** jsonb_each_text: an object's entries, values as text (null stays null). */
export function eachText(value: unknown): [string, string | null][] {
  if (!isObject(value)) raise('cannot call jsonb_each_text on a non-object', '22023');
  return Object.keys(value).map((key) => [key, arrowText(value, key)]);
}

const LOCALES = ['en', 'ar', 'fr'];

/** private.edit_localized_titles: en, ar and fr, trimmed, '' where missing. */
export function editLocalizedTitles(value: unknown): Record<string, string> {
  return Object.fromEntries(LOCALES.map((locale) => [locale, isObject(value) ? trimSpaces(arrowText(value, locale) ?? '') : '']));
}
/** private.edit_compact_titles: en, ar and fr with text. */
export function editCompactTitles(value: unknown): Record<string, string> {
  if (value == null) return {};
  return Object.fromEntries(eachText(value).filter(([key, text]) => LOCALES.includes(key) && cleanText(text) != null) as [string, string][]);
}
/** private.edit_preferred_title: English, else Arabic, else French, else the fallback. */
export const editPreferredTitle = (titles: Record<string, string>, fallback: string | null) =>
  cleanText(titles.en) ?? cleanText(titles.ar) ?? cleanText(titles.fr) ?? cleanText(fallback);

/** A timestamp plus some hours, in the stored form. */
export const addHours = (at: string, hours: number) => pgTimestamp(new Date(Date.parse(at) + hours * 3600_000));

/** Postgres's ORDER BY (x = y) DESC: null first, then true, then false. */
export const trueFirst = (a: boolean | null, b: boolean | null) => (b == null ? 2 : b ? 1 : 0) - (a == null ? 2 : a ? 1 : 0);

/** A localization's locale must be one the catalog knows; Postgres's error names the foreign key (every one is <table>_locale_fkey). */
export async function requireLocale(tx: Tx, table: string, locale: string): Promise<void> {
  if (!(await tx.first(`SELECT 1 AS yes FROM ${t('media', 'locales')} WHERE ${col('code')} = ?`, locale))) {
    raise(`insert or update on table "${table}" violates foreign key constraint "${table}_locale_fkey"`, '23503');
  }
}

// ── Events, jobs and items ────────────────────────────────────────────────

/** private.add_media_submission_event. */
export async function addEvent(tx: Tx, submissionId: unknown, actor: unknown, action: string, from: unknown, to: unknown, notes: string | null, metadata: Row | null): Promise<void> {
  await tx.run(`INSERT INTO ${t('media', 'submission_events')} (${['id', 'submission_id', 'actor_id', 'action', 'from_status', 'to_status', 'notes', 'metadata', 'created_at'].map(col).join(', ')})
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, crypto.randomUUID(), submissionId, actor, trimSpaces(action), from, to, cleanText(notes), jsonbText(metadata ?? {}), tx.at);
}

/** private.media_processing_output_path. */
export const outputPath = (account: unknown, intent: unknown, jobType: string) =>
  `processed/${account}/${intent}/v1/${jobType === 'audio_delivery' ? 'audio.m4a' : jobType === 'video_delivery' ? 'video.mp4' : jobType === 'image_delivery' ? 'cover.jpg' : 'metadata.json'}`;

/**
 * private.media_processing_job_is_stale: claimed, and silent too long (five
 * minutes since its heartbeat; without one, two hours for a video, fifteen
 * minutes otherwise). Binds three thresholds: staleSince(at).
 */
export const STALE = (job: string) => `(${job}.${col('claimed_at')} IS NOT NULL AND CASE
  WHEN ${job}.${col('heartbeat_at')} IS NOT NULL THEN ${job}.${col('heartbeat_at')} < ?
  WHEN ${job}.${col('job_type')} = 'video_delivery' THEN ${job}.${col('claimed_at')} < ?
  ELSE ${job}.${col('claimed_at')} < ? END)`;
export const staleSince = (at: string) => [addHours(at, -5 / 60), addHours(at, -2), addHours(at, -15 / 60)];

/** private.media_job_skipped_for_silence: a video's audio job cancelled because it has no sound. */
export const SKIPPED = (job: string) => `(${job}.${col('status')} = 'cancelled' AND coalesce(${job}.${col('error_message')}, '') GLOB 'No audio track*')`;

/** public.enqueue_media_processing_job: a delivery job for an upload, or the failed one again; a video's audio-only job with it. */
export async function enqueueJob(ctx: ApiContext, tx: Tx, intentId: string | null, jobType: string | null, outputBucket: string | null): Promise<Row> {
  if (!ctx.userId) raise('Authentication required', '28000');
  if (jobType === 'metadata_probe') raise('metadata_probe jobs are not implemented by any worker', '22023');
  const allowed = ({ audio_delivery: ['chc-music', 'chc-learning'], video_delivery: ['chc-learning'], image_delivery: ['chc-images'] } as Record<string, string[]>)[jobType ?? ''];
  if (!allowed) raise(`Unsupported processing job type: ${jobType ?? '<NULL>'}`, '22023');
  const bucket = outputBucket ?? allowed[0];
  if (!allowed.includes(bucket)) raise(`${jobType} jobs cannot write to ${bucket}`, '22023');
  const intent = await tx.first(`SELECT * FROM ${INTENTS} WHERE ${col('id')} = ?`, intentId);
  if (!intent) raise('Upload intent not found', 'P0002');
  if (intent!.status !== 'uploaded') raise('Upload intent is not uploaded', '22023');
  const type = intent!.media_type;
  if (!((jobType === 'audio_delivery' && (type === 'audio' || type === 'video')) || (jobType === 'video_delivery' && type === 'video') || (jobType === 'image_delivery' && type === 'image'))) {
    raise(`A ${type} upload cannot be enqueued for ${jobType}`, '22023');
  }
  if (intent!.requested_by !== ctx.userId && !(await canEdit(ctx, intent!.creator_account_id))) raise('Not authorized for upload intent', '42501');
  if (intent!.original_deleted_at != null && !(await tx.first(`SELECT 1 AS yes FROM ${JOBS} done WHERE done.${col('upload_intent_id')} = ? AND done.${col('job_type')} = ?
      AND (done.${col('status')} = 'completed' OR ${SKIPPED('done')})`, intent!.id, jobType))) {
    raise('The original upload was removed after processing; upload the file again', '22023');
  }
  const retry = (column: string, value: string) => `${col(column)} = CASE WHEN ${JOBS}.${col('status')} IN ('failed', 'cancelled') THEN ${value} ELSE ${JOBS}.${col(column)} END`;
  const statements = [tx.db.prepare(`INSERT INTO ${JOBS} (${['id', 'upload_intent_id', 'job_type', 'status', 'input_bucket', 'input_path', 'output_bucket', 'output_path', 'queued_at', 'available_at', 'created_at', 'updated_at'].map(col).join(', ')})
    VALUES (?, ?, ?, 'queued', ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (${col('upload_intent_id')}, ${col('job_type')}) DO UPDATE SET ${retry('available_at', '?')}, ${retry('status', "'queued'")}, ${retry('attempt_count', '0')},
      ${retry('finished_at', 'NULL')}, ${retry('output_bucket', `excluded.${col('output_bucket')}`)}, ${retry('output_path', `excluded.${col('output_path')}`)}, ${retry('error_message', 'NULL')}
    WHERE NOT ${SKIPPED(JOBS)}`)
    .bind(crypto.randomUUID(), intent!.id, jobType, intent!.bucket, intent!.path, bucket, outputPath(intent!.creator_account_id, intent!.id, jobType!), tx.at, tx.at, tx.at, tx.at, tx.at)];
  // The audio-only copy is made in the same pass as the video.
  if (jobType === 'video_delivery') {
    statements.push(tx.db.prepare(`INSERT INTO ${JOBS} (${['id', 'upload_intent_id', 'job_type', 'status', 'input_bucket', 'input_path', 'output_bucket', 'output_path', 'queued_at', 'available_at', 'created_at', 'updated_at'].map(col).join(', ')})
      VALUES (?, ?, 'audio_delivery', 'queued', ?, ?, 'chc-learning', ?, ?, ?, ?, ?)
      ON CONFLICT (${col('upload_intent_id')}, ${col('job_type')}) DO UPDATE SET ${col('status')} = 'queued', ${col('available_at')} = ?, ${col('attempt_count')} = 0,
        ${col('finished_at')} = NULL, ${col('error_message')} = NULL WHERE ${JOBS}.${col('status')} = 'failed'`)
      .bind(crypto.randomUUID(), intent!.id, intent!.bucket, intent!.path, outputPath(intent!.creator_account_id, intent!.id, 'audio_delivery'), tx.at, tx.at, tx.at, tx.at, tx.at));
  }
  statements.push(tx.db.prepare(`UPDATE ${INTENTS} SET ${col('error_message')} = NULL WHERE ${col('id')} = ?`).bind(intent!.id));
  await tx.batch(statements);
  // The job as the insert left it, or as it was (a silent video's skipped audio job stays skipped).
  const job = await tx.first(`SELECT ${col('id')} AS job_id, ${col('status')}, ${col('input_bucket')}, ${col('input_path')}, ${col('output_bucket')}, ${col('output_path')}
    FROM ${JOBS} WHERE ${col('upload_intent_id')} = ? AND ${col('job_type')} = ?`, intent!.id, jobType);
  return job!;
}

/** The probe's duration in milliseconds, rounded (numeric arithmetic on its text); null when there's none, it's 0, or it isn't a plain decimal. */
function probeMs(job: string): string {
  const d = `trim(CAST(json_extract(${job}.${col('probe')}, '$.output.format.duration') AS TEXT))`;
  const whole = `substr(${d}, 1, instr(${d} || '.', '.') - 1)`;
  const fraction = `substr(${d}, instr(${d} || '.', '.') + 1)`;
  return `CASE WHEN ${d} GLOB '[0-9]*' AND ${d} NOT GLOB '*[^0-9.]*' AND length(${d}) - length(replace(${d}, '.', '')) <= 1
    THEN nullif(CAST(${whole} AS INTEGER) * 1000 + CAST(substr(${fraction} || '000', 1, 3) AS INTEGER) + (substr(${fraction} || '0000', 4, 1) >= '5'), 0) END`;
}

const deliveryFor = (intent: string) => `CASE ${intent}.${col('media_type')} WHEN 'audio' THEN 'audio_delivery' WHEN 'video' THEN 'video_delivery' WHEN 'image' THEN 'image_delivery' END`;

/**
 * private.attach_completed_submission_jobs: each item takes its processed
 * asset (the delivery of its own kind), a video its audio-only copy, tracks
 * and lessons their files and durations; the audio of published lessons is
 * published. The number of items changed.
 */
export async function attachCompletedJobs(tx: Tx, submissionId: unknown): Promise<number> {
  const best = (filter: string) => `SELECT item.${col('id')} AS item_id, job.${col('id')} AS job_id, job.${col('media_asset_id')} AS asset_id,
      row_number() OVER (PARTITION BY item.${col('id')} ORDER BY job.${col('finished_at')} DESC, job.${col('created_at')} DESC) AS rank
    FROM ${ITEMS} item JOIN ${INTENTS} intent ON intent.${col('id')} = item.${col('upload_intent_id')}${filter}
    JOIN ${JOBS} job ON job.${col('upload_intent_id')} = intent.${col('id')}`;
  const [primary, audio] = await tx.batch([
    tx.db.prepare(`WITH ranked AS (${best('')} AND job.${col('job_type')} = ${deliveryFor('intent')} AND job.${col('status')} = 'completed' AND job.${col('media_asset_id')} IS NOT NULL
        WHERE item.${col('submission_id')} = ?), chosen AS (SELECT * FROM ranked WHERE rank = 1)
      UPDATE ${ITEMS} SET ${col('media_asset_id')} = coalesce(${ITEMS}.${col('media_asset_id')}, chosen.asset_id), ${col('media_processing_job_id')} = chosen.job_id
      FROM chosen WHERE ${ITEMS}.${col('id')} = chosen.item_id
        AND (${ITEMS}.${col('media_asset_id')} IS NOT coalesce(${ITEMS}.${col('media_asset_id')}, chosen.asset_id) OR ${ITEMS}.${col('media_processing_job_id')} IS NOT chosen.job_id)`).bind(submissionId),
    tx.db.prepare(`WITH ranked AS (${best(` AND intent.${col('media_type')} = 'video'`)} AND job.${col('job_type')} = 'audio_delivery' AND job.${col('status')} = 'completed' AND job.${col('media_asset_id')} IS NOT NULL
        WHERE item.${col('submission_id')} = ?), chosen AS (SELECT * FROM ranked WHERE rank = 1)
      UPDATE ${ITEMS} SET ${col('audio_only_asset_id')} = chosen.asset_id, ${col('updated_at')} = ?
      FROM chosen WHERE ${ITEMS}.${col('id')} = chosen.item_id AND ${ITEMS}.${col('audio_only_asset_id')} IS NOT chosen.asset_id`).bind(submissionId, tx.at),
    tx.db.prepare(`UPDATE ${t('music', 'tracks')} SET ${col('media_asset_id')} = item.${col('media_asset_id')},
        ${col('duration_ms')} = coalesce(${t('music', 'tracks')}.${col('duration_ms')}, ${probeMs('job')}), ${col('updated_at')} = ?
      FROM ${ITEMS} item LEFT JOIN ${JOBS} job ON job.${col('id')} = item.${col('media_processing_job_id')}
      WHERE item.${col('submission_id')} = ? AND item.${col('music_track_id')} = ${t('music', 'tracks')}.${col('id')}
        AND item.${col('media_asset_id')} IS NOT NULL AND ${t('music', 'tracks')}.${col('media_asset_id')} IS NOT item.${col('media_asset_id')}`).bind(tx.at, submissionId),
    tx.db.prepare(`UPDATE ${t('learning', 'lessons')} SET ${col('audio_asset_id')} = item.${col('audio_only_asset_id')}, ${col('updated_at')} = ?
      FROM ${ITEMS} item WHERE item.${col('submission_id')} = ? AND item.${col('audio_only_asset_id')} IS NOT NULL
        AND json_extract(${t('learning', 'lessons')}.${col('metadata')}, '$.submissionItemId') = item.${col('id')}
        AND ${t('learning', 'lessons')}.${col('audio_asset_id')} IS NOT item.${col('audio_only_asset_id')}`).bind(tx.at, submissionId),
    tx.db.prepare(`UPDATE ${t('learning', 'lessons')} SET ${col('duration_ms')} = coalesce(audio.${col('duration_ms')}, asset.${col('duration_ms')}), ${col('updated_at')} = ?
      FROM ${ITEMS} item JOIN ${ASSETS} asset ON asset.${col('id')} = item.${col('media_asset_id')} LEFT JOIN ${ASSETS} audio ON audio.${col('id')} = item.${col('audio_only_asset_id')}
      WHERE item.${col('submission_id')} = ? AND json_extract(${t('learning', 'lessons')}.${col('metadata')}, '$.submissionItemId') = item.${col('id')}
        AND ${t('learning', 'lessons')}.${col('duration_ms')} IS NULL AND coalesce(audio.${col('duration_ms')}, asset.${col('duration_ms')}) IS NOT NULL`).bind(tx.at, submissionId),
    tx.db.prepare(`UPDATE ${t('learning', 'album_recordings')} SET ${col('duration_ms')} = asset.${col('duration_ms')}, ${col('updated_at')} = ?
      FROM ${ITEMS} item JOIN ${ASSETS} asset ON asset.${col('id')} = item.${col('media_asset_id')}
      WHERE item.${col('submission_id')} = ? AND ${t('learning', 'album_recordings')}.${col('media_asset_id')} = item.${col('media_asset_id')}
        AND ${t('learning', 'album_recordings')}.${col('duration_ms')} IS NULL AND asset.${col('duration_ms')} IS NOT NULL`).bind(tx.at, submissionId),
    tx.db.prepare(`UPDATE ${ASSETS} SET ${col('publication_status')} = 'published', ${col('updated_at')} = ?
      WHERE ${col('id')} IN (SELECT l.${col('audio_asset_id')} FROM ${t('learning', 'lessons')} l WHERE l.${col('publication_status')} = 'published' AND l.${col('audio_asset_id')} IS NOT NULL)
        AND ${col('publication_status')} IS NOT 'published'`).bind(tx.at),
  ]);
  return primary.meta.changes + audio.meta.changes;
}

const EDITABLE = ['draft', 'uploading', 'ready_to_submit', 'changes_requested'];

/** public.submit_media_submission: into review, with a 48-hour deadline. */
export async function submitSubmission(ctx: ApiContext, tx: Tx, submissionId: unknown): Promise<Row> {
  if (!ctx.userId) raise('Authentication required', '28000');
  const sub = await tx.first(`SELECT * FROM ${SUBMISSIONS} WHERE ${col('id')} = ?`, submissionId);
  if (!sub) raise('Submission not found', 'P0002');
  if (!(await canEdit(ctx, sub!.creator_account_id))) raise('Not authorized for submission', '42501');
  if (!['draft', 'ready_to_submit', 'changes_requested'].includes(sub!.status as string)) raise('Submission cannot be submitted from its current status', '22023');
  if (!(await tx.first(`SELECT 1 AS yes FROM ${ITEMS} WHERE ${col('submission_id')} = ?`, sub!.id))) raise('Submission must have at least one item', '22023');
  if (await tx.first(`SELECT 1 AS yes FROM ${ITEMS} item JOIN ${INTENTS} intent ON intent.${col('id')} = item.${col('upload_intent_id')}
      WHERE item.${col('submission_id')} = ? AND intent.${col('status')} <> 'uploaded'`, sub!.id)) raise('All upload items must be uploaded before submission', '22023');
  const due = addHours(tx.at, 48);
  await tx.run(`UPDATE ${SUBMISSIONS} SET ${col('status')} = 'pending_review', ${col('submitted_at')} = ?, ${col('review_due_at')} = ?, ${col('reviewer_id')} = NULL,
    ${col('reviewed_at')} = NULL, ${col('review_notes')} = NULL, ${col('rejected_at')} = NULL, ${col('updated_by')} = ? WHERE ${col('id')} = ?`, tx.at, due, ctx.userId, sub!.id);
  await addEvent(tx, sub!.id, ctx.userId, 'submitted', sub!.status, 'pending_review', null, { reviewDueAt: due });
  return { submission_id: sub!.id, status: 'pending_review', submitted_at: tx.at, review_due_at: due };
}

/** public.add_media_submission_item: an uploaded file or a processed asset added, its processing started. */
export async function addSubmissionItem(ctx: ApiContext, tx: Tx, a: {
  submissionId: unknown; intentId: string | null; assetId: string | null; title: string | null; sortOrder: number | null; required: boolean | null; role: string | null;
}): Promise<Row> {
  if (!ctx.userId) raise('Authentication required', '28000');
  if ((a.intentId == null && a.assetId == null) || (a.intentId != null && a.assetId != null)) raise('Provide exactly one upload intent or media asset', '22023');
  const sub = await tx.first(`SELECT * FROM ${SUBMISSIONS} WHERE ${col('id')} = ?`, a.submissionId);
  if (!sub) raise('Submission not found', 'P0002');
  if (!(await canEdit(ctx, sub!.creator_account_id))) raise('Not authorized for submission', '42501');
  if (!EDITABLE.includes(sub!.status as string)) raise('Submission is not editable', '22023');
  let title = cleanText(a.title);
  let intent: Row | null = null;
  let asset: Row | null = null;
  if (a.intentId != null) {
    intent = await tx.first(`SELECT * FROM ${INTENTS} WHERE ${col('id')} = ?`, a.intentId);
    if (!intent) raise('Upload intent not found', 'P0002');
    if (intent!.creator_account_id !== sub!.creator_account_id) raise('Upload intent belongs to a different creator account', '42501');
    if (intent!.status !== 'uploaded') raise('Upload intent must be uploaded before submission', '22023');
    title = title ?? (intent!.original_filename as string);
  }
  if (a.assetId != null) {
    asset = await tx.first(`SELECT * FROM ${ASSETS} WHERE ${col('id')} = ?`, a.assetId);
    if (!asset) raise('Media asset not found', 'P0002');
    if (asset!.owner_creator_account_id !== sub!.creator_account_id) raise('Media asset belongs to a different creator account', '42501');
    if (asset!.processing_status !== 'completed') raise('Media asset is not processing-complete', '22023');
    title = title ?? (asset!.path as string);
  }
  const role = a.role ?? (intent?.media_type === 'image' || asset?.media_type === 'image' ? 'artwork'
    : sub!.submission_type === 'music_release' ? 'track' : ['learning_album', 'learning_lesson_set'].includes(sub!.submission_type as string) ? 'lesson' : 'other');
  // Postgres checks submission_items' unique indexes in the order they were made, and names the first one broken.
  const duplicate = (name: string) => raise(`duplicate key value violates unique constraint "${name}"`, '23505');
  if (a.intentId != null && await tx.first(`SELECT 1 AS yes FROM ${ITEMS} WHERE ${col('submission_id')} = ? AND ${col('upload_intent_id')} = ?`, sub!.id, a.intentId)) duplicate('submission_items_submission_upload_intent_idx');
  if (a.assetId != null && await tx.first(`SELECT 1 AS yes FROM ${ITEMS} WHERE ${col('submission_id')} = ? AND ${col('media_asset_id')} = ?`, sub!.id, a.assetId)) duplicate('submission_items_submission_media_asset_idx');
  if (a.intentId != null && await tx.first(`SELECT 1 AS yes FROM ${ITEMS} WHERE ${col('upload_intent_id')} = ?`, a.intentId)) duplicate('submission_items_upload_intent_id_unique');
  const itemId = crypto.randomUUID();
  await tx.run(`INSERT INTO ${ITEMS} (${['id', 'submission_id', 'upload_intent_id', 'media_asset_id', 'title', 'sort_order', 'required', 'role', 'created_at', 'updated_at'].map(col).join(', ')})
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, itemId, sub!.id, a.intentId, a.assetId, title, a.sortOrder ?? 0, a.required ?? true ? 1 : 0, role, tx.at, tx.at);
  if (intent && ['audio', 'image', 'video'].includes(intent.media_type as string)) {
    const jobType = ({ audio: 'audio_delivery', image: 'image_delivery', video: 'video_delivery' } as Record<string, string>)[intent.media_type as string];
    const bucket = jobType === 'image_delivery' ? 'chc-images' : jobType === 'video_delivery' ? 'chc-learning' : sub!.submission_type === 'music_release' ? 'chc-music' : 'chc-learning';
    const job = await enqueueJob(ctx, tx, intent.id as string, jobType, bucket);
    await tx.run(`UPDATE ${ITEMS} SET ${col('media_processing_job_id')} = ? WHERE ${col('id')} = ?`, job.job_id, itemId);
    await attachCompletedJobs(tx, sub!.id);
  }
  const item = (await tx.first(`SELECT * FROM ${ITEMS} WHERE ${col('id')} = ?`, itemId))!;
  await tx.run(`UPDATE ${SUBMISSIONS} SET ${col('status')} = 'ready_to_submit', ${col('updated_by')} = ? WHERE ${col('id')} = ?`, ctx.userId, sub!.id);
  await addEvent(tx, sub!.id, ctx.userId, 'item_added', sub!.status, 'ready_to_submit', null, {
    submissionItemId: item.id, uploadIntentId: item.upload_intent_id, mediaAssetId: item.media_asset_id, processingJobId: item.media_processing_job_id, role: item.role,
  });
  return { item_id: item.id, submission_id: item.submission_id, upload_intent_id: item.upload_intent_id, media_asset_id: item.media_asset_id, media_processing_job_id: item.media_processing_job_id };
}

/** private.add_edit_submission_item: an edit's new file, checked for its kind, queued for processing. */
export async function addEditItem(ctx: ApiContext, tx: Tx, a: {
  submissionId: unknown; intentId: string; role: string; title: string | null; sortOrder: number | null; localizedTitles?: Row; trackId?: unknown; replaces?: unknown;
}): Promise<string> {
  const sub = await tx.first(`SELECT * FROM ${SUBMISSIONS} WHERE ${col('id')} = ?`, a.submissionId);
  if (!sub) raise('Submission not found', 'P0002');
  const intent = await tx.first(`SELECT * FROM ${INTENTS} WHERE ${col('id')} = ?`, a.intentId);
  if (!intent) raise('That upload could not be found. Choose the file again.', 'P0002');
  if (intent!.creator_account_id !== sub!.creator_account_id) raise('That upload belongs to a different workspace', '42501');
  if (intent!.status !== 'uploaded') raise('Wait for every file to finish uploading before saving', '22023');
  if (await tx.first(`SELECT 1 AS yes FROM ${ITEMS} WHERE ${col('upload_intent_id')} = ?`, intent!.id)) raise('That upload is already part of a submission. Choose the file again.', '22023');
  const type = intent!.media_type;
  if (a.role === 'artwork') {
    if (type !== 'image') raise('Artwork must be an image', '22023');
  } else if (sub!.submission_type === 'music_release') {
    if (type !== 'audio') raise('Tracks must be audio files', '22023');
  } else if (sub!.submission_type === 'learning_album') {
    if (type !== 'audio') raise('Learning album recordings must be audio files', '22023');
  } else if (type !== 'audio' && type !== 'video') raise('Lessons must be audio or video files', '22023');
  const itemId = crypto.randomUUID();
  await tx.run(`INSERT INTO ${ITEMS} (${['id', 'submission_id', 'upload_intent_id', 'title', 'sort_order', 'required', 'role', 'music_track_id', 'localized_titles', 'replaces_item_id', 'created_at', 'updated_at'].map(col).join(', ')})
    VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)`, itemId, sub!.id, intent!.id, cleanText(a.title) ?? intent!.original_filename, a.sortOrder ?? 0, a.role,
  a.trackId ?? null, jsonbText(a.localizedTitles ?? {}), a.replaces ?? null, tx.at, tx.at);
  const jobType = ({ audio: 'audio_delivery', image: 'image_delivery', video: 'video_delivery' } as Record<string, string>)[type as string] ?? null;
  const bucket = jobType === 'image_delivery' ? 'chc-images' : jobType === 'video_delivery' ? 'chc-learning' : sub!.submission_type === 'music_release' ? 'chc-music' : 'chc-learning';
  const job = await enqueueJob(ctx, tx, intent!.id as string, jobType, bucket);
  await tx.run(`UPDATE ${ITEMS} SET ${col('media_processing_job_id')} = ? WHERE ${col('id')} = ?`, job.job_id, itemId);
  return itemId;
}

/** private.replace_submission_artwork: waiting artwork superseded, the new one added (the live cover's item stays). */
export async function replaceArtwork(ctx: ApiContext, tx: Tx, submissionId: unknown, intentId: string, currentCover: unknown): Promise<string> {
  await tx.run(`DELETE FROM ${ITEMS} WHERE ${col('submission_id')} = ? AND ${col('role')} = 'artwork' AND ${col('media_asset_id')} IS NOT ?`, submissionId, currentCover);
  return addEditItem(ctx, tx, { submissionId, intentId, role: 'artwork', title: 'Artwork', sortOrder: -1 });
}

/** private.drop_superseded_artwork: artwork older than the live cover's item goes. */
export async function dropSupersededArtwork(tx: Tx, submissionId: unknown, cover: unknown): Promise<void> {
  await tx.run(`DELETE FROM ${ITEMS} WHERE ${col('submission_id')} = ? AND ${col('role')} = 'artwork' AND ? IS NOT NULL AND ${col('media_asset_id')} IS NOT ?
    AND ${col('created_at')} < (SELECT max(c.${col('created_at')}) FROM ${ITEMS} c WHERE c.${col('submission_id')} = ? AND c.${col('role')} = 'artwork' AND c.${col('media_asset_id')} = ?)`,
  submissionId, cover, cover, submissionId, cover);
}

/** private.link_submission_item_music_track. */
export async function linkItemTrack(ctx: ApiContext, tx: Tx, itemId: unknown, trackId: unknown, account: unknown): Promise<void> {
  if (!ctx.userId) raise('Authentication required', '28000');
  if (!(await canEdit(ctx, account))) raise('Not authorized for creator account', '42501');
  const ok = await tx.first(`SELECT 1 AS yes FROM ${ITEMS} item JOIN ${SUBMISSIONS} s ON s.${col('id')} = item.${col('submission_id')} JOIN ${t('music', 'tracks')} tr ON tr.${col('id')} = ?
    WHERE item.${col('id')} = ? AND item.${col('role')} = 'track' AND s.${col('creator_account_id')} = ? AND tr.${col('owner_creator_account_id')} = ?`, trackId, itemId, account, account);
  if (!ok) raise('Submission item and track must belong to the same editable creator account', '42501');
  await tx.run(`UPDATE ${ITEMS} SET ${col('music_track_id')} = ? WHERE ${col('id')} = ?`, trackId, itemId);
}

// ── Artists and credits ───────────────────────────────────────────────────

async function identityOf(tx: Tx, account: unknown): Promise<string | null> {
  return ((await tx.first(`SELECT ${col('identity_artist_id')} AS id FROM ${ACCOUNTS} WHERE ${col('id')} = ?`, account))?.id as string | undefined) ?? null;
}

/** The artists whose names normalize to this one's. */
async function artistsNamed(tx: Tx, name: string): Promise<Row[]> {
  const target = normalizeCreatorName(name);
  return (await tx.all(`SELECT * FROM ${ARTISTS}`)).filter((artist) => normalizeCreatorName(artist.display_name as string) === target);
}

/** private.resolve_track_credit_artist: the artist with this name (the account's own first), or a new credit-only one. */
async function resolveTrackCreditArtist(ctx: ApiContext, tx: Tx, account: unknown, name: string | null, defaultToIdentity: boolean): Promise<string | null> {
  if (!ctx.userId) raise('Authentication required', '28000');
  if (!(await canEdit(ctx, account))) raise('Not authorized for creator account', '42501');
  const identity = await identityOf(tx, account);
  const clean = cleanText(name);
  if (clean == null) return defaultToIdentity && identity != null ? identity : null;
  const found = (await artistsNamed(tx, clean)).sort((a, b) => trueFirst(identity == null ? null : a.id === identity, identity == null ? null : b.id === identity)
    || trueFirst(a.owner_creator_account_id != null, b.owner_creator_account_id != null) || order.ascNullsLast(a.created_at, b.created_at))[0];
  if (found) return found.id as string;
  const id = crypto.randomUUID();
  await tx.run(`INSERT INTO ${ARTISTS} (${['id', 'owner_creator_account_id', 'display_name', 'created_by', 'updated_by', 'created_at', 'updated_at'].map(col).join(', ')}) VALUES (?, NULL, ?, ?, ?, ?, ?)`,
    id, clean, ctx.userId, ctx.userId, tx.at, tx.at);
  return id;
}

/** private.resolve_creator_selected_artist: the chosen artist if it may be credited, else the named one, else (if asked) the account's identity. */
export async function resolveSelectedArtist(ctx: ApiContext, tx: Tx, account: unknown, name: string | null, artistId: string | null, defaultIdentity: boolean): Promise<string | null> {
  if (!ctx.userId || !(await canEdit(ctx, account))) raise('Not authorized for creator account', '42501');
  const identity = await identityOf(tx, account);
  if (artistId != null) {
    const artist = await tx.first(`SELECT ${col('id')} FROM ${ARTISTS} WHERE ${col('id')} = ? AND (${col('publication_status')} = 'published' OR ${col('is_credit_only')} = 1 OR ${col('owner_creator_account_id')} = ?)`, artistId, account);
    if (!artist) raise('Selected artist is unavailable', '22023');
    return artist!.id as string;
  }
  if (cleanText(name) == null) return defaultIdentity ? identity : null;
  return resolveTrackCreditArtist(ctx, tx, account, name, false);
}

const TRACK_ARTISTS = t('music', 'track_artists');
const CONTRIBUTOR_ROLES = ['featured', 'composer', 'lyricist', 'arranger', 'producer', 'artwork'];

/** private.set_track_credit_refs: a track's main artist and contributors, by id or by name, all replaced. */
export async function setTrackCreditRefs(ctx: ApiContext, tx: Tx, trackId: unknown, account: unknown, mainName: string | null, mainId: string | null, contributors: unknown): Promise<void> {
  if (!ctx.userId || !(await canEdit(ctx, account))) raise('Not authorized for creator account', '42501');
  if (!(await tx.first(`SELECT 1 AS yes FROM ${t('music', 'tracks')} WHERE ${col('id')} = ? AND ${col('owner_creator_account_id')} = ?`, trackId, account))) raise('Track not owned by creator', '42501');
  const list = contributors === undefined ? [] : contributors;
  if (jsonbType(list) !== 'array') raise('Contributors must be a list', '22023');
  const main = await resolveSelectedArtist(ctx, tx, account, mainName, mainId, true);
  if (main == null) raise('Main artist is required', '22023');
  await tx.batch([
    tx.db.prepare(`DELETE FROM ${TRACK_ARTISTS} WHERE ${col('track_id')} = ?`).bind(trackId),
    tx.db.prepare(`INSERT INTO ${TRACK_ARTISTS} (${col('track_id')}, ${col('artist_id')}, ${col('role')}, ${col('sort_order')}, ${col('created_at')}) VALUES (?, ?, 'primary', 0, ?)`).bind(trackId, main, tx.at),
  ]);
  let n = 0;
  for (const entry of list as unknown[]) {
    n += 1;
    const roleText = cleanText(arrowText(entry, 'role'));
    const role = roleText == null ? null : roleText.toLowerCase();
    const name = cleanText(arrowText(entry, 'name'));
    if (role != null && !CONTRIBUTOR_ROLES.includes(role)) raise('Unsupported contributor role', '22023');
    const artistText = arrowText(entry, 'artistId');
    if (name == null && (artistText == null || artistText === '')) raise('Contributor name required', '22023');
    const contributor = await resolveSelectedArtist(ctx, tx, account, name, artistText === '' ? null : toUuid(artistText), false);
    if (contributor != null && !(role === 'featured' && contributor === main)) {
      if (role == null) raise('null value in column "role" of relation "track_artists" violates not-null constraint', '23502');
      await tx.run(`INSERT INTO ${TRACK_ARTISTS} (${col('track_id')}, ${col('artist_id')}, ${col('role')}, ${col('sort_order')}, ${col('created_at')}) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT (${col('track_id')}, ${col('artist_id')}, ${col('role')}) DO UPDATE SET ${col('sort_order')} = min(${TRACK_ARTISTS}.${col('sort_order')}, excluded.${col('sort_order')})`,
      trackId, contributor, role, n, tx.at);
    }
  }
}

/** private.set_track_credits: the main artist (or the account's identity) and featured artists by id; other roles kept. */
export async function setTrackCredits(tx: Tx, trackId: unknown, account: unknown, mainId: string | null, featured: (string | null)[] | null): Promise<void> {
  const accountRow = await tx.first(`SELECT ${col('identity_artist_id')} AS identity FROM ${ACCOUNTS} WHERE ${col('id')} = ?`, account);
  const main = accountRow ? (mainId ?? (accountRow.identity as string | null)) : null;
  if (main == null) raise('No main artist for this track and the account has no artist identity', '22023');
  if (!(await tx.first(`SELECT 1 AS yes FROM ${ARTISTS} WHERE ${col('id')} = ?`, main))) raise('Main artist not found', 'P0002');
  const statements = [
    tx.db.prepare(`DELETE FROM ${TRACK_ARTISTS} WHERE ${col('track_id')} = ? AND ${col('role')} IN ('primary', 'featured')`).bind(trackId),
    tx.db.prepare(`INSERT INTO ${TRACK_ARTISTS} (${col('track_id')}, ${col('artist_id')}, ${col('role')}, ${col('sort_order')}, ${col('created_at')}) VALUES (?, ?, 'primary', 0, ?)`).bind(trackId, main, tx.at),
  ];
  let position = 1;
  for (const id of featured ?? []) {
    if (id != null && id !== main) {
      statements.push(tx.db.prepare(`INSERT INTO ${TRACK_ARTISTS} (${col('track_id')}, ${col('artist_id')}, ${col('role')}, ${col('sort_order')}, ${col('created_at')}) VALUES (?, ?, 'featured', ?, ?)
        ON CONFLICT (${col('track_id')}, ${col('artist_id')}, ${col('role')}) DO NOTHING`).bind(trackId, id, position, tx.at));
      position += 1;
    }
  }
  await tx.batch(statements);
}

/** The featured artist ids of an entry (jsonb_array_elements_text, cast to uuid, blanks left out). */
export function featuredIds(entry: unknown): string[] | null {
  const list = arrow(entry, 'featuredArtistIds');
  const values = arrayElements(list === undefined || list === null ? [] : list).map((value) => (value === null ? null : typeof value === 'string' ? value : jsonbText(value)))
    .filter((value): value is string => value != null && value !== '');
  return values.length ? values.map((value) => toUuid(value)!) : null;
}

/** private.resolve_learning_submission_artist: the chosen or named artist, and the cantor that stands for it in learning. */
export async function resolveLearningArtist(ctx: ApiContext, tx: Tx, account: unknown, artistId: string | null, displayName: string | null): Promise<string> {
  if (!ctx.userId || !(await canEdit(ctx, account))) raise('Not authorized to select an artist for this workspace', '42501');
  let artist: Row | null;
  if (artistId != null) {
    // Older Coptic Vine Artists forms send a cantor's id.
    const cantor = await tx.first(`SELECT ${col('artist_id')} AS artist FROM ${t('learning', 'cantors')} WHERE ${col('id')} = ?`, artistId);
    const actual = (cantor?.artist as string | null | undefined) ?? artistId;
    artist = await tx.first(`SELECT * FROM ${ARTISTS} WHERE ${col('id')} = ? AND (${col('publication_status')} = 'published' OR ${col('is_credit_only')} = 1 OR ${col('owner_creator_account_id')} = ?)`, actual, account);
    if (!artist) raise('The selected artist is unavailable', '22023');
  } else {
    const clean = cleanText(displayName);
    if (clean == null) raise('Enter an artist name or choose an existing profile', '22023');
    artist = (await artistsNamed(tx, clean!)).sort((a, b) => trueFirst(a.publication_status === 'published', b.publication_status === 'published')
      || trueFirst(a.owner_creator_account_id != null, b.owner_creator_account_id != null) || trueFirst(a.profile_image_asset_id != null, b.profile_image_asset_id != null)
      || order.ascNullsLast(a.created_at, b.created_at))[0] ?? null;
    if (!artist) {
      const id = crypto.randomUUID();
      artist = await tx.writeFirst(`INSERT INTO ${ARTISTS} (${['id', 'display_name', 'created_by', 'updated_by', 'created_at', 'updated_at'].map(col).join(', ')}) VALUES (?, ?, ?, ?, ?, ?) RETURNING *`,
        id, clean, ctx.userId, ctx.userId, tx.at, tx.at);
    }
  }
  const published = artist!.publication_status === 'published' || artist!.is_credit_only === 1;
  const legacy = await tx.first(`SELECT ${col('id')} FROM ${t('learning', 'cantors')} WHERE ${col('artist_id')} = ? LIMIT 1`, artist!.id);
  if (!legacy) {
    const id = crypto.randomUUID();
    await tx.run(`INSERT INTO ${t('learning', 'cantors')} (${['id', 'artist_id', 'owner_creator_account_id', 'display_name', 'profile_image_asset_id', 'publication_status', 'metadata', 'created_by', 'updated_by', 'created_at', 'updated_at'].map(col).join(', ')})
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, id, artist!.id, account, artist!.display_name, artist!.profile_image_asset_id, published ? 'published' : 'draft',
    jsonbText({ canonicalArtistId: artist!.id, artistBridge: true }), ctx.userId, ctx.userId, tx.at, tx.at);
    return id;
  }
  await tx.run(`UPDATE ${t('learning', 'cantors')} SET ${col('publication_status')} = CASE WHEN ? THEN 'published' ELSE ${col('publication_status')} END,
    ${col('profile_image_asset_id')} = coalesce(?, ${col('profile_image_asset_id')}), ${col('updated_at')} = ? WHERE ${col('id')} = ?`, published ? 1 : 0, artist!.profile_image_asset_id, tx.at, legacy.id);
  return legacy.id as string;
}

// ── Releases and tracks ───────────────────────────────────────────────────

const RELEASE_TRACKS = t('music', 'release_tracks');

/** private.cleanup_orphan_music_track: a track on no release is deleted; whether it was. */
export async function cleanupOrphanTrack(tx: Tx, trackId: unknown): Promise<boolean> {
  if (await tx.first(`SELECT 1 AS yes FROM ${RELEASE_TRACKS} WHERE ${col('track_id')} = ?`, trackId)) return false;
  return (await tx.run(`DELETE FROM ${t('music', 'tracks')} WHERE ${col('id')} = ?`, trackId)).meta.changes > 0;
}

/** private.renumber_music_release_tracks: disc 1, numbered 1… in their order. */
export async function renumberReleaseTracks(tx: Tx, releaseId: unknown): Promise<void> {
  await tx.batch([
    tx.db.prepare(`UPDATE ${RELEASE_TRACKS} SET ${col('track_number')} = ${col('track_number')} + 100000 WHERE ${col('release_id')} = ?`).bind(releaseId),
    tx.db.prepare(`WITH ordered AS (SELECT ${col('id')} AS id, row_number() OVER (ORDER BY ${col('disc_number')}, ${col('track_number')}, ${col('created_at')}, ${col('id')}) AS n
        FROM ${RELEASE_TRACKS} WHERE ${col('release_id')} = ?)
      UPDATE ${RELEASE_TRACKS} SET ${col('disc_number')} = 1, ${col('track_number')} = ordered.n FROM ordered WHERE ${RELEASE_TRACKS}.${col('id')} = ordered.id`).bind(releaseId),
  ]);
}

/** private.delete_music_release_core: the release, then the tracks it leaves on no release. */
export async function deleteReleaseCore(tx: Tx, releaseId: unknown): Promise<Row> {
  if (!(await tx.first(`SELECT 1 AS yes FROM ${t('music', 'releases')} WHERE ${col('id')} = ?`, releaseId))) raise('Release not found', 'P0002');
  const tracks = (await tx.all(`SELECT ${col('track_id')} AS id FROM ${RELEASE_TRACKS} WHERE ${col('release_id')} = ?`, releaseId)).map((row) => row.id);
  await tx.run(`DELETE FROM ${t('music', 'releases')} WHERE ${col('id')} = ?`, releaseId);
  let deleted = 0;
  for (const track of tracks) if (await cleanupOrphanTrack(tx, track)) deleted += 1;
  return { releaseId, deleted: true, deletedTrackCount: deleted };
}

/** private.delete_music_release_track_core: a track off a release (never its last), deleted if on no other, the rest renumbered. */
export async function deleteReleaseTrackCore(tx: Tx, releaseId: unknown, trackId: unknown): Promise<Row> {
  if (!(await tx.first(`SELECT 1 AS yes FROM ${t('music', 'releases')} WHERE ${col('id')} = ?`, releaseId))) raise('Release not found', 'P0002');
  if (!(await tx.first(`SELECT 1 AS yes FROM ${RELEASE_TRACKS} WHERE ${col('release_id')} = ? AND ${col('track_id')} = ?`, releaseId, trackId))) raise('Track does not belong to this release', 'P0002');
  const total = (await tx.first(`SELECT count(*) AS n FROM ${RELEASE_TRACKS} WHERE ${col('release_id')} = ?`, releaseId))!.n as number;
  if (total <= 1) raise('A release needs at least one track. Delete the release instead.', '22023');
  await tx.run(`DELETE FROM ${RELEASE_TRACKS} WHERE ${col('release_id')} = ? AND ${col('track_id')} = ?`, releaseId, trackId);
  const trackDeleted = await cleanupOrphanTrack(tx, trackId);
  await renumberReleaseTracks(tx, releaseId);
  const remaining = (await tx.first(`SELECT count(*) AS n FROM ${RELEASE_TRACKS} WHERE ${col('release_id')} = ?`, releaseId))!.n;
  const type = (await tx.first(`SELECT ${col('release_type')} AS type FROM ${t('music', 'releases')} WHERE ${col('id')} = ?`, releaseId))?.type ?? null;
  return { releaseId, trackId, trackDeleted, remainingTrackCount: remaining, releaseType: type };
}

/** private.music_submission_has_pending_edits: a file waiting to replace another, an unpublished track, or newer artwork than the cover. */
export async function musicSubmissionHasPendingEdits(tx: Tx, submissionId: unknown): Promise<boolean> {
  const release = `nullif(json_extract(r.${col('metadata')}, '$.submissionId'), '') = ?`;
  return Boolean(await tx.first(`SELECT (EXISTS (SELECT 1 FROM ${ITEMS} WHERE ${col('submission_id')} = ? AND ${col('replaces_item_id')} IS NOT NULL)
    OR EXISTS (SELECT 1 FROM ${t('music', 'releases')} r JOIN ${RELEASE_TRACKS} rt ON rt.${col('release_id')} = r.${col('id')} JOIN ${t('music', 'tracks')} tr ON tr.${col('id')} = rt.${col('track_id')}
      WHERE ${release} AND tr.${col('publication_status')} <> 'published')
    OR EXISTS (SELECT 1 FROM ${t('music', 'releases')} r JOIN ${ITEMS} item ON item.${col('submission_id')} = ? AND item.${col('role')} = 'artwork' AND item.${col('media_asset_id')} IS NOT NULL
        AND item.${col('media_asset_id')} IS NOT r.${col('cover_asset_id')}
      WHERE ${release} AND item.${col('created_at')} > coalesce((SELECT max(c.${col('created_at')}) FROM ${ITEMS} c WHERE c.${col('submission_id')} = ? AND c.${col('media_asset_id')} = r.${col('cover_asset_id')}), ''))) AS yes`,
  submissionId, submissionId, submissionId, submissionId, submissionId).then((row) => row?.yes));
}

/** A value bound once, however often the condition names it. */
const ARG = `(SELECT ${col('v')} FROM ${col('arg')})`;
const holds = async (tx: Tx, condition: string, value: unknown) =>
  Boolean((await tx.first(`WITH ${col('arg')} (${col('v')}) AS (VALUES (?)) SELECT ${condition} AS ok`, value))?.ok);

/** private.submission_required_items_ready, as a value. */
export const requiredReady = (tx: Tx, submissionId: unknown) => holds(tx, requiredItemsReady(ARG), submissionId);

/** private.submission_item_media_ready, as a value. */
export const itemReady = (tx: Tx, itemId: unknown) => holds(tx, itemMediaReady(ARG), itemId);
