/**
 * The notification dispatcher's queue: ports of
 * public.claim_notification_deliveries, claim_web_push_deliveries,
 * complete_notification_deliveries, claim_notification_receipts and
 * complete_notification_receipts, with complete_notification_delivery and
 * complete_notification_receipt (schema/pg-user-schema.sql). Supabase lets
 * only its service role call them; here that is a request with SERVICE_TOKEN
 * (src/index.ts). Checked by tests/notifications.parity.test.ts.
 */
import { col, t } from '../../../../content-api/src/db/names.ts';
import { transaction, type Tx } from '../../db/transaction.ts';
import { jsonbText, raise } from '../../pg.ts';
import type { ApiContext } from '../../rest/context.ts';
import { addHours, arrayElements, arrowText, jsonbType, toUuid } from '../creator/core.ts';
import type { Row } from '../creator/shared.ts';

const DELIVERIES = t('private', 'notification_deliveries');
const DEVICES = t('public', 'notification_devices');
const seconds = (at: string, n: number) => addHours(at, n / 3600);
const limit = (value: number | null, most: number) => Math.max(1, Math.min(value ?? most, most));

/** text::integer, with Postgres's error. */
function toInteger(text: string | null): number | null {
  if (text == null) return null;
  if (!/^\s*[+-]?\d+\s*$/.test(text)) raise(`invalid input syntax for type integer: "${text}"`, '22P02');
  const value = Number(text);
  if (value > 2147483647 || value < -2147483648) raise(`value "${text}" is out of range for type integer`, '22003');
  return value;
}

/**
 * Due deliveries for one provider (queued and due, or claimed ten minutes ago
 * without an answer), oldest first: claimed, and returned with what to send
 * for those whose device is still enabled.
 */
async function claimDeliveries(tx: Tx, provider: 'expo' | 'web_push', count: number): Promise<Row[]> {
  const claimed = (await tx.run(`UPDATE ${DELIVERIES} SET ${col('status')} = 'processing', ${col('claimed_at')} = ?, ${col('attempt_count')} = ${col('attempt_count')} + 1, ${col('updated_at')} = ?
    WHERE ${col('id')} IN (SELECT d.${col('id')} FROM ${DELIVERIES} d WHERE d.${col('provider')} = ? AND d.${col('attempt_count')} < d.${col('max_attempts')}
      AND ((d.${col('status')} = 'queued' AND d.${col('available_at')} <= ?) OR (d.${col('status')} = 'processing' AND d.${col('claimed_at')} < ?))
      ORDER BY d.${col('available_at')}, d.${col('created_at')}, d.rowid LIMIT ?)
    RETURNING ${col('id')}`, tx.at, tx.at, provider, tx.at, seconds(tx.at, -600), count)).results as Row[];
  if (!claimed.length) return [];
  return tx.all(`SELECT d.${col('id')} AS delivery_id, d.${col('notification_id')} AS notification_id, d.${col('device_id')} AS device_id, dev.${col('push_token')} AS push_token,
      dev.${col('provider_data')} AS provider_data, n.${col('id')} AS n_id, b.${col('id')} AS b_id, coalesce(n.${col('title')}, b.${col('title')}) AS title,
      coalesce(n.${col('body')}, b.${col('body')}) AS body, n.${col('image_url')} AS image_url, coalesce(n.${col('deep_link')}, b.${col('deep_link')}) AS deep_link,
      coalesce(n.${col('payload')}, b.${col('payload')}, '{}') AS payload
    FROM ${DELIVERIES} d JOIN ${DEVICES} dev ON dev.${col('id')} = d.${col('device_id')}
    LEFT JOIN ${t('public', 'notifications')} n ON n.${col('id')} = d.${col('notification_id')}
    LEFT JOIN ${t('public', 'notification_broadcasts')} b ON b.${col('id')} = d.${col('broadcast_id')}
    WHERE d.${col('id')} IN (SELECT value FROM json_each(?)) AND dev.${col('enabled')} = 1 AND (n.${col('id')} IS NOT NULL OR b.${col('id')} IS NOT NULL)
    ORDER BY d.${col('id')}`, JSON.stringify(claimed.map((row) => row.id)));
}

/** jsonb || jsonb: two objects merged (the right's keys win); anything else, the two as arrays concatenated. */
function concat(left: unknown, right: Row): unknown {
  if (jsonbType(left) === 'object') return JSON.parse(jsonbText({ ...(left as Row), ...right }));
  return [...(Array.isArray(left) ? left : [left]), right];
}

/** The message's payload, with what it is and where it opens (the nulls left out). */
const payloadFor = (row: Row) => concat(JSON.parse(row.payload as string),
  Object.fromEntries(Object.entries({ notification_id: row.n_id, broadcast_id: row.b_id, deep_link: row.deep_link }).filter(([, v]) => v != null)));

const message = (row: Row) => ({ title: row.title, body: row.body, image_url: row.image_url, deep_link: row.deep_link, payload: payloadFor(row) });

export async function claimNotificationDeliveries(ctx: ApiContext, count: number | null): Promise<unknown> {
  return transaction(ctx, async (tx) => (await claimDeliveries(tx, 'expo', limit(count, 100))).map((row) => ({
    delivery_id: row.delivery_id, notification_id: row.notification_id, device_id: row.device_id, push_token: row.push_token, ...message(row),
  })));
}

