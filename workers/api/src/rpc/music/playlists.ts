/**
 * Listeners' playlists: ports of public.get_music_playlist,
 * create_music_playlist, update_music_playlist, delete_music_playlist,
 * add_track_to_music_playlist, remove_track_from_music_playlist,
 * set_music_playlist_track_order and clear_music_playlist_cover
 * (schema/pg-user-schema.sql), checked by tests/music.parity.test.ts.
 *
 * set_music_playlist_cover isn't here: it reads the uploaded file from
 * Supabase Storage and builds its URL from Supabase's sign-in issuer, so it
 * moves with the playlist covers to R2 (step 6 of docs/d1/phase2-runbook.md).
 */
import { col, t } from '../../../../content-api/src/db/names.ts';
import { now, raise } from '../../pg.ts';
import type { ApiContext } from '../../rest/context.ts';
import {
  all, assetColumns, assetObject, first, firstReleases, IN_LIST, loadAssets, loadCredits, loadLocalizations, localized, ME, meParams, order, payload,
  UID, viewer, visible, type Row,
} from './shared.ts';

const AUTH = 'Authentication required';
const NOT_EDITABLE = 'Playlist not found or not editable';

/**
 * Each playlist's cover: its own if it has one, else the cover of the first
 * track's (published) release in playlist order, as the lateral join in
 * get_music_playlist / get_my_music_library picks it.
 */
export async function playlistCovers(ctx: ApiContext, playlists: Row[]): Promise<Map<string, Row>> {
  const out = new Map<string, Row>();
  if (!playlists.length) return out;
  const v = await viewer(ctx);
  const candidates = await all(ctx, `${ME} SELECT pt.${col('playlist_id')} AS playlist_id, pt.${col('sort_order')} AS sort_order, pt.${col('created_at')} AS ordered_at, ${assetColumns('asset')}
    FROM ${t('music', 'playlist_tracks')} pt
    JOIN ${t('music', 'release_tracks')} rt ON rt.${col('track_id')} = pt.${col('track_id')}
    JOIN ${t('music', 'releases')} release ON release.${col('id')} = rt.${col('release_id')} AND release.${col('publication_status')} = 'published'
    JOIN ${t('media', 'media_assets')} asset ON asset.${col('id')} = release.${col('cover_asset_id')} AND asset.${col('publication_status')} = 'published'
    WHERE pt.${col('playlist_id')} IN ${IN_LIST} AND ${visible.track(`rt.${col('track_id')}`)}
    ORDER BY pt.${col('sort_order')}, pt.${col('created_at')}`, ...meParams(v), JSON.stringify(playlists.map((p) => p.id)));
  const own = await loadAssets(ctx, playlists.map((p) => p.cover_asset_id));
  for (const playlist of playlists) {
    const custom = own.get(playlist.cover_asset_id as string);
    const fallback = candidates.find((candidate) => candidate.playlist_id === playlist.id);
    if (custom || fallback) out.set(playlist.id as string, custom ?? fallback!);
  }
  return out;
}

/** A playlist's cover as the functions give it: an uploaded cover's path carries ?v=<version>, so a new upload isn't cached. */
export function playlistCoverObject(cover: Row | undefined): Row | null {
  if (!cover) return null;
  const object = assetObject(cover, ['id', 'provider', 'bucket', 'path', 'mimeType', 'fileSizeBytes', 'version'])!;
  if (cover.provider === 'external' && cover.bucket === 'playlist-covers') {
    const path = cover.path as string;
    object.path = `${path}${path.includes('?') ? '&v=' : '?v='}${cover.version}`;
  }
  return object;
}

