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

test('a titled hymn opens its first Coptic paragraph with the decorated initial, the letter kept in the text', () => {
  const html = build([hymn([verse('Ⲙⲁⲣⲉⲛϣⲉⲡϩ̀ⲙⲟⲧ'), verse('Ϫⲉ ⲁϥⲉⲣⲥ̀ⲕⲉⲡⲁⲍⲓⲛ')])], OPTIONS);
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
  const html = build([hymn([verse('  Ⲁ̀ⲙⲏⲛ ⲁⲗⲗⲏⲗⲟⲩⲓⲁ')])], OPTIONS);
  assert.ok(body(html).includes('<span class="coptic-initial-text">Ⲁ̀</span></span><span class="opening-word">ⲙⲏⲛ</span> ⲁⲗⲗⲏⲗⲟⲩⲓⲁ'));
});

test('the hymn\'s capital takes the initial: the first Coptic paragraph under a title to open on one, and only that one', () => {
  // Untitled: a hymn's continuation, which never gets a capital.
  assert.deepEqual(initials(build([hymn([verse('Ⲙⲁⲣⲉⲛ')], { english: '', arabic: '' })], OPTIONS)), []);
  // The people's Kyrie kept in lower case before the Verses of the Cymbals: the capital after it takes the initial.
  const cymbals = build([hymn([verse('ⲕⲩⲣⲓⲉ ⲉ̀ⲗⲉⲏ̀ⲥⲟⲛ'), verse('Ⲧⲉⲛⲟⲩⲱϣⲧ ⲙ̀Ⲫⲓⲱⲧ'), verse('Ⲭⲉⲣⲉ ⲧⲉⲕⲕⲗⲏⲥⲓⲁ')])], OPTIONS);
  assert.deepEqual(initials(cymbals), ['<span class="coptic-initial" data-fit>']);
  assert.ok(body(cymbals).includes('<span class="coptic-initial-text">Ⲧ</span></span><span class="opening-word">ⲉⲛⲟⲩⲱϣⲧ</span>'));
  assert.ok(body(cymbals).includes('>Ⲭⲉⲣⲉ ⲧⲉⲕⲕⲗⲏⲥⲓⲁ<'), 'one initial a hymn');
  // A capital that doesn't open its paragraph stays in its line.
  assert.deepEqual(initials(build([hymn([verse('(Ⲙⲁⲣⲉⲛ)'), verse('ⲙⲁⲣⲉⲛ')])], OPTIONS)), []);
  // A reading's verse opens on its number.
  assert.deepEqual(initials(build([hymn([verse('Ⲡⲁⲩⲗⲟⲥ', { bibleVerseNumber: '1' })])], OPTIONS)), []);
  // A line with no Coptic of its own leaves the initial to the paragraph that has some.
  const html = build([hymn([verse('', { english: 'The priest says' }), verse('Ⲙⲁⲣⲉⲛ'), verse('Ⲡⲉⲛⲛⲟⲩϯ')])], OPTIONS);
  assert.deepEqual(initials(html), ['<span class="coptic-initial" data-fit>']);
  assert.ok(body(html).includes('<span class="coptic-initial-text">Ⲙ</span>'));
});

test('no Coptic column, no initial; an Invincible Coptic line alone on its row is a refrain and takes none either', () => {
  const english = { english: true, french: false, coptic: false, arabic: true };
  assert.deepEqual(initials(build([hymn([verse('Ⲙⲁⲣⲉⲛ')])], { ...OPTIONS, visibleColumns: english })), []);
  const invincible = build([hymn([verse('Ⲁⲅⲓⲟⲥ', { english: '', arabic: '', invincibleCoptic: true })])], { ...OPTIONS, visibleColumns: english });
  assert.deepEqual(initials(invincible), []);
  assert.ok(body(invincible).includes('>ⲁⲅⲓⲟⲥ<'));
});

