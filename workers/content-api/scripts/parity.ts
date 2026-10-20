/**
 * Parity: the same supabase-js calls the app makes, sent to Supabase and to
 * the content Worker, and the answers compared.
 *
 *   npm run parity                                  against the Worker on http://localhost:8790 (wrangler dev)
 *   npm run parity -- --worker https://…            against a deployed Worker
 *   npm run parity -- --only rpc,bible,documents    some groups (rpc, bible, documents, queries, tables)
 *   npm run parity -- --report report.md
 *
 * Groups:
 *   rpc        every calendar and Synaxarium RPC for every day of Coptic year
 *              1743 (11 Sep 2026 to 11 Sep 2027, a leap year: Nesi has 6 days),
 *              and the special days of plan section 4.4 item 7 in other years
 *   bible      get_bible_books, every book's chapter list, every calendar book
 *              number, every verse part
 *   documents  every service document (order table) read as hymnLibrary.js reads
 *              it: the order rows, then titles and texts by hymn key in every
 *              lookup schema
 *   queries    the app's other table reads (calendar, Bible, saints)
 *   search     bible.search_verses over a corpus of queries: every mode, prefix,
 *              both sorts, testament and book filters, paging, all eight
 *              renderings, and awkward input (diacritics, websearch syntax,
 *              stopwords alone, punctuation, numbers, hyphens)
 *   tables     every public table in full, page by page (as much egress as an import)
 *   packages   what the offline books are built from: the package plan, and every
 *              packaged table's rows through get_offline_table_rows, compared as a
 *              set (pages follow ctid there and rowid here). bible.verses is left
 *              out: Supabase's rows carry its tsvector columns (a lot of egress),
 *              and its content is proven by verify.ts's checksums.
 *
 * Answers are compared as JSON values: numbers by value (Postgres prints
 * numeric 21.50 where D1 has 21.5), object keys in any order. Arrays keep
 * their order, except where Postgres doesn't define one (a query without
 * ORDER BY; the saints in get_active_flags_for_date).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadEnv } from './lib/env.ts';
import { contentSchema, type TableInfo } from './lib/schema.ts';

const env = loadEnv();
const args = process.argv.slice(2);
const option = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const WORKER_URL = (option('--worker') || 'http://localhost:8790').replace(/\/+$/, '');
const GROUPS = new Set((option('--only') || 'rpc,bible,documents,queries,search').split(','));
const CONCURRENCY = Number(option('--concurrency') || 6);

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const supabase = createClient(env('EXPO_PUBLIC_SUPABASE_URL'), env('EXPO_PUBLIC_SUPABASE_ANON_KEY'), clientOptions);
const worker = createClient(WORKER_URL, env('EXPO_PUBLIC_SUPABASE_ANON_KEY'), clientOptions);

type Call = (client: SupabaseClient) => PromiseLike<{ data: unknown; error: unknown }>;
type Case = {
  group: string;
  name: string;
  call: Call;
  unordered?: boolean;
  /** The ORDER BY columns: rows equal on all of them come in no defined order in Postgres, so they are compared as a set. */
  ties?: string[];
  normalize?: (data: unknown) => unknown;
};

/** Rows that tie on the ordering columns, each run of them sorted by content, so only the order Postgres defines is compared. */
function sortTies(data: unknown, ties: string[]): unknown {
  if (!Array.isArray(data)) return data;
  const out: unknown[] = [];
  let run: Record<string, unknown>[] = [];
  const flush = () => { out.push(...run.sort((a, b) => (canonical(a) < canonical(b) ? -1 : canonical(a) > canonical(b) ? 1 : 0))); run = []; };
  for (const row of data as Record<string, unknown>[]) {
    if (run.length && ties.some((key) => run[0][key] !== row[key])) flush();
    run.push(row);
  }
  flush();
  return out;
}

