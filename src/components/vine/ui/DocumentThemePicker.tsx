'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DOCUMENT_THEME_IDS, DOCUMENT_THEMES, type DocumentThemeId } from '../../../constants/documentThemes';
import { COLORS, TYPOGRAPHY } from '../../../constants/theme';
import { appText, tr } from '../../../utils/appText';

interface DocumentThemePickerProps {
  selected: DocumentThemeId;
  onSelect: (theme: DocumentThemeId) => void;
  isArabic?: boolean;
}

/**
 * The row of pages a document can be read on, as a book app offers them: a
 * swatch of each page with "Aa" set in its own ink — the first letter the
 * page's text, the second its alternating blue, so the pair the services are
 * read in shows at a glance — and its name beneath. The chosen one wears a
 * gold ring.
 */
export default function DocumentThemePicker({ selected, onSelect, isArabic = false }: DocumentThemePickerProps) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={tr('Page', 'Page', 'الصفحة')}
      style={[styles.row, isArabic && styles.rowReverse]}
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
            style={({ pressed }) => [styles.option, pressed && styles.pressed]}
          >
            <View
              style={[
                styles.swatch,
                { backgroundColor: theme.colors.page, borderColor: active ? COLORS.gold : theme.colors.border },
                active && styles.swatchActive,
              ]}
            >
              <Text style={styles.sample} maxFontSizeMultiplier={1.2}>
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
  rowReverse: { flexDirection: 'row-reverse' },
  option: { alignItems: 'center', flex: 1, gap: 6, minWidth: 0 },
  pressed: { opacity: 0.75 },
  swatch: {
    alignItems: 'center',
    alignSelf: 'stretch',
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: 'center',
  },
  swatchActive: { borderWidth: 2.5 },
  sample: { fontFamily: TYPOGRAPHY.title, fontSize: 22, fontWeight: '700' },
  name: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 12, fontWeight: '600' },
  nameActive: { color: COLORS.gold, fontWeight: '800' },
  nameArabic: { fontFamily: TYPOGRAPHY.arabic },
});
