import assert from "node:assert/strict";
import test from "node:test";

import {
  createEstimatedTextLines,
  createSlideAnchor,
  createVerseLineSegment,
  findSlideIndexForAnchor,
  getAdjacentSlideIndexes,
  getItemSignature,
  getMeasurementBatch,
  getPageTurnForKey,
  getPageTurnForSwipe,
  getPageTurnForTap,
  getPageTurnForViewportTap,
  getSlideContentBudget,
  getSlidePadding,
  getSlideRenderLayers,
  getSlideshowChromeMetrics,
  getSlideshowLanguageFontSize,
  getSlideshowLanguageLineHeight,
  getVerseLineSegmentHeight,
  getVisibleVerseLanguages,
  hasRenderableSlideshowLanguageBody,
  hashSlideshowText,
  isKeyKeptByFocusedControl,
  joinRenderedLines,
  paginateItems,
} from "../src/components/vine/slideshowLayout.js";
import {
  getAlternatingVerseColorIndex,
  getEffectiveAlternatingVerseIndex,
} from "../src/utils/versePresentation.js";

const ALL_LANGUAGES = {
  english: true,
  coptic: true,
  copticRecitedPrayers: true,
  arabic: true,
};

function verseItem(overrides = {}) {
  return {
    id: "section-verse-0",
    sectionId: "section",
    type: "verse",
    hasSpeakerLabel: false,
    suppressSpeakerLabel: false,
    verse: {
      english: "Alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu",
      coptic: "ⲁ̅ ⲃ̅ ⲅ̅ ⲇ̅ ⲉ̅ ⲍ̅ ⲏ̅ ⲑ̅ ⲓ̅ ⲕ̅ ⲗ̅ ⲙ̅",
      arabic: "وَاحِدٌ اثنان ثلاثة أربعة خمسة ستة سبعة ثمانية تسعة عشرة",
      type: "priest",
    },
    ...overrides,
  };
}

function metricLines(prefix, count) {
  return Array.from({ length: count }, (_, index) => ({
    text: `${index === 0 ? "12 " : ""}${prefix}${index + 1}`,
    isParagraphEnd: index === count - 1,
  }));
}

function splitVerse(item, { availableHeight = 360, fontSize = 78, lineCount = 8 } = {}) {
  const metric = {
    english: { lines: metricLines("English", lineCount) },
    coptic: { lines: metricLines("ⲕⲟⲡⲧ", lineCount) },
    arabic: { lines: metricLines("عربي", lineCount) },
  };
  const slides = paginateItems(
    [item],
    { [item.id]: 9999 },
    { [item.id]: metric },
    availableHeight,
    fontSize,
    ALL_LANGUAGES,
    1024,
  );
  return { metric, slides, segments: slides.flat() };
}

test("content signatures invalidate equal-length replacements and title-language changes", () => {
  const first = verseItem();
  const second = verseItem({ verse: { ...first.verse, english: "Omega beta gamma delta epsilon zeta eta theta iota kappa lambda mu" } });
  assert.equal(first.verse.english.length, second.verse.english.length);
  assert.notEqual(getItemSignature(first), getItemSignature(second));

  const title = { id: "title", type: "title", title: { english: "Prayer", arabic: "صلاة" } };
  assert.notEqual(getItemSignature(title, "english:Prayer"), getItemSignature(title, "arabic:صلاة"));
  assert.notEqual(hashSlideshowText("same-A"), hashSlideshowText("same-B"));
});

test("responsive padding never creates a budget taller than the viewport", () => {
  [120, 240, 568, 900, 2160].forEach((height) => {
    const padding = getSlidePadding(height);
    const budget = getSlideContentBudget(height, padding);
    assert.ok(budget > 0);
    assert.ok(budget + padding.top + padding.bottom <= height);
  });
});

test("overlay insets never change slideshow padding or page formation", () => {
  [320, 568, 900].forEach((height) => {
    const withoutOverlay = getSlidePadding(height);
    const withOversizedOverlay = getSlidePadding(height, height * 0.75);
    assert.deepEqual(withOversizedOverlay, withoutOverlay);
    assert.equal(
      getSlideContentBudget(height, withOversizedOverlay),
      getSlideContentBudget(height, withoutOverlay),
    );
  });
});

test("maximum-size language metrics leave room for Arabic and Coptic marks", () => {
  const item = verseItem();
  assert.equal(getSlideshowLanguageLineHeight("english", item, 78), 101);
  assert.equal(getSlideshowLanguageLineHeight("coptic", item, 78), 101);
  assert.equal(getSlideshowLanguageLineHeight("arabic", item, 78), 125);
  assert.deepEqual(getSlideshowChromeMetrics(78), {
    buttonFontSize: 51,
    buttonLineHeight: 62,
    hyperlinkFontSize: 43,
    hyperlinkLineHeight: 52,
    speakerFontSize: 78,
    speakerLineHeight: 101,
    titleFontSize: 39,
    titleLineHeight: 48,
  });
  assert.equal(getSlideshowLanguageFontSize('english', { verse: { type: 'refrainLabel' } }, 78), 78);
  assert.equal(getSlideshowLanguageLineHeight('english', { verse: { type: 'refrainLabel' } }, 78), 101);
});

test("explicit paragraph breaks survive measurement, joining, and page splitting", () => {
  const lines = createEstimatedTextLines("First paragraph\nSecond paragraph\n\nFourth paragraph", 80);
  assert.deepEqual(lines.map((line) => line.isParagraphEnd), [true, true, true, true]);
  assert.equal(joinRenderedLines(lines), "First paragraph\nSecond paragraph\n\nFourth paragraph");
});

test("a tall multilingual verse loses or duplicates no measured lines", () => {
  const item = verseItem({ hasSpeakerLabel: true });
  const { metric, segments } = splitVerse(item);
  assert.ok(segments.length > 2);

  ["english", "coptic", "arabic"].forEach((language) => {
    const rendered = segments.flatMap((segment) => segment.verse.slideshowForcedLines[language] || []);
    assert.deepEqual(rendered, metric[language].lines);
  });
});

test("every normal maximum-font verse segment fits its slide budget", () => {
  [320, 568, 900].forEach((viewportHeight) => {
    const padding = getSlidePadding(viewportHeight);
    const budget = getSlideContentBudget(viewportHeight, padding);
    const item = verseItem({ hasSpeakerLabel: true });
    const { segments } = splitVerse(item, { availableHeight: budget, fontSize: 78, lineCount: 12 });
    segments.forEach((segment) => {
      assert.ok(
        getVerseLineSegmentHeight({ item: segment }, 78, ALL_LANGUAGES) <= budget,
        `segment exceeded ${budget}px budget at ${viewportHeight}px viewport`,
      );
    });
  });
});

test("seasonal prefix appears once and Bible numbers stay on each language's first segment", () => {
  const prefix = "Watos";
  const item = verseItem({
    hasSpeakerLabel: true,
    verse: {
      ...verseItem().verse,
      bibleVerseNumber: "12",
      seasonalHoosVersePrefix: prefix,
      english: `${prefix} ${verseItem().verse.english}`,
      arabic: `${prefix} ${verseItem().verse.arabic}`,
    },
  });
  const { segments } = splitVerse(item, { availableHeight: 380 });
  assert.equal(segments.filter((segment) => segment.verse.slideshowSeasonalPrefixVisible).length, 1);
  assert.equal(segments.filter((segment) => segment.verse.english.startsWith(prefix)).length, 1);

  ["english", "coptic", "arabic"].forEach((language) => {
    assert.equal(
      segments.filter((segment) => segment.verse.slideshowBibleNumberLanguages.includes(language)).length,
      1,
    );
  });
});

test("seasonal decorations split safely on a short max-font landscape slide", () => {
  const item = verseItem({
    hasSpeakerLabel: true,
    verse: {
      ...verseItem().verse,
      seasonalHoosVersePrefix: "Watos",
      english: `Watos ${verseItem().verse.english}`,
      arabic: `Watos ${verseItem().verse.arabic}`,
    },
  });
  const viewportHeight = 320;
  const budget = getSlideContentBudget(viewportHeight, getSlidePadding(viewportHeight));
  const { segments } = splitVerse(item, { availableHeight: budget, fontSize: 78, lineCount: 8 });
  segments.forEach((segment) => {
    assert.ok(getVerseLineSegmentHeight({ item: segment }, 78, ALL_LANGUAGES) <= budget);
  });
  assert.equal(segments.filter((segment) => segment.verse.slideshowSeasonalPrefixVisible).length, 1);
});

