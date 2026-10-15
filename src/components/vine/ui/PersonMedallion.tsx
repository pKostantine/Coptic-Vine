import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, Pressable, StyleSheet, Text, View, type TextStyle } from 'react-native';

import { COLORS, TYPOGRAPHY } from '../../../constants/theme';

/** A medallion's name never grows past this multiple of its design size. */
const MAX_FONT_SCALE = 1.3;

/** The titles a name may open with, passed over for its initial. */
const TITLES = new Set([
  'cantor', 'chantre', 'mouallem', 'moallem', 'mo3allem', 'muallem', 'deacon', 'diacre', 'fr', 'fr.', 'father', 'abouna', 'abuna',
  'المعلم', 'المعلّم', 'معلم', 'معلّم', 'الشماس', 'أبونا', 'ابونا', 'القس', 'القمص',
]);

/**
 * The letter on a person's disc when they have no photo: their name's, past
 * any title it opens with (Coptic Vine design, "Music": "Cantor Ibrahim Ayad"
 * is "I", not "C").
 */
export function personInitial(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const word = words.find((entry, index) => index === words.length - 1 || !TITLES.has(entry.toLowerCase())) ?? '';
  return word.charAt(0).toUpperCase() || '♪';
}

/**
 * The name's lines kept even, as the design sets them ("Cantor" over "Ibrahim
 * Ayad", not "Cantor Ibrahim" over "Ayad"). Real CSS that react-native-web
 * passes through; Android balances through the Text's textBreakStrategy, and
 * iOS has no equivalent.
 */
const BALANCED_WRAP: TextStyle | null = Platform.OS === 'web' ? ({ textWrap: 'balance' } as unknown as TextStyle) : null;

interface PersonMedallionProps {
  name: string;
  /** The person's photo, or null for their initial on vine green. */
  imageUri: string | null;
  /** The circle's diameter, and the item's width: 92 on a phone's rail, 140 in the iPad's and desktop's row. */
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
  // The larger medallions of the iPad and desktop set their names a size up, and their initial a little smaller for the disc.
  const large = size >= 120;
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
            <Text style={[styles.initial, { fontSize: Math.round(size * (large ? 0.33 : 0.37)) }]} maxFontSizeMultiplier={1}>{personInitial(name)}</Text>
          </>
        )}
      </View>
      <Text
        style={[styles.name, large && styles.nameLarge, BALANCED_WRAP, arabic && styles.arabic]}
        numberOfLines={3}
        textBreakStrategy="balanced"
        maxFontSizeMultiplier={MAX_FONT_SCALE}
      >
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
  name: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 14, fontWeight: '600', lineHeight: 17.5, marginTop: 10, textAlign: 'center' },
  nameLarge: { fontSize: 15.5, lineHeight: 19.5 },
  // A name or bio keeps the direction of its own words: a Latin one in an Arabic layout ends with its own full stop.
  arabic: { fontFamily: TYPOGRAPHY.arabic },
});
