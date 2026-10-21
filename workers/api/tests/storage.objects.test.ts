/**
 * The two buckets the apps upload to (src/storage.ts), on R2: who may write
 * what (Supabase's storage.objects policies), the buckets' type and size
 * limits, public reads and removal. Then set_music_playlist_cover
 * (src/rpc/music/playlists.ts) against Supabase's own function: the oracle is
 * given a storage.objects row where the Worker has the uploaded object, and
 * the cover's address is compared with each side's base masked (Supabase's
 * project URL, cv-api's own).
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { ALICE, BOB, id, seedCatalog } from './lib/creatorCatalog.ts';
import { createOracle, type Oracle, type PgAnswer } from './lib/oracle.ts';
import { seed } from './lib/seed.ts';
import { bothTables, firstDifferences } from './lib/tables.ts';
import { BASE, normalize, WorkerSide, type Answer } from './lib/worker.ts';

const AT = '2026-03-10T08:00:00+00:00';
const SUPABASE = 'https://wtuujmeinzqfikvuofmh.supabase.co';
const PL1 = id(600); const PL2 = id(601);
const png = (size: number) => new Uint8Array(new ArrayBuffer(size)).fill(7);

let oracle: Oracle;
let worker: WorkerSide;
const seeded = new Set(Array.from({ length: 700 }, (_, n) => id(n)));

before(async () => {
  oracle = await createOracle();
  worker = new WorkerSide();
  await seedCatalog(oracle, worker);
  await seed(oracle, worker, [['music.playlists', [
    { id: PL1, owner_user_id: ALICE, name: 'Alice Vespers', visibility: 'public', created_at: AT, updated_at: AT },
    { id: PL2, owner_user_id: BOB, name: 'Bob Matins', visibility: 'private', created_at: AT, updated_at: AT },
  ]]]);
  // Supabase Storage's table, as much of it as set_music_playlist_cover reads.
  await oracle.pg.exec(`create schema storage;
    create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text not null, name text not null, owner uuid, owner_id text, metadata jsonb, unique (bucket_id, name));
    grant usage on schema storage to authenticated; grant select on storage.objects to authenticated;`);
});
after(() => oracle.close());

const upload = (user: string | null, bucket: string, path: string, bytes: Uint8Array<ArrayBuffer>, type = 'image/png', headers: Record<string, string> = {}, method = 'POST') =>
  worker.fetch(user, method, `/storage/v1/object/${bucket}/${path}`, { body: bytes, headers: { 'content-type': type, 'cache-control': 'max-age=60', ...headers } });

test('uploads: the user\'s own avatar folder, their own playlists\' covers; JPEG, PNG or WebP up to 5 MB; replaced only when asked', async () => {
  assert.equal((await upload(ALICE, 'profile-avatars', `${ALICE}/avatar`, png(100))).status, 200);
  const read = await worker.fetch(null, 'GET', `/storage/v1/object/public/profile-avatars/${ALICE}/avatar`);
  assert.equal(read.status, 200);
  assert.equal(read.headers.get('content-type'), 'image/png');
  assert.equal((await read.arrayBuffer()).byteLength, 100);
  const refusals: [Response, number][] = [
    [await upload(ALICE, 'profile-avatars', `${BOB}/avatar`, png(10)), 403],
    [await upload(null, 'profile-avatars', `${ALICE}/avatar`, png(10)), 403],
    [await upload(ALICE, 'profile-avatars', `${ALICE}/../${BOB}/avatar`, png(10)), 403],
    [await upload(ALICE, 'profile-avatars', `${ALICE}/other`, png(10), 'image/gif'), 415],
    [await upload(ALICE, 'profile-avatars', `${ALICE}/big`, png(5 * 1024 * 1024 + 1)), 413],
    [await upload(ALICE, 'profile-avatars', `${ALICE}/avatar`, png(10)), 409],
    [await upload(ALICE, 'other-bucket', `${ALICE}/avatar`, png(10)), 404],
    [await upload(ALICE, 'playlist-covers', `${ALICE}/${PL2}/cover`, png(10)), 403],
    [await upload(BOB, 'playlist-covers', `${ALICE}/${PL1}/cover`, png(10)), 403],
    [await upload(ALICE, 'playlist-covers', `${ALICE}/${PL1}/other`, png(10)), 403],
  ];
  for (const [response, status] of refusals) assert.equal(response.status, status, await response.text());
  assert.equal((await upload(ALICE, 'profile-avatars', `${ALICE}/avatar`, png(20), 'image/webp', { 'x-upsert': 'true' })).status, 200);
  assert.equal((await upload(ALICE, 'profile-avatars', `${ALICE}/avatar`, png(30), 'image/jpeg', {}, 'PUT')).status, 200);
  // supabase-js sends a Blob as a form.
  const form = new FormData();
  form.append('cacheControl', '3600');
  form.append('', new Blob([png(40)], { type: 'image/webp' }));
  assert.equal((await worker.fetch(BOB, 'POST', `/storage/v1/object/profile-avatars/${BOB}/avatar`, { body: form })).status, 200);
  const bobs = await worker.fetch(null, 'HEAD', `/storage/v1/object/public/profile-avatars/${BOB}/avatar`);
  assert.deepEqual([bobs.status, bobs.headers.get('content-type'), bobs.headers.get('cache-control')], [200, 'image/webp', 'max-age=3600']);
  assert.equal((await worker.fetch(null, 'GET', '/storage/v1/object/public/profile-avatars/nobody/avatar')).status, 404);
});

test('an upload is refused at its declared size unread, and a stream is read no further than the limit', async () => {
  const MB = 1024 * 1024;
  /** An endless body, counting what was read of it. */
  const endless = () => {
    const stream = { pulled: 0, body: null as unknown as ReadableStream };
    stream.body = new ReadableStream({ pull(controller) { stream.pulled += 1; controller.enqueue(png(MB)); } });
    return stream;
  };
  const declared = endless();
  const refused = await worker.fetch(ALICE, 'POST', `/storage/v1/object/profile-avatars/${ALICE}/declared`, { body: declared.body, headers: { 'content-type': 'image/png', 'content-length': String(6 * MB) } });
  assert.equal(refused.status, 413);
  assert.ok(declared.pulled <= 1, `read ${declared.pulled} MB of a body declared too large`);
  const undeclared = endless();
  assert.equal((await worker.fetch(ALICE, 'POST', `/storage/v1/object/profile-avatars/${ALICE}/streamed`, { body: undeclared.body, headers: { 'content-type': 'image/png' } })).status, 413);
  assert.ok(undeclared.pulled <= 7, `read ${undeclared.pulled} MB of an endless body`);
  // A form's boundary is case-sensitive.
  const boundary = 'CvBoundaryAbC123';
  const text = (s: string) => new TextEncoder().encode(s);
  const parts = [text(`--${boundary}\r\nContent-Disposition: form-data; name="cacheControl"\r\n\r\n60\r\n--${boundary}\r\nContent-Disposition: form-data; name=""; filename="blob"\r\nContent-Type: image/png\r\n\r\n`), png(50), text(`\r\n--${boundary}--\r\n`)];
  const form = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  parts.reduce((offset, p) => (form.set(p, offset), offset + p.length), 0);
  assert.equal((await worker.fetch(ALICE, 'POST', `/storage/v1/object/profile-avatars/${ALICE}/form`, { body: form, headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } })).status, 200);
  const stored = await worker.fetch(null, 'HEAD', `/storage/v1/object/public/profile-avatars/${ALICE}/form`);
  assert.deepEqual([stored.status, stored.headers.get('content-length'), stored.headers.get('cache-control')], [200, '50', 'max-age=60']);
  // A malformed escape is a refusal, not a crash.
  assert.equal((await worker.fetch(null, 'GET', '/storage/v1/object/public/profile-avatars/%E0%A4%A')).status, 404);
  assert.equal((await upload(ALICE, 'profile-avatars', `${ALICE}/%E0%A4%A`, png(10))).status, 400);
});

