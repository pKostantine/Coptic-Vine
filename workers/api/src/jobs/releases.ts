/**
 * Releases due by their schedule, published every minute by the cron: ports
 * of private.publish_due_music_releases and publish_due_learning_releases
 * (schema/pg-user-schema.sql), which pg_cron ran as
 * chc-publish-due-music-releases and chc-publish-due-learning-releases.
 * Each submission is published in a transaction of its own; one that fails
 * is noted on the submission (scheduled_publish_failed, with the error) and
 * the rest carry on, as Supabase's per-release savepoints did.
 * Checked by tests/jobs.parity.test.ts.
 *
 * The cron runs both through publishDueReleases, one run at a time.
 */
import { col, t } from '../../../content-api/src/db/names.ts';
import { rollBackLabelled, transaction } from '../db/transaction.ts';
import { now } from '../pg.ts';
import type { ApiContext } from '../rest/context.ts';
import { addEvent } from '../rpc/creator/core.ts';
import { publishLearningSubmission, publishMusicSubmission } from '../rpc/creator/publish.ts';
import { requiredItemsReady } from '../rpc/creator/shared.ts';
import type { Env } from '../types.ts';

type Due = { id: string; reviewer_id: string | null };

/** The label of the jobs' transactions (src/db/transaction.ts). */
const RELEASE = 'release';
const LEASE = t('private', 'job_lease');
/** A scheduled run's longest: a run that died lets go after it. */
const LEASE_MS = 15 * 60_000;

async function publishEach(ctx: ApiContext, due: Due[], publish: (ctx: ApiContext, entry: Due) => Promise<unknown>): Promise<number> {
  let published = 0;
  for (const entry of due) {
    try {
      await publish(ctx, entry);
      published += 1;
    } catch (error) {
      const message = (error as Error).message ?? String(error);
      await transaction(ctx, (tx) => addEvent(tx, entry.id, entry.reviewer_id, 'scheduled_publish_failed', null, null, message, {}), RELEASE);
    }
  }
  return published;
}

/** Approved music whose scheduled time has come, files ready: published, earliest scheduled first. */
export async function publishDueMusicReleases(env: Env): Promise<number> {
  const ctx: ApiContext = { db: env.DB, env, userId: null };
  const due = (await env.DB.prepare(`SELECT s.${col('id')} AS id, s.${col('reviewer_id')} AS reviewer_id FROM ${t('media', 'submissions')} s
    JOIN ${t('music', 'releases')} r ON nullif(json_extract(r.${col('metadata')}, '$.submissionId'), '') = s.${col('id')}
    WHERE s.${col('submission_type')} = 'music_release' AND s.${col('status')} IN ('approved', 'processing') AND r.${col('release_timing_mode')} = 'scheduled'
      AND r.${col('scheduled_release_at')} IS NOT NULL AND r.${col('scheduled_release_at')} <= ? AND ${requiredItemsReady(`s.${col('id')}`)}
    ORDER BY r.${col('scheduled_release_at')}, s.rowid`).bind(now()).all<Due>()).results;
  return publishEach(ctx, due, (c, entry) => transaction(c, (tx) => publishMusicSubmission(tx, entry.id, entry.reviewer_id, 'scheduled'), RELEASE));
}

/** Approved albums and lesson sets whose scheduled time has come, files ready: published, earliest approved first. */
export async function publishDueLearningReleases(env: Env): Promise<number> {
  const ctx: ApiContext = { db: env.DB, env, userId: null };
  const at = now();
  const scheduled = (table: string) => `EXISTS (SELECT 1 FROM ${t('learning', table)} x WHERE x.${col('submission_id')} = s.${col('id')}
    AND x.${col('release_timing_mode')} = 'scheduled' AND x.${col('scheduled_release_at')} <= ?)`;
  const due = (await env.DB.prepare(`SELECT s.${col('id')} AS id, s.${col('reviewer_id')} AS reviewer_id FROM ${t('media', 'submissions')} s
    WHERE s.${col('status')} = 'approved' AND s.${col('approved_at')} IS NOT NULL AND ${requiredItemsReady(`s.${col('id')}`)}
      AND (${scheduled('albums')} OR ${scheduled('lesson_sets')})
    ORDER BY s.${col('approved_at')}, s.rowid`).bind(at, at).all<Due>()).results;
  return publishEach(ctx, due, (c, entry) => transaction(c, (tx) => publishLearningSubmission(tx, entry.id, entry.reviewer_id, 'scheduled'), RELEASE));
}

/**
 * Both jobs, for the cron. pg_cron never started a job while its last run was
 * still going, and Postgres's publish locked the submission (FOR UPDATE), so
 * a release went out once. Cloudflare starts each minute's run regardless, so
 * a run first takes the lease, and one that can't leaves the releases to the
 * run that has it (false). Holding it, no other release transaction is live:
 * what one left behind (its Worker died, or its rollback failed) is rolled
 * back before anything is published again, or the five-minute recovery would
 * later undo a publish made over it. A log that won't roll back stops the
 * releases, with the error, until it does.
 */
export async function publishDueReleases(env: Env, at = Date.now()): Promise<boolean> {
  const holder = crypto.randomUUID();
  const taken = await env.DB.prepare(`UPDATE ${LEASE} SET ${col('holder')} = ?, ${col('until')} = ? WHERE ${col('name')} = 'releases' AND (${col('until')} IS NULL OR ${col('until')} < ?)`)
    .bind(holder, new Date(at + LEASE_MS).toISOString(), new Date(at).toISOString()).run();
  if (!taken.meta.changes) return false;
  try {
    await rollBackLabelled(env.DB, RELEASE);
    await publishDueMusicReleases(env).catch((error) => console.error('Publishing due music releases:', error));
    await publishDueLearningReleases(env).catch((error) => console.error('Publishing due learning releases:', error));
  } finally {
    await env.DB.prepare(`UPDATE ${LEASE} SET ${col('holder')} = NULL, ${col('until')} = NULL WHERE ${col('name')} = 'releases' AND ${col('holder')} = ?`).bind(holder).run();
  }
  return true;
}
