/**
 * The apps a notification is for: Coptic Vine (cv), CV-Artists (cv_artists)
 * and CV-Admin (cv_admin), as the notification tables store them
 * (migrations 0037-0038). Builds of the apps from before the rename still
 * send the old names (chc, chc_artists, chc_admin, for Coptic Hymns Centre):
 * a function's argument, a table filter or a row written with one is taken
 * as the new, so those builds keep working.
 */
export const APP_KEYS = ['cv', 'cv_artists', 'cv_admin'] as const;

const LEGACY: Record<string, (typeof APP_KEYS)[number]> = { chc: 'cv', chc_artists: 'cv_artists', chc_admin: 'cv_admin' };

/** An app key as stored: an old name taken as its new one, anything else as it came. */
export function appKey<T>(value: T): T | (typeof APP_KEYS)[number] {
  return typeof value === 'string' && Object.hasOwn(LEGACY, value) ? LEGACY[value] : value;
}
