const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');

const read = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

function load(path, stubs) {
  const moduleObject = { exports: {} };
  const output = ts.transpileModule(read(path), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('exports', 'require', 'module', output)(
    moduleObject.exports,
    (id) => {
      if (id in stubs) return stubs[id];
      throw new Error(`unexpected require: ${id}`);
    },
    moduleObject,
  );
  return moduleObject.exports;
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** The actions module on a device: notifications, the task manager and the file system, all in memory. */
function device({ platform = 'ios', lastResponse = null } = {}) {
  const files = new Map();
  const calls = { dismissed: [], scheduled: [], categories: [], tasksRegistered: [], cancelledFor: [] };
  let listener = null;
  let task = null;
  const Notifications = {
    SchedulableTriggerInputTypes: { DATE: 'date' },
    addNotificationResponseReceivedListener: (fn) => { listener = fn; return { remove() {} }; },
    getLastNotificationResponseAsync: async () => lastResponse,
    dismissNotificationAsync: async (id) => { calls.dismissed.push(id); },
    scheduleNotificationAsync: async (request) => { calls.scheduled.push(request); return request.identifier; },
    setNotificationCategoryAsync: async (id, actions) => { calls.categories.push({ id, actions }); },
    registerTaskAsync: async (name) => { calls.tasksRegistered.push(name); },
  };
  const TaskManager = {
    defineTask: (name, executor) => { task = { name, executor }; },
    isTaskRegisteredAsync: async (name) => calls.tasksRegistered.includes(name),
  };
  const FileSystem = {
    documentDirectory: 'file:///docs/',
    getInfoAsync: async (uri) => ({ exists: files.has(uri) }),
    readAsStringAsync: async (uri) => files.get(uri),
    writeAsStringAsync: async (uri, text) => { files.set(uri, text); },
  };
  const actions = load('src/services/canonNotificationActions.ts', {
    'expo-notifications': Notifications,
    'expo-task-manager': TaskManager,
    'expo-file-system/legacy': FileSystem,
    'react-native': { Platform: { OS: platform } },
    '@/services/canonReminders': {
      CANON_ACTION_DONE: 'canon_done',
      CANON_ACTION_SNOOZE: 'canon_snooze',
      CANON_REMINDER_CATEGORY: 'canon_reminder',
      CANON_SNOOZE_PREFIX: 'canonsnooze_',
      cancelCanonRemindersFor: async (day, taskKey) => { calls.cancelledFor.push(`${day}/${taskKey}`); },
    },
    '@/services/notificationService': { LOCAL_NOTIFICATION_CHANNEL_ID: 'chc-default' },
  });
  return { actions, calls, files, listen: () => listener, task: () => task };
}

function response(actionIdentifier, overrides = {}) {
  return {
    actionIdentifier,
    notification: {
      date: 1760000000000,
      request: {
        identifier: 'canon_2026_10_19_agpeya_1_first_hour',
        content: {
          title: 'The First Hour',
          body: 'Your spiritual canon · 6 psalms',
          data: { canon: true, day: '2026-10-19', taskKey: 'agpeya-1:first_hour', identity: 'user-1', deep_link: '/agpeya/first_hour' },
          ...overrides,
        },
      },
    },
  };
}

test('the buttons are registered in the App Language, opening nothing, and Android gets its background task once', async () => {
  const ios = device();
  await ios.actions.registerCanonNotificationActions({ done: 'Mark as done', snooze: 'Remind me in an hour' });
  assert.deepEqual(ios.calls.categories, [{
    id: 'canon_reminder',
    actions: [
      { identifier: 'canon_done', buttonTitle: 'Mark as done', options: { opensAppToForeground: false } },
      { identifier: 'canon_snooze', buttonTitle: 'Remind me in an hour', options: { opensAppToForeground: false } },
    ],
  }]);
  assert.deepEqual(ios.calls.tasksRegistered, []);
  const android = device({ platform: 'android' });
  await android.actions.registerCanonNotificationActions({ done: 'a', snooze: 'b' });
  await android.actions.registerCanonNotificationActions({ done: 'a', snooze: 'b' });
  assert.deepEqual(android.calls.tasksRegistered, ['cv-canon-notification-actions']);
  assert.equal(android.task().name, 'cv-canon-notification-actions');
});

test('Mark as done queues the tick for its own canon, takes the notification and the day’s other reminders away, once', async () => {
  const { actions, calls } = device();
  let heard = 0;
  actions.onCanonDoneAction(() => { heard += 1; });
  assert.equal(await actions.handleCanonNotificationAction(response('canon_done')), true);
  assert.deepEqual(calls.dismissed, ['canon_2026_10_19_agpeya_1_first_hour']);
  assert.deepEqual(calls.cancelledFor, ['2026-10-19/agpeya-1:first_hour']);
  assert.equal(heard, 1);
  // The same press arriving another way (the last response at launch) counts once.
  assert.equal(await actions.handleCanonNotificationAction(response('canon_done')), false);
  assert.equal(heard, 1);
  // Another canon's ticks wait for it; this one's are taken, once.
  assert.deepEqual(await actions.takeCanonDoneActions('local'), []);
  const taken = await actions.takeCanonDoneActions('user-1');
  assert.deepEqual(taken.map((entry) => `${entry.identity} ${entry.day} ${entry.taskKey}`), ['user-1 2026-10-19 agpeya-1:first_hour']);
  assert.ok(!Number.isNaN(Date.parse(taken[0].at)));
  assert.deepEqual(await actions.takeCanonDoneActions('user-1'), []);
});

test('Remind me in an hour puts the same reminder off an hour, with its buttons, replacing an earlier put-off one', async () => {
  const { actions, calls } = device();
  const before = Date.now();
  assert.equal(await actions.handleCanonNotificationAction(response('canon_snooze')), true);
  const [again] = calls.scheduled;
  assert.equal(again.identifier, 'canonsnooze_2026_10_19_agpeya_1_first_hour');
  assert.equal(again.content.title, 'The First Hour');
  assert.equal(again.content.categoryIdentifier, 'canon_reminder');
  assert.equal(again.content.data.snoozed, true);
  assert.equal(again.content.data.identity, 'user-1');
  assert.equal(again.trigger.type, 'date');
  assert.equal(again.trigger.channelId, 'chc-default');
  const delay = again.trigger.date.getTime() - before;
  assert.ok(delay >= 60 * 60 * 1000 - 1000 && delay <= 60 * 60 * 1000 + 1000, `put off by ${delay} ms`);
  assert.deepEqual(calls.dismissed, ['canon_2026_10_19_agpeya_1_first_hour']);
  // Putting off ticks nothing.
  assert.deepEqual(await actions.takeCanonDoneActions('user-1'), []);
});

test('a tap, or any notification not the canon’s, is left to the rest of the app', async () => {
  const { actions, calls } = device();
  assert.equal(await actions.handleCanonNotificationAction(response('expo.modules.notifications.actions.DEFAULT')), false);
  assert.equal(await actions.handleCanonNotificationAction(response('canon_done', { data: { deep_link: '/music' } })), false);
  assert.deepEqual(calls.dismissed, []);
});

test('a press reaches the canon by every way: the listener, the press that started the app, and Android’s background task', async () => {
  const started = device({ lastResponse: response('canon_done') });
  await tick(); await tick(); await tick();
  assert.equal((await started.actions.takeCanonDoneActions('user-1')).length, 1);

  const running = device();
  running.listen()(response('canon_snooze'));
  await tick(); await tick(); await tick();
  assert.equal(running.calls.scheduled.length, 1);

  const headless = device({ platform: 'android' });
  await headless.task().executor({ data: response('canon_done'), error: null });
  assert.equal((await headless.actions.takeCanonDoneActions('user-1')).length, 1);
  // A task run that isn't a button press does nothing.
  await headless.task().executor({ data: { notification: null, data: {} }, error: null });
  assert.deepEqual(headless.calls.dismissed, ['canon_2026_10_19_agpeya_1_first_hour']);
});

test('the entry loads the buttons before the app; taps on buttons open nothing; the canon applies queued ticks', () => {
  const entry = read('index.ts');
  assert.ok(entry.indexOf("import './src/services/canonNotificationActions';") < entry.indexOf("import 'expo-router/entry';"));
  assert.match(read('package.json'), /"main": "index\.ts",/);
  const service = read('src/services/notificationService.ts');
  assert.match(service, /if \(response\.actionIdentifier !== defaultAction\) return null;/);
  assert.match(service, /if \(initialResponse && initialResponse\.actionIdentifier === Notifications\.DEFAULT_ACTION_IDENTIFIER\) \{/);
  const provider = read('src/context/SpiritualCanonContext.tsx');
  assert.match(provider, /for \(const action of await takeCanonDoneActions\(identity\)\) \{\n\s+document = withCanonMark\(document, action\.day, action\.taskKey, true, new Date\(action\.at\)\);\n\s+dirtyDays\.current\.add\(action\.day\);/);
  assert.match(provider, /const unsubscribe = onCanonDoneAction\(apply\);/);
  const reminders = read('src/services/canonReminders.ts');
  // Rescheduling leaves a put-off reminder be; finishing or clearing takes it too.
  assert.match(reminders, /const ours = scheduled\.filter\(\(request\) => request\.identifier\.startsWith\(PREFIX\)\);/);
  assert.equal((reminders.match(/isCanonReminder\(request\.identifier\)/g) || []).length, 2);
});
