/**
 * What the music functions share beyond src/rpc/common.ts: localizations,
 * artist credits, the release each track is shown with, release dates.
 */
import { compareText } from '../../../../content-api/src/pg.ts';
import { col, t } from '../../../../content-api/src/db/names.ts';
import type { ApiContext } from '../../rest/context.ts';
import { all, IN_LIST, order, type Row } from '../common.ts';

export * from '../common.ts';

const ids = (values: unknown[]) => JSON.stringify([...new Set(values.filter((value) => value != null))]);

// ─── Localizations ────────────────────────────────────────────────────────

/** The published localization of each id in the locale (artist_localizations, release_localizations, track_localizations). */
export async function loadLocalizations(ctx: ApiContext, table: 'artist_localizations' | 'release_localizations' | 'track_localizations', key: string, keyIds: unknown[], locale: string | null): Promise<Map<string, Row>> {
  if (!keyIds.some((id) => id != null) || locale == null) return new Map();
  const rows = await all(ctx, `SELECT * FROM ${t('music', table)} WHERE ${col(key)} IN ${IN_LIST} AND ${col('locale')} = ? AND ${col('publication_status')} = 'published'`, ids(keyIds), locale);
  return new Map(rows.map((row) => [row[key] as string, row]));
}

/** Published artists by id. */
export async function loadPublishedArtists(ctx: ApiContext, artistIds: unknown[]): Promise<Map<string, Row>> {
  if (!artistIds.some((id) => id != null)) return new Map();
  const rows = await all(ctx, `SELECT * FROM ${t('music', 'artists')} WHERE ${col('id')} IN ${IN_LIST} AND ${col('publication_status')} = 'published'`, ids(artistIds));
  return new Map(rows.map((row) => [row.id as string, row]));
}

// ─── Artist credits ───────────────────────────────────────────────────────

/**
 * Each track's credited (published) artists, as the music functions list
 * them: { id, displayName, role, sortOrder }, by sort order, then by name:
 * the localized name in the release view, the artist's own elsewhere.
 */
export async function loadCredits(ctx: ApiContext, trackIds: unknown[], locale: string | null, orderByLocalizedName: boolean): Promise<Map<string, Row[]>> {
  const out = new Map<string, Row[]>();
  if (!trackIds.some((id) => id != null)) return out;
  const rows = await all(ctx, `SELECT ta.${col('track_id')} AS track_id, ta.${col('role')} AS role, ta.${col('sort_order')} AS sort_order, a.${col('id')} AS artist_id, a.${col('display_name')} AS display_name, al.${col('display_name')} AS localized_name
    FROM ${t('music', 'track_artists')} ta
    JOIN ${t('music', 'artists')} a ON a.${col('id')} = ta.${col('artist_id')} AND a.${col('publication_status')} = 'published'
    LEFT JOIN ${t('music', 'artist_localizations')} al ON al.${col('artist_id')} = a.${col('id')} AND al.${col('locale')} = ? AND al.${col('publication_status')} = 'published'
    WHERE ta.${col('track_id')} IN ${IN_LIST}`, locale, ids(trackIds));
  const name = (row: Row) => (orderByLocalizedName ? (row.localized_name ?? row.display_name) : row.display_name) as string;
  rows.sort((a, b) => (a.sort_order as number) - (b.sort_order as number) || compareText(name(a), name(b)));
  for (const row of rows) {
    const list = out.get(row.track_id as string) ?? [];
    list.push({ id: row.artist_id, displayName: row.localized_name ?? row.display_name, role: row.role, sortOrder: row.sort_order });
    out.set(row.track_id as string, list);
  }
  return out;
}

/** For each track, its first published release by when it was added (release_tracks.created_at). */
export async function firstReleases(ctx: ApiContext, trackIds: unknown[]): Promise<Map<string, Row>> {
  const out = new Map<string, Row>();
  if (!trackIds.length) return out;
  const rows = await all(ctx, `SELECT rt.${col('track_id')} AS track_id, rt.${col('created_at')} AS added_at, release.*
    FROM ${t('music', 'release_tracks')} rt
    JOIN ${t('music', 'releases')} release ON release.${col('id')} = rt.${col('release_id')} AND release.${col('publication_status')} = 'published'
    WHERE rt.${col('track_id')} IN ${IN_LIST} ORDER BY rt.${col('created_at')}`, JSON.stringify([...new Set(trackIds)]));
  for (const row of rows) if (!out.has(row.track_id as string)) out.set(row.track_id as string, row);
  return out;
}

/** music.release_display_date: the original date, else the scheduled day (UTC), else the release date. */
export function releaseDisplayDate(release: Row): string | null {
  if (release.original_release_date != null) return release.original_release_date as string;
  if (release.scheduled_release_at != null) return (release.scheduled_release_at as string).slice(0, 10);
  return (release.release_date as string | null) ?? null;
}