test("a tall verse after something that is not its title starts fresh instead of leaving a one-line orphan", () => {
  const before = verseItem({ id: "before", sectionId: "before", verse: { english: "Short", type: "priest" } });
  const item = verseItem();
  const metric = {
    english: { lines: metricLines("English", 8) },
    coptic: { lines: metricLines("ⲕⲟⲡⲧ", 8) },
    arabic: { lines: metricLines("عربي", 8) },
  };
  const slides = paginateItems(
    [before, item],
    { [before.id]: 210, [item.id]: 9999 },
    { [item.id]: metric },
    360,
    78,
    ALL_LANGUAGES,
    1024,
  );
  assert.deepEqual(slides[0].map((entry) => entry.id), [before.id]);
  assert.equal(slides[1][0].sourceItemId, item.id);
});

test("the Antiphonary's Vatos half opens its own slide", () => {
  const tuned = (index, tune) => verseItem({ id: `entry-verse-${index}`, sectionId: "entry", verse: { ...verseItem().verse, tune } });
  const items = [tuned(0, "adam"), tuned(1, "adam"), tuned(2, "vatos"), tuned(3, "vatos")];
  const heights = Object.fromEntries(items.map((item) => [item.id, 40]));
  const slides = paginateItems(items, heights, {}, 1000, 18, ALL_LANGUAGES, 1024);
  assert.deepEqual(slides.map((slide) => slide.map((entry) => entry.id)), [
    ["entry-verse-0", "entry-verse-1"],
    ["entry-verse-2", "entry-verse-3"],
  ]);
});

test("a run of buttons shares a slide while they fit, and still opens a fresh one", () => {
  const button = (index) => ({ id: `go-${index}-button`, sectionId: `go-${index}`, type: "button", title: { english: `Go ${index}` } });
  const items = [verseItem({ id: "entry-verse-0", sectionId: "entry" }), button(0), button(1), button(2)];
  const heights = Object.fromEntries(items.map((item) => [item.id, 120]));
  const fit = paginateItems(items, heights, {}, 1000, 18, ALL_LANGUAGES, 1024);
  assert.deepEqual(fit.map((slide) => slide.map((entry) => entry.id)), [
    ["entry-verse-0"],
    ["go-0-button", "go-1-button", "go-2-button"],
  ]);
  // Only as many as the slide holds: the rest carry over.
  const tight = paginateItems(items, heights, {}, 260, 18, ALL_LANGUAGES, 1024);
  assert.deepEqual(tight.map((slide) => slide.map((entry) => entry.id)), [
    ["entry-verse-0"],
    ["go-0-button", "go-1-button"],
    ["go-2-button"],
  ]);
});

test("a headpiece always opens a slide and keeps what follows; the Medallion stays with the last words and ends its slide", () => {
  const verse = (id) => verseItem({ id, sectionId: id });
  const headpiece = { id: "hoos-title", sectionId: "hoos", type: "title", isCollapsed: true, collapsible: true, ornament: "lintel", title: { english: "The First Hoos" } };
  const button = { id: "midnight-hour-button", sectionId: "midnight-hour", type: "button", title: { english: "Midnight Hour" } };
  const medallion = { id: "document-end-medallion", sectionId: "document-end", type: "ornament", ornament: "medallion" };
  const next = { id: "next-button", sectionId: "next", type: "button", isHyperlink: true, title: { english: "Morning Doxology" } };
  const items = [verse("before"), headpiece, button, verse("after"), verse("last"), medallion, next];
  const heights = Object.fromEntries(items.map((item) => [item.id, 60]));
  const slides = paginateItems(items, heights, {}, 1000, 18, ALL_LANGUAGES, 1024);
  assert.deepEqual(slides.map((slide) => slide.map((entry) => entry.id)), [
    ["before"],
    // Even a collapsible headpiece opens a slide, and the button after it stays on it.
    ["hoos-title", "midnight-hour-button", "after", "last", "document-end-medallion"],
    ["next-button"],
  ]);
});

test("a band or divider sits with what comes either side of it", () => {
  const title = { id: "next-title", sectionId: "next", type: "title", title: { english: "Next" } };
  const divider = { id: "divider", sectionId: "divider", type: "ornament", ornament: "divider" };
  const items = [verseItem({ id: "before", sectionId: "before" }), divider, title];
  const heights = Object.fromEntries(items.map((item) => [item.id, 60]));
  const slides = paginateItems(items, heights, {}, 1000, 18, ALL_LANGUAGES, 1024);
  assert.deepEqual(slides.map((slide) => slide.map((entry) => entry.id)), [["before", "divider", "next-title"]]);
});

test("a verse that doesn't fit moves on whole; only one taller than a slide is turned over the page, from a fresh slide", () => {
  const first = verseItem({ id: "first", sectionId: "first", verse: { english: "", type: "priest" } });
  const second = verseItem({ id: "second", sectionId: "second" });
  const lines = (count) => ({ english: { lines: metricLines("English", count) } });
  const english = { english: true, french: false, coptic: false, arabic: false };
  const lineHeight = getSlideshowLanguageLineHeight("english", second, 18);
  const budget = 1000;
  const lineCount = (entry) => (entry.verse.english.match(/English\d+/g) || []).length;
  // The first verse leaves room for five of the second's six lines: the second goes whole to the next slide.
  const slides = paginateItems([first, second], { first: budget - lineHeight * 5 - 40, second: lineHeight * 6 + 40 }, { second: lines(6) }, budget, 18, english, 1024);
  assert.deepEqual(slides.map((slide) => slide.map(lineCount)), [[0], [6]]);
  assert.equal(slides[1][0].verse.slideshowForcedLines.english.length, 6);
  // A verse of forty lines, taller than any slide, is turned over in pieces that each fit, from a fresh slide,
  // never leaving a single line either side of a turn.
  const giant = paginateItems([first, second], { first: 100, second: lineHeight * 40 + 40 }, { second: lines(40) }, 400, 18, english, 1024);
  assert.deepEqual(giant[0].map((entry) => entry.id), ["first"]);
  const pieces = giant.slice(1).map((slide) => slide.map(lineCount));
  assert.ok(pieces.length > 1 && pieces.every((slide) => slide.length === 1));
  assert.equal(pieces.flat().reduce((sum, count) => sum + count, 0), 40);
  pieces.flat().forEach((count) => assert.ok(count >= 2 && count * lineHeight <= 400, `piece of ${count} lines`));
});

test("line anchors follow the same content when page capacity changes", () => {
  const item = verseItem();
  const before = splitVerse(item, { availableHeight: 320, lineCount: 15 }).slides;
  const anchor = createSlideAnchor(before[Math.min(2, before.length - 1)]);
  const after = splitVerse(item, { availableHeight: 520, lineCount: 15 }).slides;
  const resolved = findSlideIndexForAnchor(after, anchor);
  assert.ok(resolved >= 0);
  const range = after[resolved][0].slideshowLineRanges.english;
  assert.ok(anchor.offsets.english >= range.start && anchor.offsets.english < range.end);
});

test("measurement prioritizes the reader's current row instead of restarting at the top", () => {
  const items = Array.from({ length: 100 }, (_, index) => ({ id: `row-${index}`, sectionId: `section-${index}` }));
  const batch = getMeasurementBatch(items, {}, 8, { sourceItemId: "row-80" }, null);
  assert.equal(batch[0].id, "row-80");
  assert.ok(batch.every((item) => Math.abs(Number(item.id.slice(4)) - 80) <= 4));
});

