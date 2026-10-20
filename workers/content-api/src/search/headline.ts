/**
 * ts_headline, as bible.search_verses calls it:
 *   'StartSel={{{, StopSel=}}}, MaxWords=30, MinWords=12, ShortWord=2,
 *    MaxFragments=2, FragmentDelimiter= … , HighlightAll=FALSE'
 * (Postgres reads FragmentDelimiter's value up to the next space: "…".)
 *
 * Ported from PostgreSQL: hlparsetext and generateHeadline
 * (src/backend/tsearch/ts_parse.c), hlCover, mark_hl_fragments and friends
 * (src/backend/tsearch/wparser_def.c). Word lengths are in bytes, as there:
 * ShortWord=2 makes a one-letter Arabic or Greek word (two bytes) short.
 */
import { compareLexemes } from './chars.ts';
import { NO, tsExecute, tsExecuteLocations, YES, type Check, type PhraseData } from './execute.ts';
import { parse, Tok } from './parser.ts';
import { items, type QNode, type QVal } from './tsquery.ts';
import { lexize, type Config } from './tsvector.ts';

const START_SEL = '{{{';
const STOP_SEL = '}}}';
const FRAGMENT_DELIMITER = '…';
const MAX_WORDS = 30;
const MIN_WORDS = 12;
const SHORT_WORD = 2;
const MAX_FRAGMENTS = 2;

type Word = {
  type: number;
  text: string;
  len: number; // bytes
  pos: number;
  item: QVal | null;
  repeated: boolean;
  selected: boolean;
  in: boolean;
  replace: boolean;
  skip: boolean;
};

const encoder = new TextEncoder();
const isHlSkip = (type: number) => type === Tok.URL || type === Tok.NUMHWORD || type === Tok.ASCIIHWORD || type === Tok.HWORD;
const isNonWord = (type: number) => type === Tok.SPACE || type === Tok.TAG || isHlSkip(type);
const isNoEnd = (type: number) => isNonWord(type) || type === Tok.SCIENTIFIC || type === Tok.VERSIONNUMBER || type === Tok.DECIMAL
  || type === Tok.SIGNEDINT || type === Tok.UNSIGNEDINT || type === Tok.TAG || type === Tok.PROTOCOL || type === Tok.SPACE || type === Tok.XMLENTITY;

/** hlparsetext: every token as a word; words with lexemes get a position and the query operands they match. */
function parseWords(config: Config, text: string, query: QNode): Word[] {
  const operands = items(query).filter((item): item is QVal => item.type === 'val');
  const words: Word[] = [];
  let vectorpos = 0;
  for (const token of parse(text)) {
    const word: Word = { type: token.type, text: token.text, len: encoder.encode(token.text).length, pos: 0, item: null, repeated: false, selected: false, in: false, replace: false, skip: false };
    if (word.len > 2047) continue;
    words.push(word);
    const lexemes = lexize(config, token);
    if (lexemes === null) continue;
    vectorpos += 1;
    for (const lexeme of lexemes) {
      // hlfinditem: mark the word with every operand its lexeme satisfies.
      word.pos = vectorpos;
      for (const operand of operands) {
        if (compareLexemes(operand.lexeme, lexeme, operand.prefix) !== 0) continue;
        if (word.item) words.push({ ...word, item: operand, repeated: true });
        else word.item = operand;
      }
    }
  }
  return words;
}

/** checkcondition_HL over words[from..to]. */
function wordsCheck(words: Word[], from: number, to: number): Check {
  return (val, data) => {
    for (let i = from; i <= to; i += 1) {
      if (words[i].item !== val) continue;
      if (!data) return YES;
      if (!data.pos.length || data.pos[data.pos.length - 1] < words[i].pos) data.pos.push(words[i].pos);
    }
    return data && data.pos.length > 0 ? YES : NO;
  };
}

/** hlCover: the next minimal run of words satisfying the query, from lexeme position next.pos on. */
function hlCover(words: Word[], query: QNode, locations: PhraseData[], next: { pos: number }): { p: number; q: number } | null {
  let pos = next.pos;
  for (;;) {
    let pose = -1;
    for (const location of locations) {
      const first = location.pos.find((endp) => endp >= pos);
      if (first === undefined) return null;
      if (first > pose) pose = first;
    }
    if (pose < 0) return null;
    let posb = Number.MAX_SAFE_INTEGER - 1;
    for (const location of locations) {
      let last = -1;
      for (let i = location.pos.length - 1; i >= 0; i -= 1) {
        const startp = location.pos[i] - location.width;
        if (startp <= pose) { last = startp; break; }
      }
      if (last < posb) posb = last;
    }
    posb = Math.max(posb, pos);
    if (posb <= pose) {
      let idxb = -1;
      let idxe = -1;
      for (let i = 0; i < words.length; i += 1) {
        if (!words[i].item) continue;
        if (idxb < 0 && words[i].pos >= posb) idxb = i;
        if (words[i].pos <= pose) idxe = i;
        else break;
      }
      if (idxb >= 0 && idxe >= idxb && tsExecute(query, wordsCheck(words, idxb, idxe))) {
        next.pos = posb + 1;
        return { p: idxb, q: idxe };
      }
    }
    pos = posb + 1;
  }
}

