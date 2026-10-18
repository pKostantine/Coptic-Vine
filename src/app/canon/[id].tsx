'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { LinearGradient } from 'expo-linear-gradient';
import Head from 'expo-router/head';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  ChoiceList,
  ChoiceSegment,
  EditorCard,
  FieldLabel,
  PrimaryButton,
  Stepper,
  TimeAndReminder,
  WeekdayChips,
} from '@/components/canon/CanonEditorParts';
import { agpeyaHourName, applicableDaysExplanation, canonFrequencyLabel, canonGoalLabel, canonItemTitle, psalmsLabel, weekdayName } from '@/components/canon/canonText';
import { NowPlayingAwareScrollView } from '@/components/playback/NowPlayingAwareScroll';
import { PageGlow, SectionHeading } from '@/components/vine/screens/BookPage';
import BleedPage from '@/components/vine/ui/BleedPage';
import BottomTabBar from '@/components/vine/ui/BottomTabBar';
import Icon from '@/components/vine/ui/Icon';
import SubPageHeader from '@/components/vine/ui/SubPageHeader';
import { COLORS, TYPOGRAPHY } from '@/constants/theme';
import { useReadingPreferences } from '@/context/ReadingPreferencesContext';
import { useSpiritualCanon } from '@/context/SpiritualCanonContext';
import { AGPEYA_HOURS } from '@/utils/agpeyaHours';
import { tr } from '@/utils/appText';
import { goBack } from '@/utils/navigation';
import {
  AGPEYA_PSALM_COUNTS,
  agpeyaHourDefaultTime,
  canonGoalStep,
  canonHasReminders,
  canonItemProblem,
  canonWeekday,
  FREQUENCY_KINDS,
  GOAL_KINDS,
  GOAL_LIMITS,
  MAX_NOTE_LENGTH,
  MAX_TITLE_LENGTH,
  MAX_UNIT_LENGTH,
  newCanonItem,
  newHourPlan,
  normalizeCanonItem,
  sortHourPlans,
  WEEKDAYS,
  type AgpeyaCanonItem,
  type CanonFrequency,
  type CanonGoal,
  type CanonGoalKind,
  type CanonHourPlan,
  type CanonItem,
  type CanonKind,
  type Weekday,
} from '@/utils/spiritualCanon';

const MAX_FONT_SCALE = 1.3;
const PLACEHOLDER = 'rgba(205, 216, 203, 0.55)';
/** A custom item's reminder, before it has a time of its own, suggests the morning. */
const MORNING = '07:00';

function goalKindLabel(kind: CanonGoalKind, short = false): string {
  switch (kind) {
    case 'psalms': return tr('Psalms', 'Psaumes', 'مزامير');
    case 'chapters': return tr('Chapters', 'Chapitres', 'إصحاحات');
    case 'verses': return tr('Verses', 'Versets', 'آيات');
    case 'metanias': return tr('Count', 'Nombre', 'العدد');
    case 'minutes': return tr('Time', 'Durée', 'المدة');
    case 'times': return tr('Count', 'Nombre', 'العدد');
    // Four choices in the pill leave room for a short word only.
    default: return short ? tr('None', 'Aucune', 'بلا') : tr('No measure', 'Sans mesure', 'بلا تحديد');
  }
}

function confirmRemoval(title: string, onConfirm: () => void) {
  const question = tr('Remove from your canon?', 'Retirer de votre canon ?', 'أتحذفه من قانونك؟');
  if (Platform.OS === 'web') {
    if ((globalThis as { confirm?: (message: string) => boolean }).confirm?.(`${question}\n${title}`)) onConfirm();
    return;
  }
  Alert.alert(question, title, [
    { text: tr('Cancel', 'Annuler', 'إلغاء'), style: 'cancel' },
    { text: tr('Remove', 'Retirer', 'احذف'), style: 'destructive', onPress: onConfirm },
  ]);
}

