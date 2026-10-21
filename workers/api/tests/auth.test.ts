/**
 * Sign-in end to end (src/auth and src/index.ts): Better Auth running on the
 * real sign-in tables in SQLite, driven through the Worker's fetch handler
 * the way the apps will call it, with emails kept in the outbox.
 */
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import bcrypt from 'bcryptjs';
import { outbox } from '../src/auth/email.ts';
import { handle } from '../src/index.ts';
import type { Env } from '../src/types.ts';
import { authDatabase } from './lib/d1.ts';

const BASE = 'http://localhost:8790';
const APP = 'http://localhost:8081';
const SUPABASE_USER = '0b6f3a52-1c3e-4c1f-9d7e-2f1a2b3c4d5e';
const STAMP = '2026-09-01T10:00:00.123456+00:00';
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?\+00:00$/;

let env: Env;
let db: ReturnType<typeof authDatabase>['db'];
let ip = 0;

beforeEach(() => {
  const fresh = authDatabase();
  db = fresh.db;
  env = {
    DB: fresh.binding,
    BETTER_AUTH_URL: BASE,
    BETTER_AUTH_SECRET: 'a-test-secret-that-is-long-enough-0123456789',
    EMAIL_FROM: 'no-reply@copticvine.ca',
    TRUSTED_ORIGINS: `${APP},copticvine://`,
    EMAIL_MODE: 'outbox',
  };
  outbox.length = 0;
  // A user carried over from Supabase: its id, its bcrypt hash, a 'credential' account (scripts/import.ts).
  db.prepare('INSERT INTO "auth.users" ("id", "name", "email", "email_verified", "created_at", "updated_at", "raw_user_meta_data") VALUES (?, ?, ?, 1, ?, ?, ?)')
    .run(SUPABASE_USER, 'Carried Over', 'reader@example.com', STAMP, STAMP, '{"full_name": "Carried Over"}');
  db.prepare('INSERT INTO "auth.accounts" ("id", "user_id", "account_id", "provider_id", "password", "created_at", "updated_at") VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run('acc-1', SUPABASE_USER, SUPABASE_USER, 'credential', bcrypt.hashSync('old password 1', 4), STAMP, STAMP);
});

/** A request as a browser on the app's origin sends it, from its own address (the rate limiter counts per address). */
async function call(path: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<Response> {
  ip += 1;
  const headers: Record<string, string> = { origin: APP, 'cf-connecting-ip': `203.0.113.${ip % 250}`, ...init.headers };
  if (init.body !== undefined) headers['content-type'] = 'application/json';
  return handle(new Request(`${BASE}${path}`, { method: init.method ?? (init.body === undefined ? 'GET' : 'POST'), headers, body: init.body === undefined ? undefined : JSON.stringify(init.body), redirect: 'manual' }), env);
}

const signIn = (email: string, password: string) => call('/auth/sign-in/email', { body: { email, password } });
const bearer = (response: Response) => ({ authorization: `Bearer ${response.headers.get('set-auth-token')}` });

test('a user carried over from Supabase signs in with their old password, keeping their id', async () => {
  assert.equal((await signIn('reader@example.com', 'wrong password')).status, 401);
  const response = await signIn('Reader@Example.com', 'old password 1');
  assert.equal(response.status, 200);
  const body = await response.json() as { user: { id: string; name: string } };
  assert.equal(body.user.id, SUPABASE_USER);
  assert.equal(body.user.name, 'Carried Over');

  const session = await call('/auth/get-session', { headers: bearer(response) });
  assert.equal((await session.json() as { user: { id: string } }).user.id, SUPABASE_USER);

  const stored = db.prepare('SELECT * FROM "auth.sessions"').get() as Record<string, string>;
  assert.equal(stored.user_id, SUPABASE_USER);
  for (const column of ['expires_at', 'created_at', 'updated_at']) assert.match(stored[column], TIMESTAMP, column);
});

test('sign-up needs the emailed confirmation, then signs in; the new id is a UUID', async () => {
  const signUp = await call('/auth/sign-up/email', { body: { email: 'new@example.com', password: 'a new password', name: 'New Reader', callbackURL: `${APP}/account` } });
  assert.equal(signUp.status, 200);
  assert.equal(outbox.length, 1);
  assert.equal(outbox[0].to, 'new@example.com');
  assert.match(outbox[0].subject, /Confirm your email/);
  assert.equal((await signIn('new@example.com', 'a new password')).status, 403, 'not confirmed yet');

  const verify = await call(new URL(outbox[0].link).pathname + new URL(outbox[0].link).search);
  assert.equal(verify.status, 302);
  assert.equal(verify.headers.get('location'), `${APP}/account`);

  const response = await signIn('new@example.com', 'a new password');
  assert.equal(response.status, 200);
  const user = db.prepare('SELECT * FROM "auth.users" WHERE "email" = ?').get('new@example.com') as Record<string, unknown>;
  assert.match(String(user.id), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(user.email_verified, 1);
  assert.equal(user.raw_user_meta_data, '{}');
  assert.match(String(user.created_at), TIMESTAMP);
  const account = db.prepare('SELECT "password" FROM "auth.accounts" WHERE "user_id" = ?').get(String(user.id)) as { password: string };
  assert.doesNotMatch(account.password, /^\$2/, 'new passwords get Better Auth\'s hash, not bcrypt');
});

test('a password reset by email replaces the bcrypt hash and ends the old sessions', async () => {
  const before = await signIn('reader@example.com', 'old password 1');
  assert.equal((await call('/auth/request-password-reset', { body: { email: 'reader@example.com', redirectTo: `${APP}/account/reset` } })).status, 200);
  assert.equal(outbox.length, 1);
  assert.match(outbox[0].subject, /Reset your Coptic Vine password/);

  const link = new URL(outbox[0].link);
  const opened = await call(link.pathname + link.search);
  assert.equal(opened.status, 302);
  const back = new URL(opened.headers.get('location')!);
  assert.equal(`${back.origin}${back.pathname}`, `${APP}/account/reset`);
  const token = back.searchParams.get('token')!;
  assert.ok(token);

  assert.equal((await call('/auth/reset-password', { body: { newPassword: 'a brand new password', token } })).status, 200);
  assert.equal((await signIn('reader@example.com', 'old password 1')).status, 401);
  assert.equal((await signIn('reader@example.com', 'a brand new password')).status, 200);
  const session = await call('/auth/get-session', { headers: bearer(before) });
  assert.equal(await session.json(), null, 'sessions from before the reset are gone');
});

test('changing the password needs the current one', async () => {
  const session = await signIn('reader@example.com', 'old password 1');
  assert.equal((await call('/auth/change-password', { body: { currentPassword: 'not it', newPassword: 'another password' }, headers: bearer(session) })).status, 400);
  assert.equal((await call('/auth/change-password', { body: { currentPassword: 'old password 1', newPassword: 'another password' }, headers: bearer(session) })).status, 200);
  assert.equal((await signIn('reader@example.com', 'another password')).status, 200);
});

test('changing the email is approved from the old address, then confirmed at the new one', async () => {
  const session = await signIn('reader@example.com', 'old password 1');
  assert.equal((await call('/auth/change-email', { body: { newEmail: 'moved@example.com', callbackURL: `${APP}/account` }, headers: bearer(session) })).status, 200);
  assert.equal(outbox.length, 1);
  assert.equal(outbox[0].to, 'reader@example.com');
  assert.match(outbox[0].text, /moved@example\.com/);

  const approve = new URL(outbox[0].link);
  assert.equal((await call(approve.pathname + approve.search, { headers: bearer(session) })).status, 302);
  const confirm = outbox.find((email) => email.to === 'moved@example.com');
  assert.ok(confirm, 'the new address gets its confirmation');
  const link = new URL(confirm.link);
  assert.equal((await call(link.pathname + link.search, { headers: bearer(session) })).status, 302);
  const user = db.prepare('SELECT "email" FROM "auth.users" WHERE "id" = ?').get(SUPABASE_USER) as { email: string };
  assert.equal(user.email, 'moved@example.com');
});

test('the name and photo are updated on the user', async () => {
  const session = await signIn('reader@example.com', 'old password 1');
  assert.equal((await call('/auth/update-user', { body: { name: 'New Name', image: 'https://media.copticvine.ca/avatar.png' }, headers: bearer(session) })).status, 200);
  const user = db.prepare('SELECT "name", "image", "updated_at" FROM "auth.users" WHERE "id" = ?').get(SUPABASE_USER) as Record<string, string>;
  assert.deepEqual({ name: user.name, image: user.image }, { name: 'New Name', image: 'https://media.copticvine.ca/avatar.png' });
  assert.match(user.updated_at, TIMESTAMP);
  assert.notEqual(user.updated_at, STAMP);
});

test('browsers get CORS only from the trusted web origins', async () => {
  const allowed = await call('/auth/get-session', { method: 'OPTIONS' });
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get('access-control-allow-origin'), APP);
  assert.equal(allowed.headers.get('access-control-allow-credentials'), 'true');
  assert.match(allowed.headers.get('access-control-expose-headers') ?? '', /set-auth-token/);
  const other = await call('/auth/get-session', { method: 'OPTIONS', headers: { origin: 'https://evil.example' } });
  assert.equal(other.headers.get('access-control-allow-origin'), null);
  assert.equal((await call('/auth/sign-in/email', { body: { email: 'reader@example.com', password: 'old password 1' }, headers: { origin: 'https://evil.example' } })).status, 403, 'and sign-in refuses an untrusted origin');
});

test('sign-in attempts are rate limited per address', async () => {
  const statuses: number[] = [];
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const response = await handle(new Request(`${BASE}/auth/sign-in/email`, {
      method: 'POST', headers: { origin: APP, 'content-type': 'application/json', 'cf-connecting-ip': '198.51.100.7' },
      body: JSON.stringify({ email: 'reader@example.com', password: 'wrong' }),
    }), env);
    statuses.push(response.status);
  }
  assert.ok(statuses.includes(429), `got ${statuses.join(', ')}`);
  assert.ok((db.prepare('SELECT count(*) AS n FROM "auth.rate_limits"').get() as { n: number }).n > 0);
});
