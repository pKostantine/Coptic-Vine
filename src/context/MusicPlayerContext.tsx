import { ReactNode, useCallback, useEffect, useMemo, useRef } from 'react';

import { PlaybackProvider, usePlayback } from '@/context/PlaybackContext';
import { useAuth } from '@/context/AuthContext';
import { describeQueue, isMusicQueueItem, type QueueEntryView } from '@/context/queueEntries';
import { musicService } from '@/services/musicService';
import type { MusicConsumerAsset, MusicConsumerRelease, MusicConsumerTrack } from '@/types/musicConsumer';
import type { PlaybackQueueEntry, PlaybackRepeatMode } from '@/types/playback';
import { formatMusicTrackPerformers } from '@/utils/musicCredits';

export interface MusicQueueItem {
  track: MusicConsumerTrack;
  releaseId?: string | null;
  releaseTitle?: string | null;
  releaseType?: MusicConsumerRelease['releaseType'] | null;
  musicType?: string | null;
  recordingType?: string | null;
  coverAsset?: MusicConsumerAsset | null;
  /** Phase 13 can attach a durable downloaded file URI here. */
  localUri?: string | null;
}

interface MusicPlayerContextValue {
  /** The whole queue as the engine holds it — Music tracks and Learn & Study items alike, in order (see queueEntries.ts). */
  entries: QueueEntryView[];
  /** The engine's index of what is playing, whichever kind it is. */
  currentIndex: number;
  /** The track playing, or null while a Learn & Study item plays. */
  currentItem: MusicQueueItem | null;
  playing: boolean;
  buffering: boolean;
  /** Where it is, the moment it changes, comes from usePlaybackClock (context/PlaybackContext.tsx). */
  durationMs: number;
  repeatMode: PlaybackRepeatMode;
  shuffleEnabled: boolean;
  playbackError: string | null;
  playQueue: (items: MusicQueueItem[], startIndex?: number) => void;
  playItem: (item: MusicQueueItem) => void;
  addNext: (item: MusicQueueItem) => void;
  addToEnd: (item: MusicQueueItem) => void;
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
}

function toPlaybackEntry(item: MusicQueueItem, occurrence: number): PlaybackQueueEntry<MusicQueueItem> {
  const performerLine = formatMusicTrackPerformers(item.track, 'Coptic Vine');
  const isCollectionTrack = item.releaseType === 'album' || item.releaseType === 'ep';
  const deviceTitle = isCollectionTrack && item.releaseTitle
    ? `${item.track.title} — ${item.releaseTitle}`
    : item.track.title;

  return {
    key: `music:${item.track.id}:${occurrence}`,
    payload: item,
    playable: {
      id: item.track.id,
      kind: 'music_track',
      title: deviceTitle,
      artist: performerLine,
      albumTitle: item.releaseTitle ?? null,
      artworkUri: musicService.resolveAsset(item.coverAsset ?? null),
      durationMs: item.track.durationMs,
      source: {
        localUri: item.localUri ?? null,
        remoteUri: musicService.resolveAsset(item.track.mediaAsset),
      },
      lyrics: { trackId: item.track.id },
    },
  };
}

/**
 * A restored queue carries whatever track metadata was current when it was
 * saved, so credits corrected since then would stay wrong until the listener
 * rebuilt their queue. Once per launch, re-read each queued release and swap
 * in the published track data, keeping every entry's key and position.
 */
