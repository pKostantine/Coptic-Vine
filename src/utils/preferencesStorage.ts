import * as Device from 'expo-device';
import { Dimensions, Platform } from 'react-native';

import { DEFAULT_DOCUMENT_THEME_ID, isDocumentThemeId, type DocumentThemeId } from '../constants/documentThemes';
import { DEFAULT_SELECTED_INTERPRETATIONS, normalizeSelectedInterpretations } from './kiahkInterpretations';
import {
  classifyReadingDevice,
  DEFAULT_FONT_SCALE,
  FONT_SCALE_STEP as LEVEL_STEP,
  FONT_SCALE_VERSION,
  fontLevelCount,
  fontScaleToLevel as scaleToLevel,
  fontScaleToPx as scaleToPixels,
  maxFontScaleForScreen,
  MIN_FONT_SCALE as MIN_READING_FONT_SCALE,
  readStoredFontScale,
  snapFontScale,
  stepFontScale,
} from './readingFontSize';

export interface VisibleLanguages {
  english: boolean;
  french: boolean;
  coptic: boolean;
  copticRecitedPrayers: boolean;
  arabic: boolean;
}

export interface BibleVisibleLanguages {
  english: boolean;
  englishNkjv: boolean;
  englishFromCoptic: boolean;
  coptic: boolean;
  greek: boolean;
  arabic: boolean;
  arabicFromCoptic: boolean;
  french: boolean;
}

export interface SermonPlannerVisibleLanguages {
  english: boolean;
  arabic: boolean;
}

export type OrientationMode = 'auto' | 'landscape' | 'reverseLandscape' | 'portrait';

export type AppLanguage = 'en' | 'ar' | 'fr';

export const APP_LANGUAGES: AppLanguage[] = ['en', 'fr', 'ar'];

function isAppLanguage(value: unknown): value is AppLanguage {
  return APP_LANGUAGES.includes(value as AppLanguage);
}

export interface ReadingPreferences {
  visibleLanguages: VisibleLanguages;
  bibleVisibleLanguages: BibleVisibleLanguages;
  sermonPlannerVisibleLanguages: SermonPlannerVisibleLanguages;
  /**
   * The reading text size: a scale of the 14px base (readingFontSize.js),
   * from MIN_FONT_SCALE to MAX_FONT_SCALE, which this screen decides. A
   * device choice, never synced: a phone and a desk are read differently.
   */
  fontScale: number;
  /** Marks fontScale as a scale (FONT_SCALE_VERSION); earlier installations stored a level, which readStoredFontScale still reads. */
  fontScaleVersion: number;
  orientationMode: OrientationMode;
  selectText: boolean;
  slideshowMode: boolean;
  displayComments: boolean;
  displaySilentPrayers: boolean;
  displayNowPlayingBar: boolean;
  bishopPresent: boolean;
  copticGospelRite: boolean;
  /**
   * Full saint hymn condition tokens the user has chosen by hand, e.g.
   * `StMark:VOC`. Each one is raised as its own condition flag; the bare
   * `StMark` is deliberately never raised, so picking one hymn cannot pull in
   * the saint's whole set — see isConditionAtomSatisfied in conditionEngine.js.
   */
  selectedSaintHymns: string[];
  /**
   * The interpretations read after each of the Kiahk Saturday Theotokias in
   * the Vespers Praises, by id (utils/kiahkInterpretations.ts). A content
   * choice, synced to the account like the saint hymns.
   */
  selectedInterpretations: string[];
  /**
   * Raises the `Monastery` condition. Only the Prayer of the Veil is gated on
   * it — it is prayed in monasteries and skipped in parishes — so this decides
   * whether that subdocument appears in Offering of the Lamb and Vespers
   * Praises at all.
   */
  inMonastery: boolean;
  /**
   * Raises the `SaintPsalies` condition: the saints' psalies in the Vespers
   * and Midnight Praises. Chosen on the Saint Hymns page, synced like the
   * saint hymns themselves.
   */
  saintPsalies: boolean;
  /** Menu-chrome-only language (main menu + submenus/list screens) — never affects the text rendered inside an actual document, which is governed by visibleLanguages instead. */
  appLanguage: AppLanguage;
  /**
   * Keeps the screen on while a service or a chapter is open. A device
   * choice rather than a synced one: a phone on a pew wants it, a laptop at
   * home may not.
   */
  keepScreenAwake: boolean;
  /**
   * The page a document is read on (constants/documentThemes.ts). A device
   * choice like the text size: a phone at an evening service and an iPad at
   * a desk are read differently.
   */
  documentTheme: DocumentThemeId;
}

