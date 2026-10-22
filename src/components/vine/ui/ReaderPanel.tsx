import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Animated, Easing, Modal, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { type DocumentTheme } from '../../../constants/documentThemes';
import { TYPOGRAPHY } from '../../../constants/theme';
import { useModalOrientations } from '@/hooks/useModalOrientations';
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
}: ReaderPanelProps) {
  const modalOrientations = useModalOrientations();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const layout = readerPanelLayout({
    width,
    height,
    native: Platform.OS !== 'web',
    mobileWebBreakpoint: MOBILE_WEB_BREAKPOINT,
    rightInset: insets.right,
  });
  const styles = useMemo(() => createStyles(theme, layout.compact), [theme, layout.compact]);
  const colors = useMemo(() => readerPanelColors(theme), [theme]);

  const [slide] = useState(() => new Animated.Value(1));
  const reduced = useReducedMotion();
  useEffect(() => {
    Animated.timing(slide, {
      toValue: visible ? 0 : 1,
      duration: motionDuration(220, reduced),
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible, slide, reduced]);

  // Clear of the screen's edge on the right: a phone's notch or rounded corner, or none.
  const edge = layout.compact ? Math.max(insets.right, 24) : insets.right;

  return (
    <Modal
      transparent
      animationType="none"
      visible={visible}
      onRequestClose={onClose}
      supportedOrientations={modalOrientations}
      // Edge to edge on Android too, as on iOS: it pads itself clear of the bars and the notch.
      statusBarTranslucent
      navigationBarTranslucent
    >
      {/* The panel runs up under the status bar on a phone, so on a light page the clock and battery turn dark. */}
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <View style={styles.overlay}>
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
      </View>
    </Modal>
  );
}

function createStyles(theme: DocumentTheme, compact: boolean) {
  const colors = readerPanelColors(theme);
  const side = compact ? 18 : 20;
  return StyleSheet.create({
    overlay: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end' },
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
