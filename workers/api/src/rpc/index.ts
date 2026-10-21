/**
 * /rest/v1/rpc/<function>: the database functions the apps and Workers call
 * on Supabase, ported to the Worker. Each entry names the function's
 * parameters (and the defaults Postgres would fill in), so a call is matched
 * the way PostgREST matches it: by name and by the arguments given.
 */
import grants from '../../schema/function-grants.json' with { type: 'json' };
import { PgError } from '../pg.ts';
import type { ApiContext } from '../rest/context.ts';
import { disableNotificationDevice, getMyContentPreferences, registerNotificationDevice, saveMyContentPreferences } from './user.ts';

type Args = Record<string, unknown>;
export type Rpc = {
  params: string[];
  defaults?: Args;
  /** void functions answer 204 with no body, as PostgREST does. */
  returnsVoid?: boolean;
  run: (ctx: ApiContext, args: Args) => Promise<unknown>;
};

export const RPCS: Record<string, Record<string, Rpc>> = {
  public: {
    get_my_content_preferences: { params: [], run: (c) => getMyContentPreferences(c) },
    save_my_content_preferences: { params: ['p_preferences', 'p_bookmarks'], defaults: { p_bookmarks: [] }, run: (c, a) => saveMyContentPreferences(c, a.p_preferences, a.p_bookmarks) },
    register_notification_device: {
      params: ['p_app_key', 'p_platform', 'p_provider', 'p_push_token', 'p_provider_data', 'p_device_name', 'p_app_version'],
      defaults: { p_provider_data: {}, p_device_name: null, p_app_version: null },
      run: (c, a) => registerNotificationDevice(c, a as never),
    },
    disable_notification_device: { params: ['p_app_key', 'p_provider', 'p_push_token'], run: (c, a) => disableNotificationDevice(c, a as never) },
  },
};

export async function callRpc(ctx: ApiContext, schema: string, name: string, args: Args): Promise<{ rpc: Rpc; result: unknown }> {
  const rpc = RPCS[schema]?.[name];
  const given = Object.keys(args);
  const fits = rpc && given.every((key) => rpc.params.includes(key)) && rpc.params.every((param) => given.includes(param) || (rpc.defaults && param in rpc.defaults));
  if (!rpc || !fits) {
    throw new PgError('PGRST202', `Could not find the function ${schema}.${name}(${given.sort().join(', ')}) in the schema cache`, 404,
      `Searched for the function ${schema}.${name} with parameters ${given.sort().join(', ') || 'none'} or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.`);
  }
  // Supabase's EXECUTE grants (schema/function-grants.json): a signed-out call to a function only
  // signed-in users may call is refused before it runs, as Postgres refuses it.
  const role = ctx.userId ? 'authenticated' : 'anon';
  if (!((grants as Record<string, string[]>)[`${schema}.${name}`] ?? []).includes(role)) {
    throw new PgError('42501', `permission denied for function ${name}`, ctx.userId ? 403 : 401);
  }
  const full: Args = { ...(rpc.defaults ?? {}), ...args };
  return { rpc, result: await rpc.run(ctx, full) };
}
