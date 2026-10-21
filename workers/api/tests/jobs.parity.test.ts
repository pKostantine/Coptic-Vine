/**
 * Parity: the two minute jobs that publish releases when their scheduled time
 * comes (src/jobs/releases.ts), against Supabase's own
 * private.publish_due_music_releases and publish_due_learning_releases run as
 * pg_cron ran them, over tests/lib/creatorCatalog.ts plus music and learning
 * submissions due and ready, due but failing (noted on the submission), not
 * ready, and not yet due. After each run every table they write is compared
 * (tests/lib/tables.ts).
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { afterWrites } from '../src/db/afterWrites.ts';
import { Tx } from '../src/db/transaction.ts';
import { publishDueLearningReleases, publishDueMusicReleases, publishDueReleases } from '../src/jobs/releases.ts';
import { A1, ALICE, C1, CAROL, id, K1, K2, seedCatalog } from './lib/creatorCatalog.ts';
import { createOracle, type Oracle } from './lib/oracle.ts';
import { seed } from './lib/seed.ts';
import { bothTables, firstDifferences } from './lib/tables.ts';
import { WorkerSide } from './lib/worker.ts';

const AT = '2026-03-10T08:00:00+00:00';
const hours = (n: number) => `${new Date(Date.now() + n * 3600_000).toISOString().replace('Z', '')}+00:00`;
const SM1 = id(600); const RM1 = id(601); const TM1 = id(602); const SM2 = id(603); const RM2 = id(604); const TM2 = id(605); const SM3 = id(606); const RM3 = id(607);
const SL1 = id(610); const AL1X = id(611); const SL2 = id(612); const AL2X = id(613); const SL3 = id(614); const AL3X = id(615);

let oracle: Oracle;
let worker: WorkerSide;
const seeded = new Set(Array.from({ length: 700 }, (_, n) => id(n)));
const TABLES = [
  'media.submissions', 'media.submission_events', 'media.submission_items', 'media.media_assets', 'music.releases', 'music.release_localizations', 'music.tracks', 'music.track_localizations',
  'music.artists', 'music.artist_localizations', 'learning.albums', 'learning.album_recordings', 'learning.recording_localizations', 'learning.cantors', 'public.notifications',
  'private.notification_deliveries', 'media.search_documents',
];

before(async () => {
  oracle = await createOracle();
  worker = new WorkerSide();
  await seedCatalog(oracle, worker);
  // The releases are scheduled for the past, which the scheduling window refuses; seeding pauses the triggers.
  const stamps = { created_at: AT, updated_at: AT };
  const asset = (n: number) => ({ id: id(160 + n), owner_creator_account_id: C1, bucket: 'chc-music', path: `due/${n}`, media_type: 'audio', duration_ms: 4000 + n,
    processing_status: 'completed', publication_status: 'draft', ...stamps });
  const approved = { status: 'approved', reviewer_id: CAROL, approved_at: AT, created_by: ALICE, ...stamps };
  await seed(oracle, worker, [
    ['media.media_assets', [asset(1), asset(2), asset(3), asset(4)]],
    ['media.submissions', [
      { id: SM1, creator_account_id: C1, submission_type: 'music_release', title: 'Due Single', ...approved },
      { id: SM2, creator_account_id: C1, submission_type: 'music_release', title: 'Due But Broken', ...approved },
      { id: SM3, creator_account_id: C1, submission_type: 'music_release', title: 'Not Yet', ...approved },
      { id: SL1, creator_account_id: C1, submission_type: 'learning_album', title: 'Due Album', ...approved, approved_at: '2026-03-11T08:00:00+00:00' },
      { id: SL2, creator_account_id: C1, submission_type: 'learning_album', title: 'Cantor Not Published', ...approved },
      { id: SL3, creator_account_id: C1, submission_type: 'learning_album', title: 'Album Not Yet', ...approved },
    ]],
    ['music.tracks', [
      { id: TM1, owner_creator_account_id: C1, title: 'Due Single', media_asset_id: id(161), publication_status: 'draft', ...stamps },
      { id: TM2, owner_creator_account_id: C1, title: 'No File', publication_status: 'draft', ...stamps },
    ]],
    ['music.releases', [
      { id: RM1, owner_creator_account_id: C1, primary_artist_id: A1, release_type: 'single', title: 'Due Single', metadata: { submissionId: SM1 }, publication_status: 'approved',
        release_timing_mode: 'scheduled', scheduled_release_at: hours(-2), ...stamps },
      { id: RM2, owner_creator_account_id: C1, primary_artist_id: A1, release_type: 'single', title: 'Due But Broken', metadata: { submissionId: SM2 }, publication_status: 'approved',
        release_timing_mode: 'scheduled', scheduled_release_at: hours(-3), ...stamps },
      { id: RM3, owner_creator_account_id: C1, primary_artist_id: A1, release_type: 'single', title: 'Not Yet', metadata: { submissionId: SM3 }, publication_status: 'approved',
        release_timing_mode: 'scheduled', scheduled_release_at: hours(72), ...stamps },
    ]],
    ['music.release_tracks', [
      { id: id(620), release_id: RM1, track_id: TM1, disc_number: 1, track_number: 1, created_at: AT },
      { id: id(621), release_id: RM2, track_id: TM2, disc_number: 1, track_number: 1, created_at: AT },
    ]],
    ['music.track_artists', [{ track_id: TM1, artist_id: A1, role: 'primary', sort_order: 0, created_at: AT }]],
    ['learning.albums', [
      { id: AL1X, owner_creator_account_id: C1, cantor_id: K1, submission_id: SL1, title: 'Due Album', publication_status: 'approved', release_timing_mode: 'scheduled', scheduled_release_at: hours(-1), ...stamps },
      { id: AL2X, owner_creator_account_id: C1, cantor_id: K2, submission_id: SL2, title: 'Cantor Not Published', publication_status: 'approved', release_timing_mode: 'scheduled', scheduled_release_at: hours(-1), ...stamps },
      { id: AL3X, owner_creator_account_id: C1, cantor_id: K1, submission_id: SL3, title: 'Album Not Yet', publication_status: 'approved', release_timing_mode: 'scheduled', scheduled_release_at: hours(48), ...stamps },
    ]],
    ['media.submission_items', [
      { id: id(630), submission_id: SM1, role: 'track', title: 'Due Single', sort_order: 1, media_asset_id: id(161), music_track_id: TM1, ...stamps },
      { id: id(631), submission_id: SM2, role: 'track', title: 'Due But Broken', sort_order: 1, media_asset_id: id(162), ...stamps },
      { id: id(632), submission_id: SM3, role: 'track', title: 'Not Yet', sort_order: 1, media_asset_id: id(162), ...stamps },
      { id: id(633), submission_id: SL1, role: 'track', title: 'Recording', sort_order: 1, media_asset_id: id(163), localized_titles: { ar: 'تسجيل' }, ...stamps },
      { id: id(634), submission_id: SL2, role: 'track', title: 'Recording', sort_order: 1, media_asset_id: id(164), ...stamps },
      { id: id(635), submission_id: SL3, role: 'track', title: 'Recording', sort_order: 1, media_asset_id: id(164), ...stamps },
    ]],
  ]);
  await sameTables('seed');
});
after(() => oracle.close());

/** As the cron does after the jobs: the search index rebuilt (Postgres refreshed it in the same transaction). */
async function sameTables(what: string): Promise<void> {
  await afterWrites(worker.env);
  const { pg, sqlite } = await bothTables(oracle, worker, TABLES, seeded);
  if (pg !== sqlite) assert.fail(`${what}: the tables differ\n${firstDifferences(sqlite, pg).join('\n')}`);
}

