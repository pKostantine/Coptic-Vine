/**
 * The calendar functions the app calls, ported from Postgres:
 *   calendar.get_active_flags_for_date, calendar.get_context_flags,
 *   public.get_readings_for_date, public.get_sunday_message,
 * with what they call inside (get_kiahk_season_bounds, get_paramoun_dates,
 * public.get_calendar_readings). Each keeps the Postgres function's structure
 * and comments, so the two can be read side by side.
 *
 * get_active_flags_for_date reads everything it needs in one round trip (a
 * window of dates around the day, the seasons, the feast instances, the day's
 * saints) and works the rest out here.
 */
import { col, t } from '../db/names.ts';
import { btrim, compareText, day, isoDate, jsonb, PgError } from '../pg.ts';
import type { ContentContext, Row } from '../types.ts';
import { getReadingText } from './bible.ts';

type Conversion = {
  gregorian_date: string;
  gregorian_year: number;
  weekday: string;
  weekday_number: number;
  coptic_year: number;
  coptic_month: number;
  coptic_month_name: string;
  coptic_day: number;
  sunday_ordinal_in_coptic_month: number | null;
};
type Season = { range_key: string; active_season: string; start_date: string; end_date: string | null };
type Instance = { event_key: string; gregorian_date: string; weekday_number: number | null };
export type Flag = { flag_key: string; flag_type: string; title_english: string };

const WINDOW_DAYS = 400;
const FEAST_DAY_EVENTS = [
  'TheHolyNativityFeast', 'TheHolyEpiphany', 'AnnunciationFeast',
  'EntryIntoEgypt', 'TransfigurationFeast', 'TheCircumcisionFeast',
  'FeastOfTheWeddingOfCanaOfGalilee', 'EntryIntoTheTemple',
  'TheNayrouzFeastCopticNewYear',
  'JonahsNinevehFeast', 'TheApostlesFeastMartyrdomOfStPeterAndStPaul',
  'AssumptionOfStMarysBody',
];

/** Everything get_active_flags_for_date reads, for one day. */
type Slice = {
  conversions: Conversion[];
  byDate: Map<string, Conversion>;
  seasons: Season[];
  feasts: Instance[];
  eventsToday: Set<string>;
  saints: Flag[];
};

async function readSlice(context: ContentContext, date: string): Promise<Slice> {
  const from = isoDate(day(date) - WINDOW_DAYS);
  const to = isoDate(day(date) + WINDOW_DAYS);
  const conversionColumns = ['gregorian_date', 'gregorian_year', 'weekday', 'weekday_number', 'coptic_year', 'coptic_month', 'coptic_month_name', 'coptic_day', 'sunday_ordinal_in_coptic_month'];
  const db = context.db;
  const [conversions, seasons, feasts, today, saints] = await db.batch([
    db.prepare(`SELECT ${conversionColumns.map(col).join(', ')} FROM ${t('calendar', 'coptic_date_conversions')} WHERE ${col('gregorian_date')} BETWEEN ? AND ? ORDER BY ${col('gregorian_date')}`).bind(from, to),
    db.prepare(`SELECT ${col('range_key')}, ${col('active_season')}, ${col('start_date')}, ${col('end_date')} FROM ${t('calendar', 'season_ranges')} ORDER BY rowid`),
    // LEFT JOIN: the nearest-feast lookups don't need the weekday;
    // get_paramoun_dates (which joins) skips an instance without one.
    db.prepare(`SELECT i.${col('event_key')}, i.${col('gregorian_date')}, c.${col('weekday_number')} FROM ${t('calendar', 'calendar_event_instances')} i
      LEFT JOIN ${t('calendar', 'coptic_date_conversions')} c ON c.${col('gregorian_date')} = i.${col('gregorian_date')}
      WHERE i.${col('event_key')} IN ('TheHolyNativityFeast', 'TheHolyEpiphany') ORDER BY i.rowid`),
    db.prepare(`SELECT ${col('event_key')} FROM ${t('calendar', 'calendar_event_instances')} WHERE ${col('gregorian_date')} = ?`).bind(date),
    db.prepare(`SELECT f.${col('condition_key')} AS flag_key, 'saint' AS flag_type, f.${col('title_english')} FROM ${t('calendar', 'fixed_coptic_day_flags')} f
      JOIN ${t('calendar', 'coptic_date_conversions')} d ON f.${col('coptic_month')} = d.${col('coptic_month')} AND f.${col('coptic_day')} = d.${col('coptic_day')}
      WHERE d.${col('gregorian_date')} = ? ORDER BY f.rowid`).bind(date),
  ]);
  const rows = conversions.results as unknown as Conversion[];
  return {
    conversions: rows,
    byDate: new Map(rows.map((row) => [row.gregorian_date, row])),
    seasons: seasons.results as unknown as Season[],
    feasts: feasts.results as unknown as Instance[],
    eventsToday: new Set((today.results as { event_key: string }[]).map((row) => row.event_key)),
    saints: saints.results as unknown as Flag[],
  };
}

