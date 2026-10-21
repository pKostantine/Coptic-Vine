/**
 * Parity: the music functions, the Worker against Supabase's own (the PGlite
 * oracle), over a small catalog seeded identically on both sides: published
 * and draft artists, releases and tracks, localizations, lyrics, creator
 * accounts. Each call goes to both as the same caller (signed out, a member
 * of the creator account that owns the drafts, another listener, an admin)
 * and the answers must match: data, or error code and message.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createOracle, type Oracle, type PgAnswer } from './lib/oracle.ts';
import { seed, type Seed } from './lib/seed.ts';
import { normalize, WorkerSide, type Answer } from './lib/worker.ts';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ALICE = id(1); // a member (owner) of creator account C1
const BOB = id(2); // a listener
const CAROL = id(3); // an admin
const C1 = id(10); const C2 = id(11);
const A1 = id(20); const A2 = id(21); const A3_DRAFT = id(22); const A4 = id(23);
const R1 = id(30); const R2 = id(31); const R3_DRAFT = id(32); const R4 = id(33);
const T1 = id(40); const T2 = id(41); const T3 = id(42); const T4 = id(43); const T5_NO_AUDIO = id(44); const T6_DRAFT = id(45);
const asset = (n: number) => id(100 + n);
const AT = (day: number) => `2026-0${Math.floor(day / 30) + 1}-${String((day % 28) + 1).padStart(2, '0')}T10:00:00+00:00`;

const seeded = new Set<string>();
const keep = () => seeded;

function catalog(): Seed {
  const assetRow = (n: number, type: 'audio' | 'image', published = true, extra: Record<string, unknown> = {}) => ({
    id: asset(n), owner_creator_account_id: C1, provider: 'cloudflare_r2', bucket: type === 'audio' ? 'chc-music' : 'chc-images',
    path: `${type}/${n}.${type === 'audio' ? 'm4a' : 'jpg'}`, media_type: type, mime_type: type === 'audio' ? 'audio/mp4' : 'image/jpeg',
    file_size_bytes: 1000 + n, checksum: `sha-${n}`, version: 1, processing_status: 'completed', publication_status: published ? 'published' : 'draft',
    created_at: AT(1), updated_at: AT(1), ...extra,
  });
  const release = (rid: string, title: string, artist: string | null, cover: number | null, status: string, dates: Record<string, unknown>, day: number) => ({
    id: rid, owner_creator_account_id: C1, primary_artist_id: artist, cover_asset_id: cover == null ? null : asset(cover), release_type: 'album', title,
    subtitle: `${title} subtitle`, description: `About ${title}`, publication_status: status, metadata: { musicType: 'hymns', recordingType: 'studio', extra: 1 },
    created_at: AT(day), updated_at: AT(day), ...dates,
  });
  const track = (tid: string, title: string, audio: number | null, status: string, duration: number) => ({
    id: tid, owner_creator_account_id: C1, media_asset_id: audio == null ? null : asset(audio), title, subtitle: null, duration_ms: duration,
    publication_status: status, metadata: {}, created_at: AT(2), updated_at: AT(2),
  });
  const data: Seed = [
    ['media.locales', [
      { code: 'en', english_name: 'English', native_name: 'English', text_direction: 'ltr', sort_order: 1, created_at: AT(0), updated_at: AT(0) },
      { code: 'ar', english_name: 'Arabic', native_name: 'العربية', text_direction: 'rtl', sort_order: 2, created_at: AT(0), updated_at: AT(0) },
      { code: 'fr', english_name: 'French', native_name: 'Français', text_direction: 'ltr', sort_order: 3, created_at: AT(0), updated_at: AT(0) },
      { code: 'cop', english_name: 'Coptic', native_name: 'Ⲙⲉⲧⲣⲉⲙⲛ̀ⲭⲏⲙⲓ', text_direction: 'ltr', sort_order: 4, created_at: AT(0), updated_at: AT(0) },
    ]],
    ['creator.creator_accounts', [{ id: C1, display_name: 'Choir One', created_at: AT(0), updated_at: AT(0) }, { id: C2, display_name: 'Choir Two', created_at: AT(0), updated_at: AT(0) }]],
    ['creator.creator_account_members', [{ creator_account_id: C1, user_id: ALICE, role: 'owner', created_at: AT(0), updated_at: AT(0) }]],
    ['creator.user_roles', [{ user_id: CAROL, role: 'admin', granted_at: AT(0) }]],
    ['media.media_assets', [
      assetRow(1, 'audio'), assetRow(2, 'audio'), assetRow(3, 'audio'), assetRow(4, 'audio'), assetRow(5, 'audio', false), assetRow(6, 'audio'),
      assetRow(11, 'image'), assetRow(12, 'image'), assetRow(13, 'image', false), assetRow(21, 'image'),
    ]],
    ['music.artists', [
      { id: A1, owner_creator_account_id: C1, profile_image_asset_id: asset(21), display_name: 'Abba Pishoy', biography: 'Cantor', publication_status: 'published', metadata: {}, created_at: AT(1), updated_at: AT(1) },
      { id: A2, owner_creator_account_id: C2, display_name: 'Basilios', publication_status: 'published', metadata: {}, created_at: AT(1), updated_at: AT(1) },
      { id: A3_DRAFT, owner_creator_account_id: C1, display_name: 'Draft Artist', publication_status: 'draft', metadata: {}, created_at: AT(1), updated_at: AT(1) },
      { id: A4, owner_creator_account_id: C2, display_name: 'zed cantor', publication_status: 'published', metadata: {}, created_at: AT(1), updated_at: AT(1) },
    ]],
    ['music.artist_localizations', [
      { id: id(50), artist_id: A1, locale: 'ar', display_name: 'أبا بيشوي', biography: 'مرتل', publication_status: 'published', created_at: AT(1), updated_at: AT(1) },
      { id: id(51), artist_id: A2, locale: 'ar', display_name: 'باسيليوس', publication_status: 'draft', created_at: AT(1), updated_at: AT(1) },
    ]],
    ['music.artist_social_links', [
      { id: id(60), artist_id: A1, platform: 'youtube', url: 'https://youtube.com/@pishoy', sort_order: 2, created_at: AT(1), updated_at: AT(1) },
      { id: id(61), artist_id: A1, platform: 'website', url: 'https://pishoy.example', sort_order: 1, created_at: AT(1), updated_at: AT(1) },
      { id: id(62), artist_id: A3_DRAFT, platform: 'website', url: 'https://draft.example', sort_order: 1, created_at: AT(1), updated_at: AT(1) },
    ]],
    ['music.releases', [
      release(R1, 'Hymns of the Nativity', A1, 11, 'published', { release_date: '2026-01-10' }, 3),
      release(R2, 'A Single', A2, 12, 'published', { scheduled_release_at: '2026-02-01T05:00:00+00:00', release_timing_mode: 'scheduled' }, 4),
      release(R3_DRAFT, 'Unreleased', A1, 11, 'draft', { release_date: '2026-03-01' }, 5),
      release(R4, 'Older Recording', A4, 13, 'published', { original_release_date: '1998-04-01', release_date: '2025-12-01' }, 6),
    ]],
    ['music.release_localizations', [
      { id: id(70), release_id: R1, locale: 'ar', title: 'تسابيح الميلاد', subtitle: null, publication_status: 'published', created_at: AT(3), updated_at: AT(3) },
    ]],
    ['music.tracks', [
      track(T1, 'Tenen', 1, 'published', 300000), track(T2, 'Ari Ehmot', 2, 'published', 200000), track(T3, 'Single Track', 3, 'published', 180000),
      track(T4, 'Old Hymn', 4, 'published', 240000), track(T5_NO_AUDIO, 'Unready Audio', 5, 'published', 100000), track(T6_DRAFT, 'Draft Track', 6, 'draft', 90000),
    ]],
    ['music.track_localizations', [
      { id: id(80), track_id: T1, locale: 'ar', title: 'تينين', subtitle: 'لحن', publication_status: 'published', created_at: AT(2), updated_at: AT(2) },
    ]],
    ['music.release_tracks', [
      { id: id(90), release_id: R1, track_id: T1, disc_number: 1, track_number: 1, created_at: AT(3) },
      { id: id(91), release_id: R1, track_id: T2, disc_number: 1, track_number: 2, created_at: AT(3) },
      { id: id(92), release_id: R1, track_id: T6_DRAFT, disc_number: 1, track_number: 3, created_at: AT(3) },
      { id: id(93), release_id: R2, track_id: T3, disc_number: 1, track_number: 1, created_at: AT(4) },
      { id: id(94), release_id: R4, track_id: T1, disc_number: 2, track_number: 1, created_at: AT(6) },
      { id: id(95), release_id: R4, track_id: T4, disc_number: 1, track_number: 1, created_at: AT(6) },
      { id: id(96), release_id: R4, track_id: T5_NO_AUDIO, disc_number: 1, track_number: 2, created_at: AT(6) },
    ]],
    ['music.track_artists', [
      { track_id: T1, artist_id: A1, role: 'primary', sort_order: 0, created_at: AT(2) },
      { track_id: T1, artist_id: A2, role: 'featured', sort_order: 1, created_at: AT(2) },
      { track_id: T2, artist_id: A1, role: 'primary', sort_order: 0, created_at: AT(2) },
      { track_id: T2, artist_id: A3_DRAFT, role: 'featured', sort_order: 1, created_at: AT(2) },
      { track_id: T3, artist_id: A2, role: 'primary', sort_order: 0, created_at: AT(2) },
      { track_id: T4, artist_id: A4, role: 'primary', sort_order: 0, created_at: AT(2) },
      { track_id: T4, artist_id: A1, role: 'composer', sort_order: 0, created_at: AT(2) },
      { track_id: T6_DRAFT, artist_id: A3_DRAFT, role: 'primary', sort_order: 0, created_at: AT(2) },
    ]],
    ['music.lyric_sets', [
      { id: id(200), track_id: T1, locale: 'en', kind: 'original', sync_precision: 'word', title: 'Tenen', source: 'Book', publication_status: 'published', metadata: {}, created_at: AT(2), updated_at: AT(2) },
      { id: id(201), track_id: T1, locale: 'ar', kind: 'translation', sync_precision: 'line', title: null, publication_status: 'published', metadata: {}, created_at: AT(2), updated_at: AT(2) },
      { id: id(202), track_id: T1, locale: 'fr', kind: 'translation', sync_precision: 'unsynced', publication_status: 'draft', metadata: {}, created_at: AT(2), updated_at: AT(2) },
    ]],
    ['music.lyric_lines', [
      { id: id(210), lyric_set_id: id(200), sequence: 2, start_ms: 4000, end_ms: 8000, text: 'Second line', created_at: AT(2), updated_at: AT(2) },
      { id: id(211), lyric_set_id: id(200), sequence: 1, start_ms: 0, end_ms: 4000, text: 'First line', created_at: AT(2), updated_at: AT(2) },
      { id: id(212), lyric_set_id: id(201), sequence: 1, start_ms: 0, end_ms: null, text: 'السطر الأول', created_at: AT(2), updated_at: AT(2) },
    ]],
    ['music.lyric_words', [
      { id: id(220), lyric_line_id: id(211), sequence: 2, start_ms: 2000, end_ms: 4000, text: 'line', created_at: AT(2), updated_at: AT(2) },
      { id: id(221), lyric_line_id: id(211), sequence: 1, start_ms: 0, end_ms: 2000, text: 'First', created_at: AT(2), updated_at: AT(2) },
    ]],
  ];
  for (const [, rows] of data) for (const row of rows) for (const value of Object.values(row)) if (typeof value === 'string') seeded.add(value);
  return data;
}

let oracle: Oracle;
let worker: WorkerSide;

before(async () => {
  // Supabase as it worked until 21 Sept 2026 (see OracleOptions.privateUsage): playlist editing fails in production since.
  oracle = await createOracle({ privateUsage: true });
  worker = new WorkerSide();
  for (const [user, email] of [[ALICE, 'alice@example.com'], [BOB, 'bob@example.com'], [CAROL, 'carol@example.com']]) {
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
    assert.deepEqual(normalize(w.data, keep()), normalize(pg.data, keep()), what);
  }
}

async function both(user: string | null, fn: string, args: Record<string, unknown> = {}) {
  const pg = await oracle.call(user, fn, args);
  const w = await worker.rpc(user, fn, args);
  same(pg, w, `${fn}(${JSON.stringify(args)}) as ${user ?? 'anon'}`);
  return { pg, w };
}

const everyone = [null, ALICE, BOB, CAROL];

test('the catalog: home, artists, releases, tracks, search art and lyrics, for every kind of caller', async () => {
  for (const user of everyone) {
    for (const locale of ['en', 'ar']) {
      await both(user, 'get_music_home', { p_locale: locale });
      for (const artist of [A1, A2, A3_DRAFT, A4]) await both(user, 'get_published_music_artist', { p_artist_id: artist, p_locale: locale });
      for (const release of [R1, R2, R3_DRAFT, R4]) await both(user, 'get_published_music_release_for_locale', { p_release_id: release, p_locale: locale });
      for (const track of [T1, T2, T3, T4, T5_NO_AUDIO, T6_DRAFT]) await both(user, 'get_published_music_track_for_locale', { p_track_id: track, p_locale: locale });
    }
    await both(user, 'get_music_home', {});
    for (const artist of [A1, A2, A3_DRAFT, A4]) await both(user, 'get_music_artist_search_art', { p_artist_id: artist });
    await both(user, 'get_published_track_lyrics', { p_track_id: T1 });
    await both(user, 'get_published_track_lyrics', { p_track_id: T1, p_locale: 'ar' });
    await both(user, 'get_published_track_lyrics', { p_track_id: T1, p_kind: 'original' });
    await both(user, 'get_published_track_lyrics', { p_track_id: T6_DRAFT });
  }
  await both(null, 'get_published_track_lyrics', { p_track_id: T1, p_kind: 'karaoke' });
  await both(null, 'get_published_music_artist', { p_artist_id: 'not-a-uuid' });
  await both(null, 'get_published_music_artist', { p_artist_id: A1.toUpperCase() });
});

test('likes, follows and plays: who may, of what, and the library they make', async () => {
  await both(null, 'set_track_liked', { p_track_id: T1, p_liked: true });
  await both(BOB, 'set_track_liked', { p_track_id: T1, p_liked: true });
  await both(BOB, 'set_track_liked', { p_track_id: T2, p_liked: true });
  await both(BOB, 'set_track_liked', { p_track_id: T6_DRAFT, p_liked: true });
  await both(ALICE, 'set_track_liked', { p_track_id: T6_DRAFT, p_liked: true });
  await both(BOB, 'set_track_liked', { p_track_id: T2, p_liked: false });
  await both(BOB, 'set_track_liked', { p_track_id: T3, p_liked: null });
  await both(BOB, 'set_artist_followed', { p_artist_id: A1, p_followed: true });
  await both(BOB, 'set_artist_followed', { p_artist_id: A3_DRAFT, p_followed: true });
  await both(ALICE, 'set_artist_followed', { p_artist_id: A3_DRAFT, p_followed: true });
  await both(BOB, 'set_artist_followed', { p_artist_id: A4, p_followed: true });
  await both(BOB, 'get_artist_followed', { p_artist_id: A1 });
  await both(null, 'get_artist_followed', { p_artist_id: A1 });
  await both(BOB, 'set_release_liked', { p_release_id: R1, p_liked: true });
  await both(BOB, 'set_release_liked', { p_release_id: R4, p_liked: true });
  await both(BOB, 'set_release_liked', { p_release_id: R3_DRAFT, p_liked: true });
  await both(null, 'set_release_liked', { p_release_id: R1, p_liked: true });
  await both(BOB, 'get_release_liked', { p_release_id: R1 });
  await both(BOB, 'get_release_liked', { p_release_id: R2 });
  await both(null, 'record_music_play', { p_track_id: T1 });
  await both(BOB, 'record_music_play', { p_track_id: T1, p_release_id: R1 });
  await both(BOB, 'record_music_play', { p_track_id: T3 });
  await both(BOB, 'record_music_play', { p_track_id: T1, p_release_id: R2 });
  await both(BOB, 'record_music_play', { p_track_id: T6_DRAFT });
  await both(BOB, 'record_music_play', { p_track_id: T4, p_release_id: R4 });
  await both(BOB, 'record_music_play', { p_track_id: T1, p_release_id: R4 });
  for (const user of everyone) for (const locale of ['en', 'ar']) await both(user, 'get_my_music_library', { p_locale: locale });
});

test('playlists: making, filling, ordering and sharing them, and nobody else editing them', async () => {
  await both(null, 'create_music_playlist', { p_name: 'Nope' });
  await both(ALICE, 'create_music_playlist', { p_name: '   ' });
  const created = await both(ALICE, 'create_music_playlist', { p_name: '  Nativity  ', p_description: '  For Kiahk ', p_visibility: 'private' });
  const pgPlaylist = created.pg.data as string;
  const wPlaylist = created.w.data as string;
  // Each side made its own id: from here each is asked about its own playlist.
  const call = async (user: string | null, fn: string, args: Record<string, unknown>) => {
    const pg = await oracle.call(user, fn, { ...args, p_playlist_id: pgPlaylist });
    const w = await worker.rpc(user, fn, { ...args, p_playlist_id: wPlaylist });
    same(pg, w, `${fn}(${JSON.stringify(args)}) as ${user ?? 'anon'}`);
  };
  for (const track of [T1, T2, T6_DRAFT, T1]) await call(ALICE, 'add_track_to_music_playlist', { p_track_id: track });
  await call(BOB, 'add_track_to_music_playlist', { p_track_id: T3 });
  await call(ALICE, 'add_track_to_music_playlist', { p_track_id: T5_NO_AUDIO });
  await call(ALICE, 'get_music_playlist', { p_locale: 'ar' });
  await call(BOB, 'get_music_playlist', { p_locale: 'en' });
  await call(ALICE, 'set_music_playlist_track_order', { p_track_ids: [T2, T1] });
  await call(ALICE, 'set_music_playlist_track_order', { p_track_ids: [T6_DRAFT, T2, T1, T5_NO_AUDIO] });
  await call(ALICE, 'set_music_playlist_track_order', { p_track_ids: [T6_DRAFT, T2, T1, T1] });
  await call(ALICE, 'set_music_playlist_track_order', { p_track_ids: [T5_NO_AUDIO, T6_DRAFT, T2, T1] });
  await call(BOB, 'update_music_playlist', { p_name: 'Taken' });
  await call(ALICE, 'update_music_playlist', { p_name: 'Nativity Feast', p_description: '', p_visibility: 'public' });
  await call(null, 'get_music_playlist', { p_locale: 'en' });
  await call(BOB, 'get_music_playlist', { p_locale: 'en' });
  await call(ALICE, 'get_music_playlist', {});
  await call(ALICE, 'remove_track_from_music_playlist', { p_track_id: T2 });
  await call(BOB, 'remove_track_from_music_playlist', { p_track_id: T1 });
  await call(ALICE, 'clear_music_playlist_cover', {});
  await call(BOB, 'clear_music_playlist_cover', {});
  for (const locale of ['en', 'ar']) {
    const pg = await oracle.call(ALICE, 'get_my_music_library', { p_locale: locale });
    const w = await worker.rpc(ALICE, 'get_my_music_library', { p_locale: locale });
    same(pg, w, `get_my_music_library(${locale}) as Alice`);
  }
  await call(BOB, 'delete_music_playlist', {});
  await call(ALICE, 'delete_music_playlist', {});
  await call(ALICE, 'get_music_playlist', {});
});

test('as deployed, Supabase refuses playlist edits since 21 Sept 2026 (the Worker doesn\'t)', async () => {
  const deployed = await createOracle();
  try {
    await deployed.addUser(ALICE, 'alice@example.com');
    const created = await deployed.call(ALICE, 'create_music_playlist', { p_name: 'Mine' });
    assert.equal(created.error, null);
    const added = await deployed.call(ALICE, 'add_track_to_music_playlist', { p_playlist_id: created.data as string, p_track_id: T1 });
    assert.deepEqual(added.error && { code: added.error.code, message: added.error.message }, { code: '42501', message: 'permission denied for schema private' });
  } finally {
    await deployed.close();
  }
});
