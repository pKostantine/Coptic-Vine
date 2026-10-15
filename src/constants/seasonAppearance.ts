/**
 * The colours of the Books day block, and of the book pages' day cards that
 * follow the chosen day, for the liturgical day it shows — the Coptic Vine
 * design system's "Season colours" (Claude Design, "Coptic Vine":
 * season-colours.md). The calendar sheet keeps the vine green: the block
 * above it is the one that changes, and the Books page's glow behind it
 * (SEASON_GLOWS, below).
 *
 * The theme follows the day's winning indicator key (getSeasonIndicatorKey in
 * seasonNames.ts), which already settles which season or feast a day is named
 * after; getDayThemeKey adds the one thing the name does not say — a minor
 * feast inside a fast keeps the fast's colour. The spec's OKLCH stops are
 * written here as the sRGB hex React Native can draw, the source beside each.
 */

export type SeasonThemeKey =
  | 'annual'
  | 'gold'
  | 'natfast'
  | 'nativity'
  | 'theophany'
  | 'lent'
  | 'palm'
  | 'holyweek'
  | 'resurrection'
  | 'apostles'
  | 'marian';

export interface DayBlockTheme {
  key: SeasonThemeKey;
  /** The block's 160° gradient: `from` at 0, `to` at `toAt`. */
  from: string;
  to: string;
  toAt: number;
  border: string;
  /** The Coptic date, weekday numbers and the next season's name. */
  text: string;
  /** The Gregorian date, weekday letters and the "Next season" label. */
  muted: string;
  /** The week strip's Coptic day numbers and the "· N days" count. */
  strong: string;
  /** The sun button and the season chip's chevron. */
  accent: string;
  /** The sun button's ring. */
  accentBorder: string;
  /** The selected day's pill in the week strip, and the text on it. */
  selected: string;
  selectedText: string;
  /** Behind the season chip. */
  chip: string;
  /** The Live dot sits on red and gold as well as green, so off the annual green it wears a white ring. */
  liveRing: 'halo' | 'white';
}

const GOLD = '#E3B53B';
const GREEN_DEEP = '#14301B';

/** What every theme but Annual shares (spec §1, "Shared rules"). */
const ON_COLOUR = {
  toAt: 0.75,
  border: 'rgba(255, 255, 255, 0.16)',
  text: '#FFFFFF',
  muted: 'rgba(255, 255, 255, 0.72)',
  strong: 'rgba(255, 255, 255, 0.85)',
  accent: GOLD,
  accentBorder: GOLD,
  selected: GOLD,
  selectedText: GREEN_DEEP,
  chip: 'rgba(255, 255, 255, 0.08)',
  liveRing: 'white' as const,
};

export const DAY_BLOCK_THEMES: Record<SeasonThemeKey, DayBlockTheme> = {
  /** Vine green — the design's own block. */
  annual: {
    ...ON_COLOUR,
    key: 'annual',
    from: '#2B5A30',
    to: GREEN_DEEP,
    border: 'rgba(227, 181, 59, 0.30)',
    muted: '#CDD8CB',
    strong: '#ECD48A',
    liveRing: 'halo',
  },
  /** Gold, for feasts: oklch(0.64 0.11 85) → oklch(0.34 0.07 72). The gold accents turn white so they don't sink into it. */
  gold: {
    ...ON_COLOUR,
    key: 'gold',
    from: '#AB8632',
    to: '#4E3104',
    accent: '#FFFFFF',
    accentBorder: '#FFFFFF',
    selected: '#FFFFFF',
  },
  /** Deep rose: oklch(0.48 0.16 352) → oklch(0.22 0.09 345). */
  natfast: { ...ON_COLOUR, key: 'natfast', from: '#9C2A67', to: '#340124', toAt: 0.78 },
  /** Scarlet: oklch(0.50 0.19 26) → oklch(0.22 0.10 22). */
  nativity: { ...ON_COLOUR, key: 'nativity', from: '#B71920', to: '#3D0003', toAt: 0.8 },
  /** Sky blue: oklch(0.62 0.11 232) → oklch(0.35 0.09 240). */
  theophany: { ...ON_COLOUR, key: 'theophany', from: '#2F91BD', to: '#003F64' },
  /** Dark green: oklch(0.36 0.07 155) → oklch(0.17 0.04 155). */
  lent: { ...ON_COLOUR, key: 'lent', from: '#19482C', to: '#011408' },
  /** Light green: oklch(0.68 0.15 130) → oklch(0.46 0.12 140). */
  palm: { ...ON_COLOUR, key: 'palm', from: '#79AA3B', to: '#2E6720' },
  /** Black. */
  holyweek: { ...ON_COLOUR, key: 'holyweek', from: '#141414', to: '#000000', border: 'rgba(227, 181, 59, 0.35)' },
  /** White, with dark text and a darker gold. */
  resurrection: {
    ...ON_COLOUR,
    key: 'resurrection',
    from: '#FFFDF7',
    to: '#E8E2D2',
    border: 'rgba(227, 181, 59, 0.55)',
    text: '#10223A',
    muted: '#5B6573',
    strong: '#8A6A12',
    accent: '#8A6A12',
    accentBorder: '#B08A1C',
    chip: 'rgba(16, 34, 58, 0.07)',
  },
  /** Navy — the old Coptic Vine navy, kept for the Apostles. */
  apostles: { ...ON_COLOUR, key: 'apostles', from: '#0C3158', to: '#001D3D' },
  /** Royal blue: oklch(0.46 0.17 262) → oklch(0.24 0.11 262). */
  marian: { ...ON_COLOUR, key: 'marian', from: '#1C50B5', to: '#001852' },
};

