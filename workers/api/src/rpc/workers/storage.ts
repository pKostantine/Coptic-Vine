/**
 * Storage clean-up for the media processor, and an admin's permanent deletion
 * of a file: ports of public.sync_storage_gc_candidates,
 * get_storage_gc_candidates, prepare_storage_gc_candidate,
 * complete_storage_gc_candidate, authorize_admin_storage_gc,
 * prepare_admin_processing_file_deletion and
 * finalize_admin_processing_file_deletion, with private.storage_*_is_referenced
 * (schema/pg-user-schema.sql). The processor lists the R2 buckets and passes
 * what it found; an object nothing refers to for three days is deleted.
 * Checked by tests/storage.parity.test.ts.
 */
import { col, t } from '../../../../content-api/src/db/names.ts';
import { transaction, type Tx } from '../../db/transaction.ts';
import { jsonbText, raise, timestampInput } from '../../pg.ts';
import type { ApiContext } from '../../rest/context.ts';
import { requireSignedInAdmin } from '../admin/shared.ts';
import { alias, order, type Row } from '../common.ts';
import { addHours, arrayElements, arrowText, jsonbType, trimSpaces } from '../creator/core.ts';
import { verifyWorker } from './media.ts';

const CANDIDATES = t('media', 'storage_gc_candidates');
const JOBS = t('media', 'media_processing_jobs');
const ASSETS = t('media', 'media_assets');
const VERSIONS = t('media', 'media_asset_versions');
const INTENTS = t('media', 'upload_intents');
const ITEMS = t('media', 'submission_items');
const LIVE = `('queued', 'processing', 'failed')`;
const BUCKETS = ['chc-submissions', 'chc-music', 'chc-learning', 'chc-images'];

/** private.storage_asset_is_referenced(asset): anything shows it, or a live job makes it. */
function assetReferenced(asset: string): string {
  const uses: [string, string, string][] = [
    ['media', 'submission_items', 'media_asset_id'], ['music', 'tracks', 'media_asset_id'], ['music', 'releases', 'cover_asset_id'], ['music', 'artists', 'profile_image_asset_id'],
    ['music', 'playlists', 'cover_asset_id'], ['learning', 'album_recordings', 'media_asset_id'], ['learning', 'lessons', 'media_asset_id'], ['learning', 'albums', 'cover_asset_id'],
    ['learning', 'lesson_sets', 'cover_asset_id'], ['learning', 'cantors', 'profile_image_asset_id'], ['learning', 'playlists', 'cover_asset_id'],
  ];
  const j = alias('job');
  const v = alias('version');
  return `(${uses.map(([schema, table, column]) => {
    const u = alias('use');
    return `EXISTS (SELECT 1 FROM ${t(schema, table)} ${u} WHERE ${u}.${col(column)} = ${asset})`;
  }).join(' OR ')} OR EXISTS (SELECT 1 FROM ${JOBS} ${j} WHERE ${j}.${col('status')} IN ${LIVE} AND (${j}.${col('media_asset_id')} = ${asset}
    OR EXISTS (SELECT 1 FROM ${VERSIONS} ${v} WHERE ${v}.${col('id')} = ${j}.${col('media_asset_version_id')} AND ${v}.${col('media_asset_id')} = ${asset}))))`;
}

/** private.storage_asset_version_is_referenced(version): the current version of a referenced asset, or what a live job makes. */
function versionReferenced(version: string): string {
  const v = alias('version');
  const a = alias('asset');
  const j = alias('job');
  return `EXISTS (SELECT 1 FROM ${VERSIONS} ${v} JOIN ${ASSETS} ${a} ON ${a}.${col('id')} = ${v}.${col('media_asset_id')} WHERE ${v}.${col('id')} = ${version}
    AND ((${v}.${col('version')} = ${a}.${col('version')} AND ${assetReferenced(`${a}.${col('id')}`)})
      OR EXISTS (SELECT 1 FROM ${JOBS} ${j} WHERE ${j}.${col('media_asset_version_id')} = ${v}.${col('id')} AND ${j}.${col('status')} IN ${LIVE})))`;
}

