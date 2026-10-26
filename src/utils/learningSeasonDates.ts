import type { CopticDate, SeasonYear } from './calendarService';
import { daysBetween } from './nextSeason';

/**
 * When each of Learn & Study's seasons is kept (Coptic Vine design, "Season
 * logic"): Discover shows the seasons that hold the liturgical day (Now) and
 * the next two to begin (Coming up); the Seasons page lists every season in
 * its fixed order, each dated season with its Coptic start and a day count.
 *
 * The three annual sets are kept all year and never dated: they are Now on a
 * day no dated season holds. A season the calendar doesn't place ("Other", or
 * one added on the platform since) is never Now and never dated.
 */

/** Kept all year: Now outside every dated season, and never given a date. */
export const ANNUAL_SEASON_SLUGS: readonly string[] = ['annual-psalmody', 'raising-of-incense', 'liturgy'];

/** The seasons the calendar dates (spansInYear below), by their slugs on the platform (learning.seasons). */
const DATED_SLUGS = new Set([
  'joyful-29', 'nayrouz', 'feast-of-the-cross', 'nativity-fast-kiahk', 'nativity-paramoun', 'nativity', 'circumcision',
  'theophany-paramoun', 'theophany', 'wedding-at-cana', 'entry-into-temple', 'annunciation', 'jonahs-fast', 'lent',
  'lazarus-saturday', 'palm-sunday', 'holy-week', 'resurrection', 'thomas-sunday', 'ascension', 'pentecost',
  'entry-into-egypt', 'apostles-fast-and-feast', 'st-mary-fast-and-feast', 'transfiguration',
]);

/** Dated, but never one of the next seasons to come: it comes round every month. */
const NEVER_COMING_UP = new Set(['joyful-29']);

/** A run of days a season is kept on, both ends included, as ISO dates. */
export interface DaySpan {
  start: string;
  end: string;
}

/** One Coptic year of the calendar: its seasons and feasts, and the Coptic date of each of its days. */
export interface CalendarYear {
  year: SeasonYear;
  dates: ReadonlyMap<string, CopticDate>;
}

export interface LearningSeasonTiming {
  /** The season holds the liturgical day. */
  now: boolean;
  /** Its next start after the liturgical day, with that day's Coptic date; null for a season never dated. */
  next: { date: string; coptic: CopticDate | null; days: number } | null;
}

export interface LearningSeasonSchedule {
  /** Each season by slug. */
  timings: ReadonlyMap<string, LearningSeasonTiming>;
  /** The seasons that hold the day, the most particular first (a feast before the fast around it); the annual sets outside every season. */
  now: string[];
  /** The next two dated seasons to begin, in order. */
  comingUp: string[];
}

