'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Platform,
    Pressable,
    ScrollView,
    StyleProp,
    StyleSheet,
    Text,
    TextStyle,
    useWindowDimensions,
    View,
    ViewStyle,
} from 'react-native';

import { edgeFade, PLAYER_INK } from '@/components/playback/PlayerParts';
import { COLORS, RADII, SPACING, TYPOGRAPHY } from '@/constants/theme';
import type { PublishedLyricSet } from '@/types/musicConsumer';
import { useReducedMotion } from '@/utils/useReducedMotion';

import { tr } from '../../utils/appText';

export function lyricSetLabel(set: PublishedLyricSet): string {
  const localeNames: Record<string, string> = { en: 'English', ar: 'Arabic', cop: 'Coptic', fr: 'French' };
  const base = localeNames[set.locale] ?? set.locale.toUpperCase();
  if (set.kind === 'transliteration') return `${base} Transliteration`;
  if (set.kind === 'translation') return `${base} Translation`;
  return base;
}

export function lyricSetShortLabel(set: PublishedLyricSet): string {
  const localeNames: Record<string, string> = { en: 'ENG', ar: 'ARA', cop: 'COP', fr: 'FRE' };
  return localeNames[set.locale] ?? set.locale.slice(0, 3).toUpperCase();
}

function languageName(locale: string): string {
  switch (locale) {
    case 'en': return tr('English', 'Anglais', 'الإنجليزية');
    case 'ar': return tr('Arabic', 'Arabe', 'العربية');
    case 'cop': return tr('Coptic', 'Copte', 'القبطية');
    case 'fr': return tr('French', 'Français', 'الفرنسية');
    default: return locale.toUpperCase();
  }
}

/**
 * A set's name on the player's language switch: just its language
 * ("Coptic", "English"), as the design has it, unless two sets share one
 * and need their kind to tell them apart.
 */
export function lyricSetTabLabel(set: PublishedLyricSet, sets: readonly PublishedLyricSet[]): string {
  const base = languageName(set.locale);
  if (sets.filter((other) => other.locale === set.locale).length < 2) return base;
  if (set.kind === 'transliteration') return `${base} · ${tr('Translit.', 'Translit.', 'نقحرة')}`;
  if (set.kind === 'translation') return `${base} · ${tr('Transl.', 'Trad.', 'ترجمة')}`;
  return base;
}

