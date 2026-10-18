import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { getContextFlags } from '../utils/conditionEngine';
import { addUtcDays, localDateAtUtcMidnight } from '../utils/dateUtils';
import { dayFacts, isLiturgicalEvening, plainDayFacts, type DayFacts } from '../utils/liturgicalDay';

export interface LiturgicalClock {
  /** The clock, to the minute. */
  now: Date;
  /** The civil day, at UTC midnight. */
  today: Date;
  /** Today's facts and tomorrow's, once their flags are read; until then their weekdays alone. */
  todayFacts: DayFacts;
  tomorrowFacts: DayFacts;
  /** The clock is past the start of the next liturgical day: this is its eve. */
  evening: boolean;
  /** The Gregorian day the liturgical day is kept on: tomorrow, on its eve. Its Coptic date is the one shown. */
  liturgicalDate: Date;
  liturgicalIso: string;
}

const LiturgicalClockContext = createContext<LiturgicalClock | null>(null);

function isoOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Today's and tomorrow's facts, from their calendar flags; their weekdays alone when the flags can't be read. */
async function readFacts(today: Date): Promise<[DayFacts, DayFacts]> {
  const tomorrow = addUtcDays(today, 1);
  const read = (date: Date) => getContextFlags(isoOf(date)).then((flags) => dayFacts(date, flags)).catch(() => plainDayFacts(date));
  return Promise.all([read(today), read(tomorrow)]);
}

/**
 * The live liturgical day (utils/liturgicalDay.ts), for everything that shows
 * the believer's own day rather than the Books date: Home, the sidebar, the
 * Synaxarium, and the Books themselves while they are live. It ticks each
 * minute, and again as the app comes back to the foreground.
 */
export function LiturgicalClockProvider({ children }: { children: React.ReactNode }) {
  const [now, setNow] = useState(() => new Date());
  const [facts, setFacts] = useState<{ key: string; today: DayFacts; tomorrow: DayFacts } | null>(null);
  const today = localDateAtUtcMidnight(now);
  const todayIso = isoOf(today);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(new Date());
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    let active = true;
    void readFacts(new Date(`${todayIso}T00:00:00Z`)).then(([todayFacts, tomorrowFacts]) => {
      if (active) setFacts({ key: todayIso, today: todayFacts, tomorrow: tomorrowFacts });
    });
    return () => { active = false; };
  }, [todayIso]);

  const value = useMemo<LiturgicalClock>(() => {
    const day = new Date(`${todayIso}T00:00:00Z`);
    const current = facts?.key === todayIso ? facts : null;
    const todayFacts = current?.today ?? plainDayFacts(day);
    const tomorrowFacts = current?.tomorrow ?? plainDayFacts(addUtcDays(day, 1));
    const evening = isLiturgicalEvening(now, todayFacts, tomorrowFacts);
    const liturgicalDate = evening ? addUtcDays(day, 1) : day;
    return { now, today: day, todayFacts, tomorrowFacts, evening, liturgicalDate, liturgicalIso: isoOf(liturgicalDate) };
  }, [now, todayIso, facts]);

  return <LiturgicalClockContext.Provider value={value}>{children}</LiturgicalClockContext.Provider>;
}

export function useLiturgicalClock(): LiturgicalClock {
  const clock = useContext(LiturgicalClockContext);
  if (!clock) throw new Error('useLiturgicalClock must be used within a LiturgicalClockProvider');
  return clock;
}
