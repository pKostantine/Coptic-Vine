/**
 * A headpiece's title fitted to the frame's open space (constants/documentOrnaments.ts):
 * a service's name fits at the frame's own size, but a saint's
 * ("The Departure of Pope Milius (Milio), the Third Patriarch of the See of
 * St. Mark") ran out of it, over the frame on the page and cut short on a
 * slide. The slideshow sizes it here, before it is drawn (ui/DocumentOrnaments.tsx);
 * the scrolling page measures it as it is drawn (documentHtml.ts's script).
 */

/** The smallest share of its own size a title shrinks to. */
export const HEADPIECE_MIN_SCALE = 0.6;

/** The title's line height, as both renderers set it. */
export const HEADPIECE_LINE_HEIGHT = 1.12;

// A character's width in em, as Georgia sets capitals letter-spaced by 0.05em
// (an estimate, on the generous side: a title is better a little small than over the frame).
const NARROW = new Set([...".,:;'’()!|I1-"]);
const WIDE = new Set([...'MWÆŒ']);
function capitalWidth(character: string): number {
  if (character === ' ') return 0.3;
  if (NARROW.has(character)) return 0.42;
  if (WIDE.has(character)) return 0.98;
  return 0.78;
}

/** How many lines the words take across `width`, set at `fontSize`, a word to a line at least. */
export function headpieceTitleLines(text: string, width: number, fontSize: number, arabic = false): number {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length || !(width > 0)) return words.length ? words.length : 0;
  const measure = (word: string) => (arabic ? word.length * 0.52 : [...word.toLocaleUpperCase()].reduce((sum, c) => sum + capitalWidth(c), 0)) * fontSize;
  const space = (arabic ? 0.26 : 0.3) * fontSize;
  let lines = 1;
  let used = 0;
  for (const word of words) {
    const wordWidth = measure(word);
    if (used > 0 && used + space + wordWidth > width) {
      lines += 1;
      used = wordWidth;
    } else {
      used += (used > 0 ? space : 0) + wordWidth;
    }
  }
  return lines;
}

/**
 * The largest size, from the frame's own down to HEADPIECE_MIN_SCALE of it,
 * at which the title fits the box, and the lines it takes there.
 */
export function fitHeadpieceTitle(text: string, box: { width: number; height: number }, fontSize: number, arabic = false): { fontSize: number; lines: number } {
  const floor = Math.max(fontSize * HEADPIECE_MIN_SCALE, 1);
  for (let size = fontSize; size >= floor; size -= 0.5) {
    const lines = headpieceTitleLines(text, box.width, size, arabic);
    if (lines * size * HEADPIECE_LINE_HEIGHT <= box.height) return { fontSize: size, lines };
  }
  return { fontSize: floor, lines: headpieceTitleLines(text, box.width, floor, arabic) };
}
