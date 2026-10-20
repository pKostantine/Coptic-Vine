/**
 * Text-search queries, built as PostgreSQL builds them (src/backend/utils/
 * adt/tsquery.c, tsquery_cleanup.c, tsvector_parser.c, tsquery_op.c and
 * src/backend/tsearch/to_tsany.c): to_tsquery, plainto_tsquery,
 * phraseto_tsquery, websearch_to_tsquery, the && and || operators, and
 * bible.build_search_query on top of them.
 *
 * A query is a tree. Postgres keeps it as an array in prefix order (an
 * operator, then its right operand, then its left), which only matters for
 * the order operands are visited in; items() gives that order.
 */
import { isSpace } from './chars.ts';
import { PgError } from '../pg.ts';
import { parseText, toTsvector, type Config } from './tsvector.ts';

export type QVal = { type: 'val'; lexeme: string; prefix: boolean; weight: number };
export type QOp = { type: 'op'; op: 'not' | 'and' | 'or' | 'phrase'; distance: number; left: QNode | null; right: QNode };
type QStop = { type: 'stop' };
export type QNode = QVal | QOp;
/** A query; null is the empty query (it matches nothing). */
export type TsQuery = QNode | null;

type Node = QVal | QStop | (Omit<QOp, 'left' | 'right'> & { left: Node | null; right: Node });

const PRIORITY = { not: 4, phrase: 3, and: 2, or: 1 } as const;

/** The query's items in Postgres's array order. */
export function items(node: TsQuery): QNode[] {
  if (!node) return [];
  if (node.type === 'val') return [node];
  return node.op === 'not' ? [node, ...items(node.right)] : [node, ...items(node.right), ...items(node.left)];
}

/** Collects operands and operators in postfix order and builds the tree, as findoprnd reads Postgres's list. */
class Builder {
  stack: Node[] = [];
  pushValue(lexeme: string, weight: number, prefix: boolean) { this.stack.push({ type: 'val', lexeme, prefix, weight }); }
  pushStop() { this.stack.push({ type: 'stop' }); }
  pushOperator(op: QOp['op'], distance: number) {
    const right = this.stack.pop()!;
    const left = op === 'not' ? null : this.stack.pop()!;
    this.stack.push({ type: 'op', op, distance: op === 'phrase' ? distance : 0, left, right });
  }
}

/** pushval_morph: one operand's words through the configuration, joined by qoperator, stopwords kept as placeholders. */
function pushvalMorph(builder: Builder, config: Config, qoperator: 'and' | 'phrase', text: string, weight: number, prefix: boolean) {
  const words = parseText(config, text);
  if (!words.length) { builder.pushStop(); return; }
  let count = 0;
  let pos = 0;
  let cntpos = 0;
  while (count < words.length) {
    // Stopwords removed between two words: fill their positions with placeholders.
    if (pos > 0 && pos + 1 < words[count].pos) {
      while (pos + 1 < words[count].pos) {
        builder.pushStop();
        if (cntpos) builder.pushOperator(qoperator, 1);
        cntpos += 1;
        pos += 1;
      }
    }
    pos = words[count].pos;
    // The words at one position. Every lexeme our dictionaries give is
    // variant 0, so they are ANDed (variants would be ORed).
    let cnt = 0;
    while (count < words.length && pos === words[count].pos) {
      builder.pushValue(words[count].word, weight, prefix);
      if (cnt) builder.pushOperator('and', 0);
      cnt += 1;
      count += 1;
    }
    if (cntpos) builder.pushOperator(qoperator, 1);
    cntpos += 1;
  }
}

// ─── The tsquery text parser (makepol and its tokenizers) ───────────────────

const isOperatorChar = (c: string | undefined) => c === '!' || c === '&' || c === '|' || c === '(' || c === ')' || c === '<';
const isSpaceChar = (c: string | undefined) => c !== undefined && isSpace(c.codePointAt(0)!);
const isDigitChar = (c: string | undefined) => c !== undefined && c >= '0' && c <= '9';
const isAlnumAscii = (c: string | undefined) => c !== undefined && /[\p{Alphabetic}0-9]/u.test(c);

type Mode = 'standard' | 'plain' | 'web';
type Token = { kind: 'val'; text: string; weight: number; prefix: boolean } | { kind: 'opr'; op: QOp['op']; distance: number } | { kind: 'open' } | { kind: 'close' } | { kind: 'end' };

