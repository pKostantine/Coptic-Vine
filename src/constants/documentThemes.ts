import { COLORS } from './theme';

/**
 * The pages a service, a subdocument or a Bible chapter can be read on — the
 * way a book app offers a dark page, a paper page, a sepia one. Night is the
 * page the app has always had, and Paper its plain white counterpart. Ink,
 * Vine and Sepia are each set as a palette of their own rather than Night's
 * colours carried over: what every page keeps is the roles — the two voices
 * of an alternating hymn told apart by hue, the refrain distinct from both,
 * the priest, deacon and people each in their own colour, the comments and
 * silent prayers quieter than the text. tests/documentThemes.test.cjs holds
 * every page to those roles and to WCAG contrast against its page.
 */

export type DocumentThemeId = 'night' | 'ink' | 'vine' | 'sepia' | 'paper';

/** Darkest to lightest, as the picker shows them. */
export const DOCUMENT_THEME_IDS: DocumentThemeId[] = ['night', 'ink', 'vine', 'sepia', 'paper'];

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
  /** The "white" verse — the page's main text, in whatever ink the page is set in. */
  text: string;
  /** The "blue" verse of an alternating hymn, and a line authored Blue: the page's second voice, blue or not. */
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

/**
 * A subdocument or hyperlink button's colour with its wash and its edge: a
 * 13% wash and a 45% edge on a dark page, as Night's buttons have; 10% and
 * 40% on a light one, where the same alpha would read heavier.
 */
const darkButton = (hex: string) => ({ color: hex, soft: rgba(hex, 0.13), line: rgba(hex, 0.45) });
const lightButton = (hex: string) => ({ color: hex, soft: rgba(hex, 0.1), line: rgba(hex, 0.4) });

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
    priest: COLORS.priest,
    deacon: COLORS.deacon,
    people: COLORS.people,
    peopleText: COLORS.peopleLight,
    comment: COLORS.comment,
    silent: COLORS.silent,
    refrain: COLORS.refrain,
    metropolitan: COLORS.metropolitanBrackets,
    subdoc: COLORS.subdoc,
    subdocSoft: COLORS.subdocSoft,
    subdocLine: COLORS.subdocLine,
    link: COLORS.link,
    linkSoft: COLORS.linkSoft,
    linkLine: COLORS.linkLine,
  },
};

const INK_SUBDOC = darkButton('#9DC9FF');
const INK_LINK = darkButton('#6ED3A0');

const INK_DOCUMENT_THEME: DocumentTheme = {
  id: 'ink',
  name: { english: 'Ink', french: 'Encre', arabic: 'حبر' },
  dark: true,
  colors: {
    // A deep navy, like blue-black ink: softer than black at night and cooler
    // than a brown, with a moonlit ivory for the text and a clear sky blue for
    // the second voice — the one hue the navy holds without either glaring.
    // The gold of the titles sits on it the way gilt sits on a navy binding.
    page: '#0F1A2C',
    surface: '#18263B',
    border: '#26364F',
    strip: '#132034',
    stripActive: '#1E2E46',
    text: '#EEE8DA',
    alternate: '#9DC9FF',
    accent: COLORS.gold,
    onAccent: '#0F1A2C',
    accentSoft: COLORS.goldSoft,
    accentLine: COLORS.goldLine,
    // The rubrics softened from Night's: a coral red, a butter yellow and an
    // apricot read as red, yellow and orange on the blue without buzzing.
    priest: '#FF7A70',
    deacon: '#F6DE6B',
    people: '#F5A25A',
    peopleText: '#F4BC86',
    // A slate for comments, a pale grey for silent prayers: both of the
    // page's own blue-grey, so they step back from the text.
    comment: '#7F8EA8',
    silent: '#A3A9B5',
    refrain: '#8EDAAB',
    metropolitan: '#8FE6EC',
    subdoc: INK_SUBDOC.color,
    subdocSoft: INK_SUBDOC.soft,
    subdocLine: INK_SUBDOC.line,
    link: INK_LINK.color,
    linkSoft: INK_LINK.soft,
    linkLine: INK_LINK.line,
  },
};

const VINE_SUBDOC = darkButton('#CDBDF7');
const VINE_LINK = darkButton('#7FD6A3');

