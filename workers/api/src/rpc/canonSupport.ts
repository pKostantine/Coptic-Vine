/**
 * Support people for a spiritual canon (migration 0046). A believer makes an
 * invite link and sends it to the friends, the support group, who keep them
 * in prayer. Whoever accepts it, signed in, becomes one of their support
 * people: in their own app they see the believer's canon as it is now and how
 * it is kept day by day, and the father of confession's instructions only
 * when the believer chose to include them. Neither side is handed the other's
 * account id; each sees the other by name.
 *
 * One link may be accepted by anyone who has it until the believer turns it
 * off; those who accepted stay until the believer removes them or they stop.
 * Anyone with a link, signed in or not, reads only what the invite says: the
 * name and the message the believer chose to show.
 *
 * cv-api's own functions, as Supabase never had them, declared in
 * CANON_SUPPORT_FUNCTIONS the way the dump's are (src/rpc/index.ts).
 */
import { col, t } from '../../../content-api/src/db/names.ts';
import type { FunctionInfo } from '../../scripts/gen-functions.ts';
import { now, raise } from '../pg.ts';
import type { ApiContext } from '../rest/context.ts';
import type { Args, Rpc } from './index.ts';

/** The most each may hold, as the tables check them. */
export const CANON_SUPPORT_LIMITS = { name: 80, message: 1000 } as const;
/** How many invite links one account may keep at once. */
export const CANON_INVITES_PER_ACCOUNT = 20;
/** How many support people one believer may have, and how many believers one person may support. */
export const CANON_SUPPORTERS_PER_ACCOUNT = 50;
/** The most days of ticks read at once: a few weeks, as the canon page shows them a week at a time. */
export const CANON_SUPPORT_DAYS = 62;

export type CanonSupportInvite = {
  id: string;
  sharerName: string | null;
  message: string | null;
  withInstructions: boolean;
  createdAt: string;
};

/** An invite as whoever opens its link reads it. */
export type CanonSupportInviteView = CanonSupportInvite & {
  /** The link is the reader's own. */
  own: boolean;
  /** The reader already supports the one who made it: the id to open their canon by. */
  supporting: string | null;
};

/** One of the believer's support people, or one the account supports: who, and since when. */
export type CanonSupportPerson = { id: string; name: string; withInstructions: boolean; since: string };

export type SupportedCanon = {
  id: string;
  name: string;
  items: unknown[];
  /** Each day's marks, by "YYYY-MM-DD", for the days asked for. */
  days: Record<string, unknown>;
  instructions: string | null;
  updatedAt: string | null;
};

const INVITES = t('public', 'canon_support_invites');
const SUPPORTERS = t('public', 'canon_supporters');
const CANONS = t('public', 'spiritual_canons');
const DAYS = t('public', 'spiritual_canon_days');
const NOTES = t('public', 'spiritual_canon_notes');
const USERS = t('auth', 'users');
const INVITE_COLUMNS = ['id', 'sharer_name', 'message', 'with_instructions', 'created_at'].map(col).join(', ');

function signedIn(ctx: ApiContext): string {
  if (!ctx.userId) raise('Sign in to keep a canon with support people', '42501');
  return ctx.userId;
}

/** A text argument trimmed, or null when empty; refused when too long. */
function text(value: unknown, limit: number, what: string): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) return null;
  if (trimmed.length > limit) raise(`The ${what} is longer than ${limit} characters`, '22001');
  return trimmed;
}

/** 18 random bytes, base64url: 24 characters no one will guess. */
function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function linkId(value: unknown): string | null {
  return typeof value === 'string' && value.length >= 16 && value.length <= 64 ? value : null;
}

function invite(row: Record<string, unknown>): CanonSupportInvite {
  return {
    id: row.id as string,
    sharerName: (row.sharer_name as string | null) ?? null,
    message: (row.message as string | null) ?? null,
    withInstructions: Number(row.with_instructions) === 1,
    createdAt: row.created_at as string,
  };
}