const year = (iso: string) => Number(iso.slice(0, 4));

/** calendar.get_paramoun_dates(p_year): the Paramoun days before Nativity and Theophany falling in that year's feasts. */
function paramounDates(slice: Slice, gregorianYear: number): { date: number; flagKey: string }[] {
  const out: { date: number; flagKey: string }[] = [];
  for (const feast of slice.feasts) {
    if (year(feast.gregorian_date) !== gregorianYear) continue;
    if (feast.weekday_number === null) continue;
    const offsets = ({ 0: [-2, -1], 1: [-3, -2, -1], 2: [-1], 3: [-1], 4: [-1], 5: [-1], 6: [-1] } as Record<number, number[]>)[feast.weekday_number] ?? [];
    for (const offset of offsets) {
      out.push({ date: day(feast.gregorian_date) + offset, flagKey: feast.event_key === 'TheHolyNativityFeast' ? 'ParamounNativity' : 'ParamounTheophany' });
    }
  }
  return out;
}

/** A RECORD from get_kiahk_season_bounds, null when it returns no row. Postgres's IS NULL / IS NOT NULL on it test every field. */
type KiahkBounds = { start: number | null; end: number | null } | null;
const recordIsNull = (bounds: KiahkBounds) => bounds === null || (bounds.start === null && bounds.end === null);
const recordIsNotNull = (bounds: KiahkBounds) => bounds !== null && bounds.start !== null && bounds.end !== null;

/** calendar.get_kiahk_season_bounds(p_coptic_year) */
function kiahkSeasonBounds(slice: Slice, copticYear: number): KiahkBounds {
  const find = (month: number, dayOfMonth: number) => slice.conversions.find((c) => c.coptic_year === copticYear && c.coptic_month === month && c.coptic_day === dayOfMonth);
  const kiahk1 = find(4, 1);
  if (!kiahk1) return null;
  const nativity = find(4, 29);
  if (!nativity) return null;
  const paramouns = paramounDates(slice, year(nativity.gregorian_date)).filter((p) => p.flagKey === 'ParamounNativity').map((p) => p.date);
  const paramounStart = paramouns.length ? Math.min(...paramouns) : null;
  const end = paramounStart === null ? null : paramounStart - 1;
  const kiahkStart = day(kiahk1.gregorian_date);
  const sundays = end === null ? 0 : slice.conversions.filter((c) => day(c.gregorian_date) >= kiahkStart && day(c.gregorian_date) <= end && c.weekday === 'Sunday').length;
  let start: number;
  if (sundays >= 4) start = kiahkStart;
  else {
    const hathorSundays = slice.conversions.filter((c) => c.coptic_year === copticYear && c.coptic_month === 3 && c.weekday === 'Sunday').map((c) => day(c.gregorian_date));
    start = hathorSundays.length ? Math.max(...hathorSundays) : kiahkStart;
  }
  return { start, end };
}

/** The nearest instance of a feast in the years around the day (ties: the first in table order). */
function nearestFeast(slice: Slice, eventKey: string, gregorianYear: number, today: number): number | null {
  let best: number | null = null;
  for (const feast of slice.feasts) {
    if (feast.event_key !== eventKey) continue;
    const y = year(feast.gregorian_date);
    if (y !== gregorianYear && y !== gregorianYear - 1 && y !== gregorianYear + 1) continue;
    const date = day(feast.gregorian_date);
    if (best === null || Math.abs(date - today) < Math.abs(best - today)) best = date;
  }
  return best;
}

