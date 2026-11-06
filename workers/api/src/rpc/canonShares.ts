/**
 * Parts of a spiritual canon shared with friends (migration 0045): a copy of
 * the items a believer chose, under a link they hand out themselves, for a
 * friend or a support group to read and take into their own canon. The app
 * asks, before it makes one, that it be shared only with the blessing of the
 * believer's father of confession.
 *
 * Only a signed-in account makes links, and sees and stops its own. Anyone
 * with a link, signed in or not, reads what it holds: the items, the name and
 * message the believer chose to show, and the father of confession's
 * instructions only when they chose to add them. Never the account behind it.
 * The link is a long random id, so it can't be guessed; stopping it deletes
 * the copy.
 *
 * cv-api's own functions, as Supabase never had them, declared in
 * CANON_SHARE_FUNCTIONS the way the dump's are (src/rpc/index.ts).
 */
import { col, t } from '../../../content-api/src/db/names.ts';
import type { FunctionInfo } from '../../scripts/gen-functions.ts';
import { now, raise } from '../pg.ts';
import type { ApiContext } from '../rest/context.ts';
import { CANON_INSTRUCTIONS_LIMIT } from './canonNotes.ts';
import type { Args, Rpc } from './index.ts';

/** The most each may hold, as the table checks it. */
export const CANON_SHARE_LIMITS = { items: 40, itemsLength: 200_000, name: 80, message: 1000, instructions: CANON_INSTRUCTIONS_LIMIT } as const;
/** How many links one account may keep at once. */
export const CANON_SHARES_PER_ACCOUNT = 50;

export type CanonShare = {
  id: string;
  sharerName: string | null;
  message: string | null;
  items: unknown[];
  instructions: string | null;
  createdAt: string;
};

const SHARES = t('public', 'spiritual_canon_shares');
const COLUMNS = ['id', 'sharer_name', 'message', 'items', 'instructions', 'created_at'].map(col).join(', ');

function signedIn(ctx: ApiContext): string {
  if (!ctx.userId) raise('Sign in to share your canon', '42501');
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
function newShareId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function share(row: Record<string, unknown>): CanonShare {
  let items: unknown[] = [];
  try {
    const parsed = JSON.parse(String(row.items));
    if (Array.isArray(parsed)) items = parsed;
  } catch {
    // A row the table checked can't get here; an empty share reads as one.
  }
  return {
    id: row.id as string,
    sharerName: (row.sharer_name as string | null) ?? null,
    message: (row.message as string | null) ?? null,
    items,
    instructions: (row.instructions as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

/** Makes a link to a copy of the items given (one to forty of them), and returns it. */
export async function createCanonShare(ctx: ApiContext, args: Args): Promise<CanonShare> {
  const userId = signedIn(ctx);
  const items = args.p_items;
  if (!Array.isArray(items) || !items.length) raise('Choose something from your canon to share', '22023');
  if (items.length > CANON_SHARE_LIMITS.items) raise(`A share holds at most ${CANON_SHARE_LIMITS.items} items`, '22023');
  if (!items.every((item) => item && typeof item === 'object' && !Array.isArray(item))) raise('Each shared item must be an object', '22023');
  const itemsJson = JSON.stringify(items);
  if (itemsJson.length > CANON_SHARE_LIMITS.itemsLength) raise('What is shared is too long', '22001');
  const name = text(args.p_name, CANON_SHARE_LIMITS.name, 'name');
  const message = text(args.p_message, CANON_SHARE_LIMITS.message, 'message');
  const instructions = text(args.p_instructions, CANON_SHARE_LIMITS.instructions, 'instructions');

  const kept = await ctx.db.prepare(`SELECT count(*) AS n FROM ${SHARES} WHERE ${col('user_id')} = ?`).bind(userId).first<{ n: number }>();
  if ((kept?.n ?? 0) >= CANON_SHARES_PER_ACCOUNT) raise(`You have ${CANON_SHARES_PER_ACCOUNT} shared links. Stop sharing one to make another.`, 'P0001');

  const id = newShareId();
  await ctx.db.prepare(`INSERT INTO ${SHARES} (${col('id')}, ${col('user_id')}, ${COLUMNS.split(', ').slice(1).join(', ')}) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, userId, name, message, itemsJson, instructions, now())
    .run();
  return (await readShare(ctx, id))!;
}

async function readShare(ctx: ApiContext, id: string): Promise<CanonShare | null> {
  const row = await ctx.db.prepare(`SELECT ${COLUMNS} FROM ${SHARES} WHERE ${col('id')} = ?`).bind(id).first<Record<string, unknown>>();
  return row ? share(row) : null;
}

/** What a link holds, for whoever has it; refused when it was stopped or never was. */
export async function getCanonShare(ctx: ApiContext, id: unknown): Promise<CanonShare> {
  const found = typeof id === 'string' && id.length >= 16 && id.length <= 64 ? await readShare(ctx, id) : null;
  if (!found) raise('This shared canon is no longer shared', 'P0002');
  return found;
}

/** The account's own links, the latest first. */
export async function listMyCanonShares(ctx: ApiContext): Promise<CanonShare[]> {
  const userId = signedIn(ctx);
  const { results } = await ctx.db
    .prepare(`SELECT ${COLUMNS} FROM ${SHARES} WHERE ${col('user_id')} = ? ORDER BY ${col('created_at')} DESC LIMIT ${CANON_SHARES_PER_ACCOUNT}`)
    .bind(userId)
    .all<Record<string, unknown>>();
  return results.map(share);
}

/** Stops one of the account's links: the copy is deleted, and the link opens nothing. */
export async function deleteMyCanonShare(ctx: ApiContext, id: unknown): Promise<{ deleted: string }> {
  const userId = signedIn(ctx);
  const { meta } = await ctx.db.prepare(`DELETE FROM ${SHARES} WHERE ${col('id')} = ? AND ${col('user_id')} = ?`).bind(String(id ?? ''), userId).run();
  if (!meta.changes) raise('Shared canon not found', 'P0002');
  return { deleted: String(id) };
}

const SIGNED_IN = ['authenticated'];
const EVERYONE = ['anon', 'authenticated'];
const ID = { name: 'p_id', type: 'text' };

export const CANON_SHARE_FUNCTIONS: Record<string, FunctionInfo> = {
  'public.create_canon_share': {
    roles: SIGNED_IN,
    returns: 'jsonb',
    params: [
      { name: 'p_items', type: 'jsonb' },
      { name: 'p_name', type: 'text', default: null },
      { name: 'p_message', type: 'text', default: null },
      { name: 'p_instructions', type: 'text', default: null },
    ],
  },
  'public.get_canon_share': { roles: EVERYONE, returns: 'jsonb', params: [ID] },
  'public.list_my_canon_shares': { roles: SIGNED_IN, returns: 'jsonb', params: [] },
  'public.delete_my_canon_share': { roles: SIGNED_IN, returns: 'jsonb', params: [ID] },
};

export const canonShareRpcs: Record<string, Rpc> = {
  'public.create_canon_share': (c, a) => createCanonShare(c, a),
  'public.get_canon_share': (c, a) => getCanonShare(c, a.p_id),
  'public.list_my_canon_shares': (c) => listMyCanonShares(c),
  'public.delete_my_canon_share': (c, a) => deleteMyCanonShare(c, a.p_id),
};
