const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');

/**
 * A saint's Synaxarium entry as a document of its own, from Home's
 * Commemorated Saints (utils/synaxariumEntryDocument.ts,
 * app/synaxarium/[entryKey].tsx): the reader every book opens in, the saint's
 * name in its headpiece, the day under it, the commemoration after.
 */

/** Loads a TypeScript or JavaScript module as CommonJS, with its imports resolved by `resolve` where given. */
function loadFile(path, resolve = require) {
  const js = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('exports', 'require', 'module', js)(module.exports, resolve, module);
  return module.exports;
}
const read = (file) => fs.readFileSync(file, 'utf8');

function loadDocument({ appLanguage = 'en', entry = null, coptic = null } = {}) {
  const preferencesStorage = { getCurrentAppLanguage: () => appLanguage };
  const local = {
    './preferencesStorage': preferencesStorage,
    './dateUtils': loadFile('src/utils/dateUtils.js'),
    './calendarService': { getCopticDate: async () => coptic },
    './hymnLibrary': { resolveSynaxariumEntry: async () => entry },
  };
  local['./appText'] = loadFile('src/utils/appText.ts', (name) => local[name] || require(name));
  local['./localeFormat'] = loadFile('src/utils/localeFormat.ts', (name) => local[name] || require(name));
  return loadFile('src/utils/synaxariumEntryDocument.ts', (name) => local[name] || require(name));
}

const PAOPE_19 = { monthName: 'Paope', day: 19, year: 1743 };
const ENTRY = {
  title: { english: 'The Martyrdom of Sts. Theophilus and His Wife in Fayyum', arabic: 'استشهاد القديس ثاؤفيلس وزوجته' },
  verses: [
    { type: 'verse', english: 'On this day, St. Theophilus and his wife were martyred.', arabic: 'في مثل هذا اليوم', coptic: null, dropCap: true },
    { type: 'verse', english: 'The blessing of their prayers be with us all. Amen.', arabic: 'بركة صلواتهم فلتكن معنا أمين.', coptic: null },
  ],
};

test("the saint's day reads as Home's card reads it, in every language at once", () => {
  for (const appLanguage of ['en', 'fr', 'ar']) {
    const { synaxariumDayLine } = loadDocument({ appLanguage });
    assert.deepEqual(synaxariumDayLine('2026-10-29', PAOPE_19), {
      english: 'Paope 19 · October 28–29',
      french: '19 Paope · 28–29 octobre',
      arabic: '١٩ بابه · ٢٨–٢٩ أكتوبر',
    }, `whatever the App Language (${appLanguage})`);
  }
  const { synaxariumDayLine } = loadDocument();
  // A day that begins the evening of the month before.
  assert.equal(synaxariumDayLine('2026-11-01', { monthName: 'Paope', day: 22, year: 1743 }).english, 'Paope 22 · October 31 – November 1');
  // A day the calendar can't name: the Gregorian days alone.
  assert.deepEqual(synaxariumDayLine('2026-10-29', null), { english: 'October 28–29', french: '28–29 octobre', arabic: '٢٨–٢٩ أكتوبر' });
});

test('the document opens on the saint, then the day as a citation, then the commemoration from its first paragraph', async () => {
  const { loadSynaxariumEntryDocument } = loadDocument({ entry: ENTRY, coptic: PAOPE_19 });
  const document = await loadSynaxariumEntryDocument('synax_02_19_01', '2026-10-29');
  assert.deepEqual(document.title, { english: ENTRY.title.english, arabic: ENTRY.title.arabic, french: ENTRY.title.english });
  assert.equal(document.sections.length, 1);
  const [section] = document.sections;
  assert.equal(section.id, 'synax_02_19_01');
  // Named in the headpiece, not again over the text; by its name in the Contents.
  assert.deepEqual(section.title, { english: '', arabic: '' });
  assert.deepEqual(section.selectorTitle, document.title);
  assert.equal(section.forceWhiteVerses, true);
  const [day, first, last] = section.verses;
  assert.deepEqual(day, { type: 'readingReference', english: 'Paope 19 · October 28–29', french: '19 Paope · 28–29 octobre', arabic: '١٩ بابه · ٢٨–٢٩ أكتوبر', coptic: '' });
  assert.equal(day.dropCap, undefined, 'the day line never opens with the drop cap');
  assert.equal(first.dropCap, true);
  assert.equal(last.english, ENTRY.verses[1].english);
});

test('a title in one language only names it in both', async () => {
  const { buildSynaxariumEntryDocument, synaxariumDayLine } = loadDocument();
  const onlyArabic = buildSynaxariumEntryDocument('k', { title: { english: '', arabic: 'نياحة القديس' }, verses: [] }, synaxariumDayLine('2026-10-29', PAOPE_19));
  assert.deepEqual(onlyArabic.title, { english: 'نياحة القديس', arabic: 'نياحة القديس', french: 'نياحة القديس' });
});

test("a saint the day doesn't have says so, in the App Language", async () => {
  const { loadSynaxariumEntryDocument } = loadDocument({ appLanguage: 'fr', entry: null, coptic: PAOPE_19 });
  await assert.rejects(loadSynaxariumEntryDocument('synax_nope', '2026-10-29'), /Ce saint ne figure pas dans le Synaxaire de ce jour\./);
});

