import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Text, View } from "react-native";

import { annotateNativeLines, countInitialLines, splitParagraphs, splitWords, textAfterLines } from "./textLines";

const IS_WEB = Platform.OS === "web";

/**
 * Room for glyphs that reach past their line, as the Coptic font's
 * ornamented capitals (1.04 em above the baseline) and its descenders do in
 * a line set at little more than its own size. iOS and Android draw a Text
 * only inside its own frame, so whatever rises above a line's top or falls
 * below its foot is cut off, whatever its parents allow. Each line's frame
 * is grown by this much above and below with padding, and the same negative
 * margin takes it back, so the text sits exactly where it did and the lines
 * keep their height: only the area the platform draws in grows. The web
 * draws past a box anyway, and gets nothing.
 */
export function glyphRoomStyle(fontSize) {
  const size = Number(fontSize) || 0;
  if (IS_WEB || size <= 0) return null;
  const above = Math.ceil(size * 0.5);
  const below = Math.ceil(size * 0.3);
  return { marginBottom: -below, marginTop: -above, paddingBottom: below, paddingTop: above };
}
const DISABLED_SELECTION_STYLE = IS_WEB
  ? {
      WebkitTouchCallout: "none",
      WebkitUserSelect: "none",
      userSelect: "none",
    }
  : null;

// The shared verse textStyle carries width:"100%"/flexShrink:1 (meant for
// the full paragraph block) -- applied to a single word in a justified row,
// that stretches the Text to fill the row instead of sizing to the word's
// own content, so the row can't lay multiple whole words out side by side
// (each one individually wraps/breaks instead). This override forces the
// word back to intrinsic (content-driven) sizing; Yoga then measures each
// word's real width itself during actual layout, so justifyContent:
// "space-between" alone produces true word-only justification with no
// pixel math of our own needed at render time.
const WORD_INTRINSIC_STYLE = { width: "auto", flexBasis: "auto", flexShrink: 0, alignSelf: "flex-start" };
const INITIAL_ROW_STYLE = { alignItems: "flex-start", flexDirection: "row" };
const BESIDE_INITIAL_STYLE = { flex: 1, minWidth: 0 };

function getLineWordOffsets(lines) {
  let offset = 0;
  return (lines || []).map((line) => {
    const lineOffset = offset;
    offset += line.words.length;
    return lineOffset;
  });
}

/**
 * Greedy line-wrap: pack words left-to-right, each line taking as many
 * words as fit before the next one would overflow `maxWidth` -- the same
 * algorithm every basic text-wrapping engine uses. `spaceWidth` stands in
 * for the natural gap between words; not pixel-identical to how the host
 * platform's own text shaping would join them, but accurate enough to
 * decide *how many* words fit per line, which is all line-breaking needs.
 */
function wrapWordsIntoLines(words, widths, spaceWidth, maxWidth) {
  const lines = [];
  let current = [];
  let currentWidth = 0;

  for (const word of words) {
    const wordWidth = widths.get(word) ?? 0;
    const additional = current.length ? spaceWidth + wordWidth : wordWidth;

    if (current.length && currentWidth + additional > maxWidth) {
      lines.push(current);
      current = [word];
      currentWidth = wordWidth;
    } else {
      current.push(word);
      currentWidth += additional;
    }
  }

  if (current.length) lines.push(current);
  return lines;
}

// ---- Web: synchronous canvas measurement, no extra components at all ----
// canvas.measureText is exact (real font metrics, real kerning) and
// synchronous -- line breaks are known in the same tick as the render that
// needs them, with zero extra mounted Text nodes and zero re-render passes.
// This replaces an earlier design that mounted one hidden, individually
// onLayout-measured Text per word: correct, but for a full document (dozens
// of verses x 3 languages x ~15 words) that meant thousands of extra
// components doing real layout work at once, which was the actual source of
// the slideshow feeling slow -- not the justification math itself.
let sharedCanvasContext = null;
function getCanvasContext() {
  if (!sharedCanvasContext) {
    const canvas = document.createElement("canvas");
    sharedCanvasContext = canvas.getContext("2d");
  }
  return sharedCanvasContext;
}

