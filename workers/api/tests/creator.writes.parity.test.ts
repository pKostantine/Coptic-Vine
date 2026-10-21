/**
 * Parity: the creator editor's writes (src/rpc/creator/writes.ts,
 * submissions.ts, edits.ts), the Worker against Supabase's own functions (the
 * oracle), over tests/lib/creatorCatalog.ts plus fresh uploads, a draft and a
 * live music submission, a cantor who teaches and an artist a user credited
 * before having a workspace. After every call (successful or refused) every
 * table the editor writes is compared, generated ids renamed
 * (tests/lib/tables.ts): a refused call must leave both sides as they were.
 *
 * Supabase's ensure_creator_workspace sets the generated column
 * is_credit_only when it reclaims an artist, which Postgres refuses; the
 * oracle's copy leaves that assignment out, as the Worker does.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { A1, A2, A6, ALICE, BOB, C1, C2, C3, CAROL, DAVE, ERIN, H1, id, K1, R1, R2, R3, S1, S2, S3, S4, SE1, seedCatalog, T1, T2, T3, VERA } from './lib/creatorCatalog.ts';
import { createOracle, type Oracle, type PgAnswer } from './lib/oracle.ts';
import { seed } from './lib/seed.ts';
import { bothTables, firstDifferences } from './lib/tables.ts';
import { normalize, WorkerSide, type Answer } from './lib/worker.ts';

const AT = '2026-03-01T08:00:00+00:00';
const ago = (hours: number) => `${new Date(Date.now() - hours * 3600_000).toISOString().replace('Z', '')}+00:00`;
const later = (days: number) => `${new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 13)}:00:00+00:00`;
const intent = (n: number) => id(200 + n);
const asset = (n: number) => id(100 + n);
const S8 = id(67); const S9 = id(68); const R8 = id(46); const R9 = id(47); const T9 = id(54); const K3 = id(72); const BOB_CREDIT = id(26);

let oracle: Oracle;
let worker: WorkerSide;
const seeded = new Set(Array.from({ length: 700 }, (_, n) => id(n)));

const TABLES = [
  'creator.profiles', 'creator.user_roles', 'creator.creator_accounts', 'creator.creator_account_members',
  'music.artists', 'music.artist_social_links', 'music.artist_pinned_releases', 'music.releases', 'music.release_localizations', 'music.tracks', 'music.track_localizations',
  'music.release_tracks', 'music.track_artists', 'media.submissions', 'media.submission_items', 'media.submission_events', 'media.media_processing_jobs', 'media.upload_intents',
  'media.media_assets', 'learning.cantors', 'learning.hymns', 'learning.albums', 'learning.album_localizations', 'learning.lesson_sets', 'learning.lesson_set_localizations',
  'learning.album_recordings', 'learning.lessons', 'learning.recording_localizations', 'public.notifications', 'private.notification_deliveries', 'media.search_documents',
];

before(async () => {
  oracle = await createOracle();
  worker = new WorkerSide();
  await seedCatalog(oracle, worker);
  const upload = (n: number, type: string, extra: Record<string, unknown> = {}) => ({
    id: intent(n), creator_account_id: C1, requested_by: ALICE, bucket: 'chc-submissions', media_type: type, original_filename: `fresh-${n}.${type === 'image' ? 'png' : type === 'video' ? 'mov' : 'wav'}`,
    content_type: `${type}/x`, content_length: 2000 + n, status: 'uploaded', upload_expires_at: AT, uploaded_size: 2000 + n, uploaded_at: ago(2), created_at: AT, updated_at: AT, ...extra,
    path: `submissions/${extra.creator_account_id ?? C1}/${intent(n)}/original.${type === 'image' ? 'png' : type === 'video' ? 'mov' : 'wav'}`,
  });
  const media = (n: number, type: string) => ({ id: asset(n), owner_creator_account_id: C1, bucket: type === 'image' ? 'chc-images' : 'chc-music', path: `${type}/${n}`, media_type: type,
    duration_ms: type === 'image' ? null : 5000 + n, processing_status: 'completed', publication_status: 'draft', created_at: AT, updated_at: AT });
  const job = (n: number, intentN: number, type: string, assetN: number, extra: Record<string, unknown> = {}) => ({
    id: id(350 + n), upload_intent_id: intent(intentN), media_asset_id: asset(assetN), job_type: type, status: 'completed', input_bucket: 'chc-submissions', input_path: `in/${n}`,
    output_bucket: type === 'image_delivery' ? 'chc-images' : 'chc-music', finished_at: AT, created_at: AT, updated_at: AT, ...extra,
  });
  await seed(oracle, worker, [
    ['media.media_assets', [media(30, 'audio'), media(31, 'image'), media(32, 'video'), media(33, 'audio'), { ...media(34, 'audio'), duration_ms: null }, media(35, 'audio')]],
    ['media.upload_intents', [
      upload(30, 'audio'), upload(31, 'audio'), upload(32, 'image'), upload(33, 'image'), upload(34, 'video'), upload(35, 'video'), upload(36, 'audio'), upload(37, 'audio'), upload(38, 'audio'),
      upload(39, 'image'), upload(40, 'audio', { creator_account_id: C3, requested_by: ERIN }), upload(41, 'audio'), upload(42, 'audio'), upload(43, 'video'), upload(44, 'audio'),
      upload(45, 'image'), upload(46, 'image'), upload(47, 'audio'), upload(48, 'audio'),
    ]],
    ['media.media_processing_jobs', [
      job(1, 31, 'audio_delivery', 34, { probe: { output: { format: { duration: '61.2345' } } } }), job(2, 33, 'image_delivery', 31), job(3, 35, 'video_delivery', 32), job(4, 35, 'audio_delivery', 33),
      job(5, 42, 'audio_delivery', 35, { probe: { output: { format: { duration: '123.4565' } } } }),
    ]],
    ['music.artists', [{ id: BOB_CREDIT, display_name: 'Bob', created_by: BOB, publication_status: 'draft', created_at: AT, updated_at: AT }]],
    ['learning.cantors', [{ id: K3, owner_creator_account_id: C1, artist_id: A2, display_name: 'Deacon Mina', publication_status: 'published', created_at: AT, updated_at: AT }]],
    ['media.submissions', [
      { id: S8, creator_account_id: C1, submission_type: 'music_release', title: 'Fresh Draft', status: 'draft', created_by: ALICE, created_at: AT, updated_at: AT },
      { id: S9, creator_account_id: C1, submission_type: 'music_release', title: 'Live One', status: 'published', created_by: ALICE, created_at: AT, updated_at: AT },
    ]],
    ['music.releases', [
      { id: R8, owner_creator_account_id: C1, primary_artist_id: A1, release_type: 'single', title: 'Fresh Draft', metadata: { submissionId: S8, musicType: 'hymns', recordingType: 'studio' }, publication_status: 'draft', created_at: AT, updated_at: AT },
      { id: R9, owner_creator_account_id: C1, primary_artist_id: A1, cover_asset_id: id(104), release_type: 'single', title: 'Live One', release_date: '2026-02-02', metadata: { submissionId: S9, musicType: 'hymns', recordingType: 'live' }, publication_status: 'published', created_at: AT, updated_at: AT },
    ]],
    ['music.tracks', [{ id: T9, owner_creator_account_id: C1, title: 'Live Track', media_asset_id: id(109), publication_status: 'published', created_at: AT, updated_at: AT }]],
    ['music.release_tracks', [{ id: id(690), release_id: R9, track_id: T9, disc_number: 1, track_number: 1, created_at: AT }]],
    ['music.track_artists', [{ track_id: T9, artist_id: A1, role: 'primary', sort_order: 0, created_at: AT }]],
    ['media.submission_items', [{ id: id(691), submission_id: S9, role: 'track', title: 'Live Track', sort_order: 1, media_asset_id: id(109), music_track_id: T9, created_at: AT, updated_at: AT }]],
  ]);
  // Supabase's reclaim sets the generated is_credit_only; the oracle's copy doesn't (see the header).
  const definition = (await oracle.sql<{ def: string }>(`select pg_get_functiondef('public.ensure_creator_workspace(text)'::regprocedure) as def`))[0].def;
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

/** A call both sides must accept. */
async function ok(user: string | null, fn: string, args: Record<string, unknown> = {}): Promise<PgAnswer> {
  const answer = await both(user, fn, args);
  assert.equal(answer.error, null, `${fn} should succeed: ${answer.error?.message}`);
  return answer;
}

