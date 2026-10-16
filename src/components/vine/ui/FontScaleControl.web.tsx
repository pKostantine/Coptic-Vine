import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';

import { COLORS, TYPOGRAPHY } from '@/constants/theme';
import { toEasternArabicDigits } from '@/utils/localeFormat';
import { FONT_LEVEL_COUNT, FONT_SCALE_STEP, fontScaleToLevel, MAX_FONT_SCALE, MIN_FONT_SCALE } from '@/utils/preferencesStorage';
import type { FontScaleControlProps } from './FontScaleControl';
import Icon from './Icon';

const THUMB = 24;

/**
 * Web font-size control (Coptic Vine design, "Book settings"): the setting's
 * name and its level (1 to as many as this screen has room for), then a gold
 * track between a small A and a large one. A click on the track sets the
 * size to the nearest level there; the keyboard and a screen reader step it
 * one level. On a desktop it is a plain row
 * instead, the value between − and + buttons. Keeping @expo/ui's slider off
 * this path also keeps it out of the web bundle. The native build gets
 * FontScaleControl.tsx.
 */
export default function FontScaleControl({ fontScale, isArabic, label, onStep, onSetValue, compact = false, stepper = false }: FontScaleControlProps) {
  const [width, setWidth] = useState(0);
  const onTrackKey = (event: { key?: string; preventDefault?: () => void }) => {
    const delta = { ArrowLeft: -1, ArrowDown: -1, PageDown: -5, ArrowRight: 1, ArrowUp: 1, PageUp: 5 }[event.key ?? ''];
    if (delta != null) onStep(delta);
    else if (event.key === 'Home') onSetValue(MIN_FONT_SCALE);
    else if (event.key === 'End') onSetValue(MAX_FONT_SCALE);
    else return;
    event.preventDefault?.();
  };
  const fraction = Math.min(1, Math.max(0, (fontScale - MIN_FONT_SCALE) / (MAX_FONT_SCALE - MIN_FONT_SCALE)));
  const level = fontScaleToLevel(fontScale);
  const value = isArabic ? toEasternArabicDigits(level) : level;

  if (stepper) {
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

  const setFromPoint = (event: GestureResponderEvent) => {
    // A press from the keyboard (Enter, Space) has no point on the track.
    const locationX = event?.nativeEvent?.locationX;
    if (width <= 0 || !Number.isFinite(locationX)) return;
    const x = Math.min(width, Math.max(0, locationX));
    onSetValue(MIN_FONT_SCALE + Math.round((x / width) * (FONT_LEVEL_COUNT - 1)) * FONT_SCALE_STEP);
  };

  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      <View style={styles.header}>
        <Text style={[styles.label, isArabic && styles.arabicText]} maxFontSizeMultiplier={1.3}>{label}</Text>
        <Text style={[styles.value, isArabic && styles.arabicText]} maxFontSizeMultiplier={1.3}>
          {value}
        </Text>
      </View>
      <View style={styles.row}>
        <Pressable accessibilityLabel="Decrease font size" hitSlop={8} onPress={() => onStep(-1)}>
          <Text style={[styles.endMarker, styles.endMarkerSmall]}>A</Text>
        </Pressable>
        <Pressable
          accessibilityRole="adjustable"
          accessibilityLabel={label}
          // react-native-web drops accessibilityValue: the aria props reach the DOM.
          aria-valuemin={1}
          aria-valuemax={FONT_LEVEL_COUNT}
          aria-valuenow={level}
          aria-valuetext={`${level} / ${FONT_LEVEL_COUNT}`}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(event) => onStep(event.nativeEvent.actionName === 'increment' ? 1 : -1)}
          onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
          onPress={setFromPoint}
          // The track is focusable, so it answers the keys a slider does.
          {...({ onKeyDown: onTrackKey } as object)}
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
  // The phone sheet's tighter row.
  cardCompact: { paddingBottom: 11, paddingTop: 9 },
  // The desktop's row: as tall as the switches under it, the stepper at its end.
  stepperRow: { alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: 14, flexDirection: 'row', gap: 10, minHeight: 44, paddingLeft: 16, paddingRight: 10 },
  stepperLabel: { flex: 1, minWidth: 0 },
  stepper: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  stepButton: { alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.3)', borderRadius: 16, height: 32, justifyContent: 'center', width: 32 },
  stepButtonPressed: { opacity: 0.7 },
  stepButtonDisabled: { opacity: 0.4 },
  stepperValue: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 16, fontWeight: '700', minWidth: 30, textAlign: 'center' },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  // Left set even in Arabic, whose right-to-left text would otherwise take the row's far side.
  label: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 15, fontWeight: '600', textAlign: 'left' },
  value: { color: COLORS.goldBright, fontFamily: TYPOGRAPHY.body, fontSize: 15, fontWeight: '700', minWidth: 24, textAlign: 'right' },
  row: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  // Tall enough to click, the rail drawn through its middle; it reaches 3.5pt
  // past the row above and below, so the row keeps the large A's 21pt.
  track: { flex: 1, height: 28, justifyContent: 'center', marginVertical: -3.5, minWidth: 0 },
  rail: { backgroundColor: 'rgba(255, 255, 255, 0.14)', borderRadius: 3, height: 6, overflow: 'hidden' },
  fill: { backgroundColor: COLORS.gold, borderRadius: 3, height: 6 },
  thumb: { backgroundColor: COLORS.white, borderRadius: THUMB / 2, boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.45)', height: THUMB, position: 'absolute', top: 2, width: THUMB },
  endMarker: { color: COLORS.muted, fontFamily: TYPOGRAPHY.title, fontWeight: '700' },
  // Set solid, as the design does: the row is as tall as the large A.
  endMarkerSmall: { fontSize: 13, lineHeight: 13 },
  endMarkerLarge: { fontSize: 21, lineHeight: 21 },
  arabicText: {
    fontFamily: TYPOGRAPHY.arabic,
    writingDirection: 'rtl',
  },
});
