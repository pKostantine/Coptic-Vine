/**
 * CV-Admin's writes: ports of public.review_media_submission,
 * publish_media_submission, publish_music_release, publish_learning_album,
 * publish_learning_lesson_set, admin_update_music_release_dates,
 * admin_delete_catalog_item, delete_admin_music_release,
 * delete_admin_music_release_track, confirm_admin_creator_artist_claim,
 * update_admin_artist_profile, force_media_processing_job,
 * force_pending_media_processing_jobs, force_submission_media_processing,
 * retry_media_processing_job, admin_send_notification_test and
 * admin_send_notification_broadcast (schema/pg-user-schema.sql), each in one
 * transaction (src/db/transaction.ts). Checked by
 * tests/admin.writes.parity.test.ts.
 *
 * Supabase's confirm_admin_creator_artist_claim sets the generated column
 * is_credit_only, which Postgres refuses, so it always fails there; the port
 * sets the owner and lets is_credit_only follow, as ensure_creator_workspace's
 * does (docs/d1/phase2-runbook.md).
 */
import { col, t } from '../../../../content-api/src/db/names.ts';
import { transaction, type Tx } from '../../db/transaction.ts';
import { jsonbText, raise } from '../../pg.ts';
import type { ApiContext } from '../../rest/context.ts';
import { payload, viewer } from '../common.ts';
import { addEvent, addHours, attachCompletedJobs, cleanText, deleteReleaseCore, deleteReleaseTrackCore, enqueueJob, jsonbType, requiredReady, SKIPPED, toUuid, trimSpaces } from '../creator/core.ts';
import { publishLearningSubmission, publishMusicSubmission, publishReleaseParts } from '../creator/publish.ts';
import { normalizeCreatorName } from '../creator/reads.ts';
import { queueProfileImage, replaceSocialLinks } from '../creator/writes.ts';
import { adminArtistJson, audienceSql } from './reads.ts';
import { releaseDisplayDate, requireAdmin, requireSignedInAdmin, type Row } from './shared.ts';

const SUBMISSIONS = t('media', 'submissions');
const ITEMS = t('media', 'submission_items');
const ASSETS = t('media', 'media_assets');
const JOBS = t('media', 'media_processing_jobs');
const INTENTS = t('media', 'upload_intents');
const ARTISTS = t('music', 'artists');
const RELEASES = t('music', 'releases');
const RELEASE_TRACKS = t('music', 'release_tracks');
const ACCOUNTS = t('creator', 'creator_accounts');
const DEVICES = t('public', 'notification_devices');
const NOTIFICATIONS = t('public', 'notifications');
const DELIVERIES = t('private', 'notification_deliveries');

const EPOCH = '1970-01-01T00:00:00+00:00';
/** length(text): characters, not UTF-16 units. */
const length = (text: string) => [...text].length;

const submission = (tx: Tx, id: unknown) => tx.first(`SELECT * FROM ${SUBMISSIONS} WHERE ${col('id')} = ?`, id);

/** A submission's status, or null when there's no such submission. */
async function submissionStatus(tx: Tx, id: string | null): Promise<unknown> {
  return id == null ? null : (await tx.first(`SELECT ${col('status')} FROM ${SUBMISSIONS} WHERE ${col('id')} = ?`, id))?.status ?? null;
}

/** `nullif(metadata ->> 'submissionId', '')::uuid` of a release; undefined when there's no such release. */
async function releaseSubmission(tx: Tx, releaseId: string): Promise<{ submission: string | null; title: unknown } | undefined> {
  const release = await tx.first(`SELECT json_extract(${col('metadata')}, '$.submissionId') AS submission, ${col('title')} AS title FROM ${RELEASES} WHERE ${col('id')} = ?`, releaseId);
  if (!release) return undefined;
  const text = release.submission == null ? null : String(release.submission);
  return { submission: toUuid(text === '' ? null : text), title: release.title };
}

