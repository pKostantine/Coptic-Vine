/**
 * Parity: CV-Admin's writes (src/rpc/admin/writes.ts), the Worker against
 * Supabase's own functions (the oracle), over tests/lib/creatorCatalog.ts
 * plus submissions waiting for review (music due now and later, an album and
 * a lesson set due now, an album whose cantor isn't published), a workspace
 * whose name matches an unowned credit, jobs in every state of staleness, and
 * notification devices. After every call (successful or refused) every table
 * the admin writes is compared, generated ids renamed (tests/lib/tables.ts):
 * a refused call must leave both sides as they were.
 *
 * Supabase's confirm_admin_creator_artist_claim sets the generated column
 * is_credit_only, which Postgres refuses; the oracle's copy leaves that
 * assignment out, as the Worker does.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { A1, A2, A6, ALICE, AL1, BOB, C1, C2, CAROL, id, intent, job, K1, K2, LS1, R1, R2, R3, R4, R5, S1, S2, S3, S5, S6, S7, seedCatalog, T2, T3, T4 } from './lib/creatorCatalog.ts';
import { createOracle, type Oracle, type PgAnswer } from './lib/oracle.ts';
import { seed } from './lib/seed.ts';
import { bothTables, firstDifferences } from './lib/tables.ts';
import { normalize, WorkerSide, type Answer } from './lib/worker.ts';

const AT = '2026-03-10T08:00:00+00:00';
const ago = (hours: number) => `${new Date(Date.now() - hours * 3600_000).toISOString().replace('Z', '')}+00:00`;
const later = (days: number) => `${new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 13)}:00:00+00:00`;
const asset = (n: number) => id(100 + n);

// Waiting for review: SA (music, as soon as approved), SB (music, scheduled later), SC (an album) and SD (a lesson set) due now, SE (an album whose cantor isn't published), SF.
const SA = id(600); const RA = id(601); const TA = id(602);
const SB = id(605); const RB = id(606); const TB = id(607);
const SC = id(609); const ALB = id(610);
const SD = id(613); const HB = id(614); const LSB = id(615);
const SE = id(618); const ALE = id(619);
const SF = id(621);
// A workspace named like an unowned credit.
const C4 = id(622); const A7 = id(623); const A8 = id(624); const SG = id(625); const RG = id(626); const A10 = id(627);
const ZED = id(628);
const DEVICE = (n: number) => id(660 + n);

let oracle: Oracle;
let worker: WorkerSide;
const seeded = new Set(Array.from({ length: 700 }, (_, n) => id(n)));

const TABLES = [
  'creator.creator_accounts', 'music.artists', 'music.artist_localizations', 'music.artist_memberships', 'music.artist_follows', 'music.artist_social_links',
  'music.artist_pinned_releases', 'music.releases', 'music.release_localizations', 'music.tracks', 'music.track_localizations', 'music.release_tracks', 'music.track_artists',
  'media.submissions', 'media.submission_items', 'media.submission_events', 'media.media_processing_jobs', 'media.upload_intents', 'media.media_assets',
  'learning.cantors', 'learning.hymns', 'learning.albums', 'learning.lesson_sets', 'learning.album_recordings', 'learning.lessons', 'learning.recording_localizations',
  'learning.lesson_localizations', 'public.notifications', 'public.notification_broadcasts', 'private.notification_deliveries', 'media.search_documents',
];

before(async () => {
  oracle = await createOracle();
  worker = new WorkerSide();
  await seedCatalog(oracle, worker);
  await oracle.addUser(ZED, 'zed@example.com');
  await worker.addUser(ZED, 'zed@example.com');
  const stamps = { created_at: AT, updated_at: AT };
  const media = (n: number, type: string) => ({ id: asset(n), owner_creator_account_id: C1, bucket: type === 'image' ? 'chc-images' : 'chc-music', path: `${type}/${n}`, media_type: type,
    duration_ms: type === 'image' ? null : 3000 + n, processing_status: 'completed', publication_status: 'draft', ...stamps });
  const pending = { status: 'pending_review', submitted_at: ago(5), review_due_at: later(1), created_by: ALICE, ...stamps };
  const upload = (n: number, type: string, extra: Record<string, unknown>) => ({
    id: id(n), creator_account_id: C2, requested_by: CAROL, bucket: 'chc-submissions', media_type: type, path: `submissions/${C2}/${id(n)}/original`, original_filename: `admin-${n}`,
    content_type: `${type}/x`, content_length: 10, status: 'uploaded', upload_expires_at: AT, uploaded_size: 10, uploaded_at: AT, ...stamps, ...extra,
  });
  const work = (n: number, intentId: string, type: string, status: string, extra: Record<string, unknown>) => ({
    id: id(n), upload_intent_id: intentId, job_type: type, status, input_bucket: 'chc-submissions', input_path: `in/${n}`, output_bucket: 'chc-music', attempt_count: 1, max_attempts: 3, ...stamps, ...extra,
  });
  await seed(oracle, worker, [
    ['media.media_assets', [media(60, 'audio'), media(61, 'audio'), media(62, 'image'), media(63, 'audio'), media(64, 'video'), media(65, 'audio'), media(66, 'audio')]],
    ['creator.creator_accounts', [{ id: C4, display_name: 'Ibrahim Ayad', status: 'active', created_by: BOB, ...stamps }]],
    ['creator.user_roles', [{ user_id: ZED, role: 'admin', granted_at: AT }]],
    ['music.artists', [
      { id: A7, owner_creator_account_id: C4, display_name: 'Ibrahim Ayad', biography: 'Old bio', publication_status: 'draft', metadata: { note: 'kept' }, ...stamps },
      { id: A8, display_name: 'Ibrahim  Ayad!', biography: '', profile_image_asset_id: asset(2), publication_status: 'draft', ...stamps },
      { id: A10, display_name: 'CHOIR ACCOUNT', publication_status: 'draft', ...stamps },
    ]],
    ['music.artist_localizations', [
      { id: id(670), artist_id: A7, locale: 'ar', display_name: 'إبراهيم عياد', is_primary: false, publication_status: 'draft', created_by: BOB, ...stamps },
      { id: id(671), artist_id: A7, locale: 'fr', display_name: 'Ibrahim (fr)', is_primary: true, publication_status: 'draft', created_by: BOB, ...stamps },
      { id: id(672), artist_id: A8, locale: 'ar', display_name: 'موجود', is_primary: false, publication_status: 'draft', ...stamps },
    ]],
    ['music.artist_memberships', [{ id: id(673), artist_id: A7, creator_account_id: C4, role: 'owner', ...stamps }]],
    ['music.artist_follows', [{ user_id: ALICE, artist_id: A7, created_at: AT }, { user_id: BOB, artist_id: A7, created_at: AT }, { user_id: ALICE, artist_id: A8, created_at: AT }]],
    ['music.artist_social_links', [
      { id: id(674), artist_id: A7, platform: 'youtube', url: 'https://youtube.com/@ibrahim', sort_order: 0, ...stamps },
      { id: id(675), artist_id: A7, platform: 'website', url: 'https://ibrahim.example', sort_order: 1, ...stamps },
      { id: id(676), artist_id: A8, platform: 'youtube', url: 'https://youtube.com/@other', sort_order: 0, ...stamps },
    ]],
    ['music.artist_pinned_releases', [{ artist_id: A7, release_id: R2, sort_order: 1, created_at: AT }]],
    ['music.tracks', [
      { id: TA, owner_creator_account_id: C1, title: 'Approve Now', media_asset_id: asset(60), publication_status: 'draft', ...stamps },
      { id: TB, owner_creator_account_id: C1, title: 'Scheduled Later', media_asset_id: asset(65), publication_status: 'draft', ...stamps },
    ]],
    ['media.submissions', [
      { id: SA, creator_account_id: C1, submission_type: 'music_release', title: 'Approve Now', ...pending },
      { id: SB, creator_account_id: C1, submission_type: 'music_release', title: 'Scheduled Later', ...pending },
      { id: SC, creator_account_id: C1, submission_type: 'learning_album', title: 'Fresh Album', ...pending },
      { id: SD, creator_account_id: C1, submission_type: 'learning_lesson_set', title: 'Fresh Lessons', ...pending },
      { id: SE, creator_account_id: C1, submission_type: 'learning_album', title: 'Unpublished Cantor', ...pending },
      { id: SF, creator_account_id: C1, submission_type: 'music_release', title: 'To Reject', ...pending },
      { id: SG, creator_account_id: C4, submission_type: 'music_release', title: 'Ibrahim Draft', status: 'draft', created_by: BOB, ...stamps },
    ]],
    ['music.releases', [
      { id: RA, owner_creator_account_id: C1, primary_artist_id: A1, release_type: 'single', title: 'Approve Now', metadata: { submissionId: SA }, publication_status: 'draft', release_timing_mode: 'asap', ...stamps },
      { id: RB, owner_creator_account_id: C1, primary_artist_id: A1, release_type: 'single', title: 'Scheduled Later', metadata: { submissionId: SB }, publication_status: 'draft',
        release_timing_mode: 'scheduled', scheduled_release_at: later(10), ...stamps },
      { id: RG, owner_creator_account_id: C4, primary_artist_id: A7, release_type: 'single', title: 'Ibrahim Draft', metadata: { submissionId: SG }, publication_status: 'draft', ...stamps },
    ]],
    ['music.release_tracks', [
      { id: id(650), release_id: RA, track_id: TA, disc_number: 1, track_number: 1, created_at: AT },
      { id: id(651), release_id: RB, track_id: TB, disc_number: 1, track_number: 1, created_at: AT },
    ]],
    ['music.track_artists', [
      { track_id: TA, artist_id: A1, role: 'primary', sort_order: 0, created_at: AT }, { track_id: TA, artist_id: A6, role: 'featured', sort_order: 1, created_at: AT },
      { track_id: TB, artist_id: A1, role: 'primary', sort_order: 0, created_at: AT },
      { track_id: T2, artist_id: A7, role: 'featured', sort_order: 3, created_at: AT }, { track_id: T4, artist_id: A7, role: 'composer', sort_order: 1, created_at: AT },
      { track_id: T2, artist_id: A8, role: 'featured', sort_order: 0, created_at: AT },
    ]],
    ['learning.hymns', [{ id: HB, title: 'Alice Hymn', publication_status: 'draft', created_by: ALICE, metadata: { creatorAccountId: C1 }, ...stamps }]],
    ['learning.albums', [
      { id: ALB, owner_creator_account_id: C1, cantor_id: K1, submission_id: SC, title: 'Fresh Album', publication_status: 'draft', release_timing_mode: 'asap', ...stamps },
      { id: ALE, owner_creator_account_id: C1, cantor_id: K2, submission_id: SE, title: 'Unpublished Cantor', publication_status: 'draft', release_timing_mode: 'asap', ...stamps },
    ]],
    ['learning.lesson_sets', [{ id: LSB, owner_creator_account_id: C1, cantor_id: K1, hymn_id: HB, submission_id: SD, title: 'Fresh Lessons', publication_status: 'draft', release_timing_mode: 'asap', ...stamps }]],
    ['media.submission_items', [
      { id: id(604), submission_id: SA, role: 'track', title: 'Approve Now', sort_order: 1, media_asset_id: asset(60), music_track_id: TA, ...stamps },
      { id: id(608), submission_id: SB, role: 'track', title: 'Scheduled Later', sort_order: 1, media_asset_id: asset(65), music_track_id: TB, ...stamps },
      { id: id(611), submission_id: SC, role: 'track', title: null, sort_order: 1, media_asset_id: asset(61), localized_titles: { en: ' Hello ', ar: 'مرحبا', fr: '  ', de: 'x' }, ...stamps },
      { id: id(612), submission_id: SC, role: 'artwork', title: 'Cover', sort_order: 0, media_asset_id: asset(62), ...stamps },
      { id: id(616), submission_id: SD, role: 'lesson', title: 'Lesson A', sort_order: 1, media_asset_id: asset(63), localized_titles: { ar: 'درس' }, ...stamps },
      { id: id(617), submission_id: SD, role: 'lesson', title: 'Lesson B', sort_order: 2, media_asset_id: asset(64), ...stamps },
      { id: id(620), submission_id: SE, role: 'track', title: 'Recording', sort_order: 1, media_asset_id: asset(66), ...stamps },
    ]],
    ['media.upload_intents', [upload(630, 'image', {}), upload(631, 'audio', {})]],
    ['media.media_processing_jobs', [
      // Stale: claimed three hours ago without a heartbeat, or with one ten minutes old. Fresh: a heartbeat two minutes ago, a video claimed an hour ago.
      work(640, intent(10), 'audio_delivery', 'processing', { claimed_at: ago(3), worker_id: 'w1', started_at: ago(3), progress: 0.4 }),
      work(641, intent(14), 'audio_delivery', 'processing', { claimed_at: ago(1), heartbeat_at: ago(2 / 60) }),
      work(642, intent(13), 'audio_delivery', 'processing', { claimed_at: ago(3), heartbeat_at: ago(10 / 60) }),
      work(643, intent(15), 'video_delivery', 'processing', { claimed_at: ago(1) }),
      work(644, intent(1), 'metadata_probe', 'failed', { attempt_count: 3, error_message: 'Gave up', finished_at: AT }),
      work(645, intent(18), 'audio_delivery', 'failed', { error_message: 'Decoder error', finished_at: AT }),
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
    ]],
  ]);
  await oracle.sql('set session_replication_role = replica');
  worker.db.exec('UPDATE "private.replica_mode" SET "depth" = "depth" + 1');
  await oracle.sql(`update creator.creator_accounts set identity_artist_id = '${A7}' where id = '${C4}'`);
  worker.db.exec(`UPDATE "creator.creator_accounts" SET "identity_artist_id" = '${A7}' WHERE "id" = '${C4}'`);
  await oracle.sql('set session_replication_role = origin');
  worker.db.exec('UPDATE "private.replica_mode" SET "depth" = "depth" - 1');
  // Supabase's claim sets the generated is_credit_only; the oracle's copy doesn't (see the header).
  const definition = (await oracle.sql<{ def: string }>(`select pg_get_functiondef('public.confirm_admin_creator_artist_claim(uuid, uuid)'::regprocedure) as def`))[0].def;
  assert.ok(definition.includes('is_credit_only=false,'));
  await oracle.sql(definition.replace('is_credit_only=false,', ''));
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
  const w = await worker.rpc(user, fn, args);
  same(pg, w, what);
  await sameTables(`after ${what}`);
  return pg;
}

/** A call both sides must accept. */
async function ok(user: string | null, fn: string, args: Record<string, unknown> = {}): Promise<PgAnswer> {
  const answer = await both(user, fn, args);
  assert.equal(answer.error, null, `${fn} should succeed: ${answer.error?.message}`);
  return answer;
}

