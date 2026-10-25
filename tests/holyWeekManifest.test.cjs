const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');

// manifest.ts only imports a type, so a plain transpile is enough to load it.
function loadManifest() {
  const source = fs.readFileSync('src/constants/manifest.ts', 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const module = { exports: {} };
  new Function('module', 'exports', 'require', outputText)(module, module.exports, require);
  return module.exports;
}

const hymnLibrarySource = fs.readFileSync('src/utils/hymnLibrary.js', 'utf8');

/** The pure Pascha reading helpers, lifted out of hymnLibrary.js. */
function loadPaschaHelpers() {
  const start = hymnLibrarySource.indexOf('const PASCHA_READING_SENTINELS');
  const end = hymnLibrarySource.indexOf('const paschaReadingsCache', start);
  assert.ok(start >= 0 && end > start, 'Pascha reading helpers not found');
  return new Function(
    `${hymnLibrarySource.slice(start, end)}\nreturn { paschaHourOf, selectPaschaReadings, paschaHymnKeyForTitle, selectPaschaRiteReading, gospelAuthorFlagsOf };`,
  )();
}

const manifest = loadManifest();
const DAY_TOKENS = ['PalmSunday', 'HolyMonday', 'HolyTuesday', 'HolyWednesday', 'HolyThursday', 'GoodFriday'];
const HOUR_TOKENS = ['FirstHour', 'ThirdHour', 'SixthHour', 'NinthHour', 'EleventhHour', 'TwelfthHour'];

test('Holy Week menu pairs each day with the eve prayed that evening', () => {
  const { HOLY_WEEK_ROWS, SERVICES_BY_CATEGORY } = manifest;
  assert.equal(SERVICES_BY_CATEGORY['holy-week'], undefined);
  assert.deepEqual(HOLY_WEEK_ROWS.map((row) => row.days.map((day) => day.title)), [
    ['Palm Sunday', 'Monday Eve'],
    ['Monday', 'Tuesday Eve'],
    ['Tuesday', 'Wednesday Eve'],
    ['Wednesday', 'Thursday Eve'],
    ['Holy Thursday', 'Friday Eve'],
    ['Good Friday'],
    ['Bright Saturday'],
  ]);
});

test('a day and its eve each open only their own hours', () => {
  const { HOLY_WEEK_DAYS, HOLY_WEEK_HOURS } = manifest;
  const hoursOf = (dayId) => HOLY_WEEK_DAYS.find((day) => day.id === dayId).hours.map((hour) => hour.id);
  assert.deepEqual(hoursOf('palm-sunday'), ['general_funeral_prayer', 'sunday_9th', 'sunday_11th']);
  assert.deepEqual(hoursOf('monday-eve'), ['monday_eve_1st', 'monday_eve_3rd', 'monday_eve_6th', 'monday_eve_9th', 'monday_eve_11th']);
  assert.deepEqual(hoursOf('monday'), ['monday_1st', 'monday_3rd', 'monday_6th', 'monday_9th', 'monday_11th']);
  assert.deepEqual(hoursOf('holy-thursday'), [
    'thursday_1st', 'thursday_3rd', 'thursday_6th', 'thursday_9th', 'liturgy_of_the_waters', 'holy_thursday_liturgy', 'thursday_11th',
  ]);
  assert.deepEqual(hoursOf('good-friday'), ['friday_1st', 'friday_3rd', 'friday_6th', 'friday_9th', 'friday_11th', 'friday_12th']);
  for (const day of HOLY_WEEK_DAYS) {
    const isEve = day.id.endsWith('-eve');
    assert.ok(day.hours.every((hour) => hour.id.includes('_eve_') === isEve), `${day.id} mixes day and eve hours`);
  }
  assert.equal(HOLY_WEEK_HOURS.length, 57);
  assert.equal(new Set(HOLY_WEEK_HOURS.map((hour) => hour.id)).size, HOLY_WEEK_HOURS.length);
});

test('only Holy Thursday keeps "Holy" in its name', () => {
  const { HOLY_WEEK_DAYS } = manifest;
  assert.deepEqual(HOLY_WEEK_DAYS.filter((day) => /holy/i.test(day.title)).map((day) => day.id), ['holy-thursday']);
});

test('Bright Saturday opens straight into its service', () => {
  const { HOLY_WEEK_DAYS, holyWeekDayHref } = manifest;
  assert.equal(holyWeekDayHref(HOLY_WEEK_DAYS.find((day) => day.id === 'bright-saturday')), '/holy-week/bright-saturday/bright_saturday');
  assert.equal(holyWeekDayHref(HOLY_WEEK_DAYS.find((day) => day.id === 'monday')), '/holy-week/monday');
});

test('each Holy Week hour links on to the next one', () => {
  const { HOLY_WEEK_HOURS, HYPERLINK_TARGETS } = manifest;
  HOLY_WEEK_HOURS.forEach((hour, index) => {
    const next = HOLY_WEEK_HOURS[index + 1];
    assert.equal(HYPERLINK_TARGETS[hour.hyperlinkKey].href, `/holy-week/${hour.dayId}/${hour.id}`);
    if (next) assert.equal(hour.nextHyperlinkKey, next.hyperlinkKey);
    else assert.equal(hour.nextHyperlinkKey, undefined);
  });
});

test('the general hours share pascha_hour and differ only in one day, part, and hour token', () => {
  const { HOLY_WEEK_HOURS } = manifest;
  const special = {
    thursday_1st: 'thursday_first_hour',
    friday_6th: 'good_friday_sixth_hour',
    friday_9th: 'good_friday_ninth_hour',
    friday_12th: 'good_friday_twelfth_hour',
  };
  for (const hour of HOLY_WEEK_HOURS.filter((entry) => /_(1st|3rd|6th|9th|11th|12th)$/.test(entry.id))) {
    assert.equal(hour.table, special[hour.id] || 'pascha_hour', hour.id);
    const context = hour.extraContext;
    assert.equal(DAY_TOKENS.filter((token) => context[token] === true).length, 1, hour.id);
    assert.ok(DAY_TOKENS.every((token) => typeof context[token] === 'boolean'), hour.id);
    assert.equal(HOUR_TOKENS.filter((token) => context[token]).length, 1, hour.id);
    assert.equal(Boolean(context.PaschaEveHour), hour.id.includes('_eve_'), hour.id);
    assert.equal(Boolean(context.PaschaDayHour), !hour.id.includes('_eve_'), hour.id);
  }
  // An eve counts as the day it leads into.
  assert.equal(HOLY_WEEK_HOURS.find((hour) => hour.id === 'monday_eve_1st').extraContext.HolyMonday, true);
  assert.equal(HOLY_WEEK_HOURS.find((hour) => hour.id === 'friday_eve_11th').extraContext.GoodFriday, true);
});

test('each hour resolves to the reading_rules hour it is keyed by', () => {
  const { HOLY_WEEK_HOURS } = manifest;
  const { paschaHourOf } = loadPaschaHelpers();
  const byId = (id) => HOLY_WEEK_HOURS.find((hour) => hour.id === id).extraContext;
  assert.deepEqual(paschaHourOf(byId('monday_eve_1st')), { day: 'HolyMonday', part: 'Eve', hour: 1 });
  assert.deepEqual(paschaHourOf(byId('thursday_11th')), { day: 'HolyThursday', part: 'Day', hour: 11 });
  assert.deepEqual(paschaHourOf(byId('friday_12th')), { day: 'GoodFriday', part: 'Day', hour: 12 });
  assert.equal(paschaHourOf(byId('liturgy_of_the_waters')), null);
});

test('Pascha sentinels pick their readings, interpretations following what they explain', () => {
  const { selectPaschaReadings } = loadPaschaHelpers();
  const rows = ['Prophecy', 'Interpretation', 'Prophecy', 'Homily', 'Pauline Epistle', 'Psalm', 'Gospel', 'Interpretation']
    .map((reading_type, index) => ({ reading_type, reading_rule_id: String(index) }));
  const ids = (sentinel) => selectPaschaReadings(sentinel, rows).map((row) => row.reading_rule_id);
  assert.deepEqual(ids('PASCHA_PROPHECIES'), ['0', '1', '2']);
  assert.deepEqual(ids('PASCHA_HOMILIES'), ['3']);
  assert.deepEqual(ids('PASCHA_PAULINE_EPISTLE'), ['4']);
  assert.deepEqual(ids('PASCHA_GOSPEL_INTERPRETATIONS'), ['7']);
  // The Psalm and Gospel are the mournful rites' now, not a sentinel's.
  assert.deepEqual(ids('MOURNFUL_GOSPEL_RITE'), []);
  assert.deepEqual(ids('PASCHA_EXPOSITION'), []);
});

test('the mournful rites read the hour\'s Psalm and its Gospels in order', () => {
  const { selectPaschaRiteReading } = loadPaschaHelpers();
  const rows = [
    { reading_type: 'Prophecy', reading_rule_id: 'prophecy' },
    { reading_type: 'Psalm', reading_rule_id: 'psalm' },
    { reading_type: 'Gospel', reading_rule_id: 'matthew' },
    { reading_type: 'Gospel', reading_rule_id: 'mark' },
    { reading_type: 'Gospel', reading_rule_id: 'luke' },
    { reading_type: 'Gospel', reading_rule_id: 'john' },
    { reading_type: 'Interpretation', reading_rule_id: 'interpretation' },
  ];
  const start = hymnLibrarySource.indexOf('const PASCHA_RITE_READINGS');
  const end = hymnLibrarySource.indexOf('};', start) + 2;
  const readings = new Function(`${hymnLibrarySource.slice(start, end)}\nreturn PASCHA_RITE_READINGS;`)();
  const read = (sentinel) => selectPaschaRiteReading(readings[sentinel], rows)?.reading_rule_id ?? null;
  assert.equal(read('PSALM_WITH_COPTIC'), 'psalm');
  assert.equal(read('PSALM_WITHOUT_COPTIC'), 'psalm');
  assert.equal(read('GOSPEL_WITH_COPTIC'), 'matthew');
  assert.equal(read('FIRST_GOSPEL_WITHOUT_COPTIC'), 'matthew');
  assert.equal(read('SECOND_GOSPEL_WITH_COPTIC'), 'mark');
  assert.equal(read('THIRD_GOSPEL_WITHOUT_COPTIC'), 'luke');
  assert.equal(read('FOURTH_GOSPEL_WITH_COPTIC'), 'john');
  assert.equal(selectPaschaRiteReading(readings.SECOND_GOSPEL_WITH_COPTIC, rows.slice(0, 3)), null);
  for (const [sentinel, mapping] of Object.entries(readings)) {
    assert.equal(mapping.withCoptic, sentinel.endsWith('_WITH_COPTIC'), sentinel);
  }
  // Only the Coptic Psalm and the one Coptic Gospel carry a title; the rest
  // (the English/Arabic readings, the four Coptic Gospels) go by their reference.
  assert.deepEqual(Object.keys(readings).filter((sentinel) => readings[sentinel].ownTitle), ['PSALM_WITH_COPTIC', 'GOSPEL_WITH_COPTIC']);
});

test('a Holy Week reading known by its reference has no title; a titled one names its reading', () => {
  const branch = hymnLibrarySource.slice(
    hymnLibrarySource.indexOf('async function resolveReadingSentinelSplice('),
    hymnLibrarySource.indexOf('return { kind: "flat"'),
  );
  assert.match(branch, /isKnownByReference\(key\)\s+\? \{ english: "", arabic: "" \}\s+: citation && citesReadingInTitle\(key\)/);
  // The four Coptic Gospels' subdocument pills are their references.
  const modalSource = fs.readFileSync('src/components/vine/screens/DocumentModal.tsx', 'utf8');
  assert.match(modalSource, /const COPTIC_READINGS_SUBDOCUMENT_KEYS = new Set\(\[[^\]]*'mournful4CopticGospels'\]\)/);
});

