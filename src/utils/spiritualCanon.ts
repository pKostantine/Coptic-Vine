import { AGPEYA_HOURS } from './agpeyaHours';

/**
 * A spiritual canon: the rule of prayer a believer keeps, set down as items
 * and checked off a day at a time. Kept pure so its rules can be read and
 * tested on their own; the provider (context/SpiritualCanonContext.tsx)
 * keeps the document on the device and the account, and schedules the
 * reminders from it.
 *
 * - An item is the Agpeya (some of its hours), the Bible, metanias,
 *   abstinence, or anything else the believer names (a custom item).
 * - Each is kept every day, on chosen days of the week, or a number of times
 *   a week. The Agpeya can instead keep different hours on each day, and
 *   metanias can be kept on all applicable days (METANIA_CONDITION) or on
 *   fasting days only (METANIA_FASTING_CONDITION), from the real calendar.
 *   Abstinence is kept on the weekdays of the fasts chosen (ABSTINENCE_FASTS),
 *   from the calendar too, until a time of day.
 * - Each can ask for a measure: a number of psalms (the Agpeya), of chapters
 *   or verses (the Bible), of minutes, or of the believer's own unit ("50
 *   metanias").
 * - Each task can have a time of day, and a reminder then.
 *
 * A day's tasks are the items due that day; an Agpeya item is one task per
 * hour. Ticking one off is a mark on that day.
 */

export type CanonKind = 'agpeya' | 'bible' | 'metania' | 'abstinence' | 'custom';
/** 0 is Sunday, as `Date.getUTCDay` counts. The week starts on Sunday. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export const WEEKDAYS: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6];

export type CanonGoal =
  | { kind: 'none' }
  | { kind: 'psalms'; count: number }
  | { kind: 'chapters'; count: number }
  | { kind: 'verses'; count: number }
  | { kind: 'metanias'; count: number }
  | { kind: 'minutes'; count: number }
  | { kind: 'times'; count: number; unit: string };
export type CanonGoalKind = CanonGoal['kind'];

export type CanonFrequency =
  | { kind: 'daily' }
  | { kind: 'weekdays'; days: Weekday[] }
  | { kind: 'perWeek'; times: number }
  /** Metanias only: every day they are made, as the calendar says (METANIA_CONDITION). */
  | { kind: 'applicable' }
  /** Metanias only: those days that are fasting days (METANIA_FASTING_CONDITION). */
  | { kind: 'fastingDays' }
  /** Abstinence only: the weekdays of these fasts (ABSTINENCE_FASTS), as the calendar has them. */
  | { kind: 'fasts'; fasts: AbstinenceFast[] };
export type CanonFrequencyKind = CanonFrequency['kind'];

/**
 * The days metanias are made: not on a weekend, nor on a feast — the Feasts
 * and Weekends flags calendar.get_context_flags gives the day, the real day,
 * never the date the Books screen has been moved to. Holy Week is not a feast
 * here, though the calendar marks it (HolyWeek, Holy Monday to Bright
 * Saturday) Feasts: its Monday to Friday keep their metanias.
 */
export const METANIA_CONDITION = '!((Feasts && !HolyWeek) || Weekends)';
/** The same days, the fasting days among them only: Holy Week's are, though the calendar doesn't mark them Fasts. */
export const METANIA_FASTING_CONDITION = '!((Feasts && !HolyWeek) || Weekends) && (Fasts || HolyWeek)';

/** A fast abstinence can be kept in: the Church's fasts, and Wednesdays and Fridays. */
export type AbstinenceFast = 'wedFri' | 'nativity' | 'paramoun' | 'jonah' | 'lent' | 'holyWeek' | 'apostles' | 'stMary';

/**
 * The days abstinence is kept on at all: Monday to Friday (Weekdays), never
 * on a feast — Holy Week aside, as for metanias (METANIA_CONDITION).
 */
export const ABSTINENCE_DAY_CONDITION = 'Weekdays && !(Feasts && !HolyWeek)';

/**
 * The fasts abstinence can be kept in, in the order of the list to choose
 * from, each by the flags calendar.get_context_flags gives a day. Wednesdays
 * and Fridays are those that are fasting days: the ordinary ones
 * (NormalFastingDays, not in the Holy Fifty Days or the festive periods) and
 * those of the fasts the calendar takes that flag from (getContextFlags drops
 * it through Lent and Pascha). Lent stops at its last Friday; Holy Week is
 * its own.
 */
export const ABSTINENCE_FASTS: readonly { id: AbstinenceFast; condition: string }[] = [
  { id: 'wedFri', condition: '(Wednesday || Friday) && (NormalFastingDays || Lent || HolyWeek || JonahsFast || ParamounNativity || ParamounTheophany)' },
  { id: 'nativity', condition: 'NativityFast' },
  { id: 'paramoun', condition: 'ParamounNativity || ParamounTheophany' },
  { id: 'jonah', condition: 'JonahsFast' },
  { id: 'lent', condition: 'Lent && !HolyWeek' },
  { id: 'holyWeek', condition: 'HolyWeek' },
  { id: 'apostles', condition: 'ApostlesFast' },
  { id: 'stMary', condition: 'StMarysFast || StMaryFast' },
];
const ABSTINENCE_FAST_IDS: readonly AbstinenceFast[] = ABSTINENCE_FASTS.map((fast) => fast.id);

export function isAbstinenceFast(value: unknown): value is AbstinenceFast {
  return ABSTINENCE_FAST_IDS.includes(value as AbstinenceFast);
}

/** Abstinence's time, until the believer sets their own. */
export const ABSTINENCE_DEFAULT_UNTIL = '14:00';

/** One hour of the Agpeya in an Agpeya item: how much of it, and when. */
export interface CanonHourPlan {
  hourId: string;
  goal: CanonGoal;
  /** "HH:MM", 24-hour; null for no set time. */
  time: string | null;
  /** A notification at `time`. */
  remind: boolean;
}

