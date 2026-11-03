/**
 * What each schema's documents call in other schemas, read from the content
 * itself, so an offline book carries whatever its documents call without
 * anyone listing it (rpc/offline.ts adds these to the hand-kept
 * offline_content.resource_dependencies).
 *
 * A document calls another schema three ways, each found as the app's reader
 * finds it (src/utils/hymnLibrary.js and src/utils/sentinelTables.js in the
 * app; tests/sentinelTables.test.cjs there keeps the lists below the same as
 * the reader's):
 *
 *   - an ALL_CAPS hymn_key, in an order table or as a hymn_texts row's
 *     inline_hymn_key: the order table of that name, wherever it is
 *     (FRACTIONS is fractions.fractions), or the Synaxarium;
 *   - a hymn's own key in an order table: the first of the table's own schema
 *     and HYMN_KEY_FALLBACK_SCHEMAS whose hymn_titles or hymn_texts has it;
 *   - a hymn's own key as an inline_hymn_key: the same, then any schema in
 *     HYMN_TEXT_SCHEMAS that has it.
 *
 * The day's readings (the *_WITH_COPTIC keys and the rest) read the Bible
 * and the calendar, which the hand-kept dependencies give every book that
 * reads them; they are not guessed at here.
 */
import { col, t } from './db/names.ts';
import type { ContentContext } from './types.ts';
import schema from '../schema/content-tables.json' with { type: 'json' };

/** Where the reader looks for a hymn called by its key, after the calling schema (hymnLibrary.js). */
export const HYMN_KEY_FALLBACK_SCHEMAS = ['public', 'liturgy', 'psalmody', 'agpeya', 'veneration', 'doxologies', 'litanies'];

/** Every schema the reader looks in for an inline hymn, in its order (hymnLibrary.js). */
export const HYMN_TEXT_SCHEMAS = [
  'public', 'liturgy', 'psalmody', 'agpeya', 'veneration', 'doxologies', 'litanies',
  'aspasmos', 'canons', 'fractions', 'gospel_responses', 'gospel_rite', 'holy_week',
  'hymn_of_the_intercessions', 'praxis_response', 'procession_of_the_cross', 'readings',
  'seasonal_liturgy_hymns', 'verses_of_the_cymbals',
];

/** ALL_CAPS keys that aren't their table's name (sentinelTables.js), by the schema they call. */
export const SENTINEL_TABLE_ALIASES: Readonly<Record<string, string>> = { THREE_GREAT_LITANIES: 'litanies' };

/** ALL_CAPS keys the reader resolves its own way, by the schemas they read. */
const SENTINELS_READING: Readonly<Record<string, readonly string[]>> = { SYNAXARIUM: ['synaxarium', 'calendar'] };

const ALL_CAPS = /^[A-Z][A-Z0-9_]*$/;

type TableInfo = { schema: string; table: string; columns: { name: string }[] };
const tables = schema.tables as TableInfo[];
const hasColumns = (table: TableInfo, names: string[]) => names.every((name) => table.columns.some((column) => column.name === name));

/** Every order table, by name, with its schema: what an ALL_CAPS key calls. */
export const ORDER_TABLES: ReadonlyMap<string, string> = new Map(
  tables.filter((table) => hasColumns(table, ['item_order', 'hymn_key', 'item_type'])).map((table) => [table.table, table.schema]),
);

/** The content each derivation reads: the keys every order table places, every inline key, and where every hymn is. */
export interface ContentKeys {
  /** By "schema.table". */
  orderKeys: ReadonlyMap<string, readonly string[]>;
  /** By schema: the inline_hymn_keys of its hymn_texts. */
  inlineKeys: ReadonlyMap<string, readonly string[]>;
  /** By schema: every hymn_key its hymn_titles or hymn_texts has. */
  hymns: ReadonlyMap<string, ReadonlySet<string>>;
}

