'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { type ReactNode, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import { type EdgeInsets, useSafeAreaInsets } from 'react-native-safe-area-context';

import PlayerIcon, { type PlayerIconName } from '@/components/playback/PlayerIcon';
import RoundIconButton from '@/components/playback/RoundIconButton';
import { COLORS, TYPOGRAPHY } from '@/constants/theme';
import type { MusicConsumerTrack } from '@/types/musicConsumer';
import type { ArtworkPalette } from '@/utils/artworkPalette';
import { useArtworkPalette } from '@/utils/useArtworkPalette';
import { useLayoutMode } from '@/utils/useLayoutMode';

import { tr } from '../../utils/appText';

/**
 * The pieces both full-screen players are built from (Coptic Vine Player
 * design): the artwork-tinted backdrop, the "Playing from" bar, the title
 * block, the transport, the bar of round buttons beneath it and the panels
 * the lyrics and the queue sit in beside it. The Music and the Learn & Study
 * player are the same player in the design, so they share every measurement
 * here and differ only in what they show.
 */

/** The design's ink on gold: the deep green, not black. */
export const PLAYER_INK = COLORS.greenDeep;
/** The sheets' and panels' near-black. */
export const PLAYER_SHEET = '#141414';
export const PLAYER_DIM = 'rgba(255, 255, 255, 0.62)';
export const PLAYER_FAINT = 'rgba(255, 255, 255, 0.55)';

export type PlayerLayoutKind = 'phone' | 'phoneLandscape' | 'tabletPortrait' | 'split' | 'desktop';

export interface PlayerLayout {
  kind: PlayerLayoutKind;
  width: number;
  height: number;
  insets: EdgeInsets;
}

/**
 * Which of the design's compositions the window takes:
 * - `phone`: the stacked player, lyrics and queue rising over it.
 * - `phoneLandscape`: artwork left, everything else right.
 * - `tabletPortrait`: the phone's composition scaled up (an iPad upright).
 * - `split`: the player beside the queue (an iPad on its side, or a
 *   desktop window too narrow for three columns); lyrics open full screen.
 * - `desktop`: lyrics, player and queue side by side.
 */
export function usePlayerLayout(): PlayerLayout {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const mode = useLayoutMode();
  let kind: PlayerLayoutKind;
  // A phone in landscape needs a genuinely different composition. Treat the
  // short side as the limiting dimension instead of laying out the portrait
  // player vertically and letting its controls collide.
  if (width > height && height <= 600 && width < 1100) kind = 'phoneLandscape';
  else if (mode === 'desktop' && width >= 1200 && height >= 560) kind = 'desktop';
  else if (width > height && width >= 900 && height >= 480) kind = 'split';
  else if (width >= 640) kind = 'tabletPortrait';
  else kind = 'phone';
  return { kind, width, height, insets };
}

/**
 * The performer line as the design sets it: the first performer, then how
 * many more ("Cantor Ibrahim Ayad & 4 more") rather than a list that runs
 * off the edge.
 */
export function shortPerformerLine(track: Pick<MusicConsumerTrack, 'artists'>, fallback = ''): string {
  const seen = new Set<string>();
  const performers = [...track.artists]
    .filter((artist) => artist.role === 'primary' || artist.role === 'featured')
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((artist) => artist.displayName.trim())
    .filter((name) => {
      const key = name.toLocaleLowerCase();
      if (!name || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  if (!performers.length) {
    return [...track.artists].sort((left, right) => left.sortOrder - right.sortOrder)
      .map((artist) => artist.displayName.trim()).find(Boolean) ?? fallback;
  }
  if (performers.length === 1) return performers[0];
  if (performers.length === 2) return `${performers[0]} & ${performers[1]}`;
  const more = performers.length - 1;
  return tr(`${performers[0]} & ${more} more`, `${performers[0]} et ${more} autres`, `${performers[0]} و${more} آخرون`);
}

/**
 * Fades a scrolling list into its surface where it runs on: the design's
 * CSS masks. Masks are a web feature; elsewhere the list simply clips.
 */
export function edgeFade(top: number | null, bottom: number | null): StyleProp<ViewStyle> {
  if (Platform.OS !== 'web' || (top == null && bottom == null)) return null;
  const stops = [
    top != null ? `transparent 0%, #000 ${top}%` : '#000 0%',
    bottom != null ? `#000 ${bottom}%, transparent 100%` : '#000 100%',
  ].join(', ');
  const mask = `linear-gradient(180deg, ${stops})`;
  return { maskImage: mask, WebkitMaskImage: mask } as object as ViewStyle;
}

/**
 * The cover's colours as a deep gradient (utils/artworkPalette), fading in
 * as each cover's are read. Remounted per palette, so each fades in anew.
 */
function PaletteWash({ palette }: { palette: ArtworkPalette }) {
  const [opacity] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [opacity]);
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity }]}>
      <LinearGradient
        colors={[palette.primary, palette.secondary, palette.deep]}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* The second colour rises from the far corner, as a glow. */}
      <LinearGradient
        colors={['rgba(0, 0, 0, 0)', palette.secondary]}
        start={{ x: 0.3, y: 0.2 }}
        end={{ x: 1, y: 0.9 }}
        style={[StyleSheet.absoluteFill, styles.paletteGlow]}
      />
    </Animated.View>
  );
}

