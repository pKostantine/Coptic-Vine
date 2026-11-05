'use no memo'; // Names the day in the planner's language.
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { DAY_BLOCK_GRADIENT_END, DAY_BLOCK_GRADIENT_START, type DayBlockTheme } from '@/constants/seasonAppearance';
import { SERMON_COLORS, SERMON_STATE_NAMES, SERMON_STATE_TAGS } from '@/constants/sermonPlanner';
import { MOTION, TYPOGRAPHY } from '@/constants/theme';
import { shortCopticMonth, useSermonDay, type SermonDay } from '@/hooks/useSermonDay';
import type { SermonPlanState, SermonPlanSummary } from '@/types/sermonPlanner';
import { formatCopticDayMonth, formatCopticMonthName, formatDayMonthYearDate, toEasternArabicDigits } from '@/utils/localeFormat';
import Icon, { type IconName } from '../ui/Icon';

/** English or Arabic, as the planner is set to. */
export function pick(arabic: boolean, english: string, inArabic: string): string {
  return arabic ? inArabic : english;
}

/** A season's 160° gradient behind its children: the date pill, a plan's date tile. */
export function SeasonFill({ theme, style, children }: { theme: DayBlockTheme; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  return (
    <View style={[style, { overflow: 'hidden' }]}>
      <LinearGradient
        colors={[theme.from, theme.to]}
        locations={[0, theme.toAt]}
        start={DAY_BLOCK_GRADIENT_START}
        end={DAY_BLOCK_GRADIENT_END}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* Above the gradient on the web, which otherwise paints an icon beside it underneath. */}
      <View style={styles.fillContent}>{children}</View>
    </View>
  );
}

/** "Wednesday, 7 April 2027". */
export function longGregorian(isoDate: string, arabic: boolean): string {
  return formatDayMonthYearDate(new Date(`${isoDate}T00:00:00Z`), arabic);
}

/**
 * The one date control: the day in its season's colour, the Coptic date, the
 * Gregorian when there's room, and a chevron. It opens the calendar.
 */
export function SermonDatePill({ day, arabic, wide, onPress }: { day: SermonDay; arabic: boolean; wide: boolean; onPress: () => void }) {
  const coptic = day.coptic ? formatCopticDayMonth(day.coptic.monthName, day.coptic.day, arabic) : '';
  const gregorian = longGregorian(day.isoDate, arabic);
  const ink = day.theme.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={pick(arabic, `Choose the day: ${gregorian}`, `اختر اليوم: ${gregorian}`)}
      onPress={onPress}
      style={({ pressed }) => [styles.pillOuter, wide ? styles.pillWide : styles.pillCompact, pressed && styles.pressed]}
    >
      <SeasonFill theme={day.theme} style={[styles.pill, wide ? styles.pillWide : styles.pillCompact]}>
        <View style={[styles.pillRow, arabic && styles.rtl]}>
          <Icon name="calendar-outline" size={wide ? 17 : 15} color={ink} />
          <Text numberOfLines={1} style={[styles.pillText, !wide && styles.pillTextCompact, { color: ink }]}>
            <Text style={styles.pillStrong}>{coptic || gregorian}</Text>
            {wide && coptic ? <Text style={{ color: day.theme.muted }}>{`  ·  ${gregorian}`}</Text> : null}
          </Text>
          <Icon name="chevron-down" size={wide ? 15 : 13} color={ink} />
        </View>
      </SeasonFill>
    </Pressable>
  );
}

/** A small round button: back, more. */
export function RoundButton({ icon, label, onPress, size = 38 }: { icon: IconName; label: string; onPress: () => void; size?: number }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [styles.round, { width: size, height: size }, pressed && styles.pressed]}
    >
      <Icon name={icon} size={Math.round(size * 0.48)} color={SERMON_COLORS.gold} />
    </Pressable>
  );
}

/** A pill button: "Plans", "Done", "Aa". */
export function PillButton({ icon, label, onPress, accessibilityLabel }: { icon?: IconName; label: string; onPress: () => void; accessibilityLabel?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={({ pressed }) => [styles.pillButton, pressed && styles.pressed]}
    >
      {icon ? <Icon name={icon} size={18} color={SERMON_COLORS.gold} /> : null}
      <Text style={styles.pillButtonText}>{label}</Text>
    </Pressable>
  );
}

/** The gold call to action: Preach, Plan a day. */
export function GoldButton({ icon, label, onPress, compact = false }: { icon: IconName; label: string; onPress: () => void; compact?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.gold, compact && styles.goldCompact, pressed && styles.pressed]}
    >
      <Icon name={icon} size={compact ? 14 : 16} color={SERMON_COLORS.onGold} />
      <Text style={[styles.goldText, compact && styles.goldTextCompact]}>{label}</Text>
    </Pressable>
  );
}

