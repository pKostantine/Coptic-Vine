/**
 * Transactions over D1, for the functions that write, read what they wrote,
 * and may still fail: a Supabase function runs in one transaction, and D1
 * has none across statements (only a batch is atomic).
 *
 * Each write in a transaction is sent as a batch that names the transaction
 * in "private.transaction" around the statement, so 0010's triggers record
 * its inverse in "private.undo_log", including what 0009's triggers and
 * foreign-key cascades write on its behalf. D1 runs a batch alone, so no other
 * request's write is logged under this name. On success the log is dropped;
 * on failure it is played backwards with the triggers off, in one batch.
 *
 * Unlike Postgres, a transaction's writes are visible to other requests
 * before it ends. A Worker that dies mid-transaction leaves its log behind:
 * recoverTransactions (run by the cron) rolls back any older than five minutes.
 * A job that knows none of its own transactions is running (src/jobs/releases.ts)
 * labels them, and rolls back what its earlier runs left before writing again.
 */
import { col, t } from '../../../content-api/src/db/names.ts';
import { now } from '../pg.ts';
import type { ApiContext } from '../rest/context.ts';
import type { D1Database, D1PreparedStatement, D1Result } from '../types.ts';

type Row = Record<string, unknown>;
const TRANSACTION = t('private', 'transaction');
const LOG = t('private', 'undo_log');
const ABANDONED_AFTER_MS = 5 * 60_000;

export class Tx {
  readonly db: D1Database;
  readonly id: string;
  /** now() for the whole transaction, as Postgres's is the transaction's start. */
  readonly at: string;

  constructor(db: D1Database, id: string) {
    this.db = db;
    this.id = id;
    this.at = now();
  }

  private name = () => this.db.prepare(`UPDATE ${TRANSACTION} SET ${col('current')} = ? WHERE ${col('id')} = 1`).bind(this.id);
  private unname = () => this.db.prepare(`UPDATE ${TRANSACTION} SET ${col('current')} = NULL WHERE ${col('id')} = 1`);

  /** Writes, recorded so they can be undone. */
  async batch<T = Row>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    if (!statements.length) return [];
    const results = await this.db.batch<T>([this.name(), ...statements, this.unname()]);
    return results.slice(1, -1);
  }

  /** One write; its rows, for INSERT … RETURNING. */
  async run<T = Row>(sql: string, ...params: unknown[]): Promise<D1Result<T>> {
    return (await this.batch<T>([this.db.prepare(sql).bind(...params)]))[0];
  }

  async writeFirst<T = Row>(sql: string, ...params: unknown[]): Promise<T | null> {
    return (await this.run<T>(sql, ...params)).results[0] ?? null;
  }

  /** Reads (they see the transaction's own writes, and anyone else's). */
  async all<T = Row>(sql: string, ...params: unknown[]): Promise<T[]> {
    return (await this.db.prepare(sql).bind(...params).all<T>()).results;
  }

  async first<T = Row>(sql: string, ...params: unknown[]): Promise<T | null> {
    return this.db.prepare(sql).bind(...params).first<T>();
  }
}

/** Runs work in a transaction: all its writes stay, or none. A label starts its name ("<label>:<uuid>"). */
export async function transaction<T>(ctx: ApiContext, work: (tx: Tx) => Promise<T>, label?: string): Promise<T> {
  const tx = new Tx(ctx.db, label ? `${label}:${crypto.randomUUID()}` : crypto.randomUUID());
  let result: T;
  try {
    result = await work(tx);
  } catch (error) {
    await rollback(ctx.db, tx.id);
    throw error;
  }
  await ctx.db.prepare(`DELETE FROM ${LOG} WHERE ${col('txn')} = ?`).bind(tx.id).run();
  return result;
}

/** Plays a transaction's log backwards, with the triggers off, and drops it. */
export async function rollback(db: D1Database, txn: string): Promise<void> {
  const entries = await db.prepare(`SELECT * FROM ${LOG} WHERE ${col('txn')} = ? ORDER BY ${col('seq')} DESC`).bind(txn).all<Row>();
  const undo: D1PreparedStatement[] = [];
  for (const entry of entries.results) {
    const [schema, table] = (entry.table_name as string).split('.');
    const name = t(schema, table);
    if (entry.op === 'insert') {
      undo.push(db.prepare(`DELETE FROM ${name} WHERE rowid = ?`).bind(entry.row));
      continue;
    }
    const old = JSON.parse(entry.old as string) as Row;
    const columns = Object.keys(old);
    undo.push(entry.op === 'update'
      ? db.prepare(`UPDATE ${name} SET ${columns.map((c) => `${col(c)} = ?`).join(', ')} WHERE rowid = ?`).bind(...columns.map((c) => old[c]), entry.row)
      : db.prepare(`INSERT INTO ${name} (rowid, ${columns.map(col).join(', ')}) VALUES (?, ${columns.map(() => '?').join(', ')})`).bind(entry.row, ...columns.map((c) => old[c])));
  }
  const depth = (by: number) => db.prepare(`UPDATE ${t('private', 'replica_mode')} SET ${col('depth')} = ${col('depth')} + ? WHERE ${col('id')} = 1`).bind(by);
  await db.batch([
    db.prepare('PRAGMA defer_foreign_keys = true'),
    depth(1),
    ...undo,
    db.prepare(`DELETE FROM ${LOG} WHERE ${col('txn')} = ?`).bind(txn),
    depth(-1),
  ]);
}

/**
 * Rolls back transactions whose Worker never finished them. One that can't be
 * rolled back (a row it deleted has had its key taken since) is logged and
 * tried again on the next run, without holding up the rest.
 */
export async function recoverTransactions(db: D1Database, now = Date.now()): Promise<number> {
  const cutoff = new Date(now - ABANDONED_AFTER_MS).toISOString().replace('Z', '+00:00');
  const abandoned = await db.prepare(`SELECT ${col('txn')} AS txn FROM ${LOG} GROUP BY ${col('txn')} HAVING max(${col('at')}) < ?`).bind(cutoff).all<{ txn: string }>();
  let recovered = 0;
  for (const { txn } of abandoned.results) {
    try {
      await rollback(db, txn);
      recovered += 1;
    } catch (error) {
      console.error(`Rolling back abandoned transaction ${txn}:`, error);
    }
  }
  return recovered;
}

/** Rolls back every transaction under a label, whatever its age; throws if one can't be. */
export async function rollBackLabelled(db: D1Database, label: string): Promise<number> {
  const prefix = `${label}:`;
  const left = await db.prepare(`SELECT DISTINCT ${col('txn')} AS txn FROM ${LOG} WHERE substr(${col('txn')}, 1, ?) = ?`).bind(prefix.length, prefix).all<{ txn: string }>();
  for (const { txn } of left.results) await rollback(db, txn);
  return left.results.length;
}
