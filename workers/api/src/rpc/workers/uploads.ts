/**
 * What the upload authorizer calls with the user's session: ports of
 * public.create_media_upload_intent, get_media_upload_intent_for_upload,
 * complete_media_upload_intent and get_admin_submission_preview_item
 * (schema/pg-user-schema.sql). Checked by tests/uploads.parity.test.ts.
 *
 * Supabase's complete_media_upload_intent marks an expired or mis-sized
 * upload failed, then raises, which undoes the mark; the port, in one
 * transaction, ends the same way: the upload as it was, and the error.
 */
import { col, t } from '../../../../content-api/src/db/names.ts';
import { transaction } from '../../db/transaction.ts';
import { now, raise } from '../../pg.ts';
import type { ApiContext } from '../../rest/context.ts';
import { canEdit, requireSignedInAdmin } from '../admin/shared.ts';
import { first } from '../common.ts';
import { addHours, trimSpaces } from '../creator/core.ts';

const INTENTS = t('media', 'upload_intents');

/** private.upload_file_extension: the name's extension, lowercased, with its dot; '' when there is none. */
const extension = (filename: string) => {
  const match = /\.([A-Za-z0-9]{1,12})$/.exec(filename);
  return match ? `.${match[1].toLowerCase()}` : '';
};

const notNull = (column: string) => raise(`null value in column "${column}" of relation "upload_intents" violates not-null constraint`, '23502');

export async function createMediaUploadIntent(ctx: ApiContext, a: {
  accountId: string | null; filename: string | null; contentType: string | null; contentLength: number | null; mediaType: string | null; checksum: string | null;
}): Promise<unknown> {
  if (!ctx.userId) raise('Authentication required', '28000');
  const contentType = a.contentType == null ? null : trimSpaces(a.contentType).toLowerCase();
  const checksum = trimSpaces(a.checksum ?? '').toLowerCase();
  if (a.accountId == null) raise('creator_account_id is required', '22023');
  if (!(await canEdit(ctx, a.accountId))) raise('Not authorized for creator account', '42501');
  if (a.filename == null || trimSpaces(a.filename).length === 0) raise('original_filename is required', '22023');
  if (contentType != null && !/^(audio|video|image)\/[a-z0-9.+-]+$/.test(contentType)) raise('Unsupported content type', '22023');
  if (a.contentLength == null || a.contentLength <= 0 || a.contentLength > 21474836480) raise('Invalid content length', '22023');
  if (checksum !== '' && !/^[a-f0-9]{64}$/.test(checksum)) raise('Invalid sha256 checksum', '22023');
  if (a.mediaType == null) notNull('media_type');
  if (contentType == null) notNull('content_type');
  const id = crypto.randomUUID();
  return transaction(ctx, async (tx) => {
    const intent = (await tx.writeFirst(`INSERT INTO ${INTENTS} (${['id', 'creator_account_id', 'requested_by', 'bucket', 'path', 'media_type', 'original_filename', 'content_type',
      'content_length', 'checksum_sha256', 'status', 'upload_expires_at'].map(col).join(', ')}) VALUES (?, ?, ?, 'chc-submissions', ?, ?, ?, ?, ?, ?, 'authorized', ?) RETURNING *`,
    id, a.accountId, ctx.userId, `submissions/${a.accountId}/${id}/original${extension(a.filename!)}`, a.mediaType, trimSpaces(a.filename!), contentType, a.contentLength,
    checksum || null, addHours(tx.at, 24)))!;
    return [{
      upload_intent_id: intent.id, bucket: intent.bucket, object_path: intent.path, expires_at: intent.upload_expires_at, content_type: intent.content_type,
      content_length: intent.content_length, media_type: intent.media_type,
    }];
  });
}

