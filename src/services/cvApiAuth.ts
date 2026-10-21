/**
 * Signing in to cv-api (workers/api: Better Auth on D1) from Coptic Vine, when
 * EXPO_PUBLIC_USER_DATA_SOURCE=cloudflare (src/services/userApi.ts). It calls
 * Better Auth's /auth endpoints with fetch, as Better Auth's own Expo client
 * would, and hands the user out in Supabase's shape (src/types/account.ts).
 * CV-Admin and CV-Artists keep a copy of this file, which stays the same.
 *
 *   phone and tablet  the session token is kept in storage and sent as a
 *                     bearer token. The links that sign in outside the app
 *                     (an email's confirmation, Google's sign-in) come back to
 *                     the app's scheme with the session cookie in their
 *                     `cookie` parameter (Better Auth's Expo plugin, on the
 *                     server). One is taken only within two hours of this
 *                     device starting such a sign-in, and never in place of
 *                     another account's session.
 *   web               the session is api.copticvine.ca's cookie, same-site
 *                     with copticvine.ca: every request is sent with
 *                     credentials, and the app never sees the token.
 *   web, with bearer  as a phone, a bearer token too, for apps that hand the
 *                     session to other Workers (CV-Admin's media routes,
 *                     CV-Artists' uploads): the sign-in's token, or, back
 *                     from Google with the cookie, the cookie's session's.
 *
 * The session is kept with its user, so the app opens signed in without the
 * network. It is checked with the server when the app starts and when it
 * comes back to the foreground, and dropped once the server no longer knows it.
 *
 * It imports nothing of the app's, so cv-api's tests drive it against the
 * Worker itself (workers/api/tests/appAuth.test.ts).
 */
import type { AccountAuth, AccountEvent, AccountSession, AccountUser } from '../types/account';

type KeyValueStorage = { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void };

/** The failures' messages it needs (src/utils/authMessages.ts). */
export type CvApiMessage =
  | 'finishSignIn' | 'signIn' | 'createAccount' | 'startGoogle' | 'googleNoUrl' | 'googleIncomplete' | 'googleNotEnabled'
  | 'passwordReset' | 'resendConfirmation' | 'updateProfile' | 'updateEmail' | 'updatePhoto' | 'updatePassword'
  | 'currentPasswordRequired' | 'linkExpired' | 'signOut';

export type CvApiAuthOptions = {
  /** cv-api's address: https://api.copticvine.ca. */
  baseUrl: string;
  /** A phone or tablet, which keeps a bearer token; otherwise the web, which keeps the cookie. */
  native: boolean;
  /** The web keeps a bearer token too (a phone always does). */
  bearer?: boolean;
  /** A phone: the app's own address (copticvine://), sent as expo-origin so the server checks the app's links against it. */
  appOrigin: string;
  /** The path the links come back to (account); without one, links to any page are read. */
  callbackPath?: string;
  storage: () => KeyValueStorage | null | undefined;
  fetch?: typeof fetch;
  /** A phone: opens Google's sign-in in the browser, and tells where the browser came back to. */
  openAuthSession?: (url: string, returnUrl: string) => Promise<{ type: string; url?: string }>;
  /** The web: goes to Google's sign-in page. */
  navigate?: (url: string) => void;
  /** The web: shows the address without the link's parameters, once read. */
  replaceUrl?: (url: string) => void;
  message: (key: CvApiMessage) => string;
};

export type CvApiAuth = AccountAuth & {
  /** The bearer token for the data requests (supabase-js's accessToken): null on the web without `bearer`, where the cookie goes instead. */
  accessToken(): Promise<string | null>;
  /** fetch for the data requests: with the cookie on the web. */
  fetch: typeof fetch;
  /** Checks the session with the server; offline, it stays as it was. */
  refresh(): Promise<AccountSession | null>;
};

/** Better Auth's user, as /auth/get-session answers it. */
type ServerUser = { id: string; email: string; name: string; image?: string | null; emailVerified: boolean; createdAt: string };

const TOKEN_KEY = 'cv-api.session-token';
const SESSION_KEY = 'cv-api.session';
/** Until when a phone waits for a link with a session: set when it starts a sign-in that ends in one. */
const PENDING_KEY = 'cv-api.pending-link';
/** A little over the links' hour (Better Auth's email tokens), and Google's sign-in by far. */
const PENDING_MS = 2 * 60 * 60 * 1000;
/** The parameters a link back to the app carries: the session, a reset token, a failure. */
const LINK_PARAMETERS = ['cookie', 'token', 'error', 'error_description'];

