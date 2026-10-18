'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import Icon from '@/components/vine/ui/Icon';
import { COLORS, TYPOGRAPHY } from '@/constants/theme';
import { tr } from '@/utils/appText';
import { formatDayMonthDate, toEasternArabicDigits } from '@/utils/localeFormat';
import { canonDayDate, canonWeekday, type CanonTask } from '@/utils/spiritualCanon';

import { canonTaskDetail, canonTaskTitle, weekdayInitial } from './canonText';

const MAX_FONT_SCALE = 1.3;

/** A task's tick: a gold ring, filled gold with a check once done. */
export function CanonCheck({ done, disabled = false, label, onPress, size = 28 }: {
  done: boolean;
  disabled?: boolean;
  label: string;
  onPress: () => void;
  size?: number;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: done, disabled }}
      aria-checked={done}
      disabled={disabled}
      hitSlop={10}
      onPress={onPress}
      style={({ pressed }) => [
        styles.check,
        { borderRadius: size / 2, height: size, width: size },
        done && styles.checkDone,
        disabled && styles.checkDisabled,
        pressed && styles.pressed,
      ]}
    >
      {done ? <Icon name="checkmark" size={Math.round(size * 0.62)} color={COLORS.greenDeep} /> : null}
    </Pressable>
  );
}

/**
 * One task of a day: its tick, its name and what it asks, and — for the
 * Agpeya and the Bible — the way into the prayer or the reading. On Home the
 * rows sit on the framed card, a hairline apart; on the canon's own page each
 * is a card of its own.
 */
