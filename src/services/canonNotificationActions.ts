import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import {
  cancelCanonRemindersFor,
  CANON_ACTION_DONE,
  CANON_ACTION_SNOOZE,
  CANON_REMINDER_CATEGORY,
  CANON_SNOOZE_PREFIX,
} from '@/services/canonReminders';
import { LOCAL_NOTIFICATION_CHANNEL_ID } from '@/services/notificationService';

/**
 * The buttons on a canon reminder, held down on the lock screen or in the
 * notification list: Mark as done, and Remind me in an hour. Neither opens
 * the app.
 *
 * A press can reach the app three ways, and each is handled here, once:
 * - the app is running (in front or behind): the response listener;
 * - iOS started the app in the background for it, or Android has it waiting
 *   for the app's next start: the last response, read when this module loads;
 * - Android, with the app in the background or closed: the background task
 *   below, run headless (defined here, at the top of a module the entry file,
 *   index.ts, loads before anything else).
 *
 * "Remind me in an hour" schedules the reminder again at once. "Mark as done"
 * takes the task's other reminders away at once and records the tick in a
 * small queue on the device, which the canon (SpiritualCanonContext) applies
 * as soon as it is running — straight away when the app is, else when it next
 * opens — and from there sends to the account as any tick is.
 */
export const CANON_ACTION_TASK = 'cv-canon-notification-actions';
const QUEUE_KEY = 'cv-spiritual-canon-actions-v1';
const SNOOZE_MS = 60 * 60 * 1000;
/** Presses already handled, so one that arrives by two ways counts once. */
const HANDLED_KEPT = 60;

export interface CanonDoneAction {
  /** The canon it belongs to: "user-…", or "local". */
  identity: string;
  day: string;
  taskKey: string;
  /** When the button was pressed: the tick's own time, for merging with the account. */
  at: string;
}

interface ActionQueue {
  done: CanonDoneAction[];
  handled: string[];
}

interface ActionResponse {
  actionIdentifier: string;
  notification: {
    date: number;
    request: {
      identifier: string;
      content: { title: string | null; body: string | null; data: Record<string, unknown> | null };
    };
  };
}

// —— The queue on the device ——————————————————————————————————————————————

async function readQueue(): Promise<ActionQueue> {
  try {
    const FileSystem = await import('expo-file-system/legacy');
    const fileUri = `${FileSystem.documentDirectory}${QUEUE_KEY}.json`;
    const info = await FileSystem.getInfoAsync(fileUri);
    if (!info.exists) return { done: [], handled: [] };
    const parsed = JSON.parse(await FileSystem.readAsStringAsync(fileUri)) as Partial<ActionQueue>;
    return {
      done: Array.isArray(parsed.done) ? parsed.done.filter((entry) => typeof entry?.identity === 'string' && typeof entry?.day === 'string' && typeof entry?.taskKey === 'string' && typeof entry?.at === 'string') : [],
      handled: Array.isArray(parsed.handled) ? parsed.handled.filter((key): key is string => typeof key === 'string') : [],
    };
  } catch {
    return { done: [], handled: [] };
  }
}

async function writeQueue(queue: ActionQueue): Promise<void> {
  const FileSystem = await import('expo-file-system/legacy');
  await FileSystem.writeAsStringAsync(`${FileSystem.documentDirectory}${QUEUE_KEY}.json`, JSON.stringify(queue));
}

let queueTurn: Promise<unknown> = Promise.resolve();

/** One change to the queue at a time: a press and the canon taking ticks never interleave. */
function withQueue<T>(change: (queue: ActionQueue) => { queue: ActionQueue; result: T }): Promise<T> {
  const next = queueTurn.catch(() => undefined).then(async () => {
    const { queue, result } = change(await readQueue());
    await writeQueue(queue);
    return result;
  });
  queueTurn = next;
  return next;
}

/** The ticks pressed on notifications for a canon, taken off the queue for it to apply; others stay. */
export function takeCanonDoneActions(identity: string): Promise<CanonDoneAction[]> {
  if (Platform.OS === 'web') return Promise.resolve([]);
  return withQueue((queue) => ({
    queue: { ...queue, done: queue.done.filter((entry) => entry.identity !== identity) },
    result: queue.done.filter((entry) => entry.identity === identity),
  }));
}

const listeners = new Set<() => void>();