/**
 * The artwork, blurred and saturated behind the whole player, under a shade
 * that deepens to black where the controls sit — or, behind full-screen
 * lyrics, an even dim so every line reads alike. On the web the cover's own
 * colours run underneath it as a gradient, so a pale cover (paper and ink)
 * still colours the player instead of greying it.
 */
export function PlayerBackdrop({ uri, flat = false }: { uri: string | null; flat?: boolean }) {
  const palette = useArtworkPalette(uri);
  return (
    <View pointerEvents="none" style={styles.backdrop}>
      {palette ? <PaletteWash key={palette.key} palette={palette} /> : null}
      {uri ? (
        Platform.OS === 'web' ? (
          // The browser blurs and saturates in one CSS filter, as drawn.
          <View style={[styles.backdropArt, styles.backdropWebFilter, palette && styles.backdropArtOverPalette]}>
            <Image source={{ uri }} contentFit="cover" style={StyleSheet.absoluteFill} />
          </View>
        ) : (
          <Image source={{ uri }} blurRadius={64} contentFit="cover" style={styles.backdropArt} />
        )
      ) : null}
      {uri && Platform.OS !== 'web' ? <View style={styles.backdropNativeDim} /> : null}
      {flat ? (
        <View style={[styles.backdropFlat, palette && styles.backdropFlatOverPalette]} />
      ) : (
        <LinearGradient
          colors={palette
            ? ['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0.16)', 'rgba(0, 0, 0, 0.55)', 'rgba(0, 0, 0, 0.82)']
            : ['rgba(0, 0, 0, 0.1)', 'rgba(0, 0, 0, 0.42)', 'rgba(0, 0, 0, 0.86)', '#000000']}
          locations={[0, 0.36, 0.7, 1]}
          style={StyleSheet.absoluteFill}
        />
      )}
    </View>
  );
}

interface PlayerTopBarProps {
  onClose: () => void;
  /** What is playing from — the release, the lesson set. */
  source: string | null;
  /** The gold "Lesson" pill beside "Playing from". */
  lesson?: boolean;
  isArabic: boolean;
  compact?: boolean;
}

/** The close chevron and, centred, where the queue is playing from. */
export function PlayerTopBar({ onClose, source, lesson = false, isArabic, compact = false }: PlayerTopBarProps) {
  return (
    <View style={[styles.topBar, compact && styles.topBarCompact]}>
      <RoundIconButton
        icon="chevron-down"
        accessibilityLabel={tr('Close now playing', 'Fermer la lecture en cours', 'إغلاق المشغّل')}
        onPress={onClose}
        size={40}
        variant="filled"
        fill="rgba(255, 255, 255, 0.12)"
        iconSize={20}
      />
      <View style={styles.topBarCenter}>
        <View style={styles.kickerRow}>
          <Text style={[styles.kicker, isArabic && styles.kickerArabic]}>
            {source ? tr('Playing from', 'Lecture depuis', 'التشغيل من') : tr('Now playing', 'En cours de lecture', 'قيد التشغيل')}
          </Text>
          {lesson ? (
            <View style={styles.lessonPill}>
              <PlayerIcon name="school" size={11} color={PLAYER_INK} />
              <Text style={[styles.lessonPillText, isArabic && styles.kickerArabic]}>{tr('Lesson', 'Leçon', 'درس')}</Text>
            </View>
          ) : null}
        </View>
        {source ? <Text numberOfLines={1} style={styles.source}>{source}</Text> : null}
      </View>
      {/* Balances the close button so the source sits in the true centre. */}
      <View style={styles.topBarSpacer} />
    </View>
  );
}

