/**
 * The same rows into both sides of a parity test: the oracle (Postgres) and
 * the Worker's SQLite. Values are written as a client would send them
 * (timestamps in ISO, jsonb as JSON values, text[] as lists) and converted
 * for SQLite as the Worker converts its inputs (src/rest/tables.ts).
 *
 * Postgres's triggers are paused while seeding (session_replication_role =
 * replica): they are application logic that runs on writes the Worker makes
 * itself, and seeding is setting up a state, not exercising them.
 */
import schema from '../../schema/user-tables.json' with { type: 'json' };
import type { UserTable } from '../../scripts/gen-schema.ts';
import { input } from '../../src/rest/tables.ts';
import type { Oracle } from './oracle.ts';
import type { WorkerSide } from './worker.ts';

const tables = new Map((schema as { tables: UserTable[] }).tables.map((table) => [`${table.schema}.${table.table}`, table]));

export type Seed = [table: string, rows: Record<string, unknown>[]][];

export async function seed(oracle: Oracle, worker: WorkerSide, data: Seed): Promise<void> {
  await oracle.sql('set session_replication_role = replica');
  try {
    for (const [name, rows] of data) {
      const table = tables.get(name);
      if (!table) throw new Error(`No table ${name}`);
      const [schemaName, tableName] = name.split('.');
      for (const row of rows) {
        const columns = Object.keys(row).map((key) => {
          const column = table.columns.find((candidate) => candidate.name === key);
          if (!column) throw new Error(`${name} has no column ${key}`);
          return column;
        });
        const pgValues = columns.map((column) => (column.kind === 'jsonb' ? JSON.stringify(row[column.name]) : row[column.name]));
        await oracle.sql(`insert into "${schemaName}"."${tableName}" (${columns.map((c) => `"${c.name}"`).join(', ')}) values (${columns.map((_, i) => `$${i + 1}`).join(', ')})`, pgValues);
        try {
          worker.db.prepare(`INSERT INTO "${name}" (${columns.map((c) => `"${c.name}"`).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`)
            .run(...(columns.map((column) => input(column, row[column.name])) as never[]));
        } catch (error) {
          throw new Error(`Seeding ${name} ${JSON.stringify(row)}: ${(error as Error).message}`);
        }
      }
    }
  } finally {
    await oracle.sql('set session_replication_role = origin');
  }
}
