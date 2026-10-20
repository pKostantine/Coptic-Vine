#!/usr/bin/env node
/**
 * Builds the offline book packages and publishes them to the content Worker
 * (workers/content-packages), which the app downloads books from.
 *
 *   PUBLISH_TOKEN=... node scripts/publish-content-packages.mjs
 *   PUBLISH_TOKEN_FILE=path/to/token node scripts/publish-content-packages.mjs
 *   PUBLISH_TOKEN=... node scripts/publish-content-packages.mjs --changed
 *
 * With --changed (as .github/workflows/publish-content.yml runs it every half
 * hour) only the books whose tables changed since the last publish are
 * rebuilt -- the database notes when each packaged table was last written to
 * (get_offline_content_changes) -- and the run ends at once when nothing has.
 * The calendar's window is moved on when the month turns, and everything is
 * rebuilt once a week, for what no table records: a function rewritten, a
 * book's plan changed.
 *   node scripts/publish-content-packages.mjs --dry-run
 *
 * --dry-run builds every package and reports its chunks without uploading
 * anything or touching the manifest, so it needs no publish token.
 *
 * Where the content comes from follows the app's switch in .env
 * (EXPO_PUBLIC_CONTENT_SOURCE): the D1 content Worker (EXPO_PUBLIC_CONTENT_API_URL),
 * the content master since 20 Oct 2026, unless it says supabase. CONTENT_SOURCE_URL
 * or --source <url> points it anywhere else, e.g.
 *   CONTENT_SOURCE_URL=https://wtuujmeinzqfikvuofmh.supabase.co node scripts/publish-content-packages.mjs --dry-run
 * The Worker answers the same four functions from D1 (workers/content-api,
 * src/rpc/offline.ts). Packages built from D1 leave out what D1 doesn't copy:
 * Supabase's legacy and staging tables and the generated tsvector columns of
 * bible.verses.
 *
 * What to package comes from the database (get_offline_package_plan): each
 * book's resources, their dependencies and tables. The rows are read a page
 * at a time (get_offline_table_rows) with the public anon key -- everything in
 * a package is public anyway -- and the calendar's day-by-day answers
 * (condition flags, readings, the Synaxarium) are taken for a rolling window:
 * from the start of last month to the end of the month a year and a month
 * ahead, so run this at least monthly to keep that window ahead of the date.
 *
 * Chunks keep the format the app imports (see ContentPackagePayload) and are
 * named by their content, so an unchanged chunk is never uploaded twice and a
 * device that has it never downloads it again. A resource's version is the
 * hash of its chunks, so "update available" means the content really changed.
 * The root manifest is written last: until then devices keep the old one.
 */
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

function loadDotEnv() {
  try {
    const values = {};
    for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match) values[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
    return values;
  } catch { return {}; }
}

const dotenv = loadDotEnv();
const env = (name) => process.env[name] || dotenv[name] || '';
const SOURCE_ARG = process.argv.includes('--source') ? process.argv[process.argv.indexOf('--source') + 1] : '';
const SWITCHED_SOURCE = env('EXPO_PUBLIC_CONTENT_SOURCE') === 'supabase'
  ? env('EXPO_PUBLIC_SUPABASE_URL')
  : env('EXPO_PUBLIC_CONTENT_API_URL') || 'https://content.copticvine.ca';
const SOURCE_URL = (SOURCE_ARG || process.env.CONTENT_SOURCE_URL || SWITCHED_SOURCE).replace(/\/+$/, '');
const ANON_KEY = env('EXPO_PUBLIC_SUPABASE_ANON_KEY');
const CONTENT_URL = (env('CONTENT_PACKAGES_URL') || env('EXPO_PUBLIC_CONTENT_PACKAGES_URL')).replace(/\/+$/, '');
const PUBLISH_TOKEN = (process.env.PUBLISH_TOKEN || (process.env.PUBLISH_TOKEN_FILE ? readFileSync(process.env.PUBLISH_TOKEN_FILE, 'utf8') : '')).trim();
const DRY_RUN = process.argv.includes('--dry-run');
const CHANGED_ONLY = process.argv.includes('--changed');
/** How long a --changed run goes before it rebuilds everything anyway. */
const FULL_REBUILD_MS = 7 * 24 * 60 * 60 * 1000;

if (!SOURCE_URL || !ANON_KEY) throw new Error('A content source and EXPO_PUBLIC_SUPABASE_ANON_KEY are needed (from .env).');
if (!CONTENT_URL && !DRY_RUN) throw new Error('EXPO_PUBLIC_CONTENT_PACKAGES_URL is needed (from .env).');
if (!PUBLISH_TOKEN && !DRY_RUN) throw new Error('Set PUBLISH_TOKEN or PUBLISH_TOKEN_FILE to the content Worker\'s publish token.');