async function both(user: string | null, fn: string, args: Record<string, unknown> = {}): Promise<PgAnswer> {
  const what = `${fn}(${JSON.stringify(args).slice(0, 300)}) as ${user ?? 'anon'}`;
  const pg = await oracle.call(user, fn, args);
  const w = await worker.rpc(user, fn, args);
  same(pg, w, what);
  await sameTables(`after ${what}`);
  return pg;
}

test('workspaces: created, found again, and a credit reclaimed', async () => {
  for (const user of [ALICE, DAVE, BOB, ERIN, CAROL, VERA]) await ok(user, 'ensure_creator_workspace', {});
  await both(BOB, 'ensure_creator_workspace', { p_display_name: 'Bob Again' });
  await both(null, 'ensure_creator_workspace', {});
});

test('artists, cantors and hymns, found or created', async () => {
  for (const name of ['Brand New Voice', 'DEACON MINA', "Mo'allem Ibrahim Ayad", '  ', null, 'Brand New Voice']) {
    await both(ALICE, 'create_creator_artist', { p_creator_account_id: C1, p_display_name: name });
  }
  await both(VERA, 'create_creator_artist', { p_creator_account_id: C1, p_display_name: 'Viewer Made' });
  for (const [name, type] of [['Choir of Saint Mark', 'chorus'], ['Cantor Tharwat', 'cantor'], ['A New Cantor', null], [null, 'cantor'], ['deacon mina', 'Chorus']]) {
    await both(ALICE, 'create_creator_cantor', { p_creator_account_id: C1, p_display_name: name, p_contributor_type: type });
  }
  await both(BOB, 'create_creator_cantor', { p_creator_account_id: C1, p_display_name: 'Not Mine' });
  for (const title of ['tenen', 'ALICE DRAFT HYMN', 'Admin Draft Hymn', 'A Brand New Hymn', '', 'x'.repeat(181)]) {
    await both(ALICE, 'create_creator_hymn', { p_creator_account_id: C1, p_title: title });
  }
  await both(CAROL, 'create_creator_hymn', { p_creator_account_id: C2, p_title: 'admin draft hymn' });
  await both(VERA, 'create_creator_hymn', { p_creator_account_id: C1, p_title: 'Viewer Hymn' });
});

