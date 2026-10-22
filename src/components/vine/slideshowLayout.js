/**
 * Pure slideshow layout and pagination helpers.
 *
 * Keeping this module free of React and platform imports makes the hardest
 * part of presentation mode deterministic and directly testable. The render
 * components consume these same metrics, so a line that pagination says fits
 * is rendered with the exact font and line-height assumptions used here.
 */

import { DOCUMENT_CONTROL_METRICS, getDocumentChromeMetrics } from "./documentPresentationMetrics.js";
import { countInitialLines } from "./textLines.js";

const SPACING_XS = 4;
const SPACING_SM = 8;
const SPACING_MD = 16;
const MIN_USEFUL_FRAGMENT_LINES = 2;

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

/** Slideshow text is justified, as the scrolling page's is. */
export const SLIDESHOW_JUSTIFIED = true;

export function getSlideshowChromeMetrics(fontSize) {
  const safeFontSize = Math.max(Number(fontSize) || 18, 1);
  const documentChrome = getDocumentChromeMetrics(safeFontSize);
  // Scroll mode renders speaker labels inside the normal language paragraph,
  // so the label inherits that language's full font size. Slideshow must use
  // the same metric instead of shrinking the speaker to a separate chrome
  // scale.
  const speakerFontSize = safeFontSize;

  return {
    ...documentChrome,
    speakerFontSize,
    speakerLineHeight: Math.max(Math.round(speakerFontSize * 1.3), 18),
  };
}

export function getSlideshowLanguageFontSize(language, item = {}, fontSize = 18) {
  if (language === "coptic") {
    return Math.round(fontSize * 1.25);
  }

  if (language === "arabic") {
    return Math.round(fontSize * 1.15);
  }

  return fontSize;
}

export function getSlideshowLanguageLineHeight(language, item = {}, fontSize = 18) {
  // These are the document reader's proven metrics. In particular, Arabic
  // needs substantially more leading for vowel marks than English/Coptic;
  // using 1.25 * the base size clipped Arabic at the largest setting.
  return language === "arabic"
    ? Math.round(fontSize * 1.6)
    : Math.round(fontSize * 1.3);
}

export function getSeasonalPrefixLineHeight(language, item = {}, fontSize = 18) {
  const prefixFontSize = getSlideshowLanguageFontSize(language, item, fontSize);
  return Math.max(Math.round(prefixFontSize * 1.25), 9);
}

export function hasSeasonalPrefixLine(verse = {}) {
  if (verse.slideshowSeasonalPrefixVisible === false) {
    return false;
  }

  const prefix = String(verse.seasonalHoosVersePrefix || "").trim();
  if (!prefix) return false;

  return ["english", "arabic"].some((language) =>
    String(verse[language] || "").trimStart().startsWith(prefix),
  );
}

export function getVerseVerticalPadding(item = {}) {
  return item.verse?.seasonalHoosVersePrefix ? 4 : SPACING_SM * 2;
}

export function getSpeakerRowHeight(item = {}, fontSize = 18, visibleLanguages = {}) {
  if (item.suppressSpeakerLabel || !item.hasSpeakerLabel) return 0;
  if (!visibleLanguages.english && !visibleLanguages.french && !visibleLanguages.arabic) return 0;
  return Math.max(
    visibleLanguages.english ? getSlideshowLanguageLineHeight('english', item, fontSize) : 0,
    visibleLanguages.french ? getSlideshowLanguageLineHeight('french', item, fontSize) : 0,
    visibleLanguages.arabic ? getSlideshowLanguageLineHeight('arabic', item, fontSize) : 0,
  );
}

function getLanguagePrefixHeight(language, item, fontSize) {
  if (!hasSeasonalPrefixLine(item?.verse)) return 0;
  return getSeasonalPrefixLineHeight(language, item, fontSize);
}

function getVerseCommonHeight(item, fontSize, visibleLanguages) {
  return getVerseVerticalPadding(item) + getSpeakerRowHeight(item, fontSize, visibleLanguages);
}

/**
 * The slide's margin above and below its text: the same as the scrolling
 * page's (documentHtml.ts's `.document` padding), so a slide uses as much
 * of the screen as the page does.
 */
export function getSlidePadding() {
  return { bottom: SPACING_MD, top: SPACING_MD };
}

/** The content budget is always bounded by the real viewport. */
export function getSlideContentBudget(viewportHeight, padding = getSlidePadding(viewportHeight)) {
  const safeHeight = Math.max(Number(viewportHeight) || 0, 0);
  return Math.max(safeHeight - (padding.top || 0) - (padding.bottom || 0) - 2, 1);
}

