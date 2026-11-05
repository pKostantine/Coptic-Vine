import { COPTIC_INITIAL_VIEWBOX, COPTIC_INITIAL_VINE_PIECES, COPTIC_INITIALS } from '../../constants/copticInitialArt';
import { ENGLISH_INITIALS } from '../../constants/englishInitialArt';
import { copticInitialMetrics, copticLockupGap, hasWideLockupGap } from './copticInitial';
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
export function openingInitialStyles(lineHeight: number, fontSize: number, colors: { vine: string; vineInBlue?: string; letter: string }) {
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
      /* Opening a blue alternate verse, the vine takes the season's colour for one (documentInitialColors). */
      .coptic-initial.in-blue .coptic-initial-vine { fill: ${colors.vineInBlue ?? colors.vine}; }
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
      /* A paragraph of one line beside its initial is the lockup (Coptic
         Vine Reader, "One-line verses: the lockup"): the initial keeps its
         two lines, unfloated, and the line is centred beside them, set tight
         to the letter -- never a tall initial hanging into empty space. The
         page decides after layout (fitCopticInitials); each column on its own. */
      .lockup {
        align-items: center;
        display: flex;
      }
      .lockup > .coptic-initial {
        flex: 0 0 auto;
        float: none;
        margin: ${initialBox.two.top}px ${copticLockupGap('Ⲁ', lineHeight)}px ${cssPx(2 * lineHeight - initialBox.two.height - initialBox.two.top)} ${initialBox.two.left}px;
        shape-outside: none;
      }
      .lockup > .coptic-initial.wide-gap { margin-right: ${copticLockupGap('Ⲙ', lineHeight)}px; }
      .lockup > .english-initial {
        flex: 0 0 auto;
        float: none;
        margin-bottom: ${cssPx(2 * lineHeight - englishInitialBox.drawingHeight - englishInitialBox.top)};
      }
      .lockup > .opening-rest {
        flex: 1 1 auto;
        min-width: 0;
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
export function renderCopticInitial(initial: { letter: string; marks: string }, centered: boolean, inBlueVerse = false) {
  const key = initialKey(initial.letter);
  const wideGap = hasWideLockupGap(initial.letter);
  return `<span class="coptic-initial${centered ? ' one-line' : ''}${inBlueVerse ? ' in-blue' : ''}${wideGap ? ' wide-gap' : ''}"${centered ? '' : ' data-fit'}>`
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
  return `<span class="english-initial" style="width: ${cssPx(metrics.width)};" data-fit><svg class="english-initial-art" viewBox="${metrics.art.viewBox}" aria-hidden="true">`
    + `<use class="english-initial-letter" href="#en-initial-${initialKey(initial.letter)}"></use>`
    + `</svg><span class="english-initial-text">${escapeText(initial.source)}</span></span>`;
}

/**
 * The rest of a paragraph's first word after its initial, in the letter's
 * colour (and in English and French, small capitals), then the paragraph,
 * each written out by `html`.
 */
/**
 * An opening -- its initial and the text after it -- in a span of its own,
 * apart from the speaker's label or verse number before it in the
 * paragraph: what a lockup sets as one row (fitCopticInitials).
 */
export function renderOpening(initialHtml: string, restHtml: string) {
  return `<span class="opening">${initialHtml}${restHtml}</span>`;
}

export function renderOpeningRest(rest: string, html: (text: string) => string, className = '') {
  const first = splitRestOfFirstWord(rest);
  // In a span of its own, so a lockup can set it beside the initial as one piece.
  if (!first) return `<span class="opening-rest">${html(rest)}</span>`;
  return `<span class="opening-rest"><span class="opening-word${className ? ` ${className}` : ''}">${escapeText(first.word)}</span>${html(first.after)}</span>`;
}

/**
 * The page script's fitCopticInitials(). A decorated initial, Coptic or
 * English, stands two lines tall, but never hangs beside a paragraph too
 * short to wrap around it: one whose text fits on a single line beside the
 * initial is the lockup (Coptic Vine Reader, "One-line verses: the lockup"),
 * the initial kept two lines tall and unfloated and the line centred beside
 * it; a longer one floats the initial. Each column decides on its own, set
 * as a lockup and measured there, at the width the initial leaves it. The
 * page calls it once it is laid out, and again whenever the text reflows (a
 * rotation, the text size).
 *
 * It first lets a word of an opening line (.verse-text.opens, whose words
 * are kept whole so none is split beside the initial) break again where it
 * is wider than its whole column, as a long Coptic word can be: kept whole,
 * it would run over into the next column. Only that word, so the rest of
 * its line still keeps whole beside the initial.
 */
export const FIT_COPTIC_INITIALS_SCRIPT = `
      // Within \`root\` (a hymn just opened) or the whole page; anything else
      // it is handed -- a resize event, fonts loaded -- means the whole page.
      // Set in three passes, every initial on one line, then every paragraph
      // measured, then each initial settled: one layout for the lot, where
      // measuring each in turn laid the page out again for every initial.
      function fitOpeningWords(scope) {
        // Last fit's long words back into their text, to be measured afresh
        // (a column is narrower on a phone held upright than sideways).
        var wrapped = scope.querySelectorAll('.verse-text.opens .opening-long-word');
        for (var u = 0; u < wrapped.length; u += 1) {
          var parent = wrapped[u].parentNode;
          parent.replaceChild(document.createTextNode(wrapped[u].textContent), wrapped[u]);
          parent.normalize();
        }
        // Every word wider than its column, in a line that runs over it.
        var openings = scope.querySelectorAll('.verse-text.opens');
        var long = [];
        for (var o = 0; o < openings.length; o += 1) {
          var opening = openings[o];
          if (!opening.getClientRects().length || opening.scrollWidth <= opening.clientWidth + 1) continue;
          var walker = document.createTreeWalker(opening, NodeFilter.SHOW_TEXT);
          for (var node = walker.nextNode(); node; node = walker.nextNode()) {
            var words = /\\S+/g;
            for (var match = words.exec(node.data); match; match = words.exec(node.data)) {
              var range = document.createRange();
              range.setStart(node, match.index);
              range.setEnd(node, match.index + match[0].length);
              if (range.getBoundingClientRect().width > opening.clientWidth + 1) long.push(range);
            }
          }
        }
        // Wrapped last to first, so the words before each are where they were measured.
        for (var l = long.length - 1; l >= 0; l -= 1) {
          var span = document.createElement('span');
          span.className = 'opening-long-word';
          long[l].surroundContents(span);
        }
      }
      function fitCopticInitials(root) {
        var scope = root && root.nodeType === 1 ? root : document;
        fitOpeningWords(scope);
        var initials = scope.querySelectorAll('.coptic-initial[data-fit], .english-initial[data-fit]');
        var fits = [];
        for (var i = 0; i < initials.length; i += 1) {
          var holder = initials[i].parentElement;
          var rest = initials[i].nextElementSibling;
          if (!holder || !rest || !rest.classList.contains('opening-rest')) continue;
          fits.push({ holder: holder, rest: rest, was: holder.classList.contains('lockup') });
          holder.classList.add('lockup');
        }
        for (var f = 0; f < fits.length; f += 1) {
          var fit = fits[f];
          if (!fit.holder.getClientRects().length) {
            fit.lockup = fit.was;
            continue;
          }
          // The text's lines as the lockup sets them, beside the whole initial.
          var range = document.createRange();
          range.selectNodeContents(fit.rest);
          var rects = range.getClientRects();
          var lineHeight = parseFloat(getComputedStyle(fit.rest).lineHeight) || 1;
          var lines = 0;
          var lineTop = null;
          for (var r = 0; r < rects.length && lines < 2; r += 1) {
            if (!rects[r].width || (lineTop !== null && Math.abs(rects[r].top - lineTop) < lineHeight / 2)) continue;
            lines += 1;
            lineTop = rects[r].top;
          }
          fit.lockup = lines < 2;
        }
        for (var s = 0; s < fits.length; s += 1) fits[s].holder.classList.toggle('lockup', fits[s].lockup);
      }`;