test("the artist profile: name, links, pinned releases and picture", async () => {
  await ok(ALICE, 'update_creator_artist_profile', {
    p_creator_account_id: C1, p_display_name: ' St Mark Choir ', p_sort_name: 'mark', p_biography: '  Sings  ',
    p_social_links: [{ platform: 'YouTube', url: 'youtube.com/@stmark' }, { platform: 'website', url: 'https://stmark.example', label: 'ignored' },
      { platform: 'custom:shop', label: 'Shop', url: 'shop.example' }, { platform: 'instagram', url: '' }, { platform: 'website', url: 'https://second.example' }],
    p_pinned_release_ids: [R2, R3, id(499), null, R2], p_profile_image_upload_intent_id: intent(33),
  });
  for (const links of [[{ platform: 'myspace', url: 'myspace.com/x' }], [{ platform: 'linktree', url: 'https://example.com' }], [{ platform: 'website', url: 'https://bad url' }],
    [{ platform: 'custom:x', url: 'x.example' }], { not: 'a list' }]) {
    await both(ALICE, 'update_creator_artist_profile', { p_creator_account_id: C1, p_display_name: 'Should Not Stick', p_social_links: links });
  }
  for (const picture of [intent(30), intent(40), id(498)]) await both(ALICE, 'update_creator_artist_profile', { p_creator_account_id: C1, p_profile_image_upload_intent_id: picture });
  await both(ALICE, 'update_creator_artist_profile', { p_creator_account_id: C1, p_biography: null, p_social_links: [], p_pinned_release_ids: [] });
  await both(ALICE, 'update_creator_artist_profile', { p_creator_account_id: C2, p_display_name: 'No Identity' });
  await both(VERA, 'update_creator_artist_profile', { p_creator_account_id: C1, p_display_name: 'Viewer' });
});

