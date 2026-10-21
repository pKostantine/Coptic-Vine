import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { AppState, Platform } from 'react-native';

import { createCvApiAuth, type CvApiAuth } from '@/services/cvApiAuth';
import { authMessage } from '@/utils/authMessages';

/**
 * Where signing in and everything a user owns are kept (Phase 2 of
 * docs/coptic-vine-d1-plan.md):
 *
 *   supabase    Supabase Auth and Supabase's REST API and Storage: the default
 *               until the cutover (docs/d1/phase2-runbook.md, step 7).
 *   cloudflare  cv-api (workers/api) at https://api.copticvine.ca: Better Auth
 *               for signing in (src/services/cvApiAuth.ts), and the same REST,
 *               function and storage requests as Supabase's, on D1 and R2.
 *
 * EXPO_PUBLIC_USER_DATA_SOURCE=cloudflare switches over, and
 * EXPO_PUBLIC_USER_API_URL uses another address than https://api.copticvine.ca
 * (http://localhost:8790 for `npm run dev` in workers/api). Liturgical content
 * has its own switch (src/services/contentSource.ts).
 */
export type UserDataSource = 'supabase' | 'cloudflare';

export const USER_DATA_SOURCE: UserDataSource = process.env.EXPO_PUBLIC_USER_DATA_SOURCE === 'cloudflare' ? 'cloudflare' : 'supabase';

export const USER_API_URL = (process.env.EXPO_PUBLIC_USER_API_URL || 'https://api.copticvine.ca').replace(/\/+$/, '');

/** Signing in to cv-api, when it is the source; null while Supabase is. */
export const cvApiAuth: CvApiAuth | null = USER_DATA_SOURCE === 'cloudflare'
  ? createCvApiAuth({
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
    })
  : null;

// Checked again whenever the app comes back, as Supabase's tokens are refreshed then.
if (cvApiAuth && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void cvApiAuth.refresh();
  });
}
