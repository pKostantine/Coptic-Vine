const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

/** public/_headers as Workers reads it: a URL pattern, then its indented headers. */
function parseHeadersFile(text) {
  const rules = [];
  for (const line of text.split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) { rules.push({ pattern: line.trim(), headers: {} }); continue; }
    const [name, ...value] = line.trim().split(':');
    rules[rules.length - 1].headers[name.trim()] = value.join(':').trim();
  }
  return rules;
}

test('every static asset response carries the hardening headers', () => {
  const rules = parseHeadersFile(fs.readFileSync('public/_headers', 'utf8'));
  const everything = rules.find((rule) => rule.pattern === '/*');
  assert.ok(everything, 'a /* rule');
  assert.equal(everything.headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(everything.headers['Referrer-Policy'], 'strict-origin-when-cross-origin');
  // The site never uses these; a script that found a way in could not either.
  // Fullscreen (the reader's own button) and picture-in-picture (expo-video) are left alone.
  const permissions = everything.headers['Permissions-Policy'];
  for (const feature of ['camera=()', 'microphone=()', 'geolocation=()']) assert.ok(permissions.includes(feature), feature);
  assert.doesNotMatch(permissions, /fullscreen|picture-in-picture/);
  // Framing is deliberately not restricted here: another Coptic Vine site may embed the app.
  for (const rule of rules) {
    assert.equal(rule.headers['X-Frame-Options'], undefined);
    assert.equal(rule.headers['Content-Security-Policy'], undefined);
  }
});
