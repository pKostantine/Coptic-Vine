import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS, TYPOGRAPHY } from '@/constants/theme';
import type { LearningSeasonLook } from '@/utils/learningSeasonLook';

import SeasonIcon from './SeasonIcon';

const MAX_FONT_SCALE = 1.25;

interface LearningSeasonTileProps {
  title: string;
  /** The season's slug, for its icon. */
  slug: string;
  look: LearningSeasonLook;
  /** Now's tiles are the smaller, three across a phone; Coming up's carry the day count and the Coptic start. */
  kind: 'now' | 'upcoming';
  /** On the pill at the top: "In 56 days". */
  countdown?: string;
  /** Under the name: the Coptic start, "Hathor 16". */
  detail?: string;
  arabic?: boolean;
  /** The iPad and desktop, the five in one row: taller, with a larger name. */
  large?: boolean;
  onPress: () => void;
}

/**
 * A season on Discover (Coptic Vine design, "Learn", Seasons): a tile in the
 * season's colours, its icon faded on the corner, its name at the foot.
 */
export default function LearningSeasonTile({ title, slug, look, kind, countdown, detail, arabic = false, large = false, onPress }: LearningSeasonTileProps) {
  const upcoming = kind === 'upcoming';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[title, countdown, detail].filter(Boolean).join(', ')}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, upcoming && styles.tileUpcoming, large && styles.tileLarge, pressed && styles.pressed]}
    >
      <LinearGradient colors={[look.from, look.to]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={styles.icon} pointerEvents="none">
        <SeasonIcon slug={slug} size={upcoming ? 68 : 56} color={look.light ? COLORS.greenDeep : COLORS.white} />
      </View>
      {countdown ? (
        <View style={[styles.pill, look.light && styles.pillLight]}>
          <Text style={[styles.pillText, look.light && styles.darkText, arabic && styles.arabicTight]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{countdown}</Text>
        </View>
      ) : null}
      {/* The name sits at the foot; a long one grows the tile rather than running into the pill. */}
      <View style={styles.spacer} />
      <Text
        style={[styles.title, upcoming && styles.titleUpcoming, large && styles.titleLarge, look.light && styles.darkText, arabic && styles.arabic]}
        numberOfLines={3}
        maxFontSizeMultiplier={MAX_FONT_SCALE}
      >
        {title}
      </Text>
      {detail ? (
        <Text style={[styles.detail, large && styles.detailLarge, look.light && styles.detailLight, arabic && styles.arabic]} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {detail}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: 18,
    boxShadow: '0px 10px 22px rgba(0, 0, 0, 0.3)',
    flexGrow: 1,
    minHeight: 104,
    overflow: 'hidden',
    padding: 12,
  },
  tileUpcoming: { minHeight: 136, paddingHorizontal: 14 },
  tileLarge: { minHeight: 140, paddingHorizontal: 18, paddingVertical: 16 },
  spacer: { flexGrow: 1, minHeight: 8 },
  pressed: { opacity: 0.85 },
  icon: { opacity: 0.22, position: 'absolute', right: -8, top: -8 },
  pill: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: 'rgba(255, 255, 255, 0.16)', borderRadius: 99, height: 22, justifyContent: 'center', paddingHorizontal: 9 },
  pillLight: { backgroundColor: 'rgba(20, 48, 27, 0.12)' },
  pillText: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 11.5, fontWeight: '700' },
  title: { color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontSize: 15.5, fontWeight: '700', lineHeight: 17.8 },
  titleUpcoming: { fontSize: 17, lineHeight: 19.5 },
  titleLarge: { fontSize: 20, lineHeight: 23 },
  // The Holy Fifty Days' pale tile.
  darkText: { color: COLORS.greenDeep },
  detail: { color: 'rgba(255, 255, 255, 0.78)', fontFamily: TYPOGRAPHY.body, fontSize: 12.5, marginTop: 4 },
  detailLarge: { fontSize: 13.5 },
  detailLight: { color: 'rgba(20, 48, 27, 0.72)' },
  arabic: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'left', writingDirection: 'rtl' },
  arabicTight: { fontFamily: TYPOGRAPHY.arabic },
});
