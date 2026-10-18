import { getOfflineDatabase } from '@/services/offlineDatabase';
import type {
  BookDownloadProgress,
  BookDownloadStatus,
  ContentPackagePayload,
  DownloadableBookKey,
  ManagedContentResource,
} from '@/types/bookDownloads';

function nowIso(): string { return new Date().toISOString(); }

export function canonicalRpcArgs(args: Record<string, unknown> | undefined): string {
  const sort = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sort);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, sort(child)]));
    }
    return value;
  };
  return JSON.stringify(sort(args || {}));
}

export async function seedBookRows(books: { key: DownloadableBookKey; title: string }[]): Promise<void> {
  const db = await getOfflineDatabase();
  const now = nowIso();
  for (const book of books) {
    await db.runAsync(
      `INSERT INTO content_books (book_key, title, status, progress, bytes_written, total_bytes, error, installed_at, updated_at)
       VALUES (?, ?, 'not_downloaded', 0, 0, NULL, NULL, NULL, ?)
       ON CONFLICT(book_key) DO UPDATE SET title = excluded.title`,
      book.key, book.title, now,
    );
  }
  await db.runAsync(
    `INSERT INTO content_resources (resource_id, active_version, state, system_owned, bytes, error, updated_at)
     VALUES ('calendar', NULL, 'not_downloaded', 1, 0, NULL, ?)
     ON CONFLICT(resource_id) DO UPDATE SET system_owned = 1`,
    now,
  );
}

export async function setBookState(
  bookKey: DownloadableBookKey,
  status: BookDownloadStatus,
  patch: { progress?: number; bytesWritten?: number; totalBytes?: number | null; error?: string | null } = {},
): Promise<void> {
  const db = await getOfflineDatabase();
  const current = await db.getFirstAsync<{
    progress: number; bytes_written: number; total_bytes: number | null; error: string | null;
  }>('SELECT progress, bytes_written, total_bytes, error FROM content_books WHERE book_key = ?', bookKey);
  if (!current) return;
  await db.runAsync(
    `UPDATE content_books SET status = ?, progress = ?, bytes_written = ?, total_bytes = ?, error = ?, updated_at = ?
      WHERE book_key = ?`,
    status,
    patch.progress ?? current.progress,
    patch.bytesWritten ?? current.bytes_written,
    patch.totalBytes !== undefined ? patch.totalBytes : current.total_bytes,
    patch.error !== undefined ? patch.error : current.error,
    nowIso(),
    bookKey,
  );
}

export async function setResourceState(
  resourceId: string,
  status: BookDownloadStatus,
  patch: { bytes?: number; error?: string | null; systemOwned?: boolean } = {},
): Promise<void> {
  const db = await getOfflineDatabase();
  const current = await db.getFirstAsync<{ bytes: number; error: string | null; system_owned: number }>(
    'SELECT bytes, error, system_owned FROM content_resources WHERE resource_id = ?', resourceId,
  );
  await db.runAsync(
    `INSERT INTO content_resources (resource_id, active_version, state, system_owned, bytes, error, updated_at)
     VALUES (?, NULL, ?, ?, ?, ?, ?)
     ON CONFLICT(resource_id) DO UPDATE SET
       state = excluded.state, system_owned = excluded.system_owned,
       bytes = excluded.bytes, error = excluded.error, updated_at = excluded.updated_at`,
    resourceId, status, (patch.systemOwned ?? Boolean(current?.system_owned)) ? 1 : 0,
    patch.bytes ?? current?.bytes ?? 0,
    patch.error !== undefined ? patch.error : current?.error ?? null,
    nowIso(),
  );
  // Only installed and update_available resources are read from.
  contentChanged();
}

export async function setPendingBookResources(bookKey: DownloadableBookKey, resourceIds: string[]): Promise<void> {
  const db = await getOfflineDatabase();
  const now = nowIso();
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('DELETE FROM content_book_pending_resources WHERE book_key = ?', bookKey);
    for (const resourceId of resourceIds) {
      await txn.runAsync(
        `INSERT INTO content_resources (resource_id, active_version, state, system_owned, bytes, error, updated_at)
         VALUES (?, NULL, 'not_downloaded', ?, 0, NULL, ?)
         ON CONFLICT(resource_id) DO NOTHING`,
        resourceId, resourceId === 'calendar' ? 1 : 0, now,
      );
      await txn.runAsync(
        'INSERT OR IGNORE INTO content_book_pending_resources (book_key, resource_id) VALUES (?, ?)',
        bookKey, resourceId,
      );
    }
  });
}

