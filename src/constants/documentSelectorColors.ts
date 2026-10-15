import { withAlpha, type DocumentTheme } from './documentThemes';

/**
 * The few colours the drawers that slide in over a document need beyond the
 * page's own: the content list (ContentSelectorDrawer), the Bible's verse
 * selector and the Sermon Planner's notes. Everything else in them -- the
 * rows, their hairlines, the gold -- is taken straight from the page the
 * document is read on (constants/documentThemes.ts), so a drawer reads as a
 * leaf of that page rather than the app's black chrome laid over it.
 *
 * On Night each of these is the colour the drawers have always had, since
 * Night is the page they were drawn for. tests/documentSelectorColors.test.cjs
 * holds that, and holds every label in the drawers to 4.5:1 on every page.
 */
export interface DocumentSelectorColors {
  /**
   * The drawer itself: the page a breath lighter, as Night's drawer has
   * always sat at #050505 on black. Paper has nothing lighter to go to, so
   * its drawer is the page, set off by its gold edge.
   */
  panel: string;
  /**
   * Quieter words: a silent prayer's title, the Sermon Planner's notes about
   * itself. The page's own silent colour, carried toward its ink only as far
   * as a label needs to read on a row -- the document can let a silent
   * prayer fade to 3:1, but a title someone has to find and tap cannot.
   */
  quiet: string;
  /** A switch turned off: the page a sixth of the way to its ink, so the track shows on light pages as on dark ones. */
  switchTrack: string;
  /** A control that cannot be used (the Bible's previous and next chapter at either end): nearer the page than the ink. */
  disabled: string;
  /** The dim laid over the page beside a drawer, where one is drawn. */
  scrim: string;
}

const LABEL_CONTRAST = 4.5;

function channels(hex: string): number[] {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** `from` carried `amount` (0 to 1) of the way to `to`. */
function mix(from: string, to: string, amount: number): string {
  const start = channels(from);
  const end = channels(to);
  return `#${start.map((channel, index) => Math.round(channel + (end[index] - channel) * amount).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

/** WCAG contrast ratio between two hex colours. */
function contrast(a: string, b: string): number {
  const luminance = (hex: string) => {
    const [red, green, blue] = channels(hex).map((value) => {
      const channel = value / 255;
      return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

/** `color` as it is, or as little nearer `ink` as reads at 4.5:1 on every one of `grounds`. */
function legibleOn(color: string, ink: string, grounds: string[]): string {
  for (let step = 0; step <= 20; step += 1) {
    const candidate = step === 0 ? color : mix(color, ink, step / 20);
    if (grounds.every((ground) => contrast(candidate, ground) >= LABEL_CONTRAST)) return candidate;
  }
  return ink;
}

export function documentSelectorColors({ colors, dark }: DocumentTheme): DocumentSelectorColors {
  const panel = mix(colors.page, '#FFFFFF', 0.02);
  return {
    panel,
    // A silent prayer's row can be the lit one, so it reads on that too.
    quiet: legibleOn(colors.silent, colors.text, [panel, colors.strip, colors.stripActive]),
    switchTrack: mix(colors.page, colors.text, 0.165),
    disabled: mix(colors.page, colors.text, 0.43),
    // Black at half strength dims a dark page and keeps the drawer the
    // brightest thing on it. Over a light page it turns the paper a dirty
    // grey, so there the page's own ink is laid on lightly instead -- the
    // page recedes the way a sheet does under a shadow, and keeps its hue.
    scrim: dark ? 'rgba(0, 0, 0, 0.48)' : withAlpha(colors.text, 0.3),
  };
}
