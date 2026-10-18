'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { useLocalSearchParams, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { NowPlayingAwareScrollView } from '@/components/playback/NowPlayingAwareScroll';
import BottomTabBar from '@/components/vine/ui/BottomTabBar';
import CalendarSheet from '@/components/vine/ui/CalendarSheet';
import DayBlock from '@/components/vine/ui/DayBlock';
import LibraryBook from '@/components/vine/ui/LibraryBook';
import PageTitle from '@/components/vine/ui/PageTitle';
import { PageGlow } from '@/components/vine/screens/BookPage';
import { BookSettingsSheet } from '@/components/vine/screens/SettingsScreen';
import { useLiturgicalDay } from '@/components/vine/ui/useLiturgicalDay';
import { CATEGORIES, HOLY_WEEK_DAYS, holyWeekDayHref, type CategoryDef } from '@/constants/manifest';
import { SEASON_GLOWS } from '@/constants/seasonAppearance';
import { COLORS, TYPOGRAPHY } from '@/constants/theme';
import { useReadingPreferences } from '@/context/ReadingPreferencesContext';
import { formatCopticDayMonth } from '@/utils/localeFormat';
import { useSidePadding } from '@/utils/useSidePadding';
import { useHolyWeekSchedule } from '@/utils/useHolyWeekSchedule';
import { useContentWidth, useLayoutMode } from '@/utils/useLayoutMode';

import { appText, entryLabel, tr } from '../../utils/appText';

/** Books read every day are tiles; the rest are rows across the shelf. */
const WIDE_BOOKS = new Set(['agpeya', 'bible', 'holy-week']);

/** How many tiles sit side by side: two on a phone, more as the window widens. */
function columnsFor(width: number): number {
  if (width >= 1000) return 4;
  if (width >= 700) return 3;
  return 2;
}

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

/**
 * The Books tab (Coptic Vine design system, "DayBlock" and "BookShelf"): the
 * liturgical day in its season's colours, then the library, the whole page
 * under a glow in that season's colours. The iPad sets the day beside the
 * library; the desktop pins it in a narrower left column with the library
 * four books across.
 */
