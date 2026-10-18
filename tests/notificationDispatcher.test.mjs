import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

const { default: worker } = await import('../workers/notification-dispatcher/src/index.js');

const SECRET = 'test-worker-secret';
const ENV = {
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  NOTIFICATION_WORKER_SECRET: SECRET,
};

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('every Supabase RPC names the public schema', async () => {
  // The project exposes graphql_public first; an RPC without a profile is
  // looked up there and fails with PGRST202, so nothing is ever claimed.
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const headers = new Headers(init.headers);
    calls.push({ url: String(input), headers });
    return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
  };

  const response = await worker.fetch(
    new Request('https://dispatcher.example/run', {
      method: 'POST',
      headers: { authorization: `Bearer ${SECRET}` },
    }),
    ENV,
  );

  assert.equal(response.status, 200);
  const rpcCalls = calls.filter((call) => call.url.startsWith(`${ENV.SUPABASE_URL}/rest/v1/rpc/`));
  assert.deepEqual(
    rpcCalls.map((call) => call.url.split('/').pop()),
    ['claim_notification_deliveries', 'claim_notification_receipts'],
  );
  for (const call of rpcCalls) {
    assert.equal(call.headers.get('content-profile'), 'public', call.url);
    assert.equal(call.headers.get('accept-profile'), 'public', call.url);
  }
});
