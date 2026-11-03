import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Modal, PanResponder, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { type DocumentTheme } from '../../../constants/documentThemes';
import { TYPOGRAPHY } from '../../../constants/theme';
import { useModalOrientations } from '@/hooks/useModalOrientations';
import { readerSwipeFinishMs, readerSwipeFor, readerSwipeGoesThrough } from '../../../utils/readerSwipe';
import { MOBILE_WEB_BREAKPOINT } from '../../../utils/useIsMobileWeb';
import { motionDuration, useReducedMotion } from '../../../utils/useReducedMotion';
import Icon, { type IconName } from './Icon';
import { readerPanelColors, readerPanelLayout, type ReaderPanelLayout } from './readerPanelParts';

export interface ReaderPanelAction {
  icon: IconName;
  accessibilityLabel: string;
  onPress: () => void;
}

interface ReaderPanelProps {
  visible: boolean;
  onClose: () => void;
  closeAccessibilityLabel: string;
  /** The small word over the title, in the panel's voice: "Contents", "Verses". */
  eyebrow: string;
  title: string;
  /** Set the title right to left. */
  titleArabic?: boolean;
  /** The round buttons beside the title. */
  actions?: ReaderPanelAction[];
  theme: DocumentTheme;
  /** Whatever sits between the header and the list: a search field, the chapter row and the language chips. */
  top?: (layout: ReaderPanelLayout) => ReactNode;
  children: (layout: ReaderPanelLayout) => ReactNode;
  /** Pinned under the list, over a hairline: the Bishop present switch. */
  footer?: ReactNode;
  /**
   * The share of the panel already in view as it opens: brought in so far by
   * a finger (ReaderPanelSheet), it carries on from there rather than from
   * off the edge.
   */
  openFrom?: number;
  /** Once the panel is up on the screen. */
  onShown?: () => void;
}

/** A finger landing on a control that drags sideways itself (ReaderPanelOwnDrag): the panel leaves that finger alone. */
const ReaderPanelHoldContext = createContext<(() => void) | null>(null);

/**
 * Around a control in the panel that takes sideways drags of its own -- the
 * Verses panel's row of language chips, scrolled along -- so a finger going
 * right on it scrolls it rather than swiping the panel away. `when` is asked
 * as the finger lands: a row scrolled back to its start has nothing to
 * scroll to the right, and the swipe is the panel's again.
 */
export function ReaderPanelOwnDrag({ when, children }: { when?: () => boolean; children: ReactNode }) {
  const hold = useContext(ReaderPanelHoldContext);
  return (
    <View onTouchStart={() => { if (hold && (!when || when())) hold(); }}>
      {children}
    </View>
  );
}

/** The panel's size for this screen (readerPanelLayout), as the panel and its sheet both take it. */
export function useReaderPanelLayout(): ReaderPanelLayout {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return readerPanelLayout({
    width,
    height,
    native: Platform.OS !== 'web',
    mobileWebBreakpoint: MOBILE_WEB_BREAKPOINT,
    rightInset: insets.right,
  });
}

/**
 * The sheet the reader's Contents and Verses come in on: from the right, over
 * the page dimmed a third, in the page's own colours (readerPanelParts.ts).
 * A word in its voice over the document's title heads it, its buttons round
 * beside the title; under them whatever the panel lists, and a footer pinned
 * at the bottom.
 *
 * Its size is the screen's (readerPanelLayout): a desktop or tablet sheet, most
 * of a phone held upright, and on a phone on its side a narrow sheet that
 * leaves the text on the notch side in view.
 *
 * On a phone or a tablet it goes as it came, under the finger: a swipe to the
 * right, on the panel or on the dimmed page beside it, takes it back toward
 * the edge, and let go past a third of its way or flicked it closes, carrying
 * on from where the finger left it (utils/readerSwipe.ts); short of that it
 * slides back in. A browser closes it with a click beside it, as before.
 */
