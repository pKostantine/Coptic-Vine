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

const nextSeason = load('src/utils/nextSeason.ts');
const { computeMovableFeastDates } = load('src/utils/fixedFeasts.ts');
const { scheduleLearningSeasons } = load('src/utils/learningSeasonDates.ts', (name) => (name === './nextSeason' ? nextSeason : require(name)));

const MONTHS = ['Thoout', 'Paope', 'Hathor', 'Kiahk', 'Tobe', 'Meshir', 'Paremhotep', 'Parmoute', 'Pashons', 'Paone', 'Epep', 'Mesore', 'Nesi'];

function addDays(iso, days) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** A Coptic year as the app's calendar (calendar.coptic_date_conversions, calendar.season_ranges) has it. */
function calendarYear(year, startDate, endDate, ranges) {
  const dates = new Map();
  for (let iso = startDate, offset = 0; iso < endDate; iso = addDays(iso, 1), offset += 1) {
    dates.set(iso, { monthName: MONTHS[Math.min(12, Math.floor(offset / 30))], day: (offset % 30) + 1, year });
  }
  const seasons = Object.entries(ranges).map(([rangeKey, [start, end]]) => ({ rangeKey, activeSeason: rangeKey, startDate: start, endDate: end, startEvent: '', endEvent: '' }));
  const byKey = Object.fromEntries(seasons.map((season) => [season.rangeKey, { startDate: season.startDate, endDate: season.endDate }]));
  return { year: { startDate, endDate, seasons, events: computeMovableFeastDates(byKey) }, dates };
}

const Y1743 = calendarYear(1743, '2026-09-11', '2027-09-11', {
  'nativity-fast': ['2026-11-25', '2027-01-06'],
  'jonahs-fast': ['2027-02-22', '2027-02-24'],
  lent: ['2027-03-08', '2027-04-23'],
  'holy-week': ['2027-04-24', '2027-05-01'],
  'holy-50-days': ['2027-05-02', '2027-06-20'],
  'apostles-fast': ['2027-06-21', '2027-07-11'],
  'st-mary-fast': ['2027-08-07', '2027-08-21'],
});
const Y1744 = calendarYear(1744, '2027-09-11', '2028-09-11', {
  'nativity-fast': ['2027-11-26', '2028-01-06'],
  'jonahs-fast': ['2028-02-07', '2028-02-09'],
  lent: ['2028-02-21', '2028-04-07'],
  'holy-week': ['2028-04-08', '2028-04-15'],
  'holy-50-days': ['2028-04-16', '2028-06-04'],
  'apostles-fast': ['2028-06-05', '2028-07-11'],
  'st-mary-fast': ['2028-08-07', '2028-08-21'],
});

// The platform's seasons in their fixed order (learning.seasons).
const SLUGS = [
  'annual-psalmody', 'raising-of-incense', 'liturgy', 'joyful-29', 'nayrouz', 'feast-of-the-cross', 'nativity-fast-kiahk',
  'nativity-paramoun', 'nativity', 'circumcision', 'theophany-paramoun', 'theophany', 'wedding-at-cana', 'entry-into-temple',
  'annunciation', 'jonahs-fast', 'lent', 'lazarus-saturday', 'palm-sunday', 'holy-week', 'resurrection', 'thomas-sunday',
  'ascension', 'pentecost', 'entry-into-egypt', 'apostles-fast-and-feast', 'st-mary-fast-and-feast', 'transfiguration', 'other',
];

const on = (iso) => (iso < '2027-09-11' ? scheduleLearningSeasons(SLUGS, iso, Y1743, Y1744) : scheduleLearningSeasons(SLUGS, iso, Y1744, null));
const next = (schedule, slug) => {
  const timing = schedule.timings.get(slug);
  return timing.next && `${timing.next.coptic.monthName} ${timing.next.coptic.day} in ${timing.next.days}`;
};

test('outside every season, Now is the three annual sets, and the next two dated seasons come up', () => {
  // Thoout 20, 1743: the design's first example.
  const schedule = on('2026-09-30');
  assert.deepEqual(schedule.now, ['annual-psalmody', 'raising-of-incense', 'liturgy']);
  assert.deepEqual(schedule.comingUp, ['nativity-fast-kiahk', 'nativity-paramoun']);
  assert.equal(schedule.timings.get('liturgy').now, true);
  assert.equal(schedule.timings.get('liturgy').next, null, 'the annual sets are never dated');
});

