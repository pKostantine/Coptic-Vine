'use no memo'; // Renders App Language text — see src/utils/appText.ts.
import { useRouter } from 'expo-router';
import { isPictureInPictureSupported, VideoView } from 'expo-video';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Icon from '@/components/vine/ui/Icon';
import { COLORS, TYPOGRAPHY } from '@/constants/theme';
import { useBottomChrome } from '@/context/BottomChromeContext';
import { useLearningPlayer } from '@/context/LearningPlayerContext';
import { usePlayback } from '@/context/PlaybackContext';
import { useReadingPreferences } from '@/context/ReadingPreferencesContext';
import { useVideoStage } from '@/context/VideoStageContext';
import { floatingWindowLayout } from '@/utils/lessonPlayback';
import { SIDEBAR_WIDTH, useLayoutMode } from '@/utils/useLayoutMode';
import { motionDuration, useReducedMotion } from '@/utils/useReducedMotion';

import { tr } from '../../utils/appText';

/** The corners of the surface on a lesson page and in its floating window. */
export const STAGE_RADIUS = 14;
/** How far the floating window must be pulled down to hide, or dragged across to change corners. */
const HIDE_DISTANCE = 40;
const DRAG_SLOP = 8;
/** The floating window's controls go away this long after the last touch. */
const CONTROLS_TIMEOUT_MS = 3200;

interface Frame {
  left: number;
  top: number;
  width: number;
  height: number;
}

// Out of sight but mounted: on the web the player plays only through a
// mounted element, so even sound alone needs one; a pixel will do. Off the
// screen's edge, it takes no touches either.
const HIDDEN_FRAME: Frame = { left: -4, top: -4, width: 1, height: 1 };

/**
 * The one video surface for the whole app (utils/lessonPlayback.ts, "the
 * stage"). While a lesson with a picture is playing it sits, in turn, over
 * the lesson page's slot (LessonVideoSlot), in a small floating window where
 * the now-playing bar would be, or out of sight; it is never remounted, so
 * the picture, the sound and the system's picture-in-picture all carry on
 * across pages.
 */
export default function LessonVideoStage() {
  const { currentHasVideo } = usePlayback();
  if (!currentHasVideo) return null;
  return <StageSurface />;
}

