'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DOCUMENT_THEME_IDS, DOCUMENT_THEMES, type DocumentThemeId } from '../../../constants/documentThemes';
import { COLORS, TYPOGRAPHY } from '../../../constants/theme';
import { appText, tr } from '../../../utils/appText';
import { useLayoutMode } from '../../../utils/useLayoutMode';

interface DocumentThemePickerProps {
  selected: DocumentThemeId;
  onSelect: (theme: DocumentThemeId) => void;
  isArabic?: boolean;
}

/**
 * The row of pages a document can be read on, as a book app offers them: a
 * swatch of each page with "Aa" set in its own ink — the first letter the
 * page's text, the second its alternating voice (Night's blue, Vine's
 * lavender), so the pair the services are read in shows at a glance — and its
 * name beneath. The chosen one wears a gold ring. The swatches are 54pt in the
 * phone's sheet and 72pt in the iPad's and desktop's dialog (Coptic Vine
 * design, "Book settings").
 */
export default function DocumentThemePicker({ selected, onSelect, isArabic = false }: DocumentThemePickerProps) {
  const wide = useLayoutMode() !== 'phone';
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={tr('Page', 'Page', 'الصفحة')}
      style={styles.row}
    >
      {DOCUMENT_THEME_IDS.map((id) => {
        const theme = DOCUMENT_THEMES[id];
        const active = id === selected;
        const name = appText(theme.name);
        return (
          <Pressable
            key={id}
            accessibilityRole="radio"
            accessibilityLabel={name}
            accessibilityState={{ checked: active, selected: active }}
            onPress={() => onSelect(id)}
            style={({ pressed }) => [styles.option, wide && styles.optionWide, pressed && styles.pressed]}
          >
            <View
              style={[
                styles.swatch,
                wide && styles.swatchWide,
                { backgroundColor: theme.colors.page },
                // The dark pages (black, navy, deep green) would sink into the green sheet without a hairline.
                theme.dark && styles.swatchEdge,
                active && styles.swatchActive,
              ]}
            >
              <Text style={[styles.sample, wide && styles.sampleWide]} maxFontSizeMultiplier={1.2}>
                <Text style={{ color: theme.colors.text }}>A</Text>
                <Text style={{ color: theme.colors.alternate }}>a</Text>
              </Text>
            </View>
            <Text
              numberOfLines={1}
              maxFontSizeMultiplier={1.3}
              style={[styles.name, active && styles.nameActive, isArabic && styles.nameArabic]}
            >
              {name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  option: { alignItems: 'center', flex: 1, gap: 5, minWidth: 0 },
  optionWide: { gap: 7 },
  pressed: { opacity: 0.75 },
  // As wide as its fifth of the row, up to 54pt; square.
  swatch: {
    alignItems: 'center',
    aspectRatio: 1,
    borderRadius: 14,
    justifyContent: 'center',
    maxWidth: 54,
    width: '100%',
  },
  swatchWide: { borderRadius: 16, maxWidth: 72 },
  swatchEdge: { boxShadow: 'inset 0px 0px 0px 1px rgba(255, 255, 255, 0.12)' },
  // The ring sits outside the swatch, so the chosen page keeps its size.
  swatchActive: { boxShadow: `0px 0px 0px 2.5px ${COLORS.gold}` },
  sample: { fontFamily: TYPOGRAPHY.title, fontSize: 19, fontWeight: '700', letterSpacing: 0.2 },
  sampleWide: { fontSize: 22 },
  name: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 13, fontWeight: '600' },
  nameActive: { color: COLORS.gold, fontWeight: '700' },
  nameArabic: { fontFamily: TYPOGRAPHY.arabic },
});
