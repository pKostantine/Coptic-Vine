import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

const { default: worker } = await import('../workers/notification-dispatcher/src/index.js');

const SECRET = 'test-worker-secret';
const ENV = {
  API_URL: 'https://api.copticvine.ca',
  SERVICE_TOKEN: 'service-token',
  NOTIFICATION_WORKER_SECRET: SECRET,
};

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('every cv-api RPC names the public schema and carries the service token', async () => {
  // cv-api, as PostgREST did, reads an RPC's schema from its profile headers.
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
  const rpcCalls = calls.filter((call) => call.url.startsWith(`${ENV.API_URL}/rest/v1/rpc/`));
  assert.deepEqual(
    rpcCalls.map((call) => call.url.split('/').pop()),
    ['claim_notification_deliveries', 'claim_notification_receipts'],
  );
  for (const call of rpcCalls) {
    assert.equal(call.headers.get('content-profile'), 'public', call.url);
    assert.equal(call.headers.get('accept-profile'), 'public', call.url);
    assert.equal(call.headers.get('authorization'), `Bearer ${ENV.SERVICE_TOKEN}`, call.url);
    assert.equal(call.headers.get('apikey'), null, call.url);
  }
});
