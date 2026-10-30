import * as Network from 'expo-network';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { bookDownloadManager } from '@/services/bookDownloadManager';
import { warmCalendar } from '@/utils/calendarService';

/** Long enough for the first screen to have drawn and loaded what it needs itself. */
const CALENDAR_WARM_DELAY_MS = 2000;
/** How often coming back to the app looks for newly published books. */
const UPDATE_CHECK_INTERVAL_MS = 10 * 60 * 1000;

function isWifi(type: Network.NetworkStateType | undefined): boolean {
  return type === Network.NetworkStateType.WIFI || type === Network.NetworkStateType.ETHERNET;
}

export default function BookSyncBootstrap() {
  useEffect(() => {
    // With the calendar installed, read it into memory once launch has
    // settled, so the season selector and the calendar open without waiting
    // for it. Off the launch path, and nothing at all without the calendar.
    // Begun when JavaScript next has a moment to spare, not in the middle of
    // whatever the reader is doing two seconds in.
    let idle: number | null = null;
    const warm = setTimeout(() => {
      const begin = () => { warmCalendar().catch(() => {}); };
      if (typeof requestIdleCallback === 'function') idle = requestIdleCallback(begin, { timeout: CALENDAR_WARM_DELAY_MS });
      else begin();
    }, CALENDAR_WARM_DELAY_MS);
    return () => {
      clearTimeout(warm);
      if (idle != null && typeof cancelIdleCallback === 'function') cancelIdleCallback(idle);
    };
  }, []);

  useEffect(() => {
    let active = true;
    let syncing = false;
    let lastUpdateCheck = 0;
    const sync = async () => {
      if (!active || syncing) return;
      // Taken before the first wait: iOS reports the network the moment it is
      // listened to, which began a second sync alongside the launch's own.
      syncing = true;
      const network = await Network.getNetworkStateAsync().catch(() => null);
      if (!active || !network || network.isConnected === false || network.type === Network.NetworkStateType.NONE) {
        syncing = false;
        return;
      }
      try {
        // The liturgical calendar comes with the app: it is fetched on the
        // first connection of any kind, whatever the cellular choice, and
        // kept current the same way. Books wait for Wi-Fi below.
        await bookDownloadManager.ensureCalendar();
        // Look for new editions of the downloaded books on any connection, at
        // most every ten minutes: a book with one shows "Update available".
        // checkForUpdates downloads them itself only on Wi-Fi with automatic
        // updates on.
        if (Date.now() - lastUpdateCheck > UPDATE_CHECK_INTERVAL_MS) {
          lastUpdateCheck = Date.now();
          await bookDownloadManager.checkForUpdates(false);
        }
        if (!isWifi(network.type)) return;
        // A dropped connection marks only the incomplete chunk failed. Resume
        // user-requested initial installs when Wi-Fi returns; intentionally
        // paused books remain paused.
        const interrupted = (await bookDownloadManager.listBooks())
          .filter((book) => book.status === 'failed' && book.totalBytes != null);
        for (const book of interrupted) await bookDownloadManager.retry(book.bookKey);
      } catch (error) {
        // Offline/unreachable startup is expected. Installed content remains
        // active and the network listener retries when Wi-Fi returns.
        console.warn('Offline book synchronization deferred:', error instanceof Error ? error.message : error);
      } finally { syncing = false; }
    };

    void sync();
    const networkSubscription = Network.addNetworkStateListener((state) => {
      if (state.isConnected !== false && state.type !== Network.NetworkStateType.NONE) void sync();
    });
    const appSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void sync();
    });
    return () => {
      active = false;
      networkSubscription.remove();
      appSubscription.remove();
    };
  }, []);

  return null;
}
