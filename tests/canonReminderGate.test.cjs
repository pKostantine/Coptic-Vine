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
  new Function('exports', 'require', 'module', output)(moduleObject.exports, (id) => {
    if (id in stubs) return stubs[id];
    throw new Error(`unexpected require: ${id}`);
  }, moduleObject);
  return moduleObject.exports;
}

const reminder = (extra = {}) => ({ canon: true, day: '2026-11-12', taskKey: 'agpeya-1:twelfth_hour', identity: 'local', ...extra });

test('a canon reminder is not wanted once its task is ticked off or skipped', () => {
  const gate = load('src/services/canonReminderGate.ts');
  // No canon running to ask: it stands.
  assert.equal(gate.canonReminderStillWanted(reminder()), true);
  const settled = new Set(['2026-11-12|agpeya-1:twelfth_hour']);
  gate.setCanonOpenTaskCheck((day, key, identity) => identity !== 'local' || !settled.has(`${day}|${key}`));
  assert.equal(gate.canonReminderStillWanted(reminder()), false);
  assert.equal(gate.canonReminderStillWanted(reminder({ snoozed: true })), false, 'put off an hour, too');
  assert.equal(gate.canonReminderStillWanted(reminder({ day: '2026-11-13' })), true, 'another day');
  assert.equal(gate.canonReminderStillWanted(reminder({ identity: 'user-2' })), true, "another account's canon");
  assert.equal(gate.canonReminderStillWanted({ deep_link: '/' }), true, 'not a canon reminder');
  assert.equal(gate.canonReminderStillWanted(undefined), true);
  gate.setCanonOpenTaskCheck(null);
  assert.equal(gate.canonReminderStillWanted(reminder()), true);
});

test('the canon says which tasks are settled; the handler hides their reminders; rescheduling drops their put-off ones', () => {
  const context = read('src/context/SpiritualCanonContext.tsx');
  assert.match(context, /setCanonOpenTaskCheck\(\(day, key, forIdentity\) => \{[\s\S]*canonSkippedTasksForDay[\s\S]*task\.done/);
  assert.match(context, /return \(\) => setCanonOpenTaskCheck\(null\);/);
  const handler = read('src/services/notificationService.ts');
  assert.match(handler, /handleNotification: async \(notification\) => \{\s*const show = canonReminderStillWanted\(notification\.request\.content\.data/);
  assert.match(handler, /shouldPlaySound: show, shouldSetBadge: false, shouldShowBanner: show, shouldShowList: show/);
  const reminders = read('src/services/canonReminders.ts');
  assert.match(reminders, /startsWith\(CANON_SNOOZE_PREFIX\)\s*&& !canonReminderStillWanted\(/);
  // Ticked or skipped in the app, a task's reminders go at once.
  assert.match(context, /if \(done\) void cancelCanonRemindersFor\(day, key\)/);
  assert.match(context, /if \(skipped\) void cancelCanonRemindersFor\(day, key\)/);
});

test('rescheduling cancels a reminder put off an hour once its task is settled, and keeps one still open', async () => {
  const scheduled = [
    { identifier: 'canonsnooze_2026_11_12_done', content: { data: reminder({ taskKey: 'done', snoozed: true }) } },
    { identifier: 'canonsnooze_2026_11_12_open', content: { data: reminder({ taskKey: 'open', snoozed: true }) } },
    { identifier: 'server-push-1', content: { data: {} } },
  ];
  const cancelled = [];
  const Notifications = {
    SchedulableTriggerInputTypes: { DATE: 'date' },
    getPermissionsAsync: async () => ({ granted: true }),
    getAllScheduledNotificationsAsync: async () => scheduled,
    cancelScheduledNotificationAsync: async (id) => { cancelled.push(id); },
    scheduleNotificationAsync: async (request) => request.identifier,
  };
  const gate = load('src/services/canonReminderGate.ts');
  gate.setCanonOpenTaskCheck((_day, key) => key !== 'done');
  const reminders = load('src/services/canonReminders.ts', {
    'react-native': { Platform: { OS: 'ios' } },
    '@/services/notificationService': { LOCAL_NOTIFICATION_CHANNEL_ID: 'cv-default' },
    '@/services/canonReminderGate': gate,
    'expo-notifications': Notifications,
  });
  assert.equal(await reminders.scheduleCanonReminders([], () => ({}), 'local'), 'scheduled');
  assert.deepEqual(cancelled, ['canonsnooze_2026_11_12_done']);
});