export function CanonTaskRow({ task, arabic, variant, first = false, disabled = false, onToggle, onOpen }: {
  task: CanonTask;
  arabic: boolean;
  variant: 'home' | 'card';
  first?: boolean;
  /** A day still to come: shown, not yet to be ticked. */
  disabled?: boolean;
  onToggle: (done: boolean) => void;
  onOpen?: () => void;
}) {
  const title = canonTaskTitle(task);
  const detail = canonTaskDetail(task);
  const opens = task.kind !== 'custom' && onOpen;
  const action = task.kind === 'agpeya' ? tr('Pray', 'Prier', 'صلِّ') : tr('Read', 'Lire', 'اقرأ');
  const body = (
    <>
      <View style={styles.text}>
        <Text style={[styles.title, task.done && styles.titleDone, arabic && styles.arabic]} numberOfLines={2} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {title}
        </Text>
        {detail ? (
          <Text style={[styles.detail, arabic && styles.arabic]} numberOfLines={2} maxFontSizeMultiplier={MAX_FONT_SCALE}>{detail}</Text>
        ) : null}
      </View>
      {opens ? (
        <View style={[styles.open, task.done && styles.openDone]}>
          <Icon name={task.kind === 'agpeya' ? 'play' : 'book-outline'} size={12} color={task.done ? COLORS.muted : COLORS.gold} />
          <Text style={[styles.openText, task.done && styles.openTextDone, arabic && styles.arabicTight]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{action}</Text>
        </View>
      ) : null}
    </>
  );
  const checkLabel = task.done
    ? `${title}: ${tr('done. Tap to undo', 'accompli. Touchez pour annuler', 'مكتمل. اضغط للتراجع')}`
    : `${title}: ${tr('mark as done', 'marquer comme accompli', 'علّم كمكتمل')}`;

  return (
    <View style={[styles.row, variant === 'card' ? styles.rowCard : [styles.rowHome, !first && styles.rowHomeRule]]}>
      {variant === 'card' ? <LinearGradient colors={[COLORS.surfaceDeep, COLORS.surface]} style={StyleSheet.absoluteFill} pointerEvents="none" /> : null}
      <CanonCheck done={task.done} disabled={disabled} label={checkLabel} onPress={() => onToggle(!task.done)} />
      {opens ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${action}: ${title}`}
          onPress={onOpen}
          style={({ pressed }) => [styles.body, pressed && styles.pressed]}
        >
          {body}
        </Pressable>
      ) : (
        // A task with nowhere to open ticks from anywhere on its row.
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={checkLabel}
          disabled={disabled}
          onPress={() => onToggle(!task.done)}
          style={({ pressed }) => [styles.body, pressed && styles.pressed]}
        >
          {body}
        </Pressable>
      )}
    </View>
  );
}

/** How much of a day is done, as a thin gold bar. */
export function CanonProgressBar({ done, total }: { done: number; total: number }) {
  const share = total > 0 ? Math.min(1, done / total) : 0;
  return (
    <View style={styles.track} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.fill, { width: `${share * 100}%` }]} />
    </View>
  );
}

export type CanonDayState = 'free' | 'open' | 'partial' | 'done';

/**
 * The week, Sunday to Saturday: each day's letter and date, the day shown in
 * gold, today ringed, and under each a dot for how much of it was kept.
 */
export function CanonWeekStrip({ days, selected, today, arabic, stateOf, onSelect }: {
  days: string[];
  selected: string;
  today: string;
  arabic: boolean;
  stateOf: (day: string) => CanonDayState;
  onSelect: (day: string) => void;
}) {
  return (
    <View style={styles.week}>
      {days.map((day) => {
        const active = day === selected;
        const state = stateOf(day);
        const date = canonDayDate(day).getUTCDate();
        return (
          <Pressable
            key={day}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={formatDayMonthDate(canonDayDate(day), arabic)}
            onPress={() => onSelect(day)}
            style={({ pressed }) => [styles.weekDay, active && styles.weekDayActive, !active && day === today && styles.weekDayToday, pressed && styles.pressed]}
          >
            <Text style={[styles.weekLetter, active && styles.weekTextActive, arabic && styles.arabicTight]} maxFontSizeMultiplier={1.2}>
              {weekdayInitial(canonWeekday(day))}
            </Text>
            <Text style={[styles.weekDate, active && styles.weekTextActive]} maxFontSizeMultiplier={1.2}>
              {arabic ? toEasternArabicDigits(date) : date}
            </Text>
            <View
              style={[
                styles.weekDot,
                state === 'done' && (active ? styles.weekDotDoneActive : styles.weekDotDone),
                state === 'partial' && (active ? styles.weekDotPartialActive : styles.weekDotPartial),
                state === 'open' && (active ? styles.weekDotOpenActive : styles.weekDotOpen),
              ]}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
  check: { alignItems: 'center', borderColor: COLORS.goldLine, borderWidth: 1.5, justifyContent: 'center' },
  checkDone: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  checkDisabled: { opacity: 0.4 },

  row: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  rowHome: { paddingVertical: 11 },
  rowHomeRule: { borderTopColor: 'rgba(255, 255, 255, 0.07)', borderTopWidth: 1 },
  rowCard: { borderRadius: 16, minHeight: 64, overflow: 'hidden', paddingHorizontal: 14, paddingVertical: 11 },
  body: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 10, minWidth: 0 },
  text: { flex: 1, minWidth: 0 },
  title: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 16, fontWeight: '600', lineHeight: 21 },
  titleDone: { color: COLORS.muted, opacity: 0.75, textDecorationLine: 'line-through' },
  detail: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 13, marginTop: 2 },
  open: { alignItems: 'center', borderColor: COLORS.goldLine, borderRadius: 99, borderWidth: 1, flexDirection: 'row', gap: 5, height: 30, paddingHorizontal: 11 },
  openDone: { borderColor: 'rgba(255, 255, 255, 0.14)' },
  openText: { color: COLORS.gold, fontFamily: TYPOGRAPHY.body, fontSize: 13, fontWeight: '700' },
  openTextDone: { color: COLORS.muted },

  track: { backgroundColor: 'rgba(255, 255, 255, 0.09)', borderRadius: 2, height: 4, overflow: 'hidden' },
  fill: { backgroundColor: COLORS.gold, borderRadius: 2, height: 4 },

  week: { flexDirection: 'row', gap: 6 },
  weekDay: { alignItems: 'center', borderColor: 'transparent', borderRadius: 16, borderWidth: 1, flex: 1, gap: 3, paddingBottom: 8, paddingTop: 7 },
  weekDayActive: { backgroundColor: COLORS.gold },
  weekDayToday: { borderColor: COLORS.goldLine },
  weekLetter: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  weekDate: { color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontSize: 17, fontWeight: '700' },
  weekTextActive: { color: COLORS.greenDeep },
  weekDot: { borderRadius: 3, height: 6, marginTop: 1, width: 6 },
  weekDotOpen: { backgroundColor: 'rgba(255, 255, 255, 0.18)' },
  weekDotOpenActive: { backgroundColor: 'rgba(20, 48, 27, 0.35)' },
  weekDotPartial: { borderColor: COLORS.gold, borderWidth: 1.5 },
  weekDotPartialActive: { borderColor: COLORS.greenDeep, borderWidth: 1.5 },
  weekDotDone: { backgroundColor: COLORS.gold },
  weekDotDoneActive: { backgroundColor: COLORS.greenDeep },

  arabic: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'left', writingDirection: 'rtl' },
  arabicTight: { fontFamily: TYPOGRAPHY.arabic, letterSpacing: 0 },
});
