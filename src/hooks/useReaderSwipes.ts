import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, useWindowDimensions } from 'react-native';

import { isStylusGestureEvent } from '../utils/isStylusGestureEvent';
import {
  contentsSwipeProgress,
  readerSwipeFinishMs,
  readerSwipeFor,
  readerSwipeGoesThrough,
  type ReaderSwipe,
} from '../utils/readerSwipe';
import { motionDuration, useReducedMotion } from '../utils/useReducedMotion';

interface ReaderSwipesOptions {
  /** The reader is the one on top: nothing covers it, and it is on a phone or a tablet. */
  enabled: boolean;
  /**
   * A swipe to the right is taken here, the page following the finger away.
   * Not where the platform's own back swipe does that instead (iOS's, which
   * shows the page beneath as it goes).
   */
  exitsByDrag: boolean;
  /** How wide the contents panel comes in (readerPanelLayout). */
  contentsWidth: number;
  /** Once the page has slid away. */
  onExit: () => void;
  /** Once the contents are let go far enough in: the panel opens from there, `from` being the share of it already in view. */
  onOpenContents: (from: number) => void;
  /** A touch the swipes leave alone besides a pencil's (`startX`: where it went down, across the screen): one on the pill bar or the Now Playing button. */
  ignores?: (startX: number) => boolean;
}

/**
 * The reader's two swipes (utils/readerSwipe.ts), from anywhere on the
 * screen, each following the finger: to the right the page slides away with
 * it, to the left the contents slide in with it, as a sheet drawn on the page
 * (ReaderPanelSheet) until the panel itself is up over it.
 *
 * They are taken in the capture phase, once a move is plainly sideways, so
 * nothing on the page (a slide, a button, a list) competes for them, while a
 * tap or a scroll still lands where it was aimed. The page's own script
 * reports the same swipes over the scrolling page (documentHtml.ts), which
 * keeps the touches to itself: `drag` and `release` take those.
 */
export function useReaderSwipes(options: ReaderSwipesOptions) {
  const { width } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  // Kept current without rebuilding the responder, which would drop a swipe
  // already under way whenever the page re-renders.
  const optionsRef = useRef({ ...options, width, reducedMotion });
  useEffect(() => {
    optionsRef.current = { ...options, width, reducedMotion };
  });

  // How far the page has gone, and how much of the contents is in (0 to 1).
  const [pageOffset] = useState(() => new Animated.Value(0));
  const [contentsIn] = useState(() => new Animated.Value(0));
  const [sheetShown, setSheetShown] = useState(false);
  const sheetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (sheetTimerRef.current) clearTimeout(sheetTimerRef.current);
  }, []);

  /** The panel is up over the sheet: the sheet goes. */
  const contentsShown = useCallback(() => {
    if (sheetTimerRef.current) clearTimeout(sheetTimerRef.current);
    sheetTimerRef.current = null;
    contentsIn.stopAnimation();
    contentsIn.setValue(0);
    setSheetShown(false);
  }, [contentsIn]);

  /** The page back where it belongs, for a reader shown again (a subdocument). */
  const resetPage = useCallback(() => {
    pageOffset.stopAnimation();
    pageOffset.setValue(0);
  }, [pageOffset]);

  /** A swipe `distance` along its way: the page, or the sheet, follows. */
  const drag = useCallback((swipe: ReaderSwipe, distance: number) => {
    if (swipe === 'exit') {
      pageOffset.stopAnimation();
      pageOffset.setValue(Math.max(distance, 0));
      return;
    }
    contentsIn.stopAnimation();
    contentsIn.setValue(contentsSwipeProgress(distance, optionsRef.current.contentsWidth));
    setSheetShown(true);
  }, [contentsIn, pageOffset]);

  /** The finger lifts `distance` along, moving at `velocity` (px per ms) its way: through, or back. */
  const release = useCallback((swipe: ReaderSwipe, distance: number, velocity: number) => {
    const current = optionsRef.current;
    const ease = (value: Animated.Value, toValue: number, ms: number) =>
      Animated.timing(value, {
        toValue,
        duration: motionDuration(ms, current.reducedMotion),
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });

    if (swipe === 'exit') {
      const span = current.width;
      if (readerSwipeGoesThrough(distance, span, velocity)) {
        ease(pageOffset, span, readerSwipeFinishMs(span - distance, span, velocity)).start(({ finished }) => {
          if (finished) optionsRef.current.onExit();
        });
      } else {
        ease(pageOffset, 0, readerSwipeFinishMs(Math.max(distance, 0), span, 0)).start();
      }
      return;
    }

    const span = current.contentsWidth;
    if (readerSwipeGoesThrough(distance, span, velocity)) {
      current.onOpenContents(contentsSwipeProgress(distance, span));
      // The sheet waits where it was let go until the panel is up over it
      // (contentsShown) -- never for long, should the panel not come.
      if (sheetTimerRef.current) clearTimeout(sheetTimerRef.current);
      sheetTimerRef.current = setTimeout(contentsShown, 700);
      return;
    }
    const progress = contentsSwipeProgress(distance, span);
    ease(contentsIn, 0, readerSwipeFinishMs(progress * span, span, 0)).start(({ finished }) => {
      if (finished) setSheetShown(false);
    });
  }, [contentsIn, contentsShown, pageOffset]);

  // Which swipe the responder took, and how far across the finger was when it did.
  const takenRef = useRef<{ swipe: ReaderSwipe; fromDx: number } | null>(null);
  const responder = useMemo(() => {
    const along = (taken: { swipe: ReaderSwipe; fromDx: number }, dx: number) =>
      taken.swipe === 'exit' ? dx - taken.fromDx : taken.fromDx - dx;
    // eslint-disable-next-line react-hooks/refs -- refs are read in gesture callbacks, not during render
    return PanResponder.create({
      onMoveShouldSetPanResponderCapture: (event, gestureState) => {
        const current = optionsRef.current;
        if (!current.enabled || gestureState.numberActiveTouches > 1 || isStylusGestureEvent(event)) return false;
        // Where the finger went down: gestureState.x0 is still 0 until a responder is granted.
        if (current.ignores?.(gestureState.moveX - gestureState.dx)) return false;
        const swipe = readerSwipeFor(gestureState.dx, gestureState.dy);
        if (!swipe || (swipe === 'exit' && !current.exitsByDrag)) return false;
        takenRef.current = { swipe, fromDx: gestureState.dx };
        return true;
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, gestureState) => {
        const taken = takenRef.current;
        if (taken) drag(taken.swipe, along(taken, gestureState.dx));
      },
      onPanResponderRelease: (_, gestureState) => {
        const taken = takenRef.current;
        takenRef.current = null;
        if (taken) release(taken.swipe, along(taken, gestureState.dx), taken.swipe === 'exit' ? gestureState.vx : -gestureState.vx);
      },
      onPanResponderTerminate: () => {
        const taken = takenRef.current;
        takenRef.current = null;
        if (taken) release(taken.swipe, 0, 0);
      },
    });
  }, [drag, release]);

  return {
    panHandlers: responder.panHandlers,
    /** The page's own transform, as it is swiped away. */
    pageStyle: { transform: [{ translateX: pageOffset }] },
    /** How much of the contents sheet is in, 0 to 1 (ReaderPanelSheet). */
    contentsIn,
    /** Whether the sheet is out: being dragged, let go, or waiting for the panel. */
    sheetShown,
    contentsShown,
    resetPage,
    drag,
    release,
  };
}