/**
 * One item of the spiritual canon, made or changed: for the Agpeya its hours
 * (the same each day, or by day of the week), each with its measure and
 * time; for the Bible and anything else, its measure; how often it is kept;
 * and when, with a reminder then. Nothing is kept until it is saved.
 */
export default function CanonItemScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; kind?: string }>();
  const { preferences } = useReadingPreferences();
  const arabic = preferences.appLanguage === 'ar';
  const canon = useSpiritualCanon();
  const isNew = params.id === 'new';
  const kind: CanonKind = params.kind === 'bible' || params.kind === 'metania' || params.kind === 'custom' ? params.kind : 'agpeya';
  const existing = isNew ? null : canon.items.find((item) => item.id === params.id) ?? null;
  const [draft, setDraft] = useState<CanonItem | null>(() => (isNew ? newCanonItem(kind) : existing));
  const [problem, setProblem] = useState<string | null>(null);
  // The canon may still be loading when the page opens: the item arrives with it.
  if (!draft && existing) setDraft(existing);

  const back = () => goBack(router, '/canon/edit' as never);
  const update = (next: CanonItem) => {
    setDraft(next);
    setProblem(null);
  };

  const remindersNote = Platform.OS === 'web'
    ? tr('Reminders come to the Coptic Vine app on your phone or tablet', 'Les rappels arrivent dans l’application sur votre téléphone ou votre tablette', 'تصل التذكيرات إلى التطبيق على هاتفك أو جهازك اللوحي')
    : !canon.remindersEnabled
      ? tr('Reminders are turned off on this device', 'Les rappels sont désactivés sur cet appareil', 'التذكيرات متوقفة على هذا الجهاز')
      : canon.reminderPermission === 'denied'
        ? tr('Allow notifications for Coptic Vine in Settings', 'Autorisez les notifications de Coptic Vine dans les Réglages', 'اسمح بإشعارات كوبتك فاين في الإعدادات')
        : null;

  const save = async () => {
    if (!draft) return;
    const issue = canonItemProblem(draft);
    if (issue) {
      setProblem(issue === 'title'
        ? tr('Give it a name.', 'Donnez-lui un nom.', 'أعطه اسمًا.')
        : issue === 'hours'
          ? tr('Choose at least one hour of the Agpeya.', 'Choisissez au moins une heure de l’Agpia.', 'اختر ساعة واحدة على الأقل من الأجبية.')
          : tr('Choose at least one day of the week.', 'Choisissez au moins un jour de la semaine.', 'اختر يومًا واحدًا على الأقل من الأسبوع.'));
      return;
    }
    const clean = normalizeCanonItem(draft) ?? draft;
    canon.saveItem(clean);
    // Asked for at the moment a reminder is first wanted, not before.
    if (Platform.OS !== 'web' && canonHasReminders([clean]) && canon.remindersEnabled && canon.reminderPermission === 'undetermined') {
      await canon.requestReminderPermission();
    }
    back();
  };

  const remove = () => {
    if (!existing) return;
    confirmRemoval(canonItemTitle(existing), () => {
      canon.deleteItem(existing.id);
      back();
    });
  };

  const headerTitle = draft ? (draft.kind === 'custom' && !draft.title.trim() ? tr('Something else', 'Autre chose', 'شيء آخر') : canonItemTitle(draft)) : tr('Spiritual Canon', 'Canon spirituel', 'القانون الروحي');

  return (
    <BleedPage background={<PageGlow kind="green" />} footer={<BottomTabBar active="home" />}>
      <Head><title>{headerTitle}</title></Head>
      <SubPageHeader compact title={headerTitle} arabic={arabic} onBack={back} backLabel={tr('Back', 'Retour', 'رجوع')} />
      <NowPlayingAwareScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.column}>
          {!draft ? (
            <View style={styles.missing}>
              <Text style={[styles.missingText, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {canon.loaded
                  ? tr('This is no longer in your canon.', 'Cet élément n’est plus dans votre canon.', 'لم يعد هذا في قانونك.')
                  : tr('Loading…', 'Chargement…', 'جارٍ التحميل…')}
              </Text>
            </View>
          ) : (
            <>
              {draft.kind === 'custom' ? (
                <>
                  <View style={styles.firstSection}>
                    <SectionHeading size="page" title={tr('What you keep', 'Ce que vous gardez', 'ما تحافظ عليه')} arabic={arabic} />
                  </View>
                  <EditorCard>
                    <FieldLabel arabic={arabic}>{tr('Name', 'Nom', 'الاسم')}</FieldLabel>
                    <TextInput
                      value={draft.title}
                      onChangeText={(title) => update({ ...draft, title })}
                      maxLength={MAX_TITLE_LENGTH}
                      placeholder={tr('The Jesus Prayer, fasting, a spiritual reading…', 'La prière de Jésus, le jeûne, une lecture spirituelle…', 'صلاة يسوع، الصوم، قراءة روحية…')}
                      placeholderTextColor={PLACEHOLDER}
                      returnKeyType="done"
                      style={[styles.input, arabic && styles.arabic]}
                    />
                    <FieldLabel arabic={arabic}>{tr('Note (optional)', 'Note (facultative)', 'ملاحظة (اختيارية)')}</FieldLabel>
                    <TextInput
                      value={draft.note}
                      onChangeText={(note) => update({ ...draft, note })}
                      maxLength={MAX_NOTE_LENGTH}
                      multiline
                      placeholder={tr('Anything to remember about it', 'Ce qu’il faut s’en rappeler', 'ما تريد تذكّره عنه')}
                      placeholderTextColor={PLACEHOLDER}
                      style={[styles.input, styles.inputMultiline, arabic && styles.arabic]}
                    />
                  </EditorCard>
                </>
              ) : null}

              {draft.kind === 'agpeya' ? (
                <AgpeyaEditor item={draft} today={canon.today} arabic={arabic} remindersNote={remindersNote} onChange={update} />
              ) : (
                <>
                  <View style={draft.kind === 'bible' || draft.kind === 'metania' ? styles.firstSection : null}>
                    <SectionHeading size="page" title={tr('How much', 'Combien', 'المقدار')} arabic={arabic} />
                  </View>
                  <EditorCard>
                    <GoalEditor kind={draft.kind} goal={draft.goal} arabic={arabic} onChange={(goal) => update({ ...draft, goal })} />
                  </EditorCard>
                </>
              )}

              {draft.kind !== 'agpeya' || draft.pattern === 'same' ? (
                <>
                  <SectionHeading size="page" title={tr('How often', 'À quelle fréquence', 'كم مرة')} arabic={arabic} />
                  <EditorCard>
                    <FrequencyEditor kind={draft.kind} frequency={draft.frequency} today={canon.today} arabic={arabic} onChange={(frequency) => update({ ...draft, frequency })} />
                  </EditorCard>
                </>
              ) : null}

              {draft.kind !== 'agpeya' ? (
                <>
                  <SectionHeading size="page" title={tr('When', 'Quand', 'متى')} arabic={arabic} />
                  <EditorCard>
                    <TimeAndReminder
                      time={draft.time}
                      remind={draft.remind}
                      suggestedTime={MORNING}
                      arabic={arabic}
                      remindersNote={remindersNote}
                      onChange={({ time, remind }) => update({ ...draft, time, remind })}
                    />
                  </EditorCard>
                </>
              ) : null}

              {problem ? <Text accessibilityRole="alert" style={[styles.problem, arabic && styles.arabic]}>{problem}</Text> : null}
              <View style={styles.actions}>
                <PrimaryButton
                  arabic={arabic}
                  label={isNew ? tr('Add to canon', 'Ajouter au canon', 'أضف إلى القانون') : tr('Save changes', 'Enregistrer', 'احفظ التغييرات')}
                  onPress={() => void save()}
                />
                {existing ? (
                  <Pressable accessibilityRole="button" onPress={remove} style={({ pressed }) => [styles.remove, pressed && styles.pressed]}>
                    <Icon name="trash-outline" size={18} color={DESTRUCTIVE} />
                    <Text style={[styles.removeText, arabic && styles.arabicTight]}>{tr('Remove from canon', 'Retirer du canon', 'احذف من القانون')}</Text>
                  </Pressable>
                ) : null}
              </View>
            </>
          )}
        </View>
      </NowPlayingAwareScrollView>
    </BleedPage>
  );
}