/** FNV-1a keeps signatures compact while still hashing the actual content. */
export function hashSlideshowText(value) {
  const text = String(value ?? "");
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export function getItemSignature(item, displayedTitle = "") {
  if (item.type === "title" || item.type === "button") {
    return [
      item.id,
      item.type,
      hashSlideshowText(displayedTitle),
      item.isCollapsed ? "collapsed" : "open",
      item.collapsible ? "collapsible" : "fixed",
      item.ornament || "plain",
    ].join(":");
  }

  if (item.type === "ornament") {
    return `${item.id}:ornament:${item.ornament}`;
  }

  if (item.type === "gospelRiteToggle") {
    return `${item.id}:gospelRiteToggle`;
  }

  const verse = item.verse || {};
  return [
    item.id,
    "verse",
    hashSlideshowText([
      verse.english,
      verse.french,
      verse.coptic,
      verse.arabic,
      verse.type,
      verse.personRole,
      verse.prayerType,
      verse.bibleVerseNumber,
      verse.seasonalHoosVersePrefix,
      verse.preserveCopticDigits,
      verse.centeredAcrossPage,
      verse.invincibleCoptic,
      verse.forceCopticVisible,
      verse.italic,
      item.suppressSpeakerLabel,
      item.hasSpeakerLabel,
      item.copticInitial?.letter,
    ].join("\u241f")),
  ].join(":");
}

function hasVisibleTitleText(title) {
  return Boolean(title?.english || title?.french || title?.arabic);
}

/** A title set in a headpiece (constants/documentOrnaments.ts). */
function isHeadpieceItem(item) {
  return item?.type === "title" && Boolean(HEADPIECE_ASPECT[item.ornament]);
}

/** A band or divider: an ornament that sits between whatever is either side of it. */
function isFlowOrnament(item) {
  return item?.type === "ornament" && (item.ornament === "band" || item.ornament === "divider");
}

function ownBreakBefore(item, previous) {
  return (item.type === "title" && !item.isCollapsed && hasVisibleTitleText(item.title)) ||
    // A button opens a slide of its own, but a run of them (the Liturgy of
    // the Word's three at its end) shares one as far as they fit.
    (item.type === "button" && previous?.type !== "button") ||
    // The Antiphonary's Vatos half opens its own slide, so the Vatos pill
    // lands on its first verse rather than partway down Adam's last slide.
    (item.verse?.tune === "vatos" && previous?.verse?.tune === "adam");
}

/**
 * Where a slide must begin. The ornaments set their own rules: a headpiece
 * always opens a slide, with nothing before it, and whatever follows it
 * shares that slide as far as it fits; the Medallion stays with the last
 * words before it, and nothing follows it on its slide; a band or divider
 * sits with what comes either side of it.
 */
function buildPaginationUnits(items) {
  return items.map((item, index) => {
    const previous = items[index - 1];
    let breakBefore;
    if (isHeadpieceItem(item)) breakBefore = true;
    else if (item.type === "ornament" && item.ornament === "medallion") breakBefore = false;
    else if (previous?.type === "ornament" && previous.ornament === "medallion") breakBefore = true;
    else if (isFlowOrnament(item) || isHeadpieceItem(previous) || isFlowOrnament(previous)) breakBefore = false;
    else breakBefore = ownBreakBefore(item, previous);
    return { items: [item], breakBefore };
  });
}

/**
 * Hymns whose title keeps its first TWO verses on its slide rather than one:
 * their first verse is a short opening line, so the title's slide also gives
 * as much of the second verse as fits beneath it. Every other title keeps
 * its first verse only. Keyed by the order table's hymn_key.
 */
export const TITLE_PAIRED_VERSE_COUNTS = Object.freeze({
  theKiahkHoos: 2,
  theNativityHoos: 2,
  theTheophanyHoos: 2,
  theLentenHoos: 2,
  thePalmSundayHoos: 2,
  theResurrectionHoos: 2,
  agiosAgiosAgiosStBasil: 2,
  agiosAgiosAgiosStGregory: 2,
  agiosAgiosAgiosStCyril: 2,
});
const MAX_TITLE_PAIRED_VERSES = 2;

/** How many of its first verses a hymn's title keeps on its slide. */
export function getTitlePairedVerseCount(hymnKey) {
  return TITLE_PAIRED_VERSE_COUNTS[hymnKey] || 1;
}

// A rubric (a Comment row, shown only with Display Comments on) is not the
// hymn's text: it never takes one of the verses a title keeps.
const isRubricVerse = (item) => item.verse?.type === "comment" || item.verse?.type === "silentComment";

/**
 * The index of the title the verse at `index` is kept with, else -1: a title
 * is before the verse, with nothing but the Coptic Gospel toggle, rubrics,
 * and fewer verses than the title keeps between them.
 */
function pairedTitleIndex(items, index) {
  let versesBetween = 0;
  let start = index - 1;
  while (start >= 0 && items[start].type !== "title") {
    if (items[start].type === "verse") versesBetween += isRubricVerse(items[start]) ? 0 : 1;
    else if (items[start].type !== "gospelRiteToggle") return -1;
    if (versesBetween >= MAX_TITLE_PAIRED_VERSES) return -1;
    start -= 1;
  }
  if (start < 0) return -1;
  return versesBetween < (items[start].pairedVerseCount || 1) ? start : -1;
}

/**
 * Lays the items out on slides. `breakAt` is where the reader is -- the
 * item, and for a verse the line of each language, at the top of the slide
 * they are looking at -- and a slide always begins exactly there: the lines
 * before it fill the slides before. So the slide on screen depends on
 * nothing before it, and can be shown as soon as its own items are
 * measured, however long the hymn or psalm before them is.
 *
 * Turned back (`breakAt.direction` "backward"), the reader's slide is the
 * one ENDING at the item: it is packed from the foot up, as full as it can
 * be, and begins wherever that leaves it. A page turned back to is a whole
 * page, never the short remainder of a count from the top of the hymn.
 */
export function paginateItems(
  items,
  heights,
  languageHeights,
  availableHeight,
  fontSize,
  visibleLanguages,
  tableWidth,
  breakAt = null,
) {
  const safeAvailableHeight = Math.max(Number(availableHeight) || 0, 1);
  const units = buildPaginationUnits(items);
  if (breakAt?.direction === "backward") {
    const forward = packBackwardFromItem(items, units, heights, languageHeights, safeAvailableHeight, fontSize, visibleLanguages, breakAt.itemId, breakAt.offsets);
    return paginateItems(items, heights, languageHeights, availableHeight, fontSize, visibleLanguages, tableWidth, forward);
  }
  const slides = [];
  let currentSlide = [];
  let currentHeight = 0;

  const flushSlide = () => {
    if (currentSlide.length) slides.push(currentSlide);
    currentSlide = [];
    currentHeight = 0;
  };

  const isMeasuredVerse = (verseItem) =>
    hasEveryMeasuredColumn(verseItem, languageHeights[verseItem.id], visibleLanguages);

  // The reader's own line inside a verse: the lines before it belong to the
  // slide before, and the verse carries on from it at the top of theirs.
  const readerLineOffsets = (verseItem) => {
    if (!breakAt || breakAt.itemId !== verseItem.id || !isMeasuredVerse(verseItem)) return null;
    const state = createVerseLineState(languageHeights[verseItem.id], fontSize, verseItem);
    const offsets = {};
    let any = false;
    state.languages.forEach((entry) => {
      const offset = clamp(Math.floor(Number(breakAt.offsets?.[entry.language]) || 0), 0, entry.lines.length);
      offsets[entry.language] = offset;
      if (offset > 0) any = true;
    });
    return any ? offsets : null;
  };

  const appendSegments = (verseItem, state, firstSegmentIndex = 0, labelSegment, keepWithSlide = false) => {
    const result = appendTallVerseSegments({
      item: verseItem,
      state,
      slides,
      currentSlide,
      currentHeight,
      availableHeight: safeAvailableHeight,
      fontSize,
      visibleLanguages,
      firstSegmentIndex,
      labelSegment,
      keepWithSlide,
    });
    currentSlide = result.currentSlide;
    currentHeight = result.currentHeight;
    return result.nextSegmentIndex;
  };

  // The one exception to whole verses: a hymn's title and its first verse
  // always share a slide. The first verse gives as much of itself as fits
  // beneath the title, turned over the page if it must be, rather than
  // leave the title on a slide of its own. Every later verse keeps to the
  // rule above -- except beneath the few titles that keep their first two
  // (TITLE_PAIRED_VERSE_COUNTS): there the second verse does the same
  // beneath the first, while the title is still on the slide. A verse is
  // kept with its title when the title (or the Coptic Gospel toggle set
  // after it) is before it with no more than those verses between, and the
  // title is on the slide being filled.
  const pairedWithTitleHere = (index) => {
    const titleIndex = pairedTitleIndex(items, index);
    return titleIndex >= 0 && currentSlide.includes(items[titleIndex]);
  };

  const placeVerse = (verseItem, index) => {
    const verseHeight = Math.ceil((heights[verseItem.id] ?? 0) + 2);
    const languageMetric = languageHeights[verseItem.id];
    const paired = pairedWithTitleHere(index);

    // Only lines the platform's own text engine laid out are ever turned
    // over the page, or shown line by line: a split is rendered exactly as
    // decided here. A verse whose lines are not all measured yet -- every
    // column that could be split, not just one, since the languages report
    // separately and a split made from the English alone would blank the
    // Coptic and Arabic beside it -- goes on whole and wraps as it will; its
    // real lines settle the page before it is shown (see isSlideSettled).
    if (!isMeasuredVerse(verseItem)) {
      if (currentHeight + verseHeight > safeAvailableHeight && currentSlide.length && !paired) flushSlide();
      currentSlide.push(verseItem);
      currentHeight += verseHeight;
      return;
    }

    const offsets = readerLineOffsets(verseItem);
    if (offsets) {
      // The pieces before the reader's line are labelled apart, so the piece
      // the reader is on keeps the same identity however many they are.
      const placed = appendSegments(verseItem, createVerseLineState(languageMetric, fontSize, verseItem, { end: offsets }), 0, (piece) => `before-${piece}`, paired);
      flushSlide();
      // What follows is a continuation (no speaker label again), numbered on from the pieces before.
      appendSegments(verseItem, createVerseLineState(languageMetric, fontSize, verseItem, { start: offsets }), Math.max(1, placed), (index, order) => `segment-${1 + order}`);
      return;
    }

    // A slide holds whole verses. One that doesn't fit what is left of the
    // slide moves on whole to the next, like the next verse of a hymn on a
    // projected page: never a sentence cut in two across a turn. A measured
    // verse is still rendered from its measured lines, so what the page
    // shows is what it was laid out for, to the line.
    if (currentHeight + verseHeight <= safeAvailableHeight) {
      currentSlide.push(createWholeVerseItem(verseItem, languageMetric, fontSize));
      currentHeight += verseHeight;
      return;
    }
    if (paired) {
      appendSegments(verseItem, createVerseLineState(languageMetric, fontSize, verseItem), 0, undefined, true);
      return;
    }
    if (currentSlide.length) flushSlide();
    if (verseHeight <= safeAvailableHeight) {
      currentSlide.push(createWholeVerseItem(verseItem, languageMetric, fontSize));
      currentHeight += verseHeight;
      return;
    }

    // Only a verse taller than a whole slide is turned over the page, from a
    // fresh slide, each column as many of its lines at a time as fit --
    // never in a piece of fewer than two lines, either side of the turn.
    appendSegments(verseItem, createVerseLineState(languageMetric, fontSize, verseItem));
  };

  // A title, a speaker's cue, a toggle: nothing to end a slide on. If what
  // follows it would not fit beneath it, it goes over the page with it.
  const keepsWithNext = (item) => item.type === "title" || item.type === "gospelRiteToggle";
  const itemHeightOf = (item) => Math.ceil((heights[item.id] ?? 0) + 2);
  const wouldStrand = (index) => {
    const item = items[index];
    if (!keepsWithNext(item)) return false;
    // Part of a chain already begun (the toggle after its title): it stays.
    if (index > 0 && keepsWithNext(items[index - 1]) && currentSlide.length && currentSlide[currentSlide.length - 1] === items[index - 1]) return false;
    // The chain from here, and the first item after it.
    let end = index;
    let chainHeight = 0;
    while (end < items.length && keepsWithNext(items[end]) && (end === index || !units[end].breakBefore)) {
      chainHeight += itemHeightOf(items[end]);
      end += 1;
    }
    const next = items[end];
    if (!next || units[end].breakBefore) return false;
    // As much of what follows as a fresh slide would hold beneath the chain:
    // if this slide cannot hold that much, the chain goes over the page.
    const after = Math.min(itemHeightOf(next), Math.max(safeAvailableHeight - chainHeight, 1));
    return currentHeight + chainHeight + Math.max(after, 1) > safeAvailableHeight;
  };

  // A break at a verse its title keeps, from its top, is a break at the
  // title: they share a slide.
  const breakIndex = breakAt ? items.findIndex((item) => item.id === breakAt.itemId) : -1;
  const breakTitleIndex = breakIndex >= 0 && items[breakIndex].type === "verse" && !readerLineOffsets(items[breakIndex])
    ? pairedTitleIndex(items, breakIndex)
    : -1;
  const breakStartsAtId = breakTitleIndex >= 0 ? items[breakTitleIndex].id : breakAt?.itemId;

  units.forEach((unit, index) => {
    const item = unit.items[0];
    const readerStartsHere = breakStartsAtId === item.id &&
      !(item.type === "verse" && readerLineOffsets(item));
    // Turned back, the reader's page also ends where the page they left began.
    const readerPageEndedBefore = Boolean(breakAt?.endsBeforeItemId) && breakAt.endsBeforeItemId === item.id;
    if (currentSlide.length && (unit.breakBefore || readerStartsHere || readerPageEndedBefore)) flushSlide();

    if (item.type === "verse") {
      placeVerse(item, index);
      return;
    }

    const itemHeight = itemHeightOf(item);
    if (currentSlide.length && (currentHeight + itemHeight > safeAvailableHeight || wouldStrand(index))) flushSlide();
    currentSlide.push(item);
    currentHeight += itemHeight;
  });

  flushSlide();
  return slides.length ? slides : [[]];
}

/**
 * The slide that ends at an item, packed from the foot up: where it begins
 * is where the reader's forward break then goes. A title, or anything else
 * that keeps with the item after it, joins the slide with that item or not
 * at all; an item that must open a slide ends the walk. Ending on a verse
 * taller than a slide, the slide shows that verse's last piece (and
 * whatever follows it that fits, as a forward turn would).
 */
function packBackwardFromItem(items, units, heights, languageHeights, availableHeight, fontSize, visibleLanguages, itemId, lineOffsets) {
  const last = items.findIndex((item) => item.id === itemId);
  if (last < 0) return null;
  const heightOf = (index) => Math.ceil((heights[items[index].id] ?? 0) + 2);
  const measured = (item) => item.type === "verse" && hasEveryMeasuredColumn(item, languageHeights[item.id], visibleLanguages);
  const keepsWithNext = (item) => item?.type === "title" || item?.type === "gospelRiteToggle";
  // A verse its title keeps on its slide, or one taller than a slide, is
  // laid out as a forward turn lays it out -- from the title, or from a
  // fresh slide -- and the page ending at the line asked for (else at the
  // verse's last piece) is the one of those pages holding it. A verse
  // divided beneath its title is not divided as a fresh slide would divide
  // it, and its page is then the title's, or the one its earlier pieces
  // leave it on.
  const titleIndex = pairedTitleIndex(items, last);
  const underTitle = titleIndex >= 0;
  if (measured(items[last]) && (underTitle || heightOf(last) > availableHeight)) {
    const pages = paginateItems(items.slice(underTitle ? titleIndex : last, last + 1), heights, languageHeights, availableHeight, fontSize, visibleLanguages, 0);
    const pieceOf = (page) => page.find((entry) => (entry.sourceItemId || entry.id) === itemId && Object.keys(entry.slideshowLineRanges || {}).length > 0);
    const holding = pages.map((page, index) => (pieceOf(page) ? index : -1)).filter((index) => index >= 0);
    const wanted = lineOffsets && Object.entries(lineOffsets).find(([, line]) => Number.isFinite(line) && line >= 0);
    const wantedPage = wanted ? holding.find((index) => {
      const range = pieceOf(pages[index]).slideshowLineRanges[wanted[0]];
      return range && wanted[1] >= range.start && wanted[1] < range.end;
    }) : undefined;
    const lastHolding = holding[holding.length - 1];
    const pageIndex = wantedPage ?? lastHolding;
    const first = pageIndex != null ? pages[pageIndex][0] : null;
    // Whole beneath its title, the verse is packed back like any other (below).
    const wholeBeneathTitle = underTitle && holding.length === 1 && first === items[titleIndex];
    if (first && !wholeBeneathTitle) {
      // The page ends at the verse's end only when it holds its last piece;
      // any other piece fills its page on its own.
      const endsBeforeItemId = pageIndex === lastHolding ? items[last + 1]?.id : undefined;
      const offsets = Object.fromEntries(Object.entries(first.slideshowLineRanges || {}).map(([language, range]) => [language, range.start]));
      return { itemId: first.sourceItemId || first.id, offsets, endsBeforeItemId };
    }
  }
  let first = last;
  let total = heightOf(last);
  while (first > 0 && !units[first].breakBefore) {
    // The group ending just before: an item plus whatever keeps with it.
    let start = first - 1;
    while (start > 0 && keepsWithNext(items[start - 1])) start -= 1;
    let groupHeight = 0;
    for (let index = start; index < first; index += 1) groupHeight += heightOf(index);
    if (total + groupHeight > availableHeight) break;
    total += groupHeight;
    first = start;
  }
  // Nothing keeps with the item before it is left stranded at the foot of the slide before.
  while (first > 0 && keepsWithNext(items[first - 1])) first -= 1;
  return { itemId: items[first].id, offsets: {}, endsBeforeItemId: items[last + 1]?.id };
}

// A measured verse placed whole, carrying its lines: built once per verse
// and metric, so a page laid out again hands the renderer the same object.
const wholeVerseItems = new WeakMap();

function createWholeVerseItem(item, languageMetric, fontSize) {
  const cached = wholeVerseItems.get(item);
  if (cached && cached.languageMetric === languageMetric && cached.fontSize === fontSize) return cached.whole;
  const state = createVerseLineState(languageMetric, fontSize, item);
  const everything = Object.fromEntries(state.languages.map((entry) => [entry.language, entry.end]));
  const whole = createVerseLineSegment(item, state, everything, 0).item;
  wholeVerseItems.set(item, { languageMetric, fontSize, whole });
  return whole;
}

function appendTallVerseSegments({
  item,
  state,
  slides,
  currentSlide,
  currentHeight,
  availableHeight,
  fontSize,
  visibleLanguages,
  firstSegmentIndex = 0,
  labelSegment,
  // The first piece stays on the slide it is on, however little of it fits
  // (a title's first verse): at least a line, over the foot if need be.
  keepWithSlide = false,
}) {
  let segmentIndex = firstSegmentIndex;
  let placedCount = 0;

  while (hasRemainingVerseLines(state)) {
    const capacityItem = segmentIndex > 0
      ? createContinuationCapacityItem(item, state)
      : item;
    const remainingHeight = availableHeight - currentHeight;
    let lineCapacities = independentLineTakes(state, getIndependentLineCapacities(
      state,
      remainingHeight,
      fontSize,
      capacityItem,
      visibleLanguages,
    ));

    const keepHere = keepWithSlide && segmentIndex === firstSegmentIndex && currentSlide.length > 0;
    if (keepHere && !hasPositiveLineCapacity(lineCapacities)) {
      lineCapacities = getMinimumLineCapacities(state);
    }

    if (!keepHere && currentSlide.length && shouldAvoidTinyFragment(
      state,
      lineCapacities,
      availableHeight,
      fontSize,
      capacityItem,
      visibleLanguages,
    )) {
      slides.push(currentSlide);
      currentSlide = [];
      currentHeight = 0;
      continue;
    }

    if (!hasPositiveLineCapacity(lineCapacities) && currentSlide.length) {
      slides.push(currentSlide);
      currentSlide = [];
      currentHeight = 0;
      continue;
    }

    if (!hasPositiveLineCapacity(lineCapacities)) {
      const decorationHeight = getVerseDecorationHeight(
        state,
        capacityItem,
        fontSize,
        visibleLanguages,
      );
      if (
        segmentIndex === 0 &&
        decorationHeight > getVerseVerticalPadding(capacityItem) &&
        decorationHeight <= availableHeight
      ) {
        currentSlide.push(createVerseDecorationSegment(item, state));
        slides.push(currentSlide);
        currentSlide = [];
        currentHeight = 0;
        segmentIndex += 1;
        continue;
      }
      lineCapacities = getMinimumLineCapacities(state);
    }

    const segment = createVerseLineSegment(item, state, lineCapacities, segmentIndex, labelSegment?.(segmentIndex, placedCount));
    placedCount += 1;
    const segmentHeight = getVerseLineSegmentHeight(
      segment,
      fontSize,
      visibleLanguages,
    );

    currentSlide.push(segment.item);
    currentHeight += segmentHeight;
    segmentIndex += 1;

    if (hasRemainingVerseLines(state)) {
      slides.push(currentSlide);
      currentSlide = [];
      currentHeight = 0;
    }
  }

  return { currentSlide, currentHeight, nextSegmentIndex: segmentIndex };
}

/**
 * Each column of a verse too tall for a slide shows as much of itself as
 * fits, on its own: the Arabic may finish on this slide while the English
 * carries on to the next, and an empty cell is left where it finished.
 * Only a single stray line is held back, so the turn of the page never
 * leaves a column one line on its own.
 */
export function independentLineTakes(state, capacities) {
  const takes = {};
  state.languages
    .filter((entry) => entry.offset < entry.end)
    .forEach((entry) => {
      const remaining = entry.end - entry.offset;
      let take = Math.max(0, Math.min(capacities[entry.language] ?? 0, remaining));
      if (take >= 2 && remaining - take === 1) take -= 1;
      takes[entry.language] = take;
    });
  return takes;
}

// What a continuation segment still carries: no speaker label, and the
// seasonal prefix line only for a column that has yet to show its first line.
function createContinuationCapacityItem(item, state) {
  return {
    ...item,
    suppressSpeakerLabel: true,
    verse: {
      ...item.verse,
      bibleVerseNumber: "",
      slideshowSeasonalPrefixVisible: hasPendingPrefixColumn(item, state),
    },
  };
}

function hasPendingPrefixColumn(item, state) {
  if (state.prefixShownOnOwnPage || !hasSeasonalPrefixLine(item.verse)) return false;
  const prefix = String(item.verse?.seasonalHoosVersePrefix || "").trim();
  return state.languages.some((entry) =>
    (entry.language === "english" || entry.language === "arabic") &&
    entry.offset === 0 && entry.end > 0 &&
    String(item.verse?.[entry.language] || "").trimStart().startsWith(prefix));
}

function shouldAvoidTinyFragment(
  state,
  currentCapacities,
  availableHeight,
  fontSize,
  item,
  visibleLanguages,
) {
  const remainingLineCount = state.languages.reduce(
    (largest, entry) => Math.max(largest, entry.end - entry.offset),
    0,
  );
  const currentCapacity = Math.max(0, ...Object.values(currentCapacities));
  const freshCapacity = Math.max(
    0,
    ...Object.values(getIndependentLineCapacities(
      state,
      availableHeight,
      fontSize,
      item,
      visibleLanguages,
    )),
  );
  const desired = Math.min(MIN_USEFUL_FRAGMENT_LINES, remainingLineCount, freshCapacity);
  return desired > 0 && currentCapacity < desired;
}

function hasEveryMeasuredColumn(item, metric = {}, visibleLanguages = {}) {
  if (!hasMeasuredVerseLines(metric)) return false;
  return getLanguagesNeedingLineMetrics(item, visibleLanguages).every((language) =>
    Array.isArray(metric?.[language]?.lines));
}

export function hasMeasuredVerseLines(metric = {}) {
  return ["english", "french", "coptic", "arabic"].some(
    (language) => Array.isArray(metric[language]?.lines) && metric[language].lines.length,
  );
}

/**
 * The lines of each language still to be placed: from `start` (per
 * language; the top of the verse by default) up to `end` (its last line by
 * default). A language keeps its place in the state even with nothing left
 * in this stretch, so its column stays in the row.
 */
function createVerseLineState(languageMetric = {}, fontSize, item = {}, { start, end } = {}) {
  return {
    languages: ["english", "french", "coptic", "arabic"]
      .map((language) => {
        const lines = getMetricLinesForLanguage(languageMetric[language]?.lines || [], language, item);
        const to = clamp(Math.floor(Number(end?.[language] ?? lines.length)), 0, lines.length);
        return {
          language,
          lineHeight: getSlideshowLanguageLineHeight(language, item, fontSize),
          lines,
          offset: clamp(Math.floor(Number(start?.[language] ?? 0)), 0, to),
          end: to,
        };
      })
      .filter((entry) => entry.lines.length),
  };
}

function hasRemainingVerseLines(state) {
  return state.languages.some((entry) => entry.offset < entry.end);
}

function getIndependentLineCapacities(state, height, fontSize, item, visibleLanguages) {
  const usableHeight =
    height -
    getVerseCommonHeight(item, fontSize, visibleLanguages) -
    getMaxPrefixHeight(state, item, fontSize);
  if (usableHeight <= 0) return {};

  return state.languages
    .filter((entry) => entry.offset < entry.end)
    .reduce((capacities, entry) => {
      capacities[entry.language] = Math.max(0, Math.floor(usableHeight / entry.lineHeight));
      return capacities;
    }, {});
}

function getMaxPrefixHeight(state, item, fontSize) {
  return Math.max(
    0,
    ...state.languages.map((entry) => getLanguagePrefixHeight(entry.language, item, fontSize)),
  );
}

function getVerseDecorationHeight(state, item, fontSize, visibleLanguages) {
  return getVerseCommonHeight(item, fontSize, visibleLanguages) +
    getMaxPrefixHeight(state, item, fontSize);
}

function hasPositiveLineCapacity(lineCapacities = {}) {
  return Object.values(lineCapacities).some((capacity) => capacity > 0);
}

function getMinimumLineCapacities(state) {
  return state.languages
    .filter((entry) => entry.offset < entry.end)
    .reduce((capacities, entry) => {
      capacities[entry.language] = 1;
      return capacities;
    }, {});
}

export function createVerseLineSegment(item, state, lineCapacities, segmentIndex, label = `segment-${segmentIndex}`) {
  const originalLanguageKeys = state.languages.map((entry) => entry.language);
  const hasPrefix = hasSeasonalPrefixLine(item.verse);
  const verse = {
    ...item.verse,
    arabic: "",
    coptic: "",
    english: "",
    french: "",
    bibleVerseNumber: item.verse?.bibleVerseNumber,
    slideshowSeasonalPrefixVisible: false,
  };
  const lineCounts = {};
  const lineRanges = {};
  const forcedLines = {};
  const bibleNumberLanguages = [];
  const segmentEntries = [];

  state.languages.forEach((entry) => {
    const start = entry.offset;
    const remainingCount = entry.end - start;
    let takeCount = Math.max(0, Math.min(lineCapacities[entry.language] || 0, remainingCount));
    // The lines beside a decorated initial are turned over the page only
    // together: the initial stands beside both, so a page taking either takes both.
    const besideInitial = countInitialLines(entry.lines);
    if (takeCount > 0 && start < besideInitial && start + takeCount < besideInitial) {
      takeCount = Math.min(besideInitial - start, remainingCount);
    }
    const lines = entry.lines.slice(start, start + takeCount);
    if (lines.length) segmentEntries.push({ entry, lines, start });
    entry.offset += takeCount;
  });

  // The seasonal prefix and the Bible verse number belong to the first lines
  // of each column, wherever that column begins: a column held over to the
  // next slide brings its own along.
  let showsPrefix = false;
  segmentEntries.forEach(({ entry, lines, start }) => {
    const joinedBody = joinRenderedLines(lines);
    const beginsWithBibleNumber = Boolean(item.verse?.bibleVerseNumber) && start === 0;
    const body = beginsWithBibleNumber
      ? joinedBody.replace(/^\S+\s*/, "")
      : joinedBody;
    const prefix = String(item.verse?.seasonalHoosVersePrefix || "").trim();
    const originalText = String(item.verse?.[entry.language] || "").trimStart();
    const shouldPrependPrefix =
      hasPrefix &&
      !state.prefixShownOnOwnPage &&
      start === 0 &&
      (entry.language === "english" || entry.language === "arabic") &&
      prefix &&
      originalText.startsWith(prefix);
    if (shouldPrependPrefix) showsPrefix = true;

    verse[entry.language] = shouldPrependPrefix
      ? `${prefix}${body ? `\n${body}` : ""}`
      : body;
    lineCounts[entry.language] = lines.length;
    forcedLines[entry.language] = lines;
    if (beginsWithBibleNumber) bibleNumberLanguages.push(entry.language);
  });
  // Every column, including one with nothing on this page: where it stands
  // is what an anchor made here must say, or a column already shown whole
  // on the page before would start again from its top.
  state.languages.forEach((entry) => {
    const taken = lineCounts[entry.language] || 0;
    lineRanges[entry.language] = { start: entry.offset - taken, end: entry.offset };
  });

  verse.slideshowSeasonalPrefixVisible = showsPrefix;
  verse.slideshowLanguageKeys = originalLanguageKeys;
  verse.slideshowForcedLines = forcedLines;
  verse.slideshowBibleNumberLanguages = bibleNumberLanguages;
  const sourceItemId = item.sourceItemId || item.id;

  return {
    item: {
      ...item,
      id: segmentIndex ? `${sourceItemId}-${label}` : sourceItemId,
      slideId: `${sourceItemId}-${label}`,
      sourceItemId,
      suppressSpeakerLabel: Boolean(item.suppressSpeakerLabel) || segmentIndex > 0,
      verse,
      slideshowLineCounts: lineCounts,
      slideshowLineRanges: lineRanges,
      slideshowSegmentIndex: segmentIndex,
    },
  };
}

// A page of the verse's decorations alone (its speaker label, its seasonal
// prefix) when not one line of text fits beside them: the prefix is then
// shown, and the lines that follow do not show it again.
function createVerseDecorationSegment(item, state) {
  state.prefixShownOnOwnPage = true;
  const prefix = String(item.verse?.seasonalHoosVersePrefix || "").trim();
  const verse = {
    ...item.verse,
    english: String(item.verse?.english || "").trimStart().startsWith(prefix) ? prefix : "",
    french: "",
    coptic: "",
    arabic: String(item.verse?.arabic || "").trimStart().startsWith(prefix) ? prefix : "",
    slideshowBibleNumberLanguages: [],
    slideshowForcedLines: Object.fromEntries(state.languages.map((entry) => [entry.language, []])),
    slideshowLanguageKeys: state.languages.map((entry) => entry.language),
    slideshowSeasonalPrefixVisible: Boolean(prefix),
  };
  const sourceItemId = item.sourceItemId || item.id;
  return {
    ...item,
    id: sourceItemId,
    slideId: `${sourceItemId}-segment-0`,
    sourceItemId,
    verse,
    slideshowLineCounts: {},
    slideshowLineRanges: {},
    slideshowSegmentIndex: 0,
  };
}

export function joinRenderedLines(lines) {
  return lines.reduce((text, line, index) => {
    const value = String(line?.text || "").trim();
    if (!index) return value;
    const previous = lines[index - 1];
    return `${text}${previous?.isParagraphEnd ? "\n" : " "}${value}`;
  }, "").trim();
}

export function getVerseLineSegmentHeight(segment, fontSize, visibleLanguages) {
  const counts = segment.item.slideshowLineCounts || {};
  const languageHeights = Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([language, count]) => count * getSlideshowLanguageLineHeight(language, segment.item, fontSize));
  const prefixLanguages = segment.item.verse?.slideshowLanguageKeys || Object.keys(counts);
  const prefixHeight = Math.max(
    0,
    ...prefixLanguages.map((language) => getLanguagePrefixHeight(language, segment.item, fontSize)),
  );
  return getVerseCommonHeight(segment.item, fontSize, visibleLanguages) +
    prefixHeight +
    (languageHeights.length ? Math.max(...languageHeights) : 0);
}

