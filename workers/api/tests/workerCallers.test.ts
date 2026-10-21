/**
 * The other Workers' calls, with exactly the headers each sends once its
 * SUPABASE_URL points here (docs/d1/phase2-runbook.md, "The other Workers"):
 *
 *   notification-dispatcher  apikey and bearer: its SUPABASE_SERVICE_ROLE_KEY,
 *                            which is cv-api's SERVICE_TOKEN: the service
 *   media-processor          the publishable key as apikey (the container, the
 *                            queue check), or as the bearer too: signed out,
 *                            as its functions are granted to anon and check the
 *                            worker token they are given
 *   admin server, upload     the publishable key, and the user's cv-api session
 *   authorizer               handed on as the bearer: that user
 *
 * A bearer that isn't a session token (src/auth/index.ts, sessionHeaders) is
 * set aside only when the session is read, after the service token is checked.
 */
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { before, test } from 'node:test';
import { handle } from '../src/index.ts';
import { BASE, WorkerSide } from './lib/worker.ts';

const ADMIN = '5e0c9a7b-3d2f-4e1a-9b8c-7d6e5f4a3b2c';
const PUBLISHABLE = 'sb_publishable_AbCdEf0123456789_xyz';
const LEGACY_ANON = 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.c2lnbmF0dXJl';
const MEDIA_WORKER_TOKEN = 'a-media-worker-secret';

let worker: WorkerSide;

before(async () => {
  worker = new WorkerSide();
  // As the runbook makes it (openssl rand -base64 32): no dot, not a session token's shape either.
  worker.env.SERVICE_TOKEN = randomBytes(32).toString('base64');
  await worker.addUser(ADMIN, 'admin@example.com');
  worker.db.prepare(`INSERT INTO "creator.user_roles" ("user_id", "role") VALUES (?, 'admin')`).run(ADMIN);
  worker.db.prepare(`INSERT INTO "private.media_worker_tokens" ("name", "token_hash") VALUES ('processor', ?)`).run(createHash('sha256').update(MEDIA_WORKER_TOKEN).digest('hex'));
});

/** An RPC as a Worker sends it: server to server, no origin, the profile named. */
async function rpc(name: string, args: unknown, headers: Record<string, string>): Promise<{ status: number; body: unknown }> {
  const response = await handle(new Request(`${BASE}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { 'accept-profile': 'public', 'content-profile': 'public', 'content-type': 'application/json', ...headers },
    body: JSON.stringify(args),
  }), worker.env);
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

test('the notification dispatcher: its service key as apikey and bearer is the service', async () => {
  const key = worker.env.SERVICE_TOKEN!;
  assert.deepEqual(await rpc('claim_notification_deliveries', { p_limit: 100 }, { apikey: key, authorization: `Bearer ${key}` }), { status: 200, body: [] });
  // Anything else isn't: the functions are the service's alone.
  for (const headers of [{ apikey: PUBLISHABLE, authorization: `Bearer ${PUBLISHABLE}` }, { apikey: key }] as Record<string, string>[]) {
    const refused = await rpc('claim_notification_deliveries', { p_limit: 100 }, headers);
    assert.notEqual(refused.status, 200);
    assert.equal((refused.body as { code: string }).code, '42501');
  }
});

test('the media processor: the publishable key, alone or as the bearer, is signed out, and its functions answer it', async () => {
  for (const headers of [{ apikey: PUBLISHABLE }, { apikey: PUBLISHABLE, authorization: `Bearer ${PUBLISHABLE}` }, { apikey: LEGACY_ANON, authorization: `Bearer ${LEGACY_ANON}` }] as Record<string, string>[]) {
    assert.deepEqual(await rpc('media_processing_queue_has_work', { p_worker_token: MEDIA_WORKER_TOKEN }, headers), { status: 200, body: false }, JSON.stringify(headers));
    const wrong = await rpc('media_processing_queue_has_work', { p_worker_token: 'not-the-token' }, headers);
    assert.equal((wrong.body as { message: string }).message, 'Invalid media worker token', 'refused by the worker token, not the bearer');
  }
});

test('the admin server and the upload authorizer: the user\'s cv-api session, handed on, is that user', async () => {
  // The signed token the apps keep (set-auth-token), as worker.fetch sends it.
  const signed = await worker.fetch(ADMIN, 'POST', '/rest/v1/rpc/is_chc_admin', { body: '{}', headers: { apikey: PUBLISHABLE, 'content-profile': 'public', 'content-type': 'application/json' } });
  assert.deepEqual([signed.status, await signed.json()], [200, true]);
  // The bare token the web keeps once back from Google (CV-Admin, CV-Artists).
  const session = (await (await worker.fetch(ADMIN, 'GET', '/auth/get-session')).json()) as { session: { token: string } };
  assert.match(session.session.token, /^[A-Za-z0-9]{32}$/);
  assert.deepEqual(await rpc('is_chc_admin', {}, { apikey: PUBLISHABLE, authorization: `Bearer ${session.session.token}` }), { status: 200, body: true });
  // The publishable key as the bearer is nobody: the function is for signed-in users.
  assert.equal(((await rpc('is_chc_admin', {}, { apikey: PUBLISHABLE, authorization: `Bearer ${PUBLISHABLE}` })).body as { code: string }).code, '42501');
});