/** Every indicator key the day can be named after, and the colour it wears (spec §2). */
const THEME_BY_INDICATOR_KEY: Record<string, SeasonThemeKey> = {
  annual: 'annual',
  // Lazarus Saturday is its own day but keeps the plain annual colour (§2 A3).
  'lazarus-saturday': 'annual',

  nayrouz: 'gold',
  'nayrouz-period': 'gold',

  'feast-of-the-cross': 'palm',
  'feast-of-the-cross-paremhotep': 'palm',
  'palm-sunday': 'palm',

  'nativity-fast': 'natfast',
  'kiahk-sunday-1': 'natfast',
  'kiahk-sunday-2': 'natfast',
  'kiahk-sunday-3': 'natfast',
  'kiahk-sunday-4': 'natfast',

  nativity: 'nativity',
  'nativity-period': 'nativity',

  theophany: 'theophany',
  'second-day-of-theophany': 'theophany',
  'theophany-period': 'theophany',

  // Every Paramoun wears the Lent green (§2 C12, C14).
  'nativity-paramoun': 'lent',
  'theophany-paramoun': 'lent',
  lent: 'lent',
  'first-monday-of-lent': 'lent',
  'lent-sunday-1': 'lent',
  'lent-sunday-2': 'lent',
  'lent-sunday-3': 'lent',
  'lent-sunday-4': 'lent',
  'lent-sunday-5': 'lent',
  'lent-sunday-6': 'lent',
  'last-friday-of-lent': 'lent',
  'jonahs-fast': 'lent',
  'jonahs-feast': 'lent',

  // Holy Saturday is Bright Saturday here (سبت النور), still Holy Week's black.
  'holy-week': 'holyweek',
  'holy-thursday': 'holyweek',
  'good-friday': 'holyweek',
  'bright-saturday': 'holyweek',

  resurrection: 'resurrection',
  'holy-50-days': 'resurrection',
  'thomas-sunday': 'resurrection',
  ascension: 'resurrection',
  pentecost: 'resurrection',

  'apostles-fast': 'apostles',
  'apostles-feast': 'apostles',

  'st-mary-fast': 'marian',
  'st-marys-feast': 'marian',
  annunciation: 'marian',

  circumcision: 'gold',
  'wedding-at-cana': 'gold',
  'entry-into-temple': 'gold',
  transfiguration: 'gold',
  'entry-into-egypt': 'gold',
  'joyful-29': 'gold',
};

/** The fasts, and the colour a lesser feast inside one keeps. */
const FAST_THEMES: Record<string, SeasonThemeKey> = {
  lent: 'lent',
  'jonahs-fast': 'lent',
  'nativity-fast': 'natfast',
  'apostles-fast': 'apostles',
  'st-mary-fast': 'marian',
};

/**
 * Feasts that name the day but, inside a fast, leave it the fast's colour
 * (§2 C10, C19–D21): the Joyful 29th, the lesser feasts of the Lord, and the
 * second Feast of the Cross in Lent.
 */
const KEEPS_FAST_COLOUR = new Set([
  'joyful-29',
  'circumcision',
  'wedding-at-cana',
  'entry-into-temple',
  'transfiguration',
  'entry-into-egypt',
  'feast-of-the-cross-paremhotep',
]);

/**
 * The day's colour. `indicatorKey` is what the day is named after; `activeKeys`
 * is every season and feast running that day, so a lesser feast can find the
 * fast around it. An unmapped or absent key is an ordinary day.
 */
export function getDayThemeKey(indicatorKey: string | null | undefined, activeKeys: readonly string[] = []): SeasonThemeKey {
  if (indicatorKey && KEEPS_FAST_COLOUR.has(indicatorKey)) {
    const fast = activeKeys.find((key) => FAST_THEMES[key]);
    if (fast) return FAST_THEMES[fast];
  }
  return (indicatorKey ? THEME_BY_INDICATOR_KEY[indicatorKey] : undefined) ?? 'annual';
}

export function getDayTheme(indicatorKey: string | null | undefined, activeKeys: readonly string[] = []): DayBlockTheme {
  return DAY_BLOCK_THEMES[getDayThemeKey(indicatorKey, activeKeys)];
}

/** Where the 160° gradient runs, as expo-linear-gradient's unit-square points. */
export const DAY_BLOCK_GRADIENT_START = { x: 0.33, y: 0 };
export const DAY_BLOCK_GRADIENT_END = { x: 0.67, y: 1 };