/**
 * The ornaments' proportions (constants/documentOrnaments.ts, kept here as
 * plain numbers so this file stays importable on its own): each headpiece's
 * height over its width, drawn the full width of the page, and the
 * Medallion's size.
 */
const HEADPIECE_ASPECT = { lintel: 230 / 1200, stepped: 400 / 1200, interlace: 460 / 1200, roundels: 400 / 1200 };

export function estimateItemHeight(item, fontSize, visibleLanguages, tableWidth) {
  const chrome = getSlideshowChromeMetrics(fontSize);
  if (item.type === "title" && HEADPIECE_ASPECT[item.ornament]) {
    return Math.max(tableWidth, 1) * HEADPIECE_ASPECT[item.ornament] + SPACING_SM * 2;
  }
  if (item.type === "ornament") return Math.min(Math.max(tableWidth * 0.28, 96), 150) + SPACING_SM * 6;
  if (item.type === "title") return chrome.titleLineHeight + SPACING_SM * 2;
  if (item.type === "button") {
    // The hyperlink's bar and the interpretations' choice share one shape.
    const barLike = item.isHyperlink || item.isChoice;
    const minimumHeight = barLike
      ? DOCUMENT_CONTROL_METRICS.hyperlinkMinHeight
      : DOCUMENT_CONTROL_METRICS.openButtonMinHeight;
    const lineHeight = barLike
      ? chrome.hyperlinkLineHeight
      : chrome.buttonLineHeight;
    const contentHeight = barLike
      ? lineHeight + SPACING_SM * 4
      : lineHeight * 2 + SPACING_SM * 6;
    return SPACING_SM * 4 + Math.max(minimumHeight, contentHeight);
  }
  if (item.type === "gospelRiteToggle") return chrome.titleLineHeight + SPACING_SM * 5;

  const layout = getVerseLanguageLayout(item, visibleLanguages, tableWidth);
  const languageHeights = layout.languages
    .map((language) => {
      const text = item.verse?.[language];
      if (!String(text || "").trim()) return 0;
      return estimateLanguageLineCount(text, language, fontSize, layout.rowColumnWidth, item) *
        getSlideshowLanguageLineHeight(language, item, fontSize) +
        getLanguagePrefixHeight(language, item, fontSize);
    })
    .filter(Boolean);

  return getVerseCommonHeight(item, fontSize, visibleLanguages) +
    (languageHeights.length ? Math.max(...languageHeights) : 0);
}