const status = async (submission: string) => (await oracle.sql<{ status: string }>('select status from media.submissions where id = $1', [submission]))[0].status;
const failures = async (submission: string) => (await oracle.sql<{ notes: string }>(`select notes from media.submission_events where submission_id = $1 and action = 'scheduled_publish_failed'`, [submission])).map((row) => row.notes);

test('music: due and ready published; due but broken noted on its submission; not ready or not yet due left', async () => {
  const pg = (await oracle.sql<{ n: number }>('select private.publish_due_music_releases() as n'))[0].n;
  const w = await publishDueMusicReleases(worker.env);
  assert.equal(w, pg);
  assert.equal(pg, 1);
  await sameTables('after publishing due music');
  assert.deepEqual([await status(SM1), await status(SM2), await status(SM3)], ['published', 'approved', 'approved']);
  assert.deepEqual(await failures(SM2), ['Release has tracks without completed published media assets']);
  // Run again: nothing more to publish, the broken one noted again.
  assert.equal(await publishDueMusicReleases(worker.env), (await oracle.sql<{ n: number }>('select private.publish_due_music_releases() as n'))[0].n);
  await sameTables('after the second run');
});

test('learning: a due album published with its recordings; one whose cantor isn\'t published noted; one not yet due left', async () => {
  const pg = (await oracle.sql<{ n: number }>('select private.publish_due_learning_releases() as n'))[0].n;
  assert.equal(await publishDueLearningReleases(worker.env), pg);
  assert.equal(pg, 1);
  await sameTables('after publishing due learning');
  assert.deepEqual([await status(SL1), await status(SL2), await status(SL3)], ['published', 'approved', 'approved']);
  assert.deepEqual(await failures(SL2), ['Cantor must be published before learning album']);
});