/** A call both sides must refuse. */
async function refused(user: string | null, fn: string, args: Record<string, unknown> = {}): Promise<PgAnswer> {
  const answer = await both(user, fn, args);
  assert.ok(answer.error, `${fn}(${JSON.stringify(args)}) should be refused`);
  return answer;
}

test('reviews: refused when not an admin, not pending, or not ready; changes requested and rejections with their notes', async () => {
  await refused(ALICE, 'review_media_submission', { p_submission_id: SF, p_action: 'reject' });
  await refused(CAROL, 'review_media_submission', { p_submission_id: SF, p_action: 'publish' });
  await refused(CAROL, 'review_media_submission', { p_submission_id: SF, p_action: 'request_changes', p_notes: '   ' });
  await refused(CAROL, 'review_media_submission', { p_submission_id: id(699), p_action: 'reject' });
  await refused(CAROL, 'review_media_submission', { p_submission_id: S1, p_action: 'approve' });
  // S2's file is still processing.
  await refused(CAROL, 'review_media_submission', { p_submission_id: S2, p_action: ' APPROVE ' });
  await ok(CAROL, 'review_media_submission', { p_submission_id: S2, p_action: 'Request_Changes', p_notes: '  Fix the audio  ' });
  await refused(CAROL, 'review_media_submission', { p_submission_id: S2, p_action: 'reject' });
  await ok(CAROL, 'review_media_submission', { p_submission_id: SF, p_action: 'reject', p_notes: '  ' });
  await refused(null, 'review_media_submission', { p_submission_id: SF, p_action: 'reject' });
});