test('an hour\'s evangelist comes from its own Gospels, every other one switched off', () => {
  const { gospelAuthorFlagsOf } = loadPaschaHelpers();
  assert.deepEqual(gospelAuthorFlagsOf([{ reading_type: 'Psalm', book_key: 'psalms' }, { reading_type: 'Gospel', book_key: 'luke' }]), {
    GospelMatthew: false, GospelMark: false, GospelLuke: true, GospelJohn: false,
  });
  assert.deepEqual(gospelAuthorFlagsOf([]), { GospelMatthew: false, GospelMark: false, GospelLuke: false, GospelJohn: false });
});

test('Holy Week hours splice the mournful rites like GOSPEL_RITE, toggle and all', () => {
  assert.match(hymnLibrarySource, /MOURNFUL_GOSPEL_RITE: \{ schema: "gospel_rite", table: "mournful_gospel_rite" \}/);
  assert.match(hymnLibrarySource, /MOURNFUL_4_GOSPELS_RITE: \{ schema: "gospel_rite", table: "mournful_4_gospels_rite" \}/);
  assert.match(hymnLibrarySource, /const GOSPEL_RITE_KEYS = new Set\(\[[^\]]*"MOURNFUL_GOSPEL_RITE", "MOURNFUL_4_GOSPELS_RITE"\]\)/);
  assert.match(hymnLibrarySource, /if \(!GOSPEL_RITE_KEYS\.has\(hymnKey\)\) return null;/);
  assert.match(hymnLibrarySource, /if \(!GOSPEL_RITE_KEYS\.has\(hymnKey\)\) \{\r?\n\s+const sections = await safeHydrateNested/);

  // The rites' reading rows resolve as reading sentinels.
  const start = hymnLibrarySource.indexOf('export const READING_SENTINELS');
  const end = hymnLibrarySource.indexOf('\nlet readingsForDateCache', start);
  const { isReadingSentinel } = new Function(
    `${hymnLibrarySource.slice(start, end).replace('export const', 'const')}\nreturn { isReadingSentinel };`,
  )();
  assert.equal(isReadingSentinel('PSALM_WITH_COPTIC'), true);
  assert.equal(isReadingSentinel('FOURTH_GOSPEL_WITHOUT_COPTIC'), true);
  assert.equal(isReadingSentinel('VESPERS_GOSPEL_WITH_COPTIC'), true);
  assert.equal(isReadingSentinel('FIFTH_GOSPEL_WITH_COPTIC'), false);
});