export async function reviewMediaSubmission(ctx: ApiContext, submissionId: string, action: string | null, notes: string | null): Promise<unknown> {
  const userId = await requireSignedInAdmin(ctx);
  const act = trimSpaces(action ?? '').toLowerCase();
  const note = cleanText(notes);
  if (!['approve', 'request_changes', 'reject'].includes(act)) raise('Unsupported review action', '22023');
  if (act === 'request_changes' && note == null) raise('Review notes are required when requesting changes', '22023');
  return transaction(ctx, async (tx) => {
    let sub = await submission(tx, submissionId);
    if (!sub) raise('Submission not found', 'P0002');
    if (sub!.status !== 'pending_review') raise('Submission is not pending review', '22023');
    const previous = sub!.status;
    const review = `${col('reviewer_id')} = ?, ${col('reviewed_at')} = ?, ${col('review_notes')} = ?, ${col('updated_by')} = ?`;
    if (act === 'request_changes') {
      sub = await tx.writeFirst(`UPDATE ${SUBMISSIONS} SET ${col('status')} = 'changes_requested', ${review}, ${col('approved_at')} = NULL, ${col('rejected_at')} = NULL
        WHERE ${col('id')} = ? RETURNING *`, userId, tx.at, note, userId, sub!.id);
      await addEvent(tx, sub!.id, userId, 'changes_requested', previous, sub!.status, note, {});
    } else if (act === 'reject') {
      sub = await tx.writeFirst(`UPDATE ${SUBMISSIONS} SET ${col('status')} = 'rejected', ${review}, ${col('rejected_at')} = ?, ${col('approved_at')} = NULL
        WHERE ${col('id')} = ? RETURNING *`, userId, tx.at, note, userId, tx.at, sub!.id);
      await addEvent(tx, sub!.id, userId, 'rejected', previous, sub!.status, note, {});
    } else {
      if (!(await tx.first(`SELECT 1 AS yes FROM ${ITEMS} WHERE ${col('submission_id')} = ?`, sub!.id))) raise('Submission must have at least one item', '22023');
      await attachCompletedJobs(tx, sub!.id);
      if (!(await requiredReady(tx, sub!.id))) raise('Submission media is still processing. Approve once processing completes.', '22023');
      sub = await tx.writeFirst(`UPDATE ${SUBMISSIONS} SET ${col('status')} = 'approved', ${review}, ${col('approved_at')} = ?, ${col('rejected_at')} = NULL
        WHERE ${col('id')} = ? RETURNING *`, userId, tx.at, note, userId, tx.at, sub!.id);
      await addEvent(tx, sub!.id, userId, 'approved', previous, sub!.status, note, { processingJobsQueued: 0 });
      // Due already (as soon as approved, or its scheduled time has passed): it goes live now.
      if (sub!.submission_type === 'music_release') {
        const release = await tx.first(`SELECT * FROM ${RELEASES} WHERE nullif(json_extract(${col('metadata')}, '$.submissionId'), '') = ? ORDER BY rowid LIMIT 1`, sub!.id);
        const asap = release?.release_timing_mode === 'asap';
        if (release && (asap || (release.release_timing_mode === 'scheduled' && release.scheduled_release_at != null && (release.scheduled_release_at as string) <= tx.at))) {
          await publishMusicSubmission(tx, sub!.id, userId, asap ? 'approval_asap' : 'scheduled_due_at_approval');
          sub = await submission(tx, sub!.id);
        }
      } else if (sub!.submission_type === 'learning_album' || sub!.submission_type === 'learning_lesson_set') {
        const due = (table: string) => `SELECT 1 FROM ${table} WHERE ${col('submission_id')} = ?
          AND (${col('release_timing_mode')} = 'asap' OR (${col('release_timing_mode')} = 'scheduled' AND ${col('scheduled_release_at')} <= ?))`;
        if (await tx.first(`SELECT EXISTS (${due(t('learning', 'albums'))}) OR EXISTS (${due(t('learning', 'lesson_sets'))}) AS yes`, sub!.id, tx.at, sub!.id, tx.at).then((row) => row!.yes === 1)) {
          await publishLearningSubmission(tx, sub!.id, userId, 'approval');
          sub = await submission(tx, sub!.id);
        }
      }
    }
    return [{ submission_id: sub!.id, status: sub!.status, review_due_at: sub!.review_due_at, processing_jobs_queued: 0 }];
  });
}

export async function publishMediaSubmission(ctx: ApiContext, submissionId: string): Promise<unknown> {
  const userId = await requireSignedInAdmin(ctx);
  return transaction(ctx, async (tx) => {
    let sub = await submission(tx, submissionId);
    if (!sub) raise('Submission not found', 'P0002');
    if (sub!.status !== 'approved' && sub!.status !== 'processing') raise('Submission is not approved or processing', '22023');
    await attachCompletedJobs(tx, sub!.id);
    if (!(await requiredReady(tx, sub!.id))) raise('Submission still has required items waiting for processing', '22023');
    const previous = sub!.status;
    const published = (await tx.run(`UPDATE ${ASSETS} SET ${col('publication_status')} = 'published', ${col('updated_by')} = ?, ${col('updated_at')} = ?
      WHERE ${col('id')} IN (SELECT ${col('media_asset_id')} FROM ${ITEMS} WHERE ${col('submission_id')} = ? AND ${col('media_asset_id')} IS NOT NULL)`, userId, tx.at, sub!.id)).meta.changes;
    sub = await tx.writeFirst(`UPDATE ${SUBMISSIONS} SET ${col('status')} = 'published', ${col('published_at')} = ?, ${col('updated_by')} = ? WHERE ${col('id')} = ? RETURNING *`,
      tx.at, userId, sub!.id);
    await addEvent(tx, sub!.id, userId, 'published', previous, sub!.status, null, { publishedAssetCount: published });
    return [{ submission_id: sub!.id, status: sub!.status, published_at: sub!.published_at, published_asset_count: published }];
  });
}

export async function publishMusicRelease(ctx: ApiContext, releaseId: string): Promise<unknown> {
  const userId = await requireSignedInAdmin(ctx);
  return transaction(ctx, async (tx) => {
    let release = await tx.first(`SELECT * FROM ${RELEASES} WHERE ${col('id')} = ?`, releaseId);
    if (!release) raise('Release not found', 'P0002');
    const tracks = (await tx.first(`SELECT count(*) AS n FROM ${RELEASE_TRACKS} WHERE ${col('release_id')} = ?`, release!.id))!.n as number;
    if (tracks === 0) raise('Release must have at least one track', '22023');
    await publishReleaseParts(tx, release!, userId);
    release = await tx.writeFirst(`UPDATE ${RELEASES} SET ${col('publication_status')} = 'published', ${col('updated_by')} = ?, ${col('updated_at')} = ? WHERE ${col('id')} = ? RETURNING *`,
      userId, tx.at, release!.id);
    return [{ release_id: release!.id, status: release!.publication_status, published_track_count: tracks }];
  });
}

