/**
 * The beta's feedback (src/rpc/feedback.ts, migration 0036): filed by anyone,
 * signed in or not, numbered as issues are, read by everyone with no email or
 * id shown, and given its status by an admin.
 */
import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { FEEDBACK_LIMITS, FEEDBACK_PER_HOUR, type FeedbackItem } from '../src/rpc/feedback.ts';
import { id } from './lib/creatorCatalog.ts';
import { migration } from './lib/d1.ts';
import { WorkerSide } from './lib/worker.ts';

const ADMIN = id(1); const TESTER = id(2); const OTHER = id(3);
const STAMP = '2026-10-01T00:00:00+00:00';
let worker: WorkerSide;

before(async () => {
  worker = new WorkerSide();
  worker.db.exec(migration('0036_beta_feedback.sql'));
  // Run twice, as a migration applied by hand before wrangler applies it: nothing changes.
  worker.db.exec(migration('0036_beta_feedback.sql'));
  await worker.addUser(ADMIN, 'admin@example.com', 'Abouna Admin');
  await worker.addUser(TESTER, 'tester@example.com', 'Mina Tester');
  await worker.addUser(OTHER, 'other@example.com', 'Marina Other');
  worker.db.prepare(`INSERT INTO "creator.user_roles" ("user_id", "role", "granted_at") VALUES (?, 'admin', ?)`).run(ADMIN, STAMP);
});

const submit = async (user: string | null, args: Record<string, unknown>) => {
  const answer = await worker.rpc(user, 'submit_beta_feedback', args);
  assert.equal(answer.error, null, JSON.stringify(answer.error));
  return answer.data as FeedbackItem;
};
const list = async (user: string | null) => {
  const answer = await worker.rpc(user, 'list_beta_feedback');
  assert.equal(answer.error, null, JSON.stringify(answer.error));
  return answer.data as { items: FeedbackItem[]; canManage: boolean };
};

test('anyone files one, signed in or not, numbered after the last, named by the account or the name given', async () => {
  const first = await submit(TESTER, { p_kind: 'bug', p_title: '  Slideshow skips a verse  ', p_details: 'In the Psali Adam, slide 4.', p_area: 'Midnight Praises', p_device: 'iOS 27.1 · 1.4.0' });
  assert.equal(first.number, 1);
  assert.deepEqual([first.kind, first.title, first.details, first.area, first.device], ['bug', 'Slideshow skips a verse', 'In the Psali Adam, slide 4.', 'Midnight Praises', 'iOS 27.1 · 1.4.0']);
  assert.deepEqual([first.reporterName, first.status, first.statusNote, first.mine], ['Mina Tester', 'open', null, true]);
  const anonymous = await submit(null, { p_kind: 'text', p_title: 'Typo in the Arabic of the Doxology', p_name: 'Kyrillos' });
  assert.deepEqual([anonymous.number, anonymous.reporterName, anonymous.details, anonymous.area, anonymous.mine], [2, 'Kyrillos', '', null, false]);
  const unnamed = await submit(null, { p_kind: 'idea', p_title: 'A darker night theme' });
  assert.deepEqual([unnamed.number, unnamed.reporterName], [3, null]);
  const chosenName = await submit(OTHER, { p_kind: 'idea', p_title: 'Bigger Coptic', p_name: 'M.' });
  assert.equal(chosenName.reporterName, 'M.');
});

test('everyone reads the whole list, the latest first, with no email or id; only an admin may manage it', async () => {
  const anonymous = await list(null);
  assert.deepEqual(anonymous.items.map((item) => item.number), [4, 3, 2, 1]);
  assert.equal(anonymous.canManage, false);
  assert.ok(anonymous.items.every((item) => !item.mine));
  const shown = JSON.stringify(anonymous.items);
  for (const secret of ['tester@example.com', TESTER, OTHER, 'user_id', 'userId']) assert.ok(!shown.includes(secret), `${secret} is never shown`);
  const tester = await list(TESTER);
  assert.deepEqual(tester.items.filter((item) => item.mine).map((item) => item.number), [1]);
  assert.equal(tester.canManage, false);
  assert.equal((await list(ADMIN)).canManage, true);
});

test('what is filed is checked: a kind it knows, a title, and nothing too long', async () => {
  const refused = async (args: Record<string, unknown>, message: RegExp) => {
    const answer = await worker.rpc(TESTER, 'submit_beta_feedback', args);
    assert.equal(answer.status, 400, JSON.stringify(answer));
    assert.match(answer.error!.message, message);
  };
  await refused({ p_kind: 'praise', p_title: 'Lovely' }, /Unknown kind of feedback/);
  await refused({ p_kind: 'bug', p_title: '   ' }, /A title is required/);
  await refused({ p_kind: 'bug', p_title: 'x'.repeat(FEEDBACK_LIMITS.title + 1) }, /title is longer than 120/);
  await refused({ p_kind: 'bug', p_title: 'Long', p_details: 'x'.repeat(FEEDBACK_LIMITS.details + 1) }, /description is longer than 4000/);
  await refused({ p_kind: 'bug', p_title: 'Named', p_name: 'x'.repeat(FEEDBACK_LIMITS.name + 1) }, /name is longer than 80/);
  assert.equal((await list(null)).items.length, 4, 'nothing refused was kept');
});

