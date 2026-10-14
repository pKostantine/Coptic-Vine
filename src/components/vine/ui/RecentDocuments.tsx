'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS, TYPOGRAPHY } from '../../../constants/theme';
import { appText, tr } from '../../../utils/appText';
import { getCurrentAppLanguage } from '../../../utils/preferencesStorage';
import { clearRecentDocuments, useRecentDocuments } from '../../../utils/recentDocuments';
import MenuRow, { menuRowPosition } from './MenuRow';

/** How many of the remembered documents the shelf offers. */
const SHOWN = 4;

interface RecentDocumentsProps {
  arabic: boolean;
  /** Inside the iPad's and desktop's columns, which set their own margins. */
  flush?: boolean;
}

/**
 * "Continue reading" on the Books page: the services and chapters opened most
 * recently, newest first, each a tap from opening again — the same few
 * documents are read over and over through a week, and the shelf is a long
 * way from a Holy Week hour. Nothing is drawn until something has been read.
 */
export default function RecentDocuments({ arabic, flush = false }: RecentDocumentsProps) {
  const router = useRouter();
  const recents = useRecentDocuments();
  const language = getCurrentAppLanguage();
  if (!recents.length) return null;
  const shown = recents.slice(0, SHOWN);

  return (
    <View style={[styles.block, flush && styles.flush]}>
      <View style={[styles.heading, arabic && styles.rowReverse]}>
        <Text style={[styles.title, arabic && styles.arabic]} accessibilityRole="header" maxFontSizeMultiplier={1.3}>
          {tr('Continue reading', 'Reprendre la lecture', 'متابعة القراءة')}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr('Clear the recently opened documents', 'Effacer les documents récemment ouverts', 'مسح المستندات المفتوحة مؤخرًا')}
          hitSlop={8}
          onPress={clearRecentDocuments}
          style={({ pressed }) => [styles.clear, pressed && styles.pressed]}
        >
          <Text style={[styles.clearText, arabic && styles.arabicTight]} maxFontSizeMultiplier={1.3}>{tr('Clear', 'Effacer', 'مسح')}</Text>
        </Pressable>
      </View>
      <View>
        {shown.map((entry, index) => (
          <MenuRow
            key={entry.key}
            title={language === 'fr' ? entry.title.french || entry.title.english : entry.title.english}
            arabic={entry.title.arabic}
            subtitle={appText({ ...entry.book, arabic: '' })}
            subtitleArabic={entry.book.arabic}
            showEnglish={!arabic}
            showArabic={arabic}
            position={menuRowPosition(index, shown.length)}
            onPress={() => router.push(entry.href as never)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: 24 },
  flush: { marginTop: 20 },
  heading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  rowReverse: { flexDirection: 'row-reverse' },
  title: { color: COLORS.white, flexShrink: 1, fontFamily: TYPOGRAPHY.title, fontSize: 21, fontWeight: '700' },
  clear: { minHeight: 32, justifyContent: 'center', paddingHorizontal: 4 },
  clearText: { color: COLORS.goldBright, fontFamily: TYPOGRAPHY.body, fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.7 },
  arabic: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'right', writingDirection: 'rtl' },
  arabicTight: { fontFamily: TYPOGRAPHY.arabic },
});
