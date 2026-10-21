/**
 * Better Auth's database adapter for D1 (Phase 2 of docs/coptic-vine-d1-plan.md).
 *
 * Better Auth has no D1 adapter of its own, and its Kysely path would turn the
 * model name "auth.users" into "auth"."users", which SQLite reads as a table
 * in an attached database. Here every table name goes through t() and every
 * column through col(), so the names stay "auth.users", always quoted.
 *
 * Models and fields arrive already mapped to the D1 names by the options in
 * src/auth/index.ts (modelName "auth.users", fields like email_verified).
 * Dates are stored in the user data's form (src/time.ts), booleans as 0/1.
 * D1 has no interactive transactions, so operations run one after another,
 * as Better Auth does for adapters without them.
 */
import { createAdapterFactory, type CleanedWhere } from 'better-auth/adapters';
import { col, t } from '../../../content-api/src/db/names.ts';
import { storedTimestamp } from '../time.ts';
import type { D1Database } from '../types.ts';

type Row = Record<string, unknown>;

/** A sign-in model's name for Better Auth's options: the table's "schema.table" name without quotes, which table() turns back into t(). */
export const authModel = (name: string) => ['auth', name].join('.');

function table(model: string): string {
  const [schema, name, ...rest] = model.split('.');
  if (!name || rest.length) throw new Error(`Model ${model} is not a "schema.table" name`);
  return t(schema, name);
}

/**
 * A where clause as SQL. The factory has already put dates in the stored
 * form and booleans as 0/1. Pattern operators use instr/substr rather than
 * LIKE, which keeps clear of D1's 50-byte pattern limit and of escaping.
 */
export function whereSql(where: CleanedWhere[] | undefined): { sql: string; values: unknown[] } {
  if (!where?.length) return { sql: '', values: [] };
  const values: unknown[] = [];
  const parts = where.map((clause, index) => {
    const insensitive = clause.mode === 'insensitive' && typeof clause.value === 'string';
    const fold = (v: unknown) => (insensitive && typeof v === 'string' ? v.toLowerCase() : v);
    const field = insensitive ? `lower(${col(clause.field)})` : col(clause.field);
    const bind = (v: unknown) => {
      values.push(fold(v instanceof Date ? storedTimestamp(v.toISOString()) : typeof v === 'boolean' ? (v ? 1 : 0) : v));
      return '?';
    };
    let sql: string;
    switch (clause.operator) {
      case 'eq': sql = clause.value === null ? `${field} IS NULL` : `${field} = ${bind(clause.value)}`; break;
      case 'ne': sql = clause.value === null ? `${field} IS NOT NULL` : `${field} IS NOT ${bind(clause.value)}`; break;
      case 'lt': sql = `${field} < ${bind(clause.value)}`; break;
      case 'lte': sql = `${field} <= ${bind(clause.value)}`; break;
      case 'gt': sql = `${field} > ${bind(clause.value)}`; break;
      case 'gte': sql = `${field} >= ${bind(clause.value)}`; break;
      case 'in': case 'not_in': {
        const list = (Array.isArray(clause.value) ? clause.value : [clause.value]).map(fold);
        values.push(JSON.stringify(list));
        sql = `${field} ${clause.operator === 'in' ? 'IN' : 'NOT IN'} (SELECT value FROM json_each(?))`;
        break;
      }
      case 'contains': sql = `instr(${field}, ${bind(clause.value)}) > 0`; break;
      case 'starts_with': sql = `substr(${field}, 1, length(${bind(clause.value)})) = ${bind(clause.value)}`; break;
      case 'ends_with': sql = `substr(${field}, -length(${bind(clause.value)})) = ${bind(clause.value)}`; break;
      default: throw new Error(`Unsupported where operator ${String(clause.operator)}`);
    }
    return index === 0 ? sql : `${clause.connector === 'OR' ? 'OR' : 'AND'} ${sql}`;
  });
  return { sql: ` WHERE ${parts.join(' ')}`, values };
}

