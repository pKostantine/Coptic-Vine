import type { LiturgicalDayPeriod } from '../context/CalendarContext';

/**
 * On the web, a day chosen away from live is written into the page's address
 * as `?day=8nov2026-morning` (or `-evening`, its eve), so the link can be
 * shared or the page reloaded on the same day. Live writes nothing.
 */
export const DAY_PARAM = 'day';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export interface UrlDay {
  /** The Gregorian day at UTC midnight, as CalendarContext keeps it. */
  date: Date;
  period: LiturgicalDayPeriod;
}

export function formatDayParam(date: Date, period: LiturgicalDayPeriod): string {
  return `${date.getUTCDate()}${MONTHS[date.getUTCMonth()]}${date.getUTCFullYear()}-${period}`;
}

function utcDay(year: number, month: number, day: number): Date | null {
  const date = new Date(Date.UTC(year, month, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) return null;
  if (year < 1900 || year > 2200) return null;
  return date;
}

/** Reads `8nov2026-morning`, `8nov2026evening`, `8nov2026`, or `2026-11-08-eve`; null when it isn't a day. */
export function parseDayParam(value: string | null | undefined): UrlDay | null {
  if (!value) return null;
  const text = value.trim().toLowerCase();
  const periodMatch = /[-_ ]?(morning|evening|eve)$/.exec(text);
  const period: LiturgicalDayPeriod = periodMatch && periodMatch[1] !== 'morning' ? 'evening' : 'morning';
  const day = periodMatch ? text.slice(0, periodMatch.index) : text;

  const named = /^(\d{1,2})([a-z]{3})[a-z]*(\d{4})$/.exec(day);
  if (named) {
    const month = MONTHS.indexOf(named[2]);
    if (month < 0) return null;
    const date = utcDay(Number(named[3]), month, Number(named[1]));
    return date ? { date, period } : null;
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (iso) {
    const date = utcDay(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return date ? { date, period } : null;
  }
  return null;
}

/** The day in the address the web page was opened at; null off the web or with none. */
export function readDayFromAddress(): UrlDay | null {
  if (typeof window === 'undefined' || !window.location) return null;
  try {
    return parseDayParam(new URLSearchParams(window.location.search).get(DAY_PARAM));
  } catch {
    return null;
  }
}

/** The address `href` with its day set to `day`, or taken out when null. */
export function addressWithDay(href: string, day: string | null): string {
  const url = new URL(href);
  if (day) url.searchParams.set(DAY_PARAM, day);
  else url.searchParams.delete(DAY_PARAM);
  return url.pathname + url.search + url.hash;
}
