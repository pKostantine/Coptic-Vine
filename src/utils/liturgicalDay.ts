import type { LectionaryService } from './readingsService';

/**
 * The liturgical day, and what the Church prays at each hour of it (Coptic
 * Vine design, "Home v2" — the Pray now spec). Kept pure, so its rules can
 * be read and tested: the calendar's flags for a day come in through
 * `dayFacts`, and the clock is the caller's.
 *
 * The liturgical day begins the evening before: normally at 6 PM, so at
 * 6:08 PM on Sunday 18 October the Coptic date is already Monday's,
 * Paope 9. Earlier on four kinds of day:
 * - a Saturday in Kiahk or Great Lent: at 3 PM;
 * - the day before the Feast of the Nativity, and before Theophany: at 3 PM;
 * - Bright Saturday: at 10 AM, when the Feast of the Resurrection begins.
 */

/** What the rules need to know about a Gregorian day, read from its calendar flags. */
export interface DayFacts {
  /** 0 for Sunday to 6 for Saturday. */
  weekday: number;
  /** KiahkSeason: Kiahk 1 up to the Paramoun of the Nativity. */
  kiahk: boolean;
  greatLent: boolean;
  /** The Feast of the Nativity itself. */
  nativity: boolean;
  /** The Feast of Theophany itself. */
  theophany: boolean;
  palmSunday: boolean;
  /** Holy Monday to Bright Saturday (the HolyWeek flag). */
  holyWeek: boolean;
}

/** A day known only by its weekday: no flags could be read for it. */
export function plainDayFacts(date: Date): DayFacts {
  return { weekday: date.getUTCDay(), kiahk: false, greatLent: false, nativity: false, theophany: false, palmSunday: false, holyWeek: false };
}

/** A day's facts from its context flags (conditionEngine's getContextFlags). `date` is the day at UTC midnight. */
export function dayFacts(date: Date, flags: Record<string, unknown>): DayFacts {
  return {
    weekday: date.getUTCDay(),
    kiahk: Boolean(flags.KiahkSeason),
    greatLent: Boolean(flags.GreatLent),
    nativity: Boolean(flags.Nativity),
    theophany: Boolean(flags.Theophany),
    palmSunday: Boolean(flags.PalmSunday),
    holyWeek: Boolean(flags.HolyWeek),
  };
}

const HOUR = 60;
const SATURDAY = 6;

/** The minutes since local midnight on the clock. */
export function minutesOfDay(now: Date): number {
  return now.getHours() * HOUR + now.getMinutes();
}

/**
 * When, on `today`, the next liturgical day begins — and with it the next
 * Coptic date — in minutes after midnight.
 */
export function nextDayBeginsAt(today: DayFacts, tomorrow: DayFacts): number {
  // Bright Saturday: the Feast of the Resurrection begins at 10 AM.
  if (today.holyWeek && today.weekday === SATURDAY) return 10 * HOUR;
  if (tomorrow.nativity || tomorrow.theophany) return 15 * HOUR;
  if (today.weekday === SATURDAY && (today.kiahk || today.greatLent)) return 15 * HOUR;
  return 18 * HOUR;
}

/** Whether the clock is past the start of the next liturgical day: its eve. */
export function isLiturgicalEvening(now: Date, today: DayFacts, tomorrow: DayFacts): boolean {
  return minutesOfDay(now) >= nextDayBeginsAt(today, tomorrow);
}

/** A Holy Week day or eve, by its id in the manifest's HOLY_WEEK_DAYS. */
export type HolyWeekDayId =
  | 'monday-eve' | 'monday'
  | 'tuesday-eve' | 'tuesday'
  | 'wednesday-eve' | 'wednesday'
  | 'thursday-eve' | 'holy-thursday'
  | 'friday-eve' | 'good-friday'
  | 'bright-saturday';

/** A service of the day, by the name Home gives it. */
export type DailyServiceId =
  | 'vespers_praises'
  | 'vespers'
  | 'midnight_praises'
  | 'matins'
  | 'offering_of_the_lamb'
  /** Theophany's Liturgy of the Waters, the Lakkan. */
  | 'liturgy_of_the_waters';

export type PrayNowService =
  | { kind: 'service'; id: DailyServiceId }
  | { kind: 'holyWeek'; dayId: HolyWeekDayId };

const service = (id: DailyServiceId): PrayNowService => ({ kind: 'service', id });
const holyWeek = (dayId: HolyWeekDayId): PrayNowService => ({ kind: 'holyWeek', dayId });

