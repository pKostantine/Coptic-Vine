const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');

/** The file compiles as TypeScript/JSX; the surest cheap check that a screen is well-formed. */
function transpiles(path) {
  const { diagnostics } = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
    reportDiagnostics: true,
  });
  assert.deepEqual((diagnostics || []).map((d) => d.messageText), [], path);
}

test('a page that throws is shown as the app’s own notice, from the root layout', () => {
  const layout = fs.readFileSync('src/app/_layout.tsx', 'utf8');
  assert.match(layout, /export \{ default as ErrorBoundary \} from '@\/components\/vine\/screens\/AppErrorScreen'/);

  // Expo Router draws the boundary in place of the whole layout, so nothing
  // the layout provides is available to it: it has to bring its own safe area
  // and read the language from the module store, not the context.
  const screen = fs.readFileSync('src/components/vine/screens/AppErrorScreen.tsx', 'utf8');
  assert.match(screen, /<SafeAreaProvider>/);
  assert.match(screen, /getCurrentAppLanguage\(\)/);
  assert.doesNotMatch(screen, /useReadingPreferences/);
  assert.match(screen, /retry\(\)/);
  transpiles('src/components/vine/screens/AppErrorScreen.tsx');
  transpiles('src/components/vine/ui/NoticeScreen.tsx');
});

test('an address that leads nowhere gets the branded page, on the website and on a bad service id', () => {
  assert.ok(fs.existsSync('src/app/+not-found.tsx'));
  assert.match(fs.readFileSync('src/app/+not-found.tsx', 'utf8'), /NotFoundScreen/);
  transpiles('src/components/vine/screens/NotFoundScreen.tsx');

  // Every route that looks a manifest entry up by id used to render nothing
  // at all when the id was unknown — a black screen with no way back.
  const routes = [
    'src/app/psalmody/[serviceId].tsx',
    'src/app/agpeya/[serviceId].tsx',
    'src/app/lectionary/[serviceId].tsx',
    'src/app/liturgy/divine-liturgy/[serviceId].tsx',
    'src/app/liturgy/raising-of-incense/[serviceId].tsx',
    'src/app/holy-week/[dayId]/index.tsx',
    'src/app/holy-week/[dayId]/[hourId].tsx',
  ];
  for (const route of routes) {
    const source = fs.readFileSync(route, 'utf8');
    assert.doesNotMatch(source, /return null;/, route);
    assert.match(source, /<NotFoundScreen backHref="\/[a-z-]+" \/>/, route);
  }
});