function StageSurface() {
  const router = useRouter();
  const playback = usePlayback();
  const learning = useLearningPlayer();
  const { placement, heroRect, pictureInPicture, setPictureInPicture } = useVideoStage();
  const { tabBarInset, setNowPlayingCollapsed } = useBottomChrome();
  const { preferences, setNowPlayingButtonSide } = useReadingPreferences();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const layoutMode = useLayoutMode();
  const reduced = useReducedMotion();
  const viewRef = useRef<VideoView>(null);

  const floating = floatingWindowLayout({
    windowWidth,
    windowHeight,
    insets,
    side: preferences.nowPlayingButtonSide,
    tabBarInset,
    aspectRatio: playback.videoAspectRatio,
    sidebarWidth: layoutMode === 'desktop' ? SIDEBAR_WIDTH : 0,
  });
  const floatingFrame: Frame = {
    left: floating.left,
    top: windowHeight - floating.bottom - floating.height,
    width: floating.width,
    height: floating.height,
  };
  const heroFrame: Frame | null = heroRect ? { left: heroRect.x, top: heroRect.y, width: heroRect.width, height: heroRect.height } : null;
  // The page has claimed the surface but has not measured its slot yet: the
  // surface waits in the corner and glides up once the slot is known.
  const target: Frame = placement === 'hero'
    ? heroFrame ?? floatingFrame
    : placement === 'floating' ? floatingFrame : HIDDEN_FRAME;
  const hidden = placement === 'hidden';
  const floatingShown = placement === 'floating';

  // The surface glides between its places; appearing from nowhere, it just arrives.
  const [frame] = useState(() => ({
    left: new Animated.Value(target.left),
    top: new Animated.Value(target.top),
    width: new Animated.Value(target.width),
    height: new Animated.Value(target.height),
    opacity: new Animated.Value(hidden ? 0 : 1),
  }));
  const wasHidden = useRef(hidden);
  useEffect(() => {
    const jump = reduced || hidden || wasHidden.current;
    wasHidden.current = hidden;
    frame.opacity.setValue(hidden ? 0 : 1);
    if (jump) {
      frame.left.setValue(target.left);
      frame.top.setValue(target.top);
      frame.width.setValue(target.width);
      frame.height.setValue(target.height);
      return;
    }
    const animation = Animated.parallel([
      Animated.timing(frame.left, { toValue: target.left, duration: motionDuration(260, reduced), easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.timing(frame.top, { toValue: target.top, duration: motionDuration(260, reduced), easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.timing(frame.width, { toValue: target.width, duration: motionDuration(260, reduced), easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.timing(frame.height, { toValue: target.height, duration: motionDuration(260, reduced), easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [frame, hidden, reduced, target.height, target.left, target.top, target.width]);

  // The floating window's controls: shown on a tap and while paused, gone a
  // moment after the last touch.
  const [controlsShown, setControlsShown] = useState(false);
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showControls = useCallback(() => {
    setControlsShown(true);
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => setControlsShown(false), CONTROLS_TIMEOUT_MS);
  }, []);
  useEffect(() => () => { if (controlsTimer.current) clearTimeout(controlsTimer.current); }, []);

  const openLesson = useCallback(() => {
    const item = learning.currentItem;
    if (!item) return;
    if (item.kind === 'lesson') {
      router.push({ pathname: '/learn/lesson/[id]', params: { id: item.id, setId: item.containerId } });
    } else {
      router.push({ pathname: '/learn/album/[id]', params: { id: item.containerId } });
    }
  }, [learning.currentItem, router]);

  const pipSupported = useMemo(() => {
    try {
      if (isPictureInPictureSupported()) return true;
    } catch {
      // The web build answers below.
    }
    if (Platform.OS !== 'web' || typeof document === 'undefined') return false;
    const proto = (globalThis as { HTMLVideoElement?: { prototype: object } }).HTMLVideoElement?.prototype;
    return Boolean((document as { pictureInPictureEnabled?: boolean }).pictureInPictureEnabled) || Boolean(proto && 'webkitSetPresentationMode' in proto);
  }, []);

  const enterPictureInPicture = useCallback(async () => {
    try {
      await viewRef.current?.startPictureInPicture();
      return;
    } catch {
      // Safari has its own way in; anything else simply cannot.
    }
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const video = document.querySelector('video') as (HTMLVideoElement & { webkitSetPresentationMode?: (mode: string) => void }) | null;
    video?.webkitSetPresentationMode?.('picture-in-picture');
  }, []);

  // Dragged across the foot, the window moves to the other corner, as the
  // hidden bar's button does; pulled down, it hides (the sound carries on,
  // alone, so no data goes on frames nobody sees).
  // A browser still clicks what the finger lifts off after a swipe; a tap
  // that ends a swipe is not a tap.
  const [swipedAt, setSwipedAt] = useState(0);
  const latest = useRef({ side: preferences.nowPlayingButtonSide, setNowPlayingButtonSide, setNowPlayingCollapsed, setSwipedAt });
  useEffect(() => {
    latest.current = { side: preferences.nowPlayingButtonSide, setNowPlayingButtonSide, setNowPlayingCollapsed, setSwipedAt };
  }, [preferences.nowPlayingButtonSide, setNowPlayingButtonSide, setNowPlayingCollapsed]);
  const [drag] = useState(() => new Animated.ValueXY({ x: 0, y: 0 }));
  // eslint-disable-next-line react-hooks/refs -- refs are read in gesture callbacks, not during render
  const [pan] = useState(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, gesture) => Math.abs(gesture.dx) > DRAG_SLOP || gesture.dy > DRAG_SLOP,
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (_, gesture) => {
      drag.setValue({ x: gesture.dx, y: Math.max(0, gesture.dy) });
    },
    onPanResponderRelease: (_, gesture) => {
      const { side, setNowPlayingButtonSide: setSide, setNowPlayingCollapsed: collapse, setSwipedAt: markSwiped } = latest.current;
      markSwiped(Date.now());
      const settle = () => Animated.spring(drag, { toValue: { x: 0, y: 0 }, useNativeDriver: false, bounciness: 4 }).start();
      if (gesture.dy > HIDE_DISTANCE && gesture.dy > Math.abs(gesture.dx)) {
        Animated.timing(drag, { toValue: { x: 0, y: 160 }, duration: 140, useNativeDriver: false }).start(() => {
          collapse(true);
          drag.setValue({ x: 0, y: 0 });
        });
        return;
      }
      const across = Math.abs(gesture.dx) > HIDE_DISTANCE || Math.abs(gesture.vx) > 0.5;
      if (across) {
        const next = gesture.dx < 0 ? 'left' : 'right';
        drag.setValue({ x: 0, y: 0 });
        if (next !== side) setSide(next);
        return;
      }
      settle();
    },
    onPanResponderTerminate: () => Animated.spring(drag, { toValue: { x: 0, y: 0 }, useNativeDriver: false, bounciness: 4 }).start(),
  }));
  const guard = (action: () => void) => {
    if (Date.now() - swipedAt < 400) return;
    action();
  };

  const rendition = playback.videoRendition;
  const pictureShown = rendition === 'video' && !hidden;
  const progress = playback.durationMs > 0 ? Math.max(0, Math.min(1, playback.currentTimeMs / playback.durationMs)) : 0;
  const showingControls = floatingShown && (controlsShown || !playback.playing);
  const pipAllowed = !hidden && rendition === 'video';

  return (
    <Animated.View
      style={[
        styles.stage,
        {
          left: frame.left,
          top: frame.top,
          width: frame.width,
          height: frame.height,
          opacity: frame.opacity,
          borderRadius: hidden ? 0 : STAGE_RADIUS,
          transform: floatingShown ? [{ translateX: drag.x }, { translateY: drag.y }] : [],
        },
        floatingShown && styles.floatingShadow,
      ]}
      {...(floatingShown ? pan.panHandlers : {})}
    >
      <VideoView
        ref={viewRef}
        player={playback.videoPlayer}
        style={styles.video}
        contentFit="contain"
        nativeControls={placement === 'hero'}
        allowsPictureInPicture={pipAllowed}
        startsPictureInPictureAutomatically={pipAllowed && Platform.OS !== 'web'}
        onPictureInPictureStart={() => setPictureInPicture(true, placement)}
        onPictureInPictureStop={() => setPictureInPicture(false)}
        fullscreenOptions={{ enable: placement === 'hero' }}
        surfaceType="textureView"
        useExoShutter={false}
        playsInline
      />

      {/* Sound alone, or the picture still on its way: the cover stands in. */}
      {!hidden && (!pictureShown || playback.videoSwitching) ? (
        <View style={styles.curtain}>
          {playback.buffering || playback.videoSwitching ? <ActivityIndicator color={COLORS.gold} /> : null}
          {!pictureShown && !playback.videoSwitching ? (
            <Text style={styles.curtainText}>
              {playback.cellularBlocked
                ? tr('Audio only on cellular', 'Audio seulement en données cellulaires', 'صوت فقط على بيانات الجوال')
                : tr('Audio only', 'Audio seulement', 'صوت فقط')}
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* A tap brings the controls up. They are laid over this layer, not
          inside it: on the web a button may hold no buttons. */}
      {floatingShown ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr('Lesson video. Tap for controls', 'Vidéo de la leçon. Touchez pour les commandes', 'فيديو الدرس. اضغط لعرض الأزرار')}
          onPress={() => guard(showControls)}
          style={styles.touch}
        />
      ) : null}

      {floatingShown && showingControls ? (
        <Pressable accessible={false} focusable={false} onPress={() => guard(showControls)} style={styles.controls}>
          <View style={styles.controlsRow}>
            <ControlButton
              icon="musical-notes-outline"
              label={tr('Audio only', 'Audio seulement', 'صوت فقط')}
              onPress={() => guard(() => playback.setLessonVideoMode('audio'))}
            />
            <View style={styles.controlsSpacer} />
            {pipSupported ? (
              <PictureInPictureButton
                label={tr('Picture in picture', 'Image dans l’image', 'صورة داخل صورة')}
                onPress={() => guard(() => void enterPictureInPicture())}
              />
            ) : null}
            <ControlButton
              icon="open-in-full"
              label={tr('Open the lesson', 'Ouvrir la leçon', 'افتح الدرس')}
              onPress={() => guard(openLesson)}
            />
            <ControlButton
              icon="chevron-down"
              label={tr('Hide the video', 'Masquer la vidéo', 'إخفاء الفيديو')}
              onPress={() => guard(() => setNowPlayingCollapsed(true))}
            />
          </View>
          <View style={styles.transport}>
            <ControlButton icon="play-skip-back" label={tr('Previous', 'Précédent', 'السابق')} onPress={() => guard(playback.previous)} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={playback.playing ? tr('Pause', 'Pause', 'إيقاف مؤقت') : tr('Play', 'Lire', 'تشغيل')}
              onPress={() => guard(playback.togglePlayback)}
              style={({ pressed }) => [styles.playButton, pressed && styles.pressed]}
            >
              <Icon name={playback.playing ? 'pause' : 'play'} size={22} color={COLORS.black} style={playback.playing ? undefined : styles.playNudge} />
            </Pressable>
            <ControlButton icon="play-skip-forward" label={tr('Next lesson', 'Leçon suivante', 'الدرس التالي')} onPress={() => guard(playback.next)} />
          </View>
        </Pressable>
      ) : null}

      {floatingShown ? (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
      ) : null}

      {pictureInPicture && !hidden ? (
        <View style={styles.pipNote}>
          <Text style={styles.pipNoteText}>{tr('Playing in picture in picture', 'Lecture en image dans l’image', 'يُعرض في نافذة صغيرة')}</Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

function ControlButton({ icon, label, onPress }: { icon: 'musical-notes-outline' | 'open-in-full' | 'chevron-down' | 'play-skip-back' | 'play-skip-forward'; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [styles.controlButton, pressed && styles.pressed]}
    >
      <Icon name={icon} size={16} color={COLORS.white} />
    </Pressable>
  );
}

/** A small screen with a smaller one in its corner: the glyph every player uses for picture in picture. */
function PictureInPictureButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [styles.controlButton, pressed && styles.pressed]}
    >
      <View style={styles.pipGlyph}>
        <View style={styles.pipGlyphInner} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stage: {
    position: 'absolute',
    overflow: 'hidden',
    backgroundColor: COLORS.black,
    zIndex: 45,
    elevation: 45,
  },
  floatingShadow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.goldLine,
    ...Platform.select({
      web: { boxShadow: '0 10px 28px rgba(0, 0, 0, 0.55)' } as object,
      default: {
        shadowColor: COLORS.shadow,
        shadowOpacity: 0.5,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
      },
    }),
  },
  video: { width: '100%', height: '100%' },
  curtain: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    pointerEvents: 'none',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.learningDeep,
  },
  curtainText: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  touch: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  controls: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.42)', justifyContent: 'space-between', padding: 6 },
  controlsRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  controlsSpacer: { flex: 1 },
  controlButton: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.45)' },
  transport: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, paddingBottom: 4 },
  playButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.gold },
  playNudge: { marginLeft: 3 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.94 }] },
  progressTrack: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, pointerEvents: 'none', backgroundColor: 'rgba(255, 255, 255, 0.18)' },
  progressFill: { height: 2, backgroundColor: COLORS.gold },
  pipGlyph: { width: 16, height: 12, borderRadius: 2, borderWidth: 1.5, borderColor: COLORS.white, justifyContent: 'flex-end', alignItems: 'flex-end' },
  pipGlyphInner: { width: 7, height: 5, borderRadius: 1, backgroundColor: COLORS.white, marginRight: 1, marginBottom: 1 },
  pipNote: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.learningDeep },
  pipNoteText: { color: COLORS.muted, fontFamily: TYPOGRAPHY.body, fontSize: 12, fontWeight: '700', textAlign: 'center', paddingHorizontal: 12 },
});
