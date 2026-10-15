'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { LinearGradient } from 'expo-linear-gradient';
import { MutableRefObject, type ReactNode, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  GestureResponderEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
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
import PlayerIcon, { type PlayerIconName } from '@/components/playback/PlayerIcon';
import { edgeFade, PLAYER_FAINT, PLAYER_SHEET, shortPerformerLine } from '@/components/playback/PlayerParts';
import RoundIconButton from '@/components/playback/RoundIconButton';
import { COLORS, TYPOGRAPHY } from '@/constants/theme';
import type { QueueEntryView } from '@/context/queueEntries';
import type { PlaybackRepeatMode } from '@/types/playback';
import { motionDuration, useReducedMotion } from '@/utils/useReducedMotion';

import { tr } from '../../utils/appText';
// Rows are a fixed height so a drag distance maps directly onto a slot: the
// design's 46pt thumbnail with 6pt above and below.
const ROW_HEIGHT = 58;
// "Played 6" above the rows already heard: 16pt over it, 6pt under.
const PLAYED_LABEL_HEIGHT = 35;
// The row playing stands 4pt clear of the rows either side of it.
const BEFORE_CURRENT = 4;
const AFTER_CURRENT = 4;
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

/** Which player the list is open in, or which kind a row is: each has its colour. */
export type QueueTone = 'music' | 'learning';

const TONES: Record<QueueTone, { accent: string; icon: PlayerIconName }> = {
  music: { accent: COLORS.gold, icon: 'musical-notes-outline' },
  learning: { accent: COLORS.learning, icon: 'school-outline' },
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
  /** The player this list is open in: what its entries are called ("10 hymns", "11 lessons"). */
  tone?: QueueTone;
  /**
   * `sheet`: risen over the phone player, on its near-black. `panel`: beside
   * the player, on the glass of its backdrop.
   */
  surface?: 'sheet' | 'panel';
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
 * The queue as the engine holds it (Coptic Vine Player design, "Queue
 * sheet"): the rows already heard, faded under "Played", the one playing in
 * gold with its bars moving, and the rest to come, each dragged by its grip
 * into any order. Music tracks and Learn & Study items share the one list,
 * so what a lesson queued after a song looks like is the same whichever
 * player is open; only when both kinds are queued does each row mark its own.
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
  surface = 'panel',
  scrollable = false,
  onDragActiveChange,
  style,
}: PlaybackQueueListProps) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [moreBelow, setMoreBelow] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const viewport = useRef(0);
  const placed = useRef(false);
  const count = entries.length;
  const played = Math.max(0, Math.min(currentIndex, count));
  const labelHeight = played > 0 ? PLAYED_LABEL_HEIGHT : 0;
  const mixed = entries.some((entry) => entry.kind === 'music') && entries.some((entry) => entry.kind === 'learning');

  const topFor = (index: number): number => {
    let top = labelHeight + index * ROW_HEIGHT;
    if (currentIndex >= 0 && index >= currentIndex) top += BEFORE_CURRENT;
    if (currentIndex >= 0 && index > currentIndex) top += AFTER_CURRENT;
    return top;
  };
  const listHeight = count > 0 ? topFor(count - 1) + ROW_HEIGHT : 0;

  // The slot the lifted row is over: the one whose top lies nearest it.
  let target = -1;
  if (drag) {
    const lifted = topFor(drag.from) + drag.dy;
    let best = Number.POSITIVE_INFINITY;
    for (let slot = 0; slot < count; slot += 1) {
      const distance = Math.abs(topFor(slot) - lifted);
      if (distance < best) {
        best = distance;
        target = slot;
      }
    }
  }

  const offsetFor = (index: number): number => {
    if (!drag) return 0;
    if (index === drag.from) {
      // Keep the lifted row inside the list instead of letting it fly off.
      return clamp(drag.dy, topFor(0) - topFor(drag.from), topFor(count - 1) - topFor(drag.from));
    }
    if (drag.from < index && index <= target) return topFor(index - 1) - topFor(index);
    if (target <= index && index < drag.from) return topFor(index + 1) - topFor(index);
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

  // Opened, the list shows what plays with a couple of the rows just heard
  // above it, rather than the start of a long history. Risen as a sheet it
  // always does, the history running off above; beside the player it starts
  // at the top, as long as what plays is in sight from there.
  const placeCurrent = () => {
    if (placed.current || !scrollable || currentIndex < 0 || viewport.current <= 0) return;
    placed.current = true;
    if (played <= 2) return;
    if (surface === 'panel' && topFor(currentIndex) + ROW_HEIGHT <= viewport.current) return;
    scrollRef.current?.scrollTo({ y: topFor(currentIndex) - BEFORE_CURRENT - ROW_HEIGHT * 2, animated: false });
  };

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    setScrolled(contentOffset.y > 2);
    setMoreBelow(contentOffset.y + layoutMeasurement.height < contentSize.height - 2);
  };

  const noun = mixed
    ? tr(`${count} ${count === 1 ? 'item' : 'items'}`, `${count} ${count === 1 ? 'élément' : 'éléments'}`, `${count} عناصر`)
    : tone === 'learning'
      ? tr(`${count} ${count === 1 ? 'lesson' : 'lessons'}`, `${count} ${count === 1 ? 'leçon' : 'leçons'}`, `${count} دروس`)
      : tr(`${count} ${count === 1 ? 'hymn' : 'hymns'}`, `${count} ${count === 1 ? 'hymne' : 'hymnes'}`, `${count} ألحان`);
  const repeatText = repeatMode === 'one'
    ? (tone === 'learning'
      ? tr('Repeating this lesson', 'Cette leçon en boucle', 'تكرار هذا الدرس')
      : tr('Repeating this hymn', 'Cet hymne en boucle', 'تكرار هذا اللحن'))
    : repeatMode === 'all'
      ? tr('Repeating the queue', 'La file en boucle', 'تكرار قائمة الانتظار')
      : tr('Repeat off', 'Sans répétition', 'التكرار متوقف');
  const summary = [noun, shuffleEnabled ? tr('Shuffled', 'Aléatoire', 'عشوائي') : null, repeatText].filter(Boolean).join(' · ');
  const repeatLabel = repeatMode === 'one'
    ? tr('Repeat one', 'Répéter un titre', 'تكرار واحد')
    : repeatMode === 'all' ? tr('Repeat all', 'Tout répéter', 'تكرار الكل') : tr('Repeat off', 'Sans répétition', 'التكرار متوقف');
  const canClear = count > 1;

  const rows = (
    <View style={[styles.list, { height: listHeight }, Platform.OS === 'web' && styles.noSelect]}>
      {played > 0 ? (
        <View style={styles.playedLabel}>
          <Text style={[styles.playedText, isArabic && styles.labelArabic]}>{tr('Played', 'Écoutés', 'تم تشغيله')}</Text>
          <Text style={styles.playedCount}>{played}</Text>
        </View>
      ) : null}
      {entries.map((entry, index) => (
        <QueueRow
          key={entry.key}
          index={index}
          top={topFor(index)}
          entry={entry}
          state={index === currentIndex ? 'current' : index < currentIndex ? 'played' : 'next'}
          playing={playing}
          offset={offsetFor(index)}
          lifted={drag?.from === index}
          dragging={drag != null}
          handlers={handlers}
          onSelect={onSelect}
          isArabic={isArabic}
          showKind={mixed}
        />
      ))}
    </View>
  );

  return (
    <View style={[styles.root, scrollable && styles.rootScrollable, style]}>
      <View style={styles.header}>
        <Text style={[styles.title, isArabic && styles.titleArabic]}>{tr('Queue', 'File d’attente', 'قائمة الانتظار')}</Text>
        <RoundIconButton
          icon="shuffle-outline"
          variant="filled"
          size={42}
          iconSize={20}
          iconColor="rgba(255, 255, 255, 0.85)"
          accessibilityLabel={shuffleEnabled ? tr('Shuffle on', 'Lecture aléatoire activée', 'التشغيل العشوائي مفعّل') : tr('Shuffle off', 'Lecture aléatoire désactivée', 'التشغيل العشوائي متوقف')}
          active={shuffleEnabled}
          onPress={onToggleShuffle}
        />
        <RoundIconButton
          icon="repeat-outline"
          variant="filled"
          size={42}
          iconSize={20}
          iconColor="rgba(255, 255, 255, 0.85)"
          accessibilityLabel={repeatLabel}
          active={repeatMode !== 'off'}
          badge={repeatMode === 'one' ? '1' : undefined}
          badgeRing={surface === 'sheet' ? PLAYER_SHEET : '#1A1A1A'}
          onPress={onCycleRepeat}
        />
      </View>
      <View style={styles.summaryRow}>
        <Text numberOfLines={1} style={[styles.summary, isArabic && styles.rtl]}>{summary}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr('Clear queue', 'Vider la file', 'مسح قائمة الانتظار')}
          disabled={!canClear}
          hitSlop={8}
          onPress={onClear}
          style={({ pressed }) => [styles.clear, !canClear && styles.clearDisabled, pressed && styles.pressed, Platform.OS === 'web' && canClear && styles.webCursor]}
        >
          <PlayerIcon name="close" size={15} color="rgba(255, 255, 255, 0.75)" />
          <Text style={[styles.clearText, isArabic && styles.rtl]}>{tr('Clear', 'Vider', 'مسح')}</Text>
        </Pressable>
      </View>

      {scrollable ? (
        <View style={[styles.scrollFrame, surface === 'panel' && styles.scrollFramePanel]}>
          <ScrollView
            ref={scrollRef}
            style={[styles.scroll, edgeFade(scrolled ? 16 : null, moreBelow ? 86 : null)]}
            contentContainerStyle={styles.scrollContent}
            scrollEnabled={drag == null}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
            scrollEventThrottle={32}
            onScroll={onScroll}
            onLayout={(event) => {
              viewport.current = event.nativeEvent.layout.height;
              setMoreBelow(listHeight + 18 > event.nativeEvent.layout.height);
              placeCurrent();
            }}
          >
            {rows}
          </ScrollView>
          {/* Off the web there are no masks; on the sheet's solid near-black a
              gradient of the same colour does the fading instead. */}
          {Platform.OS !== 'web' && surface === 'sheet' && scrolled ? (
            <LinearGradient pointerEvents="none" colors={[PLAYER_SHEET, 'rgba(20, 20, 20, 0)']} style={styles.nativeFade} />
          ) : null}
        </View>
      ) : rows}
    </View>
  );
}