/** Equal as JSON values: numbers by value, keys in any order, arrays in order. */
export function sameJson(a: unknown, b: unknown, unordered = false): boolean {
  if (a === b) return true;
  if (typeof a === 'number' && typeof b === 'number') return a === b;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    if (!unordered) return a.every((item, index) => sameJson(item, b[index]));
    const key = (item: unknown) => canonical(item);
    const left = a.map(key).sort();
    const right = b.map(key).sort();
    return left.every((item, index) => item === right[index]);
  }
  const ka = Object.keys(a as object).sort();
  const kb = Object.keys(b as object).sort();
  if (ka.join('\u0000') !== kb.join('\u0000')) return false;
  return ka.every((k) => sameJson((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

/** A value's JSON with sorted keys, so equal values print the same. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(value);
}

/** An error as the app sees it: code and message (PostgREST's details differ between versions). */
function errorOf(error: unknown): unknown {
  if (!error) return null;
  const e = error as { code?: string; message?: string };
  return { code: e.code ?? null, message: e.message ?? null };
}

async function pool<T>(items: T[], limit: number, task: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await task(items[next++]);
  }));
}

async function rows<T>(client: SupabaseClient, schema: string, table: string, build: (q: any) => any = (q) => q): Promise<T[]> {
  const { data, error } = await build(client.schema(schema).from(table).select('*'));
  if (error) throw new Error(`${schema}.${table}: ${error.message}`);
  return data as T[];
}

// ─── The cases ───────────────────────────────────────────────────────────

function dayRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) out.push(d.toISOString().slice(0, 10));
  return out;
}

async function rpcCases(): Promise<Case[]> {
  // Coptic year 1743, every day; then the days plan section 4.4 item 7 names, in other years.
  const year = await rows<{ gregorian_date: string }>(worker, 'calendar', 'coptic_date_conversions', (q) => q.select('gregorian_date').eq('coptic_year', 1743).order('gregorian_date'));
  const special = await rows<{ gregorian_date: string }>(worker, 'calendar', 'coptic_date_conversions', (q) => q.select('gregorian_date')
    .in('coptic_year', [1739, 1740, 1742, 1744]).in('coptic_month', [4, 13]).gte('coptic_day', 1).order('gregorian_date'));
  const dates = [...new Set([
    ...year.map((row) => row.gregorian_date),
    // Kiahk and Nesi of the leap year 1739 and its neighbours (Koiahk 28 and 29 around the Nativity).
    ...special.map((row) => row.gregorian_date).filter((date) => date < '2025-01-01' || date > '2027-09-11'),
    // Lent, Holy Week, Bright Saturday, Easter and Pentecost 2026 (Coptic 1742); Feast of the Cross 2025.
    ...dayRange('2026-02-08', '2026-06-01'), ...dayRange('2025-09-25', '2025-09-30'),
    // A date the calendar doesn't have.
    '1900-01-01',
  ])].sort();

  const cases: Case[] = [];
  for (const date of dates) {
    cases.push(
      { group: 'rpc', name: `calendar.get_active_flags_for_date ${date}`, call: (c) => c.schema('calendar').rpc('get_active_flags_for_date', { p_gregorian_date: date }), normalize: saintsUnordered },
      { group: 'rpc', name: `calendar.get_context_flags ${date}`, call: (c) => c.schema('calendar').rpc('get_context_flags', { p_date: date, p_extra_context: {} }) },
      { group: 'rpc', name: `public.get_readings_for_date ${date}`, call: (c) => c.rpc('get_readings_for_date', { p_date: date }) },
      { group: 'rpc', name: `synaxarium.get_day_json ${date}`, call: (c) => c.schema('synaxarium').rpc('get_day_json', { p_date: date }) },
      { group: 'rpc', name: `public.get_home_synaxarium_events ${date}`, call: (c) => c.rpc('get_home_synaxarium_events', { p_date: date }) },
      { group: 'rpc', name: `public.get_sunday_message ${date}`, call: (c) => c.rpc('get_sunday_message', { p_sunday: date }) },
    );
  }
  for (const date of ['2025-10-01', '2026-10-19', '2027-10-01']) {
    cases.push({ group: 'rpc', name: `public.get_synaxarium_year ${date}`, call: (c) => c.rpc('get_synaxarium_year', { p_reference_date: date }) });
  }
  cases.push(
    { group: 'rpc', name: 'calendar.get_context_flags with extra context', call: (c) => c.schema('calendar').rpc('get_context_flags', { p_date: '2026-10-19', p_extra_context: { BishopPresent: true, Annual: false } }) },
    { group: 'rpc', name: 'calendar.get_context_flags without extra context', call: (c) => c.schema('calendar').rpc('get_context_flags', { p_date: '2027-01-07' }) },
  );
  return cases;
}

