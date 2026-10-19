// The Cloudflare Worker that decides when the media processor's container
// runs (cloudflare/). The Containers library only exists inside Cloudflare's
// runtime, so a stand-in Container base class takes its place here.
import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

class FakeContainer {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.container = ctx.container;
    this.started = 0;
    this.stopped = 0;
  }
  async startAndWaitForPorts() {
    this.started += 1;
    if (this.ctx.failStart) throw new Error('port 3000 never opened');
    this.container.running = true;
  }
  async stop() { this.stopped += 1; }
  async getState() { return { status: this.container.running ? 'healthy' : 'stopped' }; }
  async containerFetch(url) { return this.ctx.health(url); }
}

mock.module('@cloudflare/containers', {
  namedExports: { Container: FakeContainer, getContainer: (binding, name) => binding.get(name) },
});

const routes = await import('../cloudflare/routes.js');
const { MediaProcessor, default: worker } = await import('../cloudflare/host.js');

const ENV = {
  SUPABASE_URL: 'https://example.supabase.co/',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  MEDIA_WORKER_TOKEN: 'worker-token',
  R2_ACCOUNT_ID: 'account',
  R2_ACCESS_KEY_ID: 'key-id',
  R2_SECRET_ACCESS_KEY: 'secret',
};

/** Supabase's answer to the queue check, recording each request. */
function fakeQueue(answer) {
  const requests = [];
  const fetchImpl = async (url, init) => {
    requests.push({ url, init, body: JSON.parse(init.body) });
    if (answer instanceof Error) return new Response(JSON.stringify({ message: answer.message }), { status: 500 });
    return new Response(JSON.stringify(answer), { status: 200 });
  };
  return { requests, fetchImpl };
}

function fakeProcessor() {
  const calls = [];
  return {
    calls,
    wake: async () => { calls.push('wake'); return { started: true }; },
    status: async () => { calls.push('status'); return { running: false, status: 'stopped' }; },
    fetch: async (request) => { calls.push(`fetch ${new URL(request.url).pathname}`); return new Response('from container', { status: 207 }); },
  };
}

function fakeStorage() {
  const map = new Map();
  return {
    map,
    get: async (key) => map.get(key),
    put: async (key, value) => { map.set(key, value); },
    delete: async (key) => { map.delete(key); },
  };
}

function processorObject({ running = false, busy = false, failStart = false } = {}) {
  const ctx = {
    container: { running },
    storage: fakeStorage(),
    failStart,
    health: async () => new Response(JSON.stringify({ ok: true, busy }), { status: 200 }),
  };
  return { object: new MediaProcessor(ctx, ENV), ctx };
}

describe('when the container runs', () => {
  it('asks Supabase, with the worker token, whether a job is ready', async () => {
    const queue = fakeQueue(true);
    assert.equal(await routes.queueHasWork(ENV, queue.fetchImpl), true);
    const [request] = queue.requests;
    assert.equal(request.url, 'https://example.supabase.co/rest/v1/rpc/media_processing_queue_has_work');
    assert.deepEqual(request.body, { p_worker_token: 'worker-token' });
    assert.equal(request.init.headers.apikey, 'sb_publishable_test');
    assert.equal(request.init.headers['content-profile'], 'public');
    assert.equal(await routes.queueHasWork(ENV, fakeQueue(false).fetchImpl), false);
    await assert.rejects(routes.queueHasWork(ENV, fakeQueue(new Error('down')).fetchImpl), /failed with 500/);
  });

  it('a wake-up starts the container only when there is work', async () => {
    const busy = fakeProcessor();
    const woke = await routes.handleFetch(new Request('https://w.dev/wake', { method: 'POST' }), ENV, busy, { fetchImpl: fakeQueue(true).fetchImpl, log: () => {} });
    assert.deepEqual(await woke.json(), { woke: true, started: true });
    assert.deepEqual(busy.calls, ['wake']);

    const idle = fakeProcessor();
    const skipped = await routes.handleFetch(new Request('https://w.dev/wake', { method: 'POST' }), ENV, idle, { fetchImpl: fakeQueue(false).fetchImpl, log: () => {} });
    assert.deepEqual(await skipped.json(), { woke: false, reason: 'no_work' });
    assert.deepEqual(idle.calls, []);
  });

  it('when Supabase cannot answer, the container is not started', async () => {
    const processor = fakeProcessor();
    const response = await routes.handleFetch(new Request('https://w.dev/wake', { method: 'POST' }), ENV, processor, { fetchImpl: fakeQueue(new Error('down')).fetchImpl, log: () => {} });
    assert.equal(response.status, 502);
    assert.deepEqual(processor.calls, []);
  });

  it('every minute it checks the queue; once a day it starts the container for cleanup', async () => {
    const minute = fakeProcessor();
    assert.deepEqual(await routes.handleScheduled('* * * * *', ENV, minute, { fetchImpl: fakeQueue(false).fetchImpl }), { woke: false, reason: 'no_work' });
    assert.deepEqual(minute.calls, []);

    const daily = fakeProcessor();
    const queue = fakeQueue(false);
    const result = await routes.handleScheduled(routes.DAILY_CLEANUP_CRON, ENV, daily, { fetchImpl: queue.fetchImpl });
    assert.equal(result.reason, 'daily_cleanup');
    assert.deepEqual(daily.calls, ['wake']);
    assert.equal(queue.requests.length, 0);
  });

  it('admin deletions go to the container; health and preflights do not start it', async () => {
    const processor = fakeProcessor();
    const deletion = await routes.handleFetch(new Request('https://w.dev/admin/storage/unused', { method: 'DELETE' }), ENV, processor);
    assert.equal(deletion.status, 207);
    const preflight = await routes.handleFetch(new Request('https://w.dev/admin/storage/unused', { method: 'OPTIONS' }), ENV, processor);
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-methods'), 'GET, DELETE, OPTIONS');
    const health = await routes.handleFetch(new Request('https://w.dev/health'), ENV, processor);
    assert.equal((await health.json()).container.status, 'stopped');
    assert.deepEqual(processor.calls, ['fetch /admin/storage/unused', 'status']);
    assert.equal((await routes.handleFetch(new Request('https://w.dev/elsewhere'), ENV, processor)).status, 404);
    assert.equal((await routes.handleFetch(new Request('https://w.dev/wake'), ENV, processor)).status, 405);
  });

  it('the container gets its settings, told to exit when idle', () => {
    const env = routes.containerEnv({ ...ENV, R2_SECRET_ACCESS_KEY: undefined });
    assert.equal(env.MEDIA_EXIT_WHEN_IDLE_MS, '20000');
    assert.equal(env.MEDIA_FFMPEG_THREADS, '4');
    assert.equal(env.R2_DRIVER, 's3');
    assert.equal(env.ADMIN_API_PORT, '3000');
    assert.equal(env.MEDIA_WORKER_TOKEN, 'worker-token');
    assert.ok(!('R2_SECRET_ACCESS_KEY' in env), 'a missing setting is left out, not sent as "undefined"');
  });
});

