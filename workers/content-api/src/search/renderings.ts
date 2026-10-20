/**
 * The eight searchable renderings of a verse and how bible.search_verses
 * prepares each one: which column, which text-search configuration, and what
 * the text (and the query) goes through first.
 */
import { searchLiteralNormalize, unaccent } from './normalize.ts';
import { toTsvector, type Config, type TsVector } from './tsvector.ts';

export type Language = 'english' | 'english_nkjv' | 'english_from_coptic' | 'coptic' | 'greek' | 'arabic' | 'arabic_from_coptic' | 'french';

export type Rendering = {
  language: Language;
  /** The bible.verses column. */
  column: string;
  config: Config;
  /** What the verse text (for its vector) and the query go through first. */
  prepare: (text: string | null) => string | null;
  /**
   * The text search_verses highlights. The same as the vector's, except for
   * French: matched on the normalized text, highlighted on the raw text (so
   * a word with an accent matches but isn't marked).
   */
  headlineBody: (text: string | null) => string | null;
};

const asIs = (text: string | null) => text;
const normalized = (text: string | null) => (text === null ? null : searchLiteralNormalize(text));
/** search_literal_normalize(NULL) is '', never null. */
const normalizedOrEmpty = (text: string | null) => searchLiteralNormalize(text);

/** In display order: the order of matched_languages. */
export const RENDERINGS: Rendering[] = [
  { language: 'english', column: 'english', config: 'english', prepare: asIs, headlineBody: asIs },
  { language: 'english_nkjv', column: 'english_nkjv', config: 'english', prepare: asIs, headlineBody: asIs },
  { language: 'english_from_coptic', column: 'english_from_coptic', config: 'english', prepare: asIs, headlineBody: asIs },
  { language: 'coptic', column: 'coptic', config: 'simple', prepare: unaccent, headlineBody: unaccent },
  { language: 'greek', column: 'greek', config: 'greek', prepare: unaccent, headlineBody: unaccent },
  { language: 'arabic', column: 'arabic', config: 'arabic', prepare: normalized, headlineBody: normalizedOrEmpty },
  { language: 'arabic_from_coptic', column: 'arabic_from_coptic', config: 'arabic', prepare: normalized, headlineBody: normalizedOrEmpty },
  { language: 'french', column: 'french', config: 'french', prepare: normalized, headlineBody: asIs },
];

/**
 * A verse rendering's vector as Postgres stores it: the generated fts_*
 * columns take coalesce(text, ''); bible.verse_search_normalized takes the
 * normalized text (search_literal_normalize already maps null to '').
 */
export function renderingVector(rendering: Rendering, text: string | null): TsVector {
  return toTsvector(rendering.config, rendering.prepare(text ?? '') ?? '');
}