interface CanonItemBase {
  id: string;
  /** How often it is kept. An Agpeya item that varies by day keeps the days its hours give instead. */
  frequency: CanonFrequency;
  createdAt: string;
  updatedAt: string;
}

export interface AgpeyaCanonItem extends CanonItemBase {
  kind: 'agpeya';
  /** The same hours on every day it is kept, or a set of hours for each day of the week. */
  pattern: 'same' | 'byDay';
  hours: CanonHourPlan[];
  /** Seven lists, Sunday first; a day with none keeps no Agpeya. */
  days: CanonHourPlan[][];
}

export interface BibleCanonItem extends CanonItemBase {
  kind: 'bible';
  goal: CanonGoal;
  time: string | null;
  remind: boolean;
}

export interface MetaniaCanonItem extends CanonItemBase {
  kind: 'metania';
  goal: CanonGoal;
  time: string | null;
  remind: boolean;
}

/** Not eating until a time of day, on the weekdays of the fasts chosen (its frequency). */
export interface AbstinenceCanonItem extends CanonItemBase {
  kind: 'abstinence';
  frequency: { kind: 'fasts'; fasts: AbstinenceFast[] };
  /** No measure: abstinence asks for a time. */
  goal: CanonGoal;
  /** Until when, "HH:MM": always set. */
  time: string;
  /** A notification when it ends. */
  remind: boolean;
}

export interface CustomCanonItem extends CanonItemBase {
  kind: 'custom';
  title: string;
  note: string;
  goal: CanonGoal;
  time: string | null;
  remind: boolean;
}

export type CanonItem = AgpeyaCanonItem | BibleCanonItem | MetaniaCanonItem | AbstinenceCanonItem | CustomCanonItem;

/**
 * A task ticked off (or unticked, which is kept so the account's older tick
 * doesn't come back), or skipped: taken off that one day's list.
 */
export interface CanonMark {
  done: boolean;
  /** Left out of this day: not asked, not counted, not reminded of. */
  skipped?: boolean;
  /** When it was last changed: the newest change wins a merge. */
  at: string;
}
export type CanonDayMarks = Record<string, CanonMark>;

export interface CanonDocument {
  version: 1;
  items: CanonItem[];
  /** Items removed, by id, with when: a removal wins over any copy older than it. */
  itemDeletions: Record<string, string>;
  /** Marks by day ("YYYY-MM-DD"), then by task key. */
  days: Record<string, CanonDayMarks>;
  updatedAt: string;
}

export const MAX_CANON_ITEMS = 40;
const MAX_ITEM_DELETIONS = 400;
/** How many days of marks the device keeps (the account keeps them all). */
export const CANON_DAYS_KEPT = 120;
const MAX_MARKS_PER_DAY = 200;
export const MAX_TITLE_LENGTH = 80;
export const MAX_NOTE_LENGTH = 280;
export const MAX_UNIT_LENGTH = 30;

interface PrayerName {
  english: string;
  french: string;
  arabic: string;
}

/** A prayer of the Agpeya a canon can keep: an hour of the day, the Prayer of the Veil, or a watch of the Midnight hour. */
export interface CanonAgpeyaPrayer {
  /** What the canon stores ("first_hour", "midnight_second_watch"). */
  id: string;
  /** The Agpeya service it opens (SERVICES_BY_CATEGORY.agpeya). */
  serviceId: string;
  /** The section it opens at, by hymn key: a watch's own beginning; null for the top. */
  openAt: string | null;
  /** When it is prayed, for a reminder's first suggestion and for its place in the day. */
  defaultTime: string;
  /** How many psalms it prays (the Agpeya's own; Psalm 118 counted once). */
  psalms: number;
  /** Its name on a task: "The First Hour", "Midnight · Second Watch". */
  name: PrayerName;
  /** Its short name in a list: "Prime", "Second Watch". */
  short: PrayerName;
}

const MIDNIGHT_NAME: PrayerName = { english: 'Midnight', french: 'Minuit', arabic: 'نصف الليل' };

/** A watch of the Midnight hour, by the Agpeya's own title for it. */
function midnightWatch(id: string, openAt: string | null, psalms: number, title: PrayerName): CanonAgpeyaPrayer {
  return {
    id,
    serviceId: 'midnight_hour',
    openAt,
    defaultTime: '00:00',
    psalms,
    name: {
      english: `${MIDNIGHT_NAME.english} · ${title.english}`,
      french: `${MIDNIGHT_NAME.french} · ${title.french}`,
      arabic: `${MIDNIGHT_NAME.arabic} · ${title.arabic}`,
    },
    short: title,
  };
}

const DAY_HOUR_PSALMS: Record<string, number> = {
  first_hour: 19,
  third_hour: 12,
  sixth_hour: 12,
  ninth_hour: 12,
  eleventh_hour: 12,
  twelfth_hour: 12,
};

/**
 * The prayers of the Agpeya in the order of the praying day: the six hours
 * of the day, the Prayer of the Veil, and the Midnight hour in its three
 * watches, each kept on its own. The watches open at their own beginning;
 * the first opens at the top, with the introduction the hour starts with.
 */
