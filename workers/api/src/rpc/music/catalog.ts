/**
 * The published music catalog: ports of public.get_music_home,
 * get_published_music_artist (with music.published_artist_social_links),
 * get_published_music_release_for_locale, get_published_music_track_for_locale,
 * get_music_artist_search_art and get_published_track_lyrics
 * (schema/pg-user-schema.sql), checked by tests/music.parity.test.ts.
 */
import { col, t } from '../../../../content-api/src/db/names.ts';
import schema from '../../../schema/user-tables.json' with { type: 'json' };
import type { ApiContext } from '../../rest/context.ts';
import {
  all, assetColumns, assetObject, first, IN_LIST, jsonText, loadAssets, loadCredits, loadLocalizations, loadPublishedArtists,
  localized, ME, meParams, order, payload, releaseDisplayDate, viewer, visible, type Row,
} from './shared.ts';

const SHORT_ASSET = ['id', 'provider', 'bucket', 'path', 'mimeType'];
const LONG_ASSET = ['id', 'provider', 'bucket', 'path', 'mimeType', 'fileSizeBytes', 'checksum'];
const lyricKinds = (schema as { enums: Record<string, string[]> }).enums.lyric_kind;

export async function getMusicHome(ctx: ApiContext, locale: string | null): Promise<unknown> {
  const releases = await all(ctx, `SELECT * FROM ${t('music', 'releases')} WHERE ${col('publication_status')} = 'published'
    ORDER BY ${col('release_date')} IS NULL, ${col('release_date')} DESC, ${col('created_at')} DESC LIMIT 24`);
  const [releaseLocalizations, primaryArtists, covers] = await Promise.all([
    loadLocalizations(ctx, 'release_localizations', 'release_id', releases.map((r) => r.id), locale),
    loadPublishedArtists(ctx, releases.map((r) => r.primary_artist_id)),
    loadAssets(ctx, releases.map((r) => r.cover_asset_id)),
  ]);
  const artistLocalizations = await loadLocalizations(ctx, 'artist_localizations', 'artist_id', [...primaryArtists.keys()], locale);
  const latest = releases.map((release) => {
    const localization = releaseLocalizations.get(release.id as string);
    const artist = primaryArtists.get(release.primary_artist_id as string);
    return {
      releaseDate: release.release_date,
      title: localized(localization, release, 'title'),
      payload: {
        id: release.id, title: localized(localization, release, 'title'), subtitle: localized(localization, release, 'subtitle'),
        releaseType: release.release_type, releaseDate: releaseDisplayDate(release),
        primaryArtist: artist ? { id: artist.id, displayName: localized(artistLocalizations.get(artist.id as string), artist, 'display_name') } : null,
        coverAsset: assetObject(covers.get(release.cover_asset_id as string), SHORT_ASSET),
      },
    };
  }).sort((a, b) => order.descNullsLast(a.releaseDate, b.releaseDate) || order.text(a.title, b.title));

  // The 24 first by (localized) name, which needs Postgres's text order: sorted here.
  const artists = await all(ctx, `SELECT * FROM ${t('music', 'artists')} WHERE ${col('publication_status')} = 'published'`);
  const [nameLocalizations, images] = await Promise.all([
    loadLocalizations(ctx, 'artist_localizations', 'artist_id', artists.map((a) => a.id), locale),
    loadAssets(ctx, artists.map((a) => a.profile_image_asset_id)),
  ]);
  const named = artists.map((artist) => ({ artist, name: localized(nameLocalizations.get(artist.id as string), artist, 'display_name') }))
    .sort((a, b) => order.text(a.name, b.name)).slice(0, 24);
  return payload({
    latestReleases: latest.map((row) => row.payload),
    artists: named.map(({ artist, name }) => ({
      id: artist.id, displayName: name, biography: localized(nameLocalizations.get(artist.id as string), artist, 'biography'),
      profileImageAsset: assetObject(images.get(artist.profile_image_asset_id as string), SHORT_ASSET),
    })),
  });
}