/** The saints in get_active_flags_for_date come in no defined order in Postgres: compared as a set, the rest in order. */
function saintsUnordered(data: unknown): unknown {
  if (!Array.isArray(data)) return data;
  const saints = data.filter((row) => row.flag_type === 'saint').map(canonical).sort();
  return { inOrder: data.filter((row) => row.flag_type !== 'saint'), saints };
}

async function bibleCases(): Promise<Case[]> {
  const books = await rows<{ book_key: string; calendar_number: number | null }>(worker, 'bible', 'books', (q) => q.select('book_key, calendar_number'));
  const parts = await rows<{ book_key: string; chapter_number: number; verse_number: number; part_label: string }>(worker, 'bible', 'verse_parts', (q) => q.select('book_key, chapter_number, verse_number, part_label'));
  const aliases = await rows<{ book_key: string; book_number: number }>(worker, 'bible', 'book_number_aliases', (q) => q.select('book_key, book_number').eq('number_system', 'calendar_reference'));
  const numberOf = new Map(aliases.map((alias) => [alias.book_key, alias.book_number]));
  const cases: Case[] = [{ group: 'bible', name: 'public.get_bible_books', call: (c) => c.rpc('get_bible_books') }];
  for (const book of books) cases.push({ group: 'bible', name: `public.get_bible_chapter_list ${book.book_key}`, call: (c) => c.rpc('get_bible_chapter_list', { p_book_key: book.book_key }) });
  for (let n = 0; n <= 90; n += 1) cases.push({ group: 'bible', name: `bible.get_book_key_by_calendar_number ${n}`, call: (c) => c.schema('bible').rpc('get_book_key_by_calendar_number', { p_calendar_number: n }) });
  for (const part of parts) {
    const n = numberOf.get(part.book_key);
    if (n === undefined) continue;
    cases.push({ group: 'bible', name: `bible.get_verse_part_by_calendar ${n} ${part.chapter_number}:${part.verse_number}${part.part_label}`, call: (c) => c.schema('bible').rpc('get_verse_part_by_calendar', { p_calendar_book_number: n, p_chapter: part.chapter_number, p_verse: part.verse_number, p_part_label: part.part_label.toUpperCase() }) });
  }
  cases.push({ group: 'bible', name: 'bible.get_verse_part_by_calendar missing', call: (c) => c.schema('bible').rpc('get_verse_part_by_calendar', { p_calendar_book_number: 19, p_chapter: 1, p_verse: 1, p_part_label: 'z' }) });
  return cases;
}

const SERVICE_TITLE_FIELDS = 'hymn_key, title_english, title_arabic, title_french, category, toggled, prayer_type';
const SERVICE_TEXT_FIELDS = 'hymn_key, line_order, english, coptic, arabic, french, person_type, prayer_type, condition, item_type, inline_hymn_key, inline_hymn_title_shown, inline_hymn_minimization';
const FALLBACK_SCHEMAS = ['public', 'liturgy', 'psalmody', 'agpeya', 'veneration', 'doxologies', 'litanies'];