export const CANON_AGPEYA_PRAYERS: readonly CanonAgpeyaPrayer[] = [
  ...AGPEYA_HOURS.filter((hour) => hour.id in DAY_HOUR_PSALMS).map((hour): CanonAgpeyaPrayer => ({
    id: hour.id,
    serviceId: hour.id,
    openAt: null,
    defaultTime: `${String(hour.from).padStart(2, '0')}:00`,
    psalms: DAY_HOUR_PSALMS[hour.id],
    name: hour.prayer,
    short: hour.traditional,
  })),
  {
    id: 'prayer_of_the_veil',
    serviceId: 'prayer_of_the_veil',
    openAt: null,
    // Prayed after the Twelfth Hour; its wheel starts at the Twelfth's time.
    defaultTime: '18:00',
    psalms: 29,
    name: { english: 'Prayer of the Veil', french: 'Prière du voile', arabic: 'صلاة الستار' },
    short: { english: 'Prayer of the Veil', french: 'Prière du voile', arabic: 'صلاة الستار' },
  },
  midnightWatch('midnight_first_watch', null, 9, { english: 'First Watch', french: 'Premier service', arabic: 'الخِدمةُ الأولى' }),
  midnightWatch('midnight_second_watch', 'introductionSecondWatch', 10, { english: 'Second Watch', french: 'Second service', arabic: 'الخِدمةُ الثانِيةُ' }),
  midnightWatch('midnight_third_watch', 'introductionThirdWatch', 12, { english: 'Third Watch', french: 'Troisième service', arabic: 'الخِدمةُ الثالِثةُ' }),
];

const PRAYERS_BY_ID = new Map(CANON_AGPEYA_PRAYERS.map((prayer) => [prayer.id, prayer]));
const PRAYER_ORDER = new Map(CANON_AGPEYA_PRAYERS.map((prayer, index) => [prayer.id, index]));

export function canonAgpeyaPrayer(id: string): CanonAgpeyaPrayer | null {
  return PRAYERS_BY_ID.get(id) ?? null;
}

/** The Midnight hour as a canon kept it before it was split: its three watches now. */
const LEGACY_MIDNIGHT_HOUR = 'midnight_hour';
const MIDNIGHT_WATCHES = ['midnight_first_watch', 'midnight_second_watch', 'midnight_third_watch'];

/** The psalms each prayer of the Agpeya prays: Prime nineteen, the Prayer of the Veil twenty-nine, the watches nine, ten and twelve. */
export const AGPEYA_PSALM_COUNTS: Record<string, number> = Object.fromEntries(CANON_AGPEYA_PRAYERS.map((prayer) => [prayer.id, prayer.psalms]));

export const GOAL_LIMITS: Record<Exclude<CanonGoalKind, 'none'>, { min: number; max: number; step: number; initial: number }> = {
  // Held to each prayer's own count (AGPEYA_PSALM_COUNTS); this is the most any has.
  psalms: { min: 1, max: 29, step: 1, initial: 3 },
  chapters: { min: 1, max: 150, step: 1, initial: 1 },
  // One at a time up to ten, then by fives (canonGoalStep).
  verses: { min: 1, max: 500, step: 5, initial: 10 },
  // One at a time, whatever the count; held, the stepper runs (CanonEditorParts, Stepper).
  metanias: { min: 1, max: 1000, step: 1, initial: 10 },
  minutes: { min: 5, max: 600, step: 5, initial: 15 },
  times: { min: 1, max: 1000, step: 1, initial: 10 },
};

/** The goals each kind of item may set. */
export const GOAL_KINDS: Record<CanonKind, readonly CanonGoalKind[]> = {
  agpeya: ['none', 'psalms', 'minutes'],
  bible: ['none', 'chapters', 'verses', 'minutes'],
  metania: ['none', 'metanias', 'minutes'],
  abstinence: ['none'],
  custom: ['none', 'minutes', 'times'],
};

/** How often each kind may be kept: metanias also on every day they are made, abstinence in the fasts alone. */
export const FREQUENCY_KINDS: Record<CanonKind, readonly CanonFrequencyKind[]> = {
  agpeya: ['daily', 'weekdays', 'perWeek'],
  bible: ['daily', 'weekdays', 'perWeek'],
  metania: ['applicable', 'fastingDays', 'daily', 'weekdays', 'perWeek'],
  abstinence: ['fasts'],
  custom: ['daily', 'weekdays', 'perWeek'],
};


// —— Days ————————————————————————————————————————————————————————————————

