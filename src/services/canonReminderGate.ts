/**
 * Whether a canon reminder is still wanted as it comes due: not for a task
 * already ticked off or skipped that day, nor one no longer in the canon.
 * The canon (context/SpiritualCanonContext.tsx) says which tasks are still
 * open; the notification handler asks before showing a reminder that comes
 * while the app is open (services/notificationService.ts), and the
 * rescheduling asks before keeping one put off an hour
 * (services/canonReminders.ts). Kept apart from both, which import each
 * other's neighbours, so neither needs the other.
 */
type OpenTask = (day: string, taskKey: string, identity: string) => boolean;

let openTask: OpenTask | null = null;

/** The canon running now says which of its tasks are still open; null when none is. */
export function setCanonOpenTaskCheck(check: OpenTask | null): void {
  openTask = check;
}

/**
 * A canon reminder's data, as scheduled: false when its task is done,
 * skipped or gone from the canon it belongs to. Anything else, or with no
 * canon running to ask, it stands.
 */
export function canonReminderStillWanted(data: Record<string, unknown> | undefined | null): boolean {
  if (!data || data.canon !== true || !openTask) return true;
  const { day, taskKey, identity } = data;
  if (typeof day !== 'string' || typeof taskKey !== 'string' || typeof identity !== 'string') return true;
  return openTask(day, taskKey, identity);
}
