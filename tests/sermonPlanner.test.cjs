const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');

/** A TypeScript module, its imports given by `stubs` (else required). */
function load(path, stubs = {}) {
  const js = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('exports', 'require', 'module', js)(module.exports, (name) => (name in stubs ? stubs[name] : require(name)), module);
  return module.exports;
}

const types = load('src/types/sermonPlanner.ts');
const highlightGroups = load('src/utils/highlightGroups.ts');
const planner = load('src/utils/sermonPlanner.ts', { '@/types/sermonPlanner': types, '@/utils/highlightGroups': highlightGroups });
const READING_LABELS = {
  Psalm: { english: 'Psalm', arabic: 'المزمور' },
  Gospel: { english: 'Gospel', arabic: 'الإنجيل' },
  Prophecy: { english: 'Prophecy', arabic: 'النبوة', french: 'Prophétie' },
  Pauline: { english: 'Pauline', arabic: 'البولس' },
  Catholic: { english: 'Catholic', arabic: 'الكاثوليكون' },
  Praxis: { english: 'Acts', arabic: 'الإبركسيس' },
};
const readingsUtil = load('src/utils/sermonReadings.ts', { './lectionaryOutline': { READING_LABELS } });

const hymnLibrarySource = fs.readFileSync('src/utils/hymnLibrary.js', 'utf8');
const manifestSource = fs.readFileSync('src/constants/manifest.ts', 'utf8');
const preferencesSource = fs.readFileSync('src/utils/preferencesStorage.ts', 'utf8');

function extractFunction(startMarker, endMarker) {
  const start = hymnLibrarySource.indexOf(startMarker);
  const end = hymnLibrarySource.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, 'Sermon Planner test harness could not find the hydrator');
  return hymnLibrarySource.slice(start, end).replace(/^export /, '');
}

function loadHydrateService(getContextFlags, hydrateWithFlags, paschaGospelAuthorFlags = async () => ({})) {
  const definition = extractFunction(
    'export async function hydrateSupabaseServiceHymn(',
    '\n// A single misconfigured',
  );
  return new Function(
    'deriveStructuralFlags', 'getContextFlags', 'toIsoDateString', 'hydrateWithFlags', 'paschaGospelAuthorFlags',
    definition + '\nreturn hydrateSupabaseServiceHymn;',
  )(
    () => ({}),
    getContextFlags,
    (date) => date.toISOString().slice(0, 10),
    hydrateWithFlags,
    paschaGospelAuthorFlags,
  );
}

test('Sermon Planner scopes Gospel/weekday/service conditions to each reading', async () => {
  const date = new Date('2026-09-20T00:00:00Z');
  const vespersWeekday = new Date('2026-09-19T00:00:00Z');
  const calls = [];
  let hydrated;
  const getContextFlags = async (_date, extraContext, weekdayDate) => {
    calls.push({ extraContext, weekdayDate });
    const author = extraContext.Vespers ? 'Vespers'
      : extraContext.Matins ? 'Matins' : 'Liturgy';
    return { ...extraContext, author };
  };
  const hydrateWithFlags = async (schema, table, flags, depth, isoDate, flagsForSection) => {
    hydrated = { schema, table, flags, depth, isoDate, flagsForSection };
    return ['rendered'];
  };
  const hydrate = loadHydrateService(getContextFlags, hydrateWithFlags);
  const result = await hydrate('liturgy', 'sermon_planner', date, {
    BishopPresent: true, PaulineEpistleRomans: true,
  }, vespersWeekday);

  assert.deepEqual(result, ['rendered']);
  assert.equal(calls.length, 3);
  assert.deepEqual(calls.map(({ extraContext }) => [
    extraContext.Vespers === true, extraContext.Matins === true, extraContext.Liturgy === true,
  ]), [[true, false, false], [false, true, false], [false, false, true]]);
  assert.equal(calls[0].weekdayDate, vespersWeekday);
  assert.equal(calls[1].weekdayDate, undefined);
  assert.equal(calls[2].weekdayDate, undefined);
  assert.ok(calls.every(({ extraContext }) => extraContext.PaulineEpistleRomans));
  assert.equal(hydrated.isoDate, '2026-09-20');
  assert.deepEqual(
    ['Vespers', 'Matins', 'Liturgy', null].map((condition) =>
      hydrated.flagsForSection({ condition }).author,
    ),
    ['Vespers', 'Matins', 'Liturgy', 'Liturgy'],
  );
});

