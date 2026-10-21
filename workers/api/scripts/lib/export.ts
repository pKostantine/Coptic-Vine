/**
 * Reading the export (lib/sql.ts exportSql) and the checksums from wherever
 * they were saved: the raw JSON value, or the Supabase MCP's execute_sql
 * result file, which wraps it.
 */
import { readFileSync } from 'node:fs';

export type ExportedRow = Record<string, unknown>;
export type AuthUser = {
  id: string; email: string; emailConfirmedAt: string | null; encryptedPassword: string | null;
  rawUserMetaData: string; rawAppMetaData: string; createdAt: string; updatedAt: string;
  deletedAt: string | null; bannedUntil: string | null;
};
export type AuthIdentity = { id: string; userId: string; provider: string; providerId: string; createdAt: string; updatedAt: string };
export type UserExport = { exportedAt: string; tables: Record<string, ExportedRow[]>; authUsers: AuthUser[]; authIdentities: AuthIdentity[] };

/** The single value a saved query returned: the column named `name` of its one row. */
export function readSavedValue<T>(path: string, name: string): T {
  const text = readFileSync(path, 'utf8');
  let outer: unknown = JSON.parse(text);
  if (Array.isArray(outer) && (outer[0] as { type?: string })?.type === 'text') outer = JSON.parse((outer[0] as { text: string }).text);
  if (outer && typeof outer === 'object' && 'result' in outer && typeof (outer as { result: unknown }).result === 'string') {
    const match = (outer as { result: string }).result.match(/<untrusted-data-[0-9a-f-]+>\n([\s\S]*)\n<\/untrusted-data-/);
    if (!match) throw new Error(`${path} is an execute_sql result without its data block`);
    outer = JSON.parse(match[1]);
  }
  if (Array.isArray(outer) && outer.length === 1 && outer[0] && typeof outer[0] === 'object' && name in outer[0]) return (outer[0] as Record<string, T>)[name];
  if (outer && typeof outer === 'object' && !Array.isArray(outer) && name in outer) return (outer as Record<string, T>)[name];
  return outer as T;
}
