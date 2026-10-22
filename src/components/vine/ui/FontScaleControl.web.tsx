import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS, TYPOGRAPHY } from '@/constants/theme';
import { toEasternArabicDigits } from '@/utils/localeFormat';
import { FONT_SCALE_STEP, fontScaleToLevel, MAX_FONT_SCALE, MIN_FONT_SCALE } from '@/utils/preferencesStorage';
import type { FontScaleControlProps } from './FontScaleControl';
import Icon from './Icon';

/**
 * Web font-size control (Coptic Vine design, "Book settings"): the setting's
 * name, then its level (1 to as many as this screen has room for) between −
 * and + buttons, on every browser: a phone's and a tablet's as a desktop's.
 * Only the phone and tablet apps get a slider (FontScaleControl.tsx); keeping
 * @expo/ui's slider off this path also keeps it out of the web bundle.
 */
export default function FontScaleControl({ fontScale, isArabic, label, onStep }: FontScaleControlProps) {
  const value = isArabic ? toEasternArabicDigits(fontScaleToLevel(fontScale)) : fontScaleToLevel(fontScale);
  const stepButton = (delta: 1 | -1) => {
    // Within half a division of an end, there is no step left that way.
    const atEnd = delta < 0 ? fontScale <= MIN_FONT_SCALE + FONT_SCALE_STEP / 2 : fontScale >= MAX_FONT_SCALE - FONT_SCALE_STEP / 2;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={delta < 0 ? 'Decrease font size' : 'Increase font size'}
        accessibilityState={{ disabled: atEnd }}
        disabled={atEnd}
        onPress={() => onStep(delta)}
        style={({ pressed }) => [styles.stepButton, atEnd && styles.stepButtonDisabled, pressed && styles.stepButtonPressed]}
      >
        <Icon name={delta < 0 ? 'remove' : 'add'} size={17} color={COLORS.gold} />
      </Pressable>
    );
  };
  return (
    <View style={styles.stepperRow}>
      <Text style={[styles.label, styles.stepperLabel, isArabic && styles.arabicText]} maxFontSizeMultiplier={1.3}>{label}</Text>
      <View style={styles.stepper}>
        {stepButton(-1)}
        <Text style={styles.stepperValue} maxFontSizeMultiplier={1.3}>{value}</Text>
        {stepButton(1)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // As tall as the switches under it, the stepper at its end.
  stepperRow: { alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: 14, flexDirection: 'row', gap: 10, minHeight: 44, paddingLeft: 16, paddingRight: 10 },
  stepperLabel: { flex: 1, minWidth: 0 },
  stepper: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  stepButton: { alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.3)', borderRadius: 16, height: 32, justifyContent: 'center', width: 32 },
  stepButtonPressed: { opacity: 0.7 },
  stepButtonDisabled: { opacity: 0.4 },
  stepperValue: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 16, fontWeight: '700', minWidth: 30, textAlign: 'center' },
  // Left set even in Arabic, whose right-to-left text would otherwise take the row's far side.
  label: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 15, fontWeight: '600', textAlign: 'left' },
  arabicText: {
    fontFamily: TYPOGRAPHY.arabic,
    writingDirection: 'rtl',
  },
});
