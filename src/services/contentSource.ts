import { createClient } from '@supabase/supabase-js';

import { supabase } from '@/utils/supabase';

/**
 * Where liturgical content is read from (Phase 1 of docs/coptic-vine-d1-plan.md):
 *
 *   supabase    Supabase's REST API: the default, until the move to Cloudflare is cut over.
 *   cloudflare  the D1 content Worker (workers/content-api), which answers the same
 *               requests with the same JSON, checked against Supabase in docs/d1/phase1-parity.md.
 *
 * Set EXPO_PUBLIC_CONTENT_SOURCE=cloudflare to switch, and EXPO_PUBLIC_CONTENT_API_URL to
 * use another address than https://content.copticvine.ca. Only content reads go through
 * this client (contentDataClient and the home screen's calendar and Synaxarium); signing
 * in, music, learning and everything a user owns stay on Supabase.
 */
export type ContentSource = 'supabase' | 'cloudflare';

export const CONTENT_SOURCE: ContentSource = process.env.EXPO_PUBLIC_CONTENT_SOURCE === 'cloudflare' ? 'cloudflare' : 'supabase';

const CONTENT_API_URL = (process.env.EXPO_PUBLIC_CONTENT_API_URL || 'https://content.copticvine.ca').replace(/\/+$/, '');

/**
 * The client content reads use. For the Worker it is a supabase-js client of its own,
 * so the app's queries stay exactly as they are; it never signs in (the content is
 * public) and keeps no session, so it can't disturb the signed-in Supabase client.
 */
export const contentApi: typeof supabase = CONTENT_SOURCE === 'cloudflare'
  ? (createClient(CONTENT_API_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'public', {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'cv-content-api' },
    }) as unknown as typeof supabase)
  : supabase;
