'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import BookPage, { BookRow, ReadingRow, RowList, SectionHeading } from './BookPage';
import CalendarSheet from '../ui/CalendarSheet';
import DayControls from '../ui/DayControls';
import Icon from '../ui/Icon';
import TodayCard from '../ui/TodayCard';
import { useLiturgicalDay } from '../ui/useLiturgicalDay';
import { bookmarkKeyFor, SERVICES_BY_CATEGORY, type ServiceDef } from '../../../constants/manifest';
import { COLORS } from '../../../constants/theme';
import { useCalendar } from '../../../context/CalendarContext';
import { useReadingPreferences } from '../../../context/ReadingPreferencesContext';
import { appText, entryLabel, tr } from '../../../utils/appText';
import { LECTIONARY_ROUTE_IDS, lectionaryHref, readingLinesFor, type ReadingLine } from '../../../utils/lectionaryOutline';
import { formatCopticDayMonth, formatDayMonthYearDate } from '../../../utils/localeFormat';
import { getServiceReadingCitations, type LectionaryService, type ReadingCitation } from '../../../utils/readingsService';

type DayReadings = { key: string; citations: Record<LectionaryService, ReadingCitation[]> };

/**
 * The Lectionary (Coptic Vine design, "Book Pages"): the day it reads — stepped a day
 * at a time — then each service's readings, reading by reading, each opening
 * the service at that reading. Vespers and Matins each read a Psalm and a
 * Gospel (a Lenten Matins its prophecies first); the Liturgy the Pauline,
 * Catholic, Acts, Psalm and Gospel. Then the books read alongside them: the
 * Antiphonary and the Sermon Planner.
 */
export default function LectionaryMenu() {
  const router = useRouter();
  const { preferences, isBookmarked } = useReadingPreferences();
  const { effectiveDate } = useCalendar();
  const day = useLiturgicalDay();
  const arabic = preferences.appLanguage === 'ar';
  const services = SERVICES_BY_CATEGORY.lectionary;
  const byId = (id: string) => services.find((service) => service.id === id);
  const bookmarked = (service: ServiceDef) => isBookmarked(bookmarkKeyFor(service.schema, service.table, service.id));
  const open = (service: ServiceDef) => router.push(`/lectionary/${service.id}` as never);
  const openReading = (service: LectionaryService, line: ReadingLine) => router.push(lectionaryHref(service, line) as never);
  // The readings are the rite's: after the eve, the next morning's.
  const dateKey = effectiveDate.toISOString().slice(0, 10);
  const [readings, setReadings] = useState<DayReadings | null>(null);
  // The date on the day card opens the calendar, to read any day's readings.
  const [calendarOpen, setCalendarOpen] = useState(false);

  useEffect(() => {
    let active = true;
    getServiceReadingCitations(new Date(`${dateKey}T00:00:00Z`))
      .then((citations) => { if (active) setReadings({ key: dateKey, citations }); })
      // The citations are a preview; the services open fine without them.
      .catch(() => undefined);
    return () => { active = false; };
  }, [dateKey]);

  const today = readings?.key === dateKey ? readings : null;

  const serviceSection = (service: LectionaryService) => {
    const def = byId(LECTIONARY_ROUTE_IDS[service]);
    if (!def) return null;
    const lines = readingLinesFor(service, today?.citations[service], arabic);
    // "PROPHECY 2" is wider than the other kinds; its list makes room for it.
    const kindWidth = lines.some((line) => line.key.startsWith('Prophecy')) ? 96 : 74;
    return (
      <View key={service}>
        <SectionHeading
          title={entryLabel(def)}
          arabic={arabic}
          trailing={bookmarked(def) ? <Icon name="bookmark" size={14} color={COLORS.gold} /> : undefined}
        />
        <RowList>
          {lines.map((line) => (
            <ReadingRow
              key={line.key}
              kind={appText(line.label)}
              value={line.value}
              arabic={arabic}
              kindWidth={kindWidth}
              onPress={() => openReading(service, line)}
            />
          ))}
        </RowList>
      </View>
    );
  };

  const antiphonary = byId('antiphonary');
  const sermonPlanner = byId('sermon_planner');

  return (
    <BookPage
      title={{ english: 'Lectionary', arabic: 'القطمارس', french: 'Lectionnaire' }}
      kicker={tr('Today’s Readings', 'Lectures du jour', 'قراءات اليوم')}
      arabic={arabic}
      backHref="/books"
      aside={(
          <TodayCard
            theme={day.theme}
            arabic={arabic}
            controls={(
              <DayControls
                theme={day.theme}
                arabic={arabic}
                seasonLabel={day.seasonLabel}
                onOpenSeasons={() => router.push('/season-selector')}
                trailing="arrows"
              />
            )}
            heading={day.coptic ? formatCopticDayMonth(day.coptic.monthName, day.coptic.day, arabic) : ' '}
            subheading={formatDayMonthYearDate(day.date, arabic)}
            onPressHeading={() => setCalendarOpen(true)}
            headingAccessibilityLabel={tr('Choose the day', 'Choisir le jour', 'اختر اليوم')}
          />
      )}
    >

      {serviceSection('Vespers')}
      {serviceSection('Matins')}
      {serviceSection('Liturgy')}

      <SectionHeading title={tr('With the Readings', 'Avec les lectures', 'مع القراءات')} arabic={arabic} />
      <RowList>
        {antiphonary ? (
          <BookRow icon="musical-notes-outline" title={entryLabel(antiphonary)} arabic={arabic} bookmarked={bookmarked(antiphonary)} onPress={() => open(antiphonary)} />
        ) : null}
        {sermonPlanner ? (
          <BookRow icon="create-outline" title={entryLabel(sermonPlanner)} arabic={arabic} bookmarked={bookmarked(sermonPlanner)} onPress={() => open(sermonPlanner)} />
        ) : null}
      </RowList>
      <CalendarSheet visible={calendarOpen} onClose={() => setCalendarOpen(false)} onOpenSeasons={() => router.push('/season-selector')} />
    </BookPage>
  );
}