/** A segmented choice: English | Arabic, Plan | Readings | Highlights. */
export function Segmented<K extends string>({
  options,
  value,
  onChange,
  stretch = false,
}: {
  options: { key: K; label: string; badge?: string }[];
  value: K;
  onChange: (key: K) => void;
  stretch?: boolean;
}) {
  return (
    <View accessibilityRole="tablist" style={[styles.seg, stretch && styles.segStretch]}>
      {options.map((option) => {
        const on = option.key === value;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(option.key)}
            style={[styles.segItem, stretch && styles.segItemStretch, on && (stretch ? styles.segItemOnRaised : styles.segItemOn)]}
          >
            <Text style={[styles.segText, on && (stretch ? styles.segTextOnRaised : styles.segTextOn)]}>
              {option.label}
              {option.badge ? <Text style={styles.segBadge}>{` ${option.badge}`}</Text> : null}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A plan's state as a tag: Draft, Ready. */
export function StateTag({ state, arabic }: { state: SermonPlanState; arabic: boolean }) {
  const tag = SERMON_STATE_TAGS[state];
  const name = SERMON_STATE_NAMES[state];
  return (
    <View style={[styles.tag, { backgroundColor: tag.fill }]}>
      <Text style={[styles.tagText, { color: tag.ink }]}>{arabic ? name.arabic : name.english}</Text>
    </View>
  );
}

/** "4 of 6 parts". */
export function partsLabel(written: number, total: number, arabic: boolean): string {
  return arabic ? `${toEasternArabicDigits(written)} من ${toEasternArabicDigits(total)} أجزاء` : `${written} of ${total} parts`;
}

/** "18 min". */
export function minutesLabel(minutes: number, arabic: boolean): string {
  return arabic ? `${toEasternArabicDigits(minutes)} دقيقة` : `${minutes} min`;
}

/**
 * A plan in the list: its day as a tile in the season's colour, its name and
 * date, and how far along it is.
 */
export function SermonPlanCard({
  plan,
  arabic,
  selected = false,
  compact = false,
  fallbackTitle,
  onPress,
  onLongPress,
}: {
  plan: SermonPlanSummary;
  arabic: boolean;
  selected?: boolean;
  compact?: boolean;
  fallbackTitle: (day: SermonDay) => string;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const day = useSermonDay(plan.serviceDate);
  const light = day.seasonKey === 'resurrection';
  const tileInk = light ? '#2B2A24' : '#FFFFFF';
  const title = plan.title.trim() || fallbackTitle(day);
  const month = day.coptic ? (arabic ? formatCopticMonthName(day.coptic.monthName, true) : shortCopticMonth(day.coptic.monthName)) : '';
  const progress = plan.totalParts ? plan.writtenParts / plan.totalParts : 0;
  const preachedMinutes = plan.preachedSeconds ? Math.max(1, Math.round(plan.preachedSeconds / 60)) : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${longGregorian(plan.serviceDate, arabic)}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.card,
        compact && styles.cardCompact,
        compact && !selected && styles.cardBare,
        selected && styles.cardOn,
        arabic && styles.rtl,
        pressed && styles.pressed,
      ]}
    >
      <SeasonFill theme={day.theme} style={[styles.tile, compact && styles.tileCompact]}>
        <View style={styles.tileInner}>
          <Text numberOfLines={1} style={[styles.tileMonth, compact && styles.tileMonthCompact, { color: tileInk }]}>{month}</Text>
          <Text style={[styles.tileDay, compact && styles.tileDayCompact, { color: tileInk }]}>
            {day.coptic ? (arabic ? toEasternArabicDigits(day.coptic.day) : String(day.coptic.day)) : ''}
          </Text>
        </View>
      </SeasonFill>
      <View style={styles.cardBody}>
        <Text numberOfLines={2} style={[styles.cardTitle, compact && styles.cardTitleCompact, arabic && styles.textRight]}>{title}</Text>
        <Text numberOfLines={1} style={[styles.cardDate, arabic && styles.textRight]}>{longGregorian(plan.serviceDate, arabic)}</Text>
        <View style={[styles.cardStatus, arabic && styles.rtl]}>
          <StateTag state={plan.state} arabic={arabic} />
          {!compact && plan.state !== 'notStarted' ? (
            <>
              <View style={styles.mini}>
                <View style={[styles.miniFill, { width: `${Math.round((plan.state === 'preached' ? 1 : progress) * 100)}%` }]} />
              </View>
              <Text style={styles.cardMeta}>
                {plan.state === 'preached' && preachedMinutes ? minutesLabel(preachedMinutes, arabic) : partsLabel(plan.writtenParts, plan.totalParts, arabic)}
              </Text>
            </>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export const sermonStyles = StyleSheet.create({
  eyebrow: { color: SERMON_COLORS.gold, fontSize: 11, fontWeight: '800', letterSpacing: 1.6, textTransform: 'uppercase' },
});

const styles = StyleSheet.create({
  pressed: { opacity: MOTION.pressOpacity },
  rtl: { flexDirection: 'row-reverse' },
  textRight: { textAlign: 'right', writingDirection: 'rtl' },
  fillContent: { flex: 1, alignSelf: 'stretch', justifyContent: 'center' },
  pillOuter: { borderRadius: 999, flexShrink: 1, minWidth: 0 },
  pill: { borderRadius: 999, justifyContent: 'center' },
  pillWide: { height: 40 },
  pillCompact: { height: 34 },
  pillRow: { alignItems: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 13 },
  pillText: { flexShrink: 1, fontSize: 14 },
  pillTextCompact: { fontSize: 13 },
  pillStrong: { fontWeight: '700' },
  round: { alignItems: 'center', backgroundColor: SERMON_COLORS.fill, borderRadius: 999, justifyContent: 'center' },
  pillButton: { alignItems: 'center', backgroundColor: SERMON_COLORS.fill, borderRadius: 999, flexDirection: 'row', gap: 7, height: 38, paddingLeft: 12, paddingRight: 14 },
  pillButtonText: { color: SERMON_COLORS.text, fontSize: 14, fontWeight: '600' },
  gold: { alignItems: 'center', backgroundColor: SERMON_COLORS.gold, borderRadius: 999, flexDirection: 'row', gap: 6, height: 38, paddingLeft: 13, paddingRight: 16 },
  goldCompact: { height: 34, paddingLeft: 10, paddingRight: 12 },
  goldText: { color: SERMON_COLORS.onGold, fontSize: 14, fontWeight: '700' },
  goldTextCompact: { fontSize: 13 },
  seg: { backgroundColor: SERMON_COLORS.fill, borderRadius: 999, flexDirection: 'row', padding: 3 },
  segStretch: { borderRadius: 12 },
  segItem: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  segItemStretch: { alignItems: 'center', borderRadius: 9, flex: 1, paddingHorizontal: 4 },
  segItemOn: { backgroundColor: SERMON_COLORS.gold },
  segItemOnRaised: { backgroundColor: SERMON_COLORS.raised },
  segText: { color: SERMON_COLORS.muted, fontSize: 13, fontWeight: '600' },
  segTextOn: { color: SERMON_COLORS.onGold },
  segTextOnRaised: { color: SERMON_COLORS.text },
  segBadge: { color: SERMON_COLORS.gold },
  tag: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  tagText: { fontSize: 11, fontWeight: '700' },
  card: { alignItems: 'center', backgroundColor: SERMON_COLORS.surface, borderRadius: 18, flexDirection: 'row', gap: 12, padding: 12 },
  cardCompact: { borderRadius: 14, gap: 10, padding: 9 },
  cardBare: { backgroundColor: 'transparent' },
  cardOn: { backgroundColor: SERMON_COLORS.raised },
  tile: { borderRadius: 14, height: 60, width: 56 },
  tileCompact: { borderRadius: 11, height: 48, width: 44 },
  tileInner: { alignItems: 'center', justifyContent: 'center' },
  tileMonth: { fontSize: 9.5, fontWeight: '800', letterSpacing: 1.1, opacity: 0.9, textTransform: 'uppercase' },
  tileMonthCompact: { fontSize: 8.5, letterSpacing: 0.4 },
  tileDay: { fontFamily: TYPOGRAPHY.title, fontSize: 24, fontWeight: '700', lineHeight: 26, marginTop: 2 },
  tileDayCompact: { fontSize: 19, lineHeight: 21 },
  cardBody: { flex: 1, minWidth: 0 },
  cardTitle: { color: SERMON_COLORS.text, fontFamily: TYPOGRAPHY.title, fontSize: 16.5, fontWeight: '700', lineHeight: 21 },
  cardTitleCompact: { fontSize: 14.5, lineHeight: 18 },
  cardDate: { color: SERMON_COLORS.muted, fontSize: 12.5, marginTop: 2 },
  cardStatus: { alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 7 },
  mini: { backgroundColor: 'rgba(255, 255, 255, 0.08)', borderRadius: 999, flex: 1, height: 4, overflow: 'hidden' },
  miniFill: { backgroundColor: SERMON_COLORS.gold, height: '100%' },
  cardMeta: { color: SERMON_COLORS.muted, fontSize: 12 },
});
