'use no memo'; // Names the service in the App Language — see src/utils/appText.ts.
import { useEffect, useState } from 'react';

import { HOLY_WEEK_DAYS, HYPERLINK_TARGETS, holyWeekDayHref, type HyperlinkTarget } from '@/constants/manifest';
import { useLiturgicalClock, type LiturgicalClock } from '@/context/LiturgicalClockContext';
import { appText, entryLabel } from '@/utils/appText';
import { getCopticDate, type CopticDate } from '@/utils/calendarService';
import { prayNowService, type DailyServiceId, type HolyWeekDayId, type PrayNowService } from '@/utils/liturgicalDay';

export interface PrayNowEntry {
  title: string;
  /** Where its Pray button goes; null for a service the app does not have. */
  href: string | null;
}

export interface LiturgicalNow extends LiturgicalClock {
  /** The liturgical day's Coptic date, once read. */
  coptic: CopticDate | null;
  /** The Church's service at this time of day: Home's second Pray now row. */
  service: PrayNowEntry;
}

const DAILY_SERVICES: Record<Exclude<DailyServiceId, 'liturgy_of_the_waters'>, HyperlinkTarget> = {
  vespers_praises: HYPERLINK_TARGETS.VESPERS_PRAISES,
  vespers: HYPERLINK_TARGETS.VESPERS,
  midnight_praises: HYPERLINK_TARGETS.MIDNIGHT_PRAISES,
  matins: HYPERLINK_TARGETS.MATINS,
  offering_of_the_lamb: HYPERLINK_TARGETS.OFFERING_OF_THE_LAMB,
};

/**
 * Holy Week's days and eves as Pray now names them: "Eve of Tuesday",
 * "Tuesday of Holy Week". Where the Holy Week menu's own name says as much
 * (Holy Thursday, Good Friday, the eves in French and Arabic) it is kept.
 */
const HOLY_WEEK_NAMES: Partial<Record<HolyWeekDayId, { english: string; french?: string; arabic?: string }>> = {
  'monday-eve': { english: 'Eve of Monday' },
  monday: { english: 'Monday of Holy Week', french: 'Lundi saint', arabic: 'يوم الاثنين من البصخة' },
  'tuesday-eve': { english: 'Eve of Tuesday' },
  tuesday: { english: 'Tuesday of Holy Week', french: 'Mardi saint', arabic: 'يوم الثلاثاء من البصخة' },
  'wednesday-eve': { english: 'Eve of Wednesday' },
  wednesday: { english: 'Wednesday of Holy Week', french: 'Mercredi saint', arabic: 'يوم الأربعاء من البصخة' },
  'thursday-eve': { english: 'Eve of Thursday' },
  'friday-eve': { english: 'Eve of Good Friday' },
};

export function prayNowEntry(service: PrayNowService): PrayNowEntry {
  if (service.kind === 'holyWeek') {
    const day = HOLY_WEEK_DAYS.find((candidate) => candidate.id === service.dayId);
    const name = HOLY_WEEK_NAMES[service.dayId];
    const title = appText({
      english: name?.english ?? day?.title ?? service.dayId,
      french: name?.french ?? day?.french,
      arabic: name?.arabic ?? day?.arabic ?? '',
    });
    return { title, href: day ? holyWeekDayHref(day) : null };
  }
  // Theophany's Lakkan has no page of its own in the app yet.
  if (service.id === 'liturgy_of_the_waters') {
    return { title: appText({ english: 'Liturgy of the Waters (Lakkan)', french: 'Liturgie du Lakan', arabic: 'قداس اللقان' }), href: null };
  }
  const target = DAILY_SERVICES[service.id];
  return { title: entryLabel(target), href: target.href };
}

/**
 * The live liturgical day with its Coptic date, and what to pray now: the
 * believer's own day, whatever date the Books screen has been moved to.
 */
export function useLiturgicalNow(): LiturgicalNow {
  const clock = useLiturgicalClock();
  const [coptic, setCoptic] = useState<{ key: string; value: CopticDate | null } | null>(null);
  const iso = clock.liturgicalIso;

  useEffect(() => {
    let active = true;
    void getCopticDate(new Date(`${iso}T00:00:00Z`)).then((value) => { if (active) setCoptic({ key: iso, value }); });
    return () => { active = false; };
  }, [iso]);

  return {
    ...clock,
    coptic: coptic?.key === iso ? coptic.value : null,
    service: prayNowEntry(prayNowService(clock.now, clock.todayFacts, clock.tomorrowFacts)),
  };
}
