/**
 * Parity: the user's own settings and tables, the Worker against Supabase's
 * own functions and policies (the PGlite oracle). The same calls go to both,
 * as the same users, and the answers must match: data, or error code and
 * message. Then the tables they wrote are compared too.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createOracle, type Oracle, type PgAnswer } from './lib/oracle.ts';
import { normalize, WorkerSide, type Answer } from './lib/worker.ts';

const ALICE = '0a1b2c3d-0000-4000-8000-00000000a11c';
const BOB = '0a1b2c3d-0000-4000-8000-000000000b0b';

let oracle: Oracle;
let worker: WorkerSide;

before(async () => {
  oracle = await createOracle();
  worker = new WorkerSide();
  for (const [id, email] of [[ALICE, 'alice@example.com'], [BOB, 'bob@example.com']]) {
    await oracle.addUser(id, email);
    await worker.addUser(id, email);
  }
});
after(() => oracle.close());

/** Same data, or the same error (code and message). */
function same(pg: PgAnswer, w: Answer, what: string, keep?: Set<string>): void {
  if (pg.error) {
    assert.ok(w.error, `${what}: Postgres refused (${pg.error.code} ${pg.error.message}); the Worker answered ${JSON.stringify(w.data)}`);
    assert.equal(w.error!.code, pg.error.code, `${what}: error code`);
    assert.equal(w.error!.message, pg.error.message, `${what}: error message`);
  } else {
    assert.equal(w.error, null, `${what}: the Worker refused (${JSON.stringify(w.error)}); Postgres answered ${JSON.stringify(pg.data)}`);
    assert.deepEqual(normalize(w.data, keep), normalize(pg.data, keep), what);
  }
}

async function both(user: string | null, fn: string, args: Record<string, unknown> = {}, keep?: Set<string>) {
  const pg = await oracle.call(user, fn, args);
  const w = await worker.rpc(user, fn, args);
  same(pg, w, `${fn}(${JSON.stringify(args).slice(0, 80)}) as ${user ?? 'anon'}`, keep);
  return { pg, w };
}

test('content preferences: signed-out refused, empty at first, saved and read back, kept per user', async () => {
  await both(null, 'get_my_content_preferences');
  await both(ALICE, 'get_my_content_preferences');
  const long = 'x'.repeat(513);
  await both(ALICE, 'save_my_content_preferences', {
    p_preferences: { theme: 'dark', fontSize: 18, nested: { b: 1, a: [true, null, 'é'] }, 'zz': 'last', a: 'first' },
    p_bookmarks: ['  liturgy/1  ', 'agpeya/3', 'liturgy/1', '', '   ', long, 'psalmody/2'],
  });
  await both(ALICE, 'get_my_content_preferences');
  await both(ALICE, 'save_my_content_preferences', { p_preferences: { theme: 'light' } });
  await both(ALICE, 'get_my_content_preferences');
  await both(ALICE, 'save_my_content_preferences', { p_preferences: ['not', 'an', 'object'] });
  await both(ALICE, 'save_my_content_preferences', { p_preferences: {}, p_bookmarks: Array.from({ length: 501 }, (_, i) => `b${i}`) });
  await both(BOB, 'get_my_content_preferences');
  await both(null, 'save_my_content_preferences', { p_preferences: {} });
});

const EXPO = 'ExponentPushToken[abcdefgh12345678]';