function getVerseLanguageLayout(item, visibleLanguages = {}, tableWidth = 0) {
  const languages = getVisibleVerseLanguages(item, visibleLanguages);
  return {
    languages,
    rowColumnWidth: Math.max((tableWidth || 0) / Math.max(languages.length, 1), 1),
  };
}

/**
 * A Coptic line with no translation of its own is not a column but the
 * whole line, centered across the row (see spanningLanguage in VerseBlock).
 */
export function copticStandsAlone(verse = {}) {
  const hasTranslationText = Boolean(
    (verse.english && verse.english.trim()) ||
      (verse.french && verse.french.trim()) ||
      (verse.arabic && verse.arabic.trim()),
  );
  return Boolean(verse.invincibleCoptic) && !hasTranslationText;
}

/**
 * Whether a language's text is set justified (rendered line by line, so a
 * page break can fall between its measured lines) rather than centered. The
 * one definition both the renderer and the measurement bookkeeping follow.
 */
export function isSlideshowLanguageJustified(verse = {}, language) {
  if (verse.type === "refrainLabel" || verse.type === "readingReference") return false;
  return !(language === "coptic" && copticStandsAlone(verse));
}

/**
 * The languages whose measured lines pagination needs before it can trust an
 * item: every column of a verse that has text. A slide can split any of
 * them, and each is rendered from exactly these lines.
 */
