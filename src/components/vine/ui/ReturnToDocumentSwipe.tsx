import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { type Href, usePathname, useRouter } from 'expo-router';
import { Animated, type GestureResponderEvent, PanResponder, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { COLORS, TYPOGRAPHY } from '../../../constants/theme';
import { tr } from '../../../utils/appText';
import { reopenDocumentAt } from '../../../utils/lastDocumentPosition';
import { settleLeftDocument, takeLeftDocument, useReturnableDocument } from '../../../utils/returnToDocument';
import { motionDuration, useReducedMotion } from '../../../utils/useReducedMotion';

/** How far along a swipe to the left goes back into the document, as a share of the screen. */
const RETURN_SHARE = 0.22;
/** A flick this fast (px per ms) goes back into it whatever its length. */
const RETURN_VELOCITY = 0.45;
/** How long the way back is shown as the reader arrives on the page, before it tucks away. */
const HINT_MS = 4000;

/**
 * Where a touch on the web starts on something that scrolls sideways (a row
 * of chips, a shelf of releases), which keeps the swipe for itself.
 */
function startsOnSideScroller(event: GestureResponderEvent): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  let node = (event.nativeEvent as unknown as { target?: unknown }).target as HTMLElement | null;
  while (node && node instanceof HTMLElement) {
    if (node.scrollWidth > node.clientWidth + 1) {
      const overflow = window.getComputedStyle(node).overflowX;
      if (overflow === 'auto' || overflow === 'scroll') return true;
    }
    node = node.parentElement;
  }
  return false;
}

/**
 * Around the app's pages: on the page a document was just left for (its
 * book's menu, Home, Bookmarks…), a swipe to the left goes back into it,
 * where it was read (utils/returnToDocument.ts). A tab with its name comes in
 * from the right edge with the finger, and shows a moment as the page
 * arrives, to be tapped as well.
 */
export default function ReturnToDocumentSwipe({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  useEffect(() => settleLeftDocument(pathname), [pathname]);
  const document = useReturnableDocument(pathname);

  const [drag] = useState(() => new Animated.Value(0));
  const [hint] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!document) {
      hint.setValue(0);
      return;
    }
    Animated.timing(hint, { toValue: 1, duration: motionDuration(220, reducedMotion), useNativeDriver: Platform.OS !== 'web' }).start();
    const timer = setTimeout(() => {
      Animated.timing(hint, { toValue: 0, duration: motionDuration(260, reducedMotion), useNativeDriver: Platform.OS !== 'web' }).start();
    }, HINT_MS);
    return () => clearTimeout(timer);
  }, [document, hint, reducedMotion]);

  const goBackIn = () => {
    const left = takeLeftDocument(pathname);
    if (!left) return;
    reopenDocumentAt(left.key, left.sectionId, left.sections, left.signature, left.verseIndex);
    router.push(left.href as Href);
  };
  // The gesture below is made once: it reads the latest of these as it goes.
  const latest = useRef({ goBackIn, returnable: Boolean(document), width });
  useLayoutEffect(() => {
    latest.current = { goBackIn, returnable: Boolean(document), width };
  });

  // eslint-disable-next-line react-hooks/refs -- refs are read in gesture callbacks, not during render
  const [responder] = useState(() => PanResponder.create({
    onMoveShouldSetPanResponder: (event, gesture) =>
      latest.current.returnable && gesture.dx < -14 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 2 && !startsOnSideScroller(event),
    // Once taken for a swipe to the left, it is kept to its end.
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (_event, gesture) => drag.setValue(Math.min(0, gesture.dx)),
    onPanResponderRelease: (_event, gesture) => {
      if (gesture.dx < -latest.current.width * RETURN_SHARE || gesture.vx < -RETURN_VELOCITY) {
        drag.setValue(0);
        latest.current.goBackIn();
        return;
      }
      Animated.spring(drag, { toValue: 0, useNativeDriver: Platform.OS !== 'web', bounciness: 0 }).start();
    },
    onPanResponderTerminate: () => {
      Animated.spring(drag, { toValue: 0, useNativeDriver: Platform.OS !== 'web', bounciness: 0 }).start();
    },
  }));

  const name = document
    ? tr(document.title.english, document.title.french || document.title.english, document.title.arabic || document.title.english)
    : '';
  // Out of sight past the right edge; in with the finger, or with the hint.
  const TAB_WIDTH = Math.min(320, width * 0.78);
  // Each is how far out it is held, 0 (all the way in) to its width; the
  // tab shows as far in as either brings it.
  const pulled = drag.interpolate({ inputRange: [-TAB_WIDTH, 0], outputRange: [0, TAB_WIDTH], extrapolate: 'clamp' });
  const hinted = hint.interpolate({ inputRange: [0, 1], outputRange: [TAB_WIDTH, 0] });
  const translateX = Animated.add(pulled, hinted).interpolate({ inputRange: [TAB_WIDTH, TAB_WIDTH * 2], outputRange: [0, TAB_WIDTH], extrapolate: 'clamp' });

  // On the web the browser takes a sideways touch for its own (pointercancel)
  // unless told the page only pans up and down here; inner rows that scroll
  // sideways keep theirs.
  return (
    <View style={[styles.frame, document && Platform.OS === 'web' ? styles.panYWeb : null]} {...(document ? responder.panHandlers : {})}>
      {children}
      {document ? (
        <Animated.View pointerEvents="box-none" style={[styles.tabRow, { width: TAB_WIDTH, transform: [{ translateX }] }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tr(`Back to ${name}`, `Revenir à ${name}`, `العودة إلى ${name}`)}
            onPress={goBackIn}
            style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
          >
            <Text style={styles.chevron}>‹</Text>
            <Text style={styles.label} numberOfLines={2}>
              {tr('Back to ', 'Revenir à ', 'العودة إلى ')}
              <Text style={styles.name}>{name}</Text>
            </Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1 },
  panYWeb: { touchAction: 'pan-y' } as object,
  tabRow: { position: 'absolute', right: 0, top: '42%' },
  tab: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderBottomLeftRadius: 18,
    borderColor: COLORS.gold,
    borderTopLeftRadius: 18,
    borderWidth: 1,
    borderRightWidth: 0,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  tabPressed: { opacity: 0.8 },
  chevron: { color: COLORS.gold, fontFamily: TYPOGRAPHY.title, fontSize: 26, lineHeight: 28 },
  label: { color: COLORS.white, flexShrink: 1, fontFamily: TYPOGRAPHY.body, fontSize: 14 },
  name: { color: COLORS.gold, fontFamily: TYPOGRAPHY.title, fontSize: 15, fontWeight: '700' },
});