export async function getActiveResourceVersion(resourceId: string): Promise<string | null> {
  const db = await getOfflineDatabase();
  const row = await db.getFirstAsync<{ active_version: string | null }>(
    `SELECT active_version FROM content_resources WHERE resource_id = ? AND state IN ('installed', 'update_available')`,
    resourceId,
  );
  return row?.active_version ?? null;
}

// Every query of an installed table used to fetch the whole table a row at a
// time and parse each row again: the calendar's 29,585 date conversions some
// seventeen times over just to open the season selector. A table is now read
// once, as one JSON array per chunk that SQLite assembles (a handful of
// strings cross into JavaScript, not a row object per row), and is kept,
// parsed, for the session. Whatever changes which content is active calls
// contentChanged(), and what was kept is read again.

type LocalTable = Record<string, unknown>[] | null;

/**
 * How much may be kept, in characters of JSON (roughly what the parsed rows
 * weigh): no single table over the first, and all of them within the second,
 * the least recently used let go first. The calendar's date conversions are
 * about 11 million; the Bible's verses are several times that, so they are
 * read afresh each time, as before, rather than held.
 */
const MAX_KEPT_TABLE_CHARS = 16_000_000;
const KEPT_TABLES_BUDGET_CHARS = 24_000_000;

/** Tables read, by `schema.table`, least recently used first. `chars` stays 0 until the load arrives. */
const keptTables = new Map<string, { rows: Promise<LocalTable>; chars: number }>();
let keptTableChars = 0;
/** Whether each schema has installed rows, asked on every RPC the package doesn't hold. */
const knownSchemas = new Map<string, Promise<boolean>>();

/**
 * Forget every table and schema answer kept so far. Called after anything
 * that changes which resource versions are active, or deletes their rows.
 * A load still running when this is called finishes for whoever asked for
 * it, but it isn't kept.
 */
function contentChanged(): void {
  keptTables.clear();
  keptTableChars = 0;
  knownSchemas.clear();
}

async function lookUpLocalSchema(schema: string): Promise<boolean> {
  const db = await getOfflineDatabase();
  const row = await db.getFirstAsync<{ found: number }>(
    `SELECT 1 AS found FROM content_rows cr
       JOIN content_resources r ON r.resource_id = cr.resource_id AND r.active_version = cr.version
      WHERE cr.schema_name = ? AND r.state IN ('installed', 'update_available')
      LIMIT 1`,
    schema,
  );
  return row != null;
}

export function hasLocalSchema(schema: string): Promise<boolean> {
  const known = knownSchemas.get(schema);
  if (known) return known;
  const lookup = lookUpLocalSchema(schema);
  knownSchemas.set(schema, lookup);
  // A lookup that failed is asked again next time rather than remembered.
  lookup.catch(() => { if (knownSchemas.get(schema) === lookup) knownSchemas.delete(schema); });
  return lookup;
}

async function loadLocalTable(schema: string, table: string): Promise<{ rows: LocalTable; chars: number }> {
  const db = await getOfflineDatabase();
  // One array per chunk rather than one for the whole table keeps each string
  // SQLite builds to a chunk's size (about 2 MB), however large the table.
  const chunks = await db.getAllAsync<{ rows_json: string }>(
    `SELECT '[' || group_concat(cr.row_json, ',' ORDER BY cr.row_order) || ']' AS rows_json
       FROM content_rows cr
       JOIN content_resources r ON r.resource_id = cr.resource_id AND r.active_version = cr.version
      WHERE cr.schema_name = ? AND cr.table_name = ? AND r.state IN ('installed', 'update_available')
      GROUP BY cr.chunk_id
      ORDER BY cr.chunk_id`,
    schema, table,
  );
  if (!chunks.length) return { rows: (await hasLocalSchema(schema)) ? [] : null, chars: 0 };
  try {
    let chars = 0;
    const parsed = chunks.map((chunk) => {
      chars += chunk.rows_json.length;
      return JSON.parse(chunk.rows_json) as Record<string, unknown>[];
    });
    return { rows: parsed.length === 1 ? parsed[0] : ([] as Record<string, unknown>[]).concat(...parsed), chars };
  } catch {
    // One row that doesn't parse spoils its whole chunk: read the table row by
    // row instead, leaving out only the rows that don't parse.
    const rows = await db.getAllAsync<{ row_json: string }>(
      `SELECT cr.row_json FROM content_rows cr
         JOIN content_resources r ON r.resource_id = cr.resource_id AND r.active_version = cr.version
        WHERE cr.schema_name = ? AND cr.table_name = ? AND r.state IN ('installed', 'update_available')
        ORDER BY cr.chunk_id, cr.row_order`,
      schema, table,
    );
    return {
      rows: rows.flatMap((row) => {
        try { return [JSON.parse(row.row_json) as Record<string, unknown>]; }
        catch { return []; }
      }),
      chars: rows.reduce((sum, row) => sum + row.row_json.length, 0),
    };
  }
}

