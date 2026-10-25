/**
 * 0033_video_audio_copies.sql: a video lesson converted before the processor
 * made its audio-only copy in the same pass has none, so "Audio only" streamed
 * the whole video. The migration queues the copy from the kept original; the
 * processor's claim and completion then hand it to the published lesson, and
 * the original may go.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { before, test } from 'node:test';
import { migration } from './lib/d1.ts';
import { WorkerSide } from './lib/worker.ts';

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ALICE = uid(1); const ACCOUNT = uid(2); const CANTOR = uid(3); const HYMN = uid(4); const SET = uid(5);
const VIDEO_INTENT = uid(10); const VIDEO_ASSET = uid(11); const VIDEO_JOB = uid(12); const SUBMISSION = uid(13); const ITEM = uid(14); const LESSON = uid(15);
const GONE_INTENT = uid(20); const DONE_INTENT = uid(30);
const TOKEN = 'audio-copy-worker-token';
const PAST = '2026-10-17T08:07:18+00:00';
const FUTURE = '2099-01-01T00:00:00+00:00';

let worker: WorkerSide;
const rows = (sql: string, ...params: unknown[]) => worker.db.prepare(sql).all(...(params as never[])).map((row) => ({ ...(row as object) })) as Record<string, unknown>[];
const insert = (table: string, values: Record<string, unknown>) => worker.db
  .prepare(`INSERT INTO "${table}" (${Object.keys(values).map((k) => `"${k}"`).join(', ')}) VALUES (${Object.keys(values).map(() => '?').join(', ')})`)
  .run(...(Object.values(values) as never[]));
const asWorker = (fn: string, args: Record<string, unknown> = {}) => worker.rpc(null, fn, { p_worker_token: TOKEN, ...args });

function videoUpload(intentId: string, extra: Record<string, unknown> = {}) {
  insert('media.upload_intents', {
    id: intentId, creator_account_id: ACCOUNT, requested_by: ALICE, bucket: 'chc-submissions', path: `submissions/${ACCOUNT}/${intentId}/original.mov`, media_type: 'video',
    original_filename: 'lesson.mov', content_type: 'video/quicktime', content_length: 3_240_790_937, status: 'uploaded', upload_expires_at: FUTURE, ...extra,
  });
}

before(async () => {
  worker = new WorkerSide();
  await worker.addUser(ALICE, 'alice@audio-copy.test');
  worker.db.exec('UPDATE "private.replica_mode" SET "depth" = "depth" + 1');
  insert('creator.creator_accounts', { id: ACCOUNT, display_name: 'Cantor Choir', created_by: ALICE });
  insert('private.media_worker_tokens', { name: 'processor', token_hash: createHash('sha256').update(TOKEN).digest('hex') });
  insert('learning.cantors', { id: CANTOR, display_name: 'Cantor' });
  insert('learning.hymns', { id: HYMN, title: 'Teen Anastaseen' });
  insert('learning.lesson_sets', { id: SET, cantor_id: CANTOR, hymn_id: HYMN, title: 'Teen Anastaseen', publication_status: 'published' });

  // The lesson as production had it: its video made on 2026-10-17, no audio-only copy, the original kept.
  videoUpload(VIDEO_INTENT);
  insert('media.media_assets', {
    id: VIDEO_ASSET, owner_creator_account_id: ACCOUNT, bucket: 'chc-learning', path: `processed/${ACCOUNT}/${VIDEO_INTENT}/v1/video.mp4`, media_type: 'video',
    mime_type: 'video/mp4', duration_ms: 2_675_340, processing_status: 'completed', publication_status: 'published',
  });
  insert('media.media_processing_jobs', {
    id: VIDEO_JOB, upload_intent_id: VIDEO_INTENT, job_type: 'video_delivery', status: 'completed', attempt_count: 3, input_bucket: 'chc-submissions',
    input_path: `submissions/${ACCOUNT}/${VIDEO_INTENT}/original.mov`, output_bucket: 'chc-learning', output_path: `processed/${ACCOUNT}/${VIDEO_INTENT}/v1/video.mp4`,
    media_asset_id: VIDEO_ASSET, finished_at: PAST,
  });
  insert('media.submissions', { id: SUBMISSION, creator_account_id: ACCOUNT, submission_type: 'learning_lesson_set', title: 'Teen Anastaseen', status: 'published', created_by: ALICE });
  insert('media.submission_items', { id: ITEM, submission_id: SUBMISSION, upload_intent_id: VIDEO_INTENT, media_asset_id: VIDEO_ASSET, media_processing_job_id: VIDEO_JOB, role: 'lesson', title: 'Lesson 1' });
  insert('learning.lessons', {
    id: LESSON, lesson_set_id: SET, media_asset_id: VIDEO_ASSET, media_type: 'video', title: 'Lesson 1', duration_ms: 2_675_340, sort_order: 1,
    publication_status: 'published', metadata: JSON.stringify({ submissionItemId: ITEM }),
  });

  // Neither of these is queued again: one's original was removed, the other already has its copy.
  videoUpload(GONE_INTENT, { original_deleted_at: PAST });
  insert('media.media_processing_jobs', { upload_intent_id: GONE_INTENT, job_type: 'video_delivery', status: 'completed', input_bucket: 'chc-submissions', input_path: 'in/gone', output_bucket: 'chc-learning', media_asset_id: VIDEO_ASSET });
  videoUpload(DONE_INTENT);
  insert('media.media_processing_jobs', { upload_intent_id: DONE_INTENT, job_type: 'video_delivery', status: 'completed', input_bucket: 'chc-submissions', input_path: 'in/done', output_bucket: 'chc-learning', media_asset_id: VIDEO_ASSET });
  insert('media.media_processing_jobs', { upload_intent_id: DONE_INTENT, job_type: 'audio_delivery', status: 'completed', input_bucket: 'chc-submissions', input_path: 'in/done', output_bucket: 'chc-learning' });
  worker.db.exec('UPDATE "private.replica_mode" SET "depth" = "depth" - 1');

  worker.db.exec(migration('0033_video_audio_copies.sql'));
});

test('the migration queues the missing audio-only copy, read from the kept original, written beside the video', () => {
  const queued = rows(`SELECT "upload_intent_id", "status", "attempt_count", "input_bucket", "input_path", "output_bucket", "output_path", "queued_at", "available_at"
    FROM "media.media_processing_jobs" WHERE "job_type" = 'audio_delivery' AND "status" = 'queued'`);
  assert.equal(queued.length, 1, 'only the video with its original and without a copy');
  const [job] = queued;
  assert.equal(job.upload_intent_id, VIDEO_INTENT);
  assert.equal(job.attempt_count, 0);
  assert.deepEqual([job.input_bucket, job.input_path], ['chc-submissions', `submissions/${ACCOUNT}/${VIDEO_INTENT}/original.mov`]);
  assert.deepEqual([job.output_bucket, job.output_path], ['chc-learning', `processed/${ACCOUNT}/${VIDEO_INTENT}/v1/audio.m4a`]);
  // Stamped as cv-api stamps them, and due now.
  assert.match(String(job.queued_at), /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?\+00:00$/);
  assert.ok(Date.parse(String(job.available_at)) <= Date.now());
  assert.deepEqual(rows('SELECT "current", "at" FROM "private.transaction"'), [{ current: null, at: null }]);
  assert.deepEqual(rows('SELECT count(*) AS n FROM "private.undo_log"'), [{ n: 0 }]);
  // The processor is woken for it.
  assert.deepEqual(rows(`SELECT "kind" FROM "private.outbox" WHERE "kind" = 'wake_media_processor'`), [{ kind: 'wake_media_processor' }]);
});

test('applied twice, it queues nothing more', () => {
  worker.db.exec(migration('0033_video_audio_copies.sql'));
  assert.deepEqual(rows(`SELECT count(*) AS n FROM "media.media_processing_jobs" WHERE "upload_intent_id" = ? AND "job_type" = 'audio_delivery'`, VIDEO_INTENT), [{ n: 1 }]);
});

test('the processor makes it, the published lesson plays its sound from it, and the original may go', async () => {
  const claimed = await asWorker('claim_media_processing_job', { p_worker_id: 'cloudflare-container' });
  assert.equal(claimed.error, null);
  const [job] = claimed.data as { job_id: string; job_type: string; media_type: string; input_path: string }[];
  assert.deepEqual([job.job_type, job.media_type, job.input_path], ['audio_delivery', 'video', `submissions/${ACCOUNT}/${VIDEO_INTENT}/original.mov`]);

  const done = await asWorker('complete_media_processing_job', {
    p_job_id: job.job_id, p_output_mime_type: 'audio/mp4', p_output_size_bytes: 60_215_871, p_output_checksum_sha256: 'b'.repeat(64),
    p_probe: { output: { format: { duration: '2675.291995' }, streams: [{ codec_type: 'audio', codec_name: 'aac' }] } },
  });
  assert.equal(done.error, null);

  const [lesson] = rows('SELECT "audio_asset_id", "media_asset_id" FROM "learning.lessons" WHERE "id" = ?', LESSON);
  assert.ok(lesson.audio_asset_id, 'the lesson has its audio-only copy');
  assert.equal(lesson.media_asset_id, VIDEO_ASSET, 'and keeps its picture');
  assert.deepEqual(rows('SELECT "media_type", "mime_type", "path", "publication_status", "file_size_bytes" FROM "media.media_assets" WHERE "id" = ?', lesson.audio_asset_id), [{
    media_type: 'audio', mime_type: 'audio/mp4', path: `processed/${ACCOUNT}/${VIDEO_INTENT}/v1/audio.m4a`, publication_status: 'published', file_size_bytes: 60_215_871,
  }]);
  assert.deepEqual(rows('SELECT "audio_only_asset_id" FROM "media.submission_items" WHERE "id" = ?', ITEM), [{ audio_only_asset_id: lesson.audio_asset_id }]);

  // With the picture and the sound both made, the original is handed out for deletion.
  const deletion = await asWorker('claim_media_original_deletion', { p_upload_intent_id: VIDEO_INTENT });
  assert.deepEqual(deletion.data, [{ bucket: 'chc-submissions', path: `submissions/${ACCOUNT}/${VIDEO_INTENT}/original.mov` }]);
});
