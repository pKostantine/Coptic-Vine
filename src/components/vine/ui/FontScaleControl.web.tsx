import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';

import { COLORS, TYPOGRAPHY } from '@/constants/theme';
import { toEasternArabicDigits } from '@/utils/localeFormat';
import { MAX_FONT_SCALE, MIN_FONT_SCALE } from '@/utils/preferencesStorage';
import type { FontScaleControlProps } from './FontScaleControl';

const THUMB = 24;

/**
 * Web font-size control (Coptic Vine design, "Book settings"): the setting's
 * name and its value, then a gold track between a small A and a large one. A
 * click on the track sets the size there; the keyboard and a screen reader
 * step it. Keeping @expo/ui's slider off this path also keeps it out of the
 * web bundle. The native build gets FontScaleControl.tsx.
 */
export default function FontScaleControl({ fontScale, isArabic, label, onStep, onSetValue }: FontScaleControlProps) {
  const [width, setWidth] = useState(0);
  const steps = MAX_FONT_SCALE - MIN_FONT_SCALE;
  const fraction = (fontScale - MIN_FONT_SCALE) / steps;

  const setFromPoint = (event: GestureResponderEvent) => {
    if (width <= 0) return;
    const x = Math.min(width, Math.max(0, event.nativeEvent.locationX));
    onSetValue(MIN_FONT_SCALE + Math.round((x / width) * steps));
  };

  return (
    <View style={styles.card}>
      <View style={[styles.header, isArabic && styles.rowReverse]}>
        <Text style={[styles.label, isArabic && styles.arabicText]} maxFontSizeMultiplier={1.3}>{label}</Text>
        <Text style={[styles.value, isArabic && styles.arabicText]} maxFontSizeMultiplier={1.3}>
          {isArabic ? toEasternArabicDigits(fontScale) : fontScale}
        </Text>
      </View>
      <View style={styles.row}>
        <Pressable accessibilityLabel="Decrease font size" hitSlop={8} onPress={() => onStep(-1)}>
          <Text style={[styles.endMarker, styles.endMarkerSmall]}>A</Text>
        </Pressable>
        <Pressable
          accessibilityRole="adjustable"
          accessibilityLabel={label}
          accessibilityValue={{ min: MIN_FONT_SCALE, max: MAX_FONT_SCALE, now: fontScale }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(event) => onStep(event.nativeEvent.actionName === 'increment' ? 1 : -1)}
          onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
          onPress={setFromPoint}
          style={styles.track}
        >
          <View style={styles.rail}>
            <View style={[styles.fill, { width: `${fraction * 100}%` }]} />
          </View>
          <View style={[styles.thumb, { left: Math.max(0, fraction * width - THUMB / 2) }]} pointerEvents="none" />
        </Pressable>
        <Pressable accessibilityLabel="Increase font size" hitSlop={8} onPress={() => onStep(1)}>
          <Text style={[styles.endMarker, styles.endMarkerLarge]}>A</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: 14, gap: 10, paddingBottom: 13, paddingHorizontal: 16, paddingTop: 11 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  rowReverse: { flexDirection: 'row-reverse' },
  label: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 15, fontWeight: '600' },
  value: { color: COLORS.goldBright, fontFamily: TYPOGRAPHY.body, fontSize: 15, fontWeight: '700', minWidth: 24, textAlign: 'right' },
  row: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  // Tall enough to click, the rail drawn through its middle.
  track: { flex: 1, height: 28, justifyContent: 'center', minWidth: 0 },
  rail: { backgroundColor: 'rgba(255, 255, 255, 0.14)', borderRadius: 3, height: 6, overflow: 'hidden' },
  fill: { backgroundColor: COLORS.gold, borderRadius: 3, height: 6 },
  thumb: { backgroundColor: COLORS.white, borderRadius: THUMB / 2, boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.45)', height: THUMB, position: 'absolute', top: 2, width: THUMB },
  endMarker: { color: COLORS.muted, fontFamily: TYPOGRAPHY.title, fontWeight: '700' },
  endMarkerSmall: { fontSize: 13 },
  endMarkerLarge: { fontSize: 21 },
  arabicText: {
    fontFamily: TYPOGRAPHY.arabic,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
