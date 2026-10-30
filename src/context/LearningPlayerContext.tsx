import { useCallback, useMemo, useRef } from 'react';

import { usePlayback } from '@/context/PlaybackContext';
import { describeQueue, isLearningQueueItem, type QueueEntryView } from '@/context/queueEntries';
import { learningService } from '@/services/learningService';
import type {
  LearningAlbumDetail,
  LearningLesson,
  LearningLessonMediaType,
  LearningLessonSetDetail,
  LearningMediaAsset,
} from '@/types/learningPlatform';
import type { PlaybackQueueEntry, PlaybackRepeatMode } from '@/types/playback';
import type { LessonRendition, LessonVideoMode } from '@/utils/lessonPlayback';

export interface LearningQueueItem {
  kind: 'recording' | 'lesson';
  id: string;
  title: string;
  subtitle: string | null;
  durationMs: number | null;
  /** The item's own file: a recording, an audio lesson, or a video lesson's picture. */
  mediaAsset: LearningMediaAsset;
  /** A video lesson's sound alone (the smaller rendition), when it has been made. */
  audioAsset?: LearningMediaAsset | null;
  mediaType?: LearningLessonMediaType;
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
  /** Where it is, the moment it changes, comes from usePlaybackClock (context/PlaybackContext.tsx). */
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
  removeQueueItem: (index: number) => void;
  clearUpcoming: () => void;
  clearQueue: () => void;
  cycleRepeatMode: () => void;
  toggleShuffle: () => void;
  /** The listening speed, 1 for as recorded. */
  playbackRate: number;
  setPlaybackRate: (rate: number) => void;
  /** Lessons with a picture: watch it, or listen to the sound alone (a device choice). */
  lessonVideoMode: LessonVideoMode;
  setLessonVideoMode: (mode: LessonVideoMode) => void;
  /** The item playing is a lesson with a picture. */
  currentHasVideo: boolean;
  /** What is loaded for it right now: the picture, or the sound alone. */
  videoRendition: LessonRendition | null;
  videoSwitching: boolean;
  /** The picture's shape when the player has measured it, else from the catalogue, else null. */
  videoAspectRatio: number | null;
  /** Cellular data is keeping the picture back (utils/lessonPlayback.ts). */
  cellularBlocked: boolean;
  allowVideoOverCellularNow: () => void;
}

/** Whether a lesson has a picture to show (its sound alone comes from the audio rendition when there is one). */
export function lessonHasVideo(item: Pick<LearningQueueItem, 'mediaType'>): boolean {
  return item.mediaType === 'video';
}

/** Whether a video lesson has its smaller audio rendition yet (sound alone saves data only when it has). */
export function lessonHasAudioRendition(item: Pick<LearningQueueItem, 'mediaType' | 'audioAsset'>): boolean {
  return item.mediaType !== 'video' || Boolean(item.audioAsset);
}

export function learningAlbumQueue(album: LearningAlbumDetail): LearningQueueItem[] {
  return album.recordings.map((recording) => ({
    kind: 'recording',
    id: recording.id,
    title: recording.title,
    subtitle: recording.subtitle,
    durationMs: recording.durationMs,
    mediaAsset: recording.mediaAsset,
    mediaType: 'audio',
    containerId: album.id,
    containerTitle: album.title,
    cantorName: album.cantor.displayName,
    coverAsset: album.coverAsset,
    hymnId: recording.hymnId,
  }));
}

/** One lesson of a set as the queue holds it. */
export function learningLessonQueueItem(lessonSet: LearningLessonSetDetail, lesson: LearningLesson): LearningQueueItem {
  return {
    kind: 'lesson',
    id: lesson.id,
    title: lesson.title,
    subtitle: lesson.description,
    durationMs: lesson.durationMs,
    mediaAsset: lesson.mediaAsset,
    audioAsset: lesson.audioAsset ?? null,
    mediaType: lesson.mediaType,
    containerId: lessonSet.id,
    containerTitle: lessonSet.title,
    cantorName: lessonSet.cantor.displayName,
    coverAsset: lessonSet.coverAsset,
    hymnId: lessonSet.hymn.id,
  };
}

/**
 * Every lesson of a set, in order, whatever it is made of: a video lesson
 * plays on the one queue like an audio lesson, as its picture or as sound
 * alone by the listener's choice (PlaybackContext).
 */
export function learningLessonSetQueue(lessonSet: LearningLessonSetDetail): LearningQueueItem[] {
  return lessonSet.lessons.map((lesson) => learningLessonQueueItem(lessonSet, lesson));
}

function aspectRatioOf(asset: LearningMediaAsset | null | undefined): number | null {
  if (!asset?.width || !asset.height || asset.width <= 0 || asset.height <= 0) return null;
  return asset.width / asset.height;
}

function toPlaybackEntry(item: LearningQueueItem, occurrence: number): PlaybackQueueEntry<LearningQueueItem> {
  const video = lessonHasVideo(item);
  // A video lesson's sound alone is its audio rendition; until that exists,
  // the picture's own file carries the sound.
  const audioAsset = video ? item.audioAsset ?? item.mediaAsset : item.mediaAsset;
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
        remoteUri: learningService.resolveAsset(audioAsset),
      },
      video: video ? { remoteUri: learningService.resolveAsset(item.mediaAsset) } : null,
      videoAspectRatio: video ? aspectRatioOf(item.mediaAsset) : null,
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

  const noop = useCallback(() => undefined, []);

  return {
    entries,
    currentIndex: playback.currentIndex,
    currentItem,
    playing: currentItem ? playback.playing : false,
    buffering: currentItem ? playback.buffering || playback.loadingSource : false,
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
    removeQueueItem: playback.removeQueueItem,
    clearUpcoming: playback.clearUpcoming,
    clearQueue: playback.clearQueue,
    cycleRepeatMode: playback.cycleRepeatMode,
    toggleShuffle: playback.toggleShuffle,
    playbackRate: playback.learningRate ?? 1,
    setPlaybackRate: playback.setLearningRate,
    lessonVideoMode: playback.lessonVideoMode ?? 'video',
    setLessonVideoMode: playback.setLessonVideoMode ?? noop,
    currentHasVideo: currentItem ? Boolean(playback.currentHasVideo) : false,
    videoRendition: currentItem ? playback.videoRendition ?? null : null,
    videoSwitching: currentItem ? Boolean(playback.videoSwitching) : false,
    videoAspectRatio: currentItem ? playback.videoAspectRatio ?? null : null,
    cellularBlocked: Boolean(playback.cellularBlocked),
    allowVideoOverCellularNow: playback.allowVideoOverCellularNow ?? noop,
  };
}