test('approvals: what is due goes live (a release, an album, a lesson set); what is scheduled waits; an unpublished cantor refuses it all', async () => {
  const status = (answer: PgAnswer) => (answer.data as { status: string }[])[0].status;
  assert.equal(status(await ok(CAROL, 'review_media_submission', { p_submission_id: SA, p_action: 'approve', p_notes: 'Lovely' })), 'published');
  assert.equal(status(await ok(CAROL, 'review_media_submission', { p_submission_id: SB, p_action: 'approve' })), 'approved');
  assert.equal(status(await ok(CAROL, 'review_media_submission', { p_submission_id: SC, p_action: 'approve' })), 'published');
  assert.equal(status(await ok(CAROL, 'review_media_submission', { p_submission_id: SD, p_action: 'approve' })), 'published');
  await refused(CAROL, 'review_media_submission', { p_submission_id: SE, p_action: 'approve' });
});

test('publishing a submission: approved and ready, its files published; otherwise refused', async () => {
  await refused(ALICE, 'publish_media_submission', { p_submission_id: S6 });
  await refused(CAROL, 'publish_media_submission', { p_submission_id: S5 });
  await refused(CAROL, 'publish_media_submission', { p_submission_id: S1 });
  await refused(CAROL, 'publish_media_submission', { p_submission_id: S7 });
  await refused(CAROL, 'publish_media_submission', { p_submission_id: id(699) });
  await ok(CAROL, 'publish_media_submission', { p_submission_id: S6 });
  await ok(CAROL, 'publish_media_submission', { p_submission_id: SB });
});

