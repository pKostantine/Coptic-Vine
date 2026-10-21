/**
 * Proves the user data arrived intact: every table's SHA-256 over its
 * canonical rows (lib/canonical.ts), in D1 against Postgres's own, and the
 * users' ids and emails. Counts alone have looked right before while rows
 * were misaligned, so the checksums are the test.
 *
 *   npm run verify -- --print-pg-sql > pg.sql     the read-only Postgres side
 *   npm run verify -- --pg <saved result>         compare with the remote D1
 *   npm run verify -- --pg <saved result> --local
 *
 * Only counts and hashes are printed, never a row.
 */
import { fileURLToPath } from 'node:url';
import { col, t } from '../../content-api/src/db/names.ts';
import { queryAll, type Target } from '../../content-api/scripts/lib/d1.ts';
import { canonicalLine, tableChecksum } from './lib/canonical.ts';
import { readSavedValue } from './lib/export.ts';
import { userSchema } from './lib/schema.ts';
import { pgChecksumSql } from './lib/sql.ts';

type Checksums = Record<string, { rows: number; sha256: string }>;

export function d1Checksums(target: Target): Checksums {
  const statements = userSchema.tables.map((table) => `SELECT ${table.columns.map((column) => col(column.name)).join(', ')} FROM ${t(table.schema, table.table)}`);
  statements.push(`SELECT ${col('id')}, lower(${col('email')}) AS ${col('email')} FROM ${t('auth', 'users')}`);
  const results = queryAll<Record<string, unknown>>(target, `${statements.join(';\n')};`);
  const out: Checksums = {};
  userSchema.tables.forEach((table, index) => {
    const lines = results[index].map((row) => canonicalLine(row, table));
    out[`${table.schema}/${table.table}`] = { rows: lines.length, sha256: tableChecksum(lines) };
  });
  const users = results[results.length - 1].map((row) => `[${JSON.stringify(row.id)},${JSON.stringify(row.email)}]`);
  out['auth/users'] = { rows: users.length, sha256: tableChecksum(users) };
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.includes('--print-pg-sql')) {
    process.stdout.write(pgChecksumSql(userSchema));
  } else {
    const from = args.includes('--pg') ? args[args.indexOf('--pg') + 1] : null;
    if (!from) throw new Error('Pass --pg <saved Postgres checksums>, or --print-pg-sql');
    const target: Target = args.includes('--local') ? 'local' : 'remote';
    const pg = readSavedValue<Checksums>(from, 'checksums');
    const started = Date.now();
    const d1 = d1Checksums(target);
    const names = [...new Set([...Object.keys(pg), ...Object.keys(d1)])].sort();
    const bad = names.filter((name) => !pg[name] || !d1[name] || pg[name].rows !== d1[name].rows || pg[name].sha256 !== d1[name].sha256);
    const rows = Object.values(d1).reduce((sum, table) => sum + table.rows, 0);
    console.log(`Checked against the ${target} D1 in ${((Date.now() - started) / 1000).toFixed(0)} s: ${names.length - bad.length} of ${names.length} tables match (${rows} rows in D1).`);
    for (const name of bad) console.log(`  ${name}: Postgres ${pg[name]?.rows ?? '-'} rows ${pg[name]?.sha256?.slice(0, 12) ?? '-'}, D1 ${d1[name]?.rows ?? '-'} rows ${d1[name]?.sha256?.slice(0, 12) ?? '-'}`);
    if (bad.length) process.exitCode = 1;
  }
}
