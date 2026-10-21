/**
 * Link previews for the web app's Worker: ports of public.get_share_preview
 * and get_music_playlist_share_preview (schema/pg-user-schema.sql). Both run
 * as the caller (SECURITY INVOKER); what they read is published already,
 * except the tracks an artist's cover and a playlist's cover are found
 * through, which keep their own visibility (private.music_track_is_visible).
 * Checked by tests/share.parity.test.ts.
 */
import { col, t } from '../../../../content-api/src/db/names.ts';
import type { ApiContext } from '../../rest/context.ts';
import { first, ME, meParams, payload, viewer, visible, type Row } from '../common.ts';
import { toUuid, trimSpaces } from '../creator/core.ts';

const PUBLISHED = (row: string) => `${row}.${col('publication_status')} = 'published'`;
const ASSET = (alias: string) => `${alias}.${col('id')} AS ${alias}_id, ${alias}.${col('provider')} AS ${alias}_provider, ${alias}.${col('bucket')} AS ${alias}_bucket,
  ${alias}.${col('path')} AS ${alias}_path, ${alias}.${col('mime_type')} AS ${alias}_mime`;
const asset = (row: Row | null, alias: string): Row | null => (row?.[`${alias}_id`] == null ? null : {
  id: row[`${alias}_id`], provider: row[`${alias}_provider`], bucket: row[`${alias}_bucket`], path: row[`${alias}_path`], mimeType: row[`${alias}_mime`],
});
/** concat_ws(' — ', …): the parts that aren't null, joined. */
const joined = (...parts: unknown[]) => parts.filter((part) => part != null).join(' — ');
/** The newest release first (scheduled, then released), then its first track. */
const NEWEST = (r: string, rt: string) => `${r}.${col('scheduled_release_at')} IS NULL, ${r}.${col('scheduled_release_at')} DESC, ${r}.${col('release_date')} IS NULL,
  ${r}.${col('release_date')} DESC, ${rt}.${col('disc_number')}, ${rt}.${col('track_number')}`;

const L = (table: string, alias: string, key: string, id: string, published = true) => `LEFT JOIN ${table} ${alias} ON ${alias}.${col(key)} = ${id} AND ${alias}.${col('locale')} = ?${published ? ` AND ${PUBLISHED(alias)}` : ''}`;

async function artistPreview(ctx: ApiContext, id: string, locale: string | null): Promise<Row | null> {
  const row = await first(ctx, `SELECT a.${col('id')} AS id, coalesce(l.${col('display_name')}, a.${col('display_name')}) AS title,
      coalesce(l.${col('biography')}, a.${col('biography')}, 'Listen on Coptic Vine') AS description, ${ASSET('profile')}
    FROM ${t('music', 'artists')} a ${L(t('music', 'artist_localizations'), 'l', 'artist_id', `a.${col('id')}`)}
    LEFT JOIN ${t('media', 'media_assets')} profile ON profile.${col('id')} = a.${col('profile_image_asset_id')} AND ${PUBLISHED('profile')}
    WHERE a.${col('id')} = ? AND ${PUBLISHED('a')}`, locale, id);
  if (!row) return null;
  let image = asset(row, 'profile');
  if (!image) {
    // The newest published release cover among the artist's credits.
    const v = await viewer(ctx);
    const cover = await first(ctx, `${ME} SELECT ${ASSET('cover')} FROM ${t('music', 'track_artists')} ta
        JOIN ${t('music', 'release_tracks')} rt ON rt.${col('track_id')} = ta.${col('track_id')}
        JOIN ${t('music', 'releases')} r ON r.${col('id')} = rt.${col('release_id')} AND ${PUBLISHED('r')}
        JOIN ${t('media', 'media_assets')} cover ON cover.${col('id')} = r.${col('cover_asset_id')} AND ${PUBLISHED('cover')}
      WHERE ta.${col('artist_id')} = ? AND ${visible.track(`ta.${col('track_id')}`)}
      ORDER BY ${NEWEST('r', 'rt')} LIMIT 1`, ...meParams(v), row.id);
    image = asset(cover, 'cover');
  }
  return { title: row.title, description: row.description, imageAsset: image };
}

