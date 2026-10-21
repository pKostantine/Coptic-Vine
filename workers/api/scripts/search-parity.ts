/**
 * The catalog search on real data: every query below sent to Supabase's
 * search_media_catalog and search_section_catalog (the anon key, read only)
 * and to the port (src/rpc/search) over a D1 copy, and the answers compared
 * whole: results, order, matchedBy and rank.
 *
 *   npm run search-parity [-- path/to/d1.sqlite]
 *
 * The copy defaults to the local D1 (wrangler dev --persist-to
 * ../content-api/.wrangler/state). It must hold the same media.search_documents
 * and media.search_aliases as Supabase, or the answers differ for that reason.
 */
import { isDeepStrictEqual } from 'node:util';
import { readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { loadEnv } from '../../content-api/scripts/lib/env.ts';
import { callRpc, type Args } from '../src/rpc/index.ts';
import type { Env } from '../src/types.ts';
import { d1 } from '../tests/lib/d1.ts';

const QUERIES: (string | null)[] = [
  'Tharwat', 'tharwat nady', 'Cantor Tharwat Nady', 'feast', 'Feast of the', 'lent', 'great lent', 'Great Lent', 'resurection', 'resurrection',
  'kiahk', 'psalmody', 'annual psalmody', 'gospel bishop', 'agapy', 'Ee Aghapy', 'aghapy', 'pierre', 'Pierre Kostantine', 'liturgy',
  'basilian', 'peace', 'cross', 'holy week', 'incense', 'raising', 'teen', 'anastaseen', 'Teen Anastaseen', 'pentecost', 'ascension',
  'O My Saviour', 'saviour feet', 'at your feet', 'gawargious', 'fr', 'Fr.', 'temple', 'entry christ', 'introduction', 'the', 'of', 'a',
  'or', 'feast or lent', 'lent -great', '"holy week"', 'x', 'zzzz', 'qwertyuiop', '', '   ', '!!!', null,
  'كيهك', 'صوم', 'الميلاد', 'صوم الميلاد', 'فليرفعوه', 'برامون', 'أحد الشعانين', 'احد الشعانين', 'نيسافيف', 'نيسافيف تيرو', 'الرسل', 'عيد',
  'الغطاس', 'برامون الغطاس', 'تاي شوري', 'الهيتنيات', 'Lent صوم', 'ⲡⲓⲭⲣⲓⲥⲧⲟⲥ', 'Ⲧⲉⲛⲟⲩⲱϣⲧ', 'Père', 'église', 'tasbeha',
];

type Call = { fn: 'search_media_catalog' | 'search_section_catalog'; args: Args };
const CALLS: Call[] = [];
for (const q of QUERIES) {
  CALLS.push({ fn: 'search_media_catalog', args: { p_query: q } });
  CALLS.push({ fn: 'search_media_catalog', args: { p_query: q, p_locale: 'ar', p_scope: 'learning' } });
  CALLS.push({ fn: 'search_media_catalog', args: { p_query: q, p_locale: 'fr', p_scope: 'music', p_limit: 5 } });
  CALLS.push({ fn: 'search_section_catalog', args: { p_query: q } });
  CALLS.push({ fn: 'search_section_catalog', args: { p_query: q, p_locale: 'ar', p_section: 'learning' } });
}
for (const q of ['feast', 'lent', 'صوم', 'the']) {
  CALLS.push({ fn: 'search_media_catalog', args: { p_query: q, p_locale: null, p_scope: null, p_limit: null } });
  CALLS.push({ fn: 'search_media_catalog', args: { p_query: q, p_scope: 'MUSIC', p_limit: 1 } });
  CALLS.push({ fn: 'search_media_catalog', args: { p_query: q, p_scope: 'bogus', p_limit: 0 } });
  CALLS.push({ fn: 'search_media_catalog', args: { p_query: q, p_locale: 'cop', p_limit: 500 } });
  CALLS.push({ fn: 'search_section_catalog', args: { p_query: q, p_section: 'LEARNING', p_limit: -3 } });
  CALLS.push({ fn: 'search_section_catalog', args: { p_query: q, p_section: null, p_locale: null, p_limit: 200 } });
}

function localDatabase(): string {
  const dir = new URL('../../content-api/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/', import.meta.url).pathname;
  const file = readdirSync(dir).find((name) => name.endsWith('.sqlite'));
  if (!file) throw new Error(`No local D1 database in ${dir}`);
  return dir + file;
}

const env = loadEnv();
const url = env('EXPO_PUBLIC_SUPABASE_URL');
const key = env('EXPO_PUBLIC_SUPABASE_ANON_KEY');
const db = new DatabaseSync(process.argv[2] ?? localDatabase(), { readOnly: true });
const ctx = { db: d1(db), env: {} as Env, userId: null };

async function supabase(call: Call): Promise<unknown> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const response = await fetch(`${url}/rest/v1/rpc/${call.fn}`, {
        method: 'POST', headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json', 'content-profile': 'public' }, body: JSON.stringify(call.args),
      });
      if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
      return await response.json();
    } catch (error) {
      if (attempt === 3) throw error;
    }
  }
}

type Answer = { results: Record<string, unknown>[] } & Record<string, unknown>;
const tie = (r: Record<string, unknown>) => JSON.stringify([r.rank, r.title]);

/**
 * Postgres leaves the order of results with the same rank and title (a release
 * and its title track, say) to its plan, so those may come in either order.
 * True when the answers differ by no more than that.
 */
function sameButTies(expected: Answer, actual: Answer): boolean {
  const { results: e, ...eRest } = expected;
  const { results: a, ...aRest } = actual;
  if (!isDeepStrictEqual(eRest, aRest) || e.length !== a.length) return false;
  for (let start = 0; start < e.length;) {
    let end = start + 1;
    while (end < e.length && tie(e[end]) === tie(e[start])) end += 1;
    const group = a.slice(start, end);
    if (group.some((r) => tie(r) !== tie(e[start]))) return false;
    if (!e.slice(start, end).every((r) => group.some((g) => isDeepStrictEqual(g, r)))) return false;
    start = end;
  }
  return true;
}

let failures = 0;
let tieOrders = 0;
const queue = [...CALLS];
await Promise.all(Array.from({ length: 6 }, async () => {
  for (let call = queue.shift(); call; call = queue.shift()) {
    const [expected, { result }] = await Promise.all([supabase(call), callRpc(ctx, 'public', call.fn, call.args)]);
    const actual = JSON.parse(JSON.stringify(result));
    if (isDeepStrictEqual(actual, expected)) continue;
    if (sameButTies(expected as Answer, actual as Answer)) { tieOrders += 1; continue; }
    failures += 1;
    console.log(`MISMATCH ${call.fn} ${JSON.stringify(call.args)}`);
    for (const [side, answer] of [['supabase', expected], ['worker  ', actual]] as const) {
      const { results, ...rest } = answer as Answer;
      console.log(`  ${side} ${JSON.stringify(rest)} ${results.map((r) => `${r.kind}:${String(r.entityId).slice(0, 8)}:${r.displayLocale}:${r.matchedBy}:${r.rank}`).join(' ')}`);
    }
  }
}));
console.log(`${CALLS.length - failures} of ${CALLS.length} calls match (${tieOrders} of them with tied results in another order)`);
process.exitCode = failures ? 1 : 0;
