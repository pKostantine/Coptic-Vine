/**
 * Learners' playlists: ports of public.get_learning_playlist,
 * create_learning_playlist, update_learning_playlist, delete_learning_playlist,
 * add_learning_playlist_item and remove_learning_playlist_item
 * (schema/pg-user-schema.sql), checked by tests/learning.parity.test.ts.
 */
import { col, t } from '../../../../content-api/src/db/names.ts';
import { now, raise } from '../../pg.ts';
import type { ApiContext } from '../../rest/context.ts';
import {
  all, assetObject, cantorVisible, first, learningAsset, lessonNumbers, lessonTitle, loadAssets, loadLocalizations, localized, ME, meParams, order,
  payload, playlistVisible, viewer,
} from './shared.ts';

export async function getLearningPlaylist(ctx: ApiContext, playlistId: string, locale: string | null): Promise<unknown> {
  const v = await viewer(ctx);
  const playlist = await first(ctx, `${ME} SELECT * FROM ${t('learning', 'playlists')} p WHERE p.${col('id')} = ? AND ${playlistVisible('p')}`, ...meParams(v), playlistId);
  if (!playlist) return null;
  const items = await all(ctx, `SELECT * FROM ${t('learning', 'playlist_items')} WHERE ${col('playlist_id')} = ?`, playlistId);
  const recordingIds = items.filter((i) => i.item_kind === 'album_recording').map((i) => i.album_recording_id);
  const lessonIds = items.filter((i) => i.item_kind === 'lesson').map((i) => i.lesson_id);
  const recordings = recordingIds.length ? await all(ctx, `SELECT r.*, a.${col('id')} AS album_row_id, a.${col('title')} AS album_title FROM ${t('learning', 'album_recordings')} r
    JOIN ${t('learning', 'albums')} a ON a.${col('id')} = r.${col('album_id')} AND a.${col('publication_status')} = 'published'
    JOIN ${t('media', 'media_assets')} rma ON rma.${col('id')} = r.${col('media_asset_id')} AND rma.${col('publication_status')} = 'published'
    WHERE r.${col('id')} IN (SELECT value FROM json_each(?)) AND r.${col('publication_status')} = 'published'`, JSON.stringify(recordingIds)) : [];
  // A lesson set's cantor shows only if the caller may see it (the join has no "published" of its own).
  const lessons = lessonIds.length ? await all(ctx, `${ME} SELECT l.*, ls.${col('id')} AS set_row_id, ls.${col('title')} AS set_title, ls.${col('cover_asset_id')} AS set_cover,
      lc.${col('id')} AS cantor_row_id, lc.${col('display_name')} AS cantor_display_name
    FROM ${t('learning', 'lessons')} l
    JOIN ${t('learning', 'lesson_sets')} ls ON ls.${col('id')} = l.${col('lesson_set_id')} AND ls.${col('publication_status')} = 'published'
    JOIN ${t('media', 'media_assets')} lma ON lma.${col('id')} = l.${col('media_asset_id')} AND lma.${col('publication_status')} = 'published'
    LEFT JOIN ${t('learning', 'cantors')} lc ON lc.${col('id')} = ls.${col('cantor_id')} AND ${cantorVisible(`lc.${col('id')}`)}
    WHERE l.${col('id')} IN (SELECT value FROM json_each(?)) AND l.${col('publication_status')} = 'published'`, ...meParams(v), JSON.stringify(lessonIds)) : [];
  const recordingById = new Map(recordings.map((r) => [r.id as string, r]));
  const lessonById = new Map(lessons.map((l) => [l.id as string, l]));
  const [recordingL, albumL, lessonL, setL, cantorL, assets, numbers] = await Promise.all([
    loadLocalizations(ctx, 'recording_localizations', 'recording_id', recordings.map((r) => r.id), locale),
    loadLocalizations(ctx, 'album_localizations', 'album_id', recordings.map((r) => r.album_row_id), locale),
    loadLocalizations(ctx, 'lesson_localizations', 'lesson_id', lessons.map((l) => l.id), locale),
    loadLocalizations(ctx, 'lesson_set_localizations', 'lesson_set_id', lessons.map((l) => l.set_row_id), locale),
    loadLocalizations(ctx, 'cantor_localizations', 'cantor_id', lessons.map((l) => l.cantor_row_id), locale),
    loadAssets(ctx, [...recordings.map((r) => r.media_asset_id), ...lessons.flatMap((l) => [l.media_asset_id, l.audio_asset_id, l.set_cover])]),
    lessonNumbers(ctx, lessons.map((l) => l.lesson_set_id)),
  ]);
  const shown = items.filter((item) => (item.item_kind === 'album_recording' ? recordingById.has(item.album_recording_id as string) : lessonById.has(item.lesson_id as string)));
  shown.sort((a, b) => order.number(a.sort_order, b.sort_order) || order.ascNullsLast(a.id, b.id));
  return payload({
    id: playlist.id, name: playlist.name, description: playlist.description, visibility: playlist.visibility,
    items: shown.map((item) => {
      if (item.item_kind === 'album_recording') {
        const r = recordingById.get(item.album_recording_id as string)!;
        const rl = recordingL.get(r.id as string);
        const asset = assets.get(r.media_asset_id as string);
        return {
          id: item.id, kind: item.item_kind, sortOrder: item.sort_order,
          recording: {
            id: r.id, title: localized(rl, r, 'title'), subtitle: localized(rl, r, 'subtitle'), durationMs: r.duration_ms ?? asset?.duration_ms ?? null,
            albumId: r.album_row_id, albumTitle: albumL.get(r.album_row_id as string)?.title ?? r.album_title, mediaAsset: learningAsset(asset),
          },
        };
      }
      const l = lessonById.get(item.lesson_id as string)!;
      const ll = lessonL.get(l.id as string);
      const media = assets.get(l.media_asset_id as string);
      const audio = assets.get(l.audio_asset_id as string);
      return {
        id: item.id, kind: item.item_kind, sortOrder: item.sort_order,
        lesson: {
          id: l.id, mediaType: l.media_type, title: ll?.title ?? lessonTitle(locale, numbers.get(l.id as string) ?? 1),
          description: localized(ll, l, 'description'), durationMs: l.duration_ms ?? audio?.duration_ms ?? media?.duration_ms ?? null,
          lessonSetId: l.set_row_id, lessonSetTitle: setL.get(l.set_row_id as string)?.title ?? l.set_title,
          cantorName: l.cantor_row_id == null ? null : (cantorL.get(l.cantor_row_id as string)?.display_name ?? l.cantor_display_name),
          coverAsset: assetObject(assets.get(l.set_cover as string), ['id', 'provider', 'bucket', 'path', 'mimeType']),
          mediaAsset: learningAsset(media), audioAsset: learningAsset(audio),
        },
      };
    }),
  });
}