function markFragment(words: Word[], start: number, end: number) {
  for (let i = start; i <= end; i += 1) {
    if (words[i].item) words[i].selected = true;
    if (words[i].type === Tok.TAG) words[i].replace = true;
    else if (isHlSkip(words[i].type)) words[i].skip = true;
    words[i].in = !words[i].repeated;
  }
}

/** mark_hl_fragments with MaxFragments > 0. */
function markFragments(words: Word[], query: QNode, locations: PhraseData[]) {
  const interesting = (j: number) => Boolean(words[j].item) && !words[j].repeated;
  const badEndpoint = (j: number) => (isNoEnd(words[j].type) || words[j].len <= SHORT_WORD) && !interesting(j);
  type Cover = { start: number; end: number; poslen: number; curlen: number; chosen: boolean; excluded: boolean };
  const covers: Cover[] = [];
  const next = { pos: 0 };
  for (let cover = hlCover(words, query, locations, next); cover; cover = hlCover(words, query, locations, next)) {
    let start = cover.p;
    let end = cover.q;
    while (start <= end) {
      // get_next_fragment: at most MaxWords, both ends query words.
      for (let i = start; i <= end; i += 1) { start = i; if (interesting(i)) break; }
      let curlen = 0;
      let poslen = 0;
      let i = start;
      for (; i <= end && curlen < MAX_WORDS; i += 1) {
        if (!isNonWord(words[i].type)) curlen += 1;
        if (interesting(i)) poslen += 1;
      }
      if (end > i) {
        end = i;
        for (i = end; i >= start; i -= 1) {
          end = i;
          if (interesting(i)) break;
          if (!isNonWord(words[i].type)) curlen -= 1;
        }
      }
      covers.push({ start, end, poslen, curlen, chosen: false, excluded: false });
      start = end + 1;
      end = cover.q;
    }
  }

  let fragments = 0;
  for (let f = 0; f < MAX_FRAGMENTS; f += 1) {
    let maxitems = 0;
    let minwords = Number.MAX_SAFE_INTEGER;
    let chosen = -1;
    covers.forEach((cover, i) => {
      if (!cover.chosen && !cover.excluded && (maxitems < cover.poslen || (maxitems === cover.poslen && minwords > cover.curlen))) {
        maxitems = cover.poslen;
        minwords = cover.curlen;
        chosen = i;
      }
    });
    if (chosen < 0) break;
    const cover = covers[chosen];
    cover.chosen = true;
    let { start, end, curlen } = cover;
    if (curlen < MAX_WORDS) {
      const maxstretch = Math.trunc((MAX_WORDS - curlen) / 2);
      let stretch = 0;
      let marker = start;
      let i: number;
      for (i = start - 1; i >= 0 && stretch < maxstretch && !words[i].in; i -= 1) {
        if (!isNonWord(words[i].type)) { curlen += 1; stretch += 1; }
        marker = i;
      }
      for (i = marker; i < start && badEndpoint(i); i += 1) {
        if (!isNonWord(words[i].type)) curlen -= 1;
      }
      start = i;
      marker = end;
      for (i = end + 1; i < words.length && curlen < MAX_WORDS && !words[i].in; i += 1) {
        if (!isNonWord(words[i].type)) curlen += 1;
        marker = i;
      }
      for (i = marker; i > end && badEndpoint(i); i -= 1) {
        if (!isNonWord(words[i].type)) curlen -= 1;
      }
      end = i;
    }
    cover.start = start;
    cover.end = end;
    cover.curlen = curlen;
    markFragment(words, start, end);
    fragments += 1;
    covers.forEach((other, i) => {
      if (i !== chosen && ((other.start >= start && other.start <= end) || (other.end >= start && other.end <= end) || (other.start < start && other.end > end))) other.excluded = true;
    });
  }

  if (fragments <= 0) {
    // Nothing marked: the first MinWords words.
    let curlen = 0;
    let end = -1;
    for (let i = 0; i < words.length && curlen < MIN_WORDS; i += 1) {
      if (!isNonWord(words[i].type)) curlen += 1;
      end = i;
    }
    markFragment(words, 0, end);
  }
}

/** generateHeadline */
function generate(words: Word[]): string {
  let out = '';
  let fragments = 0;
  let inFragment = false;
  for (const word of words) {
    if (word.in && !word.repeated) {
      if (!inFragment) {
        inFragment = true;
        fragments += 1;
        if (fragments > 1) out += FRAGMENT_DELIMITER;
      }
      if (word.replace) out += ' ';
      else if (!word.skip) out += word.selected ? `${START_SEL}${word.text}${STOP_SEL}` : word.text;
    } else if (!word.repeated) {
      inFragment = false;
    }
  }
  return out;
}

/** ts_headline(config, text, query, <search_verses' options>) */
export function headline(config: Config, text: string, query: QNode): string {
  const words = parseWords(config, text, query);
  const locations = tsExecuteLocations(query, wordsCheck(words, 0, words.length - 1)) ?? [];
  markFragments(words, query, locations);
  return generate(words);
}
