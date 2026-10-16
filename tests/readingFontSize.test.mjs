import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  classifyReadingDevice,
  DEFAULT_FONT_SCALE,
  DEFAULT_READING_FONT_LEVEL,
  fontLevelCount,
  fontScaleStep,
  fontScaleToLevel,
  fontScaleToPx,
  maxFontScaleForScreen,
  migrateReadingFontLevel,
  MIN_FONT_SCALE,
  readStoredFontScale,
  readingFontSizeForLevel,
  READING_FONT_BASE_PX,
  READING_FONT_SIZES,
  snapFontScale,
  stepFontScale,
} from '../src/utils/readingFontSize.js';

test('the text size is one scale of a 14px base, rendered the same on every device', () => {
  assert.equal(READING_FONT_BASE_PX, 14);
  assert.equal(MIN_FONT_SCALE, 1);
  // A new installation opens on level 5: 22px.
  assert.equal(DEFAULT_FONT_SCALE, 1.571);
  assert.equal(fontScaleToPx(DEFAULT_FONT_SCALE), 22);
  assert.equal(fontScaleToLevel(DEFAULT_FONT_SCALE), 5);
  assert.equal(fontScaleToPx(1), 14);
  assert.equal(fontScaleToPx(2.714), 38);
  assert.equal(fontScaleToPx(5.857), 82);
  assert.equal(fontScaleToPx('nonsense'), 22);
});

test('the slider reaches further on a larger screen, ending on a whole level, the same either way up', () => {
  assert.equal(maxFontScaleForScreen(390, 844), 2.714);
  assert.equal(maxFontScaleForScreen(844, 390), 2.714);
  // A small phone's range still reaches the earlier phone table's largest size, 38px.
  assert.equal(maxFontScaleForScreen(360, 800), 2.714);
  assert.equal(fontScaleToPx(maxFontScaleForScreen(320, 568)), 38);
  assert.equal(maxFontScaleForScreen(820, 1180), 5.857);
  assert.equal(maxFontScaleForScreen(1920, 1080), 7.714);
  // Nothing known about the screen: a phone's range.
  assert.equal(maxFontScaleForScreen(0, 0), 2.714);
  assert.equal(maxFontScaleForScreen(100, 100), 2.714);
});

test('the reader sees levels from 1 to as many as the screen has room for, 2px apart', () => {
  assert.equal(fontScaleStep(), 2 / 14);
  assert.equal(fontLevelCount(maxFontScaleForScreen(390, 844)), 13);
  assert.equal(fontLevelCount(maxFontScaleForScreen(820, 1180)), 35);
  assert.equal(fontLevelCount(maxFontScaleForScreen(1024, 1366)), 45);
  assert.equal(fontLevelCount(maxFontScaleForScreen(1920, 1080)), 48);
  assert.equal(fontScaleToLevel(1), 1);
  assert.equal(fontScaleToLevel(maxFontScaleForScreen(390, 844)), 13);
  // A size set between levels (an earlier default, a migrated one) shows as the nearest level.
  assert.equal(fontScaleToLevel(1.5), 5);
  const max = maxFontScaleForScreen(390, 844);
  assert.equal(snapFontScale(1, max), 1);
  assert.equal(snapFontScale(max, max), max);
  assert.equal(snapFontScale(99, max), max);
  assert.equal(snapFontScale(-5, max), 1);
  assert.equal(snapFontScale(Number.NaN, max), DEFAULT_FONT_SCALE);
  // Stepping goes through every level once, 2px at a time, and stops at the ends.
  let scale = 1;
  const sizes = [fontScaleToPx(scale)];
  for (let i = 0; i < 12; i++) {
    scale = stepFontScale(scale, 1, max);
    sizes.push(fontScaleToPx(scale));
  }
  assert.deepEqual(sizes, [14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38]);
  assert.equal(scale, max);
  assert.equal(stepFontScale(max, 1, max), max);
  assert.equal(stepFontScale(1, -1, max), 1);
  // From a size between levels, a step goes to the level beside the nearest one.
  assert.equal(fontScaleToPx(stepFontScale(1.5, -1, max)), 20);
  // A large screen has more levels of the same size.
  const large = maxFontScaleForScreen(1920, 1080);
  assert.equal(stepFontScale(1, 47, large), large);
  assert.equal(fontScaleToPx(stepFontScale(1, 1, large)), 16);
});

