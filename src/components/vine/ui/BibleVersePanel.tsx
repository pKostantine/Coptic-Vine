'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { type LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { documentSelectorColors } from '../../../constants/documentSelectorColors';
import type { DocumentTheme } from '../../../constants/documentThemes';
import { TYPOGRAPHY } from '../../../constants/theme';
import type { BibleHighlight } from '../../../types/bibleHighlights';
import { appText, appTextIsArabic, type AppText } from '../../../utils/appText';
import { arabicItalicStyle } from '../../../utils/arabicItalic';
import { getBibleVerseDisplayLabel, type PsalmNumbering } from '../../../utils/bibleService';
import type { AppLanguage } from '../../../utils/preferencesStorage';
import { bibleHighlightVerseId, type BibleDisplayVerse, type BibleLanguageKey } from '../bibleDocumentHtml';
import { highlightWash } from '../textHighlights';
import Icon from './Icon';
import ReaderPanel from './ReaderPanel';
import { readerPanelColors, readerPanelText } from './readerPanelParts';

export const BIBLE_LANGUAGE_OPTIONS: { key: BibleLanguageKey; label: AppText }[] = [
  { key: 'english', label: { english: 'English', arabic: 'الإنجليزية', french: 'Anglais' } },
  { key: 'englishNkjv', label: { english: 'English (NKJV)', arabic: 'الإنجليزية (NKJV)', french: 'Anglais (NKJV)' } },
  { key: 'englishFromCoptic', label: { english: 'English (from Coptic)', arabic: 'الإنجليزية (من القبطية)', french: 'Anglais (du copte)' } },
  { key: 'coptic', label: { english: 'Coptic', arabic: 'القبطية', french: 'Copte' } },
  { key: 'greek', label: { english: 'Greek', arabic: 'اليونانية', french: 'Grec' } },
  { key: 'arabic', label: { english: 'Arabic', arabic: 'العربية', french: 'Arabe' } },
  { key: 'arabicFromCoptic', label: { english: 'Arabic (from Coptic)', arabic: 'العربية (من القبطية)', french: 'Arabe (du copte)' } },
  { key: 'french', label: { english: 'French', arabic: 'الفرنسية', french: 'Français' } },
];

const PSALMS_BOOK_KEY = 'psalms';
const PSALM_118_STANZA_LETTERS = [
  'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'כ',
  'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ', 'ק', 'ר', 'ש', 'ת',
] as const;

function isArabicBibleLanguage(language: BibleLanguageKey): boolean {
  return language === 'arabic' || language === 'arabicFromCoptic';
}

function getPsalmStanza(
  bookKey: string | null | undefined,
  chapterNumber: number,
  psalmNumbering: PsalmNumbering,
  verseNumber: number | string,
): { letter: string; number: number } | null {
  const isPsalm118 = bookKey === PSALMS_BOOK_KEY
    && (psalmNumbering === 'septuagint' ? chapterNumber === 118 : chapterNumber === 119);
  if (!isPsalm118) return null;

  const numericVerse = typeof verseNumber === 'number' ? verseNumber : Number(verseNumber);
  if (!Number.isInteger(numericVerse) || numericVerse < 1 || (numericVerse - 1) % 8 !== 0) return null;

  const stanzaIndex = (numericVerse - 1) / 8;
  const letter = PSALM_118_STANZA_LETTERS[stanzaIndex];
  return letter ? { letter, number: stanzaIndex + 1 } : null;
}

function getBibleLanguageLabel(language: BibleLanguageKey, appLanguage: AppLanguage): string {
  const option = BIBLE_LANGUAGE_OPTIONS.find((item) => item.key === language);
  return appText(option?.label, appLanguage) || language;
}