/** What publish_learning_album and publish_learning_lesson_set share: an admin, a published cantor and season, an approved submission. */
async function learningCollection(ctx: ApiContext, tx: Tx, table: string, id: string, notFound: string): Promise<Row> {
  if (!ctx.userId || !(await viewer(ctx)).admin) raise('Admin access required');
  const collection = await tx.first(`SELECT * FROM ${table} WHERE ${col('id')} = ?`, id);
  if (!collection) raise(notFound);
  if (!(await tx.first(`SELECT 1 AS yes FROM ${t('learning', 'cantors')} WHERE ${col('id')} = ? AND ${col('publication_status')} = 'published'`, collection!.cantor_id))) {
    raise('Cantor must be published first');
  }
  return collection!;
}

const published = (tx: Tx, table: string, id: unknown) => tx.first(`SELECT 1 AS yes FROM ${table} WHERE ${col('id')} = ? AND ${col('publication_status')} = 'published'`, id);

const approvedSubmission = (tx: Tx, collection: Row, type: string) => tx.first(`SELECT 1 AS yes FROM ${SUBMISSIONS} WHERE ${col('id')} = ? AND ${col('submission_type')} = ?
  AND ${col('creator_account_id')} = ? AND ${col('status')} IN ('approved', 'published')`, collection.submission_id, type, collection.owner_creator_account_id);

const publishedImage = (tx: Tx, assetId: unknown) => tx.first(`SELECT 1 AS yes FROM ${ASSETS} WHERE ${col('id')} = ? AND ${col('media_type')} = 'image'
  AND ${col('processing_status')} = 'completed' AND ${col('publication_status')} = 'published'`, assetId);

export async function publishLearningAlbum(ctx: ApiContext, albumId: string): Promise<unknown> {
  return transaction(ctx, async (tx) => {
    const album = await learningCollection(ctx, tx, t('learning', 'albums'), albumId, 'Learning album not found');
    if (album.season_id != null && !(await published(tx, t('learning', 'seasons'), album.season_id))) raise('Season must be published first');
    if (album.submission_id != null && !(await approvedSubmission(tx, album, 'learning_album'))) raise('Learning album submission must be approved');
    const RECORDINGS = t('learning', 'album_recordings');
    if (!(await tx.first(`SELECT 1 AS yes FROM ${RECORDINGS} WHERE ${col('album_id')} = ?`, albumId))) raise('Learning album must contain at least one recording');
    if (await tx.first(`SELECT 1 AS yes FROM ${RECORDINGS} r LEFT JOIN ${ASSETS} ma ON ma.${col('id')} = r.${col('media_asset_id')} WHERE r.${col('album_id')} = ?
        AND (ma.${col('id')} IS NULL OR ma.${col('media_type')} <> 'audio' OR ma.${col('processing_status')} <> 'completed' OR ma.${col('publication_status')} <> 'published')`, albumId)) {
      raise('Every album recording must reference a published processed audio asset');
    }
    if (album.cover_asset_id != null && !(await publishedImage(tx, album.cover_asset_id))) raise('Album cover must be a published processed image asset');
    await tx.run(`UPDATE ${RECORDINGS} SET ${col('publication_status')} = 'published', ${col('updated_by')} = ? WHERE ${col('album_id')} = ?`, ctx.userId, albumId);
    await tx.run(`UPDATE ${t('learning', 'albums')} SET ${col('publication_status')} = 'published', ${col('updated_by')} = ? WHERE ${col('id')} = ?`, ctx.userId, albumId);
    return payload({ id: albumId, publicationStatus: 'published' });
  });
}

export async function publishLearningLessonSet(ctx: ApiContext, lessonSetId: string): Promise<unknown> {
  return transaction(ctx, async (tx) => {
    const set = await learningCollection(ctx, tx, t('learning', 'lesson_sets'), lessonSetId, 'Learning lesson set not found');
    if (!(await published(tx, t('learning', 'hymns'), set.hymn_id))) raise('Hymn must be published first');
    if (set.season_id != null && !(await published(tx, t('learning', 'seasons'), set.season_id))) raise('Season must be published first');
    if (set.submission_id != null && !(await approvedSubmission(tx, set, 'learning_lesson_set'))) raise('Learning lesson-set submission must be approved');
    const LESSONS = t('learning', 'lessons');
    if (!(await tx.first(`SELECT 1 AS yes FROM ${LESSONS} WHERE ${col('lesson_set_id')} = ?`, lessonSetId))) raise('Lesson set must contain at least one lesson');
    if (await tx.first(`SELECT 1 AS yes FROM ${LESSONS} l LEFT JOIN ${ASSETS} ma ON ma.${col('id')} = l.${col('media_asset_id')} WHERE l.${col('lesson_set_id')} = ?
        AND (ma.${col('id')} IS NULL OR ma.${col('media_type')} <> l.${col('media_type')} OR ma.${col('processing_status')} <> 'completed' OR ma.${col('publication_status')} <> 'published')`, lessonSetId)) {
      raise('Every lesson must reference a published processed asset of the matching media type');
    }
    if (set.cover_asset_id != null && !(await publishedImage(tx, set.cover_asset_id))) raise('Lesson-set cover must be a published processed image asset');
    await tx.run(`UPDATE ${LESSONS} SET ${col('publication_status')} = 'published', ${col('updated_by')} = ? WHERE ${col('lesson_set_id')} = ?`, ctx.userId, lessonSetId);
    await tx.run(`UPDATE ${t('learning', 'lesson_sets')} SET ${col('publication_status')} = 'published', ${col('updated_by')} = ? WHERE ${col('id')} = ?`, ctx.userId, lessonSetId);
    return payload({ id: lessonSetId, publicationStatus: 'published' });
  });
}