test("Home's saints open their own documents, read in the reader for their day", () => {
  const { synaxariumEntryHref } = loadDocument();
  assert.equal(synaxariumEntryHref('synax_02_19_01', '2026-10-29'), '/synaxarium/synax_02_19_01?day=2026-10-29');
  assert.equal(synaxariumEntryHref('a b/c', '2026-10-29'), '/synaxarium/a%20b%2Fc?day=2026-10-29');

  const home = read('src/components/vine/screens/HomeScreen.tsx');
  assert.match(home, /\(\) => router\.push\(synaxariumEntryHref\(event\.entryKey, isoDate\(synaxDate\)\) as never\),/);
  // The search still opens the Synaxarium itself, where each saint opens the same document: from its day's card, and from a search.
  assert.match(home, /'search-outline', \(\) => router\.push\('\/synaxarium'\)\)/);
  const synaxarium = read('src/app/synaxarium/index.tsx');
  assert.match(synaxarium, /const openEntry = useCallback\(\(entryKey: string, isoDate: string\) => router\.push\(synaxariumEntryHref\(entryKey, isoDate\) as never\), \[router\]\);/);
  assert.equal((synaxarium.match(/onPress=\{\(\) => openEntry\(entry\.entryKey, day\.gregorianDate\)\}/g) || []).length, 2);
  assert.doesNotMatch(synaxarium, /liturgy_of_the_word\?sub=SYNAXARIUM|selectDate\(/, "nor the Liturgy of the Word's, nor does it move the Books' day");

  const route = read('src/app/synaxarium/[entryKey].tsx');
  assert.match(route, /<ServiceDocument\s/);
  assert.match(route, /const loadDocument = useCallback\(\(\) => loadSynaxariumEntryDocument\(key, isoDate\), \[key, isoDate\]\);/);
  assert.match(route, /conditionDate=\{conditionDate\}\s+loadDocument=\{loadDocument\}/);
  assert.match(route, /typeof day === 'string' && ISO_DATE\.test\(day\) \? day : liturgicalIso/);

  // The reader takes the document and its name from the loader, and offers no bookmark for it.
  const reader = read('src/components/vine/screens/ServiceDocument.tsx');
  assert.match(reader, /loadDocument\s+\? loadDocument\(effectiveDate\)\.then\(\(loaded\) => \{\s+ownTitle = loaded\.title;\s+return loaded\.sections;/);
  assert.match(reader, /withDocumentOrnaments\(hydrated, ownTitle \?\? \{ english: title, arabic, french \}\)/);
  assert.match(reader, /const bookmarkable = !loadDocument;/);
  assert.match(reader, /bookmarked=\{bookmarkable \? bookmarked : undefined\}\s+onToggleBookmark=\{bookmarkable \? \(\) => toggleBookmark\(bookmarkId\) : undefined\}/);
  assert.equal((reader.match(/title=\{documentTitle\}/g) || []).length, 2, 'the Contents and the floating title read its own name');

  // The Contents name a section by its selectorTitle first.
  const selector = read('src/components/vine/sectionSelectorTitle.ts');
  assert.match(selector, /if \(section\.selectorTitle\) return section\.selectorTitle;/);

  // The entry is read from the day's Synaxarium, opening on its first paragraph, with no reader named.
  const library = read('src/utils/hymnLibrary.js');
  assert.match(library, /export async function resolveSynaxariumEntry\(isoDate, entryKey\) \{\s+const dayData = await getSynaxariumForDate\(isoDate\);/);
  assert.match(library, /verses: openOnFirstVerse\(\(entry\.paragraphs \|\| \[\]\)[\s\S]*?synaxariumVerse\(\{ english: p\.english \|\| "", arabic: p\.arabic \?\? null \}, null\)\)\),/);
});

test("a saint's long name shrinks to fit its headpiece, on a slide and on the page; a service's keeps the frame's size", () => {
  const { fitHeadpieceTitle, headpieceTitleLines, HEADPIECE_MIN_SCALE, HEADPIECE_LINE_HEIGHT } = loadFile('src/utils/headpieceFit.ts');
  // The stepped headpiece's open space on a phone held upright, as measured in the reader.
  const phone = { width: 188, height: 62 };
  assert.deepEqual(fitHeadpieceTitle('Liturgy of the Word', phone, 16), { fontSize: 16, lines: 2 });
  const milius = 'The Departure of Pope Milius (Milio), the Third Patriarch of the See of St. Mark';
  const fitted = fitHeadpieceTitle(milius, phone, 16);
  assert.ok(fitted.fontSize < 16 && fitted.fontSize >= 16 * HEADPIECE_MIN_SCALE, `shrinks, not past its floor (${fitted.fontSize})`);
  assert.ok(fitted.lines * fitted.fontSize * HEADPIECE_LINE_HEIGHT <= phone.height, 'and fits the box');
  assert.equal(headpieceTitleLines(milius, phone.width, fitted.fontSize), fitted.lines);
  // Never smaller than its floor, however long.
  assert.equal(fitHeadpieceTitle(milius.repeat(4), phone, 16).fontSize, 16 * HEADPIECE_MIN_SCALE);
  // A word to a line at least.
  assert.equal(headpieceTitleLines('Supercalifragilistic', 10, 16), 1);

  // The slide sizes it before it is drawn; the page measures it as drawn, by the same floor.
  const ornaments = read('src/components/vine/ui/DocumentOrnaments.tsx');
  assert.match(ornaments, /const fit = fitHeadpieceTitle\(text, box, Math\.max\(frame\.minFontSize, \(width \* frame\.fontSize\) \/ 100\), arabic\);/);
  assert.match(ornaments, /numberOfLines=\{lines\}/);
  assert.doesNotMatch(ornaments, /numberOfLines=\{3\}/);
  const page = read('src/components/vine/documentHtml.ts');
  assert.match(page, new RegExp(`var MIN_SCALE = ${HEADPIECE_MIN_SCALE}; // headpieceFit\\.ts's HEADPIECE_MIN_SCALE`));
  assert.match(page, /while \(room > 0 && title\.offsetHeight > room && size > floor\) \{/);
  assert.match(page, /if \(document\.fonts && document\.fonts\.ready\) document\.fonts\.ready\.then\(fit\);/);
});
