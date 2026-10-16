/**
 * The interpretations (tafsir) read after each of the nine Saturday
 * Theotokias in the Kiahk Vespers Praises. Each author has one section after
 * every Theotokia, keyed `<prefix><n>` (greekRoumyInterpretation1 ...
 * greekRoumyInterpretation9) in psalmody.vespers_praises, all under the
 * condition `KiahkSeason && Saturdays`. Which authors are read is the
 * reader's choice, kept with their other content choices and synced to
 * their account; the document shows a button to choose them, just before
 * the Conclusion of the Vatos Psali.
 *
 * Pure and import-free, so the tests can load it as it is.
 */

export interface KiahkInterpretation {
  id: string;
  /** The hymn key before the Theotokia's number. */
  keyPrefix: string;
  name: { english: string; french: string; arabic: string };
}

export const KIAHK_INTERPRETATIONS: readonly KiahkInterpretation[] = [
  { id: 'greekRoumy', keyPrefix: 'greekRoumyInterpretation', name: { english: 'Greek (Roumy)', french: 'Grec (Roumi)', arabic: 'الرومي' } },
  { id: 'firstBohairic', keyPrefix: 'firstBohairicInterpretation', name: { english: 'First Bohairic', french: 'Premier bohaïrique', arabic: 'البحيري الأول' } },
  { id: 'secondBohairic', keyPrefix: 'secondBohairicInterpretation', name: { english: 'Second Bohairic', french: 'Second bohaïrique', arabic: 'البحيري الثاني' } },
  { id: 'mo3akab', keyPrefix: 'mo3akabInterpretation', name: { english: 'Mo3akab', french: 'Mo3akab', arabic: 'المعقب' } },
  { id: 'egyptian', keyPrefix: 'egyptianInterpretation', name: { english: 'Egyptian', french: 'Égyptien', arabic: 'المصري' } },
  { id: 'sahidic', keyPrefix: 'sahidicInterpretation', name: { english: 'Sahidic', french: 'Sahidique', arabic: 'الصعيدي' } },
  { id: 'abouElSaad', keyPrefix: 'interpretationOfAbouElSaadOfAboutig', name: { english: 'Abou El-Saad of Aboutig', french: 'Abou El-Saad d’Aboutig', arabic: 'أبو السعد الأبوتيجي' } },
  { id: 'firstGabriel', keyPrefix: 'firstInterpretationOfCantorGabrielOfQay', name: { english: 'First Cantor Gabriel of Qay', french: 'Premier du chantre Gabriel de Qay', arabic: 'الأول للمعلم غبريال القاياتي' } },
  { id: 'secondGabriel', keyPrefix: 'secondInterpretationOfCantorGabrielOfQay', name: { english: 'Second Cantor Gabriel of Qay', french: 'Deuxième du chantre Gabriel de Qay', arabic: 'الثاني للمعلم غبريال القاياتي' } },
  { id: 'thirdGabriel', keyPrefix: 'thirdInterpretationOfCantorGabrielOfQay', name: { english: 'Third Cantor Gabriel of Qay', french: 'Troisième du chantre Gabriel de Qay', arabic: 'الثالث للمعلم غبريال القاياتي' } },
  { id: 'popeMarkVIII', keyPrefix: 'interpretationOfPopeMarkVIII', name: { english: 'Pope Mark VIII', french: 'Pape Marc VIII', arabic: 'البابا مرقس الثامن' } },
  { id: 'elBardanohee', keyPrefix: 'interpretationOfElBardanohee', name: { english: 'El-Bardanohee', french: 'El-Bardanohee', arabic: 'البردنوهي' } },
];

/** A new reader's choice: the Greek, the Mo3akab and the first of Cantor Gabriel. */
export const DEFAULT_SELECTED_INTERPRETATIONS: readonly string[] = ['greekRoumy', 'mo3akab', 'firstGabriel'];

const KNOWN_IDS = new Set(KIAHK_INTERPRETATIONS.map((interpretation) => interpretation.id));

/** The section id of the button that opens the choice. */
export const INTERPRETATION_CHOOSER_SECTION_ID = 'kiahk-interpretations-chooser';
/** The hymn whose start the button stands before. */
export const INTERPRETATION_CHOOSER_ANCHOR_KEY = 'conclusionOfTheVatosPsali';
export const INTERPRETATION_CHOOSER_TITLE = {
  english: 'Select Interpretations',
  french: 'Choisir les interprétations',
  arabic: 'اختر التفاسير',
};

/** The interpretation a hymn key belongs to, or null for any other hymn. */
export function interpretationIdForHymnKey(hymnKey: string | null | undefined): string | null {
  if (!hymnKey) return null;
  for (const interpretation of KIAHK_INTERPRETATIONS) {
    if (hymnKey.length > interpretation.keyPrefix.length
      && hymnKey.startsWith(interpretation.keyPrefix)
      && /^\d+$/.test(hymnKey.slice(interpretation.keyPrefix.length))) {
      return interpretation.id;
    }
  }
  return null;
}

/**
 * A stored or synced choice, read safely: the known ids it names, in the
 * list's order, once each. Anything that is not a list gives the default; an
 * empty list is a real choice (read none) and is kept.
 */
export function normalizeSelectedInterpretations(value: unknown, fallback: readonly string[] = DEFAULT_SELECTED_INTERPRETATIONS): string[] {
  if (!Array.isArray(value)) return [...fallback];
  const chosen = new Set(value.filter((entry): entry is string => typeof entry === 'string' && KNOWN_IDS.has(entry)));
  return KIAHK_INTERPRETATIONS.map((interpretation) => interpretation.id).filter((id) => chosen.has(id));
}

/** The choice with one interpretation turned on or off. */
export function toggleSelectedInterpretation(selected: readonly string[], id: string): string[] {
  const next = selected.includes(id) ? selected.filter((entry) => entry !== id) : [...selected, id];
  return normalizeSelectedInterpretations(next);
}

interface InterpretableSection {
  id: string;
  hymnKey?: string | null;
}

/**
 * The document as the reader has chosen it: the interpretations they did not
 * choose taken out, and the button to choose them set just before the
 * Conclusion of the Vatos Psali -- or, where a document has interpretations
 * but no such conclusion, before the first of them. A document without
 * interpretations comes back as it was.
 */
export function withInterpretationChoices<T extends InterpretableSection>(
  sections: readonly T[],
  selected: readonly string[],
  makeChooser: () => T,
): T[] {
  if (!sections.some((section) => interpretationIdForHymnKey(section.hymnKey) !== null)) return [...sections];
  const chosen = new Set(selected);
  const anchorIndex = sections.findIndex((section) => section.hymnKey === INTERPRETATION_CHOOSER_ANCHOR_KEY);
  const firstInterpretation = sections.findIndex((section) => interpretationIdForHymnKey(section.hymnKey) !== null);
  const chooserBefore = anchorIndex >= 0 ? anchorIndex : firstInterpretation;
  const result: T[] = [];
  sections.forEach((section, index) => {
    if (index === chooserBefore) result.push(makeChooser());
    const interpretation = interpretationIdForHymnKey(section.hymnKey);
    if (interpretation === null || chosen.has(interpretation)) result.push(section);
  });
  return result;
}
