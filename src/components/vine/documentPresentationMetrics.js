/**
 * Shared visual metrics for the scrolling and slideshow document renderers.
 * Keep presentation chrome here so changing modes never changes typography or
 * the shape of an in-document control.
 */

export const DOCUMENT_CONTROL_METRICS = Object.freeze({
  collapseButtonSize: 40,
  collapseCircleSize: 22,
  controlWidthPercent: 84,
  hyperlinkBorderRadius: 12,
  hyperlinkMaxWidth: 420,
  hyperlinkMinHeight: 72,
  openButtonBorderRadius: 12,
  openButtonMaxWidth: 420,
  openButtonMinHeight: 168,
});

/**
 * The space between language columns, as a fraction of the reading font size
 * in pixels. That size already reflects the device as well as the user's
 * setting (size 9 is 38px in a desktop browser and 34px on a phone), so the
 * gap follows both. Tuned to 16px at desktop size 9.
 */
export const LANGUAGE_COLUMN_GAP_RATIO = 16 / 38;

export function getLanguageColumnGap(fontSize) {
  const safeFontSize = Math.max(Number(fontSize) || 18, 1);
  return Math.round(safeFontSize * LANGUAGE_COLUMN_GAP_RATIO);
}

export function getDocumentChromeMetrics(fontSize) {
  const safeFontSize = Math.max(Number(fontSize) || 18, 1);
  const titleFontSize = Math.max(Math.round(safeFontSize * 0.5), 14);
  const titleLineHeight = Math.max(Math.round(safeFontSize * 0.62), 18);
  const buttonFontSize = Math.max(Math.round(titleFontSize * 1.3), 18);
  const buttonLineHeight = Math.max(Math.round(titleLineHeight * 1.3), 24);
  const hyperlinkFontSize = Math.max(Math.round(titleFontSize * 1.1), 16);
  const hyperlinkLineHeight = Math.max(Math.round(hyperlinkFontSize * 1.2), 20);

  return {
    buttonFontSize,
    buttonLineHeight,
    hyperlinkFontSize,
    hyperlinkLineHeight,
    titleFontSize,
    titleLineHeight,
  };
}
