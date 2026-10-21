/**
 * What the music functions share: who is asking, the row-level security
 * Supabase applies to every table they read (published, or readable by its
 * creator account or an admin), and the pieces their answers are built from
 * (media assets, localizations, artist credits, release dates).
 *
 * Most of the music functions are SECURITY INVOKER in Supabase, so the
 * tables' SELECT policies filter every read, on top of the functions' own
 * "published" conditions. The fragments here are those policies in SQL; a
 * query that uses them starts with ME, which binds the viewer once.
 */
import { compareText } from '../../../../content-api/src/pg.ts';
import { col, t } from '../../../../content-api/src/db/names.ts';
import { asJsonb, jsonbText } from '../../pg.ts';
import type { ApiContext } from '../../rest/context.ts';

export type Row = Record<string, unknown>;
export type Viewer = { userId: string | null; admin: boolean };

const viewers = new WeakMap<ApiContext, Promise<Viewer>>();

/** The signed-in user and whether they're an admin (private.is_admin()), once per request. */
export function viewer(ctx: ApiContext): Promise<Viewer> {
  let found = viewers.get(ctx);
  if (!found) {
    found = (async () => {
      if (!ctx.userId) return { userId: null, admin: false };
      const role = await ctx.db.prepare(`SELECT 1 AS yes FROM ${t('creator', 'user_roles')} WHERE ${col('user_id')} = ? AND ${col('role')} = 'admin' AND ${col('revoked_at')} IS NULL LIMIT 1`).bind(ctx.userId).first();
      return { userId: ctx.userId, admin: Boolean(role) };
    })();
    viewers.set(ctx, found);
  }
  return found;
}

/** Opens a query that uses the fragments below; bind meParams(viewer) first. */
export const ME = `WITH ${col('me')} (${col('uid')}, ${col('admin')}) AS (VALUES (?, ?))`;
export const meParams = (v: Viewer) => [v.userId, v.admin ? 1 : 0];
export const UID = `(SELECT ${col('uid')} FROM ${col('me')})`;
const ADMIN = `(SELECT ${col('admin')} FROM ${col('me')})`;

let aliasCount = 0;
const alias = (base: string) => `${base}_v${(aliasCount = (aliasCount + 1) % 1_000_000)}`;

/** private.can_read_media_owner(account): an admin, or a member of the creator account. */
export function canReadOwner(account: string): string {
  const m = alias('member');
  return `(${account} IS NOT NULL AND (${ADMIN} = 1 OR EXISTS (SELECT 1 FROM ${t('creator', 'creator_account_members')} ${m} WHERE ${m}.${col('creator_account_id')} = ${account} AND ${m}.${col('user_id')} = ${UID})))`;
}

/** The "<table>_select_published_or_owner" policies, for a row alias. */
export const publishedOrOwner = (row: string) => `(${row}.${col('publication_status')} = 'published' OR ${canReadOwner(`${row}.${col('owner_creator_account_id')}`)})`;

function existsVisible(schema: string, table: string, id: string): string {
  const a = alias(table);
  return `EXISTS (SELECT 1 FROM ${t(schema, table)} ${a} WHERE ${a}.${col('id')} = ${id} AND ${publishedOrOwner(a)})`;
}

/** private.music_*_is_visible(id) and private.media_asset_is_visible(id). */
export const visible = {
  artist: (id: string) => existsVisible('music', 'artists', id),
  release: (id: string) => existsVisible('music', 'releases', id),
  track: (id: string) => existsVisible('music', 'tracks', id),
  asset: (id: string) => existsVisible('media', 'media_assets', id),
  playlist: (id: string) => {
    const p = alias('playlist');
    return `EXISTS (SELECT 1 FROM ${t('music', 'playlists')} ${p} WHERE ${p}.${col('id')} = ${id} AND (${p}.${col('visibility')} = 'public' OR ${p}.${col('owner_user_id')} = ${UID}))`;
  },
};

