'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { DayBlockTheme } from '../../../constants/seasonAppearance';
import { COLORS, TYPOGRAPHY } from '../../../constants/theme';
import { useCalendar } from '../../../context/CalendarContext';
import { tr } from '../../../utils/appText';
import Icon from './Icon';

const MAX_FONT_SCALE = 1.25;

interface DayControlsProps {
  theme: DayBlockTheme;
  arabic: boolean;
  /** The day's season or feast, named short ("Nativity Fast"), which opens the Season selector. */
  seasonLabel?: string;
  onOpenSeasons?: () => void;
  /**
   * A standing label beside the red dot ("Up next", "Now") in place of Live /
   * Set Live, where the card follows the clock rather than the chosen day.
   */
  status?: string;
  /** The sun that moves the day on to its eve, the arrows that step it a day, or nothing. */
  trailing?: 'eve' | 'arrows' | 'none';
}

/**
 * The row across the top of a day card and the calendar sheet: Live (or the
 * way back to it), the day's season — which opens the Season selector — and
 * the sun, which moves the day on to its eve after sunset. The Lectionary
 * steps a day at a time with arrows instead of the sun.
 */
export default function DayControls({ theme, arabic, seasonLabel, onOpenSeasons, status, trailing = 'eve' }: DayControlsProps) {
  const { rawDate, isLive, selectDate, goLive, liturgicalDayPeriod, setLiturgicalDayPeriod } = useCalendar();
  const evening = liturgicalDayPeriod === 'evening';

  const togglePeriod = () => {
    if (isLive) {
      // Changing the period by hand leaves live mode, so the liturgical
      // clock stops flipping it back. selectDate always starts the day in the morning.
      selectDate(rawDate);
      if (!evening) setLiturgicalDayPeriod('evening');
    } else {
      setLiturgicalDayPeriod(evening ? 'morning' : 'evening');
    }
  };

  const step = (days: number) => {
    const next = new Date(rawDate);
    next.setUTCDate(next.getUTCDate() + days);
    selectDate(next);
  };

  // A standing label alone (the Agpeya's "Now") makes a row only as tall as its words.
  const statusOnly = Boolean(status) && !(seasonLabel && onOpenSeasons) && trailing === 'none';

  return (
    <View style={[styles.row, statusOnly && styles.rowStatusOnly]}>
      {status ? (
        <View style={styles.live}>
          <LiveDot ring={theme.liveRing} />
          <Text style={[styles.liveText, { color: theme.text }, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {status}
          </Text>
        </View>
      ) : isLive ? (
        <View style={styles.live} accessibilityLabel={tr('Live', 'En direct', 'حاليًا')}>
          <LiveDot ring={theme.liveRing} />
          <Text style={[styles.liveText, { color: theme.text }, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {tr('Live', 'En direct', 'حاليًا')}
          </Text>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr('Back to today', 'Revenir à aujourd’hui', 'العودة إلى اليوم')}
          hitSlop={8}
          onPress={goLive}
          style={({ pressed }) => [styles.live, styles.setLive, { borderColor: theme.accentBorder }, pressed && styles.pressed]}
        >
          <View style={[styles.idleDot, { borderColor: theme.muted }]} />
          <Text style={[styles.liveText, { color: theme.text }, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {tr('Set Live', 'Revenir au direct', 'العودة للحالي')}
          </Text>
        </Pressable>
      )}

      {seasonLabel && onOpenSeasons ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${seasonLabel}. ${tr('Open the seasons', 'Ouvrir les temps liturgiques', 'افتح الفترات')}`}
          onPress={onOpenSeasons}
          style={({ pressed }) => [styles.season, { backgroundColor: theme.chip }, pressed && styles.pressed]}
        >
          <Text numberOfLines={1} style={[styles.seasonText, { color: theme.text }, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {seasonLabel}
          </Text>
          <Icon name="chevron-forward" size={15} color={theme.accent} />
        </Pressable>
      ) : (
        <View style={styles.spacer} />
      )}

      {trailing === 'eve' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={evening
            ? tr('Back to the day', 'Revenir au jour', 'العودة إلى النهار')
            : tr('Move on to the eve', 'Passer à la veille', 'الانتقال إلى العشية')}
          hitSlop={6}
          onPress={togglePeriod}
          style={({ pressed }) => [styles.sun, { borderColor: theme.accentBorder }, pressed && styles.pressed]}
        >
          <Icon name={evening ? 'moon' : 'sunny'} size={18} color={theme.accent} />
        </Pressable>
      ) : trailing === 'arrows' ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tr('The day before', 'La veille', 'اليوم السابق')}
            hitSlop={4}
            onPress={() => step(-1)}
            style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
          >
            <Icon name="chevron-back" size={17} color={theme.accent} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tr('The day after', 'Le lendemain', 'اليوم التالي')}
            hitSlop={4}
            onPress={() => step(1)}
            style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
          >
            <Icon name="chevron-forward" size={17} color={theme.accent} />
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

/**
 * The red Live dot: a soft red halo on the annual green; on every other
 * season's colour a white ring hugging the dot, a faint dark halo outside it.
 */
function LiveDot({ ring }: { ring: DayBlockTheme['liveRing'] }) {
  if (ring === 'white') {
    return (
      <View style={[styles.dotHalo, styles.dotHaloDark]}>
        <View style={styles.dotRing}>
          <View style={styles.dot} />
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.dotHalo, styles.dotHaloRed]}>
      <View style={styles.dot} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row', gap: 8, minHeight: 36 },
  rowStatusOnly: { minHeight: 0 },
  live: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  setLive: { borderRadius: 99, borderWidth: 1, height: 32, paddingHorizontal: 10 },
  liveText: { fontFamily: TYPOGRAPHY.body, fontSize: 14, fontWeight: '700' },
  dotHalo: { alignItems: 'center', borderRadius: 8, height: 16, justifyContent: 'center', width: 16 },
  dotHaloRed: { backgroundColor: 'rgba(214, 69, 69, 0.2)' },
  // The design's `0 0 0 2px #fff, 0 0 0 5px rgba(0,0,0,.18)` around the 8pt dot.
  dotHaloDark: { backgroundColor: 'rgba(0, 0, 0, 0.18)', borderRadius: 9, height: 18, marginHorizontal: -1, width: 18 },
  dotRing: { alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 6, height: 12, justifyContent: 'center', width: 12 },
  dot: { backgroundColor: COLORS.priest, borderRadius: 4, height: 8, width: 8 },
  idleDot: { borderRadius: 5, borderWidth: 1.5, height: 9, width: 9 },
  season: {
    alignItems: 'center',
    borderRadius: 99,
    flexDirection: 'row',
    flexShrink: 1,
    gap: 4,
    height: 36,
    marginLeft: 'auto',
    paddingLeft: 16,
    paddingRight: 10,
  },
  seasonText: { flexShrink: 1, fontFamily: TYPOGRAPHY.body, fontSize: 15, fontWeight: '600' },
  spacer: { flex: 1 },
  arrow: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  // 36pt inside its ring, as the design draws it: 38 across.
  sun: {
    alignItems: 'center',
    borderRadius: 19,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  pressed: { opacity: 0.7 },
  arabic: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'left', writingDirection: 'rtl' },
});
