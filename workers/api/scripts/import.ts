/**
 * Copies the user data and the sign-in accounts from Supabase to D1 (Phase 2
 * of docs/coptic-vine-d1-plan.md). Re-runnable: each run replaces every user
 * table and the sign-in tables in D1 with the export.
 *
 *   npm run export-sql > export.sql      the read-only export query; run it in the
 *                                        Supabase SQL editor or the Supabase MCP's
 *                                        execute_sql and save the result
 *   npm run import -- --from <file>      load it into the remote D1
 *   npm run import -- --from <file> --local      into the local D1 (wrangler dev)
 *   npm run import -- --from <file> --dry-run    check everything, write nothing
 *
 * The export holds personal data (emails, password hashes): keep it out of
 * the repository, in a scratch folder, and delete it after.
 *
 * Every value is checked before anything is written: each column's type and
 * NOT NULL, timestamps in the stored form, JSON that parses. The SQL goes to
 * D1 as one file through D1's import API, which applies all of it or none;
 * foreign keys are checked when it commits (two cycles run through creator
 * accounts, artists and media assets). Users sign in again after the cutover,
 * so sessions are not copied. Verify with `npm run verify`.
 *
 * Sign-in accounts: Supabase's email identity becomes a 'credential' account
 * holding the user's bcrypt hash (the Worker checks those as they are; new
 * passwords get Better Auth's own hash), and a Google identity a 'google'
 * account keyed by Google's subject id.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { col, t } from '../../content-api/src/db/names.ts';
import { executeFile, type Target } from '../../content-api/scripts/lib/d1.ts';
import type { UserSchema, UserTable } from './gen-schema.ts';
import { readSavedValue, type AuthIdentity, type AuthUser, type UserExport } from './lib/export.ts';
import { userSchema } from './lib/schema.ts';

const MAX_STATEMENT_BYTES = 90_000;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?\+00:00$/;
const AUTH_TABLES: [string, string][] = [['auth', 'verifications'], ['auth', 'sessions'], ['auth', 'accounts'], ['auth', 'users']];

const quoteText = (value: string) => `'${value.replaceAll("'", "''")}'`;

type Column = UserTable['columns'][number];

/** One value as a SQLite literal, refusing anything that wouldn't arrive exactly as it is in Postgres. */
export function literal(value: unknown, column: Pick<Column, 'name' | 'kind' | 'notNull'>, where: string): string {
  if (value === null || value === undefined) {
    if (column.notNull) throw new Error(`${where}: ${column.name} is null but NOT NULL`);
    return 'NULL';
  }
  const fail = (what: string) => new Error(`${where}: ${column.name} ${what}`);
  switch (column.kind) {
    case 'text':
      if (typeof value !== 'string') throw fail('is not text');
      return quoteText(value);
    case 'timestamptz':
      if (typeof value !== 'string' || !TIMESTAMP.test(value)) throw fail(`is not a UTC timestamp: ${String(value)}`);
      return quoteText(value);
    case 'date':
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw fail(`is not a date: ${String(value)}`);
      return quoteText(value);
    case 'jsonb':
      if (typeof value !== 'string') throw fail("didn't arrive as Postgres's text");
      JSON.parse(value);
      return quoteText(value);
    case 'array':
      if (typeof value !== 'string' || !Array.isArray(JSON.parse(value))) throw fail('is not a JSON array');
      return quoteText(value);
    case 'boolean':
      if (typeof value !== 'boolean') throw fail('is not a boolean');
      return value ? '1' : '0';
    case 'integer':
      if (typeof value !== 'number' || !Number.isSafeInteger(value)) throw fail(`is not an integer: ${String(value)}`);
      return String(value);
    case 'float4':
      if (typeof value !== 'number' || !Number.isFinite(value)) throw fail(`is not a number: ${String(value)}`);
      return String(value);
  }
}

