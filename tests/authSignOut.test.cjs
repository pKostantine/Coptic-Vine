const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');
const React = require('react');
const { renderToString } = require('react-dom/server');
const { AuthApiError, AuthRetryableFetchError } = require('@supabase/supabase-js');

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
 * AuthContext over the Supabase backend (src/services/accountAuth.ts), with
 * everything around them stubbed, and the provider rendered once
 * (server-side, which runs its memoized callbacks but no effects) so its
 * `signOut` can be called with a chosen answer from the auth client.
 */
function signOutWith(signOutResult) {
  const preferences = { getCurrentAppLanguage: () => 'en' };
  const appText = load('src/utils/appText.ts', { './preferencesStorage': preferences });
  const authMessages = load('src/utils/authMessages.ts', { './appText': appText });
  const settleWithin = load('src/utils/settleWithin.ts');
  const reactNative = { Platform: { OS: 'web' } };
  const webBrowser = { maybeCompleteAuthSession() {}, openAuthSessionAsync: async () => ({ type: 'cancel' }) };
  const { accountAuth } = load('src/services/accountAuth.ts', {
    'react-native': reactNative,
    'expo-web-browser': webBrowser,
    '@/services/userApi': { cvApiAuth: null },
    '@/utils/authMessages': authMessages,
    '@/utils/supabase': {
      supabase: {
        auth: {
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
          getSession: async () => ({ data: { session: null }, error: null }),
          signOut: async () => signOutResult,
        },
      },
    },
  });
  const { AuthProvider, useAuth } = load('src/context/AuthContext.tsx', {
    'react-native': reactNative,
    'expo-linking': { createURL: (path) => `https://copticvine.ca/${path}`, getInitialURL: async () => null, addEventListener: () => ({ remove() {} }) },
    'expo-web-browser': webBrowser,
    '@/services/accountAuth': { accountAuth },
    '@/services/notificationService': { disableNativeNotificationDevice: async () => {} },
    '@/services/webPushService': { disableWebPushDevice: async () => {} },
    '@/utils/settleWithin': settleWithin,
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

test('signing out with no connection still counts as signed out', async () => {
  // The auth client removes this device's session before it reports that the
  // server could not be reached, so the device is signed out; raising the
  // network error would only tell the reader it had failed.
  await signOutWith({ error: new AuthRetryableFetchError('Failed to fetch', 0) })();
});

test('signing out reports any other failure', async () => {
  await assert.rejects(signOutWith({ error: new AuthApiError('server exploded', 500, 'unexpected_failure') })(), /server exploded/);
});

test('signing out without any error resolves', async () => {
  await signOutWith({ error: null })();
});
