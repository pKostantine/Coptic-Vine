import { createClient } from '@supabase/supabase-js';

import type { api } from '@/utils/api';

/**
 * Where liturgical content is read from: the D1 content Worker
 * (workers/content-api) at https://content.copticvine.ca, the content master
 * since 20 Oct 2026 (docs/coptic-vine-d1-plan.md, Phase 1).
 * EXPO_PUBLIC_CONTENT_API_URL uses another address. Only content reads go
 * through this client (contentDataClient and the home screen's calendar and
 * Synaxarium); everything a user owns goes to cv-api (src/services/userApi.ts).
 */
const CONTENT_API_URL = (process.env.EXPO_PUBLIC_CONTENT_API_URL || 'https://content.copticvine.ca').replace(/\/+$/, '');

/**
 * The client content reads use: a supabase-js client of its own, so the
 * app's queries stay as they are. It never signs in and keeps no session (the
 * content is public), so it can't disturb the signed-in client. supabase-js
 * needs a key; the content Worker has none, so it is a placeholder.
 */
export const contentApi: typeof api = createClient(CONTENT_API_URL, 'public', {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'cv-content-api' },
}) as unknown as typeof api;
