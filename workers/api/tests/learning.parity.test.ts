/**
 * Parity: the learning functions, the Worker against Supabase's own (the
 * PGlite oracle), over a learning catalog seeded identically on both sides:
 * published and draft cantors, seasons, hymns, albums, recordings, lesson
 * sets and lessons, localizations, lyrics, and a cantor that grants editing
 * to another creator account. Callers: signed out, a listener, the owner of
 * the drafts, an editor by cantor permission, and an admin.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createOracle, type Oracle, type PgAnswer } from './lib/oracle.ts';
import { seed, type Seed } from './lib/seed.ts';
import { normalize, WorkerSide, type Answer } from './lib/worker.ts';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ALICE = id(1); const BOB = id(2); const CAROL = id(3); const DAVE = id(4);
const C1 = id(10); const C3 = id(12);
const K1 = id(300); const K2_DRAFT = id(301); const K3 = id(302);
const S1 = id(310); const S2 = id(311); const S3_DRAFT = id(312);
const H1 = id(320); const H2 = id(321); const H3_DRAFT = id(322);
const AL1 = id(330); const AL2_DRAFT = id(331); const AL3 = id(332); const AL4 = id(333);
const RC1 = id(340); const RC2_DRAFT = id(341); const RC3_NO_AUDIO = id(342); const RC4 = id(343);
const LS1 = id(350); const LS2 = id(351); const LS3_DRAFT = id(352); const LS4_NO_COVER = id(353);
const L1 = id(360); const L2 = id(361); const L3_DRAFT = id(362); const L4_NO_MEDIA = id(363); const L5 = id(364);
const asset = (n: number) => id(500 + n);
const AT = (day: number) => `2026-03-${String(day + 1).padStart(2, '0')}T08:00:00+00:00`;

const seeded = new Set<string>();

function catalog(): Seed {
  const media = (n: number, type: 'audio' | 'video' | 'image', published = true) => ({
    id: asset(n), owner_creator_account_id: C1, provider: 'cloudflare_r2', bucket: type === 'image' ? 'chc-images' : 'chc-learning',
    path: `${type}/${n}`, media_type: type, mime_type: type === 'image' ? 'image/webp' : type === 'video' ? 'video/mp4' : 'audio/mp4',
    duration_ms: type === 'image' ? null : 60000 + n, file_size_bytes: 5000 + n, checksum: n % 2 ? `c${n}` : null, width: type === 'image' ? 800 : null, height: type === 'image' ? 600 : null,
    version: 1, processing_status: 'completed', publication_status: published ? 'published' : 'draft', created_at: AT(0), updated_at: AT(0),
  });
  const stamps = (day: number) => ({ created_at: AT(day), updated_at: AT(day) });
  const data: Seed = [
    ['media.locales', ['en', 'ar', 'fr'].map((code, i) => ({ code, english_name: code, native_name: code, text_direction: code === 'ar' ? 'rtl' : 'ltr', sort_order: i, ...stamps(0) }))],
    ['creator.creator_accounts', [{ id: C1, display_name: 'Choir One', ...stamps(0) }, { id: C3, display_name: 'Editors', ...stamps(0) }]],
    ['creator.creator_account_members', [
      { creator_account_id: C1, user_id: ALICE, role: 'owner', ...stamps(0) },
      { creator_account_id: C3, user_id: DAVE, role: 'editor', ...stamps(0) },
    ]],
    ['creator.user_roles', [{ user_id: CAROL, role: 'admin', granted_at: AT(0) }]],
    ['media.media_assets', [media(1, 'image'), media(2, 'image'), media(3, 'audio'), media(4, 'audio', false), media(5, 'audio'), media(6, 'video'), media(7, 'audio'), media(8, 'audio', false), media(9, 'audio'), media(10, 'image')]],
    ['learning.cantors', [
      { id: K1, owner_creator_account_id: C1, profile_image_asset_id: asset(1), display_name: "Mo'allem Ibrahim", sort_name: 'ibrahim', biography: 'Teacher', publication_status: 'published', metadata: {}, ...stamps(1) },
      { id: K2_DRAFT, owner_creator_account_id: C1, display_name: 'Abouna Draft', publication_status: 'draft', metadata: {}, ...stamps(1) },
      { id: K3, owner_creator_account_id: null, display_name: 'Arsani', publication_status: 'published', metadata: {}, ...stamps(1) },
    ]],
    ['learning.cantor_localizations', [{ cantor_id: K1, locale: 'ar', display_name: 'المعلم إبراهيم', biography: 'معلم', ...stamps(1) }]],
    ['learning.cantor_permissions', [{ id: id(390), cantor_id: K2_DRAFT, creator_account_id: C3, role: 'editor', ...stamps(1) }]],
    ['learning.seasons', [
      { id: S1, slug: 'kiahk', title: 'Kiahk', description: 'Month of praise', sort_order: 1, publication_status: 'published', metadata: {}, ...stamps(1) },
      { id: S2, slug: 'great-lent', title: 'Great Lent', sort_order: 1, publication_status: 'published', metadata: {}, ...stamps(1) },
      { id: S3_DRAFT, slug: 'draft', title: 'Draft Season', sort_order: 0, publication_status: 'draft', metadata: {}, ...stamps(1) },
    ]],
    ['learning.season_localizations', [{ season_id: S2, locale: 'ar', title: 'الصوم الكبير', ...stamps(1) }]],
    ['learning.hymns', [
      { id: H1, title: 'Tenen', subtitle: 'We look', publication_status: 'published', metadata: {}, ...stamps(2) },
      { id: H2, title: 'Ari Ehmot', publication_status: 'published', metadata: {}, ...stamps(2) },
      { id: H3_DRAFT, title: 'Draft Hymn', publication_status: 'draft', metadata: {}, ...stamps(2) },
    ]],
    ['learning.hymn_localizations', [{ hymn_id: H2, locale: 'ar', title: 'آري إهموت', ...stamps(2) }]],
    ['learning.hymn_seasons', [
      { hymn_id: H1, season_id: S1, sort_order: 2, created_at: AT(2) }, { hymn_id: H2, season_id: S1, sort_order: 2, created_at: AT(2) },
      { hymn_id: H3_DRAFT, season_id: S1, sort_order: 0, created_at: AT(2) }, { hymn_id: H1, season_id: S2, sort_order: 1, created_at: AT(2) },
    ]],
    ['learning.hymn_relationships', [
      { id: id(395), hymn_id: H1, related_hymn_id: H2, relationship_type: 'variant', sort_order: 2, metadata: {}, ...stamps(2) },
      { id: id(396), hymn_id: H1, related_hymn_id: H3_DRAFT, relationship_type: 'draft-link', sort_order: 1, metadata: {}, ...stamps(2) },
    ]],
    ['learning.albums', [
      { id: AL1, owner_creator_account_id: C1, cantor_id: K1, season_id: S1, cover_asset_id: asset(2), title: 'Kiahk Recordings', description: 'Album', publication_status: 'published', metadata: {}, release_timing_mode: 'asap', ...stamps(3) },
      { id: AL2_DRAFT, owner_creator_account_id: C1, cantor_id: K1, season_id: S1, title: 'Draft Album', publication_status: 'draft', metadata: {}, release_timing_mode: 'asap', ...stamps(4) },
      { id: AL3, owner_creator_account_id: C1, cantor_id: K2_DRAFT, season_id: S1, title: 'Hidden Cantor Album', publication_status: 'published', metadata: {}, release_timing_mode: 'asap', ...stamps(5) },
      { id: AL4, owner_creator_account_id: C1, cantor_id: K1, season_id: S3_DRAFT, title: 'Old Album', publication_status: 'published', metadata: {}, release_timing_mode: 'scheduled', scheduled_release_at: '2026-04-01T00:00:00+00:00', original_release_date: '1990-05-05', ...stamps(6) },
    ]],
    ['learning.album_localizations', [{ album_id: AL1, locale: 'ar', title: 'تسجيلات كيهك', ...stamps(3) }]],
    ['learning.album_recordings', [
      { id: RC1, album_id: AL1, hymn_id: H1, media_asset_id: asset(3), title: 'Tenen', duration_ms: null, sort_order: 1, publication_status: 'published', metadata: {}, ...stamps(3) },
      { id: RC2_DRAFT, album_id: AL1, media_asset_id: asset(5), title: 'Draft Take', sort_order: 2, publication_status: 'draft', metadata: {}, ...stamps(3) },
      { id: RC3_NO_AUDIO, album_id: AL1, media_asset_id: asset(4), title: 'Unready', sort_order: 3, publication_status: 'published', metadata: {}, ...stamps(3) },
      { id: RC4, album_id: AL4, hymn_id: H2, media_asset_id: asset(5), title: 'Ari Ehmot', duration_ms: 1234, sort_order: 0, publication_status: 'published', metadata: {}, ...stamps(6) },
    ]],
    ['learning.recording_localizations', [{ recording_id: RC1, locale: 'ar', title: 'تينين', subtitle: 'لحن', ...stamps(3) }]],
    ['learning.lesson_sets', [
      { id: LS1, owner_creator_account_id: C1, cantor_id: K1, season_id: S1, hymn_id: H1, cover_asset_id: asset(10), title: 'Learning Tenen', description: 'Lessons', publication_status: 'published', metadata: {}, release_timing_mode: 'asap', ...stamps(7) },
      { id: LS2, owner_creator_account_id: C1, cantor_id: K2_DRAFT, hymn_id: H2, title: 'Draft Cantor Lessons', publication_status: 'published', metadata: {}, release_timing_mode: 'asap', ...stamps(8) },
      { id: LS3_DRAFT, owner_creator_account_id: C1, cantor_id: K1, hymn_id: H1, title: 'Draft Lessons', publication_status: 'draft', metadata: {}, release_timing_mode: 'asap', ...stamps(9) },
      { id: LS4_NO_COVER, owner_creator_account_id: C1, cantor_id: K1, season_id: S1, hymn_id: H2, title: 'Learning Ari Ehmot', publication_status: 'published', metadata: {}, release_timing_mode: 'asap', ...stamps(10) },
    ]],
    ['learning.lesson_set_localizations', [{ lesson_set_id: LS1, locale: 'fr', title: 'Apprendre Tenen', ...stamps(7) }]],
    ['learning.lessons', [
      { id: L1, lesson_set_id: LS1, media_asset_id: asset(6), audio_asset_id: asset(7), media_type: 'video', title: 'Intro', duration_ms: null, sort_order: 1, publication_status: 'published', metadata: {}, ...stamps(7) },
      { id: L2, lesson_set_id: LS1, media_asset_id: asset(9), media_type: 'audio', title: 'Part two', description: 'Second', sort_order: 2, publication_status: 'published', metadata: {}, ...stamps(7) },
      { id: L3_DRAFT, lesson_set_id: LS1, media_asset_id: asset(9), media_type: 'audio', title: 'Draft', sort_order: 0, publication_status: 'draft', metadata: {}, ...stamps(7) },
      { id: L4_NO_MEDIA, lesson_set_id: LS1, media_asset_id: asset(8), media_type: 'audio', title: 'Unready', sort_order: 3, publication_status: 'published', metadata: {}, ...stamps(7) },
      { id: L5, lesson_set_id: LS2, media_asset_id: asset(9), media_type: 'audio', title: 'Hidden cantor lesson', sort_order: 1, publication_status: 'published', metadata: {}, ...stamps(8) },
    ]],
    ['learning.lesson_localizations', [{ lesson_id: L1, locale: 'ar', title: 'مقدمة', description: 'شرح', ...stamps(7) }]],
    ['learning.lyric_sets', [
      { id: id(370), item_kind: 'album_recording', album_recording_id: RC1, locale: 'en', sync_precision: 'line', description: 'Words', publication_status: 'published', ...stamps(3) },
      { id: id(371), item_kind: 'album_recording', album_recording_id: RC1, locale: 'fr', sync_precision: 'line', publication_status: 'draft', ...stamps(3) },
      { id: id(372), item_kind: 'lesson', lesson_id: L1, locale: 'ar', sync_precision: 'unsynced', publication_status: 'published', ...stamps(7) },
    ]],
    ['learning.lyric_lines', [
      { id: id(380), lyric_set_id: id(370), sequence: 2, start_ms: 1000, end_ms: 2000, text: 'Line two', ...stamps(3) },
      { id: id(381), lyric_set_id: id(370), sequence: 1, start_ms: 0, end_ms: 1000, text: 'Line one', ...stamps(3) },
      { id: id(382), lyric_set_id: id(372), sequence: 1, text: 'سطر', ...stamps(7) },
    ]],
  ];
  for (const [, rows] of data) for (const row of rows) for (const value of Object.values(row)) if (typeof value === 'string') seeded.add(value);
  return data;
}

let oracle: Oracle;
let worker: WorkerSide;

before(async () => {
  oracle = await createOracle({ privateUsage: true });
  worker = new WorkerSide();
  for (const [user, email] of [[ALICE, 'alice@example.com'], [BOB, 'bob@example.com'], [CAROL, 'carol@example.com'], [DAVE, 'dave@example.com']]) {
    await oracle.addUser(user, email);
    await worker.addUser(user, email);
  }
  await seed(oracle, worker, catalog());
});
after(() => oracle.close());

function same(pg: PgAnswer, w: Answer, what: string): void {
  if (pg.error) {
    assert.ok(w.error, `${what}: Postgres refused (${pg.error.code} ${pg.error.message}); the Worker answered ${JSON.stringify(w.data)?.slice(0, 300)}`);
    assert.equal(w.error!.code, pg.error.code, `${what}: error code (${w.error!.message})`);
    assert.equal(w.error!.message, pg.error.message, `${what}: error message`);
  } else {
    assert.equal(w.error, null, `${what}: the Worker refused (${JSON.stringify(w.error)}); Postgres answered ${JSON.stringify(pg.data)?.slice(0, 300)}`);
    assert.deepEqual(normalize(w.data, seeded), normalize(pg.data, seeded), what);
  }
}

/**
 * What cv-api answers beyond Supabase's original: a cantor's lesson sets carry
 * their covers, as its albums do. Left out of the comparison, the rest is
 * compared as it is; the covers are checked in a test of their own.
 */
