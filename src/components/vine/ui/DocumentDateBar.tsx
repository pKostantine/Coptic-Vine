'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { NIGHT_DOCUMENT_THEME, type DocumentTheme } from '../../../constants/documentThemes';
import { SPACING, TYPOGRAPHY } from '../../../constants/theme';
import { useCalendar } from '../../../context/CalendarContext';
import { tr } from '../../../utils/appText';
import { formatCopticDayMonth, formatDayMonthYearDate } from '../../../utils/localeFormat';
import Icon from './Icon';
import { useLiturgicalDay } from './useLiturgicalDay';

interface DocumentDateBarProps {
  arabic: boolean;
  /** The page the bar sits on — see constants/documentThemes.ts. */
  theme?: DocumentTheme;
  /** Called just before an arrow changes the day, so the document can keep the reader's place. */
  onBeforeChange?: () => void;
  /** The date itself is a button: it opens the calendar over the document (which keeps the place itself). */
  onOpenCalendar: () => void;
}

/**
 * The day a reading document is read for, across its top: the Coptic and the
 * Gregorian date between a day back and a day on, the date itself opening the
 * calendar. The Lectionary's readings and the Sermon Planner are read for a
 * day, and are often read for another than today -- the next Sunday's, the
 * day before's -- so the day is changed here rather than through the content
 * list. A day stepped here starts in the morning, as the Lectionary's arrows do.
 */
export default function DocumentDateBar({ arabic, theme = NIGHT_DOCUMENT_THEME, onBeforeChange, onOpenCalendar }: DocumentDateBarProps) {
  const { rawDate, selectDate, liturgicalDayPeriod } = useCalendar();
  const day = useLiturgicalDay();
  const coptic = day.coptic ? formatCopticDayMonth(day.coptic.monthName, day.coptic.day, arabic) : null;
  const gregorian = formatDayMonthYearDate(rawDate, arabic);
  const eve = liturgicalDayPeriod === 'evening';

  const step = (days: number) => {
    onBeforeChange?.();
    const next = new Date(rawDate);
    next.setUTCDate(next.getUTCDate() + days);
    selectDate(next);
  };

  const arrow = (days: -1 | 1) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={days < 0 ? tr('The day before', 'La veille', 'اليوم السابق') : tr('The day after', 'Le lendemain', 'اليوم التالي')}
      hitSlop={8}
      style={({ pressed }) => [styles.arrow, { borderColor: theme.colors.border }, pressed && styles.pressed]}
      onPress={() => step(days)}
    >
      <Icon name={days < 0 ? 'chevron-back' : 'chevron-forward'} size={16} color={theme.colors.accent} />
    </Pressable>
  );

  return (
    <View style={[styles.bar, { backgroundColor: theme.colors.strip, borderBottomColor: theme.colors.border }]}>
      {arrow(-1)}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tr(`Choose the day: ${gregorian}`, `Choisir le jour : ${gregorian}`, `اختر اليوم: ${gregorian}`)}
        style={({ pressed }) => [styles.date, pressed && styles.pressed]}
        onPress={onOpenCalendar}
      >
        <Icon name="calendar-outline" size={15} color={theme.colors.accent} />
        <Text numberOfLines={1} style={[styles.text, { color: theme.colors.text }, arabic && styles.arabic]}>
          {coptic ? <Text style={[styles.coptic, { color: theme.colors.accent }]}>{coptic}</Text> : null}
          {coptic ? '  ·  ' : ''}
          {gregorian}
          {eve ? ` ${tr('(eve)', '(veille)', '(عشية)')}` : ''}
        </Text>
      </Pressable>
      {arrow(1)}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
  },
  arrow: {
    alignItems: 'center',
    borderRadius: 15,
    borderWidth: 1,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  date: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 30,
    minWidth: 0,
  },
  text: {
    flexShrink: 1,
    fontFamily: TYPOGRAPHY.body,
    fontSize: 14,
    fontWeight: '600',
  },
  coptic: {
    fontWeight: '800',
  },
  arabic: {
    fontFamily: TYPOGRAPHY.arabic,
    writingDirection: 'rtl',
  },
  pressed: {
    opacity: 0.65,
  },
});
