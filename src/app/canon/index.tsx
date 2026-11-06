'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { LinearGradient } from 'expo-linear-gradient';
import Head from 'expo-router/head';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import CanonInstructions from '@/components/canon/CanonInstructions';
import { CanonProgressBar, CanonSkippedRow, CanonTaskRow, CanonWeekCard, type CanonDayState } from '@/components/canon/CanonParts';
import { dayProgressLabel, paschaAgpeyaNote } from '@/components/canon/canonText';
import { NowPlayingAwareScrollView } from '@/components/playback/NowPlayingAwareScroll';
import { PageGlow, SectionHeading } from '@/components/vine/screens/BookPage';
import BleedPage from '@/components/vine/ui/BleedPage';
import BottomTabBar from '@/components/vine/ui/BottomTabBar';
import Icon from '@/components/vine/ui/Icon';
import SubPageHeader from '@/components/vine/ui/SubPageHeader';
import { COLORS, TYPOGRAPHY } from '@/constants/theme';
import { useReadingPreferences } from '@/context/ReadingPreferencesContext';
import { useSpiritualCanon } from '@/context/SpiritualCanonContext';
import { useCanonInstructions } from '@/hooks/useCanonInstructions';
import { listCanonsISupport, type CanonSupportPerson } from '@/services/spiritualCanonService';
import { tr } from '@/utils/appText';
import { formatDayMonthDate } from '@/utils/localeFormat';
import { goBack } from '@/utils/navigation';
import { addCanonDays, canonDayDate, canonDayProgress, canonNeedsCalendar, canonTaskRoute, canonWeekStart } from '@/utils/spiritualCanon';

const MAX_FONT_SCALE = 1.3;

/**
 * The spiritual canon, a day at a time (Coptic Vine design, after the Home
 * cards): the week across the top with a dot for how each day was kept, then
 * the chosen day's tasks to tick off. A day gone by can still be ticked; a
 * day to come shows what it will ask.
 */