/**
 * Every installed row of a table, in package order, or null when its schema
 * isn't installed. The array and its rows are shared by every caller (that
 * is the point of keeping them), so a caller copies what it hands on and
 * never changes them.
 */
export function readLocalTable(schema: string, table: string): Promise<LocalTable> {
  const key = `${schema}.${table}`;
  const kept = keptTables.get(key);
  if (kept) {
    keptTables.delete(key);
    keptTables.set(key, kept);
    return kept.rows;
  }
  // Callers who ask while it loads share the one load.
  const loading = loadLocalTable(schema, table);
  const entry = { rows: loading.then((loaded) => loaded.rows), chars: 0 };
  keptTables.set(key, entry);
  loading.then((loaded) => {
    if (keptTables.get(key) !== entry) return;
    if (loaded.chars > MAX_KEPT_TABLE_CHARS) {
      keptTables.delete(key);
      return;
    }
    entry.chars = loaded.chars;
    keptTableChars += loaded.chars;
    for (const [otherKey, other] of keptTables) {
      if (keptTableChars <= KEPT_TABLES_BUDGET_CHARS) break;
      if (other === entry || !other.chars) continue;
      keptTables.delete(otherKey);
      keptTableChars -= other.chars;
    }
  }, () => {
    if (keptTables.get(key) === entry) keptTables.delete(key);
  });
  return entry.rows;
}

export async function readLocalRpc(
  schema: string,
  functionName: string,
  args: Record<string, unknown> = {},
): Promise<{ found: boolean; data: unknown }> {
  const db = await getOfflineDatabase();
  const row = await db.getFirstAsync<{ result_json: string }>(
    `SELECT rr.result_json FROM content_rpc_results rr
       JOIN content_resources r ON r.resource_id = rr.resource_id AND r.active_version = rr.version
      WHERE rr.schema_name = ? AND rr.function_name = ? AND rr.args_key = ?
        AND r.state IN ('installed', 'update_available')
      LIMIT 1`,
    schema, functionName, canonicalRpcArgs(args),
  );
  if (!row) return { found: false, data: null };
  try { return { found: true, data: JSON.parse(row.result_json) }; }
  catch { return { found: false, data: null }; }
}

export async function prepareResourceVersion(resourceId: string, version: string): Promise<void> {
  const db = await getOfflineDatabase();
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('DELETE FROM content_rows WHERE resource_id = ? AND version = ?', resourceId, version);
    await txn.runAsync('DELETE FROM content_rpc_results WHERE resource_id = ? AND version = ?', resourceId, version);
    await txn.runAsync('DELETE FROM content_resource_chunks WHERE resource_id = ? AND version = ?', resourceId, version);
  });
  contentChanged();
}