export type SyncedReadingPreferences = Pick<ReadingPreferences,
  | 'visibleLanguages'
  | 'bibleVisibleLanguages'
  | 'sermonPlannerVisibleLanguages'
  | 'displayComments'
  | 'displaySilentPrayers'
  | 'bishopPresent'
  | 'copticGospelRite'
  | 'selectedSaintHymns'
  | 'selectedInterpretations'
  | 'inMonastery'
  | 'saintPsalies'
  | 'appLanguage'
>;

// New installations start at a scale of 1.5: 21px, between the sizes the
// earlier per-device tables opened at.
export const DEFAULT_READING_PREFERENCES: ReadingPreferences = {
  visibleLanguages: {
    english: true,
    french: false,
    coptic: true,
    copticRecitedPrayers: true,
    arabic: true,
  },
  bibleVisibleLanguages: {
    english: true,
    englishNkjv: false,
    englishFromCoptic: false,
    coptic: false,
    greek: false,
    arabic: true,
    arabicFromCoptic: false,
    french: false,
  },
  sermonPlannerVisibleLanguages: {
    english: true,
    arabic: true,
  },
  fontScale: DEFAULT_FONT_SCALE,
  fontScaleVersion: FONT_SCALE_VERSION,
  orientationMode: 'auto',
  selectText: false,
  slideshowMode: false,
  displayComments: false,
  displaySilentPrayers: false,
  displayNowPlayingBar: true,
  bishopPresent: false,
  copticGospelRite: false,
  appLanguage: 'en',
  selectedSaintHymns: [],
  selectedInterpretations: [...DEFAULT_SELECTED_INTERPRETATIONS],
  inMonastery: false,
  saintPsalies: false,
  keepScreenAwake: true,
  documentTheme: DEFAULT_DOCUMENT_THEME_ID,
};

let currentAppLanguage: AppLanguage = DEFAULT_READING_PREFERENCES.appLanguage;

/** Current menu/chrome language for synchronous label helpers outside React components. */
export function getCurrentAppLanguage(): AppLanguage {
  return currentAppLanguage;
}

/** Set by ReadingPreferencesProvider while it renders, so everything below it reads the new language in the same render. */
export function setCurrentAppLanguage(language: AppLanguage): void {
  currentAppLanguage = language;
}

// The device's screen, read once: the window changes with rotation and
// split view, the screen's shortest side does not.
const screen = Dimensions.get('screen');

/** Lowest selectable text scale: the 14px base (readingFontSize.js). */
export const MIN_FONT_SCALE: number = MIN_READING_FONT_SCALE;
/** Highest selectable text scale on this screen: its shortest side over 140, the same either way up. */
export const MAX_FONT_SCALE: number = maxFontScaleForScreen(screen.width, screen.height);
/** One level of the slider (2px): what the step buttons and the keyboard move by. */
export const FONT_SCALE_STEP: number = LEVEL_STEP;
/** How many levels this screen's slider has: the reader sees 1 to this. */
export const FONT_LEVEL_COUNT: number = fontLevelCount(MAX_FONT_SCALE);

export type ReadingDeviceClass = 'phone' | 'tablet' | 'desktop';

// The physical device class, captured once. Only the sizes earlier
// installations stored as levels depend on it (readStoredFontScale): the
// scale itself renders the same on every device.
export const READING_DEVICE_CLASS = classifyReadingDevice({
  platform: Platform.OS,
  deviceType: Device.deviceType,
  osName: Device.osName,
  screenWidth: screen.width,
  screenHeight: screen.height,
  userAgent: Platform.OS === 'web' && typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
  maxTouchPoints: Platform.OS === 'web' && typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0,
}) as ReadingDeviceClass;

/** The size a scale renders at, in whole logical pixels: the same on every device. */
export function fontScaleToPx(fontScale: number): number {
  return scaleToPixels(fontScale);
}

/** The level a scale is shown as, from 1 to FONT_LEVEL_COUNT. */
export function fontScaleToLevel(fontScale: number): number {
  return Math.min(FONT_LEVEL_COUNT, scaleToLevel(fontScale));
}

