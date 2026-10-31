import { Platform } from 'react-native';

import type { PlaybackReloadPoint, PlaybackSnapshot } from '@/types/playback';
import { moveLegacyFile, moveLegacyStorageKey } from '@/utils/legacyNames';
import { sanitizePlaybackSnapshot } from '@/utils/playbackEngine';

const STORAGE_KEY = 'cv-playback-state-v1';
// Its name in earlier builds (utils/legacyNames.ts).
const LEGACY_STORAGE_KEY = 'chc-playback-state-v1';
// The tab's own storage: it survives a reload and goes when the tab is closed.
const RELOAD_KEY = 'cv-playback-reload-v1';
// A reload point older than this is from another listening session.
const RELOAD_POINT_MAX_AGE_MS = 6 * 60 * 60 * 1000;

export async function loadPlaybackSnapshot(): Promise<PlaybackSnapshot | null> {
  try {
    if (Platform.OS === 'web') {
      moveLegacyStorageKey(LEGACY_STORAGE_KEY, STORAGE_KEY);
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? sanitizePlaybackSnapshot(JSON.parse(raw)) : null;
    }

    const FileSystem = await import('expo-file-system/legacy');
    const fileUri = `${FileSystem.documentDirectory}${STORAGE_KEY}.json`;
    await moveLegacyFile(`${FileSystem.documentDirectory}${LEGACY_STORAGE_KEY}.json`, fileUri);
    const info = await FileSystem.getInfoAsync(fileUri);
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(fileUri);
    return sanitizePlaybackSnapshot(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function savePlaybackSnapshot(snapshot: PlaybackSnapshot | null): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      moveLegacyStorageKey(LEGACY_STORAGE_KEY, STORAGE_KEY);
      if (snapshot) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      else window.localStorage.removeItem(STORAGE_KEY);
      return;
    }

    const FileSystem = await import('expo-file-system/legacy');
    const fileUri = `${FileSystem.documentDirectory}${STORAGE_KEY}.json`;
    await moveLegacyFile(`${FileSystem.documentDirectory}${LEGACY_STORAGE_KEY}.json`, fileUri);
    if (!snapshot) {
      const info = await FileSystem.getInfoAsync(fileUri);
      if (info.exists) await FileSystem.deleteAsync(fileUri, { idempotent: true });
      return;
    }
    await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(snapshot));
  } catch {
    // Playback persistence is best-effort. Playback itself must never fail
    // simply because the device could not write the resume snapshot.
  }
}

export async function localPlaybackUriExists(uri: string): Promise<boolean> {
  try {
    if (!uri.startsWith('file://')) return true;
    if (Platform.OS === 'web') return true;
    const FileSystem = await import('expo-file-system/legacy');
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists;
  } catch {
    return false;
  }
}

/**
 * Where playback was as the page was left (web only), so a reload carries on
 * from that moment, still playing if it was. Closing the tab forgets it: the
 * saved queue (savePlaybackSnapshot) then comes back paused, as before.
 */
export function saveReloadPoint(point: PlaybackReloadPoint | null): void {
  if (Platform.OS !== 'web') return;
  try {
    if (point) window.sessionStorage.setItem(RELOAD_KEY, JSON.stringify(point));
    else window.sessionStorage.removeItem(RELOAD_KEY);
  } catch {
    // Best-effort, like the snapshot.
  }
}

/**
 * Whether this page was reached by reloading it, or by Back/Forward into it
 * from a page after it. Only then does playback carry on by itself: opened
 * afresh (a link, a typed address) the queue comes back paused.
 */
function pageReturnedTo(): boolean {
  try {
    const entry = window.performance?.getEntriesByType?.('navigation')?.[0] as { type?: string } | undefined;
    return entry?.type === 'reload' || entry?.type === 'back_forward';
  } catch {
    return false;
  }
}

/** The reload point for `key`, the entry the saved queue comes back on, if it is recent. */
export function reloadPointFor(key: string | null | undefined, now = Date.now()): PlaybackReloadPoint | null {
  if (Platform.OS !== 'web' || !key) return null;
  try {
    const raw = window.sessionStorage.getItem(RELOAD_KEY);
    if (!raw) return null;
    const point = JSON.parse(raw) as Partial<PlaybackReloadPoint>;
    if (point.key !== key || typeof point.positionMs !== 'number' || !Number.isFinite(point.positionMs)) return null;
    if (typeof point.savedAt !== 'number' || now - point.savedAt > RELOAD_POINT_MAX_AGE_MS || point.savedAt > now + 60_000) return null;
    return { key, positionMs: Math.max(0, point.positionMs), playing: point.playing === true && pageReturnedTo(), savedAt: point.savedAt };
  } catch {
    return null;
  }
}
