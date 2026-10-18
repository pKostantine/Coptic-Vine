const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');

const read = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

function load(path, stubs = {}) {
  const moduleObject = { exports: {} };
  const output = ts.transpileModule(read(path), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
  }).outputText;
  new Function('exports', 'require', 'module', output)(
    moduleObject.exports,
    (id) => (id in stubs ? stubs[id] : require(id)),
    moduleObject,
  );
  return moduleObject.exports;
}

const localeStub = {
  toEasternArabicDigits: (value) => String(value).replace(/\d/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[digit]),
  WEEKDAYS_EN: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  WEEKDAYS_FR: ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'],
  WEEKDAYS_AR: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
};
const agpeyaHours = load('src/utils/agpeyaHours.ts', { './localeFormat': localeStub });
const canon = load('src/utils/spiritualCanon.ts', { './agpeyaHours': agpeyaHours });

const STAMP = '2026-10-01T00:00:00.000Z';
const plan = (hourId, extra = {}) => ({ hourId, goal: { kind: 'none' }, time: null, remind: false, ...extra });
function agpeya(extra = {}) {
  return { id: 'agpeya-1', kind: 'agpeya', frequency: { kind: 'daily' }, pattern: 'same', hours: [], days: [[], [], [], [], [], [], []], createdAt: STAMP, updatedAt: STAMP, ...extra };
}
function bible(extra = {}) {
  return { id: 'bible-1', kind: 'bible', frequency: { kind: 'daily' }, goal: { kind: 'chapters', count: 2 }, time: null, remind: false, createdAt: STAMP, updatedAt: STAMP, ...extra };
}
function custom(extra = {}) {
  return { id: 'custom-1', kind: 'custom', title: 'Metanias', note: '', frequency: { kind: 'daily' }, goal: { kind: 'times', count: 50, unit: 'metanias' }, time: null, remind: false, createdAt: STAMP, updatedAt: STAMP, ...extra };
}
const doc = (items, days = {}) => ({ version: 1, items, itemDeletions: {}, days, updatedAt: STAMP });

test('days are the device’s calendar days, and the week starts on Sunday', () => {
  assert.equal(canon.canonDayKey(new Date(2026, 9, 18, 23, 59)), '2026-10-18');
  assert.equal(canon.addCanonDays('2026-10-31', 1), '2026-11-01');
  assert.equal(canon.addCanonDays('2026-03-01', -1), '2026-02-28');
  assert.equal(canon.canonWeekday('2026-10-18'), 0); // a Sunday
  assert.equal(canon.canonWeekStart('2026-10-24'), '2026-10-18');
  assert.equal(canon.canonWeekStart('2026-10-18'), '2026-10-18');
});

test('an Agpeya item asks for each of its hours, in the order of the praying day', () => {
  const item = agpeya({ hours: [plan('midnight_hour'), plan('first_hour', { goal: { kind: 'psalms', count: 6 } }), plan('twelfth_hour', { time: '21:30' })] });
  const tasks = canon.canonTasksForDay(doc([item]), '2026-10-18');
  // Midnight belongs to the end of the praying day, not its start.
  assert.deepEqual(tasks.map((task) => task.hourId), ['first_hour', 'twelfth_hour', 'midnight_hour']);
  assert.equal(tasks[0].key, 'agpeya-1:first_hour');
  assert.deepEqual(tasks[0].goal, { kind: 'psalms', count: 6 });
});

test('chosen days, and an Agpeya that varies by day, ask only on their days', () => {
  const reading = bible({ frequency: { kind: 'weekdays', days: [3, 5] } });
  const varying = agpeya({ pattern: 'byDay', days: [[plan('first_hour')], [], [], [plan('ninth_hour')], [], [], [plan('first_hour'), plan('midnight_hour')]] });
  const tasksOn = (day) => canon.canonTasksForDay(doc([reading, varying]), day).map((task) => task.key);
  assert.deepEqual(tasksOn('2026-10-18'), ['agpeya-1:first_hour']); // Sunday
  assert.deepEqual(tasksOn('2026-10-19'), []); // Monday: a day off
  assert.deepEqual(tasksOn('2026-10-21'), ['agpeya-1:ninth_hour', 'bible-1']); // Wednesday
  assert.deepEqual(tasksOn('2026-10-24'), ['agpeya-1:first_hour', 'agpeya-1:midnight_hour']); // Saturday
  assert.equal(canon.canonTasksForDay(doc([varying]), '2026-10-18')[0].frequency.kind, 'byDay');
});

