import { type Href, type ImperativeRouter, useNavigationContainerRef, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Platform } from 'react-native';

/**
 * router.back() silently no-ops (with a dev-only "GO_BACK was not handled by
 * any navigator" warning) when there's no navigation history to pop — e.g. a
 * direct deep link or a page reload on web. Falls back to replacing with a
 * known parent route so the back affordance always does something.
 */
export function goBack(router: ImperativeRouter, fallbackHref: Href) {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallbackHref);
  }
}

/** The five sections' own pages, by their route in the app's stack (app/_layout.tsx). */
const SECTION_ROUTES = {
  '/': 'index',
  '/books': 'books/index',
  '/music': 'music',
  '/learn': 'learn',
  '/account': 'account',
} as const;

export type SectionHref = keyof typeof SECTION_ROUTES;

interface StackState {
  key: string;
  routeNames?: string[];
  routes: { state?: StackState }[];
}

/** The app's own stack within the navigation state: the navigator whose pages include Account. */
function findAppStack(state: StackState | undefined): StackState | null {
  if (!state) return null;
  if (state.routeNames?.includes(SECTION_ROUTES['/account'])) return state;
  for (const route of state.routes) {
    const found = findAppStack(route.state);
    if (found) return found;
  }
  return null;
}

/**
 * Opens one of the app's five sections — Home, Books, Music, Learn, Account —
 * as the only page in the app's stack, from the tab bar or the sidebar.
 *
 * Pages opened within a section show the tab bar too (Downloads over
 * Account, a book page over Books), and router.replace swapped only that
 * page: Account → Downloads → Books left Account beneath Books, and the next
 * back — a swipe, Android's back, a document's own swipe — went to Account.
 * A section opened afresh has nothing beneath it to go back to.
 *
 * On the web the reset alone would replace the browser's history entry, so
 * Chrome's Back skipped every section visited and left the page, reloading
 * the site and stopping playback. The page being left gets its own entry
 * first, so Back and Forward move between sections within the page.
 */
export function useOpenSection(): (href: SectionHref) => void {
  const navigationRef = useNavigationContainerRef();
  const router = useRouter();
  return useCallback((href: SectionHref) => {
    const stack = navigationRef.isReady() ? findAppStack(navigationRef.getRootState() as unknown as StackState) : null;
    if (!stack) {
      router.replace(href);
      return;
    }
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.pathname !== href) {
      // The router then writes the section over this copy (same history id).
      window.history.pushState(window.history.state, '', window.location.href);
    }
    navigationRef.dispatch({ type: 'RESET', payload: { index: 0, routes: [{ name: SECTION_ROUTES[href] }] }, target: stack.key });
  }, [navigationRef, router]);
}
