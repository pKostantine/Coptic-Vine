// Remembers, per document, the last section the user was looking at — a
// plain module-level store (not React state) because navigating to Settings
// and back unmounts the document screen (React Navigation doesn't keep
// screens outside the visible stack mounted on web), which would otherwise
// wipe any in-component position memory right when it's needed most.
//
// It holds only while the document is open: Settings, the Calendar or the
// Seasons over it, a date or a setting changed. A document left -- backed out
// of, swiped away, replaced by the next service -- forgets it, and opens again
// at the top.
import type { DocumentSectionRef } from './sectionRestore';

// Kept free of runtime imports: the tests load this module on its own.
function toSectionRefs(sections: readonly (string | DocumentSectionRef)[]): DocumentSectionRef[] {
  return sections.map((section) => (typeof section === 'string' ? { id: section } : { id: section.id, hymnKey: section.hymnKey ?? null }));
}

const lastPositionByDocument = new Map<string, string>();
// Left, and not yet opened again: a stray report from the closing reader must
// not write a position back after it was forgotten.
const closedDocuments = new Set<string>();

export function getLastDocumentPosition(key: string): string | undefined {
  return lastPositionByDocument.get(key);
}

export function setLastDocumentPosition(key: string, sectionId: string): void {
  if (closedDocuments.has(key)) return;
  lastPositionByDocument.set(key, sectionId);
}

/** The document is being left: forget where it was read, so it next opens at the top. */
export function forgetDocumentPosition(key: string): void {
  closedDocuments.add(key);
  lastPositionByDocument.delete(key);
  pendingRestores.delete(key);
}

/** The document is open (again): its position is remembered from here on. */
export function openDocumentPosition(key: string): void {
  closedDocuments.delete(key);
}

/** Preserve the ORIGINAL reading position/order across Settings or Calendar
 * route unmounts and asynchronous service rehydration. A snapshot is frozen
 * until that route returns, even if the user makes several changes there. */
export interface PendingDocumentRestore {
  sequence: number;
  revision: number;
  sectionId: string;
  originalSectionIds: string[];
  /** The sections as they were, with the hymn keys a restore matches by. */
  originalSections: DocumentSectionRef[];
  /** The verse at the top of the reader's page (its index in the hymn's rows), or null. */
  verseIndex: number | null;
  dirty: boolean;
  signature?: string;
}
const pendingRestores = new Map<string, PendingDocumentRestore>();
let nextRestoreSequence = 0;

export function captureDocumentRestore(
  key: string,
  sectionId: string | null | undefined,
  sections: readonly (string | DocumentSectionRef)[],
  signature?: string,
  verseIndex: number | null = null,
): void {
  if (closedDocuments.has(key) || pendingRestores.has(key) || !sectionId || !sections.length) return;
  const originalSections = toSectionRefs(sections);
  pendingRestores.set(key, {
    sequence: ++nextRestoreSequence,
    revision: 0,
    sectionId,
    originalSectionIds: originalSections.map((section) => section.id),
    originalSections,
    verseIndex: Number.isFinite(verseIndex as number) ? verseIndex : null,
    dirty: false,
    signature,
  });
  // Use the frozen position until it is deliberately restored. A WebView
  // that reflows behind Settings must not overwrite it with a stray report.
  setLastDocumentPosition(key, sectionId);
}

export function markPendingDocumentRestoresDirty(): void {
  pendingRestores.forEach(snapshot => {
    snapshot.dirty = true;
    snapshot.revision += 1;
  });
}

export function getPendingDocumentRestore(key: string): PendingDocumentRestore | undefined {
  return pendingRestores.get(key);
}

export function clearPendingDocumentRestore(key: string, sequence: number): void {
  if (pendingRestores.get(key)?.sequence === sequence) pendingRestores.delete(key);
}
