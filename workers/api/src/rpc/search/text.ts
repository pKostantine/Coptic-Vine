/**
 * The text functions the catalog search runs on Supabase, ported:
 *
 *   media.normalize_search_text  unaccent, lower, fold the Arabic alef forms,
 *     alef maqsura and hamza carriers, drop tatweel and the Arabic marks, then
 *     every run of non-alphanumerics to one space, trimmed. lower() and
 *     [[:alnum:]] follow the database's ICU collation (en-US): full Unicode
 *     lowercasing (String.prototype.toLowerCase), and letters and decimal
 *     digits.
 *   extensions.similarity        pg_trgm 1.6 (contrib/pg_trgm/trgm_op.c) on
 *     Postgres 17: the words are runs of characters glibc's iswalnum accepts
 *     (locale en_US.UTF-8, not the ICU collation), lowercased with towlower,
 *     padded with two spaces before and one after; their trigrams, a trigram
 *     of more than three bytes hashed to three (compact_trigram); and the
 *     shared share of both sets as a float4.
 *
 * Checked against Supabase by tests/search.text.test.ts.
 */
import { isAlnum, lowerstr } from '../../../../content-api/src/search/chars.ts';
import { unaccent } from '../../../../content-api/src/search/normalize.ts';

// translate(…, U&'\0623\0625\0622\0671\0649\0624\0626\0640', U&'\0627\0627\0627\0627\064A\0648\064A'):
// alef with hamza above, hamza below, madda and wasla to alef; alef maqsura to yeh;
// waw and yeh with hamza to waw and yeh; tatweel, with no counterpart, deleted.
const ARABIC_FOLD: Readonly<Record<string, string>> = {
  'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ٱ': 'ا', 'ى': 'ي', 'ؤ': 'و', 'ئ': 'ي', 'ـ': '',
};
const ARABIC_MARKS = /[ً-ٰٟۖ-ۭ]/g;
const NOT_ALNUM = /[^\p{L}\p{Nd}]+/gu;

export function normalizeSearchText(value: string | null): string {
  let folded = '';
  for (const c of unaccent(value ?? '')!.toLowerCase()) folded += ARABIC_FOLD[c] ?? c;
  return folded.replace(ARABIC_MARKS, '').replace(NOT_ALNUM, ' ').replace(/^ +| +$/g, '');
}

/** pg_crc32_table: the table of the reflected CRC-32 polynomial (0xEDB88320). */
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

/** Postgres's legacy CRC-32 (pg_crc.h, COMP_LEGACY_CRC32): the reflected table, shifted the "normal" way. */
function legacyCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (CRC_TABLE[((crc >>> 24) ^ byte) & 0xff] ^ (crc << 8)) >>> 0;
  return (crc ^ 0xffffffff) >>> 0;
}

const encoder = new TextEncoder();

/**
 * A trigram as its three stored bytes, read as show_trgm's trgm2int does: the
 * characters' bytes when there are three, else the first three bytes in memory
 * (little-endian) of their legacy CRC-32.
 */
function trigramKey(trigram: string): number {
  const bytes = encoder.encode(trigram);
  const [b0, b1, b2] = bytes.length === 3 ? bytes : (() => {
    const crc = legacyCrc32(bytes);
    return [crc & 0xff, (crc >>> 8) & 0xff, (crc >>> 16) & 0xff];
  })();
  return (b0 << 16) | (b1 << 8) | b2;
}

/** generate_trgm: the set of a text's trigrams. */
export function trigrams(text: string): Set<number> {
  const out = new Set<number>();
  const characters = [...text];
  let i = 0;
  while (i < characters.length) {
    while (i < characters.length && !isAlnum(characters[i].codePointAt(0)!)) i += 1;
    const start = i;
    while (i < characters.length && isAlnum(characters[i].codePointAt(0)!)) i += 1;
    if (i === start) break;
    const padded = [' ', ' ', ...lowerstr(characters.slice(start, i).join('')), ' '];
    for (let j = 0; j + 3 <= padded.length; j += 1) out.add(trigramKey(padded[j] + padded[j + 1] + padded[j + 2]));
  }
  return out;
}

/** similarity(a, b): shared trigrams over all of either's, as a float4 (cnt_sml). */
export function similarity(a: string | Set<number>, b: string | Set<number>): number {
  const left = typeof a === 'string' ? trigrams(a) : a;
  const right = typeof b === 'string' ? trigrams(b) : b;
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const key of left) if (right.has(key)) shared += 1;
  return Math.fround(shared / (left.size + right.size - shared));
}
