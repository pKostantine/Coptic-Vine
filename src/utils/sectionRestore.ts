/**
 * The sections a restore is allowed to land on, best first: the one the
 * reader was actually on, then every section before it in document order.
 *
 * A settings change rebuilds the whole document, and the setting that changed
 * can be exactly the one that was keeping the reader's own section visible —
 * hiding Silent Prayers while reading one, turning off the only language it
 * has text in, switching Bishop Present. Restoring to a section that no
 * longer exists silently does nothing, which dumps the reader back at the top
 * of the document. Walking this chain instead lands them on the nearest
 * surviving section *before* where they were, and only falls back to the top
 * when nothing before it survived either.
 *
 * Deliberately resolved against the raw section list rather than by
 * re-deriving what is currently visible: the renderers already do that
 * filtering (buildDocumentHtml, buildSlideshowSections), each in its own way,
 * and a second copy of those rules here would be one more thing to keep in
 * sync. Whoever holds the rendered output picks the first candidate it
 * actually has.
 */
export function sectionRestoreCandidates(
  sectionIds: readonly string[],
  targetId: string | null | undefined,
): string[] {
  if (!targetId) return [];
  const index = sectionIds.indexOf(targetId);
  // Not in this list at all (a stale id from a previous hydration) — nothing
  // to walk back through, so it's the only thing worth trying.
  if (index < 0) return [targetId];

  const candidates: string[] = [];
  for (let i = index; i >= 0; i -= 1) candidates.push(sectionIds[i]);
  return candidates;
}

/**
 * Where a settings/calendar/mode change puts the reader back. The verse that
 * was at the top of their page, if the same hymn is still shown and the
 * renderer still has that verse; else the START of that hymn; else the END of
 * the nearest *preceding* hymn that was shown before and still is. Never a
 * following hymn when an earlier one exists.
 *
 * A hymn is the same hymn by its section id, or, failing that, by its hymn
 * key: the same hymn on another day can sit at another place in the order
 * and so carry another id.
 */
export interface DocumentRestoreTarget {
  sectionId: string;
  edge: 'start' | 'end';
  /** The verse (its index in the hymn's own rows) to land on, for a surviving hymn; null for its start. */
  verseIndex?: number | null;
}
export interface DocumentRestoreRequest {
  token: string;
  target: DocumentRestoreTarget;
}

/** A section as a restore sees it: its id, and the hymn key it was assembled from. */
export interface DocumentSectionRef {
  id: string;
  hymnKey?: string | null;
}

export function toSectionRefs(sections: readonly (string | DocumentSectionRef)[]): DocumentSectionRef[] {
  return sections.map((section) => (typeof section === 'string' ? { id: section } : { id: section.id, hymnKey: section.hymnKey ?? null }));
}

/** The ordering MUST come from the document before it changed. */
export function resolveDocumentRestore(
  originalSections: readonly (string | DocumentSectionRef)[],
  originalSectionId: string,
  visibleNewSections: readonly (string | DocumentSectionRef)[],
  verseIndex: number | null = null,
): DocumentRestoreTarget | null {
  const original = toSectionRefs(originalSections);
  const visible = toSectionRefs(visibleNewSections);
  const visibleById = new Map(visible.map((section) => [section.id, section]));
  const findShown = (section: DocumentSectionRef): DocumentSectionRef | undefined =>
    visibleById.get(section.id) ??
    (section.hymnKey ? visible.find((candidate) => candidate.hymnKey === section.hymnKey) : undefined);

  const originalIndex = original.map((section) => section.id).lastIndexOf(originalSectionId);
  const originalSection = originalIndex >= 0 ? original[originalIndex] : { id: originalSectionId };
  const same = findShown(originalSection);
  if (same) return { sectionId: same.id, edge: 'start', verseIndex: verseIndex ?? null };
  for (let index = originalIndex - 1; index >= 0; index -= 1) {
    const previous = findShown(original[index]);
    if (previous) return { sectionId: previous.id, edge: 'end' };
  }
  // A removed first hymn has no predecessor. There is no sensible "end of
  // previous" target, so take the new document's start.
  return visible.length ? { sectionId: visible[0].id, edge: 'start' } : null;
}

interface VisibleSectionInput {
  id: string; hymnKey?: string | null; titlePrayerType?: string | null; bishopOnly?: boolean;
  priestOnly?: boolean; copticGospelRiteOnly?: boolean; nonCopticGospelRiteOnly?: boolean;
}
interface VisibilityPreferences { displaySilentPrayers: boolean; bishopPresent: boolean; copticGospelRite: boolean }

function isSectionVisible(section: VisibleSectionInput, preferences: VisibilityPreferences): boolean {
  return (preferences.displaySilentPrayers || section.titlePrayerType !== 'Silent Prayer') &&
    (!section.bishopOnly || preferences.bishopPresent) &&
    (!section.priestOnly || !preferences.bishopPresent) &&
    (!section.copticGospelRiteOnly || preferences.copticGospelRite) &&
    (!section.nonCopticGospelRiteOnly || !preferences.copticGospelRite);
}

export function visibleDocumentSectionIds(
  sections: readonly VisibleSectionInput[],
  preferences: VisibilityPreferences,
): string[] {
  return sections.filter((section) => isSectionVisible(section, preferences)).map((section) => section.id);
}

/** The sections shown under these preferences, with the hymn keys a restore matches by. */
export function visibleDocumentSectionRefs(
  sections: readonly VisibleSectionInput[],
  preferences: VisibilityPreferences,
): DocumentSectionRef[] {
  return sections.filter((section) => isSectionVisible(section, preferences)).map((section) => ({ id: section.id, hymnKey: section.hymnKey ?? null }));
}

/** The verse a scroll-mode report names, as its index in the hymn's own rows (`<section id>::v<index>`), or null. */
export function verseIndexFromId(verseId: string | null | undefined): number | null {
  const match = /::v(\d+)$/.exec(String(verseId || ''));
  return match ? Number(match[1]) : null;
}
