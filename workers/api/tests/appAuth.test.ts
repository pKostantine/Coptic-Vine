/**
 * Coptic Vine's sign-in client for cv-api (src/services/cvApiAuth.ts in the
 * app) driven against this Worker, as the phone and as the web drive it: the
 * requests it sends, the links from the emails and Google that come back to
 * the app, and the user it hands the screens. Better Auth runs on the real
 * sign-in tables in SQLite, with the emails kept in the outbox.
 */
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import bcrypt from 'bcryptjs';
import { createCvApiAuth, sessionTokenFromCookie, type CvApiAuthOptions } from '../../../src/services/cvApiAuth.ts';
import type { AccountEvent } from '../../../src/types/account.ts';
import { outbox } from '../src/auth/email.ts';
import { handle } from '../src/index.ts';
import type { Env } from '../src/types.ts';
import { authDatabase } from './lib/d1.ts';

const BASE = 'http://localhost:8790';
const WEB = 'http://localhost:8081';
const APP_LINK = 'copticvine://account';
const WEB_LINK = `${WEB}/account`;
const USER = '0b6f3a52-1c3e-4c1f-9d7e-2f1a2b3c4d5e';
const STAMP = '2026-09-01T10:00:00.123456+00:00';

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
    TRUSTED_ORIGINS: `${WEB},copticvine://`,
    EMAIL_MODE: 'outbox',
    GOOGLE_CLIENT_ID: 'test-client.apps.googleusercontent.com',
    GOOGLE_CLIENT_SECRET: 'a-test-google-secret',
  };
  outbox.length = 0;
  // A user carried over from Supabase (scripts/import.ts): its id, its bcrypt hash, a 'credential' account.
  db.prepare('INSERT INTO "auth.users" ("id", "name", "email", "email_verified", "created_at", "updated_at", "raw_user_meta_data") VALUES (?, ?, ?, 1, ?, ?, ?)')
    .run(USER, 'Carried Over', 'reader@example.com', STAMP, STAMP, '{"full_name": "Carried Over"}');
  db.prepare('INSERT INTO "auth.accounts" ("id", "user_id", "account_id", "provider_id", "password", "created_at", "updated_at") VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run('acc-1', USER, USER, 'credential', bcrypt.hashSync('old password 1', 4), STAMP, STAMP);
});

/** The Worker as fetch, each request from its own address (the rate limiter counts per address). */
function worker(extra: (headers: Headers, init?: RequestInit) => void = () => {}): typeof fetch {
  return async (input, init) => {
    const headers = new Headers(init?.headers);
    ip += 1;
    headers.set('cf-connecting-ip', `198.51.100.${ip % 250}`);
    extra(headers, init);
    return handle(new Request(String(input), { ...init, headers }), env);
  };
}

/** Storage as expo-sqlite's localStorage holds it. */
function memoryStorage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  };
}

/** The client as a phone runs it: a bearer token, the app's scheme for its links. */
function phone(overrides: Partial<CvApiAuthOptions> = {}) {
  const storage = memoryStorage();
  const events: AccountEvent[] = [];
  const opened: string[] = [];
  const auth = createCvApiAuth({
    baseUrl: BASE,
    native: true,
    appOrigin: 'copticvine://',
    callbackPath: 'account',
    storage: () => storage,
    fetch: worker(),
    openAuthSession: async (url) => {
      opened.push(url);
      return { type: 'cancel' };
    },
    message: (key) => key,
    ...overrides,
  });
  auth.onChange((event) => events.push(event));
  return { auth, storage, events, opened };
}

/** An email's link, opened in the phone's browser: where it sends the browser. */
async function openLink(link: string, headers: Record<string, string> = {}): Promise<string> {
  const url = new URL(link);
  const response = await handle(new Request(`${BASE}${url.pathname}${url.search}`, { headers, redirect: 'manual' }), env);
  assert.equal(response.status, 302, `${url.pathname} answered ${response.status}`);
  return response.headers.get('location')!;
}

const lastEmailTo = (to: string) => [...outbox].reverse().find((email) => email.to === to)!;

/** Whom the server sees behind a bearer token. */
async function serverUser(token: string | null): Promise<string | null> {
  const response = await handle(new Request(`${BASE}/auth/get-session`, { headers: { authorization: `Bearer ${token}` } }), env);
  return ((await response.json()) as { user?: { id: string } } | null)?.user?.id ?? null;
}

