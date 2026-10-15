import assert from "node:assert/strict";
import test from "node:test";

import { annotateNativeLines, splitWords, toReportedLines } from "../src/components/vine/textLines.js";

const native = (...texts) => texts.map((text) => ({ text }));

test("only a paragraph's last line ends it: a single paragraph is justified down to its last line", () => {
  const lines = annotateNativeLines(native("O give thanks to the ", "God of gods: Alleluia, ", "His mercy endures forever."), "O give thanks to the God of gods: Alleluia, His mercy endures forever.");
  assert.deepEqual(lines.map((line) => line.isParagraphEnd), [false, false, true]);
  assert.deepEqual(lines[0].words, ["O", "give", "thanks", "to", "the"]);
});

test("explicit paragraphs each end on their own last line, blank ones included", () => {
  const text = "First one wraps\nSecond\n\nFourth";
  const lines = annotateNativeLines(native("First one ", "wraps\n", "Second\n", "\n", "Fourth"), text);
  assert.deepEqual(lines.map((line) => line.isParagraphEnd), [false, true, true, true, true]);
  assert.deepEqual(lines.map((line) => Boolean(line.isBlank)), [false, false, false, true, false]);
  // An empty paragraph the engine gave no line to is passed over.
  const skipped = annotateNativeLines(native("First one ", "wraps\n", "Second\n", "Fourth"), text);
  assert.deepEqual(skipped.map((line) => line.isParagraphEnd), [false, true, true, true]);
});

test("a word broken inside by the engine does not shift the paragraph's end", () => {
  const text = "Short ⲁⲗⲗⲏⲗⲟⲩⲓⲁⲁⲗⲗⲏⲗⲟⲩⲓⲁ end\nNext";
  const lines = annotateNativeLines(native("Short ", "ⲁⲗⲗⲏⲗⲟⲩⲓⲁ", "ⲁⲗⲗⲏⲗⲟⲩⲓⲁ ", "end\n", "Next"), text);
  assert.deepEqual(lines.map((line) => line.isParagraphEnd), [false, false, false, true, true]);
});

test("the last native line always ends a paragraph, and reported lines keep the shape pagination stores", () => {
  const lines = annotateNativeLines(native("abc ", "def"), "abc def ghi");
  assert.deepEqual(lines.map((line) => line.isParagraphEnd), [false, true]);
  assert.deepEqual(toReportedLines(lines), [
    { text: "abc", isBlank: false, isParagraphEnd: false },
    { text: "def", isBlank: false, isParagraphEnd: true },
  ]);
  assert.deepEqual(splitWords("  two\twords \n"), ["two", "words"]);
  assert.deepEqual(annotateNativeLines([], "anything"), []);
});
