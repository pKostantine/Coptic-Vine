'use no memo'; // Names the days in the planner's language.
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SERMON_COLORS } from '@/constants/sermonPlanner';
import { MOTION, TYPOGRAPHY } from '@/constants/theme';
import { CalendarProvider, useCalendar } from '@/context/CalendarContext';
import { useLiturgicalClock } from '@/context/LiturgicalClockContext';
import { useReadingPreferences } from '@/context/ReadingPreferencesContext';
import { useModalOrientations } from '@/hooks/useModalOrientations';
import { sermonDayName, useSermonDay } from '@/hooks/useSermonDay';
import { loadSermonReadings } from '@/hooks/useSermonReadings';
import { saveLocalSermonPlan } from '@/services/sermonPlannerService';
import type { SermonPlan } from '@/types/sermonPlanner';
import { getCopticDate, getCopticMonthForDate, getCopticMonthGrid, getDayOverview } from '@/utils/calendarService';
import { FIXED_FEASTS } from '@/utils/fixedFeasts';
import { carriedSermonPlan, carryOverDay, type CarryOverCalendar } from '@/utils/sermonCarryOver';
import { newSermonPlanId } from '@/utils/sermonPlanner';
import { getUserConditionFlags } from '@/utils/userConditionFlags';
import { useReducedMotion } from '@/utils/useReducedMotion';
import CalendarPanel from '../ui/CalendarPanel';
import { longGregorian, pick } from './SermonPieces';

/** The app's calendar, as a carry over asks it (utils/sermonCarryOver.ts). */
const APP_CALENDAR: CarryOverCalendar = {
  copticDate: async (isoDate) => {
    const date = new Date(`${isoDate}T00:00:00Z`);
    const [month, coptic] = await Promise.all([getCopticMonthForDate(date), getCopticDate(date)]);
    return month && coptic ? { year: month.coptic_year, month: month.coptic_month, day: coptic.day } : null;
  },
  copticMonth: async (year, month) => (await getCopticMonthGrid(year, month)).map((day) => ({
    isoDate: day.gregorianDate,
    day: Number(day.displayDay),
    sunday: day.isSunday,
  })),
  fixedFeast: async (isoDate) => {
    const overview = await getDayOverview(isoDate);
    const keys = new Set(overview?.activeKeys ?? []);
    return FIXED_FEASTS.some((feast) => feast.overridesSeasonalReadings && keys.has(feast.key));
  },
};

function isoOf(date: Date) {
  return date.toISOString().slice(0, 10);
}

/** Inside the carry over's own calendar: the day chosen, and carrying the plan to it. */
function CarryOverDay({ source, suggestion, arabic, onCarried }: {
  source: SermonPlan;
  suggestion: string;
  arabic: boolean;
  onCarried: (plan: SermonPlan) => void;
}) {
  const { effectiveDate } = useCalendar();
  const { preferences } = useReadingPreferences();
  const targetIso = isoOf(effectiveDate);
  const day = useSermonDay(targetIso);
  const [busy, setBusy] = useState(false);
  const flags = useMemo(
    () => getUserConditionFlags(preferences),
    // The flags read only these.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [preferences.selectedSaintHymns, preferences.inMonastery, preferences.saintPsalies],
  );

  const carry = async () => {
    setBusy(true);
    // Its highlights are found again in that day's readings; offline, the outline goes alone.
    const sections = await loadSermonReadings(targetIso, flags).catch(() => null);
    const { plan } = carriedSermonPlan(source, { id: newSermonPlanId(), isoDate: targetIso, now: new Date().toISOString() }, sections);
    await saveLocalSermonPlan(plan);
    setBusy(false);
    onCarried(plan);
  };

  return (
    <>
      <View style={styles.choice}>
        <Text style={[styles.choiceName, arabic && styles.textRight]}>{sermonDayName(day, arabic)}</Text>
        <Text style={[styles.choiceDate, arabic && styles.textRight]}>
          {longGregorian(targetIso, arabic)}
          {targetIso === suggestion ? pick(arabic, '  ·  a year on', '  ·  بعد عام') : ''}
        </Text>
      </View>
      <CalendarPanel onOpenSeasons={() => undefined} controls={false} />
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={() => void carry()}
        style={({ pressed }) => [styles.carry, (pressed || busy) && styles.pressed]}
      >
        {busy ? <ActivityIndicator color={SERMON_COLORS.onGold} /> : (
          <Text style={styles.carryText}>{pick(arabic, 'Carry over to this day', 'انقلها إلى هذا اليوم')}</Text>
        )}
      </Pressable>
    </>
  );
}

