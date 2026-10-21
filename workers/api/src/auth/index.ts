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
    },
    plugins: [bearer(), expo()],
  });
}

export type Auth = ReturnType<typeof createAuth>;
