'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Icon from '@/components/vine/ui/Icon';
import SheetFrame from '@/components/vine/ui/SheetFrame';
import SubPageHeader from '@/components/vine/ui/SubPageHeader';
import { COLORS, TYPOGRAPHY } from '@/constants/theme';
import DocumentWebView from '@/components/vine/DocumentWebView';
import { PageGlow } from '@/components/vine/screens/BookPage';
import { useReadingPreferences } from '@/context/ReadingPreferencesContext';
import { useEdgeSwipeBack } from '@/hooks/useEdgeSwipeBack';
import { MODAL_SUPPORTED_ORIENTATIONS } from '@/utils/modalOrientations';
import { fontScaleToPx } from '@/utils/preferencesStorage';
import {
  getSaintHymnIndex,
  getSaintHymnPreview,
  SaintEntry,
  SaintHymnCategory,
  SaintHymnPreviewHymn,
} from '@/utils/saintHymns';
import { DISABLED_TEXT_SELECTION_STYLE, EDITABLE_TEXT_SELECTION_STYLE } from '@/utils/textSelection';
import { useLayoutMode } from '@/utils/useLayoutMode';

import { appText, tr } from '../../../utils/appText';
interface SaintHymnPickerProps {
  visible: boolean;
  onClose: () => void;
  isArabic: boolean;
  selected: string[];
  onToggle: (token: string) => void;
  onClearSaint: (base: string) => void;
}

const LABELS = {
  title: { english: 'Saint Hymns', arabic: 'ألحان القديسين', french: 'Hymnes des saints' },
  search: { english: 'Search saints', arabic: 'ابحث عن قديس', french: 'Rechercher des saints' },
  empty: { english: 'No saints match that search.', arabic: 'لا يوجد قديس مطابق.', french: 'Aucun saint ne correspond à cette recherche.' },
  clear: { english: 'Clear', arabic: 'مسح', french: 'Effacer' },
  choose: { english: 'Choose hymns', arabic: 'اختر الألحان', french: 'Choisir les hymnes' },
  included: { english: 'Included', arabic: 'مُضاف', french: 'Inclus' },
  include: { english: 'Include', arabic: 'إضافة', french: 'Inclure' },
  noPreview: { english: 'This hymn has no text yet.', arabic: 'لا يوجد نص لهذا اللحن بعد.', french: 'Cette hymne n’a pas encore de texte.' },
};

const MAX_FONT_SCALE = 1.3;

interface PreviewTarget {
  token: string;
  category: SaintHymnCategory;
  /** The hymn's own name in the menu, e.g. "Doxology 2". */
  label: string;
  saintName: string;
}

/** Normalized for search so "st mark" and "stmark" both find StMark. */
function searchKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * The saints' hymns (Coptic Vine design, "Saint Hymns"): a page of saints,
 * each naming its hymns with the chosen ones in gold; a saint's hymns to
 * choose from on a sheet; and any hymn's text on a sheet of its own. On the
 * iPad and desktop the three stand side by side.
 */
