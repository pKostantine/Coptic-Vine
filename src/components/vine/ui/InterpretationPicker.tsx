'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { NIGHT_DOCUMENT_THEME } from '../../../constants/documentThemes';
import { COLORS, TYPOGRAPHY } from '../../../constants/theme';
import { useReadingPreferences } from '../../../context/ReadingPreferencesContext';
import { tr } from '../../../utils/appText';
import {
  DEFAULT_SELECTED_INTERPRETATIONS,
  INTERPRETATION_CHOOSER_TITLE,
  KIAHK_INTERPRETATIONS,
} from '../../../utils/kiahkInterpretations';
import { toEasternArabicDigits } from '../../../utils/localeFormat';
import Icon from './Icon';
import SheetFrame from './SheetFrame';
import ToggleRow from './ToggleRow';

const VIOLET = NIGHT_DOCUMENT_THEME.colors.choice;
const VIOLET_SOFT = NIGHT_DOCUMENT_THEME.colors.choiceSoft;
const VIOLET_LINE = NIGHT_DOCUMENT_THEME.colors.choiceLine;

interface InterpretationPickerProps {
  visible: boolean;
  onClose: () => void;
  /** Drawn in the page rather than a native modal, for a sheet opened over a document. */
  inline?: boolean;
}

/**
 * The choice of the Kiahk Saturday Theotokias' interpretations: each author
 * on a switch, in the App Language, with the defaults, all or none a tap
 * away. A change shows at once in the document behind, which keeps the
 * reader's place; the choice is kept with the reader's other content choices
 * and synced to their account (utils/kiahkInterpretations.ts).
 */
export default function InterpretationPicker({ visible, onClose, inline = false }: InterpretationPickerProps) {
  const { preferences, toggleInterpretation, setSelectedInterpretations } = useReadingPreferences();
  const arabic = preferences.appLanguage === 'ar';
  const selected = preferences.selectedInterpretations || [];
  const total = KIAHK_INTERPRETATIONS.length;
  const digits = (value: number) => (arabic ? toEasternArabicDigits(value) : String(value));
  const sameAs = (ids: readonly string[]) => ids.length === selected.length && ids.every((id) => selected.includes(id));

  const quick = (label: string, ids: readonly string[]) => {
    const on = sameAs(ids);
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        onPress={() => setSelectedInterpretations([...ids])}
        style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && styles.pressed]}
      >
        <Text style={[styles.chipText, on && styles.chipTextOn, arabic && styles.arabic]} maxFontSizeMultiplier={1.3}>{label}</Text>
      </Pressable>
    );
  };

  return (
    <SheetFrame
      visible={visible}
      onClose={onClose}
      inline={inline}
      closeLabel={tr('Close the interpretations', 'Fermer les interprétations', 'أغلق التفاسير')}
      dialogOnTablet
      dialogWidth={520}
    >
      <View style={styles.header}>
        <View style={styles.badge}>
          <Icon name="checkmark-done" size={20} color={VIOLET} />
        </View>
        <Text style={[styles.kicker, arabic && styles.arabicKicker]} maxFontSizeMultiplier={1.3}>
          {tr('KIAHK · SATURDAY THEOTOKIAS', 'KIAHK · THÉOTOKIES DU SAMEDI', 'كيهك · ثاؤطوكيات السبت')}
        </Text>
        <Text style={[styles.title, arabic && styles.arabic]} accessibilityRole="header" maxFontSizeMultiplier={1.3}>
          {tr(INTERPRETATION_CHOOSER_TITLE.english, INTERPRETATION_CHOOSER_TITLE.french, INTERPRETATION_CHOOSER_TITLE.arabic)}
        </Text>
        <Text style={[styles.body, arabic && styles.arabic]} maxFontSizeMultiplier={1.3}>
          {tr(
            `Read after each of the nine Theotokias. ${selected.length} of ${total} chosen.`,
            `Lues après chacune des neuf théotokies. ${selected.length} sur ${total} choisies.`,
            `تُقرأ بعد كل ثاؤطوكية من التسع. ${digits(selected.length)} من ${digits(total)} مختارة.`,
          )}
        </Text>
      </View>

      <View style={[styles.chips, arabic && styles.chipsArabic]}>
        {quick(tr('Default', 'Par défaut', 'الافتراضي'), DEFAULT_SELECTED_INTERPRETATIONS)}
        {quick(tr('All', 'Toutes', 'الكل'), KIAHK_INTERPRETATIONS.map((interpretation) => interpretation.id))}
        {quick(tr('None', 'Aucune', 'لا شيء'), [])}
      </View>

      <View style={styles.rows}>
        {KIAHK_INTERPRETATIONS.map((interpretation) => (
          <ToggleRow
            key={interpretation.id}
            label={tr(interpretation.name.english, interpretation.name.french, interpretation.name.arabic)}
            isArabic={arabic}
            active={selected.includes(interpretation.id)}
            onPress={() => toggleInterpretation(interpretation.id)}
            minHeight={44}
          />
        ))}
      </View>
    </SheetFrame>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: 6, paddingBottom: 14, paddingTop: 6 },
  badge: {
    alignItems: 'center',
    backgroundColor: VIOLET_SOFT,
    borderColor: VIOLET_LINE,
    borderRadius: 22,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    marginBottom: 4,
    width: 44,
  },
  kicker: { color: VIOLET, fontFamily: TYPOGRAPHY.body, fontSize: 11.5, fontWeight: '700', letterSpacing: 1.8, textAlign: 'center' },
  arabicKicker: { fontFamily: TYPOGRAPHY.arabic, letterSpacing: 0 },
  title: { color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontSize: 22, fontWeight: '700', textAlign: 'center' },
  body: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  arabic: { fontFamily: TYPOGRAPHY.arabic, writingDirection: 'rtl' },
  chips: { flexDirection: 'row', gap: 8, justifyContent: 'center', paddingBottom: 14 },
  chipsArabic: { flexDirection: 'row-reverse' },
  chip: {
    borderColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  chipOn: { backgroundColor: VIOLET_SOFT, borderColor: VIOLET_LINE },
  chipText: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 13.5, fontWeight: '700' },
  chipTextOn: { color: VIOLET },
  rows: { gap: 6 },
  pressed: { opacity: 0.7 },
});