function json(value: unknown, fallback: unknown): unknown {
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

// ─── The believer's invite links ────────────────────────────────────────────

/** Makes an invite link, and returns it. */
export async function createCanonSupportInvite(ctx: ApiContext, args: Args): Promise<CanonSupportInvite> {
  const userId = signedIn(ctx);
  const name = text(args.p_name, CANON_SUPPORT_LIMITS.name, 'name');
  const message = text(args.p_message, CANON_SUPPORT_LIMITS.message, 'message');
  const withInstructions = args.p_with_instructions === true ? 1 : 0;

  const kept = await ctx.db.prepare(`SELECT count(*) AS n FROM ${INVITES} WHERE ${col('user_id')} = ?`).bind(userId).first<{ n: number }>();
  if ((kept?.n ?? 0) >= CANON_INVITES_PER_ACCOUNT) raise(`You have ${CANON_INVITES_PER_ACCOUNT} invite links. Turn one off to make another.`, 'P0001');

  const id = newId();
  await ctx.db
    .prepare(`INSERT INTO ${INVITES} (${col('id')}, ${col('user_id')}, ${col('sharer_name')}, ${col('message')}, ${col('with_instructions')}, ${col('created_at')}) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(id, userId, name, message, withInstructions, now())
    .run();
  const row = await ctx.db.prepare(`SELECT ${INVITE_COLUMNS} FROM ${INVITES} WHERE ${col('id')} = ?`).bind(id).first<Record<string, unknown>>();
  return invite(row!);
}

/** The account's invite links, the latest first. */
export async function listMyCanonSupportInvites(ctx: ApiContext): Promise<CanonSupportInvite[]> {
  const userId = signedIn(ctx);
  const { results } = await ctx.db
    .prepare(`SELECT ${INVITE_COLUMNS} FROM ${INVITES} WHERE ${col('user_id')} = ? ORDER BY ${col('created_at')} DESC LIMIT ${CANON_INVITES_PER_ACCOUNT}`)
    .bind(userId)
    .all<Record<string, unknown>>();
  return results.map(invite);
}

/** Turns one of the account's links off: no one else can accept it. Those who did stay. */
export async function deleteMyCanonSupportInvite(ctx: ApiContext, id: unknown): Promise<{ deleted: string }> {
  const userId = signedIn(ctx);
  const { meta } = await ctx.db.prepare(`DELETE FROM ${INVITES} WHERE ${col('id')} = ? AND ${col('user_id')} = ?`).bind(String(id ?? ''), userId).run();
  if (!meta.changes) raise('Invite link not found', 'P0002');
  return { deleted: String(id) };
}

// ─── Opening and accepting a link ───────────────────────────────────────────

/** What a link says, for whoever has it; refused when it was turned off or never was. */
export async function getCanonSupportInvite(ctx: ApiContext, id: unknown): Promise<CanonSupportInviteView> {
  const key = linkId(id);
  const row = key
    ? await ctx.db.prepare(`SELECT ${INVITE_COLUMNS}, ${col('user_id')} AS owner FROM ${INVITES} WHERE ${col('id')} = ?`).bind(key).first<Record<string, unknown>>()
    : null;
  if (!row) raise('This invite link was turned off', 'P0002');
  const own = Boolean(ctx.userId) && row.owner === ctx.userId;
  let supporting: string | null = null;
  if (ctx.userId && !own) {
    const found = await ctx.db
      .prepare(`SELECT ${col('id')} AS id FROM ${SUPPORTERS} WHERE ${col('user_id')} = ? AND ${col('supporter_id')} = ?`)
      .bind(row.owner, ctx.userId)
      .first<{ id: string }>();
    supporting = found?.id ?? null;
  }
  return { ...invite(row), own, supporting };
}

/** Makes the account one of the believer's support people (again, if it already was), and returns them. */
export async function acceptCanonSupportInvite(ctx: ApiContext, id: unknown): Promise<CanonSupportPerson> {
  const userId = signedIn(ctx);
  const key = linkId(id);
  const row = key
    ? await ctx.db.prepare(`SELECT ${col('user_id')} AS owner, ${col('sharer_name')} AS sharer_name, ${col('with_instructions')} AS with_instructions FROM ${INVITES} WHERE ${col('id')} = ?`).bind(key).first<{ owner: string; sharer_name: string | null; with_instructions: number }>()
    : null;
  if (!row) raise('This invite link was turned off', 'P0002');
  if (row.owner === userId) raise('This is your own invite link', '22023');

  const existing = await ctx.db
    .prepare(`SELECT ${col('id')} AS id FROM ${SUPPORTERS} WHERE ${col('user_id')} = ? AND ${col('supporter_id')} = ?`)
    .bind(row.owner, userId)
    .first<{ id: string }>();
  if (existing) {
    // Accepted again: what the newer link says holds.
    await ctx.db
      .prepare(`UPDATE ${SUPPORTERS} SET ${col('sharer_name')} = ?, ${col('with_instructions')} = ? WHERE ${col('id')} = ?`)
      .bind(row.sharer_name, row.with_instructions, existing.id)
      .run();
  } else {
    const counts = await ctx.db
      .prepare(`SELECT (SELECT count(*) FROM ${SUPPORTERS} WHERE ${col('user_id')} = ?) AS theirs, (SELECT count(*) FROM ${SUPPORTERS} WHERE ${col('supporter_id')} = ?) AS mine`)
      .bind(row.owner, userId)
      .first<{ theirs: number; mine: number }>();
    if ((counts?.theirs ?? 0) >= CANON_SUPPORTERS_PER_ACCOUNT) raise('They already have as many support people as a canon may have', 'P0001');
    if ((counts?.mine ?? 0) >= CANON_SUPPORTERS_PER_ACCOUNT) raise(`You already support ${CANON_SUPPORTERS_PER_ACCOUNT} people`, 'P0001');
    await ctx.db
      .prepare(`INSERT INTO ${SUPPORTERS} (${col('id')}, ${col('user_id')}, ${col('supporter_id')}, ${col('sharer_name')}, ${col('with_instructions')}, ${col('created_at')}) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(newId(), row.owner, userId, row.sharer_name, row.with_instructions, now())
      .run();
  }
  const accepted = await ctx.db
    .prepare(`SELECT s.${col('id')} AS id, coalesce(s.${col('sharer_name')}, u.${col('name')}) AS name, s.${col('with_instructions')} AS with_instructions, s.${col('created_at')} AS created_at
      FROM ${SUPPORTERS} s JOIN ${USERS} u ON u.${col('id')} = s.${col('user_id')}
      WHERE s.${col('user_id')} = ? AND s.${col('supporter_id')} = ?`)
    .bind(row.owner, userId)
    .first<Record<string, unknown>>();
  return person(accepted!);
}

// ─── Both sides' lists ──────────────────────────────────────────────────────

function person(row: Record<string, unknown>): CanonSupportPerson {
  return {
    id: row.id as string,
    name: typeof row.name === 'string' && row.name.trim() ? row.name.trim() : '',
    withInstructions: Number(row.with_instructions) === 1,
    since: row.created_at as string,
  };
}

/** The believer's support people, by their account's name, the earliest first. */
export async function listMyCanonSupporters(ctx: ApiContext): Promise<CanonSupportPerson[]> {
  const userId = signedIn(ctx);
  const { results } = await ctx.db
    .prepare(`SELECT s.${col('id')} AS id, u.${col('name')} AS name, s.${col('with_instructions')} AS with_instructions, s.${col('created_at')} AS created_at
      FROM ${SUPPORTERS} s JOIN ${USERS} u ON u.${col('id')} = s.${col('supporter_id')}
      WHERE s.${col('user_id')} = ? ORDER BY s.${col('created_at')} LIMIT ${CANON_SUPPORTERS_PER_ACCOUNT}`)
    .bind(userId)
    .all<Record<string, unknown>>();
  return results.map(person);
}

/** Those the account supports: by the name their invite showed, or their account's. */
export async function listCanonsISupport(ctx: ApiContext): Promise<CanonSupportPerson[]> {
  const userId = signedIn(ctx);
  const { results } = await ctx.db
    .prepare(`SELECT s.${col('id')} AS id, coalesce(s.${col('sharer_name')}, u.${col('name')}) AS name, s.${col('with_instructions')} AS with_instructions, s.${col('created_at')} AS created_at
      FROM ${SUPPORTERS} s JOIN ${USERS} u ON u.${col('id')} = s.${col('user_id')}
      WHERE s.${col('supporter_id')} = ? ORDER BY s.${col('created_at')} LIMIT ${CANON_SUPPORTERS_PER_ACCOUNT}`)
    .bind(userId)
    .all<Record<string, unknown>>();
  return results.map(person);
}

/** The believer removes one of their support people. */
export async function removeMyCanonSupporter(ctx: ApiContext, id: unknown): Promise<{ deleted: string }> {
  const userId = signedIn(ctx);
  const { meta } = await ctx.db.prepare(`DELETE FROM ${SUPPORTERS} WHERE ${col('id')} = ? AND ${col('user_id')} = ?`).bind(String(id ?? ''), userId).run();
  if (!meta.changes) raise('Support person not found', 'P0002');
  return { deleted: String(id) };
}

/** A support person stops supporting someone. */
export async function stopSupportingCanon(ctx: ApiContext, id: unknown): Promise<{ deleted: string }> {
  const userId = signedIn(ctx);
  const { meta } = await ctx.db.prepare(`DELETE FROM ${SUPPORTERS} WHERE ${col('id')} = ? AND ${col('supporter_id')} = ?`).bind(String(id ?? ''), userId).run();
  if (!meta.changes) raise('Not found among those you support', 'P0002');
  return { deleted: String(id) };
}

// ─── What a support person sees ─────────────────────────────────────────────

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function dayArg(value: unknown, what: string): string {
  if (typeof value !== 'string' || !DAY.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) raise(`The ${what} must be a day, YYYY-MM-DD`, '22007');
  return value;
}

/**
 * The canon of someone the account supports, as it is now, with its marks for
 * the days from p_from_day to p_to_day (at most CANON_SUPPORT_DAYS of them),
 * and the instructions when their invite included them.
 */
export async function getSupportedCanon(ctx: ApiContext, args: Args): Promise<SupportedCanon> {
  const userId = signedIn(ctx);
  const from = dayArg(args.p_from_day, 'first day');
  const to = dayArg(args.p_to_day, 'last day');
  const span = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
  if (span < 0 || span >= CANON_SUPPORT_DAYS) raise(`Ask for one to ${CANON_SUPPORT_DAYS} days at a time`, '22023');

  const link = linkId(args.p_id);
  const row = link
    ? await ctx.db
      .prepare(`SELECT s.${col('user_id')} AS owner, coalesce(s.${col('sharer_name')}, u.${col('name')}) AS name, s.${col('with_instructions')} AS with_instructions
        FROM ${SUPPORTERS} s JOIN ${USERS} u ON u.${col('id')} = s.${col('user_id')}
        WHERE s.${col('id')} = ? AND s.${col('supporter_id')} = ?`)
      .bind(link, userId)
      .first<{ owner: string; name: string | null; with_instructions: number }>()
    : null;
  if (!row) raise('You no longer support this canon', 'P0002');

  const canon = await ctx.db
    .prepare(`SELECT ${col('items')} AS items, ${col('updated_at')} AS updated_at FROM ${CANONS} WHERE ${col('user_id')} = ?`)
    .bind(row.owner)
    .first<{ items: string; updated_at: string }>();
  const { results } = await ctx.db
    .prepare(`SELECT ${col('day')} AS day, ${col('marks')} AS marks FROM ${DAYS} WHERE ${col('user_id')} = ? AND ${col('day')} BETWEEN ? AND ? ORDER BY ${col('day')}`)
    .bind(row.owner, from, to)
    .all<{ day: string; marks: string }>();
  const notes = row.with_instructions === 1
    ? await ctx.db.prepare(`SELECT ${col('instructions')} AS instructions FROM ${NOTES} WHERE ${col('user_id')} = ?`).bind(row.owner).first<{ instructions: string }>()
    : null;

  const items = canon ? json(canon.items, []) : [];
  return {
    id: link!,
    name: row.name?.trim() ?? '',
    items: Array.isArray(items) ? items : [],
    days: Object.fromEntries(results.map((day) => [day.day, json(day.marks, {})])),
    instructions: notes?.instructions?.trim() ? notes.instructions : null,
    updatedAt: canon?.updated_at ?? null,
  };
}

const SIGNED_IN = ['authenticated'];
const EVERYONE = ['anon', 'authenticated'];
const ID = { name: 'p_id', type: 'text' };

export const CANON_SUPPORT_FUNCTIONS: Record<string, FunctionInfo> = {
  'public.create_canon_support_invite': {
    roles: SIGNED_IN,
    returns: 'jsonb',
    params: [
      { name: 'p_name', type: 'text', default: null },
      { name: 'p_message', type: 'text', default: null },
      { name: 'p_with_instructions', type: 'boolean', default: null },
    ],
  },
  'public.list_my_canon_support_invites': { roles: SIGNED_IN, returns: 'jsonb', params: [] },
  'public.delete_my_canon_support_invite': { roles: SIGNED_IN, returns: 'jsonb', params: [ID] },
  'public.get_canon_support_invite': { roles: EVERYONE, returns: 'jsonb', params: [ID] },
  'public.accept_canon_support_invite': { roles: SIGNED_IN, returns: 'jsonb', params: [ID] },
  'public.list_my_canon_supporters': { roles: SIGNED_IN, returns: 'jsonb', params: [] },
  'public.remove_my_canon_supporter': { roles: SIGNED_IN, returns: 'jsonb', params: [ID] },
  'public.list_canons_i_support': { roles: SIGNED_IN, returns: 'jsonb', params: [] },
  'public.stop_supporting_canon': { roles: SIGNED_IN, returns: 'jsonb', params: [ID] },
  'public.get_supported_canon': {
    roles: SIGNED_IN,
    returns: 'jsonb',
    params: [ID, { name: 'p_from_day', type: 'text' }, { name: 'p_to_day', type: 'text' }],
  },
};

export const canonSupportRpcs: Record<string, Rpc> = {
  'public.create_canon_support_invite': (c, a) => createCanonSupportInvite(c, a),
  'public.list_my_canon_support_invites': (c) => listMyCanonSupportInvites(c),
  'public.delete_my_canon_support_invite': (c, a) => deleteMyCanonSupportInvite(c, a.p_id),
  'public.get_canon_support_invite': (c, a) => getCanonSupportInvite(c, a.p_id),
  'public.accept_canon_support_invite': (c, a) => acceptCanonSupportInvite(c, a.p_id),
  'public.list_my_canon_supporters': (c) => listMyCanonSupporters(c),
  'public.remove_my_canon_supporter': (c, a) => removeMyCanonSupporter(c, a.p_id),
  'public.list_canons_i_support': (c) => listCanonsISupport(c),
  'public.stop_supporting_canon': (c, a) => stopSupportingCanon(c, a.p_id),
  'public.get_supported_canon': (c, a) => getSupportedCanon(c, a),
};
