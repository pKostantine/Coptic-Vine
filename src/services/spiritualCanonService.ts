import { Platform } from 'react-native';

import {
  emptyCanonDocument,
  type CanonCalendarDay,
  isAbstinenceFast,
  normalizeCanonDayMarks,
  normalizeCanonDocument,
  newCanonId,
  normalizeCanonItem,
  type CanonDayMarks,
  type CanonDocument,
  type CanonItem,
} from '@/utils/spiritualCanon';
import { api } from '@/utils/api';
import { publicUrl } from '@/utils/publicUrl';

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
// v6: each day's fasts, for abstinence; days read before are read again.
const CALENDAR_KEY = 'cv-spiritual-canon-calendar-v6';

/** A day as the calendar had it, and when it was read. */
export type CachedCanonCalendarDay = CanonCalendarDay & { readAt: string };

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

export async function loadCanonCalendarCache(): Promise<Record<string, CachedCanonCalendarDay>> {
  try {
    const raw = await readText(CALENDAR_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed as Record<string, Partial<CachedCanonCalendarDay>>)
      .filter(([day, entry]) => /^\d{4}-\d{2}-\d{2}$/.test(day)
        && typeof entry?.applicable === 'boolean'
        && typeof entry?.fasting === 'boolean'
        && (entry?.agpeya === 'all' || entry?.agpeya === 'beforeEve' || entry?.agpeya === 'none')
        && Array.isArray(entry?.fasts)
        && typeof entry?.readAt === 'string' && !Number.isNaN(Date.parse(entry.readAt)))
      .map(([day, entry]) => [day, {
        applicable: Boolean(entry.applicable),
        fasting: Boolean(entry.fasting),
        agpeya: entry.agpeya as CanonCalendarDay['agpeya'],
        fasts: (entry.fasts as unknown[]).filter(isAbstinenceFast),
        readAt: String(entry.readAt),
      }]));
  } catch {
    return {};
  }
}

export async function saveCanonCalendarCache(days: Record<string, CachedCanonCalendarDay>): Promise<void> {
  try {
    await writeText(CALENDAR_KEY, JSON.stringify(days));
  } catch {
    // Read again from the calendar next time.
  }
}

