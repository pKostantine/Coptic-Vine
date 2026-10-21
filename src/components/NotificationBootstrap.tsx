import { router, type Href } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { accountAuth } from '@/services/accountAuth';
import {
  installNativeNotificationRuntime,
  requestNotificationsOnFirstLaunch,
  syncNativeNotificationDevice,
} from '@/services/notificationService';
import { syncWebPushDevice } from '@/services/webPushService';

/** How long after the app appears its first launch asks for notifications: over Home, not the splash screen. */
const FIRST_LAUNCH_ASK_DELAY_MS = 1200;

export default function NotificationBootstrap() {
  useEffect(() => {
    if (Platform.OS === 'web') {
      void syncWebPushDevice({ requestPermission: false }).catch((error) => {
        console.warn('Unable to synchronize Coptic Vine web notifications:', error);
      });

      // Signing in moves this browser to the account; signing out, back to no account.
      return accountAuth.onChange((event, session) => {
        if (!session && event !== 'SIGNED_OUT') return;
        void syncWebPushDevice({ requestPermission: false }).catch((error) => {
          console.warn('Unable to synchronize Coptic Vine web notifications after signing in or out:', error);
        });
      });
    }

    let active = true;
    let removeRuntime = () => {};

    void installNativeNotificationRuntime((path) => {
      router.push(path as Href);
    }).then((remove) => {
      if (!active) {
        remove();
        return;
      }
      removeRuntime = remove;
    }).catch((error) => {
      console.warn('Unable to start Coptic Vine notifications:', error);
    });

    void syncNativeNotificationDevice({ requestPermission: false }).catch((error) => {
      console.warn('Unable to synchronize Coptic Vine notifications:', error);
    });

    const firstLaunchAsk = setTimeout(() => {
      void requestNotificationsOnFirstLaunch().catch((error) => {
        console.warn('Unable to ask for Coptic Vine notifications:', error);
      });
    }, FIRST_LAUNCH_ASK_DELAY_MS);

    // Signing in moves this install to the account; signing out (which first
    // detaches it from the account) registers it again with no account, so
    // what is sent to everyone still reaches it.
    const unsubscribe = accountAuth.onChange((event, session) => {
      if (!session && event !== 'SIGNED_OUT') return;
      void syncNativeNotificationDevice({ requestPermission: false }).catch((error) => {
        console.warn('Unable to synchronize Coptic Vine notifications after signing in or out:', error);
      });
    });

    return () => {
      active = false;
      clearTimeout(firstLaunchAsk);
      removeRuntime();
      unsubscribe();
    };
  }, []);

  return null;
}
