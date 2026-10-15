'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, PanResponder, type PanResponderGestureState } from 'react-native';

import { useCalendar } from '../../../context/CalendarContext';
import { appText, tr } from '../../../utils/appText';
import { getWeekStrip, type WeekStripDay } from '../../../utils/calendarService';
import { formatCopticDayMonth, formatDayMonthYearDate, toEasternArabicDigits } from '../../../utils/localeFormat';
import { NEXT_SEASON_NAMES } from '../../../utils/nextSeason';
import { motionDuration, useReducedMotion } from '../../../utils/useReducedMotion';
import DayControls from './DayControls';
import TodayCard, { DayStrip, type DayStripItem } from './TodayCard';
import type { LiturgicalDay } from './useLiturgicalDay';

const WEEKDAYS = {
  english: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  french: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'],
  arabic: ['أحد', 'إثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت'],
};

/** The Sunday that opens the week a day falls in. */
function weekStartOf(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - date.getUTCDay());
  return date.toISOString().slice(0, 10);
}

/** The week's seven days from its Sunday, as ISO dates. */
function weekDates(start: string): string[] {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${start}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
}

interface DayBlockProps {
  /** The liturgical day, from useLiturgicalDay — the screen reads it once and shares it. */
  day: LiturgicalDay;
  arabic: boolean;
  onOpenCalendar: () => void;
  onOpenSeasons: () => void;
  /** A gold button in the footer — during Pascha, the way into the hour being prayed. */
  action?: { label: string; onPress: () => void };
}

/**
 * The top of the Books screen: the liturgical day the books are read against
 * (Coptic Vine design, "Books"). Live, the season and the eve toggle; the Coptic day
 * large over the Gregorian; the week around it, each day selectable; and the
 * next great season with a day count. It wears the day's season colours
 * (seasonAppearance.ts), cross-fading when the day changes. Swiped sideways it
 * moves a week: to the next one leftwards, to the one before rightwards, in
 * every App Language.
 */
