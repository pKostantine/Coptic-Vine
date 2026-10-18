import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, open, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import ffmpegPath from 'ffmpeg-static';

import { GrowingFileUploader } from '../src/growing-upload.mjs';
import { openR2RangeServer, probeUrl } from '../src/streamed-media.mjs';
import {
  buildVideoFfmpegArgs,
  convertVideo,
  JobAbortError,
  planVideoDelivery,
} from '../src/video-delivery.mjs';
import { fakeR2 } from './helpers/fake-r2.mjs';

let dir;
const sources = {};

function ffmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, ['-y', '-hide_banner', '-loglevel', 'error', ...args]);
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', (code) => (code === 0 ? resolve() : reject(new Error(stderr))));
  });
}

async function decodesCleanly(filePath) {
  await ffmpeg(['-xerror', '-i', filePath, '-f', 'null', '-']);
}

before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'coptic-vine-video-delivery-'));
  // A phone-like original: 1080p at 60 fps, high bitrate, AAC sound.
  sources.phone = path.join(dir, 'phone.mov');
  await ffmpeg([
    '-f', 'lavfi', '-i', 'testsrc2=size=1920x1080:rate=60:duration=4',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=4',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-b:v', '20M', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-shortest', sources.phone,
  ]);
  // Already a compact delivery file: copied, not re-encoded.
  sources.compact = path.join(dir, 'compact.mp4');
  await ffmpeg([
    '-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=30:duration=3',
    '-f', 'lavfi', '-i', 'sine=frequency=330:duration=3',
    '-c:v', 'libx264', '-preset', 'veryfast', '-b:v', '600k', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-shortest', sources.compact,
  ]);
  // A screen recording with no sound.
  sources.silent = path.join(dir, 'silent.mp4');
  await ffmpeg([
    '-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=30:duration=2',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-b:v', '12M', '-pix_fmt', 'yuv420p', sources.silent,
  ]);
  // Long enough to abort part-way.
  sources.long = path.join(dir, 'long.mp4');
  await ffmpeg([
    '-f', 'lavfi', '-i', 'testsrc2=size=1920x1080:rate=60:duration=30',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-b:v', '20M', '-pix_fmt', 'yuv420p', sources.long,
  ]);
});
after(async () => { await rm(dir, { recursive: true, force: true }); });

function videoJob(id, key) {
  return {
    job_id: id,
    upload_intent_id: `intent-${id}`,
    job_type: 'video_delivery',
    input_bucket: 'chc-submissions',
    input_path: key,
    output_bucket: 'chc-learning',
    output_path: `processed/${id}/video.mp4`,
  };
}

async function storageWith(name) {
  return fakeR2({ [`chc-submissions/originals/${name}`]: await readFile(sources[name]) });
}

test('plans: a 4K 60 fps HDR phone video is scaled, slowed to 30 fps and tone-mapped; compact H.264 is copied', () => {
  const filters = new Set(['zscale', 'tonemap']);
  const phone = planVideoDelivery({
    format: { duration: '600', bit_rate: '50000000' },
    streams: [
      { codec_type: 'video', codec_name: 'hevc', width: 3840, height: 2160, avg_frame_rate: '60/1', pix_fmt: 'yuv420p10le', color_transfer: 'arib-std-b67', bit_rate: '48000000' },
      { codec_type: 'audio', codec_name: 'aac', bit_rate: '192000' },
    ],
  }, { filters });
  assert.equal(phone.copyVideo, false);
  assert.equal(phone.videoFilters[0], 'fps=30');
  assert.ok(phone.videoFilters.some((filter) => filter.startsWith('scale=')));
  assert.ok(phone.videoFilters.some((filter) => filter.startsWith('tonemap=')));
  assert.equal(phone.toneMapped, true);
  assert.equal(phone.audioMode, 'copy');
  assert.equal(phone.gop, 120);
  // Bounded by the 6 Mbit/s cap, not the 48 Mbit/s source.
  assert.ok(phone.estimatedVideoBytes < 6_500_000 * 600 / 8);

  const compact = planVideoDelivery({
    format: { duration: '60', bit_rate: '3000000' },
    streams: [
      { codec_type: 'video', codec_name: 'h264', width: 1920, height: 1080, avg_frame_rate: '30000/1001', pix_fmt: 'yuv420p', bit_rate: '2800000' },
      { codec_type: 'audio', codec_name: 'mp3', bit_rate: '128000' },
    ],
  });
  assert.equal(compact.copyVideo, true);
  assert.deepEqual(compact.videoFilters, []);
  assert.equal(compact.audioMode, 'encode');

  // A portrait phone video keeps 1080 across its short edge.
  const portrait = planVideoDelivery({
    format: { duration: '10' },
    streams: [{ codec_type: 'video', codec_name: 'hevc', width: 2160, height: 3840, avg_frame_rate: '30/1', pix_fmt: 'yuv420p' }],
  });
  assert.match(portrait.videoFilters.join(','), /if\(gte\(iw,ih\),-2,min\(1080,iw\)\)/);
  assert.equal(portrait.audioMode, 'none');

  assert.throws(() => planVideoDelivery({ streams: [{ codec_type: 'audio', codec_name: 'aac' }] }), /no video stream/);
});

