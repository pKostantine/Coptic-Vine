import { useEffect, useState } from 'react';

import { documentOrnamentColor } from '@/constants/documentOrnaments';
import { NIGHT_DOCUMENT_THEME } from '@/constants/documentThemes';
import { DAY_BLOCK_THEMES, getDayThemeKey, type DayBlockTheme, type SeasonThemeKey } from '@/constants/seasonAppearance';
import { EVENT_FORMAL_NAMES, EVENT_SHORT_NAMES, SEASON_FORMAL_NAMES } from '@/constants/seasonNames';
import { getCopticDate, getDayOverview, type CopticDate, type DayOverview } from '@/utils/calendarService';

/** What the planner shows of a day: its Coptic date, its season's colours, and the name a plan for it opens with. */
export interface SermonDay {
  isoDate: string;
  coptic: CopticDate | null;
  overview: DayOverview | null;
  seasonKey: SeasonThemeKey;
  theme: DayBlockTheme;
  /** The season's ornament colour on black (the reading's title, as the reader draws it). */
  ornament: string;
  loading: boolean;
}

const cache = new Map<string, Promise<{ coptic: CopticDate | null; overview: DayOverview | null }>>();
const settled = new Map<string, { coptic: CopticDate | null; overview: DayOverview | null }>();

function readDay(isoDate: string) {
  let pending = cache.get(isoDate);
  if (!pending) {
    pending = Promise.all([
      getCopticDate(new Date(`${isoDate}T00:00:00Z`)).catch(() => null),
      getDayOverview(isoDate).catch(() => null),
    ]).then(([coptic, overview]) => {
      const value = { coptic, overview };
      settled.set(isoDate, value);
      return value;
    });
    cache.set(isoDate, pending);
  }
  return pending;
}

function dayFor(isoDate: string, value: { coptic: CopticDate | null; overview: DayOverview | null } | undefined): SermonDay {
  const seasonKey = getDayThemeKey(value?.overview?.indicatorKey);
  return {
    isoDate,
    coptic: value?.coptic ?? null,
    overview: value?.overview ?? null,
    seasonKey,
    theme: DAY_BLOCK_THEMES[seasonKey],
    ornament: documentOrnamentColor(NIGHT_DOCUMENT_THEME, seasonKey),
    loading: !value,
  };
}

/** The day, read once and kept for the session (the Plans list reads one for each plan). */
export function useSermonDay(isoDate: string): SermonDay {
  const [value, setValue] = useState(() => settled.get(isoDate));
  const [valueFor, setValueFor] = useState(isoDate);
  if (valueFor !== isoDate) {
    setValueFor(isoDate);
    setValue(settled.get(isoDate));
  }
  useEffect(() => {
    let active = true;
    void readDay(isoDate).then((next) => { if (active) setValue(next); });
    return () => { active = false; };
  }, [isoDate]);
  return dayFor(isoDate, value);
}

/**
 * The name a plan opens with: the feast the day is named for ("Feast of the
 * Annunciation"), a Sunday's season ("Sunday of Great Lent"), or "Weekday
 * Liturgy"; the preacher can call it anything.
 */
export function sermonDayName(day: SermonDay, arabic: boolean): string {
  const key = day.overview?.indicatorKey ?? null;
  const event = key ? EVENT_FORMAL_NAMES[key] ?? EVENT_SHORT_NAMES[key] : null;
  if (event) return arabic ? event.arabic || event.english : event.english;
  const sunday = new Date(`${day.isoDate}T00:00:00Z`).getUTCDay() === 0;
  const season = key ? SEASON_FORMAL_NAMES[key] : null;
  if (sunday) {
    if (season) return arabic ? `أحد ${season.arabic}` : `Sunday of ${season.english}`;
    return arabic ? 'قداس الأحد' : 'Sunday Liturgy';
  }
  return arabic ? 'قداس أيام الأسبوع' : 'Weekday Liturgy';
}

/** "Parem." for Paremhotep: a month name short enough for the plan's date tile. */
export function shortCopticMonth(monthName: string): string {
  return monthName.length > 6 ? `${monthName.slice(0, 5)}.` : monthName;
}
