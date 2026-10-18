import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { usePlayback } from '@/context/PlaybackContext';
import {
  resolveVideoPlacement,
  type SurfaceRect,
  type VideoPlacementClaim,
  type VideoPlacementKind,
} from '@/utils/lessonPlayback';

/**
 * Where the one video surface is drawn (utils/lessonPlayback.ts). Lesson
 * pages claim it for the lesson they show; the now-playing bars say whether
 * their floating window may show; a subdocument says it covers the app; the
 * stage says when the system has taken the picture into its own window. From
 * those the placement is decided here and told to the engine, which streams
 * the picture only while it has somewhere to be seen.
 */
interface HeroClaim extends VideoPlacementClaim {
  rect: SurfaceRect | null;
}

interface VideoStageContextValue {
  placement: VideoPlacementKind;
  /** The current lesson's own page is showing (the page is the player; the bar steps aside). */
  currentItemOnPage: boolean;
  /** Where the lesson page's slot is, in window coordinates, while the placement is `hero`. */
  heroRect: SurfaceRect | null;
  claimHero: (id: string, itemId: string, rect: SurfaceRect | null) => void;
  releaseHero: (id: string) => void;
  /** A now-playing bar reports whether its floating window could show (shown, not hidden, no full player open). */
  reportFloatingSlot: (id: string, available: boolean) => void;
  /** A subdocument's bar reports that a Modal covers the app, the stage with it. */
  reportCovering: (id: string, covering: boolean) => void;
  pictureInPicture: boolean;
  /** The stage reports the system's window opening (with where the surface was) or closing. */
  setPictureInPicture: (active: boolean, atPlacement?: VideoPlacementKind) => void;
}

const VideoStageContext = createContext<VideoStageContextValue>({
  placement: 'hidden',
  currentItemOnPage: false,
  heroRect: null,
  claimHero: () => undefined,
  releaseHero: () => undefined,
  reportFloatingSlot: () => undefined,
  reportCovering: () => undefined,
  pictureInPicture: false,
  setPictureInPicture: () => undefined,
});

function withoutKey<T>(record: Record<string, T>, id: string): Record<string, T> {
  if (!(id in record)) return record;
  const next = { ...record };
  delete next[id];
  return next;
}

export function VideoStageProvider({ children }: { children: ReactNode }) {
  const playback = usePlayback();
  const [claims, setClaims] = useState<Record<string, HeroClaim>>({});
  const [floatingSlots, setFloatingSlots] = useState<Record<string, boolean>>({});
  const [covering, setCovering] = useState<Record<string, true>>({});
  // The system's picture-in-picture, with the placement the surface had when
  // it opened: frozen there until it closes, so the surface is never pulled
  // out from under the system's window.
  const [pip, setPip] = useState<{ active: boolean; frozenPlacement: VideoPlacementKind }>({ active: false, frozenPlacement: 'hidden' });

  const claimHero = useCallback((id: string, itemId: string, rect: SurfaceRect | null) => {
    setClaims((current) => {
      const existing = current[id];
      if (existing && existing.itemId === itemId && existing.rect === rect) return current;
      return { ...current, [id]: { id, kind: 'hero', itemId, rect } };
    });
  }, []);
  const releaseHero = useCallback((id: string) => setClaims((current) => withoutKey(current, id)), []);
  const reportFloatingSlot = useCallback((id: string, available: boolean) => {
    setFloatingSlots((current) => (current[id] === available ? current : { ...current, [id]: available }));
  }, []);
  const reportCovering = useCallback((id: string, isCovering: boolean) => {
    setCovering((current) => {
      if (!isCovering) return withoutKey(current, id);
      return current[id] ? current : { ...current, [id]: true };
    });
  }, []);
  const setPictureInPicture = useCallback((active: boolean, atPlacement?: VideoPlacementKind) => {
    setPip((current) => {
      if (current.active === active) return current;
      return { active, frozenPlacement: active ? (atPlacement ?? 'floating') : 'hidden' };
    });
  }, []);

  const currentItemId = playback.currentItem?.playable.id ?? null;
  const claimList = useMemo(() => Object.values(claims), [claims]);
  const currentClaim = currentItemId ? claimList.filter((claim) => claim.itemId === currentItemId).at(-1) ?? null : null;
  const floatingAvailable = Object.values(floatingSlots).some(Boolean);
  const isCovered = Object.keys(covering).length > 0;
  // Nothing plays with a picture: the system's window, if any, closed with it.
  const pictureInPicture = pip.active && playback.currentHasVideo;

  const placement = resolveVideoPlacement({
    hasVideo: playback.currentHasVideo,
    mode: playback.lessonVideoMode,
    currentItemId,
    claims: claimList,
    collapsed: !floatingAvailable,
    overlayAllowed: floatingAvailable,
    covered: isCovered,
    pictureInPicture,
  }, pip.frozenPlacement);

  // The engine also hears which lessons' pages are showing and whether a
  // subdocument covers the app, to fetch the right rendition of a new entry
  // the first time (utils/lessonPlayback.ts, `startingPlacement`).
  const claimedItemIds = useMemo(() => claimList.map((claim) => claim.itemId), [claimList]);
  const setVideoPresentation = playback.setVideoPresentation;
  useEffect(() => {
    setVideoPresentation({ placement, pictureInPicture, claimedItemIds, covered: isCovered });
  }, [claimedItemIds, isCovered, pictureInPicture, placement, setVideoPresentation]);

  const value = useMemo<VideoStageContextValue>(() => ({
    placement,
    currentItemOnPage: currentClaim != null,
    heroRect: placement === 'hero' ? currentClaim?.rect ?? null : null,
    claimHero,
    releaseHero,
    reportFloatingSlot,
    reportCovering,
    pictureInPicture,
    setPictureInPicture,
  }), [claimHero, currentClaim, pictureInPicture, placement, releaseHero, reportCovering, reportFloatingSlot, setPictureInPicture]);

  return <VideoStageContext.Provider value={value}>{children}</VideoStageContext.Provider>;
}

export function useVideoStage(): VideoStageContextValue {
  return useContext(VideoStageContext);
}