export async function getMusicPlaylist(ctx: ApiContext, playlistId: string, locale: string | null): Promise<unknown> {
  const v = await viewer(ctx);
  // playlists_select_public_or_owner: a public playlist, or the caller's own.
  const playlist = await first(ctx, `${ME} SELECT * FROM ${t('music', 'playlists')} p WHERE p.${col('id')} = ? AND ${visible.playlist(`p.${col('id')}`)}`, ...meParams(v), playlistId);
  if (!playlist) return null;
  const tracks = await all(ctx, `SELECT pt.${col('sort_order')} AS sort_order, pt.${col('created_at')} AS added_at, track.*
    FROM ${t('music', 'playlist_tracks')} pt
    JOIN ${t('music', 'tracks')} track ON track.${col('id')} = pt.${col('track_id')} AND track.${col('publication_status')} = 'published'
    JOIN ${t('media', 'media_assets')} asset ON asset.${col('id')} = track.${col('media_asset_id')} AND asset.${col('publication_status')} = 'published'
    WHERE pt.${col('playlist_id')} = ?`, playlistId);
  const [covers, releases, localizations, assets, credits] = await Promise.all([
    playlistCovers(ctx, [playlist]),
    firstReleases(ctx, tracks.map((track) => track.id)),
    loadLocalizations(ctx, 'track_localizations', 'track_id', tracks.map((track) => track.id), locale),
    loadAssets(ctx, tracks.map((track) => track.media_asset_id)),
    loadCredits(ctx, tracks.map((track) => track.id), locale, false),
  ]);
  tracks.sort((a, b) => order.number(a.sort_order, b.sort_order) || order.ascNullsLast(a.added_at, b.added_at));
  // isOwner is owner = auth.uid(): null for a signed-out caller, as Postgres's comparison with null is.
  const isOwner = ctx.userId ? playlist.owner_user_id === ctx.userId : null;
  return payload({
    id: playlist.id, name: playlist.name, description: playlist.description, visibility: playlist.visibility, isOwner,
    ownerUserId: isOwner ? playlist.owner_user_id : null, hasCustomCover: playlist.cover_asset_id != null,
    coverAsset: playlistCoverObject(covers.get(playlistId)),
    tracks: tracks.map((track) => {
      const l = localizations.get(track.id as string);
      return {
        id: track.id, title: localized(l, track, 'title'), subtitle: localized(l, track, 'subtitle'), durationMs: track.duration_ms,
        releaseId: releases.get(track.id as string)?.id ?? null,
        mediaAsset: assetObject(assets.get(track.media_asset_id as string), ['id', 'provider', 'bucket', 'path', 'mimeType', 'fileSizeBytes', 'version']),
        artists: credits.get(track.id as string) ?? [],
      };
    }),
  });
}

/** Postgres's trim(): spaces only. */
const trim = (value: string | null) => (value ?? '').replace(/^ +| +$/g, '');

function requireUser(ctx: ApiContext): string {
  if (!ctx.userId) raise(AUTH, '28000');
  return ctx.userId;
}

/** private.music_playlist_is_editable: the caller owns it. */
async function requireEditable(ctx: ApiContext, playlistId: string): Promise<void> {
  const own = await first(ctx, `SELECT 1 AS yes FROM ${t('music', 'playlists')} WHERE ${col('id')} = ? AND ${col('owner_user_id')} = ?`, playlistId, ctx.userId);
  if (!own) raise(NOT_EDITABLE, '42501');
}

const touch = (ctx: ApiContext, playlistId: string) =>
  ctx.db.prepare(`UPDATE ${t('music', 'playlists')} SET ${col('updated_at')} = ? WHERE ${col('id')} = ?`).bind(now(), playlistId).run();

