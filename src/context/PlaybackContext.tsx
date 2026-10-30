import { useEvent, useEventListener } from 'expo';
import { setAudioModeAsync, useAudioPlayerStatus, type AudioMode } from 'expo-audio';
import * as Network from 'expo-network';
import type { VideoPlayer, VideoSource } from 'expo-video';
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
  useSyncExternalStore,
} from 'react';

import { useReadingPreferences } from '@/context/ReadingPreferencesContext';
import { downloadManager } from '@/services/downloadManager';
import type { PlaybackQueueEntry, PlaybackRepeatMode, PlaybackSnapshot } from '@/types/playback';
import { readLiveSession, usePlaybackPlayers, writeLiveSession } from '@/utils/livePlayback';
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
  pictureVisible,
  type RenditionCause,
  renditionSwitchDelayMs,
  startingPictureVisible,
} from '@/utils/lessonPlayback';
import { lessonVideoElement } from '@/utils/lessonVideoElement';
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
  removeQueueEntry,
  restoreOriginalQueue,
  shuffleQueuePreservingCurrent,
} from '@/utils/playbackEngine';
import {
  loadPlaybackSnapshot,
  localPlaybackUriExists,
  reloadPointFor,
  savePlaybackSnapshot,
  saveReloadPoint,
} from '@/utils/playbackStateStorage';
import { clampVolume, PLAYER_VOLUME_ADJUSTABLE } from '@/utils/playerVolume';
import { addTrackControlListener, hasTrackControls, setTrackControls } from '@/utils/trackControls';

/** Which player an entry plays on: the audio player, or the video player for a lesson with a picture. */
export type PlaybackEngine = 'audio' | 'video';

/** Where the picture can be drawn, as the stage reports it (context/VideoStageContext.tsx). */
export interface VideoPresentation {
  /** A surface (the bar's thumbnail, the full player) is mounted to show the picture. */
  surfaceShowing: boolean;
  /** A now-playing bar is out, so a new lesson's picture will show in its thumbnail. */
  barShowsPicture: boolean;
  pictureInPicture: boolean;
}

export interface PlaybackContextValue {
  queue: PlaybackQueueEntry[];
  currentIndex: number;
  currentItem: PlaybackQueueEntry | null;
  playing: boolean;
  buffering: boolean;
  loadingSource: boolean;
  /** Where playback is, the moment it changes, comes from usePlaybackClock instead. */
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
  /** Takes one entry out of the queue; what plays keeps playing (it is never the one taken out). */
  removeQueueItem: (index: number) => void;
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
  /**
   * The volume bar's level, 0 to 1: one level for both players and every
   * entry, kept for the next time the app is opened (utils/playerVolume.ts).
   */
  volume: number;
  setVolume: (volume: number) => void;

  /** The player the current entry plays on. */
  activeEngine: PlaybackEngine;
  /** The current entry is a lesson with a picture (it plays on the video player either way). */
  currentHasVideo: boolean;
  /** The video player, for the surfaces that draw it (components/playback/LessonVideoSurface.tsx). */
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
  /** The stage reports where the picture can be drawn, so it is streamed only while it can be seen. */
  setVideoPresentation: (presentation: VideoPresentation) => void;
  /**
   * The full player is about to open for the lesson being started, to watch
   * it: its picture is fetched the first time rather than its sound alone.
   */
  expectVideoSurface: () => void;
  /** On cellular data with video not allowed over it: the lesson plays as sound alone. */
  cellularBlocked: boolean;
  /** "Play the video anyway": allows the picture over cellular until the app is next opened. */
  allowVideoOverCellularNow: () => void;
}

const PlaybackContext = createContext<PlaybackContextValue | null>(null);

/** Where playback is in the current entry. */
export interface PlaybackClock {
  currentTimeMs: number;
  durationMs: number;
}

/**
 * The clock moves eight times a second while anything plays, so it is kept
 * out of PlaybackContext: there, every page that reads the player (a whole
 * album, the Learn library) was drawn again at each tick. Only what shows the
 * clock -- the seek bar, the bar's progress line, the lyric that is sung --
 * subscribes to it, and each only for the part it shows.
 */
