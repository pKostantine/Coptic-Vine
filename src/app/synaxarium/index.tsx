'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type TextStyle,
} from 'react-native';

import { NowPlayingAwareScrollView } from '@/components/playback/NowPlayingAwareScroll';
import { PageGlow } from '@/components/vine/screens/BookPage';
import BleedPage from '@/components/vine/ui/BleedPage';
import BottomTabBar from '@/components/vine/ui/BottomTabBar';
import Icon from '@/components/vine/ui/Icon';
import LoadFailure from '@/components/vine/ui/LoadFailure';
import SubPageHeader from '@/components/vine/ui/SubPageHeader';
import { DAY_BLOCK_THEMES, getDayTheme, type DayBlockTheme } from '@/constants/seasonAppearance';
import { COLORS, TYPOGRAPHY } from '@/constants/theme';
import { useCalendar } from '@/context/CalendarContext';
import { useLiturgicalClock } from '@/context/LiturgicalClockContext';
import { useReadingPreferences } from '@/context/ReadingPreferencesContext';
import { homeService, type SynaxariumYearRow } from '@/services/homeService';
import { getDayOverview } from '@/utils/calendarService';
import { formatCopticDayMonth, formatCopticMonthName, formatCopticYear, formatMonthDaySpan, toEasternArabicDigits } from '@/utils/localeFormat';
import { goBack } from '@/utils/navigation';
import { splitSaintTitle } from '@/utils/saintTitles';
import { useLayoutMode } from '@/utils/useLayoutMode';

import { tr } from '../../utils/appText';

const MAX_FONT_SCALE = 1.3;

/** Where a saint's story is read: the Synaxarium in the Liturgy of the Word, for the saint's day. */
const SYNAXARIUM_READING = '/liturgy/divine-liturgy/liturgy_of_the_word?sub=SYNAXARIUM';

interface SynaxariumEntry {
  entryKey: string;
  entryOrder: number;
  titleEnglish: string | null;
  titleArabic: string | null;
}

interface SynaxariumDay {
  gregorianDate: string;
  copticYear: number;
  copticMonth: number;
  copticMonthName: string;
  copticDay: number;
  weekdayNumber: number;
  entries: SynaxariumEntry[];
}

function groupRows(rows: SynaxariumYearRow[]): SynaxariumDay[] {
  const days = new Map<string, SynaxariumDay>();

  for (const row of rows) {
    let day = days.get(row.gregorianDate);
    if (!day) {
      day = {
        gregorianDate: row.gregorianDate,
        copticYear: row.copticYear,
        copticMonth: row.copticMonth,
        copticMonthName: row.copticMonthName,
        copticDay: row.copticDay,
        weekdayNumber: row.weekdayNumber,
        entries: [],
      };
      days.set(row.gregorianDate, day);
    }

    if (row.entryKey) {
      day.entries.push({
        entryKey: row.entryKey,
        entryOrder: row.entryOrder ?? 0,
        titleEnglish: row.titleEnglish,
        titleArabic: row.titleArabic,
      });
    }
  }

  return [...days.values()].sort((a, b) => a.gregorianDate.localeCompare(b.gregorianDate));
}

