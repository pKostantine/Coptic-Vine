/**
 * The Bible functions the app calls, ported from Postgres with the same
 * arguments and the same JSON:
 *   bible.get_book_key_by_calendar_number, bible.get_verse_part_by_calendar,
 *   public.get_bible_books, public.get_bible_chapter_list,
 * and public.get_reading_text, which get_readings_for_date calls inside.
 */
import { col, t } from '../db/names.ts';
import { btrim, int4, jsonb, PgError } from '../pg.ts';
import type { ContentContext, Row } from '../types.ts';

export async function getBookKeyByCalendarNumber(context: ContentContext, calendarNumber: number | null): Promise<string | null> {
  if (calendarNumber === null) return null;
  const row = await context.db
    .prepare(`SELECT ${col('book_key')} FROM ${t('bible', 'book_number_aliases')} WHERE ${col('number_system')} = 'calendar_reference' AND ${col('book_number')} = ? LIMIT 1`)
    .bind(calendarNumber)
    .first<{ book_key: string }>();
  return row?.book_key ?? null;
}

const VERSE_PART_COLUMNS = ['book_key', 'chapter_number', 'verse_number', 'part_label', 'english', 'coptic', 'arabic'];

export async function getVersePartByCalendar(context: ContentContext, bookNumber: number | null, chapter: number | null, verse: number | null, partLabel: string | null): Promise<Row[]> {
  const bookKey = await getBookKeyByCalendarNumber(context, bookNumber);
  if (bookKey === null || chapter === null || verse === null || partLabel === null) return [];
  const { results } = await context.db
    .prepare(`SELECT ${VERSE_PART_COLUMNS.map(col).join(', ')} FROM ${t('bible', 'verse_parts')} WHERE ${col('book_key')} = ? AND ${col('chapter_number')} = ? AND ${col('verse_number')} = ? AND ${col('part_label')} = ?`)
    .bind(bookKey, chapter, verse, partLabel.toLowerCase())
    .all<Row>();
  return results;
}

export async function getBibleBooks(context: ContentContext): Promise<Row[]> {
  const columns = ['book_key', 'book_order', 'testament', 'title_english', 'title_arabic', 'title_coptic', 'title_greek', 'title_french', 'aliases_json'];
  const { results } = await context.db.prepare(`SELECT ${columns.map(col).join(', ')} FROM ${t('bible', 'books')} ORDER BY ${col('book_order')}`).all<Row>();
  return results.map((row) => ({ ...row, aliases_json: JSON.parse(String(row.aliases_json)) }));
}

export async function getBibleChapterList(context: ContentContext, bookKey: string | null): Promise<Row[]> {
  const { results } = await context.db
    .prepare(`SELECT ${col('chapter_number')}, count(*) AS ${col('verse_count')} FROM ${t('bible', 'verses')} WHERE ${col('book_key')} = ? GROUP BY ${col('chapter_number')} ORDER BY ${col('chapter_number')}`)
    .bind(bookKey)
    .all<Row>();
  return results;
}

/**
 * Postgres today: bible.verses.verse_number became text, but get_reading_text
 * and bible.get_verses_by_range still compare it with integers. Every branch
 * that reads bible.verses fails with "operator does not exist", and the
 * function's exception handler returns that error for the whole reference.
 * Only references made entirely of verse parts (19.72:23b) resolve. The app
 * replaces resolved_verses with its own resolution, so nobody sees this; it
 * is reproduced here so the Worker answers exactly as Supabase does.
 * Setting this to false resolves the verses as the function intends (and
 * makes parity fail until Supabase is fixed the same way).
 */
export const REPRODUCE_TEXT_VERSE_NUMBER_BUG = true;

/** substring(text FROM pattern): the first group, or null. Postgres's . also matches newlines. */
const capture = (text: string | null, pattern: RegExp) => (text === null ? null : text.match(pattern)?.[1] ?? null);