const TARGET_CHUNK_BYTES = 2 * 1024 * 1024;
const encoder = new TextEncoder();
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Runs tasks with at most `limit` in flight, in order. */
async function pool(items, limit, task) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index], index);
    }
  }));
  return results;
}

/** A database function through the REST API, retried while the database is busy. */
async function rpc(schema, name, args = {}) {
  for (let attempt = 0; ; attempt += 1) {
    let response;
    try {
      response = await fetch(`${SOURCE_URL}/rest/v1/rpc/${name}`, {
        method: 'POST',
        headers: { apikey: ANON_KEY, authorization: `Bearer ${ANON_KEY}`, 'content-type': 'application/json', 'content-profile': schema },
        body: JSON.stringify(args),
      });
    } catch (error) {
      if (attempt >= 5) throw error;
      await sleep(500 * 2 ** attempt);
      continue;
    }
    if (response.ok) return response.json();
    const text = await response.text();
    if (attempt >= 5 || (response.status < 500 && response.status !== 429)) throw new Error(`${schema}.${name} failed (${response.status}): ${text.slice(0, 300)}`);
    await sleep(500 * 2 ** attempt);
  }
}

async function readTable(resource, table) {
  const rows = [];
  let after = null;
  let limit = 500;
  for (;;) {
    let page;
    try {
      page = await rpc('public', 'get_offline_table_rows', { p_resource: resource, p_table: table, p_after: after, p_limit: limit });
    } catch (error) {
      // A page too heavy for the request time limit: take smaller ones.
      if (limit > 50) { limit = Math.floor(limit / 2); continue; }
      throw error;
    }
    rows.push(...page.rows);
    if (!page.after || page.rows.length < limit) return rows;
    after = page.after;
  }
}

/** The order rows are packaged in: the Bible in reading order, everything else by content, so a package comes out the same every run. */
function sortRows(resource, table, rows) {
  const keyed = rows.map((row) => ({ row, text: JSON.stringify(row) }));
  const bibleOrder = resource === 'bible' && { books: ['source_number', 'book_key'], verses: ['book_key', 'chapter_number', 'verse_number'], verse_parts: ['book_key', 'chapter_number', 'verse_number', 'part_label'] }[table];
  keyed.sort((a, b) => {
    if (bibleOrder) {
      for (const column of bibleOrder) {
        const x = a.row[column]; const y = b.row[column];
        if (x === y) continue;
        if (x == null) return 1;
        if (y == null) return -1;
        return typeof x === 'number' && typeof y === 'number' ? x - y : String(x) < String(y) ? -1 : 1;
      }
    }
    return a.text < b.text ? -1 : a.text > b.text ? 1 : 0;
  });
  return keyed.map((entry) => entry.row);
}

/** The calendar window: the first of last month to the last day of the month thirteen months on. */
function windowDates(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 14, 0));
  const dates = [];
  for (const day = new Date(start); day <= end; day.setUTCDate(day.getUTCDate() + 1)) dates.push(day.toISOString().slice(0, 10));
  return dates;
}

/** The day-by-day answers a resource carries, with the exact arguments the app asks them with offline. */
async function rpcResultsFor(resource, dates) {
  const calls = resource === 'calendar'
    ? dates.flatMap((date) => [
      { schema: 'calendar', function: 'get_context_flags', args: { p_date: date, p_extra_context: {} } },
      { schema: 'calendar', function: 'get_active_flags_for_date', args: { p_gregorian_date: date } },
      { schema: 'public', function: 'get_readings_for_date', args: { p_date: date } },
    ])
    : resource === 'synaxarium'
      ? dates.map((date) => ({ schema: 'synaxarium', function: 'get_day_json', args: { p_date: date } }))
      : [];
  return pool(calls, 8, async (call) => ({ ...call, data: await rpc(call.schema, call.function, call.args) }));
}

function emptyPayload(resourceId) {
  // Revision-neutral, as the app expects: it imports a chunk under the
  // manifest's version, so an unchanged chunk serves every later version.
  return { formatVersion: 1, snapshotId: '', resourceId, version: '', chunkId: '', tables: [], rpcResults: [] };
}

