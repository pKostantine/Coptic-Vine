'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import Head from 'expo-router/head';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import CanonInstructions from '@/components/canon/CanonInstructions';
import { CanonProgressBar, CanonSkippedRow, CanonTaskRow, CanonWeekCard, type CanonDayState } from '@/components/canon/CanonParts';
import { dayProgressLabel, paschaAgpeyaNote } from '@/components/canon/canonText';
import { confirmCanonAction } from '@/components/canon/confirmCanonAction';
import { NowPlayingAwareScrollView } from '@/components/playback/NowPlayingAwareScroll';
import { PageGlow } from '@/components/vine/screens/BookPage';
import BleedPage from '@/components/vine/ui/BleedPage';
import BottomTabBar from '@/components/vine/ui/BottomTabBar';
import Icon from '@/components/vine/ui/Icon';
import SubPageHeader from '@/components/vine/ui/SubPageHeader';
import { COLORS, TYPOGRAPHY } from '@/constants/theme';
import { useReadingPreferences } from '@/context/ReadingPreferencesContext';
import { useSpiritualCanon } from '@/context/SpiritualCanonContext';
import { loadSupportedCanon, stopSupportingCanon, type SupportedCanon } from '@/services/spiritualCanonService';
import { tr } from '@/utils/appText';
import { formatDayMonthDate } from '@/utils/localeFormat';
import { goBack } from '@/utils/navigation';
import { addCanonDays, canonDayDate, canonDayProgress, canonNeedsCalendar, canonSkippedTasksForDay, canonTasksForDay, canonWeekStart } from '@/utils/spiritualCanon';

const MAX_FONT_SCALE = 1.3;

/**
 * The canon of someone this account supports, as they keep it: a week at a
 * time with how each day went, the chosen day's tasks ticked as they ticked
 * them, and their father of confession's instructions when they included
 * them. Nothing here can be changed; it is read again each time the page is
 * opened, so it is as they left it.
 */