export async function adminUpdateMusicReleaseDates(ctx: ApiContext, a: {
  releaseId: string; scheduledReleaseAt: string | null; originalReleaseDate: string | null; clearScheduled: boolean | null; clearOriginal: boolean | null;
}): Promise<unknown> {
  const userId = await requireSignedInAdmin(ctx);
  return transaction(ctx, async (tx) => {
    let release = await tx.first(`SELECT * FROM ${RELEASES} WHERE ${col('id')} = ?`, a.releaseId);
    if (!release) raise('Release not found', 'P0002');
    release = await tx.writeFirst(`UPDATE ${RELEASES} SET
        ${col('scheduled_release_at')} = CASE WHEN ? THEN NULL ELSE coalesce(?, ${col('scheduled_release_at')}) END,
        ${col('release_timing_mode')} = CASE WHEN ? THEN 'asap' WHEN ? IS NOT NULL THEN 'scheduled' ELSE ${col('release_timing_mode')} END,
        ${col('original_release_date')} = CASE WHEN ? THEN NULL ELSE coalesce(?, ${col('original_release_date')}) END,
        ${col('updated_by')} = ?, ${col('updated_at')} = ?
      WHERE ${col('id')} = ? RETURNING *`,
    a.clearScheduled ? 1 : 0, a.scheduledReleaseAt, a.clearScheduled ? 1 : 0, a.scheduledReleaseAt, a.clearOriginal ? 1 : 0, a.originalReleaseDate, userId, tx.at, a.releaseId);
    const { submission: submissionId } = (await releaseSubmission(tx, a.releaseId))!;
    const status = await submissionStatus(tx, submissionId);
    if (status != null) {
      await addEvent(tx, submissionId, userId, 'release_dates_updated_by_admin', status, status, 'An admin changed the release date settings.', {
        releaseId: a.releaseId, releaseTimingMode: release!.release_timing_mode, scheduledReleaseAt: release!.scheduled_release_at, originalReleaseDate: release!.original_release_date,
      });
    }
    return payload({
      releaseId: release!.id, releaseTimingMode: release!.release_timing_mode, scheduledReleaseAt: release!.scheduled_release_at,
      originalReleaseDate: release!.original_release_date, displayDate: releaseDisplayDate(release!),
    });
  });
}

export async function adminDeleteCatalogItem(ctx: ApiContext, kind: string | null, id: string): Promise<unknown> {
  const userId = await requireSignedInAdmin(ctx);
  const normalized = trimSpaces(kind ?? '').toLowerCase();
  return transaction(ctx, async (tx) => {
    let submissionId: string | null;
    let title: unknown;
    let result: Row;
    if (normalized === 'music_release') {
      const release = await releaseSubmission(tx, id);
      if (!release) raise('Music release not found', 'P0002');
      ({ submission: submissionId, title } = release!);
      result = await deleteReleaseCore(tx, id);
    } else if (normalized === 'learning_album' || normalized === 'learning_lesson_set') {
      const table = normalized === 'learning_album' ? t('learning', 'albums') : t('learning', 'lesson_sets');
      const collection = await tx.first(`SELECT ${col('submission_id')} AS submission, ${col('title')} AS title FROM ${table} WHERE ${col('id')} = ?`, id);
      if (!collection) raise(normalized === 'learning_album' ? 'Learning album not found' : 'Lesson set not found', 'P0002');
      submissionId = collection!.submission as string | null;
      title = collection!.title;
      await tx.run(`DELETE FROM ${table} WHERE ${col('id')} = ?`, id);
      result = { id, kind: normalized, deleted: true };
    } else {
      raise('Unsupported catalog item type', '22023');
    }
    const status = await submissionStatus(tx, submissionId!);
    if (status != null) {
      await addEvent(tx, submissionId, userId, 'catalog_item_deleted_by_admin', status, status, 'An admin permanently deleted the linked catalog item.', { kind: normalized, catalogId: id, title });
    }
    return payload(result!);
  });
}

