/**
 * The content RPCs the app calls (docs/d1/phase1-inventory.md, section A),
 * answered as PostgREST answers POST /rest/v1/rpc/<name> with
 * Content-Profile: <schema>: the same arguments, the same JSON.
 *
 */
import { dateArg, int4, PgError } from '../pg.ts';
import type { ContentContext } from '../types.ts';
import { getBibleBooks, getBibleChapterList, getBookKeyByCalendarNumber, getVersePartByCalendar } from './bible.ts';
import { getActiveFlagsForDate, getContextFlags, getReadingsForDate, getSundayMessage, noConversionRow } from './calendar.ts';
import { searchVerses } from './searchVerses.ts';
import { getDayJson, getHomeSynaxariumEvents, getSynaxariumYear } from './synaxarium.ts';

type Args = Record<string, unknown>;
type Rpc = {
  /** Parameter names in order, as Postgres declares them; those with a default may be left out. */
  params: string[];
  defaults?: Args;
  run: (context: ContentContext, args: Args) => Promise<unknown>;
};

const text = (value: unknown) => (value === null || value === undefined ? null : String(value));
const requiredDate = (value: unknown) => dateArg(value) as string;

export const RPCS: Record<string, Record<string, Rpc>> = {
  public: {
    get_readings_for_date: { params: ['p_date'], run: (c, a) => (a.p_date === null ? Promise.resolve([]) : getReadingsForDate(c, requiredDate(a.p_date))) },
    get_sunday_message: { params: ['p_sunday'], run: (c, a) => (a.p_sunday === null ? Promise.resolve(null) : getSundayMessage(c, requiredDate(a.p_sunday))) },
    get_home_synaxarium_events: { params: ['p_date'], run: (c, a) => (a.p_date === null ? Promise.resolve([]) : getHomeSynaxariumEvents(c, requiredDate(a.p_date))) },
    get_synaxarium_year: { params: ['p_reference_date'], run: (c, a) => (a.p_reference_date === null ? Promise.resolve([]) : getSynaxariumYear(c, requiredDate(a.p_reference_date))) },
    get_bible_books: { params: [], run: (c) => getBibleBooks(c) },
    get_bible_chapter_list: { params: ['p_book_key'], run: (c, a) => getBibleChapterList(c, text(a.p_book_key)) },
  },
  calendar: {
    get_active_flags_for_date: { params: ['p_gregorian_date'], run: (c, a) => (a.p_gregorian_date === null ? Promise.resolve([]) : getActiveFlagsForDate(c, requiredDate(a.p_gregorian_date))) },
    get_context_flags: {
      params: ['p_date', 'p_extra_context'],
      defaults: { p_extra_context: {} },
      run: (c, a) => {
        // RAISE prints a null argument as <NULL>.
        if (a.p_date === null) throw noConversionRow(null);
        return getContextFlags(c, requiredDate(a.p_date), a.p_extra_context);
      },
    },
  },
  bible: {
    get_book_key_by_calendar_number: { params: ['p_calendar_number'], run: (c, a) => getBookKeyByCalendarNumber(c, int4(a.p_calendar_number)) },
    get_verse_part_by_calendar: {
      params: ['p_calendar_book_number', 'p_chapter', 'p_verse', 'p_part_label'],
      run: (c, a) => getVersePartByCalendar(c, int4(a.p_calendar_book_number), int4(a.p_chapter), int4(a.p_verse), text(a.p_part_label)),
    },
    search_verses: {
      params: ['p_query', 'p_languages', 'p_mode', 'p_prefix', 'p_testament', 'p_book_keys', 'p_sort', 'p_limit', 'p_offset'],
      defaults: { p_languages: null, p_mode: 'all', p_prefix: false, p_testament: null, p_book_keys: null, p_sort: 'relevance', p_limit: 25, p_offset: 0 },
      run: (c, a) => searchVerses(c, a),
    },
  },
  synaxarium: {
    get_day_json: { params: ['p_date'], run: (c, a) => (a.p_date === null ? Promise.resolve(null) : getDayJson(c, requiredDate(a.p_date))) },
  },
};

/** Calls one RPC with a JSON body of named arguments, as PostgREST does. */
export async function callRpc(context: ContentContext, schema: string, name: string, body: unknown): Promise<unknown> {
  const rpc = RPCS[schema]?.[name];
  const given = body && typeof body === 'object' && !Array.isArray(body) ? (body as Args) : {};
  const names = Object.keys(given);
  const missing = rpc ? rpc.params.filter((param) => !(param in given) && !(rpc.defaults && param in rpc.defaults)) : [];
  if (!rpc || missing.length || names.some((param) => !rpc.params.includes(param))) {
    throw new PgError('PGRST202', `Could not find the function ${schema}.${name}(${names.sort().join(', ')}) in the schema cache`, 404, `Searched for the function ${schema}.${name}${names.length ? ` with parameters ${names.sort().join(', ')}` : ' without parameters'} or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.`);
  }
  const args: Args = { ...(rpc.defaults ?? {}), ...given };
  for (const param of rpc.params) if (args[param] === undefined) args[param] = null;
  return rpc.run(context, args);
}