export async function importContentChunk(payload: ContentPackagePayload, packageKey: string, expectedRowCount?: number): Promise<number> {
  const db = await getOfflineDatabase();
  let rowCount = 0;
  await db.withExclusiveTransactionAsync(async (txn) => {
    const existing = await txn.getFirstAsync<{ imported: number }>(
      'SELECT imported FROM content_resource_chunks WHERE resource_id = ? AND version = ? AND chunk_id = ?',
      payload.resourceId, payload.version, payload.chunkId,
    );
    if (existing?.imported) return;

    // Rows go in a hundred to a statement rather than one per round trip to
    // the database (a 2 MB chunk holds thousands). Seven values a row keeps a
    // statement at 700 bound parameters, under even SQLite's oldest limit of
    // 999. Every full batch shares one prepared statement; a table's last,
    // shorter batch gets one of its own size.
    const rowsPerInsert = 100;
    const statements = new Map<number, Awaited<ReturnType<typeof txn.prepareAsync>>>();
    try {
      for (const table of payload.tables) {
        for (let start = 0; start < table.rows.length; start += rowsPerInsert) {
          const batch = table.rows.slice(start, start + rowsPerInsert);
          let statement = statements.get(batch.length);
          if (!statement) {
            statement = await txn.prepareAsync(
              `INSERT OR REPLACE INTO content_rows
                (resource_id, version, schema_name, table_name, chunk_id, row_order, row_json)
               VALUES ${batch.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ')}`,
            );
            statements.set(batch.length, statement);
          }
          await statement.executeAsync(batch.flatMap((row, offset) => [
            payload.resourceId, payload.version, table.schema, table.table,
            payload.chunkId, start + offset, JSON.stringify(row),
          ]));
          rowCount += batch.length;
        }
      }
    } finally { for (const statement of statements.values()) await statement.finalizeAsync(); }

    for (const rpc of payload.rpcResults || []) {
      await txn.runAsync(
        `INSERT OR REPLACE INTO content_rpc_results
          (resource_id, version, schema_name, function_name, args_key, result_json)
         VALUES (?, ?, ?, ?, ?, ?)`,
        payload.resourceId, payload.version, rpc.schema, rpc.function,
        canonicalRpcArgs(rpc.args), JSON.stringify(rpc.data),
      );
      rowCount += 1;
    }
    if (expectedRowCount != null && rowCount !== expectedRowCount) {
      throw new Error(`Package row count is ${rowCount}; expected ${expectedRowCount}.`);
    }
    await txn.runAsync(
      `INSERT OR REPLACE INTO content_resource_chunks
        (resource_id, version, chunk_id, package_key, imported, row_count)
       VALUES (?, ?, ?, ?, 1, ?)`,
      payload.resourceId, payload.version, payload.chunkId, packageKey, rowCount,
    );
  });
  return rowCount;
}

export async function isContentChunkImported(resourceId: string, version: string, chunkId: string): Promise<boolean> {
  const db = await getOfflineDatabase();
  const row = await db.getFirstAsync<{ imported: number }>(
    `SELECT imported FROM content_resource_chunks
      WHERE resource_id = ? AND version = ? AND chunk_id = ?`,
    resourceId, version, chunkId,
  );
  return Boolean(row?.imported);
}

export async function getResourcePackageKeys(resourceId: string, exceptVersion?: string): Promise<string[]> {
  const db = await getOfflineDatabase();
  const rows = exceptVersion
    ? await db.getAllAsync<{ package_key: string }>(
      'SELECT DISTINCT package_key FROM content_resource_chunks WHERE resource_id = ? AND version <> ?',
      resourceId, exceptVersion,
    )
    : await db.getAllAsync<{ package_key: string }>(
      'SELECT DISTINCT package_key FROM content_resource_chunks WHERE resource_id = ?', resourceId,
    );
  return rows.map((row) => row.package_key);
}

