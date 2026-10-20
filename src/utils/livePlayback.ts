import { useAudioPlayer, type AudioPlayerOptions } from 'expo-audio';
import { useVideoPlayer, type VideoPlayer } from 'expo-video';

import type { LivePlaybackSession } from '@/types/playback';

export const AUDIO_PLAYER_OPTIONS: AudioPlayerOptions = {
  updateInterval: 125,
  preferredForwardBufferDuration: 20,
};

/**
 * The playback provider's two players. On iOS and Android they live with the
 * provider, which only goes when the app does. (The web keeps them for the
 * page's life instead: livePlayback.web.ts.)
 */
export function usePlaybackPlayers(setupVideo: (player: VideoPlayer) => void) {
  const player = useAudioPlayer(null, AUDIO_PLAYER_OPTIONS);
  const videoPlayer = useVideoPlayer(null, setupVideo);
  return { player, videoPlayer };
}

export function readLiveSession(): LivePlaybackSession | null {
  return null;
}

export function writeLiveSession(_session: LivePlaybackSession | null): void {
  // Nothing outlives the provider here.
}
