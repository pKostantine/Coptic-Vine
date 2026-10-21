/**
 * Publishing what a submission brings, used by edits, reviews and the
 * scheduled release job: ports of private.publish_music_submission_internal,
 * private.apply_music_submission_replacements and
 * private.apply_learning_submission_edits (schema/pg-user-schema.sql), each
 * run inside the caller's transaction.
 */
import { col, t } from '../../../../content-api/src/db/names.ts';
import type { Tx } from '../../db/transaction.ts';
import { jsonbText, raise } from '../../pg.ts';
import { addEvent, attachCompletedJobs, cleanText, dropSupersededArtwork, eachText, itemReady, requiredReady } from './core.ts';
import { itemMediaReady, type Row } from './shared.ts';

const ITEMS = t('media', 'submission_items');
const ASSETS = t('media', 'media_assets');
const RELEASES = t('music', 'releases');
const RELEASE_TRACKS = t('music', 'release_tracks');

/** A completed job's probed duration, rounded to whole milliseconds (numeric arithmetic on its text); null when there's none or it is 0. */
function probeDurationMs(probe: unknown): number | null {
  const parsed = probe == null ? null : JSON.parse(probe as string) as Row;
  const value = (((parsed?.output as Row | undefined)?.format as Row | undefined)?.duration);
  if (value == null) return null;
  const text = String(value).trim();
  const match = /^(\d+)(?:\.(\d*))?$/.exec(text);
  if (!match) raise(`invalid input syntax for type numeric: "${text}"`, '22P02');
  const fraction = `${match![2] ?? ''}0000`;
  const ms = Number(match![1]) * 1000 + Number(fraction.slice(0, 3)) + (fraction[3] >= '5' ? 1 : 0);
  return ms === 0 ? null : ms;
}

/** private.apply_music_submission_replacements: on a live release, processed replacement files take their tracks' places. */
export async function applyMusicReplacements(tx: Tx, submissionId: unknown, actor: unknown): Promise<number> {
  const release = await tx.first(`SELECT * FROM ${RELEASES} WHERE nullif(json_extract(${col('metadata')}, '$.submissionId'), '') = ?`, submissionId);
  if (!release || release.publication_status !== 'published') return 0;
  const waiting = await tx.all(`SELECT r.${col('id')} AS id, r.${col('media_asset_id')} AS asset, o.${col('id')} AS original_id, o.${col('music_track_id')} AS track,
      o.${col('sort_order')} AS sort_order, o.${col('title')} AS title, a.${col('duration_ms')} AS asset_duration, job.${col('probe')} AS probe
    FROM ${ITEMS} r JOIN ${ITEMS} o ON o.${col('id')} = r.${col('replaces_item_id')} JOIN ${ASSETS} a ON a.${col('id')} = r.${col('media_asset_id')}
    LEFT JOIN ${t('media', 'media_processing_jobs')} job ON job.${col('id')} = r.${col('media_processing_job_id')}
    WHERE r.${col('submission_id')} = ? AND ${itemMediaReady(`r.${col('id')}`)}`, submissionId);
  let applied = 0;
  for (const w of waiting) {
    const duration = (w.asset_duration as number | null) ?? probeDurationMs(w.probe);
    const statements = [tx.db.prepare(`UPDATE ${ASSETS} SET ${col('publication_status')} = 'published', ${col('updated_by')} = ?, ${col('updated_at')} = ? WHERE ${col('id')} = ?`).bind(actor, tx.at, w.asset)];
    if (w.track != null) {
      statements.push(tx.db.prepare(`UPDATE ${t('music', 'tracks')} SET ${col('media_asset_id')} = ?, ${col('duration_ms')} = ?, ${col('updated_by')} = coalesce(?, ${col('updated_by')}), ${col('updated_at')} = ? WHERE ${col('id')} = ?`)
        .bind(w.asset, duration, actor, tx.at, w.track));
    }
    statements.push(
      tx.db.prepare(`UPDATE ${ITEMS} SET ${col('replaces_item_id')} = NULL, ${col('music_track_id')} = ?, ${col('sort_order')} = ?, ${col('title')} = ?, ${col('updated_at')} = ? WHERE ${col('id')} = ?`)
        .bind(w.track, w.sort_order, w.title, tx.at, w.id),
      tx.db.prepare(`UPDATE ${ITEMS} SET ${col('music_track_id')} = NULL WHERE ${col('id')} = ?`).bind(w.original_id),
      tx.db.prepare(`DELETE FROM ${ITEMS} WHERE ${col('id')} = ?`).bind(w.original_id),
    );
    await tx.batch(statements);
    applied += 1;
  }
  const cover = (await tx.first(`SELECT ${col('cover_asset_id')} AS cover FROM ${RELEASES} WHERE ${col('id')} = ?`, release.id))?.cover ?? null;
  await dropSupersededArtwork(tx, submissionId, cover);
  return applied;
}

