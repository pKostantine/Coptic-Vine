import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import type { VideoSurfaceKind } from '@/utils/lessonPlayback';

export interface LessonVideoSurfaceProps {
  kind: VideoSurfaceKind;
  style?: StyleProp<ViewStyle>;
  /** What shows where the picture is not: the sound alone, or the picture still on its way. */
  poster: ReactNode;
  /** Laid over the picture: the full player's buttons and notices. */
  children?: ReactNode;
  /** The video's shape, for how full screen turns the device. */
  aspect: number;
  /** 'cover' fills a small thumbnail; 'contain' shows the whole picture. */
  contentFit?: 'contain' | 'cover';
  /** A spinner over the picture while it loads or catches up. */
  showsBuffering?: boolean;
}

export interface LessonVideoSurfaceHandle {
  enterFullscreen: () => Promise<void>;
  /** The system's window, opened from a button (the web; iOS and Android open it when the app is left). */
  startPictureInPicture: () => Promise<void>;
}