/** The nearest level of this screen's slider to a value. */
export function snapFontScaleValue(value: number): number {
  return snapFontScale(value, MAX_FONT_SCALE);
}

/** The division `delta` steps from the nearest one to a value, held within this screen's range. */
export function stepFontScaleValue(value: number, delta: number): number {
  return stepFontScale(value, delta, MAX_FONT_SCALE);
}

const STORAGE_KEY = 'chc-reading-preferences';

function normalizeSermonPlannerVisibleLanguages(
  value: unknown,
  fallback: SermonPlannerVisibleLanguages,
): SermonPlannerVisibleLanguages {
  const record = recordValue(value);
  const normalized = {
    english: booleanValue(record.english, fallback.english),
    arabic: booleanValue(record.arabic, fallback.arabic),
  };
  return Object.values(normalized).some(Boolean) ? normalized : { ...fallback };
}

function mergePreferences(stored: Partial<ReadingPreferences> | null | undefined): ReadingPreferences {
  const ORIENTATION_MODES: OrientationMode[] = ['auto', 'landscape', 'reverseLandscape', 'portrait'];
  const merged: ReadingPreferences = {
    ...DEFAULT_READING_PREFERENCES,
    ...stored,
    visibleLanguages: {
      ...DEFAULT_READING_PREFERENCES.visibleLanguages,
      ...stored?.visibleLanguages,
    },
    bibleVisibleLanguages: {
      ...DEFAULT_READING_PREFERENCES.bibleVisibleLanguages,
      ...stored?.bibleVisibleLanguages,
    },
    sermonPlannerVisibleLanguages: normalizeSermonPlannerVisibleLanguages(
      stored?.sermonPlannerVisibleLanguages,
      DEFAULT_READING_PREFERENCES.sermonPlannerVisibleLanguages,
    ),
  };
  if (!ORIENTATION_MODES.includes(merged.orientationMode)) {
    merged.orientationMode = 'auto';
  }
  // Whatever format the size was stored in, the scale that renders at that size here.
  merged.fontScale = readStoredFontScale(stored, READING_DEVICE_CLASS, MAX_FONT_SCALE);
  merged.fontScaleVersion = FONT_SCALE_VERSION;
  // The level format's range marker, if an earlier installation wrote one.
  Reflect.deleteProperty(merged, 'fontScaleRangeMax');
  if (!isAppLanguage(merged.appLanguage)) {
    merged.appLanguage = 'en';
  }
  merged.selectedInterpretations = normalizeSelectedInterpretations(stored?.selectedInterpretations);
  merged.selectedSaintHymns = Array.isArray(merged.selectedSaintHymns)
    ? merged.selectedSaintHymns.filter((token): token is string => typeof token === 'string' && token.includes(':'))
    : [];
  merged.saintPsalies = booleanValue(stored?.saintPsalies, DEFAULT_READING_PREFERENCES.saintPsalies);
  merged.keepScreenAwake = booleanValue(stored?.keepScreenAwake, DEFAULT_READING_PREFERENCES.keepScreenAwake);
  merged.documentTheme = isDocumentThemeId(stored?.documentTheme) ? stored.documentTheme : DEFAULT_DOCUMENT_THEME_ID;
  return merged;
}

