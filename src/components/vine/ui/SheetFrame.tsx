import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, BackHandler, Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS } from '../../../constants/theme';
import { useLayoutMode } from '../../../utils/useLayoutMode';
import { motionDuration, useReducedMotion } from '../../../utils/useReducedMotion';
import { useSheetDragToClose } from './useSheetDragToClose';
import { useModalOrientations } from '@/hooks/useModalOrientations';

interface SheetFrameProps {
  visible: boolean;
  onClose: () => void;
  /** What the dimmed area is called to a screen reader: "Close the settings". */
  closeLabel: string;
  /**
   * Drawn in the page itself rather than in a native modal — for a sheet that
   * opens inside another modal, since iOS presents one native modal at a time.
   */
  inline?: boolean;
  /** The centred dialog's width on a desktop (and, with `dialogOnTablet`, an iPad). */
  dialogWidth?: number;
  /** Open as a centred dialog on the iPad too, not only on the desktop. */
  dialogOnTablet?: boolean;
  /** The sheet's widest, on a phone or iPad. */
  sheetMaxWidth?: number;
  /** Whether the content scrolls inside the frame (true) or manages its own scrolling (false). */
  scroll?: boolean;
  children: ReactNode;
}

/**
 * The frame every sheet of the app shares (Coptic Vine design, "Calendar
 * popup", "Book settings", "Choose hymns"): on a phone it slides up from the
 * foot of the page over a dimmed backdrop, with a grab handle to drag it
 * closed; on a desktop (and where asked, an iPad) it opens as a centred
 * dialog. Closes on the dimmed area, the back button, or a drag down.
 */
export default function SheetFrame({
  visible, onClose, closeLabel, inline = false, dialogWidth = 440, dialogOnTablet = false, sheetMaxWidth = 560, scroll = true, children,
}: SheetFrameProps) {
  const modalOrientations = useModalOrientations();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const layout = useLayoutMode();
  const dialog = layout === 'desktop' || (dialogOnTablet && layout === 'tablet');
  const [mounted, setMounted] = useState(visible);
  const [progress] = useState(() => new Animated.Value(0));
  const [drag] = useState(() => new Animated.Value(0));
  // The drag handler outlives renders; it reads the latest onClose from here.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  if (visible && !mounted) setMounted(true);

  const reduced = useReducedMotion();
  useEffect(() => {
    if (visible) {
      drag.setValue(0);
      Animated.timing(progress, { toValue: 1, duration: motionDuration(260, reduced), useNativeDriver: true }).start();
    } else if (mounted) {
      Animated.timing(progress, { toValue: 0, duration: motionDuration(200, reduced), useNativeDriver: true }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible, mounted, progress, drag, reduced]);

  // Pulled down from anywhere on the sheet while its content is scrolled to
  // the top. Content that scrolls itself is dragged by the grab handle alone.
  const sheetDrag = useSheetDragToClose(visible, drag, onClose);

  // Inline there is no modal to catch Android's back button, so the sheet does.
  useEffect(() => {
    if (!inline || !visible) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onCloseRef.current();
      return true;
    });
    return () => subscription.remove();
  }, [inline, visible]);

  if (!mounted) return null;

  const layer = (content: ReactNode) => (inline
    ? <View style={styles.inlineLayer}>{content}</View>
    : <Modal supportedOrientations={modalOrientations} visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>{content}</Modal>);

  const body = scroll ? (
    <ScrollView bounces={false} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent} onScroll={sheetDrag.onScroll} scrollEventThrottle={16}>
      {children}
    </ScrollView>
  ) : (
    <View style={styles.fill}>{children}</View>
  );

  const backdrop = (
    <Animated.View style={[styles.dim, { opacity: progress }]}>
      <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel={closeLabel} onPress={onClose} />
    </Animated.View>
  );

  if (dialog) {
    const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] });
    return layer(
      <>
        {backdrop}
        <View style={styles.dialogFrame} pointerEvents="box-none">
          <Animated.View style={[styles.dialog, { maxHeight: height - 80, width: dialogWidth, opacity: progress, transform: [{ scale }] }]}>
            {body}
          </Animated.View>
        </View>
      </>,
    );
  }

  const translateY = Animated.add(
    progress.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }),
    drag,
  );

  return layer(
    <>
      {backdrop}
      <Animated.View
        style={[styles.sheet, { maxHeight: height - insets.top - 60, maxWidth: sheetMaxWidth, paddingBottom: insets.bottom + 22, transform: [{ translateY }] }]}
        {...(scroll ? sheetDrag.sheetHandlers : {})}
      >
        <View style={styles.grabArea} {...sheetDrag.grabHandlers}>
          <View style={styles.grab} />
        </View>
        {body}
      </Animated.View>
    </>,
  );
}

const styles = StyleSheet.create({
  inlineLayer: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0, zIndex: 1000 },
  dim: { backgroundColor: 'rgba(0, 0, 0, 0.66)', bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  fill: { flexShrink: 1 },
  scrollContent: { paddingHorizontal: 16 },
  sheet: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.goldLine,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    bottom: 0,
    elevation: 20,
    left: 0,
    marginHorizontal: 'auto',
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -20 },
    shadowOpacity: 0.6,
    shadowRadius: 25,
    width: '100%',
  },
  dialogFrame: { alignItems: 'center', bottom: 0, justifyContent: 'center', left: 0, position: 'absolute', right: 0, top: 0 },
  // The centred dialog: the sheet's surface and gold top rule, rounded all round.
  dialog: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.goldLine,
    borderRadius: 28,
    borderTopWidth: 1,
    boxShadow: '0px 20px 50px rgba(0, 0, 0, 0.6)',
    overflow: 'hidden',
    paddingBottom: 22,
    paddingTop: 10,
  },
  grabArea: { alignItems: 'center', paddingBottom: 12, paddingTop: 10 },
  grab: { backgroundColor: 'rgba(255, 255, 255, 0.2)', borderRadius: 3, height: 5, width: 40 },
});
