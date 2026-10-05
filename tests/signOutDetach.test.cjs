const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');

function compile(path) {
  return ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}

function load(path, stubs = {}) {
  const moduleObject = { exports: {} };
  new Function('exports', 'require', 'module', compile(path))(
    moduleObject.exports,
    (id) => (id in stubs ? stubs[id] : require(id)),
    moduleObject,
  );
  return moduleObject.exports;
}

/**
 * A browser page with a service worker container but nothing registered, which
 * is what every visitor who has not granted notification permission has.
 * `calls` records which API the code under test reached for.
 */
function fakeBrowser() {
  const calls = { ready: 0, getRegistration: 0 };
  const serviceWorker = {
    // The spec's `ready` never settles when there is no active registration:
    // it does not reject, it simply stays pending for the life of the page.
    get ready() {
      calls.ready += 1;
      return new Promise(() => {});
    },
    getRegistration: async () => {
      calls.getRegistration += 1;
      return undefined;
    },
  };
  // Node has its own read-only `navigator`, so it has to be replaced outright
  // rather than assigned to, or the module sees no serviceWorker at all and
  // these tests pass without exercising anything.
  Object.defineProperty(globalThis, 'navigator', {
    value: { userAgent: 'Mozilla/5.0', serviceWorker },
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, 'localStorage', {
    value: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    configurable: true,
    writable: true,
  });
  return calls;
}

function loadWebPush() {
  return load('src/services/webPushService.ts', {
    'react-native': { Platform: { OS: 'web' } },
    '@/utils/supabase': { supabase: { rpc: async () => ({ error: null }) } },
  });
}

/** Rejects rather than hanging the whole run if the promise never settles. */
function within(promise, ms, what) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(what)), ms).unref?.()),
  ]);
}

test('detaching web push finishes when the page has no service worker', async () => {
  // The worker is only registered once notification permission is granted, so
  // for most people there is none. Awaiting serviceWorker.ready here left
  // sign-out pending forever with nothing shown to the user.
  const calls = fakeBrowser();
  const { disableWebPushDevice } = loadWebPush();
  await within(disableWebPushDevice(), 1000, 'disableWebPushDevice never settled');
  assert.equal(calls.getRegistration, 1, 'should have asked for the registration');
  assert.equal(calls.ready, 0, 'must not await serviceWorker.ready');
});

test('detaching web push unsubscribes when a worker is registered', async () => {
  const calls = fakeBrowser();
  const { disableWebPushDevice } = loadWebPush();
  let unsubscribed = false;
  globalThis.navigator.serviceWorker.getRegistration = async () => {
    calls.getRegistration += 1;
    return { pushManager: { getSubscription: async () => ({ unsubscribe: async () => { unsubscribed = true; } }) } };
  };
  await within(disableWebPushDevice(), 1000, 'disableWebPushDevice never settled');
  assert.equal(unsubscribed, true);
  assert.equal(calls.ready, 0, 'must not await serviceWorker.ready');
});

test('settleWithin gives up on work that never settles', async () => {
  const { settleWithin } = load('src/utils/settleWithin.ts');
  const warn = console.warn;
  console.warn = () => {};
  try {
    const started = Date.now();
    await within(settleWithin([new Promise(() => {})], 50, 'test'), 1000, 'settleWithin never settled');
    assert.ok(Date.now() - started >= 45, 'should have waited for its deadline');
  } finally {
    console.warn = warn;
  }
});

test('settleWithin swallows a rejection rather than failing the caller', async () => {
  const { settleWithin } = load('src/utils/settleWithin.ts');
  const warn = console.warn;
  const warnings = [];
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    await within(settleWithin([Promise.reject(new Error('nope'))], 500, 'detach'), 1000, 'settleWithin never settled');
    assert.ok(warnings.some((line) => line.includes('nope')), 'the rejection should be reported');
  } finally {
    console.warn = warn;
  }
});

test('settleWithin returns as soon as the work is done', async () => {
  const { settleWithin } = load('src/utils/settleWithin.ts');
  const started = Date.now();
  await within(settleWithin([Promise.resolve('ok')], 5000, 'detach'), 1000, 'settleWithin waited for its deadline');
  assert.ok(Date.now() - started < 500, 'should not have waited for the deadline');
});
