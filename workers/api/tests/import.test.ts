/**
 * The user-data import (scripts/import.ts): Supabase's accounts as Better
 * Auth's, values checked before anything is written, and a load order that
 * puts parents first.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { authRows, insertStatements, literal, loadOrder } from '../scripts/import.ts';
import { userSchema } from '../scripts/lib/schema.ts';

const user = (over: Record<string, unknown> = {}) => ({
  id: 'u1', email: 'Reader@Example.com', emailConfirmedAt: '2026-09-01T00:00:00+00:00', encryptedPassword: '$2a$10$abcdefghijklmnopqrstuv',
  rawUserMetaData: '{"full_name": "A Reader", "chc_avatar_url": "https://example.com/a.png"}', rawAppMetaData: '{"provider": "email"}',
  createdAt: '2026-09-01T00:00:00+00:00', updatedAt: '2026-09-02T00:00:00+00:00', deletedAt: null, bannedUntil: null, ...over,
});
const identity = (provider: string, providerId: string) => ({ id: `${provider}-id`, userId: 'u1', provider, providerId, createdAt: '2026-09-01T00:00:00+00:00', updatedAt: '2026-09-01T00:00:00+00:00' });

test('Supabase users become Better Auth users with the same ids', () => {
  const { users, accounts } = authRows([user()], [identity('email', 'u1'), identity('google', '1234567890')]);
  assert.deepEqual(users, [['u1', 'A Reader', 'reader@example.com', true, 'https://example.com/a.png', user().rawUserMetaData, user().rawAppMetaData, user().createdAt, user().updatedAt]]);
  assert.deepEqual(accounts, [
    ['email-id', 'u1', 'u1', 'credential', '$2a$10$abcdefghijklmnopqrstuv', identity('email', 'u1').createdAt, identity('email', 'u1').updatedAt],
    ['google-id', 'u1', '1234567890', 'google', null, identity('google', '1').createdAt, identity('google', '1').updatedAt],
  ]);
});

test('a Google-only user gets no password, and the name falls back to the email', () => {
  const { users, accounts } = authRows([user({ encryptedPassword: null, rawUserMetaData: '{}', emailConfirmedAt: null })], [identity('google', '42')]);
  assert.equal(users[0][1], 'reader');
  assert.equal(users[0][3], false);
  assert.deepEqual(accounts.map((account) => account[3]), ['google']);
});

test('deleted users are left out, and unknown providers stop the import', () => {
  assert.equal(authRows([user({ deletedAt: '2026-10-01T00:00:00+00:00' })], []).users.length, 0);
  assert.throws(() => authRows([user()], [identity('apple', 'x')]), /apple identity/);
});

test('values are checked before anything is written', () => {
  const column = (kind: string, notNull = false) => ({ name: 'c', kind, notNull }) as Parameters<typeof literal>[1];
  assert.equal(literal('2026-10-20T19:52:43.5+00:00', column('timestamptz'), 'w'), "'2026-10-20T19:52:43.5+00:00'");
  assert.throws(() => literal('2026-10-20 19:52:43+00', column('timestamptz'), 'w'), /UTC timestamp/);
  assert.throws(() => literal(null, column('text', true), 'w'), /NOT NULL/);
  assert.equal(literal(true, column('boolean'), 'w'), '1');
  assert.equal(literal('["a"]', column('array'), 'w'), `'["a"]'`);
  assert.throws(() => literal('{"a": 1}', column('array'), 'w'), /JSON array/);
  assert.equal(literal("it's", column('text'), 'w'), "'it''s'");
  assert.equal(insertStatements('public', 'sermon_plans', [column('text')], [['x']])[0], `INSERT INTO "public.sermon_plans" ("c") VALUES\n('x');`);
});

test('parents load before their children, wherever there is no cycle', () => {
  const order = loadOrder(userSchema.tables).map((table) => `${table.schema}.${table.table}`);
  assert.equal(order.length, 73);
  const cyclic = new Set(['creator.creator_accounts', 'music.artists', 'media.media_assets']);
  for (const table of userSchema.tables) {
    const name = `${table.schema}.${table.table}`;
    for (const parent of table.parents) {
      if (parent === name || !order.includes(parent) || (cyclic.has(name) && cyclic.has(parent))) continue;
      assert.ok(order.indexOf(parent) < order.indexOf(name), `${parent} before ${name}`);
    }
  }
});
