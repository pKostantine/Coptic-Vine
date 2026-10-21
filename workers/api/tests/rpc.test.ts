/**
 * The function registry (src/rpc/index.ts) against Supabase's: every ported
 * function exists there with the same parameters, its grants are the ones in
 * the dump, and calls are matched as PostgREST matches them.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { callRpc, RPCS } from '../src/rpc/index.ts';
import { functionGrants } from '../scripts/gen-grants.ts';

const dump = readFileSync(new URL('../schema/pg-user-schema.sql', import.meta.url), 'utf8');

test('schema/function-grants.json is what the dump grants', () => {
  assert.equal(readFileSync(new URL('../schema/function-grants.json', import.meta.url), 'utf8'), `${JSON.stringify(functionGrants(dump), null, 1)}\n`, 'run npm run gen:grants');
});

test('every ported function has Supabase\'s name and parameters', () => {
  for (const [schema, functions] of Object.entries(RPCS)) {
    for (const [name, rpc] of Object.entries(functions)) {
      const definition = dump.match(new RegExp(`^CREATE OR REPLACE FUNCTION ${schema}\\.${name}\\(([^)]*)\\)`, 'm'));
      assert.ok(definition, `${schema}.${name} isn't in the dump`);
      const params = definition[1] ? definition[1].split(',').map((part) => part.trim().split(' ')[0]) : [];
      assert.deepEqual(rpc.params, params, `${schema}.${name}: parameters`);
      const withDefaults = definition[1] ? definition[1].split(',').filter((part) => / DEFAULT /.test(part)).map((part) => part.trim().split(' ')[0]) : [];
      assert.deepEqual(Object.keys(rpc.defaults ?? {}).sort(), withDefaults.sort(), `${schema}.${name}: parameters with defaults`);
    }
  }
});

test('calls are matched by name and arguments, and grants are applied', async () => {
  const ctx = { db: null as never, env: null as never, userId: null };
  await assert.rejects(callRpc(ctx, 'public', 'no_such_function', {}), (error: { code: string }) => error.code === 'PGRST202');
  await assert.rejects(callRpc(ctx, 'public', 'disable_notification_device', { p_app_key: 'chc' }), (error: { code: string }) => error.code === 'PGRST202');
  await assert.rejects(callRpc(ctx, 'public', 'disable_notification_device', { p_app_key: 'chc', p_provider: 'expo', p_push_token: 'x' }),
    (error: { code: string; message: string; status: number }) => error.code === '42501' && error.message === 'permission denied for function disable_notification_device' && error.status === 401);
});