export async function deleteAdminMusicRelease(ctx: ApiContext, releaseId: string): Promise<unknown> {
  const userId = await requireSignedInAdmin(ctx);
  return transaction(ctx, async (tx) => {
    const release = await releaseSubmission(tx, releaseId);
    if (!release) raise('Release not found', 'P0002');
    const status = await submissionStatus(tx, release!.submission);
    if (status != null) {
      await addEvent(tx, release!.submission, userId, 'release_deleted_by_admin', status, status, 'An admin permanently deleted the release from the Coptic Vine music catalog.', { releaseId });
    }
    return payload(await deleteReleaseCore(tx, releaseId));
  });
}

export async function deleteAdminMusicReleaseTrack(ctx: ApiContext, releaseId: string, trackId: string): Promise<unknown> {
  const userId = await requireSignedInAdmin(ctx);
  return transaction(ctx, async (tx) => {
    const release = await releaseSubmission(tx, releaseId);
    if (!release) raise('Release not found', 'P0002');
    const result = await deleteReleaseTrackCore(tx, releaseId, trackId);
    const status = await submissionStatus(tx, release!.submission);
    if (status != null) {
      await addEvent(tx, release!.submission, userId, 'track_deleted_by_admin', status, status, 'An admin permanently deleted a track from the release.', { releaseId, trackId });
    }
    return payload(result);
  });
}

/**
 * The credit a creator's workspace turns out to be: the existing unowned
 * artist of the same name becomes the workspace's identity, taking over the
 * draft identity's credits, translations, members, followers, links and pins;
 * the draft identity is archived, marked as merged.
 */
export async function confirmAdminCreatorArtistClaim(ctx: ApiContext, submissionId: string, existingArtistId: string): Promise<unknown> {
  if (!ctx.userId || !(await viewer(ctx)).admin) raise('Admin verification required', '42501');
  const actor = ctx.userId;
  return transaction(ctx, async (tx) => {
    const sub = await submission(tx, submissionId);
    if (!sub) raise('Submission not found', 'P0002');
    const account = await tx.first(`SELECT * FROM ${ACCOUNTS} WHERE ${col('id')} = ?`, sub!.creator_account_id);
    if (!account) raise('Creator account not found', 'P0002');
    const old = await tx.first(`SELECT * FROM ${ARTISTS} WHERE ${col('id')} = ?`, account!.identity_artist_id);
    const target = await tx.first(`SELECT * FROM ${ARTISTS} WHERE ${col('id')} = ?`, existingArtistId);
    if (!target || target.owner_creator_account_id != null
      || await tx.first(`SELECT 1 AS yes FROM ${ACCOUNTS} WHERE ${col('identity_artist_id')} = ?`, target.id)
      || normalizeCreatorName(target.display_name as string) !== normalizeCreatorName(account!.display_name as string | null)
      || target.id === old?.id) {
      raise('The existing credit is no longer available for this creator', '22023');
    }
    // A comparison with a missing identity's null is unknown, which doesn't refuse.
    if ((old?.owner_creator_account_id != null && old.owner_creator_account_id !== account!.id) || old?.publication_status === 'published'
      || await tx.first(`SELECT 1 AS yes FROM ${RELEASES} WHERE ${col('owner_creator_account_id')} = ? AND ${col('publication_status')} = 'published'`, account!.id)) {
      raise('Cannot automatically merge a live artist profile; contact Coptic Vine support', '22023');
    }
    const oldId = old?.id ?? null;
    await tx.run(`UPDATE ${ARTISTS} SET ${col('owner_creator_account_id')} = ?, ${col('profile_image_asset_id')} = coalesce(${col('profile_image_asset_id')}, ?),
      ${col('biography')} = coalesce(nullif(${col('biography')}, ''), ?), ${col('updated_at')} = ?, ${col('updated_by')} = ? WHERE ${col('id')} = ?`,
    account!.id, old?.profile_image_asset_id ?? null, old?.biography ?? null, tx.at, actor, target!.id);
    await tx.run(`UPDATE ${ACCOUNTS} SET ${col('identity_artist_id')} = ?, ${col('updated_by')} = ?, ${col('updated_at')} = ? WHERE ${col('id')} = ?`, target!.id, actor, tx.at, account!.id);
    await tx.run(`UPDATE ${RELEASES} SET ${col('primary_artist_id')} = ?, ${col('updated_by')} = ? WHERE ${col('owner_creator_account_id')} = ? AND ${col('primary_artist_id')} = ?`,
      target!.id, actor, account!.id, oldId);
    const take = (table: string, columns: string[], from: string[], conflict: string[]) => tx.run(`INSERT INTO ${t('music', table)} (${columns.map(col).join(', ')})
      SELECT ${from.join(', ')} FROM ${t('music', table)} x WHERE x.${col('artist_id')} = ? ON CONFLICT (${conflict.map(col).join(', ')}) DO NOTHING`, target!.id, oldId);
    const x = (name: string) => `x.${col(name)}`;
    await take('track_artists', ['track_id', 'artist_id', 'role', 'sort_order'], [x('track_id'), '?', x('role'), x('sort_order')], ['track_id', 'artist_id', 'role']);
    await tx.run(`DELETE FROM ${t('music', 'track_artists')} WHERE ${col('artist_id')} = ?`, oldId);
    await tx.run(`INSERT INTO ${t('music', 'artist_localizations')} (${['artist_id', 'locale', 'display_name', 'sort_name', 'biography', 'is_primary', 'publication_status', 'created_by', 'updated_by'].map(col).join(', ')})
      SELECT ?, ${['locale', 'display_name', 'sort_name', 'biography', 'is_primary', 'publication_status', 'created_by'].map(x).join(', ')}, ? FROM ${t('music', 'artist_localizations')} x
      WHERE x.${col('artist_id')} = ? ON CONFLICT (${col('artist_id')}, ${col('locale')}) DO NOTHING`, target!.id, actor, oldId);
    await take('artist_memberships', ['artist_id', 'creator_account_id', 'role'], ['?', x('creator_account_id'), x('role')], ['artist_id', 'creator_account_id']);
    await take('artist_follows', ['user_id', 'artist_id', 'created_at'], [x('user_id'), '?', x('created_at')], ['user_id', 'artist_id']);
    await tx.run(`DELETE FROM ${t('music', 'artist_follows')} WHERE ${col('artist_id')} = ?`, oldId);
    await take('artist_social_links', ['artist_id', 'platform', 'url', 'sort_order', 'label'], ['?', x('platform'), x('url'), x('sort_order'), x('label')], ['artist_id', 'platform']);
    await take('artist_pinned_releases', ['artist_id', 'release_id', 'sort_order'], ['?', x('release_id'), x('sort_order')], ['artist_id', 'release_id']);
    if (old) {
      const metadata = { ...(JSON.parse((old.metadata as string) ?? '{}') as Row), mergedInto: target!.id, mergedAt: tx.at, verifiedByAdmin: true };
      await tx.run(`UPDATE ${ARTISTS} SET ${col('publication_status')} = 'archived', ${col('metadata')} = ?, ${col('updated_by')} = ? WHERE ${col('id')} = ?`, jsonbText(metadata), actor, oldId);
    }
    await addEvent(tx, sub!.id, actor, 'artist_identity_linked', sub!.status, sub!.status, null, { oldArtistId: oldId, existingArtistId: target!.id, creatorAccountId: account!.id });
    return payload({ linked: true, artistId: target!.id, previousArtistId: oldId });
  });
}

