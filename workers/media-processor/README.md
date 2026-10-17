# Coptic Vine Media Processor

FFmpeg worker that turns uploaded submission files into delivery assets.

## Runtime

The worker claims a queued Supabase processing job, downloads the source object
from private R2, probes it, produces the delivery rendition, uploads it to the
delivery bucket, and completes the job in Supabase. Completing a job writes the
`media.media_assets` row, links it to the submission item, and — when it was the
last item a submission was waiting on — takes that submission out of
`processing` so it can be published.

Job types it handles:

| Job type         | Source | Output             | Delivery bucket |
| ---------------- | ------ | ------------------ | --------------- |
| `audio_delivery` | audio  | AAC-LC M4A; existing AAC is fast-remuxed, other codecs encode at `256k` | `chc-music` / `chc-learning` |
| `video_delivery` | video  | H.264 MP4, ≤1080p, plus its audio-only M4A in the same pass | `chc-learning`  |
| `image_delivery` | image  | JPEG, ≤3000px edge | `chc-images`    |

Images are flattened onto white (so a transparent PNG does not go black),
forced to square pixels, and capped at 3000px on the longer edge without ever
being upscaled.

Required environment:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `MEDIA_WORKER_TOKEN`

Production R2 S3 mode:

- `R2_DRIVER=s3`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`

Local workspace fallback:

- `R2_DRIVER=wrangler`
- authenticated Wrangler CLI

Optional:

- `MEDIA_WORKER_ID` — identifies this worker on claimed jobs (default `media-processor-<pid>`)
- `MEDIA_POLL_INTERVAL_MS` — idle poll interval, default `1000`
- `MEDIA_ERROR_BACKOFF_MS` / `MEDIA_MAX_ERROR_BACKOFF_MS` — backoff when Supabase is unreachable, default `5000` / `300000`
- `MEDIA_WORK_DIR` — scratch directory, default the OS temp dir
- `MEDIA_KEEP_WORK_DIR=1` — keep the per-job scratch directory for debugging
- `STORAGE_GC_INTERVAL_MS` — physical R2 inventory interval, default 15 minutes

## Commands

```bash
npm install

# Long-lived worker: drains the queue, then polls. This is what deployments run.
npm start

# Single job, then exit. Useful for manual runs and smoke tests.
npm run process:once
```

```bash
docker build -t coptic-vine-media-processor .
docker run --env-file .env coptic-vine-media-processor
```

## Failure handling

A job failure never stops the worker. The failure is reported to
`fail_media_processing_job`, which requeues the job with exponential backoff
(4 min, 16 min, capped at 1 hour) until `max_attempts` is reached, then marks it
`failed` and records a `processing_failed` event on the submission so the error
is visible in review rather than leaving the submission stuck in `processing`.

`SIGINT` / `SIGTERM` stop the job in flight and hand it straight back to the
queue (`release_media_processing_jobs`, which does not spend an attempt), then
exit.

While a job runs the worker calls `heartbeat_media_processing_jobs` every 20
seconds with its progress. A job whose heartbeat stops for five minutes is
retried (or, on its last attempt, failed with a visible error) by the next
claim, and a job an admin cancels or deletes stops at the next heartbeat.

## Video lessons

A `video_delivery` job claims its `audio_delivery` companion
(`claim_companion_media_processing_job`) and makes both in **one FFmpeg pass**:

- The original is read straight from private R2 through a localhost HTTP Range
  server, in 16 MB reads that are retried on their own, so a dropped R2
  connection never stops the encode and the original never touches the disk.
- Video: H.264 `veryfast` at CRF 23, short edge capped at 1080 (portrait phone
  videos stay sharp), at most 30 fps and 6 Mbit/s peaks; HDR phone video is
  tone-mapped to SDR. Compact H.264 sources (≤1080, ≤30 fps, ≤8 Mbit/s) are
  copied instead of re-encoded. GPS and device metadata are stripped.
- FFmpeg's thread count follows the container's real CPU and memory limits
  (cgroups), not the host's, including for decoding (`MEDIA_FFMPEG_THREADS`
  overrides it).
- The MP4 (index at the end, so every player can seek) uploads to R2 while it
  is being encoded: FFmpeg only ever rewrites the first few bytes of an MP4, so
  every later 32 MB part is final once written. If the disk is too small for
  the whole rendition, each uploaded part's blocks are given back
  (`fallocate --punch-hole`); without that, it falls back to a streamed
  fragmented MP4.
- The output is checked against the source (codec, container, and duration
  within 1%, so a conversion that stopped early is never published).
- Once both the MP4 and the audio-only M4A exist, `claim_media_original_deletion`
  marks the original removed and the worker deletes it from
  `chc-submissions`. Storage GC removes it later if that deletion failed.


## Unused storage garbage collection

The production worker inventories `chc-submissions`, `chc-music`,
`chc-learning`, and `chc-images`. Each physical object that has no active
submission, catalog, profile, playlist, lesson, or processing reference gets
its own unused timestamp. If it remains unused for three full days, the worker
removes the R2 object and its orphaned media metadata. If the object becomes
referenced again during the grace period, its unused clock is discarded.

Coptic Vine Admin can explicitly bypass the three-day grace period from the Processing
screen with **Delete all unused files**. That action performs a fresh inventory
and deletes only objects that are still unreferenced at deletion time.
