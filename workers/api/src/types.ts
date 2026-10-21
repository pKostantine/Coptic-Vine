/** The few Workers runtime types this Worker uses (no @cloudflare/workers-types dependency, as in workers/content-api). */

export interface D1Meta {
  changes: number;
  last_row_id?: number;
  [key: string]: unknown;
}

export interface D1Result<T = Record<string, unknown>> {
  results: T[];
  success: boolean;
  meta: D1Meta;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<D1Result>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

/** Cloudflare Email Service's send binding (wrangler.jsonc "send_email"). */
export interface SendEmail {
  send(message: {
    from: string | { email: string; name: string };
    to: string | string[];
    subject: string;
    html?: string;
    text?: string;
    replyTo?: string;
  }): Promise<{ messageId: string }>;
}

export interface Env {
  DB: D1Database;
  /** Absent in tests and local runs without it; emails then go to the outbox (src/auth/email.ts). */
  EMAIL?: SendEmail;
  /** This Worker's public address, e.g. https://api.copticvine.ca. */
  BETTER_AUTH_URL: string;
  /** Secret: signs sessions and tokens. */
  BETTER_AUTH_SECRET: string;
  /** Google OAuth: the web client id (comma-separated list to also accept native clients' ID tokens). */
  GOOGLE_CLIENT_ID?: string;
  /** Secret: the web client's secret. Google sign-in is off until it is set. */
  GOOGLE_CLIENT_SECRET?: string;
  /** The sender's address, e.g. no-reply@copticvine.ca (sent as "Coptic Vine"). */
  EMAIL_FROM: string;
  /** Origins and app schemes allowed to call sign-in, comma-separated. */
  TRUSTED_ORIGINS: string;
  /** "outbox": keep emails in memory instead of sending them (local development and tests only). */
  EMAIL_MODE?: string;
  /** The media processor (cv-media-processor), woken when a job is queued; unset in tests. */
  MEDIA_PROCESSOR_URL?: string;
}