function normalizeSearch(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[.’'"]/g, '')
    .replace(/\bst\b/g, 'saint')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function addDaysIso(isoDate: string, days: number): Date {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

/** "October 25–26": a liturgical day runs from the evening before. */
function daySpan(isoDate: string, arabic: boolean): string {
  return formatMonthDaySpan(addDaysIso(isoDate, -1), addDaysIso(isoDate, 0), arabic);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Text with the words searched for in gold (Coptic Vine design, "Synaxarium search"). */
function Marked({ text, words, style }: { text: string; words: string[]; style: StyleProp<TextStyle> }) {
  if (!words.length) return <Text style={style} maxFontSizeMultiplier={MAX_FONT_SCALE}>{text}</Text>;
  const parts = text.split(new RegExp(`(${words.map(escapeRegExp).join('|')})`, 'gi'));
  return (
    <Text style={style} maxFontSizeMultiplier={MAX_FONT_SCALE}>
      {parts.map((part, index) => (index % 2 ? <Text key={index} style={styles.mark}>{part}</Text> : part))}
    </Text>
  );
}

/**
 * The Synaxarium (Coptic Vine design, "Synaxarium" and "Synaxarium search"),
 * from Home's Commemorated Saints: the whole Coptic year, a card for each
 * day under its Coptic date, today's in the season's colours, and the month
 * being read above the list with a way to jump to another. A search lists
 * the saints it finds across the year in calendar order, each beside its
 * date, the words found in gold. A saint opens the day's Synaxarium as the
 * Liturgy of the Word reads it.
 */
export default function SynaxariumBrowserScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const didAutoScroll = useRef(false);
  // Each day card's top in the list, and the first day of each month, for the month heading and its jumps.
  const dayTops = useRef(new Map<string, number>());
  const { preferences } = useReadingPreferences();
  const { effectiveDate, isLive, selectDate } = useCalendar();
  const locale: 'en' | 'ar' = preferences.appLanguage === 'ar' ? 'ar' : 'en';
  const isArabic = locale === 'ar';
  // Only an English title is split into the saint and who they were.
  const splitTitles = preferences.appLanguage === 'en';
  const wide = useLayoutMode() !== 'phone';

  // This page is intentionally independent from the Books calendar picker.
  // Its today is the liturgical day, which begins the evening before
  // (utils/liturgicalDay.ts); the year around it is read once, as the page opens.
  const { liturgicalIso: liveIso } = useLiturgicalClock();
  const [yearIso] = useState(liveIso);
  // Home opens the page on the day of the saints it listed: today's or tomorrow's.
  const { day: dayParam } = useLocalSearchParams<{ day?: string }>();
  const focusIso = typeof dayParam === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dayParam) ? dayParam : liveIso;

  const [rows, setRows] = useState<SynaxariumYearRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Bumped by Retry on a failed load: a new value re-runs the load below.
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  // Today's card wears the season's colours, as the Books day block does.
  const [todayTheme, setTodayTheme] = useState<DayBlockTheme>(DAY_BLOCK_THEMES.annual);
  const [shownMonth, setShownMonth] = useState<number | null>(null);
  const [choosingMonth, setChoosingMonth] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    homeService.getSynaxariumYear(yearIso)
      .then((payload) => {
        if (active) setRows(payload);
      })
      .catch((cause) => {
        if (!active) return;
        setRows([]);
        setError(cause instanceof Error ? cause.message : 'Unable to load the Synaxarium.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [yearIso, attempt]);

  useEffect(() => {
    let active = true;
    getDayOverview(liveIso).then((overview) => {
      if (active) setTodayTheme(getDayTheme(overview?.indicatorKey, overview?.activeKeys));
    });
    return () => { active = false; };
  }, [liveIso]);

  const days = useMemo(() => groupRows(rows), [rows]);
  const normalizedQuery = useMemo(() => normalizeSearch(query), [query]);
  // The words searched for as typed, to mark where they fall in a title.
  const markedWords = useMemo(() => query.trim().split(/\s+/).filter((word) => word.length >= 2), [query]);

  const results = useMemo(() => {
    if (!normalizedQuery) return [];
    return days.flatMap((day) => day.entries
      .filter((entry) => normalizeSearch([entry.titleEnglish, entry.titleArabic].filter(Boolean).join(' ')).includes(normalizedQuery))
      .map((entry) => ({ day, entry })));
  }, [days, normalizedQuery]);

  const months = useMemo(() => {
    const seen = new Map<number, SynaxariumDay>();
    for (const day of days) if (!seen.has(day.copticMonth)) seen.set(day.copticMonth, day);
    return [...seen.values()];
  }, [days]);

  useEffect(() => {
    if (normalizedQuery) {
      didAutoScroll.current = false;
    }
  }, [normalizedQuery]);

  const monthDay = months.find((day) => day.copticMonth === (shownMonth ?? days.find((candidate) => candidate.gregorianDate === focusIso)?.copticMonth)) ?? months[0];

  /** The month heading follows the card at the top of the list. */
  const followMonth = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const top = event.nativeEvent.contentOffset.y + 24;
    let current: SynaxariumDay | undefined;
    for (const day of days) {
      const y = dayTops.current.get(day.gregorianDate);
      if (y === undefined || y > top) break;
      current = day;
    }
    if (current && current.copticMonth !== shownMonth) setShownMonth(current.copticMonth);
  };

  const jumpToMonth = (month: SynaxariumDay) => {
    setChoosingMonth(false);
    setShownMonth(month.copticMonth);
    const y = dayTops.current.get(month.gregorianDate);
    if (y !== undefined) scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });
  };

  // A saint's story, read for its own day: the Books move to it, as choosing a season does.
  const openReading = (isoDate: string) => {
    if (!(isLive && effectiveDate.toISOString().slice(0, 10) === isoDate)) selectDate(new Date(`${isoDate}T00:00:00Z`));
    router.push(SYNAXARIUM_READING as never);
  };

  const entryTitle = (entry: SynaxariumEntry) => {
    const title = isArabic ? entry.titleArabic || entry.titleEnglish || '' : entry.titleEnglish || entry.titleArabic || '';
    return splitTitles ? splitSaintTitle(title) : { main: title, detail: null };
  };

  const copticMonth = (monthName: string) => formatCopticMonthName(monthName, isArabic);
  const searching = Boolean(normalizedQuery);

  return (
    <BleedPage background={<PageGlow kind="green" tall={wide} />} footer={<BottomTabBar active="home" />}>
      <Head><title>Synaxarium — Coptic Vine</title></Head>
      <SubPageHeader
        title={tr('Synaxarium', 'Synaxaire', 'السنكسار')}
        arabic={isArabic}
        onBack={() => goBack(router, '/')}
        backLabel={tr('Back', 'Retour', 'رجوع')}
      />

      <View style={styles.column}>
        <View style={[styles.searchBox, (focused || query) && styles.searchBoxActive]}>
          <Icon name="search" size={18} color={COLORS.muted} />
          <TextInput
            ref={inputRef}
            accessibilityLabel={tr('Search Synaxarium', 'Rechercher dans le Synaxaire', 'بحث في السنكسار')}
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              // A search takes the place of the month list.
              if (text) setChoosingMonth(false);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={tr('Search saints and events', 'Rechercher des saints et des événements', 'ابحث عن قديس أو حدث')}
            placeholderTextColor="rgba(205, 216, 203, 0.6)"
            autoCapitalize="none"
            autoCorrect={false}
            selectionColor={COLORS.gold}
            style={[styles.searchInput, Platform.OS === 'web' && styles.searchInputWeb, isArabic && styles.arabic]}
          />
          {query ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={tr('Clear search', 'Effacer la recherche', 'مسح البحث')}
              hitSlop={8}
              onPress={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Icon name="close-circle" size={18} color={COLORS.muted} />
            </Pressable>
          ) : null}
        </View>

        {searching ? (
          <Text style={[styles.resultCount, isArabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {isArabic
              ? `${toEasternArabicDigits(results.length)} نتيجة`
              : tr(`${results.length} result${results.length === 1 ? '' : 's'}`, `${results.length} résultat${results.length === 1 ? '' : 's'}`, '')}
          </Text>
        ) : monthDay ? (
          <View style={styles.monthRow}>
            <Text style={[styles.monthName, isArabic && styles.arabic]} accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {copticMonth(monthDay.copticMonthName)}
              <Text style={styles.monthYear}>{'  '}{formatCopticYear(monthDay.copticYear, isArabic)}</Text>
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={tr('Go to a month', 'Aller à un mois', 'انتقل إلى شهر')}
              accessibilityState={{ expanded: choosingMonth }}
              hitSlop={6}
              onPress={() => setChoosingMonth((open) => !open)}
              style={({ pressed }) => [styles.roundButton, choosingMonth && styles.roundButtonOn, pressed && styles.pressed]}
            >
              <Icon name="calendar-outline" size={19} color={COLORS.gold} />
            </Pressable>
          </View>
        ) : null}

        {choosingMonth && !searching ? (
          <View style={styles.months}>
            {months.map((month) => {
              const current = month.copticMonth === monthDay?.copticMonth;
              return (
                <Pressable
                  key={month.copticMonth}
                  accessibilityRole="button"
                  accessibilityState={{ selected: current }}
                  onPress={() => jumpToMonth(month)}
                  style={({ pressed }) => [styles.monthChip, current && styles.monthChipOn, pressed && styles.pressed]}
                >
                  <Text style={[styles.monthChipText, current && styles.monthChipTextOn, isArabic && styles.arabicTight]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {copticMonth(month.copticMonthName)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={COLORS.gold} />
          <Text style={[styles.stateText, isArabic && styles.arabicCentered]}>
            {tr('Loading Synaxarium…', 'Chargement du Synaxaire…', 'جارٍ تحميل السنكسار…')}
          </Text>
        </View>
      ) : error ? (
        <LoadFailure error={error} onRetry={() => setAttempt((count) => count + 1)} />
      ) : searching && results.length === 0 ? (
        <View style={styles.centerState}>
          <Icon name="search-outline" size={30} color={COLORS.goldBright} />
          <Text style={[styles.stateTitle, isArabic && styles.arabicCentered]}>
            {tr('No results', 'Aucun résultat', 'لا توجد نتائج')}
          </Text>
          <Text style={[styles.stateText, isArabic && styles.arabicCentered]}>
            {tr('Try another name or spelling.', 'Essayez un autre nom ou une autre orthographe.', 'جرّب اسماً آخر أو صيغة مختلفة.')}
          </Text>
        </View>
      ) : searching ? (
        // Keyed apart from the days' list: in the same place, the results would otherwise open at its scroll.
        <NowPlayingAwareScrollView key="results" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={[styles.list, styles.resultList]}>
            {results.map(({ day, entry }) => {
              const isToday = day.gregorianDate === liveIso;
              const { main, detail } = entryTitle(entry);
              const date = formatCopticDayMonth(day.copticMonthName, day.copticDay, isArabic);
              return (
                <Pressable
                  key={entry.entryKey}
                  accessibilityRole="button"
                  accessibilityLabel={[date, main, detail].filter(Boolean).join(', ')}
                  onPress={() => openReading(day.gregorianDate)}
                  style={({ pressed }) => [styles.result, pressed && styles.pressed]}
                >
                  <LinearGradient colors={[COLORS.surfaceDeep, COLORS.surface]} style={StyleSheet.absoluteFill} pointerEvents="none" />
                  <View style={[styles.dateChip, isToday && styles.dateChipToday]}>
                    <Text style={[styles.dateChipMonth, day.copticMonthName.length > 7 && styles.dateChipMonthLong, isToday && styles.dateChipTextToday, isArabic && styles.arabicTight]} numberOfLines={1} maxFontSizeMultiplier={1.15}>
                      {isArabic ? copticMonth(day.copticMonthName) : day.copticMonthName.toUpperCase()}
                    </Text>
                    <Text style={[styles.dateChipDay, isToday && styles.dateChipTextToday]} maxFontSizeMultiplier={1.15}>
                      {isArabic ? toEasternArabicDigits(day.copticDay) : day.copticDay}
                    </Text>
                  </View>
                  <View style={styles.entryText}>
                    <Marked text={main} words={markedWords} style={[styles.resultTitle, isArabic && styles.arabic]} />
                    {detail ? <Marked text={detail} words={markedWords} style={[styles.entryDetail, isArabic && styles.arabic]} /> : null}
                  </View>
                  <View>
                    <Icon name="chevron-forward" size={18} color={COLORS.gold} />
                  </View>
                </Pressable>
              );
            })}
          </View>
        </NowPlayingAwareScrollView>
      ) : (
        <NowPlayingAwareScrollView
          key="days"
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, styles.list]}
          onScroll={followMonth}
          scrollEventThrottle={32}
        >
          {days.map((day) => {
            const isToday = day.gregorianDate === liveIso;
            const ink = isToday ? todayTheme : null;
            return (
              <View
                key={day.gregorianDate}
                onLayout={(event) => {
                  const y = event.nativeEvent.layout.y;
                  dayTops.current.set(day.gregorianDate, y);
                  if (day.gregorianDate !== focusIso || didAutoScroll.current) return;
                  didAutoScroll.current = true;
                  setTimeout(() => {
                    scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: false });
                  }, 0);
                }}
                style={[styles.dayCard, isToday && styles.dayCardToday]}
              >
                {ink ? (
                  <LinearGradient colors={[ink.from, ink.to]} locations={[0, ink.toAt]} start={{ x: 0.33, y: 0 }} end={{ x: 0.67, y: 1 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
                ) : (
                  <LinearGradient colors={[COLORS.surfaceDeep, COLORS.surface]} style={StyleSheet.absoluteFill} pointerEvents="none" />
                )}
                <View style={styles.dayHeader}>
                  <View style={styles.dayHeaderText}>
                    <Text style={[styles.dayTitle, ink && { color: ink.text }, isArabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                      {formatCopticDayMonth(day.copticMonthName, day.copticDay, isArabic)}
                    </Text>
                    <Text style={[styles.daySpan, ink && { color: ink.muted }, isArabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                      {daySpan(day.gregorianDate, isArabic)}
                    </Text>
                  </View>
                  {isToday ? (
                    <View style={styles.todayChip}>
                      <Text style={[styles.todayChipText, isArabic && styles.arabicTight]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                        {isArabic ? 'اليوم' : tr('Today', 'Aujourd’hui', '').toUpperCase()}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {day.entries.length ? (
                  <View style={styles.entries}>
                    {day.entries.map((entry) => {
                      const { main, detail } = entryTitle(entry);
                      return (
                        <Pressable
                          key={entry.entryKey}
                          accessibilityRole="button"
                          accessibilityLabel={detail ? `${main}, ${detail}` : main}
                          onPress={() => openReading(day.gregorianDate)}
                          style={({ pressed }) => [styles.entry, ink?.key === 'resurrection' && styles.entryOnLight, pressed && styles.pressed]}
                        >
                          <View style={styles.entryText}>
                            <Text style={[styles.entryTitle, ink && { color: ink.text }, isArabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{main}</Text>
                            {detail ? <Text style={[styles.entryDetail, ink && { color: ink.muted }, isArabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{detail}</Text> : null}
                          </View>
                          <Icon name="chevron-forward" size={18} color={COLORS.gold} />
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={[styles.noEntries, ink && { color: ink.muted }, isArabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {tr('No events listed.', 'Aucun événement.', 'لا توجد أحداث مدرجة.')}
                  </Text>
                )}
              </View>
            );
          })}
        </NowPlayingAwareScrollView>
      )}
    </BleedPage>
  );
}

const styles = StyleSheet.create({
  column: { alignSelf: 'center', maxWidth: 672, paddingHorizontal: 16, width: '100%' },
  searchBox: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderColor: 'transparent',
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 10,
    height: 46,
    paddingHorizontal: 13,
  },
  searchBoxActive: { backgroundColor: 'rgba(255, 255, 255, 0.1)', borderColor: COLORS.gold },
  searchInput: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    color: COLORS.white,
    flex: 1,
    fontFamily: TYPOGRAPHY.body,
    fontSize: 15.5,
    height: 42,
    minWidth: 0,
    paddingVertical: 0,
  },
  searchInputWeb: { boxShadow: 'none', outlineStyle: 'none', outlineWidth: 0 } as object,
  resultCount: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 13, paddingBottom: 10, paddingTop: 14 },
  monthRow: { alignItems: 'center', flexDirection: 'row', gap: 12, paddingBottom: 10, paddingTop: 16 },
  monthName: { color: COLORS.white, flex: 1, fontFamily: TYPOGRAPHY.title, fontSize: 20, fontWeight: '700' },
  monthYear: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 13.5, fontWeight: '400' },
  roundButton: { alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.07)', borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  roundButtonOn: { backgroundColor: COLORS.goldSoft },
  months: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 12 },
  monthChip: { backgroundColor: 'rgba(255, 255, 255, 0.07)', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 7 },
  monthChipOn: { backgroundColor: COLORS.gold },
  monthChipText: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 13.5, fontWeight: '600' },
  monthChipTextOn: { color: COLORS.greenDeep },
  content: { alignSelf: 'center', maxWidth: 672, paddingBottom: 32, paddingHorizontal: 16, width: '100%' },
  list: { gap: 10 },
  resultList: { paddingTop: 0 },
  dayCard: { borderRadius: 22, overflow: 'hidden', padding: 16 },
  dayCardToday: { boxShadow: '0px 10px 22px rgba(0, 0, 0, 0.3)' },
  dayHeader: { alignItems: 'flex-start', flexDirection: 'row', gap: 10 },
  dayHeaderText: { flex: 1, gap: 4, minWidth: 0 },
  dayTitle: { color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontSize: 24, fontWeight: '700', lineHeight: 26.4 },
  daySpan: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 13.5 },
  todayChip: { alignItems: 'center', backgroundColor: COLORS.gold, borderRadius: 99, height: 24, justifyContent: 'center', paddingHorizontal: 10 },
  todayChipText: { color: COLORS.greenDeep, fontFamily: TYPOGRAPHY.body, fontSize: 11, fontWeight: '800', letterSpacing: 0.88 },
  entries: { gap: 6, marginTop: 12 },
  entry: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 11,
    paddingLeft: 14,
    paddingRight: 12,
    paddingTop: 11,
  },
  // The Holy Fifty Days' white block: its saints on a pale card.
  entryOnLight: { backgroundColor: 'rgba(255, 255, 255, 0.55)' },
  entryText: { flex: 1, gap: 2, minWidth: 0 },
  entryTitle: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 15.5, fontWeight: '500', lineHeight: 20.9 },
  entryDetail: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 13 },
  noEntries: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 13, marginTop: 12 },
  result: {
    alignItems: 'center',
    borderRadius: 18,
    flexDirection: 'row',
    gap: 14,
    overflow: 'hidden',
    paddingBottom: 12,
    paddingLeft: 12,
    paddingRight: 14,
    paddingTop: 12,
  },
  resultTitle: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 15.5, fontWeight: '600', lineHeight: 20.9 },
  mark: { color: COLORS.gold },
  // A little wider than the design's 56 so Paremhotep's name fits.
  dateChip: { alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.32)', borderRadius: 14, gap: 4, height: 60, justifyContent: 'center', width: 64 },
  dateChipToday: { backgroundColor: COLORS.gold },
  dateChipMonth: { color: COLORS.gold, fontFamily: TYPOGRAPHY.body, fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  dateChipMonthLong: { fontSize: 8, letterSpacing: 0.2 },
  dateChipDay: { color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontSize: 23, fontWeight: '700', lineHeight: 23 },
  dateChipTextToday: { color: COLORS.greenDeep },
  centerState: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 32 },
  stateTitle: { color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontSize: 20, fontWeight: '800', marginTop: 10, textAlign: 'center' },
  stateText: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 13, lineHeight: 20, marginTop: 8, textAlign: 'center' },
  pressed: { opacity: 0.68 },
  arabic: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'left', writingDirection: 'rtl' },
  arabicCentered: { fontFamily: TYPOGRAPHY.arabic, writingDirection: 'rtl' },
  arabicTight: { fontFamily: TYPOGRAPHY.arabic, letterSpacing: 0 },
});