/** The caller's own upload, while it may still be sent. */
export async function getMediaUploadIntentForUpload(ctx: ApiContext, intentId: string): Promise<unknown> {
  const intent = await first(ctx, `SELECT * FROM ${INTENTS} WHERE ${col('id')} = ? AND ${col('requested_by')} = ? AND ${col('status')} = 'authorized' AND ${col('upload_expires_at')} > ?`,
    intentId, ctx.userId, now());
  if (!intent || !(await canEdit(ctx, intent.creator_account_id))) return [];
  return [{
    upload_intent_id: intent.id, creator_account_id: intent.creator_account_id, bucket: intent.bucket, object_path: intent.path, content_type: intent.content_type,
    content_length: intent.content_length, media_type: intent.media_type, checksum_sha256: intent.checksum_sha256, expires_at: intent.upload_expires_at,
  }];
}

export async function completeMediaUploadIntent(ctx: ApiContext, intentId: string, uploadedSize: number | null, etag: string | null): Promise<unknown> {
  if (!ctx.userId) raise('Authentication required', '28000');
  return transaction(ctx, async (tx) => {
    const intent = await tx.first(`SELECT * FROM ${INTENTS} WHERE ${col('id')} = ?`, intentId);
    if (!intent) raise('Upload intent not found', 'P0002');
    // requested_by <> auth.uid() is unknown, not true, when nobody is recorded.
    if ((intent!.requested_by != null && intent!.requested_by !== ctx.userId) || !(await canEdit(ctx, intent!.creator_account_id))) raise('Not authorized for upload intent', '42501');
    if (intent!.status !== 'authorized') raise('Upload intent is not authorized', '22023');
    if ((intent!.upload_expires_at as string) <= tx.at) raise('Upload intent expired', '22023');
    if (uploadedSize != null && uploadedSize !== intent!.content_length) raise('Uploaded size mismatch', '22023');
    const done = (await tx.writeFirst(`UPDATE ${INTENTS} SET ${col('status')} = 'uploaded', ${col('uploaded_size')} = ?, ${col('r2_http_etag')} = ?, ${col('uploaded_at')} = ?,
      ${col('completed_at')} = ?, ${col('error_message')} = NULL WHERE ${col('id')} = ? RETURNING *`, uploadedSize, etag, tx.at, tx.at, intent!.id))!;
    return [{ upload_intent_id: done.id, status: done.status, bucket: done.bucket, object_path: done.path, uploaded_at: done.uploaded_at }];
  });
}

/** The file an admin previews for an item: the original while it is kept, then its processed copy. */
export async function getAdminSubmissionPreviewItem(ctx: ApiContext, itemId: string): Promise<unknown> {
  await requireSignedInAdmin(ctx);
  const row = await first(ctx, `SELECT item.${col('id')} AS item_id, item.${col('submission_id')} AS submission_id, intent.${col('original_deleted_at')} AS deleted,
      intent.${col('bucket')} AS intent_bucket, intent.${col('path')} AS intent_path, intent.${col('content_type')} AS intent_type, intent.${col('content_length')} AS intent_length,
      intent.${col('original_filename')} AS original_filename, asset.${col('bucket')} AS asset_bucket, asset.${col('path')} AS asset_path, asset.${col('mime_type')} AS asset_type,
      asset.${col('file_size_bytes')} AS asset_size
    FROM ${t('media', 'submission_items')} item JOIN ${INTENTS} intent ON intent.${col('id')} = item.${col('upload_intent_id')}
    LEFT JOIN ${t('media', 'media_assets')} asset ON asset.${col('id')} = item.${col('media_asset_id')}
    WHERE item.${col('id')} = ? AND intent.${col('status')} = 'uploaded' AND (intent.${col('original_deleted_at')} IS NULL OR asset.${col('id')} IS NOT NULL)`, itemId);
  if (!row) return [];
  const original = row.deleted == null;
  return [{
    item_id: row.item_id, submission_id: row.submission_id, bucket: original ? row.intent_bucket : row.asset_bucket, object_path: original ? row.intent_path : row.asset_path,
    content_type: original ? row.intent_type : row.asset_type, content_length: original ? row.intent_length : row.asset_size, original_filename: row.original_filename,
  }];
}
