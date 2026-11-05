import { useCallback, useEffect, useState } from 'react';

import {
  deleteCloudSermonPlan,
  forgetLocalSermonPlan,
  listCloudSermonPlans,
  loadLocalSermonPlan,
  loadLocalSermonPlanSummaries,
  markSermonPlanSynced,
  pendingSermonPlanRemovals,
  removeLocalSermonPlan,
  saveCloudSermonPlan,
  saveLocalSermonPlan,
  settleSermonPlanRemoval,
  subscribeSermonPlans,
  wasSermonPlanSynced,
} from '@/services/sermonPlannerService';
import type { SermonPlanSummary } from '@/types/sermonPlanner';
import { mergeSermonPlans } from '@/utils/sermonPlanner';
import type { SermonPlanSyncStatus } from './useSermonPlanner';

/** One sync with the account at a time, however many lists are open (the Plans page and the rail beside a plan). */
let running: Promise<void> | null = null;

/**
 * This device's plans and the account's made one: each plan the newer of its
 * copies, highlights merged; one made here offline sent; one removed here
 * removed there (unless the account's copy is newer); one the account no
 * longer has, though it had it, removed here.
 */
async function syncSermonPlans(userId: string): Promise<void> {
  const cloud = await listCloudSermonPlans();
  const removed = pendingSermonPlanRemovals();
  const inCloud = new Set<string>();
  for (const plan of cloud) {
    const removedAt = removed[plan.id];
    if (removedAt) {
      if (Date.parse(plan.updatedAt) <= Date.parse(removedAt)) {
        await deleteCloudSermonPlan(plan);
        continue;
      }
      // Written on another device since: it stays.
      settleSermonPlanRemoval(plan.id);
    }
    inCloud.add(plan.id);
    markSermonPlanSynced(plan.id);
    const local = await loadLocalSermonPlan(plan.id, plan.serviceDate);
    const merged = local ? mergeSermonPlans(local, plan) : plan;
    if (!local || JSON.stringify(merged) !== JSON.stringify(local)) await saveLocalSermonPlan(merged);
    if (JSON.stringify(merged) !== JSON.stringify(plan)) await saveCloudSermonPlan(userId, merged);
  }
  for (const id of Object.keys(removed)) {
    if (!inCloud.has(id) && !cloud.some((plan) => plan.id === id)) settleSermonPlanRemoval(id);
  }
  for (const summary of loadLocalSermonPlanSummaries()) {
    if (inCloud.has(summary.id)) continue;
    if (wasSermonPlanSynced(summary.id)) {
      forgetLocalSermonPlan(summary);
      continue;
    }
    const local = await loadLocalSermonPlan(summary.id, summary.serviceDate);
    if (local) await saveCloudSermonPlan(userId, local);
  }
}

/** Every plan, kept up to date as plans are saved, and synced with the account once signed in. */
export function useSermonPlans(userId?: string | null) {
  const [plans, setPlans] = useState<SermonPlanSummary[]>(() => loadLocalSermonPlanSummaries());
  const [syncStatus, setSyncStatus] = useState<SermonPlanSyncStatus>(userId ? 'syncing' : 'local');

  useEffect(() => subscribeSermonPlans(() => setPlans(loadLocalSermonPlanSummaries())), []);

  const runSync = useCallback(() => {
    if (!userId) return Promise.resolve();
    running = running ?? syncSermonPlans(userId).finally(() => { running = null; });
    return running.then(
      () => setSyncStatus('synced'),
      (error) => {
        console.warn('Unable to synchronize sermon plans:', error);
        setSyncStatus('error');
      },
    ).finally(() => setPlans(loadLocalSermonPlanSummaries()));
  }, [userId]);

  useEffect(() => {
    void runSync();
  }, [runSync]);

  const sync = useCallback(() => {
    setSyncStatus(userId ? 'syncing' : 'local');
    void runSync();
  }, [runSync, userId]);

  const removePlan = useCallback(async (summary: SermonPlanSummary) => {
    await removeLocalSermonPlan(summary);
    if (!userId) return;
    try {
      await deleteCloudSermonPlan(summary);
    } catch (error) {
      // Kept as a removal to send next time.
      console.warn('Unable to remove sermon plan:', error);
    }
  }, [userId]);

  return { plans, syncStatus, refresh: sync, removePlan };
}
