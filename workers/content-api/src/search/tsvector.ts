/**
 * to_tsvector, as PostgreSQL computes it for the configurations the Bible
 * search uses (english, french, arabic, greek, simple): parse the text
 * (parser.ts), send each token through its dictionary, number the words
 * (src/backend/tsearch/ts_parse.c, parsetext), then sort and merge the
 * lexemes (to_tsany.c, uniqueWORD).
 *
 * A Snowball dictionary lowercases (lowerstr), drops stopwords and stems; the
 * simple dictionary only lowercases. A stopword still takes a position, so
 * phrase distances count it; a token type with no dictionary (spaces, tags)
 * doesn't.
 */
import { compareLexemes, lowerstr } from './chars.ts';
import { parse, Tok, type Token } from './parser.ts';
import { stem, type SnowballLanguage } from './snowball.js';
import { STOPWORDS } from './stopwords.ts';

export type Config = 'english' | 'french' | 'arabic' | 'greek' | 'simple';

/** Words longer than this many bytes are skipped, as Postgres does (MAXSTRLEN). */
const MAXSTRLEN = 2047;
const MAXENTRYPOS = 1 << 14;
const MAXNUMPOS = 256;
const limitPos = (pos: number) => (pos >= MAXENTRYPOS ? MAXENTRYPOS - 1 : pos);
const utf8Length = (text: string) => new TextEncoder().encode(text).length;

/** The token types each configuration maps to a dictionary (all but spaces, tags, protocols and entities). */
const SNOWBALL_TYPES = new Set<number>([Tok.ASCIIWORD, Tok.WORD, Tok.ASCIIHWORD, Tok.HWORD, Tok.PARTHWORD, Tok.ASCIIPARTHWORD]);
const SIMPLE_TYPES = new Set<number>([
  Tok.NUMWORD, Tok.EMAIL, Tok.URL, Tok.HOST, Tok.SCIENTIFIC, Tok.VERSIONNUMBER, Tok.NUMPARTHWORD, Tok.NUMHWORD,
  Tok.URLPATH, Tok.FILEPATH, Tok.DECIMAL, Tok.SIGNEDINT, Tok.UNSIGNEDINT,
]);

/**
 * One token through its configuration's dictionary: the lexemes (none for a
 * stopword), or null when no dictionary handles the token's type.
 */
export function lexize(config: Config, token: Token): string[] | null {
  const snowball = config !== 'simple' && SNOWBALL_TYPES.has(token.type);
  if (!snowball && !SNOWBALL_TYPES.has(token.type) && !SIMPLE_TYPES.has(token.type)) return null;
  const word = lowerstr(token.text);
  if (word === '') return [];
  if (!snowball) return [word];
  if (utf8Length(token.text) > 1000) return [word]; // never stemmed, as dict_snowball.c
  const stopwords = config === 'english' || config === 'french' ? STOPWORDS[config] : null;
  if (stopwords?.has(word)) return [];
  // An empty stem leaves the word as it was (dict_snowball.c copies the
  // stemmer's output only when it has a length): the Greek stemmer reduces
  // εις and εως to nothing, and Postgres keeps them whole.
  const stemmed = stem(config as SnowballLanguage, word);
  return [stemmed === '' ? word : stemmed];
}

export type ParsedWord = { word: string; pos: number };

/** parsetext: every lexeme of a text with its position. */
export function parseText(config: Config, text: string): ParsedWord[] {
  const words: ParsedWord[] = [];
  let pos = 0;
  for (const token of parse(text)) {
    if (utf8Length(token.text) > MAXSTRLEN) continue;
    const lexemes = lexize(config, token);
    if (lexemes === null) continue;
    pos += 1;
    for (const lexeme of lexemes) {
      if (utf8Length(lexeme) > MAXSTRLEN) continue;
      words.push({ word: lexeme, pos: limitPos(pos) });
    }
  }
  return words;
}

/** A tsvector: lexemes in Postgres's order, each with its sorted positions. */
export type TsVector = { lexeme: string; positions: number[] }[];

/** uniqueWORD: sort by lexeme then position, merge duplicates, at most 255 positions a lexeme. */
export function makeTsvector(words: ParsedWord[]): TsVector {
  const sorted = [...words].sort((a, b) => compareLexemes(a.word, b.word) || a.pos - b.pos);
  const out: TsVector = [];
  for (const { word, pos } of sorted) {
    const last = out[out.length - 1];
    if (!last || last.lexeme !== word) {
      out.push({ lexeme: word, positions: [pos] });
    } else if (last.positions.length < MAXNUMPOS - 1 && last.positions[last.positions.length - 1] !== MAXENTRYPOS - 1 && last.positions[last.positions.length - 1] !== pos) {
      last.positions.push(pos);
    }
  }
  return out;
}

export function toTsvector(config: Config, text: string | null): TsVector {
  return makeTsvector(parseText(config, text ?? ''));
}

/** A tsvector as Postgres prints it: 'lexeme':1,4 'other':2 */
export function tsvectorText(vector: TsVector): string {
  return vector.map(({ lexeme, positions }) => `'${lexeme.replace(/['\\]/g, (c) => c + c)}':${positions.join(',')}`).join(' ');
}

/** The inverse of tsvectorText, for the vectors stored in D1. */
export function parseTsvectorText(text: string): TsVector {
  const out: TsVector = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === ' ') { i += 1; continue; }
    let lexeme = '';
    i += 1; // opening quote
    while (i < text.length) {
      if ((text[i] === '\'' || text[i] === '\\') && text[i + 1] === text[i]) { lexeme += text[i]; i += 2; continue; }
      if (text[i] === '\'') break;
      lexeme += text[i];
      i += 1;
    }
    i += 1; // closing quote
    const positions: number[] = [];
    if (text[i] === ':') {
      i += 1;
      const start = i;
      while (i < text.length && text[i] !== ' ') i += 1;
      for (const part of text.slice(start, i).split(',')) positions.push(Number(part));
    }
    out.push({ lexeme, positions });
  }
  return out;
}