function QueueReleaseMetadataRefresher() {
  const { hydrated, queue, updateQueueEntries } = usePlayback();
  const requestedReleaseIds = useRef(new Set<string>());

  useEffect(() => {
    if (!hydrated) return;

    const releaseIds = new Set<string>();
    for (const entry of queue) {
      if (!isMusicQueueItem(entry.payload)) continue;
      const item = entry.payload;
      const releaseId = item.releaseId ?? item.track.releaseId;
      if (!releaseId || requestedReleaseIds.current.has(releaseId)) continue;
      if (item.releaseType && item.musicType != null && item.recordingType != null) continue;
      requestedReleaseIds.current.add(releaseId);
      releaseIds.add(releaseId);
    }
    if (!releaseIds.size) return;

    void Promise.allSettled([...releaseIds].map((id) => musicService.getRelease(id)))
      .then((results) => {
        const releases = new Map<string, MusicConsumerRelease>();
        for (const result of results) {
          if (result.status === 'fulfilled') releases.set(result.value.id, result.value);
        }
        if (!releases.size) return;

        updateQueueEntries((entry) => {
          if (!isMusicQueueItem(entry.payload)) return entry;
          const item = entry.payload;
          const release = releases.get(item.releaseId ?? item.track.releaseId ?? '');
          const track = release?.tracks.find((candidate) => candidate.id === item.track.id);
          if (!release || !track) return entry;

          const refreshedEntry = toPlaybackEntry({
            ...item,
            track,
            releaseTitle: release.title,
            releaseType: release.releaseType,
            musicType: release.musicType ?? null,
            recordingType: release.recordingType ?? null,
            coverAsset: release.coverAsset ?? item.coverAsset,
          }, 0);
          return { ...refreshedEntry, key: entry.key };
        });
      });
  }, [hydrated, queue, updateQueueEntries]);

  return null;
}

function MusicPlayHistoryRecorder() {
  const { user } = useAuth();
  const { currentItem, playing } = usePlayback();
  const lastRecordedKey = useRef<string | null>(null);

  useEffect(() => {
    if (!user || !playing || currentItem?.playable.kind !== 'music_track' || !isMusicQueueItem(currentItem.payload)) {
      return;
    }

    const historyKey = `${user.id}:${currentItem.key}`;
    if (lastRecordedKey.current === historyKey) return;
    lastRecordedKey.current = historyKey;

    const item = currentItem.payload;
    void musicService.recordPlay(item.track.id, item.releaseId ?? item.track.releaseId ?? null)
      .catch(() => {
        // Listening should never fail because history could not be recorded.
        // Clear the guard so a later playback state change can retry.
        if (lastRecordedKey.current === historyKey) lastRecordedKey.current = null;
      });
  }, [currentItem, playing, user]);

  return null;
}

export function MusicPlayerProvider({ children }: { children: ReactNode }) {
  return (
    <PlaybackProvider>
      <QueueReleaseMetadataRefresher />
      <MusicPlayHistoryRecorder />
      {children}
    </PlaybackProvider>
  );
}

/**
 * The Music adapter over the one player in PlaybackContext, which Learn &
 * Study shares: the queue it reports is the whole queue, so a track queued
 * after a lesson shows where it will play.
 */
export function useMusicPlayer(): MusicPlayerContextValue {
  const playback = usePlayback();

  const entries = useMemo(() => describeQueue(playback.queue), [playback.queue]);
  const currentItem = playback.currentItem?.playable.kind === 'music_track'
    && isMusicQueueItem(playback.currentItem.payload)
    ? playback.currentItem.payload
    : null;

  const playQueue = useCallback((items: MusicQueueItem[], startIndex = 0) => {
    playback.playQueue(items.map(toPlaybackEntry), startIndex);
  }, [playback.playQueue]);

  const playItem = useCallback((item: MusicQueueItem) => {
    playback.playItem(toPlaybackEntry(item, 0));
  }, [playback.playItem]);

  const queuedOccurrence = useRef(0);
  const nextQueuedEntry = useCallback((item: MusicQueueItem) => {
    queuedOccurrence.current += 1;
    return toPlaybackEntry(item, Date.now() + queuedOccurrence.current);
  }, []);

  const addNext = useCallback((item: MusicQueueItem) => {
    playback.addNext(nextQueuedEntry(item));
  }, [nextQueuedEntry, playback.addNext]);

  const addToEnd = useCallback((item: MusicQueueItem) => {
    playback.addToEnd(nextQueuedEntry(item));
  }, [nextQueuedEntry, playback.addToEnd]);

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
  };
}