test('publishing a release: every track processed and published, then its artists, tracks and translations', async () => {
  await refused(CAROL, 'publish_music_release', { p_release_id: id(699) });
  await refused(CAROL, 'publish_music_release', { p_release_id: R3 });
  await refused(CAROL, 'publish_music_release', { p_release_id: R1 });
  await refused(BOB, 'publish_music_release', { p_release_id: RB });
  await ok(CAROL, 'publish_music_release', { p_release_id: RB });
  await ok(CAROL, 'publish_music_release', { p_release_id: RB });
});

test('publishing an album or a lesson set by hand: a published cantor, hymn and season, an approved submission, processed published files', async () => {
  await refused(ALICE, 'publish_learning_album', { p_album_id: ALB });
  await refused(CAROL, 'publish_learning_album', { p_album_id: id(699) });
  await refused(CAROL, 'publish_learning_album', { p_album_id: AL1 });
  await refused(CAROL, 'publish_learning_album', { p_album_id: ALE });
  await ok(CAROL, 'publish_learning_album', { p_album_id: ALB });
  await refused(ALICE, 'publish_learning_lesson_set', { p_lesson_set_id: LSB });
  await refused(CAROL, 'publish_learning_lesson_set', { p_lesson_set_id: id(699) });
  await refused(CAROL, 'publish_learning_lesson_set', { p_lesson_set_id: LS1 });
  await ok(CAROL, 'publish_learning_lesson_set', { p_lesson_set_id: LSB });
});

