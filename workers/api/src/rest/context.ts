import type { D1Database, Env } from '../types.ts';

/** Who is asking, for the tables and the functions: always from the session, never from the request. */
export type ApiContext = {
  db: D1Database;
  env: Env;
  /** The signed-in user's id (auth.uid()), or null for a signed-out request (the anon role). */
  userId: string | null;
  /**
   * Called by another Worker with SERVICE_TOKEN, as Supabase's service role:
   * any function may be called (the grants don't apply), with no user. The
   * tables answer it as they answer a signed-out request.
   */
  service?: boolean;
};
