/**
 * Parity: the media processor's queue (src/rpc/workers/media.ts), the Worker
 * against Supabase's own functions (the oracle), over
 * tests/lib/creatorCatalog.ts plus jobs in every state: due, blocked behind
 * their video, out of attempts, not yet due, stale with attempts left or
 * none, and claimed jobs to complete, fail, skip and release. What a finished
 * job settles is covered too: a submission in processing approved again, a
 * live release taking a replacement file, a live lesson set taking a new
 * lesson, and an artist's pending photo. After every call every table the
 * queue writes is compared, generated ids renamed (tests/lib/tables.ts).
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { after, before, test } from 'node:test';
import { A1, ALICE, BOB, C1, CAROL, H1, id, intent, job, K1, S2, seedCatalog } from './lib/creatorCatalog.ts';
import { createOracle, type Oracle, type PgAnswer } from './lib/oracle.ts';
import { seed } from './lib/seed.ts';
import { bothTables, firstDifferences } from './lib/tables.ts';
import { normalize, WorkerSide, type Answer } from './lib/worker.ts';

const AT = '2026-03-10T08:00:00+00:00';
const ago = (hours: number) => `${new Date(Date.now() - hours * 3600_000).toISOString().replace('Z', '')}+00:00`;
const later = (days: number) => `${new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 13)}:00:00+00:00`;
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');
const TOKEN = 'media-worker-secret';

const X = (n: number) => id(610 + n);
const STALE_JOB = id(630); const DEAD_JOB = id(631); const IMAGE_JOB = id(632); const PROCESSING_JOB = id(633); const REPLACEMENT_JOB = id(634); const LESSON_JOB = id(635);
const VIDEO_JOB = id(636); const RETRY_JOB = id(637); const LAST_TRY_JOB = id(638); const SILENT_JOB = id(639); const RELEASE_JOB = id(641); const BLOCKED_AUDIO = id(642);
const QUEUED_VIDEO = id(643); const COMPANION_VIDEO = id(644); const NO_PATH_JOB = id(647); const PROBE_JOB = id(648); const NO_INTENT_JOB = id(649);
const SPRC = id(650); const SPUB = id(653); const RP = id(654); const TP = id(655); const SVID = id(658); const SLS = id(659); const LSP = id(660);

let oracle: Oracle;
let worker: WorkerSide;
const seeded = new Set(Array.from({ length: 700 }, (_, n) => id(n)));

const TABLES = [
  'media.media_processing_jobs', 'media.upload_intents', 'media.media_assets', 'media.media_asset_versions', 'media.submission_items', 'media.submissions', 'media.submission_events',
  'music.artists', 'music.artist_localizations', 'music.tracks', 'music.track_localizations', 'music.releases', 'music.release_localizations', 'learning.lessons', 'learning.lesson_sets',
  'learning.album_recordings', 'public.notifications', 'private.notification_deliveries', 'media.search_documents',
];

before(async () => {
  oracle = await createOracle();
  worker = new WorkerSide();
  await seedCatalog(oracle, worker);
  // The catalog's jobs are due when they were made (their default is the moment they were seeded, which differs between the sides).
  await oracle.sql('set session_replication_role = replica');
  await oracle.sql('update media.media_processing_jobs set available_at = created_at');
  await oracle.sql('set session_replication_role = origin');
  worker.db.exec('UPDATE "private.replica_mode" SET "depth" = "depth" + 1');
  worker.db.exec('UPDATE "media.media_processing_jobs" SET "available_at" = "created_at"');
  worker.db.exec('UPDATE "private.replica_mode" SET "depth" = "depth" - 1');
  const stamps = { created_at: AT, updated_at: AT };
  const upload = (n: number, type: string) => ({
    id: X(n), creator_account_id: C1, requested_by: ALICE, bucket: 'chc-submissions', media_type: type, path: `submissions/${C1}/${X(n)}/original`, original_filename: `x-${n}`,
    content_type: `${type}/x`, content_length: 10, status: 'uploaded', upload_expires_at: AT, uploaded_size: 10, uploaded_at: AT, ...stamps,
  });
  const work = (jobId: string, intentId: string | null, type: string, status: string, extra: Record<string, unknown> = {}) => ({
    id: jobId, upload_intent_id: intentId, job_type: type, status, input_bucket: 'chc-submissions', input_path: `in/${jobId.slice(-3)}`, output_bucket: type === 'image_delivery' ? 'chc-images' : 'chc-music',
    output_path: `processed/${C1}/${intentId}/v1/${type === 'image_delivery' ? 'cover.jpg' : type === 'video_delivery' ? 'video.mp4' : 'audio.m4a'}`,
    attempt_count: 1, max_attempts: 3, available_at: AT, ...stamps, ...extra,
  });
  const claimed = { claimed_at: ago(0.1), started_at: ago(0.1), worker_id: 'w-0', progress: 0.25 };
  await seed(oracle, worker, [
    ['private.media_worker_tokens', [
      { id: id(670), name: 'processor', token_hash: sha256(TOKEN), created_at: AT },
      { id: id(671), name: 'retired', token_hash: sha256('retired-secret'), revoked_at: AT, created_at: AT },
    ]],
    ['media.media_assets', [{ id: id(160), owner_creator_account_id: C1, bucket: 'chc-music', path: 'video/160', media_type: 'video', duration_ms: 9000, processing_status: 'completed', publication_status: 'draft', ...stamps }]],
    ['media.upload_intents', [
      upload(0, 'audio'), upload(1, 'audio'), upload(2, 'audio'), upload(3, 'video'), upload(4, 'audio'), upload(5, 'audio'), upload(6, 'video'), upload(7, 'audio'),
      upload(8, 'audio'), upload(9, 'audio'), upload(10, 'video'), upload(11, 'video'), upload(12, 'audio'), upload(13, 'audio'),
    ]],
    ['media.media_processing_jobs', [
      // Stale: one with attempts left (requeued by the next claim), one without (failed by it).
      work(STALE_JOB, X(8), 'audio_delivery', 'processing', { claimed_at: ago(3), worker_id: 'gone' }),
      work(DEAD_JOB, X(9), 'audio_delivery', 'processing', { claimed_at: ago(3), attempt_count: 3, worker_id: 'gone' }),
      // Claimed by a live worker.
      work(IMAGE_JOB, intent(9), 'image_delivery', 'processing', claimed),
      work(PROCESSING_JOB, X(0), 'audio_delivery', 'processing', claimed),
      work(REPLACEMENT_JOB, X(1), 'audio_delivery', 'processing', claimed),
      work(LESSON_JOB, X(2), 'audio_delivery', 'processing', claimed),
      work(VIDEO_JOB, X(3), 'video_delivery', 'processing', claimed),
      work(RETRY_JOB, X(4), 'audio_delivery', 'processing', claimed),
      work(LAST_TRY_JOB, X(5), 'audio_delivery', 'processing', { ...claimed, attempt_count: 3 }),
      work(SILENT_JOB, X(6), 'audio_delivery', 'processing', claimed),
      work(id(640), X(6), 'video_delivery', 'completed', { media_asset_id: id(160), finished_at: AT }),
      work(RELEASE_JOB, X(7), 'audio_delivery', 'processing', { ...claimed, attempt_count: 2 }),
      // An audio copy waiting for its video, and the video, due after the catalog's jobs.
      work(BLOCKED_AUDIO, X(10), 'audio_delivery', 'queued', { attempt_count: 0, available_at: '2026-03-01T00:00:00+00:00' }),
      work(QUEUED_VIDEO, X(10), 'video_delivery', 'queued', { attempt_count: 0, available_at: '2026-03-05T08:00:00+00:00' }),
      work(COMPANION_VIDEO, X(11), 'video_delivery', 'processing', claimed),
      // Never claimed: out of attempts, or not due yet.
      work(id(645), X(12), 'audio_delivery', 'queued', { attempt_count: 3 }),
      work(id(646), X(13), 'audio_delivery', 'queued', { attempt_count: 0, available_at: later(5) }),
      // Can't be completed.
      work(NO_PATH_JOB, X(0), 'metadata_probe', 'processing', { ...claimed, output_path: null }),
      work(PROBE_JOB, X(1), 'metadata_probe', 'processing', { ...claimed, output_path: `processed/${C1}/${X(1)}/v1/metadata.json` }),
      work(NO_INTENT_JOB, null, 'audio_delivery', 'processing', { ...claimed, output_path: 'processed/orphan/audio.m4a' }),
    ]],
    ['media.submissions', [
      { id: SPRC, creator_account_id: C1, submission_type: 'music_release', title: 'In Processing', status: 'processing', reviewer_id: CAROL, created_by: ALICE, ...stamps },
      { id: SPUB, creator_account_id: C1, submission_type: 'music_release', title: 'Live With A Replacement', status: 'published', reviewer_id: CAROL, created_by: ALICE, ...stamps },
      { id: SVID, creator_account_id: C1, submission_type: 'music_release', title: 'Silent Clip', status: 'processing', reviewer_id: CAROL, created_by: ALICE, ...stamps },
      { id: SLS, creator_account_id: C1, submission_type: 'learning_lesson_set', title: 'Live Lessons', status: 'published', approved_at: AT, created_by: ALICE, ...stamps },
    ]],
    ['music.tracks', [{ id: TP, owner_creator_account_id: C1, title: 'Live Track', media_asset_id: id(113), duration_ms: 13000, publication_status: 'published', ...stamps }]],
    ['music.releases', [{ id: RP, owner_creator_account_id: C1, primary_artist_id: A1, release_type: 'single', title: 'Live With A Replacement', release_date: '2026-03-01',
      metadata: { submissionId: SPUB }, publication_status: 'published', ...stamps }]],
    ['music.release_tracks', [{ id: id(690), release_id: RP, track_id: TP, disc_number: 1, track_number: 1, created_at: AT }]],
    ['music.track_artists', [{ track_id: TP, artist_id: A1, role: 'primary', sort_order: 0, created_at: AT }]],
    ['learning.lesson_sets', [{ id: LSP, owner_creator_account_id: C1, cantor_id: K1, hymn_id: H1, submission_id: SLS, title: 'Live Lessons', publication_status: 'published', ...stamps }]],
    ['media.submission_items', [
      { id: id(651), submission_id: SPRC, role: 'track', title: 'Waiting', sort_order: 1, upload_intent_id: X(0), ...stamps },
      { id: id(652), submission_id: SPRC, role: 'track', title: 'Last try', sort_order: 2, upload_intent_id: X(5), required: false, ...stamps },
      { id: id(656), submission_id: SPUB, role: 'track', title: 'Live Track', sort_order: 1, media_asset_id: id(113), music_track_id: TP, ...stamps },
      { id: id(657), submission_id: SPUB, role: 'track', title: 'Live Track v2', sort_order: 1, upload_intent_id: X(1), replaces_item_id: id(656), music_track_id: TP, required: false, ...stamps },
      { id: id(661), submission_id: SVID, role: 'track', title: 'Clip', sort_order: 1, upload_intent_id: X(6), ...stamps },
      { id: id(662), submission_id: SLS, role: 'lesson', title: 'New Lesson', sort_order: 3, upload_intent_id: X(2), localized_titles: { ar: 'درس جديد' }, ...stamps },
      { id: id(663), submission_id: S2, role: 'track', title: 'Dead', sort_order: 9, upload_intent_id: X(9), required: false, ...stamps },
    ]],
  ]);
  await sameTables('seed');
});
after(() => oracle.close());

async function sameTables(what: string): Promise<void> {
  const { pg, sqlite } = await bothTables(oracle, worker, TABLES, seeded);
  if (pg !== sqlite) assert.fail(`${what}: the tables differ\n${firstDifferences(sqlite, pg).join('\n')}`);
}

/** Rows Postgres returns in its heap's order, which an update reshuffles: compared by id. */
const byJob = (data: unknown) => (Array.isArray(data) ? [...data].sort((a, b) => String(a.job_id).localeCompare(String(b.job_id))) : data);

