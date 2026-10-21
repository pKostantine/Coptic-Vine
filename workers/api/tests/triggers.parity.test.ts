/**
 * Parity: the triggers of 0009 (scripts/gen-triggers.ts) against Supabase's
 * own, in the oracle. The same writes go straight to both databases, as SQL,
 * and every table a trigger could touch must end up the same on both sides:
 * publishing a release (its artwork, the artists, tracks and lyrics it
 * publishes, the notifications), track lists changing a release's type,
 * artist renames reaching cantors, failed media jobs, submission statuses,
 * deleting a release, a video lesson's audio, the errors the release rules
 * raise, the catalog search index, the media processor's wake-up, and the
 * triggers staying off in replica mode.
 *
 * Generated ids (notifications, deliveries, search documents) are compared by
 * content, and timestamps by presence.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import schema from '../schema/user-tables.json' with { type: 'json' };
import type { UserTable } from '../scripts/gen-schema.ts';
import { afterWrites } from '../src/db/afterWrites.ts';
import { rebuildSearchIndex } from '../src/db/searchIndex.ts';
import { triggerError } from '../src/pg.ts';
import { createOracle, type Oracle } from './lib/oracle.ts';
import { seed, type Seed } from './lib/seed.ts';
import { WorkerSide } from './lib/worker.ts';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ALICE = id(1); const BOB = id(2); const CAROL = id(3); const DAVE = id(4);
const C1 = id(10); const C2 = id(11);
const A1 = id(20); const A2 = id(21); const A3 = id(22);
const K1 = id(30); const K2 = id(31); const K3 = id(32);
const R1 = id(40); const R2 = id(41); const R3 = id(42); const R4 = id(43);
const T1 = id(50); const T2 = id(51); const T3 = id(52); const T4 = id(53);
const S1 = id(60); const S2 = id(61); const S3 = id(62);
const J1 = id(70); const J2 = id(71);
const asset = (n: number) => id(100 + n);
const AT = (day: number) => `2026-03-${String(day + 1).padStart(2, '0')}T08:00:00+00:00`;
const stamps = (day = 0) => ({ created_at: AT(day), updated_at: AT(day) });

const IMG_A1 = asset(1); const IMG_A2 = asset(2); const IMG_NEW = asset(3); const COVER_OLD = asset(4); const ART_OLD = asset(5); const ART_NEW = asset(6);
const AUDIO1 = asset(7); const AUDIO2 = asset(8); const AUDIO3 = asset(9); const VIDEO = asset(10); const AUDIO_ONLY = asset(11); const PENDING_IMG = asset(12);

function data(): Seed {
  const media = (n: number, type: string, processing = 'completed', publication = 'draft') => ({
    id: asset(n), bucket: type === 'image' ? 'chc-images' : 'chc-music', path: `${type}/${n}`, media_type: type, processing_status: processing,
    publication_status: publication, ...stamps(),
  });
  return [
    ['media.locales', ['en', 'ar', 'fr'].map((code, i) => ({ code, english_name: code, native_name: code, text_direction: code === 'ar' ? 'rtl' : 'ltr', sort_order: i, enabled: code !== 'fr', ...stamps() }))],
    ['media.media_assets', [
      media(1, 'image'), media(2, 'image'), media(3, 'image'), media(4, 'image', 'completed', 'published'), media(5, 'image'), media(6, 'image'),
      media(7, 'audio', 'completed', 'published'), media(8, 'audio'), media(9, 'audio'), media(10, 'video', 'completed', 'published'), media(11, 'audio'), media(12, 'image', 'pending'),
    ]],
    ['music.artists', [
      { id: A1, display_name: 'Choir One', owner_creator_account_id: null, profile_image_asset_id: IMG_A1, publication_status: 'published', ...stamps() },
      { id: A2, display_name: 'Deacon Two', profile_image_asset_id: IMG_A2, publication_status: 'draft', ...stamps() },
      { id: A3, display_name: 'Credit Three', publication_status: 'draft', ...stamps() },
    ]],
    ['music.artist_localizations', [{ id: id(80), artist_id: A2, locale: 'ar', display_name: 'Deacon Two AR', publication_status: 'draft', ...stamps() }]],
    ['creator.creator_accounts', [
      { id: C1, display_name: 'Choir Account', identity_artist_id: A1, ...stamps() },
      { id: C2, display_name: 'No Identity', ...stamps() },
    ]],
    ['creator.creator_account_members', [
      { creator_account_id: C1, user_id: ALICE, role: 'owner', ...stamps() },
      { creator_account_id: C1, user_id: DAVE, role: 'editor', ...stamps() },
    ]],
    ['creator.user_roles', [{ user_id: CAROL, role: 'admin', granted_at: AT(0) }]],
    ['learning.cantors', [
      { id: K1, display_name: 'Deacon Two', artist_id: A2, publication_status: 'draft', ...stamps() },
      { id: K2, display_name: ' choir one ', publication_status: 'published', ...stamps() },
      { id: K3, display_name: 'Choir One', profile_image_asset_id: IMG_A1, publication_status: 'published', ...stamps() },
    ]],
    ['music.tracks', [
      { id: T1, title: 'Track One', media_asset_id: AUDIO1, owner_creator_account_id: C1, publication_status: 'draft', ...stamps() },
      { id: T2, title: 'Track Two', media_asset_id: AUDIO2, owner_creator_account_id: C1, publication_status: 'draft', ...stamps() },
      { id: T3, title: 'Track Three', media_asset_id: AUDIO3, owner_creator_account_id: C1, publication_status: 'published', ...stamps() },
      { id: T4, title: 'Track Four', media_asset_id: AUDIO1, owner_creator_account_id: C1, publication_status: 'published', ...stamps() },
      ...[0, 1, 2, 3, 4, 5].map((n) => ({ id: id(300 + n), title: `Extra ${n}`, media_asset_id: AUDIO1, owner_creator_account_id: C1, publication_status: 'published', ...stamps() })),
    ]],
    ['music.track_localizations', [{ id: id(81), track_id: T1, locale: 'ar', title: 'Track One AR', publication_status: 'draft', ...stamps() }]],
    ['media.submissions', [
      { id: S1, creator_account_id: C1, submission_type: 'music_release', title: 'Album One', status: 'pending_review', created_by: ALICE, ...stamps() },
      { id: S2, creator_account_id: C1, submission_type: 'music_release', title: 'Old Album', status: 'approved', created_by: ALICE, ...stamps() },
      { id: S3, creator_account_id: C1, submission_type: 'learning_lesson_set', title: 'Lessons', status: 'draft', created_by: ALICE, ...stamps() },
    ]],
    ['media.submission_items', [
      { id: id(90), submission_id: S1, role: 'artwork', media_asset_id: ART_OLD, ...stamps(1) },
      { id: id(91), submission_id: S1, role: 'artwork', media_asset_id: ART_NEW, ...stamps(2) },
      { id: id(92), submission_id: S1, role: 'artwork', media_asset_id: PENDING_IMG, ...stamps(3) },
      { id: id(93), submission_id: S3, role: 'lesson', media_asset_id: VIDEO, audio_only_asset_id: AUDIO_ONLY, media_processing_job_id: null, ...stamps() },
    ]],
    ['music.releases', [
      { id: R1, title: 'Album One', release_type: 'single', owner_creator_account_id: C1, primary_artist_id: A1, cover_asset_id: COVER_OLD, metadata: { submissionId: S1 }, publication_status: 'draft', ...stamps() },
      { id: R2, title: 'Single Two', release_type: 'single', owner_creator_account_id: C1, primary_artist_id: A1, publication_status: 'published', release_date: '2026-02-01', ...stamps() },
      { id: R3, title: 'Old Album', release_type: 'single', owner_creator_account_id: C1, primary_artist_id: A1, metadata: { submissionId: S2 }, publication_status: 'published', ...stamps() },
      { id: R4, title: 'Credits', release_type: 'single', owner_creator_account_id: null, primary_artist_id: A3, publication_status: 'draft', ...stamps() },
    ]],
    ['music.release_tracks', [
      { id: id(95), release_id: R1, track_id: T1, track_number: 1, created_at: AT(0) },
      { id: id(96), release_id: R1, track_id: T2, track_number: 2, created_at: AT(0) },
      { id: id(97), release_id: R2, track_id: T3, track_number: 1, created_at: AT(0) },
      { id: id(98), release_id: R3, track_id: T4, track_number: 1, created_at: AT(0) },
    ]],
    ['music.track_artists', [
      { track_id: T1, artist_id: A2, role: 'featured', sort_order: 1, created_at: AT(0) },
      { track_id: T2, artist_id: A3, role: 'composer', sort_order: 1, created_at: AT(0) },
    ]],
    ['music.lyric_sets', [
      { id: id(210), track_id: T1, locale: 'en', kind: 'original', sync_precision: 'line', publication_status: 'draft', ...stamps() },
      { id: id(211), track_id: T2, locale: 'en', kind: 'original', sync_precision: 'word', publication_status: 'draft', ...stamps() },
      { id: id(212), track_id: T2, locale: 'ar', kind: 'translation', sync_precision: 'line', publication_status: 'draft', ...stamps() },
    ]],
    ['music.lyric_lines', [
      { id: id(220), lyric_set_id: id(210), sequence: 1, text: 'one', start_ms: 0, end_ms: 900, ...stamps() },
      { id: id(221), lyric_set_id: id(210), sequence: 2, text: 'two', start_ms: 1000, end_ms: 1900, ...stamps() },
      { id: id(222), lyric_set_id: id(211), sequence: 1, text: 'one', start_ms: 0, ...stamps() },
      { id: id(223), lyric_set_id: id(211), sequence: 2, text: 'two', start_ms: null, ...stamps() },
      { id: id(224), lyric_set_id: id(212), sequence: 1, text: 'one', start_ms: 500, end_ms: 2000, ...stamps() },
      { id: id(225), lyric_set_id: id(212), sequence: 2, text: 'two', start_ms: 1000, ...stamps() },
    ]],
    ['music.artist_follows', [{ user_id: BOB, artist_id: A1, created_at: AT(0) }]],
    ['public.notification_devices', [
      { id: id(230), user_id: BOB, app_key: 'chc', platform: 'ios', provider: 'expo', push_token: 'bob', ...stamps() },
      { id: id(231), user_id: BOB, app_key: 'chc', platform: 'web', provider: 'web_push', push_token: 'bob-web', enabled: false, ...stamps() },
      { id: id(232), user_id: ALICE, app_key: 'chc_artists', platform: 'android', provider: 'expo', push_token: 'alice', ...stamps() },
      { id: id(233), user_id: DAVE, app_key: 'chc_artists', platform: 'web', provider: 'web_push', push_token: 'dave', ...stamps() },
      { id: id(234), user_id: CAROL, app_key: 'chc_admin', platform: 'windows', provider: 'wns', push_token: 'carol-wns', ...stamps() },
      { id: id(235), user_id: CAROL, app_key: 'chc_admin', platform: 'web', provider: 'web_push', push_token: 'carol', ...stamps() },
    ]],
    ['public.notification_preferences', [{ user_id: DAVE, app_key: 'chc_artists', category: 'release_updates', enabled: false, ...stamps() }]],
    ['learning.hymns', [{ id: id(240), title: 'Tenen', publication_status: 'published', ...stamps() }]],
    ['learning.lesson_sets', [{ id: id(241), cantor_id: K2, hymn_id: id(240), title: 'Tenen lessons', owner_creator_account_id: C1, publication_status: 'published', ...stamps() }]],
    ['media.media_processing_jobs', [
      { id: J1, media_asset_id: AUDIO2, input_bucket: 'chc-submissions', input_path: 'in/1', output_bucket: 'chc-music', status: 'processing', ...stamps() },
    ]],
  ];
}

let oracle: Oracle;
let worker: WorkerSide;
const tables = new Map((schema as { tables: UserTable[] }).tables.map((table) => [`${table.schema}.${table.table}`, table]));

before(async () => {
  oracle = await createOracle();
  worker = new WorkerSide();
  for (const [user, email] of [[ALICE, 'alice@example.com'], [BOB, 'bob@example.com'], [CAROL, 'carol@example.com'], [DAVE, 'dave@example.com']]) {
    await oracle.addUser(user, email);
    await worker.addUser(user, email);
  }
  await seed(oracle, worker, data());
  // The index as it stands, on both sides, before any write.
  await oracle.sql('select private.refresh_unified_search_index()');
  await rebuildSearchIndex(worker.env.DB);
});
after(() => oracle.close());

const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?\+00:00$/;

/** A table's rows on both sides, as comparable JSON: timestamps by presence, generated ids left out. */
async function rows(name: string): Promise<{ pg: string[]; sqlite: string[] }> {
  const table = tables.get(name)!;
  const [schemaName, tableName] = name.split('.');
  const drop = new Set(['notifications', 'notification_deliveries', 'search_documents'].includes(tableName) ? ['id'] : []);
  const kept = new Set(table.columns.map((c) => c.name)); // not the columns D1 doesn't keep (search_vector)
  const clean = (row: Record<string, unknown>) => JSON.stringify(Object.fromEntries(Object.keys(row).sort().filter((key) => kept.has(key) && !drop.has(key))
    .map((key) => [key, typeof row[key] === 'string' && TIMESTAMP.test(row[key] as string) ? '<timestamp>' : row[key]])));
  const pg = (await oracle.sql<{ row: Record<string, unknown> }>(`select to_jsonb(x) as row from "${schemaName}"."${tableName}" x`)).map(({ row }) => row);
  const sqlite = (worker.db.prepare(`SELECT * FROM "${name}"`).all() as Record<string, unknown>[]).map((row) => Object.fromEntries(table.columns.map((c) => {
    const value = row[c.name];
    if (value == null) return [c.name, null];
    if (c.kind === 'boolean') return [c.name, value === 1];
    if (c.kind === 'jsonb' || c.kind === 'array') return [c.name, JSON.parse(value as string)];
    return [c.name, value];
  })));
  // A delivery names its notification by content (the ids are each side's own).
  if (tableName === 'notification_deliveries') {
    const pgNotes = new Map((await oracle.sql<{ id: string; key: string }>(`select id::text, concat_ws('|', user_id, event_type, title, body) as key from public.notifications`)).map((n) => [n.id, n.key]));
    const sqliteNotes = new Map((worker.db.prepare(`SELECT "id", "user_id" || '|' || "event_type" || '|' || "title" || '|' || "body" AS key FROM "public.notifications"`).all() as { id: string; key: string }[]).map((n) => [n.id, n.key]));
    for (const row of pg) row.notification_id = pgNotes.get(row.notification_id as string) ?? row.notification_id;
    for (const row of sqlite) row.notification_id = sqliteNotes.get(row.notification_id as string) ?? row.notification_id;
  }
  return { pg: pg.map(clean).sort(), sqlite: sqlite.map(clean).sort() };
}

