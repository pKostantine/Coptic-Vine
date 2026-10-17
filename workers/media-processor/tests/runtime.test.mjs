import assert from 'node:assert/strict';
import { test } from 'node:test';
import { describeFfmpegExit, ffmpegThreadsFor, threadsForAttempt } from '../src/runtime.mjs';

const GIB = 1024 ** 3;

test('FFmpeg threads follow the real limits, and stay modest when the memory limit is unknown', () => {
  assert.equal(ffmpegThreadsFor(8, 8 * GIB, { override: '' }), 8);
  assert.equal(ffmpegThreadsFor(8, 1 * GIB, { override: '' }), 3, 'a 1 GB service never gets more than three');
  assert.equal(ffmpegThreadsFor(8, 2 * GIB, { override: '' }), 6);
  assert.equal(ffmpegThreadsFor(48, 256 * GIB, { memoryKnown: false, override: '' }), 4, "the host's RAM is not this service's");
  assert.equal(ffmpegThreadsFor(64, 512 * GIB, { override: '' }), 16);
  assert.equal(ffmpegThreadsFor(48, 256 * GIB, { memoryKnown: false, override: '12' }), 12, 'MEDIA_FFMPEG_THREADS wins');
});

test('each retry uses fewer threads, so a job killed for memory fits next time', () => {
  assert.deepEqual([1, 2, 3, 4].map((attempt) => threadsForAttempt(8, attempt)), [8, 4, 2, 2]);
  assert.deepEqual([1, 2, 3].map((attempt) => threadsForAttempt(3, attempt)), [3, 2, 2]);
  assert.equal(threadsForAttempt(1, 3), 1);
  assert.equal(threadsForAttempt(6, undefined), 6);
});

test('a killed FFmpeg says why instead of "null"', () => {
  assert.match(describeFfmpegExit(null, 'SIGKILL'), /too much memory/);
  assert.match(describeFfmpegExit(null, null), /too much memory/);
  assert.equal(describeFfmpegExit(null, 'SIGTERM'), 'FFmpeg was stopped by SIGTERM');
  assert.equal(describeFfmpegExit(1, null), 'FFmpeg exited with code 1');
});
