/**
 * Proves the D1 copy holds exactly what Supabase holds, table by table.
 *
 * 1. Postgres computes each table's checksum itself (read-only):
 *      npm run verify -- --print-pg-sql > pg-checksums.sql
 *    Run it in the Supabase SQL editor (or the Supabase MCP) and save the
 *    JSON it returns, e.g. as pg-checksums.json.
 * 2. Optionally, a byte-for-byte sample of Arabic and Coptic lines:
 *      npm run verify -- --print-pg-spot-sql > pg-spot.sql   (run it, save as pg-spot.json)
 * 3. This script reads every row back from D1, computes the same checksums
 *    (scripts/lib/canonical.ts), and compares:
 *      npm run verify -- --pg pg-checksums.json [--spot pg-spot.json] [--report report.md] [--local]
 *
 * A table that differs is then compared row by row with what Supabase's REST
 * API returns, so the report says which rows are missing, extra or changed.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { col, t } from '../src/db/names.ts';
import { canonicalLine, pgChecksumSql, tableChecksum } from './lib/canonical.ts';
import { query, queryAll, type Target } from './lib/d1.ts';
import { readTable } from './lib/supabase.ts';
import { contentSchema, qualified, selectTables, type TableInfo } from './lib/schema.ts';

const PAGE = 5000;

type Checksum = { rows: number; sha256: string };

/** Every row of every table, read from D1 a few thousand at a time. */
function readD1(target: Target, tables: TableInfo[]): Map<string, Record<string, unknown>[]> {
  const counts = new Map<string, number>();
  // One statement per table: D1 allows only a few terms in a compound SELECT.
  const countSql = tables.map((table) => `SELECT '${qualified(table)}' AS name, count(*) AS n FROM ${t(table.schema, table.table)}`).join(';\n');
  for (const [row] of queryAll<{ name: string; n: number }>(target, countSql)) counts.set(row.name, row.n);

  const rows = new Map<string, Record<string, unknown>[]>(tables.map((table) => [qualified(table), []]));
  const select = (table: TableInfo, after: number) =>
    `SELECT rowid AS "__rowid", ${table.columns.map((column) => col(column.name)).join(', ')} FROM ${t(table.schema, table.table)} WHERE rowid > ${after} ORDER BY rowid LIMIT ${PAGE}`;

  // Small tables share a call; large ones are paged by rowid.
  let batch: TableInfo[] = [];
  let batchRows = 0;
  const flush = () => {
    if (!batch.length) return;
    const output = queryMany(target, batch.map((table) => select(table, 0)));
    batch.forEach((table, index) => rows.get(qualified(table))!.push(...output[index]));
    batch = []; batchRows = 0;
  };
  for (const table of tables) {
    const n = counts.get(qualified(table)) ?? 0;
    if (n <= PAGE) {
      if (batchRows + n > PAGE) flush();
      batch.push(table); batchRows += n;
      continue;
    }
    for (let after = 0; ;) {
      const page = query<Record<string, unknown>>(target, select(table, after));
      rows.get(qualified(table))!.push(...page);
      if (page.length < PAGE) break;
      after = page[page.length - 1].__rowid as number;
    }
  }
  flush();
  for (const table of tables) {
    const got = rows.get(qualified(table))!.length;
    if (got !== counts.get(qualified(table))) throw new Error(`${qualified(table)}: D1 counts ${counts.get(qualified(table))}, read ${got}`);
  }
  return rows;
}

/** Several SELECTs in one wrangler call, each statement's rows in order. */
function queryMany(target: Target, statements: string[]): Record<string, unknown>[][] {
  return queryAll(target, statements.join(';\n'));
}