const WATCHED = [
  'music.releases', 'music.artists', 'music.artist_localizations', 'music.tracks', 'music.track_localizations', 'music.lyric_sets', 'music.release_tracks',
  'learning.cantors', 'learning.lessons', 'media.media_assets', 'media.submissions', 'media.media_processing_jobs',
  'public.notifications', 'private.notification_deliveries', 'media.search_documents',
];

async function same(what: string): Promise<void> {
  for (const name of WATCHED) {
    const { pg, sqlite } = await rows(name);
    assert.deepEqual(sqlite, pg, `${what}: ${name}`);
  }
}

/** The same statement on both sides, then the Worker's after-write step; both must succeed. */
async function write(pgSql: string, sqliteSql: string, what: string): Promise<void> {
  await oracle.sql(pgSql);
  worker.db.exec(sqliteSql);
  await afterWrites(worker.env);
  await same(what);
}

/** The same statement on both sides; both must refuse it with the same code and message. */
async function refused(pgSql: string, sqliteSql: string, what: string): Promise<void> {
  const pgError = await oracle.sql(pgSql).then(() => null, (error: { code?: string; message: string }) => error);
  let sqliteError: unknown = null;
  try { worker.db.exec(sqliteSql); } catch (error) { sqliteError = error; }
  assert.ok(pgError, `${what}: Postgres accepted it`);
  const mapped = triggerError(sqliteError);
  assert.ok(mapped, `${what}: SQLite answered ${String(sqliteError)}`);
  assert.equal(mapped.code, pgError.code, `${what}: code`);
  assert.equal(mapped.message, pgError.message, `${what}: message`);
  await same(`${what} (nothing changed)`);
}