/** music.published_artist_social_links: a published artist's links, by sort order and age. */
async function publishedSocialLinks(ctx: ApiContext, artistId: string): Promise<Row[]> {
  const rows = await all(ctx, `SELECT link.* FROM ${t('music', 'artist_social_links')} link
    JOIN ${t('music', 'artists')} artist ON artist.${col('id')} = link.${col('artist_id')} AND artist.${col('publication_status')} = 'published'
    WHERE link.${col('artist_id')} = ?`, artistId);
  rows.sort((a, b) => order.number(a.sort_order, b.sort_order) || order.ascNullsLast(a.created_at, b.created_at));
  return rows.map((link) => ({ id: link.id, platform: link.platform, label: link.label, url: link.url }));
}

export async function getPublishedMusicArtist(ctx: ApiContext, artistId: string, locale: string | null): Promise<unknown> {
  const artist = await first(ctx, `SELECT * FROM ${t('music', 'artists')} WHERE ${col('id')} = ? AND ${col('publication_status')} = 'published'`, artistId);
  if (!artist) return null;
  const releases = await all(ctx, `SELECT * FROM ${t('music', 'releases')} WHERE ${col('primary_artist_id')} = ? AND ${col('publication_status')} = 'published'`, artistId);
  const [localizations, images, releaseLocalizations, socialLinks] = await Promise.all([
    loadLocalizations(ctx, 'artist_localizations', 'artist_id', [artistId], locale),
    loadAssets(ctx, [artist.profile_image_asset_id, ...releases.map((r) => r.cover_asset_id)]),
    loadLocalizations(ctx, 'release_localizations', 'release_id', releases.map((r) => r.id), locale),
    publishedSocialLinks(ctx, artistId),
  ]);
  const localization = localizations.get(artistId);
  const rows = releases.map((release) => {
    const l = releaseLocalizations.get(release.id as string);
    return {
      releaseDate: release.release_date, title: localized(l, release, 'title'),
      payload: {
        id: release.id, title: localized(l, release, 'title'), subtitle: localized(l, release, 'subtitle'), releaseType: release.release_type,
        releaseDate: releaseDisplayDate(release), coverAsset: assetObject(images.get(release.cover_asset_id as string), SHORT_ASSET),
      },
    };
  }).sort((a, b) => order.descNullsLast(a.releaseDate, b.releaseDate) || order.text(a.title, b.title));
  return payload({
    id: artist.id, displayName: localized(localization, artist, 'display_name'), biography: localized(localization, artist, 'biography'),
    profileImageAsset: assetObject(images.get(artist.profile_image_asset_id as string), SHORT_ASSET),
    socialLinks, releases: rows.map((row) => row.payload),
  });
}

/** The published tracks of releases, with their published audio, as the release view lists them. */
async function releaseTracks(ctx: ApiContext, releaseId: string): Promise<Row[]> {
  return all(ctx, `SELECT rt.${col('disc_number')} AS disc_number, rt.${col('track_number')} AS track_number, track.*
    FROM ${t('music', 'release_tracks')} rt
    JOIN ${t('music', 'tracks')} track ON track.${col('id')} = rt.${col('track_id')} AND track.${col('publication_status')} = 'published'
    JOIN ${t('media', 'media_assets')} asset ON asset.${col('id')} = track.${col('media_asset_id')} AND asset.${col('publication_status')} = 'published'
    WHERE rt.${col('release_id')} = ?`, releaseId);
}