export default function SaintHymnPicker({
  visible,
  onClose,
  isArabic,
  selected,
  onToggle,
  onClearSaint,
}: SaintHymnPickerProps) {
  const [saints, setSaints] = useState<SaintEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  // The saint whose own hymn menu is open beside or over the list. Only saints
  // with more than one choice get one — see the comment on openSaint below.
  const [expandedBase, setExpandedBase] = useState<string | null>(null);
  // The hymn whose text is being read, over whichever of those two it was
  // opened from. Choosing a saint hymn otherwise means recognising it by name;
  // this is how you choose it by reading it.
  const [preview, setPreview] = useState<PreviewTarget | null>(null);
  const [previewHymns, setPreviewHymns] = useState<SaintHymnPreviewHymn[] | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const { height: windowHeight } = useWindowDimensions();
  const { preferences } = useReadingPreferences();
  const wide = useLayoutMode() !== 'phone';

  const label = (entry: { english: string; arabic: string; french?: string }) => (appText(entry));
  const localized = isArabic && styles.arabicText;
  const rowDirection = isArabic && styles.rowReverse;

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    getSaintHymnIndex()
      .then((entries) => {
        if (!cancelled) {
          setSaints(entries);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'Unable to load saint hymns.');
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  useEffect(() => {
    if (!preview) return;
    let cancelled = false;
    getSaintHymnPreview(preview.token, preview.category)
      .then((hymns) => {
        if (!cancelled) setPreviewHymns(hymns);
      })
      .catch((err) => {
        if (!cancelled) setPreviewError(err?.message || 'Unable to load this hymn.');
      });
    return () => {
      cancelled = true;
    };
  }, [preview]);

  // Cleared here rather than in the effect above, so opening a second preview
  // never shows the previous hymn's text while the new one loads — and so the
  // effect only ever sets state from its own async result.
  const openPreview = (target: PreviewTarget) => {
    setPreviewHymns(null);
    setPreviewError(null);
    setPreview(target);
  };

  /**
   * The hymn as the document itself would lay it out — the same renderer, the
   * same three-column table, the same fonts, speaker labels and alternating
   * colours, reading the reader's own language and display settings. A preview
   * that reflowed the verses into a list would be showing something the
   * service never looks like.
   *
   * Slideshow Mode is the one setting deliberately ignored: this is a window
   * onto a hymn, not a place to page through one.
   */
  const previewSections = useMemo(
    () =>
      (previewHymns || []).map((hymn) => ({
        id: hymn.hymnKey,
        title: hymn.title,
        titlePrayerType: hymn.titlePrayerType,
        alternateEvery: hymn.alternateEvery,
        forceWhiteVerses: hymn.forceWhiteVerses,
        reverseAlternating: hymn.reverseAlternating,
        verses: hymn.verses,
      })),
    [previewHymns],
  );

  const previewVisibleColumns = useMemo(
    () => ({
      english: preferences.visibleLanguages.english,
      coptic: preferences.visibleLanguages.coptic,
      arabic: preferences.visibleLanguages.arabic,
    }),
    [
      preferences.visibleLanguages.arabic,
      preferences.visibleLanguages.coptic,
      preferences.visibleLanguages.english,
    ],
  );

  // Keep the WebView viewport stable after it mounts. Resizing it from its own
  // content-height messages can make WKWebView repeatedly reflow on iOS.
  const previewBodyHeight = wide ? Math.max(320, Math.round(windowHeight * 0.6)) : Math.min(560, Math.max(180, Math.round(windowHeight * 0.5)));

  // The reader's own size, but held to something a window this wide can still
  // show three columns of. At the top of the text-size range a real document
  // line is taller than this whole window.
  const previewFontSize = Math.min(fontScaleToPx(preferences.fontScale), 20);

  // Closing clears this page's own transient state, so it never reopens with
  // a stale search or a saint's menu still hanging open behind it. Done on the
  // close path rather than in an effect watching `visible` — every close goes
  // through here, and the effect was setting state mid-reconciliation.
  const closePicker = () => {
    setPreview(null);
    setExpandedBase(null);
    setQuery('');
    onClose();
  };

  const closeTopLayer = () => {
    if (preview) {
      setPreview(null);
      return;
    }
    if (expandedBase) {
      setExpandedBase(null);
      return;
    }
    closePicker();
  };

  // Swiping in from the left edge goes back a step, as Back on Android does:
  // out of an open preview or saint's menu first, then out of Saint Hymns.
  const edgeSwipeHandlers = useEdgeSwipeBack(closeTopLayer, visible);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const filtered = useMemo(() => {
    if (!saints) return [];
    const key = searchKey(query);
    if (!key) return saints;
    // Matched against both the display name and the raw token, so searching
    // "michael" finds Archangel Michael and "stmark" finds St. Mark.
    return saints.filter((entry) => searchKey(entry.name).includes(key) || searchKey(entry.base).includes(key));
  }, [saints, query]);

  const expanded = useMemo(
    () => (expandedBase ? saints?.find((entry) => entry.base === expandedBase) ?? null : null),
    [expandedBase, saints],
  );

  /**
   * Tapping a saint opens his hymn menu — except where that menu would hold a
   * single row. Most saints in the book have only an Axios line, and making
   * several hundred of them cost an extra sheet to reach one toggle would be
   * worse than useless; those toggle from the row itself, which already names
   * the one choice underneath.
   */
  const openSaint = (entry: SaintEntry) => {
    if (entry.options.length === 1) {
      onToggle(entry.options[0].token);
      return;
    }
    setExpandedBase(entry.base);
  };

  const countFor = (entry: SaintEntry) => entry.options.filter((option) => selectedSet.has(option.token)).length;

  /** "Doxology for Archangel Michael" */
  const previewTitle = (target: PreviewTarget) => tr(`${target.label} for ${target.saintName}`, `${target.label} pour ${target.saintName}`, `${target.label} - ${target.saintName}`);

  // Sits inside the row it belongs to, so it has to claim the touch before the
  // row's own handler runs. A full 38pt disc rather than an icon with slop
  // around it: the target is then where it looks like it is, which matters
  // most for the row where the tap that misses it picks the saint instead.
  const eyeButton = (target: PreviewTarget) => {
    const open = preview?.token === target.token;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Preview ${target.label} for ${target.saintName}`}
        accessibilityState={{ selected: open }}
        hitSlop={4}
        style={({ pressed }) => [styles.eye, open && styles.eyeOpen, pressed && styles.pressed]}
        onPress={(event) => {
          // On the web the row around this one would otherwise see the same
          // click and toggle the saint, so reading a hymn would also pick it.
          // Native hands the touch to this responder alone; this makes both
          // behave the same way.
          event?.stopPropagation?.();
          openPreview(target);
        }}
      >
        <Icon name="eye-outline" size={19} color={open ? COLORS.greenDeep : COLORS.gold} />
      </Pressable>
    );
  };

  const saintRow = (item: SaintEntry) => {
    const count = countFor(item);
    const single = item.options.length === 1;
    const highlighted = single ? count > 0 : item.base === expandedBase;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${item.options.map((option) => option.label).join(', ')}`}
        accessibilityState={single ? { selected: count > 0 } : { expanded: item.base === expandedBase }}
        style={({ pressed }) => [styles.saintRow, rowDirection, pressed && styles.pressed]}
        onPress={() => openSaint(item)}
      >
        <LinearGradient
          colors={highlighted ? [COLORS.green, COLORS.greenDeep] : [COLORS.surfaceDeep, COLORS.surface]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={styles.saintText}>
          <Text style={[styles.saintName, localized]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{item.name}</Text>
          <Text style={[styles.saintHymns, localized]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {item.options.map((option, index) => (
              <Text key={option.token}>
                {index > 0 ? ' · ' : ''}
                <Text style={selectedSet.has(option.token) ? styles.saintHymnOn : undefined}>{option.label}</Text>
              </Text>
            ))}
          </Text>
        </View>
        {count > 0 ? (
          <View style={styles.count}>
            <Text style={styles.countText} maxFontSizeMultiplier={MAX_FONT_SCALE}>{count}</Text>
          </View>
        ) : null}
        {single
          ? eyeButton({ token: item.options[0].token, category: item.options[0].category, label: item.options[0].label, saintName: item.name })
          : <Icon name={isArabic ? 'chevron-back' : 'chevron-forward'} size={17} color={COLORS.gold} />}
      </Pressable>
    );
  };

  /** A saint's hymns to choose from (Coptic Vine design, "Choose hymns"). */
  const chooser = expanded ? (
    <View style={styles.chooser}>
      <View style={[styles.chooserHead, rowDirection]}>
        <View style={styles.flex}>
          <Text style={[styles.kicker, isArabic && styles.kickerArabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{isArabic ? expanded.name : expanded.name.toUpperCase()}</Text>
          <Text style={[styles.chooserTitle, localized]} accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE}>{label(LABELS.choose)}</Text>
          <Text style={[styles.chooserCount, localized]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {tr(`${countFor(expanded)} of ${expanded.options.length} selected`, `${countFor(expanded)} sur ${expanded.options.length} sélectionnés`, `${countFor(expanded)} من ${expanded.options.length} مختارة`)}
          </Text>
        </View>
        {countFor(expanded) > 0 ? (
          <Pressable accessibilityRole="button" hitSlop={8} style={({ pressed }) => [styles.clear, pressed && styles.pressed]} onPress={() => onClearSaint(expanded.base)}>
            <Text style={[styles.clearText, localized]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{label(LABELS.clear)}</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.options}>
        {expanded.options.map((option) => {
          const active = selectedSet.has(option.token);
          return (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: active }}
              accessibilityLabel={option.label}
              key={option.token}
              style={({ pressed }) => [styles.option, active && styles.optionOn, rowDirection, pressed && styles.pressed]}
              onPress={() => onToggle(option.token)}
            >
              <View style={[styles.check, active && styles.checkOn]}>
                {active ? <Icon name="checkmark" size={15} color={COLORS.greenDeep} /> : null}
              </View>
              <Text style={[styles.optionLabel, active && styles.optionLabelOn, localized]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {option.label}
              </Text>
              {eyeButton({ token: option.token, category: option.category, label: option.label, saintName: expanded.name })}
            </Pressable>
          );
        })}
      </View>
    </View>
  ) : null;

  /** A hymn's text, with the way to include it (Coptic Vine design, "Preview"). */
  const previewPanel = preview ? (
    <View style={styles.preview}>
      <View style={[styles.previewHead, rowDirection]}>
        <Pressable accessibilityRole="button" accessibilityLabel={tr('Close preview', 'Fermer l’aperçu', 'أغلق المعاينة')} style={({ pressed }) => [styles.previewBack, pressed && styles.pressed]} onPress={() => setPreview(null)}>
          <Icon name={isArabic ? 'chevron-forward' : 'chevron-back'} size={19} color={COLORS.gold} />
        </Pressable>
        <Text style={[styles.previewTitle, localized]} accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE}>{previewTitle(preview)}</Text>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: selectedSet.has(preview.token) }}
          accessibilityLabel={label(LABELS.include)}
          style={({ pressed }) => [styles.includePill, rowDirection, pressed && styles.pressed]}
          onPress={() => onToggle(preview.token)}
        >
          <Icon name={selectedSet.has(preview.token) ? 'checkmark' : 'add'} size={15} color={COLORS.gold} />
          <Text style={[styles.includeText, localized]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{label(selectedSet.has(preview.token) ? LABELS.included : LABELS.include)}</Text>
        </Pressable>
      </View>
      {previewError ? (
        <Text style={[styles.message, localized]}>{previewError}</Text>
      ) : !previewHymns ? (
        <ActivityIndicator color={COLORS.gold} style={styles.previewLoading} />
      ) : previewHymns.length === 0 ? (
        <Text style={[styles.message, localized]}>{label(LABELS.noPreview)}</Text>
      ) : (
        <View style={[styles.previewBody, { height: previewBodyHeight }]}>
          <DocumentWebView
            sections={previewSections}
            fontSize={previewFontSize}
            visibleColumns={previewVisibleColumns}
            appLanguage={preferences.appLanguage}
            // The preview is here to be read and quoted from, so its
            // text selects and copies. The page around it stays
            // unselectable chrome.
            selectText
            displayComments={preferences.displayComments}
            displaySilentPrayers={preferences.displaySilentPrayers}
            bishopPresent={preferences.bishopPresent}
            copticRecitedPrayers={preferences.visibleLanguages.copticRecitedPrayers}
          />
        </View>
      )}
    </View>
  ) : null;

  const search = (
    <View style={[styles.search, rowDirection]}>
      <Icon name="search-outline" size={19} color={COLORS.gold} />
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={label(LABELS.search)}
        placeholderTextColor="rgba(205, 216, 203, 0.55)"
        style={[styles.searchInput, Platform.OS === 'web' && styles.searchInputWeb, localized, EDITABLE_TEXT_SELECTION_STYLE]}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        clearButtonMode="while-editing"
      />
    </View>
  );

  const list = error ? (
    <Text style={[styles.message, localized]}>{error}</Text>
  ) : !saints ? (
    <ActivityIndicator color={COLORS.gold} style={styles.loading} />
  ) : (
    <FlatList
      data={filtered}
      keyExtractor={(entry) => entry.base}
      style={styles.list}
      contentContainerStyle={styles.listContent}
      keyboardShouldPersistTaps="handled"
      initialNumToRender={16}
      windowSize={9}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={<Text style={[styles.message, localized]}>{label(LABELS.empty)}</Text>}
      renderItem={({ item }) => saintRow(item)}
    />
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={closeTopLayer}
      supportedOrientations={MODAL_SUPPORTED_ORIENTATIONS}
    >
      <View style={[styles.page, DISABLED_TEXT_SELECTION_STYLE]} {...edgeSwipeHandlers}>
        <PageGlow kind="green" tall={wide} />
        <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.flex}>
          <SubPageHeader title={label(LABELS.title)} arabic={isArabic} onBack={closePicker} backLabel={tr('Back', 'Retour', 'رجوع')} />

          {wide ? (
            <View style={[styles.columns, rowDirection]}>
              <View style={styles.listColumn}>
                {search}
                {list}
              </View>
              {chooser ? <View style={styles.chooserColumn}>{chooser}</View> : null}
              {previewPanel ? <View style={styles.previewColumn}>{previewPanel}</View> : null}
            </View>
          ) : (
            <>
              {search}
              {list}
            </>
          )}
        </SafeAreaView>

        {/* On a phone the saint's hymns and the preview rise as sheets inside
            this modal: stacking native modals can leave iOS with an invisible
            view that captures touches. The preview is declared last, so it
            covers an open hymn menu. */}
        {!wide ? (
          <SheetFrame inline visible={Boolean(expanded)} onClose={() => setExpandedBase(null)} closeLabel={tr('Close the hymns', 'Fermer les hymnes', 'أغلق الألحان')}>
            {chooser}
          </SheetFrame>
        ) : null}
        {!wide ? (
          <SheetFrame inline visible={Boolean(preview)} onClose={() => setPreview(null)} closeLabel={tr('Close preview', 'Fermer l’aperçu', 'أغلق المعاينة')} scroll={false}>
            {previewPanel}
          </SheetFrame>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: COLORS.black, flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  rowReverse: { flexDirection: 'row-reverse' },
  pressed: { opacity: 0.75 },
  search: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    flexDirection: 'row',
    gap: 10,
    height: 48,
    marginBottom: 12,
    marginHorizontal: 16,
    paddingHorizontal: 16,
  },
  searchInput: { color: COLORS.white, flex: 1, fontFamily: TYPOGRAPHY.body, fontSize: 15.5, height: 48, minWidth: 0 },
  // The rounded search row already frames the field; the browser's own focus
  // ring drew a second, square box inside it.
  searchInputWeb: {
    outlineStyle: 'none',
    outlineWidth: 0,
    boxShadow: 'none',
  } as any,
  list: { flex: 1 },
  listContent: { gap: 8, paddingBottom: 28, paddingHorizontal: 16 },
  loading: { flex: 1, paddingVertical: 32 },
  message: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 14, paddingHorizontal: 16, paddingVertical: 24, textAlign: 'center' },
  saintRow: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    flexDirection: 'row',
    gap: 10,
    overflow: 'hidden',
    paddingLeft: 16,
    paddingRight: 12,
    paddingVertical: 13,
  },
  saintText: { flex: 1, minWidth: 0 },
  saintName: { color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontSize: 17, fontWeight: '700', lineHeight: 21 },
  saintHymns: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 12.5, lineHeight: 18, marginTop: 4 },
  saintHymnOn: { color: COLORS.goldBright, fontWeight: '700' },
  count: { alignItems: 'center', backgroundColor: COLORS.gold, borderRadius: 99, height: 24, justifyContent: 'center', minWidth: 24, paddingHorizontal: 7 },
  countText: { color: COLORS.greenDeep, fontFamily: TYPOGRAPHY.body, fontSize: 12.5, fontWeight: '800' },
  eye: { alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.28)', borderRadius: 19, height: 38, justifyContent: 'center', width: 38 },
  eyeOpen: { backgroundColor: COLORS.gold },

  columns: { alignItems: 'flex-start', flex: 1, flexDirection: 'row', gap: 20, paddingHorizontal: 16 },
  listColumn: { alignSelf: 'stretch', flex: 1, maxWidth: 460, minWidth: 0 },
  chooserColumn: { width: 300 },
  previewColumn: { flex: 1.2, minWidth: 0 },

  chooser: { backgroundColor: COLORS.surface, borderRadius: 24, padding: 16 },
  chooserHead: { alignItems: 'flex-start', flexDirection: 'row', gap: 12, marginBottom: 14 },
  kicker: { color: COLORS.gold, fontFamily: TYPOGRAPHY.body, fontSize: 11.5, fontWeight: '700', letterSpacing: 1.8 },
  kickerArabic: { fontFamily: TYPOGRAPHY.arabic, fontSize: 13, letterSpacing: 0, textAlign: 'right', writingDirection: 'rtl' },
  chooserTitle: { color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontSize: 24, fontWeight: '700', lineHeight: 28, marginTop: 5 },
  chooserCount: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 13.5, marginTop: 4 },
  clear: { paddingHorizontal: 2, paddingVertical: 6 },
  clearText: { color: COLORS.gold, fontFamily: TYPOGRAPHY.body, fontSize: 15, fontWeight: '700' },
  options: { gap: 6 },
  option: { alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: 16, flexDirection: 'row', gap: 12, minHeight: 52, paddingLeft: 14, paddingRight: 7, paddingVertical: 7 },
  optionOn: { backgroundColor: COLORS.goldSoft },
  check: { alignItems: 'center', borderColor: 'rgba(205, 216, 203, 0.4)', borderRadius: 12, borderWidth: 1.5, height: 24, justifyContent: 'center', width: 24 },
  checkOn: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  optionLabel: { color: COLORS.white, flex: 1, fontFamily: TYPOGRAPHY.body, fontSize: 15.5, fontWeight: '600', minWidth: 0 },
  optionLabelOn: { color: COLORS.goldBright },

  preview: { backgroundColor: COLORS.surface, borderRadius: 24, padding: 16 },
  previewHead: { alignItems: 'flex-start', flexDirection: 'row', gap: 12, marginBottom: 12 },
  previewBack: { alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.07)', borderRadius: 19, height: 38, justifyContent: 'center', width: 38 },
  previewTitle: { color: COLORS.gold, flex: 1, fontFamily: TYPOGRAPHY.title, fontSize: 18, fontWeight: '700', lineHeight: 23, minWidth: 0, paddingTop: 7 },
  includePill: { alignItems: 'center', backgroundColor: COLORS.goldSoft, borderRadius: 99, flexDirection: 'row', gap: 5, height: 34, paddingHorizontal: 13 },
  includeText: { color: COLORS.gold, fontFamily: TYPOGRAPHY.body, fontSize: 13.5, fontWeight: '700' },
  previewLoading: { paddingVertical: 32 },
  // The document renderer scrolls within this stable viewport.
  previewBody: { backgroundColor: COLORS.black, borderRadius: 18, overflow: 'hidden' },
  arabicText: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'right', writingDirection: 'rtl' },
});
