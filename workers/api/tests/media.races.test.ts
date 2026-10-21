/**
 * Two callers at once on the media queue and uploads (src/rpc/workers/media.ts,
 * uploads.ts). Postgres settled these with row locks (FOR UPDATE, SKIP
 * LOCKED); D1 has none, so each claim or completion writes only while what it
 * read still holds. Each test stops one caller just before its write, lets
 * the other (or an admin) finish, then lets the first go on: the outcome is
 * what Postgres's locks gave.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { before, test } from 'node:test';
import { d1 } from './lib/d1.ts';
import { WorkerSide } from './lib/worker.ts';

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ALICE = uid(1); const ACCOUNT = uid(2);
const TOKEN = 'race-worker-token';
const PAST = '2026-01-01T00:00:00+00:00';
const FUTURE = '2099-01-01T00:00:00+00:00';

let worker: WorkerSide;
let pause: { pattern: RegExp; meanwhile: () => Promise<unknown> } | null = null;

/** Runs first, stopping it at its first write that matches pattern while meanwhile runs to the end; both answers. */
async function interleave<A, B>(pattern: RegExp, first: () => Promise<A>, meanwhile: () => Promise<B>): Promise<[A, B]> {
  let other: Promise<B> | undefined;
  pause = { pattern, meanwhile: () => (other = meanwhile()) };
  const answer = await first();
  assert.ok(other, `the first caller never reached ${pattern}`);
  return [answer, await other];
}

const rows = (sql: string, ...params: unknown[]) => worker.db.prepare(sql).all(...(params as never[])).map((row) => ({ ...(row as object) })) as Record<string, unknown>[];
const exec = (sql: string, ...params: unknown[]) => worker.db.prepare(sql).run(...(params as never[]));
const call = (user: string | null, fn: string, args: Record<string, unknown>) => worker.rpc(user, fn, args);
const asWorker = (fn: string, args: Record<string, unknown> = {}) => call(null, fn, { p_worker_token: TOKEN, ...args });

before(async () => {
  worker = new WorkerSide();
  await worker.addUser(ALICE, 'alice@race.test');
  exec('INSERT INTO "creator.creator_accounts" ("id", "display_name", "created_by") VALUES (?, ?, ?)', ACCOUNT, 'Race Choir', ALICE);
  exec('INSERT INTO "creator.creator_account_members" ("creator_account_id", "user_id", "role") VALUES (?, ?, ?)', ACCOUNT, ALICE, 'owner');
  exec('INSERT INTO "creator.user_roles" ("user_id", "role") VALUES (?, ?)', ALICE, 'admin');
  exec('INSERT INTO "private.media_worker_tokens" ("name", "token_hash") VALUES (?, ?)', 'race', createHash('sha256').update(TOKEN).digest('hex'));
  // The Worker's own database from here on, with the pause: the meanwhile caller runs with it off.
  worker.env.DB = d1(worker.db, {
    before: async (sql) => {
      if (!pause || !pause.pattern.test(sql)) return;
      const { meanwhile } = pause;
      pause = null;
      await meanwhile();
    },
  });
});

function intent(n: number, extra: Record<string, unknown> = {}): string {
  const values = { id: uid(n), creator_account_id: ACCOUNT, requested_by: ALICE, bucket: 'chc-submissions', path: `submissions/${ACCOUNT}/${uid(n)}/original`, media_type: 'audio',
    original_filename: `file-${n}`, content_type: 'audio/mpeg', content_length: 10, status: 'uploaded', upload_expires_at: FUTURE, ...extra };
  exec(`INSERT INTO "media.upload_intents" (${Object.keys(values).map((k) => `"${k}"`).join(', ')}) VALUES (${Object.keys(values).map(() => '?').join(', ')})`, ...Object.values(values));
  return uid(n);
}

function job(n: number, intentId: string | null, type: string, status: string, extra: Record<string, unknown> = {}): string {
  const values = { id: uid(n), upload_intent_id: intentId, job_type: type, status, input_bucket: 'chc-submissions', input_path: `in/${n}`, output_bucket: 'chc-music',
    output_path: `out/${n}`, available_at: PAST, ...extra };
  exec(`INSERT INTO "media.media_processing_jobs" (${Object.keys(values).map((k) => `"${k}"`).join(', ')}) VALUES (${Object.keys(values).map(() => '?').join(', ')})`, ...Object.values(values));
  return uid(n);
}

test('two workers claiming at once: the job goes to one, claimed once', async () => {
  const queued = job(100, intent(10), 'audio_delivery', 'queued');
  const [first, second] = await interleave(/SET "status" = 'processing', "attempt_count" = "attempt_count" \+ 1/,
    () => asWorker('claim_media_processing_job', { p_worker_id: 'worker-a' }), () => asWorker('claim_media_processing_job', { p_worker_id: 'worker-b' }));
  assert.deepEqual(first.data, [], 'the first worker finds the job already taken');
  assert.equal((second.data as { job_id: string }[])[0].job_id, queued);
  assert.deepEqual(rows('SELECT "status", "attempt_count", "worker_id" FROM "media.media_processing_jobs" WHERE "id" = ?', queued), [{ status: 'processing', attempt_count: 1, worker_id: 'worker-b' }]);
});

