/**
 * What Supabase did after a write, outside the triggers of 0009 (see
 * scripts/gen-triggers.ts): rebuild the catalog search index when the catalog
 * changed (private.refresh_unified_search_index), and wake the media
 * processor when a job is queued (private.wake_media_processor, which pg_net
 * sent after the commit). The request path runs it after any request that
 * wrote; the cron runs it every minute, in case one was missed.
 */
import { col, t } from '../../../content-api/src/db/names.ts';
import type { D1Database, D1PreparedStatement, Env } from '../types.ts';
import { rebuildSearchIndex } from './searchIndex.ts';

const WRITE = /^\s*(?:WITH\b[\s\S]*?\)\s*)?(?:INSERT|UPDATE|DELETE|REPLACE)\b/i;
const inner = new WeakMap<object, D1PreparedStatement>();

/** The binding, calling onWrite whenever a statement that writes runs (alone or in a batch). */
export function trackWrites(db: D1Database, onWrite: () => void): D1Database {
  const wrap = (statement: D1PreparedStatement, writes: boolean): D1PreparedStatement => {
    const run = <T>(go: () => Promise<T>) => { if (writes) onWrite(); return go(); };
    const wrapper: D1PreparedStatement = {
      bind: (...values) => wrap(statement.bind(...values), writes),
      all: () => run(() => statement.all()),
      first: () => run(() => statement.first()),
      run: () => run(() => statement.run()),
    } as D1PreparedStatement;
    inner.set(wrapper, statement);
    return wrapper;
  };
  return {
    prepare: (sql) => wrap(db.prepare(sql), WRITE.test(sql)),
    batch: (statements) => {
      onWrite();
      return db.batch(statements.map((statement) => inner.get(statement) ?? statement));
    },
  };
}

/** POST {MEDIA_PROCESSOR_URL}/wake, as pg_net did; a lost wake-up costs at most the processor's next minute. */
async function wakeMediaProcessor(env: Env): Promise<void> {
  if (!env.MEDIA_PROCESSOR_URL) return;
  try {
    await fetch(`${env.MEDIA_PROCESSOR_URL}/wake`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(5000) });
  } catch (error) {
    console.warn(`Could not wake the media processor: ${(error as Error).message}`);
  }
}

export async function afterWrites(env: Env, waitUntil?: (promise: Promise<unknown>) => void): Promise<void> {
  const state = await env.DB.prepare(`SELECT s.${col('version')} AS version, s.${col('built_version')} AS built,
      EXISTS (SELECT 1 FROM ${t('private', 'outbox')} WHERE ${col('kind')} = 'wake_media_processor') AS wake
    FROM ${t('private', 'search_index_state')} s WHERE s.${col('id')} = 1`).first<{ version: number; built: number; wake: number }>();
  if (!state) return;
  if (state.version > state.built) await rebuildSearchIndex(env.DB);
  if (state.wake) {
    await env.DB.prepare(`DELETE FROM ${t('private', 'outbox')} WHERE ${col('kind')} = 'wake_media_processor'`).run();
    const wake = wakeMediaProcessor(env);
    if (waitUntil) waitUntil(wake);
    else await wake;
  }
}
