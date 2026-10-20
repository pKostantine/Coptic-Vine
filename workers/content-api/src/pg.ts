/**
 * What the ported functions need to behave as Postgres does: its errors as
 * PostgREST reports them, its text ordering (the database collates with ICU
 * en-US), its date arithmetic, and its jsonb key order.
 */

/** A Postgres or PostgREST error, answered with the same status and body PostgREST gives. */
export class PgError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: string | null;
  readonly hint: string | null;

  constructor(code: string, message: string, status = 400, details: string | null = null, hint: string | null = null) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
    this.hint = hint;
  }

  body() {
    return { code: this.code, details: this.details, hint: this.hint, message: this.message };
  }
}

const collator = new Intl.Collator('en-US');

/** Postgres's ORDER BY on text: ICU en-US, ties broken by the bytes (the database collation is deterministic). */
export function compareText(a: string, b: string): number {
  const order = collator.compare(a, b);
  if (order) return order;
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Postgres's btrim(text): spaces only, not tabs or newlines. */
export function btrim(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && value[start] === ' ') start += 1;
  while (end > start && value[end - 1] === ' ') end -= 1;
  return value.slice(start, end);
}

/** nullif(btrim(value), '') */
export function trimmedOrNull(value: unknown): string | null {
  if (value == null) return null;
  const trimmed = btrim(String(value));
  return trimmed === '' ? null : trimmed;
}

const MS_PER_DAY = 86_400_000;

/** A date as a day number, for arithmetic: day('2026-10-19') + 1 is the next day. */
export function day(iso: string): number {
  return Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / MS_PER_DAY;
}

export function isoDate(dayNumber: number): string {
  return new Date(dayNumber * MS_PER_DAY).toISOString().slice(0, 10);
}

/** A date argument as Postgres's date input reads the ISO form the app sends. */
export function dateArg(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  const match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ][0-9:.+-]*Z?)?$/);
  if (!match) throw new PgError('22007', `invalid input syntax for type date: "${String(value)}"`);
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const iso = `${match[1]}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  if (m < 1 || m > 12 || d < 1 || isoDate(day(iso)) !== iso) throw new PgError('22008', `date/time field value out of range: "${String(value)}"`);
  void y;
  return iso;
}

/** An integer argument or cast, with Postgres's int4 input rules and errors. */
export function int4(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) throw new PgError('22P02', `invalid input syntax for type integer: "${value}"`);
    return checkRange(value, String(value));
  }
  const text = String(value);
  if (!/^\s*[+-]?\d+\s*$/.test(text)) throw new PgError('22P02', `invalid input syntax for type integer: "${text}"`);
  return checkRange(Number(text.trim()), text);
}

function checkRange(value: number, text: string): number {
  if (value > 2147483647 || value < -2147483648) throw new PgError('22003', `value "${text}" is out of range for type integer`);
  return value;
}

/** An object with its keys in jsonb's order (shorter keys first, then by bytes), so a ported jsonb result prints as Postgres prints it. */
export function jsonb<T extends Record<string, unknown>>(object: T): T {
  const keys = Object.keys(object).sort((a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0));
  const out: Record<string, unknown> = {};
  for (const key of keys) out[key] = object[key];
  return out as T;
}