test('a task kept a few times a week stays on the list until the week’s count is met', () => {
  const item = custom({ frequency: { kind: 'perWeek', times: 2 } });
  const mark = { done: true, at: STAMP };
  // Done Sunday: still asked Monday, one of two.
  let days = { '2026-10-18': { 'custom-1': mark } };
  let [task] = canon.canonTasksForDay(doc([item], days), '2026-10-19');
  assert.deepEqual(task.weekly, { done: 1, target: 2 });
  assert.equal(task.done, false);
  // Done Monday too: Tuesday asks nothing more; Monday itself still shows it, ticked.
  days = { ...days, '2026-10-19': { 'custom-1': mark } };
  assert.deepEqual(canon.canonTasksForDay(doc([item], days), '2026-10-20'), []);
  [task] = canon.canonTasksForDay(doc([item], days), '2026-10-19');
  assert.equal(task.done, true);
  assert.deepEqual(task.weekly, { done: 2, target: 2 });
  // A new week starts afresh.
  assert.equal(canon.canonTasksForDay(doc([item], days), '2026-10-25').length, 1);
});

test('custom tasks with a time take their place in the day; those without come last', () => {
  const items = [
    custom({ id: 'c-any', title: 'Any time' }),
    custom({ id: 'c-early', title: 'Early', time: '05:30', createdAt: '2026-10-02T00:00:00.000Z' }),
    bible({ time: '13:00' }),
    agpeya({ hours: [plan('sixth_hour')] }),
  ];
  const order = canon.canonTasksForDay(doc(items), '2026-10-18').map((task) => task.key);
  assert.deepEqual(order, ['c-early', 'agpeya-1:sixth_hour', 'bible-1', 'c-any']);
});

test('what is read back is cleaned: unknown hours, too many psalms, reminders with no time', () => {
  const clean = canon.normalizeCanonDocument({
    version: 1,
    items: [
      agpeya({ hours: [
        plan('first_hour', { goal: { kind: 'psalms', count: 40 }, remind: true }),
        plan('midnight_hour', { goal: { kind: 'psalms', count: 40 }, time: '00:00', remind: true }),
        plan('first_hour'),
        plan('tenth_hour'),
      ] }),
      custom({ id: 'nameless', title: '   ' }),
      bible({ goal: { kind: 'psalms', count: 3 }, time: '25:00', remind: true }),
      { id: 'x', kind: 'liturgy' },
    ],
    itemDeletions: { gone: 'not a date', removed: STAMP },
    days: { 'not-a-day': { a: { done: true, at: STAMP } }, '2026-10-18': { a: { done: 1, at: STAMP }, b: { done: true } } },
  });
  const [prayer, reading] = clean.items;
  assert.equal(clean.items.length, 2);
  assert.deepEqual(prayer.hours.map((entry) => entry.hourId), ['first_hour', 'midnight_hour']);
  assert.deepEqual(prayer.hours[0].goal, { kind: 'psalms', count: 19 }); // Prime holds nineteen
  assert.deepEqual(prayer.hours[1].goal, { kind: 'psalms', count: 31 }); // the three watches, thirty-one
  assert.equal(prayer.hours[0].remind, false); // no time, no reminder
  assert.equal(prayer.hours[1].remind, true);
  assert.deepEqual(reading.goal, { kind: 'none' }); // psalms are the Agpeya's measure
  assert.equal(reading.time, null);
  assert.equal(reading.remind, false);
  assert.deepEqual(clean.itemDeletions, { removed: STAMP });
  assert.deepEqual(clean.days, { '2026-10-18': { a: { done: true, at: STAMP } } });
});

