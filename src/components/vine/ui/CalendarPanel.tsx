'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Modal, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DAY_BLOCK_THEMES } from '../../../constants/seasonAppearance';
import { COLORS, SPACING, TYPOGRAPHY } from '../../../constants/theme';
import { useCalendar } from '../../../context/CalendarContext';
import { useReadingPreferences } from '../../../context/ReadingPreferencesContext';
import { appText, tr } from '../../../utils/appText';
import {
  CalendarDay,
  getAdjacentCopticMonth,
  getCopticMonthForDate,
  getCopticMonthGrid,
  getFeastDatesBetween,
  getGregorianMonthGrid,
} from '../../../utils/calendarService';
import { formatCalendarDay, formatCopticMonthName, GREGORIAN_MONTHS_AR, GREGORIAN_MONTHS_EN, GREGORIAN_MONTHS_FR } from '../../../utils/localeFormat';
import { DISABLED_TEXT_SELECTION_STYLE } from '../../../utils/textSelection';
import { motionDuration, useReducedMotion } from '../../../utils/useReducedMotion';
import { useIsCompactLandscape } from '../../../utils/useIsCompactLandscape';
import DayControls from './DayControls';
import Icon from './Icon';
import { VineDivider } from './Ornaments';
import { useLiturgicalDay } from './useLiturgicalDay';
import { useModalOrientations } from '@/hooks/useModalOrientations';

const WEEKDAY_LETTERS = {
  english: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
  french: ['D', 'L', 'M', 'M', 'J', 'V', 'S'],
  arabic: ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'],
};
const WEEKDAY_INDEX: Record<string, number> = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
const COPTIC_MONTHS = ['Thoout', 'Paope', 'Hathor', 'Kiahk', 'Tobe', 'Meshir', 'Paremhotep', 'Parmoute', 'Pashons', 'Paone', 'Epep', 'Mesore', 'Nesi'];
const LABELS = {
  gregorian: { english: 'Gregorian', arabic: 'ميلادي', french: 'Grégorien' },
  coptic: { english: 'Coptic', arabic: 'قبطي', french: 'Copte' },
};

type Mode = 'gregorian' | 'coptic';

/** One picker row: minHeight plus its 1px margin either side — the figure the open-scroll below positions against. */
const PICKER_ROW_HEIGHT = 46;

/** A Gregorian month's name in the App Language. */
function gregorianMonthName(month: number): string {
  const french = GREGORIAN_MONTHS_FR[month - 1] || '';
  return tr(GREGORIAN_MONTHS_EN[month - 1], french.charAt(0).toUpperCase() + french.slice(1), GREGORIAN_MONTHS_AR[month - 1]);
}

interface CalendarPanelProps {
  onOpenSeasons: () => void;
  /** Above the controls: the sheet's grab handle. */
  header?: React.ReactNode;
}

/**
 * The calendar (Coptic Vine design, "Calendar popup"): Live, the day's season and the
 * eve toggle; the month with its arrows and picker; Gregorian or Coptic; and
 * the month's days, each with its date in the other calendar beneath it and a
 * gold dot on a feast. Shared by the Books sheet and the calendar page.
 */
