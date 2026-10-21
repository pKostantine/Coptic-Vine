/**
 * /rest/v1/rpc/<function>: the database functions the apps and Workers call
 * on Supabase, ported to the Worker. Their parameters, defaults, argument
 * types and grants come from Supabase itself (schema/functions.json,
 * generated from the dump), so a call is matched, checked and refused the
 * way PostgREST and Postgres do it; each port supplies only the body.
 *
 * A few functions are cv-api's own, which Supabase never had (CV-Admin's
 * Users page, src/rpc/admin/users.ts). Their signatures are declared next to
 * them in the same form (OWN_FUNCTIONS) and go through the same matching and
 * grants; none may take a Supabase function's name (tests/rpc.test.ts).
 */
import functions from '../../schema/functions.json' with { type: 'json' };
import type { FunctionInfo } from '../../scripts/gen-functions.ts';
import { PgError } from '../pg.ts';
import type { ApiContext } from '../rest/context.ts';
import { adminRpcs } from './admin/index.ts';
import { USER_FUNCTIONS, userRpcs } from './admin/users.ts';
import { convert } from './args.ts';
import { creatorRpcs } from './creator/index.ts';
import { learningRpcs } from './learning/index.ts';
import { musicRpcs } from './music/index.ts';
import { searchRpcs } from './search/index.ts';
import { workerRpcs } from './workers/index.ts';
import { disableNotificationDevice, getMyContentPreferences, registerNotificationDevice, saveMyContentPreferences } from './user.ts';

export type Args = Record<string, unknown>;
export type Rpc = (ctx: ApiContext, args: Args) => Promise<unknown>;

/** The ported functions, by "schema.name". */
export const RPCS: Record<string, Rpc> = {
  'public.get_my_content_preferences': (c) => getMyContentPreferences(c),
  'public.save_my_content_preferences': (c, a) => saveMyContentPreferences(c, a.p_preferences, a.p_bookmarks),
  'public.register_notification_device': (c, a) => registerNotificationDevice(c, a as never),
  'public.disable_notification_device': (c, a) => disableNotificationDevice(c, a as never),
  ...musicRpcs,
  ...learningRpcs,
  ...searchRpcs,
  ...creatorRpcs,
  ...adminRpcs,
  ...workerRpcs,
  ...userRpcs,
};

/** cv-api's own functions' signatures. */
export const OWN_FUNCTIONS: Record<string, FunctionInfo> = { ...USER_FUNCTIONS };

/** The dump's functions, then cv-api's own. */
export const SUPABASE_FUNCTIONS = functions as Record<string, FunctionInfo>;
export const FUNCTIONS: Record<string, FunctionInfo> = { ...SUPABASE_FUNCTIONS, ...OWN_FUNCTIONS };

export async function callRpc(ctx: ApiContext, schema: string, name: string, args: Args): Promise<{ result: unknown; returnsVoid: boolean }> {
  const key = `${schema}.${name}`;
  const info = FUNCTIONS[key];
  const run = RPCS[key];
  const given = Object.keys(args);
  const fits = info && given.every((arg) => info.params.some((param) => param.name === arg))
    && info.params.every((param) => given.includes(param.name) || 'default' in param);
  if (!info || !run || !fits) {
    throw new PgError('PGRST202', `Could not find the function ${key}(${given.sort().join(', ')}) in the schema cache`, 404,
      `Searched for the function ${key} with parameters ${given.sort().join(', ') || 'none'} or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.`);
  }
  // Supabase's EXECUTE grants: a call the role couldn't make there is refused before it runs. The service role may call anything.
  if (!ctx.service && !info.roles.includes(ctx.userId ? 'authenticated' : 'anon')) {
    throw new PgError('42501', `permission denied for function ${name}`, ctx.userId ? 403 : 401);
  }
  const full: Args = {};
  for (const param of info.params) full[param.name] = given.includes(param.name) ? convert(param.type, args[param.name], param.enum) : structuredClone(param.default);
  return { result: await run(ctx, full), returnsVoid: info.returns === 'void' };
}
