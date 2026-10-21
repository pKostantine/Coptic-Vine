/**
 * The catalog search: ports of public.search_media_catalog (the app's search
 * across music and learning) and public.search_section_catalog (one section,
 * with a cap on each kind) (schema/pg-user-schema.sql). Each published
 * document of the unified catalog scores by the best of its title, its full
 * text, a substring or trigram match of its normalized text and its entity's
 * aliases, plus a little for the reader's language; each entity keeps its
 * best document and shows in the reader's language where it has one.
 * Checked by tests/search.parity.test.ts and scripts/search-parity.ts.
 */
import { col, t } from '../../../../content-api/src/db/names.ts';
import { matches } from '../../../../content-api/src/search/execute.ts';
import { rankCd } from '../../../../content-api/src/search/rank.ts';
import { websearchToTsquery } from '../../../../content-api/src/search/tsquery.ts';
import { setweight, toTsvector, tsvectorConcat, WEIGHT, type TsVector } from '../../../../content-api/src/search/tsvector.ts';
import { roundNumeric } from '../../pg.ts';
import type { ApiContext } from '../../rest/context.ts';
import { all, order, payload, type Row } from '../common.ts';
import { normalizeSearchText, similarity, trigrams } from './text.ts';

/** Each function's scores: exact, prefix and substring matches, and a base plus a multiple of the rank or similarity. */
type Scoring = {
  title: { exact: number; prefix: number; substring: number };
  alias: { exact: number; prefix: number; substring: number; base: number; scale: number };
  fullText: { base: number; scale: number };
  text: { substring: number; base: number; scale: number };
  threshold: number;
  locale: { reader: number; english: number };
  /** search_section_catalog: a title substring admits a document and is its own "substring" match. */
  titleSubstring: boolean;
};

const MEDIA: Scoring = {
  title: { exact: 120, prefix: 96, substring: 78 },
  alias: { exact: 116, prefix: 92, substring: 72, base: 35, scale: 30 },
  fullText: { base: 62, scale: 28 },
  text: { substring: 58, base: 20, scale: 35 },
  threshold: 0.2,
  locale: { reader: 4, english: 1 },
  titleSubstring: false,
};

const SECTION: Scoring = {
  title: { exact: 220, prefix: 188, substring: 154 },
  alias: { exact: 210, prefix: 178, substring: 145, base: 62, scale: 58 },
  fullText: { base: 82, scale: 38 },
  text: { substring: 68, base: 34, scale: 54 },
  threshold: 0.25,
  locale: { reader: 5, english: 2 },
  titleSubstring: true,
};

/** search_section_catalog keeps at most this many results of each kind. */
const SECTION_CAPS: Record<string, number> = {
  music_artist: 8, music_release: 12, music_track: 28,
  learning_cantor: 8, learning_season: 8, learning_hymn: 16, learning_album: 12, learning_lesson: 24,
};

/** entity_type LIKE 'music_%': "_" is LIKE's any character, so the prefix and at least one more. */
const likePrefix = (value: string, prefix: string) => value.startsWith(prefix) && [...value].length > [...prefix].length;

const entityKey = (row: Row) => `${row.entity_type}\u0000${row.entity_id}`;

/** (value = target) as an ORDER BY … DESC key: null first, then true, then false. */
const equalFirst = (a: unknown, b: unknown, target: unknown) => {
  const key = (value: unknown) => (value == null || target == null ? 2 : value === target ? 1 : 0);
  return key(b) - key(a);
};

/** search_vector, as private.refresh_unified_search_index builds it: title A, subtitle B, body C. */
export function documentVector(document: Row): TsVector {
  const part = (text: unknown, weight: number) => setweight(toTsvector('simple', normalizeSearchText(text as string | null)), weight);
  return tsvectorConcat(tsvectorConcat(part(document.title, WEIGHT.A), part(document.subtitle, WEIGHT.B)), part(document.body, WEIGHT.C));
}

type Candidate = { document: Row; rank: number; matchedBy: string };
type Result = Candidate & { display: Row };

