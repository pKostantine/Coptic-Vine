const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

/**
 * Beta Feedback #4: on Safari on an iPhone, typing an Other Canon's name
 * showed only its end. Safari zooms into a field smaller than 16px as it is
 * focused and scrolls with the caret; the page (public/index.html, the
 * template web.output "single" uses) stops that zoom on iOS alone.
 */
const html = fs.readFileSync('public/index.html', 'utf8');
const script = html.match(/<script>\s*\/\/ Safari on iPhone[\s\S]*?<\/script>/)[0].replace(/<\/?script>/g, '');

function viewportFor(navigator) {
  const viewport = { content: 'width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover' };
  new Function('navigator', 'document', script)(navigator, { querySelector: () => viewport });
  return viewport.content;
}

test('an iPhone or iPad stops zooming into a field as it is focused; nothing else changes', () => {
  const iphone = { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1', platform: 'iPhone', maxTouchPoints: 5 };
  const ipad = { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15', platform: 'MacIntel', maxTouchPoints: 5 };
  const mac = { ...ipad, maxTouchPoints: 0 };
  const android = { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36', platform: 'Linux armv8l', maxTouchPoints: 5 };
  assert.match(viewportFor(iphone), /viewport-fit=cover, maximum-scale=1$/);
  assert.match(viewportFor(ipad), /maximum-scale=1$/);
  // A Mac's browser and Android keep pinching to zoom as they were.
  assert.doesNotMatch(viewportFor(mac), /maximum-scale/);
  assert.doesNotMatch(viewportFor(android), /maximum-scale/);
  // It runs before the app, in the page's head, and the meta it changes is above it.
  assert.ok(html.indexOf('name="viewport"') < html.indexOf('// Safari on iPhone'));
  assert.ok(html.indexOf('// Safari on iPhone') < html.indexOf('</head>'));
});

test('a field in a card with a gradient ground is drawn above that ground (Beta Feedback #4)', () => {
  // EditorCard and many cards lay a LinearGradient over the whole card; on
  // the web it painted over the unpositioned <input>, hiding the box and
  // what was typed into it.
  const reset = html.match(/<style id="expo-reset">[\s\S]*?<\/style>/)[0];
  assert.match(reset, /input,\s*textarea\s*\{\s*position: relative;\s*\}/);
  const card = fs.readFileSync('src/components/canon/CanonEditorParts.tsx', 'utf8');
  assert.match(card, /<LinearGradient [^>]*style=\{StyleSheet\.absoluteFill\}/, 'the case it guards against is still there');
});
