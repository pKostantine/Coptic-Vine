# Slideshow mode

How a document is turned into slides, measured, paged and kept still.
Last brought up to date: October 16, 2026.

Files:

| File | Role |
|---|---|
| `src/components/vine/DocumentSurface.tsx` | Chooses the slideshow or the scrolling reader; builds the slideshow's sections (collapse, comment and silent-prayer filtering). |
| `src/components/vine/SlideshowContainer.js` | The React side: measurement, state, which slide is shown, navigation. |
| `src/components/vine/slideshowLayout.js` | Pure, testable logic: pagination, splitting, anchors, measurement bookkeeping, input mapping. No React. |
| `src/components/vine/VerseBlock.js` | Renders one verse row: speaker labels, language columns, the justified or centered body. |
| `src/components/vine/JustifiedText.js` | Renders a paragraph line by line (justified, word-only) and measures lines on both platforms. |
| `src/components/vine/textLines.js` | Pure helpers for words, paragraphs and reading native line reports back. |
| `tests/slideshowLayout.test.mjs`, `tests/slideshowTextLines.test.mjs`, `tests/slideshowNativeMeasurement.test.cjs` | The suite (`npm run test:slideshow`). |

The model follows the one in Spirit & Truth's presenter: a slide holds
whole units, a unit too tall for a slide is shown in pieces, going forward
packs from the top and going back packs from the foot, and the reader's
position is a unit (plus a line within it), never a page number.

## 1. Items

`flattenSections` turns the document's sections into a flat list of items,
in reading order. Each item has an `id`, a `sectionId` and a `type`:

- `title`: a section's title. `isCollapsed` is true for a Minimizable hymn
  (its title does not open a slide of its own); `ornament` names a
  headpiece (lintel, stepped, interlace, roundels) when the title is set in
  one; `collapsible` / `currentlyCollapsed` drive the minus/plus button.
- `verse`: one verse, with its `verse` record (`english`, `french`,
  `coptic`, `arabic`, `type`, `personRole`, `bibleVerseNumber`,
  `seasonalHoosVersePrefix`, …), colour index, speaker-label flags,
  `isRecitedPrayer`, `isReading`.
- `button`: a subdocument, Antiphonary or hyperlink button.
- `gospelRiteToggle`: the Coptic Gospel Rite switch.
- `ornament`: a medallion, band or divider.

Items are the unit of measurement and of position. A verse never changes
identity when it is split: its pieces carry `sourceItemId`.

## 2. Measurement

Pagination needs every item's real height, and for verses the real line
breaks of every column, at the current width, font size and set of
languages. Nothing guessed is ever shown: a character-count estimate
(`estimateItemHeight`) only sizes items that have not been measured yet,
and only for the provisional pages the reader never sees (section 5).

### The measurement layer

Unmeasured items are mounted off-screen (`measurementLayer`, opacity 0) in
batches of `MEASUREMENT_BATCH_SIZE` (24 native, 48 web) per commit, nearest
the reader first (`getMeasurementBatch`), within
`MEASUREMENT_WINDOW_RADIUS` items (48 native, 96 web) of the reader's row.
Faraway items stay estimated until the reader approaches them.

Each item reports:

- its height, from the wrapper `onLayout` (`queueMeasuredHeight`);
- per language, its lines: on native from the text engine's own
  `onTextLayout` (read back by `annotateNativeLines`), on web from a canvas
  `measureText` greedy wrap (`measureJustifiedLinesWeb`), reported through
  `onLanguageLayout` (`queueMeasuredLanguage`).

Reports are queued and flushed once per animation frame
(`flushPendingMeasurements`) into `measuredHeights` and
`measuredLanguageHeights`, and into a module-level LRU cache
(`slideshowMeasurementCache`, 6000 entries) keyed by the global measurement
key plus the item's content signature, so a document reopened at the same
size needs no re-measuring.

**An item counts as measured** (`isSlideshowItemMeasured`) only once its
height *and* the lines of every column that has text
(`getLanguagesNeedingLineMetrics`) are in. It stays in the measurement
layer until then. Measured by height alone, a verse used to leave before
its lines arrived and could then only be split by guessing.

Measurement items are keyed by a hash of the measurement key plus the item
id, so a wipe (new width, font, languages) remounts anything still being
measured: neither Fabric nor a `ResizeObserver` reports an unchanged size
twice.

