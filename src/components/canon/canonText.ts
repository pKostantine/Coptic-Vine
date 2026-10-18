import { tr } from '@/utils/appText';
import { getCurrentAppLanguage } from '@/utils/preferencesStorage';
import { toEasternArabicDigits, WEEKDAYS_AR, WEEKDAYS_EN, WEEKDAYS_FR } from '@/utils/localeFormat';
import {
  AGPEYA_PSALM_COUNTS,
  canonAgpeyaPrayer,
  parseCanonTime,
  type CanonFrequency,
  type CanonGoal,
  type CanonItem,
  type CanonKind,
  type CanonTask,
  type Weekday,
} from '@/utils/spiritualCanon';

/**
 * The canon's words in the App Language: what each task is called, how much
 * it asks, how often and when. Components that show them opt out of the React
 * Compiler with 'use no memo' (see utils/appText.ts).
 */

function arabic(): boolean {
  return getCurrentAppLanguage() === 'ar';
}

function number(value: number): string {
  return arabic() ? toEasternArabicDigits(value) : String(value);
}

/**
 * A count with its noun as Arabic says it: one and two have forms of their
 * own, three to ten take the plural, eleven and on the singular.
 */
function arabicCount(count: number, forms: { one: string; two: string; few: string; many: string }): string {
  if (count === 1) return forms.one;
  if (count === 2) return forms.two;
  const digits = toEasternArabicDigits(count);
  const lastTwo = count % 100;
  return lastTwo >= 3 && lastTwo <= 10 ? `${digits} ${forms.few}` : `${digits} ${forms.many}`;
}

function plural(count: number, english: [string, string], french: [string, string], arabicForms: Parameters<typeof arabicCount>[1]): string {
  if (arabic()) return arabicCount(count, arabicForms);
  if (getCurrentAppLanguage() === 'fr') return `${count} ${count > 1 ? french[1] : french[0]}`;
  return `${count} ${count === 1 ? english[0] : english[1]}`;
}

export function canonKindLabel(kind: CanonKind): string {
  if (kind === 'agpeya') return tr('Agpeya', 'Agpia', 'الأجبية');
  if (kind === 'bible') return tr('Bible', 'Bible', 'الكتاب المقدس');
  if (kind === 'metania') return tr('Metanias', 'Métanies', 'المطانيات');
  return tr('Custom', 'Personnalisé', 'خاص');
}

/** A prayer of the Agpeya's name: on a task ("The First Hour", "Midnight · Second Watch"), or short, in a list ("Prime", "Second Watch"). */
export function agpeyaHourName(hourId: string, form: 'prayer' | 'traditional' | 'short' = 'prayer'): string {
  const prayer = canonAgpeyaPrayer(hourId);
  if (!prayer) return hourId;
  const name = form === 'prayer' ? prayer.name : prayer.short;
  return tr(name.english, name.french, name.arabic);
}

/** "The First Hour", "Bible reading", "Metanias", or the custom item's own name. */
export function canonTaskTitle(task: Pick<CanonTask, 'kind' | 'hourId' | 'title'>): string {
  if (task.kind === 'agpeya' && task.hourId) return agpeyaHourName(task.hourId);
  if (task.kind === 'bible') return tr('Bible reading', 'Lecture de la Bible', 'قراءة الكتاب المقدس');
  if (task.kind === 'metania') return tr('Metanias', 'Métanies', 'المطانيات');
  return task.title ?? '';
}

/** What an item is called in the canon's list: its hours for the Agpeya. */
export function canonItemTitle(item: CanonItem): string {
  if (item.kind === 'custom') return item.title;
  if (item.kind === 'bible') return tr('Bible reading', 'Lecture de la Bible', 'قراءة الكتاب المقدس');
  if (item.kind === 'metania') return tr('Metanias', 'Métanies', 'المطانيات');
  return tr('Agpeya', 'Agpia', 'الأجبية');
}

