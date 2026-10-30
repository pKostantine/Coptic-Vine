const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');
const React = require('react');
const { renderToString } = require('react-dom/server');

function compile(path) {
  return ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
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
 * AuthContext with the account backend stubbed (src/services/accountAuth.ts is
 * cv-api's, whose own sign-out, offline included, workers/api's appAuth tests
 * cover), and the provider rendered once (server-side, which runs its
 * memoized callbacks but no effects) so its `signOut` can be called with a
 * chosen answer from the backend.
 */
function signOutWith(signOutError) {
  const settleWithin = load('src/utils/settleWithin.ts');
  const reactNative = { Platform: { OS: 'web' } };
  const webBrowser = { maybeCompleteAuthSession() {}, openAuthSessionAsync: async () => ({ type: 'cancel' }) };
  const accountAuth = {
    readsWebCallbacks: true,
    onChange: () => () => {},
    getSession: async () => null,
    signOut: async () => {
      if (signOutError) throw signOutError;
    },
  };
  const { AuthProvider, useAuth } = load('src/context/AuthContext.tsx', {
    'react-native': reactNative,
    'expo-linking': { createURL: (path) => `https://copticvine.ca/${path}`, getInitialURL: async () => null, addEventListener: () => ({ remove() {} }) },
    'expo-web-browser': webBrowser,
    '@/services/accountAuth': { accountAuth },
    '@/services/notificationService': { disableNativeNotificationDevice: async () => {} },
    '@/services/webPushService': { disableWebPushDevice: async () => {} },
    '@/utils/settleWithin': settleWithin,
    '@/utils/sessionCache': load('src/utils/sessionCache.ts'),
  });

  let signOut;
  function Probe() {
    signOut = useAuth().signOut;
    return null;
  }
  renderToString(React.createElement(AuthProvider, null, React.createElement(Probe)));
  assert.equal(typeof signOut, 'function');
  return signOut;
}

test('signing out reports a failure from the backend', async () => {
  await assert.rejects(signOutWith(new Error('server exploded'))(), /server exploded/);
});

test('signing out without any error resolves', async () => {
  await signOutWith(null)();
});
