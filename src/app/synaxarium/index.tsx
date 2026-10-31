'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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

import { NowPlayingAwareFlatList, NowPlayingAwareScrollView } from '@/components/playback/NowPlayingAwareScroll';
import { PageGlow } from '@/components/vine/screens/BookPage';
import BleedPage from '@/components/vine/ui/BleedPage';
import BottomTabBar from '@/components/vine/ui/BottomTabBar';
import Icon from '@/components/vine/ui/Icon';
import LoadFailure from '@/components/vine/ui/LoadFailure';
import SubPageHeader from '@/components/vine/ui/SubPageHeader';
import { DAY_BLOCK_THEMES, getDayTheme, type DayBlockTheme } from '@/constants/seasonAppearance';
import { COLORS, TYPOGRAPHY } from '@/constants/theme';
import { useLiturgicalClock } from '@/context/LiturgicalClockContext';
import { useReadingPreferences } from '@/context/ReadingPreferencesContext';
import { homeService, type SynaxariumYearRow } from '@/services/homeService';
import { getDayOverview } from '@/utils/calendarService';
import { formatCopticDayMonth, formatCopticMonthName, formatCopticYear, formatMonthDaySpan, toEasternArabicDigits } from '@/utils/localeFormat';
import { goBack } from '@/utils/navigation';
import { splitSaintTitle } from '@/utils/saintTitles';
import { synaxariumEntryHref } from '@/utils/synaxariumEntryDocument';
import { useLayoutMode } from '@/utils/useLayoutMode';

import { tr } from '../../utils/appText';

const MAX_FONT_SCALE = 1.3;

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

/** The space between two day cards, and so between two months (styles.list). */
const CARD_GAP = 10;
/** The months drawn on either side of the one the page opens on, or jumps to. */
const MONTHS_AROUND = 1;
/** How near either end of what is drawn, in screens, the reader comes before the next month is drawn. */
const DRAW_WITHIN = 1.5;
/** An earlier month drawn above, the list stays where it was (iOS and Android; the web does it itself). */
const KEEP_IN_PLACE = { minIndexForVisible: 0 };

interface SynaxariumMonth {
  copticMonth: number;
  days: SynaxariumDay[];
}

/** The days in their months, in the year's order. */
function groupMonths(days: SynaxariumDay[]): SynaxariumMonth[] {
  const months: SynaxariumMonth[] = [];
  for (const day of days) {
    const last = months[months.length - 1];
    if (last && last.copticMonth === day.copticMonth) last.days.push(day);
    else months.push({ copticMonth: day.copticMonth, days: [day] });
  }
  return months;
}

// The year as last read, kept while the app runs: the page opens again at once, without reading it again.
let lastYear: { key: string; rows: SynaxariumYearRow[] } | null = null;

/** A saint's title as listed: in the App Language, and in English split into the saint and who they were. */
function titleOf(entry: SynaxariumEntry, isArabic: boolean, splitTitles: boolean) {
  const title = isArabic ? entry.titleArabic || entry.titleEnglish || '' : entry.titleEnglish || entry.titleArabic || '';
  return splitTitles ? splitSaintTitle(title) : { main: title, detail: null };
}

interface DayCardProps {
  day: SynaxariumDay;
  today: boolean;
  ink: DayBlockTheme | null;
  /** The App Language, read by tr(): changed, the card is drawn again in it. */
  language: string;
  isArabic: boolean;
  splitTitles: boolean;
  openEntry: (entryKey: string, isoDate: string) => void;
  /** Given to the day the page opens on: its top in its month, to scroll to. */
  onFocusLayout?: (y: number) => void;
}

