'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, PanResponder, type PanResponderGestureState, StyleSheet, View } from 'react-native';

import { useCalendar } from '../../../context/CalendarContext';
import { appText, tr } from '../../../utils/appText';
import { getWeekStrip, type WeekStripDay } from '../../../utils/calendarService';
import { formatCopticDayMonth, formatDayMonthYearDate, toEasternArabicDigits } from '../../../utils/localeFormat';
import { NEXT_SEASON_NAMES } from '../../../utils/nextSeason';
import { motionDuration, releaseDuration, useReducedMotion } from '../../../utils/useReducedMotion';
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

/** The ISO date some days on from another (back, for a negative count). */
function shiftIso(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Whole weeks from one Sunday to another. */
function weeksBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / (7 * 86400000));
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
  const weekStart = weekStartOf(day.isoDate);
  // The weeks either side are drawn too, just out of sight, so the next one
  // comes in with the finger rather than after the swipe.
  const weekStarts = [shiftIso(weekStart, -7), weekStart, shiftIso(weekStart, 7)];
  const shownWeeks = weekStarts.join('|');

  // Each week is read once for all its days: choosing another day of it moves
  // only the gold pill.
  const [weeks, setWeeks] = useState<Record<string, WeekStripDay[]>>({});
  useEffect(() => {
    let active = true;
    const starts = shownWeeks.split('|');
    for (const start of starts) {
      void getWeekStrip(start).then((days) => {
        if (!active) return;
        setWeeks((current) => {
          const kept: Record<string, WeekStripDay[]> = {};
          for (const key of starts) if (current[key]) kept[key] = current[key];
          return { ...kept, [start]: days };
        });
      }).catch(() => {});
    }
    return () => { active = false; };
  }, [shownWeeks]);

  // The week strip turns like a page: the weeks lie side by side in their lane
  // and follow the finger, and a swipe far or quick enough carries the next
  // one the rest of the way in. A shorter one springs back. The card itself
  // stays where it is. The lane's position is counted in weeks from the one
  // the block opened on: a week `k` on from it sits at (position + k) widths.
  const reduced = useReducedMotion();
  const [anchor] = useState(weekStart);
  const [motion] = useState(() => ({ position: new Animated.Value(0), width: new Animated.Value(0), fade: new Animated.Value(1) }));
  const [laneWidth, setLaneWidth] = useState(0);
  // Each week's place in the lane, made once: re-made on every render, a
  // week moving under the native driver would be handed a new one mid-flight.
  const [placements] = useState(() => new Map<number, ReturnType<typeof Animated.multiply>>());
  const placeFor = (offset: number) => {
    let place = placements.get(offset);
    if (!place) {
      place = Animated.multiply(Animated.add(motion.position, offset), motion.width);
      placements.set(offset, place);
    }
    return place;
  };
  // What the responder reads, kept current: it outlives renders. `rest` is
  // where the lane comes to rest for the week shown; `paging` is set while a
  // swiped week is on its way, so the new date does not move it again.
  const swipeRef = useRef({ isoDate: day.isoDate, selectDate, reduced, width: 0, rest: 0, dragFrom: 0, paging: false, shownWeek: weekStart });
  useEffect(() => {
    Object.assign(swipeRef.current, { isoDate: day.isoDate, selectDate, reduced });
  });

  useLayoutEffect(() => {
    const swipe = swipeRef.current;
    if (swipe.shownWeek === weekStart) return;
    const later = weekStart > swipe.shownWeek;
    swipe.shownWeek = weekStart;
    const rest = -weeksBetween(anchor, weekStart);
    swipe.rest = rest;
    // A week swiped in is already where it belongs.
    if (swipe.paging) {
      swipe.paging = false;
      return;
    }
    // A day chosen anywhere else -- the calendar, a day of this strip in
    // another week -- puts its week in place with a small nudge from the side
    // it lies on.
    motion.position.stopAnimation();
    if (reduced || !swipe.width) {
      motion.position.setValue(rest);
      return;
    }
    const nudge = 28 / swipe.width;
    motion.position.setValue(rest + (later ? nudge : -nudge));
    motion.fade.setValue(0.2);
    Animated.parallel([
      Animated.timing(motion.position, { toValue: rest, duration: motionDuration(220, reduced), easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE_DRIVER }),
      Animated.timing(motion.fade, { toValue: 1, duration: motionDuration(220, reduced), useNativeDriver: NATIVE_DRIVER }),
    ]).start();
  }, [anchor, motion, reduced, weekStart]);

  // eslint-disable-next-line react-hooks/refs -- refs are read in gesture callbacks, not during render
  const [weekSwipe] = useState(() => {
    const sideways = (gesture: PanResponderGestureState) => Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5;
    const settle = () => Animated.spring(motion.position, { toValue: swipeRef.current.rest, speed: 16, bounciness: 4, useNativeDriver: NATIVE_DRIVER }).start();
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => sideways(gesture),
      onPanResponderTerminationRequest: () => false,
      // A week still on its way is taken up from where it was going.
      onPanResponderGrant: () => {
        motion.position.stopAnimation();
        motion.fade.stopAnimation();
        motion.fade.setValue(1);
        swipeRef.current.dragFrom = swipeRef.current.rest;
      },
      onPanResponderMove: (_, gesture) => {
        const swipe = swipeRef.current;
        motion.position.setValue(swipe.dragFrom + gesture.dx / (swipe.width || 320));
      },
      onPanResponderRelease: (_, gesture) => {
        const swipe = swipeRef.current;
        const width = swipe.width || 320;
        // A flick turns the week however short it was; a slow drag, past a quarter of the lane.
        const flicked = Math.abs(gesture.vx) > 0.4;
        if (!flicked && Math.abs(gesture.dx) < width / 4) {
          settle();
          return;
        }
        const towardsLater = flicked ? gesture.vx < 0 : gesture.dx < 0;
        const target = swipe.dragFrom + (towardsLater ? -1 : 1);
        const date = new Date(`${swipe.isoDate}T00:00:00Z`);
        date.setUTCDate(date.getUTCDate() + (towardsLater ? 7 : -7));
        const from = swipe.shownWeek;
        swipe.paging = true;
        swipe.rest = target;
        if (swipe.reduced) {
          motion.position.setValue(target);
        } else {
          // On the rest of the way at the pace it was thrown (eased out from
          // the finger's own speed, not three times it), on the native side,
          // so the page catching up with the new date cannot hold it up.
          const remaining = Math.abs(target * width - (swipe.dragFrom * width + gesture.dx));
          Animated.timing(motion.position, {
            toValue: target,
            duration: releaseDuration(remaining, gesture.vx),
            easing: Easing.out(Easing.quad),
            useNativeDriver: NATIVE_DRIVER,
          }).start(({ finished }) => {
            // Should the date not have moved after all, the week goes back.
            if (!finished || swipe.shownWeek !== from) return;
            swipe.paging = false;
            swipe.rest = -weeksBetween(anchor, from);
            settle();
          });
        }
        // The week is already drawn, so the date changes as it moves rather than after.
        swipe.selectDate(date);
      },
      onPanResponderTerminate: settle,
    });
  });

  const heading = day.coptic ? formatCopticDayMonth(day.coptic.monthName, day.coptic.day, arabic) : ' ';
  const weekdayNames = arabic ? WEEKDAYS.arabic : tr(WEEKDAYS.english.join('|'), WEEKDAYS.french.join('|'), '').split('|');
  const digits = (value: number) => (arabic ? toEasternArabicDigits(value) : String(value));
  const next = day.overview?.nextSeason;
  const nextName = next ? NEXT_SEASON_NAMES[next.key] : undefined;

  // A week's days are drawn at once, the Coptic days and feast dots as soon
  // as they are read: the strip never empties, so the block never shrinks.
  // The weeks either side carry the gold pill on the same weekday, where it
  // will be when they are turned to.
  const stripFor = (start: string): DayStripItem[] => {
    const read = weeks[start];
    const selectedIso = shiftIso(day.isoDate, 7 * weeksBetween(weekStart, start));
    return weekDates(start).map((isoDate, index) => {
      const date = new Date(`${isoDate}T00:00:00Z`);
      const readDay = read?.find((weekDay) => weekDay.isoDate === isoDate);
      return {
        key: isoDate,
        label: weekdayNames[index],
        value: digits(date.getUTCDate()),
        sub: readDay?.copticDay == null ? ' ' : digits(readDay.copticDay),
        selected: isoDate === selectedIso,
        dot: Boolean(readDay?.hasFeast),
        accessibilityLabel: formatDayMonthYearDate(date, arabic),
        onPress: () => selectDate(date),
      };
    });
  };

  return (
    <View {...weekSwipe.panHandlers}>
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
        // The weeks' lane: a week coming in or going out is cut at its edges.
        <Animated.View
          style={[styles.lane, { opacity: motion.fade }]}
          onLayout={(event) => {
            const width = event.nativeEvent.layout.width;
            swipeRef.current.width = width;
            motion.width.setValue(width);
            setLaneWidth(width);
          }}
        >
          {weekStarts.map((start) => {
            const shown = start === weekStart;
            // The weeks either side wait for the lane's width, or they would sit on top of this one.
            if (!shown && !laneWidth) return null;
            return (
              <Animated.View
                key={start}
                pointerEvents={shown ? 'auto' : 'none'}
                accessibilityElementsHidden={!shown}
                importantForAccessibility={shown ? 'auto' : 'no-hide-descendants'}
                style={[shown ? null : styles.besideWeek, { transform: [{ translateX: placeFor(weeksBetween(anchor, start)) }] }]}
              >
                <DayStrip items={stripFor(start)} theme={theme} arabic={arabic} />
              </Animated.View>
            );
          })}
        </Animated.View>
      )}
      footer={{
        label: tr('Next season', 'Prochain temps', 'الفترة القادمة'),
        value: nextName ? appText(nextName) : ' ',
        detail: next && nextName ? dayCount(next.days, arabic) : undefined,
        action: action ? { label: action.label, onPress: action.onPress, trailingIcon: 'chevron-forward' } : undefined,
      }}
    />
    </View>
  );
}

const NATIVE_DRIVER = Platform.OS !== 'web';

const styles = StyleSheet.create({
  lane: { overflow: 'hidden' },
  besideWeek: { left: 0, position: 'absolute', right: 0, top: 0 },
});

/** "1 day", "56 days"; in Arabic with the noun each count takes. */
function dayCount(days: number, arabic: boolean): string {
  if (arabic) {
    if (days === 1) return 'يوم واحد';
    if (days === 2) return 'يومان';
    return `${toEasternArabicDigits(days)} ${days <= 10 ? 'أيام' : 'يومًا'}`;
  }
  return days === 1 ? tr('1 day', '1 jour', '') : tr(`${days} days`, `${days} jours`, '');
}
