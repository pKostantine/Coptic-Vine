'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import FontScaleControl from '@/components/vine/ui/FontScaleControl';
import Icon from '@/components/vine/ui/Icon';
import SaintHymnPicker from '@/components/vine/ui/SaintHymnPicker';
import SheetFrame from '@/components/vine/ui/SheetFrame';
import SubPageHeader from '@/components/vine/ui/SubPageHeader';
import ToggleRow from '@/components/vine/ui/ToggleRow';
import { COLORS, TYPOGRAPHY } from '@/constants/theme';
import { useReadingPreferences } from '@/context/ReadingPreferencesContext';
import { goBack } from '@/utils/navigation';
import { OrientationMode, VisibleLanguages } from '@/utils/preferencesStorage';
import { DISABLED_TEXT_SELECTION_STYLE } from '@/utils/textSelection';
import { useLayoutMode } from '@/utils/useLayoutMode';

import { appText, tr } from '../../../utils/appText';
const LANGUAGE_OPTIONS: { key: keyof VisibleLanguages; label: string; arabic: string; french: string }[] = [
  { key: 'english', label: 'English', arabic: 'الإنجليزية', french: 'Anglais' }, { key: 'french', label: 'French', arabic: 'الفرنسية', french: 'Français' },
  { key: 'coptic', label: 'Coptic', arabic: 'القبطية', french: 'Copte' },
  { key: 'copticRecitedPrayers', label: 'Coptic Recited Prayers', arabic: 'الصلوات القبطية المرتلة قراءة', french: 'Prières récitées en copte' }, { key: 'arabic', label: 'Arabic', arabic: 'العربية', french: 'Arabe' },
];
const ORIENTATION_OPTIONS: { key: OrientationMode; label: string; arabic: string; french: string }[] = [
  { key: 'landscape', label: 'Landscape', arabic: 'أفقي', french: 'Paysage' }, { key: 'reverseLandscape', label: 'Reverse Landscape', arabic: 'أفقي معكوس', french: 'Paysage inversé' },
  { key: 'portrait', label: 'Portrait', arabic: 'عمودي', french: 'Portrait' }, { key: 'auto', label: 'Auto Rotate', arabic: 'تدوير تلقائي', french: 'Rotation automatique' },
];
const SETTINGS_LABELS = {
  settings: { english: 'Book Settings', arabic: 'إعدادات الكتب', french: 'Réglages des livres' }, languages: { english: 'Languages', arabic: 'اللغات', french: 'Langues' }, orientation: { english: 'Orientation', arabic: 'الاتجاه', french: 'Orientation' },
  display: { english: 'Display', arabic: 'العرض', french: 'Affichage' }, slideshowMode: { english: 'Slideshow Mode', arabic: 'وضع العرض التقديمي', french: 'Mode diaporama' }, selectText: { english: 'Select Text', arabic: 'تحديد النص', french: 'Sélectionner le texte' },
  displayComments: { english: 'Display Comments', arabic: 'عرض التعليقات', french: 'Afficher les commentaires' }, displaySilentPrayers: { english: 'Display Silent Prayers', arabic: 'عرض الصلوات السرية', french: 'Afficher les prières secrètes' }, displayNowPlayingBar: { english: 'Display Now Playing Bar', arabic: 'عرض شريط التشغيل الحالي', french: 'Afficher la barre de lecture' },
  keepScreenAwake: { english: 'Keep Screen On While Reading', arabic: 'إبقاء الشاشة مضاءة أثناء القراءة', french: 'Garder l’écran allumé pendant la lecture' },
  content: { english: 'Content', arabic: 'المحتوى', french: 'Contenu' }, saintHymns: { english: 'Saint Hymns', arabic: 'ألحان القديسين', french: 'Hymnes des saints' }, inMonastery: { english: 'In Monastery', arabic: 'في الدير', french: 'Au monastère' },
  textSize: { english: 'Text size', arabic: 'حجم النص', french: 'Taille du texte' }, downloads: { english: 'Downloads & Storage', arabic: 'التنزيلات والتخزين', french: 'Téléchargements et stockage' },
};

