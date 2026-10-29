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

const art = loadFile('src/constants/ornamentArt.ts');
const ornaments = loadFile('src/constants/documentOrnaments.ts', (name) => (name === './ornamentArt' ? art : require(name)));
const { withDocumentOrnaments, DOCUMENT_TITLE_SECTION_ID, DOCUMENT_END_SECTION_ID } = loadFile('src/utils/documentOrnaments.ts');

const section = (id, hymnKey, english = '', extra = {}) => ({ id, hymnKey, title: { english, arabic: '' }, verses: [{ english: 'A verse' }], ...extra });
const TITLE = { english: 'Midnight Praises', arabic: 'تسبحة نصف الليل', french: 'Louange de minuit' };

test('a service opens on its name in the Stepped headpiece and closes on the Medallion, before its way on', () => {
  const dressed = withDocumentOrnaments([
    section('intro-1', 'introductionToTheMidnightPraises', 'Introduction'),
    section('MORNING_DOXOLOGY-251', undefined, 'Morning Doxology', { verses: [], isHyperlinkButton: true, hyperlinkKey: 'MORNING_DOXOLOGY' }),
  ], TITLE);
  assert.deepEqual(dressed.map((entry) => entry.id), [DOCUMENT_TITLE_SECTION_ID, 'intro-1', DOCUMENT_END_SECTION_ID, 'MORNING_DOXOLOGY-251']);
  assert.equal(dressed[0].ornament, 'stepped');
  assert.deepEqual(dressed[0].title, TITLE);
  assert.equal(dressed[2].ornament, 'medallion');
  assert.deepEqual(dressed[2].verses, []);
});

test('each Hoos is set in a Lintel, on its titled first part only', () => {
  const seasonalHooses = [
    'theKiahkHoos',
    'theNativityHoos',
    'theTheophanyHoos',
    'theLentenHoos',
    'thePalmSundayHoos',
    'theResurrectionHoos',
  ];
  const dressed = withDocumentOrnaments([
    section('theFirstHoos-29', 'theFirstHoos', 'The First Hoos'),
    section('theFirstHoos-29-cont1', 'theFirstHoos'),
    section('theFourthHoos-122', 'theFourthHoos', 'The Fourth Hoos'),
    section('theFirstHoosLobsh-30', 'theFirstHoosLobsh', 'Lobsh'),
    ...seasonalHooses.map((key, index) => section(`${key}-${index}`, key, key)),
  ], TITLE);
  const byId = Object.fromEntries(dressed.map((entry) => [entry.id, entry.ornament]));
  assert.equal(byId['theFirstHoos-29'], 'lintel');
  assert.equal(byId['theFirstHoos-29-cont1'], undefined);
  assert.equal(byId['theFourthHoos-122'], 'lintel');
  assert.equal(byId['theFirstHoosLobsh-30'], undefined);
  for (const [index, key] of seasonalHooses.entries()) {
    assert.equal(byId[`${key}-${index}`], 'lintel', key);
  }
});

test('the three anaphoras set their Anaphora, Sanctus and Confession in a Lintel', () => {
  const keys = ['StBasil', 'StGregory', 'StCyril'].flatMap((saint) => [`anaphora${saint}`, `sanctus${saint}`, `confession${saint}`]);
  const dressed = withDocumentOrnaments([
    ...keys.map((key, index) => section(`${key}-${index}`, key, key)),
    section('confessionStBasil-161-cont1', 'confessionStBasil'),
    section('alternateConfessionResponse-162', 'alternateConfessionResponse', 'Alternate Confession Response'),
  ], TITLE);
  const byId = Object.fromEntries(dressed.map((entry) => [entry.id, entry.ornament]));
  for (const [index, key] of keys.entries()) assert.equal(byId[`${key}-${index}`], 'lintel', key);
  assert.equal(byId['confessionStBasil-161-cont1'], undefined);
  assert.equal(byId['alternateConfessionResponse-162'], undefined);
});

test('the Psalm and Gospel are set in the Three Roundels, in every service that reads them', () => {
  const titleOnly = (id, english) => ({ id, title: { english, arabic: '' }, verses: [] });
  const dressed = withDocumentOrnaments([
    titleOnly('GOSPEL_RITE-34', 'Psalm and Gospel'),
    section('psalmResponse-1', 'psalmResponse', 'Psalm Response'),
    titleOnly('PALM_SUNDAY_LITURGY_GOSPEL_RITE-34.5', 'Psalms and Gospels'),
    titleOnly('MOURNFUL_GOSPEL_RITE-12', 'Psalm and Gospel'),
    titleOnly('MOURNFUL_4_GOSPELS_RITE-20', 'Psalm and Gospels'),
  ], TITLE);
  const byId = Object.fromEntries(dressed.map((entry) => [entry.id, entry.ornament]));
  for (const id of ['GOSPEL_RITE-34', 'PALM_SUNDAY_LITURGY_GOSPEL_RITE-34.5', 'MOURNFUL_GOSPEL_RITE-12', 'MOURNFUL_4_GOSPELS_RITE-20']) {
    assert.equal(byId[id], 'roundels', id);
  }
  assert.equal(byId['psalmResponse-1'], undefined);
});