/** How much a task asks: nothing set, or a count of psalms, chapters, minutes or the believer's own unit. */
function GoalEditor({ kind, goal, hourId, arabic, onChange }: {
  kind: CanonKind;
  goal: CanonGoal;
  hourId?: string;
  arabic: boolean;
  onChange: (goal: CanonGoal) => void;
}) {
  const maxFor = (goalKind: Exclude<CanonGoalKind, 'none'>) => (goalKind === 'psalms' && hourId ? AGPEYA_PSALM_COUNTS[hourId] ?? GOAL_LIMITS.psalms.max : GOAL_LIMITS[goalKind].max);
  const select = (next: CanonGoalKind) => {
    if (next === goal.kind) return;
    if (next === 'none') {
      onChange({ kind: 'none' });
      return;
    }
    const count = Math.min(GOAL_LIMITS[next].initial, maxFor(next));
    onChange(next === 'times' ? { kind: 'times', count, unit: '' } : { kind: next, count } as CanonGoal);
  };
  return (
    <View style={styles.goal}>
      <ChoiceSegment
        arabic={arabic}
        options={GOAL_KINDS[kind].map((option) => ({ key: option, label: goalKindLabel(option, GOAL_KINDS[kind].length > 3) }))}
        selected={goal.kind}
        onSelect={select}
      />
      {goal.kind !== 'none' ? (
        <Stepper
          value={goal.count}
          min={GOAL_LIMITS[goal.kind].min}
          max={maxFor(goal.kind)}
          step={(value, up) => canonGoalStep(goal.kind as Exclude<CanonGoalKind, 'none'>, value, up)}
          label={goalKindLabel(goal.kind)}
          format={(count) => canonGoalLabel({ ...goal, count } as CanonGoal, hourId) ?? String(count)}
          onChange={(count) => onChange({ ...goal, count } as CanonGoal)}
        />
      ) : null}
      {goal.kind === 'times' ? (
        <TextInput
          value={goal.unit}
          onChangeText={(unit) => onChange({ ...goal, unit })}
          maxLength={MAX_UNIT_LENGTH}
          placeholder={tr('Of what? (metanias, prayers…)', 'De quoi ? (métanies, prières…)', 'من ماذا؟ (مطانيات، صلوات…)')}
          placeholderTextColor={PLACEHOLDER}
          returnKeyType="done"
          style={[styles.input, arabic && styles.arabic]}
        />
      ) : null}
    </View>
  );
}

