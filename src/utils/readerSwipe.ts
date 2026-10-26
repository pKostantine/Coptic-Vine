/**
 * The two swipes a reader takes on a phone or a tablet, from anywhere on the
 * screen (hooks/useReaderSwipes.ts): to the right it leaves -- a document
 * goes back, a subdocument closes -- and to the left it brings the contents
 * in. Both follow the finger, and go through or slide back when it lifts.
 *
 * On a slide a swipe is always one of these, never a page turned: the slides
 * turn with a tap on either half (SlideshowContainer.js). A browser has
 * neither swipe; its controls float over the page.
 */

export type ReaderSwipe = 'exit' | 'contents';

/** How far a finger goes before it is a swipe rather than a tap. */
export const READER_SWIPE_SLOP = 10;

/** A move counts as sideways once it goes this many times as far across as up or down. */
const SIDEWAYS = 1.2;

/** A finger moving this fast (px per ms) when it lifts has flicked: the swipe goes its way whatever its length. */
const FLICK = 0.3;

/** A swipe let go past this share of its way goes through. */
const THROUGH = 0.35;

/** Which swipe a move is, or null while it may still be a tap, a scroll or a stroke up or down the page. */
export function readerSwipeFor(dx: number, dy: number): ReaderSwipe | null {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;
  if (Math.abs(dx) < READER_SWIPE_SLOP || Math.abs(dx) < Math.abs(dy) * SIDEWAYS) return null;
  return dx > 0 ? 'exit' : 'contents';
}

/**
 * Whether a swipe let go goes through: flicked its way, or dragged past a
 * third of its way. `distance` is how far it came in its own direction,
 * `span` the whole way (the screen's width, or the contents panel's), and
 * `velocity` the finger's speed in that direction as it lifted, in px per ms
 * (negative when it was turning back).
 */
export function readerSwipeGoesThrough(distance: number, span: number, velocity: number): boolean {
  if (!(distance > 0) || !(span > 0)) return false;
  if (velocity <= -FLICK) return false;
  if (velocity >= FLICK) return true;
  return distance >= span * THROUGH;
}

/**
 * How long the rest of the way takes once let go: at the finger's own speed
 * when it was moving on, never slower than the whole way in a quarter of a
 * second, and never so quick it jumps.
 */
export function readerSwipeFinishMs(remaining: number, span: number, velocity: number): number {
  if (!(remaining > 0)) return 0;
  const share = 250 * Math.min(remaining / Math.max(span, 1), 1);
  const atSpeed = velocity > 0.05 ? remaining / velocity : Infinity;
  return Math.round(Math.min(Math.max(Math.min(share, atSpeed), 90), 250));
}

/** The share of the contents panel in view, from how far the finger has brought it. */
export function contentsSwipeProgress(distance: number, panelWidth: number): number {
  if (!(panelWidth > 0) || !(distance > 0)) return 0;
  return Math.min(distance / panelWidth, 1);
}
