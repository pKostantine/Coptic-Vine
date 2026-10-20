/**
 * Evaluating a query, as PostgreSQL does (src/backend/utils/adt/
 * tsvector_op.c): TS_execute for true or false, TS_phrase_execute for
 * phrases (which need word positions), TS_execute_locations for where the
 * matches are (ts_headline uses it), and checkcondition_str, the lookup of
 * an operand in a tsvector (prefix operands match every lexeme they begin).
 *
 * Results are three-valued as in Postgres: NO, YES, and MAYBE (positions
 * unknown), which only arises for vectors without positions.
 */
import { compareLexemes } from './chars.ts';
import type { QNode, QVal } from './tsquery.ts';
import type { TsVector } from './tsvector.ts';

export const NO = 0, YES = 1, MAYBE = 2;
export type Ternary = 0 | 1 | 2;

/** ExecPhraseData: where an operand or sub-phrase matches (or, negated, where it doesn't). */
export type PhraseData = { pos: number[]; negate: boolean; width: number };
export const phraseData = (): PhraseData => ({ pos: [], negate: false, width: 0 });

/** A check for one operand: YES/NO, filling data's positions when data is given. */
export type Check = (val: QVal, data: PhraseData | null) => Ternary;

const L_ONLY = 1, R_ONLY = 2, BOTH = 4;

/** TS_phrase_output: merge-join two position lists. */
function phraseOutput(data: PhraseData | null, l: PhraseData, r: PhraseData, emit: number, lOffset: number, rOffset: number): Ternary {
  let li = 0;
  let ri = 0;
  while (li < l.pos.length || ri < r.pos.length) {
    let lpos: number;
    let rpos: number;
    if (li < l.pos.length) lpos = l.pos[li] + lOffset;
    else { if (!(emit & R_ONLY)) break; lpos = Number.MAX_SAFE_INTEGER; }
    if (ri < r.pos.length) rpos = r.pos[ri] + rOffset;
    else { if (!(emit & L_ONLY)) break; rpos = Number.MAX_SAFE_INTEGER; }
    let output = 0;
    if (lpos < rpos) { if (emit & L_ONLY) output = lpos; li += 1; }
    else if (lpos === rpos) { if (emit & BOTH) output = rpos; li += 1; ri += 1; }
    else { if (emit & R_ONLY) output = rpos; ri += 1; }
    if (output > 0) {
      if (!data) return YES;
      data.pos.push(output);
    }
  }
  return data && data.pos.length > 0 ? YES : NO;
}

/** TS_phrase_execute */
export function phraseExecute(node: QNode, check: Check, data: PhraseData | null): Ternary {
  if (node.type === 'val') return check(node, data);
  switch (node.op) {
    case 'not': {
      const child = phraseExecute(node.right, check, data);
      if (child === NO) { data!.negate = true; return YES; }
      if (child === YES) {
        if (data!.pos.length > 0) { data!.negate = !data!.negate; return YES; }
        if (data!.negate) { data!.negate = false; return NO; }
        return NO;
      }
      return MAYBE;
    }
    case 'phrase':
    case 'and': {
      const l = phraseData();
      const r = phraseData();
      const lmatch = phraseExecute(node.left!, check, l);
      if (lmatch === NO) return NO;
      const rmatch = phraseExecute(node.right, check, r);
      if (rmatch === NO) return NO;
      if (lmatch === MAYBE || rmatch === MAYBE) return MAYBE;
      let lOffset: number;
      let rOffset: number;
      if (node.op === 'phrase') {
        lOffset = node.distance + r.width;
        rOffset = 0;
        if (data) data.width = node.distance + l.width + r.width;
      } else {
        const maxwidth = Math.max(l.width, r.width);
        lOffset = maxwidth - l.width;
        rOffset = maxwidth - r.width;
        if (data) data.width = maxwidth;
      }
      if (l.negate && r.negate) {
        phraseOutput(data, l, r, BOTH | L_ONLY | R_ONLY, lOffset, rOffset);
        if (data) data.negate = true;
        return YES;
      }
      if (l.negate) return phraseOutput(data, l, r, R_ONLY, lOffset, rOffset);
      if (r.negate) return phraseOutput(data, l, r, L_ONLY, lOffset, rOffset);
      return phraseOutput(data, l, r, BOTH, lOffset, rOffset);
    }
    case 'or': {
      const l = phraseData();
      const r = phraseData();
      const lmatch = phraseExecute(node.left!, check, l);
      const rmatch = phraseExecute(node.right, check, r);
      if (lmatch === NO && rmatch === NO) return NO;
      if (lmatch === MAYBE || rmatch === MAYBE) return MAYBE;
      if (lmatch === NO) l.width = 0;
      if (rmatch === NO) r.width = 0;
      const maxwidth = Math.max(l.width, r.width);
      const lOffset = maxwidth - l.width;
      const rOffset = maxwidth - r.width;
      data!.width = maxwidth;
      if (l.negate && r.negate) { phraseOutput(data, l, r, BOTH, lOffset, rOffset); data!.negate = true; return YES; }
      if (l.negate) { phraseOutput(data, l, r, L_ONLY, lOffset, rOffset); data!.negate = true; return YES; }
      if (r.negate) { phraseOutput(data, l, r, R_ONLY, lOffset, rOffset); data!.negate = true; return YES; }
      return phraseOutput(data, l, r, BOTH | L_ONLY | R_ONLY, lOffset, rOffset);
    }
  }
}