export async function all(ctx: ApiContext, sql: string, ...params: unknown[]): Promise<Row[]> {
  return (await ctx.db.prepare(sql).bind(...params).all<Row>()).results;
}

export async function first(ctx: ApiContext, sql: string, ...params: unknown[]): Promise<Row | null> {
  return ctx.db.prepare(sql).bind(...params).first<Row>();
}

/** A list bound as one parameter: `IN ${inList}` with JSON.stringify(ids). */
export const IN_LIST = '(SELECT value FROM json_each(?))';
const ids = (values: unknown[]) => JSON.stringify([...new Set(values.filter((value) => value != null))]);

// ─── Media assets ─────────────────────────────────────────────────────────

const ASSET_FIELDS: Record<string, string> = {
  id: 'id', provider: 'provider', bucket: 'bucket', path: 'path', mimeType: 'mime_type',
  fileSizeBytes: 'file_size_bytes', checksum: 'checksum', version: 'version',
};
export const ASSET_COLUMNS = Object.values(ASSET_FIELDS).map(col).join(', ');
/** The asset columns of an aliased media_assets row, under their own names. */
export const assetColumns = (alias: string) => Object.values(ASSET_FIELDS).map((name) => `${alias}.${col(name)} AS ${col(name)}`).join(', ');

/** jsonb_build_object('id', a.id, …) over the named fields, or null for no asset. */
export function assetObject(row: Row | undefined | null, fields: string[]): Row | null {
  if (!row) return null;
  return Object.fromEntries(fields.map((field) => [field, row[ASSET_FIELDS[field]] ?? null]));
}

/** Published media assets by id (the functions only ever join published ones). */
export async function loadAssets(ctx: ApiContext, assetIds: unknown[]): Promise<Map<string, Row>> {
  if (!assetIds.some((id) => id != null)) return new Map();
  const rows = await all(ctx, `SELECT ${ASSET_COLUMNS} FROM ${t('media', 'media_assets')} WHERE ${col('id')} IN ${IN_LIST} AND ${col('publication_status')} = 'published'`, ids(assetIds));
  return new Map(rows.map((row) => [row.id as string, row]));
}

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

// ─── Values ───────────────────────────────────────────────────────────────

/** music.release_display_date: the original date, else the scheduled day (UTC), else the release date. */
export function releaseDisplayDate(release: Row): string | null {
  if (release.original_release_date != null) return release.original_release_date as string;
  if (release.scheduled_release_at != null) return (release.scheduled_release_at as string).slice(0, 10);
  return (release.release_date as string | null) ?? null;
}

/** jsonb ->> key: a string as it is, anything else as its jsonb text, missing or JSON null as null. */
export function jsonText(stored: unknown, key: string): string | null {
  if (stored == null) return null;
  const object = JSON.parse(stored as string) as Record<string, unknown>;
  if (!object || typeof object !== 'object' || Array.isArray(object)) return null;
  const value = object[key];
  if (value === undefined || value === null) return null;
  return typeof value === 'string' ? value : jsonbText(value);
}

/** The localized value if there is one, else the row's own (coalesce(localization.x, row.x)). */
export const localized = (localization: Row | undefined, row: Row, field: string) => (localization?.[field] ?? row[field] ?? null);

/** Comparators for Postgres orderings: dates and timestamps compare as their stored strings. */
export const order = {
  descNullsLast: (a: unknown, b: unknown) => (a == null ? (b == null ? 0 : 1) : b == null ? -1 : a < b ? 1 : a > b ? -1 : 0),
  ascNullsLast: (a: unknown, b: unknown) => (a == null ? (b == null ? 0 : 1) : b == null ? -1 : a < b ? -1 : a > b ? 1 : 0),
  text: (a: unknown, b: unknown) => (a == null ? (b == null ? 0 : 1) : b == null ? -1 : compareText(a as string, b as string)),
  number: (a: unknown, b: unknown) => (a == null ? (b == null ? 0 : 1) : b == null ? -1 : (a as number) - (b as number)),
};

export const payload = asJsonb;
