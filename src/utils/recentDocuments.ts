import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

import { CATEGORIES } from '../constants/manifest';

/** A name in each app language, as the manifest and the Bible give them. */
export interface RecentDocumentTitle {
  english: string;
  arabic: string;
  french?: string;
}

/** A document the reader opened, remembered so the Books page can offer it again. */
export interface RecentDocument {
  /** What makes two visits the same document: a service's bookmark key, a Bible chapter's book and chapter. */
  key: string;
  /** The route that opens it again. */
  href: string;
  title: RecentDocumentTitle;
  /** The book it belongs to — Psalmody, the Bible — for the row's second line. */
  book: RecentDocumentTitle;
  /** When it was last opened, in milliseconds since the epoch. */
  openedAt: number;
}

/** How many are kept; the Books page shows the first few of them. */
export const MAX_RECENT_DOCUMENTS = 8;

const STORAGE_KEY = 'chc-recent-documents';

/** The list with this visit at its head: the same document moves up rather than appearing twice, and the oldest falls off the end. */
export function withRecentDocument(list: readonly RecentDocument[], entry: RecentDocument): RecentDocument[] {
  return [entry, ...list.filter((existing) => existing.key !== entry.key)].slice(0, MAX_RECENT_DOCUMENTS);
}

function isTitle(value: unknown): value is RecentDocumentTitle {
  if (!value || typeof value !== 'object') return false;
  const title = value as Record<string, unknown>;
  return typeof title.english === 'string' && typeof title.arabic === 'string'
    && (title.french === undefined || typeof title.french === 'string');
}

/** Whatever was stored, as a list of well-formed entries, newest first — a corrupted or outdated store yields an empty one rather than a crash. */
export function normalizeRecentDocuments(value: unknown): RecentDocument[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const entries: RecentDocument[] = [];
  for (const candidate of value) {
    if (!candidate || typeof candidate !== 'object') continue;
    const entry = candidate as Record<string, unknown>;
    if (typeof entry.key !== 'string' || !entry.key || typeof entry.href !== 'string' || !entry.href.startsWith('/')) continue;
    if (!isTitle(entry.title) || !isTitle(entry.book)) continue;
    if (typeof entry.openedAt !== 'number' || !Number.isFinite(entry.openedAt)) continue;
    if (seen.has(entry.key)) continue;
    seen.add(entry.key);
    entries.push({ key: entry.key, href: entry.href, title: entry.title, book: entry.book, openedAt: entry.openedAt });
  }
  return entries.sort((a, b) => b.openedAt - a.openedAt).slice(0, MAX_RECENT_DOCUMENTS);
}

/** The book a route belongs to, named as the Books shelf names it: /psalmody/… is Psalmody, /bible/… the Bible. */
export function bookForPath(pathname: string): RecentDocumentTitle {
  const root = pathname.split('/').filter(Boolean)[0] ?? '';
  const category = CATEGORIES.find((entry) => entry.id === root);
  if (category) return { english: category.title, arabic: category.arabic, french: category.french };
  return { english: 'Books', arabic: 'الكتب', french: 'Livres' };
}

// Persisted the way the bookmarks are (bookmarksStorage.ts): the browser's
// localStorage on the web, a file in the app's documents on a device.
export async function loadRecentDocuments(): Promise<RecentDocument[]> {
  try {
    if (Platform.OS === 'web') {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return normalizeRecentDocuments(raw ? JSON.parse(raw) : []);
    }
    const FileSystem = await import('expo-file-system/legacy');
    const fileUri = `${FileSystem.documentDirectory}${STORAGE_KEY}.json`;
    const info = await FileSystem.getInfoAsync(fileUri);
    if (!info.exists) return [];
    return normalizeRecentDocuments(JSON.parse(await FileSystem.readAsStringAsync(fileUri)));
  } catch {
    return [];
  }
}

export async function saveRecentDocuments(list: readonly RecentDocument[]): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      return;
    }
    const FileSystem = await import('expo-file-system/legacy');
    await FileSystem.writeAsStringAsync(`${FileSystem.documentDirectory}${STORAGE_KEY}.json`, JSON.stringify(list));
  } catch {
    // Best-effort persistence: the list is a convenience, not a record.
  }
}

// ─── The live list ────────────────────────────────────────────────────────
// One store for the whole app, read by the Books page and written by the
// readers, so a document opened a moment ago is on the shelf when the reader
// comes back to it.

let recents: RecentDocument[] = [];
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function ensureLoaded(): Promise<void> {
  if (!loading) {
    loading = loadRecentDocuments().then((stored) => {
      // Anything recorded while the store was still loading has already been
      // merged into `recents`; the stored list goes beneath it.
      recents = stored.reduce((list, entry) => (list.some((kept) => kept.key === entry.key) ? list : [...list, entry]), recents)
        .sort((a, b) => b.openedAt - a.openedAt)
        .slice(0, MAX_RECENT_DOCUMENTS);
      notify();
    });
  }
  return loading;
}

/** Puts a document at the head of the list, now (or at the moment given), and keeps the list. */
export function recordRecentDocument(entry: Omit<RecentDocument, 'openedAt'> & { openedAt?: number }): void {
  const visit: RecentDocument = { ...entry, openedAt: entry.openedAt ?? Date.now() };
  recents = withRecentDocument(recents, visit);
  notify();
  void ensureLoaded().then(() => saveRecentDocuments(recents));
}

export function clearRecentDocuments(): void {
  recents = [];
  notify();
  void ensureLoaded().then(() => saveRecentDocuments(recents));
}

/** For tests: the list as it stands, without touching storage. */
export function getRecentDocumentsSnapshot(): RecentDocument[] {
  return recents;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  void ensureLoaded();
  return () => { listeners.delete(listener); };
}

/** The recently opened documents, newest first, loading from storage the first time anything asks. */
export function useRecentDocuments(): RecentDocument[] {
  return useSyncExternalStore(subscribe, getRecentDocumentsSnapshot, getRecentDocumentsSnapshot);
}
