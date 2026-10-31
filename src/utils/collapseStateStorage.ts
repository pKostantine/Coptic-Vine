import { Platform } from 'react-native';

import { moveLegacyFile, moveLegacyStorageKey } from '@/utils/legacyNames';

type CollapseStatesBySection = Record<string, boolean>;
type CollapseStatesByDocument = Record<string, CollapseStatesBySection>;

const STORAGE_KEY = 'cv-collapsed-sections';
// Its name in earlier builds (utils/legacyNames.ts).
const LEGACY_STORAGE_KEY = 'chc-collapsed-sections';

let cachedStates: CollapseStatesByDocument | null = null;
let loadPromise: Promise<CollapseStatesByDocument> | null = null;
let writeQueue = Promise.resolve();

function sanitizeStoredStates(value: unknown): CollapseStatesByDocument {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  const sanitized: CollapseStatesByDocument = {};
  for (const [documentKey, sectionStates] of Object.entries(value)) {
    if (!sectionStates || typeof sectionStates !== 'object' || Array.isArray(sectionStates)) continue;
    const validSectionStates = Object.fromEntries(
      Object.entries(sectionStates).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean'),
    );
    if (Object.keys(validSectionStates).length) sanitized[documentKey] = validSectionStates;
  }
  return sanitized;
}

async function loadAllCollapseStates(): Promise<CollapseStatesByDocument> {
  if (cachedStates) return cachedStates;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      let raw: string | null = null;
      if (Platform.OS === 'web') {
        moveLegacyStorageKey(LEGACY_STORAGE_KEY, STORAGE_KEY);
        raw = window.localStorage.getItem(STORAGE_KEY);
      } else {
        const FileSystem = await import('expo-file-system/legacy');
        const fileUri = `${FileSystem.documentDirectory}${STORAGE_KEY}.json`;
        await moveLegacyFile(`${FileSystem.documentDirectory}${LEGACY_STORAGE_KEY}.json`, fileUri);
        const info = await FileSystem.getInfoAsync(fileUri);
        if (info.exists) raw = await FileSystem.readAsStringAsync(fileUri);
      }
      cachedStates = sanitizeStoredStates(raw ? JSON.parse(raw) : null);
    } catch {
      cachedStates = {};
    }
    return cachedStates;
  })();

  return loadPromise;
}

async function writeAllCollapseStates(states: CollapseStatesByDocument): Promise<void> {
  try {
    const serialized = JSON.stringify(states);
    if (Platform.OS === 'web') {
      moveLegacyStorageKey(LEGACY_STORAGE_KEY, STORAGE_KEY);
      window.localStorage.setItem(STORAGE_KEY, serialized);
      return;
    }

    const FileSystem = await import('expo-file-system/legacy');
    const fileUri = `${FileSystem.documentDirectory}${STORAGE_KEY}.json`;
    await moveLegacyFile(`${FileSystem.documentDirectory}${LEGACY_STORAGE_KEY}.json`, fileUri);
    await FileSystem.writeAsStringAsync(fileUri, serialized);
  } catch {
    // Best-effort persistence; the current mounted document still remembers.
  }
}

/**
 * The same choices at once, when they have been read this session (null
 * before): a document drawn from them needs no spinner while they are read.
 */
export function peekCollapsedSectionStates(documentKey: string): CollapseStatesBySection | null {
  return cachedStates ? { ...(cachedStates[documentKey] || {}) } : null;
}

/** Reads the stored choices ahead of the first document, once the app has opened. */
export function preloadCollapsedSectionStates(): void {
  void loadAllCollapseStates();
}

/** Returns explicit user choices only; missing entries fall back to the hymn's database default. */
export async function loadCollapsedSectionStates(documentKey: string): Promise<CollapseStatesBySection> {
  const states = await loadAllCollapseStates();
  return { ...(states[documentKey] || {}) };
}

/** Serializes writes so rapid toggles in different open documents cannot overwrite one another. */
export function saveCollapsedSectionState(documentKey: string, sectionId: string, collapsed: boolean): Promise<void> {
  writeQueue = writeQueue.then(async () => {
    const states = await loadAllCollapseStates();
    states[documentKey] = { ...(states[documentKey] || {}), [sectionId]: collapsed };
    await writeAllCollapseStates(states);
  });
  return writeQueue;
}
