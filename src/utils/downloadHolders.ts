import type { OfflineDownloadEntityType, OfflineDownloadHolder, OfflineDownloadStatus } from '@/types/offlineDownloads';

/**
 * A track is on the device once, whichever download put it there: its own,
 * its release's, a playlist's, Liked Songs'. They share the one file
 * (offlineDatabase.ts's offline_package_files), and every one of them is a
 * "holder" of the track. The track's download is whichever holds it, so a
 * track already saved, or on its way, is never offered for download again
 * (OfflineDownloadButton's holders), and a release of one track and that
 * track are the same download (musicDownloads.ts).
 */

/** Which holder a track's download shows: the one that has it saved, then one fetching it, then paused, then stopped. */
const RANK: Record<OfflineDownloadStatus, number> = {
  complete: 0,
  downloading: 1,
  queued: 1,
  paused: 2,
  failed: 3,
  cancelled: 3,
  idle: 4,
};

/** The holders in the order a track's download shows them, the one it shows first. */
export function orderHolders(holders: OfflineDownloadHolder[]): OfflineDownloadHolder[] {
  const seen = new Set<string>();
  return holders
    .filter((holder) => !seen.has(holder.packageKey) && seen.add(holder.packageKey))
    .map((holder, index) => ({ holder, index }))
    .sort((a, b) => RANK[a.holder.status] - RANK[b.holder.status] || a.index - b.index)
    .map(({ holder }) => holder);
}

/**
 * A track's own download: the one made for it, or its release's when the
 * release is that one track -- a single and its only track are one download.
 */
export function isOwnTrackHolder(holder: OfflineDownloadHolder, trackId: string): boolean {
  if (holder.entityType === 'music_track') return holder.entityId === trackId;
  return holder.entityType === 'music_release' && holder.mediaCount === 1;
}

/**
 * What removing an item's download takes off the device: every download
 * holding it -- were one left, the item would still be saved, and still
 * shown as downloaded -- and of those, the ones that are not the item's own,
 * named in the confirmation.
 */
export function removalOf(holders: OfflineDownloadHolder[], isOwn: (holder: OfflineDownloadHolder) => boolean): { packageKeys: string[]; others: string[] } {
  const ordered = orderHolders(holders);
  return {
    packageKeys: ordered.map((holder) => holder.packageKey),
    others: ordered.filter((holder) => !isOwn(holder)).map((holder) => holder.title),
  };
}

/**
 * The item a download is of, from its key (entityType:entityId:locale, as
 * offlineDownloadRequests.ts makes it): the same item downloaded in another
 * App Language is the same download.
 */
export function downloadEntityOf(packageKey: string): { entityType: OfflineDownloadEntityType; entityId: string } | null {
  const [entityType, entityId] = packageKey.split(':');
  return entityType && entityId ? { entityType: entityType as OfflineDownloadEntityType, entityId } : null;
}

/** How many titles a list names before the rest are counted. */
const NAMED = 3;

/** Titles quoted and joined as the App Language joins a list: “A”, “B” and “C”, or “A”, “B”, “C” and 2 more. */
export function quotedList(titles: string[], language: 'en' | 'fr' | 'ar'): string {
  const quote = (title: string) => (language === 'fr' ? `« ${title} »` : language === 'ar' ? `«${title}»` : `“${title}”`);
  const named = titles.slice(0, titles.length > NAMED + 1 ? NAMED : titles.length).map(quote);
  const rest = titles.length - named.length;
  const parts = rest > 0
    ? [...named, language === 'fr' ? `${rest} autres` : language === 'ar' ? `${rest} أخرى` : `${rest} more`]
    : named;
  if (parts.length <= 1) return parts[0] ?? '';
  if (language === 'ar') return parts.join(' و');
  const and = language === 'fr' ? ' et ' : ' and ';
  return `${parts.slice(0, -1).join(', ')}${and}${parts[parts.length - 1]}`;
}
