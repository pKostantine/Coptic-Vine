# Media processor on Cloudflare

Since October 2026 the media processor runs as a **Cloudflare Container**. It
used to run on Railway, around the clock. Now it starts when a file is waiting
to be processed and shuts itself off when the queue is empty. The processing
code itself is unchanged; [README.md](README.md) describes what it does to
each file. This document covers where and when it runs.

## How it works

```
upload or retry queued in cv-api (D1)
  └─ cv-api's wake-up ──► POST https://cv-media-processor.hrmpdd8d6c.workers.dev/wake
                            └─ Worker asks cv-api: is a job ready?
                                 └─ yes ─► start the container (1–3 s)
                                             └─ processes every waiting job,
                                                then exits after 20 s with nothing to do
```

- **Wake-up on upload.** When a job is queued (a new upload, a retry, or an
  admin's "force"), a database trigger calls the Worker's `/wake` through
  `pg_net`. The Worker starts the container only if
  `media_processing_queue_has_work` says a job is due, because a running
  container is billed.
- **Every minute.** The Worker also checks the queue each minute. This catches
  retries that come due later, a job whose worker died mid-way, and any
  wake-up call that got lost.
- **Daily, 09:17 UTC.** The Worker starts the container even with nothing
  queued. Storage cleanup runs at every start, so this keeps it at least daily.
- **Exit when idle.** In the container, `MEDIA_EXIT_WHEN_IDLE_MS=20000` makes
  the worker exit once 20 seconds pass with no job, no storage cleanup and no
  admin request. Billing stops then.
- **Long videos are never cut off.** The Durable Object's idle timer (5 min)
  counts only requests, not FFmpeg. When it lapses, the Worker asks the
  container's `/health`, and if `busy` is true it leaves it running and asks
  again later. An encode can run for hours. Original files are streamed from
  R2 and never copied to disk, and the MP4 uploads while it is being made, so
  a 20 GB original fits in the 20 GB disk.
- **Shutdowns hand the job back.** If Cloudflare stops the container (a
  deploy, host maintenance), the worker gets `SIGTERM`, stops FFmpeg and
  returns the job to the queue without spending an attempt. The next start
  begins it again.
- **Crash backoff.** If the container exits with an error (a missing
  setting, say), the Worker waits before starting it again: 1 minute, then
  2, 4 and so on, up to an hour. A clean exit clears the count. Without
  this, a broken setting would mean a billed start every minute.

## Size and cost

`instance_type: standard-4`: 4 vCPU, 12 GiB memory, 20 GB disk, one instance.
Cloudflare bills memory and disk for every second the container runs, and CPU
only while it is actually used. An encode costs about the same on 4 vCPUs as
on 2, and finishes twice as fast. FFmpeg is told to use 4 threads
(`MEDIA_FFMPEG_THREADS`); retries still use fewer.

The Workers Paid plan ($5/month) includes, each month, 25 GiB-hours of
memory, 375 vCPU-minutes, 200 GB-hours of disk and 1 TB of data out. Above
that, the rates are:

| Resource | Rate |
| -------- | ---- |
| Memory | $0.0000025 per GiB-second |
| CPU | $0.000020 per vCPU-second |
| Disk | $0.00000007 per GB-second |
| Data out | $0.025 per GB |

Each start costs roughly 25 seconds of idle time (start-up plus the 20 s
wait), about 0.08 GiB-hours. A normal month of uploads fits inside the $5. A
long lesson video costs extra only once the included amounts are used up. To
see real usage, open Cloudflare dashboard → Workers & Pages →
cv-media-processor → Containers.

## Files

| File | What it is |
| ---- | ---------- |
| `wrangler.jsonc` | The Worker, its container, crons and public settings |
| `cloudflare/routes.js` | When the container runs: `/wake`, crons, `/health`, admin pass-through, crash backoff |
| `cloudflare/host.js` | The `MediaProcessor` Durable Object that owns the container |
| `Dockerfile`, `src/` | The container: the processor itself |
| `src/worker.mjs` | `MEDIA_EXIT_WHEN_IDLE_MS`: exit when idle |
| `src/admin-server.mjs` | `/health` reports `busy` |
| `../api/src/rpc/workers/media.ts`, `../api/src/db/afterWrites.ts` | `media_processing_queue_has_work`, and cv-api's wake-up after a job is queued |
| `tests/cloudflare-host.test.mjs`, `tests/idle-exit.test.mjs` | Tests for all of the above |

## Settings

Public settings are in `wrangler.jsonc` under `vars`: `API_URL` (cv-api) and
`R2_ACCOUNT_ID`.

Three secrets are set once and kept by Cloudflare across deploys. Run these
from the `Coptic-Vine` folder; each one asks for the value:

```bash
npx wrangler secret put MEDIA_WORKER_TOKEN -c workers/media-processor/wrangler.jsonc
npx wrangler secret put R2_ACCESS_KEY_ID -c workers/media-processor/wrangler.jsonc
npx wrangler secret put R2_SECRET_ACCESS_KEY -c workers/media-processor/wrangler.jsonc
```

- `MEDIA_WORKER_TOKEN` must match a row in `private.media_worker_tokens`
  (which stores its SHA-256).
- The R2 keys need read, write and delete on `chc-submissions`, `chc-music`,
  `chc-learning` and `chc-images`. Create them under R2 → Manage API tokens.

The Worker passes all of these to the container when it starts
(`containerEnv` in `cloudflare/routes.js`).

## Deploying

Docker must be running (OrbStack on the Mac), because Wrangler builds the
image locally for `linux/amd64` and pushes it to Cloudflare:

```bash
cd workers/media-processor
npm run deploy
```

A deploy replaces a running container, so a video being converted at that
moment starts over. To avoid this, check Admin's Processing screen first.

## Endpoints

| Route | Does |
| ----- | ---- |
| `POST /wake` | Starts the container if a job is due. Returns `{ woke, started }` |
| `GET /health` | The Worker's health and the container's state, including any crash record. Does not start it |
| `DELETE /admin/processing-jobs/:id/file`, `DELETE /admin/storage/unused` | Coptic Vine Admin's deletions. They start the container; it checks the admin's cv-api session |

## Checking on it

- `curl https://cv-media-processor.hrmpdd8d6c.workers.dev/health` shows the
  container's state: `running` true or false, plus `crashes` if any.
- Logs: Cloudflare dashboard → cv-media-processor → Logs, or
  `npx wrangler tail -c workers/media-processor/wrangler.jsonc`.
- Jobs: Admin's Processing screen, or `media.media_processing_jobs`.

## Testing

Run `npm test` in this folder; it covers the processor, the idle exit and the
Worker. To run the real Worker and container locally, with Docker running:

```bash
npx wrangler dev -c workers/media-processor/wrangler.jsonc --port 8799 --test-scheduled \
  --var API_URL:http://localhost:8790 --var MEDIA_WORKER_TOKEN:test-token \
  --var R2_ACCESS_KEY_ID:x --var R2_SECRET_ACCESS_KEY:y
```

Then use `curl -X POST localhost:8799/wake`, or
`curl 'localhost:8799/__scheduled?cron=*+*+*+*+*'` to fire a cron.

## Railway

The Railway service is retired. The same image still runs on any always-on
host: leave `MEDIA_EXIT_WHEN_IDLE_MS` unset and the worker polls forever, as
it did there.
