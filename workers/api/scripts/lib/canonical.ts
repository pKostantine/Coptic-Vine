/**
 * A user-data row's canonical form, the same as lib/sql.ts pgChecksumSql
 * writes in Postgres: a JSON array of the copied columns in order, where
 * everything stored as text (text, uuid, enums, timestamptz, dates, jsonb,
 * text[]) is a JSON string of that text, numbers are their digits, and
 * booleans true or false. A table's checksum is the SHA-256 of its lines
 * sorted by their UTF-8 bytes and joined with "\n" (as in Phase 1).
 */
import type { UserColumnKind, UserTable } from '../gen-schema.ts';
export { tableChecksum } from '../../../content-api/scripts/lib/canonical.ts';

export function canonicalValue(value: unknown, kind: UserColumnKind): string {
  if (value === null || value === undefined) return 'null';
  switch (kind) {
    case 'integer': case 'float4':
      if (typeof value !== 'number') throw new Error(`Expected a number, got ${typeof value}`);
      return String(value);
    case 'boolean':
      if (value === 1 || value === true) return 'true';
      if (value === 0 || value === false) return 'false';
      throw new Error(`Expected 0 or 1, got ${String(value)}`);
    default:
      if (typeof value !== 'string') throw new Error(`Expected text, got ${typeof value}`);
      return JSON.stringify(value);
  }
}

export function canonicalLine(row: Record<string, unknown>, table: UserTable): string {
  return `[${table.columns.map((column) => canonicalValue(row[column.name], column.kind)).join(',')}]`;
}