/** The device's local calendar day of a moment, as "YYYY-MM-DD". */
export function canonDayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function isCanonDayKey(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

/** The day `amount` days from `day`. */
export function addCanonDays(day: string, amount: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function canonWeekday(day: string): Weekday {
  return new Date(`${day}T00:00:00Z`).getUTCDay() as Weekday;
}

/** The Sunday that begins the week a day falls in. */
export function canonWeekStart(day: string): string {
  return addCanonDays(day, -canonWeekday(day));
}

/** The day's date as a date-only value (UTC midnight), for the date formatters in localeFormat. */
export function canonDayDate(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

// —— Times ———————————————————————————————————————————————————————————————

export function isCanonTime(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  return Boolean(match) && Number(match![1]) < 24 && Number(match![2]) < 60;
}

export function canonTime(hour: number, minute: number): string {
  const h = ((Math.round(hour) % 24) + 24) % 24;
  const m = ((Math.round(minute) % 60) + 60) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function parseCanonTime(time: string): { hour: number; minute: number } {
  const [hour, minute] = time.split(':').map(Number);
  return { hour, minute };
}

/** When each prayer of the Agpeya is prayed: its reminder's first suggestion. */
export function agpeyaHourDefaultTime(hourId: string): string {
  return canonAgpeyaPrayer(hourId)?.defaultTime ?? '06:00';
}

/**
 * Where a time falls in the praying day, in minutes. The day of prayer runs
 * from Prime: the small hours (before four) belong to the night before, so the
 * Midnight hour is the last of the day rather than the first.
 */
function prayingDayMinutes(time: string): number {
  const { hour, minute } = parseCanonTime(time);
  return (hour < 4 ? hour + 24 : hour) * 60 + minute;
}

// —— Making items ——————————————————————————————————————————————————————————

export function newCanonId(prefix = 'canon'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function newHourPlan(hourId: string): CanonHourPlan {
  return { hourId, goal: { kind: 'none' }, time: null, remind: false };
}

export function newCanonItem(kind: CanonKind, now = new Date()): CanonItem {
  const stamp = now.toISOString();
  const base = { id: newCanonId(), frequency: { kind: 'daily' } as CanonFrequency, createdAt: stamp, updatedAt: stamp };
  if (kind === 'agpeya') {
    return { ...base, kind, pattern: 'same', hours: [newHourPlan('first_hour')], days: WEEKDAYS.map(() => []) };
  }
  if (kind === 'bible') return { ...base, kind, goal: { kind: 'chapters', count: 1 }, time: null, remind: false };
  if (kind === 'metania') {
    return { ...base, kind, frequency: { kind: 'applicable' }, goal: { kind: 'metanias', count: GOAL_LIMITS.metanias.initial }, time: null, remind: false };
  }
  if (kind === 'abstinence') {
    // Every fast to start with; the believer leaves out the ones they don't keep.
    return { ...base, kind, frequency: { kind: 'fasts', fasts: [...ABSTINENCE_FAST_IDS] }, goal: { kind: 'none' }, time: ABSTINENCE_DEFAULT_UNTIL, remind: false };
  }
  return { ...base, kind, title: '', note: '', goal: { kind: 'none' }, time: null, remind: false };
}

/** Why an item can't be kept as it stands, or null when it can. */
export function canonItemProblem(item: CanonItem): 'title' | 'hours' | 'days' | 'fasts' | null {
  if (item.kind === 'custom' && !item.title.trim()) return 'title';
  if (item.kind === 'abstinence' && !item.frequency.fasts.length) return 'fasts';
  if (item.kind === 'agpeya') {
    if (item.pattern === 'same' && !item.hours.length) return 'hours';
    if (item.pattern === 'byDay' && !item.days.some((plans) => plans.length)) return 'hours';
  }
  const usesFrequency = item.kind !== 'agpeya' || item.pattern === 'same';
  if (usesFrequency && item.frequency.kind === 'weekdays' && !item.frequency.days.length) return 'days';
  return null;
}

/**
 * The next count a stepper moves to: verses go one at a time up to ten and
 * by fives after, so a single verse and fifty are both a few taps away.
 */
export function canonGoalStep(kind: Exclude<CanonGoalKind, 'none'>, value: number, up: boolean): number {
  const { min, max, step } = GOAL_LIMITS[kind];
  if (kind === 'verses') {
    if (up) return Math.min(max, value < 10 ? value + 1 : Math.floor(value / 5) * 5 + 5);
    return Math.max(min, value <= 10 ? value - 1 : Math.ceil(value / 5) * 5 - 5);
  }
  return Math.max(min, Math.min(max, value + (up ? step : -step)));
}

// —— Reading back what was stored ——————————————————————————————————————————

function cleanIso(value: unknown, fallback: string): string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : fallback;
}

function clampCount(value: unknown, min: number, max: number, fallback: number): number {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

export function normalizeCanonGoal(value: unknown, kind: CanonKind, hourId?: string): CanonGoal {
  if (!value || typeof value !== 'object') return { kind: 'none' };
  const goal = value as { kind?: unknown; count?: unknown; unit?: unknown };
  if (goal.kind === 'none' || !GOAL_KINDS[kind].includes(goal.kind as CanonGoalKind)) return { kind: 'none' };
  const goalKind = goal.kind as Exclude<CanonGoalKind, 'none'>;
  const limits = GOAL_LIMITS[goalKind];
  const max = goalKind === 'psalms' && hourId ? AGPEYA_PSALM_COUNTS[hourId] ?? limits.max : limits.max;
  const count = clampCount(goal.count, limits.min, max, Math.min(limits.initial, max));
  if (goalKind === 'times') {
    const unit = typeof goal.unit === 'string' ? goal.unit.trim().slice(0, MAX_UNIT_LENGTH) : '';
    return { kind: 'times', count, unit };
  }
  return { kind: goalKind, count } as CanonGoal;
}

/** The fasts chosen, each once, in the list's order. */
function normalizeAbstinenceFasts(value: unknown): AbstinenceFast[] {
  const chosen = Array.isArray(value) ? value : [];
  return ABSTINENCE_FAST_IDS.filter((fast) => chosen.includes(fast));
}

export function normalizeCanonFrequency(value: unknown, kind: CanonKind = 'custom'): CanonFrequency {
  // Abstinence is kept in the fasts, and nothing else.
  if (kind === 'abstinence') {
    const fasts = value && typeof value === 'object' && (value as { kind?: unknown }).kind === 'fasts' ? (value as { fasts?: unknown }).fasts : ABSTINENCE_FAST_IDS;
    return { kind: 'fasts', fasts: normalizeAbstinenceFasts(fasts) };
  }
  if (!value || typeof value !== 'object') return { kind: kind === 'metania' ? 'applicable' : 'daily' };
  const frequency = value as { kind?: unknown; days?: unknown; times?: unknown };
  if (frequency.kind === 'applicable' || frequency.kind === 'fastingDays') return kind === 'metania' ? { kind: frequency.kind } : { kind: 'daily' };
  if (frequency.kind === 'weekdays') {
    const days = Array.isArray(frequency.days)
      ? [...new Set(frequency.days.map(Number).filter((day): day is Weekday => Number.isInteger(day) && day >= 0 && day <= 6))].sort()
      : [];
    return { kind: 'weekdays', days };
  }
  if (frequency.kind === 'perWeek') return { kind: 'perWeek', times: clampCount(frequency.times, 1, 6, 3) };
  return { kind: 'daily' };
}

function normalizeHourPlans(value: unknown): CanonHourPlan[] {
  if (!Array.isArray(value)) return [];
  // The whole Midnight hour, from before it was split, is kept as its three
  // watches, each with the hour's time and reminder (and its measure, held
  // to what each watch has).
  const entries = value.flatMap((entry) => {
    const plan = entry as Partial<CanonHourPlan> | null;
    if (!plan || typeof plan !== 'object' || plan.hourId !== LEGACY_MIDNIGHT_HOUR) return [entry];
    return MIDNIGHT_WATCHES.map((hourId) => ({ ...plan, hourId }));
  });
  const seen = new Set<string>();
  const plans: CanonHourPlan[] = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue;
    const plan = entry as Partial<CanonHourPlan>;
    if (typeof plan.hourId !== 'string' || !PRAYERS_BY_ID.has(plan.hourId) || seen.has(plan.hourId)) continue;
    seen.add(plan.hourId);
    const time = isCanonTime(plan.time) ? plan.time : null;
    plans.push({ hourId: plan.hourId, goal: normalizeCanonGoal(plan.goal, 'agpeya', plan.hourId), time, remind: Boolean(plan.remind) && time != null });
  }
  return sortHourPlans(plans);
}

/** The prayers in the order they are prayed through the day. */
export function sortHourPlans(plans: CanonHourPlan[]): CanonHourPlan[] {
  return [...plans].sort((a, b) => (PRAYER_ORDER.get(a.hourId) ?? 0) - (PRAYER_ORDER.get(b.hourId) ?? 0));
}

export function normalizeCanonItem(value: unknown): CanonItem | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Partial<CanonItem> & Record<string, unknown>;
  if (typeof item.id !== 'string' || !item.id || item.id.length > 120) return null;
  if (item.kind !== 'agpeya' && item.kind !== 'bible' && item.kind !== 'metania' && item.kind !== 'abstinence' && item.kind !== 'custom') return null;
  const now = new Date().toISOString();
  const base = {
    id: item.id,
    frequency: normalizeCanonFrequency(item.frequency, item.kind),
    createdAt: cleanIso(item.createdAt, now),
    updatedAt: cleanIso(item.updatedAt, now),
  };
  if (item.kind === 'agpeya') {
    const days = Array.isArray(item.days) ? item.days : [];
    return {
      ...base,
      kind: 'agpeya',
      pattern: item.pattern === 'byDay' ? 'byDay' : 'same',
      hours: normalizeHourPlans(item.hours),
      days: WEEKDAYS.map((day) => normalizeHourPlans(days[day])),
    };
  }
  if (item.kind === 'abstinence') {
    const until = isCanonTime(item.time) ? item.time : ABSTINENCE_DEFAULT_UNTIL;
    const frequency = base.frequency as AbstinenceCanonItem['frequency'];
    return { ...base, kind: 'abstinence', frequency, goal: { kind: 'none' }, time: until, remind: Boolean(item.remind) };
  }
  const time = isCanonTime(item.time) ? item.time : null;
  const remind = Boolean(item.remind) && time != null;
  if (item.kind === 'bible') return { ...base, kind: 'bible', goal: normalizeCanonGoal(item.goal, 'bible'), time, remind };
  if (item.kind === 'metania') return { ...base, kind: 'metania', goal: normalizeCanonGoal(item.goal, 'metania'), time, remind };
  const title = typeof item.title === 'string' ? item.title.trim().slice(0, MAX_TITLE_LENGTH) : '';
  if (!title) return null;
  const note = typeof item.note === 'string' ? item.note.trim().slice(0, MAX_NOTE_LENGTH) : '';
  return { ...base, kind: 'custom', title, note, goal: normalizeCanonGoal(item.goal, 'custom'), time, remind };
}

function normalizeDeletions(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter((entry): entry is [string, string] => entry[0].length > 0 && entry[0].length <= 120 && typeof entry[1] === 'string' && !Number.isNaN(Date.parse(entry[1])))
      .sort((a, b) => Date.parse(b[1]) - Date.parse(a[1]))
      .slice(0, MAX_ITEM_DELETIONS),
  );
}

export function normalizeCanonDayMarks(value: unknown): CanonDayMarks {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const marks: CanonDayMarks = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!key || key.length > 200 || !entry || typeof entry !== 'object') continue;
    const mark = entry as Partial<CanonMark>;
    if (typeof mark.at !== 'string' || Number.isNaN(Date.parse(mark.at))) continue;
    marks[key] = mark.skipped === true && !mark.done ? { done: false, skipped: true, at: mark.at } : { done: Boolean(mark.done), at: mark.at };
    if (Object.keys(marks).length >= MAX_MARKS_PER_DAY) break;
  }
  return marks;
}

