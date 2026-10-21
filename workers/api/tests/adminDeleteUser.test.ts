/**
 * CV-Admin's "Delete account" (src/rpc/admin/users.ts admin_delete_user), over
 * tests/lib/creatorCatalog.ts: who may delete whom, and what goes with an
 * account (its own data, its own submissions, its files) and what stays (what
 * it made for a workspace, without it as author). A deletion that a foreign
 * key refuses changes nothing.
 */
import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { ALICE, BOB, C1, CAROL, DAVE, id, S1, S2, S3, seedCatalog, VERA } from './lib/creatorCatalog.ts';
import { createOracle } from './lib/oracle.ts';
import { WorkerSide } from './lib/worker.ts';

const STAMP = '2026-10-01T00:00:00+00:00';
let worker: WorkerSide;

before(async () => {
  const oracle = await createOracle();
  worker = new WorkerSide();
  await seedCatalog(oracle, worker);
  await oracle.close();
  worker.db.exec(`INSERT INTO "music.artist_follows" ("user_id", "artist_id", "created_at") VALUES ('${BOB}', '${id(20)}', '${STAMP}'), ('${ALICE}', '${id(20)}', '${STAMP}')`);
  for (const key of [`profile-avatars/${BOB}/avatar`, `playlist-covers/${BOB}/${id(690)}/cover`, `profile-avatars/${ALICE}/avatar`]) await worker.env.USER_MEDIA!.put(key, 'x');
});

const count = (sql: string, ...params: unknown[]) => worker.rows<{ n: number }>(`SELECT count(*) AS n FROM ${sql}`, ...params)[0].n;
const del = (caller: string | null, user: string) => worker.rpc(caller, 'admin_delete_user', { p_user_id: user });
const refused = async (caller: string | null, user: string) => {
  const answer = await del(caller, user);
  assert.ok(answer.error, `deleting ${user} as ${caller} was refused`);
  return [answer.error!.code, answer.error!.message];
};

test('only an admin deletes, never their own account nor another admin\'s, nor one that sent broadcasts', async () => {
  assert.deepEqual(await refused(null, BOB), ['42501', 'permission denied for function admin_delete_user']);
  assert.deepEqual(await refused(ALICE, BOB), ['42501', 'Admin role required']);
  assert.deepEqual(await refused(CAROL, CAROL), ['42501', "You can't delete your own account"]);
  assert.deepEqual(await refused(CAROL, id(699)), ['P0002', 'User not found']);
  worker.db.exec(`INSERT INTO "creator.user_roles" ("user_id", "role", "granted_at") VALUES ('${VERA}', 'admin', '${STAMP}')`);
  assert.deepEqual(await refused(CAROL, VERA), ['42501', "An admin's account can't be deleted"]);
  worker.db.exec(`DELETE FROM "creator.user_roles" WHERE "user_id" = '${VERA}' AND "role" = 'admin'`);
  worker.db.exec(`INSERT INTO "public.notification_broadcasts" ("id", "category", "title", "body", "created_by") VALUES ('${id(691)}', 'announcements', 'Hi', 'Hello', '${VERA}')`);
  assert.deepEqual(await refused(CAROL, VERA), ['23503', "This account sent notification broadcasts, so it can't be deleted"]);
  worker.db.exec(`DELETE FROM "public.notification_broadcasts" WHERE "id" = '${id(691)}'`);
  assert.equal(count('"auth.users"'), 6, 'nobody was deleted');
});

