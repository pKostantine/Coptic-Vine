import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS, TYPOGRAPHY } from '../../../constants/theme';

interface ToggleRowProps {
  label: string;
  isArabic?: boolean;
  active: boolean;
  onPress: () => void;
  disabled?: boolean;
  /** The row's least height: 48 by default; Book Settings sets 44, and 40 in the phone sheet. */
  minHeight?: number;
}

/**
 * A setting on a switch (Coptic Vine design, "Book settings"): its name on a
 * quiet row, the switch gold when on.
 */
export default function ToggleRow({ label, isArabic = false, active, onPress, disabled = false, minHeight }: ToggleRowProps) {
  const on = active && !disabled;
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: on, disabled }}
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [styles.row, minHeight !== undefined && [styles.rowSized, { minHeight }], disabled && styles.rowDisabled, pressed && !disabled && styles.pressed]}
    >
      <Text style={[styles.label, isArabic && styles.labelArabic, disabled && styles.labelDisabled]} maxFontSizeMultiplier={1.3}>{label}</Text>
      <Switch on={on} />
    </Pressable>
  );
}

/** The switch alone: 46 by 28, its thumb sliding to the gold side. */
export function Switch({ on }: { on: boolean }) {
  return (
    <View style={[styles.track, on && styles.trackOn]}>
      <View style={[styles.thumb, on && styles.thumbOn]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 10,
    minHeight: 48,
    paddingLeft: 16,
    paddingRight: 10,
    paddingVertical: 8,
  },
  // A row of a set height centres the 28pt switch in it, so a 40pt row has 6pt either side.
  rowSized: { paddingVertical: 6 },
  rowDisabled: { opacity: 0.5 },
  pressed: { backgroundColor: 'rgba(255, 255, 255, 0.09)' },
  label: { color: COLORS.white, flex: 1, fontFamily: TYPOGRAPHY.body, fontSize: 15, fontWeight: '600', minWidth: 0 },
  labelDisabled: { color: COLORS.muted },
  labelArabic: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'left', writingDirection: 'rtl' },
  track: { backgroundColor: 'rgba(255, 255, 255, 0.14)', borderRadius: 99, height: 28, padding: 3, width: 46 },
  trackOn: { backgroundColor: COLORS.gold },
  thumb: { backgroundColor: COLORS.muted, borderRadius: 11, boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.3)', height: 22, width: 22 },
  thumbOn: { alignSelf: 'flex-end', backgroundColor: COLORS.greenDeep },
});
