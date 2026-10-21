/**
 * Parity: the upload authorizer's functions (src/rpc/workers/uploads.ts), the
 * Worker against Supabase's own functions (the oracle), over
 * tests/lib/creatorCatalog.ts plus uploads that are authorized, expired,
 * someone else's, already sent, and items whose original was removed after
 * processing. After every call the tables they write are compared, generated
 * ids renamed (tests/lib/tables.ts): a refused call must leave both sides as
 * they were.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { ALICE, BOB, C1, C2, CAROL, DAVE, id, intent, item, S1, seedCatalog, VERA } from './lib/creatorCatalog.ts';
import { createOracle, type Oracle, type PgAnswer } from './lib/oracle.ts';
import { seed } from './lib/seed.ts';
import { bothTables, firstDifferences } from './lib/tables.ts';
import { normalize, WorkerSide, type Answer } from './lib/worker.ts';

const AT = '2026-03-10T08:00:00+00:00';
const ago = (hours: number) => `${new Date(Date.now() - hours * 3600_000).toISOString().replace('Z', '')}+00:00`;
const later = (days: number) => `${new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 13)}:00:00+00:00`;
const OPEN = id(600); const EXPIRED = id(601); const DAVES = id(602); const SENT = id(603);

let oracle: Oracle;
let worker: WorkerSide;
const seeded = new Set(Array.from({ length: 700 }, (_, n) => id(n)));
const TABLES = ['media.upload_intents', 'media.submission_items'];

before(async () => {
  oracle = await createOracle();
  worker = new WorkerSide();
  await seedCatalog(oracle, worker);
  const upload = (uploadId: string, requestedBy: string, status: string, expires: string) => ({
    id: uploadId, creator_account_id: C1, requested_by: requestedBy, bucket: 'chc-submissions', media_type: 'audio', path: `submissions/${C1}/${uploadId}/original.wav`,
    original_filename: 'take.wav', content_type: 'audio/wav', content_length: 500, checksum_sha256: 'ab'.repeat(32), status, upload_expires_at: expires, created_at: AT, updated_at: AT,
  });
  await seed(oracle, worker, [
    ['media.upload_intents', [upload(OPEN, ALICE, 'authorized', later(1)), upload(EXPIRED, ALICE, 'authorized', ago(1)), upload(DAVES, DAVE, 'authorized', later(1)), upload(SENT, ALICE, 'uploaded', later(1))]],
    ['media.submission_items', [
      // Originals removed after processing: previewed from the processed copy, or not at all without one.
      { id: id(610), submission_id: S1, role: 'track', title: 'Removed', sort_order: 5, upload_intent_id: intent(11), media_asset_id: id(107), required: false, created_at: AT, updated_at: AT },
      { id: id(611), submission_id: S1, role: 'track', title: 'Gone', sort_order: 6, upload_intent_id: intent(12), required: false, created_at: AT, updated_at: AT },
    ]],
  ]);
  await sameTables('seed');
});
after(() => oracle.close());

async function sameTables(what: string): Promise<void> {
  const { pg, sqlite } = await bothTables(oracle, worker, TABLES, seeded);
  if (pg !== sqlite) assert.fail(`${what}: the tables differ\n${firstDifferences(sqlite, pg).join('\n')}`);
}

/** A generated id inside a longer string (the file's path) masked; whole ids are normalize()'s. */
function maskPaths(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(maskPaths);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, maskPaths(v)]));
  if (typeof value === 'string' && value.includes('/')) return value.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, (u) => (seeded.has(u) ? u : '<generated>'));
  return value;
}

function same(pg: PgAnswer, w: Answer, what: string): void {
  if (pg.error) {
    assert.ok(w.error, `${what}: Postgres refused (${pg.error.code} ${pg.error.message}); the Worker answered ${JSON.stringify(w.data)?.slice(0, 400)}`);
    assert.equal(w.error!.code, pg.error.code, `${what}: error code (${w.error!.message})`);
    assert.equal(w.error!.message, pg.error.message, `${what}: error message`);
  } else {
    assert.equal(w.error, null, `${what}: the Worker refused (${JSON.stringify(w.error)}); Postgres answered ${JSON.stringify(pg.data)?.slice(0, 400)}`);
    assert.deepEqual(normalize(maskPaths(w.data), seeded), normalize(maskPaths(pg.data), seeded), what);
  }
}

async function both(user: string | null, fn: string, args: Record<string, unknown>): Promise<PgAnswer> {
  const what = `${fn}(${JSON.stringify(args).slice(0, 300)}) as ${user ?? 'anon'}`;
  const pg = await oracle.call(user, fn, args);
  const w = await worker.rpc(user, fn, args);
  same(pg, w, what);
  await sameTables(`after ${what}`);
  return pg;
}