test('a standalone refrain before the hymn is set in lower case without an initial; the paragraph after it opens the hymn', () => {
  // The Sanctus: a rubric, ⲁⲅⲓⲟⲥ ⲁⲅⲓⲟⲥ ⲁⲅⲓⲟⲥ alone on its row, then the hymn, kept in lower case in the books.
  const sanctus = build([hymn([
    verse('', { english: 'The priest takes the veil', type: 'comment' }),
    verse('Ⲁⲅⲓⲟⲥ ⲁⲅⲓⲟⲥ ⲁⲅⲓⲟⲥ.', { english: '', arabic: '', prayerType: 'Invincible Coptic' }),
    verse('ⲭⲟⲩⲁⲃ ⲭⲟⲩⲁⲃ ⲭⲟⲩⲁⲃ', { english: 'Holy, holy, holy', arabic: 'قدوسٌ' }),
  ])], OPTIONS);
  assert.deepEqual(initials(sanctus), ['<span class="coptic-initial" data-fit>']);
  assert.ok(body(sanctus).includes('>ⲁⲅⲓⲟⲥ ⲁⲅⲓⲟⲥ ⲁⲅⲓⲟⲥ.<'));
  assert.ok(body(sanctus).includes('<span class="coptic-initial-text">Ⲭ</span></span><span class="opening-word">ⲟⲩⲁⲃ</span> ⲭⲟⲩⲁⲃ ⲭⲟⲩⲁⲃ'));
  // Its English and Arabic open on that paragraph too.
  assert.ok(body(sanctus).includes('<span class="english-initial-text">H</span></span><span class="opening-word english-small-caps">oly,</span> holy, holy'));
  // A seasonal Hoos's ⲇⲟⲝⲁⲥⲓ ⲟ ⲑⲉⲟⲥ ⲏⲙⲱⲛ, already in lower case.
  const hoos = build([hymn([verse('ⲇⲟⲝⲁⲥⲓ ⲟ ⲑⲉⲟⲥ ⲏⲙⲱⲛ.', { english: '', arabic: '', invincibleCoptic: true }), verse('Ⲁⲣⲓⲯⲁⲗⲓⲛ')])], OPTIONS);
  assert.ok(body(hoos).includes('<span class="coptic-initial-text">Ⲁ</span>'));
  // Without a refrain before it, a paragraph in lower case still leaves the initial to the capital after it.
  assert.ok(body(build([hymn([verse('ⲕⲩⲣⲓⲉ ⲉⲗⲉⲏⲥⲟⲛ'), verse('Ⲧⲉⲛⲟⲩⲱϣⲧ')])], OPTIONS)).includes('<span class="coptic-initial-text">Ⲧ</span>'));
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

test('the English initial is the first capital: an Old English letter with its vine, a square from line 1\'s capitals to line 2\'s baseline', () => {
  assert.deepEqual(openings.splitEnglishOpening('Blessed are You'), { letter: 'B', rest: 'lessed are You' });
  assert.equal(openings.splitEnglishOpening('“Blessed'), null);
  assert.equal(openings.splitEnglishOpening('the light'), null);
  // Every capital, its vine and its letter apart, to colour each.
  const englishArt = loadFile('src/constants/englishInitialArt.ts');
  assert.equal(Object.keys(englishArt.ENGLISH_INITIALS).join(''), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ');
  for (const [letter, initial] of Object.entries(englishArt.ENGLISH_INITIALS)) {
    assert.match(initial.vine, /^M\d+ \d+l/, letter);
    assert.match(initial.letter, /^M\d+ \d+l/, letter);
  }
  // The design's own reader, 22px Georgia on 29px lines: 44px square, 7px down, 10px after it, the rest of the word 8px nearer.
  const metrics = openings.englishInitialMetrics('A', 22, 29);
  assert.ok(Math.abs(metrics.size - 44) < 0.5, `${metrics.size}`);
  assert.ok(Math.abs(metrics.top - 7) < 0.2, `${metrics.top}`);
  assert.ok(Math.abs(metrics.room - metrics.size - 10) < 0.01);
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
  // The English initial takes the same pair.
  assert.ok(html.includes('.english-initial-vine { fill: #5FAE68; }'));
  assert.ok(html.includes('.english-initial-art .english-initial-letter { fill: #EDBE45; }'));
});

test('the row the hymn opens on opens in English and Arabic too, its first words in the letter\'s colour', () => {
  const html = build([hymn([verse('Ⲕⲥ̀ⲙⲁⲣⲱⲟⲩⲧ ⲡϭⲟⲓⲥ', { english: 'Blessed are You, O Lord', arabic: 'مبارك أنت أيها الرب' }), verse('Ⲡⲉⲛⲛⲟⲩϯ', { english: 'Our God', arabic: 'إلهنا' })])], OPTIONS);
  const page = body(html);
  // English: its capital with its vine, drawn once and pointed to, the letter kept unseen, the rest of the word in small capitals.
  assert.ok(page.includes('<span class="english-initial"><svg class="english-initial-art" viewBox="0 0 1000 1000" aria-hidden="true"><use class="english-initial-vine" href="#en-initial-vine-42"></use><use class="english-initial-letter" href="#en-initial-42"></use></svg>'));
  assert.match(html, /<path id="en-initial-vine-42" d="M/);
  assert.equal((html.match(/id="en-initial-vine-[0-9a-f]+"/g) || []).length, 1);
  assert.ok(page.includes('<span class="english-initial-text">B</span></span><span class="opening-word english-small-caps">lessed</span> are You, O Lord'));
  // Arabic: its first word stretched, larger and bold.
  assert.ok(page.includes('<span class="opening-word arabic-opening">مبـــارك</span> أنت أيها الرب'));
  // Coptic: the rest of the word after its initial.
  assert.ok(page.includes('<span class="opening-word">ⲥ̀ⲙⲁⲣⲱⲟⲩⲧ</span> ⲡϭⲟⲓⲥ'));
  // Once a hymn.
  assert.equal((page.match(/class="english-initial"/g) || []).length, 1);
  assert.ok(page.includes('>Our God<'));
  // With the Coptic hidden, the English and Arabic still open on that row.
  const noCoptic = body(build([hymn([verse('Ⲕⲥ̀ⲙⲁⲣⲱⲟⲩⲧ', { english: 'Blessed', arabic: 'مبارك' })])], { ...OPTIONS, visibleColumns: { english: true, french: false, coptic: false, arabic: true } }));
  assert.equal((noCoptic.match(/class="english-initial"/g) || []).length, 1);
  assert.equal((noCoptic.match(/coptic-initial-text/g) || []).length, 0);
});
