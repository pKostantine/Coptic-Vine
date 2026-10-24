import { ENGLISH_INITIALS, type EnglishInitialArt } from '../../constants/englishInitialArt';

/**
 * How a hymn's first paragraph opens in English and Arabic, beside the Coptic
 * decorated initial (Coptic Vine Design, "Drop caps and decorated initials",
 * English and Arabic openings), shared by both readers: the scrolling page
 * (documentHtml.ts) and the slideshow (VerseBlock.js). The first word of each
 * column takes the season's letter colour.
 *
 * English: its first letter an Old English capital with a rising vine, its
 * vine and letter in the initials' colours as the Coptic's are, the rest of
 * its first word in small capitals. Arabic, which has no capitals: its first
 * word stretched once with kashida, in bold.
 */

/** Georgia's vertical metrics, in ems: where its line's baseline and capitals fall. */
const GEORGIA = { ascent: 0.917, descent: 0.219, capHeight: 0.693 };
/**
 * In the text's ems (the design's 10px and 8px beside 22px Georgia): the gap
 * after the initial, and how much nearer the rest of its first word sits.
 */
const GAP_AFTER = 10 / 22;
const FIRST_WORD_NEARER = 8 / 22;

/** A paragraph's first letter, when there's an English initial for it, and the text after it. */
export function splitEnglishOpening(text: string): { letter: string; rest: string } | null {
  const match = /^\s*([A-Z])/.exec(text);
  if (!match || !ENGLISH_INITIALS[match[1]]) return null;
  return { letter: match[1], rest: text.slice(match[0].length) };
}

export interface EnglishInitialMetrics {
  art: EnglishInitialArt;
  /** The square's side, and how far below the paragraph's top it starts. */
  size: number;
  top: number;
  /** Where line 2 starts, and line 1, from the column's edge. */
  room: number;
  firstRoom: number;
  /** Two lines. */
  height: number;
}

/**
 * The English initial beside text of this size and line spacing: a square
 * from line 1's capitals to line 2's baseline (a line's baseline falls where
 * Georgia's ascent puts it, the leading split above and below as the browser
 * and React Native both split it), the gap after it, and line 1 a little
 * nearer when the rest of the first word follows it there.
 */
export function englishInitialMetrics(letter: string, fontSize: number, lineHeight: number, opensWord = true): EnglishInitialMetrics {
  const capTop = (lineHeight - (GEORGIA.ascent + GEORGIA.descent) * fontSize) / 2 + (GEORGIA.ascent - GEORGIA.capHeight) * fontSize;
  const size = lineHeight + GEORGIA.capHeight * fontSize;
  const room = size + GAP_AFTER * fontSize;
  return {
    art: ENGLISH_INITIALS[letter],
    size,
    top: capTop,
    room,
    firstRoom: opensWord ? room - FIRST_WORD_NEARER * fontSize : room,
    height: lineHeight * 2,
  };
}

/** How much nearer the rest of an English first word sits to its initial, in ems. */
export const ENGLISH_FIRST_WORD_NEARER = FIRST_WORD_NEARER;

/** The first word's small capitals: its letters as capitals this share of the text's size, spaced by `letterSpacing` ems. */
export const SMALL_CAPS = { size: 0.7, letterSpacing: 0.06 };
/** The Arabic first word: bold, at the text's own size. */
export const ARABIC_OPENING_SIZE = 1;

/** Arial's vertical metrics, in ems. */
const ARIAL = { ascent: 0.905, descent: 0.212 };

/**
 * How far to raise a word set at another size than its line, when it stands
 * alone among the words of a justified slide row -- each word its own text,
 * centred in the line's height -- so it sits on its neighbours' baseline (in
 * running text it shares their baseline anyway).
 */
function baselineShift(wordSize: number, textSize: number, metrics: { ascent: number; descent: number }) {
  return ((wordSize - textSize) * (metrics.ascent - metrics.descent)) / 2;
}

/**
 * The slideshow's English opening word after its initial: small capitals made
 * as the browser makes them, its letters as capitals at 0.7 of the text, spaced
 * a little, in the letter's colour. The text passes its first word in capitals.
 */
export function englishOpeningWord(fontSize: number, color: string) {
  const size = Math.round(fontSize * SMALL_CAPS.size * 100) / 100;
  return {
    style: { color, fontSize: size, letterSpacing: Math.round(fontSize * SMALL_CAPS.letterSpacing * 100) / 100 },
    baselineShift: baselineShift(size, fontSize, GEORGIA),
  };
}

/** The slideshow's Arabic opening word: bold, in the letter's colour. */
export function arabicOpeningWord(fontSize: number, color: string) {
  const size = Math.round(fontSize * ARABIC_OPENING_SIZE * 100) / 100;
  return {
    style: { color, fontSize: size, fontWeight: '700' as const },
    baselineShift: baselineShift(size, fontSize, ARIAL),
  };
}

/** Letters that join the letter after them (Unicode's dual-joining Arabic letters). */
const JOINS_NEXT = /[ئبت-خس-غف-هىي]/;
/** Letters a letter before them can join. */
const JOINABLE = /[آ-غف-ي]/;
const ALEF = /[آأإا]/;
const MARK = /[ً-ٰٟۖ-ۭ]/;
const TATWEEL = 'ـ';

/**
 * An Arabic word stretched once with kashida (مبارك → مبـــارك): three
 * tatweels between two letters that join, at the join nearest the word's
 * middle -- never after a letter that doesn't join the next (ا د ذ ر ز و),
 * and never between lam and alef, whose ligature it would break. A word with
 * no such join is left as it is.
 */
export function stretchArabicWord(word: string, length = 3): string {
  const clusters: string[] = [];
  for (const char of word) {
    if (MARK.test(char) && clusters.length) clusters[clusters.length - 1] += char;
    else clusters.push(char);
  }
  const middle = (clusters.length - 1) / 2;
  let best = -1;
  for (let i = 0; i < clusters.length - 1; i += 1) {
    const letter = clusters[i][0];
    const next = clusters[i + 1][0];
    if (!JOINS_NEXT.test(letter) || !JOINABLE.test(next) || (letter === 'ل' && ALEF.test(next))) continue;
    if (best === -1 || Math.abs(i - middle) < Math.abs(best - middle)) best = i;
  }
  if (best === -1) return word;
  return [...clusters.slice(0, best + 1), TATWEEL.repeat(length), ...clusters.slice(best + 1)].join('');
}

/** An Arabic paragraph's first word, stretched, and the text after it. */
export function splitArabicOpening(text: string): { word: string; rest: string } | null {
  const match = /^(\s*)(\S+)/.exec(text);
  if (!match) return null;
  return { word: stretchArabicWord(match[2]), rest: text.slice(match[0].length) };
}

/** The rest of a paragraph's first word once its first letter has gone to an initial, if the word goes on after it. */
export function splitRestOfFirstWord(rest: string): { word: string; after: string } | null {
  const match = /^(\S+)/.exec(rest);
  return match ? { word: match[1], after: rest.slice(match[1].length) } : null;
}
