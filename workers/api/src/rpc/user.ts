/**
 * The signed-in user's own settings: content preferences (with bookmarks) and
 * push devices. Ports of public.get_my_content_preferences,
 * save_my_content_preferences, register_notification_device and
 * disable_notification_device (schema/pg-user-schema.sql), checked against
 * them by tests/user.parity.test.ts.
 */
import { col, t } from '../../../content-api/src/db/names.ts';
import { asJsonb, jsonbText, now, raise } from '../pg.ts';
import type { ApiContext } from '../rest/context.ts';

type Row = Record<string, unknown>;

const PREFERENCES = t('public', 'user_content_preferences');
const DEVICES = t('public', 'notification_devices');

function requireUser(ctx: ApiContext, message = 'Authentication required', code = '28000'): string {
  if (!ctx.userId) raise(message, code);
  return ctx.userId;
}

export async function getMyContentPreferences(ctx: ApiContext): Promise<unknown> {
  const userId = requireUser(ctx);
  const row = await ctx.db.prepare(`SELECT ${col('preferences')}, ${col('bookmarks')}, ${col('updated_at')} FROM ${PREFERENCES} WHERE ${col('user_id')} = ?`).bind(userId).first<Row>();
  if (!row) return asJsonb({ exists: false, preferences: {}, bookmarks: [], updatedAt: null });
  return asJsonb({ exists: true, preferences: JSON.parse(row.preferences as string), bookmarks: JSON.parse(row.bookmarks as string), updatedAt: row.updated_at });
}

export async function saveMyContentPreferences(ctx: ApiContext, preferences: unknown, bookmarks: unknown): Promise<boolean> {
  const userId = requireUser(ctx);
  const value = preferences ?? {};
  const text = jsonbText(value);
  if (typeof value !== 'object' || Array.isArray(value) || new TextEncoder().encode(text).length > 131072) raise('Invalid content preferences', '22023');
  const list = (bookmarks ?? []) as unknown[];
  if (!Array.isArray(list)) raise('malformed array literal', '22P02');
  if (list.length > 500) raise('Too many bookmarks', '22023');
  // Trimmed, 1 to 512 characters, each kept once at its first position.
  const clean: string[] = [];
  for (const item of list) {
    if (item === null) continue;
    const bookmark = String(item).replace(/^ +| +$/g, '');
    if ([...bookmark].length >= 1 && [...bookmark].length <= 512 && !clean.includes(bookmark)) clean.push(bookmark);
  }
  await ctx.db.prepare(`INSERT INTO ${PREFERENCES} (${col('user_id')}, ${col('preferences')}, ${col('bookmarks')}) VALUES (?, ?, ?)
    ON CONFLICT (${col('user_id')}) DO UPDATE SET ${col('preferences')} = excluded.${col('preferences')}, ${col('bookmarks')} = excluded.${col('bookmarks')}, ${col('updated_at')} = ?`)
    .bind(userId, text, JSON.stringify(clean), now()).run();
  return true;
}

const APP_KEYS = ['chc', 'chc_artists', 'chc_admin'];
const PLATFORMS = ['ios', 'android', 'web', 'windows'];
const PROVIDERS = ['expo', 'web_push', 'wns'];

export async function registerNotificationDevice(ctx: ApiContext, a: {
  p_app_key: string; p_platform: string; p_provider: string; p_push_token: string;
  p_provider_data: unknown; p_device_name: string | null; p_app_version: string | null;
}): Promise<string> {
  const userId = ctx.userId;
  // Coptic Vine's own installs may register signed out; the Artists and Admin apps are for accounts only.
  if (userId == null && a.p_app_key !== 'chc') raise('authentication_required');
  const providerData = a.p_provider_data ?? {};
  const token = a.p_push_token;
  if (!APP_KEYS.includes(a.p_app_key) || !PLATFORMS.includes(a.p_platform) || !PROVIDERS.includes(a.p_provider)
    || token == null || token.replace(/^ +| +$/g, '') === '' || [...token].length > 4096
    || new TextEncoder().encode(jsonbText(providerData)).length > 16384) {
    raise('invalid_notification_device');
  }
  if (a.p_provider === 'web_push') {
    if (a.p_app_key !== 'chc' || !['web', 'windows'].includes(a.p_platform)) raise('invalid_web_push_app');
    const host = token.match(/^https:\/\/([^/:?#]+)/)?.[1]?.toLowerCase();
    const ok = host === 'fcm.googleapis.com' || host === 'push.services.mozilla.com' || host?.endsWith('.push.services.mozilla.com')
      || host === 'push.apple.com' || host?.endsWith('.push.apple.com');
    if (!host || !ok) raise('unsupported_web_push_endpoint');
  }
  if (a.p_provider === 'expo') {
    if (!['ios', 'android'].includes(a.p_platform)) raise('invalid_expo_push_platform');
    if (!/^Expo(nent)?PushToken\[[A-Za-z0-9_-]{8,}\]$/.test(token)) raise('invalid_expo_push_token');
  }
  // An install that changes hands leaves its old queued deliveries behind with its old row.
  await ctx.db.prepare(`DELETE FROM ${DEVICES} WHERE ${col('app_key')} = ? AND ${col('provider')} = ? AND ${col('push_token')} = ? AND ${col('user_id')} IS NOT ?`)
    .bind(a.p_app_key, a.p_provider, token, userId).run();
  const stamp = now();
  const row = await ctx.db.prepare(`INSERT INTO ${DEVICES} (${['id', 'user_id', 'app_key', 'platform', 'provider', 'push_token', 'provider_data', 'device_name', 'app_version', 'enabled', 'last_seen_at', 'updated_at'].map(col).join(', ')})
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    ON CONFLICT (${col('app_key')}, ${col('provider')}, ${col('push_token')}) DO UPDATE SET
      ${col('user_id')} = excluded.${col('user_id')}, ${col('platform')} = excluded.${col('platform')}, ${col('provider_data')} = excluded.${col('provider_data')},
      ${col('device_name')} = excluded.${col('device_name')}, ${col('app_version')} = excluded.${col('app_version')}, ${col('enabled')} = 1,
      ${col('last_seen_at')} = excluded.${col('last_seen_at')}, ${col('updated_at')} = excluded.${col('updated_at')}
    RETURNING ${col('id')}`)
    .bind(crypto.randomUUID(), userId, a.p_app_key, a.p_platform, a.p_provider, token, jsonbText(providerData), a.p_device_name, a.p_app_version, stamp, stamp)
    .first<{ id: string }>();
  return row!.id;
}

export async function disableNotificationDevice(ctx: ApiContext, a: { p_app_key: string; p_provider: string; p_push_token: string }): Promise<boolean> {
  if (!ctx.userId) return false;
  const result = await ctx.db.prepare(`UPDATE ${DEVICES} SET ${col('enabled')} = 0, ${col('updated_at')} = ? WHERE ${col('user_id')} = ? AND ${col('app_key')} = ? AND ${col('provider')} = ? AND ${col('push_token')} = ?`)
    .bind(now(), ctx.userId, a.p_app_key, a.p_provider, a.p_push_token).run();
  return result.meta.changes > 0;
}
