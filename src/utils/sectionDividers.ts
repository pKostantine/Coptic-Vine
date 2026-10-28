/**
 * The headings of a service's Contents (ContentSelectorDrawer.tsx): a rule
 * across the list that gathers the hymns after it, folding them away when
 * tapped. The document and slideshow mode never see them.
 */

/**
 * An hour opening that marks where one part of a service gives way to the
 * next: the Midnight Hour's three Watches, and the Agpeya hours prayed inside
 * the Offering of the Lamb ("3rd Hour", "3rd Hour and 6th Hour", "12th Hour
 * and Veil"...). Its group runs to the next `introduction…` row.
 *
 * Whether one of these reads as a divider is decided by whether it has a title
 * at all, and that is per-schema: agpeya.hymn_titles leaves the hour openings
 * null, so inside the Agpeya book they stay silent, while liturgy.hymn_titles
 * names them, so inside the Liturgy they announce the hour. An untitled
 * section never reaches the list — `listable` has already dropped it — so the
 * same hymn divides the Offering of the Lamb without touching the Hour it also
 * belongs to.
 *
 * The `(?!Of|To)` is what separates a divider from ordinary content that
 * happens to be named the same way: introductionOfEveryHour is a real prayer
 * (and titled, in agpeya), and introductionToTheCreed, introductionToTheHoosP1
 * and introductionToRaisingOfIncenseP1 are all lead-ins to a hymn rather than
 * headings over a section.
 */
const SECTION_DIVIDER_KEY = /^introduction(?!Of|To)[A-Za-z]*(?:Hour|Watch|Veil)$/;

/**
 * Headings over a run of hymns that ends on a named one rather than on the
 * next `introduction…` row: St Basil's Seven Short Litanies holds the litanies
 * from the Litany of Peace through the Litany of the Oblations, the seventh.
 * The last hymn is matched by the start of its key, and is gathered with
 * everything that is part of it (its continuations and what it splices in).
 */
const SPAN_DIVIDER_ENDS: Readonly<Record<string, RegExp>> = Object.freeze({
  sevenShortLitanies: /^litanyOfTheOblations/,
});

type DividerSection = { id: string; hymnKey?: string | null };

export function isDividerSection(section: DividerSection): boolean {
  const key = section.hymnKey || '';
  return SECTION_DIVIDER_KEY.test(key) || Object.prototype.hasOwnProperty.call(SPAN_DIVIDER_ENDS, key);
}

/**
 * Everything a divider gathers under it: section id → its divider's id.
 *
 * A nest opens on a divider that actually speaks (`speaks`: it has a title in
 * this document's schema), since the same hour opening is titled in
 * liturgy.hymn_titles and null in agpeya.hymn_titles. That matters: an
 * untitled opening never renders a rule, so it must not silently indent the
 * rest of the Hour behind an invisible heading.
 *
 * An hour opening's nest closes on the next `introduction…` row of any kind,
 * whether or not that row is itself visible. In the Offering of the Lamb that
 * is introductionToTheCreed, which carries no title and so never appears in
 * the list — but it is still the point where the Agpeya hours end and the
 * Liturgy resumes, so the Creed and everything after it sit back at the outer
 * level. The Midnight Hour ends its third Watch on the same row.
 *
 * A span divider's nest closes after its last hymn instead. One whose last
 * hymn isn't in the document gathers nothing, rather than the rest of the
 * service.
 *
 * Walked over every section rather than the listable ones, so those invisible
 * boundaries still count.
 */
export function gatherUnderDividers<T extends DividerSection>(sections: readonly T[], speaks: (section: T) => boolean): Map<string, string> {
  const owners = new Map<string, string>();
  let openDividerId: string | null = null;
  // An open span divider's last hymn, and the id of its section once reached.
  let spanEnd: RegExp | null = null;
  let lastSectionId: string | null = null;
  sections.forEach((section, index) => {
    const key = section.hymnKey || '';
    const endsSpan = Object.prototype.hasOwnProperty.call(SPAN_DIVIDER_ENDS, key) ? SPAN_DIVIDER_ENDS[key] : null;
    if (/^introduction/i.test(key) || endsSpan) {
      const reachesEnd = !endsSpan || sections.slice(index + 1).some((later) => endsSpan.test(later.hymnKey || ''));
      openDividerId = isDividerSection(section) && speaks(section) && reachesEnd ? section.id : null;
      spanEnd = openDividerId ? endsSpan : null;
      lastSectionId = null;
      return;
    }
    if (!openDividerId) return;
    if (lastSectionId && !section.id.startsWith(`${lastSectionId}-`)) {
      openDividerId = null;
      spanEnd = null;
      lastSectionId = null;
      return;
    }
    owners.set(section.id, openDividerId);
    if (spanEnd && !lastSectionId && spanEnd.test(key)) lastSectionId = section.id;
  });
  return owners;
}