const canvasWidthCache = new Map();
const MAX_CACHE_ENTRIES = 20000;

function getCanvasFont(fontSize, fontFamily, fontWeight, fontStyle) {
  const families = String(fontFamily || "sans-serif")
    .split(",")
    .map((family) => family.trim())
    .filter(Boolean)
    .map((family) => /^['"].*['"]$/.test(family) ? family : `"${family.replace(/"/g, "\\\"")}"`)
    .join(", ");
  return `${fontStyle || "normal"} ${fontWeight || "400"} ${fontSize}px ${families || "sans-serif"}`;
}

function measureWidthWeb(token, fontSize, fontFamily, fontWeight, fontStyle) {
  const key = `${fontFamily}|${fontSize}|${fontWeight}|${fontStyle}|${token}`;
  const cached = canvasWidthCache.get(key);
  if (cached != null) return cached;

  const ctx = getCanvasContext();
  ctx.font = getCanvasFont(fontSize, fontFamily, fontWeight, fontStyle);
  const measured = ctx.measureText(token).width;

  if (!canvasWidthCache.has(key) && canvasWidthCache.size >= MAX_CACHE_ENTRIES) {
    canvasWidthCache.delete(canvasWidthCache.keys().next().value);
  }
  canvasWidthCache.set(key, measured);
  return measured;
}

// Unicode-codepoint iteration (Array.from/split) would cut a Coptic base
// letter apart from its own combining overline (e.g. "ⲁ̅" = U+2C81 + U+0305)
// mid-character. Intl.Segmenter's grapheme granularity keeps every such pair
// together -- the same unit the CSS overflow-wrap/word-break spec requires a
// browser to treat as unbreakable, so chunking on the same boundaries here
// keeps this measurement consistent with what word-break:"break-word" (see
// VerseBlock.js's textStyle) will actually render.
function getGraphemes(text) {
  if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
    return Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text), (entry) => entry.segment);
  }
  return Array.from(text);
}

