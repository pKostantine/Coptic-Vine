/**
 * The listener's own music: ports of public.get_my_music_library,
 * get_release_liked, get_artist_followed, set_track_liked,
 * set_artist_followed, set_release_liked and record_music_play
 * (schema/pg-user-schema.sql), checked by tests/music.parity.test.ts.
 */
import { col, t } from '../../../../content-api/src/db/names.ts';
import { now, raise } from '../../pg.ts';
import type { ApiContext } from '../../rest/context.ts';
import { playlistCovers, playlistCoverObject } from './playlists.ts';
import {
  all, assetObject, first, firstReleases, IN_LIST, jsonText, loadAssets, loadCredits, loadLocalizations, loadPublishedArtists, localized, ME,
  meParams, order, payload, releaseDisplayDate, viewer, visible, type Row,
} from './shared.ts';

const AUTH = 'Authentication required';

const TRACK_ASSET = ['id', 'provider', 'bucket', 'path', 'mimeType', 'fileSizeBytes', 'version'];
const COVER_ASSET = ['id', 'provider', 'bucket', 'path', 'mimeType', 'version'];

export async function getMyMusicLibrary(ctx: ApiContext, locale: string | null): Promise<unknown> {
  const userId = ctx.userId;
  if (!userId) {
    return payload({ authenticated: false, followedArtists: [], likedReleases: [], likedTracks: [], playlists: [], recentTracks: [], recentReleases: [] });
  }

  // Followed artists, liked releases and liked tracks, newest first.
  const follows = await all(ctx, `SELECT follow.${col('created_at')} AS followed_at, artist.* FROM ${t('music', 'artist_follows')} follow
    JOIN ${t('music', 'artists')} artist ON artist.${col('id')} = follow.${col('artist_id')} AND artist.${col('publication_status')} = 'published'
    WHERE follow.${col('user_id')} = ?`, userId);
  const releaseLikes = await all(ctx, `SELECT liked.${col('created_at')} AS liked_at, release.* FROM ${t('music', 'release_likes')} liked
    JOIN ${t('music', 'releases')} release ON release.${col('id')} = liked.${col('release_id')} AND release.${col('publication_status')} = 'published'
    WHERE liked.${col('user_id')} = ?`, userId);
  const trackLikes = await all(ctx, `SELECT liked.${col('created_at')} AS liked_at, track.* FROM ${t('music', 'track_likes')} liked
    JOIN ${t('music', 'tracks')} track ON track.${col('id')} = liked.${col('track_id')} AND track.${col('publication_status')} = 'published'
    JOIN ${t('media', 'media_assets')} asset ON asset.${col('id')} = track.${col('media_asset_id')} AND asset.${col('publication_status')} = 'published'
    WHERE liked.${col('user_id')} = ?`, userId);
  const playlists = await all(ctx, `SELECT * FROM ${t('music', 'playlists')} WHERE ${col('owner_user_id')} = ?`, userId);
  // Recent tracks: each track's latest play, newest first, the first 20 still published.
  const recent = await all(ctx, `SELECT latest.${col('played_at')} AS played_at, latest.${col('release_id')} AS played_release_id, track.*
    FROM (
      SELECT ${col('track_id')}, ${col('release_id')}, ${col('played_at')},
        row_number() OVER (PARTITION BY ${col('track_id')} ORDER BY ${col('played_at')} DESC, ${col('id')} DESC) AS rank
      FROM ${t('music', 'play_history')} WHERE ${col('user_id')} = ?
    ) latest
    JOIN ${t('music', 'tracks')} track ON track.${col('id')} = latest.${col('track_id')} AND track.${col('publication_status')} = 'published'
    JOIN ${t('media', 'media_assets')} asset ON asset.${col('id')} = track.${col('media_asset_id')} AND asset.${col('publication_status')} = 'published'
    WHERE latest.rank = 1 ORDER BY latest.${col('played_at')} DESC LIMIT 20`, userId);

  // The release each recent track is shown with: the one it was played from if it's still published, else its first.
  const recentReleases = new Map<string, Row>();
  if (recent.length) {
    const rows = await all(ctx, `SELECT rt.${col('track_id')} AS track_id, rt.${col('created_at')} AS added_at, release.*
      FROM ${t('music', 'release_tracks')} rt
      JOIN ${t('music', 'releases')} release ON release.${col('id')} = rt.${col('release_id')} AND release.${col('publication_status')} = 'published'
      WHERE rt.${col('track_id')} IN ${IN_LIST} ORDER BY rt.${col('created_at')}`, JSON.stringify(recent.map((r) => r.id)));
    for (const play of recent) {
      const candidates = rows.filter((row) => row.track_id === play.id);
      const chosen = candidates.find((row) => row.id === play.played_release_id) ?? candidates[0];
      if (chosen) recentReleases.set(play.id as string, chosen);
    }
  }

  const likedTrackReleases = await firstReleases(ctx, trackLikes.map((track) => track.id));
  const allReleases = [...releaseLikes, ...recentReleases.values()];
  const primaryArtists = await loadPublishedArtists(ctx, allReleases.map((release) => release.primary_artist_id));
  const tracks = [...trackLikes, ...recent];
  const [artistLocalizations, releaseLocalizations, trackLocalizations, assets, credits, covers] = await Promise.all([
    loadLocalizations(ctx, 'artist_localizations', 'artist_id', [...follows.map((a) => a.id), ...primaryArtists.keys()], locale),
    loadLocalizations(ctx, 'release_localizations', 'release_id', allReleases.map((r) => r.id), locale),
    loadLocalizations(ctx, 'track_localizations', 'track_id', tracks.map((track) => track.id), locale),
    loadAssets(ctx, [
      ...follows.map((a) => a.profile_image_asset_id), ...allReleases.map((r) => r.cover_asset_id),
      ...tracks.map((track) => track.media_asset_id), ...[...likedTrackReleases.values()].map((r) => r.cover_asset_id),
    ]),
    loadCredits(ctx, tracks.map((track) => track.id), locale, false),
    playlistCovers(ctx, playlists),
  ]);
  const releaseSummary = (release: Row) => {
    const l = releaseLocalizations.get(release.id as string);
    const primary = primaryArtists.get(release.primary_artist_id as string);
    return {
      id: release.id, title: localized(l, release, 'title'), subtitle: localized(l, release, 'subtitle'), releaseType: release.release_type,
      releaseDate: releaseDisplayDate(release), musicType: jsonText(release.metadata, 'musicType'), recordingType: jsonText(release.metadata, 'recordingType'),
      primaryArtist: primary ? { id: primary.id, displayName: localized(artistLocalizations.get(primary.id as string), primary, 'display_name') } : null,
      coverAsset: assetObject(assets.get(release.cover_asset_id as string), COVER_ASSET),
    };
  };
  const trackBase = (track: Row) => {
    const l = trackLocalizations.get(track.id as string);
    return { id: track.id, title: localized(l, track, 'title'), subtitle: localized(l, track, 'subtitle'), durationMs: track.duration_ms };
  };

  const trackCounts = new Map<string, number>();
  if (playlists.length) {
    for (const row of await all(ctx, `SELECT ${col('playlist_id')} AS playlist_id, count(*) AS n FROM ${t('music', 'playlist_tracks')} WHERE ${col('playlist_id')} IN ${IN_LIST} GROUP BY ${col('playlist_id')}`, JSON.stringify(playlists.map((p) => p.id)))) {
      trackCounts.set(row.playlist_id as string, row.n as number);
    }
  }

  const recentTracks = recent.map((track) => {
    const release = recentReleases.get(track.id as string);
    return {
      playedAt: track.played_at,
      track: { ...trackBase(track), releaseId: release?.id ?? null, mediaAsset: assetObject(assets.get(track.media_asset_id as string), TRACK_ASSET), artists: credits.get(track.id as string) ?? [] },
      release: release ? releaseSummary(release) : null,
    };
  });
  // Each release once, at its latest play, newest first.
  const latestByRelease = new Map<string, { release: Row; playedAt: string }>();
  for (const entry of recentTracks) {
    if (!entry.release) continue;
    const seen = latestByRelease.get(entry.release.id as string);
    if (!seen || (entry.playedAt as string) > seen.playedAt) latestByRelease.set(entry.release.id as string, { release: entry.release, playedAt: entry.playedAt as string });
  }

  return payload({
    authenticated: true,
    followedArtists: follows.sort((a, b) => order.descNullsLast(a.followed_at, b.followed_at)).map((artist) => {
      const l = artistLocalizations.get(artist.id as string);
      return {
        id: artist.id, displayName: localized(l, artist, 'display_name'), biography: localized(l, artist, 'biography'),
        profileImageAsset: assetObject(assets.get(artist.profile_image_asset_id as string), COVER_ASSET),
      };
    }),
    likedReleases: releaseLikes.sort((a, b) => order.descNullsLast(a.liked_at, b.liked_at)).map(releaseSummary),
    likedTracks: trackLikes.sort((a, b) => order.descNullsLast(a.liked_at, b.liked_at)).map((track) => {
      const release = likedTrackReleases.get(track.id as string);
      return {
        ...trackBase(track), releaseId: release?.id ?? null,
        releaseCoverAsset: assetObject(assets.get(release?.cover_asset_id as string), ['id', 'provider', 'bucket', 'path', 'mimeType', 'fileSizeBytes', 'version']),
        mediaAsset: assetObject(assets.get(track.media_asset_id as string), TRACK_ASSET), artists: credits.get(track.id as string) ?? [],
      };
    }),
    playlists: playlists.sort((a, b) => order.descNullsLast(a.updated_at, b.updated_at)).map((playlist) => ({
      id: playlist.id, name: playlist.name, description: playlist.description, visibility: playlist.visibility,
      trackCount: trackCounts.get(playlist.id as string) ?? 0, coverAsset: playlistCoverObject(covers.get(playlist.id as string)),
    })),
    recentTracks,
    recentReleases: [...latestByRelease.values()].sort((a, b) => order.descNullsLast(a.playedAt, b.playedAt)).map(({ release, playedAt }) => ({ ...release, playedAt })),
  });
}