/** TS_execute_recurse with TS_EXEC_EMPTY flags. */
function executeRecurse(node: QNode, check: Check): Ternary {
  if (node.type === 'val') return check(node, null);
  switch (node.op) {
    case 'not': {
      const child = executeRecurse(node.right, check);
      return child === NO ? YES : child === YES ? NO : MAYBE;
    }
    case 'and': {
      const lmatch = executeRecurse(node.left!, check);
      if (lmatch === NO) return NO;
      const rmatch = executeRecurse(node.right, check);
      return rmatch === NO ? NO : rmatch === YES ? lmatch : MAYBE;
    }
    case 'or': {
      const lmatch = executeRecurse(node.left!, check);
      if (lmatch === YES) return YES;
      const rmatch = executeRecurse(node.right, check);
      return rmatch === NO ? lmatch : rmatch === YES ? YES : MAYBE;
    }
    case 'phrase': {
      const result = phraseExecute(node, check, null);
      return result === YES ? YES : NO; // MAYBE counts as NO without TS_EXEC_PHRASE_NO_POS
    }
  }
}

/** TS_execute: does the query match? */
export function tsExecute(node: QNode, check: Check): boolean {
  return executeRecurse(node, check) !== NO;
}

/** TS_execute_locations: for each ANDed term, where it matches (null when the query doesn't). */
export function tsExecuteLocations(node: QNode, check: Check): PhraseData[] | null {
  const recurse = (current: QNode): PhraseData[] | null => {
    if (current.type === 'val') {
      const data = phraseData();
      return check(current, data) === YES ? [data] : null;
    }
    switch (current.op) {
      case 'not':
        return recurse(current.right) ? null : [];
      case 'and': {
        const l = recurse(current.left!);
        if (!l) return null;
        const r = recurse(current.right);
        if (!r) return null;
        return [...l, ...r];
      }
      case 'or': {
        const l = recurse(current.left!);
        const r = recurse(current.right);
        if (!l && !r) return null;
        if (!l || l.length === 0) return r ?? [];
        if (!r || r.length === 0) return l;
        const out: PhraseData[] = [];
        for (const ld of l) {
          for (const rd of r) {
            const data = phraseData();
            phraseOutput(data, ld, rd, BOTH | L_ONLY | R_ONLY, 0, 0);
            data.width = Math.max(ld.width, rd.width);
            out.push(data);
          }
        }
        return out;
      }
      case 'phrase': {
        const data = phraseData();
        if (phraseExecute(current, check, data) === YES) return data.negate ? [] : [data];
        return null;
      }
    }
  };
  return recurse(node);
}

/** checkcondition_str: an operand looked up in a tsvector (lexemes in Postgres's order, positions sorted). */
export function vectorCheck(vector: TsVector): Check {
  return (val, data) => {
    // Binary search for the exact lexeme.
    let low = 0;
    let high = vector.length;
    let found = -1;
    while (low < high) {
      const middle = (low + high) >> 1;
      const difference = compareLexemes(val.lexeme, vector[middle].lexeme);
      if (difference === 0) { found = middle; break; }
      if (difference > 0) low = middle + 1;
      else high = middle;
    }
    const positionsOf = (index: number) => (val.weight && !(val.weight & 1) ? [] : vector[index].positions);
    if (!val.prefix) {
      if (found < 0) return NO;
      const positions = positionsOf(found);
      if (val.weight && !positions.length) return NO;
      if (data) data.pos = [...positions];
      return YES;
    }
    // Every lexeme the operand begins, starting where the search stopped.
    let index = found >= 0 ? found : low;
    const all = new Set<number>();
    let any = false;
    while (index < vector.length && compareLexemes(val.lexeme, vector[index].lexeme, true) === 0) {
      const positions = positionsOf(index);
      if (!val.weight || positions.length) {
        any = true;
        for (const position of positions) all.add(position);
      }
      index += 1;
    }
    if (!any) return NO;
    if (data) data.pos = [...all].sort((a, b) => a - b);
    return YES;
  };
}

/** The @@ operator: an empty query matches nothing. */
export function matches(vector: TsVector, query: QNode | null): boolean {
  if (!query) return false;
  return tsExecute(query, vectorCheck(vector));
}
