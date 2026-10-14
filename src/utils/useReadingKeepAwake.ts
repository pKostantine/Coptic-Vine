import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect } from 'react';
import { Platform } from 'react-native';

/** One tag for the readers, so a chapter opened over a service never releases the lock the service holds. */
const TAG = 'coptic-vine-reading';

/**
 * Keeps the screen on while `active` — a service or a chapter is open and
 * the reader is looking at it. A liturgy runs for hours with the phone
 * propped on the pew, and the screen going dark mid-hymn is the first thing
 * anyone notices.
 *
 * On a device this is the platform's keep-awake flag. On the web it is the
 * Screen Wake Lock, which the browser lets go of whenever the page is hidden
 * (a switch to another tab, the lock screen), so it is taken again each time
 * the page comes back. A browser without the API simply does nothing.
 */
export function useReadingKeepAwake(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    let released = false;
    const acquire = () => {
      activateKeepAwakeAsync(TAG).catch(() => {});
    };
    acquire();

    const web = Platform.OS === 'web' && typeof document !== 'undefined';
    const onVisibilityChange = () => {
      if (!released && document.visibilityState === 'visible') acquire();
    };
    if (web) document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      released = true;
      if (web) document.removeEventListener('visibilitychange', onVisibilityChange);
      // Nothing to release when the request never succeeded.
      deactivateKeepAwake(TAG).catch(() => {});
    };
  }, [active]);
}
