/**
 * The search's text functions against Supabase's own answers, recorded in
 * tests/fixtures/search-text.json: Arabic with tashkeel, hamza forms, tatweel
 * and Arabic-Indic digits; Coptic with jinkims and combining marks; Greek,
 * French, ligatures, fullwidth letters, emoji. The PGlite oracle can't check
 * these: its collation is C, so [[:alnum:]] and pg_trgm's words are ASCII.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { setweight, toTsvector, tsvectorConcat, tsvectorText, parseTsvectorText, WEIGHT } from '../../content-api/src/search/tsvector.ts';
import { roundNumeric } from '../src/pg.ts';
import { normalizeSearchText, similarity, trigrams } from '../src/rpc/search/text.ts';

type Fixture = {
  texts: { text: string; normalized: string; trigrams: string[]; normalizedTrigrams: string[] }[];
  pairs: { a: string; b: string; similarity: string }[];
};
const fixture = JSON.parse(readFileSync(new URL('./fixtures/search-text.json', import.meta.url), 'utf8')) as Fixture;

/** A trigram as show_trgm prints it: its three characters, or 0x and the hex of its three stored bytes. */
function key(shown: string): number {
  if (/^0x[0-9a-f]{6}$/.test(shown)) return parseInt(shown.slice(2), 16);
  const [b0, b1, b2] = new TextEncoder().encode(shown);
  return (b0 << 16) | (b1 << 8) | b2;
}

test('normalize_search_text gives what Supabase gives', () => {
  for (const { text, normalized } of fixture.texts) assert.equal(normalizeSearchText(text), normalized, JSON.stringify(text));
  assert.equal(normalizeSearchText(null), '');
});

test("pg_trgm's trigrams, hashed ones included, are Supabase's", () => {
  for (const { text, normalized, trigrams: raw, normalizedTrigrams } of fixture.texts) {
    assert.deepEqual([...trigrams(text)].sort((a, b) => a - b), raw.map(key).sort((a, b) => a - b), JSON.stringify(text));
    assert.deepEqual([...trigrams(normalized)].sort((a, b) => a - b), normalizedTrigrams.map(key).sort((a, b) => a - b), JSON.stringify(normalized));
  }
});

test('similarity is a float4 that prints as Supabase printed it', () => {
  for (const { a, b, similarity: shown } of fixture.pairs) {
    assert.equal(Number(similarity(a, b).toPrecision(6)), Number(shown), `${a} / ${b}`);
  }
  assert.equal(similarity('abc', 'abc'), 1);
  assert.equal(similarity('', ''), 0);
});

test('weighted tsvectors concatenate as || does', () => {
  const vector = tsvectorConcat(tsvectorConcat(setweight(toTsvector('simple', 'kiahk praise'), WEIGHT.A), setweight(toTsvector('simple', ''), WEIGHT.B)),
    setweight(toTsvector('simple', 'praise kiahk kiahk'), WEIGHT.C));
  assert.equal(tsvectorText(vector), "'kiahk':1A,4C,5C 'praise':2A,3C");
  assert.deepEqual(parseTsvectorText(tsvectorText(vector)), vector);
});

test('round(double precision::numeric, 3) keeps 15 digits, then rounds half away from zero', () => {
  assert.equal(roundNumeric(124.0005, 3), 124.001); // 124.000499999999998… prints as 124.000500000000
  assert.equal(roundNumeric(62 + Math.fround(0.1) * 28, 3), 64.8);
  assert.equal(roundNumeric(99.9995, 3), 100);
  assert.equal(roundNumeric(-2.5, 0), -3);
  assert.equal(roundNumeric(0, 3), 0);
});
