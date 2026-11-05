'use no memo'; // Names the readings in the planner's language.
import { forwardRef, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { documentInitialColors, documentOrnamentColor } from '@/constants/documentOrnaments';
import { getDocumentTheme } from '@/constants/documentThemes';
import type { SeasonThemeKey } from '@/constants/seasonAppearance';
import { SERMON_COLORS } from '@/constants/sermonPlanner';
import { MOTION, TYPOGRAPHY } from '@/constants/theme';
import type { SermonReading, SermonReadingsByService } from '@/hooks/useSermonReadings';
import type { SermonHighlight } from '@/types/sermonPlanner';
import { highlightGroupId } from '@/utils/highlightGroups';
import { toArabicReferenceDigits, toEasternArabicDigits } from '@/utils/localeFormat';
import type { ReadingPreferences } from '@/utils/preferencesStorage';
import type { LectionaryService } from '@/utils/readingsService';
import DocumentSurface from '../DocumentSurface';
import type { DocumentAction, DocumentWebViewHandle } from '../DocumentWebView';
import Icon from '../ui/Icon';
import LoadFailure from '../ui/LoadFailure';
import { pick } from './SermonPieces';

const SERVICES: { key: LectionaryService; english: string; arabic: string }[] = [
  { key: 'Vespers', english: 'Vespers', arabic: 'عشية' },
  { key: 'Matins', english: 'Matins', arabic: 'باكر' },
  { key: 'Liturgy', english: 'Liturgy', arabic: 'القداس' },
];

/** How many highlights (whole ones, however many verses each spans) a reading holds. */
export function highlightCountsByReading(readings: SermonReadingsByService | null, highlights: readonly SermonHighlight[]) {
  const counts: Record<string, number> = {};
  if (!readings) return counts;
  const readingOfSection = new Map<string, string>();
  for (const service of SERVICES) {
    for (const reading of readings[service.key]) {
      for (const section of reading.sections) readingOfSection.set(section.id, reading.key);
    }
  }
  const counted = new Set<string>();
  for (const highlight of highlights) {
    const key = readingOfSection.get(highlight.sectionId);
    const group = highlightGroupId(highlight);
    if (!key || counted.has(group)) continue;
    counted.add(group);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

/** The reading a highlight is in. */
export function readingOfHighlight(readings: SermonReadingsByService | null, highlight: SermonHighlight): SermonReading | null {
  if (!readings) return null;
  for (const service of SERVICES) {
    const found = readings[service.key].find((reading) => reading.sections.some((section) => section.id === highlight.sectionId));
    if (found) return found;
  }
  return null;
}

interface SermonReadingsPaneProps {
  readings: SermonReadingsByService | null;
  error: Error | null;
  onRetry: () => void;
  service: LectionaryService;
  onServiceChange: (service: LectionaryService) => void;
  reading: SermonReading | null;
  onReadingChange: (reading: SermonReading) => void;
  highlights: SermonHighlight[];
  preferences: ReadingPreferences;
  arabic: boolean;
  /** The day's season colour on black: the reading's citation. */
  ornament: string;
  /** The day's season: the reading's drop cap is drawn in its colours, as the reader draws it. */
  season: SeasonThemeKey;
  /** "Add to Point 2" in the toolbar; null when there's no part to add to. */
  placeLabel: string | null;
  /** Phone: the chips scroll in one line. */
  compact: boolean;
  onAction: (action: DocumentAction) => void;
}

/**
 * The day's readings, as the Lectionary lists them: a service, then each of
 * its readings as a chip carrying how many highlights it holds, then the
 * reading itself, highlighted where it has been.
 */
const SermonReadingsPane = forwardRef<DocumentWebViewHandle, SermonReadingsPaneProps>(function SermonReadingsPane(
  { readings, error, onRetry, service, onServiceChange, reading, onReadingChange, highlights, preferences, arabic, ornament, season, placeLabel, compact, onAction },
  ref,
) {
  const counts = useMemo(() => highlightCountsByReading(readings, highlights), [readings, highlights]);
  const pageTheme = getDocumentTheme(preferences.documentTheme);
  const list = readings?.[service] ?? [];
  const readingHighlights = useMemo(
    () => (reading ? highlights.filter((highlight) => reading.sections.some((section) => section.id === highlight.sectionId)) : []),
    [highlights, reading],
  );
  // "Liturgy Gospel"; in Arabic the reading first: "الإنجيل · القداس".
  const serviceName = reading ? SERVICES.find((entry) => entry.key === reading.service) : null;
  const kicker = reading && serviceName
    ? (arabic ? `${reading.label.arabic} · ${serviceName.arabic}` : `${serviceName.english} ${reading.label.english}`)
    : '';
  const citation = reading ? (arabic ? toArabicReferenceDigits(reading.citation.arabic || reading.citation.english) : reading.citation.english) : '';

  const chips = list.map((entry) => {
    const on = entry.key === reading?.key;
    const count = counts[entry.key] ?? 0;
    return (
      <Pressable
        key={entry.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: on }}
        accessibilityLabel={`${arabic ? entry.label.arabic : entry.label.english}${count ? `, ${count}` : ''}`}
        onPress={() => onReadingChange(entry)}
        style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && styles.pressed]}
      >
        <Text style={[styles.chipText, on && styles.chipTextOn]}>{arabic ? entry.label.arabic : entry.label.english}</Text>
        {count ? (
          <View style={styles.count}>
            <Text style={styles.countText}>{arabic ? toEasternArabicDigits(count) : String(count)}</Text>
          </View>
        ) : null}
      </Pressable>
    );
  });

  return (
    <View style={styles.pane}>
      <View style={[styles.tabs, arabic && styles.rtl]} accessibilityRole="tablist">
        {SERVICES.map((entry) => {
          const on = entry.key === service;
          return (
            <Pressable
              key={entry.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              onPress={() => onServiceChange(entry.key)}
              style={[styles.tab, on && styles.tabOn]}
            >
              <Text style={[styles.tabText, on && styles.tabTextOn]}>{arabic ? entry.arabic : entry.english}</Text>
            </Pressable>
          );
        })}
      </View>
      {compact ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={[styles.chipsRow, arabic && styles.rtl]}>
          {chips}
        </ScrollView>
      ) : (
        <View style={[styles.chipsWrap, arabic && styles.rtl]}>{chips}</View>
      )}
      {error ? (
        <LoadFailure error={error.message} onRetry={onRetry} />
      ) : !readings ? (
        <View style={styles.waiting} />
      ) : reading ? (
        <>
          <View style={styles.title}>
            <Text style={styles.kicker}>{kicker}</Text>
            {citation ? <Text style={[styles.citation, { color: ornament }]}>{citation}</Text> : null}
          </View>
          <View style={styles.text}>
            <DocumentSurface
              key={`${reading.key}:${preferences.sermonPlannerVisibleLanguages.arabic ? 'ar' : 'en'}`}
              ref={ref}
              sections={reading.sections}
              preferences={preferences}
              collapseMemoryScope={`sermon:${reading.key}`}
              onAction={onAction}
              sermonPlannerMode
              sermonHighlights={readingHighlights}
              sermonPlaceLabel={placeLabel}
              ornamentColor={documentOrnamentColor(pageTheme, season)}
              initialColors={documentInitialColors(pageTheme, season)}
              swipeExitsInPage={false}
            />
            {!readingHighlights.length ? (
              <View pointerEvents="none" style={styles.hint}>
                <Icon name="create-outline" size={16} color={SERMON_COLORS.gold} />
                <Text style={styles.hintText}>{pick(arabic, 'Select a verse to highlight it into the plan', 'حدّد آية لتضيفها إلى الخطة')}</Text>
              </View>
            ) : null}
          </View>
        </>
      ) : (
        <Text style={styles.none}>{pick(arabic, 'No readings for this service on this day.', 'لا قراءات لهذه الخدمة في هذا اليوم.')}</Text>
      )}
    </View>
  );
});

