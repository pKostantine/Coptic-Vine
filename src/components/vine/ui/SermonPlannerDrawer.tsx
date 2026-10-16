import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { documentSelectorColors } from '@/constants/documentSelectorColors';
import { NIGHT_DOCUMENT_THEME, withAlpha, type DocumentTheme } from '@/constants/documentThemes';
import { COLORS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import type {
  SermonHighlight,
  SermonHighlightColor,
  SermonReadingReference,
} from '@/types/sermonPlanner';
import type { SermonPlanSyncStatus } from '@/hooks/useSermonPlanner';
import type { SermonPlannerVisibleLanguages } from '@/utils/preferencesStorage';
import { MOBILE_WEB_BREAKPOINT } from '@/utils/useIsMobileWeb';
import { motionDuration, useReducedMotion } from '@/utils/useReducedMotion';
import Icon from './Icon';
import { useModalOrientations } from '@/hooks/useModalOrientations';
import { groupHighlights } from '@/utils/highlightGroups';

// Apple Books' five, in its order: yellow, green, blue, pink, purple.
const HIGHLIGHT_COLORS: Record<SermonHighlightColor, string> = {
  gold: '#D7AD2C',
  green: '#4AAA73',
  blue: '#4C9AD8',
  rose: '#D65B75',
  purple: '#9B6DD6',
};

const LANGUAGE_OPTIONS: { key: keyof SermonPlannerVisibleLanguages; label: string }[] = [
  { key: 'english', label: 'English' },
  { key: 'arabic', label: 'Arabic' },
];

interface SermonPlannerDrawerProps {
  visible: boolean;
  references: SermonReadingReference[];
  highlights: SermonHighlight[];
  verseReferences: Record<string, string>;
  generalNotes: string;
  activeHighlightId?: string | null;
  syncStatus: SermonPlanSyncStatus;
  signedIn: boolean;
  visibleLanguages: SermonPlannerVisibleLanguages;
  bookmarked?: boolean;
  onClose: () => void;
  onToggleLanguage: (language: keyof SermonPlannerVisibleLanguages) => void;
  onSelectReference: (reference: SermonReadingReference) => void;
  onJumpToHighlight: (highlight: SermonHighlight) => void;
  onChangeGeneralNotes: (value: string) => void;
  onChangeHighlightNote: (id: string, value: string) => void;
  onChangeHighlightColor: (id: string, color: SermonHighlightColor) => void;
  onDeleteHighlight: (id: string) => void;
  onToggleBookmark?: () => void;
  onOpenCalendar?: () => void;
  onOpenSettings?: () => void;
  /** The page the planner is read on (constants/documentThemes.ts): the drawer is drawn in its colours. */
  theme?: DocumentTheme;
}

/**
 * The planner's colours. On Night it keeps the cool slate it has always had,
 * which is how it tells itself apart from the content list over the same
 * black page. On every other page it takes the content list's colours from
 * that page -- its strip for the bars and cards, its gold, its ink -- so the
 * notes open as part of the page they are written beside.
 */
interface PlannerColors {
  panel: string;
  panelEdge: string;
  bar: string;
  barEdge: string;
  footEdge: string;
  rule: string;
  divider: string;
  /** The title, the counts, a highlight's reference: Night's brighter gold. */
  heading: string;
  text: string;
  muted: string;
  line: string;
  field: string;
  fieldEdge: string;
  note: string;
  noteEdge: string;
  placeholder: string;
  card: string;
  cardEdge: string;
  cardActive: string;
  cardActiveEdge: string;
  accent: string;
  onAccent: string;
  chip: string;
  chipEdge: string;
  iconButton: string;
  iconButtonEdge: string;
  remove: string;
  swatchRing: string;
}

const NIGHT_PLANNER_COLORS: PlannerColors = {
  panel: '#080A0C',
  panelEdge: 'rgba(227, 181, 59, 0.4)',
  bar: '#101316',
  barEdge: 'rgba(227, 181, 59, 0.28)',
  footEdge: 'rgba(227, 181, 59, 0.32)',
  rule: 'rgba(227, 181, 59, 0.18)',
  divider: 'rgba(227, 181, 59, 0.25)',
  heading: COLORS.goldBright,
  text: COLORS.white,
  muted: COLORS.muted,
  line: COLORS.border,
  field: '#11161A',
  fieldEdge: '#2D353C',
  note: '#090C0E',
  noteEdge: '#283038',
  placeholder: '#75818C',
  card: '#101418',
  cardEdge: '#293139',
  cardActive: '#171713',
  cardActiveEdge: COLORS.gold,
  accent: COLORS.gold,
  onAccent: COLORS.black,
  chip: COLORS.surface,
  chipEdge: COLORS.border,
  iconButton: 'rgba(227, 181, 59, 0.06)',
  iconButtonEdge: 'rgba(227, 181, 59, 0.24)',
  remove: '#E88484',
  swatchRing: COLORS.white,
};

function plannerColorsFor(theme: DocumentTheme): PlannerColors {
  if (theme.id === 'night') return NIGHT_PLANNER_COLORS;
  const { colors } = theme;
  const drawer = documentSelectorColors(theme);
  return {
    panel: drawer.panel,
    panelEdge: withAlpha(colors.accent, 0.4),
    bar: colors.strip,
    barEdge: withAlpha(colors.accent, 0.28),
    footEdge: withAlpha(colors.accent, 0.32),
    rule: withAlpha(colors.accent, 0.18),
    divider: withAlpha(colors.accent, 0.25),
    heading: colors.accent,
    text: colors.text,
    muted: drawer.quiet,
    line: colors.border,
    // The outline is written on a field raised like a card; a highlight's
    // note sits back in the drawer's own colour inside its card.
    field: colors.strip,
    fieldEdge: colors.border,
    note: drawer.panel,
    noteEdge: colors.border,
    placeholder: drawer.quiet,
    card: colors.strip,
    cardEdge: colors.border,
    cardActive: colors.stripActive,
    cardActiveEdge: colors.accent,
    accent: colors.accent,
    onAccent: colors.onAccent,
    chip: colors.surface,
    chipEdge: colors.border,
    iconButton: withAlpha(colors.accent, 0.06),
    iconButtonEdge: withAlpha(colors.accent, 0.24),
    // The page's own red, as Night's planner uses a soft red to delete.
    remove: colors.priest,
    swatchRing: colors.text,
  };
}

function syncLabel(status: SermonPlanSyncStatus, signedIn: boolean) {
  if (!signedIn) return 'Saved on this device';
  if (status === 'syncing') return 'Syncing';
  if (status === 'error') return 'Saved locally';
  return 'Synced';
}

function languageLabel(language: SermonHighlight['language']) {
  if (language === 'coptic') return 'Coptic';
  if (language === 'arabic') return 'Arabic';
  return 'English';
}

export default function SermonPlannerDrawer({
  visible,
  references,
  highlights,
  verseReferences,
  generalNotes,
  activeHighlightId,
  syncStatus,
  signedIn,
  visibleLanguages,
  bookmarked,
  onClose,
  onToggleLanguage,
  onSelectReference,
  onJumpToHighlight,
  onChangeGeneralNotes,
  onChangeHighlightNote,
  onChangeHighlightColor,
  onDeleteHighlight,
  onToggleBookmark,
  onOpenCalendar,
  onOpenSettings,
  theme = NIGHT_DOCUMENT_THEME,
}: SermonPlannerDrawerProps) {
  const modalOrientations = useModalOrientations();
  const palette = useMemo(() => plannerColorsFor(theme), [theme]);
  const styles = useMemo(() => createStyles(palette), [palette]);
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const compact = Platform.OS !== 'web' || screenWidth < MOBILE_WEB_BREAKPOINT;
  const panelWidth = compact ? Math.min(screenWidth, Math.round(screenWidth * 0.9)) : Math.min(620, Math.round(screenWidth * 0.52));
  const [slide] = useState(() => new Animated.Value(0));
  const scrollRef = useRef<ScrollView>(null);
  const noteRefs = useRef<Record<string, TextInput | null>>({});
  // A highlight made across several verses is one card.
  const highlightGroups = useMemo(() => groupHighlights(highlights), [highlights]);
  const [highlightLayouts, setHighlightLayouts] = useState<Record<string, number>>({});
  const visibleLanguageCount = Object.values(visibleLanguages).filter(Boolean).length;

  const reduced = useReducedMotion();
  useEffect(() => {
    Animated.timing(slide, {
      toValue: visible ? 0 : 1,
      duration: motionDuration(220, reduced),
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [reduced, slide, visible]);

  useEffect(() => {
    if (!visible || !activeHighlightId) return;
    const timer = setTimeout(() => {
      const y = highlightLayouts[activeHighlightId];
      if (y !== undefined) scrollRef.current?.scrollTo({ y: Math.max(0, y - SPACING.md), animated: true });
      noteRefs.current[activeHighlightId]?.focus();
    }, 260);
    return () => clearTimeout(timer);
  }, [activeHighlightId, highlightLayouts, visible]);

  const openDestination = (callback?: () => void) => {
    onClose();
    callback?.();
  };

  return (
    <Modal
      transparent
      animationType="none"
      visible={visible}
      onRequestClose={onClose}
      supportedOrientations={modalOrientations}
    >
      {/* The drawer runs up under the status bar, so on a light page the
          clock and battery over it turn dark to stay readable. */}
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <Pressable accessibilityLabel="Close sermon notes" style={styles.backdrop} onPress={onClose} />
        <Animated.View
          style={[
            styles.panel,
            {
              width: panelWidth,
              paddingTop: insets.top,
              transform: [{ translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [0, panelWidth] }) }],
            },
          ]}
        >
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Sermon Notes</Text>
              <Text style={styles.saveStatus}>{syncLabel(syncStatus, signedIn)}</Text>
            </View>
            <Pressable accessibilityLabel="Close sermon notes" style={styles.closeButton} onPress={onClose}>
              <Icon name="close" size={22} color={palette.muted} />
            </Pressable>
          </View>

          <View style={styles.languageBar}>
            {LANGUAGE_OPTIONS.map(({ key, label }) => {
              const selected = visibleLanguages[key];
              const isLastVisibleLanguage = selected && visibleLanguageCount === 1;
              return (
                <Pressable
                  accessibilityLabel={label}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isLastVisibleLanguage, selected }}
                  disabled={isLastVisibleLanguage}
                  key={key}
                  onPress={() => onToggleLanguage(key)}
                  style={[
                    styles.languageButton,
                    selected ? styles.languageButtonSelected : styles.languageButtonUnselected,
                  ]}
                >
                  <Text style={[styles.languageText, selected && styles.languageTextSelected]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>

          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.sectionHeadingRow}>
              <Text style={styles.sectionHeading}>Readings</Text>
              <Text style={styles.sectionCount}>{references.length}</Text>
            </View>
            <View style={styles.references}>
              {references.map((reference, index) => (
                <Pressable
                  key={reference.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Go to ${reference.label}`}
                  onPress={() => {
                    onClose();
                    onSelectReference(reference);
                  }}
                  style={({ pressed }) => [styles.referenceRow, pressed && styles.pressed]}
                >
                  <Text style={styles.referenceNumber}>{index + 1}</Text>
                  <Text style={styles.referenceLabel}>{reference.label}</Text>
                  <Icon name="chevron-forward" size={14} color={palette.heading} />
                </Pressable>
              ))}
            </View>

            <View style={styles.divider} />

            <Text style={styles.sectionHeading}>Sermon Outline</Text>
            <TextInput
              accessibilityLabel="Sermon outline"
              multiline
              onChangeText={onChangeGeneralNotes}
              placeholder="Theme, opening, main points, applications, and closing..."
              placeholderTextColor={palette.placeholder}
              selectionColor={palette.accent}
              style={styles.outlineInput}
              textAlignVertical="top"
              value={generalNotes}
            />

            <View style={styles.highlightsHeader}>
              <Text style={styles.sectionHeading}>Highlights</Text>
              <Text style={styles.sectionCount}>{highlightGroups.length}</Text>
            </View>
            {!highlightGroups.length ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyMarker} />
                <Text style={styles.emptyTitle}>No highlights yet</Text>
                <Text style={styles.emptyBody}>Select text to choose a color. With Apple Pencil, draw down the text to highlight it, across as many verses as you like.</Text>
              </View>
            ) : highlightGroups.map(({ lead: highlight, segments }) => {
              // One card for one highlight, however many verses it spans:
              // its first segment carries the note and stands for the rest.
              const isActive = segments.some((segment) => segment.id === activeHighlightId);
              const firstReference = verseReferences[highlight.verseId];
              const lastReference = verseReferences[segments[segments.length - 1].verseId];
              const reference = firstReference && lastReference && lastReference !== firstReference
                ? `${firstReference} – ${lastReference.replace(/^.*?(\d+:\d+)$/, '$1')}`
                : firstReference;
              const quote = segments.map((segment) => segment.quote).join(' ');
              const recordLayout = (event: LayoutChangeEvent) => {
                const y = event.nativeEvent.layout.y;
                setHighlightLayouts((current) => current[highlight.id] === y ? current : { ...current, [highlight.id]: y });
              };
              return (
                <View
                  key={highlight.id}
                  onLayout={recordLayout}
                  style={[styles.highlightCard, isActive && styles.highlightCardActive]}
                >
                  <View style={styles.highlightMetaRow}>
                    <View style={[styles.highlightMarker, highlight.style === 'underline' ? styles.highlightMarkerUnderline : null, { backgroundColor: HIGHLIGHT_COLORS[highlight.color] }]} />
                    <Text style={styles.highlightLanguage}>{languageLabel(highlight.language)}</Text>
                    <View style={styles.highlightActions}>
                      <Pressable
                        accessibilityLabel="Delete highlight"
                        style={styles.iconButton}
                        onPress={() => onDeleteHighlight(highlight.id)}
                      >
                        <Icon name="trash-outline" size={17} color={palette.remove} />
                      </Pressable>
                    </View>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Go to highlighted verse${reference ? `, ${reference}` : ''}`}
                    onPress={() => {
                      onClose();
                      onJumpToHighlight(highlight);
                    }}
                    style={({ pressed }) => pressed && styles.pressed}
                  >
                    {reference ? (
                      <Text style={styles.highlightReference}>{reference}</Text>
                    ) : null}
                    <Text numberOfLines={5} style={styles.quote}>“{quote}”</Text>
                  </Pressable>
                  <View style={styles.colorRow}>
                    {(Object.keys(HIGHLIGHT_COLORS) as SermonHighlightColor[]).map((color) => (
                      <Pressable
                        key={color}
                        accessibilityLabel={`Change highlight to ${color}`}
                        onPress={() => onChangeHighlightColor(highlight.id, color)}
                        style={[
                          styles.colorSwatch,
                          { backgroundColor: HIGHLIGHT_COLORS[color] },
                          highlight.color === color && styles.colorSwatchSelected,
                        ]}
                      />
                    ))}
                  </View>
                  <TextInput
                    ref={(input) => { noteRefs.current[highlight.id] = input; }}
                    accessibilityLabel="Note for highlight"
                    multiline
                    onChangeText={(value) => onChangeHighlightNote(highlight.id, value)}
                    placeholder="Add context, interpretation, or a preaching note..."
                    placeholderTextColor={palette.placeholder}
                    selectionColor={palette.accent}
                    style={styles.highlightNoteInput}
                    textAlignVertical="top"
                    value={highlight.note}
                  />
                </View>
              );
            })}
          </ScrollView>

          <View style={[styles.actionRow, { paddingBottom: Math.max(insets.bottom, SPACING.sm) }]}>
            {onToggleBookmark ? (
              <Pressable accessibilityLabel="Bookmark sermon planner" style={styles.actionButton} onPress={onToggleBookmark}>
                <Icon name={bookmarked ? 'bookmark' : 'bookmark-outline'} size={25} color={palette.accent} />
              </Pressable>
            ) : null}
            {onOpenCalendar ? (
              <Pressable accessibilityLabel="Open calendar" style={styles.actionButton} onPress={() => openDestination(onOpenCalendar)}>
                <Icon name="calendar-outline" size={26} color={palette.accent} />
              </Pressable>
            ) : null}
            {onOpenSettings ? (
              <Pressable accessibilityLabel="Open settings" style={styles.actionButton} onPress={() => openDestination(onOpenSettings)}>
                <Icon name="settings-outline" size={26} color={palette.accent} />
              </Pressable>
            ) : null}
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function createStyles(colors: PlannerColors) {
  return StyleSheet.create({
    overlay: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end' },
    backdrop: { flex: 1 },
    panel: {
      backgroundColor: colors.panel,
      borderLeftColor: colors.panelEdge,
      borderLeftWidth: 1,
    },
    header: {
      alignItems: 'center',
      backgroundColor: colors.bar,
      borderBottomColor: colors.barEdge,
      borderBottomWidth: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      minHeight: 68,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
    },
    headerTitle: { color: colors.heading, fontFamily: TYPOGRAPHY.title, fontSize: 21, fontWeight: '800' },
    saveStatus: { color: colors.muted, fontFamily: TYPOGRAPHY.body, fontSize: 12, marginTop: 2 },
    closeButton: { alignItems: 'center', height: 40, justifyContent: 'center', width: 40 },
    scroll: { flex: 1 },
    scrollContent: { padding: SPACING.md, paddingBottom: SPACING.xl },
    languageBar: {
      borderBottomColor: colors.rule,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: SPACING.xs,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
    },
    languageButton: {
      alignItems: 'center',
      borderRadius: 8,
      borderWidth: 1,
      flex: 1,
      justifyContent: 'center',
      minHeight: 40,
      paddingHorizontal: SPACING.sm,
    },
    languageButtonSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
    languageButtonUnselected: { backgroundColor: colors.chip, borderColor: colors.chipEdge },
    languageText: { color: colors.text, fontFamily: TYPOGRAPHY.title, fontSize: 13, fontWeight: '700' },
    languageTextSelected: { color: colors.onAccent },
    sectionHeadingRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
    sectionHeading: { color: colors.text, fontFamily: TYPOGRAPHY.title, fontSize: 17, fontWeight: '800' },
    sectionCount: { color: colors.heading, fontFamily: TYPOGRAPHY.body, fontSize: 13, fontWeight: '700' },
    references: { borderTopColor: colors.line, borderTopWidth: 1, marginTop: SPACING.sm },
    referenceRow: {
      alignItems: 'center',
      borderBottomColor: colors.line,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: SPACING.sm,
      minHeight: 45,
      paddingVertical: SPACING.sm,
    },
    referenceNumber: { color: colors.accent, fontFamily: TYPOGRAPHY.body, fontSize: 12, fontWeight: '800', width: 20 },
    referenceLabel: { color: colors.text, flex: 1, fontFamily: TYPOGRAPHY.title, fontSize: 15, lineHeight: 20 },
    pressed: { opacity: 0.68 },
    divider: { backgroundColor: colors.divider, height: 1, marginVertical: SPACING.lg },
    outlineInput: {
      backgroundColor: colors.field,
      borderColor: colors.fieldEdge,
      borderRadius: 6,
      borderWidth: 1,
      color: colors.text,
      fontFamily: TYPOGRAPHY.body,
      fontSize: 15,
      lineHeight: 21,
      marginTop: SPACING.sm,
      minHeight: 132,
      padding: SPACING.md,
    },
    highlightsHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACING.lg },
    emptyState: { alignItems: 'center', borderTopColor: colors.line, borderTopWidth: 1, marginTop: SPACING.sm, padding: SPACING.xl },
    emptyMarker: { backgroundColor: HIGHLIGHT_COLORS.gold, borderRadius: 3, height: 8, marginBottom: SPACING.md, opacity: 0.7, width: 68 },
    emptyTitle: { color: colors.text, fontFamily: TYPOGRAPHY.title, fontSize: 16, fontWeight: '800' },
    emptyBody: { color: colors.muted, fontFamily: TYPOGRAPHY.body, fontSize: 14, lineHeight: 20, marginTop: SPACING.sm, textAlign: 'center' },
    highlightCard: {
      backgroundColor: colors.card,
      borderColor: colors.cardEdge,
      borderRadius: 7,
      borderWidth: 1,
      marginTop: SPACING.md,
      padding: SPACING.md,
    },
    highlightCardActive: { borderColor: colors.cardActiveEdge, backgroundColor: colors.cardActive },
    highlightMetaRow: { alignItems: 'center', flexDirection: 'row' },
    highlightMarker: { borderRadius: 3, height: 8, marginRight: SPACING.sm, width: 38 },
    // An underlined highlight is shown as its line.
    highlightMarkerUnderline: { borderRadius: 2, height: 3 },
    highlightLanguage: { color: colors.muted, flex: 1, fontFamily: TYPOGRAPHY.body, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
    highlightActions: { flexDirection: 'row', gap: SPACING.xs },
    iconButton: { alignItems: 'center', height: 34, justifyContent: 'center', width: 34 },
    highlightReference: { color: colors.heading, fontFamily: TYPOGRAPHY.body, fontSize: 13, fontWeight: '700', marginTop: SPACING.sm },
    quote: { color: colors.text, fontFamily: TYPOGRAPHY.title, fontSize: 15, lineHeight: 22, marginTop: SPACING.sm },
    colorRow: { flexDirection: 'row', gap: 10, marginTop: SPACING.md },
    colorSwatch: { borderColor: 'transparent', borderRadius: 999, borderWidth: 2, height: 24, width: 24 },
    colorSwatchSelected: { borderColor: colors.swatchRing },
    highlightNoteInput: {
      backgroundColor: colors.note,
      borderColor: colors.noteEdge,
      borderRadius: 5,
      borderWidth: 1,
      color: colors.text,
      fontFamily: TYPOGRAPHY.body,
      fontSize: 14,
      lineHeight: 20,
      marginTop: SPACING.md,
      minHeight: 76,
      padding: SPACING.sm,
    },
    actionRow: {
      alignItems: 'center',
      backgroundColor: colors.bar,
      borderTopColor: colors.footEdge,
      borderTopWidth: 1,
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingHorizontal: SPACING.xl,
      paddingTop: SPACING.sm,
    },
    actionButton: {
      alignItems: 'center',
      backgroundColor: colors.iconButton,
      borderColor: colors.iconButtonEdge,
      borderRadius: 20,
      borderWidth: 1,
      height: 40,
      justifyContent: 'center',
      width: 40,
    },
  });
}
