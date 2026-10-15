import type { MusicQueueItem } from '../context/MusicPlayerContext';
import type { MusicConsumerRelease } from '../types/musicConsumer';

/** A release's tracks as the player queues them, each carrying its release. */
export function musicReleaseQueue(release: MusicConsumerRelease): MusicQueueItem[] {
  const tracks = Array.isArray(release.tracks) ? release.tracks : [];
  return tracks.map((track) => ({
    track: { ...track, artists: Array.isArray(track.artists) ? track.artists : [] },
    releaseId: release.id,
    releaseTitle: release.title,
    releaseType: release.releaseType,
    musicType: release.musicType ?? null,
    recordingType: release.recordingType ?? null,
    coverAsset: release.coverAsset ?? null,
  }));
}
