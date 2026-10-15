#!/usr/bin/env node
/**
 * Builds the offline book packages and publishes them to the content Worker
 * (workers/content-packages), which the app downloads books from.
 *
 *   PUBLISH_TOKEN=... node scripts/publish-content-packages.mjs
 *   PUBLISH_TOKEN_FILE=path/to/token node scripts/publish-content-packages.mjs
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
const SUPABASE_URL = env('EXPO_PUBLIC_SUPABASE_URL').replace(/\/+$/, '');
const ANON_KEY = env('EXPO_PUBLIC_SUPABASE_ANON_KEY');
const CONTENT_URL = (env('CONTENT_PACKAGES_URL') || env('EXPO_PUBLIC_CONTENT_PACKAGES_URL')).replace(/\/+$/, '');
const PUBLISH_TOKEN = (process.env.PUBLISH_TOKEN || (process.env.PUBLISH_TOKEN_FILE ? readFileSync(process.env.PUBLISH_TOKEN_FILE, 'utf8') : '')).trim();

if (!SUPABASE_URL || !ANON_KEY) throw new Error('EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are needed (from .env).');
if (!CONTENT_URL) throw new Error('EXPO_PUBLIC_CONTENT_PACKAGES_URL is needed (from .env).');
if (!PUBLISH_TOKEN) throw new Error('Set PUBLISH_TOKEN or PUBLISH_TOKEN_FILE to the content Worker\'s publish token.');

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
      response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
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
      // The Bible's chunks follow its chapters, so a change to one chapter
      // leaves every other chapter's chunk as it was.
      const nextBucket = resource.id === 'bible'
        ? (table === 'books' ? 'books' : `${table}:${row.book_key ?? 'unknown'}:${row.chapter_number ?? 'metadata'}`)
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

const plan = await rpc('public', 'get_offline_package_plan');
const dependencies = new Map();
for (const { resource, dependency } of plan.dependencies) dependencies.set(resource, [...(dependencies.get(resource) || []), dependency]);
const dates = windowDates();
console.log(`Packaging ${plan.resources.length} resources; calendar ${dates[0]} to ${dates[dates.length - 1]}.`);

const resources = {};
let uploaded = 0;
let reused = 0;
for (const resource of plan.resources) {
  const started = Date.now();
  const built = await buildResource(resource, dates);
  await pool(built.chunks, 6, async (chunk) => {
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

const books = Object.fromEntries(plan.books.map((book) => [book.key, { key: book.key, title: book.title, titleArabic: book.titleArabic, resources: resolveGraph(book.roots, dependencies) }]));
for (const book of Object.values(books)) {
  for (const id of book.resources) if (!resources[id]) throw new Error(`${book.key} needs ${id}, which produced no package.`);
}
if (!resources.calendar) throw new Error('No calendar package was built.');
const publishedAt = new Date().toISOString();
const manifest = { formatVersion: 1, snapshotId: `${publishedAt}-${sha256(encoder.encode(JSON.stringify(resources))).slice(0, 8)}`, publishedAt, books, resources };
await put('manifest.json', JSON.stringify(manifest), 'application/json');
console.log(`Published ${Object.keys(books).length} books: ${uploaded} chunks uploaded, ${reused} already there.`);
