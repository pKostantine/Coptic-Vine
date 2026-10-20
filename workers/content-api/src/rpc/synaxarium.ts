/**
 * The Synaxarium functions the app calls, ported from Postgres:
 *   synaxarium.get_day_json (with synaxarium.get_intro, the day's opening
 *   blessing, which is generated and never stored),
 *   public.get_home_synaxarium_events, public.get_synaxarium_year.
 */
import { col, t } from '../db/names.ts';
import { jsonb, trimmedOrNull } from '../pg.ts';
import type { ContentContext, Row } from '../types.ts';

const ORDINALS_ARABIC = [
  'الأول', 'الثانى', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر',
  'الحادى عشر', 'الثانى عشر', 'الثالث عشر', 'الرابع عشر', 'الخامس عشر', 'السادس عشر', 'السابع عشر',
  'الثامن عشر', 'التاسع عشر', 'العشرون', 'الحادى والعشرون', 'الثانى والعشرون', 'الثالث والعشرون',
  'الرابع والعشرون', 'الخامس والعشرون', 'السادس والعشرون', 'السابع والعشرون', 'الثامن والعشرون',
  'التاسع والعشرون', 'الثلاثون',
];
const ORDINALS_ENGLISH = [
  'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth',
  'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth',
  'eighteenth', 'nineteenth', 'twentieth', 'twenty first', 'twenty second', 'twenty third',
  'twenty fourth', 'twenty fifth', 'twenty sixth', 'twenty seventh', 'twenty eighth',
  'twenty ninth', 'thirtieth',
];

/** synaxarium.get_intro(p_coptic_month, p_coptic_day): "Today is the first day of the blessed month of …". */
export async function getIntro(context: ContentContext, month: number | null, dayOfMonth: number | null): Promise<Record<string, string> | null> {
  // Nesi (month 13) is the short epagomenal month: 5 days, 6 in a Coptic leap year.
  const [maxDay, switchDay] = month === 13 ? [6, 3] : [30, 15];
  if (dayOfMonth === null || dayOfMonth < 1 || dayOfMonth > maxDay) return null;
  const names = await context.db
    .prepare(`SELECT ${col('coptic_month_name_arabic')}, ${col('coptic_month_name_english')} FROM ${t('synaxarium', 'coptic_days')} WHERE ${col('coptic_month')} = ? LIMIT 1`)
    .bind(month)
    .first<{ coptic_month_name_arabic: string | null; coptic_month_name_english: string | null }>();
  const monthArabic = names?.coptic_month_name_arabic ?? null;
  if (monthArabic === null) return null;
  const monthEnglish = names?.coptic_month_name_english ?? null;
  const [verbArabic, verbEnglish] = dayOfMonth <= switchDay ? ['إستقباله', 'begin it in goodness'] : ['إنقضاؤه', 'end it in goodness'];
  // In Postgres, text || NULL is NULL: an English month name missing makes the English line null.
  const english = monthEnglish === null ? null
    : `Today is the ${ORDINALS_ENGLISH[dayOfMonth - 1]} day of the blessed month of ${monthEnglish}. May God ${verbEnglish} and renew it for us in peace and tranquility, while our `
      + 'sins and iniquities are forgiven through the tender mercies of our Lord, '
      + 'O my fathers and my brethren. Amen.';
  return jsonb({
    arabic: `اليوم ${ORDINALS_ARABIC[dayOfMonth - 1]} من شهر ${monthArabic} المبارك، أحسن الله ${verbArabic}، وأعاده علينا وعليكم ونحن وأنتم في هدوء واطمئنان، مغفوري الخطايا `
      + 'والاثام والزلات، من قبل مراحم الرب يا ابائي وإخوتي. آمين.',
    english,
  }) as Record<string, string>;
}