test('removing: only what the user may delete, and is there', async () => {
  const removed = await worker.fetch(ALICE, 'DELETE', '/storage/v1/object/profile-avatars', {
    body: JSON.stringify({ prefixes: [`${ALICE}/avatar`, `${BOB}/avatar`, `${ALICE}/missing`] }), headers: { 'content-type': 'application/json' },
  });
  assert.deepEqual(((await removed.json()) as { name: string }[]).map((object) => object.name), [`${ALICE}/avatar`]);
  assert.equal((await worker.fetch(null, 'GET', `/storage/v1/object/public/profile-avatars/${ALICE}/avatar`)).status, 404);
  assert.equal((await worker.fetch(null, 'GET', `/storage/v1/object/public/profile-avatars/${BOB}/avatar`)).status, 200);
  assert.equal((await worker.fetch(null, 'DELETE', '/storage/v1/object/profile-avatars', { body: '{"prefixes":[]}' })).status, 403);
});

const masked = (text: string) => text.replaceAll(SUPABASE, '<base>').replaceAll(BASE, '<base>');
const mask = (value: unknown) => JSON.parse(masked(JSON.stringify(value)));

function same(pg: PgAnswer, w: Answer, what: string): void {
  if (pg.error) {
    assert.ok(w.error, `${what}: Postgres refused (${pg.error.message}); the Worker answered ${JSON.stringify(w.data)}`);
    assert.deepEqual([w.error!.code, w.error!.message], [pg.error.code, pg.error.message], what);
  } else {
    assert.equal(w.error, null, `${what}: the Worker refused (${JSON.stringify(w.error)})`);
    assert.deepEqual(normalize(mask(w.data), seeded), normalize(mask(pg.data), seeded), what);
  }
}