test("a finished translation stays truly empty on later continuation slides", () => {
  const item = verseItem({
    verse: {
      ...verseItem().verse,
      bibleVerseNumber: "1",
    },
  });
  const state = {
    languages: [
      { language: "english", lines: metricLines("English", 3), offset: 0 },
      { language: "coptic", lines: metricLines("Coptic", 1), offset: 0 },
      { language: "arabic", lines: metricLines("Arabic", 3), offset: 0 },
    ],
  };

  createVerseLineSegment(item, state, { english: 1, coptic: 1, arabic: 1 }, 0);
  const continuation = createVerseLineSegment(item, state, { english: 1, arabic: 1 }, 1).item;

  assert.equal(continuation.verse.coptic, "");
  assert.equal(continuation.verse.slideshowForcedLines.coptic, undefined);
  assert.equal(continuation.verse.slideshowBibleNumberLanguages.includes("coptic"), false);
  assert.deepEqual(continuation.verse.slideshowLanguageKeys, ["english", "coptic", "arabic"]);
});

test("an empty continuation cell ignores stale native line content", () => {
  assert.equal(hasRenderableSlideshowLanguageBody({
    text: "",
    forceLines: [{ text: "I" }],
  }), false);
  assert.equal(hasRenderableSlideshowLanguageBody({ text: "I" }), true);
});

test("scroll and slideshow share one alternating-color sequence", () => {
  const section = {
    alternateEvery: 1,
    verses: [
      { type: "priest" },
      { type: "readingReference" },
      { type: "people" },
      { type: "silentPrayer" },
      { type: "deacon" },
      { type: "priest", prayerType: "White" },
      { type: "people" },
    ],
  };

  assert.deepEqual(
    section.verses.map((_, index) => getEffectiveAlternatingVerseIndex(section.verses, index)),
    [0, 0, 1, 1, 2, 2, 3],
  );
  assert.deepEqual(
    section.verses.map((_, index) => getAlternatingVerseColorIndex(section, index)),
    [0, 0, 1, 1, 0, 0, 1],
  );
  assert.equal(getAlternatingVerseColorIndex({ ...section, forceWhiteVerses: true }, 6), 0);
});

test("measurement can stop outside the active reading window", () => {
  const items = Array.from({ length: 500 }, (_, index) => ({ id: `row-${index}`, sectionId: `section-${index}` }));
  const nearby = getMeasurementBatch(items, {}, 20, { sourceItemId: "row-250" }, null, 12);
  assert.equal(nearby.length, 20);
  assert.ok(nearby.every((item) => Math.abs(Number(item.id.slice(4)) - 250) <= 12));

  const measuredNearby = Object.fromEntries(
    items
      .filter((_, index) => Math.abs(index - 250) <= 12)
      .map((item) => [item.id, 40]),
  );
  assert.deepEqual(
    getMeasurementBatch(items, measuredNearby, 20, { sourceItemId: "row-250" }, null, 12),
    [],
  );
});

test("speaker-only visible columns remain in the aligned layout", () => {
  const item = verseItem({
    hasSpeakerLabel: true,
    verse: { ...verseItem().verse, english: "", arabic: "" },
  });
  assert.deepEqual(getVisibleVerseLanguages(item, ALL_LANGUAGES), ["english", "coptic", "arabic"]);
});

test("tap, keyboard, clicker, and adjacent-page controls are deterministic", () => {
  assert.equal(getPageTurnForTap(10, 100), "previous");
  assert.equal(getPageTurnForTap(90, 100), "next");
  assert.equal(getPageTurnForViewportTap(510, 320, 400), "previous");
  assert.equal(getPageTurnForViewportTap(690, 320, 400), "next");
  assert.equal(getPageTurnForViewportTap(0, 320, 400), null);
  assert.equal(getPageTurnForSwipe(-36), "next");
  assert.equal(getPageTurnForSwipe(36), "previous");
  assert.equal(getPageTurnForSwipe(-20), null);
  assert.equal(getPageTurnForKey("PageDown"), "next");
  assert.equal(getPageTurnForKey(" "), "next");
  assert.equal(getPageTurnForKey("ArrowUp"), "previous");
  assert.equal(getPageTurnForKey("Home"), "first");
  assert.equal(getPageTurnForKey("End"), "last");
  assert.equal(getPageTurnForKey("Escape"), null);
  assert.deepEqual(getAdjacentSlideIndexes(4, 10), [3, 4, 5]);
  assert.deepEqual(getAdjacentSlideIndexes(0, 1), [0]);
});

test("a focused button keeps only the keys that press it; the rest still turn the page", () => {
  const element = (tagName, role = null, insideArrowKeyWidget = false) => ({
    tagName,
    isContentEditable: false,
    getAttribute: (name) => (name === "role" ? role : null),
    closest: () => (insideArrowKeyWidget || ["slider", "tab", "menuitem"].includes(role) ? {} : null),
  });
  for (const pill of [element("BUTTON"), element("DIV", "button"), element("A")]) {
    for (const key of ["ArrowRight", "ArrowLeft", "PageDown", "PageUp", "Home", "End"]) {
      assert.equal(isKeyKeptByFocusedControl(pill, key), false, key);
    }
    assert.equal(isKeyKeptByFocusedControl(pill, "Enter"), true);
    assert.equal(isKeyKeptByFocusedControl(pill, " "), true);
  }
  // Typed into, or moved through with the arrows: every key is theirs.
  for (const control of [element("INPUT"), element("TEXTAREA"), element("DIV", "slider"), element("BUTTON", "tab"), element("BUTTON", null, true)]) {
    assert.equal(isKeyKeptByFocusedControl(control, "ArrowRight"), true);
  }
  assert.equal(isKeyKeptByFocusedControl({ tagName: "DIV", isContentEditable: true }, "ArrowRight"), true);
  assert.equal(isKeyKeptByFocusedControl(element("DIV"), "Enter"), false);
  assert.equal(isKeyKeptByFocusedControl(null, "Enter"), false);
});

test("the visible native slide stays in flex flow while neighbors preload as overlays", () => {
  assert.deepEqual(getSlideRenderLayers(4, 10), [
    { index: 4, inFlow: true },
    { index: 3, inFlow: false },
    { index: 5, inFlow: false },
  ]);
  assert.deepEqual(getSlideRenderLayers(0, 1), [
    { index: 0, inFlow: true },
  ]);
});

test("a maximum-font decoration page cannot trap forward navigation", () => {
  const decorationPage = [{
    id: "offering-row",
    sourceItemId: "offering-row",
    sectionId: "offering-of-the-lamb",
    slideshowLineRanges: {},
    slideshowSegmentIndex: 0,
  }];
  const firstTextPage = [{
    id: "offering-row-segment-1",
    sourceItemId: "offering-row",
    sectionId: "offering-of-the-lamb",
    slideshowLineRanges: { english: { start: 0, end: 1 } },
    slideshowSegmentIndex: 1,
  }];
  const slides = [decorationPage, firstTextPage];

  assert.equal(findSlideIndexForAnchor(slides, createSlideAnchor(decorationPage)), 0);
  assert.equal(findSlideIndexForAnchor(slides, createSlideAnchor(firstTextPage)), 1);
});

test("every continuation-page anchor resolves to that page, not the previous segment", () => {
  const slides = [0, 3, 6, 9].map((start, segmentIndex) => [{
    id: `long-row-segment-${segmentIndex}`,
    sourceItemId: "long-row",
    sectionId: "offering-of-the-lamb",
    slideshowLineRanges: { english: { start, end: start + 3 } },
    slideshowSegmentIndex: segmentIndex,
  }]);

  slides.forEach((slide, index) => {
    assert.equal(findSlideIndexForAnchor(slides, createSlideAnchor(slide)), index);
  });
});

test("all generated slides round-trip through anchors across sizes and languages", () => {
  const languageSets = [
    { english: true, coptic: false, copticRecitedPrayers: true, arabic: false },
    { english: false, coptic: true, copticRecitedPrayers: true, arabic: false },
    { english: false, coptic: false, copticRecitedPrayers: true, arabic: true },
    ALL_LANGUAGES,
  ];
  let checkedSlides = 0;

  for (const fontSize of [14, 24, 40, 58, 78]) {
    for (const availableHeight of [160, 240, 320, 480, 720]) {
      for (const visibleLanguages of languageSets) {
        for (const hasSpeakerLabel of [false, true]) {
          const item = verseItem({ hasSpeakerLabel });
          const lines = 24;
          const metric = {
            english: { lines: metricLines("English", lines) },
            coptic: { lines: metricLines("ⲕⲟⲡⲧ", lines) },
            arabic: { lines: metricLines("عربي", lines) },
          };
          const slides = paginateItems(
            [item],
            { [item.id]: 99999 },
            { [item.id]: metric },
            availableHeight,
            fontSize,
            visibleLanguages,
            1024,
          );

          slides.forEach((slide, index) => {
            assert.equal(
              findSlideIndexForAnchor(slides, createSlideAnchor(slide)),
              index,
              `anchor mismatch at font=${fontSize}, height=${availableHeight}, speaker=${hasSpeakerLabel}, slide=${index}`,
            );
            checkedSlides += 1;
          });
        }
      }
    }
  }

  assert.ok(checkedSlides > 1000, `expected broad coverage, checked ${checkedSlides} slides`);
});