test('a carried-over user signs in on a phone: a bearer token, and the user in Supabase\'s shape', async () => {
  const { auth, storage, events } = phone();
  assert.equal(await auth.getSession(), null, 'signed out, without asking the server');
  await assert.rejects(auth.signInWithEmail('reader@example.com', 'wrong password'), /Invalid email or password/);

  await auth.signInWithEmail('reader@example.com', 'old password 1');
  assert.deepEqual(events, ['SIGNED_IN']);
  const session = await auth.getSession();
  assert.deepEqual(session?.user, {
    id: USER,
    email: 'reader@example.com',
    email_confirmed_at: session?.user.email_confirmed_at,
    user_metadata: { full_name: 'Carried Over', chc_avatar_url: null, avatar_url: null },
    app_metadata: { provider: 'email', providers: ['email'] },
  });
  assert.ok(session?.user.email_confirmed_at, 'confirmed');
  assert.equal(auth.canChangePassword(session!.user), true);

  // The data requests carry the same token (supabase-js's accessToken), and the server knows it.
  const token = await auth.accessToken();
  assert.equal(token, storage.values.get('cv-api.session-token'));
  assert.equal(await serverUser(token), USER);
});

test('the phone opens signed in from storage, without the network, and the server is asked behind it', async () => {
  const first = phone();
  await first.auth.signInWithEmail('reader@example.com', 'old password 1');

  // The app opened again, offline.
  const offline = createCvApiAuth({
    baseUrl: BASE, native: true, appOrigin: 'copticvine://', callbackPath: 'account', storage: () => first.storage,
    fetch: async () => { throw new TypeError('Network request failed'); }, message: (key) => key,
  });
  assert.equal((await offline.getSession())?.user.id, USER);
  assert.equal((await offline.refresh())?.user.id, USER, 'still signed in: the server was not reached');

  // Online, with the session gone from the server: signed out once it is checked.
  db.prepare('DELETE FROM "auth.sessions"').run();
  const online = phone({ storage: () => first.storage });
  assert.equal((await online.auth.getSession())?.user.id, USER, 'what storage holds, at once');
  assert.equal(await online.auth.refresh(), null);
  assert.deepEqual(online.events, ['SIGNED_OUT']);
  assert.equal(first.storage.values.get('cv-api.session-token'), undefined);
  assert.equal(first.storage.values.get('cv-api.session'), undefined);
});

test('sign-up on a phone: the confirmation link comes back to the app and signs it in', async () => {
  const { auth, events } = phone();
  assert.deepEqual(await auth.signUpWithEmail('new@example.com', 'a new password', ' New Reader ', APP_LINK), { confirmationRequired: true });
  assert.equal(await auth.getSession(), null);

  await auth.resendSignupConfirmation('new@example.com', APP_LINK);
  const back = await openLink(lastEmailTo('new@example.com').link);
  assert.match(back, /^copticvine:\/\/account\?cookie=/, 'the session, in the link back (the Expo plugin)');

  await auth.applyCallback(back);
  const session = await auth.getSession();
  assert.equal(session?.user.email, 'new@example.com');
  assert.equal(session?.user.user_metadata.full_name, 'New Reader');
  assert.ok(session?.user.email_confirmed_at);
  assert.deepEqual(events, ['SIGNED_IN']);
  assert.equal(await serverUser(await auth.accessToken()), session?.user.id);
});

test('a password reset link comes back to the app signed out; the new password is set there', async () => {
  const { auth, events } = phone();
  await auth.sendPasswordReset('reader@example.com', APP_LINK);
  const back = await openLink(lastEmailTo('reader@example.com').link);
  assert.match(back, /^copticvine:\/\/account\?token=/);

  await auth.applyCallback(back);
  assert.deepEqual(events, ['PASSWORD_RECOVERY']);
  assert.equal(await auth.getSession(), null);
  await auth.updatePassword('a brand new password');

  await assert.rejects(auth.signInWithEmail('reader@example.com', 'old password 1'), /Invalid email or password/);
  await auth.signInWithEmail('reader@example.com', 'a brand new password');
  assert.equal((await auth.getSession())?.user.id, USER);

  // The same link a second time.
  await assert.rejects(auth.applyCallback(await openLink(lastEmailTo('reader@example.com').link)), /linkExpired/);
});

test('reset while signed in: the reset ends every session, and this device signs in again with the new password', async () => {
  const { auth, events } = phone();
  await auth.signInWithEmail('reader@example.com', 'old password 1');
  const before = await auth.accessToken();
  await auth.sendPasswordReset('reader@example.com', APP_LINK);
  await auth.applyCallback(await openLink(lastEmailTo('reader@example.com').link));
  await auth.updatePassword('a brand new password');

  assert.equal(await serverUser(before), null, 'the old session is gone');
  assert.equal(await serverUser(await auth.accessToken()), USER, 'and this device holds a new one');
  assert.deepEqual(events, ['SIGNED_IN', 'PASSWORD_RECOVERY'], 'without signing out in between');
});

