/**
 * Rebuilds the Bible search index ("bible.verse_search" and its FTS5 table,
 * migrations/0002_bible_search.sql) from "bible.verses" in D1. Run it after
 * any change to the Bible's text; import.ts runs it whenever it reloads
 * bible.verses.
 *
 *   npm run build-search [-- --local] [-- --dry-run]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { col, t } from '../src/db/names.ts';
import { RENDERINGS, renderingVector } from '../src/search/renderings.ts';
import { tsvectorText } from '../src/search/tsvector.ts';
import { executeFile, query, type Target } from './lib/d1.ts';

const MAX_STATEMENT_BYTES = 90_000;
const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
const hex = (lexeme: string) => Buffer.from(lexeme, 'utf8').toString('hex');

/** The index statements for every verse: the vectors, and their lexemes as FTS tokens. */
export function searchIndexSql(verses: Record<string, unknown>[]): string[] {
  const statements = [`DELETE FROM ${t('bible', 'verse_search_fts')};`, `DELETE FROM ${t('bible', 'verse_search')};`];
  const searchHead = `INSERT INTO ${t('bible', 'verse_search')} (${['id', 'verse_id', 'book_key', 'chapter_number', 'verse_number', ...RENDERINGS.map((r) => r.language)].map(col).join(', ')}) VALUES\n`;
  const ftsHead = `INSERT INTO ${t('bible', 'verse_search_fts')} (rowid, ${RENDERINGS.map((r) => r.language).join(', ')}) VALUES\n`;
  const batches = { search: [] as string[], fts: [] as string[] };
  const sizes = { search: 0, fts: 0 };
  const flush = (kind: 'search' | 'fts') => {
    if (batches[kind].length) statements.push(`${kind === 'search' ? searchHead : ftsHead}${batches[kind].join(',\n')};`);
    batches[kind] = [];
    sizes[kind] = 0;
  };
  const add = (kind: 'search' | 'fts', tuple: string) => {
    const size = Buffer.byteLength(tuple) + 2;
    if (sizes[kind] + size > MAX_STATEMENT_BYTES) flush(kind);
    batches[kind].push(tuple);
    sizes[kind] += size;
  };
  verses.forEach((verse, index) => {
    const id = index + 1;
    const vectors = RENDERINGS.map((rendering) => renderingVector(rendering, verse[rendering.column] as string | null));
    add('search', `(${id}, ${verse.verse_id}, ${quote(String(verse.book_key))}, ${verse.chapter_number}, ${quote(String(verse.verse_number))}, ${vectors.map((v) => quote(tsvectorText(v))).join(', ')})`);
    add('fts', `(${id}, ${vectors.map((v) => quote(v.map((entry) => hex(entry.lexeme)).join(' '))).join(', ')})`);
  });
  flush('search');
  flush('fts');
  return statements;
}

function readVerses(target: Target): Record<string, unknown>[] {
  const columns = [...new Set(['verse_id', 'book_key', 'chapter_number', 'verse_number', ...RENDERINGS.map((r) => r.column)])];
  const verses: Record<string, unknown>[] = [];
  for (let after = 0; ;) {
    const page = query<Record<string, unknown>>(target, `SELECT rowid AS "__rowid", ${columns.map(col).join(', ')} FROM ${t('bible', 'verses')} WHERE rowid > ${after} ORDER BY rowid LIMIT 5000`);
    verses.push(...page);
    if (page.length < 5000) break;
    after = page[page.length - 1].__rowid as number;
  }
  return verses;
}

export function buildSearch(target: Target, dryRun = false): string {
  const verses = readVerses(target);
  const started = Date.now();
  const sql = `${searchIndexSql(verses).join('\n')}\n`;
  const dir = fileURLToPath(new URL('../.wrangler/import/', import.meta.url));
  mkdirSync(dir, { recursive: true });
  const file = `${dir}search-${new Date().toISOString().replace(/[:.]/g, '-')}.sql`;
  writeFileSync(file, sql);
  console.log(`Search index for ${verses.length} verses: ${(Buffer.byteLength(sql) / 1024 / 1024).toFixed(1)} MB of SQL, computed in ${((Date.now() - started) / 1000).toFixed(1)} s (${file}).`);
  if (!dryRun) executeFile(target, file);
  return file;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  buildSearch(args.includes('--local') ? 'local' : 'remote', args.includes('--dry-run'));
}
