/**
 * What scripts/publish-content-packages.mjs builds the offline books from,
 * answered from D1 in place of Supabase's functions of the same names:
 *
 *   public.get_offline_package_plan     the books, their resources, dependencies and tables
 *   public.get_offline_table_rows       a packaged table's rows, a page at a time
 *   public.get_offline_content_changes  when each table last changed (the triggers in
 *                                       migrations/0003 keep this)
 *
 * The plan lives in migrations/0004_offline_plan.sql. A resource's tables are
 * its schema's tables here, so the legacy and staging tables Supabase still
 * has (synaxarium.entries_old and the rest) no longer go into packages, and
 * nor do bible.verses' generated tsvector columns: rows are what D1 holds.
 * Pages follow rowid where Supabase's followed ctid; the script passes the
 * cursor back without reading it.
 */
import { contentTable, type Table } from '../content.ts';
import { col, t } from '../db/names.ts';
import { int4, jsonb, PgError } from '../pg.ts';
import type { ContentContext, Row } from '../types.ts';
import schema from '../../schema/content-tables.json';

const EXCLUDED_NAMES = /(backup|archive|history|working|staging|admin|draft|audit)/i;

type Resource = { resource_key: string; schema_name: string; include_tables: string | null };

/** offline_content.package_tables(resource): the resource's tables, by name. */
function packageTables(resource: Resource): string[] {
  const include = resource.include_tables ? (JSON.parse(resource.include_tables) as string[]) : null;
  return (schema.tables as { schema: string; table: string }[])
    .filter((table) => table.schema === resource.schema_name)
    .map((table) => table.table)
    .filter((name) => (include === null || include.includes(name)) && !EXCLUDED_NAMES.test(name))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export async function getOfflinePackagePlan(context: ContentContext): Promise<unknown> {
  const db = context.db;
  const [books, dependencies, resources] = await db.batch([
    db.prepare(`SELECT ${['book_key', 'title_english', 'title_arabic', 'root_resources'].map(col).join(', ')} FROM ${t('offline_content', 'books')} WHERE ${col('enabled')} = 1 ORDER BY ${col('book_key')}`),
    db.prepare(`SELECT ${col('resource_key')}, ${col('dependency_key')} FROM ${t('offline_content', 'resource_dependencies')} ORDER BY ${col('resource_key')}, ${col('dependency_key')}`),
    db.prepare(`SELECT ${['resource_key', 'schema_name', 'include_tables'].map(col).join(', ')} FROM ${t('offline_content', 'resources')} ORDER BY ${col('resource_key')}`),
  ]);
  return jsonb({
    books: (books.results as Row[]).map((book) => jsonb({ key: book.book_key, title: book.title_english, titleArabic: book.title_arabic, roots: JSON.parse(String(book.root_resources)) })),
    dependencies: (dependencies.results as Row[]).map((d) => jsonb({ resource: d.resource_key, dependency: d.dependency_key })),
    resources: (resources.results as unknown as Resource[]).map((r) => jsonb({ id: r.resource_key, schema: r.schema_name, tables: packageTables(r) })),
  });
}

/** A row as to_jsonb(row) gives it: every column, booleans as booleans, jsonb as JSON, keys in jsonb's order. */
function rowJson(table: Table, row: Row): Row {
  const out: Row = {};
  for (const column of table.columns) {
    const value = row[column.name];
    out[column.name] = value === null || value === undefined ? null
      : column.kind === 'boolean' ? value === 1
      : column.kind === 'jsonb' ? JSON.parse(String(value))
      : value;
  }
  return jsonb(out);
}

export async function getOfflineTableRows(context: ContentContext, resourceKey: string | null, tableName: string | null, after: string | null, limit: number | null): Promise<unknown> {
  if (limit === null || limit < 1 || limit > 2000) throw new PgError('P0001', 'invalid page');
  const resource = await context.db
    .prepare(`SELECT ${['resource_key', 'schema_name', 'include_tables'].map(col).join(', ')} FROM ${t('offline_content', 'resources')} WHERE ${col('resource_key')} = ?`)
    .bind(resourceKey)
    .first<Resource>();
  if (!resource || tableName === null || !packageTables(resource).includes(tableName)) throw new PgError('P0001', 'not a packaged table');
  const table = contentTable(resource.schema_name, tableName)!;
  const cursor = after === null || after === '' ? 0 : Number(after);
  if (!Number.isInteger(cursor)) throw new PgError('22P02', `invalid input syntax for type tid: "${after}"`);
  const { results } = await context.db
    .prepare(`SELECT rowid AS "__rowid", * FROM ${t(table.schema, table.table)} WHERE rowid > ? ORDER BY rowid LIMIT ?`)
    .bind(cursor, limit)
    .all<Row>();
  if (!results.length) return jsonb({ rows: [], after: null });
  return jsonb({ rows: results.map((row) => rowJson(table, row)), after: String(results[results.length - 1].__rowid) });
}

export async function getOfflineContentChanges(context: ContentContext): Promise<unknown> {
  const { results } = await context.db
    .prepare(`SELECT ${['schema_name', 'table_name', 'changed_at'].map(col).join(', ')} FROM ${t('offline_content', 'content_changes')} ORDER BY ${col('schema_name')}, ${col('table_name')}`)
    .all<Row>();
  return jsonb({
    now: new Date().toISOString(),
    changes: results.map((change) => jsonb({ schema: change.schema_name, table: change.table_name, changedAt: change.changed_at })),
  });
}

export const offlineRpcs = {
  get_offline_package_plan: { params: [] as string[], run: (c: ContentContext) => getOfflinePackagePlan(c) },
  get_offline_table_rows: {
    params: ['p_resource', 'p_table', 'p_after', 'p_limit'],
    defaults: { p_after: null, p_limit: 500 },
    run: (c: ContentContext, a: Record<string, unknown>) => getOfflineTableRows(c, a.p_resource == null ? null : String(a.p_resource), a.p_table == null ? null : String(a.p_table), a.p_after == null ? null : String(a.p_after), int4(a.p_limit)),
  },
  get_offline_content_changes: { params: [] as string[], run: (c: ContentContext) => getOfflineContentChanges(c) },
};