test('the device’s copy and the account’s merge item by item and mark by mark, the newest winning', () => {
  const older = bible({ goal: { kind: 'chapters', count: 1 }, updatedAt: '2026-10-02T00:00:00.000Z' });
  const newer = bible({ goal: { kind: 'chapters', count: 4 }, updatedAt: '2026-10-05T00:00:00.000Z' });
  const removedLater = custom({ updatedAt: '2026-10-03T00:00:00.000Z' });
  const local = {
    ...doc([older, removedLater], { '2026-10-18': { t: { done: true, at: '2026-10-18T08:00:00.000Z' } } }),
  };
  const cloud = {
    ...doc([newer], { '2026-10-18': { t: { done: false, at: '2026-10-18T09:00:00.000Z' }, u: { done: true, at: '2026-10-18T07:00:00.000Z' } } }),
    itemDeletions: { 'custom-1': '2026-10-04T00:00:00.000Z' },
  };
  const merged = canon.mergeCanonDocuments(local, cloud);
  assert.deepEqual(merged.items.map((item) => item.id), ['bible-1']);
  assert.deepEqual(merged.items[0].goal, { kind: 'chapters', count: 4 });
  // The untick made later on the other device wins over the tick made here.
  assert.deepEqual(merged.days['2026-10-18'], { t: { done: false, at: '2026-10-18T09:00:00.000Z' }, u: { done: true, at: '2026-10-18T07:00:00.000Z' } });
  // An item changed after its removal comes back.
  const revived = canon.mergeCanonDocuments(doc([custom({ updatedAt: '2026-10-06T00:00:00.000Z' })]), cloud);
  assert.deepEqual(revived.items.map((item) => item.id).sort(), ['bible-1', 'custom-1']);
  // Merging is the same either way round.
  assert.deepEqual(canon.mergeCanonDocuments(cloud, local).items, merged.items);
  assert.deepEqual(canon.mergeCanonDocuments(cloud, local).days, merged.days);
});

test('editing stamps the change; removing leaves a tombstone; days still to come cannot be the device’s concern', () => {
  const now = new Date('2026-10-18T10:00:00.000Z');
  let document = canon.withCanonItem(doc([]), bible(), now);
  assert.equal(document.items[0].updatedAt, now.toISOString());
  document = canon.withCanonMark(document, '2026-10-18', 'bible-1', true, now);
  assert.equal(canon.canonTasksForDay(document, '2026-10-18')[0].done, true);
  document = canon.withoutCanonItem(document, 'bible-1', now);
  assert.deepEqual(document.items, []);
  assert.equal(document.itemDeletions['bible-1'], now.toISOString());
  assert.deepEqual(canon.changedCanonDays({ a: { x: { done: true, at: STAMP } } }, {}), ['a']);
  assert.deepEqual(Object.keys(canon.pruneCanonDays({ '2026-01-01': {}, '2026-10-01': {} }, '2026-10-18', 120)), ['2026-10-01']);
});

test('an item needs a name, an hour, a day', () => {
  assert.equal(canon.canonItemProblem(custom({ title: '  ' })), 'title');
  assert.equal(canon.canonItemProblem(agpeya()), 'hours');
  assert.equal(canon.canonItemProblem(agpeya({ pattern: 'byDay' })), 'hours');
  assert.equal(canon.canonItemProblem(bible({ frequency: { kind: 'weekdays', days: [] } })), 'days');
  assert.equal(canon.canonItemProblem(agpeya({ hours: [plan('first_hour')] })), null);
  // An Agpeya varying by day keeps its own days; its frequency is not asked.
  assert.equal(canon.canonItemProblem(agpeya({ pattern: 'byDay', frequency: { kind: 'weekdays', days: [] }, days: [[plan('first_hour')], [], [], [], [], [], []] })), null);
  const fresh = canon.newCanonItem('agpeya');
  assert.equal(fresh.days.length, 7);
  assert.equal(canon.canonItemProblem(fresh), null);
});