export function d1Adapter(db: D1Database) {
  return createAdapterFactory({
    config: {
      adapterId: 'cv-d1',
      adapterName: 'Coptic Vine D1',
      usePlural: false,
      supportsJSON: false,
      supportsDates: false,
      supportsBooleans: false,
      supportsArrays: false,
      transaction: false,
      // Dates arrive as JavaScript's ISO strings (…Z); D1 keeps the user data's form.
      customTransformInput: ({ data, fieldAttributes }) => (fieldAttributes.type === 'date' && typeof data === 'string' ? storedTimestamp(data) : data),
    },
    adapter: ({ getFieldName }) => {
      // Sort and select fields can arrive under Better Auth's own names (createdAt); map them to D1's.
      const field = (model: string, name: string) => col(getFieldName({ model, field: name }));
      const selectList = (model: string, select?: string[]) => (select?.length ? select.map((name) => field(model, name)).join(', ') : '*');
      return {
        async create({ model, data, select }) {
          const keys = Object.keys(data).filter((key) => data[key] !== undefined);
          const sql = `INSERT INTO ${table(model)} (${keys.map(col).join(', ')}) VALUES (${keys.map(() => '?').join(', ')}) RETURNING ${selectList(model, select)}`;
          const row = await db.prepare(sql).bind(...keys.map((key) => data[key])).first<Row>();
          return row as typeof data;
        },
        async findOne({ model, where, select }) {
          const w = whereSql(where);
          return (await db.prepare(`SELECT ${selectList(model, select)} FROM ${table(model)}${w.sql} LIMIT 1`).bind(...w.values).first<Row>()) as never;
        },
        async findMany({ model, where, limit, select, sortBy, offset }) {
          const w = whereSql(where);
          let sql = `SELECT ${selectList(model, select)} FROM ${table(model)}${w.sql}`;
          if (sortBy) sql += ` ORDER BY ${field(model, sortBy.field)} ${sortBy.direction === 'desc' ? 'DESC' : 'ASC'}`;
          sql += ` LIMIT ${Math.max(0, Math.floor(limit))}`;
          if (offset) sql += ` OFFSET ${Math.max(0, Math.floor(offset))}`;
          return (await db.prepare(sql).bind(...w.values).all<Row>()).results as never;
        },
        async count({ model, where }) {
          const w = whereSql(where);
          const row = await db.prepare(`SELECT count(*) AS n FROM ${table(model)}${w.sql}`).bind(...w.values).first<{ n: number }>();
          return row?.n ?? 0;
        },
        async update({ model, where, update }) {
          const data = update as Row;
          const keys = Object.keys(data).filter((key) => data[key] !== undefined);
          const w = whereSql(where);
          if (!keys.length) return (await db.prepare(`SELECT * FROM ${table(model)}${w.sql} LIMIT 1`).bind(...w.values).first<Row>()) as never;
          // One row, as Better Auth asks: the first match by rowid.
          const sql = `UPDATE ${table(model)} SET ${keys.map((key) => `${col(key)} = ?`).join(', ')} WHERE rowid = (SELECT rowid FROM ${table(model)}${w.sql} LIMIT 1) RETURNING *`;
          return (await db.prepare(sql).bind(...keys.map((key) => data[key]), ...w.values).first<Row>()) as never;
        },
        async updateMany({ model, where, update }) {
          const keys = Object.keys(update).filter((key) => update[key] !== undefined);
          if (!keys.length) return 0;
          const w = whereSql(where);
          const result = await db.prepare(`UPDATE ${table(model)} SET ${keys.map((key) => `${col(key)} = ?`).join(', ')}${w.sql}`).bind(...keys.map((key) => update[key]), ...w.values).run();
          return result.meta.changes;
        },
        async delete({ model, where }) {
          const w = whereSql(where);
          await db.prepare(`DELETE FROM ${table(model)} WHERE rowid = (SELECT rowid FROM ${table(model)}${w.sql} LIMIT 1)`).bind(...w.values).run();
        },
        async deleteMany({ model, where }) {
          const w = whereSql(where);
          return (await db.prepare(`DELETE FROM ${table(model)}${w.sql}`).bind(...w.values).run()).meta.changes;
        },
        // Single-use tokens: delete one row and return it, in one statement.
        async consumeOne({ model, where }) {
          const w = whereSql(where);
          return (await db.prepare(`DELETE FROM ${table(model)} WHERE rowid = (SELECT rowid FROM ${table(model)}${w.sql} LIMIT 1) RETURNING *`).bind(...w.values).first<Row>()) as never;
        },
        async incrementOne({ model, where, increment, set }) {
          const w = whereSql(where);
          const assignments = [
            ...Object.keys(increment).map((key) => `${col(key)} = ${col(key)} + ?`),
            ...Object.keys(set ?? {}).map((key) => `${col(key)} = ?`),
          ];
          const values = [...Object.values(increment), ...Object.values(set ?? {}).map((v) => (v instanceof Date ? storedTimestamp(v.toISOString()) : v))];
          return (await db.prepare(`UPDATE ${table(model)} SET ${assignments.join(', ')} WHERE rowid = (SELECT rowid FROM ${table(model)}${w.sql} LIMIT 1) RETURNING *`).bind(...values, ...w.values).first<Row>()) as never;
        },
      };
    },
  });
}