export default function CalendarPanel({ onOpenSeasons, header }: CalendarPanelProps) {
  const modalOrientations = useModalOrientations();
  const { rawDate, selectDate } = useCalendar();
  const { preferences } = useReadingPreferences();
  const isArabic = preferences.appLanguage === 'ar';
  const day = useLiturgicalDay();

  const [mode, setMode] = useState<Mode>('gregorian');
  const [gregorianYear, setGregorianYear] = useState(rawDate.getUTCFullYear());
  const [gregorianMonth, setGregorianMonth] = useState(rawDate.getUTCMonth() + 1);
  const [copticYear, setCopticYear] = useState<number | null>(null);
  const [copticMonth, setCopticMonth] = useState<number | null>(null);
  const [copticMonthName, setCopticMonthName] = useState('');
  const [days, setDays] = useState<CalendarDay[] | null>(null);
  const [feastDates, setFeastDates] = useState<Set<string>>(new Set());
  // The month the grid on screen shows: its title changes with the grid, not
  // a moment ahead of it while the next month is read.
  const [shownMonth, setShownMonth] = useState<{ mode: Mode; year: number | null; month: number | null; copticName: string } | null>(null);
  // Which way the last move went -- 1 to a later month, -1 to an earlier one,
  // 0 to a day picked or a calendar switched -- for the grid to slide in from.
  const slideDirection = useRef(0);
  const reduced = useReducedMotion();
  const [gridMotion] = useState(() => ({ x: new Animated.Value(0), opacity: new Animated.Value(1) }));
  const [pickerOpen, setPickerOpen] = useState(false);
  // The year column's window is frozen at whatever year was showing when the
  // panel opened. Deriving it from the live selection meant picking a year
  // re-centred the range and slid all 61 rows out from under the finger.
  const [pickerYearAnchor, setPickerYearAnchor] = useState<number | null>(null);
  const monthListRef = useRef<ScrollView>(null);
  const yearListRef = useRef<ScrollView>(null);

  // The grid highlight always tracks the literal calendar day, even after
  // the liturgical day has rolled forward past 5pm — only the day/night
  // toggle communicates that content is now for the evening.
  const selectedIso = rawDate.toISOString().slice(0, 10);

  // Keeps the visible month following `rawDate` when it changes from outside
  // (the Season selector, or the Books week strip behind the sheet).
  useEffect(() => {
    setGregorianYear(rawDate.getUTCFullYear());
    setGregorianMonth(rawDate.getUTCMonth() + 1);
    setCopticYear(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the timestamp, not the Date instance
  }, [rawDate.getTime()]);

  useEffect(() => {
    if (mode !== 'coptic' || copticYear !== null) return;
    getCopticMonthForDate(rawDate).then((result) => {
      if (!result) return;
      setCopticYear(result.coptic_year);
      setCopticMonth(result.coptic_month);
      setCopticMonthName(result.coptic_month_name);
    });
  }, [mode, copticYear, rawDate]);

  // The month on screen stays until the next one has arrived, days and feast
  // dots together, so switching month or calendar swaps the grid in place
  // rather than collapsing it to a spinner and opening it again.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      let grid: CalendarDay[];
      if (mode === 'gregorian') grid = await getGregorianMonthGrid(gregorianYear, gregorianMonth);
      else if (copticYear !== null && copticMonth !== null) grid = await getCopticMonthGrid(copticYear, copticMonth);
      else return;
      const feasts = grid.length
        ? await getFeastDatesBetween(grid[0].gregorianDate, grid[grid.length - 1].gregorianDate).catch(() => new Set<string>())
        : new Set<string>();
      if (cancelled) return;
      setDays(grid);
      setFeastDates(feasts);
      setShownMonth(mode === 'gregorian'
        ? { mode, year: gregorianYear, month: gregorianMonth, copticName: '' }
        : { mode, year: copticYear, month: copticMonth, copticName: copticMonthName });
    };
    load().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [mode, gregorianYear, gregorianMonth, copticYear, copticMonth, copticMonthName]);

  // Each new month's grid slides in from the side it lies on, or fades in.
  useEffect(() => {
    if (!shownMonth) return;
    const direction = slideDirection.current;
    slideDirection.current = 0;
    if (reduced) return;
    gridMotion.x.setValue(direction * 24);
    gridMotion.opacity.setValue(0.25);
    const useNativeDriver = Platform.OS !== 'web';
    Animated.parallel([
      Animated.timing(gridMotion.x, { toValue: 0, duration: motionDuration(220, reduced), useNativeDriver }),
      Animated.timing(gridMotion.opacity, { toValue: 1, duration: motionDuration(220, reduced), useNativeDriver }),
    ]).start();
  }, [shownMonth, reduced, gridMotion]);

  const goPrevGregorian = () => {
    if (gregorianMonth === 1) {
      setGregorianMonth(12);
      setGregorianYear((y) => y - 1);
    } else {
      setGregorianMonth((m) => m - 1);
    }
  };
  const goNextGregorian = () => {
    if (gregorianMonth === 12) {
      setGregorianMonth(1);
      setGregorianYear((y) => y + 1);
    } else {
      setGregorianMonth((m) => m + 1);
    }
  };

  const goAdjacentCoptic = async (direction: 1 | -1) => {
    if (copticYear === null || copticMonth === null) return;
    const next = await getAdjacentCopticMonth(copticYear, copticMonth, direction);
    if (!next) return;
    setCopticYear(next.coptic_year);
    setCopticMonth(next.coptic_month);
    setCopticMonthName(next.coptic_month_name);
  };

  function pickDate(date: Date) {
    selectDate(date);
    setGregorianYear(date.getUTCFullYear());
    setGregorianMonth(date.getUTCMonth() + 1);
    setCopticYear(null);
  }

  const leadingBlanks = days && days.length ? WEEKDAY_INDEX[days[0].weekday] : 0;
  const displayedYear = mode === 'gregorian' ? gregorianYear : copticYear;
  const displayedMonth = mode === 'gregorian' ? gregorianMonth : copticMonth;
  // The title names the month the grid shows (once one has), not the one being read.
  const titleMonth = shownMonth ?? { mode, year: displayedYear, month: displayedMonth, copticName: copticMonthName };
  const displayedMonthName = titleMonth.mode === 'gregorian'
    ? gregorianMonthName(titleMonth.month ?? gregorianMonth)
    : titleMonth.copticName ? formatCopticMonthName(titleMonth.copticName, isArabic) : '';
  const titleYear = titleMonth.year;
  const yearWindowAnchor = pickerYearAnchor ?? displayedYear ?? new Date().getUTCFullYear();
  const pickerYears = useMemo(
    () => Array.from({ length: 61 }, (_, index) => yearWindowAnchor - 30 + index),
    [yearWindowAnchor],
  );
  const pickerMonths = mode === 'gregorian' ? GREGORIAN_MONTHS_EN.map((_, index) => index + 1) : COPTIC_MONTHS.map((_, index) => index + 1);
  // Positions both columns once, as the picker opens, and never again while
  // it is open — re-positioning on each pick snapped the list out from under
  // the finger.
  useEffect(() => {
    if (!pickerOpen) return;
    monthListRef.current?.scrollTo({ y: Math.max((displayedMonth || 1) - 1, 0) * PICKER_ROW_HEIGHT, animated: false });
    yearListRef.current?.scrollTo({ y: Math.max(pickerYears.indexOf(displayedYear ?? yearWindowAnchor), 0) * PICKER_ROW_HEIGHT, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- positions on open only; re-running on selection is the bug this replaced
  }, [pickerOpen]);

  const openDatePicker = () => {
    setPickerYearAnchor(displayedYear ?? new Date().getUTCFullYear());
    setPickerOpen(true);
  };

  const weekdayLetters = isArabic ? WEEKDAY_LETTERS.arabic : preferences.appLanguage === 'fr' ? WEEKDAY_LETTERS.french : WEEKDAY_LETTERS.english;
  const goPreviousMonth = () => {
    slideDirection.current = -1;
    void (mode === 'gregorian' ? goPrevGregorian() : goAdjacentCoptic(-1));
  };
  const goNextMonth = () => {
    slideDirection.current = 1;
    void (mode === 'gregorian' ? goNextGregorian() : goAdjacentCoptic(1));
  };

  // Swiped across, the calendar turns the month as its arrows do: to the left
  // the next, to the right the one before. Taken only once the finger has
  // clearly gone sideways, so a tap on a day still picks it and the sheet's
  // own drag down still closes it.
  const monthTurn = useRef({ next: goNextMonth, previous: goPreviousMonth });
  useEffect(() => {
    monthTurn.current = { next: goNextMonth, previous: goPreviousMonth };
  });
  // eslint-disable-next-line react-hooks/refs -- refs are read in gesture callbacks, not during render
  const [monthSwipe] = useState(() => {
    const sideways = (gesture: { dx: number; dy: number }) => Math.abs(gesture.dx) > 16 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5;
    return PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, gesture) => sideways(gesture),
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_, gesture) => {
        if (!sideways(gesture) || (Math.abs(gesture.dx) < 40 && Math.abs(gesture.vx) < 0.4)) return;
        if (gesture.dx < 0) monthTurn.current.next();
        else monthTurn.current.previous();
      },
    });
  });

  // Gregorian to Coptic and back, the calendar keeps to the month on screen
  // rather than going back to the day selected: it shows the month of the
  // other calendar that holds the first day of the month being viewed.
  const switchMode = async (next: Mode) => {
    if (next === mode) return;
    if (next === 'coptic') {
      const firstDay = new Date(Date.UTC(gregorianYear, gregorianMonth - 1, 1));
      const month = await getCopticMonthForDate(firstDay).catch(() => null);
      if (month) {
        setCopticYear(month.coptic_year);
        setCopticMonth(month.coptic_month);
        setCopticMonthName(month.coptic_month_name);
      }
    } else if (copticYear !== null && copticMonth !== null) {
      const showing = shownMonth?.mode === 'coptic' && shownMonth.year === copticYear && shownMonth.month === copticMonth;
      const grid = showing && days ? days : await getCopticMonthGrid(copticYear, copticMonth).catch(() => null);
      const firstDay = grid?.[0]?.gregorianDate;
      if (firstDay) {
        const date = new Date(`${firstDay}T00:00:00Z`);
        setGregorianYear(date.getUTCFullYear());
        setGregorianMonth(date.getUTCMonth() + 1);
      }
    }
    setMode(next);
  };

  // Pieces of the calendar, set one above another, or on a phone on its side
  // -- a postcard's height -- the controls beside the month so it all shows.
  const landscape = useIsCompactLandscape();
  const topBlock = (
    <View style={styles.top}>
      {header}
      <DayControls theme={DAY_BLOCK_THEMES.annual} seasonLabel={day.seasonLabel} arabic={isArabic} onOpenSeasons={onOpenSeasons} />
    </View>
  );
  const monthRow = (
    <View style={styles.monthRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tr('Choose month and year', 'Choisir le mois et l’année', 'اختر الشهر والسنة')}
        hitSlop={4}
        style={styles.monthTitleButton}
        onPress={openDatePicker}
      >
        <Text style={[styles.monthTitle, isArabic && styles.arabicText]} numberOfLines={1}>
          {displayedMonthName}
          {titleYear === null ? '' : ` ${formatCalendarDay(titleYear, isArabic)}`}
        </Text>
        <Icon name="chevron-down" size={16} color={COLORS.gold} />
      </Pressable>
      <View style={styles.arrows}>
        <Pressable accessibilityRole="button" accessibilityLabel={tr('Previous month', 'Mois précédent', 'الشهر السابق')} style={styles.arrow} onPress={goPreviousMonth}>
          <Icon name="chevron-back" size={17} color={COLORS.gold} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={tr('Next month', 'Mois suivant', 'الشهر التالي')} style={styles.arrow} onPress={goNextMonth}>
          <Icon name="chevron-forward" size={17} color={COLORS.gold} />
        </Pressable>
      </View>
    </View>
  );
  const segment = (
    <View style={styles.segment}>
      {(['gregorian', 'coptic'] as Mode[]).map((option) => {
        const active = mode === option;
        return (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.segmentOption, active && styles.segmentOptionActive]}
            onPress={() => { void switchMode(option); }}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive, isArabic && styles.arabicText]} numberOfLines={1}>
              {appText(option === 'gregorian' ? LABELS.gregorian : LABELS.coptic)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
  const weekdays = (
    <View style={styles.gridRow}>
      {weekdayLetters.map((letter, index) => (
        <Text key={index} style={[styles.weekday, isArabic && styles.arabicLetter]}>{letter}</Text>
      ))}
    </View>
  );
  const vine = (
    <View style={styles.divider} pointerEvents="none">
      <VineDivider width={210} height={26} />
    </View>
  );
  // Always six weeks tall, so a five-week month doesn't move the sheet's top
  // edge; the divider follows the last week and the room a sixth would take
  // stays below it.
  const monthGrid = (
    <View style={landscape ? styles.monthLandscape : styles.month}>
      {!days ? (
        <ActivityIndicator color={COLORS.gold} style={landscape ? styles.loadingLandscape : styles.loading} />
      ) : (
        <Animated.View style={[styles.grid, { opacity: gridMotion.opacity, transform: [{ translateX: gridMotion.x }] }]}>
          {Array.from({ length: leadingBlanks }).map((_, i) => (
            <View key={`blank-${i}`} style={[styles.cell, landscape && styles.cellLandscape]} />
          ))}
          {days.map((calendarDay) => {
            const selected = calendarDay.gregorianDate === selectedIso;
            const small = calendarDay.otherMonthName
              ? isArabic
                ? `${formatCalendarDay(calendarDay.otherDay, true)} ${formatCopticMonthName(calendarDay.otherMonthName, true)}`
                : `${calendarDay.otherMonthName} ${calendarDay.otherDay}`
              : formatCalendarDay(calendarDay.otherDay, isArabic);
            return (
              <Pressable
                key={calendarDay.gregorianDate}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={calendarDay.gregorianDate}
                style={[styles.cell, landscape && styles.cellLandscape]}
                onPress={() => pickDate(new Date(`${calendarDay.gregorianDate}T00:00:00Z`))}
              >
                <View style={[styles.circle, landscape && styles.circleLandscape, selected && styles.circleSelected]}>
                  <Text style={[styles.dayNumber, selected && styles.dayNumberSelected, isArabic && styles.arabicLetter]}>
                    {formatCalendarDay(calendarDay.displayDay, isArabic)}
                  </Text>
                  <Text
                    style={[styles.otherDay, calendarDay.otherMonthName ? styles.otherDayMonth : null, selected && styles.otherDaySelected, isArabic && styles.arabicLetter]}
                    numberOfLines={1}
                  >
                    {small}
                  </Text>
                  {feastDates.has(calendarDay.gregorianDate) && !selected ? <View style={styles.feastDot} /> : null}
                </View>
              </Pressable>
            );
          })}
        </Animated.View>
      )}

      {landscape ? null : vine}
    </View>
  );

  return (
    <View style={DISABLED_TEXT_SELECTION_STYLE} {...monthSwipe.panHandlers}>
      {landscape ? (
        <View style={styles.landscape}>
          <View style={styles.landscapeControls}>
            {topBlock}
            <View style={styles.body}>
              {monthRow}
              {segment}
              {vine}
            </View>
          </View>
          <View style={styles.landscapeMonth}>
            {weekdays}
            {monthGrid}
          </View>
        </View>
      ) : (
        <>
          {topBlock}
          <View style={styles.body}>
            {monthRow}
            {segment}
            {weekdays}
            {monthGrid}
          </View>
        </>
      )}

      <Modal supportedOrientations={modalOrientations} visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <Pressable accessibilityRole="button" accessibilityLabel={tr('Close', 'Fermer', 'إغلاق')} style={[styles.pickerBackdrop, DISABLED_TEXT_SELECTION_STYLE]} onPress={() => setPickerOpen(false)}>
          <Pressable accessible={false} style={styles.pickerPanel} onPress={(event) => event.stopPropagation()}>
            <View style={styles.pickerColumns}>
              <View style={styles.pickerColumn}>
                <Text style={[styles.pickerColumnLabel, isArabic && styles.arabicText]}>{tr('Month', 'Mois', 'الشهر')}</Text>
                <ScrollView ref={monthListRef} style={styles.pickerList} showsVerticalScrollIndicator={false} snapToInterval={PICKER_ROW_HEIGHT} decelerationRate="fast">
                  {pickerMonths.map((value) => {
                    const isSelected = value === displayedMonth;
                    const label = mode === 'gregorian' ? gregorianMonthName(value) : formatCopticMonthName(COPTIC_MONTHS[value - 1], isArabic);
                    return (
                      <Pressable accessibilityRole="button" accessibilityState={{ selected: isSelected }}
                        key={value}
                        style={[styles.pickerOption, isSelected && styles.pickerOptionSelected]}
                        onPress={() => {
                          if (mode === 'gregorian') {
                            setGregorianMonth(value);
                          } else {
                            setCopticMonth(value);
                            setCopticMonthName(COPTIC_MONTHS[value - 1]);
                          }
                        }}
                      >
                        <Text numberOfLines={1} style={[styles.pickerOptionText, isSelected && styles.pickerOptionTextSelected, isArabic && styles.arabicText]}>{label}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              <View style={styles.pickerColumnDivider} />

              <View style={styles.pickerColumn}>
                <Text style={[styles.pickerColumnLabel, isArabic && styles.arabicText]}>{tr('Year', 'Année', 'السنة')}</Text>
                <ScrollView ref={yearListRef} style={styles.pickerList} showsVerticalScrollIndicator={false} snapToInterval={PICKER_ROW_HEIGHT} decelerationRate="fast">
                  {pickerYears.map((value) => {
                    const isSelected = value === displayedYear;
                    return (
                      <Pressable accessibilityRole="button" accessibilityState={{ selected: isSelected }}
                        key={value}
                        style={[styles.pickerOption, isSelected && styles.pickerOptionSelected]}
                        onPress={() => {
                          if (mode === 'gregorian') setGregorianYear(value);
                          else setCopticYear(value);
                        }}
                      >
                        <Text numberOfLines={1} style={[styles.pickerOptionText, isSelected && styles.pickerOptionTextSelected, isArabic && styles.arabicText]}>
                          {formatCalendarDay(value, isArabic)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            </View>

            <Pressable accessibilityRole="button" style={styles.pickerDone} onPress={() => setPickerOpen(false)}>
              <Text style={[styles.pickerDoneText, isArabic && styles.arabicText]}>{tr('Done', 'Terminé', 'تم')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: 16, paddingTop: 10 },
  body: { paddingHorizontal: 16 },
  monthRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 },
  monthTitleButton: { alignItems: 'center', flexDirection: 'row', flexShrink: 1, gap: 6, minHeight: 36 },
  monthTitle: { color: COLORS.white, flexShrink: 1, fontFamily: TYPOGRAPHY.title, fontSize: 22, fontWeight: '700' },
  arrows: { flexDirection: 'row', gap: 8 },
  arrow: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  segment: {
    backgroundColor: COLORS.black,
    borderColor: COLORS.border,
    borderRadius: 99,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    marginTop: 14,
    padding: 4,
  },
  segmentOption: { alignItems: 'center', borderRadius: 99, flex: 1, paddingVertical: 8 },
  segmentOptionActive: { backgroundColor: COLORS.gold },
  segmentText: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 14, fontWeight: '600' },
  segmentTextActive: { color: COLORS.greenDeep },
  // The letters keep the weeks' 2pt gap under them, as one grid with the days.
  gridRow: { flexDirection: 'row', marginBottom: 2, marginTop: 12 },
  weekday: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 12, fontWeight: '600', paddingBottom: 6, textAlign: 'center', width: `${100 / 7}%` },
  // Six 42pt weeks 2pt apart, then the divider's 14pt and 26pt.
  month: { minHeight: 6 * 42 + 5 * 2 + 14 + 26 },
  // A phone on its side: the controls and the vine on the left, the month on
  // the right in six 38pt weeks, so the whole month shows without scrolling.
  landscape: { alignItems: 'flex-start', flexDirection: 'row', gap: 8, paddingBottom: 4 },
  landscapeControls: { flex: 0.9, minWidth: 0 },
  landscapeMonth: { flex: 1, minWidth: 0, paddingRight: 16, paddingTop: 10 },
  monthLandscape: { minHeight: 6 * 38 + 5 * 2 },
  loadingLandscape: { height: 6 * 38 + 5 * 2 },
  cellLandscape: { height: 38 },
  circleLandscape: { borderRadius: 19, height: 38, width: 38 },
  loading: { height: 6 * 42 + 5 * 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 2 },
  cell: { alignItems: 'center', height: 42, justifyContent: 'center', width: `${100 / 7}%` },
  circle: { alignItems: 'center', borderRadius: 21, gap: 1, height: 42, justifyContent: 'center', width: 42 },
  circleSelected: { backgroundColor: COLORS.gold },
  dayNumber: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 16, fontWeight: '500', lineHeight: 19 },
  dayNumberSelected: { color: COLORS.greenDeep, fontWeight: '700' },
  otherDay: { color: COLORS.goldBright, fontFamily: TYPOGRAPHY.body, fontSize: 9.5, lineHeight: 11, opacity: 0.8 },
  otherDayMonth: { fontSize: 8.5, width: 56, textAlign: 'center' },
  otherDaySelected: { color: COLORS.greenDeep, fontWeight: '700', opacity: 1 },
  feastDot: { backgroundColor: COLORS.gold, borderRadius: 2, bottom: 1, height: 4, position: 'absolute', width: 4 },
  divider: { alignItems: 'center', marginTop: 14 },
  arabicText: { fontFamily: TYPOGRAPHY.arabic, writingDirection: 'rtl' },
  arabicLetter: { fontFamily: TYPOGRAPHY.arabic },
  // Centred over a scrim rather than pinned under whichever word was tapped.
  pickerBackdrop: { alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.66)', flex: 1, justifyContent: 'center', padding: SPACING.lg },
  pickerPanel: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.goldLine,
    borderRadius: 18,
    borderWidth: 1,
    elevation: 12,
    maxWidth: 380,
    overflow: 'hidden',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    width: '100%',
  },
  pickerColumns: { flexDirection: 'row', maxHeight: 320 },
  pickerColumn: { flex: 1, paddingTop: SPACING.md },
  pickerColumnDivider: { backgroundColor: COLORS.border, width: 1 },
  pickerColumnLabel: { color: COLORS.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1.4, paddingBottom: SPACING.sm, textAlign: 'center', textTransform: 'uppercase' },
  pickerList: { paddingHorizontal: SPACING.sm },
  // minHeight + marginVertical must stay equal to PICKER_ROW_HEIGHT.
  pickerOption: { alignItems: 'center', borderRadius: 10, justifyContent: 'center', marginVertical: 1, minHeight: 44, paddingHorizontal: SPACING.sm },
  pickerOptionSelected: { backgroundColor: COLORS.goldSoft },
  pickerOptionText: { color: COLORS.muted, fontFamily: TYPOGRAPHY.title, fontSize: 17, fontWeight: '600' },
  pickerOptionTextSelected: { color: COLORS.gold, fontWeight: '800' },
  pickerDone: { alignItems: 'center', borderTopColor: COLORS.border, borderTopWidth: 1, justifyContent: 'center', minHeight: 48 },
  pickerDoneText: { color: COLORS.gold, fontFamily: TYPOGRAPHY.title, fontSize: 16, fontWeight: '800' },
});
