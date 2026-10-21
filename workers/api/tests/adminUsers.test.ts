/**
 * CV-Admin's Users page (src/rpc/admin/users.ts): cv-api's own admin
 * functions for someone locked out. Only an admin may call them; the list
 * shows how each account signs in and its sessions, and the actions send
 * Better Auth's own emails (kept in the outbox), confirm an email, or end
 * every session.
 */
import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import bcrypt from 'bcryptjs';
import { outbox } from '../src/auth/email.ts';
import { ACCOUNT_PAGE, type ListedUser } from '../src/rpc/admin/users.ts';
import { id } from './lib/creatorCatalog.ts';
import { PASSWORD, WorkerSide } from './lib/worker.ts';

const ADMIN = id(1); const READER = id(2); const GOOGLE_ONLY = id(3); const UNCONFIRMED = id(4); const NEVER = id(5);
const STAMP = '2026-10-01T00:00:00+00:00';
let worker: WorkerSide;

before(async () => {
  worker = new WorkerSide();
  await worker.addUser(ADMIN, 'admin@example.com', 'Abouna Admin');
  await worker.addUser(READER, 'reader@example.com', 'Mina Reader');
  worker.db.prepare(`INSERT INTO "creator.user_roles" ("user_id", "role", "granted_at") VALUES (?, 'admin', ?), (?, 'creator', ?)`).run(ADMIN, STAMP, ADMIN, STAMP);
  const user = worker.db.prepare('INSERT INTO "auth.users" ("id", "name", "email", "email_verified", "created_at", "updated_at") VALUES (?, ?, ?, ?, ?, ?)');
  const account = worker.db.prepare('INSERT INTO "auth.accounts" ("id", "user_id", "account_id", "provider_id", "password", "created_at", "updated_at") VALUES (?, ?, ?, ?, ?, ?, ?)');
  user.run(GOOGLE_ONLY, 'Marina Google', 'marina@example.com', 1, STAMP, STAMP);
  account.run('acc-google', GOOGLE_ONLY, '1234567890', 'google', null, STAMP, STAMP);
  user.run(UNCONFIRMED, 'Kyrillos New', 'kyrillos@example.com', 0, STAMP, STAMP);
  account.run('acc-unconfirmed', UNCONFIRMED, UNCONFIRMED, 'credential', bcrypt.hashSync(PASSWORD, 4), STAMP, STAMP);
  user.run(NEVER, 'Zeina Never', 'zeina@example.com', 1, STAMP, STAMP);
  // The reader signed in after the admin did: a second session, later.
  await signIn('reader@example.com');
});

const signIn = (email: string, password = PASSWORD) => worker.fetch(null, 'POST', '/auth/sign-in/email', {
  body: JSON.stringify({ email, password }), headers: { 'content-type': 'application/json' },
});
const sessions = (user: string) => (worker.rows<{ n: number }>('SELECT count(*) AS n FROM "auth.sessions" WHERE "user_id" = ?', user))[0].n;
const list = async (args: Record<string, unknown> = {}) => {
  const answer = await worker.rpc(ADMIN, 'admin_list_users', args);
  assert.equal(answer.error, null, JSON.stringify(answer.error));
  return answer.data as ListedUser[];
};

test('only an admin: signed out, the grant refuses; signed in, "Admin role required"', async () => {
  for (const [fn, args] of [['admin_list_users', {}], ['admin_send_password_reset', { p_user_id: READER }], ['admin_resend_confirmation', { p_user_id: UNCONFIRMED }],
    ['admin_mark_email_confirmed', { p_user_id: UNCONFIRMED }], ['admin_sign_out_everywhere', { p_user_id: READER }]] as const) {
    const anon = await worker.rpc(null, fn, args);
    assert.deepEqual([anon.status, anon.error?.code, anon.error?.message], [401, '42501', `permission denied for function ${fn}`], fn);
    const reader = await worker.rpc(READER, fn, args);
    assert.deepEqual([reader.error?.code, reader.error?.message], ['42501', 'Admin role required'], fn);
  }
  assert.equal(outbox.length, 0, 'nothing was sent');
  assert.equal(sessions(READER), 2);
});

test('the list: how each account signs in, its email, sessions and roles; latest sign-in first', async () => {
  const users = await list();
  assert.deepEqual(users.map((u) => u.email), ['reader@example.com', 'admin@example.com', 'kyrillos@example.com', 'marina@example.com', 'zeina@example.com']);
  const by = Object.fromEntries(users.map((u) => [u.email, u]));
  assert.deepEqual(by['reader@example.com'], {
    id: READER, email: 'reader@example.com', name: 'Mina Reader', image: null, emailConfirmed: true, createdAt: STAMP,
    signInMethods: ['password'], lastSignInAt: by['reader@example.com'].lastSignInAt, activeSessions: 2, roles: [],
  });
  assert.ok(by['reader@example.com'].lastSignInAt! > by['admin@example.com'].lastSignInAt!);
  assert.deepEqual(by['admin@example.com'].roles, ['admin', 'creator']);
  assert.deepEqual(by['marina@example.com'].signInMethods, ['google']);
  assert.deepEqual([by['kyrillos@example.com'].emailConfirmed, by['kyrillos@example.com'].lastSignInAt, by['kyrillos@example.com'].activeSessions], [false, null, 0]);
  assert.deepEqual(by['zeina@example.com'].signInMethods, []);
});