/** Every order table read as hymnLibrary.js's fetchServiceRows reads it. */
async function documentCases(): Promise<Case[]> {
  const publicTables = contentSchema.tables.filter((table) => table.public);
  const has = (schema: string, table: string) => publicTables.some((t) => t.schema === schema && t.table === table);
  const orderTables = publicTables.filter((table) => table.columns.some((c) => c.name === 'item_order') && table.columns.some((c) => c.name === 'hymn_key'));
  const cases: Case[] = [];
  for (const table of orderTables) {
    cases.push({ group: 'documents', name: `${table.schema}.${table.table} order rows`, call: (c) => c.schema(table.schema).from(table.table).select('*').order('item_order', { ascending: true }) });
    const orderRows = await rows<{ hymn_key: string | null }>(worker, table.schema, table.table, (q) => q.select('hymn_key'));
    const keys = [...new Set(orderRows.map((row) => row.hymn_key).filter((key): key is string => Boolean(key)))];
    const lookupSchemas = [...new Set([table.schema, ...FALLBACK_SCHEMAS, ...(table.schema === 'liturgy' && table.table === 'sermon_planner' ? ['gospel_rite'] : [])])];
    for (const schema of lookupSchemas) {
      for (let i = 0; i < keys.length; i += 100) {
        const batch = keys.slice(i, i + 100);
        if (has(schema, 'hymn_titles')) {
          cases.push({ group: 'documents', name: `${table.schema}.${table.table} titles from ${schema} (${i})`, unordered: true, call: (c) => c.schema(schema).from('hymn_titles').select(SERVICE_TITLE_FIELDS).in('hymn_key', batch) });
        }
        if (has(schema, 'hymn_texts')) {
          cases.push({ group: 'documents', name: `${table.schema}.${table.table} texts from ${schema} (${i})`, ties: ['hymn_key', 'line_order'], call: (c) => c.schema(schema).from('hymn_texts').select(SERVICE_TEXT_FIELDS).in('hymn_key', batch).order('hymn_key', { ascending: true }).order('line_order', { ascending: true }) });
        }
      }
    }
  }
  return cases;
}

