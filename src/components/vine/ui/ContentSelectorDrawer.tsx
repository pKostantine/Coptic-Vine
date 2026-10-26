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
 * An hour opening that marks where one part of a service gives way to the
 * next: the Midnight Hour's three Watches, and the Agpeya hours prayed inside
 * the Offering of the Lamb ("3rd Hour", "3rd Hour and 6th Hour", "12th Hour
 * and Veil"...).
 *
 * Whether one of these reads as a divider is decided by whether it has a title
 * at all, and that is per-schema: agpeya.hymn_titles leaves the hour openings
 * null, so inside the Agpeya book they stay silent, while liturgy.hymn_titles
 * names them, so inside the Liturgy they announce the hour. An untitled
 * section never reaches this code — `listable` has already dropped it — so the
 * same hymn divides the Offering of the Lamb without touching the Hour it also
 * belongs to.
 *
 * The `(?!Of|To)` is what separates a divider from ordinary content that
 * happens to be named the same way: introductionOfEveryHour is a real prayer
 * (and titled, in agpeya), and introductionToTheCreed, introductionToTheHoosP1
 * and introductionToRaisingOfIncenseP1 are all lead-ins to a hymn rather than
 * headings over a section.
 */
const SECTION_DIVIDER_KEY = /^introduction(?!Of|To)[A-Za-z]*(?:Hour|Watch|Veil)$/;

function isDividerSection(section: DocumentSection): boolean {
  return SECTION_DIVIDER_KEY.test(section.hymnKey || '');
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

  /**
   * Everything a divider gathers under it, by section id.
   *
   * A nest opens on a divider that actually speaks — one whose hymn key has
   * the shape AND a title in this document's schema, since the same hour
   * opening is titled in liturgy.hymn_titles and null in agpeya.hymn_titles.
   * That matters: an untitled opening never renders a rule, so it must not
   * silently indent the rest of the Hour behind an invisible heading.
   *
   * It closes on the next `introduction…` row of any kind, whether or not that
   * row is itself visible. In the Offering of the Lamb that is
   * introductionToTheCreed, which carries no title and so never appears in
   * this list — but it is still the point where the Agpeya hours end and the
   * Liturgy resumes, so the Creed and everything after it sit back at the
   * outer level. The Midnight Hour ends its third Watch on the same row.
   *
   * Walked over `sections` rather than `listable` so those invisible
   * boundaries still count.
   */
  const dividerOwners = useMemo(() => {
    const owners = new Map<string, string>();
    let openDividerId: string | null = null;
    for (const section of sections) {
      if (/^introduction/i.test(section.hymnKey || '')) {
        const selectorTitle = getSectionSelectorTitle(section);
        const speaks = isDividerSection(section) && Boolean(selectorTitle.english || selectorTitle.arabic);
        openDividerId = speaks ? section.id : null;
        continue;
      }
      if (openDividerId) owners.set(section.id, openDividerId);
    }
    return owners;
  }, [sections]);

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

  // Headings worth a fold control: one that gathers nothing listable has
  // nothing to hide, which is what the last heading in a document can come to
  // once conditions have had their say. Computed over `listable`, not the
  // folded view, or a heading would lose its control the moment it was used.
  const foldableDividerIds = useMemo(() => {
    const foldable = new Set<string>();
    for (const section of listable) {
      const ownerId = dividerOwners.get(section.id);
      if (ownerId) foldable.add(ownerId);
    }
    return foldable;
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
  const [itemLayouts, setItemLayouts] = useState<Record<string, number>>({});

  // Keep the panel scrolled to wherever the user currently is in the
  // document — on open, and any time that position changes while the panel
  // is already open (e.g. it was left open while swiping through slides).
  useEffect(() => {
    if (!visible || !highlightedSectionId || searching) return;
    const y = itemLayouts[highlightedSectionId];
    if (y === undefined) return;
    scrollViewRef.current?.scrollTo({ y: Math.max(y - 12, 0), animated: false });
  }, [visible, highlightedSectionId, itemLayouts, searching]);

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
      {(layout) => (
        <ScrollView ref={scrollViewRef} style={styles.list} contentContainerStyle={[styles.listContent, layout.compact && styles.listContentCompact]} keyboardShouldPersistTaps="handled">
          {searching && !visibleListable.length ? <Text style={styles.noMatches}>{text.noMatches}</Text> : null}
          {visibleListable.map((section, listIndex) => {
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
            // An hour opening renders as a rule across the list: it marks
            // where one part of the service ends and the next begins, so it
            // should read as a seam rather than as one more hymn sitting
            // between them. Still tappable — jumping to the top of an hour is
            // exactly what someone scanning for one wants.
            const isDivider = isDividerSection(section);
            // Sits under the divider above it (not while searching: matches
            // are listed flat). The rule that brackets the group is drawn by
            // the wrapper below, not by the row.
            const isNested = !searching && dividerOwners.has(section.id);
            const isLastNested = isNested && !dividerOwners.has(visibleListable[listIndex + 1]?.id ?? '');
            const isHere = section.id === highlightedSectionId;
            // What has been read is dimmed, but not the choice of
            // interpretations: it is a button that works from here whatever
            // has been read, as the Up next cards are, and never dim.
            const isPast = places[section.id] === 'past' && !isHere && !isChoice;
            const foldableDividerId = !searching && isDivider && foldableDividerIds.has(section.id) ? section.id : null;
            const isFolded = Boolean(foldableDividerId && foldedDividerIds[foldableDividerId]);

            const row = (
              <Pressable
                key={section.id}
                accessibilityRole="button"
                accessibilityState={isHere ? { selected: true } : undefined}
                style={({ pressed }) => [
                  styles.row,
                  layout.compact && styles.rowCompact,
                  isDivider && styles.dividerItem,
                  !isDivider && isSubdocument && styles.rowSubdocument,
                  !isDivider && isHyperlink && styles.rowHyperlink,
                  !isDivider && isChoice && styles.rowChoice,
                  !isDivider && isHere && styles.rowHere,
                  isPast && styles.rowPast,
                  pressed && !isHere && styles.rowPressed,
                ]}
                // A nested row's own y is measured inside its wrapper, so the
                // wrapper reports position instead — itemLayouts feeds
                // scrollTo, which needs an offset within the ScrollView.
                onLayout={isNested ? undefined : recordLayout}
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
                  <View style={styles.dividerRow}>
                    <View style={styles.dividerRule} />
                    <View style={styles.dividerLabelGroup}>
                      <Text style={[styles.dividerLabel, pickedTitle.arabic && styles.dividerLabelArabic]}>{pickedTitle.text}</Text>
                      {foldableDividerId ? (
                        <Icon name={isFolded ? 'chevron-forward' : 'chevron-down'} size={14} color={theme.colors.accent} />
                      ) : null}
                    </View>
                    <View style={styles.dividerRule} />
                  </View>
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

            if (!isNested) return row;

            // One segment of the rule bracketing the group. The gap below the
            // row is this wrapper's padding rather than the row's margin, so
            // the border runs through it and consecutive segments meet — one
            // unbroken line down the group instead of a dash beside each row.
            // The last segment drops that padding so the line stops with the
            // group rather than trailing past it.
            return (
              <View key={section.id} style={[styles.nestedSegment, isLastNested && styles.nestedSegmentLast]} onLayout={recordLayout}>
                {row}
              </View>
            );
          })}
        </ScrollView>
      )}
    </ReaderPanel>
  );
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
    nestedSegment: {
      borderLeftColor: colors.accentLine,
      borderLeftWidth: 2,
      marginLeft: 10,
      paddingBottom: 2,
      paddingLeft: 8,
    },
    // The group's rail ends flush with its final row.
    nestedSegmentLast: { marginBottom: 2, paddingBottom: 0 },
    dividerItem: {
      backgroundColor: 'transparent',
      borderWidth: 0,
      marginTop: 10,
      minHeight: 0,
      paddingHorizontal: 0,
      paddingVertical: 6,
    },
    dividerRow: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 8 },
    dividerRule: { backgroundColor: colors.accentLine, flex: 1, height: 1 },
    dividerLabelGroup: { alignItems: 'center', flexDirection: 'row', gap: 4 },
    dividerLabel: {
      color: colors.accent,
      fontFamily: TYPOGRAPHY.body,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.3,
      textTransform: 'uppercase',
    },
    dividerLabelArabic: {
      fontFamily: TYPOGRAPHY.arabic,
      fontSize: 14,
      letterSpacing: 0,
      // Arabic has no upper case for textTransform to reach.
      textTransform: 'none',
    },
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
