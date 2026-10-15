/**
 * Pure slideshow layout and pagination helpers.
 *
 * Keeping this module free of React and platform imports makes the hardest
 * part of presentation mode deterministic and directly testable. The render
 * components consume these same metrics, so a line that pagination says fits
 * is rendered with the exact font and line-height assumptions used here.
 */

import { DOCUMENT_CONTROL_METRICS, getDocumentChromeMetrics } from "./documentPresentationMetrics.js";

const SPACING_XS = 4;
const SPACING_SM = 8;
const SPACING_XL = 32;
const MIN_USEFUL_FRAGMENT_LINES = 2;

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

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

/** Responsive breathing room which never crowds a short landscape viewport. */
export function getSlidePadding(viewportHeight = 0) {
  if (!viewportHeight) return { bottom: SPACING_SM * 2, top: SPACING_SM * 2 };
  const edge = clamp(Math.floor(viewportHeight * 0.04), SPACING_SM, SPACING_XL);
  return { bottom: edge, top: edge };
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

export function paginateItems(
  items,
  heights,
  languageHeights,
  availableHeight,
  fontSize,
  visibleLanguages,
  tableWidth,
) {
  const safeAvailableHeight = Math.max(Number(availableHeight) || 0, 1);
  const units = buildPaginationUnits(items);
  const slides = [];
  let currentSlide = [];
  let currentHeight = 0;

  const flushSlide = () => {
    if (currentSlide.length) slides.push(currentSlide);
    currentSlide = [];
    currentHeight = 0;
  };

  const placeVerse = (verseItem) => {
    const verseHeight = Math.ceil((heights[verseItem.id] ?? 0) + 2);

    if (currentHeight + verseHeight <= safeAvailableHeight) {
      currentSlide.push(verseItem);
      currentHeight += verseHeight;
      return;
    }

    // A verse that doesn't fit what is left of the slide fills it with as
    // many of its lines as fit and carries on over the page, rather than
    // moving on whole and leaving the foot of the slide empty -- never in a
    // piece of fewer than two lines, either side of the turn.
    //
    // Only lines the platform's own text engine laid out can be turned over
    // like this: a split is rendered line for line exactly as decided here.
    // A verse whose lines are not measured yet moves on whole instead -- a
    // guessed line break on the page reads as words flung across the column
    // -- and its real lines settle the page before it is shown (see
    // isSlideSettled).
    const languageMetric = languageHeights[verseItem.id];

    if (!hasMeasuredVerseLines(languageMetric)) {
      if (currentSlide.length) flushSlide();
      currentSlide.push(verseItem);
      currentHeight += verseHeight;
      return;
    }

    const result = appendTallVerseSegments({
      item: verseItem,
      languageMetric,
      slides,
      currentSlide,
      currentHeight,
      availableHeight: safeAvailableHeight,
      fontSize,
      visibleLanguages,
    });
    currentSlide = result.currentSlide;
    currentHeight = result.currentHeight;
  };

  for (const unit of units) {
    if (currentSlide.length && unit.breakBefore) flushSlide();

    const item = unit.items[0];
    if (item.type === "verse") {
      placeVerse(item);
      continue;
    }

    const itemHeight = Math.ceil((heights[item.id] ?? 0) + 2);
    if (currentSlide.length && currentHeight + itemHeight > safeAvailableHeight) flushSlide();
    currentSlide.push(item);
    currentHeight += itemHeight;
  }

  flushSlide();
  return slides.length ? slides : [[]];
}

function appendTallVerseSegments({
  item,
  languageMetric,
  slides,
  currentSlide,
  currentHeight,
  availableHeight,
  fontSize,
  visibleLanguages,
}) {
  const state = createVerseLineState(languageMetric, fontSize, item);
  let segmentIndex = 0;

  while (hasRemainingVerseLines(state)) {
    const capacityItem = segmentIndex > 0
      ? createContinuationCapacityItem(item)
      : item;
    const remainingHeight = availableHeight - currentHeight;
    let lineCapacities = withoutWidowLines(state, coordinateLineCapacities(state, getIndependentLineCapacities(
      state,
      remainingHeight,
      fontSize,
      capacityItem,
      visibleLanguages,
    )));

    if (currentSlide.length && shouldAvoidTinyFragment(
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

    const segment = createVerseLineSegment(item, state, lineCapacities, segmentIndex);
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

  return { currentSlide, currentHeight };
}

/**
 * Keeps the columns of a split verse in step. Each language's capacity says
 * how many of its own remaining lines would fit; taken independently, the
 * English could finish on this slide while the Coptic carried on alone over
 * the page. Instead every column takes the same share of its remaining lines
 * as the most constrained one (the smallest capacity over remaining lines),
 * so the slide shows the same stretch of the verse in every language, give
 * or take a line, and the remainders turn the page together. Never a single
 * line either side of the turn; and a short column (three lines or fewer) is
 * not chopped: it goes whole on this slide when the limiting column keeps at
 * least half of its lines here, otherwise whole on the next.
 */
export function coordinateLineCapacities(state, capacities) {
  const entries = state.languages
    .filter((entry) => entry.offset < entry.lines.length)
    .map((entry) => ({
      language: entry.language,
      remaining: entry.lines.length - entry.offset,
      capacity: Math.max(0, capacities[entry.language] ?? 0),
    }));
  if (!entries.length) return {};
  if (entries.every((entry) => entry.capacity >= entry.remaining)) return capacities;

  const limiting = entries.reduce((best, entry) =>
    (entry.capacity * best.remaining < best.capacity * entry.remaining ? entry : best));
  const coordinated = {};
  entries.forEach((entry) => {
    let take;
    if (entry.remaining <= 3) {
      const limitingKeepsHalf = limiting.capacity * 2 >= limiting.remaining;
      take = limitingKeepsHalf && entry.capacity >= entry.remaining ? entry.remaining : 0;
    } else {
      take = Math.floor((entry.remaining * limiting.capacity) / limiting.remaining);
      if (entry.remaining - take === 1) take = entry.remaining - 2;
      if (take === 1) take = entry.capacity >= 2 ? 2 : 0;
    }
    coordinated[entry.language] = Math.max(0, Math.min(take, entry.capacity, entry.remaining));
  });
  return coordinated;
}

/**
 * Holds back enough of a column's lines that the turn of the page never
 * leaves it a single line on the next slide.
 */
function withoutWidowLines(state, capacities) {
  const adjusted = { ...capacities };
  for (const entry of state.languages) {
    const remaining = entry.lines.length - entry.offset;
    const capacity = adjusted[entry.language] ?? 0;
    if (capacity > 0 && capacity < remaining && remaining - capacity < MIN_USEFUL_FRAGMENT_LINES) {
      adjusted[entry.language] = Math.max(0, remaining - MIN_USEFUL_FRAGMENT_LINES);
    }
  }
  return adjusted;
}

function createContinuationCapacityItem(item) {
  return {
    ...item,
    suppressSpeakerLabel: true,
    verse: {
      ...item.verse,
      bibleVerseNumber: "",
      slideshowSeasonalPrefixVisible: false,
    },
  };
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
    (largest, entry) => Math.max(largest, entry.lines.length - entry.offset),
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

export function hasMeasuredVerseLines(metric = {}) {
  return ["english", "french", "coptic", "arabic"].some(
    (language) => Array.isArray(metric[language]?.lines) && metric[language].lines.length,
  );
}

function createVerseLineState(languageMetric = {}, fontSize, item = {}) {
  return {
    languages: ["english", "french", "coptic", "arabic"]
      .map((language) => ({
        language,
        lineHeight: getSlideshowLanguageLineHeight(language, item, fontSize),
        lines: getMetricLinesForLanguage(languageMetric[language]?.lines || [], language, item),
        offset: 0,
      }))
      .filter((entry) => entry.lines.length),
  };
}

function hasRemainingVerseLines(state) {
  return state.languages.some((entry) => entry.offset < entry.lines.length);
}

function getIndependentLineCapacities(state, height, fontSize, item, visibleLanguages) {
  const usableHeight =
    height -
    getVerseCommonHeight(item, fontSize, visibleLanguages) -
    getMaxPrefixHeight(state, item, fontSize);
  if (usableHeight <= 0) return {};

  return state.languages
    .filter((entry) => entry.offset < entry.lines.length)
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
    .filter((entry) => entry.offset < entry.lines.length)
    .reduce((capacities, entry) => {
      capacities[entry.language] = 1;
      return capacities;
    }, {});
}

export function createVerseLineSegment(item, state, lineCapacities, segmentIndex) {
  const originalLanguageKeys = state.languages.map((entry) => entry.language);
  const showSeasonalPrefix = segmentIndex === 0 && hasSeasonalPrefixLine(item.verse);
  const verse = {
    ...item.verse,
    arabic: "",
    coptic: "",
    english: "",
    french: "",
    bibleVerseNumber: item.verse?.bibleVerseNumber,
    slideshowSeasonalPrefixVisible: showSeasonalPrefix,
  };
  const lineCounts = {};
  const lineRanges = {};
  const forcedLines = {};
  const bibleNumberLanguages = [];
  const segmentEntries = [];

  state.languages.forEach((entry) => {
    const start = entry.offset;
    const remainingCount = entry.lines.length - start;
    const takeCount = Math.min(lineCapacities[entry.language] || 0, remainingCount);
    const lines = entry.lines.slice(start, start + takeCount);
    if (lines.length) segmentEntries.push({ entry, lines, start });
    entry.offset += takeCount;
  });

  segmentEntries.forEach(({ entry, lines, start }) => {
    const joinedBody = joinRenderedLines(lines);
    const beginsWithBibleNumber = Boolean(item.verse?.bibleVerseNumber) && start === 0;
    const body = beginsWithBibleNumber
      ? joinedBody.replace(/^\S+\s*/, "")
      : joinedBody;
    const prefix = String(item.verse?.seasonalHoosVersePrefix || "").trim();
    const originalText = String(item.verse?.[entry.language] || "").trimStart();
    const shouldPrependPrefix =
      showSeasonalPrefix &&
      (entry.language === "english" || entry.language === "arabic") &&
      prefix &&
      originalText.startsWith(prefix);

    verse[entry.language] = shouldPrependPrefix
      ? `${prefix}${body ? `\n${body}` : ""}`
      : body;
    lineCounts[entry.language] = lines.length;
    lineRanges[entry.language] = { start, end: start + lines.length };
    forcedLines[entry.language] = lines;
    if (beginsWithBibleNumber) bibleNumberLanguages.push(entry.language);
  });

  verse.slideshowLanguageKeys = originalLanguageKeys;
  verse.slideshowForcedLines = forcedLines;
  verse.slideshowBibleNumberLanguages = bibleNumberLanguages;
  const sourceItemId = item.sourceItemId || item.id;

  return {
    item: {
      ...item,
      id: segmentIndex ? `${sourceItemId}-segment-${segmentIndex}` : sourceItemId,
      slideId: `${sourceItemId}-segment-${segmentIndex}`,
      sourceItemId,
      suppressSpeakerLabel: Boolean(item.suppressSpeakerLabel) || segmentIndex > 0,
      verse,
      slideshowLineCounts: lineCounts,
      slideshowLineRanges: lineRanges,
      slideshowSegmentIndex: segmentIndex,
    },
  };
}

function createVerseDecorationSegment(item, state) {
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
    const minimumHeight = item.isHyperlink
      ? DOCUMENT_CONTROL_METRICS.hyperlinkMinHeight
      : DOCUMENT_CONTROL_METRICS.openButtonMinHeight;
    const lineHeight = item.isHyperlink
      ? chrome.hyperlinkLineHeight
      : chrome.buttonLineHeight;
    const contentHeight = item.isHyperlink
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
 * item: the justified columns that have text. Those are the only ones a slide
 * can split, and a split is rendered from exactly these lines.
 */
export function getLanguagesNeedingLineMetrics(item, visibleLanguages = {}) {
  if (item?.type !== "verse") return [];
  const verse = item.verse || {};
  return getVisibleVerseLanguages(item, visibleLanguages).filter((language) =>
    isSlideshowLanguageJustified(verse, language) && Boolean(String(verse[language] || "").trim()));
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
  }));
  return {
    ...metric,
    lines,
    lineSignature: lines.map((line) => `${line.text}${line.isParagraphEnd ? "¶" : ""}`).join("\n"),
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
  const offsets = Object.fromEntries(
    Object.entries(item.slideshowLineRanges || {}).map(([language, range]) => [language, range.start]),
  );
  const primaryLanguage = Object.keys(offsets)[0] || null;
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
  slides.forEach((slide, index) => {
    slide.forEach((item) => {
      const distance = anchorDistance(item, anchor);
      if (distance < bestDistance) {
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
  return `${first?.slideId || getSourceItemId(first) || "empty"}:${last?.slideId || getSourceItemId(last) || "empty"}:${index}`;
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
  const matchedIndex = items.findIndex((item) =>
    (anchor?.sourceItemId && getSourceItemId(item) === anchor.sourceItemId) ||
    (preferredSectionId && item.sectionId === preferredSectionId),
  );
  return matchedIndex >= 0 ? matchedIndex : 0;
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
export function isSlideSettled(items, slides, slideIndex, isMeasured, itemIndexById) {
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
  for (let index = getPaginationRunStart(items, firstIndex); index <= end; index += 1) {
    if (!isMeasured(items[index])) return false;
  }
  return true;
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
