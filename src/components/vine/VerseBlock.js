import { useEffect, useMemo } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

import { SPACING, TYPOGRAPHY } from "../../constants/theme";
import { resolveRubricKey } from "../../utils/verseRubric";
import { copticInitialMetrics } from "./copticInitial";
import JustifiedText, { glyphRoomStyle, measureJustifiedLinesWeb } from "./JustifiedText";
import { CopticInitial } from "./ui/CopticInitial";
import { EnglishInitial } from "./ui/EnglishInitial";
import {
  arabicOpeningWord,
  englishInitialMetrics,
  englishOpeningWord,
  splitArabicOpening,
  splitEnglishOpening,
  splitRestOfFirstWord,
} from "./openingInitials";
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
import { arabicFontStyle, arabicItalicStyle } from "../../utils/arabicItalic";

const DISABLED_SELECTION_STYLE = Platform.OS === "web"
  ? {
      WebkitTouchCallout: "none",
      WebkitUserSelect: "none",
      userSelect: "none",
    }
  : null;
// A centred line opening its hymn, and the decorated initial a line tall before it (PlainVerseBody).
const CENTERED_INITIAL_ROW_STYLE = { alignItems: "flex-start", flexDirection: "row", justifyContent: "center" };

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
  // The decorated initial this verse's Coptic opens with ({ letter, marks },
  // see flattenSections in SlideshowContainer.js), or none.
  copticInitial = null,
  // A verse marked to open with the drop cap (verse.dropCap) opens in English,
  // French and Arabic too: the English and French initials ({ letter,
  // opensWord }), and whether the Arabic's first word is stretched
  // (openingInitials.ts).
  englishInitial = null,
  frenchInitial = null,
  arabicOpening = false,
  // Where in each column's lines this piece of the verse starts (a piece
  // turned over the page from a tall verse starts part way), so only the
  // piece holding a paragraph's first word sets it as an opening word.
  lineRanges = null,
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
  // The initial stands in for the Coptic's first letter, so the column's text
  // starts after it -- unless the lines were handed in from pagination,
  // which measured the text that way already. A centred line takes it too,
  // a line tall (PlainVerseBody).
  const initial = copticInitial || null;
  const formattedCoptic = formatCopticNumbers(verse.coptic, verse.preserveCopticDigits).trimEnd();
  const copticText = formattedCoptic;
  // The initials' colours (documentInitialColors): the letter's is the opening words' too.
  const initialVineColor = theme.colors.initialVine || theme.colors.gold;
  const initialLetterColor = theme.colors.initialLetter || theme.colors.ornament || theme.colors.gold;
  const startsParagraph = (language) => (lineRanges?.[language]?.start ?? 0) === 0;
  // The opening: the rest of each column's first word in the letter's colour,
  // the English and French set after their initials in small capitals (passed
  // here in capitals) and the Arabic's stretched and set larger, in bold.
  // Only a justified column opens so.
  const copticRest = initial ? copticText.trimStart().slice(initial.letter.length + initial.marks.length) : "";
  const englishText = String(verse.english || "").trimEnd();
  const frenchText = String(verse.french || "").trimEnd();
  // A piece turned over the page carries the lines measured after the
  // initial already, so only the whole verse is split here.
  const latinOpening = (language, text, latinInitial) => {
    if (!latinInitial || alignmentFor(language) !== "justify") return null;
    if (verse.slideshowForcedLines?.[language]) return { letter: latinInitial.letter, text, hasWord: latinInitial.opensWord };
    const split = splitEnglishOpening(text);
    if (!split || split.letter !== latinInitial.letter) return null;
    const first = splitRestOfFirstWord(split.rest);
    return { letter: split.letter, text: first ? first.word.toUpperCase() + first.after : split.rest, hasWord: Boolean(first) };
  };
  const englishOpening = latinOpening("english", englishText, englishInitial);
  const frenchOpening = latinOpening("french", frenchText, frenchInitial);
  const arabicText = formatArabicNumbers(verse.arabic).trimEnd();
  const arabicSplit = arabicOpening && alignmentFor("arabic") === "justify" ? splitArabicOpening(arabicText) : null;
  const englishFontSize = getSlideshowLanguageFontSize("english", { verse }, fontSize);
  const frenchFontSize = getSlideshowLanguageFontSize("french", { verse }, fontSize);
  const arabicFontSize = getSlideshowLanguageFontSize("arabic", { verse }, fontSize);
  // A verse that opens with the drop cap shows no number, which would stand
  // between the initial and its word (as documentHtml.ts keeps it unseen).
  const bibleNumberFor = (language) =>
    !verse.dropCap &&
    (!Array.isArray(verse.slideshowBibleNumberLanguages) ||
      verse.slideshowBibleNumberLanguages.includes(language))
      ? verse.bibleVerseNumber
      : "";
  const rowLanguages = [
    {
      key: "english",
      speakerLabel: suppressSpeakerLabel ? "" : getSpeakerLabel(rubricType, "english", bishopPresent),
      text: englishOpening && !verse.slideshowForcedLines?.english ? englishOpening.text : englishText,
      englishInitial: englishOpening?.letter ?? null,
      englishOpensWord: Boolean(englishOpening?.hasWord),
      openingWord: englishOpening?.hasWord && startsParagraph("english") ? englishOpeningWord(englishFontSize, initialLetterColor) : null,
      bibleVerseNumber: bibleNumberFor("english"),
      seasonalHoosVersePrefix: hasSeasonalPrefixLine ? verse.seasonalHoosVersePrefix : "",
      fontSize: englishFontSize,
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
      text: frenchOpening && !verse.slideshowForcedLines?.french ? frenchOpening.text : frenchText,
      englishInitial: frenchOpening?.letter ?? null,
      englishOpensWord: Boolean(frenchOpening?.hasWord),
      openingWord: frenchOpening?.hasWord && startsParagraph("french") ? englishOpeningWord(frenchFontSize, initialLetterColor) : null,
      bibleVerseNumber: bibleNumberFor("french"),
      // The seasonal prefix is English/Arabic text; French keeps its line
      // blank so its verse starts level with theirs.
      seasonalHoosVersePrefixSpacer: hasSeasonalPrefixLine ? verse.seasonalHoosVersePrefix : "",
      fontSize: frenchFontSize,
      fontFamily: "Georgia",
      lineHeight: getSlideshowLanguageLineHeight("french", { verse }, fontSize),
      styles: [styles.english],
      textAlign: alignmentFor("french"),
      minWordsToJustify: 1,
      forceLines: verse.slideshowForcedLines?.french,
    },
    {
      key: "coptic",
      text: initial && !verse.slideshowForcedLines?.coptic ? copticRest : copticText,
      initial,
      openingWord: initial?.opensWord && startsParagraph("coptic") ? { style: { color: initialLetterColor }, baselineShift: 0 } : null,
      bibleVerseNumber: bibleNumberFor("coptic"),
      seasonalHoosVersePrefixSpacer: hasSeasonalPrefixLine
        ? verse.seasonalHoosVersePrefix
        : "",
      fontSize: getSlideshowLanguageFontSize("coptic", { verse }, fontSize),
      // Coptic set in italic has its own face (CopticVine-Italic), drawn upright.
      fontFamily: bodyFontStyle === "italic" ? TYPOGRAPHY.copticItalic : TYPOGRAPHY.coptic,
      lineHeight: getSlideshowLanguageLineHeight("coptic", { verse }, fontSize),
      styles: [styles.coptic],
      textAlign: alignmentFor("coptic"),
      minWordsToJustify: 1,
      forceLines: verse.slideshowForcedLines?.coptic,
    },
    {
      key: "arabic",
      speakerLabel: suppressSpeakerLabel ? "" : getSpeakerLabel(rubricType, "arabic", bishopPresent),
      text: arabicSplit && !verse.slideshowForcedLines?.arabic ? arabicSplit.word + arabicSplit.rest : arabicText,
      openingWord: arabicSplit && startsParagraph("arabic") ? arabicOpeningWord(arabicFontSize, initialLetterColor) : null,
      bibleVerseNumber: bibleNumberFor("arabic"),
      seasonalHoosVersePrefix: hasSeasonalPrefixLine
        ? formatArabicNumbers(verse.seasonalHoosVersePrefix)
        : "",
      fontSize: arabicFontSize,
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
    // Arabic in italic is drawn upright and skewed 14 degrees on iOS and
    // Android, as Chrome slants it (utils/arabicItalic.ts); laid out upright.
    const slantsArabic = language.key === "arabic" && bodyFontStyle === "italic";
    // Coptic in italic is already its italic face: asking for italic again
    // would have the system slant that a second time.
    const languageFontStyle = slantsArabic ? arabicFontStyle(true) : language.key === "coptic" ? "normal" : bodyFontStyle;
    // The initial: the Coptic's decorated one, its room in a line one or two
    // lines tall and drawn in either; or the English one, two lines tall.
    const englishMetrics = language.englishInitial ? englishInitialMetrics(language.englishInitial, language.fontSize, language.lineHeight, language.englishOpensWord) : null;
    const initial = language.initial ? {
      ...copticInitialMetrics(language.lineHeight),
      render: (mode) => (
        <CopticInitial
          letter={language.initial.letter}
          mode={mode}
          lineHeight={language.lineHeight}
          vineColor={initialVineColor}
          letterColor={initialLetterColor}
        />
      ),
    } : englishMetrics ? {
      two: { room: englishMetrics.room, firstRoom: englishMetrics.firstRoom },
      render: () => <EnglishInitial letter={language.englishInitial} metrics={englishMetrics} color={initialLetterColor} />,
    } : null;
    const textStyle = [
      styles.text,
      ...language.styles,
      selectionStyle,
      {
        color: rowTextColor,
        fontFamily: language.fontFamily,
        fontSize: language.fontSize,
        fontStyle: languageFontStyle,
        fontWeight: bodyFontWeight,
        letterSpacing: 0,
        lineHeight: language.lineHeight,
        ...(slantsArabic ? arabicItalicStyle() : null),
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
          Platform.OS === "web" && !language.forceLines && !initial && !language.openingWord ? (
            <CssJustifiedVerseBody
              theme={theme}
              language={language}
              textStyle={textStyle}
              selectableText={selectableText}
              columnWidth={cellWidth - SPACING.xs * 2}
              fontStyle={languageFontStyle}
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
              fontStyle={languageFontStyle}
              fontWeight={bodyFontWeight}
              glyphRoomFontSize={language.key === "coptic" ? language.fontSize : 0}
              initial={initial}
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
            fontStyle={languageFontStyle}
            fontWeight={bodyFontWeight}
            initial={initial}
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
                  // Arabic in italic, slanted as Chrome slants it (utils/arabicItalic.ts).
                  language.key === "arabic" && bodyFontStyle === "italic" ? arabicItalicStyle() : null,
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
 * A centred line's lines, the first marked as set beside a decorated initial a
 * line tall when there is one: pagination then keeps it with the initial
 * (normalizeLanguageMetric), and hands it back so (forceLines).
 */
function besideInitial(lines, initial) {
  return initial && lines.length ? [{ ...lines[0], initial: "one" }, ...lines.slice(1)] : lines;
}

/**
 * A centered column (a refrain label, a reading reference, a Coptic line
 * standing alone). Its lines are measured like a justified column's -- on
 * web by the same canvas measurement, on the phone from the text engine's
 * own layout -- so pagination can turn it over the page too; and a page's
 * share of it is then rendered line by line, each line centered.
 */
function PlainVerseBody({ language, textStyle, selectableText, columnWidth, fontStyle, fontWeight, initial = null, onMetric, theme }) {
  const renderedText = getPlainRenderedText(language);
  // Room for the Coptic font's capitals and descenders past their lines
  // (glyphRoomStyle): a Text on iOS and Android draws only inside its frame.
  const glyphRoom = language.key === "coptic" ? glyphRoomStyle(language.fontSize) : null;
  const roomHeight = glyphRoom ? glyphRoom.paddingTop + glyphRoom.paddingBottom : 0;
  // A centred line opening its hymn has no side to hang a tall initial from,
  // so it takes one a line tall, before its first word (as documentHtml.ts
  // sets it), and the text has that much less room.
  const textWidth = initial ? columnWidth - initial.one.room : columnWidth;
  const webLines = useMemo(
    () => (Platform.OS === "web"
      ? measureJustifiedLinesWeb(renderedText, language.fontSize, language.fontFamily, textWidth, fontWeight, fontStyle)
      : null),
    [textWidth, fontStyle, fontWeight, language.fontFamily, language.fontSize, renderedText],
  );
  const hasInitial = Boolean(initial);
  // Beside the initial the text is as wide as its words, not the column
  // (styles.text), so the two centre together. Flattened, as the web drops a
  // width of "auto" and keeps the column's.
  const besideStyle = initial ? { ...StyleSheet.flatten([textStyle, glyphRoom]), flexShrink: 1, width: undefined } : null;
  useEffect(() => {
    if (webLines) onMetric?.({ lines: besideInitial(webLines, hasInitial) });
  }, [hasInitial, onMetric, webLines]);

  // The first line and the initial before it, centred together.
  const withInitial = (text, key) => (
    <View key={key} style={CENTERED_INITIAL_ROW_STYLE}>
      {initial.render("one")}
      {text}
    </View>
  );

  if (language.forceLines) {
    return (
      <View onLayout={(event) => onMetric?.({ height: event.nativeEvent.layout.height })}>
        {language.forceLines.map((line, index) => {
          const text = (
            <Text key={index} allowFontScaling={false} selectable={selectableText} style={line.initial && initial ? besideStyle : [textStyle, glyphRoom]}>
              {String(line.text || "").trim() || "\u00a0"}
            </Text>
          );
          return line.initial && initial ? withInitial(text, index) : text;
        })}
      </View>
    );
  }

  const text = (
    <Text
      allowFontScaling={false}
      selectable={selectableText}
      style={besideStyle ?? [textStyle, glyphRoom]}
      // The room is padding, which a Text's own layout counts: the text is as tall as before.
      onLayout={(event) => onMetric?.({ height: event.nativeEvent.layout.height - roomHeight })}
      onTextLayout={(event) =>
        onMetric?.({ lines: besideInitial(toReportedLines(annotateNativeLines(event.nativeEvent.lines || [], renderedText)), hasInitial) })
      }
    >
      {renderLanguageText(language, theme)}
    </Text>
  );
  return initial ? withInitial(text) : text;
}

function JustifiedVerseBody({ language, textStyle, selectableText, columnWidth, forceLines, minWordsToJustify, fontStyle, fontWeight, glyphRoomFontSize = 0, initial = null, measureOnly, onMetric, theme }) {
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
        firstWordStyle={bibleVerseNumber ? { color: theme.colors.gold, fontWeight: "700" } : language.openingWord?.style ?? null}
        firstWordBaselineShift={bibleVerseNumber ? 0 : language.openingWord?.baselineShift ?? 0}
        wordStyles={wordStyles}
        forceLines={forceLines}
        minWordsToJustify={SLIDESHOW_JUSTIFIED ? minWordsToJustify : Number.POSITIVE_INFINITY}
        selectable={selectableText}
        measureOnly={measureOnly}
        glyphRoomFontSize={glyphRoomFontSize}
        initial={initial}
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
