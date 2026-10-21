/**
 * Turns the Postgres catalog of the user data (schema/pg-catalog-users.json,
 * made by schema/pg-catalog-users.sql) into the D1 schema for Phase 2 of
 * docs/coptic-vine-d1-plan.md:
 *
 *   ../content-api/migrations/0007_user_schema.sql   tables, keys, checks, indexes, updated_at triggers
 *   schema/user-tables.json                           what import, verify and the Worker need to know
 *
 *   node --experimental-strip-types scripts/gen-schema.ts [--check]
 *
 * The copticvine database keeps one migration history, in
 * workers/content-api/migrations; 0006_auth.sql there holds the sign-in tables
 * these reference ("auth.users" and the rest, for Better Auth).
 *
 * Type mapping, on top of Phase 1's (section 4.2 of the plan):
 *   uuid, varchar, text, enums   TEXT (enums CHECKed against their values, varchar against its length)
 *   timestamptz                  TEXT, exactly as Supabase's REST API prints it, always UTC:
 *                                2026-10-20T19:52:43.123456+00:00, so string order is time order
 *   date                         TEXT (ISO 8601)
 *   jsonb                        TEXT, as Postgres prints it
 *   text[]                       TEXT holding a JSON array
 *   integer, bigint, smallint    INTEGER;  real REAL;  boolean INTEGER 0/1
 *   tsvector                     dropped (search moves to the Worker)
 * Defaults: now() and gen_random_uuid() become SQLite expressions; auth.uid()
 * has none, since the Worker always writes the signed-in user. Postgres
 * CHECKs are translated (regular expressions to GLOB); the one that reads
 * today's date can't be a SQLite CHECK, so the Worker enforces it. Triggers
 * that keep updated_at become SQLite triggers; the others are application
 * logic that moves into the Worker, listed in user-tables.json.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { col, indexName, t } from '../../content-api/src/db/names.ts';

type PgColumn = { name: string; type: string; enum: string | null; notNull: boolean; default: string | null; generated: boolean; identity: boolean };
type PgConstraint = { name: string; type: 'p' | 'u' | 'f' | 'c' | 'x'; definition: string; columns: string[]; references: string | null; referencedColumns: string[] | null; onUpdate: string | null; onDelete: string | null };
type PgIndex = { name: string; definition: string; unique: boolean; backsConstraint: boolean };
type PgRelation = { schema: string; table: string; kind: 'r' | 'p' | 'v'; anonReadable: boolean; view: string | null; columns: PgColumn[]; constraints: PgConstraint[]; indexes: PgIndex[]; triggers: string[] };
type PgCatalog = { enums: Record<string, string[]>; relations: PgRelation[] };

/** How a column is stored in D1 and written in a canonical row (verify.ts). */
export type UserColumnKind = 'text' | 'timestamptz' | 'date' | 'jsonb' | 'array' | 'integer' | 'float4' | 'boolean';

export type UserTable = {
  schema: string;
  table: string;
  columns: { name: string; kind: UserColumnKind; pgType: string; notNull: boolean; generated: boolean }[];
  /** Columns not copied (tsvector). */
  dropped: string[];
  primaryKey: string[];
  /** Tables this one references, so the import loads them first where it can. */
  parents: string[];
  /** Its foreign keys within the user data, for the import to break the cycles. */
  foreignKeys: { columns: string[]; references: string; referencedColumns: string[] }[];
  /** Postgres CHECKs the Worker enforces because SQLite can't. */
  workerChecks: string[];
  /** Postgres triggers whose work moves into the Worker (all but updated_at). */
  workerTriggers: string[];
  /** Indexes not recreated (full-text and trigram), for the search port. */
  skippedIndexes: string[];
};

export type UserSchema = { tables: UserTable[]; enums: Record<string, string[]> };