async function releasePreview(ctx: ApiContext, id: string, locale: string | null): Promise<Row | null> {
  const row = await first(ctx, `SELECT coalesce(l.${col('title')}, r.${col('title')}) AS title, coalesce(l.${col('description')}, r.${col('description')}) AS about,
      coalesce(al.${col('display_name')}, artist.${col('display_name')}) AS artist, ${ASSET('cover')}
    FROM ${t('music', 'releases')} r ${L(t('music', 'release_localizations'), 'l', 'release_id', `r.${col('id')}`)}
    LEFT JOIN ${t('music', 'artists')} artist ON artist.${col('id')} = r.${col('primary_artist_id')} AND ${PUBLISHED('artist')}
    ${L(t('music', 'artist_localizations'), 'al', 'artist_id', `artist.${col('id')}`)}
    LEFT JOIN ${t('media', 'media_assets')} cover ON cover.${col('id')} = r.${col('cover_asset_id')} AND ${PUBLISHED('cover')}
    WHERE r.${col('id')} = ? AND ${PUBLISHED('r')}`, locale, locale, id);
  return row && { title: row.title, description: joined(row.about, row.artist), imageAsset: asset(row, 'cover') };
}

async function trackPreview(ctx: ApiContext, id: string, locale: string | null): Promise<Row | null> {
  const track = await first(ctx, `SELECT tr.${col('id')} AS id, coalesce(l.${col('title')}, tr.${col('title')}) AS title
    FROM ${t('music', 'tracks')} tr ${L(t('music', 'track_localizations'), 'l', 'track_id', `tr.${col('id')}`)}
    WHERE tr.${col('id')} = ? AND ${PUBLISHED('tr')}`, locale, id);
  if (!track) return null;
  // Its newest published release, for the title and the artwork.
  const release = await first(ctx, `SELECT coalesce(l.${col('title')}, r.${col('title')}) AS title, ${ASSET('cover')}
    FROM ${t('music', 'release_tracks')} rt JOIN ${t('music', 'releases')} r ON r.${col('id')} = rt.${col('release_id')} AND ${PUBLISHED('r')}
    ${L(t('music', 'release_localizations'), 'l', 'release_id', `r.${col('id')}`)}
    LEFT JOIN ${t('media', 'media_assets')} cover ON cover.${col('id')} = r.${col('cover_asset_id')} AND ${PUBLISHED('cover')}
    WHERE rt.${col('track_id')} = ? ORDER BY ${NEWEST('r', 'rt')} LIMIT 1`, locale, track.id);
  return {
    title: track.title,
    description: release?.title != null ? `${track.title} — ${release.title}` : track.title,
    imageAsset: release ? asset(release, 'cover') : null,
  };
}

async function cantorPreview(ctx: ApiContext, id: string, locale: string | null): Promise<Row | null> {
  const row = await first(ctx, `SELECT coalesce(l.${col('display_name')}, c.${col('display_name')}) AS title,
      coalesce(l.${col('biography')}, c.${col('biography')}, 'Learn on Coptic Vine') AS description, ${ASSET('profile')}
    FROM ${t('learning', 'cantors')} c ${L(t('learning', 'cantor_localizations'), 'l', 'cantor_id', `c.${col('id')}`, false)}
    LEFT JOIN ${t('media', 'media_assets')} profile ON profile.${col('id')} = c.${col('profile_image_asset_id')} AND ${PUBLISHED('profile')}
    WHERE c.${col('id')} = ? AND ${PUBLISHED('c')}`, locale, id);
  return row && { title: row.title, description: row.description, imageAsset: asset(row, 'profile') };
}

async function albumPreview(ctx: ApiContext, id: string, locale: string | null): Promise<Row | null> {
  const row = await first(ctx, `SELECT coalesce(l.${col('title')}, a.${col('title')}) AS title, coalesce(l.${col('description')}, a.${col('description')}) AS about,
      coalesce(cl.${col('display_name')}, c.${col('display_name')}) AS cantor, ${ASSET('cover')}
    FROM ${t('learning', 'albums')} a JOIN ${t('learning', 'cantors')} c ON c.${col('id')} = a.${col('cantor_id')} AND ${PUBLISHED('c')}
    ${L(t('learning', 'album_localizations'), 'l', 'album_id', `a.${col('id')}`, false)}
    ${L(t('learning', 'cantor_localizations'), 'cl', 'cantor_id', `c.${col('id')}`, false)}
    LEFT JOIN ${t('media', 'media_assets')} cover ON cover.${col('id')} = a.${col('cover_asset_id')} AND ${PUBLISHED('cover')}
    WHERE a.${col('id')} = ? AND ${PUBLISHED('a')}`, locale, locale, id);
  return row && { title: row.title, description: joined(row.about, row.cantor), imageAsset: asset(row, 'cover') };
}

