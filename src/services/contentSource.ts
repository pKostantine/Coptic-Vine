import { createClient } from '@supabase/supabase-js';

import { USER_DATA_SOURCE } from '@/services/userApi';
import { supabase } from '@/utils/supabase';

/**
 * Where liturgical content is read from (Phase 1 of docs/coptic-vine-d1-plan.md):
 *
 *   cloudflare  the D1 content Worker (workers/content-api): the default since the
 *               cutover on 20 Oct 2026, when D1 became the content master. It answers
 *               the same requests as Supabase did, with the same JSON
 *               (docs/d1/phase1-parity.md).
 *   supabase    Supabase's REST API: the old copy, frozen at the cutover and kept
 *               read-only for 30 days as a fallback.
 *
 * EXPO_PUBLIC_CONTENT_SOURCE=supabase switches back, and EXPO_PUBLIC_CONTENT_API_URL
 * uses another address than https://content.copticvine.ca. Only content reads go through
 * this client (contentDataClient and the home screen's calendar and Synaxarium); signing
 * in, music, learning and everything a user owns have their own switch
 * (src/services/userApi.ts).
 */
export type ContentSource = 'supabase' | 'cloudflare';

export const CONTENT_SOURCE: ContentSource = process.env.EXPO_PUBLIC_CONTENT_SOURCE === 'supabase' ? 'supabase' : 'cloudflare';

const CONTENT_API_URL = (process.env.EXPO_PUBLIC_CONTENT_API_URL || 'https://content.copticvine.ca').replace(/\/+$/, '');

/** A supabase-js client that never signs in and keeps no session: the content is public. */
function sessionless(url: string, storageKey: string): typeof supabase {
  return createClient(url, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'public', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey },
  }) as unknown as typeof supabase;
}

/**
 * The client content reads use. For the Worker it is a supabase-js client of its own,
 * so the app's queries stay exactly as they are; it can't disturb the signed-in client.
 * Back on Supabase it is the signed-in client, unless user data has moved to cv-api:
 * that client then sends everything to cv-api, which keeps no content, so Supabase's
 * frozen copy gets a client of its own too.
 */
export const contentApi: typeof supabase = CONTENT_SOURCE === 'cloudflare'
  ? sessionless(CONTENT_API_URL, 'cv-content-api')
  : USER_DATA_SOURCE === 'cloudflare'
    ? sessionless(process.env.EXPO_PUBLIC_SUPABASE_URL || '', 'cv-content-supabase')
    : supabase;
