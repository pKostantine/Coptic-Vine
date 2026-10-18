/**
 * The web has no canon reminders (canonReminders.ts schedules none there), so
 * no buttons on them either: the same API, doing nothing.
 */
export const CANON_ACTION_TASK = 'cv-canon-notification-actions';

export interface CanonDoneAction {
  identity: string;
  day: string;
  taskKey: string;
  at: string;
}

export function takeCanonDoneActions(_identity: string): Promise<CanonDoneAction[]> {
  return Promise.resolve([]);
}

export function onCanonDoneAction(_listener: () => void): () => void {
  return () => undefined;
}

export async function handleCanonNotificationAction(_response: unknown): Promise<boolean> {
  return false;
}

export async function registerCanonNotificationActions(_labels: { done: string; snooze: string }): Promise<void> {
  // Nothing to register on the web.
}
