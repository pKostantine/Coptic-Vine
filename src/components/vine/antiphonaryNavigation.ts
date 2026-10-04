import type { DocumentSection } from './documentHtml';

export type AntiphonaryTune = 'adam' | 'vatos';
export type AntiphonaryGroup = 'introduction' | AntiphonaryTune;

/** The Antiphonary's fixed pill row, whether it is read as a service's subdocument or as a book of its own. */
export const ANTIPHONARY_GROUPS: { key: AntiphonaryGroup; label: string }[] = [
  { key: 'introduction', label: 'Introduction' },
  { key: 'adam', label: 'Adam' },
  { key: 'vatos', label: 'Vatos' },
];

export function findAntiphonaryIntroduction(sections: DocumentSection[]): DocumentSection | undefined {
  return sections.find((section) => /^introduction$/i.test(section.title?.english || ''));
}

/** The tune of the verse a scroll-mode position report names (`${sectionId}::v${index}`, see renderVerse in documentHtml.ts). */
export function getVerseTune(sections: DocumentSection[], verseId: string | null | undefined): AntiphonaryTune | null {
  if (!verseId) return null;
  const separator = verseId.lastIndexOf('::v');
  if (separator < 0) return null;
  const section = sections.find((candidate) => candidate.id === verseId.slice(0, separator));
  const tune = section?.verses[Number(verseId.slice(separator + 3))]?.tune;
  return tune === 'adam' || tune === 'vatos' ? tune : null;
}

/**
 * The pill the reader is in. The day's entry opens in Adam: its title, and
 * an entry with no "through the prayers of..." line to switch on, count as
 * Adam (see addTuneMarkersToAntiphonarySections in hymnLibrary.js).
 */
export function getActiveAntiphonaryGroup(
  sections: DocumentSection[],
  currentSectionId: string | null,
  currentTune: AntiphonaryTune | null,
): AntiphonaryGroup | null {
  if (!currentSectionId) return null;
  if (findAntiphonaryIntroduction(sections)?.id === currentSectionId) return 'introduction';
  return currentTune ?? 'adam';
}