interface PlayerTitleBlockProps {
  title: string;
  subtitle: string;
  meta?: string | null;
  align?: 'center' | 'left';
  /** The title's size: 26 on a phone, 32 on an upright iPad, 25 beside panels, 21 on its side. */
  titleSize?: number;
  lines?: number;
  style?: StyleProp<ViewStyle>;
}

export function PlayerTitleBlock({ title, subtitle, meta, align = 'center', titleSize = 26, lines = 2, style }: PlayerTitleBlockProps) {
  const left = align === 'left';
  const small = titleSize <= 21;
  return (
    <View style={[styles.titleBlock, left && styles.titleBlockLeft, style]}>
      <Text
        numberOfLines={lines}
        style={[styles.title, { fontSize: titleSize, lineHeight: titleSize * 1.18 }, left && styles.textLeft]}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text numberOfLines={1} style={[styles.subtitle, small && styles.subtitleSmall, left && styles.textLeft]}>{subtitle}</Text>
      ) : null}
      {meta ? <Text numberOfLines={1} style={[styles.meta, left && styles.textLeft]}>{meta}</Text> : null}
    </View>
  );
}

interface PlayerTransportProps {
  playing: boolean;
  buffering: boolean;
  onPrevious: () => void;
  onTogglePlayback: () => void;
  onNext: () => void;
  /** Lessons step ten seconds either side of the skips. */
  onBack10?: () => void;
  onForward10?: () => void;
  /** `small`: the 54pt play button of the landscape and full-screen rows. */
  size?: 'regular' | 'small';
  /** The row's width, so the lesson's five controls close up to fit. */
  maxWidth?: number;
  align?: 'center' | 'left';
}

export function PlayerTransport({
  playing,
  buffering,
  onPrevious,
  onTogglePlayback,
  onNext,
  onBack10,
  onForward10,
  size = 'regular',
  maxWidth,
  align = 'center',
}: PlayerTransportProps) {
  const small = size === 'small';
  const playSize = small ? 54 : 74;
  const skipSize = small ? 26 : 34;
  const replaySize = small ? 26 : 32;
  const steps = Boolean(onBack10 && onForward10);
  const designGap = small ? 22 : 34;
  const content = playSize + skipSize * 2 + (steps ? replaySize * 2 : 0);
  const slots = steps ? 4 : 2;
  const gap = maxWidth ? Math.max(10, Math.min(designGap, (maxWidth - content) / slots)) : designGap;

  return (
    <View style={[styles.transport, { gap }, align === 'left' && styles.transportLeft]}>
      {steps ? (
        <ReplayButton seconds={10} back size={replaySize} onPress={onBack10!} />
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tr('Previous', 'Précédent', 'السابق')}
        hitSlop={10}
        onPress={onPrevious}
        style={({ pressed }) => [styles.skip, pressed && styles.pressed, Platform.OS === 'web' && styles.webCursor]}
      >
        <PlayerIcon name="play-skip-back" size={skipSize} color={COLORS.white} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={playing ? tr('Pause', 'Pause', 'إيقاف مؤقت') : tr('Play', 'Lecture', 'تشغيل')}
        onPress={onTogglePlayback}
        style={({ pressed }) => [
          styles.play,
          { width: playSize, height: playSize, borderRadius: playSize / 2 },
          pressed && styles.pressed,
          Platform.OS === 'web' && styles.webCursor,
        ]}
      >
        {buffering ? (
          <ActivityIndicator color={PLAYER_INK} />
        ) : (
          <PlayerIcon
            name={playing ? 'pause' : 'play'}
            size={small ? 23 : 32}
            color={PLAYER_INK}
            // The play triangle's visual centre sits left of its box.
            style={playing ? undefined : { marginLeft: small ? 3 : 4 }}
          />
        )}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tr('Next', 'Suivant', 'التالي')}
        hitSlop={10}
        onPress={onNext}
        style={({ pressed }) => [styles.skip, pressed && styles.pressed, Platform.OS === 'web' && styles.webCursor]}
      >
        <PlayerIcon name="play-skip-forward" size={skipSize} color={COLORS.white} />
      </Pressable>
      {steps ? (
        <ReplayButton seconds={10} size={replaySize} onPress={onForward10!} />
      ) : null}
    </View>
  );
}

