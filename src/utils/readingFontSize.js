/**
 * The reading text size: one number, a scale of READING_FONT_BASE_PX, that
 * every device renders the same way (fontScaleToPx), chosen on a slider
 * whose top end grows with the screen (maxFontScaleForScreen) -- the model
 * the Spirit & Truth app uses, rather than a device-class table of sizes.
 *
 * The scale is stored as written; a phone and a tablet at the same scale
 * show the same size, and a stored size never changes under the reader
 * because a device was reclassified. The slider moves in levels of 2px,
 * shown to the reader as 1, 2, 3...: the screen decides how many there are
 * -- 13 on a phone, 35 on an iPad, 48 on a 1080p screen.
 */

/** Rendered size, in logical pixels, at a scale of 1. */
export const READING_FONT_BASE_PX = 14;
/** The smallest text offered: the base size. */
export const MIN_FONT_SCALE = 1;
/** One level of the slider: 2px of rendered size, whatever the screen. */
export const FONT_SCALE_STEP = 2 / READING_FONT_BASE_PX;
/** A new installation's size: level 5, 22px, between the sizes the earlier tables opened at. */
export const DEFAULT_FONT_SCALE = Math.round((1 + 4 * FONT_SCALE_STEP) * 1000) / 1000;
/** Marks a stored fontScale as a scale; earlier installations stored a level. */
export const FONT_SCALE_VERSION = 2;
// Logical pixels of the screen's shortest side per unit of scale: a 390pt
// phone reaches 2.79 (39px), an 820pt tablet 5.86 (82px), a 1080p screen
// 7.71 (108px). Spirit & Truth divides by 130 on a slightly smaller base.
const SHORT_EDGE_PER_SCALE = 140;
const FALLBACK_SHORT_EDGE = 390;
// Scales are kept to three decimals, a few thousandths of a level off a whole one.
const LEVEL_TOLERANCE = 0.01;
// The largest size the earlier phone table offered (38px): no screen's range
// stops short of it, so a reader who had it keeps it on a small phone too.
const SMALLEST_RANGE_TOP = 38 / READING_FONT_BASE_PX;

/**
 * How far the slider goes on a screen, from its shortest side: the same
 * either way up, so turning the device never moves the reader's size, and
 * never short of the earlier tables' largest phone size. It ends on a whole
 * level, the last one the screen has room for.
 */
export function maxFontScaleForScreen(screenWidth, screenHeight) {
  const shortEdge = Math.min(positiveDimension(screenWidth), positiveDimension(screenHeight)) || FALLBACK_SHORT_EDGE;
  const reach = Math.max(SMALLEST_RANGE_TOP, shortEdge / SHORT_EDGE_PER_SCALE);
  const levels = Math.floor((reach - MIN_FONT_SCALE) / FONT_SCALE_STEP + LEVEL_TOLERANCE);
  return roundScale(MIN_FONT_SCALE + levels * FONT_SCALE_STEP);
}

/** The width of one of the slider's levels: 2px, whatever the screen. */
export function fontScaleStep() {
  return FONT_SCALE_STEP;
}

/** How many levels a slider ending at `maxScale` has: the reader sees 1 to this. */
export function fontLevelCount(maxScale) {
  return Math.floor((maxScale - MIN_FONT_SCALE) / FONT_SCALE_STEP + LEVEL_TOLERANCE) + 1;
}

/** The level a scale is shown as, from 1: the nearest one. */
export function fontScaleToLevel(scale) {
  const numeric = Number(scale);
  if (!Number.isFinite(numeric)) return 1;
  return Math.max(1, Math.round((numeric - MIN_FONT_SCALE) / FONT_SCALE_STEP) + 1);
}

export function clampFontScale(value, maxScale) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return Math.min(DEFAULT_FONT_SCALE, maxScale);
  return Math.min(maxScale, Math.max(MIN_FONT_SCALE, numeric));
}

/** The nearest of the slider's levels. */
export function snapFontScale(value, maxScale) {
  const top = fontLevelCount(maxScale) - 1;
  const level = Math.min(top, Math.max(0, Math.round((clampFontScale(value, maxScale) - MIN_FONT_SCALE) / FONT_SCALE_STEP)));
  return roundScale(MIN_FONT_SCALE + level * FONT_SCALE_STEP);
}

/** The level `delta` steps from the nearest one to `value`: what the step buttons and keyboard do. */
export function stepFontScale(value, delta, maxScale) {
  const level = Math.round((clampFontScale(value, maxScale) - MIN_FONT_SCALE) / FONT_SCALE_STEP) + Math.round(Number(delta) || 0);
  return snapFontScale(MIN_FONT_SCALE + level * FONT_SCALE_STEP, maxScale);
}

/** The size a scale renders at, whole logical pixels, the same on every device. */
export function fontScaleToPx(scale) {
  const numeric = Number(scale);
  return Math.max(1, Math.round(READING_FONT_BASE_PX * (Number.isFinite(numeric) ? numeric : DEFAULT_FONT_SCALE)));
}

/**
 * The scale a stored text size means, whatever Coptic Vine wrote it as: a
 * scale (fontScaleVersion 2); before that a 1-10 level in a per-device
 * table (fontScaleRangeMax 10); before that a 0-10 or 0-20 range. An older
 * value becomes the scale that renders at the size it rendered on this
 * device, so an update never changes the size a reader had chosen.
 *
 * A level build that reads a scale record keeps its unknown version marker
 * and writes its level beside it, with its own range marker -- which this
 * build never writes. A record carrying that marker is a level, whatever
 * version it claims.
 */
