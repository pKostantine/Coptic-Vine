import type { DocumentSection, DocumentTitle, DocumentVerse } from '../components/vine/documentHtml';
import { tr } from './appText';
import { getCopticDate, type CopticDate } from './calendarService';
import { addUtcDays } from './dateUtils';
import { resolveSynaxariumEntry } from './hymnLibrary';
import { formatCopticDayMonthIn, formatMonthDaySpanIn, type FormatLanguage } from './localeFormat';

/**
 * A saint's Synaxarium entry read as a document of its own, from Home's
 * Commemorated Saints (app/synaxarium/[entryKey].tsx): the reader every book
 * opens in, with the saint's name in the headpiece a service opens on, the
 * day under it as a reading's citation sits over the reading, and the
 * commemoration from its first paragraph, closing on the Medallion.
 */

export interface SynaxariumEntryDocument {
  title: DocumentTitle;
  sections: DocumentSection[];
}

/** Where Home's saints open: the saint's entry, for the liturgical day it is commemorated on. */
export function synaxariumEntryHref(entryKey: string, isoDate: string): string {
  return `/synaxarium/${encodeURIComponent(entryKey)}?day=${isoDate}`;
}

/** "Paope 19 · October 28–29", in each language: the saint's day, and the evening and day it spans. */
export function synaxariumDayLine(isoDate: string, coptic: CopticDate | null): Required<DocumentTitle> {
  const day = new Date(`${isoDate}T00:00:00Z`);
  const line = (language: FormatLanguage) => {
    const span = formatMonthDaySpanIn(addUtcDays(day, -1), day, language);
    return coptic ? `${formatCopticDayMonthIn(coptic.monthName, coptic.day, language)} · ${span}` : span;
  };
  return { english: line('en'), french: line('fr'), arabic: line('ar') };
}

/** The document itself, from the entry and its day line. */
export function buildSynaxariumEntryDocument(
  entryKey: string,
  entry: { title: { english: string; arabic: string }; verses: DocumentVerse[] },
  dayLine: Required<DocumentTitle>,
): SynaxariumEntryDocument {
  const english = entry.title.english || entry.title.arabic;
  const arabic = entry.title.arabic || entry.title.english;
  const dayVerse: DocumentVerse = { type: 'readingReference', english: dayLine.english, french: dayLine.french, arabic: dayLine.arabic, coptic: '' };
  // The saints' names have no French of their own: French reads the English.
  const title = { english, arabic, french: english };
  return {
    title,
    sections: [{
      id: entryKey,
      // Named in the headpiece the document opens on, not again over its
      // text -- but by its name in the Contents, not its day.
      title: { english: '', arabic: '' },
      selectorTitle: title,
      verses: [dayVerse, ...entry.verses],
      alternateEvery: null,
      forceWhiteVerses: true,
      collapsible: false,
      defaultCollapsed: false,
      titlePrayerType: null,
    }],
  };
}

/** Reads the saint's entry for its day. Rejects when it can't be read, or the day has no such saint. */
export async function loadSynaxariumEntryDocument(entryKey: string, isoDate: string): Promise<SynaxariumEntryDocument> {
  const [entry, coptic] = await Promise.all([
    resolveSynaxariumEntry(isoDate, entryKey) as Promise<{ title: { english: string; arabic: string }; verses: DocumentVerse[] } | null>,
    getCopticDate(new Date(`${isoDate}T00:00:00Z`)),
  ]);
  if (!entry) {
    throw new Error(tr(
      'This saint isn’t in the Synaxarium for that day.',
      'Ce saint ne figure pas dans le Synaxaire de ce jour.',
      'هذا القديس غير مذكور في سنكسار ذلك اليوم.',
    ));
  }
  return buildSynaxariumEntryDocument(entryKey, entry, synaxariumDayLine(isoDate, coptic));
}
