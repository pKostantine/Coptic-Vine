// On Cloudflare the worker runs only while there is work: it exits once idle
// (MEDIA_EXIT_WHEN_IDLE_MS), never while a job or admin request is under way.
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { describe, it } from 'node:test';

const workerEntry = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'worker.mjs');

async function startFakeApi(handlers) {
  const calls = [];
  const server = http.createServer((request, response) => {
    let raw = '';
    request.on('data', (chunk) => { raw += chunk; });
    request.on('end', async () => {
      const name = request.url.replace('/rest/v1/rpc/', '');
      calls.push({ name, at: Date.now() });
      const handler = handlers[name];
      if (!handler) {
        response.writeHead(404, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ message: `no handler for ${name}` }));
        return;
      }
      const result = await handler(raw ? JSON.parse(raw) : {});
      response.writeHead(result?.status ?? 200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(result?.rows ?? result));
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    calls,
    close: () => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); }),
  };
}

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function startWorker(apiUrl, env = {}) {
  const adminPort = await freePort();
  const child = spawn(process.execPath, [workerEntry], {
    env: {
      ...process.env,
      API_URL: apiUrl,
      MEDIA_WORKER_TOKEN: 'test-worker-token',
      MEDIA_WORKER_ID: 'test-worker',
      MEDIA_POLL_INTERVAL_MS: '50',
      MEDIA_ERROR_BACKOFF_MS: '50',
      MEDIA_MAX_ERROR_BACKOFF_MS: '100',
      ADMIN_API_PORT: String(adminPort),
      ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const lines = [];
  let buffer = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    buffer += chunk;
    const parts = buffer.split('\n');
    buffer = parts.pop() ?? '';
    for (const part of parts) if (part.trim()) lines.push(JSON.parse(part));
  });
  const exited = new Promise((resolve) => child.once('exit', (code, signal) => resolve({ code, signal, at: Date.now() })));
  return { child, lines, exited, adminUrl: `http://127.0.0.1:${adminPort}` };
}

function waitFor(predicate, { timeoutMs = 10000 } = {}) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const timer = setInterval(() => {
      if (predicate()) { clearInterval(timer); resolve(); }
      else if (Date.now() > deadline) { clearInterval(timer); reject(new Error('Timed out waiting for worker output')); }
    }, 20);
  });
}

const failingJob = (id) => ({
  job_id: id,
  upload_intent_id: '22222222-2222-4222-8222-222222222222',
  job_type: 'metadata_probe',
  attempt_count: 1,
  max_attempts: 3,
  input_bucket: 'chc-submissions',
  input_path: 'a.bin',
  output_bucket: 'chc-music',
  output_path: 'out/a',
});

describe('exit when idle (Cloudflare)', () => {
  it('exits cleanly once the queue has been empty for the idle window', async () => {
    const api = await startFakeApi({ claim_media_processing_job: () => [] });
    const startedAt = Date.now();
    const { child, lines, exited } = await startWorker(api.url, { MEDIA_EXIT_WHEN_IDLE_MS: '600' });
    try {
      const exit = await exited;
      assert.equal(exit.code, 0);
      assert.ok(exit.at - startedAt >= 600, 'not before the idle window');
      assert.ok(exit.at - startedAt < 5000, 'soon after it');
      assert.ok(lines.some((line) => line.status === 'idle_exit'));
      assert.equal(lines.find((line) => line.status === 'worker_started').exitWhenIdleMs, 600);
    } finally {
      child.kill('SIGKILL');
      await api.close();
    }
  });

  it('each job restarts the idle window', async () => {
    const queued = [failingJob('11111111-1111-4111-8111-111111111111'), failingJob('33333333-3333-4333-8333-333333333333')];
    const releaseAt = Date.now() + 900;
    const api = await startFakeApi({
      // The first job arrives after the worker has idled for most of its window.
      claim_media_processing_job: () => (Date.now() >= releaseAt && queued.length ? [queued.shift()] : []),
      fail_media_processing_job: (payload) => [{ job_id: payload.p_job_id, status: 'queued', attempt_count: 1, max_attempts: 3 }],
    });
    const { child, lines, exited } = await startWorker(api.url, { MEDIA_EXIT_WHEN_IDLE_MS: '1200' });
    try {
      const exit = await exited;
      assert.equal(exit.code, 0);
      const failures = lines.filter((line) => line.status === 'failed');
      assert.equal(failures.length, 2, 'both jobs were processed before it exited');
      const lastJobAt = Date.parse(failures.at(-1).at ?? lines.find((line) => line.status === 'idle_exit').at);
      assert.ok(exit.at - lastJobAt >= 1000, 'it waited a full window after the last job');
    } finally {
      child.kill('SIGKILL');
      await api.close();
    }
  });

  it('reports busy and stays up while an admin request is under way', async () => {
    let finishAuthorization;
    const api = await startFakeApi({
      claim_media_processing_job: () => [],
      authorize_admin_storage_gc: () => new Promise((resolve) => { finishAuthorization = () => resolve([{ authorized: false }]); }),
    });
    const { child, lines, exited, adminUrl } = await startWorker(api.url, { MEDIA_EXIT_WHEN_IDLE_MS: '400' });
    try {
      await waitFor(() => lines.some((line) => line.status === 'admin_api_started'));
      const idleHealth = await (await fetch(`${adminUrl}/health`)).json();
      assert.equal(idleHealth.busy, false);

      const deletion = fetch(`${adminUrl}/admin/storage/unused`, { method: 'DELETE', headers: { authorization: 'Bearer admin-session' } });
      await waitFor(() => typeof finishAuthorization === 'function');
      const busyHealth = await (await fetch(`${adminUrl}/health`)).json();
      assert.equal(busyHealth.busy, true);

      // Well past the idle window, it is still running for the admin.
      await new Promise((resolve) => setTimeout(resolve, 900));
      assert.ok(!lines.some((line) => line.status === 'idle_exit'));

      finishAuthorization();
      assert.equal((await deletion).status, 403);
      const exit = await exited;
      assert.equal(exit.code, 0);
    } finally {
      child.kill('SIGKILL');
      await api.close();
    }
  });

  it('does not keep a container up while the queue is unreachable', async () => {
    const api = await startFakeApi({ claim_media_processing_job: () => ({ status: 500, rows: { message: 'database unavailable' } }) });
    const { child, lines, exited } = await startWorker(api.url, { MEDIA_EXIT_WHEN_IDLE_MS: '500' });
    try {
      const exit = await exited;
      assert.equal(exit.code, 0);
      assert.ok(lines.some((line) => line.status === 'queue_unavailable'));
    } finally {
      child.kill('SIGKILL');
      await api.close();
    }
  });
});
