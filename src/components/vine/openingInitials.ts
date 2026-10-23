import {
  ENGLISH_INITIAL_CAP_HEIGHT,
  ENGLISH_INITIAL_UNITS_PER_EM,
  ENGLISH_INITIALS,
  type EnglishInitialGlyph,
} from '../../constants/englishInitialArt';

/**
 * How a hymn's first paragraph opens in English and Arabic, beside the Coptic
 * decorated initial (Coptic Vine Design, "Drop caps and decorated initials",
 * English and Arabic openings, option 3), shared by both readers: the
 * scrolling page (documentHtml.ts) and the slideshow (VerseBlock.js). The
 * first word of each column takes the season's letter colour.
 *
 * English: its first letter two lines tall in Corinthia Bold, the rest of its
 * first word in small capitals. Arabic, which has no capitals: its first word
 * stretched once with kashida, in bold, 1.4 times the text.
 */

/** Georgia's vertical metrics, in ems: where its line's baseline and capitals fall. */
const GEORGIA = { ascent: 0.917, descent: 0.219, capHeight: 0.693 };
/**
 * The design's initial is 3.84 times its text beside lines 1.5 apart: its
 * baseline on line 2's, its capitals reaching to a tenth of an em below line
 * 1's. Kept so at whatever spacing the lines are set.
 */
const CAP_TOP_BELOW_LINE_ONE = 0.1;
/** In the initial's own ems: its margin before it, the gap after its swash beside line 2, and how much nearer line 1 sits. */
const INITIAL_LEFT = -0.02;
const GAP_AFTER_SWASH = 0.03;
const LINE_ONE_TUCK = 0.02;
/** The faint stroke of the letter's own colour that weights it, and its shadow, in the initial's ems. */
const STROKE = 0.014;
const SHADOW = 0.025;
/** Room around the drawing for its stroke and shadow, in font units. */
const DRAWING_PAD = 60;

const UNITS = ENGLISH_INITIAL_UNITS_PER_EM;

/** A paragraph's first letter, when there's an English initial for it, and the text after it. */
export function splitEnglishOpening(text: string): { letter: string; rest: string } | null {
  const match = /^\s*([A-Z])/.exec(text);
  if (!match || !ENGLISH_INITIALS[match[1]]) return null;
  return { letter: match[1], rest: text.slice(match[0].length) };
}

export interface EnglishInitialMetrics {
  glyph: EnglishInitialGlyph;
  /** Pixels to a font unit. */
  unit: number;
  /** Where line 2 starts, and line 1 (a little nearer), from the column's edge. */
  room: number;
  firstRoom: number;
  /** Two lines. */
  height: number;
  /** The drawing: where it sits from the paragraph's top left, how large, and its viewBox. */
  drawing: { left: number; top: number; width: number; height: number; viewBox: string };
  strokeWidth: number;
  shadowOffset: number;
}

/**
 * The English initial beside text of this size and line spacing: as tall as
 * from line 1's capitals to line 2's baseline, its baseline on line 2's (a
 * line's baseline falls where Georgia's ascent puts it, the leading split
 * above and below as the browser and React Native both split it), and wide
 * enough that line 2 starts just past its swash and line 1 a little nearer.
 */
export function englishInitialMetrics(letter: string, fontSize: number, lineHeight: number): EnglishInitialMetrics {
  const glyph = ENGLISH_INITIALS[letter];
  const em = (lineHeight + (GEORGIA.capHeight - CAP_TOP_BELOW_LINE_ONE) * fontSize) / (ENGLISH_INITIAL_CAP_HEIGHT / UNITS);
  const unit = em / UNITS;
  const overhang = Math.max(0, glyph.xMax - glyph.advance) / UNITS;
  const room = em * (INITIAL_LEFT + glyph.advance / UNITS + overhang + GAP_AFTER_SWASH);
  const baseline = lineHeight + (lineHeight - (GEORGIA.ascent + GEORGIA.descent) * fontSize) / 2 + GEORGIA.ascent * fontSize;
  const width = glyph.xMax - glyph.xMin + DRAWING_PAD * 2;
  const height = glyph.yMax - glyph.yMin + DRAWING_PAD * 2;
  return {
    glyph,
    unit,
    room,
    firstRoom: room - em * LINE_ONE_TUCK,
    height: lineHeight * 2,
    drawing: {
      left: em * INITIAL_LEFT + (glyph.xMin - DRAWING_PAD) * unit,
      top: baseline - (glyph.yMax + DRAWING_PAD) * unit,
      width: width * unit,
      height: height * unit,
      viewBox: `${glyph.xMin - DRAWING_PAD} ${-glyph.yMax - DRAWING_PAD} ${width} ${height}`,
    },
    strokeWidth: STROKE * UNITS,
    shadowOffset: SHADOW * UNITS,
  };
}

/** The first word's small capitals: its letters as capitals this share of the text's size, spaced by `letterSpacing` ems. */
export const SMALL_CAPS = { size: 0.7, letterSpacing: 0.06 };
/** The Arabic first word: bold, this many times the text's size. */
export const ARABIC_OPENING_SIZE = 1.4;

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

/** The slideshow's Arabic opening word: bold, 1.4 times the text, in the letter's colour. */
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