### Invalidation

`globalMeasurementKey` = font size + table width + the language toggles.
When it changes, every measurement is dropped (restored from the cache if
the new key was measured before). `measuredForKey` records which key the
measurements in hand belong to; until the reset effect has caught up,
nothing counts as settled (section 5).

When only the item set changes (a hymn minimized), items whose own
signature is unchanged keep their measurements.

### What the probe measures

`JustifiedText` renders an invisible probe `<Text>` laid out exactly as the
rows will be — the first word in its own weight (the bold verse number)
included — and reads its lines from `onTextLayout`. The probe is keyed by
everything that affects its lines, so an event from a replaced probe is
never credited to the new text. In the measurement layer (`measureOnly`)
only the probe is ever rendered. Text with no words resolves to no lines
without a probe, since no event would come. A trailing newline is trimmed
before measuring, as iOS measures it as a line but reports none.

All slideshow text sets `allowFontScaling={false}`: the page math knows
nothing of the system font scale.

## 3. Pagination

`paginateItems(items, heights, languageHeights, budget, fontSize, visibleLanguages, tableWidth, breakAt)`
returns the slides, each a list of items (or verse pieces). The budget is
the viewport height less `getSlidePadding`.

### Where a slide must begin (`buildPaginationUnits`)

- A title with visible text opens a slide, unless it is a Minimizable
  hymn's.
- A headpiece always opens a slide, and what follows it shares that slide.
- A button opens a slide, but a run of buttons shares one.
- The Antiphonary's Vatos half opens its own slide.
- The medallion stays with the last words before it, and nothing follows
  it on its slide.
- A band or divider sits with whatever is either side of it.

### Filling a slide

Items are placed in order; a slide holds whole items:

- A measured verse that fits what is left of the slide goes on, carrying
  its measured lines (`createWholeVerseItem`), so it renders exactly as it
  was measured. One that does not fit moves on whole to the next slide.
- An unmeasured verse is placed whole by its estimated height and never
  split; its real lines settle the page before the page is shown.
- A title or the Gospel Rite toggle never ends a slide (`wouldStrand`): if
  what follows would not fit beneath it, it goes over the page with it.

### A verse taller than a slide

Only such a verse is split (`appendTallVerseSegments`), from a fresh
slide. Each column takes as many of its own lines as fit on the slide,
independently (`independentLineTakes`): the Arabic may finish on the first
piece while the English carries on, leaving its cell empty. A column holds
back only a single stray line, so a turn never leaves it one line alone.
The last piece shares its slide with whatever follows that fits.

Each piece (`createVerseLineSegment`) carries, per language,
`slideshowForcedLines` (the exact lines to render), `slideshowLineRanges`
(`{start, end}` into the measured lines — recorded for every column, a
finished one standing at its end) and `slideshowLineCounts`. The seasonal
Hoos prefix and the Bible verse number go with each column's own first
lines; after a decoration-only page (speaker label and prefix alone, when
no line fits beside them) the prefix is not shown again.

Pieces are rendered by `JustifiedText` with `forceLines`, on web as on
native, so a page shows precisely the lines it was laid out for. Centered
columns (refrain labels, reading references, Coptic standing alone) render
their forced lines line by line too.

### The reader's break (`breakAt`)