test('an account whose uploads someone else\'s submission uses is not deleted, and nothing changes', async () => {
  // Dave's submission S2 holds an item made from one of Alice's uploads, and Alice's S1 one of Dave's.
  const before = [count('"auth.users"'), count('"media.submissions"'), count('"media.submission_items"'), count('"media.upload_intents"'), count('"music.artist_follows"')];
  assert.deepEqual(await refused(CAROL, ALICE), ['23503', "This account's uploads are used in someone else's submission, so it can't be deleted"]);
  assert.deepEqual(await refused(CAROL, DAVE), ['23503', "This account's uploads are used in someone else's submission, so it can't be deleted"]);
  assert.deepEqual([count('"auth.users"'), count('"media.submissions"'), count('"media.submission_items"'), count('"media.upload_intents"'), count('"music.artist_follows"')], before);
  assert.ok(await worker.env.USER_MEDIA!.head(`profile-avatars/${ALICE}/avatar`));
});

test('a listener: the account, its sessions, follows and files go; nothing else', async () => {
  const usersBefore = count('"auth.users"');
  const answer = await del(CAROL, BOB);
  assert.equal(answer.error, null, JSON.stringify(answer.error));
  assert.deepEqual(answer.data, { email: 'bob@example.com', filesRemoved: 2 });
  assert.equal(count('"auth.users"'), usersBefore - 1);
  assert.equal(count('"auth.users" WHERE "id" = ?', BOB), 0);
  assert.equal(count('"auth.sessions" WHERE "user_id" = ?', BOB), 0);
  assert.equal(count('"auth.accounts" WHERE "user_id" = ?', BOB), 0);
  assert.equal(count('"music.artist_follows" WHERE "user_id" = ?', BOB), 0);
  assert.equal(count('"music.artist_follows" WHERE "user_id" = ?', ALICE), 1);
  assert.equal(await worker.env.USER_MEDIA!.head(`profile-avatars/${BOB}/avatar`), null);
  assert.equal(await worker.env.USER_MEDIA!.head(`playlist-covers/${BOB}/${id(690)}/cover`), null);
  assert.ok(await worker.env.USER_MEDIA!.head(`profile-avatars/${ALICE}/avatar`), 'only their files');
  // Their session no longer signs anything in.
  assert.equal((await worker.rpc(BOB, 'admin_list_users', {})).status, 401);
});

test('a workspace member: their own submissions and membership go; what they made for the workspace stays, without them as author', async () => {
  const VERAS = id(692);
  worker.db.exec(`INSERT INTO "media.submissions" ("id", "creator_account_id", "submission_type", "title", "status", "created_by", "created_at", "updated_at") VALUES ('${VERAS}', '${C1}', 'music_release', 'Vera Draft', 'draft', '${VERA}', '${STAMP}', '${STAMP}')`);
  const track = worker.rows<{ id: string }>('SELECT "id" FROM "music.tracks" ORDER BY "id" LIMIT 1')[0].id;
  worker.db.exec(`UPDATE "music.tracks" SET "updated_by" = '${VERA}' WHERE "id" = '${track}'`);
  const [tracks, releases, albums, submissions] = [count('"music.tracks"'), count('"music.releases"'), count('"learning.albums"'), count('"media.submissions"')];
  const answer = await del(CAROL, VERA);
  assert.equal(answer.error, null, JSON.stringify(answer.error));
  assert.deepEqual(answer.data, { email: 'vera@example.com', filesRemoved: 0 });
  assert.equal(count('"media.submissions" WHERE "id" = ?', VERAS), 0, 'their submission');
  assert.equal(count('"media.submissions"'), submissions - 1, 'nobody else\'s');
  assert.equal(count('"media.submissions" WHERE "id" IN (?, ?, ?)', S1, S2, S3), 3);
  assert.equal(count('"creator.creator_account_members" WHERE "user_id" = ?', VERA), 0);
  assert.equal(count('"creator.creator_account_members" WHERE "creator_account_id" = ?', C1), 2, 'the workspace keeps Alice and Dave');
  assert.deepEqual([count('"music.tracks"'), count('"music.releases"'), count('"learning.albums"')], [tracks, releases, albums]);
  assert.deepEqual(worker.rows('SELECT "updated_by" FROM "music.tracks" WHERE "id" = ?', track), [{ updated_by: null }], 'kept, without them as author');
});
