const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('native line probe contributes its full height to slideshow measurement', () => {
  const source = fs.readFileSync('src/components/vine/JustifiedText.js', 'utf8');
  const probe = source.match(/const measuringNode = isMeasuring \|\| measureOnly \? \(([\s\S]*?)\n\s*\) : null;/)?.[1] || '';

  assert.match(probe, /opacity:\s*0/);
  assert.doesNotMatch(probe, /position:\s*["']absolute["']/);
});

test('liturgical slideshow pagination is independent of Now Playing geometry', () => {
  const surface = fs.readFileSync('src/components/vine/DocumentSurface.tsx', 'utf8');
  const slideshowBranch = surface.match(/if \(preferences\.slideshowMode\) \{([\s\S]*?)\n\s*\}/)?.[1] || '';
  const container = fs.readFileSync('src/components/vine/SlideshowContainer.js', 'utf8');
  const overlay = fs.readFileSync('src/components/playback/GlobalNowPlayingOverlay.tsx', 'utf8');

  assert.doesNotMatch(slideshowBranch, /nowPlayingInset|bottomContentInset/);
  assert.doesNotMatch(container, /bottomContentInset/);
  // In slideshow mode the bar withdraws its clearance entirely.
  assert.match(overlay, /if \(!allowDisplay \|\| preferences\.slideshowMode\) \{\s*reportNowPlayingInset\(overlayId, null\)/);
});

test('collapsed Now Playing control cannot create a full-width slideshow mask', () => {
  const overlay = fs.readFileSync('src/components/playback/GlobalNowPlayingOverlay.tsx', 'utf8');
  const collapsedStart = overlay.indexOf('if (isCollapsed)');
  const collapsedEnd = overlay.indexOf('\n  return (', collapsedStart);
  const collapsedBranch = overlay.slice(collapsedStart, collapsedEnd);
  const container = fs.readFileSync('src/components/vine/SlideshowContainer.js', 'utf8');

  assert.match(collapsedBranch, /pointerEvents="box-none"/);
  assert.match(overlay, /const BUTTON_SIZE = 42;/);
  assert.match(collapsedBranch, /width: BUTTON_SIZE,\s*height: BUTTON_SIZE,/);
  assert.match(collapsedBranch, /backgroundColor:\s*'transparent'/);
  // The line the button is dragged along is measured, never drawn: no height, no touches.
  assert.match(collapsedBranch, /pointerEvents="none"[\s\S]*?right: 18 \+ insets\.right, bottom: 0, height: 0/);
  for (const styleName of ['container', 'slide', 'slideDeck']) {
    const style = container.match(new RegExp(`${styleName}:\\s*\\{([^}]*)\\}`))?.[1] || '';
    assert.match(style, /overflow:\s*["']visible["']/);
    assert.doesNotMatch(style, /overflow:\s*["']hidden["']/);
  }
});

// A subdocument mounts its own bar over the app's; hiding either must hide
// both, so the hidden state lives in the shared context, not in each bar.
test('hiding Now Playing is one app-wide state shared by every bar', () => {
  const overlay = fs.readFileSync('src/components/playback/GlobalNowPlayingOverlay.tsx', 'utf8');
  const chrome = fs.readFileSync('src/context/BottomChromeContext.tsx', 'utf8');

  assert.doesNotMatch(overlay, /\[isCollapsed, setIsCollapsed\]\s*=\s*useState/);
  // So is the corner its button was dragged to, kept with the device's preferences.
  assert.match(overlay, /const side = preferences\.nowPlayingButtonSide;/);
  assert.match(overlay, /nowPlayingCollapsed: isCollapsed,\s*setNowPlayingCollapsed: setIsCollapsed,\s*\} = useBottomChrome\(\)/);
  assert.match(chrome, /const \[nowPlayingCollapsed, setNowPlayingCollapsed\] = useState\(false\)/);
});

// Mobile Safari/Chrome can inflate text when the containing column becomes
// wider in landscape even with an unchanged CSS font-size. Both production
// HTML entrypoints must opt only the slideshow subtree out of that behavior.
test('web slideshow keeps user-selected font size independent of orientation', () => {
  const singlePage = fs.readFileSync('public/index.html', 'utf8');
  const expoRouterHtml = fs.readFileSync('src/app/+html.tsx', 'utf8');
  const slideshow = fs.readFileSync('src/components/vine/SlideshowContainer.js', 'utf8');
  const surface = fs.readFileSync('src/components/vine/DocumentSurface.tsx', 'utf8');
  const scrollReader = fs.readFileSync('src/components/vine/documentHtml.ts', 'utf8');

  for (const entrypoint of [singlePage, expoRouterHtml]) {
    assert.match(entrypoint, /\[data-testid="slideshow-container"\]/);
    assert.match(entrypoint, /-webkit-text-size-adjust:\s*none/);
    assert.match(entrypoint, /text-size-adjust:\s*none/);
  }
  assert.match(slideshow, /testID="slideshow-container"/);
  assert.match(surface, /fontScaleToPx\(preferences\.fontScale\);/);
  assert.doesNotMatch(surface, /fontScaleMultiplier/);
  assert.match(scrollReader, /-webkit-text-size-adjust:\s*none/);
  // Slide width is a measurement/pagination input, not a typography multiplier.
  assert.match(slideshow, /slideTableWidth\s*=\s*Math\.max\(viewportWidth/);
  const fontDeclaration = surface.match(/const fontSize\s*=[^;]+;/)?.[0] || '';
  assert.match(fontDeclaration, /fontScaleToPx\(preferences\.fontScale\)/);
  assert.doesNotMatch(fontDeclaration, /screenWidth|screenHeight/);
});

// A line break the page shows is one the platform's text engine made. The
// character-count estimate exists only to size unmeasured rows for a
// provisional page: it must never be turned into forced lines, and no
// provisional page is shown -- the deck waits for the reader's slide to
// settle, keeping the last settled one meanwhile.
test('no guessed line breaks reach the page, and the deck shows only settled slides', () => {
  const layout = fs.readFileSync('src/components/vine/slideshowLayout.js', 'utf8');
  const container = fs.readFileSync('src/components/vine/SlideshowContainer.js', 'utf8');
  assert.doesNotMatch(layout, /createEstimatedVerseMetric/);
  assert.doesNotMatch(container, /createEstimatedVerseMetric|createEstimatedTextLines/);
  const placeVerse = layout.match(/const placeVerse = \(verseItem, index\) => \{([\s\S]*?)\n  \};/)?.[1] || '';
  assert.match(placeVerse, /if \(!isMeasuredVerse\(verseItem\)\)/);
  assert.match(layout, /const isMeasuredVerse = \(verseItem\) =>\s*hasEveryMeasuredColumn\(verseItem, languageHeights\[verseItem\.id\], visibleLanguages\)/);
  assert.match(container, /isSlideSettled\(items, slides, resolvedSlideIndex, isItemMeasured, itemIndexById, anchorBreakIndex\)/);
  assert.match(container, /getMeasurementBatch\(\s*items,\s*isItemMeasured,/);
  assert.match(container, /\{deckHidden \? null : \(\s*<SlideDeck\s+slides=\{shownDeck\.slides\}/);
  assert.match(container, /const shownDeck = settled \|\| !settledDeckFits \? liveDeck : settledDeck;/);
  // A deck laid out for another width, font or languages is never shown in this one.
  assert.match(container, /settledDeck\.tableWidth === slideTableWidth &&\s*settledDeck\.fontSize === fontSize &&\s*settledDeck\.visibleLanguages === visibleLanguages/);
});

// A paragraph turned over the page is rendered from exactly the lines that
// were measured, on web as on the phone, and justified down to its last
// line unless that line ends the paragraph.
test('forced lines render line for line on every platform', () => {
  const verseBlock = fs.readFileSync('src/components/vine/VerseBlock.js', 'utf8');
  const justified = fs.readFileSync('src/components/vine/JustifiedText.js', 'utf8');
  assert.match(verseBlock, /Platform\.OS === "web" && !language\.forceLines \? \(\s*<CssJustifiedVerseBody/);
  assert.match(verseBlock, /textAlign: alignmentFor\("coptic"\)/);
  assert.match(verseBlock, /annotateNativeLines\(event\.nativeEvent\.lines \|\| \[\], renderedText\)/);
  // A centered column measures its lines on web too, and a page's share of it renders line by line.
  assert.match(verseBlock, /measureJustifiedLinesWeb\(renderedText, language\.fontSize, language\.fontFamily, columnWidth, fontWeight, fontStyle\)/);
  assert.match(verseBlock, /language\.forceLines\.map\(\(line, index\) => \(\s*<Text key=\{index\} allowFontScaling=\{false\}/);
  assert.match(justified, /const isLastLine = forceLines \? Boolean\(line\.isParagraphEnd\) : index === lastIndex \|\| line\.isParagraphEnd;/);
  assert.match(justified, /import \{ annotateNativeLines, splitParagraphs, splitWords \} from "\.\/textLines";/);
  // Text with no words never waits on a layout event that cannot come.
  assert.match(justified, /splitWords\(text\)\.length \? nativeLineCache\.get\(cacheKey\) : NO_LINES/);
});

test('every drawn Coptic line has room for the ornamented capitals and descenders a native Text would cut off', () => {
  // iOS and Android draw a Text only inside its own frame: the Coptic font's
  // capitals rise past a line set at little more than its size. Each drawn
  // line's frame grows above and below by padding, taken back by an equal
  // negative margin, so the text and the line heights stay where they were.
  const justified = fs.readFileSync('src/components/vine/JustifiedText.js', 'utf8');
  assert.match(justified, /export function glyphRoomStyle\(fontSize\) \{[\s\S]*?if \(IS_WEB \|\| size <= 0\) return null;[\s\S]*?return \{ marginBottom: -below, marginTop: -above, paddingBottom: below, paddingTop: above \};/);
  assert.equal((justified.match(/\{ textAlign: fallbackAlign \}, glyphRoom\]/g) || []).length, 2);
  assert.match(justified, /wordStyles\?\.\[lineWordOffsets\[index\] \+ wordIndex\],\n\s+glyphRoom,/);
  const verse = fs.readFileSync('src/components/vine/VerseBlock.js', 'utf8');
  assert.match(verse, /glyphRoomFontSize=\{language\.key === "coptic" \? language\.fontSize : 0\}/);
  assert.match(verse, /const glyphRoom = language\.key === "coptic" \? glyphRoomStyle\(language\.fontSize\) : null;/);
  // The plain body reports its text's height, not the room around it.
  assert.match(verse, /height: event\.nativeEvent\.layout\.height - roomHeight/);
});
