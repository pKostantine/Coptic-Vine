/**
 * The Nativity in the Coptic year after a leap year: Nesi 6 on 11 September
 * 2023 puts Thoout 1 on the 12th and Kiahk 29 on 8 January 2024. The Synod
 * keeps the feast on 7 January (Kiahk 28) with all of Kiahk 29's readings,
 * and its Paramoun on the days before; 8 January keeps Kiahk 29's readings in
 * the Nativity's period, which runs as ever to Tobe 5.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getActiveFlagsForDate, getCalendarReadings, readingCopticDay } from '../src/rpc/calendar.ts';
import { getDayJson, getHomeSynaxariumEvents } from '../src/rpc/synaxarium.ts';
import type { ContentContext } from '../src/types.ts';
import { conversionRows, copticDate } from './copticDates.ts';

test('the calendar has Nesi 6 before a Gregorian leap year, and is back in step from 29 February', () => {
  assert.deepEqual(copticDate('2023-09-11'), { year: 1739, month: 13, day: 6 });
  assert.deepEqual(copticDate('2023-09-12'), { year: 1740, month: 1, day: 1 });
  assert.deepEqual(copticDate('2024-01-07'), { year: 1740, month: 4, day: 28 });
  assert.deepEqual(copticDate('2024-01-08'), { year: 1740, month: 4, day: 29 });
  assert.deepEqual(copticDate('2024-02-29'), { year: 1740, month: 6, day: 21 });
  assert.deepEqual(copticDate('2024-03-01'), { year: 1740, month: 6, day: 22 });
  assert.deepEqual(copticDate('2025-03-01'), { year: 1741, month: 6, day: 22 }, 'the same day as every year');
  assert.deepEqual(copticDate('2025-01-07'), { year: 1741, month: 4, day: 29 });
  assert.deepEqual(copticDate('2024-09-11'), { year: 1741, month: 1, day: 1 });
});

test('the day whose readings a day keeps', () => {
  const kept = (date: string) => { const { month, day } = copticDate(date); return readingCopticDay(date, month, day); };
  // 2024: the feast on a Sunday, its Paramoun Friday and Saturday.
  assert.equal(kept('2024-01-07'), 29, 'the feast reads Kiahk 29');
  assert.equal(kept('2024-01-06'), 28, "the Paramoun's eve reads Kiahk 28, as every year");
  assert.equal(kept('2024-01-05'), 27, "the Paramoun's first day reads what 5 January reads every year");
  assert.equal(kept('2024-01-04'), 25, 'before the Paramoun, a day reads its own date');
  assert.equal(kept('2024-01-08'), 29, '8 January keeps Kiahk 29');
  assert.equal(kept('2024-01-09'), 30);
  // 2028: the feast on a Friday, its Paramoun the Thursday alone.
  assert.equal(kept('2028-01-07'), 29);
  assert.equal(kept('2028-01-06'), 28);
  assert.equal(kept('2028-01-05'), 26);
  // An ordinary year: nothing moves.
  for (const [date, day] of [['2025-01-05', 27], ['2025-01-06', 28], ['2025-01-07', 29], ['2025-01-08', 30]] as const) assert.equal(kept(date), day, date);
  // Nor anything outside Kiahk.
  assert.equal(readingCopticDay('2024-01-10', 5, 1), 1);
});

const SEASONS = [{ range_key: 'nativity-fast', active_season: 'Nativity Fast', start_date: '2023-11-26', end_date: '2024-01-06' }];
const EVENTS = [
  { event_key: 'TheHolyNativityFeast', gregorian_date: '2024-01-07' },
  { event_key: 'TheCircumcisionFeast', gregorian_date: '2024-01-15' },
  { event_key: 'TheHolyEpiphany', gregorian_date: '2024-01-20' },
];
const SAINTS = [{ flag_key: 'StJuliana', flag_type: 'saint', title_english: 'St. Juliana', coptic_month: 4, coptic_day: 26 }];
const ENTRIES = [27, 28, 29, 30].map((day) => ({ entry_key: `synax_04_${day}_01`, coptic_month: 4, coptic_day: day, entry_order: 1, title_english: `Kiahk ${day}`, title_arabic: null }));
const RULES = [27, 28, 29, 30].map((day) => ({ service: 'Liturgy', reading_type: 'Gospel', cycle_type: 'AnnualDaily', coptic_month: 4, coptic_day: day, priority: day === 29 ? 60 : 10, reading_code: null, reading_reference: `Kiahk ${day}`, sunday_message: null }));

function context(): ContentContext {
  const days = conversionRows('2022-11-01', '2025-03-01');
  const byDate = (date: unknown) => days.find((row) => row.gregorian_date === date);
  const answer = (sql: string, args: unknown[]): unknown[] => {
    if (sql.includes('calendar.season_ranges')) return SEASONS;
    if (sql.includes('fixed_coptic_day_flags')) {
      const day = byDate(args[0]);
      return SAINTS.filter((saint) => day && saint.coptic_month === day.coptic_month && (saint.coptic_day === day.coptic_day || saint.coptic_day === day.coptic_day + 1));
    }
    if (sql.includes('calendar.calendar_event_instances') && sql.includes("IN ('TheHolyNativityFeast', 'TheHolyEpiphany')")) {
      return EVENTS.filter((event) => event.event_key !== 'TheCircumcisionFeast').map((event) => ({ ...event, weekday_number: byDate(event.gregorian_date)?.weekday_number ?? null }));
    }
    if (sql.includes('calendar.calendar_event_instances')) return EVENTS.filter((event) => event.gregorian_date === args[0]).map(({ event_key }) => ({ event_key }));
    if (sql.includes('calendar.reading_rules')) return RULES.filter((rule) => rule.coptic_month === args[0] && rule.coptic_day === args[1]);
    if (sql.includes('synaxarium.entry_texts')) return [];
    if (sql.includes('synaxarium.coptic_days')) return [];
    if (sql.includes('synaxarium.entries')) return ENTRIES.filter((entry) => entry.coptic_month === args[0] && entry.coptic_day === args[1]);
    if (sql.includes('BETWEEN')) return days.filter((row) => row.gregorian_date >= String(args[0]) && row.gregorian_date <= String(args[1]));
    if (sql.includes('coptic_date_conversions')) {
      const day = byDate(args[0]);
      return day ? [{ ...day, coptic_date_label: `${day.coptic_month_name} ${day.coptic_day}, ${day.coptic_year}` }] : [];
    }
    throw new Error(`unexpected statement: ${sql}`);
  };
  const statement = (sql: string, args: unknown[] = []) => ({
    sql,
    args,
    bind: (...next: unknown[]) => statement(sql, next),
    all: async () => ({ results: answer(sql, args) }),
    first: async () => answer(sql, args)[0] ?? null,
  });
  const db = {
    prepare: (sql: string) => statement(sql),
    batch: async (statements: ReturnType<typeof statement>[]) => statements.map((each) => ({ results: answer(each.sql, each.args) })),
  };
  return { db: db as unknown as ContentContext['db'], churchId: null };
}

const flags = async (date: string) => new Set((await getActiveFlagsForDate(context(), date)).map((flag) => flag.flag_key));

test('7 January 2024 is the Feast of the Nativity, kept as Kiahk 29', async () => {
  const feast = await flags('2024-01-07');
  for (const flag of ['Nativity', 'NativityFeast', 'GreatFeasts', 'NativityPeriod', 'Kiahk.29']) assert.ok(feast.has(flag), flag);
  for (const flag of ['NativityParamoun', 'Kiahk.28', 'NativityFast']) assert.ok(!feast.has(flag), flag);
});

test('its Paramoun stays on 5 and 6 January, keeping their every-year days', async () => {
  const eve = await flags('2024-01-06');
  assert.ok(eve.has('NativityParamoun') && eve.has('Kiahk.28') && !eve.has('NativityFeast'));
  const first = await flags('2024-01-05');
  assert.ok(first.has('NativityParamoun') && first.has('Kiahk.27'));
  assert.ok(!first.has('StJuliana'), "Kiahk 26's saint gives way to the Paramoun's day");
  assert.ok(!(await flags('2024-01-04')).has('StJuliana'), 'the day before is Kiahk 25, its own date');
  assert.ok((await flags('2025-01-04')).has('StJuliana'), 'an ordinary year keeps her on Kiahk 26');
});

test('8 January 2024 is Kiahk 29 in the Nativity period, not its feast; the period runs to Tobe 5', async () => {
  const day = await flags('2024-01-08');
  assert.ok(day.has('NativityPeriod') && day.has('Kiahk.29'));
  for (const flag of ['NativityFeast', 'Nativity', 'GreatFeasts']) assert.ok(!day.has(flag), flag);
  assert.ok((await flags('2024-01-14')).has('NativityPeriod'), 'Tobe 5');
  const circumcision = await flags('2024-01-15');
  assert.ok(!circumcision.has('NativityPeriod') && circumcision.has('Tobe.6') && circumcision.has('Feasts'), 'Tobe 6, the Circumcision');
});

test("the feast and 8 January both read Kiahk 29's readings; the Paramoun's eve reads Kiahk 28's", async () => {
  const gospel = async (date: string) => (await getCalendarReadings(context(), date)).map((rule) => rule.reading_reference);
  assert.deepEqual(await gospel('2024-01-07'), ['Kiahk 29']);
  assert.deepEqual(await gospel('2024-01-08'), ['Kiahk 29']);
  assert.deepEqual(await gospel('2024-01-06'), ['Kiahk 28']);
  assert.deepEqual(await gospel('2024-01-09'), ['Kiahk 30']);
  assert.deepEqual(await gospel('2025-01-07'), ['Kiahk 29'], 'an ordinary year');
});

test("the feast's Synaxarium is Kiahk 29's, under its own Coptic date", async () => {
  const feast = await getDayJson(context(), '2024-01-07') as { coptic_date: string; entries: { entry_key: string }[] };
  assert.equal(feast.coptic_date, 'Kiahk 28, 1740');
  assert.deepEqual(feast.entries.map((entry) => entry.entry_key), ['synax_04_29_01']);
  const home = await getHomeSynaxariumEvents(context(), '2024-01-06') as { entryKey: string }[];
  assert.deepEqual(home.map((entry) => entry.entryKey), ['synax_04_28_01']);
});
