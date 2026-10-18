import { useFonts as useLocalFonts } from 'expo-font';
import { Stack, usePathname, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { BackHandler, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import BookSyncBootstrap from '@/components/BookSyncBootstrap';
import NotificationBootstrap from '@/components/NotificationBootstrap';
import GlobalNowPlayingOverlay from '@/components/playback/GlobalNowPlayingOverlay';
import LessonVideoStage from '@/components/playback/LessonVideoStage';
import SideBar from '@/components/vine/ui/SideBar';
import { COLORS } from '@/constants/theme';
import { AuthProvider } from '@/context/AuthContext';
import { BottomChromeProvider, useBottomChrome } from '@/context/BottomChromeContext';
import { CalendarProvider } from '@/context/CalendarContext';
import { LiturgicalClockProvider } from '@/context/LiturgicalClockContext';
import { MusicPlayerProvider } from '@/context/MusicPlayerContext';
import { ReadingPreferencesProvider, useReadingPreferences } from '@/context/ReadingPreferencesContext';
import { SpiritualCanonProvider } from '@/context/SpiritualCanonContext';
import { VideoStageProvider } from '@/context/VideoStageContext';
import { keepsWholeWindow } from '@/utils/desktopChrome';
import type { OrientationMode } from '@/utils/preferencesStorage';
import { useLayoutMode } from '@/utils/useLayoutMode';

SplashScreen.preventAutoHideAsync();

/**
 * A page that throws while rendering is shown as a notice with a way back,
 * rather than a blank window (or, in development, the red box). Expo Router
 * reads this export from every route; here on the root layout it catches
 * whatever no nearer route has.
 */
export { default as ErrorBoundary } from '@/components/vine/screens/AppErrorScreen';

type StackOrientation = 'default' | 'landscape_right' | 'landscape_left' | 'portrait_up';

const STACK_ORIENTATIONS: Record<OrientationMode, StackOrientation> = {
  auto: 'default',
  landscape: 'landscape_right',
  reverseLandscape: 'landscape_left',
  portrait: 'portrait_up',
};

/** A tab's own page: it opens in place, and is never swiped away to whatever lies beneath it. */
const TAB_PAGE = { animation: 'none', gestureEnabled: false } as const;
const TAB_PATHS = new Set(['/', '/books', '/music', '/learn', '/account']);

function AppStack() {
  const { preferences } = useReadingPreferences();
  const orientation = STACK_ORIENTATIONS[preferences.orientationMode];

  // Expo Router delegates this option to the native screen controller. That
  // keeps its bounds and orientation in one lifecycle, including when an iPad
  // scene returns from the background. Calling lockAsync from AppState's
  // immediate "active" event can race the scene's restored dimensions and
  // leave the route rendered with portrait-width bounds in landscape.
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.black },
        orientation,
      }}
    >
      {/* Home, Books, Music, Learn & Study, and Account are peer sections,
          each a page of its own: there is nowhere to swipe back to from one.
          The tab bar replaces whatever page it is on, but a book page (which
          shows it) was pushed over Books, so Books stayed underneath the tab
          it was replaced by, and iOS's edge swipe brought it back. A swipe
          back from a page within a section -- a book, an album -- is that
          page's own, and still goes back. */}
      <Stack.Screen name="index" options={TAB_PAGE} />
      <Stack.Screen name="books" options={TAB_PAGE} />
      <Stack.Screen name="music" options={TAB_PAGE} />
      <Stack.Screen name="learn" options={TAB_PAGE} />
      <Stack.Screen name="search" options={{ animation: 'none' }} />
      <Stack.Screen name="account" options={TAB_PAGE} />
      <Stack.Screen name="settings" options={{ animation: 'none' }} />
      <Stack.Screen name="synaxarium" options={{ animation: 'default' }} />
      <Stack.Screen name="app-settings" options={{ animation: 'none' }} />

      {/* The now-playing views are floating overlays that sit on top of the
          current page instead of acting like a separate app screen. */}
    </Stack>
  );
}

/**
 * On a desktop browser the app sits beside the left sidebar (Coptic Vine,
 * "Layout and spacing"), which takes the place of the bottom tab bar; on the
 * phone and the iPad the pages fill the window and carry the tab bar
 * themselves.
 */
function AppFrame() {
  const layout = useLayoutMode();
  const pathname = usePathname();
  const segments = useSegments() as string[];
  // A full now-playing screen is an overlay, not a route, so the segments alone
  // cannot tell us it is open — the overlay reports it instead.
  const { nowPlayingExpanded } = useBottomChrome();
  const showSideBar = layout === 'desktop' && !keepsWholeWindow(segments) && !nowPlayingExpanded;

  // Android's back, button or swipe, on a tab's own page leaves the app, as at
  // the root of any app, rather than uncovering the tab visited before it (see
  // TAB_PAGE). Registered first, so it is asked last: a sheet or the player
  // open over the page takes the back for itself before it gets here.
  // The path is read from a ref rather than registering afresh on every
  // change, which would put this handler first in line instead of last.
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!TAB_PATHS.has(pathnameRef.current)) return false;
      BackHandler.exitApp();
      return true;
    });
    return () => subscription.remove();
  }, []);

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: COLORS.black }}>
      {showSideBar ? <SideBar pathname={pathname} /> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppStack />
        <GlobalNowPlayingOverlay />
      </View>
      {/* The one video surface, over the whole window: it is measured against
          the window, so it can lie over a lesson page's slot as much as sit in
          a corner, beside the sidebar on a desktop. */}
      <LessonVideoStage />
    </View>
  );
}

export default function RootLayout() {
  // Keep the two Coptic fonts deliberately separate: Books/readers use the
  // Coptic Vine custom face, while Music synchronized lyrics use Athanasius.
  const [copticLoaded] = useLocalFonts({
    'CopticVine-Regular': require('../../assets/fonts/CopticVine-Regular-v4.1.ttf'),
    // Coptic set in italic (comments, refrains) is drawn in its own italic face.
    'CopticVine-Italic': require('../../assets/fonts/CopticVine-Italic-v4.1.ttf'),
    Athanasius: require('../../assets/fonts/CopticVine-Athanasius-v1.0.ttf'),
  });

  const fontsReady = copticLoaded;

  useEffect(() => {
    if (fontsReady) {
      SplashScreen.hideAsync();
    }
  }, [fontsReady]);

  if (!fontsReady) {
    return <View style={{ flex: 1, backgroundColor: COLORS.black }} />;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NotificationBootstrap />
        <BookSyncBootstrap />
        <ReadingPreferencesProvider>
          <SpiritualCanonProvider>
            <LiturgicalClockProvider>
              <CalendarProvider>
                <MusicPlayerProvider>
                  <VideoStageProvider>
                    <StatusBar style="light" />
                    <BottomChromeProvider>
                      <AppFrame />
                    </BottomChromeProvider>
                  </VideoStageProvider>
                </MusicPlayerProvider>
              </CalendarProvider>
            </LiturgicalClockProvider>
          </SpiritualCanonProvider>
        </ReadingPreferencesProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
