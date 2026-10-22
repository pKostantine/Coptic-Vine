'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { DocumentTheme } from '../../../constants/documentThemes';
import { TYPOGRAPHY } from '../../../constants/theme';
import { useModalOrientations } from '../../../hooks/useModalOrientations';
import { getBibleChapterMenuLabel } from '../../../utils/bibleService';
import type { AppLanguage } from '../../../utils/preferencesStorage';
import { chapterPickerGrid, chapterPickerText } from './bibleChapterPickerParts';
import { readerPanelColors } from './readerPanelParts';

interface BibleChapterPickerProps {
  visible: boolean;
  theme: DocumentTheme;
  language: AppLanguage;
  bookKey: string;
  /** The book's name, in the App Language; none for the Psalms, whose eyebrow names them. */
  bookTitle: string;
  isPsalms: boolean;
  chapters: number[];
  current: number;
  /** Where the card starts: just under the floating controls. */
  top: number;
  onSelect: (chapter: number) => void;
  onClose: () => void;
}

/**
 * The chapters of the open book, from the chapter's title pill ("Genesis 1 ⌄"):
 * a card under the controls, in the page's colours as the reader panels are,
 * with a tile per chapter and the open one lit. A tap reads that chapter; a
 * tap outside, or Back, puts it away. The verses stay with the list button.
 */
export default function BibleChapterPicker({
  visible, theme, language, bookKey, bookTitle, isPsalms, chapters, current, top, onSelect, onClose,
}: BibleChapterPickerProps) {
  const modalOrientations = useModalOrientations();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  if (!visible) return null;

  const colors = readerPanelColors(theme);
  const text = chapterPickerText(language, isPsalms);
  const grid = chapterPickerGrid({ width, height, top, bottomInset: insets.bottom, chapters, current });
  const arabic = language === 'ar';

  return (
    <Modal supportedOrientations={modalOrientations} visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]} accessibilityRole="button" accessibilityLabel={text.close} onPress={onClose} />
      <View
        style={[styles.card, {
          backgroundColor: colors.panel,
          borderColor: colors.rule,
          left: grid.left,
          maxHeight: grid.maxHeight,
          top,
          width: grid.cardWidth,
        }]}
      >
        <View style={styles.header}>
          <Text style={[styles.eyebrow, { color: colors.here }, arabic && styles.arabic]}>{text.eyebrow}</Text>
          {bookTitle && !isPsalms ? (
            <Text numberOfLines={1} style={[styles.title, { color: colors.ink }, arabic && styles.arabic]}>{bookTitle}</Text>
          ) : null}
        </View>
        <ScrollView
          contentContainerStyle={[styles.tiles, { gap: grid.gap, paddingHorizontal: grid.padding }]}
          contentOffset={{ x: 0, y: grid.initialScrollY }}
          showsVerticalScrollIndicator={false}
        >
          {chapters.map((chapter) => {
            const lit = chapter === current;
            return (
              <Pressable
                key={chapter}
                accessibilityRole="button"
                accessibilityLabel={text.chapterLabel(getBibleChapterMenuLabel(bookKey, chapter, language))}
                accessibilityState={{ selected: lit }}
                onPress={() => onSelect(chapter)}
                style={({ pressed }) => [
                  styles.tile,
                  { minWidth: grid.tile, backgroundColor: lit ? colors.here : colors.wash },
                  pressed && !lit && { backgroundColor: colors.hereSoft },
                ]}
              >
                <Text style={[styles.tileText, { color: lit ? theme.colors.page : colors.ink }, arabic && styles.arabic]} numberOfLines={1}>
                  {getBibleChapterMenuLabel(bookKey, chapter, language)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.28)',
    overflow: 'hidden',
    paddingBottom: 16,
    position: 'absolute',
  },
  header: { gap: 2, paddingBottom: 12, paddingHorizontal: 18, paddingTop: 16 },
  eyebrow: { fontFamily: TYPOGRAPHY.body, fontSize: 11, fontWeight: '800', letterSpacing: 1.6, textTransform: 'uppercase' },
  title: { fontFamily: TYPOGRAPHY.title, fontSize: 22, fontWeight: '700' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap' },
  tile: { alignItems: 'center', borderRadius: 12, height: 44, justifyContent: 'center', paddingHorizontal: 10 },
  tileText: { fontFamily: TYPOGRAPHY.title, fontSize: 16, fontWeight: '700' },
  arabic: { fontFamily: TYPOGRAPHY.arabic, writingDirection: 'rtl' },
});