test('seeded the same, with the same index', async () => {
  await same('seed');
  assert.ok((await rows('media.search_documents')).pg.length > 0);
});

test('publishing a release: its artwork, credits, tracks and lyrics, then the notifications', async () => {
  await write(
    `update music.releases set publication_status = 'published', updated_by = '${ALICE}' where id = '${R1}'`,
    `UPDATE "music.releases" SET "publication_status" = 'published', "updated_by" = '${ALICE}' WHERE "id" = '${R1}'`,
    'publish R1',
  );
  const notes = (await rows('public.notifications')).sqlite;
  assert.equal(notes.length, 2, 'the follower and the owner; the editor turned release updates off');
  assert.equal((await rows('private.notification_deliveries')).sqlite.length, 2, 'their enabled Expo and Web Push devices');
});

test("track lists set a release's type", async () => {
  for (const [pgSql, sqliteSql, what] of [
    [`insert into music.release_tracks (id, release_id, track_id, track_number) values ('${id(290)}', '${R2}', '${T1}', 2)`, `INSERT INTO "music.release_tracks" ("id", "release_id", "track_id", "track_number") VALUES ('${id(290)}', '${R2}', '${T1}', 2)`, 'add a track'],
    [`update music.release_tracks set release_id = '${R2}', track_number = 3 where release_id = '${R1}' and track_id = '${T2}'`, `UPDATE "music.release_tracks" SET "release_id" = '${R2}', "track_number" = 3 WHERE "release_id" = '${R1}' AND "track_id" = '${T2}'`, 'move a track'],
    [`delete from music.release_tracks where release_id = '${R1}'`, `DELETE FROM "music.release_tracks" WHERE "release_id" = '${R1}'`, 'empty a release'],
    // 3 tracks on R2 by now: one at a time to 9, through EP (to 6) and album (7 on).
    ...[0, 1, 2, 3, 4, 5].map((n) => [
      `insert into music.release_tracks (id, release_id, track_id, track_number) values ('${id(310 + n)}', '${R2}', '${id(300 + n)}', ${10 + n})`,
      `INSERT INTO "music.release_tracks" ("id", "release_id", "track_id", "track_number") VALUES ('${id(310 + n)}', '${R2}', '${id(300 + n)}', ${10 + n})`,
      `track ${4 + n} on R2`,
    ]),
    [`delete from music.release_tracks where track_number >= 13`, `DELETE FROM "music.release_tracks" WHERE "track_number" >= 13`, 'back to six'],
    [`delete from music.release_tracks where release_id = '${R2}' and track_id = '${T1}'`, `DELETE FROM "music.release_tracks" WHERE "release_id" = '${R2}' AND "track_id" = '${T1}'`, 'remove a track'],
  ]) await write(pgSql, sqliteSql, what);
});

