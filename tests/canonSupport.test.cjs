const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const read = (path) => fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const service = read('src/services/spiritualCanonService.ts');
const supporters = read('src/app/canon/supporters.tsx');
const invitePage = read('src/app/canon/invite/[id].tsx');
const supporting = read('src/app/canon/supporting/[id].tsx');
const notice = read('src/components/canon/CanonSupportNotice.tsx');
const canonPage = read('src/app/canon/index.tsx');
const parts = read('src/components/canon/CanonParts.tsx');

test('the word on support: invite only with your father of confession’s permission; keep what you see in prayer', () => {
  assert.match(notice, /'Invite only with the permission of your father of confession'/);
  assert.match(notice, /'Keep what you see in prayer, and to yourself'/);
  assert.match(supporters, /<CanonSupportNotice side="inviting" arabic=\{arabic\} \/>/);
  assert.match(invitePage, /<CanonSupportNotice side="supporting" arabic=\{arabic\} \/>/);
  assert.ok(supporters.indexOf('<CanonSupportNotice') < supporters.indexOf('Your Support People'), 'before anything else');
});

test('no box to tick for the permission: the notice says it, the link is made at once', () => {
  assert.doesNotMatch(supporters, /has given me his permission|blessed/);
  assert.match(supporters, /disabled=\{busy\}/);
  // The instructions go only when chosen, off to begin with.
  assert.match(supporters, /const \[withInstructions, setWithInstructions\] = useState\(false\);/);
  assert.match(supporters, /createCanonSupportInvite\(\{ name, message, withInstructions: withInstructions && hasInstructions \}\)/);
});

test('an invite link is accepted, and the one who accepted sees the canon live, through cv-api', () => {
  for (const rpc of ['create_canon_support_invite', 'list_my_canon_support_invites', 'list_my_canon_supporters', 'list_canons_i_support']) {
    assert.match(service, new RegExp(`api\\.rpc\\('${rpc}'`));
  }
  assert.match(service, /api\.rpc\('accept_canon_support_invite', \{ p_id: id \}\)/);
  assert.match(service, /api\.rpc\('get_supported_canon', \{ p_id: id, p_from_day: fromDay, p_to_day: toDay \}\)/);
  assert.match(service, /api\.rpc\('remove_my_canon_supporter', \{ p_id: id \}\)/);
  assert.match(service, /api\.rpc\('stop_supporting_canon', \{ p_id: id \}\)/);
  // The sharer's App Language rides along, for the link's preview (workers/web-app).
  assert.match(service, /const path = `\/canon\/invite\/\$\{encodeURIComponent\(id\)\}`;/);
  assert.match(service, /publicUrl\(language === 'en' \? path : `\$\{path\}\?lang=\$\{language\}`\)/);
  assert.match(invitePage, /const person = await acceptCanonSupportInvite\(linkId\);\n\s+openCanon\(person\.id\);/);
  assert.match(invitePage, /<meta name="robots" content="noindex" \/>/);
});

test('a supported canon is shown as it was kept, and nothing in it can be changed', () => {
  assert.match(supporting, /loadSupportedCanon\(supportId, weekStart, addCanonDays\(weekStart, 6\)\)/);
  assert.match(supporting, /<CanonTaskRow key=\{task\.key\} task=\{task\} arabic=\{arabic\} readOnly \/>/);
  assert.match(supporting, /<CanonSkippedRow key=\{task\.key\} task=\{task\} arabic=\{arabic\} first=\{index === 0\} \/>/);
  assert.doesNotMatch(supporting, /setTaskDone|setTaskSkipped|saveItem|onChange=/);
  assert.match(parts, /if \(readOnly\) \{\n\s+return \(\n\s+<View style=\{\[styles\.row, styles\.rowCard\]\} accessible accessibilityLabel=\{checkLabel\}>/);
});

test('the canon page leads to one’s support people, and to those one supports', () => {
  assert.match(canonPage, /router\.push\('\/canon\/supporters' as never\)/);
  assert.match(canonPage, /router\.push\(`\/canon\/supporting\/\$\{encodeURIComponent\(person\.id\)\}` as never\)/);
  assert.match(canonPage, /<CanonWeekCard day=\{day\} today=\{canon\.today\} arabic=\{arabic\} stateOf=\{stateOf\} onChoose=\{setChosen\} \/>/);
});
