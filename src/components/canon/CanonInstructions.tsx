'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import Icon from '@/components/vine/ui/Icon';
import { COLORS, TYPOGRAPHY } from '@/constants/theme';
import { tr } from '@/utils/appText';

const MAX_FONT_SCALE = 1.3;
/** Lines shown before "Show all", so a long rule doesn't push the day's canon away. */
const FOLDED_LINES = 4;

/**
 * The instructions a father of confession gave for the canon, written down
 * at the top of it to read beside the day's tasks: folded to its first lines
 * when long, opened to be written in place. With none yet, one quiet row
 * offers to write them. Without onChange they are someone else's, shown to
 * their support person to read, under a heading of their own.
 */
export default function CanonInstructions({ text, arabic, onChange, heading: ownHeading }: {
  text: string;
  arabic: boolean;
  onChange?: (text: string) => void;
  heading?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [unfolded, setUnfolded] = useState(false);
  const [folds, setFolds] = useState(false);
  const written = text.trim().length > 0;
  // A phone measures the lines it lays out; the web doesn't say, so there it
  // goes by the text's own lines and length.
  const long = folds || (Platform.OS === 'web' && (text.trim().split('\n').length > FOLDED_LINES || text.trim().length > 220));
  const heading = ownHeading ?? tr('From your father of confession', 'De votre père de confession', 'من أب اعترافك');
  const readOnly = !onChange;

  if (readOnly && !written) return null;
  if (!written && !editing) {
    return (
      <Pressable accessibilityRole="button" onPress={() => setEditing(true)} style={({ pressed }) => [styles.add, pressed && styles.pressed]}>
        <Icon name="create-outline" size={18} color={COLORS.gold} />
        <Text style={[styles.addText, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {tr('Write down your father of confession’s instructions', 'Notez les consignes de votre père de confession', 'دوّن إرشادات أب اعترافك')}
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.card}>
      <LinearGradient colors={[COLORS.surfaceDeep, COLORS.surface]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={[styles.head, arabic && styles.rtl]}>
        <Text style={[styles.kicker, arabic && styles.arabicTight]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{heading}</Text>
        {readOnly ? null : <Pressable
          accessibilityRole="button"
          accessibilityLabel={editing ? tr('Done', 'Terminé', 'تم') : tr('Edit the instructions', 'Modifier les consignes', 'عدّل الإرشادات')}
          hitSlop={8}
          onPress={() => setEditing((value) => !value)}
          style={({ pressed }) => [styles.edit, pressed && styles.pressed]}
        >
          {editing ? (
            <Text style={[styles.done, arabic && styles.arabicTight]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{tr('Done', 'Terminé', 'تم')}</Text>
          ) : (
            <Icon name="create-outline" size={17} color={COLORS.gold} />
          )}
        </Pressable>}
      </View>
      {editing && onChange ? (
        <TextInput
          accessibilityLabel={heading}
          value={text}
          onChangeText={onChange}
          placeholder={tr(
            'What your father of confession asked of you: the prayers, the readings, the fasts, how often.',
            'Ce que votre père de confession vous a demandé : les prières, les lectures, les jeûnes, à quelle fréquence.',
            'ما طلبه منك أب اعترافك: الصلوات والقراءات والأصوام وعدد مراتها.',
          )}
          placeholderTextColor="rgba(205, 216, 203, 0.55)"
          multiline
          autoFocus
          textAlignVertical="top"
          maxLength={20_000}
          style={[styles.input, arabic && styles.arabicText, Platform.OS === 'web' && styles.inputWeb]}
        />
      ) : (
        <Pressable accessibilityRole={readOnly ? 'text' : 'button'} accessibilityLabel={heading} disabled={readOnly} onPress={() => setEditing(true)} onLongPress={() => setEditing(true)}>
          <Text
            style={[styles.text, arabic && styles.arabicText]}
            numberOfLines={unfolded ? undefined : FOLDED_LINES}
            onTextLayout={(event) => {
              if (!unfolded) setFolds(event.nativeEvent.lines.length >= FOLDED_LINES);
            }}
            maxFontSizeMultiplier={MAX_FONT_SCALE}
          >
            {text.trim()}
          </Text>
        </Pressable>
      )}
      {!editing && (long || unfolded) ? (
        <Pressable accessibilityRole="button" onPress={() => setUnfolded((value) => !value)} style={({ pressed }) => [styles.more, pressed && styles.pressed]}>
          <Text style={[styles.moreText, arabic && styles.arabicTight]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {unfolded ? tr('Show less', 'Afficher moins', 'عرض أقل') : tr('Show all', 'Tout afficher', 'عرض الكل')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
  rtl: { flexDirection: 'row-reverse' },
  card: { borderRadius: 16, gap: 8, overflow: 'hidden', paddingBottom: 14, paddingHorizontal: 16, paddingTop: 12 },
  head: { alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
  kicker: { color: COLORS.gold, flex: 1, fontFamily: TYPOGRAPHY.body, fontSize: 11.5, fontWeight: '700', letterSpacing: 1.6, textTransform: 'uppercase' },
  edit: { alignItems: 'center', height: 28, justifyContent: 'center', minWidth: 28 },
  done: { color: COLORS.gold, fontFamily: TYPOGRAPHY.body, fontSize: 14, fontWeight: '700' },
  text: { color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontSize: 16, lineHeight: 24 },
  input: { color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontSize: 16, lineHeight: 24, minHeight: 96, padding: 0 },
  inputWeb: { outlineStyle: 'none' } as never,
  more: { alignSelf: 'flex-start' },
  moreText: { color: COLORS.gold, fontFamily: TYPOGRAPHY.body, fontSize: 13, fontWeight: '700' },
  add: { alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.04)', borderRadius: 16, flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  addText: { color: COLORS.muted, flex: 1, fontFamily: TYPOGRAPHY.body, fontSize: 14.5 },
  arabic: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'left', writingDirection: 'rtl' },
  arabicText: { fontFamily: TYPOGRAPHY.arabic, writingDirection: 'rtl' },
  arabicTight: { fontFamily: TYPOGRAPHY.arabic, letterSpacing: 0 },
});