function same(pg: PgAnswer, w: Answer, what: string, unordered: boolean): void {
  if (pg.error) {
    assert.ok(w.error, `${what}: Postgres refused (${pg.error.code} ${pg.error.message}); the Worker answered ${JSON.stringify(w.data)?.slice(0, 400)}`);
    assert.equal(w.error!.code, pg.error.code, `${what}: error code (${w.error!.message})`);
    assert.equal(w.error!.message, pg.error.message, `${what}: error message`);
  } else {
    assert.equal(w.error, null, `${what}: the Worker refused (${JSON.stringify(w.error)}); Postgres answered ${JSON.stringify(pg.data)?.slice(0, 400)}`);
    const shape = unordered ? byJob : (data: unknown) => data;
    assert.deepEqual(normalize(shape(w.data), seeded), normalize(shape(pg.data), seeded), what);
  }
}

async function both(user: string | null, fn: string, args: Record<string, unknown> = {}, unordered = false): Promise<PgAnswer> {
  const what = `${fn}(${JSON.stringify(args).slice(0, 300)}) as ${user ?? 'anon'}`;
  const pg = await oracle.call(user, fn, args);
  const w = await worker.rpc(user, fn, args);
  same(pg, w, what, unordered);
  await sameTables(`after ${what}`);
  return pg;
}

