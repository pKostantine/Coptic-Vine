import { COLORS } from './theme';

/**
 * The pages a service, a subdocument or a Bible chapter can be read on — the
 * way a book app offers a dark page, a paper page, a sepia one. Night is the
 * page the app has always had; the others keep every rubric colour's meaning
 * (red for the priest, yellow for the deacon, orange for the people, the
 * white/blue alternation, the dimmed comments and silent prayers) and re-tune
 * each to its page, so a theme never changes what a colour says, only how it
 * reads there. tests/documentThemes.test.cjs holds every text colour to WCAG
 * contrast against its page.
 */

export type DocumentThemeId = 'night' | 'slate' | 'vine' | 'sepia' | 'paper';

export const DOCUMENT_THEME_IDS: DocumentThemeId[] = ['night', 'slate', 'vine', 'sepia', 'paper'];

export const DEFAULT_DOCUMENT_THEME_ID: DocumentThemeId = 'night';

export interface DocumentThemeColors {
  /** The page itself. */
  page: string;
  /** Controls raised on the page: the Coptic Gospel Rite toggle at rest, the pill bar. */
  surface: string;
  /** Hairlines: the pill bar's edge, the Bible's verse rows. */
  border: string;
  /** The strip of chrome that sits on the page above a document — the pill bar — and its lit pill. */
  strip: string;
  stripActive: string;
  /** The "white" verse — the page's main text. */
  text: string;
  /** The "blue" verse of an alternating hymn, and a line authored Blue. */
  alternate: string;
  /** The gold of the page: section titles, Bible verse numbers, the collapse buttons, the rite toggle. */
  accent: string;
  /** Text on a surface filled with the accent (the rite toggle when on). */
  onAccent: string;
  /** The accent as a wash and as a line: the Bible's verse-target flash, pressed states. */
  accentSoft: string;
  accentLine: string;
  /** "Priest:" and "Bishop:" — and the Bible's Septuagint additions. */
  priest: string;
  /** "Deacon:" and "Reader:". */
  deacon: string;
  /** "People:". */
  people: string;
  /** A People line's own words, where the Litanies give the people a line (see shouldUsePeopleLineColor). */
  peopleText: string;
  /** Comments, and the citation line before a reading. Deliberately quiet. */
  comment: string;
  /** Silent prayers and their titles. Deliberately quiet. */
  silent: string;
  /** Refrains and their labels; the Bible's psalm introductions. */
  refrain: string;
  /** The bracketed "(Metropolitan)". */
  metropolitan: string;
  /** The button that opens a nested document. */
  subdoc: string;
  subdocSoft: string;
  subdocLine: string;
  /** The button that leaves for another service. */
  link: string;
  linkSoft: string;
  linkLine: string;
}

export interface DocumentTheme {
  id: DocumentThemeId;
  name: { english: string; french: string; arabic: string };
  /** Whether the page is dark — what the reader tells the browser (color-scheme) and the status bar. */
  dark: boolean;
  colors: DocumentThemeColors;
}

