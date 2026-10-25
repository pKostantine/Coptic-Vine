import { VideoView } from 'expo-video';
import { useLayoutEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { usePlayback } from '@/context/PlaybackContext';
import { useVideoStage } from '@/context/VideoStageContext';
import { setLessonVideoHome } from '@/utils/lessonVideoElement';

type PresentationVideo = HTMLVideoElement & {
  webkitPresentationMode?: string;
  webkitDisplayingFullscreen?: boolean;
};

/**
 * The lesson's one <video> element, mounted while a lesson with a picture
 * plays (utils/lessonVideoElement.web.ts). The web player plays only through
 * a mounted element, so the sound alone needs it as much as the picture; it
 * waits here, a pixel out of sight, until a surface borrows it to show the
 * picture. Picture in picture and full screen belong to the element, so they
 * are followed here, wherever it is.
 */
export default function LessonVideoHome() {
  const { currentHasVideo } = usePlayback();
  if (!currentHasVideo) return null;
  return <HomeView />;
}

function HomeView() {
  const { videoPlayer } = usePlayback();
  const { markHomeMounted, setPictureInPicture } = useVideoStage();
  const containerRef = useRef<View>(null);
  const viewRef = useRef<VideoView>(null);

  useLayoutEffect(() => {
    const container = containerRef.current as unknown as HTMLElement | null;
    const video = ((viewRef.current as unknown as { nativeRef?: { current: HTMLVideoElement | null } } | null)?.nativeRef?.current ?? null) as PresentationVideo | null;
    setLessonVideoHome(container, video);
    markHomeMounted();
    if (!video) return () => setLessonVideoHome(null, null);

    const onEnterPip = () => setPictureInPicture(true);
    const onLeavePip = () => setPictureInPicture(false);
    const onPresentationMode = () => setPictureInPicture(video.webkitPresentationMode === 'picture-in-picture');
    // In full screen the browser's own controls are the only ones; inline,
    // the app's stand in for them, and taps pass through the picture to it.
    const onFullscreen = () => {
      const full = document.fullscreenElement === video || video.webkitDisplayingFullscreen === true;
      video.controls = full;
      video.style.pointerEvents = full ? 'auto' : '';
    };
    video.addEventListener('enterpictureinpicture', onEnterPip);
    video.addEventListener('leavepictureinpicture', onLeavePip);
    video.addEventListener('webkitpresentationmodechanged', onPresentationMode);
    document.addEventListener('fullscreenchange', onFullscreen);
    video.addEventListener('webkitbeginfullscreen', onFullscreen);
    video.addEventListener('webkitendfullscreen', onFullscreen);
    return () => {
      video.removeEventListener('enterpictureinpicture', onEnterPip);
      video.removeEventListener('leavepictureinpicture', onLeavePip);
      video.removeEventListener('webkitpresentationmodechanged', onPresentationMode);
      document.removeEventListener('fullscreenchange', onFullscreen);
      video.removeEventListener('webkitbeginfullscreen', onFullscreen);
      video.removeEventListener('webkitendfullscreen', onFullscreen);
      // Back where React put it, so it goes away with this view.
      if (container && video.parentElement !== container) container.appendChild(video);
      setLessonVideoHome(null, null);
    };
  }, [markHomeMounted, setPictureInPicture]);

  return (
    <View ref={containerRef} pointerEvents="none" style={styles.home}>
      <VideoView
        ref={viewRef}
        player={videoPlayer}
        style={styles.video}
        contentFit="contain"
        nativeControls={false}
        allowsPictureInPicture
        fullscreenOptions={{ enable: true }}
        playsInline
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // A pixel off the page's edge: never seen, and it takes no clicks.
  home: { position: 'absolute', left: -4, top: -4, width: 1, height: 1, overflow: 'hidden', opacity: 0 },
  // Sized by whatever holds it: the pixel here, a surface's frame there.
  video: { width: '100%', height: '100%', backgroundColor: '#000000' },
});
