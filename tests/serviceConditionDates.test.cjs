const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');

function loadHelpers() {
  let source = fs.readFileSync('src/utils/serviceConditionDates.ts', 'utf8');
  source = source.replace(
    "import { addUtcDays } from './dateUtils';",
    "const addUtcDays = (date, delta) => { const d = new Date(date); d.setUTCDate(d.getUTCDate() + delta); return d; };",
  );
  const javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const moduleObject = { exports: {} };
  new Function('exports', 'require', 'module', '__filename', '__dirname', javascript)(
    moduleObject.exports,
    require,
    moduleObject,
    'serviceConditionDates.ts',
    process.cwd(),
  );
  return moduleObject.exports;
}

function dateOnly(isoDate) {
  return new Date(`${isoDate}T00:00:00Z`);
}

function isoDate(date) {
  return date?.toISOString().slice(0, 10);
}

test("a day's Vespers takes the weekday of the evening it is prayed on, the day before", () => {
  const { getServiceWeekdayConditionDate } = loadHelpers();
  // Palm Sunday 2027 is 25 April: its Vespers is Saturday's, VatosDays.
  const palmSunday = dateOnly('2027-04-25');
  const services = [
    { schema: 'psalmody', table: 'vespers_praises' },
    { schema: 'liturgy', table: 'raising_of_incense', extraContext: { Vespers: true } },
    { schema: 'liturgy', table: 'lectionary_vespers' },
    { schema: 'liturgy', table: 'sermon_planner' },
  ];
  for (const service of services) {
    assert.equal(isoDate(getServiceWeekdayConditionDate({ ...service, effectiveDate: palmSunday })), '2027-04-24', service.table);
  }
});

test('Vespers opened on the eve and on the morning after read the same weekday', () => {
  const { getServiceWeekdayConditionDate } = loadHelpers();
  // Saturday night rolls the calendar forward to Palm Sunday (CalendarContext's
  // effectiveDate); Sunday morning is Palm Sunday already. Nothing else goes in.
  const saturdayNight = getServiceWeekdayConditionDate({ schema: 'liturgy', table: 'raising_of_incense', extraContext: { Vespers: true }, effectiveDate: dateOnly('2027-04-25') });
  const sundayMorning = getServiceWeekdayConditionDate({ schema: 'liturgy', table: 'raising_of_incense', extraContext: { Vespers: true }, effectiveDate: dateOnly('2027-04-25') });
  assert.equal(isoDate(saturdayNight), isoDate(sundayMorning));
  const calendar = fs.readFileSync('src/context/CalendarContext.tsx', 'utf8');
  assert.doesNotMatch(calendar, /vespersEffectiveDate/, 'no date of the hour for Vespers');
  const document = fs.readFileSync('src/components/vine/screens/ServiceDocument.tsx', 'utf8');
  assert.doesNotMatch(document, /vespersEffectiveDate/);
});

test('Matins, the Liturgy and every other service take no weekday of their own', () => {
  const { getServiceWeekdayConditionDate } = loadHelpers();
  for (const service of [
    { schema: 'psalmody', table: 'midnight_praises' },
    { schema: 'liturgy', table: 'raising_of_incense', extraContext: { Matins: true } },
    { schema: 'liturgy', table: 'lectionary_matins' },
    { schema: 'liturgy', table: 'liturgy_of_st_basil' },
  ]) {
    assert.equal(getServiceWeekdayConditionDate({ ...service, effectiveDate: dateOnly('2027-04-25') }), undefined, service.table);
  }
});
