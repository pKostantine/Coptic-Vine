import 'expo-sqlite/localStorage/install';
import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';

import { cvApiAuth, USER_API_URL } from '@/services/userApi';

/**
 * The client for everything a user owns: supabase-js, which speaks the REST,
 * function and storage requests cv-api answers (src/services/userApi.ts). It
 * never signs in itself: cv-api's session (its bearer token, or the web's
 * cookie) goes with each request, and signing in is
 * src/services/accountAuth.ts. supabase-js needs a key; cv-api has none, so
 * it is a placeholder, and never a session (workers/api sessionHeaders).
 */
export const api = createClient(USER_API_URL, 'cv-api', {
  accessToken: cvApiAuth.accessToken,
  global: { fetch: cvApiAuth.fetch },
});
