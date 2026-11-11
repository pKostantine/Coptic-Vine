import { useGlobalSearchParams, usePathname } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useCalendar } from '../context/CalendarContext';
import { addressWithDay, DAY_PARAM, formatDayParam } from '../utils/dayInUrl';

/**
 * On the web, keeps the day being read in the page's address (`?day=…`,
 * utils/dayInUrl.ts) while it isn't live, on every page it goes to, so the
 * link can be shared or reloaded on that day; going live takes it out. It
 * rewrites the current history entry, and keeps the router's own state on it,
 * so Back and Forward are unchanged. The router writes each new page's
 * address without the day, so it is set again just after (a timer, after the
 * router's own write).
 */
export default function DayInUrl() {
  const { isLive, rawDate, liturgicalDayPeriod } = useCalendar();
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  const day = isLive ? null : formatDayParam(rawDate, liturgicalDayPeriod);
  // The page's own query (other than the day) changes the address as well.
  const query = JSON.stringify(Object.entries(params).filter(([key]) => key !== DAY_PARAM));

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    const write = () => {
      const next = addressWithDay(window.location.href, day);
      const current = window.location.pathname + window.location.search + window.location.hash;
      if (next !== current) window.history.replaceState(window.history.state, '', next);
    };
    write();
    const timer = setTimeout(write, 0);
    return () => clearTimeout(timer);
  }, [day, pathname, query]);

  return null;
}
