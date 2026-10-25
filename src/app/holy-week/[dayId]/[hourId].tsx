import { Href, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';

import NotFoundScreen from '@/components/vine/screens/NotFoundScreen';
import ServiceDocument from '@/components/vine/screens/ServiceDocument';
import { HOLY_WEEK_DAYS, HOLY_WEEK_HOURS } from '@/constants/manifest';
import { useCalendar } from '@/context/CalendarContext';
import { toIsoDate } from '@/utils/dateUtils';
import { holyWeekDate } from '@/utils/holyWeekDates';

export default function HolyWeekHourDocument() {
  const { dayId, hourId } = useLocalSearchParams<{ dayId: string; hourId: string }>();
  const hour = HOLY_WEEK_HOURS.find((entry) => entry.id === hourId && entry.dayId === dayId);
  // Read for the day it is prayed on in the coming Holy Week (from the
  // calendar's day, so a date picked there picks that year's Holy Week), not
  // for today: no season or fast of the day the book is opened on reaches in.
  const fromIso = toIsoDate(useCalendar().rawDate);
  const prayedOn = hour?.prayedOn;
  const conditionDate = useMemo(
    () => (prayedOn ? holyWeekDate(prayedOn, new Date(fromIso)) : undefined),
    [fromIso, prayedOn],
  );

  if (!hour) return <NotFoundScreen backHref="/holy-week" />;

  // A day that is a single service (Bright Saturday) opens straight from the menu, so back returns there.
  const isOnlyService = HOLY_WEEK_DAYS.find((day) => day.id === hour.dayId)?.hours.length === 1;

  return (
    <ServiceDocument
      schema={hour.schema}
      table={hour.table}
      title={hour.title}
      arabic={hour.arabic}
      french={hour.french}
      extraContext={hour.extraContext}
      conditionDate={conditionDate}
      entryId={hour.id}
      appendHyperlinkKey={hour.nextHyperlinkKey}
      // Holy Week's own services, prayed only in Holy Week: its colours,
      // whatever day the calendar is on.
      ornamentSeason="holyweek"
      backHref={(isOnlyService ? '/holy-week' : `/holy-week/${hour.dayId}`) as Href}
    />
  );
}
