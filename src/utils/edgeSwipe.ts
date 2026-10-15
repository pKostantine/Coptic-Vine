import type { PanResponderGestureState } from 'react-native';

/**
 * How near the screen's edge a swipe must start to go back or open the
 * contents, as the system's own back swipe does. A swipe that starts on the
 * page -- turning a slide, reading on -- never does either: a swipe to the
 * left naturally starts on the right of the screen, one to the right on its
 * left, and wider zones took those for the edge.
 */
export const EDGE_SWIPE_ZONE = 28;

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
  if (startX > screenWidth - EDGE_SWIPE_ZONE) return 'right';
  return null;
}