const trim = (value: string | null) => (value ?? '').replace(/^ +| +$/g, '');

export async function createLearningPlaylist(ctx: ApiContext, name: string | null, description: string | null, visibility: string | null): Promise<unknown> {
  const userId = ctx.userId;
  if (!userId) raise('Authentication required');
  if ([...trim(name)].length === 0) raise('Playlist name is required');
  const stamp = now();
  const row = await first(ctx, `INSERT INTO ${t('learning', 'playlists')} (${['id', 'owner_user_id', 'name', 'description', 'visibility', 'created_at', 'updated_at'].map(col).join(', ')}) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    crypto.randomUUID(), userId, trim(name), trim(description) || null, visibility, stamp, stamp);
  return payload({ id: row!.id, name: row!.name, description: row!.description, visibility: row!.visibility });
}

export async function updateLearningPlaylist(ctx: ApiContext, playlistId: string, name: string | null, description: string | null, visibility: string | null): Promise<unknown> {
  const userId = ctx.userId;
  if (!userId) raise('Authentication required', '28000');
  if ([...trim(name)].length === 0) raise('Playlist name is required');
  const result = await ctx.db.prepare(`UPDATE ${t('learning', 'playlists')} SET ${col('name')} = ?, ${col('description')} = ?, ${col('visibility')} = ?, ${col('updated_at')} = ? WHERE ${col('id')} = ? AND ${col('owner_user_id')} = ?`)
    .bind(trim(name), trim(description) || null, visibility, now(), playlistId, userId).run();
  if (result.meta.changes === 0) raise('Playlist not found', '42501');
  return getLearningPlaylist(ctx, playlistId, 'en');
}

export async function deleteLearningPlaylist(ctx: ApiContext, playlistId: string): Promise<boolean> {
  const userId = ctx.userId;
  if (!userId) raise('Authentication required', '28000');
  const result = await ctx.db.prepare(`DELETE FROM ${t('learning', 'playlists')} WHERE ${col('id')} = ? AND ${col('owner_user_id')} = ?`).bind(playlistId, userId).run();
  return result.meta.changes > 0;
}

export async function addLearningPlaylistItem(ctx: ApiContext, playlistId: string, kind: string, recordingId: string | null, lessonId: string | null): Promise<unknown> {
  const userId = ctx.userId;
  if (!userId) raise('Authentication required');
  const own = await first(ctx, `SELECT 1 AS yes FROM ${t('learning', 'playlists')} WHERE ${col('id')} = ? AND ${col('owner_user_id')} = ?`, playlistId, userId);
  if (!own) raise('Playlist not found');
  if (kind === 'album_recording') {
    if (recordingId == null || lessonId != null) raise('album_recording_id is required for album recordings');
    const ok = await first(ctx, `SELECT 1 AS yes FROM ${t('learning', 'album_recordings')} r JOIN ${t('learning', 'albums')} a ON a.${col('id')} = r.${col('album_id')}
      WHERE r.${col('id')} = ? AND r.${col('publication_status')} = 'published' AND a.${col('publication_status')} = 'published'`, recordingId);
    if (!ok) raise('Published recording not found');
  } else {
    if (lessonId == null || recordingId != null) raise('lesson_id is required for lessons');
    const ok = await first(ctx, `SELECT 1 AS yes FROM ${t('learning', 'lessons')} l JOIN ${t('learning', 'lesson_sets')} ls ON ls.${col('id')} = l.${col('lesson_set_id')}
      WHERE l.${col('id')} = ? AND l.${col('publication_status')} = 'published' AND ls.${col('publication_status')} = 'published'`, lessonId);
    if (!ok) raise('Published lesson not found');
  }
  const next = await first(ctx, `SELECT coalesce(max(${col('sort_order')}), -1) + 1 AS next FROM ${t('learning', 'playlist_items')} WHERE ${col('playlist_id')} = ?`, playlistId);
  await ctx.db.prepare(`INSERT INTO ${t('learning', 'playlist_items')} (${['id', 'playlist_id', 'item_kind', 'album_recording_id', 'lesson_id', 'sort_order', 'created_at'].map(col).join(', ')}) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(crypto.randomUUID(), playlistId, kind, recordingId, lessonId, next!.next, now()).run();
  return getLearningPlaylist(ctx, playlistId, 'en');
}

export async function removeLearningPlaylistItem(ctx: ApiContext, playlistId: string, itemId: string): Promise<unknown> {
  const userId = ctx.userId;
  if (!userId) raise('Authentication required');
  await ctx.db.prepare(`DELETE FROM ${t('learning', 'playlist_items')} WHERE ${col('id')} = ? AND ${col('playlist_id')} = ?
    AND EXISTS (SELECT 1 FROM ${t('learning', 'playlists')} p WHERE p.${col('id')} = ? AND p.${col('owner_user_id')} = ?)`).bind(itemId, playlistId, playlistId, userId).run();
  return getLearningPlaylist(ctx, playlistId, 'en');
}