function frequencyKindLabel(kind: CanonFrequency['kind'], long = false): string {
  switch (kind) {
    case 'applicable': return tr('All applicable days', 'Tous les jours prévus', 'كل الأيام المسموح بها');
    case 'weekdays': return long ? tr('On certain days of the week', 'Certains jours de la semaine', 'في أيام معيّنة من الأسبوع') : tr('Some days', 'Certains jours', 'أيام معيّنة');
    case 'perWeek': return long ? tr('A number of times a week', 'Un nombre de fois par semaine', 'عددًا من المرات في الأسبوع') : tr('Per week', 'Par semaine', 'في الأسبوع');
    default: return tr('Every day', 'Chaque jour', 'كل يوم');
  }
}

/** Every day, on chosen days of the week, a number of times a week — and for metanias, every day they are made. */
function FrequencyEditor({ kind, frequency, today, arabic, onChange }: {
  kind: CanonKind;
  frequency: CanonFrequency;
  today: string;
  arabic: boolean;
  onChange: (frequency: CanonFrequency) => void;
}) {
  const select = (next: CanonFrequency['kind']) => {
    if (next === frequency.kind) return;
    if (next === 'daily') onChange({ kind: 'daily' });
    else if (next === 'applicable') onChange({ kind: 'applicable' });
    // Chosen days start from today's.
    else if (next === 'weekdays') onChange({ kind: 'weekdays', days: [canonWeekday(today)] });
    else onChange({ kind: 'perWeek', times: 3 });
  };
  return (
    <View style={styles.goal}>
      {FREQUENCY_KINDS[kind].length > 3 ? (
        // Metanias' four choices, the first explained where it is chosen.
        <ChoiceList
          arabic={arabic}
          options={FREQUENCY_KINDS[kind].map((option) => ({
            key: option,
            label: frequencyKindLabel(option, true),
            detail: option === 'applicable' ? applicableDaysExplanation() : null,
          }))}
          selected={frequency.kind}
          onSelect={select}
        />
      ) : (
        <ChoiceSegment
          arabic={arabic}
          options={FREQUENCY_KINDS[kind].map((option) => ({ key: option, label: frequencyKindLabel(option) }))}
          selected={frequency.kind}
          onSelect={select}
        />
      )}
      {frequency.kind === 'weekdays' ? (
        <>
          <WeekdayChips
            arabic={arabic}
            selected={frequency.days}
            onToggle={(day) => onChange({
              kind: 'weekdays',
              days: frequency.days.includes(day) ? frequency.days.filter((other) => other !== day) : [...frequency.days, day].sort() as Weekday[],
            })}
          />
          <Text style={[styles.hint, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{canonFrequencyLabel(frequency)}</Text>
        </>
      ) : null}
      {frequency.kind === 'perWeek' ? (
        <>
          <Stepper
            value={frequency.times}
            min={1}
            max={6}
            step={1}
            label={tr('Times a week', 'Fois par semaine', 'مرات في الأسبوع')}
            format={(times) => canonFrequencyLabel({ kind: 'perWeek', times })}
            onChange={(times) => onChange({ kind: 'perWeek', times })}
          />
          <Text style={[styles.hint, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {tr(
              'It stays on each day’s list until it has been done that many times in the week (Sunday to Saturday).',
              'Il reste sur la liste de chaque jour jusqu’à avoir été fait autant de fois dans la semaine (du dimanche au samedi).',
              'يبقى في قائمة كل يوم حتى يُتمّ هذا العدد من المرات في الأسبوع (من الأحد إلى السبت).',
            )}
          </Text>
        </>
      ) : null}
    </View>
  );
}

/**
 * The Agpeya's hours: the same on every day it is kept, or a set for each day
 * of the week. Each hour chosen has its measure, its time and its reminder.
 */
function AgpeyaEditor({ item, today, arabic, remindersNote, onChange }: {
  item: AgpeyaCanonItem;
  today: string;
  arabic: boolean;
  remindersNote: string | null;
  onChange: (item: AgpeyaCanonItem) => void;
}) {
  const [editDay, setEditDay] = useState<Weekday>(() => canonWeekday(today));
  const byDay = item.pattern === 'byDay';
  const plans = byDay ? item.days[editDay] : item.hours;

  const setPlans = (next: CanonHourPlan[]) => {
    const sorted = sortHourPlans(next);
    if (byDay) onChange({ ...item, days: item.days.map((dayPlans, day) => (day === editDay ? sorted : dayPlans)) });
    else onChange({ ...item, hours: sorted });
  };

  const switchPattern = (pattern: AgpeyaCanonItem['pattern']) => {
    if (pattern === item.pattern) return;
    const copy = (list: CanonHourPlan[]) => list.map((plan) => ({ ...plan, goal: { ...plan.goal } }));
    if (pattern === 'byDay' && !item.days.some((dayPlans) => dayPlans.length)) {
      // Each day it was kept starts with the hours it had.
      const kept = (day: Weekday) => item.frequency.kind !== 'weekdays' || item.frequency.days.includes(day);
      onChange({ ...item, pattern, days: WEEKDAYS.map((day) => (kept(day) ? copy(item.hours) : [])) });
      return;
    }
    if (pattern === 'same' && !item.hours.length) {
      onChange({ ...item, pattern, hours: copy(item.days[editDay].length ? item.days[editDay] : item.days.find((dayPlans) => dayPlans.length) ?? []) });
      return;
    }
    onChange({ ...item, pattern });
  };

  const toggleHour = (hourId: string) => {
    const current = plans.find((plan) => plan.hourId === hourId);
    setPlans(current ? plans.filter((plan) => plan.hourId !== hourId) : [...plans, newHourPlan(hourId)]);
  };
  const changePlan = (next: CanonHourPlan) => setPlans(plans.map((plan) => (plan.hourId === next.hourId ? next : plan)));

  const daysWithHours = WEEKDAYS.filter((day) => item.days[day].length);
  const copyToEveryDay = () => {
    const source = item.days[editDay];
    onChange({ ...item, days: WEEKDAYS.map(() => source.map((plan) => ({ ...plan, goal: { ...plan.goal } }))) });
  };

  return (
    <>
      <View style={styles.firstSection}>
        <SectionHeading size="page" title={tr('Hours of the Agpeya', 'Heures de l’Agpia', 'ساعات الأجبية')} arabic={arabic} />
      </View>
      <EditorCard>
        <ChoiceSegment
          arabic={arabic}
          options={[
            { key: 'same', label: tr('Same every day', 'Chaque jour pareil', 'نفسها كل يوم') },
            { key: 'byDay', label: tr('Varies by day', 'Selon le jour', 'حسب اليوم') },
          ]}
          selected={item.pattern}
          onSelect={switchPattern}
        />
        {byDay ? (
          <>
            <WeekdayChips arabic={arabic} selected={[editDay]} marked={daysWithHours} onToggle={setEditDay} />
            <View style={styles.dayRow}>
              <Text style={[styles.hint, styles.flex, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {plans.length
                  ? `${tr('The hours for', 'Les heures du', 'ساعات يوم')} ${weekdayName(editDay)}`
                  : `${tr('No Agpeya on', 'Pas d’Agpia le', 'لا أجبية يوم')} ${weekdayName(editDay)}`}
              </Text>
              {plans.length ? (
                <Pressable accessibilityRole="button" onPress={copyToEveryDay} style={({ pressed }) => [styles.smallAction, pressed && styles.pressed]}>
                  <Text style={[styles.smallActionText, arabic && styles.arabicTight]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{tr('Use on every day', 'Pour tous les jours', 'لكل الأيام')}</Text>
                </Pressable>
              ) : null}
            </View>
          </>
        ) : (
          <Text style={[styles.hint, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {tr('The same hours on each day you keep them.', 'Les mêmes heures chaque jour où vous les gardez.', 'الساعات نفسها في كل يوم تحافظ عليها.')}
          </Text>
        )}
      </EditorCard>

      <View style={styles.hours}>
        {AGPEYA_HOURS.map((hour) => {
          const plan = plans.find((candidate) => candidate.hourId === hour.id) ?? null;
          return (
            <HourCard
              key={`${byDay ? editDay : 'same'}-${hour.id}`}
              hourId={hour.id}
              plan={plan}
              arabic={arabic}
              remindersNote={remindersNote}
              onToggle={() => toggleHour(hour.id)}
              onChange={changePlan}
            />
          );
        })}
      </View>
    </>
  );
}

function HourCard({ hourId, plan, arabic, remindersNote, onToggle, onChange }: {
  hourId: string;
  plan: CanonHourPlan | null;
  arabic: boolean;
  remindersNote: string | null;
  onToggle: () => void;
  onChange: (plan: CanonHourPlan) => void;
}) {
  const on = Boolean(plan);
  const psalms = AGPEYA_PSALM_COUNTS[hourId];
  return (
    <View style={[styles.hourCard, on && styles.hourCardOn]}>
      <LinearGradient colors={[COLORS.surfaceDeep, COLORS.surface]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={agpeyaHourName(hourId)}
        accessibilityState={{ checked: on }}
        aria-checked={on}
        onPress={onToggle}
        style={({ pressed }) => [styles.hourHead, pressed && styles.pressed]}
      >
        <View style={[styles.box, on && styles.boxOn]}>
          {on ? <Icon name="checkmark" size={16} color={COLORS.greenDeep} /> : null}
        </View>
        <View style={styles.flex}>
          <Text style={[styles.hourName, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{agpeyaHourName(hourId)}</Text>
          <Text style={[styles.hourSub, arabic && styles.arabic]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {[agpeyaHourName(hourId, 'traditional'), psalms ? psalmsLabel(psalms) : null].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </Pressable>
      {plan ? (
        <View style={styles.hourBody}>
          <GoalEditor kind="agpeya" hourId={hourId} goal={plan.goal} arabic={arabic} onChange={(goal) => onChange({ ...plan, goal })} />
          <TimeAndReminder
            time={plan.time}
            remind={plan.remind}
            suggestedTime={agpeyaHourDefaultTime(hourId)}
            arabic={arabic}
            remindersNote={remindersNote}
            onChange={({ time, remind }) => onChange({ ...plan, time, remind })}
          />
        </View>
      ) : null}
    </View>
  );
}

const DESTRUCTIVE = '#FF8A7A';

const styles = StyleSheet.create({
  content: { paddingBottom: 40, paddingHorizontal: 16 },
  column: { alignSelf: 'center', maxWidth: 640, width: '100%' },
  firstSection: { marginTop: -24 },
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.78 },
  goal: { gap: 12 },
  hint: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 13, lineHeight: 18 },
  input: { backgroundColor: 'rgba(0, 0, 0, 0.38)', borderRadius: 14, color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 15.5, minHeight: 48, paddingHorizontal: 14, paddingVertical: 12 },
  inputMultiline: { minHeight: 76, textAlignVertical: 'top' },
  dayRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  smallAction: { alignItems: 'center', backgroundColor: COLORS.goldSoft, borderRadius: 99, height: 30, justifyContent: 'center', paddingHorizontal: 12 },
  smallActionText: { color: COLORS.gold, fontFamily: TYPOGRAPHY.body, fontSize: 12.5, fontWeight: '700' },

  hours: { gap: 8, marginTop: 10 },
  hourCard: { borderColor: 'transparent', borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  hourCardOn: { borderColor: COLORS.goldLine },
  hourHead: { alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: 60, paddingHorizontal: 14, paddingVertical: 10 },
  box: { alignItems: 'center', borderColor: COLORS.goldLine, borderRadius: 8, borderWidth: 1.5, height: 26, justifyContent: 'center', width: 26 },
  boxOn: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  hourName: { color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontSize: 17, fontWeight: '700' },
  hourSub: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 12.5, marginTop: 2 },
  hourBody: { borderTopColor: 'rgba(255, 255, 255, 0.07)', borderTopWidth: 1, gap: 12, paddingBottom: 12, paddingHorizontal: 14, paddingTop: 12 },

  problem: { color: DESTRUCTIVE, fontFamily: TYPOGRAPHY.body, fontSize: 14, fontWeight: '600', marginTop: 16, textAlign: 'center' },
  actions: { gap: 10, marginTop: 22 },
  remove: { alignItems: 'center', backgroundColor: 'rgba(214, 69, 69, 0.12)', borderRadius: 14, flexDirection: 'row', gap: 8, height: 48, justifyContent: 'center' },
  removeText: { color: DESTRUCTIVE, fontFamily: TYPOGRAPHY.body, fontSize: 15, fontWeight: '700' },
  missing: { backgroundColor: 'rgba(255, 255, 255, 0.04)', borderRadius: 16, marginTop: 8, padding: 16 },
  missingText: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 14.5 },

  arabic: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'left', writingDirection: 'rtl' },
  arabicTight: { fontFamily: TYPOGRAPHY.arabic, letterSpacing: 0 },
});