/** The app's other table reads, with their filters. */
async function queryCases(): Promise<Case[]> {
  const q = (name: string, call: Call, unordered = false): Case => ({ group: 'queries', name, call, unordered });
  const cases: Case[] = [
    q('coptic_date_conversions by day, maybeSingle', (c) => c.schema('calendar').from('coptic_date_conversions').select('coptic_year, coptic_month, coptic_month_name, coptic_day, weekday_number, sunday_ordinal_in_coptic_month').eq('gregorian_date', '2026-10-19').maybeSingle()),
    q('coptic_date_conversions month range', (c) => c.schema('calendar').from('coptic_date_conversions').select('gregorian_date, gregorian_day, weekday, sunday_ordinal_in_coptic_month, coptic_day, coptic_month_name').gte('gregorian_date', '2026-12-01').lte('gregorian_date', '2026-12-31').order('gregorian_date')),
    q('coptic_date_conversions coptic month', (c) => c.schema('calendar').from('coptic_date_conversions').select('gregorian_date').eq('coptic_year', 1743).eq('coptic_month', 13).order('gregorian_date')),
    q('coptic_date_conversions single', (c) => c.schema('calendar').from('coptic_date_conversions').select('gregorian_date, coptic_month_name, coptic_day, coptic_year').eq('gregorian_date', '2027-01-07').single()),
    q('coptic_date_conversions single, none', (c) => c.schema('calendar').from('coptic_date_conversions').select('gregorian_date').eq('gregorian_date', '1800-01-01').single()),
    q('coptic_date_conversions limit 1 desc', (c) => c.schema('calendar').from('coptic_date_conversions').select('gregorian_date').lte('gregorian_date', '2026-10-19').eq('weekday', 'Sunday').order('gregorian_date', { ascending: false }).limit(1)),
    q('season_ranges around a day', (c) => c.schema('calendar').from('season_ranges').select('range_key, active_season, start_date, end_date, start_event, end_event').lte('start_date', '2027-04-30').gte('end_date', '2027-04-01').order('start_date')),
    q('season_ranges by key', (c) => c.schema('calendar').from('season_ranges').select('range_key, start_date, end_date').eq('range_key', 'lent').order('start_date', { ascending: false }).limit(3)),
    q('reading_rules for a day', (c) => c.schema('calendar').from('reading_rules').select('reading_rule_id, cycle_type, priority, service, reading_type, reading_code, reading_reference, sunday_message').eq('cycle_type', 'AnnualDaily').eq('coptic_month', 2).eq('coptic_day', 9), true),
    q('reading_rules Nesi Sunday', (c) => c.schema('calendar').from('reading_rules').select('service, priority, cycle_type, reading_code, reading_type, reading_reference').eq('coptic_month', 13).eq('sunday_ordinal', 1).eq('day_of_week', 0), true),
    q('reading_rules Great Lent ordered', (c) => c.schema('calendar').from('reading_rules').select('*').eq('cycle_type', 'GreatLent').order('lent_week').order('service').order('reading_type').order('reading_code').order('reading_rule_id')),
    q('condition_flags', (c) => c.schema('calendar').from('condition_flags').select('flag_key, title_english'), true),
    q('saint_order', (c) => c.from('saint_order').select('flag_key, sort_order'), true),
    q('bible books ordered', (c) => c.schema('bible').from('books').select('*').order('book_order')),
    q('bible book by key', (c) => c.schema('bible').from('books').select('title_english, title_arabic, title_french').eq('book_key', 'psalms').maybeSingle()),
    q('bible chapter', (c) => c.schema('bible').from('verses').select('*').eq('book_key', 'psalms').eq('chapter_number', 118).order('verse_id')),
    q('bible chapter by verse_number text order', (c) => c.schema('bible').from('verses').select('verse_number, english').eq('book_key', 'john').eq('chapter_number', 1).order('verse_number')),
    q('bible verse range', (c) => c.schema('bible').from('verses').select('chapter_number, verse_number, english, coptic, arabic, french').eq('book_key', 'matthew').gte('chapter_number', 5).lte('chapter_number', 6).order('chapter_number').order('verse_id')),
    q('bible verses in list', (c) => c.schema('bible').from('verses').select('verse_id, verse_number, arabic').eq('book_key', 'psalms').eq('chapter_number', 109).in('verse_number', ['4', '5', '7']).order('verse_id')),
    q('verse_parts', (c) => c.schema('bible').from('verse_parts').select('*').eq('book_key', 'psalms').order('chapter_number').order('verse_number').order('part_label')),
    q('holy_week reading_rules', (c) => c.schema('holy_week').from('reading_rules').select('reading_rule_id, reading_type, title_english, title_arabic, book_key, reading_reference, psalm_hymn_key, sort_order').eq('hour_key', 'monday_eve_first_hour').order('sort_order')),
    q('holy_week reading_rules all ordered', (c) => c.schema('holy_week').from('reading_rules').select('*').order('hour_key').order('sort_order')),
    q('veneration texts by condition', (c) => c.schema('veneration').from('hymn_texts').select('line_order, condition').ilike('condition', '%StMark%'), true),
    q('doxologies by condition', (c) => c.schema('doxologies').from('doxologies').select('item_order, hymn_key, condition').ilike('condition', '%stmark%'), true),
    q('psalies_saints by condition', (c) => c.schema('psalmody').from('psalies_saints').select('item_order, hymn_key, condition').ilike('condition', '%StGeorge%'), true),
    q('hymn_titles by text order', (c) => c.schema('psalmody').from('hymn_titles').select('hymn_key, title_english').order('title_english').limit(300)),
    q('hymn_titles by text order desc nulls', (c) => c.schema('liturgy').from('hymn_titles').select('hymn_key, category').order('category', { ascending: false }).order('hymn_key')),
    q('hymn_texts by enum', (c) => c.schema('liturgy').from('hymn_texts').select('line_id, person_type').order('person_type').order('line_id').limit(500)),
    q('a table that does not exist', (c) => c.schema('liturgy').from('not_a_table').select('*')),
    q('a column that does not exist', (c) => c.schema('liturgy').from('hymn_titles').select('nope')),
  ];
  return cases;
}

