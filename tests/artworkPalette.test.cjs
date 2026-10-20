const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');

const read = (file) => fs.readFileSync(file, 'utf8');

function load(path) {
  const moduleObject = { exports: {} };
  const output = ts.transpileModule(read(path), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('exports', 'require', 'module', output)(moduleObject.exports, require, moduleObject);
  return moduleObject.exports;
}

const { paletteFromPixels } = load('src/utils/artworkPalette.ts');

/** A cover's pixels: `share` of them each colour, RGBA. */
function cover(parts, size = 48 * 48) {
  const pixels = [];
  for (const [rgb, share] of parts) {
    for (let i = 0; i < Math.round(size * share); i += 1) pixels.push(rgb[0], rgb[1], rgb[2], 255);
  }
  return pixels;
}
const hue = (colour) => Number(/hsla?\((\d+)/.exec(colour)[1]);
const sat = (colour) => Number(/hsla?\(\d+, (\d+)%/.exec(colour)[1]);
const light = (colour) => Number(/hsla?\(\d+, \d+%, (\d+)%/.exec(colour)[1]);

test('a paper-and-ink cover is coloured by its ink, not greyed by its paper', () => {
  // "At Your Feet O My Saviour": cream paper, blue pencil, a warm shadow.
  const palette = paletteFromPixels(cover([
    [[246, 240, 228], 0.78],
    [[84, 112, 178], 0.14],
    [[196, 170, 140], 0.08],
  ]));
  assert.ok(hue(palette.primary) >= 210 && hue(palette.primary) <= 230, `primary ${palette.primary} is the blue`);
  assert.ok(sat(palette.primary) >= 38, 'and coloured, not grey');
  assert.ok(hue(palette.secondary) >= 20 && hue(palette.secondary) <= 45, `secondary ${palette.secondary} is the warm shadow`);
  // Dark enough for the player's white text.
  assert.ok(light(palette.primary) <= 35 && light(palette.secondary) <= 25 && light(palette.deep) <= 10);
  assert.match(palette.panel, /^hsla\(\d+, \d+%, \d+%, 0\.1\)$/);
});

test('a strongly coloured cover leads with its strongest colour', () => {
  const palette = paletteFromPixels(cover([[[200, 30, 40], 0.6], [[20, 20, 20], 0.3], [[240, 200, 60], 0.1]]));
  assert.ok(hue(palette.primary) <= 10 || hue(palette.primary) >= 350, palette.primary);
  assert.ok(hue(palette.secondary) >= 35 && hue(palette.secondary) <= 60, `the gold: ${palette.secondary}`);
});

test('a black-and-white cover keeps its greys', () => {
  const palette = paletteFromPixels(cover([[[240, 240, 240], 0.5], [[30, 30, 30], 0.5]]));
  assert.ok(sat(palette.primary) <= 14 && sat(palette.secondary) <= 10, `${palette.primary} ${palette.secondary}`);
});

test('a cover with one colour runs it into a neighbouring hue; nothing readable gives nothing', () => {
  const palette = paletteFromPixels(cover([[[40, 120, 60], 1]]));
  assert.ok(Math.abs(hue(palette.secondary) - hue(palette.primary)) >= 20);
  assert.equal(paletteFromPixels([0, 0, 0, 0, 10, 10, 10, 0]), null, 'transparent pixels only');
  assert.equal(palette.key, `${palette.primary}|${palette.secondary}`);
});

test('the web reads covers through a small canvas; elsewhere the blurred cover stays', () => {
  const web = read('src/utils/useArtworkPalette.web.ts');
  assert.match(web, /image\.crossOrigin = 'anonymous';/);
  assert.match(web, /context\.drawImage\(image, 0, 0, SAMPLE, SAMPLE\);/);
  assert.match(web, /if \(active && next\) setPalette\(next\);/, 'the last colours stay while the next are read');
  assert.match(read('src/utils/useArtworkPalette.ts'), /return null;/);
  const parts = read('src/components/playback/PlayerParts.tsx');
  assert.match(parts, /\{palette \? <PaletteWash key=\{palette\.key\} palette=\{palette\} \/> : null\}/);
  assert.match(parts, /palette && \[styles\.panelTinted, \{ backgroundColor: palette\.panel \}\]/);
});
