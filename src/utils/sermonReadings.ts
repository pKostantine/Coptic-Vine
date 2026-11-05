import type { DocumentSection } from '../components/vine/documentHtml';
import { READING_LABELS, type ReadingName } from './lectionaryOutline';
import type { LectionaryReadingKind, LectionaryService } from './readingsService';

export type SermonReadingKind = LectionaryReadingKind | 'Synaxarium';

/** One of the day's readings as the planner lists it: a chip, and the sections it is read in. */
export interface SermonReading {
  key: string;
  service: LectionaryService;
  kind: SermonReadingKind;
  label: ReadingName;
  /** "Luke 1:26–38", as its citation line reads. */
  citation: { english: string; arabic: string };
  sections: DocumentSection[];
}

export type SermonReadingsByService = Record<LectionaryService, SermonReading[]>;

const SYNAXARIUM_LABEL: ReadingName = { english: 'Synaxarium', arabic: 'السنكسار', french: 'Synaxaire' };

const KIND_BY_READING_TYPE: Record<string, LectionaryReadingKind> = {
  Psalm: 'Psalm',
  Gospel: 'Gospel',
  Prophecy: 'Prophecy',
  'Pauline Epistle': 'Pauline',
  'Catholic Epistle': 'Catholic',
  Praxis: 'Praxis',
};

function serviceOf(service: string | null | undefined, kind: LectionaryReadingKind): LectionaryService {
  if (service === 'Vespers') return 'Vespers';
  if (service === 'Matins' || kind === 'Prophecy') return 'Matins';
  return 'Liturgy';
}

/**
 * The planner's document (liturgy.sermon_planner: the Vespers, Matins and
 * Liturgy readings and the Synaxarium) as its readings. A reading begins at
 * its citation line -- tagged with which reading it is (documentReadings.ts)
 * -- and runs until the next; the Synaxarium's sections, which have none, are
 * one reading of the Liturgy's. A Lenten morning's prophecies are numbered.
 */
export function groupSermonReadings(sections: readonly DocumentSection[]): SermonReadingsByService {
  const groups: SermonReadingsByService = { Vespers: [], Matins: [], Liturgy: [] };
  let current: SermonReading | null = null;
  for (const section of sections) {
    const cited = section.verses.find((verse) => verse.type === 'readingReference' && verse.reading?.readingType);
    const kind = cited?.reading?.readingType ? KIND_BY_READING_TYPE[cited.reading.readingType] : undefined;
    if (cited && kind) {
      const service = serviceOf(cited.reading?.service, kind);
      const number = groups[service].filter((reading) => reading.kind === kind).length + 1;
      current = {
        key: `${service}:${kind}:${number}`,
        service,
        kind,
        label: READING_LABELS[kind],
        citation: { english: String(cited.english || '').trim(), arabic: String(cited.arabic || '').trim() },
        sections: [section],
      };
      groups[service].push(current);
      continue;
    }
    if (section.sourceGroupKey === 'SYNAXARIUM') {
      if (current?.kind !== 'Synaxarium') {
        current = {
          key: 'Liturgy:Synaxarium:1',
          service: 'Liturgy',
          kind: 'Synaxarium',
          label: SYNAXARIUM_LABEL,
          citation: { english: '', arabic: '' },
          sections: [],
        };
        groups.Liturgy.push(current);
      }
      current.sections.push(section);
      continue;
    }
    // A reading's own continuation (its sections split around a splice).
    if (current) current.sections.push(section);
  }
  // Several prophecies are told apart: Prophecy 1, Prophecy 2.
  const prophecies = groups.Matins.filter((reading) => reading.kind === 'Prophecy');
  if (prophecies.length > 1) {
    prophecies.forEach((reading, index) => {
      reading.label = {
        english: `${READING_LABELS.Prophecy.english} ${index + 1}`,
        arabic: `${READING_LABELS.Prophecy.arabic} ${index + 1}`,
        french: `${READING_LABELS.Prophecy.french} ${index + 1}`,
      };
    });
  }
  return groups;
}
