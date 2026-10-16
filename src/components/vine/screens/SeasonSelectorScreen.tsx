'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import Icon from '@/components/vine/ui/Icon';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PageGlow } from '@/components/vine/screens/BookPage';
import { NowPlayingAwareScrollView } from '@/components/playback/NowPlayingAwareScroll';
import SubPageHeader from '@/components/vine/ui/SubPageHeader';
import BleedPage from '@/components/vine/ui/BleedPage';
import { COLORS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { getEventFormalName, getSeasonFormalName } from '@/constants/seasonNames';
import { useBottomChrome } from '@/context/BottomChromeContext';
import { useCalendar } from '@/context/CalendarContext';
import { useReadingPreferences } from '@/context/ReadingPreferencesContext';
import {
  getCopticDatesOfYear,
  getCopticYearForDate,
  getSeasonYear,
  peekCopticDatesOfYear,
  peekCopticYearForDate,
  peekSeasonYear,
  type CopticDate,
  type SeasonYear,
} from '@/utils/calendarService';
import { localDateAtUtcMidnight, todayIsoDate } from '@/utils/dateUtils';
import {
  formatCopticDayMonth,
  formatCopticYear,
  formatGregorianDate,
  formatGregorianDateRange,
} from '@/utils/localeFormat';
import { goBack } from '@/utils/navigation';
import type { AppLanguage } from '@/utils/preferencesStorage';
import { useLayoutMode } from '@/utils/useLayoutMode';
import { DISABLED_TEXT_SELECTION_STYLE } from '@/utils/textSelection';

import { tr } from '../../../utils/appText';

interface ChildRow {
  key: string;
  title: string;
  arabic: string;
  date: string;
}

interface SeasonRow {
  type: 'season';
  key: string;
  title: string;
  arabic: string;
  startDate: string;
  endDate: string;
  children: ChildRow[];
}

interface DayRow {
  type: 'day';
  key: string;
  title: string;
  arabic: string;
  date: string;
}

type TopRow = SeasonRow | DayRow;

function rowStart(row: TopRow) {
  return row.type === 'season' ? row.startDate : row.date;
}
function rowEnd(row: TopRow) {
  return row.type === 'season' ? row.endDate : row.date;
}

/** A year's seasons in order, each holding the feasts that fall in it, and the feasts that fall in none between them. */
function buildRows({ startDate, endDate, seasons, events }: SeasonYear, language: AppLanguage): TopRow[] {
  const seasonRows: SeasonRow[] = seasons
    .filter((row) => row.startDate >= startDate && row.startDate < endDate)
    .map((row) => {
      const formal = getSeasonFormalName(row.rangeKey, row.activeSeason);
      return {
        type: 'season',
        key: row.rangeKey,
        // Shown whenever the Arabic isn't: French in French.
        title: tr(formal.english, formal.french || formal.english, formal.english, language),
        arabic: formal.arabic,
        startDate: row.startDate,
        endDate: row.endDate,
        children: [],
      };
    });

  const looseDays: DayRow[] = [];
  for (const event of events.filter((e) => e.date >= startDate && e.date < endDate)) {
    // A day that exactly completes a season (its endDate) belongs to that
    // season, even if it also happens to be the next season's startDate
    // (e.g. Resurrection ends Holy Week and begins Holy 50 Days).
    const assigned =
      seasonRows.find((s) => event.date === s.endDate) ||
      seasonRows.find((s) => event.date > s.startDate && event.date < s.endDate) ||
      seasonRows.find((s) => event.date === s.startDate);

    const formal = getEventFormalName(event.key, event.title);
    const title = tr(formal.english, formal.french || formal.english, formal.english, language);
    if (assigned) {
      assigned.children.push({ key: event.key, title, arabic: formal.arabic, date: event.date });
    } else {
      looseDays.push({ type: 'day', key: event.key, title, arabic: formal.arabic, date: event.date });
    }
  }
  seasonRows.forEach((s) => s.children.sort((a, b) => a.date.localeCompare(b.date)));

  return [...seasonRows, ...looseDays].sort(
    (a, b) => rowStart(a).localeCompare(rowStart(b)) || rowEnd(a).localeCompare(rowEnd(b)),
  );
}

const NO_COPTIC_DATES = new Map<string, CopticDate>();

interface SeasonSelectorScreenProps {
  /** Set when this screen is rendered inside a modal rather than as its own route (see DocumentModal) — returns to whatever the host was showing instead of popping the navigation stack. */
  onClose?: () => void;
}

/**
 * The year's seasons and feasts (Coptic Vine design system, "SeasonList"):
 * single-day feasts on green cards, each with its Gregorian and Coptic date;
 * the multi-day seasons on gold cards with their span, their own feasts
 * hanging off a gold rail beneath; a red LIVE rule where today falls, and the
 * season or feast today falls in (or the next to come) raised. The year is
 * changed from a bar floating at the foot of the list. Choosing a row moves
 * the whole app to that day.
 */
export default function SeasonSelectorScreen({ onClose }: SeasonSelectorScreenProps) {
  const router = useRouter();
  const isHosted = Boolean(onClose);
  const closeScreen = () => (onClose ? onClose() : goBack(router, '/books'));
  const { selectDate } = useCalendar();
  const { preferences } = useReadingPreferences();
  const insets = useSafeAreaInsets();
  // The bar sits at the very bottom, so it has to ride above the now-playing
  // bar when one is up rather than hide under it.
  const { nowPlayingInset } = useBottomChrome();
  // On the iPad and desktop the list keeps a centred column, the year bar beneath it.
  const wide = useLayoutMode() !== 'phone';
  const isArabic = preferences.appLanguage === 'ar';
  const appLanguage = preferences.appLanguage;
  // Real "today" in the device's own calendar day, not whatever date is
  // selected elsewhere in the app — this seeds which Coptic year to show.
  // Usually already read (the Home page and the Books day block ask for it,
  // and the calendar is warmed at launch), so known on the first frame.
  const [currentCopticYear, setCurrentCopticYear] = useState<number | null>(() => peekCopticYearForDate(localDateAtUtcMidnight(new Date())));
  const [year, setYear] = useState<number | null>(currentCopticYear);
  // A year is drawn from the calendar's session cache: one read before (by
  // the day block, an earlier visit, or the warm-up) is drawn the moment the
  // screen or the year changes, without a spinner in between. `landed` only
  // counts the loads that arrive, to draw what they brought.
  const [, setLanded] = useState(0);
  // The Coptic dates are only each feast's second line: a year whose dates
  // can't be read is shown without them.
  const [undatedYear, setUndatedYear] = useState<number | null>(null);
  const seasonYear = year === null ? null : peekSeasonYear(year);
  const yearDates = year === null ? undefined : peekCopticDatesOfYear(year);
  const copticDates = yearDates ?? NO_COPTIC_DATES;
  const datesSettled = yearDates !== undefined || (year !== null && undatedYear === year);

  useEffect(() => {
    getCopticYearForDate(localDateAtUtcMidnight(new Date())).then((y) => {
      setCurrentCopticYear(y);
      // Never over a year the arrows have already chosen.
      setYear((current) => current ?? y);
    });
  }, []);

  useEffect(() => {
    if (year === null) return;
    let cancelled = false;
    const landed = () => {
      if (!cancelled) setLanded((count) => count + 1);
    };
    if (!peekSeasonYear(year)) getSeasonYear(year).then(landed, () => {});
    if (!peekCopticDatesOfYear(year)) {
      getCopticDatesOfYear(year).then(landed, () => {
        if (!cancelled) setUndatedYear(year);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [year]);

  const rows = useMemo(
    () => (seasonYear && datesSettled ? buildRows(seasonYear, appLanguage) : null),
    [seasonYear, datesSettled, appLanguage],
  );

  const todayIso = todayIsoDate();
  const todayInViewedYear = Boolean(seasonYear && todayIso >= seasonYear.startDate && todayIso < seasonYear.endDate);

  // Where the "Live · Today" rule goes: before the row (or nested feast) that
  // is today, before the season today falls in, or after the last row already
  // past.
  const { liveTopKey, liveChildKey, lineAfterKey } = useMemo(() => {
    if (!rows || !todayInViewedYear) {
      return { liveTopKey: null as string | null, liveChildKey: null as string | null, lineAfterKey: null as string | null };
    }

    for (const row of rows) {
      if (row.type === 'season') {
        const child = row.children.find((c) => c.date === todayIso);
        if (child) return { liveTopKey: null, liveChildKey: child.key, lineAfterKey: null };
        if (todayIso >= row.startDate && todayIso <= row.endDate) {
          return { liveTopKey: row.key, liveChildKey: null, lineAfterKey: null };
        }
      } else if (row.date === todayIso) {
        return { liveTopKey: row.key, liveChildKey: null, lineAfterKey: null };
      }
    }

    const before = [...rows].filter((row) => rowEnd(row) < todayIso).sort((a, b) => rowEnd(a).localeCompare(rowEnd(b))).pop();
    return { liveTopKey: null, liveChildKey: null, lineAfterKey: before?.key ?? '__start__' };
  }, [rows, todayInViewedYear, todayIso]);

  // The row raised: the season or feast today falls in, or failing that the
  // next one to come, just after the Live rule.
  const raisedKey = useMemo(() => {
    if (!rows || !todayInViewedYear) return null;
    if (liveTopKey) return liveTopKey;
    if (liveChildKey) return null;
    return rows.find((row) => rowStart(row) > todayIso)?.key ?? null;
  }, [rows, todayInViewedYear, liveTopKey, liveChildKey, todayIso]);

  function selectDay(date: string) {
    selectDate(new Date(`${date}T00:00:00Z`));
    closeScreen();
  }

  const copticSubtitle = (date: string) => {
    const coptic = copticDates.get(date);
    return coptic ? formatCopticDayMonth(coptic.monthName, coptic.day, isArabic) : '';
  };
  const liveBar = <LiveBar isArabic={isArabic} />;
  const title = tr('Seasons', 'Temps liturgiques', 'الفترات');

  /** "Sep 27, 2026 · Tout 17": a feast's day in both calendars. */
  const dayLine = (date: string) => [formatGregorianDate(date, isArabic), copticSubtitle(date)].filter(Boolean).join(' · ');

  return (
    <BleedPage background={<PageGlow kind="green" tall={wide} />} style={DISABLED_TEXT_SELECTION_STYLE}>
      {/* Hosted over a document (DocumentModal) it's an overlay, not a page of its own. */}
      {isHosted ? null : (
        <Head>
          <title>{`Coptic Vine ${title}`}</title>
        </Head>
      )}
      {/* Keyed by layout, as the year bar is: a turn of the device builds them afresh
          rather than restyling them in place, which iOS laid out wrongly. */}
      <View key={wide ? 'wide' : 'phone'} style={[styles.frame, wide && styles.frameWide]}>
        <SubPageHeader title={title} arabic={isArabic} onBack={closeScreen} backLabel={tr('Close the seasons', 'Fermer les temps liturgiques', 'أغلق الفترات')} />

        {year === null || !rows ? (
          <ActivityIndicator color={COLORS.gold} style={{ marginTop: SPACING.xl }} />
        ) : (
          <NowPlayingAwareScrollView contentContainerStyle={[styles.list, { paddingBottom: YEAR_BAR_CLEARANCE + insets.bottom }]} showsVerticalScrollIndicator={false}>
            {lineAfterKey === '__start__' ? liveBar : null}
            {rows.map((row) => (
              <Fragment key={row.key}>
                {liveTopKey === row.key ? liveBar : null}
                <SeasonCard
                  title={isArabic ? row.arabic || row.title : row.title}
                  subtitle={row.type === 'season' ? formatGregorianDateRange(row.startDate, row.endDate, isArabic) : dayLine(row.date)}
                  kind={row.type === 'season' ? 'season' : 'day'}
                  current={raisedKey === row.key}
                  isArabic={isArabic}
                  onPress={() => selectDay(rowStart(row))}
                />
                {row.type === 'season' && row.children.length ? (
                  <View style={styles.nest}>
                    {row.children.map((child) => (
                      <Fragment key={child.key}>
                        {liveChildKey === child.key ? liveBar : null}
                        <SeasonCard
                          title={isArabic ? child.arabic || child.title : child.title}
                          subtitle={formatGregorianDate(child.date, isArabic)}
                          kind="nested"
                          isArabic={isArabic}
                          onPress={() => selectDay(child.date)}
                        />
                      </Fragment>
                    ))}
                  </View>
                ) : null}
                {lineAfterKey === row.key ? liveBar : null}
              </Fragment>
            ))}
          </NowPlayingAwareScrollView>
        )}
      </View>

      {year !== null ? (
        <View key={wide ? 'wide' : 'phone'} style={[
          styles.yearBar,
          wide ? styles.yearBarWide : null,
          { bottom: (wide ? 28 : Math.max(24, insets.bottom)) + nowPlayingInset },
        ]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tr('Previous year', 'Année précédente', 'السنة السابقة')}
            style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
            onPress={() => setYear((y) => (y ?? 0) - 1)}
          >
            <Icon name="chevron-back" size={17} color={COLORS.gold} />
          </Pressable>
          <View style={styles.yearLabel}>
            {year === currentCopticYear ? <View style={styles.yearDot} /> : null}
            <Text style={[styles.yearText, isArabic && styles.arabicText]}>{formatCopticYear(year, isArabic)}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tr('Next year', 'Année suivante', 'السنة التالية')}
            style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
            onPress={() => setYear((y) => (y ?? 0) + 1)}
          >
            <Icon name="chevron-forward" size={17} color={COLORS.gold} />
          </Pressable>
        </View>
      ) : null}
    </BleedPage>
  );
}

/**
 * Room under the list for the floating year bar: its height and the gap
 * beneath it. There is no tab bar on this screen, so the bar floats 24pt over
 * the window's edge (28pt on the iPad and desktop), or the home indicator.
 */
const YEAR_BAR_CLEARANCE = 60 + 28 + 20;

/** Each kind of card's fill: single days green, seasons gold, a season's own feasts a quieter green. */
const CARD_FILLS = {
  day: { colors: ['#173A1F', '#0D2213'], locations: [0, 1] },
  dayCurrent: { colors: [COLORS.greenGlow, '#1F4A26', COLORS.greenDeep], locations: [0, 0.55, 1] },
  season: { colors: ['#F0C74E', '#D6A52C', '#A87C17'], locations: [0, 0.6, 1] },
  nested: { colors: ['#12301A', COLORS.surface], locations: [0, 1] },
} as const;

function SeasonCard({
  title,
  subtitle,
  kind,
  current = false,
  isArabic,
  onPress,
}: {
  title: string;
  subtitle: string;
  kind: 'day' | 'season' | 'nested';
  current?: boolean;
  isArabic: boolean;
  onPress: () => void;
}) {
  const gold = kind === 'season';
  const fill = gold ? CARD_FILLS.season : kind === 'nested' ? CARD_FILLS.nested : current ? CARD_FILLS.dayCurrent : CARD_FILLS.day;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtitle}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        kind === 'nested' && styles.cardNested,
        current && styles.cardCurrent,
        current && (gold ? styles.glowGold : styles.glowGreen),
        pressed && styles.pressed,
      ]}
    >
      <LinearGradient colors={fill.colors} locations={fill.locations} start={{ x: 0.33, y: 0 }} end={{ x: 0.67, y: 1 }} style={[StyleSheet.absoluteFill, styles.cardFill]} pointerEvents="none" />
      <View style={styles.text}>
        <Text style={[styles.title, kind === 'nested' && styles.titleNested, current && styles.titleCurrent, gold && styles.onGold, isArabic && styles.arabicText]}>
          {title}
        </Text>
        <Text style={[styles.subtitle, kind === 'nested' && styles.subtitleNested, current && !gold && styles.subtitleCurrent, gold && styles.subtitleOnGold, isArabic && styles.arabicText]}>
          {subtitle}
        </Text>
      </View>
      {/* Wrapped so it stacks above the gradient on web, where a bare SVG paints beneath positioned siblings. */}
      <View><Icon name="chevron-forward" size={17} color={gold ? COLORS.greenDeep : COLORS.gold} /></View>
    </Pressable>
  );
}