function getVersePreviewLanguage(
  verse: BibleDisplayVerse,
  appLanguage: AppLanguage,
  availableLanguages: BibleLanguageKey[],
  enabledLanguages: Record<BibleLanguageKey, boolean>,
): BibleLanguageKey {
  const primaryLanguages: BibleLanguageKey[] = appLanguage === 'ar'
    ? ['arabic', 'arabicFromCoptic', 'english', 'englishNkjv', 'englishFromCoptic', 'coptic', 'greek']
    : appLanguage === 'fr'
      ? ['french', 'english', 'englishNkjv', 'englishFromCoptic', 'arabic', 'arabicFromCoptic', 'coptic', 'greek']
      : ['english', 'englishNkjv', 'englishFromCoptic', 'arabic', 'arabicFromCoptic', 'coptic', 'greek'];
  const orderedLanguages = [
    ...primaryLanguages,
    ...availableLanguages.filter((language) => !primaryLanguages.includes(language)),
  ];
  const enabledWithText = orderedLanguages.find((language) =>
    availableLanguages.includes(language) && enabledLanguages[language] && String(verse[language] || '').trim()
  );
  if (enabledWithText) return enabledWithText;

  const enabledFallback = orderedLanguages.find((language) => availableLanguages.includes(language) && enabledLanguages[language]);
  if (enabledFallback) return enabledFallback;

  return availableLanguages.find((language) => String(verse[language] || '').trim()) || availableLanguages[0] || 'english';
}

/** "Chapter 1 of 50", "Psalm 23 of 151", in the App Language: the chapter, and the count in a lighter voice. */
export function chapterPosition(chapterNumber: number, chapterCount: number, isPsalms: boolean, language: AppLanguage): { name: string; count: string } {
  const number = getBibleVerseDisplayLabel(chapterNumber, language);
  const total = chapterCount > 0 ? getBibleVerseDisplayLabel(chapterCount, language) : '';
  if (language === 'ar') return { name: `${isPsalms ? 'المزمور' : 'الإصحاح'} ${number}`, count: total ? `من ${total}` : '' };
  if (language === 'fr') return { name: `${isPsalms ? 'Psaume' : 'Chapitre'} ${number}`, count: total ? `sur ${total}` : '' };
  return { name: `${isPsalms ? 'Psalm' : 'Chapter'} ${number}`, count: total ? `of ${total}` : '' };
}

/** Each highlighted verse's colour, by the id a highlight anchors to: the first highlight on it gives its number its colour. */
export function highlightColorsByVerse(highlights: Pick<BibleHighlight, 'verseId' | 'color'>[]): Map<string, string> {
  const colors = new Map<string, string>();
  for (const highlight of highlights) {
    if (!colors.has(highlight.verseId)) colors.set(highlight.verseId, highlight.color);
  }
  return colors;
}

interface BibleVersePanelProps {
  visible: boolean;
  onClose: () => void;
  theme: DocumentTheme;
  appLanguage: AppLanguage;
  /** The chapter screen's own labels (SELECTOR_TEXT in app/bible/[bookKey]/[chapter].tsx). */
  text: {
    previousChapter: string;
    nextChapter: string;
    closeSelector: string;
    bookmarkChapter: string;
    openBibleSettings: string;
  };
  /** "Genesis 1", heading the panel under "Verses". */
  title: AppText;
  bookKey: string | null | undefined;
  chapterNumber: number;
  chapterCount: number;
  previousChapter: number | null;
  nextChapter: number | null;
  onGoToChapter: (chapter: number | null) => void;
  psalmNumbering: PsalmNumbering;
  verses: BibleDisplayVerse[];
  availableLanguages: BibleLanguageKey[];
  enabledLanguages: Record<BibleLanguageKey, boolean>;
  onToggleLanguage: (language: BibleLanguageKey) => void;
  /** The verse the reader was at when the panel opened: outlined, and scrolled to. */
  currentVerse: string | null;
  /** This book's highlights: a highlighted verse keeps its colour on its number. */
  highlights: Pick<BibleHighlight, 'verseId' | 'color'>[];
  onSelectVerse: (verse: number | string) => void;
  bookmarked: boolean;
  onToggleBookmark: () => void;
  onOpenSettings: () => void;
}

