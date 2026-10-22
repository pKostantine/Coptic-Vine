/**
 * The lines of a paragraph, as plain data: how a text's words fall into
 * lines, and which line ends a paragraph. Pure, so the slideshow's pagination
 * tests can exercise it without React.
 */

export function splitWords(text) {
  return String(text || "")
    .split(/\s+/)
    .filter(Boolean);
}

export function splitParagraphs(text) {
  return String(text || "").replace(/\r\n?/g, "\n").split("\n");
}

/**
 * The lines the platform's own text engine laid out (onTextLayout's
 * `lines`), each read back into its words and told whether it ends one of
 * the text's paragraphs. Only a paragraph's last line is left ragged by
 * justification, so this has to be exact: a paragraph ends on the line that
 * shows the last of its characters. Counting characters rather than words
 * keeps that right when the engine breaks inside an over-wide word. A blank
 * native line is an empty paragraph of the text's own, and an empty
 * paragraph the engine gave no line to is passed over.
 */
export function annotateNativeLines(nativeLines, text) {
  const paragraphs = splitParagraphs(text).map((paragraph) => paragraph.replace(/\s+/g, "").length);
  let paragraphIndex = 0;
  let shown = 0;

  return (nativeLines || []).map((line, lineIndex) => {
    const words = splitWords(line?.text);
    const isLastNativeLine = lineIndex === nativeLines.length - 1;

    if (!words.length) {
      if (paragraphIndex < paragraphs.length && paragraphs[paragraphIndex] === 0 && shown === 0) {
        paragraphIndex += 1;
      }
      return { words: [], isBlank: true, isParagraphEnd: true };
    }

    while (paragraphIndex < paragraphs.length - 1 && paragraphs[paragraphIndex] === 0) {
      paragraphIndex += 1;
    }

    shown += words.join("").length;
    const isParagraphEnd = isLastNativeLine || shown >= (paragraphs[paragraphIndex] ?? 0);
    if (isParagraphEnd) {
      paragraphIndex += 1;
      shown = 0;
    }

    return { words, isParagraphEnd };
  });
}

/**
 * What of a text is left after its first lines (as annotateNativeLines reads
 * them): the lines beside a decorated initial were laid out narrower than the
 * rest, so the rest is laid out again on its own at the column's full width.
 * Counted in characters, as annotateNativeLines counts them, so a word the
 * engine broke at the end of those lines carries on from where it broke; the
 * paragraph break after them, if they ended one, goes with them.
 */
export function textAfterLines(text, lines) {
  const value = String(text || "");
  let remaining = (lines || []).reduce((count, line) => count + (line.words || []).join("").length, 0);
  let index = 0;
  while (index < value.length && remaining > 0) {
    if (!/\s/.test(value[index])) remaining -= 1;
    index += 1;
  }
  return value.slice(index).replace(/^[^\S\n]*\n?/, "").replace(/^[^\S\n]+/, "");
}

/**
 * How many of a column's first lines stand beside a decorated initial
 * (JustifiedText.js): they are set beside it, and turned over the page only
 * together.
 */
export function countInitialLines(lines) {
  let count = 0;
  while (count < (lines?.length || 0) && lines[count]?.initial) count += 1;
  return count;
}

/** The shape pagination keeps for a language's lines (see normalizeLanguageMetric). */
export function toReportedLines(lines) {
  return (lines || []).map((line) => ({
    text: (line.words || []).join(" "),
    isBlank: Boolean(line.isBlank),
    isParagraphEnd: Boolean(line.isParagraphEnd),
  }));
}