export function minutesLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (arabic()) {
    const minuteText = arabicCount(rest, { one: 'دقيقة', two: 'دقيقتان', few: 'دقائق', many: 'دقيقة' });
    if (!hours) return minuteText;
    const hourText = arabicCount(hours, { one: 'ساعة', two: 'ساعتان', few: 'ساعات', many: 'ساعة' });
    return rest ? `${hourText} و${minuteText}` : hourText;
  }
  if (!hours) return `${minutes} min`;
  if (getCurrentAppLanguage() === 'fr') return rest ? `${hours} h ${String(rest).padStart(2, '0')}` : `${hours} h`;
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
}

/** "12 psalms": how many an hour holds, or a count of them. */
export function psalmsLabel(count: number): string {
  return plural(count, ['psalm', 'psalms'], ['psaume', 'psaumes'], { one: 'مزمور واحد', two: 'مزموران', few: 'مزامير', many: 'مزمورًا' });
}

/** "6 psalms", "All psalms", "2 chapters", "20 verses", "15 min", "50 metanias" — or null for no measure. */
export function canonGoalLabel(goal: CanonGoal, hourId?: string | null): string | null {
  switch (goal.kind) {
    case 'none':
      return null;
    case 'psalms':
      if (hourId && goal.count >= (AGPEYA_PSALM_COUNTS[hourId] ?? Infinity)) return tr('All psalms', 'Tous les psaumes', 'كل المزامير');
      return psalmsLabel(goal.count);
    case 'chapters':
      return plural(goal.count, ['chapter', 'chapters'], ['chapitre', 'chapitres'], { one: 'إصحاح واحد', two: 'إصحاحان', few: 'إصحاحات', many: 'إصحاحًا' });
    case 'verses':
      return plural(goal.count, ['verse', 'verses'], ['verset', 'versets'], { one: 'آية واحدة', two: 'آيتان', few: 'آيات', many: 'آية' });
    case 'metanias':
      return plural(goal.count, ['metania', 'metanias'], ['métanie', 'métanies'], { one: 'مطانية واحدة', two: 'مطانيتان', few: 'مطانيات', many: 'مطانية' });
    case 'minutes':
      return minutesLabel(goal.count);
    case 'times':
      if (goal.unit) return `${number(goal.count)} ${goal.unit}`;
      if (arabic()) return arabicCount(goal.count, { one: 'مرة واحدة', two: 'مرتان', few: 'مرات', many: 'مرة' });
      if (getCurrentAppLanguage() === 'fr') return `${goal.count} fois`;
      return goal.count === 1 ? 'Once' : `${goal.count} times`;
    default:
      return null;
  }
}

const WEEKDAY_SHORT = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  fr: ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'],
  ar: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
};
const WEEKDAY_INITIAL = {
  en: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
  fr: ['D', 'L', 'M', 'M', 'J', 'V', 'S'],
  ar: ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'],
};

export function weekdayShort(day: Weekday): string {
  return WEEKDAY_SHORT[getCurrentAppLanguage()][day];
}

/** "Saturday", "samedi", "السبت". */
export function weekdayName(day: Weekday): string {
  const language = getCurrentAppLanguage();
  return (language === 'ar' ? WEEKDAYS_AR : language === 'fr' ? WEEKDAYS_FR : WEEKDAYS_EN)[day];
}

export function weekdayInitial(day: Weekday): string {
  return WEEKDAY_INITIAL[getCurrentAppLanguage()][day];
}

function sameDays(days: readonly number[], expected: readonly number[]): boolean {
  return days.length === expected.length && expected.every((day) => days.includes(day));
}