function beyondSupabase(fn: string, w: Answer): Answer {
  if (fn !== 'get_published_learning_cantor' || !w.data) return w;
  const cantor = w.data as { lessonSets: Record<string, unknown>[] };
  const lessonSets = cantor.lessonSets.map((set) => Object.fromEntries(Object.entries(set).filter(([key]) => key !== 'coverAsset')));
  return { ...w, data: { ...cantor, lessonSets } };
}

async function both(user: string | null, fn: string, args: Record<string, unknown> = {}) {
  const pg = await oracle.call(user, fn, args);
  const w = await worker.rpc(user, fn, args);
  same(pg, beyondSupabase(fn, w), `${fn}(${JSON.stringify(args)}) as ${user ?? 'anon'}`);
  return { pg, w };
}

const everyone = [null, ALICE, BOB, CAROL, DAVE];

test('the learning catalog, for every kind of caller and language', async () => {
  for (const user of everyone) {
    for (const locale of ['en', 'ar', 'fr']) {
      await both(user, 'get_learning_home', { p_locale: locale });
      for (const cantor of [K1, K2_DRAFT, K3]) await both(user, 'get_published_learning_cantor', { p_cantor_id: cantor, p_locale: locale });
      for (const season of [S1, S2, S3_DRAFT]) await both(user, 'get_published_learning_season', { p_season_id: season, p_locale: locale });
      for (const hymn of [H1, H2, H3_DRAFT]) await both(user, 'get_published_learning_hymn', { p_hymn_id: hymn, p_locale: locale });
      for (const album of [AL1, AL2_DRAFT, AL3, AL4]) await both(user, 'get_published_learning_album', { p_album_id: album, p_locale: locale });
      for (const set of [LS1, LS2, LS3_DRAFT]) await both(user, 'get_published_learning_lesson_set', { p_lesson_set_id: set, p_locale: locale });
    }
    for (const [kind, item] of [['album_recording', RC1], ['album_recording', RC2_DRAFT], ['lesson', L1], ['lesson', L5], ['lesson', RC1]] as const) {
      await both(user, 'get_published_learning_item_lyrics', { p_item_kind: kind, p_item_id: item });
      await both(user, 'get_published_learning_item_lyrics', { p_item_kind: kind, p_item_id: item, p_locale: 'ar' });
    }
  }
  await both(null, 'get_published_learning_item_lyrics', { p_item_kind: 'video', p_item_id: RC1 });
});