type Label = { english?: string; label?: string; arabic: string; french?: string };
const labelText = (label: Label) => appText({ english: label.english || label.label || '', arabic: label.arabic, french: label.french });

interface BookSettingsPanelProps {
  /** Two columns — Languages and Content beside Display — on the iPad and desktop. */
  wide?: boolean;
  /** Inside a document's own settings modal: no Downloads row (it would open a route under the modal). */
  hosted?: boolean;
  onOpenSaintHymns: () => void;
}

/**
 * The reading settings (Coptic Vine design, "Book settings"): the languages
 * as chips, the display settings as switches under a text-size slider, and
 * the content — the saints' hymns and the monastery — each group under a
 * small gold heading. Shown in a sheet over Books, as a page of its own, and
 * inside a document's settings.
 */
export function BookSettingsPanel({ wide = false, hosted = false, onOpenSaintHymns }: BookSettingsPanelProps) {
  const router = useRouter();
  const { preferences, toggleLanguage, setFontScale, setFontScaleValue, setOrientationMode, toggleSelectText, toggleSlideshowMode, toggleDisplayComments, toggleDisplaySilentPrayers, toggleDisplayNowPlayingBar, toggleInMonastery, toggleKeepScreenAwake } = useReadingPreferences();
  const arabic = preferences.appLanguage === 'ar';
  const chosen = (preferences.selectedSaintHymns || []).length;
  const selectedCount = chosen === 1
    ? tr('1 selected', '1 sélectionné', 'واحد مختار')
    : tr(`${chosen} selected`, `${chosen} sélectionnés`, `${chosen} مختارة`);

  const kicker = (label: Label) => (
    <Text style={[styles.kicker, arabic && styles.kickerArabic]} maxFontSizeMultiplier={1.3}>
      {arabic ? labelText(label) : labelText(label).toUpperCase()}
    </Text>
  );
  const chips = <Key extends string>(options: { key: Key; label: string; arabic: string; french: string }[], isOn: (key: Key) => boolean, onPress: (key: Key) => void, role: 'checkbox' | 'radio') => (
    <View style={[styles.chips, arabic && styles.rowReverse]}>
      {options.map((item) => {
        const on = isOn(item.key);
        return (
          <Pressable
            key={item.key}
            accessibilityRole={role}
            accessibilityState={{ checked: on }}
            accessibilityLabel={labelText(item)}
            onPress={() => onPress(item.key)}
            style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && styles.pressed]}
          >
            <Text style={[styles.chipText, on && styles.chipTextOn, arabic && styles.arabicText]} maxFontSizeMultiplier={1.3}>{labelText(item)}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  const languages = (
    <>
      {kicker(SETTINGS_LABELS.languages)}
      {chips(LANGUAGE_OPTIONS, (key) => preferences.visibleLanguages[key], toggleLanguage, 'checkbox')}
      {Platform.OS !== 'web' ? (
        <>
          {kicker(SETTINGS_LABELS.orientation)}
          {chips(ORIENTATION_OPTIONS, (key) => preferences.orientationMode === key, setOrientationMode, 'radio')}
        </>
      ) : null}
    </>
  );
  const display = (
    <>
      {kicker(SETTINGS_LABELS.display)}
      <View style={styles.rows}>
        <FontScaleControl fontScale={preferences.fontScale} isArabic={arabic} label={labelText(SETTINGS_LABELS.textSize)} onStep={setFontScale} onSetValue={setFontScaleValue} />
        <ToggleRow label={labelText(SETTINGS_LABELS.slideshowMode)} isArabic={arabic} active={preferences.slideshowMode} onPress={toggleSlideshowMode} />
        <ToggleRow label={labelText(SETTINGS_LABELS.selectText)} isArabic={arabic} active={preferences.selectText} disabled={preferences.slideshowMode} onPress={toggleSelectText} />
        <ToggleRow label={labelText(SETTINGS_LABELS.displayComments)} isArabic={arabic} active={preferences.displayComments} onPress={toggleDisplayComments} />
        <ToggleRow label={labelText(SETTINGS_LABELS.displaySilentPrayers)} isArabic={arabic} active={preferences.displaySilentPrayers} onPress={toggleDisplaySilentPrayers} />
        <ToggleRow label={labelText(SETTINGS_LABELS.displayNowPlayingBar)} isArabic={arabic} active={preferences.displayNowPlayingBar} onPress={toggleDisplayNowPlayingBar} />
        <ToggleRow label={labelText(SETTINGS_LABELS.keepScreenAwake)} isArabic={arabic} active={preferences.keepScreenAwake} onPress={toggleKeepScreenAwake} />
      </View>
    </>
  );
  const content = (
    <>
      {kicker(SETTINGS_LABELS.content)}
      <View style={styles.rows}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${labelText(SETTINGS_LABELS.saintHymns)}, ${selectedCount}`}
          onPress={onOpenSaintHymns}
          style={({ pressed }) => [styles.linkRow, arabic && styles.rowReverse, pressed && styles.linkRowPressed]}
        >
          <Text style={[styles.linkLabel, arabic && styles.arabicText]} maxFontSizeMultiplier={1.3}>{labelText(SETTINGS_LABELS.saintHymns)}</Text>
          <Text style={[styles.linkValue, arabic && styles.arabicText]} maxFontSizeMultiplier={1.3}>{selectedCount}</Text>
          <Icon name={arabic ? 'chevron-back' : 'chevron-forward'} size={17} color={COLORS.gold} />
        </Pressable>
        <ToggleRow label={labelText(SETTINGS_LABELS.inMonastery)} isArabic={arabic} active={preferences.inMonastery} onPress={toggleInMonastery} />
        {!hosted && Platform.OS !== 'web' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={labelText(SETTINGS_LABELS.downloads)}
            onPress={() => router.push('/downloads')}
            style={({ pressed }) => [styles.linkRow, arabic && styles.rowReverse, pressed && styles.linkRowPressed]}
          >
            <Text style={[styles.linkLabel, arabic && styles.arabicText]} maxFontSizeMultiplier={1.3}>{labelText(SETTINGS_LABELS.downloads)}</Text>
            <Icon name={arabic ? 'chevron-back' : 'chevron-forward'} size={17} color={COLORS.gold} />
          </Pressable>
        ) : null}
      </View>
    </>
  );

  if (wide) {
    return (
      <View style={[styles.columns, arabic && styles.rowReverse]}>
        <View style={styles.column}>
          {languages}
          {content}
        </View>
        <View style={styles.column}>{display}</View>
      </View>
    );
  }
  return (
    <View>
      {languages}
      {display}
      {content}
    </View>
  );
}

interface SettingsScreenProps { onClose?: () => void; }

/** The Book Settings as a page of its own (the /book-settings route, and a document's settings modal). */
export default function SettingsScreen({ onClose }: SettingsScreenProps) {
  const router = useRouter();
  const layout = useLayoutMode();
  const wide = layout !== 'phone';
  const isHosted = Boolean(onClose);
  const closeScreen = () => (onClose ? onClose() : goBack(router, '/books'));
  const { preferences, toggleSaintHymn, clearSaintHymns } = useReadingPreferences();
  const [saintPickerOpen, setSaintPickerOpen] = useState(false);
  const arabic = preferences.appLanguage === 'ar';

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={[styles.safeArea, DISABLED_TEXT_SELECTION_STYLE]}>
      {isHosted ? null : <Head><title>Coptic Vine Book Settings</title></Head>}
      <SubPageHeader title={labelText(SETTINGS_LABELS.settings)} arabic={arabic} onBack={closeScreen} backLabel={tr('Back', 'Retour', 'رجوع')} />
      <ScrollView contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.pageCard, wide && styles.pageCardWide]}>
          <BookSettingsPanel wide={wide} hosted={isHosted} onOpenSaintHymns={() => setSaintPickerOpen(true)} />
        </View>
      </ScrollView>
      <SaintHymnPicker visible={saintPickerOpen} onClose={() => setSaintPickerOpen(false)} isArabic={arabic} selected={preferences.selectedSaintHymns || []} onToggle={toggleSaintHymn} onClearSaint={clearSaintHymns} />
    </SafeAreaView>
  );
}

/** The Book Settings over the Books page: a sheet on a phone, a centred dialog on the iPad and desktop. */
export function BookSettingsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const layout = useLayoutMode();
  const wide = layout !== 'phone';
  const { preferences, toggleSaintHymn, clearSaintHymns } = useReadingPreferences();
  const [saintPickerOpen, setSaintPickerOpen] = useState(false);
  const arabic = preferences.appLanguage === 'ar';
  return (
    <SheetFrame
      visible={visible}
      onClose={onClose}
      closeLabel={tr('Close the settings', 'Fermer les réglages', 'أغلق الإعدادات')}
      dialogOnTablet
      dialogWidth={layout === 'desktop' ? 780 : 740}
    >
      <View style={wide ? styles.dialogBody : null}>
        <BookSettingsPanel wide={wide} onOpenSaintHymns={() => setSaintPickerOpen(true)} />
      </View>
      {/* Inside the sheet's own modal, so iOS presents it over the sheet. */}
      <SaintHymnPicker visible={saintPickerOpen} onClose={() => setSaintPickerOpen(false)} isArabic={arabic} selected={preferences.selectedSaintHymns || []} onToggle={toggleSaintHymn} onClearSaint={clearSaintHymns} />
    </SheetFrame>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.black },
  pageContent: { paddingBottom: 32, paddingHorizontal: 16 },
  pageCard: { backgroundColor: COLORS.surface, borderColor: COLORS.goldLine, borderRadius: 28, borderTopWidth: 1, paddingBottom: 22, paddingHorizontal: 16, paddingTop: 4 },
  pageCardWide: { alignSelf: 'center', maxWidth: 780, paddingHorizontal: 24, width: '100%' },
  dialogBody: { paddingHorizontal: 8 },
  columns: { flexDirection: 'row', gap: 28 },
  column: { flex: 1, minWidth: 0 },
  rowReverse: { flexDirection: 'row-reverse' },
  pressed: { opacity: 0.75 },
  kicker: { color: COLORS.gold, fontFamily: TYPOGRAPHY.body, fontSize: 11.5, fontWeight: '700', letterSpacing: 1.8, marginBottom: 9, marginHorizontal: 2, marginTop: 16 },
  kickerArabic: { fontFamily: TYPOGRAPHY.arabic, fontSize: 13, letterSpacing: 0, textAlign: 'right', writingDirection: 'rtl' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.07)', borderRadius: 99, height: 38, justifyContent: 'center', paddingHorizontal: 15 },
  chipOn: { backgroundColor: COLORS.gold },
  chipText: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 14.5, fontWeight: '600' },
  chipTextOn: { color: COLORS.greenDeep },
  rows: { gap: 5 },
  linkRow: { alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: 14, flexDirection: 'row', gap: 10, minHeight: 48, paddingLeft: 16, paddingRight: 12, paddingVertical: 8 },
  linkRowPressed: { backgroundColor: 'rgba(255, 255, 255, 0.09)' },
  linkLabel: { color: COLORS.white, flex: 1, fontFamily: TYPOGRAPHY.body, fontSize: 15, fontWeight: '600', minWidth: 0 },
  linkValue: { color: COLORS.goldBright, fontFamily: TYPOGRAPHY.body, fontSize: 14 },
  arabicText: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'right', writingDirection: 'rtl' },
});
