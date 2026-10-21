/**
 * What the learning functions share beyond src/rpc/common.ts: their
 * localizations (unfiltered by publication, unlike music's), the asset shape
 * public.learning_asset_json gives, lesson numbering and titles, display
 * dates, and the learning visibility rules.
 */
import { col, t } from '../../../../content-api/src/db/names.ts';
import type { ApiContext } from '../../rest/context.ts';
import { ADMIN, alias, all, canEditAccount, IN_LIST, order, UID, type Row } from '../common.ts';

export * from '../common.ts';

type LocalizationTable = 'cantor_localizations' | 'album_localizations' | 'lesson_set_localizations' | 'season_localizations' | 'hymn_localizations' | 'recording_localizations' | 'lesson_localizations';

/** Each id's localization in the locale (learning's are read whatever their status; their parents' visibility decides). */
export async function loadLocalizations(ctx: ApiContext, table: LocalizationTable, key: string, keyIds: unknown[], locale: string | null): Promise<Map<string, Row>> {
  const ids = [...new Set(keyIds.filter((id) => id != null))];
  if (!ids.length || locale == null) return new Map();
  const rows = await all(ctx, `SELECT * FROM ${t('learning', table)} WHERE ${col(key)} IN ${IN_LIST} AND ${col('locale')} = ?`, JSON.stringify(ids), locale);
  return new Map(rows.map((row) => [row[key] as string, row]));
}

const LEARNING_ASSET: [string, string][] = [
  ['id', 'id'], ['provider', 'provider'], ['bucket', 'bucket'], ['path', 'path'], ['mimeType', 'mime_type'], ['durationMs', 'duration_ms'],
  ['fileSizeBytes', 'file_size_bytes'], ['checksum', 'checksum'], ['width', 'width'], ['height', 'height'],
];

/** public.learning_asset_json: the asset's fields without the empty ones (jsonb_strip_nulls), or null. */
export function learningAsset(asset: Row | undefined | null): Row | null {
  if (!asset) return null;
  return Object.fromEntries(LEARNING_ASSET.filter(([, column]) => asset[column] != null).map(([key, column]) => [key, asset[column]]));
}

export const COVER = ['id', 'provider', 'bucket', 'path', 'mimeType', 'fileSizeBytes', 'checksum'];

/** public.learning_lesson_title: "Lesson n" in the reader's language. */
export function lessonTitle(locale: string | null, number: number): string {
  if (locale === 'ar') return `الدرس ${number}`;
  if (locale === 'fr') return `Leçon ${number}`;
  return `Lesson ${number}`;
}

/** coalesce(original_release_date::timestamptz, scheduled_release_at, created_at): a date is its midnight, UTC. */
export function displayDate(row: Row): string {
  if (row.original_release_date != null) return `${row.original_release_date}T00:00:00+00:00`;
  return (row.scheduled_release_at ?? row.created_at) as string;
}

/**
 * Each lesson's number in its set: its place among the set's published
 * lessons by sort order and id (the count of those before it, plus one).
 */
export async function lessonNumbers(ctx: ApiContext, lessonSetIds: unknown[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const ids = [...new Set(lessonSetIds.filter((id) => id != null))];
  if (!ids.length) return out;
  const lessons = await all(ctx, `SELECT ${col('id')}, ${col('lesson_set_id')}, ${col('sort_order')} FROM ${t('learning', 'lessons')}
    WHERE ${col('lesson_set_id')} IN ${IN_LIST} AND ${col('publication_status')} = 'published'`, JSON.stringify(ids));
  lessons.sort((a, b) => order.number(a.sort_order, b.sort_order) || order.ascNullsLast(a.id, b.id));
  const counts = new Map<string, number>();
  for (const lesson of lessons) {
    const n = (counts.get(lesson.lesson_set_id as string) ?? 0) + 1;
    counts.set(lesson.lesson_set_id as string, n);
    out.set(lesson.id as string, n);
  }
  return out;
}

/** private.learning_cantor_is_editable(id): an admin, an editor of its creator account, or of an account it has granted. */
export function cantorEditable(id: string): string {
  const c = alias('cantor');
  const p = alias('permission');
  return `(${ADMIN} = 1 OR EXISTS (SELECT 1 FROM ${t('learning', 'cantors')} ${c} WHERE ${c}.${col('id')} = ${id} AND ${c}.${col('owner_creator_account_id')} IS NOT NULL AND ${canEditAccount(`${c}.${col('owner_creator_account_id')}`)})
    OR EXISTS (SELECT 1 FROM ${t('learning', 'cantor_permissions')} ${p} WHERE ${p}.${col('cantor_id')} = ${id} AND ${canEditAccount(`${p}.${col('creator_account_id')}`)}))`;
}

/** learning_cantors_select (private.learning_cantor_is_visible): published, or editable by the caller. */
export function cantorVisible(id: string): string {
  const c = alias('visible_cantor');
  return `EXISTS (SELECT 1 FROM ${t('learning', 'cantors')} ${c} WHERE ${c}.${col('id')} = ${id} AND (${c}.${col('publication_status')} = 'published' OR ${cantorEditable(`${c}.${col('id')}`)}))`;
}

/** learning_playlists_select: the caller's own, or unlisted or public. */
export function playlistVisible(row: string): string {
  return `(${row}.${col('owner_user_id')} = ${UID} OR ${row}.${col('visibility')} IN ('unlisted', 'public'))`;
}
