import { tr } from './appText';
import { toEasternArabicDigits } from './localeFormat';
import type { LectionaryReadingKind, LectionaryService, ReadingCitation } from './readingsService';

export type ReadingName = { english: string; arabic: string; french?: string };

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
