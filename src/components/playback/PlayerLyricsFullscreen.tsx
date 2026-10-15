'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, PanResponderGestureState, Platform, StyleSheet, Text, View } from 'react-native';

import MusicLyricsView, { LyricsLanguageSwitch } from '@/components/music/MusicLyricsView';
import SeekBar from '@/components/music/SeekBar';
import { PlayerBackdrop, PlayerTransport, usePlayerLayout } from '@/components/playback/PlayerParts';
import RoundIconButton from '@/components/playback/RoundIconButton';
import { useOverlayTransition } from '@/components/playback/useOverlayTransition';
import { COLORS, TYPOGRAPHY } from '@/constants/theme';
import type { PublishedLyricSet } from '@/types/musicConsumer';

import { tr } from '../../utils/appText';
// Swipe distance (or flick speed) on the header that drops back to the player.
const EXIT_DISTANCE = 130;
const EXIT_VELOCITY = 0.75;

/**
 * On web the full-screen lyrics view also takes the browser full screen, and
 * leaving it (Esc) closes the view. Native just shows the overlay, which
 * already covers the whole app.
 */
function useBrowserFullscreen(active: boolean, onExit: () => void) {
  const onExitRef = useRef(onExit);
  useEffect(() => {
    onExitRef.current = onExit;
  }, [onExit]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !active || typeof document === 'undefined') return;
    const root = document.documentElement;
    let entered = false;

    const handleChange = () => {
      if (entered && !document.fullscreenElement) onExitRef.current();
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onExitRef.current();
    };

    document.addEventListener('fullscreenchange', handleChange);
    document.addEventListener('keydown', handleKey);
    if (root.requestFullscreen && !document.fullscreenElement) {
      root.requestFullscreen().then(() => { entered = true; }).catch(() => undefined);
    }

    return () => {
      document.removeEventListener('fullscreenchange', handleChange);
      document.removeEventListener('keydown', handleKey);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    };
  }, [active]);
}

interface PlayerLyricsFullscreenProps {
  visible: boolean;
  onExit: () => void;
  artworkUri: string | null;
  /** The cover, drawn at the size it is given. */
  renderArtwork: (size: number, radius: number) => ReactNode;
  title: string;
  subtitle: string;
  isArabic: boolean;
  lyricSets: PublishedLyricSet[];
  selectedSetId: string | null;
  onSelectSet: (id: string) => void;
  activeLineId: string | null;
  loading: boolean;
  onSeekLine: (startMs: number) => void;
  positionMs: number;
  durationMs: number;
  onSeek: (positionMs: number) => void;
  playing: boolean;
  buffering: boolean;
  onPrevious: () => void;
  onTogglePlayback: () => void;
  onNext: () => void;
}

/**
 * The lyrics taking the whole screen (Coptic Vine Player design, "Lyrics full
 * screen"), over the artwork's glow dimmed evenly: the song and the way back
 * at the top, the language switch, the lines, and the seek bar and transport
 * at the foot. A phone stacks it; a phone on its side keeps four lines and
 * one row of controls; an iPad or a desktop sets the lines large and centred.
 * Swipe the top down, press Esc or the collapse button to drop back.
 */
export default function PlayerLyricsFullscreen(props: PlayerLyricsFullscreenProps) {
  const { visible, onExit } = props;
  const transition = useOverlayTransition(visible);
  const onExitRef = useRef(onExit);
  useEffect(() => {
    onExitRef.current = onExit;
  }, [onExit]);
  useBrowserFullscreen(visible, onExit);

  // Swiping the top down drops back to the player. Taken in the capture
  // phase, as the player's own pull is, so a swipe that starts on the
  // language switch or the collapse button still counts.
  // eslint-disable-next-line react-hooks/refs -- refs are read in gesture callbacks, not during render
  const [exitResponder] = useState(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_event, gesture: PanResponderGestureState) => (
      gesture.dy > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.5
    ),
    onPanResponderTerminationRequest: () => false,
    onPanResponderRelease: (_event, gesture: PanResponderGestureState) => {
      if (gesture.dy > EXIT_DISTANCE || gesture.vy > EXIT_VELOCITY) onExitRef.current();
    },
  }));

  if (!transition.mounted) return null;

  return (
    <Animated.View
      style={[
        styles.root,
        {
          opacity: transition.progress,
          transform: [{ scale: transition.progress.interpolate({ inputRange: [0, 1], outputRange: [1.03, 1] }) }],
        },
      ]}
    >
      <PlayerBackdrop uri={props.artworkUri} flat />
      <FullscreenBody {...props} exitHandlers={exitResponder.panHandlers} />
    </Animated.View>
  );
}

