/**
 * The beta's feedback (migration 0036): what the app's testers report as
 * they test it, numbered as issues are (#1, #2, ...) and public. Anyone may
 * read the whole list, and file one, signed in or not: a bug, an idea, or a
 * fault in a text, with where in the app it was and the device. An admin sets
 * each one's status (open, planned, fixed, not planned, a duplicate) with a
 * note, or deletes it. Nobody's email or id is ever shown: only the name they
 * gave, or their account's.
 *
 * cv-api's own functions, as Supabase never had them, declared in
 * FEEDBACK_FUNCTIONS the way the dump's are (src/rpc/index.ts). Temporary,
 * for the beta.
 */
import { col, t } from '../../../content-api/src/db/names.ts';
import type { FunctionInfo } from '../../scripts/gen-functions.ts';
import { now, raise } from '../pg.ts';
import type { ApiContext } from '../rest/context.ts';
import { pgTimestamp } from '../time.ts';
import { requireSignedInAdmin } from './admin/shared.ts';
import { viewer } from './common.ts';
import type { Args, Rpc } from './index.ts';

export const FEEDBACK_KINDS = ['bug', 'idea', 'text'] as const;
export const FEEDBACK_STATUSES = ['open', 'planned', 'fixed', 'not_planned', 'duplicate'] as const;

/** The longest each field may be, as the table checks them. */
export const FEEDBACK_LIMITS = { title: 120, details: 4000, area: 120, device: 200, name: 80, note: 500 } as const;

/** How many may be filed in an hour: by one account, and by everyone signed out together. */
export const FEEDBACK_PER_HOUR = { account: 20, signedOut: 30 } as const;

export type FeedbackItem = {
  id: string;
  number: number;
  kind: (typeof FEEDBACK_KINDS)[number];
  title: string;
  details: string;
  area: string | null;
  device: string | null;
  reporterName: string | null;
  status: (typeof FEEDBACK_STATUSES)[number];
  statusNote: string | null;
  createdAt: string;
  updatedAt: string;
  /** Filed by whoever is asking. */
  mine: boolean;
};

const FEEDBACK = t('public', 'beta_feedback');
const COLUMNS = ['id', 'number', 'kind', 'title', 'details', 'area', 'device', 'reporter_name', 'user_id', 'status', 'status_note', 'created_at', 'updated_at']
  .map(col).join(', ');

/** A text argument trimmed, or null when empty; refused when required and empty, or too long. */
function text(value: unknown, limit: number, what: string, required = false): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) {
    if (required) raise(`A ${what} is required`, '22023');
    return null;
  }
  if (trimmed.length > limit) raise(`The ${what} is longer than ${limit} characters`, '22001');
  return trimmed;
}