/** Called when a tick has been queued, so a running canon applies it at once. */
export function onCanonDoneAction(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

// —— A press ————————————————————————————————————————————————————————————

function responseKey(response: ActionResponse): string {
  return `${response.notification.request.identifier}|${response.actionIdentifier}|${response.notification.date}`;
}

async function snooze(response: ActionResponse, data: Record<string, unknown>): Promise<void> {
  const content = response.notification.request.content;
  const day = String(data.day ?? '');
  const taskKey = String(data.taskKey ?? '');
  await Notifications.scheduleNotificationAsync({
    // One put-off reminder per task and day: putting it off again replaces it.
    identifier: `${CANON_SNOOZE_PREFIX}${day}_${taskKey}`.replace(/[^A-Za-z0-9_]/g, '_'),
    content: {
      title: content.title ?? '',
      body: content.body ?? '',
      sound: 'default',
      categoryIdentifier: CANON_REMINDER_CATEGORY,
      data: { ...data, snoozed: true },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(Date.now() + SNOOZE_MS),
      channelId: LOCAL_NOTIFICATION_CHANNEL_ID,
    },
  });
}

/** Handles a press on a canon reminder's button; anything else is left alone. Returns whether it acted. */
export async function handleCanonNotificationAction(response: ActionResponse): Promise<boolean> {
  const data = response.notification.request.content.data ?? {};
  const action = response.actionIdentifier;
  if (data.canon !== true || (action !== CANON_ACTION_DONE && action !== CANON_ACTION_SNOOZE)) return false;
  const identity = typeof data.identity === 'string' ? data.identity : 'local';
  const day = typeof data.day === 'string' ? data.day : null;
  const taskKey = typeof data.taskKey === 'string' ? data.taskKey : null;
  if (!day || !taskKey) return false;

  const key = responseKey(response);
  const fresh = await withQueue((queue) => {
    if (queue.handled.includes(key)) return { queue, result: false };
    const handled = [...queue.handled, key].slice(-HANDLED_KEPT);
    const done = action === CANON_ACTION_DONE
      ? [...queue.done, { identity, day, taskKey, at: new Date().toISOString() }]
      : queue.done;
    return { queue: { handled, done }, result: true };
  });
  if (!fresh) return false;

  // Android leaves a notification in place when one of its buttons is pressed.
  await Notifications.dismissNotificationAsync(response.notification.request.identifier).catch(() => undefined);
  if (action === CANON_ACTION_SNOOZE) {
    await snooze(response, data);
  } else {
    await cancelCanonRemindersFor(day, taskKey).catch(() => undefined);
    listeners.forEach((listener) => listener());
  }
  return true;
}

/** The buttons, in the App Language: registered each time the app starts, and again when the language changes. */
export async function registerCanonNotificationActions(labels: { done: string; snooze: string }): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.setNotificationCategoryAsync(CANON_REMINDER_CATEGORY, [
    { identifier: CANON_ACTION_DONE, buttonTitle: labels.done, options: { opensAppToForeground: false } },
    { identifier: CANON_ACTION_SNOOZE, buttonTitle: labels.snooze, options: { opensAppToForeground: false } },
  ]);
  // Android runs the task below for a button pressed with the app in the background or closed.
  if (Platform.OS === 'android' && !(await TaskManager.isTaskRegisteredAsync(CANON_ACTION_TASK))) {
    await Notifications.registerTaskAsync(CANON_ACTION_TASK);
  }
}

// —— At load: the background task, the listener, the press that started the app ——

if (Platform.OS !== 'web') {
  TaskManager.defineTask(CANON_ACTION_TASK, async ({ data, error }) => {
    if (error || !data || typeof data !== 'object' || !('actionIdentifier' in data)) return;
    await handleCanonNotificationAction(data as unknown as ActionResponse).catch((cause) => {
      console.warn('Unable to handle a canon reminder button:', cause);
    });
  });

  Notifications.addNotificationResponseReceivedListener((response) => {
    void handleCanonNotificationAction(response as unknown as ActionResponse).catch((cause) => {
      console.warn('Unable to handle a canon reminder button:', cause);
    });
  });

  void Notifications.getLastNotificationResponseAsync()
    .then((response) => (response ? handleCanonNotificationAction(response as unknown as ActionResponse) : false))
    .catch(() => undefined);
}
