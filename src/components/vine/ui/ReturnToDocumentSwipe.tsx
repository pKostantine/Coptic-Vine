import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { type Href, usePathname, useRouter } from 'expo-router';
import { type GestureResponderEvent, PanResponder, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';

import { reopenDocumentAt } from '../../../utils/lastDocumentPosition';
import { settleLeftDocument, takeLeftDocument, useReturnableDocument } from '../../../utils/returnToDocument';

/** How far along a swipe to the left goes back into the document, as a share of the screen. */
const RETURN_SHARE = 0.22;
/** A flick this fast (px per ms) goes back into it whatever its length. */
const RETURN_VELOCITY = 0.45;

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
 * where it was read (utils/returnToDocument.ts). Nothing is drawn for it.
 */
export default function ReturnToDocumentSwipe({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { width } = useWindowDimensions();
  useEffect(() => settleLeftDocument(pathname), [pathname]);
  const document = useReturnableDocument(pathname);

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
    onPanResponderRelease: (_event, gesture) => {
      if (gesture.dx < -latest.current.width * RETURN_SHARE || gesture.vx < -RETURN_VELOCITY) {
        latest.current.goBackIn();
      }
    },
  }));

  // On the web the browser takes a sideways touch for its own (pointercancel)
  // unless told the page only pans up and down here; inner rows that scroll
  // sideways keep theirs.
  return (
    <View style={[styles.frame, document && Platform.OS === 'web' ? styles.panYWeb : null]} {...(document ? responder.panHandlers : {})}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1 },
  panYWeb: { touchAction: 'pan-y' } as object,
});