const VINE_DOCUMENT_THEME: DocumentTheme = {
  id: 'vine',
  name: { english: 'Vine', french: 'Vigne', arabic: 'الكرمة' },
  dark: true,
  colors: {
    // A deep vine-leaf green, darker and richer than the app's chrome, so a
    // long service is easy on the eye. The vine's own colours set it: a warm
    // ivory for the text, a grape lavender for the second voice (blue would
    // only echo the green; lavender stands clear of it and of the ivory), and
    // the app's gold for the titles.
    page: '#02180E',
    surface: '#0B2516',
    border: '#163522',
    strip: '#071F12',
    stripActive: '#102D1C',
    text: '#F2EDDD',
    alternate: '#CDBDF7',
    accent: COLORS.gold,
    onAccent: '#02180E',
    accentSoft: COLORS.goldSoft,
    accentLine: COLORS.goldLine,
    priest: '#F2766B',
    deacon: '#F2E266',
    people: '#F0A050',
    peopleText: '#F4BC86',
    // A sage for comments and a green-grey for silent prayers: quiet because
    // they lean into the page.
    comment: '#7D9585',
    silent: '#A8B0AA',
    refrain: '#8EDAAB',
    metropolitan: '#8EE6E6',
    // The nested-document button wears the second voice's lavender, as
    // Night's wears its blue.
    subdoc: VINE_SUBDOC.color,
    subdocSoft: VINE_SUBDOC.soft,
    subdocLine: VINE_SUBDOC.line,
    link: VINE_LINK.color,
    linkSoft: VINE_LINK.soft,
    linkLine: VINE_LINK.line,
  },
};

const SEPIA_ACCENT = '#80500A';
const SEPIA_SUBDOC = lightButton('#2A4F8A');
const SEPIA_LINK = lightButton('#22604A');

const SEPIA_DOCUMENT_THEME: DocumentTheme = {
  id: 'sepia',
  name: { english: 'Sepia', french: 'Sépia', arabic: 'سيبيا' },
  dark: false,
  colors: {
    // A warm parchment: golden rather than grey, darker than paper so it
    // doesn't glare, set like an old service book — a brown-black iron-gall
    // ink, a lapis blue for the second voice, rubrics in crimson, and titles
    // in a burnished gold.
    page: '#EFDCB4',
    surface: '#E5CFA4',
    border: '#D4BC8E',
    strip: '#E9D5AB',
    stripActive: '#DDC699',
    text: '#30251C',
    alternate: '#24497E',
    accent: SEPIA_ACCENT,
    onAccent: '#FFF8E7',
    accentSoft: rgba(SEPIA_ACCENT, 0.12),
    accentLine: rgba(SEPIA_ACCENT, 0.45),
    // A crimson, an olive gold and a rust: red, yellow and orange as far
    // apart as ink on parchment can hold them.
    priest: '#A31C2C',
    deacon: '#6C5D00',
    people: '#984B0E',
    peopleText: '#8A4520',
    // Comments in a faded brown, like a note in the margin; silent prayers in
    // a plain grey.
    comment: '#7A6650',
    silent: '#6E6C66',
    refrain: '#33633A',
    metropolitan: '#0F5F66',
    subdoc: SEPIA_SUBDOC.color,
    subdocSoft: SEPIA_SUBDOC.soft,
    subdocLine: SEPIA_SUBDOC.line,
    link: SEPIA_LINK.color,
    linkSoft: SEPIA_LINK.soft,
    linkLine: SEPIA_LINK.line,
  },
};

const PAPER_SUBDOC = lightButton('#2B5DA8');
const PAPER_LINK = lightButton('#24735A');

const PAPER_DOCUMENT_THEME: DocumentTheme = {
  id: 'paper',
  name: { english: 'Paper', french: 'Papier', arabic: 'ورق' },
  dark: false,
  colors: {
    // White paper, with Night's rubric hues deepened so each still carries on it.
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
    priest: '#B4292B',
    deacon: '#7A6A00',
    people: '#A34A14',
    peopleText: '#8A4A1E',
    comment: '#6B7A8C',
    silent: '#767676',
    refrain: '#2A6F43',
    metropolitan: '#0B6A75',
    subdoc: PAPER_SUBDOC.color,
    subdocSoft: PAPER_SUBDOC.soft,
    subdocLine: PAPER_SUBDOC.line,
    link: PAPER_LINK.color,
    linkSoft: PAPER_LINK.soft,
    linkLine: PAPER_LINK.line,
  },
};

export const DOCUMENT_THEMES: Record<DocumentThemeId, DocumentTheme> = {
  night: NIGHT_DOCUMENT_THEME,
  ink: INK_DOCUMENT_THEME,
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
