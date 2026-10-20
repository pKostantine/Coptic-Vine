/**
 * ts_rank_cd(vector, query, 32), cover density ranking, ported from
 * PostgreSQL's src/backend/utils/adt/tsrank.c (calc_rank_cd, Cover,
 * get_docrep): every minimal span of the text that satisfies the query adds
 * its density, and normalization 32 maps the sum to rank / (rank + 1).
 * Computed in doubles and returned as a float4, as Postgres does.
 */
import { compareLexemes } from './chars.ts';
import { tsExecute, NO, YES, type Check } from './execute.ts';
import { items, type QNode, type QVal } from './tsquery.ts';
import type { TsVector } from './tsvector.ts';

/** Default weights {D, C, B, A}, float4 as in the C source. Every position here has weight D. */
const WEIGHT_D = Math.fround(0.1);
const INV_D = 1 / WEIGHT_D;

type DocEntry = { pos: number; entry: number; items: QVal[] };

/** get_docrep: each matching position, with the query operands it satisfies. */
function docRepresentation(vector: TsVector, query: QNode): DocEntry[] {
  const raw: { pos: number; entry: number; item: QVal }[] = [];
  for (const item of items(query)) {
    if (item.type !== 'val') continue;
    // find_wordentry: the exact lexeme, or every lexeme a prefix operand begins.
    let low = 0;
    let high = vector.length;
    let first = -1;
    while (low < high) {
      const middle = (low + high) >> 1;
      const difference = compareLexemes(vector[middle].lexeme, item.lexeme);
      if (difference === 0) { first = middle; break; }
      if (difference < 0) low = middle + 1;
      else high = middle;
    }
    const entries: number[] = [];
    if (item.prefix) {
      for (let i = first >= 0 ? first : low; i < vector.length && compareLexemes(item.lexeme, vector[i].lexeme, true) === 0; i += 1) entries.push(i);
    } else if (first >= 0) entries.push(first);
    for (const entry of entries) {
      if (item.weight && !(item.weight & 1)) continue;
      for (const pos of vector[entry].positions) raw.push({ pos, entry, item });
    }
  }
  if (!raw.length) return [];
  raw.sort((a, b) => a.pos - b.pos || a.entry - b.entry);
  const doc: DocEntry[] = [];
  for (const r of raw) {
    const last = doc[doc.length - 1];
    if (last && last.pos === r.pos && last.entry === r.entry) last.items.push(r.item);
    else doc.push({ pos: r.pos, entry: r.entry, items: [r.item] });
  }
  return doc;
}

type OperandData = { exists: boolean; pos: number[]; reverse: boolean };

export function rankCd(vector: TsVector, query: QNode | null): number {
  if (!query) return 0;
  const doc = docRepresentation(vector, query);
  if (!doc.length) return 0;

  const operands = new Map<QVal, OperandData>();
  const reset = (reverse: boolean) => {
    for (const item of items(query)) if (item.type === 'val') operands.set(item, { exists: false, pos: [], reverse });
  };
  // fillQueryRepresentationData: add an entry's position to each of its operands (no repeats of the last one added).
  const fill = (entry: DocEntry) => {
    for (const item of entry.items) {
      const data = operands.get(item)!;
      data.exists = true;
      if (!data.pos.length) { data.pos.push(entry.pos); continue; }
      if (data.reverse) { if (data.pos[0] !== entry.pos) data.pos.unshift(entry.pos); }
      else if (data.pos[data.pos.length - 1] !== entry.pos) data.pos.push(entry.pos);
    }
  };
  const check: Check = (val, data) => {
    const operand = operands.get(val);
    if (!operand?.exists) return NO;
    if (data) data.pos = [...operand.pos];
    return YES;
  };

  // Cover: the next minimal span (doc indexes begin..end, positions p..q) from ext.pos on.
  const ext = { pos: 0, p: 0, q: 0, begin: 0, end: 0 };
  const cover = (): boolean => {
    for (;;) {
      let lastpos = ext.pos;
      let found = false;
      reset(false);
      ext.p = Number.MAX_SAFE_INTEGER;
      ext.q = 0;
      for (let i = ext.pos; i < doc.length; i += 1) {
        fill(doc[i]);
        if (tsExecute(query, check)) {
          if (doc[i].pos > ext.q) { ext.q = doc[i].pos; ext.end = i; lastpos = i; found = true; }
          break;
        }
      }
      if (!found) return false;
      reset(true);
      let i = lastpos;
      for (; i >= ext.pos; i -= 1) {
        fill(doc[i]);
        if (tsExecute(query, check)) {
          if (doc[i].pos < ext.p) { ext.begin = i; ext.p = doc[i].pos; }
          break;
        }
      }
      if (ext.p <= ext.q) {
        ext.pos = i + 1;
        return true;
      }
      ext.pos += 1;
    }
  };

  let wdoc = 0;
  while (cover()) {
    // Summed one entry at a time, as in C, so the rounding is the same.
    let invSum = 0;
    for (let i = ext.begin; i <= ext.end; i += 1) invSum += INV_D;
    const cpos = (ext.end - ext.begin + 1) / invSum;
    let noise = (ext.q - ext.p) - (ext.end - ext.begin);
    if (noise < 0) noise = Math.trunc((ext.end - ext.begin) / 2);
    wdoc += cpos / (1 + noise);
  }
  wdoc /= wdoc + 1; // normalization 32 (RANK_NORM_RDIVRPLUS1)
  return Math.fround(wdoc);
}
