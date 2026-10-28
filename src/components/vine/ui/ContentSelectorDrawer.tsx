import { useEffect, useMemo, useRef, useState } from 'react';
import { type LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { documentSelectorColors } from '../../../constants/documentSelectorColors';
import { NIGHT_DOCUMENT_THEME, withAlpha, type DocumentTheme } from '../../../constants/documentThemes';
import { COLORS, TYPOGRAPHY } from '../../../constants/theme';
import { DOCUMENT_TITLE_SECTION_ID } from '../../../utils/documentOrnaments';
import type { AppLanguage } from '../../../utils/preferencesStorage';
import { DocumentSection } from '../documentHtml';
import { getSectionSelectorTitle } from '../sectionSelectorTitle';
import Icon from './Icon';
import { VineRule } from './Ornaments';
import ReaderPanel, { type ReaderPanelAction } from './ReaderPanel';
import {
  pickRowText,
  readerPanelColors,
  readerPanelText,
  rowMatchesSearch,
  rowPlaces,
  sectionRowParts,
  trailingHyperlinkIds,
} from './readerPanelParts';
import { arabicItalicStyle } from '../../../utils/arabicItalic';
import { gatherUnderDividers, isDividerSection } from '../../../utils/sectionDividers';

interface ContentSelectorDrawerProps {
  visible: boolean;
  sections: DocumentSection[];
  currentSectionId?: string | null;
  onClose: () => void;
  onSelectSection: (id: string) => void;
  /** Called instead of onSelectSection for a Hyperlink row — it leaves this document for another service rather than jumping within it. */
  onOpenHyperlink?: (hyperlinkKey?: string | null) => void;
  /** Called instead of onSelectSection for the interpretations' choice row: it opens the choice, as its button in the document does. */
  onOpenInterpretations?: () => void;
  bookmarked?: boolean;
  onToggleBookmark?: () => void;
  onOpenCalendar?: () => void;
  onOpenSettings?: () => void;
  bishopPresent?: boolean;
  onToggleBishopPresent?: () => void;
  /** When false, sections titled Silent Prayer are excluded from the list, matching their hidden state in the document itself. */
  displaySilentPrayers?: boolean;
  /** Current on/off state of the in-document "Coptic Gospel Rite" toggle — sections only visible in one state (e.g. "Coptic Psalm") are excluded from the list otherwise, matching their hidden state in the document itself. */
  copticGospelRite?: boolean;
  /** Drives which single language each list entry's title shows — falls back to whichever language has text when the selected one is missing. */
  appLanguage?: AppLanguage;
  /** The page the document is read on (constants/documentThemes.ts): the drawer is drawn in its colours, so it opens as part of that page. */
  theme?: DocumentTheme;
  /** The document's own name, heading the panel under "Contents". */
  title?: { english: string; arabic: string; french?: string } | null;
  /** The share of the panel a finger has already brought in (ReaderPanel's openFrom). */
  openFrom?: number;
  /** Once the panel is up on the screen. */
  onShown?: () => void;
}

/**
 * The service's Contents (ReaderPanel.tsx): where the reader is in gold, what
 * they have read dimmed, what opens a sub-document in the panel's voice, each
 * reading with its citation after it; a search to find a section by name; and
 * the service that comes next as the list's last card. Bishop present is
 * pinned at its foot, and the bookmark, calendar and settings sit beside its
 * title.
 */
export default function ContentSelectorDrawer({
  visible,
  sections,
  currentSectionId,
  onClose,
  onSelectSection,
  onOpenHyperlink,
  onOpenInterpretations,
  bookmarked,
  onToggleBookmark,
  onOpenCalendar,
  onOpenSettings,
  bishopPresent,
  onToggleBishopPresent,
  displaySilentPrayers = false,
  copticGospelRite = false,
  appLanguage = 'en',
  theme = NIGHT_DOCUMENT_THEME,
  title,
  openFrom,
  onShown,
}: ContentSelectorDrawerProps) {
  const styles = useMemo(() => createStyles(theme), [theme]);
  const panelColors = useMemo(() => readerPanelColors(theme), [theme]);
  const text = readerPanelText(appLanguage);
  const [query, setQuery] = useState('');
  const searching = query.trim().length > 0;

  // A search is for this opening of the list: closing it clears the field.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (!visible) setQuery('');
  }

  const listable = sections.filter((section) => {
    // "Our Father" always has a title but should never clutter the jump-to list.
    if (section.hymnKey === 'ourFather') return false;
    // Nor the service's own name, which heads the document in its headpiece.
    if (section.id === DOCUMENT_TITLE_SECTION_ID) return false;
    // A section hidden from the document because Silent Prayers are disabled
    // shouldn't still be jumpable from the content list.
    if (!displaySilentPrayers && section.titlePrayerType === 'Silent Prayer') return false;
    // Same for a section hidden by the current Bishop Present state.
    if (section.bishopOnly && !bishopPresent) return false;
    if (section.priestOnly && bishopPresent) return false;
    // Same for a section (e.g. "Coptic Psalm") only visible in one state of
    // the in-document Coptic Gospel Rite toggle.
    if (section.copticGospelRiteOnly && !copticGospelRite) return false;
    if (section.nonCopticGospelRiteOnly && copticGospelRite) return false;
    // Subdocument/Antiphonary buttons are a real UI action, not hymn text —
    // they must survive even though they carry no verses.
    if (section.isSubdocumentButton || section.isAntiphonaryButton) return true;
    // Same for a Hyperlink: it carries no verses either, and it is the one way
    // to reach the next service from here without backing all the way out.
    if (section.isHyperlinkButton) return true;
    // And the button that opens the choice of interpretations.
    if (section.isInterpretationChooserButton) return true;
    const selectorTitle = getSectionSelectorTitle(section);
    return Boolean(selectorTitle.english || selectorTitle.arabic);
  });

  // Everything a divider gathers under it, by section id (sectionDividers.ts).
  const dividerOwners = useMemo(
    () => gatherUnderDividers(sections, (section) => {
      const selectorTitle = getSectionSelectorTitle(section);
      return Boolean(selectorTitle.english || selectorTitle.arabic);
    }),
    [sections],
  );

  /**
   * Which hour headings are folded shut. Purely a way of decluttering this
   * list — folding one hides its hymns from the list and nothing else. The
   * document and slideshow mode are untouched: every hymn is still there, in
   * order, exactly as it was.
   *
   * Deliberately not persisted and not the document's own minimization: it is
   * a view of this list, held for as long as the document is open, not a
   * property of the service.
   */
  const [foldedDividerIds, setFoldedDividerIds] = useState<Record<string, boolean>>({});
  const toggleDividerFold = (dividerId: string) =>
    setFoldedDividerIds((current) => ({ ...current, [dividerId]: !current[dividerId] }));

  // How many listed hymns each heading gathers, which a folded heading shows.
  // Only a heading here has a fold control: one that gathers nothing listable
  // has nothing to hide, which is what the last heading in a document can
  // come to once conditions have had their say. Computed over `listable`, not
  // the folded view, or a heading would lose its control the moment it was used.
  const gatheredCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const section of listable) {
      const ownerId = dividerOwners.get(section.id);
      if (ownerId) counts.set(ownerId, (counts.get(ownerId) ?? 0) + 1);
    }
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- listable is rebuilt from props on every render
  }, [sections, dividerOwners, displaySilentPrayers, bishopPresent, copticGospelRite]);

  // A search lists every section that answers it, flat: a fold or a heading
  // is no reason to hide a match.
  const visibleListable = useMemo(
    () => (searching
      ? listable.filter((section) => rowMatchesSearch(sectionRowParts(section), query))
      : listable.filter((section) => !foldedDividerIds[dividerOwners.get(section.id) ?? ''])),
    [listable, dividerOwners, foldedDividerIds, searching, query],
  );

  // The service the list ends on: its last rows, when they leave for another, are its Up next cards.
  const upNextIds = useMemo(() => trailingHyperlinkIds(listable), [listable]);

  // The document's currentSectionId can land on a titleless hymn (e.g. an
  // inline-spliced continuation) that never made it into `listable` — in
  // that case, highlight/scroll to the nearest surrounding entry that did:
  // the previous listable section if there is one, otherwise the next.
  const resolvedCurrentSectionId = useMemo(() => {
    if (!currentSectionId) return null;
    if (listable.some((section) => section.id === currentSectionId)) return currentSectionId;
    const index = sections.findIndex((section) => section.id === currentSectionId);
    if (index < 0) return null;
    for (let i = index - 1; i >= 0; i -= 1) {
      if (listable.some((section) => section.id === sections[i].id)) return sections[i].id;
    }
    for (let i = index + 1; i < sections.length; i += 1) {
      if (listable.some((section) => section.id === sections[i].id)) return sections[i].id;
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSectionId, sections]);

  // Whatever the list should scroll to and mark as "you are here". When the
  // hymn the reader is on has been folded away, its hour heading stands in for
  // it — the row is gone from the list, but where they are has not changed.
  const highlightedSectionId = useMemo(() => {
    if (!resolvedCurrentSectionId) return null;
    const ownerId = dividerOwners.get(resolvedCurrentSectionId);
    return ownerId && foldedDividerIds[ownerId] ? ownerId : resolvedCurrentSectionId;
  }, [resolvedCurrentSectionId, dividerOwners, foldedDividerIds]);

  // Read already, here, or still to come — over the whole service, so a
  // search's matches keep their place in it.
  const places = useMemo(
    () => rowPlaces(listable.map((section) => section.id), resolvedCurrentSectionId),
    [listable, resolvedCurrentSectionId],
  );

  const scrollViewRef = useRef<ScrollView>(null);
  // Each row's y: in the list, or for a row gathered under a heading, in its
  // group's card, whose own y is kept by heading id.
  const [itemLayouts, setItemLayouts] = useState<Record<string, number>>({});
  const [groupLayouts, setGroupLayouts] = useState<Record<string, number>>({});

  // Keep the panel scrolled to wherever the user currently is in the
  // document — on open, and any time that position changes while the panel
  // is already open (e.g. it was left open while swiping through slides).
  useEffect(() => {
    if (!visible || !highlightedSectionId || searching) return;
    const ownerId = dividerOwners.get(highlightedSectionId);
    const groupY = ownerId ? groupLayouts[ownerId] : 0;
    const y = itemLayouts[highlightedSectionId];
    if (y === undefined || groupY === undefined) return;
    scrollViewRef.current?.scrollTo({ y: Math.max(groupY + y - 12, 0), animated: false });
  }, [visible, highlightedSectionId, itemLayouts, groupLayouts, dividerOwners, searching]);

  const recordGroupLayout = (headingId: string) => (event: LayoutChangeEvent) => {
    const y = event.nativeEvent.layout.y;
    setGroupLayouts((current) => (current[headingId] === y ? current : { ...current, [headingId]: y }));
  };

  const documentTitle = pickRowText(title ?? null, appLanguage);

  const actions: ReaderPanelAction[] = [];
  if (onToggleBookmark) {
    actions.push({ icon: bookmarked ? 'bookmark' : 'bookmark-outline', accessibilityLabel: 'Bookmark hymn', onPress: onToggleBookmark });
  }
  if (onOpenCalendar) {
    actions.push({ icon: 'calendar-outline', accessibilityLabel: 'Open calendar', onPress: () => { onClose(); onOpenCalendar(); } });
  }
  if (onOpenSettings) {
    actions.push({ icon: 'settings-outline', accessibilityLabel: 'Open settings', onPress: () => { onClose(); onOpenSettings(); } });
  }

  const openRow = (section: DocumentSection) => {
    // Closed first so the panel isn't still sitting over the destination as
    // it comes in. The jump-within-document path keeps its original order.
    if (section.isHyperlinkButton) {
      onClose();
      onOpenHyperlink?.(section.hyperlinkKey);
      return;
    }
    if (section.isInterpretationChooserButton) {
      onClose();
      onOpenInterpretations?.();
      return;
    }
    onSelectSection(section.id);
    onClose();
  };

  return (
    <ReaderPanel
      visible={visible}
      onClose={onClose}
      closeAccessibilityLabel="Close selector"
      eyebrow={text.contents}
      title={documentTitle.text}
      titleArabic={documentTitle.arabic}
      actions={actions}
      theme={theme}
      openFrom={openFrom}
      onShown={onShown}
      top={(layout) => (
        <View style={[styles.search, layout.compact && styles.searchCompact]}>
          <Icon name="search-outline" size={layout.compact ? 15 : 17} color={panelColors.voice} />
          <TextInput
            accessibilityLabel={text.findSection}
            value={query}
            onChangeText={setQuery}
            placeholder={text.findSection}
            placeholderTextColor={panelColors.quiet}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            style={[styles.searchInput, appLanguage === 'ar' && styles.searchInputArabic]}
          />
          {searching ? (
            <Pressable accessibilityRole="button" accessibilityLabel={text.clearSearch} hitSlop={8} onPress={() => setQuery('')}>
              <Icon name="close-circle" size={17} color={panelColors.quiet} />
            </Pressable>
          ) : null}
        </View>
      )}
      footer={onToggleBishopPresent ? (
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: Boolean(bishopPresent) }}
          accessibilityLabel="Toggle bishop present"
          style={styles.toggleRow}
          onPress={onToggleBishopPresent}
        >
          <Text style={[styles.toggleText, appLanguage === 'ar' && styles.toggleTextArabic]}>{text.bishopPresent}</Text>
          <View style={[styles.switch, bishopPresent && styles.switchOn]}>
            <View style={[styles.switchThumb, bishopPresent && styles.switchThumbOn]} />
          </View>
        </Pressable>
      ) : undefined}
    >
      {(layout) => {
          const renderRow = (section: DocumentSection) => {
            const recordLayout = (event: LayoutChangeEvent) => {
              const y = event.nativeEvent.layout.y;
              setItemLayouts((current) => (current[section.id] === y ? current : { ...current, [section.id]: y }));
            };

            // The service that comes next: a card closing the list, in the
            // colour of the button that leaves for another service.
            if (upNextIds.has(section.id)) {
              const destination = pickRowText(getSectionSelectorTitle(section), appLanguage);
              return (
                <Pressable
                  key={section.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${text.upNext}: ${destination.text}`}
                  style={({ pressed }) => [styles.upNext, pressed && styles.upNextPressed]}
                  onLayout={recordLayout}
                  onPress={() => openRow(section)}
                >
                  <View style={styles.upNextText}>
                    <Text style={[styles.upNextLabel, appLanguage === 'ar' && styles.upNextLabelArabic]}>{text.upNext}</Text>
                    <Text style={[styles.upNextTitle, destination.arabic && styles.titleArabic]} numberOfLines={2}>{destination.text}</Text>
                  </View>
                  <Icon name="arrow-forward" size={20} color={panelColors.onNext} />
                </Pressable>
              );
            }

            // A list entry always shows exactly one language, driven by the
            // App Language setting — falling back to whichever language
            // actually has text for this specific section if the selected one
            // doesn't.
            const parts = sectionRowParts(section);
            const pickedTitle = pickRowText(parts.title, appLanguage);
            const pickedCitation = pickRowText(parts.citation, appLanguage);
            // A hymn whose own title row declares "Silent Prayer" reads
            // visually distinct in the selector too — dimmer/italic, since
            // none of its content is spoken aloud.
            const isSilentPrayerHymn = section.titlePrayerType === 'Silent Prayer';
            // A Hyperlink row in the middle of a service is a way out of it,
            // not a place within it: the green of its button, with an arrow.
            const isHyperlink = Boolean(section.isHyperlinkButton);
            // Subdocuments and the Antiphonary open ON this document rather
            // than leaving it: the panel's voice, and a soft fill.
            const isSubdocument = Boolean(section.isSubdocumentButton || section.isAntiphonaryButton);
            // The choice of interpretations: violet, as its button in the
            // document is -- it changes what this service shows rather than
            // being a place in it.
            const isChoice = Boolean(section.isInterpretationChooserButton);
            // A heading (sectionDividers.ts) is set as the book pages set a
            // section's name: in the title face, the vine run out beside it,
            // with the hymns it gathers on a card below. It marks where one
            // part of the service ends and the next begins, so it reads as a
            // heading rather than as one more hymn between them.
            const isDivider = isDividerSection(section);
            const isHere = section.id === highlightedSectionId;
            // What has been read is dimmed, but not the choice of
            // interpretations: it is a button that works from here whatever
            // has been read, as the Up next cards are, and never dim.
            const isPast = places[section.id] === 'past' && !isHere && !isChoice;
            const foldableDividerId = !searching && isDivider && gatheredCounts.has(section.id) ? section.id : null;
            const isFolded = Boolean(foldableDividerId && foldedDividerIds[foldableDividerId]);

            const row = (
              <Pressable
                key={section.id}
                accessibilityRole="button"
                accessibilityState={isHere ? { selected: true } : undefined}
                style={({ pressed }) => [
                  styles.row,
                  layout.compact && styles.rowCompact,
                  isDivider && styles.headingItem,
                  isDivider && layout.compact && styles.headingItemCompact,
                  isFolded && styles.headingItemFolded,
                  !isDivider && isSubdocument && styles.rowSubdocument,
                  !isDivider && isHyperlink && styles.rowHyperlink,
                  !isDivider && isChoice && styles.rowChoice,
                  !isDivider && isHere && styles.rowHere,
                  isPast && styles.rowPast,
                  pressed && !isHere && styles.rowPressed,
                ]}
                onLayout={recordLayout}
                accessibilityLabel={
                  foldableDividerId
                    ? `${isFolded ? 'Show' : 'Hide'} the hymns under ${parts.title.english || parts.title.arabic}`
                    : undefined
                }
                onPress={() => {
                  // A heading with hymns under it folds the list instead of
                  // jumping. The panel stays open -- folding is something you
                  // do TO this list, so closing it would hide the result. The
                  // first row under a heading is the start of that hour
                  // anyway, one row away.
                  if (foldableDividerId) {
                    toggleDividerFold(foldableDividerId);
                    return;
                  }
                  openRow(section);
                }}
              >
                {isDivider ? (
                  <>
                    <Text
                      style={[
                        styles.headingTitle,
                        layout.compact && styles.headingTitleCompact,
                        pickedTitle.arabic && styles.headingTitleArabic,
                        isHere && styles.headingTitleHere,
                      ]}
                      accessibilityRole="header"
                      numberOfLines={2}
                    >
                      {pickedTitle.text}
                    </Text>
                    <VineRule height={layout.compact ? 13 : 15} />
                    {/* Folded, it says how much it holds. */}
                    {isFolded ? <Text style={styles.headingCount}>{gatheredCounts.get(section.id)}</Text> : null}
                    {foldableDividerId ? (
                      <Icon name={isFolded ? 'chevron-forward' : 'chevron-down'} size={16} color={panelColors.here} />
                    ) : null}
                  </>
                ) : (
                  <Text
                    style={[
                      styles.title,
                      layout.compact && styles.titleCompact,
                      pickedTitle.arabic && styles.titleArabic,
                      isSubdocument && styles.titleSubdocument,
                      isHyperlink && styles.titleHyperlink,
                      isChoice && styles.titleChoice,
                      isSilentPrayerHymn && styles.titleSilentPrayer,
                      isSilentPrayerHymn && pickedTitle.arabic && arabicItalicStyle(),
                      isHere && styles.titleHere,
                    ]}
                  >
                    {pickedTitle.text}
                    {pickedCitation.text ? (
                      <Text style={[styles.citation, pickedCitation.arabic && styles.citationArabic]}>{`  ${pickedCitation.text}`}</Text>
                    ) : null}
                  </Text>
                )}
                {isHyperlink && !isDivider ? <Icon name="arrow-forward" size={16} color={theme.colors.link} /> : null}
                {isChoice && !isDivider ? <Icon name="checkmark-done" size={17} color={theme.colors.choice} /> : null}
              </Pressable>
            );

            return row;
          };

          return (
            <ScrollView ref={scrollViewRef} style={styles.list} contentContainerStyle={[styles.listContent, layout.compact && styles.listContentCompact]} keyboardShouldPersistTaps="handled">
              {searching && !visibleListable.length ? <Text style={styles.noMatches}>{text.noMatches}</Text> : null}
              {/* A heading's hymns share one card under it (not while
                  searching: matches are listed flat). */}
              {groupUnderHeadings(visibleListable, (section) => (searching || upNextIds.has(section.id) ? undefined : dividerOwners.get(section.id))).map((entry) => (
                entry.headingId ? (
                  <View key={`group-${entry.headingId}`} style={styles.group} onLayout={recordGroupLayout(entry.headingId)}>
                    {entry.sections.map(renderRow)}
                  </View>
                ) : renderRow(entry.sections[0])
              ))}
            </ScrollView>
          );
        }}
    </ReaderPanel>
  );
}

/** The list in runs: the rows one heading gathers together, for their card, and every other row alone. */
function groupUnderHeadings(sections: DocumentSection[], headingOf: (section: DocumentSection) => string | undefined) {
  const entries: { headingId?: string; sections: DocumentSection[] }[] = [];
  for (const section of sections) {
    const headingId = headingOf(section);
    const last = entries[entries.length - 1];
    if (headingId && last?.headingId === headingId) last.sections.push(section);
    else entries.push({ headingId, sections: [section] });
  }
  return entries;
}

/**
 * The list in the colours of the page it opens over (readerPanelParts.ts):
 * plain rows of the page's ink; the reader's place in its gold; a
 * sub-document in the panel's voice, a way out in the green of the button
 * that leaves, a choice in its violet.
 */
function createStyles(theme: DocumentTheme) {
  const { colors } = theme;
  const panel = readerPanelColors(theme);
  const drawer = documentSelectorColors(theme);
  return StyleSheet.create({
    search: {
      alignItems: 'center',
      backgroundColor: panel.wash,
      borderRadius: 12,
      flexDirection: 'row',
      gap: 9,
      height: 42,
      marginBottom: 10,
      marginHorizontal: 20,
      paddingHorizontal: 14,
    },
    searchCompact: { height: 36, marginLeft: 18, marginRight: 4 },
    searchInput: {
      color: panel.ink,
      flex: 1,
      fontFamily: TYPOGRAPHY.body,
      fontSize: 14.5,
      minWidth: 0,
      paddingVertical: 0,
    },
    searchInputArabic: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'right', writingDirection: 'rtl' },
    list: { flex: 1 },
    listContent: { gap: 2, paddingBottom: 8, paddingHorizontal: 12 },
    listContentCompact: { paddingLeft: 10, paddingRight: 0 },
    noMatches: { color: panel.quiet, fontFamily: TYPOGRAPHY.body, fontSize: 14.5, paddingHorizontal: 14, paddingVertical: 12 },
    row: {
      alignItems: 'center',
      borderColor: 'transparent',
      borderRadius: 12,
      borderWidth: 1.5,
      flexDirection: 'row',
      gap: 10,
      minHeight: 46,
      paddingHorizontal: 12.5,
      paddingVertical: 8,
    },
    rowCompact: { minHeight: 40, paddingVertical: 6 },
    rowPressed: { backgroundColor: panel.washSoft },
    // Read already: the rows above where the reader is, half as present.
    rowPast: { opacity: 0.48 },
    // "Gold = where you are."
    rowHere: { backgroundColor: panel.hereSoft, borderColor: panel.here },
    // "Blue = opens a sub-document": the panel's voice, as the document's own button is.
    rowSubdocument: { backgroundColor: panel.voiceSoft },
    rowHyperlink: { backgroundColor: withAlpha(colors.link, 0.12) },
    rowChoice: { backgroundColor: colors.choiceSoft },
    title: {
      color: panel.ink,
      flex: 1,
      flexShrink: 1,
      fontFamily: TYPOGRAPHY.title,
      fontSize: 16.5,
      lineHeight: 22,
    },
    titleCompact: { fontSize: 15, lineHeight: 20 },
    titleArabic: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'right', writingDirection: 'rtl' },
    titleHere: { color: panel.here, fontWeight: '700' },
    titleSubdocument: { color: panel.voice, fontWeight: '700' },
    titleHyperlink: { color: colors.link, fontWeight: '700' },
    titleChoice: { color: colors.choice, fontWeight: '700' },
    titleSilentPrayer: { color: drawer.quiet, fontStyle: 'italic' },
    // A reading's citation, after its name: smaller, in the body face, muted.
    citation: { color: panel.faint, fontFamily: TYPOGRAPHY.body, fontSize: 13.5, fontStyle: 'normal', fontWeight: '400' },
    citationArabic: { fontFamily: TYPOGRAPHY.arabic },
    // A heading: its name lines up with the rows' names below it.
    headingItem: { marginTop: 14, minHeight: 0, paddingBottom: 4, paddingTop: 6 },
    headingItemCompact: { marginTop: 10 },
    // Folded, it keeps the room its card took, so what follows reads as the
    // service again rather than as the heading's own.
    headingItemFolded: { marginBottom: 10 },
    headingTitle: {
      color: panel.ink,
      flexShrink: 1,
      fontFamily: TYPOGRAPHY.title,
      fontSize: 18,
      fontWeight: '700',
      lineHeight: 23,
      maxWidth: '78%',
    },
    headingTitleCompact: { fontSize: 16, lineHeight: 21 },
    headingTitleArabic: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'left', writingDirection: 'rtl' },
    headingTitleHere: { color: panel.here },
    headingCount: { color: panel.quiet, fontFamily: TYPOGRAPHY.body, fontSize: 13 },
    // What a heading gathers, on one card of the page's wash.
    group: { backgroundColor: panel.washSoft, borderRadius: 16, gap: 2, marginBottom: 6, paddingVertical: 4 },
    upNext: {
      alignItems: 'center',
      backgroundColor: panel.next,
      borderRadius: 14,
      flexDirection: 'row',
      gap: 12,
      marginTop: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    upNextPressed: { opacity: 0.85 },
    upNextText: { flex: 1, minWidth: 0 },
    upNextLabel: {
      color: panel.onNext,
      fontFamily: TYPOGRAPHY.body,
      fontSize: 10.5,
      fontWeight: '800',
      letterSpacing: 1.26,
      opacity: 0.75,
      textTransform: 'uppercase',
    },
    upNextLabelArabic: { fontFamily: TYPOGRAPHY.arabic, fontSize: 12, letterSpacing: 0, textAlign: 'right', writingDirection: 'rtl' },
    upNextTitle: { color: panel.onNext, fontFamily: TYPOGRAPHY.title, fontSize: 17, fontWeight: '700', marginTop: 2 },
    toggleRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 32, paddingHorizontal: 2 },
    toggleText: { color: panel.ink, fontFamily: TYPOGRAPHY.body, fontSize: 15, fontWeight: '600' },
    toggleTextArabic: { fontFamily: TYPOGRAPHY.arabic, writingDirection: 'rtl' },
    switch: { backgroundColor: panel.track, borderRadius: 14, height: 28, justifyContent: 'center', paddingHorizontal: 3, width: 46 },
    switchOn: { backgroundColor: colors.accent },
    // White on every page, as a switch's thumb is: it reads on the gold when
    // on and on the track when off, light page or dark.
    switchThumb: {
      backgroundColor: COLORS.white,
      borderRadius: 11,
      height: 22,
      shadowColor: panel.ink,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 2,
      width: 22,
    },
    switchThumbOn: { alignSelf: 'flex-end' },
  });
}