class QueryParser {
  chars: string[];
  i = 0;
  state: 'first' | 'operand' | 'operator' = 'first';
  count = 0;
  readonly mode: Mode;
  readonly original: string;
  constructor(text: string, mode: Mode, original: string) {
    this.chars = Array.from(text);
    this.mode = mode;
    this.original = original;
  }
  get c() { return this.chars[this.i]; }
  syntaxError(): never { throw new PgError('42601', `syntax error in tsquery: "${this.original}"`); }

  /** gettoken_tsvector, for a tsquery operand (operators delimit, no position info). */
  readValue(): string | null {
    const web = this.mode === 'web';
    let word = '';
    let state: 'wait' | 'end' | 'next' | 'cmplx' | 'charcmplx' = 'wait';
    let oldState: 'end' | 'cmplx' = 'end';
    for (;;) {
      const c = this.c;
      if (state === 'wait') {
        if (c === undefined) return null;
        if (!web && c === '\'') state = 'cmplx';
        else if (!web && c === '\\') { state = 'next'; oldState = 'end'; }
        else if (isOperatorChar(c) || (web && c === '"')) this.syntaxError();
        else if (!isSpaceChar(c)) { word += c; state = 'end'; }
      } else if (state === 'next') {
        if (c === undefined) throw new PgError('42601', `there is no escaped character: "${this.original}"`);
        word += c;
        state = oldState;
      } else if (state === 'end') {
        if (!web && c === '\\') { state = 'next'; oldState = 'end'; }
        else if (c === undefined || isSpaceChar(c) || isOperatorChar(c) || (web && c === '"')) {
          if (word === '') this.syntaxError();
          return word;
        } else if (c === ':') {
          if (word === '') this.syntaxError();
          return word;
        } else word += c;
      } else if (state === 'cmplx') {
        if (!web && c === '\'') state = 'charcmplx';
        else if (!web && c === '\\') { state = 'next'; oldState = 'cmplx'; }
        else if (c === undefined) this.syntaxError();
        else word += c;
      } else {
        if (!web && c === '\'') { word += c; state = 'cmplx'; }
        else {
          if (word === '') this.syntaxError();
          return word;
        }
        this.i += 1;
        continue;
      }
      this.i += 1;
    }
  }

  /** get_modifiers: :A-D weights and :* prefix after an operand. */
  readModifiers(): { weight: number; prefix: boolean } {
    let weight = 0;
    let prefix = false;
    if (this.c !== ':') return { weight, prefix };
    this.i += 1;
    for (;;) {
      const c: string | undefined = this.chars[this.i];
      if (c === undefined || c.length !== 1 || c.charCodeAt(0) >= 0x80) break;
      if (c === 'a' || c === 'A') weight |= 1 << 3;
      else if (c === 'b' || c === 'B') weight |= 1 << 2;
      else if (c === 'c' || c === 'C') weight |= 1 << 1;
      else if (c === 'd' || c === 'D') weight |= 1;
      else if (c === '*') prefix = true;
      else break;
      this.i += 1;
    }
    return { weight, prefix };
  }

  /** parse_phrase_operator: <->, <N>. */
  readPhraseOperator(): number | null {
    let j = this.i;
    if (this.chars[j] !== '<') return null;
    j += 1;
    let distance = 1;
    if (this.chars[j] === '-') j += 1;
    else {
      if (!isDigitChar(this.chars[j])) return null;
      let digits = '';
      while (isDigitChar(this.chars[j])) digits += this.chars[j++];
      distance = Number(digits);
      if (distance > 16384) throw new PgError('22023', 'distance in phrase operator must be an integer value between zero and 16384 inclusive');
    }
    if (this.chars[j] !== '>') return null;
    // The C parser only completes the operator on the character after '>':
    // one that ends the query isn't an operator.
    if (this.chars[j + 1] === undefined) return null;
    this.i = j + 1;
    return distance;
  }

  /** parse_or_operator, for websearch: "or" as a word on its own, followed by something. */
  readOrOperator(): boolean {
    const rest = this.chars.slice(this.i, this.i + 2).join('');
    if (rest.toLowerCase() !== 'or') return false;
    let j = this.i + 2;
    const after = this.chars[j];
    if (after === undefined) return false;
    if (after === '-' || after === '_' || isAlnumAscii(after)) return false;
    for (;;) {
      j += 1;
      if (this.chars[j] === undefined) return false;
      if (!isSpaceChar(this.chars[j])) break;
    }
    this.i += 2;
    return true;
  }

