'use no memo'; // Reads the App Language as it renders — see src/utils/appText.ts.
import { DatePicker, Host } from '@expo/ui/swift-ui';
import { datePickerStyle, environment, labelsHidden } from '@expo/ui/swift-ui/modifiers';
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';

import { getCurrentAppLanguage } from '@/utils/preferencesStorage';
import { canonTime, parseCanonTime } from '@/utils/spiritualCanon';

import type { TimeWheelProps } from './TimeWheel';

/** The system's locale for each App Language: twelve hours in English and Arabic (with Arabic digits), twenty-four in French. */
const LOCALES = { en: 'en_US', fr: 'fr_FR', ar: 'ar_EG' } as const;

/**
 * The time of day on the iPhone's and iPad's own wheels — SwiftUI's
 * DatePicker in its wheel style, the picker the Alarm app sets an alarm with.
 * Dark whatever the system's appearance, as the app is.
 *
 * The Host wrapper is what gives a SwiftUI view a place in React Native's
 * hierarchy (see FontScaleControl.tsx); a bare DatePicker crashes the app.
 */
export default function TimeWheel({ time, onChange }: TimeWheelProps) {
  const { hour, minute } = parseCanonTime(time);
  // The day is not shown: only its hour and minute are read back.
  const selection = useMemo(() => {
    const date = new Date();
    date.setHours(hour, minute, 0, 0);
    return date;
  }, [hour, minute]);
  return (
    // Out of the safe area's reach, as the text size slider is (FontScaleControl.tsx):
    // its sheet is laid out below the screen before it slides up.
    <Host colorScheme="dark" ignoreSafeArea="all" style={styles.host}>
      <DatePicker
        selection={selection}
        displayedComponents={['hourAndMinute']}
        onDateChange={(date) => onChange(canonTime(date.getHours(), date.getMinutes()))}
        modifiers={[datePickerStyle('wheel'), labelsHidden(), environment('locale', LOCALES[getCurrentAppLanguage()])]}
      />
    </Host>
  );
}

const styles = StyleSheet.create({
  // The wheel's own height; it centres itself across the width.
  host: { alignSelf: 'stretch', height: 216 },
});