/** "Every day", "Mon, Wed, Fri", "3 times a week", "Varies by day", "Days metanias are made". */
export function canonFrequencyLabel(frequency: CanonFrequency | { kind: 'byDay' }): string {
  if (frequency.kind === 'daily') return tr('Every day', 'Chaque jour', 'كل يوم');
  if (frequency.kind === 'applicable') return tr('All applicable days', 'Tous les jours prévus', 'كل الأيام المسموح بها');
  if (frequency.kind === 'fastingDays') return tr('Fasting days', 'Jours de jeûne', 'أيام الصوم');
  if (frequency.kind === 'byDay') return tr('Varies by day', 'Selon le jour', 'حسب اليوم');
  if (frequency.kind === 'perWeek') {
    const times = frequency.times;
    if (arabic()) {
      if (times === 1) return 'مرة في الأسبوع';
      if (times === 2) return 'مرتين في الأسبوع';
      return `${toEasternArabicDigits(times)} مرات في الأسبوع`;
    }
    if (getCurrentAppLanguage() === 'fr') return `${times} fois par semaine`;
    if (times === 1) return 'Once a week';
    if (times === 2) return 'Twice a week';
    return `${times} times a week`;
  }
  const days = frequency.days;
  if (!days.length) return tr('No days chosen', 'Aucun jour choisi', 'لم تُختر أيام');
  if (days.length === 7) return tr('Every day', 'Chaque jour', 'كل يوم');
  if (sameDays(days, [1, 2, 3, 4, 5])) return tr('Weekdays', 'En semaine', 'أيام العمل');
  if (sameDays(days, [0, 6])) return tr('Weekends', 'Le week-end', 'نهاية الأسبوع');
  return days.map((day) => weekdayShort(day)).join(arabic() ? '، ' : ', ');
}

/** What the metanias' calendar choices leave out, in a few words, where they are chosen. */
export function calendarDaysExplanation(): string {
  return tr('Not weekends or feasts', 'Sauf le week-end et les fêtes', 'ما عدا عطلة نهاية الأسبوع والأعياد');
}

/** Said on a day the Agpeya is left out (Palm Sunday evening to Bright Saturday). */
export function paschaAgpeyaNote(): string {
  return tr('No Agpeya from Monday Eve to Bright Saturday.', 'Pas d’Agpia de la veille du lundi au Samedi lumineux.', 'لا أجبية من ليلة الاثنين إلى سبت النور.');
}

/** "7:30 AM", "7 h 30", "٧:٣٠ ص": the time of day as the App Language tells it. */
export function canonTimeLabel(time: string): string {
  const { hour, minute } = parseCanonTime(time);
  const language = getCurrentAppLanguage();
  if (language === 'fr') return minute ? `${hour} h ${String(minute).padStart(2, '0')}` : `${hour} h`;
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  const clock = `${twelve}:${String(minute).padStart(2, '0')}`;
  if (language === 'ar') return `${toEasternArabicDigits(clock)} ${hour < 12 ? 'ص' : 'م'}`;
  return `${clock} ${hour < 12 ? 'AM' : 'PM'}`;
}

/** "2 of 3 this week". */
export function weeklyProgressLabel(done: number, target: number): string {
  if (arabic()) return `${toEasternArabicDigits(done)} من ${toEasternArabicDigits(target)} هذا الأسبوع`;
  if (getCurrentAppLanguage() === 'fr') return `${done} sur ${target} cette semaine`;
  return `${done} of ${target} this week`;
}

/** "3 of 5 done". */
export function dayProgressLabel(done: number, total: number): string {
  if (arabic()) return `${toEasternArabicDigits(done)} من ${toEasternArabicDigits(total)} مكتملة`;
  if (getCurrentAppLanguage() === 'fr') return `${done} sur ${total} accomplis`;
  return `${done} of ${total} done`;
}

/** The line under a task's name: how much, how often this week, and when. */
export function canonTaskDetail(task: CanonTask): string {
  const parts = [
    canonGoalLabel(task.goal, task.hourId),
    task.weekly ? weeklyProgressLabel(task.weekly.done, task.weekly.target) : null,
    task.time ? canonTimeLabel(task.time) : null,
  ].filter((part): part is string => Boolean(part));
  if (!parts.length && task.note) return task.note;
  return parts.join(' · ');
}

/** What a reminder says: the task, and how much it asks. */
export function canonReminderText(task: CanonTask): { title: string; body: string } {
  const goal = canonGoalLabel(task.goal, task.hourId);
  const title = canonTaskTitle(task);
  const lead = tr('Your spiritual canon', 'Votre canon spirituel', 'قانونك الروحي');
  const body = goal ? `${lead} · ${goal}` : task.note ? `${lead} · ${task.note}` : lead;
  return { title, body };
}