/** private.publish_music_submission_internal: an approved music submission's release, tracks, credits and files published. */
export async function publishMusicSubmission(tx: Tx, submissionId: unknown, actorId: unknown, reason: string): Promise<Row> {
  let sub = await tx.first(`SELECT * FROM ${t('media', 'submissions')} WHERE ${col('id')} = ?`, submissionId);
  if (!sub) raise('Submission not found', 'P0002');
  if (sub!.submission_type !== 'music_release') raise('Automatic release publishing only supports music releases', '22023');
  if (!['approved', 'processing', 'published'].includes(sub!.status as string)) raise('Submission is not approved for publication', '22023');
  await attachCompletedJobs(tx, sub!.id);
  if (!(await requiredReady(tx, sub!.id))) raise('Submission still has required items waiting for processing', '22023');
  let release = await tx.first(`SELECT * FROM ${RELEASES} WHERE nullif(json_extract(${col('metadata')}, '$.submissionId'), '') = ?`, sub!.id);
  if (!release) raise('Music release not found for submission', 'P0002');
  const actor = actorId ?? sub!.reviewer_id ?? sub!.created_by;
  const published = await tx.run(`UPDATE ${ASSETS} SET ${col('publication_status')} = 'published', ${col('updated_by')} = ?, ${col('updated_at')} = ?
    WHERE ${col('id')} IN (SELECT DISTINCT ${col('media_asset_id')} FROM ${ITEMS} WHERE ${col('submission_id')} = ? AND ${col('media_asset_id')} IS NOT NULL)`, actor, tx.at, sub!.id);
  const invalid = (await tx.first(`SELECT count(*) AS n FROM ${RELEASE_TRACKS} rt JOIN ${t('music', 'tracks')} tr ON tr.${col('id')} = rt.${col('track_id')}
    LEFT JOIN ${ASSETS} a ON a.${col('id')} = tr.${col('media_asset_id')}
    WHERE rt.${col('release_id')} = ? AND (tr.${col('media_asset_id')} IS NULL OR a.${col('id')} IS NULL OR a.${col('processing_status')} <> 'completed' OR a.${col('publication_status')} <> 'published')`, release!.id))!.n as number;
  if (invalid > 0) raise('Release has tracks without completed published media assets', '22023');
  const credited = `SELECT ta.${col('artist_id')} FROM ${RELEASE_TRACKS} rt JOIN ${t('music', 'track_artists')} ta ON ta.${col('track_id')} = rt.${col('track_id')} WHERE rt.${col('release_id')} = ?`;
  const tracks = `SELECT ${col('track_id')} FROM ${RELEASE_TRACKS} WHERE ${col('release_id')} = ?`;
  const set = `${col('publication_status')} = 'published', ${col('updated_by')} = ?, ${col('updated_at')} = ?`;
  await tx.run(`UPDATE ${t('music', 'artists')} SET ${set} WHERE ${col('id')} = ? OR ${col('id')} IN (${credited})`, actor, tx.at, release!.primary_artist_id, release!.id);
  await tx.run(`UPDATE ${t('music', 'artist_localizations')} SET ${set} WHERE ${col('artist_id')} = ? OR ${col('artist_id')} IN (${credited})`, actor, tx.at, release!.primary_artist_id, release!.id);
  await tx.run(`UPDATE ${t('music', 'tracks')} SET ${set} WHERE ${col('id')} IN (${tracks})`, actor, tx.at, release!.id);
  await tx.run(`UPDATE ${t('music', 'track_localizations')} SET ${set} WHERE ${col('track_id')} IN (${tracks})`, actor, tx.at, release!.id);
  await tx.run(`UPDATE ${t('music', 'release_localizations')} SET ${set} WHERE ${col('release_id')} = ?`, actor, tx.at, release!.id);
  release = await tx.writeFirst(`UPDATE ${RELEASES} SET ${col('publication_status')} = 'published', ${col('release_date')} = coalesce(${col('release_date')}, substr(${col('scheduled_release_at')}, 1, 10), ?),
    ${col('updated_by')} = ?, ${col('updated_at')} = ? WHERE ${col('id')} = ? RETURNING *`, tx.at.slice(0, 10), actor, tx.at, release!.id);
  const previous = sub!.status;
  sub = await tx.writeFirst(`UPDATE ${t('media', 'submissions')} SET ${col('status')} = 'published', ${col('published_at')} = coalesce(${col('published_at')}, ?), ${col('updated_by')} = ?, ${col('updated_at')} = ?
    WHERE ${col('id')} = ? RETURNING *`, tx.at, actor, tx.at, sub!.id);
  // Waiting files take their tracks' places, and older artwork goes.
  await applyMusicReplacements(tx, sub!.id, actor);
  if (previous !== 'published') {
    await addEvent(tx, sub!.id, actor, reason === 'scheduled' ? 'published_automatically_on_schedule' : 'published_automatically', previous, sub!.status, null,
      { reason, releaseId: release!.id, publishedAssetCount: published.meta.changes });
  }
  return { submissionId: sub!.id, submissionStatus: sub!.status, releaseId: release!.id, releaseStatus: release!.publication_status, publishedAt: sub!.published_at, publishedAssetCount: published.meta.changes };
}

