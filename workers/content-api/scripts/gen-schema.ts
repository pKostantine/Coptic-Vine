/**
 * Turns the Postgres catalog snapshot (schema/pg-catalog.json, made by
 * schema/pg-catalog.sql) into the D1 schema:
 *
 *   migrations/0001_content_schema.sql   tables, keys, checks, indexes, views
 *   schema/content-tables.json           what import, verify and the Worker
 *                                        need to know about each table
 *
 *   node --experimental-strip-types scripts/gen-schema.ts [--check]
 *
 * --check regenerates in memory and fails if the files on disk differ, so a
 * hand edit to a generated file can't go unnoticed.
 *
 * Type mapping (section 4.2 of the plan): text and enums to TEXT, enums with
 * a CHECK on their values; integers to INTEGER; numeric, double precision and
 * real to REAL; boolean to INTEGER 0/1; jsonb to TEXT holding JSON; date to
 * TEXT (ISO 8601). Generated tsvector columns are dropped (FTS5 replaces them,
 * see migrations/0002). Tables are STRICT, so a value of the wrong type is
 * refused rather than stored.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { col, indexName, t } from '../src/db/names.ts';

type PgColumn = { name: string; type: string; enum: string | null; notNull: boolean; default: string | null; generated: boolean; identity: boolean };
type PgConstraint = { name: string; type: 'p' | 'u' | 'f' | 'c'; definition: string; columns: string[]; references: string | null; referencedColumns: string[] | null; onUpdate: string | null; onDelete: string | null };
type PgIndex = { name: string; definition: string; unique: boolean; backsConstraint: boolean };
type PgRelation = { schema: string; table: string; kind: 'r' | 'p' | 'v'; anonReadable: boolean; view: string | null; columns: PgColumn[]; constraints: PgConstraint[]; indexes: PgIndex[]; triggers: string[] };
type PgCatalog = { enums: Record<string, string[]>; relations: PgRelation[] };

/** How a column's value is stored in D1 and written in a canonical row (verify.ts). */
export type ColumnKind = 'text' | 'integer' | 'numeric' | 'float8' | 'float4' | 'boolean' | 'jsonb' | 'date';

export type TableInfo = {
  schema: string;
  table: string;
  /** Readable by the anon role in Supabase today: the Worker serves only these. */
  public: boolean;
  columns: { name: string; kind: ColumnKind; pgType: string; notNull: boolean }[];
  /** Columns dropped from the copy (generated tsvector). */
  dropped: string[];
  /** Primary key, or every column for the three tables without one. */
  rowKey: string[];
  hasPrimaryKey: boolean;
  /** Tables this one references, so they load first. */
  parents: string[];
  /** Postgres triggers that validate rows; import.ts runs the same checks. */
  validators: string[];
};

export type ContentSchema = {
  tables: TableInfo[];
  views: { schema: string; table: string; public: boolean; columns: string[] }[];
  /** Enum values in Postgres's order, which is how it sorts them. */
  enums: Record<string, string[]>;
};

const root = new URL('..', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');

function kindOf(column: PgColumn): ColumnKind | null {
  if (column.enum) return 'text';
  if (column.generated && column.type === 'tsvector') return null;
  switch (column.type) {
    case 'text': return 'text';
    case 'integer': case 'bigint': case 'smallint': return 'integer';
    case 'numeric': return 'numeric';
    case 'double precision': return 'float8';
    case 'real': return 'float4';
    case 'boolean': return 'boolean';
    case 'jsonb': return 'jsonb';
    case 'date': return 'date';
    default: throw new Error(`No D1 mapping for ${column.name} ${column.type}`);
  }
}

const SQLITE_TYPE: Record<ColumnKind, string> = {
  text: 'TEXT', integer: 'INTEGER', numeric: 'REAL', float8: 'REAL', float4: 'REAL', boolean: 'INTEGER', jsonb: 'TEXT', date: 'TEXT',
};

const quoteText = (value: string) => `'${value.replaceAll("'", "''")}'`;

function defaultSql(column: PgColumn, kind: ColumnKind): string | null {
  const value = column.default;
  if (value == null) return null;
  if (kind === 'boolean') {
    if (value === 'true') return '1';
    if (value === 'false') return '0';
  }
  const literal = value.match(/^'((?:[^']|'')*)'::[\w" ]+$/);
  if (literal) return `'${literal[1]}'`;
  if (/^-?\d+(\.\d+)?$/.test(value)) return value;
  throw new Error(`Unsupported default for ${column.name}: ${value}`);
}