test("anchors remain monotonic and on-source across broad repagination changes", () => {
  const heights = [180, 260, 360, 540];
  const languageSets = [
    { english: true, coptic: false, copticRecitedPrayers: true, arabic: false },
    ALL_LANGUAGES,
  ];
  let checkedMoves = 0;

  for (const fontSize of [14, 40, 78]) {
    for (const visibleLanguages of languageSets) {
      for (const hasSpeakerLabel of [false, true]) {
        const item = verseItem({ hasSpeakerLabel });
        const metric = {
          english: { lines: metricLines("English", 30) },
          coptic: { lines: metricLines("ⲕⲟⲡⲧ", 30) },
          arabic: { lines: metricLines("عربي", 30) },
        };
        const paginateAt = (availableHeight) => paginateItems(
          [item],
          { [item.id]: 99999 },
          { [item.id]: metric },
          availableHeight,
          fontSize,
          visibleLanguages,
          1024,
        );

        for (const beforeHeight of heights) {
          const before = paginateAt(beforeHeight);
          for (const afterHeight of heights) {
            const after = paginateAt(afterHeight);
            const previousResolvedIndexByLanguage = new Map();
            before.forEach((slide) => {
              const anchor = createSlideAnchor(slide);
              const resolvedIndex = findSlideIndexForAnchor(after, anchor);
              assert.ok(resolvedIndex >= 0);
              const previousResolvedIndex = previousResolvedIndexByLanguage.get(anchor.primaryLanguage) ?? -1;
              assert.ok(
                resolvedIndex >= previousResolvedIndex,
                `anchor moved backward within ${anchor.primaryLanguage}: font=${fontSize}, ${beforeHeight}->${afterHeight}`,
              );
              previousResolvedIndexByLanguage.set(anchor.primaryLanguage, resolvedIndex);
              const resolvedItem = after[resolvedIndex].find(
                (entry) => (entry.sourceItemId || entry.id) === anchor.sourceItemId,
              );
              assert.ok(resolvedItem);

              const anchoredLanguages = Object.entries(anchor.offsets);
              // Independently paginated language columns can acquire
              // different page boundaries after a resize. The first visible
              // language is the stable reading-position anchor; remaining
              // columns are tie-breakers.
              if (anchoredLanguages.length) {
                const range = resolvedItem.slideshowLineRanges[anchor.primaryLanguage];
                const offset = anchor.offsets[anchor.primaryLanguage];
                assert.ok(
                  range && offset >= range.start && offset < range.end,
                  `lost primary line: font=${fontSize}, ${beforeHeight}->${afterHeight}`,
                );
              }
              checkedMoves += 1;
            });
          }
        }
      }
    }
  }

  assert.ok(checkedMoves > 1000, `expected broad repagination coverage, checked ${checkedMoves} moves`);
});

test("viewport tap direction remains correct across inset surface sizes", () => {
  for (const width of [240, 320, 768, 1400]) {
    for (const left of [0, 24, 180, 420]) {
      assert.equal(getPageTurnForViewportTap(left + width * 0.25, left, width), "previous");
      assert.equal(getPageTurnForViewportTap(left + width * 0.75, left, width), "next");
    }
  }
});

// ---- Text on a slide is never laid out from a guess ----

import {
  getReadingItemIndex,
  independentLineTakes,
  getSlideKey,
  getLanguagesNeedingLineMetrics,
  getPaginationRunStart,
  isSlideSettled,
  isSlideshowItemMeasured,
  isSlideshowLanguageJustified,
} from "../src/components/vine/slideshowLayout.js";

test("a verse whose lines are not measured is never split: it moves on whole, with no forced lines", () => {
  const first = verseItem({ id: "first", sectionId: "first" });
  const tall = verseItem({ id: "tall", sectionId: "tall" });
  // The first verse leaves room for half of the second; the second has only an estimated height, no lines.
  const slides = paginateItems([first, tall], { first: 600, tall: 800 }, {}, 1000, 18, ALL_LANGUAGES, 1024);
  assert.deepEqual(slides.map((slide) => slide.map((entry) => entry.id)), [["first"], ["tall"]]);
  slides.flat().forEach((entry) => {
    assert.equal(entry.verse.slideshowForcedLines, undefined);
    assert.equal(entry.slideshowLineRanges, undefined);
  });
  // Even a verse taller than a whole slide waits whole for its lines.
  const giant = paginateItems([tall], { tall: 5000 }, {}, 1000, 18, ALL_LANGUAGES, 1024);
  assert.deepEqual(giant.map((slide) => slide.map((entry) => entry.id)), [["tall"]]);
  assert.equal(giant[0][0].verse.slideshowForcedLines, undefined);
});

test("whatever is measured, forced lines only ever come from measured lines", () => {
  const items = Array.from({ length: 12 }, (_, index) => verseItem({ id: `v${index}`, sectionId: "one" }));
  const measuredLines = { english: { lines: metricLines("English", 9) }, coptic: { lines: metricLines("ⲕⲟⲡⲧ", 11) }, arabic: { lines: metricLines("عربي", 7) } };
  for (let mask = 0; mask < 1 << items.length; mask += 97) {
    const languageHeights = {};
    const heights = {};
    items.forEach((item, index) => {
      heights[item.id] = 180 + (index * 37) % 400;
      if (mask & (1 << index)) languageHeights[item.id] = measuredLines;
    });
    const slides = paginateItems(items, heights, languageHeights, 500, 18, ALL_LANGUAGES, 1024);
    slides.flat().forEach((entry) => {
      const source = entry.sourceItemId || entry.id;
      if (!languageHeights[source]) {
        assert.equal(entry.verse.slideshowForcedLines, undefined, `${source} was split without measured lines (mask ${mask})`);
        assert.equal(entry.id, source);
      }
    });
    // Every measured verse that was split still renders all of its lines, once, in order.
    items.filter((item) => languageHeights[item.id]).forEach((item) => {
      const segments = slides.flat().filter((entry) => (entry.sourceItemId || entry.id) === item.id);
      if (segments.length < 2) return;
      ["english", "coptic", "arabic"].forEach((language) => {
        const rendered = segments.flatMap((segment) => segment.verse.slideshowForcedLines?.[language] || []);
        assert.deepEqual(rendered, measuredLines[language].lines, `${item.id} ${language} lost lines (mask ${mask})`);
      });
    });
  }
});

// ---- Each column of a tall verse shows as much of itself as fits ----

function lineState(counts, offsets = {}) {
  return {
    languages: Object.entries(counts).map(([language, count]) => ({
      language,
      lineHeight: 24,
      lines: metricLines(language, count),
      offset: offsets[language] || 0,
      end: count,
    })),
  };
}

test("each column takes as many of its own lines as fit, whatever the others do", () => {
  assert.deepEqual(
    independentLineTakes(lineState({ english: 14, coptic: 10, arabic: 6 }), { english: 11, coptic: 11, arabic: 9 }),
    { english: 11, coptic: 10, arabic: 6 },
  );
  // Never a single line left over for the next slide.
  assert.deepEqual(
    independentLineTakes(lineState({ english: 12, arabic: 4 }), { english: 11, arabic: 3 }),
    { english: 10, arabic: 2 },
  );
  // Columns already finished are left out; a column with no room takes nothing.
  assert.deepEqual(
    independentLineTakes(lineState({ english: 6, coptic: 6 }, { english: 6 }), { english: 9, coptic: 0 }),
    { coptic: 0 },
  );
});

