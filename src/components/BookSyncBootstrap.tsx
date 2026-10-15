import * as Network from 'expo-network';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { bookDownloadManager, getAutomaticBookUpdatesEnabled } from '@/services/bookDownloadManager';
import { warmCalendar } from '@/utils/calendarService';

/** Long enough for the first screen to have drawn and loaded what it needs itself. */
const CALENDAR_WARM_DELAY_MS = 2000;

function isWifi(type: Network.NetworkStateType | undefined): boolean {
  return type === Network.NetworkStateType.WIFI || type === Network.NetworkStateType.ETHERNET;
}

export default function BookSyncBootstrap() {
  useEffect(() => {
    // With the calendar installed, read it into memory once launch has
    // settled, so the season selector and the calendar open without waiting
    // for it. Off the launch path, and nothing at all without the calendar.
    const warm = setTimeout(() => {
      warmCalendar().catch(() => {});
    }, CALENDAR_WARM_DELAY_MS);
    return () => clearTimeout(warm);
  }, []);

  useEffect(() => {
    let active = true;
    let syncing = false;
    const sync = async () => {
      if (!active || syncing) return;
      const network = await Network.getNetworkStateAsync();
      if (!active || network.isConnected === false || network.type === Network.NetworkStateType.NONE) return;
      syncing = true;
      try {
        // The liturgical calendar comes with the app: it is fetched on the
        // first connection of any kind, whatever the cellular choice, and
        // kept current the same way. Books wait for Wi-Fi below.
        await bookDownloadManager.ensureCalendar();
        if (!isWifi(network.type)) return;
        // A dropped connection marks only the incomplete chunk failed. Resume
        // user-requested initial installs when Wi-Fi returns; intentionally
        // paused books remain paused.
        const interrupted = (await bookDownloadManager.listBooks())
          .filter((book) => book.status === 'failed' && book.totalBytes != null);
        for (const book of interrupted) await bookDownloadManager.retry(book.bookKey);
        if (await getAutomaticBookUpdatesEnabled()) await bookDownloadManager.checkForUpdates(false);
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
