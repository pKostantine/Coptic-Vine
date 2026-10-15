import { Platform, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import PlayerIcon, { type PlayerIconName } from '@/components/playback/PlayerIcon';
import { COLORS, TYPOGRAPHY } from '@/constants/theme';

interface RoundIconButtonProps {
  icon: PlayerIconName;
  accessibilityLabel: string;
  onPress: () => void;
  size?: number;
  /**
   * `outline` is the hairline-ringed circle the track page uses. `filled` is
   * the player's (Coptic Vine Player design): no ring, a soft white wash,
   * and the accent fill with the deep green glyph when it is on.
   */
  variant?: 'outline' | 'filled';
  /** The filled variant's wash, when the design gives a stronger or fainter one. */
  fill?: string;
  iconSize?: number;
  iconColor?: string;
  /** Filled with the accent colour, for toggles such as shuffle and repeat. */
  active?: boolean;
  accentColor?: string;
  /** Small corner badge, e.g. "1" for repeat-one. */
  badge?: string;
  /** What the badge's ring is cut out of: the surface the button sits on. */
  badgeRing?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** The circular icon button used across the player: close, fullscreen, shuffle, repeat. */
export default function RoundIconButton({
  icon,
  accessibilityLabel,
  onPress,
  size = 44,
  variant = 'outline',
  fill,
  iconSize,
  iconColor,
  active = false,
  accentColor = COLORS.gold,
  badge,
  badgeRing,
  disabled = false,
  style,
}: RoundIconButtonProps) {
  const filled = variant === 'filled';
  const glyphColor = active
    ? (filled ? COLORS.greenDeep : COLORS.black)
    : iconColor ?? COLORS.white;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        filled ? styles.filled : styles.button,
        filled && fill ? { backgroundColor: fill } : null,
        { width: size, height: size, borderRadius: size / 2 },
        active ? { backgroundColor: accentColor, borderColor: accentColor } : hovered && (filled ? styles.filledHovered : styles.hovered),
        pressed && styles.pressed,
        disabled && styles.disabled,
        Platform.OS === 'web' && styles.webCursor,
        style,
      ]}
    >
      <PlayerIcon name={icon} size={iconSize ?? Math.round(size * 0.44)} color={glyphColor} />
      {badge ? (
        filled ? (
          <View style={[styles.filledBadge, { borderColor: badgeRing ?? '#141414' }]}>
            <Text style={styles.filledBadgeText}>{badge}</Text>
          </View>
        ) : (
          <View style={[styles.badge, { borderColor: active ? accentColor : COLORS.surface }]}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        )
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  filled: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  hovered: { backgroundColor: 'rgba(255, 255, 255, 0.14)' },
  filledHovered: { backgroundColor: 'rgba(255, 255, 255, 0.18)' },
  pressed: { opacity: 0.75, transform: [{ scale: 0.94 }] },
  disabled: { opacity: 0.4 },
  webCursor: { cursor: 'pointer' } as object,
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 3,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  badgeText: { color: COLORS.black, fontFamily: TYPOGRAPHY.body, fontSize: 9, fontWeight: '900', lineHeight: 11 },
  // The design's 18pt white pip, ringed in the surface it sits on.
  filledBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  filledBadgeText: { color: COLORS.greenDeep, fontFamily: TYPOGRAPHY.body, fontSize: 10.5, fontWeight: '800', lineHeight: 13 },
});