test("a verse split across slides lets each column run at its own pace", () => {
  const item = verseItem({ id: "psalm", sectionId: "psalm" });
  const metric = {
    english: { lines: metricLines("English", 20) },
    coptic: { lines: metricLines("ⲕⲟⲡⲧ", 12) },
    arabic: { lines: metricLines("عربي", 6) },
  };
  const fontSize = 18;
  const lineHeight = getSlideshowLanguageLineHeight("coptic", item, fontSize);
  const slides = paginateItems([item], { psalm: 9999 }, { psalm: metric }, lineHeight * 8 + 40, fontSize, ALL_LANGUAGES, 1024);
  assert.ok(slides.length >= 2);
  // The Arabic finishes on the first slide; the English carries on alone at the end.
  assert.equal(slides[0][0].slideshowLineCounts.arabic, 6);
  assert.equal(slides[slides.length - 1][0].slideshowLineCounts.arabic ?? 0, 0);
  assert.ok(slides[slides.length - 1][0].slideshowLineCounts.english > 0);
  ["english", "coptic", "arabic"].forEach((language) => {
    assert.deepEqual(slides.flatMap((slide) => slide[0].verse.slideshowForcedLines[language] || []), metric[language].lines);
  });
});

// ---- What counts as measured, and when a slide is settled ----

test("an item is measured only once its height and the lines of every column that could be split are known", () => {
  const item = verseItem();
  assert.deepEqual(getLanguagesNeedingLineMetrics(item, ALL_LANGUAGES), ["english", "coptic", "arabic"]);
  assert.equal(isSlideshowItemMeasured(item, {}, {}, ALL_LANGUAGES), false);
  assert.equal(isSlideshowItemMeasured(item, { [item.id]: 120 }, {}, ALL_LANGUAGES), false);
  const partial = { [item.id]: { english: { lines: metricLines("E", 2) }, coptic: { lines: metricLines("C", 2) } } };
  assert.equal(isSlideshowItemMeasured(item, { [item.id]: 120 }, partial, ALL_LANGUAGES), false);
  const full = { [item.id]: { ...partial[item.id], arabic: { lines: [] } } };
  assert.equal(isSlideshowItemMeasured(item, { [item.id]: 120 }, full, ALL_LANGUAGES), true);
  // A language with no text, one hidden, a centered row, or a Coptic line standing alone needs no lines.
  const englishOnly = { english: true, french: false, coptic: false, arabic: false };
  assert.deepEqual(getLanguagesNeedingLineMetrics(item, englishOnly), ["english"]);
  assert.deepEqual(getLanguagesNeedingLineMetrics(verseItem({ verse: { ...item.verse, arabic: "  " } }), ALL_LANGUAGES), ["english", "coptic"]);
  // Centered columns are laid out from their lines too.
  assert.deepEqual(getLanguagesNeedingLineMetrics(verseItem({ verse: { ...item.verse, type: "refrainLabel" } }), ALL_LANGUAGES), ["english", "coptic", "arabic"]);
  const alone = verseItem({ verse: { coptic: "Ⲁⲗⲗⲏⲗⲟⲩⲓⲁ", invincibleCoptic: true } });
  assert.deepEqual(getLanguagesNeedingLineMetrics(alone, ALL_LANGUAGES), ["coptic"]);
  assert.equal(isSlideshowLanguageJustified(alone.verse, "coptic"), false);
  assert.equal(isSlideshowLanguageJustified(item.verse, "coptic"), true);
  assert.equal(isSlideshowLanguageJustified({ type: "readingReference" }, "english"), false);
  // Anything that is not a verse is measured by its height alone.
  assert.equal(isSlideshowItemMeasured({ id: "t", type: "title", title: { english: "T" } }, { t: 30 }, {}, ALL_LANGUAGES), true);
});

test("a slide is settled once its run, its items and the item that did not fit are all measured", () => {
  const title = (id) => ({ id: `${id}-title`, sectionId: id, type: "title", title: { english: id } });
  const verse = (id, index) => verseItem({ id: `${id}-${index}`, sectionId: id });
  const items = [title("a"), verse("a", 0), verse("a", 1), verse("a", 2), title("b"), verse("b", 0), verse("b", 1)];
  assert.equal(getPaginationRunStart(items, 3), 0);
  assert.equal(getPaginationRunStart(items, 4), 4);
  assert.equal(getPaginationRunStart(items, 6), 4);
  const measuredSet = new Set();
  const isMeasured = (item) => measuredSet.has(item.id);
  const heights = Object.fromEntries(items.map((item) => [item.id, 100]));
  const slides = paginateItems(items, heights, {}, 250, 18, ALL_LANGUAGES, 1024);
  assert.deepEqual(slides.map((slide) => slide.map((entry) => entry.id)), [
    ["a-title", "a-0"], ["a-1", "a-2"], ["b-title", "b-0"], ["b-1"],
  ]);
  // The second slide of "a" needs the whole run before it, itself, and the next item.
  assert.equal(isSlideSettled(items, slides, 1, isMeasured), false);
  ["a-title", "a-0", "a-1", "a-2"].forEach((id) => measuredSet.add(id));
  assert.equal(isSlideSettled(items, slides, 1, isMeasured), false);
  measuredSet.add("b-title");
  assert.equal(isSlideSettled(items, slides, 1, isMeasured), true);
  // "b" opens its own run: nothing of "a" is needed for it.
  measuredSet.clear();
  ["b-title", "b-0", "b-1"].forEach((id) => measuredSet.add(id));
  assert.equal(isSlideSettled(items, slides, 2, isMeasured), true);
  assert.equal(isSlideSettled(items, slides, 3, isMeasured), true);
  assert.equal(isSlideSettled(items, slides, 0, isMeasured), false);
  // Segments of a split verse count by their source row.
  const cMetric = { english: { lines: metricLines("E", 12) }, coptic: { lines: metricLines("C", 12) }, arabic: { lines: metricLines("A", 12) } };
  const split = paginateItems([title("c"), verseItem({ id: "c-0", sectionId: "c" })], { "c-title": 30, "c-0": 9999 }, { "c-0": cMetric }, 200, 18, ALL_LANGUAGES, 1024);
  assert.ok(split.length > 1);
  const cItems = [title("c"), verseItem({ id: "c-0", sectionId: "c" })];
  assert.equal(isSlideSettled(cItems, split, 1, (item) => ["c-title", "c-0"].includes(item.id)), true);
  // Nothing to settle on an empty deck or an empty slide; an unknown slide is not settled.
  assert.equal(isSlideSettled([], [[]], 0, isMeasured), true);
  assert.equal(isSlideSettled(items, slides, 9, isMeasured), false);
});

test("measurement takes the reader's run first, then spreads out from the reader's row", () => {
  const items = Array.from({ length: 60 }, (_, index) => ({ id: `row-${index}`, sectionId: index < 30 ? "first" : "second", type: "verse", verse: { english: "x" } }));
  const measured = new Set(["row-22", "row-23"]);
  const batch = getMeasurementBatch(items, (item) => measured.has(item.id), 10, { sourceItemId: "row-25" }, null, 8, 20);
  // The run's start (20) up to the reader's row (25) first, less what is measured; then outward from 25.
  assert.deepEqual(batch.map((item) => item.id), ["row-20", "row-21", "row-24", "row-25", "row-26", "row-27", "row-28", "row-29", "row-30", "row-31"]);
  // A predicate that says everything is measured leaves nothing to do.
  assert.deepEqual(getMeasurementBatch(items, () => true, 10, { sourceItemId: "row-25" }, null, 8, 20), []);
});