The reader's position is an **anchor**: `{sourceItemId, sectionId,
offsets, primaryLanguage, direction, breaks}` (`createSlideAnchor`), where
`offsets` are the line each column starts at on the anchored piece.

- Forward (the default): the slide begins exactly at the anchor's item and,
  within a tall verse, at its lines. The lines before fill the slides
  before. The slide on screen therefore depends on nothing before it and
  settles from its own items alone, however long the psalm.
- Backward (`direction: "backward"`, set by a page turn back): the slide is
  the one *ending* at the anchor, packed from the foot up as full as it
  can be (`packBackwardFromItem`): a title keeps with its verse; an item
  that opens a slide ends the walk; ending at a tall verse, the slide is
  the piece holding the line asked for (the page before a continuation is
  the piece ending at the line above it; the page before the item after
  the verse is its last piece). It also ends there, so nothing from the
  page the reader left appears again.
- `breaks: false` (the Settings/Calendar "end" restore): the anchor only
  names the item; the page is not made to begin at it.

Paging forward again after going back reproduces the same pages.

## 4. Anchors and finding the page again

Every repagination re-resolves the anchor (`findSlideIndexForAnchor`):
the slide whose piece of the anchored item holds the anchor's line, by the
primary language first (the first column with lines on the anchored
piece), the others as tie-breakers. A verse placed whole holds every line,
so it matches; a decoration-only page never does. A backward anchor takes
the last of equal matches.

Position is reported to the parent by section (`onCurrentSectionChange`),
which persists it; Settings and the Calendar restore through
`restoreRequest`, the pills through `jumpRequest`, the content selector
through `selectedSectionId`.

## 5. What is shown: settled pages only

Pagination runs on every flush, on estimates where measurements are
missing, so a page built now can change as they land. The deck never
shows such a page:

- A slide is **settled** (`isSlideSettled`) when every item from its
  settle start — the reader's break when it is at or before the slide,
  else the start of its run (`getSettleStart`) — through its own items and
  the first item of the next slide (the one that did not fit) is measured.
- `settled` also requires the viewport to be known, the measurements to
  belong to the current key, and the anchor to have found its slide.
- The deck renders the last settled deck (`settledDeck`: slides, index and
  the font, width and languages they were laid out for) until the live one
  settles, then the live one.
- A settled deck laid out for another width, font or languages is never
  shown (`settledDeckFits`): the deck hides until the new layout settles.
  Opened fresh, it shows nothing for the frame or two it takes.
- After `SETTLE_TIMEOUT_MS` (700 ms) unsettled, the live deck as it stands
  is pinned and shown, so a measurement that never comes cannot leave a
  blank page; at worst a verse is laid out whole, never with a guessed
  break, and there is at most one change when the real page settles.

Slides are keyed by their content, not their number, so measuring the
slides before one does not remount it.

## 6. Navigation

`NavigationSurface` maps input to page turns (`slideshowLayout.js`):

- Tap: left half previous, right half next, in the surface's own bounds.
- Swipe: 36 px horizontally (`SLIDESHOW_SWIPE_ACTIVATION_DISTANCE`); a
  swipe left that starts in the right 18 % of the surface opens the content
  selector instead.
- Keys: →, ↓, PageDown, Space, Enter next; ←, ↑, PageUp, Backspace
  previous; Home, End. A focused button keeps only Space and Enter
  (`isKeyKeptByFocusedControl`); typed-into fields and arrow-key widgets
  keep everything.
- Stylus events are left to the document.

Turns act on the deck on screen (`shownDeckRef`), not the live one: next
anchors to the next slide's first item, forward; previous sets a backward
anchor at the item (or line) before the current slide's first.

`getSlideRenderLayers` keeps the current slide in flex flow (Yoga does not
size a parent from absolute children) and pre-renders its neighbours as
invisible overlays.

## 7. Typography

- Sizes (`getSlideshowLanguageFontSize`): Coptic 1.25× and Arabic 1.15× the
  reading size; line heights 1.3×, Arabic 1.6× (`getSlideshowLanguageLineHeight`).
- Text is justified (`SLIDESHOW_JUSTIFIED`), word-only: `JustifiedText`
  renders each line but a paragraph's last as a `space-between` row of
  words, since native `textAlign: "justify"` stretches letter spacing too.
  A right-to-left line holding a Latin run renders as one piece of text.
  Lines handed in by pagination keep their paragraph ends, so the last line
  of a piece whose paragraph continues stays justified.
- Columns share the table width less `getLanguageColumnGap` between them.
  A Coptic line with no translation spans the row, centered.
- Chrome (titles, buttons) follows `getDocumentChromeMetrics`.

## 8. Checking it

- `npm run test:slideshow`: pagination, splitting, anchors, settling,
  measurement order, input mapping, and source-level guards (no estimate
  ever reaches `slideshowForcedLines`; the deck shows only settled slides;
  forced lines render line for line on both platforms).
- In the web preview, a slide can be probed by recording the position of
  every text node per animation frame after a page turn: a settled page
  must show one layout. Rotation hides the deck for a frame or two, then
  shows the reader's own line again.
- Known: when music is playing, the mini player draws over the foot of a
  slide rather than reserving space (`GlobalNowPlayingOverlay` withdraws
  its inset in slideshow mode). Sections with no verse rows show as
  title-only slides.
