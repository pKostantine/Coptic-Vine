/**
 * Every content table carries three triggers (migrations/0003, and 0035 for
 * a table added later): any change to it moves the content revision, which
 * renews every cached answer (index.ts), and records the table in
 * "offline_content.content_changes", which rebuilds the offline books that
 * hold it (publish.ts). An order table made in the D1 console has none, so
 * its edits would reach no one until something else changed.
 *
 * The minute cron (index.ts) gives each order table found in D1 since the
 * list (content.ts, readNewOrderTables) the same triggers, and moves the
 * revision and records the table once, for the rows it had before them.
 */
import { readNewOrderTables, type Table } from './content.ts';
import { indexName, t } from './db/names.ts';
import type { D1Database } from './types.ts';

const NOW = `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`;

/** What each trigger does: the revision moves, and the table is recorded as changed. */
function touch(schemaName: string, tableName: string): string[] {
  return [
    `UPDATE ${t('offline_content', 'revision')} SET "revision" = "revision" + 1, "changed_at" = ${NOW} WHERE "id" = 1;`,
    `INSERT INTO ${t('offline_content', 'content_changes')} ("schema_name", "table_name", "changed_at") VALUES ('${schemaName}', '${tableName}', ${NOW})
    ON CONFLICT ("schema_name", "table_name") DO UPDATE SET "changed_at" = excluded."changed_at";`,
  ];
}

/** A table's three triggers, as migrations/0003 writes them. */
export function revisionTriggers(schemaName: string, tableName: string): string[] {
  return (['insert', 'update', 'delete'] as const).map((event) => [
    `CREATE TRIGGER ${indexName(schemaName, `${tableName}_after_${event}`)} AFTER ${event.toUpperCase()} ON ${t(schemaName, tableName)}`,
    'BEGIN',
    ...touch(schemaName, tableName).map((statement) => `  ${statement}`),
    'END;',
  ].join('\n'));
}

/** Gives every order table made in D1 since the list its triggers; the names of those it gave them to. */
export async function adoptNewTables(db: D1Database): Promise<string[]> {
  const found = await readNewOrderTables(db);
  if (!found.length) return [];
  const { results } = await db.prepare(`SELECT "name" FROM sqlite_master WHERE "type" = 'trigger'`).all<{ name: string }>();
  const triggers = new Set(results.map((row) => row.name));
  const untracked = found.filter((table: Table) =>
    ['insert', 'update', 'delete'].some((event) => !triggers.has(`${table.schema}.${table.table}_after_${event}`)));
  for (const table of untracked) {
    // One batch, one transaction: the triggers, then the change they would have recorded.
    await db.batch([
      ...revisionTriggers(table.schema, table.table)
        .filter((_, index) => !triggers.has(`${table.schema}.${table.table}_after_${['insert', 'update', 'delete'][index]}`))
        .map((sql) => db.prepare(sql)),
      ...touch(table.schema, table.table).map((sql) => db.prepare(sql)),
    ]);
  }
  return untracked.map((table) => `${table.schema}.${table.table}`);
}