export default SermonReadingsPane;

const styles = StyleSheet.create({
  pressed: { opacity: MOTION.pressOpacity },
  rtl: { flexDirection: 'row-reverse' },
  pane: { flex: 1, minHeight: 0, minWidth: 0 },
  tabs: { borderBottomColor: SERMON_COLORS.line, borderBottomWidth: 1, flexDirection: 'row', gap: 24 },
  tab: { paddingBottom: 10, paddingTop: 9 },
  tabOn: { borderBottomColor: SERMON_COLORS.gold, borderBottomWidth: 2, marginBottom: -1 },
  tabText: { color: SERMON_COLORS.muted, fontSize: 15, fontWeight: '600' },
  tabTextOn: { color: SERMON_COLORS.text },
  chipScroll: { flexGrow: 0, marginBottom: 4, marginTop: 12 },
  chipsRow: { flexDirection: 'row', gap: 8 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4, marginTop: 12 },
  chip: { alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: 999, flexDirection: 'row', gap: 6, height: 32, paddingHorizontal: 12 },
  chipOn: { backgroundColor: SERMON_COLORS.raised },
  chipText: { color: SERMON_COLORS.muted, fontSize: 13, fontWeight: '600' },
  chipTextOn: { color: SERMON_COLORS.text },
  count: { alignItems: 'center', backgroundColor: SERMON_COLORS.gold, borderRadius: 999, height: 18, justifyContent: 'center', minWidth: 18, paddingHorizontal: 5 },
  countText: { color: SERMON_COLORS.onGold, fontSize: 11, fontWeight: '800' },
  title: { alignItems: 'center', marginBottom: 4, marginTop: 12 },
  kicker: { color: SERMON_COLORS.muted, fontSize: 11, fontWeight: '600', letterSpacing: 1.5, marginBottom: 4, textTransform: 'uppercase' },
  citation: { fontFamily: TYPOGRAPHY.title, fontSize: 19, textAlign: 'center' },
  text: { flex: 1, minHeight: 0 },
  waiting: { flex: 1 },
  none: { color: SERMON_COLORS.muted, fontSize: 14, marginTop: 24, textAlign: 'center' },
  hint: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#141E16',
    borderRadius: 999,
    bottom: 16,
    flexDirection: 'row',
    gap: 8,
    height: 36,
    paddingHorizontal: 16,
    position: 'absolute',
    zIndex: 2,
  },
  hintText: { color: SERMON_COLORS.muted, fontSize: 13 },
});