async function cover(user: string | null, playlist: string, fn = 'set_music_playlist_cover'): Promise<PgAnswer> {
  const pg = await oracle.call(user, fn, { p_playlist_id: playlist });
  same(pg, await worker.rpc(user, fn, { p_playlist_id: playlist }), `${fn}(${playlist}) as ${user ?? 'anon'}`);
  const { pg: pgTables, sqlite } = await bothTables(oracle, worker, ['media.media_assets', 'music.playlists'], seeded);
  if (masked(pgTables) !== masked(sqlite)) assert.fail(`after ${fn}: the tables differ\n${firstDifferences(masked(sqlite), masked(pgTables)).join('\n')}`);
  return pg;
}

/** The upload on both sides: the object on R2, and Supabase's storage.objects row. */
async function uploadCover(user: string, playlist: string, size: number, type = 'image/png'): Promise<void> {
  const path = `${user}/${playlist}/cover`;
  assert.equal((await upload(user, 'playlist-covers', path, png(size), type, { 'x-upsert': 'true' })).status, 200);
  await oracle.sql(`insert into storage.objects (bucket_id, name, owner, owner_id, metadata) values ('playlist-covers', $1, $2::uuid, $2::text, $3::jsonb)
    on conflict (bucket_id, name) do update set metadata = excluded.metadata`, [path, user, JSON.stringify({ mimetype: type, size })]);
}

test('a playlist cover: attached once uploaded, at its public address; uploading again bumps its version; cleared', async () => {
  assert.equal((await cover(ALICE, PL1)).error?.message, 'Upload the playlist cover before attaching it');
  assert.equal((await cover(BOB, PL1)).error?.code, '42501');
  assert.equal((await cover(null, PL1)).error?.code, '42501');
  await uploadCover(ALICE, PL1, 1234);
  const first = (await cover(ALICE, PL1)).data as { path: string; version: number };
  assert.deepEqual([masked(first.path), first.version], [`<base>/storage/v1/object/public/playlist-covers/${ALICE}/${PL1}/cover?v=1`, 1]);
  await uploadCover(ALICE, PL1, 2048, 'image/jpeg');
  assert.equal(((await cover(ALICE, PL1)).data as { version: number }).version, 2);
  await cover(ALICE, PL1, 'clear_music_playlist_cover');
});
