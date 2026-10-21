/**
 * The user-data schema (scripts/gen-schema.ts and migrations 0006/0007): the
 * generated files match the catalog, every name is quoted, every pattern fits
 * D1's limits, and the tables behave like Postgres's where it matters
 * (defaults, checks, updated_at).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { expressionSql, generate, timestampCheck } from '../scripts/gen-schema.ts';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const auth = read('../../content-api/migrations/0006_auth.sql');
const users = read('../../content-api/migrations/0007_user_schema.sql');

test('the generated schema is what the catalog makes', () => {
  const { migration, schema } = generate(JSON.parse(read('../schema/pg-catalog-users.json')));
  assert.equal(users, migration, 'run npm run gen:schema');
  assert.equal(read('../schema/user-tables.json'), `${JSON.stringify(schema, null, 1)}\n`, 'run npm run gen:schema');
  assert.equal(schema.tables.length, 73);
});

test('every LIKE and GLOB pattern fits D1 (50 bytes at most)', () => {
  for (const [name, sql] of [['0006', auth], ['0007', users]]) {
    for (const match of sql.matchAll(/\b(?:GLOB|LIKE)\s+'((?:[^']|'')*)'/g)) {
      assert.ok(Buffer.byteLength(match[1]) <= 50, `${name}: pattern ${match[1]} is ${Buffer.byteLength(match[1])} bytes`);
    }
  }
});

test('no schema.table name goes unquoted', () => {
  const schemas = ['auth', 'creator', 'learning', 'media', 'music', 'private', 'public'];
  for (const [name, sql] of [['0006', auth], ['0007', users]]) {
    const outsideQuotes = sql.replace(/'(?:[^']|'')*'/g, "''").replace(/"[^"]*"/g, '""').replace(/--[^\n]*/g, '');
    const bare = outsideQuotes.match(new RegExp(`\\b(?:${schemas.join('|')})\\.[a-z_]+`, 'g'));
    assert.equal(bare, null, `${name}: ${bare?.join(', ')}`);
  }
});

function database(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('CREATE TABLE "public.hymn_titles" ("hymn_key" TEXT PRIMARY KEY) STRICT');
  db.exec(auth);
  db.exec(users);
  return db;
}

const USER = '11111111-1111-4111-8111-111111111111';
const STAMP = '2026-10-20T19:52:43.123456+00:00';

test('the tables take defaults, checks and updated_at the way Postgres does', () => {
  const db = database();
  db.prepare('INSERT INTO "auth.users" ("id", "name", "email", "created_at", "updated_at") VALUES (?, ?, ?, ?, ?)').run(USER, 'A', 'a@example.com', STAMP, STAMP);
  db.prepare('INSERT INTO "public.sermon_plans" ("user_id", "document_key", "service_date") VALUES (?, ?, ?)').run(USER, 'liturgy', '2026-10-25');
  const row = db.prepare('SELECT * FROM "public.sermon_plans"').get() as Record<string, string>;
  assert.match(row.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.match(row.created_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?\+00:00$/);
  assert.equal(row.highlights, '[]');

  db.prepare('UPDATE "public.sermon_plans" SET "updated_at" = ? WHERE "id" = ?').run(STAMP, row.id);
  db.prepare('UPDATE "public.sermon_plans" SET "general_notes" = ? WHERE "id" = ?').run('notes', row.id);
  const after = db.prepare('SELECT "updated_at" FROM "public.sermon_plans"').get() as { updated_at: string };
  assert.notEqual(after.updated_at, STAMP, 'an update stamps updated_at');

  assert.throws(() => db.prepare('INSERT INTO "public.sermon_plans" ("user_id", "document_key", "service_date", "highlights") VALUES (?, ?, ?, ?)').run(USER, 'x', '2026-10-26', '{}'), /CHECK/);
  assert.throws(() => db.prepare('INSERT INTO "public.sermon_plans" ("user_id", "document_key", "service_date") VALUES (?, ?, ?)').run('22222222-2222-4222-8222-222222222222', 'x', '2026-10-26'), /FOREIGN KEY/);
  assert.throws(() => db.prepare('INSERT INTO "public.sermon_plans" ("user_id", "document_key", "service_date", "created_at") VALUES (?, ?, ?, ?)').run(USER, 'y', '2026-10-26', '2026-10-20 19:52:43+00'), /CHECK/);
});

test('timestamps: NULL and Supabase\'s forms pass, anything else is refused', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE t (c TEXT CHECK ${timestampCheck('c')})`);
  const accepts = (value: string | null) => { try { db.prepare('INSERT INTO t VALUES (?)').run(value); return true; } catch { return false; } };
  for (const good of [null, '2026-10-20T19:52:43+00:00', '2026-10-20T19:52:43.5+00:00', STAMP]) assert.ok(accepts(good), String(good));
  for (const bad of ['2026-10-20 19:52:43+00', '2026-13-20T19:52:43+00:00', '2026-10-20T19:52:43.12x+00:00', '2026-10-20T19:52:43Z']) assert.ok(!accepts(bad), bad);
});

test('Postgres checks translate to SQLite', () => {
  assert.equal(expressionSql("(app_key = ANY (ARRAY['chc'::text, 'chc_admin'::text]))"), `("app_key" IN ('chc', 'chc_admin'))`);
  assert.equal(expressionSql('(length(TRIM(BOTH FROM title)) > 0)'), '(length(trim("title")) > 0)');
  assert.equal(expressionSql("((jsonb_typeof(marks) = 'object'::text) AND (octet_length((marks)::text) <= 50000))"), `((json_type("marks") = 'object') AND (length(CAST("marks" AS BLOB)) <= 50000))`);
  assert.equal(expressionSql("((content_length <= '5368709120'::bigint))"), '(("content_length" <= 5368709120))');
  assert.equal(expressionSql("((platform !~~ 'custom:%'::text) OR (NULLIF(TRIM(BOTH FROM label), ''::text) IS NOT NULL))"), `(("platform" NOT GLOB 'custom:*') OR (NULLIF(trim("label"), '') IS NOT NULL))`);
  assert.equal(expressionSql('((original_release_date <= (CURRENT_DATE + 365)))'), null, 'a check on today\'s date is left to the Worker');

  const db = new DatabaseSync(':memory:');
  const slug = expressionSql("(slug ~ '^[a-z0-9][a-z0-9_-]*$'::text)")!;
  db.exec(`CREATE TABLE s ("slug" TEXT CHECK ${slug})`);
  for (const [value, ok] of [['great-lent_1', true], ['-lent', false], ['Lent', false], ['a b', false]] as const) {
    let accepted = true;
    try { db.prepare('INSERT INTO s VALUES (?)').run(value); } catch { accepted = false; }
    assert.equal(accepted, ok, value);
  }
});