/** synaxarium.get_day_json(p_date): the day's Synaxarium, or null for a date the calendar doesn't have. */
export async function getDayJson(context: ContentContext, date: string): Promise<unknown> {
  const db = context.db;
  const [days, entries, texts] = await db.batch([
    db.prepare(`SELECT ${['gregorian_date', 'coptic_year', 'coptic_date_label', 'coptic_month', 'coptic_day'].map(col).join(', ')} FROM ${t('calendar', 'coptic_date_conversions')} WHERE ${col('gregorian_date')} = ?`).bind(date),
    db.prepare(`SELECT e.${col('entry_key')}, e.${col('entry_order')}, e.${col('title_english')}, e.${col('title_arabic')} FROM ${t('synaxarium', 'entries')} e
      JOIN ${t('calendar', 'coptic_date_conversions')} d ON e.${col('coptic_month')} = d.${col('coptic_month')} AND e.${col('coptic_day')} = d.${col('coptic_day')}
      WHERE d.${col('gregorian_date')} = ? ORDER BY e.${col('entry_order')} NULLS LAST`).bind(date),
    db.prepare(`SELECT t.${col('entry_key')}, t.${col('line_order')}, t.${col('english')}, t.${col('arabic')} FROM ${t('synaxarium', 'entry_texts')} t
      JOIN ${t('synaxarium', 'entries')} e ON e.${col('entry_key')} = t.${col('entry_key')}
      JOIN ${t('calendar', 'coptic_date_conversions')} d ON e.${col('coptic_month')} = d.${col('coptic_month')} AND e.${col('coptic_day')} = d.${col('coptic_day')}
      WHERE d.${col('gregorian_date')} = ? ORDER BY t.${col('line_order')} NULLS LAST`).bind(date),
  ]);
  const dayRow = days.results[0] as Row | undefined;
  if (!dayRow) return null;
  const textsByEntry = new Map<string, Row[]>();
  for (const text of texts.results as Row[]) {
    const key = String(text.entry_key);
    textsByEntry.set(key, [...(textsByEntry.get(key) || []), text]);
  }
  // string_agg skips nulls, and gives null when nothing is left.
  const joined = (lines: Row[], language: 'english' | 'arabic') => {
    const parts = lines.map((line) => trimmedOrNull(line[language])).filter((part): part is string => part !== null);
    return parts.length ? parts.join('\n\n') : null;
  };
  const entryObjects = (entries.results as Row[]).map((entry) => {
    const lines = textsByEntry.get(String(entry.entry_key)) || [];
    return jsonb({
      entry_key: entry.entry_key,
      entry_order: entry.entry_order,
      title_english: entry.title_english,
      title_arabic: entry.title_arabic,
      // backward-compatible flattened text
      english: joined(lines, 'english'),
      arabic: joined(lines, 'arabic'),
      // one element per paragraph, aligned across languages
      paragraphs: lines.map((line) => jsonb({ line_order: line.line_order, english: trimmedOrNull(line.english), arabic: trimmedOrNull(line.arabic) })),
    });
  });
  return jsonb({
    gregorian_date: dayRow.gregorian_date,
    coptic_year: dayRow.coptic_year,
    coptic_date: dayRow.coptic_date_label,
    intro: await getIntro(context, dayRow.coptic_month as number, dayRow.coptic_day as number),
    entries: entryObjects,
  });
}

/** public.get_home_synaxarium_events(p_date): the day's saints for the home screen. */
export async function getHomeSynaxariumEvents(context: ContentContext, date: string): Promise<unknown[]> {
  const { results } = await context.db
    .prepare(`SELECT e.${col('entry_key')}, e.${col('title_english')}, e.${col('title_arabic')}, e.${col('entry_order')} FROM ${t('calendar', 'coptic_date_conversions')} d
      JOIN ${t('synaxarium', 'entries')} e ON e.${col('coptic_month')} = d.${col('coptic_month')} AND e.${col('coptic_day')} = d.${col('coptic_day')}
      WHERE d.${col('gregorian_date')} = ? ORDER BY e.${col('entry_order')} NULLS LAST`)
    .bind(date)
    .all<Row>();
  return results.map((entry) => jsonb({ entryKey: entry.entry_key, titleEnglish: entry.title_english, titleArabic: entry.title_arabic, entryOrder: entry.entry_order }));
}

/** public.get_synaxarium_year(p_reference_date): every day of the reference date's Coptic year, with its saints. */
export async function getSynaxariumYear(context: ContentContext, referenceDate: string): Promise<unknown[]> {
  const db = context.db;
  const { results } = await db
    .prepare(`WITH reference_day AS (
        SELECT ${col('coptic_year')} FROM ${t('calendar', 'coptic_date_conversions')} WHERE ${col('gregorian_date')} = ? LIMIT 1
      )
      SELECT d.${col('gregorian_date')}, d.${col('coptic_year')}, d.${col('coptic_month')}, d.${col('coptic_month_name')}, d.${col('coptic_day')}, d.${col('weekday_number')},
        e.${col('entry_key')}, e.${col('entry_order')}, e.${col('title_english')}, e.${col('title_arabic')}
      FROM ${t('calendar', 'coptic_date_conversions')} d
      JOIN reference_day r ON r.${col('coptic_year')} = d.${col('coptic_year')}
      LEFT JOIN ${t('synaxarium', 'entries')} e ON e.${col('coptic_month')} = d.${col('coptic_month')} AND e.${col('coptic_day')} = d.${col('coptic_day')}
      ORDER BY d.${col('gregorian_date')}, e.${col('entry_order')} NULLS LAST`)
    .bind(referenceDate)
    .all<Row>();
  return results.map((row) => jsonb({
    gregorianDate: row.gregorian_date,
    copticYear: row.coptic_year,
    copticMonth: row.coptic_month,
    copticMonthName: row.coptic_month_name,
    copticDay: row.coptic_day,
    weekdayNumber: row.weekday_number,
    entryKey: row.entry_key ?? null,
    entryOrder: row.entry_order ?? null,
    titleEnglish: row.title_english ?? null,
    titleArabic: row.title_arabic ?? null,
  }));
}
