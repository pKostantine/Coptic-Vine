/**
 * Every D1 table name is "schema.table" in double quotes. Unquoted, SQLite
 * reads liturgy.hymn_texts as a table in an attached database called liturgy,
 * and the query fails with "no such table" only when it runs. This test reads
 * every SQL file and every string in the Worker's code and scripts, and fails
 * on a copied table or view named without its quotes.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { col, t } from '../src/db/names.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const schema = JSON.parse(readFileSync(join(root, 'schema/content-tables.json'), 'utf8'));
const relations = new Set<string>([...schema.tables, ...schema.views].map((r: { schema: string; table: string }) => `${r.schema}.${r.table}`));

function files(dir: string, extensions: string[]): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'node_modules' || name === '.wrangler' ? [] : files(path, extensions);
    return extensions.some((extension) => name.endsWith(extension)) ? [path] : [];
  });
}

/** The text inside a TypeScript file's strings and template literals, with comments and code left out. */
export function stringContents(source: string): string[] {
  const out: string[] = [];
  let i = 0;
  const templateDepth: number[] = [];
  let braces = 0;
  while (i < source.length) {
    const c = source[i];
    const next = source[i + 1];
    if (c === '/' && next === '/') { i = source.indexOf('\n', i); if (i < 0) break; continue; }
    if (c === '/' && next === '*') { i = source.indexOf('*/', i + 2) + 2; if (i < 2) break; continue; }
    if (c === '{') { braces += 1; i += 1; continue; }
    if (c === '}' && templateDepth.length && templateDepth[templateDepth.length - 1] === braces) {
      templateDepth.pop();
      i = readTemplate(i + 1);
      continue;
    }
    if (c === '}') { braces -= 1; i += 1; continue; }
    if (c === '\'' || c === '"') {
      let j = i + 1;
      let text = '';
      while (j < source.length && source[j] !== c) {
        if (source[j] === '\\') { text += source[j + 1]; j += 2; continue; }
        text += source[j];
        j += 1;
      }
      out.push(text);
      i = j + 1;
      continue;
    }
    if (c === '`') { i = readTemplate(i + 1); continue; }
    i += 1;
  }
  return out;

  function readTemplate(start: number): number {
    let j = start;
    let text = '';
    while (j < source.length && source[j] !== '`') {
      if (source[j] === '\\') { text += source[j + 1]; j += 2; continue; }
      if (source[j] === '$' && source[j + 1] === '{') {
        out.push(text);
        templateDepth.push(braces);
        return j + 2;
      }
      text += source[j];
      j += 1;
    }
    out.push(text);
    return j + 1;
  }
}

function withoutSqlComments(sql: string): string {
  return sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Copied relations named without their quotes. */
export function unquotedNames(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(/([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)/g)) {
    const name = `${match[1]}.${match[2]}`;
    if (!relations.has(name)) continue;
    const before = text[match.index - 1];
    const after = text[match.index + name.length];
    if (before === '"' && after === '"') continue;
    if (before && /[\w.]/.test(before)) continue;
    found.push(name);
  }
  return found;
}

test('t() quotes schema.table and refuses anything that is not a plain name', () => {
  assert.equal(t('liturgy', 'hymn_texts'), '"liturgy.hymn_texts"');
  assert.equal(col('line_order'), '"line_order"');
  assert.throws(() => t('liturgy', 'hymn_texts" ; DROP TABLE x; --'));
  assert.throws(() => t('Liturgy', 'hymn_texts'));
  assert.throws(() => t('liturgy', ''));
});

test('the check itself finds unquoted names, in SQL and in code strings', () => {
  assert.deepEqual(unquotedNames('SELECT * FROM liturgy.hymn_texts WHERE x'), ['liturgy.hymn_texts']);
  assert.deepEqual(unquotedNames('SELECT * FROM "liturgy.hymn_texts" t JOIN bible.verses v'), ['bible.verses']);
  assert.deepEqual(unquotedNames('e.entry_key, b.book_key, liturgy.not_a_table'), []);
  const code = 'const a = `SELECT * FROM ${t("bible", "verses")} JOIN calendar.season_ranges`; // bible.books is fine here\nconst b = "x";';
  assert.deepEqual(stringContents(code).flatMap(unquotedNames), ['calendar.season_ranges']);
});

test('no SQL file names a table without its quotes', () => {
  for (const path of files(root, ['.sql'])) {
    if (path.endsWith('schema/pg-catalog.sql')) continue; // Postgres, not D1
    const found = unquotedNames(withoutSqlComments(readFileSync(path, 'utf8')));
    assert.deepEqual(found, [], `${relative(root, path)} has unquoted table names`);
  }
});

test('no string in the Worker or its scripts names a table without its quotes', () => {
  // Tests are left out: they name Postgres tables as plain strings on purpose.
  for (const path of [...files(join(root, 'src'), ['.ts', '.mjs', '.js']), ...files(join(root, 'scripts'), ['.ts', '.mjs', '.js'])]) {
    const found = stringContents(readFileSync(path, 'utf8')).flatMap(unquotedNames);
    assert.deepEqual(found, [], `${relative(root, path)} has unquoted table names; build them with t(schema, table)`);
  }
});
