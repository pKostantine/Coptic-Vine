import { useEvent, useEventListener } from 'expo';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as Network from 'expo-network';
import { useVideoPlayer, type VideoPlayer, type VideoSource } from 'expo-video';
import { AppState, Platform } from 'react-native';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useReadingPreferences } from '@/context/ReadingPreferencesContext';
import { downloadManager } from '@/services/downloadManager';
import type { PlaybackQueueEntry, PlaybackRepeatMode, PlaybackSnapshot } from '@/types/playback';
import {
  loadLearningResume,
  peekLearningResume,
  resumePositionFor,
  saveLearningResume,
} from '@/utils/learningResume';
import {
  entryHasVideo,
  lessonRendition,
  type LessonRendition,
  type LessonVideoMode,
  renditionSwitchDelayMs,
  startingPlacement,
  type VideoPlacementKind,
} from '@/utils/lessonPlayback';
import {
  choosePlaybackUri,
  clampPlaybackIndex,
  getFinishedTrackAction,
  getManualNextIndex,
  getManualPreviousIndex,
  keepOnlyCurrentEntry,
  insertQueueEntry,
  moveQueueEntry,
  nextRepeatMode,
  restoreOriginalQueue,
  shuffleQueuePreservingCurrent,
} from '@/utils/playbackEngine';
import {
  loadPlaybackSnapshot,
  localPlaybackUriExists,
  savePlaybackSnapshot,
} from '@/utils/playbackStateStorage';
import { addTrackControlListener, hasTrackControls, setTrackControls } from '@/utils/trackControls';

/** Which player an entry plays on: the audio player, or the video player for a lesson with a picture. */
export type PlaybackEngine = 'audio' | 'video';

/** Where the one video surface is, as the stage reports it (utils/lessonPlayback.ts). */
export interface VideoPresentation {
  placement: VideoPlacementKind;
  pictureInPicture: boolean;
  /** The lessons whose pages are showing, so a new entry's first rendition is the right one. */
  claimedItemIds: readonly string[];
  /** A subdocument covers the app, surface included. */
  covered: boolean;
}

export interface PlaybackContextValue {
  queue: PlaybackQueueEntry[];
  currentIndex: number;
  currentItem: PlaybackQueueEntry | null;
  playing: boolean;
  buffering: boolean;
  loadingSource: boolean;
  currentTimeMs: number;
  durationMs: number;
  repeatMode: PlaybackRepeatMode;
  shuffleEnabled: boolean;
  playbackError: string | null;
  playQueue: (items: PlaybackQueueEntry[], startIndex?: number) => void;
  playItem: (item: PlaybackQueueEntry) => void;
  addNext: (item: PlaybackQueueEntry) => void;
  addToEnd: (item: PlaybackQueueEntry) => void;
  togglePlayback: () => void;
  next: () => void;
  previous: () => void;
  seekToMs: (positionMs: number) => Promise<void>;
  selectQueueIndex: (index: number) => void;
  /** Drag-to-reorder. The playing entry keeps playing wherever it lands. */
  moveQueueItem: (fromIndex: number, toIndex: number) => void;
  /** Empties the queue but keeps the current entry playing. */
  clearUpcoming: () => void;
  /** Stops playback and forgets the queue entirely. */
  clearQueue: () => void;
  /**
   * Rewrites entries in place (same keys, same order), e.g. to refresh stale
   * metadata restored from a saved snapshot.
   */
  updateQueueEntries: (update: (entry: PlaybackQueueEntry) => PlaybackQueueEntry) => void;
  /** True once any saved snapshot has been restored. */
  hydrated: boolean;
  cycleRepeatMode: () => void;
  toggleShuffle: () => void;
  /**
   * How fast Learn & Study plays (the lesson player's speed chip). Music
   * always plays at its own pace, so a song queued after a slowed lesson
   * is not slowed with it.
   */
  learningRate: number;
  setLearningRate: (rate: number) => void;

  /** The player the current entry plays on. */
  activeEngine: PlaybackEngine;
  /** The current entry is a lesson with a picture (it plays on the video player either way). */
  currentHasVideo: boolean;
  /** The video player, for the one surface that draws it (components/playback/LessonVideoStage.tsx). */
  videoPlayer: VideoPlayer;
  /** Video or sound alone, as the listener chose (a device preference). */
  lessonVideoMode: LessonVideoMode;
  setLessonVideoMode: (mode: LessonVideoMode) => void;
  /** What is actually loaded for the current video lesson: the picture, or the sound alone. */
  videoRendition: LessonRendition | null;
  /** Between renditions: the picture (or the sound) is being fetched at the same place. */
  videoSwitching: boolean;
  /** The picture's shape when the player has measured it, else from the catalogue, else null. */
  videoAspectRatio: number | null;
  /** The stage reports where the surface is, so the picture is streamed only while it can be seen. */
  setVideoPresentation: (presentation: VideoPresentation) => void;
  videoPresentation: VideoPresentation;
  /** On cellular data with video not allowed over it: the lesson plays as sound alone. */
  cellularBlocked: boolean;
  /** "Play the video anyway": allows the picture over cellular until the app is next opened. */
  allowVideoOverCellularNow: () => void;
}