/** calendar.get_active_flags_for_date(p_gregorian_date), in the order Postgres returns its rows. */
export async function getActiveFlagsForDate(context: ContentContext, date: string): Promise<Flag[]> {
  const slice = await readSlice(context, date);
  const c = slice.byDate.get(date);
  if (!c) return [];
  const out: Flag[] = [];
  const emit = (...flags: [string, string, string][]) => { for (const [flag_key, flag_type, title_english] of flags) out.push({ flag_key, flag_type, title_english }); };
  const feast = (key: string, title: string): [string, string, string] => [key, 'season_feast', title];

  const p = day(date);
  const gregYear = c.gregorian_year;
  const copticYear = c.coptic_year;
  const seasonOfYear = (match: (s: Season) => boolean) => slice.seasons.find((s) => match(s) && year(s.start_date) === gregYear);
  const lent = seasonOfYear((s) => s.range_key === 'lent');
  const pascha = seasonOfYear((s) => s.active_season === 'Holy Pascha');
  const h50 = seasonOfYear((s) => s.active_season === 'Holy 50 Days');
  const apostles = seasonOfYear((s) => s.active_season === "Apostles' Fast");
  const stmary = seasonOfYear((s) => s.active_season === "St. Mary's Fast");
  const jonah = seasonOfYear((s) => s.active_season === "Jonah's Fast");
  const natfast = slice.seasons
    .filter((s) => s.active_season === 'Nativity Fast' && p >= day(s.start_date) && s.end_date !== null && p < day(s.end_date))
    .sort((a, b) => day(b.start_date) - day(a.start_date))[0];
  const d = (iso: string | null | undefined) => (iso ? day(iso) : null);
  const lentStart = d(lent?.start_date); const lentEnd = d(lent?.end_date);
  const paschaStart = d(pascha?.start_date);
  const h50Start = d(h50?.start_date); const h50End = d(h50?.end_date);
  const apostlesStart = d(apostles?.start_date); const apostlesEnd = d(apostles?.end_date);
  const stmaryStart = d(stmary?.start_date); const stmaryEnd = d(stmary?.end_date);
  const jonahStart = d(jonah?.start_date); const jonahEnd = d(jonah?.end_date);
  const natfastStart = d(natfast?.start_date); const natfastEnd = d(natfast?.end_date);

  const lazarusSat = paschaStart;
  const palmSun = paschaStart === null ? null : paschaStart + 1;
  const holyThu = h50Start === null ? null : h50Start - 3;
  const goodFri = h50Start === null ? null : h50Start - 2;
  const brightSat = h50Start === null ? null : h50Start - 1;
  const resurrection = h50Start;
  const thomasSun = h50Start === null ? null : h50Start + 7;
  const ascension = h50Start === null ? null : h50Start + 39;
  const pentecost = h50End;
  const lastFriLent = lentEnd;
  const jonahFeast = jonahEnd;
  const apostlesFeast = apostlesEnd;
  const stmaryFeast = stmaryEnd;

  const nativityDate = nearestFeast(slice, 'TheHolyNativityFeast', gregYear, p);
  const theophanyDate = nearestFeast(slice, 'TheHolyEpiphany', gregYear, p);

  const paramounToday = (flagKey: string) => [gregYear, gregYear - 1].some((y) => paramounDates(slice, y).some((pd) => pd.flagKey === flagKey && pd.date === p));
  const paramounNat = paramounToday('ParamounNativity');
  const paramounTheo = paramounToday('ParamounTheophany');

  const inNatfast = natfastStart !== null && p >= natfastStart && natfastEnd !== null && p < natfastEnd;
  const inStmary = stmaryStart !== null && stmaryEnd !== null && p >= stmaryStart && p < stmaryEnd;
  const inApostles = apostlesStart !== null && apostlesEnd !== null && p >= apostlesStart && p < apostlesEnd;

  const firstOnOrAfter = (month: number, dayOfMonth: number, from: number | null) => {
    if (from === null) return null;
    const row = slice.conversions.find((x) => x.coptic_month === month && x.coptic_day === dayOfMonth && day(x.gregorian_date) >= from);
    return row ? day(row.gregorian_date) : null;
  };
  const nativityPeriodEnd = firstOnOrAfter(5, 5, nativityDate);
  const theophanyPeriodEnd = theophanyDate === null ? null : firstOnOrAfter(5, 13, theophanyDate);

  const inNativityPeriod = nativityDate !== null && nativityPeriodEnd !== null && p >= nativityDate && p <= nativityPeriodEnd;
  const inTheophanyPeriod = theophanyDate !== null && theophanyPeriodEnd !== null && p >= theophanyDate && p <= theophanyPeriodEnd;
  const inNayrouzPeriod = c.coptic_month === 1 && c.coptic_day <= 16;
  const inH50Period = paschaStart !== null && h50End !== null && p >= paschaStart && p <= h50End;

  const feastDay = FEAST_DAY_EVENTS.some((key) => slice.eventsToday.has(key))
    || (c.coptic_month === 1 && c.coptic_day >= 17 && c.coptic_day <= 19)
    || (c.coptic_month === 7 && c.coptic_day === 10)
    || [resurrection, pentecost, ascension, palmSun, lazarusSat, jonahFeast, apostlesFeast, stmaryFeast].some((x) => x !== null && p === x);

  const kiahkBounds = kiahkSeasonBounds(slice, copticYear);
  const sundaysBetween = (from: number, to: number) => slice.conversions.filter((x) => day(x.gregorian_date) >= from && day(x.gregorian_date) <= to && x.weekday === 'Sunday').map((x) => day(x.gregorian_date));
  const kiahkSundays = recordIsNotNull(kiahkBounds) ? sundaysBetween(kiahkBounds!.start!, kiahkBounds!.end!) : null;
  let lentSundays: number[] | null = null;
  let firstMonLent: number | null = null;
  if (lentStart !== null) {
    lentSundays = lentEnd === null ? [] : sundaysBetween(lentStart, lentEnd);
    const mondays = slice.conversions.filter((x) => day(x.gregorian_date) >= lentStart && day(x.gregorian_date) < lentStart + 7 && x.weekday === 'Monday');
    firstMonLent = mondays.length ? day(mondays[0].gregorian_date) : null;
  }

  // The Kiahk start that closes the ApostlesFastToLastDayOfHathor and Joyful29
  // windows: next coptic year's once this one's Kiahk is past.
  let nextKiahkStart: number | null;
  if (recordIsNull(kiahkBounds)) nextKiahkStart = null;
  else if (kiahkBounds!.end !== null && p > kiahkBounds!.end) nextKiahkStart = kiahkSeasonBounds(slice, copticYear + 1)?.start ?? null;
  else nextKiahkStart = kiahkBounds!.start;

  const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const weekend = ['Saturday', 'Sunday'];

  // ══ A. GREAT FEASTS
  if (resurrection !== null && p === resurrection) {
    emit(feast('Resurrection', 'Resurrection'), feast('GreatFeasts', 'Great Feasts'), feast('Feasts', 'Feasts'),
      feast('FeastsOfTheLordPeriods', 'Feasts of the Lord Periods'), feast('PentecostPeriod', 'Holy Fifty Days'),
      feast('PreAscensionPentecostPeriod', 'Pre-Ascension Pentecost Period'));
  }
  if (nativityDate !== null && p === nativityDate && !paramounNat) {
    emit(feast('Nativity', 'Nativity'), feast('NativityFeast', 'Nativity Feast'), feast('GreatFeasts', 'Great Feasts'),
      feast('Feasts', 'Feasts'), feast('FeastsOfTheLordPeriods', 'Feasts of the Lord Periods'));
  }
  if (theophanyDate !== null && p === theophanyDate && !paramounTheo) {
    emit(feast('Theophany', 'Theophany'), feast('TheophanyLiturgyOfTheWaters', 'Theophany Liturgy of the Waters'),
      feast('GreatFeasts', 'Great Feasts'), feast('Feasts', 'Feasts'), feast('FeastsOfTheLordPeriods', 'Feasts of the Lord Periods'));
  }
  if (pentecost !== null && p === pentecost) {
    emit(feast('Pentecost', 'Pentecost'), feast('GreatFeasts', 'Great Feasts'), feast('Feasts', 'Feasts'),
      feast('FeastsOfTheLordPeriods', 'Feasts of the Lord Periods'), feast('PentecostPeriod', 'Holy Fifty Days'),
      feast('PostAscensionPentecostPeriod', 'Post-Ascension Pentecost Period'));
  }
  if (ascension !== null && p === ascension) {
    emit(feast('Ascension', 'Ascension'), feast('GreatFeasts', 'Great Feasts'), feast('Feasts', 'Feasts'),
      feast('FeastsOfTheLordPeriods', 'Feasts of the Lord Periods'), feast('PentecostPeriod', 'Holy Fifty Days'),
      feast('PostAscensionPentecostPeriod', 'Post-Ascension Pentecost Period'));
  }

  // ══ A2. NATIVITY / THEOPHANY PERIODS
  if (inNativityPeriod) emit(feast('NativityPeriod', 'Nativity Period'));
  if (inTheophanyPeriod) emit(feast('TheophanyPeriod', 'Theophany Period'));

  // ══ B. HOLY WEEK
  if (paschaStart !== null && brightSat !== null && p >= paschaStart && p <= brightSat) {
    emit(feast('Pascha', 'Holy Pascha'));
    if (palmSun !== null && p > palmSun) emit(feast('HolyWeek', 'Holy Week'));
    if (p === lazarusSat) emit(feast('LazarusSaturday', 'Lazarus Saturday'), feast('Feasts', 'Feasts'));
    if (p === palmSun) emit(feast('PalmSunday', 'Palm Sunday'), feast('HosannaSunday', 'Palm Sunday'), feast('Feasts', 'Feasts'));
    if (p === holyThu) emit(feast('HolyThursday', 'Holy Thursday'), feast('CovenantThursday', 'Holy Thursday'));
    if (p === goodFri) emit(feast('GoodFriday', 'Good Friday'));
    if (p === brightSat) emit(feast('BrightSaturday', 'Bright Saturday'), feast('JoyousSaturday', 'Bright Saturday'), feast('BrightSaturdayAttribute', 'Bright Saturday'));
  }

  // ══ C. HOLY 50 DAYS
  if (h50Start !== null && resurrection !== null && pentecost !== null && p > resurrection && p < pentecost && (ascension === null || p !== ascension)) {
    emit(feast('PentecostPeriod', 'Holy Fifty Days'));
    if (p === resurrection + 1) emit(feast('DayAfterResurrection', 'Day After Resurrection'));
    if (p === thomasSun) emit(feast('ThomasSunday', 'Thomas Sunday'));
    if (ascension !== null && p < ascension) emit(feast('PreAscensionPentecostPeriod', 'Pre-Ascension Pentecost Period'));
    else if (ascension !== null && p > ascension) emit(feast('PostAscensionPentecostPeriod', 'Post-Ascension Pentecost Period'));
  }

  // Aggregate Feasts flag for all festive periods, without repeating it on
  // feast days that already emit it.
  if ((inNativityPeriod || inTheophanyPeriod || inNayrouzPeriod || inH50Period) && !feastDay) emit(feast('Feasts', 'Feasts'));

  // ══ D. FEASTS OF THE LORD
  const lordFeasts: [string, string, string][] = [
    ['AnnunciationFeast', 'Annunciation', 'Annunciation'],
    ['EntryIntoEgypt', 'EntryIntoEgypt', 'Entry into Egypt'],
    ['TransfigurationFeast', 'Transfiguration', 'Transfiguration'],
    ['TheCircumcisionFeast', 'Circumcision', 'Circumcision'],
    ['FeastOfTheWeddingOfCanaOfGalilee', 'WeddingCana', 'Wedding at Cana'],
    ['EntryIntoTheTemple', 'EntryIntoTheTemple', 'Presentation in the Temple'],
  ];
  for (const [event, key, title] of lordFeasts) {
    if (slice.eventsToday.has(event)) emit(feast(key, title), feast('Feasts', 'Feasts'), feast('FeastsOfTheLordPeriods', 'Feasts of the Lord Periods'));
  }

  // ══ E. NAYROUZ & CROSS
  if (slice.eventsToday.has('TheNayrouzFeastCopticNewYear')) emit(feast('CopticNewYear', 'Coptic New Year'), feast('Nayrouz', 'Nayrouz'), feast('Feasts', 'Feasts'));
  if (inNayrouzPeriod) emit(feast('Nayrouz', 'Coptic New Year Period'));
  if (c.coptic_month === 1 && c.coptic_day >= 17 && c.coptic_day <= 19) {
    emit(feast('FeastOfTheCross', 'Feast of the Cross'), feast('HolyCross', 'Holy Cross'), feast('ThooutFeastOfTheCross1', 'Thoout Feast of the Cross'),
      feast('Feasts', 'Feasts'), feast('FeastsOfTheLordPeriods', 'Feasts of the Lord Periods'));
  }
  if (c.coptic_month === 7 && c.coptic_day === 10) {
    emit(feast('FeastOfTheCross', 'Feast of the Cross'), feast('HolyCross', 'Holy Cross'), feast('ParemhotepFeastOfTheCross', 'Paremhotep Feast of the Cross'), feast('Feasts', 'Feasts'));
  }

  // ══ F. LENT
  if (lentStart !== null && lentEnd !== null && p >= lentStart && p <= lentEnd) {
    emit(feast('Lent', 'Lent'), feast('GreatLent', 'Lent'), feast('GreatFast', 'Lent'), feast('Fasts', 'Fasts'));
    if (weekdays.includes(c.weekday)) emit(feast('LentWeekdays', 'Lent Weekdays'));
    if (weekend.includes(c.weekday)) emit(feast('LentWeekends', 'Lent Weekends'));
    if (firstMonLent !== null && p === firstMonLent) emit(feast('FirstMondayOfLent', 'First Monday of Lent'), feast('FirstMondayOfGreatFast', 'First Monday of Lent'));
    if (lastFriLent !== null && p === lastFriLent) emit(feast('LastFridayOfLent', 'Last Friday of Lent'), feast('LastFridayOfGreatFast', 'Last Friday of Lent'));
    if (lentSundays && lentSundays.length > 0) {
      if (p >= lentStart && p < lentSundays[0]) emit(feast('LentWeek1', 'Lent Week 1'));
      const sundayFlags: [string, string][][] = [
        [['LentSunday1', 'First Sunday of Lent'], ['GreatFastSunday0', 'First Sunday of Lent']],
        [['LentSunday2', 'Second Sunday of Lent']], [['LentSunday3', 'Third Sunday of Lent']],
        [['LentSunday4', 'Fourth Sunday of Lent']], [['LentSunday5', 'Fifth Sunday of Lent']], [['LentSunday6', 'Sixth Sunday of Lent']],
      ];
      lentSundays.forEach((sunday, index) => {
        if (p === sunday) for (const [key, title] of sundayFlags[index] ?? []) emit(feast(key, title));
        const next = index < lentSundays!.length - 1 ? lentSundays![index + 1] : lentEnd + 1;
        if (p > sunday && p < next && index < 6) emit(feast(`LentWeek${index + 2}`, `Lent Week ${index + 2}`));
      });
    }
  }
  if (lentStart !== null && c.weekday === 'Sunday' && p === lentStart - 7) {
    emit(feast('LentSunday0', 'Preparation Sunday'), feast('GreatFastSunday0', 'Preparation Sunday'));
  }

  // ══ G. JONAH
  if (jonahStart !== null && jonahEnd !== null && p >= jonahStart && p < jonahEnd) emit(feast('JonahFast', "Jonah's Fast"), feast('JonahsFast', "Jonah's Fast"), feast('Fasts', 'Fasts'));
  if (jonahFeast !== null && p === jonahFeast) emit(feast('JonahPassover', "Jonah's Passover"), feast('JonahsPassover', "Jonah's Passover"), feast('JonahTheProphet', 'Jonah the Prophet'), feast('Feasts', 'Feasts'));

  // ══ H. APOSTLES
  if (inApostles) emit(feast('ApostlesFast', "Apostles' Fast"), feast('Apostles', 'Apostles'), feast('Fasts', 'Fasts'));
  if (apostlesFeast !== null && p === apostlesFeast) emit(feast('ApostlesFeast', "Apostles' Feast"), feast('Apostles', 'Apostles'), feast('Feasts', 'Feasts'));
  // From the first day of the Apostles' Fast through the last day of Hathor.
  if (apostlesStart !== null && p >= apostlesStart && (nextKiahkStart === null || p < nextKiahkStart)) {
    emit(feast('ApostlesFastToLastDayOfHathor', 'Apostles Fast to Last Day of Hathor'));
  }

  // ══ I. ST. MARY
  if (inStmary) emit(feast('StMarysFast', "St. Mary's Fast"), feast('StMaryFast', "St. Mary's Fast"), feast('Fasts', 'Fasts'));
  if (stmaryFeast !== null && p === stmaryFeast) emit(feast('StMarysFeast', "St. Mary's Feast"), feast('AssumptionStMary', 'Assumption of St. Mary'), feast('StMaryCommemoration', 'St. Mary Commemoration'), feast('Feasts', 'Feasts'));
  if (c.coptic_day === 21) emit(feast('StMaryCommemoration', 'St. Mary Commemoration'));

  // ══ J. NATIVITY FAST
  if (inNatfast) emit(feast('NativityFast', 'Nativity Fast'), feast('Fasts', 'Fasts'));

  // ══ K. PARAMOUN
  if (paramounNat) emit(feast('NativityParamoun', 'Nativity Paramoun'), feast('ParamounNativity', 'Nativity Paramoun'));
  if (paramounTheo) emit(feast('TheophanyParamoun', 'Theophany Paramoun'), feast('ParamounTheophany', 'Theophany Paramoun'));

  // ══ L. KIAHK
  if (recordIsNotNull(kiahkBounds) && p >= kiahkBounds!.start! && p <= kiahkBounds!.end!) {
    emit(feast('KiahkSeason', 'Kiahk Season'));
    if (weekdays.includes(c.weekday)) emit(feast('KiahkWeekdays', 'Kiahk Weekdays'));
    if (weekend.includes(c.weekday)) emit(feast('KiahkWeekends', 'Kiahk Weekends'));
    if (kiahkSundays && kiahkSundays.length > 0) {
      const ordinals = ['First', 'Second', 'Third', 'Fourth'];
      kiahkSundays.forEach((sunday, index) => {
        if (p === sunday && index < 4) emit(feast(`${ordinals[index]}SundayOfKiahk`, `${ordinals[index]} Sunday of Kiahk`));
        const next = index < kiahkSundays.length - 1 ? kiahkSundays[index + 1] : kiahkBounds!.end! + 1;
        if (p > sunday && p < next && index < 4) emit(feast(`${ordinals[index]}WeekOfKiahk`, `${ordinals[index]} Week of Kiahk`));
      });
    }
  }

  // ══ M. NORMAL FASTING DAYS
  const inLentOrHolyWeek = slice.seasons.some((s) => (s.range_key === 'lent' || s.range_key === 'holy-week') && s.end_date !== null && p >= day(s.start_date) && p <= day(s.end_date));
  if ((c.weekday === 'Wednesday' || c.weekday === 'Friday' || inNatfast || inStmary || inApostles)
    && !paramounNat && !paramounTheo && !feastDay && !inH50Period && !inNativityPeriod && !inTheophanyPeriod && !inNayrouzPeriod
    && !inLentOrHolyWeek
    && (jonahStart === null || p < jonahStart || (jonahEnd !== null && p >= jonahEnd))) {
    emit(feast('NormalFastingDays', 'Normal Fasting Days'));
    if (!(inNatfast || inStmary || inApostles)) emit(feast('Fasts', 'Fasts'));
  }

  // ══ N. JOYFUL 29TH
  if (c.coptic_day === 29) {
    emit(feast('TwentyNinthCopticMonth', '29th Coptic Month'), feast('Joyful29thOfTheMonthRaw', 'Joyful 29th (Raw)'));
    if (apostlesStart !== null && p >= apostlesStart && (nextKiahkStart === null || p < nextKiahkStart)) {
      emit(feast('Joyful29', 'Joyful 29th'), feast('Joyful29thOfTheMonth', 'Joyful 29th of the Month'));
    }
  }

  // ══ N2. AGRICULTURAL / WEATHER SEASONS
  const md = c.coptic_month * 100 + c.coptic_day;
  if (md >= 1012 || md <= 209) emit(feast('SeasonOfWater', 'Season of Water'));
  else if (md >= 210 && md <= 510) emit(feast('SeasonOfPlants', 'Season of Plants'));
  else emit(feast('SeasonOfAir', 'Season of Air'));

  // ══ O. EXACT COPTIC DATE
  emit([`${c.coptic_month_name}.${c.coptic_day}`, 'coptic_date', `${c.coptic_month_name} ${c.coptic_day}`]);

  // ══ P. DAY OF WEEK
  emit([`${c.weekday}s`, 'weekday', `${c.weekday}s`]);
  emit([c.weekday, 'weekday', c.weekday]);
  if (weekdays.includes(c.weekday)) emit(['Weekdays', 'weekday', 'Weekdays'], ['Weekday', 'weekday', 'Weekday']);
  if (weekend.includes(c.weekday)) emit(['Weekends', 'weekday', 'Weekends'], ['Weekend', 'weekday', 'Weekend']);
  if (['Sunday', 'Monday', 'Tuesday'].includes(c.weekday)) emit(['AdamDays', 'weekday', 'Adam Days']);
  if (['Wednesday', 'Thursday', 'Friday', 'Saturday'].includes(c.weekday)) emit(['VatosDays', 'weekday', 'Vatos Days']);

  // ══ Q. SAINTS (Postgres gives no order here; D1 gives table order)
  out.push(...slice.saints);

  // ══ R. ANNUAL
  if (!inLentOrHolyWeek) emit(['Annual', 'annual', 'Annual']);
  return out;
}

