import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BuddedCross } from '@/components/vine/ui/Ornaments';
import { COLORS, TYPOGRAPHY } from '@/constants/theme';
import type { LearningSeasonLook } from '@/utils/learningSeasonLook';

const MAX_FONT_SCALE = 1.25;

interface LearningSeasonTileProps {
  title: string;
  look: LearningSeasonLook;
  /** The gold "Now" badge: the season the Church is in. */
  now?: boolean;
  nowLabel?: string;
  arabic?: boolean;
  onPress: () => void;
}

/**
 * A season to learn (Coptic Vine design, "Learn", By Season): a tile in the
 * season's colours, a faded budded cross on its corner, its name at the foot.
 */
export default function LearningSeasonTile({ title, look, now = false, nowLabel = 'Now', arabic = false, onPress }: LearningSeasonTileProps) {
  const textColor = look.light ? COLORS.greenDeep : COLORS.white;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={now ? `${title}, ${nowLabel}` : title}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, arabic && styles.tileArabic, pressed && styles.pressed]}
    >
      <LinearGradient colors={[look.from, look.to]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={[styles.cross, arabic ? styles.crossLeft : styles.crossRight, look.light && styles.crossLight]} pointerEvents="none">
        <BuddedCross size={68} />
      </View>
      {now ? (
        <View style={[styles.now, arabic ? styles.nowRight : styles.nowLeft]}>
          <Text style={[styles.nowText, arabic && styles.arabicBadge]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{arabic ? nowLabel : nowLabel.toUpperCase()}</Text>
        </View>
      ) : null}
      <Text style={[styles.title, { color: textColor }, arabic && styles.arabic]} numberOfLines={2} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: 18,
    boxShadow: '0px 10px 22px rgba(0, 0, 0, 0.3)',
    height: 100,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  tileArabic: { alignItems: 'flex-end' },
  pressed: { opacity: 0.85 },
  cross: { opacity: 0.22, position: 'absolute', top: -8 },
  crossRight: { right: -8 },
  crossLeft: { left: -8 },
  crossLight: { opacity: 0.45 },
  now: { alignItems: 'center', backgroundColor: COLORS.gold, borderRadius: 99, height: 22, justifyContent: 'center', paddingHorizontal: 9, position: 'absolute', top: 12 },
  nowLeft: { left: 12 },
  nowRight: { right: 12 },
  nowText: { color: COLORS.greenDeep, fontFamily: TYPOGRAPHY.body, fontSize: 11, fontWeight: '800', letterSpacing: 0.9 },
  arabicBadge: { fontFamily: TYPOGRAPHY.arabic, letterSpacing: 0 },
  title: { fontFamily: TYPOGRAPHY.title, fontSize: 17, fontWeight: '700', lineHeight: 20 },
  arabic: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'right', writingDirection: 'rtl' },
});
