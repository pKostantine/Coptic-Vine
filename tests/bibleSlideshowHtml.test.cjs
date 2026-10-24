const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');

function loadBuilder() {
  let source = fs.readFileSync('src/components/vine/bibleDocumentHtml.ts', 'utf8');
  source = source
    .replace(
      "import { formatEnglishDisplayText } from '../../utils/displayText';",
      "const formatEnglishDisplayText = (value) => String(value || '');",
    );
  // The pages a chapter can be read on, with the real design tokens behind them.
  const documentThemes = evaluateModule(
    fs.readFileSync('src/constants/documentThemes.ts', 'utf8'),
    'documentThemes.ts',
    (name) => (name === './theme' ? evaluateModule(fs.readFileSync('src/constants/theme.ts', 'utf8'), 'theme.ts', require) : require(name)),
  );
  const copticInitialArt = evaluateModule(fs.readFileSync('src/constants/copticInitialArt.ts', 'utf8'), 'copticInitialArt.ts', require);
  const englishInitialArt = evaluateModule(fs.readFileSync('src/constants/englishInitialArt.ts', 'utf8'), 'englishInitialArt.ts', require);
  const copticInitial = evaluateModule(fs.readFileSync('src/components/vine/copticInitial.ts', 'utf8'), 'copticInitial.ts', (name) => (name === '../../constants/copticInitialArt' ? copticInitialArt : require(name)));
  const openingInitials = evaluateModule(fs.readFileSync('src/components/vine/openingInitials.ts', 'utf8'), 'openingInitials.ts', (name) => (name === '../../constants/englishInitialArt' ? englishInitialArt : require(name)));
  const openingModules = {
    '../../constants/copticInitialArt': copticInitialArt,
    '../../constants/englishInitialArt': englishInitialArt,
    './copticInitial': copticInitial,
    './openingInitials': openingInitials,
  };
  // The builder's local imports: the shared highlighting layer, numerals, document metrics and the floating controls' fade.
  const localModules = {
    './textHighlights': evaluateModule(fs.readFileSync('src/components/vine/textHighlights.ts', 'utf8'), 'textHighlights.ts', require),
    './documentPresentationMetrics': evaluateModule(fs.readFileSync('src/components/vine/documentPresentationMetrics.js', 'utf8'), 'documentPresentationMetrics.js', require),
    './readerChromeFade': evaluateModule(
      fs.readFileSync('src/components/vine/readerChromeFade.ts', 'utf8'),
      'readerChromeFade.ts',
      (name) => (name === '../../constants/documentThemes' ? documentThemes : require(name)),
    ),
    '../../utils/bibleNumerals': evaluateModule(fs.readFileSync('src/utils/bibleNumerals.ts', 'utf8'), 'bibleNumerals.ts', require),
    '../../constants/documentThemes': documentThemes,
    '../../constants/documentOrnaments': evaluateModule(
      fs.readFileSync('src/constants/documentOrnaments.ts', 'utf8'),
      'documentOrnaments.ts',
      (name) => (name === './ornamentArt' ? evaluateModule(fs.readFileSync('src/constants/ornamentArt.ts', 'utf8'), 'ornamentArt.ts', require) : require(name)),
    ),
    // The chapter's opening: its decorated initials and first words.
    './copticInitial': copticInitial,
    './openingInitials': openingInitials,
    './openingHtml': evaluateModule(fs.readFileSync('src/components/vine/openingHtml.ts', 'utf8'), 'openingHtml.ts', (name) => openingModules[name] || require(name)),
  };
  const localRequire = (name) => localModules[name] || require(name);
  return evaluateModule(source, 'bibleDocumentHtml.ts', localRequire).buildBibleChapterHtml;
}

function evaluateModule(source, filename, moduleRequire) {
  const javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const moduleObject = { exports: {} };
  new Function('exports', 'require', 'module', '__filename', '__dirname', javascript)(
    moduleObject.exports,
    moduleRequire,
    moduleObject,
    filename,
    process.cwd(),
  );
  return moduleObject.exports;
}

test('Bible slideshow emits valid presentation JavaScript and max-size safeguards', () => {
  const buildBibleChapterHtml = loadBuilder();
  const html = buildBibleChapterHtml({
    verses: [{
      verseNumber: 1,
      english: 'In the beginning',
      englishNkjv: '',
      englishFromCoptic: '',
      coptic: 'ⲁ̅ ⲃ̅',
      greek: '',
      arabic: 'فِي الْبَدْءِ',
      arabicFromCoptic: '',
      french: '',
    }],
    languageKeys: ['english', 'coptic', 'arabic'],
    fontSize: 78,
    copticFontDataUri: 'data:font/ttf;base64,AA==',
    isSlideshow: true,
    bottomContentInset: 0,
  });
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
  assert.doesNotThrow(() => new Function(script));
  // The CSS pixel font size is the same after rotation; only the page budget
  // and line wrapping change. Disable mobile browser text inflation in WebView.
  assert.match(html, /-webkit-text-size-adjust:\s*none/);
  assert.match(html, /text-size-adjust:\s*none/);
  assert.match(html, /height: 100dvh/);
  assert.match(html, /data-segment-progress/);
  assert.match(html, /document\.fonts\.ready/);
  assert.match(html, /PageDown/);
  assert.match(html, /suppressClickUntil/);
  assert.match(html, /font-weight: 700/);
  assert.match(html, /bottom\) \+ 0px/);
  assert.match(html, /page\.style\.display = isCurrent \? 'block' : 'none'/);
  assert.doesNotMatch(html, /width: max-content/);
  assert.match(html, /initialPaginationDone/);
  assert.match(html, /resizeTimer = setTimeout/);
});

