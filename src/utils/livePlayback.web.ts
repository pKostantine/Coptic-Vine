import { useState } from 'react';
import { createAudioPlayer, type AudioPlayer, type AudioPlayerOptions } from 'expo-audio';
import { createVideoPlayer, type VideoPlayer } from 'expo-video';

import type { LivePlaybackSession } from '@/types/playback';

export const AUDIO_PLAYER_OPTIONS: AudioPlayerOptions = {
  updateInterval: 125,
  preferredForwardBufferDuration: 20,
};

// Chrome's Forward, and Back to a page the router keeps no record of, make
// Expo Router rebuild the app's root, and the playback provider with it. With
// the players inside the provider that released them, and the music stopped.
// On the web they live as long as the page does instead, and so does the
// session around them, so a rebuilt provider carries on with what is playing.
let players: { player: AudioPlayer; videoPlayer: VideoPlayer } | null = null;
let session: LivePlaybackSession | null = null;

function sharedPlayers(setupVideo: (player: VideoPlayer) => void) {
  if (!players) {
    const videoPlayer = createVideoPlayer(null);
    setupVideo(videoPlayer);
    players = { player: createAudioPlayer(null, AUDIO_PLAYER_OPTIONS), videoPlayer };
  }
  return players;
}

export function usePlaybackPlayers(setupVideo: (player: VideoPlayer) => void) {
  const [shared] = useState(() => sharedPlayers(setupVideo));
  return shared;
}

export function readLiveSession(): LivePlaybackSession | null {
  return session;
}

export function writeLiveSession(next: LivePlaybackSession | null): void {
  session = next && next.queue.length ? next : null;
}