test("a verse is split only when every column that could be split has its lines", () => {
  const first = verseItem({ id: "first", sectionId: "first" });
  const tall = verseItem({ id: "tall", sectionId: "tall" });
  // Only the English lines have landed: the verse moves on whole, all three columns intact.
  const partial = { tall: { english: { lines: metricLines("English", 30) } } };
  const slides = paginateItems([first, tall], { first: 600, tall: 900 }, partial, 1000, 18, ALL_LANGUAGES, 1024);
  assert.deepEqual(slides.map((slide) => slide.map((entry) => entry.id)), [["first"], ["tall"]]);
  const placed = slides[1][0];
  assert.equal(placed.verse.slideshowForcedLines, undefined);
  assert.equal(placed.verse.coptic, tall.verse.coptic);
  assert.equal(placed.verse.arabic, tall.verse.arabic);
  // With every column's lines it splits, and every segment keeps all three columns.
  const complete = { tall: { english: { lines: metricLines("English", 60) }, coptic: { lines: metricLines("ⲕⲟⲡⲧ", 60) }, arabic: { lines: metricLines("عربي", 60) } } };
  // Taller than a whole slide, it is the one kind of verse that is split.
  const split = paginateItems([first, tall], { first: 600, tall: 1800 }, complete, 1000, 18, ALL_LANGUAGES, 1024);
  const segments = split.flat().filter((entry) => (entry.sourceItemId || entry.id) === "tall");
  assert.ok(segments.length > 1);
  segments.forEach((segment) => assert.deepEqual(segment.verse.slideshowLanguageKeys, ["english", "coptic", "arabic"]));
});

// ---- The slide the reader is on begins where they are ----

import { getSettleStart } from "../src/components/vine/slideshowLayout.js";

test("the reader's item opens its slide, and nothing before it can move that slide", () => {
  const title = { id: "t", sectionId: "s", type: "title", title: { english: "Psalm" } };
  const verse = (index) => verseItem({ id: `v${index}`, sectionId: "s" });
  const items = [title, verse(0), verse(1), verse(2), verse(3), verse(4)];
  const heights = Object.fromEntries(items.map((item) => [item.id, 100]));
  const plain = paginateItems(items, heights, {}, 250, 18, ALL_LANGUAGES, 1024);
  assert.deepEqual(plain.map((slide) => slide.map((entry) => entry.id)), [["t", "v0"], ["v1", "v2"], ["v3", "v4"]]);
  // Reading from v2: v2 opens a slide, v1 is left on the one before.
  const anchored = paginateItems(items, heights, {}, 250, 18, ALL_LANGUAGES, 1024, { itemId: "v2", offsets: {} });
  assert.deepEqual(anchored.map((slide) => slide.map((entry) => entry.id)), [["t", "v0"], ["v1"], ["v2", "v3"], ["v4"]]);
  // Settling that slide needs v2, v3 and the v4 that did not fit: not the title, not v0 or v1.
  const measured = new Set(["v2", "v3", "v4"]);
  assert.equal(getSettleStart(items, 3, 3), 3);
  assert.equal(getSettleStart(items, 3, null), 0);
  assert.equal(isSlideSettled(items, anchored, 2, (item) => measured.has(item.id), undefined, 3), true);
  assert.equal(isSlideSettled(items, anchored, 2, (item) => measured.has(item.id)), false);
  // The reader's break is only a break at or before the slide: paging back, the earlier slides follow the run.
  assert.equal(isSlideSettled(items, anchored, 1, (item) => measured.has(item.id), undefined, 3), false);
});

test("a reader partway down a measured verse sees it carry on from their line, the lines before it on the slide before", () => {
  const item = verseItem({ id: "long", sectionId: "s" });
  const metric = {
    english: { lines: metricLines("English", 12) },
    coptic: { lines: metricLines("ⲕⲟⲡⲧ", 12) },
    arabic: { lines: metricLines("عربي", 12) },
  };
  const fontSize = 18;
  const lineHeight = getSlideshowLanguageLineHeight("arabic", item, fontSize);
  const budget = lineHeight * 5 + 40;
  const offsets = { english: 7, coptic: 7, arabic: 7 };
  const slides = paginateItems([item], { long: 9999 }, { long: metric }, budget, fontSize, ALL_LANGUAGES, 1024, { itemId: "long", offsets });
  const starts = slides.map((slide) => slide[0].slideshowLineRanges.english.start);
  assert.ok(starts.includes(7), `no slide starts at the reader's line: ${starts}`);
  // The reader's slide: where the English picks up at line 7 (a column finished before it stands empty at 7 too).
  const readerSlide = slides.findIndex((slide) => slide[0].slideshowLineRanges.english.start === 7 && slide[0].slideshowLineRanges.english.end > 7);
  // Everything before line 7 is on the slides before; everything from it on the slides from there.
  assert.ok(slides.slice(0, readerSlide).every((slide) => slide.every((entry) => entry.slideshowLineRanges.english.end <= 7)));
  assert.ok(slides.slice(readerSlide).every((slide) => slide.every((entry) => entry.slideshowLineRanges.english.start >= 7)));
  // Every line still renders exactly once, in order, and the segments keep distinct ids.
  const rendered = slides.flat().flatMap((entry) => entry.verse.slideshowForcedLines.english || []);
  assert.deepEqual(rendered, metric.english.lines);
  assert.equal(new Set(slides.flat().map((entry) => entry.slideId)).size, slides.flat().length);
  // The reader's own piece keeps its identity however the lines before it are divided up.
  assert.equal(slides[readerSlide][0].slideId, "long-segment-1");
  const tighter = paginateItems([item], { long: 9999 }, { long: metric }, lineHeight * 3 + 40, fontSize, ALL_LANGUAGES, 1024, { itemId: "long", offsets });
  assert.equal(tighter.find((slide) => slide[0].slideshowLineRanges.english.start === 7 && slide[0].slideshowLineRanges.english.end > 7)[0].slideId, "long-segment-1");
  // The anchor made from the reader's slide finds it again.
  assert.equal(findSlideIndexForAnchor(slides, createSlideAnchor(slides[readerSlide])), readerSlide);
  // Not yet measured, the verse is placed whole, beginning the slide, with no forced lines.
  const whole = paginateItems([verseItem({ id: "before", sectionId: "s" }), item], { before: 100, long: 300 }, {}, budget, fontSize, ALL_LANGUAGES, 1024, { itemId: "long", offsets });
  assert.deepEqual(whole.map((slide) => slide.map((entry) => entry.id)), [["before"], ["long"]]);
  assert.equal(whole[1][0].verse.slideshowForcedLines, undefined);
});

test("a measured verse that fits whole still carries its measured lines, as one object per measurement", () => {
  const item = verseItem({ id: "fits", sectionId: "s" });
  const metric = { english: { lines: metricLines("English", 3) }, coptic: { lines: metricLines("ⲕⲟⲡⲧ", 4) }, arabic: { lines: metricLines("عربي", 2) } };
  const first = paginateItems([item], { fits: 200 }, { fits: metric }, 1000, 18, ALL_LANGUAGES, 1024)[0][0];
  assert.deepEqual(first.verse.slideshowForcedLines, { english: metric.english.lines, coptic: metric.coptic.lines, arabic: metric.arabic.lines });
  assert.deepEqual(first.slideshowLineRanges, { english: { start: 0, end: 3 }, coptic: { start: 0, end: 4 }, arabic: { start: 0, end: 2 } });
  assert.equal(first.id, "fits");
  const again = paginateItems([item], { fits: 200 }, { fits: metric }, 1000, 18, ALL_LANGUAGES, 1024)[0][0];
  assert.equal(again, first);
  const remeasured = paginateItems([item], { fits: 200 }, { fits: { ...metric } }, 1000, 18, ALL_LANGUAGES, 1024)[0][0];
  assert.notEqual(remeasured, first);
  // An anchor with line offsets resolves to the verse placed whole, but never to a decoration-only page.
  const anchor = { sourceItemId: "fits", sectionId: "s", segmentIndex: 1, primaryLanguage: "english", offsets: { english: 2 } };
  assert.equal(findSlideIndexForAnchor([[item]], anchor), 0);
  assert.equal(findSlideIndexForAnchor([[{ ...item, slideshowLineRanges: {}, slideshowSegmentIndex: 0 }]], anchor), -1);
});

