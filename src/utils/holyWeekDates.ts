import { addUtcDays } from './dateUtils';

/**
 * When Holy Week falls. Its services are read for the day they are prayed
 * on, whatever day the app is opened on (app/holy-week/[dayId]/[hourId]):
 * the calendar's flags for that day, not today's, so a season or a fast of
 * the day the book happens to be opened on (the Season of the Air, say)
 * never reaches into Holy Week.
 */

/** The days of Holy Week a service can be prayed on, by their condition tokens. */
export type HolyWeekDay = 'PalmSunday' | 'HolyMonday' | 'HolyTuesday' | 'HolyWednesday' | 'HolyThursday' | 'GoodFriday' | 'BrightSaturday';

const DAYS_BEFORE_THE_FEAST: Record<HolyWeekDay, number> = {
  PalmSunday: 7,
  HolyMonday: 6,
  HolyTuesday: 5,
  HolyWednesday: 4,
  HolyThursday: 3,
  GoodFriday: 2,
  BrightSaturday: 1,
};

/**
 * The Feast of the Resurrection in a Gregorian year, at UTC midnight: the
 * Julian computus the Church keeps (Meeus), moved onto the Gregorian
 * calendar (13 days from 1900 to 2099).
 */
export function copticEaster(year: number): Date {
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;
  const julianToGregorian = Math.floor(year / 100) - Math.floor(year / 400) - 2;
  return new Date(Date.UTC(year, month - 1, day + julianToGregorian));
}

/**
 * The date a Holy Week day falls on in the Holy Week to come from `from` (a
 * date at UTC midnight), or the one under way: the year's own until its
 * Bright Saturday is over, then the next year's.
 */
export function holyWeekDate(day: HolyWeekDay, from: Date): Date {
  const year = from.getUTCFullYear();
  const thisYear = copticEaster(year);
  const feast = from.getTime() < thisYear.getTime() ? thisYear : copticEaster(year + 1);
  return addUtcDays(feast, -DAYS_BEFORE_THE_FEAST[day]);
}
