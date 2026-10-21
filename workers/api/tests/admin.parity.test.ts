/**
 * Parity: CV-Admin's reads (src/rpc/admin/reads.ts), the Worker against
 * Supabase's own functions (the oracle), as the admin, as a creator who isn't
 * one, and signed out. Over tests/lib/creatorCatalog.ts plus what the admin
 * screens look at: reviews due at different times, a workspace named like
 * unclaimed artists, submission events, lyric sets, push devices, the
 * notification preferences that leave some out, and broadcasts with their
 * deliveries.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import {
  A1, A2, A3, A4, A5, A6, ALICE, BOB, C1, CAROL, catalog, id, S1, S2, S3, S4, S5, S6, S7, seedCatalog, T1, asset,
} from './lib/creatorCatalog.ts';
import { createOracle, type Oracle, type PgAnswer } from './lib/oracle.ts';
import { seed } from './lib/seed.ts';
import { normalize, WorkerSide, type Answer } from './lib/worker.ts';

const AT = '2026-03-10T08:00:00+00:00';
const minute = (n: number) => `2026-03-10T08:${String(n).padStart(2, '0')}:00+00:00`;
const hoursFromNow = (hours: number) => `${new Date(Date.now() + hours * 3600_000).toISOString().replace('Z', '')}+00:00`;

const C4 = id(501); const A7 = id(502); const A8 = id(503); const A9 = id(504); const C5 = id(505);
const S10 = id(510); const S11 = id(511); const S12 = id(512); const S13 = id(513); const S14 = id(514); const S15 = id(515); const S16 = id(516);
const R7 = id(517); const T7 = id(518); const AL2 = id(519);
const DEVICE = (n: number) => id(520 + n); const BROADCAST = (n: number) => id(535 + n); const DELIVERY = (n: number) => id(540 + n);
const LYRICS = (n: number) => id(560 + n); const LINE = (n: number) => id(570 + n); const EVENT = (n: number) => id(590 + n);

let oracle: Oracle;
let worker: WorkerSide;
const seeded = new Set(Array.from({ length: 700 }, (_, n) => id(n)));

before(async () => {
  oracle = await createOracle();
  worker = new WorkerSide();
  await seedCatalog(oracle, worker);
  const stamps = { created_at: AT, updated_at: AT };
  await seed(oracle, worker, [
    ['creator.creator_accounts', [
      { id: C4, display_name: 'Ibrahim Ayad', status: 'active', created_by: ALICE, ...stamps },
      { id: C5, display_name: 'Other Ibrahim', status: 'active', created_by: ALICE, ...stamps },
    ]],
    ['music.artists', [
      { id: A7, owner_creator_account_id: C4, display_name: 'Ibrahim Ayad', publication_status: 'draft', ...stamps },
      { id: A8, display_name: 'Ibrahim  Ayad!', publication_status: 'draft', profile_image_asset_id: asset(12), created_at: '2026-03-11T08:00:00+00:00', updated_at: AT },
      { id: A9, display_name: 'IBRAHIM AYAD', publication_status: 'draft', ...stamps },
    ]],
    ['music.tracks', [{ id: T7, owner_creator_account_id: C1, title: 'Live Track', media_asset_id: asset(13), publication_status: 'published', ...stamps }]],
    ['music.track_artists', [
      { track_id: T7, artist_id: A8, role: 'primary', sort_order: 0, created_at: AT },
      { track_id: T1, artist_id: A8, role: 'arranger', sort_order: 2, created_at: AT },
    ]],
    ['media.submissions', [
      { id: S10, creator_account_id: C4, submission_type: 'music_release', title: 'Overdue', status: 'pending_review', submitted_at: hoursFromNow(-72), review_due_at: hoursFromNow(-24), created_by: CAROL, ...stamps, created_at: minute(10) },
      { id: S11, creator_account_id: C1, submission_type: 'learning_album', title: 'Due Soon', description: 'Soon', status: 'pending_review', submitted_at: hoursFromNow(-40), review_due_at: hoursFromNow(6), created_by: ALICE, ...stamps, created_at: minute(11) },
      { id: S12, creator_account_id: C1, submission_type: 'learning_lesson_set', title: 'On Track', status: 'pending_review', submitted_at: hoursFromNow(-2), review_due_at: hoursFromNow(46), created_by: BOB, ...stamps, created_at: minute(12) },
      { id: S13, creator_account_id: C1, submission_type: 'music_release', title: 'Published Single', status: 'published', approved_at: AT, published_at: '2026-03-12T08:00:00+00:00', created_by: ALICE, ...stamps, created_at: minute(13) },
      { id: S14, creator_account_id: C1, submission_type: 'learning_album', title: 'Published Without Album', status: 'published', published_at: AT, created_by: ALICE, ...stamps, created_at: minute(14) },
      { id: S15, creator_account_id: C1, submission_type: 'artist_update', title: 'New Photo', status: 'approved', approved_at: AT, created_by: ALICE, ...stamps, created_at: minute(15) },
      { id: S16, creator_account_id: C5, submission_type: 'learning_album', title: 'Rejected', status: 'rejected', created_by: ALICE, ...stamps, created_at: minute(16) },
    ]],
    ['music.releases', [{ id: R7, owner_creator_account_id: C1, primary_artist_id: A1, release_type: 'single', title: 'Published Single', release_date: '2026-03-12',
      metadata: { submissionId: S13, note: null }, publication_status: 'published', ...stamps }]],
    ['music.release_tracks', [{ id: id(599), release_id: R7, track_id: T7, disc_number: 1, track_number: 1, created_at: AT }]],
    ['learning.albums', [{ id: AL2, owner_creator_account_id: C1, cantor_id: id(70), submission_id: S11, title: 'Due Soon', original_release_date: '2024-01-07', publication_status: 'pending_review', ...stamps }]],
    ['media.submission_items', [
      { id: id(596), submission_id: S13, role: 'track', title: 'Live Track', sort_order: 1, media_asset_id: asset(13), music_track_id: T7, ...stamps },
      { id: id(597), submission_id: S11, role: 'artwork', title: 'Second cover', sort_order: 0, media_asset_id: asset(2), created_at: '2026-03-11T08:00:00+00:00', updated_at: AT },
      { id: id(598), submission_id: S11, role: 'artwork', title: 'First cover', sort_order: 0, media_asset_id: asset(1), ...stamps },
    ]],
    ['media.submission_events', [
      { id: EVENT(1), submission_id: S1, actor_id: ALICE, action: 'submitted', from_status: 'draft', to_status: 'pending_review', metadata: { reviewDueAt: AT, extra: null }, created_at: '2026-03-03T08:00:00+00:00' },
      { id: EVENT(2), submission_id: S1, actor_id: CAROL, action: 'approved', from_status: 'pending_review', to_status: 'approved', notes: 'Looks good', metadata: {}, created_at: '2026-03-04T08:00:00+00:00' },
      { id: EVENT(3), submission_id: S1, actor_id: null, action: 'published_automatically', from_status: 'approved', to_status: 'approved', metadata: { list: [1, null] }, created_at: '2026-03-04T08:00:00+00:00' },
    ]],
    ['music.lyric_sets', [
      { id: LYRICS(1), track_id: T1, locale: 'en', kind: 'transliteration', sync_precision: 'line', title: 'Tenen (translit)', publication_status: 'draft', ...stamps },
      { id: LYRICS(2), track_id: T1, locale: 'en', kind: 'original', sync_precision: 'word', publication_status: 'published', ...stamps },
      { id: LYRICS(3), track_id: T1, locale: 'ar', kind: 'translation', sync_precision: 'unsynced', title: 'تينين', publication_status: 'published', ...stamps },
    ]],
    ['music.lyric_lines', [
      ...['Tenen', 'ebol', 'hiten', 'ti', 'anastasis', 'ente'].map((text, n) => ({ id: LINE(n), lyric_set_id: LYRICS(2), sequence: 6 - n, text, ...stamps })),
      { id: LINE(7), lyric_set_id: LYRICS(3), sequence: 1, text: 'نحن', ...stamps },
    ]],
    ['public.notification_devices', [
      { id: DEVICE(1), user_id: ALICE, app_key: 'chc', platform: 'ios', provider: 'expo', push_token: 'token-1', ...stamps },
      { id: DEVICE(2), user_id: ALICE, app_key: 'chc', platform: 'android', provider: 'expo', push_token: 'token-2', ...stamps },
      { id: DEVICE(3), user_id: null, app_key: 'chc', platform: 'web', provider: 'web_push', push_token: 'token-3', ...stamps },
      { id: DEVICE(4), user_id: BOB, app_key: 'chc', platform: 'ios', provider: 'expo', push_token: 'token-4', ...stamps },
      { id: DEVICE(5), user_id: CAROL, app_key: 'chc', platform: 'windows', provider: 'web_push', push_token: 'token-5', ...stamps },
      { id: DEVICE(6), user_id: CAROL, app_key: 'chc', platform: 'android', provider: 'expo', push_token: 'token-6', enabled: false, ...stamps },
      { id: DEVICE(7), user_id: CAROL, app_key: 'chc_admin', platform: 'web', provider: 'web_push', push_token: 'token-7', ...stamps },
      { id: DEVICE(8), user_id: ALICE, app_key: 'chc', platform: 'windows', provider: 'wns', push_token: 'token-8', ...stamps },
    ]],
    ['public.notification_preferences', [
      { user_id: BOB, app_key: 'chc', category: 'feast_celebrations', enabled: false, ...stamps },
      { user_id: ALICE, app_key: 'chc', category: 'announcements', enabled: false, ...stamps },
      { user_id: CAROL, app_key: 'chc', category: 'announcements', enabled: true, ...stamps },
    ]],
    ['public.notification_broadcasts', [
      { id: BROADCAST(1), app_key: 'chc', category: 'feast_celebrations', title: 'Happy Feast', body: 'Christ is risen', deep_link: '/home', created_by: CAROL, recipient_count: 3, delivery_count: 3, created_at: '2026-03-05T08:00:00+00:00' },
      { id: BROADCAST(2), app_key: 'chc', category: 'announcements', title: 'News', body: 'A new album', created_by: CAROL, recipient_count: 2, delivery_count: 3, created_at: '2026-03-06T08:00:00+00:00' },
      { id: BROADCAST(3), app_key: 'chc_admin', category: 'announcements', title: 'Admins only', body: 'Hidden', created_by: CAROL, recipient_count: 0, delivery_count: 0, created_at: '2026-03-07T08:00:00+00:00' },
      { id: BROADCAST(4), app_key: 'chc', category: 'announcements', title: 'Nobody', body: 'No deliveries', created_by: CAROL, recipient_count: 0, delivery_count: 0, created_at: '2026-03-04T08:00:00+00:00' },
    ]],
    ['private.notification_deliveries', [
      { id: DELIVERY(1), broadcast_id: BROADCAST(1), device_id: DEVICE(1), provider: 'expo', status: 'delivered', accepted_at: '2026-03-05T08:01:00+00:00', delivered_at: '2026-03-05T08:02:00+00:00', ...stamps },
      { id: DELIVERY(2), broadcast_id: BROADCAST(1), device_id: DEVICE(2), provider: 'expo', status: 'failed', ...stamps },
      { id: DELIVERY(3), broadcast_id: BROADCAST(1), device_id: DEVICE(3), provider: 'web_push', status: 'queued', available_at: '2026-03-05T09:00:00+00:00', ...stamps },
      { id: DELIVERY(4), broadcast_id: BROADCAST(2), device_id: DEVICE(4), provider: 'expo', status: 'accepted', accepted_at: '2026-03-06T08:05:00+00:00', ...stamps },
      { id: DELIVERY(5), broadcast_id: BROADCAST(2), device_id: DEVICE(5), provider: 'web_push', status: 'processing', ...stamps },
      { id: DELIVERY(6), broadcast_id: BROADCAST(2), device_id: DEVICE(3), provider: 'web_push', status: 'disabled', ...stamps },
      { id: DELIVERY(7), broadcast_id: BROADCAST(2), device_id: DEVICE(1), provider: 'expo', status: 'queued', available_at: hoursFromNow(5), ...stamps },
      { id: DELIVERY(8), broadcast_id: BROADCAST(3), device_id: DEVICE(7), provider: 'web_push', status: 'queued', available_at: '2026-03-01T09:00:00+00:00', ...stamps },
    ]],
  ]);
  await oracle.sql(`update creator.creator_accounts set identity_artist_id = '${A7}' where id = '${C4}'`);
  await oracle.sql(`update creator.creator_accounts set identity_artist_id = '${A9}' where id = '${C5}'`);
  worker.db.exec('UPDATE "private.replica_mode" SET "depth" = "depth" + 1');
  worker.db.exec(`UPDATE "creator.creator_accounts" SET "identity_artist_id" = '${A7}' WHERE "id" = '${C4}'`);
  worker.db.exec(`UPDATE "creator.creator_accounts" SET "identity_artist_id" = '${A9}' WHERE "id" = '${C5}'`);
  worker.db.exec('UPDATE "private.replica_mode" SET "depth" = "depth" - 1');
});
after(() => oracle.close());

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
  const what = `${fn}(${JSON.stringify(args).slice(0, 200)}) as ${user ?? 'anon'}`;
  const pg = await oracle.call(user, fn, args);
  const w = await worker.rpc(user, fn, args);
  same(pg, w, what);
  return pg;
}

const SUBMISSIONS = [S1, S2, S3, S4, S5, S6, S7, S10, S11, S12, S13, S14, S15, S16];
const ARTISTS = [A1, A2, A3, A4, A5, A6, A7, A8, A9];

test('the oracle loaded the admin functions', () => {
  assert.deepEqual(oracle.failures.filter((f) => /admin/.test(f.statement)), []);
  assert.ok(catalog().length > 0);
});

test('is_chc_admin: true only for an admin; signed out, refused by its grant', async () => {
  for (const user of [CAROL, ALICE, BOB]) await both(user, 'is_chc_admin');
  await both(null, 'is_chc_admin');
});

test('the review queue: work still to do by default, any statuses by name, the due states and the counts', async () => {
  const answer = await both(CAROL, 'get_admin_review_queue');
  const due = (answer.data as { submissions: { id: string; dueState: string | null }[] }).submissions.map((s) => s.dueState);
  assert.ok(due.includes('overdue') && due.includes('due_soon') && due.includes('on_track'), JSON.stringify(due));
  for (const statuses of [[], ['published', 'rejected'], ['archived'], ['draft', null], ['pending_review', 'pending_review'], ['bogus'], ['Approved']]) {
    await both(CAROL, 'get_admin_review_queue', { p_statuses: statuses });
  }
  await both(ALICE, 'get_admin_review_queue');
  await both(null, 'get_admin_review_queue');
});

test('a submission in detail: its catalog record, files, artwork, events, lyrics and what blocks a decision', async () => {
  for (const submission of SUBMISSIONS) await both(CAROL, 'get_admin_submission_detail', { p_submission_id: submission });
  await both(CAROL, 'get_admin_submission_detail', { p_submission_id: id(699) });
  await both(CAROL, 'get_admin_submission_detail', { p_submission_id: 'not-a-uuid' });
  await both(ALICE, 'get_admin_submission_detail', { p_submission_id: S1 });
});

test('publication: ready, waiting and published', async () => {
  await both(CAROL, 'get_admin_publication_overview');
  await both(ALICE, 'get_admin_publication_overview');
});

test('processing jobs: one row per file, the audio-only copy inside its video', async () => {
  await both(CAROL, 'get_admin_processing_jobs');
  await both(BOB, 'get_admin_processing_jobs');
});

test('artists: every one or by a search (ILIKE, so % and _ match anything), and one by id', async () => {
  for (const search of [null, '', '   ', 'mina', 'MINA', ' ibrahim ', 'ib%ad', 'mo_allem', '%', '\\%', 'choir of saint', 'تينين', 'zzz',
    // Regular expressions' own characters, matched as themselves.
    'Abdel-Messih', '-', 'of.saint', 'a(b)', '[', 'x{2}', 'a|b', 'x/y', '^choir', 'mark$', 'mo+', '\\-']) {
    await both(CAROL, 'get_admin_artists', { p_search: search });
  }
  await both(ALICE, 'get_admin_artists');
  for (const artist of ARTISTS) await both(CAROL, 'get_admin_artist_profile', { p_artist_id: artist });
  await both(CAROL, 'get_admin_artist_profile', { p_artist_id: id(698) });
  await both(ALICE, 'get_admin_artist_profile', { p_artist_id: A1 });
});

test('artist claims: same-named, unowned, unclaimed artists, only while the workspace is unpublished', async () => {
  for (const submission of [...SUBMISSIONS, id(697)]) await both(CAROL, 'get_admin_creator_artist_claims', { p_submission_id: submission });
  await both(ALICE, 'get_admin_creator_artist_claims', { p_submission_id: S10 });
});

test('broadcast overview: the audience a category reaches, the dispatcher, and the recent broadcasts', async () => {
  for (const args of [{}, { p_category: 'announcements' }, { p_category: ' announcements ' }, { p_category: 'feast_celebrations', p_history_limit: 1 },
    { p_category: null }, { p_history_limit: 0 }, { p_history_limit: 99 }, { p_history_limit: null }, { p_category: 'Announcements' }]) {
    await both(CAROL, 'get_admin_notification_broadcast_overview', args);
  }
  await both(ALICE, 'get_admin_notification_broadcast_overview');
});

test('signed out, the ones granted only to signed-in users are refused by their grants', async () => {
  for (const fn of ['get_admin_publication_overview', 'get_admin_processing_jobs', 'get_admin_artists', 'get_admin_notification_broadcast_overview']) await both(null, fn);
});
