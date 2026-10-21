/**
 * What the admin functions share (CV-Admin): the admin checks, worded as each
 * function words them, jsonb_strip_nulls, ILIKE, and Postgres's enum orders.
 */
import enums from '../../../schema/user-tables.json' with { type: 'json' };
import { raise } from '../../pg.ts';
import type { ApiContext } from '../../rest/context.ts';
import { viewer } from '../common.ts';

export * from '../creator/shared.ts';

/** `auth.uid() is null or not private.is_admin()`: 'Admin role required' (42501) either way. */
export async function requireAdmin(ctx: ApiContext): Promise<string> {
  if (!ctx.userId || !(await viewer(ctx)).admin) raise('Admin role required', '42501');
  return ctx.userId!;
}

/** `auth.uid() is null`: 'Authentication required' (28000); then `not private.is_admin()`: 'Admin role required' (42501). */
export async function requireSignedInAdmin(ctx: ApiContext): Promise<string> {
  if (!ctx.userId) raise('Authentication required', '28000');
  if (!(await viewer(ctx)).admin) raise('Admin role required', '42501');
  return ctx.userId!;
}

/** jsonb_strip_nulls: object fields that are null removed, all the way down; null array elements stay. */
export function stripNullsDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripNullsDeep);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== null && v !== undefined).map(([k, v]) => [k, stripNullsDeep(v)]));
  }
  return value;
}

const escapeRegex = (ch: string) => ch.replace(/[\\^$.*+?()[\]{}|/-]/g, '\\$&');

/** value ILIKE pattern: % any run, _ one character, \ escapes the next; letters match in either case. */
export function ilike(value: string, pattern: string): boolean {
  const chars = [...pattern.toLowerCase()];
  let source = '';
  for (let i = 0; i < chars.length; i += 1) {
    const ch = chars[i];
    if (ch === '\\') {
      i += 1;
      if (i >= chars.length) raise('LIKE pattern must not end with escape character', '22025');
      source += escapeRegex(chars[i]);
    } else if (ch === '%') source += '[\\s\\S]*';
    else if (ch === '_') source += '[\\s\\S]';
    else source += escapeRegex(ch);
  }
  return new RegExp(`^${source}$`, 'u').test(value.toLowerCase());
}

const ENUMS = (enums as unknown as { enums: Record<string, string[]> }).enums;

/** The values of an enum type, in its declared order. */
export const enumValues = (type: string): string[] => ENUMS[type];

/** ORDER BY an enum column: its declared order, nulls last. */
export const enumOrder = (type: string) => (a: unknown, b: unknown) => {
  if (a == null) return b == null ? 0 : 1;
  if (b == null) return -1;
  return ENUMS[type].indexOf(a as string) - ENUMS[type].indexOf(b as string);
};
