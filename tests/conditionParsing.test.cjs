const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

function loadEvaluator() {
  const source = fs.readFileSync('src/utils/conditionEngine.js', 'utf8')
    .replace(/^import .*;\r?\n/gm, '')
    .replace(/^export /gm, '');
  return new Function(source + '\nreturn { evaluateCondition };')().evaluateCondition;
}

// Verse 4 (the risen verse) and verse 5 (the annual verse) of tenouosht and
// its sister hymns in public.hymn_texts.
const RISEN = 'PentecostPeriod || (((Sundays && ApostlesFastToLastDayOfHathor) && !FeastOfTheCross)) || Joyful29';
const ANNUAL = '!(NativityParamoun || NativityPeriod ||TheophanyParamoun || TheophanyPeriod || Pascha || HolyWeek || Funerals || FeastOfTheCross || PentecostPeriod || (Sundays && ApostlesFastToLastDayOfHathor))';

test('a Sunday between the Apostles Fast and the end of Hathor takes the risen verse, not the annual one', () => {
  const evaluateCondition = loadEvaluator();
  const sunday = { Sunday: true, Sundays: true, ApostlesFastToLastDayOfHathor: true, Annual: true };
  assert.equal(evaluateCondition(RISEN, sunday), true);
  assert.equal(evaluateCondition(ANNUAL, sunday), false);
});

test('the celebrated 29th takes the risen verse on a weekday', () => {
  const evaluateCondition = loadEvaluator();
  assert.equal(evaluateCondition(RISEN, { Joyful29: true, Wednesday: true }), true);
});

test('a condition that does not parse is false, as the "Joyful 29" typo was', () => {
  const evaluateCondition = loadEvaluator();
  const typo = RISEN.replace('Joyful29', 'Joyful 29');
  assert.equal(evaluateCondition(typo, { Sundays: true, ApostlesFastToLastDayOfHathor: true }), false);
  assert.equal(evaluateCondition('NativityParamoun &&', { NativityParamoun: true }), false);
});

test('a flag name may start with a digit', () => {
  const evaluateCondition = loadEvaluator();
  assert.equal(evaluateCondition('318AssembledAtNicea', { '318AssembledAtNicea': true }), true);
  assert.equal(evaluateCondition('318AssembledAtNicea', {}), false);
  assert.equal(evaluateCondition('!7YoungMenOfEphesus && Sundays', { Sundays: true }), true);
});

test('a name is never matched inside another name', () => {
  const evaluateCondition = loadEvaluator();
  assert.equal(evaluateCondition('Sunday && !Sundays', { Sunday: true }), true);
  assert.equal(evaluateCondition('StMark:Psali1 && !StMark:Psali10', { 'StMark:Psali1': true }), true);
  // A one-letter flag must not reach into the "true"/"false" already written in.
  assert.equal(evaluateCondition('a || e', { a: false, e: false }), false);
});

test('saint hierarchy and dotted day tokens still resolve', () => {
  const evaluateCondition = loadEvaluator();
  assert.equal(evaluateCondition('StMark:VOC', { StMark: true }), true);
  assert.equal(evaluateCondition('StMark', { 'StMark:VOC': true }), false);
  assert.equal(evaluateCondition('(StMark:Psali1 || Paope.30) && AdamDays', { 'Paope.30': true, AdamDays: true }), true);
  assert.equal(evaluateCondition('', {}), true);
});
