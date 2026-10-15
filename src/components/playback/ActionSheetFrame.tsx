import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Keyboard,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type TextInputProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Icon, { type IconName } from '@/components/vine/ui/Icon';
import { useSheetDragToClose } from '@/components/vine/ui/useSheetDragToClose';
import { COLORS, TYPOGRAPHY } from '@/constants/theme';
import { useModalOrientations } from '@/hooks/useModalOrientations';
import { useIsCompactLandscape } from '@/utils/useIsCompactLandscape';
import { useLayoutMode } from '@/utils/useLayoutMode';
import { motionDuration, useReducedMotion } from '@/utils/useReducedMotion';

/**
 * The sheets that open over a player — a track's More menu, Add to playlist —
 * and the rows they are made of (Coptic Vine design, "Coptic Vine Player":
 * "Add to playlist", "More menu"). One neutral dark surface over a dimmed
 * player, drawn three ways by the room there is:
 * - a phone: a sheet rising from the foot of the screen, pulled down by its
 *   grab handle (or anywhere, with its rows scrolled to the top) to close;
 * - a phone on its side: a panel down the right-hand edge, the height of the
 *   screen, swiped back off the edge to close;
 * - an iPad or a desktop: a dialog in the middle of the window.
 * The dimmed player, the back button and Escape close each of them.
 */

export type ActionSheetMode = 'sheet' | 'side' | 'dialog';

// Arabic script, by its Unicode blocks: the letters, their supplements and presentation forms.
const ARABIC_SCRIPT = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

/**
 * Whether a line is set as Arabic: by its own script rather than the App
 * Language, so an English title keeps the design's type in the Arabic app,
 * and an Arabic playlist name reads right to left in the English one.
 */
export function isArabicText(text: string | null | undefined): boolean {
  return Boolean(text) && ARABIC_SCRIPT.test(text as string);
}

const ModeContext = createContext<ActionSheetMode>('sheet');

/** How the sheet a row sits in is drawn: the side panel sets its rows a little tighter. */
export function useActionSheetMode(): ActionSheetMode {
  return useContext(ModeContext);
}

// The design's own surface: a neutral near-black, not the app's green, so the
// player's colours behind the dimming stay the only colour on screen.
const SURFACE = '#141414';
const USE_NATIVE_DRIVER = Platform.OS !== 'web';
// The side panel's column and leading edge (410 wide in the design, less the
// 22 before it and the notch's clearance after it).
const SIDE_CONTENT_WIDTH = 334;
const SIDE_LEADING = 22;
const DIALOG_WIDTH = 440;
const SWIPE_TO_CLOSE = 80;

interface ActionSheetFrameProps {
  visible: boolean;
  onClose: () => void;
  /** What the dimmed player is called to a screen reader: "Close track options". */
  closeLabel: string;
  children: ReactNode;
}