interface QueueRowProps {
  index: number;
  top: number;
  entry: QueueEntryView;
  state: 'played' | 'current' | 'next';
  playing: boolean;
  offset: number;
  lifted: boolean;
  dragging: boolean;
  handlers: MutableRefObject<DragHandlers>;
  onSelect: (index: number) => void;
  isArabic: boolean;
  showKind: boolean;
}

/** What a row shows for its kind of entry: its colour, picture, words and actions. */
function describeRow(
  entry: QueueEntryView,
  isArabic: boolean,
): { tone: QueueTone; title: string; subtitle: string; artwork: ReactNode; actions: ReactNode } {
  switch (entry.kind) {
    case 'music': {
      const { item } = entry;
      return {
        tone: 'music',
        title: item.track.title,
        subtitle: shortPerformerLine(item.track, item.releaseTitle ?? ''),
        artwork: <MusicArtwork asset={item.coverAsset} size={46} radius={10} label={item.releaseTitle ?? item.track.title} />,
        actions: <MusicTrackActionsMenu item={item} isArabic={isArabic} size={34} />,
      };
    }
    case 'learning': {
      const { item } = entry;
      return {
        tone: 'learning',
        title: item.title,
        subtitle: `${item.cantorName} · ${item.containerTitle}`,
        artwork: <LearningArtwork asset={item.coverAsset} size={46} radius={10} label={item.containerTitle} />,
        actions: <LearningItemActionsMenu item={item} isArabic={isArabic} size={34} />,
      };
    }
    default:
      return {
        tone: 'music',
        title: entry.title,
        subtitle: entry.subtitle ?? '',
        artwork: <View style={styles.unknownArt} />,
        actions: null,
      };
  }
}