async function ok(fn: string, args: Record<string, unknown> = {}, unordered = false): Promise<PgAnswer> {
  const answer = await both(null, fn, { p_worker_token: TOKEN, ...args }, unordered);
  assert.equal(answer.error, null, `${fn} should succeed: ${answer.error?.message}`);
  return answer;
}

async function refused(fn: string, args: Record<string, unknown>, message: RegExp): Promise<void> {
  const answer = await both(null, fn, { p_worker_token: TOKEN, ...args });
  assert.ok(answer.error, `${fn}(${JSON.stringify(args)}) should be refused`);
  assert.match(answer.error!.message, message);
}

test('the worker token: a wrong, retired or missing one is refused, by anyone', async () => {
  for (const token of ['wrong', 'retired-secret', null, '']) {
    const answer = await both(null, 'media_processing_queue_has_work', { p_worker_token: token });
    assert.equal(answer.error?.code, '28000');
  }
  assert.equal((await both(ALICE, 'claim_media_processing_job', { p_worker_token: 'wrong' })).error?.code, '28000');
  assert.equal((await ok('media_processing_queue_has_work')).data, true);
});

test('claims: stale jobs requeued or failed, then the earliest due job, an audio copy only once its video is done', async () => {
  const claimedIds: unknown[] = [];
  for (const workerId of [' w-1 ', null, 'w-3', '  ', 'w-5']) {
    const rows = (await ok('claim_media_processing_job', { p_worker_id: workerId })).data as { job_id: string }[];
    claimedIds.push(rows[0]?.job_id ?? null);
  }
  assert.deepEqual(claimedIds, [job(8), job(5), QUEUED_VIDEO, STALE_JOB, null]);
});