/** INSERT statements for rows of the given columns, each under D1's statement size limit. */
export function insertStatements(schema: string, table: string, columns: Pick<Column, 'name' | 'kind' | 'notNull'>[], rows: unknown[][]): string[] {
  const head = `INSERT INTO ${t(schema, table)} (${columns.map((column) => col(column.name)).join(', ')}) VALUES\n`;
  const statements: string[] = [];
  let values: string[] = [];
  let bytes = Buffer.byteLength(head);
  for (const [index, row] of rows.entries()) {
    const where = `${schema}.${table} row ${index + 1}`;
    if (row.length !== columns.length) throw new Error(`${where} has ${row.length} values for ${columns.length} columns`);
    const tuple = `(${row.map((value, i) => literal(value, columns[i], where)).join(', ')})`;
    const size = Buffer.byteLength(tuple) + 2;
    if (Buffer.byteLength(head) + size > MAX_STATEMENT_BYTES) throw new Error(`${where} is ${size} bytes, past D1's statement limit`);
    if (bytes + size > MAX_STATEMENT_BYTES) {
      statements.push(`${head}${values.join(',\n')};`);
      values = [];
      bytes = Buffer.byteLength(head);
    }
    values.push(tuple);
    bytes += size;
  }
  if (values.length) statements.push(`${head}${values.join(',\n')};`);
  return statements;
}

/** Parents before children where the foreign keys allow it; the two cycles are left to the deferred check. */
export function loadOrder(tables: UserTable[]): UserTable[] {
  const byName = new Map(tables.map((table) => [`${table.schema}.${table.table}`, table]));
  const ordered: UserTable[] = [];
  const state = new Map<string, 'visiting' | 'done'>();
  const visit = (name: string) => {
    if (state.get(name)) return;
    state.set(name, 'visiting');
    for (const parent of byName.get(name)!.parents) if (byName.has(parent)) visit(parent);
    state.set(name, 'done');
    ordered.push(byName.get(name)!);
  };
  for (const name of [...byName.keys()].sort()) visit(name);
  return ordered;
}

type AuthRows = { users: unknown[][]; accounts: unknown[][] };

export const AUTH_USER_COLUMNS: Column[] = [
  ['id', 'text', true], ['name', 'text', true], ['email', 'text', true], ['email_verified', 'boolean', true], ['image', 'text', false],
  ['raw_user_meta_data', 'jsonb', true], ['raw_app_meta_data', 'jsonb', true], ['created_at', 'timestamptz', true], ['updated_at', 'timestamptz', true],
].map(([name, kind, notNull]) => ({ name, kind, notNull, pgType: '', generated: false }) as Column);

export const AUTH_ACCOUNT_COLUMNS: Column[] = [
  ['id', 'text', true], ['user_id', 'text', true], ['account_id', 'text', true], ['provider_id', 'text', true], ['password', 'text', false],
  ['created_at', 'timestamptz', true], ['updated_at', 'timestamptz', true],
].map(([name, kind, notNull]) => ({ name, kind, notNull, pgType: '', generated: false }) as Column);