test('Unrelated Lectionary services retain the ordinary one-context hydrator', async () => {
  const calls = [];
  let received;
  const hydrate = loadHydrateService(
    async (_date, flags, weekdayDate) => {
      calls.push({ flags, weekdayDate });
      return flags;
    },
    async (...args) => { received = args; return ['normal']; },
  );
  const result = await hydrate('liturgy', 'lectionary_matins', new Date('2026-09-20T00:00:00Z'), { Matins: true });
  assert.deepEqual(result, ['normal']);
  assert.equal(calls.length, 1);
  assert.equal(received.length, 5);
  assert.equal(received[2].Matins, true);
});

test('A Holy Week hour reads its own evangelist, not the calendar Matins one', async () => {
  let received;
  const hydrate = loadHydrateService(
    async (_date, flags) => ({ ...flags, GospelMark: true }),
    async (...args) => { received = args; return ['hour']; },
    async (flags) => (flags.PaschaDayHour ? { GospelMatthew: false, GospelMark: false, GospelLuke: true, GospelJohn: false } : {}),
  );
  await hydrate('holy_week', 'thursday_first_hour', new Date('2027-04-29T00:00:00Z'), { Matins: true, PaschaDayHour: true });
  assert.equal(received[2].GospelLuke, true);
  assert.equal(received[2].GospelMark, false);
});

function loadLookupSchemas(installedSchemas) {
  const definition = extractFunction('async function getHymnKeyLookupSchemas(', '\nexport async function fetchServiceRows(');
  return new Function(
    'HYMN_KEY_FALLBACK_SCHEMAS',
    'isContentSchemaInstalled',
    definition + '\nreturn getHymnKeyLookupSchemas;',
  )(['public', 'liturgy', 'psalmody'], async (schema) => installedSchemas.includes(schema));
}

test('Only Sermon Planner includes the Gospel Rite in hymn-key fallback lookups', async () => {
  const getLookups = loadLookupSchemas([]);
  assert.ok((await getLookups('liturgy', 'sermon_planner')).includes('gospel_rite'));
  assert.ok(!(await getLookups('liturgy', 'lectionary_liturgy')).includes('gospel_rite'));
  assert.equal((await getLookups('liturgy', 'sermon_planner'))[0], 'liturgy');
});

test('An installed book searches only the fallback schemas installed with it', async () => {
  const getLookups = loadLookupSchemas(['agpeya', 'public']);
  assert.deepEqual(await getLookups('agpeya', 'first_hour'), ['agpeya', 'public']);
  // A document read online keeps the full fallback order.
  assert.deepEqual(await getLookups('holy_week', 'good_friday'), ['holy_week', 'public', 'liturgy', 'psalmody']);
});

test('Liturgy Gospel with Coptic uses the normalized all-caps sentinel', () => {
  assert.match(hymnLibrarySource, /"LITURGY_GOSPEL_WITH_COPTIC"/);
  assert.doesNotMatch(hymnLibrarySource, /"Liturgy_GOSPEL_WITH_COPTIC"/);
});