test("a cantor's lesson sets carry their covers, the same as the season's and the set's own", async () => {
  type Cover = Record<string, unknown> | null;
  type Sets = { lessonSets: { id: string; coverAsset?: Cover }[] };
  const cantor = (await worker.rpc(null, 'get_published_learning_cantor', { p_cantor_id: K1, p_locale: 'en' })).data as Sets;
  const season = (await worker.rpc(null, 'get_published_learning_season', { p_season_id: S1, p_locale: 'en' })).data as Sets;
  assert.deepEqual(cantor.lessonSets.map((set) => set.id), [LS4_NO_COVER, LS1]);
  for (const set of cantor.lessonSets) {
    const own = (await worker.rpc(null, 'get_published_learning_lesson_set', { p_lesson_set_id: set.id, p_locale: 'en' })).data as { coverAsset: Cover };
    assert.ok('coverAsset' in set, `${set.id} says whether it has a cover`);
    assert.deepEqual(set.coverAsset, season.lessonSets.find((other) => other.id === set.id)!.coverAsset, `${set.id}: as the season's`);
    assert.deepEqual(set.coverAsset, own.coverAsset, `${set.id}: as its own page's`);
  }
  assert.equal(cantor.lessonSets.find((set) => set.id === LS1)!.coverAsset!.id, asset(10));
  assert.equal(cantor.lessonSets.find((set) => set.id === LS4_NO_COVER)!.coverAsset, null);
});

