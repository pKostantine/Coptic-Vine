import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  createVerseLineSegment,
  getItemSignature,
  getSlideshowLanguageLineHeight,
  normalizeLanguageMetric,
  paginateItems,
} from "../src/components/vine/slideshowLayout.js";
import { annotateNativeLines, countInitialLines, textAfterLines } from "../src/components/vine/textLines.js";

/**
 * The decorated initial in the slideshow: a verse marked to open with the
 * drop cap opens its Coptic with it as it does in the scrolling reader, its
 * first two lines narrowed beside it (or one, beside a paragraph that fits on
 * one), and those lines turned over the page only together.
 */

const source = (file) => fs.readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");

const lines = (count, initial = null, besideCount = 2) =>
  Array.from({ length: count }, (_, index) => ({
    text: `ⲗⲉⲝⲓⲥ${index + 1}`,
    isParagraphEnd: index === count - 1,
    ...(initial && index < besideCount ? { initial } : null),
  }));

function copticItem() {
  return {
    id: "hymn-0",
    sectionId: "hymn",
    type: "verse",
    copticInitial: { letter: "Ⲙ", marks: "" },
    verse: { english: "Let us give thanks", coptic: "Ⲙⲁⲣⲉⲛϣⲉⲡϩ̀ⲙⲟⲧ", arabic: "فلنشكر", type: "priest" },
  };
}

test("what follows the lines beside the initial carries on where they broke, and its paragraph break goes with them", () => {
  const text = "ⲁⲣⲉⲛ ϣⲉⲡϩ̀ⲙⲟⲧ ⲛ̀ⲧⲟⲧϥ ⲙ̀ⲡⲓⲣⲉϥ ⲉⲣⲡⲉⲑⲛⲁⲛⲉϥ\nϫⲉ ⲁϥⲉⲣ";
  // The engine broke a word at the end of the second line.
  const broken = annotateNativeLines([{ text: "ⲁⲣⲉⲛ ϣⲉⲡϩ̀ⲙⲟⲧ " }, { text: "ⲛ̀ⲧⲟⲧϥ ⲙ̀ⲡⲓ" }], text);
  assert.equal(textAfterLines(text, broken), "ⲣⲉϥ ⲉⲣⲡⲉⲑⲛⲁⲛⲉϥ\nϫⲉ ⲁϥⲉⲣ");
  // The second line ended the paragraph.
  const whole = annotateNativeLines([{ text: "ⲁⲣⲉⲛ ϣⲉⲡϩ̀ⲙⲟⲧ ⲛ̀ⲧⲟⲧϥ" }, { text: "ⲙ̀ⲡⲓⲣⲉϥ ⲉⲣⲡⲉⲑⲛⲁⲛⲉϥ" }], text);
  assert.equal(textAfterLines(text, whole), "ϫⲉ ⲁϥⲉⲣ");
  assert.equal(textAfterLines("ⲁⲣⲉⲛ ϣⲉⲡϩ̀ⲙⲟⲧ", annotateNativeLines([{ text: "ⲁⲣⲉⲛ" }, { text: "ϣⲉⲡϩ̀ⲙⲟⲧ" }], "ⲁⲣⲉⲛ ϣⲉⲡϩ̀ⲙⲟⲧ")), "");
});

test("the lines beside an initial are its first ones, however many", () => {
  assert.equal(countInitialLines(lines(5, "two")), 2);
  assert.equal(countInitialLines(lines(1, "one", 1)), 1);
  assert.equal(countInitialLines(lines(5)), 0);
  assert.equal(countInitialLines([]), 0);
});

test("measured lines keep saying they stand beside the initial, and a verse with one is measured apart", () => {
  const metric = normalizeLanguageMetric({ lines: lines(3, "two") });
  assert.deepEqual(metric.lines.map((line) => line.initial), ["two", "two", undefined]);
  assert.notEqual(metric.lineSignature, normalizeLanguageMetric({ lines: lines(3) }).lineSignature);
  const item = copticItem();
  assert.notEqual(getItemSignature(item), getItemSignature({ ...item, copticInitial: null }));
});

