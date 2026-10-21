/** A D1 binding over node:sqlite, with the real migrations, for running the Worker in tests. */
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import type { D1Database, D1PreparedStatement, D1Result } from '../../src/types.ts';

export function migration(name: string): string {
  return readFileSync(new URL(`../../../content-api/migrations/${name}`, import.meta.url), 'utf8');
}

export function d1(db: DatabaseSync): D1Database {
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
    return {
      bind: (...next: unknown[]) => statement(sql, next),
      all: async <T>() => { const r = run(); return { results: r.results as T[], success: true, meta: { changes: r.changes.n } } as D1Result<T>; },
      first: async <T>() => (run().results[0] ?? null) as T | null,
      run: async () => { const r = run(); return { results: [], success: true, meta: { changes: r.changes.n } }; },
    };
  };
  return {
    prepare: (sql: string) => statement(sql),
    batch: async (statements) => Promise.all(statements.map((s) => s.all())) as never,
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