/**
 * The light falling from the top of a page (PageGlow in BookPage.tsx): a
 * colour running down to black, with a radial light laid over it. Offsets and
 * radii are fractions of the glow's box, as SVG gradients take them.
 */
export interface PageGlowPalette {
  /** The linear fall, top to foot: [offset, colour]. */
  fall: readonly (readonly [string, string])[];
  /** Where the radial light sits and how far it reaches. */
  light: { cx: string; cy: string; rx: string; ry: string };
  /** The radial light's stops: [offset, colour, opacity]. */
  stops: readonly (readonly [string, string, string])[];
  /** A light that is white at the top: the page's title is set in dark ink over it. */
  lightTop?: boolean;
}

/**
 * The vine glow's shape in a season's colours: its brightest light at the
 * top, a deeper shade under it, the deepest where both fade into black, and
 * the colour the fall starts from.
 */
function seasonGlow(light: string, shade: string, deep: string, top: string): PageGlowPalette {
  return {
    fall: [['0', top], ['0.36', deep], ['1', '#000000']],
    light: { cx: '50%', cy: '12%', rx: '110%', ry: '70%' },
    stops: [['0', light, '0.75'], ['0.3', shade, '0.55'], ['0.58', deep, '0.3'], ['0.85', '#000000', '0']],
  };
}

/** The vine green the tabs and the books open on. */
export const VINE_GLOW = seasonGlow('#346E3A', '#224C28', '#14301B', '#1D4424');

/** Holy Week's: darker, and drawn closer to the top, so the page stays black. */
export const CRIMSON_GLOW: PageGlowPalette = {
  fall: [['0', '#160203'], ['0.3', '#070101'], ['1', '#000000']],
  light: { cx: '50%', cy: '4%', rx: '90%', ry: '55%' },
  stops: [['0', '#5C010F', '0.7'], ['0.35', '#290105', '0.4'], ['0.7', '#000000', '0']],
};

/**
 * The Resurrection's white: a warm white at the top of the page, under the
 * title, falling through pearl to the black the library sits on. The one
 * light glow, so the title over it is set dark (lightTop).
 */
export const RESURRECTION_GLOW: PageGlowPalette = {
  fall: [['0', '#FBF8F0'], ['0.2', '#E7E0D1'], ['0.48', '#6F685C'], ['0.7', '#1A1814'], ['1', '#000000']],
  light: { cx: '50%', cy: '0%', rx: '120%', ry: '45%' },
  stops: [['0', '#FFFFFF', '0.85'], ['0.45', '#FBF6EA', '0.45'], ['1', '#FBF6EA', '0']],
  lightTop: true,
};

/**
 * The glow the Books page wears for each season, under the day block's own
 * colours. Each is the vine glow (oklch 0.485 0.102 146 at its light) turned
 * to the season's hue, and kept about as dark as the vine is, so white text
 * reads the same over any of them: the bright blocks (gold, palm, sky blue)
 * do not make a bright page. The stops are given light / shade / deep / top,
 * the OKLCH source beside each. The Resurrection's alone is white (above).
 */
export const SEASON_GLOWS: Record<SeasonThemeKey, PageGlowPalette> = {
  annual: VINE_GLOW,
  /** Bronze rather than gold: oklch(0.475 0.087 78) → oklch(0.269 0.044 78). */
  gold: seasonGlow('#775519', '#513A10', '#32230B', '#49330E'),
  /** Rose: oklch(0.465 0.128 352) → oklch(0.261 0.065 352). */
  natfast: seasonGlow('#8C3561', '#602341', '#3B1527', '#561E3A'),
  /** Scarlet, warmer and lighter than Holy Week's crimson: oklch(0.465 0.138 27) → oklch(0.260 0.070 27). */
  nativity: seasonGlow('#97312C', '#68201C', '#401310', '#5D1C18'),
  /** A deep sky blue: oklch(0.485 0.097 236) → oklch(0.280 0.049 236). */
  theophany: seasonGlow('#14668E', '#0E4763', '#0C2C3E', '#0C3F58'),
  /** The vine, darker and cooler for the fast: oklch(0.435 0.087 155) → oklch(0.230 0.044 155). */
  lent: seasonGlow('#215F3B', '#123E25', '#092313', '#0F3620'),
  /** A livelier, yellower green: oklch(0.505 0.117 132) → oklch(0.300 0.060 132). */
  palm: seasonGlow('#4B7222', '#345019', '#223412', '#2F4816'),
  holyweek: CRIMSON_GLOW,
  resurrection: RESURRECTION_GLOW,
  /** Navy: oklch(0.425 0.102 253) → oklch(0.220 0.052 253). */
  apostles: seasonGlow('#1F5084', '#113358', '#071B32', '#0D2C4D'),
  /** Royal blue: oklch(0.455 0.138 262) → oklch(0.251 0.070 262). */
  marian: seasonGlow('#2952A2', '#19366F', '#0E2043', '#153063'),
};

export { THEME_BY_INDICATOR_KEY };