test('FridayEve1stHour is raised by the Friday Eve 1st hour alone', () => {
  const raising = manifest.HOLY_WEEK_HOURS.filter((hour) => hour.extraContext?.FridayEve1stHour === true);
  assert.deepEqual(raising.map((hour) => hour.id), ['friday_eve_1st']);
  assert.equal(raising[0].table, 'pascha_hour');
  assert.equal(raising[0].extraContext.GoodFriday, true);
  assert.equal(raising[0].extraContext.PaschaEveHour, true);
});

test('homily and interpretation titles name their holy_week hymns', () => {
  const { paschaHymnKeyForTitle } = loadPaschaHelpers();
  assert.equal(paschaHymnKeyForTitle('Homily of Abba Shenouda the Archimandrite'), 'homilyOfAbbaShenoudaTheArchimandrite');
  assert.equal(paschaHymnKeyForTitle('Interpretation – John 13:1-17'), 'interpretationJohn13_1_17');
});

/** currentHolyWeekDayId and its tables, lifted out of utils/holyWeek.ts. */
function loadCurrentDay() {
  const source = fs.readFileSync('src/utils/holyWeek.ts', 'utf8');
  const start = source.indexOf('export const HOLY_WEEK_DAY_IDS');
  const end = source.indexOf('export async function loadHolyWeekSchedule');
  assert.ok(start >= 0 && end > start, 'currentHolyWeekDayId not found');
  const snippet = source.slice(start, end).replace(/export /g, '')
    + '\nfunction dayDifference(from, to) { return Math.round((to.getTime() - from.getTime()) / 86400000); }';
  const { outputText } = ts.transpileModule(snippet, { compilerOptions: { target: ts.ScriptTarget.ES2020 } });
  return new Function(`${outputText}\nreturn { currentHolyWeekDayId, HOLY_WEEK_DAY_IDS };`)();
}

