/**
 * The learner's own progress and likes: ports of public.get_my_learning_progress,
 * get_my_learning_items, get_my_learning_playlists, set_learning_progress,
 * set_learning_item_progress and set_learning_item_liked
 * (schema/pg-user-schema.sql), checked by tests/learning.parity.test.ts.
 */
import { col, t } from '../../../../content-api/src/db/names.ts';
import { now, raise } from '../../pg.ts';
import type { ApiContext } from '../../rest/context.ts';
import {
  all, assetObject, COVER, first, learningAsset, lessonNumbers, lessonTitle, loadAssets, loadLocalizations, localized, order, payload, type Row,
} from './shared.ts';

export async function getMyLearningProgress(ctx: ApiContext, locale: string | null): Promise<unknown> {
  const rows = ctx.userId ? await all(ctx, `SELECT hp.*, h.${col('title')} AS hymn_title, h.${col('subtitle')} AS hymn_subtitle FROM ${t('learning', 'hymn_progress')} hp
    JOIN ${t('learning', 'hymns')} h ON h.${col('id')} = hp.${col('hymn_id')} AND h.${col('publication_status')} = 'published' WHERE hp.${col('user_id')} = ?`, ctx.userId) : [];
  const hymnL = await loadLocalizations(ctx, 'hymn_localizations', 'hymn_id', rows.map((r) => r.hymn_id), locale);
  return payload({
    authenticated: ctx.userId != null,
    items: rows.sort((a, b) => order.descNullsLast(a.updated_at, b.updated_at)).map((r) => {
      const l = hymnL.get(r.hymn_id as string);
      return { hymnId: r.hymn_id, state: r.state, title: l?.title ?? r.hymn_title, subtitle: l?.subtitle ?? r.hymn_subtitle, startedAt: r.started_at, finishedAt: r.finished_at, updatedAt: r.updated_at };
    }),
  });
}

