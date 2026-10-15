'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { MutableRefObject, type ReactNode, useEffect, useRef, useState } from 'react';
import {
  Animated,
  GestureResponderEvent,
  PanResponder,
  PanResponderGestureState,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

import LearningArtwork from '@/components/learning/LearningArtwork';
import LearningItemActionsMenu from '@/components/learning/LearningItemActionsMenu';
import MusicArtwork from '@/components/music/MusicArtwork';
import MusicTrackActionsMenu from '@/components/music/MusicTrackActionsMenu';
import RoundIconButton from '@/components/playback/RoundIconButton';
import Icon, { type IconName } from '@/components/vine/ui/Icon';
import { COLORS, RADII, SPACING, TYPOGRAPHY } from '@/constants/theme';
import type { LearningQueueItem } from '@/context/LearningPlayerContext';
import type { QueueEntryView } from '@/context/queueEntries';
import type { PlaybackRepeatMode } from '@/types/playback';
import { formatMusicTrackPerformers } from '@/utils/musicCredits';

import { tr } from '../../utils/appText';
// Rows are a fixed height so a drag distance maps directly onto a slot index.
const ROW_HEIGHT = 64;
const COMPACT_ROW_HEIGHT = 52;
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

/** Which player the list is open in, or which kind a row is: each has its colour. */
export type QueueTone = 'music' | 'learning';

const TONES: Record<QueueTone, { accent: string; bright: string; soft: string; line: string; icon: IconName }> = {
  music: { accent: COLORS.gold, bright: COLORS.goldBright, soft: COLORS.goldSoft, line: COLORS.goldLine, icon: 'musical-notes-outline' },
  learning: { accent: COLORS.learning, bright: COLORS.learningBright, soft: COLORS.learningSoft, line: COLORS.learningLine, icon: 'school-outline' },
};

interface PlaybackQueueListProps {
  /** The whole queue, in the engine's order — see queueEntries.ts. */
  entries: QueueEntryView[];
  /** The engine's index of what is playing. */
  currentIndex: number;
  playing: boolean;
  isArabic: boolean;
  onSelect: (index: number) => void;
  onMove: (fromIndex: number, toIndex: number) => void;
  onClear: () => void;
  shuffleEnabled: boolean;
  repeatMode: PlaybackRepeatMode;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
  /** The player this list is open in; its header takes that colour, each row its own kind's. */
  tone?: QueueTone;
  likedTrackIds?: ReadonlySet<string>;
  onToggleLikeTrack?: (trackId: string) => void;
  likedLearningIds?: ReadonlySet<string>;
  onToggleLikeLearning?: (item: LearningQueueItem) => void;
  compact?: boolean;
  /**
   * `true` gives the list its own scroll area (a side panel, a sheet).
   * Otherwise the rows sit inline and the page scrolls; use
   * onDragActiveChange to lock the page while a row is being dragged.
   */
  scrollable?: boolean;
  onDragActiveChange?: (active: boolean) => void;
  style?: StyleProp<ViewStyle>;
}

interface DragHandlers {
  start: (index: number) => void;
  move: (dy: number) => void;
  end: () => void;
}

interface DragState {
  from: number;
  dy: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * The queue as the engine holds it: Music tracks and Learn & Study items in
 * one list, each row in its own kind's colour with its own artwork and
 * actions, dragged into any order. Shared by both players, so what a lesson
 * queued after a song looks like is the same whichever one is open.
 */
export default function PlaybackQueueList({
  entries,
  currentIndex,
  playing,
  isArabic,
  onSelect,
  onMove,
  onClear,
  shuffleEnabled,
  repeatMode,
  onToggleShuffle,
  onCycleRepeat,
  tone = 'music',
  likedTrackIds,
  onToggleLikeTrack,
  likedLearningIds,
  onToggleLikeLearning,
  compact = false,
  scrollable = false,
  onDragActiveChange,
  style,
}: PlaybackQueueListProps) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const count = entries.length;
  const rowHeight = compact ? COMPACT_ROW_HEIGHT : ROW_HEIGHT;
  const target = drag ? clamp(drag.from + Math.round(drag.dy / rowHeight), 0, count - 1) : -1;
  const colors = TONES[tone];

  const offsetFor = (index: number): number => {
    if (!drag) return 0;
    if (index === drag.from) {
      // Keep the lifted row inside the list instead of letting it fly off.
      return clamp(drag.dy, -drag.from * rowHeight, (count - 1 - drag.from) * rowHeight);
    }
    if (drag.from < index && index <= target) return -rowHeight;
    if (target <= index && index < drag.from) return rowHeight;
    return 0;
  };

  // Row responders are created once, so they call through this ref to reach
  // the current render's drag state.
  const handlers = useRef<DragHandlers>({ start: () => undefined, move: () => undefined, end: () => undefined });
  useEffect(() => {
    handlers.current = {
      start: (index) => {
        setDrag({ from: index, dy: 0 });
        onDragActiveChange?.(true);
      },
      move: (dy) => setDrag((current) => (current ? { ...current, dy } : current)),
      end: () => {
        if (drag && target >= 0 && target !== drag.from) onMove(drag.from, target);
        setDrag(null);
        onDragActiveChange?.(false);
      },
    };
  });

  const upNext = Math.max(0, count - Math.max(0, currentIndex) - 1);
  const repeatLabel = repeatMode === 'one' ? 'Repeat one' : repeatMode === 'all' ? 'Repeat all' : 'Repeat off';

  const rows = (
    <View style={[styles.list, { height: count * rowHeight }, Platform.OS === 'web' && styles.noSelect]}>
      {entries.map((entry, index) => (
        <QueueRow
          key={entry.key}
          index={index}
          entry={entry}
          active={index === currentIndex}
          playing={playing}
          offset={offsetFor(index)}
          lifted={drag?.from === index}
          dragging={drag != null}
          handlers={handlers}
          onSelect={onSelect}
          likedTrackIds={likedTrackIds}
          onToggleLikeTrack={onToggleLikeTrack}
          likedLearningIds={likedLearningIds}
          onToggleLikeLearning={onToggleLikeLearning}
          isArabic={isArabic}
          compact={compact}
          rowHeight={rowHeight}
        />
      ))}
    </View>
  );

  return (
    <View style={[styles.card, scrollable && styles.cardScrollable, style]}>
      <View style={[styles.header, compact && styles.headerCompact]}>
        <View style={styles.headerTop}>
          <Text style={[styles.headerTitle, compact && styles.headerTitleCompact, isArabic && styles.arabic]}>{tr('Queue', 'File d’attente', 'قائمة الانتظار')}</Text>
          <View style={styles.modeButtons}>
            <RoundIconButton
              icon="shuffle"
              accessibilityLabel={shuffleEnabled ? 'Shuffle on' : 'Shuffle off'}
              active={shuffleEnabled}
              accentColor={colors.accent}
              onPress={onToggleShuffle}
              size={compact ? 38 : 46}
            />
            <RoundIconButton
              icon="repeat"
              accessibilityLabel={repeatLabel}
              active={repeatMode !== 'off'}
              accentColor={colors.accent}
              badge={repeatMode === 'one' ? '1' : undefined}
              onPress={onCycleRepeat}
              size={compact ? 38 : 46}
            />
          </View>
        </View>
        <View style={[styles.headerBottom, compact && styles.headerBottomCompact]}>
          <Text style={[styles.headerMeta, compact && styles.headerMetaCompact, isArabic && styles.arabic]}>
            {tr(
              `${upNext} up next · ${count} ${count === 1 ? 'item' : 'items'}`,
              `${upNext} à suivre · ${count} ${count === 1 ? 'élément' : 'éléments'}`,
              `${upNext} التالي · ${count}`,
            )}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tr('Clear queue', 'Vider la file', 'مسح قائمة الانتظار')}
            disabled={count <= 1}
            onPress={onClear}
            style={({ pressed }) => [
              styles.clearButton,
              { borderColor: colors.line, backgroundColor: colors.soft },
              count <= 1 && styles.clearButtonDisabled,
              pressed && styles.pressed,
            ]}
          >
            <Icon name="close" size={12} color={count <= 1 ? COLORS.muted : colors.bright} />
            <Text style={[styles.clearText, { color: colors.bright }, count <= 1 && styles.clearTextDisabled]}>{tr('Clear queue', 'Vider la file', 'مسح')}</Text>
          </Pressable>
        </View>
      </View>

      {scrollable ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          scrollEnabled={drag == null}
          nestedScrollEnabled
        >
          {rows}
        </ScrollView>
      ) : rows}
    </View>
  );
}

