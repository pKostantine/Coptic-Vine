import { useCallback, useEffect, useRef, useState } from 'react';

import {
  loadCloudSermonPlan,
  loadLocalSermonPlan,
  saveCloudSermonPlan,
  saveLocalSermonPlan,
} from '@/services/sermonPlannerService';
import type {
  SermonHighlightAnchor,
  SermonHighlightColor,
  SermonPart,
  SermonPartKind,
  SermonPlan,
  SermonPlanStatus,
} from '@/types/sermonPlanner';
import {
  applyHighlightCreation,
  applyHighlightGroupRemoval,
  applyHighlightGroupUpdate,
  highlightGroupId,
  highlightSegmentId,
  newHighlightGroupId,
  type HighlightCreation,
} from '@/utils/highlightGroups';
import {
  createSermonHighlight,
  createSermonPart,
  emptySermonPlan,
  groupIdsOfSegments,
  mergeSermonPlans,
  partsWithReplacedHighlights,
} from '@/utils/sermonPlanner';

/** The plan's cap on stored segments. */
const MAX_SEGMENTS = 1000;
const NEVER = new Date(0).toISOString();

export type SermonPlanSyncStatus = 'local' | 'syncing' | 'synced' | 'error';

/** Whether anything has been done to the plan: a new one is only kept once it has. */
function isKept(plan: SermonPlan) {
  return plan.updatedAt !== NEVER;
}

/**
 * One plan: read from this device and the account and merged, then kept in
 * both as it is written (the account a moment after typing stops). A plan
 * new to both is only kept once something is done to it, under the name it
 * opened with (`defaultTitle`, the day's) unless it has been given one.
 */