export function getLanguagesNeedingLineMetrics(item, visibleLanguages = {}) {
  if (item?.type !== "verse") return [];
  const verse = item.verse || {};
  return getVisibleVerseLanguages(item, visibleLanguages).filter((language) =>
    Boolean(String(verse[language] || "").trim()));
}

/**
 * An item is measured once its height AND the lines of every column that
 * could be split are known. A height alone is not enough: a verse would then
 * leave the measurement layer before its lines were reported, and a later
 * page break in it could only be guessed.
 */
export function isSlideshowItemMeasured(item, heights = {}, languageHeights = {}, visibleLanguages = {}) {
  if (!item || typeof heights[item.id] !== "number") return false;
  const metric = languageHeights[item.id] || {};
  return getLanguagesNeedingLineMetrics(item, visibleLanguages).every((language) =>
    Array.isArray(metric[language]?.lines));
}

export function getVisibleVerseLanguages(item, visibleLanguages = {}) {
  const verse = item.verse || {};
  if (copticStandsAlone(verse)) {
    return String(verse.coptic || "").trim() ? ["coptic"] : [];
  }

  return ["english", "french", "coptic", "arabic"].filter((language) => {
    if (language !== "coptic") {
      return Boolean(visibleLanguages[language]) &&
        (Boolean(String(verse[language] || "").trim()) || Boolean(item.hasSpeakerLabel));
    }

    const forceCoptic = verse.forceCopticVisible || verse.invincibleCoptic;
    return Boolean(String(verse.coptic || "").trim()) &&
      Boolean(visibleLanguages.coptic || forceCoptic) &&
      (!item.isRecitedPrayer || visibleLanguages.copticRecitedPrayers || forceCoptic);
  });
}

