/**
 * What the creator editor's functions share (CV-Artists, and CV-Admin's
 * editor): the account checks, the media "ready" rules
 * (private.submission_item_media_ready, submission_item_processing_state,
 * submission_required_items_ready, media_job_skipped_for_silence) as SQL
 * fragments, release dates, cover previews and asset versions.
 */
import { col, t } from '../../../../content-api/src/db/names.ts';
import { jsonbText, raise } from '../../pg.ts';
import type { ApiContext } from '../../rest/context.ts';
import { alias, canEditAccount, canReadOwner, first, ME, meParams, viewer, type Row } from '../common.ts';

export * from '../common.ts';

const ITEMS = t('media', 'submission_items');
const ASSETS = t('media', 'media_assets');
const INTENTS = t('media', 'upload_intents');
const JOBS = t('media', 'media_processing_jobs');

/** auth.uid() is null: 'Authentication required' (28000). */
export function requireAuth(ctx: ApiContext): string {
  if (!ctx.userId) raise('Authentication required', '28000');
  return ctx.userId!;
}

/** The value a check is about, bound once however often the check names it. */
const ARG = `(SELECT ${col('v')} FROM ${col('arg')})`;

async function holds(ctx: ApiContext, condition: string, value: unknown): Promise<boolean> {
  const v = await viewer(ctx);
  return Boolean((await first(ctx, `${ME}, ${col('arg')} (${col('v')}) AS (VALUES (?)) SELECT ${condition} AS ok`, ...meParams(v), value))?.ok);
}

/** private.can_edit_creator_account(account). */
export const canEdit = (ctx: ApiContext, account: unknown) => holds(ctx, canEditAccount(ARG), account);
/** private.can_read_media_owner(account). */
export const canRead = (ctx: ApiContext, account: unknown) => holds(ctx, canReadOwner(ARG), account);

/** private.media_job_skipped_for_silence(job.status, job.error_message): cancelled because the video had no audio. */
const skippedForSilence = (job: string) => `(${job}.${col('status')} = 'cancelled' AND coalesce(${job}.${col('error_message')}, '') GLOB 'No audio track*')`;

/** A silent video's audio job, skipped: the video is ready without audio. */
const silentVideo = (intent: string) => {
  const silent = alias('silent');
  return `EXISTS (SELECT 1 FROM ${JOBS} ${silent} WHERE ${silent}.${col('upload_intent_id')} = ${intent}.${col('id')} AND ${silent}.${col('job_type')} = 'audio_delivery' AND ${skippedForSilence(silent)})`;
};

/** private.submission_item_media_ready(item): its asset is processed, and a video has its audio (or has none). */
export function itemMediaReady(itemId: string): string {
  const [item, asset, intent, audio] = ['ready_item', 'ready_asset', 'ready_intent', 'ready_audio'].map(alias);
  return `EXISTS (SELECT 1 FROM ${ITEMS} ${item}
    JOIN ${ASSETS} ${asset} ON ${asset}.${col('id')} = ${item}.${col('media_asset_id')} AND ${asset}.${col('processing_status')} = 'completed'
    LEFT JOIN ${INTENTS} ${intent} ON ${intent}.${col('id')} = ${item}.${col('upload_intent_id')}
    WHERE ${item}.${col('id')} = ${itemId} AND (${intent}.${col('media_type')} IS NOT 'video'
      OR EXISTS (SELECT 1 FROM ${ASSETS} ${audio} WHERE ${audio}.${col('id')} = ${item}.${col('audio_only_asset_id')} AND ${audio}.${col('processing_status')} = 'completed')
      OR ${silentVideo(intent)}))`;
}

/** private.submission_item_processing_state(item): 'completed' once ready, else its job's, else its upload's status, else 'queued'. */
export function itemProcessingState(itemId: string): string {
  const [item, job, intent] = ['state_item', 'state_job', 'state_intent'].map(alias);
  return `(SELECT CASE WHEN ${itemMediaReady(`${item}.${col('id')}`)} THEN 'completed' ELSE coalesce(${job}.${col('status')}, ${intent}.${col('status')}, 'queued') END
    FROM ${ITEMS} ${item}
    LEFT JOIN ${JOBS} ${job} ON ${job}.${col('id')} = ${item}.${col('media_processing_job_id')}
    LEFT JOIN ${INTENTS} ${intent} ON ${intent}.${col('id')} = ${item}.${col('upload_intent_id')}
    WHERE ${item}.${col('id')} = ${itemId})`;
}

