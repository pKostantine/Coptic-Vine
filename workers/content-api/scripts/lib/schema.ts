import { readFileSync } from 'node:fs';
import type { ContentSchema, TableInfo } from '../gen-schema.ts';

export type { ColumnKind, TableInfo } from '../gen-schema.ts';

/**
 * The copied tables as Supabase has them: these scripts read and compare its
 * frozen copy, which hasn't got the columns D1 has gained since the cutover
 * (addedInD1), so they leave those out. A reload leaves them at their default.
 */
const d1Schema: ContentSchema = JSON.parse(readFileSync(new URL('../../schema/content-tables.json', import.meta.url), 'utf8'));
export const contentSchema: ContentSchema = {
  ...d1Schema,
  tables: d1Schema.tables.map((table) => ({ ...table, columns: table.columns.filter((column) => !column.addedInD1) })),
};

export const qualified = (table: { schema: string; table: string }) => `${table.schema}/${table.table}`;

/**
 * The tables named (schema.table or schema/table; a bare schema means all of
 * its tables), with every table that references them, in load order. A
 * parent's reload deletes its children through ON DELETE CASCADE, so they are
 * always reloaded with it.
 */
export function selectTables(names: string[] | null): TableInfo[] {
  const all = contentSchema.tables;
  if (!names?.length) return all;
  const key = (table: TableInfo) => `${table.schema}.${table.table}`;
  const wanted = new Set<string>();
  for (const raw of names) {
    const name = raw.replace('/', '.');
    const matches = all.filter((table) => key(table) === name || table.schema === name);
    if (!matches.length) throw new Error(`No copied table or schema called ${raw}`);
    for (const table of matches) wanted.add(key(table));
  }
  for (let grew = true; grew;) {
    grew = false;
    for (const table of all) {
      if (!wanted.has(key(table)) && table.parents.some((parent) => wanted.has(parent))) { wanted.add(key(table)); grew = true; }
    }
  }
  return all.filter((table) => wanted.has(key(table)));
}