async function buildResource(resource, dates) {
  const chunks = [];
  let payload = emptyPayload(resource.id);
  let estimate = 0;
  let rowCount = 0;
  let bucket = '';
  let bucketPart = 0;

  const flush = () => {
    if (!rowCount) return;
    payload.chunkId = resource.id === 'bible'
      ? `${sha256(encoder.encode(bucket)).slice(0, 20)}-${String(bucketPart).padStart(3, '0')}`
      : String(chunks.length).padStart(5, '0');
    const raw = Buffer.from(JSON.stringify(payload));
    const digest = sha256(raw);
    chunks.push({ id: payload.chunkId, url: `/packages/${resource.id}/${digest}.json`, size: raw.byteLength, sha256: digest, rowCount, body: gzipSync(raw, { level: 9 }) });
    payload = emptyPayload(resource.id); estimate = 0; rowCount = 0;
  };

  const add = (rowBytes, nextBucket, append) => {
    const bucketChanged = resource.id === 'bible' && rowCount > 0 && nextBucket !== bucket;
    const sizeExceeded = rowCount > 0 && estimate + rowBytes > TARGET_CHUNK_BYTES;
    if (bucketChanged || sizeExceeded) {
      flush();
      bucketPart = bucketChanged ? 0 : bucketPart + 1;
    }
    if (!rowCount) bucket = nextBucket;
    append();
    estimate += rowBytes; rowCount += 1;
  };

  for (const table of resource.tables) {
    const rows = sortRows(resource.id, table, await readTable(resource.id, table));
    for (const row of rows) {
      // The Bible's chunks follow its books, so a change to one book leaves
      // every other book's chunks as they were. (They once followed its
      // chapters, which made 1,409 small chunks a device fetched one by one;
      // a book is split only where it passes the target size.)
      const nextBucket = resource.id === 'bible'
        ? (table === 'books' ? 'books' : `${table}:${row.book_key ?? 'unknown'}`)
        : '';
      add(JSON.stringify(row).length + 160, nextBucket, () => {
        let target = payload.tables.find((entry) => entry.schema === resource.schema && entry.table === table);
        if (!target) { target = { schema: resource.schema, table, rows: [] }; payload.tables.push(target); }
        target.rows.push(row);
      });
    }
  }
  for (const result of await rpcResultsFor(resource.id, dates)) {
    const nextBucket = resource.id === 'bible' ? `rpc:${result.schema}:${result.function}` : '';
    add(JSON.stringify(result.data).length + JSON.stringify(result.args).length + 160, nextBucket, () => payload.rpcResults.push(result));
  }
  flush();
  if (!chunks.length) throw new Error(`Resource ${resource.id} produced no rows.`);
  const aggregate = sha256(encoder.encode(JSON.stringify(chunks.map((chunk) => [chunk.id, chunk.sha256, chunk.rowCount]))));
  return { id: resource.id, version: aggregate.slice(0, 16), size: chunks.reduce((sum, chunk) => sum + chunk.size, 0), sha256: aggregate, chunks };
}

async function put(key, body, contentType) {
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(`${CONTENT_URL}/${key}`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${PUBLISH_TOKEN}`, 'content-type': contentType },
      body,
    }).catch((error) => ({ ok: false, status: 0, text: async () => String(error) }));
    if (response.ok) return;
    if (attempt >= 4 || (response.status >= 400 && response.status < 500)) throw new Error(`Upload of ${key} failed (${response.status}): ${(await response.text()).slice(0, 200)}`);
    await sleep(500 * 2 ** attempt);
  }
}

async function exists(key) {
  const response = await fetch(`${CONTENT_URL}/${key}`, { method: 'HEAD' }).catch(() => null);
  return Boolean(response?.ok);
}

function resolveGraph(roots, dependencies) {
  const ordered = [];
  const seen = new Set();
  const visit = (id) => {
    if (seen.has(id)) return;
    seen.add(id);
    for (const dependency of dependencies.get(id) || []) visit(dependency);
    ordered.push(id);
  };
  visit('public');
  for (const root of roots) visit(root);
  return ordered;
}

/** The manifest devices read now, or null if there is none yet. */
async function currentManifest() {
  if (!CONTENT_URL) return null;
  const response = await fetch(`${CONTENT_URL}/manifest.json`, { headers: { 'cache-control': 'no-cache' } }).catch(() => null);
  return response?.ok ? response.json() : null;
}

/** When each packaged table last changed, by the database's clock; null where the database doesn't record it. */
async function contentChanges() {
  try { return await rpc('public', 'get_offline_content_changes'); }
  catch (error) {
    console.warn(`The database doesn't say which tables changed (${error.message.slice(0, 80)}).`);
    return null;
  }
}

const plan = await rpc('public', 'get_offline_package_plan');
const dependencies = new Map();
for (const { resource, dependency } of plan.dependencies) dependencies.set(resource, [...(dependencies.get(resource) || []), dependency]);
const dates = windowDates();
const changes = await contentChanges();
const previous = await currentManifest();
const books = Object.fromEntries(plan.books.map((book) => [book.key, { key: book.key, title: book.title, titleArabic: book.titleArabic, resources: resolveGraph(book.roots, dependencies) }]));

/**
 * The resources to build this run: all of them, or with --changed only those
 * whose tables changed since the last publish (and the calendar and the
 * Synaxarium when their window has moved on). Everything is built when there
 * is nothing to compare against, when the books' plan has changed, or when the
 * last full build is a week old.
 */
