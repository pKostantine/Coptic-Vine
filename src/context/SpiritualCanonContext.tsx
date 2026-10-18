import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { canonReminderText } from '@/components/canon/canonText';
import { useAuth } from '@/context/AuthContext';
import { useReadingPreferences } from '@/context/ReadingPreferencesContext';
import { tr } from '@/utils/appText';
import { readCanonCalendarDay } from '@/services/canonCalendar';
import { onCanonDoneAction, registerCanonNotificationActions, takeCanonDoneActions } from '@/services/canonNotificationActions';
import {
  cancelCanonRemindersFor,
  clearCanonReminders,
  scheduleCanonReminders,
} from '@/services/canonReminders';
import { localNotificationPermission, type LocalNotificationPermission } from '@/services/notificationService';
import {
  clearLocalCanon,
  loadCanonCalendarCache,
  loadCanonRemindersEnabled,
  loadCloudCanon,
  loadCloudCanonDays,
  loadCloudCanonDefinition,
  loadLocalCanon,
  saveCanonCalendarCache,
  saveCanonRemindersEnabled,
  saveCloudCanonDays,
  saveCloudCanonDefinition,
  saveLocalCanon,
  type CachedCanonCalendarDay,
} from '@/services/spiritualCanonService';
import {
  addCanonDays,
  canonDayKey,
  canonDefinitionSignature,
  canonHasReminders,
  canonTaskRoute,
  canonTasksForDay,
  canonWeekStart,
  canonNeedsCalendar,
  canonSkippedTasksForDay,
  changedCanonDays,
  emptyCanonDocument,
  mergeCanonDayMarks,
  mergeCanonDocuments,
  pruneCanonDays,
  REMINDER_HORIZON_DAYS,
  upcomingCanonReminders,
  withCanonItem,
  withCanonMark,
  withCanonSkip,
  withoutCanonItem,
  type CanonCalendar,
  type CanonDayMarks,
  type CanonDocument,
  type CanonItem,
  type CanonTask,
} from '@/utils/spiritualCanon';

/** How far back the account's marks are read: the weeks the canon shows. */
const CLOUD_DAYS_BACK = 42;
const CLOUD_SAVE_DELAY_MS = 800;
/** How long what the calendar said of a day is trusted before it is read again. */
const CALENDAR_FRESH_MS = 7 * 24 * 60 * 60 * 1000;
/** The days of the calendar the canon keeps: the weeks either side of today. */
const CALENDAR_DAYS_KEPT = 60;
const REMINDER_DELAY_MS = 600;

interface SpiritualCanonValue {
  /** The canon of whoever is signed in (or of no one) has been read. */
  loaded: boolean;
  signedIn: boolean;
  items: CanonItem[];
  /** The device's calendar day, "YYYY-MM-DD"; it turns at midnight. */
  today: string;
  tasksFor: (day: string) => CanonTask[];
  /** Reads from the calendar whether metanias are made on these days (the week the canon page shows). */
  ensureCalendarDays: (days: string[]) => void;
  /** Ticks a task off for a day, or unticks it. A day still to come can't be ticked. */
  setTaskDone: (day: string, key: string, done: boolean) => void;
  /** The tasks taken off a day's list, to be put back. */
  skippedFor: (day: string) => CanonTask[];
  /** Takes a task off one day's list (any day, ahead too), or puts it back. */
  setTaskSkipped: (day: string, key: string, skipped: boolean) => void;
  /** How much of the Agpeya the calendar keeps on a day: all of it, the First, Third and Sixth Hours only (Palm Sunday), or none (Holy Week). */
  agpeyaOn: (day: string) => 'all' | 'beforeEve' | 'none';
  saveItem: (item: CanonItem) => void;
  deleteItem: (id: string) => void;
  /** This device's own choice to show the canon's reminders. */
  remindersEnabled: boolean;
  setRemindersEnabled: (enabled: boolean) => void;
  reminderPermission: LocalNotificationPermission;
  requestReminderPermission: () => Promise<LocalNotificationPermission>;
  /** The account's copy couldn't be reached last time; the device's is kept and sent later. */
  syncFailed: boolean;
}