export async function getPublishedMusicReleaseForLocale(ctx: ApiContext, releaseId: string, locale: string | null): Promise<unknown> {
  const release = await first(ctx, `SELECT * FROM ${t('music', 'releases')} WHERE ${col('id')} = ? AND ${col('publication_status')} = 'published'`, releaseId);
  if (!release) return null;
  const tracks = await releaseTracks(ctx, releaseId);
  const primaryArtists = await loadPublishedArtists(ctx, [release.primary_artist_id]);
  const artist = primaryArtists.get(release.primary_artist_id as string);
  const [localizations, artistLocalizations, assets, trackLocalizations, credits] = await Promise.all([
    loadLocalizations(ctx, 'release_localizations', 'release_id', [releaseId], locale),
    loadLocalizations(ctx, 'artist_localizations', 'artist_id', [artist?.id], locale),
    loadAssets(ctx, [release.cover_asset_id, artist?.profile_image_asset_id, ...tracks.map((track) => track.media_asset_id)]),
    loadLocalizations(ctx, 'track_localizations', 'track_id', tracks.map((track) => track.id), locale),
    loadCredits(ctx, tracks.map((track) => track.id), locale, true),
  ]);
  const localization = localizations.get(releaseId);
  tracks.sort((a, b) => order.number(a.disc_number, b.disc_number) || order.number(a.track_number, b.track_number) || order.ascNullsLast(a.id, b.id));
  return payload({
    id: release.id, title: localized(localization, release, 'title'), subtitle: localized(localization, release, 'subtitle'),
    description: localized(localization, release, 'description'), releaseType: release.release_type, releaseDate: releaseDisplayDate(release),
    publicationStatus: release.publication_status, musicType: jsonText(release.metadata, 'musicType'), recordingType: jsonText(release.metadata, 'recordingType'),
    coverAsset: assetObject(assets.get(release.cover_asset_id as string), LONG_ASSET),
    primaryArtist: artist ? {
      id: artist.id, displayName: localized(artistLocalizations.get(artist.id as string), artist, 'display_name'),
      profileImageAsset: assetObject(assets.get(artist.profile_image_asset_id as string), SHORT_ASSET),
    } : null,
    tracks: tracks.map((track) => {
      const l = trackLocalizations.get(track.id as string);
      return {
        id: track.id, title: localized(l, track, 'title'), subtitle: localized(l, track, 'subtitle'), discNumber: track.disc_number,
        trackNumber: track.track_number, durationMs: track.duration_ms, releaseId: release.id,
        mediaAsset: assetObject(assets.get(track.media_asset_id as string), LONG_ASSET), artists: credits.get(track.id as string) ?? [],
      };
    }),
  });
}

export async function getPublishedMusicTrackForLocale(ctx: ApiContext, trackId: string, locale: string | null): Promise<unknown> {
  const track = await first(ctx, `SELECT track.* FROM ${t('music', 'tracks')} track
    JOIN ${t('media', 'media_assets')} asset ON asset.${col('id')} = track.${col('media_asset_id')} AND asset.${col('publication_status')} = 'published'
    WHERE track.${col('id')} = ? AND track.${col('publication_status')} = 'published'`, trackId);
  if (!track) return null;
  // The release it's shown with: the latest scheduled, then the latest dated, then the first disc and track.
  const release = await first(ctx, `SELECT rt.${col('disc_number')} AS disc_number, rt.${col('track_number')} AS track_number, release.*
    FROM ${t('music', 'release_tracks')} rt
    JOIN ${t('music', 'releases')} release ON release.${col('id')} = rt.${col('release_id')} AND release.${col('publication_status')} = 'published'
    WHERE rt.${col('track_id')} = ?
    ORDER BY release.${col('scheduled_release_at')} IS NULL, release.${col('scheduled_release_at')} DESC, release.${col('release_date')} IS NULL, release.${col('release_date')} DESC,
      rt.${col('disc_number')}, rt.${col('track_number')} LIMIT 1`, trackId);
  const primaryArtists = await loadPublishedArtists(ctx, [release?.primary_artist_id]);
  const primary = primaryArtists.get(release?.primary_artist_id as string);
  const [trackLocalizations, releaseLocalizations, artistLocalizations, assets, credits] = await Promise.all([
    loadLocalizations(ctx, 'track_localizations', 'track_id', [trackId], locale),
    loadLocalizations(ctx, 'release_localizations', 'release_id', [release?.id], locale),
    loadLocalizations(ctx, 'artist_localizations', 'artist_id', [primary?.id], locale),
    loadAssets(ctx, [track.media_asset_id, release?.cover_asset_id]),
    loadCredits(ctx, [trackId], locale, false),
  ]);
  const l = trackLocalizations.get(trackId);
  const rl = release ? releaseLocalizations.get(release.id as string) : undefined;
  return payload({
    id: track.id, title: localized(l, track, 'title'), subtitle: localized(l, track, 'subtitle'), durationMs: track.duration_ms,
    discNumber: release?.disc_number ?? null, trackNumber: release?.track_number ?? null,
    mediaAsset: assetObject(assets.get(track.media_asset_id as string), LONG_ASSET),
    artists: credits.get(trackId) ?? [],
    release: release ? {
      id: release.id, title: localized(rl, release, 'title'), subtitle: localized(rl, release, 'subtitle'), releaseType: release.release_type,
      releaseDate: releaseDisplayDate(release), musicType: jsonText(release.metadata, 'musicType'), recordingType: jsonText(release.metadata, 'recordingType'),
      coverAsset: assetObject(assets.get(release.cover_asset_id as string), LONG_ASSET),
      primaryArtist: primary ? { id: primary.id, displayName: localized(artistLocalizations.get(primary.id as string), primary, 'display_name') } : null,
    } : null,
  });
}

