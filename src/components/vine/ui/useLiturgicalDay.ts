'use no memo'; // Names the day in the App Language — see src/utils/appText.ts.
import { useEffect, useState } from 'react';

import { getDayTheme, type DayBlockTheme } from '../../../constants/seasonAppearance';
import { getSeasonIndicatorShortName } from '../../../constants/seasonNames';
import { useCalendar } from '../../../context/CalendarContext';
import { useReadingPreferences } from '../../../context/ReadingPreferencesContext';
import { getCopticDate, getDayOverview, type CopticDate, type DayOverview } from '../../../utils/calendarService';

export interface LiturgicalDay {
  /** The calendar day being shown, as an ISO date. At night it is still that day: 28 September's eve is not 29 September. */
  isoDate: string;
  date: Date;
  /** That day's Coptic date. */
  coptic: CopticDate | null;
  /** The day `coptic` is for: the day chosen once it is read, until then the last one -- so a heading pairing the two dates changes both at once. */
  copticDate: Date;
  /** The season and next season of the rite being prayed — after the eve toggle, the next morning's. */
  overview: DayOverview | null;
  theme: DayBlockTheme;
  /** The rite's season or feast, named short for the chip. */
  seasonLabel: string;
  /** Still reading the day just chosen: the values above are the last day's until it arrives. */
  loading: boolean;
}

/**
 * The day the Books block and the calendar sheet show, read once per day.
 * The date is the literal day (the eve toggle never turns 28 September into
 * the 29th); the season, its colours and the next season follow the rite being
 * prayed, which after the eve is the next morning's. Each value is kept with
 * the day it was read for, so a slow answer for a day the reader has already
 * left never paints over the new one. While a newly chosen day is being read,
 * the last day's values stay -- its Coptic date, its season and colours --
 * so the day block changes once, to the new day, rather than emptying and
 * filling again (and turning the Annual green for a moment between).
 */
export function useLiturgicalDay(): LiturgicalDay {
  const { rawDate, effectiveDate } = useCalendar();
  // Subscribing re-renders this on an App Language change, so the chip's name follows it.
  useReadingPreferences();
  const isoDate = rawDate.toISOString().slice(0, 10);
  const riteIso = effectiveDate.toISOString().slice(0, 10);
  const [coptic, setCoptic] = useState<{ key: string; value: CopticDate | null } | null>(null);
  const [overview, setOverview] = useState<{ key: string; value: DayOverview | null } | null>(null);

  useEffect(() => {
    let active = true;
    getCopticDate(new Date(`${isoDate}T00:00:00Z`))
      .then((value) => { if (active) setCoptic({ key: isoDate, value }); })
      .catch(() => { if (active) setCoptic({ key: isoDate, value: null }); });
    return () => { active = false; };
  }, [isoDate]);

  useEffect(() => {
    let active = true;
    getDayOverview(riteIso)
      .then((value) => { if (active) setOverview({ key: riteIso, value }); })
      .catch(() => { if (active) setOverview({ key: riteIso, value: null }); });
    return () => { active = false; };
  }, [riteIso]);

  // The last values read, whichever day they were for: the new day's replace them when they come.
  const dayOverview = overview?.value ?? null;
  return {
    isoDate,
    date: rawDate,
    coptic: coptic?.value ?? null,
    copticDate: coptic ? new Date(`${coptic.key}T00:00:00Z`) : rawDate,
    overview: dayOverview,
    theme: getDayTheme(dayOverview?.indicatorKey, dayOverview?.activeKeys),
    seasonLabel: getSeasonIndicatorShortName(dayOverview?.indicatorKey),
    loading: coptic?.key !== isoDate || overview?.key !== riteIso,
  };
}