test("two workers claiming a video's audio-only copy at once: one gets it", async () => {
  const video = intent(20, { media_type: 'video', content_type: 'video/mp4' });
  const videoJob = job(200, video, 'video_delivery', 'processing', { claimed_at: new Date().toISOString().replace('Z', '+00:00'), attempt_count: 1, worker_id: 'worker-a' });
  const [first, second] = await interleave(/SET "status" = 'processing',\s+"attempt_count" = CASE/,
    () => asWorker('claim_companion_media_processing_job', { p_job_id: videoJob, p_worker_id: 'worker-a' }),
    () => asWorker('claim_companion_media_processing_job', { p_job_id: videoJob, p_worker_id: 'worker-b' }));
  assert.deepEqual(first.data, []);
  assert.equal((second.data as { attempt_count: number }[])[0].attempt_count, 1);
  assert.deepEqual(rows(`SELECT "status", "attempt_count", "worker_id" FROM "media.media_processing_jobs" WHERE "upload_intent_id" = ? AND "job_type" = 'audio_delivery'`, video),
    [{ status: 'processing', attempt_count: 1, worker_id: 'worker-b' }]);
});

test("a video's original claimed for deletion twice at once: handed out once", async () => {
  const video = intent(30, { media_type: 'video', content_type: 'video/mp4' });
  exec(`INSERT INTO "media.media_assets" ("id", "owner_creator_account_id", "bucket", "path", "media_type", "processing_status") VALUES (?, ?, 'chc-music', 'out/300', 'video', 'completed')`, uid(31), ACCOUNT);
  job(300, video, 'video_delivery', 'completed', { media_asset_id: uid(31) });
  job(301, video, 'audio_delivery', 'cancelled', { error_message: 'No audio track: the video has no sound' });
  const [first, second] = await interleave(/SET "original_deleted_at" = \?/,
    () => asWorker('claim_media_original_deletion', { p_upload_intent_id: video }), () => asWorker('claim_media_original_deletion', { p_upload_intent_id: video }));
  assert.deepEqual(first.data, []);
  assert.deepEqual(second.data, [{ bucket: 'chc-submissions', path: `submissions/${ACCOUNT}/${video}/original` }]);
});

const completion = (jobId: string) => asWorker('complete_media_processing_job', {
  p_job_id: jobId, p_output_mime_type: 'audio/mp4', p_output_size_bytes: 100, p_output_checksum_sha256: 'a'.repeat(64), p_probe: {},
});

test("a job an admin cancels while its worker completes it stays cancelled, and the worker's file isn't kept", async () => {
  const claimed = job(400, intent(40), 'audio_delivery', 'processing', { attempt_count: 1, claimed_at: PAST });
  const [done, cancelled] = await interleave(/SET "status" = 'completed', "media_asset_id" = \?/,
    () => completion(claimed), () => call(ALICE, 'prepare_admin_processing_file_deletion', { p_job_id: claimed }));
  assert.equal(cancelled.error, null);
  assert.deepEqual([done.error?.code, done.error?.message], ['22023', 'Processing job is not claimed']);
  assert.deepEqual(rows('SELECT "status", "media_asset_id" FROM "media.media_processing_jobs" WHERE "id" = ?', claimed), [{ status: 'cancelled', media_asset_id: null }]);
  assert.deepEqual(rows(`SELECT "id" FROM "media.media_assets" WHERE "path" = 'out/400'`), []);
});

test('a job deleted while its worker completes it: not found, as Postgres would say', async () => {
  const claimed = job(500, intent(50), 'audio_delivery', 'processing', { attempt_count: 1, claimed_at: PAST });
  const [done] = await interleave(/SET "status" = 'completed', "media_asset_id" = \?/,
    () => completion(claimed), async () => exec('DELETE FROM "media.media_processing_jobs" WHERE "id" = ?', claimed));
  assert.deepEqual([done.error?.code, done.error?.message], ['P0002', 'Processing job not found']);
  assert.deepEqual(rows(`SELECT "id" FROM "media.media_assets" WHERE "path" = 'out/500'`), []);
});

test('an upload completed twice at once: once, the other told it is no longer authorized', async () => {
  const authorized = intent(60, { status: 'authorized' });
  const complete = () => call(ALICE, 'complete_media_upload_intent', { p_upload_intent_id: authorized, p_uploaded_size: 10, p_r2_http_etag: 'etag' });
  const [first, second] = await interleave(/SET "status" = 'uploaded'/, complete, complete);
  assert.equal(second.error, null);
  assert.deepEqual([first.error?.code, first.error?.message], ['22023', 'Upload intent is not authorized']);
  assert.deepEqual(rows('SELECT "status", "uploaded_size" FROM "media.upload_intents" WHERE "id" = ?', authorized), [{ status: 'uploaded', uploaded_size: 10 }]);
});
