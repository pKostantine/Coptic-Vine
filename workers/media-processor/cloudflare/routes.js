// The Cloudflare side of the media processor. The container (../src) does the
// work; this Worker decides when it runs, because a running container is
// billed by the second:
//
// - POST /wake, which the database calls the moment a job is queued;
// - every minute, a backstop for retries and any missed wake-up;
// - once a day, so storage cleanup runs even when nothing is uploaded.
//
// It starts the container only when Supabase says a job is ready. The
// container drains the queue, then exits by itself once it has been idle.

export const CONTAINER_NAME = 'media-processor';
export const DAILY_CLEANUP_CRON = '17 9 * * *';
export const ADMIN_PORT = 3000;
// How long the container stays up with nothing to do before it exits.
export const EXIT_WHEN_IDLE_MS = 20_000;
// The vCPUs of the instance type in wrangler.jsonc (standard-4). The container
// may not see a cgroup limit, so FFmpeg is told rather than left to guess.
export const FFMPEG_THREADS = 4;

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, DELETE, OPTIONS',
  'access-control-allow-headers': 'Authorization, Content-Type',
  'access-control-max-age': '86400',
};

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers,
    },
  });
}

function message(error) {
  return error instanceof Error ? error.message : String(error);
}

/** Whether a job is ready to claim: queued and due, or left behind by a worker that died. */
export async function queueHasWork(env, fetchImpl = fetch) {
  const response = await fetchImpl(`${env.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/rpc/media_processing_queue_has_work`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      // graphql_public is the project's first exposed schema; name public.
      'accept-profile': 'public',
      'content-profile': 'public',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ p_worker_token: env.MEDIA_WORKER_TOKEN }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase RPC media_processing_queue_has_work failed with ${response.status}: ${text}`);
  }
  return JSON.parse(text) === true;
}

/** The container's environment: the Worker's settings, and how to behave on Cloudflare. */
export function containerEnv(env) {
  const vars = {
    SUPABASE_URL: env.SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: env.SUPABASE_PUBLISHABLE_KEY,
    MEDIA_WORKER_TOKEN: env.MEDIA_WORKER_TOKEN,
    R2_DRIVER: 's3',
    R2_ACCOUNT_ID: env.R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID: env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: env.R2_SECRET_ACCESS_KEY,
    MEDIA_WORKER_ID: 'cloudflare-container',
    MEDIA_EXIT_WHEN_IDLE_MS: String(EXIT_WHEN_IDLE_MS),
    MEDIA_FFMPEG_THREADS: String(FFMPEG_THREADS),
    ADMIN_API_PORT: String(ADMIN_PORT),
  };
  return Object.fromEntries(Object.entries(vars).filter(([, value]) => typeof value === 'string' && value !== ''));
}

/**
 * How long to wait before starting a container that keeps crashing: a minute
 * after the first crash, doubling to at most an hour. A missing setting must
 * not turn into a container started (and billed) every minute.
 */
export function startBackoffMs(crashCount) {
  if (!crashCount) return 0;
  return Math.min(60 * 60_000, 60_000 * 2 ** (crashCount - 1));
}

/** Starts the container when Supabase has work for it. `processor` is its Durable Object. */
export async function wakeIfWork(env, processor, fetchImpl = fetch) {
  if (!(await queueHasWork(env, fetchImpl))) return { woke: false, reason: 'no_work' };
  return { woke: true, ...(await processor.wake()) };
}

export async function handleFetch(request, env, processor, { fetchImpl = fetch, log = console.log } = {}) {
  const url = new URL(request.url);

  // Answered here, so a browser's preflight never starts the container.
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });

  if (url.pathname === '/wake') {
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, { allow: 'POST' });
    try {
      const result = await wakeIfWork(env, processor, fetchImpl);
      log(JSON.stringify({ at: new Date().toISOString(), status: 'wake', ...result }));
      return json(result);
    } catch (error) {
      log(JSON.stringify({ at: new Date().toISOString(), status: 'wake_failed', error: message(error) }));
      return json({ error: 'wake_failed', message: message(error) }, 502);
    }
  }

  // The Worker's own health, with the container's state; it does not start the container.
  if (url.pathname === '/health' && request.method === 'GET') {
    return json({ ok: true, service: 'cv-media-processor', container: await processor.status() });
  }

  // Coptic Vine Admin's file deletions run in the container, which checks the
  // admin's Supabase session itself. This starts the container if it is asleep.
  if (url.pathname.startsWith('/admin/')) return processor.fetch(request);

  return json({ error: 'not_found', message: 'Route not found.' }, 404);
}

export async function handleScheduled(cron, env, processor, { fetchImpl = fetch } = {}) {
  if (cron === DAILY_CLEANUP_CRON) {
    // Storage cleanup runs whenever the container starts; this makes it daily.
    return { woke: true, reason: 'daily_cleanup', ...(await processor.wake()) };
  }
  return wakeIfWork(env, processor, fetchImpl);
}
