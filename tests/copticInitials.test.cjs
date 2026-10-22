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
  assert.ok(body(html).includes('<span class="coptic-initial-text">Ⲙ</span></span>ⲁⲣⲉⲛϣⲉⲡϩ̀ⲙⲟⲧ'));
  // Drawn once, for the letter used, from the vine's own pieces.
  assert.match(html, /<path id="cv-initial-2c98" d="M/);
  assert.equal((html.match(/id="cv-initial-[0-9a-f]+"/g) || []).length, 1);
  const vine = art.COPTIC_INITIALS['Ⲙ'].vine;
  assert.ok(html.includes(`<g id="cv-initial-vine-2c98">${vine.map((piece) => `<use href="#cv-vine-piece-${piece}"></use>`).join('')}</g>`));
  for (const piece of new Set(vine)) assert.ok(html.includes(`<path id="cv-vine-piece-${piece}" d="${art.COPTIC_INITIAL_VINE_PIECES[piece]}"></path>`));
  // Only the Coptic column: the English and Arabic beside it stay as they are.
  assert.equal((body(html).match(/coptic-initial-text/g) || []).length, 1);
});

test('the letter carries its jinkim into the copied text', () => {
  const html = build([hymn([verse('  Ⲁ̀ⲙⲏⲛ ⲁⲗⲗⲏⲗⲟⲩⲓⲁ')])], OPTIONS);
  assert.ok(body(html).includes('<span class="coptic-initial-text">Ⲁ̀</span></span>ⲙⲏⲛ ⲁⲗⲗⲏⲗⲟⲩⲓⲁ'));
});

test('only the first Coptic paragraph under a title, and only when it opens on a decorated capital', () => {
  // Untitled: a hymn's continuation, which never gets a capital.
  assert.deepEqual(initials(build([hymn([verse('Ⲙⲁⲣⲉⲛ')], { english: '', arabic: '' })], OPTIONS)), []);
  // The first paragraph opens otherwise: no initial, and none further down either.
  assert.deepEqual(initials(build([hymn([verse('(Ⲙⲁⲣⲉⲛ)'), verse('Ⲙⲁⲣⲉⲛ')])], OPTIONS)), []);
  assert.deepEqual(initials(build([hymn([verse('ⲙⲁⲣⲉⲛ'), verse('Ⲙⲁⲣⲉⲛ')])], OPTIONS)), []);
  // A reading's verse opens on its number.
  assert.deepEqual(initials(build([hymn([verse('Ⲡⲁⲩⲗⲟⲥ', { bibleVerseNumber: '1' })])], OPTIONS)), []);
  // A line with no Coptic of its own leaves the initial to the paragraph that has some.
  const html = build([hymn([verse('', { english: 'The priest says' }), verse('Ⲙⲁⲣⲉⲛ'), verse('Ⲡⲉⲛⲛⲟⲩϯ')])], OPTIONS);
  assert.deepEqual(initials(html), ['<span class="coptic-initial" data-fit>']);
  assert.ok(body(html).includes('<span class="coptic-initial-text">Ⲙ</span>'));
});

test('no Coptic column, no initial; an Invincible Coptic line still takes it', () => {
  const english = { english: true, french: false, coptic: false, arabic: true };
  assert.deepEqual(initials(build([hymn([verse('Ⲙⲁⲣⲉⲛ')])], { ...OPTIONS, visibleColumns: english })), []);
  const invincible = build([hymn([verse('Ⲁⲅⲓⲟⲥ', { english: '', arabic: '', invincibleCoptic: true })])], { ...OPTIONS, visibleColumns: english });
  // Alone on its row it is centred: a line tall from the start, with nothing to measure.
  assert.deepEqual(initials(invincible), ['<span class="coptic-initial one-line">']);
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
