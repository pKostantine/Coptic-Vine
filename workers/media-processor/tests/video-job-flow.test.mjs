import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import ffmpegPath from 'ffmpeg-static';
import { fakeR2 } from './helpers/fake-r2.mjs';

process.env.MEDIA_HEARTBEAT_MS = '100';
const { abortActiveJobs, claimAndProcessOne, setS3ClientFactoryForTests } = await import('../src/processor.mjs');

let dir;
let phone;
let long;

function ffmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, ['-y', '-hide_banner', '-loglevel', 'error', ...args]);
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', (code) => (code === 0 ? resolve() : reject(new Error(stderr))));
  });
}

before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'coptic-vine-video-flow-'));
  const phonePath = path.join(dir, 'phone.mov');
  await ffmpeg([
    '-f', 'lavfi', '-i', 'testsrc2=size=1920x1080:rate=60:duration=3',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-b:v', '20M', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-shortest', phonePath,
  ]);
  phone = await readFile(phonePath);
  const longPath = path.join(dir, 'long.mov');
  await ffmpeg([
    '-f', 'lavfi', '-i', 'testsrc2=size=1920x1080:rate=60:duration=30',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=30',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-b:v', '20M', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-shortest', longPath,
  ]);
  long = await readFile(longPath);
});
after(async () => {
  setS3ClientFactoryForTests(null);
  await rm(dir, { recursive: true, force: true });
});