function normalizeDays(value: unknown): Record<string, CanonDayMarks> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const days: Record<string, CanonDayMarks> = {};
  for (const [day, marks] of Object.entries(value as Record<string, unknown>)) {
    if (!isCanonDayKey(day)) continue;
    const clean = normalizeCanonDayMarks(marks);
    if (Object.keys(clean).length) days[day] = clean;
  }
  return days;
}

export function emptyCanonDocument(): CanonDocument {
  return { version: 1, items: [], itemDeletions: {}, days: {}, updatedAt: new Date(0).toISOString() };
}

export function normalizeCanonDocument(value: unknown): CanonDocument {
  const fallback = emptyCanonDocument();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
  const document = value as Partial<CanonDocument>;
  const items = Array.isArray(document.items)
    ? document.items.map(normalizeCanonItem).filter((item): item is CanonItem => Boolean(item))
    : [];
  return {
    version: 1,
    items: sortCanonItems(dedupeItems(items)).slice(0, MAX_CANON_ITEMS),
    itemDeletions: normalizeDeletions(document.itemDeletions),
    days: normalizeDays(document.days),
    updatedAt: cleanIso(document.updatedAt, fallback.updatedAt),
  };
}

function dedupeItems(items: CanonItem[]): CanonItem[] {
  const byId = new Map<string, CanonItem>();
  for (const item of items) {
    const current = byId.get(item.id);
    if (!current || Date.parse(item.updatedAt) >= Date.parse(current.updatedAt)) byId.set(item.id, item);
  }
  return [...byId.values()];
}

