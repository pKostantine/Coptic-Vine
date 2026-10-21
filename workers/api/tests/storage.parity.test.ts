/**
 * Parity: storage clean-up and an admin's permanent deletion of a file
 * (src/rpc/workers/storage.ts), the Worker against Supabase's own functions
 * (the oracle), over tests/lib/creatorCatalog.ts plus an orphaned asset (with
 * its version, a finished job and plays pointing at it), an orphaned upload,
 * and candidates old and new, one referenced again. After every call every
 * table they write is compared, generated ids renamed (tests/lib/tables.ts).
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { after, before, test } from 'node:test';
import { ALICE, C1, CAROL, id, job, seedCatalog, T1 } from './lib/creatorCatalog.ts';
import { d1 } from './lib/d1.ts';
import { createOracle, type Oracle, type PgAnswer } from './lib/oracle.ts';
import { seed } from './lib/seed.ts';
import { bothTables, firstDifferences } from './lib/tables.ts';
import { normalize, WorkerSide, type Answer } from './lib/worker.ts';

const AT = '2026-03-10T08:00:00+00:00';
const daysAgo = (days: number) => `${new Date(Date.now() - days * 86_400_000).toISOString().replace('Z', '')}+00:00`;
const TOKEN = 'storage-worker-secret';
const ORPHAN = id(660); const ORPHAN_VERSION = id(661); const ORPHAN_UPLOAD = id(663);
const UPLOAD_PATH = `submissions/${C1}/${ORPHAN_UPLOAD}/original.wav`;

let oracle: Oracle;
let worker: WorkerSide;
const seeded = new Set(Array.from({ length: 700 }, (_, n) => id(n)));
const TABLES = [
  'media.storage_gc_candidates', 'media.media_processing_jobs', 'media.media_assets', 'media.media_asset_versions', 'media.upload_intents', 'media.submission_items',
  'music.play_history', 'music.tracks', 'music.releases', 'music.artists', 'music.playlists', 'learning.album_recordings', 'learning.lessons', 'learning.albums',
  'learning.lesson_sets', 'learning.cantors', 'learning.playlists', 'media.search_documents',
];

before(async () => {
  oracle = await createOracle();
  worker = new WorkerSide();
  await seedCatalog(oracle, worker);
  const stamps = { created_at: AT, updated_at: AT };
  await seed(oracle, worker, [
    ['private.media_worker_tokens', [{ id: id(670), name: 'processor', token_hash: createHash('sha256').update(TOKEN).digest('hex'), created_at: AT }]],
    ['media.media_assets', [{ id: ORPHAN, owner_creator_account_id: C1, bucket: 'chc-music', path: 'orphan/160.m4a', media_type: 'audio', processing_status: 'completed', publication_status: 'draft', ...stamps }]],
    ['media.media_asset_versions', [{ id: ORPHAN_VERSION, media_asset_id: ORPHAN, version: 1, bucket: 'chc-music', path: 'orphan/160.m4a', processing_status: 'completed', created_at: AT }]],
    ['media.upload_intents', [{ id: ORPHAN_UPLOAD, creator_account_id: C1, requested_by: ALICE, bucket: 'chc-submissions', path: UPLOAD_PATH, media_type: 'audio', original_filename: 'orphan.wav',
      content_type: 'audio/wav', content_length: 10, status: 'uploaded', upload_expires_at: AT, ...stamps }]],
    ['media.media_processing_jobs', [
      { id: id(662), upload_intent_id: null, media_asset_id: ORPHAN, media_asset_version_id: ORPHAN_VERSION, job_type: 'audio_delivery', status: 'completed', input_bucket: 'chc-submissions',
        input_path: 'orphan/source.wav', output_bucket: 'chc-music', output_path: 'orphan/160.m4a', ...stamps },
      { id: id(664), upload_intent_id: ORPHAN_UPLOAD, job_type: 'audio_delivery', status: 'cancelled', input_bucket: 'chc-submissions', input_path: UPLOAD_PATH, output_bucket: 'chc-music', ...stamps },
    ]],
    ['music.play_history', [{ id: id(665), user_id: ALICE, track_id: T1, media_asset_id: ORPHAN, played_at: AT, completed: true }]],
    ['media.storage_gc_candidates', [
      { bucket: 'chc-music', path: 'orphan/160.m4a', first_unused_at: daysAgo(5), last_seen_at: daysAgo(1), reason: 'unreferenced' },
      { bucket: 'chc-music', path: 'audio/5', first_unused_at: daysAgo(4), last_seen_at: daysAgo(1), reason: 'unreferenced' },
      { bucket: 'chc-images', path: 'gone.png', first_unused_at: daysAgo(6), last_seen_at: daysAgo(6), reason: 'unreferenced' },
      { bucket: 'chc-images', path: 'Zeta.png', first_unused_at: daysAgo(5), last_seen_at: daysAgo(1), reason: 'unreferenced' },
      { bucket: 'chc-images', path: 'alpha.png', first_unused_at: daysAgo(5), last_seen_at: daysAgo(1), reason: 'unreferenced' },
    ]],
  ]);
  // Both candidates first unused at the same moment: then by bucket and path, as Postgres collates them.
  await oracle.sql(`update media.storage_gc_candidates set first_unused_at = '2026-10-01T00:00:00+00' where path in ('Zeta.png', 'alpha.png')`);
  worker.db.exec(`UPDATE "media.storage_gc_candidates" SET "first_unused_at" = '2026-10-01T00:00:00+00:00' WHERE "path" IN ('Zeta.png', 'alpha.png')`);
  await sameTables('seed');
});
after(() => oracle.close());

async function sameTables(what: string): Promise<void> {
  const { pg, sqlite } = await bothTables(oracle, worker, TABLES, seeded);
  if (pg !== sqlite) assert.fail(`${what}: the tables differ\n${firstDifferences(sqlite, pg).join('\n')}`);
}

function same(pg: PgAnswer, w: Answer, what: string): void {
  if (pg.error) {
    assert.ok(w.error, `${what}: Postgres refused (${pg.error.code} ${pg.error.message}); the Worker answered ${JSON.stringify(w.data)?.slice(0, 400)}`);
    assert.equal(w.error!.code, pg.error.code, `${what}: error code (${w.error!.message})`);
    assert.equal(w.error!.message, pg.error.message, `${what}: error message`);
  } else {
    assert.equal(w.error, null, `${what}: the Worker refused (${JSON.stringify(w.error)}); Postgres answered ${JSON.stringify(pg.data)?.slice(0, 400)}`);
    assert.deepEqual(normalize(w.data, seeded), normalize(pg.data, seeded), what);
  }
}

async function both(user: string | null, fn: string, args: Record<string, unknown> = {}): Promise<PgAnswer> {
  const what = `${fn}(${JSON.stringify(args).slice(0, 300)}) as ${user ?? 'anon'}`;
  const pg = await oracle.call(user, fn, args);
  same(pg, await worker.rpc(user, fn, args), what);
  await sameTables(`after ${what}`);
  return pg;
}
const worked = (fn: string, args: Record<string, unknown> = {}) => both(null, fn, { p_worker_token: TOKEN, ...args });

test('a scan: unused objects in the four buckets become candidates (their first unused time kept), referenced or vanished ones forgotten', async () => {
  for (const objects of [{}, null, [{ bucket: 'chc-music', path: 'x', file_size_bytes: 'abc' }], [{ bucket: 'chc-music', path: 'x', last_modified_at: 'nope' }],
    [{ bucket: 'chc-music', path: 'dup' }, { bucket: ' chc-music', path: 'dup ' }]]) {
    assert.ok((await worked('sync_storage_gc_candidates', { p_objects: objects })).error);
  }
  assert.equal((await both(null, 'sync_storage_gc_candidates', { p_worker_token: 'wrong', p_objects: [] })).error?.code, '28000');
  const scan = await worked('sync_storage_gc_candidates', { p_objects: [
    { bucket: ' chc-music ', path: 'orphan/160.m4a', file_size_bytes: '2048', last_modified_at: '2026-10-01T10:00:00Z' },
    { bucket: 'chc-submissions', path: UPLOAD_PATH, file_size_bytes: -5 },
    // A referenced object's size is never cast, so it can't fail.
    { bucket: 'chc-music', path: 'audio/5', file_size_bytes: 'not checked either' }, { bucket: 'other', path: 'x', file_size_bytes: 'not checked' }, { bucket: 'chc-images', path: '  ' },
    { bucket: 'chc-images', path: 'new.png', file_size_bytes: '' }, { bucket: 'chc-images', path: 'Zeta.png' }, { bucket: 'chc-images', path: 'alpha.png' }, 7,
  ] });
  assert.deepEqual(scan.data, [{ scanned_count: 9, candidate_count: 5, due_count: 3 }]);
});

test('candidates: the due ones (three days unused) by default, any with p_due_only false; oldest first, then by bucket and path', async () => {
  for (const args of [{}, { p_due_only: false }, { p_due_only: null }, { p_limit: 1 }, { p_limit: 0 }, { p_due_only: false, p_limit: 5000 }]) await worked('get_storage_gc_candidates', args);
});

test('deleting a candidate: refused if referenced again; otherwise what describes only it goes, then it is forgotten', async () => {
  assert.deepEqual((await worked('prepare_storage_gc_candidate', { p_bucket: 'chc-music', p_path: 'audio/5' })).data, [{ authorized: false, database_rows_removed: 0 }]);
  assert.deepEqual((await worked('prepare_storage_gc_candidate', { p_bucket: 'chc-music', p_path: 'orphan/160.m4a' })).data, [{ authorized: true, database_rows_removed: 4 }]);
  assert.deepEqual((await worked('prepare_storage_gc_candidate', { p_bucket: 'chc-submissions', p_path: UPLOAD_PATH })).data, [{ authorized: true, database_rows_removed: 2 }]);
  await worked('prepare_storage_gc_candidate', { p_bucket: 'chc-images', p_path: 'nothing.png' });
  for (const path of ['orphan/160.m4a', 'never-listed']) await worked('complete_storage_gc_candidate', { p_bucket: 'chc-music', p_path: path });
});

test('an admin deleting a file: authorized, its jobs cancelled and its objects listed, then everything that showed it removed', async () => {
  assert.equal((await both(ALICE, 'authorize_admin_storage_gc')).error?.code, '42501');
  assert.equal((await both(null, 'authorize_admin_storage_gc')).error?.code, '42501');
  assert.deepEqual((await both(CAROL, 'authorize_admin_storage_gc')).data, [{ authorized: true }]);
  assert.equal((await both(ALICE, 'prepare_admin_processing_file_deletion', { p_job_id: job(1) })).error?.code, '42501');
  assert.equal((await both(CAROL, 'prepare_admin_processing_file_deletion', { p_job_id: id(699) })).error?.code, 'P0002');
  for (const jobId of [job(1), job(4), job(9)]) await both(CAROL, 'prepare_admin_processing_file_deletion', { p_job_id: jobId });
  // job(1)'s file is a published track's: removing it would leave the track live without media, which both refuse
  // (the Worker reports SQLite's CHECK failure without Postgres's constraint name).
  const pg = await oracle.call(CAROL, 'finalize_admin_processing_file_deletion', { p_job_id: job(1) });
  const w = await worker.rpc(CAROL, 'finalize_admin_processing_file_deletion', { p_job_id: job(1) });
  assert.deepEqual([pg.error?.code, w.error?.code], ['23514', '23514']);
  await sameTables('after the refused deletion');
  for (const jobId of [job(4), job(9), id(699)]) await both(CAROL, 'finalize_admin_processing_file_deletion', { p_job_id: jobId });
  assert.equal((await both(ALICE, 'finalize_admin_processing_file_deletion', { p_job_id: job(9) })).error?.code, '42501');
});

test('a scan costs the same few D1 calls however many objects it lists', async () => {
  const listing = (n: number) => [{ bucket: 'chc-music', path: 'audio/5' }, ...Array.from({ length: n }, (_, i) => ({ bucket: 'chc-images', path: `scan/${i}.png`, file_size_bytes: String(i) }))];
  const kept = worker.env.DB;
  let calls = 0;
  worker.env.DB = d1(worker.db, { before: () => { calls += 1; } });
  try {
    const counted: number[] = [];
    for (const n of [2, 60]) {
      calls = 0;
      await worked('sync_storage_gc_candidates', { p_objects: listing(n) });
      counted.push(calls);
    }
    assert.equal(counted[1], counted[0], `D1 calls for 2 objects, then 60: ${counted.join(', ')}`);
  } finally {
    worker.env.DB = kept;
  }
});
