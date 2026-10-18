import { AGPEYA_HOURS } from './agpeyaHours';

/**
 * A spiritual canon: the rule of prayer a believer keeps, set down as items
 * and checked off a day at a time. Kept pure so its rules can be read and
 * tested on their own; the provider (context/SpiritualCanonContext.tsx)
 * keeps the document on the device and the account, and schedules the
 * reminders from it.
 *
 * - An item is the Agpeya (some of its hours), the Bible, or anything else
 *   the believer names (a custom item).
 * - Each is kept every day, on chosen days of the week, or a number of times
 *   a week. The Agpeya can instead keep different hours on each day.
 * - Each can ask for a measure: a number of psalms (the Agpeya), of chapters
 *   (the Bible), of minutes, or of the believer's own unit ("50 metanias").
 * - Each task can have a time of day, and a reminder then.
 *
 * A day's tasks are the items due that day; an Agpeya item is one task per
 * hour. Ticking one off is a mark on that day.
 */

export type CanonKind = 'agpeya' | 'bible' | 'custom';
/** 0 is Sunday, as `Date.getUTCDay` counts. The week starts on Sunday. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export const WEEKDAYS: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6];

export type CanonGoal =
  | { kind: 'none' }
  | { kind: 'psalms'; count: number }
  | { kind: 'chapters'; count: number }
  | { kind: 'minutes'; count: number }
  | { kind: 'times'; count: number; unit: string };
export type CanonGoalKind = CanonGoal['kind'];

export type CanonFrequency =
  | { kind: 'daily' }
  | { kind: 'weekdays'; days: Weekday[] }
  | { kind: 'perWeek'; times: number };

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

export interface CustomCanonItem extends CanonItemBase {
  kind: 'custom';
  title: string;
  note: string;
  goal: CanonGoal;
  time: string | null;
  remind: boolean;
}

export type CanonItem = AgpeyaCanonItem | BibleCanonItem | CustomCanonItem;

/** A task ticked off (or unticked, which is kept so the account's older tick doesn't come back). */
export interface CanonMark {
  done: boolean;
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

/** The psalms each hour of the Agpeya prays: Prime nineteen, the Midnight hour's three watches thirty-one. */
export const AGPEYA_PSALM_COUNTS: Record<string, number> = {
  first_hour: 19,
  third_hour: 12,
  sixth_hour: 12,
  ninth_hour: 12,
  eleventh_hour: 12,
  twelfth_hour: 12,
  midnight_hour: 31,
};

export const GOAL_LIMITS: Record<Exclude<CanonGoalKind, 'none'>, { min: number; max: number; step: number; initial: number }> = {
  psalms: { min: 1, max: 31, step: 1, initial: 3 },
  chapters: { min: 1, max: 150, step: 1, initial: 1 },
  minutes: { min: 5, max: 600, step: 5, initial: 15 },
  times: { min: 1, max: 1000, step: 1, initial: 10 },
};

/** The goals each kind of item may set. */
export const GOAL_KINDS: Record<CanonKind, readonly CanonGoalKind[]> = {
  agpeya: ['none', 'psalms', 'minutes'],
  bible: ['none', 'chapters', 'minutes'],
  custom: ['none', 'minutes', 'times'],
};

const HOUR_IDS = new Set(AGPEYA_HOURS.map((hour) => hour.id));
const HOUR_ORDER = new Map(AGPEYA_HOURS.map((hour, index) => [hour.id, index]));

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

/** When each hour of the Agpeya is prayed: its reminder's first suggestion. */
export function agpeyaHourDefaultTime(hourId: string): string {
  const hour = AGPEYA_HOURS.find((candidate) => candidate.id === hourId);
  return canonTime(hour?.from ?? 6, 0);
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
  return { ...base, kind, title: '', note: '', goal: { kind: 'none' }, time: null, remind: false };
}

/** Why an item can't be kept as it stands, or null when it can. */
export function canonItemProblem(item: CanonItem): 'title' | 'hours' | 'days' | null {
  if (item.kind === 'custom' && !item.title.trim()) return 'title';
  if (item.kind === 'agpeya') {
    if (item.pattern === 'same' && !item.hours.length) return 'hours';
    if (item.pattern === 'byDay' && !item.days.some((plans) => plans.length)) return 'hours';
  }
  const usesFrequency = item.kind !== 'agpeya' || item.pattern === 'same';
  if (usesFrequency && item.frequency.kind === 'weekdays' && !item.frequency.days.length) return 'days';
  return null;
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

export function normalizeCanonFrequency(value: unknown): CanonFrequency {
  if (!value || typeof value !== 'object') return { kind: 'daily' };
  const frequency = value as { kind?: unknown; days?: unknown; times?: unknown };
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
  const seen = new Set<string>();
  const plans: CanonHourPlan[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const plan = entry as Partial<CanonHourPlan>;
    if (typeof plan.hourId !== 'string' || !HOUR_IDS.has(plan.hourId) || seen.has(plan.hourId)) continue;
    seen.add(plan.hourId);
    const time = isCanonTime(plan.time) ? plan.time : null;
    plans.push({ hourId: plan.hourId, goal: normalizeCanonGoal(plan.goal, 'agpeya', plan.hourId), time, remind: Boolean(plan.remind) && time != null });
  }
  return sortHourPlans(plans);
}

/** The hours in the order they are prayed through the day. */
export function sortHourPlans(plans: CanonHourPlan[]): CanonHourPlan[] {
  return [...plans].sort((a, b) => (HOUR_ORDER.get(a.hourId) ?? 0) - (HOUR_ORDER.get(b.hourId) ?? 0));
}

export function normalizeCanonItem(value: unknown): CanonItem | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Partial<CanonItem> & Record<string, unknown>;
  if (typeof item.id !== 'string' || !item.id || item.id.length > 120) return null;
  if (item.kind !== 'agpeya' && item.kind !== 'bible' && item.kind !== 'custom') return null;
  const now = new Date().toISOString();
  const base = {
    id: item.id,
    frequency: normalizeCanonFrequency(item.frequency),
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
  const time = isCanonTime(item.time) ? item.time : null;
  const remind = Boolean(item.remind) && time != null;
  if (item.kind === 'bible') return { ...base, kind: 'bible', goal: normalizeCanonGoal(item.goal, 'bible'), time, remind };
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
    marks[key] = { done: Boolean(mark.done), at: mark.at };
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
  /** For a task kept a number of times a week: how many this week so far, of how many. */
  weekly: { done: number; target: number } | null;
}

export function canonTaskKey(itemId: string, hourId?: string | null): string {
  return hourId ? `${itemId}:${hourId}` : itemId;
}

function keptOn(frequency: CanonFrequency, weekday: Weekday): boolean {
  if (frequency.kind === 'weekdays') return frequency.days.includes(weekday);
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

/** What each item asks of a day of the week, before anything is ticked off. */
function templatesFor(items: CanonItem[], weekday: Weekday): TaskTemplate[] {
  const templates: TaskTemplate[] = [];
  for (const item of items) {
    if (item.kind === 'agpeya') {
      const byDay = item.pattern === 'byDay';
      const plans = byDay ? item.days[weekday] ?? [] : keptOn(item.frequency, weekday) ? item.hours : [];
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
    if (!keptOn(item.frequency, weekday)) continue;
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

/** Where a task sits in the day: by its time; an Agpeya hour with none, at its own hour; the rest after. */
function taskOrder(template: Pick<TaskTemplate, 'time' | 'hourId'>): number {
  if (template.time) return prayingDayMinutes(template.time);
  if (template.hourId) return prayingDayMinutes(agpeyaHourDefaultTime(template.hourId)) + 0.5;
  return 48 * 60;
}

/**
 * The tasks a day asks for, in the order of the day. A task kept a number of
 * times a week is asked for on each day of the week until it has been done
 * that many times; on a day it was done, it stays, ticked.
 */
export function canonTasksForDay(document: Pick<CanonDocument, 'items' | 'days'>, day: string): CanonTask[] {
  const templates = templatesFor(document.items, canonWeekday(day));
  const tasks: CanonTask[] = [];
  for (const template of templates) {
    const done = isDone(document, day, template.key);
    let weekly: CanonTask['weekly'] = null;
    if (template.frequency.kind === 'perWeek') {
      const total = weeklyCompletions(document, day, template.key);
      const target = template.frequency.times;
      if (!done && total >= target) continue;
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
      weekly,
    });
  }
  return tasks.sort((a, b) => taskOrder(a) - taskOrder(b));
}

export function canonDayProgress(tasks: readonly CanonTask[]): { done: number; total: number } {
  return { done: tasks.filter((task) => task.done).length, total: tasks.length };
}

/** A day's marks with one task ticked or unticked. */
export function withCanonMark(document: CanonDocument, day: string, key: string, done: boolean, now = new Date()): CanonDocument {
  const marks = { ...(document.days[day] ?? {}), [key]: { done, at: now.toISOString() } };
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
  options: { horizonDays?: number; limit?: number } = {},
): CanonReminderOccurrence[] {
  const horizon = options.horizonDays ?? REMINDER_HORIZON_DAYS;
  const limit = options.limit ?? MAX_SCHEDULED_REMINDERS;
  const today = canonDayKey(now);
  const occurrences: CanonReminderOccurrence[] = [];
  for (let offset = 0; offset < horizon; offset += 1) {
    const day = addCanonDays(today, offset);
    for (const task of canonTasksForDay(document, day)) {
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

/** Where a task's prayer or reading opens: its hour of the Agpeya, the Bible, or the canon itself. */
export function canonTaskRoute(task: Pick<CanonTask, 'kind' | 'hourId'>): string {
  if (task.kind === 'agpeya' && task.hourId) return `/agpeya/${task.hourId}`;
  if (task.kind === 'bible') return '/bible';
  return '/canon';
}