test('push devices: who may register, which tokens, moving between accounts, disabling', async () => {
  await both(null, 'register_notification_device', { p_app_key: 'chc', p_platform: 'ios', p_provider: 'expo', p_push_token: EXPO, p_device_name: 'iPhone' });
  await both(null, 'register_notification_device', { p_app_key: 'chc_admin', p_platform: 'ios', p_provider: 'expo', p_push_token: EXPO });
  await both(ALICE, 'register_notification_device', { p_app_key: 'chc', p_platform: 'blackberry', p_provider: 'expo', p_push_token: EXPO });
  await both(ALICE, 'register_notification_device', { p_app_key: 'chc', p_platform: 'ios', p_provider: 'expo', p_push_token: '   ' });
  await both(ALICE, 'register_notification_device', { p_app_key: 'chc', p_platform: 'web', p_provider: 'web_push', p_push_token: 'https://evil.example/push/1' });
  await both(ALICE, 'register_notification_device', { p_app_key: 'chc_artists', p_platform: 'web', p_provider: 'web_push', p_push_token: 'https://fcm.googleapis.com/fcm/send/x' });
  await both(ALICE, 'register_notification_device', { p_app_key: 'chc', p_platform: 'web', p_provider: 'expo', p_push_token: EXPO });
  await both(ALICE, 'register_notification_device', { p_app_key: 'chc', p_platform: 'ios', p_provider: 'expo', p_push_token: 'ExpoPushToken[short]' });
  await both(ALICE, 'register_notification_device', { p_app_key: 'chc', p_platform: 'web', p_provider: 'web_push', p_push_token: 'https://updates.push.services.mozilla.com/wpush/v2/abc', p_provider_data: { keys: { p256dh: 'k', auth: 'a' } } });
  // The signed-out install signs in: the device moves to the account.
  await both(ALICE, 'register_notification_device', { p_app_key: 'chc', p_platform: 'ios', p_provider: 'expo', p_push_token: EXPO, p_device_name: 'iPhone', p_app_version: '1.4.0' });
  await both(BOB, 'disable_notification_device', { p_app_key: 'chc', p_provider: 'expo', p_push_token: EXPO });
  await both(null, 'disable_notification_device', { p_app_key: 'chc', p_provider: 'expo', p_push_token: EXPO });
  await both(ALICE, 'disable_notification_device', { p_app_key: 'chc', p_provider: 'expo', p_push_token: EXPO });
  await both(ALICE, 'register_notification_device', { p_app_key: 'chc', p_platform: 'ios', p_provider: 'expo', p_push_token: EXPO });

  const columns = ['user_id', 'app_key', 'platform', 'provider', 'push_token', 'device_name', 'app_version', 'enabled'];
  const pgRows = await oracle.sql(`select ${columns.join(', ')}, provider_data from public.notification_devices order by push_token`);
  const wRows = worker.rows(`SELECT ${columns.map((c) => `"${c}"`).join(', ')}, "provider_data" FROM "public.notification_devices" ORDER BY "push_token"`)
    .map((row) => ({ ...row, enabled: row.enabled === 1, provider_data: JSON.parse(row.provider_data as string) }));
  assert.deepEqual(normalize(wRows, new Set([ALICE, BOB])), normalize(pgRows, new Set([ALICE, BOB])), 'the devices table');
});

/** A table request on both sides: supabase-js's request to the Worker, and the SQL PostgREST would run in Postgres. */
async function table(user: string | null, request: { method: string; path: string; body?: unknown; headers?: Record<string, string> }, pgSql: string, pgParams: unknown[] = []) {
  const w = await worker.request(user, request.method, request.path, { body: request.body, headers: { 'accept-profile': 'public', 'content-profile': 'public', ...request.headers } });
  const pg = await oracle.asUser(user, pgSql, pgParams);
  const what = `${request.method} ${request.path} as ${user ?? 'anon'}`;
  if (pg.error) {
    assert.ok(w.error, `${what}: Postgres refused (${pg.error.code} ${pg.error.message}); the Worker answered ${w.status} ${JSON.stringify(w.data)}`);
    assert.equal(w.error!.code, pg.error.code, `${what}: error code`);
    assert.equal(w.error!.message, pg.error.message, `${what}: error message`);
  } else {
    assert.equal(w.error, null, `${what}: the Worker refused (${JSON.stringify(w.error)})`);
    const rows = (pg.rows[0] as { result?: unknown } | undefined)?.result;
    if (rows !== undefined) assert.deepEqual(normalize(w.data, new Set([ALICE, BOB])), normalize(rows, new Set([ALICE, BOB])), what);
  }
  return w;
}