test("artists' names, images and status reach their cantors", async () => {
  await write(
    `update music.artists set profile_image_asset_id = '${IMG_NEW}' where id = '${A1}'`,
    `UPDATE "music.artists" SET "profile_image_asset_id" = '${IMG_NEW}' WHERE "id" = '${A1}'`,
    'new image for Choir One',
  );
  await write(
    `update music.artists set display_name = 'Deacon Two Renamed', publication_status = 'published' where id = '${A2}'`,
    `UPDATE "music.artists" SET "display_name" = 'Deacon Two Renamed', "publication_status" = 'published' WHERE "id" = '${A2}'`,
    'rename and publish Deacon Two',
  );
  await write(
    `insert into music.artists (id, display_name, profile_image_asset_id, publication_status) values ('${id(250)}', 'Choir One', '${IMG_A2}', 'published')`,
    `INSERT INTO "music.artists" ("id", "display_name", "profile_image_asset_id", "publication_status") VALUES ('${id(250)}', 'Choir One', '${IMG_A2}', 'published')`,
    'a new artist named like a cantor',
  );
});

test('media jobs: a queued one wakes the processor, a failed one notifies', async () => {
  const wakes = async () => (await oracle.sql<{ n: number }>('select count(*)::int as n from net.http_requests'))[0].n;
  const before = await wakes();
  await write(
    `insert into media.media_processing_jobs (id, media_asset_id, input_bucket, input_path, output_bucket) values ('${J2}', '${AUDIO3}', 'chc-submissions', 'in/2', 'chc-music')`,
    `INSERT INTO "media.media_processing_jobs" ("id", "media_asset_id", "input_bucket", "input_path", "output_bucket") VALUES ('${J2}', '${AUDIO3}', 'chc-submissions', 'in/2', 'chc-music')`,
    'queue a job',
  );
  assert.equal(await wakes(), before + 1, 'Supabase woke the processor');
  // The Worker sent its wake-up in afterWrites; the outbox is empty again.
  assert.equal((worker.db.prepare('SELECT count(*) AS n FROM "private.outbox"').get() as { n: number }).n, 0);

  await oracle.sql(`update media.submission_items set media_processing_job_id = '${J1}' where id = '${id(90)}'`);
  worker.db.exec(`UPDATE "media.submission_items" SET "media_processing_job_id" = '${J1}' WHERE "id" = '${id(90)}'`);
  await write(
    `update media.media_processing_jobs set status = 'failed' where id = '${J1}'`,
    `UPDATE "media.media_processing_jobs" SET "status" = 'failed' WHERE "id" = '${J1}'`,
    'a job fails',
  );
  await write(
    `update media.media_processing_jobs set status = 'failed', attempt_count = 2 where id = '${J1}'`,
    `UPDATE "media.media_processing_jobs" SET "status" = 'failed', "attempt_count" = 2 WHERE "id" = '${J1}'`,
    'a failed job stays failed (no second notice)',
  );
});

