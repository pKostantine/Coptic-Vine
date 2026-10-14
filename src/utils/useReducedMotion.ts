import { useSyncExternalStore } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

// One answer for the whole app, read from the system once anything asks and
// kept current after that: Reduce Motion on iOS and Android, the
// prefers-reduced-motion media query on the web.
let reduced = false;
let watching = false;
const listeners = new Set<() => void>();

function setReduced(value: boolean) {
  if (reduced === value) return;
  reduced = value;
  for (const listener of listeners) listener();
}

function watch() {
  if (watching) return;
  watching = true;
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);
    const onChange = (event: { matches: boolean }) => setReduced(event.matches);
    if (typeof query.addEventListener === 'function') query.addEventListener('change', onChange);
    else query.addListener(onChange);
    return;
  }
  AccessibilityInfo.isReduceMotionEnabled().then(setReduced).catch(() => {});
  AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
}

export function subscribeReducedMotion(listener: () => void): () => void {
  listeners.add(listener);
  watch();
  return () => { listeners.delete(listener); };
}

export function getReducedMotion(): boolean {
  return reduced;
}

/** Whether the reader has asked the system for less motion. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, getReducedMotion, getReducedMotion);
}

/**
 * An animation's duration, or none when less motion was asked for: the
 * sheet, drawer or overlay simply appears where it would have slid to.
 */
export function motionDuration(milliseconds: number, reducedMotion: boolean): number {
  return reducedMotion ? 0 : milliseconds;
}