test('notification preferences: upsert, read, kept per user, nobody writes for someone else', async () => {
  const stamp = '2026-10-21T02:03:04.567Z';
  const upsert = (user: string, row: Record<string, unknown>) => table(user,
    { method: 'POST', path: '/rest/v1/notification_preferences?on_conflict=user_id,app_key,category', body: row, headers: { prefer: 'resolution=merge-duplicates' } },
    `insert into public.notification_preferences (user_id, app_key, category, enabled, updated_at) values ($1, $2, $3, $4, $5)
     on conflict (user_id, app_key, category) do update set enabled = excluded.enabled, updated_at = excluded.updated_at`,
    [row.user_id, row.app_key, row.category, row.enabled, row.updated_at]);
  await upsert(ALICE, { user_id: ALICE, app_key: 'chc', category: 'music_releases', enabled: false, updated_at: stamp });
  await upsert(ALICE, { user_id: ALICE, app_key: 'chc', category: 'learning_releases', enabled: true, updated_at: stamp });
  await upsert(ALICE, { user_id: ALICE, app_key: 'chc', category: 'music_releases', enabled: true, updated_at: stamp });
  await upsert(ALICE, { user_id: BOB, app_key: 'chc', category: 'music_releases', enabled: false, updated_at: stamp });
  const select = (user: string | null) => table(user,
    { method: 'GET', path: `/rest/v1/notification_preferences?select=category,enabled&user_id=eq.${user ?? ALICE}&app_key=eq.chc&category=in.(music_releases,learning_releases,other)` },
    `select coalesce(json_agg(json_build_object('category', category, 'enabled', enabled) order by category), '[]') as result from public.notification_preferences
     where user_id = $1 and app_key = 'chc' and category in ('music_releases', 'learning_releases', 'other')`, [user ?? ALICE]);
  const alice = await select(ALICE);
  assert.equal((alice.data as unknown[]).length, 2);
  await select(BOB);
  await select(null);
  const stored = worker.rows<{ updated_at: string }>('SELECT "updated_at" FROM "public.notification_preferences" WHERE "category" = ?', 'music_releases');
  assert.deepEqual(stored.map((row) => row.updated_at), ['2026-10-21T02:03:04.567+00:00'], 'the client\'s timestamp, in the stored form');
});

test('notifications: the user\'s own list, marking one read, and nothing else', async () => {
  const insert = `insert into public.notifications (id, user_id, app_key, category, event_type, title, body, deep_link, payload, created_at) values
    ('11111111-1111-4111-8111-111111111111', $1, 'chc', 'music_releases', 'release_published', 'New album', 'Listen now', '/music/release/1', '{"releaseId": 1}', '2026-10-20T10:00:00+00:00'),
    ('22222222-2222-4222-8222-222222222222', $1, 'chc', 'music_releases', 'release_published', 'Older', 'Before', null, '{}', '2026-10-19T10:00:00+00:00'),
    ('33333333-3333-4333-8333-333333333333', $2, 'chc', 'music_releases', 'release_published', 'Bob''s', 'Not Alice''s', null, '{}', '2026-10-20T11:00:00+00:00')`;
  await oracle.sql(insert, [ALICE, BOB]);
  worker.db.prepare(insert.replaceAll('public.notifications', '"public.notifications"').replace(/\$[12]/g, '?')).run(ALICE, ALICE, BOB);

  const list = (user: string | null) => table(user,
    { method: 'GET', path: '/rest/v1/notifications?select=id,category,event_type,title,body,image_url,deep_link,payload,created_at,read_at&app_key=eq.chc&order=created_at.desc&limit=50' },
    `select coalesce(json_agg(json_build_object('id', id, 'category', category, 'event_type', event_type, 'title', title, 'body', body, 'image_url', image_url, 'deep_link', deep_link, 'payload', payload, 'created_at', created_at, 'read_at', read_at) order by created_at desc), '[]') as result
     from (select * from public.notifications where app_key = 'chc' order by created_at desc limit 50) n`);
  const before = await list(ALICE);
  assert.deepEqual((before.data as { title: string }[]).map((n) => n.title), ['New album', 'Older']);
  await list(null);

  const readAt = '2026-10-21T08:00:00.000Z';
  await table(ALICE, { method: 'PATCH', path: '/rest/v1/notifications?id=eq.11111111-1111-4111-8111-111111111111&app_key=eq.chc', body: { read_at: readAt } },
    `update public.notifications set read_at = $1 where id = '11111111-1111-4111-8111-111111111111' and app_key = 'chc'`, [readAt]);
  // Bob can't mark Alice's, and nobody can change anything but read_at, or add one.
  await table(BOB, { method: 'PATCH', path: '/rest/v1/notifications?id=eq.22222222-2222-4222-8222-222222222222', body: { read_at: readAt } },
    `update public.notifications set read_at = $1 where id = '22222222-2222-4222-8222-222222222222'`, [readAt]);
  await table(ALICE, { method: 'PATCH', path: '/rest/v1/notifications?id=eq.11111111-1111-4111-8111-111111111111', body: { title: 'Changed' } },
    `update public.notifications set title = 'Changed' where id = '11111111-1111-4111-8111-111111111111'`);
  await table(ALICE, { method: 'POST', path: '/rest/v1/notifications', body: { user_id: ALICE, app_key: 'chc', category: 'x', event_type: 'x', title: 'x', body: 'x' } },
    `insert into public.notifications (user_id, app_key, category, event_type, title, body) values ($1, 'chc', 'x', 'x', 'x', 'x')`, [ALICE]);
  await list(ALICE);
  const bobs = worker.rows<{ read_at: string | null }>('SELECT "read_at" FROM "public.notifications" WHERE "id" = ?', '22222222-2222-4222-8222-222222222222');
  assert.equal(bobs[0].read_at, null);
});

