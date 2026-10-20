/**
 * The colours the player is tinted with, taken from the cover that is
 * playing: its most telling colour and a second one to run into. Blurring the
 * whole cover averages a mostly-paper drawing to beige, and the player's shade
 * then turned that grey; picking the colours out keeps the blue of the ink.
 */
export interface ArtworkPalette {
  /** The cover's strongest colour, deepened for the backdrop's top. */
  primary: string;
  /** A second colour from the cover, for the backdrop's other end. */
  secondary: string;
  /** Near black in the cover's hue, where the controls sit. */
  deep: string;
  /** A pale wash of the cover's colour, for the frosted panels. */
  panel: string;
  /** For telling one palette from another (fading between covers). */
  key: string;
}

interface Hsl {
  h: number;
  s: number;
  l: number;
}

function toHsl(r: number, g: number, b: number): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: h * 60, s, l };
}

function hsl({ h, s, l }: Hsl, alpha = 1): string {
  const hue = Math.round(((h % 360) + 360) % 360);
  const sat = Math.round(Math.min(1, Math.max(0, s)) * 100);
  const light = Math.round(Math.min(1, Math.max(0, l)) * 100);
  return alpha >= 1 ? `hsl(${hue}, ${sat}%, ${light}%)` : `hsla(${hue}, ${sat}%, ${light}%, ${alpha})`;
}

function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

const BINS = 12;

interface Bin {
  count: number;
  score: number;
  r: number;
  g: number;
  b: number;
}

/**
 * From a cover's pixels (RGBA, as a canvas gives them, at any small size):
 * the hue bands its coloured pixels fall in, weighted by how many there are
 * and how strongly coloured. The strongest band is the primary; the next one
 * at least 45° away, the secondary. A cover with no colour to speak of gets
 * its own greys, warmed by whatever faint hue it has.
 */
export function paletteFromPixels(pixels: ArrayLike<number>): ArtworkPalette | null {
  const bins: Bin[] = Array.from({ length: BINS }, () => ({ count: 0, score: 0, r: 0, g: 0, b: 0 }));
  let total = 0;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue;
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    total += 1;
    sumR += r;
    sumG += g;
    sumB += b;
    const { h, l } = toHsl(r, g, b);
    // How much colour the pixel carries: paper and pale tints have little,
    // though HSL calls a cream nearly as saturated as ink.
    const chroma = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
    // Paper, shadow and grey say little about a cover's colour.
    if (chroma < 0.1 || l < 0.08 || l > 0.96) continue;
    const bin = bins[Math.floor(h / (360 / BINS)) % BINS];
    // Vivid, mid-light pixels count most.
    const weight = chroma * (1 - Math.abs(l - 0.5) * 0.8);
    bin.count += 1;
    bin.score += weight;
    bin.r += r;
    bin.g += g;
    bin.b += b;
  }
  if (!total) return null;

  const average = toHsl(sumR / total, sumG / total, sumB / total);
  const ranked = bins
    .map((bin, index) => ({ ...bin, index }))
    .filter((bin) => bin.count > 0 && bin.count >= total * 0.004)
    .sort((a, b) => b.score - a.score);
  const colourOf = (bin: Bin) => toHsl(bin.r / bin.count, bin.g / bin.count, bin.b / bin.count);

  let primary: Hsl;
  let secondary: Hsl;
  if (!ranked.length) {
    // Greyscale: its own greys, faintly warmed by the average hue.
    primary = { h: average.h, s: Math.min(0.14, average.s), l: 0.3 };
    secondary = { h: average.h, s: Math.min(0.1, average.s), l: 0.18 };
  } else {
    const first = colourOf(ranked[0]);
    const second = ranked.slice(1).find((bin) => hueDistance(colourOf(bin).h, first.h) >= 45);
    primary = { h: first.h, s: Math.min(0.78, Math.max(0.38, first.s)), l: 0.32 };
    secondary = second
      ? { h: colourOf(second).h, s: Math.min(0.7, Math.max(0.3, colourOf(second).s)), l: 0.22 }
      // One colour only: run into the cover's overall tone, or a neighbouring hue.
      : average.s >= 0.12 && hueDistance(average.h, first.h) >= 25
        ? { h: average.h, s: Math.min(0.55, Math.max(0.25, average.s)), l: 0.2 }
        : { h: first.h + 28, s: primary.s * 0.85, l: 0.2 };
  }

  const deep: Hsl = { h: primary.h, s: Math.min(0.5, primary.s), l: 0.07 };
  const panelTint: Hsl = { h: primary.h, s: Math.min(0.6, primary.s), l: 0.72 };
  const palette = {
    primary: hsl(primary),
    secondary: hsl(secondary),
    deep: hsl(deep),
    panel: hsl(panelTint, 0.1),
  };
  return { ...palette, key: `${palette.primary}|${palette.secondary}` };
}