async function searchCatalog(ctx: ApiContext, rawQuery: string | null, locale: string | null, scope: 'all' | 'music' | 'learning', scoring: Scoring): Promise<Result[]> {
  const query = normalizeSearchText(rawQuery);
  if (query === '') return [];
  const tsquery = websearchToTsquery('simple', query);
  const queryTrigrams = trigrams(query);
  const similar = (text: string) => similarity(trigrams(text), queryTrigrams);

  const aliases = new Map<string, { score: number; exact: boolean }>();
  const aliasRows = await all(ctx, `SELECT ${col('entity_type')}, ${col('entity_id')}, ${col('normalized_alias')} FROM ${t('media', 'search_aliases')} WHERE ${col('publication_status')} = 'published'`);
  for (const alias of aliasRows) {
    const text = alias.normalized_alias as string | null;
    if (text == null) continue;
    const s = scoring.alias;
    let score: number;
    if (text.includes(query)) score = text === query ? s.exact : text.startsWith(query) ? s.prefix : s.substring;
    else {
      const value = similar(text);
      if (!(value >= scoring.threshold)) continue;
      score = s.base + value * s.scale;
    }
    const seen = aliases.get(entityKey(alias));
    aliases.set(entityKey(alias), { score: Math.max(seen?.score ?? score, score), exact: (seen?.exact ?? false) || text === query });
  }

  const documents = await all(ctx, `SELECT * FROM ${t('media', 'search_documents')} WHERE ${col('kind')} = 'unified_catalog' AND ${col('publication_status')} = 'published'`);
  const inScope = (type: string) => scope === 'all' || likePrefix(type, scope);
  const candidates: Candidate[] = [];
  for (const document of documents) {
    if (!inScope(document.entity_type as string)) continue;
    const title = normalizeSearchText(document.title as string | null);
    const text = document.normalized_text as string | null;
    const alias = aliases.get(entityKey(document));
    const vector = documentVector(document);
    const fullText = matches(vector, tsquery);
    const titleSubstring = title.includes(query);
    const textSubstring = text != null && text.includes(query);
    const textSimilarity = text != null && !textSubstring ? similar(text) : null;
    const admitted = (scoring.titleSubstring && titleSubstring) || textSubstring || fullText || (textSimilarity !== null && textSimilarity >= scoring.threshold) || alias !== undefined;
    if (!admitted) continue;

    const scores = [
      title === query ? scoring.title.exact : title.startsWith(query) ? scoring.title.prefix : titleSubstring ? scoring.title.substring : 0,
      fullText ? scoring.fullText.base + rankCd(vector, tsquery, 0) * scoring.fullText.scale : 0,
      alias?.score ?? 0,
    ];
    if (text != null) scores.push(textSubstring ? scoring.text.substring : scoring.text.base + textSimilarity! * scoring.text.scale);
    const rank = Math.max(...scores) + (locale != null && document.locale === locale ? scoring.locale.reader : document.locale === 'en' ? scoring.locale.english : 0);
    const matchedBy = title === query ? 'title_exact'
      : alias?.exact ? 'alias_exact'
      : title.startsWith(query) ? 'title_prefix'
      : scoring.titleSubstring && titleSubstring ? 'substring'
      : alias ? 'alias'
      : fullText ? 'full_text'
      : textSubstring ? 'substring'
      : 'similarity';
    candidates.push({ document, rank, matchedBy });
  }

  // Each entity's best document: the highest rank, then the reader's language, English, and by locale.
  const best = new Map<string, Candidate>();
  const better = (a: Candidate, b: Candidate) => b.rank - a.rank || equalFirst(a.document.locale, b.document.locale, locale)
    || equalFirst(a.document.locale, b.document.locale, 'en') || order.text(a.document.locale, b.document.locale);
  for (const candidate of candidates) {
    const key = entityKey(candidate.document);
    const held = best.get(key);
    if (!held || better(candidate, held) < 0) best.set(key, candidate);
  }

  // Shown in the reader's language, else English, else the matched document's, else by locale.
  const byEntity = new Map<string, Row[]>();
  for (const document of documents) {
    const list = byEntity.get(entityKey(document)) ?? [];
    list.push(document);
    byEntity.set(entityKey(document), list);
  }
  return [...best.values()].map((candidate) => {
    const matched = candidate.document.locale;
    const [display] = [...byEntity.get(entityKey(candidate.document))!].sort((a, b) => equalFirst(a.locale, b.locale, locale)
      || equalFirst(a.locale, b.locale, 'en') || equalFirst(a.locale, b.locale, matched) || order.text(a.locale, b.locale));
    return { ...candidate, display };
  });
}

const byRank = (a: Result, b: Result) => b.rank - a.rank || order.text(a.display.title, b.display.title);

function answer(rawQuery: string | null, scope: string, results: Result[]): unknown {
  return payload({
    query: rawQuery ?? '',
    normalizedQuery: normalizeSearchText(rawQuery),
    scope,
    results: results.map(({ document, display, matchedBy, rank }) => ({
      domain: likePrefix(document.entity_type as string, 'music') ? 'music' : 'learning',
      kind: document.entity_type,
      entityId: document.entity_id,
      title: display.title,
      subtitle: display.subtitle,
      body: display.body,
      metadata: JSON.parse(display.metadata as string),
      matchedBy,
      matchedLocale: document.locale,
      displayLocale: display.locale,
      rank: roundNumeric(rank, 3),
    })),
  });
}

/** greatest(1, least(coalesce(p_limit, fallback), most)). */
const clampLimit = (limit: number | null, fallback: number, most: number) => Math.max(1, Math.min(limit ?? fallback, most));

export async function searchMediaCatalog(ctx: ApiContext, query: string | null, locale: string | null, scope: string | null, limit: number | null): Promise<unknown> {
  const lowered = (scope ?? 'all').toLowerCase();
  const chosen = lowered === 'music' || lowered === 'learning' ? lowered : 'all';
  const results = await searchCatalog(ctx, query, locale, chosen, MEDIA);
  return answer(query, chosen, results.sort(byRank).slice(0, clampLimit(limit, 60, 100)));
}

export async function searchSectionCatalog(ctx: ApiContext, query: string | null, locale: string | null, section: string | null, limit: number | null): Promise<unknown> {
  const chosen = (section ?? 'music').toLowerCase() === 'learning' ? 'learning' : 'music';
  const results = (await searchCatalog(ctx, query, locale, chosen, SECTION)).sort(byRank);
  const kept = new Map<string, number>();
  const diverse = results.filter((result) => {
    const type = result.document.entity_type as string;
    const count = (kept.get(type) ?? 0) + 1;
    kept.set(type, count);
    return count <= (SECTION_CAPS[type] ?? 12);
  });
  return answer(query, chosen, diverse.slice(0, clampLimit(limit, 48, 80)));
}
