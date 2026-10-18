import { Platform } from 'react-native';

import { LOCAL_NOTIFICATION_CHANNEL_ID } from '@/services/notificationService';
import type { CanonReminderOccurrence } from '@/utils/spiritualCanon';

/**
 * The spiritual canon's reminders, as the device's own scheduled
 * notifications. Each device schedules them from the canon it has (the
 * account's, synced), a fortnight ahead: a task already done today, or kept a
 * number of times a week and done enough, is not reminded of. They are
 * rescheduled whenever the canon or its marks change, and when the app comes
 * back, so the fortnight keeps rolling forward.
 *
 * Only the canon's are touched: theirs are the identifiers that begin
 * `canon_` (utils/spiritualCanon.ts, upcomingCanonReminders).
 */
const PREFIX = 'canon_';

export interface CanonReminderContent {
  title: string;
  body: string;
  /** The page the notification opens (the runtime in notificationService follows `deep_link`). */
  deepLink: string;
}

let queue: Promise<unknown> = Promise.resolve();

/** One reschedule at a time: each waits for the one before, so two never interleave their cancels and adds. */
function serial<T>(work: () => Promise<T>): Promise<T> {
  const next = queue.catch(() => undefined).then(work);
  queue = next;
  return next;
}

export type CanonReminderResult = 'scheduled' | 'permission_required' | 'unsupported';

export function scheduleCanonReminders(
  occurrences: CanonReminderOccurrence[],
  describe: (occurrence: CanonReminderOccurrence) => CanonReminderContent,
): Promise<CanonReminderResult> {
  if (Platform.OS === 'web') return Promise.resolve('unsupported');
  return serial(async () => {
    const Notifications = await import('expo-notifications');
    const permission = await Notifications.getPermissionsAsync();
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const ours = scheduled.filter((request) => request.identifier.startsWith(PREFIX));
    if (!permission.granted) {
      await Promise.all(ours.map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier)));
      return 'permission_required';
    }

    const wanted = new Map(occurrences.map((occurrence) => {
      const content = describe(occurrence);
      // What the notification says and when: a change to either schedules it afresh.
      const signature = `${occurrence.at.getTime()}|${content.title}|${content.body}|${content.deepLink}`;
      return [occurrence.identifier, { occurrence, content, signature }] as const;
    }));

    const kept = new Set<string>();
    for (const request of ours) {
      const want = wanted.get(request.identifier);
      const signature = (request.content.data as Record<string, unknown> | undefined)?.signature;
      if (want && signature === want.signature) {
        kept.add(request.identifier);
        continue;
      }
      await Notifications.cancelScheduledNotificationAsync(request.identifier);
    }

    for (const [identifier, { occurrence, content, signature }] of wanted) {
      if (kept.has(identifier)) continue;
      await Notifications.scheduleNotificationAsync({
        identifier,
        content: {
          title: content.title,
          body: content.body,
          sound: 'default',
          data: { deep_link: content.deepLink, canon: true, taskKey: occurrence.task.key, day: occurrence.day, signature },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: occurrence.at,
          channelId: LOCAL_NOTIFICATION_CHANNEL_ID,
        },
      });
    }
    return 'scheduled';
  });
}

/** Takes every canon reminder off this device: reminders turned off here, or no one signed in to the canon that set them. */
export function clearCanonReminders(): Promise<void> {
  if (Platform.OS === 'web') return Promise.resolve();
  return serial(async () => {
    const Notifications = await import('expo-notifications');
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(scheduled
      .filter((request) => request.identifier.startsWith(PREFIX))
      .map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier)));
  });
}

/** A reminder for a task just ticked off goes at once, rather than waiting for the next reschedule. */
export function cancelCanonRemindersFor(day: string, taskKey: string): Promise<void> {
  if (Platform.OS === 'web') return Promise.resolve();
  return serial(async () => {
    const Notifications = await import('expo-notifications');
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(scheduled
      .filter((request) => {
        const data = request.content.data as Record<string, unknown> | undefined;
        return request.identifier.startsWith(PREFIX) && data?.day === day && data?.taskKey === taskKey;
      })
      .map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier)));
  });
}