  next(builder: Builder): Token {
    if (this.mode === 'plain') {
      if (this.i >= this.chars.length) return { kind: 'end' };
      const text = this.chars.slice(this.i).join('');
      this.i = this.chars.length;
      this.count += 1;
      return { kind: 'val', text, weight: 0, prefix: false };
    }
    for (;;) {
      const c = this.c;
      if (this.state === 'first' || this.state === 'operand') {
        if (this.mode === 'web') {
          if (c === '-') { this.i += 1; this.state = 'operand'; return { kind: 'opr', op: 'not', distance: 0 }; }
          if (c === '"') {
            this.i += 1;
            const start = this.i;
            while (this.c !== undefined && this.c !== '"') this.i += 1;
            const text = this.chars.slice(start, this.i).join('');
            if (this.c !== undefined) this.i += 1;
            this.state = 'operator';
            this.count += 1;
            return { kind: 'val', text, weight: 0, prefix: false };
          }
          if (isOperatorChar(c)) { this.i += 1; this.state = 'operand'; continue; }
          if (c !== undefined && !isSpaceChar(c)) {
            const text = this.readValue()!;
            this.state = 'operator';
            return { kind: 'val', text, weight: 0, prefix: false };
          }
          if (c === undefined) {
            if (this.state === 'first') return { kind: 'end' };
            // An operator with nothing after it still needs an operand.
            builder.pushStop();
            return { kind: 'end' };
          }
        } else {
          if (c === '!') { this.i += 1; this.state = 'operand'; return { kind: 'opr', op: 'not', distance: 0 }; }
          if (c === '(') { this.i += 1; this.state = 'operand'; this.count += 1; return { kind: 'open' }; }
          if (c === ':') this.syntaxError();
          if (c !== undefined && !isSpaceChar(c)) {
            const text = this.readValue();
            if (text === null) {
              if (this.state === 'first') return { kind: 'end' };
              throw new PgError('42601', `no operand in tsquery: "${this.original}"`);
            }
            const { weight, prefix } = this.readModifiers();
            this.state = 'operator';
            return { kind: 'val', text, weight, prefix };
          }
          if (c === undefined) {
            if (this.state === 'first') return { kind: 'end' };
            throw new PgError('42601', `no operand in tsquery: "${this.original}"`);
          }
        }
      } else if (this.mode === 'web') {
        if (c === undefined) return { kind: 'end' };
        if (this.readOrOperator()) { this.state = 'operand'; return { kind: 'opr', op: 'or', distance: 0 }; }
        if (isOperatorChar(c)) { this.i += 1; continue; }
        if (!isSpaceChar(c)) { this.state = 'operand'; return { kind: 'opr', op: 'and', distance: 0 }; }
      } else {
        if (c === '&') { this.i += 1; this.state = 'operand'; return { kind: 'opr', op: 'and', distance: 0 }; }
        if (c === '|') { this.i += 1; this.state = 'operand'; return { kind: 'opr', op: 'or', distance: 0 }; }
        const distance = this.readPhraseOperator();
        if (distance !== null) { this.state = 'operand'; return { kind: 'opr', op: 'phrase', distance }; }
        if (c === ')') {
          this.i += 1;
          this.count -= 1;
          if (this.count < 0) this.syntaxError();
          return { kind: 'close' };
        }
        if (c === undefined) {
          if (this.count) this.syntaxError();
          return { kind: 'end' };
        }
        if (!isSpaceChar(c)) this.syntaxError();
      }
      this.i += 1;
    }
  }
}

function makepol(parser: QueryParser, builder: Builder, pushval: (text: string, weight: number, prefix: boolean) => void) {
  const opstack: { op: QOp['op']; distance: number }[] = [];
  const clean = (op: QOp['op']) => {
    const priority = PRIORITY[op];
    while (opstack.length) {
      const top = opstack[opstack.length - 1];
      if ((op !== 'not' && priority > PRIORITY[top.op]) || (op === 'not' && priority >= PRIORITY[top.op])) break;
      opstack.pop();
      builder.pushOperator(top.op, top.distance);
    }
  };
  for (;;) {
    const token = parser.next(builder);
    if (token.kind === 'end') break;
    if (token.kind === 'val') pushval(token.text, token.weight, token.prefix);
    else if (token.kind === 'opr') {
      clean(token.op);
      if (opstack.length >= 32) throw new PgError('54000', 'tsquery is too complex');
      opstack.push({ op: token.op, distance: token.distance });
    } else if (token.kind === 'open') makepol(parser, builder, pushval);
    else if (token.kind === 'close') { clean('or'); return; }
  }
  clean('or');
}

