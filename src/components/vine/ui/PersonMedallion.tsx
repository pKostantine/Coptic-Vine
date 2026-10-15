import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS, TYPOGRAPHY } from '../../../constants/theme';

/** A medallion's name never grows past this multiple of its design size. */
const MAX_FONT_SCALE = 1.3;

interface PersonMedallionProps {
  name: string;
  /** The person's photo, or null for their initial on vine green. */
  imageUri: string | null;
  /** The circle's diameter; the row's item is a little wider than it. */
  size: number;
  arabic?: boolean;
  onPress: () => void;
}

/**
 * An artist or cantor in a row (Coptic Vine design, "Music" and "Learn"):
 * their photo in a circle, or their initial in gold on a vine-green disc, with
 * their name beneath.
 */
export default function PersonMedallion({ name, imageUri, size, arabic = false, onPress }: PersonMedallionProps) {
  const initial = name.trim().charAt(0).toUpperCase() || '♪';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={name}
      onPress={onPress}
      style={({ pressed }) => [styles.item, { width: size }, pressed && styles.pressed]}
    >
      <View style={[styles.disc, { borderRadius: size / 2, height: size, width: size }]}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} contentFit="cover" transition={160} style={StyleSheet.absoluteFill} />
        ) : (
          <>
            <LinearGradient colors={[COLORS.green, COLORS.greenDeep]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
            <Text style={[styles.initial, { fontSize: Math.round(size * 0.37) }]} maxFontSizeMultiplier={1}>{initial}</Text>
          </>
        )}
      </View>
      <Text style={[styles.name, arabic && styles.arabic]} numberOfLines={3} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: { alignItems: 'center' },
  pressed: { opacity: 0.75 },
  disc: {
    alignItems: 'center',
    backgroundColor: COLORS.greenDeep,
    boxShadow: '0px 8px 18px rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initial: { color: COLORS.gold, fontFamily: TYPOGRAPHY.title, fontWeight: '700' },
  name: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 14, fontWeight: '600', lineHeight: 18, marginTop: 10, textAlign: 'center' },
  arabic: { fontFamily: TYPOGRAPHY.arabic, writingDirection: 'rtl' },
});
