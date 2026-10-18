import { Platform } from 'react-native';

/**
 * Where each lesson and recording was left: a long lesson picks up where the
 * listener stopped, on this device, the way a podcast app does. Kept apart
 * from the queue snapshot (playbackStateStorage.ts), which remembers only
 * what is playing now.
 */
export interface LearningResumePosition {
  positionMs: number;
  durationMs: number | null;
  updatedAt: string;
}

export type LearningResumeMap = Record<string, LearningResumePosition>;

const STORAGE_KEY = 'cv-learning-resume-v1';
/** Only this many items are remembered; the oldest go first. */
export const MAX_RESUME_ITEMS = 300;
/** Before this far in, a lesson simply starts over. */
export const RESUME_MIN_MS = 15_000;
/** This close to the end, a lesson is finished and starts over next time. */
export const RESUME_END_MARGIN_MS = 10_000;
/** How much a position must move before it is written again. */
export const RESUME_WRITE_STEP_MS = 5_000;

export function isLearningResumePosition(value: unknown): value is LearningResumePosition {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<LearningResumePosition>;
  return typeof entry.positionMs === 'number' && Number.isFinite(entry.positionMs) && entry.positionMs >= 0
    && (entry.durationMs == null || (typeof entry.durationMs === 'number' && Number.isFinite(entry.durationMs)))
    && typeof entry.updatedAt === 'string' && !Number.isNaN(Date.parse(entry.updatedAt));
}

export function sanitizeLearningResumeMap(value: unknown): LearningResumeMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const entries = Object.entries(value as Record<string, unknown>)
    .filter((entry): entry is [string, LearningResumePosition] => entry[0].length > 0 && isLearningResumePosition(entry[1]))
    .sort((a, b) => Date.parse(b[1].updatedAt) - Date.parse(a[1].updatedAt))
    .slice(0, MAX_RESUME_ITEMS);
  return Object.fromEntries(entries);
}

/**
 * Where to start an item: its saved position when it is well inside the
 * item, else the beginning. `durationMs` may be unknown until the item
 * loads; then only the lower bound applies.
 */
export function resumePositionFor(entry: LearningResumePosition | undefined, durationMs: number | null | undefined): number {
  if (!entry || entry.positionMs < RESUME_MIN_MS) return 0;
  const duration = durationMs ?? entry.durationMs;
  if (duration != null && duration > 0 && entry.positionMs >= duration - RESUME_END_MARGIN_MS) return 0;
  return entry.positionMs;
}

/** Whether a new position is worth writing: moved a step, or finished. */
export function shouldWriteResume(previous: LearningResumePosition | undefined, positionMs: number): boolean {
  if (!previous) return positionMs >= RESUME_WRITE_STEP_MS;
  return Math.abs(positionMs - previous.positionMs) >= RESUME_WRITE_STEP_MS;
}

/** The map with one item's position set, or cleared when it has reached the end. */
export function withResumePosition(
  map: LearningResumeMap,
  itemId: string,
  positionMs: number,
  durationMs: number | null,
  now = new Date(),
): LearningResumeMap {
  const finished = durationMs != null && durationMs > 0 && positionMs >= durationMs - RESUME_END_MARGIN_MS;
  const next: LearningResumeMap = { ...map };
  if (finished || positionMs < RESUME_MIN_MS) {
    delete next[itemId];
    return sanitizeLearningResumeMap(next);
  }
  next[itemId] = { positionMs: Math.round(positionMs), durationMs: durationMs ?? null, updatedAt: now.toISOString() };
  return sanitizeLearningResumeMap(next);
}

let cache: LearningResumeMap | null = null;
let loading: Promise<LearningResumeMap> | null = null;
const listeners = new Set<() => void>();

async function readStored(): Promise<LearningResumeMap> {
  try {
    if (Platform.OS === 'web') {
      const raw = globalThis.localStorage?.getItem(STORAGE_KEY) ?? null;
      return raw ? sanitizeLearningResumeMap(JSON.parse(raw)) : {};
    }
    const FileSystem = await import('expo-file-system/legacy');
    const fileUri = `${FileSystem.documentDirectory}${STORAGE_KEY}.json`;
    const info = await FileSystem.getInfoAsync(fileUri);
    if (!info.exists) return {};
    return sanitizeLearningResumeMap(JSON.parse(await FileSystem.readAsStringAsync(fileUri)));
  } catch {
    return {};
  }
}

async function writeStored(map: LearningResumeMap): Promise<void> {
  try {
    const raw = JSON.stringify(map);
    if (Platform.OS === 'web') {
      globalThis.localStorage?.setItem(STORAGE_KEY, raw);
      return;
    }
    const FileSystem = await import('expo-file-system/legacy');
    await FileSystem.writeAsStringAsync(`${FileSystem.documentDirectory}${STORAGE_KEY}.json`, raw);
  } catch {
    // Remembering where a lesson was is best-effort; playback never waits on it.
  }
}

export async function loadLearningResume(): Promise<LearningResumeMap> {
  if (cache) return cache;
  loading ??= readStored().then((map) => {
    cache = map;
    loading = null;
    return map;
  });
  return loading;
}

/** The map as last loaded, for synchronous reads; empty until loaded. */
export function peekLearningResume(): LearningResumeMap {
  return cache ?? {};
}

let pendingWrite: Promise<void> = Promise.resolve();

export async function saveLearningResume(itemId: string, positionMs: number, durationMs: number | null): Promise<void> {
  const current = await loadLearningResume();
  const next = withResumePosition(current, itemId, positionMs, durationMs);
  cache = next;
  listeners.forEach((listener) => listener());
  pendingWrite = pendingWrite.then(() => writeStored(next)).catch(() => undefined);
  return pendingWrite;
}

export function subscribeLearningResume(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