function resourcesToBuild() {
  const all = new Set(plan.resources.map((resource) => resource.id));
  if (!CHANGED_ONLY) return { ids: all, full: true, reason: 'a full build' };
  if (!previous) return { ids: all, full: true, reason: 'no manifest yet' };
  // Without the database's record of changes there is no telling what moved:
  // a scheduled run rebuilds nothing rather than everything every half hour.
  if (!changes) return { ids: new Set(), full: false, reason: 'the database keeps no record of changes yet' };
  const lastFull = Date.parse(previous.fullBuildAt || previous.publishedAt);
  if (!(Date.now() - lastFull < FULL_REBUILD_MS)) return { ids: all, full: true, reason: 'the weekly full build' };
  const sameResources = all.size === Object.keys(previous.resources || {}).length && [...all].every((id) => previous.resources[id]);
  const sameBooks = JSON.stringify(Object.values(books).map((book) => [book.key, book.resources]))
    === JSON.stringify(Object.values(books).map((book) => [book.key, previous.books?.[book.key]?.resources]));
  const sameDependencies = plan.resources.every((resource) => JSON.stringify(dependencies.get(resource.id) || []) === JSON.stringify(previous.resources[resource.id]?.dependencies || []));
  if (!sameResources || !sameBooks || !sameDependencies) return { ids: all, full: true, reason: 'the books\' plan changed' };

  const since = Date.parse(previous.changesThrough || previous.publishedAt);
  const ids = new Set();
  for (const change of changes.changes) {
    if (!(Date.parse(change.changedAt) > since)) continue;
    for (const resource of plan.resources) {
      if (resource.schema === change.schema && resource.tables.includes(change.table)) ids.add(resource.id);
    }
  }
  if (previous.calendarWindow?.start !== dates[0]) { ids.add('calendar'); ids.add('synaxarium'); }
  return { ids, full: false, reason: ids.size ? `changed since ${new Date(since).toISOString()}` : 'nothing changed' };
}

const build = resourcesToBuild();
if (!build.ids.size) {
  console.log(`Up to date: ${build.reason}.`);
  process.exit(0);
}
console.log(`Packaging ${build.ids.size} of ${plan.resources.length} resources (${build.reason}); calendar ${dates[0]} to ${dates[dates.length - 1]}.`);

const resources = {};
let uploaded = 0;
let reused = 0;
for (const resource of plan.resources) {
  if (!build.ids.has(resource.id)) {
    // Unchanged: as it was published, its chunks already in place.
    resources[resource.id] = { ...previous.resources[resource.id], dependencies: dependencies.get(resource.id) || [] };
    continue;
  }
  const started = Date.now();
  const built = await buildResource(resource, dates);
  if (!DRY_RUN) await pool(built.chunks, 6, async (chunk) => {
    const key = chunk.url.slice(1);
    if (await exists(key)) { reused += 1; return; }
    await put(key, chunk.body, 'application/json');
    uploaded += 1;
  });
  resources[resource.id] = {
    id: built.id,
    version: built.version,
    dependencies: dependencies.get(resource.id) || [],
    size: built.size,
    sha256: built.sha256,
    chunks: built.chunks.map(({ body: _body, ...chunk }) => chunk),
  };
  console.log(`  ${resource.id.padEnd(26)} ${String(built.chunks.length).padStart(5)} chunks  ${(built.size / 1024 / 1024).toFixed(1).padStart(6)} MB  ${((Date.now() - started) / 1000).toFixed(0)}s`);
}

for (const book of Object.values(books)) {
  for (const id of book.resources) if (!resources[id]) throw new Error(`${book.key} needs ${id}, which produced no package.`);
}
if (!resources.calendar) throw new Error('No calendar package was built.');
const publishedAt = new Date().toISOString();
const manifest = {
  formatVersion: 1,
  snapshotId: `${publishedAt}-${sha256(encoder.encode(JSON.stringify(resources))).slice(0, 8)}`,
  publishedAt,
  // What the next --changed run measures from: the database's clock as this
  // run began, so a change made while it ran is caught next time.
  changesThrough: changes?.now ?? publishedAt,
  fullBuildAt: build.full ? publishedAt : previous?.fullBuildAt ?? publishedAt,
  calendarWindow: { start: dates[0], end: dates[dates.length - 1] },
  books,
  resources,
};
if (DRY_RUN) {
  const chunkCount = Object.values(resources).reduce((sum, resource) => sum + resource.chunks.length, 0);
  console.log(`Dry run: ${Object.keys(books).length} books, ${chunkCount} chunks built; nothing uploaded.`);
} else {
  await put('manifest.json', JSON.stringify(manifest), 'application/json');
  console.log(`Published ${Object.keys(books).length} books (${[...build.ids].join(', ')} rebuilt): ${uploaded} chunks uploaded, ${reused} already there.`);
}