test('processing jobs queued, retried or refused', async () => {
  for (const [user, intentN, type, bucket] of [
    [ALICE, 30, 'audio_delivery', null], [ALICE, 30, 'audio_delivery', 'chc-learning'], [ALICE, 2, 'audio_delivery', null], [ALICE, 4, 'audio_delivery', null], [ALICE, 34, 'video_delivery', null],
    [ALICE, 32, 'image_delivery', null], [ALICE, 32, 'audio_delivery', null], [ALICE, 30, 'metadata_probe', null], [ALICE, 30, 'audio_delivery', 'chc-images'], [ALICE, 6, 'image_delivery', null],
    [ALICE, 40, 'audio_delivery', null], [ERIN, 40, 'audio_delivery', 'chc-music'], [DAVE, 36, 'audio_delivery', 'chc-music'], [ALICE, 11, 'video_delivery', null], [ALICE, 12, 'video_delivery', null],
  ] as const) {
    await both(user, 'enqueue_media_processing_job', { p_upload_intent_id: intent(intentN), p_job_type: type, ...(bucket ? { p_output_bucket: bucket } : {}) });
  }
  await both(ALICE, 'enqueue_media_processing_job', { p_upload_intent_id: id(497) });
});

test('items added to a draft submission, which is then submitted', async () => {
  await both(ALICE, 'submit_media_submission', { p_submission_id: S8 });
  for (const args of [
    { p_upload_intent_id: intent(31), p_title: '  First  ', p_sort_order: 1 },
    { p_upload_intent_id: intent(33) },
    { p_upload_intent_id: intent(35), p_role: 'track', p_required: false },
    { p_media_asset_id: asset(30), p_sort_order: null },
    { p_upload_intent_id: intent(31) },
    { p_upload_intent_id: intent(40) },
    { p_upload_intent_id: id(496) },
    { p_media_asset_id: id(112) },
    { p_media_asset_id: id(103) },
    {},
    { p_upload_intent_id: intent(36), p_media_asset_id: asset(30) },
  ]) await both(ALICE, 'add_media_submission_item', { p_submission_id: S8, ...args });
  await both(ALICE, 'add_media_submission_item', { p_submission_id: S2, p_upload_intent_id: intent(37) });
  await both(VERA, 'add_media_submission_item', { p_submission_id: S8, p_upload_intent_id: intent(37) });
  await both(ALICE, 'submit_media_submission', { p_submission_id: S8 });
  await both(ALICE, 'submit_media_submission', { p_submission_id: S8 });
  await both(ALICE, 'submit_media_submission', { p_submission_id: id(495) });
});

const titles = (en: string) => ({ en, ar: `${en} (ar)`, fr: '  ' });