// A single "word" (no internal whitespace) wider than the whole column --
// routine for Coptic at larger font sizes in a narrow phone-width column --
// still has to land somewhere: the browser's own word-break:"break-word"
// (see VerseBlock.js) hard-breaks it at a grapheme boundary once it runs out
// of room. wrapWordsIntoLines alone never breaks within a word, so without
// this a verse containing one such word was measured as a single
// (impossibly wide) line while the browser silently rendered it as several
// -- undercounting that verse's real line/height needs and, for a verse
// split across slides, potentially budgeting room for a segment that
// doesn't actually fit.
function splitOverwidthWord(word, maxWidth, fontSize, fontFamily, fontWeight, fontStyle) {
  const graphemes = getGraphemes(word);
  const chunks = [];
  let current = "";

  for (const grapheme of graphemes) {
    const candidate = current + grapheme;
    if (current && measureWidthWeb(candidate, fontSize, fontFamily, fontWeight, fontStyle) > maxWidth) {
      chunks.push(current);
      current = grapheme;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function computeParagraphLinesWeb(words, fontSize, fontFamily, fontWeight, fontStyle, maxWidth, firstWordWeight = fontWeight) {
  const widths = new Map();
  for (const word of words) {
    if (!widths.has(word)) widths.set(word, measureWidthWeb(word, fontSize, fontFamily, fontWeight, fontStyle));
  }
  // The first word is set in its own weight (a Bible verse number, bold and
  // gold), and bold is wider: measured regular, a row could overflow its column.
  if (words.length && firstWordWeight !== fontWeight) {
    widths.set(words[0], measureWidthWeb(words[0], fontSize, fontFamily, firstWordWeight, fontStyle));
  }

  const expandedWords = words.flatMap((word) => {
    const width = widths.get(word);
    if (width <= maxWidth) return [word];

    const chunks = splitOverwidthWord(word, maxWidth, fontSize, fontFamily, fontWeight, fontStyle);
    chunks.forEach((chunk) => {
      if (!widths.has(chunk)) widths.set(chunk, measureWidthWeb(chunk, fontSize, fontFamily, fontWeight, fontStyle));
    });
    return chunks;
  });

  const spaceWidth = measureWidthWeb(" ", fontSize, fontFamily, fontWeight, fontStyle);
  return wrapWordsIntoLines(expandedWords, widths, spaceWidth, maxWidth);
}

function computeLinesWeb(text, fontSize, fontFamily, fontWeight, fontStyle, maxWidth, firstWordWeight = fontWeight) {
  return splitParagraphs(text).flatMap((paragraph, paragraphIndex) => {
    const words = splitWords(paragraph);
    if (!words.length) {
      return [{ words: [], isBlank: true, isParagraphEnd: true }];
    }
    const lines = computeParagraphLinesWeb(words, fontSize, fontFamily, fontWeight, fontStyle, maxWidth, paragraphIndex === 0 ? firstWordWeight : fontWeight);
    return lines.map((lineWords, index) => ({
      words: lineWords,
      isParagraphEnd: index === lines.length - 1,
    }));
  });
}

/**
 * Lines each as wide as `widthOf(lineIndex)` says -- the first ones beside a
 * decorated initial narrower than the rest -- with a word wider than its own
 * line broken there, as the browser breaks it.
 */
function computeShapedLinesWeb(text, fontSize, fontFamily, fontWeight, fontStyle, widthOf) {
  const measure = (token) => measureWidthWeb(token, fontSize, fontFamily, fontWeight, fontStyle);
  const spaceWidth = measure(" ");
  const lines = [];
  splitParagraphs(text).forEach((paragraph) => {
    const queue = splitWords(paragraph);
    if (!queue.length) {
      lines.push({ words: [], isBlank: true, isParagraphEnd: true });
      return;
    }
    let current = [];
    let currentWidth = 0;
    while (queue.length) {
      const limit = widthOf(lines.length);
      const word = queue.shift();
      const wordWidth = measure(word);
      if (!current.length && wordWidth > limit) {
        const [head, ...rest] = splitOverwidthWord(word, limit, fontSize, fontFamily, fontWeight, fontStyle);
        if (rest.length) {
          lines.push({ words: [head], isParagraphEnd: false });
          queue.unshift(rest.join(""));
        } else {
          current = [word];
          currentWidth = wordWidth;
        }
        continue;
      }
      const additional = current.length ? spaceWidth + wordWidth : wordWidth;
      if (current.length && currentWidth + additional > limit) {
        lines.push({ words: current, isParagraphEnd: false });
        current = [];
        currentWidth = 0;
        queue.unshift(word);
        continue;
      }
      current.push(word);
      currentWidth += additional;
    }
    if (current.length) lines.push({ words: current, isParagraphEnd: false });
    lines[lines.length - 1].isParagraphEnd = true;
  });
  return lines;
}

/**
 * A paragraph opened by a decorated initial (ui/CopticInitial.tsx): one line
 * tall beside it if the whole of it fits there, else its first two lines
 * narrowed beside the initial two lines tall and the rest at full width.
 * Each line beside it says which ("one" or "two"), which is how pagination
 * keeps those lines together and the render knows to set it beside them.
 */
function computeInitialLinesWeb(text, fontSize, fontFamily, fontWeight, fontStyle, width, initial) {
  const short = computeShapedLinesWeb(text, fontSize, fontFamily, fontWeight, fontStyle, () => width - initial.one.room);
  if (short.length <= 1) return short.map((line) => ({ ...line, initial: "one" }));
  const narrow = width - initial.two.room;
  return computeShapedLinesWeb(text, fontSize, fontFamily, fontWeight, fontStyle, (index) => (index < 2 ? narrow : width))
    .map((line, index) => (index < 2 ? { ...line, initial: "two" } : line));
}

// Web-only line measurement for text that is NOT rendered through this
// component -- namely VerseBlock.js's plain-Text justified path, which uses
// real CSS text-align:justify (cheaper and more accurate than this
// component's synthetic per-word Flexbox reconstruction, see useCssJustify in
// VerseBlock.js) and so never mounts JustifiedText/gets onLines at all.
// react-native-web's Text has no onTextLayout equivalent (confirmed: no
// occurrence anywhere in the package), so without this, slideshow pagination
// has literally no way to learn real line breaks for web verse text and
// always falls back to rough character-count estimation for every tall-verse
// split -- this reuses the same canvas measurement this component's own web
// path already relies on, just exposed standalone.
export function measureJustifiedLinesWeb(text, fontSize, fontFamily, maxWidth, fontWeight = "400", fontStyle = "normal", firstWordWeight = fontWeight) {
  if (!IS_WEB) return null;
  if (!String(text || "").length) return [];
  return computeLinesWeb(text, fontSize, fontFamily, fontWeight, fontStyle, maxWidth, firstWordWeight).map((line) => ({
    text: line.words.join(" "),
    isBlank: Boolean(line.isBlank),
    isParagraphEnd: Boolean(line.isParagraphEnd),
  }));
}

// ---- Native: one hidden Text per paragraph (not per word) ----
// iOS/Android's own text engine already computes line breaks for a normally
// wrapped Text and reports them for free via onTextLayout -- one native
// layout pass per paragraph, the same mechanism the plain (non-justified)
// verse path already relies on for tall-verse splitting, just reused here
// instead of re-deriving breaks from individually measured words.
//
// Verse text is rendered twice in the slideshow pipeline -- once off-screen
// for pagination measurement, then again on-screen for the actual slide --
// so a module-level cache keyed by everything that affects line breaks lets
// the second (visible) render skip straight to the already-known result
// instead of paying for another native layout pass and visibly flashing
// plain-then-justified.
const nativeLineCache = new Map();
const MAX_NATIVE_CACHE_ENTRIES = 2000;

function nativeLineCacheKey(text, fontSize, fontFamily, fontWeight, fontStyle, width) {
  return `${fontFamily}|${fontSize}|${fontWeight}|${fontStyle}|${width}|${text}`;
}

// Text with no words has no lines, and no layout event would ever say so:
// a probe for it would be waited on for ever.
const NO_LINES = Object.freeze([]);

function useNativeLines(text, style, fontSize, fontFamily, fontWeight, fontStyle, width, firstWordStyle, measureOnly) {
  const firstWordWeight = firstWordStyle?.fontWeight || fontWeight;
  const cacheKey = nativeLineCacheKey(text, fontSize, fontFamily, `${fontWeight}/${firstWordWeight}`, fontStyle, width);
  const [state, setState] = useState(null); // { forKey, lines }
  const cached = splitWords(text).length ? nativeLineCache.get(cacheKey) : NO_LINES;
  const lines = cached ?? (state && state.forKey === cacheKey ? state.lines : null);

  // Bound to the probe it was made for: an event from a probe that has since
  // been replaced says nothing about the text now being measured.
  function handleTextLayout(event) {
    const nativeLines = event.nativeEvent.lines || [];
    const computed = annotateNativeLines(nativeLines, text);
    if (!nativeLineCache.has(cacheKey) && nativeLineCache.size >= MAX_NATIVE_CACHE_ENTRIES) {
      nativeLineCache.delete(nativeLineCache.keys().next().value);
    }
    nativeLineCache.set(cacheKey, computed);
    setState({ forKey: cacheKey, lines: computed });
  }

  const isMeasuring = lines == null;
  // The probe is laid out exactly as the rows will be, first word's own
  // weight included. Keep it invisible but in normal layout flow: the
  // slideshow's outer measurement wrapper also receives this first layout
  // pass, and an absolutely positioned probe made that wrapper report only
  // its cell padding, so long verses were cached as a few pixels tall and
  // then clipped when their real text replaced the probe. In the
  // measurement layer (measureOnly) the probe is all that is ever rendered:
  // the rows would only cost the layout of a few hundred more words.
  const [firstWord, ...restWords] = splitWords(text);
  const measuringNode = isMeasuring || measureOnly ? (
    <Text
      key={cacheKey}
      allowFontScaling={false}
      style={[style, { opacity: 0, width }]}
      onTextLayout={isMeasuring ? handleTextLayout : undefined}
    >
      {firstWordStyle && firstWord ? (
        <>
          <Text allowFontScaling={false} style={firstWordStyle}>{firstWord}</Text>
          {restWords.length ? ` ${splitParagraphs(text.slice(text.indexOf(firstWord) + firstWord.length)).join("\n").trim()}` : ""}
        </>
      ) : text}
    </Text>
  ) : null;

  return { lines, isMeasuring, measuringNode };
}

/**
 * The lines of a paragraph opened by a decorated initial, from the platform's
 * own text engine as computeInitialLinesWeb works them out on the web. The
 * engine lays a Text out at one width, so the paragraph is laid out at the
 * two narrowed widths at once -- beside the initial one line tall, and two --
 * and, when it wraps beside the short one, what follows its first two lines
 * beside the tall one is laid out again at the column's full width. Each
 * layout is cached like any other (useNativeLines), so the slide shown after
 * the measuring pass has them at once. Null when there is no initial.
 */
function useNativeInitialLines(text, style, fontSize, fontFamily, fontWeight, fontStyle, width, initial) {
  const active = Boolean(initial);
  const short = useNativeLines(active ? text : "", style, fontSize, fontFamily, fontWeight, fontStyle, width - (initial?.one.room ?? 0), null, false);
  const narrow = useNativeLines(active ? text : "", style, fontSize, fontFamily, fontWeight, fontStyle, width - (initial?.two.room ?? 0), null, false);
  const fitsBesideShort = Boolean(short.lines && short.lines.length <= 1);
  const besideTall = narrow.lines ? narrow.lines.slice(0, 2) : null;
  const restText = active && besideTall && short.lines && !fitsBesideShort ? textAfterLines(text, besideTall) : "";
  const rest = useNativeLines(restText, style, fontSize, fontFamily, fontWeight, fontStyle, width, null, false);
  if (!active) return null;

  const probes = [short.measuringNode, narrow.measuringNode, rest.measuringNode];
  if (!short.lines || !narrow.lines) return { lines: null, probes };
  if (fitsBesideShort) return { lines: short.lines.map((line) => ({ ...line, initial: "one" })), probes: [] };
  if (!rest.lines) return { lines: null, probes };
  return { lines: [...besideTall.map((line) => ({ ...line, initial: "two" })), ...rest.lines], probes: [] };
}

/**
 * React Native's own textAlign:"justify" has no equivalent to CSS's
 * text-justify:"inter-word" -- native justification (iOS's
 * NSTextAlignment.justified, and historically absent on Android) stretches
 * tracking between individual LETTERS too, not just the gaps between words,
 * which reads as broken type. This reproduces true word-only justification
 * with nothing but Flexbox: once a paragraph's line breaks are known (via
 * canvas measurement on web, native onTextLayout elsewhere), every line
 * except the last renders as a justifyContent:"space-between" row of
 * per-word Text nodes -- Yoga distributes the leftover width between words
 * automatically, exactly matching what a browser's own justify engine does.
 * The final line of a paragraph is never stretched, matching standard
 * typographic convention (and CSS's own justify behavior).
 *
 * `firstWordStyle`, if given, is merged onto just the very first word (e.g.
 * to color a leading Bible verse-number gold) -- the verse number is
 * expected to already be part of `text` (as its own leading "word",
 * separated by a space), not passed separately, so it naturally
 * participates in wrapping and justification like any other word.
 *
 * `forceLines`, if given (the exact `{ text }[]` shape this component's own
 * `onLines` reports), skips wrapping entirely and renders precisely those
 * lines instead of re-deriving line breaks from `text`. This is what makes
 * slideshow mode's tall-verse splitting safe: pagination decides how many of
 * THIS component's own already-measured lines fit in the space left on a
 * slide, slices that exact array, and hands it back here for the actual
 * segment -- rather than joining the sliced lines' text back into one blob
 * and asking a fresh instance to re-wrap it, which can legitimately wrap
 * differently the second time (a shorter string can break at different word
 * boundaries than the original did), silently desyncing what pagination
 * measured from what actually renders. See SlideshowContainer.js's
 * appendTallVerseSegments.
 */
export default function JustifiedText({
  text,
  style,
  fontSize,
  fontFamily,
  fontWeight = "400",
  fontStyle = "normal",
  width,
  rtl = false,
  firstWordStyle,
  wordStyles,
  onLayout,
  onLines,
  forceLines,
  minWordsToJustify = 5,
  selectable = false,
  // Off-screen, for measurement only: the lines are reported, no rows drawn.
  measureOnly = false,
  // The font size whose glyphs may reach past their lines (the Coptic
  // column's): each drawn line gets room for them (glyphRoomStyle).
  glyphRoomFontSize = 0,
  // A decorated initial opening the text (ui/CopticInitial.tsx): the room it
  // takes from a line set one or two lines tall ({ one: { room }, two: { room } },
  // copticInitialMetrics), and render(mode) drawing it. Its lines are worked
  // out around it and it is set beside them.
  initial = null,
}) {
  const fallbackAlign = rtl ? "right" : "left";
  const reportedLinesForRef = useRef(null);
  const firstWordWeight = firstWordStyle?.fontWeight || fontWeight;
  const initialRoom = initial ? `${initial.one.room}/${initial.two.room}` : "";

  const webLines = useMemo(
    () => (IS_WEB && !forceLines
      ? initial
        ? computeInitialLinesWeb(text, fontSize, fontFamily, fontWeight, fontStyle, width, initial)
        : computeLinesWeb(text, fontSize, fontFamily, fontWeight, fontStyle, width, firstWordWeight)
      : null),
    // initialRoom stands for the initial: its render changes every time, its room doesn't.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [text, fontSize, fontFamily, fontWeight, fontStyle, width, forceLines, firstWordWeight, initialRoom],
  );
  // Always called (never skipped), even when its result goes unused (web,
  // or forceLines supplied) -- calling a hook conditionally is a
  // Rules-of-Hooks violation regardless of whether the branch it feeds ever
  // actually runs.
  const measuresInitial = Boolean(initial) && !forceLines && !IS_WEB;
  const native = useNativeLines(measuresInitial ? "" : text, style, fontSize, fontFamily, fontWeight, fontStyle, width, firstWordStyle, measureOnly && !forceLines && !measuresInitial);
  const nativeInitial = useNativeInitialLines(text, style, fontSize, fontFamily, fontWeight, fontStyle, width, measuresInitial ? initial : null);

  const forcedLines = useMemo(
    () => (forceLines ? forceLines.map((line) => ({
      words: splitWords(line.text),
      isBlank: Boolean(line.isBlank),
      isParagraphEnd: Boolean(line.isParagraphEnd),
      ...(line.initial ? { initial: line.initial } : null),
    })) : null),
    [forceLines],
  );
  const lines = forcedLines ?? (IS_WEB ? webLines : nativeInitial ? nativeInitial.lines : native.lines);
  const lineWordOffsets = useMemo(() => getLineWordOffsets(lines), [lines]);

  const reportKey = `${fontFamily}|${fontSize}|${fontWeight}/${firstWordWeight}|${fontStyle}|${width}|${initialRoom}|${text}`;
  const reportableLines = useMemo(
    () => lines?.map((line) => ({
      text: line.words.join(" "),
      isBlank: Boolean(line.isBlank),
      isParagraphEnd: Boolean(line.isParagraphEnd),
      ...(line.initial ? { initial: line.initial } : null),
    })),
    [lines],
  );

  useEffect(() => {
    if (!reportableLines || !onLines || forceLines || reportedLinesForRef.current === reportKey) return;
    reportedLinesForRef.current = reportKey;
    onLines(reportableLines);
  }, [forceLines, onLines, reportKey, reportableLines]);

  if (nativeInitial && !nativeInitial.lines) {
    // Its layouts still under way: nothing is reported until the lines are
    // known. Then it is drawn as it will be, in the measuring layer too,
    // since no single layout of the text is as tall as the paragraph set
    // around its initial.
    return <View style={{ width }}>{nativeInitial.probes}</View>;
  }
  if (!forceLines && !IS_WEB && !nativeInitial && (native.isMeasuring || measureOnly)) {
    // The invisible measuring Text stays in flow so its parent reports the
    // real paragraph height on this first pass. We still wait for
    // onTextLayout before reporting language lines; that second metric gives
    // pagination exact split boundaries without ever caching a zero-height
    // verse first.
    return (
      <View style={{ width }} onLayout={native.isMeasuring ? undefined : onLayout}>
        {native.measuringNode}
      </View>
    );
  }

  const lastIndex = lines.length - 1;
  const firstContentLineIndex = lines.findIndex((line) => line.words.length);
  const selectionStyle = selectable ? null : DISABLED_SELECTION_STYLE;
  const glyphRoom = glyphRoomStyle(glyphRoomFontSize);

  const renderLine = (line, index) => {
    const lineWords = line.words;
    const isFirstLine = index === firstContentLineIndex;
    // Only a paragraph's own last line is left ragged. Lines handed in by
    // pagination carry that from the measurement, so the last line of a
    // page whose paragraph carries on over the turn stays justified like
    // the lines above it.
    const isLastLine = forceLines ? Boolean(line.isParagraphEnd) : index === lastIndex || line.isParagraphEnd;

    if (line.isBlank) {
      return (
        <Text key={index} allowFontScaling={false} selectable={selectable} style={[style, selectionStyle, { textAlign: fallbackAlign }, glyphRoom]}>
          {"\u00a0"}
        </Text>
      );
    }

    // A right-to-left line with a run of Latin inside it (a name, a
    // reference) keeps that run left-to-right only as one piece of text:
    // word by word, the row would turn the run round.
    const mixesDirections = rtl && lineWords.some((word) => /[A-Za-z]/.test(word));
    if (isLastLine || mixesDirections || lineWords.length < minWordsToJustify) {
      const needsRichWords = Boolean(firstWordStyle && isFirstLine) || Boolean(wordStyles);
      return (
        <Text key={index} allowFontScaling={false} selectable={selectable} style={[style, selectionStyle, { textAlign: fallbackAlign }, glyphRoom]}>
          {needsRichWords ? lineWords.map((word, wordIndex) => {
            const globalWordIndex = lineWordOffsets[index] + wordIndex;
            return (
              <Text
                key={wordIndex}
                allowFontScaling={false}
                selectable={selectable}
                style={[
                  isFirstLine && wordIndex === 0 ? firstWordStyle : null,
                  wordStyles?.[globalWordIndex],
                ]}
              >
                {wordIndex ? ` ${word}` : word}
              </Text>
            );
          }) : lineWords.join(" ")}
        </Text>
      );
    }

    return (
      <View
        key={index}
        style={{
          flexDirection: rtl ? "row-reverse" : "row",
          justifyContent: "space-between",
          width: "100%",
        }}
      >
        {lineWords.map((word, wordIndex) => (
          <Text
            key={wordIndex}
            allowFontScaling={false}
            selectable={selectable}
            style={
              [
                style,
                WORD_INTRINSIC_STYLE,
                selectionStyle,
                isFirstLine && wordIndex === 0 ? firstWordStyle : null,
                wordStyles?.[lineWordOffsets[index] + wordIndex],
                glyphRoom,
              ]
            }
          >
            {word}
          </Text>
        ))}
      </View>
    );
  };

  // Lines beside a decorated initial are set in a narrower column beside it.
  const besideCount = initial ? countInitialLines(lines) : 0;

  return (
    <View style={[{ width }, selectionStyle]} onLayout={onLayout}>
      {besideCount ? (
        <View style={INITIAL_ROW_STYLE}>
          {initial.render(lines[0].initial)}
          <View style={BESIDE_INITIAL_STYLE}>{lines.slice(0, besideCount).map((line, index) => renderLine(line, index))}</View>
        </View>
      ) : null}
      {lines.slice(besideCount).map((line, index) => renderLine(line, besideCount + index))}
    </View>
  );
}
