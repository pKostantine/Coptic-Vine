/**
 * Tables compared across the oracle and the Worker, for tests whose writes
 * generate ids. Each side's rows are put in an order that doesn't depend on
 * the ids it made (by content, generated ids masked); then every generated id
 * is renamed <id 1>, <id 2>… in order of first appearance. Two databases that
 * are the same but for their generated ids give the same text. Timestamps
 * are compared by presence.
 */
import schema from '../../schema/user-tables.json' with { type: 'json' };
import type { UserTable } from '../../scripts/gen-schema.ts';
import type { Oracle } from './oracle.ts';
import type { WorkerSide } from './worker.ts';

const tables = new Map((schema as { tables: UserTable[] }).tables.map((table) => [`${table.schema}.${table.table}`, table]));
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?\+00:00$/;

type Rows = Record<string, Record<string, unknown>[]>;

function walk(value: unknown, leaf: (v: string) => string): unknown {
  if (Array.isArray(value)) return value.map((v) => walk(v, leaf));
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((k) => [k, walk((value as Record<string, unknown>)[k], leaf)]));
  return typeof value === 'string' ? leaf(value) : value;
}

/** The tables as one text, generated ids renamed, timestamps masked. */
export function canonical(rows: Rows, seeded: Set<string>): string {
  // Ids are found anywhere in a string ("/submission/<id>"), not only as the whole value.
  const ANY_UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
  const mask = (v: string) => (TIMESTAMP.test(v) ? '<ts>' : v.replace(ANY_UUID, (u) => (seeded.has(u) ? u : '<id>')));
  const ids = new Map<string, string>();
  const rename = (v: string) => {
    if (TIMESTAMP.test(v)) return '<ts>';
    return v.replace(ANY_UUID, (u) => {
      if (seeded.has(u)) return u;
      if (!ids.has(u)) ids.set(u, `<id ${ids.size + 1}>`);
      return ids.get(u)!;
    });
  };
  const out: string[] = [];
  for (const name of Object.keys(rows).sort()) {
    const ordered = rows[name].map((row) => ({ row, key: JSON.stringify(walk(row, mask)) })).sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    out.push(`## ${name}`, ...ordered.map(({ row }) => JSON.stringify(walk(row, rename))));
  }
  return out.join('\n');
}

/** A table's rows from the oracle, as JSON values; only the columns D1 keeps. */
export async function oracleRows(oracle: Oracle, name: string): Promise<Record<string, unknown>[]> {
  const table = tables.get(name)!;
  const [schemaName, tableName] = name.split('.');
  const kept = new Set(table.columns.map((c) => c.name));
  return (await oracle.sql<{ row: Record<string, unknown> }>(`select to_jsonb(x) as row from "${schemaName}"."${tableName}" x`))
    .map(({ row }) => Object.fromEntries(Object.entries(row).filter(([key]) => kept.has(key))));
}

/** A table's rows from the Worker's SQLite, as JSON values. */
export function workerRows(worker: WorkerSide, name: string): Record<string, unknown>[] {
  const table = tables.get(name)!;
  return (worker.db.prepare(`SELECT * FROM "${name}"`).all() as Record<string, unknown>[]).map((row) => Object.fromEntries(table.columns.map((c) => {
    const value = row[c.name];
    if (value == null) return [c.name, null];
    if (c.kind === 'boolean') return [c.name, value === 1];
    if (c.kind === 'jsonb' || c.kind === 'array') return [c.name, JSON.parse(value as string)];
    return [c.name, value];
  })));
}

/** Both sides' tables, canonical. */
export async function bothTables(oracle: Oracle, worker: WorkerSide, names: string[], seeded: Set<string>): Promise<{ pg: string; sqlite: string }> {
  const pg: Rows = {};
  const sqlite: Rows = {};
  for (const name of names) {
    pg[name] = await oracleRows(oracle, name);
    sqlite[name] = workerRows(worker, name);
  }
  return { pg: canonical(pg, seeded), sqlite: canonical(sqlite, seeded) };
}

/** The first lines where two canonical texts differ, for a readable failure. */
export function firstDifferences(a: string, b: string, count = 6): string[] {
  const x = a.split('\n');
  const y = b.split('\n');
  const out: string[] = [];
  let table = '';
  for (let i = 0; i < Math.max(x.length, y.length) && out.length < count; i += 1) {
    if (x[i]?.startsWith('## ')) table = x[i];
    if (x[i] !== y[i]) out.push(`${table}\n  worker: ${(x[i] ?? '(none)').slice(0, 400)}\n  oracle: ${(y[i] ?? '(none)').slice(0, 400)}`);
  }
  return out;
}