/** Each weekday of Holy Week from Monday to Friday: its eve, then the day. */
const HOLY_WEEK_EVES: Record<number, HolyWeekDayId> = { 1: 'monday-eve', 2: 'tuesday-eve', 3: 'wednesday-eve', 4: 'thursday-eve', 5: 'friday-eve' };
const HOLY_WEEK_DAYS: Record<number, HolyWeekDayId> = { 1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'holy-thursday', 5: 'good-friday' };

/**
 * The eve of a Great Feast, from the liturgical day's start (3 PM before the
 * Nativity and Theophany, 10 AM on Bright Saturday for the Resurrection).
 * The table runs to the end of the eve's own day: when it hands back to the
 * ordinary hours is not yet specified.
 */
function greatFeastEve(feast: 'nativity' | 'theophany' | 'resurrection', minutes: number): PrayNowService {
  if (feast === 'resurrection') {
    if (minutes < 19 * HOUR) return service('midnight_praises');
    if (minutes < 20 * HOUR) return service('matins');
    return service('offering_of_the_lamb');
  }
  if (minutes < 17 * HOUR) return service('vespers_praises');
  if (minutes < 18 * HOUR) return service('vespers');
  if (minutes < 19 * HOUR) return service('midnight_praises');
  if (feast === 'theophany') {
    if (minutes < 20 * HOUR) return service('liturgy_of_the_waters');
    if (minutes < 21 * HOUR) return service('matins');
    return service('offering_of_the_lamb');
  }
  if (minutes < 20 * HOUR) return service('matins');
  return service('offering_of_the_lamb');
}

/**
 * The service for this time of day, Home's second Pray now row. Each window
 * includes its start and ends just before its end.
 *
 * Normal days: Vespers Praises from the liturgical day's start (6 PM, or
 * 3 PM on a Saturday in Kiahk or Great Lent) to 7 PM, Vespers to 8:30 PM,
 * Midnight Praises to 5 AM, Matins to 9 AM, then the Offering of the Lamb.
 *
 * Holy Week, from Palm Sunday at 3 PM to Bright Saturday at 10 AM: the eve
 * of the next day from 3 PM to 1 AM, the day itself from 1 AM to 3 PM —
 * except Good Friday, from 1 AM to 7 PM, and Bright Saturday from then to
 * 10 AM on Saturday, when the Feast of the Resurrection begins.
 */
export function prayNowService(now: Date, today: DayFacts, tomorrow: DayFacts): PrayNowService {
  const minutes = minutesOfDay(now);

  if (today.palmSunday && minutes >= 15 * HOUR) return holyWeek('monday-eve');
  if (today.holyWeek) {
    const { weekday } = today;
    if (weekday === SATURDAY) return minutes < 10 * HOUR ? holyWeek('bright-saturday') : greatFeastEve('resurrection', minutes);
    if (weekday === 5) {
      if (minutes < 1 * HOUR) return holyWeek('friday-eve');
      return minutes < 19 * HOUR ? holyWeek('good-friday') : holyWeek('bright-saturday');
    }
    if (weekday >= 1 && weekday <= 4) {
      if (minutes < 1 * HOUR) return holyWeek(HOLY_WEEK_EVES[weekday]);
      return minutes < 15 * HOUR ? holyWeek(HOLY_WEEK_DAYS[weekday]) : holyWeek(HOLY_WEEK_EVES[weekday + 1]);
    }
  }

  if (minutes >= 15 * HOUR && tomorrow.nativity) return greatFeastEve('nativity', minutes);
  if (minutes >= 15 * HOUR && tomorrow.theophany) return greatFeastEve('theophany', minutes);

  const vespersPraises = nextDayBeginsAt(today, tomorrow);
  if (minutes >= vespersPraises && minutes < 19 * HOUR) return service('vespers_praises');
  if (minutes >= 19 * HOUR && minutes < 20 * HOUR + 30) return service('vespers');
  if (minutes >= 20 * HOUR + 30 || minutes < 5 * HOUR) return service('midnight_praises');
  if (minutes < 9 * HOUR) return service('matins');
  return service('offering_of_the_lamb');
}

/**
 * The service whose readings are being prayed, and so the one Home's
 * readings card opens on: Vespers on the eve, Matins early in the morning,
 * otherwise the Liturgy.
 */
export function readingsServiceAt(now: Date, evening: boolean): LectionaryService {
  if (evening) return 'Vespers';
  if (now.getHours() < 9) return 'Matins';
  return 'Liturgy';
}
