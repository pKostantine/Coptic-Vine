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

/** The shape pagination keeps for a language's lines (see normalizeLanguageMetric). */
export function toReportedLines(lines) {
  return (lines || []).map((line) => ({
    text: (line.words || []).join(" "),
    isBlank: Boolean(line.isBlank),
    isParagraphEnd: Boolean(line.isParagraphEnd),
  }));
}