test('progress, likes and the learner\'s items', async () => {
  await both(null, 'set_learning_progress', { p_hymn_id: H1, p_state: 'learning' });
  await both(BOB, 'set_learning_progress', { p_hymn_id: H3_DRAFT, p_state: 'learning' });
  await both(BOB, 'set_learning_progress', { p_hymn_id: H1, p_state: 'learning' });
  await both(BOB, 'set_learning_progress', { p_hymn_id: H2, p_state: 'will_learn' });
  await both(BOB, 'set_learning_progress', { p_hymn_id: H1, p_state: 'finished' });
  await both(BOB, 'set_learning_progress', { p_hymn_id: H2, p_state: 'finished' });
  await both(BOB, 'set_learning_progress', { p_hymn_id: H1, p_state: 'will_learn' });
  await both(BOB, 'set_learning_progress', { p_hymn_id: H1, p_state: 'mastered' });
  await both(null, 'set_learning_item_progress', { p_item_kind: 'lesson', p_item_id: L1, p_state: 'learning' });
  await both(BOB, 'set_learning_item_progress', { p_item_kind: 'album_recording', p_item_id: RC2_DRAFT, p_state: 'learning' });
  await both(BOB, 'set_learning_item_progress', { p_item_kind: 'lesson', p_item_id: L3_DRAFT, p_state: 'learning' });
  await both(BOB, 'set_learning_item_progress', { p_item_kind: 'album_recording', p_item_id: RC1, p_state: 'learning' });
  await both(BOB, 'set_learning_item_progress', { p_item_kind: 'lesson', p_item_id: L2, p_state: 'finished' });
  await both(BOB, 'set_learning_item_progress', { p_item_kind: 'lesson', p_item_id: L4_NO_MEDIA, p_state: 'learning' });
  await both(BOB, 'set_learning_item_progress', { p_item_kind: 'album_recording', p_item_id: RC1, p_state: 'finished' });
  await both(BOB, 'set_learning_item_progress', { p_item_kind: 'lesson', p_item_id: L1, p_state: 'will_learn' });
  await both(null, 'set_learning_item_liked', { p_item_kind: 'lesson', p_item_id: L1, p_liked: true });
  await both(BOB, 'set_learning_item_liked', { p_item_kind: 'album_recording', p_item_id: RC1, p_liked: true });
  await both(BOB, 'set_learning_item_liked', { p_item_kind: 'lesson', p_item_id: L1, p_liked: true });
  await both(BOB, 'set_learning_item_liked', { p_item_kind: 'lesson', p_item_id: L1, p_liked: true });
  await both(BOB, 'set_learning_item_liked', { p_item_kind: 'lesson', p_item_id: L2, p_liked: true });
  await both(BOB, 'set_learning_item_liked', { p_item_kind: 'lesson', p_item_id: L2, p_liked: false });
  for (const user of [null, BOB, ALICE]) {
    for (const locale of ['en', 'ar']) {
      await both(user, 'get_my_learning_progress', { p_locale: locale });
      await both(user, 'get_my_learning_items', { p_locale: locale });
    }
  }
});