export async function claimWebPushDeliveries(ctx: ApiContext, count: number | null): Promise<unknown> {
  return transaction(ctx, async (tx) => (await claimDeliveries(tx, 'web_push', limit(count, 100))).map((row) => ({
    delivery_id: row.delivery_id, notification_id: row.notification_id, device_id: row.device_id,
    subscription: concat(JSON.parse(row.provider_data as string), { endpoint: row.push_token }), ...message(row),
  })));
}

/** Expo tickets accepted a quarter of an hour ago, not checked in the last five minutes: claimed for a receipt check. */
export async function claimNotificationReceipts(ctx: ApiContext, count: number | null): Promise<unknown> {
  return transaction(ctx, async (tx) => (await tx.run(`UPDATE ${DELIVERIES} SET ${col('receipt_checked_at')} = ?, ${col('updated_at')} = ?
    WHERE ${col('id')} IN (SELECT d.${col('id')} FROM ${DELIVERIES} d WHERE d.${col('provider')} = 'expo' AND d.${col('status')} = 'accepted' AND d.${col('provider_ticket_id')} IS NOT NULL
      AND d.${col('accepted_at')} <= ? AND (d.${col('receipt_checked_at')} IS NULL OR d.${col('receipt_checked_at')} <= ?) ORDER BY d.${col('accepted_at')}, d.rowid LIMIT ?)
    RETURNING ${col('id')} AS delivery_id, ${col('provider_ticket_id')} AS provider_ticket_id`,
  tx.at, tx.at, seconds(tx.at, -900), seconds(tx.at, -300), limit(count, 1000))).results);
}

/** The results' list, or Postgres's refusal. */
function results(value: unknown): unknown[] {
  if (jsonbType(value ?? []) !== 'array') raise('results_must_be_array');
  return arrayElements(value ?? []);
}

/** A delivery and, when the provider says the device is gone, the device, settled by the provider's answer. */
async function settle(tx: Tx, deliveryId: string | null, status: string, set: string, params: unknown[], disable: boolean): Promise<void> {
  const delivery = await tx.first(`SELECT ${col('device_id')} FROM ${DELIVERIES} WHERE ${col('id')} = ?`, deliveryId);
  if (!delivery) return;
  await tx.run(`UPDATE ${DELIVERIES} SET ${col('status')} = ${status}, ${set}, ${col('updated_at')} = ? WHERE ${col('id')} = ?`, ...params, tx.at, deliveryId);
  if (disable) await tx.run(`UPDATE ${DEVICES} SET ${col('enabled')} = 0, ${col('updated_at')} = ? WHERE ${col('id')} = ?`, tx.at, delivery.device_id);
}

export async function completeNotificationDeliveries(ctx: ApiContext, answers: unknown): Promise<unknown> {
  return transaction(ctx, async (tx) => {
    const items = results(answers);
    for (const item of items) {
      const deliveryId = toUuid(arrowText(item, 'delivery_id'));
      const result = arrowText(item, 'result');
      const ticket = arrowText(item, 'ticket_id') || null;
      const error = arrowText(item, 'error') || null;
      const retryAfter = toInteger(arrowText(item, 'retry_after_seconds')) ?? 60;
      // public.complete_notification_delivery
      if (result === 'accepted') await settle(tx, deliveryId, `'accepted'`, `${col('provider_ticket_id')} = ?, ${col('accepted_at')} = ?, ${col('last_error')} = NULL`, [ticket, tx.at], false);
      else if (result === 'delivered') await settle(tx, deliveryId, `'delivered'`, `${col('delivered_at')} = ?, ${col('last_error')} = NULL`, [tx.at], false);
      else if (result === 'retry') {
        await settle(tx, deliveryId, `CASE WHEN ${col('attempt_count')} >= ${col('max_attempts')} THEN 'failed' ELSE 'queued' END`,
          `${col('available_at')} = ?, ${col('claimed_at')} = NULL, ${col('last_error')} = ?`, [seconds(tx.at, Math.max(10, Math.min(retryAfter, 3600))), error], false);
      } else if (result === 'disabled') await settle(tx, deliveryId, `'disabled'`, `${col('last_error')} = ?`, [error], true);
      else await settle(tx, deliveryId, `'failed'`, `${col('last_error')} = ?`, [error], false);
    }
    return items.length;
  });
}

export async function completeNotificationReceipts(ctx: ApiContext, answers: unknown): Promise<unknown> {
  return transaction(ctx, async (tx) => {
    const items = results(answers);
    for (const item of items) {
      const deliveryId = toUuid(arrowText(item, 'delivery_id'));
      const result = arrowText(item, 'result');
      const error = arrowText(item, 'error') || null;
      // public.complete_notification_receipt
      if (result === 'delivered') await settle(tx, deliveryId, `'delivered'`, `${col('delivered_at')} = ?, ${col('last_error')} = NULL`, [tx.at], false);
      else if (result === 'disabled') await settle(tx, deliveryId, `'disabled'`, `${col('last_error')} = ?`, [error], true);
      else await settle(tx, deliveryId, `'failed'`, `${col('last_error')} = ?`, [error], false);
    }
    return items.length;
  });
}
