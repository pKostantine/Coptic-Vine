import { Platform } from 'react-native';

import { api } from '@/utils/api';
import { moveLegacyStorageKey } from '@/utils/legacyNames';

export type WebPushSyncResult =
  | 'registered'
  | 'permission_required'
  | 'denied'
  | 'signed_out'
  | 'unsupported'
  | 'unconfigured';

const APP_KEY = 'chc';
const PROVIDER = 'web_push';
const LAST_ENDPOINT_KEY = '@cv/notification-token/web';
// Its name in earlier builds (utils/legacyNames.ts).
const LEGACY_LAST_ENDPOINT_KEY = '@chc/notification-token/chc-web';

/** Where the endpoint last registered is kept, with what an earlier build kept moved there. */
function endpointStore() {
  moveLegacyStorageKey(LEGACY_LAST_ENDPOINT_KEY, LAST_ENDPOINT_KEY);
  return globalThis.localStorage;
}

function vapidPublicKey() {
  return process.env.EXPO_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY || '';
}

function isWindows() {
  return typeof navigator !== 'undefined' && /Windows/i.test(navigator.userAgent);
}

export async function syncWebPushDevice(options: {
  requestPermission?: boolean;
} = {}): Promise<WebPushSyncResult> {
  if (
    Platform.OS !== 'web'
    || typeof window === 'undefined'
    || typeof navigator === 'undefined'
    || !('serviceWorker' in navigator)
    || !('PushManager' in window)
    || typeof Notification === 'undefined'
  ) {
    return 'unsupported';
  }

  const publicKey = vapidPublicKey();
  if (!publicKey) return 'unconfigured';

  // Signed in or not: a browser with no account still receives what CV Admin sends to everyone.
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission === 'default' && !options.requestPermission) {
    return 'permission_required';
  }

  // Registered at the same scope, it takes the place of chc-notification-sw.js, which earlier builds registered; the subscription stays.
  await navigator.serviceWorker.register('/cv-notification-sw.js');

  const { subscribe } = await import('@mmmike/web-push/client');
  const result = await subscribe(publicKey);
  if (result.status === 'unsupported') return 'unsupported';
  if (result.status === 'denied') return 'denied';

  const subscription = result.subscription;
  const { error } = await api.rpc('register_notification_device', {
    p_app_key: APP_KEY,
    p_platform: isWindows() ? 'windows' : 'web',
    p_provider: PROVIDER,
    p_push_token: subscription.endpoint,
    p_provider_data: subscription,
    p_device_name: null,
    p_app_version: null,
  });
  if (error) throw new Error('Register web notifications: ' + error.message);

  endpointStore()?.setItem(LAST_ENDPOINT_KEY, subscription.endpoint);
  return 'registered';
}

export async function disableWebPushDevice(): Promise<void> {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return;

  const endpoint = endpointStore()?.getItem(LAST_ENDPOINT_KEY);
  if (endpoint) {
    const { error } = await api.rpc('disable_notification_device', {
      p_app_key: APP_KEY,
      p_provider: PROVIDER,
      p_push_token: endpoint,
    });
    if (error) throw new Error('Disable web notifications: ' + error.message);
  }

  if ('serviceWorker' in navigator) {
    try {
      // getRegistration() resolves with undefined when this page has no
      // service worker. `ready` does not: with nothing registered it stays
      // pending for the life of the page rather than rejecting, so awaiting it
      // here hung sign-out for everyone who had never enabled notifications --
      // the one path that registers the worker (syncWebPushDevice) only runs
      // after permission is granted.
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      await subscription?.unsubscribe();
    } catch (error) {
      console.warn('Unable to unsubscribe the browser push subscription:', error);
    }
  }

  endpointStore()?.removeItem(LAST_ENDPOINT_KEY);
}