test('release dates: scheduled, cleared, an original date; noted on the submission', async () => {
  await refused(ALICE, 'admin_update_music_release_dates', { p_release_id: R1, p_original_release_date: '2019-01-01' });
  await refused(CAROL, 'admin_update_music_release_dates', { p_release_id: id(699) });
  await ok(CAROL, 'admin_update_music_release_dates', { p_release_id: R1, p_original_release_date: '2019-01-01' });
  await ok(CAROL, 'admin_update_music_release_dates', { p_release_id: R1, p_clear_scheduled_release_at: true });
  await ok(CAROL, 'admin_update_music_release_dates', { p_release_id: R3, p_scheduled_release_at: later(12) });
  await ok(CAROL, 'admin_update_music_release_dates', { p_release_id: R3, p_clear_original_release_date: true, p_clear_scheduled_release_at: false });
  await ok(CAROL, 'admin_update_music_release_dates', { p_release_id: R4, p_scheduled_release_at: later(14), p_original_release_date: '2001-02-03' });
  await ok(CAROL, 'admin_update_music_release_dates', { p_release_id: R2 });
  // Too soon for the scheduling window.
  await refused(CAROL, 'admin_update_music_release_dates', { p_release_id: R4, p_scheduled_release_at: later(0.01) });
});

test('jobs: forced one at a time (not finished, not active, the original kept), retried, and every pending one at once', async () => {
  await refused(ALICE, 'force_media_processing_job', { p_job_id: job(2) });
  await refused(CAROL, 'force_media_processing_job', { p_job_id: id(699) });
  await refused(CAROL, 'force_media_processing_job', { p_job_id: job(1) });
  await refused(CAROL, 'force_media_processing_job', { p_job_id: id(641) });
  await refused(CAROL, 'force_media_processing_job', { p_job_id: id(643) });
  await refused(CAROL, 'force_media_processing_job', { p_job_id: job(11) });
  for (const forced of [id(640), id(642), id(644), job(8)]) await ok(CAROL, 'force_media_processing_job', { p_job_id: forced });
  await refused(CAROL, 'retry_media_processing_job', { p_job_id: id(699) });
  await refused(CAROL, 'retry_media_processing_job', { p_job_id: job(5) });
  await ok(CAROL, 'retry_media_processing_job', { p_job_id: id(645) });
  await ok(CAROL, 'retry_media_processing_job', { p_job_id: job(7) });
  await refused(CAROL, 'force_submission_media_processing', { p_submission_id: id(699) });
  await ok(CAROL, 'force_submission_media_processing', { p_submission_id: S1 });
  await ok(CAROL, 'force_submission_media_processing', { p_submission_id: S3 });
  await refused(BOB, 'force_pending_media_processing_jobs', {});
  await ok(CAROL, 'force_pending_media_processing_jobs', {});
  await ok(CAROL, 'force_pending_media_processing_jobs', {});
});