/** bible.search_verses, as bibleSearch.ts calls it, over a corpus of queries and options. */
async function searchCases(): Promise<Case[]> {
  const queries: [string, string[] | null][] = [
    ['love', null], ['mercy love', null], ['God', null], ['the', null], ['the and of', ['english']], ['Lord have mercy', null],
    ['in the beginning was the word', null], ['bapti', null], ['shepherd', ['english', 'english_nkjv']], ['Jerusalem', null],
    ['God-fearing', null], ['a-whoring', ['english']], ['Adoni-Bezek', null], ['666', null], ['7', null], ['up.In', ['english_from_coptic']],
    ['"my shepherd" -want', null], ['love or mercy', null], ['-sin', ['english_from_coptic']], ['peace "be with you"', null], ['""', null],
    ['الله', null], ['اللَّهُ', null], ['المسيح يسوع', ['arabic', 'arabic_from_coptic']], ['محبة', null], ['إله', null], ['أحب', null], ['السلام عليكم', null],
    ['Ⲡⲟ̅ⲥ̅', null], ['ⲛⲁⲓ', null], ['Ⲓⲏ̅ⲥ̅ Ⲡⲭ̅ⲥ̅', ['coptic']], ['ⲉⲃⲟⲗ', null], ['ⲟⲩ-ⲉⲃⲟⲗ', ['coptic']],
    ['θεός', null], ['Θεος', ['greek']], ['ἀγάπη', null], ['εις', ['greek']], ['Χριστοῦ Ἰησοῦ', null], ['κύριος', null],
    ['Dieu', null], ['amour', ['french']], ['l\'Éternel', null], ['être', null], ['Jésus-Christ', null], ['à', ['french']], ['bœuf', null],
    ['  spaced   words  ', null], ['love!', null], ['(love)', null], ['love & mercy', null], ['love | mercy', null], ['<->', null], ['!', null],
    ['', null], ['   ', null], ['xyzzyplugh', null], ['Love LOVE love', null], ['loving kindness', null], ['generations', null], ['cities', null],
  ];
  const variants = [
    { mode: 'all', prefix: false, sort: 'relevance' },
    { mode: 'any', prefix: false, sort: 'relevance' },
    { mode: 'phrase', prefix: false, sort: 'relevance' },
    { mode: 'websearch', prefix: false, sort: 'canonical' },
    { mode: 'all', prefix: true, sort: 'relevance' },
    { mode: 'any', prefix: true, sort: 'canonical' },
  ];
  const cases: Case[] = [];
  for (const [query, languages] of queries) {
    for (const variant of variants) {
      cases.push({
        group: 'search',
        name: `search_verses ${JSON.stringify(query)} ${variant.mode}${variant.prefix ? ' prefix' : ''} ${variant.sort}${languages ? ' ' + languages.join('+') : ''}`,
        call: (c) => c.schema('bible').rpc('search_verses', { p_query: query, p_languages: languages, p_mode: variant.mode, p_prefix: variant.prefix, p_testament: null, p_book_keys: null, p_sort: variant.sort, p_limit: 25, p_offset: 0 }),
      });
    }
  }
  // Filters and paging.
  const filtered = [
    { p_query: 'love', p_testament: 'NT', p_offset: 0 }, { p_query: 'love', p_testament: 'OT', p_offset: 25 },
    { p_query: 'God', p_book_keys: ['psalms', 'john'], p_offset: 0 }, { p_query: 'God', p_book_keys: [], p_offset: 100 },
    { p_query: 'mercy', p_limit: 100, p_offset: 0 }, { p_query: 'mercy', p_limit: 0, p_offset: -5 }, { p_query: 'mercy', p_limit: 500, p_offset: 1000000 },
    { p_query: 'الرب', p_limit: 100, p_offset: 200, p_sort: 'canonical' }, { p_query: 'ⲡⲟⲥ', p_limit: 50, p_prefix: true },
  ];
  for (const options of filtered) {
    cases.push({ group: 'search', name: `search_verses ${JSON.stringify(options)}`, call: (c) => c.schema('bible').rpc('search_verses', { p_languages: null, p_mode: 'all', p_prefix: false, p_testament: null, p_book_keys: null, p_sort: 'relevance', p_limit: 25, p_offset: 0, ...options }) });
  }
  return cases;
}

