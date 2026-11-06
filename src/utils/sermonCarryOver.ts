import type { DocumentSection } from '../components/vine/documentHtml';
import type { SermonHighlight, SermonPlan } from '../types/sermonPlanner';
import { groupHighlights, highlightSegmentId, newHighlightGroupId } from './highlightGroups';
import { copticEaster } from './holyWeekDates';
import { emptySermonPlan } from './sermonPlanner';

/**
 * Carrying a sermon over to another day: Palm Sunday's from last year to this
 * year's. It goes first to the same day a year on, the day whose readings are
 * most like its own, and any day can be chosen instead.
 */

const DAY_MS = 86_400_000;
/** The days whose readings follow Pascha: Jonah's Fast, 69 days before it, through Pentecost and the Monday after. */
const PASCHA_BEFORE = 70;
const PASCHA_AFTER = 50;

/** What the calendar is asked; the app reads it from calendar.coptic_date_conversions and the day's feasts. */
export interface CarryOverCalendar {
  /** A day's Coptic year, month (1–13) and day. */
  copticDate: (isoDate: string) => Promise<{ year: number; month: number; day: number } | null>;
  /** A Coptic month's days in order: each one's Gregorian date, its Coptic day, and whether it is a Sunday. */
  copticMonth: (year: number, month: number) => Promise<{ isoDate: string; day: number; sunday: boolean }[]>;
  /** Whether the day is a feast kept on its Coptic date with readings of its own (the Annunciation, in Lent). */
  fixedFeast: (isoDate: string) => Promise<boolean>;
}

function toIso(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

function timeOf(isoDate: string): number {
  return Date.parse(`${isoDate}T00:00:00Z`);
}

/**
 * The same day a year on, as the readings count it:
 * - a day of Pascha's season (Jonah's Fast through Pentecost), the same day
 *   from next year's Pascha: Palm Sunday to Palm Sunday;
 * - a feast kept on its Coptic date, and any weekday, the same Coptic date;
 * - any other Sunday, the same Sunday of its Coptic month (the third of
 *   Hathor), whose readings are that Sunday's.
 */
export async function equivalentDayNextYear(isoDate: string, calendar: CarryOverCalendar): Promise<string> {
  const time = timeOf(isoDate);
  const year = new Date(time).getUTCFullYear();
  const offset = Math.round((time - copticEaster(year).getTime()) / DAY_MS);
  const fixed = await calendar.fixedFeast(isoDate).catch(() => false);
  if (!fixed && offset >= -PASCHA_BEFORE && offset <= PASCHA_AFTER) {
    return toIso(copticEaster(year + 1).getTime() + offset * DAY_MS);
  }
  // Fifty-two weeks on, the same weekday, where the calendar can't be read.
  const fallback = toIso(time + 364 * DAY_MS);
  const coptic = await calendar.copticDate(isoDate).catch(() => null);
  if (!coptic) return fallback;
  const [month, nextMonth] = await Promise.all([
    calendar.copticMonth(coptic.year, coptic.month).catch(() => []),
    calendar.copticMonth(coptic.year + 1, coptic.month).catch(() => []),
  ]);
  if (!nextMonth.length) return fallback;
  if (!fixed && new Date(time).getUTCDay() === 0) {
    const ordinal = month.filter((day) => day.sunday && day.day <= coptic.day).length;
    const sundays = nextMonth.filter((day) => day.sunday);
    return (sundays[ordinal - 1] ?? sundays[sundays.length - 1] ?? nextMonth[0]).isoDate;
  }
  // The short thirteenth month may not reach the day: its last.
  return (nextMonth.find((day) => day.day === coptic.day) ?? nextMonth[nextMonth.length - 1]).isoDate;
}

/** The day a carry over offers first: the day's equivalent a year on, or the first such that is not already past. */
export async function carryOverDay(isoDate: string, todayIso: string, calendar: CarryOverCalendar): Promise<string> {
  let target = await equivalentDayNextYear(isoDate, calendar);
  for (let tries = 0; tries < 5 && target < todayIso; tries += 1) target = await equivalentDayNextYear(target, calendar);
  return target;
}

type VerseText = { sectionId: string; verseId: string; english: string; arabic: string; coptic: string };

function verseTexts(sections: readonly DocumentSection[]): VerseText[] {
  return sections.flatMap((section) => section.verses.map((verse, index) => ({
    sectionId: section.id,
    verseId: `${section.id}::v${index}`,
    english: String(verse.english || ''),
    arabic: String(verse.arabic || ''),
    coptic: String(verse.coptic || ''),
  })));
}

/**
 * A plan carried to another day: its name, its one sentence and its parts as
 * they are, Draft again; and each highlight found again in that day's
 * readings -- in its own verse if that verse reads the same, else wherever
 * the words are read -- and left behind if they aren't read that day.
 * Without the day's readings (offline), the outline goes alone.
 */
export function carriedSermonPlan(
  source: SermonPlan,
  target: { id: string; isoDate: string; now: string },
  sections: readonly DocumentSection[] | null,
): { plan: SermonPlan; carried: number; leftBehind: number } {
  const texts = sections ? verseTexts(sections) : [];
  const byVerse = new Map(texts.map((entry) => [entry.verseId, entry]));
  const groupIds = new Map<string, string>();
  const highlights: SermonHighlight[] = [];
  let carried = 0;
  let leftBehind = 0;
  for (const group of groupHighlights(source.highlights)) {
    const groupId = newHighlightGroupId('sermon');
    const segments: SermonHighlight[] = [];
    for (const segment of group.segments) {
      const quote = segment.quote;
      const own = byVerse.get(segment.verseId);
      const found = own && quote && own[segment.language].includes(quote)
        ? own
        : quote ? texts.find((entry) => entry[segment.language].includes(quote)) : undefined;
      if (!found) continue;
      const start = found[segment.language].indexOf(quote);
      segments.push({
        ...segment,
        id: highlightSegmentId(groupId, segments.length),
        groupId,
        sectionId: found.sectionId,
        verseId: found.verseId,
        startOffset: start,
        endOffset: start + quote.length,
        note: segments.length === 0 ? group.lead.note : '',
        createdAt: target.now,
        updatedAt: target.now,
      });
    }
    if (segments.length) {
      groupIds.set(group.groupId, groupId);
      highlights.push(...segments);
      carried += 1;
    } else {
      leftBehind += 1;
    }
  }
  const plan: SermonPlan = {
    ...emptySermonPlan(target.id, target.isoDate, source.title),
    bigIdea: source.bigIdea,
    parts: source.parts.map((part) => ({
      ...part,
      highlightIds: part.highlightIds.map((id) => groupIds.get(id)).filter((id): id is string => Boolean(id)),
    })),
    highlights,
    createdAt: target.now,
    updatedAt: target.now,
  };
  return { plan, carried, leftBehind };
}
