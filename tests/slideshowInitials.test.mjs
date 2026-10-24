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
 * The decorated initial in the slideshow: a titled hymn's first Coptic
 * paragraph opens with it as it does in the scrolling reader, its first two
 * lines narrowed beside it (or one, beside a paragraph that fits on one), and
 * those lines turned over the page only together.
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

test("the hymn's capital takes the initial, on the verse the scrolling reader gives it", () => {
  const container = source("components/vine/SlideshowContainer.js");
  assert.match(container, /const opening = findOpeningInitial\(section, visibleLanguages\);/);
  assert.match(container, /copticInitial: opening\?\.index === verseIndex \? opening\.initial : null,/);
  assert.match(container, /flattenSections\(sections, bishopPresent, suppressAllSpeakerLabels, visibleLanguages\),\s+\[sections, bishopPresent, suppressAllSpeakerLabels, visibleLanguages\],/);
  const finder = container.slice(container.indexOf("function findOpeningInitial"));
  assert.match(finder, /if \(!\(section\.title\?\.english \|\| section\.title\?\.french \|\| section\.title\?\.arabic\)\) return null;/);
  // The first verse shown whose Coptic opens on a capital, past any kept in lower case; never after a verse number.
  assert.match(finder, /const showsCoptic = getVisibleVerseLanguages\(\{ verse, isRecitedPrayer: isCopticGatedVerse\(verse\) \}, visibleLanguages\)\.includes\("coptic"\);/);
  // A standalone refrain before it takes none; the paragraph after one takes its capital's, kept in lower case or not.
  assert.match(finder, /if \(copticStandsAlone\(verse\) && String\(verse\.coptic \|\| ""\)\.trim\(\)\) \{\s+refrains\.push\(index\);\s+continue;\s+\}/);
  assert.match(finder, /const split = showsCoptic && !verse\.bibleVerseNumber \? splitCopticInitial\(String\(verse\.coptic \|\| ""\), refrains\.length > 0\) : null;\s+if \(!split\) continue;/);
  assert.match(container, /copticRefrain: Boolean\(openingRow\?\.refrains\.includes\(verseIndex\)\),/);
  assert.match(source("components/vine/VerseBlock.js"), /const copticText = copticRefrain \? formattedCoptic\.toLowerCase\(\) : formattedCoptic;/);
  // Centred on a line of its own too (Agios opening St Basil's Anaphora): it takes it a line tall.
  assert.match(finder, /if \(!split\) continue;[\s\S]*?return \{ index, initial: \{ letter: split\.letter, marks: split\.marks, opensWord: \/\^\\S\/\.test\(split\.rest\) \}, refrains \};/);
  // The English opening is decided from the whole verse too: a piece turned over the page carries only lines measured after it.
  assert.match(container, /englishInitial: opensOtherColumns\(verse, verseIndex\) \? findEnglishInitial\(verse\) : null,/);
  assert.match(source("components/vine/VerseBlock.js"), /if \(verse\.slideshowForcedLines\?\.english\) return \{ letter: englishInitial\.letter, text: englishText, hasWord: englishInitial\.opensWord \};/);
  assert.doesNotMatch(finder.slice(0, finder.indexOf("\n}\n")), /isSlideshowLanguageJustified/);
  assert.match(container, /copticInitial=\{item\.copticInitial\}/);
  // The scrolling reader's rule, for the two to agree: the row is decided whether or not the Coptic is shown.
  const page = source("components/vine/documentHtml.ts");
  assert.match(page, /const openingRefrain = opening\.initialPending && isInvincibleCoptic && !hasTranslationText && Boolean\(copticText\.trim\(\)\);/);
  assert.match(page, /const opensHymn = !openingRefrain && opening\.initialPending && \(opening\.inTranslation\s+\? opensInTranslation\(verse\)\s+: !verse\.bibleVerseNumber && Boolean\(splitCopticInitial\(copticText, opening\.afterRefrain\)\)\);[\s\S]*?if \(opensHymn\) opening\.initialPending = false;/);
  // A hymn nothing in Coptic opens opens on its first English and Arabic paragraph, in both readers.
  assert.match(page, /if \(opening\.initialPending\) versesHtml = renderVerses\(\{ initialPending: true, afterRefrain: false, inTranslation: true \}\);/);
  assert.match(finder, /const index = verses\.findIndex\(\(verse\) => opensInTranslation\(verse\)\);\s+return index !== -1 \|\| refrains\.length \? \{ index, initial: null, refrains \} : null;/);
  assert.match(page, /const initial = opensHymn && copticCell \? splitCopticInitial\(copticCell\.text, capitalise\) : null;/);
  // The English and Arabic open on that same row, the Coptic shown or not.
  assert.match(container, /const openingRow = findOpeningInitial\(section, \{ \.\.\.visibleLanguages, coptic: true \}\);/);
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
