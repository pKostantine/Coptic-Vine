import { abortActiveJobs, activeJobCount, claimAndProcessOne, getConfig } from './processor.mjs';
import { containerResources } from './runtime.mjs';
import { startAdminServer } from './admin-server.mjs';
import { purgeUnusedStorage } from './storage-gc.mjs';

// Keep the queue feeling immediate for creator uploads. One second is short
// enough that a completed upload is normally claimed before the artist has
// finished entering the rest of the submission metadata.
const IDLE_POLL_MS = Number(process.env.MEDIA_POLL_INTERVAL_MS || 1000);
// Backoff applied when the queue itself is unreachable (cv-api down, network
// blip), so a broken dependency does not turn into a request flood.
const MIN_ERROR_BACKOFF_MS = Number(process.env.MEDIA_ERROR_BACKOFF_MS || 5000);
const MAX_ERROR_BACKOFF_MS = Number(process.env.MEDIA_MAX_ERROR_BACKOFF_MS || 300000);
const STORAGE_GC_INTERVAL_MS = Number(process.env.STORAGE_GC_INTERVAL_MS || 15 * 60 * 1000);
// On Cloudflare the container is started when there is work and billed while
// it runs, so it exits once nothing has happened for this long: no job, no
// storage cleanup, no admin request. Unset (0), the worker polls forever.
const EXIT_WHEN_IDLE_MS = Number(process.env.MEDIA_EXIT_WHEN_IDLE_MS || 0);

let shuttingDown = false;
let wakeUp = null;
let adminServer = null;
let storageGcTimer = null;
let storageGcRunning = false;
let lastActivityAt = Date.now();

/** Whether anything is under way: the host asks before it lets its idle timer stop the container. */
function isBusy() {
  return activeJobCount() > 0 || storageGcRunning || (adminServer?.requestsInFlight() ?? 0) > 0;
}

function noteActivity() {
  lastActivityAt = Date.now();
}

function idleLongEnough() {
  return EXIT_WHEN_IDLE_MS > 0 && !isBusy() && Date.now() - lastActivityAt >= EXIT_WHEN_IDLE_MS;
}

function log(payload) {
  console.log(JSON.stringify({ at: new Date().toISOString(), ...payload }));
}

function sleep(durationMs) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      wakeUp = null;
      resolve();
    }, durationMs);

    // Let a shutdown signal cut the idle wait short instead of holding the
    // container open for a full poll interval.
    wakeUp = () => {
      clearTimeout(timer);
      wakeUp = null;
      resolve();
    };
  });
}

function requestShutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  log({ status: 'shutdown_requested', signal });
  // A redeploy must not cost an hour-long encode an attempt: stop it now and
  // hand it straight back to the queue for the next worker.
  abortActiveJobs('shutdown');
  adminServer?.close();
  if (storageGcTimer) clearInterval(storageGcTimer);
  wakeUp?.();
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => requestShutdown(signal));
}

async function runAutomaticStorageGc(config) {
  if (storageGcRunning || shuttingDown) return;
  storageGcRunning = true;
  try {
    const result = await purgeUnusedStorage(config, { dueOnly: true });
    log({
      status: result.skipped ? 'storage_gc_skipped' : 'storage_gc_complete',
      scannedCount: result.scannedCount,
      candidateCount: result.candidateCount,
      dueCount: result.dueCount,
      deletedObjectCount: result.deletedObjectCount,
      deletedBytes: result.deletedBytes,
      databaseRowsRemoved: result.databaseRowsRemoved,
      errorCount: result.errors.length,
      errors: result.errors.slice(0, 20),
    });
  } catch (error) {
    log({
      status: 'storage_gc_error',
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    storageGcRunning = false;
  }
}

async function main() {
  const config = getConfig();
  let consecutiveQueueErrors = 0;

  adminServer = startAdminServer(config, { onLog: log, isBusy, onActivity: noteActivity });
  // The first inventory establishes each currently-unused object's own grace
  // period. Hourly scans then remove objects individually once they have
  // remained unused for three full days.
  void runAutomaticStorageGc(config);
  storageGcTimer = setInterval(() => void runAutomaticStorageGc(config), STORAGE_GC_INTERVAL_MS);

  // What FFmpeg will be allowed to use, so Railway's logs show it at a glance.
  const resources = await containerResources().catch(() => null);
  log({
    status: 'worker_started',
    workerId: config.mediaWorkerId,
    r2Driver: config.r2Driver,
    resources,
    idlePollMs: IDLE_POLL_MS,
    storageGcIntervalMs: STORAGE_GC_INTERVAL_MS,
    exitWhenIdleMs: EXIT_WHEN_IDLE_MS || null,
  });

  while (!shuttingDown) {
    let result;

    try {
      result = await claimAndProcessOne(config);
      consecutiveQueueErrors = 0;
    } catch (error) {
      // claimAndProcessOne only throws when the queue could not be reached at
      // all; job-level failures come back as a result.
      consecutiveQueueErrors += 1;

      const backoffMs = Math.min(
        MIN_ERROR_BACKOFF_MS * 2 ** (consecutiveQueueErrors - 1),
        MAX_ERROR_BACKOFF_MS,
      );

      log({
        status: 'queue_unavailable',
        error: error instanceof Error ? error.message : String(error),
        consecutiveErrors: consecutiveQueueErrors,
        retryInMs: backoffMs,
      });

      // An unreachable queue is no reason to keep a billed container up: the
      // host starts it again the next time it finds work.
      if (idleLongEnough()) break;
      await sleep(backoffMs);
      continue;
    }

    if (result.status === 'no_job') {
      if (idleLongEnough()) break;
      await sleep(IDLE_POLL_MS);
      continue;
    }

    noteActivity();
    log(result);
    // Keep claiming while there is work: only an empty queue pauses the loop.
  }

  if (!shuttingDown) {
    // Idle: stop like a shutdown would, minus the job hand-back (there is none).
    log({ status: 'idle_exit', idleMs: Date.now() - lastActivityAt });
    adminServer?.close();
    if (storageGcTimer) clearInterval(storageGcTimer);
  }
  log({ status: 'worker_stopped' });
  // Idle keep-alive sockets (cv-api, R2) must not hold a finished container open.
  if (EXIT_WHEN_IDLE_MS > 0) setTimeout(() => process.exit(0), 1000).unref();
}

main().catch((error) => {
  console.error(JSON.stringify({
    status: 'fatal',
    error: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exit(1);
});
