const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const read = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

test('the tab bar and the sidebar open a section afresh, with nothing beneath it', () => {
  // router.replace swapped only the page a tab was pressed on: Account → Downloads
  // → Books left Account beneath Books, and the next back went to it.
  const tabBar = read('src/components/vine/ui/BottomTabBar.tsx');
  for (const href of ['/', '/books', '/music', '/learn', '/account']) {
    assert.match(tabBar, new RegExp(`onPress=\\{\\(\\) => openSection\\('${href}'\\)\\}`), href);
  }
  assert.doesNotMatch(tabBar, /router\.(replace|push)\(/);
  const sideBar = read('src/components/vine/ui/SideBar.tsx');
  assert.match(sideBar, /onPress=\{\(\) => openSection\(section\.href\)\}/);
  assert.doesNotMatch(sideBar, /router\.(replace|push)\(/);
  // The section becomes the app stack's only page.
  const navigation = read('src/utils/navigation.ts');
  assert.match(navigation, /navigationRef\.dispatch\(\{ type: 'RESET', payload: \{ index: 0, routes: \[\{ name: SECTION_ROUTES\[href\] \}\] \}, target: stack\.key \}\)/);
});

test('each section is reset to a route the app stack really has', () => {
  // A reset to a name the stack lacks is dropped without a word.
  const navigation = read('src/utils/navigation.ts');
  const block = /const SECTION_ROUTES = \{([^}]*)\}/.exec(navigation)[1];
  const routes = Object.fromEntries([...block.matchAll(/'([^']+)': '([^']+)'/g)].map((match) => [match[1], match[2]]));
  assert.deepEqual(Object.keys(routes), ['/', '/books', '/music', '/learn', '/account']);
  const fileFor = (name) => {
    if (name === 'index') return 'src/app/index.tsx';
    if (name.endsWith('/index')) return `src/app/${name}.tsx`;
    // A folder with a layout of its own is named by the folder; a page, by its file.
    return fs.existsSync(`src/app/${name}/_layout.tsx`) ? `src/app/${name}/_layout.tsx` : `src/app/${name}.tsx`;
  };
  for (const [href, name] of Object.entries(routes)) {
    assert.ok(fs.existsSync(fileFor(name)), `${href} → ${name}`);
    if (name.endsWith('/index')) assert.ok(!fs.existsSync(`src/app/${name.replace(/\/index$/, '')}/_layout.tsx`), `${name} has a layout of its own`);
  }
});