export async function activateBookResources(
  bookKey: DownloadableBookKey,
  resources: { id: string; version: string; bytes: number }[],
): Promise<string[]> {
  const db = await getOfflineDatabase();
  const now = nowIso();
  const orphaned: string[] = [];
  await db.withExclusiveTransactionAsync(async (txn) => {
    const previous = await txn.getAllAsync<{ resource_id: string }>(
      'SELECT resource_id FROM content_book_resources WHERE book_key = ?', bookKey,
    );
    await txn.runAsync('DELETE FROM content_book_resources WHERE book_key = ?', bookKey);
    for (const resource of resources) {
      await txn.runAsync(
        `INSERT INTO content_resources (resource_id, active_version, state, system_owned, bytes, error, updated_at)
         VALUES (?, ?, 'installed', 0, ?, NULL, ?)
         ON CONFLICT(resource_id) DO UPDATE SET active_version = excluded.active_version,
           state = 'installed', bytes = excluded.bytes, error = NULL, updated_at = excluded.updated_at`,
        resource.id, resource.version, resource.bytes, now,
      );
      await txn.runAsync(
        'INSERT OR IGNORE INTO content_book_resources (book_key, resource_id) VALUES (?, ?)',
        bookKey, resource.id,
      );
    }
    await txn.runAsync(
      `UPDATE content_books SET status = 'installed', progress = 1, error = NULL,
         installed_at = COALESCE(installed_at, ?), updated_at = ? WHERE book_key = ?`,
      now, now, bookKey,
    );
    await txn.runAsync('DELETE FROM content_book_pending_resources WHERE book_key = ?', bookKey);
    const activeIds = new Set(resources.map((resource) => resource.id));
    for (const candidate of previous) {
      if (activeIds.has(candidate.resource_id)) continue;
      const resource = await txn.getFirstAsync<{ system_owned: number }>(
        'SELECT system_owned FROM content_resources WHERE resource_id = ?', candidate.resource_id,
      );
      const refs = await txn.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) AS count FROM (
           SELECT book_key FROM content_book_resources WHERE resource_id = ?
           UNION SELECT book_key FROM content_book_pending_resources WHERE resource_id = ?
         ) AS resource_refs`,
        candidate.resource_id, candidate.resource_id,
      );
      if (!resource?.system_owned && (refs?.count ?? 0) === 0) {
        await txn.runAsync('DELETE FROM content_rows WHERE resource_id = ?', candidate.resource_id);
        await txn.runAsync('DELETE FROM content_rpc_results WHERE resource_id = ?', candidate.resource_id);
        await txn.runAsync('DELETE FROM content_resource_chunks WHERE resource_id = ?', candidate.resource_id);
        await txn.runAsync('DELETE FROM content_resources WHERE resource_id = ?', candidate.resource_id);
        orphaned.push(candidate.resource_id);
      }
    }
  });
  contentChanged();
  return orphaned;
}

export async function activateSystemResource(resourceId: string, version: string, bytes: number): Promise<void> {
  const db = await getOfflineDatabase();
  await db.runAsync(
    `INSERT INTO content_resources (resource_id, active_version, state, system_owned, bytes, error, updated_at)
     VALUES (?, ?, 'installed', 1, ?, NULL, ?)
     ON CONFLICT(resource_id) DO UPDATE SET active_version = excluded.active_version,
       state = 'installed', system_owned = 1, bytes = excluded.bytes, error = NULL, updated_at = excluded.updated_at`,
    resourceId, version, bytes, nowIso(),
  );
  contentChanged();
}

export async function removeBookReferences(bookKey: DownloadableBookKey): Promise<string[]> {
  const db = await getOfflineDatabase();
  const candidates = await db.getAllAsync<{ resource_id: string }>(
    `SELECT resource_id FROM content_book_resources WHERE book_key = ?
     UNION SELECT resource_id FROM content_book_pending_resources WHERE book_key = ?`,
    bookKey, bookKey,
  );
  const removed: string[] = [];
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('DELETE FROM content_book_resources WHERE book_key = ?', bookKey);
    await txn.runAsync('DELETE FROM content_book_pending_resources WHERE book_key = ?', bookKey);
    await txn.runAsync(
      `UPDATE content_books SET status = 'not_downloaded', progress = 0, bytes_written = 0,
         total_bytes = NULL, error = NULL, installed_at = NULL, updated_at = ? WHERE book_key = ?`,
      nowIso(), bookKey,
    );
    for (const candidate of candidates) {
      const resource = await txn.getFirstAsync<{ system_owned: number }>(
        'SELECT system_owned FROM content_resources WHERE resource_id = ?', candidate.resource_id,
      );
      const refs = await txn.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) AS count FROM (
           SELECT book_key FROM content_book_resources WHERE resource_id = ?
           UNION SELECT book_key FROM content_book_pending_resources WHERE resource_id = ?
         ) AS resource_refs`,
        candidate.resource_id, candidate.resource_id,
      );
      if (!resource?.system_owned && (refs?.count ?? 0) === 0) {
        await txn.runAsync('DELETE FROM content_rows WHERE resource_id = ?', candidate.resource_id);
        await txn.runAsync('DELETE FROM content_rpc_results WHERE resource_id = ?', candidate.resource_id);
        await txn.runAsync('DELETE FROM content_resource_chunks WHERE resource_id = ?', candidate.resource_id);
        await txn.runAsync('DELETE FROM content_resources WHERE resource_id = ?', candidate.resource_id);
        removed.push(candidate.resource_id);
      }
    }
  });
  contentChanged();
  return removed;
}

