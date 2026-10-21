import schema from '../schema/content-tables.json' with { type: 'json' };

/** How a copied column is stored in D1 (scripts/gen-schema.ts). */
export type ColumnKind = 'text' | 'integer' | 'numeric' | 'float8' | 'float4' | 'boolean' | 'jsonb' | 'date';
export type Column = { name: string; kind: ColumnKind; pgType: string; notNull: boolean };
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