/**
 * Carry a sermon over to another day. It opens on the day's equivalent a year
 * on (Palm Sunday to next Palm Sunday), in a calendar of its own, so choosing
 * another day moves nothing else; the plan goes there as a draft, its
 * highlights found again in that day's readings.
 */
export default function SermonCarryOver({ source, arabic, onClose, onCarried }: {
  /** The plan to carry over; nothing shows without one. */
  source: SermonPlan | null;
  arabic: boolean;
  onClose: () => void;
  onCarried: (plan: SermonPlan) => void;
}) {
  const insets = useSafeAreaInsets();
  const modalOrientations = useModalOrientations();
  const reduced = useReducedMotion();
  const clock = useLiturgicalClock();
  const todayIso = isoOf(clock.today);
  const [suggestion, setSuggestion] = useState<{ for: string; day: string } | null>(null);
  const sourceKey = source ? `${source.id}:${source.serviceDate}` : null;

  useEffect(() => {
    if (!source) return undefined;
    let active = true;
    void carryOverDay(source.serviceDate, todayIso, APP_CALENDAR).then((day) => {
      if (active) setSuggestion({ for: `${source.id}:${source.serviceDate}`, day });
    });
    return () => { active = false; };
  }, [source, todayIso]);

  const ready = suggestion && suggestion.for === sourceKey ? suggestion.day : null;
  const title = source?.title.trim() || pick(arabic, 'This sermon', 'هذه العظة');

  return (
    <Modal
      visible={Boolean(source)}
      transparent
      animationType={reduced ? 'none' : 'fade'}
      onRequestClose={onClose}
      supportedOrientations={modalOrientations}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <Pressable accessibilityLabel={pick(arabic, 'Close', 'إغلاق')} style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { marginTop: insets.top + 24, marginBottom: Math.max(16, insets.bottom + 8) }]} onPress={() => undefined}>
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={[styles.title, arabic && styles.textRight]}>{pick(arabic, 'Carry over', 'انقل العظة')}</Text>
            {source ? (
              <Text style={[styles.subtitle, arabic && styles.textRight]}>{`${title} · ${longGregorian(source.serviceDate, arabic)}`}</Text>
            ) : null}
            {source && ready ? (
              // Its own calendar, from the day offered; keyed so another plan starts afresh.
              <CalendarProvider key={`${sourceKey}:${ready}`} initialDate={new Date(`${ready}T00:00:00Z`)}>
                <CarryOverDay source={source} suggestion={ready} arabic={arabic} onCarried={onCarried} />
              </CalendarProvider>
            ) : (
              <ActivityIndicator style={styles.waiting} color={SERMON_COLORS.gold} />
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: MOTION.pressOpacity },
  textRight: { textAlign: 'right', writingDirection: 'rtl' },
  backdrop: { alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.6)', flex: 1, justifyContent: 'center', paddingHorizontal: 12 },
  sheet: { backgroundColor: SERMON_COLORS.raised, borderRadius: 22, flexShrink: 1, maxWidth: 460, overflow: 'hidden', width: '100%' },
  content: { padding: 18 },
  title: { color: SERMON_COLORS.text, fontFamily: TYPOGRAPHY.title, fontSize: 22, fontWeight: '700' },
  subtitle: { color: SERMON_COLORS.muted, fontSize: 13.5, marginBottom: 14, marginTop: 4 },
  choice: { backgroundColor: 'rgba(0, 0, 0, 0.3)', borderRadius: 14, marginBottom: 12, paddingHorizontal: 14, paddingVertical: 12 },
  choiceName: { color: SERMON_COLORS.text, fontFamily: TYPOGRAPHY.title, fontSize: 17, fontWeight: '700' },
  choiceDate: { color: SERMON_COLORS.muted, fontSize: 13, marginTop: 3 },
  carry: { alignItems: 'center', backgroundColor: SERMON_COLORS.gold, borderRadius: 999, height: 44, justifyContent: 'center', marginTop: 14 },
  carryText: { color: SERMON_COLORS.onGold, fontSize: 15, fontWeight: '700' },
  waiting: { marginVertical: 40 },
});