/** Supabase's auth.users and auth.identities as Better Auth's users and accounts. */
export function authRows(users: AuthUser[], identities: AuthIdentity[]): AuthRows {
  const out: AuthRows = { users: [], accounts: [] };
  for (const user of users) {
    if (user.deletedAt) continue;
    const meta = JSON.parse(user.rawUserMetaData) as Record<string, unknown>;
    const text = (key: string) => (typeof meta[key] === 'string' && (meta[key] as string).trim() ? (meta[key] as string).trim() : null);
    const email = user.email.toLowerCase();
    out.users.push([
      user.id, text('full_name') ?? text('name') ?? email.split('@')[0], email, user.emailConfirmedAt != null,
      text('chc_avatar_url') ?? text('avatar_url') ?? text('picture'), user.rawUserMetaData, user.rawAppMetaData, user.createdAt, user.updatedAt,
    ]);
    const mine = identities.filter((identity) => identity.userId === user.id);
    let credential = false;
    for (const identity of mine) {
      if (identity.provider === 'email') {
        if (!user.encryptedPassword) continue;
        credential = true;
        out.accounts.push([identity.id, user.id, user.id, 'credential', user.encryptedPassword, identity.createdAt, identity.updatedAt]);
      } else if (identity.provider === 'google') {
        out.accounts.push([identity.id, user.id, identity.providerId, 'google', null, identity.createdAt, identity.updatedAt]);
      } else {
        throw new Error(`User ${user.id} has a ${identity.provider} identity, which the import doesn't map`);
      }
    }
    // A password set without an email identity (it happens with Supabase's admin API).
    if (!credential && user.encryptedPassword) out.accounts.push([crypto.randomUUID(), user.id, user.id, 'credential', user.encryptedPassword, user.createdAt, user.updatedAt]);
  }
  return out;
}

export function importSql(schema: UserSchema, data: UserExport): { sql: string; counts: Record<string, number> } {
  const statements = ['PRAGMA defer_foreign_keys = true;'];
  for (const [s, tb] of AUTH_TABLES) statements.push(`DELETE FROM ${t(s, tb)};`);
  for (const table of schema.tables) statements.push(`DELETE FROM ${t(table.schema, table.table)};`);
  const counts: Record<string, number> = {};

  const auth = authRows(data.authUsers, data.authIdentities);
  statements.push(...insertStatements('auth', 'users', AUTH_USER_COLUMNS, auth.users));
  statements.push(...insertStatements('auth', 'accounts', AUTH_ACCOUNT_COLUMNS, auth.accounts));
  counts['auth/users'] = auth.users.length;
  counts['auth/accounts'] = auth.accounts.length;

  for (const table of loadOrder(schema.tables)) {
    const key = `${table.schema}/${table.table}`;
    const exported = data.tables[key];
    if (!exported) throw new Error(`The export has no ${key}`);
    const columns = table.columns.filter((column) => !column.generated);
    const names = columns.map((column) => column.name);
    const rows = exported.map((row, index) => {
      const keys = Object.keys(row).sort();
      if (JSON.stringify(keys) !== JSON.stringify([...names].sort())) {
        throw new Error(`${key} row ${index + 1}: the export's columns (${keys.join(', ')}) aren't the schema's; re-run npm run gen:schema from a fresh catalog`);
      }
      // text[] arrives as a JSON array; D1 keeps its text, as Postgres's to_json prints it.
      return columns.map((column) => (column.kind === 'array' && Array.isArray(row[column.name]) ? JSON.stringify(row[column.name]) : row[column.name]));
    });
    statements.push(...insertStatements(table.schema, table.table, columns, rows));
    counts[key] = rows.length;
  }
  return { sql: `${statements.join('\n')}\n`, counts };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const from = args.includes('--from') ? args[args.indexOf('--from') + 1] : null;
  if (!from) throw new Error('Pass --from <the saved export>');
  const target: Target = args.includes('--local') ? 'local' : 'remote';
  const dryRun = args.includes('--dry-run');

  const data = readSavedValue<UserExport>(from, 'export');
  const { sql, counts } = importSql(userSchema, data);
  const rows = Object.values(counts).reduce((sum, n) => sum + n, 0);
  console.log(`Export from ${data.exportedAt}: ${rows} rows in ${Object.keys(counts).length} tables, all checked.`);
  if (dryRun) {
    console.log('Dry run: nothing written.');
  } else {
    // The SQL holds the same personal data as the export: a private temp folder, removed after.
    const dir = mkdtempSync(join(tmpdir(), 'cv-user-import-'));
    const path = join(dir, 'import.sql');
    try {
      writeFileSync(path, sql, { mode: 0o600 });
      executeFile(target, path);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
    console.log(`Loaded into the ${target} D1. Now run npm run verify.`);
  }
}
