import type { DocumentTheme } from './documentThemes';
import { DIVIDER_ART, INTERLACE_ART, LINTEL_ART, MEDALLION_ART, ROUNDELS_ART, STEPPED_ART, type OrnamentArt } from './ornamentArt';
import type { SeasonThemeKey } from './seasonAppearance';

/**
 * The ornaments a document is dressed with (Coptic Vine Ornaments 1): a
 * headpiece a title is set inside -- the Lintel over each Hoos, the Stepped
 * frame over a service's own name at its start, the
 * Interlace over the Theotokia of the day, the Three Roundels over the Psalm
 * and Gospel -- the Divider set after a piece, and the Medallion that closes
 * a service.
 */
export type DocumentOrnament = 'lintel' | 'stepped' | 'interlace' | 'roundels' | 'divider' | 'medallion';
export type HeadpieceOrnament = Exclude<DocumentOrnament, 'divider' | 'medallion'>;

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
export const DIVIDER = DIVIDER_ART;

export function isHeadpiece(ornament: DocumentOrnament | undefined): ornament is HeadpieceOrnament {
  return ornament === 'lintel' || ornament === 'stepped' || ornament === 'interlace' || ornament === 'roundels';
}

/**
 * Each season's ornament colour on the Night page: the headpiece colour of
 * the Coptic Vine Design's season colours (Seasons, "Season colours - Night",
 * final), which the service's headpiece and the title inside it take, every
 * other headpiece and the closing medallion, and every section title
 * (documentInitialColors).
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
 * The pages whose ornaments, titles and drop caps follow the season of the
 * day being prayed, all in Night's colours (asked on 5 Nov 2026: Paper takes
 * Night's season colours too); Walnut, Vine and Sepia keep to their own page.
 */
function followsSeason(theme: DocumentTheme) {
  return theme.id === 'night' || theme.id === 'paper';
}

/**
 * The colour a page's ornaments are drawn in: the season's headpiece colour
 * on Night and Paper; on Walnut, Vine and Sepia the page's own white or
 * black -- its text colour -- whatever the season.
 */
export function documentOrnamentColor(theme: DocumentTheme, season?: SeasonThemeKey | null): string {
  return followsSeason(theme) ? ON_BLACK[season ?? 'annual'] : theme.colors.text;
}

/**
 * The decorated initials' colours on the Night page, by season (Coptic Vine
 * Design, Seasons, "Season colours - Night", final): the vine and its
 * grapes, and in a blue alternate verse the Coptic initial's vine instead
 * (the English initials don't change); and their letter, which the opening
 * words of every column take too. Rubrics stay red in every season.
 */
const NIGHT_INITIALS: Record<SeasonThemeKey, Omit<InitialColors, 'title'>> = {
  annual: { vine: '#E3B53B', vineInBlue: '#4FA3C0', letter: '#5FAE68' },
  gold: { vine: '#5FAE68', vineInBlue: '#5D8FE6', letter: '#EDBE45' },
  natfast: { vine: '#C2416F', vineInBlue: '#C2416F', letter: '#45A85B' },
  nativity: { vine: '#EB4A3E', vineInBlue: '#5D8FE6', letter: '#45A85B' },
  theophany: { vine: '#2E7A72', vineInBlue: '#3E9BD6', letter: '#7FCDBD' },
  lent: { vine: '#6B3E91', vineInBlue: '#6B3E91', letter: '#C9A45C' },
  palm: { vine: '#E3B53B', vineInBlue: '#66B3EE', letter: '#B2D682' },
  holyweek: { vine: '#3E3333', vineInBlue: '#3E3333', letter: '#D63A40' },
  resurrection: { vine: '#8BD08F', vineInBlue: '#5D8FE6', letter: '#EDBE45' },
  apostles: { vine: '#3E8A52', vineInBlue: '#3F92C6', letter: '#EE9F55' },
  marian: { vine: '#3558C8', vineInBlue: '#5D8FE6', letter: '#F6D46A' },
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
 * The colours a decorated initial and a section title are drawn in. On Night
 * and Paper, the season's own: the initials' vine (and vine in a blue verse)
 * and letter, and every section title in the colour of the season's
 * headpiece ornaments (the Holy Fifty Days' gold, Nativity's holly green).
 * On the other pages, the titles' gold for the vine and the titles, and the
 * ornaments' colour for the letter.
 */
export function documentInitialColors(theme: DocumentTheme, season?: SeasonThemeKey | null): InitialColors {
  if (followsSeason(theme)) return { ...NIGHT_INITIALS[season ?? 'annual'], title: documentOrnamentColor(theme, season) };
  return { vine: theme.colors.accent, vineInBlue: theme.colors.accent, letter: documentOrnamentColor(theme, season), title: theme.colors.accent };
}
