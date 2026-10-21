/**
 * Parity: the notification dispatcher's queue (src/rpc/workers/notifications.ts),
 * the Worker against Supabase's own functions (the oracle), called as
 * Supabase's service role (the Worker's SERVICE_TOKEN) and refused for
 * everyone else. Deliveries in every state: due, claimed and silent too long,
 * not yet due, out of attempts, on a disabled device, and Expo tickets due or
 * not for a receipt check. After every call the tables they write are
 * compared (tests/lib/tables.ts).
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { ALICE, BOB, CAROL, id, seedCatalog } from './lib/creatorCatalog.ts';
import { createOracle, SERVICE_ROLE, type Oracle, type PgAnswer } from './lib/oracle.ts';
import { seed } from './lib/seed.ts';
import { bothTables, firstDifferences } from './lib/tables.ts';
import { normalize, WorkerSide, type Answer } from './lib/worker.ts';

const AT = '2026-03-10T08:00:00+00:00';
const ago = (minutes: number) => `${new Date(Date.now() - minutes * 60_000).toISOString().replace('Z', '')}+00:00`;
const minute = (n: number) => `2026-03-10T08:${String(n).padStart(2, '0')}:00+00:00`;
const D = (n: number) => id(600 + n); const DEV = (n: number) => id(640 + n);
/** Each delivery's own message: a notification, or for the broadcast ones a broadcast. */
const N = (n: number) => id(660 + n); const B = (n: number) => id(680 + n);
const BROADCAST = new Set([2, 6, 9, 12, 13, 14]);

let oracle: Oracle;
let worker: WorkerSide;
const seeded = new Set(Array.from({ length: 700 }, (_, n) => id(n)));
const TABLES = ['private.notification_deliveries', 'public.notification_devices'];

before(async () => {
  oracle = await createOracle();
  worker = new WorkerSide();
  await seedCatalog(oracle, worker);
  const device = (n: number, user: string | null, provider: string, extra: Record<string, unknown> = {}) => ({
    id: DEV(n), user_id: user, app_key: 'chc', platform: provider === 'expo' ? 'ios' : 'web', provider, push_token: `token-${n}`, created_at: AT, updated_at: AT, ...extra,
  });
  const delivery = (n: number, provider: string, deviceN: number, extra: Record<string, unknown>) => ({
    id: D(n), notification_id: BROADCAST.has(n) ? null : N(n), broadcast_id: BROADCAST.has(n) ? B(n) : null, device_id: DEV(deviceN), provider, status: 'queued', attempt_count: 0,
    max_attempts: 5, available_at: ago(60), created_at: minute(n), updated_at: AT, ...extra,
  });
  await seed(oracle, worker, [
    ['public.notification_devices', [
      device(1, ALICE, 'expo'), device(2, BOB, 'expo'), device(3, ALICE, 'expo', { enabled: false }),
      device(4, ALICE, 'web_push', { provider_data: { keys: { p256dh: 'k', auth: 'a' }, endpoint: 'stale' } }), device(5, null, 'web_push', { provider_data: { keys: { p256dh: 'k5', auth: 'a5' } } }),
    ]],
    ['public.notifications', Array.from({ length: 14 }, (_, i) => i + 1).filter((n) => !BROADCAST.has(n)).map((n) => ({
      id: N(n), user_id: ALICE, app_key: 'chc', category: 'announcements', event_type: 'admin_test', title: `Hello ${n}`, body: 'There',
      deep_link: n % 2 ? '/music' : null, image_url: n === 8 ? 'https://img.example/1.png' : null, payload: n === 8 ? { deep_link: '/old', n: 1 } : { kind: 'test' }, created_at: AT,
    }))],
    ['public.notification_broadcasts', [...BROADCAST].map((n) => ({
      id: B(n), app_key: 'chc', category: 'feast_celebrations', title: `Feast ${n}`, body: 'Today', deep_link: n === 2 ? '/home' : null, payload: { feast: true }, created_by: CAROL, created_at: AT,
    }))],
    ['private.notification_deliveries', [
      delivery(1, 'expo', 1, {}),
      delivery(2, 'expo', 2, {}),
      delivery(3, 'expo', 3, {}),
      delivery(4, 'expo', 1, { available_at: ago(-60) }),
      delivery(5, 'expo', 2, { status: 'processing', claimed_at: ago(20), attempt_count: 1 }),
      delivery(6, 'expo', 1, { status: 'processing', claimed_at: ago(2), attempt_count: 1 }),
      delivery(7, 'expo', 2, { attempt_count: 5 }),
      delivery(8, 'web_push', 4, {}),
      delivery(9, 'web_push', 5, { attempt_count: 4 }),
      delivery(10, 'expo', 1, { status: 'accepted', provider_ticket_id: 'ticket-10', accepted_at: ago(20) }),
      delivery(11, 'expo', 2, { status: 'accepted', provider_ticket_id: 'ticket-11', accepted_at: ago(30), receipt_checked_at: ago(2) }),
      delivery(12, 'expo', 1, { status: 'accepted', accepted_at: ago(40) }),
      delivery(13, 'expo', 2, { status: 'accepted', provider_ticket_id: 'ticket-13', accepted_at: ago(10) }),
      delivery(14, 'expo', 2, { status: 'accepted', provider_ticket_id: 'ticket-14', accepted_at: ago(50), receipt_checked_at: ago(6) }),
    ]],
  ]);
  await sameTables('seed');
});
after(() => oracle.close());