test('creating submissions: a music release, an album and a lesson set, and what is refused', async () => {
  await ok(ALICE, 'create_creator_submission_v3', {
    p_creator_account_id: C1, p_mode: 'music', p_title: ' Brand New Release ', p_description: 'Sung live', p_music_type: 'hymns', p_recording_type: 'studio',
    p_localized_titles: titles('Brand New Release'), p_release_timing_mode: 'scheduled', p_scheduled_release_at: later(5), p_original_release_date: '2024-05-05',
    p_items: [
      { uploadIntentId: intent(36), title: 'Opening', mainArtistName: 'Choir of Saint Mark', contributors: [{ role: 'Composer', name: 'Brand New Composer' }, { role: 'featured', artistId: A2 }],
        localizedTitles: { en: 'Opening', ar: 'افتتاح' }, featuredArtistIds: [A2, '', A1] },
      { uploadIntentId: intent(32), role: 'artwork' },
      { uploadIntentId: intent(37), title: 'Closing', mainArtistId: A2, contributors: [{ role: 'lyricist', name: 'brand new composer' }] },
    ],
  });
  await ok(ALICE, 'create_creator_submission_v3', {
    p_creator_account_id: C1, p_mode: 'learning_album', p_title: 'Kiahk Praises', p_cantor_id: K1, p_season_id: SE1, p_localized_titles: titles('Kiahk Praises'),
    p_items: [{ uploadIntentId: intent(38), title: 'Praise one', localizedTitles: { en: 'Praise one', fr: 'Louange un' } }, { uploadIntentId: intent(39), role: 'artwork' }],
  });
  await ok(ALICE, 'create_creator_submission_v3', {
    p_creator_account_id: C1, p_mode: 'learning_lesson_set', p_title: 'Tenen Lessons', p_hymn_id: H1, p_localized_titles: titles('Tenen Lessons'),
    p_release_timing_mode: 'asap', p_items: [{ uploadIntentId: intent(41), learningArtistName: 'Deacon Mina' }, { uploadIntentId: intent(43) }],
  });
  for (const args of [
    { p_mode: 'music', p_title: 'No Titles', p_music_type: 'h', p_recording_type: 's', p_items: [{ uploadIntentId: intent(44), title: 'x' }] },
    { p_mode: 'poetry', p_title: 'Unknown', p_localized_titles: titles('Unknown'), p_items: [{ uploadIntentId: intent(44) }] },
    { p_mode: 'music', p_title: 'Soon', p_localized_titles: titles('Soon'), p_music_type: 'h', p_recording_type: 's', p_release_timing_mode: 'scheduled', p_scheduled_release_at: later(1), p_items: [{ uploadIntentId: intent(44), title: 'x' }] },
    { p_mode: 'music', p_title: 'No Type', p_localized_titles: titles('No Type'), p_items: [{ uploadIntentId: intent(44), title: 'x' }] },
    { p_mode: 'music', p_title: 'Untitled Track', p_localized_titles: titles('Untitled Track'), p_music_type: 'h', p_recording_type: 's', p_items: [{ uploadIntentId: intent(44) }] },
    { p_mode: 'music', p_title: 'Two Covers', p_localized_titles: titles('Two Covers'), p_music_type: 'h', p_recording_type: 's',
      p_items: [{ uploadIntentId: intent(44), title: 'x' }, { uploadIntentId: intent(39), role: 'artwork' }, { uploadIntentId: intent(33), role: 'artwork' }] },
    { p_mode: 'learning_lesson_set', p_title: 'Chorus Lessons', p_cantor_id: K1, p_hymn_id: H1, p_localized_titles: titles('Chorus Lessons'), p_items: [{ uploadIntentId: intent(44) }] },
    { p_mode: 'learning_album', p_title: 'Bad Season', p_cantor_id: K3, p_season_id: id(494), p_localized_titles: titles('Bad Season'), p_items: [{ uploadIntentId: intent(44) }] },
    { p_mode: 'music', p_title: 'Used Upload', p_localized_titles: titles('Used Upload'), p_music_type: 'h', p_recording_type: 's', p_items: [{ uploadIntentId: intent(36), title: 'again' }] },
    { p_mode: 'music', p_title: 'Bad Credit', p_localized_titles: titles('Bad Credit'), p_music_type: 'h', p_recording_type: 's', p_items: [{ uploadIntentId: intent(44), title: 'x', contributors: [{ role: 'drummer', name: 'X' }] }] },
    { p_mode: 'music', p_title: 'Items Object', p_localized_titles: titles('Items Object'), p_music_type: 'h', p_recording_type: 's', p_items: { uploadIntentId: intent(44) } },
    { p_mode: 'music', p_title: 'Unknown Locale', p_localized_titles: { ...titles('Unknown Locale'), de: 'Unbekannt' }, p_music_type: 'h', p_recording_type: 's', p_items: [{ uploadIntentId: intent(44), title: 'x' }] },
  ]) await both(ALICE, 'create_creator_submission_v3', { p_creator_account_id: C1, ...args });
  await both(ERIN, 'create_creator_submission_v3', { p_creator_account_id: C3, p_mode: 'music', p_title: 'Suspended', p_localized_titles: titles('Suspended'), p_music_type: 'h', p_recording_type: 's', p_items: [{ uploadIntentId: intent(40), title: 'x' }] });
  await both(VERA, 'create_creator_submission_v3', { p_creator_account_id: C1, p_mode: 'learning_album', p_title: 'Viewer', p_cantor_id: K3, p_localized_titles: titles('Viewer'), p_items: [{ uploadIntentId: intent(44) }] });
});