export async function createMusicPlaylist(ctx: ApiContext, name: string | null, description: string | null, visibility: string | null): Promise<string> {
  const userId = requireUser(ctx);
  if ([...trim(name)].length === 0) raise('Playlist name is required', '22023');
  const id = crypto.randomUUID();
  const stamp = now();
  await ctx.db.prepare(`INSERT INTO ${t('music', 'playlists')} (${col('id')}, ${col('owner_user_id')}, ${col('name')}, ${col('description')}, ${col('visibility')}, ${col('created_at')}, ${col('updated_at')}) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, userId, trim(name), trim(description) || null, visibility, stamp, stamp).run();
  return id;
}

export async function updateMusicPlaylist(ctx: ApiContext, playlistId: string, name: string | null, description: string | null, visibility: string | null): Promise<boolean> {
  requireUser(ctx);
  if ([...trim(name)].length === 0) raise('Playlist name is required', '22023');
  await requireEditable(ctx, playlistId);
  const result = await ctx.db.prepare(`UPDATE ${t('music', 'playlists')} SET ${col('name')} = ?, ${col('description')} = ?, ${col('visibility')} = ?, ${col('updated_at')} = ? WHERE ${col('id')} = ?`)
    .bind(trim(name), trim(description) || null, visibility, now(), playlistId).run();
  return result.meta.changes > 0;
}

export async function deleteMusicPlaylist(ctx: ApiContext, playlistId: string): Promise<boolean> {
  requireUser(ctx);
  await requireEditable(ctx, playlistId);
  const result = await ctx.db.prepare(`DELETE FROM ${t('music', 'playlists')} WHERE ${col('id')} = ?`).bind(playlistId).run();
  return result.meta.changes > 0;
}

export async function addTrackToMusicPlaylist(ctx: ApiContext, playlistId: string, trackId: string): Promise<boolean> {
  const userId = requireUser(ctx);
  await requireEditable(ctx, playlistId);
  const next = await first(ctx, `SELECT coalesce(max(${col('sort_order')}), -1) + 1 AS next FROM ${t('music', 'playlist_tracks')} WHERE ${col('playlist_id')} = ?`, playlistId);
  // playlist_tracks_insert_editable_playlist: the track must be one the caller can see.
  const v = await viewer(ctx);
  const allowed = await first(ctx, `${ME} SELECT ${visible.track('?')} AS ok`, ...meParams(v), trackId);
  if (!allowed?.ok) raise('new row violates row-level security policy for table "playlist_tracks"', '42501');
  await ctx.db.prepare(`INSERT INTO ${t('music', 'playlist_tracks')} (${col('playlist_id')}, ${col('track_id')}, ${col('sort_order')}, ${col('added_by')}, ${col('created_at')}) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (${col('playlist_id')}, ${col('track_id')}) DO NOTHING`).bind(playlistId, trackId, next!.next, userId, now()).run();
  await touch(ctx, playlistId);
  return true;
}

export async function removeTrackFromMusicPlaylist(ctx: ApiContext, playlistId: string, trackId: string): Promise<boolean> {
  requireUser(ctx);
  await requireEditable(ctx, playlistId);
  await ctx.db.prepare(`DELETE FROM ${t('music', 'playlist_tracks')} WHERE ${col('playlist_id')} = ? AND ${col('track_id')} = ?`).bind(playlistId, trackId).run();
  await touch(ctx, playlistId);
  return true;
}

export async function setMusicPlaylistTrackOrder(ctx: ApiContext, playlistId: string, trackIds: (string | null)[] | null): Promise<boolean> {
  requireUser(ctx);
  await requireEditable(ctx, playlistId);
  const existing = (await all(ctx, `SELECT ${col('track_id')} AS track_id FROM ${t('music', 'playlist_tracks')} WHERE ${col('playlist_id')} = ?`, playlistId)).map((row) => row.track_id);
  const supplied = trackIds ?? [];
  const distinct = new Set(supplied.filter((id) => id != null));
  if (supplied.length !== existing.length || distinct.size !== existing.length || supplied.some((id) => !existing.includes(id))) {
    raise('Track order must contain every playlist track exactly once', '22023');
  }
  for (const [index, trackId] of supplied.entries()) {
    await ctx.db.prepare(`UPDATE ${t('music', 'playlist_tracks')} SET ${col('sort_order')} = ? WHERE ${col('playlist_id')} = ? AND ${col('track_id')} = ?`).bind(index, playlistId, trackId).run();
  }
  await touch(ctx, playlistId);
  return true;
}

export async function clearMusicPlaylistCover(ctx: ApiContext, playlistId: string): Promise<boolean> {
  const userId = requireUser(ctx);
  const playlist = await first(ctx, `SELECT ${col('cover_asset_id')} AS cover FROM ${t('music', 'playlists')} WHERE ${col('id')} = ? AND ${col('owner_user_id')} = ?`, playlistId, userId);
  if (!playlist) raise(NOT_EDITABLE, '42501');
  const stamp = now();
  await ctx.db.prepare(`UPDATE ${t('music', 'playlists')} SET ${col('cover_asset_id')} = NULL, ${col('updated_at')} = ? WHERE ${col('id')} = ? AND ${col('owner_user_id')} = ?`).bind(stamp, playlistId, userId).run();
  if (playlist!.cover != null) {
    // The uploaded cover is archived, if it's the caller's own, as media_assets_update_owner_or_admin allows
    // (the policy's check of the Supabase Storage URL doesn't carry over: covers move to R2).
    const v = await viewer(ctx);
    await ctx.db.prepare(`${ME} UPDATE ${t('media', 'media_assets')} SET ${col('publication_status')} = 'archived', ${col('updated_by')} = ?, ${col('updated_at')} = ?
      WHERE ${col('id')} = ? AND ${col('provider')} = 'external' AND ${col('bucket')} = 'playlist-covers' AND ${col('created_by')} = ?
        AND (${'(SELECT ' + col('admin') + ' FROM ' + col('me') + ')'} = 1 OR (${col('owner_creator_account_id')} IS NULL AND EXISTS (
          SELECT 1 FROM ${t('music', 'playlists')} p WHERE p.${col('id')} = json_extract(${t('media', 'media_assets')}.${col('metadata')}, '$.playlistId') AND p.${col('owner_user_id')} = ${UID})))`)
      .bind(...meParams(v), userId, stamp, playlist!.cover, userId).run();
  }
  return true;
}
