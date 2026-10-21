/**
 * Parity: the web app's link previews (src/rpc/workers/share.ts), the Worker
 * against Supabase's own functions (the oracle), over
 * tests/lib/creatorCatalog.ts plus published learning content, an artist
 * without a photo whose cover comes from their newest credited release (one
 * of them through a draft track only its creator account may see), and
 * public, private and coverless playlists. Each preview is asked for signed
 * out (as the web app does) and by a member of the creator account, in every
 * locale.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { A1, A2, A5, ALICE, BOB, C1, H1, id, K1, R1, R2, seedCatalog, T1, T3, T4 } from './lib/creatorCatalog.ts';
import { createOracle, type Oracle, type PgAnswer } from './lib/oracle.ts';
import { seed } from './lib/seed.ts';
import { normalize, WorkerSide, type Answer } from './lib/worker.ts';

const AT = '2026-03-10T08:00:00+00:00';
const AX = id(600); const TD = id(601); const RX = id(602); const ALP = id(603); const LSP = id(604); const LP = id(605); const LD = id(606);
const PL1 = id(610); const PL2 = id(611); const PL3 = id(612); const PL4 = id(613); const COVER = id(614);

let oracle: Oracle;
let worker: WorkerSide;
const seeded = new Set(Array.from({ length: 700 }, (_, n) => id(n)));

before(async () => {
  oracle = await createOracle();
  worker = new WorkerSide();
  await seedCatalog(oracle, worker);
  const stamps = { created_at: AT, updated_at: AT };
  await seed(oracle, worker, [
    ['media.media_assets', [{ id: COVER, provider: 'external', bucket: 'playlist-covers', path: 'https://cdn.example/cover.jpg?w=600', media_type: 'image', mime_type: 'image/jpeg',
      version: 3, processing_status: 'completed', publication_status: 'published', ...stamps }]],
    ['music.artists', [{ id: AX, display_name: 'Choir Without A Photo', biography: null, publication_status: 'published', ...stamps }]],
    ['music.artist_localizations', [
      { id: id(620), artist_id: A1, locale: 'ar', display_name: 'خورس مار مرقس', biography: 'خورس', is_primary: false, publication_status: 'published', ...stamps },
      { id: id(621), artist_id: A1, locale: 'fr', display_name: 'Chorale (brouillon)', is_primary: false, publication_status: 'draft', ...stamps },
    ]],
    ['music.tracks', [{ id: TD, owner_creator_account_id: C1, title: 'Draft In A Live Release', media_asset_id: id(106), publication_status: 'draft', ...stamps }]],
    ['music.releases', [{ id: RX, owner_creator_account_id: C1, primary_artist_id: A2, cover_asset_id: id(102), release_type: 'single', title: 'Newest', release_date: '2026-06-01',
      publication_status: 'published', ...stamps }]],
    ['music.release_tracks', [{ id: id(630), release_id: RX, track_id: TD, disc_number: 1, track_number: 1, created_at: AT }]],
    ['music.track_artists', [
      { track_id: T4, artist_id: AX, role: 'primary', sort_order: 0, created_at: AT }, { track_id: TD, artist_id: AX, role: 'featured', sort_order: 0, created_at: AT },
      { track_id: T1, artist_id: AX, role: 'featured', sort_order: 1, created_at: AT },
    ]],
    ['music.release_localizations', [
      { id: id(631), release_id: R2, locale: 'ar', title: 'ترنيمة قديمة', description: 'وصف', is_primary: false, publication_status: 'published', ...stamps },
      { id: id(632), release_id: R2, locale: 'fr', title: 'Brouillon', is_primary: false, publication_status: 'draft', ...stamps },
    ]],
    ['music.track_localizations', [{ id: id(633), track_id: T4, locale: 'ar', title: 'ترنيمة', is_primary: false, publication_status: 'published', ...stamps }]],
    ['learning.cantor_localizations', [{ cantor_id: K1, locale: 'ar', display_name: 'خورس', biography: 'سيرة', ...stamps }]],
    ['learning.albums', [{ id: ALP, owner_creator_account_id: C1, cantor_id: K1, cover_asset_id: id(104), title: 'Live Album', description: 'Praises', publication_status: 'published', ...stamps }]],
    ['learning.album_localizations', [{ album_id: ALP, locale: 'fr', title: 'Album en direct', ...stamps }]],
    ['learning.lesson_sets', [{ id: LSP, owner_creator_account_id: C1, cantor_id: K1, hymn_id: H1, cover_asset_id: id(101), title: 'Live Lessons', publication_status: 'published', ...stamps }]],
    ['learning.lesson_set_localizations', [{ lesson_set_id: LSP, locale: 'ar', title: 'دروس', ...stamps }]],
    ['learning.lessons', [
      { id: LP, lesson_set_id: LSP, media_asset_id: id(113), media_type: 'audio', title: 'Lesson One', sort_order: 1, publication_status: 'published', ...stamps },
      { id: LD, lesson_set_id: LSP, media_asset_id: id(113), media_type: 'audio', title: 'Draft Lesson', sort_order: 2, publication_status: 'draft', ...stamps },
    ]],
    ['learning.lesson_localizations', [{ lesson_id: LP, locale: 'ar', title: 'الدرس الأول', ...stamps }]],
    ['music.playlists', [
      { id: PL1, owner_user_id: BOB, name: 'With A Cover', description: ' Vespers ', visibility: 'public', cover_asset_id: COVER, ...stamps },
      { id: PL2, owner_user_id: ALICE, name: 'From Tracks', visibility: 'public', ...stamps },
      { id: PL3, owner_user_id: ALICE, name: 'Private', visibility: 'private', cover_asset_id: COVER, ...stamps },
      { id: PL4, owner_user_id: BOB, name: 'Empty', description: '   ', visibility: 'public', ...stamps },
    ]],
    ['music.playlist_tracks', [
      { playlist_id: PL2, track_id: TD, sort_order: 0, added_by: ALICE, created_at: AT },
      { playlist_id: PL2, track_id: T4, sort_order: 1, added_by: ALICE, created_at: AT },
      { playlist_id: PL2, track_id: T3, sort_order: 2, added_by: ALICE, created_at: AT },
    ]],
  ]);
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

async function both(user: string | null, fn: string, args: Record<string, unknown>): Promise<PgAnswer> {
  const pg = await oracle.call(user, fn, args);
  same(pg, await worker.rpc(user, fn, args), `${fn}(${JSON.stringify(args)}) as ${user ?? 'anon'}`);
  return pg;
}

const title = (answer: PgAnswer) => (answer.data as { title: string } | null)?.title ?? null;

test('share previews: each kind of page, in each language, signed out and as the creator; anything else is the app\'s own', async () => {
  const pages = [
    `/music/artist/${A1}`, `/music/artist/${A2}/`, `/music/artist/${A5}`, `/music/artist/${AX}`, `/music/artist/${id(23)}`,
    `/music/release/${R2}?ref=share`, `/music/release/${R1}`, `/music/release/${RX}`,
    `/music/track/${T4}`, `/music/track/${T1}`, `/music/track/${TD}`,
    `/learn/cantor/${K1}`, `/learn/album/${ALP}`, `/learn/album/${id(80)}`, `/learn/lesson/${LP}`, `/learn/lesson/${LD}`,
    `/music/artist/${A1.toUpperCase()}`, `/music/artist/${id(699)}`, '/music', '/', '', null, `/music/artist/${A1}/extra`,
  ];
  for (const user of [null, ALICE]) {
    for (const locale of ['en', 'ar', 'fr', null]) {
      for (const path of pages) await both(user, 'get_share_preview', { p_path: path, p_locale: locale });
    }
  }
  await both(null, 'get_share_preview', { p_path: `/music/artist/${A1}` });
  // Not a uuid, though 36 characters of the pattern.
  assert.equal((await both(null, 'get_share_preview', { p_path: `/music/artist/${'-'.repeat(36)}` })).error?.code, '22P02');
  // The artist's cover comes through the draft track only for its creator account.
  const signedOut = (await both(null, 'get_share_preview', { p_path: `/music/artist/${AX}` })).data as { imageAsset: { id: string } };
  const creator = (await both(ALICE, 'get_share_preview', { p_path: `/music/artist/${AX}` })).data as { imageAsset: { id: string } };
  assert.deepEqual([signedOut.imageAsset.id, creator.imageAsset.id], [id(104), id(102)]);
  assert.equal(title(await both(null, 'get_share_preview', { p_path: '/learn/album/nope' })), 'Coptic Vine');
});

test('playlist previews: public ones only, their cover or their first track\'s release cover', async () => {
  for (const user of [null, ALICE, BOB]) {
    for (const playlist of [PL1, PL2, PL3, PL4, id(699)]) await both(user, 'get_music_playlist_share_preview', { p_playlist_id: playlist });
  }
  const covers = [];
  for (const user of [null, ALICE]) covers.push(((await both(user, 'get_music_playlist_share_preview', { p_playlist_id: PL2 })).data as { imageAsset: { id: string } }).imageAsset.id);
  assert.deepEqual(covers, [id(104), id(102)]);
  assert.equal((await both(null, 'get_music_playlist_share_preview', { p_playlist_id: PL3 })).data, null);
});
