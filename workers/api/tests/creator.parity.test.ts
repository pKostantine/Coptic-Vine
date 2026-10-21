/**
 * Parity: the creator editor's reads (src/rpc/creator/reads.ts), the Worker
 * against Supabase's own functions (the oracle), over the catalog of
 * tests/lib/creatorCatalog.ts, as every kind of caller: an account's owner,
 * editor and viewer, another account's owner, an admin, and someone with no
 * account.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { A1, AL1, ALICE, BOB, C1, C2, C3, CAROL, DAVE, ERIN, id, R1, R2, R3, R4, R5, R6, S1, S2, S3, S4, S5, S6, S7, seedCatalog, VERA } from './lib/creatorCatalog.ts';
import { createOracle, type Oracle, type PgAnswer } from './lib/oracle.ts';
import { normalize, WorkerSide, type Answer } from './lib/worker.ts';

let oracle: Oracle;
let worker: WorkerSide;

before(async () => {
  oracle = await createOracle();
  worker = new WorkerSide();
  await seedCatalog(oracle, worker);
});
after(() => oracle.close());

const EVERYONE = [ALICE, DAVE, VERA, ERIN, CAROL, BOB];
// Every id the catalog seeds stays as it is in the comparison (only generated ids become placeholders).
const seeded = new Set(Array.from({ length: 500 }, (_, n) => id(n)));

function same(pg: PgAnswer, w: Answer, what: string): void {
  if (pg.error) {
    assert.ok(w.error, `${what}: Postgres refused (${pg.error.code} ${pg.error.message}); the Worker answered ${JSON.stringify(w.data)?.slice(0, 300)}`);
    assert.equal(w.error!.code, pg.error.code, `${what}: error code (${w.error!.message})`);
    assert.equal(w.error!.message, pg.error.message, `${what}: error message`);
  } else {
    assert.equal(w.error, null, `${what}: the Worker refused (${JSON.stringify(w.error)}); Postgres answered ${JSON.stringify(pg.data)?.slice(0, 300)}`);
    assert.deepEqual(normalize(w.data, seeded), normalize(pg.data, seeded), what);
  }
}

async function both(user: string | null, fn: string, args: Record<string, unknown> = {}) {
  const pg = await oracle.call(user, fn, args);
  const w = await worker.rpc(user, fn, args);
  same(pg, w, `${fn}(${JSON.stringify(args)}) as ${user ?? 'anon'}`);
  return pg;
}

test('workspaces, dashboards, catalog and credit options', async () => {
  for (const user of [null, ...EVERYONE]) {
    await both(user, 'get_creator_workspaces');
    await both(user, 'get_creator_catalog_options');
    for (const account of [C1, C2, C3, id(499)]) {
      await both(user, 'get_creator_dashboard', { p_creator_account_id: account });
      await both(user, 'get_creator_credit_options', { p_creator_account_id: account });
    }
  }
});

test('artist profiles and releases', async () => {
  for (const user of EVERYONE) {
    for (const account of [C1, C2, C3]) {
      await both(user, 'get_creator_artist_profile', { p_creator_account_id: account });
      await both(user, 'get_creator_releases', { p_creator_account_id: account });
    }
    for (const release of [R1, R2, R3, R4, R5, R6, id(498)]) await both(user, 'get_creator_release', { p_release_id: release });
  }
});

test('submission items and the submission editor', async () => {
  for (const user of EVERYONE) {
    for (const submission of [S1, S2, S3, S4, S5, S6, S7, id(497)]) {
      await both(user, 'get_creator_submission_items', { p_submission_id: submission });
      await both(user, 'get_submission_editor', { p_submission_id: submission });
    }
  }
});

test('contributor search', async () => {
  for (const [user, account] of [[ALICE, C1], [ERIN, C3], [VERA, C1], [CAROL, C2]]) {
    for (const query of ['mina', 'Deacon Mina', 'MINA!', 'saint mark', 'Cantor Tharwat', 'tharwat', "mo'allem ibrahim", 'ibrahim', 'ibrahm', 'erin', 'x', '', null, 'choir']) {
      for (const kind of ['artist', 'cantor', ' ALL ', 'bogus']) await both(user, 'search_creator_contributors', { p_creator_account_id: account, p_query: query, p_kind: kind });
    }
    await both(user, 'search_creator_contributors', { p_creator_account_id: account, p_query: 'mina', p_limit: 1 });
    await both(user, 'search_creator_contributors', { p_creator_account_id: account, p_query: 'a', p_limit: 0 });
  }
});

test('reusable uploads', async () => {
  for (const user of [ALICE, DAVE, ERIN, CAROL]) {
    for (const [name, length, type] of [['take-2.wav', 1010, 'audio'], ['take-2.wav', 1014, 'audio'], ['clip.mov', 1011, 'video'], ['clip.mov', 1012, 'video'], ['old.wav', 1013, 'audio'], ['take-2.wav', 1010, 'video']] as const) {
      const answer = await both(user, 'find_reusable_uploaded_media_intent', { p_creator_account_id: C1, p_original_filename: name, p_content_length: length, p_media_type: type });
      if (user === ALICE && name === 'take-2.wav' && length === 1014) assert.ok(answer.data, 'the newest matching upload is found');
    }
  }
});

test('a silent video is ready; one still waiting for its audio is not', async () => {
  const releases = (await oracle.call(ALICE, 'get_creator_releases', { p_creator_account_id: C1 })).data as { id: string }[];
  assert.ok(releases.some((r) => r.id === R5) && !releases.some((r) => r.id === R6));
});

test('the editor sees what an admin sees', async () => {
  const editor = await oracle.call(CAROL, 'get_submission_editor', { p_submission_id: S1 });
  assert.equal((editor.data as { isAdmin: boolean }).isAdmin, true);
  assert.ok(A1 && AL1 && R1);
});