test('artist claims: an unowned credit of the same name becomes the workspace identity, taking over what the draft identity had', async () => {
  await refused(ALICE, 'confirm_admin_creator_artist_claim', { p_submission_id: SG, p_existing_artist_id: A8 });
  await refused(CAROL, 'confirm_admin_creator_artist_claim', { p_submission_id: id(699), p_existing_artist_id: A8 });
  for (const target of [id(699), A2, A1, A7]) await refused(CAROL, 'confirm_admin_creator_artist_claim', { p_submission_id: SG, p_existing_artist_id: target });
  // C1's identity is live (A10 is named like C1, before the profile test renames it).
  const live = await refused(CAROL, 'confirm_admin_creator_artist_claim', { p_submission_id: S1, p_existing_artist_id: A10 });
  assert.match(live.error!.message, /live artist profile/);
  await ok(CAROL, 'confirm_admin_creator_artist_claim', { p_submission_id: SG, p_existing_artist_id: A8 });
  await refused(CAROL, 'confirm_admin_creator_artist_claim', { p_submission_id: SG, p_existing_artist_id: A8 });
});

test('artist profiles: renamed (the workspace with it), a biography cleared, links replaced, a new photo queued', async () => {
  await refused(ALICE, 'update_admin_artist_profile', { p_artist_id: A2, p_display_name: 'Mine' });
  await refused(CAROL, 'update_admin_artist_profile', { p_artist_id: id(699), p_display_name: 'Nobody' });
  await ok(CAROL, 'update_admin_artist_profile', { p_artist_id: A2, p_display_name: '  Deacon Mina Sr.  ', p_biography: '  ', p_social_links: [{ platform: 'youtube', url: 'youtube.com/@mina' }] });
  await ok(CAROL, 'update_admin_artist_profile', { p_artist_id: A1, p_display_name: 'Choir of St Mark', p_biography: ' A choir in Cairo ' });
  await ok(CAROL, 'update_admin_artist_profile', { p_artist_id: A1 });
  await refused(CAROL, 'update_admin_artist_profile', { p_artist_id: A2, p_social_links: { platform: 'youtube' } });
  await refused(CAROL, 'update_admin_artist_profile', { p_artist_id: A2, p_social_links: [{ platform: 'myspace', url: 'https://myspace.com/x' }] });
  await refused(CAROL, 'update_admin_artist_profile', { p_artist_id: A2, p_profile_image_upload_intent_id: intent(9) });
  await refused(CAROL, 'update_admin_artist_profile', { p_artist_id: A2, p_profile_image_upload_intent_id: id(631) });
  await refused(CAROL, 'update_admin_artist_profile', { p_artist_id: A2, p_profile_image_upload_intent_id: id(699) });
  await ok(CAROL, 'update_admin_artist_profile', { p_artist_id: A2, p_profile_image_upload_intent_id: id(630) });
});