interface LyricsLanguageSwitchProps {
  sets: readonly PublishedLyricSet[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** `wide` fills its row (the phone's full screen); `mini` sits in a header. */
  size?: 'wide' | 'mini';
  isArabic?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** The player's Coptic | English pill switch between lyric sets. */
export function LyricsLanguageSwitch({ sets, selectedId, onSelect, size = 'mini', isArabic = false, style }: LyricsLanguageSwitchProps) {
  if (sets.length < 2) return null;
  const wide = size === 'wide';
  return (
    <View accessibilityRole="tablist" style={[styles.switch, wide && styles.switchWide, style]}>
      {sets.map((set) => {
        const selected = set.id === selectedId;
        return (
          <Pressable
            key={set.id}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={tr(`Lyrics in ${lyricSetLabel(set)}`, `Paroles en ${lyricSetTabLabel(set, sets)}`, `الكلمات بـ${lyricSetTabLabel(set, sets)}`)}
            onPress={() => onSelect(set.id)}
            style={({ pressed }) => [
              styles.switchItem,
              wide ? styles.switchItemWide : styles.switchItemMini,
              selected && styles.switchItemOn,
              pressed && styles.pressed,
              Platform.OS === 'web' && styles.webCursor,
            ]}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.switchText,
                !wide && styles.switchTextMini,
                selected && styles.switchTextOn,
                isArabic && styles.rtl,
              ]}
            >
              {lyricSetTabLabel(set, sets)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * How the player sets its lines (Coptic Vine Player design): `panel` beside
 * the desktop player, and the full screen's three scales — `phone`, a phone
 * on its side (`landscape`), and `large` for an iPad or a desktop window.
 */
export type LyricsScale = 'panel' | 'phone' | 'landscape' | 'large';

const SCALES: Record<LyricsScale, { size: number; lineHeight: number; gap: number; top: number; fade: number; centred: boolean }> = {
  panel: { size: 23, lineHeight: 29.9, gap: 14, top: 0, fade: 86, centred: false },
  phone: { size: 29, lineHeight: 37.7, gap: 18, top: 26, fade: 75, centred: true },
  landscape: { size: 23, lineHeight: 29.9, gap: 10, top: 14, fade: 75, centred: true },
  large: { size: 54, lineHeight: 62.1, gap: 28, top: 60, fade: 70, centred: true },
};

interface MusicLyricsViewProps {
  lyricSets: PublishedLyricSet[];
  selectedSetId: string | null;
  onSelectSet: (id: string) => void;
  activeLineId: string | null;
  loading: boolean;
  onSeekLine: (startMs: number) => void;
  /**
   * `panel` is the track page's own list. `player` is the now-playing
   * player's, set at `scale`: the line before the one being sung stays in
   * view above it, sung lines fade back and the ones to come wait between.
   */
  variant?: 'panel' | 'player';
  scale?: LyricsScale;
  /** Force the denser phone treatment, including when landscape width is large. */
  forceCompact?: boolean;
  /** Lets the parent provide a more space-efficient selector. */
  hideTabs?: boolean;
  accentColor?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Language tabs plus the synchronized lines. Owns its own scroll view so it
 * can keep the active line in view without moving the rest of the page.
 */
export default function MusicLyricsView({
  lyricSets,
  selectedSetId,
  onSelectSet,
  activeLineId,
  loading,
  onSeekLine,
  variant = 'panel',
  scale = 'panel',
  forceCompact = false,
  hideTabs = false,
  accentColor = COLORS.gold,
  style,
}: MusicLyricsViewProps) {
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const lineOffsets = useRef(new Map<string, number>());
  const viewportHeight = useRef(0);
  // The player's lines run on past the end by most of a screen, so the last
  // ones can still rise to the reading place.
  const [runout, setRunout] = useState(120);
  const reduced = useReducedMotion();
  const player = variant === 'player';
  const metrics = SCALES[scale];
  const compact = forceCompact || width < 420;
  const selectedSet = lyricSets.find((set) => set.id === selectedSetId) ?? null;
  const unsynced = selectedSet?.syncPrecision === 'unsynced';
  const activeIndex = selectedSet && activeLineId ? selectedSet.lines.findIndex((line) => line.id === activeLineId) : -1;

  useEffect(() => {
    lineOffsets.current.clear();
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [selectedSetId]);

  useEffect(() => {
    if (!activeLineId) return;
    const y = lineOffsets.current.get(activeLineId);
    if (y == null) return;
    if (player) {
      // The line just sung sits at the top, the one being sung under it.
      const lines = selectedSet?.lines ?? [];
      const index = lines.findIndex((line) => line.id === activeLineId);
      const previous = index > 0 ? lineOffsets.current.get(lines[index - 1].id) : null;
      scrollRef.current?.scrollTo({ y: Math.max(0, previous ?? y), animated: !reduced });
      return;
    }
    // Hold the active line a little above centre, where the eye reads.
    scrollRef.current?.scrollTo({ y: Math.max(0, y - viewportHeight.current * 0.35), animated: !reduced });
  }, [activeLineId, player, reduced, selectedSet]);

  if (player) {
    const coptic = selectedSet?.locale === 'cop';
    const arabic = selectedSet?.locale === 'ar';
    const lineStyle: StyleProp<TextStyle> = [
      styles.playerLine,
      { fontSize: metrics.size, lineHeight: metrics.lineHeight },
      metrics.centred && styles.centred,
      coptic && styles.playerCoptic,
      arabic && styles.arabic,
      arabic && !metrics.centred && styles.arabicPanel,
    ];
    return (
      <View style={[styles.root, style]}>
        <ScrollView
          ref={scrollRef}
          style={[styles.scroll, edgeFade(null, metrics.fade)]}
          contentContainerStyle={{ paddingTop: metrics.top, paddingBottom: runout }}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          onLayout={(event) => {
            viewportHeight.current = event.nativeEvent.layout.height;
            setRunout(Math.max(120, Math.round(event.nativeEvent.layout.height * 0.6)));
          }}
        >
          {loading && !selectedSet ? <ActivityIndicator color={accentColor} style={styles.loader} /> : null}
          {selectedSet ? (
            <View style={{ gap: metrics.gap }}>
              {selectedSet.lines.map((line, index) => (
                <Pressable
                  accessibilityRole="button"
                  key={line.id}
                  disabled={line.startMs == null}
                  onLayout={(event) => lineOffsets.current.set(line.id, event.nativeEvent.layout.y)}
                  onPress={() => line.startMs != null && onSeekLine(line.startMs)}
                  style={({ pressed }) => [pressed && styles.pressed, Platform.OS === 'web' && line.startMs != null && styles.webCursor]}
                >
                  <Text
                    style={[
                      lineStyle,
                      unsynced || index === activeIndex
                        ? styles.lineNow
                        : activeIndex >= 0 && index < activeIndex ? styles.lineSung : styles.lineToCome,
                    ]}
                  >
                    {line.text}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : !loading ? (
            <Text style={[styles.playerEmpty, metrics.centred && styles.centred]}>
              {tr('No lyrics for this one yet.', 'Pas encore de paroles pour celui-ci.', 'لا توجد كلمات لهذا بعد.')}
            </Text>
          ) : null}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.root, style]}>
      {lyricSets.length > 1 && !hideTabs ? (
        <View style={[styles.tabs, compact && styles.tabsCompact]}>
          {lyricSets.map((set) => {
            const selected = set.id === selectedSetId;
            return (
              <Pressable
                key={set.id}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => onSelectSet(set.id)}
                style={({ pressed }) => [
                  styles.tab,
                  compact && styles.tabCompact,
                  selected && styles.tabActive,
                  selected && { backgroundColor: accentColor },
                  pressed && styles.pressed,
                ]}
              >
                <Text numberOfLines={1} style={[styles.tabText, compact && styles.tabTextCompact, selected && styles.tabTextActive]}>{lyricSetLabel(set)}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.content, compact && styles.contentCompact]}
        nestedScrollEnabled
        onLayout={(event) => { viewportHeight.current = event.nativeEvent.layout.height; }}
      >
        {loading && !selectedSet ? <ActivityIndicator color={accentColor} style={styles.loader} /> : null}

        {selectedSet ? (
          <View>
            {selectedSet.lines.map((line) => {
              const active = line.id === activeLineId;
              return (
                <Pressable accessibilityRole="button"
                  key={line.id}
                  disabled={line.startMs == null}
                  onLayout={(event) => lineOffsets.current.set(line.id, event.nativeEvent.layout.y)}
                  onPress={() => line.startMs != null && onSeekLine(line.startMs)}
                  style={({ pressed }) => [styles.line, pressed && styles.pressed]}
                >
                  <Text
                    style={[
                      styles.lineText,
                      compact && styles.lineTextCompact,
                      selectedSet.locale === 'ar' && styles.arabic,
                      // The panel keeps Arabic aligned to its own reading edge.
                      selectedSet.locale === 'ar' && styles.arabicPanel,
                      selectedSet.locale === 'cop' && styles.coptic,
                      selectedSet.locale === 'cop' && compact && styles.copticCompact,
                      unsynced && styles.lineTextUnsynced,
                      active && styles.lineTextActive,
                    ]}
                  >
                    {line.text}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : !loading ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No lyrics yet</Text>
            <Text style={styles.emptyBody}>This recording can still be played normally.</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },

  switch: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 99,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  switchWide: { alignSelf: 'stretch' },
  switchItem: { alignItems: 'center', justifyContent: 'center', borderRadius: 99 },
  switchItemWide: { flex: 1, height: 34, paddingHorizontal: 18 },
  switchItemMini: { height: 28, paddingHorizontal: 13 },
  switchItemOn: { backgroundColor: COLORS.gold },
  switchText: { color: 'rgba(255, 255, 255, 0.7)', fontFamily: TYPOGRAPHY.body, fontSize: 14, fontWeight: '700' },
  switchTextMini: { fontSize: 12.5 },
  switchTextOn: { color: PLAYER_INK },
  rtl: { writingDirection: 'rtl' },

  playerLine: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontWeight: '700' },
  playerCoptic: { fontFamily: TYPOGRAPHY.musicCoptic, fontWeight: '400' },
  centred: { textAlign: 'center' },
  lineNow: { color: COLORS.white },
  lineSung: { color: 'rgba(255, 255, 255, 0.28)' },
  lineToCome: { color: 'rgba(255, 255, 255, 0.48)' },
  playerEmpty: { color: 'rgba(255, 255, 255, 0.55)', fontFamily: TYPOGRAPHY.body, fontSize: 15, fontWeight: '600', paddingTop: SPACING.md },

  tabs: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    padding: 4,
    borderRadius: RADII.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  tabsCompact: { marginHorizontal: 12 },
  tab: { flex: 1, minHeight: 34, paddingHorizontal: 10, borderRadius: RADII.pill, alignItems: 'center', justifyContent: 'center' },
  tabCompact: { minHeight: 30, paddingHorizontal: 8 },
  tabActive: { backgroundColor: COLORS.gold },
  tabText: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 13, fontWeight: '700' },
  tabTextCompact: { fontSize: 11 },
  tabTextActive: { color: COLORS.black },
  scroll: { flex: 1 },
  content: { paddingHorizontal: SPACING.md + 4, paddingTop: SPACING.sm, paddingBottom: SPACING.xl },
  contentCompact: { paddingHorizontal: 12, paddingTop: 8 },
  loader: { marginTop: SPACING.xl },
  line: { paddingVertical: 7, borderRadius: 8 },
  lineText: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 20, lineHeight: 30, fontWeight: '600', opacity: 0.55 },
  lineTextCompact: { fontSize: 16, lineHeight: 24 },
  lineTextActive: { color: COLORS.white, opacity: 1 },
  lineTextUnsynced: { color: COLORS.white, opacity: 1 },
  arabic: { fontFamily: TYPOGRAPHY.arabic, writingDirection: 'rtl' },
  arabicPanel: { textAlign: 'right' },
  coptic: { fontFamily: TYPOGRAPHY.musicCoptic, fontSize: 23, lineHeight: 33 },
  copticCompact: { fontSize: 18, lineHeight: 27 },
  empty: { alignItems: 'center', paddingVertical: SPACING.xl, paddingHorizontal: SPACING.md },
  emptyTitle: { color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontSize: 18, fontWeight: '700' },
  emptyBody: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 13, marginTop: SPACING.sm, textAlign: 'center' },
  pressed: { opacity: 0.7 },
  webCursor: { cursor: 'pointer' } as object,
});
