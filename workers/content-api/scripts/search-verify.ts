/**
 * Proves the TypeScript text-search pipeline (src/search) turns every verse
 * into exactly the tsvector Supabase's Postgres makes: same lexemes, same
 * positions, in all eight renderings.
 *
 *   npm run search-verify -- --print-pg-sql > pg.sql      run it read-only, save the JSON as pg.json
 *   npm run search-verify -- --pg pg.json [--local]       compare, book by book
 *   npm run search-verify -- --print-pg-book-sql <lang> <book_key>   one book's vectors, to see a difference
 *
 * Postgres's side is what search_verses actually reads: the generated fts_*
 * columns of bible.verses, and bible.verse_search_normalized for Arabic and
 * French. Lines are "verse_id<TAB>tsvector", sorted by bytes, hashed per book.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { col, t } from '../src/db/names.ts';
import { RENDERINGS, renderingVector } from '../src/search/renderings.ts';
import { tsvectorText } from '../src/search/tsvector.ts';
import { query, type Target } from './lib/d1.ts';

const PG_VECTOR: Record<string, string> = {
  english: 'v.fts_english', english_nkjv: 'v.fts_english_nkjv', english_from_coptic: 'v.fts_english_from_coptic',
  coptic: 'v.fts_coptic', greek: 'v.fts_greek', arabic: 's.fts_arabic', arabic_from_coptic: 's.fts_arabic_from_coptic', french: 's.fts_french',
};

function pgSql(): string {
  const parts = RENDERINGS.map(({ language }) =>
    `select '${language}' as lang, v.book_key, encode(sha256(convert_to(string_agg(line, E'\\n' order by line collate "C"), 'UTF8')), 'hex') as h
     from (select v.book_key, v.verse_id::float8::text || E'\\t' || coalesce(${PG_VECTOR[language]}::text, '') as line
           from "bible"."verses" v left join "bible"."verse_search_normalized" s on s.verse_id = v.verse_id) v group by v.book_key`);
  return `set extra_float_digits = 1;\nselect json_object_agg(lang || '/' || book_key, h) as hashes from (\n${parts.join('\nunion all\n')}\n) x;\n`;
}

function pgBookSql(language: string, bookKey: string): string {
  return `set extra_float_digits = 1;\nselect json_object_agg(v.verse_id::float8::text, coalesce(${PG_VECTOR[language]}::text, '')) as vectors from "bible"."verses" v left join "bible"."verse_search_normalized" s on s.verse_id = v.verse_id where v.book_key = '${bookKey.replaceAll("'", "''")}';\n`;
}

function hashLines(lines: string[]): string {
  const sorted = lines.map((line) => Buffer.from(line, 'utf8')).sort(Buffer.compare);
  const hash = createHash('sha256');
  sorted.forEach((line, index) => { if (index) hash.update('\n'); hash.update(line); });
  return hash.digest('hex');
}

function main() {
  const args = process.argv.slice(2);
  const option = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
  if (args.includes('--print-pg-sql')) { process.stdout.write(pgSql()); return; }
  if (args.includes('--print-pg-book-sql')) { process.stdout.write(pgBookSql(option('--print-pg-book-sql')!, args[args.indexOf('--print-pg-book-sql') + 2])); return; }
  const target: Target = args.includes('--local') ? 'local' : 'remote';
  const pg: Record<string, string> = JSON.parse(readFileSync(option('--pg')!, 'utf8'));
  const columns = ['verse_id', 'book_key', ...RENDERINGS.map((r) => r.column)];
  const verses: Record<string, unknown>[] = [];
  for (let after = 0; ;) {
    const page = query<Record<string, unknown>>(target, `SELECT rowid AS "__rowid", ${[...new Set(columns)].map(col).join(', ')} FROM ${t('bible', 'verses')} WHERE rowid > ${after} ORDER BY rowid LIMIT 5000`);
    verses.push(...page);
    if (page.length < 5000) break;
    after = page[page.length - 1].__rowid as number;
  }
  const started = Date.now();
  const lines = new Map<string, string[]>();
  const vectors = new Map<string, string>();
  for (const verse of verses) {
    for (const rendering of RENDERINGS) {
      const text = tsvectorText(renderingVector(rendering, verse[rendering.column] as string | null));
      const key = `${rendering.language}/${verse.book_key}`;
      lines.set(key, [...(lines.get(key) || []), `${verse.verse_id}\t${text}`]);
      vectors.set(`${rendering.language}/${verse.verse_id}`, text);
    }
  }
  const differing = [...lines].filter(([key, bookLines]) => pg[key] !== hashLines(bookLines)).map(([key]) => key);
  console.log(`${verses.length} verses, ${RENDERINGS.length} renderings: ${lines.size - differing.length} of ${lines.size} book/rendering groups identical to Postgres (${((Date.now() - started) / 1000).toFixed(1)} s to compute).`);
  if (differing.length) {
    console.log(`Different: ${differing.join(', ')}`);
    const book = option('--book-json');
    if (book) {
      // A book's vectors from --print-pg-book-sql, compared verse by verse.
      const [language] = option('--book-lang')!.split('/');
      const pgVectors: Record<string, string> = JSON.parse(readFileSync(book, 'utf8'));
      for (const [verseId, text] of Object.entries(pgVectors)) {
        const mine = vectors.get(`${language}/${verseId}`);
        if (mine !== text) console.log(`${verseId}\n  pg: ${text}\n  ts: ${mine}`);
      }
    }
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
