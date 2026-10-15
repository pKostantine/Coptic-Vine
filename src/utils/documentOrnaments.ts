import type { DocumentSection, DocumentTitle } from '../components/vine/documentHtml';

/** The service's own name in the Stepped headpiece, opening the document. */
export const DOCUMENT_TITLE_SECTION_ID = 'document-title';
/** The Medallion that closes the document. */
export const DOCUMENT_END_SECTION_ID = 'document-end';

/** The Psalmody's four Hooses: each one's title is set in a Lintel instead of the plain title. */
const HOOS_KEYS = new Set(['theFirstHoos', 'theSecondHoos', 'theThirdHoos', 'theFourthHoos']);

/**
 * The Psalm and Gospel, wherever a service reads them: the Gospel rites
 * spliced in whole, whose title ("Psalm and Gospel") heads a section of its
 * own named `<key>-<order>`. Each is set in the Three Roundels.
 */
const GOSPEL_RITE_KEYS = new Set(['GOSPEL_RITE', 'PALM_SUNDAY_LITURGY_GOSPEL_RITE', 'MOURNFUL_GOSPEL_RITE', 'MOURNFUL_4_GOSPELS_RITE']);

/** A section's hymn key: its own, or for a title spliced in ahead of its import, the key its id is named after. */
function sectionKey(section: DocumentSection): string {
  return section.hymnKey ?? section.id.replace(/-[^-]*$/, '');
}

/** The Psali's conclusion, Adam or Vatos, after which the Theotokia of the day begins. */
const PSALI_CONCLUSION_KEYS = new Set(['conclusionOfTheAdamPsali', 'conclusionOfTheVatosPsali']);

const THEOTOKIA_KEY = /^the(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)Theotokia/;

type Weekday = 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';

/** Named as the Theotokia's own parts are ("The Sunday Theotokia (1)"), without the number. */
const THEOTOKIA_TITLES: Record<Weekday, DocumentTitle> = {
  Sunday: { english: 'The Sunday Theotokia', arabic: 'ثاؤطوكية يوم الأحد', french: 'Théotokie du dimanche' },
  Monday: { english: 'The Monday Theotokia', arabic: 'ثاؤطوكية يوم الاثنين', french: 'Théotokie du lundi' },
  Tuesday: { english: 'The Tuesday Theotokia', arabic: 'ثاؤطوكية يوم الثلاثاء', french: 'Théotokie du mardi' },
  Wednesday: { english: 'The Wednesday Theotokia', arabic: 'ثاؤطوكية يوم الأربعاء', french: 'Théotokie du mercredi' },
  Thursday: { english: 'The Thursday Theotokia', arabic: 'ثاؤطوكية يوم الخميس', french: 'Théotokie du jeudi' },
  Friday: { english: 'The Friday Theotokia', arabic: 'ثاؤطوكية يوم الجمعة', french: 'Théotokie du vendredi' },
  Saturday: { english: 'The Saturday Theotokia', arabic: 'ثاؤطوكية يوم السبت', french: 'Théotokie du samedi' },
};

/** A hymn's first section carries its title; the ones it continues into (-contN) have none. */
function hasTitle(section: DocumentSection): boolean {
  return Boolean(section.title?.english || section.title?.arabic || section.title?.french);
}

/** The day of the Theotokia that follows a Psali's conclusion, read from the Theotokia itself. */
function followingTheotokiaDay(sections: DocumentSection[], from: number): Weekday | null {
  for (let index = from + 1; index < sections.length; index += 1) {
    const match = sections[index].hymnKey?.match(THEOTOKIA_KEY);
    if (match) return match[1] as Weekday;
  }
  return null;
}

/**
 * Dresses a hydrated service with its ornaments: its own name in the Stepped
 * headpiece at the start, each Hoos's title in a Lintel, the Theotokia of
 * the day announced in the Interlace just before the Psali's conclusion that
 * leads into it, the Psalm and Gospel in the Three Roundels, and the
 * Medallion closing the service -- before the buttons that leave for the
 * next one, which are no longer part of it.
 */
export function withDocumentOrnaments(sections: DocumentSection[], title: DocumentTitle): DocumentSection[] {
  const dressed: DocumentSection[] = [{
    id: DOCUMENT_TITLE_SECTION_ID,
    title,
    verses: [],
    ornament: 'stepped',
    alternateEvery: null,
    forceWhiteVerses: true,
  }];

  sections.forEach((section, index) => {
    if (section.hymnKey && PSALI_CONCLUSION_KEYS.has(section.hymnKey) && hasTitle(section)) {
      const day = followingTheotokiaDay(sections, index);
      if (day) {
        dressed.push({
          id: `theotokia-title-${section.id}`,
          title: THEOTOKIA_TITLES[day],
          verses: [],
          ornament: 'interlace',
          alternateEvery: null,
          forceWhiteVerses: true,
          // Shown and hidden with the conclusion it stands before.
          bishopOnly: section.bishopOnly,
          priestOnly: section.priestOnly,
          copticGospelRiteOnly: section.copticGospelRiteOnly,
          nonCopticGospelRiteOnly: section.nonCopticGospelRiteOnly,
        });
      }
    }
    const key = sectionKey(section);
    dressed.push(!hasTitle(section) ? section
      : HOOS_KEYS.has(key) ? { ...section, ornament: 'lintel' }
        : GOSPEL_RITE_KEYS.has(key) ? { ...section, ornament: 'roundels' }
          : section);
  });

  let end = dressed.length;
  while (end > 1 && dressed[end - 1].isHyperlinkButton) end -= 1;
  dressed.splice(end, 0, {
    id: DOCUMENT_END_SECTION_ID,
    title: { english: '', arabic: '' },
    verses: [],
    ornament: 'medallion',
    alternateEvery: null,
    forceWhiteVerses: true,
  });
  return dressed;
}
