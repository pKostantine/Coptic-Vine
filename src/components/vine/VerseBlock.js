import { useEffect, useMemo } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

import { SPACING, TYPOGRAPHY } from "../../constants/theme";
import { resolveRubricKey } from "../../utils/verseRubric";
import JustifiedText, { glyphRoomStyle, measureJustifiedLinesWeb } from "./JustifiedText";
import { getLanguageColumnGap } from "./documentPresentationMetrics";
import {
  copticStandsAlone as isCopticStandingAlone,
  getSlideshowLanguageFontSize,
  getSlideshowLanguageLineHeight,
  hasRenderableSlideshowLanguageBody,
  hasSeasonalPrefixLine as hasVisibleSeasonalPrefixLine,
  isSlideshowLanguageJustified,
  SLIDESHOW_JUSTIFIED,
} from "./slideshowLayout";
import { annotateNativeLines, toReportedLines } from "./textLines";

const DISABLED_SELECTION_STYLE = Platform.OS === "web"
  ? {
      WebkitTouchCallout: "none",
      WebkitUserSelect: "none",
      userSelect: "none",
    }
  : null;

export default function VerseBlock({
  verse,
  index,
  visibleLanguages,
  fontSize,
  theme,
  tableWidth,
  onLanguageLayout,
  isRecitedPrayer = false,
  isReading = false,
  forceWhiteText = false,
  colorIndex,
  suppressSpeakerLabel = false,
  // Decided by shouldUsePeopleLineColor in verseRubric.js — the People's own
  // responses inside the Agpeya's Litanies. Passed in rather than worked out
  // here because it depends on the section title, which this component never
  // sees.
  usePeopleLineColor = false,
  selectableText = false,
  bishopPresent = false,
}) {
  const isRefrainLabel = verse.type === "refrainLabel";
  const isReadingReference = verse.type === "readingReference";
  const isRefrain = verse.type === "refrain";
  const isComment = isCommentVerseType(verse.type);
  const isSilentPrayer = isSilentPrayerVerse(verse);
  // Who actually said this line, independent of `type` — a Silent/Recited
  // Prayer or Refrain line's `type` collapses to that prayer type and loses
  // the underlying speaker, so the rubric label/color falls back to the
  // preserved personRole instead (see resolvePersonRole in hymnLibrary.js).
  const rubricType = verse.personRole || verse.type;
  const isSeasonalHoosVerse = Boolean(verse.seasonalHoosVersePrefix);
  // Every colour is the page's (theme, see constants/documentThemes.ts).
  const rowTextColor =
    isComment
      ? theme.colors.comment
      : isSilentPrayer
      ? theme.colors.silent
      : isRefrainLabel || isRefrain
      ? theme.colors.refrain
      : isReadingReference
      ? theme.colors.comment
      : // "White"/"Blue" prayer_type forces that alternating color directly on
      // this one verse — surrounding verses alternate exactly as if it
      // weren't there (see the shared versePresentation helper, which
      // excludes it from the parity count in both renderers).
      verse.prayerType === "White"
      ? theme.colors.text
      : verse.prayerType === "Blue"
      ? theme.colors.rowBlue
      : // See resolveVerseColorBase in documentHtml.ts. Same point in the
      // chain as there — below the authored White/Blue overrides, above the
      // default alternation — and off the same shared predicate, since the
      // two renderers must never disagree about this.
      usePeopleLineColor
      ? theme.colors.peopleText
      : forceWhiteText || verse.forceWhiteText || isRefrain || isRecitedPrayer || isReading || (colorIndex ?? index) % 2 === 0
      ? theme.colors.text
      : theme.colors.rowBlue;
  const hasSeasonalPrefixLine = hasVisibleSeasonalPrefixLine(verse);
  const bodyFontStyle = isComment || isRefrain || isRefrainLabel || verse.italic ? "italic" : "normal";
  const bodyFontWeight = "400";
  // "Invincible Coptic" only means "this Coptic must always render, even if
  // the language toggle or a translation is missing" -- it does NOT mean the
  // line structurally has no English/Arabic (some DB rows tagged this way do
  // carry a translation). A row that has one lays out in the normal columns
  // below, Coptic above Coptic, and its speaker label renders in its normal
  // per-language spot like any other verse. Only when the Coptic really is
  // the whole line does it stop being a column and span the row (see
  // spanningLanguage).
  const copticStandsAlone = isCopticStandingAlone(verse);
  // Justified or centered: the one decision pagination also reads (see
  // isSlideshowLanguageJustified), since only a justified column is rendered
  // line by line and so can be turned over the page between its lines.
  const alignmentFor = (language) => (isSlideshowLanguageJustified(verse, language) ? "justify" : "center");
  const bibleNumberFor = (language) =>
    !Array.isArray(verse.slideshowBibleNumberLanguages) ||
    verse.slideshowBibleNumberLanguages.includes(language)
      ? verse.bibleVerseNumber
      : "";
  const rowLanguages = [
    {
      key: "english",
      speakerLabel: suppressSpeakerLabel ? "" : getSpeakerLabel(rubricType, "english", bishopPresent),
      text: String(verse.english || "").trimEnd(),
      bibleVerseNumber: bibleNumberFor("english"),
      seasonalHoosVersePrefix: hasSeasonalPrefixLine ? verse.seasonalHoosVersePrefix : "",
      fontSize: getSlideshowLanguageFontSize("english", { verse }, fontSize),
      fontFamily: "Georgia",
      lineHeight: getSlideshowLanguageLineHeight("english", { verse }, fontSize),
      styles: [styles.english],
      textAlign: alignmentFor("english"),
      minWordsToJustify: 1,
      forceLines: verse.slideshowForcedLines?.english,
    },
    {
      key: "french",
      speakerLabel: suppressSpeakerLabel ? "" : getSpeakerLabel(rubricType, "french", bishopPresent),
      text: String(verse.french || "").trimEnd(),
      bibleVerseNumber: bibleNumberFor("french"),
      // The seasonal prefix is English/Arabic text; French keeps its line
      // blank so its verse starts level with theirs.
      seasonalHoosVersePrefixSpacer: hasSeasonalPrefixLine ? verse.seasonalHoosVersePrefix : "",
      fontSize: getSlideshowLanguageFontSize("french", { verse }, fontSize),
      fontFamily: "Georgia",
      lineHeight: getSlideshowLanguageLineHeight("french", { verse }, fontSize),
      styles: [styles.english],
      textAlign: alignmentFor("french"),
      minWordsToJustify: 1,
      forceLines: verse.slideshowForcedLines?.french,
    },
    {
      key: "coptic",
      text: formatCopticNumbers(verse.coptic, verse.preserveCopticDigits).trimEnd(),
      bibleVerseNumber: bibleNumberFor("coptic"),
      seasonalHoosVersePrefixSpacer: hasSeasonalPrefixLine
        ? verse.seasonalHoosVersePrefix
        : "",
      fontSize: getSlideshowLanguageFontSize("coptic", { verse }, fontSize),
      fontFamily: TYPOGRAPHY.coptic,
      lineHeight: getSlideshowLanguageLineHeight("coptic", { verse }, fontSize),
      styles: [styles.coptic],
      textAlign: alignmentFor("coptic"),
      minWordsToJustify: 1,
      forceLines: verse.slideshowForcedLines?.coptic,
    },
    {
      key: "arabic",
      speakerLabel: suppressSpeakerLabel ? "" : getSpeakerLabel(rubricType, "arabic", bishopPresent),
      text: formatArabicNumbers(verse.arabic).trimEnd(),
      bibleVerseNumber: bibleNumberFor("arabic"),
      seasonalHoosVersePrefix: hasSeasonalPrefixLine
        ? formatArabicNumbers(verse.seasonalHoosVersePrefix)
        : "",
      fontSize: getSlideshowLanguageFontSize("arabic", { verse }, fontSize),
      fontFamily: "Arial",
      lineHeight: getSlideshowLanguageLineHeight("arabic", { verse }, fontSize),
      styles: [styles.arabic],
      textAlign: alignmentFor("arabic"),
      minWordsToJustify: 1,
      forceLines: verse.slideshowForcedLines?.arabic,
    },
  ].filter((language) => {
    // A verse split across multiple slides (see appendTallVerseSegments in
    // SlideshowContainer.js) can have a language finish its own lines on an
    // earlier segment while others still have more to show — that language's
    // text is legitimately blank on this later segment, but the column must
    // stay in the layout anyway (just empty) rather than collapse: dropping
    // it would reshape the row from e.g. 3 columns to 2 and back again
    // segment-to-segment, which reads as the remaining columns visibly
    // shifting/splitting apart.
    const isPartOfSplitVerse = Array.isArray(verse.slideshowLanguageKeys);
    if (isPartOfSplitVerse && verse.slideshowLanguageKeys.includes(language.key)) return true;

    if (language.key === "coptic") {
      const forceCoptic = verse.forceCopticVisible || verse.invincibleCoptic;
      const copticHiddenByToggle = isRecitedPrayer && !visibleLanguages.copticRecitedPrayers && !forceCoptic;
      if (copticHiddenByToggle) return false;
      if (!visibleLanguages.coptic && !forceCoptic) return false;
      return Boolean(language.text && language.text.trim());
    }

    if (!visibleLanguages[language.key]) return false;
    return Boolean((language.text && language.text.trim()) || language.speakerLabel);
  });
  // A Coptic line with no translation of its own has nothing in the other
  // columns to be read against, so it is not a column -- it is the whole
  // line. Giving it a column anyway wedged it into a third (or a half) of
  // the row and wrapped it in there, reading as text shoved to one side.
  // It spans the full row instead, centered on the row rather than on a
  // cell, sitting below the speaker labels (which ARE per-language, and so
  // keep their own row) -- which is where it already appeared, just narrow.
  const spanningLanguage = copticStandsAlone ? rowLanguages.find((language) => language.key === "coptic") : null;
  const columnLanguages = spanningLanguage
    ? rowLanguages.filter((language) => language.key !== "coptic")
    : rowLanguages;
  // The same gap scroll mode puts between language columns, taken out of the
  // row before it is split so the columns still fill the table exactly.
  const languageGap = getLanguageColumnGap(fontSize);
  const rowColumnWidth =
    (tableWidth - languageGap * Math.max(columnLanguages.length - 1, 0)) / Math.max(columnLanguages.length, 1);
  const isCenteredAcrossPage = Boolean(verse.centeredAcrossPage);
  const hasSpeakerLabel = rowLanguages.some((language) => language.speakerLabel);
  const speakerRowHeight = hasSpeakerLabel
    ? Math.max(...rowLanguages.filter((language) => language.speakerLabel).map((language) => language.lineHeight))
    : 0;

  // Off-screen, in the slideshow's measurement layer: the metrics are
  // reported, and the body need not be drawn in full.
  const isMeasuring = Boolean(onLanguageLayout);

  function reportLanguageMetric(language, metric) {
    onLanguageLayout?.(language, metric);
  }

  function renderLanguageCell(language, spansRow = false) {
    const isJustified = language.textAlign === "justify";
    // A completed language remains as an empty alignment column while the
    // other translations continue. Never let a stale native measurement
    // line become visible content in that empty cell.
    const hasVisibleBody = hasRenderableSlideshowLanguageBody(language);
    const selectionStyle = selectableText ? null : DISABLED_SELECTION_STYLE;
    const cellWidth = spansRow ? tableWidth : rowColumnWidth;
    const cellWidthStyle = { flexBasis: cellWidth, maxWidth: cellWidth };
    const textStyle = [
      styles.text,
      ...language.styles,
      selectionStyle,
      {
        color: rowTextColor,
        fontFamily: language.fontFamily,
        fontSize: language.fontSize,
        fontStyle: bodyFontStyle,
        fontWeight: bodyFontWeight,
        letterSpacing: 0,
        lineHeight: language.lineHeight,
        ...(Platform.OS === "web"
          ? {
              overflowWrap: "break-word",
              wordBreak: "normal",
            }
          : null),
      },
    ];

    return (
      <View
        key={language.key}
        style={[
          styles.cell,
          isSeasonalHoosVerse && styles.seasonalHoosCell,
          isCenteredAcrossPage && styles.centeredCell,
          cellWidthStyle,
        ]}
      >
        {!hasVisibleBody ? null : isJustified ? (
          // The browser justifies a whole paragraph itself. A paragraph
          // turned over the page is rendered line by line from the lines
          // pagination measured, on web as on the phone: given the joined
          // text back, the browser could wrap it a line longer or shorter
          // than the page was budgeted for.
          Platform.OS === "web" && !language.forceLines ? (
            <CssJustifiedVerseBody
              theme={theme}
              language={language}
              textStyle={textStyle}
              selectableText={selectableText}
              columnWidth={cellWidth - SPACING.xs * 2}
              fontStyle={bodyFontStyle}
              fontWeight={bodyFontWeight}
              onMetric={(metric) => reportLanguageMetric(language.key, metric)}
            />
          ) : (
            <JustifiedVerseBody
              theme={theme}
              language={language}
              textStyle={textStyle}
              selectableText={selectableText}
              columnWidth={cellWidth - SPACING.xs * 2}
              forceLines={language.forceLines}
              minWordsToJustify={language.minWordsToJustify}
              fontStyle={bodyFontStyle}
              fontWeight={bodyFontWeight}
              glyphRoomFontSize={language.key === "coptic" ? language.fontSize : 0}
              measureOnly={isMeasuring}
              onMetric={(metric) => reportLanguageMetric(language.key, metric)}
            />
          )
        ) : (
          <PlainVerseBody
            theme={theme}
            language={language}
            textStyle={[...textStyle, { textAlign: getSafeTextAlign(language) }]}
            selectableText={selectableText}
            columnWidth={cellWidth - SPACING.xs * 2}
            fontStyle={bodyFontStyle}
            fontWeight={bodyFontWeight}
            onMetric={(metric) => reportLanguageMetric(language.key, metric)}
          />
        )}
      </View>
    );
  }

  function renderSpeakerRow(languages, speakerColumnWidth) {
    if (!speakerRowHeight || !languages.length) return null;
    return (
      <View style={[styles.speakerRow, { columnGap: languageGap }]}>
        {languages.map((language) => (
          <View
            key={`speaker-${language.key}`}
            style={[
              styles.speakerCell,
              {
                flexBasis: speakerColumnWidth,
                height: speakerRowHeight,
                maxWidth: speakerColumnWidth,
              },
            ]}
          >
            {language.speakerLabel ? (
              <Text
                allowFontScaling={false}
                selectable={selectableText}
                style={[
                  ...language.styles,
                  {
                    color: getSpeakerColor(rubricType, bishopPresent, theme),
                    fontFamily: language.fontFamily,
                    fontSize: language.fontSize,
                    fontStyle: bodyFontStyle,
                    fontWeight: bodyFontWeight,
                    lineHeight: language.lineHeight,
                    textAlign: getSafeTextAlign(language),
                    width: "100%",
                  },
                ]}
              >
                {language.speakerLabel}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
    );
  }

  if (spanningLanguage) {
    return (
      <View style={styles.spanningRowGroup}>
        {renderSpeakerRow(columnLanguages, rowColumnWidth)}
        <View style={styles.row}>{renderLanguageCell(spanningLanguage, true)}</View>
      </View>
    );
  }

  return (
    <View style={styles.spanningRowGroup}>
      {renderSpeakerRow(rowLanguages, rowColumnWidth)}
      <View style={[styles.row, { columnGap: languageGap }]}>{rowLanguages.map((language) => renderLanguageCell(language))}</View>
    </View>
  );
}

/**
 * The synthetic (per-word Flexbox) justified render path — only reached on
 * native (see useCssJustify above; web gets true CSS justify through the
 * plain Text path instead, Metropolitan highlighting included, at no extra
 * cost). Still renders a seasonal Hoos prefix line (own line, untouched by
 * justification, exactly like the plain path) ahead of the actual justified
 * body.
 *
 * Metropolitan-bracket highlighting (see documentHtml.ts's
 * highlightMetropolitanBrackets) is intentionally not reproduced here — it's
 * a rare, purely cosmetic color accent, and correctly preserving it would
 * mean tracking highlighted character ranges across words that a real line
 * break can land in the middle of; not worth the risk of a subtly wrong
 * split for how rarely it fires. It's unaffected everywhere else (scroll
 * mode, and every non-justified slideshow verse type).
 */
function CssJustifiedVerseBody({ language, textStyle, selectableText, columnWidth, fontStyle, fontWeight, onMetric, theme }) {
  const { text, seasonalHoosVersePrefix, bibleVerseNumber: rawBibleVerseNumber, key, fontSize, fontFamily } = language;
  const parts = getSeasonalHoosPrefixParts(text, seasonalHoosVersePrefix);
  const prefixStyle = getSeasonalHoosPrefixStyle(fontSize);
  const bibleVerseNumber = formatBibleVerseNumber(rawBibleVerseNumber, key);
  const bodyText = parts ? parts.body : text;
  const lines = useMemo(() => {
    // The text as rendered: the verse number first, set bold (see
    // renderTextWithBibleVerseNumber), so it is measured bold.
    const number = formatBibleVerseNumber(rawBibleVerseNumber, key);
    const body = getSeasonalHoosPrefixParts(text, seasonalHoosVersePrefix)?.body ?? text;
    const measured = number ? `${number} ${body}` : body;
    return measureJustifiedLinesWeb(measured, fontSize, fontFamily, columnWidth, fontWeight, fontStyle, number ? "700" : fontWeight) || [];
  }, [columnWidth, fontFamily, fontSize, fontStyle, fontWeight, key, rawBibleVerseNumber, seasonalHoosVersePrefix, text]);

  useEffect(() => {
    onMetric?.({ lines });
  }, [lines, onMetric]);

  return (
    <>
      {renderPrefixNode(language, parts, prefixStyle, selectableText, theme)}
      <Text
        allowFontScaling={false}
        selectable={selectableText}
        style={[textStyle, SLIDESHOW_JUSTIFIED ? { textAlign: "justify", textJustify: "inter-word" } : { textAlign: language.key === "arabic" ? "right" : "left" }]}
        onLayout={(event) => onMetric?.({ height: event.nativeEvent.layout.height })}
      >
        {renderTextWithBibleVerseNumber(bodyText, bibleVerseNumber, theme)}
      </Text>
    </>
  );
}

function renderPrefixNode(language, parts, prefixStyle, selectableText, theme) {
  if (parts) {
    return <Text allowFontScaling={false} selectable={selectableText} style={[prefixStyle, { color: theme.colors.refrain }]}>{parts.prefix}</Text>;
  }
  if (language.seasonalHoosVersePrefixSpacer) {
    return (
      <Text allowFontScaling={false} selectable={selectableText} style={[prefixStyle, { color: "transparent" }]}>
        {language.seasonalHoosVersePrefixSpacer}
      </Text>
    );
  }
  return null;
}

/**
 * A centered column (a refrain label, a reading reference, a Coptic line
 * standing alone). Its lines are measured like a justified column's -- on
 * web by the same canvas measurement, on the phone from the text engine's
 * own layout -- so pagination can turn it over the page too; and a page's
 * share of it is then rendered line by line, each line centered.
 */
function PlainVerseBody({ language, textStyle, selectableText, columnWidth, fontStyle, fontWeight, onMetric, theme }) {
  const renderedText = getPlainRenderedText(language);
  // Room for the Coptic font's capitals and descenders past their lines
  // (glyphRoomStyle): a Text on iOS and Android draws only inside its frame.
  const glyphRoom = language.key === "coptic" ? glyphRoomStyle(language.fontSize) : null;
  const roomHeight = glyphRoom ? glyphRoom.paddingTop + glyphRoom.paddingBottom : 0;
  const webLines = useMemo(
    () => (Platform.OS === "web"
      ? measureJustifiedLinesWeb(renderedText, language.fontSize, language.fontFamily, columnWidth, fontWeight, fontStyle)
      : null),
    [columnWidth, fontStyle, fontWeight, language.fontFamily, language.fontSize, renderedText],
  );
  useEffect(() => {
    if (webLines) onMetric?.({ lines: webLines });
  }, [onMetric, webLines]);

  if (language.forceLines) {
    return (
      <View onLayout={(event) => onMetric?.({ height: event.nativeEvent.layout.height })}>
        {language.forceLines.map((line, index) => (
          <Text key={index} allowFontScaling={false} selectable={selectableText} style={[textStyle, glyphRoom]}>
            {String(line.text || "").trim() || "\u00a0"}
          </Text>
        ))}
      </View>
    );
  }

  return (
    <Text
      allowFontScaling={false}
      selectable={selectableText}
      style={[textStyle, glyphRoom]}
      // The room is padding, which a Text's own layout counts: the text is as tall as before.
      onLayout={(event) => onMetric?.({ height: event.nativeEvent.layout.height - roomHeight })}
      onTextLayout={(event) =>
        onMetric?.({ lines: toReportedLines(annotateNativeLines(event.nativeEvent.lines || [], renderedText)) })
      }
    >
      {renderLanguageText(language, theme)}
    </Text>
  );
}

function JustifiedVerseBody({ language, textStyle, selectableText, columnWidth, forceLines, minWordsToJustify, fontStyle, fontWeight, glyphRoomFontSize = 0, measureOnly, onMetric, theme }) {
  const parts = getSeasonalHoosPrefixParts(language.text, language.seasonalHoosVersePrefix);
  const prefixStyle = getSeasonalHoosPrefixStyle(language.fontSize);
  const bibleVerseNumber = formatBibleVerseNumber(language.bibleVerseNumber, language.key);

  const fullText = getJustifiedBodyText(language);
  const metropolitanColor = theme.colors.metropolitan;
  const wordStyles = useMemo(() => getMetropolitanWordStyles(fullText, metropolitanColor), [fullText, metropolitanColor]);

  return (
    <>
      {renderPrefixNode(language, parts, prefixStyle, selectableText, theme)}
      <JustifiedText
        text={fullText}
        style={textStyle}
        fontSize={language.fontSize}
        fontFamily={language.fontFamily}
        fontStyle={fontStyle}
        fontWeight={fontWeight}
        width={columnWidth}
        rtl={language.key === "arabic"}
        firstWordStyle={bibleVerseNumber ? { color: theme.colors.gold, fontWeight: "700" } : null}
        wordStyles={wordStyles}
        forceLines={forceLines}
        minWordsToJustify={SLIDESHOW_JUSTIFIED ? minWordsToJustify : Number.POSITIVE_INFINITY}
        selectable={selectableText}
        measureOnly={measureOnly}
        glyphRoomFontSize={glyphRoomFontSize}
        onLayout={(event) => onMetric({ height: event.nativeEvent.layout.height })}
        onLines={(lines) => onMetric({ lines })}
      />
    </>
  );
}

// The exact text a justified paragraph body wraps -- verse number prepended,
// seasonal Hoos prefix excluded (it renders on its own line, never part of
// the justified body; see JustifiedVerseBody's prefixNode). Shared between
// JustifiedVerseBody's render and measurement paths.
function getJustifiedBodyText(language) {
  const parts = getSeasonalHoosPrefixParts(language.text, language.seasonalHoosVersePrefix);
  const bodyText = (parts ? parts.body : language.text).trimEnd();
  const bibleVerseNumber = formatBibleVerseNumber(language.bibleVerseNumber, language.key);
  return bibleVerseNumber ? `${bibleVerseNumber} ${bodyText}` : bodyText;
}

// The string renderLanguageText actually puts on the page, paragraph breaks
// and all, so the native lines of a centered cell can be read back against it
// (see annotateNativeLines) and a page break between them keeps its breaks.
function getPlainRenderedText(language) {
  const parts = getSeasonalHoosPrefixParts(language.text, language.seasonalHoosVersePrefix);
  const text = String(language.text || "").trimEnd();
  if (parts) return `${parts.prefix}\n${parts.body.trimEnd()}`;
  if (language.seasonalHoosVersePrefixSpacer) return `${language.seasonalHoosVersePrefixSpacer}\n${text}`;
  const bibleVerseNumber = formatBibleVerseNumber(language.bibleVerseNumber, language.key);
  return bibleVerseNumber ? `${bibleVerseNumber} ${text}` : text;
}

function renderLanguageText(language, theme) {
  const parts = getSeasonalHoosPrefixParts(language.text, language.seasonalHoosVersePrefix);
  const prefixStyle = getSeasonalHoosPrefixStyle(language.fontSize);
  const bibleVerseNumber = formatBibleVerseNumber(
    language.bibleVerseNumber,
    language.key,
  );

  const text = String(language.text || "").trimEnd();
  if (!parts) {
    if (language.seasonalHoosVersePrefixSpacer) {
      return (
        <>
          <Text allowFontScaling={false} style={[prefixStyle, { color: "transparent" }]}>
            {language.seasonalHoosVersePrefixSpacer}
          </Text>
          {"\n"}
          {text}
        </>
      );
    }

    return renderTextWithBibleVerseNumber(text, bibleVerseNumber, theme);
  }

  return (
    <>
      <Text allowFontScaling={false} style={[prefixStyle, { color: theme.colors.refrain }]}>{parts.prefix}</Text>
      {"\n"}
      {parts.body.trimEnd()}
    </>
  );
}

function renderTextWithBibleVerseNumber(text, bibleVerseNumber, theme) {
  const content = renderTextWithMetropolitanHighlight(text, theme.colors.metropolitan);
  if (!bibleVerseNumber) {
    return content;
  }

  return (
    <>
      <Text allowFontScaling={false} style={{ color: theme.colors.gold, fontWeight: "700" }}>{bibleVerseNumber} </Text>
      {content}
    </>
  );
}

// A parenthetical naming a Metropolitan — "(Metropolitan)", "(the
// metropolitan)", "(ⲙ̀ⲙⲏⲧⲣⲟⲡⲟⲗⲓⲧⲏⲥ)", "(والمطران)" — reads visually distinct
// from the surrounding text, in every language. Matches the innermost
// bracket pair containing the keyword (never spans into an adjacent,
// unrelated bracket group like "(bishop) ... (metropolitan)"). Mirrors
// highlightMetropolitanBrackets in documentHtml.ts.
const METROPOLITAN_BRACKET_PATTERN = /\(([^()]*(?:metropolitan|ⲙⲏⲧⲣⲟⲡⲟⲗⲓⲧ|مطران)[^()]*)\)/giu;

function getMetropolitanWordStyles(text, color) {
  const raw = String(text || "");
  METROPOLITAN_BRACKET_PATTERN.lastIndex = 0;
  const ranges = [];
  let match;
  while ((match = METROPOLITAN_BRACKET_PATTERN.exec(raw))) {
    ranges.push({ start: match.index, end: match.index + match[0].length });
  }
  if (!ranges.length) return null;

  const stylesByWord = {};
  const wordPattern = /\S+/gu;
  let wordIndex = 0;
  while ((match = wordPattern.exec(raw))) {
    const start = match.index;
    const end = start + match[0].length;
    if (ranges.some((range) => start < range.end && end > range.start)) {
      stylesByWord[wordIndex] = { color };
    }
    wordIndex += 1;
  }
  return stylesByWord;
}

function renderTextWithMetropolitanHighlight(text, color) {
  const raw = String(text || "");
  if (!raw || !METROPOLITAN_BRACKET_PATTERN.test(raw)) return raw;
  METROPOLITAN_BRACKET_PATTERN.lastIndex = 0;

  const nodes = [];
  let lastIndex = 0;
  let match;
  let key = 0;
  while ((match = METROPOLITAN_BRACKET_PATTERN.exec(raw))) {
    if (match.index > lastIndex) {
      nodes.push(raw.slice(lastIndex, match.index));
    }
    nodes.push(
      <Text key={`metropolitan-${key++}`} allowFontScaling={false} style={{ color }}>
        {match[0]}
      </Text>,
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < raw.length) {
    nodes.push(raw.slice(lastIndex));
  }
  return nodes;
}

function formatBibleVerseNumber(number, language) {
  const value = String(number || "").trim();

  if (!value) {
    return "";
  }

  if (language === "arabic") {
    return formatArabicNumbers(value);
  }

  if (language === "coptic") {
    return formatCopticNumbers(value);
  }

  return value;
}

function getSeasonalHoosPrefixStyle(fontSize) {
  const prefixFontSize = fontSize;

  return {
    fontSize: prefixFontSize,
    lineHeight: Math.max(Math.round(prefixFontSize * 1.25), 9),
  };
}

function getSeasonalHoosPrefixParts(text, prefix) {
  const value = String(text || "").trimStart();
  const normalizedPrefix = String(prefix || "").trim();

  if (!normalizedPrefix || !value.startsWith(normalizedPrefix)) {
    return null;
  }

  return {
    prefix: value.slice(0, normalizedPrefix.length),
    body: value.slice(normalizedPrefix.length).replace(/^\s+/, ""),
  };
}

const COPTIC_DIGITS = {
  1: "ⲁ̅",
  2: "ⲃ̅",
  3: "ⲅ̅",
  4: "ⲇ̅",
  5: "ⲉ̅",
  6: "ⲋ",
  7: "ⲍ̅",
  8: "ⲏ̅",
  9: "ⲑ̅",
};
const COPTIC_TENS = {
  1: "ⲓ̅",
  2: "ⲕ̅",
  3: "ⲗ̅",
  4: "ⲙ̅",
  5: "ⲛ̅",
  6: "ⲝ̅",
  7: "ⲟ̅",
  8: "ⲡ̅",
  9: "ϥ̅",
};
const COPTIC_HUNDREDS = {
  1: "ⲣ̅",
  2: "ⲥ̅",
  3: "ⲧ̅",
  4: "ⲩ̅",
  5: "ⲫ̅",
  6: "ⲭ̅",
  7: "ⲯ̅",
  8: "ⲱ̅",
  9: "ϣ̅",
};

function formatCopticNumbers(text, preserveDigits = false) {
  if (preserveDigits) {
    return String(text || "");
  }

  return String(text || "").replace(/\d+/g, (value) => {
    const number = Number(value);

    if (!Number.isInteger(number) || number <= 0 || number > 999) {
      return value;
    }

    const hundreds = Math.floor(number / 100);
    const tens = Math.floor((number % 100) / 10);
    const ones = number % 10;

    return `${COPTIC_HUNDREDS[hundreds] || ""}${COPTIC_TENS[tens] || ""}${
      COPTIC_DIGITS[ones] || ""
    }`;
  });
}

function formatArabicNumbers(text) {
  return String(text || "").replace(/\d/g, (digit) => EASTERN_ARABIC_DIGITS[digit] || digit);
}

function getSpeakerLabel(type, language, bishopPresent) {
  const role = getSpeakerRole(type, bishopPresent);

  if (!role) {
    return "";
  }

  if (language === "arabic") {
    return {
      bishop: "الأسقف:",
      deacon: "الشماس:",
      people: "الشعب:",
      priest: "الكاهن:",
      reader: "القارئ:",
    }[role] || "";
  }

  if (language === "english") {
    return {
      bishop: "Bishop:",
      deacon: "Deacon:",
      people: "People:",
      priest: "Priest:",
      reader: "Reader:",
    }[role] || "";
  }

  if (language === "french") {
    return {
      bishop: "L’évêque :",
      deacon: "Le diacre :",
      people: "L’assemblée :",
      priest: "Le prêtre :",
      reader: "Le lecteur :",
    }[role] || "";
  }

  return "";
}

function getSpeakerColor(type, bishopPresent, theme) {
  return {
    bishop: theme.colors.priest,
    deacon: theme.colors.deacon,
    people: theme.colors.people,
    priest: theme.colors.priest,
    reader: theme.colors.deacon,
  }[getSpeakerRole(type, bishopPresent)] || theme.colors.people;
}

// "Bishop/Priest" (verse.type === "bishopOrPriest") resolves to "bishop" or
// "priest" via the shared resolveRubricKey (same logic the WebView reader
// uses) — see src/utils/verseRubric.js. Every other speaker verse type
// ("priest", "deacon", "reader", "people") already matches its role exactly,
// since hymnLibrary.js's getServiceVerseType only ever produces those exact
// strings — no more prefix-guessing needed.
function getSpeakerRole(type, bishopPresent) {
  const resolved = resolveRubricKey(type, bishopPresent);
  if (resolved === "priest" || resolved === "bishop" || resolved === "people" || resolved === "deacon" || resolved === "reader") {
    return resolved;
  }
  return "";
}

function isCommentVerseType(type) {
  return ["comment", "note", "tunecomment", "silentcomment"].includes(String(type || "").toLowerCase());
}

function isSilentPrayerVerse(verse = {}) {
  return Boolean(verse.isSilentPrayer) || /silent/i.test(String(verse.type || ""));
}

const EASTERN_ARABIC_DIGITS = {
  0: "٠",
  1: "١",
  2: "٢",
  3: "٣",
  4: "٤",
  5: "٥",
  6: "٦",
  7: "٧",
  8: "٨",
  9: "٩",
};

const styles = StyleSheet.create({
  arabic: {
    fontFamily: "Arial",
    writingDirection: "rtl",
  },
  cell: {
    flexShrink: 1,
    // Never clipped: the Coptic font's ornamented capitals rise past the
    // ascent (yMax 1.04 em) and the tight slideshow line box, so a verse's
    // first line lost the top of its initial at large sizes.
    overflow: "visible",
    paddingHorizontal: SPACING.xs,
    paddingVertical: SPACING.sm,
  },
  centeredCell: {
    alignItems: "center",
  },
  coptic: {
    fontFamily: TYPOGRAPHY.coptic,
  },
  english: {
    fontFamily: "Georgia",
  },
  row: {
    flexDirection: "row",
    overflow: "visible",
    width: "100%",
  },
  speakerCell: {
    flexShrink: 1,
    justifyContent: "center",
    overflow: "hidden",
    paddingHorizontal: SPACING.xs,
  },
  speakerRow: {
    flexDirection: "row",
    overflow: "hidden",
    width: "100%",
  },
  seasonalHoosCell: {
    paddingVertical: 2,
  },
  // Stacks the per-language speaker-label row above a line that spans the
  // whole width instead of taking a column (see spanningLanguage).
  spanningRowGroup: {
    width: "100%",
  },
  text: {
    flexShrink: 1,
    fontFamily: TYPOGRAPHY.body,
    letterSpacing: 0,
    textJustify: "inter-word",
    width: "100%",
  },
});

// Only ever called for center-aligned types (refrainLabel/readingReference/
// invincibleCoptic) — every regular paragraph verse ("justify") now renders
// through JustifiedVerseBody instead, which reproduces true word-only
// justification itself (React Native's own textAlign:"justify" has no
// inter-word-only mode — see JustifiedText.js).
function getSafeTextAlign(language) {
  return language.textAlign === "center" ? "center" : language.key === "arabic" ? "right" : "left";
}