/** Every public table, all of it, in PostgREST's pages of 1000. */
async function tableCases(): Promise<Case[]> {
  const cases: Case[] = [];
  for (const table of contentSchema.tables.filter((t: TableInfo) => t.public)) {
    const { count } = await supabase.schema(table.schema).from(table.table).select('*', { count: 'exact', head: true });
    for (let offset = 0; offset < (count ?? 0); offset += 1000) {
      cases.push({ group: 'tables', name: `${table.schema}.${table.table} rows ${offset}`, call: (c) => {
        let query: any = c.schema(table.schema).from(table.table).select('*');
        for (const key of table.rowKey) query = query.order(key, { ascending: true });
        return query.range(offset, offset + 999);
      } });
    }
  }
  return cases;
}

/** Tables Supabase packages that D1 doesn't copy (plan section 4.1). */
const NOT_COPIED = /^(entries_old|entry_texts_old|entry_texts_split|entry_texts_align_map|entry_texts_deferred_review|entry_texts_rubric_strip|entries_rematch_proposal|arabic_orphans|gospel_responses_old|hymn_texts_old)$/;

async function packageCases(): Promise<Case[]> {
  type Plan = { books: unknown[]; dependencies: unknown[]; resources: { id: string; schema: string; tables: string[] }[] };
  const withoutLegacy = (data: unknown) => {
    const plan = data as Plan;
    return plan && { ...plan, resources: plan.resources.map((r) => ({ ...r, tables: r.tables.filter((name) => !NOT_COPIED.test(name)) })) };
  };
  const cases: Case[] = [{ group: 'packages', name: 'get_offline_package_plan', call: (c) => c.rpc('get_offline_package_plan'), normalize: withoutLegacy }];
  const { data } = await worker.rpc('get_offline_package_plan');
  for (const resource of (data as Plan).resources) {
    for (const table of resource.tables) {
      if (resource.id === 'bible' && table === 'verses') continue;
      cases.push({
        group: 'packages',
        name: `get_offline_table_rows ${resource.id}.${table}`,
        unordered: true,
        call: async (c) => {
          const rows: Record<string, unknown>[] = [];
          let after: string | null = null;
          for (;;) {
            const { data: pageData, error } = await c.rpc('get_offline_table_rows', { p_resource: resource.id, p_table: table, p_after: after, p_limit: 500 });
            if (error) return { data: null, error };
            const { rows: pageRows, after: next } = pageData as { rows: Record<string, unknown>[]; after: string | null };
            rows.push(...pageRows);
            if (!next || pageRows.length < 500) break;
            after = next;
          }
          return { data: rows, error: null };
        },
      });
    }
  }
  return cases;
}

// ─── Running them ────────────────────────────────────────────────────────