test('one run at a time: a run that can\'t take the lease leaves the releases; a dead run\'s release log is rolled back first; one that won\'t roll back stops them', async () => {
  // Each run that publishes notes the broken release again.
  const noted = () => worker.rows<{ n: number }>(`SELECT count(*) AS n FROM "media.submission_events" WHERE "submission_id" = ? AND "action" = 'scheduled_publish_failed'`, SM2)[0].n;
  const lease = () => worker.rows(`SELECT "holder", "until" FROM "private.job_lease" WHERE "name" = 'releases'`)[0];
  const free = { holder: null, until: null };
  const at = Date.now();
  worker.db.prepare(`UPDATE "private.job_lease" SET "holder" = 'other run', "until" = ? WHERE "name" = 'releases'`).run(new Date(at + 60_000).toISOString());
  let before = noted();
  assert.equal(await publishDueReleases(worker.env, at), false);
  assert.equal(noted(), before);
  // That run died: after the lease's 15 minutes it is taken, the releases run, and it is let go.
  assert.equal(await publishDueReleases(worker.env, at + 16 * 60_000), true);
  assert.equal(noted(), before + 1);
  assert.deepEqual(lease(), free);

  const dead = new Tx(worker.env.DB, 'release:dead');
  await dead.run(`UPDATE "music.releases" SET "title" = 'Half published' WHERE "id" = ?`, RM3);
  before = noted();
  assert.equal(await publishDueReleases(worker.env), true);
  assert.equal(worker.rows<{ title: string }>(`SELECT "title" FROM "music.releases" WHERE "id" = ?`, RM3)[0].title, 'Not Yet');
  assert.equal(noted(), before + 1);

  // A dead run's delete whose key has been taken since: it can't be rolled back, so nothing is published.
  const stuck = new Tx(worker.env.DB, 'release:stuck');
  await stuck.run(`DELETE FROM "music.track_artists" WHERE "track_id" = ? AND "artist_id" = ?`, TM1, A1);
  worker.db.prepare(`INSERT INTO "music.track_artists" ("track_id", "artist_id", "role", "sort_order", "created_at") VALUES (?, ?, 'primary', 0, ?)`).run(TM1, A1, AT);
  before = noted();
  await assert.rejects(publishDueReleases(worker.env));
  assert.equal(noted(), before);
  assert.deepEqual(lease(), free);
  worker.db.prepare(`DELETE FROM "music.track_artists" WHERE "track_id" = ? AND "artist_id" = ?`).run(TM1, A1);
  assert.equal(await publishDueReleases(worker.env), true);
  assert.equal(noted(), before + 1);
  assert.equal(worker.rows<{ n: number }>(`SELECT count(*) AS n FROM "music.track_artists" WHERE "track_id" = ?`, TM1)[0].n, 1);
});
