import { useState } from 'react';
import { Alert } from 'react-native';

import { useMusicPlayer } from '@/context/MusicPlayerContext';
import { musicService } from '@/services/musicService';
import type { MusicConsumerReleaseSummary } from '@/types/musicConsumer';
import { musicReleaseQueue } from '@/utils/musicReleaseQueue';

import { tr } from '../utils/appText';

/**
 * Plays a release from a shelf that knows only its summary: its tracks are
 * fetched on the tap, then queued from the first. A release already playing
 * pauses, and one paused resumes.
 */
export function usePlayRelease(locale: string) {
  const { currentItem, playing, playQueue, togglePlayback } = useMusicPlayer();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const isCurrent = (releaseId: string) => currentItem?.releaseId === releaseId;
  const isPlaying = (releaseId: string) => isCurrent(releaseId) && playing;

  const play = (release: MusicConsumerReleaseSummary) => {
    if (isCurrent(release.id)) {
      togglePlayback();
      return;
    }
    if (loadingId) return;
    setLoadingId(release.id);
    musicService.getRelease(release.id, locale)
      .then((payload) => {
        const queue = musicReleaseQueue(payload);
        if (queue.length) playQueue(queue, 0);
      })
      .catch((cause) => Alert.alert(tr('Play release', 'Lire la parution', 'تشغيل الإصدار'), cause instanceof Error ? cause.message : 'Unable to play this release.'))
      .finally(() => setLoadingId((current) => (current === release.id ? null : current)));
  };

  return { play, loadingId, isPlaying };
}
