import { VideoView } from 'expo-video';
import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { usePlayback } from '@/context/PlaybackContext';
import { useVideoStage } from '@/context/VideoStageContext';

/**
 * The lesson's player kept in a view, out of sight, while a lesson with a
 * picture plays. Android runs a player's background playback and its media
 * notification only while some view holds it, and the sound alone has no
 * surface to; so this one always does, and each surface mounts its own view
 * after it, to draw the picture (VideoStageContext, `homeGeneration`). iOS
 * plays without a view, so there is nothing to keep there. (The web keeps
 * the lesson's one <video> element here: LessonVideoHome.web.tsx.)
 */
export default function LessonVideoHome() {
  const { currentHasVideo } = usePlayback();
  if (Platform.OS !== 'android' || !currentHasVideo) return null;
  return <HomeView />;
}

function HomeView() {
  const { videoPlayer } = usePlayback();
  const { markHomeMounted } = useVideoStage();
  useEffect(() => {
    markHomeMounted();
  }, [markHomeMounted]);
  return (
    <View pointerEvents="none" style={styles.home}>
      <VideoView
        player={videoPlayer}
        style={styles.video}
        nativeControls={false}
        allowsPictureInPicture={false}
        fullscreenOptions={{ enable: false }}
        surfaceType="textureView"
        useExoShutter={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // A pixel off the screen's edge: never seen, and it takes no touches.
  home: { position: 'absolute', left: -4, top: -4, width: 1, height: 1, overflow: 'hidden', opacity: 0 },
  video: { width: 1, height: 1 },
});
