import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { generate } from '../scripts/gen-schema.ts';
import { contentSchema } from '../scripts/lib/schema.ts';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('the migration and table list match the catalog snapshot (npm run gen:schema)', () => {
  const { migration, schema } = generate(JSON.parse(read('schema/pg-catalog.json')));
  assert.equal(read('migrations/0001_content_schema.sql'), migration);
  assert.equal(read('schema/content-tables.json'), `${JSON.stringify(schema, null, 1)}\n`);
});

test('the copy leaves out what section 4.1 of the plan keeps in Supabase', () => {
  const { schema } = generate(JSON.parse(read('schema/pg-catalog.json')));
  const names = new Set(schema.tables.map((table) => `${table.schema}.${table.table}`));
  for (const excluded of ['bible.new_coptic_psalter_translation', 'bible.verse_search_normalized', 'synaxarium.entries_old', 'gospel_responses.hymn_texts_old', 'calendar.psalms_reading_ref_map_20260827']) {
    assert.ok(!names.has(excluded), `${excluded} must not be copied`);
  }
  for (const schemaName of ['creator', 'learning', 'media', 'music', 'private', 'backup', 'offline_content']) {
    assert.ok(![...names].some((name) => name.startsWith(`${schemaName}.`)), `${schemaName} is not Phase 1 content`);
  }
  assert.deepEqual([...names].filter((name) => name.startsWith('public.')).sort(), ['public.hymn_texts', 'public.hymn_titles', 'public.saint_order']);
});

test('every hymn_texts table gains drop_cap in migrations/0032, 0 unless set to 1', () => {
  const { schema } = generate(JSON.parse(read('schema/pg-catalog.json')));
  const hymnTexts = schema.tables.filter((table) => table.table === 'hymn_texts');
  assert.equal(hymnTexts.length, 19);
  const db = new DatabaseSync(':memory:');
  db.exec(read('migrations/0001_content_schema.sql'));
  db.exec(read('migrations/0032_drop_cap.sql'));
  for (const table of hymnTexts) {
    assert.deepEqual(table.columns.at(-1), { name: 'drop_cap', kind: 'boolean', pgType: 'boolean', notNull: true, addedInD1: '0032_drop_cap.sql' });
    const columns = db.prepare(`SELECT name, type, "notnull", dflt_value FROM pragma_table_info('${table.schema}.${table.table}')`).all() as { name: string }[];
    assert.deepEqual(columns.map((column) => column.name), table.columns.map((column) => column.name), `${table.schema}.hymn_texts`);
    assert.deepEqual({ ...columns.at(-1) }, { name: 'drop_cap', type: 'INTEGER', notnull: 1, dflt_value: '0' });
  }
  db.exec(`INSERT INTO "liturgy.hymn_titles" ("hymn_key") VALUES ('h')`);
  db.exec(`INSERT INTO "liturgy.hymn_texts" ("line_id", "hymn_key") VALUES (1, 'h')`);
  assert.equal((db.prepare(`SELECT "drop_cap" FROM "liturgy.hymn_texts"`).get() as { drop_cap: number }).drop_cap, 0);
  assert.throws(() => db.exec(`UPDATE "liturgy.hymn_texts" SET "drop_cap" = 2`), /CHECK constraint failed/);
  // Supabase's frozen copy hasn't got it, so import and verify leave it out.
  assert.ok(!contentSchema.tables.some((table) => table.columns.some((column) => column.name === 'drop_cap')));
});
