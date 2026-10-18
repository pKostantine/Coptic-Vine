import { router, type Href } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import {
  installNativeNotificationRuntime,
  requestNotificationsOnFirstLaunch,
  syncNativeNotificationDevice,
} from '@/services/notificationService';
import { syncWebPushDevice } from '@/services/webPushService';
import { supabase } from '@/utils/supabase';

/** How long after the app appears its first launch asks for notifications: over Home, not the splash screen. */
const FIRST_LAUNCH_ASK_DELAY_MS = 1200;

export default function NotificationBootstrap() {
  useEffect(() => {
    if (Platform.OS === 'web') {
      void syncWebPushDevice({ requestPermission: false }).catch((error) => {
        console.warn('Unable to synchronize Coptic Vine web notifications:', error);
      });

      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!session) return;
        void syncWebPushDevice({ requestPermission: false }).catch((error) => {
          console.warn('Unable to synchronize Coptic Vine web notifications after sign-in:', error);
        });
      });

      return () => data.subscription.unsubscribe();
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

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) return;
      void syncNativeNotificationDevice({ requestPermission: false }).catch((error) => {
        console.warn('Unable to synchronize Coptic Vine notifications after sign-in:', error);
      });
    });

    return () => {
      active = false;
      clearTimeout(firstLaunchAsk);
      removeRuntime();
      data.subscription.unsubscribe();
    };
  }, []);

  return null;
}