test('editing a release: details, timing, tracks and credits', async () => {
  // R8's submission (from the test before) has all its files uploaded; R1's has one still waiting, so it can't go back to review.
  await ok(ALICE, 'update_creator_release_v3', {
    p_release_id: R8, p_title: 'Fresh Draft (Edited)', p_release_timing_mode: 'scheduled', p_scheduled_release_at: later(6), p_localized_titles: { en: 'Fresh', fr: 'Frais', ar: '' },
    p_music_type: ' chant ', p_recording_type: '', p_tracks: [
      { uploadIntentId: intent(42), title: 'Brand new track', mainArtistName: 'Deacon Mina', localizedTitles: { en: 'New', ar: '' },
        contributors: [{ role: 'producer', name: 'A Producer' }, { role: 'composer', name: 'Twice Credited' }, { role: 'Composer', name: 'twice credited' }] },
      { uploadIntentId: intent(48), mainArtistId: A1, featuredArtistIds: [A2] },
    ], p_cover_upload_intent_id: intent(45),
  });
  for (const args of [
    { p_release_id: R1, p_title: 'Midnight Praises (Edited)', p_tracks: [{ id: T2, title: 'Ten Thenou (2)' }, { id: T1 }] },
    { p_release_id: R1, p_release_timing_mode: 'later' },
    { p_release_id: R1, p_release_timing_mode: 'scheduled', p_scheduled_release_at: later(1) },
    { p_release_id: R1, p_tracks: [{ id: T3 }] },
    { p_release_id: R8, p_tracks: [{ title: 'No file' }] },
    { p_release_id: R1, p_tracks: 'not a list' },
    { p_release_id: R3, p_title: 'Empty submission id' },
    { p_release_id: id(493), p_title: 'Nothing' },
  ]) await both(ALICE, 'update_creator_release_v3', args);
  await both(VERA, 'update_creator_release_v3', { p_release_id: R8, p_title: 'Viewer' });
  await ok(ALICE, 'update_creator_release_v3', { p_release_id: R8, p_release_timing_mode: 'asap', p_clear_original_release_date: true, p_description: '' });
});