const rows = (answer: PgAnswer) => (answer.error ? -1 : (answer.data as unknown[]).length);

test('creating an upload: an editor of the account, a supported file, its path from a fresh id and the name\'s extension', async () => {
  const file = { p_creator_account_id: C1, p_original_filename: ' Take One.WAV ', p_content_type: ' Audio/WAV ', p_content_length: 1000 };
  const outcomes = [];
  for (const [user, args] of [
    [ALICE, { ...file, p_checksum_sha256: ` ${'AB'.repeat(32)} ` }],
    [ALICE, { ...file, p_original_filename: 'cover', p_content_type: 'image/png', p_media_type: 'image' }],
    [ALICE, { ...file, p_original_filename: 'clip.abcdefghijklm', p_content_type: 'video/quicktime', p_media_type: 'video', p_checksum_sha256: '' }],
    [CAROL, { ...file, p_creator_account_id: C2 }],
    [VERA, file], [BOB, file], [null, file],
    [ALICE, { ...file, p_creator_account_id: null }],
    [ALICE, { ...file, p_original_filename: '   ' }], [ALICE, { ...file, p_original_filename: null }],
    [ALICE, { ...file, p_content_type: 'text/plain' }], [ALICE, { ...file, p_content_type: null }],
    [ALICE, { ...file, p_content_length: 0 }], [ALICE, { ...file, p_content_length: 21474836481 }],
    [ALICE, { ...file, p_checksum_sha256: 'xyz' }], [ALICE, { ...file, p_media_type: 'bogus' }], [ALICE, { ...file, p_media_type: null }],
  ] as [string | null, Record<string, unknown>][]) outcomes.push(rows(await both(user, 'create_media_upload_intent', args)));
  assert.deepEqual(outcomes, [1, 1, 1, 1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]);
});

test('an upload to send: only the requester\'s own, still authorized and unexpired', async () => {
  const outcomes = [];
  for (const [user, upload] of [[ALICE, OPEN], [ALICE, EXPIRED], [ALICE, DAVES], [DAVE, DAVES], [ALICE, SENT], [BOB, OPEN], [ALICE, id(699)], [null, OPEN]] as [string | null, string][]) {
    outcomes.push(rows(await both(user, 'get_media_upload_intent_for_upload', { p_upload_intent_id: upload })));
  }
  assert.deepEqual(outcomes, [1, 0, 0, 1, 0, 0, 0, -1]);
});

test('completing an upload: the requester, once, at the size authorized; an expired or mis-sized one refused and left as it was', async () => {
  const outcomes = [];
  for (const [user, args] of [
    [ALICE, { p_upload_intent_id: OPEN, p_uploaded_size: 499, p_r2_http_etag: 'e1' }],
    [ALICE, { p_upload_intent_id: EXPIRED, p_uploaded_size: 500, p_r2_http_etag: 'e1' }],
    [ALICE, { p_upload_intent_id: DAVES, p_uploaded_size: 500, p_r2_http_etag: 'e1' }],
    [ALICE, { p_upload_intent_id: SENT, p_uploaded_size: 500, p_r2_http_etag: 'e1' }],
    [ALICE, { p_upload_intent_id: id(699), p_uploaded_size: 500, p_r2_http_etag: 'e1' }],
    [ALICE, { p_upload_intent_id: OPEN, p_uploaded_size: 500, p_r2_http_etag: '"etag-1"' }],
    [ALICE, { p_upload_intent_id: OPEN, p_uploaded_size: 500, p_r2_http_etag: '"etag-1"' }],
    [DAVE, { p_upload_intent_id: DAVES, p_uploaded_size: null, p_r2_http_etag: null }],
    [null, { p_upload_intent_id: OPEN, p_uploaded_size: 500, p_r2_http_etag: null }],
  ] as [string | null, Record<string, unknown>][]) outcomes.push(rows(await both(user, 'complete_media_upload_intent', args)));
  assert.deepEqual(outcomes, [-1, -1, -1, -1, -1, 1, -1, 1, -1]);
});

test('previewing an item\'s file: for admins, the original while it is kept, then the processed copy', async () => {
  const outcomes = [];
  for (const [user, itemId] of [[CAROL, item(1)], [CAROL, id(610)], [CAROL, id(611)], [CAROL, item(4)], [CAROL, item(9)], [CAROL, id(699)], [ALICE, item(1)], [null, item(1)]] as [string | null, string][]) {
    outcomes.push(rows(await both(user, 'get_admin_submission_preview_item', { p_item_id: itemId })));
  }
  assert.deepEqual(outcomes, [1, 1, 0, 0, 0, 0, -1, -1]);
});
