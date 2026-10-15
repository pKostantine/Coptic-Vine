'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS, TYPOGRAPHY } from '../../../constants/theme';
import Icon from './Icon';
import { BuddedCross } from './Ornaments';

/** Book text never grows past this multiple of its design size, so large accessibility text keeps the shelf intact. */
const MAX_FONT_SCALE = 1.3;

interface LibraryBookProps {
  title: string;
  description: string;
  arabic: boolean;
  /** A row across the shelf (Agpeya, Bible, Holy Week) rather than a tile. */
  wide?: boolean;
  onPress: () => void;
}

/**
 * A book in the Books library (Coptic Vine design, "Library"): the budded cross in a
 * gold medallion, the book's name and what it holds. Most books are tiles two
 * to a row; the last are rows across the shelf with a chevron. The whole card
 * is one tap target lying behind the text. Downloads are kept to the Downloads
 * & Storage page, so the shelf carries no download control.
 */
export default function LibraryBook({ title, description, arabic, wide = false, onPress }: LibraryBookProps) {
  return (
    <View style={[styles.book, wide ? styles.bookWide : styles.bookTile]}>
      <LinearGradient colors={[COLORS.surfaceDeep, COLORS.surface]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${description}`}
        onPress={onPress}
        style={({ pressed }) => [StyleSheet.absoluteFill, pressed && styles.pressed]}
      />

      <View style={[styles.content, wide && styles.contentWide, wide && arabic && styles.rowReverse]} pointerEvents="box-none">
        <View style={[styles.medallion, wide && styles.medallionWide]} pointerEvents="none">
          <BuddedCross size={wide ? 26 : 32} />
        </View>
        <View style={[wide && styles.wideText]} pointerEvents="none">
          <Text
            style={[styles.title, wide && styles.titleWide, arabic && styles.arabicTitle, arabic && wide && styles.alignRight]}
            numberOfLines={2}
            maxFontSizeMultiplier={MAX_FONT_SCALE}
          >
            {title}
          </Text>
          <Text
            style={[styles.description, !wide && styles.centered, arabic && styles.arabicText, arabic && wide && styles.alignRight]}
            numberOfLines={2}
            maxFontSizeMultiplier={MAX_FONT_SCALE}
          >
            {description}
          </Text>
        </View>
        {wide ? <Icon name={arabic ? 'chevron-back' : 'chevron-forward'} size={18} color={COLORS.gold} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // No outline: the card's fade from surfaceDeep gives it its edge (Coptic Vine
  // design, "no line"). The design's hairline is only made transparent, so its 1pt stays.
  book: { borderRadius: 20, overflow: 'hidden', padding: 1 },
  bookTile: { flex: 1 },
  bookWide: { flex: 1 },
  pressed: { backgroundColor: 'rgba(255, 255, 255, 0.05)' },
  rowReverse: { flexDirection: 'row-reverse' },
  content: { alignItems: 'center', paddingBottom: 18, paddingHorizontal: 14, paddingTop: 20 },
  contentWide: { flexDirection: 'row', gap: 16, paddingBottom: 14, paddingHorizontal: 16, paddingTop: 14 },
  wideText: { flex: 1, minWidth: 0 },
  // 52pt inside its ring (40 on a row), as the design draws it: 54 across.
  medallion: {
    alignItems: 'center',
    backgroundColor: COLORS.goldSoft,
    borderColor: 'rgba(227, 181, 59, 0.35)',
    borderRadius: 27,
    borderWidth: 1,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  medallionWide: { borderRadius: 21, height: 42, width: 42 },
  title: { color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontSize: 19, fontWeight: '700', marginTop: 14, textAlign: 'center' },
  titleWide: { marginTop: 0, textAlign: 'left' },
  description: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 12.5, lineHeight: 17, marginTop: 4 },
  centered: { textAlign: 'center' },
  alignRight: { textAlign: 'right' },
  arabicTitle: { fontFamily: TYPOGRAPHY.arabic, writingDirection: 'rtl' },
  arabicText: { fontFamily: TYPOGRAPHY.arabic, writingDirection: 'rtl' },
});
