import { tr } from './appText';
import { readingParam, type ReadingTarget } from './documentReadings';
import { toEasternArabicDigits } from './localeFormat';
import type { LectionaryReadingKind, LectionaryService, ReadingCitation } from './readingsService';

export type ReadingName = { english: string; arabic: string; french?: string };

/** The services whose readings the Lectionary lists, in the order of the day. */
export const LECTIONARY_SERVICES: LectionaryService[] = ['Vespers', 'Matins', 'Liturgy'];

/** Each service's entry under /lectionary (SERVICES_BY_CATEGORY.lectionary in constants/manifest.ts). */
export const LECTIONARY_ROUTE_IDS: Record<LectionaryService, string> = { Vespers: 'vespers', Matins: 'matins', Liturgy: 'liturgy' };

/** The route to a service's document — opened at one of its readings when given one (see documentReadings.ts). */
export function lectionaryHref(service: LectionaryService, reading?: ReadingTarget): string {
  const path = `/lectionary/${LECTIONARY_ROUTE_IDS[service]}`;
  return reading ? `${path}?reading=${readingParam(reading)}` : path;
}

/** What each kind of reading is called where the readings are listed. */
export const READING_LABELS: Record<LectionaryReadingKind, ReadingName> = {
  Psalm: { english: 'Psalm', arabic: 'المزمور', french: 'Psaume' },
  Gospel: { english: 'Gospel', arabic: 'الإنجيل', french: 'Évangile' },
  Prophecy: { english: 'Prophecy', arabic: 'النبوة', french: 'Prophétie' },
  Pauline: { english: 'Pauline', arabic: 'البولس', french: 'Paul' },
  Catholic: { english: 'Catholic', arabic: 'الكاثوليكون', french: 'Catholique' },
  Praxis: { english: 'Acts', arabic: 'الإبركسيس', french: 'Actes' },
};

/** What each service always reads — its outline until the day's citations arrive, and wherever one can't be found. */
export const EXPECTED_READINGS: Record<LectionaryService, LectionaryReadingKind[]> = {
  Vespers: ['Psalm', 'Gospel'],
  Matins: ['Psalm', 'Gospel'],
  Liturgy: ['Pauline', 'Catholic', 'Praxis', 'Psalm', 'Gospel'],
};

/** "Prophecy 2" / "النبوة ٢" when several are read. */
export function numberedLabel(label: ReadingName, number: number | null): ReadingName {
  if (number === null) return label;
  return {
    english: `${label.english} ${number}`,
    arabic: toEasternArabicDigits(`${label.arabic} ${number}`),
    french: `${label.french ?? label.english} ${number}`,
  };
}

/** A citation as the reader sees it: Eastern digits in Arabic, the French where there is one, else the English. */
export function citationText(citation: ReadingCitation, arabic: boolean): string {
  return arabic ? toEasternArabicDigits(citation.arabic) : tr(citation.english, citation.french || citation.english, citation.arabic);
}

/** One line of a service's readings as a list shows it: the reading (a ReadingTarget), what it is called, and its citation when known. */
export interface ReadingLine extends ReadingTarget {
  key: string;
  label: ReadingName;
  value: string | null;
}

/**
 * The service's readings in reading order: each known citation, and the
 * outline's kinds where none is (yet) known. A Lenten Matins reads its
 * prophecies first, each numbered when there are several.
 */
export function readingLinesFor(service: LectionaryService, citations: readonly ReadingCitation[] | null | undefined, arabic: boolean): ReadingLine[] {
  const known = citations ?? [];
  const prophecies = known.filter((citation) => citation.kind === 'Prophecy');
  return [
    ...prophecies.map((citation, index, all) => ({
      key: `Prophecy-${index + 1}`,
      kind: 'Prophecy' as const,
      number: index + 1,
      label: numberedLabel(READING_LABELS.Prophecy, all.length > 1 ? index + 1 : null),
      value: citationText(citation, arabic),
    })),
    ...EXPECTED_READINGS[service].map((kind) => {
      const found = known.find((citation) => citation.kind === kind);
      return { key: kind, kind, number: 1, label: READING_LABELS[kind], value: found ? citationText(found, arabic) : null };
    }),
  ];
}

const PROPHECIES: ReadingName = { english: 'Prophecies', arabic: 'النبوات', french: 'Prophéties' };

/** The same lines for a glance (Home): several prophecies as one line naming them all, which opens at the first. */
export function withPropheciesAsOneLine(lines: readonly ReadingLine[]): ReadingLine[] {
  const prophecies = lines.filter((line) => line.kind === 'Prophecy');
  if (prophecies.length < 2) return [...lines];
  const first = prophecies[0];
  const joined: ReadingLine = {
    ...first,
    key: 'Prophecies',
    label: PROPHECIES,
    value: prophecies.map((line) => line.value).filter((value): value is string => Boolean(value)).join(' · ') || null,
  };
  return [joined, ...lines.filter((line) => line.kind !== 'Prophecy')];
}
