/**
 * Parts of a spiritual canon shared with friends (src/rpc/canonShares.ts,
 * migration 0045): made and stopped by its account alone, read by anyone with
 * the link, never showing the account behind it.
 */
import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { CANON_SHARE_LIMITS, CANON_SHARES_PER_ACCOUNT, type CanonShare } from '../src/rpc/canonShares.ts';
import { id } from './lib/creatorCatalog.ts';
import { migration } from './lib/d1.ts';
import { WorkerSide } from './lib/worker.ts';

const BELIEVER = id(21); const FRIEND = id(22); const BUSY = id(23);
let worker: WorkerSide;

before(async () => {
  worker = new WorkerSide();
  worker.db.exec(migration('0045_spiritual_canon_shares.sql'));
  worker.db.exec(migration('0045_spiritual_canon_shares.sql'));
  await worker.addUser(BELIEVER, 'believer@example.com', 'Mina');
  await worker.addUser(FRIEND, 'friend@example.com', 'Marina');
  await worker.addUser(BUSY, 'busy@example.com', 'Bishoy');
});

const call = async (user: string | null, name: string, args: Record<string, unknown> = {}) => worker.rpc(user, name, args);
const ok = <T>(answer: { data: unknown; error: unknown }) => {
  assert.equal(answer.error, null, JSON.stringify(answer.error));
  return answer.data as T;
};

const BIBLE = { id: 'canon-1', kind: 'bible', goal: { kind: 'chapters', count: 1 }, frequency: { kind: 'daily' }, time: null, remind: false };
const METANIAS = { id: 'canon-2', kind: 'metania', goal: { kind: 'metanias', count: 50 }, frequency: { kind: 'applicable' }, time: null, remind: false };

test('a signed-in account makes a link; anyone with it reads what it holds, and not who made it', async () => {
  const made = ok<CanonShare>(await call(BELIEVER, 'create_canon_share', { p_items: [BIBLE, METANIAS], p_name: ' Mina ', p_message: 'For our Friday group' }));
  assert.ok(made.id.length >= 22, made.id);
  assert.equal(made.sharerName, 'Mina');
  assert.equal(made.instructions, null, 'the instructions only when chosen');
  for (const reader of [null, FRIEND]) {
    const read = ok<CanonShare>(await call(reader, 'get_canon_share', { p_id: made.id }));
    assert.deepEqual(read.items, [BIBLE, METANIAS]);
    assert.equal(read.message, 'For our Friday group');
    assert.ok(!JSON.stringify(read).includes(BELIEVER) && !JSON.stringify(read).includes('believer@'), 'never the account');
  }
  assert.ok((await call(null, 'create_canon_share', { p_items: [BIBLE] })).error, 'signed out, none is made');
  assert.ok((await call(null, 'list_my_canon_shares')).error);
});

test('each account sees and stops only its own; a stopped link opens nothing', async () => {
  const made = ok<CanonShare>(await call(BELIEVER, 'create_canon_share', { p_items: [BIBLE], p_instructions: 'Ask before you change it.' }));
  assert.equal(made.instructions, 'Ask before you change it.');
  assert.ok(ok<CanonShare[]>(await call(BELIEVER, 'list_my_canon_shares')).some((one) => one.id === made.id));
  assert.deepEqual(ok<CanonShare[]>(await call(FRIEND, 'list_my_canon_shares')), []);
  assert.ok((await call(FRIEND, 'delete_my_canon_share', { p_id: made.id })).error, 'not another account');
  ok(await call(BELIEVER, 'delete_my_canon_share', { p_id: made.id }));
  assert.ok((await call(FRIEND, 'get_canon_share', { p_id: made.id })).error);
  assert.ok((await call(null, 'get_canon_share', { p_id: 'short' })).error);
});

test('nothing, too much, or too many links are refused', async () => {
  assert.ok((await call(BELIEVER, 'create_canon_share', { p_items: [] })).error);
  assert.ok((await call(BELIEVER, 'create_canon_share', { p_items: ['x'] })).error);
  assert.ok((await call(BELIEVER, 'create_canon_share', { p_items: Array.from({ length: CANON_SHARE_LIMITS.items + 1 }, () => BIBLE) })).error);
  assert.ok((await call(BELIEVER, 'create_canon_share', { p_items: [BIBLE], p_message: 'x'.repeat(CANON_SHARE_LIMITS.message + 1) })).error);
  for (let index = 0; index < CANON_SHARES_PER_ACCOUNT; index += 1) ok(await call(BUSY, 'create_canon_share', { p_items: [BIBLE] }));
  assert.ok((await call(BUSY, 'create_canon_share', { p_items: [BIBLE] })).error);
});
