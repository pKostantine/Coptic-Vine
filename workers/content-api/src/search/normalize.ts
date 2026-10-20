/**
 * The text normalization Supabase's Bible search applies before indexing and
 * before querying, ported from its SQL:
 *
 *   bible.search_literal_normalize   lower, NFD, strip combining marks (Latin,
 *     Greek and Coptic diacritics, Arabic tashkeel and hamza marks, the dagger
 *     alef, tatweel, Hebrew points, the Coptic jinkim), fold the Greek final
 *     sigma, alef maqsura, alef forms and hamza carriers, then every run of
 *     non-alphanumerics to one space, trimmed.
 *   bible.search_literal_contains    the normalized needle as whole words of the
 *     normalized body.
 *   bible.immutable_unaccent         PostgreSQL's unaccent dictionary.
 *
 * Its lower() and regular expressions use the database's ICU collation, so
 * case folding is full Unicode (String.prototype.toLowerCase) and [[:alnum:]]
 * is ICU's: letters and decimal digits.
 */
import { UNACCENT_RULES } from './unaccent.ts';

const COMBINING = /[̀-ًͯ-ٰٟـ֑-ׇ⳯-⳱]/g;
const FOLD: Record<string, string> = { 'ς': 'σ', 'ى': 'ي', 'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ٱ': 'ا', 'ؤ': 'و', 'ئ': 'ي' };
const NOT_ALNUM = /[^\p{L}\p{Nd}]+/gu;

/** Postgres's btrim(text): spaces only. */
function btrim(value: string): string {
  return value.replace(/^ +| +$/g, '');
}

export function searchLiteralNormalize(text: string | null): string {
  const stripped = (text ?? '').toLowerCase().normalize('NFD').replace(COMBINING, '');
  let folded = '';
  for (const c of stripped) folded += FOLD[c] ?? c;
  return btrim(folded.replace(NOT_ALNUM, ' '));
}

/** A needle of null or '' matches everything; otherwise its words must appear together, at word boundaries. */
export function searchLiteralContains(body: string | null, needle: string | null): boolean {
  if (needle === null || needle === '') return true;
  if (body === null) return false;
  return ` ${searchLiteralNormalize(body)} `.includes(` ${needle} `);
}

export function unaccent(text: string | null): string | null {
  if (text === null) return null;
  let out = '';
  for (const c of text) out += UNACCENT_RULES[c] ?? c;
  return out;
}