test('a search keeps the emails and names that contain it, in any case; a limit cuts the list', async () => {
  assert.deepEqual((await list({ p_search: '  READER@ ' })).map((u) => u.id), [READER]);
  assert.deepEqual((await list({ p_search: 'marina g' })).map((u) => u.id), [GOOGLE_ONLY]);
  assert.deepEqual((await list({ p_search: '@EXAMPLE.com' })).length, 5);
  assert.deepEqual(await list({ p_search: 'nobody' }), []);
  assert.deepEqual((await list({ p_search: '', p_limit: 2 })).map((u) => u.id), [READER, ADMIN]);
});

test('a password reset: the email "Forgot your password?" sends, back to the account page', async () => {
  outbox.length = 0;
  const answer = await worker.rpc(ADMIN, 'admin_send_password_reset', { p_user_id: READER });
  assert.deepEqual(answer.data, { email: 'reader@example.com', addsPassword: false });
  assert.equal(outbox.length, 1);
  assert.deepEqual([outbox[0].to, outbox[0].subject], ['reader@example.com', 'Reset your Coptic Vine password']);
  assert.equal(new URL(outbox[0].link).searchParams.get('callbackURL'), ACCOUNT_PAGE);
  const missing = await worker.rpc(ADMIN, 'admin_send_password_reset', { p_user_id: id(99) });
  assert.deepEqual([missing.error?.code, missing.error?.message], ['P0002', 'User not found']);
  assert.equal((await worker.rpc(ADMIN, 'admin_send_password_reset', { p_user_id: 'not-a-uuid' })).error?.code, '22P02');
  assert.equal(outbox.length, 1);
});

test('a reset for an account that only signs in with Google lets it add a password', async () => {
  outbox.length = 0;
  const answer = await worker.rpc(ADMIN, 'admin_send_password_reset', { p_user_id: GOOGLE_ONLY });
  assert.deepEqual(answer.data, { email: 'marina@example.com', addsPassword: true });
  const token = new URL(outbox[0].link).pathname.split('/').pop()!;
  const reset = await worker.fetch(null, 'POST', '/auth/reset-password', { body: JSON.stringify({ newPassword: 'a password of her own', token }), headers: { 'content-type': 'application/json' } });
  assert.equal(reset.status, 200, await reset.text());
  assert.equal((await signIn('marina@example.com', 'a password of her own')).status, 200);
  assert.deepEqual((await list({ p_search: 'marina' }))[0].signInMethods, ['google', 'password']);
});

test('an unconfirmed email: its confirmation sent again, or marked confirmed; a confirmed one is refused', async () => {
  outbox.length = 0;
  assert.equal((await signIn('kyrillos@example.com')).status, 403, 'not confirmed yet');
  const resent = await worker.rpc(ADMIN, 'admin_resend_confirmation', { p_user_id: UNCONFIRMED });
  assert.deepEqual(resent.data, { email: 'kyrillos@example.com' });
  assert.deepEqual([outbox.length, outbox[0]?.to, outbox[0]?.subject], [1, 'kyrillos@example.com', 'Confirm your email for Coptic Vine']);
  assert.equal(new URL(outbox[0].link).searchParams.get('callbackURL'), ACCOUNT_PAGE);

  const marked = await worker.rpc(ADMIN, 'admin_mark_email_confirmed', { p_user_id: UNCONFIRMED });
  assert.deepEqual(marked.data, { email: 'kyrillos@example.com', alreadyConfirmed: false });
  assert.deepEqual(worker.rows('SELECT "email_verified" FROM "auth.users" WHERE "id" = ?', UNCONFIRMED), [{ email_verified: 1 }]);
  assert.equal(sessions(UNCONFIRMED), 0, 'marking signs nobody in');
  assert.equal((await signIn('kyrillos@example.com')).status, 200);
  assert.deepEqual((await worker.rpc(ADMIN, 'admin_mark_email_confirmed', { p_user_id: UNCONFIRMED })).data, { email: 'kyrillos@example.com', alreadyConfirmed: true });

  const again = await worker.rpc(ADMIN, 'admin_resend_confirmation', { p_user_id: UNCONFIRMED });
  assert.deepEqual([again.error?.code, again.error?.message], ['22023', 'Email is already confirmed']);
  assert.equal(outbox.length, 1);
});

test('signed out everywhere: every session of that account ends, and only that account\'s', async () => {
  assert.equal(sessions(READER), 2);
  const adminSessions = sessions(ADMIN);
  const answer = await worker.rpc(ADMIN, 'admin_sign_out_everywhere', { p_user_id: READER });
  assert.deepEqual(answer.data, { email: 'reader@example.com', sessionsEnded: 2 });
  assert.equal(sessions(READER), 0);
  assert.equal(sessions(ADMIN), adminSessions);
  const session = await worker.fetch(READER, 'GET', '/auth/get-session');
  assert.equal(await session.json(), null, 'the reader\'s token no longer signs in');
  assert.deepEqual((await list({ p_search: 'reader' }))[0].activeSessions, 0);
});