test('learning playlists: building them, sharing them, and only their owner changing them', async () => {
  await both(null, 'create_learning_playlist', { p_name: 'x' });
  await both(BOB, 'create_learning_playlist', { p_name: ' ' });
  const created = await both(BOB, 'create_learning_playlist', { p_name: ' Kiahk practice ', p_description: '  daily  ' });
  const pgId = (created.pg.data as { id: string }).id;
  const wId = (created.w.data as { id: string }).id;
  const call = async (user: string | null, fn: string, args: Record<string, unknown>) => {
    const pg = await oracle.call(user, fn, { ...args, p_playlist_id: pgId });
    const w = await worker.rpc(user, fn, { ...args, p_playlist_id: wId });
    same(pg, w, `${fn}(${JSON.stringify(args)}) as ${user ?? 'anon'}`);
    return { pg, w };
  };
  await call(BOB, 'add_learning_playlist_item', { p_item_kind: 'album_recording', p_album_recording_id: RC1 });
  await call(BOB, 'add_learning_playlist_item', { p_item_kind: 'lesson', p_lesson_id: L1 });
  await call(BOB, 'add_learning_playlist_item', { p_item_kind: 'lesson', p_lesson_id: L5 });
  await call(BOB, 'add_learning_playlist_item', { p_item_kind: 'lesson', p_lesson_id: L4_NO_MEDIA });
  await call(BOB, 'add_learning_playlist_item', { p_item_kind: 'album_recording', p_album_recording_id: RC1 });
  await call(BOB, 'add_learning_playlist_item', { p_item_kind: 'album_recording', p_album_recording_id: RC2_DRAFT });
  await call(BOB, 'add_learning_playlist_item', { p_item_kind: 'album_recording', p_lesson_id: L1 });
  await call(BOB, 'add_learning_playlist_item', { p_item_kind: 'lesson', p_lesson_id: L1, p_album_recording_id: RC1 });
  await call(ALICE, 'add_learning_playlist_item', { p_item_kind: 'lesson', p_lesson_id: L2 });
  for (const user of [BOB, ALICE, null]) await call(user, 'get_learning_playlist', { p_locale: 'ar' });
  await call(ALICE, 'update_learning_playlist', { p_name: 'Mine now' });
  await call(BOB, 'update_learning_playlist', { p_name: 'Kiahk, shared', p_visibility: 'unlisted' });
  for (const user of [BOB, ALICE, CAROL, DAVE, null]) await call(user, 'get_learning_playlist', { p_locale: 'en' });
  const items = await oracle.sql<{ id: string; lesson_id: string | null }>(`select id, lesson_id from learning.playlist_items where playlist_id = $1 order by sort_order`, [pgId]);
  const wItems = worker.rows<{ id: string; lesson_id: string | null }>('SELECT "id", "lesson_id" FROM "learning.playlist_items" WHERE "playlist_id" = ? ORDER BY "sort_order"', wId);
  // Remove the lesson L1 item, each side by its own item id.
  const pgItem = items.find((item) => item.lesson_id === L1)!.id;
  const wItem = wItems.find((item) => item.lesson_id === L1)!.id;
  same(await oracle.call(ALICE, 'remove_learning_playlist_item', { p_playlist_id: pgId, p_item_id: pgItem }),
    await worker.rpc(ALICE, 'remove_learning_playlist_item', { p_playlist_id: wId, p_item_id: wItem }), 'remove_learning_playlist_item as Alice');
  same(await oracle.call(BOB, 'remove_learning_playlist_item', { p_playlist_id: pgId, p_item_id: pgItem }),
    await worker.rpc(BOB, 'remove_learning_playlist_item', { p_playlist_id: wId, p_item_id: wItem }), 'remove_learning_playlist_item as Bob');
  for (const user of [BOB, ALICE, null]) await both(user, 'get_my_learning_playlists', { p_locale: 'en' });
  await call(ALICE, 'delete_learning_playlist', {});
  await call(BOB, 'delete_learning_playlist', {});
  await call(BOB, 'get_learning_playlist', {});
  await both(BOB, 'get_my_learning_playlists', {});
});