test('changing the password needs the current one', async () => {
  const { auth } = phone();
  await auth.signInWithEmail('reader@example.com', 'old password 1');
  assert.equal(auth.needsCurrentPassword, true);
  await assert.rejects(auth.updatePassword('another password'), /currentPasswordRequired/);
  await assert.rejects(auth.updatePassword('another password', 'not it'), /Invalid password/);
  await auth.updatePassword('another password', 'old password 1');
  await auth.signOut();
  await auth.signInWithEmail('reader@example.com', 'another password');
});

test('the name and photo: an upload to cv-api is the user\'s own photo, anything else is Google\'s', async () => {
  const { auth, events } = phone();
  await auth.signInWithEmail('reader@example.com', 'old password 1');
  await auth.updateDisplayName('  New Name ');
  const own = `${BASE}/storage/v1/object/public/profile-avatars/${USER}/avatar?v=1`;
  await auth.updateAvatarUrl(own);
  let user = (await auth.getSession())!.user;
  assert.equal(user.user_metadata.full_name, 'New Name');
  assert.deepEqual([user.user_metadata.chc_avatar_url, user.user_metadata.avatar_url], [own, null]);
  assert.deepEqual(events, ['SIGNED_IN', 'USER_UPDATED', 'USER_UPDATED']);

  await auth.updateAvatarUrl(null);
  user = (await auth.getSession())!.user;
  assert.deepEqual([user.user_metadata.chc_avatar_url, user.user_metadata.avatar_url], [null, null]);
  db.prepare('UPDATE "auth.users" SET "image" = ? WHERE "id" = ?').run('https://lh3.googleusercontent.com/a/photo', USER);
  user = (await auth.refresh())!.user;
  assert.deepEqual([user.user_metadata.chc_avatar_url, user.user_metadata.avatar_url], [null, 'https://lh3.googleusercontent.com/a/photo']);
});

test('changing the email: approved from the old address, confirmed at the new one, whose link brings the app the new address', async () => {
  const { auth } = phone();
  await auth.signInWithEmail('reader@example.com', 'old password 1');
  await auth.updateEmail(' Moved@Example.com ', APP_LINK);

  // Opened in the phone's browser, which has no session of the app's.
  assert.equal(await openLink(lastEmailTo('reader@example.com').link), APP_LINK);
  const back = await openLink(lastEmailTo('moved@example.com').link);
  await auth.applyCallback(back);
  assert.equal((await auth.getSession())?.user.email, 'moved@example.com');
});

test('signing out: the token is dropped and the server ends the session; with no connection, the device is signed out all the same', async () => {
  const { auth, storage, events } = phone();
  await auth.signInWithEmail('reader@example.com', 'old password 1');
  const token = await auth.accessToken();
  await auth.signOut();
  assert.equal(await serverUser(token), null);
  assert.equal(await auth.getSession(), null);
  assert.equal(storage.values.size, 0);
  assert.deepEqual(events, ['SIGNED_IN', 'SIGNED_OUT']);

  let online = true;
  const send = worker();
  const flaky = phone({ fetch: async (input, init) => { if (!online) throw new TypeError('Network request failed'); return send(input, init); } });
  await flaky.auth.signInWithEmail('reader@example.com', 'old password 1');
  online = false;
  await flaky.auth.signOut();
  assert.equal(await flaky.auth.getSession(), null);
});

test('Google on a phone: through the Expo plugin\'s proxy, which leaves the sign-in\'s state in the browser', async () => {
  const { auth, opened } = phone();
  await auth.signInWithGoogle(APP_LINK);
  assert.equal(opened.length, 1);
  const proxy = new URL(opened[0]);
  assert.equal(`${proxy.origin}${proxy.pathname}`, `${BASE}/auth/expo-authorization-proxy`);
  const google = new URL(proxy.searchParams.get('authorizationURL')!);
  assert.equal(google.host, 'accounts.google.com');
  assert.equal(google.searchParams.get('redirect_uri'), `${BASE}/auth/callback/google`);

  const response = await handle(new Request(opened[0], { redirect: 'manual' }), env);
  assert.equal(response.status, 302);
  assert.equal(new URL(response.headers.get('location')!).host, 'accounts.google.com');
  assert.match(response.headers.get('set-cookie') ?? '', /better-auth\.state=/);
  assert.equal(await auth.getSession(), null, 'closed before finishing: still signed out');

  // Google's refusal, as Better Auth sends it back.
  const refused = phone({ openAuthSession: async () => ({ type: 'success', url: `${APP_LINK}?error=access_denied&error_description=The+user+said+no` }) });
  await assert.rejects(refused.auth.signInWithGoogle(APP_LINK), /The user said no/);
  // Google finished: the link back holds the session.
  const signedIn = await handle(new Request(`${BASE}/auth/sign-in/email`, { method: 'POST', headers: { 'content-type': 'application/json', origin: WEB }, body: JSON.stringify({ email: 'reader@example.com', password: 'old password 1' }) }), env);
  const done = phone({ openAuthSession: async () => ({ type: 'success', url: `${APP_LINK}?cookie=${encodeURIComponent(signedIn.headers.get('set-cookie')!)}` }) });
  await done.auth.signInWithGoogle(APP_LINK);
  assert.equal((await done.auth.getSession())?.user.id, USER);
});