/** Items in the order they were added. */
export function sortCanonItems(items: CanonItem[]): CanonItem[] {
  return [...items].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id));
}

/** The device keeps only the recent days' marks; older ones live on in the account. */
export function pruneCanonDays(days: Record<string, CanonDayMarks>, today: string, keep = CANON_DAYS_KEPT): Record<string, CanonDayMarks> {
  const oldest = addCanonDays(today, -keep);
  return Object.fromEntries(Object.entries(days).filter(([day]) => day >= oldest));
}

// —— Merging the device's copy with the account's —————————————————————————

/** Newest copy of each mark wins. */
export function mergeCanonDayMarks(a: CanonDayMarks = {}, b: CanonDayMarks = {}): CanonDayMarks {
  const merged: CanonDayMarks = { ...a };
  for (const [key, mark] of Object.entries(b)) {
    const current = merged[key];
    if (!current || Date.parse(mark.at) > Date.parse(current.at)) merged[key] = mark;
  }
  return merged;
}

/**
 * The device's copy and the account's, as one: the newest copy of each item
 * wins, and a removal wins over any copy older than it (the rules the Bible
 * highlights and the Sermon Planner's notes sync by); each day's marks merge
 * mark by mark, the newest winning.
 */
export function mergeCanonDocuments(local: CanonDocument, cloud: CanonDocument): CanonDocument {
  const itemDeletions: Record<string, string> = {};
  for (const deletions of [local.itemDeletions, cloud.itemDeletions]) {
    for (const [id, deletedAt] of Object.entries(deletions)) {
      const current = itemDeletions[id];
      if (!current || Date.parse(deletedAt) > Date.parse(current)) itemDeletions[id] = deletedAt;
    }
  }
  const items = dedupeItems([...local.items, ...cloud.items]).filter((item) => {
    const deletedAt = itemDeletions[item.id];
    return !deletedAt || Date.parse(item.updatedAt) > Date.parse(deletedAt);
  });
  const days: Record<string, CanonDayMarks> = {};
  for (const day of new Set([...Object.keys(local.days), ...Object.keys(cloud.days)])) {
    const marks = mergeCanonDayMarks(local.days[day], cloud.days[day]);
    if (Object.keys(marks).length) days[day] = marks;
  }
  return {
    version: 1,
    items: sortCanonItems(items).slice(0, MAX_CANON_ITEMS),
    itemDeletions: normalizeDeletions(itemDeletions),
    days,
    updatedAt: Date.parse(local.updatedAt) >= Date.parse(cloud.updatedAt) ? local.updatedAt : cloud.updatedAt,
  };
}

/** The items and removals alone, to compare two copies' canon without their marks. */
export function canonDefinitionSignature(document: Pick<CanonDocument, 'items' | 'itemDeletions'>): string {
  return JSON.stringify({ items: document.items, itemDeletions: document.itemDeletions });
}

/** The days whose marks differ between two copies. */
export function changedCanonDays(next: Record<string, CanonDayMarks>, previous: Record<string, CanonDayMarks>): string[] {
  return Object.keys(next).filter((day) => JSON.stringify(next[day]) !== JSON.stringify(previous[day] ?? {}));
}

// —— A day's tasks —————————————————————————————————————————————————————————

export interface CanonTask {
  /** The item's id, and for the Agpeya its hour: "canon-…:first_hour". */
  key: string;
  itemId: string;
  kind: CanonKind;
  hourId: string | null;
  /** The custom item's own name; the others are named by their kind and hour. */
  title: string | null;
  note: string | null;
  goal: CanonGoal;
  time: string | null;
  remind: boolean;
  /** How often the task is kept, as the item says (an Agpeya item that varies by day: on the days it has the hour). */
  frequency: CanonFrequency | { kind: 'byDay' };
  done: boolean;
  /** Taken off this day's list (canonSkippedTasksForDay lists them, to be restored). */
  skipped: boolean;
  /** For a task kept a number of times a week: how many this week so far, of how many. */
  weekly: { done: number; target: number } | null;
}

export function canonTaskKey(itemId: string, hourId?: string | null): string {
  return hourId ? `${itemId}:${hourId}` : itemId;
}

/**
 * The Agpeya in the canon through Pascha: Palm Sunday keeps only the First,
 * Third and Sixth Hours, and Holy Monday to Bright Saturday none at all. By
 * the day's flags: HolyWeek (Holy Monday to Bright Saturday) and PalmSunday.
 */
export const AGPEYA_NONE_CONDITION = 'HolyWeek';
export const AGPEYA_MORNING_ONLY_CONDITION = 'PalmSunday';
export type CanonAgpeyaDay = 'all' | 'beforeEve' | 'none';

/** A day as the calendar has it for the canon: metanias' two conditions against its flags, the Agpeya through Pascha, and the fasts it keeps abstinence in. */
export interface CanonCalendarDay {
  applicable: boolean;
  fasting: boolean;
  agpeya: CanonAgpeyaDay;
  /** The fasts this day is a day of abstinence in (ABSTINENCE_FASTS); none on a weekend or a feast. */
  fasts: AbstinenceFast[];
}

/** What the canon knows of the Church's calendar: each day, or null while its flags have still to be read. */
export interface CanonCalendar {
  calendarDay: (day: string) => CanonCalendarDay | null;
}

/** Whether an item is kept on days the calendar decides, and so needs it read. */
export function keptByCalendar(frequency: CanonFrequency): boolean {
  return frequency.kind === 'applicable' || frequency.kind === 'fastingDays' || frequency.kind === 'fasts';
}

