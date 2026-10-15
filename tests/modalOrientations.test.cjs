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