/** The cover of the artist's latest published release, for search results. */
export async function getMusicArtistSearchArt(ctx: ApiContext, artistId: string): Promise<unknown> {
  const v = await viewer(ctx);
  // An invoker function: track_artists and release_tracks show only rows whose track, artist and release the caller can see.
  const cover = await first(ctx, `${ME} SELECT ${assetColumns('cover')} FROM ${t('music', 'track_artists')} ta
    JOIN ${t('music', 'release_tracks')} rt ON rt.${col('track_id')} = ta.${col('track_id')}
    JOIN ${t('music', 'releases')} release ON release.${col('id')} = rt.${col('release_id')} AND release.${col('publication_status')} = 'published'
    JOIN ${t('media', 'media_assets')} cover ON cover.${col('id')} = release.${col('cover_asset_id')} AND cover.${col('publication_status')} = 'published'
    WHERE ta.${col('artist_id')} = ? AND ${visible.track(`ta.${col('track_id')}`)} AND ${visible.artist(`ta.${col('artist_id')}`)} AND ${visible.release(`rt.${col('release_id')}`)}
    ORDER BY release.${col('scheduled_release_at')} IS NULL, release.${col('scheduled_release_at')} DESC, release.${col('release_date')} IS NULL, release.${col('release_date')} DESC,
      rt.${col('disc_number')}, rt.${col('track_number')} LIMIT 1`, ...meParams(v), artistId);
  return cover ? payload(assetObject(cover, ['id', 'provider', 'bucket', 'path', 'mimeType', 'fileSizeBytes', 'checksum'])) : null;
}

export async function getPublishedTrackLyrics(ctx: ApiContext, trackId: string, locale: string | null, kind: string | null): Promise<unknown> {
  const track = await first(ctx, `SELECT ${col('id')} FROM ${t('music', 'tracks')} WHERE ${col('id')} = ? AND ${col('publication_status')} = 'published'`, trackId);
  if (!track) return null;
  const sets = await all(ctx, `SELECT * FROM ${t('music', 'lyric_sets')} WHERE ${col('track_id')} = ? AND ${col('publication_status')} = 'published'
    AND (? IS NULL OR ${col('locale')} = ?) AND (? IS NULL OR ${col('kind')} = ?)`, trackId, locale, locale, kind, kind);
  const setIds = JSON.stringify(sets.map((set) => set.id));
  const lines = sets.length ? await all(ctx, `SELECT * FROM ${t('music', 'lyric_lines')} WHERE ${col('lyric_set_id')} IN ${IN_LIST} ORDER BY ${col('sequence')}`, setIds) : [];
  const words = lines.length ? await all(ctx, `SELECT * FROM ${t('music', 'lyric_words')} WHERE ${col('lyric_line_id')} IN ${IN_LIST} ORDER BY ${col('sequence')}`, JSON.stringify(lines.map((line) => line.id))) : [];
  sets.sort((a, b) => order.text(a.locale, b.locale) || lyricKinds.indexOf(a.kind as string) - lyricKinds.indexOf(b.kind as string));
  return payload({
    trackId: track.id,
    lyricSets: sets.map((set) => ({
      id: set.id, trackId: set.track_id, locale: set.locale, kind: set.kind, syncPrecision: set.sync_precision, title: set.title,
      source: set.source, publicationStatus: set.publication_status,
      lines: lines.filter((line) => line.lyric_set_id === set.id).map((line) => ({
        id: line.id, sequence: line.sequence, startMs: line.start_ms, endMs: line.end_ms, text: line.text,
        words: words.filter((word) => word.lyric_line_id === line.id).map((word) => ({ id: word.id, sequence: word.sequence, startMs: word.start_ms, endMs: word.end_ms, text: word.text })),
      })),
    })),
  });
}