function addDaysIso(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function weekday(isoDate: string): number {
  return new Date(`${isoDate}T00:00:00Z`).getUTCDay();
}

/**
 * The Paramoun before a feast on `feastIso`: the day before it, reaching back
 * to the Friday when the feast falls on a Sunday or a Monday (as the
 * calendar's get_paramoun_dates keeps it).
 */
function paramounSpan(feastIso: string): DaySpan {
  const feastDay = weekday(feastIso);
  const back = feastDay === 0 ? 2 : feastDay === 1 ? 3 : 1;
  return { start: addDaysIso(feastIso, -back), end: addDaysIso(feastIso, -1) };
}

/** Reads one Coptic year: its days by Coptic date, its seasons by range key, its feasts by key. */
function yearIndex({ year, dates }: CalendarYear) {
  const byCoptic = new Map<string, string>();
  for (const [iso, coptic] of dates) {
    if (iso >= year.startDate && iso < year.endDate) byCoptic.set(`${coptic.monthName} ${coptic.day}`, iso);
  }
  const day = (monthName: string, dayOfMonth: number) => byCoptic.get(`${monthName} ${dayOfMonth}`) ?? null;
  const range = (key: string) => year.seasons.find((season) => season.rangeKey === key && season.startDate >= year.startDate && season.startDate < year.endDate) ?? null;
  const event = (key: string) => year.events.find((entry) => entry.key === key && entry.date >= year.startDate && entry.date < year.endDate)?.date ?? null;
  return { byCoptic, day, range, event };
}

type YearIndex = ReturnType<typeof yearIndex>;

/** A span between two of the year's days, or nothing when either isn't in the calendar. */
function between(start: string | null, end: string | null): DaySpan[] {
  return start && end && start <= end ? [{ start, end }] : [];
}

function single(date: string | null): DaySpan[] {
  return between(date, date);
}

/**
 * The Joyful 29th: the 29th of a Coptic month, kept from the start of the
 * Apostles' Fast until Kiahk's praises begin (the calendar's
 * Joyful29thOfTheMonth): in a Coptic year, Thoout's, Paope's and Hathor's,
 * then those from this year's fast on. The praises begin at the earliest on
 * Hathor 30 (the Sunday before a Monday Kiahk 1), so Hathor 29 is always kept.
 */
function joyful29Spans(index: YearIndex): DaySpan[] {
  const kiahk1 = index.day('Kiahk', 1);
  if (!kiahk1) return [];
  const apostlesStart = index.range('apostles-fast')?.startDate ?? null;
  return [...index.byCoptic]
    .filter(([key, iso]) => key.endsWith(' 29') && (iso < kiahk1 || (apostlesStart !== null && iso >= apostlesStart)))
    .map(([, iso]) => ({ start: iso, end: iso }))
    .sort((x, y) => x.start.localeCompare(y.start));
}

/** The days a season is kept on in one Coptic year. */
function spansInYear(slug: string, index: YearIndex): DaySpan[] {
  const { day, range, event } = index;
  const withFeast = (key: string) => {
    const fast = range(key);
    return fast ? [{ start: fast.startDate, end: addDaysIso(fast.endDate, 1) }] : [];
  };
  switch (slug) {
    case 'joyful-29': return joyful29Spans(index);
    case 'nayrouz': return between(day('Thoout', 1), day('Thoout', 16));
    case 'feast-of-the-cross': return between(day('Thoout', 17), day('Thoout', 19));
    case 'nativity-fast-kiahk': {
      const fast = range('nativity-fast');
      return fast ? [{ start: fast.startDate, end: fast.endDate }] : [];
    }
    case 'nativity-paramoun': {
      const nativity = day('Kiahk', 29);
      return nativity ? [paramounSpan(nativity)] : [];
    }
    // The Nativity's own days run to Tobe 5, as the calendar's NativityPeriod does.
    case 'nativity': return between(day('Kiahk', 29), day('Tobe', 5));
    case 'circumcision': return single(day('Tobe', 6));
    case 'theophany-paramoun': {
      const theophany = day('Tobe', 11);
      return theophany ? [paramounSpan(theophany)] : [];
    }
    case 'theophany': return between(day('Tobe', 11), day('Tobe', 13));
    case 'wedding-at-cana': return single(day('Tobe', 13));
    case 'entry-into-temple': return single(day('Meshir', 8));
    case 'annunciation': return single(day('Paremhotep', 29));
    case 'jonahs-fast': return withFeast('jonahs-fast');
    case 'lent': {
      const lent = range('lent');
      return lent ? [{ start: lent.startDate, end: lent.endDate }] : [];
    }
    case 'lazarus-saturday': return single(event('lazarus-saturday'));
    case 'palm-sunday': return single(event('palm-sunday'));
    // From the Monday after Palm Sunday, as the Books day block counts it (nextSeason.ts).
    case 'holy-week': {
      const palm = event('palm-sunday');
      return between(palm && addDaysIso(palm, 1), event('bright-saturday'));
    }
    case 'resurrection': {
      const fifty = range('holy-50-days');
      return fifty ? [{ start: fifty.startDate, end: fifty.endDate }] : [];
    }
    case 'thomas-sunday': return single(event('thomas-sunday'));
    // The Ascension's praises run until Pentecost.
    case 'ascension': {
      const pentecost = event('pentecost');
      return between(event('ascension'), pentecost && addDaysIso(pentecost, -1));
    }
    case 'pentecost': return single(event('pentecost'));
    case 'entry-into-egypt': return single(day('Pashons', 24));
    case 'apostles-fast-and-feast': return withFeast('apostles-fast');
    case 'st-mary-fast-and-feast': return withFeast('st-mary-fast');
    case 'transfiguration': return single(day('Mesore', 13));
    default: return [];
  }
}

/**
 * Where each season stands on the liturgical day `todayIso`, from the Coptic
 * year that day is in and the one after it (a season past this year comes
 * round next year). Day counts are in liturgical days.
 */
export function scheduleLearningSeasons(
  slugs: readonly string[],
  todayIso: string,
  thisYear: CalendarYear,
  nextYear: CalendarYear | null,
): LearningSeasonSchedule {
  const thisIndex = yearIndex(thisYear);
  const nextIndex = nextYear ? yearIndex(nextYear) : null;
  const copticOf = (iso: string) => thisYear.dates.get(iso) ?? nextYear?.dates.get(iso) ?? null;

  const timings = new Map<string, LearningSeasonTiming>();
  const holding: { slug: string; length: number; order: number }[] = [];
  const upcoming: { slug: string; date: string; order: number }[] = [];

  slugs.forEach((slug, order) => {
    if (!DATED_SLUGS.has(slug)) {
      timings.set(slug, { now: false, next: null });
      return;
    }
    const spans = [...spansInYear(slug, thisIndex), ...(nextIndex ? spansInYear(slug, nextIndex) : [])];
    const current = spans.find((span) => span.start <= todayIso && todayIso <= span.end);
    const following = spans.filter((span) => span.start > todayIso).sort((a, b) => a.start.localeCompare(b.start))[0];
    timings.set(slug, {
      now: Boolean(current),
      next: following ? { date: following.start, coptic: copticOf(following.start), days: daysBetween(todayIso, following.start) } : null,
    });
    if (current) holding.push({ slug, length: daysBetween(current.start, current.end), order });
    else if (following && !NEVER_COMING_UP.has(slug)) upcoming.push({ slug, date: following.start, order });
  });

  const now = holding.length
    ? holding.sort((a, b) => a.length - b.length || a.order - b.order).slice(0, 3).map((entry) => entry.slug)
    : slugs.filter((slug) => ANNUAL_SEASON_SLUGS.includes(slug));
  for (const slug of now) {
    const timing = timings.get(slug);
    if (timing) timings.set(slug, { ...timing, now: true });
  }
  return {
    timings,
    now,
    comingUp: upcoming.sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order).slice(0, 2).map((entry) => entry.slug),
  };
}
