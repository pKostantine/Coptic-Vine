import { createContext, useEffect, useRef, useState } from 'react';
import {
  Animated, Easing, PanResponder, type NativeScrollEvent, type NativeSyntheticEvent, type PanResponderCallbacks,
  type PanResponderGestureState,
} from 'react-native';

import { getReducedMotion, motionDuration, releaseDuration } from '../../../utils/useReducedMotion';

const DRAG_TO_CLOSE = 80;

/**
 * For a control inside a sheet that takes drags of its own (the text size
 * slider): hold() as a finger lands on it, release() as it lifts, and the
 * sheet neither takes that finger's pull for its own drag-to-close nor
 * scrolls under it. Without it a slide with a little downward wobble moved
 * the page: the whole sheet at the top of its content, and the content
 * itself anywhere further down -- React Native's scroll view on iOS takes a
 * touch from a native slider once it moves, which a plain iOS one never does.
 */
export interface SheetDragHold {
  hold: () => void;
  release: () => void;
}

export const SheetDragHoldContext = createContext<SheetDragHold | null>(null);

function isPullDown(gesture: PanResponderGestureState) {
  return gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.2;
}

/**
 * Drags a sheet down to close it, the way an iOS sheet pulls down: by its grab
 * handle at any time, and by a pull down anywhere else on the sheet. With its
 * content at the top the sheet follows the finger at once; with the content
 * scrolled down, the pull scrolls it back up first and, once it reaches the
 * top, carries on drawing the sheet down, all in one movement. While the
 * sheet is drawn down its content stays still, so a finger going back up
 * brings the sheet back rather than scrolling under it.
 *
 * Spread `grabHandlers` on the grab handle, `sheetHandlers` on the sheet,
 * `onScroll` on its ScrollView, and turn the ScrollView's scrolling off while
 * `scrollLocked`. A sheet whose content scrolls itself (a web view) takes the
 * grab handle alone, since there is no telling where that content has
 * scrolled to.
 *
 * Let go far or fast enough, the sheet carries on down `travel` points (out
 * of sight) at the finger's own speed as it is told to close, rather than
 * waiting where the finger left it for the page to draw itself again.
 */
export function useSheetDragToClose(visible: boolean, drag: Animated.Value, onClose: () => void, travel = 0) {
  // The handlers outlive renders; they read the latest onClose and travel from here.
  const onCloseRef = useRef(onClose);
  const travelRef = useRef(travel);
  useEffect(() => {
    onCloseRef.current = onClose;
    travelRef.current = travel;
  }, [onClose, travel]);

  // A sheet opens with its content at the top.
  const scrollTopRef = useRef(0);
  useEffect(() => {
    if (visible) scrollTopRef.current = 0;
  }, [visible]);
  // How far the finger had come when the sheet began to follow it: none for
  // the grab handle or for content at its top as the finger lands, and null
  // until a pull on scrolled content has brought it back to its top.
  const followFromRef = useRef<number | null>(0);
  // A control under the finger has its own drag (SheetDragHoldContext), or
  // the sheet is drawn down: either way its content keeps still. The refs
  // for the gesture callbacks, the state for the scroll view.
  const heldRef = useRef(false);
  const pullingRef = useRef(false);
  const [scrollLocked, setScrollLocked] = useState(false);
  const [hold] = useState<SheetDragHold>(() => ({
    hold: () => {
      heldRef.current = true;
      setScrollLocked(true);
    },
    release: () => {
      heldRef.current = false;
      setScrollLocked(pullingRef.current);
    },
  }));

  // eslint-disable-next-line react-hooks/refs -- refs are read in gesture callbacks, not during render
  const [responders] = useState(() => {
    // How far the sheet is drawn down: what the finger has come since the
    // content reached its top, and nothing while a control holds the finger.
    const distance = (gesture: PanResponderGestureState) => {
      if (heldRef.current) return 0;
      if (followFromRef.current === null && scrollTopRef.current <= 0) followFromRef.current = gesture.dy;
      return followFromRef.current === null ? 0 : Math.max(0, gesture.dy - followFromRef.current);
    };
    const settle = () => {
      pullingRef.current = false;
      setScrollLocked(heldRef.current);
    };
    const springBack = () => Animated.spring(drag, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
    const dragging: PanResponderCallbacks = {
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, gesture) => {
        const pulled = distance(gesture);
        if (pulled > 0 && !pullingRef.current) {
          pullingRef.current = true;
          setScrollLocked(true);
        }
        drag.setValue(pulled);
      },
      onPanResponderRelease: (_, gesture) => {
        const pulled = distance(gesture);
        settle();
        if (pulled > DRAG_TO_CLOSE || (pulled > 0 && gesture.vy > 1.2)) {
          const distanceLeft = travelRef.current - pulled;
          if (distanceLeft > 0) {
            Animated.timing(drag, {
              toValue: travelRef.current,
              duration: motionDuration(releaseDuration(distanceLeft, gesture.vy), getReducedMotion()),
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }).start();
          }
          onCloseRef.current();
        } else springBack();
      },
      onPanResponderTerminate: () => {
        settle();
        springBack();
      },
    };
    return {
      grab: PanResponder.create({
        ...dragging,
        // Claimed as the finger lands, so the handle drags at once wherever the
        // content has scrolled to, and the sheet's own pull never takes it.
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          followFromRef.current = 0;
        },
      }),
      sheet: PanResponder.create({
        ...dragging,
        onStartShouldSetPanResponderCapture: () => {
          followFromRef.current = scrollTopRef.current <= 0 ? 0 : null;
          // A new finger: a hold left by one whose end went unseen can't keep the sheet from closing.
          // (React Native settles the responder before a control's own onTouchStart, which holds again.)
          if (heldRef.current) hold.release();
          return false;
        },
        // Taken ahead of the ScrollView, which would otherwise swallow the pull.
        // On iOS the scroll view still scrolls the content up under it natively.
        onMoveShouldSetPanResponderCapture: (_, gesture) => !heldRef.current && isPullDown(gesture),
      }),
    };
  });

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollTopRef.current = event.nativeEvent.contentOffset.y;
  };

  return { grabHandlers: responders.grab.panHandlers, sheetHandlers: responders.sheet.panHandlers, onScroll, hold, scrollLocked };
}
