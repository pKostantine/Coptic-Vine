/**
 * The function router (src/rpc) against Supabase's functions: every port
 * exists there, schema/functions.json is what the dump says, and calls are
 * matched, checked and refused as PostgREST and Postgres do it.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { convert } from '../src/rpc/args.ts';
import { callRpc, FUNCTIONS, OWN_FUNCTIONS, RPCS, SUPABASE_FUNCTIONS } from '../src/rpc/index.ts';
import { functionInfo } from '../scripts/gen-functions.ts';

const dump = readFileSync(new URL('../schema/pg-user-schema.sql', import.meta.url), 'utf8');

test('schema/functions.json is what the dump says', () => {
  assert.equal(readFileSync(new URL('../schema/functions.json', import.meta.url), 'utf8'), `${JSON.stringify(functionInfo(dump), null, 1)}\n`, 'run npm run gen:functions');
});

test('every port is a Supabase function, or one of cv-api\'s own, which never takes a Supabase name', () => {
  for (const key of Object.keys(RPCS)) assert.ok(SUPABASE_FUNCTIONS[key] || OWN_FUNCTIONS[key], `${key} isn't in the dump, nor one of cv-api's own`);
  for (const key of Object.keys(OWN_FUNCTIONS)) {
    assert.ok(!SUPABASE_FUNCTIONS[key], `${key} is a Supabase function`);
    assert.ok(RPCS[key], `${key} has no body`);
  }
});

const anon = { db: null as never, env: null as never, userId: null };
const refused = (code: string, message?: string) => (error: { code: string; message: string }) => error.code === code && (message === undefined || error.message === message);

test('calls are matched by name and arguments, and grants are applied before anything runs', async () => {
  await assert.rejects(callRpc(anon, 'public', 'no_such_function', {}), refused('PGRST202'));
  await assert.rejects(callRpc(anon, 'public', 'disable_notification_device', { p_app_key: 'chc' }), refused('PGRST202'));
  await assert.rejects(callRpc(anon, 'public', 'disable_notification_device', { p_app_key: 'chc', p_provider: 'expo', p_push_token: 'x' }),
    refused('42501', 'permission denied for function disable_notification_device'));
});

test('arguments are checked as Postgres checks them', () => {
  assert.equal(convert('uuid', '0A1B2C3D-0000-4000-8000-00000000A11C'), '0a1b2c3d-0000-4000-8000-00000000a11c');
  assert.throws(() => convert('uuid', 'not-a-uuid'), refused('22P02', 'invalid input syntax for type uuid: "not-a-uuid"'));
  const kinds = FUNCTIONS['public.get_published_track_lyrics'].params.find((param) => param.name === 'p_kind')!.enum;
  assert.deepEqual(kinds, ['original', 'translation', 'transliteration']);
  assert.throws(() => convert('music.lyric_kind', 'karaoke', kinds), refused('22P02', 'invalid input value for enum music.lyric_kind: "karaoke"'));
  assert.equal(convert('music.lyric_kind', 'translation', kinds), 'translation');
  assert.throws(() => convert('integer', 1.5), refused('22P02'));
  assert.deepEqual(convert('uuid[]', ['0A1B2C3D-0000-4000-8000-00000000A11C', null]), ['0a1b2c3d-0000-4000-8000-00000000a11c', null]);
  assert.equal(convert('boolean', 'yes'), true);
  assert.equal(convert('text', 18), '18');
});
