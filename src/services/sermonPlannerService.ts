import { api } from '@/utils/api';
import type { SermonPlan } from '@/types/sermonPlanner';
import { moveLegacyStorageKey } from '@/utils/legacyNames';
import { emptySermonPlan, normalizeSermonPlan } from '@/utils/sermonPlanner';

const LOCAL_STORAGE_PREFIX = 'cv.sermon-plans.v1';
// Before the app's rename (utils/legacyNames.ts).
const LEGACY_STORAGE_PREFIX = 'chc.sermon-plans.v1';

/** A plan's key, the first time it's asked for moved from where an earlier build kept it. */
function storageKey(documentKey: string, serviceDate: string) {
  const key = `${LOCAL_STORAGE_PREFIX}:${encodeURIComponent(documentKey)}:${serviceDate}`;
  moveLegacyStorageKey(`${LEGACY_STORAGE_PREFIX}:${encodeURIComponent(documentKey)}:${serviceDate}`, key);
  return key;
}

export async function loadLocalSermonPlan(documentKey: string, serviceDate: string): Promise<SermonPlan> {
  try {
    const raw = globalThis.localStorage?.getItem(storageKey(documentKey, serviceDate));
    return normalizeSermonPlan(raw ? JSON.parse(raw) : null, documentKey, serviceDate);
  } catch {
    return emptySermonPlan(documentKey, serviceDate);
  }
}

export async function saveLocalSermonPlan(plan: SermonPlan): Promise<void> {
  globalThis.localStorage?.setItem(storageKey(plan.documentKey, plan.serviceDate), JSON.stringify(plan));
}

export async function loadCloudSermonPlan(
  documentKey: string,
  serviceDate: string,
): Promise<SermonPlan | null> {
  const { data, error } = await api
    .from('sermon_plans')
    .select('document_key, service_date, general_notes, highlights, highlight_deletions, updated_at')
    .eq('document_key', documentKey)
    .eq('service_date', serviceDate)
    .maybeSingle();
  if (error) throw new Error(error.message || 'Unable to load sermon notes.');
  if (!data) return null;
  return normalizeSermonPlan({
    version: 1,
    documentKey: data.document_key,
    serviceDate: data.service_date,
    generalNotes: data.general_notes,
    highlights: data.highlights,
    highlightDeletions: data.highlight_deletions,
    updatedAt: data.updated_at,
  }, documentKey, serviceDate);
}

export async function saveCloudSermonPlan(userId: string, plan: SermonPlan): Promise<void> {
  const { error } = await api.from('sermon_plans').upsert({
    user_id: userId,
    document_key: plan.documentKey,
    service_date: plan.serviceDate,
    general_notes: plan.generalNotes,
    highlights: plan.highlights,
    highlight_deletions: plan.highlightDeletions,
    updated_at: plan.updatedAt,
  }, { onConflict: 'user_id,document_key,service_date' });
  if (error) throw new Error(error.message || 'Unable to save sermon notes.');
}
