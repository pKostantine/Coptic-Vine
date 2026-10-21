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
    '@/services/accountAuth': { accountAuth: { getUser: async () => (signedIn ? { id: 'user-1' } : null) } },
    '@/utils/supabase': {
      supabase: {
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
  // Signed out, the device is asked and registers with no account: what is sent to everyone reaches it.
  const signedOut = device({ signedIn: false });
  assert.equal(await signedOut.service.requestNotificationsOnFirstLaunch(), 'registered');
  assert.equal(signedOut.calls.asked, 1);
  assert.deepEqual(signedOut.calls.registered, [{ name: 'register_notification_device', token: 'ExponentPushToken[test]' }]);
});

test('signing out registers the install again with no account; signing in moves it to the account', () => {
  const bootstrap = read('src/components/NotificationBootstrap.tsx');
  assert.equal((bootstrap.match(/if \(!session && event !== 'SIGNED_OUT'\) return;/g) || []).length, 2);
  // Neither service turns a signed-out device away any longer.
  assert.doesNotMatch(read('src/services/notificationService.ts'), /return 'signed_out' as const/);
  assert.doesNotMatch(read('src/services/webPushService.ts'), /if \(!user\) return 'signed_out';/);
});

test('the app asks a moment after it appears, from the bootstrap that registers the device', () => {
  const bootstrap = read('src/components/NotificationBootstrap.tsx');
  assert.match(bootstrap, /const FIRST_LAUNCH_ASK_DELAY_MS = 1200;/);
  assert.match(bootstrap, /const firstLaunchAsk = setTimeout\(\(\) => \{\n\s+void requestNotificationsOnFirstLaunch\(\)/);
  assert.match(bootstrap, /clearTimeout\(firstLaunchAsk\);/);
  // Only the native branch asks; the web returns before it.
  assert.ok(bootstrap.indexOf("if (Platform.OS === 'web')") < bootstrap.indexOf('requestNotificationsOnFirstLaunch()'));
});

test('broadcasts reach installs with no account, and only Expo tokens can be registered signed out', () => {
  const migration = read('supabase/migrations/20261018210000_notifications_reach_every_install.sql');
  assert.match(migration, /alter table public\.notification_devices alter column user_id drop not null;/);
  assert.match(migration, /if v_user_id is null and p_app_key <> 'chc' then\n\s+raise exception 'authentication_required';/);
  assert.match(migration, /if p_push_token !~ '\^Expo\(nent\)\?PushToken\\\[\[A-Za-z0-9_-\]\{8,\}\\\]\$' then/);
  assert.match(migration, /grant execute on function public\.register_notification_device\(text,text,text,text,jsonb,text,text\) to anon, authenticated, service_role;/);
  // Both claims read the message from the inbox notification or the broadcast.
  assert.equal((migration.match(/left join public\.notification_broadcasts b on b\.id = c\.broadcast_id/g) || []).length, 2);
  // An account's opt-out still holds; an install with no account has none to make.
  assert.match(migration, /d\.user_id is null\n\s+or not exists \(/);
  // The test send goes to the admin's own devices only.
  assert.match(migration, /where d\.user_id = v_user_id and d\.app_key = 'chc' and d\.enabled = true and d\.provider in \('expo','web_push'\)\n\s+on conflict do nothing;/);
});
