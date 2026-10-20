/**
 * Keeps the offline books close behind D1, now that D1 is the content master.
 *
 * The books are built by the GitHub Action publish-content.yml
 * (scripts/publish-content-packages.mjs). Its own schedule says every half
 * hour, but GitHub runs it every four or five hours, so an edit made in D1
 * could take that long to reach the books. This Worker's minute cron
 * compares the content revision (moved by the triggers in migrations/0003)
 * with the revision the books were last asked for
 * ("offline_content.publish_requests", migrations/0005). When the content
 * has moved on and then stayed unchanged for two minutes, so that a burst of
 * edits makes one build, it starts the Action through GitHub's API. The
 * Action rebuilds only the books whose tables changed.
 *
 * It needs the GITHUB_TOKEN secret: a fine-grained token for
 * pKostantine/Coptic-Vine with "Actions: read and write". Without it, the
 * check notes that and does nothing, and the Action's own schedule carries on
 * as before.
 */
import { t } from './db/names.ts';
import type { Env } from './types.ts';

/** How long the content must stay unchanged before the books are rebuilt. */
export const QUIET_MS = 2 * 60_000;
/** How long to wait before asking again after GitHub refused (a bad or expired token, say). */
export const RETRY_MS = 15 * 60_000;

export type PublishState = { revision: number; changedAt: string; requested: number; failedAt: string | null };

export type PublishDecision = 'up to date' | 'waiting for edits to settle' | 'waiting after a refusal' | 'publish';

export function publishDecision(state: PublishState, now: number): PublishDecision {
  if (state.revision <= state.requested) return 'up to date';
  if (now - Date.parse(state.changedAt) < QUIET_MS) return 'waiting for edits to settle';
  if (state.failedAt && now - Date.parse(state.failedAt) < RETRY_MS) return 'waiting after a refusal';
  return 'publish';
}

/** Starts the publish workflow on master, with its defaults (only the books that changed). */
export function dispatchPublish(env: Env, fetchImpl: typeof fetch = fetch): Promise<Response> {
  const repository = env.GITHUB_REPOSITORY || 'pKostantine/Coptic-Vine';
  const workflow = env.PUBLISH_WORKFLOW || 'publish-content.yml';
  return fetchImpl(`https://api.github.com/repos/${repository}/actions/workflows/${workflow}/dispatches`, {
    method: 'POST',
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${env.GITHUB_TOKEN}`,
      'content-type': 'application/json',
      'user-agent': 'cv-content-api',
      'x-github-api-version': '2022-11-28',
    },
    body: JSON.stringify({ ref: env.PUBLISH_REF || 'master' }),
  });
}

/** One check: what it found and what it did, for the log. */
export async function checkPublish(env: Env, now = Date.now(), fetchImpl: typeof fetch = fetch): Promise<string> {
  const row = await env.CONTENT_DB
    .prepare(`SELECT r."revision" AS revision, r."changed_at" AS changed_at, p."revision" AS requested, p."failed_at" AS failed_at
      FROM ${t('offline_content', 'revision')} r, ${t('offline_content', 'publish_requests')} p
      WHERE r."id" = 1 AND p."id" = 1`)
    .first<{ revision: number; changed_at: string; requested: number; failed_at: string | null }>();
  if (!row) return 'no revision recorded';
  const state = { revision: row.revision, changedAt: row.changed_at, requested: row.requested, failedAt: row.failed_at };
  const decision = publishDecision(state, now);
  if (decision !== 'publish') return `${decision} (revision ${state.revision}, books asked for ${state.requested})`;
  if (!env.GITHUB_TOKEN) return `revision ${state.revision} is waiting for the books, but GITHUB_TOKEN isn't set`;

  const response = await dispatchPublish(env, fetchImpl);
  const at = new Date(now).toISOString();
  if (response.status === 204) {
    await env.CONTENT_DB
      .prepare(`UPDATE ${t('offline_content', 'publish_requests')} SET "revision" = ?, "requested_at" = ?, "failed_at" = NULL, "last_error" = NULL WHERE "id" = 1`)
      .bind(state.revision, at)
      .first();
    return `asked GitHub to rebuild the books for revision ${state.revision}`;
  }
  // The revision stays unrecorded, so it is asked for again after RETRY_MS; the error shows on /health.
  const error = `HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`;
  await env.CONTENT_DB
    .prepare(`UPDATE ${t('offline_content', 'publish_requests')} SET "failed_at" = ?, "last_error" = ? WHERE "id" = 1`)
    .bind(at, error)
    .first();
  return `GitHub refused the publish request: ${error}`;
}
