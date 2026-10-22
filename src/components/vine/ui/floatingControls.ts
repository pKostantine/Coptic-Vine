import { withAlpha, type DocumentTheme } from '../../../constants/documentThemes';

/**
 * Where FloatingReaderControls sit and what colours they wear: the capsules
 * that float over a page being read in place of a bar above it (the "Reader
 * controls" and "Service reader" designs). Kept apart from the component so
 * the screens can lay their text out clear of the controls, and so the rules
 * can be tested without rendering.
 */

/** Which reader the controls float over: the Bible keeps Night's gold, the services Night's blue (see floatingControlsAccent). */
export type FloatingReader = 'bible' | 'service';

export interface FloatingControlsColors {
  /** The capsule: the page itself, a little see-through, so it reads as lifted off the page. */
  capsule: string;
  /** Its edge: a hairline of the page's ink. */
  hairline: string;
  /** The glyphs. */
  icon: string;
  /** The title pill's words. */
  text: string;
}

/**
 * The glyphs' colour: the page's second voice, set for each page (Night's
 * blue, Walnut's honey, Vine's celadon, Sepia's oxblood, Paper's Prussian
 * blue), as the Service Reader design has them. Over a Bible chapter on Night
 * they stay gold, the colour of its verse numbers, as the Reader Controls
 * design has them.
 */
export function floatingControlsAccent(theme: DocumentTheme, reader: FloatingReader): string {
  return reader === 'bible' && theme.id === 'night' ? theme.colors.accent : theme.colors.alternate;
}

export function floatingControlsColors(theme: DocumentTheme, reader: FloatingReader): FloatingControlsColors {
  return {
    capsule: withAlpha(theme.colors.page, 0.72),
    hairline: withAlpha(theme.colors.text, 0.1),
    icon: floatingControlsAccent(theme, reader),
    text: theme.colors.text,
  };
}

export interface FloatingControlsLayout {
  /** The capsules' top edge. */
  top: number;
  /** Their row's distance from each side of the screen, clear of a notch. */
  left: number;
  right: number;
  /** Each capsule's height, and a round one's width. */
  size: number;
  /** Where the page's text starts, below the controls. */
  contentTop: number;
  /** A phone on its side gives its status bar's room to the text. */
  hideStatusBar: boolean;
}

interface LayoutInput {
  width: number;
  height: number;
  insets: { top: number; left: number; right: number };
  /** A browser wide enough for the desktop layout (MOBILE_WEB_BREAKPOINT). */
  wideWeb: boolean;
  /** The native app (an iPad or a phone), as opposed to a browser. */
  native: boolean;
}

/** The shorter side from which a native screen is a tablet. */
export const TABLET_MIN_SIDE = 600;

/**
 * Desktop: 14px down and 24px in, the text from 68px. A phone held upright:
 * just under the status bar, 14px in. A phone on its side: the status bar
 * hides, and the capsules sit in the safe area beside the notch. A tablet:
 * 44px capsules, 10px under the status bar, 24px in.
 */
export function floatingControlsLayout({ width, height, insets, wideWeb, native }: LayoutInput): FloatingControlsLayout {
  if (!native && wideWeb) {
    const top = 14;
    const size = 42;
    return { top, left: 24 + insets.left, right: 24 + insets.right, size, contentTop: top + size + 12, hideStatusBar: false };
  }
  if (native && Math.min(width, height) >= TABLET_MIN_SIDE) {
    const top = insets.top + 10;
    const size = 44;
    return { top, left: 24 + insets.left, right: 24 + insets.right, size, contentTop: top + size + 16, hideStatusBar: false };
  }
  const size = 42;
  if (native && width > height) {
    const top = 12;
    return { top, left: Math.max(insets.left, 14), right: Math.max(insets.right, 14), size, contentTop: top + size + 10, hideStatusBar: true };
  }
  const top = insets.top > 0 ? insets.top + 6 : 10;
  return { top, left: 14 + insets.left, right: 14 + insets.right, size, contentTop: top + size + 10, hideStatusBar: false };
}
