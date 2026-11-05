import type { DocumentTheme } from './documentThemes';
import { INTERLACE_ART, LINTEL_ART, MEDALLION_ART, ROUNDELS_ART, STEPPED_ART, type OrnamentArt } from './ornamentArt';
import type { SeasonThemeKey } from './seasonAppearance';

/**
 * The ornaments a document is dressed with (Coptic Vine Ornaments 1): a
 * headpiece a title is set inside -- the Lintel over each Hoos, the Stepped
 * frame over a service's own name at its start, the
 * Interlace over the Theotokia of the day, the Three Roundels over the Psalm
 * and Gospel -- and the Medallion that closes a service.
 */
export type DocumentOrnament = 'lintel' | 'stepped' | 'interlace' | 'roundels' | 'medallion';
export type HeadpieceOrnament = Exclude<DocumentOrnament, 'medallion'>;

export interface HeadpieceFrame {
  art: OrnamentArt;
  /** Where the title sits in the frame's open space, as percentages of the art's width and height (the sheet's own placement). */
  text: { left: number; right: number; top: number; bottom: number };
  /** The title's size as a percentage of the art's width, as the sheet sets it. */
  fontSize: number;
  /** A phone draws a headpiece only ~370pt wide; the title never shrinks below this. */
  minFontSize: number;
}

export const HEADPIECES: Record<HeadpieceOrnament, HeadpieceFrame> = {
  lintel: { art: LINTEL_ART, text: { left: 14, right: 14, top: 66, bottom: 3 }, fontSize: 2.6, minFontSize: 15 },
  stepped: { art: STEPPED_ART, text: { left: 25, right: 25, top: 46, bottom: 4 }, fontSize: 3.9, minFontSize: 16 },
  interlace: { art: INTERLACE_ART, text: { left: 17, right: 17, top: 41, bottom: 6 }, fontSize: 4.6, minFontSize: 17 },
  roundels: { art: ROUNDELS_ART, text: { left: 22, right: 22, top: 50, bottom: 5 }, fontSize: 3.6, minFontSize: 16 },
};

export const MEDALLION = MEDALLION_ART;

export function isHeadpiece(ornament: DocumentOrnament | undefined): ornament is HeadpieceOrnament {
  return ornament === 'lintel' || ornament === 'stepped' || ornament === 'interlace' || ornament === 'roundels';
}

/**
 * Each season's ornament colour on the Night page: the headpiece colour of
 * the Coptic Vine Design's season colours (Seasons, "Season colours - Night",
 * final), which the service's headpiece and the title inside it take, and so
 * every headpiece and the closing medallion.
 */
const ON_BLACK: Record<SeasonThemeKey, string> = {
  annual: '#5FAE68',
  gold: '#E3B53B',
  natfast: '#D9578C',
  nativity: '#45A85B',
  theophany: '#7FCDBD',
  lent: '#9A72C8',
  palm: '#B2D682',
  holyweek: '#B5272E',
  resurrection: '#E3B53B',
  apostles: '#EE9F55',
  marian: '#5A82E0',
};

/**
 * The same seasons deepened to read on white paper, each at least 4.5:1. The
 * Resurrection takes the white day block's gold, as on black.
 */
const ON_WHITE: Record<SeasonThemeKey, string> = {
  annual: '#3A8444',
  gold: '#966D00',
  natfast: '#B03A6E',
  nativity: '#BB2F27',
  theophany: '#247BA2',
  lent: '#2F6E50',
  palm: '#5B8000',
  holyweek: '#A0202A',
  resurrection: '#966D00',
  apostles: '#2F62A6',
  // A cobalt in the azure's hue, oklch(0.50 0.16 258): 6.1:1 on white.
  marian: '#1D60BC',
};

/**
 * The colour a page's ornaments are drawn in. Night and Paper follow the
 * season of the day being prayed; Walnut, Vine and Sepia keep to their own
 * page, in its white or its black -- the page's text colour -- whatever the
 * season.
 */
export function documentOrnamentColor(theme: DocumentTheme, season?: SeasonThemeKey | null): string {
  const key = season ?? 'annual';
  if (theme.id === 'night') return ON_BLACK[key];
  if (theme.id === 'paper') return ON_WHITE[key];
  return theme.colors.text;
}

/**
 * The season's colours on the Night page (Coptic Vine Design, Seasons,
 * "Season colours - Night", final): the decorated initials' vine and its
 * grapes, and in a blue alternate verse the Coptic initial's vine instead
 * (the English initials don't change); their letter, which the opening words
 * of every column take too; and the section titles. The headpieces' colour is
 * ON_BLACK's. Rubrics stay red in every season.
 */
const NIGHT_SEASON_COLORS: Record<SeasonThemeKey, InitialColors> = {
  annual: { vine: '#E3B53B', vineInBlue: '#4FA3C0', letter: '#5FAE68', title: '#E3B53B' },
  gold: { vine: '#5FAE68', vineInBlue: '#5D8FE6', letter: '#EDBE45', title: '#EDBE45' },
  natfast: { vine: '#C2416F', vineInBlue: '#C2416F', letter: '#45A85B', title: '#EC86A2' },
  nativity: { vine: '#EB4A3E', vineInBlue: '#5D8FE6', letter: '#45A85B', title: '#45A85B' },
  theophany: { vine: '#2E7A72', vineInBlue: '#3E9BD6', letter: '#7FCDBD', title: '#8FD5C6' },
  lent: { vine: '#6B3E91', vineInBlue: '#6B3E91', letter: '#C9A45C', title: '#B79BDB' },
  palm: { vine: '#E3B53B', vineInBlue: '#66B3EE', letter: '#B2D682', title: '#B2D682' },
  holyweek: { vine: '#3E3333', vineInBlue: '#3E3333', letter: '#D63A40', title: '#D24A42' },
  resurrection: { vine: '#8BD08F', vineInBlue: '#5D8FE6', letter: '#EDBE45', title: '#FFFFFF' },
  apostles: { vine: '#3E8A52', vineInBlue: '#3F92C6', letter: '#EE9F55', title: '#EE9F55' },
  marian: { vine: '#3558C8', vineInBlue: '#5D8FE6', letter: '#F6D46A', title: '#8FB0F2' },
};

/** A page's season colours: its decorated initials' (the vine, in a blue verse too, and the letter), and its section titles'. */
export interface InitialColors {
  vine: string;
  /** The Coptic initial's vine when it opens a blue alternate verse. */
  vineInBlue: string;
  letter: string;
  title: string;
}

/**
 * The colours a decorated initial and a section title are drawn in: on
 * Night the season's own; on every other page the titles' gold for the vine
 * (in a blue verse too) and the titles, and the ornaments' colour for the
 * letter.
 */
export function documentInitialColors(theme: DocumentTheme, season?: SeasonThemeKey | null): InitialColors {
  if (theme.id === 'night') return NIGHT_SEASON_COLORS[season ?? 'annual'];
  return { vine: theme.colors.accent, vineInBlue: theme.colors.accent, letter: documentOrnamentColor(theme, season), title: theme.colors.accent };
}
