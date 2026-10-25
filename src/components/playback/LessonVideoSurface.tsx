import { VideoView } from 'expo-video';
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { COLORS } from '@/constants/theme';
import { usePlayback } from '@/context/PlaybackContext';
import { useVideoSurface } from '@/context/VideoStageContext';
import { fullscreenOrientation } from '@/utils/lessonPlayback';

import type { LessonVideoSurfaceHandle, LessonVideoSurfaceProps } from './lessonVideoSurfaceTypes';

/**
 * A place that shows a lesson's picture: the now-playing bar's thumbnail, or
 * the full player. It draws the player in a view of its own, in its own
 * layout, so it moves with whatever holds it (a swipe, a scroll, the player
 * pulled down); the player itself goes on through any of them, and only the
 * surface that shows the picture mounts a view (VideoStageContext). Where
 * the picture is not, the poster stands in. (The web lends its one element
 * instead: LessonVideoSurface.web.tsx.)
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
  const { active, homeGeneration, setPictureInPicture } = useVideoSurface(kind);
  const viewRef = useRef<VideoView>(null);

  useImperativeHandle(ref, () => ({
    enterFullscreen: async () => {
      await viewRef.current?.enterFullscreen();
    },
    startPictureInPicture: async () => {
      await viewRef.current?.startPictureInPicture();
    },
  }), []);

  const pictureShown = active && playback.videoRendition === 'video' && !playback.videoSwitching;

  return (
    <View style={[styles.frame, style]}>
      {active ? (
        // Touches go to what holds the surface (the bar opens the player), never to the picture.
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <VideoView
            // Mounted again after the home view, so this one, the one seen, holds the player.
            key={homeGeneration}
            ref={viewRef}
            player={playback.videoPlayer}
            style={StyleSheet.absoluteFill}
            contentFit={contentFit}
            nativeControls={false}
            // Leaving the app with the picture playing opens the system's window;
            // never for the sound alone, which would show an empty one.
            allowsPictureInPicture={pictureShown}
            startsPictureInPictureAutomatically={pictureShown}
            onPictureInPictureStart={() => setPictureInPicture(true)}
            onPictureInPictureStop={() => setPictureInPicture(false)}
            fullscreenOptions={{ enable: true, orientation: fullscreenOrientation(aspect) }}
            surfaceType="textureView"
            useExoShutter={false}
            playsInline
          />
        </View>
      ) : null}
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

/**
 * Whether a button opens the system's window. Not here: a window opened from
 * the full player would close with it, so iOS and Android open it when the
 * app is left with the picture playing (startsPictureInPictureAutomatically).
 */
export function pictureInPictureButtonSupported(): boolean {
  return false;
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', backgroundColor: COLORS.black },
  buffering: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
});
