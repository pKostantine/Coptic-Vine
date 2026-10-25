'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { useEffect, useRef, useState } from 'react';
import {
  GestureResponderEvent,
  LayoutChangeEvent,
  PanResponder,
  PanResponderGestureState,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import PlayerIcon from '@/components/playback/PlayerIcon';
import { PLAYER_DIM } from '@/components/playback/PlayerParts';
import { COLORS } from '@/constants/theme';
import { usePlayback } from '@/context/PlaybackContext';

import { tr } from '../../utils/appText';

/** The row's height: the touch band the bar is drawn in, as tall as the speakers' tap targets. */
export const PLAYER_VOLUME_HEIGHT = 28;
const TRACK_HEIGHT = 4;
const TRACK_HEIGHT_ACTIVE = 7;
const ICON_SIZE = 18;
// Unmuting with no earlier level to go back to opens at half.
const UNMUTED_FALLBACK = 0.5;
// What one swipe up or down moves it by with VoiceOver and TalkBack.
const ACCESSIBILITY_STEP = 0.1;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/**
 * The volume bar under the transport: a speaker at either end and a thin
 * white bar, quieter than the gold seek bar above it, that swells while it is
 * held or hovered. The quiet speaker mutes and brings the sound back. Its
 * level is the listener's for both players and every entry, and is kept for
 * the next time the app is opened (PlaybackContext's volume).
 */
export default function PlayerVolume() {
  const { volume, setVolume } = usePlayback();
  const [dragRatio, setDragRatio] = useState<number | null>(null);
  const [hovered, setHovered] = useState(false);

  const widthRef = useRef(0);
  const startRatioRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const pendingRatioRef = useRef<number | null>(null);
  const latest = useRef({ setVolume });
  const lastAudible = useRef(volume > 0 ? volume : UNMUTED_FALLBACK);

  useEffect(() => {
    latest.current = { setVolume };
  }, [setVolume]);

  useEffect(() => {
    if (volume > 0) lastAudible.current = volume;
  }, [volume]);

  useEffect(() => () => {
    if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
  }, []);

  // While held, the bar and the sound follow the finger, at most once a frame.
  const follow = (ratio: number) => {
    pendingRatioRef.current = clamp01(ratio);
    if (frameRef.current != null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      const pending = pendingRatioRef.current;
      pendingRatioRef.current = null;
      if (pending == null) return;
      setDragRatio(pending);
      latest.current.setVolume(pending);
    });
  };

  const release = (ratio: number | null) => {
    if (frameRef.current != null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    pendingRatioRef.current = null;
    if (ratio != null) latest.current.setVolume(clamp01(ratio));
    setDragRatio(null);
  };

  // Created once; everything that changes is read from refs, so a render
  // never tears down a drag in progress (as SeekBar's).
  // eslint-disable-next-line react-hooks/refs -- refs are intentionally read in responder callbacks.
  const [panResponder] = useState(() => PanResponder.create({
    onStartShouldSetPanResponder: () => widthRef.current > 0,
    onMoveShouldSetPanResponder: () => widthRef.current > 0,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (event: GestureResponderEvent) => {
      const ratio = clamp01(event.nativeEvent.locationX / Math.max(1, widthRef.current));
      startRatioRef.current = ratio;
      follow(ratio);
    },
    onPanResponderMove: (_event: GestureResponderEvent, gesture: PanResponderGestureState) => {
      follow(startRatioRef.current + gesture.dx / Math.max(1, widthRef.current));
    },
    onPanResponderRelease: (_event: GestureResponderEvent, gesture: PanResponderGestureState) => {
      release(startRatioRef.current + gesture.dx / Math.max(1, widthRef.current));
    },
    onPanResponderTerminate: () => release(null),
  }));

  const shown = dragRatio ?? volume;
  const muted = shown <= 0;
  const active = dragRatio != null || hovered;
  const percent = Math.round(shown * 100);

  const toggleMute = () => setVolume(muted ? lastAudible.current : 0);

  const hoverProps = Platform.OS === 'web'
    ? { onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false) }
    : {};

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={muted ? tr('Unmute', 'Réactiver le son', 'إلغاء كتم الصوت') : tr('Mute', 'Couper le son', 'كتم الصوت')}
        hitSlop={8}
        onPress={toggleMute}
        style={({ pressed }) => [styles.speaker, pressed && styles.pressed, Platform.OS === 'web' && styles.webCursor]}
      >
        <PlayerIcon name={muted ? 'volume-mute' : 'volume-low'} size={ICON_SIZE} color={PLAYER_DIM} />
      </Pressable>
      <View
        accessibilityRole="adjustable"
        accessibilityLabel={tr('Volume', 'Volume', 'مستوى الصوت')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`${percent}%`}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) => {
          const step = event.nativeEvent.actionName === 'increment' ? ACCESSIBILITY_STEP : -ACCESSIBILITY_STEP;
          setVolume(clamp01(volume + step));
        }}
        onLayout={(event: LayoutChangeEvent) => {
          widthRef.current = event.nativeEvent.layout.width;
        }}
        style={[styles.band, Platform.OS === 'web' && styles.webBand]}
        {...hoverProps}
        {...panResponder.panHandlers}
      >
        <View pointerEvents="none" style={[styles.track, active && styles.trackActive]}>
          <View style={[styles.fill, active && styles.fillActive, { width: `${shown * 100}%` }]} />
        </View>
      </View>
      <View style={styles.speaker} pointerEvents="none">
        <PlayerIcon name="volume-high" size={ICON_SIZE} color={PLAYER_DIM} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { height: PLAYER_VOLUME_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: 10 },
  speaker: { width: PLAYER_VOLUME_HEIGHT, height: PLAYER_VOLUME_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  // A forgiving band around the thin bar, as the seek bar's.
  band: { flex: 1, height: PLAYER_VOLUME_HEIGHT, justifyContent: 'center' },
  webBand: { cursor: 'pointer', touchAction: 'none' } as object,
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    overflow: 'hidden',
  },
  trackActive: { height: TRACK_HEIGHT_ACTIVE, borderRadius: TRACK_HEIGHT_ACTIVE },
  fill: { height: '100%', backgroundColor: 'rgba(255, 255, 255, 0.72)' },
  fillActive: { backgroundColor: COLORS.white },
  pressed: { opacity: 0.7, transform: [{ scale: 0.94 }] },
  webCursor: { cursor: 'pointer' } as object,
});