test('deleting: a release, a track, an album or lesson set, noted on their submissions', async () => {
  await refused(ALICE, 'delete_admin_music_release_track', { p_release_id: R1, p_track_id: T3 });
  await refused(CAROL, 'delete_admin_music_release_track', { p_release_id: id(699), p_track_id: T3 });
  await ok(CAROL, 'delete_admin_music_release_track', { p_release_id: R1, p_track_id: T3 });
  await refused(CAROL, 'delete_admin_music_release_track', { p_release_id: R1, p_track_id: T3 });
  await refused(CAROL, 'delete_admin_music_release', { p_release_id: id(699) });
  await ok(CAROL, 'delete_admin_music_release', { p_release_id: R5 });
  await refused(CAROL, 'admin_delete_catalog_item', { p_kind: 'playlist', p_id: R4 });
  await refused(CAROL, 'admin_delete_catalog_item', { p_kind: 'music_release', p_id: id(699) });
  await refused(CAROL, 'admin_delete_catalog_item', { p_kind: 'learning_album', p_id: id(699) });
  await refused(CAROL, 'admin_delete_catalog_item', { p_kind: 'learning_lesson_set', p_id: id(699) });
  await ok(CAROL, 'admin_delete_catalog_item', { p_kind: ' Music_Release ', p_id: R4 });
  await ok(CAROL, 'admin_delete_catalog_item', { p_kind: 'learning_album', p_id: AL1 });
  await ok(CAROL, 'admin_delete_catalog_item', { p_kind: 'LEARNING_LESSON_SET', p_id: LS1 });
  await refused(BOB, 'delete_admin_music_release', { p_release_id: R2 });
  await ok(CAROL, 'delete_admin_music_release', { p_release_id: R2 });
});

