/**
 * The document just left, to go back into with a swipe to the left.
 *
 * A reader who swipes out of a document by accident lands on the page
 * beneath it (its book's menu, Home, Bookmarks…). While they stay on that
 * page, a swipe to the left opens the document again where they were: its
 * hymn and the verse at the top of the page, scrolling or on a slide
 * (ServiceDocument records it as it goes; ReturnToDocumentSwipe answers the
 * swipe). Going anywhere else from that page lets it go.
 *
 * Kept free of runtime imports beyond React: the tests load it on its own.
 */
import { useSyncExternalStore } from 'react';

import type { DocumentSectionRef } from './sectionRestore';

export interface LeftDocument {
  /** The document's position key (ServiceDocument's documentPositionKey). */
  key: string;
  /** Where it opens: its path and query, as it was opened. */
  href: string;
  /** Its name, in English, Arabic and French, for the swipe's label. */
  title: { english: string; arabic?: string; french?: string };
  /** The hymn being read, and the verse at the top of the page in it. */
  sectionId: string | null;
  verseIndex: number | null;
  /** The document's hymns as they were, to find that hymn again. */
  sections: DocumentSectionRef[];
  /** The reader's settings then (ServiceDocument's restoreSettingsSignature). */
  signature?: string;
}

interface Held extends LeftDocument {
  /** The page it was left for, once the app has arrived there. */
  landing: string | null;
}

let held: Held | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

/** The path of an href, without its query. */
export function hrefPath(href: string): string {
  return href.split('?')[0].split('#')[0] || '/';
}

/**
 * A document has just been left, going back: it can be returned to from the
 * page it was left for. Told twice as it goes (the navigator, then the screen
 * unmounting), the second time keeps the page it has already landed on.
 */
export function rememberLeftDocument(document: LeftDocument): void {
  held = { ...document, landing: held?.key === document.key ? held.landing : null };
  notify();
}

/**
 * The app has arrived at `pathname`. The first page after leaving is where
 * the document can be returned to from; any other page after it, or the
 * document itself opened again, lets it go.
 */
export function settleLeftDocument(pathname: string): void {
  if (!held) return;
  if (pathname === hrefPath(held.href)) {
    // Still on the document, the path not yet changed, or opened again.
    if (held.landing !== null) {
      held = null;
      notify();
    }
    return;
  }
  if (held.landing === null) {
    held = { ...held, landing: pathname };
    notify();
  } else if (held.landing !== pathname) {
    held = null;
    notify();
  }
}

/** The document that can be returned to from `pathname`, if any. */
export function returnableDocument(pathname: string): LeftDocument | null {
  return held && held.landing === pathname ? held : null;
}

/** Takes the document to return to from `pathname`, letting it go. */
export function takeLeftDocument(pathname: string): LeftDocument | null {
  const document = returnableDocument(pathname);
  if (document) {
    held = null;
    notify();
  }
  return document;
}

/** Forgets any document held (a section opened from the tab bar, a sign-out). */
export function clearLeftDocument(): void {
  if (!held) return;
  held = null;
  notify();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The document that can be returned to from `pathname`, kept current. */
export function useReturnableDocument(pathname: string): LeftDocument | null {
  return useSyncExternalStore(subscribe, () => returnableDocument(pathname), () => null);
}