test('the Theotokia of the day is announced in the Interlace just before the Psali\'s conclusion, named from the Theotokia that follows', () => {
  const dressed = withDocumentOrnaments([
    // A Sunday Theotokia part prayed earlier in the service must not name the day.
    section('theSundayTheotokia7-36', 'theSundayTheotokia7', 'The Sunday Theotokia (7)'),
    section('conclusionOfTheVatosPsali-130.5', 'conclusionOfTheVatosPsali', 'Conclusion of the Vatos Psali', { bishopOnly: true }),
    section('theThursdayTheotokia1-131', 'theThursdayTheotokia1', 'The Thursday Theotokia (1)'),
  ], TITLE);
  const at = dressed.findIndex((entry) => entry.id === 'conclusionOfTheVatosPsali-130.5');
  const announcement = dressed[at - 1];
  assert.equal(announcement.ornament, 'interlace');
  assert.deepEqual(announcement.title, { english: 'The Thursday Theotokia', arabic: 'ثاؤطوكية يوم الخميس', french: 'Théotokie du jeudi' });
  assert.deepEqual(announcement.verses, []);
  // Shown and hidden with the conclusion.
  assert.equal(announcement.bishopOnly, true);
  // No Theotokia after it, no announcement.
  const bare = withDocumentOrnaments([section('conclusionOfTheAdamPsali-130', 'conclusionOfTheAdamPsali', 'Conclusion of the Adam Psali')], TITLE);
  assert.equal(bare.filter((entry) => entry.ornament === 'interlace').length, 0);
});

test('ornaments follow the season on Night and Paper and keep to the page on the others', () => {
  const { documentOrnamentColor } = ornaments;
  const page = (id, text) => ({ id, colors: { text } });
  assert.equal(documentOrnamentColor(page('night', '#FFFFFF'), 'lent'), '#4F9672');
  assert.equal(documentOrnamentColor(page('night', '#FFFFFF')), '#5FAE68');
  assert.equal(documentOrnamentColor(page('paper', '#1C1C1C'), 'holyweek'), '#A0202A');
  // The Resurrection's ornaments are gold on either page, as its glow is.
  assert.equal(documentOrnamentColor(page('paper', '#1C1C1C'), 'resurrection'), '#966D00');
  assert.equal(documentOrnamentColor(page('night', '#FFFFFF'), 'resurrection'), '#E3B53B');
  // St Mary's fast and feast and the Annunciation: an azure on black, a cobalt on white.
  assert.equal(documentOrnamentColor(page('night', '#FFFFFF'), 'marian'), '#5BA0FA');
  assert.equal(documentOrnamentColor(page('paper', '#1C1C1C'), 'marian'), '#1D60BC');
  for (const [id, text] of [['walnut', '#F3E7D3'], ['vine', '#F1EAD6'], ['sepia', '#2F2219']]) {
    assert.equal(documentOrnamentColor(page(id, text), 'holyweek'), text, id);
  }
});

test('every ornament is drawn in currentColor, and each headpiece has room for its title', () => {
  for (const name of ['LINTEL_ART', 'STEPPED_ART', 'INTERLACE_ART', 'MEDALLION_ART']) {
    assert.match(art[name].body, /currentColor/, name);
    assert.doesNotMatch(art[name].body, /<svg/, name);
  }
  for (const [kind, frame] of Object.entries(ornaments.HEADPIECES)) {
    assert.ok(frame.text.left + frame.text.right < 100 && frame.text.top + frame.text.bottom < 100, kind);
    assert.ok(frame.minFontSize >= 15, kind);
  }
});

test('the reader draws each ornament once and points to it; the slideshow knows them too', () => {
  const html = fs.readFileSync('src/components/vine/documentHtml.ts', 'utf8');
  assert.match(html, /<symbol id="cv-ornament-\$\{kind\}"/);
  assert.match(html, /<use href="#cv-ornament-\$\{kind\}"><\/use>/);
  assert.match(html, /<use href="#cv-ornament-medallion"><\/use>/);
  const slideshow = fs.readFileSync('src/components/vine/SlideshowContainer.js', 'utf8');
  assert.match(slideshow, /section\.ornament === "medallion"/);
  assert.match(slideshow, /item\.type === "title" && item\.ornament/);
  const layout = fs.readFileSync('src/components/vine/slideshowLayout.js', 'utf8');
  assert.match(layout, /HEADPIECE_ASPECT = \{ lintel: 230 \/ 1200, stepped: 400 \/ 1200, interlace: 460 \/ 1200, roundels: 400 \/ 1200 \}/);
  // The service is dressed as it arrives, with the season it is prayed in.
  const service = fs.readFileSync('src/components/vine/screens/ServiceDocument.tsx', 'utf8');
  assert.match(service, /withDocumentOrnaments\(hydrated, ownTitle \?\? \{ english: title, arabic, french \}\)/);
  assert.match(service, /ornamentColor=\{documentOrnamentColor\(documentTheme, ornamentSeason\)\}/);
  // Holy Week's services always wear Holy Week's colours, whatever the calendar's day.
  assert.match(fs.readFileSync('src/app/holy-week/[dayId]/[hourId].tsx', 'utf8'), /ornamentSeason="holyweek"/);
  assert.match(service, /fixedOrnamentSeason\n?\s*\? Promise\.resolve\(fixedOrnamentSeason\)/);
});
