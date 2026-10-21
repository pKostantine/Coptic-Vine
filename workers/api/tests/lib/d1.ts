/** A D1 binding over node:sqlite, with the real migrations, for running the Worker in tests. */
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import type { D1Database, D1PreparedStatement, D1Result } from '../../src/types.ts';

export function migration(name: string): string {
  return readFileSync(new URL(`../../../content-api/migrations/${name}`, import.meta.url), 'utf8');
}

/**
 * What runs before each call reaches the database: before(sql) is awaited
 * ahead of every statement, and once ahead of a batch (its statements' SQL
 * joined). A test makes calls interleave with it as D1's network round trips
 * let them, or does another request's write at a chosen point.
 */
export type D1Hooks = { before?: (sql: string) => void | Promise<void> };

export function d1(db: DatabaseSync, hooks: D1Hooks = {}): D1Database {
  const pending = new WeakMap<D1PreparedStatement, { sql: string; all: () => D1Result }>();
  const statement = (sql: string, values: unknown[] = []): D1PreparedStatement => {
    const run = () => {
      const prepared = db.prepare(sql);
      const params = values.map((value) => (typeof value === 'boolean' ? (value ? 1 : 0) : value)) as never[];
      if (prepared.columns().length) {
        const results = prepared.all(...params).map((row) => ({ ...(row as object) }));
        return { results, changes: db.prepare('SELECT changes() AS n').get() as { n: number } };
      }
      const info = prepared.run(...params);
      return { results: [], changes: { n: Number(info.changes) } };
    };
    const all = () => { const r = run(); return { results: r.results, success: true, meta: { changes: r.changes.n } } as D1Result; };
    const made: D1PreparedStatement = {
      bind: (...next: unknown[]) => statement(sql, next),
      all: async <T>() => { await hooks.before?.(sql); return all() as D1Result<T>; },
      first: async <T>() => { await hooks.before?.(sql); return (run().results[0] ?? null) as T | null; },
      run: async () => { await hooks.before?.(sql); const r = run(); return { results: [], success: true, meta: { changes: r.changes.n } }; },
    };
    pending.set(made, { sql, all });
    return made;
  };
  return {
    prepare: (sql: string) => statement(sql),
    // Atomic, as D1's: one transaction, rolled back whole when a statement fails.
    batch: async (statements) => {
      const each = statements.map((s) => pending.get(s)!);
      await hooks.before?.(each.map((s) => s.sql).join(';\n'));
      db.exec('BEGIN');
      try {
        const results = each.map((s) => s.all());
        db.exec('COMMIT');
        return results as never;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

/** A fresh database with the sign-in tables (0006 and 0008). */
export function authDatabase(): { db: DatabaseSync; binding: D1Database } {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(migration('0006_auth.sql'));
  db.exec(migration('0008_auth_rate_limits.sql'));
  return { db, binding: d1(db) };
}
