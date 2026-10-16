import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  classifyReadingDevice,
  DEFAULT_FONT_SCALE,
  DEFAULT_READING_FONT_LEVEL,
  fontScaleStep,
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
  assert.equal(DEFAULT_FONT_SCALE, 1.5);
  assert.equal(fontScaleToPx(1), 14);
  assert.equal(fontScaleToPx(1.5), 21);
  assert.equal(fontScaleToPx(2.786), 39);
  assert.equal(fontScaleToPx(5.857), 82);
  assert.equal(fontScaleToPx('nonsense'), 21);
});

test('the slider reaches further on a larger screen, the same either way up', () => {
  assert.equal(maxFontScaleForScreen(390, 844), 2.786);
  assert.equal(maxFontScaleForScreen(844, 390), 2.786);
  assert.equal(maxFontScaleForScreen(360, 800), 2.571);
  assert.equal(maxFontScaleForScreen(820, 1180), 5.857);
  assert.equal(maxFontScaleForScreen(1920, 1080), 7.714);
  // Nothing known about the screen: a phone's range. A tiny one still has a range.
  assert.equal(maxFontScaleForScreen(0, 0), 2.786);
  assert.equal(maxFontScaleForScreen(100, 100), 2);
});

test('twenty divisions between the ends: a step lands on the next one, never past an end', () => {
  const max = maxFontScaleForScreen(390, 844);
  assert.equal(fontScaleStep(max), (max - 1) / 20);
  assert.equal(snapFontScale(1, max), 1);
  assert.equal(snapFontScale(max, max), max);
  assert.equal(snapFontScale(99, max), max);
  assert.equal(snapFontScale(-5, max), 1);
  // Nonsense snaps to the division nearest the default.
  assert.equal(snapFontScale(Number.NaN, max), snapFontScale(1.5, max));
  let scale = 1;
  const seen = [scale];
  for (let i = 0; i < 20; i++) {
    scale = stepFontScale(scale, 1, max);
    seen.push(scale);
  }
  assert.equal(seen.length, 21);
  assert.equal(seen[20], max);
  assert.equal(new Set(seen).size, 21);
  assert.equal(stepFontScale(max, 1, max), max);
  assert.equal(stepFontScale(1, -1, max), 1);
  // From a size between divisions, a step goes to the division beside the nearest one.
  assert.equal(stepFontScale(1.43, -1, max), snapFontScale(1.43 - fontScaleStep(max), max));
  // Stepping is the same on a large screen, in that screen's larger divisions.
  const large = maxFontScaleForScreen(1920, 1080);
  assert.equal(stepFontScale(1, 20, large), large);
  assert.ok(fontScaleStep(large) > fontScaleStep(max));
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
  // Nothing stored, or nonsense: the default.
  assert.equal(readStoredFontScale(null, 'phone', max), 1.5);
  assert.equal(readStoredFontScale({ fontScale: 'big' }, 'phone', max), 1.5);
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