function FullscreenBody({
  onExit,
  renderArtwork,
  title,
  subtitle,
  isArabic,
  lyricSets,
  selectedSetId,
  onSelectSet,
  activeLineId,
  loading,
  onSeekLine,
  positionMs,
  durationMs,
  onSeek,
  playing,
  buffering,
  onPrevious,
  onTogglePlayback,
  onNext,
  exitHandlers,
}: PlayerLyricsFullscreenProps & { exitHandlers: object }) {
  const { kind, width, insets } = usePlayerLayout();
  const landscape = kind === 'phoneLandscape';
  const phone = !landscape && width < 640;

  const collapse = (
    <RoundIconButton
      icon="lyrics-collapse"
      accessibilityLabel={tr('Exit full screen lyrics', 'Quitter les paroles en plein écran', 'الخروج من الكلمات بملء الشاشة')}
      onPress={onExit}
      size={40}
      variant="filled"
      fill="rgba(255, 255, 255, 0.12)"
      iconSize={18}
    />
  );
  const lyrics = (
    <MusicLyricsView
      lyricSets={lyricSets}
      selectedSetId={selectedSetId}
      onSelectSet={onSelectSet}
      activeLineId={activeLineId}
      loading={loading}
      onSeekLine={onSeekLine}
      variant="player"
      scale={landscape ? 'landscape' : phone ? 'phone' : 'large'}
      hideTabs
    />
  );
  const seek = <SeekBar positionMs={positionMs} durationMs={durationMs} onSeek={onSeek} />;
  const transport = (size: 'regular' | 'small') => (
    <PlayerTransport
      playing={playing}
      buffering={buffering}
      onPrevious={onPrevious}
      onTogglePlayback={onTogglePlayback}
      onNext={onNext}
      size={size}
    />
  );
  const switcher = (size: 'wide' | 'mini') => (
    <LyricsLanguageSwitch sets={lyricSets} selectedId={selectedSetId} onSelect={onSelectSet} size={size} isArabic={isArabic} />
  );

  if (landscape) {
    const side = Math.max(insets.left, insets.right, 24);
    return (
      <View style={[styles.body, { paddingTop: Math.max(insets.top, 6), paddingBottom: Math.max(insets.bottom, 12), paddingHorizontal: side }]}>
        <View style={[styles.songRow, styles.songRowLandscape]} {...exitHandlers}>
          {renderArtwork(46, 9)}
          <SongText title={title} subtitle={subtitle} size={16} />
          {switcher('mini')}
          {collapse}
        </View>
        {lyrics}
        <View style={styles.landscapeControls}>
          <View style={[styles.landscapeSeek, styles.liftSeek]}>{seek}</View>
          {transport('small')}
        </View>
      </View>
    );
  }

  if (phone) {
    return (
      <View style={[styles.body, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 28), paddingHorizontal: 24 }]}>
        <View {...exitHandlers}>
          <View style={styles.songRow}>
            {renderArtwork(46, 9)}
            <SongText title={title} subtitle={subtitle} size={16} />
            {collapse}
          </View>
          <View style={styles.phoneSwitch}>{switcher('wide')}</View>
        </View>
        {lyrics}
        <View style={styles.liftSeek}>{seek}</View>
        {transport('regular')}
      </View>
    );
  }

  return (
    <View style={[styles.body, { paddingTop: 18 + insets.top, paddingBottom: 30 + insets.bottom, paddingLeft: 40 + insets.left, paddingRight: 40 + insets.right }]}>
      <View style={styles.largeHeader} {...exitHandlers}>
        <View style={styles.largeSide}>
          {renderArtwork(50, 10)}
          <SongText title={title} subtitle={subtitle} size={18} />
        </View>
        {switcher('mini')}
        <View style={[styles.largeSide, styles.largeSideEnd]}>{collapse}</View>
      </View>
      {lyrics}
      <View style={styles.largeControls}>
        <View style={styles.liftSeek}>{seek}</View>
        <View style={styles.largeTransport}>{transport('small')}</View>
      </View>
    </View>
  );
}

function SongText({ title, subtitle, size }: { title: string; subtitle: string; size: number }) {
  return (
    <View style={styles.songText}>
      <Text numberOfLines={1} style={[styles.songTitle, { fontSize: size }]}>{title}</Text>
      {subtitle ? <Text numberOfLines={1} style={[styles.songSubtitle, size >= 18 && styles.songSubtitleLarge]}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, elevation: 100, backgroundColor: COLORS.black },
  body: { flex: 1, minHeight: 0 },
  songRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12 },
  songRowLandscape: { minHeight: 50 },
  songText: { flex: 1, minWidth: 0 },
  // Left as in English whatever the title's language: the layout never mirrors.
  songTitle: { color: COLORS.white, fontFamily: TYPOGRAPHY.title, fontWeight: '700', textAlign: 'left' },
  songSubtitle: { color: COLORS.goldBright, fontFamily: TYPOGRAPHY.body, fontSize: 12.5, marginTop: 2, textAlign: 'left' },
  songSubtitleLarge: { fontSize: 13.5 },
  phoneSwitch: { marginTop: 4 },
  // The seek bar's touch band reaches 10pt above the bar; drawn where the
  // design puts the bar itself.
  liftSeek: { marginTop: -10 },
  landscapeControls: { flexDirection: 'row', alignItems: 'center', gap: 24 },
  landscapeSeek: { flex: 1, minWidth: 0 },
  largeHeader: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 20 },
  largeSide: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  largeSideEnd: { justifyContent: 'flex-end' },
  largeControls: { width: '100%', maxWidth: 900, alignSelf: 'center' },
  largeTransport: { marginTop: 14 },
});