export default function BooksHome() {
  const router = useRouter();
  const { preferences } = useReadingPreferences();
  const width = useContentWidth();
  const layout = useLayoutMode();
  const insets = useSafeAreaInsets();
  const arabic = preferences.appLanguage === 'ar';
  const holyWeek = useHolyWeekSchedule();
  const day = useLiturgicalDay();
  const [calendarOpen, setCalendarOpen] = useState(false);
  // Opened straight away for a /book-settings link (see app/book-settings.tsx).
  const { settings: settingsParam } = useLocalSearchParams<{ settings?: string }>();
  const [settingsOpen, setSettingsOpen] = useState(settingsParam === 'open');

  // The page glows in the season of the day the block shows, and changes with
  // it -- once the new day is read: until then the day keeps the last one's
  // season (useLiturgicalDay), so swiping between two weeks of one fast never
  // flashes green behind it.
  const glow = SEASON_GLOWS[day.theme.key];

  // While Pascha is being prayed the day block's footer is the way into the
  // day or eve being prayed right now.
  const current = holyWeek ? HOLY_WEEK_DAYS.find((entry) => entry.id === holyWeek.currentDayId) ?? null : null;
  const openSeasons = () => router.push('/season-selector');

  const description = (item: CategoryDef) => {
    // The Lectionary names the day it reads: "Readings for Thoout 20".
    if (item.id === 'lectionary' && day.coptic) {
      const date = formatCopticDayMonth(day.coptic.monthName, day.coptic.day, arabic);
      return tr(`Readings for ${date}`, `Lectures du ${date}`, `قراءات ${date}`);
    }
    return appText({ english: item.meta, arabic: item.metaArabic, french: item.metaFrench });
  };

  // Downloads are managed on the Downloads & Storage page alone: the shelf only opens books.
  const renderBook = (item: CategoryDef) => (
    <LibraryBook
      key={item.id}
      title={entryLabel(item)}
      description={description(item)}
      arabic={arabic}
      wide={WIDE_BOOKS.has(item.id)}
      onPress={() => router.push(`/${item.id}`)}
    />
  );

  const tiles = CATEGORIES.filter((item) => !WIDE_BOOKS.has(item.id));
  const rows = CATEGORIES.filter((item) => WIDE_BOOKS.has(item.id));
  const columns = layout === 'desktop' ? 4 : layout === 'tablet' ? 2 : columnsFor(width);
  const rowColumns = layout === 'desktop' ? 2 : layout === 'tablet' ? 1 : width >= 700 ? 2 : 1;

  const title = (
    <PageTitle
      title={tr('Books', 'Livres', 'الكتب')}
      arabic={arabic}
      flush={layout !== 'phone'}
      actions={[
        { icon: 'bookmark-outline', label: tr('Open bookmarks', 'Ouvrir les signets', 'افتح العلامات'), onPress: () => router.push('/bookmarks') },
        { icon: 'settings-outline', label: tr('Open settings', 'Ouvrir les réglages', 'افتح الإعدادات'), onPress: () => setSettingsOpen(true) },
      ]}
    />
  );
  const dayBlock = (
    <DayBlock
      day={day}
      arabic={arabic}
      onOpenCalendar={() => setCalendarOpen(true)}
      onOpenSeasons={openSeasons}
      action={current ? { label: entryLabel(current), onPress: () => router.push(holyWeekDayHref(current) as never) } : undefined}
    />
  );
  const library = (
    <>
      {/* Beside the day block, the heading sits under the glow's light too. */}
      <Text style={[styles.section, arabic && styles.arabic]} accessibilityRole="header">
        {tr('Library', 'Bibliothèque', 'المكتبة')}
      </Text>
      <View style={styles.shelf}>
        {chunk(tiles, columns).map((row) => (
          <View key={row[0].id} style={styles.shelfRow}>
            {row.map(renderBook)}
            {/* A short last row keeps its tiles tile-sized. */}
            {Array.from({ length: columns - row.length }).map((_, index) => <View key={`gap-${index}`} style={styles.gap} />)}
          </View>
        ))}
        {chunk(rows, rowColumns).map((row) => (
          <View key={row[0].id} style={styles.shelfRow}>
            {row.map(renderBook)}
          </View>
        ))}
      </View>
    </>
  );

  // The page runs to both edges; its content keeps clear of the notch.
  const sidePadding = useSidePadding(layout !== 'phone' ? 36 : 0);

  return (
    <SafeAreaView edges={[]} style={styles.safeArea}>
      <Head>
        <title>{tr('Books', 'Livres', 'الكتب')}</title>
      </Head>

      <NowPlayingAwareScrollView
        // Keyed by layout: a turn of the phone mounts the page afresh rather than
        // restyling its views in place, which iOS laid out wrongly (a column of zero width).
        key={layout}
        contentContainerStyle={[styles.content, layout !== 'phone' && [styles.contentWide, { paddingTop: insets.top + 28 }], sidePadding]}
        showsVerticalScrollIndicator={false}
      >
        <PageGlow kind={glow} tall={layout !== 'phone'} />
        {layout === 'phone' ? (
          <View style={styles.column}>
            {title}
            <View style={styles.gutter}>
              {dayBlock}
              {library}
            </View>
          </View>
        ) : (
          <View style={styles.columns}>
            <View style={layout === 'desktop' ? styles.dayColumn : styles.half}>
              <View style={styles.titleBeside}>{title}</View>
              {dayBlock}
            </View>
            <View style={styles.half}>{library}</View>
          </View>
        )}
      </NowPlayingAwareScrollView>

      <CalendarSheet visible={calendarOpen} onClose={() => setCalendarOpen(false)} onOpenSeasons={openSeasons} />
      <BookSettingsSheet
        visible={settingsOpen}
        onClose={() => {
          setSettingsOpen(false);
          if (settingsParam) router.setParams({ settings: undefined });
        }}
      />
      <BottomTabBar active="books" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.black },
  content: { paddingBottom: 28 },
  // A desktop browser is far wider than the shelf wants to be; past this it centres.
  column: { alignSelf: 'center', maxWidth: 980, width: '100%' },
  gutter: { paddingHorizontal: 16 },
  contentWide: { paddingHorizontal: 36 },
  columns: { alignItems: 'flex-start', flexDirection: 'row', gap: 28 },
  dayColumn: { width: 420 },
  half: { flex: 1, minWidth: 0 },
  // In the iPad's and desktop's columns the title keeps the 6pt it has under a
  // phone's status bar; the library's heading beside it then sits its 28pt down.
  titleBeside: { paddingTop: 6 },
  section: { color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontSize: 21, fontWeight: '700', marginBottom: 12, marginTop: 28 },
  arabic: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'left', writingDirection: 'rtl' },
  shelf: { gap: 12 },
  shelfRow: { flexDirection: 'row', gap: 12 },
  gap: { flex: 1 },
});