export function useSermonPlan(
  planId: string,
  serviceDate: string,
  userId?: string | null,
  defaultTitle = '',
) {
  const identity = `${planId}:${serviceDate}:${userId || 'local'}`;
  const [plan, setPlan] = useState<SermonPlan>(() => emptySermonPlan(planId, serviceDate));
  const [loadedIdentity, setLoadedIdentity] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SermonPlanSyncStatus>('local');
  const cloudSaveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const activeIdentityRef = useRef(identity);
  const defaultTitleRef = useRef(defaultTitle);
  useEffect(() => {
    defaultTitleRef.current = defaultTitle;
  }, [defaultTitle]);

  useEffect(() => {
    activeIdentityRef.current = identity;
    let cancelled = false;
    const load = async () => {
      const local = await loadLocalSermonPlan(planId, serviceDate);
      let next = local ?? emptySermonPlan(planId, serviceDate);
      if (userId) {
        if (!cancelled) setSyncStatus('syncing');
        try {
          const cloud = await loadCloudSermonPlan(planId, next.documentKey, serviceDate);
          if (cloud) {
            next = local ? mergeSermonPlans(local, cloud) : cloud;
            await saveLocalSermonPlan(next);
            if (JSON.stringify(next) !== JSON.stringify(cloud)) await saveCloudSermonPlan(userId, next);
          } else if (local && isKept(local)) {
            await saveCloudSermonPlan(userId, local);
          }
          if (!cancelled) setSyncStatus('synced');
        } catch (error) {
          console.warn('Unable to synchronize sermon plan:', error);
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
  }, [identity, planId, serviceDate, userId]);

  useEffect(() => {
    if (loadedIdentity !== identity || !isKept(plan)) return;
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
          console.warn('Unable to save sermon plan:', error);
          if (activeIdentityRef.current === identity) setSyncStatus('error');
        });
    }, 700);
    return () => clearTimeout(timer);
  }, [identity, loadedIdentity, plan, userId]);

  const updatePlan = useCallback((updater: (current: SermonPlan) => SermonPlan) => {
    setPlan((current) => {
      const next = updater(current);
      if (next === current) return current;
      const now = new Date().toISOString();
      const first = !isKept(current);
      return {
        ...next,
        title: first && !next.title.trim() ? defaultTitleRef.current : next.title,
        createdAt: first ? now : next.createdAt,
        updatedAt: now,
      };
    });
  }, []);

  /**
   * One highlight made from a stroke or selection, a verse at a time, taking
   * the place of those it covers or touches -- and of their places in the
   * outline. `placeIn` puts it in a part as well. Returns the id the new
   * group's first segment gets. The plan refuses a highlight that would pass
   * its cap rather than dropping old ones.
   */
  const createHighlightGroup = useCallback((creation: HighlightCreation<SermonHighlightAnchor> & { color: SermonHighlightColor; placeIn?: string | null }) => {
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
      let parts = partsWithReplacedHighlights(current.parts, groupIdsOfSegments(current.highlights, creation.replaces ?? []), groupId);
      if (creation.placeIn) {
        parts = parts.map((part) => (part.id === creation.placeIn && !part.highlightIds.includes(groupId)
          ? { ...part, highlightIds: [...part.highlightIds, groupId] }
          : part));
      }
      return { ...current, highlights: change.highlights, highlightDeletions: change.deletions, parts };
    });
    return highlightSegmentId(groupId, 0);
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
      const target = current.highlights.find((highlight) => highlight.id === id);
      if (!target) return current;
      const groupId = highlightGroupId(target);
      const change = applyHighlightGroupRemoval(current.highlights, current.highlightDeletions, id);
      return {
        ...current,
        highlights: change.highlights,
        highlightDeletions: change.deletions,
        parts: current.parts.map((part) => (part.highlightIds.includes(groupId)
          ? { ...part, highlightIds: part.highlightIds.filter((entry) => entry !== groupId) }
          : part)),
      };
    });
  }, [updatePlan]);

  const setTitle = useCallback((title: string) => {
    updatePlan((current) => ({ ...current, title: title.slice(0, 200) }));
  }, [updatePlan]);

  const setStatus = useCallback((status: SermonPlanStatus) => {
    updatePlan((current) => (current.status === status ? current : { ...current, status }));
  }, [updatePlan]);

  const setBigIdea = useCallback((bigIdea: string) => {
    updatePlan((current) => ({ ...current, bigIdea: bigIdea.slice(0, 2_000) }));
  }, [updatePlan]);

  const updatePart = useCallback((partId: string, patch: Partial<Pick<SermonPart, 'title' | 'body'>>) => {
    updatePlan((current) => ({
      ...current,
      parts: current.parts.map((part) => (part.id === partId ? { ...part, ...patch } : part)),
    }));
  }, [updatePlan]);

  /** A new part, after the last of its kind (a Point after the last Point); returns its id. */
  const addPart = useCallback((kind: SermonPartKind) => {
    const part = createSermonPart(kind);
    updatePlan((current) => {
      const parts = [...current.parts];
      let at = -1;
      parts.forEach((existing, index) => { if (existing.kind === kind) at = index; });
      if (at < 0) {
        // Before the first part that comes after its kind in a sermon's order.
        const order = ['opening', 'point', 'application', 'closing'];
        at = parts.findIndex((existing) => order.indexOf(existing.kind) > order.indexOf(kind)) - 1;
        if (at < -1) at = parts.length - 1;
      }
      parts.splice(at + 1, 0, part);
      return { ...current, parts };
    });
    return part.id;
  }, [updatePlan]);

  const removePart = useCallback((partId: string) => {
    updatePlan((current) => ({ ...current, parts: current.parts.filter((part) => part.id !== partId) }));
  }, [updatePlan]);

  const movePart = useCallback((partId: string, toIndex: number) => {
    updatePlan((current) => {
      const from = current.parts.findIndex((part) => part.id === partId);
      const to = Math.max(0, Math.min(current.parts.length - 1, toIndex));
      if (from < 0 || from === to) return current;
      const parts = [...current.parts];
      const [part] = parts.splice(from, 1);
      parts.splice(to, 0, part);
      return { ...current, parts };
    });
  }, [updatePlan]);

  /** Puts a highlight in a part (taking it out of any other). */
  const placeHighlight = useCallback((groupId: string, partId: string) => {
    updatePlan((current) => ({
      ...current,
      parts: current.parts.map((part) => {
        const without = part.highlightIds.filter((entry) => entry !== groupId);
        return part.id === partId ? { ...part, highlightIds: [...without, groupId] } : { ...part, highlightIds: without };
      }),
    }));
  }, [updatePlan]);

  const unplaceHighlight = useCallback((groupId: string) => {
    updatePlan((current) => ({
      ...current,
      parts: current.parts.map((part) => (part.highlightIds.includes(groupId)
        ? { ...part, highlightIds: part.highlightIds.filter((entry) => entry !== groupId) }
        : part)),
    }));
  }, [updatePlan]);

  const markPreached = useCallback((seconds: number) => {
    updatePlan((current) => ({ ...current, status: 'preached', preachedSeconds: Math.max(1, Math.round(seconds)) }));
  }, [updatePlan]);

  const ready = loadedIdentity === identity;
  return {
    plan: ready ? plan : emptySermonPlan(planId, serviceDate),
    ready,
    kept: ready && isKept(plan),
    syncStatus,
    createHighlightGroup,
    updateHighlight,
    deleteHighlight,
    setTitle,
    setStatus,
    setBigIdea,
    updatePart,
    addPart,
    removePart,
    movePart,
    placeHighlight,
    unplaceHighlight,
    markPreached,
  };
}

export type SermonPlanController = ReturnType<typeof useSermonPlan>;