test('Both Liturgy Gospel variants resolve canonical all-caps and legacy mixed-case keys', () => {
  const start = hymnLibrarySource.indexOf('export const READING_SENTINELS');
  const end = hymnLibrarySource.indexOf('\nlet readingsForDateCache', start);
  assert.ok(start >= 0 && end > start);
  const definition = hymnLibrarySource.slice(start, end).replace('export const', 'const');
  const { isReadingSentinel, normalizeReadingSentinel, readingMap } = new Function(
    `${definition}\nreturn { isReadingSentinel, normalizeReadingSentinel, readingMap: READING_SENTINEL_MAP };`,
  )();

  assert.equal(isReadingSentinel('LITURGY_GOSPEL_WITH_COPTIC'), true);
  assert.equal(isReadingSentinel('LITURGY_GOSPEL_WITHOUT_COPTIC'), true);
  assert.equal(isReadingSentinel('Liturgy_GOSPEL_WITHOUT_COPTIC'), true);
  assert.equal(normalizeReadingSentinel('Liturgy_GOSPEL_WITHOUT_COPTIC'), 'LITURGY_GOSPEL_WITHOUT_COPTIC');
  assert.deepEqual(readingMap.LITURGY_GOSPEL_WITHOUT_COPTIC, {
    service: 'Liturgy', readingType: 'Gospel', withCoptic: false,
  });
  assert.match(hymnLibrarySource, /READING_SENTINEL_MAP\[normalizeReadingSentinel\(sentinel\)\]/);
  assert.match(hymnLibrarySource, /if \(isReadingSentinel\(section\.hymn_key\) && isoDate\)/);
});

test('Inline Synaxarium and regular inline Gospel hymns are both supported', () => {
  assert.match(hymnLibrarySource, /section\.hymn_key === "SYNAXARIUM" && isoDate/);
  assert.match(hymnLibrarySource, /buildWholeTableInlineSections\(synaxariumSections, section\)/);
  assert.match(hymnLibrarySource, /if \(!section\.verses\.length\) continue;/);
  assert.match(hymnLibrarySource, /sectionFlagsForRow \? sectionFlagsForRow\(section\) : documentFlags/);
});

