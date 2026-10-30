import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Platform, useWindowDimensions } from 'react-native';

import { motionDuration, releaseDuration, useReducedMotion } from '@/utils/useReducedMotion';

const CLOSE_DISTANCE = 90;
const CLOSE_VELOCITY = 1;

/**
 * Pulls a full-screen player down to put it away, the way a sheet behaves:
 * spread `panHandlers` on what may be pulled and move it by `drag`. Only a
 * clear downward drag is taken, so the seek bar and sideways swipes keep
 * working, and it is taken in the capture phase -- asked after them, the
 * artwork and the buttons would already have the touch.
 */
export function usePullDownToClose(onClose: () => void) {
  const { height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const latest = useRef({ onClose, height, reduced });
  useEffect(() => {
    latest.current = { onClose, height, reduced };
  });
  const [drag] = useState(() => new Animated.Value(0));
  // eslint-disable-next-line react-hooks/refs -- refs are read in gesture callbacks, not during render
  const [responder] = useState(() => {
    const useNativeDriver = Platform.OS !== 'web';
    const settle = () => Animated.spring(drag, { toValue: 0, useNativeDriver, bounciness: 4 }).start();
    return PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, gesture) => gesture.dy > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.5,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, gesture) => drag.setValue(Math.max(0, gesture.dy)),
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy <= CLOSE_DISTANCE && gesture.vy <= CLOSE_VELOCITY) { settle(); return; }
        const { onClose: close, height: screenHeight, reduced: still } = latest.current;
        // On down out of sight at the finger's speed, then closed. Left
        // there: put back first, it would show again for a frame.
        Animated.timing(drag, {
          toValue: screenHeight,
          duration: motionDuration(releaseDuration(screenHeight - gesture.dy, gesture.vy), still),
          easing: Easing.out(Easing.quad),
          useNativeDriver,
        }).start(() => close());
      },
      onPanResponderTerminate: settle,
    });
  });
  return { drag, panHandlers: responder.panHandlers };
}