/** A Postgres CHECK in SQLite's words. Only the shapes the content schemas use are translated; anything else stops the build. */
function checkSql(definition: string): string {
  let body = definition.replace(/^CHECK /, '');
  body = body.replace(/\((\w+) = ANY \(ARRAY\[([^\]]*)\]\)\)/g, (_, name, list) => `(${col(name)} IN (${list}))`);
  body = body.replace(/\((\w+) ~ '\^\[a-z\]\$'::text\)/g, (_, name) => `(${col(name)} GLOB '[a-z]')`);
  body = body.replace(/::(text|integer)\b/g, '');
  if (/::|~|\bANY\b|\bARRAY\b/.test(body)) throw new Error(`Untranslated CHECK: ${definition}`);
  return `CHECK ${body}`;
}

const FK_ACTION: Record<string, string> = { a: 'NO ACTION', r: 'RESTRICT', c: 'CASCADE', n: 'SET NULL', d: 'SET DEFAULT' };

/** Every schema.table in a view or index definition, quoted. Only known relations are touched, so an alias like e.entry_key is left alone. */
function quoteRelations(sql: string, known: Set<string>): string {
  return sql.replace(/\b([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)\b/g, (whole, schema, table) => (known.has(`${schema}.${table}`) ? t(schema, table) : whole));
}

export function generate(catalog: PgCatalog): { migration: string; schema: ContentSchema } {
  const known = new Set(catalog.relations.map((relation) => `${relation.schema}.${relation.table}`));
  const tables = catalog.relations.filter((relation) => relation.kind !== 'v');
  const views = catalog.relations.filter((relation) => relation.kind === 'v');

  // Parents before children, then by name, so the file reads in load order.
  const byName = new Map(tables.map((relation) => [`${relation.schema}.${relation.table}`, relation]));
  const ordered: PgRelation[] = [];
  const placed = new Set<string>();
  const place = (name: string, path: string[] = []) => {
    if (placed.has(name)) return;
    if (path.includes(name)) throw new Error(`Foreign key cycle: ${[...path, name].join(' -> ')}`);
    const relation = byName.get(name)!;
    for (const fk of relation.constraints.filter((c) => c.type === 'f')) {
      if (!byName.has(fk.references!)) throw new Error(`${name} references ${fk.references}, which is not copied`);
      if (fk.references !== name) place(fk.references!, [...path, name]);
    }
    placed.add(name);
    ordered.push(relation);
  };
  for (const name of [...byName.keys()].sort()) place(name);

  const out: string[] = [
    '-- Generated by scripts/gen-schema.ts from schema/pg-catalog.json. Do not edit by hand.',
    '-- Every name is "schema.table", always double-quoted (see src/db/names.ts).',
    '',
  ];
  const info: TableInfo[] = [];

  for (const relation of ordered) {
    const lines: string[] = [];
    const columns: TableInfo['columns'] = [];
    const dropped: string[] = [];
    const pk = relation.constraints.find((c) => c.type === 'p');
    for (const column of relation.columns) {
      const kind = kindOf(column);
      if (!kind) { dropped.push(column.name); continue; }
      columns.push({ name: column.name, kind, pgType: column.enum ? `"${column.enum}"` : column.type, notNull: column.notNull });
      let line = `  ${col(column.name)} ${SQLITE_TYPE[kind]}`;
      if (column.notNull) line += ' NOT NULL';
      const fallback = defaultSql(column, kind);
      if (fallback != null) line += ` DEFAULT ${fallback}`;
      if (column.enum) line += ` CHECK (${col(column.name)} IN (${catalog.enums[column.enum].map(quoteText).join(', ')}))`;
      if (kind === 'boolean') line += ` CHECK (${col(column.name)} IN (0, 1))`;
      if (kind === 'jsonb') line += ` CHECK (json_valid(${col(column.name)}))`;
      if (kind === 'date') line += ` CHECK (${col(column.name)} IS date(${col(column.name)}))`;
      lines.push(line);
    }
    if (pk) lines.push(`  PRIMARY KEY (${pk.columns.map(col).join(', ')})`);
    for (const unique of relation.constraints.filter((c) => c.type === 'u')) lines.push(`  UNIQUE (${unique.columns.map(col).join(', ')})`);
    for (const check of relation.constraints.filter((c) => c.type === 'c')) lines.push(`  ${checkSql(check.definition)}`);
    const parents: string[] = [];
    for (const fk of relation.constraints.filter((c) => c.type === 'f')) {
      const [schema, table] = fk.references!.split('.');
      parents.push(fk.references!);
      lines.push(`  FOREIGN KEY (${fk.columns.map(col).join(', ')}) REFERENCES ${t(schema, table)} (${fk.referencedColumns!.map(col).join(', ')}) ON UPDATE ${FK_ACTION[fk.onUpdate!]} ON DELETE ${FK_ACTION[fk.onDelete!]}`);
    }
    out.push(`CREATE TABLE ${t(relation.schema, relation.table)} (`, lines.join(',\n'), ') STRICT;');

    // Indexes: the constraint ones exist already; full-text (gin) ones are
    // replaced by FTS5; one that repeats a constraint's columns is skipped.
    const constraintColumns = relation.constraints.filter((c) => c.type === 'p' || c.type === 'u').map((c) => c.columns.join(','));
    for (const index of relation.indexes.filter((i) => !i.backsConstraint)) {
      const shape = index.definition.match(/ USING (\w+) \((.+?)\)(?: WHERE \((.*)\))?$/);
      if (!shape) throw new Error(`Unparsed index: ${index.definition}`);
      const [, method, list, where] = shape;
      if (method === 'gin') continue;
      if (method !== 'btree') throw new Error(`Unsupported index method: ${index.definition}`);
      const names = list.split(',').map((part) => part.trim());
      if (!names.every((name) => /^[a-z_][a-z0-9_]*$/.test(name))) throw new Error(`Expression index: ${index.definition}`);
      if (!where && constraintColumns.includes(names.join(','))) continue;
      let statement = `CREATE ${index.unique ? 'UNIQUE ' : ''}INDEX ${indexName(relation.schema, index.name)} ON ${t(relation.schema, relation.table)} (${names.map(col).join(', ')})`;
      if (where) statement += ` WHERE ${where.replace(/::text\b/g, '')}`;
      out.push(`${statement};`);
    }
    out.push('');

    info.push({
      schema: relation.schema,
      table: relation.table,
      public: relation.anonReadable,
      columns,
      dropped,
      rowKey: pk ? pk.columns : columns.map((column) => column.name),
      hasPrimaryKey: Boolean(pk),
      parents: [...new Set(parents)].filter((parent) => parent !== `${relation.schema}.${relation.table}`),
      validators: relation.triggers.map((trigger) => trigger.split(' -> ')[1]).filter((fn) => /validate/.test(fn)),
    });
  }

  const viewInfo: ContentSchema['views'] = [];
  for (const view of views) {
    const body = quoteRelations(view.view!.trim().replace(/;$/, ''), known).replace(/::text\b/g, '');
    if (/::/.test(body)) throw new Error(`Untranslated cast in view ${view.schema}.${view.table}`);
    out.push(`CREATE VIEW ${t(view.schema, view.table)} AS`, body + ';', '');
    viewInfo.push({ schema: view.schema, table: view.table, public: view.anonReadable, columns: view.columns.map((column) => column.name) });
  }

  return { migration: out.join('\n'), schema: { tables: info, views: viewInfo, enums: catalog.enums } };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { migration, schema } = generate(JSON.parse(read('schema/pg-catalog.json')));
  const files: [string, string][] = [
    ['migrations/0001_content_schema.sql', migration],
    ['schema/content-tables.json', `${JSON.stringify(schema, null, 1)}\n`],
  ];
  if (process.argv.includes('--check')) {
    const stale = files.filter(([path, text]) => read(path) !== text).map(([path]) => path);
    if (stale.length) {
      console.error(`Out of date with schema/pg-catalog.json: ${stale.join(', ')}. Run npm run gen:schema.`);
      process.exit(1);
    }
    console.log('Generated schema files are up to date.');
  } else {
    for (const [path, text] of files) writeFileSync(new URL(path, root), text);
    console.log(`${schema.tables.length} tables and ${schema.views.length} views written to ${files.map(([path]) => path).join(' and ')}.`);
  }
}
