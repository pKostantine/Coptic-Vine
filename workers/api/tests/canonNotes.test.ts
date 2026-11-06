/**
 * The spiritual canon's instructions (src/rpc/canonNotes.ts, migration 0044):
 * each account's own, read and saved by it alone, the later copy kept.
 */
import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { CANON_INSTRUCTIONS_LIMIT, type CanonInstructions } from '../src/rpc/canonNotes.ts';
import { id } from './lib/creatorCatalog.ts';
import { migration } from './lib/d1.ts';
import { WorkerSide } from './lib/worker.ts';

const BELIEVER = id(11); const OTHER = id(12);
let worker: WorkerSide;

before(async () => {
  worker = new WorkerSide();
  worker.db.exec(migration('0044_spiritual_canon_notes.sql'));
  // Run twice, as a migration applied by hand before wrangler applies it: nothing changes.
  worker.db.exec(migration('0044_spiritual_canon_notes.sql'));
  await worker.addUser(BELIEVER, 'believer@example.com', 'Mina');
  await worker.addUser(OTHER, 'other@example.com', 'Marina');
});

const get = async (user: string | null) => worker.rpc(user, 'get_my_canon_instructions');
const save = async (user: string | null, args: Record<string, unknown>) => worker.rpc(user, 'save_my_canon_instructions', args);
const ok = (answer: { data: unknown; error: unknown }) => {
  assert.equal(answer.error, null, JSON.stringify(answer.error));
  return answer.data as CanonInstructions;
};

test('an account with none has empty instructions; signed out, there are none to read or write', async () => {
  assert.deepEqual(ok(await get(BELIEVER)), { instructions: '', updatedAt: null });
  assert.ok((await get(null)).error);
  assert.ok((await save(null, { p_instructions: 'x' })).error);
});

test('each account keeps its own, and the later copy wins', async () => {
  const first = ok(await save(BELIEVER, { p_instructions: 'Pray the Jesus Prayer each morning.', p_written_at: '2026-11-01T08:00:00Z' }));
  assert.equal(first.instructions, 'Pray the Jesus Prayer each morning.');
  assert.equal(first.updatedAt, '2026-11-01T08:00:00+00:00');
  // An older copy, from a device that was offline, is not kept: the account's comes back.
  const stale = ok(await save(BELIEVER, { p_instructions: 'An older note', p_written_at: '2026-10-30T08:00:00Z' }));
  assert.equal(stale.instructions, 'Pray the Jesus Prayer each morning.');
  const later = ok(await save(BELIEVER, { p_instructions: 'Metanias on Wednesdays and Fridays.', p_written_at: '2026-11-02T08:00:00Z' }));
  assert.equal(later.instructions, 'Metanias on Wednesdays and Fridays.');
  assert.deepEqual(ok(await get(OTHER)), { instructions: '', updatedAt: null }, 'another account sees none of it');
  assert.equal(ok(await get(BELIEVER)).instructions, 'Metanias on Wednesdays and Fridays.');
});

test('a time still to come is taken as now; written with no time, now', async () => {
  const ahead = ok(await save(OTHER, { p_instructions: 'From a clock set ahead', p_written_at: '2099-01-01T00:00:00Z' }));
  assert.ok(ahead.updatedAt! < '2099', ahead.updatedAt!);
  const untimed = ok(await save(OTHER, { p_instructions: 'Read a chapter a day' }));
  assert.equal(untimed.instructions, 'Read a chapter a day');
});

test('instructions longer than the limit are refused', async () => {
  const answer = await save(BELIEVER, { p_instructions: 'x'.repeat(CANON_INSTRUCTIONS_LIMIT + 1) });
  assert.ok(answer.error);
  assert.equal(ok(await get(BELIEVER)).instructions, 'Metanias on Wednesdays and Fridays.');
});
