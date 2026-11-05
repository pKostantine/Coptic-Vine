'use no memo'; // Names the highlights in the planner's language.
import { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SERMON_COLORS, SERMON_HIGHLIGHT_COLORS_ORDER, SERMON_HIGHLIGHT_LABELS } from '@/constants/sermonPlanner';
import { MOTION, TYPOGRAPHY } from '@/constants/theme';
import { useModalOrientations } from '@/hooks/useModalOrientations';
import { useReducedMotion } from '@/utils/useReducedMotion';
import type { SermonPart } from '@/types/sermonPlanner';
import { toEasternArabicDigits } from '@/utils/localeFormat';
import Icon from '../ui/Icon';
import { groupReference, partLabel, partTitle, type SermonGroup } from './SermonOutline';
import { pick, sermonStyles } from './SermonPieces';

function digits(value: number, arabic: boolean) {
  return arabic ? toEasternArabicDigits(value) : String(value);
}

/** One highlight: its colour, where it is and what it is ("LUKE 7:37 · ILLUSTRATION"), its words, and placing it. */
export function HighlightRow({
  group, verseReferences, arabic, placedIn, onShow, onPlace, showNote = false,
}: {
  group: SermonGroup;
  verseReferences: Record<string, string>;
  arabic: boolean;
  /** "Point 2", for one already placed. */
  placedIn?: string | null;
  onShow: () => void;
  onPlace: () => void;
  showNote?: boolean;
}) {
  const label = SERMON_HIGHLIGHT_LABELS[group.lead.color];
  const quote = group.segments.map((segment) => segment.quote).join(' ').trim();
  const note = String(group.lead.note || '').trim();
  return (
    <View style={[styles.row, arabic && styles.rtl]}>
      <View style={[styles.bar, { backgroundColor: label.swatch }]} />
      <Pressable accessibilityRole="button" onPress={onShow} style={({ pressed }) => [styles.rowBody, pressed && styles.pressed]}>
        <Text numberOfLines={1} style={[styles.rowHead, arabic && styles.textRight]}>
          {`${groupReference(group, verseReferences, false)} · ${arabic ? label.arabic : label.english}`.toLocaleUpperCase()}
        </Text>
        <Text numberOfLines={showNote ? 3 : 1} style={[styles.rowQuote, arabic && styles.textRight]}>{`“${quote}”`}</Text>
        {showNote && note ? <Text numberOfLines={3} style={[styles.rowNote, arabic && styles.textRight]}>{note}</Text> : null}
      </Pressable>
      {placedIn ? (
        <Pressable accessibilityRole="button" accessibilityLabel={pick(arabic, `In ${placedIn}. Move it`, `في ${placedIn}. انقلها`)} onPress={onPlace} style={({ pressed }) => [styles.placedTag, pressed && styles.pressed]}>
          <Text numberOfLines={1} style={styles.placedText}>{placedIn}</Text>
        </Pressable>
      ) : (
        <Pressable accessibilityRole="button" onPress={onPlace} style={({ pressed }) => [styles.place, pressed && styles.pressed]}>
          <Icon name="add" size={14} color={SERMON_COLORS.onGold} />
          <Text style={styles.placeText}>{pick(arabic, 'Place', 'ضع')}</Text>
        </Pressable>
      )}
    </View>
  );
}

/** The five colours, as dots, with their names for a screen reader. */
function Legend() {
  return (
    <View style={styles.legend}>
      {SERMON_HIGHLIGHT_COLORS_ORDER.map((color) => (
        <View key={color} accessibilityLabel={SERMON_HIGHLIGHT_LABELS[color].english} style={[styles.legendDot, { backgroundColor: SERMON_HIGHLIGHT_LABELS[color].swatch }]} />
      ))}
    </View>
  );
}

/**
 * Under the plan: how many highlights there are and how many wait to be
 * placed, those, each one tap from a part.
 */
