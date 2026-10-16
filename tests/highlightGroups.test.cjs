const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');

function load(path) {
  const js = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('exports', 'require', 'module', js)(module.exports, require, module);
  return module.exports;
}

const groups = load('src/utils/highlightGroups.ts');
const at = (iso) => new Date(iso);
const make = (anchor, details) => ({ ...anchor, ...details });
const segment = (id, extra = {}) => ({ id, verseId: 'v', language: 'english', startOffset: 0, endOffset: 4, quote: 'word', color: 'gold', note: '', createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z', ...extra });

test('a highlight made before groups is a group of one; a grouped one is known by its id alone', () => {
  assert.equal(groups.highlightGroupId({ id: 'sermon-abc' }), 'sermon-abc');
  assert.equal(groups.highlightGroupId({ id: 'sermon-abc~3' }), 'sermon-abc');
  // An older build that dropped the field still keeps the group through the id.
  assert.equal(groups.highlightGroupId({ id: 'bible-x~0', groupId: undefined }), 'bible-x');
  assert.equal(groups.highlightSegmentIndex({ id: 'bible-x~12' }), 12);
  assert.equal(groups.highlightSegmentIndex({ id: 'bible-x' }), 0);
});

test('one stroke across verses makes one group, a verse at a time, with its lead first', () => {
  const change = groups.applyHighlightCreation([], {}, {
    anchors: [{ verseId: 'v1' }, { verseId: 'v2' }, { verseId: 'v3' }],
    color: 'purple',
  }, make, { prefix: 'sermon', now: at('2026-10-16T12:00:00.000Z'), groupId: 'sermon-g' });
  assert.deepEqual(change.highlights.map((h) => h.id), ['sermon-g~0', 'sermon-g~1', 'sermon-g~2']);
  assert.ok(change.highlights.every((h) => h.groupId === 'sermon-g' && h.color === 'purple'));
  assert.equal(change.lead.id, 'sermon-g~0');
  const [group] = groups.groupHighlights(change.highlights);
  assert.equal(group.segments.length, 3);
});

test('a highlight that takes in others replaces their whole groups, keeping their notes and their place', () => {
  const current = [
    segment('old-a~0', { groupId: 'old-a', note: 'First thought', createdAt: '2026-09-01T00:00:00.000Z' }),
    segment('old-a~1', { groupId: 'old-a' }),
    segment('old-b', { note: 'Second thought', createdAt: '2026-09-05T00:00:00.000Z' }),
    segment('kept'),
  ];
  // The page names only the segments it touched; the whole groups go.
  const change = groups.applyHighlightCreation(current, {}, {
    anchors: [{ verseId: 'v1' }, { verseId: 'v2' }],
    color: 'blue',
    replaces: ['old-a~1', 'old-b'],
  }, make, { prefix: 'sermon', now: at('2026-10-16T12:00:00.000Z'), groupId: 'new' });
  assert.deepEqual(change.highlights.map((h) => h.id).sort(), ['kept', 'new~0', 'new~1']);
  assert.equal(change.lead.note, 'First thought\n\nSecond thought');
  assert.equal(change.lead.createdAt, '2026-09-01T00:00:00.000Z');
  // Each removal is recorded, so another device's older copy doesn't bring it back.
  assert.deepEqual(Object.keys(change.deletions).sort(), ['old-a~0', 'old-a~1', 'old-b']);
});

test('a colour, style or note given to one segment is the whole highlight\'s; removing one removes all of it', () => {
  const current = [segment('g~0', { groupId: 'g' }), segment('g~1', { groupId: 'g' }), segment('other')];
  const recoloured = groups.applyHighlightGroupUpdate(current, 'g~1', { color: 'rose', style: 'underline', note: 'Preach this' }, at('2026-10-16T12:00:00.000Z'));
  assert.deepEqual(recoloured.map((h) => `${h.id}:${h.color}:${h.style || ''}:${h.note}`), ['g~0:rose:underline:Preach this', 'g~1:rose:underline:', 'other:gold::']);
  const washed = groups.applyHighlightGroupUpdate(recoloured, 'g~0', { style: null });
  assert.ok(washed.filter((h) => h.id.startsWith('g~')).every((h) => !('style' in h)));
  const removed = groups.applyHighlightGroupRemoval(current, {}, 'g~0', at('2026-10-16T12:00:00.000Z'));
  assert.deepEqual(removed.highlights.map((h) => h.id), ['other']);
  assert.deepEqual(Object.keys(removed.deletions).sort(), ['g~0', 'g~1']);
});

test('stored highlights keep their group and underline, and purple is a colour', () => {
  const planner = load('src/types/sermonPlanner.ts');
  assert.deepEqual([...planner.SERMON_HIGHLIGHT_COLORS], ['gold', 'green', 'blue', 'rose', 'purple']);
  const page = fs.readFileSync('src/components/vine/textHighlights.ts', 'utf8');
  // The Pencil stroke runs down its column across verses: no root lock left.
  assert.doesNotMatch(page, /closestRoot\(caret\.node\) !== pencilStart\.root/);
  assert.match(page, /function pointInColumn\(x, y\)/);
  assert.match(page, /function buildCreation\(segments, color, replaceGroup\)/);
  // A stroke cut short after it moved still counts; a tap after a finger selection doesn't commit it.
  assert.match(page, /if \(stroke\) endStroke\(null, null, !stroke\.moved\);/);
  assert.match(page, /\/\/ A selection made earlier is not what this stroke highlights\.\n\s+savedRange = null;/);
  const service = fs.readFileSync('src/components/vine/screens/ServiceDocument.tsx', 'utf8');
  assert.match(service, /sermonPlanner\.createHighlightGroup\(/);
  const chapter = fs.readFileSync('src/app/bible/[bookKey]/[chapter].tsx', 'utf8');
  assert.match(chapter, /bibleHighlights\.createHighlightGroup\(/);
});