/** The schemas each schema's documents call (never itself), from its content's keys. */
export function deriveCalls(keys: ContentKeys): Map<string, Set<string>> {
  const calls = new Map<string, Set<string>>();
  const call = (from: string, to: string | null | undefined) => {
    if (!to || to === from) return;
    if (!calls.has(from)) calls.set(from, new Set());
    calls.get(from)!.add(to);
  };
  const has = (schemaName: string, key: string) => keys.hymns.get(schemaName)?.has(key) ?? false;
  const near = (schemaName: string, table?: string) => [...new Set([
    schemaName,
    ...HYMN_KEY_FALLBACK_SCHEMAS,
    // The Sermon Planner reads the Gospel rite's framing hymns (getHymnKeyLookupSchemas).
    ...(schemaName === 'liturgy' && table === 'sermon_planner' ? ['gospel_rite'] : []),
  ])];
  const callTable = (from: string, key: string) => {
    if (Object.hasOwn(SENTINEL_TABLE_ALIASES, key)) return call(from, SENTINEL_TABLE_ALIASES[key]);
    if (Object.hasOwn(SENTINELS_READING, key)) return SENTINELS_READING[key].forEach((to) => call(from, to));
    call(from, ORDER_TABLES.get(key.toLowerCase()));
  };

  for (const [name, placed] of keys.orderKeys) {
    const [from, table] = name.split('.');
    for (const key of placed) {
      if (ALL_CAPS.test(key)) callTable(from, key);
      else call(from, near(from, table).find((lookup) => has(lookup, key)));
    }
  }
  for (const [from, inline] of keys.inlineKeys) {
    for (const key of inline) {
      if (ALL_CAPS.test(key)) { callTable(from, key); continue; }
      const nearby = near(from);
      call(from, nearby.find((lookup) => has(lookup, key)) ?? HYMN_TEXT_SCHEMAS.find((lookup) => !nearby.includes(lookup) && has(lookup, key)));
    }
  }
  return calls;
}

/** The content's keys, read from D1 in one batch of small queries (no compound SELECTs: D1 caps them). */
export async function readContentKeys(context: ContentContext): Promise<ContentKeys> {
  const db = context.db;
  const orderTables = tables.filter((table) => hasColumns(table, ['item_order', 'hymn_key', 'item_type']));
  const textTables = tables.filter((table) => table.table === 'hymn_texts');
  const titleTables = tables.filter((table) => table.table === 'hymn_titles');
  const inlineTables = textTables.filter((table) => hasColumns(table, ['inline_hymn_key']));
  const distinct = (table: TableInfo, column: string) =>
    db.prepare(`SELECT DISTINCT ${col(column)} AS "key" FROM ${t(table.schema, table.table)} WHERE ${col(column)} IS NOT NULL`);
  const groups = [orderTables, inlineTables, textTables, titleTables];
  const results = await db.batch([
    ...orderTables.map((table) => distinct(table, 'hymn_key')),
    ...inlineTables.map((table) => distinct(table, 'inline_hymn_key')),
    ...textTables.map((table) => distinct(table, 'hymn_key')),
    ...titleTables.map((table) => distinct(table, 'hymn_key')),
  ]);
  let at = 0;
  const [orderRead, inlineRead, textRead, titleRead] = groups.map((group) => group.map((table) => ({
    table,
    keys: ((results[at++]?.results ?? []) as { key: unknown }[]).map((row) => String(row.key)).filter(Boolean),
  })));
  const hymns = new Map<string, Set<string>>();
  for (const { table, keys } of [...textRead, ...titleRead]) {
    if (!hymns.has(table.schema)) hymns.set(table.schema, new Set());
    for (const key of keys) hymns.get(table.schema)!.add(key);
  }
  return {
    orderKeys: new Map(orderRead.map(({ table, keys }) => [`${table.schema}.${table.table}`, keys])),
    inlineKeys: new Map(inlineRead.map(({ table, keys }) => [table.schema, keys])),
    hymns,
  };
}