export async function getReleaseLiked(ctx: ApiContext, releaseId: string): Promise<boolean> {
  if (!ctx.userId) return false;
  return Boolean(await first(ctx, `SELECT 1 AS yes FROM ${t('music', 'release_likes')} WHERE ${col('user_id')} = ? AND ${col('release_id')} = ?`, ctx.userId, releaseId));
}

export async function getArtistFollowed(ctx: ApiContext, artistId: string): Promise<boolean> {
  if (!ctx.userId) return false;
  return Boolean(await first(ctx, `SELECT 1 AS yes FROM ${t('music', 'artist_follows')} WHERE ${col('user_id')} = ? AND ${col('artist_id')} = ?`, ctx.userId, artistId));
}

/** Row-level security on an insert: the policy's WITH CHECK (with its parameters bound after the viewer's), or Postgres's refusal. */
async function insertAllowed(ctx: ApiContext, table: string, check: string, ...params: unknown[]): Promise<void> {
  const v = await viewer(ctx);
  const ok = await first(ctx, `${ME} SELECT ${check} AS ok`, ...meParams(v), ...params);
  if (!ok?.ok) raise(`new row violates row-level security policy for table "${table}"`, '42501');
}

export async function setTrackLiked(ctx: ApiContext, trackId: string, liked: boolean | null): Promise<boolean | null> {
  if (!ctx.userId) raise(AUTH, '28000');
  if (liked) {
    await insertAllowed(ctx, 'track_likes', visible.track('?'), trackId);
    await ctx.db.prepare(`INSERT INTO ${t('music', 'track_likes')} (${col('user_id')}, ${col('track_id')}, ${col('created_at')}) VALUES (?, ?, ?) ON CONFLICT (${col('user_id')}, ${col('track_id')}) DO NOTHING`).bind(ctx.userId, trackId, now()).run();
  } else {
    await ctx.db.prepare(`DELETE FROM ${t('music', 'track_likes')} WHERE ${col('user_id')} = ? AND ${col('track_id')} = ?`).bind(ctx.userId, trackId).run();
  }
  return liked;
}