test('an admin sets the status and a note, and deletes; nobody else may', async () => {
  const [latest] = (await list(null)).items;
  for (const user of [null, TESTER]) {
    const update = await worker.rpc(user, 'admin_update_beta_feedback', { p_id: latest.id, p_status: 'fixed' });
    assert.equal(update.error?.code, '42501', String(user));
    const remove = await worker.rpc(user, 'admin_delete_beta_feedback', { p_id: latest.id });
    assert.equal(remove.error?.code, '42501', String(user));
  }
  const fixed = await worker.rpc(ADMIN, 'admin_update_beta_feedback', { p_id: latest.id, p_status: 'fixed', p_note: ' In 1.4.1 ' });
  assert.equal(fixed.error, null, JSON.stringify(fixed.error));
  assert.deepEqual([(fixed.data as FeedbackItem).status, (fixed.data as FeedbackItem).statusNote], ['fixed', 'In 1.4.1']);
  const unknown = await worker.rpc(ADMIN, 'admin_update_beta_feedback', { p_id: latest.id, p_status: 'shipped' });
  assert.match(unknown.error!.message, /Unknown status/);
  const reopened = await worker.rpc(ADMIN, 'admin_update_beta_feedback', { p_id: latest.id, p_status: 'open' });
  assert.equal((reopened.data as FeedbackItem).statusNote, null, 'no note clears it');

  const deleted = await worker.rpc(ADMIN, 'admin_delete_beta_feedback', { p_id: latest.id });
  assert.deepEqual(deleted.data, { deleted: latest.id });
  assert.deepEqual((await list(null)).items.map((item) => item.number), [3, 2, 1]);
  const missing = await worker.rpc(ADMIN, 'admin_delete_beta_feedback', { p_id: latest.id });
  assert.equal(missing.error?.code, 'P0002');
  // Its number isn't given again.
  assert.equal((await submit(OTHER, { p_kind: 'idea', p_title: 'Again' })).number, 4);
});

test('no more than so many an hour, by one account and by everyone signed out', async () => {
  const filedByOther = worker.rows<{ n: number }>('SELECT count(*) AS n FROM "public.beta_feedback" WHERE "user_id" = ?', OTHER)[0].n;
  for (let i = filedByOther; i < FEEDBACK_PER_HOUR.account; i += 1) await submit(OTHER, { p_kind: 'bug', p_title: `Bug ${i}` });
  const tooMany = await worker.rpc(OTHER, 'submit_beta_feedback', { p_kind: 'bug', p_title: 'One more' });
  assert.match(tooMany.error!.message, /Too much feedback in the last hour/);
  // Someone else still can.
  await submit(TESTER, { p_kind: 'bug', p_title: 'Still here' });
  // An hour later, the account can again.
  worker.db.prepare(`UPDATE "public.beta_feedback" SET "created_at" = '2026-01-01T00:00:00+00:00' WHERE "user_id" = ?`).run(OTHER);
  await submit(OTHER, { p_kind: 'bug', p_title: 'Next hour' });

  const filedSignedOut = worker.rows<{ n: number }>('SELECT count(*) AS n FROM "public.beta_feedback" WHERE "user_id" IS NULL')[0].n;
  for (let i = filedSignedOut; i < FEEDBACK_PER_HOUR.signedOut; i += 1) await submit(null, { p_kind: 'idea', p_title: `Idea ${i}` });
  const anonymous = await worker.rpc(null, 'submit_beta_feedback', { p_kind: 'idea', p_title: 'One more' });
  assert.match(anonymous.error!.message, /Too much feedback in the last hour/);
});

test("a deleted account's feedback stays, unnamed by it", async () => {
  const item = await submit(TESTER, { p_kind: 'bug', p_title: 'Before I go' });
  worker.db.prepare('DELETE FROM "auth.sessions" WHERE "user_id" = ?').run(TESTER);
  worker.db.prepare('DELETE FROM "auth.accounts" WHERE "user_id" = ?').run(TESTER);
  worker.db.prepare('DELETE FROM "auth.users" WHERE "id" = ?').run(TESTER);
  const kept = (await list(null)).items.find((candidate) => candidate.id === item.id)!;
  assert.deepEqual([kept.title, kept.reporterName], ['Before I go', 'Mina Tester']);
  assert.equal(worker.rows<{ user_id: string | null }>('SELECT "user_id" FROM "public.beta_feedback" WHERE "id" = ?', item.id)[0].user_id, null);
});