/** private.storage_upload_intent_is_referenced(upload): an item, or a live job, still reads it. */
function uploadReferenced(upload: string): string {
  const i = alias('item');
  const j = alias('job');
  return `(EXISTS (SELECT 1 FROM ${ITEMS} ${i} WHERE ${i}.${col('upload_intent_id')} = ${upload})
    OR EXISTS (SELECT 1 FROM ${JOBS} ${j} WHERE ${j}.${col('upload_intent_id')} = ${upload} AND ${j}.${col('status')} IN ${LIVE}))`;
}

/** private.storage_object_is_referenced(bucket, path). */
function objectReferenced(bucket: string, path: string): string {
  const j = alias('job');
  const u = alias('upload');
  const a = alias('asset');
  const v = alias('version');
  return `(EXISTS (SELECT 1 FROM ${JOBS} ${j} WHERE ${j}.${col('status')} IN ${LIVE}
      AND ((${j}.${col('input_bucket')} = ${bucket} AND ${j}.${col('input_path')} = ${path}) OR (${j}.${col('output_bucket')} = ${bucket} AND ${j}.${col('output_path')} = ${path})))
    OR EXISTS (SELECT 1 FROM ${INTENTS} ${u} WHERE ${u}.${col('bucket')} = ${bucket} AND ${u}.${col('path')} = ${path} AND ${u}.${col('original_deleted_at')} IS NULL
      AND ${uploadReferenced(`${u}.${col('id')}`)})
    OR EXISTS (SELECT 1 FROM ${ASSETS} ${a} WHERE ${a}.${col('bucket')} = ${bucket} AND ${a}.${col('path')} = ${path} AND ${assetReferenced(`${a}.${col('id')}`)})
    OR EXISTS (SELECT 1 FROM ${VERSIONS} ${v} WHERE ${v}.${col('bucket')} = ${bucket} AND ${v}.${col('path')} = ${path} AND ${versionReferenced(`${v}.${col('id')}`)}))`;
}

const isReferenced = async (tx: Tx, bucket: unknown, path: unknown) =>
  Boolean((await tx.first(`WITH ${col('o')} (${col('b')}, ${col('p')}) AS (VALUES (?, ?)) SELECT ${objectReferenced(`(SELECT ${col('b')} FROM ${col('o')})`, `(SELECT ${col('p')} FROM ${col('o')})`)} AS yes`, bucket, path))!.yes);

/** Which of these [bucket, path] pairs something refers to, by their place in the list: one query, however long the list. */
async function referencedOf(tx: Tx, pairs: [string, string][]): Promise<Set<number>> {
  if (!pairs.length) return new Set();
  const found = await tx.all<{ i: number }>(`SELECT listed.key AS i FROM json_each(?) listed
    WHERE ${objectReferenced(`json_extract(listed.value, '$[0]')`, `json_extract(listed.value, '$[1]')`)}`, JSON.stringify(pairs));
  return new Set(found.map((row) => row.i));
}

/** Candidates something refers to again: their unused clock is discarded (a later return to unused starts a fresh three days). */
const forgetReferenced = (tx: Tx) => tx.run(`DELETE FROM ${CANDIDATES} WHERE ${objectReferenced(`${CANDIDATES}.${col('bucket')}`, `${CANDIDATES}.${col('path')}`)}`);

/** text::bigint, with Postgres's error. */
function toBigint(text: string): number {
  if (!/^\s*[+-]?\d+\s*$/.test(text)) raise(`invalid input syntax for type bigint: "${text}"`, '22P02');
  return Number(text);
}

