import { Platform } from 'react-native';

import {
  emptyCanonDocument,
  type CanonCalendarDay,
  isAbstinenceFast,
  normalizeCanonDayMarks,
  normalizeCanonDocument,
  normalizeCanonItem,
  type CanonDayMarks,
  type CanonDocument,
  type CanonItem,
} from '@/utils/spiritualCanon';
import { api } from '@/utils/api';
import { getCurrentAppLanguage, type AppLanguage } from '@/utils/preferencesStorage';
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

// ─── Support people ─────────────────────────────────────────────────────────

/**
 * An invite link a believer sends to the friends, the support group, who keep
 * them in prayer (cv-api's create_canon_support_invite and the rest,
 * workers/api/src/rpc/canonSupport.ts). Anyone who accepts it while signed in
 * becomes one of their support people and sees their canon and its ticks in
 * their own app, until the believer removes them or they stop.
 */
export interface CanonSupportInvite {
  id: string;
  sharerName: string | null;
  message: string | null;
  withInstructions: boolean;
  createdAt: string;
}

/** An invite as whoever opens its link reads it: whether it is their own, and whether they already support its maker. */
export interface CanonSupportInviteView extends CanonSupportInvite {
  own: boolean;
  supporting: string | null;
}

/** One of the believer's support people, or someone the account supports. */
export interface CanonSupportPerson {
  id: string;
  name: string;
  withInstructions: boolean;
  since: string;
}

/** The canon of someone the account supports: as it is now, with its marks for the days read. */
export interface SupportedCanon {
  id: string;
  name: string;
  items: CanonItem[];
  days: Record<string, CanonDayMarks>;
  instructions: string | null;
}

/**
 * The invite link, to send. It carries the sharer's App Language, so the
 * preview a chat shows of it (workers/web-app) speaks as they do.
 */
export function canonInviteUrl(id: string, language: AppLanguage = getCurrentAppLanguage()): string {
  const path = `/canon/invite/${encodeURIComponent(id)}`;
  return publicUrl(language === 'en' ? path : `${path}?lang=${language}`);
}

function record(data: unknown): Record<string, unknown> {
  return (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
}

function inviteFromAccount(data: unknown): CanonSupportInviteView {
  const row = record(data);
  return {
    id: String(row.id ?? ''),
    sharerName: typeof row.sharerName === 'string' && row.sharerName.trim() ? row.sharerName : null,
    message: typeof row.message === 'string' && row.message.trim() ? row.message : null,
    withInstructions: row.withInstructions === true,
    createdAt: typeof row.createdAt === 'string' ? row.createdAt : new Date(0).toISOString(),
    own: row.own === true,
    supporting: typeof row.supporting === 'string' ? row.supporting : null,
  };
}

function personFromAccount(data: unknown): CanonSupportPerson {
  const row = record(data);
  return {
    id: String(row.id ?? ''),
    name: typeof row.name === 'string' ? row.name : '',
    withInstructions: row.withInstructions === true,
    since: typeof row.since === 'string' ? row.since : new Date(0).toISOString(),
  };
}

function list<T>(data: unknown, each: (row: unknown) => T): T[] {
  return (Array.isArray(data) ? data : []).map(each);
}

export async function createCanonSupportInvite(invite: { name: string; message: string; withInstructions: boolean }): Promise<CanonSupportInvite> {
  const { data, error } = await api.rpc('create_canon_support_invite', {
    p_name: invite.name.trim() || null,
    p_message: invite.message.trim() || null,
    p_with_instructions: invite.withInstructions,
  });
  if (error) throw new Error(error.message || 'Unable to make the invite link.');
  return inviteFromAccount(data);
}

export async function listMyCanonSupportInvites(): Promise<CanonSupportInvite[]> {
  const { data, error } = await api.rpc('list_my_canon_support_invites');
  if (error) throw new Error(error.message || 'Unable to load your invite links.');
  return list(data, inviteFromAccount);
}

export async function deleteMyCanonSupportInvite(id: string): Promise<void> {
  const { error } = await api.rpc('delete_my_canon_support_invite', { p_id: id });
  if (error) throw new Error(error.message || 'Unable to turn the link off.');
}

export async function loadCanonSupportInvite(id: string): Promise<CanonSupportInviteView> {
  const { data, error } = await api.rpc('get_canon_support_invite', { p_id: id });
  if (error) throw new Error(error.message || 'Unable to open this invite.');
  return inviteFromAccount(data);
}

export async function acceptCanonSupportInvite(id: string): Promise<CanonSupportPerson> {
  const { data, error } = await api.rpc('accept_canon_support_invite', { p_id: id });
  if (error) throw new Error(error.message || 'Unable to accept the invite.');
  return personFromAccount(data);
}

export async function listMyCanonSupporters(): Promise<CanonSupportPerson[]> {
  const { data, error } = await api.rpc('list_my_canon_supporters');
  if (error) throw new Error(error.message || 'Unable to load your support people.');
  return list(data, personFromAccount);
}

export async function removeMyCanonSupporter(id: string): Promise<void> {
  const { error } = await api.rpc('remove_my_canon_supporter', { p_id: id });
  if (error) throw new Error(error.message || 'Unable to remove them.');
}

export async function listCanonsISupport(): Promise<CanonSupportPerson[]> {
  const { data, error } = await api.rpc('list_canons_i_support');
  if (error) throw new Error(error.message || 'Unable to load those you support.');
  return list(data, personFromAccount);
}

export async function stopSupportingCanon(id: string): Promise<void> {
  const { error } = await api.rpc('stop_supporting_canon', { p_id: id });
  if (error) throw new Error(error.message || 'Unable to stop supporting.');
}

/** Their canon with its marks from one day to another (a week, as the page shows it). */
export async function loadSupportedCanon(id: string, fromDay: string, toDay: string): Promise<SupportedCanon> {
  const { data, error } = await api.rpc('get_supported_canon', { p_id: id, p_from_day: fromDay, p_to_day: toDay });
  if (error) throw new Error(error.message || 'Unable to open their canon.');
  const row = record(data);
  const days = record(row.days);
  return {
    id: String(row.id ?? id),
    name: typeof row.name === 'string' ? row.name : '',
    items: list(row.items, normalizeCanonItem).filter((item): item is CanonItem => Boolean(item)),
    days: Object.fromEntries(Object.entries(days).map(([day, marks]) => [day, normalizeCanonDayMarks(marks)])),
    instructions: typeof row.instructions === 'string' && row.instructions.trim() ? row.instructions : null,
  };
}
