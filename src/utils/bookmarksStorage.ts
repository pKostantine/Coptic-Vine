import { Platform } from 'react-native';

import { moveLegacyFile, moveLegacyStorageKey } from '@/utils/legacyNames';

const STORAGE_KEY = 'cv-bookmarks';
// Its name in earlier builds (utils/legacyNames.ts).
const LEGACY_STORAGE_KEY = 'chc-bookmarks';

export async function loadBookmarks(): Promise<string[]> {
  try {
    if (Platform.OS === 'web') {
      moveLegacyStorageKey(LEGACY_STORAGE_KEY, STORAGE_KEY);
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    }

    const FileSystem = await import('expo-file-system/legacy');
    const fileUri = `${FileSystem.documentDirectory}${STORAGE_KEY}.json`;
    await moveLegacyFile(`${FileSystem.documentDirectory}${LEGACY_STORAGE_KEY}.json`, fileUri);
    const info = await FileSystem.getInfoAsync(fileUri);
    if (!info.exists) return [];
    const raw = await FileSystem.readAsStringAsync(fileUri);
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function saveBookmarks(bookmarks: string[]): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      moveLegacyStorageKey(LEGACY_STORAGE_KEY, STORAGE_KEY);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
      return;
    }

    const FileSystem = await import('expo-file-system/legacy');
    const fileUri = `${FileSystem.documentDirectory}${STORAGE_KEY}.json`;
    await moveLegacyFile(`${FileSystem.documentDirectory}${LEGACY_STORAGE_KEY}.json`, fileUri);
    await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(bookmarks));
  } catch {
    // Best-effort persistence.
  }
}
