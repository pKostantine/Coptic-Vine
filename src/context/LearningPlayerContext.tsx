import { useCallback, useMemo, useRef } from 'react';

import { usePlayback } from '@/context/PlaybackContext';
import { describeQueue, isLearningQueueItem, type QueueEntryView } from '@/context/queueEntries';
import { learningService } from '@/services/learningService';
import type {
  LearningAlbumDetail,
  LearningLessonSetDetail,
  LearningMediaAsset,
} from '@/types/learningPlatform';
import type { PlaybackQueueEntry, PlaybackRepeatMode } from '@/types/playback';

export interface LearningQueueItem {
  kind: 'recording' | 'lesson';
  id: string;
  title: string;
  subtitle: string | null;
  durationMs: number | null;
  mediaAsset: LearningMediaAsset;
  containerId: string;
  containerTitle: string;
  cantorName: string;
  coverAsset: LearningMediaAsset | null;
  hymnId: string | null;
  localUri?: string | null;
}

interface LearningPlayerContextValue {
  /** The whole queue as the engine holds it — Learn & Study items and Music tracks alike, in order (see queueEntries.ts). */
  entries: QueueEntryView[];
  /** The engine's index of what is playing, whichever kind it is. */
  currentIndex: number;
  /** The item playing, or null while a Music track plays. */
  currentItem: LearningQueueItem | null;
  playing: boolean;
  buffering: boolean;
  currentTimeMs: number;
  durationMs: number;
  repeatMode: PlaybackRepeatMode;
  shuffleEnabled: boolean;
  playbackError: string | null;
  playQueue: (items: LearningQueueItem[], startIndex?: number) => void;
  playItem: (item: LearningQueueItem) => void;
  /** Queues an item after what is playing — a Music track as much as a lesson. */
  addNext: (item: LearningQueueItem) => void;
  addToEnd: (item: LearningQueueItem) => void;
  togglePlayback: () => void;
  next: () => void;
  previous: () => void;
  seekToMs: (positionMs: number) => Promise<void>;
  selectQueueIndex: (index: number) => void;
  moveQueueItem: (fromIndex: number, toIndex: number) => void;
  clearUpcoming: () => void;
  cycleRepeatMode: () => void;
  toggleShuffle: () => void;
  /** The listening speed, 1 for as recorded. */
  playbackRate: number;
  setPlaybackRate: (rate: number) => void;
}

export function learningAlbumQueue(album: LearningAlbumDetail): LearningQueueItem[] {
  return album.recordings.map((recording) => ({
    kind: 'recording',
    id: recording.id,
    title: recording.title,
    subtitle: recording.subtitle,
    durationMs: recording.durationMs,
    mediaAsset: recording.mediaAsset,
    containerId: album.id,
    containerTitle: album.title,
    cantorName: album.cantor.displayName,
    coverAsset: album.coverAsset,
    hymnId: recording.hymnId,
  }));
}

export function learningLessonSetAudioQueue(lessonSet: LearningLessonSetDetail): LearningQueueItem[] {
  return lessonSet.lessons
    .filter((lesson) => lesson.mediaType === 'audio' || lesson.audioAsset)
    .map((lesson) => ({
      kind: 'lesson',
      id: lesson.id,
      title: lesson.title,
      subtitle: lesson.description,
      durationMs: lesson.durationMs,
      mediaAsset: lesson.audioAsset ?? lesson.mediaAsset,
      containerId: lessonSet.id,
      containerTitle: lessonSet.title,
      cantorName: lessonSet.cantor.displayName,
      coverAsset: lessonSet.coverAsset,
      hymnId: lessonSet.hymn.id,
    }));
}

function toPlaybackEntry(item: LearningQueueItem, occurrence: number): PlaybackQueueEntry<LearningQueueItem> {
  return {
    key: ['learning', item.kind, item.id, occurrence].join(':'),
    payload: item,
    playable: {
      id: item.id,
      kind: 'learning_audio',
      title: item.title,
      artist: item.cantorName,
      albumTitle: item.containerTitle,
      artworkUri: learningService.resolveAsset(item.coverAsset),
      durationMs: item.durationMs,
      source: {
        localUri: item.localUri ?? null,
        remoteUri: learningService.resolveAsset(item.mediaAsset),
      },
    },
  };
}

/**
 * The Learn & Study adapter over the one player in PlaybackContext, which
 * Music shares: the queue it reports is the whole queue, so a lesson queued
 * after a song shows where it will play.
 */
export function useLearningPlayer(): LearningPlayerContextValue {
  const playback = usePlayback();
  const playPlaybackQueue = playback.playQueue;
  const playPlaybackItem = playback.playItem;
  const addPlaybackNext = playback.addNext;
  const addPlaybackToEnd = playback.addToEnd;
  const entries = useMemo(() => describeQueue(playback.queue), [playback.queue]);
  const currentItem = playback.currentItem?.playable.kind === 'learning_audio'
    && isLearningQueueItem(playback.currentItem.payload)
    ? playback.currentItem.payload
    : null;

  const playQueue = useCallback((items: LearningQueueItem[], startIndex = 0) => {
    playPlaybackQueue(items.map(toPlaybackEntry), startIndex);
  }, [playPlaybackQueue]);

  const playItem = useCallback((item: LearningQueueItem) => {
    playPlaybackItem(toPlaybackEntry(item, 0));
  }, [playPlaybackItem]);

  // The same item can be queued twice; each time under a key of its own.
  const queuedOccurrence = useRef(0);
  const nextQueuedEntry = useCallback((item: LearningQueueItem) => {
    queuedOccurrence.current += 1;
    return toPlaybackEntry(item, Date.now() + queuedOccurrence.current);
  }, []);

  const addNext = useCallback((item: LearningQueueItem) => {
    addPlaybackNext(nextQueuedEntry(item));
  }, [addPlaybackNext, nextQueuedEntry]);

  const addToEnd = useCallback((item: LearningQueueItem) => {
    addPlaybackToEnd(nextQueuedEntry(item));
  }, [addPlaybackToEnd, nextQueuedEntry]);

  return {
    entries,
    currentIndex: playback.currentIndex,
    currentItem,
    playing: currentItem ? playback.playing : false,
    buffering: currentItem ? playback.buffering || playback.loadingSource : false,
    currentTimeMs: currentItem ? playback.currentTimeMs : 0,
    durationMs: currentItem ? playback.durationMs : 0,
    repeatMode: playback.repeatMode,
    shuffleEnabled: playback.shuffleEnabled,
    playbackError: playback.playbackError,
    playQueue,
    playItem,
    addNext,
    addToEnd,
    togglePlayback: playback.togglePlayback,
    next: playback.next,
    previous: playback.previous,
    seekToMs: playback.seekToMs,
    selectQueueIndex: playback.selectQueueIndex,
    moveQueueItem: playback.moveQueueItem,
    clearUpcoming: playback.clearUpcoming,
    cycleRepeatMode: playback.cycleRepeatMode,
    toggleShuffle: playback.toggleShuffle,
    playbackRate: playback.learningRate ?? 1,
    setPlaybackRate: playback.setLearningRate,
  };
}