/**
 * The exception get_context_flags raises for a date the calendar doesn't
 * have, word for word. It names the table in Postgres's words; built here so
 * that no string in the Worker spells a table name without its quotes.
 */
export function noConversionRow(date: string | null): PgError {
  return new PgError('P0001', `No ${['calendar', 'coptic_date_conversions'].join('.')} row for date ${date ?? '<NULL>'}`);
}

/** calendar.get_context_flags(p_date, p_extra_context): every active flag as true, the caller's context on top. */
export async function getContextFlags(context: ContentContext, date: string, extra: unknown): Promise<unknown> {
  const flags = await getActiveFlagsForDate(context, date);
  if (!flags.length && !(await context.db.prepare(`SELECT 1 FROM ${t('calendar', 'coptic_date_conversions')} WHERE ${col('gregorian_date')} = ?`).bind(date).first())) {
    throw noConversionRow(date);
  }
  const object: Record<string, unknown> = {};
  for (const flag of flags) object[flag.flag_key] = true;
  // jsonb || jsonb: the caller's keys win.
  if (extra !== null && extra !== undefined && typeof extra === 'object' && !Array.isArray(extra)) Object.assign(object, extra);
  return jsonb(object);
}

type ReadingRule = Row & { service: string; reading_type: string; reading_code: string | null; cycle_type: string | null; priority: number | null };

