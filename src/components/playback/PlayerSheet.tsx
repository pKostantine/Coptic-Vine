import { ReactNode, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  PanResponderGestureState,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PLAYER_SHEET } from '@/components/playback/PlayerParts';
import { motionDuration, useReducedMotion } from '../../utils/useReducedMotion';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';
// How far down (or, as a side panel, across) you have to drag before the
// sheet closes instead of settling.
const DISMISS_DISTANCE = 90;
const DISMISS_VELOCITY = 0.6;
// The side panel's width before the notch-side clearance is added to it.
const SIDE_PANEL_WIDTH = 356;

interface PlayerSheetProps {
  visible: boolean;
  onClose: () => void;
  accessibilityLabel: string;
  /** Portion of the window the sheet covers, 0–1, when no `top` is given. */
  heightRatio?: number;
  /**
   * Where the sheet's top edge stops, from the top of the window: just under
   * the player's "Playing from" bar, which stays in sight above it.
   */
  top?: number;
  children: ReactNode;
}

/**
 * The near-black sheet that holds the queue on phones (Coptic Vine Player
 * design, "Queue sheet"), where there is no room for side-by-side columns.
 * On a phone held sideways it becomes a panel from the right ("Sheets
 * become a side panel in landscape"). Swipe it away — down, or across for
 * the panel — anywhere that is not scrolling content, or tap the dimmed
 * player behind it.
 */
export default function PlayerSheet({
  visible,
  onClose,
  accessibilityLabel,
  heightRatio = 0.82,
  top,
  children,
}: PlayerSheetProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const side = width > height && height <= 600 && width < 1100;
  const sheetHeight = top != null
    ? Math.max(0, height - top)
    : Math.min(Math.round(height * heightRatio), Math.max(0, height - Math.max(insets.top, 10)));
  const notchClearance = Math.max(insets.right, 22);
  const panelWidth = Math.min(width, SIDE_PANEL_WIDTH + notchClearance);
  const travel = side ? panelWidth : sheetHeight;
  // Kept mounted for the closing animation, then unmounted so the sheet never
  // swallows touches meant for the player behind it.
  const [mounted, setMounted] = useState(visible);
  const [progress] = useState(() => new Animated.Value(0));
  const [drag] = useState(() => new Animated.Value(0));
  const sideRef = useRef(side);
  useEffect(() => {
    sideRef.current = side;
  }, [side]);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Mount during the render that opens it, so the entry animation starts from
  // the closed position on the very next frame.
  if (visible && !mounted) setMounted(true);

  const reduced = useReducedMotion();
  useEffect(() => {
    if (!mounted) return;
    drag.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: motionDuration(visible ? 260 : 200, reduced),
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: USE_NATIVE_DRIVER,
    });
    animation.start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
    return () => animation.stop();
  }, [drag, mounted, progress, reduced, visible]);

  // Attached to the sheet as a whole rather than just the handle. Inner scroll
  // views claim vertical gestures that start on them, so this responds on the
  // handle, the headers and any padding, and never fights the lists.
  // eslint-disable-next-line react-hooks/refs -- refs are read in gesture callbacks, not during render
  const [panResponder] = useState(() => {
    const along = (gesture: PanResponderGestureState) => (sideRef.current ? gesture.dx : gesture.dy);
    const across = (gesture: PanResponderGestureState) => (sideRef.current ? gesture.dy : gesture.dx);
    const settle = () => Animated.spring(drag, { toValue: 0, useNativeDriver: USE_NATIVE_DRIVER, bounciness: 2 }).start();
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gesture: PanResponderGestureState) => (
        along(gesture) > 6 && Math.abs(along(gesture)) > Math.abs(across(gesture))
      ),
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_event, gesture: PanResponderGestureState) => {
        drag.setValue(Math.max(0, along(gesture)));
      },
      onPanResponderRelease: (_event, gesture: PanResponderGestureState) => {
        const velocity = sideRef.current ? gesture.vx : gesture.vy;
        if (along(gesture) > DISMISS_DISTANCE || velocity > DISMISS_VELOCITY) {
          onCloseRef.current();
          return;
        }
        settle();
      },
      onPanResponderTerminate: settle,
    });
  });

  if (!mounted) return null;

  const offset = Animated.add(
    progress.interpolate({ inputRange: [0, 1], outputRange: [travel, 0] }),
    drag,
  );

  return (
    <View style={styles.root} pointerEvents="box-none">
      <Animated.View style={[styles.backdrop, { opacity: progress }]}>
        <Pressable accessibilityLabel="Close panel" onPress={onClose} style={StyleSheet.absoluteFill} />
      </Animated.View>

      <Animated.View
        accessibilityLabel={accessibilityLabel}
        style={side ? [
          styles.panel,
          {
            width: panelWidth,
            paddingRight: notchClearance,
            paddingTop: Math.max(insets.top, 16),
            paddingBottom: Math.max(insets.bottom, 16),
            transform: [{ translateX: offset }],
          },
        ] : [
          styles.sheet,
          {
            height: sheetHeight,
            paddingBottom: insets.bottom,
            paddingLeft: 20 + insets.left,
            paddingRight: 20 + insets.right,
            transform: [{ translateY: offset }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        {side ? null : <View style={styles.grabber} />}
        <View style={styles.body}>{children}</View>
      </Animated.View>
    </View>
  );
}

const shadow = Platform.select({
  web: { boxShadow: '0 -20px 50px rgba(0, 0, 0, 0.5)' } as object,
  default: {
    shadowColor: '#000000',
    shadowOpacity: 0.5,
    shadowRadius: 25,
    shadowOffset: { width: 0, height: -20 },
    elevation: 24,
  },
});

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 60, elevation: 60 },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 10,
    backgroundColor: PLAYER_SHEET,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    ...shadow,
  },
  panel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    paddingLeft: 22,
    backgroundColor: PLAYER_SHEET,
    borderTopLeftRadius: 28,
    borderBottomLeftRadius: 28,
    overflow: 'hidden',
    ...shadow,
  },
  grabber: { width: 40, height: 5, borderRadius: 5, backgroundColor: 'rgba(255, 255, 255, 0.25)', alignSelf: 'center', marginBottom: 14 },
  body: { flex: 1, minHeight: 0 },
});
