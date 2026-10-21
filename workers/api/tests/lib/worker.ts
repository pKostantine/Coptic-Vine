/**
 * The Worker side of the parity tests: cv-api's fetch handler on SQLite with
 * the real migrations (0006 sign-in, 0007 user data, 0008 rate limits), users
 * created with the same ids as in the oracle, signed in through Better Auth
 * for real, and requests sent as supabase-js sends them.
 */
import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';
import { handle } from '../../src/index.ts';
import type { Env } from '../../src/types.ts';
import { d1, migration } from './d1.ts';

export const BASE = 'http://localhost:8790';
const ORIGIN = 'http://localhost:8081';
const PASSWORD = 'parity test password';
const HASH = bcrypt.hashSync(PASSWORD, 4);
const STAMP = '2026-10-01T00:00:00+00:00';

export type Answer = { status: number; data: unknown; error: { code: string; message: string } | null };

export class WorkerSide {
  readonly db: DatabaseSync;
  readonly env: Env;
  private tokens = new Map<string, string>();
  private address = 0;

  constructor() {
    this.db = new DatabaseSync(':memory:');
    this.db.exec('PRAGMA foreign_keys = ON');
    this.db.exec('CREATE TABLE "public.hymn_titles" ("hymn_key" TEXT PRIMARY KEY) STRICT');
    for (const name of ['0006_auth.sql', '0007_user_schema.sql', '0008_auth_rate_limits.sql', '0009_user_triggers.sql']) this.db.exec(migration(name));
    this.env = {
      DB: d1(this.db), BETTER_AUTH_URL: BASE, BETTER_AUTH_SECRET: 'a-parity-secret-that-is-long-enough-0123456789',
      EMAIL_FROM: 'no-reply@copticvine.ca', TRUSTED_ORIGINS: `${ORIGIN},copticvine://`, EMAIL_MODE: 'outbox',
    };
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    this.address += 1;
    return { origin: ORIGIN, 'cf-connecting-ip': `198.18.${Math.floor(this.address / 250) % 250}.${this.address % 250}`, ...extra };
  }

  /** A signed-up, confirmed user with this id, signed in. */
  async addUser(id: string, email: string, name = 'Parity'): Promise<void> {
    this.db.prepare('INSERT INTO "auth.users" ("id", "name", "email", "email_verified", "created_at", "updated_at") VALUES (?, ?, ?, 1, ?, ?)').run(id, name, email, STAMP, STAMP);
    this.db.prepare('INSERT INTO "auth.accounts" ("id", "user_id", "account_id", "provider_id", "password", "created_at", "updated_at") VALUES (?, ?, ?, ?, ?, ?, ?)').run(`acc-${id}`, id, id, 'credential', HASH, STAMP, STAMP);
    const response = await handle(new Request(`${BASE}/auth/sign-in/email`, {
      method: 'POST', headers: this.headers({ 'content-type': 'application/json' }), body: JSON.stringify({ email, password: PASSWORD }),
    }), this.env);
    const token = response.headers.get('set-auth-token');
    if (response.status !== 200 || !token) throw new Error(`Sign-in for ${email} failed: ${response.status} ${await response.text()}`);
    this.tokens.set(id, token);
  }

  /** A request as supabase-js makes it, as the user (or signed out with null). */
  async request(user: string | null, method: string, path: string, init: { body?: unknown; headers?: Record<string, string> } = {}): Promise<Answer> {
    const headers = this.headers({ ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}), ...init.headers });
    if (user) headers.authorization = `Bearer ${this.tokens.get(user)}`;
    const response = await handle(new Request(`${BASE}${path}`, { method, headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) }), this.env);
    const text = await response.text();
    const json = text ? JSON.parse(text) : null;
    return response.ok ? { status: response.status, data: json, error: null } : { status: response.status, data: null, error: json };
  }

  rpc(user: string | null, fn: string, args: Record<string, unknown> = {}): Promise<Answer> {
    return this.request(user, 'POST', `/rest/v1/rpc/${fn}`, { body: args, headers: { 'content-profile': 'public' } });
  }

  rows<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T[] {
    return this.db.prepare(sql).all(...(params as never[])).map((row) => ({ ...(row as object) })) as T[];
  }
}

/**
 * Two answers compared as JSON values: object keys in any order; ids and
 * server timestamps the two databases generate on their own replaced by
 * placeholders in order of first appearance, so the structure and every other
 * value are compared exactly.
 */
export function normalize(value: unknown, keep: Set<string> = new Set()): unknown {
  const ids = new Map<string, string>();
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((key) => [key, walk((v as Record<string, unknown>)[key])]));
    if (typeof v === 'string' && !keep.has(v)) {
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v)) {
        if (!ids.has(v)) ids.set(v, `<id ${ids.size + 1}>`);
        return ids.get(v);
      }
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(\+00:00|Z)$/.test(v)) return '<timestamp>';
    }
    return v;
  };
  return walk(value);
}
