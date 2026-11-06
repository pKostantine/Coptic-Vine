/**
 * Support people for a spiritual canon (src/rpc/canonSupport.ts, migration
 * 0046): an invite link anyone may accept until it is turned off; those who
 * accept see the believer's canon and its ticks, the instructions only when
 * the link included them, and neither side ever sees the other's account id.
 */
import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import {
  CANON_INVITES_PER_ACCOUNT,
  CANON_SUPPORT_DAYS,
  type CanonSupportInvite,
  type CanonSupportInviteView,
  type CanonSupportPerson,
  type SupportedCanon,
} from '../src/rpc/canonSupport.ts';
import { id } from './lib/creatorCatalog.ts';
import { migration } from './lib/d1.ts';
import { WorkerSide } from './lib/worker.ts';

const BELIEVER = id(31); const FRIEND = id(32); const GROUP = id(33); const STRANGER = id(34); const BUSY = id(35);
let worker: WorkerSide;

const BIBLE = { id: 'canon-1', kind: 'bible', goal: { kind: 'chapters', count: 1 }, frequency: { kind: 'daily' }, time: null, remind: true };
const METANIAS = { id: 'canon-2', kind: 'metania', goal: { kind: 'metanias', count: 50 }, frequency: { kind: 'applicable' }, time: null, remind: false };
const MARKS = { 'canon-1': { done: true, at: '2026-11-05T08:00:00.000Z' } };

before(async () => {
  worker = new WorkerSide();
  worker.db.exec(migration('0044_spiritual_canon_notes.sql'));
  worker.db.exec(migration('0046_canon_support.sql'));
  worker.db.exec(migration('0046_canon_support.sql'));
  await worker.addUser(BELIEVER, 'believer@example.com', 'Mina Account');
  await worker.addUser(FRIEND, 'friend@example.com', 'Marina');
  await worker.addUser(GROUP, 'group@example.com', 'Bishoy');
  await worker.addUser(STRANGER, 'stranger@example.com', 'Stranger');
  await worker.addUser(BUSY, 'busy@example.com', 'Busy');
  worker.db.prepare('INSERT INTO "public.spiritual_canons" ("user_id", "items") VALUES (?, ?)').run(BELIEVER, JSON.stringify([BIBLE, METANIAS]));
  for (const [day, marks] of [['2026-11-05', MARKS], ['2026-10-01', MARKS]] as const) {
    worker.db.prepare('INSERT INTO "public.spiritual_canon_days" ("user_id", "day", "marks") VALUES (?, ?, ?)').run(BELIEVER, day, JSON.stringify(marks));
  }
  worker.db.prepare('INSERT INTO "public.spiritual_canon_notes" ("user_id", "instructions", "updated_at") VALUES (?, ?, ?)').run(BELIEVER, 'Fifty metanias, no more.', '2026-11-01T00:00:00+00:00');
});

const call = async (user: string | null, name: string, args: Record<string, unknown> = {}) => worker.rpc(user, name, args);
const ok = <T>(answer: { data: unknown; error: unknown }) => {
  assert.equal(answer.error, null, JSON.stringify(answer.error));
  return answer.data as T;
};
const refused = (answer: { error: unknown }, why: string) => assert.ok(answer.error, why);
const WEEK = { p_from_day: '2026-11-02', p_to_day: '2026-11-08' };

test('one link: anyone may open it, signed out too, and read only what it says', async () => {
  const link = ok<CanonSupportInvite>(await call(BELIEVER, 'create_canon_support_invite', { p_name: ' Mina ', p_message: 'For our Friday group' }));
  assert.ok(link.id.length >= 22, link.id);
  assert.equal(link.sharerName, 'Mina');
  assert.equal(link.withInstructions, false, 'the instructions only when chosen');
  for (const reader of [null, FRIEND]) {
    const view = ok<CanonSupportInviteView>(await call(reader, 'get_canon_support_invite', { p_id: link.id }));
    assert.equal(view.sharerName, 'Mina');
    assert.equal(view.message, 'For our Friday group');
    assert.equal(view.own, false);
    assert.equal(view.supporting, null);
    const said = JSON.stringify(view);
    assert.ok(!said.includes(BELIEVER) && !said.includes('believer@') && !said.includes('canon-1'), 'never the account, nor the canon');
  }
  assert.equal(ok<CanonSupportInviteView>(await call(BELIEVER, 'get_canon_support_invite', { p_id: link.id })).own, true);
  refused(await call(null, 'create_canon_support_invite', {}), 'signed out, no link is made');
  refused(await call(null, 'accept_canon_support_invite', { p_id: link.id }), 'signed out, no one becomes a support person');
  refused(await call(BELIEVER, 'accept_canon_support_invite', { p_id: link.id }), 'not one’s own link');
});