test('the menu marks the day or eve being prayed, rolling to the eve in the evening', () => {
  const { currentHolyWeekDayId, HOLY_WEEK_DAY_IDS } = loadCurrentDay();
  const { HOLY_WEEK_ROWS } = manifest;
  // The helper's day ids are the menu rows' first (day) entries, in order.
  assert.deepEqual([...HOLY_WEEK_DAY_IDS], HOLY_WEEK_ROWS.map((row) => row.days[0].id));
  const palmSunday = new Date(Date.UTC(2027, 3, 25));
  const day = (offset) => new Date(Date.UTC(2027, 3, 25 + offset));
  assert.equal(currentHolyWeekDayId(palmSunday, day(0), false), 'palm-sunday');
  // Sunday evening: the effective date has rolled to Monday, and Monday Eve is being prayed.
  assert.equal(currentHolyWeekDayId(palmSunday, day(1), true), 'monday-eve');
  assert.equal(currentHolyWeekDayId(palmSunday, day(4), false), 'holy-thursday');
  assert.equal(currentHolyWeekDayId(palmSunday, day(5), true), 'friday-eve');
  assert.equal(currentHolyWeekDayId(palmSunday, day(6), true), 'bright-saturday');
  // Lazarus Saturday evening rolls onto Palm Sunday, which has no eve here.
  assert.equal(currentHolyWeekDayId(palmSunday, day(0), true), 'palm-sunday');
  assert.equal(currentHolyWeekDayId(palmSunday, day(-1), false), null);
  assert.equal(currentHolyWeekDayId(palmSunday, day(7), false), null);
});

