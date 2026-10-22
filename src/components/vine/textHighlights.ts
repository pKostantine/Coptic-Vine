/**
 * The highlighting layer shared by the Sermon Planner and the Bible reader —
 * persistent range highlights over text marked `.sermon-annotatable-text`
 * (carrying `data-sermon-verse-id`/`data-sermon-language`, and optionally
 * `data-sermon-section-id`), a floating toolbar for a selection or a tapped
 * highlight, and Apple Pencil strokes that highlight what they pass over —
 * as Apple Books does:
 *
 * - A Pencil stroke highlights from where it touched down to where it lifts,
 *   down one language column across as many verses as it passes, the page
 *   scrolling on when it reaches the screen's edge. It is painted as it is
 *   drawn, snapped to whole words, in the last colour used.
 * - A finger (or mouse) selection keeps to the column it began in, and the
 *   toolbar offers five colours, underline, a note, Copy.
 * - A highlight made across several verses is one highlight: tapping any of
 *   it offers the toolbar for the whole of it — recolour, underline, note,
 *   copy, remove — and its handles can resize it.
 * - A new highlight that overlaps one already there (or meets one of its own
 *   colour with nothing but spaces and punctuation between) takes it in: the
 *   two become one, never left in pieces.
 *
 * Each highlight is stored a verse at a time (one record per verse and
 * language), the records of one highlight sharing a group (see
 * utils/highlightGroups.ts); the host is sent whole highlights to make,
 * recolour or remove, and paints back whatever it holds.
 */

export interface TextHighlightScriptOptions {
  /** A JavaScript function expression, `function (type, payload) {…}`, that posts an action to the host. */
  emit: string;
  actions: {
    /** Payload `{ anchors, color, style, replaces, openNote }`: one highlight, a verse at a time, taking the place of the segments in `replaces`. */
    create: string;
    /** Payload `{ active }` — the host suspends its edge swipes while a Pencil stroke is down. */
    pencil: string;
    /** Payload `{ highlightId }` — the note of the highlight that segment belongs to. */
    openNote?: string;
    /** Payload `{ highlightId, color, style }` — for the whole highlight that segment belongs to. */
    recolor?: string;
    /** Payload `{ highlightId }` — the whole highlight that segment belongs to. */
    remove?: string;
    /** Payload `{ text, html? }` — only when the page's own copy command is refused. */
    copy?: string;
  };
  /** Tapping a highlight selects the whole of it and offers recolour/underline/note/copy/remove in the toolbar. */
  tapToEdit?: boolean;
  /** Adds Copy to the toolbar. */
  copy?: boolean;
  /** Adds Note to the toolbar: a new selection is highlighted and its note opened; a tapped highlight's note is opened. */
  notes?: boolean;
  /** A JavaScript expression for the page's `function (selection) { return { text, html } | null; }` that formats what Copy puts on the clipboard; read when Copy is tapped. */
  copyPayload?: string;
  /** A selection only highlights within the language column it started in. */
  singleLanguage?: boolean;
  labels?: { copy?: string; remove?: string; note?: string; underline?: string };
}

/** The colours, in Apple Books' order: yellow, green, blue, pink, purple. */
const MARK_COLORS: Record<string, { wash: string; swatch: string }> = {
  gold: { wash: 'rgba(235, 190, 52, 0.46)', swatch: '#d7ad2c' },
  green: { wash: 'rgba(74, 173, 116, 0.44)', swatch: '#4aaa73' },
  blue: { wash: 'rgba(75, 154, 219, 0.46)', swatch: '#4c9ad8' },
  rose: { wash: 'rgba(232, 91, 120, 0.42)', swatch: '#d65b75' },
  purple: { wash: 'rgba(155, 109, 214, 0.44)', swatch: '#9b6dd6' },
};

/** A highlight colour's wash, as the page lays it over the text (gold for a colour it doesn't know). */
export function highlightWash(color: string | null | undefined): string {
  return (MARK_COLORS[color ?? ''] ?? MARK_COLORS.gold).wash;
}

/**
 * The layer's styles. `columns` names the language columns a page sets side
 * by side: while a selection is made in one, the others can't be selected,
 * so the selection (and what it highlights) keeps to the column it began in.
 */
export function textHighlightStyles(columns: readonly string[] = []) {
  const colorRules = Object.entries(MARK_COLORS).map(([color, { wash, swatch }]) => `
      mark.sermon-highlight[data-sermon-color="${color}"] { background: ${wash}; }
      mark.sermon-highlight[data-style="underline"][data-sermon-color="${color}"] { background: transparent; text-decoration-color: ${swatch}; }
      .sermon-color-button[data-color="${color}"] { background: ${swatch}; }
      ::highlight(vine-preview-${color}) { background-color: ${wash}; }`).join('');
  const columnRules = columns.map((language) => `
      body[data-highlight-column="${language}"] .sermon-annotatable-text:not([data-sermon-language="${language}"]),
      body[data-highlight-column="${language}"] .cell[data-language]:not([data-language="${language}"]),
      body[data-highlight-column="${language}"] .cell[data-language]:not([data-language="${language}"]) * {
        -webkit-user-select: none;
        user-select: none;
      }`).join('');
  return `
      .sermon-annotatable-text {
        -webkit-user-select: text;
        user-select: text;
        /* The toolbar is this text's menu. Suppressing the callout stops iOS
           offering its own on top of it; the contextmenu handler below covers
           a desktop right-click and Android's long press. */
        -webkit-touch-callout: none;
      }
      mark.sermon-highlight {
        border-radius: 3px;
        box-decoration-break: clone;
        -webkit-box-decoration-break: clone;
        color: inherit;
        cursor: pointer;
        padding: 0 0.05em;
      }
      mark.sermon-highlight[data-style="underline"] {
        text-decoration-line: underline;
        text-decoration-thickness: 0.13em;
        text-underline-offset: 0.2em;
      }
      ${colorRules}
      /* The whole of a tapped highlight, however many verses it spans. */
      mark.sermon-highlight.is-active-group {
        outline: 2px solid rgba(235, 190, 52, 0.9);
        outline-offset: 1px;
      }
      /* A highlight with a note carries a small mark after its first words,
         as Books marks one. Pseudo-content, so not part of the text. */
      mark.sermon-highlight[data-has-note="true"]::after {
        background: currentColor;
        border-radius: 999px;
        content: '';
        display: inline-block;
        height: 0.32em;
        margin-left: 0.18em;
        opacity: 0.7;
        vertical-align: super;
        width: 0.32em;
      }
      mark.sermon-highlight.sermon-highlight-pulse { animation: sermon-highlight-pulse 900ms ease-out; }
      @keyframes sermon-highlight-pulse {
        0%, 100% { outline: 0 solid rgba(235, 190, 52, 0); }
        35% { outline: 5px solid rgba(235, 190, 52, 0.42); }
      }
      ${columnRules}
      #sermon-highlight-tools {
        align-items: center;
        background: #151719;
        border: 1px solid rgba(235, 190, 52, 0.5);
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.48);
        display: none;
        gap: 8px;
        padding: 8px 10px;
        position: fixed;
        transform: translate(-50%, -100%);
        z-index: 2147483647;
      }
      #sermon-highlight-tools.is-visible { display: flex; }
      #sermon-highlight-tools.is-below { transform: translate(-50%, 0); }
      .text-highlight-colors { align-items: center; display: flex; gap: 7px; }
      .sermon-color-button {
        border: 2px solid rgba(255, 255, 255, 0.72);
        border-radius: 999px;
        cursor: pointer;
        height: 28px;
        padding: 0;
        width: 28px;
      }
      .sermon-color-button.is-current { box-shadow: 0 0 0 2px #151719, 0 0 0 4px #f4f1e8; }
      .text-highlight-underline {
        background: transparent;
        border: 1.5px solid rgba(244, 241, 232, 0.55);
        border-radius: 999px;
        color: #f4f1e8;
        cursor: pointer;
        font: 700 15px/1 Georgia, serif;
        height: 28px;
        padding: 0;
        text-decoration: underline;
        text-decoration-thickness: 2px;
        text-underline-offset: 3px;
        width: 28px;
      }
      .text-highlight-underline.is-on { background: rgba(244, 241, 232, 0.2); border-color: #f4f1e8; }
      .text-highlight-divider {
        align-self: stretch;
        background: rgba(235, 190, 52, 0.35);
        width: 1px;
      }
      .text-highlight-action {
        background: transparent;
        border: 0;
        border-radius: 6px;
        color: #f4f1e8;
        cursor: pointer;
        font: 700 14px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
        padding: 7px 6px;
        white-space: nowrap;
      }
      .text-highlight-action:active { background: rgba(235, 190, 52, 0.22); }
      .text-highlight-action[hidden], .text-highlight-divider[hidden] { display: none; }
  `;
}

