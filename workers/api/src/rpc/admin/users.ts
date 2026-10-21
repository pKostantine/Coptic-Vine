/**
 * CV-Admin's Users page: what Supabase's dashboard gave when someone calls,
 * locked out. Find the account (how it signs in, whether its email is
 * confirmed, when it last signed in), send the password reset or the
 * confirmation email again, confirm the email, or end every session.
 *
 * Supabase had no such database functions; they are cv-api's own, declared
 * in USER_FUNCTIONS as scripts/gen-functions.ts reads a dump's, so the router
 * matches, checks and grants them the same way (src/rpc/index.ts). Each
 * refuses whoever isn't an admin as the admin functions do: signed out, the
 * grant (authenticated only); signed in, 'Admin role required' (42501).
 * Emails are Better Auth's own, sent as the app's "Forgot your password?" and
 * sign-up send them. Nobody's password is chosen or read out here.
 */
import { col, t } from '../../../../content-api/src/db/names.ts';
import type { FunctionInfo } from '../../../scripts/gen-functions.ts';
import { authFor } from '../../auth/index.ts';
import { now, raise } from '../../pg.ts';
import type { ApiContext } from '../../rest/context.ts';
import type { Args, Rpc } from '../index.ts';
import { requireSignedInAdmin } from './shared.ts';

/** Where the emails' links come back to: the web app's account page, which opens on any device. */
export const ACCOUNT_PAGE = 'https://copticvine.ca/account';

/** How Better Auth names the ways in ("auth.accounts".provider_id), as the page shows them. */
const METHODS: Record<string, string> = { credential: 'password', google: 'google' };

export type ListedUser = {
  id: string; email: string; name: string; image: string | null; emailConfirmed: boolean; createdAt: string;
  signInMethods: string[]; lastSignInAt: string | null; activeSessions: number; roles: string[];
};

const USERS = t('auth', 'users');
const SESSIONS = t('auth', 'sessions');

/** Every user with how they sign in and their sessions; a search keeps those whose email or name contains it, in any case. */
export async function adminListUsers(ctx: ApiContext, search: string | null, limit: number | null): Promise<ListedUser[]> {
  await requireSignedInAdmin(ctx);
  const rows = (await ctx.db.prepare(`SELECT u.${col('id')} AS id, u.${col('email')} AS email, u.${col('name')} AS name, u.${col('image')} AS image,
      u.${col('email_verified')} AS confirmed, u.${col('created_at')} AS created_at,
      (SELECT json_group_array(DISTINCT a.${col('provider_id')}) FROM ${t('auth', 'accounts')} a WHERE a.${col('user_id')} = u.${col('id')}) AS providers,
      (SELECT max(s.${col('created_at')}) FROM ${SESSIONS} s WHERE s.${col('user_id')} = u.${col('id')}) AS last_sign_in,
      (SELECT count(*) FROM ${SESSIONS} s WHERE s.${col('user_id')} = u.${col('id')} AND s.${col('expires_at')} > ?) AS active,
      (SELECT json_group_array(r.${col('role')}) FROM ${t('creator', 'user_roles')} r WHERE r.${col('user_id')} = u.${col('id')} AND r.${col('revoked_at')} IS NULL) AS roles
    FROM ${USERS} u`).bind(now()).all<Record<string, unknown>>()).results;
  const needle = search?.trim().toLowerCase();
  const users = rows.map((row): ListedUser => ({
    id: row.id as string,
    email: row.email as string,
    name: row.name as string,
    image: (row.image as string | null) ?? null,
    emailConfirmed: row.confirmed === 1,
    createdAt: row.created_at as string,
    signInMethods: (JSON.parse(row.providers as string) as string[]).map((provider) => METHODS[provider] ?? provider).sort(),
    lastSignInAt: (row.last_sign_in as string | null) ?? null,
    activeSessions: Number(row.active),
    roles: (JSON.parse(row.roles as string) as string[]).sort(),
  })).filter((user) => !needle || user.email.toLowerCase().includes(needle) || user.name.toLowerCase().includes(needle));
  // Latest sign-in first (never signed in last), then by email.
  users.sort((a, b) => {
    if (a.lastSignInAt !== b.lastSignInAt) {
      if (a.lastSignInAt == null) return 1;
      if (b.lastSignInAt == null) return -1;
      return a.lastSignInAt < b.lastSignInAt ? 1 : -1;
    }
    return a.email < b.email ? -1 : a.email > b.email ? 1 : 0;
  });
  return users.slice(0, Math.min(Math.max(limit ?? 50, 1), 500));
}

