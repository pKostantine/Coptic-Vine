import type { DocumentSection, DocumentVerse } from '../components/vine/documentHtml';
import type { LectionaryReadingKind } from './readingsService';

/**
 * Where one of the day's readings is in a hydrated document. Every reading,
 * wherever its service places it, is read after its citation line — a
 * readingReference verse tagged with which reading it is (readingReferenceVerse
 * in hymnLibrary.js) — so a list of the day's readings (the Lectionary menu,
 * Home) can open the document at that line's section.
 */

/** The reading_rules reading_type each kind of reading is filed under — what its citation line is tagged with. */
export const READING_TYPE_BY_KIND: Record<LectionaryReadingKind, string> = {
  Psalm: 'Psalm',
  Gospel: 'Gospel',
  Prophecy: 'Prophecy',
  Pauline: 'Pauline Epistle',
  Catholic: 'Catholic Epistle',
  Praxis: 'Praxis',
};

const KINDS = Object.keys(READING_TYPE_BY_KIND) as LectionaryReadingKind[];

/** One of a document's readings: its kind, and which one when several of that kind are read ("Prophecy 2"). */
export interface ReadingTarget {
  kind: LectionaryReadingKind;
  number: number;
}

/** `Psalm`, `Prophecy-2`: a reading as the `reading` URL parameter spells it. */
export function readingParam({ kind, number }: ReadingTarget): string {
  return number > 1 ? `${kind}-${number}` : kind;
}

/** The reading a `reading` URL parameter names, or null for anything else (a missing parameter, a repeated one, a kind the lectionary doesn't list). */
export function parseReadingParam(value: unknown): ReadingTarget | null {
  if (typeof value !== 'string') return null;
  const match = /^([A-Za-z]+)(?:-(\d+))?$/.exec(value.trim());
  if (!match) return null;
  const kind = KINDS.find((candidate) => candidate.toLowerCase() === match[1].toLowerCase());
  if (!kind) return null;
  const number = match[2] ? Number(match[2]) : 1;
  return number >= 1 ? { kind, number } : null;
}

/** The reader's settings that decide which of a document's sections and lines are shown. */
export interface ReadingVisibility {
  displaySilentPrayers: boolean;
  bishopPresent: boolean;
  copticGospelRite: boolean;
}

type Gated = Pick<DocumentVerse, 'bishopOnly' | 'priestOnly' | 'copticGospelRiteOnly' | 'nonCopticGospelRiteOnly'>;

/** Whether a section or a line is shown under Bishop Present and the Coptic Gospel Rite toggle (as visibleDocumentSectionIds decides it). */
function shown(item: Gated, visibility: ReadingVisibility): boolean {
  return (!item.bishopOnly || visibility.bishopPresent)
    && (!item.priestOnly || !visibility.bishopPresent)
    && (!item.copticGospelRiteOnly || visibility.copticGospelRite)
    && (!item.nonCopticGospelRiteOnly || !visibility.copticGospelRite);
}

function sectionShown(section: DocumentSection, visibility: ReadingVisibility): boolean {
  return shown(section, visibility) && (visibility.displaySilentPrayers || section.titlePrayerType !== 'Silent Prayer');
}

function citesReading(section: DocumentSection, readingType: string, visibility: ReadingVisibility): boolean {
  return section.verses.some((verse) =>
    verse.type === 'readingReference' && verse.reading?.readingType === readingType && shown(verse, visibility));
}

/**
 * The section a document opens at for one of its readings: the number-th
 * shown section, in document order, whose own lines include that kind of
 * reading's citation. A reading kept behind a button (the Coptic epistles'
 * subdocuments) counts only when the document reads none of that kind in the
 * open — a button holds every Coptic prophecy, so it must not be counted as
 * "Prophecy 1" ahead of the prophecies read in English, and opens for any of
 * them. Null when the document has no such reading, or it isn't shown under
 * the reader's settings: the document then opens where it would have.
 */
export function findReadingSectionId(
  sections: readonly DocumentSection[],
  target: ReadingTarget,
  visibility: ReadingVisibility,
): string | null {
  const readingType = READING_TYPE_BY_KIND[target.kind];
  const visible = sections.filter((section) => sectionShown(section, visibility));
  const inTheOpen = visible.filter((section) => citesReading(section, readingType, visibility));
  if (inTheOpen.length) return inTheOpen[target.number - 1]?.id ?? null;
  const button = visible.find((section) =>
    (section.subdocumentSections ?? []).some((inner) => sectionShown(inner, visibility) && citesReading(inner, readingType, visibility)));
  return button?.id ?? null;
}
