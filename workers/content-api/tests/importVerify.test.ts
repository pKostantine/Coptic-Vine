import assert from 'node:assert/strict';
import { test } from 'node:test';
import { insertStatements, literal } from '../scripts/import.ts';
import { canonicalLine, canonicalValue, tableChecksum } from '../scripts/lib/canonical.ts';
import type { TableInfo } from '../scripts/lib/schema.ts';

const table: TableInfo = {
  schema: 'liturgy', table: 'hymn_texts', public: true, dropped: [], rowKey: ['line_id'], hasPrimaryKey: true, parents: [], validators: [],
  columns: [
    { name: 'line_id', kind: 'float8', pgType: 'double precision', notNull: true },
    { name: 'line_order', kind: 'numeric', pgType: 'numeric', notNull: false },
    { name: 'arabic', kind: 'text', pgType: 'text', notNull: false },
    { name: 'inline_hymn_title_shown', kind: 'boolean', pgType: 'boolean', notNull: false },
  ],
};

test('a value is written to D1 exactly, or the import stops', () => {
  const column = (name: string) => table.columns.find((c) => c.name === name)!;
  assert.equal(literal({ line_order: 21.5, line_order__raw: '21.50' }, column('line_order'), 'row'), '21.5');
  assert.equal(literal({ line_order: 3, line_order__raw: '3.000000000000000000000000' }, column('line_order'), 'row'), '3');
  assert.throws(() => literal({ line_order: 0.12345678901234568, line_order__raw: '0.12345678901234567890' }, column('line_order'), 'row'), /would change/);
  assert.equal(literal({ arabic: "قال: 'آمين'" }, column('arabic'), 'row'), "'قال: ''آمين'''");
  assert.equal(literal({ inline_hymn_title_shown: false }, column('inline_hymn_title_shown'), 'row'), '0');
  assert.throws(() => literal({ line_id: null }, column('line_id'), 'row'), /NOT NULL/);
});

test('inserts stay under D1\'s 100 KB statement limit', () => {
  const rows = Array.from({ length: 2000 }, (_, i) => ({ line_id: i + 1, line_id__raw: String(i + 1), line_order: null, arabic: 'ⲁ'.repeat(200), inline_hymn_title_shown: true }));
  const statements = insertStatements(table, rows);
  assert.ok(statements.length > 1);
  for (const statement of statements) assert.ok(Buffer.byteLength(statement) < 100_000);
  assert.equal(statements.join('').split('\n(').length - 1, 2000);
});

test('the canonical form matches Postgres: to_json(text), numbers as printed, booleans as words', () => {
  assert.equal(canonicalValue('a "quote" \\ tab\there\nⲁⲣⲓ ϩⲙⲟⲧ', 'text'), '"a \\"quote\\" \\\\ tab\\there\\nⲁⲣⲓ ϩⲙⲟⲧ"');
  assert.equal(canonicalValue('\u0001', 'text'), '"\\u0001"');
  assert.equal(canonicalValue(21.5, 'numeric'), '21.5');
  assert.equal(canonicalValue(1, 'boolean'), 'true');
  assert.equal(canonicalLine({ line_id: 7, line_order: null, arabic: 'آمين', inline_hymn_title_shown: 0 }, table), '[7,null,"آمين",false]');
});

test('a table checksum does not depend on row order', () => {
  assert.equal(tableChecksum(['[2,"b"]', '[1,"a"]']), tableChecksum(['[1,"a"]', '[2,"b"]']));
  assert.notEqual(tableChecksum(['[1,"a"]']), tableChecksum(['[1,"b"]']));
});
