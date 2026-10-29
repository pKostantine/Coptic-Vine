/**
 * The beta's feedback (app/feedback.tsx, cv-api's src/rpc/feedback.ts): what
 * testers report as they test the app, numbered as issues are and public.
 * Temporary, for the beta.
 */

export type FeedbackKind = 'bug' | 'idea' | 'text';
export type FeedbackStatus = 'open' | 'planned' | 'fixed' | 'not_planned' | 'duplicate';
export type FeedbackFilter = 'open' | 'done' | 'all';

export const FEEDBACK_KINDS: FeedbackKind[] = ['bug', 'idea', 'text'];
export const FEEDBACK_STATUSES: FeedbackStatus[] = ['open', 'planned', 'fixed', 'not_planned', 'duplicate'];

/** The longest each field may be, as cv-api checks them. */
export const FEEDBACK_LIMITS = { title: 120, details: 4000, area: 120, name: 80, note: 500 } as const;

export interface FeedbackItem {
  id: string;
  number: number;
  kind: FeedbackKind;
  title: string;
  details: string;
  area: string | null;
  device: string | null;
  reporterName: string | null;
  status: FeedbackStatus;
  statusNote: string | null;
  createdAt: string;
  updatedAt: string;
  /** Filed by whoever is reading. */
  mine: boolean;
}

/** Whether it still waits to be dealt with: open, or planned. */
export function isOpenFeedback(item: Pick<FeedbackItem, 'status'>): boolean {
  return item.status === 'open' || item.status === 'planned';
}

/** The items a filter shows, as they came (the latest first). */
export function filterFeedback<T extends Pick<FeedbackItem, 'status'>>(items: T[], filter: FeedbackFilter): T[] {
  if (filter === 'all') return items;
  return items.filter((item) => isOpenFeedback(item) === (filter === 'open'));
}

const BROWSERS: [RegExp, string][] = [
  [/Edg\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/Firefox\//, 'Firefox'],
  [/Chrome\//, 'Chrome'],
  [/Safari\//, 'Safari'],
];

/**
 * The device it was seen on, filed with it: "iOS 27.1 · app 1.0.0",
 * "Android 15 · app 1.0.0", "Web · Safari on iPhone · app 1.0.0".
 */
export function describeDevice({ os, version, appVersion, userAgent }: { os: string; version?: string | number | null; appVersion?: string | null; userAgent?: string | null }): string {
  let system: string;
  if (os === 'ios') system = `iOS ${version ?? ''}`.trim();
  else if (os === 'android') system = `Android${typeof version === 'number' ? ` (API ${version})` : version ? ` ${version}` : ''}`;
  else if (os === 'web') {
    const agent = userAgent || '';
    const browser = BROWSERS.find(([pattern]) => pattern.test(agent))?.[1];
    const on = /iPhone/.test(agent) ? 'iPhone' : /iPad/.test(agent) ? 'iPad' : /Android/.test(agent) ? 'Android' : /Mac OS X/.test(agent) ? 'Mac' : /Windows/.test(agent) ? 'Windows' : /Linux/.test(agent) ? 'Linux' : null;
    system = ['Web', [browser, on].filter(Boolean).join(' on ')].filter(Boolean).join(' · ');
  } else system = os;
  return [system, appVersion ? `app ${appVersion}` : null].filter(Boolean).join(' · ').slice(0, 200);
}