test('heartbeats: progress kept between 0 and 1, as a real; only jobs being processed', async () => {
  const ids = [QUEUED_VIDEO, job(5), job(1), id(699), RELEASE_JOB];
  for (const progress of [0.333333333, 1.7, -2, null]) await ok('heartbeat_media_processing_jobs', { p_job_ids: ids, p_progress: progress }, true);
  await ok('heartbeat_media_processing_jobs', { p_job_ids: [] }, true);
});

test('companions: the audio copy of a video being processed, made if missing, claimed by the same worker', async () => {
  await ok('claim_companion_media_processing_job', { p_job_id: QUEUED_VIDEO, p_worker_id: 'w-3' });
  await ok('claim_companion_media_processing_job', { p_job_id: QUEUED_VIDEO, p_worker_id: 'w-3' });
  await ok('claim_companion_media_processing_job', { p_job_id: COMPANION_VIDEO });
  await ok('claim_companion_media_processing_job', { p_job_id: job(5) });
  await ok('claim_companion_media_processing_job', { p_job_id: id(699) });
});

const CHECKSUM = 'AB'.repeat(32);
const audioProbe = { output: { format: { duration: '61.2345', bit_rate: '128000' }, streams: [{ codec_type: 'video', codec_name: 'mjpeg' }, { codec_type: 'audio', codec_name: 'aac' }] } };

