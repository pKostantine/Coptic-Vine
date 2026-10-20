/**
 * Copies the liturgical content from Supabase to D1: reads every copied table
 * through Supabase's REST API (GET only, with the public anon key, so it
 * cannot write there) and fully reloads it in D1. Safe to re-run: each run
 * deletes the tables it reloads and inserts every row again.
 *
 *   npm run import                         every table, into the remote D1
 *   npm run import -- --local              into the local D1 (wrangler dev)
 *   npm run import -- --tables liturgy     one schema (or schema.table, comma-separated)
 *   npm run import -- --dry-run            read and check everything, write the SQL, run nothing
 *
 * A table's reload also reloads every table that references it, because
 * deleting its rows deletes theirs (ON DELETE CASCADE).
 *
 * Before anything is written the rows are checked: Postgres's row count
 * matches what was read; every number survives as a SQLite REAL exactly
 * (numeric holds decimals such as 21.5). Any failure stops the run before D1
 * is touched. The hymn-key rules Postgres enforces with triggers are checked
 * too; rows that break them are already in Postgres, so they are reported,
 * and stop the run only with --strict.
 *
 * The SQL goes to D1 as one file through D1's import API, in statements
 * under its 100 KB limit. Verify the result with `npm run verify`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { col, t } from '../src/db/names.ts';
import { executeFile, type Target } from './lib/d1.ts';
import { qualified, selectTables, type TableInfo } from './lib/schema.ts';
import { NotReadable, readTable, type SourceRow } from './lib/supabase.ts';

const MAX_STATEMENT_BYTES = 90_000;
const MAX_ROWS_PER_STATEMENT = 500;

const quoteText = (value: string) => `'${value.replaceAll("'", "''")}'`;

/** A decimal as Postgres prints it, without trailing zeros: 21.50 -> 21.5, 3.0 -> 3. */
function plainDecimal(text: string): string {
  if (!/^-?\d+(\.\d+)?$/.test(text)) return text;
  const [whole, fraction = ''] = text.split('.');
  const trimmed = fraction.replace(/0+$/, '');
  return trimmed ? `${whole}.${trimmed}` : whole === '-0' ? '0' : whole;
}

/** One value as a SQLite literal, refusing anything that would not arrive exactly as it is in Postgres. */
export function literal(row: SourceRow, column: TableInfo['columns'][number], where: string): string {
  const value = row[column.name];
  if (value === null || value === undefined) {
    if (column.notNull) throw new Error(`${where}: ${column.name} is null but NOT NULL`);
    return 'NULL';
  }
  switch (column.kind) {
    case 'text':
      if (typeof value !== 'string') throw new Error(`${where}: ${column.name} is not text`);
      return quoteText(value);
    case 'date':
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${where}: ${column.name} is not a date: ${value}`);
      return quoteText(value);
    case 'jsonb':
      if (typeof value !== 'string') throw new Error(`${where}: ${column.name} did not arrive as Postgres's text`);
      JSON.parse(value);
      return quoteText(value);
    case 'boolean':
      if (typeof value !== 'boolean') throw new Error(`${where}: ${column.name} is not a boolean`);
      return value ? '1' : '0';
    case 'integer':
      if (typeof value !== 'number' || !Number.isSafeInteger(value)) throw new Error(`${where}: ${column.name} is not an integer: ${value}`);
      return String(value);
    case 'numeric':
    case 'float8':
    case 'float4': {
      const raw = row[`${column.name}__raw`];
      if (typeof value !== 'number' || typeof raw !== 'string') throw new Error(`${where}: ${column.name} is not a number`);
      // The REAL D1 stores is the double nearest Postgres's value; it must
      // print back as that value, or the move would change it.
      if (plainDecimal(raw) !== String(value) || Number(raw) !== value) throw new Error(`${where}: ${column.name} = ${raw} would change as a REAL (${value})`);
      return String(value);
    }
  }
}

/** The rules Postgres's validation triggers enforce, checked on the rows as read. */
function validate(table: TableInfo, rows: SourceRow[], read: Map<string, SourceRow[]>): string[] {
  const problems: string[] = [];
  const keys = (name: string) => new Set((read.get(name) || []).map((row) => row.hymn_key));
  const where = `${table.schema}.${table.table}`;
  for (const validator of table.validators) {
    if (validator === 'liturgy.validate_order_hymn_key') {
      const known = new Set([...keys('liturgy/hymn_titles'), ...keys('public/hymn_titles')]);
      for (const row of rows) if (!known.has(row.hymn_key)) problems.push(`${where}: hymn_key ${row.hymn_key} is in neither liturgy nor public hymn_titles`);
    } else if (validator === 'veneration.validate_veneration_hymn_key' || validator === 'public.veneration_validate_hymn_key') {
      const known = keys('veneration/hymn_titles');
      for (const row of rows) if ((row.item_type == null || row.item_type === '') && !known.has(row.hymn_key)) problems.push(`${where}: hymn_key ${row.hymn_key} is not in veneration's hymn_titles`);
    } else {
      problems.push(`${where}: no check written for the trigger ${validator}`);
    }
  }
  return [...new Set(problems)];
}

