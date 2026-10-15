import { Host, Slider } from '@expo/ui';
import { StyleSheet, Text, View } from 'react-native';

import { COLORS, TYPOGRAPHY } from '@/constants/theme';
import { toEasternArabicDigits } from '@/utils/localeFormat';
import { MAX_FONT_SCALE, MIN_FONT_SCALE } from '@/utils/preferencesStorage';

export interface FontScaleControlProps {
  fontScale: number;
  isArabic: boolean;
  /** Already-localized "Text Size" label. */
  label: string;
  /** Nudges the scale by a step — the web build's track and its keyboard actions. */
  onStep: (delta: number) => void;
  /** Sets the scale outright — what the slider reports as it moves. */
  onSetValue: (value: number) => void;
  /** The phone sheet's tighter row: 2pt less above and below. */
  compact?: boolean;
  /**
   * The desktop's row: the value between − and + buttons instead of a track.
   * Only a desktop browser asks for it, so only the web control draws it.
   */
  stepper?: boolean;
}

/**
 * Native font-size control (Coptic Vine design, "Book settings"): the setting's
 * name and its value, then a real SwiftUI/Jetpack Compose slider between a
 * small A and a large one, which beats repeatedly tapping step buttons to
 * cross the range on a phone.
 *
 * The Host wrapper is mandatory, not decorative. Slider is not a React Native
 * view — it is a SwiftUI view on iOS and a Jetpack Compose view on Android, and
 * Host is the bridging container that gives it a platform UI-toolkit hierarchy
 * to live in. Mounting one as a bare child of an ordinary <View> crashes the
 * app natively (which is a process kill, not a red box) the moment the screen
 * renders. Every example in the @expo/ui docs wraps its components this way.
 *
 * The slider is deliberately not wrapped in an `accessible` View. Marking a
 * parent accessible collapses its whole subtree into one element, which would
 * have flattened the native slider's own adjustable semantics into a single
 * static node — worse than leaving it alone. The control names itself through
 * the visible label sitting directly above it instead.
 *
 * The web build gets FontScaleControl.web.tsx (a tappable track) instead,
 * which also keeps @expo/ui out of the web bundle entirely — Metro resolves
 * the .web.tsx variant and never follows this file's imports there.
 */
export default function FontScaleControl({
  fontScale,
  isArabic,
  label,
  onSetValue,
  compact = false,
}: FontScaleControlProps) {
  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      <View style={[styles.header, isArabic && styles.rowReverse]}>
        <Text style={[styles.label, isArabic && styles.arabicText]} maxFontSizeMultiplier={1.3}>{label}</Text>
        <Text style={[styles.value, isArabic && styles.arabicText]} maxFontSizeMultiplier={1.3}>
          {isArabic ? toEasternArabicDigits(fontScale) : fontScale}
        </Text>
      </View>
      <View style={styles.track}>
        {/* Anchors the two ends of the track as smallest/largest, so the control
            reads without having to drag it first. */}
        <Text style={[styles.endMarker, styles.endMarkerSmall]}>A</Text>
        {/* matchContents lets the host take its height from the slider it wraps;
            without it the host has no intrinsic size and the control collapses.
            seedColor becomes the SwiftUI tint on iOS and seeds a Material 3
            palette on Android, which is the only way to colour these controls —
            they take no style prop — so the slider picks up the app's gold
            instead of the OS accent. layoutDirection is pinned so the track
            always runs small-to-large left-to-right, matching the fixed A/A
            markers beside it; the rest of this app's layout isn't mirrored for
            Arabic either, so letting the locale flip just this one control
            would leave it disagreeing with its own labels. */}
        <Host
          matchContents={{ vertical: true }}
          colorScheme="dark"
          seedColor={COLORS.gold}
          layoutDirection="leftToRight"
          style={styles.sliderHost}
        >
          <Slider
            value={fontScale}
            min={MIN_FONT_SCALE}
            max={MAX_FONT_SCALE}
            step={1}
            onValueChange={onSetValue}
          />
        </Host>
        <Text style={[styles.endMarker, styles.endMarkerLarge]}>A</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: 14, gap: 10, paddingBottom: 13, paddingHorizontal: 16, paddingTop: 11 },
  cardCompact: { paddingBottom: 11, paddingTop: 9 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  rowReverse: { flexDirection: 'row-reverse' },
  label: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 15, fontWeight: '600' },
  value: { color: COLORS.goldBright, fontFamily: TYPOGRAPHY.body, fontSize: 15, fontWeight: '700', minWidth: 24, textAlign: 'right' },
  track: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  sliderHost: { flex: 1, minWidth: 0 },
  endMarker: { color: COLORS.muted, fontFamily: TYPOGRAPHY.title, fontWeight: '700' },
  // Set solid, as the design does.
  endMarkerSmall: { fontSize: 13, lineHeight: 13 },
  endMarkerLarge: { fontSize: 21, lineHeight: 21 },
  arabicText: {
    fontFamily: TYPOGRAPHY.arabic,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
