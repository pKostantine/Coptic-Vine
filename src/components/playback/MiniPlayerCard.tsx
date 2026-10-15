import { ReactNode, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, PanResponder, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import Icon from '@/components/vine/ui/Icon';
import { COLORS, TYPOGRAPHY } from '@/constants/theme';
import { motionDuration, useReducedMotion } from '@/utils/useReducedMotion';

/** How far the card must be swiped to skip. */
const SKIP_DISTANCE = 60;

interface MiniPlayerCardProps {
  artwork: ReactNode;
  title: string;
  titleSuffix?: string | null;
  subtitle: string;
  liked?: boolean;
  likeBusy?: boolean;
  onToggleLike?: () => void;
  playing: boolean;
  buffering: boolean;
  /** 0–1 */
  progress: number;
  accentColor: string;
  onOpen: () => void;
  onTogglePlayback: () => void;
  onNext: () => void;
  /** Swiped to the right: the track before. */
  onPrevious?: () => void;
  onHide?: () => void;
  nextLabel: string;
}

/**
 * The floating "now playing" card that sits just above the tab bar. Shared by
 * Music and Learn & Study so both products get the same shape; only the
 * accent colour and the content differ.
 */
export default function MiniPlayerCard({
  artwork,
  title,
  titleSuffix,
  subtitle,
  liked = false,
  likeBusy = false,
  onToggleLike,
  playing,
  buffering,
  progress,
  accentColor,
  onOpen,
  onTogglePlayback,
  onNext,
  onPrevious,
  onHide,
  nextLabel,
}: MiniPlayerCardProps) {
  const clamped = Math.max(0, Math.min(1, progress));
  const reduced = useReducedMotion();

  // Swiped sideways the card follows the finger: to the left it skips to the
  // next track, to the right back to the one before, as a music app's bar
  // does. A tap still opens the player, and a vertical drag is left alone.
  const skip = useRef({ next: onNext, previous: onPrevious, reduced });
  useEffect(() => {
    skip.current = { next: onNext, previous: onPrevious, reduced };
  });
  const [offset] = useState(() => new Animated.Value(0));
  // A browser still clicks what the finger lifts off after a swipe; a tap
  // that ends a swipe is not a tap.
  const swipedAt = useRef(0);
  const unlessSwiped = (action?: () => void) => () => {
    if (Date.now() - swipedAt.current < 500) return;
    action?.();
  };
  // eslint-disable-next-line react-hooks/refs -- refs are read in gesture callbacks, not during render
  const [swipe] = useState(() => {
    const settle = () => Animated.spring(offset, { toValue: 0, useNativeDriver: Platform.OS !== 'web', bounciness: 6 }).start();
    return PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, gesture) => Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => { swipedAt.current = Date.now(); },
      onPanResponderMove: (_, gesture) => offset.setValue(gesture.dx),
      onPanResponderRelease: (_, gesture) => {
        swipedAt.current = Date.now();
        const { next, previous, reduced: still } = skip.current;
        const forward = gesture.dx < -SKIP_DISTANCE || gesture.vx < -0.6;
        const back = (gesture.dx > SKIP_DISTANCE || gesture.vx > 0.6) && Boolean(previous);
        if (!forward && !back) { settle(); return; }
        // Off the way it was swiped, the track changes, and the card comes
        // back in from the other side.
        const direction = forward ? -1 : 1;
        Animated.timing(offset, { toValue: direction * 120, duration: motionDuration(120, still), useNativeDriver: Platform.OS !== 'web' }).start(() => {
          if (forward) next();
          else previous?.();
          offset.setValue(-direction * 60);
          settle();
        });
      },
      onPanResponderTerminate: settle,
    });
  });
  const swipeStyle = {
    opacity: offset.interpolate({ inputRange: [-160, 0, 160], outputRange: [0.35, 1, 0.35], extrapolate: 'clamp' as const }),
    transform: [{ translateX: offset }],
  };

  return (
    <View style={styles.outer}>
      <Animated.View style={[styles.card, swipeStyle]} {...swipe.panHandlers}>
        <View style={styles.row}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open now playing: ${title}`}
            style={({ pressed }) => [styles.info, pressed && styles.pressed]}
            onPress={unlessSwiped(onOpen)}
          >
            {artwork}
            <View style={styles.textWrap}>
              <Text numberOfLines={1} style={styles.title}>
                {title}
                {titleSuffix ? <Text style={styles.titleSuffix}> — {titleSuffix}</Text> : null}
              </Text>
              {subtitle ? <Text numberOfLines={1} style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
          </Pressable>

          {onToggleLike ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={liked ? 'Unlike track' : 'Like track'}
              disabled={likeBusy}
              hitSlop={6}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressedButton, likeBusy && styles.disabledButton]}
              onPress={unlessSwiped(onToggleLike)}
            >
              <Icon name={liked ? 'heart' : 'heart-outline'} size={19} color={liked ? accentColor : COLORS.white} />
            </Pressable>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={playing ? 'Pause' : 'Play'}
            hitSlop={6}
            style={({ pressed }) => [styles.playButton, { backgroundColor: accentColor }, pressed && styles.pressedButton]}
            onPress={unlessSwiped(onTogglePlayback)}
          >
            {buffering ? (
              <ActivityIndicator size="small" color={COLORS.black} />
            ) : (
              <Icon
                name={playing ? 'pause' : 'play'}
                size={16}
                color={COLORS.black}
                // The play triangle's visual centre sits left of its box.
                style={playing ? undefined : styles.playNudge}
              />
            )}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={nextLabel}
            hitSlop={6}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressedButton]}
            onPress={unlessSwiped(onNext)}
          >
            <Icon name="play-skip-forward" size={18} color={COLORS.white} />
          </Pressable>

          {onHide ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Hide now playing"
              hitSlop={6}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressedButton]}
              onPress={unlessSwiped(onHide)}
            >
              <Icon name="chevron-down" size={18} color={COLORS.white} />
            </Pressable>
          ) : null}
        </View>

        <View pointerEvents="none" style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${clamped * 100}%`, backgroundColor: accentColor }]} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // The card floats on its own; GlobalNowPlayingOverlay owns the spacing so the
  // gap above the tab bar or page edge is exactly the same everywhere.
  outer: {
    backgroundColor: 'transparent',
  },
  card: {
    width: '100%',
    maxWidth: 1100,
    alignSelf: 'center',
    borderRadius: 14,
    overflow: 'hidden',
    // Same chrome as the tab bar it floats above: deep green under a gold
   // hairline (Coptic Vine, "TabBar").
    backgroundColor: COLORS.greenDeep,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.goldLine,
    ...Platform.select({
      web: { boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)' } as object,
      default: {
        shadowColor: COLORS.shadow,
        shadowOpacity: 0.45,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
        elevation: 8,
      },
    }),
  },
  row: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 10,
    gap: 10,
  },
  info: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 8 },
  pressed: { opacity: 0.75 },
  textWrap: { flex: 1, minWidth: 0 },
  title: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 14, fontWeight: '700' },
  titleSuffix: { color: COLORS.muted, fontWeight: '500' },
  subtitle: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 12, marginTop: 2 },
  playButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  playNudge: { marginLeft: 2 },
  iconButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  pressedButton: { opacity: 0.7, transform: [{ scale: 0.94 }] },
  disabledButton: { opacity: 0.45 },
  progressTrack: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 0,
    height: 2,
    borderRadius: 1,
    backgroundColor: COLORS.goldSoft,
    overflow: 'hidden',
  },
  progressFill: { height: 2, borderRadius: 1 },
});