export default function ReaderPanel({
  visible,
  onClose,
  closeAccessibilityLabel,
  eyebrow,
  title,
  titleArabic = false,
  actions = [],
  theme,
  top,
  children,
  footer,
  openFrom = 0,
  onShown,
}: ReaderPanelProps) {
  const modalOrientations = useModalOrientations();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const layout = useReaderPanelLayout();
  const styles = useMemo(() => createStyles(theme, layout.compact), [theme, layout.compact]);
  const colors = useMemo(() => readerPanelColors(theme), [theme]);

  // The sheet stays up until it has slid away. Taken down the moment it was
  // closed, it stopped its slide a frame or two in, so the next opening began
  // where that slide stopped, nearly open, rather than off the right edge.
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);

  const [slide] = useState(() => new Animated.Value(1));
  const reduced = useReducedMotion();
  // How far the panel travels to be out of sight: its width and its shadow's gap.
  const travel = layout.width + 24;
  // Read as the panel opens; a change while it is open moves nothing.
  const openFromRef = useRef(openFrom);
  // The latest of what the swipe out reads, for its handlers outlive renders.
  const swipeRef = useRef({ visible, onClose, travel, reduced });
  useEffect(() => {
    openFromRef.current = openFrom;
    swipeRef.current = { visible, onClose, travel, reduced };
  });
  // A swipe let the panel go on its way out: how far out it was and how fast
  // the finger was going, for the close to carry on from there at that pace.
  const letGoRef = useRef<{ out: number; velocity: number; at: number } | null>(null);
  // Before the frame is drawn, so a panel brought in by a finger is never
  // seen off the edge first.
  useLayoutEffect(() => {
    if (!mounted) return;
    const from = visible ? Math.min(Math.max(openFromRef.current || 0, 0), 1) : 0;
    if (from > 0) slide.setValue(1 - from);
    // Only the swipe's own close: one let go a moment ago, not some later close by a tap.
    const letGo = !visible && letGoRef.current && Date.now() - letGoRef.current.at < 1000 ? letGoRef.current : null;
    letGoRef.current = null;
    Animated.timing(slide, {
      toValue: visible ? 0 : 1,
      // The rest of the way, at the pace of the whole -- or of the finger
      // that swiped it out.
      duration: motionDuration(
        letGo
          ? readerSwipeFinishMs((1 - letGo.out) * travel, travel, letGo.velocity)
          : from > 0 ? Math.max(90, Math.round(220 * (1 - from))) : 220,
        reduced,
      ),
      // Already moving under a finger, it eases out rather than starting slow.
      easing: visible || letGo ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
    // `travel` is read as the panel opens or closes; a rotation while it is up moves nothing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, mounted, slide, reduced]);

  // The swipe out (on a phone or a tablet): taken in the capture phase once a
  // move is plainly to the right, as the reader's own swipes are
  // (hooks/useReaderSwipes.ts), so neither a row, the list, nor the dimmed
  // page's tap-to-close competes for it, while a tap or a scroll up and down
  // the list still lands where it was aimed.
  const heldRef = useRef(false);
  const [hold] = useState(() => () => {
    heldRef.current = true;
  });
  // eslint-disable-next-line react-hooks/refs -- refs are read in gesture callbacks, not during render
  const [swipeOut] = useState(() => {
    // How far across the finger was when the panel took it, and how far out the panel is (0 to 1).
    let fromDx = 0;
    let out = 0;
    const follow = (dx: number) => {
      out = Math.min(Math.max((dx - fromDx) / Math.max(swipeRef.current.travel, 1), 0), 1);
      slide.setValue(out);
    };
    const slideBack = () => {
      const { travel: span, reduced: reducedNow } = swipeRef.current;
      Animated.timing(slide, {
        toValue: 0,
        duration: motionDuration(readerSwipeFinishMs(out * span, span, 0), reducedNow),
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    };
    return PanResponder.create({
      // A new finger: whatever held the last one has let it go. (React Native
      // settles the responder before a control's own onTouchStart, which holds again.)
      onStartShouldSetPanResponderCapture: () => {
        heldRef.current = false;
        return false;
      },
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        if (!swipeRef.current.visible || heldRef.current || gestureState.numberActiveTouches > 1) return false;
        if (readerSwipeFor(gestureState.dx, gestureState.dy) !== 'exit') return false;
        // Still on its way in, it stops there and follows the finger from
        // open: the native slide can't say in time how far in it had come.
        slide.stopAnimation();
        fromDx = gestureState.dx;
        out = 0;
        return true;
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, gestureState) => follow(gestureState.dx),
      onPanResponderRelease: (_, gestureState) => {
        follow(gestureState.dx);
        const { travel: span, onClose: close } = swipeRef.current;
        if (readerSwipeGoesThrough(out * span, span, gestureState.vx)) {
          letGoRef.current = { out, velocity: Math.max(gestureState.vx, 0), at: Date.now() };
          close();
        } else slideBack();
      },
      onPanResponderTerminate: slideBack,
    });
  });
  const swipesOut = Platform.OS !== 'web';

  // Clear of the screen's edge on the right: a phone's notch or rounded corner, or none.
  const edge = layout.compact ? Math.max(insets.right, 24) : insets.right;

  return (
    <Modal
      transparent
      animationType="none"
      visible={mounted}
      onRequestClose={onClose}
      onShow={onShown}
      supportedOrientations={modalOrientations}
      // Edge to edge on Android too, as on iOS: it pads itself clear of the bars and the notch.
      statusBarTranslucent
      navigationBarTranslucent
    >
      {/* The panel runs up under the status bar on a phone, so on a light page the clock and battery turn dark. */}
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      {/* Never narrower than the window. iOS lays out a Modal's first frame at
          the screen's size for the way the phone is held, so with the page on
          its side and the phone lying flat, or upright under a rotation lock,
          that frame was portrait-wide, and the panel, set against its right
          edge, showed at the left of the screen until the next frame. */}
      <View style={[styles.overlay, { minWidth: width }]} {...(swipesOut ? swipeOut.panHandlers : null)}>
        <ReaderPanelHoldContext.Provider value={hold}>
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim, opacity: slide.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}
        />
        <Pressable accessibilityLabel={closeAccessibilityLabel} style={styles.backdrop} onPress={onClose} />
        <Animated.View
          style={[
            styles.panel,
            {
              width: layout.width,
              marginTop: layout.belowStatusBar ? insets.top : 0,
              paddingTop: layout.belowStatusBar ? 0 : insets.top,
              paddingRight: edge,
              transform: [{ translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [0, layout.width + 24] }) }],
            },
          ]}
        >
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={[styles.eyebrow, titleArabic && styles.eyebrowArabic]} numberOfLines={1}>{eyebrow}</Text>
              <Text style={[styles.title, titleArabic && styles.titleArabic]} numberOfLines={1}>{title}</Text>
            </View>
            {actions.length ? (
              <View style={styles.actions}>
                {actions.map((action) => (
                  <Pressable
                    key={action.accessibilityLabel}
                    accessibilityRole="button"
                    accessibilityLabel={action.accessibilityLabel}
                    hitSlop={4}
                    style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
                    onPress={action.onPress}
                  >
                    <Icon name={action.icon} size={layout.compact ? 17 : 19} color={colors.voice} />
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
          {top ? top(layout) : null}
          <View style={styles.body}>{children(layout)}</View>
          {footer ? (
            <View style={[styles.footer, { paddingBottom: (layout.compact ? 12 : 20) + insets.bottom }]}>{footer}</View>
          ) : (
            <View style={{ height: insets.bottom }} />
          )}
        </Animated.View>
        </ReaderPanelHoldContext.Provider>
      </View>
    </Modal>
  );
}

/**
 * The sheet the panel comes in on while a finger brings it from the right
 * (hooks/useReaderSwipes.ts): drawn on the page itself, for the panel's Modal
 * can't follow a swipe that began beneath it. It is the panel's size, colour
 * and shadow over the same dimming, `progress` (0 to 1) of it in view; the
 * panel opens from there over it (openFrom), and the sheet is taken down
 * once that is up (onShown).
 */
export function ReaderPanelSheet({ progress, theme }: { progress: Animated.Value; theme: DocumentTheme }) {
  const insets = useSafeAreaInsets();
  const layout = useReaderPanelLayout();
  const styles = useMemo(() => createStyles(theme, layout.compact), [theme, layout.compact]);
  const colors = useMemo(() => readerPanelColors(theme), [theme]);
  return (
    // Clipped: parked past the right edge, the sheet would otherwise widen
    // whatever it is drawn in (a browser would pan the page under the finger).
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.overlay, styles.sheetClip]}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim, opacity: progress }]} />
      <Animated.View
        style={[
          styles.panel,
          {
            width: layout.width,
            marginTop: layout.belowStatusBar ? insets.top : 0,
            transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [layout.width + 24, 0] }) }],
          },
        ]}
      />
    </View>
  );
}