/** For a table that differs: which rows, by key, compared with what Supabase's REST API returns now. */
async function rowDiff(table: TableInfo, d1Rows: Record<string, unknown>[]): Promise<string[]> {
  let source: Record<string, unknown>[];
  try { source = await readTable(table); } catch (error) { return [`  (can't compare rows: ${error instanceof Error ? error.message : error})`]; }
  const keyOf = (row: Record<string, unknown>) => JSON.stringify(table.rowKey.map((name) => row[name]));
  const index = (rows: Record<string, unknown>[]) => {
    const lines = new Map<string, string[]>();
    for (const row of rows) lines.set(keyOf(row), [...(lines.get(keyOf(row)) || []), canonicalLine(row, table)]);
    return lines;
  };
  const a = index(source);
  const b = index(d1Rows);
  const out: string[] = [];
  for (const [key, lines] of a) {
    const other = b.get(key);
    if (!other) out.push(`  missing in D1: ${key}`);
    else if (JSON.stringify([...lines].sort()) !== JSON.stringify([...other].sort())) out.push(`  changed: ${key}\n    Supabase ${lines.join(' / ').slice(0, 300)}\n    D1       ${other.join(' / ').slice(0, 300)}`);
  }
  for (const key of b.keys()) if (!a.has(key)) out.push(`  only in D1: ${key}`);
  return out.length ? out.slice(0, 50) : ['  every row matches what the REST API returns now: the table changed in Supabase after the checksum was taken, or the checksum query differs'];
}

type SpotRow = { name: string; key: Record<string, string | number>; hex: Record<string, string | null> };

const SPOT_TABLES = ['liturgy/hymn_texts', 'psalmody/hymn_texts', 'holy_week/hymn_texts', 'doxologies/hymn_texts', 'veneration/hymn_texts', 'agpeya/hymn_texts', 'public/hymn_texts', 'bible/verses', 'bible/verse_parts', 'synaxarium/entry_texts'];
const SPOT_COLUMNS = ['english', 'coptic', 'arabic', 'french', 'greek', 'english_from_coptic', 'arabic_from_coptic'];

function spotTables(): TableInfo[] {
  return SPOT_TABLES.map((name) => contentSchema.tables.find((table) => qualified(table) === name)!);
}

/** Postgres: the sampled lines' UTF-8 bytes in hex, with the keys to find them in D1. */
function pgSpotSql(): string {
  const pgIdent = (name: string) => `"${name}"`;
  const parts = spotTables().map((table) => {
    const textColumns = SPOT_COLUMNS.filter((name) => table.columns.some((column) => column.name === name));
    const from = `${pgIdent(table.schema)}.${pgIdent(table.table)}`;
    const filter = `arabic is not null and arabic <> ''${textColumns.includes('coptic') ? " and coptic is not null and coptic <> ''" : ''}`;
    const key = table.rowKey.map(pgIdent).join(', ');
    const keyText = table.rowKey.map((name) => `${pgIdent(name)}::text`).join(` || '|' || `);
    const sample = [
      `(select * from ${from} where ${filter} order by ${key} limit 3)`,
      `(select * from ${from} where ${filter} order by ${table.rowKey.map((name) => `${pgIdent(name)} desc`).join(', ')} limit 2)`,
      `(select * from ${from} where ${filter} order by md5(${keyText}) limit 5)`,
    ].join(' union ');
    return `select '${qualified(table)}' as name, json_build_object(${table.rowKey.map((name) => `'${name}', ${pgIdent(name)}`).join(', ')}) as key, json_build_object(${textColumns.map((name) => `'${name}', upper(encode(convert_to(${pgIdent(name)}, 'UTF8'), 'hex'))`).join(', ')}) as hex from (${sample}) s`;
  });
  return `select json_agg(json_build_object('name', name, 'key', key, 'hex', hex)) as spot from (\n${parts.join('\nunion all\n')}\n) x;\n`;
}