interface QueueRowProps {
  index: number;
  entry: QueueEntryView;
  active: boolean;
  playing: boolean;
  offset: number;
  lifted: boolean;
  dragging: boolean;
  handlers: MutableRefObject<DragHandlers>;
  onSelect: (index: number) => void;
  likedTrackIds?: ReadonlySet<string>;
  onToggleLikeTrack?: (trackId: string) => void;
  likedLearningIds?: ReadonlySet<string>;
  onToggleLikeLearning?: (item: LearningQueueItem) => void;
  isArabic: boolean;
  compact: boolean;
  rowHeight: number;
}

/** What a row shows for its kind of entry: its colour, picture, words, like and actions. */
function describeRow(
  entry: QueueEntryView,
  compact: boolean,
  isArabic: boolean,
  likes: Pick<QueueRowProps, 'likedTrackIds' | 'onToggleLikeTrack' | 'likedLearningIds' | 'onToggleLikeLearning'>,
): { tone: QueueTone; title: string; subtitle: string; artwork: ReactNode; liked: boolean; onToggleLike?: () => void; actions: ReactNode } {
  const artSize = compact ? 36 : 44;
  switch (entry.kind) {
    case 'music': {
      const { item } = entry;
      return {
        tone: 'music',
        title: item.track.title,
        subtitle: formatMusicTrackPerformers(item.track, item.releaseTitle ?? ''),
        artwork: <MusicArtwork asset={item.coverAsset} size={artSize} radius={6} label={item.releaseTitle ?? item.track.title} />,
        liked: likes.likedTrackIds?.has(item.track.id) ?? false,
        onToggleLike: likes.onToggleLikeTrack ? () => likes.onToggleLikeTrack?.(item.track.id) : undefined,
        actions: <MusicTrackActionsMenu item={item} isArabic={isArabic} size={compact ? 32 : 36} />,
      };
    }
    case 'learning': {
      const { item } = entry;
      return {
        tone: 'learning',
        title: item.title,
        subtitle: `${item.cantorName} · ${item.containerTitle}`,
        artwork: <LearningArtwork asset={item.coverAsset} size={artSize} radius={6} label={item.containerTitle} />,
        liked: likes.likedLearningIds?.has(item.id) ?? false,
        onToggleLike: likes.onToggleLikeLearning ? () => likes.onToggleLikeLearning?.(item) : undefined,
        actions: <LearningItemActionsMenu item={item} isArabic={isArabic} size={compact ? 32 : 36} />,
      };
    }
    default:
      return {
        tone: 'music',
        title: entry.title,
        subtitle: entry.subtitle ?? '',
        artwork: <View style={[styles.unknownArt, { width: artSize, height: artSize }]} />,
        liked: false,
        actions: null,
      };
  }
}

