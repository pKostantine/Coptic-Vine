import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, useWindowDimensions } from 'react-native';

import { isStylusGestureEvent } from '../utils/isStylusGestureEvent';
import {
  contentsSwipeProgress,
  createReaderSwipeArbiter,
  readerSwipeFinishMs,
  readerSwipeFor,
  readerSwipeGoesThrough,
  type ReaderSwipe,
  type ReaderSwipeSource,
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
 * keeps the touches to itself: `drag` and `release` take those. Where both
 * see one swipe, it is whichever took it first's (createReaderSwipeArbiter).
 *
 * Once the page is on its way out, nothing brings it back: it goes, and
 * `onExit` is called once, until `resetPage` shows it again.
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
  const [arbiter] = useState(createReaderSwipeArbiter);
  // The page is on its way out: 'going' as it slides, 'gone' once onExit is called.
  const leavingRef = useRef<'going' | 'gone' | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (sheetTimerRef.current) clearTimeout(sheetTimerRef.current);
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
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
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    exitTimerRef.current = null;
    leavingRef.current = null;
    arbiter.reset();
    pageOffset.stopAnimation();
    pageOffset.setValue(0);
  }, [arbiter, pageOffset]);

  /**
   * The page slides the rest of the way out, in `ms`, and onExit is called
   * once it is out -- or, should the slide never say it has finished, a
   * moment after it should have.
   */
  const slideAway = useCallback((ms: number) => {
    const current = optionsRef.current;
    leavingRef.current = 'going';
    const exit = () => {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
      if (leavingRef.current !== 'going') return;
      leavingRef.current = 'gone';
      optionsRef.current.onExit();
    };
    const duration = motionDuration(ms, current.reducedMotion);
    Animated.timing(pageOffset, {
      toValue: current.width,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(exit);
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    exitTimerRef.current = setTimeout(exit, duration + 250);
  }, [pageOffset]);

  /** The page goes as a swipe through would take it, with no finger: a close asked for some other way. */
  const leave = useCallback(() => {
    if (leavingRef.current) return;
    arbiter.reset();
    slideAway(readerSwipeFinishMs(optionsRef.current.width, optionsRef.current.width, 0));
  }, [arbiter, slideAway]);

  /** A swipe `distance` along its way: the page, or the sheet, follows. */
  const drag = useCallback((swipe: ReaderSwipe, distance: number, source: ReaderSwipeSource = 'page') => {
    if (leavingRef.current || !arbiter.take(source)) return;
    if (swipe === 'exit') {
      pageOffset.stopAnimation();
      pageOffset.setValue(Math.max(distance, 0));
      return;
    }
    contentsIn.stopAnimation();
    contentsIn.setValue(contentsSwipeProgress(distance, optionsRef.current.contentsWidth));
    setSheetShown(true);
  }, [arbiter, contentsIn, pageOffset]);

  /** The finger lifts `distance` along, moving at `velocity` (px per ms) its way: through, or back. */
  const release = useCallback((swipe: ReaderSwipe, distance: number, velocity: number, source: ReaderSwipeSource = 'page') => {
    if (leavingRef.current || !arbiter.letGo(source)) return;
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
        slideAway(readerSwipeFinishMs(span - distance, span, velocity));
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
  }, [arbiter, contentsIn, contentsShown, pageOffset, slideAway]);

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
        // Not while the page is going, nor while the page's script has this swipe.
        if (leavingRef.current || !arbiter.take('touch')) return false;
        takenRef.current = { swipe, fromDx: gestureState.dx };
        return true;
      },
      onPanResponderTerminationRequest: () => false,
      // Not granted after all: the swipe is nobody's.
      onPanResponderReject: () => {
        if (takenRef.current) arbiter.letGo('touch');
        takenRef.current = null;
      },
      onPanResponderMove: (_, gestureState) => {
        const taken = takenRef.current;
        if (taken) drag(taken.swipe, along(taken, gestureState.dx), 'touch');
      },
      onPanResponderRelease: (_, gestureState) => {
        const taken = takenRef.current;
        takenRef.current = null;
        if (taken) release(taken.swipe, along(taken, gestureState.dx), taken.swipe === 'exit' ? gestureState.vx : -gestureState.vx, 'touch');
      },
      onPanResponderTerminate: () => {
        const taken = takenRef.current;
        takenRef.current = null;
        if (taken) release(taken.swipe, 0, 0, 'touch');
      },
    });
  }, [arbiter, drag, release]);

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
    leave,
    drag,
    release,
  };
}
