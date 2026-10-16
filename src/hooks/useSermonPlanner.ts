import { useCallback, useEffect, useRef, useState } from 'react';

import {
  loadCloudSermonPlan,
  loadLocalSermonPlan,
  saveCloudSermonPlan,
  saveLocalSermonPlan,
} from '@/services/sermonPlannerService';
import type { SermonHighlight, SermonHighlightAnchor, SermonHighlightColor, SermonPlan } from '@/types/sermonPlanner';
import {
  applyHighlightCreation,
  applyHighlightGroupRemoval,
  applyHighlightGroupUpdate,
  highlightSegmentId,
  newHighlightGroupId,
  type HighlightCreation,
} from '@/utils/highlightGroups';
import { createSermonHighlight, emptySermonPlan, mergeSermonPlans } from '@/utils/sermonPlanner';

/** The plan's cap on stored segments (the sermon_plans table checks it). */
const MAX_SEGMENTS = 1000;

export type SermonPlanSyncStatus = 'local' | 'syncing' | 'synced' | 'error';

export function useSermonPlanner(
  documentKey: string,
  serviceDate: string,
  userId?: string | null,
  enabled = true,
) {
  const identity = `${documentKey}:${serviceDate}:${userId || 'local'}`;
  const [plan, setPlan] = useState<SermonPlan>(() => emptySermonPlan(documentKey, serviceDate));
  const [loadedIdentity, setLoadedIdentity] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SermonPlanSyncStatus>('local');
  const cloudSaveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const activeIdentityRef = useRef(identity);

  useEffect(() => {
    activeIdentityRef.current = identity;
    let cancelled = false;
    if (!enabled) {
      const timer = setTimeout(() => {
        if (cancelled) return;
        setPlan(emptySermonPlan(documentKey, serviceDate));
        setLoadedIdentity(identity);
        setSyncStatus('local');
      }, 0);
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }
    const load = async () => {
      const local = await loadLocalSermonPlan(documentKey, serviceDate);
      let next = local;
      if (userId) {
        if (!cancelled) setSyncStatus('syncing');
        try {
          const cloud = await loadCloudSermonPlan(documentKey, serviceDate);
          next = cloud ? mergeSermonPlans(local, cloud) : local;
          await saveLocalSermonPlan(next);
          if (!cloud || JSON.stringify(next) !== JSON.stringify(cloud)) {
            await saveCloudSermonPlan(userId, next);
          }
          if (!cancelled) setSyncStatus('synced');
        } catch (error) {
          console.warn('Unable to synchronize sermon notes:', error);
          if (!cancelled) setSyncStatus('error');
        }
      } else if (!cancelled) {
        setSyncStatus('local');
      }
      if (cancelled) return;
      setPlan(next);
      setLoadedIdentity(identity);
    };

    void load();
    return () => { cancelled = true; };
  }, [documentKey, enabled, identity, serviceDate, userId]);

  useEffect(() => {
    if (!enabled || loadedIdentity !== identity) return;
    void saveLocalSermonPlan(plan);
    if (!userId) return;

    const snapshot = plan;
    const timer = setTimeout(() => {
      setSyncStatus('syncing');
      cloudSaveQueueRef.current = cloudSaveQueueRef.current
        .catch(() => undefined)
        .then(() => saveCloudSermonPlan(userId, snapshot))
        .then(() => {
          if (activeIdentityRef.current === identity) setSyncStatus('synced');
        })
        .catch((error) => {
          console.warn('Unable to save sermon notes:', error);
          if (activeIdentityRef.current === identity) setSyncStatus('error');
        });
    }, 700);
    return () => clearTimeout(timer);
  }, [enabled, identity, loadedIdentity, plan, userId]);

  const updatePlan = useCallback((updater: (current: SermonPlan) => SermonPlan) => {
    setPlan((current) => {
      const updatedAt = new Date().toISOString();
      return { ...updater(current), updatedAt };
    });
  }, []);

  /**
   * One highlight made from a stroke or selection, a verse at a time, taking
   * the place of those it covers or touches. Returns the id the new group's
   * first segment gets (chosen here, before the plan updates). The plan
   * refuses a highlight that would pass its cap rather than dropping old ones.
   */
  const createHighlightGroup = useCallback((creation: HighlightCreation<SermonHighlightAnchor> & { color: SermonHighlightColor }) => {
    if (!creation.anchors.length) return null;
    const groupId = newHighlightGroupId('sermon');
    updatePlan((current) => {
      const change = applyHighlightCreation(
        current.highlights,
        current.highlightDeletions,
        creation,
        (anchor, details) => createSermonHighlight(anchor, creation.color, details),
        { prefix: 'sermon', groupId },
      );
      if (!change.lead || change.highlights.length > MAX_SEGMENTS) return current;
      return { ...current, highlights: change.highlights, highlightDeletions: change.deletions };
    });
    return highlightSegmentId(groupId, 0);
  }, [updatePlan]);

  const addHighlights = useCallback((highlights: SermonHighlight[]) => {
    if (!highlights.length) return;
    updatePlan((current) => {
      const highlightDeletions = { ...current.highlightDeletions };
      highlights.forEach((highlight) => delete highlightDeletions[highlight.id]);
      return {
        ...current,
        highlights: [...current.highlights, ...highlights].slice(0, 1000),
        highlightDeletions,
      };
    });
  }, [updatePlan]);

  // A colour, style or note given to any segment is the whole group's: the
  // reader sees one highlight. The note is kept on the group's first segment.
  const updateHighlight = useCallback((id: string, patch: { note?: string; color?: SermonHighlightColor; style?: 'underline' | null }) => {
    updatePlan((current) => ({
      ...current,
      highlights: applyHighlightGroupUpdate(current.highlights, id, patch),
    }));
  }, [updatePlan]);

  const deleteHighlight = useCallback((id: string) => {
    updatePlan((current) => {
      const change = applyHighlightGroupRemoval(current.highlights, current.highlightDeletions, id);
      return { ...current, highlights: change.highlights, highlightDeletions: change.deletions };
    });
  }, [updatePlan]);

  const setGeneralNotes = useCallback((generalNotes: string) => {
    updatePlan((current) => ({ ...current, generalNotes: generalNotes.slice(0, 100_000) }));
  }, [updatePlan]);

  const setHighlightColor = useCallback((id: string, color: SermonHighlightColor) => {
    updateHighlight(id, { color });
  }, [updateHighlight]);

  return {
    plan: loadedIdentity === identity ? plan : emptySermonPlan(documentKey, serviceDate),
    ready: loadedIdentity === identity,
    syncStatus,
    addHighlights,
    createHighlightGroup,
    updateHighlight,
    deleteHighlight,
    setGeneralNotes,
    setHighlightColor,
  };
}