/** private.apply_learning_submission_edits: on a live album or lesson set, processed replacements, new recordings or lessons, and newer artwork go live. */
export async function applyLearningEdits(tx: Tx, submissionId: unknown, actor: unknown): Promise<number> {
  const sub = await tx.first(`SELECT * FROM ${t('media', 'submissions')} WHERE ${col('id')} = ?`, submissionId);
  if (!sub) return 0;
  const album = sub.submission_type === 'learning_album';
  const table = album ? t('learning', 'albums') : sub.submission_type === 'learning_lesson_set' ? t('learning', 'lesson_sets') : null;
  const collection = table ? await tx.first(`SELECT ${col('id')}, ${col('title')}, ${col('cover_asset_id')} FROM ${table} WHERE ${col('submission_id')} = ? AND ${col('publication_status')} = 'published'`, sub.id) : null;
  if (!collection) return 0;
  const children = album ? t('learning', 'album_recordings') : t('learning', 'lessons');
  const parent = album ? col('album_id') : col('lesson_set_id');
  let applied = 0;
  const publishAssets = (...ids: unknown[]) => tx.db.prepare(`UPDATE ${ASSETS} SET ${col('publication_status')} = 'published', ${col('updated_by')} = ?, ${col('updated_at')} = ? WHERE ${col('id')} IN (?, ?)`)
    .bind(actor, tx.at, ids[0] ?? null, ids[1] ?? null);

  // Replacements.
  const replacements = await tx.all(`SELECT r.${col('id')} AS id, r.${col('media_asset_id')} AS asset, r.${col('audio_only_asset_id')} AS audio, a.${col('media_type')} AS media_type,
      coalesce(au.${col('duration_ms')}, a.${col('duration_ms')}) AS duration, o.${col('id')} AS original_id, o.${col('sort_order')} AS sort_order, o.${col('title')} AS title, o.${col('localized_titles')} AS titles
    FROM ${ITEMS} r JOIN ${ITEMS} o ON o.${col('id')} = r.${col('replaces_item_id')} JOIN ${ASSETS} a ON a.${col('id')} = r.${col('media_asset_id')}
    LEFT JOIN ${ASSETS} au ON au.${col('id')} = r.${col('audio_only_asset_id')}
    WHERE r.${col('submission_id')} = ? AND ${itemMediaReady(`r.${col('id')}`)}`, sub.id);
  for (const ready of replacements) {
    const matching = await tx.all(`SELECT ${col('id')}, ${col('metadata')} FROM ${children} WHERE ${parent} = ? AND json_extract(${col('metadata')}, '$.submissionItemId') = ?`, collection.id, ready.original_id);
    const statements = [publishAssets(ready.asset, ready.audio)];
    for (const child of matching) {
      const metadata = jsonbText({ ...(JSON.parse(child.metadata as string) as Row), submissionItemId: ready.id });
      statements.push(album
        ? tx.db.prepare(`UPDATE ${children} SET ${col('media_asset_id')} = ?, ${col('duration_ms')} = ?, ${col('metadata')} = ?, ${col('updated_at')} = ? WHERE ${col('id')} = ?`)
          .bind(ready.asset, ready.duration, metadata, tx.at, child.id)
        : tx.db.prepare(`UPDATE ${children} SET ${col('media_asset_id')} = ?, ${col('media_type')} = ?, ${col('audio_asset_id')} = ?, ${col('duration_ms')} = ?, ${col('metadata')} = ?, ${col('updated_at')} = ? WHERE ${col('id')} = ?`)
          .bind(ready.asset, ready.media_type, ready.audio, ready.duration, metadata, tx.at, child.id));
    }
    statements.push(
      tx.db.prepare(`UPDATE ${ITEMS} SET ${col('replaces_item_id')} = NULL, ${col('sort_order')} = ?, ${col('title')} = ?, ${col('localized_titles')} = ?, ${col('updated_at')} = ? WHERE ${col('id')} = ?`)
        .bind(ready.sort_order, ready.title, ready.titles, tx.at, ready.id),
      tx.db.prepare(`DELETE FROM ${ITEMS} WHERE ${col('id')} = ?`).bind(ready.original_id),
    );
    await tx.batch(statements);
    applied += 1;
  }

  // New recordings and lessons.
  const fresh = await tx.all(`SELECT c.${col('id')} AS id, c.${col('media_asset_id')} AS asset, c.${col('audio_only_asset_id')} AS audio, c.${col('title')} AS title, c.${col('sort_order')} AS sort_order,
      c.${col('localized_titles')} AS titles, a.${col('media_type')} AS media_type, coalesce(au.${col('duration_ms')}, a.${col('duration_ms')}) AS duration
    FROM ${ITEMS} c JOIN ${ASSETS} a ON a.${col('id')} = c.${col('media_asset_id')} LEFT JOIN ${ASSETS} au ON au.${col('id')} = c.${col('audio_only_asset_id')}
    WHERE c.${col('submission_id')} = ? AND c.${col('role')} <> 'artwork' AND c.${col('replaces_item_id')} IS NULL AND ${itemMediaReady(`c.${col('id')}`)}
      AND NOT EXISTS (SELECT 1 FROM ${children} x WHERE x.${parent} = ? AND json_extract(x.${col('metadata')}, '$.submissionItemId') = c.${col('id')})`, sub.id, collection.id);
  for (const ready of fresh) {
    const id = crypto.randomUUID();
    const statements = [publishAssets(ready.asset, ready.audio)];
    if (album) {
      statements.push(tx.db.prepare(`INSERT INTO ${children} (${['id', 'album_id', 'media_asset_id', 'title', 'duration_ms', 'sort_order', 'publication_status', 'metadata', 'created_by', 'updated_by', 'created_at', 'updated_at'].map(col).join(', ')})
        VALUES (?, ?, ?, ?, ?, ?, 'published', ?, ?, ?, ?, ?)`).bind(id, collection.id, ready.asset, ready.title ?? collection.title, ready.duration, ready.sort_order,
        jsonbText({ submissionItemId: ready.id }), actor, actor, tx.at, tx.at));
      for (const [locale, title] of eachText(JSON.parse(ready.titles as string))) {
        if (!['en', 'ar', 'fr'].includes(locale) || cleanText(title) == null) continue;
        statements.push(tx.db.prepare(`INSERT INTO ${t('learning', 'recording_localizations')} (${col('recording_id')}, ${col('locale')}, ${col('title')}, ${col('created_at')}, ${col('updated_at')}) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT (${col('recording_id')}, ${col('locale')}) DO UPDATE SET ${col('title')} = excluded.${col('title')}, ${col('updated_at')} = ?`).bind(id, locale, title, tx.at, tx.at, tx.at));
      }
    } else {
      statements.push(tx.db.prepare(`INSERT INTO ${children} (${['id', 'lesson_set_id', 'media_asset_id', 'media_type', 'audio_asset_id', 'title', 'duration_ms', 'sort_order', 'publication_status', 'metadata', 'created_by', 'updated_by', 'created_at', 'updated_at'].map(col).join(', ')})
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?, ?, ?)`).bind(id, collection.id, ready.asset, ready.media_type, ready.audio, ready.title ?? collection.title, ready.duration,
        ready.sort_order, jsonbText({ submissionItemId: ready.id }), actor, actor, tx.at, tx.at));
    }
    await tx.batch(statements);
    applied += 1;
  }

  // The newest ready artwork is the cover.
  let cover = collection.cover_asset_id;
  const artwork = await tx.all(`SELECT ${col('id')}, ${col('media_asset_id')} AS asset, ${col('created_at')} FROM ${ITEMS} WHERE ${col('submission_id')} = ? AND ${col('role')} = 'artwork'
    ORDER BY ${col('created_at')} DESC, ${col('id')} DESC`, sub.id);
  let newest: unknown = null;
  for (const candidate of artwork) if (await itemReady(tx, candidate.id)) { newest = candidate.asset; break; }
  if (newest != null && newest !== cover) {
    await tx.batch([
      publishAssets(newest, null),
      tx.db.prepare(`UPDATE ${table} SET ${col('cover_asset_id')} = ?, ${col('updated_at')} = ? WHERE ${col('id')} = ?`).bind(newest, tx.at, collection.id),
    ]);
    cover = newest;
    applied += 1;
  }
  await dropSupersededArtwork(tx, sub.id, cover);
  return applied;
}
