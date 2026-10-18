import type { PlaybackQueueEntry } from '../types/playback';

/**
 * The rules of a video lesson's playback, kept pure so they can be read and
 * tested on their own:
 *
 * - A lesson with a video has two renditions, the picture (the MP4) and the
 *   sound alone (the M4A). The listener chooses "Video" or "Audio only" once,
 *   for all lessons (`LessonVideoMode`).
 * - Even in video mode, the picture is streamed only while there is somewhere
 *   to show it — the lesson page, the floating window, the system's
 *   picture-in-picture. Hidden, the sound alone plays, so a lesson never
 *   spends data on frames nobody sees.
 * - On cellular data the picture waits for permission (a setting, or "play
 *   the video anyway" for this session).
 */
export type LessonVideoMode = 'video' | 'audio';
export type LessonRendition = 'video' | 'audio';

/** Where the one video surface is drawn right now. */
export type VideoPlacementKind = 'hero' | 'floating' | 'hidden';

export interface VideoPlacementClaim {
  id: string;
  kind: 'hero';
  /** The lesson the surface shows there; another lesson's page claims nothing. */
  itemId: string;
}

export interface RenditionInputs {
  hasVideo: boolean;
  mode: LessonVideoMode;
  /** Where the surface is, from `resolveVideoPlacement`. */
  placement: VideoPlacementKind;
  pictureInPicture: boolean;
  /** Cellular data, with video over cellular not allowed and not overridden. */
  cellularBlocked: boolean;
}

export function entryHasVideo(entry: PlaybackQueueEntry | null | undefined): boolean {
  return Boolean(entry?.playable.video?.remoteUri || entry?.playable.video?.localUri);
}

/** Which rendition should be loaded for the current entry. */
export function lessonRendition(inputs: RenditionInputs): LessonRendition {
  if (!inputs.hasVideo || inputs.mode !== 'video') return 'audio';
  if (inputs.pictureInPicture) return 'video';
  if (inputs.cellularBlocked) return 'audio';
  return inputs.placement === 'hidden' ? 'audio' : 'video';
}

export interface PlacementInputs {
  /** The entry playing has a video rendition. */
  hasVideo: boolean;
  mode: LessonVideoMode;
  /** The id of the entry playing (its playable id). */
  currentItemId: string | null;
  /** Lesson pages showing, most recent last. */
  claims: readonly VideoPlacementClaim[];
  /** The now-playing bar's own state: hidden to its button, or on a page it does not show on. */
  collapsed: boolean;
  overlayAllowed: boolean;
  /** A subdocument (a Modal) covers the app, surface included. */
  covered: boolean;
  pictureInPicture: boolean;
}

/**
 * The surface's place: the current lesson's own page when it is showing,
 * else the floating window where the bar would be, else nowhere. While the
 * system shows the picture in its own window, the place is frozen where it
 * was, so the surface is never pulled out from under it.
 */
export function resolveVideoPlacement(inputs: PlacementInputs, previous: VideoPlacementKind = 'hidden'): VideoPlacementKind {
  if (!inputs.hasVideo || inputs.mode !== 'video') return 'hidden';
  if (inputs.pictureInPicture) return previous === 'hidden' ? 'floating' : previous;
  if (inputs.currentItemId && inputs.claims.some((claim) => claim.itemId === inputs.currentItemId)) return 'hero';
  if (inputs.covered || inputs.collapsed || !inputs.overlayAllowed) return 'hidden';
  return 'floating';
}

export interface StartingPlacementInputs {
  /** The entry about to load. */
  itemId: string;
  /** The lessons whose pages are showing (the stage's hero claims). */
  claimedItemIds: readonly string[];
  /** The app is on screen (in the background only the system's window shows a picture). */
  appActive: boolean;
  /** A subdocument covers the app. */
  covered: boolean;
  pictureInPicture: boolean;
  /** Where the surface is now, for the entry before this one. */
  current: VideoPlacementKind;
}

/**
 * Where a new entry's picture will be, decided before it loads so the right
 * rendition is fetched the first time: its own page when that page is
 * showing; otherwise, while the app is on screen, the floating window the
 * bar is about to offer (a page swap may still claim it a moment later, at
 * the same rendition). The system's window keeps its place. Only in the
 * background, or under a subdocument, is there nowhere, and the sound alone
 * is fetched.
 */
export function startingPlacement(inputs: StartingPlacementInputs): VideoPlacementKind {
  if (inputs.pictureInPicture) return inputs.current === 'hidden' ? 'floating' : inputs.current;
  if (inputs.claimedItemIds.includes(inputs.itemId)) return 'hero';
  if (!inputs.appActive || inputs.covered) return 'hidden';
  return 'floating';
}

/** How long a change of placement waits before the rendition follows it: navigation must not flap the stream. */
export function renditionSwitchDelayMs(from: LessonRendition, to: LessonRendition, cause: 'mode' | 'placement' | 'network' | 'pip'): number {
  if (from === to) return 0;
  // The listener's own choice is immediate; the picture appearing is immediate.
  if (cause === 'mode' || cause === 'pip' || to === 'video') return 0;
  // Hiding waits a moment: a page swap passes through "nowhere" on the way.
  return cause === 'network' ? 0 : 1500;
}

export interface FloatingWindowLayout {
  width: number;
  height: number;
  left: number;
  bottom: number;
}

/**
 * The floating window: a small 16:9 (or the video's own shape) card in a
 * bottom corner, above the tab bar, inside the safe area, on the side the
 * hidden bar's button lives on.
 */
export function floatingWindowLayout(options: {
  windowWidth: number;
  windowHeight: number;
  insets: { left: number; right: number; bottom: number };
  side: 'left' | 'right';
  tabBarInset: number;
  aspectRatio?: number | null;
  /** The desktop sidebar's width, which the window stays clear of. */
  sidebarWidth?: number;
}): FloatingWindowLayout {
  const { windowWidth, windowHeight, insets, side, tabBarInset } = options;
  const aspect = options.aspectRatio && options.aspectRatio > 0.2 && options.aspectRatio < 5 ? options.aspectRatio : 16 / 9;
  const sidebar = options.sidebarWidth ?? 0;
  const usable = windowWidth - insets.left - insets.right - sidebar;
  // Phones get just under half the width; wide screens cap at 320 and never
  // more than a third of the height for a tall (portrait) video.
  let width = Math.round(Math.min(320, Math.max(150, usable * 0.46)));
  let height = Math.round(width / aspect);
  const maxHeight = Math.round(windowHeight * 0.34);
  if (height > maxHeight) {
    height = maxHeight;
    width = Math.round(height * aspect);
  }
  const edge = 12;
  const left = side === 'left'
    ? sidebar + insets.left + edge
    : windowWidth - insets.right - edge - width;
  const bottom = Math.max(insets.bottom, 0) + 10 + Math.max(0, tabBarInset - insets.bottom);
  return { width, height, left: Math.max(0, left), bottom };
}

/** The window rectangle a lesson page's slot reports, with its rounded size. */
export interface SurfaceRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function sameSurfaceRect(a: SurfaceRect | null, b: SurfaceRect | null): boolean {
  if (!a || !b) return a === b;
  return Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5;
}