function spotCheck(target: Target, rows: SpotRow[]): { checked: number; bytes: number; mismatches: string[] } {
  const mismatches: string[] = [];
  let bytes = 0;
  for (const spot of rows) {
    const table = contentSchema.tables.find((candidate) => qualified(candidate) === spot.name)!;
    const columns = Object.keys(spot.hex);
    const where = Object.entries(spot.key).map(([name, value]) => `${col(name)} = ${typeof value === 'number' ? value : `'${String(value).replaceAll("'", "''")}'`}`).join(' AND ');
    const [d1] = query<Record<string, string | null>>(target, `SELECT ${columns.map((name) => `CASE WHEN ${col(name)} IS NULL THEN NULL ELSE hex(${col(name)}) END AS ${col(name)}`).join(', ')} FROM ${t(table.schema, table.table)} WHERE ${where}`);
    for (const name of columns) {
      const expected = spot.hex[name];
      if (!d1) { mismatches.push(`${spot.name} ${JSON.stringify(spot.key)}: missing in D1`); break; }
      if (d1[name] !== expected) mismatches.push(`${spot.name} ${JSON.stringify(spot.key)} ${name}: bytes differ`);
      bytes += (expected?.length ?? 0) / 2;
    }
  }
  return { checked: rows.length, bytes, mismatches };
}

async function main() {
  const args = process.argv.slice(2);
  const option = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
  const tables = selectTables(option('--tables')?.split(',') ?? null);
  if (args.includes('--print-pg-sql')) { process.stdout.write(pgChecksumSql(tables)); return; }
  if (args.includes('--print-pg-spot-sql')) { process.stdout.write(pgSpotSql()); return; }

  const pgFile = option('--pg');
  if (!pgFile) throw new Error('Give Postgres\'s checksums with --pg <file> (see --print-pg-sql).');
  const target: Target = args.includes('--local') ? 'local' : 'remote';
  const pg: Record<string, Checksum> = JSON.parse(readFileSync(pgFile, 'utf8'));

  const started = Date.now();
  const d1Rows = readD1(target, tables);
  const lines: string[] = [];
  let matching = 0;
  let rowsTotal = 0;
  const failures: string[] = [];
  for (const table of tables) {
    const name = qualified(table);
    const rows = d1Rows.get(name)!;
    const d1: Checksum = { rows: rows.length, sha256: tableChecksum(rows.map((row) => canonicalLine(row, table))) };
    const source = pg[name];
    const ok = Boolean(source) && source.rows === d1.rows && source.sha256 === d1.sha256;
    if (ok) matching += 1; else failures.push(name);
    rowsTotal += d1.rows;
    lines.push(`| \`${table.schema}.${table.table}\` | ${source ? source.rows : 'not read'} | ${d1.rows} | ${ok ? 'match' : source ? '**differs**' : '**no Postgres checksum**'} | \`${d1.sha256.slice(0, 12)}\` |`);
  }

  const report: string[] = [
    `Checked ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC against the ${target} D1, in ${((Date.now() - started) / 1000).toFixed(0)} s.`,
    '',
    `**${matching} of ${tables.length} tables match** (${rowsTotal} rows in D1).`,
    '',
  ];
  const spotFile = option('--spot');
  if (spotFile) {
    const spot = spotCheck(target, JSON.parse(readFileSync(spotFile, 'utf8')));
    report.push(`**Byte-for-byte sample:** ${spot.checked} Arabic and Coptic rows from ${SPOT_TABLES.length} tables, ${spot.bytes} bytes of text, compared as UTF-8 hex computed by each database: ${spot.mismatches.length ? `**${spot.mismatches.length} differ**` : 'all identical'}.`, '');
    for (const mismatch of spot.mismatches) report.push(`- ${mismatch}`);
    if (spot.mismatches.length) report.push('');
  }
  report.push('| Table | Rows in Postgres | Rows in D1 | Checksum | SHA-256 (D1) |', '|---|---:|---:|---|---|', ...lines, '');
  const text = report.join('\n');
  const reportFile = option('--report');
  if (reportFile) writeFileSync(reportFile, text);
  console.log(text.split('\n').slice(0, 6).join('\n'));
  if (failures.length) {
    const details: string[] = [];
    for (const name of failures) {
      const table = tables.find((candidate) => qualified(candidate) === name)!;
      if (!pg[name]) continue;
      details.push(`${name}:`, ...(await rowDiff(table, d1Rows.get(name)!)));
    }
    if (details.length) {
      const diffText = ['', '## Tables that differ, row by row', '', '```', ...details, '```', ''].join('\n');
      if (reportFile) writeFileSync(reportFile, text + diffText);
      console.error(diffText);
    }
    console.error(`Differs: ${failures.join(', ')}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
}
