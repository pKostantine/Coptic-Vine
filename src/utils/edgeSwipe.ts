import type { PanResponderGestureState } from 'react-native';

/**
 * How near the left edge a swipe must start to go back, as the system's own
 * back swipe does. Kept narrow: a swipe to the right across the page turns
 * back a slide, and must never leave the document instead.
 */
export const EDGE_SWIPE_ZONE = 28;

/**
 * How near the right edge a swipe must start to open the contents: wider,
 * and wider still on a larger screen, since a thumb or finger reaching for
 * the edge of a tablet rarely lands on its last few points. A left swipe
 * that turns a slide still starts well inside it.
 */
export function rightEdgeSwipeZone(screenWidth: number): number {
  return Math.round(Math.min(88, Math.max(48, screenWidth * 0.07)));
}

/**
 * Where a swipe started, from where the finger is now and how far it has
 * come. gestureState.x0 is only filled in once a responder has been granted
 * -- while the handlers decide whether to take a swipe it is still 0 -- so it
 * can't be used to decide.
 */
export function swipeStartX(gestureState: PanResponderGestureState): number {
  return gestureState.moveX - gestureState.dx;
}

/** The edge a swipe started at, or null for a swipe that started on the page. */
export function swipeEdge(startX: number, screenWidth: number): 'left' | 'right' | null {
  if (startX < EDGE_SWIPE_ZONE) return 'left';
  if (startX > screenWidth - rightEdgeSwipeZone(screenWidth)) return 'right';
  return null;
}
