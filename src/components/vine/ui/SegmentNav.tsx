import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS, TYPOGRAPHY } from '../../../constants/theme';

const MAX_FONT_SCALE = 1.25;

export interface SegmentNavItem<Key extends string> {
  key: Key;
  label: string;
}

interface SegmentNavProps<Key extends string> {
  items: SegmentNavItem<Key>[];
  active: Key;
  onSelect: (key: Key) => void;
  arabic?: boolean;
  /** The row's role: `tablist` for a page's sections, `radiogroup` for a choice. */
  role?: 'tablist' | 'radiogroup';
}

/**
 * A pill of sections across the top of a tab's page (Coptic Vine design,
 * "Music", "Learn", "Home"): black, with the chosen section on a gold pill.
 */
export default function SegmentNav<Key extends string>({ items, active, onSelect, arabic = false, role = 'tablist' }: SegmentNavProps<Key>) {
  return (
    <View accessibilityRole={role} style={styles.pill}>
      {items.map((item) => {
        const selected = item.key === active;
        return (
          <Pressable
            key={item.key}
            accessibilityRole={role === 'tablist' ? 'tab' : 'radio'}
            aria-checked={role === 'radiogroup' ? selected : undefined}
            aria-selected={role === 'tablist' ? selected : undefined}
            onPress={() => onSelect(item.key)}
            style={[styles.option, selected && styles.optionActive]}
          >
            <Text style={[styles.label, selected && styles.labelActive, arabic && styles.arabic]} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    backgroundColor: COLORS.black,
    borderColor: COLORS.border,
    borderRadius: 99,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    padding: 4,
  },
  // 8pt over and under a 14pt label: 33pt, in a 43pt pill.
  option: { alignItems: 'center', borderRadius: 99, flex: 1, justifyContent: 'center', minHeight: 33, paddingHorizontal: 8, paddingVertical: 8 },
  optionActive: { backgroundColor: COLORS.gold },
  label: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 14, fontWeight: '600' },
  labelActive: { color: COLORS.greenDeep },
  arabic: { fontFamily: TYPOGRAPHY.arabic, writingDirection: 'rtl' },
});
