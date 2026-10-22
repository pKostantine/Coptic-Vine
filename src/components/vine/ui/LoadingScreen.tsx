'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { Image, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS, TYPOGRAPHY } from '../../../constants/theme';
import { tr } from '../../../utils/appText';
import { getCurrentAppLanguage } from '../../../utils/preferencesStorage';

/** Continues the native splash screen's look (the same deep green, the same seal) instead of cutting to a bare "Loading…" text while a document's content loads from Supabase. */
export default function LoadingScreen({ belowHeader = false }: {
  /**
   * On a page whose body starts at the top of the screen (the Bible chapter,
   * its controls floating over it): the splash starts there instead of
   * reaching up past the status bar. It still runs to the sides and the foot.
   */
  belowHeader?: boolean;
} = {}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          bottom: -insets.bottom,
          left: -insets.left,
          right: -insets.right,
          top: belowHeader ? 0 : -insets.top,
        },
      ]}
    >
      <Image source={require('../../../../assets/images/coptic-vine-seal-screen.png')} style={styles.logo} />
      <Text style={[styles.text, getCurrentAppLanguage() === 'ar' && styles.arabic]}>{tr('Loading…', 'Chargement…', 'جارٍ التحميل…')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: COLORS.greenDeep,
    gap: 24,
    justifyContent: 'center',
    position: 'absolute',
    zIndex: 1000,
  },
  logo: {
    height: 160,
    resizeMode: 'contain',
    width: 160,
  },
  text: {
    color: COLORS.white,
    fontFamily: TYPOGRAPHY.title,
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 30,
  },
  arabic: { fontFamily: TYPOGRAPHY.arabic, writingDirection: 'rtl' },
});
