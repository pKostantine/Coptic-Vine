/**
 * Timestamps as D1 stores them for the user data (scripts/gen-schema.ts):
 * Supabase's REST form, always UTC, the fraction without trailing zeros:
 * 2026-10-20T19:52:43.5+00:00. String order is then time order.
 */
export function pgTimestamp(date: Date): string {
  const iso = date.toISOString(); // 2026-10-20T19:52:43.500Z
  const [whole, fraction] = iso.slice(0, -1).split('.');
  const trimmed = (fraction ?? '').replace(/0+$/, '');
  return `${whole}${trimmed ? `.${trimmed}` : ''}+00:00`;
}

/** An ISO string in JavaScript's form (…Z) in the stored form; anything else is left as it is. */
export function storedTimestamp(value: string): string {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(value) ? pgTimestamp(new Date(value)) : value;
}