export function hasRenderableSlideshowLanguageBody(language = {}) {
  return Boolean(
    String(language.text || "").trim() ||
    String(language.bibleVerseNumber || "").trim() ||
    String(language.seasonalHoosVersePrefix || "").trim() ||
    String(language.seasonalHoosVersePrefixSpacer || "").trim(),
  );
}

export function createEstimatedTextLines(text, maxLineLength) {
  const paragraphs = String(text || "").replace(/\r\n?/g, "\n").split("\n");
  return paragraphs.flatMap((paragraph) => {
    const lines = splitEstimatedLine(paragraph, maxLineLength);
    return lines.map((line, index) => ({
      ...line,
      isParagraphEnd: index === lines.length - 1,
    }));
  });
}

function splitEstimatedLine(line, maxLineLength) {
  const words = String(line || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [{ text: "", isBlank: true }];
  const lines = [];
  let current = "";
  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (current && next.length > maxLineLength) {
      lines.push({ text: current });
      current = word;
    } else {
      current = next;
    }
  });
  if (current) lines.push({ text: current });
  return lines;
}

function estimateLanguageLineCount(text, language, fontSize, rowColumnWidth, item) {
  return Math.max(
    1,
    createEstimatedTextLines(
      text,
      getEstimatedLineLength(language, fontSize, rowColumnWidth, item),
    ).length,
  );
}

