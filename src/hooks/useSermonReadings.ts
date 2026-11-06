import { useEffect, useMemo, useState } from 'react';

import type { DocumentSection } from '@/components/vine/documentHtml';
import { useReadingPreferences } from '@/context/ReadingPreferencesContext';
import { hydrateSupabaseServiceHymn } from '@/utils/hymnLibrary';
import { getEpistleConditionFlags } from '@/utils/readingsService';
import { getServiceWeekdayConditionDate } from '@/utils/serviceConditionDates';
import { groupSermonReadings } from '@/utils/sermonReadings';
import { getUserConditionFlags } from '@/utils/userConditionFlags';

export type { SermonReading, SermonReadingKind, SermonReadingsByService } from '@/utils/sermonReadings';

type Loaded = { key: string; sections: DocumentSection[] | null; error: Error | null };

/** The planner's readings for a day, as the hook below and a carry over read them. */
export function loadSermonReadings(serviceDate: string, userConditionFlags: Record<string, boolean>): Promise<DocumentSection[]> {
  const date = new Date(`${serviceDate}T00:00:00Z`);
  const weekdayDate = getServiceWeekdayConditionDate({ schema: 'liturgy', table: 'sermon_planner', extraContext: undefined, effectiveDate: date });
  return getEpistleConditionFlags(date).then((epistleFlags) => hydrateSupabaseServiceHymn(
    'liturgy',
    'sermon_planner',
    date,
    { BishopPresent: true, CopticGospelRite: false, ...epistleFlags, ...userConditionFlags },
    weekdayDate,
  ));
}

/**
 * The day's readings for the planner, read as the Lectionary reads them: the
 * epistles' introductions for the day, the reader's own Book Settings
 * choices, and Vespers' weekday the evening's (serviceConditionDates.ts).
 */
export function useSermonReadings(serviceDate: string) {
  const { preferences } = useReadingPreferences();
  const userConditionFlags = useMemo(
    () => getUserConditionFlags(preferences),
    // The flags read only these.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [preferences.selectedSaintHymns, preferences.inMonastery, preferences.saintPsalies],
  );
  const flagsKey = JSON.stringify(userConditionFlags);
  const [reload, setReload] = useState(0);
  const key = `${serviceDate}:${flagsKey}:${reload}`;
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    let active = true;
    loadSermonReadings(serviceDate, userConditionFlags)
      .then(
        (sections: DocumentSection[]) => { if (active) setLoaded({ key, sections, error: null }); },
        (error: unknown) => { if (active) setLoaded({ key, sections: null, error: error instanceof Error ? error : new Error(String(error)) }); },
      );
    return () => { active = false; };
    // The key carries the flags.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const current = loaded?.key === key ? loaded : null;
  const sections = current?.sections ?? null;
  const readings = useMemo(() => (sections ? groupSermonReadings(sections) : null), [sections]);
  return {
    sections,
    readings,
    loading: !current,
    error: current?.error ?? null,
    retry: () => setReload((value) => value + 1),
  };
}