/** The account's canon and its marks from `sinceDay` on, as one document; null when it has never kept one. */
export async function loadCloudCanon(sinceDay: string): Promise<CanonDocument | null> {
  const [canon, days] = await Promise.all([
    api.from('spiritual_canons').select('items, item_deletions, updated_at').maybeSingle(),
    api.from('spiritual_canon_days').select('day, marks').gte('day', sinceDay).order('day', { ascending: true }),
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
  const { data, error } = await api.from('spiritual_canons').select('items, item_deletions').maybeSingle();
  if (error) throw new Error(error.message || 'Unable to load the spiritual canon.');
  if (!data) return null;
  const document = normalizeCanonDocument({ version: 1, items: data.items, itemDeletions: data.item_deletions, days: {} });
  return { items: document.items, itemDeletions: document.itemDeletions };
}

export async function saveCloudCanonDefinition(userId: string, definition: { items: CanonItem[]; itemDeletions: Record<string, string> }): Promise<void> {
  const { error } = await api.from('spiritual_canons').upsert({
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
  const { data, error } = await api.from('spiritual_canon_days').select('day, marks').in('day', days);
  if (error) throw new Error(error.message || 'Unable to load the spiritual canon’s days.');
  return Object.fromEntries((data ?? []).map((row) => [String(row.day).slice(0, 10), normalizeCanonDayMarks(row.marks)]));
}

export async function saveCloudCanonDays(userId: string, days: Record<string, CanonDayMarks>): Promise<void> {
  const rows = Object.entries(days).map(([day, marks]) => ({ user_id: userId, day, marks, updated_at: new Date().toISOString() }));
  if (!rows.length) return;
  const { error } = await api.from('spiritual_canon_days').upsert(rows, { onConflict: 'user_id,day' });
  if (error) throw new Error(error.message || 'Unable to save the spiritual canon’s days.');
}

// ─── The canon's instructions ───────────────────────────────────────────────

/**
 * What a believer's father of confession told them of their canon, written
 * down beside it: kept on the device for each account (and for no account),
 * and in the account through cv-api (get_my_canon_instructions,
 * save_my_canon_instructions), the later copy kept.
 */
export interface CanonInstructions {
  text: string;
  /** When it was last written; null for none written. */
  updatedAt: string | null;
}

const INSTRUCTIONS_PREFIX = 'cv-spiritual-canon-instructions-v1';

function instructionsKey(identity: string) {
  return `${INSTRUCTIONS_PREFIX}-${encodeURIComponent(identity)}`;
}

/** When a copy was written, as a time; the beginning of time for one never written. */
function writtenTime(value: CanonInstructions): number {
  const time = value.updatedAt ? Date.parse(value.updatedAt) : Number.NaN;
  return Number.isNaN(time) ? 0 : time;
}

/** The later of two copies; the first when they were written at once. */
export function laterCanonInstructions(a: CanonInstructions, b: CanonInstructions): CanonInstructions {
  return writtenTime(b) > writtenTime(a) ? b : a;
}

export async function loadLocalCanonInstructions(identity: string): Promise<CanonInstructions> {
  try {
    const raw = await readText(instructionsKey(identity));
    const parsed = raw ? JSON.parse(raw) as Partial<CanonInstructions> : null;
    return {
      text: typeof parsed?.text === 'string' ? parsed.text : '',
      updatedAt: typeof parsed?.updatedAt === 'string' && !Number.isNaN(Date.parse(parsed.updatedAt)) ? parsed.updatedAt : null,
    };
  } catch {
    return { text: '', updatedAt: null };
  }
}

export async function saveLocalCanonInstructions(identity: string, value: CanonInstructions): Promise<void> {
  try {
    await writeText(instructionsKey(identity), JSON.stringify(value));
  } catch {
    // The account's copy (when signed in) still holds it.
  }
}

/** Forgets the signed-out copy once it has gone into an account. */
export async function clearLocalCanonInstructions(identity: string): Promise<void> {
  try {
    await removeText(instructionsKey(identity));
  } catch {
    // Nothing to forget.
  }
}

function fromAccount(data: unknown): CanonInstructions {
  const row = (data ?? {}) as { instructions?: unknown; updatedAt?: unknown };
  return {
    text: typeof row.instructions === 'string' ? row.instructions : '',
    updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : null,
  };
}

export async function loadCloudCanonInstructions(): Promise<CanonInstructions> {
  const { data, error } = await api.rpc('get_my_canon_instructions');
  if (error) throw new Error(error.message || 'Unable to load the canon’s instructions.');
  return fromAccount(data);
}

/** Sends a copy; the account keeps the later of its own and this one, and returns what it kept. */
export async function saveCloudCanonInstructions(value: CanonInstructions): Promise<CanonInstructions> {
  const { data, error } = await api.rpc('save_my_canon_instructions', { p_instructions: value.text, p_written_at: value.updatedAt });
  if (error) throw new Error(error.message || 'Unable to save the canon’s instructions.');
  return fromAccount(data);
}

// ─── Sharing parts of the canon ─────────────────────────────────────────────

/**
 * A copy of some of the canon's items under a link the believer hands out
 * (cv-api's create_canon_share and the rest, workers/api/src/rpc/canonShares.ts),
 * for a friend or a support group to read and take into their own canon.
 */
export interface CanonShare {
  id: string;
  sharerName: string | null;
  message: string | null;
  items: CanonItem[];
  instructions: string | null;
  createdAt: string;
}

/**
 * An item as it is shared: its own reminders left behind (each keeps their
 * own), and nothing of when it was set down.
 */
export function sharedCanonItem(item: CanonItem): CanonItem {
  const stamp = new Date(0).toISOString();
  const base = { ...item, createdAt: stamp, updatedAt: stamp };
  if (base.kind === 'agpeya') {
    const quiet = (plans: typeof base.hours) => plans.map((plan) => ({ ...plan, remind: false }));
    return { ...base, hours: quiet(base.hours), days: base.days.map(quiet) };
  }
  return { ...base, remind: false } as CanonItem;
}

/** A shared item taken into one's own canon: an item of its own, with a new id and written now. */
export function adoptedCanonItem(item: CanonItem, now = new Date()): CanonItem {
  const stamp = now.toISOString();
  return { ...sharedCanonItem(item), id: newCanonId(), createdAt: stamp, updatedAt: stamp };
}

/** The link to a shared canon, to send. */
export function canonShareUrl(id: string): string {
  return publicUrl(`/canon/shared/${encodeURIComponent(id)}`);
}

function shareFromAccount(data: unknown): CanonShare {
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    id: String(row.id ?? ''),
    sharerName: typeof row.sharerName === 'string' ? row.sharerName : null,
    message: typeof row.message === 'string' ? row.message : null,
    items: (Array.isArray(row.items) ? row.items : []).map((item) => normalizeCanonItem(item)).filter((item): item is CanonItem => Boolean(item)),
    instructions: typeof row.instructions === 'string' ? row.instructions : null,
    createdAt: typeof row.createdAt === 'string' ? row.createdAt : new Date(0).toISOString(),
  };
}

export async function createCanonShare(share: { items: CanonItem[]; name: string; message: string; instructions: string | null }): Promise<CanonShare> {
  const { data, error } = await api.rpc('create_canon_share', {
    p_items: share.items.map(sharedCanonItem),
    p_name: share.name.trim() || null,
    p_message: share.message.trim() || null,
    p_instructions: share.instructions?.trim() || null,
  });
  if (error) throw new Error(error.message || 'Unable to share your canon.');
  return shareFromAccount(data);
}

export async function loadCanonShare(id: string): Promise<CanonShare> {
  const { data, error } = await api.rpc('get_canon_share', { p_id: id });
  if (error) throw new Error(error.message || 'Unable to open this shared canon.');
  return shareFromAccount(data);
}

export async function listMyCanonShares(): Promise<CanonShare[]> {
  const { data, error } = await api.rpc('list_my_canon_shares');
  if (error) throw new Error(error.message || 'Unable to load your shared links.');
  return (Array.isArray(data) ? data : []).map(shareFromAccount);
}

export async function deleteMyCanonShare(id: string): Promise<void> {
  const { error } = await api.rpc('delete_my_canon_share', { p_id: id });
  if (error) throw new Error(error.message || 'Unable to stop sharing.');
}
