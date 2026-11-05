import { api } from '@/utils/api';
import type { SermonPlan, SermonPlanSummary } from '@/types/sermonPlanner';
import { moveLegacyStorageKey } from '@/utils/legacyNames';
import {
  encodeSermonPlanNotes,
  isLegacySermonPlanId,
  LEGACY_SERMON_DOCUMENT_KEY,
  normalizeSermonPlan,
  sermonPlanFromRow,
  summarizeSermonPlan,
  type SermonPlanRow,
} from '@/utils/sermonPlanner';

/**
 * Where plans are kept: on this device (localStorage, which the app installs
 * on a phone too -- utils/api.ts), and for a signed-in reader in the account's
 * sermon_plans, one row per plan (see SermonPlan for the keys).
 *
 * This device keeps each plan under `cv.sermon-plans.v2:<id>`, and the list
 * of them -- what the Plans page shows without reading every plan -- under
 * `cv.sermon-plans.v2.index`. A day's one plan from before there could be
 * several was kept under `cv.sermon-plans.v1:<document key>:<date>`; it is
 * read from there until it is saved again.
 */
const PLAN_PREFIX = 'cv.sermon-plans.v2:';
const INDEX_KEY = 'cv.sermon-plans.v2.index';
/** Plans removed on this device, kept so the account's copy goes too, even one removed offline. */
const REMOVED_KEY = 'cv.sermon-plans.v2.removed';
/** Plans the account has had: one of these missing from it was removed on another device. */
const SYNCED_KEY = 'cv.sermon-plans.v2.synced';
const V1_PREFIX = 'cv.sermon-plans.v1';
// Before the app's rename (utils/legacyNames.ts).
const LEGACY_V1_PREFIX = 'chc.sermon-plans.v1';

const ROW_COLUMNS = 'document_key, service_date, general_notes, highlights, highlight_deletions, updated_at';

function storage(): Storage | null {
  return typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = storage()?.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    storage()?.setItem(key, JSON.stringify(value));
  } catch {
    // A full or unavailable store keeps what it had.
  }
}

function v1Key(serviceDate: string) {
  const key = `${V1_PREFIX}:${encodeURIComponent(LEGACY_SERMON_DOCUMENT_KEY)}:${serviceDate}`;
  moveLegacyStorageKey(`${LEGACY_V1_PREFIX}:${encodeURIComponent(LEGACY_SERMON_DOCUMENT_KEY)}:${serviceDate}`, key);
  return key;
}

// ─── Watching for changes ───────────────────────────────────────────────────

type Listener = () => void;
const listeners = new Set<Listener>();

/** Called whenever a plan on this device is saved or removed, so the Plans list beside a plan follows it. */
export function subscribeSermonPlans(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function notify() {
  listeners.forEach((listener) => listener());
}

// ─── This device ────────────────────────────────────────────────────────────

function readIndex(): Record<string, SermonPlanSummary> {
  const index = readJson<Record<string, SermonPlanSummary>>(INDEX_KEY, {});
  return index && typeof index === 'object' && !Array.isArray(index) ? index : {};
}

function readRemoved(): Record<string, string> {
  const removed = readJson<Record<string, string>>(REMOVED_KEY, {});
  return removed && typeof removed === 'object' && !Array.isArray(removed) ? removed : {};
}

/**
 * The days an earlier build kept a plan for on this device. Each is listed
 * once, until it is saved in this build's own way.
 */
function v1PlanDates(): string[] {
  const store = storage();
  if (!store) return [];
  const prefix = `${V1_PREFIX}:${encodeURIComponent(LEGACY_SERMON_DOCUMENT_KEY)}:`;
  const dates: string[] = [];
  try {
    for (let index = 0; index < store.length; index += 1) {
      const key = store.key(index);
      if (key?.startsWith(prefix)) dates.push(key.slice(prefix.length));
    }
  } catch {
    // A store that can't be listed has none to offer.
  }
  return dates.filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date));
}

/** Every plan on this device, as the list shows them. */
export function loadLocalSermonPlanSummaries(): SermonPlanSummary[] {
  const index = readIndex();
  const removed = readRemoved();
  for (const date of v1PlanDates()) {
    const id = `day-${date}`;
    if (index[id] || removed[id]) continue;
    const plan = loadLocalSermonPlanSync(id, date);
    if (plan) index[id] = summarizeSermonPlan(plan);
  }
  return Object.values(index).filter((summary) => !removed[summary.id]);
}

function loadLocalSermonPlanSync(planId: string, serviceDate: string): SermonPlan | null {
  const stored = readJson<unknown>(`${PLAN_PREFIX}${planId}`, null);
  if (stored) return normalizeSermonPlan(stored, planId, serviceDate);
  if (!isLegacySermonPlanId(planId)) return null;
  const v1 = readJson<unknown>(v1Key(serviceDate), null);
  return v1 ? normalizeSermonPlan(v1, planId, serviceDate) : null;
}

