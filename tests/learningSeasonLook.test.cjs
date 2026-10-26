const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');

function load(path, moduleRequire = require) {
  const javascript = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const moduleObject = { exports: {} };
  new Function('exports', 'require', 'module', javascript)(moduleObject.exports, moduleRequire, moduleObject);
  return moduleObject.exports;
}

const appearance = load('src/constants/seasonAppearance.ts');
const { learningSeasonLook } = load('src/utils/learningSeasonLook.ts', (name) => (name === '../constants/seasonAppearance' ? appearance : require(name)));

// The platform's seasons as Learn & Study lists them (learning.seasons), and the colours each wears.
const SEASONS = [
  ['annual-psalmody', 'Annual Psalmody', 'annual'],
  ['raising-of-incense', 'Raising of Incense', 'annual'],
  ['liturgy', 'Liturgy', 'annual'],
  ['joyful-29', 'Joyful 29th of the Coptic Month', 'gold'],
  ['nayrouz', 'Feast of Nayrouz', 'gold'],
  ['feast-of-the-cross', 'Feast of the Cross', 'palm'],
  ['nativity-fast-kiahk', 'Nativity Fast / Kiahk', 'natfast'],
  ['nativity-paramoun', 'Nativity Paramoun', 'lent'],
  ['nativity', 'Glorious Feast of the Nativity', 'nativity'],
  ['circumcision', 'Feast of the Circumcision', 'nativity'],
  ['theophany-paramoun', 'Theophany Paramoun', 'lent'],
  ['theophany', 'Glorious Feast of the Theophany', 'theophany'],
  ['wedding-at-cana', 'Feast of the Wedding at Cana of Galilee', 'gold'],
  ['entry-into-temple', 'Feast of the Entry of Christ into the Temple', 'gold'],
  ['annunciation', 'Feast of the Annunciation', 'marian'],
  ['jonahs-fast', "Jonah's Fast", 'lent'],
  ['lent', 'Great Lent', 'lent'],
  ['lazarus-saturday', 'Lazarus Saturday', 'annual'],
  ['palm-sunday', 'Feast of Palm Sunday', 'palm'],
  ['holy-week', 'Holy Week', 'holyweek'],
  ['resurrection', 'Glorious Feast of the Resurrection', 'resurrection'],
  ['thomas-sunday', 'Thomas Sunday', 'resurrection'],
  ['ascension', 'Feast of the Ascension', 'resurrection'],
  ['pentecost', 'Feast of Pentecost', 'resurrection'],
  ['entry-into-egypt', 'Feast of the Entry of the Holy Family into Egypt', 'gold'],
  ['apostles-fast-and-feast', 'Fast and Feast of the Apostles', 'apostles'],
  ['st-mary-fast-and-feast', 'Fast and Feast of the Virgin Mary', 'marian'],
  ['transfiguration', 'Feast of the Transfiguration', 'gold'],
  ['other', 'Other', 'annual'],
];

test('each Learn season wears the colour the Books calendar gives its day: the Ascension white, as the Holy Fifty Days', () => {
  for (const [slug, title, theme] of SEASONS) {
    assert.equal(learningSeasonLook({ slug, title }).theme, theme, `${title}`);
  }
  // The Holy Fifty Days' tiles are the pale ones, their names set dark.
  for (const slug of ['resurrection', 'thomas-sunday', 'ascension', 'pentecost']) {
    const look = learningSeasonLook({ slug, title: slug });
    assert.equal(look.light, true, slug);
    assert.equal(look.from, appearance.DAY_BLOCK_THEMES.resurrection.from, slug);
  }
});

test('a season the calendar has no day for is read from its name, a Holy Fifty Days feast white before "feast" makes it gold', () => {
  assert.equal(learningSeasonLook({ title: 'Feast of the Ascension' }).theme, 'resurrection');
  assert.equal(learningSeasonLook({ slug: 'hymns-of-thomas-sunday', title: 'Hymns of Thomas Sunday' }).theme, 'resurrection');
  assert.equal(learningSeasonLook({ slug: 'kiahk-praises', title: 'Kiahk Praises' }).theme, 'natfast');
  assert.equal(learningSeasonLook({ title: 'Some Feast' }).theme, 'gold');
  // A slug that names something on every object is not taken for a calendar day.
  assert.equal(learningSeasonLook({ slug: 'constructor', title: 'Constructor' }).theme, 'annual');
});

const icons = load('src/constants/seasonIcons.ts');

test('each Learn season wears an icon from the design, the sets their own and a feast its set\'s', () => {
  const expected = {
    'annual-psalmody': 'psalmody',
    'raising-of-incense': 'incense',
    liturgy: 'liturgy',
    'joyful-29': 'joyful',
    nayrouz: 'nayrouz',
    'feast-of-the-cross': 'cross',
    'nativity-fast-kiahk': 'kiahk',
    nativity: 'nativity',
    'nativity-paramoun': 'nativity',
    theophany: 'theophany',
    'jonahs-fast': 'jonah',
    lent: 'lent',
    'palm-sunday': 'palm',
    'holy-week': 'holyweek',
    resurrection: 'holy50',
    'apostles-fast-and-feast': 'apostles',
    'st-mary-fast-and-feast': 'marian',
    // Not drawn: the budded cross.
    'entry-into-egypt': 'cross',
    other: 'cross',
  };
  for (const [slug, icon] of Object.entries(expected)) assert.equal(icons.seasonIconFor(slug), icon, slug);
  for (const [slug] of SEASONS) assert.ok(icons.SEASON_ICONS[icons.seasonIconFor(slug)], slug);
  assert.equal(icons.seasonIconFor('constructor'), 'cross', 'a slug that names something on every object is not an icon');
});

test('the icons are 24 × 24 drawings in currentColor, with no ids to clash when a page repeats them', () => {
  for (const [key, xml] of Object.entries(icons.SEASON_ICONS)) {
    assert.match(xml, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 24 24"/, key);
    assert.match(xml, /currentColor/, key);
    assert.doesNotMatch(xml, /\bid="/, key);
  }
});
