import { createContext, type ReactNode, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { usePlayback } from '@/context/PlaybackContext';
import { activeVideoSurface, type VideoSurfaceEntry, type VideoSurfaceKind } from '@/utils/lessonPlayback';

/**
 * Where a lesson's picture is drawn (utils/lessonPlayback.ts). Each surface
 * that can show it, the now-playing bar's thumbnail and the full player,
 * registers here while it is mounted; one of them shows the picture
 * (`activeVideoSurface`) and the others their poster. The now-playing bars
 * say whether they are out, so a new lesson's picture is fetched the first
 * time; the surfaces say when the system takes the picture into its own
 * window. From those the engine hears where the picture can be seen, and
 * streams it only then.
 */
interface VideoStageContextValue {
  /** The surface that shows the picture right now. */
  activeSurfaceId: string | null;
  registerSurface: (id: string, kind: VideoSurfaceKind) => void;
  unregisterSurface: (id: string) => void;
  /** A now-playing bar reports whether it is out (shown, not hidden, no full player open). */
  reportBarSlot: (id: string, available: boolean) => void;
  pictureInPicture: boolean;
  setPictureInPicture: (active: boolean) => void;
  /**
   * Counts the hidden home view's mounts (components/playback/LessonVideoHome):
   * a surface mounts its view again after each, so the newest view, the one
   * that shows, holds the player (Android draws a player in one view only).
   */
  homeGeneration: number;
  markHomeMounted: () => void;
}

const VideoStageContext = createContext<VideoStageContextValue>({
  activeSurfaceId: null,
  registerSurface: () => undefined,
  unregisterSurface: () => undefined,
  reportBarSlot: () => undefined,
  pictureInPicture: false,
  setPictureInPicture: () => undefined,
  homeGeneration: 0,
  markHomeMounted: () => undefined,
});

function withoutKey<T>(record: Record<string, T>, id: string): Record<string, T> {
  if (!(id in record)) return record;
  const next = { ...record };
  delete next[id];
  return next;
}

export function VideoStageProvider({ children }: { children: ReactNode }) {
  const playback = usePlayback();
  const [surfaces, setSurfaces] = useState<Record<string, VideoSurfaceEntry>>({});
  const [barSlots, setBarSlots] = useState<Record<string, boolean>>({});
  const [pip, setPip] = useState(false);
  const [homeGeneration, setHomeGeneration] = useState(0);
  const order = useRef(0);

  const registerSurface = useCallback((id: string, kind: VideoSurfaceKind) => {
    order.current += 1;
    const next = order.current;
    setSurfaces((current) => (current[id]?.kind === kind ? current : { ...current, [id]: { id, kind, order: next } }));
  }, []);
  const unregisterSurface = useCallback((id: string) => setSurfaces((current) => withoutKey(current, id)), []);
  const reportBarSlot = useCallback((id: string, available: boolean) => {
    setBarSlots((current) => {
      if (!available) return withoutKey(current, id);
      return current[id] ? current : { ...current, [id]: true };
    });
  }, []);
  const setPictureInPicture = useCallback((active: boolean) => setPip(active), []);
  const markHomeMounted = useCallback(() => setHomeGeneration((value) => value + 1), []);

  const surfaceList = useMemo(() => Object.values(surfaces), [surfaces]);
  const activeSurfaceId = activeVideoSurface(surfaceList);
  const barShowsPicture = Object.keys(barSlots).length > 0;
  // Nothing plays with a picture: the system's window, if any, closed with it.
  const pictureInPicture = pip && playback.currentHasVideo;

  const setVideoPresentation = playback.setVideoPresentation;
  useEffect(() => {
    setVideoPresentation({ surfaceShowing: activeSurfaceId != null, barShowsPicture, pictureInPicture });
  }, [activeSurfaceId, barShowsPicture, pictureInPicture, setVideoPresentation]);

  const value = useMemo<VideoStageContextValue>(() => ({
    activeSurfaceId,
    registerSurface,
    unregisterSurface,
    reportBarSlot,
    pictureInPicture,
    setPictureInPicture,
    homeGeneration,
    markHomeMounted,
  }), [activeSurfaceId, homeGeneration, markHomeMounted, pictureInPicture, registerSurface, reportBarSlot, setPictureInPicture, unregisterSurface]);

  return <VideoStageContext.Provider value={value}>{children}</VideoStageContext.Provider>;
}

export function useVideoStage(): VideoStageContextValue {
  return useContext(VideoStageContext);
}

/**
 * A surface's place in the stage: registered while it is mounted, and told
 * whether it is the one that shows the picture.
 */
export function useVideoSurface(kind: VideoSurfaceKind) {
  const id = useId();
  const { activeSurfaceId, registerSurface, unregisterSurface, homeGeneration, setPictureInPicture } = useVideoStage();
  // Before paint, so the surface it takes the picture from gives it up in the same frame.
  useLayoutEffect(() => {
    registerSurface(id, kind);
    return () => unregisterSurface(id);
  }, [id, kind, registerSurface, unregisterSurface]);
  return { active: activeSurfaceId === id, homeGeneration, setPictureInPicture };
}