const root = new URL('..', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');

/** Postgres's now() as Supabase's REST API prints it: UTC, trailing zeros of the fraction dropped. */
export const NOW_SQL = "(rtrim(rtrim(strftime('%Y-%m-%dT%H:%M:%f', 'now'), '0'), '.') || '+00:00')";
/** gen_random_uuid(): a version 4 UUID, lowercase. */
export const UUID_SQL = "(lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))))";
/**
 * The shape every stored timestamptz has: a valid date and time, an optional
 * fraction, and +00:00. D1 refuses LIKE and GLOB patterns over 50 bytes, so
 * the digits are checked by datetime() rather than a longer pattern.
 */
export function timestampCheck(c: string): string {
  // NULL passes, as in any CHECK (IS NOT NULL alone would turn it into false).
  return `(${c} IS NULL OR (${c} GLOB '????-??-??T??:??:??*+00:00' AND datetime(substr(${c}, 1, 19)) IS NOT NULL AND (length(${c}) = 25 OR (substr(${c}, 20, 1) = '.' AND length(${c}) BETWEEN 27 AND 32 AND substr(${c}, 21, length(${c}) - 26) NOT GLOB '*[^0-9]*'))))`;
}

/** A lowercase UUID, without a pattern past D1's 50-byte limit. */
function uuidCheck(value: string): string {
  return `(length(${value}) = 36 AND ${value} NOT GLOB '*[^0-9a-f-]*' AND substr(${value}, 9, 1) = '-' AND substr(${value}, 14, 1) = '-' AND substr(${value}, 19, 1) = '-' AND substr(${value}, 24, 1) = '-' AND length(replace(${value}, '-', '')) = 32)`;
}

function kindOf(column: PgColumn): UserColumnKind | null {
  if (column.enum) return 'text';
  const type = column.type.replace(/\(\d+\)$/, '');
  switch (type) {
    case 'uuid': case 'text': case 'character varying': return 'text';
    case 'timestamp with time zone': return 'timestamptz';
    case 'date': return 'date';
    case 'jsonb': return 'jsonb';
    case 'text[]': return 'array';
    case 'integer': case 'bigint': case 'smallint': return 'integer';
    case 'real': return 'float4';
    case 'boolean': return 'boolean';
    case 'tsvector': return null;
    default: throw new Error(`No D1 mapping for ${column.name} ${column.type}`);
  }
}

const SQLITE_TYPE: Record<UserColumnKind, string> = {
  text: 'TEXT', timestamptz: 'TEXT', date: 'TEXT', jsonb: 'TEXT', array: 'TEXT', integer: 'INTEGER', float4: 'REAL', boolean: 'INTEGER',
};

const quoteText = (value: string) => `'${value.replaceAll("'", "''")}'`;

function defaultSql(column: PgColumn, kind: UserColumnKind): string | null {
  const value = column.default;
  if (value == null || column.generated) return null;
  if (value === 'now()') return NOW_SQL;
  if (value === 'gen_random_uuid()') return UUID_SQL;
  if (value === 'auth.uid()') return null;
  if (/^NULL::/.test(value)) return 'NULL';
  if (kind === 'boolean') {
    if (value === 'true') return '1';
    if (value === 'false') return '0';
  }
  if (kind === 'array' && value === "'{}'::text[]") return "'[]'";
  const literal = value.match(/^'((?:[^']|'')*)'::[\w." ]+$/);
  if (literal) return `'${literal[1]}'`;
  if (/^-?\d+(\.\d+)?$/.test(value)) return value;
  throw new Error(`Unsupported default for ${column.name}: ${value}`);
}

