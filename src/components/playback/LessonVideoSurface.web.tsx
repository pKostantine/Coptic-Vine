import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { COLORS } from '@/constants/theme';
import { usePlayback } from '@/context/PlaybackContext';
import { useVideoSurface } from '@/context/VideoStageContext';
import { fullscreenOrientation } from '@/utils/lessonPlayback';
import { borrowLessonVideo, lessonVideoElement } from '@/utils/lessonVideoElement';

import type { LessonVideoSurfaceHandle, LessonVideoSurfaceProps } from './lessonVideoSurfaceTypes';

type WebkitVideo = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
  webkitSetPresentationMode?: (mode: string) => void;
};
type LockableOrientation = ScreenOrientation & { lock?: (orientation: string) => Promise<void> };

/**
 * A place that shows a lesson's picture, on the web: while it is the surface
 * that shows it (VideoStageContext), the lesson's one <video> element is
 * moved into its frame (utils/lessonVideoElement.web.ts), so the picture
 * passes between the bar and the full player without reloading, and lies in
 * the page's own layout, scrolling and moving with it.
 */
const LessonVideoSurface = forwardRef<LessonVideoSurfaceHandle, LessonVideoSurfaceProps>(function LessonVideoSurface({
  kind,
  style,
  poster,
  children,
  aspect,
  contentFit = 'contain',
  showsBuffering = false,
}, ref) {
  const playback = usePlayback();
  const { active, homeGeneration } = useVideoSurface(kind);
  const slotRef = useRef<View>(null);

  // Taken in before paint, given back before React takes the frame away.
  useLayoutEffect(() => {
    if (!active) return undefined;
    const video = lessonVideoElement();
    if (video) video.style.objectFit = contentFit;
    return borrowLessonVideo(slotRef.current as unknown as HTMLElement | null);
  }, [active, contentFit, homeGeneration]);

  useImperativeHandle(ref, () => ({
    enterFullscreen: async () => {
      const video = lessonVideoElement() as WebkitVideo | null;
      if (!video) return;
      if (typeof video.requestFullscreen === 'function') {
        await video.requestFullscreen();
        // A phone's browser turns to the video's shape, as the apps do.
        if (fullscreenOrientation(aspect) === 'landscape') {
          await (screen.orientation as LockableOrientation | undefined)?.lock?.('landscape').catch(() => undefined);
        }
        return;
      }
      video.webkitEnterFullscreen?.();
    },
    startPictureInPicture: async () => {
      const video = lessonVideoElement() as WebkitVideo | null;
      if (!video) return;
      if ((document as { pictureInPictureEnabled?: boolean }).pictureInPictureEnabled && typeof video.requestPictureInPicture === 'function') {
        await video.requestPictureInPicture();
        return;
      }
      video.webkitSetPresentationMode?.('picture-in-picture');
    },
  }), [aspect]);

  const pictureShown = active && playback.videoRendition === 'video' && !playback.videoSwitching;

  return (
    <View style={[styles.frame, style]}>
      {/* The element's slot: nothing of React's lives in it. */}
      <View ref={slotRef} pointerEvents="none" style={StyleSheet.absoluteFill} />
      {!pictureShown ? <View pointerEvents="none" style={StyleSheet.absoluteFill}>{poster}</View> : null}
      {showsBuffering && active && playback.buffering ? (
        <View pointerEvents="none" style={styles.buffering}>
          <ActivityIndicator color={COLORS.gold} />
        </View>
      ) : null}
      {children}
    </View>
  );
});

export default LessonVideoSurface;

/** Whether a button opens the system's window: where the browser has one. */
export function pictureInPictureButtonSupported(): boolean {
  if (typeof document === 'undefined') return false;
  if ((document as { pictureInPictureEnabled?: boolean }).pictureInPictureEnabled) return true;
  const proto = (globalThis as { HTMLVideoElement?: { prototype: object } }).HTMLVideoElement?.prototype;
  return Boolean(proto && 'webkitSetPresentationMode' in proto);
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', backgroundColor: COLORS.black },
  buffering: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
});