test('reminders: each task’s time on each day it is asked, soonest first, not once it is done', () => {
  const now = new Date(2026, 9, 18, 8, 0); // Sunday, 8:00
  const items = [
    agpeya({ hours: [plan('first_hour', { time: '07:00', remind: true }), plan('twelfth_hour', { time: '21:00', remind: true })] }),
    bible({ time: '12:00', remind: false }),
    custom({ frequency: { kind: 'perWeek', times: 1 }, time: '19:00', remind: true }),
  ];
  const marks = { '2026-10-18': { 'custom-1': { done: true, at: STAMP } } };
  const reminders = canon.upcomingCanonReminders(doc(items, marks), now, { horizonDays: 3 });
  const seen = reminders.map((entry) => `${entry.day} ${entry.task.key}`);
  // Today's Prime has passed; the once-a-week item is done for the week; the Bible has no reminder.
  assert.deepEqual(seen, [
    '2026-10-18 agpeya-1:twelfth_hour',
    '2026-10-19 agpeya-1:first_hour',
    '2026-10-19 agpeya-1:twelfth_hour',
    '2026-10-20 agpeya-1:first_hour',
    '2026-10-20 agpeya-1:twelfth_hour',
  ]);
  assert.equal(reminders[0].at.getHours(), 21);
  assert.ok(reminders.every((entry) => /^canon_[A-Za-z0-9_]+$/.test(entry.identifier)));
  assert.equal(new Set(reminders.map((entry) => entry.identifier)).size, reminders.length);
  assert.equal(canon.upcomingCanonReminders(doc(items), now, { horizonDays: 14, limit: 4 }).length, 4);
  assert.equal(canon.canonHasReminders(items), true);
  assert.equal(canon.canonHasReminders([bible()]), false);
  assert.equal(canon.canonTaskRoute({ kind: 'agpeya', hourId: 'ninth_hour' }), '/agpeya/ninth_hour');
  assert.equal(canon.canonTaskRoute({ kind: 'bible', hourId: null }), '/bible');
});

test('the canon speaks each App Language, Arabic counting as Arabic counts', () => {
  let language = 'en';
  const appText = { tr: (english, french, arabic) => (language === 'ar' ? arabic : language === 'fr' ? french : english) };
  const text = load('src/components/canon/canonText.ts', {
    '@/utils/appText': appText,
    '@/utils/agpeyaHours': agpeyaHours,
    '@/utils/preferencesStorage': { getCurrentAppLanguage: () => language },
    '@/utils/localeFormat': localeStub,
    '@/utils/spiritualCanon': canon,
  });
  assert.equal(text.canonGoalLabel({ kind: 'psalms', count: 1 }), '1 psalm');
  assert.equal(text.canonGoalLabel({ kind: 'psalms', count: 12 }, 'third_hour'), 'All psalms');
  assert.equal(text.canonGoalLabel({ kind: 'minutes', count: 90 }), '1 hr 30 min');
  assert.equal(text.canonGoalLabel({ kind: 'verses', count: 1 }), '1 verse');
  assert.equal(text.canonGoalLabel({ kind: 'verses', count: 20 }), '20 verses');
  assert.equal(text.canonGoalLabel({ kind: 'metanias', count: 1 }), '1 metania');
  assert.equal(text.canonFrequencyLabel({ kind: 'applicable' }), 'All applicable days');
  assert.equal(text.canonTaskTitle({ kind: 'metania', hourId: null, title: null }), 'Metanias');
  assert.equal(text.canonGoalLabel({ kind: 'times', count: 50, unit: 'metanias' }), '50 metanias');
  assert.equal(text.canonFrequencyLabel({ kind: 'weekdays', days: [1, 2, 3, 4, 5] }), 'Weekdays');
  assert.equal(text.canonFrequencyLabel({ kind: 'weekdays', days: [0, 3, 5] }), 'Sun, Wed, Fri');
  assert.equal(text.canonFrequencyLabel({ kind: 'perWeek', times: 2 }), 'Twice a week');
  assert.equal(text.canonTimeLabel('00:15'), '12:15 AM');
  assert.equal(text.canonTimeLabel('13:05'), '1:05 PM');
  language = 'fr';
  assert.equal(text.canonGoalLabel({ kind: 'chapters', count: 3 }), '3 chapitres');
  assert.equal(text.canonTimeLabel('07:30'), '7 h 30');
  assert.equal(text.canonFrequencyLabel({ kind: 'perWeek', times: 3 }), '3 fois par semaine');
  language = 'ar';
  assert.equal(text.canonGoalLabel({ kind: 'psalms', count: 1 }), 'مزمور واحد');
  assert.equal(text.canonGoalLabel({ kind: 'psalms', count: 2 }), 'مزموران');
  assert.equal(text.canonGoalLabel({ kind: 'psalms', count: 6 }), '٦ مزامير');
  assert.equal(text.canonGoalLabel({ kind: 'psalms', count: 11 }), '١١ مزمورًا');
  assert.equal(text.canonGoalLabel({ kind: 'chapters', count: 3 }), '٣ إصحاحات');
  assert.equal(text.canonGoalLabel({ kind: 'verses', count: 2 }), 'آيتان');
  assert.equal(text.canonGoalLabel({ kind: 'metanias', count: 50 }), '٥٠ مطانية');
  assert.equal(text.canonGoalLabel({ kind: 'metanias', count: 7 }), '٧ مطانيات');
  assert.equal(text.canonGoalLabel({ kind: 'verses', count: 15 }), '١٥ آية');
  assert.equal(text.canonTimeLabel('18:00'), '٦:٠٠ م');
  assert.equal(text.weeklyProgressLabel(1, 3), '١ من ٣ هذا الأسبوع');
});

