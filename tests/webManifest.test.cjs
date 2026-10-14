const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const sharp = require('sharp');

test('the website carries a web app manifest a browser can install from', async () => {
  const manifest = JSON.parse(fs.readFileSync('public/manifest.json', 'utf8'));
  assert.equal(manifest.name, 'Coptic Vine');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  // The splash and status bar wear the app's deep green, as the native splash does.
  assert.equal(manifest.background_color, '#14301B');
  assert.equal(manifest.theme_color, '#14301B');

  // Installability needs a 192 and a 512 for "any", and a maskable one keeps
  // the vine inside a circular crop. Each file must be what it claims.
  const purposes = manifest.icons.map((icon) => `${icon.sizes}:${icon.purpose}`);
  assert.ok(purposes.includes('192x192:any'));
  assert.ok(purposes.includes('512x512:any'));
  assert.ok(purposes.includes('512x512:maskable'));
  for (const icon of manifest.icons) {
    const file = `public${icon.src}`;
    assert.ok(fs.existsSync(file), file);
    const { width, height, format } = await sharp(file).metadata();
    assert.equal(`${width}x${height}`, icon.sizes, file);
    assert.equal(format, 'png', file);
  }
  assert.ok(fs.existsSync('scripts/build-web-icons.mjs'), 'the icons are rebuilt by a script, not by hand');
});

test('the maskable icon keeps the vine inside the safe zone', async () => {
  // A launcher may crop a maskable icon to a circle whose diameter is 80% of
  // the image; whatever lies outside that is lost. Every gold pixel must be
  // inside it, and there must be gold pixels at all — the icon is not a plain
  // green square.
  const { data, info } = await sharp('public/icons/coptic-vine-maskable-512.png').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const centre = info.width / 2;
  const safeRadius = info.width * 0.4;
  let gold = 0;
  let farthest = 0;
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    // Gold is far redder than any of the icon's greens.
    if (r < 150 || r - b < 80) continue;
    gold += 1;
    const pixel = i / 4;
    const x = (pixel % info.width) + 0.5;
    const y = Math.floor(pixel / info.width) + 0.5;
    farthest = Math.max(farthest, Math.hypot(x - centre, y - centre));
  }
  assert.ok(gold > 5000, `expected the vine to be drawn, found ${gold} gold pixels`);
  assert.ok(farthest <= safeRadius, `the vine reaches ${farthest.toFixed(1)}px from the centre; the safe circle ends at ${safeRadius}px`);
});

test('the HTML shell links the manifest and opens as an app from a home screen', () => {
  const html = fs.readFileSync('public/index.html', 'utf8');
  assert.match(html, /<link rel="manifest" href="\/manifest\.json" \/>/);
  assert.match(html, /<meta name="apple-mobile-web-app-capable" content="yes" \/>/);
  assert.match(html, /<meta name="mobile-web-app-capable" content="yes" \/>/);
  assert.match(html, /<meta name="apple-mobile-web-app-title" content="Coptic Vine" \/>/);
  // Running behind the status bar relies on the layout keeping clear of it.
  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /<meta name="theme-color" content="#14301B" \/>/);
  // The share-metadata block the Cloudflare Worker replaces must survive the edit.
  assert.match(html, /COPTIC_VINE_SHARE_META_START[\s\S]*COPTIC_VINE_SHARE_META_END/);
});

test('the page’s lang attribute follows the App Language on the web', () => {
  const provider = fs.readFileSync('src/context/ReadingPreferencesContext.tsx', 'utf8');
  assert.match(provider, /document\.documentElement\.lang = preferences\.appLanguage/);
  assert.match(provider, /Platform\.OS !== 'web'/);
});