function ReplayButton({ seconds, back = false, size, onPress }: { seconds: number; back?: boolean; size: number; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={back
        ? tr(`Back ${seconds} seconds`, `Reculer de ${seconds} secondes`, `رجوع ${seconds} ثوانٍ`)
        : tr(`Forward ${seconds} seconds`, `Avancer de ${seconds} secondes`, `تقديم ${seconds} ثوانٍ`)}
      hitSlop={10}
      onPress={onPress}
      style={({ pressed }) => [styles.replay, { width: size, height: size }, pressed && styles.pressed, Platform.OS === 'web' && styles.webCursor]}
    >
      <PlayerIcon
        name="replay-arrow"
        size={size}
        color="rgba(255, 255, 255, 0.85)"
        style={back ? styles.mirrored : undefined}
      />
      <Text style={[styles.replayText, { fontSize: size >= 30 ? 9.5 : 8 }]}>{seconds}</Text>
    </Pressable>
  );
}

/** The lesson player's speed, in gold once it is anything but as recorded. */
export function SpeedChip({ rate, onPress }: { rate: number; onPress: () => void }) {
  const label = `${rate}×`;
  const changed = rate !== 1;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tr(`Playback speed ${label}`, `Vitesse de lecture ${label}`, `سرعة التشغيل ${label}`)}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.speed, !changed && styles.speedPlain, pressed && styles.pressed, Platform.OS === 'web' && styles.webCursor]}
    >
      <PlayerIcon name="speedometer-outline" size={13} color={changed ? PLAYER_INK : 'rgba(255, 255, 255, 0.85)'} />
      <Text style={[styles.speedText, !changed && styles.speedTextPlain]}>{label}</Text>
    </Pressable>
  );
}

/** The speeds the chip steps through, slowest first; past the fastest it starts over. */
export const LEARNING_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5];

export function nextLearningSpeed(rate: number): number {
  const index = LEARNING_SPEEDS.indexOf(rate);
  return LEARNING_SPEEDS[(index + 1) % LEARNING_SPEEDS.length] ?? 1;
}

interface PlayerBarButtonProps {
  icon: PlayerIconName;
  accessibilityLabel: string;
  onPress: () => void;
  /** Lit: the panel it opens is showing. */
  on?: boolean;
  /** Gold glyph without the wash: a liked heart. */
  gold?: boolean;
  disabled?: boolean;
  size?: number;
}

/** One of the round buttons along the foot of the player: lyrics, like, queue. */
export function PlayerBarButton({ icon, accessibilityLabel, onPress, on = false, gold = false, disabled = false, size = 44 }: PlayerBarButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: on, disabled }}
      disabled={disabled}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.barButton,
        { width: size, height: size, borderRadius: size / 2 },
        on && styles.barButtonOn,
        hovered && !on && !disabled && styles.barButtonHovered,
        pressed && styles.pressed,
        disabled && styles.barButtonDisabled,
        Platform.OS === 'web' && !disabled && styles.webCursor,
      ]}
    >
      <PlayerIcon
        name={icon}
        size={size >= 44 ? 22 : 20}
        color={on || gold ? COLORS.gold : 'rgba(255, 255, 255, 0.75)'}
      />
    </Pressable>
  );
}

/**
 * The panel the lyrics and the queue sit in beside the desktop player: with
 * the cover's colours (the web), frosted glass washed with them.
 */