export async function getMyLearningItems(ctx: ApiContext, locale: string | null): Promise<unknown> {
  const userId = ctx.userId;
  if (!userId) return payload({ authenticated: false, likedItemIds: [], items: [] });
  const likes = await all(ctx, `SELECT coalesce(${col('album_recording_id')}, ${col('lesson_id')}) AS item_id FROM ${t('learning', 'item_likes')} WHERE ${col('user_id')} = ?`, userId);
  const recordings = await all(ctx, `SELECT ip.${col('id')} AS progress_id, ip.${col('item_kind')} AS item_kind, ip.${col('state')} AS state, ip.${col('updated_at')} AS progress_updated_at,
      r.*, a.${col('id')} AS container_id, a.${col('title')} AS container_title, a.${col('cover_asset_id')} AS container_cover, c.${col('id')} AS cantor_row_id, c.${col('display_name')} AS cantor_display_name
    FROM ${t('learning', 'item_progress')} ip
    JOIN ${t('learning', 'album_recordings')} r ON r.${col('id')} = ip.${col('album_recording_id')} AND r.${col('publication_status')} = 'published'
    JOIN ${t('learning', 'albums')} a ON a.${col('id')} = r.${col('album_id')} AND a.${col('publication_status')} = 'published'
    JOIN ${t('learning', 'cantors')} c ON c.${col('id')} = a.${col('cantor_id')} AND c.${col('publication_status')} = 'published'
    JOIN ${t('media', 'media_assets')} ma ON ma.${col('id')} = r.${col('media_asset_id')} AND ma.${col('publication_status')} = 'published'
    WHERE ip.${col('user_id')} = ? AND ip.${col('item_kind')} = 'album_recording'`, userId);
  const lessons = await all(ctx, `SELECT ip.${col('id')} AS progress_id, ip.${col('item_kind')} AS item_kind, ip.${col('state')} AS state, ip.${col('updated_at')} AS progress_updated_at,
      l.*, s.${col('id')} AS container_id, s.${col('title')} AS container_title, s.${col('cover_asset_id')} AS container_cover, s.${col('hymn_id')} AS set_hymn_id,
      c.${col('id')} AS cantor_row_id, c.${col('display_name')} AS cantor_display_name
    FROM ${t('learning', 'item_progress')} ip
    JOIN ${t('learning', 'lessons')} l ON l.${col('id')} = ip.${col('lesson_id')} AND l.${col('publication_status')} = 'published'
    JOIN ${t('learning', 'lesson_sets')} s ON s.${col('id')} = l.${col('lesson_set_id')} AND s.${col('publication_status')} = 'published'
    JOIN ${t('learning', 'cantors')} c ON c.${col('id')} = s.${col('cantor_id')} AND c.${col('publication_status')} = 'published'
    JOIN ${t('media', 'media_assets')} ma ON ma.${col('id')} = l.${col('media_asset_id')} AND ma.${col('publication_status')} = 'published'
    WHERE ip.${col('user_id')} = ? AND ip.${col('item_kind')} = 'lesson'`, userId);
  const [recordingL, albumL, lessonL, setL, cantorL, assets, numbers] = await Promise.all([
    loadLocalizations(ctx, 'recording_localizations', 'recording_id', recordings.map((r) => r.id), locale),
    loadLocalizations(ctx, 'album_localizations', 'album_id', recordings.map((r) => r.container_id), locale),
    loadLocalizations(ctx, 'lesson_localizations', 'lesson_id', lessons.map((l) => l.id), locale),
    loadLocalizations(ctx, 'lesson_set_localizations', 'lesson_set_id', lessons.map((l) => l.container_id), locale),
    loadLocalizations(ctx, 'cantor_localizations', 'cantor_id', [...recordings, ...lessons].map((x) => x.cantor_row_id), locale),
    loadAssets(ctx, [...recordings, ...lessons].flatMap((x) => [x.media_asset_id, x.audio_asset_id, x.container_cover])),
    lessonNumbers(ctx, lessons.map((l) => l.lesson_set_id)),
  ]);
  const common = (x: Row) => ({
    progressId: x.progress_id, itemKind: x.item_kind, itemId: x.id, state: x.state, containerId: x.container_id,
    cantorId: x.cantor_row_id, cantorName: cantorL.get(x.cantor_row_id as string)?.display_name ?? x.cantor_display_name,
    mediaAsset: learningAsset(assets.get(x.media_asset_id as string)), coverAsset: assetObject(assets.get(x.container_cover as string), COVER),
  });
  const items = [
    ...recordings.map((r) => {
      const rl = recordingL.get(r.id as string);
      return {
        updatedAt: r.progress_updated_at as string,
        payload: {
          ...common(r), title: localized(rl, r, 'title'), subtitle: localized(rl, r, 'subtitle'), mediaType: 'audio',
          durationMs: r.duration_ms ?? assets.get(r.media_asset_id as string)?.duration_ms ?? null,
          containerTitle: albumL.get(r.container_id as string)?.title ?? r.container_title, hymnId: r.hymn_id,
        },
      };
    }),
    ...lessons.map((l) => {
      const ll = lessonL.get(l.id as string);
      return {
        updatedAt: l.progress_updated_at as string,
        payload: {
          ...common(l), title: ll?.title ?? lessonTitle(locale, numbers.get(l.id as string) ?? 1), subtitle: ll?.description ?? l.description,
          mediaType: l.media_type, durationMs: l.duration_ms ?? assets.get(l.audio_asset_id as string)?.duration_ms ?? assets.get(l.media_asset_id as string)?.duration_ms ?? null,
          containerTitle: setL.get(l.container_id as string)?.title ?? l.container_title, hymnId: l.set_hymn_id,
          audioAsset: learningAsset(assets.get(l.audio_asset_id as string)),
        },
      };
    }),
  ].sort((a, b) => order.descNullsLast(a.updatedAt, b.updatedAt));
  return payload({ authenticated: true, likedItemIds: likes.map((like) => like.item_id), items: items.map((item) => item.payload) });
}

export async function getMyLearningPlaylists(ctx: ApiContext): Promise<unknown> {
  const playlists = ctx.userId ? await all(ctx, `SELECT p.*, (SELECT count(*) FROM ${t('learning', 'playlist_items')} pi WHERE pi.${col('playlist_id')} = p.${col('id')}) AS item_count
    FROM ${t('learning', 'playlists')} p WHERE p.${col('owner_user_id')} = ?`, ctx.userId) : [];
  return payload({
    authenticated: ctx.userId != null,
    playlists: playlists.sort((a, b) => order.descNullsLast(a.updated_at, b.updated_at)).map((p) => ({ id: p.id, name: p.name, description: p.description, visibility: p.visibility, itemCount: p.item_count })),
  });
}

