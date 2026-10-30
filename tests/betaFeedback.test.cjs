const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');

/**
 * The beta's feedback in the app (app/feedback.tsx, utils/betaFeedback.ts,
 * services/betaFeedbackService.ts): reached from Home and the Account page,
 * filed with the device it was seen on, and every report public, numbered
 * as issues are. cv-api's side is tested in workers/api/tests/betaFeedback.test.ts.
 */

function loadFile(path, resolve = require) {
  const js = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('exports', 'require', 'module', js)(module.exports, resolve, module);
  return module.exports;
}
const read = (file) => fs.readFileSync(file, 'utf8');
const feedback = loadFile('src/utils/betaFeedback.ts');

test('each report carries the device it was seen on, as briefly as it can say it', () => {
  const { describeDevice } = feedback;
  assert.equal(describeDevice({ os: 'ios', version: '27.1', appVersion: '1.0.0' }), 'iOS 27.1 · app 1.0.0');
  assert.equal(describeDevice({ os: 'android', version: 35, appVersion: '1.0.0' }), 'Android (API 35) · app 1.0.0');
  assert.equal(describeDevice({ os: 'ios', version: null, appVersion: null }), 'iOS');
  const iphoneSafari = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
  assert.equal(describeDevice({ os: 'web', userAgent: iphoneSafari, appVersion: '1.0.0' }), 'Web · Safari on iPhone · app 1.0.0');
  const macChrome = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
  assert.equal(describeDevice({ os: 'web', userAgent: macChrome }), 'Web · Chrome on Mac');
  const windowsEdge = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0';
  assert.equal(describeDevice({ os: 'web', userAgent: windowsEdge }), 'Web · Edge on Windows');
  assert.equal(describeDevice({ os: 'web', userAgent: '' }), 'Web');
  assert.ok(describeDevice({ os: 'ios', version: 'x'.repeat(400) }).length <= 200, 'never longer than cv-api keeps');
});

test('the list shows what is still open, what is closed, or everything, in the order it came', () => {
  const { filterFeedback, isOpenFeedback, FEEDBACK_STATUSES } = feedback;
  const items = FEEDBACK_STATUSES.map((status, index) => ({ number: 10 - index, status }));
  assert.deepEqual(filterFeedback(items, 'open').map((item) => item.status), ['open', 'planned']);
  assert.deepEqual(filterFeedback(items, 'done').map((item) => item.status), ['fixed', 'not_planned', 'duplicate']);
  assert.deepEqual(filterFeedback(items, 'all').map((item) => item.number), [10, 9, 8, 7, 6]);
  assert.equal(isOpenFeedback({ status: 'planned' }), true);
  assert.equal(isOpenFeedback({ status: 'fixed' }), false);
});

test("the app and cv-api agree on the kinds, the statuses and how long each field may be", () => {
  const api = read('workers/api/src/rpc/feedback.ts');
  const migration = read('workers/content-api/migrations/0036_beta_feedback.sql');
  assert.match(api, new RegExp(`FEEDBACK_KINDS = \\[${feedback.FEEDBACK_KINDS.map((kind) => `'${kind}'`).join(', ')}\\] as const;`));
  assert.match(api, new RegExp(`FEEDBACK_STATUSES = \\[${feedback.FEEDBACK_STATUSES.map((status) => `'${status}'`).join(', ')}\\] as const;`));
  assert.match(migration, new RegExp(`CHECK \\("kind" IN \\(${feedback.FEEDBACK_KINDS.map((kind) => `'${kind}'`).join(', ')}\\)\\)`));
  assert.match(migration, new RegExp(`CHECK \\("status" IN \\(${feedback.FEEDBACK_STATUSES.map((status) => `'${status}'`).join(', ')}\\)\\)`));
  const { title, details, area, name, note } = feedback.FEEDBACK_LIMITS;
  assert.match(api, new RegExp(`FEEDBACK_LIMITS = \\{ title: ${title}, details: ${details}, area: ${area}, device: 200, name: ${name}, note: ${note} \\} as const;`));
  assert.match(migration, new RegExp(`length\\("title"\\) BETWEEN 1 AND ${title}`));
  assert.match(migration, new RegExp(`length\\("details"\\) <= ${details}`));
  // Applied by hand before wrangler applies it, it changes nothing the second time.
  assert.equal((migration.match(/CREATE TABLE IF NOT EXISTS|CREATE INDEX IF NOT EXISTS/g) || []).length, 3);
});

test('the page files and lists through cv-api, and Home and the Account page lead to it', () => {
  const service = read('src/services/betaFeedbackService.ts');
  for (const fn of ['list_beta_feedback', 'submit_beta_feedback', 'admin_update_beta_feedback', 'admin_delete_beta_feedback']) {
    assert.match(service, new RegExp(`api\\.rpc\\('${fn}'`), fn);
  }
  assert.match(service, /p_device: thisDevice\(\),/);

  const page = read('src/app/feedback.tsx');
  assert.match(page, /useFocusEffect\(useCallback\(\(\) => \{\s+void load\(\);\s+\}, \[load\]\)\);/);
  // A name is asked for only when signed out; signed in, the account's goes with it.
  assert.match(page, /\{!user \? \(\s+<Field label=\{tr\('Your name \(optional\)'/);
  // An admin's controls only for an admin, as cv-api says.
  assert.match(page, /\{canManage \? \(\s+<View style=\{styles\.manage\}>/);
  assert.match(page, /<BottomTabBar active=\{null\} \/>/);

  const home = read('src/components/vine/screens/HomeScreen.tsx');
  assert.match(home, /onPress=\{\(\) => router\.push\('\/feedback' as never\)\}/);
  assert.equal((home.match(/\{feedbackCard\}/g) || []).length, 4, 'in every layout of Home');
  // The first of the cards, under the seal and the date: before Pray now on a phone, the desktop and the iPad, heading the cards beside them on a phone on its side.
  assert.match(home, /\{hero\}\s+\{feedbackCard\}\s+\{prayCard\}\s+\{canonCard\}/, 'a phone');
  assert.match(home, /\{hero\}\s+\{feedbackCard\}\s+\{prayCard\}\s+<\/View>/, 'the desktop');
  assert.match(home, /<View style=\{styles\.column\}>\{hero\}<\/View>\s+<View style=\{styles\.column\}>\s+\{feedbackCard\}\s+\{prayCard\}/, 'the iPad');
  assert.match(home, /contentContainerStyle=\{styles\.landscapeCards\}>\s+\{feedbackCard\}\s+\{canonCard\}/, 'a phone on its side');
  const account = read('src/app/account.tsx');
  assert.match(account, /icon="construct-outline"\s+label=\{tr\('Beta feedback'/);
  assert.match(account, /onPress=\{\(\) => router\.push\('\/feedback' as never\)\}/);
  // On a desktop, the sidebar lights up Home, where it is reached from.
  assert.match(read('src/components/vine/ui/SideBar.tsx'), /pathname\.startsWith\('\/feedback'\)\) return 'home';/);
});