function createStyles(theme: DocumentTheme, compact: boolean) {
  const colors = readerPanelColors(theme);
  const side = compact ? 18 : 20;
  return StyleSheet.create({
    overlay: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end' },
    sheetClip: { overflow: 'hidden' },
    backdrop: { flex: 1 },
    panel: {
      backgroundColor: colors.panel,
      // The design's long soft shadow onto the page, from the panel's left edge.
      shadowColor: '#000000',
      shadowOffset: { width: -24, height: 0 },
      shadowOpacity: 0.28,
      shadowRadius: 30,
      elevation: 24,
    },
    header: {
      alignItems: 'flex-end',
      flexDirection: 'row',
      gap: 12,
      justifyContent: 'space-between',
      paddingBottom: compact ? 8 : 14,
      paddingLeft: side,
      paddingRight: compact ? 4 : side,
      paddingTop: compact ? 12 : 20,
    },
    headerText: { flex: 1, minWidth: 0 },
    eyebrow: {
      color: colors.voice,
      fontFamily: TYPOGRAPHY.body,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.76,
      textTransform: 'uppercase',
    },
    // Arabic has no capitals and no letter spacing; it reads right to left.
    eyebrowArabic: { fontFamily: TYPOGRAPHY.arabic, fontSize: 12, letterSpacing: 0, textAlign: 'right', writingDirection: 'rtl' },
    title: {
      color: colors.ink,
      fontFamily: TYPOGRAPHY.title,
      fontSize: compact ? 20 : 25,
      fontWeight: '700',
      lineHeight: compact ? 24 : 30,
      marginTop: 4,
    },
    titleArabic: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'right', writingDirection: 'rtl' },
    actions: { flexDirection: 'row', gap: 6 },
    actionButton: {
      alignItems: 'center',
      backgroundColor: colors.wash,
      borderRadius: 999,
      height: compact ? 34 : 38,
      justifyContent: 'center',
      width: compact ? 34 : 38,
    },
    actionButtonPressed: { backgroundColor: colors.voiceSoft },
    body: { flex: 1, minHeight: 0 },
    footer: {
      borderTopColor: colors.rule,
      borderTopWidth: 1,
      gap: 10,
      paddingLeft: side,
      paddingRight: compact ? 4 : side,
      paddingTop: compact ? 8 : 12,
    },
  });
}
