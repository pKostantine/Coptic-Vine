'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { LinearGradient } from 'expo-linear-gradient';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import Icon from '@/components/vine/ui/Icon';
import SheetFrame from '@/components/vine/ui/SheetFrame';
import { Switch } from '@/components/vine/ui/ToggleRow';
import { COLORS, TYPOGRAPHY } from '@/constants/theme';
import { tr } from '@/utils/appText';
import { WEEKDAYS, type Weekday } from '@/utils/spiritualCanon';

import { canonTimeLabel, weekdayInitial, weekdayShort } from './canonText';
import TimeWheel from './TimeWheel';

const MAX_FONT_SCALE = 1.3;

/** A card of the editor: the rows' green fade, its pieces 12pt apart. */
export function EditorCard({ children, style }: { children: ReactNode; style?: object }) {
  return (
    <View style={[styles.card, style]}>
      <LinearGradient colors={[COLORS.surfaceDeep, COLORS.surface]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      {children}
    </View>
  );
}

/** A small gold label over a group of choices. */
export function FieldLabel({ children, arabic }: { children: string; arabic: boolean }) {
  return <Text style={[styles.fieldLabel, arabic && styles.fieldLabelArabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{arabic ? children : children.toUpperCase()}</Text>;
}

/** Choices in a pill, the chosen one gold (the Home cards' segment). */
export function ChoiceSegment<T extends string>({ options, selected, onSelect, arabic }: {
  options: { key: T; label: string }[];
  selected: T;
  onSelect: (key: T) => void;
  arabic: boolean;
}) {
  return (
    <View style={styles.segment} accessibilityRole="radiogroup">
      {options.map((option) => {
        const active = option.key === selected;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            aria-checked={active}
            onPress={() => onSelect(option.key)}
            style={[styles.segmentOption, active && styles.segmentOptionActive]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive, arabic && styles.arabicTight]} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Choices one under another, a gold ring for each and the chosen one filled: for more than a pill holds, or choices that need a word of explanation. */
export function ChoiceList<T extends string>({ options, selected, onSelect, arabic }: {
  options: { key: T; label: string; detail?: string | null }[];
  selected: T;
  onSelect: (key: T) => void;
  arabic: boolean;
}) {
  return (
    <View accessibilityRole="radiogroup">
      {options.map((option, index) => {
        const active = option.key === selected;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            aria-checked={active}
            onPress={() => onSelect(option.key)}
            style={({ pressed }) => [styles.choice, index > 0 && styles.choiceRule, pressed && styles.pressed]}
          >
            <View style={[styles.radio, active && styles.radioOn]}>{active ? <View style={styles.radioDot} /> : null}</View>
            <View style={styles.flex}>
              <Text style={[styles.choiceLabel, active && styles.choiceLabelOn, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{option.label}</Text>
              {option.detail ? <Text style={[styles.inlineDetail, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{option.detail}</Text> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A number with round − and + either side of it. */
export function Stepper({ value, min, max, step, label, format, onChange }: {
  value: number;
  min: number;
  max: number;
  /** How far one tap moves: a fixed amount, or worked out from where it stands (verses: by ones, then by fives). */
  step: number | ((value: number, up: boolean) => number);
  /** What the number counts, for a screen reader: "Psalms". */
  label: string;
  format: (value: number) => string;
  onChange: (value: number) => void;
}) {
  const down = Math.max(min, typeof step === 'function' ? step(value, false) : value - step);
  const up = Math.min(max, typeof step === 'function' ? step(value, true) : value + step);
  return (
    <View style={styles.stepper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${tr('fewer', 'moins', 'أقل')}`}
        disabled={value <= min}
        hitSlop={6}
        onPress={() => onChange(down)}
        style={({ pressed }) => [styles.stepButton, value <= min && styles.stepButtonOff, pressed && styles.pressed]}
      >
        <Icon name="remove" size={18} color={COLORS.gold} />
      </Pressable>
      <Text style={styles.stepValue} accessibilityLabel={`${label}: ${format(value)}`} maxFontSizeMultiplier={MAX_FONT_SCALE} numberOfLines={1}>{format(value)}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${tr('more', 'plus', 'أكثر')}`}
        disabled={value >= max}
        hitSlop={6}
        onPress={() => onChange(up)}
        style={({ pressed }) => [styles.stepButton, value >= max && styles.stepButtonOff, pressed && styles.pressed]}
      >
        <Icon name="add" size={18} color={COLORS.gold} />
      </Pressable>
    </View>
  );
}

/**
 * The days of the week as seven rounds, Sunday first: chosen ones gold. With
 * `marked`, a day that already has something gets a dot (the Agpeya's days).
 */
export function WeekdayChips({ selected, onToggle, arabic, marked }: {
  selected: readonly Weekday[];
  onToggle: (day: Weekday) => void;
  arabic: boolean;
  marked?: readonly Weekday[];
}) {
  return (
    <View style={styles.weekdays}>
      {WEEKDAYS.map((day) => {
        const active = selected.includes(day);
        return (
          <Pressable
            key={day}
            accessibilityRole="checkbox"
            accessibilityLabel={weekdayShort(day)}
            accessibilityState={{ checked: active }}
            aria-checked={active}
            onPress={() => onToggle(day)}
            style={({ pressed }) => [styles.weekday, active && styles.weekdayActive, pressed && styles.pressed]}
          >
            <Text style={[styles.weekdayText, active && styles.weekdayTextActive, arabic && styles.arabicTight]} maxFontSizeMultiplier={1.2}>{weekdayInitial(day)}</Text>
            {marked ? <View style={[styles.weekdayMark, marked.includes(day) && (active ? styles.weekdayMarkActive : styles.weekdayMarkOn)]} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** A row with a label and a switch (the Downloads page's switch rows, inside a card). */
export function InlineSwitch({ icon, label, detail, on, disabled = false, onPress, arabic }: {
  icon?: 'notifications-outline' | 'time-outline';
  label: string;
  detail?: string | null;
  on: boolean;
  disabled?: boolean;
  onPress: () => void;
  arabic: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: on, disabled }}
      aria-checked={on}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.inlineRow, disabled && styles.disabled, pressed && styles.pressed]}
    >
      {icon ? <Icon name={icon} size={19} color={on ? COLORS.gold : COLORS.muted} /> : null}
      <View style={styles.flex}>
        <Text style={[styles.inlineLabel, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{label}</Text>
        {detail ? <Text style={[styles.inlineDetail, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{detail}</Text> : null}
      </View>
      <Switch on={on && !disabled} />
    </Pressable>
  );
}

/**
 * When a task is kept, and whether to be reminded then: a time of day (or
 * none, "any time"), chosen in a sheet; with a time, the reminder's switch.
 */
export function TimeAndReminder({ time, remind, suggestedTime, arabic, remindersNote, onChange }: {
  time: string | null;
  remind: boolean;
  /** The time the sheet opens on when there is none yet: an hour's own, or the morning. */
  suggestedTime: string;
  arabic: boolean;
  /** Under the switch: why reminders may not come (turned off on this device, not allowed, the web). */
  remindersNote?: string | null;
  onChange: (next: { time: string | null; remind: boolean }) => void;
}) {
  const [picking, setPicking] = useState(false);
  return (
    <View style={styles.timeBlock}>
      <View style={styles.inlineRow}>
        <Icon name="time-outline" size={19} color={time ? COLORS.gold : COLORS.muted} />
        <Text style={[styles.inlineLabel, styles.flex, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{tr('Time of day', 'Heure', 'الوقت')}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${tr('Time of day', 'Heure', 'الوقت')}: ${time ? canonTimeLabel(time) : tr('Any time', 'N’importe quand', 'أي وقت')}`}
          onPress={() => setPicking(true)}
          style={({ pressed }) => [styles.timePill, time && styles.timePillSet, pressed && styles.pressed]}
        >
          <Text style={[styles.timePillText, time && styles.timePillTextSet, arabic && styles.arabicTight]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {time ? canonTimeLabel(time) : tr('Any time', 'N’importe quand', 'أي وقت')}
          </Text>
        </Pressable>
        {time ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tr('Clear the time', 'Effacer l’heure', 'امسح الوقت')}
            hitSlop={8}
            onPress={() => onChange({ time: null, remind: false })}
            style={({ pressed }) => [styles.clear, pressed && styles.pressed]}
          >
            <Icon name="close" size={14} color={COLORS.muted} />
          </Pressable>
        ) : null}
      </View>
      <InlineSwitch
        icon="notifications-outline"
        label={tr('Remind me', 'Me le rappeler', 'ذكّرني')}
        detail={time
          ? remind
            ? remindersNote ?? `${tr('A notification at', 'Une notification à', 'إشعار في')} ${canonTimeLabel(time)}`
            : tr('No notification', 'Aucune notification', 'بلا إشعار')
          : tr('Set a time to be reminded', 'Choisissez une heure pour un rappel', 'اختر وقتًا لتلقي تذكير')}
        on={remind && Boolean(time)}
        onPress={() => {
          if (!time) {
            setPicking(true);
            return;
          }
          onChange({ time, remind: !remind });
        }}
        arabic={arabic}
      />
      <TimeSheet
        visible={picking}
        initial={time ?? suggestedTime}
        arabic={arabic}
        onClose={() => setPicking(false)}
        onDone={(next) => {
          setPicking(false);
          // A time chosen to be reminded at turns the reminder on.
          onChange({ time: next, remind: time ? remind : true });
        }}
      />
    </View>
  );
}

/**
 * The time of day, chosen on a sheet: the wheels of TimeWheel (the system's
 * own on the iPhone and iPad), then Set. The sheet is dragged closed by its
 * handle alone, so turning a wheel never closes it.
 */
function TimeSheet({ visible, initial, arabic, onClose, onDone }: {
  visible: boolean;
  initial: string;
  arabic: boolean;
  onClose: () => void;
  onDone: (time: string) => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [shownFor, setShownFor] = useState<string | null>(null);
  // Opened afresh, the sheet starts from the task's time.
  if (visible && shownFor !== initial) {
    setShownFor(initial);
    setDraft(initial);
  }
  if (!visible && shownFor !== null) setShownFor(null);

  return (
    <SheetFrame visible={visible} onClose={onClose} closeLabel={tr('Close', 'Fermer', 'إغلاق')} dialogWidth={400} scroll={false}>
      <View style={styles.sheet}>
        <View style={styles.sheetHead}>
          <Pressable accessibilityRole="button" hitSlop={8} onPress={onClose} style={({ pressed }) => [styles.sheetSide, pressed && styles.pressed]}>
            <Text style={[styles.sheetCancel, arabic && styles.arabicTight]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{tr('Cancel', 'Annuler', 'إلغاء')}</Text>
          </Pressable>
          <Text style={[styles.sheetKicker, arabic && styles.arabicTight]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{tr('Time of day', 'Heure', 'الوقت')}</Text>
          <View style={styles.sheetSide} />
        </View>
        {/* Mounted afresh on each opening, on the task's own time. */}
        {visible ? <TimeWheel key={shownFor ?? initial} time={draft} arabic={arabic} onChange={setDraft} /> : null}
        <Pressable accessibilityRole="button" onPress={() => onDone(draft)} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
          <Text style={[styles.primaryText, arabic && styles.arabicTight]}>{`${tr('Set', 'Choisir', 'اختر')} ${canonTimeLabel(draft)}`}</Text>
        </Pressable>
      </View>
    </SheetFrame>
  );
}

/** The editor's main button: gold, the width of the page. */
export function PrimaryButton({ label, onPress, disabled = false, arabic }: { label: string; onPress: () => void; disabled?: boolean; arabic: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.primary, disabled && styles.disabled, pressed && styles.pressed]}
    >
      <Text style={[styles.primaryText, arabic && styles.arabicTight]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.45 },
  card: { borderRadius: 18, gap: 12, overflow: 'hidden', padding: 14 },
  fieldLabel: { color: COLORS.goldBright, fontFamily: TYPOGRAPHY.body, fontSize: 11.5, fontWeight: '700', letterSpacing: 1.2 },
  fieldLabelArabic: { fontFamily: TYPOGRAPHY.arabic, fontSize: 13, letterSpacing: 0, textAlign: 'left', writingDirection: 'rtl' },

  segment: { backgroundColor: COLORS.black, borderColor: COLORS.border, borderRadius: 99, borderWidth: 1, flexDirection: 'row', gap: 4, padding: 4 },
  segmentOption: { alignItems: 'center', borderRadius: 99, flex: 1, paddingHorizontal: 6, paddingVertical: 8 },
  segmentOptionActive: { backgroundColor: COLORS.gold },
  segmentText: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 13.5, fontWeight: '600' },
  segmentTextActive: { color: COLORS.greenDeep },

  choice: { alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: 46, paddingVertical: 9 },
  choiceRule: { borderTopColor: 'rgba(255, 255, 255, 0.07)', borderTopWidth: 1 },
  radio: { alignItems: 'center', borderColor: COLORS.goldLine, borderRadius: 11, borderWidth: 1.5, height: 22, justifyContent: 'center', width: 22 },
  radioOn: { borderColor: COLORS.gold },
  radioDot: { backgroundColor: COLORS.gold, borderRadius: 5, height: 10, width: 10 },
  choiceLabel: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 15, fontWeight: '600' },
  choiceLabelOn: { color: COLORS.white },

  stepper: { alignItems: 'center', alignSelf: 'stretch', backgroundColor: 'rgba(0, 0, 0, 0.3)', borderRadius: 14, flexDirection: 'row', gap: 10, justifyContent: 'space-between', padding: 6 },
  stepButton: { alignItems: 'center', borderColor: COLORS.goldLine, borderRadius: 18, borderWidth: 1, height: 36, justifyContent: 'center', width: 36 },
  stepButtonOff: { opacity: 0.35 },
  stepValue: { color: COLORS.white, flex: 1, fontFamily: TYPOGRAPHY.title, fontSize: 19, fontWeight: '700', textAlign: 'center' },

  weekdays: { flexDirection: 'row', gap: 6, justifyContent: 'space-between' },
  weekday: { alignItems: 'center', aspectRatio: 1, borderColor: COLORS.goldLine, borderRadius: 99, borderWidth: 1, flex: 1, justifyContent: 'center', maxWidth: 46 },
  weekdayActive: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  weekdayText: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 14, fontWeight: '700' },
  weekdayTextActive: { color: COLORS.greenDeep },
  weekdayMark: { borderRadius: 2, bottom: 5, height: 4, position: 'absolute', width: 4 },
  weekdayMarkOn: { backgroundColor: COLORS.gold },
  weekdayMarkActive: { backgroundColor: COLORS.greenDeep },

  inlineRow: { alignItems: 'center', flexDirection: 'row', gap: 10, minHeight: 44 },
  inlineLabel: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 15, fontWeight: '600' },
  inlineDetail: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 12.5, marginTop: 2 },
  timeBlock: { gap: 4 },
  timePill: { alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.07)', borderRadius: 99, height: 34, justifyContent: 'center', paddingHorizontal: 14 },
  timePillSet: { backgroundColor: COLORS.goldSoft },
  timePillText: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 14, fontWeight: '700' },
  timePillTextSet: { color: COLORS.gold },
  clear: { alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.08)', borderRadius: 14, height: 28, justifyContent: 'center', width: 28 },

  sheet: { gap: 12, paddingBottom: 8, paddingHorizontal: 20, paddingTop: 6 },
  sheetHead: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  sheetSide: { minWidth: 72 },
  sheetCancel: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 15, fontWeight: '600' },
  sheetKicker: { color: COLORS.gold, fontFamily: TYPOGRAPHY.body, fontSize: 12, fontWeight: '700', letterSpacing: 1.7, textAlign: 'center', textTransform: 'uppercase' },

  primary: { alignItems: 'center', backgroundColor: COLORS.gold, borderRadius: 14, height: 48, justifyContent: 'center', marginTop: 4 },
  primaryText: { color: COLORS.greenDeep, fontFamily: TYPOGRAPHY.body, fontSize: 15.5, fontWeight: '700' },

  arabic: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'left', writingDirection: 'rtl' },
  arabicTight: { fontFamily: TYPOGRAPHY.arabic, letterSpacing: 0 },
});
