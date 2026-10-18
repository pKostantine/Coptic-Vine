const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');

const read = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

function load(path, stubs = {}) {
  const moduleObject = { exports: {} };
  const output = ts.transpileModule(read(path), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('exports', 'require', 'module', output)(
    moduleObject.exports,
    (id) => (id in stubs ? stubs[id] : require(id)),
    moduleObject,
  );
  return moduleObject.exports;
}

const day = load('src/utils/liturgicalDay.ts');

/** A day's facts: a weekday (0 Sunday … 6 Saturday) and the flags that matter. */
const facts = (weekday, extra = {}) => ({
  weekday, kiahk: false, greatLent: false, nativity: false, theophany: false, palmSunday: false, holyWeek: false, ...extra,
});
/** The local clock at hh:mm (the date doesn't matter to the rules: the facts carry the day). */
const at = (time) => {
  const [hour, minute] = time.split(':').map(Number);
  return new Date(2026, 9, 18, hour, minute);
};
const service = (time, today, tomorrow = facts((today.weekday + 1) % 7)) => {
  const result = day.prayNowService(at(time), today, tomorrow);
  return result.kind === 'service' ? result.id : result.dayId;
};
const SUNDAY = facts(0);

test('the flags a day carries become its facts', () => {
  const sunday = new Date(Date.UTC(2026, 11, 13));
  assert.deepEqual(day.dayFacts(sunday, { KiahkSeason: true, Sunday: true }), facts(0, { kiahk: true }));
  assert.deepEqual(
    day.dayFacts(new Date(Date.UTC(2027, 4, 1)), { BrightSaturday: true, HolyWeek: true, Pascha: true }),
    facts(6, { holyWeek: true }),
  );
  assert.deepEqual(day.dayFacts(new Date(Date.UTC(2027, 3, 25)), { PalmSunday: true }), facts(0, { palmSunday: true }));
  assert.deepEqual(day.plainDayFacts(new Date(Date.UTC(2026, 9, 18))), SUNDAY);
});

test('the liturgical day begins at 6 PM: at 6:08 PM on Sunday it is already Monday’s', () => {
  assert.equal(day.nextDayBeginsAt(SUNDAY, facts(1)), 18 * 60);
  assert.equal(day.isLiturgicalEvening(at('18:08'), SUNDAY, facts(1)), true);
  assert.equal(day.isLiturgicalEvening(at('17:59'), SUNDAY, facts(1)), false);
  assert.equal(day.isLiturgicalEvening(at('00:30'), facts(1), facts(2)), false);
});

test('it begins at 3 PM on a Saturday in Kiahk or Great Lent, and before the Nativity and Theophany', () => {
  assert.equal(day.nextDayBeginsAt(facts(6, { kiahk: true }), facts(0, { kiahk: true })), 15 * 60);
  assert.equal(day.nextDayBeginsAt(facts(6, { greatLent: true }), facts(0, { greatLent: true })), 15 * 60);
  // Only the Saturday: a Kiahk Sunday or weekday keeps 6 PM.
  assert.equal(day.nextDayBeginsAt(facts(0, { kiahk: true }), facts(1, { kiahk: true })), 18 * 60);
  assert.equal(day.nextDayBeginsAt(facts(5, { greatLent: true }), facts(6, { greatLent: true })), 18 * 60);
  assert.equal(day.nextDayBeginsAt(facts(3), facts(4, { nativity: true })), 15 * 60);
  assert.equal(day.nextDayBeginsAt(facts(1), facts(2, { theophany: true })), 15 * 60);
  assert.equal(day.isLiturgicalEvening(at('15:00'), facts(6, { kiahk: true }), SUNDAY), true);
  assert.equal(day.isLiturgicalEvening(at('14:59'), facts(6, { kiahk: true }), SUNDAY), false);
});

test('and at 10 AM on Bright Saturday, when the Feast of the Resurrection begins', () => {
  const brightSaturday = facts(6, { holyWeek: true });
  assert.equal(day.nextDayBeginsAt(brightSaturday, SUNDAY), 10 * 60);
  assert.equal(day.isLiturgicalEvening(at('10:00'), brightSaturday, SUNDAY), true);
  assert.equal(day.isLiturgicalEvening(at('09:59'), brightSaturday, SUNDAY), false);
});

test('a normal day’s services, each window from its start to just before its end', () => {
  const monday = facts(1);
  assert.equal(service('18:08', SUNDAY), 'vespers_praises');
  assert.equal(service('18:00', monday), 'vespers_praises');
  assert.equal(service('18:59', monday), 'vespers_praises');
  assert.equal(service('19:00', monday), 'vespers');
  assert.equal(service('20:29', monday), 'vespers');
  assert.equal(service('20:30', monday), 'midnight_praises');
  assert.equal(service('23:59', monday), 'midnight_praises');
  assert.equal(service('00:00', monday), 'midnight_praises');
  assert.equal(service('04:59', monday), 'midnight_praises');
  assert.equal(service('05:00', monday), 'matins');
  assert.equal(service('08:59', monday), 'matins');
  assert.equal(service('09:00', monday), 'offering_of_the_lamb');
  assert.equal(service('17:59', monday), 'offering_of_the_lamb');
});

test('Vespers Praises starts at 3 PM on a Saturday in Kiahk or Great Lent', () => {
  const kiahkSaturday = facts(6, { kiahk: true });
  const lentSaturday = facts(6, { greatLent: true });
  assert.equal(service('14:59', kiahkSaturday), 'offering_of_the_lamb');
  assert.equal(service('15:00', kiahkSaturday), 'vespers_praises');
  assert.equal(service('18:59', lentSaturday), 'vespers_praises');
  assert.equal(service('19:00', lentSaturday), 'vespers');
  // An ordinary Saturday keeps 6 PM.
  assert.equal(service('15:00', facts(6)), 'offering_of_the_lamb');
});

test('the eve of the Nativity and of Theophany, from 3 PM', () => {
  const eve = facts(3);
  const nativity = facts(4, { nativity: true });
  const theophany = facts(4, { theophany: true });
  assert.equal(service('14:59', eve, nativity), 'offering_of_the_lamb');
  for (const [time, nativityService, theophanyService] of [
    ['15:00', 'vespers_praises', 'vespers_praises'],
    ['16:59', 'vespers_praises', 'vespers_praises'],
    ['17:00', 'vespers', 'vespers'],
    ['18:00', 'midnight_praises', 'midnight_praises'],
    ['19:00', 'matins', 'liturgy_of_the_waters'],
    ['20:00', 'offering_of_the_lamb', 'matins'],
    ['21:00', 'offering_of_the_lamb', 'offering_of_the_lamb'],
    ['23:59', 'offering_of_the_lamb', 'offering_of_the_lamb'],
  ]) {
    assert.equal(service(time, eve, nativity), nativityService, `Nativity eve at ${time}`);
    assert.equal(service(time, eve, theophany), theophanyService, `Theophany eve at ${time}`);
  }
});

test('Holy Week: each eve from 3 PM to 1 AM, each day from 1 AM to 3 PM', () => {
  const palmSunday = facts(0, { palmSunday: true });
  const holy = (weekday) => facts(weekday, { holyWeek: true });
  assert.equal(service('14:59', palmSunday, holy(1)), 'offering_of_the_lamb');
  assert.equal(service('15:00', palmSunday, holy(1)), 'monday-eve');
  assert.equal(service('00:59', holy(1), holy(2)), 'monday-eve');
  assert.equal(service('01:00', holy(1), holy(2)), 'monday');
  assert.equal(service('14:59', holy(1), holy(2)), 'monday');
  assert.equal(service('15:00', holy(1), holy(2)), 'tuesday-eve');
  assert.equal(service('00:30', holy(2), holy(3)), 'tuesday-eve');
  assert.equal(service('10:00', holy(2), holy(3)), 'tuesday');
  assert.equal(service('20:00', holy(2), holy(3)), 'wednesday-eve');
  assert.equal(service('10:00', holy(3), holy(4)), 'wednesday');
  assert.equal(service('20:00', holy(3), holy(4)), 'thursday-eve');
  assert.equal(service('00:30', holy(4), holy(5)), 'thursday-eve');
  assert.equal(service('01:00', holy(4), holy(5)), 'holy-thursday');
  // Holy Thursday 3 PM to Friday 1 AM is the Eve of Good Friday.
  assert.equal(service('15:00', holy(4), holy(5)), 'friday-eve');
  assert.equal(service('00:59', holy(5), holy(6)), 'friday-eve');
});

test('Good Friday to 7 PM, Bright Saturday to 10 AM, then the Resurrection’s eve', () => {
  const holy = (weekday) => facts(weekday, { holyWeek: true });
  assert.equal(service('01:00', holy(5), holy(6)), 'good-friday');
  assert.equal(service('18:59', holy(5), holy(6)), 'good-friday');
  assert.equal(service('19:00', holy(5), holy(6)), 'bright-saturday');
  assert.equal(service('03:00', holy(6), SUNDAY), 'bright-saturday');
  assert.equal(service('09:59', holy(6), SUNDAY), 'bright-saturday');
  assert.equal(service('10:00', holy(6), SUNDAY), 'midnight_praises');
  assert.equal(service('18:59', holy(6), SUNDAY), 'midnight_praises');
  assert.equal(service('19:00', holy(6), SUNDAY), 'matins');
  assert.equal(service('20:00', holy(6), SUNDAY), 'offering_of_the_lamb');
  assert.equal(service('23:59', holy(6), SUNDAY), 'offering_of_the_lamb');
});

test('Home’s readings open on Vespers on the eve, Matins before 9, otherwise the Liturgy', () => {
  assert.equal(day.readingsServiceAt(at('18:08'), true), 'Vespers');
  assert.equal(day.readingsServiceAt(at('17:30'), false), 'Liturgy');
  assert.equal(day.readingsServiceAt(at('08:59'), false), 'Matins');
  assert.equal(day.readingsServiceAt(at('09:00'), false), 'Liturgy');
});