const PlaybackContext = createContext<PlaybackContextValue | null>(null);

async function resolveAudioUri(entry: PlaybackQueueEntry): Promise<string | null> {
  const localUri = entry.playable.source.localUri?.trim() || null;
  const remoteUri = entry.playable.source.remoteUri?.trim() || null;
  const localAvailable = localUri ? await localPlaybackUriExists(localUri) : false;
  if (localAvailable) return choosePlaybackUri(localUri, remoteUri, true);

  const resolved = await downloadManager.resolvePlaybackUri(
    entry.playable.kind,
    entry.playable.id,
    remoteUri,
  );
  // A lesson downloaded with its picture plays its sound from that file
  // rather than fetching the audio rendition again.
  if (entry.playable.video && resolved === remoteUri) {
    const localVideo = await downloadManager.resolvePlaybackUri('learning_video_audio', entry.playable.id, null);
    if (localVideo) return localVideo;
  }
  return resolved;
}

async function resolveVideoUri(entry: PlaybackQueueEntry): Promise<string | null> {
  const video = entry.playable.video;
  if (!video) return null;
  const localUri = video.localUri?.trim() || null;
  const remoteUri = video.remoteUri?.trim() || null;
  const localAvailable = localUri ? await localPlaybackUriExists(localUri) : false;
  if (localAvailable) return choosePlaybackUri(localUri, remoteUri, true);
  return downloadManager.resolvePlaybackUri('learning_video_audio', entry.playable.id, remoteUri);
}

async function resolveRenditionUri(entry: PlaybackQueueEntry, rendition: LessonRendition): Promise<string | null> {
  if (rendition === 'video') return (await resolveVideoUri(entry)) ?? resolveAudioUri(entry);
  return resolveAudioUri(entry);
}

function videoSourceFor(entry: PlaybackQueueEntry, uri: string, rendition: LessonRendition): VideoSource {
  const headers = (rendition === 'video' ? entry.playable.video?.headers : entry.playable.source.headers) ?? undefined;
  return {
    uri,
    headers,
    metadata: {
      title: entry.playable.title,
      artist: entry.playable.artist ?? undefined,
      artwork: entry.playable.artworkUri ?? undefined,
    },
  };
}

function isLearningEntry(entry: PlaybackQueueEntry | null): entry is PlaybackQueueEntry {
  return entry?.playable.kind === 'learning_audio';
}

/**
 * On the web the player reports "ready" only when its status changes, and a
 * quick source swap never leaves "ready"; the element itself says when the
 * new source can play. The stage keeps exactly one <video> in the document.
 */
function whenWebVideoReady(callback: () => void): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const element = document.querySelector('video');
  if (!element) return;
  if (element.readyState >= 3) {
    callback();
    return;
  }
  element.addEventListener('canplay', callback, { once: true });
}

const HIDDEN_PRESENTATION: VideoPresentation = { placement: 'hidden', pictureInPicture: false, claimedItemIds: [], covered: false };

function samePresentation(a: VideoPresentation, b: VideoPresentation): boolean {
  return a.placement === b.placement
    && a.pictureInPicture === b.pictureInPicture
    && a.covered === b.covered
    && a.claimedItemIds.length === b.claimedItemIds.length
    && a.claimedItemIds.every((id, index) => id === b.claimedItemIds[index]);
}