/** public.get_calendar_readings(p_date): the day's reading rules, the highest-priority cycle for each service and reading. */
export async function getCalendarReadings(context: ContentContext, date: string): Promise<Row[]> {
  const db = context.db;
  const conversion = await db.prepare(`SELECT ${col('coptic_month')}, ${col('coptic_day')}, ${col('weekday_number')}, ${col('sunday_ordinal_in_coptic_month')} FROM ${t('calendar', 'coptic_date_conversions')} WHERE ${col('gregorian_date')} = ?`).bind(date).first<{ coptic_month: number; coptic_day: number; weekday_number: number; sunday_ordinal_in_coptic_month: number | null }>();
  if (!conversion) return [];
  const p = day(date);

  const seasons = (await db.prepare(`SELECT ${col('active_season')}, ${col('start_date')}, ${col('end_date')} FROM ${t('calendar', 'season_ranges')} WHERE ${col('active_season')} IN ('Lent', 'Great Fast', 'Holy 50 Days') ORDER BY rowid`).all<Season>()).results;
  // Great Lent: weeks 1..7 span start .. start+48 (Lazarus Saturday and Palm Sunday inclusive).
  const lent = seasons.filter((s) => (s.active_season === 'Lent' || s.active_season === 'Great Fast') && p >= day(s.start_date) && p <= day(s.start_date) + 48)
    .sort((a, b) => day(b.start_date) - day(a.start_date))[0];
  const lentWeek = lent ? Math.ceil((p - day(lent.start_date) + 1) / 7) : null;
  const pent = seasons.find((s) => s.active_season === 'Holy 50 Days' && p >= day(s.start_date) && p <= (s.end_date === null ? p : day(s.end_date)));
  const pentWeek = pent ? (p === day(pent.start_date) ? 0 : Math.ceil((p - day(pent.start_date)) / 7)) : null;

  const weekday = conversion.weekday_number;
  const candidates = (await db.prepare(`SELECT * FROM ${t('calendar', 'reading_rules')} WHERE
      (${col('cycle_type')} = 'AnnualDaily' AND ${col('coptic_month')} = ?1 AND ${col('coptic_day')} = ?2)
      OR (${col('cycle_type')} = 'AnnualSunday' AND ?3 = 0 AND ${col('coptic_month')} = ?1 AND ${col('sunday_ordinal')} = ?4 AND (${col('day_of_week')} IS NULL OR ${col('day_of_week')} = ?3))
      OR (${col('cycle_type')} = 'GreatLent' AND ?5 IS NOT NULL AND ${col('lent_week')} = ?5 AND (${col('day_of_week')} IS NULL OR ${col('day_of_week')} = ?3))
      OR (${col('cycle_type')} = 'Pentecost' AND ?6 IS NOT NULL AND ${col('pentecost_week')} = ?6 AND (${col('day_of_week')} IS NULL OR ${col('day_of_week')} = ?3))
      ORDER BY rowid`)
    .bind(conversion.coptic_month, conversion.coptic_day, weekday, conversion.sunday_ordinal_in_coptic_month, lentWeek, pentWeek)
    .all<ReadingRule>()).results;

  // DISTINCT ON (service, reading_type) ... ORDER BY priority DESC: the
  // winner's cycle and priority, then every candidate that shares both.
  const winners = new Map<string, ReadingRule>();
  for (const candidate of candidates) {
    const key = `${candidate.service}\u0000${candidate.reading_type}`;
    const current = winners.get(key);
    // DESC puts nulls first.
    const better = !current || (current.priority !== null && (candidate.priority === null || candidate.priority > current.priority));
    if (better) winners.set(key, candidate);
  }
  const chosen = candidates.filter((candidate) => {
    const winner = winners.get(`${candidate.service}\u0000${candidate.reading_type}`)!;
    return winner.cycle_type === candidate.cycle_type && winner.priority === candidate.priority;
  });
  const suffix = (code: string | null) => Number(code?.match(/(\d+)$/)?.[1] ?? 0);
  chosen.sort((a, b) => compareText(a.service, b.service) || compareText(a.reading_type, b.reading_type)
    || suffix(a.reading_code) - suffix(b.reading_code) || compareNullableText(a.reading_code, b.reading_code));
  return chosen.map((rule) => jsonb({
    service: rule.service,
    reading_type: rule.reading_type,
    reading_code: rule.reading_code,
    reading_reference: rule.reading_reference,
    cycle_type: rule.cycle_type,
    priority: rule.priority,
    sunday_message: rule.sunday_message,
  }));
}

function compareNullableText(a: string | null, b: string | null): number {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
  return compareText(a, b);
}

/** public.get_readings_for_date(p_date): the day's reading rules, each with get_reading_text's verses. */
export async function getReadingsForDate(context: ContentContext, date: string): Promise<unknown[]> {
  const rules = await getCalendarReadings(context, date);
  const out: unknown[] = [];
  for (const rule of rules) {
    out.push(jsonb({ ...rule, resolved_verses: await getReadingText(context, (rule.reading_reference as string | null) ?? null) }));
  }
  return out;
}

/** public.get_sunday_message(p_sunday): the Liturgy Gospel's Sunday message, trimmed, or null. */
export async function getSundayMessage(context: ContentContext, date: string): Promise<string | null> {
  const rules = await getCalendarReadings(context, date);
  const gospel = rules.find((rule) => rule.service === 'Liturgy' && rule.reading_type === 'Gospel');
  if (!gospel || gospel.sunday_message == null) return null;
  const message = btrim(String(gospel.sunday_message));
  return message === '' ? null : message;
}