test('pascha_hour bookmarks keep the hour they were made in', () => {
  const { bookmarkKeyFor } = manifest;
  assert.equal(bookmarkKeyFor('holy_week', 'pascha_hour', 'monday_1st'), 'holy_week:pascha_hour@monday_1st');
  assert.equal(bookmarkKeyFor('holy_week', 'good_friday_twelfth_hour', 'friday_12th'), 'holy_week:good_friday_twelfth_hour');
});

test('HolyThursdayMatins is raised by the Holy Thursday 1st hour alone', () => {
  const raising = manifest.HOLY_WEEK_HOURS.filter((hour) => hour.extraContext?.HolyThursdayMatins === true);
  assert.deepEqual(raising.map((hour) => hour.id), ['thursday_1st']);
  assert.equal(raising[0].table, 'thursday_first_hour');
  assert.equal(raising[0].extraContext.Matins, true);
});

function loadTs(path, stubs = {}) {
  const { outputText } = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, allowJs: true },
  });
  const module = { exports: {} };
  new Function('module', 'exports', 'require', outputText)(module, module.exports, (id) => (id in stubs ? stubs[id] : require(id)));
  return module.exports;
}

const dateUtils = loadTs('src/utils/dateUtils.js');
const { evaluateCondition } = loadTs('src/utils/conditionEngine.js', { './dateUtils': dateUtils, '../services/contentDataClient': { contentDataClient: {} } });
const hourById = (id) => manifest.HOLY_WEEK_HOURS.find((hour) => hour.id === id);
const hoursWhere = (condition) => manifest.HOLY_WEEK_HOURS.filter((hour) => evaluateCondition(condition, hour.extraContext)).map((hour) => hour.id);