export default function ActionSheetFrame({ visible, onClose, closeLabel, children }: ActionSheetFrameProps) {
  const modalOrientations = useModalOrientations();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const layout = useLayoutMode();
  const landscapePhone = useIsCompactLandscape();
  const mode: ActionSheetMode = landscapePhone ? 'side' : layout === 'phone' ? 'sheet' : 'dialog';

  // Kept mounted through the closing animation, then let go.
  const [mounted, setMounted] = useState(visible);
  const [progress] = useState(() => new Animated.Value(0));
  const [drag] = useState(() => new Animated.Value(0));
  const [swipe] = useState(() => new Animated.Value(0));
  if (visible && !mounted) setMounted(true);

  const reduced = useReducedMotion();
  useEffect(() => {
    if (!mounted) return undefined;
    if (visible) {
      drag.setValue(0);
      swipe.setValue(0);
    }
    const animation = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: motionDuration(visible ? 260 : 200, reduced),
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: USE_NATIVE_DRIVER,
    });
    animation.start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
    return () => animation.stop();
  }, [drag, mounted, progress, reduced, swipe, visible]);

  const sheetDrag = useSheetDragToClose(visible, drag, onClose);

  // The side panel goes back the way it came: a swipe toward the right edge.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  // eslint-disable-next-line react-hooks/refs -- refs are read in gesture callbacks, not during render
  const [swipeResponder] = useState(() => {
    const settle = () => Animated.spring(swipe, { toValue: 0, useNativeDriver: USE_NATIVE_DRIVER, bounciness: 4 }).start();
    return PanResponder.create({
      // Taken in the capture phase, ahead of the rows the swipe starts on; only
      // a clear sideways drag, so the list still scrolls and the rows still tap.
      onMoveShouldSetPanResponderCapture: (_, gesture) => gesture.dx > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, gesture) => swipe.setValue(Math.max(0, gesture.dx)),
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > SWIPE_TO_CLOSE || gesture.vx > 1.2) onCloseRef.current();
        else settle();
      },
      onPanResponderTerminate: settle,
    });
  });

  // A new playlist's name is typed in the sheet: on an iPhone the keyboard
  // would cover it, so the sheet rises above the keyboard. (Android resizes
  // the window around its keyboard by itself.)
  const [keyboard, setKeyboard] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'ios' || !mounted) return undefined;
    const shown = Keyboard.addListener('keyboardWillShow', (event) => setKeyboard(event.endCoordinates.height));
    const hidden = Keyboard.addListener('keyboardWillHide', () => setKeyboard(0));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, [mounted]);

  if (!mounted) return null;

  const body = (
    <ScrollView
      bounces={false}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      onScroll={mode === 'sheet' ? sheetDrag.onScroll : undefined}
      scrollEventThrottle={16}
      style={styles.scroll}
    >
      {children}
    </ScrollView>
  );

  let surface: ReactNode;
  if (mode === 'dialog') {
    const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] });
    surface = (
      <View style={[styles.dialogFrame, { paddingBottom: keyboard }]} pointerEvents="box-none">
        <Animated.View
          style={[styles.dialog, {
            width: Math.min(DIALOG_WIDTH, width - 32),
            maxHeight: height - 80 - keyboard,
            opacity: progress,
            transform: [{ scale }],
          }]}
        >
          {body}
        </Animated.View>
      </View>
    );
  } else if (mode === 'side') {
    // Clear of the notch on the right, however the phone is turned: iOS
    // reports the clearance on both sides when it is on its side.
    const trailing = Math.max(insets.right, SIDE_LEADING);
    const panelWidth = Math.min(SIDE_LEADING + SIDE_CONTENT_WIDTH + trailing, width);
    const translateX = Animated.add(
      progress.interpolate({ inputRange: [0, 1], outputRange: [panelWidth, 0] }),
      swipe,
    );
    surface = (
      <Animated.View
        style={[styles.side, {
          width: panelWidth,
          bottom: keyboard,
          paddingTop: Math.max(insets.top, 16),
          paddingBottom: keyboard ? 12 : Math.max(insets.bottom, 16),
          paddingRight: trailing,
          transform: [{ translateX }],
        }]}
        {...swipeResponder.panHandlers}
      >
        {body}
      </Animated.View>
    );
  } else {
    const translateY = Animated.add(
      progress.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }),
      drag,
    );
    surface = (
      <Animated.View
        style={[styles.sheet, {
          bottom: keyboard,
          maxHeight: height - Math.max(insets.top, 20) - 24 - keyboard,
          // The design leaves the home indicator's 34 under the last row.
          paddingBottom: keyboard ? 16 : Math.max(insets.bottom, 34),
          paddingLeft: 20 + insets.left,
          paddingRight: 20 + insets.right,
          transform: [{ translateY }],
        }]}
        {...sheetDrag.sheetHandlers}
      >
        <View style={styles.grabArea} {...sheetDrag.grabHandlers}>
          <View style={styles.grab} />
        </View>
        {body}
      </Animated.View>
    );
  }

  return (
    <Modal supportedOrientations={modalOrientations} visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <ModeContext.Provider value={mode}>
        <Animated.View style={[styles.dim, { opacity: progress }]}>
          <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel={closeLabel} onPress={onClose} />
        </Animated.View>
        {surface}
      </ModeContext.Provider>
    </Modal>
  );
}

