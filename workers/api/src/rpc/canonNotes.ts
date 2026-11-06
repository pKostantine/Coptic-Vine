/**
 * The spiritual canon's instructions (migration 0044): what a believer's
 * father of confession told them of their rule, written down in the canon to
 * keep beside it. Each account reads and writes only its own. A save carries
 * when it was written; the later of the account's copy and the one sent is
 * kept, and returned, so a device offline for a while doesn't overwrite what
 * another wrote since.
 *
 * cv-api's own functions, as Supabase never had them, declared in
 * CANON_NOTE_FUNCTIONS the way the dump's are (src/rpc/index.ts).
 */
import { col, t } from '../../../content-api/src/db/names.ts';
import type { FunctionInfo } from '../../scripts/gen-functions.ts';
import { now, raise } from '../pg.ts';
import type { ApiContext } from '../rest/context.ts';
import type { Rpc } from './index.ts';

/** The longest the instructions may be, as the table checks it. */
export const CANON_INSTRUCTIONS_LIMIT = 20_000;

export type CanonInstructions = { instructions: string; updatedAt: string | null };

const NOTES = t('public', 'spiritual_canon_notes');

function signedIn(ctx: ApiContext): string {
  if (!ctx.userId) raise('Sign in to keep the canon’s instructions', '42501');
  return ctx.userId;
}

/** The account's instructions: empty, with no time, when it has never written any. */
export async function getMyCanonInstructions(ctx: ApiContext): Promise<CanonInstructions> {
  const userId = signedIn(ctx);
  const row = await ctx.db
    .prepare(`SELECT ${col('instructions')} AS instructions, ${col('updated_at')} AS updated_at FROM ${NOTES} WHERE ${col('user_id')} = ?`)
    .bind(userId)
    .first<{ instructions: string; updated_at: string }>();
  return row ? { instructions: row.instructions, updatedAt: row.updated_at } : { instructions: '', updatedAt: null };
}

/**
 * Keeps what was sent if it was written later than the account's copy (or
 * the account has none), and returns the copy kept. A time still to come is
 * taken as now, so a device's clock set ahead can't hold the copy forever.
 */
export async function saveMyCanonInstructions(ctx: ApiContext, instructions: unknown, writtenAt: string | null): Promise<CanonInstructions> {
  const userId = signedIn(ctx);
  const text = typeof instructions === 'string' ? instructions : '';
  if (text.length > CANON_INSTRUCTIONS_LIMIT) raise(`The instructions are longer than ${CANON_INSTRUCTIONS_LIMIT} characters`, '22001');
  const stamp = now();
  const at = writtenAt && writtenAt < stamp ? writtenAt : stamp;
  await ctx.db
    .prepare(`INSERT INTO ${NOTES} (${col('user_id')}, ${col('instructions')}, ${col('updated_at')}) VALUES (?, ?, ?)
      ON CONFLICT (${col('user_id')}) DO UPDATE SET ${col('instructions')} = excluded.${col('instructions')}, ${col('updated_at')} = excluded.${col('updated_at')}
      WHERE excluded.${col('updated_at')} > ${NOTES}.${col('updated_at')}`)
    .bind(userId, text, at)
    .run();
  return getMyCanonInstructions(ctx);
}

const SIGNED_IN = ['authenticated'];

export const CANON_NOTE_FUNCTIONS: Record<string, FunctionInfo> = {
  'public.get_my_canon_instructions': { roles: SIGNED_IN, returns: 'jsonb', params: [] },
  'public.save_my_canon_instructions': {
    roles: SIGNED_IN,
    returns: 'jsonb',
    params: [
      { name: 'p_instructions', type: 'text' },
      { name: 'p_written_at', type: 'timestamp with time zone', default: null },
    ],
  },
};

export const canonNoteRpcs: Record<string, Rpc> = {
  'public.get_my_canon_instructions': (c) => getMyCanonInstructions(c),
  'public.save_my_canon_instructions': (c, a) => saveMyCanonInstructions(c, a.p_instructions, (a.p_written_at as string | null) ?? null),
};
