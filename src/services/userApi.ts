import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { AppState, Platform } from 'react-native';

import { createCvApiAuth, type CvApiAuth } from '@/services/cvApiAuth';
import { authMessage } from '@/utils/authMessages';

/**
 * Where signing in and everything a user owns are kept: cv-api (workers/api)
 * at https://api.copticvine.ca, with Better Auth for signing in
 * (src/services/cvApiAuth.ts) and the REST, function and storage requests
 * supabase-js makes, on D1 and R2 (docs/coptic-vine-d1-plan.md, Phase 2).
 *
 * EXPO_PUBLIC_USER_API_URL uses another address (http://localhost:8790 for
 * `npm run dev` in workers/api). Liturgical content comes from the content
 * Worker (src/services/contentSource.ts).
 */
export const USER_API_URL = (process.env.EXPO_PUBLIC_USER_API_URL || 'https://api.copticvine.ca').replace(/\/+$/, '');

/** Signing in to cv-api. */
export const cvApiAuth: CvApiAuth = createCvApiAuth({
  baseUrl: USER_API_URL,
  native: Platform.OS !== 'web',
  appOrigin: Platform.OS === 'web' ? '' : Linking.createURL(''),
  callbackPath: 'account',
  // expo-sqlite's localStorage, installed by src/utils/supabase.ts, where Supabase keeps its session too.
  storage: () => globalThis.localStorage,
  openAuthSession: async (url, returnUrl) => {
    if (Platform.OS === 'android') {
      try {
        WebBrowser.dismissAuthSession();
      } catch {
        // None was open.
      }
    }
    return WebBrowser.openAuthSessionAsync(url, returnUrl);
  },
  navigate: (url) => window.location.assign(url),
  replaceUrl: Platform.OS === 'web' ? (url) => window.history.replaceState(window.history.state, '', url) : undefined,
  message: authMessage,
});

// Checked again whenever the app comes back.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void cvApiAuth.refresh();
  });
}
