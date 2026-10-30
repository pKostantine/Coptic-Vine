import { COPTIC_INITIAL_VIEWBOX, COPTIC_INITIAL_VINE_PIECES, COPTIC_INITIALS } from '../../constants/copticInitialArt';
import { ENGLISH_INITIALS } from '../../constants/englishInitialArt';
import { copticInitialMetrics } from './copticInitial';
import { ENGLISH_FIRST_WORD_NEARER, type EnglishOpeningSplit, englishInitialMetrics, splitRestOfFirstWord } from './openingInitials';

/**
 * The drop cap and decorated first words as the web pages set them, shared by
 * the service reader (documentHtml.ts) and the Bible reader
 * (bibleDocumentHtml.ts); the slideshow sets the same ones natively
 * (VerseBlock.js). copticInitial.ts and openingInitials.ts say how each is
 * made. A line opens so only where it is marked to (DocumentVerse.dropCap, a
 * Bible chapter's verse 1), and a verse that opens so shows no verse number.
 */

const cssPx = (value: number) => `${Math.round(value * 100) / 100}px`;

function escapeText(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** The id a letter's shapes are defined under. */
export function initialKey(letter: string) {
  return letter.codePointAt(0)!.toString(16);
}

/**
 * The shapes the page's initials are drawn from, each defined once: the
 * Coptic letters used with their vines, built from the vine's shared pieces,
 * and the English letters used.
 */
export function openingInitialDefs(copticLetters: Set<string>, englishLetters: Set<string>) {
  const vinePieces = [...new Set([...copticLetters].flatMap((letter) => COPTIC_INITIALS[letter].vine))];
  const coptic = copticLetters.size
    ? `<svg class="ornament-defs" aria-hidden="true"><defs>${
      vinePieces.map((piece) => `<path id="cv-vine-piece-${piece}" d="${COPTIC_INITIAL_VINE_PIECES[piece]}"></path>`).join('')
    }${[...copticLetters].map((letter) => {
      const key = initialKey(letter);
      return `<path id="cv-initial-${key}" d="${COPTIC_INITIALS[letter].letter}"></path><g id="cv-initial-vine-${key}">${
        COPTIC_INITIALS[letter].vine.map((piece) => `<use href="#cv-vine-piece-${piece}"></use>`).join('')
      }</g>`;
    }).join('')}</defs></svg>`
    : '';
  const english = englishLetters.size
    ? `<svg class="ornament-defs" aria-hidden="true"><defs>${[...englishLetters].map((letter) =>
      `<path id="en-initial-${initialKey(letter)}" d="${ENGLISH_INITIALS[letter].letter}"></path>`).join('')}</defs></svg>`
    : '';
  return coptic + english;
}

/**
 * The initials' styles beside a page's verse lines, each `lineHeight` tall,
 * the English (and French) set at `fontSize`: the Coptic initial (its measures
 * from copticInitial.ts), the English one, the first words after them, and
 * what the opening keeps in the text unseen.
 */
export function openingInitialStyles(lineHeight: number, fontSize: number, colors: { vine: string; letter: string }) {
  const initialBox = copticInitialMetrics(lineHeight);
  const englishInitialBox = englishInitialMetrics('A', fontSize, lineHeight);
  return `
      /* The decorated initial opening a hymn's Coptic, as the old books set
         it: two lines tall, its letter and its vine in the initials' colours.
         The gap beside it steps: line 2 starts right at its edge, line 1 a
         little inside it, where the vine is open at that height (the step
         falls just below line 1). Line 3 runs the full width again. */
      .coptic-initial {
        float: left;
        height: ${initialBox.two.height}px;
        margin: ${initialBox.two.top}px 0 0 ${initialBox.two.left}px;
        position: relative;
        shape-margin: 0;
        shape-outside: polygon(0 0, calc(100% - ${initialBox.two.tuck}px) 0, calc(100% - ${initialBox.two.tuck}px) 55%, 100% 55%, 100% 100%, 0 100%);
        width: ${initialBox.two.width}px;
      }
      /* A paragraph too short to wrap around it keeps it a line tall, inline. */
      .coptic-initial.one-line {
        display: inline-block;
        float: none;
        height: ${lineHeight}px;
        margin: 0 ${initialBox.one.right}px 0 ${initialBox.one.left}px;
        shape-outside: none;
        vertical-align: top;
        width: ${initialBox.one.width}px;
      }
      .coptic-initial-art {
        height: 100%;
        left: 0;
        position: absolute;
        top: 0;
        width: 100%;
      }
      .coptic-initial-vine { fill: ${colors.vine}; }
      .coptic-initial-art .coptic-initial-letter { fill: ${colors.letter}; }
      /* The English (and French) opening: its first letter an Old English
         capital, its capitals from line 1's to line 2's baseline and as wide
         as its own letter (set where it is drawn), in the initials' letter
         colour, and the rest of its first word, a little nearer, in small
         capitals. */
      .english-initial {
        float: left;
        height: ${cssPx(englishInitialBox.drawingHeight)};
        margin: ${cssPx(englishInitialBox.top)} ${cssPx(englishInitialBox.room - englishInitialBox.width)} 0 0;
      }
      .english-initial-art {
        display: block;
        height: 100%;
        width: 100%;
      }
      .english-initial-art .english-initial-letter { fill: ${colors.letter}; }
      /* The first word of every column, after its initial, in the letter's colour. */
      .opening-word { color: ${colors.letter}; }
      .english-small-caps {
        font-variant: small-caps;
        letter-spacing: 0.05em;
        margin-left: -${ENGLISH_FIRST_WORD_NEARER.toFixed(4)}em;
      }
      /* Arabic has no capitals: its first word is stretched with kashida, in
         bold at the text's own size -- longer, never bigger. */
      .arabic-opening { font-weight: 700; }
      /* The letter itself stays in the text, unseen, for copying and for
         screen readers; and so does the number of a verse that opens so. */
      .coptic-initial-text, .english-initial-text, .opening-verse-number {
        clip: rect(0 0 0 0);
        clip-path: inset(50%);
        height: 1px;
        overflow: hidden;
        position: absolute;
        white-space: nowrap;
        width: 1px;
      }`;
}

/**
 * The decorated initial, drawn from the shapes the page defines once
 * (openingInitialDefs), with the letter itself kept in the text unseen. It
 * hangs two lines tall unless the page finds the paragraph fits on one line
 * (fitCopticInitials); a centred line has no side to hang it from, so it
 * keeps it a line tall from the start.
 */
export function renderCopticInitial(initial: { letter: string; marks: string }, centered: boolean) {
  const key = initialKey(initial.letter);
  return `<span class="coptic-initial${centered ? ' one-line' : ''}"${centered ? '' : ' data-fit'}>`
    + `<svg class="coptic-initial-art" viewBox="${COPTIC_INITIAL_VIEWBOX}" aria-hidden="true">`
    + `<use class="coptic-initial-vine" href="#cv-initial-vine-${key}"></use><use class="coptic-initial-letter" href="#cv-initial-${key}"></use>`
    + `</svg><span class="coptic-initial-text">${escapeText(initial.letter + initial.marks)}</span></span>`;
}

/**
 * The English (or French) opening initial (openingInitials.ts), drawn from
 * the shape the page defines once (openingInitialDefs), as wide as its own
 * letter beside the page's line, with what it stands for (the letter as
 * written, and any quotation mark before it) kept in the text unseen.
 */
export function renderEnglishInitial(initial: Pick<EnglishOpeningSplit, 'letter' | 'source'>, fontSize: number, lineHeight: number) {
  const metrics = englishInitialMetrics(initial.letter, fontSize, lineHeight);
  return `<span class="english-initial" style="width: ${cssPx(metrics.width)};"><svg class="english-initial-art" viewBox="${metrics.art.viewBox}" aria-hidden="true">`
    + `<use class="english-initial-letter" href="#en-initial-${initialKey(initial.letter)}"></use>`
    + `</svg><span class="english-initial-text">${escapeText(initial.source)}</span></span>`;
}

/**
 * The rest of a paragraph's first word after its initial, in the letter's
 * colour (and in English and French, small capitals), then the paragraph,
 * each written out by `html`.
 */
export function renderOpeningRest(rest: string, html: (text: string) => string, className = '') {
  const first = splitRestOfFirstWord(rest);
  if (!first) return html(rest);
  return `<span class="opening-word${className ? ` ${className}` : ''}">${escapeText(first.word)}</span>${html(first.after)}`;
}

/**
 * The page script's fitCopticInitials(). A decorated initial stands two lines
 * tall, but never beside a paragraph too short to wrap around it: one that
 * fits on a single line with the initial a line tall keeps it so, inline.
 * (Measured without the initial at all, a line that only just fits wraps once
 * it's back, leaving the short initial over two lines the tall one would
 * fill.) The page calls it once it is laid out, and again whenever the text
 * reflows.
 */
export const FIT_COPTIC_INITIALS_SCRIPT = `
      // Within \`root\` (a hymn just opened) or the whole page; anything else
      // it is handed -- a resize event, fonts loaded -- means the whole page.
      // Set in three passes, every initial on one line, then every paragraph
      // measured, then each initial settled: one layout for the lot, where
      // measuring each in turn laid the page out again for every initial.
      function fitCopticInitials(root) {
        var scope = root && root.nodeType === 1 ? root : document;
        var initials = scope.querySelectorAll('.coptic-initial[data-fit]');
        var fits = [];
        for (var i = 0; i < initials.length; i += 1) {
          var paragraph = initials[i].closest('.verse-text');
          if (!paragraph) continue;
          fits.push({ initial: initials[i], paragraph: paragraph, was: initials[i].classList.contains('one-line') });
          initials[i].classList.add('one-line');
        }
        for (var f = 0; f < fits.length; f += 1) {
          var fit = fits[f];
          if (!fit.paragraph.getClientRects().length) {
            fit.oneLine = fit.was;
            continue;
          }
          var range = document.createRange();
          range.setStartBefore(fit.initial);
          range.setEndAfter(fit.paragraph.lastChild);
          var rects = range.getClientRects();
          var lineHeight = parseFloat(getComputedStyle(fit.paragraph).lineHeight) || 1;
          var lines = 0;
          var lineTop = null;
          for (var r = 0; r < rects.length && lines < 2; r += 1) {
            if (!rects[r].width || (lineTop !== null && Math.abs(rects[r].top - lineTop) < lineHeight / 2)) continue;
            lines += 1;
            lineTop = rects[r].top;
          }
          fit.oneLine = lines < 2;
        }
        for (var s = 0; s < fits.length; s += 1) fits[s].initial.classList.toggle('one-line', fits[s].oneLine);
      }`;
