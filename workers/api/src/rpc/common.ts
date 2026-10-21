/**
 * What the ported functions share: who is asking, the row-level security
 * Supabase applies to the tables they read (published, or readable by its
 * creator account or an admin), media assets, and Postgres's orderings.
 *
 * Most of the app's functions are SECURITY INVOKER in Supabase, so the
 * tables' SELECT policies filter every read, on top of the functions' own
 * "published" conditions. The fragments here are those policies in SQL; a
 * query that uses them starts with ME, which binds the viewer once.
 */
import { compareText } from '../../../content-api/src/pg.ts';
import { col, t } from '../../../content-api/src/db/names.ts';
import { asJsonb, jsonbText } from '../pg.ts';
import type { ApiContext } from '../rest/context.ts';

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
export const ADMIN = `(SELECT ${col('admin')} FROM ${col('me')})`;

let aliasCount = 0;
export const alias = (base: string) => `${base}_v${(aliasCount = (aliasCount + 1) % 1_000_000)}`;

/** private.can_read_media_owner(account): an admin, or a member of the creator account. */
export function canReadOwner(account: string): string {
  const m = alias('member');
  return `(${account} IS NOT NULL AND (${ADMIN} = 1 OR EXISTS (SELECT 1 FROM ${t('creator', 'creator_account_members')} ${m} WHERE ${m}.${col('creator_account_id')} = ${account} AND ${m}.${col('user_id')} = ${UID})))`;
}

/** private.can_edit_creator_account(account): an admin, or a member who may edit (not a viewer). */
export function canEditAccount(account: string): string {
  const m = alias('editor');
  return `(${ADMIN} = 1 OR EXISTS (SELECT 1 FROM ${t('creator', 'creator_account_members')} ${m} WHERE ${m}.${col('creator_account_id')} = ${account} AND ${m}.${col('user_id')} = ${UID} AND ${m}.${col('role')} IN ('owner', 'manager', 'editor', 'uploader')))`;
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
  id: 'id', provider: 'provider', bucket: 'bucket', path: 'path', mimeType: 'mime_type', durationMs: 'duration_ms',
  fileSizeBytes: 'file_size_bytes', checksum: 'checksum', version: 'version', width: 'width', height: 'height',
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

// ─── Values ───────────────────────────────────────────────────────────────

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
