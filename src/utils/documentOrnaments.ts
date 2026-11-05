import type { DocumentSection, DocumentTitle } from '../components/vine/documentHtml';

/** The service's own name in the Stepped headpiece, opening the document. */
export const DOCUMENT_TITLE_SECTION_ID = 'document-title';
/** The Medallion that closes the document. */
export const DOCUMENT_END_SECTION_ID = 'document-end';

/** Hooses whose titles are set in a Lintel instead of the plain title. */
const HOOS_KEYS = new Set([
  'theFirstHoos',
  'theSecondHoos',
  'theThirdHoos',
  'theFourthHoos',
  'theKiahkHoos',
  'theNativityHoos',
  'theTheophanyHoos',
  'theLentenHoos',
  'thePalmSundayHoos',
  'theResurrectionHoos',
]);

/** The three anaphoras' Anaphora, Sanctus and Confession, each set in a Lintel too. */
const ANAPHORA_KEYS = new Set([
  'anaphoraStBasil',
  'sanctusStBasil',
  'confessionStBasil',
  'anaphoraStGregory',
  'sanctusStGregory',
  'confessionStGregory',
  'anaphoraStCyril',
  'sanctusStCyril',
  'confessionStCyril',
]);

/**
 * The Psalm and Gospel, wherever a service reads them: the Gospel rites
 * spliced in whole, whose title ("Psalm and Gospel") heads a section of its
 * own named `<key>-<order>`. Each is set in the Three Roundels.
 */
const GOSPEL_RITE_KEYS = new Set(['GOSPEL_RITE', 'PALM_SUNDAY_LITURGY_GOSPEL_RITE', 'MOURNFUL_GOSPEL_RITE', 'MOURNFUL_4_GOSPELS_RITE']);

/** Hymns of their own set in the Three Roundels, with a Divider after them: the Enactment of the Resurrection. */
const ROUNDELS_HYMN_KEYS = new Set(['theResurrectionEnactment']);
const DIVIDER_AFTER_KEYS = new Set(['theResurrectionEnactment']);

/** The Divider after a hymn, shown and hidden with it. */
function dividerAfter(section: DocumentSection): DocumentSection {
  return {
    id: `divider-${section.id}`,
    title: { english: '', arabic: '' },
    verses: [],
    ornament: 'divider',
    alternateEvery: null,
    forceWhiteVerses: true,
    bishopOnly: section.bishopOnly,
    priestOnly: section.priestOnly,
    copticGospelRiteOnly: section.copticGospelRiteOnly,
    nonCopticGospelRiteOnly: section.nonCopticGospelRiteOnly,
  };
}

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
 * headpiece at the start, each Hoos's title in a Lintel, and the
 * anaphoras' Anaphora, Sanctus and Confession, the Theotokia of
 * the day announced in the Interlace just before the Psali's conclusion that
 * leads into it, the Psalm and Gospel and the Enactment of the Resurrection
 * in the Three Roundels, a Divider after the Enactment's last line, and the
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

  // A hymn the Divider follows, until its last piece (its own continuations
  // and what it splices in are named after it: <id>-cont1, <id>-inline-...).
  let dividerPending: DocumentSection | null = null;
  sections.forEach((section, index) => {
    if (dividerPending && !section.id.startsWith(`${dividerPending.id}-`)) {
      dressed.push(dividerAfter(dividerPending));
      dividerPending = null;
    }
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
      : HOOS_KEYS.has(key) || ANAPHORA_KEYS.has(key) ? { ...section, ornament: 'lintel' }
        : GOSPEL_RITE_KEYS.has(key) || ROUNDELS_HYMN_KEYS.has(key) ? { ...section, ornament: 'roundels' }
          : section);
    if (hasTitle(section) && DIVIDER_AFTER_KEYS.has(key)) dividerPending = section;
  });
  if (dividerPending) dressed.push(dividerAfter(dividerPending));

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
