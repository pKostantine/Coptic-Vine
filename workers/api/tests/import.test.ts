/**
 * The user-data import (scripts/import.ts): Supabase's accounts as Better
 * Auth's, values checked before anything is written, and a load order that
 * puts parents first.
 */
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import type { UserSchema, UserTable } from '../scripts/gen-schema.ts';
import { authRows, importSql, insertStatements, literal, loadOrder, loadPlan } from '../scripts/import.ts';
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

test('the real schema: the cycles close on nullable columns, filled in after the rows', () => {
  const { deferred } = loadPlan(userSchema.tables);
  assert.deepEqual([...deferred].map(([name, fks]) => `${name}: ${fks.map((fk) => fk.columns.join(',')).join(',')}`).sort(), [
    'media.media_assets: owner_creator_account_id',
    'media.submission_items: replaces_item_id',
    'music.artists: owner_creator_account_id',
  ]);
});

/** Two tables that point at each other, one of them also at itself, with Postgres's updated_at behaviour. */
function cycleSchema(): { schema: UserSchema; ddl: string } {
  const column = (name: string, kind: string, notNull = false) => ({ name, kind, notNull, pgType: '', generated: false }) as UserTable['columns'][number];
  const table = (name: string, foreignKeys: UserTable['foreignKeys'], extra: UserTable['columns']): UserTable => ({
    schema: 'creator', table: name, columns: [column('id', 'text', true), ...extra, column('updated_at', 'timestamptz', true)],
    dropped: [], primaryKey: ['id'], parents: foreignKeys.map((fk) => fk.references), foreignKeys, workerChecks: [], workerTriggers: [], skippedIndexes: [],
  });
  const accounts = table('accounts', [{ columns: ['artist_id'], references: 'creator.artists', referencedColumns: ['id'] }], [column('artist_id', 'text')]);
  const artists = table('artists', [
    { columns: ['account_id'], references: 'creator.accounts', referencedColumns: ['id'] },
    { columns: ['replaces_id'], references: 'creator.artists', referencedColumns: ['id'] },
  ], [column('account_id', 'text'), column('replaces_id', 'text')]);
  const trigger = (name: string) => `CREATE TRIGGER "creator.${name}_set_updated_at" AFTER UPDATE ON "creator.${name}" FOR EACH ROW WHEN NEW."updated_at" IS OLD."updated_at"
    BEGIN UPDATE "creator.${name}" SET "updated_at" = '2099-01-01T00:00:00+00:00' WHERE rowid = NEW.rowid; END;`;
  const ddl = `
    CREATE TABLE "creator.accounts" ("id" TEXT PRIMARY KEY, "artist_id" TEXT REFERENCES "creator.artists" ("id"), "updated_at" TEXT NOT NULL) STRICT;
    CREATE TABLE "creator.artists" ("id" TEXT PRIMARY KEY, "account_id" TEXT REFERENCES "creator.accounts" ("id"), "replaces_id" TEXT REFERENCES "creator.artists" ("id"), "updated_at" TEXT NOT NULL) STRICT;
    ${trigger('accounts')} ${trigger('artists')}
    CREATE TABLE "auth.users" ("id" TEXT PRIMARY KEY, "name" TEXT, "email" TEXT, "email_verified" INTEGER, "image" TEXT, "raw_user_meta_data" TEXT, "raw_app_meta_data" TEXT, "created_at" TEXT, "updated_at" TEXT) STRICT;
    CREATE TABLE "auth.accounts" ("id" TEXT PRIMARY KEY, "user_id" TEXT, "account_id" TEXT, "provider_id" TEXT, "password" TEXT, "created_at" TEXT, "updated_at" TEXT) STRICT;
    CREATE TABLE "auth.sessions" ("id" TEXT PRIMARY KEY) STRICT;
    CREATE TABLE "auth.verifications" ("id" TEXT PRIMARY KEY) STRICT;`;
  return { schema: { tables: [accounts, artists], enums: {} }, ddl };
}

test('rows that point at each other load with foreign keys checked row by row, as D1\'s remote import does', () => {
  const { schema, ddl } = cycleSchema();
  const stamp = '2026-10-20T19:52:43.5+00:00';
  const data = {
    exportedAt: stamp, authUsers: [], authIdentities: [],
    tables: {
      'creator/accounts': [{ id: 'acc', artist_id: 'art2', updated_at: stamp }],
      'creator/artists': [{ id: 'art1', account_id: 'acc', replaces_id: 'art2', updated_at: stamp }, { id: 'art2', account_id: 'acc', replaces_id: null, updated_at: stamp }],
    },
  };
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(ddl);
  const sql = importSql(schema, data).sql.replace('PRAGMA defer_foreign_keys = true;\n', '');
  for (let round = 0; round < 2; round += 1) db.exec(`BEGIN; ${sql} COMMIT;`);
  assert.deepEqual(db.prepare('SELECT * FROM "creator.accounts"').all().map((row) => ({ ...row })), [{ id: 'acc', artist_id: 'art2', updated_at: stamp }]);
  assert.deepEqual(db.prepare('SELECT * FROM "creator.artists" ORDER BY "id"').all().map((row) => ({ ...row })), [
    { id: 'art1', account_id: 'acc', replaces_id: 'art2', updated_at: stamp },
    { id: 'art2', account_id: 'acc', replaces_id: null, updated_at: stamp },
  ]);
});
