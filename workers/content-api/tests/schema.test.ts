import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { generate } from '../scripts/gen-schema.ts';

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