/** A Postgres expression (CHECK body, partial-index WHERE, generated column) in SQLite's words; null if it can't be one. */
export function expressionSql(expression: string): string | null {
  let body = expression;
  // Regular expressions first, while their patterns are intact; each one used here, by hand.
  const regexes: [RegExp, (name: string) => string][] = [
    [/\((\w+) ~ '\^\[a-f0-9\]\{64\}\$'::text\)/g, (name) => `(length(${col(name)}) = 64 AND ${col(name)} NOT GLOB '*[^a-f0-9]*')`],
    [/\((\w+) ~ '\^\[a-z0-9\]\[a-z0-9_-\]\*\$'::text\)/g, (name) => `(${col(name)} GLOB '[a-z0-9]*' AND ${col(name)} NOT GLOB '*[^a-z0-9_-]*')`],
    [/\((\w+) ~\* '\^https\?:\/\/\[\^\\s\]\+\$'::text\)/g, (name) => `((lower(${col(name)}) GLOB 'http://?*' OR lower(${col(name)}) GLOB 'https://?*') AND ${col(name)} NOT GLOB '*[ ' || char(9, 10, 11, 12, 13) || ']*')`],
  ];
  for (const [pattern, replace] of regexes) body = body.replace(pattern, (_, name: string) => replace(name));
  body = body.replace(/\((\w+) ~ '\^submissions\/\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{12\}\/\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{12\}\/original\(\\\.\[a-z0-9\]\{1,12\}\)\?\$'::text\)/g,
    (_, name: string) => {
      // submissions/<uuid>/<uuid>/original[.ext]: fixed positions, checked piece by piece.
      const c = col(name);
      const fixed = 12 + 36 + 1 + 36 + 9;
      return `(substr(${c}, 1, 12) = 'submissions/' AND ${uuidCheck(`substr(${c}, 13, 36)`)} AND substr(${c}, 49, 1) = '/' AND ${uuidCheck(`substr(${c}, 50, 36)`)} AND substr(${c}, 86, 9) = '/original' AND (length(${c}) = ${fixed} OR (substr(${c}, ${fixed + 1}, 1) = '.' AND length(${c}) BETWEEN ${fixed + 2} AND ${fixed + 13} AND substr(${c}, ${fixed + 2}) NOT GLOB '*[^a-z0-9]*')))`;
    });
  // LIKE 'prefix%' (case-sensitive in Postgres, as GLOB is).
  body = body.replace(/\((\w+) (!?)~~ '((?:[^'%_]|'')*)%'::text\)/g, (_, name: string, not: string, prefix: string) => `(${col(name)} ${not ? 'NOT ' : ''}GLOB '${prefix}*')`);
  if (/ !?~/.test(body)) return null;
  if (/CURRENT_DATE|now\(\)|CURRENT_TIMESTAMP/.test(body)) return null;

  body = body.replace(/(\w+) = ANY \(ARRAY\[([^\]]*)\]\)/g, (_, name: string, list: string) => `${name} IN (${list})`);
  body = body.replace(/'(-?\d+)'::(bigint|integer|smallint)/g, '$1');
  body = body.replace(/::(text|bigint|integer|smallint|date|character varying|[a-z_]+\.[a-z_]+)\b/g, '');
  body = body.replace(/TRIM\(BOTH FROM ([^()]+|\([^()]*\))\)/g, 'trim($1)');
  body = body.replace(/\bbtrim\(/g, 'trim(').replace(/\bchar_length\(/g, 'length(');
  body = body.replace(/octet_length\(\((\w+)\)\)/g, (_, name: string) => `length(CAST(${name} AS BLOB))`);
  body = body.replace(/\bjsonb_typeof\(/g, 'json_type(').replace(/\bjsonb_array_length\(/g, 'json_array_length(');
  body = body.replace(/\bcardinality\(/g, 'json_array_length(');
  if (/::|\bANY\b|\bARRAY\b|\bjsonb_|\bLEAST\b|\bGREATEST\b/.test(body)) return null;
  // Bare column names to quoted ones; keywords, functions, literals and already-quoted names stay.
  const keep = new Set(['AND', 'OR', 'NOT', 'NULL', 'IS', 'IN', 'BETWEEN', 'GLOB', 'CAST', 'AS', 'BLOB', 'true', 'false']);
  return body.replace(/'(?:[^']|'')*'|"[^"]*"|\b([a-zA-Z_][a-zA-Z0-9_]*)\b(?!\s*\()/g, (whole, name?: string) => (name && !keep.has(name) ? col(name) : whole));
}

const FK_ACTION: Record<string, string> = { a: 'NO ACTION', r: 'RESTRICT', c: 'CASCADE', n: 'SET NULL', d: 'SET DEFAULT' };

export function generate(catalog: PgCatalog): { migration: string; schema: UserSchema } {
  const tables = catalog.relations.filter((relation) => relation.kind !== 'v' && relation.schema !== 'auth');
  const known = new Set(tables.map((relation) => `${relation.schema}.${relation.table}`));
  // Tables already in D1: the sign-in tables (0006) and Phase 1's content.
  const outside = new Set([['auth', 'users'], ['public', 'hymn_titles']].map((parts) => parts.join('.')));

  const out: string[] = [
    '-- Generated by workers/api/scripts/gen-schema.ts from workers/api/schema/pg-catalog-users.json. Do not edit by hand.',
    '-- The user data (Phase 2). Every name is "schema.table", always double-quoted (see src/db/names.ts).',
    '',
  ];
  const info: UserTable[] = [];

  for (const relation of [...tables].sort((a, b) => `${a.schema}.${a.table}`.localeCompare(`${b.schema}.${b.table}`))) {
    const name = `${relation.schema}.${relation.table}`;
    const lines: string[] = [];
    const columns: UserTable['columns'] = [];
    const dropped: string[] = [];
    const workerChecks: string[] = [];
    for (const column of relation.columns) {
      const kind = kindOf(column);
      if (!kind) { dropped.push(column.name); continue; }
      columns.push({ name: column.name, kind, pgType: column.enum ? `"${column.enum}"` : column.type, notNull: column.notNull, generated: column.generated });
      let line = `  ${col(column.name)} ${SQLITE_TYPE[kind]}`;
      if (column.generated) {
        const expression = expressionSql(column.default!);
        if (!expression) throw new Error(`Untranslated generated column ${name}.${column.name}: ${column.default}`);
        line += ` GENERATED ALWAYS AS (${kind === 'boolean' ? `CASE WHEN ${expression} THEN 1 ELSE 0 END` : expression}) VIRTUAL`;
        lines.push(line);
        continue;
      }
      if (column.notNull) line += ' NOT NULL';
      const fallback = defaultSql(column, kind);
      if (fallback != null) line += ` DEFAULT ${fallback}`;
      const c = col(column.name);
      if (column.enum) line += ` CHECK (${c} IN (${catalog.enums[column.enum].map(quoteText).join(', ')}))`;
      const varchar = column.type.match(/^character varying\((\d+)\)$/);
      if (varchar) line += ` CHECK (length(${c}) <= ${varchar[1]})`;
      if (kind === 'boolean') line += ` CHECK (${c} IN (0, 1))`;
      if (kind === 'jsonb') line += ` CHECK (json_valid(${c}))`;
      if (kind === 'array') line += ` CHECK (json_valid(${c}) AND json_type(${c}) = 'array')`;
      if (kind === 'date') line += ` CHECK (${c} IS date(${c}))`;
      if (kind === 'timestamptz') line += ` CHECK ${timestampCheck(c)}`;
      lines.push(line);
    }
    const pk = relation.constraints.find((c) => c.type === 'p');
    if (!pk) throw new Error(`${name} has no primary key`);
    lines.push(`  PRIMARY KEY (${pk.columns.map(col).join(', ')})`);
    for (const unique of relation.constraints.filter((c) => c.type === 'u')) lines.push(`  UNIQUE (${unique.columns.map(col).join(', ')})`);
    for (const check of relation.constraints.filter((c) => c.type === 'c')) {
      const body = expressionSql(check.definition.replace(/^CHECK /, ''));
      if (body) lines.push(`  CHECK ${body}`);
      else workerChecks.push(check.definition);
    }
    const parents: string[] = [];
    const foreignKeys: UserTable['foreignKeys'] = [];
    for (const fk of relation.constraints.filter((c) => c.type === 'f')) {
      if (!known.has(fk.references!) && !outside.has(fk.references!)) throw new Error(`${name} references ${fk.references}, which isn't in D1`);
      const [schema, table] = fk.references!.split('.');
      if (fk.references !== name) parents.push(fk.references!);
      if (known.has(fk.references!)) foreignKeys.push({ columns: fk.columns, references: fk.references!, referencedColumns: fk.referencedColumns! });
      lines.push(`  FOREIGN KEY (${fk.columns.map(col).join(', ')}) REFERENCES ${t(schema, table)} (${fk.referencedColumns!.map(col).join(', ')}) ON UPDATE ${FK_ACTION[fk.onUpdate!]} ON DELETE ${FK_ACTION[fk.onDelete!]}`);
    }
    if (relation.constraints.some((c) => c.type === 'x')) throw new Error(`${name} has an exclusion constraint`);
    out.push(`CREATE TABLE ${t(relation.schema, relation.table)} (`, lines.join(',\n'), ') STRICT;');

    const skippedIndexes: string[] = [];
    for (const index of relation.indexes.filter((i) => !i.backsConstraint)) {
      const shape = index.definition.match(/ USING (\w+) \((.+?)\)(?: WHERE (.*))?$/);
      if (!shape) throw new Error(`Unparsed index: ${index.definition}`);
      const [, method, list, where] = shape;
      if (method === 'gin') { skippedIndexes.push(index.definition); continue; }
      if (method !== 'btree') throw new Error(`Unsupported index method: ${index.definition}`);
      const parts = list.split(',').map((part) => part.trim().match(/^([a-z_][a-z0-9_]*)( DESC)?$/));
      if (parts.some((part) => !part)) throw new Error(`Expression index: ${index.definition}`);
      let statement = `CREATE ${index.unique ? 'UNIQUE ' : ''}INDEX ${indexName(relation.schema, index.name)} ON ${t(relation.schema, relation.table)} (${parts.map((part) => col(part![1]) + (part![2] ?? '')).join(', ')})`;
      if (where) {
        const condition = expressionSql(where);
        if (!condition) throw new Error(`Untranslated index condition: ${index.definition}`);
        statement += ` WHERE ${condition}`;
      }
      out.push(`${statement};`);
    }

    const triggerFunctions = relation.triggers.map((trigger) => trigger.split(' -> ')[1]);
    if (triggerFunctions.includes('private.set_updated_at')) {
      if (!columns.some((column) => column.name === 'updated_at')) throw new Error(`${name} has set_updated_at but no updated_at`);
      // Postgres sets updated_at before every update; here the row is stamped
      // after any update that didn't set it itself (the WHEN keeps the stamp
      // from firing the trigger again).
      out.push(
        `CREATE TRIGGER ${indexName(relation.schema, `${relation.table}_set_updated_at`)} AFTER UPDATE ON ${t(relation.schema, relation.table)}`,
        `FOR EACH ROW WHEN NEW.${col('updated_at')} IS OLD.${col('updated_at')}`,
        'BEGIN',
        `  UPDATE ${t(relation.schema, relation.table)} SET ${col('updated_at')} = ${NOW_SQL} WHERE rowid = NEW.rowid;`,
        'END;',
      );
    }
    out.push('');

    info.push({
      schema: relation.schema,
      table: relation.table,
      columns,
      dropped,
      primaryKey: pk.columns,
      parents: [...new Set(parents)],
      foreignKeys,
      workerChecks,
      workerTriggers: [...new Set(triggerFunctions.filter((fn) => fn !== 'private.set_updated_at'))],
      skippedIndexes,
    });
  }

  return { migration: out.join('\n'), schema: { tables: info, enums: catalog.enums } };
}

/**
 * Each table's unique indexes and constraints, as Postgres names them, with
 * their columns: a UNIQUE failure from SQLite names the columns, and the
 * Worker answers with Postgres's name for them (src/pg.ts, uniqueViolation).
 */
export function uniqueKeys(catalog: PgCatalog): Record<string, [string, string[]][]> {
  const out: Record<string, [string, string[]][]> = {};
  for (const relation of catalog.relations) {
    if (relation.kind !== 'r' || relation.schema === 'auth') continue;
    const keys: [string, string[]][] = [];
    for (const index of relation.indexes) {
      if (!index.unique) continue;
      const columns = index.definition.match(/USING btree \(([^)]*)\)/)?.[1];
      if (!columns || /[()]/.test(columns)) continue;
      keys.push([index.name, columns.split(', ').map((c) => c.replace(/"/g, ''))]);
    }
    if (keys.length) out[`${relation.schema}.${relation.table}`] = keys.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const catalog = JSON.parse(read('schema/pg-catalog-users.json')) as PgCatalog;
  const { migration, schema } = generate(catalog);
  const files: [string, string][] = [
    ['../content-api/migrations/0007_user_schema.sql', migration],
    ['schema/user-tables.json', `${JSON.stringify(schema, null, 1)}\n`],
    ['schema/unique-keys.json', `${JSON.stringify(uniqueKeys(catalog), null, 1)}\n`],
  ];
  if (process.argv.includes('--check')) {
    const stale = files.filter(([path, text]) => read(path) !== text).map(([path]) => path);
    if (stale.length) {
      console.error(`Out of date with schema/pg-catalog-users.json: ${stale.join(', ')}. Run npm run gen:schema.`);
      process.exit(1);
    }
    console.log('Generated schema files are up to date.');
  } else {
    for (const [path, text] of files) writeFileSync(new URL(path, root), text);
    const workerChecks = schema.tables.flatMap((table) => table.workerChecks.map((check) => `${table.schema}.${table.table}: ${check}`));
    console.log(`${schema.tables.length} tables written to ${files.map(([path]) => path).join(' and ')}.`);
    if (workerChecks.length) console.log(`Checks the Worker enforces:\n  ${workerChecks.join('\n  ')}`);
  }
}
