import { useEffect, useRef, useState } from 'react';
import {
  Animated, PanResponder, type NativeScrollEvent, type NativeSyntheticEvent, type PanResponderCallbacks,
  type PanResponderGestureState,
} from 'react-native';

const DRAG_TO_CLOSE = 80;

function isPullDown(gesture: PanResponderGestureState) {
  return gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.2;
}

/**
 * Drags a sheet down to close it, the way an iOS sheet pulls down: by its grab
 * handle at any time, and by anywhere else on the sheet when the pull starts
 * with its content scrolled to the top. A pull that starts further down the
 * content just scrolls it back up.
 *
 * Spread `grabHandlers` on the grab handle, `sheetHandlers` on the sheet, and
 * `onScroll` on its ScrollView. A sheet whose content scrolls itself (a web
 * view) takes the grab handle alone, since there is no telling where that
 * content has scrolled to.
 */
export function useSheetDragToClose(visible: boolean, drag: Animated.Value, onClose: () => void) {
  // The handlers outlive renders; they read the latest onClose from here.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // A sheet opens with its content at the top.
  const scrollTopRef = useRef(0);
  useEffect(() => {
    if (visible) scrollTopRef.current = 0;
  }, [visible]);
  // Decided when the finger lands and kept for the whole drag, so a pull that
  // starts down the content never turns into closing the sheet partway through.
  const startedAtTopRef = useRef(true);

  // eslint-disable-next-line react-hooks/refs -- refs are read in gesture callbacks, not during render
  const [responders] = useState(() => {
    const dragging: PanResponderCallbacks = {
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, gesture) => drag.setValue(Math.max(0, gesture.dy)),
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > DRAG_TO_CLOSE || gesture.vy > 1.2) onCloseRef.current();
        else Animated.spring(drag, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
      },
      onPanResponderTerminate: () => Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start(),
    };
    return {
      grab: PanResponder.create({ ...dragging, onMoveShouldSetPanResponder: (_, gesture) => isPullDown(gesture) }),
      sheet: PanResponder.create({
        ...dragging,
        onStartShouldSetPanResponderCapture: () => {
          startedAtTopRef.current = scrollTopRef.current <= 0;
          return false;
        },
        // Taken ahead of the ScrollView, which would otherwise swallow the pull.
        onMoveShouldSetPanResponderCapture: (_, gesture) => startedAtTopRef.current && isPullDown(gesture),
      }),
    };
  });

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollTopRef.current = event.nativeEvent.contentOffset.y;
  };

  return { grabHandlers: responders.grab.panHandlers, sheetHandlers: responders.sheet.panHandlers, onScroll };
}