const SpiritualCanonContext = createContext<SpiritualCanonValue | null>(null);

interface CanonState {
  identity: string | null;
  document: CanonDocument;
}

const EMPTY_DOCUMENT = emptyCanonDocument();

function identityOf(userId: string | null | undefined): string {
  return userId ? `user-${userId}` : 'local';
}

/**
 * The spiritual canon (utils/spiritualCanon.ts): kept on the device, and —
 * when signed in — merged with and saved back to the account's copy, so the
 * canon and its ticks follow the believer to every device; each device
 * schedules the reminders from it.
 */
export function SpiritualCanonProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { preferences } = useReadingPreferences();
  const userId = user?.id ?? null;
  const identity = identityOf(userId);
  const [state, setState] = useState<CanonState>({ identity: null, document: EMPTY_DOCUMENT });
  const [today, setToday] = useState(() => canonDayKey(new Date()));
  const [syncFailed, setSyncFailed] = useState(false);
  const [remindersEnabled, setRemindersEnabledState] = useState(true);
  const [reminderPermission, setReminderPermission] = useState<LocalNotificationPermission>('undetermined');
  // Bumped when the app comes back, so the reminders' fortnight rolls forward.
  const [foregroundTick, setForegroundTick] = useState(0);
  // Bumped to send what is waiting for the account again (after it couldn't be reached).
  const [retryTick, setRetryTick] = useState(0);
  // The days metanias are made (canonCalendar.ts), as the calendar has been read so far.
  // What the calendar says of each day (canonCalendar.ts), as read so far.
  const [calendarDays, setCalendarDays] = useState<Record<string, CachedCanonCalendarDay>>({});
  const [calendarCacheRead, setCalendarCacheRead] = useState(false);
  const calendarRequested = useRef(new Set<string>());
  const calendarDaysRef = useRef(calendarDays);
  useEffect(() => {
    calendarDaysRef.current = calendarDays;
  }, [calendarDays]);

  const loaded = state.identity === identity;
  const document = loaded ? state.document : EMPTY_DOCUMENT;

  // What changed here and has still to reach the account.
  const dirtyDefinition = useRef(false);
  const dirtyDays = useRef(new Set<string>());
  const latest = useRef<CanonState>(state);
  useEffect(() => {
    latest.current = state;
  }, [state]);

  /** Folds the account's copy into this one, without marking anything to send. */
  const absorb = useCallback((forIdentity: string, cloud: Partial<CanonDocument>) => {
    setState((current) => {
      if (current.identity !== forIdentity) return current;
      const merged = mergeCanonDocuments(current.document, {
        ...emptyCanonDocument(),
        ...cloud,
        items: cloud.items ?? current.document.items,
        itemDeletions: cloud.itemDeletions ?? current.document.itemDeletions,
      });
      const same = canonDefinitionSignature(merged) === canonDefinitionSignature(current.document)
        && !changedCanonDays(merged.days, current.document.days).length;
      return same ? current : { identity: forIdentity, document: merged };
    });
  }, []);

  // The day turns at midnight, and is checked again whenever the app comes back.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const now = new Date();
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
      timer = setTimeout(() => {
        setToday(canonDayKey(new Date()));
        schedule();
      }, midnight.getTime() - now.getTime());
    };
    schedule();
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      setToday(canonDayKey(new Date()));
      setForegroundTick((tick) => tick + 1);
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    let active = true;
    void loadCanonRemindersEnabled().then((enabled) => { if (active) setRemindersEnabledState(enabled); });
    // What the calendar said last time, until it is read again.
    void loadCanonCalendarCache().then((cached) => {
      if (!active) return;
      setCalendarDays((current) => ({ ...cached, ...current }));
      setCalendarCacheRead(true);
    });
    return () => { active = false; };
  }, []);

  // A day read in the last week is taken as read; the others are read once a
  // session (one that could not be read is tried again later).
  const ensureCalendarDays = useCallback((days: string[]) => {
    const now = Date.now();
    for (const day of days) {
      if (calendarRequested.current.has(day)) continue;
      const cached = calendarDaysRef.current[day];
      if (cached && now - Date.parse(cached.readAt) < CALENDAR_FRESH_MS) continue;
      calendarRequested.current.add(day);
      readCanonCalendarDay(day)
        .then((read) => setCalendarDays((current) => ({ ...current, [day]: { ...read, readAt: new Date().toISOString() } })))
        .catch(() => { calendarRequested.current.delete(day); });
    }
  }, []);
  const calendar = useMemo<CanonCalendar>(() => ({ calendarDay: (day) => calendarDays[day] ?? null }), [calendarDays]);

  // Metanias kept on the days they are made need the calendar: the weeks the
  // Home card, the canon page and the reminders look at.
  const keepsApplicableDays = canonNeedsCalendar(document.items);
  useEffect(() => {
    if (!loaded || !keepsApplicableDays || !calendarCacheRead) return;
    const from = addCanonDays(canonWeekStart(today), -7);
    const to = addCanonDays(today, REMINDER_HORIZON_DAYS);
    const days: string[] = [];
    for (let day = from; day <= to; day = addCanonDays(day, 1)) days.push(day);
    ensureCalendarDays(days);
  }, [calendarCacheRead, ensureCalendarDays, foregroundTick, keepsApplicableDays, loaded, today]);

  useEffect(() => {
    if (!Object.keys(calendarDays).length) return undefined;
    const timer = setTimeout(() => {
      const oldest = addCanonDays(today, -CALENDAR_DAYS_KEPT);
      const newest = addCanonDays(today, CALENDAR_DAYS_KEPT);
      void saveCanonCalendarCache(Object.fromEntries(Object.entries(calendarDays).filter(([day]) => day >= oldest && day <= newest)));
    }, 1000);
    return () => clearTimeout(timer);
  }, [calendarDays, today]);

  useEffect(() => {
    let active = true;
    void localNotificationPermission(false)
      .then((permission) => { if (active) setReminderPermission(permission); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [foregroundTick]);

  // Reads the canon of whoever is signed in: the device's copy, then — signed
  // in — the account's, merged. A canon set down signed out goes into the
  // account that signs in next.
  useEffect(() => {
    if (authLoading) return undefined;
    let cancelled = false;
    dirtyDefinition.current = false;
    dirtyDays.current = new Set();
    const load = async () => {
      let document = await loadLocalCanon(identity);
      // Ticks pressed on a reminder while this canon wasn't running
      // (canonNotificationActions.ts): applied first, and sent with the rest.
      for (const action of await takeCanonDoneActions(identity)) {
        document = withCanonMark(document, action.day, action.taskKey, true, new Date(action.at));
        dirtyDays.current.add(action.day);
      }
      let adopted = false;
      if (userId) {
        const signedOut = await loadLocalCanon('local');
        if (signedOut.items.length || Object.keys(signedOut.days).length) {
          document = mergeCanonDocuments(document, signedOut);
          adopted = true;
        }
        try {
          const cloud = await loadCloudCanon(addCanonDays(canonDayKey(new Date()), -CLOUD_DAYS_BACK));
          const merged = cloud ? mergeCanonDocuments(document, cloud) : document;
          if (!cloud || canonDefinitionSignature(merged) !== canonDefinitionSignature(cloud)) {
            await saveCloudCanonDefinition(userId, merged);
          }
          const days = changedCanonDays(merged.days, cloud?.days ?? {});
          if (days.length) await saveCloudCanonDays(userId, Object.fromEntries(days.map((day) => [day, merged.days[day]])));
          document = merged;
          if (adopted) await clearLocalCanon('local');
          if (!cancelled) setSyncFailed(false);
        } catch (error) {
          console.warn('Unable to synchronize the spiritual canon:', error);
          // Sent once the account can be reached.
          dirtyDefinition.current = true;
          Object.keys(document.days).forEach((day) => dirtyDays.current.add(day));
          if (!cancelled) setSyncFailed(true);
        }
      }
      if (cancelled) return;
      await saveLocalCanon(identity, document);
      setState({ identity, document });
    };
    void load();
    return () => { cancelled = true; };
  }, [authLoading, identity, userId]);

  // Coming back to the app, the account's copy may have moved on (another device).
  useEffect(() => {
    if (!foregroundTick || !userId || latest.current.identity !== identity) return undefined;
    let cancelled = false;
    void loadCloudCanon(addCanonDays(canonDayKey(new Date()), -CLOUD_DAYS_BACK))
      .then((cloud) => {
        if (cancelled || !cloud) return;
        const current = latest.current.document;
        if (canonDefinitionSignature(mergeCanonDocuments(current, cloud)) !== canonDefinitionSignature(cloud)) dirtyDefinition.current = true;
        changedCanonDays(current.days, cloud.days).forEach((day) => {
          if (JSON.stringify(mergeCanonDayMarks(current.days[day], cloud.days[day])) !== JSON.stringify(cloud.days[day] ?? {})) dirtyDays.current.add(day);
        });
        absorb(identity, cloud);
        setSyncFailed(false);
        if (dirtyDefinition.current || dirtyDays.current.size) setRetryTick((tick) => tick + 1);
      })
      .catch((error) => console.warn('Unable to refresh the spiritual canon:', error));
    return () => { cancelled = true; };
  }, [absorb, foregroundTick, identity, userId]);

  // A reminder's "Mark as done", pressed while this canon is running (or, on
  // Android, while the app was in the background, which a separate headless
  // run handled): applied as a tick of its own time, and sent to the account.
  useEffect(() => {
    if (!loaded) return undefined;
    let active = true;
    const apply = () => {
      void takeCanonDoneActions(identity).then((actions) => {
        if (!active || !actions.length) return;
        actions.forEach((action) => dirtyDays.current.add(action.day));
        setState((current) => {
          if (current.identity !== identity) return current;
          const document = actions.reduce((doc, action) => withCanonMark(doc, action.day, action.taskKey, true, new Date(action.at)), current.document);
          return { ...current, document };
        });
      }).catch(() => undefined);
    };
    apply();
    const unsubscribe = onCanonDoneAction(apply);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [foregroundTick, identity, loaded]);

  // The reminders' buttons, in the App Language.
  const buttonLanguage = preferences.appLanguage;
  useEffect(() => {
    void registerCanonNotificationActions({
      done: tr('Mark as done', 'Marquer comme accompli', 'علّم كمكتمل', buttonLanguage),
      snooze: tr('Remind me in an hour', 'Me le rappeler dans une heure', 'ذكّرني بعد ساعة', buttonLanguage),
    }).catch((error) => console.warn('Unable to set up the canon reminder buttons:', error));
  }, [buttonLanguage]);

  // Every change is kept on the device at once and sent to the account a
  // moment later, merged with whatever the account has by then.
  useEffect(() => {
    if (!loaded) return undefined;
    void saveLocalCanon(identity, { ...document, days: pruneCanonDays(document.days, today) });
    if (!userId || (!dirtyDefinition.current && !dirtyDays.current.size)) return undefined;
    const timer = setTimeout(() => {
      const sendDefinition = dirtyDefinition.current;
      const days = [...dirtyDays.current];
      dirtyDefinition.current = false;
      dirtyDays.current = new Set();
      const send = async () => {
        const current = latest.current.document;
        if (sendDefinition) {
          const cloud = await loadCloudCanonDefinition();
          const merged = cloud ? mergeCanonDocuments(current, { ...emptyCanonDocument(), ...cloud }) : current;
          await saveCloudCanonDefinition(userId, merged);
          if (cloud) absorb(identity, { items: merged.items, itemDeletions: merged.itemDeletions });
        }
        if (days.length) {
          const cloudDays = await loadCloudCanonDays(days);
          const merged: Record<string, CanonDayMarks> = Object.fromEntries(days.map((day) => [day, mergeCanonDayMarks(current.days[day], cloudDays[day])]));
          await saveCloudCanonDays(userId, merged);
          absorb(identity, { days: merged });
        }
      };
      send()
        .then(() => setSyncFailed(false))
        .catch((error) => {
          console.warn('Unable to save the spiritual canon:', error);
          if (sendDefinition) dirtyDefinition.current = true;
          days.forEach((day) => dirtyDays.current.add(day));
          setSyncFailed(true);
        });
    }, CLOUD_SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [absorb, document, identity, loaded, retryTick, today, userId]);

  // The reminders follow the canon: rescheduled when it, its ticks, the day,
  // the language or this device's choice changes, and when the app comes back.
  const language = preferences.appLanguage;
  useEffect(() => {
    if (!loaded) return undefined;
    const timer = setTimeout(() => {
      if (!remindersEnabled || !canonHasReminders(document.items)) {
        void clearCanonReminders().catch(() => undefined);
        return;
      }
      const occurrences = upcomingCanonReminders(document, new Date(), { calendar });
      void scheduleCanonReminders(occurrences, (occurrence) => ({
        ...canonReminderText(occurrence.task),
        deepLink: canonTaskRoute(occurrence.task),
      }), identity)
        .then((result) => {
          if (result === 'permission_required') setReminderPermission((current) => (current === 'granted' ? 'undetermined' : current));
        })
        .catch((error) => console.warn('Unable to schedule the spiritual canon’s reminders:', error));
    }, REMINDER_DELAY_MS);
    return () => clearTimeout(timer);
  }, [calendar, document, foregroundTick, identity, language, loaded, remindersEnabled, reminderPermission, today]);

  const setTaskDone = useCallback((day: string, key: string, done: boolean) => {
    if (day > canonDayKey(new Date())) return;
    dirtyDays.current.add(day);
    if (done) void cancelCanonRemindersFor(day, key).catch(() => undefined);
    setState((current) => (current.identity ? { ...current, document: withCanonMark(current.document, day, key, done) } : current));
  }, []);

  const saveItem = useCallback((item: CanonItem) => {
    dirtyDefinition.current = true;
    setState((current) => (current.identity ? { ...current, document: withCanonItem(current.document, item) } : current));
  }, []);

  const deleteItem = useCallback((id: string) => {
    dirtyDefinition.current = true;
    setState((current) => (current.identity ? { ...current, document: withoutCanonItem(current.document, id) } : current));
  }, []);

  const setRemindersEnabled = useCallback((enabled: boolean) => {
    setRemindersEnabledState(enabled);
    void saveCanonRemindersEnabled(enabled);
  }, []);

  const requestReminderPermission = useCallback(async () => {
    const permission = await localNotificationPermission(true).catch(() => 'unsupported' as const);
    setReminderPermission(permission);
    return permission;
  }, []);

  const setTaskSkipped = useCallback((day: string, key: string, skipped: boolean) => {
    dirtyDays.current.add(day);
    // A task skipped is not reminded of that day.
    if (skipped) void cancelCanonRemindersFor(day, key).catch(() => undefined);
    setState((current) => (current.identity ? { ...current, document: withCanonSkip(current.document, day, key, skipped) } : current));
  }, []);

  const tasksFor = useCallback((day: string) => canonTasksForDay(document, day, calendar), [calendar, document]);
  const skippedFor = useCallback((day: string) => canonSkippedTasksForDay(document, day, calendar), [calendar, document]);
  const agpeyaOn = useCallback((day: string) => calendar.calendarDay(day)?.agpeya ?? 'all', [calendar]);

  const value = useMemo<SpiritualCanonValue>(() => ({
    loaded,
    signedIn: Boolean(userId),
    items: document.items,
    today,
    tasksFor,
    ensureCalendarDays,
    setTaskDone,
    skippedFor,
    setTaskSkipped,
    agpeyaOn,
    saveItem,
    deleteItem,
    remindersEnabled,
    setRemindersEnabled,
    reminderPermission,
    requestReminderPermission,
    syncFailed,
  }), [agpeyaOn, deleteItem, document.items, ensureCalendarDays, loaded, setTaskSkipped, skippedFor, reminderPermission, remindersEnabled, requestReminderPermission, saveItem, setRemindersEnabled, setTaskDone, syncFailed, tasksFor, today, userId]);

  return <SpiritualCanonContext.Provider value={value}>{children}</SpiritualCanonContext.Provider>;
}

export function useSpiritualCanon(): SpiritualCanonValue {
  const value = useContext(SpiritualCanonContext);
  if (!value) throw new Error('useSpiritualCanon must be used within SpiritualCanonProvider');
  return value;
}