/** private.submission_required_items_ready(submission): it has required items, and each audio, image or video one is ready. */
export function requiredItemsReady(submissionId: string): string {
  const [any, item, asset, intent, audio] = ['req_any', 'req_item', 'req_asset', 'req_intent', 'req_audio'].map(alias);
  return `(EXISTS (SELECT 1 FROM ${ITEMS} ${any} WHERE ${any}.${col('submission_id')} = ${submissionId} AND ${any}.${col('required')} = 1)
    AND NOT EXISTS (SELECT 1 FROM ${ITEMS} ${item}
      LEFT JOIN ${ASSETS} ${asset} ON ${asset}.${col('id')} = ${item}.${col('media_asset_id')} AND ${asset}.${col('processing_status')} = 'completed'
      LEFT JOIN ${INTENTS} ${intent} ON ${intent}.${col('id')} = ${item}.${col('upload_intent_id')}
      LEFT JOIN ${ASSETS} ${audio} ON ${audio}.${col('id')} = ${item}.${col('audio_only_asset_id')} AND ${audio}.${col('processing_status')} = 'completed'
      WHERE ${item}.${col('submission_id')} = ${submissionId} AND ${item}.${col('required')} = 1
        AND (${asset}.${col('id')} IS NULL OR (${intent}.${col('media_type')} = 'video' AND ${audio}.${col('id')} IS NULL AND NOT ${silentVideo(intent)}))
        AND ${intent}.${col('media_type')} IN ('audio', 'image', 'video')))`;
}

/** extract(epoch from at)::bigint: whole seconds, a half second or more rounding up. */
export function epochVersion(at: unknown): number | null {
  if (at == null) return null;
  const text = at as string;
  const seconds = Date.parse(`${text.slice(0, 19)}Z`) / 1000;
  return seconds + (text[19] === '.' && text[20] >= '5' ? 1 : 0);
}

/** music.release_display_date: the original release date, else the scheduled day (UTC), else the release date. */
export function releaseDisplayDate(row: Row): string | null {
  return (row.original_release_date as string | null) ?? (row.scheduled_release_at != null ? (row.scheduled_release_at as string).slice(0, 10) : null) ?? (row.release_date as string | null);
}

/** public.earliest_release_at(): the hour after now, 48 hours on. */
export function earliestReleaseAt(at = new Date()): string {
  const floor = new Date(at);
  floor.setUTCMinutes(0, 0, 0);
  return `${new Date(floor.getTime() + 48 * 3600_000).toISOString().slice(0, 19)}+00:00`;
}

/** An image as the editor shows it: asset id, bucket, path and version. */
export const editorImage = (asset: Row | null | undefined, extra: Row = {}) => (asset
  ? { assetId: asset.id, bucket: asset.bucket, path: asset.path, version: epochVersion(asset.updated_at), ...extra }
  : null);

/** private.creator_release_preview_cover(release): the submission's newest processed artwork, else the release's cover. */
export async function previewCover(ctx: ApiContext, release: Row): Promise<Row | null> {
  const artwork = await first(ctx, `SELECT asset.* FROM ${ITEMS} item
    JOIN ${ASSETS} asset ON asset.${col('id')} = item.${col('media_asset_id')} AND asset.${col('processing_status')} = 'completed'
    WHERE item.${col('submission_id')} = nullif(json_extract(?, '$.submissionId'), '') AND item.${col('role')} = 'artwork'
    ORDER BY item.${col('created_at')} DESC, item.${col('id')} DESC LIMIT 1`, release.metadata);
  if (artwork) return editorImage(artwork);
  if (release.cover_asset_id == null) return null;
  return editorImage(await first(ctx, `SELECT * FROM ${ASSETS} WHERE ${col('id')} = ?`, release.cover_asset_id));
}

/** metadata ->> key: a string as it is, anything else as jsonb prints it. */
export function metadataText(metadata: unknown, key: string): string | null {
  const value = (JSON.parse((metadata as string) ?? '{}') as Row)[key];
  if (value == null) return null;
  return typeof value === 'string' ? value : jsonbText(value);
}
