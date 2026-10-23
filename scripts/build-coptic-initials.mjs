/**
 * Rebuilds src/constants/copticInitialArt.ts, the drawings behind the reader's
 * decorated Coptic initials (the two-line drop cap that opens a titled hymn).
 *
 * Run it after the Coptic font changes:  node scripts/build-coptic-initials.mjs
 *
 * CopticVine-Regular draws each Coptic capital as one glyph: the letter set
 * inside a vine of grapes, leaves and tendrils. The drop cap colours the two
 * apart (the letter in the season's colour, the vine in gold), so each glyph
 * is split here, contour by contour, into its letter and its vine:
 *  - the vine's pieces are the ones Ⲙ's vine is drawn with (Ⲙ's letter stands
 *    clear of its vine), wherever they turn up again in another glyph;
 *  - the letter is what lies in the middle column, where the font sets every
 *    letter, rising into the letter's body (or, like Ϯ's cross, crossing the
 *    baseline to stand taller than the rest);
 *  - everything else is vine too: around a letter with a tail (Ⲍ, Ϣ) or a wide
 *    one (Ⲱ, Ϫ) the font redraws a leaf or a cluster of grapes to make room.
 * Left out: the hairline slivers some glyphs carry along the baseline, and a
 * speck or two lying off to the left of the glyph altogether.
 *
 * A vine piece is kept once and shared by every glyph that draws it (to within
 * VINE_MATCH font units), so the 32 vines cost little more than one.
 */
import { writeFile } from 'node:fs/promises';

import { bounds, contourPath, glyphContours, glyphIndex, readFont } from './ttf-glyphs.mjs';

const FONT = new URL('../assets/fonts/CopticVine-Regular-v4.1.ttf', import.meta.url);
const OUTPUT = new URL('../src/constants/copticInitialArt.ts', import.meta.url);

/** The 32 Coptic capitals the font decorates: Ⲁ..Ⲱ, then Ϣ..Ϯ. */
const CAPITALS = [
  ...Array.from({ length: 25 }, (_, i) => 0x2c80 + i * 2),
  ...Array.from({ length: 7 }, (_, i) => 0x03e2 + i * 2),
];
/** Where Ⲙ's letter stands, clear of its vine, in font units. */
const M_LETTER = { xMin: 400, xMax: 1520, yMin: -20, yMax: 920 };
/** The middle column every letter is set in, and how far below the baseline a tail may reach. */
const COLUMN = { xMin: 380, xMax: 1520, yMin: -400 };
/** A contour reaching no higher than this is a leaf under the letter, not the letter. */
const LETTER_BODY = 100;
/** How far a piece may sit from one of Ⲙ's vine pieces and still be that piece, in font units. */
const VINE_LIKE_M = 40;
/** How close two glyphs' pieces must be to share one drawing, in font units. */
const VINE_MATCH = 12;
/** Contours thinner than this are hairline slivers, not drawing. */
const SLIVER = 6;
/** Room around the vine, as the design's drop cap leaves it (8px of its 603). */
const PAD = 26;

const font = await readFont(FONT);

/** The area a contour's points enclose, signed by its direction (a hole runs the other way). */
function area(points) {
  let sum = 0;
  points.forEach((p, i) => {
    const next = points[(i + 1) % points.length];
    sum += p.x * next.y - next.x * p.y;
  });
  return sum / 2;
}

const near = (a, b, tolerance) => ['xMin', 'xMax', 'yMin', 'yMax'].every((edge) => Math.abs(a[edge] - b[edge]) <= tolerance);

/** A hairline sliver, or a speck off to the left of the glyph. */
function isStray(contour) {
  const box = bounds(contour);
  return box.xMax - box.xMin < SLIVER || box.yMax - box.yMin < SLIVER || box.xMax < 0;
}

const within = (box, zone) => box.xMin >= zone.xMin && box.xMax <= zone.xMax && box.yMin >= zone.yMin && box.yMax <= zone.yMax;

