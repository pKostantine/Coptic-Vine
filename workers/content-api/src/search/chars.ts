/**
 * Character classes as Supabase's Postgres sees them. Its text-search parser
 * and dictionaries ask the C library (glibc, locale en_US.UTF-8) through
 * iswalpha, iswspace, towlower and friends; glibc builds those from Unicode
 * (localedata/unicode-gen/unicode_utils.py), reproduced here:
 *   alpha  the Alphabetic property, plus every decimal digit that isn't 0-9
 *   digit  0-9 only (ISO C)
 *   space  the ASCII spaces, and Zl, Zp and Zs except the no-break spaces
 * and Postgres's own test for a zero-width character (pg_dsplen() == 0:
 * categories Mn, Me and Cf), which its parser lets continue a word.
 */

const ALPHABETIC = /\p{Alphabetic}/u;
const DECIMAL = /\p{Nd}/u;
const LINE_OR_PARAGRAPH = /[\p{Zl}\p{Zp}]/u;
const SPACE_SEPARATOR = /\p{Zs}/u;
const ZERO_WIDTH = /[\p{Mn}\p{Me}\p{Cf}]/u;
const NO_BREAK_SPACES = new Set([0x00a0, 0x2007, 0x202f]);

const alphaCache = new Map<number, boolean>();

export function isAlpha(cp: number): boolean {
  if (cp < 0x80) return (cp >= 0x41 && cp <= 0x5a) || (cp >= 0x61 && cp <= 0x7a);
  let result = alphaCache.get(cp);
  if (result === undefined) {
    const c = String.fromCodePoint(cp);
    result = ALPHABETIC.test(c) || DECIMAL.test(c);
    alphaCache.set(cp, result);
  }
  return result;
}

export const isDigit = (cp: number): boolean => cp >= 0x30 && cp <= 0x39;

export const isAlnum = (cp: number): boolean => isAlpha(cp) || isDigit(cp);

export function isSpace(cp: number): boolean {
  if (cp === 0x20 || (cp >= 0x09 && cp <= 0x0d)) return true;
  if (cp < 0x80) return false;
  const c = String.fromCodePoint(cp);
  if (LINE_OR_PARAGRAPH.test(c)) return true;
  return SPACE_SEPARATOR.test(c) && !NO_BREAK_SPACES.has(cp);
}

export const isXDigit = (cp: number): boolean => isDigit(cp) || (cp >= 0x41 && cp <= 0x46) || (cp >= 0x61 && cp <= 0x66);

/** Postgres's pg_dsplen() == 0: a character that takes no space on screen (a combining mark, a format character). */
export function isZeroWidth(cp: number): boolean {
  if (cp === 0) return true;
  if (cp < 0x300) return cp === 0xad;
  return ZERO_WIDTH.test(String.fromCodePoint(cp));
}

/**
 * Spacing combining marks Postgres's parser also lets continue a word
 * (wparser_def.c, p_isspecial's strange_letter table).
 */
