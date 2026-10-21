/**
 * bible.search_verses, ported. The same nine arguments and the same rows:
 *
 *   p_query, p_languages (default: all eight renderings), p_mode ('all',
 *   'any', 'phrase', 'websearch'), p_prefix, p_testament, p_book_keys,
 *   p_sort ('relevance' or 'canonical'), p_limit (1-100, default 25),
 *   p_offset; each row the verse, the renderings it matched in, a highlighted
 *   snippet for each, its rank and the total number of matches.
 *
 * Matching, ranking and snippets are Postgres's own algorithms, ported in
 * src/search, over the tsvectors in "bible.verse_search". The FTS5 index only
 * narrows the verses to look at: every candidate is then checked exactly.
 */
import { col, t } from '../db/names.ts';
import { compareText, int4, jsonb, PgError } from '../pg.ts';
import { matches } from '../search/execute.ts';
import { headline } from '../search/headline.ts';
import { searchLiteralContains, searchLiteralNormalize, unaccent } from '../search/normalize.ts';
import { rankCd } from '../search/rank.ts';
import { RENDERINGS, type Language, type Rendering } from '../search/renderings.ts';
import { buildSearchQuery, type QNode, type TsQuery } from '../search/tsquery.ts';
import { parseTsvectorText } from '../search/tsvector.ts';
import type { ContentContext, Row } from '../types.ts';

const DEFAULT_LANGUAGES: Language[] = ['english', 'english_nkjv', 'english_from_coptic', 'coptic', 'greek', 'arabic', 'arabic_from_coptic', 'french'];

/** What the query goes through for each rendering before build_search_query. */
function queryFor(rendering: Rendering, text: string | null): string | null {
  if (rendering.language === 'coptic' || rendering.language === 'greek') return unaccent(text);
  if (rendering.config === 'arabic' || rendering.config === 'french') return searchLiteralNormalize(text);
  return text;
}

const hex = (lexeme: string) => Array.from(new TextEncoder().encode(lexeme), (byte) => byte.toString(16).padStart(2, '0')).join('');

/** The FTS5 condition that every match of the query satisfies; true when there is none (a NOT on its own). */
function ftsCondition(node: QNode): string | true {
  if (node.type === 'val') return `"${hex(node.lexeme)}"${node.prefix ? '*' : ''}`;
  if (node.op === 'not') return true;
  const left = ftsCondition(node.left!);
  const right = ftsCondition(node.right);
  if (node.op === 'or') return left === true || right === true ? true : `(${left} OR ${right})`;
  if (left === true) return right;
  if (right === true) return left;
  return `(${left} AND ${right})`;
}

/**
 * A float4 as Supabase's PostgREST prints it: extra_float_digits is 0 there,
 * so float4out writes %.6g (0.285714, not the shortest exact 0.2857143).
 */
function float4Json(value: number): number {
  return Number(value.toPrecision(6));
}

type Book = { book_key: string; book_order: number; testament: string; title_english: string | null; title_arabic: string | null; toggled: number };
type Hit = { id: number; verse_id: number; book_key: string; chapter_number: number; verse_number: string };

const textArray = (value: unknown, name: string): string[] | null => {
  if (value === null || value === undefined) return null;
  if (!Array.isArray(value)) throw new PgError('22P02', `malformed array literal: "${String(value)}"`, 400, `${name} must be an array`);
  return value.map((item) => (item === null ? null : String(item))) as string[];
};