function QueueRow({ index, entry, active, playing, offset, lifted, dragging, handlers, onSelect, likedTrackIds, onToggleLikeTrack, likedLearningIds, onToggleLikeLearning, isArabic, compact, rowHeight }: QueueRowProps) {
  const [translateY] = useState(() => new Animated.Value(0));
  const indexRef = useRef(index);
  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  useEffect(() => {
    // The lifted row tracks the pointer 1:1, other rows glide out of its way,
    // and on drop everything snaps to 0 in the same frame the reorder lands,
    // so rows never animate twice.
    if (lifted || !dragging) {
      translateY.setValue(offset);
      return;
    }
    Animated.timing(translateY, { toValue: offset, duration: 140, useNativeDriver: USE_NATIVE_DRIVER }).start();
  }, [dragging, lifted, offset, translateY]);

  // Created once: a PanResponder keeps its gesture state per instance, so
  // rebuilding it mid-drag would reset dy and drop the row.
  // eslint-disable-next-line react-hooks/refs -- refs are read in gesture callbacks, not during render
  const [panResponder] = useState(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => handlers.current.start(indexRef.current),
    onPanResponderMove: (_event: GestureResponderEvent, gesture: PanResponderGestureState) => handlers.current.move(gesture.dy),
    onPanResponderRelease: () => handlers.current.end(),
    onPanResponderTerminate: () => handlers.current.end(),
  }));

  const row = describeRow(entry, compact, isArabic, { likedTrackIds, onToggleLikeTrack, likedLearningIds, onToggleLikeLearning });
  const colors = TONES[row.tone];
  const state = active ? `${playing ? tr('Now playing', 'En lecture', 'قيد التشغيل') : tr('Paused', 'En pause', 'متوقف')} · ` : '';

  return (
    <Animated.View
      style={[
        styles.rowShell,
        { top: index * rowHeight, height: rowHeight, transform: [{ translateY }] },
        lifted && styles.rowLifted,
      ]}
    >
      <View style={[styles.row, active && { backgroundColor: colors.soft }, lifted && styles.rowLiftedInner, lifted && { borderColor: colors.line }]}>
        <View
          accessibilityRole="adjustable"
          accessibilityLabel={`Reorder ${row.title}`}
          style={[styles.handle, compact && styles.handleCompact, Platform.OS === 'web' && styles.handleWeb]}
          {...panResponder.panHandlers}
        >
          <Icon name="reorder" size={compact ? 18 : 22} color={lifted ? colors.bright : COLORS.muted} />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Play ${row.title}`}
          disabled={dragging}
          onPress={() => onSelect(index)}
          style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}
        >
          {row.artwork}
          <View style={styles.rowText}>
            <Text numberOfLines={1} style={[styles.rowTitle, compact && styles.rowTitleCompact, active && { color: colors.bright }]}>{row.title}</Text>
            <View style={styles.rowMeta}>
              {/* A queue of both kinds tells them apart at a glance. */}
              <Icon name={colors.icon} size={compact ? 10 : 12} color={colors.accent} />
              <Text numberOfLines={1} style={[styles.rowSubtitle, compact && styles.rowSubtitleCompact]}>
                {state}{row.subtitle}
              </Text>
            </View>
          </View>
        </Pressable>
        {row.onToggleLike ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={row.liked ? `Unlike ${row.title}` : `Like ${row.title}`}
            disabled={dragging}
            onPress={row.onToggleLike}
            style={({ pressed }) => [styles.likeButton, compact && styles.likeButtonCompact, pressed && styles.pressed]}
          >
            <Icon name={row.liked ? 'heart' : 'heart-outline'} size={compact ? 16 : 17} color={row.liked ? colors.bright : COLORS.muted} />
          </Pressable>
        ) : null}
        {!dragging ? row.actions : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: SPACING.lg,
    borderRadius: RADII.lg,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingBottom: SPACING.xs,
  },
  cardScrollable: { marginTop: 0, flex: 1, minHeight: 0, overflow: 'hidden' },
  header: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: SPACING.xs,
  },
  headerCompact: { paddingTop: 8, paddingBottom: 6, marginBottom: 2 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.sm },
  headerBottomCompact: { marginTop: 4 },
  modeButtons: { flexDirection: 'row', gap: 10 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: SPACING.sm },
  headerTitle: { color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontSize: 22, fontWeight: '700' },
  headerTitleCompact: { fontSize: 18 },
  headerMeta: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 12, marginTop: 2 },
  headerMetaCompact: { fontSize: 11 },
  arabic: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'left', writingDirection: 'rtl' },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 28,
    paddingHorizontal: 10,
    borderRadius: RADII.pill,
    borderWidth: 1,
  },
  clearButtonDisabled: { borderColor: COLORS.border, backgroundColor: 'transparent' },
  clearText: { fontFamily: TYPOGRAPHY.body, fontSize: 12, fontWeight: '700' },
  clearTextDisabled: { color: COLORS.muted },
  list: { position: 'relative' },
  noSelect: { userSelect: 'none' } as object,
  rowShell: { position: 'absolute', left: 0, right: 0, paddingHorizontal: SPACING.xs },
  rowLifted: { zIndex: 10, elevation: 10 },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: SPACING.xs,
  },
  rowLiftedInner: {
    backgroundColor: COLORS.surfaceSoft,
    borderWidth: 1,
    ...Platform.select({
      web: { boxShadow: '0 10px 28px rgba(0, 0, 0, 0.55)' } as object,
      default: { shadowColor: COLORS.shadow, shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
    }),
  },
  rowMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12, height: '100%' },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 14, fontWeight: '700' },
  rowTitleCompact: { fontSize: 13 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  rowSubtitle: { color: COLORS.muted, flexShrink: 1, fontFamily: TYPOGRAPHY.body, fontSize: 12 },
  rowSubtitleCompact: { fontSize: 10 },
  unknownArt: { borderRadius: 6, backgroundColor: COLORS.surfaceSoft },
  likeButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  likeButtonCompact: { width: 32, height: 32, borderRadius: 16 },
  handle: { width: 48, height: '100%', alignItems: 'center', justifyContent: 'center' },
  handleCompact: { width: 38 },
  handleWeb: { cursor: 'grab', touchAction: 'none' } as object,
  pressed: { opacity: 0.7 },
});
