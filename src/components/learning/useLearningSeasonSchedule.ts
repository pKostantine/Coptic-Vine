import { useEffect, useMemo, useState } from 'react';

import { useLiturgicalClock } from '@/context/LiturgicalClockContext';
import {
  getCopticDatesOfYear,
  getCopticYearForDate,
  getSeasonYear,
  peekCopticDatesOfYear,
  peekCopticYearForDate,
  peekSeasonYear,
} from '@/utils/calendarService';
import { scheduleLearningSeasons, type CalendarYear, type LearningSeasonSchedule } from '@/utils/learningSeasonDates';

/** A calendar that could not be read: every dated season undated, the annual sets Now. */
const UNREAD_YEAR: CalendarYear = { year: { startDate: '', endDate: '', seasons: [], events: [] }, dates: new Map() };

type Years = [CalendarYear, CalendarYear | null];

/** The Coptic year of a day and the one after it, if this session has already read them (the calendar is warmed at launch). */
function peekYears(isoDate: string): Years | null {
  const copticYear = peekCopticYearForDate(new Date(`${isoDate}T00:00:00Z`));
  if (copticYear === null) return null;
  const year = peekSeasonYear(copticYear);
  const dates = peekCopticDatesOfYear(copticYear);
  const nextYear = peekSeasonYear(copticYear + 1);
  const nextDates = peekCopticDatesOfYear(copticYear + 1);
  if (!year || !dates || !nextYear || !nextDates) return null;
  return [{ year, dates }, { year: nextYear, dates: nextDates }];
}

async function readYears(isoDate: string): Promise<Years> {
  const copticYear = await getCopticYearForDate(new Date(`${isoDate}T00:00:00Z`));
  if (copticYear === null) throw new Error(`No Coptic year for ${isoDate}`);
  const [year, dates, nextYear, nextDates] = await Promise.all([
    getSeasonYear(copticYear),
    getCopticDatesOfYear(copticYear),
    // A season past this year comes round in the next; without it, it is shown undated.
    getSeasonYear(copticYear + 1).catch(() => null),
    getCopticDatesOfYear(copticYear + 1).catch(() => null),
  ]);
  if (!year) throw new Error(`No calendar for ${copticYear} A.M.`);
  return [{ year, dates }, nextYear && nextDates ? { year: nextYear, dates: nextDates } : null];
}

/**
 * Where Learn & Study's seasons stand on the live liturgical day (Home's day,
 * which turns at Vespers, never the Books date): null until the calendar has
 * been read. Offline without the calendar, the annual sets are Now and
 * nothing is dated.
 */
export function useLearningSeasonSchedule(slugs: readonly string[] | null): LearningSeasonSchedule | null {
  const { liturgicalIso } = useLiturgicalClock();
  const [years, setYears] = useState<{ key: string; value: Years | null } | null>(() => {
    const peeked = peekYears(liturgicalIso);
    return peeked ? { key: liturgicalIso, value: peeked } : null;
  });

  useEffect(() => {
    let active = true;
    readYears(liturgicalIso).then(
      (value) => { if (active) setYears({ key: liturgicalIso, value }); },
      () => { if (active) setYears({ key: liturgicalIso, value: null }); },
    );
    return () => { active = false; };
  }, [liturgicalIso]);

  return useMemo(() => {
    if (!slugs || !years) return null;
    const [thisYear, nextYear] = years.value ?? [UNREAD_YEAR, null];
    return scheduleLearningSeasons(slugs, liturgicalIso, thisYear, nextYear);
  }, [slugs, years, liturgicalIso]);
}
