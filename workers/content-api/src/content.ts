import schema from '../schema/content-tables.json' with { type: 'json' };
import { CONTENT_SCHEMAS, t } from './db/names.ts';
import type { D1Database } from './types.ts';

/** How a copied column is stored in D1 (scripts/gen-schema.ts). */
export type ColumnKind = 'text' | 'integer' | 'numeric' | 'float8' | 'float4' | 'boolean' | 'jsonb' | 'date';
export type Column = { name: string; kind: ColumnKind; pgType: string; notNull: boolean; addedInD1?: string };
export type Table = { schema: string; table: string; public: boolean; columns: Column[]; rowKey: string[] };

const tables = schema.tables as unknown as Table[];
const byName = new Map(tables.map((table) => [`${table.schema}/${table.table}`, table]));

/** The copied table, if it exists. */
export function contentTable(schemaName: string, tableName: string): Table | undefined {
  return byName.get(`${schemaName}/${tableName}`);
}

export function hasSchema(schemaName: string): boolean {
  return tables.some((table) => table.schema === schemaName);
}

/** Enum values in Postgres's order, for a column whose pgType is a quoted enum name. */
export function enumOrder(column: Column): string[] | null {
  const name = column.pgType.match(/^"(.+)"$/)?.[1];
  return name ? (schema.enums as Record<string, string[]>)[name] ?? null : null;
}

// ─── Order tables D1 has gained since the list ───────────────────────────────
//
// A Subdocument, Inline or Hyperlink row calls a whole order table by its
// full name (procession_of_the_cross.vespers_procession), and the app goes
// straight to it. So that a table made in the D1 console is served the moment
// it is there, with no change to schema/content-tables.json and no deploy, an
// order table D1 has that the list hasn't is found in D1 itself: a table in a
// content schema whose columns are all an order table's, item_order and
// hymn_key among them. Nothing else is found this way. The user data shares
// this database, so a table of any other shape, or in public or a schema of
// its own, still needs the list. adopt.ts gives each one found the revision
// triggers the list's tables have.

/** An order table's columns, as the list has them. */
export const ORDER_COLUMNS: Readonly<Record<string, Column>> = Object.freeze({
  item_order: { name: 'item_order', kind: 'numeric', pgType: 'numeric', notNull: true },
  hymn_key: { name: 'hymn_key', kind: 'text', pgType: 'text', notNull: false },
  condition: { name: 'condition', kind: 'text', pgType: 'text', notNull: false },
  minimization: { name: 'minimization', kind: 'text', pgType: '"Minimization"', notNull: false },
  item_type: { name: 'item_type', kind: 'text', pgType: '"Item Type"', notNull: false },
  implying_conditions: { name: 'implying_conditions', kind: 'text', pgType: 'text', notNull: false },
});

/** The schemas a new order table is looked for in: the content's own, never public, whose tables are partly user data. */
const DISCOVERABLE_SCHEMAS: ReadonlySet<string> = new Set(CONTENT_SCHEMAS.filter((name) => name !== 'public'));

/** A table D1 has, as an order table, or null when it isn't one (by its schema and its columns, in D1's order). */
export function orderTableOf(schemaName: string, tableName: string, columnNames: readonly string[]): Table | null {
  if (!DISCOVERABLE_SCHEMAS.has(schemaName) || contentTable(schemaName, tableName)) return null;
  if (!/^[a-z_][a-z0-9_]*$/.test(tableName)) return null;
  if (!columnNames.includes('item_order') || !columnNames.includes('hymn_key')) return null;
  if (!columnNames.every((name) => Object.hasOwn(ORDER_COLUMNS, name))) return null;
  return { schema: schemaName, table: tableName, public: true, columns: columnNames.map((name) => ORDER_COLUMNS[name]), rowKey: ['item_order'] };
}

/** How long one look at D1's tables is trusted, and how soon a table asked for that wasn't there is looked for again. */
const DISCOVERY_TTL_MS = 60_000;
const MISS_RETRY_MS = 5_000;

const discoveries = new WeakMap<D1Database, { at: number; tables: Map<string, Table> }>();

/** The order tables D1 has that the list hasn't, read from D1 now. */
export async function readNewOrderTables(db: D1Database): Promise<Table[]> {
  const { results } = await db
    .prepare(`SELECT "name" FROM sqlite_master WHERE "type" = 'table' AND "name" LIKE '%.%'`)
    .all<{ name: string }>();
  const candidates = results
    .map(({ name }) => {
      const dot = name.indexOf('.');
      return { schema: name.slice(0, dot), table: name.slice(dot + 1) };
    })
    .filter(({ schema: schemaName, table }) => DISCOVERABLE_SCHEMAS.has(schemaName) && /^[a-z_][a-z0-9_]*$/.test(table) && !contentTable(schemaName, table));
  if (!candidates.length) return [];
  const columns = await db.batch<{ name: string }>(candidates.map(({ schema: schemaName, table }) => db.prepare(`PRAGMA table_info(${t(schemaName, table)})`)));
  return candidates
    .map(({ schema: schemaName, table }, index) => orderTableOf(schemaName, table, (columns[index]?.results ?? []).map((column) => column.name)))
    .filter((table): table is Table => table !== null);
}

async function discovered(db: D1Database, maxAgeMs: number): Promise<Map<string, Table>> {
  const known = discoveries.get(db);
  if (known && Date.now() - known.at < maxAgeMs) return known.tables;
  const found = new Map((await readNewOrderTables(db)).map((table) => [`${table.schema}/${table.table}`, table]));
  discoveries.set(db, { at: Date.now(), tables: found });
  return found;
}

/** The table, from the list or, an order table made since, from D1. */
export async function findContentTable(db: D1Database, schemaName: string, tableName: string): Promise<Table | undefined> {
  const listed = contentTable(schemaName, tableName);
  if (listed || !DISCOVERABLE_SCHEMAS.has(schemaName)) return listed;
  const key = `${schemaName}/${tableName}`;
  return (await discovered(db, DISCOVERY_TTL_MS)).get(key) ?? (await discovered(db, MISS_RETRY_MS)).get(key);
}

/** Every content table: the list's, then the order tables made in D1 since. */
export async function allContentTables(db: D1Database): Promise<Table[]> {
  return [...tables, ...(await discovered(db, DISCOVERY_TTL_MS)).values()];
}
