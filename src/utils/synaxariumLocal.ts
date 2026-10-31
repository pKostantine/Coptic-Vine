/**
 * The Synaxarium's answers worked out on the device from a downloaded
 * Liturgy's own tables (the synaxarium schema and the calendar it depends
 * on), in the shapes the content Worker's functions give them
 * (workers/content-api/src/rpc/synaxarium.ts): the Synaxarium page's whole
 * year, Home's saints of the day, and a day's entries with their text.
 * services/contentDataClient.ts reads the rows; these shape them.
 */

type Row = Record<string, unknown>;

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

/** ORDER BY <column> NULLS LAST, keeping the table's order between equals, as SQLite's scan does. */
function nullsLast(rows: Row[], column: string): Row[] {
  const rank = (row: Row) => (row[column] == null ? Number.POSITIVE_INFINITY : Number(row[column]));
  return rows
    .map((row, position) => ({ row, position }))
    .sort((a, b) => {
      const left = rank(a.row);
      const right = rank(b.row);
      return left === right ? a.position - b.position : left < right ? -1 : 1;
    })
    .map(({ row }) => row);
}

const dayKey = (month: unknown, day: unknown) => `${String(month)}-${String(day)}`;

/** Postgres's btrim: spaces only, as the Worker trims. */
function trimmedOrNull(value: unknown): string | null {
  if (value == null) return null;
  const trimmed = String(value).replace(/^ +| +$/g, '');
  return trimmed === '' ? null : trimmed;
}

/** Each Coptic day's saints, in their order, keyed by month and day. */
export function saintsByDay(entries: Row[]): Map<string, Row[]> {
  const byDay = new Map<string, Row[]>();
  for (const entry of entries) {
    const key = dayKey(entry.coptic_month, entry.coptic_day);
    const saints = byDay.get(key);
    if (saints) saints.push(entry);
    else byDay.set(key, [entry]);
  }
  for (const [key, saints] of byDay) byDay.set(key, nullsLast(saints, 'entry_order'));
  return byDay;
}

/** The saints of one Coptic day, in their order. */
export function saintsOfDay(entries: Row[], month: unknown, day: unknown): Row[] {
  return nullsLast(entries.filter((entry) => dayKey(entry.coptic_month, entry.coptic_day) === dayKey(month, day)), 'entry_order');
}

/**
 * public.get_synaxarium_year: every day of a Coptic year (its calendar rows),
 * in date order, each with its saints in order, or a row with none.
 */
export function synaxariumYearRows(days: Row[], entries: Row[]) {
  const byDay = saintsByDay(entries);
  const inOrder = [...days].sort((a, b) => (String(a.gregorian_date) < String(b.gregorian_date) ? -1 : String(a.gregorian_date) > String(b.gregorian_date) ? 1 : 0));
  return inOrder.flatMap((day) => {
    const base = {
      gregorianDate: day.gregorian_date,
      copticYear: day.coptic_year,
      copticMonth: day.coptic_month,
      copticMonthName: day.coptic_month_name,
      copticDay: day.coptic_day,
      weekdayNumber: day.weekday_number,
    };
    const saints = byDay.get(dayKey(day.coptic_month, day.coptic_day)) ?? [];
    if (!saints.length) return [{ ...base, entryKey: null, entryOrder: null, titleEnglish: null, titleArabic: null }];
    return saints.map((saint) => ({
      ...base,
      entryKey: saint.entry_key ?? null,
      entryOrder: saint.entry_order ?? null,
      titleEnglish: saint.title_english ?? null,
      titleArabic: saint.title_arabic ?? null,
    }));
  });
}

/** public.get_home_synaxarium_events: a day's saints for Home, or none for a day the calendar doesn't have. */
export function homeSynaxariumEvents(day: Row | null, entries: Row[]) {
  if (!day) return [];
  return saintsOfDay(entries, day.coptic_month, day.coptic_day).map((saint) => ({
    entryKey: saint.entry_key,
    titleEnglish: saint.title_english,
    titleArabic: saint.title_arabic,
    entryOrder: saint.entry_order,
  }));
}

/**
 * synaxarium.get_intro: "Today is the first day of the blessed month of …",
 * from the month's names in synaxarium.coptic_days.
 */
export function synaxariumIntro(month: number | null, dayOfMonth: number | null, names: Row | null): { arabic: string; english: string | null } | null {
  // Nesi (month 13) is the short epagomenal month: 5 days, 6 in a Coptic leap year.
  const [maxDay, switchDay] = month === 13 ? [6, 3] : [30, 15];
  if (dayOfMonth === null || dayOfMonth < 1 || dayOfMonth > maxDay) return null;
  const monthArabic = (names?.coptic_month_name_arabic as string | null | undefined) ?? null;
  if (monthArabic === null) return null;
  const monthEnglish = (names?.coptic_month_name_english as string | null | undefined) ?? null;
  const [verbArabic, verbEnglish] = dayOfMonth <= switchDay ? ['إستقباله', 'begin it in goodness'] : ['إنقضاؤه', 'end it in goodness'];
  const english = monthEnglish === null ? null
    : `Today is the ${ORDINALS_ENGLISH[dayOfMonth - 1]} day of the blessed month of ${monthEnglish}. May God ${verbEnglish} and renew it for us in peace and tranquility, while our `
      + 'sins and iniquities are forgiven through the tender mercies of our Lord, '
      + 'O my fathers and my brethren. Amen.';
  return {
    arabic: `اليوم ${ORDINALS_ARABIC[dayOfMonth - 1]} من شهر ${monthArabic} المبارك، أحسن الله ${verbArabic}، وأعاده علينا وعليكم ونحن وأنتم في هدوء واطمئنان، مغفوري الخطايا `
      + 'والاثام والزلات، من قبل مراحم الرب يا ابائي وإخوتي. آمين.',
    english,
  };
}

/**
 * synaxarium.get_day_json: a day's Coptic date, its opening blessing, and its
 * saints with their text, paragraph by paragraph; null for a day the
 * calendar doesn't have. `saints` are the day's, in order; `texts` their lines.
 */
export function synaxariumDayJson(day: Row | null, saints: Row[], texts: Row[], monthNames: Row | null) {
  if (!day) return null;
  const linesByEntry = new Map<string, Row[]>();
  for (const line of nullsLast(texts, 'line_order')) {
    const key = String(line.entry_key);
    const lines = linesByEntry.get(key);
    if (lines) lines.push(line);
    else linesByEntry.set(key, [line]);
  }
  const joined = (lines: Row[], language: 'english' | 'arabic') => {
    const parts = lines.map((line) => trimmedOrNull(line[language])).filter((part): part is string => part !== null);
    return parts.length ? parts.join('\n\n') : null;
  };
  return {
    gregorian_date: day.gregorian_date,
    coptic_year: day.coptic_year,
    coptic_date: day.coptic_date_label,
    intro: synaxariumIntro(day.coptic_month == null ? null : Number(day.coptic_month), day.coptic_day == null ? null : Number(day.coptic_day), monthNames),
    entries: saints.map((saint) => {
      const lines = linesByEntry.get(String(saint.entry_key)) ?? [];
      return {
        entry_key: saint.entry_key,
        entry_order: saint.entry_order,
        title_english: saint.title_english,
        title_arabic: saint.title_arabic,
        english: joined(lines, 'english'),
        arabic: joined(lines, 'arabic'),
        paragraphs: lines.map((line) => ({ line_order: line.line_order, english: trimmedOrNull(line.english), arabic: trimmedOrNull(line.arabic) })),
      };
    }),
  };
}
