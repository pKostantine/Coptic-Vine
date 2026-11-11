/**
 * The Coptic calendar, worked out: what calendar.coptic_date_conversions
 * holds for each day. Thoout 1 is 11 September, but 12 September in the year
 * after a Coptic leap year (one whose year mod 4 is 3, ending on Nesi 6),
 * until the Gregorian 29 February brings the two back in step.
 */
const COPTIC_EPOCH = 1825030; // Julian day number of Thoout 1, year 1.
const MONTHS = ['Thoout', 'Paopi', 'Hathor', 'Kiahk', 'Tobe', 'Meshir', 'Paremhotep', 'Parmoute', 'Pashons', 'Paoni', 'Epep', 'Mesore', 'Nesi'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const julianDay = (iso: string) => Math.round(Date.parse(`${iso}T00:00:00Z`) / 86_400_000) + 2_440_588;
const monthStart = (year: number, month: number) => COPTIC_EPOCH - 1 + 365 * (year - 1) + Math.floor(year / 4) + 30 * (month - 1) + 1;

export function copticDate(iso: string): { year: number; month: number; day: number } {
  const jd = julianDay(iso);
  const year = Math.floor((4 * (jd - COPTIC_EPOCH) + 1463) / 1461);
  const month = Math.floor((jd - monthStart(year, 1)) / 30) + 1;
  return { year, month, day: jd - monthStart(year, month) + 1 };
}

/** coptic_date_conversions' rows from `from` to `to`, inclusive. */
export function conversionRows(from: string, to: string) {
  const rows = [];
  for (let date = new Date(`${from}T00:00:00Z`); date <= new Date(`${to}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + 1)) {
    const iso = date.toISOString().slice(0, 10);
    const { year, month, day } = copticDate(iso);
    const weekday = date.getUTCDay();
    rows.push({
      gregorian_date: iso,
      gregorian_year: date.getUTCFullYear(),
      weekday: WEEKDAYS[weekday],
      weekday_number: weekday,
      coptic_year: year,
      coptic_month: month,
      coptic_month_name: MONTHS[month - 1],
      coptic_day: day,
      sunday_ordinal_in_coptic_month: weekday === 0 ? Math.ceil(day / 7) : null,
    });
  }
  return rows;
}