describe('the container object', () => {
  it('starts once; a second wake-up while it runs does nothing', async () => {
    const { object } = processorObject();
    assert.deepEqual(await object.wake(), { started: true });
    assert.deepEqual(await object.wake(), { started: false, running: true });
    assert.equal(object.started, 1);
    assert.equal(object.envVars.MEDIA_EXIT_WHEN_IDLE_MS, '20000');
  });

  it('never stops a busy container when the idle timer lapses, however long the job', async () => {
    const { object, ctx } = processorObject({ running: true, busy: true });
    for (let lapse = 0; lapse < 30; lapse += 1) await object.onActivityExpired(); // 30 × 5 min: a 2½-hour encode
    assert.equal(object.stopped, 0);
    ctx.health = async () => new Response(JSON.stringify({ ok: true, busy: false }));
    await object.onActivityExpired();
    assert.equal(object.stopped, 1);
  });

  it('stops an unresponsive container rather than paying for it', async () => {
    const { object, ctx } = processorObject({ running: true });
    ctx.health = async () => { throw new Error('connection refused'); };
    await object.onActivityExpired();
    assert.equal(object.stopped, 1);
  });

  it('backs off a container that keeps crashing: a minute, doubling to an hour', async () => {
    assert.deepEqual([0, 1, 2, 3, 7, 20].map(routes.startBackoffMs), [0, 60_000, 120_000, 240_000, 3_600_000, 3_600_000]);

    const { object, ctx } = processorObject({ failStart: true });
    const first = await object.wake();
    assert.equal(first.started, false);
    assert.match(first.error, /never opened/);
    const second = await object.wake();
    assert.equal(second.backingOff, true);
    assert.equal(object.started, 1, 'no second start inside the backoff');

    // A clean exit (idle, or asked to stop) clears the record.
    await object.onStop({ exitCode: 1, reason: 'exit' });
    assert.equal(ctx.storage.map.get('crashes').count, 2);
    await object.onStop({ exitCode: 0, reason: 'exit' });
    assert.equal(ctx.storage.map.has('crashes'), false);
    ctx.failStart = false;
    assert.deepEqual(await object.wake(), { started: true });
  });

  it('the Worker hands scheduled runs to the same container', async () => {
    const processor = fakeProcessor();
    const waits = [];
    const env = { ...ENV, MEDIA_PROCESSOR: { get: (name) => { assert.equal(name, routes.CONTAINER_NAME); return processor; } } };
    const daily = { cron: routes.DAILY_CLEANUP_CRON };
    const log = mock.method(console, 'log', () => {});
    try {
      worker.scheduled(daily, env, { waitUntil: (promise) => waits.push(promise) });
      await Promise.all(waits);
    } finally {
      log.mock.restore();
    }
    assert.deepEqual(processor.calls, ['wake']);
  });
});