test("a page never takes one of the initial's lines without the other", () => {
  const state = () => ({
    languages: [
      { language: "english", lineHeight: 24, lines: lines(4), offset: 0, end: 4 },
      { language: "coptic", lineHeight: 24, lines: lines(5, "two"), offset: 0, end: 5 },
    ],
  });
  const one = createVerseLineSegment(copticItem(), state(), { english: 1, coptic: 1 }, 0).item;
  assert.equal(one.slideshowLineCounts.coptic, 2, "room for one line takes both beside the initial");
  assert.deepEqual(one.verse.slideshowForcedLines.coptic.map((line) => line.initial), ["two", "two"]);
  const three = createVerseLineSegment(copticItem(), state(), { english: 3, coptic: 3 }, 0).item;
  assert.equal(three.slideshowLineCounts.coptic, 3);
  // Past them, a page takes what fits, as before; with no room it takes nothing.
  const later = state();
  later.languages[1].offset = 2;
  assert.equal(createVerseLineSegment(copticItem(), later, { english: 1, coptic: 1 }, 1).item.slideshowLineCounts.coptic, 1);
  assert.equal(createVerseLineSegment(copticItem(), state(), { english: 1, coptic: 0 }, 0).item.slideshowLineCounts.coptic, undefined);
});

test("a verse opens with the initial only where it is marked to, as in the scrolling reader", () => {
  const container = source("components/vine/SlideshowContainer.js");
  assert.match(container, /copticInitial: findCopticInitial\(verse, visibleLanguages\),/);
  assert.match(container, /flattenSections\(sections, bishopPresent, suppressAllSpeakerLabels, visibleLanguages\),\s+\[sections, bishopPresent, suppressAllSpeakerLabels, visibleLanguages\],/);
  const finder = container.slice(container.indexOf("function findCopticInitial"), container.indexOf("function findLatinInitial"));
  // Nothing but the verse's own mark decides it: not the hymn's title, not which verse comes first.
  assert.match(finder, /if \(!verse\.dropCap\) return null;/);
  assert.doesNotMatch(finder, /section|title|refrain/);
  // Where its Coptic is shown, in its capital's form, whether or not a number or a centred line is beside it.
  assert.match(finder, /const showsCoptic = getVisibleVerseLanguages\(\{ verse, isRecitedPrayer: isCopticGatedVerse\(verse\) \}, visibleLanguages\)\.includes\("coptic"\);/);
  assert.match(finder, /const split = showsCoptic \? splitCopticInitial\(String\(verse\.coptic \|\| ""\)\) : null;/);
  assert.match(finder, /return split \? \{ letter: split\.letter, marks: split\.marks, opensWord: \/\^\\S\/\.test\(split\.rest\) \} : null;/);
  // Its English, French and Arabic open on it too, the Coptic shown or not -- but a Hoos verse's on its seasonal line.
  assert.match(container, /const opensOtherColumns = \(verse\) => Boolean\(verse\.dropCap\) && !hasSeasonalPrefixLine\(verse\);/);
  assert.match(container, /englishInitial: opensOtherColumns\(verse\) \? findLatinInitial\(verse\.english\) : null,/);
  assert.match(container, /frenchInitial: opensOtherColumns\(verse\) \? findLatinInitial\(verse\.french\) : null,/);
  assert.match(container, /arabicOpening: opensOtherColumns\(verse\) && Boolean\(String\(verse\.arabic \|\| ""\)\.trim\(\)\),/);
  assert.match(container, /copticInitial=\{item\.copticInitial\}\s+englishInitial=\{item\.englishInitial\}\s+frenchInitial=\{item\.frenchInitial\}/);
  // No line is set in lower case to leave the initial to another.
  const verseBlock = source("components/vine/VerseBlock.js");
  assert.doesNotMatch(container + verseBlock, /copticRefrain|findOpeningInitial|opensInTranslation/);
  assert.match(verseBlock, /const copticText = formattedCoptic;/);
  // The English and French openings are decided from the whole verse: a piece turned over the page carries only lines measured after it.
  assert.match(verseBlock, /if \(verse\.slideshowForcedLines\?\.\[language\]\) return \{ letter: latinInitial\.letter, text, hasWord: latinInitial\.opensWord \};/);
  assert.match(verseBlock, /const englishOpening = latinOpening\("english", englishText, englishInitial\);\s+const frenchOpening = latinOpening\("french", frenchText, frenchInitial\);/);
  // A column opening on an initial sets its number ahead of it, not between it and its word; the others in their text.
  assert.match(verseBlock, /const numberFor = \(language, opensOnInitial\) => \(\{\s+bibleVerseNumber: opensOnInitial \? "" : bibleNumberFor\(language\),\s+leadNumber: opensOnInitial \? bibleNumberFor\(language\) : "",\s+\}\);/);
  for (const [language, opening] of [["english", "Boolean(englishOpening)"], ["french", "Boolean(frenchOpening)"], ["coptic", "Boolean(initial)"]]) {
    assert.ok(verseBlock.includes(`...numberFor("${language}", ${opening}),`), language);
  }
  assert.match(verseBlock, /bibleVerseNumber: bibleNumberFor\("arabic"\),/);
  // In a box of its own ahead of the initial, which the lines beside them make room for.
  assert.match(verseBlock, /const leadWidth = leadNumber \? verseNumberLeadWidth\(leadNumber, language\.fontSize\) : 0;/);
  assert.match(verseBlock, /one: withLead\(copticMetrics\.one\),\s+two: withLead\(copticMetrics\.two\),/);
  assert.match(verseBlock, /two: withLead\(\{ room: englishMetrics\.room, firstRoom: englishMetrics\.firstRoom \}\),/);
  // The scrolling reader's rule, for the two to agree.
  const page = source("components/vine/documentHtml.ts");
  assert.match(page, /const opens = Boolean\(verse\.dropCap\);/);
  assert.match(page, /const initial = opens && copticCell \? splitCopticInitial\(copticCell\.text\) : null;/);
  assert.match(page, /const frenchOpening = opens && !isCentered \? splitEnglishOpening\(verse\.french \|\| ''\) : null;/);
  assert.doesNotMatch(page, /initialPending|opensInTranslation|openingRefrain/);
});

