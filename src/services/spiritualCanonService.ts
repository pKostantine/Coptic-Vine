import { Platform } from 'react-native';

import {
  emptyCanonDocument,
  normalizeCanonDayMarks,
  normalizeCanonDocument,
  normalizeCanonItem,
  type CanonDayMarks,
  type CanonDocument,
  type CanonItem,
} from '@/utils/spiritualCanon';
import { supabase } from '@/utils/supabase';

/**
 * The canon on this device and in the account. The device keeps one copy for
 * each account it has been signed in to and one for no account, so a canon
 * set down signed out is not mixed with an account's, nor one account's
 * with another's.
 */
const STORAGE_PREFIX = 'cv-spiritual-canon-v1';

function storageKey(identity: string) {
  return `${STORAGE_PREFIX}-${encodeURIComponent(identity)}`;
}

/** The device's preference for canon reminders here (not the account's: each device decides). */
const REMINDERS_KEY = 'cv-spiritual-canon-reminders-v1';
/** The days metanias are made, as last read from the calendar: the canon shows them at once, offline too. */
const CALENDAR_KEY = 'cv-spiritual-canon-calendar-v1';

async function readText(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return globalThis.localStorage?.getItem(key) ?? null;
  const FileSystem = await import('expo-file-system/legacy');
  const fileUri = `${FileSystem.documentDirectory}${key}.json`;
  const info = await FileSystem.getInfoAsync(fileUri);
  return info.exists ? FileSystem.readAsStringAsync(fileUri) : null;
}

async function writeText(key: string, text: string): Promise<void> {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.setItem(key, text);
    return;
  }
  const FileSystem = await import('expo-file-system/legacy');
  await FileSystem.writeAsStringAsync(`${FileSystem.documentDirectory}${key}.json`, text);
}

async function removeText(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.removeItem(key);
    return;
  }
  const FileSystem = await import('expo-file-system/legacy');
  await FileSystem.deleteAsync(`${FileSystem.documentDirectory}${key}.json`, { idempotent: true });
}

export async function loadLocalCanon(identity: string): Promise<CanonDocument> {
  try {
    const raw = await readText(storageKey(identity));
    return raw ? normalizeCanonDocument(JSON.parse(raw)) : emptyCanonDocument();
  } catch {
    return emptyCanonDocument();
  }
}

export async function saveLocalCanon(identity: string, document: CanonDocument): Promise<void> {
  try {
    await writeText(storageKey(identity), JSON.stringify(document));
  } catch {
    // Best-effort: the account's copy (when signed in) still holds it.
  }
}

/** Forgets the signed-out copy once it has gone into an account. */
export async function clearLocalCanon(identity: string): Promise<void> {
  try {
    await removeText(storageKey(identity));
  } catch {
    // Nothing to forget.
  }
}

export async function loadCanonRemindersEnabled(): Promise<boolean> {
  try {
    return (await readText(REMINDERS_KEY)) !== 'off';
  } catch {
    return true;
  }
}

export async function saveCanonRemindersEnabled(enabled: boolean): Promise<void> {
  try {
    await writeText(REMINDERS_KEY, enabled ? 'on' : 'off');
  } catch {
    // The choice holds for this session.
  }
}

export async function loadCanonCalendarCache(): Promise<Record<string, boolean>> {
  try {
    const raw = await readText(CALENDAR_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, boolean] => /^\d{4}-\d{2}-\d{2}$/.test(entry[0]) && typeof entry[1] === 'boolean'));
  } catch {
    return {};
  }
}

export async function saveCanonCalendarCache(days: Record<string, boolean>): Promise<void> {
  try {
    await writeText(CALENDAR_KEY, JSON.stringify(days));
  } catch {
    // Read again from the calendar next time.
  }
}

/** The account's canon and its marks from `sinceDay` on, as one document; null when it has never kept one. */
export async function loadCloudCanon(sinceDay: string): Promise<CanonDocument | null> {
  const [canon, days] = await Promise.all([
    supabase.from('spiritual_canons').select('items, item_deletions, updated_at').maybeSingle(),
    supabase.from('spiritual_canon_days').select('day, marks').gte('day', sinceDay).order('day', { ascending: true }),
  ]);
  if (canon.error) throw new Error(canon.error.message || 'Unable to load the spiritual canon.');
  if (days.error) throw new Error(days.error.message || 'Unable to load the spiritual canon’s days.');
  if (!canon.data && !(days.data ?? []).length) return null;
  return normalizeCanonDocument({
    version: 1,
    items: canon.data?.items ?? [],
    itemDeletions: canon.data?.item_deletions ?? {},
    days: Object.fromEntries((days.data ?? []).map((row) => [String(row.day).slice(0, 10), row.marks])),
    updatedAt: canon.data?.updated_at ?? new Date(0).toISOString(),
  });
}

/** The account's items alone, read just before writing them back merged. */
export async function loadCloudCanonDefinition(): Promise<Pick<CanonDocument, 'items' | 'itemDeletions'> | null> {
  const { data, error } = await supabase.from('spiritual_canons').select('items, item_deletions').maybeSingle();
  if (error) throw new Error(error.message || 'Unable to load the spiritual canon.');
  if (!data) return null;
  const document = normalizeCanonDocument({ version: 1, items: data.items, itemDeletions: data.item_deletions, days: {} });
  return { items: document.items, itemDeletions: document.itemDeletions };
}

export async function saveCloudCanonDefinition(userId: string, definition: { items: CanonItem[]; itemDeletions: Record<string, string> }): Promise<void> {
  const { error } = await supabase.from('spiritual_canons').upsert({
    user_id: userId,
    items: definition.items.map((item) => normalizeCanonItem(item)).filter(Boolean),
    item_deletions: definition.itemDeletions,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (error) throw new Error(error.message || 'Unable to save the spiritual canon.');
}

/** The account's marks for some days, read just before writing them back merged. */
export async function loadCloudCanonDays(days: string[]): Promise<Record<string, CanonDayMarks>> {
  if (!days.length) return {};
  const { data, error } = await supabase.from('spiritual_canon_days').select('day, marks').in('day', days);
  if (error) throw new Error(error.message || 'Unable to load the spiritual canon’s days.');
  return Object.fromEntries((data ?? []).map((row) => [String(row.day).slice(0, 10), normalizeCanonDayMarks(row.marks)]));
}

export async function saveCloudCanonDays(userId: string, days: Record<string, CanonDayMarks>): Promise<void> {
  const rows = Object.entries(days).map(([day, marks]) => ({ user_id: userId, day, marks, updated_at: new Date().toISOString() }));
  if (!rows.length) return;
  const { error } = await supabase.from('spiritual_canon_days').upsert(rows, { onConflict: 'user_id,day' });
  if (error) throw new Error(error.message || 'Unable to save the spiritual canon’s days.');
}