async function fakeApi(handlers) {
  const calls = [];
  const server = http.createServer((request, response) => {
    let raw = '';
    request.on('data', (chunk) => { raw += chunk; });
    request.on('end', async () => {
      const name = request.url.replace('/rest/v1/rpc/', '');
      const payload = raw ? JSON.parse(raw) : {};
      calls.push({ name, payload });
      const handler = handlers[name];
      if (!handler) {
        response.writeHead(404, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ code: 'PGRST202', message: `Could not find the function public.${name}` }));
        return;
      }
      const rows = await handler(payload, calls);
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(rows));
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    calls,
    named: (name) => calls.filter((call) => call.name === name),
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

function setup(original) {
  const storage = fakeR2({ 'chc-submissions/submissions/a/intent-1/original.mov': original });
  setS3ClientFactoryForTests(() => storage);
  const videoJob = {
    job_id: 'video-1',
    upload_intent_id: 'intent-1',
    job_type: 'video_delivery',
    media_type: 'video',
    attempt_count: 1,
    max_attempts: 3,
    input_bucket: 'chc-submissions',
    input_path: 'submissions/a/intent-1/original.mov',
    output_bucket: 'chc-learning',
    output_path: 'processed/a/intent-1/v1/video.mp4',
  };
  const companion = {
    job_id: 'audio-1',
    job_type: 'audio_delivery',
    attempt_count: 1,
    max_attempts: 3,
    output_bucket: 'chc-learning',
    output_path: 'processed/a/intent-1/v1/audio.m4a',
  };
  return { storage, videoJob, companion };
}

function configFor(api) {
  return {
    apiUrl: api.url,
    mediaWorkerToken: 'worker-token',
    mediaWorkerId: 'test-worker',
    r2Driver: 's3',
    workDir: dir,
  };
}

test('a lesson video, its audio-only copy and the original\'s removal, in one claim', async () => {
  const { storage, videoJob, companion } = setup(phone);
  let claimed = false;
  const api = await fakeApi({
    claim_media_processing_job: () => (claimed ? [] : ((claimed = true), [videoJob])),
    claim_companion_media_processing_job: (payload) => {
      assert.equal(payload.p_job_id, 'video-1');
      return [companion];
    },
    heartbeat_media_processing_jobs: (payload) => payload.p_job_ids.map((id) => ({ job_id: id, status: 'processing' })),
    complete_media_processing_job: () => [{ status: 'completed' }],
    claim_media_original_deletion: (payload) => {
      assert.equal(payload.p_upload_intent_id, 'intent-1');
      return [{ bucket: 'chc-submissions', path: 'submissions/a/intent-1/original.mov' }];
    },
  });
  try {
    const result = await claimAndProcessOne(configFor(api));
    assert.equal(result.status, 'completed', JSON.stringify(result));
    assert.equal(result.audioOnly.status, 'completed');
    assert.equal(result.originalDeleted, true);

    const completions = api.named('complete_media_processing_job');
    assert.deepEqual(completions.map((call) => call.payload.p_job_id), ['audio-1', 'video-1']);
    assert.equal(completions[0].payload.p_output_mime_type, 'audio/mp4');
    assert.equal(completions[0].payload.p_probe.transcode.madeWith, 'video_pass');
    assert.equal(completions[1].payload.p_output_mime_type, 'video/mp4');
    assert.equal(completions[1].payload.p_probe.transcode.preset, 'veryfast');
    assert.match(completions[1].payload.p_output_checksum_sha256, /^[a-f0-9]{64}$/);

    const beats = api.named('heartbeat_media_processing_jobs');
    assert.ok(beats.length >= 1);
    assert.deepEqual(beats[0].payload.p_job_ids, ['video-1', 'audio-1']);

    assert.equal(storage.objects.has('chc-submissions/submissions/a/intent-1/original.mov'), false, 'the original is gone');
    assert.ok(storage.objects.get('chc-learning/processed/a/intent-1/v1/video.mp4').length > 0);
    assert.ok(storage.objects.get('chc-learning/processed/a/intent-1/v1/audio.m4a').length > 0);
    assert.equal(api.named('fail_media_processing_job').length, 0);
  } finally {
    await api.close();
  }
});

test('before the database migration the video still converts and the original is kept', async () => {
  const { storage, videoJob } = setup(phone);
  let claimed = false;
  const api = await fakeApi({
    claim_media_processing_job: () => (claimed ? [] : ((claimed = true), [videoJob])),
    complete_media_processing_job: () => [{ status: 'completed' }],
  });
  try {
    const result = await claimAndProcessOne(configFor(api));
    assert.equal(result.status, 'completed', JSON.stringify(result));
    assert.equal(result.audioOnly, null);
    assert.equal(result.originalDeleted, false);
    assert.deepEqual(api.named('complete_media_processing_job').map((call) => call.payload.p_job_id), ['video-1']);
    assert.ok(storage.objects.has('chc-submissions/submissions/a/intent-1/original.mov'));
  } finally {
    await api.close();
  }
});

test('a job an admin cancels stops at the next heartbeat without completing or failing', async () => {
  const { videoJob, companion } = setup(long);
  let beats = 0;
  const api = await fakeApi({
    claim_media_processing_job: () => [{ ...videoJob, job_id: 'video-cancel' }],
    claim_companion_media_processing_job: () => [companion],
    heartbeat_media_processing_jobs: (payload) => {
      beats += 1;
      return payload.p_job_ids.map((id) => ({ job_id: id, status: beats >= 3 ? 'cancelled' : 'processing' }));
    },
    complete_media_processing_job: () => { throw new Error('must not complete'); },
  });
  try {
    const result = await claimAndProcessOne(configFor(api));
    assert.equal(result.status, 'cancelled', JSON.stringify(result));
    assert.equal(api.named('complete_media_processing_job').length, 0);
    assert.equal(api.named('fail_media_processing_job').length, 0);
  } finally {
    await api.close();
  }
});

test('a worker shutting down hands both jobs back without spending an attempt', async () => {
  const { videoJob, companion } = setup(long);
  const api = await fakeApi({
    claim_media_processing_job: () => [{ ...videoJob, job_id: 'video-stop' }],
    claim_companion_media_processing_job: () => [companion],
    heartbeat_media_processing_jobs: (payload) => payload.p_job_ids.map((id) => ({ job_id: id, status: 'processing' })),
    release_media_processing_jobs: (payload) => [payload.p_job_ids.length],
  });
  try {
    setTimeout(() => abortActiveJobs('shutdown'), 1500);
    const result = await claimAndProcessOne(configFor(api));
    assert.equal(result.status, 'released', JSON.stringify(result));
    const releases = api.named('release_media_processing_jobs');
    assert.equal(releases.length, 1);
    assert.deepEqual(releases[0].payload.p_job_ids, ['video-stop', 'audio-1']);
    assert.equal(api.named('fail_media_processing_job').length, 0);
  } finally {
    await api.close();
  }
});
