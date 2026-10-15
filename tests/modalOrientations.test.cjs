const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(tsx|jsx)$/.test(entry.name) ? [full] : [];
  });
}

test('every Modal says which orientations it may take', () => {
  // Left out, iOS presents a Modal portrait-only, and an iPad held in
  // landscape aborts the app opening it ("no common orientation") -- which
  // is how Book Settings crashed the app on the iPad.
  // A tag ends at the first ">" outside its props' braces (an arrow's "=>" is inside them).
  const openingTag = (source, start) => {
    let depth = 0;
    for (let i = start; i < source.length; i += 1) {
      if (source[i] === '{') depth += 1;
      else if (source[i] === '}') depth -= 1;
      else if (source[i] === '>' && depth === 0) return source.slice(start, i + 1);
    }
    return source.slice(start);
  };
  const missing = [];
  for (const file of sourceFiles('src')) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(/<Modal\b/g)) {
      const tag = openingTag(source, match.index);
      if (!/supportedOrientations=\{modalOrientations\}/.test(tag)) missing.push(`${file}: ${tag.slice(0, 80)}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('a Modal keeps to the orientation lock the screens follow', () => {
  const hook = fs.readFileSync('src/hooks/useModalOrientations.ts', 'utf8');
  assert.match(hook, /if \(mode === 'portrait'\) return PORTRAIT;/);
  assert.match(hook, /const PORTRAIT: ModalOrientations = \['portrait'\];/);
  // Both landscapes for either landscape lock: never only the one, whose
  // left/right naming differs between React Native and the screens.
  assert.match(hook, /const LANDSCAPE: ModalOrientations = \['landscape', 'landscape-left', 'landscape-right'\];/);
  assert.match(hook, /if \(mode === 'landscape' \|\| mode === 'reverseLandscape'\) return LANDSCAPE;/);
  assert.match(hook, /return MODAL_SUPPORTED_ORIENTATIONS;/);
  const all = fs.readFileSync('src/utils/modalOrientations.ts', 'utf8');
  assert.match(all, /\['portrait', 'portrait-upside-down', 'landscape', 'landscape-left', 'landscape-right'\]/);
});

test('a phone keeps its pages upright and turns only its readers; a tablet turns everything', () => {
  const ts = require('typescript');
  const js = ts.transpileModule(fs.readFileSync('src/utils/screenOrientation.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function('exports', 'require', 'module', js)(module.exports, require, module);
  const { screenOrientationFor } = module.exports;
  assert.equal(screenOrientationFor('auto', { phone: true, reader: false }), 'portrait_up');
  assert.equal(screenOrientationFor('landscape', { phone: true, reader: false }), 'portrait_up');
  assert.equal(screenOrientationFor('auto', { phone: true, reader: true }), 'default');
  assert.equal(screenOrientationFor('landscape', { phone: true, reader: true }), 'landscape_right');
  assert.equal(screenOrientationFor('auto', { phone: false, reader: false }), 'default');
  assert.equal(screenOrientationFor('portrait', { phone: false, reader: false }), 'portrait_up');

  // The stack holds every screen to the page rule; the two readers set their own.
  assert.match(fs.readFileSync('src/app/_layout.tsx', 'utf8'), /screenOrientationFor\(preferences\.orientationMode, \{ phone: READING_DEVICE_CLASS === 'phone', reader: false \}\)/);
  for (const reader of ['src/components/vine/screens/ServiceDocument.tsx', 'src/app/bible/[bookKey]/[chapter].tsx']) {
    const source = fs.readFileSync(reader, 'utf8');
    assert.match(source, /orientation: screenOrientationFor\(preferences\.orientationMode, \{ phone: READING_DEVICE_CLASS === 'phone', reader: true \}\)/, reader);
    assert.match(source, /<ReaderScreenContext\.Provider value>/, reader);
  }
  // A sheet over a phone's upright page stays upright; a phone keeps the phone layout on its side.
  assert.match(fs.readFileSync('src/hooks/useModalOrientations.ts', 'utf8'), /if \(READING_DEVICE_CLASS === 'phone' && !reader\) return PORTRAIT;/);
  assert.match(fs.readFileSync('src/utils/useLayoutMode.ts', 'utf8'), /if \(Platform\.OS !== 'web' && READING_DEVICE_CLASS === 'phone'\) return 'phone';/);
});