test('the FFmpeg command bounds decoder threads, strips metadata and makes the audio-only copy in the same pass', () => {
  const plan = planVideoDelivery({
    format: { duration: '100' },
    streams: [
      { codec_type: 'video', codec_name: 'hevc', width: 1920, height: 1080, avg_frame_rate: '30/1', pix_fmt: 'yuv420p' },
      { codec_type: 'audio', codec_name: 'aac' },
    ],
  });
  const args = buildVideoFfmpegArgs({
    inputUrl: 'http://127.0.0.1:1/media.mov',
    plan,
    threads: 4,
    videoOutput: { kind: 'file', path: '/tmp/video.mp4' },
    audioOnlyPath: '/tmp/audio.m4a',
  });
  const input = args.indexOf('-i');
  assert.equal(args[args.indexOf('-threads')], '-threads');
  assert.ok(args.indexOf('-threads') < input, 'decoder threads are set before the input');
  assert.equal(args[args.indexOf('-threads') + 1], '4');
  assert.ok(args.includes('-reconnect'));
  assert.equal(args[args.indexOf('-preset') + 1], 'veryfast');
  assert.equal(args[args.indexOf('-crf') + 1], '23');
  assert.equal(args.filter((arg) => arg === '-map_metadata').length, 2);
  assert.ok(args.indexOf('/tmp/video.mp4') < args.indexOf('/tmp/audio.m4a'));
  assert.equal(args[args.lastIndexOf('-c:a') + 1], 'copy');
  assert.ok(!args.slice(0, args.indexOf('/tmp/video.mp4')).includes('+faststart'), 'the growing MP4 keeps its index at the end');

  const piped = buildVideoFfmpegArgs({ inputUrl: 'x', plan, threads: 2, videoOutput: { kind: 'pipe' } });
  assert.ok(piped.includes('pipe:1'));
  assert.ok(piped.includes('+frag_keyframe+empty_moov+default_base_moof'));
  assert.ok(!piped.includes('/tmp/audio.m4a'));
});

