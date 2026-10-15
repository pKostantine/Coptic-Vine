import { useEffect, useMemo, useRef } from 'react';
import { PanResponder, Platform } from 'react-native';

import { isStylusGestureEvent } from '../utils/isStylusGestureEvent';

const EDGE_WIDTH = 56;
const TRIGGER_DISTANCE = 60;

/**
 * Swipe in from the left edge to go back, for a full page shown in a Modal.
 * A Modal sits above the navigator, so the system's own swipe-back never
 * reaches it, and Back was the only way out.
 *
 * The same gesture as the document modals (DocumentModal.tsx): taken in the
 * capture phase, so the lists and rows underneath never compete for it, and
 * only once the finger moves -- a tap at the edge, on the Back button, still
 * lands where it was aimed. A browser has no such gesture, so there it does
 * nothing.
 */
export function useEdgeSwipeBack(onBack: () => void, enabled = true) {
  // Kept current without rebuilding the responder, which would drop a swipe
  // already under way whenever the page re-renders.
  const onBackRef = useRef(onBack);
  useEffect(() => {
    onBackRef.current = onBack;
  });
  const takenFromXRef = useRef(0);

  const responder = useMemo(
    () =>
      // eslint-disable-next-line react-hooks/refs -- refs are read in gesture callbacks, not during render
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (event, gestureState) => {
          if (!enabled || isStylusGestureEvent(event)) return false;
          // Where the swipe began. gestureState.x0 is still 0 at this point.
          const startX = gestureState.moveX - gestureState.dx;
          const isBackSwipe =
            startX < EDGE_WIDTH && gestureState.dx > 12 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
          if (isBackSwipe) takenFromXRef.current = startX;
          return isBackSwipe;
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: (event, gestureState) => {
          if (isStylusGestureEvent(event)) return;
          if (gestureState.moveX - takenFromXRef.current > TRIGGER_DISTANCE) onBackRef.current();
        },
      }),
    [enabled],
  );

  return Platform.OS === 'web' ? {} : responder.panHandlers;
}