/** A day's card: its Coptic date and span, and its saints, each opening its own entry. Drawn again only when what it shows changes. */
const DayCard = memo(function DayCard({ day, today, ink, isArabic, splitTitles, openEntry, onFocusLayout }: DayCardProps) {
  return (
    <View
      onLayout={onFocusLayout ? (event) => onFocusLayout(event.nativeEvent.layout.y) : undefined}
      style={[styles.dayCard, today && styles.dayCardToday]}
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
        {today ? (
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
            const { main, detail } = titleOf(entry, isArabic, splitTitles);
            return (
              <Pressable
                key={entry.entryKey}
                accessibilityRole="button"
                accessibilityLabel={detail ? `${main}, ${detail}` : main}
                onPress={() => openEntry(entry.entryKey, day.gregorianDate)}
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
});

interface MonthDaysProps extends Omit<DayCardProps, 'day' | 'today' | 'ink' | 'onFocusLayout'> {
  month: SynaxariumMonth;
  liveIso: string;
  todayTheme: DayBlockTheme;
  focusIso: string;
  onFocusLayout: (y: number) => void;
  onMonthLayout: (copticMonth: number, height: number) => void;
}

/** A month's day cards, drawn as one: its height tells the list where each month begins. */
const MonthDays = memo(function MonthDays({ month, liveIso, todayTheme, focusIso, onFocusLayout, onMonthLayout, ...card }: MonthDaysProps) {
  return (
    <View style={styles.list} onLayout={(event) => onMonthLayout(month.copticMonth, event.nativeEvent.layout.height)}>
      {month.days.map((day) => (
        <DayCard
          key={day.gregorianDate}
          day={day}
          today={day.gregorianDate === liveIso}
          ink={day.gregorianDate === liveIso ? todayTheme : null}
          onFocusLayout={day.gregorianDate === focusIso ? onFocusLayout : undefined}
          {...card}
        />
      ))}
    </View>
  );
});

const ResultGap = () => <View style={styles.resultGap} />;

/**
 * The Synaxarium (Coptic Vine design, "Synaxarium" and "Synaxarium search"),
 * from Home's Commemorated Saints: the whole Coptic year, a card for each
 * day under its Coptic date, today's in the season's colours, and the month
 * being read above the list with a way to jump to another. A search lists
 * the saints it finds across the year in calendar order, each beside its
 * date, the words found in gold. A saint opens its own entry as a document,
 * as Home's saints do (utils/synaxariumEntryDocument.ts).
 *
 * Only the months around where the reader is are drawn: the one the page
 * opens on (or jumps to) and those either side, the next drawn as the reader
 * nears either end. Drawn whole, the year's 365 cards and their saints took
 * seconds to open on a phone, and stayed drawn under each saint's entry.
 */
export default function SynaxariumBrowserScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const didAutoScroll = useRef(false);
  const { preferences } = useReadingPreferences();
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

  const [rows, setRows] = useState<SynaxariumYearRow[]>(() => (lastYear?.key === yearIso ? lastYear.rows : []));
  const [loading, setLoading] = useState(() => lastYear?.key !== yearIso);
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
    if (lastYear?.key === yearIso) return undefined;
    let active = true;

    homeService.getSynaxariumYear(yearIso)
      .then((payload) => {
        lastYear = { key: yearIso, rows: payload };
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
  const monthGroups = useMemo(() => groupMonths(days), [days]);
  const months = useMemo(() => monthGroups.map((month) => month.days[0]), [monthGroups]);
  const normalizedQuery = useMemo(() => normalizeSearch(query), [query]);
  // The words searched for as typed, to mark where they fall in a title.
  const markedWords = useMemo(() => query.trim().split(/\s+/).filter((word) => word.length >= 2), [query]);

  const results = useMemo(() => {
    if (!normalizedQuery) return [];
    return days.flatMap((day) => day.entries
      .filter((entry) => normalizeSearch([entry.titleEnglish, entry.titleArabic].filter(Boolean).join(' ')).includes(normalizedQuery))
      .map((entry) => ({ day, entry })));
  }, [days, normalizedQuery]);

  useEffect(() => {
    if (normalizedQuery) {
      didAutoScroll.current = false;
    }
  }, [normalizedQuery]);

  // The months drawn: those around the day the page opens on, until the reader goes further or jumps to another.
  const focusMonth = Math.max(0, monthGroups.findIndex((month) => month.days.some((day) => day.gregorianDate === focusIso)));
  const [span, setSpan] = useState<{ first: number; last: number } | null>(null);
  const drawn = span ?? { first: Math.max(0, focusMonth - MONTHS_AROUND), last: Math.min(monthGroups.length - 1, focusMonth + MONTHS_AROUND) };
  // Bumped by a jump to a month: the list is drawn afresh around that month.
  const [listKey, setListKey] = useState(0);
  // Each drawn month's height, and the opening day's top in its month: where the list scrolls to, and which month heads it.
  const monthHeights = useRef(new Map<number, number>());
  const focusTop = useRef<number | null>(null);
  // A month jumped to: the list lands at its top, as it opens on the day the page opened on.
  const jumpedTo = useRef<number | null>(null);
  // A month being drawn: no other until it is laid out. On the web, where the list stood before one was drawn above it.
  const growing = useRef(false);
  const prependFrom = useRef<{ height: number; top: number } | null>(null);

  const monthDay = months.find((day) => day.copticMonth === (shownMonth ?? monthGroups[focusMonth]?.copticMonth)) ?? months[0];

  /** A drawn month's top in the list, once it and those above it are laid out. */
  const monthTop = (index: number): number | null => {
    let top = 0;
    for (let at = drawn.first; at < index; at++) {
      const height = monthHeights.current.get(monthGroups[at].copticMonth);
      if (height === undefined) return null;
      top += height + CARD_GAP;
    }
    return top;
  };

  /**
   * Opened, the list goes to the day the page opened on; jumped, to the top
   * of the month jumped to: once it and the month drawn above it are laid out.
   */
  const land = () => {
    if (didAutoScroll.current) return;
    const month = jumpedTo.current ?? focusMonth;
    const within = jumpedTo.current === null ? focusTop.current : 0;
    if (within === null || month < drawn.first || month > drawn.last) return;
    const top = monthTop(month);
    if (top === null) return;
    didAutoScroll.current = true;
    const y = Math.max(0, top + within - 8);
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y, animated: false });
    }, 0);
  };

  // The months' layouts, answered with what the page has now; passed down unchanged, so the months aren't drawn again.
  const layouts = useRef({ month: (_copticMonth: number, _height: number) => {}, focus: (_y: number) => {} });
  useEffect(() => {
    layouts.current = {
      month: (copticMonth, height) => {
        // Hidden under a saint's entry on the web, a month measures nothing: it keeps the height it had.
        if (height > 0) monthHeights.current.set(copticMonth, height);
        growing.current = false;
        land();
      },
      focus: (y) => {
        focusTop.current = y;
        land();
      },
    };
  });
  const onMonthLayout = useCallback((copticMonth: number, height: number) => layouts.current.month(copticMonth, height), []);
  const onFocusLayout = useCallback((y: number) => layouts.current.focus(y), []);

  const scrollNode = () => (scrollRef.current as unknown as { getScrollableNode?: () => HTMLElement | null } | null)?.getScrollableNode?.() ?? null;

  // On the web, a month drawn above moves the list down by its height: it is put back before the page is painted.
  useLayoutEffect(() => {
    const from = prependFrom.current;
    if (!from) return;
    prependFrom.current = null;
    const node = scrollNode();
    if (node) node.scrollTop = from.top + (node.scrollHeight - from.height);
  }, [drawn.first]);

  /** The month heading follows the card at the top of the list. */
  const followMonth = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const top = event.nativeEvent.contentOffset.y + 24;
    let y = 0;
    let current: number | undefined;
    for (let at = drawn.first; at <= drawn.last; at++) {
      if (y > top) break;
      current = monthGroups[at].copticMonth;
      const height = monthHeights.current.get(current);
      if (height === undefined) break;
      y += height + CARD_GAP;
    }
    if (current !== undefined && current !== shownMonth) setShownMonth(current);
  };

  /** Near either end of what is drawn, the next month is drawn there. */
  const onDaysScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    // Hidden (the web hides the page under a saint's entry), the list has no height and says nothing of where it is.
    if (!event.nativeEvent.layoutMeasurement.height) return;
    followMonth(event);
    if (!didAutoScroll.current || growing.current) return;
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const near = layoutMeasurement.height * DRAW_WITHIN;
    if (drawn.last < monthGroups.length - 1 && contentOffset.y + layoutMeasurement.height > contentSize.height - near) {
      growing.current = true;
      setSpan({ first: drawn.first, last: drawn.last + 1 });
    } else if (drawn.first > 0 && contentOffset.y < near) {
      growing.current = true;
      const node = Platform.OS === 'web' ? scrollNode() : null;
      if (node) prependFrom.current = { height: node.scrollHeight, top: node.scrollTop };
      setSpan({ first: drawn.first - 1, last: drawn.last });
    }
  };

  const jumpToMonth = (month: SynaxariumDay) => {
    setChoosingMonth(false);
    setShownMonth(month.copticMonth);
    const index = monthGroups.findIndex((group) => group.copticMonth === month.copticMonth);
    if (index < 0) return;
    // Drawn afresh around that month, with the one before it above, the list
    // lands at its top: drawn first, at the very top, nothing would scroll to
    // draw the month before it.
    didAutoScroll.current = false;
    jumpedTo.current = index;
    growing.current = false;
    prependFrom.current = null;
    setSpan({ first: Math.max(0, index - MONTHS_AROUND), last: Math.min(monthGroups.length - 1, index + MONTHS_AROUND) });
    setListKey((key) => key + 1);
  };

  // A saint's story, as a document of its own, read for its own day
  // (app/synaxarium/[entryKey].tsx), as Home's saints open: the Books' day stays where it was.
  const openEntry = useCallback((entryKey: string, isoDate: string) => router.push(synaxariumEntryHref(entryKey, isoDate) as never), [router]);

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
              // A search takes the place of the month list; the days open again around the day the page opened on.
              if (text) {
                setChoosingMonth(false);
                setSpan(null);
                jumpedTo.current = null;
              }
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
        <LoadFailure
          error={error}
          onRetry={() => {
            setError(null);
            setLoading(true);
            setAttempt((count) => count + 1);
          }}
        />
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
        // A list that draws only what is in sight: a short search finds hundreds of saints.
        <NowPlayingAwareFlatList
          key="results"
          data={results}
          keyExtractor={({ day, entry }) => `${day.gregorianDate}:${entry.entryKey}`}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          ItemSeparatorComponent={ResultGap}
          initialNumToRender={12}
          windowSize={7}
          renderItem={({ item: { day, entry } }) => {
            const isToday = day.gregorianDate === liveIso;
            const { main, detail } = titleOf(entry, isArabic, splitTitles);
            const date = formatCopticDayMonth(day.copticMonthName, day.copticDay, isArabic);
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={[date, main, detail].filter(Boolean).join(', ')}
                onPress={() => openEntry(entry.entryKey, day.gregorianDate)}
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
          }}
        />
      ) : (
        <NowPlayingAwareScrollView
          key={`days-${listKey}`}
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, styles.list]}
          onScroll={onDaysScroll}
          scrollEventThrottle={32}
          maintainVisibleContentPosition={Platform.OS === 'web' ? undefined : KEEP_IN_PLACE}
        >
          {monthGroups.slice(drawn.first, drawn.last + 1).map((month) => (
            <MonthDays
              key={month.copticMonth}
              month={month}
              liveIso={liveIso}
              todayTheme={todayTheme}
              focusIso={focusIso}
              language={preferences.appLanguage}
              isArabic={isArabic}
              splitTitles={splitTitles}
              openEntry={openEntry}
              onFocusLayout={onFocusLayout}
              onMonthLayout={onMonthLayout}
            />
          ))}
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
  list: { gap: CARD_GAP },
  resultGap: { height: CARD_GAP },
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