test('completing: refused unless claimed, a delivery, with a valid file; then an asset, its version, and what the file settles', async () => {
  const done = { p_output_mime_type: 'audio/mp4', p_output_size_bytes: 1234, p_output_checksum_sha256: CHECKSUM };
  await refused('complete_media_processing_job', { p_job_id: id(699), ...done }, /not found/);
  await refused('complete_media_processing_job', { p_job_id: job(1), ...done }, /not claimed/);
  await refused('complete_media_processing_job', { p_job_id: NO_PATH_JOB, ...done }, /no output path/);
  await refused('complete_media_processing_job', { p_job_id: PROBE_JOB, ...done }, /cannot produce/);
  await refused('complete_media_processing_job', { p_job_id: PROCESSING_JOB, ...done, p_output_mime_type: 'audio/mpeg' }, /MIME/);
  await refused('complete_media_processing_job', { p_job_id: PROCESSING_JOB, ...done, p_output_mime_type: null }, /MIME/);
  await refused('complete_media_processing_job', { p_job_id: PROCESSING_JOB, ...done, p_output_size_bytes: 0 }, /size/);
  await refused('complete_media_processing_job', { p_job_id: PROCESSING_JOB, ...done, p_output_checksum_sha256: 'abc' }, /checksum/);
  await refused('complete_media_processing_job', { p_job_id: NO_INTENT_JOB, ...done }, /upload intent/);
  // The last file of a submission in processing: approved again.
  await ok('complete_media_processing_job', { p_job_id: PROCESSING_JOB, ...done, p_output_mime_type: ' Audio/MP4 ', p_probe: audioProbe });
  // A replacement on a live release: it takes its track's place.
  await ok('complete_media_processing_job', { p_job_id: REPLACEMENT_JOB, ...done, p_output_mime_type: 'audio/x-m4a', p_probe: { output: { format: { duration: '0.0004', bit_rate: '0' } } } });
  // A new lesson in a live lesson set.
  await ok('complete_media_processing_job', { p_job_id: LESSON_JOB, ...done, p_probe: null });
  // An artist's new photo.
  await ok('complete_media_processing_job', { p_job_id: IMAGE_JOB, ...done, p_output_mime_type: 'image/webp' });
  // A video turned a quarter: its width and height swapped.
  await ok('complete_media_processing_job', {
    p_job_id: VIDEO_JOB, ...done, p_output_mime_type: 'video/mp4',
    p_probe: { output: { format: { duration: 12, bit_rate: 2500000 }, streams: [{ codec_type: 'video', codec_name: 'h264', width: 1920, height: 1080, side_data_list: [{ rotation: -90.4 }] }] } },
  });
  await ok('complete_media_processing_job', { p_job_id: COMPANION_VIDEO, ...done, p_output_mime_type: 'video/mp4', p_probe: { output: { streams: [{ codec_type: 'video', width: '640', height: 480, tags: { rotate: '270' } }] } } });
  // Done already.
  await refused('complete_media_processing_job', { p_job_id: PROCESSING_JOB, ...done }, /not claimed/);
  const status = async (submission: string) => (await oracle.sql<{ status: string }>(`select status from media.submissions where id = $1`, [submission]))[0].status;
  assert.equal(await status(SPRC), 'approved');
  const track = (await oracle.sql<{ asset: string }>(`select media_asset_id as asset from music.tracks where id = $1`, [TP]))[0].asset;
  assert.notEqual(track, id(113), 'the replacement took the track\'s place');
  assert.equal((await oracle.sql(`select 1 from learning.lessons where lesson_set_id = $1 and metadata ->> 'submissionItemId' = $2`, [LSP, id(662)])).length, 1);
  const artist = (await oracle.sql<{ pending: string | null; photo: string }>(`select metadata ->> 'pendingProfileImageUploadIntentId' as pending, profile_image_asset_id as photo from music.artists where id = $1`, [A1]))[0];
  assert.equal(artist.pending, null);
  assert.notEqual(artist.photo, id(101));
  const turned = (await oracle.sql<{ width: number; height: number }>(`select a.width, a.height from media.media_assets a join media.media_processing_jobs j on j.media_asset_id = a.id where j.id = $1`, [VIDEO_JOB]))[0];
  assert.deepEqual([turned.width, turned.height], [1080, 1920]);
});