/** INSERT statements for a table's rows, each under D1's statement size limit. */
export function insertStatements(table: TableInfo, rows: SourceRow[]): string[] {
  const head = `INSERT INTO ${t(table.schema, table.table)} (${table.columns.map((column) => col(column.name)).join(', ')}) VALUES\n`;
  const statements: string[] = [];
  let values: string[] = [];
  let bytes = Buffer.byteLength(head);
  const flush = () => {
    if (values.length) statements.push(`${head}${values.join(',\n')};`);
    values = [];
    bytes = Buffer.byteLength(head);
  };
  rows.forEach((row, index) => {
    const where = `${table.schema}.${table.table} row ${index + 1}`;
    const tuple = `(${table.columns.map((column) => literal(row, column, where)).join(', ')})`;
    const size = Buffer.byteLength(tuple) + 2;
    if (Buffer.byteLength(head) + size > MAX_STATEMENT_BYTES) throw new Error(`${where} is ${size} bytes, past D1's statement limit`);
    if (bytes + size > MAX_STATEMENT_BYTES || values.length >= MAX_ROWS_PER_STATEMENT) flush();
    values.push(tuple);
    bytes += size;
  });
  flush();
  return statements;
}

async function main() {
  const args = process.argv.slice(2);
  const target: Target = args.includes('--local') ? 'local' : 'remote';
  const dryRun = args.includes('--dry-run');
  const tablesArg = args.includes('--tables') ? args[args.indexOf('--tables') + 1].split(',') : null;
  const tables = selectTables(tablesArg);

  console.log(`Reading ${tables.length} tables from Supabase (read-only)…`);
  const started = Date.now();
  const read = new Map<string, SourceRow[]>();
  const skipped: string[] = [];
  for (const table of tables) {
    try {
      read.set(qualified(table), await readTable(table));
    } catch (error) {
      if (!(error instanceof NotReadable)) throw error;
      skipped.push(error.message);
    }
  }
  const loaded = tables.filter((table) => read.has(qualified(table)));
  const rowCount = [...read.values()].reduce((sum, rows) => sum + rows.length, 0);
  console.log(`Read ${rowCount} rows in ${((Date.now() - started) / 1000).toFixed(0)} s.`);
  if (skipped.length) console.warn(`Not readable over REST, so left as they are in D1:\n  ${skipped.join('\n  ')}`);

  // The validators may need tables outside this run's selection.
  for (const name of ['liturgy/hymn_titles', 'public/hymn_titles', 'veneration/hymn_titles']) {
    if (!read.has(name) && loaded.some((table) => table.validators.length)) {
      const info = selectTables([name]).find((table) => qualified(table) === name)!;
      read.set(name, await readTable(info));
    }
  }
  // Rows already in Postgres that its triggers would refuse today (they were
  // written before a hymn moved schema, say). The copy has to keep them, so
  // they are reported, and only stop the run with --strict.
  const problems = loaded.flatMap((table) => validate(table, read.get(qualified(table))!, read));
  if (problems.length) {
    const message = `${problems.length} rows Postgres's validation triggers would refuse on a new write:\n  ${problems.join('\n  ')}`;
    if (args.includes('--strict')) throw new Error(message);
    console.warn(message);
  }

  const sql: string[] = ['-- Generated by scripts/import.ts: a full reload of the tables below.'];
  for (const table of [...loaded].reverse()) sql.push(`DELETE FROM ${t(table.schema, table.table)};`);
  const summary: string[] = [];
  for (const table of loaded) {
    const rows = read.get(qualified(table))!;
    const statements = insertStatements(table, rows);
    sql.push(...statements);
    summary.push(`  ${`${table.schema}.${table.table}`.padEnd(58)} ${String(rows.length).padStart(6)} rows`);
  }
  const body = `${sql.join('\n')}\n`;
  const dir = fileURLToPath(new URL('../.wrangler/import/', import.meta.url));
  mkdirSync(dir, { recursive: true });
  const file = `${dir}${new Date().toISOString().replace(/[:.]/g, '-')}.sql`;
  writeFileSync(file, body);
  console.log(summary.join('\n'));
  console.log(`${loaded.length} tables, ${rowCount} rows, ${(Buffer.byteLength(body) / 1024 / 1024).toFixed(1)} MB of SQL in ${file}`);
  if (dryRun) { console.log('Dry run: nothing written to D1.'); return; }

  console.log(`Loading into the ${target} D1…`);
  executeFile(target, file);
  console.log(`Done in ${((Date.now() - started) / 1000).toFixed(0)} s. Now run npm run verify.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
}