export default function CanonScreen() {
  const router = useRouter();
  const { preferences } = useReadingPreferences();
  const arabic = preferences.appLanguage === 'ar';
  const canon = useSpiritualCanon();
  // A father of confession's instructions, kept at the top of the canon to read beside it.
  const instructions = useCanonInstructions();
  const [chosen, setChosen] = useState<string | null>(null);
  // Those whose canon this account sees as their support person, read again each time the page is opened.
  const [supporting, setSupporting] = useState<CanonSupportPerson[]>([]);
  const { signedIn } = canon;
  useFocusEffect(useCallback(() => {
    let live = true;
    if (signedIn) {
      listCanonsISupport()
        .then((people) => { if (live) setSupporting(people); })
        .catch(() => undefined);
    }
    return () => { live = false; };
  }, [signedIn]));
  const day = chosen ?? canon.today;
  const weekStart = canonWeekStart(day);
  // Metanias kept by the calendar, and the Agpeya (Pascha): the week shown is read from the calendar.
  const keepsApplicableDays = canonNeedsCalendar(canon.items);
  const { ensureCalendarDays } = canon;
  useEffect(() => {
    if (keepsApplicableDays) ensureCalendarDays(Array.from({ length: 7 }, (_, offset) => addCanonDays(weekStart, offset)));
  }, [ensureCalendarDays, keepsApplicableDays, weekStart]);
  const tasks = canon.tasksFor(day);
  const skipped = canon.skippedFor(day);
  const pascha = canon.items.some((item) => item.kind === 'agpeya') && canon.agpeyaOn(day) !== 'all';
  const progress = canonDayProgress(tasks);
  const future = day > canon.today;
  const allDone = progress.total > 0 && progress.done === progress.total;

  const stateOf = (candidate: string): CanonDayState => {
    const dayTasks = canon.tasksFor(candidate);
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

  const editButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tr('Edit your canon', 'Modifier votre canon', 'عدّل قانونك')}
      hitSlop={6}
      onPress={() => router.push('/canon/edit' as never)}
      style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}
    >
      <Icon name="create-outline" size={19} color={COLORS.gold} />
    </Pressable>
  );

  const headerButtons = (
    <View style={styles.headerButtons}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tr('Support people', 'Personnes de soutien', 'الأشخاص الداعمون')}
        hitSlop={6}
        onPress={() => router.push('/canon/supporters' as never)}
        style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}
      >
        <Icon name="people-outline" size={19} color={COLORS.gold} />
      </Pressable>
      {editButton}
    </View>
  );

  const title = tr('Spiritual Canon', 'Canon spirituel', 'القانون الروحي');

  return (
    <BleedPage background={<PageGlow kind="green" />} footer={<BottomTabBar active="home" />}>
      <Head><title>{title}</title></Head>
      <SubPageHeader
        compact
        title={title}
        arabic={arabic}
        onBack={() => goBack(router, '/' as never)}
        backLabel={tr('Back', 'Retour', 'رجوع')}
        trailing={canon.items.length ? headerButtons : null}
      />
      <NowPlayingAwareScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.column}>
          {instructions.loaded ? <CanonInstructions text={instructions.text} arabic={arabic} onChange={instructions.setText} /> : null}
          {canon.loaded && !canon.items.length ? (
            <EmptyCanon arabic={arabic} onStart={() => router.push('/canon/edit' as never)} />
          ) : (
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

              {!canon.loaded ? (
                <Text style={[styles.quiet, arabic && styles.arabic]}>{tr('Loading…', 'Chargement…', 'جارٍ التحميل…')}</Text>
              ) : tasks.length ? (
                <View style={styles.rows}>
                  {tasks.map((task) => (
                    <CanonTaskRow
                      key={task.key}
                      task={task}
                      arabic={arabic}
                      disabled={future}
                      onToggle={(done) => canon.setTaskDone(day, task.key, done)}
                      onOpen={() => router.push(canonTaskRoute(task) as never)}
                      onSkip={() => canon.setTaskSkipped(day, task.key, true)}
                    />
                  ))}
                </View>
              ) : (
                <View style={styles.note}>
                  <Icon name="sunny-outline" size={20} color={COLORS.muted} />
                  <Text style={[styles.noteText, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {tr('Nothing in your canon on this day.', 'Rien dans votre canon ce jour-là.', 'لا شيء في قانونك في هذا اليوم.')}
                  </Text>
                </View>
              )}

              {skipped.length ? (
                <View style={styles.skipped}>
                  <Text style={[styles.skippedHeading, arabic && styles.arabicTight]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{tr('Skipped', 'Passés', 'متخطّاة')}</Text>
                  {skipped.map((task, index) => (
                    <CanonSkippedRow key={task.key} task={task} arabic={arabic} first={index === 0} onRestore={() => canon.setTaskSkipped(day, task.key, false)} />
                  ))}
                </View>
              ) : null}
              {pascha ? <Text style={[styles.quiet, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{paschaAgpeyaNote()}</Text> : null}
              {future && tasks.length ? (
                <Text style={[styles.quiet, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {tr('These can be ticked off on the day.', 'Vous pourrez les cocher le jour venu.', 'يمكنك تعليمها في يومها.')}
                </Text>
              ) : null}
              {allDone ? (
                <Text style={[styles.glory, arabic && styles.arabicCentered]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {day === canon.today
                    ? tr('Glory to God! Today’s canon is complete.', 'Gloire à Dieu ! Le canon du jour est accompli.', 'المجد لله! اكتمل قانون اليوم.')
                    : tr('Glory to God! This day’s canon was kept.', 'Gloire à Dieu ! Le canon de ce jour a été accompli.', 'المجد لله! اكتمل قانون هذا اليوم.')}
                </Text>
              ) : null}
            </>
          )}

          {signedIn && supporting.length ? (
            <View style={styles.supporting}>
              <SectionHeading size="page" title={tr('People You Support', 'Ceux que vous soutenez', 'من تدعمهم')} arabic={arabic} />
              <View style={styles.rows}>
                {supporting.map((person) => (
                  <Pressable
                    key={person.id}
                    accessibilityRole="button"
                    onPress={() => router.push(`/canon/supporting/${encodeURIComponent(person.id)}` as never)}
                    style={({ pressed }) => [styles.personRow, pressed && styles.pressed]}
                  >
                    <LinearGradient colors={[COLORS.surfaceDeep, COLORS.surface]} style={StyleSheet.absoluteFill} pointerEvents="none" />
                    {/* Icons in Views of their own: beside the absolute gradient, a bare icon paints under it on the web. */}
                    <View><Icon name="person-circle-outline" size={22} color={COLORS.gold} /></View>
                    <Text style={[styles.personName, arabic && styles.arabic]} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                      {person.name || tr('Someone you support', 'Une personne que vous soutenez', 'شخص تدعمه')}
                    </Text>
                    <View><Icon name="chevron-forward" size={16} color={COLORS.muted} /></View>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {canon.loaded && !canon.signedIn ? (
            <Pressable accessibilityRole="button" onPress={() => router.push('/account' as never)} style={({ pressed }) => [styles.account, pressed && styles.pressed]}>
              <Icon name="person-circle-outline" size={22} color={COLORS.gold} />
              <Text style={[styles.accountText, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {tr('Sign in to keep your canon on all your devices.', 'Connectez-vous pour retrouver votre canon sur tous vos appareils.', 'سجّل الدخول ليبقى قانونك على كل أجهزتك.')}
              </Text>
              <Icon name="chevron-forward" size={16} color={COLORS.gold} />
            </Pressable>
          ) : null}
          {canon.signedIn && (canon.syncFailed || instructions.syncFailed) ? (
            <Text style={[styles.quiet, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {tr(
                'Saved on this device. It will reach your account once you are back online.',
                'Enregistré sur cet appareil. Il rejoindra votre compte une fois de nouveau en ligne.',
                'محفوظ على هذا الجهاز، وسيصل إلى حسابك عند عودة الاتصال.',
              )}
            </Text>
          ) : null}
        </View>
      </NowPlayingAwareScrollView>
    </BleedPage>
  );
}

/** No canon yet: what one is, and the way to set one down. */
function EmptyCanon({ arabic, onStart }: { arabic: boolean; onStart: () => void }) {
  return (
    <View style={styles.empty}>
      <LinearGradient colors={['#173A1F', COLORS.greenDeep]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <Text style={[styles.kicker, arabic && styles.arabicTight]}>{tr('Spiritual canon', 'Canon spirituel', 'القانون الروحي')}</Text>
      <Text style={[styles.emptyTitle, arabic && styles.arabicCentered]}>{tr('Keep a rule of prayer', 'Gardez une règle de prière', 'حافظ على قانون صلاة')}</Text>
      <Text style={[styles.emptyText, arabic && styles.arabicCentered]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {tr(
          'Set down the hours of the Agpeya you pray, your Bible reading and anything else you keep — every day, on certain days, or a few times a week — and tick them off as you go.',
          'Notez les heures de l’Agpia que vous priez, votre lecture de la Bible et tout ce que vous gardez — chaque jour, certains jours ou quelques fois par semaine — et cochez-les au fil du jour.',
          'دوّن ساعات الأجبية التي تصليها وقراءتك في الكتاب المقدس وكل ما تحافظ عليه — كل يوم أو في أيام معيّنة أو مرات في الأسبوع — وعلّمها كلما أتممتها.',
        )}
      </Text>
      <Pressable accessibilityRole="button" onPress={onStart} style={({ pressed }) => [styles.startButton, pressed && styles.pressed]}>
        <Icon name="add" size={17} color={COLORS.greenDeep} />
        <Text style={[styles.startText, arabic && styles.arabicTight]}>{tr('Set up your canon', 'Établir votre canon', 'ضع قانونك')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 32, paddingHorizontal: 16 },
  column: { alignSelf: 'center', gap: 14, maxWidth: 640, width: '100%' },
  pressed: { opacity: 0.7 },
  headerButtons: { flexDirection: 'row', gap: 8 },
  roundButton: { alignItems: 'center', borderColor: COLORS.goldLine, borderRadius: 20, borderWidth: 1, height: 40, justifyContent: 'center', width: 40 },

  dayHead: { gap: 4, paddingHorizontal: 4, paddingTop: 4 },
  kicker: { color: COLORS.gold, fontFamily: TYPOGRAPHY.body, fontSize: 12, fontWeight: '700', letterSpacing: 1.7, textTransform: 'uppercase' },
  dayTitle: { color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontSize: 23, fontWeight: '700' },
  progress: { gap: 6, marginTop: 6 },
  progressText: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 13 },
  rows: { gap: 8 },
  supporting: { marginTop: 10 },
  personRow: { alignItems: 'center', borderRadius: 16, flexDirection: 'row', gap: 12, minHeight: 56, overflow: 'hidden', paddingHorizontal: 14 },
  personName: { color: COLORS.white, flex: 1, fontFamily: TYPOGRAPHY.body, fontSize: 16, fontWeight: '600' },
  note: { alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.04)', borderRadius: 16, flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 16 },
  noteText: { color: COLORS.muted, flex: 1, fontFamily: TYPOGRAPHY.body, fontSize: 14.5 },
  skipped: { backgroundColor: 'rgba(255, 255, 255, 0.04)', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8 },
  skippedHeading: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 11.5, fontWeight: '700', letterSpacing: 1.2, paddingTop: 4, textTransform: 'uppercase' },
  quiet: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 13, paddingHorizontal: 4 },
  glory: { color: COLORS.goldBright, fontFamily: TYPOGRAPHY.title, fontSize: 16, fontStyle: 'italic', paddingVertical: 6, textAlign: 'center' },

  account: { alignItems: 'center', backgroundColor: COLORS.goldSoft, borderRadius: 16, flexDirection: 'row', gap: 12, marginTop: 6, paddingHorizontal: 14, paddingVertical: 13 },
  accountText: { color: COLORS.white, flex: 1, fontFamily: TYPOGRAPHY.body, fontSize: 14, fontWeight: '600' },

  empty: { alignItems: 'center', borderRadius: 20, gap: 10, overflow: 'hidden', paddingBottom: 22, paddingHorizontal: 22, paddingTop: 26 },
  emptyTitle: { color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontSize: 24, fontWeight: '700', textAlign: 'center' },
  emptyText: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 14.5, lineHeight: 21, textAlign: 'center' },
  startButton: { alignItems: 'center', backgroundColor: COLORS.gold, borderRadius: 10, flexDirection: 'row', gap: 6, marginTop: 6, minHeight: 42, paddingHorizontal: 18 },
  startText: { color: COLORS.greenDeep, fontFamily: TYPOGRAPHY.title, fontSize: 15.5, fontWeight: '700' },

  arabic: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'left', writingDirection: 'rtl' },
  arabicCentered: { fontFamily: TYPOGRAPHY.arabic, writingDirection: 'rtl' },
  arabicTight: { fontFamily: TYPOGRAPHY.arabic, letterSpacing: 0 },
});
