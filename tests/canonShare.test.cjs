const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const service = fs.readFileSync('src/services/spiritualCanonService.ts', 'utf8');
const sharePage = fs.readFileSync('src/app/canon/share.tsx', 'utf8');
const sharedPage = fs.readFileSync('src/app/canon/shared/[id].tsx', 'utf8');
const notice = fs.readFileSync('src/components/canon/CanonShareNotice.tsx', 'utf8');
const canonPage = fs.readFileSync('src/app/canon/index.tsx', 'utf8');

test('the disclaimer: share only with the permission of your father of confession', () => {
  assert.match(notice, /'Share only with the permission of your father of confession'/);
  assert.match(notice, /'Ask your father of confession before taking this on'/);
  assert.match(sharePage, /<CanonShareNotice side="sharing" arabic=\{arabic\} \/>/);
  assert.match(sharedPage, /<CanonShareNotice side="receiving" arabic=\{arabic\} \/>/);
  assert.ok(sharePage.indexOf('<CanonShareNotice') < sharePage.indexOf('What to share'), 'before anything is chosen');
});

test('no link is made until the believer says their father of confession has permitted it', () => {
  assert.match(sharePage, /const canCreate = blessed && chosen\.size > 0 && !busy && canon\.loaded;/);
  assert.match(sharePage, /disabled=\{!canCreate\}/);
  assert.match(sharePage, /My father of confession has given me his permission to share this\./);
  // The instructions go only when chosen, off to begin with.
  assert.match(sharePage, /const \[withInstructions, setWithInstructions\] = useState\(false\);/);
  assert.match(sharePage, /instructions: withInstructions && hasInstructions \? instructions\.text : null/);
});

test('shared items leave their reminders behind; taken in, they are items of one’s own', () => {
  assert.match(service, /return \{ \.\.\.base, remind: false \} as CanonItem;/);
  assert.match(service, /hours: quiet\(base\.hours\), days: base\.days\.map\(quiet\)/);
  assert.match(service, /\{ \.\.\.sharedCanonItem\(item\), id: newCanonId\(\), createdAt: stamp, updatedAt: stamp \}/);
  assert.match(service, /api\.rpc\('create_canon_share'/);
  assert.match(service, /api\.rpc\('get_canon_share', \{ p_id: id \}\)/);
  assert.match(service, /api\.rpc\('delete_my_canon_share', \{ p_id: id \}\)/);
  assert.match(service, /publicUrl\(`\/canon\/shared\/\$\{encodeURIComponent\(id\)\}`\)/);
});

test('the canon page leads to sharing; a shared canon is never indexed', () => {
  assert.match(canonPage, /router\.push\('\/canon\/share' as never\)/);
  assert.match(sharedPage, /<meta name="robots" content="noindex" \/>/);
  assert.match(sharedPage, /canon\.saveItem\(adoptedCanonItem\(item\)\)/);
});