export interface PlaybackClockStore {
  get: () => PlaybackClock;
  subscribe: (listener: () => void) => () => void;
}

const PlaybackClockContext = createContext<PlaybackClockStore | null>(null);

function createPlaybackClockStore(): PlaybackClockStore & { publish: (clock: PlaybackClock) => void } {
  let clock: PlaybackClock = { currentTimeMs: 0, durationMs: 0 };
  const listeners = new Set<() => void>();
  return {
    get: () => clock,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    publish: (next) => {
      if (next.currentTimeMs === clock.currentTimeMs && next.durationMs === clock.durationMs) return;
      clock = next;
      listeners.forEach((listener) => listener());
    },
  };
}

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
 * new source can play. The lesson's one <video> lives in the home view,
 * or in the surface showing it (components/playback/LessonVideoHome.web.tsx).
 */
function whenWebVideoReady(callback: () => void): void {
  if (Platform.OS !== 'web') return;
  const element = lessonVideoElement();
  if (!element) return;
  if (element.readyState >= 3) {
    callback();
    return;
  }
  element.addEventListener('canplay', callback, { once: true });
}

/**
 * The audio session songs play in. It must not mix with other apps: iOS
 * gives the lock screen, Control Center and CarPlay's Now Playing only to an
 * app whose sound does not mix, so expo-audio's lock screen needs doNotMix.
 */
const PLAYBACK_AUDIO_MODE: Partial<AudioMode> = {
  playsInSilentMode: true,
  shouldPlayInBackground: true,
  interruptionMode: 'doNotMix',
};

/** The video player's settings, made once (utils/livePlayback). */
function setupVideoPlayer(instance: VideoPlayer): void {
  instance.loop = false;
  instance.staysActiveInBackground = true;
  instance.audioMixingMode = 'doNotMix';
  instance.timeUpdateEventInterval = 0.25;
  // Half a minute ahead, not iOS's own choice (minutes of a long lesson):
  // what is fetched and never watched, when the listener switches to the
  // sound alone or stops, is data spent for nothing.
  instance.bufferOptions = { preferredForwardBufferDuration: 30, waitsToMinimizeStalling: true };
  // The screen stays on only while the picture plays (set with each rendition).
  instance.keepScreenOnWhilePlaying = false;
}

/**
 * Puts a rendition on the video player at a place in it, playing or not.
 * iOS loads the item off the main thread (replace would block it); the web
 * player starts each new source by itself, so it is paused again there if it
 * should not play.
 */
// VPROBE (temporary): device diagnostics in Metro's log.
const vprobe = (...args: unknown[]) => { if (__DEV__) console.log('[vprobe]', ...args); };

async function replaceVideoSource(video: VideoPlayer, source: VideoSource, options: {
  positionMs: number;
  play: boolean;
  rendition: LessonRendition;
  volume: number;
  rate: number | null;
}): Promise<void> {
  vprobe('replace start', Platform.OS, typeof (source as { uri?: string })?.uri === 'string' ? (source as { uri: string }).uri.split('/').pop() : source, options);
  try {
    if (Platform.OS === 'ios') await video.replaceAsync(source);
    else video.replace(source);
  } catch (cause) {
    vprobe('replace threw', String(cause));
    throw cause;
  }
  vprobe('replace done; status', video.status, 'playing', video.playing);
  video.keepScreenOnWhilePlaying = options.rendition === 'video';
  if (PLAYER_VOLUME_ADJUSTABLE) video.volume = options.volume;
  if (options.rate != null) video.playbackRate = options.rate;
  // iOS keeps a seek made while the item loads; the others take it again once ready (videoReady).
  if (options.positionMs > 0) video.currentTime = options.positionMs / 1000;
  if (Platform.OS === 'web') {
    if (!options.play) video.pause();
  } else if (options.play) {
    video.play();
    vprobe('play() called; playing now', video.playing);
  }
}

/**
 * A play() the browser gives up on — interrupted by a pause or a new source,
 * or refused until the listener first touches the page — rejects a promise
 * expo-video doesn't catch. Both are expected here (replaceVideoSource,
 * armResumeOnGesture); any other rejection still reports.
 */
