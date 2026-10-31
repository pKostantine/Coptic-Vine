const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

/**
 * The Synaxarium page (app/synaxarium/index.tsx) draws only the months around
 * where the reader is. Drawn whole, its 365 day cards and their saints took
 * seconds to open on a phone, and stayed drawn under each saint's entry.
 */
const page = fs.readFileSync('src/app/synaxarium/index.tsx', 'utf8');

test('only the months around the reader are drawn, more as the reader nears either end', () => {
  assert.match(page, /\{monthGroups\.slice\(drawn\.first, drawn\.last \+ 1\)\.map\(\(month\) => \(\n\s+<MonthDays/);
  assert.doesNotMatch(page, /\{days\.map\(\(day\) =>/, 'no longer the whole year at once');
  assert.match(page, /const drawn = span \?\? \{ first: Math\.max\(0, focusMonth - MONTHS_AROUND\), last: Math\.min\(monthGroups\.length - 1, focusMonth \+ MONTHS_AROUND\) \};/);
  // Near the end, the next month below; near the top, the one before above.
  assert.match(page, /setSpan\(\{ first: drawn\.first, last: drawn\.last \+ 1 \}\);/);
  assert.match(page, /setSpan\(\{ first: drawn\.first - 1, last: drawn\.last \}\);/);
  // Not before the list has landed, and one month at a time.
  assert.match(page, /if \(!didAutoScroll\.current \|\| growing\.current\) return;/);
});

test('a month drawn above leaves the list where it was', () => {
  assert.match(page, /const KEEP_IN_PLACE = \{ minIndexForVisible: 0 \};/);
  assert.match(page, /maintainVisibleContentPosition=\{Platform\.OS === 'web' \? undefined : KEEP_IN_PLACE\}/);
  // The web has no such prop: the page puts the list back by the new month's height before it is painted.
  assert.match(page, /useLayoutEffect\(\(\) => \{\n\s+const from = prependFrom\.current;[\s\S]*?node\.scrollTop = from\.top \+ \(node\.scrollHeight - from\.height\);\n\s+\}, \[drawn\.first\]\);/);
});

test('a jump draws that month with the one before it above, and lands at its top', () => {
  const jump = page.slice(page.indexOf('const jumpToMonth'), page.indexOf('const openEntry'));
  assert.match(jump, /jumpedTo\.current = index;/);
  assert.match(jump, /setSpan\(\{ first: Math\.max\(0, index - MONTHS_AROUND\), last: Math\.min\(monthGroups\.length - 1, index \+ MONTHS_AROUND\) \}\);/);
  assert.match(jump, /setListKey\(\(key\) => key \+ 1\);/);
  assert.match(page, /const month = jumpedTo\.current \?\? focusMonth;/);
});

test('each month and day card is drawn again only when what it shows changes', () => {
  assert.match(page, /const DayCard = memo\(function DayCard\(/);
  assert.match(page, /const MonthDays = memo\(function MonthDays\(/);
  // What they are handed stays the same from one drawing of the page to the next.
  assert.match(page, /const onMonthLayout = useCallback\(\(copticMonth: number, height: number\) => layouts\.current\.month\(copticMonth, height\), \[\]\);/);
  assert.match(page, /const onFocusLayout = useCallback\(\(y: number\) => layouts\.current\.focus\(y\), \[\]\);/);
  // The App Language goes with them, as tr() reads it.
  assert.match(page, /language=\{preferences\.appLanguage\}/);
});

test('the year is read once while the app runs; a search draws only the results in sight', () => {
  assert.match(page, /let lastYear: \{ key: string; rows: SynaxariumYearRow\[\] \} \| null = null;/);
  assert.match(page, /if \(lastYear\?\.key === yearIso\) return undefined;/);
  assert.match(page, /lastYear = \{ key: yearIso, rows: payload \};/);
  assert.match(page, /<NowPlayingAwareFlatList\n\s+key="results"/);
});

test('hidden under an entry on the web, the page keeps what it measured', () => {
  assert.match(page, /if \(height > 0\) monthHeights\.current\.set\(copticMonth, height\);/);
  assert.match(page, /if \(!event\.nativeEvent\.layoutMeasurement\.height\) return;/);
});