async function findUser(ctx: ApiContext, userId: string): Promise<{ email: string; confirmed: boolean; methods: string[] }> {
  const user = await ctx.db.prepare(`SELECT ${col('email')} AS email, ${col('email_verified')} AS confirmed,
      (SELECT json_group_array(DISTINCT a.${col('provider_id')}) FROM ${t('auth', 'accounts')} a WHERE a.${col('user_id')} = ?) AS providers
    FROM ${USERS} WHERE ${col('id')} = ?`).bind(userId, userId).first<{ email: string; confirmed: number; providers: string }>();
  if (!user) raise('User not found', 'P0002');
  return { email: user.email, confirmed: user.confirmed === 1, methods: (JSON.parse(user.providers) as string[]).map((provider) => METHODS[provider] ?? provider) };
}

/**
 * The reset email "Forgot your password?" sends. An account that only signs
 * in with Google gets it too: setting a password from it adds password
 * sign-in to the account (Better Auth's resetCredentialPassword), which
 * addsPassword says.
 */
export async function adminSendPasswordReset(ctx: ApiContext, userId: string): Promise<{ email: string; addsPassword: boolean }> {
  await requireSignedInAdmin(ctx);
  const user = await findUser(ctx, userId);
  await authFor(ctx.env).api.requestPasswordReset({ body: { email: user.email, redirectTo: ACCOUNT_PAGE } });
  return { email: user.email, addsPassword: !user.methods.includes('password') };
}

/** The sign-up's confirmation email, again; only while the email isn't confirmed. */
export async function adminResendConfirmation(ctx: ApiContext, userId: string): Promise<{ email: string }> {
  await requireSignedInAdmin(ctx);
  const user = await findUser(ctx, userId);
  if (user.confirmed) raise('Email is already confirmed', '22023');
  await authFor(ctx.env).api.sendVerificationEmail({ body: { email: user.email, callbackURL: ACCOUNT_PAGE } });
  return { email: user.email };
}

/** The email marked confirmed, as its link would have, without signing anyone in. */
export async function adminMarkEmailConfirmed(ctx: ApiContext, userId: string): Promise<{ email: string; alreadyConfirmed: boolean }> {
  await requireSignedInAdmin(ctx);
  const user = await findUser(ctx, userId);
  if (!user.confirmed) await (await authFor(ctx.env).$context).internalAdapter.updateUser(userId, { emailVerified: true });
  return { email: user.email, alreadyConfirmed: user.confirmed };
}

/** Every session of the account ended: each device signs in again. */
export async function adminSignOutEverywhere(ctx: ApiContext, userId: string): Promise<{ email: string; sessionsEnded: number }> {
  await requireSignedInAdmin(ctx);
  const user = await findUser(ctx, userId);
  const sessions = await ctx.db.prepare(`SELECT count(*) AS n FROM ${SESSIONS} WHERE ${col('user_id')} = ?`).bind(userId).first<{ n: number }>();
  await (await authFor(ctx.env).$context).internalAdapter.deleteUserSessions(userId);
  return { email: user.email, sessionsEnded: Number(sessions?.n ?? 0) };
}

const ADMIN_ONLY = ['authenticated'];
const USER_ID = [{ name: 'p_user_id', type: 'uuid' }];

/** Their signatures, as gen-functions.ts would read them from a dump. */
export const USER_FUNCTIONS: Record<string, FunctionInfo> = {
  'public.admin_list_users': { roles: ADMIN_ONLY, returns: 'jsonb', params: [{ name: 'p_search', type: 'text', default: null }, { name: 'p_limit', type: 'integer', default: 50 }] },
  'public.admin_send_password_reset': { roles: ADMIN_ONLY, returns: 'jsonb', params: USER_ID },
  'public.admin_resend_confirmation': { roles: ADMIN_ONLY, returns: 'jsonb', params: USER_ID },
  'public.admin_mark_email_confirmed': { roles: ADMIN_ONLY, returns: 'jsonb', params: USER_ID },
  'public.admin_sign_out_everywhere': { roles: ADMIN_ONLY, returns: 'jsonb', params: USER_ID },
};

const id = (a: Args) => a.p_user_id as string;

export const userRpcs: Record<string, Rpc> = {
  'public.admin_list_users': (c, a) => adminListUsers(c, a.p_search as string | null, a.p_limit as number | null),
  'public.admin_send_password_reset': (c, a) => adminSendPasswordReset(c, id(a)),
  'public.admin_resend_confirmation': (c, a) => adminResendConfirmation(c, id(a)),
  'public.admin_mark_email_confirmed': (c, a) => adminMarkEmailConfirmed(c, id(a)),
  'public.admin_sign_out_everywhere': (c, a) => adminSignOutEverywhere(c, id(a)),
};