interface SheetHeaderProps {
  /** The item's picture, 52 square. */
  artwork?: ReactNode;
  /** The gold line over the title: the release, or what the sheet is for. */
  kicker?: string | null;
  title: string;
}

/** The item a sheet is about: its artwork, a gold kicker, and its name. */
export function SheetHeader({ artwork, kicker, title }: SheetHeaderProps) {
  return (
    <View style={styles.header}>
      {artwork}
      <View style={styles.headerText}>
        {kicker ? <Text numberOfLines={2} style={[styles.kicker, isArabicText(kicker) && styles.arabicCaps]}>{kicker}</Text> : null}
        <Text numberOfLines={2} style={[styles.title, !kicker && styles.titleAlone, isArabicText(title) && styles.arabic]}>{title}</Text>
      </View>
    </View>
  );
}

/** A gold, spaced capital heading over a group of rows: "Your playlists". */
export function SheetSectionLabel({ children }: { children: string }) {
  const mode = useActionSheetMode();
  return (
    <Text accessibilityRole="header" style={[styles.section, mode === 'side' && styles.sectionSide, isArabicText(children) && styles.arabicCaps]}>
      {children}
    </Text>
  );
}

/** The rows of a sheet, six apart. */
export function SheetRowGroup({ children, first = false }: { children: ReactNode; first?: boolean }) {
  return <View style={[styles.rowGroup, first && styles.rowGroupFirst]}>{children}</View>;
}

interface SheetRowProps {
  icon: IconName;
  label: string;
  detail?: string | null;
  onPress: () => void;
  /** The icon's tile: the gold tint of an action, or the grey of a playlist. */
  chip?: 'gold' | 'grey';
  iconColor?: string;
  /** `accent` sets the label in gold (New playlist), `danger` in red (Remove download). */
  tone?: 'plain' | 'accent' | 'danger';
  /** A chevron for a row that goes somewhere, a check circle for one that toggles. */
  trailing?: 'chevron' | 'check' | 'none';
  checked?: boolean;
  busy?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

/** One row of a sheet: an icon on its tile, a label (and a line under it), and what it leads to. */
export function SheetRow({
  icon, label, detail, onPress, chip = 'gold', iconColor = COLORS.gold, tone = 'plain', trailing = 'none',
  checked = false, busy = false, disabled = false, accessibilityLabel, accessibilityHint,
}: SheetRowProps) {
  const mode = useActionSheetMode();
  const toggles = trailing === 'check';
  return (
    <Pressable
      accessibilityRole={toggles ? 'checkbox' : 'button'}
      accessibilityLabel={accessibilityLabel ?? (detail ? `${label}, ${detail}` : label)}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || busy, busy, ...(toggles ? { checked } : null) }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.row,
        mode === 'side' && styles.rowSide,
        hovered && styles.rowHovered,
        pressed && styles.rowPressed,
        disabled && !busy && styles.rowDisabled,
      ]}
    >
      <View style={[styles.chip, chip === 'grey' && styles.chipGrey]}>
        {busy && !toggles ? <ActivityIndicator size="small" color={iconColor} /> : <Icon name={icon} size={20} color={iconColor} />}
      </View>
      <View style={styles.rowText}>
        <Text numberOfLines={1} style={[styles.rowLabel, tone === 'accent' && styles.rowLabelAccent, tone === 'danger' && styles.rowLabelDanger, isArabicText(label) && styles.arabic]}>
          {label}
        </Text>
        {detail ? <Text numberOfLines={1} style={[styles.rowDetail, isArabicText(detail) && styles.arabic]}>{detail}</Text> : null}
      </View>
      {trailing === 'chevron' ? <Icon name="chevron-forward" size={17} color={COLORS.gold} /> : null}
      {toggles ? (
        <View style={[styles.check, checked && !busy && styles.checkOn]}>
          {busy
            ? <ActivityIndicator size="small" color={COLORS.gold} />
            : checked ? <Icon name="checkmark" size={16} color={COLORS.greenDeep} /> : null}
        </View>
      ) : null}
    </Pressable>
  );
}

