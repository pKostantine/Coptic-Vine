/** The few Workers runtime types this Worker uses (no @cloudflare/workers-types dependency, as in workers/content-packages). */

export interface D1Result<T = Record<string, unknown>> {
  results: T[];
  success: boolean;
  meta: Record<string, unknown>;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  raw<T = unknown[]>(): Promise<T[]>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

export interface Env {
  CONTENT_DB: D1Database;
}

/** The request context, with the entrypoints of this Worker callable as ctx.exports.<Name>. */
export interface Context {
  exports: { Content: { fetch(request: Request): Promise<Response> } };
}

/**
 * Who a request is answered for. churchId is accepted from the start so that
 * Phase 3's church layers (docs/coptic-vine-d1-plan.md, section 6) slot in
 * without changing any endpoint; in Phase 1 every church sees the master text.
 */
export interface ContentContext {
  db: D1Database;
  churchId: string | null;
}

export type Row = Record<string, unknown>;