function quietInterruptedPlay(event: PromiseRejectionEvent): void {
  const reason = event.reason as { name?: string; message?: string } | null;
  if ((reason?.name === 'AbortError' || reason?.name === 'NotAllowedError') && String(reason.message ?? '').includes('play()')) {
    event.preventDefault();
  }
}

/**
 * Chrome's previous/next track buttons, and a keyboard's media keys, change
 * tracks. expo-audio maps them to 10-second seeks, and sets them again each
 * time it takes the media session (on activation, and on every new source),
 * so they are taken back after each of those.
 */
function claimWebTrackButtons(next: () => void, previous: () => void): void {
  if (Platform.OS !== 'web') return;
  const session = (globalThis as unknown as {
    navigator?: { mediaSession?: { setActionHandler?: (action: string, handler: (() => void) | null) => void } };
  }).navigator?.mediaSession;
  try {
    session?.setActionHandler?.('nexttrack', next);
    session?.setActionHandler?.('previoustrack', previous);
  } catch {
    // Older browsers reject unknown actions; the basic controls still work.
  }
}

const HIDDEN_PRESENTATION: VideoPresentation = { surfaceShowing: false, barShowsPicture: false, pictureInPicture: false };
/** How long a page that opens the full player to watch a lesson is taken at its word. */
const SURFACE_EXPECTED_MS = 3000;

function samePresentation(a: VideoPresentation, b: VideoPresentation): boolean {
  return a.surfaceShowing === b.surfaceShowing && a.barShowsPicture === b.barShowsPicture && a.pictureInPicture === b.pictureInPicture;
}