test('every hour of Holy Week raises a token of its own, and no other hour raises it', () => {
  const tokens = manifest.HOLY_WEEK_HOURS.filter((hour) => hour.hourNumber).map((hour) => {
    const own = Object.keys(hour.extraContext).filter((key) => /^(PalmSunday|Holy(Monday|Tuesday|Wednesday|Thursday)|GoodFriday|(Monday|Tuesday|Wednesday|Thursday|Friday)Eve)\d+(st|rd|th)Hour$/.test(key));
    assert.equal(own.length, 1, `${hour.id}: ${own.join(', ')}`);
    assert.equal(hour.extraContext[own[0]], true);
    return [hour.id, own[0]];
  });
  assert.deepEqual(Object.fromEntries(tokens), {
    sunday_9th: 'PalmSunday9thHour', sunday_11th: 'PalmSunday11thHour',
    monday_eve_1st: 'MondayEve1stHour', monday_eve_3rd: 'MondayEve3rdHour', monday_eve_6th: 'MondayEve6thHour', monday_eve_9th: 'MondayEve9thHour', monday_eve_11th: 'MondayEve11thHour',
    monday_1st: 'HolyMonday1stHour', monday_3rd: 'HolyMonday3rdHour', monday_6th: 'HolyMonday6thHour', monday_9th: 'HolyMonday9thHour', monday_11th: 'HolyMonday11thHour',
    tuesday_eve_1st: 'TuesdayEve1stHour', tuesday_eve_3rd: 'TuesdayEve3rdHour', tuesday_eve_6th: 'TuesdayEve6thHour', tuesday_eve_9th: 'TuesdayEve9thHour', tuesday_eve_11th: 'TuesdayEve11thHour',
    tuesday_1st: 'HolyTuesday1stHour', tuesday_3rd: 'HolyTuesday3rdHour', tuesday_6th: 'HolyTuesday6thHour', tuesday_9th: 'HolyTuesday9thHour', tuesday_11th: 'HolyTuesday11thHour',
    wednesday_eve_1st: 'WednesdayEve1stHour', wednesday_eve_3rd: 'WednesdayEve3rdHour', wednesday_eve_6th: 'WednesdayEve6thHour', wednesday_eve_9th: 'WednesdayEve9thHour', wednesday_eve_11th: 'WednesdayEve11thHour',
    wednesday_1st: 'HolyWednesday1stHour', wednesday_3rd: 'HolyWednesday3rdHour', wednesday_6th: 'HolyWednesday6thHour', wednesday_9th: 'HolyWednesday9thHour', wednesday_11th: 'HolyWednesday11thHour',
    thursday_eve_1st: 'ThursdayEve1stHour', thursday_eve_3rd: 'ThursdayEve3rdHour', thursday_eve_6th: 'ThursdayEve6thHour', thursday_eve_9th: 'ThursdayEve9thHour', thursday_eve_11th: 'ThursdayEve11thHour',
    thursday_1st: 'HolyThursday1stHour', thursday_3rd: 'HolyThursday3rdHour', thursday_6th: 'HolyThursday6thHour', thursday_9th: 'HolyThursday9thHour', thursday_11th: 'HolyThursday11thHour',
    friday_eve_1st: 'FridayEve1stHour', friday_eve_3rd: 'FridayEve3rdHour', friday_eve_6th: 'FridayEve6thHour', friday_eve_9th: 'FridayEve9thHour', friday_eve_11th: 'FridayEve11thHour',
    friday_1st: 'GoodFriday1stHour', friday_3rd: 'GoodFriday3rdHour', friday_6th: 'GoodFriday6thHour', friday_9th: 'GoodFriday9thHour', friday_11th: 'GoodFriday11thHour', friday_12th: 'GoodFriday12thHour',
  });
  // Each names one hour only, wherever it is tested.
  for (const [id, token] of tokens) assert.deepEqual(hoursWhere(token), [id], token);
  // The older names still answer for their hour.
  assert.deepEqual(hoursWhere('CovenantThursday11thHour'), ['thursday_11th']);
  assert.deepEqual(hoursWhere('HolyThursdayMatins'), ['thursday_1st']);
});

test("the content's hour conditions show in exactly the hours they name", () => {
  // holy_week.hymn_texts daytimeLitanies: not on Palm Sunday, nor at Holy Thursday's 11th hour.
  const litanies = hoursWhere('!PalmSunday && !HolyThursday11thHour');
  assert.ok(!litanies.includes('thursday_11th') && !litanies.includes('sunday_9th') && !litanies.includes('sunday_11th'));
  assert.ok(litanies.includes('thursday_9th') && litanies.includes('friday_eve_11th') && litanies.includes('monday_1st'));
  // public.hymn_texts hymnOfTheCenser: its two Holy Week tunes, at Good Friday's 6th and 9th hours alone.
  assert.deepEqual(hoursWhere('((Feasts || (NormalFastingDays && Weekends) || (Annual && !NormalFastingDays)) && !HolyWeek) || (GoodFriday6thHour)'), ['friday_6th']);
  assert.deepEqual(hoursWhere('(((NormalFastingDays && !Weekends) || LentWeekends) && !HolyWeek) || (GoodFriday9thHour)'), ['friday_9th']);
  // gospel_rite.hymn_texts: the four Gospels of John at the Friday Eve 1st hour alone.
  assert.deepEqual(hoursWhere('FridayEve1stHour'), ['friday_eve_1st']);
  // The general hour tokens still pick every hour of their kind.
  assert.equal(hoursWhere('PaschaEveHour && EleventhHour').length, 5);
  assert.deepEqual(hoursWhere('GoodFriday && TwelfthHour'), ['friday_12th']);
});