test("a column held over to the next slide brings its seasonal prefix with it, and a decoration page shows it once", () => {
  const prefix = "Watos";
  const base = verseItem().verse;
  const item = verseItem({ verse: { ...base, seasonalHoosVersePrefix: prefix, english: `${prefix} ${base.english}`, arabic: `${prefix} ${base.arabic}` } });
  const state = {
    languages: [
      { language: "english", lineHeight: 24, lines: metricLines("English", 6), offset: 0, end: 6 },
      { language: "arabic", lineHeight: 24, lines: metricLines("عربي", 3), offset: 0, end: 3 },
    ],
  };
  const first = createVerseLineSegment(item, state, { english: 4, arabic: 0 }, 0).item;
  const second = createVerseLineSegment(item, state, { english: 2, arabic: 3 }, 1).item;
  assert.ok(first.verse.english.startsWith(prefix));
  assert.equal(first.verse.arabic, "");
  assert.ok(second.verse.arabic.startsWith(prefix), "the Arabic prefix went with the Arabic");
  assert.ok(!second.verse.english.startsWith(prefix));
  assert.equal(first.verse.slideshowSeasonalPrefixVisible, true);
  assert.equal(second.verse.slideshowSeasonalPrefixVisible, true);
  // Shown on a page of its own, the prefix is not shown again on the lines that follow.
  const { segments } = splitVerse(verseItem({ hasSpeakerLabel: true, verse: item.verse }), { availableHeight: 380 });
  assert.equal(segments.filter((segment) => segment.verse.slideshowSeasonalPrefixVisible).length, 1);
});

test("the reader's own row comes first; the section is only a fallback", () => {
  const items = [
    { id: "a-title", sectionId: "a", type: "title", title: { english: "A" } },
    verseItem({ id: "a-0", sectionId: "a" }),
    verseItem({ id: "a-1", sectionId: "a" }),
  ];
  assert.equal(getReadingItemIndex(items, { sourceItemId: "a-1" }, "a"), 2);
  assert.equal(getReadingItemIndex(items, { sourceItemId: "gone" }, "a"), 0);
  assert.equal(getReadingItemIndex(items, null, "a"), 0);
  assert.equal(getReadingItemIndex(items, null, null), 0);
  // A slide's key is its content, whatever its number.
  assert.equal(getSlideKey([items[1], items[2]], 3), getSlideKey([items[1], items[2]], 9));
  assert.notEqual(getSlideKey([items[1]], 0), getSlideKey([items[2]], 0));
});

test("a title never ends a slide: it goes over the page with what follows it", () => {
  const title = (id, extra = {}) => ({ id: `${id}-title`, sectionId: id, type: "title", title: { english: id }, ...extra });
  const verse = (id, index) => verseItem({ id: `${id}-${index}`, sectionId: id });
  // A Minimizable hymn's title does not open a slide of its own, so it can land at the foot of one.
  const items = [title("a"), verse("a", 0), verse("a", 1), title("b", { isCollapsed: true, collapsible: true }), verse("b", 0)];
  const heights = { "a-title": 40, "a-0": 350, "a-1": 350, "b-title": 40, "b-0": 350 };
  const slides = paginateItems(items, heights, {}, 700, 18, ALL_LANGUAGES, 1024);
  assert.deepEqual(slides.map((slide) => slide.map((entry) => entry.id)), [["a-title", "a-0"], ["a-1"], ["b-title", "b-0"]]);
  // With room for both, they share the slide.
  const roomy = paginateItems(items, heights, {}, 1000, 18, ALL_LANGUAGES, 1024);
  assert.deepEqual(roomy.map((slide) => slide.map((entry) => entry.id)), [["a-title", "a-0", "a-1"], ["b-title", "b-0"]]);
});

test("a column shown whole on the page before never starts again on the reader's page", () => {
  // A giant verse whose English and Arabic are short: they go whole with the first piece, the Coptic carries on.
  const item = verseItem({ id: "giant", sectionId: "s" });
  const metric = { english: { lines: metricLines("English", 3) }, coptic: { lines: metricLines("ⲕⲟⲡⲧ", 30) }, arabic: { lines: metricLines("عربي", 2) } };
  const fontSize = 18;
  const lineHeight = getSlideshowLanguageLineHeight("coptic", item, fontSize);
  const budget = lineHeight * 8 + 40;
  const slides = paginateItems([item], { giant: 9999 }, { giant: metric }, budget, fontSize, ALL_LANGUAGES, 1024);
  assert.ok(slides.length > 1);
  assert.equal(slides[0][0].slideshowLineCounts.english, 3);
  assert.equal(slides[1][0].slideshowLineCounts.english ?? 0, 0);
  // Every column says where it stands on the second page, the finished ones at their end.
  assert.deepEqual(slides[1][0].slideshowLineRanges.english, { start: 3, end: 3 });
  const anchor = createSlideAnchor(slides[1]);
  assert.equal(anchor.primaryLanguage, "coptic");
  assert.equal(anchor.offsets.english, 3);
  assert.equal(findSlideIndexForAnchor(slides, anchor), 1);
  // Paginated again from that page, the English stays on the page before it.
  const again = paginateItems([item], { giant: 9999 }, { giant: metric }, budget, fontSize, ALL_LANGUAGES, 1024, { itemId: "giant", offsets: anchor.offsets });
  const readerSlide = findSlideIndexForAnchor(again, anchor);
  assert.ok(readerSlide > 0);
  assert.equal(again[readerSlide][0].slideshowLineCounts.english ?? 0, 0);
  assert.equal(again.flat().reduce((sum, entry) => sum + (entry.slideshowLineCounts.english || 0), 0), 3);
});

test("turned back, the page is packed from its foot up, ending where the page on screen begins", () => {
  const title = { id: "t", sectionId: "s", type: "title", title: { english: "Hymn" } };
  const verse = (index) => verseItem({ id: `v${index}`, sectionId: "s" });
  const items = [title, verse(0), verse(1), verse(2), verse(3), verse(4), verse(5)];
  const heights = { t: 40, v0: 100, v1: 100, v2: 100, v3: 100, v4: 100, v5: 100 };
  // Reading from v4: the page before it holds as much as fits, ending at v3.
  const back = paginateItems(items, heights, {}, 230, 18, ALL_LANGUAGES, 1024, { itemId: "v3", direction: "backward" });
  assert.deepEqual(back.map((slide) => slide.map((entry) => entry.id)), [["t", "v0"], ["v1"], ["v2", "v3"], ["v4", "v5"]]);
  assert.equal(findSlideIndexForAnchor(back, { sourceItemId: "v3", direction: "backward", offsets: {} }), 2);
  // A title keeps with its verse: packed back to v0, the title comes along.
  const toStart = paginateItems(items, heights, {}, 230, 18, ALL_LANGUAGES, 1024, { itemId: "v1", direction: "backward" });
  assert.deepEqual(toStart.map((slide) => slide.map((entry) => entry.id)), [["t", "v0"], ["v1"], ["v2", "v3"], ["v4", "v5"]]);
  const roomier = paginateItems(items, heights, {}, 260, 18, ALL_LANGUAGES, 1024, { itemId: "v1", direction: "backward" });
  assert.deepEqual(roomier[0].map((entry) => entry.id), ["t", "v0", "v1"]);
  // Turned back into a verse taller than a slide, the page shows its last piece, and what follows that fits.
  const giant = verseItem({ id: "giant", sectionId: "s" });
  const metric = { english: { lines: metricLines("English", 30) }, coptic: { lines: metricLines("ⲕⲟⲡⲧ", 30) }, arabic: { lines: metricLines("عربي", 30) } };
  const lineHeight = getSlideshowLanguageLineHeight("arabic", giant, 18);
  const budget = lineHeight * 8 + 40;
  const into = paginateItems([giant, verse(9)], { giant: 9999, v9: 60 }, { giant: metric }, budget, 18, ALL_LANGUAGES, 1024, { itemId: "giant", direction: "backward" });
  const landing = findSlideIndexForAnchor(into, { sourceItemId: "giant", direction: "backward", offsets: {} });
  assert.equal(landing, into.length - 2);
  // ...and ends there: the verse after it opens the page the reader turned back from.
  assert.deepEqual(into[landing].map((entry) => entry.sourceItemId || entry.id), ["giant"]);
  assert.deepEqual(into[landing + 1].map((entry) => entry.id), ["v9"]);
  assert.equal(into[landing][0].slideshowLineRanges.english.end, 30);
});