export default function DayBlock({ day, arabic, onOpenCalendar, onOpenSeasons, action }: DayBlockProps) {
  const { selectDate } = useCalendar();
  const { theme } = day;
  const [week, setWeek] = useState<{ key: string; days: WeekStripDay[] } | null>(null);

  // The swipe, read once and kept: the responder outlives renders, so it
  // reaches the day it moves from through a ref.
  const swipeRef = useRef({ isoDate: day.isoDate, selectDate });
  useEffect(() => {
    swipeRef.current = { isoDate: day.isoDate, selectDate };
  });
  const [drag] = useState(() => new Animated.Value(0));
  // eslint-disable-next-line react-hooks/refs -- refs are read in gesture callbacks, not during render
  const [weekSwipe] = useState(() => {
    const sideways = (gesture: PanResponderGestureState) => Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5;
    const settle = () => Animated.spring(drag, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => sideways(gesture),
      onPanResponderTerminationRequest: () => false,
      // The card leans after the finger, a quarter of the way, so the swipe is felt.
      onPanResponderMove: (_, gesture) => drag.setValue(gesture.dx / 4),
      onPanResponderRelease: (_, gesture) => {
        settle();
        if (Math.abs(gesture.dx) < 50 && Math.abs(gesture.vx) < 0.5) return;
        const { isoDate, selectDate: select } = swipeRef.current;
        const towardsLater = gesture.dx < 0;
        const date = new Date(`${isoDate}T00:00:00Z`);
        date.setUTCDate(date.getUTCDate() + (towardsLater ? 7 : -7));
        select(date);
      },
      onPanResponderTerminate: settle,
    });
  });

  // The week is read once for all its days: choosing another day of it moves
  // only the gold pill.
  const weekStart = weekStartOf(day.isoDate);
  useEffect(() => {
    let active = true;
    void getWeekStrip(weekStart).then((days) => { if (active) setWeek({ key: weekStart, days }); }).catch(() => {});
    return () => { active = false; };
  }, [weekStart]);

  // A new week slides in from the side it lies on -- a later one from the
  // right -- as the old one leaves, rather than the strip simply changing.
  const reduced = useReducedMotion();
  const [stripMotion] = useState(() => ({ x: new Animated.Value(0), opacity: new Animated.Value(1) }));
  const shownWeek = useRef(weekStart);
  useEffect(() => {
    if (shownWeek.current === weekStart) return;
    const later = weekStart > shownWeek.current;
    shownWeek.current = weekStart;
    if (reduced) return;
    stripMotion.x.setValue(later ? 28 : -28);
    stripMotion.opacity.setValue(0.2);
    const useNativeDriver = Platform.OS !== 'web';
    Animated.parallel([
      Animated.timing(stripMotion.x, { toValue: 0, duration: motionDuration(220, reduced), useNativeDriver }),
      Animated.timing(stripMotion.opacity, { toValue: 1, duration: motionDuration(220, reduced), useNativeDriver }),
    ]).start();
  }, [weekStart, reduced, stripMotion]);

  const heading = day.coptic ? formatCopticDayMonth(day.coptic.monthName, day.coptic.day, arabic) : ' ';
  const weekdayNames = arabic ? WEEKDAYS.arabic : tr(WEEKDAYS.english.join('|'), WEEKDAYS.french.join('|'), '').split('|');
  const digits = (value: number) => (arabic ? toEasternArabicDigits(value) : String(value));
  const next = day.overview?.nextSeason;
  const nextName = next ? NEXT_SEASON_NAMES[next.key] : undefined;

  // The week's days are drawn at once, the Coptic days and feast dots as soon
  // as they are read: the strip never empties, so the block never shrinks.
  const readWeek = week?.key === weekStart ? week.days : null;
  const strip: DayStripItem[] = weekDates(weekStart).map((isoDate, index) => {
    const date = new Date(`${isoDate}T00:00:00Z`);
    const read = readWeek?.find((weekDay) => weekDay.isoDate === isoDate);
    return {
      key: isoDate,
      label: weekdayNames[index],
      value: digits(date.getUTCDate()),
      sub: read?.copticDay == null ? ' ' : digits(read.copticDay),
      selected: isoDate === day.isoDate,
      dot: Boolean(read?.hasFeast),
      accessibilityLabel: formatDayMonthYearDate(date, arabic),
      onPress: () => selectDate(date),
    };
  });

  return (
    <Animated.View style={{ transform: [{ translateX: drag }] }} {...weekSwipe.panHandlers}>
    <TodayCard
      theme={theme}
      arabic={arabic}
      controls={<DayControls theme={theme} seasonLabel={day.seasonLabel} arabic={arabic} onOpenSeasons={onOpenSeasons} />}
      heading={heading}
      // The Gregorian date under the Coptic one is the day that heading is
      // for, so the two change together when a new day is read.
      subheading={formatDayMonthYearDate(day.copticDate, arabic)}
      onPressHeading={onOpenCalendar}
      headingAccessibilityLabel={`${heading}. ${tr('Open the calendar', 'Ouvrir le calendrier', 'افتح التقويم')}`}
      strip={(
        <Animated.View style={{ opacity: stripMotion.opacity, transform: [{ translateX: stripMotion.x }] }}>
          <DayStrip items={strip} theme={theme} arabic={arabic} />
        </Animated.View>
      )}
      footer={{
        label: tr('Next season', 'Prochain temps', 'الفترة القادمة'),
        value: nextName ? appText(nextName) : ' ',
        detail: next && nextName ? dayCount(next.days, arabic) : undefined,
        action: action ? { label: action.label, onPress: action.onPress, trailingIcon: 'chevron-forward' } : undefined,
      }}
    />
    </Animated.View>
  );
}

/** "1 day", "56 days"; in Arabic with the noun each count takes. */
function dayCount(days: number, arabic: boolean): string {
  if (arabic) {
    if (days === 1) return 'يوم واحد';
    if (days === 2) return 'يومان';
    return `${toEasternArabicDigits(days)} ${days <= 10 ? 'أيام' : 'يومًا'}`;
  }
  return days === 1 ? tr('1 day', '1 jour', '') : tr(`${days} days`, `${days} jours`, '');
}