export async function updateAdminArtistProfile(ctx: ApiContext, a: {
  artistId: string; displayName: string | null; biography: string | null; socialLinks: unknown; profileIntent: string | null;
}): Promise<unknown> {
  const actor = await requireAdmin(ctx);
  const name = cleanText(a.displayName);
  await transaction(ctx, async (tx) => {
    if (!(await tx.first(`SELECT 1 AS yes FROM ${ARTISTS} WHERE ${col('id')} = ?`, a.artistId))) raise('Artist not found', 'P0002');
    await tx.run(`UPDATE ${ARTISTS} SET ${col('display_name')} = coalesce(?, ${col('display_name')}), ${col('biography')} = CASE WHEN ? THEN ${col('biography')} ELSE ? END,
      ${col('updated_by')} = ?, ${col('updated_at')} = ? WHERE ${col('id')} = ?`, name, a.biography == null ? 1 : 0, cleanText(a.biography), actor, tx.at, a.artistId);
    if (name != null) {
      await tx.run(`UPDATE ${ACCOUNTS} SET ${col('display_name')} = ?, ${col('updated_by')} = ?, ${col('updated_at')} = ?
        WHERE ${col('identity_artist_id')} = ? AND ${col('display_name')} IS NOT ?`, name, actor, tx.at, a.artistId, name);
    }
    if (a.socialLinks != null) await replaceSocialLinks(tx, a.artistId, a.socialLinks);
    if (a.profileIntent != null) {
      // Any upload this admin made, whichever workspace it was filed under.
      const intent = await tx.first(`SELECT * FROM ${INTENTS} WHERE ${col('id')} = ?`, a.profileIntent);
      if (!intent || intent.requested_by !== actor) raise('Profile picture upload not found', 'P0002');
      await queueProfileImage(ctx, tx, a.artistId, intent!, actor);
    }
  });
  return adminArtistJson(ctx, a.artistId);
}

/**
 * private.media_processing_job_is_stale: claimed, and silent too long (five
 * minutes since its heartbeat; without one, two hours for a video, fifteen
 * minutes otherwise). Binds three thresholds: staleSince(at).
 */
export const STALE = (job: string) => `(${job}.${col('claimed_at')} IS NOT NULL AND CASE
  WHEN ${job}.${col('heartbeat_at')} IS NOT NULL THEN ${job}.${col('heartbeat_at')} < ?
  WHEN ${job}.${col('job_type')} = 'video_delivery' THEN ${job}.${col('claimed_at')} < ?
  ELSE ${job}.${col('claimed_at')} < ? END)`;
export const staleSince = (at: string) => [addHours(at, -5 / 60), addHours(at, -2), addHours(at, -15 / 60)];

/** Queued again from scratch, its attempts reset once they ran out. Binds available_at, then updated_at. */
const REQUEUE = `${col('status')} = 'queued', ${col('available_at')} = ?,
  ${col('attempt_count')} = CASE WHEN ${col('attempt_count')} >= ${col('max_attempts')} THEN 0 ELSE ${col('attempt_count')} END,
  ${col('worker_id')} = NULL, ${col('claimed_at')} = NULL, ${col('heartbeat_at')} = NULL, ${col('progress')} = NULL, ${col('started_at')} = NULL,
  ${col('finished_at')} = NULL, ${col('error_message')} = NULL, ${col('updated_at')} = ?`;
