import Constants from 'expo-constants';
import type { DevicePushToken, NotificationResponse } from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from '@/utils/supabase';

export type NotificationPreferenceMap = Record<string, boolean>;
export type NotificationSyncResult = 'registered' | 'permission_required' | 'signed_out' | 'unsupported' | 'unconfigured';

const APP_KEY = 'chc';
const PROVIDER = 'expo';
const CHANNEL_ID = 'chc-default';
const LAST_TOKEN_KEY = '@chc/notification-token/chc';
/** Set once this device has been asked to allow notifications on its first launch. */
const FIRST_LAUNCH_ASKED_KEY = '@chc/notification-permission-asked/chc';

let handlerConfigured = false;

function storage() {
  return typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage;
}

function projectId() {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? undefined;
}

async function notificationModule() {
  if (Platform.OS === 'web') return null;
  return import('expo-notifications');
}

async function prepareNativeNotifications(requestPermission: boolean) {
  const Notifications = await notificationModule();
  if (!Notifications) return { Notifications: null, granted: false };

  if (!handlerConfigured) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    handlerConfigured = true;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Coptic Vine',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
    });
  }

  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && requestPermission && permission.canAskAgain) {
    permission = await Notifications.requestPermissionsAsync();
  }

  return { Notifications, granted: permission.granted };
}

export type LocalNotificationPermission = 'granted' | 'denied' | 'undetermined' | 'unsupported';

/** The Android channel local notifications (the canon's reminders) are sent on. */
export const LOCAL_NOTIFICATION_CHANNEL_ID = CHANNEL_ID;

/**
 * Whether this device may show the app's own scheduled notifications (the
 * spiritual canon's reminders), asking first when `requestPermission` is set
 * and the system still allows asking. The web schedules none.
 */
export async function localNotificationPermission(requestPermission = false): Promise<LocalNotificationPermission> {
  const { Notifications, granted } = await prepareNativeNotifications(requestPermission);
  if (!Notifications) return 'unsupported';
  if (granted) return 'granted';
  const permission = await Notifications.getPermissionsAsync();
  return permission.canAskAgain ? 'undetermined' : 'denied';
}

/**
 * Registers this install for notifications: under the account signed in, or
 * — signed out — as an install with no account, which still receives what
 * CV Admin sends to everyone (feast greetings, announcements).
 */
async function registerExpoToken(expoPushToken: string) {
  const { error } = await supabase.rpc('register_notification_device', {
    p_app_key: APP_KEY,
    p_platform: Platform.OS,
    p_provider: PROVIDER,
    p_push_token: expoPushToken,
    p_provider_data: projectId() ? { project_id: projectId() } : {},
    p_device_name: null,
    p_app_version: Constants.expoConfig?.version ?? null,
  });
  if (error) throw new Error('Register notifications: ' + error.message);

  storage()?.setItem(LAST_TOKEN_KEY, expoPushToken);
  return 'registered' as const;
}

export async function syncNativeNotificationDevice(options: {
  requestPermission?: boolean;
  devicePushToken?: DevicePushToken;
} = {}): Promise<NotificationSyncResult> {
  if (Platform.OS === 'web') return 'unsupported';

  const { Notifications, granted } = await prepareNativeNotifications(Boolean(options.requestPermission));
  if (!Notifications) return 'unsupported';
  if (!granted) return 'permission_required';

  const id = projectId();
  if (!id) return 'unconfigured';

  const token = await Notifications.getExpoPushTokenAsync({
    projectId: id,
    ...(options.devicePushToken ? { devicePushToken: options.devicePushToken } : {}),
  });

  return registerExpoToken(token.data);
}

/**
 * The first time the app opens on a device, it asks to send notifications —
 * once: the answer stands, and a later launch never asks again (the system's
 * Settings change it after). Then the device registers for them as on every
 * launch. The web asks only from a tap, so it is not asked here.
 */
export async function requestNotificationsOnFirstLaunch(): Promise<NotificationSyncResult | 'already_asked'> {
  if (Platform.OS === 'web') return 'unsupported';
  const store = storage();
  if (!store || store.getItem(FIRST_LAUNCH_ASKED_KEY)) return 'already_asked';
  // Kept before asking, so a launch cut short by the prompt doesn't ask twice.
  store.setItem(FIRST_LAUNCH_ASKED_KEY, new Date().toISOString());
  return syncNativeNotificationDevice({ requestPermission: true });
}

export async function disableNativeNotificationDevice(): Promise<void> {
  if (Platform.OS === 'web') return;
  const token = storage()?.getItem(LAST_TOKEN_KEY);
  if (!token) return;

  const { error } = await supabase.rpc('disable_notification_device', {
    p_app_key: APP_KEY,
    p_provider: PROVIDER,
    p_push_token: token,
  });
  if (error) throw new Error('Disable notifications: ' + error.message);
  storage()?.removeItem(LAST_TOKEN_KEY);
}

function routeFromResponse(response: NotificationResponse): string | null {
  const data = response.notification.request.content.data as Record<string, unknown> | undefined;
  const route = data?.deep_link ?? data?.url;
  return typeof route === 'string' && route.startsWith('/') ? route : null;
}

export async function installNativeNotificationRuntime(
  onDeepLink: (path: string) => void,
): Promise<() => void> {
  if (Platform.OS === 'web') return () => {};

  const { Notifications } = await prepareNativeNotifications(false);
  if (!Notifications) return () => {};

  const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const route = routeFromResponse(response);
    if (route) onDeepLink(route);
  });

  const tokenSubscription = Notifications.addPushTokenListener((devicePushToken) => {
    void syncNativeNotificationDevice({ devicePushToken }).catch((error) => {
      console.warn('Unable to refresh the Coptic Vine push token:', error);
    });
  });

  const initialResponse = await Notifications.getLastNotificationResponseAsync();
  if (initialResponse) {
    const route = routeFromResponse(initialResponse);
    if (route) onDeepLink(route);
    await Notifications.clearLastNotificationResponseAsync();
  }

  return () => {
    responseSubscription.remove();
    tokenSubscription.remove();
  };
}

export async function loadNotificationPreferences(categories: string[]): Promise<NotificationPreferenceMap> {
  const result: NotificationPreferenceMap = Object.fromEntries(categories.map((category) => [category, true]));
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) return result;

  const { data, error } = await supabase
    .from('notification_preferences')
    .select('category, enabled')
    .eq('user_id', user.id)
    .eq('app_key', APP_KEY)
    .in('category', categories);
  if (error) throw new Error('Load notification preferences: ' + error.message);

  for (const row of data ?? []) result[row.category] = row.enabled;
  return result;
}

export async function setNotificationPreference(category: string, enabled: boolean): Promise<void> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error('Sign in to change notification preferences.');

  const { error } = await supabase.from('notification_preferences').upsert({
    user_id: user.id,
    app_key: APP_KEY,
    category,
    enabled,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,app_key,category' });
  if (error) throw new Error('Save notification preference: ' + error.message);
}

export async function listNotifications(limit = 50) {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, category, event_type, title, body, image_url, deep_link, payload, created_at, read_at')
    .eq('app_key', APP_KEY)
    .order('created_at', { ascending: false })
    .limit(Math.max(1, Math.min(limit, 100)));
  if (error) throw new Error('Load notifications: ' + error.message);
  return data ?? [];
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('app_key', APP_KEY);
  if (error) throw new Error('Mark notification read: ' + error.message);
}