/** Whether a canon needs the calendar read: metanias and abstinence kept by it, and any Agpeya (Pascha leaves it out). */
export function canonNeedsCalendar(items: readonly CanonItem[]): boolean {
  return items.some((item) => item.kind === 'agpeya' || keptByCalendar(item.frequency));
}

/** The only hours of the Agpeya kept on Palm Sunday. */
const PALM_SUNDAY_PRAYERS = new Set(['first_hour', 'third_hour', 'sixth_hour']);

/** Whether a prayer of the Agpeya is asked on a day, by the calendar; a day not yet read keeps them all. */
export function agpeyaPrayerKeptOn(hourId: string, day: string, calendar?: CanonCalendar): boolean {
  const agpeya = calendar?.calendarDay(day)?.agpeya ?? 'all';
  if (agpeya === 'none') return false;
  if (agpeya === 'beforeEve') return PALM_SUNDAY_PRAYERS.has(hourId);
  return true;
}

/** Until a day's flags are read: no metanias on a Saturday or a Sunday; a feast is not yet known. */
export function provisionalMetaniaDay(day: string): boolean {
  const weekday = canonWeekday(day);
  return weekday !== 0 && weekday !== 6;
}

function keptOn(frequency: CanonFrequency, day: string, calendar?: CanonCalendar): boolean {
  if (frequency.kind === 'weekdays') return frequency.days.includes(canonWeekday(day));
  if (frequency.kind === 'applicable') return calendar?.calendarDay(day)?.applicable ?? provisionalMetaniaDay(day);
  // A fasting day is the calendar's to say: none is assumed before it is read.
  if (frequency.kind === 'fastingDays') return calendar?.calendarDay(day)?.fasting ?? false;
  // So are the fasts: no day is one of abstinence before then.
  if (frequency.kind === 'fasts') {
    const fasts = calendar?.calendarDay(day)?.fasts ?? [];
    return frequency.fasts.some((fast) => fasts.includes(fast));
  }
  return true;
}

interface TaskTemplate {
  key: string;
  item: CanonItem;
  hourId: string | null;
  goal: CanonGoal;
  time: string | null;
  remind: boolean;
  frequency: CanonFrequency | { kind: 'byDay' };
}

/** What each item asks of a day, before anything is ticked off. */
function templatesFor(items: CanonItem[], day: string, calendar?: CanonCalendar): TaskTemplate[] {
  const weekday = canonWeekday(day);
  const templates: TaskTemplate[] = [];
  for (const item of items) {
    if (item.kind === 'agpeya') {
      const byDay = item.pattern === 'byDay';
      const plans = (byDay ? item.days[weekday] ?? [] : keptOn(item.frequency, day, calendar) ? item.hours : [])
        .filter((plan) => agpeyaPrayerKeptOn(plan.hourId, day, calendar));
      for (const plan of plans) {
        templates.push({
          key: canonTaskKey(item.id, plan.hourId),
          item,
          hourId: plan.hourId,
          goal: plan.goal,
          time: plan.time,
          remind: plan.remind,
          frequency: byDay ? { kind: 'byDay' } : item.frequency,
        });
      }
      continue;
    }
    if (!keptOn(item.frequency, day, calendar)) continue;
    templates.push({ key: canonTaskKey(item.id), item, hourId: null, goal: item.goal, time: item.time, remind: item.remind, frequency: item.frequency });
  }
  return templates;
}

function isDone(document: Pick<CanonDocument, 'days'>, day: string, key: string): boolean {
  return Boolean(document.days[day]?.[key]?.done);
}

/** How many days this week (Sunday to Saturday) a task was done. */
export function weeklyCompletions(document: Pick<CanonDocument, 'days'>, day: string, key: string): number {
  const start = canonWeekStart(day);
  let count = 0;
  for (let offset = 0; offset < 7; offset += 1) if (isDone(document, addCanonDays(start, offset), key)) count += 1;
  return count;
}

/**
 * Where a task sits in the day: by its time; a prayer of the Agpeya with
 * none, at its own time and in the Agpeya's order (the Prayer of the Veil
 * after the Twelfth Hour, the watches one after another); the rest after.
 */
function taskOrder(template: Pick<TaskTemplate, 'time' | 'hourId'>): number {
  if (template.time) return prayingDayMinutes(template.time);
  if (template.hourId) return prayingDayMinutes(agpeyaHourDefaultTime(template.hourId)) + 0.5 + (PRAYER_ORDER.get(template.hourId) ?? 0) / 100;
  return 48 * 60;
}

/**
 * The tasks a day asks for, in the order of the day. A task kept a number of
 * times a week is asked for on each day of the week until it has been done
 * that many times; on a day it was done, it stays, ticked. A task skipped
 * that day is left out (canonSkippedTasksForDay has it).
 */
export function canonTasksForDay(document: Pick<CanonDocument, 'items' | 'days'>, day: string, calendar?: CanonCalendar): CanonTask[] {
  return everyTaskForDay(document, day, calendar).filter((task) => !task.skipped);
}

/** The tasks skipped on a day, in the order of the day, to be restored. */
export function canonSkippedTasksForDay(document: Pick<CanonDocument, 'items' | 'days'>, day: string, calendar?: CanonCalendar): CanonTask[] {
  return everyTaskForDay(document, day, calendar).filter((task) => task.skipped);
}