test('everyone who accepts sees the canon and its ticks, by name; others see nothing', async () => {
  const link = ok<CanonSupportInvite>(await call(BELIEVER, 'create_canon_support_invite', { p_name: 'Mina' }));
  const friend = ok<CanonSupportPerson>(await call(FRIEND, 'accept_canon_support_invite', { p_id: link.id }));
  const group = ok<CanonSupportPerson>(await call(GROUP, 'accept_canon_support_invite', { p_id: link.id }));
  assert.equal(friend.name, 'Mina');
  assert.notEqual(friend.id, group.id);
  assert.equal(ok<CanonSupportPerson>(await call(FRIEND, 'accept_canon_support_invite', { p_id: link.id })).id, friend.id, 'accepting again changes nothing');
  assert.equal(ok<CanonSupportInviteView>(await call(FRIEND, 'get_canon_support_invite', { p_id: link.id })).supporting, friend.id);

  const seen = ok<SupportedCanon>(await call(FRIEND, 'get_supported_canon', { p_id: friend.id, ...WEEK }));
  assert.equal(seen.name, 'Mina');
  assert.deepEqual(seen.items, [BIBLE, METANIAS]);
  assert.deepEqual(seen.days, { '2026-11-05': MARKS }, 'only the days asked for');
  assert.equal(seen.instructions, null, 'this link left the instructions out');
  assert.ok(!JSON.stringify(seen).includes(BELIEVER));

  refused(await call(STRANGER, 'get_supported_canon', { p_id: friend.id, ...WEEK }), 'not someone else’s view');
  refused(await call(BELIEVER, 'get_supported_canon', { p_id: friend.id, ...WEEK }), 'the believer reads their own canon as their own');
  refused(await call(FRIEND, 'get_supported_canon', { p_id: friend.id, p_from_day: '2026-01-01', p_to_day: '2026-11-08' }), `at most ${CANON_SUPPORT_DAYS} days`);
  refused(await call(FRIEND, 'get_supported_canon', { p_id: friend.id, p_from_day: 'yesterday', p_to_day: '2026-11-08' }), 'days as days');

  const theirs = ok<CanonSupportPerson[]>(await call(BELIEVER, 'list_my_canon_supporters'));
  assert.deepEqual(theirs.map((one) => one.name), ['Marina', 'Bishoy'], 'the believer sees who, by their names');
  assert.ok(!JSON.stringify(theirs).includes(FRIEND));
  assert.deepEqual(ok<CanonSupportPerson[]>(await call(FRIEND, 'list_canons_i_support')).map((one) => one.id), [friend.id]);
  assert.deepEqual(ok<CanonSupportPerson[]>(await call(STRANGER, 'list_canons_i_support')), []);
});

test('the instructions go to those whose link included them, and a nameless link shows the account’s name', async () => {
  const link = ok<CanonSupportInvite>(await call(BELIEVER, 'create_canon_support_invite', { p_with_instructions: true }));
  const supporter = ok<CanonSupportPerson>(await call(STRANGER, 'accept_canon_support_invite', { p_id: link.id }));
  assert.equal(supporter.name, 'Mina Account');
  const seen = ok<SupportedCanon>(await call(STRANGER, 'get_supported_canon', { p_id: supporter.id, ...WEEK }));
  assert.equal(seen.instructions, 'Fifty metanias, no more.');
  ok(await call(STRANGER, 'stop_supporting_canon', { p_id: supporter.id }));
  refused(await call(STRANGER, 'get_supported_canon', { p_id: supporter.id, ...WEEK }), 'stopped, nothing more is seen');
});

test('turning a link off stops new support people and keeps those who accepted; each can be removed', async () => {
  const link = ok<CanonSupportInvite>(await call(BELIEVER, 'create_canon_support_invite', {}));
  const kept = ok<CanonSupportPerson>(await call(BUSY, 'accept_canon_support_invite', { p_id: link.id }));
  refused(await call(FRIEND, 'delete_my_canon_support_invite', { p_id: link.id }), 'not another account’s link');
  ok(await call(BELIEVER, 'delete_my_canon_support_invite', { p_id: link.id }));
  refused(await call(null, 'get_canon_support_invite', { p_id: link.id }), 'a link turned off opens nothing');
  refused(await call(STRANGER, 'accept_canon_support_invite', { p_id: link.id }), 'and no one else can accept it');
  ok(await call(BUSY, 'get_supported_canon', { p_id: kept.id, ...WEEK }));

  const mine = ok<CanonSupportPerson[]>(await call(BELIEVER, 'list_my_canon_supporters'));
  const busy = mine.find((one) => one.name === 'Busy')!;
  refused(await call(FRIEND, 'remove_my_canon_supporter', { p_id: busy.id }), 'only the believer removes their support people');
  ok(await call(BELIEVER, 'remove_my_canon_supporter', { p_id: busy.id }));
  refused(await call(BUSY, 'get_supported_canon', { p_id: kept.id, ...WEEK }), 'removed, nothing more is seen');
});

test('too long, or too many links, are refused', async () => {
  refused(await call(BUSY, 'create_canon_support_invite', { p_message: 'x'.repeat(1001) }), 'the message’s length');
  refused(await call(BUSY, 'get_canon_support_invite', { p_id: 'short' }), 'no such link');
  for (let index = 0; index < CANON_INVITES_PER_ACCOUNT; index += 1) ok(await call(BUSY, 'create_canon_support_invite', {}));
  refused(await call(BUSY, 'create_canon_support_invite', {}), 'the links an account may keep');
  assert.equal(ok<CanonSupportInvite[]>(await call(BUSY, 'list_my_canon_support_invites')).length, CANON_INVITES_PER_ACCOUNT);
});
