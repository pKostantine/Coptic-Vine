/**
 * The text-search port against answers taken from Supabase's Postgres.
 * scripts/search-verify.ts compares every verse; scripts/parity.ts compares
 * whole searches. These keep a few known answers in the test suite.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { matches } from '../src/search/execute.ts';
import { searchLiteralNormalize } from '../src/search/normalize.ts';
import { parse } from '../src/search/parser.ts';
import { rankCd } from '../src/search/rank.ts';
import { RENDERINGS, renderingVector } from '../src/search/renderings.ts';
import { buildSearchQuery, phrasetoTsquery } from '../src/search/tsquery.ts';
import { toTsvector, tsvectorText } from '../src/search/tsvector.ts';

const greek = RENDERINGS.find((r) => r.language === 'greek')!;

test('Jude 1:1 in Greek: the same vector as fts_greek', () => {
  const text = 'Ἰούδας Ἰησοῦ χριστοῦ δοῦλος, ἀδελφὸς δὲ Ἰακώβου, τοῖς ἐν θεῷ πατρὶ ἡγιασμένοις, καὶ Ἰησοῦ χριστῷ τετηρημένοις, κλητοῖς·';
  assert.equal(tsvectorText(renderingVector(greek, text)),
    "'αδελφ':5 'δε':6 'δουλ':4 'εν':9 'ηγιασμενοισ':12 'θε':10 'ι':2,14 'ιακωβ':7 'ιουδ':1 'κα':13 'κλητοισ':17 'πατρ':11 'τετηρημενοισ':16 'τοισ':8 'χριστ':3,15");
});

test('a word the Greek stemmer empties is kept whole, as dict_snowball.c keeps it', () => {
  assert.equal(tsvectorText(toTsvector('greek', 'εις εως')), "'εις':1 'εως':2");
});

test('stopwords take positions; hyphenated words give the whole and the parts', () => {
  assert.equal(tsvectorText(toTsvector('english', 'the love of God')), "'god':4 'love':2");
  assert.deepEqual(parse('God-fearing men').map((token) => token.text), ['God-fearing', 'God', '-', 'fearing', ' ', 'men']);
  assert.equal(tsvectorText(toTsvector('english', 'God-fearing')), "'fear':3 'god':2 'god-fear':1");
});

test('a phrase across a stopword keeps its distance (love <2> god)', () => {
  const query = phrasetoTsquery('english', 'love of God')!;
  assert.ok(matches(toTsvector('english', 'the love of God'), query));
  assert.ok(!matches(toTsvector('english', 'love God'), query));
});

test('search_literal_normalize folds Arabic forms and strips tashkeel', () => {
  assert.equal(searchLiteralNormalize('اللَّهُ أَحَبَّ'), 'الله احب');
  assert.equal(searchLiteralNormalize('Θεός, ἀγάπη!'), 'θεοσ αγαπη');
});

test('cover density rank, normalization 32, as a float4', () => {
  const query = buildSearchQuery('love', 'english', 'all', false)!;
  const vector = toTsvector('english', 'But if you love those who love you, what credit is that to you? For even sinners love those who love them.');
  assert.equal(Number(rankCd(vector, query, 32).toPrecision(6)), 0.285714);
});