const ORIGINAL_KEPT = `NOT EXISTS (SELECT 1 FROM ${INTENTS} intent WHERE intent.${col('id')} = ${JOBS}.${col('upload_intent_id')} AND intent.${col('original_deleted_at')} IS NOT NULL)`;
const FORCEABLE = `(${JOBS}.${col('status')} IN ('queued', 'failed', 'cancelled') OR (${JOBS}.${col('status')} = 'processing' AND ${STALE(JOBS)}))`;

const jobRow = async (tx: Tx, jobId: unknown) => {
  const job = (await tx.first(`SELECT * FROM ${JOBS} WHERE ${col('id')} = ?`, jobId))!;
  return [{ job_id: job.id, status: job.status, available_at: job.available_at, attempt_count: job.attempt_count, max_attempts: job.max_attempts }];
};

export async function forceMediaProcessingJob(ctx: ApiContext, jobId: string): Promise<unknown> {
  await requireSignedInAdmin(ctx);
  return transaction(ctx, async (tx) => {
    const job = await tx.first(`SELECT * FROM ${JOBS} WHERE ${col('id')} = ?`, jobId);
    if (!job) raise('Processing job not found', 'P0002');
    if (job!.status === 'completed') raise('Completed jobs do not need to be forced', '22023');
    if (job!.status === 'processing' && !(await tx.first(`SELECT ${STALE('j')} AS stale FROM ${JOBS} j WHERE j.${col('id')} = ?`, ...staleSince(tx.at), jobId))!.stale) {
      raise('This job is already actively processing', '22023');
    }
    const intent = await tx.first(`SELECT ${col('original_deleted_at')} AS deleted FROM ${INTENTS} WHERE ${col('id')} = ?`, job!.upload_intent_id);
    if (intent && intent.deleted != null) raise('The original upload was removed after processing; upload the file again', '22023');
    // The claim takes the earliest available_at first: the epoch puts a forced job ahead of ordinary queued work.
    await tx.run(`UPDATE ${JOBS} SET ${REQUEUE} WHERE ${col('id')} = ?`, EPOCH, tx.at, jobId);
    return jobRow(tx, jobId);
  });
}

export async function forcePendingMediaProcessingJobs(ctx: ApiContext): Promise<unknown> {
  await requireSignedInAdmin(ctx);
  return transaction(ctx, async (tx) => (await tx.run(`UPDATE ${JOBS} SET ${REQUEUE} WHERE ${FORCEABLE} AND NOT ${SKIPPED(JOBS)} AND ${ORIGINAL_KEPT}`,
    tx.at, tx.at, ...staleSince(tx.at))).meta.changes);
}

export async function forceSubmissionMediaProcessing(ctx: ApiContext, submissionId: string): Promise<unknown> {
  await requireSignedInAdmin(ctx);
  return transaction(ctx, async (tx) => {
    if (!(await submission(tx, submissionId))) raise('Submission not found', 'P0002');
    return (await tx.run(`UPDATE ${JOBS} SET ${REQUEUE}
      WHERE ${col('id')} IN (SELECT ${col('media_processing_job_id')} FROM ${ITEMS} WHERE ${col('submission_id')} = ? AND ${col('media_processing_job_id')} IS NOT NULL)
        AND ${FORCEABLE} AND ${ORIGINAL_KEPT}`, EPOCH, tx.at, submissionId, ...staleSince(tx.at))).meta.changes;
  });
}

export async function retryMediaProcessingJob(ctx: ApiContext, jobId: string): Promise<unknown> {
  await requireSignedInAdmin(ctx);
  return transaction(ctx, async (tx) => {
    const job = await tx.first(`SELECT * FROM ${JOBS} WHERE ${col('id')} = ?`, jobId);
    if (!job) raise('Processing job not found', 'P0002');
    if (job!.status !== 'failed' && job!.status !== 'cancelled') raise('Only failed or cancelled processing jobs can be retried manually', '22023');
    const requeued = (await enqueueJob(ctx, tx, job!.upload_intent_id as string | null, job!.job_type as string | null, job!.output_bucket as string | null)).job_id;
    await tx.run(`UPDATE ${ITEMS} SET ${col('media_processing_job_id')} = ? WHERE ${col('upload_intent_id')} = ?`, requeued, job!.upload_intent_id);
    return jobRow(tx, requeued);
  });
}

function checkDeepLink(link: string | null): void {
  if (link != null && (!link.startsWith('/') || link.startsWith('//'))) raise('Deep link must be an internal Coptic Vine path beginning with /', '22023');
}

const MY_DEVICES = `${col('user_id')} = ? AND ${col('app_key')} = 'chc' AND ${col('enabled')} = 1 AND ${col('provider')} IN ('expo', 'web_push')`;

