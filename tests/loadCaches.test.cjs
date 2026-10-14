const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

/**
 * Every session-long promise cache in the data layer must drop a load that
 * failed. Otherwise one lost connection while opening a service keeps that
 * date, book or title failing on every retry (and every re-entry) until the
 * app restarts — which is exactly what the reader's Retry button would then
 * be unable to fix.
 */
test('a load that failed is not kept in any of the data layer’s promise caches', () => {
  const hymnLibrary = fs.readFileSync('src/utils/hymnLibrary.js', 'utf8');
  const readingsService = fs.readFileSync('src/utils/readingsService.ts', 'utf8');

  // The single-slot caches hold the date being read; the failed promise is
  // cleared only if it is still the one in the slot.
  assert.match(hymnLibrary, /promise\.catch\(\(\) => \{\s*if \(readingsForDateCache\?\.promise === promise\) readingsForDateCache = null;/);
  assert.match(hymnLibrary, /promise\.catch\(\(\) => \{\s*if \(synaxariumCache\?\.promise === promise\) synaxariumCache = null;/);

  // The keyed caches delete their key, as paschaReadingsCache already did.
  for (const [source, cache, key] of [
    [hymnLibrary, 'bibleBookTitleCache', 'bookKey'],
    [hymnLibrary, 'paschaReadingsCache', 'key'],
    [readingsService, 'bookKeyByCalendarNumberCache', 'bookNum'],
    [readingsService, 'bookTitleCache', 'bookNum'],
  ]) {
    assert.match(source, new RegExp(`cached\\.catch\\(\\(\\) => ${cache}\\.delete\\(${key}\\)\\)`), cache);
  }

  // The condition engine's caches — the first thing every document loads —
  // all go through rememberInCache, which does the forgetting for them.
  const conditionEngine = fs.readFileSync('src/utils/conditionEngine.js', 'utf8');
  assert.match(conditionEngine, /value\.catch\(\(\) => \{\s*if \(cache\.get\(key\) === value\) cache\.delete\(key\);/);
  for (const cache of ['lentFlagsCache', 'contextFlagsCache', 'gospelAuthorsByDateCache', 'gospelBookKeyCache']) {
    assert.match(conditionEngine, new RegExp(`rememberInCache\\(${cache}, `), cache);
    assert.doesNotMatch(conditionEngine, new RegExp(`${cache}\\.set\\(`), `${cache} must not bypass rememberInCache`);
  }
});

/** rememberInCache, run for real: a rejected load leaves the cache, a resolved one stays, and a retry's promise is never evicted by the earlier failure. */
test('rememberInCache forgets a failed load but keeps a successful one', async () => {
  const source = fs.readFileSync('src/utils/conditionEngine.js', 'utf8');
  const body = source.match(/function rememberInCache\(cache, key, value\) \{[\s\S]*?\n\}/)[0];
  const rememberInCache = new Function('MAX_CACHE_ENTRIES', `${body}; return rememberInCache;`)(200);

  const cache = new Map();
  const failed = Promise.reject(new Error('Failed to fetch'));
  rememberInCache(cache, 'k', failed);
  await failed.catch(() => {});
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(cache.has('k'), false, 'a failed load is forgotten');

  const ok = Promise.resolve({ Lent: true });
  rememberInCache(cache, 'k', ok);
  await ok;
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(cache.get('k'), ok, 'a successful load is kept');

  // A retry replaces the slot before the first failure settles: the failure
  // must not knock the retry's promise out.
  const slowFailure = new Promise((_, reject) => setTimeout(() => reject(new Error('late')), 10));
  rememberInCache(cache, 'j', slowFailure);
  const retry = Promise.resolve('fresh');
  rememberInCache(cache, 'j', retry);
  await slowFailure.catch(() => {});
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(cache.get('j'), retry, 'the retry stays cached');
});
