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
 * Each season's ornament colour on black: the sheet's own, brightened from
 * the calendar's season colours so they read on a black page.
 */
const ON_BLACK: Record<SeasonThemeKey, string> = {
  annual: '#5FAE68',
  gold: '#E3B53B',
  natfast: '#D9578C',
  nativity: '#E5433A',
  theophany: '#5FB6E2',
  lent: '#4F9672',
  palm: '#A4D24E',
  holyweek: '#B5272E',
  resurrection: '#F7F4EA',
  apostles: '#4F85CC',
  marian: '#4C6FEE',
};

/**
 * The same seasons deepened to read on white paper, each at least 4.5:1. The
 * Resurrection's white would vanish on a white page, so it takes the white
 * day block's gold instead.
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
  marian: '#3555C8',
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
