/**
 * What the ported functions and the table engine need of Postgres's
 * behaviour: errors as PostgREST reports them, jsonb as Postgres stores and
 * prints it, and timestamps in the user data's stored form.
 */
import { PgError } from '../../content-api/src/pg.ts';
import { pgTimestamp } from './time.ts';

export { PgError };
export { jsonb } from '../../content-api/src/pg.ts';

/** An exception raised by a function: RAISE EXCEPTION '<message>' [USING ERRCODE]. PostgREST answers 400 unless the code says otherwise. */
export function raise(message: string, code = 'P0001', details: string | null = null, hint: string | null = null): never {
  throw new PgError(code, message, httpStatus(code, true), details, hint);
}

/** The HTTP status PostgREST gives a SQLSTATE (https://docs.postgrest.org/en/stable/references/errors.html). */
export function httpStatus(code: string, signedIn: boolean): number {
  if (code === '42501') return signedIn ? 403 : 401;
  if (code.startsWith('28')) return 403;
  if (code === '23503' || code === '23505') return 409;
  if (code === '42883' || code === '42P01' || code === 'PGRST202' || code === 'PGRST205') return 404;
  if (code === 'PGRST116') return 406;
  if (code === '40001') return 409;
  if (code.startsWith('53') || code.startsWith('54')) return 503;
  if (code === 'XX000' || code === 'XX001') return 500;
  return 400;
}

const byteLength = (text: string) => new TextEncoder().encode(text).length;

function compareKeys(a: string, b: string): number {
  // jsonb orders object keys by length in bytes, then byte by byte.
  const la = byteLength(a);
  const lb = byteLength(b);
  if (la !== lb) return la - lb;
  return Buffer.compare(Buffer.from(a), Buffer.from(b));
}

/** A JSON value as Postgres prints jsonb (value::text): keys in jsonb's order, ", " and ": " between items. */
export function jsonbText(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return `[${value.map(jsonbText).join(', ')}]`;
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined).sort(([a], [b]) => compareKeys(a, b));
    return `{${entries.map(([key, v]) => `${JSON.stringify(key)}: ${jsonbText(v)}`).join(', ')}}`;
  }
  if (typeof value === 'number' && !Number.isFinite(value)) throw new PgError('22P02', 'invalid input syntax for type json');
  return JSON.stringify(value);
}

/** A value as to_jsonb() would give it back: objects with their keys in jsonb's order, all the way down. */
export function asJsonb(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(asJsonb);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as object).sort(compareKeys)) out[key] = asJsonb((value as Record<string, unknown>)[key]);
    return out;
  }
  return value;
}

/** A timestamptz as Postgres would take it from a client (ISO 8601, any offset), in the stored form. */
export function timestampInput(value: unknown, column: string): string {
  if (typeof value !== 'string') throw new PgError('22007', `invalid input syntax for type timestamp with time zone: "${String(value)}"`, 400, null, column);
  const normalized = value.trim().replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00');
  const date = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(normalized) ? normalized : `${normalized}Z`);
  if (Number.isNaN(date.getTime())) throw new PgError('22007', `invalid input syntax for type timestamp with time zone: "${value}"`);
  // Keep up to microseconds as given; the Date carries only milliseconds.
  const micro = normalized.match(/\.(\d+)/)?.[1];
  const stored = pgTimestamp(date);
  if (micro && micro.length > 3) {
    const fraction = micro.slice(0, 6).replace(/0+$/, '');
    return stored.replace(/(\.\d+)?\+00:00$/, fraction ? `.${fraction}+00:00` : '+00:00');
  }
  return stored;
}

/** now() in the stored form. */
export const now = () => pgTimestamp(new Date());