test("turned back from the second piece of a tall verse, the page is the piece before it, not the slide before the verse", () => {
  const before = verseItem({ id: "before", sectionId: "s" });
  const giant = verseItem({ id: "giant", sectionId: "s" });
  const metric = { english: { lines: metricLines("English", 30) }, coptic: { lines: metricLines("ⲕⲟⲡⲧ", 30) }, arabic: { lines: metricLines("عربي", 30) } };
  const lineHeight = getSlideshowLanguageLineHeight("arabic", giant, 18);
  const budget = lineHeight * 8 + 40;
  const forward = paginateItems([before, giant], { before: 60, giant: 9999 }, { giant: metric }, budget, 18, ALL_LANGUAGES, 1024);
  const pieces = forward.filter((slide) => (slide[0].sourceItemId || slide[0].id) === "giant");
  assert.ok(pieces.length >= 3);
  const second = pieces[1][0];
  // The anchor a turn back from the second piece sets: the line above it, in a column that has lines there.
  const anchor = { sourceItemId: "giant", direction: "backward", primaryLanguage: "english", offsets: { english: second.slideshowLineRanges.english.start - 1, coptic: second.slideshowLineRanges.coptic.start - 1, arabic: second.slideshowLineRanges.arabic.start - 1 } };
  const back = paginateItems([before, giant], { before: 60, giant: 9999 }, { giant: metric }, budget, 18, ALL_LANGUAGES, 1024, { itemId: "giant", ...anchor });
  const landing = findSlideIndexForAnchor(back, anchor);
  assert.equal((back[landing][0].sourceItemId || back[landing][0].id), "giant");
  assert.deepEqual(back[landing][0].slideshowLineRanges.english, pieces[0][0].slideshowLineRanges.english);
  // The page after it is the piece the reader turned back from.
  assert.deepEqual(back[landing + 1][0].slideshowLineRanges.english, second.slideshowLineRanges.english);
});

// ---- A title and its first verse always share a slide ----

test("a hymn's title shares its slide with its first verse, which gives as much of itself as fits beneath it", () => {
  const title = { id: "psalm-title", sectionId: "psalm", type: "title", title: { english: "Psalm 85" } };
  const first = verseItem({ id: "psalm-0", sectionId: "psalm" });
  const second = verseItem({ id: "psalm-1", sectionId: "psalm" });
  const metric = (count) => ({ english: { lines: metricLines("English", count) }, coptic: { lines: metricLines("ⲕⲟⲡⲧ", count) }, arabic: { lines: metricLines("عربي", count) } });
  const fontSize = 18;
  const lineHeight = getSlideshowLanguageLineHeight("arabic", first, fontSize);
  // Ten lines fit a slide; the first verse is eight lines, so it fits a slide but not beneath the title.
  const budget = lineHeight * 10 + 40;
  const heights = { "psalm-title": lineHeight * 3, "psalm-0": lineHeight * 8 + 16, "psalm-1": lineHeight * 8 + 16 };
  const slides = paginateItems([title, first, second], heights, { "psalm-0": metric(8), "psalm-1": metric(8) }, budget, fontSize, ALL_LANGUAGES, 1024);
  // The title's slide holds the first verse's first lines (each column as many as fit beneath the
  // title: the taller Arabic lines fewer than the English); the rest turns the page. The second verse,
  // whole, follows what fits, as any later verse does.
  assert.deepEqual(slides[0].map((entry) => entry.slideId || entry.id), ["psalm-title", "psalm-0-segment-0"]);
  assert.equal(slides[1][0].slideId, "psalm-0-segment-1");
  const firstPiece = slides[0][1].slideshowLineCounts.arabic;
  assert.ok(firstPiece >= 1 && firstPiece < 8, `first piece of ${firstPiece} Arabic lines`);
  assert.equal(slides[1][0].slideshowLineCounts.arabic, 8 - firstPiece);
  assert.deepEqual(slides.flat().filter((entry) => entry.id === "psalm-1").length, 1);
  // Even with room for a single line beneath the title, the first verse starts there.
  const tallTitle = { "psalm-title": lineHeight * 9, "psalm-0": lineHeight * 8 + 16 };
  const squeezed = paginateItems([title, first], tallTitle, { "psalm-0": metric(8) }, budget, fontSize, ALL_LANGUAGES, 1024);
  assert.deepEqual(squeezed[0].map((entry) => entry.slideId || entry.id), ["psalm-title", "psalm-0-segment-0"]);
  assert.ok(squeezed[0][1].slideshowLineCounts.english >= 1);
  // The Coptic Gospel toggle between a title and its verse does not come between them.
  const toggle = { id: "psalm-toggle", sectionId: "psalm", type: "gospelRiteToggle" };
  const withToggle = paginateItems([title, toggle, first], { ...heights, "psalm-toggle": 30 }, { "psalm-0": metric(8) }, budget, fontSize, ALL_LANGUAGES, 1024);
  assert.deepEqual(withToggle[0].map((entry) => entry.slideId || entry.id), ["psalm-title", "psalm-toggle", "psalm-0-segment-0"]);
  // Not yet measured, the first verse still stays with its title, whatever its estimated height.
  const unmeasured = paginateItems([title, first], heights, {}, budget, fontSize, ALL_LANGUAGES, 1024);
  assert.deepEqual(unmeasured.map((slide) => slide.map((entry) => entry.id)), [["psalm-title", "psalm-0"]]);
});

test("turned back into a title's first verse, the pages are the same ones, title and first lines together", () => {
  const title = { id: "psalm-title", sectionId: "psalm", type: "title", title: { english: "Psalm 85" } };
  const first = verseItem({ id: "psalm-0", sectionId: "psalm" });
  const second = verseItem({ id: "psalm-1", sectionId: "psalm" });
  const metric = (count) => ({ english: { lines: metricLines("English", count) }, coptic: { lines: metricLines("ⲕⲟⲡⲧ", count) }, arabic: { lines: metricLines("عربي", count) } });
  const fontSize = 18;
  const lineHeight = getSlideshowLanguageLineHeight("arabic", first, fontSize);
  const budget = lineHeight * 10 + 40;
  const languageHeights = { "psalm-0": metric(24), "psalm-1": metric(3) };
  const heights = { "psalm-title": lineHeight * 3, "psalm-0": lineHeight * 24 + 16, "psalm-1": lineHeight * 3 + 16 };
  const forward = paginateItems([title, first, second], heights, languageHeights, budget, fontSize, ALL_LANGUAGES, 1024);
  const ids = (slides) => slides.map((slide) => slide.map((entry) => entry.slideId || entry.id));
  assert.deepEqual(ids(forward)[0], ["psalm-title", "psalm-0-segment-0"]);
  const pieces = forward.flat().filter((entry) => entry.sourceItemId === "psalm-0");
  assert.ok(pieces.length >= 3);
  // Back from the second piece: the page is the title with the first piece, as it was.
  const second1 = pieces[1];
  const toFirst = { sourceItemId: "psalm-0", direction: "backward", primaryLanguage: "english", offsets: Object.fromEntries(["english", "coptic", "arabic"].map((language) => [language, second1.slideshowLineRanges[language].start - 1])) };
  const back = paginateItems([title, first, second], heights, languageHeights, budget, fontSize, ALL_LANGUAGES, 1024, { itemId: "psalm-0", ...toFirst });
  assert.deepEqual(ids(back), ids(forward));
  assert.equal(findSlideIndexForAnchor(back, toFirst), 0);
  // Back from the verse after: the last piece on a page of its own, the same pieces before it.
  const toLast = { sourceItemId: "psalm-0", direction: "backward", offsets: {} };
  const backFromAfter = paginateItems([title, first, second], heights, languageHeights, budget, fontSize, ALL_LANGUAGES, 1024, { itemId: "psalm-0", ...toLast });
  const counts = (slides) => slides.map((slide) => slide.map((entry) => entry.slideshowLineCounts?.english ?? entry.id));
  assert.deepEqual(counts(backFromAfter).slice(0, pieces.length), counts(forward).slice(0, pieces.length - 1).concat([[pieces[pieces.length - 1].slideshowLineCounts.english]]));
  assert.equal(findSlideIndexForAnchor(backFromAfter, toLast), pieces.length - 1);
  assert.deepEqual(backFromAfter[pieces.length].map((entry) => entry.id), ["psalm-1"]);
  // A forward break at the first verse itself begins at the title.
  const atVerse = paginateItems([title, first, second], heights, languageHeights, budget, fontSize, ALL_LANGUAGES, 1024, { itemId: "psalm-0", offsets: {} });
  assert.deepEqual(ids(atVerse), ids(forward));
});