const mVine = glyphContours(font, glyphIndex(font, 0x2c98))
  .filter((contour) => !isStray(contour) && !within(bounds(contour), M_LETTER))
  .map(bounds);

function isLetter(contour) {
  const box = bounds(contour);
  if (mVine.some((piece) => near(box, piece, VINE_LIKE_M))) return false;
  if (box.xMax > COLUMN.xMax || box.yMin < COLUMN.yMin || box.yMax <= LETTER_BODY) return false;
  const crossesBaselineTall = box.yMin < 0 && box.yMax > M_LETTER.yMax - 120;
  return (box.xMin >= COLUMN.xMin && box.yMax <= M_LETTER.yMax) || crossesBaselineTall;
}

// Every drawing is placed in one frame: the vine's, with room around it.
const glyphs = CAPITALS.map((codePoint) => {
  const contours = glyphContours(font, glyphIndex(font, codePoint)).filter((contour) => !isStray(contour));
  return {
    letter: String.fromCodePoint(codePoint),
    letterContours: contours.filter(isLetter),
    vineContours: contours.filter((contour) => !isLetter(contour)),
  };
});
const frame = bounds(glyphs.flatMap((glyph) => [...glyph.letterContours, ...glyph.vineContours]).flat());
const width = frame.xMax - frame.xMin + PAD * 2;
const height = frame.yMax - frame.yMin + PAD * 2;

const place = (p) => ({ x: p.x - frame.xMin + PAD, y: frame.yMax - p.y + PAD });
const pieces = [];
function vinePiece(contour) {
  const box = bounds(contour);
  const size = area(contour);
  const match = pieces.findIndex((piece) => near(box, piece.box, VINE_MATCH) && Math.abs(size - piece.size) <= Math.abs(piece.size) * 0.06);
  if (match !== -1) return match;
  pieces.push({ box, size, path: contourPath(contour, place) });
  return pieces.length - 1;
}

// Ⲙ's pieces first, so the pieces the others share are drawn as Ⲙ draws them.
const vines = new Map([...glyphs].sort((a, b) => (b.letter === 'Ⲙ') - (a.letter === 'Ⲙ'))
  .map((glyph) => [glyph.letter, glyph.vineContours.map(vinePiece)]));
const initials = glyphs.map((glyph) => {
  if (!glyph.letterContours.length) throw new Error(`No letter found in ${glyph.letter}`);
  return { letter: glyph.letter, path: glyph.letterContours.map((contour) => contourPath(contour, place)).join(''), vine: vines.get(glyph.letter) };
});

await writeFile(OUTPUT, `/**
 * The decorated Coptic initials, split from CopticVine-Regular's capitals into
 * the vine and the letter so each can take its own colour (the drop cap that
 * opens a titled hymn -- documentHtml.ts). Generated by
 * scripts/build-coptic-initials.mjs -- edit the font, not these strings.
 */

/** Every initial's drawing area, in the font's units: the vine with a little room around it. */
export const COPTIC_INITIAL_VIEWBOX = '0 0 ${width} ${height}';

/** The pieces the vines are drawn from: a leaf, a grape, a tendril. Many glyphs share one. */
export const COPTIC_INITIAL_VINE_PIECES: string[] = [
${pieces.map((piece) => `  ${JSON.stringify(piece.path)},`).join('\n')}
];

export interface CopticInitial {
  /** The letter, as an SVG path in COPTIC_INITIAL_VIEWBOX. */
  letter: string;
  /** Its vine, as indexes into COPTIC_INITIAL_VINE_PIECES. */
  vine: number[];
}

/** Each capital the font decorates. */
export const COPTIC_INITIALS: Record<string, CopticInitial> = {
${initials.map((initial) => `  '${initial.letter}': { letter: ${JSON.stringify(initial.path)}, vine: [${initial.vine.join(', ')}] },`).join('\n')}
};
`);
console.log(`Wrote ${initials.length} initials from ${pieces.length} vine pieces (${width}x${height}).`);