function QueueRow({ index, top, entry, state, playing, offset, lifted, dragging, handlers, onSelect, isArabic, showKind }: QueueRowProps) {
  const reduced = useReducedMotion();
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
    Animated.timing(translateY, { toValue: offset, duration: motionDuration(140, reduced), useNativeDriver: USE_NATIVE_DRIVER }).start();
  }, [dragging, lifted, offset, reduced, translateY]);

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

  const row = describeRow(entry, isArabic);
  const current = state === 'current';

  return (
    <Animated.View
      style={[
        styles.rowShell,
        { top, transform: [{ translateY }] },
        state === 'played' && !lifted && styles.rowPlayed,
        lifted && styles.rowLifted,
      ]}
    >
      {current ? null : (
        <View
          accessibilityRole="adjustable"
          accessibilityLabel={tr(`Reorder ${row.title}`, `Déplacer ${row.title}`, `إعادة ترتيب ${row.title}`)}
          style={[styles.handle, Platform.OS === 'web' && styles.handleWeb]}
          {...panResponder.panHandlers}
        >
          <PlayerIcon name="drag-dots" size={15} color={lifted ? COLORS.white : 'rgba(255, 255, 255, 0.45)'} />
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={current
          ? `${playing ? tr('Now playing', 'En lecture', 'قيد التشغيل') : tr('Paused', 'En pause', 'متوقف')}: ${row.title}`
          : tr(`Play ${row.title}`, `Lire ${row.title}`, `تشغيل ${row.title}`)}
        disabled={dragging}
        onPress={() => onSelect(index)}
        style={({ pressed }) => [styles.rowMain, current && styles.rowMainCurrent, pressed && styles.pressed, Platform.OS === 'web' && styles.webCursor]}
      >
        {row.artwork}
        <View style={styles.rowText}>
          <Text numberOfLines={1} style={[styles.rowTitle, current && styles.rowTitleCurrent]}>{row.title}</Text>
          <View style={styles.rowMeta}>
            {/* A queue of both kinds tells them apart at a glance. */}
            {showKind ? <PlayerIcon name={TONES[row.tone].icon} size={12} color={TONES[row.tone].accent} /> : null}
            <Text numberOfLines={1} style={styles.rowSubtitle}>{row.subtitle}</Text>
          </View>
        </View>
      </Pressable>
      {current ? <NowPlayingBars playing={playing} /> : !dragging ? row.actions : <View style={styles.actionsPlaceholder} />}
    </Animated.View>
  );
}

const BAR_HEIGHTS = [0.55, 1, 0.35, 0.75];

/** The four gold bars beside the row playing, rising and falling while it plays. */
function NowPlayingBars({ playing }: { playing: boolean }) {
  const reduced = useReducedMotion();
  const [levels] = useState(() => BAR_HEIGHTS.map((height) => new Animated.Value(height)));
  const moving = playing && !reduced;

  useEffect(() => {
    if (!moving) {
      levels.forEach((level, index) => level.setValue(BAR_HEIGHTS[index]));
      return;
    }
    const loops = levels.map((level, index) => Animated.loop(Animated.sequence([
      Animated.timing(level, { toValue: 0.25, duration: 300 + index * 70, easing: Easing.inOut(Easing.quad), useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(level, { toValue: 1, duration: 340 + index * 60, easing: Easing.inOut(Easing.quad), useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(level, { toValue: BAR_HEIGHTS[index], duration: 260 + index * 50, easing: Easing.inOut(Easing.quad), useNativeDriver: USE_NATIVE_DRIVER }),
    ])));
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [levels, moving]);

  return (
    <View accessible={false} style={styles.bars}>
      {levels.map((level, index) => (
        // Scaled from the foot, so each bar grows upwards.
        <Animated.View
          key={index}
          style={[styles.bar, { transform: [{ translateY: level.interpolate({ inputRange: [0, 1], outputRange: [9, 0] }) }, { scaleY: level }] }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {},
  rootScrollable: { flex: 1, minHeight: 0 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontSize: 24, fontWeight: '700' },
  titleArabic: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'left', writingDirection: 'rtl' },
  rtl: { writingDirection: 'rtl' },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 10 },
  summary: { flexShrink: 1, color: PLAYER_FAINT, fontFamily: TYPOGRAPHY.body, fontSize: 13, textAlign: 'left' },
  clear: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  clearDisabled: { opacity: 0.4 },
  clearText: { color: 'rgba(255, 255, 255, 0.75)', fontFamily: TYPOGRAPHY.body, fontSize: 13, fontWeight: '700' },
  scrollFrame: { flex: 1, minHeight: 0, marginTop: 6 },
  scrollFramePanel: { marginHorizontal: -4 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 18 },
  nativeFade: { position: 'absolute', top: 0, left: 0, right: 0, height: 56 },
  list: { position: 'relative' },
  noSelect: { userSelect: 'none' } as object,
  playedLabel: { position: 'absolute', top: 16, left: 4, right: 4, height: 13, flexDirection: 'row', alignItems: 'center', gap: 8 },
  playedText: { color: COLORS.gold, fontFamily: TYPOGRAPHY.body, fontSize: 11.5, fontWeight: '700', letterSpacing: 1.84, textTransform: 'uppercase' },
  labelArabic: { letterSpacing: 0, writingDirection: 'rtl' },
  playedCount: { color: 'rgba(255, 255, 255, 0.45)', fontFamily: TYPOGRAPHY.body, fontSize: 11.5, fontWeight: '700' },
  rowShell: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 2,
    borderRadius: 14,
  },
  rowPlayed: { opacity: 0.5 },
  rowLifted: {
    zIndex: 10,
    elevation: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    ...Platform.select({
      web: { boxShadow: '0 10px 28px rgba(0, 0, 0, 0.55)' } as object,
      default: { shadowColor: COLORS.shadow, shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
    }),
  },
  // The grip is drawn 14pt wide but takes a thumb's width of touch.
  handle: { width: 34, height: '100%', marginHorizontal: -10, alignItems: 'center', justifyContent: 'center' },
  handleWeb: { cursor: 'grab', touchAction: 'none' } as object,
  rowMain: { flex: 1, minWidth: 0, height: '100%', flexDirection: 'row', alignItems: 'center', gap: 12 },
  // Without a grip, the playing row's picture still lines up with the rest.
  rowMainCurrent: { marginLeft: 26 },
  rowText: { flex: 1, minWidth: 0 },
  // Left as in English whatever the title's language: the layout never mirrors.
  rowTitle: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 15, fontWeight: '600', textAlign: 'left' },
  rowTitleCurrent: { color: COLORS.goldBright, fontWeight: '700' },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  rowSubtitle: { flexShrink: 1, color: PLAYER_FAINT, fontFamily: TYPOGRAPHY.body, fontSize: 12.5, textAlign: 'left' },
  unknownArt: { width: 46, height: 46, borderRadius: 10, backgroundColor: COLORS.surfaceSoft },
  actionsPlaceholder: { width: 34, height: 34 },
  bars: { width: 18.5, height: 18, marginRight: 8, flexDirection: 'row', alignItems: 'flex-end', gap: 2.5 },
  bar: { width: 3, height: 18, borderRadius: 2, backgroundColor: COLORS.gold },
  pressed: { opacity: 0.7 },
  webCursor: { cursor: 'pointer' } as object,
});
