/**
 * src/db/transaction.ts: a transaction's writes stay together or not at all.
 * Rolled back, the database is as it was, row for row (rowids included):
 * what the transaction inserted, updated and deleted, and what 0009's
 * triggers and the foreign keys' cascades wrote on its behalf.
 */
import assert from 'node:assert/strict';
import { before, mock, test } from 'node:test';
import { recoverTransactions, rollBackLabelled, rollback, transaction, Tx } from '../src/db/transaction.ts';
import type { ApiContext } from '../src/rest/context.ts';
import { ALICE, A2, BOB, C1, id, R1, R2, R5, S1, seedCatalog, T1, T4 } from './lib/creatorCatalog.ts';
import { createOracle } from './lib/oracle.ts';
import { WorkerSide } from './lib/worker.ts';

let worker: WorkerSide;
let ctx: ApiContext;

before(async () => {
  const oracle = await createOracle();
  worker = new WorkerSide();
  await seedCatalog(oracle, worker);
  await oracle.close();
  worker.db.exec(`INSERT INTO "music.artist_follows" ("user_id", "artist_id", "created_at") VALUES ('${BOB}', '${id(20)}', '2026-03-01T08:00:00+00:00')`);
  ctx = { db: worker.env.DB, env: worker.env, userId: ALICE };
});

/**
 * Every table, every row, in rowid order. Not the bookkeeping, which a
 * rollback leaves as it is: the undo log, the catalog's change count (an extra
 * count only rebuilds the index again) and the notifications watermark.
 */