test('links for elsewhere in the app are left alone', async () => {
  const { auth, events } = phone();
  await auth.applyCallback('copticvine://music/release/1?token=abc');
  await auth.applyCallback('https://copticvine.ca/learn?error=x');
  await auth.applyCallback(APP_LINK);
  assert.deepEqual(events, []);
});

test('the session token is read from Set-Cookie, with or without the __Secure- prefix', () => {
  assert.equal(sessionTokenFromCookie('__Secure-better-auth.session_token=abc.d%2Bef; Max-Age=2592000; Path=/; HttpOnly; Secure; SameSite=Lax'), 'abc.d%2Bef');
  assert.equal(sessionTokenFromCookie('better-auth.state=xyz; Path=/, better-auth.session_token=tok.sig; Path=/'), 'tok.sig');
  assert.equal(sessionTokenFromCookie('better-auth.state=xyz; Path=/'), null);
});

/** The web: a browser's cookie jar for cv-api, sent with requests made with credentials, and the page's origin. */
function browser() {
  const jar = new Map<string, string>();
  const send = worker((headers, init) => {
    headers.set('origin', WEB);
    if (init?.credentials === 'include' && jar.size) headers.set('cookie', [...jar].map(([name, value]) => `${name}=${value}`).join('; '));
  });
  const fetcher: typeof fetch = async (input, init) => {
    const response = await send(input, init);
    if (init?.credentials === 'include') {
      for (const line of response.headers.getSetCookie()) {
        const [pair, ...attributes] = line.split(';');
        const name = pair.slice(0, pair.indexOf('='));
        const value = pair.slice(pair.indexOf('=') + 1);
        if (!value || attributes.some((attribute) => /^\s*max-age=0$/i.test(attribute))) jar.delete(name);
        else jar.set(name, value);
      }
    }
    return response;
  };
  return { jar, fetcher };
}

test('the web keeps cv-api\'s cookie, never a token, and the data requests carry it', async () => {
  const { jar, fetcher } = browser();
  const storage = memoryStorage();
  const navigated: string[] = [];
  const replaced: string[] = [];
  const auth = createCvApiAuth({
    baseUrl: BASE, native: false, appOrigin: '', callbackPath: 'account', storage: () => storage, fetch: fetcher,
    navigate: (url) => navigated.push(url), replaceUrl: (url) => replaced.push(url), message: (key) => key,
  });
  assert.equal(await auth.getSession(), null, 'asked the server: the cookie could be there');
  await auth.signInWithEmail('reader@example.com', 'old password 1');
  assert.ok([...jar.keys()].includes('better-auth.session_token'));
  assert.equal(await auth.accessToken(), null);
  assert.equal(storage.values.get('cv-api.session-token'), undefined);
  assert.equal((await auth.getSession())?.user.id, USER);

  // supabase-js's fetch: the cookie goes with it.
  const data = await auth.fetch(`${BASE}/auth/get-session`, {});
  assert.equal(((await data.json()) as { user: { id: string } }).user.id, USER);

  await auth.updateDisplayName('Web Name');
  assert.equal((await auth.getSession())?.user.user_metadata.full_name, 'Web Name');

  // A reset link opens the account page with its token; the page's address loses it once read.
  await auth.sendPasswordReset('reader@example.com', WEB_LINK);
  const back = await openLink(lastEmailTo('reader@example.com').link);
  await auth.applyCallback(back);
  assert.deepEqual(replaced, [WEB_LINK]);

  await auth.signOut();
  assert.equal(jar.has('better-auth.session_token'), false);
  assert.equal(await auth.getSession(), null);

  // Google: the page itself goes there, and comes back with the cookie.
  await auth.signInWithGoogle(WEB_LINK);
  assert.equal(new URL(navigated[0]).host, 'accounts.google.com');
});

test('a phone sends the app\'s scheme as its origin, so its links are checked against the trusted ones', async () => {
  const seen: Headers[] = [];
  const send = worker();
  const { auth } = phone({ fetch: async (input, init) => { seen.push(new Headers(init?.headers)); return send(input, init); } });
  await auth.sendPasswordReset('reader@example.com', APP_LINK);
  assert.equal(seen[0].get('expo-origin'), 'copticvine://');
  await assert.rejects(auth.sendPasswordReset('reader@example.com', 'evilapp://account'), /Invalid redirectURL/);
});
