'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS, SPACING, TYPOGRAPHY } from '../../../constants/theme';
import { tr } from '../../../utils/appText';
import { describeLoadError } from '../../../utils/loadErrors';
import { getCurrentAppLanguage } from '../../../utils/preferencesStorage';
import Icon from './Icon';

interface LoadFailureProps {
  /** The failure's message, as the service threw it. */
  error: string | null | undefined;
  onRetry?: () => void;
  /** A way out of a page that has nothing else on it — the native reader, which draws no header of its own. */
  onBack?: () => void;
  /** Fills its parent and centres (a page with nothing else to show) or sits inline among other content. */
  layout?: 'fill' | 'inline';
}

/**
 * What a page shows when its content did not arrive: what went wrong in the
 * reader's own words (a lost connection is named as one), and a Retry — so a
 * page that failed on a train is a tap from loading again rather than a
 * dead end to navigate out of and back into.
 */
export default function LoadFailure({ error, onRetry, onBack, layout = 'fill' }: LoadFailureProps) {
  const arabic = getCurrentAppLanguage() === 'ar';
  const { title, hint, detail } = describeLoadError(error);
  return (
    <View style={[styles.box, layout === 'fill' ? styles.fill : styles.inline]} accessibilityRole="alert">
      <View style={styles.badge}>
        <Icon name="cloudy-night-outline" size={24} color={COLORS.gold} />
      </View>
      <Text style={[styles.title, arabic && styles.arabic]} maxFontSizeMultiplier={1.3}>{title}</Text>
      <Text style={[styles.hint, arabic && styles.arabic]} maxFontSizeMultiplier={1.3}>{hint}</Text>
      {detail ? <Text style={styles.detail} selectable maxFontSizeMultiplier={1.2}>{detail}</Text> : null}
      <View style={styles.actions}>
        {onRetry ? (
          <Pressable accessibilityRole="button" onPress={onRetry} style={({ pressed }) => [styles.retry, pressed && styles.pressed]}>
            <Text style={[styles.retryText, arabic && styles.arabicTight]} maxFontSizeMultiplier={1.3}>{tr('Try again', 'Réessayer', 'حاول مرة أخرى')}</Text>
          </Pressable>
        ) : null}
        {onBack ? (
          <Pressable accessibilityRole="button" onPress={onBack} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
            <Text style={[styles.backText, arabic && styles.arabicTight]} maxFontSizeMultiplier={1.3}>{tr('Go back', 'Retour', 'رجوع')}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', paddingHorizontal: SPACING.lg },
  fill: { flex: 1, justifyContent: 'center', paddingVertical: SPACING.xl },
  inline: { paddingVertical: SPACING.lg },
  badge: {
    alignItems: 'center',
    backgroundColor: COLORS.goldSoft,
    borderColor: COLORS.goldLine,
    borderRadius: 26,
    borderWidth: 1,
    height: 52,
    justifyContent: 'center',
    marginBottom: 14,
    width: 52,
  },
  title: { color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontSize: 21, fontWeight: '700', textAlign: 'center' },
  hint: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 14.5, lineHeight: 21, marginTop: 6, maxWidth: 360, textAlign: 'center' },
  detail: { color: 'rgba(205, 216, 203, 0.55)', fontFamily: TYPOGRAPHY.body, fontSize: 12.5, lineHeight: 17, marginTop: 10, maxWidth: 360, textAlign: 'center' },
  actions: { alignItems: 'center', flexDirection: 'row', gap: 10, marginTop: 20 },
  retry: { alignItems: 'center', backgroundColor: COLORS.gold, borderRadius: 10, justifyContent: 'center', minHeight: 42, paddingHorizontal: 20 },
  retryText: { color: COLORS.greenDeep, fontFamily: TYPOGRAPHY.title, fontSize: 15, fontWeight: '700' },
  back: { alignItems: 'center', borderColor: COLORS.goldLine, borderRadius: 10, borderWidth: 1, justifyContent: 'center', minHeight: 42, paddingHorizontal: 18 },
  backText: { color: COLORS.goldBright, fontFamily: TYPOGRAPHY.body, fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.75 },
  arabic: { fontFamily: TYPOGRAPHY.arabic, writingDirection: 'rtl' },
  arabicTight: { fontFamily: TYPOGRAPHY.arabic },
});
