/**
 * On the web a day chosen away from live is kept in the address
 * (`?day=8nov2026-morning`), so a link opens on it and a reload stays on it
 * (utils/dayInUrl.ts, components/DayInUrl.tsx).
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');

function load(path) {
  const source = fs.readFileSync(path, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const module = { exports: {} };
  new Function('exports', 'module', 'require', outputText)(module.exports, module, require);
  return module.exports;
}

const read = (path) => fs.readFileSync(path, 'utf8');
const day = load('src/utils/dayInUrl.ts');
const iso = (date) => date.toISOString().slice(0, 10);

test('a day is written as its date and its half: the day or its eve', () => {
  assert.equal(day.formatDayParam(new Date('2026-11-08T00:00:00Z'), 'morning'), '8nov2026-morning');
  assert.equal(day.formatDayParam(new Date('2026-01-31T00:00:00Z'), 'evening'), '31jan2026-evening');
});

test('what is written reads back as the same day', () => {
  for (const [date, period] of [['2026-11-08', 'morning'], ['2026-02-28', 'evening'], ['2028-02-29', 'morning'], ['2026-12-31', 'evening']]) {
    const read = day.parseDayParam(day.formatDayParam(new Date(`${date}T00:00:00Z`), period));
    assert.equal(iso(read.date), date);
    assert.equal(read.period, period);
  }
});

test('a hand-typed day is read too, and the morning is assumed', () => {
  assert.deepEqual(summary(day.parseDayParam('8nov2026')), ['2026-11-08', 'morning']);
  assert.deepEqual(summary(day.parseDayParam('8Nov2026Evening')), ['2026-11-08', 'evening']);
  assert.deepEqual(summary(day.parseDayParam('8november2026-eve')), ['2026-11-08', 'evening']);
  assert.deepEqual(summary(day.parseDayParam('2026-11-08')), ['2026-11-08', 'morning']);
  assert.deepEqual(summary(day.parseDayParam('2026-11-08-evening')), ['2026-11-08', 'evening']);
});

test('what is not a day is left alone, and the app opens live', () => {
  for (const value of ['', null, undefined, 'today', '31feb2026', '8xyz2026', '2026-13-01', '8nov26', '99nov2026']) {
    assert.equal(day.parseDayParam(value), null, String(value));
  }
});

test('the address keeps its path, its other query and its hash', () => {
  assert.equal(day.addressWithDay('https://copticvine.ca/liturgy/divine-liturgy/basil', '8nov2026-morning'), '/liturgy/divine-liturgy/basil?day=8nov2026-morning');
  assert.equal(day.addressWithDay('https://copticvine.ca/books?settings=1&day=1jan2026-morning#x', '8nov2026-evening'), '/books?settings=1&day=8nov2026-evening#x');
  assert.equal(day.addressWithDay('https://copticvine.ca/books?settings=1&day=1jan2026-morning', null), '/books?settings=1');
});

test('the app opens on the address\'s day, and keeps it in the address while not live', () => {
  const layout = read('src/app/_layout.tsx');
  assert.match(layout, /const dayFromAddress = readDayFromAddress\(\);/);
  assert.match(layout, /<CalendarProvider initialDate=\{dayFromAddress\?\.date \?\? null\} initialPeriod=\{dayFromAddress\?\.period \?\? null\}>\s*<DayInUrl \/>/);
  const calendar = read('src/context/CalendarContext.tsx');
  assert.match(calendar, /useState<LiturgicalDayPeriod \| null>\(initialDate \? initialPeriod : null\)/);
  const sync = read('src/components/DayInUrl.tsx');
  assert.match(sync, /isLive \? null : formatDayParam\(rawDate, liturgicalDayPeriod\)/, 'live writes no day');
  assert.match(sync, /window\.history\.replaceState\(window\.history\.state, '', next\)/, 'no new history entry, the router\'s state kept');
  assert.match(sync, /Platform\.OS !== 'web'/);
});

function summary(value) {
  return value ? [iso(value.date), value.period] : null;
}