/**
 * Deletes a resource's rows for every version but the active one and those in
 * `keep`: the versions another book is still fetching, which become active
 * when that book finishes.
 */
export async function cleanupObsoleteResourceVersions(resourceId: string, keep: readonly string[] = []): Promise<void> {
  const db = await getOfflineDatabase();
  const active = await getActiveResourceVersion(resourceId);
  if (!active) return;
  const kept = [active, ...keep.filter((version) => version !== active)];
  const versions = kept.map(() => '?').join(', ');
  let deletedRows = 0;
  await db.withExclusiveTransactionAsync(async (txn) => {
    deletedRows = (await txn.runAsync(`DELETE FROM content_rows WHERE resource_id = ? AND version NOT IN (${versions})`, resourceId, ...kept)).changes;
    await txn.runAsync(`DELETE FROM content_rpc_results WHERE resource_id = ? AND version NOT IN (${versions})`, resourceId, ...kept);
    await txn.runAsync(`DELETE FROM content_resource_chunks WHERE resource_id = ? AND version NOT IN (${versions})`, resourceId, ...kept);
  });
  // Only other versions' rows go, which no read sees, but if a newer version
  // was switched in meanwhile they were the active ones. This runs at every
  // launch, and almost always finds nothing to delete, so the tables already
  // read are let go only when something was.
  if (deletedRows) contentChanged();
}

/**
 * The resources some book is still installing, or was until a pause, a
 * failure or the app closing: activation, or removing the book, clears them.
 */
export async function listPendingResourceIds(): Promise<Set<string>> {
  const db = await getOfflineDatabase();
  const rows = await db.getAllAsync<{ resource_id: string }>('SELECT DISTINCT resource_id FROM content_book_pending_resources');
  return new Set(rows.map((row) => row.resource_id));
}

export async function listBooks(): Promise<BookDownloadProgress[]> {
  const db = await getOfflineDatabase();
  const rows = await db.getAllAsync<{
    book_key: DownloadableBookKey; title: string; status: BookDownloadStatus; progress: number;
    bytes_written: number; total_bytes: number | null; error: string | null; installed_at: string | null; updated_at: string;
  }>('SELECT * FROM content_books ORDER BY book_key');
  return rows.map((row) => ({ bookKey: row.book_key, title: row.title, status: row.status,
    progress: row.progress, bytesWritten: row.bytes_written, totalBytes: row.total_bytes,
    error: row.error, installedAt: row.installed_at, updatedAt: row.updated_at }));
}

export async function getBook(bookKey: DownloadableBookKey): Promise<BookDownloadProgress | null> {
  return (await listBooks()).find((book) => book.bookKey === bookKey) || null;
}

export async function listResources(): Promise<ManagedContentResource[]> {
  const db = await getOfflineDatabase();
  const rows = await db.getAllAsync<{
    resource_id: string; active_version: string | null; state: BookDownloadStatus;
    system_owned: number; bytes: number; error: string | null; updated_at: string;
  }>('SELECT * FROM content_resources ORDER BY system_owned DESC, resource_id');
  return rows.map((row) => ({ resourceId: row.resource_id, activeVersion: row.active_version,
    state: row.state, systemOwned: Boolean(row.system_owned), bytes: row.bytes,
    error: row.error, updatedAt: row.updated_at }));
}

export async function setContentSetting(key: string, value: string): Promise<void> {
  const db = await getOfflineDatabase();
  await db.runAsync(
    `INSERT INTO content_settings (setting_key, setting_value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = excluded.updated_at`,
    key, value, nowIso(),
  );
}

export async function getContentSetting(key: string): Promise<string | null> {
  const db = await getOfflineDatabase();
  const row = await db.getFirstAsync<{ setting_value: string }>(
    'SELECT setting_value FROM content_settings WHERE setting_key = ?', key,
  );
  return row?.setting_value ?? null;
}