export default function SupportedCanonScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { preferences } = useReadingPreferences();
  const arabic = preferences.appLanguage === 'ar';
  // One's own canon's context, for today and the calendar, which are the same for everyone.
  const canon = useSpiritualCanon();
  const supportId = id ? String(id) : '';
  const [chosen, setChosen] = useState<string | null>(null);
  const day = chosen ?? canon.today;
  const weekStart = canonWeekStart(day);

  // The week shown, read for this link; opening the page again reads it afresh.
  const [opened, setOpened] = useState(0);
  useFocusEffect(useCallback(() => {
    setOpened((count) => count + 1);
  }, []));
  const [read, setRead] = useState<{ key: string; canon: SupportedCanon | null; failed: boolean } | null>(null);
  const key = `${supportId}:${weekStart}`;
  useEffect(() => {
    if (!supportId || !opened) return;
    let live = true;
    loadSupportedCanon(supportId, weekStart, addCanonDays(weekStart, 6))
      .then((found) => { if (live) setRead({ key, canon: found, failed: false }); })
      // Removed, or stopped elsewhere: nothing of theirs stays on screen.
      .catch(() => { if (live) setRead({ key, canon: null, failed: true }); });
    return () => { live = false; };
  }, [key, opened, supportId, weekStart]);

  // The last canon read stays on screen while another week is read.
  const theirs = read?.canon ?? null;
  const current = read?.key === key;
  const gone = !supportId || Boolean(current && read?.failed);
  const items = theirs?.items ?? [];
  const document = { items, days: current ? theirs?.days ?? {} : {} };

  const keepsApplicableDays = canonNeedsCalendar(items);
  const { ensureCalendarDays } = canon;
  useEffect(() => {
    if (keepsApplicableDays) ensureCalendarDays(Array.from({ length: 7 }, (_, offset) => addCanonDays(weekStart, offset)));
  }, [ensureCalendarDays, keepsApplicableDays, weekStart]);

  const tasks = canonTasksForDay(document, day, canon.calendar);
  const skipped = canonSkippedTasksForDay(document, day, canon.calendar);
  const progress = canonDayProgress(tasks);
  const allDone = progress.total > 0 && progress.done === progress.total;
  const pascha = items.some((item) => item.kind === 'agpeya') && canon.agpeyaOn(day) !== 'all';
  const stateOf = (candidate: string): CanonDayState => {
    const dayTasks = canonTasksForDay(document, candidate, canon.calendar);
    if (!dayTasks.length) return 'free';
    const { done, total } = canonDayProgress(dayTasks);
    if (done === total) return 'done';
    return done > 0 ? 'partial' : 'open';
  };

  const dayKicker = day === canon.today
    ? tr('Today', 'Aujourd’hui', 'اليوم')
    : day === addCanonDays(canon.today, -1)
      ? tr('Yesterday', 'Hier', 'أمس')
      : day === addCanonDays(canon.today, 1)
        ? tr('Tomorrow', 'Demain', 'غدًا')
        : null;

  const name = theirs?.name ?? '';
  const title = name
    ? tr(`${name}’s Canon`, `Le canon de ${name}`, `قانون ${name}`)
    : tr('Their Canon', 'Son canon', 'قانونه');

  const stop = () => confirmCanonAction({
    question: tr('Stop supporting?', 'Ne plus soutenir ?', 'أتتوقف عن الدعم؟'),
    detail: tr(
      'You will no longer see their canon. They can invite you again.',
      'Vous ne verrez plus son canon. Il pourra vous inviter de nouveau.',
      'لن ترى قانونه بعد الآن، ويمكنه أن يدعوك من جديد.',
    ),
    action: tr('Stop', 'Arrêter', 'توقف'),
  }, () => {
    void stopSupportingCanon(supportId)
      .then(() => goBack(router, '/canon' as never))
      .catch(() => undefined);
  });

  return (
    <BleedPage background={<PageGlow kind="green" />} footer={<BottomTabBar active="home" />}>
      <Head><title>{title}</title></Head>
      <SubPageHeader compact title={title} arabic={arabic} onBack={() => goBack(router, '/canon' as never)} backLabel={tr('Back', 'Retour', 'رجوع')} />
      <NowPlayingAwareScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.column}>
          {gone ? (
            <View style={styles.note}>
              <Icon name="eye-outline" size={20} color={COLORS.muted} />
              <Text style={[styles.noteText, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {tr(
                  'You no longer see this canon, or it can’t be reached just now.',
                  'Vous ne voyez plus ce canon, ou il est injoignable pour l’instant.',
                  'لم تعد ترى هذا القانون، أو يتعذّر الوصول إليه الآن.',
                )}
              </Text>
            </View>
          ) : !theirs ? (
            <Text style={[styles.quiet, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{tr('Loading…', 'Chargement…', 'جارٍ التحميل…')}</Text>
          ) : (
            <>
              {theirs.instructions ? (
                <CanonInstructions
                  text={theirs.instructions}
                  arabic={arabic}
                  heading={tr('From their father of confession', 'De son père de confession', 'من أب اعترافه')}
                />
              ) : null}
              {items.length ? (
                <>
                  <CanonWeekCard day={day} today={canon.today} arabic={arabic} stateOf={stateOf} onChoose={setChosen} />

                  <View style={styles.dayHead}>
                    {dayKicker ? <Text style={[styles.kicker, arabic && styles.arabicTight]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{dayKicker}</Text> : null}
                    <Text style={[styles.dayTitle, arabic && styles.arabic]} accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE}>
                      {formatDayMonthDate(canonDayDate(day), arabic)}
                    </Text>
                    {progress.total ? (
                      <View style={styles.progress}>
                        <CanonProgressBar done={progress.done} total={progress.total} />
                        <Text style={[styles.progressText, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{dayProgressLabel(progress.done, progress.total)}</Text>
                      </View>
                    ) : null}
                  </View>

                  {!current ? (
                    <Text style={[styles.quiet, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{tr('Loading…', 'Chargement…', 'جارٍ التحميل…')}</Text>
                  ) : tasks.length ? (
                    <View style={styles.rows}>
                      {tasks.map((task) => <CanonTaskRow key={task.key} task={task} arabic={arabic} readOnly />)}
                    </View>
                  ) : (
                    <View style={styles.note}>
                      <Icon name="sunny-outline" size={20} color={COLORS.muted} />
                      <Text style={[styles.noteText, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                        {tr('Nothing in their canon on this day.', 'Rien dans son canon ce jour-là.', 'لا شيء في قانونه في هذا اليوم.')}
                      </Text>
                    </View>
                  )}

                  {current && skipped.length ? (
                    <View style={styles.skipped}>
                      <Text style={[styles.skippedHeading, arabic && styles.arabicTight]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{tr('Skipped', 'Passés', 'متخطّاة')}</Text>
                      {skipped.map((task, index) => <CanonSkippedRow key={task.key} task={task} arabic={arabic} first={index === 0} />)}
                    </View>
                  ) : null}
                  {pascha ? <Text style={[styles.quiet, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{paschaAgpeyaNote()}</Text> : null}
                  {current && allDone ? (
                    <Text style={[styles.glory, arabic && styles.arabicCentered]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                      {tr('Glory to God! This day’s canon was kept.', 'Gloire à Dieu ! Le canon de ce jour a été accompli.', 'المجد لله! اكتمل قانون هذا اليوم.')}
                    </Text>
                  ) : null}
                </>
              ) : (
                <View style={styles.note}>
                  <Icon name="sunny-outline" size={20} color={COLORS.muted} />
                  <Text style={[styles.noteText, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {tr('There is nothing in their canon yet.', 'Il n’y a encore rien dans son canon.', 'لا شيء في قانونه بعد.')}
                  </Text>
                </View>
              )}

              <Pressable accessibilityRole="button" onPress={stop} style={({ pressed }) => [styles.stop, pressed && styles.pressed]}>
                <Text style={[styles.stopText, arabic && styles.arabicTight]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{tr('Stop supporting', 'Ne plus soutenir', 'توقف عن الدعم')}</Text>
              </Pressable>
            </>
          )}
        </View>
      </NowPlayingAwareScrollView>
    </BleedPage>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 32, paddingHorizontal: 16 },
  column: { alignSelf: 'center', gap: 14, maxWidth: 640, width: '100%' },
  pressed: { opacity: 0.7 },
  dayHead: { gap: 4, paddingHorizontal: 4, paddingTop: 4 },
  kicker: { color: COLORS.gold, fontFamily: TYPOGRAPHY.body, fontSize: 12, fontWeight: '700', letterSpacing: 1.7, textTransform: 'uppercase' },
  dayTitle: { color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontSize: 23, fontWeight: '700' },
  progress: { gap: 6, marginTop: 6 },
  progressText: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 13 },
  rows: { gap: 8 },
  note: { alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.04)', borderRadius: 16, flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 16 },
  noteText: { color: COLORS.muted, flex: 1, fontFamily: TYPOGRAPHY.body, fontSize: 14.5 },
  skipped: { backgroundColor: 'rgba(255, 255, 255, 0.04)', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8 },
  skippedHeading: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 11.5, fontWeight: '700', letterSpacing: 1.2, paddingTop: 4, textTransform: 'uppercase' },
  quiet: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 13, paddingHorizontal: 4 },
  glory: { color: COLORS.goldBright, fontFamily: TYPOGRAPHY.title, fontSize: 16, fontStyle: 'italic', paddingVertical: 6, textAlign: 'center' },
  stop: { alignSelf: 'center', marginTop: 12, paddingHorizontal: 12, paddingVertical: 8 },
  stopText: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
  arabic: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'left', writingDirection: 'rtl' },
  arabicCentered: { fontFamily: TYPOGRAPHY.arabic, writingDirection: 'rtl' },
  arabicTight: { fontFamily: TYPOGRAPHY.arabic, letterSpacing: 0 },
});