test('a file uploaded while FFmpeg writes it arrives byte-for-byte, its first part once FFmpeg is done', async () => {
  const client = fakeR2();
  const output = path.join(dir, 'growing.mp4');
  const uploader = new GrowingFileUploader({
    client, bucket: 'chc-learning', key: 'growing.mp4', filePath: output, contentType: 'video/mp4', partBytes: 256 * 1024,
  });
  await uploader.start();
  const encode = ffmpeg([
    '-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=30:duration=20',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=20',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', '-c:a', 'aac', '-f', 'mp4', output,
  ]);
  let running = true;
  const pumping = (async () => {
    while (running) {
      await uploader.pump();
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  })();
  const partUploads = () => client.log.filter((entry) => entry.command === 'UploadPartCommand').map((entry) => entry.partNumber);
  await encode;
  const duringEncode = partUploads();
  running = false;
  await pumping;
  const result = await uploader.finish();

  const stored = client.objects.get('chc-learning/growing.mp4');
  assert.deepEqual(stored, await readFile(output));
  assert.ok(result.partsCount > 10, `expected many parts, got ${result.partsCount}`);
  assert.ok(duringEncode.includes(2), 'later parts uploaded during the encode');
  // The first part holds the header FFmpeg patches as it exits. finish() sends
  // it alongside the last few parts, so which of them reaches R2 first varies.
  assert.ok(!duringEncode.includes(1), 'the first part waits for FFmpeg to exit');
  assert.deepEqual(partUploads().filter((part) => part === 1), [1], 'the first part uploads exactly once');
});

test('freeing uploaded parts never touches bytes FFmpeg still needs', async () => {
  const client = fakeR2();
  const output = path.join(dir, 'freeing.mp4');
  const punched = [];
  // Stand-in for fallocate: actually destroy the bytes, as a real hole would.
  const punchHole = async (file, offset, length) => {
    punched.push([offset, length]);
    const handle = await open(file, 'r+');
    try {
      await handle.write(Buffer.alloc(length), 0, length, offset);
    } finally {
      await handle.close();
    }
  };
  const partBytes = 128 * 1024;
  const uploader = new GrowingFileUploader({
    client, bucket: 'chc-learning', key: 'freeing.mp4', filePath: output, contentType: 'video/mp4',
    partBytes, freeUploadedBytes: true, punchHole,
  });
  await uploader.start();
  const encode = ffmpeg([
    '-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=30:duration=12',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-f', 'mp4', output,
  ]);
  let running = true;
  const pumping = (async () => {
    while (running) {
      await uploader.pump();
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  })();
  await encode;
  running = false;
  await pumping;
  await uploader.finish();

  assert.ok(punched.length > 3);
  assert.ok(punched.every(([offset, length]) => offset >= partBytes && offset % partBytes === 0 && length > 0));
  const stored = path.join(dir, 'freeing-stored.mp4');
  const handle = await open(stored, 'w');
  await handle.write(client.objects.get('chc-learning/freeing.mp4'));
  await handle.close();
  await decodesCleanly(stored);
  const probe = await probeUrl(stored);
  assert.ok(Math.abs(Number(probe.format.duration) - 12) < 0.5);
});

test('the range server survives dropped and failed R2 reads', async () => {
  const bytes = await readFile(sources.compact);
  const client = fakeR2({ 'chc-submissions/flaky.mp4': bytes }, { faults: { failEvery: 3, truncateEvery: 4 } });
  const info = await client.send(new (await import('@aws-sdk/client-s3')).HeadObjectCommand({ Bucket: 'chc-submissions', Key: 'flaky.mp4' }));
  const server = await openR2RangeServer(client, 'chc-submissions', 'flaky.mp4', info, { windowBytes: 64 * 1024 });
  try {
    const whole = Buffer.from(await (await fetch(server.url)).arrayBuffer());
    assert.equal(createHash('sha256').update(whole).digest('hex'), createHash('sha256').update(bytes).digest('hex'));
    const ranged = await fetch(server.url, { headers: { Range: 'bytes=70000-209999' } });
    assert.equal(ranged.status, 206);
    assert.deepEqual(Buffer.from(await ranged.arrayBuffer()), bytes.subarray(70000, 210000));
    const probe = await probeUrl(server.url);
    assert.ok(probe.streams.some((stream) => stream.codec_name === 'h264'));
  } finally {
    await server.close();
  }
});

test('a phone video becomes a 30 fps H.264 MP4 and an audio-only M4A in one pass, uploaded while encoding', async () => {
  const client = await storageWith('phone');
  const job = videoJob('phone', 'originals/phone');
  const progress = [];
  const result = await convertVideo({
    client, job, wantsAudio: true, workDir: dir, partBytes: 64 * 1024, onProgress: (value) => progress.push(value),
  });
  try {
    assert.equal(result.plan.copyVideo, false);
    assert.equal(result.mode, 'file');
    const stored = client.objects.get('chc-learning/processed/phone/video.mp4');
    assert.equal(stored.length, result.video.sizeBytes);
    assert.equal(result.video.sha256, createHash('sha256').update(stored).digest('hex'));
    const video = result.video.probe.streams.find((stream) => stream.codec_type === 'video');
    assert.equal(video.codec_name, 'h264');
    assert.equal(video.avg_frame_rate, '30/1');
    assert.ok(Math.abs(Number(result.video.probe.format.duration) - 4) < 0.3);
    assert.ok(stored.length < (await readFile(sources.phone)).length / 2, 'the delivery file is much smaller');
    assert.ok(progress.length > 0 && progress.at(-1) >= 0.97);

    assert.ok(result.audio?.path);
    assert.equal(result.audio.mode, 'copy');
    assert.equal(result.audio.probe.streams.find((stream) => stream.codec_type === 'audio').codec_name, 'aac');
    assert.ok(!result.audio.probe.streams.some((stream) => stream.codec_type === 'video'));
  } finally {
    await result.cleanup();
  }
});

test('compact H.264 is copied, and the fragmented fallback still produces a checked MP4', async () => {
  const copied = await convertVideo({
    client: await storageWith('compact'), job: videoJob('compact', 'originals/compact'), wantsAudio: false, workDir: dir,
  });
  await copied.cleanup();
  assert.equal(copied.plan.copyVideo, true);
  assert.equal(copied.audio, null);

  const client = await storageWith('phone');
  const piped = await convertVideo({
    client, job: videoJob('piped', 'originals/phone'), wantsAudio: true, workDir: dir, forceMode: 'pipe', partBytes: 64 * 1024,
  });
  await piped.cleanup();
  assert.equal(piped.mode, 'pipe');
  const stored = client.objects.get('chc-learning/processed/piped/video.mp4');
  assert.equal(piped.video.sha256, createHash('sha256').update(stored).digest('hex'));
  assert.ok(piped.audio?.path);
});

test('a silent video has no audio-only copy to make', async () => {
  const result = await convertVideo({
    client: await storageWith('silent'), job: videoJob('silent', 'originals/silent'), wantsAudio: true, workDir: dir,
  });
  await result.cleanup();
  assert.deepEqual(result.audio, { silent: true });
  assert.equal(result.plan.audioMode, 'none');
});

test('stopping a conversion kills FFmpeg and leaves nothing stored', async () => {
  const client = await storageWith('long');
  const control = new AbortController();
  setTimeout(() => control.abort(new JobAbortError('shutdown', 'stop')), 1500);
  await assert.rejects(
    convertVideo({ client, job: videoJob('long', 'originals/long'), wantsAudio: false, workDir: dir, signal: control.signal, partBytes: 64 * 1024 }),
    (error) => error instanceof JobAbortError && error.kind === 'shutdown',
  );
  assert.equal(client.objects.has('chc-learning/processed/long/video.mp4'), false);
  assert.equal(client.pending.size, 0, 'the multipart upload was aborted');
});