export function SermonTray({ total, unplaced, verseReferences, arabic, onShow, onPlace }: {
  total: number;
  unplaced: SermonGroup[];
  verseReferences: Record<string, string>;
  arabic: boolean;
  onShow: (groupId: string) => void;
  onPlace: (groupId: string) => void;
}) {
  return (
    <View style={styles.tray}>
      <View style={[styles.trayHead, arabic && styles.rtl]}>
        <Text style={styles.trayTitle}>{pick(arabic, 'Highlights', 'التظليلات')}</Text>
        <View style={styles.badge}><Text style={styles.badgeText}>{digits(total, arabic)}</Text></View>
        {unplaced.length ? (
          <View style={styles.badge}><Text style={styles.badgeText}>{pick(arabic, `${unplaced.length} to place`, `${digits(unplaced.length, true)} لم توضع`)}</Text></View>
        ) : null}
        <View style={styles.spacer} />
        <Legend />
      </View>
      {total === 0 ? (
        <Text style={[styles.trayEmpty, arabic && styles.textRight]}>{pick(arabic, 'Select a verse in the readings to highlight it into the plan.', 'حدّد آية في القراءات لتضيفها إلى الخطة.')}</Text>
      ) : (
        <ScrollView style={styles.trayList} nestedScrollEnabled>
          {unplaced.map((group) => (
            <HighlightRow key={group.groupId} group={group} verseReferences={verseReferences} arabic={arabic} onShow={() => onShow(group.groupId)} onPlace={() => onPlace(group.groupId)} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

/** The phone's Highlights tab: every highlight, the ones still to place first. */
export function SermonHighlightList({ groups, parts, verseReferences, arabic, onShow, onPlace }: {
  groups: SermonGroup[];
  parts: SermonPart[];
  verseReferences: Record<string, string>;
  arabic: boolean;
  onShow: (groupId: string) => void;
  onPlace: (groupId: string) => void;
}) {
  const partOf = (groupId: string) => parts.find((part) => part.highlightIds.includes(groupId)) ?? null;
  const unplaced = groups.filter((group) => !partOf(group.groupId));
  const placed = groups.filter((group) => partOf(group.groupId));
  if (!groups.length) {
    return <Text style={[styles.trayEmpty, arabic && styles.textRight]}>{pick(arabic, 'Select a verse in the readings to highlight it into the plan.', 'حدّد آية في القراءات لتضيفها إلى الخطة.')}</Text>;
  }
  return (
    <View style={styles.list}>
      {unplaced.length ? <Text style={[sermonStyles.eyebrow, styles.listHead, arabic && styles.textRight]}>{pick(arabic, 'To place', 'لم توضع')}</Text> : null}
      {unplaced.map((group) => (
        <HighlightRow key={group.groupId} group={group} verseReferences={verseReferences} arabic={arabic} showNote onShow={() => onShow(group.groupId)} onPlace={() => onPlace(group.groupId)} />
      ))}
      {placed.length ? <Text style={[sermonStyles.eyebrow, styles.listHead, arabic && styles.textRight]}>{pick(arabic, 'In the plan', 'في الخطة')}</Text> : null}
      {placed.map((group) => {
        const part = partOf(group.groupId);
        return (
          <HighlightRow
            key={group.groupId}
            group={group}
            verseReferences={verseReferences}
            arabic={arabic}
            showNote
            placedIn={part ? partLabel(parts, part, arabic) : null}
            onShow={() => onShow(group.groupId)}
            onPlace={() => onPlace(group.groupId)}
          />
        );
      })}
    </View>
  );
}

/** A sheet over the planner, closed by its backdrop. */
function Sheet({ visible, onClose, children, label }: { visible: boolean; onClose: () => void; children: React.ReactNode; label: string }) {
  const insets = useSafeAreaInsets();
  const modalOrientations = useModalOrientations();
  const reduced = useReducedMotion();
  return (
    <Modal visible={visible} transparent animationType={reduced ? 'none' : 'fade'} onRequestClose={onClose} supportedOrientations={modalOrientations} statusBarTranslucent navigationBarTranslucent>
      <Pressable accessibilityLabel={label} style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { marginBottom: Math.max(16, insets.bottom + 8) }]} onPress={() => undefined}>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Which part a highlight goes in. */
export function PlacePicker({ visible, parts, currentPartId, arabic, onChoose, onUnplace, onClose }: {
  visible: boolean;
  parts: SermonPart[];
  currentPartId: string | null;
  arabic: boolean;
  onChoose: (partId: string) => void;
  onUnplace: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} label={pick(arabic, 'Close', 'إغلاق')}>
      <Text style={[styles.sheetTitle, arabic && styles.textRight]}>{pick(arabic, 'Place in', 'ضعها في')}</Text>
      <ScrollView style={styles.sheetList}>
        {parts.map((part) => {
          const on = part.id === currentPartId;
          return (
            <Pressable
              key={part.id}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => onChoose(part.id)}
              style={({ pressed }) => [styles.option, on && styles.optionOn, arabic && styles.rtl, pressed && styles.pressed]}
            >
              <View style={styles.optionBody}>
                <Text style={[sermonStyles.eyebrow, arabic && styles.textRight]}>{partLabel(parts, part, arabic)}</Text>
                <Text numberOfLines={1} style={[styles.optionTitle, arabic && styles.textRight]}>{partTitle(part, arabic)}</Text>
              </View>
              {on ? <Icon name="checkmark" size={18} color={SERMON_COLORS.gold} /> : null}
            </Pressable>
          );
        })}
      </ScrollView>
      {currentPartId ? (
        <Pressable accessibilityRole="button" onPress={onUnplace} style={({ pressed }) => [styles.sheetQuiet, pressed && styles.pressed]}>
          <Text style={styles.sheetQuietText}>{pick(arabic, 'Take it out of the plan', 'أخرجها من الخطة')}</Text>
        </Pressable>
      ) : null}
    </Sheet>
  );
}

/** A highlight's note, opened from the toolbar's Note. */
export function NoteEditor({ visible, group, verseReferences, arabic, onSave, onRemove, onClose }: {
  visible: boolean;
  group: SermonGroup | null;
  verseReferences: Record<string, string>;
  arabic: boolean;
  onSave: (note: string) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  // Keyed by its highlight where it is drawn, so each one's note starts from its own.
  const [draft, setDraft] = useState(group?.lead.note ?? '');
  if (!group) return null;
  const label = SERMON_HIGHLIGHT_LABELS[group.lead.color];
  const close = () => {
    onSave(draft);
    onClose();
  };
  return (
    <Sheet visible={visible} onClose={close} label={pick(arabic, 'Close', 'إغلاق')}>
      <View style={[styles.noteHead, arabic && styles.rtl]}>
        <View style={[styles.dot, { backgroundColor: label.swatch }]} />
        <Text numberOfLines={1} style={[styles.noteTitle, arabic && styles.textRight]}>
          {`${groupReference(group, verseReferences, false)} · ${arabic ? label.arabic : label.english}`}
        </Text>
      </View>
      <Text numberOfLines={3} style={[styles.rowQuote, styles.noteQuote, arabic && styles.textRight]}>{`“${group.segments.map((segment) => segment.quote).join(' ').trim()}”`}</Text>
      <TextInput
        accessibilityLabel={pick(arabic, 'Note', 'ملاحظة')}
        value={draft}
        onChangeText={setDraft}
        placeholder={pick(arabic, 'A note on this verse', 'ملاحظة على هذه الآية')}
        placeholderTextColor="rgba(255, 255, 255, 0.32)"
        multiline
        autoFocus
        style={[styles.noteInput, arabic && styles.textRight, Platform.OS === 'web' && styles.inputWeb]}
        textAlignVertical="top"
      />
      <View style={[styles.noteActions, arabic && styles.rtl]}>
        <Pressable accessibilityRole="button" onPress={() => { onRemove(); onClose(); }} style={({ pressed }) => [styles.sheetQuiet, pressed && styles.pressed]}>
          <Text style={styles.removeText}>{pick(arabic, 'Remove highlight', 'إزالة التظليل')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={close} style={({ pressed }) => [styles.noteDone, pressed && styles.pressed]}>
          <Text style={styles.noteDoneText}>{pick(arabic, 'Done', 'تم')}</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: MOTION.pressOpacity },
  rtl: { flexDirection: 'row-reverse' },
  textRight: { textAlign: 'right', writingDirection: 'rtl' },
  spacer: { flex: 1 },
  row: { alignItems: 'center', backgroundColor: SERMON_COLORS.raised, borderRadius: 14, flexDirection: 'row', gap: 12, marginTop: 9, paddingHorizontal: 12, paddingVertical: 10 },
  bar: { alignSelf: 'stretch', borderRadius: 999, width: 4 },
  rowBody: { flex: 1, minWidth: 0 },
  rowHead: { color: SERMON_COLORS.text, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  rowQuote: { color: '#E8ECE7', fontFamily: TYPOGRAPHY.title, fontSize: 14, lineHeight: 19.6, marginTop: 2 },
  rowNote: { color: SERMON_COLORS.muted, fontSize: 13, lineHeight: 18, marginTop: 4 },
  place: { alignItems: 'center', backgroundColor: SERMON_COLORS.gold, borderRadius: 999, flexDirection: 'row', gap: 4, height: 30, paddingHorizontal: 12 },
  placeText: { color: SERMON_COLORS.onGold, fontSize: 12.5, fontWeight: '700' },
  placedTag: { backgroundColor: SERMON_COLORS.fill, borderRadius: 999, maxWidth: 110, paddingHorizontal: 10, paddingVertical: 6 },
  placedText: { color: SERMON_COLORS.muted, fontSize: 12, fontWeight: '600' },
  tray: { backgroundColor: SERMON_COLORS.tray, paddingBottom: 14, paddingHorizontal: 22, paddingTop: 10 },
  trayHead: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  trayTitle: { color: SERMON_COLORS.text, fontSize: 13, fontWeight: '700' },
  badge: { backgroundColor: 'rgba(227, 181, 59, 0.14)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: SERMON_COLORS.gold, fontSize: 11.5, fontWeight: '700' },
  legend: { flexDirection: 'row', gap: 8 },
  legendDot: { borderRadius: 999, height: 9, width: 9 },
  trayEmpty: { color: SERMON_COLORS.muted, fontSize: 13, lineHeight: 19, marginTop: 8 },
  trayList: { maxHeight: 170 },
  list: { paddingBottom: 24 },
  listHead: { marginBottom: -2, marginTop: 14 },
  backdrop: { alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.55)', flex: 1, justifyContent: 'flex-end', paddingHorizontal: 12 },
  sheet: { backgroundColor: '#1A2A1E', borderRadius: 18, maxWidth: 480, padding: 14, width: '100%' },
  sheetTitle: { color: SERMON_COLORS.text, fontFamily: TYPOGRAPHY.title, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  sheetList: { maxHeight: 360 },
  option: { alignItems: 'center', borderRadius: 12, flexDirection: 'row', gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  optionOn: { backgroundColor: 'rgba(255, 255, 255, 0.07)' },
  optionBody: { flex: 1, minWidth: 0 },
  optionTitle: { color: SERMON_COLORS.text, fontFamily: TYPOGRAPHY.title, fontSize: 15.5, fontWeight: '600', marginTop: 2 },
  sheetQuiet: { alignItems: 'center', paddingVertical: 10 },
  sheetQuietText: { color: SERMON_COLORS.muted, fontSize: 13.5, fontWeight: '600' },
  removeText: { color: '#E88484', fontSize: 13.5, fontWeight: '600' },
  dot: { borderRadius: 999, height: 10, width: 10 },
  noteHead: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  noteTitle: { color: SERMON_COLORS.text, flex: 1, fontSize: 13, fontWeight: '700', letterSpacing: 0.4 },
  noteQuote: { marginBottom: 10, marginTop: 6 },
  noteInput: { backgroundColor: 'rgba(255, 255, 255, 0.06)', borderRadius: 12, color: SERMON_COLORS.text, fontSize: 15, lineHeight: 21, minHeight: 110, padding: 12 },
  inputWeb: { outlineStyle: 'none' } as never,
  noteActions: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  noteDone: { alignItems: 'center', backgroundColor: SERMON_COLORS.gold, borderRadius: 999, height: 36, justifyContent: 'center', paddingHorizontal: 18 },
  noteDoneText: { color: SERMON_COLORS.onGold, fontSize: 14, fontWeight: '700' },
});
