/**
 * Postgres's now() is the transaction's start, so every row one function
 * writes carries the same time. Inside a transaction (src/db/transaction.ts),
 * 0009's triggers stamp its time: a now() default left out of an INSERT, an
 * updated_at an UPDATE didn't set, and what the triggers write themselves.
 * Outside one, the clock, as before.
 */
import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { transaction } from '../src/db/transaction.ts';
import type { ApiContext } from '../src/rest/context.ts';
import { WorkerSide } from './lib/worker.ts';

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ADMIN = uid(1);
const OLD = '2026-01-01T00:00:00+00:00';
const later = () => new Promise((resolve) => setTimeout(resolve, 20));

let worker: WorkerSide;
let ctx: ApiContext;
const row = (sql: string, ...params: unknown[]) => ({ ...(worker.db.prepare(sql).get(...(params as never[])) as object) }) as Record<string, unknown>;

before(async () => {
  worker = new WorkerSide();
  await worker.addUser(ADMIN, 'admin@time.test');
  worker.db.prepare(`INSERT INTO "creator.user_roles" ("user_id", "role") VALUES (?, 'admin')`).run(ADMIN);
  worker.db.prepare(`INSERT INTO "public.notification_devices" ("user_id", "app_key", "platform", "provider", "push_token") VALUES (?, 'chc_admin', 'ios', 'expo', 'token')`).run(ADMIN);
  ctx = { db: worker.env.DB, env: worker.env, userId: null };
});

test("a transaction's rows carry its time: defaults left out, updates that don't stamp, and what the triggers write", async () => {
  const at = await transaction(ctx, async (tx) => {
    // Well after the transaction began, so its time and the clock differ.
    await later();
    await tx.run(`INSERT INTO "music.artists" ("id", "display_name") VALUES (?, 'Defaulted')`, uid(10));
    await tx.run(`INSERT INTO "music.artists" ("id", "display_name", "created_at") VALUES (?, 'Copied', ?)`, uid(11), OLD);
    await tx.run(`UPDATE "music.artists" SET "display_name" = 'Renamed' WHERE "id" = ?`, uid(11));
    // A job that fails tells the admins (0009's notify_processing_failure): a notification and a delivery.
    await tx.run(`INSERT INTO "media.media_processing_jobs" ("id", "job_type", "status", "input_bucket", "input_path", "output_bucket") VALUES (?, 'audio_delivery', 'failed', 'chc-submissions', 'x', 'chc-music')`, uid(12));
    return tx.at;
  });
  assert.deepEqual(row(`SELECT "created_at", "updated_at" FROM "music.artists" WHERE "id" = ?`, uid(10)), { created_at: at, updated_at: at });
  assert.deepEqual(row(`SELECT "created_at", "updated_at" FROM "music.artists" WHERE "id" = ?`, uid(11)), { created_at: OLD, updated_at: at }, 'a value written out is kept');
  assert.deepEqual(row(`SELECT "queued_at", "available_at", "created_at", "updated_at" FROM "media.media_processing_jobs" WHERE "id" = ?`, uid(12)),
    { queued_at: at, available_at: at, created_at: at, updated_at: at });
  const notification = row(`SELECT "id", "created_at" FROM "public.notifications" WHERE "user_id" = ? AND "event_type" = 'media_processing_failed'`, ADMIN);
  assert.equal(notification.created_at, at);
  assert.deepEqual(row(`SELECT "available_at", "created_at", "updated_at" FROM "private.notification_deliveries" WHERE "notification_id" = ?`, notification.id),
    { available_at: at, created_at: at, updated_at: at });
  assert.deepEqual(row(`SELECT "current", "at" FROM "private.transaction"`), { current: null, at: null }, 'named only while it writes');
});

test('outside a transaction, the clock', async () => {
  const before = await transaction(ctx, async (tx) => tx.at);
  await later();
  worker.db.prepare(`INSERT INTO "music.artists" ("id", "display_name") VALUES (?, 'Clock')`).run(uid(20));
  worker.db.prepare(`UPDATE "music.artists" SET "display_name" = 'Clock again' WHERE "id" = ?`).run(uid(10));
  const stamped = row(`SELECT "created_at" FROM "music.artists" WHERE "id" = ?`, uid(20)).created_at as string;
  assert.ok(stamped > before, `${stamped} is the clock, after ${before}`);
  assert.ok((row(`SELECT "updated_at" FROM "music.artists" WHERE "id" = ?`, uid(10)).updated_at as string) > before);
});