export async function setArtistFollowed(ctx: ApiContext, artistId: string, followed: boolean | null): Promise<boolean | null> {
  if (!ctx.userId) raise(AUTH, '28000');
  if (followed) {
    await insertAllowed(ctx, 'artist_follows', visible.artist('?'), artistId);
    await ctx.db.prepare(`INSERT INTO ${t('music', 'artist_follows')} (${col('user_id')}, ${col('artist_id')}, ${col('created_at')}) VALUES (?, ?, ?) ON CONFLICT (${col('user_id')}, ${col('artist_id')}) DO NOTHING`).bind(ctx.userId, artistId, now()).run();
  } else {
    await ctx.db.prepare(`DELETE FROM ${t('music', 'artist_follows')} WHERE ${col('user_id')} = ? AND ${col('artist_id')} = ?`).bind(ctx.userId, artistId).run();
  }
  return followed;
}

export async function setReleaseLiked(ctx: ApiContext, releaseId: string, liked: boolean | null): Promise<boolean> {
  if (!ctx.userId) raise(AUTH, '42501');
  const release = await first(ctx, `SELECT 1 AS yes FROM ${t('music', 'releases')} WHERE ${col('id')} = ? AND ${col('publication_status')} = 'published'`, releaseId);
  if (!release) raise('Published release not found', '22023');
  if (liked) {
    await ctx.db.prepare(`INSERT INTO ${t('music', 'release_likes')} (${col('user_id')}, ${col('release_id')}, ${col('created_at')}) VALUES (?, ?, ?) ON CONFLICT (${col('user_id')}, ${col('release_id')}) DO NOTHING`).bind(ctx.userId, releaseId, now()).run();
    return true;
  }
  await ctx.db.prepare(`DELETE FROM ${t('music', 'release_likes')} WHERE ${col('user_id')} = ? AND ${col('release_id')} = ?`).bind(ctx.userId, releaseId).run();
  return false;
}

