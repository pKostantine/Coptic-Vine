const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');

/** Loads a TypeScript module as CommonJS, with its imports resolved by `resolve` where given. */
function loadFile(path, resolve = require) {
  const js = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('exports', 'require', 'module', js)(module.exports, resolve, module);
  return module.exports;
}

const art = loadFile('src/constants/copticInitialArt.ts');
const theme = loadFile('src/constants/theme.ts');
const themes = loadFile('src/constants/documentThemes.ts', (name) => (name === './theme' ? theme : require(name)));

function loadDocumentBuilder() {
  const local = {
    '../../constants/theme': theme,
    '../../constants/documentThemes': themes,
    '../../constants/copticInitialArt': art,
    './copticInitial': loadFile('src/components/vine/copticInitial.ts', (name) => (name === '../../constants/copticInitialArt' ? loadFile('src/constants/copticInitialArt.ts') : require(name))),
    './openingInitials': loadFile('src/components/vine/openingInitials.ts', (name) => (name === '../../constants/englishInitialArt' ? loadFile('src/constants/englishInitialArt.ts') : require(name))),
    '../../constants/englishInitialArt': loadFile('src/constants/englishInitialArt.ts'),
    '../../constants/documentOrnaments': loadFile('src/constants/documentOrnaments.ts', (name) => (name === './ornamentArt' ? loadFile('src/constants/ornamentArt.ts') : require(name))),
    './documentPresentationMetrics': loadFile('src/components/vine/documentPresentationMetrics.js'),
    './textHighlights': loadFile('src/components/vine/textHighlights.ts'),
    './readerChromeFade': loadFile('src/components/vine/readerChromeFade.ts', (name) => (name === '../../constants/documentThemes' ? themes : require(name))),
    '../../utils/versePresentation': loadFile('src/utils/versePresentation.js'),
    '../../utils/verseRubric': loadFile('src/utils/verseRubric.js'),
  };
  // The drop caps' markup, from the same leaf modules.
  local['./openingHtml'] = loadFile('src/components/vine/openingHtml.ts', (name) => local[name] || require(name));
  return loadFile('src/components/vine/documentHtml.ts', (name) => local[name] || require(name)).buildDocumentHtml;
}

const build = loadDocumentBuilder();
const OPTIONS = { copticFontDataUri: 'data:font/ttf;base64,AA==', fontSize: 20, displayComments: true };
const verse = (coptic, extra = {}) => ({ english: 'English', coptic, arabic: 'عربي', type: 'verse', ...extra });
const hymn = (verses, title = { english: 'Thanksgiving Prayer', arabic: '' }) => ({ id: 'hymn-1', title, verses });
const CAPITALS = 'ⲀⲂⲄⲆⲈⲊⲌⲎⲐⲒⲔⲖⲘⲚⲜⲞⲠⲢⲤⲦⲨⲪⲬⲮⲰϢϤϦϨϪϬϮ';

/** The page's body, past its styles and its script's markup-looking strings. */
const body = (html) => html.slice(html.indexOf('<body'), html.indexOf('<script>'));
const initials = (html) => body(html).match(/<span class="coptic-initial(?: [^"]*)?"[^>]*>/g) || [];

test('every capital the Coptic face decorates has its letter and its vine', () => {
  assert.deepEqual(Object.keys(art.COPTIC_INITIALS).join(''), CAPITALS);
  for (const [letter, initial] of Object.entries(art.COPTIC_INITIALS)) {
    assert.match(initial.letter, /^(M[\d.]+ [\d.]+[lq\d .-]+z)+$/, letter);
    assert.ok(initial.vine.length > 10, `${letter}'s vine`);
    for (const piece of initial.vine) assert.ok(art.COPTIC_INITIAL_VINE_PIECES[piece], `${letter}'s vine piece ${piece}`);
  }
  // The vine's pieces are shared, not drawn again for every letter.
  assert.ok(art.COPTIC_INITIAL_VINE_PIECES.length < 100);
});