async function lessonPreview(ctx: ApiContext, id: string, locale: string | null): Promise<Row | null> {
  const row = await first(ctx, `SELECT coalesce(ll.${col('title')}, lesson.${col('title')}) AS title, coalesce(sl.${col('title')}, s.${col('title')}) AS lesson_set,
      coalesce(cl.${col('display_name')}, c.${col('display_name')}) AS cantor, ${ASSET('cover')}
    FROM ${t('learning', 'lessons')} lesson JOIN ${t('learning', 'lesson_sets')} s ON s.${col('id')} = lesson.${col('lesson_set_id')} AND ${PUBLISHED('s')}
    JOIN ${t('learning', 'cantors')} c ON c.${col('id')} = s.${col('cantor_id')} AND ${PUBLISHED('c')}
    ${L(t('learning', 'lesson_localizations'), 'll', 'lesson_id', `lesson.${col('id')}`, false)}
    ${L(t('learning', 'lesson_set_localizations'), 'sl', 'lesson_set_id', `s.${col('id')}`, false)}
    ${L(t('learning', 'cantor_localizations'), 'cl', 'cantor_id', `c.${col('id')}`, false)}
    LEFT JOIN ${t('media', 'media_assets')} cover ON cover.${col('id')} = s.${col('cover_asset_id')} AND ${PUBLISHED('cover')}
    WHERE lesson.${col('id')} = ? AND ${PUBLISHED('lesson')}`, locale, locale, locale, id);
  return row && { title: row.title, description: joined(row.lesson_set, row.cantor), imageAsset: asset(row, 'cover') };
}

const PREVIEWS: [RegExp, (ctx: ApiContext, id: string, locale: string | null) => Promise<Row | null>][] = [
  [/^\/music\/artist\/([0-9a-fA-F-]{36})\/?$/, artistPreview],
  [/^\/music\/release\/([0-9a-fA-F-]{36})\/?$/, releasePreview],
  [/^\/music\/track\/([0-9a-fA-F-]{36})\/?$/, trackPreview],
  [/^\/learn\/cantor\/([0-9a-fA-F-]{36})\/?$/, cantorPreview],
  [/^\/learn\/album\/([0-9a-fA-F-]{36})\/?$/, albumPreview],
  [/^\/learn\/lesson\/([0-9a-fA-F-]{36})\/?$/, lessonPreview],
];

/** The title, description and image a shared link shows, for the page at the path; the app's own otherwise. */
export async function getSharePreview(ctx: ApiContext, path: string | null, locale: string | null): Promise<unknown> {
  const clean = (path ?? '/').split('?')[0];
  for (const [pattern, preview] of PREVIEWS) {
    const match = pattern.exec(clean);
    if (!match) continue;
    const found = await preview(ctx, toUuid(match[1])!, locale);
    if (found) return payload(found);
  }
  return payload({ title: 'Coptic Vine', description: 'Cross-platform Coptic Orthodox worship app for multilingual liturgical books, Scripture, and hymns.', imageAsset: null });
}

/** A public playlist's preview: its cover, else the cover of its first track's published release. */
export async function getMusicPlaylistSharePreview(ctx: ApiContext, playlistId: string): Promise<unknown> {
  const playlist = await first(ctx, `SELECT * FROM ${t('music', 'playlists')} WHERE ${col('id')} = ? AND ${col('visibility')} = 'public'`, playlistId);
  if (!playlist) return null;
  const v = await viewer(ctx);
  const ASSETS = t('media', 'media_assets');
  const cover = await first(ctx, `${ME} SELECT asset.* FROM (
      SELECT ? AS asset_id, 0 AS priority, 0 AS sort_order, ? AS ordered_at, 0 AS n
      UNION ALL
      SELECT r.${col('cover_asset_id')}, 1, pt.${col('sort_order')}, pt.${col('created_at')}, pt.rowid FROM ${t('music', 'playlist_tracks')} pt
        JOIN ${t('music', 'release_tracks')} rt ON rt.${col('track_id')} = pt.${col('track_id')} AND ${visible.track(`rt.${col('track_id')}`)}
        JOIN ${t('music', 'releases')} r ON r.${col('id')} = rt.${col('release_id')} AND ${PUBLISHED('r')}
      WHERE pt.${col('playlist_id')} = ?
    ) candidate JOIN ${ASSETS} asset ON asset.${col('id')} = candidate.asset_id AND ${PUBLISHED('asset')}
    ORDER BY candidate.priority, candidate.sort_order, candidate.ordered_at, candidate.n LIMIT 1`, ...meParams(v), playlist.cover_asset_id, playlist.created_at, playlist.id);
  const path = cover && cover.provider === 'external' && cover.bucket === 'playlist-covers'
    ? `${cover.path}${(cover.path as string).includes('?') ? '&v=' : '?v='}${cover.version}`
    : cover?.path;
  return payload({
    title: playlist.name,
    description: (playlist.description == null ? null : trimSpaces(playlist.description as string) || null) ?? `Listen to ${playlist.name} on Coptic Vine.`,
    imageAsset: cover ? { id: cover.id, provider: cover.provider, bucket: cover.bucket, path, mimeType: cover.mime_type, version: cover.version } : null,
  });
}
