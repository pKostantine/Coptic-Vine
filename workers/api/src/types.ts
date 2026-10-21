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

/** An R2 object's description (head), and with its body (get). */
export interface R2Object {
  key: string;
  size: number;
  etag: string;
  httpEtag: string;
  uploaded: Date;
  httpMetadata?: { contentType?: string; cacheControl?: string };
  customMetadata?: Record<string, string>;
}
export interface R2ObjectBody extends R2Object {
  body: ReadableStream;
  arrayBuffer(): Promise<ArrayBuffer>;
}

/** The R2 bucket binding, the part used here. */
export interface R2Bucket {
  head(key: string): Promise<R2Object | null>;
  get(key: string): Promise<R2ObjectBody | null>;
  put(key: string, value: ArrayBuffer | ArrayBufferView<ArrayBuffer> | ReadableStream | string, options?: { httpMetadata?: { contentType?: string; cacheControl?: string }; customMetadata?: Record<string, string> }): Promise<R2Object>;
  delete(keys: string | string[]): Promise<void>;
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
  /**
   * Secret: the bearer token the other Workers (the notification dispatcher)
   * send to call functions as Supabase's service role. Unset, nobody can.
   */
  SERVICE_TOKEN?: string;
  /**
   * The user's own uploads that Supabase Storage held (the profile-avatars
   * and playlist-covers buckets), keyed "<bucket>/<path>" (src/storage.ts).
   */
  USER_MEDIA?: R2Bucket;
}