export async function syncStorageGcCandidates(ctx: ApiContext, token: string | null, objects: unknown): Promise<unknown> {
  return transaction(ctx, async (tx) => {
    await verifyWorker(tx, token);
    if (objects == null || jsonbType(objects) !== 'array') raise('p_objects must be a JSON array', '22023');
    const listed = arrayElements(objects);
    await forgetReferenced(tx);
    // Postgres's one INSERT … SELECT: the scan's references found in one query and its candidates written in one
    // statement, so a listing of any size costs the same few D1 calls. A size or time is read only for an
    // object that passes the filters, as Postgres casts them.
    const eligible = listed.map((object) => ({ object, bucket: trimSpaces(arrowText(object, 'bucket') ?? ''), path: trimSpaces(arrowText(object, 'path') ?? '') }))
      .filter(({ bucket, path }) => BUCKETS.includes(bucket) && path.length > 0);
    const referenced = await referencedOf(tx, eligible.map(({ bucket, path }) => [bucket, path]));
    const kept: [string, string, number | null, string | null][] = [];
    eligible.forEach(({ object, bucket, path }, i) => {
      if (referenced.has(i)) return;
      const size = arrowText(object, 'file_size_bytes');
      const modified = arrowText(object, 'last_modified_at');
      kept.push([bucket, path, size == null || size === '' ? null : Math.max(0, toBigint(size)), modified == null || modified === '' ? null : timestampInput(modified, 'last_modified_at')]);
    });
    if (new Set(kept.map(([bucket, path]) => JSON.stringify([bucket, path]))).size < kept.length) {
      raise('ON CONFLICT DO UPDATE command cannot affect row a second time', '21000', null, 'Ensure that no rows proposed for insertion within the same command have duplicate constrained values.');
    }
    if (kept.length) {
      // WHERE true: SQLite's upsert from a SELECT needs one, to parse ON CONFLICT as the upsert's.
      await tx.run(`INSERT INTO ${CANDIDATES} (${['bucket', 'path', 'first_unused_at', 'last_seen_at', 'file_size_bytes', 'last_modified_at', 'reason'].map(col).join(', ')})
        SELECT json_extract(value, '$[0]'), json_extract(value, '$[1]'), ?, ?, json_extract(value, '$[2]'), json_extract(value, '$[3]'), 'unreferenced' FROM json_each(?) WHERE true
        ON CONFLICT (${col('bucket')}, ${col('path')}) DO UPDATE SET ${['last_seen_at', 'file_size_bytes', 'last_modified_at', 'reason'].map((name) => `${col(name)} = excluded.${col(name)}`).join(', ')}`,
      tx.at, tx.at, JSON.stringify(kept));
    }
    // A candidate the scan no longer lists has gone from R2 already.
    const seen = listed.map((object) => [trimSpaces(arrowText(object, 'bucket') ?? ''), trimSpaces(arrowText(object, 'path') ?? '')]);
    await tx.run(`DELETE FROM ${CANDIDATES} WHERE NOT EXISTS (SELECT 1 FROM json_each(?) seen WHERE json_extract(seen.value, '$[0]') = ${CANDIDATES}.${col('bucket')}
      AND json_extract(seen.value, '$[1]') = ${CANDIDATES}.${col('path')})`, JSON.stringify(seen));
    const counts = (await tx.first(`SELECT count(*) AS total, count(CASE WHEN ${col('first_unused_at')} <= ? THEN 1 END) AS due FROM ${CANDIDATES}`, addHours(tx.at, -72)))!;
    return [{ scanned_count: listed.length, candidate_count: counts.total, due_count: counts.due }];
  });
}

export async function getStorageGcCandidates(ctx: ApiContext, token: string | null, dueOnly: boolean | null, count: number | null): Promise<unknown> {
  return transaction(ctx, async (tx) => {
    await verifyWorker(tx, token);
    await forgetReferenced(tx);
    // not p_due_only or …: a null p_due_only filters as true does.
    const rows = await tx.all(`SELECT ${['bucket', 'path', 'file_size_bytes', 'first_unused_at', 'last_seen_at'].map(col).join(', ')} FROM ${CANDIDATES}
      WHERE ? OR ${col('first_unused_at')} <= ?`, dueOnly === false ? 1 : 0, addHours(tx.at, -72));
    // Stored timestamps sort as text in time order; bucket and path as Postgres collates text.
    const byTime = (a: unknown, b: unknown) => ((a as string) < (b as string) ? -1 : (a as string) > (b as string) ? 1 : 0);
    rows.sort((a, b) => byTime(a.first_unused_at, b.first_unused_at) || order.text(a.bucket, b.bucket) || order.text(a.path, b.path));
    return rows.slice(0, Math.max(1, Math.min(count ?? 250, 1000)));
  });
}