test('a line marked to open with the drop cap opens its Coptic with the decorated initial, the letter kept in the text', () => {
  const html = build([hymn([verse('Ⲙⲁⲣⲉⲛϣⲉⲡϩ̀ⲙⲟⲧ', { dropCap: true }), verse('Ϫⲉ ⲁϥⲉⲣⲥ̀ⲕⲉⲡⲁⲍⲓⲛ')])], OPTIONS);
  assert.deepEqual(initials(html), ['<span class="coptic-initial" data-fit>']);
  assert.ok(body(html).includes('<use class="coptic-initial-vine" href="#cv-initial-vine-2c98"></use><use class="coptic-initial-letter" href="#cv-initial-2c98"></use>'));
  // The rest of its first word follows in the letter's colour.
  assert.ok(body(html).includes('<span class="coptic-initial-text">Ⲙ</span></span><span class="opening-word">ⲁⲣⲉⲛϣⲉⲡϩ̀ⲙⲟⲧ</span>'));
  // Drawn once, for the letter used, from the vine's own pieces.
  assert.match(html, /<path id="cv-initial-2c98" d="M/);
  assert.equal((html.match(/id="cv-initial-[0-9a-f]+"/g) || []).length, 1);
  const vine = art.COPTIC_INITIALS['Ⲙ'].vine;
  assert.ok(html.includes(`<g id="cv-initial-vine-2c98">${vine.map((piece) => `<use href="#cv-vine-piece-${piece}"></use>`).join('')}</g>`));
  for (const piece of new Set(vine)) assert.ok(html.includes(`<path id="cv-vine-piece-${piece}" d="${art.COPTIC_INITIAL_VINE_PIECES[piece]}"></path>`));
  // One decorated initial, in the Coptic column; the English and Arabic beside it open in their own way.
  assert.equal((body(html).match(/coptic-initial-text/g) || []).length, 1);
  assert.equal((body(html).match(/class="english-initial"/g) || []).length, 1);
  assert.equal((body(html).match(/class="opening-word arabic-opening"/g) || []).length, 1);
});

test('the letter carries its jinkim into the copied text', () => {
  const html = build([hymn([verse('  Ⲁ̀ⲙⲏⲛ ⲁⲗⲗⲏⲗⲟⲩⲓⲁ', { dropCap: true })])], OPTIONS);
  assert.ok(body(html).includes('<span class="coptic-initial-text">Ⲁ̀</span></span><span class="opening-word">ⲙⲏⲛ</span> ⲁⲗⲗⲏⲗⲟⲩⲓⲁ'));
});

test('only the lines marked open so: a hymn\'s title, and which of its lines comes first, decide nothing', () => {
  const opened = (html) => initials(html).length + (body(html).match(/class="english-initial"|class="opening-word arabic-opening"/g) || []).length;
  // A titled hymn with nothing marked opens nowhere, in any column.
  assert.equal(opened(build([hymn([verse('Ⲙⲁⲣⲉⲛ'), verse('Ⲡⲉⲛⲛⲟⲩϯ')])], OPTIONS)), 0);
  // An untitled one opens where it is marked; and every marked line opens.
  assert.deepEqual(initials(build([hymn([verse('Ⲙⲁⲣⲉⲛ', { dropCap: true })], { english: '', arabic: '' })], OPTIONS)), ['<span class="coptic-initial" data-fit>']);
  const twice = build([hymn([verse('Ⲧⲉⲛⲟⲩⲱϣⲧ ⲙ̀Ⲫⲓⲱⲧ'), verse('Ⲭⲉⲣⲉ ⲧⲉⲕⲕⲗⲏⲥⲓⲁ', { dropCap: true }), verse('Ⲡⲉⲛⲛⲟⲩϯ', { dropCap: true })])], OPTIONS);
  assert.equal(initials(twice).length, 2);
  assert.ok(body(twice).includes('>Ⲧⲉⲛⲟⲩⲱϣⲧ ⲙ̀Ⲫⲓⲱⲧ<'));
  assert.ok(body(twice).includes('<span class="coptic-initial-text">Ⲭ</span>') && body(twice).includes('<span class="coptic-initial-text">Ⲡ</span>'));
  // A marked line in lower case takes its capital's initial.
  assert.ok(body(build([hymn([verse('ⲭⲟⲩⲁⲃ ⲭⲟⲩⲁⲃ', { dropCap: true })])], OPTIONS)).includes('<span class="coptic-initial-text">Ⲭ</span></span><span class="opening-word">ⲟⲩⲁⲃ</span> ⲭⲟⲩⲁⲃ'));
  // One opening on a bracket has none in Coptic, but its English still opens.
  const bracket = build([hymn([verse('(Ⲙⲁⲣⲉⲛ)', { dropCap: true })])], OPTIONS);
  assert.deepEqual(initials(bracket), []);
  assert.ok(body(bracket).includes('<span class="english-initial-text">E</span>'));
  // A reading's marked verse opens too, its number kept unseen rather than between the initial and its word.
  const reading = body(build([hymn([verse('Ⲡⲁⲩⲗⲟⲥ', { bibleVerseNumber: '1', dropCap: true }), verse('Ⲛⲉⲙ', { bibleVerseNumber: '2' })])], OPTIONS));
  assert.deepEqual(initials(reading), ['<span class="coptic-initial" data-fit>']);
  assert.match(reading, /<span class="bible-verse-number opening-verse-number" data-copy-text="1">1<\/span><span class="english-initial"/);
  assert.match(reading, /<span class="bible-verse-number" data-copy-text="2">2<\/span><span class="bible-verse-number-gap"><\/span>English/);
  assert.match(build([hymn([verse('Ⲙⲁⲣⲉⲛ')])], OPTIONS), /\.coptic-initial-text, \.english-initial-text, \.opening-verse-number \{\s+clip: rect\(0 0 0 0\);/);
});

test('no Coptic column, no initial; a marked line alone on its row, centred, takes it a line tall', () => {
  const english = { english: true, french: false, coptic: false, arabic: true };
  assert.deepEqual(initials(build([hymn([verse('Ⲙⲁⲣⲉⲛ', { dropCap: true })])], { ...OPTIONS, visibleColumns: english })), []);
  const invincible = (extra) => build([hymn([verse('Ⲁⲅⲓⲟⲥ', { english: '', arabic: '', invincibleCoptic: true, ...extra })])], { ...OPTIONS, visibleColumns: english });
  assert.deepEqual(initials(invincible({})), []);
  // The reader sets the line in the case it is given (the loader's casing, hymnLibrary.js).
  assert.ok(body(invincible({})).includes('>Ⲁⲅⲓⲟⲥ<'));
  assert.deepEqual(initials(invincible({ dropCap: true })), ['<span class="coptic-initial one-line">']);
});

test('a refrain before a hymn is no different: the line marked after it opens, the refrain kept as given', () => {
  // The Sanctus: a rubric, ⲁⲅⲓⲟⲥ ⲁⲅⲓⲟⲥ ⲁⲅⲓⲟⲥ alone on its row, then the hymn, the line after it marked.
  const sanctus = build([hymn([
    verse('', { english: 'The priest takes the veil', type: 'comment' }),
    verse('ⲁⲅⲓⲟⲥ ⲁⲅⲓⲟⲥ ⲁⲅⲓⲟⲥ.', { english: '', arabic: '', prayerType: 'Invincible Coptic' }),
    verse('ⲭⲟⲩⲁⲃ ⲭⲟⲩⲁⲃ ⲭⲟⲩⲁⲃ', { english: 'Holy, holy, holy', arabic: 'قدوسٌ', dropCap: true }),
  ])], OPTIONS);
  assert.deepEqual(initials(sanctus), ['<span class="coptic-initial" data-fit>']);
  assert.ok(body(sanctus).includes('>ⲁⲅⲓⲟⲥ ⲁⲅⲓⲟⲥ ⲁⲅⲓⲟⲥ.<'));
  assert.ok(body(sanctus).includes('<span class="coptic-initial-text">Ⲭ</span></span><span class="opening-word">ⲟⲩⲁⲃ</span> ⲭⲟⲩⲁⲃ ⲭⲟⲩⲁⲃ'));
  // Its English and Arabic open on that paragraph too.
  assert.ok(body(sanctus).includes('<span class="english-initial-text">H</span></span><span class="opening-word english-small-caps">oly,</span> holy, holy'));
});

test('the initial is exactly two lines tall, or one, and follows the text size', () => {
  for (const fontSize of [14, 20, 32]) {
    const html = build([hymn([verse('Ⲙⲁⲣⲉⲛ')])], { ...OPTIONS, fontSize });
    const line = Math.round(fontSize * 1.3);
    const px = (name, rule) => Number(new RegExp(`${name}: ([\\d.]+)px`).exec(rule)[1]);
    const twoLine = /\.coptic-initial \{([^}]+)\}/.exec(html)[1];
    const oneLine = /\.coptic-initial\.one-line \{([^}]+)\}/.exec(html)[1];
    const height = px('height', twoLine);
    const marginTop = Number(/margin: ([\d.]+)px/.exec(twoLine)[1]);
    assert.ok(Math.abs(height - (2.86 / 3) * 2 * line) < 0.01, `${fontSize}: height`);
    assert.ok(height + marginTop < 2 * line, `${fontSize}: clear of line 3`);
    assert.ok(Math.abs(px('width', twoLine) / height - 3.18 / 2.86) < 0.01, `${fontSize}: its shape`);
    assert.match(twoLine, /float: left;/);
    assert.equal(px('height', oneLine), line, `${fontSize}: one line`);
    assert.match(oneLine, /float: none;/);
  }
});