/** A quiet line of explanation under the rows: an empty list, a sign-in. */
export function SheetNote({ children }: { children: string }) {
  const mode = useActionSheetMode();
  return <Text style={[styles.note, mode === 'side' && styles.noteSide, isArabicText(children) && styles.arabic]}>{children}</Text>;
}

export function SheetError({ children }: { children: string }) {
  return <Text accessibilityRole="alert" style={styles.error}>{children}</Text>;
}

export function SheetLoading() {
  return <ActivityIndicator color={COLORS.gold} style={styles.loading} />;
}

/** A field of the new-playlist form, on the rows' own tint; a gold hairline marks the one being typed in. */
export function SheetTextField({ style, multiline, onFocus, onBlur, ...props }: TextInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      placeholderTextColor="rgba(255, 255, 255, 0.4)"
      multiline={multiline}
      onFocus={(event) => { setFocused(true); onFocus?.(event); }}
      onBlur={(event) => { setFocused(false); onBlur?.(event); }}
      style={[styles.field, multiline && styles.fieldMultiline, focused && styles.fieldFocused, style]}
      {...props}
    />
  );
}

interface SheetSegmentsProps<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}

/** A pill of choices, the chosen one gold: Private · Public. */
export function SheetSegments<T extends string>({ value, options, onChange }: SheetSegmentsProps<T>) {
  return (
    <View style={styles.segments}>
      {options.map((option) => {
        const on = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => onChange(option.value)}
            style={[styles.segment, on && styles.segmentOn]}
          >
            <Text style={[styles.segmentText, on && styles.segmentTextOn, isArabicText(option.label) && styles.arabic]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The gold button that completes a sheet's form. */
export function SheetButton({ label, onPress, disabled = false, busy = false }: {
  label: string; onPress: () => void; disabled?: boolean; busy?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [styles.button, (disabled || busy) && styles.buttonDisabled, pressed && styles.buttonPressed]}
    >
      {busy ? <ActivityIndicator color={COLORS.greenDeep} /> : <Text style={[styles.buttonText, isArabicText(label) && styles.arabic]}>{label}</Text>}
    </Pressable>
  );
}

const ROW_TINT = 'rgba(255, 255, 255, 0.06)';
const QUIET = 'rgba(255, 255, 255, 0.55)';

const styles = StyleSheet.create({
  dim: { backgroundColor: 'rgba(0, 0, 0, 0.5)', bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  scroll: { flexGrow: 0, flexShrink: 1 },
  sheet: {
    backgroundColor: SURFACE,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    boxShadow: '0px -20px 50px rgba(0, 0, 0, 0.5)',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  grabArea: { alignItems: 'center', paddingBottom: 14, paddingTop: 10 },
  grab: { backgroundColor: 'rgba(255, 255, 255, 0.25)', borderRadius: 2.5, height: 5, width: 40 },
  side: {
    backgroundColor: SURFACE,
    borderBottomLeftRadius: 28,
    borderTopLeftRadius: 28,
    boxShadow: '-20px 0px 50px rgba(0, 0, 0, 0.5)',
    paddingLeft: SIDE_LEADING,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  dialogFrame: { alignItems: 'center', bottom: 0, justifyContent: 'center', left: 0, position: 'absolute', right: 0, top: 0 },
  dialog: {
    backgroundColor: SURFACE,
    borderRadius: 28,
    boxShadow: '0px 30px 80px rgba(0, 0, 0, 0.6)',
    paddingBottom: 26,
    paddingHorizontal: 24,
    paddingTop: 22,
  },

  header: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  headerText: { flex: 1, minWidth: 0 },
  kicker: {
    color: COLORS.gold,
    fontFamily: TYPOGRAPHY.body,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.76,
    lineHeight: 14,
    textTransform: 'uppercase',
  },
  title: {
    color: COLORS.white,
    fontFamily: TYPOGRAPHY.title,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22.5,
    marginTop: 3,
  },
  titleAlone: { marginTop: 0 },
  section: {
    color: COLORS.gold,
    fontFamily: TYPOGRAPHY.body,
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 1.84,
    marginBottom: 10,
    marginHorizontal: 2,
    marginTop: 22,
    textTransform: 'uppercase',
  },
  sectionSide: { marginBottom: 8, marginTop: 14 },

  rowGroup: { gap: 6 },
  rowGroupFirst: { marginTop: 18 },
  row: {
    alignItems: 'center',
    backgroundColor: ROW_TINT,
    borderRadius: 16,
    flexDirection: 'row',
    gap: 12,
    minHeight: 56,
    paddingLeft: 8,
    paddingRight: 12,
    paddingVertical: 8,
  },
  rowSide: { minHeight: 50, paddingVertical: 5 },
  rowHovered: { backgroundColor: 'rgba(255, 255, 255, 0.09)' },
  rowPressed: { backgroundColor: 'rgba(255, 255, 255, 0.12)' },
  rowDisabled: { opacity: 0.5 },
  chip: {
    alignItems: 'center',
    backgroundColor: COLORS.goldSoft,
    borderRadius: 10,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  chipGrey: { backgroundColor: 'rgba(255, 255, 255, 0.1)' },
  rowText: { flex: 1, minWidth: 0 },
  rowLabel: { color: COLORS.white, fontFamily: TYPOGRAPHY.body, fontSize: 15.5, fontWeight: '700' },
  rowLabelAccent: { color: COLORS.gold },
  rowLabelDanger: { color: '#FF8A8A' },
  rowDetail: { color: QUIET, fontFamily: TYPOGRAPHY.body, fontSize: 12.5, marginTop: 2 },
  check: {
    alignItems: 'center',
    borderColor: 'rgba(255, 255, 255, 0.35)',
    borderRadius: 13,
    borderWidth: 1.5,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  checkOn: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },

  note: { color: QUIET, fontFamily: TYPOGRAPHY.body, fontSize: 13.5, lineHeight: 19.6, paddingHorizontal: 4, paddingTop: 12 },
  noteSide: { paddingTop: 8 },
  error: { color: '#FF8A8A', fontFamily: TYPOGRAPHY.body, fontSize: 13, lineHeight: 18, marginTop: 12, paddingHorizontal: 4 },
  loading: { marginVertical: 28 },

  field: {
    backgroundColor: ROW_TINT,
    borderColor: 'transparent',
    borderRadius: 14,
    borderWidth: 1,
    color: COLORS.white,
    fontFamily: TYPOGRAPHY.body,
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  fieldMultiline: { minHeight: 72, paddingTop: 13, textAlignVertical: 'top' },
  // In place of the browser's own focus ring.
  fieldFocused: { borderColor: COLORS.goldLine, outlineWidth: 0 },
  segments: { backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: 999, flexDirection: 'row', padding: 4 },
  segment: { alignItems: 'center', borderRadius: 999, flex: 1, height: 34, justifyContent: 'center', paddingHorizontal: 18 },
  segmentOn: { backgroundColor: COLORS.gold },
  segmentText: { color: 'rgba(255, 255, 255, 0.7)', fontFamily: TYPOGRAPHY.body, fontSize: 14, fontWeight: '700' },
  segmentTextOn: { color: COLORS.greenDeep },
  button: { alignItems: 'center', backgroundColor: COLORS.gold, borderRadius: 16, height: 50, justifyContent: 'center' },
  buttonDisabled: { opacity: 0.45 },
  buttonPressed: { opacity: 0.82 },
  buttonText: { color: COLORS.greenDeep, fontFamily: TYPOGRAPHY.body, fontSize: 15, fontWeight: '800' },

  // Arabic keeps the English layout; only the script's direction changes.
  arabic: { fontFamily: TYPOGRAPHY.arabic, textAlign: 'left', writingDirection: 'rtl' },
  // Arabic has no capitals to space: spacing would pull its joined letters
  // apart, and at the capitals' small size it wants a size more to read.
  arabicCaps: { fontFamily: TYPOGRAPHY.arabic, fontSize: 12.5, letterSpacing: 0, lineHeight: 17, textAlign: 'left', writingDirection: 'rtl' },
});
