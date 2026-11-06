const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const service = fs.readFileSync('src/services/spiritualCanonService.ts', 'utf8');
const hook = fs.readFileSync('src/hooks/useCanonInstructions.ts', 'utf8');
const card = fs.readFileSync('src/components/canon/CanonInstructions.tsx', 'utf8');
const page = fs.readFileSync('src/app/canon/index.tsx', 'utf8');

/** laterCanonInstructions as the service writes it, run on its own. */
function later() {
  const start = service.indexOf('function writtenTime(');
  const end = service.indexOf('\nexport async function loadLocalCanonInstructions(', start);
  const source = service.slice(start, end)
    .replace('function writtenTime(value: CanonInstructions): number {', 'function writtenTime(value) {')
    .replace('export function laterCanonInstructions(a: CanonInstructions, b: CanonInstructions): CanonInstructions {', 'function laterCanonInstructions(a, b) {');
  return new Function(`${source}\nreturn laterCanonInstructions;`)();
}

test('the later of two copies of the instructions is kept, the first when written at once', () => {
  const pick = later();
  const old = { text: 'Older', updatedAt: '2026-11-01T08:00:00.000Z' };
  const newer = { text: 'Newer', updatedAt: '2026-11-02T08:00:00+00:00' };
  const none = { text: '', updatedAt: null };
  assert.equal(pick(old, newer), newer);
  assert.equal(pick(newer, old), newer);
  assert.equal(pick(none, old), old);
  assert.equal(pick(old, { ...old, text: 'Same time' }), old);
});

test('the instructions are kept on the device per account and in the account through cv-api', () => {
  assert.match(service, /const INSTRUCTIONS_PREFIX = 'cv-spiritual-canon-instructions-v1';/);
  assert.match(service, /api\.rpc\('get_my_canon_instructions'\)/);
  assert.match(service, /api\.rpc\('save_my_canon_instructions', \{ p_instructions: value\.text, p_written_at: value\.updatedAt \}\)/);
  // Written signed out, they go into the account the first time it is signed in to, if it has none.
  assert.match(hook, /const signedOut = await loadLocalCanonInstructions\('local'\);/);
  assert.match(hook, /if \(adopted\) await clearLocalCanonInstructions\('local'\);/);
});

test('the canon page opens with them, folded when long, written in place', () => {
  assert.match(page, /<CanonInstructions text=\{instructions\.text\} arabic=\{arabic\} onChange=\{instructions\.setText\} \/>/);
  assert.ok(page.indexOf('<CanonInstructions') < page.indexOf('<EmptyCanon'), 'above the canon itself');
  assert.match(card, /const FOLDED_LINES = 4;/);
  assert.match(card, /tr\('From your father of confession', 'De votre père de confession', 'من أب اعترافك'\)/);
  assert.match(card, /maxLength=\{20_000\}/);
});