function getEstimatedLineLength(language, fontSize, rowColumnWidth, item) {
  const availableWidth = Math.max((rowColumnWidth || 0) - SPACING_XS * 2, 40);
  const languageFontSize = getSlideshowLanguageFontSize(language, item, fontSize);
  const characterWidthFactor = language === "coptic" ? 0.72 : language === "arabic" ? 0.62 : 0.56;
  return clamp(
    Math.floor(availableWidth / Math.max(languageFontSize * characterWidthFactor, 1)),
    8,
    80,
  );
}

export function normalizeLanguageMetric(metric) {
  if (!metric.lines) return metric;
  const lines = metric.lines.map((line) => ({
    text: line.text || "",
    isBlank: Boolean(line.isBlank),
    isParagraphEnd: Boolean(line.isParagraphEnd),
    // Set beside a decorated initial ("one" or "two" lines tall; JustifiedText.js).
    ...(line.initial ? { initial: line.initial } : null),
  }));
  return {
    ...metric,
    lines,
    lineSignature: lines.map((line) => `${line.initial ? `[${line.initial}]` : ""}${line.text}${line.isParagraphEnd ? "¶" : ""}`).join("\n"),
  };
}

function getMetricLinesForLanguage(lines, language, item = {}) {
  // Coptic and French carry the seasonal prefix only as a blank spacer line.
  if ((language !== "coptic" && language !== "french") || !hasSeasonalPrefixLine(item?.verse)) return lines;
  const prefix = String(item?.verse?.seasonalHoosVersePrefix || "").trim();
  if (!prefix) return lines;
  return lines.filter((line, index) => index !== 0 || String(line?.text || "").trim() !== prefix);
}

function getSourceItemId(item = {}) {
  return item.sourceItemId || item.id || "";
}

export function createSlideAnchor(slide = []) {
  const item = slide.find((candidate) => candidate && getSourceItemId(candidate));
  if (!item) return null;
  const ranges = item.slideshowLineRanges || {};
  const offsets = Object.fromEntries(
    Object.entries(ranges).map(([language, range]) => [language, range.start]),
  );
  // The reading position is held by a column with lines on this page.
  const primaryLanguage = Object.keys(ranges).find((language) => ranges[language].end > ranges[language].start) ||
    Object.keys(offsets)[0] || null;
  return {
    sourceItemId: getSourceItemId(item),
    sectionId: item.sectionId || null,
    segmentIndex: Number.isFinite(item.slideshowSegmentIndex)
      ? item.slideshowSegmentIndex
      : null,
    primaryLanguage,
    offsets,
  };
}

function getLineRangeDistance(range, offset) {
  if (!range) return 100000;
  if (offset >= range.start && offset < range.end) return 0;
  // A column with nothing on this page stands at one line: its own.
  if (range.start === range.end && offset === range.start) return 0;

  // Line ranges are half-open: [start, end). The first line of the next
  // segment therefore has offset === the previous segment's end. Giving
  // that boundary a distance of zero tied the two pages, and the resolver
  // always kept the earlier page. This was the common forward-navigation
  // failure for any long verse, at every font size.
  if (offset < range.start) return range.start - offset;
  return offset - range.end + 1;
}

function anchorDistance(item, anchor) {
  if (getSourceItemId(item) !== anchor.sourceItemId) return Number.POSITIVE_INFINITY;
  const ranges = item.slideshowLineRanges || {};
  const offsets = anchor.offsets || {};
  const languages = Object.keys(offsets);
  const rangeLanguages = Object.keys(ranges);

  // At the largest font sizes a speaker label or seasonal prefix can need a
  // decoration-only page immediately before the row's first text page. Both
  // pages intentionally share one sourceItemId, but only the text page has
  // line ranges. Treating the range-less decoration as a zero-distance match
  // for a text anchor made findSlideIndexForAnchor choose the earlier page,
  // so pressing Next appeared to do nothing and the reader became trapped.
  // A row that is not split at all (no ranges, not even empty ones) holds
  // every line the anchor could name: turned to a width where the row fits
  // whole, or measured again from scratch, the reader is still on it.
  if (languages.length && !rangeLanguages.length) {
    return item.slideshowLineRanges ? Number.POSITIVE_INFINITY : 0;
  }

  if (!languages.length) {
    if (
      Number.isFinite(anchor.segmentIndex) &&
      Number.isFinite(item.slideshowSegmentIndex)
    ) {
      return Math.abs(anchor.segmentIndex - item.slideshowSegmentIndex);
    }
    return 0;
  }

  // Independent language columns do not always retain identical boundaries
  // after a resize. Preserve the first visible column exactly, then use the
  // remaining columns only as tie-breakers. Summing every language equally
  // could otherwise choose a compromise page containing none of the lines
  // that were actually at the top before repagination.
  const primaryLanguage = languages.includes(anchor.primaryLanguage)
    ? anchor.primaryLanguage
    : languages[0];
  const primaryDistance = getLineRangeDistance(
    ranges[primaryLanguage],
    offsets[primaryLanguage],
  );
  const secondaryDistance = languages
    .filter((language) => language !== primaryLanguage)
    .reduce(
      (total, language) => total + getLineRangeDistance(ranges[language], offsets[language]),
      0,
    );

  return primaryDistance * 1000000 + secondaryDistance;
}

export function findSlideIndexForAnchor(slides = [], anchor) {
  if (!anchor?.sourceItemId) return -1;
  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  // Turned back to, the item ends its slide: of equal matches, the last.
  const backward = anchor.direction === "backward";
  slides.forEach((slide, index) => {
    slide.forEach((item) => {
      const distance = anchorDistance(item, anchor);
      if (distance < bestDistance || (backward && distance === bestDistance && distance < Number.POSITIVE_INFINITY)) {
        bestDistance = distance;
        bestIndex = index;
      }
    });
  });
  return bestIndex;
}

export function getSlideKey(slide = [], index = 0) {
  const first = slide[0];
  const last = slide[slide.length - 1];
  if (!first) return `empty:${index}`;
  return `${first.slideId || getSourceItemId(first)}:${last?.slideId || getSourceItemId(last)}`;
}

export function getAdjacentSlideIndexes(currentIndex, slideCount) {
  return [currentIndex - 1, currentIndex, currentIndex + 1]
    .filter((index) => index >= 0 && index < slideCount);
}

/**
 * The current slide must be the one layer that participates in flex layout.
 * Native Yoga does not let absolute children establish their parent's size,
 * so rendering every preloaded layer as an overlay can collapse the deck.
 */
export function getSlideRenderLayers(currentIndex, slideCount) {
  const indexes = getAdjacentSlideIndexes(currentIndex, slideCount);
  return [
    ...indexes
      .filter((index) => index === currentIndex)
      .map((index) => ({ index, inFlow: true })),
    ...indexes
      .filter((index) => index !== currentIndex)
      .map((index) => ({ index, inFlow: false })),
  ];
}

/**
 * The index of the item the reader is at: the anchor's own row, else the
 * first row of the section asked for, else the top.
 */