test('saving submission edits: a draft release, a live one, an album and what is refused', async () => {
  await ok(ALICE, 'save_submission_edit', { p_submission_id: S8, p_edit: {
    localizedTitles: { en: 'Fresh Draft (edited)', ar: 'مسودة' }, musicType: 'hymns', recordingType: 'live', releaseTimingMode: 'scheduled', scheduledReleaseAt: later(7),
    originalReleaseDate: '2023-03-03', description: '  Fresh  ', coverUploadIntentId: intent(46),
    items: [{ uploadIntentId: intent(44), localizedTitles: { en: 'A new track' }, mainArtistName: 'Deacon Mina', contributors: [{ role: 'arranger', artistId: A6 }] }],
  } });
  // Live, with no new file: an artist's edit stays live.
  await ok(ALICE, 'save_submission_edit', { p_submission_id: S9, p_edit: {
    localizedTitles: { en: 'Live One (retitled)' }, musicType: 'hymns', recordingType: 'live', items: [{ id: T9, localizedTitles: { en: 'Live Track' } }],
  } });
  await ok(ALICE, 'save_submission_edit', { p_submission_id: S9, p_edit: {
    localizedTitles: { en: 'Live One' }, musicType: 'hymns', recordingType: 'live', releaseTimingMode: 'asap',
    items: [{ id: T9, uploadIntentId: intent(30), localizedTitles: { en: 'Live Track' }, contributors: [{ role: 'featured', name: 'Brand New Guest' }] }],
  } });
  await ok(CAROL, 'save_submission_edit', { p_submission_id: S9, p_edit: {
    localizedTitles: { en: 'Live One (admin)' }, musicType: 'hymns', recordingType: 'live',
    items: [{ id: T9, localizedTitles: { en: 'Live Track' }, contributors: [{ role: 'featured', name: 'Brand New Guest' }] }],
  } });
  await ok(ALICE, 'save_submission_edit', { p_submission_id: S3, p_edit: {
    localizedTitles: { en: 'Kiahk Album (edited)', fr: 'Album' }, artistName: 'Deacon Mina', seasonId: '', releaseTimingMode: 'scheduled', scheduledReleaseAt: later(9),
    items: [{ id: id(407), localizedTitles: { en: 'Second first' } }, { id: id(406), uploadIntentId: intent(47), localizedTitles: { ar: 'جديد' } }],
  } });
  for (const [user, submission, edit] of [
    [ALICE, S4, { localizedTitles: { en: 'Rejected' } }],
    [ALICE, S8, null],
    [ALICE, S8, 'not an object'],
    [ALICE, S8, { localizedTitles: {}, title: '  ' }],
    [ALICE, S8, { localizedTitles: { en: 'x' }, musicType: 'h' }],
    [ALICE, S8, { localizedTitles: { en: 'x' }, musicType: 'h', recordingType: 'r', items: [] }],
    [ALICE, S8, { localizedTitles: { en: 'x' }, musicType: 'h', recordingType: 'r', items: [{ id: T9 }] }],
    [ALICE, S8, { localizedTitles: { en: 'x' }, musicType: 'h', recordingType: 'r', releaseTimingMode: 'never', items: [{ uploadIntentId: intent(44) }] }],
    [ALICE, S8, { localizedTitles: { en: 'x' }, musicType: 'h', recordingType: 'r', coverUploadIntentId: 'not-a-uuid', items: [] }],
    [ALICE, S3, { localizedTitles: { en: 'x' }, items: [{ id: id(499) }] }],
    [ALICE, S3, { localizedTitles: { en: 'x' }, seasonId: id(86), items: [{ id: id(407) }] }],
    [VERA, S8, { localizedTitles: { en: 'Viewer' } }],
    [ALICE, id(492), { localizedTitles: { en: 'Missing' } }],
  ] as const) await both(user, 'save_submission_edit', { p_submission_id: submission, p_edit: edit });
});

test('deleting tracks, releases and submissions', async () => {
  await ok(ALICE, 'delete_creator_music_release_track', { p_release_id: R1, p_track_id: T2 });
  for (const [release, track] of [[R2, id(54)], [R9, T9], [id(491), T1], [R1, T3]]) {
    await both(ALICE, 'delete_creator_music_release_track', { p_release_id: release, p_track_id: track });
  }
  await both(VERA, 'delete_creator_music_release', { p_release_id: R2 });
  await both(ALICE, 'delete_creator_music_release', { p_release_id: R2 });
  await both(ALICE, 'delete_creator_music_release', { p_release_id: R9 });
  await both(ALICE, 'delete_creator_music_release', { p_release_id: R2 });
  for (const submission of [S1, S3, S4, S8, id(490)]) await both(ALICE, 'delete_submission', { p_submission_id: submission });
  await both(ERIN, 'delete_submission', { p_submission_id: S2 });
  assert.ok(A1 && C2 && BOB && R3);
});
