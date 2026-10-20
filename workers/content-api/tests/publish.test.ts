/**
 * The minute check that starts the offline-book build (src/publish.ts), run
 * against SQLite with the real migrations/0005 and the revision table from
 * migrations/0003, and a stand-in for GitHub's API.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { checkPublish } from '../src/publish.ts';
import type { D1Database, Env } from '../src/types.ts';

const migration = (name: string) => readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8');

/** A D1 binding over node:sqlite, for the calls checkPublish makes. */
function d1(db: DatabaseSync): D1Database {
  const statement = (sql: string, values: unknown[] = []) => ({
    bind: (...next: unknown[]) => statement(sql, next),
    first: async <T>() => (db.prepare(sql).get(...(values as never[])) ?? null) as T | null,
    all: async <T>() => ({ results: db.prepare(sql).all(...(values as never[])) as T[], success: true, meta: {} }),
    raw: async <T>() => [] as T[],
  });
  return { prepare: (sql: string) => statement(sql), batch: async () => [] };
}

function setup(token?: string) {
  const db = new DatabaseSync(':memory:');
  // The revision table as migrations/0003 creates it (its triggers need the content tables, so they are left out).
  const revisionTable = migration('0003_content_revision.sql').match(/CREATE TABLE "offline_content\.revision" \([^;]*;/)![0];
  db.exec(revisionTable);
  db.exec(migration('0005_publish_requests.sql'));
  const setRevision = (revision: number, changedAt: string) => db.prepare(`INSERT OR REPLACE INTO "offline_content.revision" ("id", "revision", "changed_at") VALUES (1, ?, ?)`).run(revision, changedAt);
  const requests = () => db.prepare(`SELECT * FROM "offline_content.publish_requests"`).get() as Record<string, unknown>;
  const env: Env = { CONTENT_DB: d1(db), GITHUB_TOKEN: token, GITHUB_REPOSITORY: 'pKostantine/Coptic-Vine', PUBLISH_WORKFLOW: 'publish-content.yml', PUBLISH_REF: 'master' };
  const calls: { url: string; init: RequestInit }[] = [];
  let status = 204;
  const github = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(status === 204 ? null : '{"message":"Bad credentials"}', { status });
  }) as typeof fetch;
  return { env, setRevision, requests, calls, github, answerWith: (next: number) => { status = next; } };
}

const at = (iso: string) => Date.parse(iso);

test('a change starts one build once the content has been quiet for two minutes', async () => {
  const { env, setRevision, requests, calls, github } = setup('token-123');
  setRevision(7, '2026-10-20T18:00:00.000Z');

  assert.match(await checkPublish(env, at('2026-10-20T18:01:00Z'), github), /^waiting for edits to settle/);
  assert.equal(calls.length, 0);

  assert.equal(await checkPublish(env, at('2026-10-20T18:02:30Z'), github), 'asked GitHub to rebuild the books for revision 7');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.github.com/repos/pKostantine/Coptic-Vine/actions/workflows/publish-content.yml/dispatches');
  assert.equal(calls[0].init.method, 'POST');
  const headers = calls[0].init.headers as Record<string, string>;
  assert.equal(headers.authorization, 'Bearer token-123');
  assert.equal(headers['x-github-api-version'], '2022-11-28');
  assert.deepEqual(JSON.parse(calls[0].init.body as string), { ref: 'master' });
  assert.equal(requests().revision, 7);
  assert.equal(requests().requested_at, '2026-10-20T18:02:30.000Z');

  // Nothing new: nothing asked.
  assert.match(await checkPublish(env, at('2026-10-20T18:10:00Z'), github), /^up to date/);
  assert.equal(calls.length, 1);

  // A later edit asks again.
  setRevision(9, '2026-10-20T18:20:00.000Z');
  assert.match(await checkPublish(env, at('2026-10-20T18:23:00Z'), github), /revision 9/);
  assert.equal(calls.length, 2);
});

test('without GITHUB_TOKEN the check says so and calls nothing', async () => {
  const { env, setRevision, requests, calls, github } = setup(undefined);
  setRevision(3, '2026-10-20T18:00:00.000Z');
  assert.match(await checkPublish(env, at('2026-10-20T19:00:00Z'), github), /GITHUB_TOKEN isn't set/);
  assert.equal(calls.length, 0);
  assert.equal(requests().revision, 0);
});

test('when GitHub refuses, the error is kept and the request waits 15 minutes before trying again', async () => {
  const { env, setRevision, requests, calls, github, answerWith } = setup('expired');
  setRevision(4, '2026-10-20T18:00:00.000Z');
  answerWith(401);

  assert.match(await checkPublish(env, at('2026-10-20T18:05:00Z'), github), /refused.*HTTP 401: \{"message":"Bad credentials"\}/);
  assert.equal(requests().revision, 0);
  assert.equal(requests().failed_at, '2026-10-20T18:05:00.000Z');
  assert.match(String(requests().last_error), /^HTTP 401/);

  assert.match(await checkPublish(env, at('2026-10-20T18:15:00Z'), github), /^waiting after a refusal/);
  assert.equal(calls.length, 1);

  answerWith(204);
  assert.match(await checkPublish(env, at('2026-10-20T18:21:00Z'), github), /asked GitHub/);
  assert.equal(calls.length, 2);
  assert.equal(requests().revision, 4);
  assert.equal(requests().failed_at, null);
  assert.equal(requests().last_error, null);
});
