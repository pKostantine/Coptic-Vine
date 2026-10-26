import type { MusicQueueItem } from '@/context/MusicPlayerContext';
import { downloadManager } from '@/services/downloadManager';
import { musicService } from '@/services/musicService';
import { musicReleaseDownloadRequest, musicTrackDownloadRequest } from '@/services/offlineDownloadRequests';
import type { MusicConsumerRelease } from '@/types/musicConsumer';
import type { OfflineDownloadHolder, OfflineDownloadRequest } from '@/types/offlineDownloads';
import { isOwnTrackHolder } from '@/utils/downloadHolders';

/**
 * A track's download (utils/downloadHolders.ts). A track is saved once on
 * the device, whichever download saved it, and its download is whichever
 * holds it; one not yet held is downloaded as its release when the release is
 * that one track -- a single and its only track are one download, made the
 * same from the track as from the single's page.
 */

/** Whether a release is this one track and nothing else: downloading either is downloading both. */
export function isOneTrackRelease(release: Pick<MusicConsumerRelease, 'tracks'> | null | undefined, trackId: string): boolean {
  return Array.isArray(release?.tracks) && release.tracks.length === 1 && release.tracks[0]?.id === trackId;
}

/** The downloads holding a track: its own, its release's, a playlist's, Liked Songs'. */
export function trackHolders(trackId: string): () => Promise<OfflineDownloadHolder[]> {
  return () => downloadManager.holdersOf('music_track', trackId);
}

/** Of a track's holders, those that are its own download. */
export function isTracksOwnHolder(trackId: string): (holder: OfflineDownloadHolder) => boolean {
  return (holder) => isOwnTrackHolder(holder, trackId);
}

/** What downloading a track not yet on the device makes: its single's download, or its own. */
export async function trackDownloadRequest(item: MusicQueueItem, locale: string): Promise<OfflineDownloadRequest> {
  const trackId = item.track.id;
  const releaseId = item.releaseId ?? item.track.releaseId ?? null;
  const [lyrics, release] = await Promise.all([
    // Lyrics are useful offline, but the audio can be saved without them.
    musicService.getLyrics(trackId, locale).catch(() => null),
    releaseId ? musicService.getRelease(releaseId, locale).catch(() => null) : Promise.resolve(null),
  ]);
  if (release && isOneTrackRelease(release, trackId)) return musicReleaseDownloadRequest(release, locale, { [trackId]: lyrics });
  return musicTrackDownloadRequest({
    track: item.track,
    locale,
    releaseTitle: item.releaseTitle,
    coverAsset: item.coverAsset,
    lyrics,
  });
}
