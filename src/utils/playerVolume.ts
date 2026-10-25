import { Platform } from 'react-native';

/**
 * Whether the player's own volume can be set here. Safari on the iPhone and
 * the iPad ignores a page's volume (Apple leaves it to the side buttons), so
 * there the player shows no volume bar and never sets one.
 */
export const PLAYER_VOLUME_ADJUSTABLE = !isAppleTouchBrowser();

function isAppleTouchBrowser(): boolean {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;
  const agent = navigator.userAgent || '';
  // iPadOS asks for the desktop site, as a Mac with a touch screen.
  return /\b(iPhone|iPad|iPod)\b/.test(agent) || (/\bMacintosh\b/.test(agent) && navigator.maxTouchPoints > 1);
}

/** A volume from silence (0) to full (1); anything else plays at full. */
export function clampVolume(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1;
}