function item(row: Record<string, unknown>, userId: string | null): FeedbackItem {
  return {
    id: row.id as string,
    number: Number(row.number),
    kind: row.kind as FeedbackItem['kind'],
    title: row.title as string,
    details: row.details as string,
    area: (row.area as string | null) ?? null,
    device: (row.device as string | null) ?? null,
    reporterName: (row.reporter_name as string | null) ?? null,
    status: row.status as FeedbackItem['status'],
    statusNote: (row.status_note as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    mine: Boolean(userId) && row.user_id === userId,
  };
}

async function read(ctx: ApiContext, id: string): Promise<FeedbackItem> {
  const row = await ctx.db.prepare(`SELECT ${COLUMNS} FROM ${FEEDBACK} WHERE ${col('id')} = ?`).bind(id).first<Record<string, unknown>>();
  if (!row) raise('Feedback not found', 'P0002');
  return item(row, ctx.userId);
}

/** Files one, numbered after the last. Named by the name given, or the account's. */
export async function submitBetaFeedback(ctx: ApiContext, args: Args): Promise<FeedbackItem> {
  const kind = String(args.p_kind ?? '');
  if (!(FEEDBACK_KINDS as readonly string[]).includes(kind)) raise(`Unknown kind of feedback: "${kind}"`, '22023');
  const title = text(args.p_title, FEEDBACK_LIMITS.title, 'title', true)!;
  const details = text(args.p_details, FEEDBACK_LIMITS.details, 'description') ?? '';
  const area = text(args.p_area, FEEDBACK_LIMITS.area, 'place in the app');
  const device = text(args.p_device, FEEDBACK_LIMITS.device, 'device');
  let name = text(args.p_name, FEEDBACK_LIMITS.name, 'name');

  const since = pgTimestamp(new Date(Date.now() - 60 * 60 * 1000));
  const recent = await ctx.db
    .prepare(`SELECT count(*) AS n FROM ${FEEDBACK} WHERE ${ctx.userId ? `${col('user_id')} = ?` : `${col('user_id')} IS NULL`} AND ${col('created_at')} > ?`)
    .bind(...(ctx.userId ? [ctx.userId, since] : [since]))
    .first<{ n: number }>();
  if ((recent?.n ?? 0) >= (ctx.userId ? FEEDBACK_PER_HOUR.account : FEEDBACK_PER_HOUR.signedOut)) {
    raise('Too much feedback in the last hour. Try again a little later.', 'P0001');
  }

  if (!name && ctx.userId) {
    const account = await ctx.db.prepare(`SELECT ${col('name')} AS name FROM ${t('auth', 'users')} WHERE ${col('id')} = ?`).bind(ctx.userId).first<{ name: string | null }>();
    name = account?.name?.trim().slice(0, FEEDBACK_LIMITS.name) || null;
  }

  const id = crypto.randomUUID();
  const stamp = now();
  await ctx.db.prepare(`INSERT INTO ${FEEDBACK} (${COLUMNS})
      SELECT ?, coalesce(max(${col('number')}), 0) + 1, ?, ?, ?, ?, ?, ?, ?, 'open', NULL, ?, ? FROM ${FEEDBACK}`)
    .bind(id, kind, title, details, area, device, name, ctx.userId, stamp, stamp)
    .run();
  return read(ctx, id);
}

/** Every one, the latest first, and whether whoever is asking may set their status. */
export async function listBetaFeedback(ctx: ApiContext): Promise<{ items: FeedbackItem[]; canManage: boolean }> {
  const { results } = await ctx.db.prepare(`SELECT ${COLUMNS} FROM ${FEEDBACK} ORDER BY ${col('number')} DESC LIMIT 1000`).all<Record<string, unknown>>();
  const canManage = ctx.userId ? (await viewer(ctx)).admin : false;
  return { items: results.map((row) => item(row, ctx.userId)), canManage };
}

/** An admin sets one's status, and a note to go with it (none clears it). */
export async function adminUpdateBetaFeedback(ctx: ApiContext, id: string, status: string, note: unknown): Promise<FeedbackItem> {
  await requireSignedInAdmin(ctx);
  if (!(FEEDBACK_STATUSES as readonly string[]).includes(status)) raise(`Unknown status: "${status}"`, '22023');
  const statusNote = text(note, FEEDBACK_LIMITS.note, 'note');
  const { meta } = await ctx.db
    .prepare(`UPDATE ${FEEDBACK} SET ${col('status')} = ?, ${col('status_note')} = ?, ${col('updated_at')} = ? WHERE ${col('id')} = ?`)
    .bind(status, statusNote, now(), id)
    .run();
  if (!meta.changes) raise('Feedback not found', 'P0002');
  return read(ctx, id);
}

/** An admin deletes one: spam, or filed by mistake. Its number isn't given again. */
export async function adminDeleteBetaFeedback(ctx: ApiContext, id: string): Promise<{ deleted: string }> {
  await requireSignedInAdmin(ctx);
  const { meta } = await ctx.db.prepare(`DELETE FROM ${FEEDBACK} WHERE ${col('id')} = ?`).bind(id).run();
  if (!meta.changes) raise('Feedback not found', 'P0002');
  return { deleted: id };
}

const EVERYONE = ['anon', 'authenticated'];
const ADMIN_ONLY = ['authenticated'];
const ID = { name: 'p_id', type: 'uuid' };

export const FEEDBACK_FUNCTIONS: Record<string, FunctionInfo> = {
  'public.submit_beta_feedback': {
    roles: EVERYONE,
    returns: 'jsonb',
    params: [
      { name: 'p_kind', type: 'text' },
      { name: 'p_title', type: 'text' },
      { name: 'p_details', type: 'text', default: null },
      { name: 'p_area', type: 'text', default: null },
      { name: 'p_device', type: 'text', default: null },
      { name: 'p_name', type: 'text', default: null },
    ],
  },
  'public.list_beta_feedback': { roles: EVERYONE, returns: 'jsonb', params: [] },
  'public.admin_update_beta_feedback': { roles: ADMIN_ONLY, returns: 'jsonb', params: [ID, { name: 'p_status', type: 'text' }, { name: 'p_note', type: 'text', default: null }] },
  'public.admin_delete_beta_feedback': { roles: ADMIN_ONLY, returns: 'jsonb', params: [ID] },
};

export const feedbackRpcs: Record<string, Rpc> = {
  'public.submit_beta_feedback': (c, a) => submitBetaFeedback(c, a),
  'public.list_beta_feedback': (c) => listBetaFeedback(c),
  'public.admin_update_beta_feedback': (c, a) => adminUpdateBetaFeedback(c, a.p_id as string, String(a.p_status ?? ''), a.p_note),
  'public.admin_delete_beta_feedback': (c, a) => adminDeleteBetaFeedback(c, a.p_id as string),
};