export function PlaybackProvider({ children }: { children: ReactNode }) {
  const { preferences, setLessonVideoMode: setLessonVideoModePreference, setPlayerVolume } = useReadingPreferences();
  const lessonVideoMode = preferences.lessonVideoMode;
  const lessonVideoOnCellular = preferences.lessonVideoOnCellular;

  // The second player, `videoPlayer`: a lesson with a picture plays on it
  // whether the picture shows or not, so showing and hiding the video never
  // changes players (and never loses the place). On the web both outlive a
  // rebuild of the app's root, and the session with them (utils/livePlayback).
  const { player, videoPlayer } = usePlaybackPlayers(setupVideoPlayer);
  const status = useAudioPlayerStatus(player);
  const [live] = useState(readLiveSession);
  const videoPlayingEvent = useEvent(videoPlayer, 'playingChange', { isPlaying: false, oldIsPlaying: false });
  const videoStatusEvent = useEvent(videoPlayer, 'statusChange', { status: 'idle' as const });
  const videoTimeEvent = useEvent(videoPlayer, 'timeUpdate', { currentTime: 0, currentLiveTimestamp: null, currentOffsetFromLive: null, bufferedPosition: 0 });

  const [queue, setQueue] = useState<PlaybackQueueEntry[]>(live?.queue ?? []);
  const [originalQueue, setOriginalQueue] = useState<PlaybackQueueEntry[]>(live?.originalQueue ?? []);
  const [currentIndex, setCurrentIndex] = useState(live?.currentIndex ?? -1);
  const [repeatMode, setRepeatMode] = useState<PlaybackRepeatMode>(live?.repeatMode ?? 'off');
  const [shuffleEnabled, setShuffleEnabled] = useState(live?.shuffleEnabled ?? false);
  const [loadingSource, setLoadingSource] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  // A session carried over from before a rebuild is already in place.
  const [hydrated, setHydrated] = useState(live != null);
  const [learningRate, setLearningRate] = useState(live?.learningRate ?? 1);
  // The bar's level while it moves, ahead of the saved preference: saved to
  // the device once the bar has come to rest, not at every step of a drag.
  const [movingVolume, setMovingVolume] = useState<number | null>(null);
  const volume = movingVolume ?? preferences.playerVolume;
  const volumeRef = useRef(volume);
  const sourceRequestId = useRef(0);
  const restorePositionMs = useRef<number | null>(null);

  // The video player's own state.
  const [videoRendition, setVideoRendition] = useState<LessonRendition | null>(live?.videoRendition ?? null);
  const [videoDurationMs, setVideoDurationMs] = useState(live?.videoDurationMs ?? 0);
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
  // The audio player's volume likewise.
  const audioPlayerRef = useRef(player);
  // Media Session action handlers outlive renders, so they read the latest
  // queue navigation through refs instead of capturing stale callbacks.
  const nextRef = useRef<() => void>(() => undefined);
  const previousRef = useRef<() => void>(() => undefined);
  const togglePlaybackRef = useRef<() => void>(() => undefined);
  const claimTrackButtons = useCallback(() => {
    claimWebTrackButtons(() => nextRef.current(), () => previousRef.current());
  }, []);
  // After a reload Chrome may refuse to start sound until the listener touches
  // the page; then playback carries on at their first click or key instead.
  const resumeOnGesture = useRef(false);
  const playingRef = useRef(false);

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
  useEffect(() => {
    playingRef.current = playing;
    if (playing) resumeOnGesture.current = false;
  }, [playing]);
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

  const [clock] = useState(createPlaybackClockStore);
  useEffect(() => {
    clock.publish({ currentTimeMs, durationMs });
  }, [clock, currentTimeMs, durationMs]);

  // The rendition the rules call for right now (utils/lessonPlayback.ts).
  const network = Network.useNetworkState();
  const onCellular = network.type === Network.NetworkStateType.CELLULAR;
  const cellularBlocked = onCellular && !lessonVideoOnCellular && !cellularOverride;
  const desiredRendition = lessonRendition({
    hasVideo: currentHasVideo,
    mode: lessonVideoMode,
    pictureVisible: pictureVisible({ surfaceShowing: videoPresentation.surfaceShowing, appActive, pictureInPicture: videoPresentation.pictureInPicture }),
    cellularBlocked,
  });
  // The same inputs as last rendered, for a load started from an event: a new
  // entry's first rendition is decided from where its picture will be.
  const renditionInputsRef = useRef({ mode: lessonVideoMode, cellularBlocked, appActive, presentation: videoPresentation });
  useEffect(() => {
    renditionInputsRef.current = { mode: lessonVideoMode, cellularBlocked, appActive, presentation: videoPresentation };
  }, [appActive, cellularBlocked, lessonVideoMode, videoPresentation]);
  // Until when a page that opened the full player to watch a lesson is taken at its word (expectVideoSurface).
  const surfaceExpectedUntil = useRef(0);
  const startingRenditionFor = useCallback((): LessonRendition => {
    const { mode, cellularBlocked: blocked, appActive: active, presentation } = renditionInputsRef.current;
    return lessonRendition({
      hasVideo: true,
      mode,
      pictureVisible: startingPictureVisible({
        surfaceShowing: presentation.surfaceShowing,
        barShowsPicture: presentation.barShowsPicture,
        surfaceExpected: Date.now() < surfaceExpectedUntil.current,
        appActive: active,
        pictureInPicture: presentation.pictureInPicture,
      }),
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
      // Only while it is on. Each write makes expo-video set the shared audio
      // session again, and with no lesson playing it lets the sound mix with
      // other apps, so the song that follows never reaches Now Playing.
      if (video.showNowPlayingNotification) video.showNowPlayingNotification = false;
      video.replace(null);
    } catch {
      // A player already torn down has nothing to stop.
    }
  }, []);

  const stopAudioEngine = useCallback(() => {
    player.pause();
    player.setActiveForLockScreen(false);
    // Only the web's player takes no source: iOS's and Android's throw on
    // one, which stopped every lesson with a picture loading there. Paused
    // and off the lock screen, the song is stopped.
    if (Platform.OS === 'web') player.replace(null);
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

      vprobe('loadEntry', entry.playable.title, 'video?', entryHasVideo(entry), 'autoplay', autoplay, 'startMs', startMs);
      if (entryHasVideo(entry)) {
        const [pictureUri, soundUri] = await Promise.all([resolveVideoUri(entry), resolveAudioUri(entry)]);
        vprobe('uris', pictureUri, soundUri, 'stale?', requestId !== sourceRequestId.current);
        if (requestId !== sourceRequestId.current) return;
        // Fetched right the first time: the rendition for where the picture
        // will be, decided once both are known, so a page that opened the
        // full player to watch this lesson has had its say (expectVideoSurface).
        const wanted = startingRenditionFor();
        const rendition: LessonRendition = wanted === 'video' && pictureUri ? 'video' : 'audio';
        const uri = rendition === 'video' ? pictureUri : soundUri ?? pictureUri;
        vprobe('rendition', wanted, '->', rendition, 'inputs', JSON.stringify(renditionInputsRef.current));
        if (!uri) throw new Error('No playable local or remote source is available.');

        // One player at a time owns the sound and the lock screen.
        stopAudioEngine();
        const videoRequest = ++videoRequestId.current;
        pendingVideoSeekMs.current = startMs > 0 ? startMs : null;
        swapRef.current = null;
        setVideoSwitch(null);
        setVideoDurationMs(entry.playable.durationMs ?? 0);
        setMeasuredAspectRatio(null);
        setCurrentIndex(boundedIndex);
        setVideoRendition(rendition);
        restorePositionMs.current = null;
        pendingPlay.current = autoplay;
        const video = videoPlayerRef.current;
        video.showNowPlayingNotification = true;
        await replaceVideoSource(video, videoSourceFor(entry, uri, rendition), {
          positionMs: startMs, play: autoplay, rendition, volume: volumeRef.current, rate: null,
        });
        if (videoRequest !== videoRequestId.current) return;
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
      // The web player builds a new element for each source, at full volume:
      // the listener's level goes on it before it can start.
      if (PLAYER_VOLUME_ADJUSTABLE) audioPlayerRef.current.volume = volumeRef.current;
      claimTrackButtons();

      if (Platform.OS === 'web') {
        // The web player still says it is loaded from the source before, so
        // waiting for that would never seek; a position set on the new source
        // now is where the browser starts it once it has loaded.
        restorePositionMs.current = null;
        if (startMs > 0) void player.seekTo(startMs / 1000);
      } else {
        restorePositionMs.current = startMs > 0 ? startMs : null;
      }
      if (autoplay) player.play();
    } catch (cause) {
      vprobe('loadEntry threw', String(cause), cause instanceof Error ? cause.stack : '');
      if (requestId !== sourceRequestId.current) return;
      setPlaybackError(cause instanceof Error ? cause.message : 'Unable to load audio.');
      player.pause();
      videoPlayerRef.current.pause();
    } finally {
      if (requestId === sourceRequestId.current) setLoadingSource(false);
    }
  }, [claimTrackButtons, player, startingRenditionFor, stopAudioEngine, stopVideoEngine, videoReady]);

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
    resumeOnGesture.current = false;
    // It never loaded (the network, a file gone): play tries it again, from where it was.
    if (playbackError && currentIndex >= 0) {
      void loadEntry(queue, currentIndex, true, clock.get().currentTimeMs);
      return;
    }
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
  }, [activeEngine, clock, currentIndex, currentItem, loadEntry, playbackError, player, playing, queue]);

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
    if (clock.get().currentTimeMs > 4000) {
      seekToStart();
      return;
    }
    const previousIndex = getManualPreviousIndex(queue.length, currentIndex, repeatMode);
    if (previousIndex === currentIndex) {
      seekToStart();
      return;
    }
    void loadEntry(queue, previousIndex, true);
  }, [clock, currentIndex, loadEntry, queue, repeatMode, seekToStart]);

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

  const removeQueueItem = useCallback((index: number) => {
    const removed = queue[index];
    if (!removed || index === currentIndex) return;
    const next = removeQueueEntry(queue, currentIndex, index);
    setQueue(next.queue);
    setCurrentIndex(next.currentIndex);
    // Gone from the order shuffle returns to as well, so it doesn't come back.
    setOriginalQueue((entries) => entries.filter((entry) => entry.key !== removed.key));
  }, [currentIndex, queue]);

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
    void setAudioModeAsync(PLAYBACK_AUDIO_MODE);
  }, []);

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
        // A lesson that stops, and the video player starting up, make
        // expo-video set the audio session to mix with other apps, and iOS
        // then shows nothing in Now Playing. The songs' own session comes
        // back each time they take the lock screen, here and once more below.
        if (Platform.OS === 'ios') void setAudioModeAsync(PLAYBACK_AUDIO_MODE);
        player.setActiveForLockScreen(true, metadata, {
          showSeekBackward: !hasTrackControls,
          showSeekForward: !hasTrackControls,
        });
        player.updateLockScreenMetadata(metadata);
        claimTrackButtons();
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

      // Coptic Vine is a queue player: previous/next change tracks (claimWebTrackButtons).
      claimTrackButtons();
      const session = webGlobal.navigator.mediaSession;
      try {
        // The video element has no handlers of its own; the audio player sets its own.
        session.setActionHandler?.('play', activeEngine === 'video' ? () => togglePlaybackRef.current() : null);
        session.setActionHandler?.('pause', activeEngine === 'video' ? () => togglePlaybackRef.current() : null);
      } catch {
        // Older browsers reject unknown actions; the basic controls still work.
      }
    }
    return () => { if (timer) clearTimeout(timer); };
  }, [activeEngine, claimTrackButtons, currentItem, player]);

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

  // Both players at the bar's level as it moves; each new source is given it
  // in loadEntry and switchRendition.
  useEffect(() => {
    volumeRef.current = volume;
    if (!PLAYER_VOLUME_ADJUSTABLE) return;
    audioPlayerRef.current.volume = volume;
    videoPlayerRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    if (movingVolume == null) return;
    const timer = setTimeout(() => {
      setPlayerVolume(movingVolume);
      setMovingVolume(null);
    }, 500);
    return () => clearTimeout(timer);
  }, [movingVolume, setPlayerVolume]);

  const setVolume = useCallback((next: number) => setMovingVolume(clampVolume(next)), []);

  useEffect(() => {
    const requestedPosition = restorePositionMs.current;
    if (requestedPosition == null || !status.isLoaded) return;
    restorePositionMs.current = null;
    void player.seekTo(requestedPosition / 1000);
  }, [player, status.isLoaded]);

  // The lock screen's next button greys out at the end of the queue, as the
  // player's own does; previous always works while something plays, going
  // back to the start of the track if nothing comes before it. Set again
  // whenever expo-video may have put its 10-second skips back (a lesson
  // loading, starting or stopping, and its readyToPlay below), as the module
  // turns them off again while anything plays.
  const hasCurrentItem = currentItem != null;
  const canGoNext = hasCurrentItem && getManualNextIndex(queue.length, currentIndex, repeatMode) !== currentIndex;
  const trackControlsRef = useRef({ canGoNext, canGoPrevious: hasCurrentItem });
  useEffect(() => {
    trackControlsRef.current = { canGoNext, canGoPrevious: hasCurrentItem };
    setTrackControls(canGoNext, hasCurrentItem);
  }, [activeEngine, canGoNext, currentKey, hasCurrentItem, playing]);

  useEventListener(videoPlayer, 'playingChange', (payload) => vprobe('event playingChange', JSON.stringify(payload)));
  useEventListener(videoPlayer, 'sourceChange', () => vprobe('event sourceChange'));
  useEventListener(videoPlayer, 'statusChange', (payload) => {
    vprobe('event statusChange', payload.status, payload.error?.message ?? '', 'pendingPlay', pendingPlay.current);
    if (payload.status === 'error') {
      setPlaybackError(payload.error?.message ?? 'Unable to play this lesson.');
      swapRef.current = null;
      pendingPlay.current = false;
      setVideoSwitch(null);
      return;
    }
    if (payload.status === 'readyToPlay') {
      videoReady();
      setTrackControls(trackControlsRef.current.canGoNext, trackControlsRef.current.canGoPrevious);
    }
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
  const armResumeOnGesture = useCallback(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    resumeOnGesture.current = true;
    // Chrome refusing the first play() is expected here, not an error.
    const quiet = (event: PromiseRejectionEvent) => {
      if ((event.reason as { name?: string } | null)?.name === 'NotAllowedError') event.preventDefault();
    };
    window.addEventListener('unhandledrejection', quiet);
    setTimeout(() => window.removeEventListener('unhandledrejection', quiet), 10_000);
    const resume = () => {
      // After the press itself is handled: a press of play or pause has
      // already decided (togglePlayback), and nothing is restarted under it.
      setTimeout(() => {
        window.removeEventListener('pointerup', resume, true);
        window.removeEventListener('keyup', resume, true);
        if (!resumeOnGesture.current) return;
        resumeOnGesture.current = false;
        if (!playingRef.current) togglePlaybackRef.current();
      }, 0);
    };
    window.addEventListener('pointerup', resume, true);
    window.addEventListener('keyup', resume, true);
  }, []);
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

  // The saved queue comes back where it was left, paused; after a reload of a
  // page that was playing (the web, utils/playbackStateStorage), playing, from
  // that very moment. A session carried over from a rebuild needs neither.
  const carriedOver = useRef(live != null);
  useEffect(() => {
    let active = true;
    Promise.all([loadPlaybackSnapshot(), loadLearningResume()])
      .then(([snapshot]) => {
        if (!active || carriedOver.current || !snapshot || !snapshot.queue.length) return;
        const reload = reloadPointFor(snapshot.queue[snapshot.currentIndex]?.key);
        setQueue(snapshot.queue);
        setOriginalQueue(snapshot.originalQueue.length ? snapshot.originalQueue : snapshot.queue);
        setCurrentIndex(snapshot.currentIndex);
        setRepeatMode(snapshot.repeatMode);
        setShuffleEnabled(snapshot.shuffleEnabled);
        const carryOn = reload?.playing === true;
        if (carryOn) armResumeOnGesture();
        void loadEntry(snapshot.queue, snapshot.currentIndex, carryOn, reload ? reload.positionMs : snapshot.positionMs);
      })
      .finally(() => {
        if (active) setHydrated(true);
      });
    return () => { active = false; };
  }, [armResumeOnGesture, loadEntry]);

  // Kept outside React on the web, for a provider rebuilt with the app's root.
  useEffect(() => {
    writeLiveSession({ queue, originalQueue, currentIndex, repeatMode, shuffleEnabled, learningRate, videoRendition, videoDurationMs });
  }, [currentIndex, learningRate, originalQueue, queue, repeatMode, shuffleEnabled, videoDurationMs, videoRendition]);

  // Where playback is as the page goes (a reload): for the tab only, so that
  // closing the site still stops it.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const save = () => {
      const entry = currentItemRef.current;
      if (!entry) {
        saveReloadPoint(null);
        return;
      }
      const seconds = entryHasVideo(entry) ? videoPlayerRef.current.currentTime : player.currentTime;
      saveReloadPoint({
        key: entry.key,
        positionMs: Math.max(0, Math.round((Number.isFinite(seconds) ? seconds : 0) * 1000)),
        playing: playingRef.current,
        savedAt: Date.now(),
      });
    };
    window.addEventListener('pagehide', save);
    return () => window.removeEventListener('pagehide', save);
  }, [player]);

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

  useEffect(() => {
    const subscriptions = [
      addTrackControlListener('onNextTrack', () => nextRef.current()),
      addTrackControlListener('onPreviousTrack', () => previousRef.current()),
    ];
    return () => subscriptions.forEach((subscription) => subscription?.remove());
  }, []);

  // Swapping the picture for the sound alone (or back) at the same place.
  const switchRendition = useCallback(async (to: LessonRendition) => {
    vprobe('switchRendition', to);
    const entry = currentItemRef.current;
    if (!entry || !entryHasVideo(entry)) return;
    const requestId = ++videoRequestId.current;
    const uri = await resolveRenditionUri(entry, to);
    if (requestId !== videoRequestId.current || !uri) return;
    const video = videoPlayerRef.current;
    const positionMs = Math.max(0, Math.round(video.currentTime * 1000));
    // Playing, or about to (a source still loading to play).
    const wasPlaying = video.playing || pendingPlay.current;
    swapRef.current = { positionMs, wasPlaying };
    setVideoSwitch({ positionMs, wasPlaying });
    setVideoRendition(to);
    pendingVideoSeekMs.current = positionMs;
    pendingPlay.current = wasPlaying;
    await replaceVideoSource(video, videoSourceFor(entry, uri, to), {
      positionMs, play: wasPlaying, rendition: to, volume: volumeRef.current, rate: playbackRate,
    });
    if (requestId !== videoRequestId.current) return;
    whenWebVideoReady(videoReady);
  }, [playbackRate, videoReady]);

  // The rendition follows the rules. Why it differs decides how soon: the
  // listener's choice and cellular data at once, the picture put out of
  // sight only once it has stayed so (utils/lessonPlayback.ts).
  useEffect(() => {
    if (!currentHasVideo || !videoRendition || loadingSource || videoSwitching) return;
    if (desiredRendition === videoRendition) return;
    const cause: RenditionCause = lessonVideoMode !== 'video'
      ? 'mode'
      : cellularBlocked ? 'network' : !appActive ? 'background' : 'visibility';
    const delay = renditionSwitchDelayMs(videoRendition, desiredRendition, cause);
    const timer = setTimeout(() => void switchRendition(desiredRendition), delay);
    return () => clearTimeout(timer);
  }, [appActive, cellularBlocked, currentHasVideo, desiredRendition, lessonVideoMode, loadingSource, switchRendition, videoRendition, videoSwitching]);

  const setVideoPresentation = useCallback((presentation: VideoPresentation) => {
    setVideoPresentationState((current) => (samePresentation(current, presentation) ? current : presentation));
  }, []);
  const expectVideoSurface = useCallback(() => {
    surfaceExpectedUntil.current = Date.now() + SURFACE_EXPECTED_MS;
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    window.addEventListener('unhandledrejection', quietInterruptedPlay);
    return () => window.removeEventListener('unhandledrejection', quietInterruptedPlay);
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
    removeQueueItem,
    clearUpcoming,
    clearQueue,
    updateQueueEntries,
    hydrated,
    cycleRepeatMode,
    toggleShuffle,
    learningRate,
    setLearningRate,
    volume,
    setVolume,
    activeEngine,
    currentHasVideo,
    videoPlayer,
    lessonVideoMode,
    setLessonVideoMode,
    videoRendition,
    videoSwitching,
    videoAspectRatio,
    setVideoPresentation,
    expectVideoSurface,
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
    cycleRepeatMode,
    durationMs,
    expectVideoSurface,
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
    removeQueueItem,
    repeatMode,
    seekToMs,
    selectQueueIndex,
    setLessonVideoMode,
    setVideoPresentation,
    setVolume,
    shuffleEnabled,
    togglePlayback,
    toggleShuffle,
    updateQueueEntries,
    videoAspectRatio,
    videoPlayer,
    videoRendition,
    videoSwitching,
    volume,
  ]);

  return (
    <PlaybackClockContext.Provider value={clock}>
      <PlaybackContext.Provider value={value}>{children}</PlaybackContext.Provider>
    </PlaybackClockContext.Provider>
  );
}

export function usePlayback(): PlaybackContextValue {
  const value = useContext(PlaybackContext);
  if (!value) throw new Error('usePlayback must be used inside PlaybackProvider.');
  return value;
}

/** The clock itself, for reading at the moment it is needed (a press) rather than drawing it. */
export function usePlaybackClockStore(): PlaybackClockStore {
  const store = useContext(PlaybackClockContext);
  if (!store) throw new Error('usePlaybackClockStore must be used inside PlaybackProvider.');
  return store;
}

/**
 * What a component shows of the clock: it is drawn again only when that
 * changes -- the line being sung, say, rather than each tick. The pick must
 * be a plain value (a number, a string, null), never a new object.
 */
export function usePlaybackClock<T>(select: (clock: PlaybackClock) => T): T {
  const store = usePlaybackClockStore();
  return useSyncExternalStore(store.subscribe, () => select(store.get()), () => select(store.get()));
}
