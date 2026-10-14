const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const sharp = require('sharp');

/**
 * The seal as drawn on screen is a small file. The full seal is ~800KB and
 * was the single largest download on the website's first load, for an image
 * never drawn larger than 188 points.
 */
test('the on-screen seal is a fraction of the full seal, at a size that still covers a 3x display', async () => {
  const screen = 'assets/images/coptic-vine-seal-screen.png';
  const full = 'assets/images/coptic-vine-seal.png';
  assert.ok(fs.existsSync(screen));
  const { width, height, format } = await sharp(screen).metadata();
  assert.equal(format, 'png');
  assert.equal(width, 600);
  assert.equal(height, 600);
  const screenBytes = fs.statSync(screen).size;
  assert.ok(screenBytes < 160 * 1024, `screen seal is ${(screenBytes / 1024).toFixed(0)}KB`);
  assert.ok(screenBytes < fs.statSync(full).size / 4, 'the screen seal should be well under a quarter of the full seal');
  assert.ok(fs.existsSync('scripts/build-screen-seal.mjs'), 'rebuilt by a script, not by hand');
});

test('every on-screen use draws the screen seal; the full seal stays for the splash and share card', () => {
  for (const file of [
    'src/components/vine/screens/HomeScreen.tsx',
    'src/components/vine/ui/SideBar.tsx',
    'src/components/vine/ui/LoadingScreen.tsx',
    'src/components/vine/ui/NoticeScreen.tsx',
  ]) {
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, /coptic-vine-seal-screen\.png/, file);
    assert.doesNotMatch(source, /coptic-vine-seal\.png/, `${file} still draws the full seal`);
  }
  assert.match(fs.readFileSync('app.json', 'utf8'), /coptic-vine-seal\.png/, 'the splash keeps the full seal');
  assert.match(fs.readFileSync('scripts/build-share-card.mjs', 'utf8'), /coptic-vine-seal\.png/, 'the share card keeps the full seal');
});