test('the account keeps the canon in its own rows only, and the app is wired to it', () => {
  const migration = read('supabase/migrations/20261018120000_spiritual_canon.sql');
  for (const table of ['spiritual_canons', 'spiritual_canon_days']) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security;`));
    assert.match(migration, new RegExp(`revoke all on table public\\.${table} from anon, authenticated;`));
    for (const action of ['select', 'insert', 'update', 'delete']) {
      assert.match(migration, new RegExp(`create policy ${table}_${action}_own\\non public\\.${table} for ${action}\\nto authenticated`));
    }
  }
  assert.match(migration, /primary key \(user_id, day\)/);
  const layout = read('src/app/_layout.tsx');
  assert.match(layout, /<ReadingPreferencesProvider>\n\s+<SpiritualCanonProvider>/);
  const service = read('src/services/spiritualCanonService.ts');
  assert.match(service, /upsert\(rows, \{ onConflict: 'user_id,day' \}\)/);
  assert.match(service, /\}, \{ onConflict: 'user_id' \}\);/);
  // Signed out and each account each have a copy of their own on the device.
  assert.match(service, /function storageKey\(identity: string\)/);
});

test('reminders touch only the canon’s own notifications and open the task’s page', () => {
  const reminders = read('src/services/canonReminders.ts');
  assert.match(reminders, /const PREFIX = 'canon_';/);
  assert.equal((reminders.match(/cancelScheduledNotificationAsync/g) || []).length, 4);
  assert.equal((reminders.match(/request\.identifier\.startsWith\(PREFIX\)/g) || []).length, 3);
  assert.match(reminders, /data: \{ deep_link: content\.deepLink, canon: true/);
  assert.match(reminders, /type: Notifications\.SchedulableTriggerInputTypes\.DATE,/);
  const provider = read('src/context/SpiritualCanonContext.tsx');
  assert.match(provider, /deepLink: canonTaskRoute\(occurrence\.task\)/);
  assert.match(provider, /if \(!remindersEnabled \|\| !canonHasReminders\(document\.items\)\) \{\n\s+void clearCanonReminders\(\)/);
  // A day still to come is never ticked.
  assert.match(provider, /if \(day > canonDayKey\(new Date\(\)\)\) return;/);
});

test('Home shows today’s canon in every layout, under the prayer of the hour', () => {
  const home = read('src/components/vine/screens/HomeScreen.tsx');
  assert.equal((home.match(/\{prayCard\}\n\s+\{canonCard\}/g) || []).length, 3);
  assert.match(home, /onToggle=\{\(done\) => canon\.setTaskDone\(canon\.today, task\.key, done\)\}/);
  assert.match(home, /router\.push\('\/canon\/edit' as never\)/);
  // The tick and the way into the prayer are side by side, never one inside the other (a button may not hold a button on the web).
  const parts = read('src/components/canon/CanonParts.tsx');
  assert.match(parts, /<CanonCheck done=\{task\.done\} disabled=\{disabled\} label=\{checkLabel\} onPress=\{\(\) => onToggle\(!task\.done\)\} \/>\n\s+\{opens \? \(/);
});

test('rescheduling keeps what is unchanged, replaces what moved, and never touches other notifications', async () => {
  const scheduled = [
    { identifier: 'server-push-1', content: { data: {} } },
    { identifier: 'canon_keep', content: { data: { signature: 'SIG-keep' } } },
    { identifier: 'canon_stale', content: { data: { signature: 'old' } } },
    { identifier: 'canon_moved', content: { data: { signature: 'old' } } },
  ];
  const calls = { cancelled: [], added: [] };
  let granted = true;
  const Notifications = {
    SchedulableTriggerInputTypes: { DATE: 'date' },
    getPermissionsAsync: async () => ({ granted }),
    getAllScheduledNotificationsAsync: async () => scheduled,
    cancelScheduledNotificationAsync: async (id) => { calls.cancelled.push(id); },
    scheduleNotificationAsync: async (request) => { calls.added.push(request); return request.identifier; },
  };
  const reminders = load('src/services/canonReminders.ts', {
    'react-native': { Platform: { OS: 'ios' } },
    '@/services/notificationService': { LOCAL_NOTIFICATION_CHANNEL_ID: 'chc-default' },
    'expo-notifications': Notifications,
  });
  const at = new Date('2026-10-19T11:00:00.000Z');
  const occurrence = (identifier) => ({ identifier, day: '2026-10-19', at, task: { key: identifier } });
  const describe = (entry) => ({ title: 'The First Hour', body: 'Your spiritual canon', deepLink: '/agpeya/first_hour', identifier: entry.identifier });
  const signatureOf = `${at.getTime()}|The First Hour|Your spiritual canon|/agpeya/first_hour`;
  scheduled[1].content.data.signature = signatureOf;

  assert.equal(await reminders.scheduleCanonReminders([occurrence('canon_keep'), occurrence('canon_moved'), occurrence('canon_new')], describe), 'scheduled');
  assert.deepEqual(calls.cancelled.sort(), ['canon_moved', 'canon_stale']);
  assert.deepEqual(calls.added.map((request) => request.identifier).sort(), ['canon_moved', 'canon_new']);
  const added = calls.added[0];
  assert.deepEqual(added.trigger, { type: 'date', date: at, channelId: 'chc-default' });
  assert.equal(added.content.data.deep_link, '/agpeya/first_hour');
  assert.equal(added.content.data.signature, signatureOf);

  // Without permission, the canon's are taken off (the system would not show them) and nothing is added.
  calls.cancelled = [];
  calls.added = [];
  granted = false;
  assert.equal(await reminders.scheduleCanonReminders([occurrence('canon_new')], describe), 'permission_required');
  assert.deepEqual(calls.cancelled.sort(), ['canon_keep', 'canon_moved', 'canon_stale']);
  assert.deepEqual(calls.added, []);
  // The web schedules nothing.
  const web = load('src/services/canonReminders.ts', {
    'react-native': { Platform: { OS: 'web' } },
    '@/services/notificationService': { LOCAL_NOTIFICATION_CHANNEL_ID: 'chc-default' },
  });
  assert.equal(await web.scheduleCanonReminders([occurrence('canon_new')], describe), 'unsupported');
});

test('the Bible is measured in chapters, verses, time, or not at all; verses step by ones, then fives', () => {
  assert.deepEqual([...canon.GOAL_KINDS.bible], ['none', 'chapters', 'verses', 'minutes']);
  assert.deepEqual(canon.normalizeCanonGoal({ kind: 'verses', count: 20 }, 'bible'), { kind: 'verses', count: 20 });
  assert.deepEqual(canon.normalizeCanonGoal({ kind: 'verses', count: 9000 }, 'bible'), { kind: 'verses', count: 500 });
  // Verses are the Bible's measure only.
  assert.deepEqual(canon.normalizeCanonGoal({ kind: 'verses', count: 5 }, 'agpeya', 'first_hour'), { kind: 'none' });
  const up = (value) => canon.canonGoalStep('verses', value, true);
  const down = (value) => canon.canonGoalStep('verses', value, false);
  assert.deepEqual([1, 9, 10, 12, 15, 495, 500].map(up), [2, 10, 15, 15, 20, 500, 500]);
  assert.deepEqual([1, 2, 10, 12, 15, 20].map(down), [1, 1, 9, 10, 10, 15]);
  assert.equal(canon.canonGoalStep('chapters', 3, true), 4);
  assert.equal(canon.canonGoalStep('minutes', 5, false), 5);
});

test('metanias are kept on the days they are made: not on Saturdays, Sundays or feasts, as the calendar says', () => {
  const item = canon.newCanonItem('metania');
  assert.deepEqual(item.frequency, { kind: 'applicable' });
  assert.deepEqual(item.goal, { kind: 'metanias', count: 10 });
  // Before the calendar is read, a weekday is assumed to be one (a feast is not yet known)…
  const week = ['2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24'];
  const asked = (calendar) => week.filter((day) => canon.canonTasksForDay(doc([item]), day, calendar).length);
  assert.deepEqual(asked(undefined), week.slice(1, 6));
  // …and the calendar then has the last word: a feast on the Wednesday takes it away.
  const calendar = { metaniaDay: (day) => (day === '2026-10-21' ? { applicable: false, fasting: false } : null) };
  assert.deepEqual(asked(calendar), ['2026-10-19', '2026-10-20', '2026-10-22', '2026-10-23']);
  // The days the reminders go out on follow the same calendar.
  const reminding = { ...item, time: '07:00', remind: true };
  const days = canon.upcomingCanonReminders(doc([reminding]), new Date(2026, 9, 18, 8, 0), { horizonDays: 7, calendar }).map((entry) => entry.day);
  assert.deepEqual(days, ['2026-10-19', '2026-10-20', '2026-10-22', '2026-10-23']);
  // "All applicable days" belongs to metanias; read back on anything else it is every day.
  assert.deepEqual(canon.normalizeCanonFrequency({ kind: 'applicable' }, 'bible'), { kind: 'daily' });
  assert.deepEqual(canon.normalizeCanonFrequency(undefined, 'metania'), { kind: 'applicable' });
  assert.deepEqual([...canon.FREQUENCY_KINDS.metania], ['applicable', 'fastingDays', 'daily', 'weekdays', 'perWeek']);
  assert.deepEqual(canon.normalizeCanonFrequency({ kind: 'fastingDays' }, 'metania'), { kind: 'fastingDays' });
  assert.deepEqual(canon.normalizeCanonFrequency({ kind: 'fastingDays' }, 'custom'), { kind: 'daily' });
  assert.equal(canon.normalizeCanonItem({ ...item, goal: { kind: 'metanias', count: 5000 } }).goal.count, 1000);
  assert.equal(canon.canonTaskRoute({ kind: 'metania', hourId: null }), '/canon');
  // Counted one at a time, whatever the count: any number can be chosen.
  const up = (value) => canon.canonGoalStep('metanias', value, true);
  const down = (value) => canon.canonGoalStep('metanias', value, false);
  assert.deepEqual([1, 9, 10, 11, 47, 100, 999, 1000].map(up), [2, 10, 11, 12, 48, 101, 1000, 1000]);
  assert.deepEqual([1, 2, 10, 11, 48, 101].map(down), [1, 1, 9, 10, 47, 100]);
  assert.equal(canon.GOAL_LIMITS.metanias.initial, 10);
});

test('the metania rule reads the day’s own flags, by the same engine the books are read with', async () => {
  assert.equal(canon.METANIA_CONDITION, '!(Feasts || Weekends)');
  const engine = load('src/utils/conditionEngine.js', {
    './dateUtils': { toIsoDate: (value) => String(value).slice(0, 10) },
    '../services/contentDataClient': { contentDataClient: {} },
  });
  const made = (flags) => engine.evaluateCondition(canon.METANIA_CONDITION, flags);
  assert.equal(made({ Weekdays: true }), true); // an ordinary Tuesday
  assert.equal(made({ Weekends: true, Sunday: true }), false);
  assert.equal(made({ Feasts: true, GreatFeasts: true }), false); // a feast
  assert.equal(made({ Feasts: true, Weekdays: true }), false); // a feast on a weekday
  assert.equal(canon.METANIA_FASTING_CONDITION, '!(Feasts || Weekends) && Fasts');
  const fasting = (flags) => engine.evaluateCondition(canon.METANIA_FASTING_CONDITION, flags);
  assert.equal(fasting({ Weekdays: true }), false); // not a fasting day
  assert.equal(fasting({ Weekdays: true, Fasts: true, NormalFastingDays: true }), true); // a Wednesday
  assert.equal(fasting({ Weekdays: true, Fasts: true, GreatFast: true }), true); // a weekday of Great Lent
  assert.equal(fasting({ Weekends: true, Fasts: true }), false);
  assert.equal(fasting({ Feasts: true, Fasts: true }), false);
  const calendarSource = read('src/services/canonCalendar.ts');
  // The day itself: not CalendarContext's date (the Books screen's), no evening rollover.
  assert.match(calendarSource, /const flags = await getContextFlags\(day\);\n\s+return \{\n\s+applicable: Boolean\(evaluateCondition\(METANIA_CONDITION, flags\)\),\n\s+fasting: Boolean\(evaluateCondition\(METANIA_FASTING_CONDITION, flags\)\),/);
  assert.doesNotMatch(calendarSource, /CalendarContext|useCalendar/);
});

test('the time of day is set on wheels: the system’s own on iOS, scrolling columns elsewhere', () => {
  const ios = read('src/components/canon/TimeWheel.ios.tsx');
  assert.match(ios, /<Host colorScheme="dark" style=\{styles\.host\}>/);
  assert.match(ios, /displayedComponents=\{\['hourAndMinute'\]\}/);
  assert.match(ios, /modifiers=\{\[datePickerStyle\('wheel'\), labelsHidden\(\)/);
  const wheel = read('src/components/canon/TimeWheel.tsx');
  assert.match(wheel, /snapToInterval=\{ROW\}/);
  assert.match(wheel, /scrollSnapType: 'y mandatory'/);
  assert.match(wheel, /accessibilityRole="adjustable"/);
  const parts = read('src/components/canon/CanonEditorParts.tsx');
  // Turning a wheel never drags the sheet closed.
  assert.match(parts, /dialogWidth=\{400\} scroll=\{false\}>/);
  assert.doesNotMatch(parts, /const MINUTES = /);
});

test('metanias on fasting days only: the calendar’s fasting days that are not weekends or feasts', () => {
  const item = { ...canon.newCanonItem('metania'), frequency: { kind: 'fastingDays' } };
  const week = ['2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24'];
  const asked = (calendar) => week.filter((day) => canon.canonTasksForDay(doc([item]), day, calendar).length);
  // A fasting day is never assumed: before the calendar is read, none is asked.
  assert.deepEqual(asked(undefined), []);
  const flags = { '2026-10-21': { applicable: true, fasting: true }, '2026-10-23': { applicable: true, fasting: true } };
  const calendar = { metaniaDay: (day) => flags[day] ?? { applicable: canon.provisionalMetaniaDay(day), fasting: false } };
  assert.deepEqual(asked(calendar), ['2026-10-21', '2026-10-23']);
  assert.equal(canon.keptByCalendar(item.frequency), true);
  assert.equal(canon.keptByCalendar({ kind: 'daily' }), false);
});