test('submission statuses notify admins and creators', async () => {
  for (const status of ['pending_review', 'changes_requested', 'approved', 'published']) {
    await write(
      `update media.submissions set status = '${status}' where id = '${S3}'`,
      `UPDATE "media.submissions" SET "status" = '${status}' WHERE "id" = '${S3}'`,
      `lesson set ${status}`,
    );
  }
  await write(
    `update media.submissions set status = 'published' where id = '${S1}'`,
    `UPDATE "media.submissions" SET "status" = 'published' WHERE "id" = '${S1}'`,
    'a music release submission is published (the release notifies instead)',
  );
  await write(
    `insert into media.submissions (id, creator_account_id, submission_type, title, status, created_by) values ('${id(260)}', '${C1}', 'artist_update', 'New bio', 'pending_review', '${ALICE}')`,
    `INSERT INTO "media.submissions" ("id", "creator_account_id", "submission_type", "title", "status", "created_by") VALUES ('${id(260)}', '${C1}', 'artist_update', 'New bio', 'pending_review', '${ALICE}')`,
    'a new submission for review',
  );
});

test('deleting a release retires its submission', async () => {
  await write(`delete from music.releases where id = '${R3}'`, `DELETE FROM "music.releases" WHERE "id" = '${R3}'`, 'delete R3');
});

