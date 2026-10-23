/**
 * calendar.get_active_flags_for_date on Coptic year 1743's fasts, with D1's
 * own rows for them: season_ranges ends each fast on its last day, and
 * calendar_event_instances has its feast the day after. Dates are converted
 * as coptic_date_conversions does (Thoout 1 on 11 September).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getActiveFlagsForDate } from '../src/rpc/calendar.ts';
import type { ContentContext } from '../src/types.ts';

const SEASONS = [
  { range_key: 'nativity-fast', active_season: 'Nativity Fast', start_date: '2026-11-25', end_date: '2027-01-06' },
  { range_key: 'jonahs-fast', active_season: "Jonah's Fast", start_date: '2027-02-22', end_date: '2027-02-24' },
  { range_key: 'lent', active_season: 'Lent', start_date: '2027-03-08', end_date: '2027-04-23' },
  { range_key: 'holy-week', active_season: 'Holy Pascha', start_date: '2027-04-24', end_date: '2027-05-01' },
  { range_key: 'holy-50-days', active_season: 'Holy 50 Days', start_date: '2027-05-02', end_date: '2027-06-20' },
  { range_key: 'apostles-fast', active_season: "Apostles' Fast", start_date: '2027-06-21', end_date: '2027-07-11' },
  { range_key: 'st-mary-fast', active_season: "St. Mary's Fast", start_date: '2027-08-07', end_date: '2027-08-21' },
];
const EVENTS = [
  { event_key: 'TheHolyNativityFeast', gregorian_date: '2027-01-07' },
  { event_key: 'TheHolyEpiphany', gregorian_date: '2027-01-19' },
  { event_key: 'JonahsNinevehFeast', gregorian_date: '2027-02-25' },
  { event_key: 'TheApostlesFeastMartyrdomOfStPeterAndStPaul', gregorian_date: '2027-07-12' },
  { event_key: 'AssumptionOfStMarysBody', gregorian_date: '2027-08-22' },
];
const MONTHS = ['Thoout', 'Paopi', 'Hathor', 'Kiahk', 'Tobi', 'Meshir', 'Paremhat', 'Parmouti', 'Pashons', 'Paoni', 'Epep', 'Mesore', 'Nesi'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** 11 Sep 2025 to 10 Sep 2028, as coptic_date_conversions has those days. */
function conversions() {
  const rows = [];
  for (let date = new Date(Date.UTC(2025, 8, 11)); date < new Date(Date.UTC(2028, 8, 11)); date.setUTCDate(date.getUTCDate() + 1)) {
    const year = date.getUTCMonth() > 8 || (date.getUTCMonth() === 8 && date.getUTCDate() >= 11) ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
    const index = Math.round((date.getTime() - Date.UTC(year, 8, 11)) / 86_400_000);
    const month = Math.min(13, Math.floor(index / 30) + 1);
    const copticDay = index - (month - 1) * 30 + 1;
    const weekday = date.getUTCDay();
    rows.push({
      gregorian_date: date.toISOString().slice(0, 10),
      gregorian_year: date.getUTCFullYear(),
      weekday: WEEKDAYS[weekday],
      weekday_number: weekday,
      coptic_year: year - 283,
      coptic_month: month,
      coptic_month_name: MONTHS[month - 1],
      coptic_day: copticDay,
      sunday_ordinal_in_coptic_month: weekday === 0 ? Math.ceil(copticDay / 7) : null,
    });
  }
  return rows;
}

/** The statements readSlice batches, answered from the rows above. */
function context(): ContentContext {
  const days = conversions();
  const answer = (sql: string, args: unknown[]) => {
    if (sql.includes('calendar.season_ranges')) return SEASONS;
    if (sql.includes('fixed_coptic_day_flags')) return [];
    if (sql.includes('calendar.calendar_event_instances') && sql.includes("IN ('TheHolyNativityFeast', 'TheHolyEpiphany')")) {
      return EVENTS.filter((event) => event.event_key === 'TheHolyNativityFeast' || event.event_key === 'TheHolyEpiphany')
        .map((event) => ({ ...event, weekday_number: days.find((row) => row.gregorian_date === event.gregorian_date)?.weekday_number ?? null }));
    }
    if (sql.includes('calendar.calendar_event_instances')) return EVENTS.filter((event) => event.gregorian_date === args[0]).map(({ event_key }) => ({ event_key }));
    if (sql.includes('BETWEEN')) return days.filter((row) => row.gregorian_date >= String(args[0]) && row.gregorian_date <= String(args[1]));
    throw new Error(`unexpected statement: ${sql}`);
  };
  const statement = (sql: string, args: unknown[] = []) => ({
    sql,
    args,
    bind: (...next: unknown[]) => statement(sql, next),
    all: async () => ({ results: answer(sql, args) }),
  });
  const db = {
    prepare: (sql: string) => statement(sql),
    batch: async (statements: ReturnType<typeof statement>[]) => statements.map((each) => ({ results: answer(each.sql, each.args) })),
  };
  return { db: db as unknown as ContentContext['db'], churchId: null };
}

async function flags(date: string): Promise<Set<string>> {
  return new Set((await getActiveFlagsForDate(context(), date)).map((flag) => flag.flag_key));
}

test("Jonah's Fast keeps its three days, Monday to Wednesday; Jonah's Passover is the Thursday", async () => {
  for (const date of ['2027-02-22', '2027-02-23', '2027-02-24']) {
    const day = await flags(date);
    assert.ok(day.has('JonahsFast') && day.has('JonahFast') && day.has('Fasts'), date);
    assert.ok(!day.has('JonahsPassover') && !day.has('Feasts'), date);
    assert.ok(!day.has('NormalFastingDays'), `${date}: Jonah's own fast, not an ordinary one`);
  }
  const passover = await flags('2027-02-25');
  assert.ok(passover.has('JonahPassover') && passover.has('JonahsPassover') && passover.has('Feasts'));
  assert.ok(!passover.has('JonahsFast'));
});

test("the Apostles' Fast keeps its last day; the Apostles' Feast is the day after", async () => {
  const last = await flags('2027-07-11');
  assert.ok(last.has('ApostlesFast') && last.has('Fasts'));
  assert.ok(!last.has('ApostlesFeast') && !last.has('Feasts'));
  const feast = await flags('2027-07-12');
  assert.ok(feast.has('ApostlesFeast') && feast.has('Feasts'));
  assert.ok(!feast.has('ApostlesFast'));
});

test("St. Mary's Fast keeps its last day; the Assumption is the day after", async () => {
  const last = await flags('2027-08-21');
  assert.ok(last.has('StMarysFast') && last.has('StMaryFast') && last.has('Fasts'));
  assert.ok(!last.has('StMarysFeast') && !last.has('Feasts'));
  const feast = await flags('2027-08-22');
  assert.ok(feast.has('StMarysFeast') && feast.has('AssumptionStMary') && feast.has('Feasts'));
  assert.ok(!feast.has('StMarysFast'));
});

test('an ordinary Wednesday after the fasts is a normal fasting day again', async () => {
  const day = await flags('2027-03-03');
  assert.ok(day.has('NormalFastingDays') && day.has('Wednesday') && day.has('Weekdays'));
  assert.ok(!day.has('JonahsFast'));
});