/** clean_stopword_intree: drop stopword placeholders, widening the phrase distances around them. */
function cleanStopwords(node: Node): { node: Node | null; ladd: number; radd: number } {
  if (node.type === 'val') return { node, ladd: 0, radd: 0 };
  if (node.type === 'stop') return { node: null, ladd: 0, radd: 0 };
  if (node.op === 'not') {
    const child = cleanStopwords(node.right);
    if (!child.node) return { node: null, ladd: child.ladd, radd: child.radd };
    return { node: { ...node, right: child.node }, ladd: child.ladd, radd: child.radd };
  }
  const left = cleanStopwords(node.left!);
  const right = cleanStopwords(node.right);
  const isPhrase = node.op === 'phrase';
  const distance = isPhrase ? node.distance : 0;
  if (!left.node && !right.node) {
    const add = isPhrase ? left.ladd + distance + right.ladd : Math.max(left.ladd, right.ladd);
    return { node: null, ladd: add, radd: add };
  }
  if (!left.node) {
    return isPhrase ? { node: right.node, ladd: left.ladd + distance + right.ladd, radd: right.radd } : { node: right.node, ladd: right.ladd, radd: right.radd };
  }
  if (!right.node) {
    return isPhrase ? { node: left.node, ladd: left.ladd, radd: left.radd + distance + right.radd } : { node: left.node, ladd: left.ladd, radd: left.radd };
  }
  if (isPhrase) {
    return { node: { ...node, distance: node.distance + left.radd + right.ladd, left: left.node, right: right.node }, ladd: left.ladd, radd: right.radd };
  }
  return { node: { ...node, left: left.node, right: right.node }, ladd: 0, radd: 0 };
}

/** parse_tsquery with pushval_morph: the text in a configuration, as a query. */
function parseTsquery(text: string, config: Config, mode: Mode, qoperator: 'and' | 'phrase'): TsQuery {
  const builder = new Builder();
  const parser = new QueryParser(text, mode, text);
  makepol(parser, builder, (value, weight, prefix) => pushvalMorph(builder, config, qoperator, value, weight, prefix));
  if (!builder.stack.length) return null;
  const root = builder.stack[builder.stack.length - 1];
  return (cleanStopwords(root).node as TsQuery) ?? null;
}

export const toTsquery = (config: Config, text: string) => parseTsquery(text, config, 'standard', 'phrase');
export const plaintoTsquery = (config: Config, text: string) => parseTsquery(text, config, 'plain', 'and');
export const phrasetoTsquery = (config: Config, text: string) => parseTsquery(text, config, 'plain', 'phrase');
export const websearchToTsquery = (config: Config, text: string) => parseTsquery(text, config, 'web', 'phrase');

/** The && and || operators: an empty side gives the other side. */
export function tsqueryCombine(op: 'and' | 'or', a: TsQuery, b: TsQuery): TsQuery {
  if (!a) return b;
  if (!b) return a;
  return { type: 'op', op, distance: 0, left: a, right: b };
}

/** quote_literal() */
function quoteLiteral(text: string): string {
  const quoted = text.replace(/'/g, "''");
  return text.includes('\\') ? `E'${quoted.replace(/\\/g, '\\\\')}'` : `'${quoted}'`;
}

/** Postgres's btrim(): spaces only. */
const btrim = (text: string) => text.replace(/^ +| +$/g, '');

/**
 * bible.build_search_query(p_query, p_config, p_mode, p_prefix): 'phrase' and
 * 'websearch' hand the whole query to Postgres; otherwise each word becomes a
 * query of its own (its lexemes as prefixes, with p_prefix), joined with OR
 * for 'any' and AND for anything else.
 */
export function buildSearchQuery(text: string | null, config: Config, mode: string | null, prefix: boolean | null): TsQuery {
  const kind = (mode ?? 'all').toLowerCase();
  if (text === null || btrim(text) === '') return null;
  if (kind === 'phrase') return phrasetoTsquery(config, text);
  if (kind === 'websearch') return websearchToTsquery(config, text);
  let acc: TsQuery | undefined;
  for (const token of btrim(text).split(/\s+/u)) {
    let part: TsQuery | undefined;
    if (prefix) {
      // Lexize first, then mark each lexeme a prefix (in the vector's order).
      const lexemes = toTsvector(config, token).map((entry) => entry.lexeme);
      part = lexemes.length ? toTsquery(config, lexemes.map((lexeme) => `${quoteLiteral(lexeme)}:*`).join(' & ')) : undefined;
    } else {
      part = plaintoTsquery(config, token) ?? undefined;
    }
    if (part === undefined) continue;
    acc = acc === undefined ? part : tsqueryCombine(kind === 'any' ? 'or' : 'and', acc, part);
  }
  return acc ?? null;
}
