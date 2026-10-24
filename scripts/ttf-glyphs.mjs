/**
 * Just enough of a TrueType font to read its glyphs' outlines, for the
 * scripts that turn a font's letters into SVG paths (build-coptic-initials.mjs,
 * build-english-initials.mjs): the character map, simple glyphs' contours,
 * advance widths, and each contour as an SVG path.
 */
import { readFile } from 'node:fs/promises';

export async function readFont(url) {
  const data = await readFile(url);
  const tables = {};
  for (let i = 0; i < data.readUInt16BE(4); i += 1) {
    const record = 12 + i * 16;
    tables[data.toString('latin1', record, record + 4)] = data.readUInt32BE(record + 8);
  }
  return {
    data,
    tables,
    longLoca: data.readInt16BE(tables.head + 50) === 1,
    unitsPerEm: data.readUInt16BE(tables.head + 18),
  };
}

export function glyphIndex(font, codePoint) {
  const { data, tables } = font;
  const cmap = tables.cmap;
  for (let i = 0; i < data.readUInt16BE(cmap + 2); i += 1) {
    const record = cmap + 4 + i * 8;
    const subtable = cmap + data.readUInt32BE(record + 4);
    if (data.readUInt16BE(record) !== 3 || data.readUInt16BE(subtable) !== 4) continue;
    const segments = data.readUInt16BE(subtable + 6) / 2;
    const ends = subtable + 14;
    const starts = ends + segments * 2 + 2;
    const deltas = starts + segments * 2;
    const rangeOffsets = deltas + segments * 2;
    for (let s = 0; s < segments; s += 1) {
      if (codePoint > data.readUInt16BE(ends + s * 2)) continue;
      const start = data.readUInt16BE(starts + s * 2);
      if (codePoint < start) break;
      const delta = data.readInt16BE(deltas + s * 2);
      const rangeOffset = data.readUInt16BE(rangeOffsets + s * 2);
      if (!rangeOffset) return (codePoint + delta) & 0xffff;
      const glyph = data.readUInt16BE(rangeOffsets + s * 2 + rangeOffset + (codePoint - start) * 2);
      if (glyph) return (glyph + delta) & 0xffff;
      break;
    }
  }
  throw new Error(`No glyph for U+${codePoint.toString(16)}`);
}

/** A glyph's advance width, in font units. */
export function advanceWidth(font, index) {
  const { data, tables } = font;
  const metrics = data.readUInt16BE(tables.hhea + 34);
  return data.readUInt16BE(tables.hmtx + Math.min(index, metrics - 1) * 4);
}

/** A simple glyph's contours, each a list of points { x, y, on }. */
export function glyphContours(font, index) {
  const { data, tables, longLoca } = font;
  const offset = longLoca ? data.readUInt32BE(tables.loca + index * 4) : data.readUInt16BE(tables.loca + index * 2) * 2;
  const glyph = tables.glyf + offset;
  const contourCount = data.readInt16BE(glyph);
  if (contourCount < 0) throw new Error(`Glyph ${index} is composite`);
  const ends = Array.from({ length: contourCount }, (_, i) => data.readUInt16BE(glyph + 10 + i * 2));
  const pointCount = ends[contourCount - 1] + 1;
  let at = glyph + 10 + contourCount * 2;
  at += 2 + data.readUInt16BE(at);
  const flags = [];
  while (flags.length < pointCount) {
    const flag = data[at++];
    flags.push(flag);
    if (flag & 8) for (let repeat = data[at++]; repeat > 0; repeat -= 1) flags.push(flag);
  }
  const readCoordinates = (shortBit, sameBit) => {
    let value = 0;
    return flags.map((flag) => {
      if (flag & shortBit) {
        const step = data[at++];
        value += flag & sameBit ? step : -step;
      } else if (!(flag & sameBit)) {
        value += data.readInt16BE(at);
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

export function bounds(points) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return { xMin: Math.min(...xs), xMax: Math.max(...xs), yMin: Math.min(...ys), yMax: Math.max(...ys) };
}

const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, on: true });
const number = (value) => String(Math.round(value * 2) / 2);

/**
 * A TrueType contour as an SVG path, in relative steps, its points first moved
 * by `place` (font units, y up, to the drawing's own): on-curve points joined
 * by lines, off-curve ones as quadratic controls, with the on-curve point
 * between two controls in a row implied, as TrueType implies it.
 */
export function contourPath(contour, place) {
  const placed = contour.map((p) => ({ ...place(p), on: p.on }));
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