export function readStoredFontScale(stored, deviceClass, maxScale) {
  const value = Number(stored?.fontScale);
  if (!Number.isFinite(value)) return clampFontScale(DEFAULT_FONT_SCALE, maxScale);
  const writtenAsLevel = stored.fontScaleRangeMax != null;
  if (!writtenAsLevel && Number(stored.fontScaleVersion) >= FONT_SCALE_VERSION) return clampFontScale(value, maxScale);
  const level = migrateReadingFontLevel(value, stored.fontScaleRangeMax, deviceClass);
  return clampFontScale(roundScale(readingFontSizeForLevel(level, deviceClass) / READING_FONT_BASE_PX), maxScale);
}

function roundScale(value) {
  return Math.round(value * 1000) / 1000;
}

// ---------------------------------------------------------------------------
// The earlier model, kept to read what it stored: ten levels, each a size
// from a table for the device's class. Nothing renders from it any more.
// ---------------------------------------------------------------------------

export const MIN_READING_FONT_LEVEL = 1;
export const MAX_READING_FONT_LEVEL = 10;
export const DEFAULT_READING_FONT_LEVEL = 5;

export const READING_FONT_SIZES = Object.freeze({
  phone: Object.freeze([14, 16, 17, 19, 20, 23, 26, 30, 34, 38]),
  tablet: Object.freeze([16, 18, 20, 22, 24, 27, 30, 34, 38, 44]),
  desktop: Object.freeze([16, 18, 20, 22, 24, 27, 30, 34, 38, 44]),
});

// Expo DeviceType enum values. Keeping these values here makes the sizing
// policy independently testable without loading a native Expo module in Node.
const DEVICE_TYPE_PHONE = 1;
const DEVICE_TYPE_TABLET = 2;
const DEVICE_TYPE_DESKTOP = 3;
const DEVICE_TYPE_TV = 4;
const TABLET_SHORT_EDGE = 600;

export function clampReadingFontLevel(value) {
  const rounded = Math.round(Number(value));
  if (!Number.isFinite(rounded)) return DEFAULT_READING_FONT_LEVEL;
  return Math.min(MAX_READING_FONT_LEVEL, Math.max(MIN_READING_FONT_LEVEL, rounded));
}

/**
 * Determines a stable device category. Callers capture this result once;
 * orientation changes can swap width and height, but never change the short
 * edge or the Expo-reported physical device type.
 */
export function classifyReadingDevice({
  platform,
  deviceType,
  osName,
  screenWidth,
  screenHeight,
  userAgent,
  maxTouchPoints,
}) {
  // Prefer the device's physical category when Expo can identify it.
  if (deviceType === DEVICE_TYPE_PHONE) return "phone";
  if (deviceType === DEVICE_TYPE_TABLET) return "tablet";
  if (deviceType === DEVICE_TYPE_DESKTOP || deviceType === DEVICE_TYPE_TV) return "desktop";

  // The shorter FULL-SCREEN dimension is invariant when the device rotates.
  // Never classify from the current window width: phone landscape, browser
  // split-view and toolbar changes would change the user's font size.
  const shortEdge = Math.min(
    positiveDimension(screenWidth),
    positiveDimension(screenHeight),
  );

  if (platform === "web") {
    // expo-device normally reports iOS/Android in osName on web, but can
    // return null in less common browsers. Fall back to the user agent so an
    // unidentified mobile browser does not silently receive desktop sizes.
    const os = String(osName || "");
    const agent = String(userAgent || "");
    const isIPadDesktopAgent =
      /\bMacintosh\b/i.test(agent) && Number(maxTouchPoints) > 1;
    const isMobileWeb =
      /^(android|ios|ipados)$/i.test(os) ||
      /android|iphone|ipad|ipod/i.test(agent) ||
      isIPadDesktopAgent;

    if (!isMobileWeb) return "desktop";
    if (isIPadDesktopAgent) return "tablet";
    return shortEdge >= TABLET_SHORT_EDGE ? "tablet" : "phone";
  }

  if (platform === "ios" || platform === "android") {
    return shortEdge >= TABLET_SHORT_EDGE ? "tablet" : "phone";
  }

  return "desktop";
}

export function readingFontSizeForLevel(level, deviceClass) {
  const sizes = READING_FONT_SIZES[deviceClass] || READING_FONT_SIZES.desktop;
  return sizes[clampReadingFontLevel(level) - MIN_READING_FONT_LEVEL];
}

export function nearestReadingFontLevel(pixelSize, deviceClass) {
  const target = Number(pixelSize);
  if (!Number.isFinite(target)) return DEFAULT_READING_FONT_LEVEL;
  const sizes = READING_FONT_SIZES[deviceClass] || READING_FONT_SIZES.desktop;

  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  sizes.forEach((size, index) => {
    const distance = Math.abs(size - target);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });

  return nearestIndex + MIN_READING_FONT_LEVEL;
}

/**
 * Converts both prior Coptic Vine ranges to their old rendered size, then chooses the
 * closest level in the device-aware table. A stored range marker of 10 is
 * the level format; the original 0-10 format never wrote a marker.
 */
export function migrateReadingFontLevel(storedLevel, storedRangeMax, deviceClass) {
  if (storedRangeMax === MAX_READING_FONT_LEVEL) {
    return clampReadingFontLevel(storedLevel);
  }

  const oldRangeMax = storedRangeMax === 20 ? 20 : 10;
  const oldLevel = Math.min(oldRangeMax, Math.max(0, Number(storedLevel)));
  if (!Number.isFinite(oldLevel)) return DEFAULT_READING_FONT_LEVEL;
  const oldPixelSize = Math.round(18 + (oldLevel * (78 - 18)) / oldRangeMax);
  return nearestReadingFontLevel(oldPixelSize, deviceClass);
}

function positiveDimension(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}