test('a stored size of any earlier format becomes the scale that renders at that size here', () => {
  const max = maxFontScaleForScreen(390, 844);
  assert.equal(readStoredFontScale({ fontScale: 1.75, fontScaleVersion: 2 }, 'phone', max), 1.75);
  assert.equal(readStoredFontScale({ fontScale: 9, fontScaleVersion: 2 }, 'phone', max), max);
  // The 1-10 level tables: level 5 was 20px on a phone and 24px on a tablet.
  assert.equal(fontScaleToPx(readStoredFontScale({ fontScale: 5, fontScaleRangeMax: 10 }, 'phone', max)), 20);
  assert.equal(fontScaleToPx(readStoredFontScale({ fontScale: 5, fontScaleRangeMax: 10 }, 'tablet', 6)), 24);
  assert.equal(fontScaleToPx(readStoredFontScale({ fontScale: 10, fontScaleRangeMax: 10 }, 'tablet', 6)), 44);
  // ...held to this screen's range when the level table reached past it.
  assert.equal(readStoredFontScale({ fontScale: 10, fontScaleRangeMax: 10 }, 'tablet', max), max);
  // The 0-20 and 0-10 ranges before that, by the size they rendered.
  assert.equal(fontScaleToPx(readStoredFontScale({ fontScale: 2, fontScaleRangeMax: 20 }, 'phone', max)), 23);
  assert.equal(fontScaleToPx(readStoredFontScale({ fontScale: 1 }, 'phone', max)), 23);
  // Every level the earlier phone table offered keeps its size on the smallest phone.
  const smallest = maxFontScaleForScreen(320, 568);
  for (let level = 1; level <= 10; level++) {
    assert.equal(fontScaleToPx(readStoredFontScale({ fontScale: level, fontScaleRangeMax: 10 }, 'phone', smallest)), readingFontSizeForLevel(level, 'phone'));
  }
  // A scale record a level build has since rewritten carries its range marker: it is read as the level it now holds.
  const rewritten = { fontScale: 7, fontScaleRangeMax: 10, fontScaleVersion: 2 };
  assert.equal(fontScaleToPx(readStoredFontScale(rewritten, 'phone', max)), readingFontSizeForLevel(7, 'phone'));
  // A later version's scale is still a scale.
  assert.equal(readStoredFontScale({ fontScale: 1.75, fontScaleVersion: 3 }, 'phone', max), 1.75);
  // Nothing stored, or nonsense: the default.
  assert.equal(readStoredFontScale(null, 'phone', max), DEFAULT_FONT_SCALE);
  assert.equal(readStoredFontScale({ fontScale: 'big' }, 'phone', max), DEFAULT_FONT_SCALE);
});

test('the earlier 1-10 tables are kept to read the sizes they stored', () => {
  assert.equal(DEFAULT_READING_FONT_LEVEL, 5);
  assert.deepEqual(READING_FONT_SIZES.phone, [14, 16, 17, 19, 20, 23, 26, 30, 34, 38]);
  assert.deepEqual(READING_FONT_SIZES.tablet, [16, 18, 20, 22, 24, 27, 30, 34, 38, 44]);
  assert.deepEqual(READING_FONT_SIZES.desktop, [16, 18, 20, 22, 24, 27, 30, 34, 38, 44]);
  assert.equal(readingFontSizeForLevel(5, 'phone'), 20);
  assert.equal(readingFontSizeForLevel(5, 'tablet'), 24);
  assert.equal(readingFontSizeForLevel(5, 'desktop'), 24);
});

