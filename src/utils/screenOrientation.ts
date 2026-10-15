import type { OrientationMode } from './preferencesStorage';

/** The orientations Expo Router's Stack takes (react-native-screens' screen orientation). */
export type StackOrientation = 'default' | 'landscape_right' | 'landscape_left' | 'portrait_up';

const STACK_ORIENTATIONS: Record<OrientationMode, StackOrientation> = {
  auto: 'default',
  landscape: 'landscape_right',
  reverseLandscape: 'landscape_left',
  portrait: 'portrait_up',
};

/**
 * The way a screen may turn. A reading screen (a service, a Bible chapter)
 * follows Book Settings' Orientation on every device. The rest -- the five
 * tabs and the pages off them -- follow it on a tablet, whose layouts are
 * made for either way up; a phone keeps them upright, since turned on its
 * side a phone has the width of a tablet and the height of a postcard.
 */
export function screenOrientationFor(mode: OrientationMode, { phone, reader }: { phone: boolean; reader: boolean }): StackOrientation {
  if (phone && !reader) return 'portrait_up';
  return STACK_ORIENTATIONS[mode];
}