test('Bible slideshow route excludes the Now Playing overlay from pagination', () => {
  const route = fs.readFileSync('src/app/bible/[bookKey]/[chapter].tsx', 'utf8');
  assert.match(route, /bottomContentInset:\s*preferences\.slideshowMode\s*\?\s*0\s*:\s*nowPlayingInset/);
});

test('Bible reading view highlights by stored chapter and verse, and offers Copy', () => {
  const buildBibleChapterHtml = loadBuilder();
  const html = buildBibleChapterHtml({
    verses: [{
      verseNumber: 1,
      sourceChapter: 9,
      sourceVerse: 22,
      english: 'Why, O Lord, do You stand afar off?',
      englishNkjv: '',
      englishFromCoptic: '',
      coptic: '',
      greek: '',
      arabic: 'يَا رَبُّ',
      arabicFromCoptic: '',
      french: '',
    }],
    languageKeys: ['english', 'arabic'],
    fontSize: 18,
    copticFontDataUri: 'data:font/ttf;base64,AA==',
    selectText: true,
    highlighting: true,
    highlightLabels: { copy: 'Copy', remove: 'Remove' },
    copyReference: { english: 'Psalm 10', arabic: 'مزمور ١٠', coptic: 'Ⲯⲁⲗⲙⲟⲥ ⲓ̅' },
  });
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
  assert.equal(scripts.length, 2);
  for (const script of scripts) assert.doesNotThrow(() => new Function(script));
  // A masoretic Psalm verse anchors to the Septuagint chapter:verse it is stored under.
  assert.match(html, /data-sermon-verse-id="9:22" data-sermon-language="english"/);
  assert.match(html, /data-sermon-verse-id="9:22" data-sermon-language="arabic"/);
  assert.match(html, /"copy":"copyBibleText"/);
  assert.match(html, /addAction\('copy', "Copy"\)/);
  assert.match(html, /addAction\('remove', "Remove"\)/);
  assert.match(html, /window\.__vineBiblePost = post/);
  // Copy — the toolbar's and the system's — is signed with the chapter. The
  // toolbar writes it through the page's copy command, and the host only when
  // that is refused.
  assert.match(html, /var copyReference = \{"english":"Psalm 10","arabic":"مزمور ١٠","coptic":"Ⲯⲁⲗⲙⲟⲥ ⲓ̅"\}/);
  // A copy is the reader's base size whatever the column's own size.
  assert.match(html, /'font-size': '18px'/);
  assert.match(html, /window\.__vineBibleCopyPayload = bibleCopyPayload/);
  assert.match(html, /var build = window\.__vineBibleCopyPayload;/);
  assert.match(html, /pendingCopy = payload;[\s\S]*?document\.execCommand\('copy'\);[\s\S]*?if \(!copyWritten && ACTIONS\.copy\) emit\(ACTIONS\.copy, payload\)/);
  // A phone's tap clears the live selection before a click: the toolbar takes
  // the touch itself and acts on the selection it kept.
  assert.match(html, /palette\.addEventListener\('touchstart', function \(event\) \{\s*paletteTouch = [^;]+;\s*if \(event\.cancelable\) event\.preventDefault\(\);/);
  assert.match(html, /palette\.addEventListener\('touchend'[\s\S]*?pressPaletteButton\(released\)/);
  assert.match(html, /function commitSelection\(color, style, openNote\) \{\s*var selection = selectionForToolbar\(\);/);
  // …and appears for a selection made with a long press, which never lifts a finger on the page.
  assert.match(html, /showTimer = setTimeout\(function \(\) \{ showPaletteForSelection\(false\); \}, 300\)/);
  const route = fs.readFileSync('src/app/bible/[bookKey]/[chapter].tsx', 'utf8');
  assert.match(route, /getBibleChapterReferences\(book, bookKey, currentChapterNumber\)/);
  assert.match(route, /writeRichClipboard\(action\.text, action\.html\)/);

  const slideshow = buildBibleChapterHtml({
    verses: [{ verseNumber: 1, english: 'In the beginning', englishNkjv: '', englishFromCoptic: '', coptic: '', greek: '', arabic: '', arabicFromCoptic: '', french: '' }],
    languageKeys: ['english'],
    fontSize: 18,
    copticFontDataUri: 'data:font/ttf;base64,AA==',
    isSlideshow: true,
    highlighting: true,
  });
  assert.doesNotMatch(slideshow, /sermon-annotatable-text"/);
});

test('a chapter opens on its verse 1 with the drop cap and decorated first words, its number ahead of the initial', () => {
  const buildBibleChapterHtml = loadBuilder();
  const verse = (verseNumber, extra) => ({ verseNumber, english: '', englishNkjv: '', englishFromCoptic: '', coptic: '', greek: '', arabic: '', arabicFromCoptic: '', french: '', ...extra });
  const build = (isSlideshow) => buildBibleChapterHtml({
    verses: [
      verse(0, { english: 'A Psalm of David', isPsalmIntroduction: true }),
      verse(1, { english: 'Blessed is the man', englishNkjv: 'Blessed is the man', coptic: 'ⲱⲟⲩⲙⲁⲕⲁⲣⲓⲟⲥ ⲡⲉ', greek: 'Μακάριος ἀνήρ', arabic: 'طوبى للرجل', french: 'Heureux l’homme' }),
      verse(2, { english: 'But his delight', coptic: 'ⲁⲗⲗⲁ ⲡⲉϥⲟⲩⲱϣ', arabic: 'لكن في ناموس' }),
    ],
    languageKeys: ['english', 'englishNkjv', 'french', 'coptic', 'greek', 'arabic'],
    fontSize: 20,
    copticFontDataUri: 'data:font/ttf;base64,AA==',
    isSlideshow,
  });
  const html = build(false);
  const body = html.slice(html.indexOf('<body'), html.indexOf('<script>'));
  // Verse 1, past the Psalm's introduction: the Coptic on its capital's decorated initial, drawn once with its vine.
  assert.match(body, /<span class="coptic-initial" data-fit><svg class="coptic-initial-art"[^>]*><use class="coptic-initial-vine" href="#cv-initial-vine-2cb0"><\/use>/);
  assert.ok(body.includes('<span class="coptic-initial-text">Ⲱ</span></span><span class="opening-word">ⲟⲩⲙⲁⲕⲁⲣⲓⲟⲥ</span> ⲡⲉ'));
  assert.equal((html.match(/id="cv-initial-2cb0"/g) || []).length, 1);
  // Every English column and the French on an Old English capital; the Arabic on its stretched word; the Greek as it is.
  assert.equal((body.match(/<span class="english-initial-text">B<\/span><\/span><span class="opening-word english-small-caps">lessed<\/span> is the man/g) || []).length, 2);
  assert.ok(body.includes('<span class="english-initial-text">H</span></span><span class="opening-word english-small-caps">eureux</span> l’homme'));
  assert.ok(body.includes('<span class="opening-word arabic-opening">طوبـــى</span> للرجل'));
  assert.ok(body.includes('>Μακάριος ἀνήρ<'));
  // Its number shows ahead of each hanging initial, and in its line in the columns with none.
  assert.match(body, /<span class="verse-number opening-verse-number" data-copy-text="1">1<\/span><span class="verse-text"><span class="english-initial"/);
  assert.match(body, /<span class="verse-number opening-verse-number" data-copy-text="ⲁ̅">ⲁ̅<\/span><span class="verse-text"><span class="coptic-initial" data-fit>/);
  assert.match(body, /<span class="verse-number" data-copy-text="١">١<\/span><span class="verse-text"><span class="opening-word arabic-opening">/);
  assert.match(body, /<span class="verse-number" data-copy-text="Αʹ">Αʹ<\/span><span class="verse-text">Μακάριος/);
  assert.match(html, /\.opening-verse-number \{ float: left; \}/);
  // Only verse 1: its introduction and verse 2 read as written, verse 2's Coptic in lower case.
  assert.ok(body.includes('>A Psalm of David<'));
  assert.ok(body.includes('>ⲁⲗⲗⲁ ⲡⲉϥⲟⲩⲱϣ<'));
  assert.match(body, /<span class="verse-number" data-copy-text="2">2<\/span>/);
  assert.equal((body.match(/class="english-initial"/g) || []).length, 3);
  // The page decides how tall the initial stands, before a slideshow cuts its pages and as the page reflows.
  const script = html.slice(html.indexOf('<script>'));
  assert.match(script, /function fitCopticInitials\(\) \{/);
  assert.match(script, /fitCopticInitials\(\);\s+if \(document\.querySelector\('\.coptic-initial\[data-fit\]'\)\) \{/);
  const slideshow = build(true).slice(build(true).indexOf('<script>'));
  assert.match(slideshow, /initialPaginationDone = true;\s+fitCopticInitials\(\);\s+paginate\(initialAnchorVerse\);/);
  assert.match(slideshow, /fitCopticInitials\(\);\s+paginate\(anchor\);/);
  // A verse cut across slides is read as written, so its opening's letter is still its word's.
  assert.match(slideshow, /var text = \(textNode\.textContent \|\| ''\)\.replace/);
});