/** The session token in a Set-Cookie header (the `cookie` parameter of a link back), as the bearer token. */
export function sessionTokenFromCookie(setCookie: string): string | null {
  const match = /(?:^|[,;]\s*)(?:__Secure-)?better-auth\.session_token=([^;,\s]+)/.exec(setCookie);
  return match?.[1] || null;
}

export function createCvApiAuth(options: CvApiAuthOptions): CvApiAuth {
  const base = options.baseUrl.replace(/\/+$/, '');
  const keepsToken = options.native || Boolean(options.bearer);
  const send: typeof fetch = options.fetch ?? ((input, init) => fetch(input, init));
  const ownPhotos = `${base}/storage/v1/object/public/profile-avatars/`;
  const callback = options.callbackPath ? new RegExp(`(^|/)${options.callbackPath}/?$`) : null;
  const listeners = new Set<(event: AccountEvent, session: AccountSession | null) => void>();
  /** The session as known here; undefined until first read. */
  let current: AccountSession | null | undefined;
  let firstCheck: Promise<AccountSession | null> | null = null;
  /** Bumped by every sign-in and sign-out, so a check already under way can't undo them. */
  let generation = 0;
  /** A password-reset link's token, until the new password is set. */
  let resetToken: string | null = null;

  const read = (key: string) => {
    try {
      return options.storage()?.getItem(key) ?? null;
    } catch {
      return null;
    }
  };
  const write = (key: string, value: string | null) => {
    try {
      const storage = options.storage();
      if (value == null) storage?.removeItem(key);
      else storage?.setItem(key, value);
    } catch {
      // Storage is a convenience: the session still holds for as long as the app runs.
    }
  };
  const emit = (event: AccountEvent, session: AccountSession | null) => {
    for (const listener of [...listeners]) listener(event, session);
  };

  /** A request to /auth with this device's session (its bearer token, or the cookie), or with another token, looked at without keeping it. */
  async function request(path: string, body?: unknown, as?: string): Promise<Response> {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (options.native) headers['expo-origin'] = options.appOrigin;
    const token = as ?? (keepsToken ? read(TOKEN_KEY) : null);
    if (token) headers.authorization = `Bearer ${token}`;
    const response = await send(`${base}/auth${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: options.native ? 'omit' : 'include',
    });
    // A new session's token (a sign-in), for the bearer.
    const issued = keepsToken && !as ? response.headers.get('set-auth-token') : null;
    if (issued) write(TOKEN_KEY, issued);
    return response;
  }

  /** The answer's JSON; a failure, as an Error with Better Auth's message. */
  async function answer<T>(response: Response, fallback: CvApiMessage): Promise<T> {
    const parsed = await response.json().then((body: unknown) => ({ body }), () => null);
    const body = (parsed?.body ?? null) as (T & { code?: string; message?: string }) | null;
    // A success that isn't JSON isn't cv-api's answer (a page in its place, a wrong address): the server failing, never "signed out".
    if (response.ok && !parsed && response.status !== 204) throw new Error(options.message(fallback));
    if (response.ok) return body as T;
    if (body?.code === 'PROVIDER_NOT_FOUND') throw new Error(options.message('googleNotEnabled'));
    throw new Error(body?.message || options.message(fallback));
  }

  const post = async <T = unknown>(path: string, body: unknown, fallback: CvApiMessage) => answer<T>(await request(path, body), fallback);

  /**
   * Better Auth's user in Supabase's shape. Its one photo is the user's own
   * upload when it is in cv-api's profile-avatars, and otherwise Google's.
   * Better Auth keeps whether the email is confirmed, not when: the account's
   * creation stands in for it.
   */
  function accountUser(user: ServerUser, providers: string[]): AccountUser {
    const image = user.image || null;
    const own = Boolean(image?.startsWith(ownPhotos));
    return {
      id: user.id,
      email: user.email,
      email_confirmed_at: user.emailVerified ? user.createdAt : undefined,
      user_metadata: { full_name: user.name, chc_avatar_url: own ? image : null, avatar_url: own ? null : image },
      app_metadata: { provider: providers[0] ?? 'email', providers },
    };
  }

  /** The session from the server, with the ways its user signs in (first the oldest). */
  async function fetchSession(): Promise<AccountSession | null> {
    const body = await answer<{ user?: ServerUser; session?: { token?: string } } | null>(await request('/get-session'), 'finishSignIn');
    if (!body?.user) return null;
    // The web, back from Google with the cookie: its session's token is the bearer from now on.
    if (keepsToken && !read(TOKEN_KEY) && body.session?.token) write(TOKEN_KEY, body.session.token);
    const accounts = await request('/list-accounts')
      .then((response) => answer<{ providerId: string; createdAt: string }[]>(response, 'finishSignIn'))
      .catch(() => null);
    const providers = accounts
      ? [...new Set([...accounts].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((account) => (account.providerId === 'credential' ? 'email' : account.providerId)))]
      : current?.user.id === body.user.id ? current.user.app_metadata.providers ?? [] : [];
    return { user: accountUser(body.user, providers) };
  }

  /** The session from now on, kept, and told to the listeners when it changed. */
  function settle(next: AccountSession | null) {
    const previous = current ?? null;
    current = next;
    write(SESSION_KEY, next ? JSON.stringify(next) : null);
    if (!next) write(TOKEN_KEY, null);
    if (!next) {
      if (previous) emit('SIGNED_OUT', null);
    } else if (!previous || previous.user.id !== next.user.id) {
      emit('SIGNED_IN', next);
    } else if (JSON.stringify(previous) !== JSON.stringify(next)) {
      emit('USER_UPDATED', next);
    }
  }

  async function refresh(): Promise<AccountSession | null> {
    const at = generation;
    if (options.native && !read(TOKEN_KEY)) {
      if (at === generation) settle(null);
      return null;
    }
    let next: AccountSession | null;
    try {
      next = await fetchSession();
    } catch {
      // Offline, or the server failing: the session stays as it was.
      if (current === undefined) current = null;
      return current;
    }
    if (at === generation) settle(next);
    return current ?? null;
  }

  /** About to start a sign-in that ends in a link with a session (sign-up, Google, an email change). */
  const awaitLink = () => write(PENDING_KEY, String(Date.now() + PENDING_MS));
  const awaitingLink = () => Number(read(PENDING_KEY)) > Date.now();

  /** After a sign-in: the new session, from the server. */
  async function signedIn(): Promise<void> {
    generation += 1;
    const next = await fetchSession();
    settle(next);
    if (!next) throw new Error(options.message('finishSignIn'));
  }

  async function signInWithEmail(email: string, password: string): Promise<void> {
    await post('/sign-in/email', { email, password }, 'signIn');
    await signedIn();
  }

  async function getSession(): Promise<AccountSession | null> {
    if (current === undefined) {
      let cached: AccountSession | null = null;
      try {
        cached = JSON.parse(read(SESSION_KEY) ?? 'null') as AccountSession | null;
      } catch {
        cached = null;
      }
      const token = read(TOKEN_KEY);
      if (cached?.user?.id && (!options.native || token)) {
        current = cached;
        void (firstCheck ??= refresh());
      } else if (options.native && !token) {
        current = null;
      } else {
        await (firstCheck ??= refresh());
      }
    }
    return current ?? null;
  }

  async function applyCallback(url: string): Promise<void> {
    let link: URL;
    try {
      link = new URL(url);
    } catch {
      return;
    }
    if (callback && !callback.test(link.host + link.pathname)) return;
    const params = link.searchParams;
    if (!LINK_PARAMETERS.some((name) => params.has(name))) return;
    const cookie = params.get('cookie');
    const token = params.get('token');
    const error = params.get('error');
    const description = params.get('error_description');
    if (options.replaceUrl) {
      for (const name of LINK_PARAMETERS) link.searchParams.delete(name);
      options.replaceUrl(link.toString());
    }

    if (error) {
      if (error === 'INVALID_TOKEN' || error === 'TOKEN_EXPIRED') throw new Error(options.message('linkExpired'));
      throw new Error(description || options.message('finishSignIn'));
    }
    if (token) {
      resetToken = token;
      emit('PASSWORD_RECOVERY', await getSession());
      return;
    }
    // A session in a link is only taken by a phone that started a sign-in ending in one, so a link
    // someone else made can't sign it in to their account. Never on the web: there the redirect sets
    // the cookie itself, and the Expo plugin only adds `cookie` to links to the app's own scheme.
    const sessionToken = cookie ? sessionTokenFromCookie(cookie) : null;
    if (!sessionToken || !options.native || !awaitingLink()) return;
    // And never in place of another account's session (an email change's link is the same user's).
    if (current) {
      const theirs = await answer<{ user?: ServerUser } | null>(await request('/get-session', undefined, sessionToken), 'finishSignIn');
      if (theirs?.user?.id !== current.user.id) throw new Error(options.message('finishSignIn'));
    }
    write(TOKEN_KEY, sessionToken);
    await signedIn();
  }

  return {
    needsCurrentPassword: true,
    readsWebCallbacks: true,
    canChangePassword: (user) => (user.app_metadata.providers ?? []).includes('email'),
    getSession,
    getUser: async () => (await getSession())?.user ?? null,
    onChange(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    applyCallback,
    refresh,

    async accessToken() {
      return keepsToken ? read(TOKEN_KEY) : null;
    },
    fetch: options.native ? send : (input, init) => {
      // Without a token of its own, supabase-js sends its key as the bearer; on the web without one, the cookie is the session.
      const headers = new Headers(init?.headers);
      if (!keepsToken) headers.delete('authorization');
      return send(input, { ...init, headers, credentials: 'include' });
    },

    signInWithEmail,

    async signUpWithEmail(email, password, displayName, redirectTo) {
      awaitLink();
      const body = await post<{ token?: string | null }>('/sign-up/email', { email, password, name: displayName.trim(), callbackURL: redirectTo }, 'createAccount');
      // An email to confirm comes first: the account has no session until its link is opened.
      if (!body?.token) return { confirmationRequired: true };
      await signedIn();
      return { confirmationRequired: false };
    },

    async signInWithGoogle(redirectTo) {
      const body = await post<{ url?: string }>('/sign-in/social', { provider: 'google', callbackURL: redirectTo, errorCallbackURL: redirectTo, disableRedirect: true }, 'startGoogle');
      if (!body?.url) throw new Error(options.message('googleNoUrl'));
      if (!options.native) {
        // The page goes to Google and comes back signed in, with the cookie.
        write(SESSION_KEY, null);
        options.navigate?.(body.url);
        return;
      }
      // Through the server first, which leaves the sign-in's state in the browser for Google's answer to be checked against.
      const proxy = `${base}/auth/expo-authorization-proxy?${new URLSearchParams({ authorizationURL: body.url })}`;
      if (!options.openAuthSession) throw new Error(options.message('startGoogle'));
      awaitLink();
      const result = await options.openAuthSession(proxy, redirectTo);
      if (result.type === 'success' && result.url) {
        await applyCallback(result.url);
        if (!current) throw new Error(options.message('googleIncomplete'));
      } else if (result.type !== 'dismiss' && result.type !== 'cancel') {
        throw new Error(options.message('googleIncomplete'));
      }
    },

    async sendPasswordReset(email, redirectTo) {
      await post('/request-password-reset', { email, redirectTo }, 'passwordReset');
    },

    async resendSignupConfirmation(email, redirectTo) {
      awaitLink();
      await post('/send-verification-email', { email, callbackURL: redirectTo }, 'resendConfirmation');
    },

    async updateDisplayName(displayName) {
      await post('/update-user', { name: displayName.trim() }, 'updateProfile');
      await refresh();
    },

    async updateEmail(email, redirectTo) {
      // Approved from the current address, then confirmed at the new one, whose link signs this device in again.
      awaitLink();
      await post('/change-email', { newEmail: email.trim().toLowerCase(), callbackURL: redirectTo }, 'updateEmail');
    },

    async updateAvatarUrl(avatarUrl) {
      await post('/update-user', { image: avatarUrl }, 'updatePhoto');
      await refresh();
    },

    async updatePassword(password, currentPassword) {
      if (resetToken) {
        const email = current?.user.email;
        await post('/reset-password', { newPassword: password, token: resetToken }, 'updatePassword');
        resetToken = null;
        if (!current) return;
        // A reset ends every session of its account. This device's still standing, the link was another account's: it stays as it is.
        const still = await fetchSession().catch(() => null);
        if (still?.user.id === current.user.id) return;
        // This one's was ended too: whoever is signed in here signs in again, with the new password.
        write(TOKEN_KEY, null);
        try {
          if (!email) throw new Error(options.message('signIn'));
          await signInWithEmail(email, password);
        } catch (error) {
          generation += 1;
          settle(null);
          throw error;
        }
        return;
      }
      if (!currentPassword) throw new Error(options.message('currentPasswordRequired'));
      await post('/change-password', { currentPassword, newPassword: password }, 'updatePassword');
    },

    async signOut() {
      generation += 1;
      let response: Response | null = null;
      try {
        response = await request('/sign-out', {});
      } catch {
        // Offline: this device is signed out all the same, and the server's session runs out on its own.
      }
      if (response && response.status >= 500) await answer(response, 'signOut');
      resetToken = null;
      write(PENDING_KEY, null);
      settle(null);
    },
  };
}