export const STRANGE_LETTERS = new Set([
  0x0903, 0x093e, 0x093f, 0x0940, 0x0949, 0x094a, 0x094b, 0x094c, 0x0982, 0x0983, 0x09be, 0x09bf, 0x09c0, 0x09c7, 0x09c8,
  0x09cb, 0x09cc, 0x09d7, 0x0a03, 0x0a3e, 0x0a3f, 0x0a40, 0x0a83, 0x0abe, 0x0abf, 0x0ac0, 0x0ac9, 0x0acb, 0x0acc, 0x0b02,
  0x0b03, 0x0b3e, 0x0b40, 0x0b47, 0x0b48, 0x0b4b, 0x0b4c, 0x0b57, 0x0bbe, 0x0bbf, 0x0bc1, 0x0bc2, 0x0bc6, 0x0bc7, 0x0bc8,
  0x0bca, 0x0bcb, 0x0bcc, 0x0bd7, 0x0c01, 0x0c02, 0x0c03, 0x0c41, 0x0c42, 0x0c43, 0x0c44, 0x0c82, 0x0c83, 0x0cbe, 0x0cc0,
  0x0cc1, 0x0cc2, 0x0cc3, 0x0cc4, 0x0cc7, 0x0cc8, 0x0cca, 0x0ccb, 0x0cd5, 0x0cd6, 0x0d02, 0x0d03, 0x0d3e, 0x0d3f, 0x0d40,
  0x0d46, 0x0d47, 0x0d48, 0x0d4a, 0x0d4b, 0x0d4c, 0x0d57, 0x0d82, 0x0d83, 0x0dcf, 0x0dd0, 0x0dd1, 0x0dd8, 0x0dd9, 0x0dda,
  0x0ddb, 0x0ddc, 0x0ddd, 0x0dde, 0x0ddf, 0x0df2, 0x0df3, 0x0f3e, 0x0f3f, 0x0f7f, 0x102b, 0x102c, 0x1031, 0x1038, 0x103b,
  0x103c, 0x1056, 0x1057, 0x1062, 0x1063, 0x1064, 0x1067, 0x1068, 0x1069, 0x106a, 0x106b, 0x106c, 0x106d, 0x1083, 0x1084,
  0x1087, 0x1088, 0x1089, 0x108a, 0x108b, 0x108c, 0x108f, 0x17b6, 0x17be, 0x17bf, 0x17c0, 0x17c1, 0x17c2, 0x17c3, 0x17c4,
  0x17c5, 0x17c7, 0x17c8, 0x1923, 0x1924, 0x1925, 0x1926, 0x1929, 0x192a, 0x192b, 0x1930, 0x1931, 0x1933, 0x1934, 0x1935,
  0x1936, 0x1937, 0x1938, 0x19b0, 0x19b1, 0x19b2, 0x19b3, 0x19b4, 0x19b5, 0x19b6, 0x19b7, 0x19b8, 0x19b9, 0x19ba, 0x19bb,
  0x19bc, 0x19bd, 0x19be, 0x19bf, 0x19c0, 0x19c8, 0x19c9, 0x1a19, 0x1a1a, 0x1a1b, 0x1b04, 0x1b35, 0x1b3b, 0x1b3d, 0x1b3e,
  0x1b3f, 0x1b40, 0x1b41, 0x1b43, 0x1b44, 0x1b82, 0x1ba1, 0x1ba6, 0x1ba7, 0x1baa, 0x1c24, 0x1c25, 0x1c26, 0x1c27, 0x1c28,
  0x1c29, 0x1c2a, 0x1c2b, 0x1c34, 0x1c35, 0xa823, 0xa824, 0xa827, 0xa880, 0xa881, 0xa8b4, 0xa8b5, 0xa8b6, 0xa8b7, 0xa8b8,
  0xa8b9, 0xa8ba, 0xa8bb, 0xa8bc, 0xa8bd, 0xa8be, 0xa8bf, 0xa8c0, 0xa8c1, 0xa8c2, 0xa8c3, 0xa952, 0xa953, 0xaa2f, 0xaa30,
  0xaa33, 0xaa34, 0xaa4d,
]);

/**
 * glibc's towlower, one character at a time: the simple lowercase mapping,
 * with no context (capital sigma is always σ, never the final ς that
 * String.prototype.toLowerCase gives at the end of a word).
 */
export function lowerChar(cp: number): number {
  if (cp < 0x80) return cp >= 0x41 && cp <= 0x5a ? cp + 32 : cp;
  if (cp === 0x0130) return 0x69; // İ: the simple mapping is plain i
  const lower = String.fromCodePoint(cp).toLowerCase();
  const first = lower.codePointAt(0)!;
  return lower.length === String.fromCodePoint(first).length ? first : cp;
}

/** Postgres's lowerstr(): towlower on every character. */
export function lowerstr(text: string): string {
  let out = '';
  for (const c of text) out += String.fromCodePoint(lowerChar(c.codePointAt(0)!));
  return out;
}

/** Compares as Postgres's tsCompareString does: by UTF-8 bytes (the same as code points), a prefix first. */
export function compareLexemes(a: string, b: string, prefix = false): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 1) {
    const x = a.codePointAt(i)!;
    const y = b.codePointAt(i)!;
    if (x !== y) return x < y ? -1 : 1;
    if (x > 0xffff) i += 1;
  }
  if (a.length === b.length) return 0;
  if (prefix) return a.length > b.length ? 1 : 0;
  return a.length < b.length ? -1 : 1;
}