test('device classification and level size are invariant through rotation', () => {
  const portrait = classifyReadingDevice({
    platform: 'android',
    deviceType: 0,
    osName: 'Android',
    screenWidth: 390,
    screenHeight: 844,
  });
  const landscape = classifyReadingDevice({
    platform: 'android',
    deviceType: 0,
    osName: 'Android',
    screenWidth: 844,
    screenHeight: 390,
  });

  assert.equal(portrait, 'phone');
  assert.equal(landscape, 'phone');
  assert.equal(readingFontSizeForLevel(5, portrait), 20);
  assert.equal(readingFontSizeForLevel(5, landscape), 20);
  assert.equal(classifyReadingDevice({
    platform: 'ios',
    deviceType: 0,
    osName: 'iPadOS',
    screenWidth: 1024,
    screenHeight: 768,
  }), 'tablet');
  assert.equal(classifyReadingDevice({
    platform: 'web',
    deviceType: 3,
    osName: 'Windows',
    screenWidth: 390,
    screenHeight: 844,
  }), 'desktop');
});

test('mobile web keeps its device size when Expo OS metadata is unavailable', () => {
  const mobileBrowsers = [
    { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', shortEdge: 390, expected: 'phone' },
    { userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Mobile Safari/537.36', shortEdge: 412, expected: 'phone' },
    { userAgent: 'Mozilla/5.0 (Linux; Android 15; Tablet) AppleWebKit/537.36 Safari/537.36', shortEdge: 800, expected: 'tablet' },
    { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15', shortEdge: 820, maxTouchPoints: 5, expected: 'tablet' },
  ];
  for (const browser of mobileBrowsers) {
    const input = {
      platform: 'web',
      deviceType: null,
      osName: null,
      userAgent: browser.userAgent,
      maxTouchPoints: browser.maxTouchPoints ?? 0,
    };
    const portrait = classifyReadingDevice({
      ...input,
      screenWidth: browser.shortEdge,
      screenHeight: 1180,
    });
    const landscape = classifyReadingDevice({
      ...input,
      screenWidth: 1180,
      screenHeight: browser.shortEdge,
    });
    assert.equal(portrait, browser.expected);
    assert.equal(landscape, browser.expected);
    for (let level = 1; level <= 10; level++) {
      assert.equal(readingFontSizeForLevel(level, portrait), readingFontSizeForLevel(level, landscape));
    }
  }
  // A desktop browser resized to a phone-sized window stays desktop-sized.
  assert.equal(classifyReadingDevice({
    platform: 'web', deviceType: null, osName: 'Windows',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    screenWidth: 390, screenHeight: 844,
  }), 'desktop');
});

test('old font preferences migrate by nearest rendered size', () => {
  assert.equal(migrateReadingFontLevel(2, 20, 'phone'), 6);
  assert.equal(migrateReadingFontLevel(2, 20, 'tablet'), 5);
  assert.equal(migrateReadingFontLevel(1, undefined, 'phone'), 6);
  assert.equal(migrateReadingFontLevel(1, undefined, 'tablet'), 5);
  assert.equal(migrateReadingFontLevel(20, 20, 'phone'), 10);
  assert.equal(migrateReadingFontLevel(5, 10, 'phone'), 5);
});

test('every Coptic Vine reading renderer receives the same base-size calculation', () => {
  const surface = fs.readFileSync('src/components/vine/DocumentSurface.tsx', 'utf8');
  const bible = fs.readFileSync('src/app/bible/[bookKey]/[chapter].tsx', 'utf8');

  assert.match(surface, /const fontSize = fontScaleToPx\(preferences\.fontScale\);/);
  assert.match(bible, /const fontSize = fontScaleToPx\(preferences\.fontScale\);/);
  const fontDeclaration = surface.match(/const fontSize\s*=[^;]+;/)?.[0] || '';
  assert.match(fontDeclaration, /fontScaleToPx\(preferences\.fontScale\)/);
  assert.doesNotMatch(fontDeclaration, /screenWidth|screenHeight/);
  assert.doesNotMatch(surface, /fontScaleMultiplier/);
});
