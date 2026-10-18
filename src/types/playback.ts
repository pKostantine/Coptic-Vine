export type PlaybackEntityKind = 'music_track' | 'learning_audio' | 'learning_video_audio';
export type PlaybackRepeatMode = 'off' | 'all' | 'one';

export interface PlaybackSource {
  remoteUri?: string | null;
  localUri?: string | null;
  headers?: Record<string, string> | null;
}

export interface PlaybackLyricReference {
  trackId?: string | null;
  locale?: string | null;
  kind?: string | null;
}

/**
 * Low-level playback contract shared by Music now and Learn & Study later.
 * Product-specific UI data belongs in PlaybackQueueEntry.payload rather than
 * leaking music/learning schemas into the native playback engine.
 */
export interface PlayableEntity {
  id: string;
  kind: PlaybackEntityKind;
  title: string;
  artist?: string | null;
  albumTitle?: string | null;
  artworkUri?: string | null;
  durationMs?: number | null;
  /** What plays as sound: for a lesson with video, its audio-only rendition (or the video file when none exists yet). */
  source: PlaybackSource;
  /**
   * The video rendition of a lesson, when it has one. An entry with a video
   * plays on the video engine for both renditions, so showing or hiding the
   * picture never changes players (PlaybackContext).
   */
  video?: PlaybackSource | null;
  /** The picture's shape, when known, so a surface can be laid out before the first frame. */
  videoAspectRatio?: number | null;
  lyrics?: PlaybackLyricReference | null;
}

export interface PlaybackQueueEntry<TPayload = unknown> {
  key: string;
  playable: PlayableEntity;
  payload?: TPayload;
}

export interface PlaybackSnapshot {
  version: 1;
  queue: PlaybackQueueEntry[];
  originalQueue: PlaybackQueueEntry[];
  currentIndex: number;
  positionMs: number;
  repeatMode: PlaybackRepeatMode;
  shuffleEnabled: boolean;
}