test('Sermon Planner omits only the Synaxarium date and priest introduction', () => {
  const definition = extractFunction(
    'function omitSynaxariumPreamble(',
    '\n/** Same as resolveReadingSentinelVerses',
  );
  const omitPreamble = new Function(definition + '\nreturn omitSynaxariumPreamble;')();
  const sections = [
    { id: 'synaxarium-date-2026-09-23', title: 'Thoout 13, 1743' },
    { id: 'synaxarium-intro', verses: ['Priest introduction'] },
    { id: 'commemoration-1', verses: ['First saint'] },
    { id: 'commemoration-2', verses: ['Second saint'] },
  ];

  assert.deepEqual(omitPreamble(sections), sections.slice(2));
  assert.equal(sections.length, 4, 'Shared Synaxarium sections must not be mutated');
  assert.match(
    hymnLibrarySource,
    /if \(section\.hymn_key === "SYNAXARIUM" && isoDate\) \{\s*const synaxariumSections = omitSynaxariumPreamble\(await resolveSynaxariumSections\(isoDate\)\)/,
  );
  assert.match(
    hymnLibrarySource,
    /const synaxariumSections = await resolveSynaxariumSections\(isoDate\);\s*const label = section\.title/,
    'The standard Lectionary Synaxarium must retain the date and introduction',
  );
});


test('Sermon selection snaps across complete English, Arabic and Coptic words', () => {
  const html = fs.readFileSync('src/components/vine/textHighlights.ts', 'utf8');
  const start = html.indexOf('function expandToWholeWords(text, start, end)');
  const end = html.indexOf('function anchorsFromSelection(selection)', start);
  assert.ok(start >= 0 && end > start);
  // This helper is embedded in a TS template string; unescape its regex
  // before running the same JavaScript in isolation.
  const definition = html.slice(start, end).replaceAll('\\\\p', '\\p');
  const expand = new Function(definition + '\nreturn expandToWholeWords;')();
  const cases = [
    ['Let your light shine', 1, 2, 'Let'],
    ['We cannot serve', 4, 6, 'cannot'],
    ['باسم الآب', 1, 3, 'باسم'],
    ['Ⲡⲓⲱⲟⲩ', 1, 3, 'Ⲡⲓⲱⲟⲩ'],
  ];
  for (const [text, first, last, expected] of cases) {
    const range = expand(text, first, last);
    assert.equal(text.slice(range.start, range.end), expected, text);
  }
  const withoutSegmenter = new Function('Intl', definition + '\nreturn expandToWholeWords;')({});
  const fallback = withoutSegmenter('باسم الآب', 1, 3);
  assert.equal('باسم الآب'.slice(fallback.start, fallback.end), 'باسم');
});

test('Web documents and Bible never attach app swipe-exit gestures', () => {
  const html = fs.readFileSync('src/components/vine/documentHtml.ts', 'utf8');
  const nativeView = fs.readFileSync('src/components/vine/DocumentWebView.tsx', 'utf8');
  const service = fs.readFileSync('src/components/vine/screens/ServiceDocument.tsx', 'utf8');
  const modal = fs.readFileSync('src/components/vine/screens/DocumentModal.tsx', 'utf8');
  const bible = fs.readFileSync('src/app/bible/[bookKey]/[chapter].tsx', 'utf8');
  const bibleHtml = fs.readFileSync('src/components/vine/bibleDocumentHtml.ts', 'utf8');
  assert.match(html, /if \(!\$\{JSON\.stringify\(nativeSwipeNavigation\)\}\) return;/);
  assert.match(nativeView, /nativeSwipeNavigation: true/);
  assert.match(service, /isMobileDocument \? readerSwipes\.panHandlers/);
  assert.match(modal, /isMobileDocument \? readerSwipes\.panHandlers/);
  assert.doesNotMatch(modal, /pointerup', onUp/);
  assert.match(bible, /Platform\.OS !== 'web' \? gesturePanResponder\.panHandlers/);
  assert.match(bibleHtml, /nativeSwipeNavigation/);
  assert.match(bible, /isStylusGestureEvent\(event\)/);
});

// ─── The redesigned planner (Claude Design, "Sermon Planner") ────────────────

const OLD = '2026-09-23T10:00:00.000Z';
const NEW = '2026-09-23T11:00:00.000Z';
const highlight = (id, extra = {}) => ({
  id, sectionId: 'gospel', verseId: 'gospel::v1', language: 'english', startOffset: 0, endOffset: 4,
  quote: 'Word', color: 'gold', note: '', createdAt: OLD, updatedAt: OLD, ...extra,
});

test('The Plans page and a plan are routes of their own, beside the sidebar', () => {
  assert.ok(fs.existsSync('src/app/lectionary/sermon_planner/index.tsx'));
  assert.ok(fs.existsSync('src/app/lectionary/sermon_planner/[planId].tsx'));
  assert.match(manifestSource, /id: 'sermon_planner', schema: 'liturgy', table: 'sermon_planner'/);
  // The reader no longer opens it.
  const service = fs.readFileSync('src/components/vine/screens/ServiceDocument.tsx', 'utf8');
  assert.doesNotMatch(service, /sermon/i);
  assert.ok(!fs.existsSync('src/components/vine/ui/SermonPlannerDrawer.tsx'));
  const chrome = fs.readFileSync('src/utils/desktopChrome.ts', 'utf8');
  assert.match(chrome, /if \(segments\[0\] === 'lectionary' && segments\[1\] === 'sermon_planner'\) return false;/);
  // Its readings are the planner's own document, read for the plan's day.
  const readings = fs.readFileSync('src/hooks/useSermonReadings.ts', 'utf8');
  assert.match(readings, /hydrateSupabaseServiceHymn\(\s*'liturgy',\s*'sermon_planner',/);
});

test('A day can hold several plans; a day\'s one plan from before keeps its row', () => {
  const id = planner.newSermonPlanId();
  assert.match(id, /^p[0-9a-z]+$/);
  assert.equal(planner.sermonPlanDocumentKey(id), `sermon-plan:${id}`);
  assert.equal(planner.sermonPlanIdFor(`sermon-plan:${id}`, '2027-04-07'), id);
  assert.equal(planner.sermonPlanIdFor('liturgy.sermon_planner', '2027-04-07'), 'day-2027-04-07');
  assert.equal(planner.sermonPlanDocumentKey('day-2027-04-07'), 'liturgy.sermon_planner');
  assert.equal(planner.sermonPlanIdFor('liturgy.lectionary_liturgy', '2027-04-07'), null);
});

test('A plan from before opens with its notes as the Opening and its highlights to place', () => {
  const plan = planner.normalizeSermonPlan({
    version: 1, documentKey: 'liturgy.sermon_planner', serviceDate: '2027-04-07',
    generalNotes: 'Begin from the Vespers psalm.', highlights: [highlight('a')], highlightDeletions: {}, updatedAt: OLD,
  }, 'day-2027-04-07', '2027-04-07');
  assert.equal(plan.version, 2);
  assert.deepEqual(plan.parts.map((part) => part.kind), ['opening', 'point', 'point', 'point', 'application', 'closing']);
  assert.equal(plan.parts[0].body, 'Begin from the Vespers psalm.');
  assert.equal(planner.unplacedHighlightGroups(plan).length, 1);
  assert.equal(planner.sermonPlanState(plan), 'draft');
});

test('A plan\'s outline rides in its row\'s notes, and comes back whole', () => {
  const plan = {
    ...planner.emptySermonPlan('p1', '2027-04-07', 'Feast of the Annunciation'),
    bigIdea: 'God bows the heavens and comes down.',
    status: 'ready',
    highlights: [highlight('g~0', { groupId: 'g', color: 'purple' })],
    createdAt: OLD,
    updatedAt: NEW,
  };
  plan.parts[2] = { ...plan.parts[2], title: 'How shall this be?', body: 'Mary asks.', highlightIds: ['g'] };
  const notes = planner.encodeSermonPlanNotes(plan);
  assert.equal(JSON.parse(notes).sermonPlan, 2);
  const back = planner.sermonPlanFromRow({
    document_key: 'sermon-plan:p1', service_date: '2027-04-07', general_notes: notes,
    highlights: plan.highlights, highlight_deletions: {}, updated_at: NEW,
  });
  assert.equal(back.id, 'p1');
  assert.equal(back.title, 'Feast of the Annunciation');
  assert.equal(back.bigIdea, plan.bigIdea);
  assert.equal(back.status, 'ready');
  assert.deepEqual(back.parts, plan.parts);
  assert.equal(planner.unplacedHighlightGroups(back).length, 0);
  // Plain notes are a day's notes from before; a row that isn't a plan's is none.
  assert.deepEqual(planner.decodeSermonPlanNotes('{ a brace, then words'), { generalNotes: '{ a brace, then words' });
  assert.equal(planner.sermonPlanFromRow({ document_key: 'other', service_date: '2027-04-07', general_notes: '', highlights: [], highlight_deletions: {}, updated_at: NEW }), null);
});

test('Two copies merge: the newer outline, every highlight, and a removal over an older copy', () => {
  const base = planner.emptySermonPlan('p1', '2027-04-07');
  const local = { ...base, bigIdea: 'Newer', highlights: [highlight('keep')], highlightDeletions: { gone: NEW }, updatedAt: NEW, createdAt: OLD };
  const cloud = { ...base, bigIdea: 'Older', highlights: [highlight('gone'), highlight('other')], highlightDeletions: {}, updatedAt: OLD, createdAt: OLD };
  const merged = planner.mergeSermonPlans(local, cloud);
  assert.equal(merged.bigIdea, 'Newer');
  assert.deepEqual(merged.highlights.map((entry) => entry.id).sort(), ['keep', 'other']);
  assert.equal(merged.highlightDeletions.gone, NEW);
});

test('A plan says how far along it is and about how long it will take', () => {
  const plan = planner.emptySermonPlan('p1', '2027-04-07');
  assert.equal(planner.sermonPlanState(plan), 'notStarted');
  const written = { ...plan, parts: plan.parts.map((part, index) => (index < 4 ? { ...part, body: 'word '.repeat(65).trim() } : part)) };
  assert.equal(planner.sermonPlanState(written), 'draft');
  const summary = planner.summarizeSermonPlan(written);
  assert.equal(summary.writtenParts, 4);
  assert.equal(summary.totalParts, 6);
  // Two minutes a part, and 260 words at 130 a minute.
  assert.equal(planner.estimatedSermonMinutes(written), 14);
  assert.equal(planner.sermonPlanState({ ...written, status: 'preached' }), 'preached');
  assert.equal(planner.sermonPointNumber(plan.parts, plan.parts[2].id), 2);
  assert.equal(planner.sermonPointNumber(plan.parts, plan.parts[0].id), null);
});

test('A highlight that takes in placed ones takes their places in the outline', () => {
  const parts = [
    { id: 'a', kind: 'point', title: '', body: '', highlightIds: ['old1', 'x'] },
    { id: 'b', kind: 'point', title: '', body: '', highlightIds: ['old2'] },
    { id: 'c', kind: 'point', title: '', body: '', highlightIds: ['y'] },
  ];
  const next = planner.partsWithReplacedHighlights(parts, ['old1', 'old2'], 'new');
  assert.deepEqual(next.map((part) => part.highlightIds), [['new', 'x'], ['new'], ['y']]);
  assert.deepEqual(planner.groupIdsOfSegments([highlight('g~0', { groupId: 'g' }), highlight('h')], ['g~0', 'h']).sort(), ['g', 'h']);
});

test('A chip names its verse short', () => {
  assert.equal(planner.abbreviateReference('Luke 1:35'), 'Lk 1:35');
  assert.equal(planner.abbreviateReference('Psalm 143:5'), 'Ps 143:5');
  assert.equal(planner.abbreviateReference('1 John 2:3'), '1 Jn 2:3');
  assert.equal(planner.abbreviateReference('John 3:16'), 'Jn 3:16');
  assert.equal(planner.abbreviateReference('Synaxarium'), 'Synaxarium');
});

test('The planner\'s document is its readings: each from its citation, the Synaxarium the Liturgy\'s', () => {
  const cites = (id, service, readingType, english) => ({
    id, title: { english: '' }, verses: [{ type: 'readingReference', english, arabic: '', reading: { service, readingType } }, { type: 'text', english: 'v' }],
  });
  const groups = readingsUtil.groupSermonReadings([
    cites('vp', 'Vespers', 'Psalm', 'Psalm 92:1'),
    cites('vg', 'Vespers', 'Gospel', 'Mark 1:1'),
    cites('p1', 'Matins', 'Prophecy', 'Isaiah 1:1'),
    cites('p2', null, 'Prophecy', 'Isaiah 2:1'),
    cites('mg', 'Matins', 'Gospel', 'Luke 1:1'),
    cites('pa', 'Pauline', 'Pauline Epistle', 'Hebrews 2:11'),
    { id: 'pa-cont1', title: { english: '' }, verses: [{ type: 'text', english: 'more' }] },
    { id: 'syn1', sourceGroupKey: 'SYNAXARIUM', title: { english: '' }, verses: [{ type: 'text', english: 'a saint' }] },
    { id: 'syn2', sourceGroupKey: 'SYNAXARIUM', title: { english: '' }, verses: [{ type: 'text', english: 'another' }] },
    cites('lg', 'Liturgy', 'Gospel', 'Luke 1:26'),
  ]);
  assert.deepEqual(groups.Vespers.map((reading) => reading.kind), ['Psalm', 'Gospel']);
  assert.deepEqual(groups.Matins.map((reading) => reading.label.english), ['Prophecy 1', 'Prophecy 2', 'Gospel']);
  assert.deepEqual(groups.Liturgy.map((reading) => reading.kind), ['Pauline', 'Synaxarium', 'Gospel']);
  assert.deepEqual(groups.Liturgy[0].sections.map((section) => section.id), ['pa', 'pa-cont1']);
  assert.deepEqual(groups.Liturgy[1].sections.map((section) => section.id), ['syn1', 'syn2']);
  assert.equal(groups.Liturgy[2].citation.english, 'Luke 1:26');
});

test('The toolbar names the five colours and adds a highlight straight to a part', () => {
  const layer = fs.readFileSync('src/components/vine/textHighlights.ts', 'utf8');
  assert.match(layer, /window\.setHighlightPlaceLabel = function \(label\)/);
  assert.match(layer, /if \(PALETTE_LABELS\) palette\.classList\.add\('is-labelled'\);/);
  // A selection elsewhere is a new highlight, not the open one resized.
  assert.match(layer, /var touchesGroup = groupMarks\(editing\.groupId\)\.some/);
  const page = fs.readFileSync('src/components/vine/documentHtml.ts', 'utf8');
  assert.match(page, /place: 'placeSermonHighlight',/);
  assert.match(page, /\.verse-row\[data-planner-citation\] \{ display: none; \}/);
  const labels = load('src/constants/sermonPlanner.ts', { '@/types/sermonPlanner': types }).sermonHighlightPalette(false);
  assert.deepEqual(Object.values(labels).map((entry) => entry.label), ['Key verse', 'Illustration', 'Cross-ref', 'Application', 'Question']);
});

// ─── The week, and carrying a sermon over ───────────────────────────────────

const summary = (id, serviceDate, state, extra = {}) => ({
  id, documentKey: `sermon-plan:${id}`, serviceDate, title: '', state, writtenParts: 0, totalParts: 6,
  preachedSeconds: null, highlightCount: 0, updatedAt: OLD, ...extra,
});

test('The list shows today until a week from today; earlier and later only what was started', () => {
  const { week, later, earlier } = planner.sermonPlanGroups([
    summary('old-empty', '2026-03-29', 'notStarted'),
    summary('far-empty', '2027-04-07', 'notStarted'),
    summary('palm', '2026-04-05', 'preached'),
    summary('draft-past', '2026-10-01', 'draft'),
    summary('sunday', '2026-11-08', 'draft'),
    summary('today-empty', '2026-11-05', 'notStarted'),
    summary('advent', '2026-12-20', 'ready'),
  ], '2026-11-05');
  assert.deepEqual(week.map((day) => day.isoDate), ['2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12']);
  assert.deepEqual(week[3].plans.map((plan) => plan.id), ['sunday']);
  assert.equal(week[0].plans.length, 0);
  assert.equal(week[0].untouched.id, 'today-empty', 'a day\'s untouched plan is the one it opens');
  assert.deepEqual(later.map((plan) => plan.id), ['advent']);
  assert.deepEqual(earlier.map((plan) => plan.id), ['draft-past', 'palm']);
});

/** A calendar for the carry over: Coptic dates counted from Thoout 1 on 11 September (12 September before a leap year). */
function fakeCalendar({ fixed = [] } = {}) {
  const DAY = 86400000;
  const newYear = (copticYear) => {
    const gregorian = copticYear + 283;
    return Date.UTC(gregorian, 8, (gregorian + 1) % 4 === 0 ? 12 : 11);
  };
  const copticYearOf = (time) => {
    let year = new Date(time).getUTCFullYear() - 283;
    while (newYear(year + 1) <= time) year += 1;
    while (newYear(year) > time) year -= 1;
    return year;
  };
  const dateOf = (isoDate) => {
    const time = Date.parse(`${isoDate}T00:00:00Z`);
    const year = copticYearOf(time);
    const index = Math.round((time - newYear(year)) / DAY);
    return { year, month: Math.floor(index / 30) + 1, day: (index % 30) + 1 };
  };
  return {
    copticDate: async (isoDate) => dateOf(isoDate),
    copticMonth: async (year, month) => {
      const days = month === 13 ? Math.round((newYear(year + 1) - newYear(year)) / DAY) - 360 : 30;
      return Array.from({ length: days }, (_, index) => {
        const time = newYear(year) + ((month - 1) * 30 + index) * DAY;
        return { isoDate: new Date(time).toISOString().slice(0, 10), day: index + 1, sunday: new Date(time).getUTCDay() === 0 };
      });
    },
    fixedFeast: async (isoDate) => fixed.includes(isoDate),
  };
}

const carryOver = load('src/utils/sermonCarryOver.ts', {
  './highlightGroups': highlightGroups,
  './holyWeekDates': load('src/utils/holyWeekDates.ts', { './dateUtils': {} }),
  './sermonPlanner': planner,
});

test('A carry over offers the same day a year on, as the readings count it', async () => {
  const calendar = fakeCalendar({ fixed: ['2027-04-07'] });
  // Palm Sunday to Palm Sunday, by Pascha.
  assert.equal(await carryOver.equivalentDayNextYear('2026-04-05', calendar), '2027-04-25');
  // A weekday keeps its Coptic date: Hathor 3.
  const weekday = await calendar.copticDate('2026-11-12');
  const next = await carryOver.equivalentDayNextYear('2026-11-12', calendar);
  assert.deepEqual(await calendar.copticDate(next), { ...weekday, year: weekday.year + 1 });
  // A Sunday outside Pascha's season is the same Sunday of its Coptic month.
  const sunday = '2026-11-08';
  const nextSunday = await carryOver.equivalentDayNextYear(sunday, calendar);
  assert.equal(new Date(`${nextSunday}T00:00:00Z`).getUTCDay(), 0);
  assert.equal((await calendar.copticDate(nextSunday)).month, (await calendar.copticDate(sunday)).month);
  // A feast on its Coptic date in Lent keeps that date (the Annunciation).
  const annunciation = await carryOver.equivalentDayNextYear('2027-04-07', calendar);
  assert.deepEqual((await calendar.copticDate(annunciation)).day, (await calendar.copticDate('2027-04-07')).day);
  // One already past goes on to the first that isn't.
  assert.equal(await carryOver.carryOverDay('2025-04-13', '2026-11-06', calendar), '2027-04-25');
});

test('A plan carried over keeps its outline and finds its highlights again in that day\'s readings', () => {
  const source = {
    ...planner.emptySermonPlan('palm', '2026-04-05', 'Feast of Palm Sunday'),
    bigIdea: 'The King comes humbly.',
    status: 'preached',
    preachedSeconds: 900,
    highlights: [
      highlight('a~0', { groupId: 'a', sectionId: 'g', verseId: 'g::v1', quote: 'Hosanna', note: 'Begin here' }),
      highlight('b~0', { groupId: 'b', sectionId: 'g', verseId: 'g::v2', quote: 'the colt' }),
      highlight('c~0', { groupId: 'c', sectionId: 'p', verseId: 'p::v1', quote: 'not read this year' }),
    ],
  };
  source.parts[1] = { ...source.parts[1], body: 'The crowd.', highlightIds: ['a', 'c'] };
  const sections = [
    { id: 'g2', title: {}, verses: [{ type: 'readingReference', english: 'John 12:12' }, { english: 'They cried Hosanna! Blessed is He', arabic: '' }] },
    { id: 'g', title: {}, verses: [{ english: '' }, { english: 'a verse that changed', arabic: '' }, { english: 'and found the colt there', arabic: '' }] },
  ];
  const { plan, carried, leftBehind } = carryOver.carriedSermonPlan(source, { id: 'p2', isoDate: '2027-04-25', now: NEW }, sections);
  assert.equal(plan.serviceDate, '2027-04-25');
  assert.equal(plan.title, 'Feast of Palm Sunday');
  assert.equal(plan.bigIdea, 'The King comes humbly.');
  assert.equal(plan.status, 'draft');
  assert.equal(plan.preachedSeconds, null);
  assert.equal(carried, 2);
  assert.equal(leftBehind, 1);
  const hosanna = plan.highlights.find((entry) => entry.quote === 'Hosanna');
  assert.equal(hosanna.verseId, 'g2::v1', 'found where the words are read');
  assert.equal(hosanna.startOffset, 'They cried '.length);
  assert.equal(hosanna.note, 'Begin here');
  assert.equal(plan.highlights.find((entry) => entry.quote === 'the colt').verseId, 'g::v2', 'kept in its own verse');
  assert.deepEqual(plan.parts[1].highlightIds, [highlightGroups.highlightGroupId(hosanna)]);
  // Offline, the outline goes alone.
  assert.equal(carryOver.carriedSermonPlan(source, { id: 'p3', isoDate: '2027-04-25', now: NEW }, null).plan.highlights.length, 0);
});

test('The planner\'s readings have no drop caps', () => {
  const page = fs.readFileSync('src/components/vine/documentHtml.ts', 'utf8');
  assert.match(page, /const opens = Boolean\(verse\.dropCap\) && !sermonPlannerMode;/);
});
