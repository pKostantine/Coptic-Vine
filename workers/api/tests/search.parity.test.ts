/**
 * Parity: the catalog search, the Worker against Supabase's own functions (the
 * PGlite oracle), over a unified catalog seeded identically on both sides:
 * documents in several languages (and one with none), aliases, a draft and a
 * document of another kind that must not show, entities shown in neither the
 * reader's language nor English, an entity type that matches 'music_%' only
 * through LIKE's "_", a document whose normalized text is missing, and more
 * artists than search_section_catalog keeps. The oracle computes
 * normalized_text, normalized_alias and search_vector as Supabase's triggers
 * do; the Worker gets the same normalized columns and computes its vectors
 * itself. Text is ASCII: the oracle's collation is C (see
 * tests/search.text.test.ts for the rest), and the real catalog is compared
 * by scripts/search-parity.ts.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { tsvectorText } from '../../content-api/src/search/tsvector.ts';
import { documentVector } from '../src/rpc/search/catalog.ts';
import { normalizeSearchText } from '../src/rpc/search/text.ts';
import { createOracle, type Oracle } from './lib/oracle.ts';
import { seed, type Seed } from './lib/seed.ts';
import { WorkerSide } from './lib/worker.ts';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const AT = '2026-03-01T08:00:00+00:00';

type Doc = [entity: number, type: string, locale: string | null, title: string | null, subtitle: string | null, body: string | null, extra?: Record<string, unknown>];

const DOCS: Doc[] = [
  [1, 'music_artist', 'en', 'Choir of Saint Mark', 'Cairo', 'Hymns and praises of the Coptic church', { metadata: { image: { path: 'a/1.webp' }, count: 3 } }],
  [1, 'music_artist', 'ar', 'Kowrat Mar Morqos', null, 'Tasbeha'],
  ...['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Iota'].map((name, i): Doc => [2 + i, 'music_artist', 'en', `Choir ${name}`, null, 'Coptic hymns']),
  [20, 'music_release', 'en', 'Midnight Praises', 'Choir of Saint Mark', 'Tasbeha for Kiahk'],
  [20, 'music_release', 'fr', 'Louanges de minuit', 'Chorale', 'Tasbeha de Kiahk'],
  [30, 'music_track', 'en', 'The First Hoos', 'Midnight Praises', 'Moses song of the Red Sea'],
  [31, 'music_track', 'en', 'Kiahk Doxology', 'Midnight Praises', null],
  [32, 'music_track', 'fr', 'Psali Adam', null, 'Kiahk'],
  [33, 'music_track', 'en', 'Ainos', null, 'praise the Lord'],
  [34, 'musical', 'en', 'Musical Interlude', null, 'Kiahk'],
  [40, 'learning_season', 'en', 'Kiahk', null, 'The month of praise'],
  [40, 'learning_season', 'ar', 'Kiahk Season', null, null],
  [41, 'learning_season', 'en', 'Great Lent', null, 'Fasting and praise'],
  [42, 'learning_season', null, 'Holy Week', null, 'Pascha praise'],
  [42, 'learning_season', 'en', 'Pascha Week', null, 'Holy Week praise'],
  [35, 'music_track', 'ar', 'Shere Ne Maria', null, 'Hail Mary'],
  [35, 'music_track', 'fr', 'Salut Marie', null, 'Hail Mary'],
  [43, 'learning_hymn', 'en', 'Tenen', 'Lent hymn', 'We worship the Father'],
  [44, 'learning_cantor', 'en', 'Cantor Ibrahim Ayad', null, 'Teacher of hymns'],
  [45, 'learning_lesson', 'ar', 'Lesson on Kiahk tunes', 'Kiahk', 'Kiahk Kiahk'],
  [50, 'music_track', 'en', 'Kiahk Draft Hidden', null, null, { publication_status: 'draft' }],
  [51, 'music_track', 'en', 'Kiahk Other Kind', null, null, { kind: 'other' }],
];

const ALIASES: [entity: number, type: string, alias: string, status?: string][] = [
  [1, 'music_artist', 'Saint Mark Choir'],
  [30, 'music_track', 'Hos Awal'],
  [43, 'learning_hymn', 'tenen'],
  [44, 'learning_cantor', 'Ibrahim'],
  [20, 'music_release', 'Tasbeha'],
  [31, 'music_track', 'Kiahk secret', 'draft'],
  [99, 'music_track', 'Kiahk orphan'],
];

function catalog(): Seed {
  return [
    ['media.locales', ['en', 'ar', 'fr'].map((code, i) => ({ code, english_name: code, native_name: code, text_direction: code === 'ar' ? 'rtl' : 'ltr', sort_order: i, created_at: AT, updated_at: AT }))],
    ['media.search_documents', DOCS.map(([entity, type, locale, title, subtitle, body, extra], i) => ({
      id: id(1000 + i), entity_type: type, entity_id: id(entity), locale, kind: 'unified_catalog', title, subtitle, body, metadata: { order: i },
      publication_status: 'published', created_at: AT, updated_at: AT, ...extra,
    }))],
    ['media.search_aliases', ALIASES.map(([entity, type, alias, status], i) => ({
      id: id(2000 + i), entity_type: type, entity_id: id(entity), locale: null, alias, publication_status: status ?? 'published', created_at: AT, updated_at: AT,
    }))],
  ];
}

let oracle: Oracle;
let worker: WorkerSide;

before(async () => {
  oracle = await createOracle();
  worker = new WorkerSide();
  await seed(oracle, worker, catalog());
  // What private.refresh_unified_search_index and the alias trigger store; one document is left without.
  await oracle.sql(`update media.search_documents set normalized_text = media.normalize_search_text(concat_ws(' ', title, subtitle, body)),
    search_vector = setweight(to_tsvector('simple', media.normalize_search_text(title)), 'A') || setweight(to_tsvector('simple', media.normalize_search_text(subtitle)), 'B')
      || setweight(to_tsvector('simple', media.normalize_search_text(body)), 'C')`);
  await oracle.sql(`update media.search_documents set normalized_text = null where entity_id = $1`, [id(33)]);
  await oracle.sql('update media.search_aliases set normalized_alias = media.normalize_search_text(alias)');
  for (const row of await oracle.sql<{ id: string; normalized_text: string | null }>('select id, normalized_text from media.search_documents')) {
    worker.db.prepare('UPDATE "media.search_documents" SET "normalized_text" = ? WHERE "id" = ?').run(row.normalized_text, row.id);
  }
  for (const row of await oracle.sql<{ id: string; normalized_alias: string }>('select id, normalized_alias from media.search_aliases')) {
    worker.db.prepare('UPDATE "media.search_aliases" SET "normalized_alias" = ? WHERE "id" = ?').run(row.normalized_alias, row.id);
  }
});
after(() => oracle.close());

test("the Worker's normalized text and search vectors are the oracle's", async () => {
  const rows = await oracle.sql<{ title: string | null; subtitle: string | null; body: string | null; normalized_text: string | null; vector: string; entity_id: string }>(
    'select title, subtitle, body, normalized_text, search_vector::text as vector, entity_id::text from media.search_documents');
  for (const row of rows) {
    assert.equal(tsvectorText(documentVector(row)), row.vector, row.title ?? '');
    if (row.entity_id !== id(33)) assert.equal(normalizeSearchText([row.title, row.subtitle, row.body].filter((v) => v != null).join(' ')), row.normalized_text);
  }
});

const QUERIES: (string | null)[] = [
  'choir', 'Choir of Saint Mark', 'saint mark', 'mark choir', 'chor', 'oir', 'kiahk', 'Kiahk!', 'praises', 'praise', 'midnight praises', 'tasbeha',
  'tasbiha', 'hoos', 'hos awal', 'first', 'lent', 'great', 'holy week', 'ibrahim', 'ayad', 'tenen', 'musical', 'psali', 'adam', 'moses red sea',
  'ainos', 'secret', 'orphan', 'hidden', 'other kind', 'or', 'kiahk or lent', 'the', 'lent -great', '"midnight praises"', 'week', 'pascha', 'salut',
  'shere', 'hail mary', 'zzz', '', '  ', null,
];

async function both(fn: string, args: Record<string, unknown>) {
  const pg = await oracle.call(null, fn, args);
  const w = await worker.rpc(null, fn, args);
  const what = `${fn}(${JSON.stringify(args)})`;
  assert.equal(pg.error, null, `${what}: ${JSON.stringify(pg.error)}`);
  assert.equal(w.error, null, `${what}: ${JSON.stringify(w.error)}`);
  assert.deepEqual(w.data, pg.data, what);
  return pg.data as { results: { matchedBy: string; kind: string }[] };
}

test('search_media_catalog: every query, scope, language and limit', async () => {
  const matchedBy = new Set<string>();
  for (const q of QUERIES) {
    for (const args of [
      { p_query: q },
      { p_query: q, p_locale: 'ar' },
      { p_query: q, p_locale: 'fr', p_scope: 'music' },
      { p_query: q, p_locale: null, p_scope: 'LEARNING', p_limit: 3 },
    ]) for (const result of (await both('search_media_catalog', args)).results) matchedBy.add(result.matchedBy);
  }
  for (const args of [{ p_query: 'kiahk', p_scope: 'bogus', p_limit: 0 }, { p_query: 'kiahk', p_scope: null, p_limit: 500 }, { p_query: 'praise', p_locale: 'xx', p_limit: 1 }]) {
    await both('search_media_catalog', args);
  }
  assert.deepEqual([...matchedBy].sort(), ['alias', 'alias_exact', 'full_text', 'similarity', 'substring', 'title_exact', 'title_prefix']);
});

test('search_section_catalog: both sections, with their caps', async () => {
  const kinds = new Map<string, number>();
  for (const q of QUERIES) {
    for (const args of [
      { p_query: q },
      { p_query: q, p_locale: 'ar', p_section: 'learning' },
      { p_query: q, p_locale: null, p_section: null, p_limit: 2 },
    ]) await both('search_section_catalog', args);
  }
  for (const result of (await both('search_section_catalog', { p_query: 'choir', p_limit: 80 })).results) kinds.set(result.kind, (kinds.get(result.kind) ?? 0) + 1);
  assert.equal(kinds.get('music_artist'), 8, 'ten choirs match, eight are kept');
  await both('search_section_catalog', { p_query: 'kiahk', p_section: 'LEARNING', p_limit: -3 });
});
