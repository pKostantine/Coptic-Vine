import 'expo-sqlite/localStorage/install';
import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { cvApiAuth, USER_API_URL } from '@/services/userApi';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY — check .env.'
  );
}

/**
 * The client for everything a user owns. With cv-api as the source
 * (src/services/userApi.ts) it sends the same requests to cv-api, with
 * cv-api's session (its bearer token, or the web's cookie): it never signs in
 * itself, and supabase.auth is not there to call (src/services/accountAuth.ts
 * signs in for both).
 */
export const supabase = cvApiAuth
  ? createClient(USER_API_URL, supabaseAnonKey, {
      accessToken: cvApiAuth.accessToken,
      global: { fetch: cvApiAuth.fetch },
    })
  : createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: globalThis.localStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web',
      },
    });

if (!cvApiAuth && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
