import { COPTIC_INITIALS } from '../../constants/copticInitialArt';

/**
 * The decorated initial a titled hymn's Coptic opens with (Coptic Vine Service
 * Reader, "How the drop cap is built"), shared by both readers: the scrolling
 * page (documentHtml.ts) and the slideshow (VerseBlock.js, JustifiedText.js).
 */

// The marks a letter can carry (the jinkim, an overline) ride with it into the initial.
const COPTIC_INITIAL_PATTERN = /^\s*(\S)([\u0300-\u036F\uFE20-\uFE2F]*)/u;

export interface CopticInitialSplit {
  letter: string;
  marks: string;
  /** The paragraph after the letter and its marks. */
  rest: string;
}

/** A Coptic paragraph's opening letter, when there's a decorated initial for it, and the text after it. */
export function splitCopticInitial(text: string): CopticInitialSplit | null {
  const match = COPTIC_INITIAL_PATTERN.exec(text);
  if (!match || !COPTIC_INITIALS[match[1]]) return null;
  return { letter: match[1], marks: match[2], rest: text.slice(match[0].length) };
}

/**
 * The initial's measures for a Coptic line this tall. The design sets them in
 * its own em, two-thirds of its line, so each is that share of this line: two
 * lines tall (nudged down a little, with a gap before the text) beside a
 * paragraph that wraps, one line tall beside one that doesn't. `room` is how
 * much of a line's width it takes.
 */
export function copticInitialMetrics(lineHeight: number) {
  const em = (designEm: number) => Math.round((designEm * lineHeight / 1.5) * 100) / 100;
  return {
    two: { width: em(3.18), height: em(2.86), top: em(0.07), right: em(0.32), left: em(-0.04), room: em(3.18 + 0.32 - 0.04) },
    one: { width: em(1.67), height: lineHeight, right: em(0.14), left: em(-0.02), room: em(1.67 + 0.14 - 0.02) },
  };
}