export function PlayerPanel({ children, style, palette }: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  palette?: ArtworkPalette | null;
}) {
  return (
    <View style={[styles.panel, palette && [styles.panelTinted, { backgroundColor: palette.panel }], style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, overflow: 'hidden', backgroundColor: COLORS.black },
  // Drawn past every edge so the blur never thins out at the sides.
  backdropArt: { position: 'absolute', top: -110, right: -110, bottom: -110, left: -110, opacity: 0.9 },
  backdropWebFilter: { filter: 'blur(64px) saturate(1.6) brightness(0.85)' } as object,
  backdropNativeDim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0, 0, 0, 0.15)' },
  backdropFlat: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0, 0, 0, 0.58)' },
  // Over the cover's colours the blurred cover is texture, not the colour.
  backdropArtOverPalette: { opacity: 0.22 },
  backdropFlatOverPalette: { backgroundColor: 'rgba(0, 0, 0, 0.42)' },
  paletteGlow: { opacity: 0.55 },

  topBar: { height: 52, flexDirection: 'row', alignItems: 'center', gap: 12 },
  topBarCompact: { height: 42 },
  topBarCenter: { flex: 1, minWidth: 0, alignItems: 'center' },
  topBarSpacer: { width: 40 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  kicker: {
    color: PLAYER_DIM,
    fontFamily: TYPOGRAPHY.body,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1.68,
    textTransform: 'uppercase',
  },
  // Spacing pulls Arabic letters apart, and Arabic has no capitals.
  kickerArabic: { letterSpacing: 0, writingDirection: 'rtl' },
  lessonPill: {
    height: 19,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    borderRadius: 99,
    backgroundColor: COLORS.gold,
  },
  lessonPillText: { color: PLAYER_INK, fontFamily: TYPOGRAPHY.body, fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  source: { maxWidth: '100%', color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 14, fontWeight: '700', marginTop: 3 },

  titleBlock: { width: '100%', alignItems: 'center' },
  titleBlockLeft: { alignItems: 'flex-start' },
  title: { width: '100%', color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontWeight: '700', textAlign: 'center' },
  subtitle: { width: '100%', color: COLORS.goldBright, fontFamily: TYPOGRAPHY.body, fontSize: 15.5, fontWeight: '600', marginTop: 6, textAlign: 'center' },
  subtitleSmall: { fontSize: 14, marginTop: 3 },
  meta: { width: '100%', color: PLAYER_FAINT, fontFamily: TYPOGRAPHY.body, fontSize: 12.5, marginTop: 3, textAlign: 'center' },
  textLeft: { textAlign: 'left' },

  transport: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  transportLeft: { justifyContent: 'flex-start' },
  skip: { alignItems: 'center', justifyContent: 'center' },
  play: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.gold,
    ...Platform.select({
      web: { boxShadow: '0 12px 30px rgba(227, 181, 59, 0.28)' } as object,
      default: { shadowColor: COLORS.gold, shadowOpacity: 0.28, shadowRadius: 15, shadowOffset: { width: 0, height: 12 }, elevation: 8 },
    }),
  },
  replay: { alignItems: 'center', justifyContent: 'center' },
  mirrored: { transform: [{ scaleX: -1 }] },
  replayText: {
    position: 'absolute',
    color: 'rgba(255, 255, 255, 0.85)',
    fontFamily: TYPOGRAPHY.body,
    fontWeight: '800',
    // Sits in the arrow's bowl, a little below its middle.
    marginTop: 2,
  },
  pressed: { opacity: 0.7, transform: [{ scale: 0.94 }] },
  webCursor: { cursor: 'pointer' } as object,

  speed: {
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    borderRadius: 99,
    backgroundColor: COLORS.gold,
  },
  speedPlain: { backgroundColor: 'rgba(255, 255, 255, 0.1)' },
  speedText: { color: PLAYER_INK, fontFamily: TYPOGRAPHY.body, fontSize: 12, fontWeight: '800', fontVariant: ['tabular-nums'] },
  speedTextPlain: { color: 'rgba(255, 255, 255, 0.85)' },

  barButton: { alignItems: 'center', justifyContent: 'center' },
  barButtonOn: { backgroundColor: 'rgba(255, 255, 255, 0.14)' },
  barButtonHovered: { backgroundColor: 'rgba(255, 255, 255, 0.08)' },
  barButtonDisabled: { opacity: 0.32 },

  panel: {
    minHeight: 0,
    paddingTop: 22,
    paddingHorizontal: 22,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
  },
  panelTinted: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(28px) saturate(1.5)', WebkitBackdropFilter: 'blur(28px) saturate(1.5)' } as object) : null),
  },
});