/** A hex colour at an opacity, as CSS and React Native both read it. */
export function withAlpha(hex: string, alpha: number): string {
  const value = parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

const rgba = withAlpha;

/** The dark themes share the rubric reds, yellows and oranges that read well on a dark page; each lifts the dim ones to its own page. */
const darkRubric = {
  priest: COLORS.priest,
  deacon: COLORS.deacon,
  people: COLORS.people,
  peopleText: COLORS.peopleLight,
  metropolitan: COLORS.metropolitanBrackets,
};

/** The light themes' rubric: the same hues, deepened so each still carries on paper. */
const lightRubric = {
  priest: '#B4292B',
  deacon: '#7A6A00',
  people: '#A34A14',
  peopleText: '#8A4A1E',
  comment: '#6B7A8C',
  refrain: '#2A6F43',
  metropolitan: '#0B6A75',
  subdoc: '#2B5DA8',
  subdocSoft: rgba('#2B5DA8', 0.1),
  subdocLine: rgba('#2B5DA8', 0.4),
  link: '#24735A',
  linkSoft: rgba('#24735A', 0.1),
  linkLine: rgba('#24735A', 0.4),
};

export const NIGHT_DOCUMENT_THEME: DocumentTheme = {
  id: 'night',
  name: { english: 'Night', french: 'Nuit', arabic: 'ليل' },
  dark: true,
  colors: {
    // Exactly the colours the services have always been read in.
    page: COLORS.black,
    surface: COLORS.surface,
    border: COLORS.border,
    strip: '#111111',
    stripActive: '#171513',
    text: COLORS.white,
    alternate: COLORS.rowBlue,
    accent: COLORS.gold,
    onAccent: COLORS.black,
    accentSoft: COLORS.goldSoft,
    accentLine: COLORS.goldLine,
    ...darkRubric,
    comment: COLORS.comment,
    silent: COLORS.silent,
    refrain: COLORS.refrain,
    subdoc: COLORS.subdoc,
    subdocSoft: COLORS.subdocSoft,
    subdocLine: COLORS.subdocLine,
    link: COLORS.link,
    linkSoft: COLORS.linkSoft,
    linkLine: COLORS.linkLine,
  },
};

const SLATE_DOCUMENT_THEME: DocumentTheme = {
  id: 'slate',
  name: { english: 'Slate', french: 'Ardoise', arabic: 'رمادي' },
  dark: true,
  colors: {
    // A charcoal page: softer than black on an OLED screen, and the text
    // off-white so it does not glare against it.
    page: '#1A1D22',
    surface: '#272B33',
    border: '#343A44',
    strip: '#22262D',
    stripActive: '#2C313A',
    text: '#F2F2EE',
    alternate: '#9CCBFF',
    accent: COLORS.gold,
    onAccent: '#1A1D22',
    accentSoft: COLORS.goldSoft,
    accentLine: COLORS.goldLine,
    ...darkRubric,
    priest: '#EA6363',
    comment: '#7F95AE',
    silent: '#A4AAB1',
    refrain: '#9ED8AC',
    subdoc: '#9CCBFF',
    subdocSoft: rgba('#9CCBFF', 0.13),
    subdocLine: rgba('#9CCBFF', 0.45),
    link: '#66CC97',
    linkSoft: rgba('#66CC97', 0.13),
    linkLine: rgba('#66CC97', 0.45),
  },
};

const VINE_DOCUMENT_THEME: DocumentTheme = {
  id: 'vine',
  name: { english: 'Vine', french: 'Vigne', arabic: 'الكرمة' },
  dark: true,
  colors: {
    // The app's own deep green, with a warm white on it.
    page: '#0F2416',
    surface: '#1A3623',
    border: '#24452F',
    strip: '#15301E',
    stripActive: '#1E3F2A',
    text: '#F3F0E5',
    alternate: '#A3CFFF',
    accent: COLORS.gold,
    onAccent: COLORS.greenDeep,
    accentSoft: COLORS.goldSoft,
    accentLine: COLORS.goldLine,
    ...darkRubric,
    priest: '#F06A6A',
    deacon: '#FFF066',
    people: '#F0A24A',
    peopleText: '#F4C68F',
    comment: '#8AA0B8',
    silent: '#ACB4AE',
    refrain: '#B9E8C3',
    subdoc: '#A3CFFF',
    subdocSoft: rgba('#A3CFFF', 0.13),
    subdocLine: rgba('#A3CFFF', 0.45),
    link: '#74D7A3',
    linkSoft: rgba('#74D7A3', 0.13),
    linkLine: rgba('#74D7A3', 0.45),
  },
};

const SEPIA_DOCUMENT_THEME: DocumentTheme = {
  id: 'sepia',
  name: { english: 'Sepia', french: 'Sépia', arabic: 'سيبيا' },
  dark: false,
  colors: {
    // Old paper: a warm cream, with ink and an antique gold on it.
    page: '#F4ECD8',
    surface: '#EADFC6',
    border: '#DACDB1',
    strip: '#EBE2CC',
    stripActive: '#E2D6B8',
    text: '#2A2117',
    alternate: '#1F4E8C',
    accent: '#8A5A12',
    onAccent: '#FFF8E7',
    accentSoft: rgba('#8A5A12', 0.12),
    accentLine: rgba('#8A5A12', 0.45),
    ...lightRubric,
    silent: '#75736C',
  },
};

const PAPER_DOCUMENT_THEME: DocumentTheme = {
  id: 'paper',
  name: { english: 'Paper', french: 'Papier', arabic: 'ورق' },
  dark: false,
  colors: {
    page: '#FFFFFF',
    surface: '#F3F3F1',
    border: '#E3E3E3',
    strip: '#F4F4F2',
    stripActive: '#ECECE9',
    text: '#1C1C1C',
    alternate: '#1E4FA3',
    accent: '#8A5A12',
    onAccent: '#FFFFFF',
    accentSoft: rgba('#8A5A12', 0.1),
    accentLine: rgba('#8A5A12', 0.45),
    ...lightRubric,
    silent: '#767676',
  },
};

export const DOCUMENT_THEMES: Record<DocumentThemeId, DocumentTheme> = {
  night: NIGHT_DOCUMENT_THEME,
  slate: SLATE_DOCUMENT_THEME,
  vine: VINE_DOCUMENT_THEME,
  sepia: SEPIA_DOCUMENT_THEME,
  paper: PAPER_DOCUMENT_THEME,
};

export function isDocumentThemeId(value: unknown): value is DocumentThemeId {
  return typeof value === 'string' && (DOCUMENT_THEME_IDS as string[]).includes(value);
}

/** The theme for a stored choice — Night for a choice this version doesn't know. */
export function getDocumentTheme(id: unknown): DocumentTheme {
  return isDocumentThemeId(id) ? DOCUMENT_THEMES[id] : NIGHT_DOCUMENT_THEME;
}

/** The `theme` prop SlideshowContainer and VerseBlock read — the page's colours under the names the slideshow has always used (`gold`, `rowBlue`). */
export function slideshowThemeFor(theme: DocumentTheme) {
  return {
    colors: {
      ...theme.colors,
      gold: theme.colors.accent,
      rowBlue: theme.colors.alternate,
    },
  };
}

export type SlideshowTheme = ReturnType<typeof slideshowThemeFor>;