export function getReadingItemIndex(items, anchor, preferredSectionId) {
  const anchoredIndex = anchor?.sourceItemId
    ? items.findIndex((item) => getSourceItemId(item) === anchor.sourceItemId)
    : -1;
  if (anchoredIndex >= 0) return anchoredIndex;
  const sectionIndex = preferredSectionId
    ? items.findIndex((item) => item.sectionId === preferredSectionId)
    : -1;
  return sectionIndex >= 0 ? sectionIndex : 0;
}

/**
 * Where the pagination run holding an item begins: the nearest item at or
 * before it that must open a slide (see buildPaginationUnits). The slides
 * from there on are filled in order, so an item's slide depends on nothing
 * before this one.
 */
export function getPaginationRunStart(items, index) {
  if (!items.length) return 0;
  const units = buildPaginationUnits(items);
  let start = Math.min(Math.max(index, 0), items.length - 1);
  while (start > 0 && !units[start].breakBefore) start -= 1;
  return start;
}

/**
 * Whether a slide can still change as measurements land. It cannot once
 * every item from the start of its run through its own items, and the first
 * item of the next slide (the one that didn't fit), is measured: the greedy
 * fill that produced it then has no estimate left in it. An empty slide has
 * nothing to settle.
 */
export function isSlideSettled(items, slides, slideIndex, isMeasured, itemIndexById, breakIndex = null) {
  const slide = slides[slideIndex];
  if (!slide) return false;
  if (!items.length || !slide.length) return true;
  const indexById = itemIndexById || new Map(items.map((item, index) => [item.id, index]));
  const firstIndex = indexById.get(getSourceItemId(slide[0]));
  const lastIndex = indexById.get(getSourceItemId(slide[slide.length - 1]));
  if (firstIndex == null || lastIndex == null) return false;
  const next = slides[slideIndex + 1]?.[0];
  const nextIndex = next ? indexById.get(getSourceItemId(next)) : null;
  const end = Math.max(lastIndex, nextIndex ?? lastIndex);
  for (let index = getSettleStart(items, firstIndex, breakIndex); index <= end; index += 1) {
    if (!isMeasured(items[index])) return false;
  }
  return true;
}

/**
 * The first item a slide's layout depends on: the reader's own break (see
 * paginateItems' breakAt) when it is at or before the slide, else the start
 * of the slide's run.
 */
export function getSettleStart(items, firstIndex, breakIndex = null) {
  const runStart = getPaginationRunStart(items, firstIndex);
  if (breakIndex == null || breakIndex < 0 || breakIndex > firstIndex) return runStart;
  // A break at a verse its title keeps is laid out from the title, so the
  // slide waits on the title and the verses before it too.
  const titleIndex = items[breakIndex]?.type === "verse" ? pairedTitleIndex(items, breakIndex) : -1;
  return Math.max(runStart, titleIndex >= 0 ? titleIndex : breakIndex);
}

/**
 * The next items to measure off-screen, nearest the reader first. `measured`
 * is the predicate for an item that needs no measuring (an object of heights
 * by id still works). With `runStart`, whatever the reader's slide needs
 * before it can settle -- its run, from the start, up to the reader's row --
 * comes before anything else; then outward from the row in both directions.
 */
export function getMeasurementBatch(
  items,
  measured,
  limit,
  anchor,
  preferredSectionId,
  maxDistance = Number.POSITIVE_INFINITY,
  runStart = null,
) {
  const isMeasured = typeof measured === "function"
    ? measured
    : (item) => typeof measured[item.id] === "number";
  const missing = items.filter((item) => !isMeasured(item));
  if (!Number.isFinite(maxDistance) && missing.length <= limit) return missing;
  const preferredIndex = getReadingItemIndex(items, anchor, preferredSectionId);

  const prioritized = [];
  const seen = new Set();
  const consider = (index) => {
    const item = items[index];
    if (!item || seen.has(item.id) || isMeasured(item)) return;
    seen.add(item.id);
    prioritized.push(item);
  };
  const start = runStart == null ? preferredIndex : Math.min(Math.max(runStart, 0), preferredIndex);
  for (let index = start; index <= preferredIndex && prioritized.length < limit; index += 1) consider(index);
  const radiusLimit = Math.min(items.length - 1, Math.max(0, maxDistance));
  for (let radius = 1; radius <= radiusLimit && prioritized.length < limit; radius += 1) {
    consider(preferredIndex + radius);
    consider(preferredIndex - radius);
  }
  return prioritized.slice(0, limit);
}

// Widgets that move with the arrow keys themselves (WAI-ARIA's composite
// widgets, and a slider), so a page-turn key pressed in one is theirs.
const ARROW_KEY_WIDGET_SELECTOR = [
  "slider", "spinbutton", "scrollbar", "tab", "tablist", "radio", "radiogroup",
  "menu", "menubar", "menuitem", "menuitemradio", "menuitemcheckbox",
  "listbox", "option", "combobox", "tree", "treeitem", "grid", "gridcell",
].map((role) => `[role="${role}"]`).join(",");
const PRESS_KEYS = [" ", "Spacebar", "Enter"];

/**
 * Whether the focused element keeps this key for itself instead of letting it
 * turn the page. Anything typed into, and any widget that moves with the
 * arrow keys, keeps them all. A button or link keeps only Space and Enter,
 * the keys that press it: the arrows, Page Up/Down, Home and End still turn
 * the page. So a control can be a real button for a screen reader and still
 * not leave a reader -- or a presenter's clicker -- stuck on the slide they
 * were on when they tapped it.
 */
export function isKeyKeptByFocusedControl(target, key) {
  if (!target || typeof target !== "object") return false;
  if (target.isContentEditable) return true;
  const tagName = String(target.tagName || "").toLowerCase();
  if (["input", "select", "textarea"].includes(tagName)) return true;
  if (typeof target.closest === "function" && target.closest(ARROW_KEY_WIDGET_SELECTOR)) return true;
  const role = typeof target.getAttribute === "function" ? target.getAttribute("role") : null;
  const isPressable = tagName === "button" || tagName === "a" || ["button", "link", "switch", "checkbox"].includes(role);
  return isPressable && PRESS_KEYS.includes(key);
}

export function getPageTurnForKey(key) {
  if (["ArrowRight", "ArrowDown", "PageDown", " ", "Spacebar", "Enter"].includes(key)) return "next";
  if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(key)) return "previous";
  if (key === "Home") return "first";
  if (key === "End") return "last";
  return null;
}

export const SLIDESHOW_SWIPE_ACTIVATION_DISTANCE = 36;

export function getPageTurnForSwipe(deltaX) {
  if (
    Number.isFinite(deltaX) &&
    Math.abs(deltaX) >= SLIDESHOW_SWIPE_ACTIVATION_DISTANCE
  ) {
    return deltaX < 0 ? "next" : "previous";
  }
  return null;
}

export function getPageTurnForTap(locationX, width) {
  if (!Number.isFinite(locationX) || !Number.isFinite(width) || width <= 0) return null;
  return locationX < width / 2 ? "previous" : "next";
}

/** Resolve a viewport/page coordinate against the slideshow's real bounds. */
export function getPageTurnForViewportTap(pageX, surfaceLeft, surfaceWidth) {
  if (
    !Number.isFinite(pageX) ||
    !Number.isFinite(surfaceLeft) ||
    !Number.isFinite(surfaceWidth) ||
    surfaceWidth <= 0 ||
    pageX < surfaceLeft ||
    pageX > surfaceLeft + surfaceWidth
  ) {
    return null;
  }
  return getPageTurnForTap(pageX - surfaceLeft, surfaceWidth);
}
