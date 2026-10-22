import { withAlpha, type DocumentTheme } from '../../../constants/documentThemes';
import type { AppLanguage } from '../../../utils/preferencesStorage';
import type { DocumentSection } from '../documentHtml';
import { getSectionSelectorTitle } from '../sectionSelectorTitle';

/**
 * What the reader's two side panels share — the service's Contents and the
 * Bible's Verses (ReaderPanel.tsx): their colours on the page they open over,
 * their size on each screen, and the logic of the Contents list. Kept apart
 * from the components so it can be tested on its own.
 */

type Title = { english: string; arabic: string; french?: string };

/** A hex colour mixed into another: `amount` of `top` over `base`, as CSS color-mix(in srgb) does. */
export function mixHex(top: string, base: string, amount: number): string {
  const channel = (hex: string, shift: number) => (parseInt(hex.slice(1), 16) >> shift) & 255;
  const mixed = [16, 8, 0].map((shift) => Math.round(channel(top, shift) * amount + channel(base, shift) * (1 - amount)));
  return `#${mixed.map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * A panel's colours on its page. The panel is the page with a breath of its
 * ink in it (5%); its controls are washes of the ink. The design's three
 * accents are the page's own: its gold (`accent`) marks where the reader is
 * and numbers the verses, its sub-document colour (`subdoc`) is the panel's
 * voice — eyebrow, buttons, chips, and the rows that open a sub-document — and
 * the colour of the button that leaves for another service (`link`) fills the
 * Up next card.
 */
export function readerPanelColors(theme: DocumentTheme) {
  const { colors } = theme;
  return {
    panel: mixHex(colors.text, colors.page, 0.05),
    scrim: 'rgba(0, 0, 0, 0.32)',
    ink: colors.text,
    quiet: withAlpha(colors.text, 0.5),
    faint: withAlpha(colors.text, 0.58),
    wash: withAlpha(colors.text, 0.08),
    washSoft: withAlpha(colors.text, 0.06),
    rule: withAlpha(colors.text, 0.09),
    track: withAlpha(colors.text, 0.16),
    voice: colors.subdoc,
    voiceSoft: withAlpha(colors.subdoc, 0.12),
    here: colors.accent,
    hereSoft: withAlpha(colors.accent, 0.14),
    next: colors.link,
    onNext: colors.page,
  };
}

export type ReaderPanelColors = ReturnType<typeof readerPanelColors>;

/** How a panel sits on a screen: its width, and whether it is the compact one a phone on its side gets. */
export interface ReaderPanelLayout {
  width: number;
  /** A phone on its side: smaller type and buttons, and the panel stops short of the notch side. */
  compact: boolean;
  /** A tablet: the panel starts below the status bar rather than running up under it. */
  belowStatusBar: boolean;
}

/**
 * 420 on a desktop or a tablet (400 on an iPad held upright), 86% of a phone
 * held upright, and on a phone on its side a narrow 340 beside the room the
 * screen's edge needs — so the text on the notch side stays in view.
 */
export function readerPanelLayout({ width, height, native, mobileWebBreakpoint, rightInset = 0 }: {
  width: number;
  height: number;
  native: boolean;
  mobileWebBreakpoint: number;
  rightInset?: number;
}): ReaderPanelLayout {
  const shortest = Math.min(width, height);
  // A phone browser on its side is wider than the mobile breakpoint, but its
  // short side still gives it away.
  const phone = native ? shortest < 600 : width < mobileWebBreakpoint || shortest < 500;
  const landscape = width > height;
  if (phone && landscape) return { width: Math.min(340 + Math.max(rightInset, 24), Math.round(width * 0.6)), compact: true, belowStatusBar: false };
  if (phone) return { width: Math.round(width * 0.86), compact: false, belowStatusBar: false };
  const tablet = native;
  const wide = tablet && !landscape ? 400 : 420;
  return { width: Math.min(wide, width - 48), compact: false, belowStatusBar: tablet };
}

const PANEL_TEXT: Record<AppLanguage, {
  contents: string; verses: string; findSection: string; clearSearch: string; upNext: string; bishopPresent: string; noMatches: string;
}> = {
  en: { contents: 'Contents', verses: 'Verses', findSection: 'Find a section', clearSearch: 'Clear search', upNext: 'Up next', bishopPresent: 'Bishop present', noMatches: 'No section matches' },
  fr: { contents: 'Sommaire', verses: 'Versets', findSection: 'Trouver une section', clearSearch: 'Effacer la recherche', upNext: 'À suivre', bishopPresent: 'Évêque présent', noMatches: 'Aucune section ne correspond' },
  ar: { contents: 'المحتويات', verses: 'الآيات', findSection: 'ابحث عن قسم', clearSearch: 'مسح البحث', upNext: 'التالي', bishopPresent: 'حضور أسقف', noMatches: 'لا يوجد قسم مطابق' },
};

/** The panels' own words, in the App Language. */
export function readerPanelText(language: AppLanguage) {
  return PANEL_TEXT[language] ?? PANEL_TEXT.en;
}

/** What a reading is called in the list, by the reading_type its citation line carries. */
const READING_NAMES: Record<string, Title> = {
  Psalm: { english: 'Psalm', arabic: 'المزمور', french: 'Psaume' },
  Gospel: { english: 'Gospel', arabic: 'الإنجيل', french: 'Évangile' },
  Prophecy: { english: 'Prophecy', arabic: 'النبوة', french: 'Prophétie' },
  'Pauline Epistle': { english: 'Pauline Epistle', arabic: 'البولس', french: 'Épître de saint Paul' },
  'Catholic Epistle': { english: 'Catholic Epistle', arabic: 'الكاثوليكون', french: 'Épître catholique' },
  Praxis: { english: 'Praxis', arabic: 'الإبركسيس', french: 'Praxis' },
};

/** A range of verses with an en dash, as a citation is set in print: 39:9–10. */
function setCitation(text: string): string {
  return text.replace(/(\d)\s*-\s*(\d)/g, '$1–$2');
}

/** "Psalm 39:9-10" without its "Psalm", once the row already says it. */
function withoutLeadingName(citation: string, names: string[]): string {
  for (const name of names) {
    if (name && citation.toLowerCase().startsWith(`${name.toLowerCase()} `)) return citation.slice(name.length + 1);
  }
  return citation;
}

/**
 * A row's name and the citation set after it in small muted type, as the
 * design lists the day's readings: "Psalm 39:9–10", "Gospel Mark 2:13–17".
 * getSectionSelectorTitle gives a reading as its citation alone, or as its
 * name with the citation in brackets; this takes the two apart. Anything that
 * isn't a reading keeps its title and has no citation.
 */
export function sectionRowParts(section: DocumentSection): { title: Title; citation: Title | null } {
  const title = getSectionSelectorTitle(section);
  const reference = section.verses.find((verse) => verse.type === 'readingReference');
  if (!reference) return { title, citation: null };
  const citationOf = (text: string | undefined) => String(text || '').trim();
  const bracketed = (text: string) => /^(.*?)\s*\(([^()]+)\)$/.exec(text);
  const english = bracketed(title.english);
  if (english) {
    const arabic = bracketed(title.arabic);
    const french = bracketed(title.french || '');
    return {
      title: { english: english[1], arabic: arabic ? arabic[1] : title.arabic, french: french ? french[1] : title.french },
      citation: { english: setCitation(english[2]), arabic: arabic ? arabic[2] : '', french: french ? setCitation(french[2]) : setCitation(english[2]) },
    };
  }
  const name = READING_NAMES[reference.reading?.readingType ?? ''];
  // A reading that is its citation alone ("Mark 2:13-17"): named by its kind, the citation beside it.
  if (name && title.english === citationOf(reference.english)) {
    const drop = [name.english, name.french || '', 'Ps'];
    return {
      title: name,
      citation: {
        english: setCitation(withoutLeadingName(citationOf(reference.english), drop)),
        arabic: withoutLeadingName(title.arabic, [name.arabic, 'مزمور']),
        french: setCitation(withoutLeadingName(citationOf(reference.french || reference.english), drop)),
      },
    };
  }
  return { title, citation: null };
}

/** A title or citation in one language, by the App Language, falling back to whichever it has. */
export function pickRowText(text: Title | null, language: AppLanguage): { text: string; arabic: boolean } {
  if (!text) return { text: '', arabic: false };
  if (language === 'ar' && text.arabic) return { text: text.arabic, arabic: true };
  if (language === 'fr' && text.french) return { text: text.french, arabic: false };
  if (text.english) return { text: text.english, arabic: false };
  if (text.arabic) return { text: text.arabic, arabic: true };
  return { text: text.french || '', arabic: false };
}

/** Lower case without accents, and Arabic without its vowel marks and with one alef: what a search compares. */
export function foldForSearch(text: string): string {
  return String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Whether a row answers a search: its name or its citation, in any of its languages. */
export function rowMatchesSearch(parts: { title: Title; citation: Title | null }, query: string): boolean {
  const needle = foldForSearch(query);
  if (!needle) return true;
  const haystack = [parts.title.english, parts.title.arabic, parts.title.french, parts.citation?.english, parts.citation?.arabic, parts.citation?.french]
    .map((text) => foldForSearch(text || ''));
  return haystack.some((text) => text.includes(needle));
}

/** Where a row stands against where the reader is: read already (dimmed), here (gold), or still to come. */
export type RowPlace = 'past' | 'current' | 'ahead';

export function rowPlaces(ids: string[], currentId: string | null): Record<string, RowPlace> {
  const places: Record<string, RowPlace> = {};
  const currentIndex = currentId ? ids.indexOf(currentId) : -1;
  ids.forEach((id, index) => {
    places[id] = currentIndex < 0 || index > currentIndex ? 'ahead' : index === currentIndex ? 'current' : 'past';
  });
  return places;
}

/**
 * The buttons that leave this service for the next one, when they close the
 * list: every hyperlink after the last row that is anything else. They become
 * its Up next cards. A hyperlink in the middle of a service stays a row.
 */
export function trailingHyperlinkIds(sections: Pick<DocumentSection, 'id' | 'isHyperlinkButton'>[]): Set<string> {
  const trailing = new Set<string>();
  for (let index = sections.length - 1; index >= 0 && sections[index].isHyperlinkButton; index -= 1) trailing.add(sections[index].id);
  return trailing;
}