export async function setLearningProgress(ctx: ApiContext, hymnId: string, state: string): Promise<unknown> {
  const userId = ctx.userId;
  if (!userId) raise('Authentication required');
  const hymn = await first(ctx, `SELECT 1 AS yes FROM ${t('learning', 'hymns')} WHERE ${col('id')} = ? AND ${col('publication_status')} = 'published'`, hymnId);
  if (!hymn) raise('Published hymn not found');
  const stamp = now();
  const existing = await first(ctx, `SELECT * FROM ${t('learning', 'hymn_progress')} WHERE ${col('user_id')} = ? AND ${col('hymn_id')} = ?`, userId, hymnId);
  const finished = state === 'finished' ? stamp : null;
  if (!existing) {
    const started = state === 'learning' || state === 'finished' ? stamp : null;
    await ctx.db.prepare(`INSERT INTO ${t('learning', 'hymn_progress')} (${['user_id', 'hymn_id', 'state', 'started_at', 'finished_at', 'created_at', 'updated_at'].map(col).join(', ')}) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(userId, hymnId, state, started, finished, stamp, stamp).run();
  } else {
    const started = state === 'will_learn' ? null : (existing.started_at ?? stamp);
    await ctx.db.prepare(`UPDATE ${t('learning', 'hymn_progress')} SET ${col('state')} = ?, ${col('started_at')} = ?, ${col('finished_at')} = ?, ${col('updated_at')} = ? WHERE ${col('user_id')} = ? AND ${col('hymn_id')} = ?`)
      .bind(state, started, finished, stamp, userId, hymnId).run();
  }
  const row = await first(ctx, `SELECT * FROM ${t('learning', 'hymn_progress')} WHERE ${col('user_id')} = ? AND ${col('hymn_id')} = ?`, userId, hymnId);
  return payload({ hymnId: row!.hymn_id, state: row!.state, startedAt: row!.started_at, finishedAt: row!.finished_at, updatedAt: row!.updated_at });
}

/** The item exists, published, in a published album or lesson set. */
async function publishedItem(ctx: ApiContext, kind: string, itemId: string): Promise<boolean> {
  const sql = kind === 'album_recording'
    ? `SELECT 1 AS yes FROM ${t('learning', 'album_recordings')} r JOIN ${t('learning', 'albums')} a ON a.${col('id')} = r.${col('album_id')} WHERE r.${col('id')} = ? AND r.${col('publication_status')} = 'published' AND a.${col('publication_status')} = 'published'`
    : `SELECT 1 AS yes FROM ${t('learning', 'lessons')} l JOIN ${t('learning', 'lesson_sets')} s ON s.${col('id')} = l.${col('lesson_set_id')} WHERE l.${col('id')} = ? AND l.${col('publication_status')} = 'published' AND s.${col('publication_status')} = 'published'`;
  return Boolean(await first(ctx, sql, itemId));
}

export async function setLearningItemProgress(ctx: ApiContext, kind: string, itemId: string, state: string): Promise<unknown> {
  const userId = ctx.userId;
  if (!userId) raise('Authentication required', '28000');
  if (!(await publishedItem(ctx, kind, itemId))) raise(kind === 'album_recording' ? 'Published recording not found' : 'Published lesson not found');
  const column = kind === 'album_recording' ? 'album_recording_id' : 'lesson_id';
  const existing = await first(ctx, `SELECT * FROM ${t('learning', 'item_progress')} WHERE ${col('user_id')} = ? AND ${col(column)} = ?`, userId, itemId);
  const stamp = now();
  const finished = state === 'finished' ? stamp : null;
  let row: Row | null;
  if (!existing) {
    row = await first(ctx, `INSERT INTO ${t('learning', 'item_progress')} (${['id', 'user_id', 'item_kind', 'album_recording_id', 'lesson_id', 'state', 'started_at', 'finished_at', 'created_at', 'updated_at'].map(col).join(', ')})
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
      crypto.randomUUID(), userId, kind, kind === 'album_recording' ? itemId : null, kind === 'lesson' ? itemId : null, state,
      state === 'learning' || state === 'finished' ? stamp : null, finished, stamp, stamp);
  } else {
    row = await first(ctx, `UPDATE ${t('learning', 'item_progress')} SET ${col('state')} = ?, ${col('started_at')} = ?, ${col('finished_at')} = ?, ${col('updated_at')} = ? WHERE ${col('id')} = ? RETURNING *`,
      state, state === 'will_learn' ? null : (existing.started_at ?? stamp), finished, stamp, existing.id);
  }
  return payload({ id: row!.id, itemKind: row!.item_kind, itemId: row!.album_recording_id ?? row!.lesson_id, state: row!.state, updatedAt: row!.updated_at });
}

export async function setLearningItemLiked(ctx: ApiContext, kind: string, itemId: string, liked: boolean | null): Promise<boolean | null> {
  const userId = ctx.userId;
  if (!userId) raise('Authentication required', '28000');
  if (liked) {
    const column = kind === 'album_recording' ? 'album_recording_id' : 'lesson_id';
    await ctx.db.prepare(`INSERT INTO ${t('learning', 'item_likes')} (${col('id')}, ${col('user_id')}, ${col('item_kind')}, ${col(column)}, ${col('created_at')}) VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`)
      .bind(crypto.randomUUID(), userId, kind, itemId, now()).run();
  } else {
    await ctx.db.prepare(`DELETE FROM ${t('learning', 'item_likes')} WHERE ${col('user_id')} = ? AND ${col('item_kind')} = ? AND coalesce(${col('album_recording_id')}, ${col('lesson_id')}) = ?`)
      .bind(userId, kind, itemId).run();
  }
  return liked;
}