const BOOKKEEPING = ['private.undo_log', 'private.transaction', 'private.search_index_state', 'private.trigger_marks', 'private.outbox', 'private.replica_mode'];
function snapshot(): Map<string, string[]> {
  const tables = (worker.db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name GLOB '*.*' ORDER BY name`).all() as { name: string }[])
    .map((r) => r.name).filter((name) => !BOOKKEEPING.includes(name));
  return new Map(tables.map((name) => [name, (worker.db.prepare(`SELECT rowid AS _rowid, * FROM "${name}" ORDER BY rowid`).all()).map((row) => JSON.stringify(row))]));
}

/** The tables that differ, with the rows only one side has. */
function differences(a: Map<string, string[]>, b: Map<string, string[]>): string[] {
  const out: string[] = [];
  for (const name of new Set([...a.keys(), ...b.keys()])) {
    const x = new Set(a.get(name) ?? []);
    const y = new Set(b.get(name) ?? []);
    for (const row of x) if (!y.has(row)) out.push(`${name} now:    ${row.slice(0, 300)}`);
    for (const row of y) if (!x.has(row)) out.push(`${name} before: ${row.slice(0, 300)}`);
  }
  return out;
}

async function writes(tx: Tx): Promise<void> {
  // A release published: its artists, tracks and lyrics too, and the follower notified (0009's triggers).
  await tx.run(`UPDATE "music.releases" SET "publication_status" = 'published', "updated_by" = ? WHERE "id" = ?`, ALICE, R5);
  // A release deleted with its children (the foreign keys' cascades), then its orphaned track with its own.
  await tx.run(`DELETE FROM "music.releases" WHERE "id" = ?`, R2);
  await tx.run(`DELETE FROM "music.tracks" WHERE "id" = ?`, T4);
  // Rows added, and one changed twice.
  await tx.run(`INSERT INTO "music.artists" ("id", "display_name") VALUES (?, 'New Artist')`, id(600));
  await tx.run(`UPDATE "music.artists" SET "display_name" = 'Renamed' WHERE "id" = ?`, A2);
  await tx.run(`UPDATE "music.artists" SET "display_name" = 'Renamed again', "biography" = 'x' WHERE "id" = ?`, A2);
  await tx.batch([
    worker.env.DB.prepare(`DELETE FROM "media.submissions" WHERE "id" = ?`).bind(S1),
    worker.env.DB.prepare(`UPDATE "creator.creator_accounts" SET "display_name" = 'Changed' WHERE "id" = ?`).bind(C1),
  ]);
}

test('a failed transaction leaves nothing behind', async () => {
  const before = snapshot();
  await assert.rejects(transaction(ctx, async (tx) => {
    await writes(tx);
    assert.notDeepEqual(differences(snapshot(), before), [], 'the writes landed');
    throw new Error('then it failed');
  }), /then it failed/);
  assert.deepEqual(differences(snapshot(), before), []);
  assert.equal((worker.db.prepare('SELECT count(*) AS n FROM "private.undo_log"').get() as { n: number }).n, 0);
});

test('a statement that fails rolls back the ones before it', async () => {
  const before = snapshot();
  await assert.rejects(transaction(ctx, async (tx) => {
    await tx.run(`UPDATE "music.artists" SET "display_name" = 'Renamed' WHERE "id" = ?`, A2);
    await tx.run(`INSERT INTO "music.artists" ("id", "display_name") VALUES (?, NULL)`, id(601));
  }), /NOT NULL/);
  assert.deepEqual(differences(snapshot(), before), []);
});

test('a committed transaction keeps its writes and drops its log; writes outside one are not logged', async () => {
  await transaction(ctx, async (tx) => writes(tx));
  assert.equal((worker.db.prepare(`SELECT "publication_status" AS s FROM "music.releases" WHERE "id" = '${R5}'`).get() as { s: string }).s, 'published');
  assert.ok((worker.db.prepare('SELECT count(*) AS n FROM "public.notifications"').get() as { n: number }).n > 0, 'the follower was notified');
  assert.equal((worker.db.prepare(`SELECT count(*) AS n FROM "music.tracks" WHERE "id" = '${T4}'`).get() as { n: number }).n, 0);
  worker.db.exec(`UPDATE "music.releases" SET "title" = 'Outside' WHERE "id" = '${R1}'`);
  assert.equal((worker.db.prepare('SELECT count(*) AS n FROM "private.undo_log"').get() as { n: number }).n, 0);
});

test('a transaction its Worker never finished is rolled back by the cron', async () => {
  const before = snapshot();
  const tx = new Tx(worker.env.DB, 'abandoned');
  await tx.run(`UPDATE "music.tracks" SET "title" = 'Half done' WHERE "id" = ?`, T1);
  assert.equal(await recoverTransactions(worker.env.DB), 0, 'not yet: it may still be running');
  assert.equal(await recoverTransactions(worker.env.DB, Date.now() + 6 * 60_000), 1);
  assert.deepEqual(differences(snapshot(), before), []);
  await rollback(worker.env.DB, 'nothing'); // a transaction with no log is a no-op
});

/** Bob's follow deleted in a transaction, then taken again outside it: that transaction can't be rolled back. */
async function unrollable(name: string): Promise<void> {
  const tx = new Tx(worker.env.DB, name);
  await tx.run(`DELETE FROM "music.artist_follows" WHERE "user_id" = ? AND "artist_id" = ?`, BOB, id(20));
  worker.db.exec(`INSERT INTO "music.artist_follows" ("user_id", "artist_id", "created_at") VALUES ('${BOB}', '${id(20)}', '2026-03-02T08:00:00+00:00')`);
}
const retaken = () => worker.db.exec(`DELETE FROM "music.artist_follows" WHERE "user_id" = '${BOB}' AND "created_at" = '2026-03-02T08:00:00+00:00'`);

test('one abandoned transaction that can\'t be rolled back is left for the next run, and the rest still are', async () => {
  const before = snapshot();
  await unrollable('stuck');
  const fine = new Tx(worker.env.DB, 'fine');
  await fine.run(`UPDATE "music.tracks" SET "title" = 'Half done' WHERE "id" = ?`, T1);
  const errors = mock.method(console, 'error', () => {});
  try {
    assert.equal(await recoverTransactions(worker.env.DB, Date.now() + 6 * 60_000), 1);
    assert.equal(errors.mock.callCount(), 1);
  } finally {
    errors.mock.restore();
  }
  assert.deepEqual(worker.db.prepare(`SELECT DISTINCT "txn" FROM "private.undo_log"`).all().map((row) => row.txn), ['stuck']);
  retaken();
  assert.equal(await recoverTransactions(worker.env.DB, Date.now() + 6 * 60_000), 1);
  assert.deepEqual(differences(snapshot(), before), []);
});

test('a label names a transaction; rolling back a label takes its logs at any age, and only its own', async () => {
  const before = snapshot();
  let name = '';
  await transaction(ctx, async (tx) => { name = tx.id; }, 'release');
  assert.match(name, /^release:[0-9a-f-]{36}$/);
  const mine = new Tx(worker.env.DB, 'release:1');
  await mine.run(`UPDATE "music.tracks" SET "title" = 'Mine' WHERE "id" = ?`, T1);
  const lookalike = new Tx(worker.env.DB, 'releases:1');
  await lookalike.run(`UPDATE "music.artists" SET "display_name" = 'Not mine' WHERE "id" = ?`, A2);
  assert.equal(await rollBackLabelled(worker.env.DB, 'release'), 1);
  assert.deepEqual(worker.db.prepare(`SELECT DISTINCT "txn" FROM "private.undo_log"`).all().map((row) => row.txn), ['releases:1']);
  await rollback(worker.env.DB, 'releases:1');
  assert.deepEqual(differences(snapshot(), before), []);
  await unrollable('release:2');
  await assert.rejects(rollBackLabelled(worker.env.DB, 'release'));
  retaken();
  assert.equal(await rollBackLabelled(worker.env.DB, 'release'), 1);
  assert.deepEqual(differences(snapshot(), before), []);
});