test("the Coptic column measures and sets its text around the initial, in the ornaments' colour and the titles' gold", () => {
  const verse = source("components/vine/VerseBlock.js");
  // The letter is the initial's: the column's own text starts after it, unless pagination handed the lines in.
  assert.match(verse, /const copticRest = initial \? copticText\.trimStart\(\)\.slice\(initial\.letter\.length \+ initial\.marks\.length\) : "";/);
  assert.match(verse, /text: initial && !verse\.slideshowForcedLines\?\.coptic \? copticRest : copticText,/);
  // In the initials' colours (documentInitialColors), the page's gold and ornament colour where none are given.
  assert.match(verse, /const initialVineColor = theme\.colors\.initialVine \|\| theme\.colors\.gold;/);
  assert.match(verse, /const initialLetterColor = theme\.colors\.initialLetter \|\| theme\.colors\.ornament \|\| theme\.colors\.gold;/);
  assert.match(verse, /vineColor=\{initialVineColor\}\s+letterColor=\{initialLetterColor\}/);
  const justified = source("components/vine/JustifiedText.js");
  // Beside the short initial if the whole of it fits there, else two lines narrowed beside the tall one:
  // line 1 by its own room, line 2 by the other, the gap stepping between them.
  assert.match(justified, /if \(short\.length <= 1\) return short\.map\(\(line\) => \(\{ \.\.\.line, initial: "one" \}\)\);/);
  assert.match(justified, /\(index\) => width - \(index === 0 \? firstRoom : index === 1 \? initial\.two\.room : 0\)/);
  assert.match(justified, /const lineTwoText = active && decided && stepped && narrow\.lines\.length > 1 \? textAfterLines\(text, narrow\.lines\.slice\(0, 1\)\) : "";/);
  assert.match(justified, /const restText = active && besideTall \? textAfterLines\(text, besideTall\) : "";/);
  assert.match(justified, /index === 1 && lineTwoInset \? <View key=\{index\} style=\{\{ paddingLeft: lineTwoInset \}\}>/);
  assert.match(justified, /\{initial\.render\(lines\[0\]\.initial\)\}\s+<View style=\{BESIDE_INITIAL_STYLE\}>\{lines\.slice\(0, besideCount\)\.map/);
  // The flag survives every hand-off: reported, and handed back by pagination.
  assert.equal((justified.match(/\.\.\.\(line\.initial \? \{ initial: line\.initial \} : null\),/g) || []).length, 2);
});

test("a centred line opening its hymn takes the initial a line tall, before its first word, in the same colours", () => {
  const verse = source("components/vine/VerseBlock.js");
  // Every column that opens the hymn has it, justified or centred.
  assert.match(verse, /const initial = copticInitial \|\| null;/);
  assert.match(verse, /<PlainVerseBody[\s\S]*?initial=\{initial\}[\s\S]*?\/>/);
  const body = verse.slice(verse.indexOf("function PlainVerseBody"), verse.indexOf("function JustifiedVerseBody"));
  // Measured in the room left beside it, its first line marked as beside it for pagination.
  assert.match(body, /const textWidth = initial \? columnWidth - initial\.one\.room : columnWidth;/);
  assert.match(body, /onMetric\?\.\(\{ lines: besideInitial\(webLines, hasInitial\) \}\)/);
  assert.match(body, /onMetric\?\.\(\{ lines: besideInitial\(toReportedLines\(annotateNativeLines\(event\.nativeEvent\.lines \|\| \[\], renderedText\)\), hasInitial\) \}\)/);
  // Drawn a line tall, centred together with the text; a page handed its lines draws it before the first.
  assert.match(body, /\{initial\.render\("one"\)\}/);
  assert.match(body, /return line\.initial && initial \? withInitial\(text, index\) : text;/);
  assert.match(body, /return initial \? withInitial\(text\) : text;/);
  assert.match(verse, /const CENTERED_INITIAL_ROW_STYLE = \{ alignItems: "flex-start", flexDirection: "row", justifyContent: "center" \};/);
  // One initial for either body: the letter in the ornaments' colour, the vine in the titles' gold.
  assert.equal((verse.match(/<CopticInitial/g) || []).length, 1);
});

test("where only one of the initial's lines fits beneath its title, the verse starts the next slide", () => {
  const languages = { english: true, coptic: true };
  const fontSize = 18;
  const item = copticItem();
  const lineHeight = getSlideshowLanguageLineHeight("coptic", item, fontSize);
  const title = { id: "hymn-title", sectionId: "hymn", type: "title", title: { english: "Thanksgiving" } };
  const metric = { english: { lines: lines(4) }, coptic: { lines: lines(5, "two") } };
  const ids = (slides) => slides.map((slide) => slide.map((entry) => entry.slideId || entry.id));
  // Room beneath the title for one line and its padding, not two.
  const budget = 40 + 2 + 16 + lineHeight + 4;
  const slides = paginateItems([title, item], { "hymn-title": 40, "hymn-0": 200 }, { "hymn-0": metric }, budget, fontSize, languages, 1024);
  assert.deepEqual(ids(slides)[0], ["hymn-title"]);
  assert.equal(slides[1][0].slideshowLineRanges.coptic.start, 0);
  assert.ok(slides[1][0].slideshowLineCounts.coptic >= 2);
  // With room for both, they go beneath the title.
  const roomy = paginateItems([title, item], { "hymn-title": 40, "hymn-0": 200 }, { "hymn-0": metric }, budget + lineHeight, fontSize, languages, 1024);
  assert.deepEqual(ids(roomy)[0], ["hymn-title", "hymn-0-segment-0"]);
  assert.equal(roomy[0][1].slideshowLineCounts.coptic, 2);
});

test("a verse split over the page keeps its first word where its number stands ahead of the initial", () => {
  // Pagination takes the number off a column's first lines only when it is in them.
  const item = { ...copticItem(), verse: { ...copticItem().verse, bibleVerseNumber: "1" } };
  const state = () => ({
    languages: [
      { language: "english", lineHeight: 24, lines: [{ text: "1 Let us give", isParagraphEnd: false }, { text: "thanks", isParagraphEnd: true }], offset: 0, end: 2 },
      { language: "coptic", lineHeight: 24, lines: lines(3, "two"), offset: 0, end: 3 },
    ],
  });
  const segment = createVerseLineSegment(item, state(), { english: 1, coptic: 2 }, 0).item;
  assert.equal(segment.verse.coptic, "ⲗⲉⲝⲓⲥ1 ⲗⲉⲝⲓⲥ2", "beside its initial, the number isn't in the lines");
  assert.equal(segment.verse.english, "Let us give");
  assert.deepEqual(segment.verse.slideshowBibleNumberLanguages, ["english", "coptic"]);
});
