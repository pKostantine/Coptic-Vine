import type { PlaybackQueueEntry } from '../types/playback';

/**
 * The rules of a video lesson's playback, kept pure so they can be read and
 * tested on their own:
 *
 * - A lesson with a video has two renditions, the picture (the MP4) and the
 *   sound alone (the M4A, a few percent of the video's size). The listener
 *   chooses "Video" or "Audio" once, for all lessons (`LessonVideoMode`), from
 *   the full player, the now-playing bar, or a lesson's pages.
 * - The picture is drawn in one place at a time, a "surface": the now-playing
 *   bar's thumbnail or the full player (`activeVideoSurface`). Even in video
 *   mode it is streamed only while a surface shows it, or the system's
 *   picture in picture does; otherwise the sound alone plays, so a lesson
 *   never spends data on frames nobody sees.
 * - On cellular data the picture waits for permission (a setting, or "Play
 *   video anyway" for this session).
 */
export type LessonVideoMode = 'video' | 'audio';
export type LessonRendition = 'video' | 'audio';

/** The places that draw a lesson's picture: the now-playing bar's thumbnail, and the full player. */
export type VideoSurfaceKind = 'mini' | 'full';

export interface VideoSurfaceEntry {
  id: string;
  kind: VideoSurfaceKind;
  /** When it was mounted, counting up: of two of a kind, the newer shows the picture. */
  order: number;
}

const SURFACE_RANK: Record<VideoSurfaceKind, number> = { mini: 1, full: 2 };

/**
 * The one surface that shows the picture: the full player over any bar, and
 * of two bars the newer (a subdocument's, drawn over the app's).
 */
export function activeVideoSurface(surfaces: readonly VideoSurfaceEntry[]): string | null {
  let best: VideoSurfaceEntry | null = null;
  for (const surface of surfaces) {
    if (!best || SURFACE_RANK[surface.kind] > SURFACE_RANK[best.kind]
      || (SURFACE_RANK[surface.kind] === SURFACE_RANK[best.kind] && surface.order > best.order)) {
      best = surface;
    }
  }
  return best?.id ?? null;
}

export function entryHasVideo(entry: PlaybackQueueEntry | null | undefined): boolean {
  return Boolean(entry?.playable.video?.remoteUri || entry?.playable.video?.localUri);
}

export interface PictureVisibilityInputs {
  /** A surface is mounted to show the picture. */
  surfaceShowing: boolean;
  /** The app is on screen. */
  appActive: boolean;
  /** The system shows the picture in its own window. */
  pictureInPicture: boolean;
}

/** The picture can be seen: on a surface while the app is on screen, or in the system's window. */
export function pictureVisible(inputs: PictureVisibilityInputs): boolean {
  return inputs.pictureInPicture || (inputs.appActive && inputs.surfaceShowing);
}

export interface RenditionInputs {
  hasVideo: boolean;
  mode: LessonVideoMode;
  pictureVisible: boolean;
  /** Cellular data, with video over cellular not allowed and not overridden. */
  cellularBlocked: boolean;
}

/** Which rendition should be loaded for the current entry. */
export function lessonRendition(inputs: RenditionInputs): LessonRendition {
  if (!inputs.hasVideo || inputs.mode !== 'video' || inputs.cellularBlocked) return 'audio';
  return inputs.pictureVisible ? 'video' : 'audio';
}

export interface StartingVisibilityInputs extends PictureVisibilityInputs {
  /** The now-playing bar is out (not hidden, on a page it shows on): its thumbnail will draw the new entry's picture. */
  barShowsPicture: boolean;
  /** The full player is opening for this entry (a lesson started to be watched). */
  surfaceExpected: boolean;
}

/**
 * Whether a new entry's picture will be seen, decided before it loads so the
 * right rendition is fetched the first time: the surfaces draw whatever
 * plays, so the bar about to show it, or the full player about to open,
 * counts as much as a surface already there. In the background, with no
 * window of the system's, nothing will.
 */
export function startingPictureVisible(inputs: StartingVisibilityInputs): boolean {
  if (inputs.pictureInPicture) return true;
  if (!inputs.appActive) return false;
  return inputs.surfaceShowing || inputs.barShowsPicture || inputs.surfaceExpected;
}

/** What changed the rendition the rules ask for. */
export type RenditionCause = 'mode' | 'visibility' | 'background' | 'network' | 'pip';

/** The picture hidden inside the app (the bar put away, a page without it): the sound alone only if it stays hidden this long. */
export const IN_APP_HIDE_MS = 8000;
/** The app left with no window of the system's showing the picture (the screen locked): soon the sound alone. */
export const BACKGROUND_HIDE_MS = 2500;

/**
 * How long a change waits before the rendition follows it. The listener's own
 * choice, the picture appearing, cellular data and the system's window are
 * immediate. Hiding waits, so a moment on a page without the bar, or the bar
 * put away and brought back, never interrupts the sound with a swap.
 */
export function renditionSwitchDelayMs(from: LessonRendition, to: LessonRendition, cause: RenditionCause): number {
  if (from === to) return 0;
  if (to === 'video' || cause === 'mode' || cause === 'network' || cause === 'pip') return 0;
  return cause === 'background' ? BACKGROUND_HIDE_MS : IN_APP_HIDE_MS;
}

/** A video's shape, from what is known of it: anything implausible is taken as 16:9. */
export function videoAspect(ratio: number | null | undefined): number {
  return ratio && Number.isFinite(ratio) && ratio > 0.2 && ratio < 5 ? ratio : 16 / 9;
}

/** The largest box of the video's shape that fits the room given. */
export function fitVideo(maxWidth: number, maxHeight: number, aspect: number): { width: number; height: number } {
  const width = Math.max(0, Math.min(maxWidth, maxHeight * aspect));
  return { width: Math.floor(width), height: Math.floor(width / aspect) };
}

/** Full screen turns the device for a wide video, as every video app does; an upright one keeps the device as it is. */
export function fullscreenOrientation(aspect: number): 'landscape' | 'default' {
  return aspect > 1.05 ? 'landscape' : 'default';
}

/** A file's size the way a phone's settings print it: "61 MB", "1.3 GB". */
export function formatDataSize(bytes: number): string {
  if (!(bytes > 0)) return '';
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(bytes >= 1e10 ? 0 : 1)} GB`;
  if (bytes >= 1e6) return `${Math.round(bytes / 1e6)} MB`;
  return `${Math.max(1, Math.round(bytes / 1e3))} KB`;
}

/** The two renditions' sizes, when both are known and the sound alone is the smaller: what "Audio" saves. */
export function audioSavings(videoBytes: number | null | undefined, audioBytes: number | null | undefined): { video: string; audio: string } | null {
  if (!videoBytes || !audioBytes || audioBytes <= 0 || audioBytes >= videoBytes) return null;
  return { video: formatDataSize(videoBytes), audio: formatDataSize(audioBytes) };
}