test('its letter takes the ornaments\' colour and its vine the titles\' gold, on every page', () => {
  for (const page of Object.values(themes.DOCUMENT_THEMES)) {
    const html = build([hymn([verse('Ⲙⲁⲣⲉⲛ')])], { ...OPTIONS, theme: page, ornamentColor: '#5FAE68' });
    assert.ok(html.includes(`.coptic-initial-vine { fill: ${page.colors.accent}; }`), page.id);
    assert.ok(html.includes('.coptic-initial-art .coptic-initial-letter { fill: #5FAE68; }'), page.id);
  }
});

test('the page decides after layout whether the paragraph wraps, and decides again when it reflows', () => {
  const html = build([hymn([verse('Ⲙⲁⲣⲉⲛ')])], OPTIONS);
  const script = html.slice(html.indexOf('<script>'));
  assert.match(script, /function fitCopticInitials\(\) \{/);
  // Measured with the initial a line tall: the paragraph's lines are counted from it on.
  assert.match(script, /initial\.classList\.add\('one-line'\);\s+var range = document\.createRange\(\);\s+range\.setStartBefore\(initial\);[\s\S]+initial\.classList\.toggle\('one-line', lines < 2\);/);
  // Ahead of every other resize listener, so they measure the outcome.
  assert.ok(script.indexOf('fitCopticInitials();') < script.indexOf("window.addEventListener('resize'"));
  assert.match(script, /document\.fonts\.load\('25px CopticVine'\)\.then\(function \(\) \{\s+fitCopticInitials\(\);/);
  assert.match(script, /var collapsed = section\.classList\.toggle\('collapsed'\);\s+if \(!collapsed\) fitCopticInitials\(\);/);
  // A page without an initial carries the script but no listeners for it.
  assert.equal(initials(build([hymn([verse('ⲙⲁⲣⲉⲛ')])], OPTIONS)).length, 0);
});

// ---- The opening in all three columns (Coptic Vine Design, "Drop caps and decorated initials", option 3) ----

const openings = loadFile('src/components/vine/openingInitials.ts', (name) => (name === '../../constants/englishInitialArt' ? loadFile('src/constants/englishInitialArt.ts') : require(name)));
const ornaments = loadFile('src/constants/documentOrnaments.ts', (name) => (name === './ornamentArt' ? loadFile('src/constants/ornamentArt.ts') : require(name)));
const coptic = loadFile('src/components/vine/copticInitial.ts', (name) => (name === '../../constants/copticInitialArt' ? art : require(name)));

test('the Arabic first word is stretched once with kashida, only between letters that join', () => {
  assert.equal(openings.stretchArabicWord('مبارك'), 'مبـــارك');
  assert.equal(openings.stretchArabicWord('قوموا'), 'قومـــوا');
  // Never after a letter that doesn't join the next, nor into lam-alef; a word with no join stays as it is.
  assert.equal(openings.stretchArabicWord('ودار'), 'ودار');
  assert.equal(openings.stretchArabicWord('لا'), 'لا');
  // Its vowel marks stay on their letter, ahead of the stretch.
  assert.equal(openings.stretchArabicWord('بَارَك'), 'بَـــارَك');
  assert.deepEqual(openings.splitArabicOpening('مبارك أنت'), { word: 'مبـــارك', rest: ' أنت' });
});

test('the English initial is the first capital: an Old English letter, its capitals from line 1\'s to line 2\'s baseline, as wide as its own letter', () => {
  assert.deepEqual(openings.splitEnglishOpening('Blessed are You'), { letter: 'B', rest: 'lessed are You' });
  assert.equal(openings.splitEnglishOpening('“Blessed'), null);
  assert.equal(openings.splitEnglishOpening('the light'), null);
  // Every capital, on one scale: all as tall, each as wide as its letter.
  const englishArt = loadFile('src/constants/englishInitialArt.ts');
  assert.equal(Object.keys(englishArt.ENGLISH_INITIALS).join(''), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ');
  for (const [letter, initial] of Object.entries(englishArt.ENGLISH_INITIALS)) {
    assert.match(initial.letter, /^M-?[\d.]+ -?[\d.]+l/, letter);
    assert.match(initial.viewBox, /^-?\d+ -1532 \d+ 1699$/, letter);
    assert.equal(Number(initial.viewBox.split(' ')[2]), initial.width, letter);
  }
  assert.ok(englishArt.ENGLISH_INITIALS.W.width > englishArt.ENGLISH_INITIALS.I.width);
  // The design's own reader, 22px Georgia on 29px lines: 51.9px tall, 4.2px down (capitals 44px), 10px after it, the rest of the word 8px nearer.
  const metrics = openings.englishInitialMetrics('A', 22, 29);
  assert.ok(Math.abs(metrics.drawingHeight - 51.9) < 0.5, `${metrics.drawingHeight}`);
  assert.ok(Math.abs(metrics.top - 4.2) < 0.2, `${metrics.top}`);
  assert.ok(Math.abs(metrics.width - metrics.drawingHeight * englishArt.ENGLISH_INITIALS.A.width / 1699) < 0.01);
  assert.ok(Math.abs(metrics.room - metrics.width - 10) < 0.01);
  assert.ok(Math.abs(metrics.room - metrics.firstRoom - 8) < 0.01);
  assert.equal(metrics.height, 58);
  // A first word that is the letter alone leaves line 1 no nearer.
  const alone = openings.englishInitialMetrics('A', 22, 29, false);
  assert.equal(alone.firstRoom, alone.room);
});

test('beside the Coptic initial line 2 starts at its edge and line 1 a quarter em inside it', () => {
  const box = coptic.copticInitialMetrics(30).two;
  const em = 30 / 1.5;
  assert.ok(Math.abs(box.room - em * 3.14) < 0.02);
  assert.ok(Math.abs(box.firstRoom - em * 2.89) < 0.02);
  // Set in a row, it leaves line 1 its room.
  assert.ok(Math.abs(box.left + box.width + box.right - box.firstRoom) < 0.02);
  const html = build([hymn([verse('Ⲙⲁⲣⲉⲛ')])], OPTIONS);
  const twoLine = /\.coptic-initial \{([^}]+)\}/.exec(html)[1];
  assert.match(twoLine, /margin: [\d.]+px 0 0 -?[\d.]+px;/);
  assert.match(twoLine, /shape-outside: polygon\(0 0, calc\(100% - [\d.]+px\) 0, calc\(100% - [\d.]+px\) 55%, 100% 55%, 100% 100%, 0 100%\);/);
});

test('on Night the initials take the season\'s own vine and letter; elsewhere the titles\' gold and the ornaments\' colour', () => {
  const night = themes.DOCUMENT_THEMES.night ?? Object.values(themes.DOCUMENT_THEMES).find((page) => page.id === 'night');
  assert.deepEqual(ornaments.documentInitialColors(night, 'annual'), { vine: '#E3B53B', letter: '#5FAE68' });
  assert.deepEqual(ornaments.documentInitialColors(night, 'gold'), { vine: '#5FAE68', letter: '#EDBE45' });
  assert.deepEqual(ornaments.documentInitialColors(night, 'holyweek'), { vine: '#3E3333', letter: '#D63A40' });
  for (const page of Object.values(themes.DOCUMENT_THEMES).filter((entry) => entry.id !== 'night')) {
    assert.deepEqual(ornaments.documentInitialColors(page, 'lent'), { vine: page.colors.accent, letter: ornaments.documentOrnamentColor(page, 'lent') });
  }
  const html = build([hymn([verse('Ⲙⲁⲣⲉⲛ')])], { ...OPTIONS, initialColors: { vine: '#5FAE68', letter: '#EDBE45' } });
  assert.ok(html.includes('.coptic-initial-vine { fill: #5FAE68; }'));
  assert.ok(html.includes('.coptic-initial-art .coptic-initial-letter { fill: #EDBE45; }'));
  assert.ok(html.includes('.opening-word { color: #EDBE45; }'));
  // The English initial, one colour, takes the letter's.
  assert.ok(html.includes('.english-initial-art .english-initial-letter { fill: #EDBE45; }'));
});

test('the line marked opens in English and Arabic too, its first words in the letter\'s colour', () => {
  const html = build([hymn([verse('Ⲕⲥ̀ⲙⲁⲣⲱⲟⲩⲧ ⲡϭⲟⲓⲥ', { english: 'Blessed are You, O Lord', arabic: 'مبارك أنت أيها الرب', dropCap: true }), verse('Ⲡⲉⲛⲛⲟⲩϯ', { english: 'Our God', arabic: 'إلهنا' })])], OPTIONS);
  const page = body(html);
  // English: its capital, as wide as its letter, drawn once and pointed to, the letter kept unseen, the rest of the word in small capitals.
  assert.match(page, /<span class="english-initial" style="width: [\d.]+px;"><svg class="english-initial-art" viewBox="115 -1532 1323 1699" aria-hidden="true"><use class="english-initial-letter" href="#en-initial-42"><\/use><\/svg>/);
  assert.match(html, /<path id="en-initial-42" d="M/);
  assert.equal((html.match(/id="en-initial-[0-9a-f]+"/g) || []).length, 1);
  assert.ok(page.includes('<span class="english-initial-text">B</span></span><span class="opening-word english-small-caps">lessed</span> are You, O Lord'));
  // Arabic: its first word stretched, larger and bold.
  assert.ok(page.includes('<span class="opening-word arabic-opening">مبـــارك</span> أنت أيها الرب'));
  // Coptic: the rest of the word after its initial.
  assert.ok(page.includes('<span class="opening-word">ⲥ̀ⲙⲁⲣⲱⲟⲩⲧ</span> ⲡϭⲟⲓⲥ'));
  // The line after it, unmarked, doesn't.
  assert.equal((page.match(/class="english-initial"/g) || []).length, 1);
  assert.ok(page.includes('>Our God<'));
  // With the Coptic hidden, the English and Arabic still open on that row.
  const noCoptic = body(build([hymn([verse('Ⲕⲥ̀ⲙⲁⲣⲱⲟⲩⲧ', { english: 'Blessed', arabic: 'مبارك', dropCap: true })])], { ...OPTIONS, visibleColumns: { english: true, french: false, coptic: false, arabic: true } }));
  assert.equal((noCoptic.match(/class="english-initial"/g) || []).length, 1);
  assert.equal((noCoptic.match(/coptic-initial-text/g) || []).length, 0);
  // And so does a recited prayer's, its Coptic switched off.
  const recited = body(build([hymn([verse('Ⲡⲉⲛⲓⲱⲧ', { english: 'Our Father', arabic: 'أبانا', type: 'recitedPrayer', dropCap: true })])], { ...OPTIONS, copticRecitedPrayers: false }));
  assert.ok(recited.includes('<span class="english-initial-text">O</span></span><span class="opening-word english-small-caps">ur</span> Father'));
  assert.deepEqual(initials(recited), []);
});

test('the French opens as the English does, on an Old English capital, the rest of its first word in small capitals', () => {
  const columns = { english: true, french: true, coptic: true, arabic: true };
  const page = body(build([hymn([verse('Ⲙⲁⲣⲉⲛϣⲉⲡϩ̀ⲙⲟⲧ', { english: 'Let us give thanks', french: 'Rendons grâce', dropCap: true })])], { ...OPTIONS, visibleColumns: columns }));
  assert.ok(page.includes('<span class="english-initial-text">L</span></span><span class="opening-word english-small-caps">et</span> us give thanks'));
  assert.ok(page.includes('<span class="english-initial-text">R</span></span><span class="opening-word english-small-caps">endons</span> grâce'));
  // Each letter drawn once for the page, English and French alike.
  const html = build([hymn([verse('Ⲙⲁⲣⲉⲛ', { english: 'Rejoice', french: 'Réjouis-toi', dropCap: true })])], { ...OPTIONS, visibleColumns: columns });
  assert.equal((html.match(/id="en-initial-52"/g) || []).length, 1);
  assert.equal((body(html).match(/class="english-initial"/g) || []).length, 2);
  // A French line opening on a letter there is no Old English capital for (an accented one, a quote) is left as it is.
  const accented = body(build([hymn([verse('Ⲙⲁⲣⲉⲛ', { english: 'To You', french: 'À toi', dropCap: true })])], { ...OPTIONS, visibleColumns: columns }));
  assert.ok(accented.includes('>À toi<'));
  assert.equal((accented.match(/class="english-initial"/g) || []).length, 1);
  // An unmarked line's French doesn't open.
  assert.ok(body(build([hymn([verse('Ⲙⲁⲣⲉⲛ', { french: 'Rendons grâce' })])], { ...OPTIONS, visibleColumns: columns })).includes('>Rendons grâce<'));
});

test('the Coptic initial is its letter\'s capital, whatever case the letter is in', () => {
  assert.deepEqual(coptic.splitCopticInitial('ⲙⲁⲣⲉⲛ'), { letter: 'Ⲙ', marks: '', rest: 'ⲁⲣⲉⲛ' });
  // The three some engines' case tables lack.
  assert.equal(coptic.splitCopticInitial('ⲭⲉⲣⲉ').letter, 'Ⲭ');
  assert.equal(coptic.splitCopticInitial('ϭⲓⲥⲓ').letter, 'Ϭ');
  assert.equal(coptic.splitCopticInitial('ϯⲛⲟⲩ').letter, 'Ϯ');
  assert.equal(coptic.splitCopticInitial('(Ⲙⲁⲣⲉⲛ)'), null);
  assert.equal(coptic.splitCopticInitial(''), null);
});

test('the loader marks the lines that open, hymn_texts.drop_cap and each reading\'s first verse, and their Coptic takes the capital', () => {
  const library = fs.readFileSync('src/utils/hymnLibrary.js', 'utf8');
  // Every column, drop_cap with them, whether or not the content Worker serving them knows it yet.
  assert.match(library, /const SERVICE_TEXT_FIELDS = "\*";/);
  assert.match(library, /const INLINE_TEXT_FIELDS = "\*";/);
  assert.match(fs.readFileSync('src/utils/saintHymns.ts', 'utf8'), /const TEXT_COLUMNS = '\*';/);
  // Each hymn line carries its own mark, by either road a line takes into a document.
  assert.equal((library.match(/dropCap: Boolean\(row\.drop_cap\),/g) || []).length, 2);
  assert.match(library, /drop_cap: Boolean\(line\?\.drop_cap\),/);
  // The capital goes to the marked lines' Coptic, whatever the hymn's title.
  const casing = library.slice(library.indexOf('function applyCopticCaseToSection'), library.indexOf('function lowercaseCoptic'));
  assert.match(casing, /return \{ \.\.\.verse, coptic: verse\.dropCap \? uppercaseFirstCopticChar\(coptic\) : coptic \};/);
  assert.doesNotMatch(casing, /title/);
  assert.doesNotMatch(library, /skipHymnCapitalization/);
  // Every reading opens on its first verse, Coptic or not: the Bible's, a Pascha Psalm read from its hymn, each commemoration of the Synaxarium.
  assert.equal((library.match(/openOnFirstVerse\(/g) || []).length, 5);
  assert.match(library, /return openOnFirstVerse\(applyCopticCaseToReadingVerses\(\[/);
  assert.match(library, /return \{ verses: openOnFirstVerse\(applyCopticCaseToReadingVerses\(hymnVerses\)\), citation \};/);
  assert.match(library, /const verses = openOnFirstVerse\(\(entry\.paragraphs \|\| \[\]\)\.map/);
  const source = /function openOnFirstVerse\(verses\) \{[\s\S]*?\n\}/.exec(library)[0];
  const openOnFirstVerse = new Function(`${source}; return openOnFirstVerse;`)();
  assert.deepEqual(openOnFirstVerse([{ type: 'text', english: 'In' }, { type: 'text', english: 'And' }]), [{ type: 'text', english: 'In', dropCap: true }, { type: 'text', english: 'And' }]);
  assert.deepEqual(openOnFirstVerse([{ type: 'comment', english: '(Chanted)' }, { type: 'text', english: 'O' }]).map((verse) => Boolean(verse.dropCap)), [false, true]);
  assert.deepEqual(openOnFirstVerse([]), []);
  // And so does the Lectionary's.
  assert.match(fs.readFileSync('src/utils/readingsService.ts', 'utf8'), /verses: \[\.\.\.citationVerse, \.\.\.readingVerses\.map\(\(verse, index\) => \(index === 0 \? \{ \.\.\.verse, dropCap: true \} : verse\)\)\],/);
});