function everyTaskForDay(document: Pick<CanonDocument, 'items' | 'days'>, day: string, calendar?: CanonCalendar): CanonTask[] {
  const templates = templatesFor(document.items, day, calendar);
  const tasks: CanonTask[] = [];
  for (const template of templates) {
    const done = isDone(document, day, template.key);
    const skipped = !done && Boolean(document.days[day]?.[template.key]?.skipped);
    let weekly: CanonTask['weekly'] = null;
    if (template.frequency.kind === 'perWeek') {
      const total = weeklyCompletions(document, day, template.key);
      const target = template.frequency.times;
      if (!done && !skipped && total >= target) continue;
      weekly = { done: total, target };
    }
    tasks.push({
      key: template.key,
      itemId: template.item.id,
      kind: template.item.kind,
      hourId: template.hourId,
      title: template.item.kind === 'custom' ? template.item.title : null,
      note: template.item.kind === 'custom' && template.item.note ? template.item.note : null,
      goal: template.goal,
      time: template.time,
      remind: template.remind,
      frequency: template.frequency,
      done,
      skipped,
      weekly,
    });
  }
  return tasks.sort((a, b) => taskOrder(a) - taskOrder(b));
}

export function canonDayProgress(tasks: readonly CanonTask[]): { done: number; total: number } {
  return { done: tasks.filter((task) => task.done).length, total: tasks.length };
}

/** A day's marks with one task ticked or unticked (either way, no longer skipped). */
export function withCanonMark(document: CanonDocument, day: string, key: string, done: boolean, now = new Date()): CanonDocument {
  const marks = { ...(document.days[day] ?? {}), [key]: { done, at: now.toISOString() } };
  return { ...document, days: { ...document.days, [day]: marks }, updatedAt: now.toISOString() };
}

/** A day's marks with one task skipped, or put back on the day's list. */
export function withCanonSkip(document: CanonDocument, day: string, key: string, skipped: boolean, now = new Date()): CanonDocument {
  const mark: CanonMark = skipped ? { done: false, skipped: true, at: now.toISOString() } : { done: false, at: now.toISOString() };
  const marks = { ...(document.days[day] ?? {}), [key]: mark };
  return { ...document, days: { ...document.days, [day]: marks }, updatedAt: now.toISOString() };
}

/** The document with an item added or replaced (stamped now). */
export function withCanonItem(document: CanonDocument, item: CanonItem, now = new Date()): CanonDocument {
  const stamped = { ...item, updatedAt: now.toISOString() } as CanonItem;
  const exists = document.items.some((candidate) => candidate.id === item.id);
  if (!exists && document.items.length >= MAX_CANON_ITEMS) return document;
  const items = exists ? document.items.map((candidate) => (candidate.id === item.id ? stamped : candidate)) : [...document.items, stamped];
  const itemDeletions = { ...document.itemDeletions };
  delete itemDeletions[item.id];
  return { ...document, items: sortCanonItems(items), itemDeletions, updatedAt: now.toISOString() };
}

export function withoutCanonItem(document: CanonDocument, id: string, now = new Date()): CanonDocument {
  return {
    ...document,
    items: document.items.filter((item) => item.id !== id),
    itemDeletions: normalizeDeletions({ ...document.itemDeletions, [id]: now.toISOString() }),
    updatedAt: now.toISOString(),
  };
}

// —— Reminders ———————————————————————————————————————————————————————————

export interface CanonReminderOccurrence {
  /** Stable for the task and day, so rescheduling replaces rather than repeats. */
  identifier: string;
  task: CanonTask;
  day: string;
  /** When, in the device's own time. */
  at: Date;
}

/** iOS holds 64 pending notifications for an app; the canon leaves room for others. */
export const MAX_SCHEDULED_REMINDERS = 48;
export const REMINDER_HORIZON_DAYS = 14;

/** The local moment a day's "HH:MM" falls on. */
export function canonMoment(day: string, time: string): Date {
  const [year, month, date] = day.split('-').map(Number);
  const { hour, minute } = parseCanonTime(time);
  return new Date(year, month - 1, date, hour, minute, 0, 0);
}

/**
 * The reminders still to come, soonest first: each task with a reminder, on
 * each day it is asked for over the next fortnight, unless it is already done
 * or its time has passed. A task kept a number of times a week is asked for
 * only until the week's count is met.
 */
export function upcomingCanonReminders(
  document: Pick<CanonDocument, 'items' | 'days'>,
  now: Date,
  options: { horizonDays?: number; limit?: number; calendar?: CanonCalendar } = {},
): CanonReminderOccurrence[] {
  const horizon = options.horizonDays ?? REMINDER_HORIZON_DAYS;
  const limit = options.limit ?? MAX_SCHEDULED_REMINDERS;
  const today = canonDayKey(now);
  const occurrences: CanonReminderOccurrence[] = [];
  for (let offset = 0; offset < horizon; offset += 1) {
    const day = addCanonDays(today, offset);
    for (const task of canonTasksForDay(document, day, options.calendar)) {
      if (!task.remind || !task.time || task.done) continue;
      const at = canonMoment(day, task.time);
      if (at.getTime() <= now.getTime()) continue;
      occurrences.push({ identifier: `canon-${day}-${task.key}`.replace(/[^A-Za-z0-9_]/g, '_'), task, day, at });
    }
  }
  return occurrences.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, limit);
}

/** Whether any item asks for a reminder — the moment to ask for permission. */
export function canonHasReminders(items: readonly CanonItem[]): boolean {
  return items.some((item) => {
    if (item.kind !== 'agpeya') return item.remind;
    return [...item.hours, ...item.days.flat()].some((plan) => plan.remind);
  });
}

/** Where a task's prayer or reading opens: its prayer of the Agpeya (a watch at its own beginning), the Bible, or the canon itself. */
export function canonTaskRoute(task: Pick<CanonTask, 'kind' | 'hourId'>): string {
  const prayer = task.kind === 'agpeya' && task.hourId ? canonAgpeyaPrayer(task.hourId) : null;
  if (prayer) return prayer.openAt ? `/agpeya/${prayer.serviceId}?at=${prayer.openAt}` : `/agpeya/${prayer.serviceId}`;
  if (task.kind === 'bible') return '/bible';
  return '/canon';
}