test('every Holy Week service is read for the day it is prayed on, in the Holy Week to come', () => {
  const { copticEaster, holyWeekDate } = loadTs('src/utils/holyWeekDates.ts', { './dateUtils': dateUtils });
  const iso = (date) => date.toISOString().slice(0, 10);
  // The Feast of the Resurrection, as the Church keeps it (and as calendar.season_ranges has it for 2026 and 2027).
  assert.deepEqual([2024, 2025, 2026, 2027, 2028, 2029, 2030].map((year) => iso(copticEaster(year))), [
    '2024-05-05', '2025-04-20', '2026-04-12', '2027-05-02', '2028-04-16', '2029-04-08', '2030-04-28',
  ]);
  const at = (day) => new Date(`${day}T00:00:00Z`);
  // Read in October, Holy Week is next spring's.
  assert.equal(iso(holyWeekDate('GoodFriday', at('2026-10-25'))), '2027-04-30');
  assert.equal(iso(holyWeekDate('PalmSunday', at('2026-10-25'))), '2027-04-25');
  // Within Holy Week, this year's, the days already past included, up to Bright Saturday.
  assert.equal(iso(holyWeekDate('HolyThursday', at('2026-04-10'))), '2026-04-09');
  assert.equal(iso(holyWeekDate('BrightSaturday', at('2026-04-11'))), '2026-04-11');
  // From the Feast on, the next year's.
  assert.equal(iso(holyWeekDate('HolyMonday', at('2026-04-12'))), '2027-04-26');

  const prayedOn = Object.fromEntries(manifest.HOLY_WEEK_HOURS.map((hour) => [hour.id, hour.prayedOn]));
  assert.equal(prayedOn.general_funeral_prayer, 'PalmSunday');
  assert.equal(prayedOn.monday_eve_1st, 'HolyMonday', 'an eve is read for the day it leads into');
  assert.equal(prayedOn.friday_eve_11th, 'GoodFriday');
  assert.equal(prayedOn.liturgy_of_the_waters, 'HolyThursday');
  assert.equal(prayedOn.holy_thursday_liturgy, 'HolyThursday');
  assert.equal(prayedOn.friday_12th, 'GoodFriday');
  assert.equal(prayedOn.bright_saturday, 'BrightSaturday');
  for (const hour of manifest.HOLY_WEEK_HOURS) assert.ok(hour.prayedOn, hour.id);

  const route = fs.readFileSync('src/app/holy-week/[dayId]/[hourId].tsx', 'utf8');
  assert.match(route, /const conditionDate = useMemo\(\n\s+\(\) => \(prayedOn \? holyWeekDate\(prayedOn, new Date\(fromIso\)\) : undefined\),\n\s+\[fromIso, prayedOn\],/);
  assert.match(route, /conditionDate=\{conditionDate\}/);
  const document = fs.readFileSync('src/components/vine/screens/ServiceDocument.tsx', 'utf8');
  assert.match(document, /const effectiveDate = conditionDate \?\? calendarEffectiveDate;\n\s+const vespersEffectiveDate = conditionDate \?\? calendar\.vespersEffectiveDate;/);
  // Offline, past what an old downloaded calendar holds: the calendar's day rather than an error.
  assert.match(document, /return conditionDate\n\s+\? hydrated\.catch\(\(\) => hydrateSupabaseServiceHymn\(schema, table, calendarEffectiveDate, flags, undefined\)\)\n\s+: hydrated;/);
});
