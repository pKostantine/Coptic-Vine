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
import { readFile, writeFile } from 'node:fs/promises';

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

const font = await readFile(FONT);
const tables = {};
for (let i = 0; i < font.readUInt16BE(4); i += 1) {
  const record = 12 + i * 16;
  tables[font.toString('latin1', record, record + 4)] = font.readUInt32BE(record + 8);
}
const longLoca = font.readInt16BE(tables.head + 50) === 1;

function glyphIndex(codePoint) {
  const cmap = tables.cmap;
  for (let i = 0; i < font.readUInt16BE(cmap + 2); i += 1) {
    const record = cmap + 4 + i * 8;
    const subtable = cmap + font.readUInt32BE(record + 4);
    if (font.readUInt16BE(record) !== 3 || font.readUInt16BE(subtable) !== 4) continue;
    const segments = font.readUInt16BE(subtable + 6) / 2;
    const ends = subtable + 14;
    const starts = ends + segments * 2 + 2;
    const deltas = starts + segments * 2;
    const rangeOffsets = deltas + segments * 2;
    for (let s = 0; s < segments; s += 1) {
      if (codePoint > font.readUInt16BE(ends + s * 2)) continue;
      const start = font.readUInt16BE(starts + s * 2);
      if (codePoint < start) break;
      const delta = font.readInt16BE(deltas + s * 2);
      const rangeOffset = font.readUInt16BE(rangeOffsets + s * 2);
      if (!rangeOffset) return (codePoint + delta) & 0xffff;
      const glyph = font.readUInt16BE(rangeOffsets + s * 2 + rangeOffset + (codePoint - start) * 2);
      if (glyph) return (glyph + delta) & 0xffff;
      break;
    }
  }
  throw new Error(`No glyph for U+${codePoint.toString(16)}`);
}

/** A simple glyph's contours, each a list of points { x, y, on }. */
function glyphContours(index) {
  const offset = longLoca ? font.readUInt32BE(tables.loca + index * 4) : font.readUInt16BE(tables.loca + index * 2) * 2;
  const glyph = tables.glyf + offset;
  const contourCount = font.readInt16BE(glyph);
  if (contourCount < 0) throw new Error(`Glyph ${index} is composite`);
  const ends = Array.from({ length: contourCount }, (_, i) => font.readUInt16BE(glyph + 10 + i * 2));
  const pointCount = ends[contourCount - 1] + 1;
  let at = glyph + 10 + contourCount * 2;
  at += 2 + font.readUInt16BE(at);
  const flags = [];
  while (flags.length < pointCount) {
    const flag = font[at++];
    flags.push(flag);
    if (flag & 8) for (let repeat = font[at++]; repeat > 0; repeat -= 1) flags.push(flag);
  }
  const readCoordinates = (shortBit, sameBit) => {
    let value = 0;
    return flags.map((flag) => {
      if (flag & shortBit) {
        const step = font[at++];
        value += flag & sameBit ? step : -step;
      } else if (!(flag & sameBit)) {
        value += font.readInt16BE(at);
        at += 2;
      }
      return value;
    });
  };
  const xs = readCoordinates(2, 16);
  const ys = readCoordinates(4, 32);
  let start = 0;
  return ends.map((end) => {
    const points = [];
    for (let i = start; i <= end; i += 1) points.push({ x: xs[i], y: ys[i], on: Boolean(flags[i] & 1) });
    start = end + 1;
    return points;
  });
}

function bounds(points) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return { xMin: Math.min(...xs), xMax: Math.max(...xs), yMin: Math.min(...ys), yMax: Math.max(...ys) };
}

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

const mVine = glyphContours(glyphIndex(0x2c98))
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
  const contours = glyphContours(glyphIndex(codePoint)).filter((contour) => !isStray(contour));
  return {
    letter: String.fromCodePoint(codePoint),
    letterContours: contours.filter(isLetter),
    vineContours: contours.filter((contour) => !isLetter(contour)),
  };
});
const frame = bounds(glyphs.flatMap((glyph) => [...glyph.letterContours, ...glyph.vineContours]).flat());
const width = frame.xMax - frame.xMin + PAD * 2;
const height = frame.yMax - frame.yMin + PAD * 2;

const place = (p) => ({ x: p.x - frame.xMin + PAD, y: frame.yMax - p.y + PAD, on: p.on });
const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, on: true });
const number = (value) => String(Math.round(value * 2) / 2);

/**
 * A TrueType contour as an SVG path, in relative steps: on-curve points joined
 * by lines, off-curve ones as quadratic controls, with the on-curve point
 * between two controls in a row implied, as TrueType implies it.
 */
function contourPath(contour) {
  const placed = contour.map(place);
  const first = placed.findIndex((p) => p.on);
  const points = first === -1
    ? [midpoint(placed[0], placed[1]), ...placed.slice(1), placed[0]]
    : [...placed.slice(first), ...placed.slice(0, first)];
  let at = points[0];
  const step = (p) => `${number(p.x - at.x)} ${number(p.y - at.y)}`;
  let path = `M${number(at.x)} ${number(at.y)}`;
  for (let i = 1; i <= points.length; i += 1) {
    const p = points[i % points.length];
    if (p.on) {
      if (i < points.length) {
        path += `l${step(p)}`;
        at = p;
      }
      continue;
    }
    const next = points[(i + 1) % points.length];
    const end = next.on ? next : midpoint(p, next);
    path += `q${step(p)} ${step(end)}`;
    at = end;
    if (next.on) i += 1;
  }
  return `${path}z`.replace(/ -/g, '-');
}

const pieces = [];
function vinePiece(contour) {
  const box = bounds(contour);
  const size = area(contour);
  const match = pieces.findIndex((piece) => near(box, piece.box, VINE_MATCH) && Math.abs(size - piece.size) <= Math.abs(piece.size) * 0.06);
  if (match !== -1) return match;
  pieces.push({ box, size, path: contourPath(contour) });
  return pieces.length - 1;
}

// Ⲙ's pieces first, so the pieces the others share are drawn as Ⲙ draws them.
const vines = new Map([...glyphs].sort((a, b) => (b.letter === 'Ⲙ') - (a.letter === 'Ⲙ'))
  .map((glyph) => [glyph.letter, glyph.vineContours.map(vinePiece)]));
const initials = glyphs.map((glyph) => {
  if (!glyph.letterContours.length) throw new Error(`No letter found in ${glyph.letter}`);
  return { letter: glyph.letter, path: glyph.letterContours.map(contourPath).join(''), vine: vines.get(glyph.letter) };
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