/** An unused object, just before the processor deletes it: what describes only it goes (finished jobs, its asset, versions, upload). */
export async function prepareStorageGcCandidate(ctx: ApiContext, token: string | null, bucket: string | null, path: string | null): Promise<unknown> {
  return transaction(ctx, async (tx) => {
    await verifyWorker(tx, token);
    if (await isReferenced(tx, bucket, path)) {
      await tx.run(`DELETE FROM ${CANDIDATES} WHERE ${col('bucket')} = ? AND ${col('path')} = ?`, bucket, path);
      return [{ authorized: false, database_rows_removed: 0 }];
    }
    const ids = async (table: string, referenced: (id: string) => string) => JSON.stringify((await tx.all(`SELECT DISTINCT x.${col('id')} AS id FROM ${table} x
      WHERE x.${col('bucket')} = ? AND x.${col('path')} = ? AND NOT ${referenced(`x.${col('id')}`)}`, bucket, path)).map((row) => row.id));
    const assets = await ids(ASSETS, assetReferenced);
    const versions = await ids(VERSIONS, versionReferenced);
    const uploads = await ids(INTENTS, uploadReferenced);
    const IN = `IN (SELECT value FROM json_each(?))`;
    const removed = await tx.batch([
      tx.db.prepare(`DELETE FROM ${JOBS} WHERE ${col('status')} IN ('completed', 'cancelled') AND (${col('media_asset_id')} ${IN} OR ${col('upload_intent_id')} ${IN}
        OR ${col('media_asset_version_id')} ${IN} OR (${col('input_bucket')} = ? AND ${col('input_path')} = ?) OR (${col('output_bucket')} = ? AND ${col('output_path')} = ?))`)
        .bind(assets, uploads, versions, bucket, path, bucket, path),
      tx.db.prepare(`UPDATE ${t('music', 'play_history')} SET ${col('media_asset_id')} = NULL WHERE ${col('media_asset_id')} ${IN}`).bind(assets),
      tx.db.prepare(`DELETE FROM ${VERSIONS} WHERE ${col('id')} ${IN} OR ${col('media_asset_id')} ${IN}`).bind(versions, assets),
      tx.db.prepare(`DELETE FROM ${ASSETS} WHERE ${col('id')} ${IN}`).bind(assets),
      tx.db.prepare(`DELETE FROM ${INTENTS} WHERE ${col('id')} ${IN}`).bind(uploads),
    ]);
    return [{ authorized: true, database_rows_removed: removed.reduce((sum, result) => sum + result.meta.changes, 0) }];
  });
}

export async function completeStorageGcCandidate(ctx: ApiContext, token: string | null, bucket: string | null, path: string | null): Promise<unknown> {
  return transaction(ctx, async (tx) => {
    await verifyWorker(tx, token);
    await tx.run(`DELETE FROM ${CANDIDATES} WHERE ${col('bucket')} = ? AND ${col('path')} = ?`, bucket, path);
    return true;
  });
}

export async function authorizeAdminStorageGc(ctx: ApiContext): Promise<unknown> {
  await requireSignedInAdmin(ctx);
  return [{ authorized: true }];
}

/** The jobs of the same upload or asset as the job. Binds the job's id, upload and asset. */
const RELATED = `(${col('id')} = ? OR (? IS NOT NULL AND ${col('upload_intent_id')} = ?) OR (? IS NOT NULL AND ${col('media_asset_id')} = ?))`;
const related = (job: Row) => [job.id, job.upload_intent_id, job.upload_intent_id, job.media_asset_id, job.media_asset_id];