/** Keeps the newest 500 plays per listener. */
const HISTORY_KEPT = 500;

export async function recordMusicPlay(ctx: ApiContext, trackId: string, releaseId: string | null): Promise<boolean> {
  const userId = ctx.userId;
  if (!userId) return false;
  const track = await first(ctx, `SELECT ${col('media_asset_id')} AS asset FROM ${t('music', 'tracks')} WHERE ${col('id')} = ? AND ${col('publication_status')} = 'published'`, trackId);
  if (!track?.asset) raise('Track not found or unavailable', '22023');
  if (releaseId != null) {
    const v = await viewer(ctx);
    const contains = await first(ctx, `${ME} SELECT 1 AS yes FROM ${t('music', 'release_tracks')} rt
      JOIN ${t('music', 'releases')} release ON release.${col('id')} = rt.${col('release_id')} AND release.${col('publication_status')} = 'published'
      WHERE rt.${col('track_id')} = ? AND rt.${col('release_id')} = ? AND ${visible.track(`rt.${col('track_id')}`)}`, ...meParams(v), trackId, releaseId);
    if (!contains) raise('Release does not contain this track', '22023');
  }
  await insertAllowed(ctx, 'play_history', visible.track('?'), trackId);
  await ctx.db.batch([
    ctx.db.prepare(`INSERT INTO ${t('music', 'play_history')} (${['id', 'user_id', 'track_id', 'release_id', 'media_asset_id', 'progress_ms', 'completed', 'played_at'].map(col).join(', ')}) VALUES (?, ?, ?, ?, ?, 0, 0, ?)`)
      .bind(crypto.randomUUID(), userId, trackId, releaseId, track!.asset, now()),
    ctx.db.prepare(`DELETE FROM ${t('music', 'play_history')} WHERE ${col('id')} IN (
      SELECT ${col('id')} FROM ${t('music', 'play_history')} WHERE ${col('user_id')} = ? ORDER BY ${col('played_at')} DESC, ${col('id')} DESC LIMIT -1 OFFSET ${HISTORY_KEPT})`).bind(userId),
  ]);
  return true;
}