test("a video lesson takes its submission's audio", async () => {
  await write(
    `insert into learning.lessons (id, lesson_set_id, media_asset_id, media_type, title, metadata, publication_status, created_by) values ('${id(270)}', '${id(241)}', '${VIDEO}', 'video', 'Lesson', '{"submissionItemId": "${id(93)}"}', 'published', '${ALICE}')`,
    `INSERT INTO "learning.lessons" ("id", "lesson_set_id", "media_asset_id", "media_type", "title", "metadata", "publication_status", "created_by") VALUES ('${id(270)}', '${id(241)}', '${VIDEO}', 'video', 'Lesson', '{"submissionItemId": "${id(93)}"}', 'published', '${ALICE}')`,
    'insert a published video lesson',
  );
});

test("the release rules refuse what Supabase's refuse, with the same errors", async () => {
  await refused(
    `update music.releases set primary_artist_id = '${A2}' where id = '${R2}'`,
    `UPDATE "music.releases" SET "primary_artist_id" = '${A2}' WHERE "id" = '${R2}'`,
    "another artist on the account's release",
  );
  await refused(
    `insert into music.releases (id, title, release_type, owner_creator_account_id, primary_artist_id) values ('${id(280)}', 'X', 'single', '${C2}', '${A1}')`,
    `INSERT INTO "music.releases" ("id", "title", "release_type", "owner_creator_account_id", "primary_artist_id") VALUES ('${id(280)}', 'X', 'single', '${C2}', '${A1}')`,
    'an account with no identity',
  );
  const soon = new Date(Date.now() + 3600_000).toISOString().replace('Z', '+00:00');
  await refused(
    `update music.releases set scheduled_release_at = '${soon}' where id = '${R2}'`,
    `UPDATE "music.releases" SET "scheduled_release_at" = '${soon}' WHERE "id" = '${R2}'`,
    'scheduled within 48 hours',
  );
  await refused(
    `insert into music.releases (id, title, release_type, owner_creator_account_id, primary_artist_id, scheduled_release_at) values ('${id(281)}', 'X', 'single', '${C2}', '${A1}', '${soon}')`,
    `INSERT INTO "music.releases" ("id", "title", "release_type", "owner_creator_account_id", "primary_artist_id", "scheduled_release_at") VALUES ('${id(281)}', 'X', 'single', '${C2}', '${A1}', '${soon}')`,
    'both rules broken: the identity rule speaks first',
  );
  const later = new Date(Date.now() + 72 * 3600_000).toISOString().replace('Z', '+00:00');
  await write(
    `update music.releases set scheduled_release_at = '${later}' where id = '${R2}'`,
    `UPDATE "music.releases" SET "scheduled_release_at" = '${later}' WHERE "id" = '${R2}'`,
    'scheduled three days out',
  );
});

test('in replica mode, nothing fires', async () => {
  const state = () => worker.db.prepare(`SELECT (SELECT "version" FROM "private.search_index_state") AS version, (SELECT count(*) FROM "public.notifications") AS notes,
    (SELECT "updated_at" FROM "music.releases" WHERE "id" = '${R4}') AS stamp`).get();
  const before = state();
  worker.db.exec('UPDATE "private.replica_mode" SET "depth" = "depth" + 1');
  worker.db.exec(`UPDATE "music.releases" SET "publication_status" = 'published' WHERE "id" = '${R4}'`);
  worker.db.exec('UPDATE "private.replica_mode" SET "depth" = "depth" - 1');
  assert.deepEqual(state(), before, 'no index change counted, no notification, no updated_at stamp');
});