function booleanValue(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

/** The content choices that belong to a person rather than a particular screen. */
export function syncedReadingPreferences(preferences: ReadingPreferences): SyncedReadingPreferences {
  return {
    visibleLanguages: preferences.visibleLanguages,
    bibleVisibleLanguages: preferences.bibleVisibleLanguages,
    sermonPlannerVisibleLanguages: preferences.sermonPlannerVisibleLanguages,
    displayComments: preferences.displayComments,
    displaySilentPrayers: preferences.displaySilentPrayers,
    bishopPresent: preferences.bishopPresent,
    copticGospelRite: preferences.copticGospelRite,
    selectedSaintHymns: preferences.selectedSaintHymns,
    selectedInterpretations: preferences.selectedInterpretations,
    inMonastery: preferences.inMonastery,
    saintPsalies: preferences.saintPsalies,
    appLanguage: preferences.appLanguage,
  };
}

/** Applies a cloud payload without touching display choices that are device-specific. */
export function applySyncedReadingPreferences(
  local: ReadingPreferences,
  cloudValue: unknown,
): ReadingPreferences {
  const cloud = recordValue(cloudValue);
  const visible = recordValue(cloud.visibleLanguages);
  const bible = recordValue(cloud.bibleVisibleLanguages);
  const sermonPlannerVisibleLanguages = normalizeSermonPlannerVisibleLanguages(
    cloud.sermonPlannerVisibleLanguages,
    local.sermonPlannerVisibleLanguages,
  );
  const saintTokens = Array.isArray(cloud.selectedSaintHymns)
    ? [...new Set(cloud.selectedSaintHymns.filter((token): token is string => (
      typeof token === 'string' && token.includes(':') && token.length <= 256
    )))].slice(0, 250)
    : local.selectedSaintHymns;

  return {
    ...local,
    visibleLanguages: {
      english: booleanValue(visible.english, local.visibleLanguages.english),
      french: booleanValue(visible.french, local.visibleLanguages.french),
      coptic: booleanValue(visible.coptic, local.visibleLanguages.coptic),
      copticRecitedPrayers: booleanValue(visible.copticRecitedPrayers, local.visibleLanguages.copticRecitedPrayers),
      arabic: booleanValue(visible.arabic, local.visibleLanguages.arabic),
    },
    bibleVisibleLanguages: {
      english: booleanValue(bible.english, local.bibleVisibleLanguages.english),
      englishNkjv: booleanValue(bible.englishNkjv, local.bibleVisibleLanguages.englishNkjv),
      englishFromCoptic: booleanValue(bible.englishFromCoptic, local.bibleVisibleLanguages.englishFromCoptic),
      coptic: booleanValue(bible.coptic, local.bibleVisibleLanguages.coptic),
      greek: booleanValue(bible.greek, local.bibleVisibleLanguages.greek),
      arabic: booleanValue(bible.arabic, local.bibleVisibleLanguages.arabic),
      arabicFromCoptic: booleanValue(bible.arabicFromCoptic, local.bibleVisibleLanguages.arabicFromCoptic),
      french: booleanValue(bible.french, local.bibleVisibleLanguages.french),
    },
    sermonPlannerVisibleLanguages,
    displayComments: booleanValue(cloud.displayComments, local.displayComments),
    displaySilentPrayers: booleanValue(cloud.displaySilentPrayers, local.displaySilentPrayers),
    bishopPresent: booleanValue(cloud.bishopPresent, local.bishopPresent),
    copticGospelRite: booleanValue(cloud.copticGospelRite, local.copticGospelRite),
    selectedSaintHymns: saintTokens,
    // An account that has never chosen keeps this device's choice.
    selectedInterpretations: Array.isArray(cloud.selectedInterpretations)
      ? normalizeSelectedInterpretations(cloud.selectedInterpretations)
      : local.selectedInterpretations,
    inMonastery: booleanValue(cloud.inMonastery, local.inMonastery),
    saintPsalies: booleanValue(cloud.saintPsalies, local.saintPsalies),
    appLanguage: isAppLanguage(cloud.appLanguage) ? cloud.appLanguage : local.appLanguage,
  };
}

export async function loadReadingPreferences(): Promise<ReadingPreferences> {
  try {
    if (Platform.OS === 'web') {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const preferences = mergePreferences(raw ? JSON.parse(raw) : null);
      currentAppLanguage = preferences.appLanguage;
      return preferences;
    }

    const FileSystem = await import('expo-file-system/legacy');
    const fileUri = `${FileSystem.documentDirectory}${STORAGE_KEY}.json`;
    const info = await FileSystem.getInfoAsync(fileUri);
    if (!info.exists) {
      const preferences = mergePreferences(null);
      currentAppLanguage = preferences.appLanguage;
      return preferences;
    }
    const raw = await FileSystem.readAsStringAsync(fileUri);
    const preferences = mergePreferences(JSON.parse(raw));
    currentAppLanguage = preferences.appLanguage;
    return preferences;
  } catch {
    const preferences = mergePreferences(null);
    currentAppLanguage = preferences.appLanguage;
    return preferences;
  }
}

export async function saveReadingPreferences(preferences: ReadingPreferences): Promise<void> {
  currentAppLanguage = preferences.appLanguage;
  try {
    if (Platform.OS === 'web') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
      return;
    }

    const FileSystem = await import('expo-file-system/legacy');
    const fileUri = `${FileSystem.documentDirectory}${STORAGE_KEY}.json`;
    await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(preferences));
  } catch {
    // Best-effort persistence — a failed write just means the next session falls back to defaults.
  }
}