export function textHighlightScript(options: TextHighlightScriptOptions) {
  const labels = { copy: 'Copy', remove: 'Remove', note: 'Note', underline: 'Underline', ...(options.labels || {}) };
  return `
      (function () {
        var emit = ${options.emit};
        var ACTIONS = ${JSON.stringify(options.actions)};
        var TAP_TO_EDIT = ${JSON.stringify(Boolean(options.tapToEdit))};
        var COPY = ${JSON.stringify(Boolean(options.copy))};
        var NOTES = ${JSON.stringify(Boolean(options.notes))};
        var SINGLE_LANGUAGE = ${JSON.stringify(Boolean(options.singleLanguage))};
        var COLORS = ${JSON.stringify(Object.keys(MARK_COLORS))};
        var currentHighlights = [];
        // Highlights that arrived mid-stroke, painted once the Pencil lifts.
        var pendingHighlights = null;
        // The highlight whose toolbar is up: { groupId, highlightId, color, style, text, resizing }.
        var editing = null;
        // The selection the toolbar acts on, kept apart from the live one: on
        // a phone a tap can clear the live selection before a button hears it.
        var savedRange = null;
        var paletteTouch = null;
        var lastTouchActivation = 0;
        var suppressClickUntil = 0;
        var showTimer = 0;
        var mouseDown = false;
        var pendingCopy = null;
        var copyWritten = false;
        var annotationSelector = '.sermon-annotatable-text[data-sermon-verse-id][data-sermon-language]';

        // The colour (and style) the Pencil draws in: the last one chosen, as in Books.
        var pen = { color: 'gold', style: null };
        try {
          var storedPen = JSON.parse(window.localStorage.getItem('vine.highlightPen') || 'null');
          if (storedPen && COLORS.indexOf(storedPen.color) >= 0) pen = { color: storedPen.color, style: storedPen.style === 'underline' ? 'underline' : null };
        } catch (error) {}
        function rememberPen(color, style) {
          if (COLORS.indexOf(color) < 0) return;
          pen = { color: color, style: style === 'underline' ? 'underline' : null };
          try { window.localStorage.setItem('vine.highlightPen', JSON.stringify(pen)); } catch (error) {}
        }

        var palette = document.createElement('div');
        palette.id = 'sermon-highlight-tools';
        palette.setAttribute('role', 'toolbar');
        palette.setAttribute('aria-label', 'Highlight selected text');
        var colorRow = document.createElement('span');
        colorRow.className = 'text-highlight-colors';
        COLORS.forEach(function (color) {
          var button = document.createElement('button');
          button.className = 'sermon-color-button';
          button.type = 'button';
          button.setAttribute('data-color', color);
          button.setAttribute('aria-label', 'Highlight ' + color);
          colorRow.appendChild(button);
        });
        palette.appendChild(colorRow);
        var underlineButton = document.createElement('button');
        underlineButton.className = 'text-highlight-underline';
        underlineButton.type = 'button';
        underlineButton.setAttribute('data-action', 'underline');
        underlineButton.setAttribute('aria-label', ${JSON.stringify(labels.underline)});
        underlineButton.textContent = 'A';
        palette.appendChild(underlineButton);
        function addAction(action, label) {
          var divider = document.createElement('span');
          divider.className = 'text-highlight-divider';
          palette.appendChild(divider);
          var button = document.createElement('button');
          button.className = 'text-highlight-action';
          button.type = 'button';
          button.setAttribute('data-action', action);
          button.textContent = label;
          palette.appendChild(button);
          return { button: button, divider: divider };
        }
        var noteAction = NOTES ? addAction('note', ${JSON.stringify(labels.note)}) : null;
        var copyAction = COPY ? addAction('copy', ${JSON.stringify(labels.copy)}) : null;
        var removeAction = TAP_TO_EDIT && ACTIONS.remove ? addAction('remove', ${JSON.stringify(labels.remove)}) : null;
        document.body.appendChild(palette);

        function closestRoot(node) {
          var element = node && node.nodeType === 1 ? node : node && node.parentElement;
          return element && element.closest ? element.closest(annotationSelector) : null;
        }

        function rootFor(verseId, language) {
          return document.querySelector(annotationSelector
            + '[data-sermon-verse-id="' + CSS.escape(String(verseId || '')) + '"]'
            + '[data-sermon-language="' + CSS.escape(String(language || '')) + '"]');
        }

        function isShown(root) {
          return root.getClientRects().length > 0;
        }

        // The highlight a record belongs to: its group, carried in the
        // record or in its id (\`<group>~<index>\`); its own id for one made
        // alone. See utils/highlightGroups.ts.
        function groupOf(highlight) {
          if (highlight.groupId) return String(highlight.groupId);
          var id = String(highlight.id || '');
          var mark = id.lastIndexOf('~');
          return mark > 0 ? id.slice(0, mark) : id;
        }
        function segmentIndexOf(highlight) {
          var id = String(highlight.id || '');
          var mark = id.lastIndexOf('~');
          var index = mark > 0 ? Number(id.slice(mark + 1)) : 0;
          return isFinite(index) ? index : 0;
        }
        function groupLead(groupId) {
          var lead = null;
          currentHighlights.forEach(function (highlight) {
            if (groupOf(highlight) !== groupId) return;
            if (!lead || segmentIndexOf(highlight) < segmentIndexOf(lead)) lead = highlight;
          });
          return lead;
        }
        function groupMarks(groupId) {
          return Array.prototype.slice.call(document.querySelectorAll('mark.sermon-highlight[data-highlight-group="' + CSS.escape(String(groupId)) + '"]'));
        }

        function unwrapHighlights() {
          var parents = [];
          Array.prototype.slice.call(document.querySelectorAll('mark.sermon-highlight')).forEach(function (mark) {
            var parent = mark.parentNode;
            while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
            parent.removeChild(mark);
            if (parents.indexOf(parent) < 0) parents.push(parent);
          });
          parents.forEach(function (parent) { parent.normalize(); });
        }

        function boundaryForOffset(root, requestedOffset) {
          var offset = Math.max(0, Math.min(Number(requestedOffset) || 0, root.textContent.length));
          var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
          var consumed = 0;
          var node;
          while ((node = walker.nextNode())) {
            var next = consumed + node.nodeValue.length;
            if (offset <= next) return { node: node, offset: offset - consumed };
            consumed = next;
          }
          return { node: root, offset: root.childNodes.length };
        }

        function rangeInRoot(root, start, end) {
          var left = boundaryForOffset(root, start);
          var right = boundaryForOffset(root, end);
          var range = document.createRange();
          try {
            range.setStart(left.node, left.offset);
            range.setEnd(right.node, right.offset);
            return range;
          } catch (error) {
            return null;
          }
        }

        function resolveOffsets(root, highlight) {
          var text = root.textContent || '';
          var start = Math.max(0, Math.min(Number(highlight.startOffset) || 0, text.length));
          var end = Math.max(start, Math.min(Number(highlight.endOffset) || start, text.length));
          var quote = String(highlight.quote || '');
          if (quote && text.slice(start, end) !== quote) {
            var nearbyStart = Math.max(0, start - 80);
            var nearby = text.slice(nearbyStart, Math.min(text.length, end + 80));
            var nearbyIndex = nearby.indexOf(quote);
            if (nearbyIndex >= 0) {
              start = nearbyStart + nearbyIndex;
              end = start + quote.length;
            } else {
              var firstIndex = text.indexOf(quote);
              if (firstIndex >= 0 && text.indexOf(quote, firstIndex + 1) < 0) {
                start = firstIndex;
                end = firstIndex + quote.length;
              }
            }
          }
          return { start: start, end: end };
        }

        function applyHighlights() {
          unwrapHighlights();
          var leads = {};
          currentHighlights.forEach(function (highlight) {
            var group = groupOf(highlight);
            if (!leads[group] || segmentIndexOf(highlight) < segmentIndexOf(leads[group])) leads[group] = highlight;
          });
          var ordered = currentHighlights.slice().sort(function (a, b) {
            return Number(b.startOffset) - Number(a.startOffset);
          });
          ordered.forEach(function (highlight) {
            var root = rootFor(highlight.verseId, highlight.language);
            if (!root) return;
            var offsets = resolveOffsets(root, highlight);
            if (offsets.end <= offsets.start) return;
            var range = rangeInRoot(root, offsets.start, offsets.end);
            if (!range) return;
            try {
              var group = groupOf(highlight);
              var mark = document.createElement('mark');
              mark.className = 'sermon-highlight';
              mark.setAttribute('data-sermon-highlight-id', String(highlight.id));
              mark.setAttribute('data-highlight-group', group);
              mark.setAttribute('data-sermon-color', COLORS.indexOf(highlight.color) >= 0 ? String(highlight.color) : 'gold');
              if (highlight.style === 'underline') mark.setAttribute('data-style', 'underline');
              if (leads[group] === highlight && String(highlight.note || '').trim()) mark.setAttribute('data-has-note', 'true');
              mark.appendChild(range.extractContents());
              range.insertNode(mark);
            } catch (error) {
              // A stale anchor should never make the document unreadable.
            }
          });
        }

        window.setSermonHighlights = function (highlights) {
          var list = Array.isArray(highlights) ? highlights : [];
          if (stroke) {
            pendingHighlights = list;
            return;
          }
          // The highlight just made has come back: its preview gives way to it.
          var known = {};
          currentHighlights.forEach(function (highlight) { known[highlight.id] = true; });
          var arrived = list.some(function (highlight) { return !known[highlight.id]; });
          currentHighlights = list;
          applyHighlights();
          if (arrived) clearPreview();
          refreshEditing();
        };

        window.scrollToSermonHighlight = function (highlightId) {
          var mark = document.querySelector('mark[data-sermon-highlight-id="' + CSS.escape(String(highlightId || '')) + '"]');
          if (!mark) return false;
          // A document page holds its last jump for a moment (documentHtml.ts);
          // this smooth scroll must not be pulled back to it.
          if (window.releaseHeldJump) window.releaseHeldJump();
          mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
          mark.classList.remove('sermon-highlight-pulse');
          void mark.offsetWidth;
          mark.classList.add('sermon-highlight-pulse');
          return true;
        };

        function offsetInRoot(root, node, offset) {
          var range = document.createRange();
          range.selectNodeContents(root);
          try {
            range.setEnd(node, offset);
            return range.toString().length;
          } catch (error) {
            return 0;
          }
        }

        // The word around a character, for a stroke that never left one word.
        var wordSegmenter = null;
        try {
          wordSegmenter = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'word' }) : null;
        } catch (error) {
          wordSegmenter = null;
        }
        function wordAround(text, index) {
          if (index < 0 || index >= text.length) return null;
          if (wordSegmenter) {
            var segments = wordSegmenter.segment(text);
            if (segments.containing) {
              var part = segments.containing(index);
              return part && part.isWordLike ? { start: part.index, end: part.index + part.segment.length } : null;
            }
          }
          var wordChar = function (char) { return /[\\p{L}\\p{M}\\p{N}_]/u.test(char); };
          if (!wordChar(text.charAt(index))) return null;
          var start = index, end = index + 1;
          while (start > 0 && wordChar(text.charAt(start - 1))) start -= 1;
          while (end < text.length && wordChar(text.charAt(end))) end += 1;
          return { start: start, end: end };
        }

        // Side-by-side columns interleave in the DOM (verse 1's English,
        // Coptic, Arabic, then verse 2's…), so a selection down one column
        // also crosses the others; it only highlights the column it began in.
        function selectionLanguage(range) {
          var start = closestRoot(range.startContainer) || closestRoot(range.endContainer);
          if (start) return start.getAttribute('data-sermon-language');
          var column = document.body.getAttribute('data-highlight-column');
          if (column) return column;
          var roots = document.querySelectorAll(annotationSelector);
          for (var i = 0; i < roots.length; i += 1) {
            try {
              if (range.intersectsNode(roots[i])) return roots[i].getAttribute('data-sermon-language');
            } catch (error) {
              // Keep looking.
            }
          }
          return null;
        }

        // A column's text, in reading order, leaving out what is hidden (a
        // collapsed hymn).
        function columnRoots(language) {
          return Array.prototype.filter.call(
            document.querySelectorAll(annotationSelector + '[data-sermon-language="' + CSS.escape(String(language)) + '"]'),
            isShown
          );
        }

        // Each piece trimmed of its spaces, and the two outer ends snapped to
        // whole words.
        function finishSegments(segments) {
          var trimmed = [];
          segments.forEach(function (segment) {
            var text = segment.root.textContent || '';
            var start = Math.max(0, Math.min(segment.start, text.length));
            var end = Math.max(start, Math.min(segment.end, text.length));
            while (start < end && /\\s/.test(text.charAt(start))) start += 1;
            while (end > start && /\\s/.test(text.charAt(end - 1))) end -= 1;
            if (end > start) trimmed.push({ root: segment.root, start: start, end: end });
          });
          if (!trimmed.length) return trimmed;
          var first = trimmed[0];
          var firstWords = expandToWholeWords(first.root.textContent || '', first.start, first.end);
          first.start = firstWords.start;
          if (trimmed.length === 1) first.end = firstWords.end;
          var last = trimmed[trimmed.length - 1];
          if (trimmed.length > 1) last.end = expandToWholeWords(last.root.textContent || '', last.start, last.end).end;
          return trimmed;
        }

        function selectionSegments(selection) {
          if (!selection || !selection.rangeCount || selection.isCollapsed) return [];
          var range = selection.getRangeAt(0);
          var language = SINGLE_LANGUAGE ? selectionLanguage(range) : null;
          var roots = language
            ? columnRoots(language)
            : Array.prototype.filter.call(document.querySelectorAll(annotationSelector), isShown);
          var segments = [];
          roots.forEach(function (root) {
            try {
              if (!range.intersectsNode(root)) return;
            } catch (error) {
              return;
            }
            var text = root.textContent || '';
            var start = root.contains(range.startContainer) ? offsetInRoot(root, range.startContainer, range.startOffset) : 0;
            var end = root.contains(range.endContainer) ? offsetInRoot(root, range.endContainer, range.endOffset) : text.length;
            segments.push({ root: root, start: start, end: end });
          });
          return finishSegments(segments);
        }

        function anchorFor(segment) {
          var root = segment.root;
          var text = root.textContent || '';
          return {
            sectionId: root.getAttribute('data-sermon-section-id'),
            verseId: root.getAttribute('data-sermon-verse-id'),
            language: root.getAttribute('data-sermon-language'),
            startOffset: segment.start,
            endOffset: segment.end,
            quote: text.slice(segment.start, segment.end),
          };
        }

        // Intl.Segmenter respects punctuation and multilingual word boundaries
        // (English contractions, Arabic and Coptic); the Unicode fallback
        // handles older embedded WebViews.
        function expandToWholeWords(text, start, end) {
          var segmenter = typeof Intl !== 'undefined' && Intl.Segmenter
            ? new Intl.Segmenter(undefined, { granularity: 'word' }) : null;
          if (segmenter) {
            var segments = Array.from(segmenter.segment(text));
            segments.forEach(function (part) {
              if (!part.isWordLike) return;
              var wordStart = part.index, wordEnd = part.index + part.segment.length;
              if (wordStart < start && start < wordEnd) start = wordStart;
              if (wordStart < end && end < wordEnd) end = wordEnd;
            });
          } else {
            var wordChar = function (char) { return /[\\p{L}\\p{M}\\p{N}_]/u.test(char); };
            while (start > 0 && wordChar(text.charAt(start)) && wordChar(text.charAt(start - 1))) start -= 1;
            while (end < text.length && wordChar(text.charAt(end - 1)) && wordChar(text.charAt(end))) end += 1;
          }
          return { start: start, end: end };
        }

        function anchorsFromSelection(selection) {
          return selectionSegments(selection).map(anchorFor);
        }

        // Spaces and punctuation alone between two highlights don't keep them apart.
        function onlyGap(text) {
          return /^[\\s\\p{P}\\p{S}]*$/u.test(text);
        }

        /**
         * What a new highlight over these segments makes: the segments, with
         * the whole of every highlight they overlap (or meet, in the same
         * colour, across nothing but spaces and punctuation) taken in, so no
         * highlight is left in pieces -- or, resizing one, that one replaced
         * by the new extent. A verse at a time, in reading order.
         */
        function buildCreation(segments, color, replaceGroup) {
          var absorbed = {};
          if (replaceGroup) absorbed[replaceGroup] = 'replace';
          segments.forEach(function (segment) {
            var verseId = segment.root.getAttribute('data-sermon-verse-id');
            var language = segment.root.getAttribute('data-sermon-language');
            var text = segment.root.textContent || '';
            currentHighlights.forEach(function (highlight) {
              if (highlight.verseId !== verseId || highlight.language !== language) return;
              var group = groupOf(highlight);
              if (absorbed[group]) return;
              var offsets = resolveOffsets(segment.root, highlight);
              var overlaps = segment.start < offsets.end && offsets.start < segment.end;
              var gap = segment.end <= offsets.start ? text.slice(segment.end, offsets.start) : text.slice(offsets.end, segment.start);
              var meets = !overlaps && highlight.color === color && onlyGap(gap);
              if (overlaps || meets) absorbed[group] = 'merge';
            });
          });
          var pieces = [];
          function addPiece(root, start, end) {
            for (var i = 0; i < pieces.length; i += 1) {
              if (pieces[i].root === root) {
                pieces[i].intervals.push([start, end]);
                return;
              }
            }
            pieces.push({ root: root, intervals: [[start, end]] });
          }
          segments.forEach(function (segment) { addPiece(segment.root, segment.start, segment.end); });
          var replaces = [];
          currentHighlights.forEach(function (highlight) {
            var how = absorbed[groupOf(highlight)];
            if (!how) return;
            replaces.push(String(highlight.id));
            if (how !== 'merge') return;
            var root = rootFor(highlight.verseId, highlight.language);
            if (!root) return;
            var offsets = resolveOffsets(root, highlight);
            if (offsets.end > offsets.start) addPiece(root, offsets.start, offsets.end);
          });
          var merged = [];
          pieces.forEach(function (piece) {
            var text = piece.root.textContent || '';
            var intervals = piece.intervals.sort(function (a, b) { return a[0] - b[0]; });
            var current = null;
            intervals.forEach(function (interval) {
              if (current && (interval[0] <= current[1] || onlyGap(text.slice(current[1], interval[0])))) {
                current[1] = Math.max(current[1], interval[1]);
              } else {
                if (current) merged.push({ root: piece.root, start: current[0], end: current[1] });
                current = interval.slice();
              }
            });
            if (current) merged.push({ root: piece.root, start: current[0], end: current[1] });
          });
          merged.sort(function (a, b) {
            if (a.root === b.root) return a.start - b.start;
            return a.root.compareDocumentPosition(b.root) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
          });
          return { segments: merged, anchors: merged.map(anchorFor), replaces: replaces };
        }

        // ---- The preview of a highlight being drawn ------------------------
        // The CSS Custom Highlight API paints ranges without touching the page
        // (iOS 17.2 and later); before it, the selection stands in, kept to
        // the column.
        var supportsCustomHighlights = typeof Highlight === 'function' && window.CSS && CSS.highlights && typeof CSS.highlights.set === 'function';
        var previewTimer = 0;
        function clearPreview() {
          clearTimeout(previewTimer);
          if (!supportsCustomHighlights) return;
          COLORS.forEach(function (color) { CSS.highlights.delete('vine-preview-' + color); });
        }
        function paintPreview(segments, color) {
          if (supportsCustomHighlights) {
            COLORS.forEach(function (other) { if (other !== color) CSS.highlights.delete('vine-preview-' + other); });
            var highlight = new Highlight();
            segments.forEach(function (segment) {
              var range = rangeInRoot(segment.root, segment.start, segment.end);
              if (range) highlight.add(range);
            });
            CSS.highlights.set('vine-preview-' + (COLORS.indexOf(color) >= 0 ? color : 'gold'), highlight);
            return;
          }
          var selection = window.getSelection && window.getSelection();
          if (!selection || !segments.length) return;
          var first = segments[0], last = segments[segments.length - 1];
          var left = boundaryForOffset(first.root, first.start);
          var right = boundaryForOffset(last.root, last.end);
          var range = document.createRange();
          try {
            range.setStart(left.node, left.offset);
            range.setEnd(right.node, right.offset);
            selection.removeAllRanges();
            selection.addRange(range);
          } catch (error) {
            // Don't interrupt the stroke if a verse was re-rendered mid-drag.
          }
        }

        // ---- The toolbar ----------------------------------------------------
        function setEditing(state) {
          editing = state || null;
          palette.classList.toggle('is-editing', Boolean(editing));
          var resizing = Boolean(editing && editing.resizing);
          Array.prototype.forEach.call(colorRow.children, function (button) {
            button.classList.toggle('is-current', Boolean(editing && !resizing && !editing.style && button.getAttribute('data-color') === editing.color));
          });
          underlineButton.classList.toggle('is-on', Boolean(editing && !resizing && editing.style === 'underline'));
          if (removeAction) {
            removeAction.button.hidden = !editing || resizing;
            removeAction.divider.hidden = !editing || resizing;
          }
          markActiveGroup(editing ? editing.groupId : null);
        }

        function markActiveGroup(groupId) {
          Array.prototype.forEach.call(document.querySelectorAll('mark.sermon-highlight.is-active-group'), function (mark) {
            mark.classList.remove('is-active-group');
          });
          if (groupId) groupMarks(groupId).forEach(function (mark) { mark.classList.add('is-active-group'); });
        }

        // After the highlights are painted again: the tapped one, if it is
        // still there, keeps its toolbar (in its new colour).
        function refreshEditing() {
          if (!editing) return;
          var lead = groupLead(editing.groupId);
          if (!lead) {
            hidePalette();
            return;
          }
          setEditing({ groupId: editing.groupId, highlightId: String(lead.id), color: lead.color, style: lead.style || null, text: editing.text, resizing: editing.resizing });
        }

        function hidePalette() {
          clearTimeout(showTimer);
          palette.classList.remove('is-visible');
          setEditing(null);
        }

        function rememberSelection() {
          var selection = window.getSelection && window.getSelection();
          if (selection && selection.rangeCount && !selection.isCollapsed) savedRange = selection.getRangeAt(0).cloneRange();
        }

        // The live selection, or — when a tap has already cleared it — the one
        // the toolbar kept, shaped like a Selection for the code that reads it.
        function selectionForToolbar() {
          var selection = window.getSelection && window.getSelection();
          if (selection && selection.rangeCount && !selection.isCollapsed) return selection;
          if (!savedRange || savedRange.collapsed) return selection;
          var range = savedRange;
          return {
            rangeCount: 1,
            isCollapsed: false,
            anchorNode: range.startContainer,
            focusNode: range.endContainer,
            getRangeAt: function () { return range; },
            toString: function () { return range.toString(); }
          };
        }

        function restoreLiveSelection() {
          var selection = window.getSelection && window.getSelection();
          if (!selection || !savedRange || (selection.rangeCount && !selection.isCollapsed)) return;
          try {
            selection.removeAllRanges();
            selection.addRange(savedRange);
          } catch (error) {
            // The kept range no longer fits the page; Copy falls back to the host.
          }
        }

        function clearSelection() {
          savedRange = null;
          var selection = window.getSelection && window.getSelection();
          if (selection) selection.removeAllRanges();
        }

        function selectionTouchesText(selection) {
          if (!selection || !selection.rangeCount || selection.isCollapsed) return false;
          var range = selection.getRangeAt(0);
          return Boolean(closestRoot(range.startContainer) || closestRoot(range.endContainer));
        }

        // Above the selection's first line, as Books sets it; below its last
        // when there is no room above. Centred, but kept whole on screen.
        function placePalette(range) {
          palette.classList.add('is-visible');
          var rects = range && range.getClientRects ? range.getClientRects() : [];
          var whole = range.getBoundingClientRect();
          var first = rects.length ? rects[0] : whole;
          var last = rects.length ? rects[rects.length - 1] : whole;
          var half = Math.max(90, Math.ceil(palette.offsetWidth / 2) + 8);
          var x = Math.max(half, Math.min(window.innerWidth - half, whole.left + whole.width / 2));
          var height = palette.offsetHeight || 46;
          var above = first.top - 12 - height >= 8;
          palette.classList.toggle('is-below', !above);
          var y = above ? first.top - 12 : Math.min(window.innerHeight - height - 8, last.bottom + 12);
          palette.style.left = x + 'px';
          palette.style.top = y + 'px';
        }

        function groupRange(groupId) {
          var marks = groupMarks(groupId);
          if (!marks.length) return null;
          var range = document.createRange();
          range.setStartBefore(marks[0]);
          range.setEndAfter(marks[marks.length - 1]);
          return range;
        }

        // The toolbar for the whole highlight a mark belongs to, its text
        // selected so Copy has it and its handles can resize it.
        function openGroupMenu(mark) {
          var groupId = mark.getAttribute('data-highlight-group') || mark.getAttribute('data-sermon-highlight-id');
          var lead = groupLead(groupId);
          var range = groupRange(groupId);
          if (!lead || !range) return;
          var root = closestRoot(mark);
          if (root && SINGLE_LANGUAGE) document.body.setAttribute('data-highlight-column', root.getAttribute('data-sermon-language'));
          var selection = window.getSelection && window.getSelection();
          try {
            if (selection) {
              selection.removeAllRanges();
              selection.addRange(range);
            }
          } catch (error) {
            // The toolbar still acts on the highlight itself.
          }
          savedRange = range.cloneRange();
          setEditing({ groupId: groupId, highlightId: String(lead.id), color: lead.color, style: lead.style || null, text: range.toString(), resizing: false });
          placePalette(range);
        }

        // A selection inside one highlight is that highlight: its toolbar.
        function markHolding(segments) {
          if (segments.length !== 1) return null;
          var segment = segments[0];
          var verseId = segment.root.getAttribute('data-sermon-verse-id');
          var language = segment.root.getAttribute('data-sermon-language');
          for (var i = 0; i < currentHighlights.length; i += 1) {
            var highlight = currentHighlights[i];
            if (highlight.verseId !== verseId || highlight.language !== language) continue;
            var offsets = resolveOffsets(segment.root, highlight);
            if (offsets.start <= segment.start && segment.end <= offsets.end) {
              return document.querySelector('mark[data-sermon-highlight-id="' + CSS.escape(String(highlight.id)) + '"]');
            }
          }
          return null;
        }

        function showPaletteForSelection(expand) {
          if (stroke) return;
          // A tapped highlight's own toolbar stays up until the reader moves on.
          if (editing && !editing.resizing) return;
          var selection = window.getSelection && window.getSelection();
          if (!selectionTouchesText(selection)) {
            // Leave the toolbar up while a press on it is in progress.
            if (!paletteTouch) hidePalette();
            return;
          }
          var segments = selectionSegments(selection);
          if (!segments.length) {
            if (!paletteTouch) hidePalette();
            return;
          }
          if (!editing) {
            var holding = markHolding(segments);
            if (holding && TAP_TO_EDIT) {
              openGroupMenu(holding);
              return;
            }
          }
          if (expand !== false) {
            // The selection shown as it will be highlighted: whole words.
            var first = segments[0], last = segments[segments.length - 1];
            var left = boundaryForOffset(first.root, first.start);
            var right = boundaryForOffset(last.root, last.end);
            var range = document.createRange();
            try {
              range.setStart(left.node, left.offset);
              range.setEnd(right.node, right.offset);
              selection.removeAllRanges();
              selection.addRange(range);
            } catch (error) {
              // Keep the reader's own selection when the page changed mid-drag.
            }
          }
          rememberSelection();
          placePalette(selection.getRangeAt(0));
        }

        function commitSelection(color, style, openNote) {
          var selection = selectionForToolbar();
          if (editing && !editing.resizing) {
            if (ACTIONS.recolor) emit(ACTIONS.recolor, { highlightId: editing.highlightId, color: color, style: style || null });
            rememberPen(color, style);
          } else {
            var segments = selectionSegments(selection);
            if (segments.length) {
              var creation = buildCreation(segments, color, editing && editing.resizing ? editing.groupId : null);
              emit(ACTIONS.create, { anchors: creation.anchors, color: color, style: style || null, replaces: creation.replaces, openNote: Boolean(openNote) });
              rememberPen(color, style);
              // Painted at once, until the page hears it back.
              paintPreview(creation.segments, color);
              previewTimer = setTimeout(clearPreview, 1500);
            }
          }
          clearSelection();
          hidePalette();
        }

        function copyPayloadFor(selection) {
          var build = ${options.copyPayload || 'null'};
          if (typeof build === 'function') {
            try {
              var payload = build(selection);
              if (payload && payload.text) return payload;
            } catch (error) {}
          }
          var text = selection ? selection.toString() : '';
          return text ? { text: text } : null;
        }

        // Copy writes its payload (plain and rich) through the page's own copy
        // command, which the tap allows in a browser and in the app's WebView
        // alike, and which lets the system turn the rich copy into what other
        // apps read. The host writes it only if that command is refused.
        document.addEventListener('copy', function (event) {
          if (!pendingCopy || !event.clipboardData) return;
          event.clipboardData.setData('text/plain', pendingCopy.text);
          if (pendingCopy.html) event.clipboardData.setData('text/html', pendingCopy.html);
          event.preventDefault();
          event.stopImmediatePropagation();
          copyWritten = true;
        }, true);

        function copySelection() {
          var payload = copyPayloadFor(selectionForToolbar());
          if (payload) {
            // The copy command needs a live selection; a tap may have cleared it.
            restoreLiveSelection();
            pendingCopy = payload;
            copyWritten = false;
            try {
              document.execCommand('copy');
            } catch (error) {
              copyWritten = false;
            }
            pendingCopy = null;
            if (!copyWritten && ACTIONS.copy) emit(ACTIONS.copy, payload);
          }
          clearSelection();
          hidePalette();
        }

        function removeEditingHighlight() {
          if (editing && ACTIONS.remove) emit(ACTIONS.remove, { highlightId: editing.highlightId });
          clearSelection();
          hidePalette();
        }

        function pressPaletteButton(button) {
          if (!button) return;
          var resizing = Boolean(editing && editing.resizing);
          if (button.hasAttribute('data-color')) {
            commitSelection(button.getAttribute('data-color'), null, false);
            return;
          }
          var action = button.getAttribute('data-action');
          if (action === 'underline') {
            // Underlined in the highlight's colour (or the last one used);
            // tapped again on an underlined highlight, a wash once more.
            var color = editing && !resizing ? editing.color : pen.color;
            var style = editing && !resizing && editing.style === 'underline' ? null : 'underline';
            commitSelection(color, style, false);
          } else if (action === 'note') {
            if (editing && !resizing) {
              if (ACTIONS.openNote) emit(ACTIONS.openNote, { highlightId: editing.highlightId });
              clearSelection();
              hidePalette();
            } else {
              commitSelection(editing ? editing.color : pen.color, editing ? editing.style : pen.style, true);
            }
          } else if (action === 'copy') copySelection();
          else if (action === 'remove') removeEditingHighlight();
        }

        function paletteButton(target) {
          var element = target && target.nodeType === 1 ? target : target && target.parentElement;
          var button = element && element.closest ? element.closest('[data-color], [data-action]') : null;
          return button && palette.contains(button) && !button.hidden ? button : null;
        }

        // On a phone a tap clears the selection and hides the toolbar before
        // its click arrives. So the toolbar takes the touch itself: holding it
        // keeps the selection (and stops the tap turning into a click), and
        // lifting over the same button presses it.
        palette.addEventListener('touchstart', function (event) {
          paletteTouch = paletteButton(event.target) || palette;
          if (event.cancelable) event.preventDefault();
          event.stopPropagation();
        }, { passive: false });
        palette.addEventListener('touchmove', function (event) {
          if (event.cancelable) event.preventDefault();
          event.stopPropagation();
        }, { passive: false });
        palette.addEventListener('touchend', function (event) {
          var pressed = paletteTouch;
          paletteTouch = null;
          if (event.cancelable) event.preventDefault();
          event.stopPropagation();
          var touch = event.changedTouches && event.changedTouches[0];
          var released = touch ? paletteButton(document.elementFromPoint(touch.clientX, touch.clientY)) : null;
          if (!released || released !== pressed) return;
          lastTouchActivation = Date.now();
          pressPaletteButton(released);
        }, { passive: false });
        palette.addEventListener('touchcancel', function () { paletteTouch = null; });
        palette.addEventListener('pointerdown', function (event) {
          event.preventDefault();
          event.stopPropagation();
        });
        palette.addEventListener('click', function (event) {
          // A touch already pressed it.
          if (Date.now() - lastTouchActivation < 800) return;
          pressPaletteButton(paletteButton(event.target));
        });

        document.addEventListener('click', function (event) {
          if (Date.now() < suppressClickUntil) return;
          if (palette.contains(event.target)) return;
          var mark = event.target && event.target.closest ? event.target.closest('mark[data-sermon-highlight-id]') : null;
          if (!mark) return;
          // A selection being made across a highlight is not a tap on it.
          var selection = window.getSelection && window.getSelection();
          if (selection && !selection.isCollapsed && !editing) return;
          if (TAP_TO_EDIT) {
            openGroupMenu(mark);
            return;
          }
          if (ACTIONS.openNote) emit(ACTIONS.openNote, { highlightId: mark.getAttribute('data-sermon-highlight-id') });
        });

        document.addEventListener('selectionchange', function () {
          if (stroke || window.__sermonPencilActive) return;
          var selection = window.getSelection && window.getSelection();
          clearTimeout(showTimer);
          if (!selection || selection.isCollapsed) {
            // A press on the toolbar itself keeps it up.
            if (!paletteTouch) hidePalette();
            return;
          }
          rememberSelection();
          // The handles of a tapped highlight moved: the next colour resizes it.
          // (Compared as the range's own text: the selection's adds a line
          // break between verses, the range's doesn't.)
          if (editing && !editing.resizing && selection.getRangeAt(0).toString() !== editing.text) {
            editing.resizing = true;
            setEditing(editing);
          }
          // A phone selects with a long press and drag handles, which the page
          // never sees as a finger lifting — so the toolbar also follows the
          // selection itself once it settles (not mid-drag with a mouse).
          if (mouseDown) return;
          showTimer = setTimeout(function () { showPaletteForSelection(false); }, 300);
        });

        // A finger or a mouse going down on a column: a selection made from
        // there keeps to it.
        function lockColumnAt(target) {
          if (!SINGLE_LANGUAGE || palette.contains(target)) return;
          var root = closestRoot(target);
          if (root) {
            document.body.setAttribute('data-highlight-column', root.getAttribute('data-sermon-language'));
            return;
          }
          var selection = window.getSelection && window.getSelection();
          if (!selection || selection.isCollapsed) document.body.removeAttribute('data-highlight-column');
        }

        document.addEventListener('pointerup', function (event) {
          if (event.pointerType === 'mouse') mouseDown = false;
          if (event.pointerType !== 'pen' && !stroke) setTimeout(showPaletteForSelection, 0);
        });
        document.addEventListener('touchend', function (event) {
          var touch = event.changedTouches && event.changedTouches[0];
          if (touch && touch.touchType === 'stylus') return;
          setTimeout(showPaletteForSelection, 80);
        }, { passive: true });
        document.addEventListener('keyup', function () { setTimeout(showPaletteForSelection, 0); });
        // This page carries its own selection toolbar, so the platform's menu
        // is a second, competing one over the same selection. Only loaded on
        // the Bible reader and the Sermon Planner, which is why a plain
        // document with Select text on keeps its ordinary menu.
        document.addEventListener('contextmenu', function (event) {
          event.preventDefault();
        });

        function caretAtPoint(x, y) {
          if (document.caretPositionFromPoint) {
            var position = document.caretPositionFromPoint(x, y);
            return position ? { node: position.offsetNode, offset: position.offset } : null;
          }
          if (document.caretRangeFromPoint) {
            var range = document.caretRangeFromPoint(x, y);
            return range ? { node: range.startContainer, offset: range.startOffset } : null;
          }
          return null;
        }

        // ---- Apple Pencil -----------------------------------------------------
        // A stroke runs down the column it touched down in, from verse to
        // verse, however far it goes: wherever the Pencil is, the stroke's end
        // is the point of that column level with it. Each moment's work is
        // bounded by the verses the stroke covers, never the whole page.
        var stroke = null;
        window.__sermonPencilActive = false;

        function scrollerFor(root) {
          var element = root.parentElement;
          while (element && element !== document.body && element !== document.documentElement) {
            var style = window.getComputedStyle(element);
            if (/(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 1) return element;
            element = element.parentElement;
          }
          return document.scrollingElement || document.documentElement;
        }
        function scrollerBounds(scroller) {
          if (scroller === document.scrollingElement || scroller === document.documentElement || scroller === document.body) {
            return { top: 0, bottom: window.innerHeight };
          }
          var rect = scroller.getBoundingClientRect();
          return { top: Math.max(0, rect.top), bottom: Math.min(window.innerHeight, rect.bottom) };
        }

        // The point of the stroke's column level with (x, y): the caret there
        // if it is in the column, else the nearest line of the column's verse
        // at that height.
        function pointInColumn(x, y) {
          var caret = caretAtPoint(x, y);
          var root = caret && closestRoot(caret.node);
          if (root && stroke.index.has(root)) return { index: stroke.index.get(root), offset: offsetInRoot(root, caret.node, caret.offset) };
          var roots = stroke.roots;
          if (!roots.length) return null;
          var lo = 0, hi = roots.length - 1, found = -1;
          while (lo <= hi) {
            var mid = (lo + hi) >> 1;
            if (roots[mid].getBoundingClientRect().top <= y) {
              found = mid;
              lo = mid + 1;
            } else {
              hi = mid - 1;
            }
          }
          if (found < 0) return { index: 0, offset: 0 };
          var target = roots[found];
          var text = target.textContent || '';
          var lines = target.getClientRects();
          if (!lines.length) return { index: found, offset: 0 };
          if (y > lines[lines.length - 1].bottom) return { index: found, offset: text.length };
          var line = lines[0], best = Infinity;
          for (var i = 0; i < lines.length; i += 1) {
            var rect = lines[i];
            var distance = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0;
            if (distance < best) {
              best = distance;
              line = rect;
            }
          }
          var inner = caretAtPoint(Math.max(line.left + 1, Math.min(line.right - 1, x)), (line.top + line.bottom) / 2);
          if (inner && closestRoot(inner.node) === target) return { index: found, offset: offsetInRoot(target, inner.node, inner.offset) };
          return { index: found, offset: 0 };
        }

        function strokeSegments() {
          var first = stroke.anchor, last = stroke.focus;
          if (last.index < first.index || (last.index === first.index && last.offset < first.offset)) {
            first = stroke.focus;
            last = stroke.anchor;
          }
          var segments = [];
          for (var i = first.index; i <= last.index; i += 1) {
            var root = stroke.roots[i];
            segments.push({
              root: root,
              start: i === first.index ? first.offset : 0,
              end: i === last.index ? last.offset : (root.textContent || '').length,
            });
          }
          var finished = finishSegments(segments);
          if (!finished.length) {
            // Drawn within one word: that word.
            var single = stroke.roots[first.index];
            var text = single.textContent || '';
            var word = wordAround(text, first.offset) || wordAround(text, first.offset - 1);
            if (word) finished = [{ root: single, start: word.start, end: word.end }];
          }
          return finished;
        }

        function autoScroll() {
          var bounds = scrollerBounds(stroke.scroller);
          var edge = 56;
          var step = 0;
          // Only towards the edge the Pencil is drawing to: a stroke that
          // starts near the top and runs down doesn't scroll the page up.
          if (stroke.y < bounds.top + edge && stroke.y < stroke.startY - 8) step = -Math.ceil((bounds.top + edge - stroke.y) / 3);
          else if (stroke.y > bounds.bottom - edge && stroke.y > stroke.startY + 8) step = Math.ceil((stroke.y - (bounds.bottom - edge)) / 3);
          step = Math.max(-18, Math.min(18, step));
          var before = stroke.scroller.scrollTop;
          if (step) stroke.scroller.scrollTop = before + step;
          stroke.scrolling = Boolean(step) && stroke.scroller.scrollTop !== before;
        }

        function updateStroke() {
          if (!stroke) return;
          stroke.frame = 0;
          autoScroll();
          stroke.focus = pointInColumn(stroke.x, stroke.y) || stroke.focus;
          stroke.segments = strokeSegments();
          paintPreview(stroke.segments, pen.color);
          // At the edge the page keeps scrolling while the Pencil is held there.
          if (stroke.scrolling) stroke.frame = requestAnimationFrame(updateStroke);
        }

        function startStroke(x, y) {
          // The same touch, seen again through its other event.
          if (stroke) return true;
          var caret = caretAtPoint(x, y);
          var root = caret && closestRoot(caret.node);
          if (!root || !isShown(root)) return false;
          var language = root.getAttribute('data-sermon-language');
          var roots = columnRoots(language);
          var index = new Map();
          roots.forEach(function (column, position) { index.set(column, position); });
          if (!index.has(root)) return false;
          var anchor = { index: index.get(root), offset: offsetInRoot(root, caret.node, caret.offset) };
          stroke = {
            language: language, roots: roots, index: index, anchor: anchor, focus: anchor,
            x: x, y: y, startX: x, startY: y, moved: false, frame: 0, scrolling: false,
            scroller: scrollerFor(root), segments: [],
          };
          // A selection made earlier is not what this stroke highlights.
          savedRange = null;
          hidePalette();
          clearPreview();
          var selection = window.getSelection && window.getSelection();
          if (selection) selection.removeAllRanges();
          document.body.setAttribute('data-highlight-column', language);
          if (window.releaseHeldJump) window.releaseHeldJump();
          window.__sermonPencilActive = true;
          emit(ACTIONS.pencil, { active: true });
          return true;
        }

        function moveStroke(x, y) {
          if (!stroke) return;
          stroke.x = x;
          stroke.y = y;
          if (!stroke.moved && Math.abs(x - stroke.startX) + Math.abs(y - stroke.startY) >= 6) stroke.moved = true;
          if (stroke.moved && !stroke.frame) stroke.frame = requestAnimationFrame(updateStroke);
        }

        function flushPendingHighlights() {
          if (!pendingHighlights) return;
          var list = pendingHighlights;
          pendingHighlights = null;
          window.setSermonHighlights(list);
        }

        // Lifted: what was drawn becomes a highlight; a tap opens the one tapped.
        // Cut short by the system after it moved, it still counts: the reader
        // saw it drawn.
        function endStroke(x, y, cancelled) {
          if (!stroke) return;
          var finished = stroke;
          if (x != null) {
            finished.x = x;
            finished.y = y;
          }
          if (finished.frame) cancelAnimationFrame(finished.frame);
          if (finished.moved) {
            finished.focus = pointInColumn(finished.x, finished.y) || finished.focus;
            finished.segments = strokeSegments();
          }
          stroke = null;
          window.__sermonPencilActive = false;
          emit(ACTIONS.pencil, { active: false });
          suppressClickUntil = Date.now() + 600;
          var selection = window.getSelection && window.getSelection();
          if (selection) selection.removeAllRanges();
          document.body.removeAttribute('data-highlight-column');
          if (!finished.moved) {
            clearPreview();
            flushPendingHighlights();
            if (cancelled) return;
            var element = document.elementFromPoint(finished.startX, finished.startY);
            var mark = element && element.closest ? element.closest('mark[data-sermon-highlight-id]') : null;
            if (mark && TAP_TO_EDIT) openGroupMenu(mark);
            else if (mark && ACTIONS.openNote) emit(ACTIONS.openNote, { highlightId: mark.getAttribute('data-sermon-highlight-id') });
            return;
          }
          if (finished.segments.length) {
            var creation = buildCreation(finished.segments, pen.color, null);
            emit(ACTIONS.create, { anchors: creation.anchors, color: pen.color, style: pen.style, replaces: creation.replaces, openNote: false });
            // Kept painted until the page hears the highlight back.
            paintPreview(creation.segments, pen.color);
            previewTimer = setTimeout(clearPreview, 1500);
          } else {
            clearPreview();
          }
          flushPendingHighlights();
        }

        // Pointer events carry the stroke; the Pencil's touch events only
        // stop the page scrolling under it (and start a stroke a browser
        // reports as touches alone). Each step takes whichever comes first.
        document.addEventListener('pointerdown', function (event) {
          if (event.pointerType === 'mouse') mouseDown = true;
          if (event.pointerType === 'pen') {
            if (startStroke(event.clientX, event.clientY)) {
              if (event.cancelable) event.preventDefault();
              // The stroke keeps its Pencil wherever it goes -- over a bar
              // laid on the page, or out of a frame the page is shown in.
              try {
                if (event.target && event.target.setPointerCapture) event.target.setPointerCapture(event.pointerId);
              } catch (error) {}
            }
            return;
          }
          lockColumnAt(event.target);
        }, { capture: true, passive: false });
        document.addEventListener('pointermove', function (event) {
          if (event.pointerType === 'pen' && stroke) moveStroke(event.clientX, event.clientY);
        }, { passive: true });
        document.addEventListener('pointerup', function (event) {
          if (event.pointerType === 'pen' && stroke) endStroke(event.clientX, event.clientY, false);
        });
        document.addEventListener('pointercancel', function (event) {
          if (event.pointerType === 'mouse') mouseDown = false;
          if (stroke && event.pointerType === 'pen') endStroke(null, null, !stroke.moved);
        });

        document.addEventListener('touchstart', function (event) {
          var touch = event.touches && event.touches[0];
          if (touch && touch.touchType === 'stylus') {
            if (startStroke(touch.clientX, touch.clientY) && event.cancelable) event.preventDefault();
            return;
          }
          lockColumnAt(event.target);
        }, { capture: true, passive: false });
        document.addEventListener('touchmove', function (event) {
          var touch = event.touches && event.touches[0];
          if (!stroke || !touch || touch.touchType !== 'stylus') return;
          moveStroke(touch.clientX, touch.clientY);
          if (event.cancelable) event.preventDefault();
        }, { passive: false });
        document.addEventListener('touchend', function (event) {
          var touch = event.changedTouches && event.changedTouches[0];
          if (stroke && touch && touch.touchType === 'stylus') endStroke(touch.clientX, touch.clientY, false);
        }, { passive: false });
        document.addEventListener('touchcancel', function () {
          if (stroke) endStroke(null, null, !stroke.moved);
        });
      })();
  `;
}