/** Columns D1 doesn't copy (the tsvector ones) are left out of Supabase's answers. */
const DROPPED = new Set(contentSchema.tables.flatMap((table) => table.dropped));
function withoutDropped(data: unknown): unknown {
  if (Array.isArray(data)) return data.map(withoutDropped);
  if (data && typeof data === 'object') return Object.fromEntries(Object.entries(data).filter(([key]) => !DROPPED.has(key)));
  return data;
}

async function main() {
  const builders: Record<string, () => Promise<Case[]>> = { rpc: rpcCases, bible: bibleCases, documents: documentCases, queries: queryCases, search: searchCases, tables: tableCases, packages: packageCases };
  const cases: Case[] = [];
  for (const group of Object.keys(builders)) if (GROUPS.has(group)) cases.push(...(await builders[group]()));
  console.log(`${cases.length} cases against ${WORKER_URL}…`);

  const failures: { group: string; name: string; supabase: unknown; worker: unknown }[] = [];
  const totals = new Map<string, { run: number; failed: number }>();
  const started = Date.now();
  let done = 0;
  // A request that never got an answer (supabase-js reports it as "fetch failed") says nothing about content: ask again.
  const answer = async (testCase: Case, client: SupabaseClient) => {
    for (let attempt = 1; ; attempt += 1) {
      const result = await testCase.call(client);
      if (attempt === 3 || !/fetch failed/.test((result.error as { message?: string } | null)?.message ?? '')) return result;
    }
  };
  await pool(cases, CONCURRENCY, async (testCase) => {
    const [a, b] = await Promise.all([answer(testCase, supabase), answer(testCase, worker)]);
    const ties = testCase.ties;
    const normalize = testCase.normalize ?? (ties ? (data: unknown) => sortTies(data, ties) : (data: unknown) => data);
    const left = { data: normalize(withoutDropped(a.data)), error: errorOf(a.error) };
    const right = { data: normalize(b.data), error: errorOf(b.error) };
    // Postgres giving up (statement timeout) while the Worker answers isn't a difference in content.
    if ((a.error as { code?: string } | null)?.code === '57014' && !b.error) {
      const total = totals.get(`${testCase.group} (Supabase timed out)`) ?? { run: 0, failed: 0 };
      total.run += 1;
      totals.set(`${testCase.group} (Supabase timed out)`, total);
      done += 1;
      return;
    }
    const ok = sameJson(left.error, right.error) && sameJson(left.data, right.data, testCase.unordered);
    const total = totals.get(testCase.group) ?? { run: 0, failed: 0 };
    total.run += 1;
    if (!ok) { total.failed += 1; failures.push({ group: testCase.group, name: testCase.name, supabase: left, worker: right }); }
    totals.set(testCase.group, total);
    done += 1;
    if (done % 250 === 0) console.log(`  ${done}/${cases.length}, ${failures.length} different`);
  });

  const lines = [
    `Parity run ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC: Supabase against ${WORKER_URL}, ${((Date.now() - started) / 1000).toFixed(0)} s.`,
    '',
    '| Group | Cases | Same | Different |',
    '|---|---:|---:|---:|',
    ...[...totals].map(([group, total]) => `| ${group} | ${total.run} | ${total.run - total.failed} | ${total.failed} |`),
    '',
  ];
  for (const failure of failures.slice(0, 40)) {
    lines.push(`### ${failure.name}`, '', '```', `Supabase: ${JSON.stringify(failure.supabase).slice(0, 1500)}`, `Worker:   ${JSON.stringify(failure.worker).slice(0, 1500)}`, '```', '');
  }
  const report = lines.join('\n');
  const reportFile = option('--report');
  if (reportFile) writeFileSync(reportFile, report);
  if (option('--failures')) writeFileSync(option('--failures')!, JSON.stringify(failures, null, 1));
  console.log(report.split('\n').slice(0, 4 + totals.size + 1).join('\n'));
  if (failures.length) {
    console.log(`${failures.length} different; first: ${failures.slice(0, 10).map((f) => f.name).join('; ')}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error); process.exit(1); });
}