test('failing, skipping and releasing: retried later, failed for good on the last attempt, a silent video\'s audio cancelled, a shutting-down worker\'s jobs handed back', async () => {
  await refused('fail_media_processing_job', { p_job_id: id(699), p_error_message: 'x' }, /not found/);
  await ok('fail_media_processing_job', { p_job_id: RETRY_JOB, p_error_message: '  ffmpeg exited 1  ' });
  await ok('fail_media_processing_job', { p_job_id: LAST_TRY_JOB, p_error_message: '' });
  await ok('fail_media_processing_job', { p_job_id: RETRY_JOB, p_error_message: 'é'.repeat(4100) });
  await ok('skip_media_processing_job', { p_job_id: SILENT_JOB, p_reason: '  ' });
  await ok('skip_media_processing_job', { p_job_id: SILENT_JOB, p_reason: 'again' });
  await ok('skip_media_processing_job', { p_job_id: COMPANION_VIDEO, p_reason: 'not audio' });
  await ok('release_media_processing_jobs', { p_job_ids: [RELEASE_JOB, job(1), id(699)], p_reason: null });
  await ok('release_media_processing_jobs', { p_job_ids: [QUEUED_VIDEO, BLOCKED_AUDIO], p_reason: ' deploy ' });
  const jobStatus = async (jobId: string) => (await oracle.sql<{ status: string }>(`select status from media.media_processing_jobs where id = $1`, [jobId]))[0].status;
  assert.deepEqual([await jobStatus(RETRY_JOB), await jobStatus(LAST_TRY_JOB), await jobStatus(SILENT_JOB), await jobStatus(RELEASE_JOB)], ['queued', 'failed', 'cancelled', 'queued']);
  assert.equal((await oracle.sql<{ status: string }>(`select status from media.submissions where id = $1`, [SVID]))[0].status, 'approved');
});

test('originals: a video\'s, once both deliveries exist and no job is left, claimed for deletion once', async () => {
  const claims = [];
  for (const upload of [intent(4), intent(4), intent(3), intent(1), X(6), X(3), id(699)]) claims.push(((await ok('claim_media_original_deletion', { p_upload_intent_id: upload })).data as unknown[]).length);
  assert.deepEqual(claims, [1, 0, 0, 0, 1, 0, 0]);
  await ok('media_processing_queue_has_work');
});