/** An admin deleting a file for good: its jobs cancelled (a worker can no longer complete them), and every object to remove listed. */
export async function prepareAdminProcessingFileDeletion(ctx: ApiContext, jobId: string): Promise<unknown> {
  await requireSignedInAdmin(ctx);
  return transaction(ctx, async (tx) => {
    const job = await tx.first(`SELECT * FROM ${JOBS} WHERE ${col('id')} = ?`, jobId);
    if (!job) raise('Processing job not found', 'P0002');
    await tx.run(`UPDATE ${JOBS} SET ${col('status')} = 'cancelled', ${col('worker_id')} = NULL, ${col('finished_at')} = coalesce(${col('finished_at')}, ?),
      ${col('error_message')} = 'Permanently deleted by Coptic Vine Admin', ${col('updated_at')} = ? WHERE ${RELATED}`, tx.at, tx.at, ...related(job!));
    const jobs = await tx.all(`SELECT * FROM ${JOBS} WHERE ${RELATED}`, ...related(job!));
    const objects = new Map<string, Row>();
    const add = (bucket: unknown, path: unknown) => {
      if (bucket != null && path != null) objects.set(JSON.stringify([bucket, path]), { bucket, path });
    };
    for (const each of jobs) {
      add(each.input_bucket, each.input_path);
      add(each.output_bucket, each.output_path);
    }
    for (const row of [
      ...await tx.all(`SELECT ${col('bucket')}, ${col('path')} FROM ${INTENTS} WHERE ${col('id')} = ?`, job!.upload_intent_id),
      ...await tx.all(`SELECT ${col('bucket')}, ${col('path')} FROM ${ASSETS} WHERE ${col('id')} = ?`, job!.media_asset_id),
      ...await tx.all(`SELECT ${col('bucket')}, ${col('path')} FROM ${VERSIONS} WHERE ${col('media_asset_id')} = ?`, job!.media_asset_id),
    ]) add(row.bucket, row.path);
    const listed = [...objects.values()].sort((a, b) => order.text(a.bucket, b.bucket) || order.text(a.path, b.path));
    return [{ job_id: job!.id, upload_intent_id: job!.upload_intent_id, media_asset_id: job!.media_asset_id, related_job_count: jobs.length, objects: JSON.parse(jsonbText(listed)) }];
  });
}

/** Once the objects are gone: everything that showed the file goes with it (Learn recordings and lessons are the file), the rest lets go of it. */
export async function finalizeAdminProcessingFileDeletion(ctx: ApiContext, jobId: string): Promise<unknown> {
  await requireSignedInAdmin(ctx);
  return transaction(ctx, async (tx) => {
    const job = await tx.first(`SELECT * FROM ${JOBS} WHERE ${col('id')} = ?`, jobId);
    if (!job) return [{ job_id: jobId, deleted: false, deleted_job_count: 0, deleted_submission_item_count: 0, deleted_media_asset_id: null, deleted_upload_intent_id: null }];
    const asset = job.media_asset_id;
    const upload = job.upload_intent_id;
    if (asset != null) {
      const unset = (schema: string, table: string, column: string) => tx.db.prepare(`UPDATE ${t(schema, table)} SET ${col(column)} = NULL, ${col('updated_at')} = ? WHERE ${col(column)} = ?`).bind(tx.at, asset);
      await tx.batch([
        tx.db.prepare(`DELETE FROM ${t('learning', 'album_recordings')} WHERE ${col('media_asset_id')} = ?`).bind(asset),
        tx.db.prepare(`DELETE FROM ${t('learning', 'lessons')} WHERE ${col('media_asset_id')} = ?`).bind(asset),
        unset('music', 'tracks', 'media_asset_id'), unset('music', 'releases', 'cover_asset_id'), unset('music', 'artists', 'profile_image_asset_id'), unset('music', 'playlists', 'cover_asset_id'),
        unset('learning', 'albums', 'cover_asset_id'), unset('learning', 'lesson_sets', 'cover_asset_id'), unset('learning', 'cantors', 'profile_image_asset_id'), unset('learning', 'playlists', 'cover_asset_id'),
      ]);
    }
    const items = (await tx.run(`DELETE FROM ${ITEMS} WHERE ${col('media_processing_job_id')} = ? OR (? IS NOT NULL AND ${col('upload_intent_id')} = ?) OR (? IS NOT NULL AND ${col('media_asset_id')} = ?)`,
      job.id, upload, upload, asset, asset)).meta.changes;
    const jobs = (await tx.run(`DELETE FROM ${JOBS} WHERE ${RELATED}`, ...related(job))).meta.changes;
    if (asset != null) await tx.run(`DELETE FROM ${ASSETS} WHERE ${col('id')} = ?`, asset);
    if (upload != null) await tx.run(`DELETE FROM ${INTENTS} WHERE ${col('id')} = ?`, upload);
    return [{ job_id: jobId, deleted: true, deleted_job_count: jobs, deleted_submission_item_count: items, deleted_media_asset_id: asset, deleted_upload_intent_id: upload }];
  });
}
