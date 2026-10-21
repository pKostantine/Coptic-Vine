/**
 * Sign-in for Coptic Vine, CV-Admin and CV-Artists: Better Auth on D1
 * (Phase 2 of docs/coptic-vine-d1-plan.md), in place of Supabase Auth.
 *
 *   email and password   sign-up with a confirmation email, sign-in, password
 *                        reset, password change, email change (approved from
 *                        the old address, then confirmed at the new one)
 *   Google               the web OAuth flow (and native ID tokens, with the
 *                        native client ids added to GOOGLE_CLIENT_ID)
 *   Apple                later, once there is an Apple Developer account
 *
 * Users keep their Supabase ids ("auth.users", migration 0006). The passwords
 * carried over from Supabase are bcrypt hashes and are checked as they are;
 * new passwords get Better Auth's own (scrypt) hash. Sessions are Better
 * Auth's: a cookie for the web apps, which are same-site with
 * api.copticvine.ca, and a bearer token or the Expo plugin's stored cookie
 * for the native apps.
 */
import { expo } from '@better-auth/expo';
import bcrypt from 'bcryptjs';
import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { hashPassword, verifyPassword } from 'better-auth/crypto';
import { bearer } from 'better-auth/plugins';
import type { Env } from '../types.ts';
import { authModel, d1Adapter } from './adapter.ts';
import { emails, sendEmail } from './email.ts';

const DAY = 24 * 60 * 60;

/** The passwords carried over from Supabase are bcrypt ($2a$…); everything newer is Better Auth's. */
export async function checkPassword({ hash, password }: { hash: string; password: string }): Promise<boolean> {
  if (/^\$2[aby]\$\d\d\$/.test(hash)) return bcrypt.compare(password, hash);
  return verifyPassword({ hash, password });
}

export const list = (value: string | undefined) => (value ?? '').split(',').map((item) => item.trim()).filter(Boolean);

/** Where the Expo plugin's proxy may send a phone's browser: the providers' own sign-in pages (Apple's too, once it is added). */
const PROVIDER_ORIGINS = ['https://accounts.google.com'];

/**
 * The headers a session is read from. Better Auth's bearer plugin takes a
 * bearer without a dot as an unsigned session token: it signs it itself and
 * puts it in place of the session cookie. supabase-js sends its publishable
 * key as the bearer when it has no token of its own (the web, which signs in
 * with the cookie; a phone signed out), which would hide the cookie's session.
 * So a bearer is only kept when it is shaped as a session token: Better Auth's
 * own (32 letters and digits), or with a dot (its signed form, which the
 * plugin checks; a JWT fails that check and is ignored).
 */
export function sessionHeaders(headers: Headers): Headers {
  const bearer = /^Bearer\s+(.+)$/i.exec(headers.get('authorization') ?? '')?.[1]?.trim();
  if (!bearer || bearer.includes('.') || /^[A-Za-z0-9]{32}$/.test(bearer)) return headers;
  const kept = new Headers(headers);
  kept.delete('authorization');
  return kept;
}

export function createAuth(env: Env) {
  const googleClients = list(env.GOOGLE_CLIENT_ID);
  return betterAuth({
    appName: 'Coptic Vine',
    baseURL: env.BETTER_AUTH_URL,
    basePath: '/auth',
    secret: env.BETTER_AUTH_SECRET,
    database: d1Adapter(env.DB),
    trustedOrigins: list(env.TRUSTED_ORIGINS),
    user: {
      modelName: authModel('users'),
      fields: { emailVerified: 'email_verified', createdAt: 'created_at', updatedAt: 'updated_at' },
      changeEmail: {
        enabled: true,
        sendChangeEmailConfirmation: async ({ user, newEmail, url }) => sendEmail(env, emails.approveEmailChange(user.email, newEmail, url)),
      },
    },
    session: {
      modelName: authModel('sessions'),
      fields: { userId: 'user_id', expiresAt: 'expires_at', ipAddress: 'ip_address', userAgent: 'user_agent', createdAt: 'created_at', updatedAt: 'updated_at' },
      // A month, renewed daily while the app is used, so people stay signed in on their phones.
      expiresIn: 30 * DAY,
      updateAge: DAY,
    },
    account: {
      modelName: authModel('accounts'),
      fields: {
        userId: 'user_id', accountId: 'account_id', providerId: 'provider_id', accessToken: 'access_token', refreshToken: 'refresh_token',
        idToken: 'id_token', accessTokenExpiresAt: 'access_token_expires_at', refreshTokenExpiresAt: 'refresh_token_expires_at', createdAt: 'created_at', updatedAt: 'updated_at',
      },
      // As Supabase did: a Google sign-in with the same verified email joins the existing account.
      accountLinking: { enabled: true, trustedProviders: ['google'] },
    },
    verification: {
      modelName: authModel('verifications'),
      fields: { expiresAt: 'expires_at', createdAt: 'created_at', updatedAt: 'updated_at' },
    },
    rateLimit: { enabled: true, storage: 'database', modelName: authModel('rate_limits'), fields: { lastRequest: 'last_request' } },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 8,
      revokeSessionsOnPasswordReset: true,
      password: { hash: hashPassword, verify: checkPassword },
      sendResetPassword: async ({ user, url }) => sendEmail(env, emails.resetPassword(user.email, url)),
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => sendEmail(env, emails.confirmAddress(user.email, url)),
    },
    socialProviders: googleClients.length && env.GOOGLE_CLIENT_SECRET
      ? { google: { clientId: googleClients.length === 1 ? googleClients[0] : googleClients, clientSecret: env.GOOGLE_CLIENT_SECRET } }
      : {},
    advanced: {
      // New users get UUIDs, like the ones carried over from Supabase.
      database: { generateId: () => crypto.randomUUID() },
      // Cloudflare gives the client's address in cf-connecting-ip. Without it the rate
      // limiter can't tell clients apart and counts everyone in one bucket per path.
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
    },
    hooks: {
      // The Expo plugin's proxy leaves a signed cookie for any address's state, then goes there. Anywhere but
      // a provider's page, that is an open redirect, and a way to plant the state of someone else's Google
      // sign-in in a victim's browser, which Google's answer then signs in as that someone.
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== '/expo-authorization-proxy') return;
        let origin: string | null = null;
        try {
          origin = new URL(String(ctx.query?.authorizationURL)).origin;
        } catch {
          origin = null;
        }
        if (!origin || !PROVIDER_ORIGINS.includes(origin)) throw new APIError('BAD_REQUEST', { message: 'Invalid authorizationURL' });
      }),
    },
    plugins: [bearer(), expo()],
  });
}

export type Auth = ReturnType<typeof createAuth>;