/**
 * The Bible chapter's Verses (ReaderPanel.tsx): the chapter between arrows to
 * the one before and after, the translations as chips to turn on and off, and
 * each verse with the first two lines of it — its number on the colour it is
 * highlighted in, and the verse the reader is at outlined in gold.
 */
export default function BibleVersePanel({
  visible,
  onClose,
  theme,
  appLanguage,
  text,
  title,
  bookKey,
  chapterNumber,
  chapterCount,
  previousChapter,
  nextChapter,
  onGoToChapter,
  psalmNumbering,
  verses,
  availableLanguages,
  enabledLanguages,
  onToggleLanguage,
  currentVerse,
  highlights,
  onSelectVerse,
  bookmarked,
  onToggleBookmark,
  onOpenSettings,
}: BibleVersePanelProps) {
  const styles = useMemo(() => createStyles(theme), [theme]);
  const panel = useMemo(() => readerPanelColors(theme), [theme]);
  const disabledColor = documentSelectorColors(theme).disabled;
  const panelText = readerPanelText(appLanguage);
  const arabicApp = appLanguage === 'ar';
  const position = chapterPosition(chapterNumber, chapterCount, bookKey === PSALMS_BOOK_KEY, appLanguage);
  const highlightColors = useMemo(() => highlightColorsByVerse(highlights), [highlights]);

  const scrollRef = useRef<ScrollView>(null);
  const [rowLayouts, setRowLayouts] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!visible || !currentVerse) return;
    const y = rowLayouts[currentVerse];
    if (y === undefined) return;
    scrollRef.current?.scrollTo({ y: Math.max(y - 12, 0), animated: false });
  }, [visible, currentVerse, rowLayouts]);

  return (
    <ReaderPanel
      visible={visible}
      onClose={onClose}
      closeAccessibilityLabel={text.closeSelector}
      eyebrow={panelText.verses}
      title={appText(title, appLanguage)}
      titleArabic={appTextIsArabic(title, appLanguage)}
      theme={theme}
      actions={[
        { icon: bookmarked ? 'bookmark' : 'bookmark-outline', accessibilityLabel: text.bookmarkChapter, onPress: onToggleBookmark },
        { icon: 'settings-outline', accessibilityLabel: text.openBibleSettings, onPress: onOpenSettings },
      ]}
      top={(layout) => (
        <View>
          <View style={[styles.chapterRow, layout.compact && styles.chapterRowCompact]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={text.previousChapter}
              disabled={previousChapter === null}
              style={[styles.chapterArrow, previousChapter === null && styles.chapterArrowDisabled]}
              onPress={() => onGoToChapter(previousChapter)}
            >
              <Icon name={arabicApp ? 'chevron-forward' : 'chevron-back'} size={19} color={previousChapter === null ? disabledColor : panel.voice} />
            </Pressable>
            <Text style={[styles.chapterName, arabicApp && styles.arabicText]} numberOfLines={1}>
              {position.name}
              {position.count ? <Text style={styles.chapterCount}>{` ${position.count}`}</Text> : null}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={text.nextChapter}
              disabled={nextChapter === null}
              style={[styles.chapterArrow, nextChapter === null && styles.chapterArrowDisabled]}
              onPress={() => onGoToChapter(nextChapter)}
            >
              <Icon name={arabicApp ? 'chevron-back' : 'chevron-forward'} size={19} color={nextChapter === null ? disabledColor : panel.voice} />
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipsScroller}
            contentContainerStyle={[styles.chips, layout.compact && styles.chipsCompact]}
          >
            {BIBLE_LANGUAGE_OPTIONS.filter((option) => availableLanguages.includes(option.key)).map((option) => {
              const on = Boolean(enabledLanguages[option.key]);
              const languageLabel = getBibleLanguageLabel(option.key, appLanguage);
              return (
                <Pressable
                  key={option.key}
                  accessibilityRole="button"
                  accessibilityLabel={languageLabel}
                  accessibilityState={{ selected: on }}
                  style={[styles.chip, on && styles.chipOn]}
                  onPress={() => onToggleLanguage(option.key)}
                >
                  <Text style={[styles.chipText, arabicApp && styles.arabicText, on && styles.chipTextOn]}>{languageLabel}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}
    >
      {(layout) => (
        <ScrollView ref={scrollRef} style={styles.list} contentContainerStyle={[styles.listContent, layout.compact && styles.listContentCompact]}>
          {verses.map((verse) => {
            const previewLanguage = getVersePreviewLanguage(verse, appLanguage, availableLanguages, enabledLanguages);
            const isPsalmIntroduction = Boolean(verse.isPsalmIntroduction);
            const stanza = getPsalmStanza(bookKey, chapterNumber, psalmNumbering, verse.verseNumber);
            const verseKey = String(verse.verseNumber);
            const isHere = currentVerse !== null && verseKey === currentVerse;
            const highlight = isPsalmIntroduction ? undefined : highlightColors.get(bibleHighlightVerseId(verse));
            const recordLayout = (event: LayoutChangeEvent) => {
              const y = event.nativeEvent.layout.y;
              setRowLayouts((current) => (current[verseKey] === y ? current : { ...current, [verseKey]: y }));
            };
            return (
              <Fragment key={`selector-${verse.verseNumber}`}>
                {stanza ? (
                  <View accessibilityRole="header" style={styles.psalmStanzaDivider}>
                    <View style={styles.psalmStanzaLine} />
                    <View style={styles.psalmStanzaLabel}>
                      <Text style={styles.psalmStanzaLetter}>{stanza.letter}</Text>
                      <Text style={[styles.psalmStanzaNumber, arabicApp && styles.psalmStanzaNumberArabic]}>
                        ({getBibleVerseDisplayLabel(stanza.number, appLanguage)})
                      </Text>
                    </View>
                    <View style={styles.psalmStanzaLine} />
                  </View>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={isHere ? { selected: true } : undefined}
                  style={({ pressed }) => [styles.verseRow, isHere && styles.verseRowHere, pressed && !isHere && styles.verseRowPressed]}
                  onLayout={recordLayout}
                  onPress={() => onSelectVerse(verse.verseNumber)}
                >
                  <View style={styles.numberCell}>
                    <Text
                      style={[
                        styles.verseNumber,
                        verse.isLxxAddition && styles.verseNumberLxx,
                        isPsalmIntroduction && styles.verseNumberIntro,
                        highlight ? [styles.verseNumberHighlighted, { backgroundColor: highlightWash(highlight) }] : null,
                      ]}
                    >
                      {isPsalmIntroduction ? '' : getBibleVerseDisplayLabel(verse.verseNumber, appLanguage)}
                    </Text>
                  </View>
                  <Text
                    numberOfLines={2}
                    style={[
                      styles.versePreview,
                      isArabicBibleLanguage(previewLanguage) && styles.versePreviewArabic,
                      previewLanguage === 'coptic' && styles.versePreviewCoptic,
                      isPsalmIntroduction && styles.versePreviewIntro,
                      // Arabic in italic, slanted as Chrome slants it (utils/arabicItalic.ts).
                      isPsalmIntroduction && isArabicBibleLanguage(previewLanguage) && arabicItalicStyle(),
                      // Coptic in italic is its own face, drawn upright.
                      isPsalmIntroduction && previewLanguage === 'coptic' && styles.versePreviewCopticItalic,
                    ]}
                  >
                    {verse[previewLanguage]}
                  </Text>
                </Pressable>
              </Fragment>
            );
          })}
        </ScrollView>
      )}
    </ReaderPanel>
  );
}

/** The panel's rows and controls in the page's colours (readerPanelParts.ts). */
function createStyles(theme: DocumentTheme) {
  const { colors } = theme;
  const panel = readerPanelColors(theme);
  return StyleSheet.create({
    chapterRow: {
      alignItems: 'center',
      backgroundColor: panel.washSoft,
      borderRadius: 14,
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
      marginHorizontal: 20,
      padding: 5,
    },
    chapterRowCompact: { marginBottom: 8, marginLeft: 18, marginRight: 4 },
    chapterArrow: { alignItems: 'center', borderRadius: 999, height: 38, justifyContent: 'center', width: 38 },
    chapterArrowDisabled: { opacity: 0.35 },
    chapterName: { color: panel.ink, flex: 1, fontFamily: TYPOGRAPHY.title, fontSize: 16, fontWeight: '700', textAlign: 'center' },
    chapterCount: { color: panel.faint, fontFamily: TYPOGRAPHY.body, fontSize: 13, fontWeight: '500' },
    arabicText: { fontFamily: TYPOGRAPHY.arabic, writingDirection: 'rtl' },
    chipsScroller: { flexGrow: 0 },
    chips: { gap: 6, paddingBottom: 14, paddingHorizontal: 20 },
    chipsCompact: { paddingBottom: 8, paddingLeft: 18, paddingRight: 4 },
    chip: { alignItems: 'center', backgroundColor: panel.wash, borderRadius: 999, height: 32, justifyContent: 'center', paddingHorizontal: 13 },
    chipOn: { backgroundColor: panel.voice },
    chipText: { color: panel.ink, fontFamily: TYPOGRAPHY.body, fontSize: 13.5, fontWeight: '600' },
    chipTextOn: { color: colors.page },
    list: { flex: 1 },
    listContent: { gap: 2, paddingBottom: 8, paddingHorizontal: 12 },
    listContentCompact: { paddingLeft: 10, paddingRight: 0 },
    psalmStanzaDivider: { alignItems: 'center', flexDirection: 'row', gap: 8, marginVertical: 6, paddingHorizontal: 10 },
    psalmStanzaLine: { backgroundColor: colors.accentLine, flex: 1, height: 1 },
    psalmStanzaLabel: { alignItems: 'center', flexDirection: 'row', gap: 4 },
    psalmStanzaLetter: { color: colors.accent, fontFamily: 'Arial', fontSize: 21, fontWeight: '700', lineHeight: 28, textAlign: 'center' },
    psalmStanzaNumber: { color: colors.accent, fontFamily: TYPOGRAPHY.title, fontSize: 13, fontWeight: '700', textAlign: 'left', writingDirection: 'ltr' },
    psalmStanzaNumberArabic: { fontFamily: TYPOGRAPHY.arabic },
    verseRow: {
      borderColor: 'transparent',
      borderRadius: 12,
      borderWidth: 1.5,
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 8.5,
      paddingVertical: 7.5,
    },
    verseRowPressed: { backgroundColor: panel.washSoft },
    // The verse the reader is at: outlined in the page's gold.
    verseRowHere: { backgroundColor: panel.hereSoft, borderColor: panel.here },
    numberCell: { alignItems: 'flex-end', width: 22 },
    verseNumber: { color: colors.accent, fontFamily: TYPOGRAPHY.title, fontSize: 14.5, fontWeight: '700', lineHeight: 20 },
    // "Highlighted verses keep their colour on the number."
    verseNumberHighlighted: {
      borderRadius: 6,
      color: panel.ink,
      fontSize: 13,
      height: 22,
      lineHeight: 22,
      overflow: 'hidden',
      textAlign: 'center',
      width: 22,
    },
    // The same colours the chapter itself marks these verses in.
    verseNumberLxx: { color: colors.priest },
    verseNumberIntro: { color: colors.refrain },
    versePreview: { color: panel.ink, flex: 1, fontFamily: TYPOGRAPHY.title, fontSize: 14.5, lineHeight: 20 },
    versePreviewArabic: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'right', writingDirection: 'rtl' },
    versePreviewCoptic: { fontFamily: TYPOGRAPHY.coptic },
    versePreviewCopticItalic: { fontFamily: TYPOGRAPHY.copticItalic, fontStyle: 'normal' },
    versePreviewIntro: { color: colors.refrain, fontStyle: 'italic' },
  });
}