async function sameTables(what: string): Promise<void> {
  const { pg, sqlite } = await bothTables(oracle, worker, TABLES, seeded);
  if (pg !== sqlite) assert.fail(`${what}: the tables differ\n${firstDifferences(sqlite, pg).join('\n')}`);
}

/** Postgres returns claimed rows in its join's order: compared by delivery id. */
const sorted = (data: unknown) => (Array.isArray(data) ? [...data].sort((a, b) => String(a.delivery_id).localeCompare(String(b.delivery_id))) : data);

function same(pg: PgAnswer, w: Answer, what: string): void {
  if (pg.error) {
    assert.ok(w.error, `${what}: Postgres refused (${pg.error.code} ${pg.error.message}); the Worker answered ${JSON.stringify(w.data)?.slice(0, 400)}`);
    assert.equal(w.error!.code, pg.error.code, `${what}: error code (${w.error!.message})`);
    assert.equal(w.error!.message, pg.error.message, `${what}: error message`);
  } else {
    assert.equal(w.error, null, `${what}: the Worker refused (${JSON.stringify(w.error)}); Postgres answered ${JSON.stringify(pg.data)?.slice(0, 400)}`);
    assert.deepEqual(normalize(sorted(w.data), seeded), normalize(sorted(pg.data), seeded), what);
  }
}

async function both(user: string | null, fn: string, args: Record<string, unknown> = {}): Promise<PgAnswer> {
  const what = `${fn}(${JSON.stringify(args).slice(0, 300)}) as ${user ?? 'anon'}`;
  const pg = await oracle.call(user, fn, args);
  same(pg, await worker.rpc(user, fn, args), what);
  await sameTables(`after ${what}`);
  return pg;
}

const ids = (answer: PgAnswer) => (answer.data as { delivery_id: string }[]).map((row) => row.delivery_id).sort();

test('only the service role: anyone else is refused by the grants', async () => {
  for (const user of [null, ALICE, CAROL]) {
    for (const fn of ['claim_notification_deliveries', 'claim_web_push_deliveries', 'claim_notification_receipts', 'complete_notification_deliveries', 'complete_notification_receipts']) {
      assert.equal((await both(user, fn, fn.startsWith('complete') ? { p_results: [] } : {})).error?.code, '42501');
    }
  }
});

test('claims: the oldest due first, up to the limit; silent claims taken back; a disabled device\'s claimed but not sent', async () => {
  assert.deepEqual(ids(await both(SERVICE_ROLE, 'claim_notification_deliveries', { p_limit: 2 })), [D(1), D(2)]);
  assert.deepEqual(ids(await both(SERVICE_ROLE, 'claim_notification_deliveries', {})), [D(5)]);
  assert.deepEqual(ids(await both(SERVICE_ROLE, 'claim_notification_deliveries', { p_limit: -5 })), []);
  assert.deepEqual(ids(await both(SERVICE_ROLE, 'claim_web_push_deliveries', { p_limit: 500 })), [D(8), D(9)]);
});

test('completing deliveries: accepted with a ticket, retried later (or failed when out of attempts), a gone device disabled', async () => {
  // Refused, and nothing written: not a list, a bad id, a bad delay.
  for (const results of [{}, [{ delivery_id: D(3), result: 'accepted' }, { delivery_id: 'nope', result: 'accepted' }], [{ delivery_id: D(1), result: 'retry', retry_after_seconds: '1.5' }]]) {
    assert.ok((await both(SERVICE_ROLE, 'complete_notification_deliveries', { p_results: results })).error);
  }
  const count = await both(SERVICE_ROLE, 'complete_notification_deliveries', { p_results: [
    { delivery_id: D(1), result: 'accepted', ticket_id: 'ticket-1' },
    { delivery_id: D(2), result: 'retry', error: 'rate limited', retry_after_seconds: 5 },
    { delivery_id: D(9), result: 'retry', error: 'busy', retry_after_seconds: 99999 },
    { delivery_id: D(5), result: 'disabled', error: 'DeviceNotRegistered' },
    { delivery_id: D(8), result: 'delivered' },
    { delivery_id: D(3), result: 'nonsense', error: '' },
    { delivery_id: id(699), result: 'accepted' }, { delivery_id: null }, 5, ['x'],
  ] });
  assert.equal(count.data, 10);
  assert.equal((await both(SERVICE_ROLE, 'complete_notification_deliveries', { p_results: null })).data, 0);
});

test('receipts: accepted tickets a quarter of an hour old, not checked in five minutes; then delivered, disabled or failed', async () => {
  assert.deepEqual(ids(await both(SERVICE_ROLE, 'claim_notification_receipts', {})), [D(10), D(14)]);
  assert.deepEqual(ids(await both(SERVICE_ROLE, 'claim_notification_receipts', { p_limit: 0 })), []);
  await both(SERVICE_ROLE, 'complete_notification_receipts', { p_results: [
    { delivery_id: D(10), result: 'delivered' }, { delivery_id: D(14), result: 'disabled', error: 'gone' }, { delivery_id: D(11), result: 'error', error: 'MessageTooBig' }, { delivery_id: id(699) },
  ] });
  assert.ok((await both(SERVICE_ROLE, 'complete_notification_receipts', { p_results: 'nope' })).error);
});
