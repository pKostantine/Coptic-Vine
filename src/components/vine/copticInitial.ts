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

/**
 * A Coptic paragraph's opening letter, when there's a decorated initial for
 * it, and the text after it. A paragraph opening on a small letter has none,
 * unless `capitalise` (the paragraph a hymn opens on after its standalone
 * refrain, kept in lower case in the books): then it takes its capital's.
 */
export function splitCopticInitial(text: string, capitalise = false): CopticInitialSplit | null {
  const match = COPTIC_INITIAL_PATTERN.exec(text);
  const letter = match && capitalise ? match[1].toUpperCase() : match?.[1];
  if (!match || !letter || !COPTIC_INITIALS[letter]) return null;
  return { letter, marks: match[2], rest: text.slice(match[0].length) };
}

/**
 * The initial's measures for a Coptic line this tall. The design sets them in
 * its own em, two-thirds of its line, so each is that share of this line: two
 * lines tall (nudged down a little) beside a paragraph that wraps, one line
 * tall beside one that doesn't. `room` is how much of a line's width it takes:
 * beside the tall one, line 2 starts right at its edge and line 1 a quarter em
 * inside it (`firstRoom`), where the vine is open at that height -- a stepped
 * gap. `right` is the margin that leaves line 1 its room.
 */
export function copticInitialMetrics(lineHeight: number) {
  const em = (designEm: number) => Math.round((designEm * lineHeight / 1.5) * 100) / 100;
  const two = { width: em(3.18), height: em(2.86), top: em(0.07), left: em(-0.04), tuck: em(0.25) };
  const room = Math.round((two.width + two.left) * 100) / 100;
  const firstRoom = Math.round((room - two.tuck) * 100) / 100;
  const oneRoom = em(1.67 + 0.14 - 0.02);
  return {
    two: { ...two, right: Math.round((firstRoom - two.width - two.left) * 100) / 100, room, firstRoom },
    one: { width: em(1.67), height: lineHeight, right: em(0.14), left: em(-0.02), room: oneRoom, firstRoom: oneRoom },
  };
}
