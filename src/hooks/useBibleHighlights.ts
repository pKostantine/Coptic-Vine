import { useCallback, useEffect, useRef, useState } from 'react';

import {
  loadCloudBibleHighlights,
  loadLocalBibleHighlights,
  saveCloudBibleHighlights,
  saveLocalBibleHighlights,
} from '@/services/bibleHighlightsService';
import type { BibleHighlight, BibleHighlightAnchor, BibleHighlightBook, BibleHighlightColor } from '@/types/bibleHighlights';
import { createBibleHighlight, emptyBibleHighlightBook, mergeBibleHighlightBooks } from '@/utils/bibleHighlights';
import {
  applyHighlightCreation,
  applyHighlightGroupRemoval,
  applyHighlightGroupUpdate,
  type HighlightCreation,
} from '@/utils/highlightGroups';

/** A book's cap on stored segments (the bible_highlights table checks it). */
const MAX_SEGMENTS = 2000;

/**
 * One Bible book's highlights: kept on the device, and — when signed in —
 * merged with and saved back to the account's copy, the way the Sermon
 * Planner's notes sync (useSermonPlanner).
 */
export function useBibleHighlights(bookKey: string | undefined, userId?: string | null) {
  const identity = `${bookKey || ''}:${userId || 'local'}`;
  const [book, setBook] = useState<BibleHighlightBook>(() => emptyBibleHighlightBook(bookKey || ''));
  const [loadedIdentity, setLoadedIdentity] = useState<string | null>(null);
  const cloudSaveQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (!bookKey) return undefined;
    let cancelled = false;
    const load = async () => {
      const local = await loadLocalBibleHighlights(bookKey);
      let next = local;
      if (userId) {
        try {
          const cloud = await loadCloudBibleHighlights(bookKey);
          next = cloud ? mergeBibleHighlightBooks(local, cloud) : local;
          await saveLocalBibleHighlights(next);
          if (!cloud || JSON.stringify(next) !== JSON.stringify(cloud)) await saveCloudBibleHighlights(userId, next);
        } catch (error) {
          console.warn('Unable to synchronize Bible highlights:', error);
        }
      }
      if (cancelled) return;
      setBook(next);
      setLoadedIdentity(identity);
    };
    void load();
    return () => { cancelled = true; };
  }, [bookKey, identity, userId]);

  useEffect(() => {
    if (!bookKey || loadedIdentity !== identity) return undefined;
    void saveLocalBibleHighlights(book);
    if (!userId) return undefined;
    const snapshot = book;
    const timer = setTimeout(() => {
      cloudSaveQueueRef.current = cloudSaveQueueRef.current
        .catch(() => undefined)
        .then(() => saveCloudBibleHighlights(userId, snapshot))
        .catch((error) => console.warn('Unable to save Bible highlights:', error));
    }, 700);
    return () => clearTimeout(timer);
  }, [book, bookKey, identity, loadedIdentity, userId]);

  const update = useCallback((updater: (current: BibleHighlightBook) => BibleHighlightBook) => {
    setBook((current) => ({ ...updater(current), updatedAt: new Date().toISOString() }));
  }, []);

  /**
   * One highlight made from a stroke or selection, a verse at a time, taking
   * the place of those it covers or touches. Nothing is made when the book
   * would pass its cap: the new highlight is refused rather than old ones
   * dropped.
   */
  const createHighlightGroup = useCallback((creation: HighlightCreation<BibleHighlightAnchor> & { color: BibleHighlightColor }) => {
    update((current) => {
      const change = applyHighlightCreation(
        current.highlights,
        current.highlightDeletions,
        creation,
        (anchor, details) => createBibleHighlight(anchor, creation.color, details),
        { prefix: 'bible' },
      );
      if (!change.lead || change.highlights.length > MAX_SEGMENTS) return current;
      return { ...current, highlights: change.highlights, highlightDeletions: change.deletions };
    });
  }, [update]);

  const addHighlights = useCallback((highlights: BibleHighlight[]) => {
    if (!highlights.length) return;
    update((current) => {
      const highlightDeletions = { ...current.highlightDeletions };
      highlights.forEach((highlight) => delete highlightDeletions[highlight.id]);
      return { ...current, highlights: [...current.highlights, ...highlights], highlightDeletions };
    });
  }, [update]);

  // A colour or style given to any segment is the whole group's.
  const setHighlightColor = useCallback((id: string, color: BibleHighlightColor, style?: 'underline' | null) => {
    update((current) => ({
      ...current,
      highlights: applyHighlightGroupUpdate(current.highlights, id, style === undefined ? { color } : { color, style }),
    }));
  }, [update]);

  const deleteHighlight = useCallback((id: string) => {
    update((current) => {
      const change = applyHighlightGroupRemoval(current.highlights, current.highlightDeletions, id);
      return { ...current, highlights: change.highlights, highlightDeletions: change.deletions };
    });
  }, [update]);

  return {
    highlights: loadedIdentity === identity ? book.highlights : [],
    addHighlights,
    createHighlightGroup,
    setHighlightColor,
    deleteHighlight,
  };
}
