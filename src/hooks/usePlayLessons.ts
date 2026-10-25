import { useCallback } from 'react';

import { useBottomChrome } from '@/context/BottomChromeContext';
import { lessonHasVideo, type LearningQueueItem, useLearningPlayer } from '@/context/LearningPlayerContext';
import { usePlayback } from '@/context/PlaybackContext';

/**
 * Plays Learn & Study items from one of them, as every list does. A lesson
 * with a picture, watched as video, opens the full player on its picture,
 * which is fetched the first time (expectVideoSurface); anything else plays
 * where the listener is, under the now-playing bar.
 */
export function usePlayLessons(): (items: LearningQueueItem[], startIndex: number) => void {
  const { playQueue, lessonVideoMode } = useLearningPlayer();
  const { expectVideoSurface } = usePlayback();
  const { requestNowPlayingOpen } = useBottomChrome();
  return useCallback((items: LearningQueueItem[], startIndex: number) => {
    const item = items[startIndex];
    if (!item) return;
    if (lessonHasVideo(item) && lessonVideoMode === 'video') {
      expectVideoSurface();
      requestNowPlayingOpen();
    }
    playQueue(items, startIndex);
  }, [expectVideoSurface, lessonVideoMode, playQueue, requestNowPlayingOpen]);
}