/** The plan as this device has it; null for one it has never kept. */
export async function loadLocalSermonPlan(planId: string, serviceDate: string): Promise<SermonPlan | null> {
  return loadLocalSermonPlanSync(planId, serviceDate);
}

export async function saveLocalSermonPlan(plan: SermonPlan): Promise<void> {
  writeJson(`${PLAN_PREFIX}${plan.id}`, plan);
  const index = readIndex();
  index[plan.id] = summarizeSermonPlan(plan);
  writeJson(INDEX_KEY, index);
  const removed = readRemoved();
  if (removed[plan.id]) {
    delete removed[plan.id];
    writeJson(REMOVED_KEY, removed);
  }
  notify();
}

function readSynced(): Record<string, true> {
  const synced = readJson<Record<string, true>>(SYNCED_KEY, {});
  return synced && typeof synced === 'object' && !Array.isArray(synced) ? synced : {};
}

/** Whether the account has had this plan (so its absence there is a removal, not a plan still to send). */
export function wasSermonPlanSynced(planId: string): boolean {
  return Boolean(readSynced()[planId]);
}

export function markSermonPlanSynced(planId: string) {
  const synced = readSynced();
  if (synced[planId]) return;
  synced[planId] = true;
  writeJson(SYNCED_KEY, synced);
}

function forgetLocally(plan: Pick<SermonPlan, 'id' | 'serviceDate'>) {
  try {
    storage()?.removeItem(`${PLAN_PREFIX}${plan.id}`);
    if (isLegacySermonPlanId(plan.id)) storage()?.removeItem(v1Key(plan.serviceDate));
  } catch {
    // Nothing more to do for a store that can't be written.
  }
  const index = readIndex();
  delete index[plan.id];
  writeJson(INDEX_KEY, index);
  const synced = readSynced();
  if (synced[plan.id]) {
    delete synced[plan.id];
    writeJson(SYNCED_KEY, synced);
  }
}

/** Removes the plan from this device, remembering the removal until the account has it too. */
export async function removeLocalSermonPlan(plan: Pick<SermonPlan, 'id' | 'serviceDate'>): Promise<void> {
  forgetLocally(plan);
  const removed = readRemoved();
  removed[plan.id] = new Date().toISOString();
  writeJson(REMOVED_KEY, removed);
  notify();
}

/** The removals the account doesn't have yet. */
export function pendingSermonPlanRemovals(): Record<string, string> {
  return readRemoved();
}

/** The account no longer has the plan, or never had it: there's nothing left to remove. */
export function settleSermonPlanRemoval(planId: string) {
  const removed = readRemoved();
  delete removed[planId];
  writeJson(REMOVED_KEY, removed);
}

// ─── The account ────────────────────────────────────────────────────────────

/** Every plan in the account. */
export async function listCloudSermonPlans(): Promise<SermonPlan[]> {
  const { data, error } = await api
    .from('sermon_plans')
    .select(ROW_COLUMNS)
    .order('service_date', { ascending: true });
  if (error) throw new Error(error.message || 'Unable to load sermon plans.');
  return ((data ?? []) as SermonPlanRow[])
    .map(sermonPlanFromRow)
    .filter((plan): plan is SermonPlan => Boolean(plan));
}

export async function loadCloudSermonPlan(planId: string, documentKey: string, serviceDate: string): Promise<SermonPlan | null> {
  const { data, error } = await api
    .from('sermon_plans')
    .select(ROW_COLUMNS)
    .eq('document_key', documentKey)
    .eq('service_date', serviceDate)
    .maybeSingle();
  if (error) throw new Error(error.message || 'Unable to load sermon plan.');
  if (!data) return null;
  const plan = sermonPlanFromRow(data as SermonPlanRow);
  return plan && plan.id === planId ? plan : null;
}

export async function saveCloudSermonPlan(userId: string, plan: SermonPlan): Promise<void> {
  const { error } = await api.from('sermon_plans').upsert({
    user_id: userId,
    document_key: plan.documentKey,
    service_date: plan.serviceDate,
    general_notes: encodeSermonPlanNotes(plan),
    highlights: plan.highlights,
    highlight_deletions: plan.highlightDeletions,
    updated_at: plan.updatedAt,
  }, { onConflict: 'user_id,document_key,service_date' });
  if (error) throw new Error(error.message || 'Unable to save sermon plan.');
  markSermonPlanSynced(plan.id);
}

export async function deleteCloudSermonPlan(plan: Pick<SermonPlan, 'id' | 'documentKey' | 'serviceDate'>): Promise<void> {
  const { error } = await api
    .from('sermon_plans')
    .delete()
    .eq('document_key', plan.documentKey)
    .eq('service_date', plan.serviceDate);
  if (error) throw new Error(error.message || 'Unable to remove sermon plan.');
  settleSermonPlanRemoval(plan.id);
}

/** Drops a plan the account removed (on another device) from this one, with no removal of its own to send. */
export function forgetLocalSermonPlan(plan: Pick<SermonPlan, 'id' | 'serviceDate'>) {
  forgetLocally(plan);
  notify();
}