test('notifications: a test to the admin\'s own devices, and broadcasts to everyone the category reaches', async () => {
  await refused(BOB, 'admin_send_notification_test', { p_title: 'Hi', p_body: 'There' });
  await refused(CAROL, 'admin_send_notification_test', { p_title: '  ', p_body: 'There' });
  await refused(CAROL, 'admin_send_notification_test', { p_title: 'x'.repeat(121), p_body: 'There' });
  await refused(CAROL, 'admin_send_notification_test', { p_title: 'Hi', p_body: 'There', p_deep_link: 'https://evil.example' });
  await refused(CAROL, 'admin_send_notification_test', { p_title: 'Hi', p_body: 'There', p_deep_link: '//evil.example' });
  await refused(ZED, 'admin_send_notification_test', { p_title: 'Hi', p_body: 'There' });
  await ok(CAROL, 'admin_send_notification_test', { p_title: ' Hi ', p_body: ' There ', p_deep_link: ' /music ' });
  // 100 emoji: 100 characters, 200 UTF-16 units.
  await ok(CAROL, 'admin_send_notification_test', { p_title: '🎉'.repeat(100), p_body: 'There', p_deep_link: '' });

  await refused(BOB, 'admin_send_notification_broadcast', { p_category: 'announcements', p_title: 'News', p_body: 'Body' });
  await refused(CAROL, 'admin_send_notification_broadcast', { p_category: 'other', p_title: 'News', p_body: 'Body' });
  await refused(CAROL, 'admin_send_notification_broadcast', { p_category: 'announcements', p_title: '', p_body: 'Body' });
  await refused(CAROL, 'admin_send_notification_broadcast', { p_category: 'announcements', p_title: 'News', p_body: 'y'.repeat(601) });
  await refused(CAROL, 'admin_send_notification_broadcast', { p_category: 'announcements', p_title: 'News', p_body: 'Body', p_payload: [1] });
  await refused(CAROL, 'admin_send_notification_broadcast', { p_category: 'announcements', p_title: 'News', p_body: 'Body', p_deep_link: 'music' });
  await ok(CAROL, 'admin_send_notification_broadcast', { p_category: ' announcements ', p_title: 'News', p_body: 'A new album', p_deep_link: '/music', p_payload: { kind: 'album', source: 'mine' } });
  await ok(CAROL, 'admin_send_notification_broadcast', { p_category: 'feast_celebrations', p_title: 'Happy Feast', p_body: 'Christ is risen', p_payload: null });
  await ok(ZED, 'admin_send_notification_broadcast', { p_category: 'feast_celebrations', p_title: 'Again', p_body: 'Twice' });
});

test('signed out, every admin write is refused by its grant', async () => {
  for (const [fn, args] of [
    ['publish_media_submission', { p_submission_id: S6 }], ['publish_music_release', { p_release_id: RB }], ['publish_learning_album', { p_album_id: ALB }],
    ['publish_learning_lesson_set', { p_lesson_set_id: LSB }], ['admin_update_music_release_dates', { p_release_id: R1 }], ['admin_delete_catalog_item', { p_kind: 'music_release', p_id: R1 }],
    ['delete_admin_music_release', { p_release_id: R1 }], ['delete_admin_music_release_track', { p_release_id: R1, p_track_id: T2 }],
    ['confirm_admin_creator_artist_claim', { p_submission_id: SG, p_existing_artist_id: A8 }], ['update_admin_artist_profile', { p_artist_id: A2 }],
    ['force_media_processing_job', { p_job_id: job(2) }], ['force_pending_media_processing_jobs', {}], ['force_submission_media_processing', { p_submission_id: S1 }],
    ['retry_media_processing_job', { p_job_id: job(2) }], ['admin_send_notification_test', { p_title: 'Hi', p_body: 'There' }],
    ['admin_send_notification_broadcast', { p_category: 'announcements', p_title: 'Hi', p_body: 'There' }],
  ] as [string, Record<string, unknown>][]) {
    const answer = await refused(null, fn, args);
    assert.equal(answer.error!.code, '42501');
  }
});
