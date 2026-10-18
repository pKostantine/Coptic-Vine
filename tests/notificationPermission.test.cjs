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

function device({ platform = 'ios', status = 'undetermined', signedIn = true } = {}) {
  const calls = { asked: 0, registered: [] };
  let permission = status;
  const Notifications = {
    AndroidImportance: { MAX: 5 },
    setNotificationHandler: () => undefined,
    setNotificationChannelAsync: async () => undefined,
    getPermissionsAsync: async () => ({ granted: permission === 'granted', canAskAgain: permission === 'undetermined' }),
    requestPermissionsAsync: async () => {
      calls.asked += 1;
      permission = 'granted';
      return { granted: true, canAskAgain: false };
    },
    getExpoPushTokenAsync: async () => ({ data: 'ExponentPushToken[test]' }),
  };
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
  const service = load('src/services/notificationService.ts', {
    'expo-constants': { __esModule: true, default: { expoConfig: { version: '1.0.0', extra: { eas: { projectId: 'project-1' } } } } },
    'react-native': { Platform: { OS: platform } },
    'expo-notifications': Notifications,
    '@/utils/supabase': {
      supabase: {
        auth: { getUser: async () => ({ data: { user: signedIn ? { id: 'user-1' } : null }, error: null }) },
        rpc: async (name, args) => {
          calls.registered.push({ name, token: args.p_push_token });
          return { error: null };
        },
      },
    },
  });
  return { service, calls };
}

test('the first launch on a device asks to send notifications, and registers the device once allowed', async () => {
  const { service, calls } = device();
  assert.equal(await service.requestNotificationsOnFirstLaunch(), 'registered');
  assert.equal(calls.asked, 1);
  assert.deepEqual(calls.registered, [{ name: 'register_notification_device', token: 'ExponentPushToken[test]' }]);
  // Never again on that device, whatever the answer was.
  assert.equal(await service.requestNotificationsOnFirstLaunch(), 'already_asked');
  assert.equal(calls.asked, 1);
});

test('a device whose answer is already given is not asked again, and the web is never asked here', async () => {
  const allowed = device({ status: 'granted' });
  assert.equal(await allowed.service.requestNotificationsOnFirstLaunch(), 'registered');
  assert.equal(allowed.calls.asked, 0);
  const declined = device({ status: 'denied' });
  assert.equal(await declined.service.requestNotificationsOnFirstLaunch(), 'permission_required');
  assert.equal(declined.calls.asked, 0);
  const web = device({ platform: 'web' });
  assert.equal(await web.service.requestNotificationsOnFirstLaunch(), 'unsupported');
  assert.equal(web.calls.asked, 0);
  // Signed out, the answer is still asked for; the device registers when someone signs in.
  const signedOut = device({ signedIn: false });
  assert.equal(await signedOut.service.requestNotificationsOnFirstLaunch(), 'signed_out');
  assert.equal(signedOut.calls.asked, 1);
});

test('the app asks a moment after it appears, from the bootstrap that registers the device', () => {
  const bootstrap = read('src/components/NotificationBootstrap.tsx');
  assert.match(bootstrap, /const FIRST_LAUNCH_ASK_DELAY_MS = 1200;/);
  assert.match(bootstrap, /const firstLaunchAsk = setTimeout\(\(\) => \{\n\s+void requestNotificationsOnFirstLaunch\(\)/);
  assert.match(bootstrap, /clearTimeout\(firstLaunchAsk\);/);
  // Only the native branch asks; the web returns before it.
  assert.ok(bootstrap.indexOf("if (Platform.OS === 'web')") < bootstrap.indexOf('requestNotificationsOnFirstLaunch()'));
});