function LiveBar({ isArabic }: { isArabic: boolean }) {
  return (
    <View style={styles.liveBar} accessibilityRole="text">
      <View style={styles.liveDotHalo}>
        <View style={styles.liveDot} />
      </View>
      <Text style={[styles.liveText, isArabic && styles.arabicSmall]}>{tr('LIVE', 'EN DIRECT', 'الآن')}</Text>
      <View style={styles.liveLine} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.black },
  frame: { flex: 1 },
  // The design's 720pt column, with the list's own 16pt gutters either side,
  // 28pt from the top as every iPad and desktop page is.
  frameWide: { alignSelf: 'center', maxWidth: 752, paddingTop: 28, width: '100%' },
  yearBarWide: { left: '50%', marginLeft: -270, right: undefined, width: 540 },
  list: { gap: 8, paddingHorizontal: 16, paddingTop: 4 },
  card: { alignItems: 'center', borderRadius: 16, flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  cardFill: { borderRadius: 16 },
  cardNested: { paddingVertical: 10 },
  cardCurrent: { padding: 16 },
  glowGold: { boxShadow: '0px 10px 28px rgba(227, 181, 59, 0.3)' },
  glowGreen: { boxShadow: '0px 10px 28px rgba(58, 122, 63, 0.35)' },
  pressed: { opacity: 0.82 },
  text: { flex: 1, minWidth: 0 },
  title: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 16, fontWeight: '600' },
  titleNested: { fontSize: 15 },
  titleCurrent: { fontFamily: TYPOGRAPHY.title, fontSize: 20, fontWeight: '700' },
  onGold: { color: COLORS.greenDeep },
  subtitle: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 13, marginTop: 3 },
  subtitleNested: { fontSize: 12.5 },
  subtitleCurrent: { color: COLORS.goldBright },
  subtitleOnGold: { color: '#2B4A1F' },
  // A season's own feasts hang off a solid gold rail.
  nest: { borderLeftColor: COLORS.gold, borderLeftWidth: 2, gap: 8, marginLeft: 10, paddingLeft: 18 },
  liveBar: { alignItems: 'center', flexDirection: 'row', gap: 10, paddingVertical: 6 },
  liveDotHalo: { alignItems: 'center', backgroundColor: 'rgba(214, 69, 69, 0.2)', borderRadius: 8, height: 16, justifyContent: 'center', width: 16 },
  liveDot: { backgroundColor: COLORS.priest, borderRadius: 4, height: 8, width: 8 },
  liveText: { color: COLORS.priest, fontFamily: TYPOGRAPHY.body, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  liveLine: { backgroundColor: COLORS.priest, flex: 1, height: 1, opacity: 0.6 },
  // Floats over the foot of the list (nearly opaque, as the design's blurred bar reads).
  yearBar: {
    alignItems: 'center',
    backgroundColor: 'rgba(11, 28, 16, 0.92)',
    borderRadius: 22,
    boxShadow: '0px 10px 30px rgba(0, 0, 0, 0.55)',
    flexDirection: 'row',
    height: 60,
    justifyContent: 'space-between',
    left: 16,
    paddingHorizontal: 10,
    position: 'absolute',
    right: 16,
  },
  arrow: { alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.06)', borderRadius: 18, height: 36, justifyContent: 'center', width: 36 },
  yearLabel: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  yearDot: { backgroundColor: COLORS.priest, borderRadius: 4, height: 8, width: 8 },
  yearText: { color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontSize: 24, fontWeight: '700' },
  arabicText: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'left', writingDirection: 'rtl' },
  arabicSmall: { fontFamily: TYPOGRAPHY.arabic, letterSpacing: 0 },
});