export async function getReadingText(context: ContentContext, reference: string | null): Promise<unknown[]> {
  if (reference === null || btrim(reference) === '') return [];
  try {
    const segments = reference.split(/\*@\+|@/).map(btrim).filter((segment) => segment !== '');
    if (!segments.length) throw new PgError('22004', 'FOREACH expression must not be null');
    const result: unknown[] = [];
    for (const segment of segments) {
      const bookNumber = int4(capture(segment, /^(\d+)\./));
      const rest = capture(segment, /^\d+\.([\s\S]*)$/);
      const startChapter = int4(capture(rest, /^(\d+):/));
      const versePart = capture(rest, /^\d+:([\s\S]*)$/);
      const bookKey = await getBookKeyByCalendarNumber(context, bookNumber);
      let verses: unknown[];
      if (versePart !== null && /,/.test(versePart)) {
        if (REPRODUCE_TEXT_VERSE_NUMBER_BUG) throw new PgError('42883', 'operator does not exist: text = integer');
        verses = await verseList(context, bookKey, bookNumber, startChapter, versePart);
      } else if (versePart !== null && /^\d+-\d+:\d+$/.test(versePart)) {
        const startVerse = int4(capture(versePart, /^(\d+)-/));
        const endChapter = int4(capture(versePart, /-(\d+):/));
        const endVerse = int4(capture(versePart, /:(\d+)$/));
        if (REPRODUCE_TEXT_VERSE_NUMBER_BUG) throw new PgError('42883', 'operator does not exist: text >= integer');
        verses = await verseRange(context, bookKey, startChapter, startVerse, endChapter, endVerse);
      } else if (versePart !== null && /^\d+-\d+$/.test(versePart)) {
        const startVerse = int4(capture(versePart, /^(\d+)-/));
        const endVerse = int4(capture(versePart, /-(\d+)$/));
        if (REPRODUCE_TEXT_VERSE_NUMBER_BUG) throw new PgError('42883', 'operator does not exist: text >= integer');
        verses = await verseRange(context, bookKey, startChapter, startVerse, startChapter, endVerse);
      } else if (versePart !== null && /^\d+[a-z]$/.test(versePart)) {
        const startVerse = int4(capture(versePart, /^(\d+)/));
        const parts = await getVersePartByCalendar(context, bookNumber, startChapter, startVerse, capture(versePart, /([a-z])$/));
        verses = parts.map((part) => partObject(part));
      } else {
        const startVerse = int4(versePart);
        if (REPRODUCE_TEXT_VERSE_NUMBER_BUG) throw new PgError('42883', 'operator does not exist: text = integer');
        verses = await verseRange(context, bookKey, startChapter, startVerse, startChapter, startVerse);
      }
      result.push(jsonb({ segment, book_key: bookKey, start_chapter: startChapter, verses }));
    }
    return result;
  } catch (error) {
    // EXCEPTION WHEN OTHERS: the whole reference becomes one error entry.
    const message = error instanceof PgError ? error.message : String(error);
    return [jsonb({ segment: reference, error: message })];
  }
}

function verseObject(verse: Row): Row {
  return jsonb({ chapter_number: verse.chapter_number, verse_number: verse.verse_number, english: verse.english, coptic: verse.coptic, arabic: verse.arabic, french: verse.french });
}

function partObject(part: Row): Row {
  return jsonb({ chapter_number: part.chapter_number, verse_number: part.verse_number, part_label: part.part_label, english: part.english, coptic: part.coptic, arabic: part.arabic, french: null });
}

/** The verses from start to end, as get_reading_text means to read them (used once the verse_number bug is fixed). */
async function verseRange(context: ContentContext, bookKey: string | null, startChapter: number | null, startVerse: number | null, endChapter: number | null, endVerse: number | null): Promise<Row[]> {
  const { results } = await context.db
    .prepare(`SELECT ${['chapter_number', 'verse_number', 'english', 'coptic', 'arabic', 'french'].map(col).join(', ')} FROM ${t('bible', 'verses')}
      WHERE ${col('book_key')} = ?1
        AND (${col('chapter_number')} > ?2 OR (${col('chapter_number')} = ?2 AND CAST(${col('verse_number')} AS INTEGER) >= ?3))
        AND (?4 IS NULL OR ${col('chapter_number')} < ?4 OR (${col('chapter_number')} = ?4 AND CAST(${col('verse_number')} AS INTEGER) <= coalesce(?5, 999)))
      ORDER BY ${col('chapter_number')}, CAST(${col('verse_number')} AS INTEGER)`)
    .bind(bookKey, startChapter, startVerse, endChapter, endVerse)
    .all<Row>();
  return results.map(verseObject);
}

async function verseList(context: ContentContext, bookKey: string | null, bookNumber: number | null, chapter: number | null, list: string): Promise<Row[]> {
  const out: Row[] = [];
  for (const token of list.split(',')) {
    if (/^\d+$/.test(token)) out.push(...(await verseRange(context, bookKey, chapter, Number(token), chapter, Number(token))));
    else if (/^\d+[a-z]$/.test(token)) {
      const parts = await getVersePartByCalendar(context, bookNumber, chapter, Number(token.slice(0, -1)), token.slice(-1));
      out.push(...parts.map(partObject));
    }
  }
  return out;
}