test('spiritual canon, Bible highlights and sermon plans: upserts and reads of the user\'s own rows', async () => {
  const stamp = '2026-10-21T09:00:00.000Z';
  const items = [{ id: 'agpeya-1', kind: 'agpeya' }];
  await table(ALICE, { method: 'POST', path: '/rest/v1/spiritual_canons?on_conflict=user_id', body: { user_id: ALICE, items, item_deletions: { old: stamp }, updated_at: stamp }, headers: { prefer: 'resolution=merge-duplicates' } },
    `insert into public.spiritual_canons (user_id, items, item_deletions, updated_at) values ($1, $2, $3, $4) on conflict (user_id) do update set items = excluded.items, item_deletions = excluded.item_deletions, updated_at = excluded.updated_at`,
    [ALICE, JSON.stringify(items), JSON.stringify({ old: stamp }), stamp]);
  await table(ALICE, { method: 'GET', path: '/rest/v1/spiritual_canons?select=items,item_deletions,updated_at' },
    `select coalesce(json_agg(json_build_object('items', items, 'item_deletions', item_deletions, 'updated_at', updated_at)), '[]') as result from public.spiritual_canons`);
  await table(BOB, { method: 'GET', path: '/rest/v1/spiritual_canons?select=items,item_deletions' },
    `select coalesce(json_agg(json_build_object('items', items, 'item_deletions', item_deletions)), '[]') as result from public.spiritual_canons`);

  const days = [{ user_id: ALICE, day: '2026-10-20', marks: { 'agpeya-1': true } }, { user_id: ALICE, day: '2026-10-21', marks: { 'agpeya-1': false, note: 'é' } }];
  await table(ALICE, { method: 'POST', path: '/rest/v1/spiritual_canon_days?on_conflict=user_id,day&columns=%22user_id%22,%22day%22,%22marks%22', body: days, headers: { prefer: 'resolution=merge-duplicates' } },
    `insert into public.spiritual_canon_days (user_id, day, marks) select (d->>'user_id')::uuid, (d->>'day')::date, d->'marks' from jsonb_array_elements($1::jsonb) d
     on conflict (user_id, day) do update set marks = excluded.marks`, [JSON.stringify(days)]);
  await table(ALICE, { method: 'GET', path: '/rest/v1/spiritual_canon_days?select=day,marks&day=gte.2026-10-21&order=day.asc' },
    `select coalesce(json_agg(json_build_object('day', day, 'marks', marks) order by day), '[]') as result from public.spiritual_canon_days where day >= '2026-10-21'`);
  await table(ALICE, { method: 'GET', path: '/rest/v1/spiritual_canon_days?select=day,marks&day=in.(2026-10-20,2026-10-22)' },
    `select coalesce(json_agg(json_build_object('day', day, 'marks', marks) order by day), '[]') as result from public.spiritual_canon_days where day in ('2026-10-20', '2026-10-22')`);

  const highlights = [{ verse: 'GEN.1.1', color: 'gold' }];
  await table(ALICE, { method: 'POST', path: '/rest/v1/bible_highlights?on_conflict=user_id,book_key', body: { user_id: ALICE, book_key: 'GEN', highlights, highlight_deletions: {}, updated_at: stamp }, headers: { prefer: 'resolution=merge-duplicates' } },
    `insert into public.bible_highlights (user_id, book_key, highlights, highlight_deletions, updated_at) values ($1, 'GEN', $2, '{}', $3) on conflict (user_id, book_key) do update set highlights = excluded.highlights, highlight_deletions = excluded.highlight_deletions, updated_at = excluded.updated_at`,
    [ALICE, JSON.stringify(highlights), stamp]);
  await table(ALICE, { method: 'GET', path: '/rest/v1/bible_highlights?select=book_key,highlights,highlight_deletions,updated_at&book_key=eq.GEN' },
    `select coalesce(json_agg(json_build_object('book_key', book_key, 'highlights', highlights, 'highlight_deletions', highlight_deletions, 'updated_at', updated_at)), '[]') as result from public.bible_highlights where book_key = 'GEN'`);
  await table(ALICE, { method: 'POST', path: '/rest/v1/bible_highlights?on_conflict=user_id,book_key', body: { user_id: ALICE, book_key: 'GEN', highlights: { not: 'an array' }, highlight_deletions: {}, updated_at: stamp }, headers: { prefer: 'resolution=merge-duplicates' } },
    `insert into public.bible_highlights (user_id, book_key, highlights, highlight_deletions, updated_at) values ($1, 'GEN', '{"not": "an array"}', '{}', $2) on conflict (user_id, book_key) do update set highlights = excluded.highlights`,
    [ALICE, stamp]).catch(() => undefined);

  await table(BOB, { method: 'POST', path: '/rest/v1/sermon_plans?on_conflict=user_id,document_key,service_date', body: { user_id: BOB, document_key: 'liturgy', service_date: '2026-10-25', general_notes: 'Notes', highlights: [], highlight_deletions: {}, updated_at: stamp }, headers: { prefer: 'resolution=merge-duplicates' } },
    `insert into public.sermon_plans (user_id, document_key, service_date, general_notes, highlights, highlight_deletions, updated_at) values ($1, 'liturgy', '2026-10-25', 'Notes', '[]', '{}', $2)
     on conflict (user_id, document_key, service_date) do update set general_notes = excluded.general_notes, highlights = excluded.highlights, highlight_deletions = excluded.highlight_deletions, updated_at = excluded.updated_at`, [BOB, stamp]);
  await table(BOB, { method: 'GET', path: '/rest/v1/sermon_plans?select=document_key,service_date,general_notes,highlights,highlight_deletions,updated_at&document_key=eq.liturgy&service_date=eq.2026-10-25' },
    `select coalesce(json_agg(json_build_object('document_key', document_key, 'service_date', service_date, 'general_notes', general_notes, 'highlights', highlights, 'highlight_deletions', highlight_deletions, 'updated_at', updated_at)), '[]') as result from public.sermon_plans where document_key = 'liturgy' and service_date = '2026-10-25'`);
  await table(ALICE, { method: 'GET', path: '/rest/v1/sermon_plans?select=document_key&document_key=eq.liturgy' },
    `select coalesce(json_agg(json_build_object('document_key', document_key)), '[]') as result from public.sermon_plans where document_key = 'liturgy'`);
  await table(null, { method: 'GET', path: '/rest/v1/sermon_plans?select=document_key' }, `select document_key from public.sermon_plans`);
});
