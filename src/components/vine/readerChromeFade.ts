import { withAlpha } from '../../constants/documentThemes';

/**
 * The fade at the top of a page read under FloatingReaderControls: the text
 * starts below the capsules (topInset), and as it scrolls up under them it
 * fades into the page instead of running on behind them. Solid page from the
 * top of the screen to `start`, clear by `end`, a little above where the text
 * starts so the first line at rest is never touched. Shared by the services'
 * page (documentHtml.ts) and the Bible's (bibleDocumentHtml.ts).
 */
export function readerChromeFade(topInset: number): { start: number; end: number } {
  const end = Math.max(0, Math.round(topInset) - 12);
  return { start: Math.max(0, end - 50), end };
}

/** The fade's own rule, for a `<div class="reader-fade">` fixed over the page; nothing without an inset. */
export function readerChromeFadeCss(page: string, topInset: number): string {
  if (!(topInset > 0)) return '';
  const { start, end } = readerChromeFade(topInset);
  return `
      .reader-fade {
        background: linear-gradient(to bottom, ${page} ${start}px, ${withAlpha(page, 0)} ${end}px);
        height: ${end}px;
        left: 0;
        pointer-events: none;
        position: fixed;
        right: 0;
        top: 0;
        z-index: 3;
      }`;
}

/** The element itself, placed first in the page's body. */
export function readerChromeFadeHtml(topInset: number): string {
  return topInset > 0 ? '<div class="reader-fade" aria-hidden="true"></div>' : '';
}