/** A test notification to the admin's own devices. */
export async function adminSendNotificationTest(ctx: ApiContext, title: string | null, body: string | null, deepLink: string | null): Promise<unknown> {
  const userId = await requireSignedInAdmin(ctx);
  const heading = trimSpaces(title ?? '');
  const message = trimSpaces(body ?? '');
  const link = cleanText(deepLink);
  if (length(heading) < 1 || length(heading) > 120 || length(message) < 1 || length(message) > 600) {
    raise('A test needs a title (up to 120 characters) and a message (up to 600)', '22023');
  }
  checkDeepLink(link);
  return transaction(ctx, async (tx) => {
    if (!(await tx.first(`SELECT 1 AS yes FROM ${DEVICES} WHERE ${MY_DEVICES}`, userId))) {
      raise('No Coptic Vine device is signed in to your account with notifications allowed', '22023');
    }
    const notificationId = crypto.randomUUID();
    await tx.run(`INSERT INTO ${NOTIFICATIONS} (${['id', 'user_id', 'app_key', 'category', 'event_type', 'title', 'body', 'deep_link', 'payload'].map(col).join(', ')})
      VALUES (?, ?, 'chc', 'announcements', 'admin_test', ?, ?, ?, ?)`, notificationId, userId, heading, message, link, jsonbText({ source: 'chc_admin', test: true }));
    const deliveries = (await tx.run(`INSERT INTO ${DELIVERIES} (${col('notification_id')}, ${col('device_id')}, ${col('provider')})
      SELECT ?, ${col('id')}, ${col('provider')} FROM ${DEVICES} WHERE ${MY_DEVICES} ON CONFLICT DO NOTHING`, notificationId, userId)).meta.changes;
    return payload({ notificationId, deliveryCount: deliveries, queuedAt: tx.at });
  });
}

/** A broadcast to everyone the category reaches: one inbox notification per account, a delivery per device (an install without an account has only the delivery). */
export async function adminSendNotificationBroadcast(ctx: ApiContext, a: {
  category: string | null; title: string | null; body: string | null; deepLink: string | null; payload: unknown;
}): Promise<unknown> {
  const userId = await requireSignedInAdmin(ctx);
  const category = trimSpaces(a.category ?? '');
  const title = trimSpaces(a.title ?? '');
  const body = trimSpaces(a.body ?? '');
  const link = cleanText(a.deepLink);
  const extra = a.payload ?? {};
  if (!['feast_celebrations', 'announcements'].includes(category)) raise('Unsupported notification category', '22023');
  if (length(title) < 1 || length(title) > 120) raise('Title must be between 1 and 120 characters', '22023');
  if (length(body) < 1 || length(body) > 600) raise('Message must be between 1 and 600 characters', '22023');
  if (jsonbType(extra) !== 'object') raise('Notification payload must be a JSON object', '22023');
  checkDeepLink(link);
  return transaction(ctx, async (tx) => {
    const broadcastId = crypto.randomUUID();
    await tx.run(`INSERT INTO ${t('public', 'notification_broadcasts')} (${['id', 'app_key', 'category', 'title', 'body', 'deep_link', 'payload', 'created_by'].map(col).join(', ')})
      VALUES (?, 'chc', ?, ?, ?, ?, ?, ?)`, broadcastId, category, title, body, link, jsonbText(extra), userId);
    // An account's devices share one inbox notification; an install with no account has none.
    await tx.run(`INSERT INTO ${NOTIFICATIONS} (${['user_id', 'app_key', 'category', 'event_type', 'title', 'body', 'deep_link', 'payload'].map(col).join(', ')})
      SELECT DISTINCT a.${col('user_id')}, 'chc', ?, 'admin_broadcast', ?, ?, ?, ? FROM ${DEVICES} a WHERE ${audienceSql('a')} AND a.${col('user_id')} IS NOT NULL`,
    category, title, body, link, jsonbText({ ...(extra as Row), broadcast_id: broadcastId, source: 'chc_admin' }), category);
    const deliveries = (await tx.run(`INSERT INTO ${DELIVERIES} (${col('notification_id')}, ${col('broadcast_id')}, ${col('device_id')}, ${col('provider')})
      SELECT n.${col('id')}, ?, a.${col('id')}, a.${col('provider')} FROM ${DEVICES} a
        LEFT JOIN ${NOTIFICATIONS} n ON n.${col('user_id')} = a.${col('user_id')} AND n.${col('event_type')} = 'admin_broadcast' AND json_extract(n.${col('payload')}, '$.broadcast_id') = ?
      WHERE ${audienceSql('a')} ON CONFLICT DO NOTHING`, broadcastId, broadcastId, category)).meta.changes;
    const recipients = (await tx.first(`SELECT count(DISTINCT coalesce(a.${col('user_id')}, a.${col('id')})) AS n FROM ${DELIVERIES} d
      JOIN ${DEVICES} a ON a.${col('id')} = d.${col('device_id')} WHERE d.${col('broadcast_id')} = ?`, broadcastId))!.n as number;
    await tx.run(`UPDATE ${t('public', 'notification_broadcasts')} SET ${col('recipient_count')} = ?, ${col('delivery_count')} = ? WHERE ${col('id')} = ?`, recipients, deliveries, broadcastId);
    return payload({ broadcastId, recipientCount: recipients, deliveryCount: deliveries, queuedAt: tx.at });
  });
}