test('dated seasons count down to their Coptic start, rolling into next year', () => {
  const schedule = on('2026-09-30');
  // The design's day counts from Thoout 20.
  assert.equal(next(schedule, 'nativity-fast-kiahk'), 'Hathor 16 in 56');
  assert.equal(next(schedule, 'nativity'), 'Kiahk 29 in 99');
  assert.equal(next(schedule, 'theophany'), 'Tobe 11 in 111');
  assert.equal(next(schedule, 'jonahs-fast'), 'Meshir 15 in 145');
  assert.equal(next(schedule, 'lent'), 'Meshir 29 in 159');
  assert.equal(next(schedule, 'palm-sunday'), 'Parmoute 17 in 207');
  assert.equal(next(schedule, 'holy-week'), 'Parmoute 18 in 208', 'Holy Week counts from the Monday after Palm Sunday');
  assert.equal(next(schedule, 'resurrection'), 'Parmoute 24 in 214');
  assert.equal(next(schedule, 'apostles-fast-and-feast'), 'Paone 14 in 264');
  assert.equal(next(schedule, 'st-mary-fast-and-feast'), 'Mesore 1 in 311');
  // Past for this year: next year's.
  assert.equal(next(schedule, 'nayrouz'), 'Thoout 1 in 346');
  assert.equal(next(schedule, 'feast-of-the-cross'), 'Thoout 17 in 362');
  assert.equal(schedule.timings.get('other').next, null);
});

test('the Joyful 29th shows its next 29th, skipping the months it is not kept', () => {
  assert.equal(next(on('2026-09-30'), 'joyful-29'), 'Thoout 29 in 9');
  // After Hathor 29 the next is Paone 29, from the Apostles' Fast on: none from Kiahk to Pashons.
  assert.equal(next(on('2026-12-09'), 'joyful-29'), 'Paone 29 in 209');
  assert.equal(on('2026-12-08').timings.get('joyful-29').now, true, 'Hathor 29, 1743 is kept: Kiahk has its four Sundays');
  assert.ok(!on('2026-10-08').comingUp.includes('joyful-29'), 'it never counts as coming up');
});

test('a season holding the day is Now, the most particular first', () => {
  // Kiahk 5: the fast, then the Paramoun and the Nativity to come.
  const kiahk = on('2026-12-14');
  assert.deepEqual(kiahk.now, ['nativity-fast-kiahk']);
  assert.deepEqual(kiahk.comingUp, ['nativity-paramoun', 'nativity']);
  assert.equal(next(kiahk, 'nativity'), 'Kiahk 29 in 24');
  // Hathor 29 inside the fast: the feast of the day before the fast around it.
  assert.deepEqual(on('2026-12-08').now, ['joyful-29', 'nativity-fast-kiahk']);
  // Parmoute 20: Holy Week, the Resurrection four days off.
  const holyWeek = on('2027-04-28');
  assert.deepEqual(holyWeek.now, ['holy-week']);
  assert.equal(next(holyWeek, 'resurrection'), 'Parmoute 24 in 4');
  // Tobe 13: Cana, inside the Theophany's days.
  assert.deepEqual(on('2027-01-21').now, ['wedding-at-cana', 'theophany']);
  // The days after the Ascension keep its praises inside the Fifty Days.
  assert.deepEqual(on('2027-06-12').now, ['ascension', 'resurrection']);
});

test('the Paramoun reaches back to Friday when the feast falls on a Sunday or Monday', () => {
  // Nativity, Kiahk 29, 1743 is Thursday 7 January 2027: its Paramoun is Kiahk 28 alone.
  assert.equal(next(on('2026-12-14'), 'nativity-paramoun'), 'Kiahk 28 in 23');
  // The same year begun three days later puts Kiahk 29 on a Sunday, four days later on a Monday.
  const sunday = calendarYear(1743, '2026-09-14', '2027-09-14', {});
  assert.equal(next(scheduleLearningSeasons(SLUGS, '2026-12-20', sunday, null), 'nativity-paramoun'), 'Kiahk 27 in 19');
  const monday = calendarYear(1743, '2026-09-15', '2027-09-15', {});
  assert.equal(next(scheduleLearningSeasons(SLUGS, '2026-12-20', monday, null), 'nativity-paramoun'), 'Kiahk 26 in 19');
});

test('a calendar missing a season leaves it undated rather than failing', () => {
  const bare = calendarYear(1743, '2026-09-11', '2027-09-11', {});
  const schedule = scheduleLearningSeasons(SLUGS, '2026-09-30', bare, null);
  assert.equal(schedule.timings.get('lent').next, null);
  assert.equal(next(schedule, 'nativity'), 'Kiahk 29 in 99', 'fixed feasts still come from the Coptic dates');
  assert.deepEqual(schedule.now, ['annual-psalmody', 'raising-of-incense', 'liturgy']);
});