export async function searchVerses(context: ContentContext, args: Record<string, unknown>): Promise<Row[]> {
  const db = context.db;
  const queryText = args.p_query === null || args.p_query === undefined ? null : String(args.p_query);
  const requested = textArray(args.p_languages, 'p_languages');
  const languages = requested && requested.length ? requested : DEFAULT_LANGUAGES;
  const mode = args.p_mode === null || args.p_mode === undefined ? null : String(args.p_mode);
  const prefix = args.p_prefix === null || args.p_prefix === undefined ? null : Boolean(args.p_prefix);
  const testament = args.p_testament === null || args.p_testament === undefined ? null : String(args.p_testament);
  const bookKeys = textArray(args.p_book_keys, 'p_book_keys');
  const limit = Math.min(Math.max(int4(args.p_limit) ?? 25, 1), 100);
  const offset = Math.max(int4(args.p_offset) ?? 0, 0);
  const canonical = String(args.p_sort ?? 'relevance').toLowerCase() === 'canonical';
  const literal = (mode ?? 'all').toLowerCase() === 'phrase' ? searchLiteralNormalize(queryText) || null : null;

  // One query per selected rendering, built as Postgres builds it.
  const queries = new Map<Language, QNode>();
  for (const rendering of RENDERINGS) {
    if (!languages.includes(rendering.language)) continue;
    const query: TsQuery = buildSearchQuery(queryFor(rendering, queryText), rendering.config, mode, prefix);
    if (query) queries.set(rendering.language, query);
  }
  if (!queries.size) return [];

  // Candidates per rendering from the index, then the exact match on each vector.
  const searched = [...queries];
  const statements = searched.map(([language, query]) => {
    const condition = ftsCondition(query);
    const columns = `s.${col('id')}, s.${col('verse_id')}, s.${col('book_key')}, s.${col('chapter_number')}, s.${col('verse_number')}, s.${col(language)} AS vector`;
    return condition === true
      ? db.prepare(`SELECT ${columns} FROM ${t('bible', 'verse_search')} s`)
      : db.prepare(`SELECT ${columns} FROM ${t('bible', 'verse_search')} s WHERE s.${col('id')} IN (SELECT rowid FROM ${t('bible', 'verse_search_fts')} WHERE ${t('bible', 'verse_search_fts')} MATCH ?)`).bind(`${language} : (${condition})`);
  });
  const results = await db.batch<Hit & { vector: string }>([...statements, db.prepare(`SELECT ${['book_key', 'book_order', 'testament', 'title_english', 'title_arabic', 'toggled'].map(col).join(', ')} FROM ${t('bible', 'books')}`)]);
  const books = new Map((results[results.length - 1].results as unknown as Book[]).map((book) => [book.book_key, book]));

  // vec @@ q, per verse and rendering, with each rendering's rank.
  const verses = new Map<number, Hit & { ranks: Map<Language, number> }>();
  searched.forEach(([language, query], index) => {
    for (const row of results[index].results) {
      const vector = parseTsvectorText(row.vector);
      if (!matches(vector, query)) continue;
      const entry = verses.get(row.verse_id) ?? { id: row.id, verse_id: row.verse_id, book_key: row.book_key, chapter_number: row.chapter_number, verse_number: row.verse_number, ranks: new Map() };
      entry.ranks.set(language, canonical ? 0 : rankCd(vector, query, 32));
      verses.set(row.verse_id, entry);
    }
  });

  // The verse's text, for the phrase test and for snippets.
  const texts = new Map<number, Row>();
  const loadTexts = async (ids: number[]) => {
    const missing = ids.filter((id) => !texts.has(id));
    if (!missing.length) return;
    const columns = RENDERINGS.filter((r) => queries.has(r.language)).map((r) => col(r.column));
    const { results: rows } = await db.prepare(`SELECT ${col('verse_id')}, ${columns.join(', ')} FROM ${t('bible', 'verses')} WHERE ${col('verse_id')} IN (SELECT value FROM json_each(?))`).bind(JSON.stringify(missing)).all<Row>();
    for (const row of rows) texts.set(row.verse_id as number, row);
  };
  if (literal !== null) await loadTexts([...verses.keys()]);

  // A rendering counts as matched when its vector matches and, in phrase mode, its text holds the phrase.
  const matchedIn = (verse: Hit & { ranks: Map<Language, number> }) => RENDERINGS
    .filter((r) => verse.ranks.has(r.language) && (literal === null || searchLiteralContains(texts.get(verse.verse_id)?.[r.column] as string | null, literal)))
    .map((r) => r.language);

  const candidates = [...verses.values()].filter((verse) => {
    if (!matchedIn(verse).length) return false;
    const book = books.get(verse.book_key);
    if (!book || !book.toggled) return false;
    if (testament !== null && book.testament !== testament) return false;
    if (bookKeys && bookKeys.length && !bookKeys.includes(verse.book_key)) return false;
    return true;
  }).map((verse) => {
    const digits = verse.verse_number.replace(/\D/g, '');
    return { ...verse, rank: canonical ? 0 : Math.max(0, ...verse.ranks.values()), verseSort: digits === '' ? null : Number(digits), book: books.get(verse.book_key)! };
  });

  candidates.sort((a, b) => (canonical ? 0 : b.rank - a.rank)
    || a.book.book_order - b.book.book_order
    || a.chapter_number - b.chapter_number
    || (a.verseSort === null ? (b.verseSort === null ? 0 : -1) : b.verseSort === null ? 1 : a.verseSort - b.verseSort)
    || compareText(a.verse_number, b.verse_number));

  const total = candidates.length;
  const page = candidates.slice(offset, offset + limit);
  await loadTexts(page.map((verse) => verse.verse_id));

  return page.map((verse) => {
    const text = texts.get(verse.verse_id) ?? {};
    const langs: Language[] = [];
    const snippets: Record<string, string> = {};
    for (const rendering of RENDERINGS) {
      const query = queries.get(rendering.language);
      const body = rendering.headlineBody((text[rendering.column] as string | null) ?? null);
      if (!query || body === null || !verse.ranks.has(rendering.language)) continue;
      if (!searchLiteralContains(text[rendering.column] as string | null, literal)) continue;
      langs.push(rendering.language);
      snippets[rendering.language] = headline(rendering.config, body, query);
    }
    return {
      book_key: verse.book_key,
      book_order: verse.book.book_order,
      testament: verse.book.testament,
      title_english: verse.book.title_english,
      title_arabic: verse.book.title_arabic,
      chapter_number: verse.chapter_number,
      verse_number: verse.verse_number,
      matched_languages: langs.length ? langs : null,
      snippets: langs.length ? jsonb(snippets) : null,
      rank: float4Json(verse.rank),
      total_count: total,
    };
  });
}