export function PlaybackProvider({ children }: { children: ReactNode }) {
  const { preferences, setLessonVideoMode: setLessonVideoModePreference } = useReadingPreferences();
  const lessonVideoMode = preferences.lessonVideoMode;
  const lessonVideoOnCellular = preferences.lessonVideoOnCellular;

  const player = useAudioPlayer(null, {
    updateInterval: 125,
    preferredForwardBufferDuration: 20,
  });
  const status = useAudioPlayerStatus(player);

  // The second player: a lesson with a picture plays on it whether the
  // picture shows or not, so showing and hiding the video never changes
  // players (and never loses the place).
  const videoPlayer = useVideoPlayer(null, (instance) => {
    instance.loop = false;
    instance.staysActiveInBackground = true;
    instance.audioMixingMode = 'doNotMix';
    instance.timeUpdateEventInterval = 0.25;
  });
  const videoPlayingEvent = useEvent(videoPlayer, 'playingChange', { isPlaying: false, oldIsPlaying: false });
  const videoStatusEvent = useEvent(videoPlayer, 'statusChange', { status: 'idle' as const });
  const videoTimeEvent = useEvent(videoPlayer, 'timeUpdate', { currentTime: 0, currentLiveTimestamp: null, currentOffsetFromLive: null, bufferedPosition: 0 });

  const [queue, setQueue] = useState<PlaybackQueueEntry[]>([]);
  const [originalQueue, setOriginalQueue] = useState<PlaybackQueueEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [repeatMode, setRepeatMode] = useState<PlaybackRepeatMode>('off');
  const [shuffleEnabled, setShuffleEnabled] = useState(false);
  const [loadingSource, setLoadingSource] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [learningRate, setLearningRate] = useState(1);
  const sourceRequestId = useRef(0);
  const restorePositionMs = useRef<number | null>(null);

  // The video player's own state.
  const [videoRendition, setVideoRendition] = useState<LessonRendition | null>(null);
  const [videoDurationMs, setVideoDurationMs] = useState(0);
  const [measuredAspectRatio, setMeasuredAspectRatio] = useState<number | null>(null);
  const [videoPresentation, setVideoPresentationState] = useState<VideoPresentation>(HIDDEN_PRESENTATION);
  const [cellularOverride, setCellularOverride] = useState(false);
  const [appActive, setAppActive] = useState(AppState.currentState !== 'background');
  // Where the sound was when the picture was swapped for the sound alone (or
  // back): shown until the new source has caught up, so the bar never jumps
  // to the start and back.
  const [videoSwitch, setVideoSwitch] = useState<{ positionMs: number; wasPlaying: boolean } | null>(null);
  // The same swap, written the moment it starts: the player's ready event
  // can arrive before React has committed the state above.
  const swapRef = useRef<{ positionMs: number; wasPlaying: boolean } | null>(null);
  const pendingVideoSeekMs = useRef<number | null>(null);
  // Play once the source is ready. On the web a play() in the same task as a
  // source replacement is thrown away ("interrupted by a new load request"),
  // so playback is (re)started from the player's ready event instead.
  const pendingPlay = useRef(false);
  const videoRequestId = useRef(0);
  // The video player's properties are set through this ref: it is the same
  // instance for the provider's life, and a ref may be written to after render.
  const videoPlayerRef = useRef(videoPlayer);

  const currentItem = currentIndex >= 0 && currentIndex < queue.length ? queue[currentIndex] : null;
  const currentHasVideo = entryHasVideo(currentItem);
  const activeEngine: PlaybackEngine = currentHasVideo ? 'video' : 'audio';
  const currentItemRef = useRef<PlaybackQueueEntry | null>(currentItem);
  useEffect(() => {
    currentItemRef.current = currentItem;
  }, [currentItem]);

  // expo-audio only reports `playing` once the clock has advanced and enough
  // data is buffered, so right after playback starts it briefly reports false
  // again — which made the play/pause button flicker play → pause → play on a
  // cold load. The player's own `paused` flag is right from the first frame,
  // so it covers that start-up window.
  const audioPlaying = Boolean(status.playing) || (currentItem != null && !player.paused);
  const videoSwitching = videoSwitch != null;
  const videoPlaying = videoPlayingEvent.isPlaying || Boolean(videoSwitch?.wasPlaying);
  const playing = activeEngine === 'video' ? videoPlaying : audioPlaying;
  const audioTimeMs = Math.max(0, Math.round((status.currentTime ?? 0) * 1000));
  const videoTimeMs = videoSwitch
    ? videoSwitch.positionMs
    : Math.max(0, Math.round((videoTimeEvent.currentTime ?? 0) * 1000));
  const currentTimeMs = activeEngine === 'video' ? videoTimeMs : audioTimeMs;
  const durationMs = activeEngine === 'video'
    ? Math.max(0, videoDurationMs)
    : Math.max(0, Math.round((status.duration ?? 0) * 1000));
  const buffering = activeEngine === 'video'
    ? videoStatusEvent.status === 'loading' || videoSwitching
    : Boolean(status.isBuffering);

  // The rendition the rules call for right now (utils/lessonPlayback.ts).
  const network = Network.useNetworkState();
  const onCellular = network.type === Network.NetworkStateType.CELLULAR;
  const cellularBlocked = onCellular && !lessonVideoOnCellular && !cellularOverride;
  const effectivePlacement: VideoPlacementKind = appActive || videoPresentation.pictureInPicture
    ? videoPresentation.placement
    : 'hidden';
  const desiredRendition = lessonRendition({
    hasVideo: currentHasVideo,
    mode: lessonVideoMode,
    placement: effectivePlacement,
    pictureInPicture: videoPresentation.pictureInPicture,
    cellularBlocked,
  });
  // The same inputs as last rendered, for a load started from an event: a new
  // entry's first rendition is decided from where its picture will be.
  const renditionInputsRef = useRef({ mode: lessonVideoMode, cellularBlocked, appActive, presentation: videoPresentation });
  useEffect(() => {
    renditionInputsRef.current = { mode: lessonVideoMode, cellularBlocked, appActive, presentation: videoPresentation };
  }, [appActive, cellularBlocked, lessonVideoMode, videoPresentation]);
  const startingRenditionFor = useCallback((entry: PlaybackQueueEntry): LessonRendition => {
    const { mode, cellularBlocked: blocked, appActive: active, presentation } = renditionInputsRef.current;
    return lessonRendition({
      hasVideo: true,
      mode,
      placement: startingPlacement({
        itemId: entry.playable.id,
        claimedItemIds: presentation.claimedItemIds,
        appActive: active,
        covered: presentation.covered,
        pictureInPicture: presentation.pictureInPicture,
        current: active || presentation.pictureInPicture ? presentation.placement : 'hidden',
      }),
      pictureInPicture: presentation.pictureInPicture,
      cellularBlocked: blocked,
    });
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setAppActive(state !== 'background'));
    return () => subscription.remove();
  }, []);

  const stopVideoEngine = useCallback(() => {
    videoRequestId.current += 1;
    pendingVideoSeekMs.current = null;
    pendingPlay.current = false;
    swapRef.current = null;
    setVideoSwitch(null);
    setVideoRendition(null);
    setVideoDurationMs(0);
    setMeasuredAspectRatio(null);
    const video = videoPlayerRef.current;
    try {
      video.pause();
      video.showNowPlayingNotification = false;
      video.replace(null);
    } catch {
      // A player already torn down has nothing to stop.
    }
  }, []);

  const stopAudioEngine = useCallback(() => {
    player.pause();
    player.setActiveForLockScreen(false);
    player.replace(null);
  }, [player]);

  // The video player's source is ready: a seek that was waiting goes now (the
  // web and Android ignore one made while loading), the duration is read, a
  // rendition swap is over, and playback that was waiting starts.
  const videoReady = useCallback(() => {
    const video = videoPlayerRef.current;
    const pending = pendingVideoSeekMs.current;
    if (pending != null) {
      pendingVideoSeekMs.current = null;
      // iOS applied it during the load; elsewhere a seek made then is lost.
      if (Platform.OS !== 'ios' && Math.abs(video.currentTime * 1000 - pending) > 400) video.currentTime = pending / 1000;
    }
    const seconds = video.duration;
    if (Number.isFinite(seconds) && seconds > 0) setVideoDurationMs(Math.round(seconds * 1000));
    const swap = swapRef.current;
    if (swap) {
      swapRef.current = null;
      setVideoSwitch(null);
      pendingPlay.current = pendingPlay.current || swap.wasPlaying;
    }
    if (pendingPlay.current) {
      pendingPlay.current = false;
      video.play();
    }
  }, []);

  const loadEntry = useCallback(async (
    entries: PlaybackQueueEntry[],
    index: number,
    autoplay: boolean,
    positionMs = 0,
  ) => {
    const boundedIndex = clampPlaybackIndex(entries.length, index);
    if (boundedIndex < 0) return;
    const requestId = ++sourceRequestId.current;
    setLoadingSource(true);
    setPlaybackError(null);

    try {
      const entry = entries[boundedIndex];
      // A lesson picks up where it was left, unless a saved queue says where.
      const startMs = positionMs > 0
        ? positionMs
        : isLearningEntry(entry) ? resumePositionFor(peekLearningResume()[entry.playable.id], entry.playable.durationMs) : 0;

      if (entryHasVideo(entry)) {
        // Fetched right the first time: the rendition for where the picture
        // will be, not for where the entry before it was.
        const rendition = startingRenditionFor(entry);
        const uri = await resolveRenditionUri(entry, rendition);
        if (requestId !== sourceRequestId.current) return;
        if (!uri) throw new Error('No playable local or remote source is available.');

        // One player at a time owns the sound and the lock screen.
        stopAudioEngine();
        videoRequestId.current += 1;
        pendingVideoSeekMs.current = null;
        swapRef.current = null;
        setVideoSwitch(null);
        setVideoDurationMs(entry.playable.durationMs ?? 0);
        setMeasuredAspectRatio(null);
        setCurrentIndex(boundedIndex);
        const video = videoPlayerRef.current;
        video.showNowPlayingNotification = true;
        video.replace(videoSourceFor(entry, uri, rendition));
        setVideoRendition(rendition);
        if (startMs > 0) {
          // iOS keeps a seek made while the source loads; the others take it once ready.
          video.currentTime = startMs / 1000;
          pendingVideoSeekMs.current = startMs;
        }
        restorePositionMs.current = null;
        pendingPlay.current = autoplay;
        if (autoplay) video.play();
        whenWebVideoReady(videoReady);
        return;
      }

      const uri = await resolveAudioUri(entry);
      if (requestId !== sourceRequestId.current) return;
      if (!uri) throw new Error('No playable local or remote source is available.');

      stopVideoEngine();
      setCurrentIndex(boundedIndex);
      player.replace({
        uri,
        headers: entry.playable.source.headers ?? undefined,
        name: entry.playable.title,
      });

      restorePositionMs.current = startMs > 0 ? startMs : null;
      if (autoplay) player.play();
    } catch (cause) {
      if (requestId !== sourceRequestId.current) return;
      setPlaybackError(cause instanceof Error ? cause.message : 'Unable to load audio.');
      player.pause();
      videoPlayerRef.current.pause();
    } finally {
      if (requestId === sourceRequestId.current) setLoadingSource(false);
    }
  }, [player, startingRenditionFor, stopAudioEngine, stopVideoEngine, videoReady]);

  const playQueue = useCallback((items: PlaybackQueueEntry[], startIndex = 0) => {
    if (!items.length) return;
    const original = [...items];
    const safeIndex = clampPlaybackIndex(original.length, startIndex);
    const nextState = shuffleEnabled
      ? shuffleQueuePreservingCurrent(original, safeIndex)
      : { queue: original, currentIndex: safeIndex };

    setOriginalQueue(original);
    setQueue(nextState.queue);
    void loadEntry(nextState.queue, nextState.currentIndex, true);
  }, [loadEntry, shuffleEnabled]);

  const playItem = useCallback((item: PlaybackQueueEntry) => {
    setOriginalQueue([item]);
    setQueue([item]);
    void loadEntry([item], 0, true);
  }, [loadEntry]);

  const addNext = useCallback((item: PlaybackQueueEntry) => {
    if (!queue.length || currentIndex < 0) {
      playItem(item);
      return;
    }
    const nextState = insertQueueEntry(queue, currentIndex, item, 'next');
    setQueue(nextState.queue);
    if (!shuffleEnabled) {
      setOriginalQueue(nextState.queue);
    } else {
      const originalIndex = originalQueue.findIndex((entry) => entry.key === queue[currentIndex]?.key);
      setOriginalQueue(insertQueueEntry(originalQueue, originalIndex, item, 'next').queue);
    }
  }, [currentIndex, originalQueue, playItem, queue, shuffleEnabled]);

  const addToEnd = useCallback((item: PlaybackQueueEntry) => {
    if (!queue.length || currentIndex < 0) {
      playItem(item);
      return;
    }
    setQueue(insertQueueEntry(queue, currentIndex, item, 'end').queue);
    setOriginalQueue(insertQueueEntry(originalQueue, currentIndex, item, 'end').queue);
  }, [currentIndex, originalQueue, playItem, queue]);

  const togglePlayback = useCallback(() => {
    if (!currentItem) return;
    if (activeEngine === 'video') {
      const video = videoPlayerRef.current;
      if (playing) video.pause();
      else video.play();
      // Paused or resumed while loading or mid-swap, it stays that way once ready.
      pendingPlay.current = !playing;
      if (swapRef.current) swapRef.current = { ...swapRef.current, wasPlaying: !playing };
      setVideoSwitch((current) => (current ? { ...current, wasPlaying: !playing } : current));
      return;
    }
    // `playing` rather than the raw status: during the start-up window the
    // status still says false, and pressing pause then would restart playback.
    if (playing) player.pause();
    else player.play();
  }, [activeEngine, currentItem, player, playing]);

  const seekToMs = useCallback(async (positionMs: number) => {
    const knownDurationMs = Math.max(durationMs, currentItem?.playable.durationMs ?? 0);
    const safeMs = Math.max(0, knownDurationMs > 0 ? Math.min(positionMs, knownDurationMs) : positionMs);
    if (activeEngine === 'video') {
      if (swapRef.current) swapRef.current = { ...swapRef.current, positionMs: safeMs };
      setVideoSwitch((current) => (current ? { ...current, positionMs: safeMs } : current));
      pendingVideoSeekMs.current = videoSwitching ? safeMs : null;
      videoPlayerRef.current.currentTime = safeMs / 1000;
      return;
    }
    await player.seekTo(safeMs / 1000);
  }, [activeEngine, currentItem?.playable.durationMs, durationMs, player, videoSwitching]);

  const seekToStart = useCallback(() => {
    if (activeEngine === 'video') {
      videoPlayerRef.current.currentTime = 0;
      return;
    }
    void player.seekTo(0);
  }, [activeEngine, player]);

  const next = useCallback(() => {
    if (!queue.length || currentIndex < 0) return;
    const nextIndex = getManualNextIndex(queue.length, currentIndex, repeatMode);
    if (nextIndex === currentIndex) return;
    void loadEntry(queue, nextIndex, true);
  }, [currentIndex, loadEntry, queue, repeatMode]);

  const previous = useCallback(() => {
    if (!queue.length || currentIndex < 0) return;
    if (currentTimeMs > 4000) {
      seekToStart();
      return;
    }
    const previousIndex = getManualPreviousIndex(queue.length, currentIndex, repeatMode);
    if (previousIndex === currentIndex) {
      seekToStart();
      return;
    }
    void loadEntry(queue, previousIndex, true);
  }, [currentIndex, currentTimeMs, loadEntry, queue, repeatMode, seekToStart]);

  const selectQueueIndex = useCallback((index: number) => {
    if (index < 0 || index >= queue.length) return;
    void loadEntry(queue, index, true);
  }, [loadEntry, queue]);

  const moveQueueItem = useCallback((fromIndex: number, toIndex: number) => {
    const moved = moveQueueEntry(queue, currentIndex, fromIndex, toIndex);
    setQueue(moved.queue);
    setCurrentIndex(moved.currentIndex);
    // Without shuffle the queue *is* the listening order, so a manual reorder
    // must survive toggling shuffle on and off again.
    if (!shuffleEnabled) setOriginalQueue(moved.queue);
  }, [currentIndex, queue, shuffleEnabled]);

  const clearUpcoming = useCallback(() => {
    const kept = keepOnlyCurrentEntry(queue, currentIndex);
    setQueue(kept.queue);
    setOriginalQueue(kept.queue);
    setCurrentIndex(kept.currentIndex);
  }, [currentIndex, queue]);

  const updateQueueEntries = useCallback((update: (entry: PlaybackQueueEntry) => PlaybackQueueEntry) => {
    setQueue((entries) => entries.map(update));
    setOriginalQueue((entries) => entries.map(update));
  }, []);

  const clearQueue = useCallback(() => {
    sourceRequestId.current += 1;
    stopAudioEngine();
    stopVideoEngine();
    setQueue([]);
    setOriginalQueue([]);
    setCurrentIndex(-1);
    setPlaybackError(null);
    void savePlaybackSnapshot(null);
  }, [stopAudioEngine, stopVideoEngine]);

  const cycleRepeatMode = useCallback(() => {
    setRepeatMode((current) => nextRepeatMode(current));
  }, []);

  const toggleShuffle = useCallback(() => {
    if (!queue.length || currentIndex < 0) {
      setShuffleEnabled((value) => !value);
      return;
    }

    if (!shuffleEnabled) {
      const shuffled = shuffleQueuePreservingCurrent(queue, currentIndex);
      setQueue(shuffled.queue);
      setCurrentIndex(shuffled.currentIndex);
      setShuffleEnabled(true);
      return;
    }

    const restored = restoreOriginalQueue(originalQueue.length ? originalQueue : queue, queue, currentIndex);
    setQueue(restored.queue);
    setCurrentIndex(restored.currentIndex);
    setShuffleEnabled(false);
  }, [currentIndex, originalQueue, queue, shuffleEnabled]);

  useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    });
  }, []);

  // Media Session action handlers outlive renders, so they read the latest
  // queue navigation through refs instead of capturing stale callbacks.
  const nextRef = useRef<() => void>(() => undefined);
  const previousRef = useRef<() => void>(() => undefined);
  const togglePlaybackRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    const webGlobal = globalThis as unknown as {
      navigator?: {
        mediaSession?: {
          metadata: unknown | null;
          setActionHandler?: (action: string, handler: (() => void) | null) => void;
        };
      };
      MediaMetadata?: new (init: {
        title?: string;
        artist?: string;
        album?: string;
        artwork?: { src: string; type?: string }[];
      }) => unknown;
    };

    if (!currentItem) {
      player.setActiveForLockScreen(false);
      if (Platform.OS === 'web' && webGlobal.navigator?.mediaSession) {
        webGlobal.navigator.mediaSession.metadata = null;
      }
      return;
    }

    const playable = currentItem.playable;
    const metadata = {
      title: playable.title,
      artist: playable.artist ?? undefined,
      albumTitle: playable.albumTitle ?? undefined,
      artworkUrl: playable.artworkUri ?? undefined,
    };
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (activeEngine === 'audio') {
      // Coptic Vine is a queue player: where the build can show the lock
      // screen's track buttons (iOS, trackControls.ts) they replace expo-audio's
      // 10-second skips, as on the web below.
      const activate = () => {
        player.setActiveForLockScreen(true, metadata, {
          showSeekBackward: !hasTrackControls,
          showSeekForward: !hasTrackControls,
        });
        player.updateLockScreenMetadata(metadata);
      };
      activate();
      // The video player clears the lock screen a moment after it lets go of
      // it; a lesson handing over to a song is written once more after that.
      timer = setTimeout(activate, 600);
    } else {
      // The video player carries its own metadata (VideoSource.metadata).
      player.setActiveForLockScreen(false);
    }

    // expo-audio owns playback on web, but Chrome's global media controls use
    // the Media Session API for the rich card. Set that metadata explicitly so
    // Coptic Vine gets the same album-art treatment as YouTube and SoundCloud.
    if (Platform.OS === 'web' && webGlobal.navigator?.mediaSession && webGlobal.MediaMetadata) {
      webGlobal.navigator.mediaSession.metadata = new webGlobal.MediaMetadata({
        title: playable.title,
        artist: playable.artist ?? undefined,
        album: playable.albumTitle ?? undefined,
        artwork: playable.artworkUri ? [{ src: playable.artworkUri, type: 'image/jpeg' }] : undefined,
      });

      // expo-audio maps Chrome's previous/next buttons to 10-second seeks.
      // Coptic Vine is a queue player, so those buttons should change tracks.
      const session = webGlobal.navigator.mediaSession;
      try {
        session.setActionHandler?.('nexttrack', () => nextRef.current());
        session.setActionHandler?.('previoustrack', () => previousRef.current());
        // The video element has no handlers of its own; the audio player sets its own.
        session.setActionHandler?.('play', activeEngine === 'video' ? () => togglePlaybackRef.current() : null);
        session.setActionHandler?.('pause', activeEngine === 'video' ? () => togglePlaybackRef.current() : null);
      } catch {
        // Older browsers reject unknown actions; the basic controls still work.
      }
    }
    return () => { if (timer) clearTimeout(timer); };
  }, [activeEngine, currentItem, player]);

  // Set again on every new source as well as on a change of speed: a
  // replaced source starts at the player's default rate.
  const playbackRate = currentItem?.playable.kind === 'learning_audio' ? learningRate : 1;
  const currentKey = currentItem?.key ?? null;
  useEffect(() => {
    if (!currentKey) return;
    if (activeEngine === 'video') {
      videoPlayerRef.current.playbackRate = playbackRate;
      return;
    }
    if (!status.isLoaded) return;
    player.setPlaybackRate(playbackRate);
  }, [activeEngine, currentKey, playbackRate, player, status.isLoaded, videoRendition]);

  useEffect(() => {
    const requestedPosition = restorePositionMs.current;
    if (requestedPosition == null || !status.isLoaded) return;
    restorePositionMs.current = null;
    void player.seekTo(requestedPosition / 1000);
  }, [player, status.isLoaded]);

  useEventListener(videoPlayer, 'statusChange', (payload) => {
    if (payload.status === 'error') {
      setPlaybackError(payload.error?.message ?? 'Unable to play this lesson.');
      swapRef.current = null;
      pendingPlay.current = false;
      setVideoSwitch(null);
      return;
    }
    if (payload.status === 'readyToPlay') videoReady();
  });

  useEventListener(videoPlayer, 'sourceLoad', (payload) => {
    if (Number.isFinite(payload.duration) && payload.duration > 0) setVideoDurationMs(Math.round(payload.duration * 1000));
    const track = payload.availableVideoTracks?.[0];
    if (track?.size && track.size.width > 0 && track.size.height > 0) setMeasuredAspectRatio(track.size.width / track.size.height);
  });

  // didJustFinish stays true until the *next* source reports its first status.
  // Advancing changes currentIndex, which re-runs this effect while the stale
  // flag is still set, so without an edge check one finished track would skip
  // straight through the rest of the queue and stop on the last entry.
  const finishHandled = useRef(false);
  const finishCurrent = useCallback(() => {
    if (currentIndex < 0) return;
    const entry = queue[currentIndex];
    if (isLearningEntry(entry)) {
      const length = Math.max(durationMs, entry.playable.durationMs ?? 0);
      void saveLearningResume(entry.playable.id, length, length || null);
    }
    const action = getFinishedTrackAction(queue.length, currentIndex, repeatMode);
    const video = videoPlayerRef.current;
    if (action.type === 'replay') {
      if (activeEngine === 'video') {
        video.currentTime = 0;
        video.play();
      } else {
        void player.seekTo(0).then(() => player.play());
      }
      return;
    }
    if (action.type === 'advance') {
      void loadEntry(queue, action.index, true);
      return;
    }
    if (activeEngine === 'video') video.pause();
    else player.pause();
  }, [activeEngine, currentIndex, durationMs, loadEntry, player, queue, repeatMode]);
  const finishCurrentRef = useRef(finishCurrent);
  useEffect(() => {
    finishCurrentRef.current = finishCurrent;
  }, [finishCurrent]);
  useEffect(() => {
    if (!status.didJustFinish) {
      finishHandled.current = false;
      return;
    }
    if (finishHandled.current || currentIndex < 0 || activeEngine !== 'audio') return;
    finishHandled.current = true;
    finishCurrent();
  }, [activeEngine, currentIndex, finishCurrent, status.didJustFinish]);
  useEventListener(videoPlayer, 'playToEnd', () => {
    if (currentItemRef.current && entryHasVideo(currentItemRef.current)) finishCurrentRef.current();
  });

  useEffect(() => {
    let active = true;
    Promise.all([loadPlaybackSnapshot(), loadLearningResume()])
      .then(([snapshot]) => {
        if (!active || !snapshot || !snapshot.queue.length) return;
        setQueue(snapshot.queue);
        setOriginalQueue(snapshot.originalQueue.length ? snapshot.originalQueue : snapshot.queue);
        setCurrentIndex(snapshot.currentIndex);
        setRepeatMode(snapshot.repeatMode);
        setShuffleEnabled(snapshot.shuffleEnabled);
        void loadEntry(snapshot.queue, snapshot.currentIndex, false, snapshot.positionMs);
      })
      .finally(() => {
        if (active) setHydrated(true);
      });
    return () => { active = false; };
  }, [loadEntry]);

  const persistenceBucket = Math.floor(currentTimeMs / 5000);
  useEffect(() => {
    if (!hydrated || !queue.length || currentIndex < 0) return;
    const snapshot: PlaybackSnapshot = {
      version: 1,
      queue,
      originalQueue: originalQueue.length ? originalQueue : queue,
      currentIndex,
      positionMs: persistenceBucket * 5000,
      repeatMode,
      shuffleEnabled,
    };
    void savePlaybackSnapshot(snapshot);
  }, [currentIndex, hydrated, originalQueue, persistenceBucket, queue, repeatMode, shuffleEnabled]);

  // Where each lesson was left, for picking it up again later (utils/learningResume.ts).
  const resumeDurationMs = durationMs || currentItem?.playable.durationMs || null;
  useEffect(() => {
    if (!hydrated || !playing || !isLearningEntry(currentItem)) return;
    void saveLearningResume(currentItem.playable.id, persistenceBucket * 5000, resumeDurationMs);
  }, [currentItem, hydrated, persistenceBucket, playing, resumeDurationMs]);

  useEffect(() => {
    nextRef.current = next;
    previousRef.current = previous;
    togglePlaybackRef.current = togglePlayback;
  }, [next, previous, togglePlayback]);

  // The lock screen's next button greys out at the end of the queue, as the
  // player's own does; previous always works while something plays, going
  // back to the start of the track if nothing comes before it.
  const hasCurrentItem = currentItem != null;
  const canGoNext = hasCurrentItem && getManualNextIndex(queue.length, currentIndex, repeatMode) !== currentIndex;
  useEffect(() => {
    setTrackControls(canGoNext, hasCurrentItem);
  }, [canGoNext, hasCurrentItem]);

  useEffect(() => {
    const subscriptions = [
      addTrackControlListener('onNextTrack', () => nextRef.current()),
      addTrackControlListener('onPreviousTrack', () => previousRef.current()),
    ];
    return () => subscriptions.forEach((subscription) => subscription?.remove());
  }, []);

  // Swapping the picture for the sound alone (or back) at the same place.
  const switchRendition = useCallback(async (to: LessonRendition) => {
    const entry = currentItemRef.current;
    if (!entry || !entryHasVideo(entry)) return;
    const requestId = ++videoRequestId.current;
    const uri = await resolveRenditionUri(entry, to);
    if (requestId !== videoRequestId.current || !uri) return;
    const video = videoPlayerRef.current;
    const positionMs = Math.max(0, Math.round(video.currentTime * 1000));
    const wasPlaying = video.playing;
    swapRef.current = { positionMs, wasPlaying };
    setVideoSwitch({ positionMs, wasPlaying });
    video.replace(videoSourceFor(entry, uri, to));
    setVideoRendition(to);
    video.currentTime = positionMs / 1000;
    pendingVideoSeekMs.current = positionMs;
    video.playbackRate = playbackRate;
    pendingPlay.current = wasPlaying;
    // Started here as well where that works (the native players); the web
    // player starts from its ready event, as a play() now would be thrown away.
    if (wasPlaying && Platform.OS !== 'web') video.play();
    whenWebVideoReady(videoReady);
  }, [playbackRate, videoReady]);

  // The rendition follows the rules with a short grace for navigation: a
  // page swap passes through "nowhere" on the way to the next page.
  const previousInputs = useRef({ mode: lessonVideoMode, pictureInPicture: videoPresentation.pictureInPicture, cellularBlocked });
  useEffect(() => {
    const cause: 'mode' | 'placement' | 'network' | 'pip' = previousInputs.current.mode !== lessonVideoMode
      ? 'mode'
      : previousInputs.current.pictureInPicture !== videoPresentation.pictureInPicture
        ? 'pip'
        : previousInputs.current.cellularBlocked !== cellularBlocked ? 'network' : 'placement';
    previousInputs.current = { mode: lessonVideoMode, pictureInPicture: videoPresentation.pictureInPicture, cellularBlocked };
    if (!currentHasVideo || !videoRendition || loadingSource || videoSwitching) return;
    if (desiredRendition === videoRendition) return;
    const delay = renditionSwitchDelayMs(videoRendition, desiredRendition, cause);
    const timer = setTimeout(() => void switchRendition(desiredRendition), delay);
    return () => clearTimeout(timer);
  }, [cellularBlocked, currentHasVideo, desiredRendition, lessonVideoMode, loadingSource, switchRendition, videoPresentation.pictureInPicture, videoRendition, videoSwitching]);

  const setVideoPresentation = useCallback((presentation: VideoPresentation) => {
    setVideoPresentationState((current) => (samePresentation(current, presentation) ? current : presentation));
  }, []);

  const allowVideoOverCellularNow = useCallback(() => setCellularOverride(true), []);
  const setLessonVideoMode = useCallback((mode: LessonVideoMode) => setLessonVideoModePreference(mode), [setLessonVideoModePreference]);

  const videoAspectRatio = measuredAspectRatio ?? currentItem?.playable.videoAspectRatio ?? null;

  const value = useMemo<PlaybackContextValue>(() => ({
    queue,
    currentIndex,
    currentItem,
    playing,
    buffering,
    loadingSource,
    currentTimeMs,
    durationMs,
    repeatMode,
    shuffleEnabled,
    playbackError,
    playQueue,
    playItem,
    addNext,
    addToEnd,
    togglePlayback,
    next,
    previous,
    seekToMs,
    selectQueueIndex,
    moveQueueItem,
    clearUpcoming,
    clearQueue,
    updateQueueEntries,
    hydrated,
    cycleRepeatMode,
    toggleShuffle,
    learningRate,
    setLearningRate,
    activeEngine,
    currentHasVideo,
    videoPlayer,
    lessonVideoMode,
    setLessonVideoMode,
    videoRendition,
    videoSwitching,
    videoAspectRatio,
    setVideoPresentation,
    videoPresentation,
    cellularBlocked,
    allowVideoOverCellularNow,
  }), [
    activeEngine,
    addNext,
    addToEnd,
    allowVideoOverCellularNow,
    buffering,
    cellularBlocked,
    clearQueue,
    clearUpcoming,
    currentHasVideo,
    currentIndex,
    currentItem,
    currentTimeMs,
    cycleRepeatMode,
    durationMs,
    hydrated,
    learningRate,
    lessonVideoMode,
    loadingSource,
    moveQueueItem,
    next,
    playItem,
    playQueue,
    playbackError,
    playing,
    previous,
    queue,
    repeatMode,
    seekToMs,
    selectQueueIndex,
    setLessonVideoMode,
    setVideoPresentation,
    shuffleEnabled,
    togglePlayback,
    toggleShuffle,
    updateQueueEntries,
    videoAspectRatio,
    videoPlayer,
    videoPresentation,
    videoRendition,
    videoSwitching,
  ]);

  return <PlaybackContext.Provider value={value}>{children}</PlaybackContext.Provider>;
}

export function usePlayback(): PlaybackContextValue {
  const value = useContext(PlaybackContext);
  if (!value) throw new Error('usePlayback must be used inside PlaybackProvider.');
  return value;
}
