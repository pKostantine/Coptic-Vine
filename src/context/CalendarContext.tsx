import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { markPendingDocumentRestoresDirty } from '../utils/lastDocumentPosition';
import { useLiturgicalClock } from './LiturgicalClockContext';

export type LiturgicalDayPeriod = 'morning' | 'evening';

interface CalendarContextValue {
  /** null means "live" — always resolves to today. A concrete Date pins the app to that day. */
  selectedDate: Date | null;
  /** The literal Gregorian date being viewed (today, when live) — never rolled forward. */
  rawDate: Date;
  /**
   * The liturgical date most documents should hydrate against, and whose
   * Coptic date is shown: the liturgical day begins the evening before
   * (normally at 6 PM — utils/liturgicalDay.ts), so once
   * `liturgicalDayPeriod` is "evening" this is `rawDate + 1`.
   */
  effectiveDate: Date;
  /**
   * Always `rawDate`, never rolled forward. Vespers still chants in the raw
   * day's weekday tune when evening has rolled `effectiveDate` forward.
   * Vespers Praises has its own previous-day weekday override in
   * serviceConditionDates.ts.
   */
  vespersEffectiveDate: Date;
  liturgicalDayPeriod: LiturgicalDayPeriod;
  isLive: boolean;
  selectDate: (date: Date) => void;
  goLive: () => void;
  setLiturgicalDayPeriod: (period: LiturgicalDayPeriod) => void;
}

const CalendarContext = createContext<CalendarContextValue | null>(null);

function addOneDay(date: Date): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

export function CalendarProvider({ children }: { children: React.ReactNode }) {
  const clock = useLiturgicalClock();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  // The eve toggle's choice; null leaves the period to the clock while live, and to the morning on a chosen day.
  const [manualPeriod, setManualPeriod] = useState<LiturgicalDayPeriod | null>(null);

  const isLive = selectedDate === null;
  const rawDate = selectedDate ?? clock.today;
  const todayIso = clock.today.toISOString().slice(0, 10);
  const liturgicalDayPeriod: LiturgicalDayPeriod = manualPeriod ?? (isLive && clock.evening ? 'evening' : 'morning');

  // While live, the clock turns the period at the start of the liturgical
  // day without a fresh load; a document left open behind it restores anew.
  const autoPeriodRef = useRef(liturgicalDayPeriod);
  useEffect(() => {
    if (autoPeriodRef.current !== liturgicalDayPeriod && isLive && manualPeriod === null) markPendingDocumentRestoresDirty();
    autoPeriodRef.current = liturgicalDayPeriod;
  }, [liturgicalDayPeriod, isLive, manualPeriod]);

  const selectDate = useCallback((date: Date) => {
    markPendingDocumentRestoresDirty();
    setSelectedDate(date);
    setManualPeriod(null);
  }, []);

  const goLive = useCallback(() => {
    markPendingDocumentRestoresDirty();
    setSelectedDate(null);
    setManualPeriod(null);
  }, []);

  const setLiturgicalDayPeriod = useCallback((period: LiturgicalDayPeriod) => {
    markPendingDocumentRestoresDirty();
    setManualPeriod(period);
  }, []);

  const value = useMemo<CalendarContextValue>(() => {
    const effectiveDate = liturgicalDayPeriod === 'evening' ? addOneDay(rawDate) : rawDate;
    return {
      selectedDate,
      rawDate,
      effectiveDate,
      vespersEffectiveDate: rawDate,
      liturgicalDayPeriod,
      isLive,
      selectDate,
      goLive,
      setLiturgicalDayPeriod,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rawDate is a plain derivation of selectedDate and todayIso, both listed
  }, [selectedDate, todayIso, liturgicalDayPeriod, isLive, selectDate, goLive, setLiturgicalDayPeriod]);

  return <CalendarContext.Provider value={value}>{children}</CalendarContext.Provider>;
}

export function useCalendar() {
  const ctx = useContext(CalendarContext);
  if (!ctx) throw new Error('useCalendar must be used within a CalendarProvider');
  return ctx;
}
